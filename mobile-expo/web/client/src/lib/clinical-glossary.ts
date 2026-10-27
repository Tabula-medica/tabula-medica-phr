/**
 * Clinical Terminology Glossary — English-only by design.
 *
 * RULE: Drug names, anatomical terms, diagnostic codes, and dosage
 * units are NEVER machine-translated. A mistranslation of "Ibuprofen"
 * or "mg vs mcg" can cause patient harm.
 *
 * For v1 we render clinical terms in English with an optional
 * lay-language explanation in the user's locale alongside (handled
 * by the calling component, not here).
 *
 * To enable per-language clinical translation in v2:
 *   1. A licensed pharmacist + native speaker reviews each entry
 *   2. Add a `translations: { [lang]: { display, pronunciation } }`
 *      field
 *   3. Mark `humanReviewedAt` with the date and reviewer initials
 *   4. Until then, `clinicalTerm()` MUST return the English form.
 */

export interface ClinicalTerm {
  /** Stable key — used in code references, never displayed. */
  key: string;
  /** English display form — what the user sees in v1. */
  english: string;
  /** Category for filtering and audit. */
  category:
    | "drug_generic"
    | "drug_brand"
    | "anatomy"
    | "diagnosis_icd10"
    | "lab_loinc"
    | "procedure_cpt"
    | "unit"
    | "vital_sign";
  /** Coding system + code, when applicable. */
  code?: { system: string; value: string };
  /**
   * Plain-language explanation suitable for safe machine translation
   * via the standard t() pipeline. e.g. for "Ibuprofen" the explanation
   * "a pain and fever medication" CAN be translated; the drug name
   * itself cannot.
   */
  layExplanationKey?: string;
}

/**
 * The glossary is intentionally small in v1. It lists the terms that
 * appear in our default UI strings. Add an entry whenever a new
 * clinical term enters the codebase.
 */
export const CLINICAL_GLOSSARY: ClinicalTerm[] = [
  // Common analgesics — these appear in care-gap and ambient encounter examples.
  {
    key: "ibuprofen",
    english: "Ibuprofen",
    category: "drug_generic",
    code: { system: "RxNorm", value: "5640" },
    layExplanationKey: "drug.ibuprofen.lay",
  },
  {
    key: "acetaminophen",
    english: "Acetaminophen",
    category: "drug_generic",
    code: { system: "RxNorm", value: "161" },
    layExplanationKey: "drug.acetaminophen.lay",
  },
  // Units that must never be transposed.
  { key: "mg", english: "mg", category: "unit" },
  { key: "mcg", english: "mcg", category: "unit" },
  { key: "g", english: "g", category: "unit" },
  { key: "mL", english: "mL", category: "unit" },
  { key: "iu", english: "IU", category: "unit" },
  // Vital signs.
  { key: "bp_systolic", english: "Systolic BP", category: "vital_sign" },
  { key: "bp_diastolic", english: "Diastolic BP", category: "vital_sign" },
  { key: "hr", english: "Heart Rate", category: "vital_sign" },
  { key: "spo2", english: "SpO₂", category: "vital_sign" },
  { key: "temp_c", english: "Temperature (°C)", category: "vital_sign" },
  { key: "temp_f", english: "Temperature (°F)", category: "vital_sign" },
];

const TERM_BY_KEY = new Map(CLINICAL_GLOSSARY.map((t) => [t.key, t]));

/**
 * Resolve a clinical term for display. ALWAYS English in v1.
 * The optional `language` arg is accepted now so that callers don't
 * have to be refactored when v2 adds per-language reviewed translations.
 */
export function clinicalTerm(key: string, _language?: string): string {
  return TERM_BY_KEY.get(key)?.english ?? key;
}

/**
 * Returns true if a value would be unsafe to render through the
 * standard t() translation pipeline (e.g. a drug name string).
 * Use this in custom components that compose strings.
 */
export function isClinicalKey(key: string): boolean {
  return TERM_BY_KEY.has(key);
}

export function getClinicalTerm(key: string): ClinicalTerm | undefined {
  return TERM_BY_KEY.get(key);
}
