// Stage 13-16: patient financial experience — statements with FIFO aging, propensity-to-pay,
// payment plans, collections workflow (with holds), financial assistance / sliding fee (FPL),
// No Surprises Act Good Faith Estimate, credit balances & refunds, small-balance write-off.
import type { LedgerEntry, Patient, ServiceLine } from "./types";
import { FPL_BASE, FPL_PER_ADDITIONAL, feeRow } from "./reference-data";
import { addBusinessDays, addDays, businessDaysBetween, daysBetween, newId, round2, sum, todayIso } from "./util";

const CREDIT_TYPES = new Set<LedgerEntry["type"]>(["insurance-payment", "patient-payment", "contractual-adjustment", "denial-adjustment", "write-off"]);

export function signedAmount(e: LedgerEntry): number {
  if (e.type === "charge") return e.amount;
  if (e.type === "refund") return e.amount; // refund re-debits the account
  if (e.type === "transfer-to-patient") return 0; // reclassification, not a balance change
  return CREDIT_TYPES.has(e.type) ? -e.amount : 0;
}

export interface AccountSummary { patientId: string; charges: number; insurancePaid: number; patientPaid: number; adjustments: number; refunds: number; balance: number; patientBalance: number; insuranceBalance: number }

export function computeAccount(patientId: string, entries: LedgerEntry[]): AccountSummary {
  // Sorted by date, not left in whatever order the store returns them (insertion/append order,
  // which can diverge from chronological order — e.g. a remittance posted today can carry an
  // older `date` than an entry already in the ledger). The totals below don't care about order
  // (addition commutes), but the transfer-to-patient cap in the second pass does: it caps against
  // whatever `insuranceSide` happens to be AT THAT POINT in the iteration, so an insurance-payment
  // processed before its own remittance's transfer-to-patient (purely because of insertion order)
  // would shrink the pool the transfer caps against before the transfer ever sees it, silently
  // capping a legitimate patient-responsibility transfer to less than it should be. Array.sort is
  // a stable sort, so same-date entries keep their original relative (insertion) order as the
  // deterministic tie-break.
  const mine = entries.filter((e) => e.patientId === patientId).sort((a, b) => a.date.localeCompare(b.date));
  const by = (t: LedgerEntry["type"]) => sum(mine.filter((e) => e.type === t).map((e) => e.amount));
  const charges = by("charge");
  const insurancePaid = by("insurance-payment");
  const patientPaid = by("patient-payment");
  const adjustments = sum([by("contractual-adjustment"), by("denial-adjustment"), by("write-off")]);
  const refunds = by("refund");
  const balance = round2(charges - insurancePaid - patientPaid - adjustments + refunds);

  // Split the balance by who currently owes it, using each entry's own `responsibleParty`
  // rather than approximating from transfers/payments alone. A charge starts on whichever side
  // its own responsibleParty says (a self-pay charge starts on the patient side directly, an
  // insurance-billed charge starts on the insurance side until transfer-to-patient moves it);
  // every other entry (payment, contractual adjustment, denial write-off, patient-side
  // write-off, refund) already carries the side it settles. transfer-to-patient only moves an
  // amount that is actually still sitting on the insurance side, capped so it can never double
  // count a charge that was already patient-side from the start or push insurance negative.
  // Two passes, not one: totaling every charge FIRST (order-independent — addition commutes)
  // before applying any transfer means a transfer's cap always sees the charge it's transferring
  // against, regardless of which one happens to come first in the ledger array (a caller-ordered
  // POST /ledger, or any other non-chronological arrangement).
  let insuranceSide = 0;
  let patientSide = 0;
  for (const e of mine) {
    if (e.type !== "charge") continue;
    if (e.responsibleParty === "patient") patientSide += e.amount;
    else insuranceSide += e.amount;
  }
  for (const e of mine) {
    if (e.type === "charge") continue;
    if (e.type === "transfer-to-patient") { const move = Math.min(e.amount, Math.max(0, insuranceSide)); insuranceSide -= move; patientSide += move; continue; }
    const amt = signedAmount(e);
    if (e.responsibleParty === "patient") patientSide += amt;
    else insuranceSide += amt;
  }
  // Not clamped to nonnegative: a reversal (or an outright overpayment) can leave one side with
  // a credit rather than a balance owed. Clamping it away here would make patientBalance +
  // insuranceBalance stop summing to the overall `balance` above, and would silently discard a
  // patient-side credit — e.g. a takeback that reverses a copay obligation the patient already
  // paid — that the account genuinely owes back. Every caller that expects a nonnegative "amount
  // owed" already guards for that (a write-off/payment-plan cap that requires > 0, a statement
  // that can reasonably show a negative "amount due" as a credit).
  const patientBalance = round2(patientSide);
  const insuranceBalance = round2(insuranceSide);
  return { patientId, charges, insurancePaid, patientPaid, adjustments, refunds, balance, patientBalance, insuranceBalance };
}

export interface Aging { current: number; d31_60: number; d61_90: number; d91_120: number; over120: number; total: number }

// FIFO aging: credits retire the oldest open charges first.
export function computeAging(entries: LedgerEntry[], today: string = todayIso()): Aging {
  const charges = entries.filter((e) => e.type === "charge").sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, open: e.amount }));
  // Filter on CREDIT_TYPES, not `signedAmount(e) < 0`: a credit-type entry's own `amount` is
  // ordinarily positive (contributing `-signedAmount(e)` = a positive amount to the pool), but an
  // ERA reversal can post one of these types (e.g. contractual-adjustment) with a NEGATIVE amount
  // to unwind an earlier write-off — that entry's signedAmount is positive, so filtering on
  // `signedAmount(e) < 0` would silently drop it from this calculation entirely, leaving the
  // original write-off's charge looking retired even after the reversal takes it back.
  let credits = sum(entries.filter((e) => CREDIT_TYPES.has(e.type)).map((e) => -signedAmount(e))) - sum(entries.filter((e) => e.type === "refund").map((e) => e.amount));
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

// Shared in-process lock, keyed `${tenantId}:${patientId}`, for every entry point that can create
// a payment plan for a patient: the offer-payment-plan agent tool and the direct
// POST /patients/:id/payment-plan route. A plan can be created from either one, so a lock private
// to just one of those modules (as each originally had) doesn't serialize the other — both could
// pass their own "no active plan" check and each insert a schedule before either's write lands.
// Exported from here, rather than declared separately in routes.ts/agents/index.ts, specifically
// so both share the same Set instance.
export const paymentPlanLocks = new Set<string>();

// Shared in-process lock, keyed `${tenantId}:${patientId}`, for every entry point that reads a
// patient's current ledger balance/credit and then posts an entry (or authorizes a schedule)
// derived from it: the patient-financial agent tools (issue-refund, small-balance-write-off,
// offer-payment-plan), the denials agent tools (write-off, transfer-to-patient — their own
// denialActionLocks only serializes actions on the SAME denial, not two different open denials
// racing on the same claim/patient), and the direct POST /ledger, POST /remittance/post, and
// POST /patients/:id/payment-plan routes (the last of these is ALSO keyed into paymentPlanLocks
// above, for the same-key reason paymentPlanLocks itself exists). Any two of these racing for the
// SAME patient can
// each read the same pre-mutation balance before either writes, and each proceed as if the full
// amount were still available — over-refunding, over-forgiving, or double-applying a payment
// against a balance that already moved. Exported from here, rather than declared separately in
// routes.ts/agents/index.ts, specifically so all of them share the same Set instance (mirrors
// paymentPlanLocks above, which closed the same class of gap for payment plans).
export const patientLedgerLocks = new Set<string>();

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
export interface GoodFaithEstimate { id: string; patientId: string; scheduledDate?: string; items: Array<{ cpt: string; description: string; units: number; amount: number; ratePending?: boolean }>; total: number; missingRateCpts: string[]; disclaimers: string[]; expiresAt: string; deliverBy: string }

export function goodFaithEstimate(patient: Patient, lines: Pick<ServiceLine, "cpt" | "units">[], selfPayRates: Record<string, number>, scheduledDate?: string, today: string = todayIso()): GoodFaithEstimate {
  // A CPT with no self-pay rate and no reference allowable must not silently price at $0 — that
  // understates the estimate the NSA $400 dispute threshold is measured against. Flag it instead.
  const items = lines.map((l) => {
    const rate = selfPayRates[l.cpt] ?? feeRow(l.cpt)?.medicareAllowed;
    return { cpt: l.cpt, description: feeRow(l.cpt)?.description ?? l.cpt, units: l.units, amount: rate !== undefined ? round2(rate * l.units) : 0, ratePending: rate === undefined };
  });
  const missingRateCpts = items.filter((i) => i.ratePending).map((i) => i.cpt);
  const total = sum(items.map((i) => i.amount));
  // NSA (45 CFR 149.610): the deadline is measured in business days from the request (today),
  // not from the appointment — 3 business days out when scheduled 10+ business days ahead,
  // 1 business day when scheduled 3-9 business days ahead, otherwise as soon as practicable.
  const lead = scheduledDate ? businessDaysBetween(today, scheduledDate) : 0;
  const deliverBy = scheduledDate ? (lead >= 10 ? addBusinessDays(today, 3) : lead >= 3 ? addBusinessDays(today, 1) : today) : addBusinessDays(today, 3);
  return {
    id: newId("gfe"),
    patientId: patient.id,
    scheduledDate,
    items,
    total,
    missingRateCpts,
    disclaimers: [
      "This Good Faith Estimate shows the costs of items and services reasonably expected for your health care needs. It is not a contract.",
      "If billed charges exceed this estimate by $400 or more, you may dispute the bill through the patient-provider dispute resolution process.",
      "The estimate is based on information known at the time; actual items or services may differ.",
      ...(missingRateCpts.length ? [`No self-pay rate is on file for ${missingRateCpts.join(", ")}; get pricing for these before delivering this estimate — it is understated.`] : []),
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
    // Checked per side (patientBalance/insuranceBalance), not the combined balance — a genuine
    // one-sided credit can be fully offset by an unrelated debit on the OTHER side and net the
    // combined balance to ~0, which would silently hide a real, refundable credit from both this
    // detector and /credit-balances. A patient can legitimately have a credit on both sides at
    // once (e.g. an insurance takeback alongside a separate patient overpayment); each is reported
    // and refunded independently rather than picking a single winning side via a heuristic.
    //
    // A negative patientBalance is only trustworthy as a REFUNDABLE credit once the patient's
    // actual responsibility has been established — by a transfer-to-patient (the payer adjudicated
    // the claim and posted what the patient owes) or a self-pay charge (patient responsibility from
    // the outset). Without that, a point-of-service copay collected BEFORE the claim is even
    // submitted/adjudicated (an extremely common, correct workflow) would look identical to a
    // genuine overpayment purely because nothing has posted to the patient side yet to offset it —
    // refunding it now, only to have the ERA's eventual transfer-to-patient put the same amount
    // right back on the patient's balance, having already returned money they legitimately owed.
    //
    // Checking that ANYWHERE on the account (the first attempt at this fix) isn't enough EITHER
    // direction: an account-wide kill switch both (a) lets one unrelated unresolved claim mask a
    // genuine, already-established credit on a DIFFERENT, fully-resolved claim (e.g. a literal
    // duplicate payment against a claim that's already been paid off), and (b) can itself be
    // bypassed by a claim whose insurance charge happens to lack a claimId. The fix isn't a single
    // account-wide boolean — it's excluding, from the credit calculation, only the specific
    // payments that are actually tied (via claimId) to a claim still awaiting adjudication.
    const insuranceChargeClaimIds = new Set(entries.filter((e) => e.type === "charge" && e.responsibleParty === "insurance" && e.claimId).map((e) => e.claimId!));
    const adjudicatedClaimIds = new Set(entries.filter((e) => e.claimId && (e.type === "transfer-to-patient" || e.type === "insurance-payment" || e.type === "contractual-adjustment" || e.type === "denial-adjustment")).map((e) => e.claimId!));
    const unresolvedClaimIds = new Set(Array.from(insuranceChargeClaimIds).filter((id) => !adjudicatedClaimIds.has(id)));
    const hasUnresolvedInsuranceClaim = unresolvedClaimIds.size > 0;
    // A patient-payment tied to a still-unresolved claim can't be judged as a credit yet — exclude
    // it (by adding its amount back) rather than blocking the whole account. A claimless payment
    // can't be tied to any specific claim's adjudication state at all, so — conservatively, since
    // we can't rule out that it's headed for whichever claim is still pending — it's excluded the
    // same way whenever ANY claim on the account remains unresolved; once every insurance claim has
    // actually adjudicated, claimless payments are trusted again, same as before this whole fix.
    const unresolvedTiedPayments = sum(entries.filter((e) => e.type === "patient-payment" && ((e.claimId && unresolvedClaimIds.has(e.claimId)) || (!e.claimId && hasUnresolvedInsuranceClaim))).map((e) => e.amount));
    const safePatientBalance = round2(s.patientBalance + unresolvedTiedPayments);
    const patientResponsibilityEstablished = entries.some((e) => e.type === "transfer-to-patient" || (e.type === "charge" && e.responsibleParty === "patient"));
    if (patientResponsibilityEstablished && safePatientBalance < -threshold) out.push({ patientId, amount: round2(-safePatientBalance), source: "overpayment-patient", refundTo: "patient", requiresApproval: -safePatientBalance >= 25 });
    if (s.insuranceBalance < -threshold) out.push({ patientId, amount: round2(-s.insuranceBalance), source: "overpayment-insurance", refundTo: "payer", requiresApproval: -s.insuranceBalance >= 25 });
  }
  return out;
}

// Exported so the small-balance-write-off tool's execution-time recheck (agents/index.ts) uses the
// exact same policy threshold this planner filters against, instead of a second hardcoded number
// that could drift from it.
export const SMALL_BALANCE_THRESHOLD = 5;

export function smallBalanceWriteOffs(entriesByPatient: Record<string, LedgerEntry[]>, threshold = SMALL_BALANCE_THRESHOLD): Array<{ patientId: string; amount: number }> {
  return Object.entries(entriesByPatient).map(([patientId, entries]) => ({ patientId, amount: computeAccount(patientId, entries).patientBalance })).filter((x) => x.amount > 0 && x.amount <= threshold);
}
