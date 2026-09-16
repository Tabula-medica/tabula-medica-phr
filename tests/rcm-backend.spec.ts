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
import { authCoversService, authorizedCptsOnFile, createAuthRequest, transitionAuth } from "../server/rcm/prior-auth";
import { scrubClaim } from "../server/rcm/scrubber";
import { estimatePatientResponsibility } from "../server/rcm/eligibility";
import { parseCodingSuggestion } from "../server/rcm/coding";
import { agentRuntime } from "../server/rcm/agents";
import { rcmStore } from "../server/rcm/store";
import { seedDemoTenant } from "../server/rcm/demo-seed";
import type { BenefitSnapshot, Coverage, LedgerEntry, Patient } from "../server/rcm/types";

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
    expect(corr.diagnoses).toEqual(c.diagnoses); // an omitted patch key must not blank the original field
    const withUndefinedKeys = correctedClaim(c, { diagnoses: undefined, priorAuthNumber: undefined });
    expect(withUndefinedKeys.diagnoses).toEqual(c.diagnoses);
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
  it("never posts cash against an unmatched claim id, and leaves it unapplied", () => {
    const rem = parseEra({ check_amount: 100, claims: [{ pcn: "x", status: "22", billed: 100, paid: -50, patient_resp: 0 }] });
    const r = postRemittance(rem, {});
    expect(r.postings[0].status).toBe("unmatched");
    expect(r.postings[0].entries).toHaveLength(0);
    expect(r.unapplied).toBe(100); // none of the unmatched claim's cash counts as applied
    expect(r.balanced).toBe(false);
  });
  it("handles a reversal on a matched, already-paid claim and unwinds it to adjudicated", () => {
    const c = transitionClaim(transitionClaim(transitionClaim(mkClaim(), "scrubbed", "t"), "ready", "t"), "submitted", "t");
    const rem = parseEra({ check_amount: -50, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -50, patient_resp: 0 }] });
    const r = postRemittance(rem, { [c.id]: c });
    expect(r.postings[0].status).toBe("reversal");
    expect(r.postings[0].entries[0].type).toBe("refund");
    expect(r.balanced).toBe(true);
    const paid = transitionClaim(c, "paid", "era-post");
    expect(canTransition(paid.status, claimStatusFromPosting(r.postings[0]))).toBe(true);
    expect(transitionClaim(paid, claimStatusFromPosting(r.postings[0]), "era-post").status).toBe("adjudicated");
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
  it("a patient-side write-off actually zeroes the patient balance it covers", () => {
    const withWriteOff: LedgerEntry[] = [
      { id: "1", patientId: "p2", type: "charge", amount: 100, date: "2026-03-01", responsibleParty: "insurance" },
      { id: "2", patientId: "p2", type: "transfer-to-patient", amount: 4, date: "2026-04-01", responsibleParty: "patient" },
      { id: "3", patientId: "p2", type: "write-off", amount: 4, date: "2026-05-01", responsibleParty: "patient" },
    ];
    const s = computeAccount("p2", withWriteOff);
    expect(s.patientBalance).toBe(0); // the $4 copay was written off, not still outstanding
    expect(s.insuranceBalance).toBe(96); // the rest of the charge is still open on the insurance side
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
    expect(gfe.deliverBy).toBe("2026-09-09"); // 3 business days from the 2026-09-05 (Sat) request date
    expect(gfe.disclaimers.length).toBeGreaterThan(1);
  });
  it("flags a GFE line with no self-pay rate instead of silently pricing it at zero", () => {
    const gfe = goodFaithEstimate(patient, [{ cpt: "00000", units: 1 }], {}, undefined, "2026-09-05");
    expect(gfe.missingRateCpts).toContain("00000");
    expect(gfe.items[0].ratePending).toBe(true);
    expect(gfe.disclaimers.some((d) => d.includes("00000"))).toBe(true);
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
  it("prior-auth agent requests enough units for a multi-unit line", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = buildClaim({ encounterId: "e-pt", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 3, charge: 300, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim);
    const r = await agentRuntime.run("prior-auth", T);
    const opened = r.steps.find((s) => s.tool === "open-auth-request" && s.input.cpt === "97110")!;
    expect(opened.outcome).toBe("ok");
    const auth = await rcmStore.getAuth(T, (opened.output as { authId: string }).authId);
    expect(auth?.units).toBe(3); // not the createAuthRequest default of 1
  });
  it("prior-auth agent merges duplicate same-date lines but keeps different dates of service separate", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = buildClaim({
      encounterId: "e-pt2", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }],
      lines: [
        { cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" },
        { cpt: "97110", modifiers: [], units: 2, charge: 200, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, // same date -> merge
        { cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-10-15", placeOfService: "11" }, // different date -> separate request
      ],
    });
    await rcmStore.upsertClaim(T, claim);
    const r = await agentRuntime.run("prior-auth", T);
    const opens = r.steps.filter((s) => s.tool === "open-auth-request" && s.input.cpt === "97110");
    expect(opens).toHaveLength(2); // one per distinct date of service, not one per line
    expect(opens.map((s) => s.input.units).sort()).toEqual([1, 3]); // 2026-09-01's two lines merged (1+2); 2026-10-15 stayed separate
    const auths = await rcmStore.listAuths(T, "p1");
    expect(auths.filter((a) => a.cpt === "97110")).toHaveLength(2);
  });
  it("scrubber flags the missing -25 modifier for a human instead of auto-fixing it, and never stages an unclean claim for submission", async () => {
    const r = await agentRuntime.run("claim-scrubber", T);
    const scrub = r.steps.find((s) => s.tool === "scrub-claim")!;
    expect((scrub.output as { autoFixed: string[] }).autoFixed).not.toContain("missing-em-25-modifier");
    expect((scrub.output as { clean: boolean }).clean).toBe(false);
    expect(await rcmStore.listClaims(T, { status: "ready" })).toHaveLength(0);
    expect((await rcmStore.listWorkItems(T, "claim-edits")).length).toBeGreaterThan(0);
    // With no claim reaching "ready", a second run must not queue any submission for approval.
    const r2 = await agentRuntime.run("claim-scrubber", T);
    expect(r2.approvalsRequested).toBe(0);
  });
  it("stages an already-clean claim for submission and executes it once approved", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const ready = transitionClaim(transitionClaim(mkClaim(), "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    await agentRuntime.run("claim-scrubber", T);
    const pending = (await rcmStore.listApprovals(T, "pending")).find((a) => a.payload.claimId === ready.id)!;
    expect(pending?.action).toBe("submit-claim");
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(true);
    expect((await rcmStore.getClaim(T, ready.id))?.status).toBe("submitted");
  });
  it("a second decision on the same approval is a no-op and never re-executes the action", async () => {
    const r = await agentRuntime.run("patient-financial", T);
    const refundStep = r.steps.find((s) => s.tool === "issue-refund" && s.outcome === "needs-approval")!;
    const before = (await rcmStore.ledger(T, refundStep.input.patientId as string)).filter((e) => e.type === "refund").length;
    const first = await rcmStore.decideApproval(T, refundStep.approvalId!, "approved", "biller");
    expect(first).toBeDefined();
    const exec1 = await agentRuntime.executeApproved(T, refundStep.approvalId!, "biller");
    expect(exec1.ok).toBe(true);
    // Replaying the same decision (double-click, retry) must not create a second approval or
    // execute the refund twice.
    const second = await rcmStore.decideApproval(T, refundStep.approvalId!, "approved", "biller");
    expect(second).toBeUndefined();
    const exec2 = await agentRuntime.executeApproved(T, refundStep.approvalId!, "biller");
    expect(exec2.ok).toBe(false);
    const after = (await rcmStore.ledger(T, refundStep.input.patientId as string)).filter((e) => e.type === "refund").length;
    expect(after).toBe(before + 1);
  });
  it("a failed approval execution is retryable, not permanently locked out", async () => {
    const approval = await rcmStore.requestApproval(T, { agent: "denials", action: "write-off", payload: { denialId: "missing-denial", patientId: "pt-demo-1", amount: 10, reason: "test" }, reason: "test" });
    await rcmStore.decideApproval(T, approval.id, "approved", "biller");
    const exec1 = await agentRuntime.executeApproved(T, approval.id, "biller"); // tool throws: denial not found
    expect(exec1.ok).toBe(false);
    const afterFailure = (await rcmStore.listApprovals(T)).find((a) => a.id === approval.id)!;
    expect(afterFailure.status).toBe("approved");
    expect(afterFailure.executedAt).toBeUndefined(); // must stay retryable, not locked out by the failure
    await rcmStore.upsertDenial(T, { id: "missing-denial", claimId: "c1", patientId: "pt-demo-1", payerId: "BCBS", carc: "1", group: "PR", amount: 10, category: "other", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const exec2 = await agentRuntime.executeApproved(T, approval.id, "biller");
    expect(exec2.ok).toBe(true);
    expect((await rcmStore.listApprovals(T)).find((a) => a.id === approval.id)!.executedAt).toBeDefined();
  });
  it("denial agent triages and never executes any money-moving or patient-billing step without approval", async () => {
    const r = await agentRuntime.run("denials", T);
    expect(r.steps.filter((s) => s.tool === "triage-denial" && s.outcome === "ok")).toHaveLength(3);
    // write-off, send-appeal, file-corrected-claim, and transfer-to-patient all require approval —
    // triage-denial is the only step that should ever come back "ok" on its own.
    expect(r.steps.filter((s) => s.tool !== "triage-denial" && s.outcome === "ok")).toHaveLength(0);
    expect(r.steps.filter((s) => s.outcome === "needs-approval").length).toBeGreaterThanOrEqual(2);
    const audit = await rcmStore.listAudit(T);
    expect(audit.some((a) => a.outcome === "needs-approval")).toBe(true);
    expect(JSON.stringify(audit)).not.toMatch(/Asha|Miguel|Priya|Dana/);
  });
  it("dry run on an agent with approval-gated tools never creates approval rows or work items", async () => {
    const approvalsBefore = (await rcmStore.listApprovals(T)).length;
    const workItemsBefore = (await rcmStore.listWorkItems(T, "agent-approval")).length;
    // The denials agent also writes directly to the "denials" queue from inside plan() itself
    // (before the runtime's per-step dryRun branch even runs) — that write must be suppressed too.
    const denialQueueBefore = (await rcmStore.listWorkItems(T, "denials")).length;
    const r = await agentRuntime.run("denials", T, {}, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.steps.some((s) => s.outcome === "needs-approval")).toBe(true);
    expect(await rcmStore.listApprovals(T)).toHaveLength(approvalsBefore);
    expect(await rcmStore.listWorkItems(T, "agent-approval")).toHaveLength(workItemsBefore);
    expect(await rcmStore.listWorkItems(T, "denials")).toHaveLength(denialQueueBefore);
  });
  it("orchestrator runs the whole cycle in dry-run without side effects", async () => {
    const before = (await rcmStore.listClaims(T)).map((c) => c.status);
    const r = await agentRuntime.run("rcm-orchestrator", T, {}, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.steps.filter((s) => s.outcome === "ok")).toHaveLength(8);
    expect((await rcmStore.listClaims(T)).map((c) => c.status)).toEqual(before);
  });
  it("payment plans are persisted, not just returned once and forgotten", async () => {
    const plan = await rcmStore.upsertPaymentPlan(T, createPaymentPlan("pt-demo-1", 300, 6));
    expect((await rcmStore.listPaymentPlans(T, "pt-demo-1"))[0]?.id).toBe(plan.id);
  });
  it("patient-financial agent does not duplicate a payment plan or keep escalating collections once one exists", async () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await rcmStore.upsertPatient(T, { id: "pt-plan-test", firstName: "Test", lastName: "Plan", dob: "1990-01-01" });
    await rcmStore.postLedger(T, [
      { id: "led-plan-1", patientId: "pt-plan-test", type: "charge", amount: 500, date: recent, responsibleParty: "insurance" },
      { id: "led-plan-2", patientId: "pt-plan-test", type: "transfer-to-patient", amount: 250, date: recent, responsibleParty: "patient" },
    ]);
    const r1 = await agentRuntime.run("patient-financial", T);
    expect(r1.steps.some((s) => s.tool === "offer-payment-plan" && s.input.patientId === "pt-plan-test")).toBe(true);
    expect(await rcmStore.listPaymentPlans(T, "pt-plan-test")).toHaveLength(1);
    // A second (e.g. nightly) run must not offer another plan, nor keep escalating collections,
    // now that the patient is already on one.
    const r2 = await agentRuntime.run("patient-financial", T);
    expect(r2.steps.some((s) => s.tool === "offer-payment-plan" && s.input.patientId === "pt-plan-test")).toBe(false);
    expect(r2.steps.some((s) => s.input.patientId === "pt-plan-test")).toBe(false);
    expect(await rcmStore.listPaymentPlans(T, "pt-plan-test")).toHaveLength(1);
  });
  it("patient-financial agent finds the duplicate payment credit and queues a refund approval", async () => {
    const r = await agentRuntime.run("patient-financial", T);
    const refund = r.steps.find((s) => s.tool === "issue-refund");
    expect(refund?.outcome).toBe("needs-approval");
    expect(refund?.input.patientId).toBe("pt-demo-4");
    expect(refund?.input.amount).toBe(150);
  });
  it("caps a refund to the credit still on the account at execution time, not the stale planned amount", async () => {
    const r = await agentRuntime.run("patient-financial", T);
    const refundStep = r.steps.find((s) => s.tool === "issue-refund" && s.outcome === "needs-approval")!;
    await rcmStore.decideApproval(T, refundStep.approvalId!, "approved", "biller");
    // Between planning and approval, part of the credit is already refunded through another
    // channel — only $60 of credit remains on the $150 that was planned.
    await rcmStore.postLedger(T, [{ id: "led-drain", patientId: refundStep.input.patientId as string, type: "refund", amount: 90, date: "2026-09-10", responsibleParty: "patient" }]);
    const exec = await agentRuntime.executeApproved(T, refundStep.approvalId!, "biller");
    expect(exec.ok).toBe(true);
    expect((exec.output as { refunded: number }).refunded).toBe(60);
  });
  it("re-planning the same still-unresolved state does not queue a second, distinct approval for the same money-moving action", async () => {
    // patient-financial's duplicate-credit refund keeps being re-detected on every plan() call
    // until it's actually refunded — nothing marks it "in progress" the way denial triage does.
    // Without a dedup guard, running the agent twice before the first refund is decided would
    // queue two separate approvals for the same $150 credit; approving both would refund it twice.
    const r1 = await agentRuntime.run("patient-financial", T);
    const step1 = r1.steps.find((s) => s.tool === "issue-refund" && s.outcome === "needs-approval")!;
    const afterFirst = await rcmStore.listApprovals(T, "pending");
    expect(afterFirst.some((a) => a.id === step1.approvalId)).toBe(true);
    const r2 = await agentRuntime.run("patient-financial", T);
    const step2 = r2.steps.find((s) => s.tool === "issue-refund" && s.outcome === "needs-approval")!;
    expect(step2.approvalId).toBe(step1.approvalId);
    expect(await rcmStore.listApprovals(T, "pending")).toHaveLength(afterFirst.length);
  });
  it("denial agent does not duplicate a denials-queue work item that's already open for the same denial", async () => {
    const before = await rcmStore.listWorkItems(T, "denials");
    expect(before.length).toBeGreaterThan(0); // seed already queued items for these denials
    await agentRuntime.run("denials", T);
    const after = await rcmStore.listWorkItems(T, "denials");
    expect(after.length).toBe(before.length); // re-scanning the same still-open denials must not pile up duplicates
  });
  it("prior-auth agent escalates an existing SLA-breached or soon-to-expire auth, not just newly-opened ones", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const breached = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "70450", diagnoses: ["M54.16"] }), "requested", { actor: "system" });
    await rcmStore.upsertAuth(T, { ...breached, slaDeadline: "2020-01-01T00:00:00.000Z" }); // already breached
    const r = await agentRuntime.run("prior-auth", T);
    expect(r.dryRun).toBeFalsy();
    const items = await rcmStore.listWorkItems(T, "prior-auth");
    expect(items.some((w) => w.context?.authId === breached.id)).toBe(true);
    // Re-running must not open a second escalation item for the same still-breached auth.
    const before = items.length;
    await agentRuntime.run("prior-auth", T);
    expect((await rcmStore.listWorkItems(T, "prior-auth")).length).toBe(before);
  });
  it("prior-auth agent opens a request anchored to the visit's date, so approving it later still covers that visit", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const visitDate = "2026-11-01"; // well in the future relative to when this request is approved below
    const claim = buildClaim({ encounterId: "e-dos", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "70450", modifiers: [], units: 1, charge: 500, dxPointers: [1], dateOfService: visitDate, placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim);
    const r = await agentRuntime.run("prior-auth", T);
    const opened = r.steps.find((s) => s.tool === "open-auth-request" && s.input.cpt === "70450")!;
    const authId = (opened.output as { authId: string }).authId;
    // Approved "today" (well before the visit) with no explicit validFrom — must anchor to the
    // visit date it was actually requested for, not to today, so the visit itself is covered.
    const pending = await rcmStore.getAuth(T, authId);
    const approved = transitionAuth(pending!, "approved", { actor: "biller", authNumber: "AUTH-DOS-1" });
    expect(approved.validFrom).toBe(visitDate);
    expect(authCoversService(approved, "70450", visitDate).ok).toBe(true);
  });
  it("prior-auth agent still opens a new request when an existing pending one has too few units", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = buildClaim({ encounterId: "e-units", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 3, charge: 300, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim);
    // A pending request for only 1 unit is already in flight — it cannot cover a 3-unit line.
    const insufficient = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", units: 1, diagnoses: ["M54.16"] }), "requested", { actor: "system" });
    await rcmStore.upsertAuth(T, insufficient);
    const r = await agentRuntime.run("prior-auth", T);
    const opened = r.steps.find((s) => s.tool === "open-auth-request" && s.input.cpt === "97110");
    expect(opened).toBeDefined(); // must not be skipped just because *some* request is pending
  });
});

describe("round 4 hardening", () => {
  it("authCoversService requires an actual authorization number, not just an 'approved' status", () => {
    const approvedNoNumber = transitionAuth(createAuthRequest({ patientId: "p1", coverageId: "c1", payerId: "BCBS", cpt: "70450", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    const approved = { ...transitionAuth(approvedNoNumber, "approved", { actor: "t", validFrom: "2026-01-01", validTo: "2026-12-31" }), authNumber: undefined };
    expect(authCoversService(approved, "70450", "2026-09-01").ok).toBe(false);
    const withNumber = { ...approved, authNumber: "AUTH123" };
    expect(authCoversService(withNumber, "70450", "2026-09-01").ok).toBe(true);
  });
  it("authorizedCptsOnFile validates the claim's priorAuthNumber against a real approved auth, not just its presence", () => {
    const auths = [{ ...transitionAuth(createAuthRequest({ patientId: "p1", coverageId: "c1", payerId: "BCBS", cpt: "70450", diagnoses: ["M54.16"] }), "requested", { actor: "t" }) }];
    const approved = transitionAuth(auths[0], "approved", { actor: "t", authNumber: "AUTH999" });
    expect(authorizedCptsOnFile("MADE-UP-NUMBER", "p1", "c1", ["70450"], [approved])).toEqual([]);
    expect(authorizedCptsOnFile(undefined, "p1", "c1", ["70450"], [approved])).toEqual([]);
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", ["70450"], [approved])).toEqual(["70450"]);
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", ["72148"], [approved])).toEqual([]); // wrong CPT
    expect(authorizedCptsOnFile("AUTH999", "p1", "c2", ["70450"], [approved])).toEqual([]); // wrong coverage
  });
  it("scrubber's auth-missing rule clears per-CPT, not the whole claim, and normalizes CPT case", () => {
    const claim = { ...mkClaim(), priorAuthNumber: "SOME-STRING" };
    const flagged = scrubClaim(claim, { authRequiredCpts: ["99214"], authorizedCpts: [] });
    expect(flagged.edits.some((e) => e.id === "auth-missing")).toBe(true); // priorAuthNumber alone doesn't clear it
    const cleared = scrubClaim(claim, { authRequiredCpts: ["99214"], authorizedCpts: ["99214"] });
    expect(cleared.edits.some((e) => e.id === "auth-missing")).toBe(false);
    const lowerCaseNeed = scrubClaim(claim, { authRequiredCpts: ["99214"], authorizedCpts: [] });
    expect(lowerCaseNeed.edits.filter((e) => e.id === "auth-missing")).toHaveLength(1); // matched despite need-set casing
    // A claim with two auth-required lines, only one of them covered by the on-file number,
    // must still flag the other — a single auth number can't clear the whole claim.
    const twoLineClaim = { ...mkClaim(), priorAuthNumber: "AUTH-1", lines: [mkClaim().lines[0], { ...mkClaim().lines[1], cpt: "72148" }] };
    const partial = scrubClaim(twoLineClaim, { authRequiredCpts: ["99214", "72148"], authorizedCpts: ["99214"] });
    const authMissingLines = partial.edits.filter((e) => e.id === "auth-missing").map((e) => e.lineNumber);
    expect(authMissingLines).toEqual([2]); // only the uncovered 72148 line (index 2) is flagged
  });
  it("parseEra derives a stable fingerprint id (not a random one) when the payload has no id or check number", () => {
    const payload = { payerid: "BCBS", check_amount: 100, check_date: "2026-08-01", claims: [{ pcn: "clm-1", billed: 100, paid: 100 }] };
    const a = parseEra(payload);
    const b = parseEra(payload);
    expect(a.id).toBe(b.id); // same content → same id, so a retried post is recognized as a duplicate
    expect(a.id).not.toMatch(/^era_/); // not the random fallback id generator
  });
  it("buildClaim falls back to the payer contract's timely-filing default before the generic 90 days", () => {
    const c = buildClaim({ encounterId: "e", patient, coverage: { ...coverage, timelyFilingDays: undefined }, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "99214", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-07-01", placeOfService: "11" }], contractTimelyFilingDays: 365 });
    expect(c.timelyFilingDeadline).toBe("2027-07-01"); // 365 days, not the generic 90
  });
  it("correctedClaim caps diagnoses to 12 like buildClaim does", () => {
    const c = mkClaim();
    const tooMany = Array.from({ length: 15 }, (_, i) => ({ code: `A${String(i).padStart(2, "0")}` }));
    const corr = correctedClaim(c, { diagnoses: tooMany });
    expect(corr.diagnoses).toHaveLength(12);
  });
  it("coding: em.code accepts real E/M levels and the documented hint pattern, rejects garbage", () => {
    const garbage = parseCodingSuggestion(JSON.stringify({ em: { code: "BAD", rationale: "x" }, icd: [], cptSuggestions: [], queries: [] }), "test");
    expect(garbage.em.code).toBe("");
    const junkNumeric = parseCodingSuggestion(JSON.stringify({ em: { code: "99999", rationale: "x" }, icd: [], cptSuggestions: [], queries: [] }), "test");
    expect(junkNumeric.em.code).toBe("");
    const hint = parseCodingSuggestion(JSON.stringify({ em: { code: "9921x", rationale: "x" }, icd: [], cptSuggestions: [], queries: [] }), "test");
    expect(hint.em.code).toBe("9921X");
    const real = parseCodingSuggestion(JSON.stringify({ em: { code: "99214", rationale: "x" }, icd: [], cptSuggestions: [], queries: [] }), "test");
    expect(real.em.code).toBe("99214");
  });
  it("estimatePatientResponsibility caps the copay at the allowed amount so patient share never exceeds it", () => {
    const benefits: BenefitSnapshot = { active: true, copayOfficeVisit: 75, deductibleRemaining: 0, coinsurancePct: 0, checkedAt: "2026-09-01", source: "stub" };
    const est = estimatePatientResponsibility([{ cpt: "99214", units: 1 }], benefits, { "99214": 50 }); // allowed is only $50, copay quoted at $75
    expect(est.copay).toBe(50);
    expect(est.patientResponsibility).toBe(50);
    expect(est.patientResponsibility + est.insuranceResponsibility).toBe(est.estimatedAllowed);
  });
  it("agingByPayer still ages a claim left 'adjudicated' by a zero-pay or reversed remittance", () => {
    const c = transitionClaim(transitionClaim(transitionClaim(transitionClaim(mkClaim(), "scrubbed", "t"), "ready", "t"), "submitted", "t"), "adjudicated", "t");
    const rows = agingByPayer([c], [], "2026-09-05");
    expect(rows.find((r) => r.payerId === "BCBS")?.total).toBeGreaterThan(0);
  });
  it("computeAccount keeps a self-pay charge on the patient side even with no transfer-to-patient entry", () => {
    const selfPay: LedgerEntry[] = [{ id: "sp1", patientId: "p9", type: "charge", amount: 200, date: "2026-08-01", responsibleParty: "patient" }];
    const s = computeAccount("p9", selfPay);
    expect(s.patientBalance).toBe(200);
    expect(s.insuranceBalance).toBe(0);
  });
});
