// RCM front-end + mid-cycle: eligibility, prior auth, charge capture, coding, scrubber.
import { describe, it, expect } from "vitest";
import { build270, checkEligibility, detectDiscrepancies, estimatePatientResponsibility, financialClearance, parse271, eligibilityIsStale } from "../server/rcm/eligibility";
import { authCoversService, build278, consumeAuthUnit, createAuthRequest, requiresPriorAuth, slaBreached, transitionAuth } from "../server/rcm/prior-auth";
import { deriveCharges, detectChargeGaps, parseVoiceCharge, voiceCommandsToLines } from "../server/rcm/charge-capture";
import { levelEm, mdmLevel, parseCodingSuggestion, reviewIcd } from "../server/rcm/coding";
import { applyAutoFixes, scrubClaim } from "../server/rcm/scrubber";
import { buildClaim } from "../server/rcm/claims";
import { DEFAULT_CONTRACTS } from "../server/rcm/contracts";
import { isValidNpi } from "../server/rcm/util";
import type { Coverage, Patient } from "../server/rcm/types";

const patient: Patient = { id: "p1", firstName: "Asha", lastName: "Demo", dob: "1968-03-14", sex: "F" };
const coverage: Coverage = { id: "c1", patientId: "p1", payerId: "BCBS", payerName: "BCBS PPO", memberId: "XYZ123", priority: "primary", subscriberRelationship: "self", effectiveDate: "2026-01-01", timelyFilingDays: 90 };

describe("eligibility", () => {
  it("builds a 270 for self subscriber and dependent", () => {
    const self = build270({ patient, coverage, dateOfService: "2026-09-01", providerNpi: "1234567893" });
    expect(self.subscriber.memberId).toBe("XYZ123");
    expect(self.dependent).toBeUndefined();
    const dep = build270({ patient, coverage: { ...coverage, subscriberRelationship: "child", subscriberFirstName: "Raj", subscriberLastName: "Demo", subscriberDob: "1940-01-01" }, dateOfService: "2026-09-01", providerNpi: "1234567893" });
    expect(dep.dependent?.relationshipCode).toBe("19");
    expect(dep.subscriber.firstName).toBe("Raj");
  });
  it("stub vendor returns active benefits; terminated coverage is inactive without a vendor call", async () => {
    const b = await checkEligibility({ patient, coverage, dateOfService: "2026-09-01", providerNpi: "1234567893" });
    expect(b.active).toBe(true);
    expect(b.source).toBe("stub");
    const term = await checkEligibility({ patient, coverage: { ...coverage, terminationDate: "2026-06-30" }, dateOfService: "2026-09-01", providerNpi: "1234567893" });
    expect(term.active).toBe(false);
    expect(term.source).toBe("manual");
  });
  it("parses a vendor 271 defensively", () => {
    const b = parse271({ eligible: "1", plan_name: "Gold PPO", copay: "$30", deductible_remaining: "250.00", coinsurance: 20 });
    expect(b.active).toBe(true);
    expect(b.copayOfficeVisit).toBe(30);
    expect(b.deductibleRemaining).toBe(250);
    expect(b.source).toBe("clearinghouse");
  });
  it("estimates patient responsibility: copay + deductible + coinsurance, capped at OOP", () => {
    const benefits = { active: true, copayOfficeVisit: 30, coinsurancePct: 20, deductibleRemaining: 50, oopMaxRemaining: 1000, checkedAt: new Date().toISOString(), source: "stub" as const };
    const est = estimatePatientResponsibility([{ cpt: "99214", units: 1 }], benefits, { "99214": 150 });
    expect(est.estimatedAllowed).toBe(150);
    expect(est.copay).toBe(30);
    expect(est.deductibleApplied).toBe(50);
    expect(est.coinsurance).toBe(14); // (150-30-50)*20%
    expect(est.patientResponsibility).toBe(94);
    expect(est.insuranceResponsibility).toBe(56);
    const capped = estimatePatientResponsibility([{ cpt: "99214", units: 1 }], { ...benefits, oopMaxRemaining: 40 }, { "99214": 150 });
    expect(capped.patientResponsibility).toBe(40);
  });
  it("detects registration/payer discrepancies and blocks clearance", () => {
    const disc = detectDiscrepancies({ firstName: "Asha", lastName: "Demo", dob: "1968-03-14", memberId: "XYZ123" }, { lastName: "Demo-Kumar", memberId: "xyz 123" });
    expect(disc.map((d) => d.field)).toEqual(["lastName"]);
    const clearance = financialClearance({ active: true, checkedAt: "", source: "stub" }, { estimatedAllowed: 0, copay: 0, deductibleApplied: 0, coinsurance: 0, patientResponsibility: 25, insuranceResponsibility: 0, assumptions: [] }, disc, { requiresAuth: true, authOnFile: false });
    expect(clearance.cleared).toBe(false);
    expect(clearance.reasons).toHaveLength(2);
    expect(clearance.collectAtVisit).toBe(25);
  });
  it("flags stale snapshots", () => {
    expect(eligibilityIsStale(undefined)).toBe(true);
    expect(eligibilityIsStale({ active: true, checkedAt: "2026-01-01T00:00:00Z", source: "stub" }, "2026-09-01")).toBe(true);
    expect(eligibilityIsStale({ active: true, checkedAt: "2026-08-25T00:00:00Z", source: "stub" }, "2026-09-01")).toBe(false);
  });
});

describe("prior auth", () => {
  it("applies rules, contract lists, and gold-carding", () => {
    expect(requiresPriorAuth("72148").required).toBe(true);
    expect(requiresPriorAuth("99213").required).toBe(false);
    const uhc = DEFAULT_CONTRACTS.find((c) => c.payerId === "UHC")!;
    expect(requiresPriorAuth("72148", uhc)).toMatchObject({ required: false, goldCarded: true });
    expect(requiresPriorAuth("E0601", uhc).required).toBe(true);
  });
  it("tracks lifecycle, SLA, units and validity", () => {
    let a = createAuthRequest({ patientId: "p1", coverageId: "c1", payerId: "BCBS", cpt: "72148", diagnoses: ["M54.16"], units: 2, availableDocs: ["Imaging order"] });
    expect(a.missingDocumentation).toContain("6 weeks conservative therapy");
    a = transitionAuth(a, "requested", { actor: "t" });
    expect(a.slaDeadline).toBeDefined();
    expect(slaBreached(a, new Date(Date.parse(a.requestedAt!) + 8 * 86_400_000).toISOString())).toBe(true);
    a = transitionAuth(a, "approved", { actor: "t", authNumber: "A1", validFrom: "2026-09-01", validTo: "2026-10-01" });
    expect(authCoversService(a, "72148", "2026-09-15").ok).toBe(true);
    expect(authCoversService(a, "72148", "2026-10-15").ok).toBe(false);
    a = consumeAuthUnit(a, 2);
    expect(a.status).toBe("exhausted");
    const x = build278(a, "XYZ123", "1234567893", "2026-09-01", "2026-10-01");
    expect(x.serviceLines[0].cpt).toBe("72148");
  });
});

describe("charge capture", () => {
  it("derives E/M with -25 when a procedure is billed, plus vaccine admin units", () => {
    const lines = deriveCharges({ encounterId: "e", patientId: "p1", dateOfService: "2026-09-01", placeOfService: "11", renderingNpi: "1234567893", newPatient: false, emLevel: 4, proceduresDocumented: ["20610"], ordersCompleted: ["36415"], vaccinesGiven: 2, diagnoses: [{ code: "M17.11" }, { code: "E11.9" }] });
    const em = lines.find((l) => l.cpt === "99214")!;
    expect(em.modifiers).toContain("25");
    expect(lines.map((l) => l.cpt)).toEqual(expect.arrayContaining(["20610", "36415", "90471", "90472"]));
    expect(lines.find((l) => l.cpt === "90472")!.units).toBe(1);
    expect(lines.every((l) => l.charge > 0)).toBe(true);
  });
  it("uses telehealth POS + modifier 95", () => {
    const lines = deriveCharges({ encounterId: "e", patientId: "p1", dateOfService: "2026-09-01", placeOfService: "11", renderingNpi: "1234567893", newPatient: true, telehealth: true, emLevel: 3, proceduresDocumented: [], ordersCompleted: [], vaccinesGiven: 0, diagnoses: [{ code: "J06.9" }] });
    expect(lines[0]).toMatchObject({ cpt: "99203", placeOfService: "10", modifiers: ["95"] });
  });
  it("detects missing, orphan and lagging charges", () => {
    const facts = { encounterId: "e", patientId: "p1", dateOfService: "2026-09-01", placeOfService: "11", renderingNpi: "1234567893", newPatient: false, emLevel: 3 as const, proceduresDocumented: ["69210"], ordersCompleted: [], vaccinesGiven: 0, diagnoses: [{ code: "H61.21" }] };
    const gaps = detectChargeGaps(facts, [{ id: "x", cpt: "12001", modifiers: [], units: 1, charge: 100, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }], { enteredAt: "2026-09-10" });
    expect(gaps.map((g) => g.kind).sort()).toEqual(["charge-lag", "missing-charge", "no-em", "orphan-charge"]);
  });
  it("parses voice charge commands with modifiers, units and spoken ICD-10", () => {
    const cmds = parseVoiceCharge("Add 99214 with modifier 25 and 95, diagnosis E11 point 9 and I10, and two units of 90472");
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatchObject({ cpt: "99214", modifiers: ["25", "95"], units: 1 });
    expect(cmds[0].diagnoses).toEqual(["E11.9", "I10"]);
    expect(cmds[1]).toMatchObject({ cpt: "90472", units: 2 });
    const built = voiceCommandsToLines(cmds, { dateOfService: "2026-09-01", placeOfService: "11", renderingNpi: "1234567893", diagnoses: [] });
    expect(built.diagnoses.map((d) => d.code)).toEqual(["E11.9", "I10"]);
    expect(built.lines[0].dxPointers).toEqual([1, 2]);
  });
});

describe("coding", () => {
  it("levels by MDM (2 of 3 elements) and by time when higher", () => {
    const base = { problems: [{ severity: "chronic-exacerbation" as const }], uniqueTestsOrderedOrReviewed: 3, externalNotesReviewed: 0, independentHistorian: false, independentInterpretation: false, discussionWithExternalPhysician: false, risk: "moderate" as const, newPatient: false };
    expect(mdmLevel(base).level).toBe("moderate");
    expect(levelEm(base)).toMatchObject({ code: "99214", basis: "mdm" });
    expect(levelEm({ ...base, totalTimeMinutes: 42 })).toMatchObject({ code: "99215", basis: "time" });
    expect(levelEm({ ...base, totalTimeMinutes: 70 }).prolongedServiceUnits).toBe(2);
    expect(levelEm({ ...base, newPatient: true }).code).toBe("99204");
    expect(levelEm({ problems: [{ severity: "self-limited" }], uniqueTestsOrderedOrReviewed: 0, externalNotesReviewed: 0, independentHistorian: false, independentInterpretation: false, discussionWithExternalPhysician: false, risk: "minimal", newPatient: false }).code).toBe("99212");
  });
  it("reviews ICD specificity and HCC opportunities", () => {
    const f = reviewIcd(["E11.9", "M17.11", "ZZZ"], ["I50.22"]);
    expect(f.find((x) => x.code === "E11.9")?.kind).toBe("unspecified");
    expect(f.find((x) => x.code === "ZZZ")?.kind).toBe("invalid");
    expect(f.find((x) => x.code === "I50.22")?.kind).toBe("hcc-opportunity");
  });
  it("parses AI coding JSON strictly and drops invalid codes", () => {
    const s = parseCodingSuggestion('```json{"em":{"code":"99214","rationale":"r"},"icd":[{"code":"E11.65","description":"d"},{"code":"bad!","description":"x"}],"queries":["laterality?"]}```', "vertex");
    expect(s.em.code).toBe("99214");
    expect(s.icd).toHaveLength(1);
    expect(s.queries).toEqual(["laterality?"]);
  });
});

describe("scrubber", () => {
  const mk = (over: Partial<Parameters<typeof buildClaim>[0]> = {}) => buildClaim({ encounterId: "e", patient, coverage, billingNpi: "1234567893", renderingNpi: "1234567893", placeOfService: "11", diagnoses: [{ code: "M17.11" }], lines: [{ cpt: "99214", modifiers: [], units: 1, charge: 300, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "20610", modifiers: [], units: 1, charge: 150, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }], ...over });
  it("validates NPIs with Luhn", () => { expect(isValidNpi("1234567893")).toBe(true); expect(isValidNpi("1234567890")).toBe(false); });
  it("finds missing -25 and auto-fixes it", () => {
    const claim = mk();
    const r = scrubClaim(claim, { patient, coverage, today: "2026-09-05" });
    expect(r.errors.map((e) => e.id)).toContain("missing-em-25-modifier");
    const fixed = applyAutoFixes(claim, r.edits);
    expect(fixed.applied).toContain("missing-em-25-modifier");
    const r2 = scrubClaim(fixed.claim, { patient, coverage, today: "2026-09-05" });
    expect(r2.clean).toBe(true);
    expect(r2.score).toBeGreaterThan(r.score);
  });
  it("catches bundling, timely filing, coverage, auth and demographic edits", () => {
    const claim = mk({ diagnoses: [{ code: "N40.1" }, { code: "E11" }], lines: [{ cpt: "99397", modifiers: ["25"], units: 1, charge: 200, dxPointers: [1, 2], dateOfService: "2026-03-01", placeOfService: "11" }, { cpt: "12002", modifiers: [], units: 1, charge: 150, dxPointers: [1], dateOfService: "2026-03-01", placeOfService: "11" }, { cpt: "12001", modifiers: [], units: 1, charge: 120, dxPointers: [9], dateOfService: "2026-03-01", placeOfService: "11" }, { cpt: "72148", modifiers: ["ZZ"], units: 1, charge: 900, dxPointers: [1], dateOfService: "2026-03-01", placeOfService: "99" }] });
    const r = scrubClaim(claim, { patient, coverage: { ...coverage, terminationDate: "2026-02-01" }, today: "2026-09-05", authRequiredCpts: ["72148"] });
    const ids = new Set(r.edits.map((e) => e.id));
    for (const id of ["ncci-bundling", "timely-filing", "coverage-terminated", "auth-missing", "age-inappropriate-cpt", "sex-inappropriate-icd", "unknown-modifier", "pos-format", "unlinked-service-line", "icd-specificity"]) expect(ids.has(id), id).toBe(true);
    expect(r.clean).toBe(false);
  });
  it("accepts NCCI bypass with a distinct-service modifier and flags telehealth POS without 95", () => {
    const claim = mk({ lines: [{ cpt: "12002", modifiers: [], units: 1, charge: 150, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "12001", modifiers: ["59"], units: 1, charge: 120, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "11" }, { cpt: "99213", modifiers: ["25"], units: 1, charge: 200, dxPointers: [1], dateOfService: "2026-09-01", placeOfService: "10" }] });
    const r = scrubClaim(claim, { patient, coverage, today: "2026-09-05" });
    expect(r.edits.map((e) => e.id)).not.toContain("ncci-bundling");
    expect(r.warnings.map((e) => e.id)).toContain("telehealth-modifier-pos");
  });
});
