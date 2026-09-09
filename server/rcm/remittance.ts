// Stage 10-11: ERA/835 normalization + auto-posting to the ledger, with underpayment detection
// against the payer contract, take-back/reversal handling, and secondary crossover cues.
import type { Adjustment, Claim, LedgerEntry, PayerContract, RemitClaim, Remittance } from "./types";
import { expectedAllowed } from "./contracts";
import { newId, nowIso, round2, sum } from "./util";

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) || 0 : 0);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const pick = (r: Record<string, unknown>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null);

function parseAdjustments(r: Record<string, unknown>): Adjustment[] {
  const out: Adjustment[] = [];
  for (const a of arr(pick(r, "adjustments", "adjustment", "cas", "CAS"))) {
    const group = (str(pick(a, "group", "group_code", "CAS01")) ?? "CO").toUpperCase();
    const g: Adjustment["group"] = group === "PR" || group === "OA" || group === "PI" ? group : "CO";
    out.push({ group: g, carc: str(pick(a, "carc", "reason", "reason_code", "CAS02")) ?? "16", rarc: str(pick(a, "rarc", "remark")), amount: round2(num(pick(a, "amount", "adj_amount", "CAS03"))) });
  }
  return out;
}

// Defensive vendor-JSON → normalized Remittance. Claim.MD era-style keys with fallbacks.
export function parseEra(raw: unknown): Remittance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const claims: RemitClaim[] = arr(pick(r, "claims", "claim", "CLP")).map((c) => ({
    claimId: str(pick(c, "pcn", "patient_control_number", "claimid", "CLP01")),
    payerClaimNumber: str(pick(c, "payer_claim_id", "icn", "CLP07")),
    patientName: str(pick(c, "patient_name", "patient")),
    statusCode: str(pick(c, "status", "claim_status", "CLP02")),
    billed: round2(num(pick(c, "billed", "total_charge", "CLP03"))),
    allowed: pick(c, "allowed", "allowed_amount") !== undefined ? round2(num(pick(c, "allowed", "allowed_amount"))) : undefined,
    paid: round2(num(pick(c, "paid", "amount_paid", "CLP04"))),
    patientResp: round2(num(pick(c, "patient_resp", "patient_responsibility", "CLP05"))),
    lines: arr(pick(c, "lines", "services", "service", "SVC")).map((l) => ({
      cpt: str(pick(l, "proc", "proc_code", "procedure_code", "cpt"))?.replace(/^HC:/, ""),
      billed: round2(num(pick(l, "billed", "charge", "SVC02"))),
      allowed: pick(l, "allowed", "allowed_amount") !== undefined ? round2(num(pick(l, "allowed", "allowed_amount"))) : undefined,
      paid: round2(num(pick(l, "paid", "amount_paid", "SVC03"))),
      patientResp: round2(num(pick(l, "patient_resp", "patient_responsibility"))),
      adjustments: parseAdjustments(l),
    })),
  }));
  // Claim-level adjustments folded into lines when there are no lines.
  for (const c of claims) if (!c.lines.length) c.lines.push({ billed: c.billed, allowed: c.allowed, paid: c.paid, patientResp: c.patientResp, adjustments: parseAdjustments(((arr(pick(r, "claims", "claim", "CLP")).find((x) => str(pick(x, "pcn", "patient_control_number", "claimid", "CLP01")) === c.claimId)) ?? {}) as Record<string, unknown>) });
  const method = (str(pick(r, "payment_method", "method", "BPR04")) ?? "").toUpperCase();
  return {
    id: str(pick(r, "eraid", "era_id", "id")) ?? newId("era"),
    payerId: str(pick(r, "payerid", "payer_id")),
    payerName: str(pick(r, "payer_name", "payer")),
    checkNumber: str(pick(r, "check_number", "checknumber", "trn", "TRN02")),
    checkAmount: round2(num(pick(r, "check_amount", "total_paid", "amount", "BPR02"))),
    checkDate: str(pick(r, "check_date", "paid_date", "date")),
    method: method === "ACH" ? "ACH" : method === "CHK" ? "CHK" : method === "NON" ? "NON" : undefined,
    claims,
    receivedAt: nowIso(),
  };
}

export type PostingStatus = "paid" | "partial" | "denied" | "reversal" | "zero-pay";

export interface Posting {
  claimId?: string;
  status: PostingStatus;
  billed: number;
  allowed?: number;
  paid: number;
  patientResp: number;
  contractual: number; // CO adjustments
  denied: number; // CO/PI non-contractual (denial) amounts
  entries: LedgerEntry[];
  denials: Adjustment[]; // adjustments that need denial work
  underpayment?: { expectedAllowed: number; actualAllowed: number; variance: number };
  crossoverToSecondary: boolean;
}

export function postRemittance(rem: Remittance, claimsById: Record<string, Claim>, contracts: Record<string, PayerContract> = {}): { postings: Posting[]; unapplied: number; balanced: boolean } {
  const postings: Posting[] = [];
  let applied = 0;
  for (const rc of rem.claims) {
    const claim = rc.claimId ? claimsById[rc.claimId] : undefined;
    const patientId = claim?.patientId ?? "unknown";
    const date = rem.checkDate ?? rem.receivedAt.slice(0, 10);
    const entries: LedgerEntry[] = [];
    const denials: Adjustment[] = [];
    let contractual = 0, denied = 0;
    const isReversal = rc.statusCode === "22" || rc.paid < 0;
    for (const l of rc.lines) for (const a of l.adjustments) {
      if (a.group === "PR") continue; // patient responsibility handled via transfer below
      if (a.carc === "45" || a.carc === "CO-253" || a.carc === "253") { contractual += a.amount; entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: "contractual-adjustment", amount: a.amount, date, memo: `CARC ${a.carc}`, responsibleParty: "insurance" }); }
      else { denied += a.amount; denials.push(a); }
    }
    if (rc.paid !== 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: isReversal ? "refund" : "insurance-payment", amount: Math.abs(rc.paid), date, memo: `${rem.payerName ?? rem.payerId ?? "payer"} ${rem.checkNumber ?? ""}`.trim(), responsibleParty: "insurance" });
    if (rc.patientResp > 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: "transfer-to-patient", amount: rc.patientResp, date, memo: "Patient responsibility per ERA", responsibleParty: "patient" });
    applied += rc.paid;

    let underpayment: Posting["underpayment"];
    const contract = claim ? contracts[claim.payerId] : undefined;
    if (claim && contract) {
      const expected = sum(claim.lines.map((l) => expectedAllowed(contract, l.cpt, l.units, l.modifiers)));
      const actual = rc.allowed ?? round2(rc.paid + rc.patientResp);
      const variance = round2(expected - actual);
      if (variance > Math.max(1, expected * 0.02)) underpayment = { expectedAllowed: expected, actualAllowed: actual, variance };
    }
    const status: PostingStatus = isReversal ? "reversal" : rc.paid === 0 && denied > 0 ? "denied" : rc.paid === 0 ? "zero-pay" : denied > 0 || (rc.allowed !== undefined && rc.paid + rc.patientResp < rc.allowed - 0.01) ? "partial" : "paid";
    postings.push({ claimId: rc.claimId, status, billed: rc.billed, allowed: rc.allowed, paid: rc.paid, patientResp: rc.patientResp, contractual: round2(contractual), denied: round2(denied), entries, denials, underpayment, crossoverToSecondary: rc.statusCode === "1" && rc.patientResp > 0 });
  }
  const unapplied = round2(rem.checkAmount - applied);
  return { postings, unapplied, balanced: Math.abs(unapplied) < 0.01 };
}

export function claimStatusFromPosting(p: Posting): Claim["status"] {
  switch (p.status) {
    case "paid": return "paid";
    case "partial": return "partially-paid";
    case "denied": return "denied";
    case "zero-pay": return "adjudicated";
    case "reversal": return "adjudicated";
  }
}
