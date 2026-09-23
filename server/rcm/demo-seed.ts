// Synthetic demo dataset for the RCM Command Center (NO real PHI — fictional names/ids).
import type { RcmStore } from "./store";
import { buildClaim, transitionClaim } from "./claims";
import { denialFromAdjustment } from "./denials";
import { itemsFromDenials } from "./worklists";
import { addDays, todayIso } from "./util";
import type { Claim, LedgerEntry, Patient } from "./types";

export async function seedDemoTenant(store: RcmStore, tenantId: string): Promise<{ patients: number; claims: number; denials: number }> {
  const today = todayIso();
  const patients: Patient[] = [
    { id: "pt-demo-1", mrn: "MRN-1001", firstName: "Asha", lastName: "Demo", dob: "1968-03-14", sex: "F", householdSize: 3, annualHouseholdIncome: 42000 },
    { id: "pt-demo-2", mrn: "MRN-1002", firstName: "Miguel", lastName: "Sample", dob: "1955-11-02", sex: "M" },
    { id: "pt-demo-3", mrn: "MRN-1003", firstName: "Priya", lastName: "Test", dob: "1990-07-21", sex: "F", householdSize: 1, annualHouseholdIncome: 18000 },
    { id: "pt-demo-4", mrn: "MRN-1004", firstName: "Dana", lastName: "Credit", dob: "1982-05-05", sex: "U" },
  ];
  for (const p of patients) await store.upsertPatient(tenantId, p);
  const coverages = [
    { id: "cov-demo-1", patientId: "pt-demo-1", payerId: "BCBS", payerName: "Blue Cross Blue Shield PPO", memberId: "XYZ123456789", groupNumber: "GRP100", planType: "PPO" as const, priority: "primary" as const, subscriberRelationship: "self" as const, effectiveDate: "2026-01-01", timelyFilingDays: 90 },
    { id: "cov-demo-2", patientId: "pt-demo-2", payerId: "MEDICARE", payerName: "Medicare Part B", memberId: "1EG4TE5MK72", planType: "Medicare" as const, priority: "primary" as const, subscriberRelationship: "self" as const, effectiveDate: "2020-11-01", timelyFilingDays: 365 },
    { id: "cov-demo-3", patientId: "pt-demo-3", payerId: "UHC", payerName: "UnitedHealthcare", memberId: "UHC998877", planType: "HMO" as const, priority: "primary" as const, subscriberRelationship: "self" as const, effectiveDate: "2026-01-01", terminationDate: addDays(today, -40), timelyFilingDays: 90 },
  ];
  for (const c of coverages) await store.upsertCoverage(tenantId, c);

  const mk = (patientId: string, coverageId: string, dos: string, lines: Array<[string, string[], number]>, dx: string[]): Claim => {
    const patient = patients.find((p) => p.id === patientId)!;
    const coverage = coverages.find((c) => c.id === coverageId)!;
    return buildClaim({ encounterId: `enc-${patientId}-${dos}`, patient, coverage, billingNpi: "1234567893", billingTaxId: "12-3456789", renderingNpi: "1234567893", renderingProviderName: "Dr. Demo Provider", placeOfService: "11", diagnoses: dx.map((code) => ({ code })), lines: lines.map(([cpt, modifiers, charge], i) => ({ id: `ln-${patientId}-${i}`, cpt, modifiers, units: 1, charge, dxPointers: [1], dateOfService: dos, placeOfService: "11", renderingNpi: "1234567893" })) });
  };

  const c1 = mk("pt-demo-1", "cov-demo-1", addDays(today, -3), [["99214", [], 320], ["20610", [], 180]], ["M17.11", "E11.9"]); // draft: missing -25 → scrub finds it
  let c2 = mk("pt-demo-2", "cov-demo-2", addDays(today, -45), [["99213", [], 225], ["93000", [], 45]], ["I10", "I48.91"]);
  c2 = transitionClaim(transitionClaim(transitionClaim(c2, "scrubbed", "seed"), "ready", "seed"), "submitted", "seed");
  c2 = { ...c2, submittedAt: addDays(today, -44) + "T12:00:00.000Z" }; // stale → follow-up
  let c3 = mk("pt-demo-3", "cov-demo-3", addDays(today, -20), [["99215", [], 450]], ["J44.1"]);
  c3 = transitionClaim(transitionClaim(transitionClaim(transitionClaim(c3, "scrubbed", "seed"), "ready", "seed"), "submitted", "seed"), "denied", "seed", "CARC 27");
  let c4 = mk("pt-demo-1", "cov-demo-1", addDays(today, -60), [["99213", [], 225], ["36415", [], 8], ["80053", [], 30]], ["E11.9"]);
  c4 = transitionClaim(transitionClaim(transitionClaim(transitionClaim(c4, "scrubbed", "seed"), "ready", "seed"), "submitted", "seed"), "paid", "seed");
  let c5 = mk("pt-demo-2", "cov-demo-2", addDays(today, -30), [["72148", [], 900]], ["M54.16"]);
  c5 = transitionClaim(transitionClaim(transitionClaim(transitionClaim(c5, "scrubbed", "seed"), "ready", "seed"), "submitted", "seed"), "denied", "seed", "CARC 197");
  for (const c of [c1, c2, c3, c4, c5]) await store.upsertClaim(tenantId, c);

  const d1 = denialFromAdjustment(c3, { group: "CO", carc: "27", amount: 450 }, { appealDays: 180, receivedAt: addDays(today, -5) + "T00:00:00.000Z" });
  const d2 = denialFromAdjustment(c5, { group: "CO", carc: "197", rarc: "N54", amount: 900 }, { appealDays: 120, receivedAt: addDays(today, -10) + "T00:00:00.000Z" });
  const d3 = denialFromAdjustment(c4, { group: "CO", carc: "97", amount: 8 }, { appealDays: 180, receivedAt: addDays(today, -30) + "T00:00:00.000Z" });
  for (const d of [d1, d2, d3]) await store.upsertDenial(tenantId, d);
  await store.addWorkItems(tenantId, itemsFromDenials([d1, d2, d3]));

  const ledger: LedgerEntry[] = [
    { id: "led-1", patientId: "pt-demo-1", claimId: c4.id, type: "charge", amount: 263, date: addDays(today, -60), memo: "Office visit + labs", responsibleParty: "insurance" },
    { id: "led-2", patientId: "pt-demo-1", claimId: c4.id, type: "insurance-payment", amount: 140.5, date: addDays(today, -35), memo: "BCBS EFT 88213", responsibleParty: "insurance" },
    { id: "led-3", patientId: "pt-demo-1", claimId: c4.id, type: "contractual-adjustment", amount: 74.5, date: addDays(today, -35), memo: "CARC 45", responsibleParty: "insurance" },
    { id: "led-4", patientId: "pt-demo-1", claimId: c4.id, type: "transfer-to-patient", amount: 40, date: addDays(today, -35), memo: "Copay + coinsurance", responsibleParty: "patient" },
    { id: "led-5", patientId: "pt-demo-1", claimId: c1.id, type: "charge", amount: 500, date: addDays(today, -3), memo: "Office visit + injection", responsibleParty: "insurance" },
    { id: "led-6", patientId: "pt-demo-2", claimId: c2.id, type: "charge", amount: 270, date: addDays(today, -45), memo: "Office visit + ECG", responsibleParty: "insurance" },
    { id: "led-7", patientId: "pt-demo-2", claimId: c5.id, type: "charge", amount: 900, date: addDays(today, -30), memo: "MRI lumbar", responsibleParty: "insurance" },
    { id: "led-8", patientId: "pt-demo-3", claimId: c3.id, type: "charge", amount: 450, date: addDays(today, -20), memo: "Office visit", responsibleParty: "insurance" },
    { id: "led-9", patientId: "pt-demo-3", type: "patient-payment", amount: 60, date: addDays(today, -15), memo: "Card at check-in", responsibleParty: "patient" },
    { id: "led-10", patientId: "pt-demo-3", type: "patient-payment", amount: 60, date: addDays(today, -14), memo: "Duplicate card payment", responsibleParty: "patient" },
    { id: "led-11", patientId: "pt-demo-3", claimId: c3.id, type: "transfer-to-patient", amount: 100, date: addDays(today, -10), memo: "Ineligible on DOS", responsibleParty: "patient" },
    // Credit-balance case: self-pay visit paid twice (duplicate card capture) → refund workflow.
    { id: "led-12", patientId: "pt-demo-4", type: "charge", amount: 150, date: addDays(today, -12), memo: "Self-pay office visit", responsibleParty: "patient" },
    { id: "led-13", patientId: "pt-demo-4", type: "transfer-to-patient", amount: 150, date: addDays(today, -12), memo: "Self-pay", responsibleParty: "patient" },
    { id: "led-14", patientId: "pt-demo-4", type: "patient-payment", amount: 150, date: addDays(today, -12), memo: "Card at check-in", responsibleParty: "patient" },
    { id: "led-15", patientId: "pt-demo-4", type: "patient-payment", amount: 150, date: addDays(today, -11), memo: "Duplicate card capture", responsibleParty: "patient" },
  ];
  await store.postLedger(tenantId, ledger);
  await store.recordScrub(tenantId, true); await store.recordScrub(tenantId, true); await store.recordScrub(tenantId, false); await store.recordScrub(tenantId, true);
  for (const d of [1, 2, 1, 4, 0]) await store.recordChargeLag(tenantId, d);
  return { patients: patients.length, claims: 5, denials: 3 };
}
