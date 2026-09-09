// Stage 17: revenue-cycle analytics — MGMA/HFMA-style KPIs with targets, A/R aging by payer,
// denial and clean-claim rates, charge lag, cost-to-collect proxy, and payer scorecards.
import type { Claim, Denial, LedgerEntry, Remittance } from "./types";
import { computeAging } from "./patient-financials";
import { daysBetween, round2, sum, todayIso } from "./util";

export interface Kpi { key: string; name: string; value: number; unit: "days" | "pct" | "usd" | "count"; target: number; direction: "lower-better" | "higher-better"; status: "good" | "warning" | "critical"; definition: string }

function status(value: number, target: number, direction: Kpi["direction"], tolerancePct = 15): Kpi["status"] {
  const ok = direction === "lower-better" ? value <= target : value >= target;
  if (ok) return "good";
  const drift = Math.abs(value - target) / Math.max(1, Math.abs(target));
  return drift <= tolerancePct / 100 ? "warning" : "critical";
}

export interface KpiInputs {
  claims: Claim[];
  denials: Denial[];
  ledger: LedgerEntry[];
  remittances: Remittance[];
  chargeEntryLagDays?: number[]; // per-charge lag samples
  scrubFirstPassClean?: number; // count of claims clean on first scrub
  scrubTotal?: number;
  today?: string;
  periodDays?: number; // for average daily charges
  costToCollectUsd?: number; // billing dept cost in the period
}

export function computeKpis(i: KpiInputs): Kpi[] {
  const today = i.today ?? todayIso();
  const period = i.periodDays ?? 90;
  const charges = sum(i.ledger.filter((e) => e.type === "charge").map((e) => e.amount));
  const insurancePaid = sum(i.ledger.filter((e) => e.type === "insurance-payment").map((e) => e.amount));
  const patientPaid = sum(i.ledger.filter((e) => e.type === "patient-payment").map((e) => e.amount));
  const contractual = sum(i.ledger.filter((e) => e.type === "contractual-adjustment").map((e) => e.amount));
  const writeOffs = sum(i.ledger.filter((e) => e.type === "write-off" || e.type === "denial-adjustment").map((e) => e.amount));
  const refunds = sum(i.ledger.filter((e) => e.type === "refund").map((e) => e.amount));
  const collected = round2(insurancePaid + patientPaid - refunds);
  const ar = round2(charges - collected - contractual - writeOffs);
  const avgDailyCharges = charges / Math.max(1, period);
  const daysInAr = avgDailyCharges > 0 ? round2(ar / avgDailyCharges) : 0;
  const aging = computeAging(i.ledger, today);
  const arOver90 = aging.total > 0 ? round2(((aging.d91_120 + aging.over120) / aging.total) * 100) : 0;
  const submitted = i.claims.filter((c) => c.submittedAt).length;
  const deniedClaims = new Set(i.denials.map((d) => d.claimId)).size;
  const denialRate = submitted > 0 ? round2((deniedClaims / submitted) * 100) : 0;
  const cleanRate = i.scrubTotal ? round2(((i.scrubFirstPassClean ?? 0) / i.scrubTotal) * 100) : 0;
  const firstPass = submitted > 0 ? round2(((submitted - deniedClaims - i.claims.filter((c) => c.status === "rejected").length) / submitted) * 100) : 0;
  const netCollection = charges - contractual > 0 ? round2((collected / (charges - contractual)) * 100) : 0;
  const grossCollection = charges > 0 ? round2((collected / charges) * 100) : 0;
  const chargeLag = i.chargeEntryLagDays?.length ? round2(i.chargeEntryLagDays.reduce((a, b) => a + b, 0) / i.chargeEntryLagDays.length) : 0;
  const overturned = i.denials.filter((d) => d.status === "overturned").length;
  const appealed = i.denials.filter((d) => ["appealed", "overturned", "upheld"].includes(d.status)).length;
  const appealWin = appealed ? round2((overturned / appealed) * 100) : 0;
  const costToCollect = i.costToCollectUsd !== undefined && collected > 0 ? round2((i.costToCollectUsd / collected) * 100) : 0;
  const badDebt = charges > 0 ? round2((writeOffs / charges) * 100) : 0;
  const patientCollectionRate = (() => { const t = sum(i.ledger.filter((e) => e.type === "transfer-to-patient").map((e) => e.amount)); return t > 0 ? round2((patientPaid / t) * 100) : 0; })();
  const rows: Array<Omit<Kpi, "status">> = [
    { key: "days_in_ar", name: "Days in A/R", value: daysInAr, unit: "days", target: 35, direction: "lower-better", definition: "Total A/R ÷ average daily charges" },
    { key: "ar_over_90", name: "A/R > 90 days", value: arOver90, unit: "pct", target: 15, direction: "lower-better", definition: "Share of open A/R older than 90 days" },
    { key: "clean_claim_rate", name: "Clean claim rate", value: cleanRate, unit: "pct", target: 95, direction: "higher-better", definition: "Claims passing scrub with zero errors on first pass" },
    { key: "first_pass_resolution", name: "First-pass resolution rate", value: firstPass, unit: "pct", target: 90, direction: "higher-better", definition: "Submitted claims paid without denial/rejection" },
    { key: "denial_rate", name: "Initial denial rate", value: denialRate, unit: "pct", target: 5, direction: "lower-better", definition: "Denied claims ÷ submitted claims" },
    { key: "appeal_overturn_rate", name: "Appeal overturn rate", value: appealWin, unit: "pct", target: 60, direction: "higher-better", definition: "Overturned ÷ appealed denials" },
    { key: "net_collection_rate", name: "Net collection rate", value: netCollection, unit: "pct", target: 96, direction: "higher-better", definition: "Collections ÷ (charges − contractual adjustments)" },
    { key: "gross_collection_rate", name: "Gross collection rate", value: grossCollection, unit: "pct", target: 40, direction: "higher-better", definition: "Collections ÷ gross charges" },
    { key: "charge_lag", name: "Charge lag", value: chargeLag, unit: "days", target: 2, direction: "lower-better", definition: "Days from service to charge entry" },
    { key: "patient_collection_rate", name: "Patient collection rate", value: patientCollectionRate, unit: "pct", target: 70, direction: "higher-better", definition: "Patient payments ÷ patient responsibility transferred" },
    { key: "bad_debt", name: "Bad debt / write-off %", value: badDebt, unit: "pct", target: 3, direction: "lower-better", definition: "Non-contractual write-offs ÷ charges" },
    { key: "cost_to_collect", name: "Cost to collect", value: costToCollect, unit: "pct", target: 3, direction: "lower-better", definition: "Billing cost ÷ collections" },
    { key: "total_ar", name: "Total A/R", value: ar, unit: "usd", target: 0, direction: "lower-better", definition: "Open receivables" },
  ];
  return rows.map((r) => ({ ...r, status: r.key === "total_ar" ? "good" : status(r.value, r.target, r.direction) }));
}

export function agingByPayer(claims: Claim[], today: string = todayIso()): Array<{ payerId: string; payerName: string; buckets: { current: number; d31_60: number; d61_90: number; over90: number }; total: number; count: number }> {
  const map = new Map<string, { payerName: string; buckets: { current: number; d31_60: number; d61_90: number; over90: number }; total: number; count: number }>();
  for (const c of claims) {
    if (!["submitted", "acknowledged", "pended", "partially-paid", "denied", "appealed"].includes(c.status)) continue;
    const row = map.get(c.payerId) ?? { payerName: c.payerName, buckets: { current: 0, d31_60: 0, d61_90: 0, over90: 0 }, total: 0, count: 0 };
    const d = daysBetween((c.submittedAt ?? c.createdAt).slice(0, 10), today);
    const k = d <= 30 ? "current" : d <= 60 ? "d31_60" : d <= 90 ? "d61_90" : "over90";
    row.buckets[k] = round2(row.buckets[k] + c.totalCharge);
    row.total = round2(row.total + c.totalCharge);
    row.count++;
    map.set(c.payerId, row);
  }
  return Array.from(map.entries()).map(([payerId, r]) => ({ payerId, ...r })).sort((a, b) => b.total - a.total);
}

export function payerScorecard(claims: Claim[], denials: Denial[], remittances: Remittance[]): Array<{ payerId: string; payerName: string; claims: number; denialRate: number; avgDaysToPay: number; paidRatio: number }> {
  const byPayer = new Map<string, Claim[]>();
  for (const c of claims) byPayer.set(c.payerId, [...(byPayer.get(c.payerId) ?? []), c]);
  return Array.from(byPayer.entries()).map(([payerId, cs]) => {
    const denied = new Set(denials.filter((d) => d.payerId === payerId).map((d) => d.claimId)).size;
    const paidClaims = cs.filter((c) => (c.status === "paid" || c.status === "partially-paid") && c.submittedAt);
    const days = paidClaims.map((c) => { const paidAt = c.history.find((h) => h.status === "paid" || h.status === "partially-paid")?.at ?? c.lastStatusAt; return daysBetween(c.submittedAt!.slice(0, 10), paidAt.slice(0, 10)); });
    const billed = sum(cs.map((c) => c.totalCharge));
    const paid = sum(remittances.filter((r) => r.payerId === payerId).flatMap((r) => r.claims.map((rc) => rc.paid)));
    return { payerId, payerName: cs[0].payerName, claims: cs.length, denialRate: cs.length ? round2((denied / cs.length) * 100) : 0, avgDaysToPay: days.length ? round2(days.reduce((a, b) => a + b, 0) / days.length) : 0, paidRatio: billed ? round2((paid / billed) * 100) : 0 };
  });
}
