// Stage 13-16: patient financial experience — statements with FIFO aging, propensity-to-pay,
// payment plans, collections workflow (with holds), financial assistance / sliding fee (FPL),
// No Surprises Act Good Faith Estimate, credit balances & refunds, small-balance write-off.
import type { LedgerEntry, Patient, ServiceLine } from "./types";
import { FPL_BASE, FPL_PER_ADDITIONAL, feeRow } from "./reference-data";
import { addDays, daysBetween, newId, round2, sum, todayIso } from "./util";

const CREDIT_TYPES = new Set<LedgerEntry["type"]>(["insurance-payment", "patient-payment", "contractual-adjustment", "denial-adjustment", "write-off"]);

export function signedAmount(e: LedgerEntry): number {
  if (e.type === "charge") return e.amount;
  if (e.type === "refund") return e.amount; // refund re-debits the account
  if (e.type === "transfer-to-patient") return 0; // reclassification, not a balance change
  return CREDIT_TYPES.has(e.type) ? -e.amount : 0;
}

export interface AccountSummary { patientId: string; charges: number; insurancePaid: number; patientPaid: number; adjustments: number; refunds: number; balance: number; patientBalance: number; insuranceBalance: number }

export function computeAccount(patientId: string, entries: LedgerEntry[]): AccountSummary {
  const mine = entries.filter((e) => e.patientId === patientId);
  const by = (t: LedgerEntry["type"]) => sum(mine.filter((e) => e.type === t).map((e) => e.amount));
  const charges = by("charge");
  const insurancePaid = by("insurance-payment");
  const patientPaid = by("patient-payment");
  const adjustments = sum([by("contractual-adjustment"), by("denial-adjustment"), by("write-off")]);
  const refunds = by("refund");
  const balance = round2(charges - insurancePaid - patientPaid - adjustments + refunds);
  const transferred = by("transfer-to-patient");
  const patientBalance = round2(Math.max(0, transferred - patientPaid + refunds > balance ? balance : transferred - patientPaid + refunds));
  return { patientId, charges, insurancePaid, patientPaid, adjustments, refunds, balance, patientBalance: Math.max(patientBalance, 0), insuranceBalance: round2(Math.max(0, balance - Math.max(patientBalance, 0))) };
}

export interface Aging { current: number; d31_60: number; d61_90: number; d91_120: number; over120: number; total: number }

// FIFO aging: credits retire the oldest open charges first.
export function computeAging(entries: LedgerEntry[], today: string = todayIso()): Aging {
  const charges = entries.filter((e) => e.type === "charge").sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, open: e.amount }));
  let credits = sum(entries.filter((e) => signedAmount(e) < 0).map((e) => e.amount)) - sum(entries.filter((e) => e.type === "refund").map((e) => e.amount));
  for (const c of charges) { const take = Math.min(c.open, Math.max(0, credits)); c.open = round2(c.open - take); credits -= take; }
  const a: Aging = { current: 0, d31_60: 0, d61_90: 0, d91_120: 0, over120: 0, total: 0 };
  for (const c of charges) {
    if (c.open <= 0) continue;
    const d = daysBetween(c.date, today);
    if (d <= 30) a.current += c.open; else if (d <= 60) a.d31_60 += c.open; else if (d <= 90) a.d61_90 += c.open; else if (d <= 120) a.d91_120 += c.open; else a.over120 += c.open;
  }
  for (const k of Object.keys(a) as (keyof Aging)[]) a[k] = round2(a[k]);
  a.total = sum([a.current, a.d31_60, a.d61_90, a.d91_120, a.over120]);
  return a;
}

export interface Statement { patientId: string; generatedAt: string; dueDate: string; summary: AccountSummary; aging: Aging; lines: Array<{ date: string; description: string; charge?: number; credit?: number }>; amountDue: number; cycle: 1 | 2 | 3 | "final"; message: string }

export function buildStatement(patient: Patient, entries: LedgerEntry[], cycle: Statement["cycle"] = 1, today: string = todayIso()): Statement {
  const summary = computeAccount(patient.id, entries);
  const aging = computeAging(entries.filter((e) => e.patientId === patient.id), today);
  const lines = entries.filter((e) => e.patientId === patient.id).sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, description: e.memo ?? e.type.replace(/-/g, " "), charge: signedAmount(e) > 0 ? e.amount : undefined, credit: signedAmount(e) < 0 ? e.amount : undefined }));
  const messages: Record<string, string> = { "1": "Thank you for choosing us. Your insurance has processed this visit; the amount below is your responsibility.", "2": "Reminder: your balance is past due. Payment plans and financial assistance are available.", "3": "Second reminder: please pay or contact us to arrange a plan within 30 days.", final: "Final notice: unpaid balances may be referred to a collection agency after 30 days." };
  return { patientId: patient.id, generatedAt: today, dueDate: addDays(today, 30), summary, aging, lines, amountDue: summary.patientBalance, cycle, message: messages[String(cycle)] };
}

export type PropensityBand = "high" | "medium" | "low" | "assistance-eligible";

export function propensityToPay(input: { balance: number; priorStatementsPaidOnTime: number; priorStatementsLate: number; hasCardOnFile: boolean; fplPct?: number }): { band: PropensityBand; score: number; recommendedChannel: "text-to-pay" | "email" | "paper" | "call" | "financial-counseling" } {
  if (input.fplPct !== undefined && input.fplPct <= 200) return { band: "assistance-eligible", score: 0, recommendedChannel: "financial-counseling" };
  let score = 50;
  score += Math.min(30, input.priorStatementsPaidOnTime * 10);
  score -= Math.min(30, input.priorStatementsLate * 10);
  if (input.hasCardOnFile) score += 15;
  if (input.balance > 1000) score -= 10; else if (input.balance < 100) score += 10;
  score = Math.max(0, Math.min(100, score));
  const band: PropensityBand = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { band, score, recommendedChannel: band === "high" ? "text-to-pay" : band === "medium" ? "email" : "call" };
}

export interface PaymentPlan { id: string; patientId: string; total: number; installment: number; months: number; startDate: string; schedule: Array<{ dueDate: string; amount: number; status: "scheduled" | "paid" | "missed" }>; autoPay: boolean }

export function createPaymentPlan(patientId: string, total: number, months: number, startDate: string = todayIso(), autoPay = false, minInstallment = 25): PaymentPlan {
  const m = Math.max(1, Math.min(months, Math.floor(total / minInstallment) || 1));
  const installment = round2(total / m);
  const schedule = Array.from({ length: m }, (_, i) => ({ dueDate: addDays(startDate, 30 * i), amount: i === m - 1 ? round2(total - installment * (m - 1)) : installment, status: "scheduled" as const }));
  return { id: newId("pp"), patientId, total, installment, months: m, startDate, schedule, autoPay };
}

export type CollectionsStage = "statement-1" | "statement-2" | "statement-3" | "final-notice" | "agency-referral" | "hold";

export function collectionsStage(firstStatementDate: string, opts: { onPaymentPlan?: boolean; disputeOpen?: boolean; assistancePending?: boolean; today?: string } = {}): { stage: CollectionsStage; nextActionDate: string; reason: string } {
  const today = opts.today ?? todayIso();
  if (opts.onPaymentPlan) return { stage: "hold", nextActionDate: addDays(today, 30), reason: "Active payment plan" };
  if (opts.disputeOpen) return { stage: "hold", nextActionDate: addDays(today, 14), reason: "Open dispute/itemized bill request" };
  if (opts.assistancePending) return { stage: "hold", nextActionDate: addDays(today, 14), reason: "Financial assistance application pending" };
  const d = daysBetween(firstStatementDate, today);
  if (d < 30) return { stage: "statement-1", nextActionDate: addDays(firstStatementDate, 30), reason: "First statement cycle" };
  if (d < 60) return { stage: "statement-2", nextActionDate: addDays(firstStatementDate, 60), reason: "Second statement" };
  if (d < 90) return { stage: "statement-3", nextActionDate: addDays(firstStatementDate, 90), reason: "Third statement" };
  if (d < 120) return { stage: "final-notice", nextActionDate: addDays(firstStatementDate, 120), reason: "Final notice; 30 days before referral" };
  return { stage: "agency-referral", nextActionDate: today, reason: "120+ days; eligible for agency referral (requires approval)" };
}

export function fplPercent(annualIncome: number, householdSize: number): number {
  const fpl = FPL_BASE + Math.max(0, householdSize - 1) * FPL_PER_ADDITIONAL;
  return round2((annualIncome / fpl) * 100);
}

export function slidingFeeDiscount(fplPct: number): { discountPct: number; tier: string } {
  if (fplPct <= 100) return { discountPct: 100, tier: "A (≤100% FPL): nominal fee" };
  if (fplPct <= 150) return { discountPct: 80, tier: "B (101-150% FPL)" };
  if (fplPct <= 200) return { discountPct: 60, tier: "C (151-200% FPL)" };
  if (fplPct <= 250) return { discountPct: 40, tier: "D (201-250% FPL)" };
  if (fplPct <= 300) return { discountPct: 20, tier: "E (251-300% FPL)" };
  return { discountPct: 0, tier: "Full fee" };
}

// No Surprises Act Good Faith Estimate for uninsured / self-pay patients.
export interface GoodFaithEstimate { id: string; patientId: string; scheduledDate?: string; items: Array<{ cpt: string; description: string; units: number; amount: number }>; total: number; disclaimers: string[]; expiresAt: string; deliverBy: string }

export function goodFaithEstimate(patient: Patient, lines: Pick<ServiceLine, "cpt" | "units">[], selfPayRates: Record<string, number>, scheduledDate?: string, today: string = todayIso()): GoodFaithEstimate {
  const items = lines.map((l) => { const rate = selfPayRates[l.cpt] ?? feeRow(l.cpt)?.medicareAllowed ?? 0; return { cpt: l.cpt, description: feeRow(l.cpt)?.description ?? l.cpt, units: l.units, amount: round2(rate * l.units) }; });
  const total = sum(items.map((i) => i.amount));
  const lead = scheduledDate ? daysBetween(today, scheduledDate) : 0;
  const deliverBy = scheduledDate ? (lead >= 10 ? addDays(scheduledDate, -3) : lead >= 3 ? addDays(today, 1) : today) : addDays(today, 3);
  return {
    id: newId("gfe"),
    patientId: patient.id,
    scheduledDate,
    items,
    total,
    disclaimers: [
      "This Good Faith Estimate shows the costs of items and services reasonably expected for your health care needs. It is not a contract.",
      "If billed charges exceed this estimate by $400 or more, you may dispute the bill through the patient-provider dispute resolution process.",
      "The estimate is based on information known at the time; actual items or services may differ.",
    ],
    expiresAt: addDays(today, 365),
    deliverBy,
  };
}

export interface CreditBalance { patientId: string; amount: number; source: "overpayment-patient" | "overpayment-insurance" | "duplicate-payment"; refundTo: "patient" | "payer"; requiresApproval: boolean }

export function detectCreditBalances(entriesByPatient: Record<string, LedgerEntry[]>, threshold = 1): CreditBalance[] {
  const out: CreditBalance[] = [];
  for (const [patientId, entries] of Object.entries(entriesByPatient)) {
    const s = computeAccount(patientId, entries);
    if (s.balance < -threshold) {
      const patientPaid = sum(entries.filter((e) => e.type === "patient-payment").map((e) => e.amount));
      const source: CreditBalance["source"] = patientPaid >= -s.balance ? "overpayment-patient" : "overpayment-insurance";
      out.push({ patientId, amount: round2(-s.balance), source, refundTo: source === "overpayment-patient" ? "patient" : "payer", requiresApproval: -s.balance >= 25 });
    }
  }
  return out;
}

export function smallBalanceWriteOffs(entriesByPatient: Record<string, LedgerEntry[]>, threshold = 5): Array<{ patientId: string; amount: number }> {
  return Object.entries(entriesByPatient).map(([patientId, entries]) => ({ patientId, amount: computeAccount(patientId, entries).patientBalance })).filter((x) => x.amount > 0 && x.amount <= threshold);
}
