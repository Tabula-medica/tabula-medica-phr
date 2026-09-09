// The RCM agent fleet. Each agent = deterministic planner + typed tools; money-moving tools
// require human approval (enforced by the runtime). Register all on the shared runtime.
import { agentRuntime, type AgentDefinition, type AgentStep, type Tool, type ToolContext } from "./runtime";
import { aiText } from "./ai";
import { checkEligibility, detectDiscrepancies, eligibilityIsStale, estimatePatientResponsibility, financialClearance } from "../eligibility";
import { authCoversService, createAuthRequest, linesNeedingAuth, transitionAuth } from "../prior-auth";
import { applyAutoFixes, scrubClaim } from "../scrubber";
import { claimsNeedingFollowUp, correctedClaim, transitionClaim } from "../claims";
import { generateAppealLetter, recommendAction } from "../denials";
import { buildStatement, collectionsStage, createPaymentPlan, detectCreditBalances, propensityToPay, smallBalanceWriteOffs } from "../patient-financials";
import { itemsFromAuths, itemsFromClaimFollowUp, itemsFromDenials, itemsFromScrub, makeWorkItem } from "../worklists";
import { computeKpis } from "../analytics";
import { newId, todayIso } from "../util";
import type { Claim, Denial, LedgerEntry } from "../types";
import { buildPayerCallScript } from "./payer-call";

// ---------- Eligibility agent ----------
const runEligibility: Tool<{ coverageId: string; patientId: string; dateOfService: string }, unknown> = {
  name: "run-eligibility",
  description: "Run 270/271 for a coverage and store the benefit snapshot",
  async run(input, ctx) {
    const coverage = await ctx.store.getCoverage(ctx.tenantId, input.coverageId);
    const patient = await ctx.store.getPatient(ctx.tenantId, input.patientId);
    if (!coverage || !patient) throw new Error("coverage or patient not found");
    const benefits = await checkEligibility({ patient, coverage, dateOfService: input.dateOfService, providerNpi: "1234567893" });
    await ctx.store.setBenefits(ctx.tenantId, coverage.id, benefits);
    const est = estimatePatientResponsibility([{ cpt: "99213", units: 1 }], benefits);
    const disc = detectDiscrepancies({ firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, memberId: coverage.memberId }, {});
    const clearance = financialClearance(benefits, est, disc);
    if (!clearance.cleared) await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "eligibility", title: `Not cleared: ${clearance.reasons.join("; ")}`, patientId: patient.id, priority: 75, source: "agent", context: { coverageId: coverage.id, actions: clearance.actions } })]);
    return { active: benefits.active, cleared: clearance.cleared, collectAtVisit: clearance.collectAtVisit };
  },
};

const eligibilityAgent: AgentDefinition = {
  name: "eligibility",
  description: "Pre-visit: re-verifies stale/missing eligibility for every scheduled patient and opens clearance work items.",
  tools: [runEligibility],
  async plan(ctx, args) {
    const dos = typeof args.dateOfService === "string" ? args.dateOfService : todayIso();
    const steps: AgentStep[] = [];
    for (const p of await ctx.store.listPatients(ctx.tenantId)) {
      for (const c of await ctx.store.coveragesForPatient(ctx.tenantId, p.id)) {
        const snap = await ctx.store.getBenefits(ctx.tenantId, c.id);
        if (eligibilityIsStale(snap, dos)) steps.push({ tool: "run-eligibility", input: { coverageId: c.id, patientId: p.id, dateOfService: dos }, why: snap ? "benefit snapshot older than 30 days" : "no eligibility on file" });
      }
    }
    return steps;
  },
  summarize: (s) => `Eligibility: ${s.filter((x) => x.outcome === "ok").length} checks run, ${s.filter((x) => x.outcome === "ok" && (x.output as { cleared?: boolean })?.cleared === false).length} need front-desk action.`,
};

// ---------- Prior-auth agent ----------
const openAuth: Tool<{ patientId: string; coverageId: string; payerId: string; cpt: string; diagnoses: string[] }, unknown> = {
  name: "open-auth-request",
  description: "Create and mark requested a prior-auth for an auth-required service",
  async run(input, ctx) {
    const pa = transitionAuth(createAuthRequest(input), "requested", { actor: ctx.actor, note: "Agent-submitted 278 (stub)" });
    await ctx.store.upsertAuth(ctx.tenantId, pa);
    await ctx.store.addWorkItems(ctx.tenantId, itemsFromAuths([pa]));
    return { authId: pa.id, slaDeadline: pa.slaDeadline, missingDocumentation: pa.missingDocumentation };
  },
};
const attachAuth: Tool<{ claimId: string; authId: string }, unknown> = {
  name: "attach-auth-to-claim",
  description: "Attach an approved auth number to a claim",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    const auth = await ctx.store.getAuth(ctx.tenantId, input.authId);
    if (!claim || !auth?.authNumber) throw new Error("claim or approved auth missing");
    await ctx.store.upsertClaim(ctx.tenantId, { ...claim, priorAuthNumber: auth.authNumber });
    return { attached: auth.authNumber };
  },
};
const priorAuthAgent: AgentDefinition = {
  name: "prior-auth",
  description: "Finds draft claims with auth-required services, opens 278 requests, attaches approved auth numbers, escalates SLA breaches.",
  tools: [openAuth, attachAuth],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const auths = await ctx.store.listAuths(ctx.tenantId);
    for (const claim of await ctx.store.listClaims(ctx.tenantId, { status: "draft" })) {
      const contract = await ctx.store.getContract(ctx.tenantId, claim.payerId);
      for (const { line, check } of linesNeedingAuth(claim.lines, contract)) {
        const existing = auths.find((a) => a.patientId === claim.patientId && a.cpt === line.cpt);
        if (existing && authCoversService(existing, line.cpt, line.dateOfService).ok) { if (!claim.priorAuthNumber) steps.push({ tool: "attach-auth-to-claim", input: { claimId: claim.id, authId: existing.id }, why: "approved auth on file" }); continue; }
        if (existing && ["requested", "pended"].includes(existing.status)) continue;
        steps.push({ tool: "open-auth-request", input: { patientId: claim.patientId, coverageId: claim.coverageId, payerId: claim.payerId, cpt: line.cpt, diagnoses: claim.diagnoses.map((d) => d.code) }, why: check.reason ?? "auth required" });
      }
    }
    return steps;
  },
  summarize: (s) => `Prior auth: ${s.filter((x) => x.tool === "open-auth-request" && x.outcome === "ok").length} requests opened, ${s.filter((x) => x.tool === "attach-auth-to-claim" && x.outcome === "ok").length} auth numbers attached.`,
};

// ---------- Scrubber agent ----------
const scrubAndFix: Tool<{ claimId: string }, unknown> = {
  name: "scrub-claim",
  description: "Scrub a draft claim, apply safe auto-fixes, move clean claims to ready, open edit work items otherwise",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const patient = await ctx.store.getPatient(ctx.tenantId, claim.patientId);
    const coverage = await ctx.store.getCoverage(ctx.tenantId, claim.coverageId);
    const contract = await ctx.store.getContract(ctx.tenantId, claim.payerId);
    const others = (await ctx.store.listClaims(ctx.tenantId, { patientId: claim.patientId })).filter((c) => c.id !== claim.id);
    const first = scrubClaim(claim, { patient, coverage, authRequiredCpts: contract?.requiresAuth, authOnFile: !!claim.priorAuthNumber, priorClaimsSameDos: others });
    await ctx.store.recordScrub(ctx.tenantId, first.clean);
    const fixed = applyAutoFixes(claim, first.edits);
    const second = scrubClaim(fixed.claim, { patient, coverage, authRequiredCpts: contract?.requiresAuth, authOnFile: !!fixed.claim.priorAuthNumber, priorClaimsSameDos: others });
    let next = claim.status === "draft" ? transitionClaim(fixed.claim, "scrubbed", ctx.actor, `score ${second.score}`) : fixed.claim;
    if (second.clean && next.status === "scrubbed") next = transitionClaim(next, "ready", ctx.actor, "clean");
    await ctx.store.upsertClaim(ctx.tenantId, next);
    if (!second.clean) await ctx.store.addWorkItems(ctx.tenantId, itemsFromScrub(next, second.errors.length));
    return { clean: second.clean, score: second.score, autoFixed: fixed.applied, errors: second.errors.map((e) => e.id) };
  },
};
const submitClaim: Tool<{ claimId: string; amount: number }, unknown> = {
  name: "submit-claim",
  description: "Submit a ready claim to the clearinghouse (837P)",
  requiresApproval: true,
  approvalReason: "payer-facing submission",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    await ctx.store.upsertClaim(ctx.tenantId, transitionClaim(claim, "submitted", ctx.actor, "837P sent (stub clearinghouse)"));
    return { submitted: claim.id };
  },
};
const scrubberAgent: AgentDefinition = {
  name: "claim-scrubber",
  description: "Scrubs every draft claim, applies safe auto-fixes, stages clean claims for submission (submission itself requires approval).",
  tools: [scrubAndFix, submitClaim],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    for (const c of await ctx.store.listClaims(ctx.tenantId, { status: "draft" })) steps.push({ tool: "scrub-claim", input: { claimId: c.id }, why: "draft claim" });
    for (const c of await ctx.store.listClaims(ctx.tenantId, { status: "ready" })) steps.push({ tool: "submit-claim", input: { claimId: c.id, patientId: c.patientId, amount: c.totalCharge }, why: `clean claim $${c.totalCharge.toFixed(2)} to ${c.payerName}` });
    return steps;
  },
  summarize: (s) => `Scrubber: ${s.filter((x) => x.tool === "scrub-claim" && x.outcome === "ok").length} scrubbed, ${s.filter((x) => x.tool === "scrub-claim" && (x.output as { clean?: boolean })?.clean).length} clean, ${s.filter((x) => x.outcome === "needs-approval").length} submissions awaiting approval.`,
};

// ---------- Claim follow-up agent ----------
const checkStatus: Tool<{ claimId: string }, unknown> = {
  name: "check-claim-status",
  description: "Query 276/277 status (stub) and open follow-up work",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const rows = claimsNeedingFollowUp([claim], todayIso());
    if (rows.length) {
      const existing = await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "claim-followup" && w.claimId === claim.id);
      if (!existing) await ctx.store.addWorkItems(ctx.tenantId, itemsFromClaimFollowUp(rows));
    }
    return { claimId: claim.id, status: claim.status, followUp: rows[0]?.reason ?? null };
  },
};
const followUpAgent: AgentDefinition = {
  name: "claim-followup",
  description: "Finds submitted claims with no adjudication after 30 days or near timely-filing, checks status, and queues payer follow-up (with a call script).",
  tools: [checkStatus],
  async plan(ctx) {
    const rows = claimsNeedingFollowUp(await ctx.store.listClaims(ctx.tenantId), todayIso());
    return rows.map((r) => ({ tool: "check-claim-status", input: { claimId: r.claim.id }, why: r.reason }));
  },
  summarize: (s) => `Follow-up: ${s.length} stale claims reviewed, ${s.filter((x) => (x.output as { followUp?: string | null })?.followUp).length} queued for payer contact.`,
};

// ---------- Denial agent ----------
const triageDenial: Tool<{ denialId: string }, unknown> = {
  name: "triage-denial",
  description: "Root-cause a denial, recommend action, draft appeal text where appealable",
  async run(input, ctx) {
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (!d) throw new Error("denial not found");
    const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
    const rec = recommendAction(d);
    let appealDraft: string | undefined;
    if (claim && rec.action === "appeal") {
      const patient = await ctx.store.getPatient(ctx.tenantId, d.patientId);
      const base = generateAppealLetter({ denial: d, claim, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", providerName: claim.renderingProviderName ?? "Rendering Provider", practiceName: "World EHR Outpatient" });
      const polished = await aiText("You polish payer appeal letters. Keep every fact, code, date, and amount exactly as given; improve clarity and persuasiveness only. Return the letter text.", base.letter, base.letter, "rcm-appeal");
      appealDraft = polished.text;
    }
    const updated: Denial = { ...d, status: "in-progress" };
    await ctx.store.upsertDenial(ctx.tenantId, updated);
    return { denialId: d.id, recommendation: rec, appealDraft };
  },
};
const fileCorrectedClaim: Tool<{ claimId: string; denialId: string; amount: number }, unknown> = {
  name: "file-corrected-claim",
  description: "Create a frequency-7 replacement claim for a remediable denial",
  requiresApproval: true,
  approvalReason: "resubmission to payer",
  async run(input, ctx) {
    const orig = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!orig) throw new Error("claim not found");
    const next = correctedClaim(orig, {});
    await ctx.store.upsertClaim(ctx.tenantId, next);
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (d) await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "appealed" });
    return { correctedClaimId: next.id };
  },
};
const sendAppeal: Tool<{ denialId: string; claimId: string; amount: number }, unknown> = {
  name: "send-appeal",
  description: "Send the appeal packet to the payer",
  requiresApproval: true,
  approvalReason: "payer-facing appeal",
  async run(input, ctx) {
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (!d) throw new Error("denial not found");
    await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "appealed" });
    const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
    if (claim && ["denied", "partially-paid", "paid"].includes(claim.status)) await ctx.store.upsertClaim(ctx.tenantId, transitionClaim(claim, "appealed", ctx.actor));
    return { appealed: d.id };
  },
};
const writeOffDenial: Tool<{ denialId: string; patientId: string; amount: number; reason: string }, unknown> = {
  name: "write-off",
  description: "Post a denial write-off to the ledger",
  requiresApproval: true,
  approvalReason: "adjustment reduces receivable",
  async run(input, ctx) {
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (!d) throw new Error("denial not found");
    const e: LedgerEntry = { id: newId("led"), patientId: d.patientId, claimId: d.claimId, type: "denial-adjustment", amount: d.amount, date: todayIso(), memo: `Write-off CARC ${d.carc}: ${input.reason}`, responsibleParty: "insurance" };
    await ctx.store.postLedger(ctx.tenantId, [e]);
    await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "written-off" });
    return { writtenOff: d.amount };
  },
};
const transferToPatient: Tool<{ denialId: string; patientId: string; amount: number }, unknown> = {
  name: "transfer-to-patient",
  description: "Move a PR-group amount to patient responsibility",
  async run(input, ctx) {
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (!d) throw new Error("denial not found");
    await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: d.patientId, claimId: d.claimId, type: "transfer-to-patient", amount: d.amount, date: todayIso(), memo: `CARC ${d.carc} patient responsibility`, responsibleParty: "patient" }]);
    await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "written-off" });
    return { transferred: d.amount };
  },
};
const denialAgent: AgentDefinition = {
  name: "denials",
  description: "Triages every open denial by dollars × remediability × deadline, drafts appeals, and stages corrected claims / write-offs for approval.",
  tools: [triageDenial, fileCorrectedClaim, sendAppeal, writeOffDenial, transferToPatient],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const open = (await ctx.store.listDenials(ctx.tenantId, "open")).sort((a, b) => b.priorityScore - a.priorityScore);
    await ctx.store.addWorkItems(ctx.tenantId, itemsFromDenials(open.filter((d) => d.priorityScore >= 60)));
    for (const d of open) {
      steps.push({ tool: "triage-denial", input: { denialId: d.id }, why: `${d.category} CARC ${d.carc}` });
      const rec = recommendAction(d);
      const base = { denialId: d.id, claimId: d.claimId, patientId: d.patientId, amount: d.amount };
      if (rec.action === "corrected-claim") steps.push({ tool: "file-corrected-claim", input: base, why: rec.reason });
      else if (rec.action === "appeal") steps.push({ tool: "send-appeal", input: base, why: rec.reason });
      else if (rec.action === "write-off") steps.push({ tool: "write-off", input: { ...base, reason: rec.reason }, why: rec.reason });
      else if (rec.action === "bill-patient") steps.push({ tool: "transfer-to-patient", input: base, why: rec.reason });
    }
    return steps;
  },
  summarize: (s) => `Denials: ${s.filter((x) => x.tool === "triage-denial").length} triaged, ${s.filter((x) => x.outcome === "needs-approval").length} actions awaiting approval, ${s.filter((x) => x.tool === "transfer-to-patient" && x.outcome === "ok").length} moved to patient responsibility.`,
};

// ---------- Patient financial agent ----------
const sendStatement: Tool<{ patientId: string; cycle: 1 | 2 | 3 | "final" }, unknown> = {
  name: "send-statement",
  description: "Generate and deliver a patient statement via the propensity-recommended channel",
  async run(input, ctx) {
    const p = await ctx.store.getPatient(ctx.tenantId, input.patientId);
    if (!p) throw new Error("patient not found");
    const stmt = buildStatement(p, await ctx.store.ledger(ctx.tenantId, p.id), input.cycle);
    const ptp = propensityToPay({ balance: stmt.amountDue, priorStatementsPaidOnTime: 0, priorStatementsLate: 0, hasCardOnFile: false });
    return { amountDue: stmt.amountDue, channel: ptp.recommendedChannel, cycle: stmt.cycle };
  },
};
const offerPlan: Tool<{ patientId: string; amount: number; months: number }, unknown> = {
  name: "offer-payment-plan",
  description: "Create a payment plan offer",
  async run(input) { const plan = createPaymentPlan(input.patientId, input.amount, input.months); return { planId: plan.id, installment: plan.installment, months: plan.months }; },
};
const referToAgency: Tool<{ patientId: string; amount: number }, unknown> = {
  name: "refer-to-agency",
  description: "Refer a 120+ day balance to collections",
  requiresApproval: true,
  approvalReason: "external collections referral",
  async run(input, ctx) { await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "patient-balance", title: `Agency referral executed $${input.amount.toFixed(2)}`, patientId: input.patientId, amount: input.amount, priority: 30, source: "agent" })]); return { referred: input.amount }; },
};
const issueRefund: Tool<{ patientId: string; amount: number; refundTo: string }, unknown> = {
  name: "issue-refund",
  description: "Refund a credit balance",
  requiresApproval: true,
  approvalReason: "money leaves the practice",
  async run(input, ctx) { await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: input.patientId, type: "refund", amount: input.amount, date: todayIso(), memo: `Refund to ${input.refundTo}`, responsibleParty: input.refundTo === "payer" ? "insurance" : "patient" }]); return { refunded: input.amount }; },
};
const smallBalanceWriteOff: Tool<{ patientId: string; amount: number }, unknown> = {
  name: "small-balance-write-off",
  description: "Write off balances under the policy threshold",
  async run(input, ctx) { await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: input.patientId, type: "write-off", amount: input.amount, date: todayIso(), memo: "Small-balance policy write-off", responsibleParty: "patient" }]); return { writtenOff: input.amount }; },
};
const patientFinancialAgent: AgentDefinition = {
  name: "patient-financial",
  description: "Runs the patient A/R cycle: statements by propensity channel, payment-plan offers, small-balance write-offs, credit-balance refunds and agency referrals (both approval-gated).",
  tools: [sendStatement, offerPlan, referToAgency, issueRefund, smallBalanceWriteOff],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const byPatient = await ctx.store.ledgerByPatient(ctx.tenantId);
    for (const w of smallBalanceWriteOffs(byPatient)) steps.push({ tool: "small-balance-write-off", input: w, why: "below $5 policy threshold" });
    for (const c of detectCreditBalances(byPatient)) steps.push({ tool: "issue-refund", input: { patientId: c.patientId, amount: c.amount, refundTo: c.refundTo }, why: `${c.source} credit balance` });
    for (const [patientId, entries] of Object.entries(byPatient)) {
      const p = await ctx.store.getPatient(ctx.tenantId, patientId);
      if (!p) continue;
      const stmt = buildStatement(p, entries);
      if (stmt.amountDue <= 5) continue;
      const firstTransfer = entries.filter((e) => e.type === "transfer-to-patient").sort((a, b) => a.date.localeCompare(b.date))[0];
      const stage = collectionsStage(firstTransfer?.date ?? todayIso());
      if (stage.stage === "agency-referral") steps.push({ tool: "refer-to-agency", input: { patientId, amount: stmt.amountDue }, why: stage.reason });
      else if (stage.stage !== "hold") {
        const cycle: 1 | 2 | 3 | "final" = stage.stage === "statement-1" ? 1 : stage.stage === "statement-2" ? 2 : stage.stage === "statement-3" ? 3 : "final";
        steps.push({ tool: "send-statement", input: { patientId, cycle }, why: stage.reason });
        if (stmt.amountDue >= 200) steps.push({ tool: "offer-payment-plan", input: { patientId, amount: stmt.amountDue, months: Math.min(12, Math.ceil(stmt.amountDue / 50)) }, why: "balance ≥ $200" });
      }
    }
    return steps;
  },
  summarize: (s) => `Patient financial: ${s.filter((x) => x.tool === "send-statement" && x.outcome === "ok").length} statements, ${s.filter((x) => x.tool === "offer-payment-plan" && x.outcome === "ok").length} plan offers, ${s.filter((x) => x.outcome === "needs-approval").length} refunds/referrals awaiting approval.`,
};

// ---------- Payer call (voice) agent ----------
const prepareCall: Tool<{ claimId: string }, unknown> = {
  name: "prepare-payer-call",
  description: "Build an IVR-ready call script + expected answers for a claim follow-up call",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const coverage = await ctx.store.getCoverage(ctx.tenantId, claim.coverageId);
    const patient = await ctx.store.getPatient(ctx.tenantId, claim.patientId);
    return buildPayerCallScript(claim, coverage, patient);
  },
};
const payerCallAgent: AgentDefinition = {
  name: "payer-call",
  description: "Prepares voice-agent call scripts (IVR navigation, verification, questions, disposition capture) for every claim in the follow-up queue.",
  tools: [prepareCall],
  async plan(ctx) {
    const items = (await ctx.store.listWorkItems(ctx.tenantId, "claim-followup")).filter((w) => w.status === "open" && w.claimId);
    return items.map((w) => ({ tool: "prepare-payer-call", input: { claimId: w.claimId! }, why: w.title }));
  },
  summarize: (s) => `Payer call: ${s.filter((x) => x.outcome === "ok").length} call scripts prepared.`,
};

// ---------- Orchestrator (nightly cycle) ----------
const runAgent: Tool<{ agent: string }, unknown> = {
  name: "run-agent",
  description: "Run a child agent",
  async run(input, ctx) { const r = await agentRuntime.run(input.agent, ctx.tenantId, {}, { actor: ctx.actor, dryRun: ctx.dryRun }); return { summary: r.summary, approvals: r.approvalsRequested }; },
};
const snapshotKpis: Tool<Record<string, never>, unknown> = {
  name: "snapshot-kpis",
  description: "Compute KPIs and flag critical ones as work",
  async run(_i, ctx) {
    const stats = await ctx.store.scrubStats(ctx.tenantId);
    const kpis = computeKpis({ claims: await ctx.store.listClaims(ctx.tenantId), denials: await ctx.store.listDenials(ctx.tenantId), ledger: await ctx.store.ledger(ctx.tenantId), remittances: await ctx.store.listRemittances(ctx.tenantId), scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean, chargeEntryLagDays: await ctx.store.chargeLagSamples(ctx.tenantId) });
    const critical = kpis.filter((k) => k.status === "critical");
    return { critical: critical.map((k) => k.key), kpis: kpis.map((k) => ({ key: k.key, value: k.value, status: k.status })) };
  },
};
const orchestrator: AgentDefinition = {
  name: "rcm-orchestrator",
  description: "Nightly revenue-cycle run: eligibility → prior-auth → scrubber → follow-up → denials → patient financial → payer-call → KPI snapshot.",
  tools: [runAgent, snapshotKpis],
  async plan() { return [...["eligibility", "prior-auth", "claim-scrubber", "claim-followup", "denials", "patient-financial", "payer-call"].map((agent) => ({ tool: "run-agent", input: { agent }, why: "nightly cycle" })), { tool: "snapshot-kpis", input: {}, why: "end-of-cycle metrics" }]; },
  summarize: (s) => s.filter((x) => x.tool === "run-agent" && x.outcome === "ok").map((x) => (x.output as { summary: string }).summary).join(" "),
};

export function registerRcmAgents(): void {
  for (const a of [eligibilityAgent, priorAuthAgent, scrubberAgent, followUpAgent, denialAgent, patientFinancialAgent, payerCallAgent, orchestrator]) agentRuntime.register(a);
}
registerRcmAgents();

export { agentRuntime };
export type { ToolContext, Claim };
