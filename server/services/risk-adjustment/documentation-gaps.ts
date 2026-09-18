/**
 * Two documentation checks that decide whether a condition survives an audit.
 *
 * ## 1. Annual recapture
 *
 * Risk adjustment resets every calendar year. A condition documented in 2025
 * contributes nothing to the 2026 score unless it is documented *again*, on a
 * face-to-face encounter, in 2026. This is the single largest source of lost
 * accuracy in real practices, and it is entirely mechanical to detect: compare
 * what was coded last year against what has been coded this year.
 *
 * The subtlety is which conditions *should* recur. An amputation does not heal;
 * an acute MI does not persist. Suggesting recapture of a resolved acute event
 * is wrong clinically and is exactly the pattern auditors look for. So recapture
 * is proposed only for conditions whose ICD-10 family is chronic or permanent,
 * and even then as a prompt to re-assess, never as an instruction to re-code.
 *
 * ## 2. MEAT adequacy
 *
 * A diagnosis carried on a problem list is not a documented diagnosis. To stand
 * up in a RADV audit the note must show the condition was Monitored, Evaluated,
 * Assessed or Treated at that visit. This module reads the note text and reports
 * which of those four it can actually find.
 *
 * It reports *absence of evidence*, not *evidence of absence*: "no MEAT language
 * found for this condition" is a prompt to the clinician to write what they did,
 * not an assertion that they did nothing.
 */

/** ICD-10 chapters/families whose conditions are chronic or permanent, and so
 *  are expected to persist year over year. Anything outside this list is not
 *  proposed for recapture, because acute conditions legitimately disappear. */
const CHRONIC_OR_PERMANENT_PREFIXES: readonly string[] = [
  "B20", // HIV disease
  "C", // Malignant neoplasms — active treatment status must be re-confirmed
  "D57", // Sickle-cell disorders
  "D61", // Aplastic anaemias
  "E10", // Type 1 diabetes
  "E11", // Type 2 diabetes
  "E66", // Obesity
  "F20", // Schizophrenia
  "F31", // Bipolar disorder
  "F33", // Recurrent depressive disorder
  "G20", // Parkinson disease
  "G30", // Alzheimer disease
  "G35", // Multiple sclerosis
  "G80", // Cerebral palsy
  "I12", // Hypertensive chronic kidney disease
  "I13", // Hypertensive heart and CKD
  "I50", // Heart failure
  "I70", // Atherosclerosis
  "I73", // Peripheral vascular disease
  "J43", // Emphysema
  "J44", // COPD
  "J96.1", // Chronic respiratory failure
  "K70.3", // Alcoholic cirrhosis
  "K74", // Fibrosis and cirrhosis of liver
  "M05", // Rheumatoid arthritis with rheumatoid factor
  "M06", // Other rheumatoid arthritis
  "N18", // Chronic kidney disease
  "Z89", // Acquired absence of limb
  "Z94", // Transplanted organ status
  "Z99", // Dependence on enabling machines (incl. home oxygen, dialysis)
];

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9.]/g, "");
}

/** True when a code belongs to a family expected to persist year over year. */
export function isChronicOrPermanent(icd10: string): boolean {
  const code = normalize(icd10);
  return CHRONIC_OR_PERMANENT_PREFIXES.some((prefix) => code.startsWith(normalize(prefix)));
}

export interface RecaptureGap {
  icd10: string;
  /** Human-readable condition name, when the caller has one. */
  name?: string;
  /** Most recent calendar year the code was captured. */
  lastCodedYear: number;
  /** Why it is being surfaced. */
  reason: "chronic-condition-not-recaptured-this-year";
  /** What the clinician is being asked to do — never "add this code". */
  action: string;
}

export interface RecaptureInput {
  /** Codes captured in prior calendar years, with the year each was captured. */
  priorYear: readonly { icd10: string; name?: string; year: number }[];
  /** Codes already captured in the current calendar year. */
  codedThisYear: readonly string[];
  /** Calendar year being scored. */
  currentYear: number;
}

/**
 * Find chronic conditions coded previously but not yet this year.
 *
 * Matching is by three-character category, not by exact code: a patient coded
 * `N18.32` last year and `N18.4` this year has had their CKD re-documented (at a
 * different stage), and flagging that as a gap would be noise.
 */
export function findRecaptureGaps(input: RecaptureInput): RecaptureGap[] {
  const thisYearCategories = new Set(
    input.codedThisYear.map((c) => normalize(c).slice(0, 3)),
  );

  const seen = new Set<string>();
  const gaps: RecaptureGap[] = [];

  // Newest first, so `lastCodedYear` reflects the most recent capture.
  const sorted = [...input.priorYear].sort((a, b) => b.year - a.year);

  for (const prior of sorted) {
    if (prior.year >= input.currentYear) continue;
    const code = normalize(prior.icd10);
    if (seen.has(code)) continue;
    if (!isChronicOrPermanent(code)) continue;
    if (thisYearCategories.has(code.slice(0, 3))) continue;

    seen.add(code);
    gaps.push({
      icd10: prior.icd10,
      name: prior.name,
      lastCodedYear: prior.year,
      reason: "chronic-condition-not-recaptured-this-year",
      action:
        "Re-assess at the next face-to-face visit and document the current status. " +
        "If the condition is no longer active, record that instead — a resolved " +
        "condition should be closed, not carried forward.",
    });
  }

  return gaps;
}

// ── MEAT ────────────────────────────────────────────────────────────────────

export type MeatElement = "monitor" | "evaluate" | "assess" | "treat";

/**
 * Cue phrases for each MEAT element.
 *
 * These are intentionally conservative. A false negative costs a clinician a
 * moment's annoyance; a false positive tells them their documentation is
 * audit-proof when it is not, which is the failure that costs money later.
 */
const MEAT_CUES: Record<MeatElement, readonly string[]> = {
  monitor: [
    "stable",
    "worsening",
    "improving",
    "unchanged",
    "well controlled",
    "poorly controlled",
    "monitoring",
    "followed for",
    "reviewed labs",
    "trend",
  ],
  evaluate: [
    "reviewed",
    "examined",
    "exam reveals",
    "test results",
    "lab results",
    "imaging shows",
    "response to treatment",
    "discussed results",
  ],
  assess: [
    "assessment",
    "impression",
    "differential",
    "likely due to",
    "secondary to",
    "consistent with",
    "attributable to",
    "status:",
  ],
  treat: [
    "continue",
    "started",
    "increased",
    "decreased",
    "titrated",
    "prescribed",
    "refill",
    "referral to",
    "referred to",
    "plan:",
    "medication adjusted",
  ],
};

export interface MeatAssessment {
  /** The condition the note was checked against. */
  condition: string;
  present: readonly MeatElement[];
  missing: readonly MeatElement[];
  /** The phrase that satisfied each element found, for clinician review. */
  matches: readonly { element: MeatElement; phrase: string }[];
  /** True when the note carries at least one MEAT element. */
  adequate: boolean;
  guidance: string;
}

/**
 * Check a note for MEAT evidence.
 *
 * `condition` is used only to report what was checked. The cue search runs over
 * the whole note rather than a window around the condition mention: clinicians
 * routinely document the assessment and plan in a separate section from the
 * problem mention, and a proximity requirement would reject well-documented
 * notes written in the standard SOAP shape.
 */
export function assessMeat(noteText: string, condition: string): MeatAssessment {
  const haystack = noteText.toLowerCase();
  const matches: { element: MeatElement; phrase: string }[] = [];
  const present: MeatElement[] = [];

  for (const element of ["monitor", "evaluate", "assess", "treat"] as const) {
    const hit = MEAT_CUES[element].find((cue) => haystack.includes(cue));
    if (hit) {
      present.push(element);
      matches.push({ element, phrase: hit });
    }
  }

  const missing = (["monitor", "evaluate", "assess", "treat"] as const).filter(
    (e) => !present.includes(e),
  );

  const adequate = present.length > 0;

  return {
    condition,
    present,
    missing,
    matches,
    adequate,
    guidance: adequate
      ? `Note carries ${present.join(", ")} language. Confirm it refers to ${condition} ` +
        "specifically — this check reads the note as a whole, not the sentence."
      : `No monitor/evaluate/assess/treat language found for ${condition}. A problem-list ` +
        "entry alone does not support coding it on this encounter; document what was " +
        "actually done about it.",
  };
}
