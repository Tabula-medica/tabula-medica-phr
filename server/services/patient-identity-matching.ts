/**
 * Deterministic, conservative patient identity matching ("positive patient
 * ID") for the Master Patient Index. Used to decide whether a Patient record
 * just pulled from a newly-connected EHR/aggregator is the SAME person as one
 * already linked to this account, or a different person who should stay in
 * their own UnifiedPatient record.
 *
 * The core safety rule (matches standard MPI practice, and the reason this
 * exists at all): date of birth mismatch always blocks a merge, no matter how
 * similar the names look, and date-of-birth agreement ALONE is never enough
 * to merge two records, since birthdays collide across a population. A merge
 * requires DOB agreement plus at least two other corroborating identity
 * fields (name, email, phone) — one corroborating field only reaches "low"
 * confidence, which is surfaced but not auto-merged.
 */

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface IdentityCandidate {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
}

export interface IdentityMatchResult {
  confidence: MatchConfidence;
  matchedFields: string[];
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeDob(value: string | undefined): string {
  // Compare only the calendar date, tolerating date vs. datetime strings.
  return (value ?? "").trim().slice(0, 10);
}

/**
 * Compare two identity candidates and rate how confidently they describe the
 * same person. Never returns better than "none" when DOB doesn't match, and
 * never returns better than "low" on DOB agreement alone.
 */
export function computeIdentityMatch(
  a: IdentityCandidate,
  b: IdentityCandidate,
): IdentityMatchResult {
  const dobA = normalizeDob(a.dateOfBirth);
  const dobB = normalizeDob(b.dateOfBirth);
  if (!dobA || !dobB || dobA !== dobB) {
    return { confidence: "none", matchedFields: [] };
  }

  const matchedFields = ["dateOfBirth"];
  let corroboratingScore = 0;

  if (normalize(a.lastName) && normalize(a.lastName) === normalize(b.lastName)) {
    matchedFields.push("lastName");
    corroboratingScore++;
  }
  if (normalize(a.firstName) && normalize(a.firstName) === normalize(b.firstName)) {
    matchedFields.push("firstName");
    corroboratingScore++;
  }
  if (normalize(a.email) && normalize(a.email) === normalize(b.email)) {
    matchedFields.push("email");
    corroboratingScore++;
  }
  if (normalizePhone(a.phone) && normalizePhone(a.phone) === normalizePhone(b.phone)) {
    matchedFields.push("phone");
    corroboratingScore++;
  }

  let confidence: MatchConfidence;
  if (corroboratingScore >= 3) confidence = "high";
  else if (corroboratingScore === 2) confidence = "medium";
  else if (corroboratingScore === 1) confidence = "low";
  else confidence = "none"; // DOB match alone: not enough, could be a coincidence.

  return { confidence, matchedFields: confidence === "none" ? [] : matchedFields };
}

/** Only "high" and "medium" confidence are trusted enough to auto-merge. */
export function shouldMerge(confidence: MatchConfidence): boolean {
  return confidence === "high" || confidence === "medium";
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

/**
 * The conservative aggregate of two confidence levels: a UnifiedPatient that
 * has ever been linked on weaker evidence should not report a higher overall
 * confidence than its weakest linked source.
 */
export function weakerConfidence(a: MatchConfidence, b: MatchConfidence): MatchConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}
