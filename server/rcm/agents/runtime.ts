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
import { rcmStore, type RcmStore } from "../store";
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
        const approval = await this.store.requestApproval(tenantId, { agent: name, action: tool.name, payload: step.input, reason: `${step.why} — ${tool.approvalReason ?? "human approval required"}` });
        await this.store.addWorkItems(tenantId, [makeWorkItem({ queue: "agent-approval", title: `${name}: ${tool.name} — ${step.why}`, patientId: typeof step.input.patientId === "string" ? step.input.patientId : undefined, claimId: typeof step.input.claimId === "string" ? step.input.claimId : undefined, amount: typeof step.input.amount === "number" ? step.input.amount : undefined, priority: 70, source: "agent", context: { approvalId: approval.id } })]);
        approvals++;
        steps.push({ ...step, outcome: "needs-approval", approvalId: approval.id });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { approvalId: approval.id }, outcome: "needs-approval" });
        continue;
      }
      try {
        const output = await tool.run(step.input, ctx);
        steps.push({ ...step, outcome: "ok", output });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: summarizeForAudit(step.input), outcome: "ok" });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        steps.push({ ...step, outcome: "error", error });
        await this.store.audit(tenantId, { agent: name, step: tool.name, detail: { error }, outcome: "error" });
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
    if (!(await this.store.claimApprovalExecution(tenantId, approvalId))) return { ok: false, error: "approval already executed" };
    const def = this.agents.get(a.agent);
    const tool = def?.tools.find((t) => t.name === a.action);
    if (!tool) return { ok: false, error: "tool no longer available" };
    try {
      const output = await tool.run(a.payload, { tenantId, store: this.store, actor: by, dryRun: false, budget: { remaining: MAX_STEPS } });
      await this.store.audit(tenantId, { agent: a.agent, step: `${tool.name}:approved-exec`, detail: { approvalId, by }, outcome: "ok" });
      return { ok: true, output };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await this.store.audit(tenantId, { agent: a.agent, step: `${tool.name}:approved-exec`, detail: { approvalId, error }, outcome: "error" });
      return { ok: false, error };
    }
  }
}

function summarizeForAudit(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (/id$|^amount$|^cpt$|^carc$|^count$|^status$/i.test(k) && (typeof v === "string" || typeof v === "number")) out[k] = v;
  return out;
}

export const agentRuntime = new AgentRuntime();
