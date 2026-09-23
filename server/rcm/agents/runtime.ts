// Agentic RCM runtime — a small, auditable plan→act loop over a typed tool registry.
//
// Guardrails (hard, code-enforced; not prompt-enforced):
//   1. Money-moving / payer-facing actions (submit claim, send appeal, write-off, refund,
//      agency referral, change codes) are `requiresApproval` → queued for a human; the agent
//      never executes them directly.
//   2. Every step is written to the audit log (who/what/why/outcome).
//   3. Per-run budget: max steps + max tool calls; loops fail closed.
//   4. AI (planner/polish) is optional: with `RCM_AI_ENABLED!=true` every agent runs its
//      deterministic plan. When enabled, PHI-bearing prompts go through ai-provider (Vertex).
//   5. No PHI in agent audit `detail` beyond ids and amounts.
import { rcmStore, type Approval, type RcmStore } from "../store";
import { makeWorkItem } from "../worklists";

// Shared, mutable step budget: the orchestrator's `run-agent` tool passes its own `ctx.budget`
// through to the child `agentRuntime.run` call so nested agents draw from the same pool
// instead of each getting a fresh MAX_STEPS — otherwise a single top-level run could fan out
// to unbounded child steps.
export interface StepBudget { remaining: number }
export interface ToolContext { tenantId: string; store: RcmStore; actor: string; dryRun: boolean; budget: StepBudget }

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  requiresApproval?: boolean;
  approvalReason?: string;
  run(input: I, ctx: ToolContext): Promise<O>;
}

export interface AgentStep { tool: string; input: Record<string, unknown>; why: string }
export interface AgentResult { agent: string; steps: Array<AgentStep & { outcome: "ok" | "needs-approval" | "blocked" | "error"; output?: unknown; approvalId?: string; error?: string }>; summary: string; approvalsRequested: number; dryRun: boolean }

export interface AgentDefinition {
  name: string;
  description: string;
  tools: Tool<any, any>[];
  // Deterministic planner: inspects state and returns steps. AI may re-rank/annotate but
  // cannot invent tools (unknown tool names are blocked).
  plan(ctx: ToolContext, args: Record<string, unknown>): Promise<AgentStep[]>;
  summarize(steps: AgentResult["steps"]): string;
}

// Total step ceiling for a run tree: the top-level call gets a fresh budget of this size, and
// every nested `run-agent` call (the orchestrator's fan-out) draws from that same shared pool
// via `opts.budget`, so a single top-level invocation can never fan out to unbounded steps.
const MAX_STEPS = 300;

export class AgentRuntime {
  private agents = new Map<string, AgentDefinition>();
  // In-process lock on the *attempt* to execute a given approval — separate from the
  // persisted `executedAt` flag, which is only ever set after the tool actually succeeds.
  // This is what lets a failed execution (tool threw, or was removed) be retried, while still
  // preventing two concurrent executeApproved calls for the same id from both running the tool.
  private executing = new Set<string>();
  // In-process lock on the (tenant, agent, tool, payload) key of an approval request in
  // progress — closes the check-then-create race between two concurrent run() calls that could
  // otherwise both see no live approval yet and both mint one for the same money-moving action.
  private approvalRequestInFlight = new Set<string>();
  constructor(private store: RcmStore = rcmStore) {}

  register(def: AgentDefinition): void { this.agents.set(def.name, def); }
  list(): Array<{ name: string; description: string; tools: Array<{ name: string; requiresApproval: boolean }> }> {
    return Array.from(this.agents.values()).map((a) => ({ name: a.name, description: a.description, tools: a.tools.map((t) => ({ name: t.name, requiresApproval: !!t.requiresApproval })) }));
  }
  get(name: string): AgentDefinition | undefined { return this.agents.get(name); }

  async run(name: string, tenantId: string, args: Record<string, unknown> = {}, opts: { actor?: string; dryRun?: boolean; budget?: StepBudget } = {}): Promise<AgentResult> {
    const def = this.agents.get(name);
    if (!def) throw new Error(`Unknown agent ${name}`);
    const budget = opts.budget ?? { remaining: MAX_STEPS };
    const ctx: ToolContext = { tenantId, store: this.store, actor: opts.actor ?? `agent:${name}`, dryRun: !!opts.dryRun, budget };
    const tools = new Map(def.tools.map((t) => [t.name, t]));
    const steps: AgentResult["steps"] = [];
    let approvals = 0;
    await this.store.audit(tenantId, { agent: name, step: "start", detail: { args: Object.keys(args), dryRun: ctx.dryRun }, outcome: "ok" });
    const plan = (await def.plan(ctx, args)).slice(0, Math.max(0, budget.remaining));
    for (const step of plan) {
      // The initial slice only bounds THIS call's own plan — a step earlier in that same plan
      // can itself be a nested run-agent call sharing this budget object, and can exhaust it
      // before this loop reaches its own later steps. Re-check before spending (and executing)
      // another step, rather than only slicing once up front.
      if (budget.remaining <= 0) { steps.push({ ...step, outcome: "blocked", error: "step budget exhausted" }); await this.store.audit(tenantId, { agent: name, step: step.tool, detail: { blocked: "step budget exhausted" }, outcome: "blocked" }); continue; }
      budget.remaining--;
      const tool = tools.get(step.tool);
      if (!tool) { steps.push({ ...step, outcome: "blocked", error: "unknown tool" }); await this.store.audit(tenantId, { agent: name, step: step.tool, detail: { blocked: "unknown tool" }, outcome: "blocked" }); continue; }
      if (ctx.dryRun) {
        // A dry run must be fully side-effect-free, including for approval-gated tools: it
        // reports what *would* happen without writing an approval row or a work item.
        const outcome: "ok" | "needs-approval" = tool.requiresApproval ? "needs-approval" : "ok";
        if (outcome === "needs-approval") approvals++;
        steps.push({ ...step, outcome, output: outcome === "ok" ? { dryRun: true } : undefined });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { dryRun: true }, outcome });
        continue;
      }
      if (tool.requiresApproval) {
        // A re-plan of the same still-unresolved state (a denial that hasn't been decided on
        // yet, a claim still awaiting submission) must not queue a second, distinct approval for
        // the identical action — approving both would run a money-moving tool (write-off,
        // refund, transfer-to-patient) twice against the same record. Dedupe on the exact same
        // agent/action/payload having a still-live approval (pending, or approved but not yet
        // executed) before minting a new one. The check-then-create sequence below is separated
        // by an `await`, so two concurrent runs could both see an empty result — close that with
        // a synchronous pre-await lock on the same key, derivable here with no awaits yet spent.
        const payloadKey = JSON.stringify(step.input);
        const dedupeKey = `${tenantId}:${name}:${tool.name}:${payloadKey}`;
        if (this.approvalRequestInFlight.has(dedupeKey)) {
          steps.push({ ...step, outcome: "blocked", error: "another in-flight run is already requesting this same approval" });
          await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { blocked: "duplicate in-flight approval request" }, outcome: "blocked" });
          continue;
        }
        this.approvalRequestInFlight.add(dedupeKey);
        let approval: Approval;
        let deduped = false;
        try {
          const live = (await this.store.listApprovals(tenantId)).find((a) => a.agent === name && a.action === tool.name && JSON.stringify(a.payload) === payloadKey && (a.status === "pending" || (a.status === "approved" && !a.executedAt)));
          deduped = !!live;
          approval = live ?? (await this.store.requestApproval(tenantId, { agent: name, action: tool.name, payload: step.input, reason: `${step.why} — ${tool.approvalReason ?? "human approval required"}` }));
          if (!live) await this.store.addWorkItems(tenantId, [makeWorkItem({ queue: "agent-approval", title: `${name}: ${tool.name} — ${step.why}`, patientId: typeof step.input.patientId === "string" ? step.input.patientId : undefined, claimId: typeof step.input.claimId === "string" ? step.input.claimId : undefined, amount: typeof step.input.amount === "number" ? step.input.amount : undefined, priority: 70, source: "agent", context: { approvalId: approval.id } })]);
        } finally {
          this.approvalRequestInFlight.delete(dedupeKey);
        }
        approvals++;
        steps.push({ ...step, outcome: "needs-approval", approvalId: approval.id });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { approvalId: approval.id, deduped }, outcome: "needs-approval" });
        continue;
      }
      try {
        const output = await tool.run(step.input, ctx);
        steps.push({ ...step, outcome: "ok", output });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: summarizeForAudit(step.input), outcome: "ok" });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        steps.push({ ...step, outcome: "error", error });
        // The raw message is safe to hand straight back to the actor who triggered this run (it
        // stays on the returned AgentStep above), but it must never be persisted verbatim into
        // the durable, broadly-queryable audit log — a tool's thrown message isn't guaranteed to
        // stay PHI-free forever (a future vendor adapter could echo back a patient name or raw
        // payer response text), and `/agents/audit` exposes stored detail. Persist a fixed marker
        // instead of the message itself.
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { error: "tool threw — see step result for detail (not persisted to audit)" }, outcome: "error" });
      }
    }
    const summary = def.summarize(steps);
    await this.store.audit(tenantId, { agent: name, step: "end", detail: { steps: steps.length, approvals }, outcome: "ok" });
    return { agent: name, steps, summary, approvalsRequested: approvals, dryRun: ctx.dryRun };
  }

  // Execute a previously approved action (called from the approvals route).
  async executeApproved(tenantId: string, approvalId: string, by: string): Promise<{ ok: boolean; output?: unknown; error?: string }> {
    const approvals = await this.store.listApprovals(tenantId);
    const a = approvals.find((x) => x.id === approvalId);
    if (!a) return { ok: false, error: "approval not found" };
    if (a.status !== "approved") return { ok: false, error: `approval status is ${a.status}` };
    if (a.executedAt) return { ok: false, error: "approval already executed" };
    if (this.executing.has(approvalId)) return { ok: false, error: "execution already in progress" };
    this.executing.add(approvalId);
    try {
      const def = this.agents.get(a.agent);
      const tool = def?.tools.find((t) => t.name === a.action);
      if (!tool) return { ok: false, error: "tool no longer available" };
      const output = await tool.run(a.payload, { tenantId, store: this.store, actor: by, dryRun: false, budget: { remaining: MAX_STEPS } });
      // Only mark executed on success — a thrown error (or a since-removed tool, above) must
      // stay retryable rather than being permanently locked out.
      await this.store.markApprovalExecuted(tenantId, approvalId);
      await this.store.audit(tenantId, { agent: a.agent, step: `${tool.name}:approved-exec`, detail: { approvalId, by }, outcome: "ok" });
      return { ok: true, output };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      // Same redaction as the plan-loop's error path — the raw message goes back to the caller
      // (returned below) but never into the durable audit log.
      await this.store.audit(tenantId, { agent: a.agent, step: `${a.action}:approved-exec`, detail: { approvalId, error: "tool threw — see execution result for detail (not persisted to audit)" }, outcome: "error" });
      return { ok: false, error };
    } finally {
      this.executing.delete(approvalId);
    }
  }
}

function summarizeForAudit(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (/id$|^amount$|^cpt$|^carc$|^count$|^status$/i.test(k) && (typeof v === "string" || typeof v === "number")) out[k] = v;
  return out;
}

export const agentRuntime = new AgentRuntime();
