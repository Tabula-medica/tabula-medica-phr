/**
 * MPI Programmatic Deduplication Scoring Engine
 *
 * Standalone, lightweight demographic scoring engine used to pre-screen
 * incoming clinical feeds (FastenHealth, Epic webhooks, FHIR R4) before
 * escalating ambiguous matches to the full DB-backed deduplication service
 * or to Vertex AI triage.
 *
 * Algorithm: Jaro-Winkler similarity for name fields, exact/normalised
 * matching for dates/identifiers, and a weighted scoring matrix aligned with
 * USCDI v6 core demographic data elements.
 *
 * PHI note: This module receives pre-hashed / encrypted national IDs and
 * operates in-memory only — it never persists patient data itself.
 */

export interface ClinicalDemographics {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;           // ISO format: YYYY-MM-DD
  gender: string;
  postalCode: string;
  nationalInsuranceId?: string;  // SSN / National Health ID (hashed or encrypted)
}

export interface MergeAssessment {
  status: "AUTOMATIC_MERGE" | "DETERMINISTIC_CONFLICT_FAIL_SAFE" | "ROUTED_TO_AI_TRIAGE";
  confidenceScore: number;
  matchVector: string[];
}

// ─── String normalisation ─────────────────────────────────────────────────────

function normalizeString(input: string): string {
  return input
    .normalize("NFD")                // decompose diacritics (García → Garcia)
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ─── Jaro-Winkler similarity ──────────────────────────────────────────────────

/**
 * Jaro similarity between two strings.
 * Returns a value in [0, 1]: 1 = identical, 0 = no overlap.
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matched = new Array(len1).fill(false);
  const s2Matched = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Forward pass: find matching characters within the window
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(len2 - 1, i + matchWindow);
    for (let j = lo; j <= hi; j++) {
      if (s2Matched[j] || s1[i] !== s2[j]) continue;
      s1Matched[i] = true;
      s2Matched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matched[i]) continue;
    while (!s2Matched[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    matches / len1 +
    matches / len2 +
    (matches - transpositions / 2) / matches
  ) / 3;
}

/**
 * Jaro-Winkler similarity: adds a prefix bonus (up to 4 chars) on top of Jaro.
 * This rewards names that share a common prefix ("Rob" / "Robert") more heavily,
 * which is a common clinical naming pattern.
 *
 * @param p  Scaling factor for prefix bonus. Standard value is 0.1.
 */
export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);

  const jaroScore = jaroSimilarity(s1, s2);

  // Common prefix length, capped at 4
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  while (prefixLen < maxPrefix && s1[prefixLen] === s2[prefixLen]) {
    prefixLen++;
  }

  return jaroScore + prefixLen * p * (1 - jaroScore);
}

// ─── Scoring matrix ───────────────────────────────────────────────────────────

/**
 * Deterministic + probabilistic scoring matrix matching USCDI v6 core structures.
 *
 * Weights:
 *   Date of birth (exact)    0.40  — hard gate; mismatch fails closed
 *   Last name (Jaro-Winkler) 0.25  — high weight: most stable demographic
 *   First name (Jaro-Winkler)0.20  — moderate weight: nicknames common
 *   Gender (exact normalised) 0.05  — low weight: self-reported, may differ
 *   Postal code (exact)      0.10  — geographic anchor
 *
 * Thresholds:
 *   ≥ 0.90  → AUTOMATIC_MERGE
 *   ≥ 0.60  → ROUTED_TO_AI_TRIAGE
 *   < 0.60  → DETERMINISTIC_CONFLICT_FAIL_SAFE
 */
export function evaluatePatientMatching(
  incoming: ClinicalDemographics,
  existing: ClinicalDemographics
): MergeAssessment {
  const matchVector: string[] = [];

  // ── 0. Immutable deterministic gate: national identifier ───────────────────
  if (
    incoming.nationalInsuranceId &&
    existing.nationalInsuranceId &&
    incoming.nationalInsuranceId === existing.nationalInsuranceId
  ) {
    return {
      status: "AUTOMATIC_MERGE",
      confidenceScore: 1.0,
      matchVector: ["CRITICAL_NATIONAL_ID_EXACT_MATCH"],
    };
  }

  // ── 1. Hard gate: date of birth ────────────────────────────────────────────
  // Any single-digit transposition (e.g. 1990 → 1980) fails closed to prevent
  // cross-patient PHI disclosure.
  const dobNorm = (d: string) => d.replace(/[^0-9]/g, "");
  if (dobNorm(incoming.dateOfBirth) !== dobNorm(existing.dateOfBirth)) {
    return {
      status: "DETERMINISTIC_CONFLICT_FAIL_SAFE",
      confidenceScore: 0.0,
      matchVector: ["MISMATCHED_DATE_OF_BIRTH_BLOCK"],
    };
  }
  let score = 0.40;
  matchVector.push("EXACT_DOB_CONFIRMED");

  // ── 2. Last name (Jaro-Winkler, weight 0.25) ───────────────────────────────
  const lastScore = jaroWinkler(incoming.lastName, existing.lastName);
  if (lastScore >= 0.92) {
    score += 0.25;
    matchVector.push(`LAST_NAME_HIGH:${lastScore.toFixed(2)}`);
  } else if (lastScore >= 0.80) {
    score += 0.14;
    matchVector.push(`LAST_NAME_FUZZY:${lastScore.toFixed(2)}`);
  } else if (lastScore >= 0.65) {
    score += 0.06;
    matchVector.push(`LAST_NAME_WEAK:${lastScore.toFixed(2)}`);
  }

  // ── 3. First name (Jaro-Winkler, weight 0.20) ─────────────────────────────
  const firstScore = jaroWinkler(incoming.firstName, existing.firstName);
  if (firstScore >= 0.92) {
    score += 0.20;
    matchVector.push(`FIRST_NAME_HIGH:${firstScore.toFixed(2)}`);
  } else if (firstScore >= 0.80) {
    score += 0.11;
    matchVector.push(`FIRST_NAME_FUZZY:${firstScore.toFixed(2)}`);
  } else if (firstScore >= 0.65) {
    score += 0.04;
    matchVector.push(`FIRST_NAME_WEAK:${firstScore.toFixed(2)}`);
  }

  // ── 4. Gender (exact normalised, weight 0.05) ──────────────────────────────
  const gNorm = (g: string) => g.toLowerCase().trim()[0] ?? "";
  if (gNorm(incoming.gender) === gNorm(existing.gender) && gNorm(incoming.gender)) {
    score += 0.05;
    matchVector.push("GENDER_MATCH");
  }

  // ── 5. Postal code (exact normalised, weight 0.10) ─────────────────────────
  if (normalizeString(incoming.postalCode) === normalizeString(existing.postalCode)) {
    score += 0.10;
    matchVector.push("POSTAL_CODE_MATCH");
  }

  // ── Triage decision ────────────────────────────────────────────────────────
  const rounded = parseFloat(score.toFixed(2));
  let status: MergeAssessment["status"];
  if (rounded >= 0.90) {
    status = "AUTOMATIC_MERGE";
  } else if (rounded >= 0.60) {
    status = "ROUTED_TO_AI_TRIAGE";
  } else {
    status = "DETERMINISTIC_CONFLICT_FAIL_SAFE";
  }

  return { status, confidenceScore: rounded, matchVector };
}

// ─── Batch helper ─────────────────────────────────────────────────────────────

/**
 * Screen an incoming record against a list of existing records and return the
 * best match. Returns null if no candidate meets the AI-triage threshold (0.60).
 */
export function findBestMatch(
  incoming: ClinicalDemographics,
  candidates: ClinicalDemographics[]
): { candidate: ClinicalDemographics; assessment: MergeAssessment } | null {
  let best: { candidate: ClinicalDemographics; assessment: MergeAssessment } | null = null;

  for (const candidate of candidates) {
    const assessment = evaluatePatientMatching(incoming, candidate);
    if (assessment.status === "DETERMINISTIC_CONFLICT_FAIL_SAFE") continue;
    if (!best || assessment.confidenceScore > best.assessment.confidenceScore) {
      best = { candidate, assessment };
    }
  }

  return best;
}
