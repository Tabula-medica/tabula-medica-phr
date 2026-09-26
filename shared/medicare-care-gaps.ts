/**
 * Types for the Medicare quality/wellness care-gaps connector.
 *
 * Four gap categories a Medicare-focused population-health tool is expected to
 * close: the Annual Wellness Visit, the adult vaccine schedule, medication
 * reconciliation, and the comprehensive care plan that gates CCM/PCM/APCM.
 *
 * Same discipline as `shared/care-management.ts`: a candidate is a billing
 * *opportunity* tied to the evidence that supports it, never a claim. `code`
 * is `null` when Medicare has no distinct G-code for the gap (several ACIP
 * vaccines are billed under CPT vaccine-administration codes, not a HCPCS
 * G-code) — the engine reports the clinical gap and refuses to invent a code
 * that does not exist, the same refusal this codebase already applies to
 * unverified RVU/HCC tables and undocumented care-management prerequisites.
 */

export type MedicareGapCategory =
  | "awv"
  | "vaccine"
  | "medication-reconciliation"
  | "care-plan";

export type MedicareGapStatus =
  | "overdue"
  | "due_soon"
  | "up_to_date"
  | "not_applicable";

export type GapRefusalReason =
  | "not-medicare-enrolled"
  | "missing-enrollment-date"
  | "missing-prerequisite"
  | "insufficient-data";

/** A HCPCS G-code (or, for the medication-reconciliation quality measure, its
 * attestation code) relevant to one of the four gap categories. */
export interface MedicareGCode {
  code: string;
  category: MedicareGapCategory;
  label: string;
  /**
   * What the code actually pays for or attests, stated precisely so it is
   * never mistaken for something it is not — e.g. G8427 is a quality-measure
   * attestation, not a separately payable service.
   */
  note: string;
}

export interface GapCandidate {
  category: MedicareGapCategory;
  /** Null when no distinct Medicare G-code exists for this gap. */
  code: string | null;
  label: string;
  status: MedicareGapStatus;
  rationale: readonly string[];
  lastDate?: string;
  nextDueDate?: string;
  /** True when the G-code catalog behind this candidate is the unverified seed. */
  unverifiedRules: boolean;
}

export interface GapRefused {
  category: MedicareGapCategory;
  code?: string;
  reason: GapRefusalReason;
  detail: string;
}

export const MEDICARE_GAP_LIMITS = {
  AWV_INTERVAL_MONTHS: 12,
  TDAP_INTERVAL_MONTHS: 120,
  INFLUENZA_INTERVAL_MONTHS: 12,
  COVID_INTERVAL_MONTHS: 12,
  ZOSTER_MIN_DOSE_INTERVAL_MONTHS: 2,
  TCM_MED_REC_WINDOW_DAYS: 14,
  DUE_SOON_WINDOW_DAYS: 60,
} as const;
