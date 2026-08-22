/**
 * CMS-HCC Version 28 — model definitions and types.
 *
 * ## What this file is, and what it deliberately is not
 *
 * V28 is the CMS Hierarchical Condition Category risk-adjustment model used to
 * pay Medicare Advantage plans. It was rebuilt natively on ICD-10-CM (V24 still
 * carried an ICD-9 lineage), and is fully phased in — 100% of the MA risk score
 * — as of payment year 2026.
 *
 * This file carries the model's *structure* and the *types*. It carries no
 * ICD-10 -> HCC crosswalk and no coefficients, and that omission is deliberate:
 *
 *   A RAF score is a payment claim. A wrong crosswalk or a stale coefficient
 *   does not produce a slightly-off number, it produces a false claim to the
 *   federal government. The published CMS files are the only defensible source.
 *
 * So the crosswalk (~7,770 ICD-10-CM codes), the 115 HCC labels, the hierarchy
 * table and the coefficient tables are all *loaded at runtime* from the official
 * CMS model release — see `server/services/risk-adjustment/hcc-tables.ts`. Until
 * they are loaded, this system reports HCC-eligibility and documentation gaps
 * but returns no RAF number at all. Refusing to score is the correct behaviour;
 * guessing is not.
 *
 * The clinical intelligence layered on top — suspect detection, annual
 * recapture, MEAT adequacy — needs none of those tables. It reasons over
 * ICD-10-CM codes and chart evidence, and lets the loaded CMS tables supply the
 * category number and the weight.
 */

/** Structural facts about V28, stable across the payment years it governs. */
export const HCC_V28 = {
  version: "V28",
  /** CMS-HCC, i.e. Medicare Advantage. NOT the HHS-HCC commercial/ACA model,
   *  which is a different model with different categories and coefficients. */
  program: "CMS-HCC",
  /** Payment year at which V28 became 100% of the blend. */
  fullyPhasedInPaymentYear: 2026,
  /** Payment HCCs in the V28 model (V24 had 86). */
  paymentCategoryCount: 115,
  /** Approximate count of ICD-10-CM codes that map to a payment HCC
   *  (V24 mapped ~9,797; V28 narrowed the map). */
  approximateMappedIcd10Codes: 7770,
} as const;

/**
 * The CMS-HCC segments. A beneficiary's coefficient depends on which model
 * segment they fall in, not just which HCCs they carry — the same HCC is worth
 * a different amount to a community non-dual aged enrollee than to an
 * institutional one. Scoring against the wrong segment is a silent error, so
 * the segment is a required input, never a default.
 */
export type HccModelSegment =
  | "community-nondual-aged"
  | "community-nondual-disabled"
  | "community-fbd-aged"
  | "community-fbd-disabled"
  | "community-pbd-aged"
  | "community-pbd-disabled"
  | "institutional"
  | "new-enrollee"
  | "snp-new-enrollee";

export const HCC_MODEL_SEGMENTS: readonly HccModelSegment[] = [
  "community-nondual-aged",
  "community-nondual-disabled",
  "community-fbd-aged",
  "community-fbd-disabled",
  "community-pbd-aged",
  "community-pbd-disabled",
  "institutional",
  "new-enrollee",
  "snp-new-enrollee",
];

/** One row of the official ICD-10-CM -> HCC crosswalk. */
export interface HccCrosswalkRow {
  /** ICD-10-CM code, no dot (CMS ships them undotted). */
  icd10: string;
  /** V28 payment HCC number. */
  hcc: number;
}

/** One V28 payment category. */
export interface HccCategory {
  hcc: number;
  /** Official CMS category label. */
  label: string;
  /** Disease-family grouping used by the hierarchy. */
  family?: string;
}

/**
 * A hierarchy edge: carrying `hcc` suppresses every HCC in `suppresses`.
 *
 * CMS calls this "trumping" — a beneficiary coded for both a severe and a mild
 * form of the same disease is paid only for the severe one. Skipping this step
 * inflates every score it touches.
 */
export interface HccHierarchyRule {
  hcc: number;
  suppresses: readonly number[];
}

/** A coefficient for one factor within one model segment. */
export interface HccCoefficient {
  segment: HccModelSegment;
  /** `HCC_<n>` for a condition, or a demographic/interaction factor name as
   *  published by CMS (e.g. `F65_69`, `DISABLED_HCC_...`). */
  factor: string;
  value: number;
}

/** Provenance for a loaded CMS table — recorded so a score can be traced back. */
export interface HccTableProvenance {
  /** Where the table came from, e.g. a CMS release filename. */
  source: string;
  /** Payment year the table is published for. */
  paymentYear: number;
  /** SHA-256 of the loaded file, so a swapped table is detectable. */
  sha256: string;
  loadedAt: string;
}

/** How a condition came to be on the encounter — drives what we may claim. */
export type HccConditionOrigin =
  /** Coded on a submitted, clinician-signed encounter. Countable. */
  | "coded-encounter"
  /** On the problem list but not coded on a qualifying encounter this year. */
  | "problem-list"
  /** Inferred from chart evidence. NEVER countable without clinician sign-off. */
  | "suspected";

export interface HccCondition {
  icd10: string;
  /** Populated from the loaded crosswalk; null when the code maps to no HCC. */
  hcc: number | null;
  origin: HccConditionOrigin;
  /** Date of service the code was captured on, ISO-8601. */
  serviceDate?: string;
  /** True once a clinician has affirmatively accepted a suggestion. */
  clinicianAttested?: boolean;
}

/**
 * MEAT — Monitor, Evaluate, Assess/Address, Treat.
 *
 * A diagnosis on a problem list is not a codable diagnosis. To survive a RADV
 * audit the note must show the condition was actually managed at that visit.
 * These are the four recognised forms of that evidence.
 */
export type MeatElement = "monitor" | "evaluate" | "assess" | "treat";

export const MEAT_ELEMENTS: readonly MeatElement[] = [
  "monitor",
  "evaluate",
  "assess",
  "treat",
];

/** Why a suggested code is not (yet) submittable. */
export type HccBlockReason =
  | "no-clinician-attestation"
  | "insufficient-meat-documentation"
  | "no-qualifying-encounter"
  | "code-does-not-map-to-hcc"
  | "suppressed-by-hierarchy";

/** Result of scoring — either a real number, or an explicit refusal. */
export type RafResult =
  | {
      status: "scored";
      raf: number;
      segment: HccModelSegment;
      /** Factors that contributed, for line-by-line auditability. */
      contributions: readonly { factor: string; value: number }[];
      provenance: HccTableProvenance;
    }
  | {
      status: "not-scored";
      /** Machine-readable reason the score was withheld. */
      reason:
        | "coefficients-not-loaded"
        | "crosswalk-not-loaded"
        | "unknown-segment"
        | "missing-demographics";
      detail: string;
    };
