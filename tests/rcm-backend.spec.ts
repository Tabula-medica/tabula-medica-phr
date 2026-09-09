// RCM back-end: claims lifecycle, ERA posting, denials, patient financials, contracts, analytics, worklists, voice, agents.
import { describe, it, expect, beforeEach } from "vitest";
import { buildClaim, canTransition, claimTo837P, claimToCms1500Boxes, claimsNeedingFollowUp, correctedClaim, mapStatusCategory, secondaryClaim, transitionClaim } from "../server/rcm/claims";
import { parseEra, postRemittance, claimStatusFromPosting } from "../server/rcm/remittance";
import { analyzeDenial, denialFromAdjustment, denialPriority, denialTrends, generateAppealLetter, recommendAction } from "../server/rcm/denials";
import { buildStatement, collectionsStage, computeAccount, computeAging, createPaymentPlan, detectCreditBalances, fplPercent, goodFaithEstimate, propensityToPay, slidingFeeDiscount, smallBalanceWriteOffs } from "../server/rcm/patient-financials";
import { DEFAULT_CONTRACTS, expectedAllowed, expectedForLines, modelContractChange, varianceReport } from "../server/rcm/contracts";
import { agingByPayer, computeKpis } from "../server/rcm/analytics";
import { itemsFromDenials, queueSummary, sortQueue } from "../server/rcm/worklists";
import { parseVoiceIntent, speakIntent, speakKpis } from "../server/rcm/voice";
import { applyDisposition, buildPayerCallScript } from "../server/rcm/agents/payer-call";
import { agentRuntime } from "../server/rcm/agents";
import { rcmStore } from "../server/rcm/store";
import { seedDemoTenant } from "../server/rcm/demo-seed";
import type { Coverage, LedgerEntry, Patient } from "../server/rcm/types";

const patient: Patient = { id: "p1", firstName: "Asha", lastName: "Demo", dob: "1968-03-14", sex: "F" };
const coverage: Coverage = { id: "c1", patientId: "p1", payerId: "BCBS", payerName: "BCBS PPO", memberId: "XYZ123", priority: "primary", subscriberRelationship: "self", timelyFilingDays: 90 };
const bcbs = DEFAULT_CONTRACTS.find((c) => c.payerId === "BCBS")!;
const mkClaim = () => buildClaim({ encounterId: "e", patient, coverage, billingNpi: "1234567893", billingTaxId: "12-3456789", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "99214", modifiers: ["25"], units: 1, charge: 300, dxPointers: [1], dateOfService: "2026-07-01", placeOfService: "11" }, { cpt: "20610", modifiers: [], units: 1, charge: 150, dxPointers: [1], dateOfService: "2026-07-01", placeOfService: "11" }] });

describe("claims", () => {
  it("builds with totals + timely-filing deadline and maps to 837P/CMS-1500", () => {
    const c = mkClaim();
    expect(c.totalCharge).toBe(450);
    expect(c.timelyFilingDeadline).toBe("2026-09-29");
    const x = claimTo837P(c, patient, coverage);
    expect(x.claim.diagnoses[0]).toEqual({ qualifier: "ABK", code: "M1711" });
    expect(x.claim.subscriber.relationshipCode).toBe("18");
    const boxes = claimToCms1500Boxes(c, patient, coverage);
    expect(boxes["24D-1"]).toBe("99214 25");
    expect(boxes["24E-2"]).toBe("A");
    expect(boxes["28"]).toBe("450.00");
  });
  it("enforces the lifecycle state machine", () => {
    let c = mkClaim();
    expect(canTransition("draft", "submitted")).toBe(false);
    c = transitionClaim(transitionClaim(transitionClaim(c, "scrubbed", "t"), "ready", "t"), "submitted", "t");
    expect(c.submittedAt).toBeDefined();
    expect(() => transitionClaim(c, "draft", "t")).toThrow();
    expect(mapStatusCategory("A1")).toBe("acknowledged");
    expect(mapStatusCategory("F2")).toBe("denied");
    expect(mapStatusCategory("P1")).toBe("pended");
  });
  it("creates corrected (freq 7) and secondary (COB) claims", () => {
    const c = mkClaim();
    const corr = correctedClaim(c, { lines: c.lines.slice(0, 1) });
    expect(corr).toMatchObject({ frequencyCode: "7", originalClaimId: c.id, totalCharge: 300, status: "draft" });
    const sec = secondaryClaim(c, { ...coverage, id: "c2", payerId: "AETNA", payerName: "Aetna", priority: "secondary", timelyFilingDays: 120 }, { billed: 450, paid: 200, patientResp: 50, lines: [] });
    expect(sec).toMatchObject({ payerId: "AETNA", cobPrimaryPaid: 200, timelyFilingDeadline: "2026-10-29" });
  });
  it("flags stale submitted claims for follow-up", () => {
    let c = transitionClaim(transitionClaim(transitionClaim(mkClaim(), "scrubbed", "t"), "ready", "t"), "submitted", "t");
    c = { ...c, submittedAt: "2026-07-05T00:00:00.000Z" };
    const rows = claimsNeedingFollowUp([c], "2026-08-20");
    expect(rows).toHaveLength(1);
    expect(rows[0].daysOutstanding).toBe(46);
  });
});

describe("remittance posting", () => {
  it("parses vendor ERA JSON, posts payments/adjustments, detects denials and underpayments", () => {
    const c = mkClaim();
    const rem = parseEra({ eraid: "E1", payerid: "BCBS", payer_name: "BCBS PPO", check_number: "CHK1", check_amount: "180.00", check_date: "2026-08-01", payment_method: "ACH", claims: [{ pcn: c.id, status: "1", billed: 450, allowed: 210, paid: 180, patient_resp: 30, lines: [{ proc: "HC:99214", billed: 300, allowed: 150, paid: 120, patient_resp: 30, adjustments: [{ group: "CO", carc: "45", amount: 150 }] }, { proc: "20610", billed: 150, allowed: 60, paid: 60, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: 60 }, { group: "CO", carc: "97", amount: 30 }] }] }] });
    expect(rem.method).toBe("ACH");
    expect(rem.claims[0].lines[0].cpt).toBe("99214");
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.balanced).toBe(true);
    const p = r.postings[0];
    expect(p.status).toBe("partial");
    expect(p.contractual).toBe(210);
    expect(p.denied).toBe(30);
    expect(p.denials[0].carc).toBe("97");
    expect(p.entries.map((e) => e.type)).toEqual(expect.arrayContaining(["insurance-payment", "contractual-adjustment", "transfer-to-patient"]));
    expect(p.underpayment).toBeDefined(); // BCBS at 135% of Medicare: 99214 ≈ 172.8 + 20610 ≈ 97.2 = 270 expected vs 210 allowed
    expect(p.underpayment!.variance).toBeGreaterThan(50);
    expect(claimStatusFromPosting(p)).toBe("partially-paid");
  });
  it("handles reversals and unapplied cash", () => {
    const rem = parseEra({ check_amount: 100, claims: [{ pcn: "x", status: "22", billed: 100, paid: -50, patient_resp: 0 }] });
    const r = postRemittance(rem, {});
    expect(r.postings[0].status).toBe("reversal");
    expect(r.postings[0].entries[0].type).toBe("refund");
    expect(r.unapplied).toBe(150);
    expect(r.balanced).toBe(false);
  });
});

describe("denials", () => {
  it("maps CARC/RARC to category, prevention rules and priority", () => {
    const info = analyzeDenial("197", "N54");
    expect(info.category).toBe("auth-missing");
    expect(info.preventionRuleIds).toContain("auth-missing");
    expect(info.rarcHint).toMatch(/authorized/i);
    expect(analyzeDenial("CO-45").category).toBe("fee-schedule");
    expect(analyzeDenial("9999").category).toBe("other");
    expect(denialPriority(5000, true, "2026-09-10", "2026-09-05")).toBeGreaterThan(denialPriority(20, false, undefined));
  });
  it("recommends the right action and writes a fact-only appeal letter", () => {
    const c = mkClaim();
    const d50 = denialFromAdjustment(c, { group: "CO", carc: "50", amount: 300 }, { appealDays: 180, receivedAt: "2026-08-01T00:00:00Z" });
    expect(d50.appealDeadline).toBe("2027-01-28");
    expect(recommendAction(d50).action).toBe("appeal");
    expect(recommendAction(denialFromAdjustment(c, { group: "PR", carc: "1", amount: 100 })).action).toBe("bill-patient");
    expect(recommendAction(denialFromAdjustment(c, { group: "CO", carc: "29", amount: 100 })).action).toBe("write-off");
    expect(recommendAction(denialFromAdjustment(c, { group: "CO", carc: "4", amount: 100 })).action).toBe("corrected-claim");
    expect(recommendAction(denialFromAdjustment(c, { group: "CO", carc: "50", amount: 3 })).action).toBe("write-off");
    const letter = generateAppealLetter({ denial: d50, claim: c, patientName: "Asha Demo", providerName: "Dr. D", practiceName: "World EHR" });
    expect(letter.letter).toContain("CARC 50");
    expect(letter.letter).toContain("$300.00");
    expect(letter.letter).toContain("M17.11");
    expect(letter.level).toBe("formal-appeal");
    const t = denialTrends([d50, denialFromAdjustment(c, { group: "CO", carc: "197", amount: 900 })]);
    expect(t.preventable.count).toBe(2);
    expect(t.topPreventionRules[0].ruleId).toBeDefined();
  });
});

describe("patient financials", () => {
  const led: LedgerEntry[] = [
    { id: "1", patientId: "p1", type: "charge", amount: 500, date: "2026-03-01", responsibleParty: "insurance" },
    { id: "2", patientId: "p1", type: "insurance-payment", amount: 300, date: "2026-04-01", responsibleParty: "insurance" },
    { id: "3", patientId: "p1", type: "contractual-adjustment", amount: 100, date: "2026-04-01", responsibleParty: "insurance" },
    { id: "4", patientId: "p1", type: "transfer-to-patient", amount: 100, date: "2026-04-01", responsibleParty: "patient" },
    { id: "5", patientId: "p1", type: "patient-payment", amount: 40, date: "2026-05-01", responsibleParty: "patient" },
    { id: "6", patientId: "p1", type: "charge", amount: 200, date: "2026-08-20", responsibleParty: "insurance" },
  ];
  it("computes account, FIFO aging and statements", () => {
    const s = computeAccount("p1", led);
    expect(s.balance).toBe(260);
    expect(s.patientBalance).toBe(60);
    const a = computeAging(led, "2026-09-05");
    expect(a.total).toBe(260);
    expect(a.over120).toBe(60);
    expect(a.current).toBe(200);
    const st = buildStatement(patient, led, 2, "2026-09-05");
    expect(st.amountDue).toBe(60);
    expect(st.dueDate).toBe("2026-10-05");
    expect(st.message).toMatch(/past due/);
  });
  it("propensity, plans, collections, FPL and GFE", () => {
    expect(propensityToPay({ balance: 50, priorStatementsPaidOnTime: 3, priorStatementsLate: 0, hasCardOnFile: true }).band).toBe("high");
    expect(propensityToPay({ balance: 50, priorStatementsPaidOnTime: 0, priorStatementsLate: 0, hasCardOnFile: false, fplPct: 150 }).band).toBe("assistance-eligible");
    const plan = createPaymentPlan("p1", 100, 6, "2026-09-01");
    expect(plan.months).toBe(4);
    expect(plan.schedule.reduce((s, x) => s + x.amount, 0)).toBe(100);
    expect(collectionsStage("2026-03-01", { today: "2026-09-05" }).stage).toBe("agency-referral");
    expect(collectionsStage("2026-03-01", { today: "2026-09-05", onPaymentPlan: true }).stage).toBe("hold");
    expect(fplPercent(31920, 1)).toBe(200);
    expect(slidingFeeDiscount(120).discountPct).toBe(80);
    const gfe = goodFaithEstimate(patient, [{ cpt: "99203", units: 1 }, { cpt: "80053", units: 1 }], { "99203": 150 }, "2026-09-20", "2026-09-05");
    expect(gfe.total).toBe(160.5);
    expect(gfe.deliverBy).toBe("2026-09-17");
    expect(gfe.disclaimers.length).toBeGreaterThan(1);
  });
  it("detects credit balances and small balances", () => {
    const credit = detectCreditBalances({ p2: [{ id: "a", patientId: "p2", type: "charge", amount: 50, date: "2026-08-01", responsibleParty: "patient" }, { id: "b", patientId: "p2", type: "patient-payment", amount: 80, date: "2026-08-02", responsibleParty: "patient" }] });
    expect(credit[0]).toMatchObject({ amount: 30, refundTo: "patient", requiresApproval: true });
    expect(smallBalanceWriteOffs({ p3: [{ id: "a", patientId: "p3", type: "charge", amount: 4, date: "2026-08-01", responsibleParty: "patient" }, { id: "b", patientId: "p3", type: "transfer-to-patient", amount: 4, date: "2026-08-01", responsibleParty: "patient" }] })).toEqual([{ patientId: "p3", amount: 4 }]);
  });
});

describe("contracts + analytics + worklists", () => {
  it("expected allowed uses % of Medicare, modifiers and multiple-procedure reduction", () => {
    expect(expectedAllowed(bcbs, "99213")).toBe(121.5);
    expect(expectedAllowed(bcbs, "20610", 1, ["50"])).toBe(145.8);
    expect(expectedForLines(bcbs, [{ cpt: "12002", units: 1, modifiers: [] }, { cpt: "12001", units: 1, modifiers: ["59"] }])).toBe(303.75); // 216 + 175.5*0.5
    const v = varianceReport(bcbs, [{ cpt: "99213", units: 1, modifiers: [], allowed: 100 }]);
    expect(v.underpaid).toBe(true);
    expect(v.totalVariance).toBe(21.5);
    expect(modelContractChange(bcbs, [{ cpt: "99213", units: 100 }], { pctChange: 10 }).deltaPct).toBe(10);
  });
  it("computes KPIs with targets and status", () => {
    const c = mkClaim();
    const kpis = computeKpis({ claims: [c], denials: [], ledger: [{ id: "1", patientId: "p1", type: "charge", amount: 9000, date: "2026-06-01", responsibleParty: "insurance" }, { id: "2", patientId: "p1", type: "insurance-payment", amount: 5000, date: "2026-07-01", responsibleParty: "insurance" }], remittances: [], today: "2026-09-05", periodDays: 90, scrubTotal: 10, scrubFirstPassClean: 9 });
    const k = Object.fromEntries(kpis.map((x) => [x.key, x]));
    expect(k.days_in_ar.value).toBe(40);
    expect(k.days_in_ar.status).toBe("warning");
    expect(k.clean_claim_rate.value).toBe(90);
    expect(k.gross_collection_rate.value).toBeCloseTo(55.56, 1);
    expect(agingByPayer([transitionClaim(transitionClaim(transitionClaim(c, "scrubbed", "t"), "ready", "t"), "submitted", "t")])[0].payerId).toBe("BCBS");
  });
  it("prioritizes and summarizes the queue", () => {
    const c = mkClaim();
    const items = itemsFromDenials([denialFromAdjustment(c, { group: "CO", carc: "50", amount: 3000 }), denialFromAdjustment(c, { group: "CO", carc: "18", amount: 10 })]);
    const sorted = sortQueue(items);
    expect(sorted[0].amount).toBe(3000);
    expect(queueSummary(items).denials).toMatchObject({ open: 2, amount: 3010 });
  });
});

describe("voice", () => {
  it("parses billing intents", () => {
    expect(parseVoiceIntent("Add 99214 with modifier 25 diagnosis E11 point 9").type).toBe("charge-capture");
    expect(parseVoiceIntent("open the denials queue")).toEqual({ type: "open-queue", queue: "denials" });
    expect(parseVoiceIntent("check eligibility for Asha Demo")).toMatchObject({ type: "check-eligibility", patientRef: "asha demo" });
    expect(parseVoiceIntent("start a prior auth for 72148")).toMatchObject({ type: "start-prior-auth", cpt: "72148" });
    expect(parseVoiceIntent("level this visit, 35 minutes established")).toMatchObject({ type: "level-visit", timeMinutes: 35, newPatient: false });
    expect(parseVoiceIntent("set up a payment plan over six months for $300")).toMatchObject({ type: "payment-plan", months: 6, amount: 300 });
    expect(parseVoiceIntent("what are our days in AR")).toMatchObject({ type: "kpi-readout", kpi: "days_in_ar" });
    expect(parseVoiceIntent("run the denials agent")).toMatchObject({ type: "run-agent", agent: "denials" });
    expect(parseVoiceIntent("collect the 30 dollar copay")).toMatchObject({ type: "collect-copay", amount: 30 });
    expect(speakIntent(parseVoiceIntent("gibberish"))).toMatch(/did not catch/);
    expect(speakKpis([{ key: "denial_rate", name: "Initial denial rate", value: 4, unit: "pct", status: "good" }])).toBe("Initial denial rate is 4 percent.");
  });
  it("builds payer call scripts and maps dispositions", () => {
    const s = buildPayerCallScript(mkClaim(), coverage, patient);
    expect(s.ivrPath[3]).toContain("XYZ123");
    expect(s.dispositionSchema.find((d) => d.key === "status")?.options).toContain("denied");
    expect(applyDisposition(mkClaim(), { status: "not-on-file" })).toBe("draft");
    expect(applyDisposition(mkClaim(), { statusCategoryCode: "F2" })).toBe("denied");
  });
});

describe("agents", () => {
  const T = "t-agents";
  beforeEach(async () => { rcmStore.reset(T); await seedDemoTenant(rcmStore, T); });
  it("lists agents with approval-gated tools", () => {
    const list = agentRuntime.list();
    expect(list.map((a) => a.name)).toEqual(expect.arrayContaining(["eligibility", "prior-auth", "claim-scrubber", "claim-followup", "denials", "patient-financial", "payer-call", "rcm-orchestrator"]));
    expect(list.find((a) => a.name === "denials")!.tools.find((t) => t.name === "send-appeal")!.requiresApproval).toBe(true);
  });
  it("scrubber auto-fixes -25, stages the claim, and queues submission for approval", async () => {
    const r = await agentRuntime.run("claim-scrubber", T);
    const scrub = r.steps.find((s) => s.tool === "scrub-claim")!;
    expect((scrub.output as { autoFixed: string[] }).autoFixed).toContain("missing-em-25-modifier");
    expect((scrub.output as { clean: boolean }).clean).toBe(true);
    const ready = await rcmStore.listClaims(T, { status: "ready" });
    expect(ready).toHaveLength(1);
    // second run: ready claim → submission requires approval
    const r2 = await agentRuntime.run("claim-scrubber", T);
    expect(r2.approvalsRequested).toBe(1);
    const pending = await rcmStore.listApprovals(T, "pending");
    expect(pending[0].action).toBe("submit-claim");
    const wi = (await rcmStore.listWorkItems(T, "agent-approval"));
    expect(wi.length).toBeGreaterThan(0);
    await rcmStore.decideApproval(T, pending[0].id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending[0].id, "biller");
    expect(exec.ok).toBe(true);
    expect(await rcmStore.listClaims(T, { status: "submitted" })).toHaveLength(2);
  });
  it("denial agent triages, never executes money-moving steps without approval, and moves PR to patient", async () => {
    const r = await agentRuntime.run("denials", T);
    expect(r.steps.filter((s) => s.tool === "triage-denial" && s.outcome === "ok")).toHaveLength(3);
    expect(r.steps.filter((s) => s.outcome === "needs-approval").length).toBeGreaterThanOrEqual(2);
    const audit = await rcmStore.listAudit(T);
    expect(audit.some((a) => a.outcome === "needs-approval")).toBe(true);
    expect(JSON.stringify(audit)).not.toMatch(/Asha|Miguel|Priya|Dana/);
  });
  it("orchestrator runs the whole cycle in dry-run without side effects", async () => {
    const before = (await rcmStore.listClaims(T)).map((c) => c.status);
    const r = await agentRuntime.run("rcm-orchestrator", T, {}, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.steps.filter((s) => s.outcome === "ok")).toHaveLength(8);
    expect((await rcmStore.listClaims(T)).map((c) => c.status)).toEqual(before);
  });
  it("patient-financial agent finds the duplicate payment credit and queues a refund approval", async () => {
    const r = await agentRuntime.run("patient-financial", T);
    const refund = r.steps.find((s) => s.tool === "issue-refund");
    expect(refund?.outcome).toBe("needs-approval");
    expect(refund?.input.patientId).toBe("pt-demo-4");
    expect(refund?.input.amount).toBe(150);
  });
});
