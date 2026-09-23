// Stage 11b: payer contract management — expected reimbursement, underpayment variance,
// contract modeling (what-if on rate changes), and default contract seeds.
import type { PayerContract, ServiceLine } from "./types";
import { feeRow } from "./reference-data";
import { round2, sum } from "./util";

export const DEFAULT_CONTRACTS: PayerContract[] = [
  { payerId: "MEDICARE", payerName: "Medicare Part B", effectiveDate: "2026-01-01", timelyFilingDays: 365, appealDays: 120, feeSchedule: {}, pctOfMedicare: 100, requiresAuth: [] },
  { payerId: "MEDICAID", payerName: "State Medicaid", effectiveDate: "2026-01-01", timelyFilingDays: 180, appealDays: 60, feeSchedule: {}, pctOfMedicare: 72, requiresAuth: ["70450", "72148", "97110"] },
  { payerId: "BCBS", payerName: "Blue Cross Blue Shield PPO", effectiveDate: "2026-01-01", timelyFilingDays: 90, appealDays: 180, feeSchedule: {}, pctOfMedicare: 135, requiresAuth: ["70450", "72148", "70553", "78452", "J0135", "J1745", "64483"] },
  { payerId: "UHC", payerName: "UnitedHealthcare", effectiveDate: "2026-01-01", timelyFilingDays: 90, appealDays: 180, feeSchedule: {}, pctOfMedicare: 125, requiresAuth: ["70450", "72148", "70553", "78452", "J0135", "J1745", "E0601", "K0823"], goldCardCpts: ["72148"] },
  { payerId: "AETNA", payerName: "Aetna", effectiveDate: "2026-01-01", timelyFilingDays: 120, appealDays: 180, feeSchedule: {}, pctOfMedicare: 128, requiresAuth: ["70450", "72148", "70553", "J0135", "J1745"] },
];

// Multiple-procedure and modifier payment rules (common commercial/Medicare conventions).
function modifierMultiplier(modifiers: string[]): number {
  const m = modifiers.map((x) => x.toUpperCase());
  let mult = 1;
  if (m.includes("50")) mult *= 1.5;
  if (m.includes("52")) mult *= 0.5;
  if (m.includes("53")) mult *= 0.5;
  if (m.includes("26")) mult *= 0.4;
  if (m.includes("TC")) mult *= 0.6;
  if (m.includes("80") || m.includes("81") || m.includes("82")) mult *= 0.16;
  if (m.includes("AS")) mult *= 0.14;
  return mult;
}

export function expectedAllowed(contract: PayerContract, cpt: string, units = 1, modifiers: string[] = []): number {
  const code = cpt.toUpperCase();
  const explicit = contract.feeSchedule[code];
  const ref = feeRow(code)?.medicareAllowed;
  const base = explicit ?? (ref !== undefined ? ref * ((contract.pctOfMedicare ?? 100) / 100) : 0);
  return round2(base * Math.max(1, units) * modifierMultiplier(modifiers));
}

// Multiple-procedure reduction (100% for the highest-valued surgical procedure, 50% for the
// rest), returned per line in the same order as `lines` so callers needing a per-line
// breakdown (variance reporting) and callers only needing the claim-level total can share it.
function expectedPerLine(contract: PayerContract, lines: Pick<ServiceLine, "cpt" | "units" | "modifiers">[]): number[] {
  const base = lines.map((l) => expectedAllowed(contract, l.cpt, l.units, l.modifiers));
  const surgicalIdx = lines.map((l, i) => (/^[1-6]\d{4}$/.test(l.cpt) && !/^9\d{4}$/.test(l.cpt) ? i : -1)).filter((i) => i >= 0);
  const rankedDesc = [...surgicalIdx].sort((a, b) => base[b] - base[a]);
  return base.map((amt, i) => (surgicalIdx.includes(i) && rankedDesc.indexOf(i) > 0 ? round2(amt * 0.5) : amt));
}

export function expectedForLines(contract: PayerContract, lines: Pick<ServiceLine, "cpt" | "units" | "modifiers">[]): number {
  return sum(expectedPerLine(contract, lines));
}

export interface VarianceRow { cpt: string; expected: number; actual: number; variance: number; pct: number }

export function varianceReport(contract: PayerContract, lines: Array<{ cpt: string; units: number; modifiers: string[]; allowed: number }>): { rows: VarianceRow[]; totalVariance: number; underpaid: boolean } {
  // Use the same multiple-procedure-reduced expected amount as expectedForLines — comparing
  // against the unreduced per-line rate would flag a correctly-paid multi-procedure claim as
  // underpaid.
  const expectedPerLineAmounts = expectedPerLine(contract, lines);
  const rows = lines.map((l, i) => { const expected = expectedPerLineAmounts[i]; const variance = round2(expected - l.allowed); return { cpt: l.cpt, expected, actual: l.allowed, variance, pct: expected ? round2((variance / expected) * 100) : 0 }; });
  const totalVariance = sum(rows.map((r) => r.variance));
  return { rows, totalVariance, underpaid: totalVariance > 1 };
}

// Contract modeling: apply a proposed % change (or per-CPT overrides) to historical volume.
export function modelContractChange(contract: PayerContract, volume: Array<{ cpt: string; units: number }>, proposal: { pctChange?: number; overrides?: Record<string, number> }): { currentRevenue: number; proposedRevenue: number; delta: number; deltaPct: number } {
  const current = sum(volume.map((v) => expectedAllowed(contract, v.cpt, v.units)));
  const proposed: PayerContract = { ...contract, feeSchedule: { ...contract.feeSchedule, ...(proposal.overrides ?? {}) }, pctOfMedicare: proposal.pctChange !== undefined ? (contract.pctOfMedicare ?? 100) * (1 + proposal.pctChange / 100) : contract.pctOfMedicare };
  const proposedRevenue = sum(volume.map((v) => expectedAllowed(proposed, v.cpt, v.units)));
  const delta = round2(proposedRevenue - current);
  return { currentRevenue: current, proposedRevenue, delta, deltaPct: current ? round2((delta / current) * 100) : 0 };
}
