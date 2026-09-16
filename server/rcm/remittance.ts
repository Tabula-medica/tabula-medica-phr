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

function parseAdjustments(r: Record<string, unknown>, isReversal = false): Adjustment[] {
  const out: Adjustment[] = [];
  for (const a of arr(pick(r, "adjustments", "adjustment", "cas", "CAS"))) {
    const group = (str(pick(a, "group", "group_code", "CAS01")) ?? "CO").toUpperCase();
    const g: Adjustment["group"] = group === "PR" || group === "OA" || group === "PI" ? group : "CO";
    const amount = round2(num(pick(a, "amount", "adj_amount", "CAS03")));
    // CAS amounts are a nonnegative magnitude on the wire for a normal adjudication — a
    // malformed or admin-supplied ERA with a negative CAS amount would otherwise flow straight
    // into postRemittance's contractual/denied totals and post a negative-dollar ledger entry,
    // corrupting A/R. But an X12 835 reversal (CLP02 "22" or a negative paid amount) legitimately
    // negates its original CAS amounts to unwind them — clamping those to zero would leave the
    // original write-offs on the ledger forever and understate A/R instead.
    out.push({ group: g, carc: str(pick(a, "carc", "reason", "reason_code", "CAS02")) ?? "16", rarc: str(pick(a, "rarc", "remark")), amount: isReversal ? amount : Math.max(0, amount) });
  }
  return out;
}

// Defensive vendor-JSON → normalized Remittance. Claim.MD era-style keys with fallbacks.
export function parseEra(raw: unknown): Remittance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const claims: RemitClaim[] = arr(pick(r, "claims", "claim", "CLP")).map((c) => {
    const statusCode = str(pick(c, "status", "claim_status", "CLP02"));
    const paid = round2(num(pick(c, "paid", "amount_paid", "CLP04")));
    const isReversal = statusCode === "22" || paid < 0;
    return {
      claimId: str(pick(c, "pcn", "patient_control_number", "claimid", "CLP01")),
      payerClaimNumber: str(pick(c, "payer_claim_id", "icn", "CLP07")),
      patientName: str(pick(c, "patient_name", "patient")),
      statusCode,
      billed: round2(num(pick(c, "billed", "total_charge", "CLP03"))),
      allowed: pick(c, "allowed", "allowed_amount") !== undefined ? round2(num(pick(c, "allowed", "allowed_amount"))) : undefined,
      paid,
      patientResp: round2(num(pick(c, "patient_resp", "patient_responsibility", "CLP05"))),
      lines: arr(pick(c, "lines", "services", "service", "SVC")).map((l) => ({
        cpt: str(pick(l, "proc", "proc_code", "procedure_code", "cpt"))?.replace(/^HC:/, ""),
        billed: round2(num(pick(l, "billed", "charge", "SVC02"))),
        allowed: pick(l, "allowed", "allowed_amount") !== undefined ? round2(num(pick(l, "allowed", "allowed_amount"))) : undefined,
        paid: round2(num(pick(l, "paid", "amount_paid", "SVC03"))),
        patientResp: round2(num(pick(l, "patient_resp", "patient_responsibility"))),
        adjustments: parseAdjustments(l, isReversal),
      })),
      // 2100 CLP-level CAS — an 835 can carry these *alongside* SVC-level line adjustments, not
      // only when a claim has no lines, so this is captured unconditionally and posted separately
      // by postRemittance instead of being folded into (or dropped for) the line loop.
      claimAdjustments: parseAdjustments(c, isReversal),
    };
  });
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
    // Per-claim billed/paid/patient-resp, not just the claim id list — two distinct ERAs for the
    // same payer/total/date/claim-id set but a different actual allocation across those claims
    // (or the same claims paid differently) must not collide on the same fingerprint.
    // Sorted, not left in payload order — the same ERA retried with its claims array reordered
    // (a vendor quirk, or a lossy round-trip through some intermediate system) must still produce
    // the same fingerprint, or the duplicate check below would never catch the retry.
    const claimSummaries = arr(pick(r, "claims", "claim", "CLP")).map((c) => {
      const id = str(pick(c, "pcn", "patient_control_number", "claimid", "CLP01")) ?? "";
      const billed = round2(num(pick(c, "billed", "total_charge", "CLP03")));
      const paid = round2(num(pick(c, "paid", "amount_paid", "CLP04")));
      const patientResp = round2(num(pick(c, "patient_resp", "patient_responsibility", "CLP05")));
      return `${id}/${billed}/${paid}/${patientResp}`;
    }).sort().join(",");
    // Fold the check number into the fingerprint (rather than skipping fingerprinting whenever
    // one is present) so a re-POST of the same ERA gets the same deterministic id either way,
    // instead of minting a fresh random id every time just because a check number happened to be
    // on the payload.
    return `era-fp:${payerId}:${checkNumber ?? ""}:${checkAmount}:${checkDate}:${claimSummaries}`;
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
  // A single malformed/duplicated ERA can carry the same claimId in more than one CLP row. Every
  // row below is independently checked and posted against the SAME claimsById snapshot (the
  // caller applies postings sequentially, and a second row for a claim already handled by an
  // earlier row in this same batch would still see the claim's pre-posting status) — so without
  // this, a duplicate row can double-apply payment/adjustments to one claim before it's ever
  // re-fetched from the store. But a standard 835 reversal-and-correction pair legitimately
  // shares one claimId within a single ERA (a status-22 reversal immediately followed by the
  // corrected adjudication), so only that EXACT pattern — a non-reversal row immediately after a
  // reversal row for the same claim — is let through. Every other repeat (two reversals in a row,
  // which would double-refund and double-unwind; or two ordinary rows in a row) is still a
  // duplicate.
  const lastWasReversal = new Map<string, boolean>();
  for (const rc of rem.claims) {
    const claim = rc.claimId ? claimsById[rc.claimId] : undefined;
    // A claim id match alone isn't enough: an ERA carrying the wrong payer id (malformed vendor
    // payload, or a claim id that happens to collide across payers) must not be allowed to post
    // payment/adjustments or move claim status for a different payer's claim.
    const payerMismatch = !!claim && !!rem.payerId && claim.payerId !== rem.payerId;
    const isReversal = rc.statusCode === "22" || rc.paid < 0;
    const priorState = rc.claimId ? lastWasReversal.get(rc.claimId) : undefined;
    const duplicateInBatch = priorState !== undefined && !(priorState && !isReversal);
    if (!claim || payerMismatch || duplicateInBatch) {
      // Never post cash against a fabricated "unknown" patient and never count it as applied —
      // that would make an unreconciled payment look balanced and the money unrecoverable.
      // Leave it unmatched for a human to reconcile against the real patient/claim.
      postings.push({ claimId: rc.claimId, status: "unmatched", billed: rc.billed, allowed: rc.allowed, paid: rc.paid, patientResp: rc.patientResp, contractual: 0, denied: 0, entries: [], denials: [], crossoverToSecondary: false });
      continue;
    }
    lastWasReversal.set(rc.claimId!, isReversal);
    const patientId = claim.patientId;
    const date = rem.checkDate ?? rem.receivedAt.slice(0, 10);
    const entries: LedgerEntry[] = [];
    const denials: Adjustment[] = [];
    let contractual = 0, denied = 0;
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
      else {
        denied += a.amount;
        // A reversal's negated denial-CARC unwinds a prior denial's dollar amount (already
        // reflected in the ledger via the refund/contractual entries above), but routes.ts turns
        // every entry in `denials` into a brand-new open Denial record — pushing this one would
        // create a nonsensical negative-amount denial instead of resolving the ORIGINAL one.
        // Correlating this reversal back to that specific original Denial record (to close/adjust
        // it directly) isn't tracked anywhere in this module yet, so the safe choice is to not
        // spawn a new record at all rather than spawn a wrong one.
        if (!isReversal) denials.push(a);
      }
    }
    if (rc.paid !== 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: isReversal ? "refund" : "insurance-payment", amount: Math.abs(rc.paid), date, memo: `${rem.payerName ?? rem.payerId ?? "payer"} ${rem.checkNumber ?? ""}`.trim(), responsibleParty: "insurance" });
    if (rc.patientResp > 0) entries.push({ id: newId("led"), patientId, claimId: rc.claimId, type: "transfer-to-patient", amount: rc.patientResp, date, memo: "Patient responsibility per ERA", responsibleParty: "patient" });
    applied += rc.paid;

    let underpayment: Posting["underpayment"];
    const contract = claim ? contracts[claim.payerId] : undefined;
    // A denied or reversed claim isn't "underpaid" in the fee-schedule-variance sense this check
    // is for — it's zero-paid because it was denied (its own denial workflow already covers it)
    // or because a prior payment was just taken back, not because the payer paid less than the
    // contracted rate for an otherwise-adjudicated claim. Without this, a routine denial would
    // also open a spurious underpayments work item for the claim's entire expected allowed amount.
    const isDeniedOrReversal = isReversal || (rc.paid === 0 && (denied > 0 || rc.statusCode === "4"));
    if (claim && contract && !isDeniedOrReversal) {
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
    // `denied === 0` is NOT the right guard here: a real CARC present with a missing/zero CAS
    // amount also nets to `denied === 0` after the loop above (and is already in `denials`), so
    // that check would synthesize a SECOND, duplicate denial on top of it. Nor is "any adjustment
    // present at all" right either: a denied ERA can carry ONLY a PR or contractual (CO-45/253)
    // adjustment with no actual denial-classified CARC, and that must still get a denial record
    // for its unexplained residual. The precise signal is whether the loop above actually
    // classified anything as a denial (pushed to `denials`) — PR/contractual entries never are —
    // and the synthesized amount only covers the portion not already accounted for by patient
    // responsibility or a contractual adjustment elsewhere in this same posting.
    const hadDenialCarc = denials.length > 0;
    // CLP02 "4" can appear on a claim that's only PARTIALLY denied (some lines paid, others
    // denied) — the residual must exclude whatever was actually paid too, not just patient
    // responsibility and contractual write-offs, or the synthesized denial plus the real payment
    // would add up to more than the claim was ever billed for.
    const undocumentedDenied = round2(Math.max(0, rc.billed - rc.paid - rc.patientResp - contractual));
    if (rc.statusCode === "4" && !hadDenialCarc && undocumentedDenied > 0) { denied += undocumentedDenied; denials.push({ group: "CO", carc: "16", amount: undocumentedDenied }); }
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
