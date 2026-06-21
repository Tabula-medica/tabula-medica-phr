/**
 * Session 2c (item c) — write-time PHI denylist for audit action strings.
 *
 * `auditLogTable.action` and `hipaaAuditLogsTable.action` are
 * intentionally STORED IN PLAINTEXT so HIPAA §164.312(b) tamper-evident
 * queries (e.g. "list all DELETE actions on patient X") remain
 * efficient. That tradeoff only holds if `action` strings cannot
 * accidentally carry PHI — a careless caller that builds an action
 * string like `view_patient_jane.doe@example.com_records` would leak
 * PHI in plaintext into the audit log forever (audit logs are WORM /
 * append-only).
 *
 * This module validates action strings at write time and rejects any
 * match against well-known PHI patterns. The intended call pattern in
 * an audit writer is:
 *
 *   const verdict = validateAuditAction(actionString);
 *   if (!verdict.ok) {
 *     logger.warn({ component: "AuditValidator", pattern: verdict.matched, audit: "HIPAA" }, "PHI-shaped action rejected");
 *     return; // do not write the row
 *   }
 *   await phiDb.insert(...).values(...);
 *
 * The validator is intentionally pattern-based and conservative: false
 * positives (a benign action mistakenly rejected) are recoverable by
 * the caller — they can rename the action. False negatives (PHI
 * silently written) are not recoverable because audit logs are WORM.
 */

export type AuditActionValidation =
  | { ok: true }
  | { ok: false; matched: string; sample: string };

/**
 * Pattern → human label. Order matters — first match wins so the
 * WARN log line surfaces the most specific category.
 */
const PHI_PATTERNS: ReadonlyArray<{ label: string; rx: RegExp }> = [
  { label: "email", rx: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  // ZIP+4 (5 digits + dash + 4 digits). Ordered BEFORE ssn so that
  // strings like "94110-1234" surface as zip_plus4 rather than getting
  // mis-classified by the (looser) SSN matcher.
  { label: "zip_plus4", rx: /(?<!\d)\d{5}-\d{4}(?!\d)/ },
  // SSN: 3-2-4. Tightened — separators must be consistent across both
  // gaps (all dash / all space / all dot / all none) so that a ZIP+4 or
  // a phone fragment cannot accidentally match.
  {
    label: "ssn",
    rx: /(?<!\d)(?:\d{3}-\d{2}-\d{4}|\d{3}\s\d{2}\s\d{4}|\d{3}\.\d{2}\.\d{4}|\d{9})(?!\d)/,
  },
  // Phone: +1 optional, 10 digits with separators (paren, dash, dot, space).
  { label: "phone", rx: /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/ },
  // DOB / dates. Use digit-only lookaround (NOT \b) so that callers
  // emitting tokens like "audit_12.25.1990_event" — where `_` is a
  // word char and breaks \b — still get flagged.
  {
    label: "dob_yyyy_mm_dd",
    rx: /(?<!\d)(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])(?!\d)/,
  },
  {
    label: "dob_mm_dd_yyyy",
    rx: /(?<!\d)(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}(?!\d)/,
  },
  // MRN-shaped tokens: MRN-12345 or MRN12345 or "mrn:12345".
  { label: "mrn", rx: /\b[Mm][Rr][Nn][-:\s]?\d{4,}\b/ },
  // Common-name shape: "FirstName LastName" with both tokens
  // 2+ chars, capital initial, alpha only. Conservative — many UI
  // labels match this shape, so callers should prefer action codes
  // (e.g. VIEW_PATIENT) over rendered names.
  { label: "name_two_token", rx: /\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/ },
];

export function validateAuditAction(action: string): AuditActionValidation {
  if (typeof action !== "string") {
    return { ok: false, matched: "non_string", sample: String(action).slice(0, 32) };
  }
  if (action.length > 256) {
    return { ok: false, matched: "oversize", sample: action.slice(0, 32) };
  }
  for (const { label, rx } of PHI_PATTERNS) {
    const match = action.match(rx);
    if (match) {
      return { ok: false, matched: label, sample: match[0].slice(0, 32) };
    }
  }
  return { ok: true };
}

/**
 * Throwing variant for call sites that prefer fail-fast semantics
 * (e.g. unit tests, internal-only writers where a violation is a bug
 * not a user-supplied input).
 */
export class AuditActionPhiViolation extends Error {
  readonly pattern: string;
  readonly sample: string;
  constructor(pattern: string, sample: string) {
    super(`Audit action rejected — matches PHI pattern "${pattern}" (sample: "${sample}")`);
    this.name = "AuditActionPhiViolation";
    this.pattern = pattern;
    this.sample = sample;
  }
}

export function assertSafeAuditAction(action: string): void {
  const verdict = validateAuditAction(action);
  if (!verdict.ok) {
    throw new AuditActionPhiViolation(verdict.matched, verdict.sample);
  }
}
