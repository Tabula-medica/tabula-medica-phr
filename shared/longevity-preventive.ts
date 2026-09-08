/**
 * Longevity & Preventive Health protocol — portable, dependency-free module.
 *
 * Shared by the PHR web client, the PHR API, and (by mirroring, the same way the
 * ABDM lib was mirrored in the other direction) the WorldEHR clinician product.
 * Nothing in here touches PHI storage: callers pass an anonymous profile in and
 * get a plan out. Keep this file free of React, Express and Node imports.
 *
 * Content is educational and guideline-derived (USPSTF, ACC/AHA 2025 BP, ADA
 * Standards of Care, ACIP adult schedule, NLA/ESC lipid statements, EWGSOP2,
 * WHO PEN / ESC 2021 for the international profile). It is NOT clinical decision
 * support: the UI must keep the "discuss with your clinician" framing and this
 * module must never auto-order or auto-prescribe.
 */

export const LONGEVITY_PROTOCOL_VERSION = "2026.09";

export type Sex = "male" | "female";
export type GuidelineRegion = "us" | "international";
export type UnitSystem = "conventional" | "si";
export type SmokingStatus = "never" | "former" | "current";

export type PlanCategory =
  | "cardiometabolic"
  | "cancer_screening"
  | "infectious_disease"
  | "bone_muscle"
  | "brain_mood"
  | "sensory"
  | "immunization"
  | "lifestyle";

export type PlanItemStatus = "due" | "upcoming" | "up_to_date" | "discuss";

export interface LongevityProfile {
  age: number;
  sex: Sex;
  smokingStatus?: SmokingStatus;
  packYears?: number;
  /** Years since quitting; only meaningful when smokingStatus === "former". */
  quitYears?: number;
  bmi?: number;
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
  hasCardiovascularDisease?: boolean;
  hasChronicKidneyDisease?: boolean;
  familyHistoryPrematureCvd?: boolean;
  familyHistoryColorectalCancer?: boolean;
  familyHistoryBreastOrOvarianCancer?: boolean;
  postmenopausal?: boolean;
  immunocompromised?: boolean;
  /** South Asian / East Asian ancestry changes BMI and waist cut-points. */
  asianAncestry?: boolean;
}

export interface ScreeningDefinition {
  id: string;
  title: string;
  category: PlanCategory;
  /** Plain-language "what and how often". */
  cadence: string;
  /** Repeat interval in months; 0 = one-time or "as advised". */
  frequencyMonths: number;
  ageStart: number;
  ageEnd: number;
  sex: Sex | "all";
  /** Grade or strength label as published by the source body. */
  grade: string;
  source: { us: string; international: string };
  whyItMatters: string;
  /** Returns true when the recommendation applies. Undefined = age/sex only. */
  appliesWhen?: (p: LongevityProfile) => boolean;
  /** Set when a positive risk factor pulls the start age earlier. */
  earlierStartWhen?: { predicate: (p: LongevityProfile) => boolean; ageStart: number; note: string };
  /** "discuss" items are shared-decision, not default-order. */
  sharedDecision?: boolean;
  /** Optional per-region override of cadence / age window. */
  regionOverride?: Partial<Record<GuidelineRegion, { cadence?: string; ageStart?: number; ageEnd?: number; frequencyMonths?: number; grade?: string }>>;
}

export interface BiomarkerTarget {
  id: string;
  name: string;
  group: "lipids" | "glycemic" | "inflammation" | "kidney_liver" | "nutritional" | "hormonal" | "blood_pressure" | "body_composition";
  conventionalUnit: string;
  siUnit?: string;
  /** Multiply a conventional value by this to get SI. */
  siFactor?: number;
  /** Optimal (longevity-oriented) range in conventional units. */
  optimal: { min?: number; max?: number; bySex?: Partial<Record<Sex, { min?: number; max?: number }>> };
  /** Borderline band edge in conventional units; beyond this is "concern". */
  concernBeyond?: { min?: number; max?: number; bySex?: Partial<Record<Sex, { min?: number; max?: number }>> };
  cadence: string;
  note: string;
}

export interface FunctionalMarker {
  id: string;
  name: string;
  unit: string;
  cadence: string;
  /** Free-text threshold guidance shown to clinicians and patients. */
  target: { male: string; female: string };
  whyItMatters: string;
  howToMeasure: string;
}

export interface LifestylePillar {
  id: string;
  title: string;
  target: string;
  evidence: string;
  checkIns: string[];
}

export interface VaccineDefinition {
  id: string;
  name: string;
  ageStart: number;
  ageEnd: number;
  schedule: { us: string; international: string };
  frequencyMonths: number;
  appliesWhen?: (p: LongevityProfile) => boolean;
  note: string;
}

export interface PlanItem {
  id: string;
  title: string;
  category: PlanCategory;
  cadence: string;
  frequencyMonths: number;
  grade: string;
  source: string;
  whyItMatters: string;
  status: PlanItemStatus;
  lastDone?: string;
  nextDue?: string;
  note?: string;
}

export interface LongevityPlan {
  protocolVersion: string;
  region: GuidelineRegion;
  generatedAt: string;
  profile: LongevityProfile;
  screenings: PlanItem[];
  vaccines: PlanItem[];
  biomarkers: BiomarkerTarget[];
  functional: FunctionalMarker[];
  lifestyle: LifestylePillar[];
  counts: { due: number; upcoming: number; upToDate: number; discuss: number };
}

export type BiomarkerStatus = "optimal" | "borderline" | "concern" | "unknown";

// ---------------------------------------------------------------------------
// Screening schedule
// ---------------------------------------------------------------------------

const everSmoked = (p: LongevityProfile) => p.smokingStatus === "current" || p.smokingStatus === "former";
const heavySmokingHistory = (p: LongevityProfile) =>
  (p.packYears ?? 0) >= 20 && (p.smokingStatus === "current" || (p.smokingStatus === "former" && (p.quitYears ?? 99) <= 15));
const overweight = (p: LongevityProfile) => (p.bmi ?? 0) >= (p.asianAncestry ? 23 : 25);
const elevatedCvRisk = (p: LongevityProfile) =>
  Boolean(p.hasDiabetes || p.hasHypertension || p.hasCardiovascularDisease || p.familyHistoryPrematureCvd || p.smokingStatus === "current" || p.hasChronicKidneyDisease);

export const PREVENTIVE_SCREENINGS: ScreeningDefinition[] = [
  {
    id: "blood-pressure",
    title: "Blood pressure check",
    category: "cardiometabolic",
    cadence: "Every year (every 3–6 months if elevated or on treatment). Target below 130/80.",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF A · AHA/ACC 2025",
    source: { us: "USPSTF 2021; AHA/ACC 2025 Hypertension Guideline (PREVENT risk)", international: "WHO HEARTS; ESC/ESH 2024" },
    whyItMatters: "Hypertension is the single largest modifiable driver of stroke, heart failure, kidney failure and dementia. Home readings beat office readings.",
  },
  {
    id: "lipids-apob",
    title: "Lipid panel with ApoB",
    category: "cardiometabolic",
    cadence: "Baseline at 20, then every 4–6 years if optimal; yearly if treated or ApoB above target.",
    frequencyMonths: 60,
    ageStart: 20,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF B (40–75 statin assessment) · ACC/AHA",
    source: { us: "USPSTF 2022; ACC/AHA 2018 Cholesterol; NLA 2024 ApoB statement", international: "ESC/EAS 2019 Dyslipidaemia; ESC 2021 Prevention (SCORE2)" },
    whyItMatters: "ApoB counts every atherogenic particle and predicts risk better than LDL-C alone. Exposure is cumulative, so earlier control buys more years.",
  },
  {
    id: "lipoprotein-a",
    title: "Lipoprotein(a), once in a lifetime",
    category: "cardiometabolic",
    cadence: "One measurement in adulthood; repeat only if a therapy changes it.",
    frequencyMonths: 0,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "NLA 2024 · ESC 2022 consensus",
    source: { us: "National Lipid Association 2024 scientific statement", international: "EAS 2022 consensus statement" },
    whyItMatters: "Lp(a) is inherited, unaffected by lifestyle, and elevated in roughly 1 in 5 people. A high value reclassifies risk and changes how aggressively ApoB should be lowered.",
  },
  {
    id: "diabetes-screen",
    title: "HbA1c or fasting glucose",
    category: "cardiometabolic",
    cadence: "Every 3 years from age 35 (every year if prediabetes or BMI ≥ 25 / ≥ 23 Asian ancestry).",
    frequencyMonths: 36,
    ageStart: 35,
    ageEnd: 70,
    sex: "all",
    grade: "USPSTF B · ADA",
    source: { us: "USPSTF 2021; ADA Standards of Care 2026", international: "WHO/IDF; ESC 2023 Diabetes & CVD" },
    whyItMatters: "Half of people with type 2 diabetes are undiagnosed for years. Catching insulin resistance early keeps the reversible window open.",
    appliesWhen: (p) => !p.hasDiabetes,
    earlierStartWhen: { predicate: (p) => overweight(p) || p.familyHistoryPrematureCvd === true || p.hasHypertension === true, ageStart: 18, note: "Start early: overweight, hypertension or family history present." },
    regionOverride: { international: { cadence: "Every 3 years from age 30–35 per national NCD programme (India NP-NCD: yearly from 30).", ageStart: 30 } },
  },
  {
    id: "kidney-uacr",
    title: "Kidney check: eGFR + urine albumin-creatinine ratio",
    category: "cardiometabolic",
    cadence: "Every year if diabetes, hypertension, CVD or CKD; otherwise with routine bloods.",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "KDIGO 2024 · ADA",
    source: { us: "KDIGO 2024 CKD Guideline; ADA 2026", international: "KDIGO 2024" },
    whyItMatters: "Albuminuria is an early, cheap signal of vascular damage and is under-tested even in diabetes clinics.",
    appliesWhen: (p) => Boolean(p.hasDiabetes || p.hasHypertension || p.hasCardiovascularDisease || p.hasChronicKidneyDisease || p.age >= 60),
  },
  {
    id: "coronary-calcium",
    title: "Coronary artery calcium (CAC) score",
    category: "cardiometabolic",
    cadence: "One-time between 40 and 75 when risk is intermediate or uncertain; repeat in 3–5 years if zero and risk factors persist.",
    frequencyMonths: 0,
    ageStart: 40,
    ageEnd: 75,
    sex: "all",
    grade: "ACC/AHA Class IIa (risk-based)",
    source: { us: "ACC/AHA 2019 Primary Prevention", international: "ESC 2021 Prevention (may be considered)" },
    whyItMatters: "A zero score can safely de-escalate therapy; a high score is the strongest single argument for early, aggressive ApoB lowering.",
    sharedDecision: true,
    appliesWhen: (p) => elevatedCvRisk(p) || p.age >= 50,
  },
  {
    id: "colorectal",
    title: "Colorectal cancer screening",
    category: "cancer_screening",
    cadence: "Ages 45–75: colonoscopy every 10 years, or FIT every year, or stool DNA every 1–3 years.",
    frequencyMonths: 120,
    ageStart: 45,
    ageEnd: 75,
    sex: "all",
    grade: "USPSTF A (50–75) / B (45–49)",
    source: { us: "USPSTF 2021", international: "EU Council 2022 (FIT 50–74); WHO IARC" },
    whyItMatters: "Incidence under 50 is rising; screening removes precancerous polyps rather than just finding cancer early.",
    earlierStartWhen: { predicate: (p) => p.familyHistoryColorectalCancer === true, ageStart: 40, note: "First-degree relative with colorectal cancer: start at 40 (or 10 years before their diagnosis) with colonoscopy." },
    regionOverride: { international: { ageStart: 50, ageEnd: 74, cadence: "Ages 50–74: FIT every 2 years (EU) or colonoscopy every 10 years where available." } },
  },
  {
    id: "breast",
    title: "Mammography",
    category: "cancer_screening",
    cadence: "Every 2 years, ages 40–74 (yearly if dense breasts or elevated risk, with supplemental imaging as advised).",
    frequencyMonths: 24,
    ageStart: 40,
    ageEnd: 74,
    sex: "female",
    grade: "USPSTF B (2024)",
    source: { us: "USPSTF April 2024", international: "WHO / EU: 50–69 biennial; 45–49 and 70–74 conditional" },
    whyItMatters: "The 2024 update moved the start age to 40 because breast cancer incidence in women 40–49 has risen about 2 percent a year.",
    earlierStartWhen: { predicate: (p) => p.familyHistoryBreastOrOvarianCancer === true, ageStart: 30, note: "Family history of breast or ovarian cancer: consider genetic counselling and MRI-based screening from 30." },
    regionOverride: { international: { ageStart: 50, ageEnd: 69, cadence: "Every 2 years, ages 50–69 (extend to 45–74 per national programme)." } },
  },
  {
    id: "cervical",
    title: "Cervical cancer screening",
    category: "cancer_screening",
    cadence: "21–29: cytology every 3 years. 30–65: primary HPV test every 5 years (self-collection now FDA-cleared).",
    frequencyMonths: 60,
    ageStart: 21,
    ageEnd: 65,
    sex: "female",
    grade: "USPSTF A",
    source: { us: "USPSTF 2018 (2024 draft: HPV primary 30–65, self-collection)", international: "WHO 2021: HPV DNA every 5–10 years from 30" },
    whyItMatters: "HPV-based screening prevents cancer rather than detecting it. Stop at 65 only after adequate negative screening.",
    regionOverride: { international: { ageStart: 30, cadence: "HPV DNA test every 5–10 years, ages 30–49 minimum (WHO elimination strategy)." } },
  },
  {
    id: "lung",
    title: "Low-dose CT lung screening",
    category: "cancer_screening",
    cadence: "Every year, ages 50–80, if 20+ pack-years and currently smoking or quit within 15 years.",
    frequencyMonths: 12,
    ageStart: 50,
    ageEnd: 80,
    sex: "all",
    grade: "USPSTF B",
    source: { us: "USPSTF 2021", international: "EU Council 2022 (implement via pilots); UK TLHC" },
    whyItMatters: "LDCT cuts lung-cancer mortality by 20 percent in eligible adults and most eligible people are still never offered it.",
    appliesWhen: heavySmokingHistory,
  },
  {
    id: "prostate",
    title: "PSA (shared decision)",
    category: "cancer_screening",
    cadence: "Discuss at 55–69 (from 40–45 if Black ancestry or family history). If chosen, every 2 years.",
    frequencyMonths: 24,
    ageStart: 55,
    ageEnd: 69,
    sex: "male",
    grade: "USPSTF C",
    source: { us: "USPSTF 2018; AUA 2023", international: "EAU 2024 risk-adapted strategy" },
    whyItMatters: "Benefit is real but modest; MRI-first pathways have reduced over-diagnosis, which shifts the balance toward informed screening.",
    sharedDecision: true,
  },
  {
    id: "aaa",
    title: "Abdominal aortic aneurysm ultrasound",
    category: "cardiometabolic",
    cadence: "One-time ultrasound, men 65–75 who have ever smoked.",
    frequencyMonths: 0,
    ageStart: 65,
    ageEnd: 75,
    sex: "male",
    grade: "USPSTF B",
    source: { us: "USPSTF 2019", international: "ESVS 2024; NHS AAA programme (men at 65)" },
    whyItMatters: "A ruptured AAA is usually fatal; a single scan finds most aneurysms while they can be watched or repaired electively.",
    appliesWhen: everSmoked,
  },
  {
    id: "bone-density",
    title: "Bone density (DXA)",
    category: "bone_muscle",
    cadence: "Women 65+ (earlier if postmenopausal with risk factors, FRAX ≥ 8.4 percent). Men 70+ or with risk factors.",
    frequencyMonths: 24,
    ageStart: 65,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF B (women) · BHOF (men 70+)",
    source: { us: "USPSTF 2025; Bone Health & Osteoporosis Foundation", international: "IOF; NOGG 2021" },
    whyItMatters: "A hip fracture after 70 carries a one-year mortality of 20–30 percent. DXA plus a FRAX score turns that into a treatable number.",
    earlierStartWhen: { predicate: (p) => p.sex === "female" && p.postmenopausal === true, ageStart: 50, note: "Postmenopausal: calculate FRAX; DXA if 10-year major fracture risk ≥ 8.4 percent or other risk factors." },
    appliesWhen: (p) => p.sex === "female" || p.age >= 70,
  },
  {
    id: "hepatitis-c",
    title: "Hepatitis C antibody, once",
    category: "infectious_disease",
    cadence: "One-time test for all adults 18–79 (repeat if ongoing risk).",
    frequencyMonths: 0,
    ageStart: 18,
    ageEnd: 79,
    sex: "all",
    grade: "USPSTF B",
    source: { us: "USPSTF 2020; CDC", international: "WHO 2022 (test all adults where prevalence ≥ 2 percent)" },
    whyItMatters: "Curable in 8–12 weeks; untreated it is a leading cause of liver cancer.",
  },
  {
    id: "hiv",
    title: "HIV test, once",
    category: "infectious_disease",
    cadence: "One-time test ages 15–65; yearly if ongoing risk.",
    frequencyMonths: 0,
    ageStart: 15,
    ageEnd: 65,
    sex: "all",
    grade: "USPSTF A",
    source: { us: "USPSTF 2019; CDC", international: "WHO consolidated HIV testing guidelines" },
    whyItMatters: "Early treatment normalises life expectancy and prevents transmission.",
  },
  {
    id: "hepatitis-b",
    title: "Hepatitis B triple panel, once",
    category: "infectious_disease",
    cadence: "One-time HBsAg, anti-HBs, anti-HBc for all adults; vaccinate if non-immune.",
    frequencyMonths: 0,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "CDC 2023",
    source: { us: "CDC MMWR March 2023", international: "WHO 2024 hepatitis B guideline" },
    whyItMatters: "Identifies the roughly two-thirds of chronic carriers who do not know, and closes the vaccination gap in one visit.",
  },
  {
    id: "depression-anxiety",
    title: "Mood check (PHQ-2/PHQ-9, GAD-2/GAD-7)",
    category: "brain_mood",
    cadence: "Every year, and at any visit where sleep, energy or function has changed.",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF B",
    source: { us: "USPSTF 2023 (depression, anxiety ≤ 64)", international: "WHO mhGAP" },
    whyItMatters: "Untreated depression roughly doubles cardiovascular risk and halves adherence to everything else in this plan.",
  },
  {
    id: "alcohol-tobacco",
    title: "Alcohol and tobacco/nicotine review",
    category: "lifestyle",
    cadence: "Every year (AUDIT-C; ask about vaping and smokeless tobacco).",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF A (tobacco) · B (alcohol)",
    source: { us: "USPSTF 2021 / 2018", international: "WHO SAFER; WHO FCTC" },
    whyItMatters: "Tobacco cessation is still the highest-yield intervention in medicine; for alcohol, less is better at every level.",
  },
  {
    id: "cognitive",
    title: "Cognitive screen (Mini-Cog or MoCA)",
    category: "brain_mood",
    cadence: "Every year from 65 as part of the wellness visit; earlier if concerns.",
    frequencyMonths: 12,
    ageStart: 65,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF I · Medicare AWV requirement",
    source: { us: "CMS Annual Wellness Visit; Alzheimer's Association", international: "WHO Risk reduction of cognitive decline 2019" },
    whyItMatters: "Treating hearing loss, hypertension and sleep apnoea are the modifiable levers; new anti-amyloid therapies also need early detection.",
  },
  {
    id: "hearing-vision",
    title: "Hearing and vision check",
    category: "sensory",
    cadence: "Hearing every 3 years from 50 (yearly from 65). Dilated eye exam every 1–2 years from 65, or yearly with diabetes.",
    frequencyMonths: 24,
    ageStart: 50,
    ageEnd: 120,
    sex: "all",
    grade: "AAO · ACHIEVE trial (hearing)",
    source: { us: "American Academy of Ophthalmology; ACHIEVE 2023", international: "WHO World Report on Hearing 2021" },
    whyItMatters: "Correcting hearing loss slowed cognitive decline by 48 percent in high-risk older adults in the ACHIEVE trial.",
    earlierStartWhen: { predicate: (p) => p.hasDiabetes === true, ageStart: 18, note: "Diabetes: yearly dilated retinal exam from diagnosis." },
  },
  {
    id: "falls-function",
    title: "Falls, gait and strength assessment",
    category: "bone_muscle",
    cadence: "Every year from 65: gait speed, 30-second chair stand, single-leg stance, grip strength.",
    frequencyMonths: 12,
    ageStart: 65,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF B (exercise to prevent falls)",
    source: { us: "USPSTF 2024; CDC STEADI", international: "World Falls Guidelines 2022" },
    whyItMatters: "Falls are the leading cause of injury death after 65 and the functional markers here predict it years ahead.",
  },
  {
    id: "skin",
    title: "Skin check",
    category: "cancer_screening",
    cadence: "Self-exam monthly; clinician exam yearly if fair skin, many moles, prior skin cancer or heavy sun exposure.",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "USPSTF I (risk-based)",
    source: { us: "USPSTF 2023; AAD", international: "EADO / national guidance" },
    whyItMatters: "Melanoma found at stage I has a 99 percent five-year survival; found late it is below 35 percent.",
    sharedDecision: true,
  },
  {
    id: "dental",
    title: "Dental exam and cleaning",
    category: "lifestyle",
    cadence: "Every 6–12 months.",
    frequencyMonths: 12,
    ageStart: 18,
    ageEnd: 120,
    sex: "all",
    grade: "ADA · consensus",
    source: { us: "American Dental Association", international: "FDI World Dental Federation" },
    whyItMatters: "Periodontal disease is independently linked to cardiovascular events, diabetes control and dementia risk.",
  },
];

// ---------------------------------------------------------------------------
// Immunizations (adult)
// ---------------------------------------------------------------------------

export const ADULT_VACCINES: VaccineDefinition[] = [
  {
    id: "influenza",
    name: "Influenza",
    ageStart: 18,
    ageEnd: 120,
    schedule: { us: "Every autumn; high-dose or adjuvanted formulation from 65.", international: "Yearly, prioritised for 65+, pregnancy and chronic disease (WHO)." },
    frequencyMonths: 12,
    note: "Reduces cardiovascular events after infection as well as flu itself.",
  },
  {
    id: "covid-19",
    name: "COVID-19 (current season formula)",
    ageStart: 18,
    ageEnd: 120,
    schedule: { us: "Updated dose each season; strongly advised 65+ and high-risk (shared clinical decision for others per 2025 ACIP).", international: "Per national programme; WHO prioritises 60+/high-risk." },
    frequencyMonths: 12,
    note: "Timing with the flu dose is fine.",
  },
  {
    id: "rsv",
    name: "RSV",
    ageStart: 50,
    ageEnd: 120,
    schedule: { us: "Single dose at 75+, or 50–74 with a risk condition (ACIP 2025).", international: "Where licensed: single dose 60+/75+ per national advice." },
    frequencyMonths: 0,
    appliesWhen: (p) => p.age >= 75 || (p.age >= 50 && Boolean(p.hasDiabetes || p.hasCardiovascularDisease || p.hasChronicKidneyDisease || p.immunocompromised || (p.bmi ?? 0) >= 40)),
    note: "One dose so far; no booster recommended yet.",
  },
  {
    id: "zoster",
    name: "Shingles (recombinant zoster, 2 doses)",
    ageStart: 50,
    ageEnd: 120,
    schedule: { us: "Two doses 2–6 months apart from 50 (from 19 if immunocompromised).", international: "Two doses from 50 where available." },
    frequencyMonths: 0,
    note: "Observational data link zoster vaccination to lower dementia incidence.",
  },
  {
    id: "pneumococcal",
    name: "Pneumococcal (PCV20 or PCV21)",
    ageStart: 50,
    ageEnd: 120,
    schedule: { us: "Single conjugate dose at 50+ (ACIP Oct 2024), or earlier with risk conditions.", international: "Per national schedule; typically 65+ or risk-based." },
    frequencyMonths: 0,
    appliesWhen: (p) => p.age >= 50 || Boolean(p.hasDiabetes || p.hasCardiovascularDisease || p.hasChronicKidneyDisease || p.immunocompromised || p.smokingStatus === "current"),
    note: "One conjugate dose usually completes the series for adults.",
  },
  {
    id: "tdap",
    name: "Tdap / Td",
    ageStart: 18,
    ageEnd: 120,
    schedule: { us: "Tdap once as an adult, then Td or Tdap every 10 years.", international: "Td booster every 10 years (WHO)." },
    frequencyMonths: 120,
    note: "Also each pregnancy (27–36 weeks).",
  },
  {
    id: "hpv",
    name: "HPV",
    ageStart: 18,
    ageEnd: 45,
    schedule: { us: "Complete series through 26; shared decision 27–45.", international: "Per national programme; WHO single-dose schedule endorsed." },
    frequencyMonths: 0,
    note: "Prevents cervical, anal and oropharyngeal cancers.",
  },
  {
    id: "hepatitis-b-vaccine",
    name: "Hepatitis B",
    ageStart: 18,
    ageEnd: 59,
    schedule: { us: "Universal 2- or 3-dose series for adults 19–59; 60+ with risk or on request.", international: "Vaccinate non-immune adults (WHO)." },
    frequencyMonths: 0,
    note: "Check the triple panel first if never tested.",
  },
];

// ---------------------------------------------------------------------------
// Longevity biomarker targets (optimal, not merely "in range")
// ---------------------------------------------------------------------------

export const BIOMARKER_TARGETS: BiomarkerTarget[] = [
  { id: "apob", name: "ApoB", group: "lipids", conventionalUnit: "mg/dL", siUnit: "g/L", siFactor: 0.01, optimal: { max: 80 }, concernBeyond: { max: 100 }, cadence: "Yearly (every 4–6 years if optimal and untreated)", note: "Under 60 mg/dL if CAC > 0, diabetes or established CVD." },
  { id: "ldl", name: "LDL cholesterol", group: "lipids", conventionalUnit: "mg/dL", siUnit: "mmol/L", siFactor: 0.02586, optimal: { max: 100 }, concernBeyond: { max: 130 }, cadence: "With ApoB", note: "Under 70 mg/dL when risk is high; ApoB should lead the decision." },
  { id: "lpa", name: "Lipoprotein(a)", group: "lipids", conventionalUnit: "nmol/L", optimal: { max: 75 }, concernBeyond: { max: 125 }, cadence: "Once in a lifetime", note: "≥ 125 nmol/L (≈ 50 mg/dL) is high; treat other risk factors harder." },
  { id: "triglycerides", name: "Triglycerides (fasting)", group: "lipids", conventionalUnit: "mg/dL", siUnit: "mmol/L", siFactor: 0.01129, optimal: { max: 100 }, concernBeyond: { max: 150 }, cadence: "Yearly", note: "A sensitive marker of insulin resistance and refined-carbohydrate load." },
  { id: "hdl", name: "HDL cholesterol", group: "lipids", conventionalUnit: "mg/dL", siUnit: "mmol/L", siFactor: 0.02586, optimal: { bySex: { male: { min: 40 }, female: { min: 50 } } }, concernBeyond: { bySex: { male: { min: 35 }, female: { min: 40 } } }, cadence: "Yearly", note: "Low HDL flags risk; raising it with drugs does not lower risk." },
  { id: "hba1c", name: "HbA1c", group: "glycemic", conventionalUnit: "%", siUnit: "mmol/mol", siFactor: 10.929, optimal: { max: 5.6 }, concernBeyond: { max: 6.4 }, cadence: "Every 1–3 years (every 3–6 months if diabetes)", note: "5.7–6.4 percent is prediabetes; 6.5 percent or more is diabetes." },
  { id: "fasting-glucose", name: "Fasting glucose", group: "glycemic", conventionalUnit: "mg/dL", siUnit: "mmol/L", siFactor: 0.0555, optimal: { min: 70, max: 99 }, concernBeyond: { max: 125 }, cadence: "With HbA1c", note: "100–125 mg/dL is impaired fasting glucose." },
  { id: "fasting-insulin", name: "Fasting insulin", group: "glycemic", conventionalUnit: "µIU/mL", siUnit: "pmol/L", siFactor: 6.945, optimal: { max: 8 }, concernBeyond: { max: 15 }, cadence: "Yearly if metabolic risk", note: "Rises a decade before glucose does; pair with triglyceride:HDL ratio." },
  { id: "homa-ir", name: "HOMA-IR", group: "glycemic", conventionalUnit: "index", optimal: { max: 1.5 }, concernBeyond: { max: 2.5 }, cadence: "Calculated: glucose (mg/dL) × insulin ÷ 405", note: "Above 2.5 indicates insulin resistance." },
  { id: "hscrp", name: "hs-CRP", group: "inflammation", conventionalUnit: "mg/L", optimal: { max: 1.0 }, concernBeyond: { max: 3.0 }, cadence: "Yearly (repeat if > 10, likely acute illness)", note: "Residual inflammatory risk adds to lipid risk; sleep, visceral fat and gum disease move it." },
  { id: "homocysteine", name: "Homocysteine", group: "inflammation", conventionalUnit: "µmol/L", optimal: { max: 10 }, concernBeyond: { max: 15 }, cadence: "Once, repeat if elevated", note: "Responds to folate, B12 and B6; elevated levels track with vascular and cognitive risk." },
  { id: "egfr", name: "eGFR (creatinine + cystatin C)", group: "kidney_liver", conventionalUnit: "mL/min/1.73m²", optimal: { min: 90 }, concernBeyond: { min: 60 }, cadence: "Yearly", note: "Cystatin C corrects for muscle mass and is the better longevity marker." },
  { id: "uacr", name: "Urine albumin-creatinine ratio", group: "kidney_liver", conventionalUnit: "mg/g", siUnit: "mg/mmol", siFactor: 0.113, optimal: { max: 10 }, concernBeyond: { max: 30 }, cadence: "Yearly if diabetes, hypertension or CKD", note: "Even 10–30 mg/g predicts cardiovascular events." },
  { id: "alt", name: "ALT", group: "kidney_liver", conventionalUnit: "U/L", optimal: { bySex: { male: { max: 30 }, female: { max: 25 } } }, concernBeyond: { bySex: { male: { max: 40 }, female: { max: 35 } } }, cadence: "Yearly", note: "Lab 'normal' ranges run high; MASLD often hides at 30–40 U/L. Use FIB-4 if elevated." },
  { id: "ggt", name: "GGT", group: "kidney_liver", conventionalUnit: "U/L", optimal: { max: 30 }, concernBeyond: { max: 50 }, cadence: "Yearly", note: "Sensitive to alcohol, fatty liver and oxidative stress." },
  { id: "uric-acid", name: "Uric acid", group: "kidney_liver", conventionalUnit: "mg/dL", siUnit: "µmol/L", siFactor: 59.48, optimal: { bySex: { male: { max: 6.0 }, female: { max: 5.5 } } }, concernBeyond: { max: 7.0 }, cadence: "Yearly", note: "Tracks fructose intake, hypertension and kidney risk, not just gout." },
  { id: "vitamin-d", name: "Vitamin D (25-OH)", group: "nutritional", conventionalUnit: "ng/mL", siUnit: "nmol/L", siFactor: 2.496, optimal: { min: 30, max: 60 }, concernBeyond: { min: 20, max: 100 }, cadence: "Once, repeat after correction", note: "Routine testing is not endorsed for healthy adults (Endocrine Society 2024); test if risk factors or before high-dose supplementation." },
  { id: "b12", name: "Vitamin B12", group: "nutritional", conventionalUnit: "pg/mL", siUnit: "pmol/L", siFactor: 0.738, optimal: { min: 400 }, concernBeyond: { min: 200 }, cadence: "Every 1–3 years if vegetarian, metformin, PPI or 65+", note: "Add methylmalonic acid if 200–400 and symptomatic." },
  { id: "ferritin", name: "Ferritin", group: "nutritional", conventionalUnit: "ng/mL", optimal: { bySex: { male: { min: 40, max: 200 }, female: { min: 30, max: 150 } } }, concernBeyond: { min: 15, max: 300 }, cadence: "Yearly if menstruating, vegetarian or fatigued", note: "Under 30 is iron deficiency even with normal haemoglobin; over 300 warrants a haemochromatosis check." },
  { id: "omega3-index", name: "Omega-3 index", group: "nutritional", conventionalUnit: "%", optimal: { min: 8 }, concernBeyond: { min: 4 }, cadence: "Once, repeat after diet change", note: "Above 8 percent is associated with lower cardiovascular and all-cause mortality." },
  { id: "tsh", name: "TSH", group: "hormonal", conventionalUnit: "mIU/L", optimal: { min: 0.5, max: 4.0 }, concernBeyond: { min: 0.1, max: 10 }, cadence: "Every 5 years from 35; yearly if treated", note: "Add free T4 and antibodies if abnormal; treat symptoms, not just the number." },
  { id: "systolic-bp", name: "Systolic blood pressure (home average)", group: "blood_pressure", conventionalUnit: "mmHg", optimal: { max: 120 }, concernBeyond: { max: 130 }, cadence: "Weekly home readings; yearly office", note: "AHA/ACC 2025 target below 130/80 for nearly all adults." },
  { id: "diastolic-bp", name: "Diastolic blood pressure (home average)", group: "blood_pressure", conventionalUnit: "mmHg", optimal: { max: 80 }, concernBeyond: { max: 90 }, cadence: "With systolic", note: "" },
  { id: "waist-height", name: "Waist-to-height ratio", group: "body_composition", conventionalUnit: "ratio", optimal: { max: 0.5 }, concernBeyond: { max: 0.6 }, cadence: "Every 6–12 months", note: "Keep your waist under half your height; beats BMI for visceral fat." },
  { id: "body-fat", name: "Body fat (DEXA)", group: "body_composition", conventionalUnit: "%", optimal: { bySex: { male: { min: 10, max: 20 }, female: { min: 18, max: 28 } } }, concernBeyond: { bySex: { male: { max: 25 }, female: { max: 35 } } }, cadence: "Yearly", note: "Track appendicular lean mass index alongside: men ≥ 7.0, women ≥ 5.5 kg/m²." },
];

// ---------------------------------------------------------------------------
// Functional / fitness markers — the strongest mortality predictors we have
// ---------------------------------------------------------------------------

export const FUNCTIONAL_MARKERS: FunctionalMarker[] = [
  {
    id: "vo2max",
    name: "VO₂ max (cardiorespiratory fitness)",
    unit: "mL/kg/min",
    cadence: "Every 1–2 years",
    target: {
      male: "Aim for the top quartile for age: ≥ 45 in your 40s, ≥ 40 in your 50s, ≥ 35 in your 60s, ≥ 30 in your 70s.",
      female: "Aim for the top quartile for age: ≥ 38 in your 40s, ≥ 33 in your 50s, ≥ 29 in your 60s, ≥ 25 in your 70s.",
    },
    whyItMatters: "Moving from the bottom 25 percent to below-average fitness halves all-cause mortality; elite fitness carries roughly five-fold lower risk than low fitness (JAMA Netw Open 2018).",
    howToMeasure: "Graded exercise test with gas exchange, or a validated estimate (Cooper 12-minute run, smartwatch VO₂ estimate with a treadmill calibration).",
  },
  {
    id: "grip-strength",
    name: "Grip strength",
    unit: "kg (dominant hand, best of 3)",
    cadence: "Yearly",
    target: {
      male: "≥ 40 kg is strong; < 27 kg is sarcopenia range (EWGSOP2).",
      female: "≥ 25 kg is strong; < 16 kg is sarcopenia range (EWGSOP2).",
    },
    whyItMatters: "Each 5 kg drop in grip is associated with a 16 percent higher all-cause mortality (PURE study). It is the cheapest proxy for whole-body strength.",
    howToMeasure: "Jamar-style dynamometer, seated, elbow at 90 degrees.",
  },
  {
    id: "gait-speed",
    name: "Usual gait speed",
    unit: "m/s over 4 metres",
    cadence: "Yearly from 60",
    target: {
      male: "≥ 1.0 m/s is healthy; ≥ 1.3 m/s tracks with the longest survival; < 0.8 m/s signals frailty.",
      female: "≥ 1.0 m/s is healthy; ≥ 1.3 m/s tracks with the longest survival; < 0.8 m/s signals frailty.",
    },
    whyItMatters: "Gait speed predicts survival as well as the combination of age, sex and chronic conditions (JAMA 2011).",
    howToMeasure: "Time a comfortable walk over a marked 4 m course, with a running start.",
  },
  {
    id: "chair-stand",
    name: "30-second chair stand",
    unit: "repetitions",
    cadence: "Yearly from 60",
    target: {
      male: "60–64: ≥ 14 · 65–69: ≥ 12 · 70–74: ≥ 12 · 75–79: ≥ 11 · 80+: ≥ 10.",
      female: "60–64: ≥ 12 · 65–69: ≥ 11 · 70–74: ≥ 10 · 75–79: ≥ 10 · 80+: ≥ 9.",
    },
    whyItMatters: "Lower-body power is what keeps people independent; below these norms doubles fall risk.",
    howToMeasure: "Arms crossed, standard-height chair, count full stands in 30 seconds (CDC STEADI).",
  },
  {
    id: "single-leg-stance",
    name: "Single-leg stance",
    unit: "seconds (eyes open)",
    cadence: "Yearly from 50",
    target: {
      male: "≥ 10 seconds at any age over 50; ≥ 30 seconds is excellent.",
      female: "≥ 10 seconds at any age over 50; ≥ 30 seconds is excellent.",
    },
    whyItMatters: "Inability to hold 10 seconds was associated with an 84 percent higher all-cause mortality over 7 years (Br J Sports Med 2022).",
    howToMeasure: "Hands on hips, free foot at calf height, best of 3 attempts.",
  },
  {
    id: "push-ups",
    name: "Push-up capacity",
    unit: "consecutive repetitions",
    cadence: "Yearly",
    target: {
      male: "≥ 40 was associated with 96 percent lower cardiovascular events than < 10 in working-age men (JAMA Netw Open 2019); ≥ 20 is a solid floor.",
      female: "Normative data are limited; ≥ 15 full or ≥ 30 modified push-ups is a solid floor.",
    },
    whyItMatters: "A free, no-equipment marker of upper-body strength and fitness.",
    howToMeasure: "Standard form to a metronome or self-paced until form fails.",
  },
  {
    id: "dead-hang",
    name: "Dead hang",
    unit: "seconds",
    cadence: "Yearly",
    target: {
      male: "≥ 60 seconds good; ≥ 90 seconds excellent.",
      female: "≥ 40 seconds good; ≥ 60 seconds excellent.",
    },
    whyItMatters: "Grip endurance and shoulder integrity in one test; protective for the falls and fractures that end independence.",
    howToMeasure: "Overhand grip, arms straight, feet off the floor, until grip fails.",
  },
  {
    id: "lean-mass",
    name: "Appendicular lean mass index (DEXA)",
    unit: "kg/m²",
    cadence: "Yearly from 40",
    target: {
      male: "≥ 7.0 kg/m² (EWGSOP2 cut-point); higher is better into the 70s.",
      female: "≥ 5.5 kg/m² (EWGSOP2 cut-point); higher is better into the 70s.",
    },
    whyItMatters: "Muscle is the metabolic sink for glucose and the reserve you spend during illness; adults lose 3–8 percent per decade after 30 without training.",
    howToMeasure: "DEXA body composition; bioimpedance is an acceptable trend tool.",
  },
];

// ---------------------------------------------------------------------------
// Lifestyle pillars
// ---------------------------------------------------------------------------

export const LIFESTYLE_PILLARS: LifestylePillar[] = [
  {
    id: "exercise",
    title: "Move: aerobic base, strength, stability",
    target: "150–300 min/week moderate (zone 2) or 75–150 min vigorous, plus resistance training 2–3 days/week covering all major muscle groups, plus one weekly high-intensity interval session and daily balance work after 50.",
    evidence: "WHO 2020 and AHA 2018 guidelines; each additional 1-MET of fitness lowers mortality about 13 percent.",
    checkIns: ["Weekly aerobic minutes logged", "Two strength sessions completed", "Steps ≥ 7,000/day on most days"],
  },
  {
    id: "nutrition",
    title: "Eat: Mediterranean pattern, adequate protein, minimal ultra-processed food",
    target: "Protein 1.2–1.6 g/kg/day (spread across meals, higher end after 60); fibre 25–38 g/day; sodium under 2,300 mg (ideal 1,500 mg); ultra-processed food under 10 percent of calories; added sugar under 25 g/day.",
    evidence: "PREDIMED, DASH-Sodium, PROT-AGE consensus 2013, NutriNet-Santé UPF cohorts.",
    checkIns: ["Protein target met on 5+ days", "Vegetables/legumes at two meals daily", "Alcohol-free days ≥ 4/week"],
  },
  {
    id: "sleep",
    title: "Sleep: 7–9 hours, regular timing",
    target: "7–9 hours, consistent bed and wake times (±30 min), no alcohol within 3 hours of bed. Screen for sleep apnoea (STOP-BANG ≥ 3) if snoring, resistant hypertension or daytime sleepiness.",
    evidence: "Sleep regularity predicted mortality better than duration in UK Biobank (Sleep 2024); untreated OSA doubles cardiovascular risk.",
    checkIns: ["Average sleep ≥ 7 h", "Bed/wake variability under 30 min", "STOP-BANG reviewed"],
  },
  {
    id: "substances",
    title: "Avoid: tobacco, nicotine, excess alcohol",
    target: "No tobacco or nicotine in any form. Alcohol: less is better; if used, under 7 drinks/week for women and under 14 for men, none on 3+ days a week, never binge.",
    evidence: "US Surgeon General 2025 advisory on alcohol and cancer; Global Burden of Disease 2018.",
    checkIns: ["Nicotine-free", "Weekly alcohol count below threshold"],
  },
  {
    id: "connection",
    title: "Connect: relationships, purpose, mental health",
    target: "Meaningful social contact most days, a stated purpose or role, and a yearly mood check (PHQ-2/GAD-2). Address loneliness like a risk factor.",
    evidence: "Loneliness raises mortality risk about as much as smoking 15 cigarettes/day (Holt-Lunstad 2015); the Harvard Study of Adult Development.",
    checkIns: ["Social contact ≥ 3 days/week", "PHQ-2 and GAD-2 this year"],
  },
  {
    id: "brain",
    title: "Protect the brain: hearing, vision, blood pressure, learning",
    target: "Correct hearing and vision loss promptly, keep blood pressure under 130/80 from midlife, learn something demanding, and stay physically active.",
    evidence: "Lancet Commission 2024: 14 modifiable risk factors account for about 45 percent of dementia; SPRINT-MIND; ACHIEVE 2023.",
    checkIns: ["Hearing/vision checked on schedule", "Blood pressure at target", "New skill or study in progress"],
  },
  {
    id: "environment",
    title: "Environment: sun, air, safety",
    target: "Daily broad-spectrum SPF 30+, check indoor air quality and avoid PM2.5 exposure on high-pollution days, seat belts always, helmets on wheels, firearms stored locked and unloaded.",
    evidence: "Ambient PM2.5 is the leading environmental cause of death globally (GBD); injury is the top killer under 45.",
    checkIns: ["Sunscreen habit", "Air-quality plan for bad days"],
  },
];

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export interface BuildPlanOptions {
  region?: GuidelineRegion;
  /** ISO dates keyed by screening/vaccine id (what has already been done). */
  completions?: Record<string, string>;
  /** Override "today" for deterministic tests. */
  today?: Date;
  /** Days ahead within which an item is flagged "upcoming". Default 90. */
  upcomingWindowDays?: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function statusFor(
  frequencyMonths: number,
  lastDone: string | undefined,
  today: Date,
  upcomingWindowDays: number,
  sharedDecision: boolean | undefined,
): { status: PlanItemStatus; nextDue?: string } {
  if (!lastDone) {
    return { status: sharedDecision ? "discuss" : "due" };
  }
  if (frequencyMonths <= 0) {
    return { status: "up_to_date" };
  }
  const last = new Date(lastDone);
  if (Number.isNaN(last.getTime())) {
    return { status: sharedDecision ? "discuss" : "due" };
  }
  const next = addMonths(last, frequencyMonths);
  const nextDue = toIsoDate(next);
  if (next.getTime() <= today.getTime()) {
    return { status: "due", nextDue };
  }
  const windowMs = upcomingWindowDays * 24 * 60 * 60 * 1000;
  if (next.getTime() - today.getTime() <= windowMs) {
    return { status: "upcoming", nextDue };
  }
  return { status: "up_to_date", nextDue };
}

export function screeningAppliesTo(def: ScreeningDefinition, profile: LongevityProfile, region: GuidelineRegion): { applies: boolean; note?: string; effective: { ageStart: number; ageEnd: number; cadence: string; frequencyMonths: number; grade: string } } {
  const override = def.regionOverride?.[region] ?? {};
  let ageStart = override.ageStart ?? def.ageStart;
  const ageEnd = override.ageEnd ?? def.ageEnd;
  const cadence = override.cadence ?? def.cadence;
  const frequencyMonths = override.frequencyMonths ?? def.frequencyMonths;
  const grade = override.grade ?? def.grade;
  let note: string | undefined;

  if (def.sex !== "all" && def.sex !== profile.sex) {
    return { applies: false, effective: { ageStart, ageEnd, cadence, frequencyMonths, grade } };
  }
  if (def.earlierStartWhen && def.earlierStartWhen.predicate(profile)) {
    ageStart = Math.min(ageStart, def.earlierStartWhen.ageStart);
    note = def.earlierStartWhen.note;
  }
  if (profile.age < ageStart || profile.age > ageEnd) {
    return { applies: false, note, effective: { ageStart, ageEnd, cadence, frequencyMonths, grade } };
  }
  if (def.appliesWhen && !def.appliesWhen(profile)) {
    return { applies: false, note, effective: { ageStart, ageEnd, cadence, frequencyMonths, grade } };
  }
  return { applies: true, note, effective: { ageStart, ageEnd, cadence, frequencyMonths, grade } };
}

export function buildLongevityPlan(profile: LongevityProfile, options: BuildPlanOptions = {}): LongevityPlan {
  const region: GuidelineRegion = options.region ?? "us";
  const today = options.today ?? new Date();
  const completions = options.completions ?? {};
  const upcomingWindowDays = options.upcomingWindowDays ?? 90;

  const screenings: PlanItem[] = [];
  for (const def of PREVENTIVE_SCREENINGS) {
    const { applies, note, effective } = screeningAppliesTo(def, profile, region);
    if (!applies) continue;
    const lastDone = completions[def.id];
    const { status, nextDue } = statusFor(effective.frequencyMonths, lastDone, today, upcomingWindowDays, def.sharedDecision);
    screenings.push({
      id: def.id,
      title: def.title,
      category: def.category,
      cadence: effective.cadence,
      frequencyMonths: effective.frequencyMonths,
      grade: effective.grade,
      source: def.source[region],
      whyItMatters: def.whyItMatters,
      status,
      lastDone,
      nextDue,
      note,
    });
  }

  const vaccines: PlanItem[] = [];
  for (const def of ADULT_VACCINES) {
    if (profile.age < def.ageStart || profile.age > def.ageEnd) continue;
    if (def.appliesWhen && !def.appliesWhen(profile)) continue;
    const lastDone = completions[def.id];
    const { status, nextDue } = statusFor(def.frequencyMonths, lastDone, today, upcomingWindowDays, false);
    vaccines.push({
      id: def.id,
      title: def.name,
      category: "immunization",
      cadence: def.schedule[region],
      frequencyMonths: def.frequencyMonths,
      grade: region === "us" ? "ACIP" : "WHO / national schedule",
      source: region === "us" ? "CDC ACIP Adult Immunization Schedule" : "WHO position papers; verify national programme",
      whyItMatters: def.note,
      status,
      lastDone,
      nextDue,
    });
  }

  const all = [...screenings, ...vaccines];
  const counts = {
    due: all.filter((i) => i.status === "due").length,
    upcoming: all.filter((i) => i.status === "upcoming").length,
    upToDate: all.filter((i) => i.status === "up_to_date").length,
    discuss: all.filter((i) => i.status === "discuss").length,
  };

  return {
    protocolVersion: LONGEVITY_PROTOCOL_VERSION,
    region,
    generatedAt: today.toISOString(),
    profile,
    screenings: sortByUrgency(screenings),
    vaccines: sortByUrgency(vaccines),
    biomarkers: BIOMARKER_TARGETS,
    functional: FUNCTIONAL_MARKERS,
    lifestyle: LIFESTYLE_PILLARS,
    counts,
  };
}

const URGENCY: Record<PlanItemStatus, number> = { due: 0, upcoming: 1, discuss: 2, up_to_date: 3 };

function sortByUrgency(items: PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);
}

// ---------------------------------------------------------------------------
// Biomarker assessment + unit conversion
// ---------------------------------------------------------------------------

function resolveRange(
  range: BiomarkerTarget["optimal"] | BiomarkerTarget["concernBeyond"],
  sex: Sex,
): { min?: number; max?: number } {
  if (!range) return {};
  const bySex = range.bySex?.[sex];
  return { min: bySex?.min ?? range.min, max: bySex?.max ?? range.max };
}

/**
 * Classify a value (in conventional units) against the longevity target.
 * Returns "unknown" for unrecognised ids or non-finite values.
 */
export function assessBiomarker(id: string, conventionalValue: number, sex: Sex): BiomarkerStatus {
  const target = BIOMARKER_TARGETS.find((b) => b.id === id);
  if (!target || !Number.isFinite(conventionalValue)) return "unknown";
  const optimal = resolveRange(target.optimal, sex);
  const concern = resolveRange(target.concernBeyond, sex);

  const belowOptimal = optimal.min !== undefined && conventionalValue < optimal.min;
  const aboveOptimal = optimal.max !== undefined && conventionalValue > optimal.max;
  if (!belowOptimal && !aboveOptimal) return "optimal";

  const belowConcern = concern.min !== undefined && conventionalValue < concern.min;
  const aboveConcern = concern.max !== undefined && conventionalValue > concern.max;
  if (belowConcern || aboveConcern) return "concern";
  return "borderline";
}

export function toDisplayUnit(target: BiomarkerTarget, conventionalValue: number, units: UnitSystem): { value: number; unit: string } {
  if (units === "si" && target.siUnit && target.siFactor) {
    const v = conventionalValue * target.siFactor;
    return { value: Math.round(v * 100) / 100, unit: target.siUnit };
  }
  return { value: conventionalValue, unit: target.conventionalUnit };
}

export function fromDisplayUnit(target: BiomarkerTarget, displayValue: number, units: UnitSystem): number {
  if (units === "si" && target.siUnit && target.siFactor) {
    return displayValue / target.siFactor;
  }
  return displayValue;
}

export function formatTargetRange(target: BiomarkerTarget, sex: Sex, units: UnitSystem): string {
  const r = resolveRange(target.optimal, sex);
  const fmt = (v: number) => toDisplayUnit(target, v, units).value;
  const unit = toDisplayUnit(target, 0, units).unit;
  if (r.min !== undefined && r.max !== undefined) return `${fmt(r.min)}–${fmt(r.max)} ${unit}`;
  if (r.max !== undefined) return `< ${fmt(r.max)} ${unit}`;
  if (r.min !== undefined) return `> ${fmt(r.min)} ${unit}`;
  return unit;
}

// ---------------------------------------------------------------------------
// Clinician summary (plain text, print/paste friendly)
// ---------------------------------------------------------------------------

export function summarizePlanForClinician(plan: LongevityPlan): string {
  const p = plan.profile;
  const lines: string[] = [];
  lines.push(`Longevity & Preventive Health plan — protocol ${plan.protocolVersion}, ${plan.region === "us" ? "US guidelines" : "international guidelines"}`);
  lines.push(`Profile: ${p.age}-year-old ${p.sex}${p.smokingStatus && p.smokingStatus !== "never" ? `, ${p.smokingStatus} smoker` : ""}${p.hasDiabetes ? ", diabetes" : ""}${p.hasHypertension ? ", hypertension" : ""}${p.hasCardiovascularDisease ? ", CVD" : ""}`);
  lines.push(`Status: ${plan.counts.due} due · ${plan.counts.upcoming} upcoming · ${plan.counts.discuss} to discuss · ${plan.counts.upToDate} up to date`);
  lines.push("");
  const section = (title: string, items: PlanItem[]) => {
    if (items.length === 0) return;
    lines.push(title);
    for (const i of items) {
      const when = i.nextDue ? ` (next ${i.nextDue})` : i.lastDone ? ` (done ${i.lastDone})` : "";
      lines.push(`  [${i.status.replace("_", " ")}] ${i.title} — ${i.cadence}${when}`);
    }
    lines.push("");
  };
  section("Screenings", plan.screenings);
  section("Immunizations", plan.vaccines);
  lines.push("Longevity biomarker targets: ApoB < 80 mg/dL, Lp(a) once, HbA1c < 5.6 %, fasting insulin < 8, hs-CRP < 1, eGFR ≥ 90 with uACR < 10, ALT < 30/25, BP < 120/80 home.");
  lines.push("Functional targets: VO2 max top quartile for age, grip ≥ 40/25 kg, gait ≥ 1.0 m/s, single-leg stance ≥ 10 s, chair stands at age norm.");
  lines.push("Lifestyle: 150–300 min zone 2 + 2–3 strength sessions/week, protein 1.2–1.6 g/kg, sleep 7–9 h regular, no nicotine, alcohol minimal, social connection, hearing/vision/BP for the brain.");
  return lines.join("\n");
}

export const PROTOCOL_SOURCES: string[] = [
  "US Preventive Services Task Force A/B recommendations (2018–2025 updates incl. breast 2024, osteoporosis 2025, falls 2024)",
  "AHA/ACC 2025 High Blood Pressure Guideline; ACC/AHA 2019 Primary Prevention; 2018 Cholesterol Guideline",
  "National Lipid Association 2024 statement on Lp(a); EAS 2022 Lp(a) consensus; NLA ApoB guidance",
  "American Diabetes Association Standards of Care 2026; KDIGO 2024 CKD guideline",
  "CDC ACIP Adult Immunization Schedule 2025–2026 (RSV 50–74 at risk, pneumococcal 50+, COVID-19 shared decision)",
  "EWGSOP2 sarcopenia cut-points; CDC STEADI; World Falls Guidelines 2022",
  "Lancet Commission on Dementia 2024; ACHIEVE trial 2023; SPRINT-MIND",
  "WHO 2020 Physical Activity Guidelines; WHO PEN / HEARTS; ESC 2021 CVD Prevention (SCORE2); EU Council 2022 cancer screening recommendation",
  "Endocrine Society 2024 Vitamin D guideline; PROT-AGE 2013; US Surgeon General 2025 alcohol advisory",
];
