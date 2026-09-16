// RCM back-end: claims lifecycle, ERA posting, denials, patient financials, contracts, analytics, worklists, voice, agents.
import { describe, it, expect, beforeEach } from "vitest";
import { applyClaimPatch, buildClaim, canTransition, claimTo837P, claimToCms1500Boxes, claimsNeedingFollowUp, correctedClaim, mapStatusCategory, secondaryClaim, transitionClaim } from "../server/rcm/claims";
import { parseEra, postRemittance, claimStatusFromPosting } from "../server/rcm/remittance";
import { analyzeDenial, denialFromAdjustment, denialPriority, denialTrends, generateAppealLetter, recommendAction } from "../server/rcm/denials";
import { buildStatement, collectionsStage, computeAccount, computeAging, createPaymentPlan, detectCreditBalances, fplPercent, goodFaithEstimate, propensityToPay, slidingFeeDiscount, smallBalanceWriteOffs } from "../server/rcm/patient-financials";
import { DEFAULT_CONTRACTS, expectedAllowed, expectedForLines, modelContractChange, varianceReport } from "../server/rcm/contracts";
import { agingByPayer, computeKpis } from "../server/rcm/analytics";
import { itemsFromDenials, queueSummary, sortQueue } from "../server/rcm/worklists";
import { parseVoiceIntent, speakIntent, speakKpis } from "../server/rcm/voice";
import { applyDisposition, buildPayerCallScript } from "../server/rcm/agents/payer-call";
import { authCoversService, authorizedCptsOnFile, consumeAuthUnit, createAuthRequest, transitionAuth } from "../server/rcm/prior-auth";
import { scrubClaim } from "../server/rcm/scrubber";
import { estimatePatientResponsibility, financialClearance, parse271 } from "../server/rcm/eligibility";
import { parseCodingSuggestion } from "../server/rcm/coding";
import { addDays, isValidIcd10 } from "../server/rcm/util";
import { agentRuntime } from "../server/rcm/agents";
import { aiText } from "../server/rcm/agents/ai";
import { rcmStore } from "../server/rcm/store";
import { seedDemoTenant } from "../server/rcm/demo-seed";
import { setFeatureProvider } from "../server/services/ai-provider";
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
  it("secondaryClaim clears the primary's payer-specific auth/referral/denial-resolution fields instead of carrying them to the new payer", () => {
    const primaryWithAuth = { ...mkClaim(), priorAuthNumber: "PRIMARY-AUTH-1", referralNumber: "PRIMARY-REF-1", resolvesDenialId: "den-on-primary" };
    const sec = secondaryClaim(primaryWithAuth, { ...coverage, id: "c2", payerId: "AETNA", payerName: "Aetna", priority: "secondary" }, { billed: 450, paid: 200, patientResp: 50, lines: [] });
    expect(sec.priorAuthNumber).toBeUndefined(); // must not emit the primary payer's auth in box 23
    expect(sec.referralNumber).toBeUndefined();
    expect(sec.resolvesDenialId).toBeUndefined(); // must not mark a denial on the PRIMARY claim "appealed" when this claim submits
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
  it("underpayment check folds contractual CAS amounts into the derived allowed amount when the ERA omits an explicit allowed", () => {
    const c = mkClaim(); // 99214 + 20610, expected ≈ 270 per BCBS contract
    const rem = parseEra({ payerid: "BCBS", check_amount: 200, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 200, patient_resp: 20, lines: [{ proc: "99214", billed: 300, paid: 150, patient_resp: 20, adjustments: [{ group: "CO", carc: "45", amount: 30 }] }, { proc: "20610", billed: 150, paid: 50, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: 20 }] }] }] });
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    const p = r.postings[0];
    expect(p.contractual).toBe(50);
    // paid(200) + patientResp(20) + contractual(50) = 270 ≈ expected — a correctly-paid claim,
    // not an underpayment, even though no explicit `allowed` was in the ERA.
    expect(p.underpayment).toBeUndefined();
  });
  it("never posts cash against an unmatched claim id, and leaves it unapplied", () => {
    const rem = parseEra({ check_amount: 100, claims: [{ pcn: "x", status: "22", billed: 100, paid: -50, patient_resp: 0 }] });
    const r = postRemittance(rem, {});
    expect(r.postings[0].status).toBe("unmatched");
    expect(r.postings[0].entries).toHaveLength(0);
    expect(r.unapplied).toBe(100); // none of the unmatched claim's cash counts as applied
    expect(r.balanced).toBe(false);
  });
  it("treats a matched claim id as unmatched when the ERA's payer id doesn't agree with the claim's own payer", () => {
    const c = mkClaim(); // payerId BCBS
    const rem = parseEra({ payerid: "AETNA", check_amount: 100, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 100, patient_resp: 0 }] });
    const r = postRemittance(rem, { [c.id]: c });
    expect(r.postings[0].status).toBe("unmatched"); // wrong-payer ERA must not post against this claim
    expect(r.postings[0].entries).toHaveLength(0);
    expect(r.unapplied).toBe(100);
  });
  it("clamps a negative CAS adjustment amount to zero instead of posting a negative-dollar ledger entry", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 300, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 300, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: -150 }] }] });
    expect(rem.claims[0].claimAdjustments![0].amount).toBe(0);
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].contractual).toBe(0);
    expect(r.postings[0].entries.every((e) => e.amount >= 0)).toBe(true);
  });
  it("treats a second CLP row for the same claimId within one ERA as unmatched instead of double-posting it", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 200, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 100, patient_resp: 0 }, { pcn: c.id, status: "1", billed: 450, paid: 100, patient_resp: 0 }] });
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].status).not.toBe("unmatched");
    expect(r.postings[1].status).toBe("unmatched"); // duplicate row for the same claim, flagged for manual reconciliation
    expect(r.postings[1].entries).toHaveLength(0);
    expect(r.unapplied).toBe(100); // only the first row's $100 counted as applied
  });
  it("does not treat a standard 835 reversal-and-correction pair (same claimId, reversal then new adjudication) as a duplicate", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 200, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -100, patient_resp: 0 }, { pcn: c.id, status: "1", billed: 450, paid: 200, patient_resp: 0 }] });
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].status).toBe("reversal");
    expect(r.postings[1].status).not.toBe("unmatched"); // the row right after the reversal is the correction, not a duplicate
    expect(r.postings[1].entries.length).toBeGreaterThan(0);
  });
  it("preserves a negative CAS amount on a reversal row so the original write-off actually gets unwound", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: -100, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -100, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: -150 }] }] });
    expect(rem.claims[0].claimAdjustments![0].amount).toBe(-150); // not clamped to 0 — this negates the original write-off
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].contractual).toBe(-150);
  });
  it("does not spawn a new (negative-amount) denial record from a reversal's negated denial-CARC", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: -30, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -30, patient_resp: 0, adjustments: [{ group: "CO", carc: "97", amount: -30 }] }] });
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].status).toBe("reversal");
    expect(r.postings[0].denials).toHaveLength(0); // would otherwise create a bogus negative-amount Denial
  });
  it("treats a second reversal row for the same claimId as a duplicate instead of double-refunding it", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: -200, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -100, patient_resp: 0 }, { pcn: c.id, status: "22", billed: 450, paid: -100, patient_resp: 0 }] });
    const r = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs });
    expect(r.postings[0].status).toBe("reversal");
    expect(r.postings[1].status).toBe("unmatched"); // two reversals in a row for one claim is not the legitimate reversal-then-correction pattern
    expect(r.postings[1].entries).toHaveLength(0);
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
  it("computeAging un-retires a charge when a reversal posts a negative-amount credit entry to unwind it", () => {
    const base: LedgerEntry[] = [
      { id: "r1", patientId: "p9", type: "charge", amount: 500, date: "2026-03-01", responsibleParty: "insurance" },
      { id: "r2", patientId: "p9", type: "insurance-payment", amount: 300, date: "2026-04-01", responsibleParty: "insurance" },
      { id: "r3", patientId: "p9", type: "contractual-adjustment", amount: 100, date: "2026-04-01", responsibleParty: "insurance" },
    ];
    expect(computeAging(base, "2026-09-05").total).toBe(100); // 500 billed - 300 paid - 100 written off = 100 open
    const reversed: LedgerEntry[] = [...base, { id: "r4", patientId: "p9", type: "refund", amount: 300, date: "2026-05-01", responsibleParty: "insurance" }, { id: "r5", patientId: "p9", type: "contractual-adjustment", amount: -100, date: "2026-05-01", responsibleParty: "insurance" }];
    // Both the payment and its contractual write-off were taken back — the full $500 charge must
    // look open again, not stay retired because the negative-amount reversal entry was ignored.
    expect(computeAging(reversed, "2026-09-05").total).toBe(500);
  });
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
    // The charge must actually fall within the 90-day period window — days-in-AR's daily-charge
    // rate is derived from charges in that window, not the lifetime ledger.
    const kpis = computeKpis({ claims: [c], denials: [], ledger: [{ id: "1", patientId: "p1", type: "charge", amount: 9000, date: "2026-07-01", responsibleParty: "insurance" }, { id: "2", patientId: "p1", type: "insurance-payment", amount: 5000, date: "2026-07-01", responsibleParty: "insurance" }], remittances: [], today: "2026-09-05", periodDays: 90, scrubTotal: 10, scrubFirstPassClean: 9 });
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
  it("run-eligibility rejects a patientId/coverageId pair that don't belong to the same patient", async () => {
    // pt-demo-1 and cov-demo-2 (which belongs to pt-demo-2) are both real, independently valid
    // ids — patientId and coverageId are looked up separately, so nothing but this check stops a
    // caller from pairing one patient's demographics with another patient's member coverage.
    const tool = agentRuntime.get("eligibility")!.tools.find((t) => t.name === "run-eligibility")!;
    await expect(
      tool.run({ patientId: "pt-demo-1", coverageId: "cov-demo-2", dateOfService: "2026-09-01" }, { tenantId: T, store: rcmStore, actor: "test", dryRun: false, budget: { remaining: 5 } }),
    ).rejects.toThrow(/does not belong/);
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
  it("prior-auth agent matches an existing auth even when the claim line's CPT case differs", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const approved = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "J0135", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(approved, "approved", { actor: "t", authNumber: "AUTH-CASE-1", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim = buildClaim({ encounterId: "e-case", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "j0135", modifiers: [], units: 1, charge: 200, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim);
    const r = await agentRuntime.run("prior-auth", T);
    expect(r.steps.some((s) => s.tool === "attach-auth-to-claim" && s.outcome === "ok")).toBe(true);
    expect(r.steps.some((s) => s.tool === "open-auth-request")).toBe(false); // must not open a duplicate request
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
    const claimEditsAfterFirstRun = await rcmStore.listWorkItems(T, "claim-edits");
    expect(claimEditsAfterFirstRun.length).toBeGreaterThan(0);
    // With no claim reaching "ready", a second run must not queue any submission for approval.
    const r2 = await agentRuntime.run("claim-scrubber", T);
    expect(r2.approvalsRequested).toBe(0);
    // Nor should re-scrubbing the same still-dirty claims pile a second claim-edits work item onto
    // the queue for a claim that already has one open — one open item per claim, not one per run.
    expect(await rcmStore.listWorkItems(T, "claim-edits")).toHaveLength(claimEditsAfterFirstRun.length);
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
  it("submitting a claim consumes its prior-auth's units, and blocks submission once they're exhausted", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const approvedAuth = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(approvedAuth, "approved", { actor: "t", authNumber: "AUTH-UNIT-1", approvedUnits: 2, validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim1 = buildClaim({ encounterId: "e-u1", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 2, charge: 200, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }], priorAuthNumber: "AUTH-UNIT-1" });
    const ready1 = transitionClaim(transitionClaim(claim1, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready1);
    await agentRuntime.run("claim-scrubber", T);
    const pending1 = (await rcmStore.listApprovals(T, "pending")).find((a) => a.payload.claimId === ready1.id)!;
    await rcmStore.decideApproval(T, pending1.id, "approved", "biller");
    const exec1 = await agentRuntime.executeApproved(T, pending1.id, "biller");
    expect(exec1.ok).toBe(true);
    const authAfter1 = await rcmStore.getAuth(T, approvedAuth.id);
    expect(authAfter1?.unitsUsed).toBe(2);
    expect(authAfter1?.status).toBe("exhausted");
    // A second claim trying to reuse the now-exhausted auth must be blocked at submission time,
    // not silently allowed through with zero units actually tracked as used.
    const claim2 = buildClaim({ encounterId: "e-u2", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-05", placeOfService: "11" }], priorAuthNumber: "AUTH-UNIT-1" });
    const ready2 = transitionClaim(transitionClaim(claim2, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready2);
    await agentRuntime.run("claim-scrubber", T);
    const pending2 = (await rcmStore.listApprovals(T, "pending")).find((a) => a.payload.claimId === ready2.id)!;
    await rcmStore.decideApproval(T, pending2.id, "approved", "biller");
    const exec2 = await agentRuntime.executeApproved(T, pending2.id, "biller");
    expect(exec2.ok).toBe(false);
    expect((await rcmStore.getClaim(T, ready2.id))?.status).toBe("ready"); // never actually submitted
  });
  it("submit-claim fails closed when the claim's priorAuthNumber has no matching internal authorization record", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = buildClaim({ encounterId: "e-bogus-auth", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }], priorAuthNumber: "NEVER-ISSUED-BY-US" });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    await agentRuntime.run("claim-scrubber", T);
    const pending = (await rcmStore.listApprovals(T, "pending")).find((a) => a.payload.claimId === ready.id)!;
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(false);
    expect((await rcmStore.getClaim(T, ready.id))?.status).toBe("ready");
  });
  it("submit-claim does not block on an unresolvable priorAuthNumber when none of the claim's lines actually require auth", async () => {
    // A box-23 number that's purely informational (gold-carded CPTs, or one carried over onto a
    // secondary/COB claim for a different payer/coverage that never required auth) scrubs clean
    // — submission must not get stuck just because it doesn't resolve to a tracked auth record.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = { ...mkClaim(), encounterId: "e-informational-auth", priorAuthNumber: "INFO-ONLY-NOT-TRACKED" }; // 99214/20610 need no auth
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    await agentRuntime.run("claim-scrubber", T);
    const pending = (await rcmStore.listApprovals(T, "pending")).find((a) => a.payload.claimId === ready.id)!;
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(true);
    expect((await rcmStore.getClaim(T, ready.id))?.status).toBe("submitted");
  });
  it("submit-claim fails closed when a claim needs auth but carries no priorAuthNumber at all", async () => {
    // The guard used to be wrapped in `if (claim.priorAuthNumber && ...)`, so a claim needing
    // auth with NO box-23 number at all skipped validation entirely instead of failing closed.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = buildClaim({ encounterId: "e-no-auth-at-all", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(false);
    expect((await rcmStore.getClaim(T, ready.id))?.status).toBe("ready");
  });
  it("submit-claim revalidates every auth-required CPT on the claim, not only the one matching the attached priorAuthNumber", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    // Only 97110 has a covering approved auth; 70450 (also auth-required) has none at all.
    const covered = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(covered, "approved", { actor: "t", authNumber: "AUTH-MULTI-1", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim = buildClaim({ encounterId: "e-multi-auth", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-MULTI-1", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "70450", modifiers: [], units: 1, charge: 500, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending2 = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending2.id, "approved", "biller");
    const exec2 = await agentRuntime.executeApproved(T, pending2.id, "biller");
    expect(exec2.ok).toBe(false); // 70450 has no covering auth, even though 97110 (the attached number) does
    expect(exec2.error).toMatch(/70450/);
  });
  it("submit-claim allows a split-visit claim where the same CPT on two different dates is each independently covered by its own auth", async () => {
    // The prior-auth agent itself opens a separate request per distinct date of service — one
    // auth record covering only the first visit's units must not be required to also cover a
    // second visit's units on a different date for the SAME CPT.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const auth1 = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01" }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(auth1, "approved", { actor: "t", authNumber: "AUTH-SPLIT-1", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const auth2 = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-10" }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(auth2, "approved", { actor: "t", authNumber: "AUTH-SPLIT-2", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim = buildClaim({ encounterId: "e-split-visit", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-SPLIT-1", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-10", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(true);
    // Each visit's own auth must be consumed for exactly its own unit, not the box-23-attached
    // auth (auth1) absorbing both dates' units while auth2 goes untouched.
    expect((await rcmStore.getAuth(T, auth1.id))?.unitsUsed).toBe(1);
    expect((await rcmStore.getAuth(T, auth2.id))?.unitsUsed).toBe(1);
  });
  it("submit-claim prefers each bucket's own dateOfService-matched auth over a greedy array-order pick, even when the line order and auth-exhaustion state would otherwise mis-assign them", async () => {
    // The later-dated line appears FIRST in the claim, and the earlier-dated auth is first in
    // store order — a greedy "first covering auth in array order" pick (ignoring which auth was
    // actually requested for which date) would hand the later visit's bucket the EARLIER visit's
    // auth first, then find the later visit's own (already-exhausted) auth has nothing left for
    // the earlier visit, failing a submission that a correct, date-aware assignment would allow.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const authForEarlyVisit = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01" }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(authForEarlyVisit, "approved", { actor: "t", authNumber: "AUTH-EARLY", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const authForLateVisitExhausted = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-10" }), "requested", { actor: "t" });
    const approvedLate = transitionAuth(authForLateVisitExhausted, "approved", { actor: "t", authNumber: "AUTH-LATE", validFrom: "2026-01-01", validTo: "2026-12-31" });
    await rcmStore.upsertAuth(T, { ...approvedLate, unitsUsed: approvedLate.units }); // already fully used elsewhere
    const claim = buildClaim({ encounterId: "e-order-sensitive", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-EARLY", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-10", placeOfService: "11" }, { cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(false); // 2026-09-10's own auth is genuinely exhausted — that visit alone must fail
    expect(exec.error).toMatch(/2026-09-10/);
    // The early visit's own auth must be untouched by the failed attempt to cover the late visit.
    expect((await rcmStore.getAuth(T, authForEarlyVisit.id))?.unitsUsed).toBe(0);
  });
  it("submit-claim does not let two different dates both pass against the SAME auth's static remaining-units count", async () => {
    // A single 1-unit auth whose validity window happens to span both visit dates must not clear
    // two independent 1-unit visits just because each is checked against the same unconsumed
    // unitsUsed=0 in isolation — the second visit's check must see the first's reservation.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const wideAuth = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(wideAuth, "approved", { actor: "t", authNumber: "AUTH-WIDE-1", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim = buildClaim({ encounterId: "e-wide-auth-two-visits", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-WIDE-1", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-10", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(false); // only 1 unit total exists on this auth, but the claim needs 2
  });
  it("submit-claim's auth lookup requires a payer match, not just number/patient/coverage", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    // Same authNumber/patient/coverage, but issued for a DIFFERENT payer — must not be selected.
    const wrongPayerAuth = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "AETNA", cpt: "97110", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, transitionAuth(wrongPayerAuth, "approved", { actor: "t", authNumber: "AUTH-CROSS-PAYER", validFrom: "2026-01-01", validTo: "2026-12-31" }));
    const claim = buildClaim({ encounterId: "e-cross-payer", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-CROSS-PAYER", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    expect(claim.payerId).toBe("BCBS"); // the claim itself is billed to BCBS, not AETNA
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending3 = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending3.id, "approved", "biller");
    const exec3 = await agentRuntime.executeApproved(T, pending3.id, "biller");
    expect(exec3.ok).toBe(false); // the AETNA auth must not cover a BCBS claim
  });
  it("submit-claim leaves the claim retryable (not stuck at 'submitted') when an auth is invalidated after approval but before execution", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const auth = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"] }), "requested", { actor: "t" });
    const approvedAuth = transitionAuth(auth, "approved", { actor: "t", authNumber: "AUTH-INVALIDATED-1", validFrom: "2026-01-01", validTo: "2026-12-31" });
    await rcmStore.upsertAuth(T, approvedAuth);
    const claim = buildClaim({ encounterId: "e-auth-invalidated", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], priorAuthNumber: "AUTH-INVALIDATED-1", lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    const ready = transitionClaim(transitionClaim(claim, "scrubbed", "t"), "ready", "t");
    await rcmStore.upsertClaim(T, ready);
    const pending = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: ready.id, amount: ready.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, pending.id, "approved", "biller");
    // Simulate an admin independently invalidating the auth (via the separate auth transition
    // route) after this approval was granted but before it executes. This lands before run()'s
    // own auth lookup, so it's actually caught by the earlier selection-time check rather than
    // the post-lock re-validation added alongside this ordering fix — a true race landing inside
    // that narrower window isn't deterministically reproducible without artificial interleaving
    // hooks in this single-threaded harness (see the reply on the original re-validation fix).
    // What this test guarantees regardless of which check catches it: failing closed on an
    // invalid auth must never leave the claim stuck.
    await rcmStore.upsertAuth(T, { ...approvedAuth, status: "denied" });
    const exec = await agentRuntime.executeApproved(T, pending.id, "biller");
    expect(exec.ok).toBe(false);
    expect(exec.error).toMatch(/no authorization on file covers|no longer approved/i);
    // Critically, the claim must NOT have been advanced to "submitted" — the auth revalidation
    // happens before the claim transition specifically so a failure here leaves the claim exactly
    // where a retry can pick it back up, instead of stuck in "submitted" (which has no legal
    // self-transition and would make every retry attempt fail immediately).
    expect((await rcmStore.getClaim(T, ready.id))!.status).toBe("ready");
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
  it("a tool's raw thrown error reaches the caller but is never persisted verbatim into the audit log", async () => {
    // A tool's exception text isn't guaranteed to stay PHI-free forever, and /agents/audit
    // exposes stored detail — the caller still gets the real message (for retry/UI purposes),
    // but the durable audit row must only ever get a fixed, redacted marker.
    const approval = await rcmStore.requestApproval(T, { agent: "denials", action: "write-off", payload: { denialId: "missing-denial-for-audit-test", patientId: "pt-demo-1", amount: 10, reason: "test" }, reason: "test" });
    await rcmStore.decideApproval(T, approval.id, "approved", "biller");
    const exec = await agentRuntime.executeApproved(T, approval.id, "biller");
    expect(exec.ok).toBe(false);
    expect(exec.error).toMatch(/denial not found/); // the direct caller still sees the real reason
    const audit = await rcmStore.listAudit(T);
    const errorRow = audit.find((a) => a.outcome === "error" && a.step === "write-off:approved-exec");
    expect(errorRow).toBeDefined();
    expect(JSON.stringify(errorRow!.detail)).not.toMatch(/denial not found/); // redacted in the persisted log
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
  it("triaging a denial doesn't mark it in-progress — it stays open (and re-triageable) until its recommended action actually succeeds", async () => {
    const before = (await rcmStore.listDenials(T, "open")).map((d) => d.id);
    expect(before.length).toBeGreaterThan(0);
    const r = await agentRuntime.run("denials", T);
    // Every denial that was triaged must still show up as "open" — rejecting or never deciding
    // the recommended action must not make it disappear from the next scan.
    const stillOpen = (await rcmStore.listDenials(T, "open")).map((d) => d.id);
    expect(stillOpen).toEqual(expect.arrayContaining(before));
    const triaged = r.steps.filter((s) => s.tool === "triage-denial").map((s) => s.input.denialId);
    for (const id of before) expect(triaged).toContain(id);
  });
  it("write-off/appeal/transfer actions fail closed if the denial was resolved another way while the approval was pending", async () => {
    await rcmStore.upsertDenial(T, { id: "den-stale-1", claimId: "c1", patientId: "pt-demo-1", payerId: "BCBS", carc: "1", group: "PR", amount: 10, category: "other", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const approval = await rcmStore.requestApproval(T, { agent: "denials", action: "write-off", payload: { denialId: "den-stale-1", patientId: "pt-demo-1", amount: 10, reason: "test" }, reason: "test" });
    await rcmStore.decideApproval(T, approval.id, "approved", "biller");
    // Another workflow (or a human) resolves the denial a different way before this approval executes.
    await rcmStore.upsertDenial(T, { id: "den-stale-1", claimId: "c1", patientId: "pt-demo-1", payerId: "BCBS", carc: "1", group: "PR", amount: 10, category: "other", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "appealed", priorityScore: 10 });
    const exec = await agentRuntime.executeApproved(T, approval.id, "biller");
    expect(exec.ok).toBe(false);
    expect(exec.error).toMatch(/no longer open/);
  });
  it("write-off and transfer-to-patient can't both win a race against the same open denial", async () => {
    await rcmStore.upsertDenial(T, { id: "den-race-1", claimId: "c1", patientId: "pt-demo-1", payerId: "BCBS", carc: "1", group: "PR", amount: 10, category: "other", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const writeOffApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "write-off", payload: { denialId: "den-race-1", patientId: "pt-demo-1", amount: 10, reason: "test" }, reason: "test" });
    const transferApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "transfer-to-patient", payload: { denialId: "den-race-1", patientId: "pt-demo-1", amount: 10 }, reason: "test" });
    await rcmStore.decideApproval(T, writeOffApproval.id, "approved", "biller");
    await rcmStore.decideApproval(T, transferApproval.id, "approved", "biller");
    // Two different approved actions on the SAME denial, executed concurrently: without a
    // per-denial lock, both could observe status "open" before either writes back a resolved
    // status, posting duplicate/conflicting ledger entries for one denial.
    const results = await Promise.all([
      agentRuntime.executeApproved(T, writeOffApproval.id, "biller"),
      agentRuntime.executeApproved(T, transferApproval.id, "biller"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)!.error).toMatch(/already in flight/);
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
  it("agent runtime stops executing further steps once a nested run-agent call has exhausted the shared budget", async () => {
    // Budget 2: the top-level plan is sliced to its first 2 "run-agent" steps. The first one's
    // nested child run consumes the (shared) budget down to 0 before the parent loop reaches its
    // second step — that second step must be blocked, not executed anyway.
    const r = await agentRuntime.run("rcm-orchestrator", T, {}, { budget: { remaining: 2 } });
    const runAgentSteps = r.steps.filter((s) => s.tool === "run-agent");
    expect(runAgentSteps).toHaveLength(2);
    expect(runAgentSteps[1].outcome).toBe("blocked");
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
  it("small-balance write-off recomputes the balance at execution time and blocks once it's already been paid", async () => {
    await rcmStore.upsertPatient(T, { id: "pt-small-bal", firstName: "Small", lastName: "Bal", dob: "1990-01-01" });
    await rcmStore.postLedger(T, [
      { id: "led-sb-1", patientId: "pt-small-bal", type: "charge", amount: 4, date: "2026-08-01", responsibleParty: "insurance" },
      { id: "led-sb-2", patientId: "pt-small-bal", type: "transfer-to-patient", amount: 4, date: "2026-08-01", responsibleParty: "patient" },
    ]);
    const r = await agentRuntime.run("patient-financial", T);
    const step = r.steps.find((s) => s.tool === "small-balance-write-off" && s.input.patientId === "pt-small-bal")!;
    expect(step.outcome).toBe("needs-approval");
    await rcmStore.decideApproval(T, step.approvalId!, "approved", "biller");
    // The patient pays it off between planning and approval.
    await rcmStore.postLedger(T, [{ id: "led-sb-3", patientId: "pt-small-bal", type: "patient-payment", amount: 4, date: "2026-08-10", responsibleParty: "patient" }]);
    const exec = await agentRuntime.executeApproved(T, step.approvalId!, "biller");
    expect(exec.ok).toBe(false); // must not write off a balance that's already gone
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
  it("authorizedCptsOnFile validates the claim's priorAuthNumber against a real, still-covering approved auth, not just its presence", () => {
    const auths = [{ ...transitionAuth(createAuthRequest({ patientId: "p1", coverageId: "c1", payerId: "BCBS", cpt: "70450", diagnoses: ["M54.16"] }), "requested", { actor: "t" }) }];
    const approved = transitionAuth(auths[0], "approved", { actor: "t", authNumber: "AUTH999", validFrom: "2026-01-01", validTo: "2026-12-31" });
    const line = { cpt: "70450", dateOfService: "2026-09-01", units: 1 };
    expect(authorizedCptsOnFile("MADE-UP-NUMBER", "p1", "c1", "BCBS", [line], [approved])).toEqual([]);
    expect(authorizedCptsOnFile(undefined, "p1", "c1", "BCBS", [line], [approved])).toEqual([]);
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", "BCBS", [line], [approved])).toEqual(["70450"]);
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", "BCBS", [{ ...line, cpt: "72148" }], [approved])).toEqual([]); // wrong CPT
    expect(authorizedCptsOnFile("AUTH999", "p1", "c2", "BCBS", [line], [approved])).toEqual([]); // wrong coverage
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", "AETNA", [line], [approved])).toEqual([]); // wrong payer
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", "BCBS", [{ ...line, dateOfService: "2027-01-15" }], [approved])).toEqual([]); // outside validTo
    // A leftover expired row sharing the same auth number must not shadow a later valid one.
    const expired = { ...approved, id: "pa-expired", status: "expired" as const, validTo: "2026-06-30" };
    expect(authorizedCptsOnFile("AUTH999", "p1", "c1", "BCBS", [line], [expired, approved])).toEqual(["70450"]);
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
  it("buildClaim prefers the payer contract's timely-filing window over a stale coverage value", () => {
    // coverage.timelyFilingDays is documented as itself just a cached copy of the payer contract
    // default — when a live contract lookup disagrees with it (e.g. a coverage record defaulted
    // to 90 for every payer), the contract must win, not the coverage's stale copy.
    const c = buildClaim({ encounterId: "e", patient, coverage: { ...coverage, timelyFilingDays: 90 }, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "99214", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-07-01", placeOfService: "11" }], contractTimelyFilingDays: 365 });
    expect(c.timelyFilingDeadline).toBe("2027-07-01");
  });
  it("scrubber's timely-filing rule uses the claim's own resolved deadline, not a bare 90-day default", () => {
    // No coverage.timelyFilingDays override — the deadline comes entirely from the payer
    // contract's 365-day Medicare default. 200 days out would trip a naive 90-day check.
    const c = buildClaim({ encounterId: "e", patient, coverage: { ...coverage, timelyFilingDays: undefined }, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "99214", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-01-01", placeOfService: "11" }], contractTimelyFilingDays: 365 });
    const result = scrubClaim(c, { coverage: { ...coverage, timelyFilingDays: undefined }, today: "2026-07-20" }); // 200 days since DOS
    expect(result.edits.some((e) => e.id === "timely-filing")).toBe(false);
    const late = scrubClaim(c, { coverage: { ...coverage, timelyFilingDays: undefined }, today: "2027-02-01" }); // past the 365-day deadline
    expect(late.edits.some((e) => e.id === "timely-filing" && e.severity === "error")).toBe(true);
  });
  it("computeAccount doesn't depend on ledger entry order — a transfer listed before its own charge still applies", () => {
    const chargeFirst: LedgerEntry[] = [
      { id: "a", patientId: "p8", type: "charge", amount: 200, date: "2026-08-01", responsibleParty: "insurance" },
      { id: "b", patientId: "p8", type: "transfer-to-patient", amount: 40, date: "2026-08-02", responsibleParty: "patient" },
    ];
    const transferFirst: LedgerEntry[] = [chargeFirst[1], chargeFirst[0]]; // same entries, reversed order
    const s1 = computeAccount("p8", chargeFirst);
    const s2 = computeAccount("p8", transferFirst);
    expect(s2).toEqual(s1);
    expect(s1.patientBalance).toBe(40);
    expect(s1.insuranceBalance).toBe(160);
  });
  it("correctedClaim caps diagnoses to 12 like buildClaim does", () => {
    const c = mkClaim();
    const tooMany = Array.from({ length: 15 }, (_, i) => ({ code: `A${String(i).padStart(2, "0")}` }));
    const corr = correctedClaim(c, { diagnoses: tooMany });
    expect(corr.diagnoses).toHaveLength(12);
  });
  it("correctedClaim recomputes the timely-filing deadline when a patched line changes the date of service", () => {
    const c = mkClaim(); // timelyFilingDeadline "2026-09-29" (90 days from 2026-07-01)
    const patchedLines = c.lines.map((l) => ({ ...l, dateOfService: "2026-08-01" }));
    const corr = correctedClaim(c, { lines: patchedLines });
    expect(corr.timelyFilingDeadline).toBe("2026-10-30"); // same 90-day window, anchored to the new DOS
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

describe("round 7 hardening", () => {
  it("isValidIcd10 accepts U-category codes (COVID-19 provisional codes)", () => {
    expect(isValidIcd10("U07.1")).toBe(true);
    expect(isValidIcd10("U09.9")).toBe(true);
    expect(isValidIcd10("A00.0")).toBe(true); // still accepts an ordinary code
  });
  it("scrubber's unlinked-service-line rule caps the POINTER COUNT at 4 (box 24E) without capping which of up to 12 diagnoses a pointer may reference", () => {
    const c = mkClaim();
    const tooManyPointers = { ...c, lines: [{ ...c.lines[0], dxPointers: [1, 1, 1, 1, 1] }] }; // 5 pointers — too many
    const result = scrubClaim(tooManyPointers);
    expect(result.edits.some((e) => e.id === "unlinked-service-line")).toBe(true);
    // A line pointing only to the claim's 6th diagnosis (a valid box 21 slot, A-L) must NOT be
    // rejected just because the pointer value exceeds 4 — only the pointer COUNT is capped there.
    const manyDiagnoses = Array.from({ length: 8 }, (_, i) => ({ code: `A0${i}` }));
    const validHighPointer = { ...c, diagnoses: manyDiagnoses, lines: [{ ...c.lines[0], dxPointers: [6] }] };
    const validResult = scrubClaim(validHighPointer);
    expect(validResult.edits.some((e) => e.id === "unlinked-service-line")).toBe(false);
  });
  it("computeKpis floors total A/R at zero instead of going negative on an overpaid account", () => {
    const kpis = computeKpis({ claims: [], denials: [], ledger: [{ id: "1", patientId: "p1", type: "charge", amount: 100, date: "2026-08-01", responsibleParty: "patient" }, { id: "2", patientId: "p1", type: "patient-payment", amount: 250, date: "2026-08-02", responsibleParty: "patient" }], remittances: [] });
    const ar = kpis.find((k) => k.key === "total_ar")!;
    expect(ar.value).toBe(0); // not -150
  });
  it("reopening a denied/expired auth clears its stale authNumber, validity window, and consumed units", () => {
    const approvedFresh = transitionAuth(transitionAuth(createAuthRequest({ patientId: "p1", coverageId: "c1", payerId: "BCBS", cpt: "70450", diagnoses: ["M54.16"] }), "requested", { actor: "t" }), "approved", { actor: "t", authNumber: "AUTH-OLD", validFrom: "2026-01-01", validTo: "2026-03-31", approvedUnits: 2 });
    const approved = consumeAuthUnit(approvedFresh, 1); // one of two units already used
    const expired = transitionAuth(approved, "expired", { actor: "t" });
    const reopened = transitionAuth(expired, "requested", { actor: "t" });
    expect(reopened.authNumber).toBeUndefined();
    expect(reopened.validFrom).toBeUndefined();
    expect(reopened.validTo).toBeUndefined();
    expect(reopened.unitsUsed).toBe(0); // the renewed cycle gets its own fresh allocation
    // A later approval that forgets to supply a fresh number must not silently inherit "AUTH-OLD".
    const reapproved = transitionAuth(reopened, "approved", { actor: "t" });
    expect(reapproved.authNumber).toBeUndefined();
  });
  it("parse271 normalizes vendor network-status aliases instead of passing through an arbitrary string", () => {
    expect(parse271({ network_status: "OON" }).networkStatus).toBe("out-of-network");
    expect(parse271({ network: "in_network" }).networkStatus).toBe("in-network");
    expect(parse271({ network_status: "Tier 1" }).networkStatus).toBe("unknown"); // not a status we understand — never silently treated as in-network
  });
  it("scrubber's duplicate-claim rule excludes the claim's own original (corrected-claim linkage) and scopes to the same payer/coverage", () => {
    const original = mkClaim();
    const corrected = correctedClaim(original, {});
    // The corrected claim legitimately overlaps its own original — must not flag as a duplicate.
    const resultVsOwnOriginal = scrubClaim(corrected, { priorClaimsSameDos: [original] });
    expect(resultVsOwnOriginal.edits.some((e) => e.id === "duplicate-claim")).toBe(false);
    // A claim to a DIFFERENT payer/coverage for the same visit (e.g. a legitimate secondary) must
    // not be flagged either.
    const otherPayerClaim = { ...mkClaim(), id: "other-payer-claim", payerId: "AETNA", coverageId: "c-aetna" };
    const resultVsOtherPayer = scrubClaim(original, { priorClaimsSameDos: [otherPayerClaim] });
    expect(resultVsOtherPayer.edits.some((e) => e.id === "duplicate-claim")).toBe(false);
    // But an unrelated claim for the SAME payer/coverage/CPT/date is still a real duplicate.
    const realDup = { ...mkClaim(), id: "real-dup" };
    const resultVsRealDup = scrubClaim(original, { priorClaimsSameDos: [realDup] });
    expect(resultVsRealDup.edits.some((e) => e.id === "duplicate-claim")).toBe(true);
  });
  it("RCM AI seam fails closed to the deterministic fallback instead of sending PHI-bearing prompts to a non-Vertex provider", async () => {
    const originalEnabled = process.env.RCM_AI_ENABLED;
    process.env.RCM_AI_ENABLED = "true";
    try {
      setFeatureProvider("rcm-test-misconfigured", "openai");
      const result = await aiText("system prompt", "user prompt", "deterministic fallback text", "rcm-test-misconfigured");
      expect(result.source).toBe("stub-fallback");
      expect(result.text).toBe("deterministic fallback text");
    } finally {
      process.env.RCM_AI_ENABLED = originalEnabled;
    }
  });
});

describe("round 11 hardening", () => {
  const T = "t-r11";
  beforeEach(() => rcmStore.reset(T));

  it("financialClearance also blocks on an unrecognized ('unknown') network status, not just an explicit out-of-network", () => {
    // source: "clearinghouse" isolates this test from the separate stub-vendor block below —
    // a stub-sourced snapshot would fail for that reason regardless of network status.
    const benefits: BenefitSnapshot = { active: true, networkStatus: "unknown", checkedAt: "2026-09-01T00:00:00Z", source: "clearinghouse" };
    const estimate = { estimatedAllowed: 100, copay: 0, deductibleApplied: 0, coinsurance: 0, patientResponsibility: 20, insuranceResponsibility: 80, assumptions: [] };
    const decision = financialClearance(benefits, estimate, []);
    expect(decision.cleared).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/network status/i);
    // A confirmed in-network status must still clear normally.
    expect(financialClearance({ ...benefits, networkStatus: "in-network" }, estimate, []).cleared).toBe(true);
  });

  it("parseEra normalizes a vendor payload that sends a single claim/service object instead of a one-element array", () => {
    const rem = parseEra({ payerid: "BCBS", check_amount: 100, claims: { pcn: "clm-solo", billed: 100, paid: 100, lines: { proc: "99214", billed: 100, paid: 100 } } });
    expect(rem.claims).toHaveLength(1);
    expect(rem.claims[0].claimId).toBe("clm-solo");
    expect(rem.claims[0].lines).toHaveLength(1);
    expect(rem.claims[0].lines[0].cpt).toBe("99214");
  });

  it("parseEra folds the check number into its fingerprint instead of skipping fingerprinting whenever one is present", () => {
    const base = { payerid: "BCBS", check_amount: 100, check_date: "2026-08-01", check_number: "CHK-100", claims: [{ pcn: "clm-1", billed: 100, paid: 100 }] };
    const a = parseEra(base);
    const b = parseEra(base);
    expect(a.id).toBe(b.id); // same content including check number -> same id, so a retry is recognized as a duplicate
    // A different check number on an otherwise-identical payload must get a different id.
    const c = parseEra({ ...base, check_number: "CHK-200" });
    expect(c.id).not.toBe(a.id);
  });

  it("scrubber's missing-em-25-modifier rule is scoped to the E/M line's own date of service on a multi-date claim", () => {
    const multiDate = {
      ...mkClaim(),
      lines: [
        { ...mkClaim().lines[0], dateOfService: "2026-07-01", modifiers: [] }, // E/M on day 1, no other same-day procedure
        { ...mkClaim().lines[1], dateOfService: "2026-07-05" }, // procedure on a different day
      ],
    };
    const result = scrubClaim(multiDate);
    expect(result.edits.some((e) => e.id === "missing-em-25-modifier")).toBe(false);
    // But a same-day procedure still correctly triggers the rule.
    const sameDate = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], modifiers: [] }, mkClaim().lines[1]] };
    expect(scrubClaim(sameDate).edits.some((e) => e.id === "missing-em-25-modifier")).toBe(true);
  });

  it("a corrected claim's denial only becomes 'appealed' once it is actually submitted to the payer, not merely staged clean", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const orig = mkClaim();
    await rcmStore.upsertClaim(T, orig);
    await rcmStore.upsertDenial(T, { id: "den-fc-1", claimId: orig.id, patientId: patient.id, payerId: "BCBS", carc: "4", group: "CO", amount: 300, category: "coding-mismatch", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const fcApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "file-corrected-claim", payload: { claimId: orig.id, denialId: "den-fc-1", amount: 300 }, reason: "test" });
    await rcmStore.decideApproval(T, fcApproval.id, "approved", "biller");
    const fcExec = await agentRuntime.executeApproved(T, fcApproval.id, "biller");
    expect(fcExec.ok).toBe(true);
    const correctedClaimId = (fcExec.output as { correctedClaimId: string }).correctedClaimId;
    // Staging a clean replacement claim for resubmission is not the same as the appeal actually
    // reaching the payer — the denial must stay "in-progress", not jump straight to "appealed".
    expect((await rcmStore.getDenial(T, "den-fc-1"))!.status).toBe("in-progress");
    let corrected = (await rcmStore.getClaim(T, correctedClaimId))!;
    expect(corrected.resolvesDenialId).toBe("den-fc-1");
    if (corrected.status !== "ready") { corrected = { ...corrected, status: "ready" }; await rcmStore.upsertClaim(T, corrected); }
    const submitApproval = await rcmStore.requestApproval(T, { agent: "claim-scrubber", action: "submit-claim", payload: { claimId: correctedClaimId, amount: corrected.totalCharge }, reason: "test" });
    await rcmStore.decideApproval(T, submitApproval.id, "approved", "biller");
    const submitExec = await agentRuntime.executeApproved(T, submitApproval.id, "biller");
    expect(submitExec.ok).toBe(true);
    // Only now, with the corrected claim actually submitted, does the denial become "appealed".
    expect((await rcmStore.getDenial(T, "den-fc-1"))!.status).toBe("appealed");
  });

  it("a corrected claim staged with no denial-specific patch is stranded at 'scrubbed' with a claim-edits work item, and applyClaimPatch is the real way back to 'ready'", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const orig = mkClaim();
    await rcmStore.upsertClaim(T, orig);
    await rcmStore.upsertDenial(T, { id: "den-fc-3", claimId: orig.id, patientId: patient.id, payerId: "BCBS", carc: "11", group: "CO", amount: 300, category: "coding-mismatch", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const fcApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "file-corrected-claim", payload: { claimId: orig.id, denialId: "den-fc-3", amount: 300 }, reason: "test" });
    await rcmStore.decideApproval(T, fcApproval.id, "approved", "biller");
    const fcExec = await agentRuntime.executeApproved(T, fcApproval.id, "biller");
    expect(fcExec.ok).toBe(true);
    const correctedClaimId = (fcExec.output as { correctedClaimId: string }).correctedClaimId;
    let corrected = (await rcmStore.getClaim(T, correctedClaimId))!;
    // No patch was supplied, so even though the unmodified clone re-scrubs clean, it must not be
    // auto-advanced to "ready" — that would silently resubmit the exact bill the payer denied.
    expect(corrected.status).toBe("scrubbed");
    expect(await rcmStore.findOpenWorkItem(T, (w) => w.queue === "claim-edits" && w.claimId === correctedClaimId)).toBeDefined();
    // A human now supplies the actual denial-specific correction (here: a corrected diagnosis
    // linkage for CARC 11) and re-scrubs — the same draft/scrubbed → ready path any edited claim
    // goes through, and the only real way to close out this work item.
    corrected = applyClaimPatch(corrected, { diagnoses: [{ code: "M25.561" }] });
    await rcmStore.upsertClaim(T, corrected);
    expect(corrected.totalCharge).toBe(orig.totalCharge);
    const result = scrubClaim(corrected);
    let next = corrected;
    if (result.clean && next.status === "scrubbed") next = transitionClaim(next, "ready", "biller", "clean after edit");
    await rcmStore.upsertClaim(T, next);
    expect(next.status).toBe("ready");
  });

  it("applyClaimPatch re-anchors the timely-filing deadline when the patch changes lines' date of service, the same way correctedClaim does", () => {
    const c = mkClaim();
    expect(c.timelyFilingDeadline).toBe("2026-09-29");
    // A later DOS must not inherit the old deadline (which would now fail timely-filing scrub
    // immediately); an earlier DOS must not silently borrow the later deadline either (which
    // would let it go out after its own real filing window).
    const laterDos = applyClaimPatch(c, { lines: c.lines.map((l) => ({ ...l, dateOfService: "2026-08-01" })) });
    expect(laterDos.timelyFilingDeadline).toBe(addDays("2026-08-01", 90));
    expect(laterDos.timelyFilingDeadline).not.toBe(c.timelyFilingDeadline);
    // A patch that doesn't touch lines at all must leave the deadline untouched.
    const noLineChange = applyClaimPatch(c, { priorAuthNumber: "AUTH-1" });
    expect(noLineChange.timelyFilingDeadline).toBe(c.timelyFilingDeadline);
  });

  it("send-appeal actually generates and stages the appeal letter as a work item instead of just flipping statuses with nothing produced", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const claim = { ...mkClaim(), status: "denied" as const };
    await rcmStore.upsertClaim(T, claim);
    await rcmStore.upsertDenial(T, { id: "den-appeal-1", claimId: claim.id, patientId: patient.id, payerId: "BCBS", carc: "50", group: "CO", amount: 300, category: "medical-necessity", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const tool = agentRuntime.get("denials")!.tools.find((t) => t.name === "send-appeal")!;
    const output = (await tool.run({ denialId: "den-appeal-1", claimId: claim.id, amount: 300 }, { tenantId: T, store: rcmStore, actor: "biller", dryRun: false, budget: { remaining: 5 } })) as { appealed: string; level: string };
    expect(output.appealed).toBe("den-appeal-1");
    expect((await rcmStore.getDenial(T, "den-appeal-1"))!.status).toBe("appealed");
    expect((await rcmStore.getClaim(T, claim.id))!.status).toBe("appealed");
    const item = await rcmStore.findOpenWorkItem(T, (w) => w.queue === "denials" && w.claimId === claim.id && w.context?.letter !== undefined);
    expect(item).toBeDefined();
    expect(String(item!.context!.letter)).toContain(claim.id);
  });

  it("file-corrected-claim and write-off can't both win a race against the same open denial", async () => {
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const orig = mkClaim();
    await rcmStore.upsertClaim(T, orig);
    await rcmStore.upsertDenial(T, { id: "den-race-2", claimId: orig.id, patientId: patient.id, payerId: "BCBS", carc: "4", group: "CO", amount: 300, category: "coding-mismatch", rootCause: "test", remediable: true, remediation: "test", preventionRuleIds: [], receivedAt: "2026-09-01", status: "open", priorityScore: 10 });
    const fcApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "file-corrected-claim", payload: { claimId: orig.id, denialId: "den-race-2", amount: 300 }, reason: "test" });
    const woApproval = await rcmStore.requestApproval(T, { agent: "denials", action: "write-off", payload: { denialId: "den-race-2", patientId: patient.id, amount: 300, reason: "test" }, reason: "test" });
    await rcmStore.decideApproval(T, fcApproval.id, "approved", "biller");
    await rcmStore.decideApproval(T, woApproval.id, "approved", "biller");
    // file-corrected-claim's own run does much longer async work (scrub/auth lookups) between
    // reading the denial and writing "in-progress" back than write-off's does — without holding
    // the lock for its whole run, a write-off that starts and finishes entirely inside that
    // window could have its "written-off" status silently overwritten by file-corrected-claim's
    // unconditional final write.
    const results = await Promise.all([
      agentRuntime.executeApproved(T, fcApproval.id, "biller"),
      agentRuntime.executeApproved(T, woApproval.id, "biller"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)!.error).toMatch(/already in flight/);
  });

  it("two concurrent open-auth-request calls for the same patient/coverage/CPT/date can't both win — one opens the request, the other is rejected as in-flight", async () => {
    // open-auth-request is deliberately not approval-gated (278 is an automated real-time
    // transaction, unlike claim submission/appeals), so it gets none of the runtime's own
    // approval-request dedup — without its own lock, two overlapping prior-auth runs planning
    // from the same stale `auths` snapshot could each open a duplicate 278 for the same service.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const tool = agentRuntime.get("prior-auth")!.tools.find((t) => t.name === "open-auth-request")!;
    const input = { patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01", units: 1 };
    const ctx = { tenantId: T, store: rcmStore, actor: "test", dryRun: false, budget: { remaining: 5 } };
    const results = await Promise.allSettled([tool.run(input, ctx), tool.run(input, ctx)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/already in flight/);
    expect((await rcmStore.listAuths(T, patient.id)).filter((a) => a.cpt === "97110")).toHaveLength(1);
  });

  it("open-auth-request never second-guesses plan()'s own decision with a business-state dedup — two sequential calls for the same key each open their own request, whatever their units", async () => {
    // Two different attempts at a "smart" recheck here (a raw units >= comparison, then an exact
    // units === match) each wrongly treated a pre-existing pending auth for the same key as
    // already covering a distinct, genuinely additional need — because a pending auth's capacity
    // can already be fully spoken for by a different line via plan()'s own pendingUnitsClaimed
    // accounting, which is pass-local and never persisted to the auth record itself. Nothing at
    // this tool's level can reliably tell that apart from a true duplicate, so it must not try:
    // plan() alone is responsible for deciding whether a step is needed at all, and every step
    // that reaches this tool must actually open a request. The in-process lock (tested separately
    // above) remains the only protection, and only against true concurrent overlap.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const tool = agentRuntime.get("prior-auth")!.tools.find((t) => t.name === "open-auth-request")!;
    const ctx = { tenantId: T, store: rcmStore, actor: "test", dryRun: false, budget: { remaining: 5 } };
    const base = { patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01" };
    // Identical repeated input (same units) — still must not dedupe.
    const identicalFirst = (await tool.run({ ...base, units: 1 }, ctx)) as { authId: string; deduped?: boolean };
    const identicalSecond = (await tool.run({ ...base, units: 1 }, ctx)) as { authId: string; deduped?: boolean };
    expect(identicalSecond.authId).not.toBe(identicalFirst.authId);
    expect(identicalFirst.deduped).toBeUndefined();
    expect(identicalSecond.deduped).toBeUndefined();
    // A different (smaller) incremental need for the same key — must also open its own request.
    const incremental = (await tool.run({ ...base, units: 2 }, ctx)) as { authId: string; deduped?: boolean };
    expect([identicalFirst.authId, identicalSecond.authId]).not.toContain(incremental.authId);
    expect(incremental.deduped).toBeUndefined();
    expect((await rcmStore.listAuths(T, patient.id)).filter((a) => a.cpt === "97110")).toHaveLength(3);
  });

  it("patient-financial agent advances an old self-pay balance to agency referral instead of resetting to statement-1 every run", async () => {
    // A self-pay charge is patient-responsible from the moment it's charged — no transfer-to-
    // patient entry is ever posted for it — so the collections clock must derive from the
    // charge's own date, not fall back to "today" (which would pin every self-pay account at
    // statement-1 forever and it would never reach agency referral).
    await rcmStore.upsertPatient(T, { id: "p-selfpay", firstName: "Self", lastName: "Pay", dob: "1980-01-01", sex: "F" });
    await rcmStore.postLedger(T, [{ id: "led-sp-1", patientId: "p-selfpay", type: "charge", amount: 500, date: "2026-01-01", responsibleParty: "patient" }]);
    const r = await agentRuntime.run("patient-financial", T);
    const referral = r.steps.find((s) => s.tool === "refer-to-agency" && s.input.patientId === "p-selfpay");
    expect(referral).toBeDefined();
  });

  it("prior-auth agent tracks cumulative units claimed against one pending request across lines in the same pass", async () => {
    // Two independent 1-unit lines on the SAME date of service (so they don't merge into one new
    // request before the pending-match check runs) must not both be silently skipped against the
    // SAME 1-unit pending auth for that date — the second line's units still need their own
    // request, merged with the first's leftover need since they share a date.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const pending = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01" }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, { ...pending, units: 1 });
    const claim1 = buildClaim({ encounterId: "e-pend-1", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    const claim2 = buildClaim({ encounterId: "e-pend-2", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim1);
    await rcmStore.upsertClaim(T, claim2);
    const r = await agentRuntime.run("prior-auth", T);
    const opens = r.steps.filter((s) => s.tool === "open-auth-request" && s.input.cpt === "97110");
    expect(opens).toHaveLength(1); // the first line's unit was claimed by the existing pending auth
    expect(opens[0].input.units).toBe(1); // only the second line's still-unclaimed unit is requested
  });
  it("prior-auth agent does not let a pending request opened for one date of service cover a different date's line", async () => {
    // A pending 278 opened for one visit must not be silently attributed to a different visit —
    // otherwise the original visit's own request could be starved while an unrelated later visit
    // is wrongly treated as already covered.
    await rcmStore.upsertPatient(T, patient);
    await rcmStore.upsertCoverage(T, coverage);
    const pending = transitionAuth(createAuthRequest({ patientId: patient.id, coverageId: coverage.id, payerId: "BCBS", cpt: "97110", diagnoses: ["M54.16"], dateOfService: "2026-09-01" }), "requested", { actor: "t" });
    await rcmStore.upsertAuth(T, { ...pending, units: 1 });
    const claim = buildClaim({ encounterId: "e-pend-3", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M54.16" }], lines: [{ cpt: "97110", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-10-15", placeOfService: "11" }] });
    await rcmStore.upsertClaim(T, claim);
    const r = await agentRuntime.run("prior-auth", T);
    const opens = r.steps.filter((s) => s.tool === "open-auth-request" && s.input.cpt === "97110");
    expect(opens).toHaveLength(1); // the 2026-09-01 pending request doesn't cover the 2026-10-15 line
    expect(opens[0].input.dateOfService).toBe("2026-10-15");
  });

  it("postRemittance recognizes a group-prefixed CO-45 CARC as a contractual adjustment, not a denial", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 240, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 240, patient_resp: 60, lines: [{ proc: "99214", billed: 300, paid: 150, patient_resp: 60, adjustments: [{ group: "CO", carc: "CO-45", amount: 90 }] }, { proc: "20610", billed: 150, paid: 90, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: 60 }] }] }] });
    const p = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(p.contractual).toBe(150); // both the "CO-45" and bare "45" forms counted as contractual
    expect(p.denied).toBe(0);
    expect(p.denials).toHaveLength(0);
  });

  it("postRemittance treats CLP02 status '4' as denied even when the vendor omitted a CARC adjustment, and actually starts the denial workflow", () => {
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 0, claims: [{ pcn: c.id, status: "4", billed: 450, paid: 0, patient_resp: 0 }] });
    const p = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(p.status).toBe("denied"); // not the generic "zero-pay" a missing CARC would otherwise produce
    // A status of "denied" with no entry in `denials` would never actually create a Denial record
    // (routes.ts only builds one per entry in this array) — synthesize a generic one so the claim
    // doesn't go "denied" with no appeal deadline, triage, or follow-up ever created for it.
    expect(p.denials).toHaveLength(1);
    expect(p.denials[0].amount).toBe(450);
    expect(p.denied).toBe(450);
  });

  it("postRemittance's CLP02 '4' fallback does not duplicate a real CARC that happened to net to zero, or double-count patient responsibility already transferred", () => {
    const c = mkClaim();
    // A real CARC IS present here (amount 0, e.g. a vendor sending an informational adjustment
    // with no dollar impact) — `denied` nets to 0 after the loop, but this must not be confused
    // with "no CARC at all" and trigger a second, synthetic denial on top of the real one.
    const remWithZeroCarc = parseEra({ payerid: "BCBS", check_amount: 0, claims: [{ pcn: c.id, status: "4", billed: 450, paid: 0, patient_resp: 0, lines: [{ proc: "99214", billed: 300, paid: 0, patient_resp: 0, adjustments: [{ group: "CO", carc: "197", amount: 0 }] }] }] });
    const pZeroCarc = postRemittance(remWithZeroCarc, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(pZeroCarc.denials).toHaveLength(1); // the real CARC 197, not a synthesized second one
    expect(pZeroCarc.denials[0].carc).toBe("197");
    // With genuinely no CARC at all but real patient responsibility already transferred, the
    // synthesized denial must only cover the undocumented portion, not double-count the transfer.
    const remWithPatientResp = parseEra({ payerid: "BCBS", check_amount: 0, claims: [{ pcn: c.id, status: "4", billed: 450, paid: 0, patient_resp: 50 }] });
    const pPatientResp = postRemittance(remWithPatientResp, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(pPatientResp.denials).toHaveLength(1);
    expect(pPatientResp.denials[0].amount).toBe(400); // 450 billed - 50 already transferred to patient
  });

  it("postRemittance still starts the denial workflow for a CLP02 '4' claim whose only adjustment is contractual (CO-45), not a denial CARC", () => {
    // The Round 13 fix's guard ("any adjustment present at all") was itself too broad — a denied
    // ERA carrying ONLY a contractual/PR adjustment with no denial-classified CARC would then
    // never synthesize anything, leaving `denials` empty and no route into the denial workflow.
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 0, claims: [{ pcn: c.id, status: "4", billed: 450, paid: 0, patient_resp: 0, lines: [{ proc: "99214", billed: 300, paid: 0, patient_resp: 0, adjustments: [{ group: "CO", carc: "45", amount: 100 }] }] }] });
    const p = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(p.status).toBe("denied");
    expect(p.denials).toHaveLength(1); // a real denial record still gets created
    expect(p.denials[0].carc).toBe("16");
    expect(p.denials[0].amount).toBe(350); // 450 billed - 100 already accounted for as contractual
  });

  it("computeKpis derives days-in-AR from charges actually inside the period window, not the lifetime ledger", () => {
    const c = mkClaim();
    // A large charge from well over a year ago must not inflate the 90-day average daily rate —
    // with no charges in the trailing 90 days, the rate (and thus days-in-AR) must reflect that.
    const staleOnly = computeKpis({ claims: [c], denials: [], ledger: [{ id: "1", patientId: "p1", type: "charge", amount: 100000, date: "2024-01-01", responsibleParty: "insurance" }], remittances: [], today: "2026-09-05", periodDays: 90 });
    const staleK = Object.fromEntries(staleOnly.map((x) => [x.key, x]));
    expect(staleK.days_in_ar.value).toBe(0); // no charges in the period => no rate to divide by
    // The same lifetime charge plus a small recent one must use only the recent one for the
    // daily rate — a huge, mostly-uncollected legacy balance against a thin recent billing rate
    // should correctly read as a very high days-in-AR (a real backlog signal), not the
    // artificially low number the old lifetime-average bug produced by treating the entire
    // $100,900 lifetime total as if it were representative of a 90-day billing rate (which would
    // have understated this to roughly 90 days instead of the true ~10,090).
    const withRecent = computeKpis({ claims: [c], denials: [], ledger: [{ id: "1", patientId: "p1", type: "charge", amount: 100000, date: "2024-01-01", responsibleParty: "insurance" }, { id: "2", patientId: "p1", type: "charge", amount: 900, date: "2026-08-01", responsibleParty: "insurance" }], remittances: [], today: "2026-09-05", periodDays: 90 });
    const withRecentK = Object.fromEntries(withRecent.map((x) => [x.key, x]));
    expect(withRecentK.days_in_ar.value).toBe(10090); // (100000+900 AR) / (900/90 daily rate)
  });
});

describe("round 14 hardening", () => {
  it("scrubber's ncci-bundling rule only flags a pair on the SAME date of service, and matches lowercase CPTs", () => {
    // 20610/96372 is a seeded NCCI PTP pair (modifierIndicator 1).
    const sameDate = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: [] }] };
    expect(scrubClaim(sameDate).edits.some((e) => e.id === "ncci-bundling")).toBe(true);
    const differentDates = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-05", modifiers: [] }] };
    expect(scrubClaim(differentDates).edits.some((e) => e.id === "ncci-bundling")).toBe(false); // different visits — NCCI PTP doesn't apply across dates
    const lowercase = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: [] }] };
    expect(scrubClaim(lowercase).edits.some((e) => e.id === "ncci-bundling")).toBe(true); // still flags with mismatched CPT case
  });
  it("scrubber's ncci-bundling rule flags every occurrence of the component code on the pair's date, not just the first", () => {
    const claim = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: [] }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: [] }] };
    const flagged = scrubClaim(claim).edits.filter((e) => e.id === "ncci-bundling");
    expect(flagged.map((e) => e.lineNumber).sort()).toEqual([2, 3]); // both 96372 lines flagged, not just the first
  });
});

describe("round 18 hardening", () => {
  it("scrubber's ncci-bundling rule no longer accepts global-period/E-M modifiers (57/24/78/79/91) as a PTP bypass", () => {
    const claim = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: ["57"] }] };
    expect(scrubClaim(claim).edits.some((e) => e.id === "ncci-bundling")).toBe(true); // modifier 57 doesn't establish a distinct service
    // A genuine distinct-service modifier still bypasses.
    const withBypass = { ...mkClaim(), lines: [{ ...mkClaim().lines[0], cpt: "20610", dateOfService: "2026-07-01" }, { ...mkClaim().lines[1], cpt: "96372", dateOfService: "2026-07-01", modifiers: ["59"] }] };
    expect(scrubClaim(withBypass).edits.some((e) => e.id === "ncci-bundling")).toBe(false);
  });

  it("postRemittance does not flag an underpayment for a denied or reversed claim", () => {
    const c = mkClaim();
    // Fully denied: zero paid, a real denial CARC, and a contract — must not also open an
    // underpayments work item for the whole expected allowed amount.
    const denied = parseEra({ payerid: "BCBS", check_amount: 0, claims: [{ pcn: c.id, status: "1", billed: 450, paid: 0, patient_resp: 0, lines: [{ proc: "99214", billed: 300, paid: 0, patient_resp: 0, adjustments: [{ group: "CO", carc: "50", amount: 300 }] }] }] });
    const pDenied = postRemittance(denied, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(pDenied.status).toBe("denied");
    expect(pDenied.underpayment).toBeUndefined();
    // A reversal (takeback) is also not a fee-schedule underpayment.
    const reversal = parseEra({ check_amount: -50, claims: [{ pcn: c.id, status: "22", billed: 450, paid: -50, patient_resp: 0 }] });
    const pReversal = postRemittance(reversal, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(pReversal.status).toBe("reversal");
    expect(pReversal.underpayment).toBeUndefined();
  });

  it("parseEra's fingerprint distinguishes two ERAs that share payer/total/date/claim-ids but allocate the money differently", () => {
    const base = { payerid: "BCBS", check_amount: 200, check_date: "2026-08-01", claims: [{ pcn: "clm-1", billed: 300, paid: 100, patient_resp: 20 }, { pcn: "clm-2", billed: 200, paid: 100, patient_resp: 0 }] };
    const a = parseEra(base);
    // Same payer/total/date/claim-id-set, but the $200 is split differently across the two claims.
    const differentAllocation = { ...base, claims: [{ pcn: "clm-1", billed: 300, paid: 150, patient_resp: 0 }, { pcn: "clm-2", billed: 200, paid: 50, patient_resp: 20 }] };
    const b = parseEra(differentAllocation);
    expect(a.id).not.toBe(b.id);
  });

  it("postRemittance's CLP02 '4' fallback excludes the actual payment from the synthesized denial residual", () => {
    // A partially-denied claim: $20 paid on a $100 billed line, no parsed CARC for the remainder.
    const c = mkClaim();
    const rem = parseEra({ payerid: "BCBS", check_amount: 20, claims: [{ pcn: c.id, status: "4", billed: 100, paid: 20, patient_resp: 0 }] });
    const p = postRemittance(rem, { [c.id]: c }, { BCBS: bcbs }).postings[0];
    expect(p.denials).toHaveLength(1);
    expect(p.denials[0].amount).toBe(80); // 100 billed - 20 paid, not the full 100
  });

  it("claims state machine allows a partially-paid claim to complete to paid or resolve to denied via a later ERA", () => {
    expect(canTransition("partially-paid", "paid")).toBe(true);
    expect(canTransition("partially-paid", "denied")).toBe(true);
    // A staggered installment remittance that pays down more of the balance without fully
    // resolving it lands on "partially-paid" again — without allowing this self-transition, the
    // canTransition-based skip in /remittance/post would treat every remittance after the first
    // as illegal and silently never post its cash (while still recording the ERA as posted,
    // making the payment unretryable).
    expect(canTransition("partially-paid", "partially-paid")).toBe(true);
  });
  it("claims state machine allows a zero-pay correction to land on 'adjudicated' right after a reversal already did", () => {
    // Both a reversal and a zero-pay posting (full contractual write-off or full patient
    // responsibility, nothing denied) map to "adjudicated" — a reversal-and-correction pair
    // within one ERA where the correction is itself zero-pay needs this self-transition, same as
    // "partially-paid" needed one for staggered installments.
    expect(canTransition("adjudicated", "adjudicated")).toBe(true);
  });
});
