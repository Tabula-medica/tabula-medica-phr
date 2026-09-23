/**
 * Longevity & Preventive Health Protocol — CANONICAL data module.
 *
 * SINGLE SOURCE OF TRUTH for screening windows, biomarker targets and the
 * functional battery used by the PHR (patient app), the clinician chart/EHR,
 * the WorldEHR mirror and the ACP variant.
 *
 * This file is copied VERBATIM into the sibling repos by
 * `scripts/sync-protocol.mjs`. Do NOT hand-edit a copy: edit this file, bump
 * PROTOCOL_VERSION, run the sync script, and let
 * `tests/longevity-protocol.spec.ts` fail loudly (sha256 tripwire) if any copy
 * drifts. Keep the module dependency-free so it copies cleanly.
 *
 * Educational summary of published guidance for workflow and patient-education
 * use. It is NOT clinical decision support and does not replace clinical
 * judgement or individual risk assessment.
 *
 * Guideline basis (see the protocol reference doc for full citations):
 * USPSTF 2018–2025, AHA/ACC 2025 BP, NLA 2024 Lp(a), ADA 2026, CDC ACIP
 * 2025–26, EWGSOP2, Lancet Commission on Dementia 2024.
 */

export const PROTOCOL_VERSION = "2026.09";

export type BiologicalSex = "female" | "male";
export type USPSTFGrade = "A" | "B" | "C" | "I";

/**
 * A screening rule as a pure data record. Eligibility nuance beyond the age
 * window (smoking pack-years, BMI gate, CVD-risk-factor count, etc.) lives in
 * the consuming service — this table holds only the stable scalars so they
 * cannot drift between the app surfaces.
 *
 * `sharedDecision: true` marks Grade C / I items (e.g. PSA): they are surfaced
 * as "discuss", never auto-flagged as an overdue care gap.
 */
export interface ScreeningRule {
  /** Stable code; also the key used in a patient's lastScreenings map. */
  code: string;
  title: string;
  grade: USPSTFGrade;
  ageMin: number;
  ageMax: number;
  /** Recommended interval. `0` = once-in-a-lifetime. */
  intervalMonths: number;
  /** Omit = applies to all; set to restrict by anatomy/biological sex. */
  sex?: BiologicalSex;
  /** Grade C/I: shared-decision item — surface to discuss, do not auto-flag. */
  sharedDecision?: boolean;
}

export const SCREENING_RULES: Record<string, ScreeningRule> = {
  colorectal:   { code: "USPSTF-COLORECTAL-001", title: "Colorectal Cancer Screening",                    grade: "A", ageMin: 45, ageMax: 75,  intervalMonths: 12 },
  breast:       { code: "USPSTF-BREAST-001",     title: "Breast Cancer Screening (Mammography)",           grade: "B", ageMin: 40, ageMax: 74,  intervalMonths: 24, sex: "female" },
  cervical:     { code: "USPSTF-CERVICAL-001",   title: "Cervical Cancer Screening",                       grade: "A", ageMin: 21, ageMax: 65,  intervalMonths: 36, sex: "female" },
  lung:         { code: "USPSTF-LUNG-001",       title: "Lung Cancer Screening (Low-Dose CT)",             grade: "B", ageMin: 50, ageMax: 80,  intervalMonths: 12 },
  diabetes:     { code: "USPSTF-DIABETES-001",   title: "Type 2 Diabetes Screening",                       grade: "B", ageMin: 35, ageMax: 70,  intervalMonths: 36 },
  hypertension: { code: "USPSTF-HTN-001",        title: "Hypertension Screening",                          grade: "A", ageMin: 18, ageMax: 120, intervalMonths: 12 },
  depression:   { code: "USPSTF-DEPRESSION-001", title: "Depression Screening (PHQ-9)",                    grade: "B", ageMin: 18, ageMax: 120, intervalMonths: 12 },
  statin:       { code: "USPSTF-STATIN-001",     title: "Statin Use Assessment for Primary Prevention of CVD", grade: "B", ageMin: 40, ageMax: 75, intervalMonths: 60 },

  // Shared-decision / risk-gated items — present for completeness, NOT auto-flagged.
  psa:          { code: "USPSTF-PSA-001",        title: "Prostate Cancer Screening (PSA)",                 grade: "C", ageMin: 55, ageMax: 69,  intervalMonths: 24, sex: "male", sharedDecision: true },
  aaa:          { code: "USPSTF-AAA-001",        title: "Abdominal Aortic Aneurysm Ultrasound",            grade: "B", ageMin: 65, ageMax: 75,  intervalMonths: 0,  sex: "male", sharedDecision: true },
};

/** For a 18–39 adult with normal BP the hypertension interval extends to this. */
export const HYPERTENSION_INTERVAL_MONTHS_UNDER_40 = 36;

export interface BiomarkerTarget {
  name: string;
  unit: string;
  category: string;
  /** "Optimal" — set tighter than the lab reference interval on purpose. */
  optimal: string;
  /** Beyond this needs a plan (optional; informational). */
  concernBeyond?: string;
}

/**
 * Biomarker targets, aligned to the protocol reference doc. Sex-specific cut
 * points are written "M / F". These values are authoritative — the PHR
 * longevity tracker renders them; do not restate them elsewhere.
 */
export const BIOMARKER_TARGETS: BiomarkerTarget[] = [
  { name: "Fasting Glucose",        unit: "mg/dL",  category: "metabolic",      optimal: "70-99",              concernBeyond: "> 125" },
  { name: "HbA1c",                  unit: "%",      category: "metabolic",      optimal: "< 5.6",              concernBeyond: "> 6.4" },
  { name: "Fasting Insulin",        unit: "µIU/mL", category: "metabolic",      optimal: "< 8",                concernBeyond: "> 15" },
  { name: "HOMA-IR",                unit: "",       category: "metabolic",      optimal: "< 1.5",              concernBeyond: "> 2.5" },
  { name: "Total Cholesterol",      unit: "mg/dL",  category: "cardiovascular", optimal: "< 200" },
  { name: "LDL Cholesterol",        unit: "mg/dL",  category: "cardiovascular", optimal: "< 100",              concernBeyond: "> 130" },
  { name: "HDL Cholesterol",        unit: "mg/dL",  category: "cardiovascular", optimal: "> 40 M / > 50 F",    concernBeyond: "< 35 M / < 40 F" },
  { name: "Triglycerides",          unit: "mg/dL",  category: "cardiovascular", optimal: "< 100",              concernBeyond: "> 150" },
  { name: "ApoB",                   unit: "mg/dL",  category: "cardiovascular", optimal: "< 80",               concernBeyond: "> 100" },
  { name: "Lp(a)",                  unit: "nmol/L", category: "cardiovascular", optimal: "< 75",               concernBeyond: "≥ 125" },
  { name: "hs-CRP",                 unit: "mg/L",   category: "inflammatory",   optimal: "< 1.0",              concernBeyond: "> 3.0" },
  { name: "Homocysteine",           unit: "µmol/L", category: "inflammatory",   optimal: "< 10",               concernBeyond: "> 15" },
  { name: "IL-6",                   unit: "pg/mL",  category: "inflammatory",   optimal: "< 1.8" },
  { name: "TNF-alpha",              unit: "pg/mL",  category: "inflammatory",   optimal: "< 8.1" },
  { name: "Testosterone (Total)",   unit: "ng/dL",  category: "hormonal",       optimal: "varies" },
  { name: "Free Testosterone",      unit: "pg/mL",  category: "hormonal",       optimal: "varies" },
  { name: "DHEA-S",                 unit: "µg/dL",  category: "hormonal",       optimal: "varies by age" },
  { name: "Cortisol (AM)",          unit: "µg/dL",  category: "hormonal",       optimal: "6-18" },
  { name: "TSH",                    unit: "mIU/L",  category: "hormonal",       optimal: "0.5-4.0",            concernBeyond: "< 0.1 / > 10" },
  { name: "Free T3",                unit: "pg/mL",  category: "hormonal",       optimal: "3.0-4.0" },
  { name: "Free T4",                unit: "ng/dL",  category: "hormonal",       optimal: "1.0-1.5" },
  { name: "IGF-1",                  unit: "ng/mL",  category: "hormonal",       optimal: "varies by age" },
  { name: "Vitamin D (25-OH)",      unit: "ng/mL",  category: "nutritional",    optimal: "30-60",              concernBeyond: "< 20 / > 100" },
  { name: "Vitamin B12",            unit: "pg/mL",  category: "nutritional",    optimal: "> 400",              concernBeyond: "< 200" },
  { name: "Ferritin",               unit: "ng/mL",  category: "nutritional",    optimal: "40-200 M / 30-150 F", concernBeyond: "< 15 / > 300" },
  { name: "Magnesium (RBC)",        unit: "mg/dL",  category: "nutritional",    optimal: "5.0-6.5" },
  { name: "Omega-3 Index",          unit: "%",      category: "nutritional",    optimal: "> 8",                concernBeyond: "< 4" },
  { name: "Zinc",                   unit: "µg/dL",  category: "nutritional",    optimal: "80-120" },
  { name: "eGFR (creatinine + cystatin C)", unit: "mL/min", category: "organ",  optimal: "≥ 90",               concernBeyond: "< 60" },
  { name: "Cystatin C",             unit: "mg/L",   category: "organ",          optimal: "0.5-1.0" },
  { name: "Urine ACR",              unit: "mg/g",   category: "organ",          optimal: "< 10",               concernBeyond: "> 30" },
  { name: "ALT",                    unit: "U/L",    category: "organ",          optimal: "< 30 M / < 25 F",    concernBeyond: "> 40 M / > 35 F" },
  { name: "AST",                    unit: "U/L",    category: "organ",          optimal: "< 25" },
  { name: "GGT",                    unit: "U/L",    category: "organ",          optimal: "< 30",               concernBeyond: "> 50" },
  { name: "Uric Acid",              unit: "mg/dL",  category: "organ",          optimal: "< 6.0 M / < 5.5 F",  concernBeyond: "> 7.0" },
];

/**
 * The five numbers that matter most for lifespan — the headline of the
 * protocol and the anchors the visit is built around.
 */
export const FIVE_NUMBERS = [
  { key: "apob",   label: "ApoB",                    target: "< 80 mg/dL",        note: "< 60 with CAC > 0, diabetes or CVD; counts every atherogenic particle." },
  { key: "bp",     label: "Home blood pressure",     target: "< 120/80",          note: "Target < 130/80 for nearly all adults (AHA/ACC 2025)." },
  { key: "glycemic", label: "HbA1c · fasting insulin", target: "< 5.6 % · < 8 µIU/mL", note: "Insulin resistance precedes diabetes by ~a decade." },
  { key: "vo2max", label: "VO₂ max",                 target: "Top quartile for age", note: "Strongest single predictor of all-cause mortality." },
  { key: "grip",   label: "Grip strength",           target: "≥ 40 kg M · ≥ 25 kg F", note: "Sarcopenia range < 27 / < 16 kg (EWGSOP2)." },
] as const;

export interface FunctionalTarget {
  name: string;
  /** Target expressed as "M / F" where sex-specific. */
  target: string;
  intervalMonths: number;
  note?: string;
}

/** Functional / fitness battery — measured in the room, strong survival signal. */
export const FUNCTIONAL_TARGETS: FunctionalTarget[] = [
  { name: "VO₂ max",              target: "top quartile for age",                intervalMonths: 12, note: "e.g. 50s ≥ 40 M / 33 F mL/kg/min" },
  { name: "Grip strength",        target: "≥ 40 kg M / ≥ 25 kg F",               intervalMonths: 12, note: "sarcopenia < 27 / < 16 kg" },
  { name: "Gait speed (4 m)",     target: "≥ 1.0 m/s (≥ 1.3 best)",              intervalMonths: 12, note: "< 0.8 m/s frailty" },
  { name: "30-second chair stand", target: "≥ 12 (age-banded)",                  intervalMonths: 12, note: "CDC STEADI norms" },
  { name: "Single-leg stance",    target: "≥ 10 s (≥ 30 s excellent)",           intervalMonths: 12, note: "failure: +84% mortality over 7 y" },
  { name: "Push-ups",             target: "≥ 40 M / ≥ 15 F",                     intervalMonths: 12 },
  { name: "Dead hang",            target: "≥ 60 s M / ≥ 40 s F",                 intervalMonths: 12 },
  { name: "ALMI (DEXA)",          target: "≥ 7.0 M / ≥ 5.5 F kg/m²",             intervalMonths: 12 },
];
