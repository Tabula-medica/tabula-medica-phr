// Stage 10-11: ERA/835 normalization + auto-posting to the ledger, with underpayment detection
// against the payer contract, take-back/reversal handling, and secondary crossover cues.
import type { Adjustment, Claim, LedgerEntry, PayerContract, RemitClaim, Remittance } from "./types";
import { expectedForLines } from "./contracts";
import { newId, nowIso, round2, sum } from "./util";

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) || 0 : 0);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);
// Some vendors send a single object instead of a one-element array for "claim"/"service"/
// "adjustment" when there's exactly one; normalize it instead of silently dropping it.
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : v && typeof v === "object" ? [v as Record<string, unknown>] : []);
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
    // 2100 CLP-level CAS — an 835 can carry these *alongside* SVC-level line adjustments, not
    // only when a claim has no lines, so this is captured unconditionally and posted separately
    // by postRemittance instead of being folded into (or dropped for) the line loop.
    claimAdjustments: parseAdjustments(c),
  }));
  const method = (str(pick(r, "payment_method", "method", "BPR04")) ?? "").toUpperCase();
  const explicitId = str(pick(r, "eraid", "era_id", "id"));
  // No vendor-supplied id or check number to key off of — derive a stable fingerprint from the
  // remittance's own content instead of a random id, so re-POSTing the identical payload (the
  // vendor retrying a webhook, a duplicate upload) is still recognized as the same ERA by the
  // idempotency check in routes.ts, rather than silently minting a new "unique" remittance each time.
  const checkNumber = str(pick(r, "check_number", "checknumber", "trn", "TRN02"));
  const fingerprintId = () => {
    const payerId = str(pick(r, "payerid", "payer_id")) ?? "";
    const checkAmount = round2(num(pick(r, "check_amount", "total_paid", "amount", "BPR02")));
    const checkDate = str(pick(r, "check_date", "paid_date", "date")) ?? "";
    const claimIds = arr(pick(r, "claims", "claim", "CLP")).map((c) => str(pick(c, "pcn", "patient_control_number", "claimid", "CLP01")) ?? "").join(",");
    // Fold the check number into the fingerprint (rather than skipping fingerprinting whenever
    // one is present) so a re-POST of the same ERA gets the same deterministic id either way,
    // instead of minting a fresh random id every time just because a check number happened to be
    // on the payload.
    return `era-fp:${payerId}:${checkNumber ?? ""}:${checkAmount}:${checkDate}:${claimIds}`;
  };
  return {
    id: explicitId ?? fingerprintId() ?? newId("era"),
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

export type PostingStatus = "paid" | "partial" | "denied" | "reversal" | "zero-pay" | "unmatched";

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
    // A claim id match alone isn't enough: an ERA carrying the wrong payer id (malformed vendor
    // payload, or a claim id that happens to collide across payers) must not be allowed to post
    // payment/adjustments or move claim status for a different payer's claim.
    const payerMismatch = !!claim && !!rem.payerId && claim.payerId !== rem.payerId;
    if (!claim || payerMismatch) {
      // Never post cash against a fabricated "unknown" patient and never count it as applied —
      // that would make an unreconciled payment look balanced and the money unrecoverable.
      // Leave it unmatched for a human to reconcile against the real patient/claim.
      postings.push({ claimId: rc.claimId, status: "unmatched", billed: rc.billed, allowed: rc.allowed, paid: rc.paid, patientResp: rc.patientResp, contractual: 0, denied: 0, entries: [], denials: [], crossoverToSecondary: false });
      continue;
    }
    const patientId = claim.patientId;
    const date = rem.checkDate ?? rem.receivedAt.slice(0, 10);
    const entries: LedgerEntry[] = [];
    const denials: Adjustment[] = [];
    let contractual = 0, denied = 0;
    const isReversal = rc.statusCode === "22" || rc.paid < 0;
    // Claim-level (CLP) CAS can appear alongside SVC-level line CAS in the same 835 — process
    // both instead of only the lines, so claim-level contractual/denial adjustments aren't
    // silently dropped for a normal multi-line claim.
    for (const a of [...(rc.claimAdjustments ?? []), ...rc.lines.flatMap((l) => l.adjustments)]) {
      if (a.group === "PR") continue; // patient responsibility handled via transfer below
      // A CARC can arrive group-prefixed (e.g. "CO-45") as well as bare ("45") — strip the same
      // CO/PR/OA/PI prefix analyzeDenial already strips before comparing, so a group-prefixed
      // contractual code isn't misclassified as a denial.
      const bareCarc = a.carc.toUpperCase().replace(/^(CO|PR|OA|PI)-/, "");
      if (bareCarc === "45" || bareCarc === "253") { contractual += a.amount; entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: "contractual-adjustment", amount: a.amount, date, memo: `CARC ${a.carc}`, responsibleParty: "insurance" }); }
      else { denied += a.amount; denials.push(a); }
    }
    if (rc.paid !== 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: isReversal ? "refund" : "insurance-payment", amount: Math.abs(rc.paid), date, memo: `${rem.payerName ?? rem.payerId ?? "payer"} ${rem.checkNumber ?? ""}`.trim(), responsibleParty: "insurance" });
    if (rc.patientResp > 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: "transfer-to-patient", amount: rc.patientResp, date, memo: "Patient responsibility per ERA", responsibleParty: "patient" });
    applied += rc.paid;

    let underpayment: Posting["underpayment"];
    const contract = claim ? contracts[claim.payerId] : undefined;
    if (claim && contract) {
      // Use the same claim-level multiple-procedure reduction the contract module defines
      // (100% for the top-valued surgical line, 50% for the rest) — summing plain per-line
      // rates would flag a correctly-paid multi-procedure claim as underpaid.
      const expected = expectedForLines(contract, claim.lines);
      // The allowed amount is what the payer's contract lets through: paid + patient
      // responsibility + whatever was written off as contractual (CO-45/253) — leaving out the
      // contractual adjustment here would misread a normally-paid claim (e.g. $80 paid + $20
      // CO-45 against a $100 expected rate) as a variance-triggering underpayment.
      const actual = rc.allowed ?? round2(rc.paid + rc.patientResp + contractual);
      const variance = round2(expected - actual);
      if (variance > Math.max(1, expected * 0.02)) underpayment = { expectedAllowed: expected, actualAllowed: actual, variance };
    }
    // CLP02 "4" is the X12-defined denied-claim status code — honor it even when the vendor
    // omitted a CARC adjustment alongside it, so a denied claim with zero paid and no parsed
    // reason still lands in "denied" instead of "zero-pay". A status change alone doesn't start
    // the denial workflow, though — routes.ts only creates a Denial (with its own appeal
    // deadline/triage/follow-up) from an entry in `denials`, so synthesize a generic one (CARC 16,
    // the same "lacks information" fallback parseAdjustments already uses elsewhere) rather than
    // leaving a denied claim with no denial record and no route into that workflow at all.
    // Guard on an empty `denials` list, not the dollar total: a present CARC with a missing/zero
    // CAS amount is still a reason code (parseAdjustments defaults amount to 0), and stacking
    // CARC 16 on top would open a second conflicting denial. Amount is the ERA's unresolved
    // remainder so contractual/PR already posted on this claim isn't counted again.
    const unresolved = round2(Math.max(0, rc.billed - rc.paid - contractual - rc.patientResp));
    const clp4WithNoCarc = rc.statusCode === "4" && denials.length === 0;
    if (clp4WithNoCarc && unresolved > 0) { denied += unresolved; denials.push({ group: "CO", carc: "16", amount: unresolved }); }
    const status: PostingStatus = isReversal ? "reversal" : rc.paid === 0 && (denied > 0 || rc.statusCode === "4") ? "denied" : rc.paid === 0 ? "zero-pay" : denied > 0 || (rc.allowed !== undefined && rc.paid + rc.patientResp < rc.allowed - 0.01) ? "partial" : "paid";
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
    case "unmatched": return "adjudicated"; // unreachable via routes.ts, which only calls this when a claim was found
  }
}
