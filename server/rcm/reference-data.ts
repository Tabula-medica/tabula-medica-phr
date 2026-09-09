// Reference tables for the outpatient RCM engine. Seed-sized, deterministic, and replaceable
// by the quarterly CMS files (NCCI PTP/MUE, MPFS) via the same shapes. Amounts are national
// Medicare-style reference allowables used ONLY for estimates and variance math — the payer
// contract (contracts.ts) is the source of truth when present.

export interface FeeScheduleRow {
  cpt: string;
  description: string;
  category: "em-new" | "em-established" | "preventive" | "procedure" | "lab" | "imaging" | "telehealth" | "chronic-care" | "vaccine" | "other";
  medicareAllowed: number;
  globalDays?: 0 | 10 | 90;
  typicalUnitsMax?: number; // MUE-style unit ceiling
}

export const FEE_SCHEDULE: FeeScheduleRow[] = [
  { cpt: "99202", description: "Office visit, new patient, straightforward MDM", category: "em-new", medicareAllowed: 73 },
  { cpt: "99203", description: "Office visit, new patient, low MDM", category: "em-new", medicareAllowed: 113 },
  { cpt: "99204", description: "Office visit, new patient, moderate MDM", category: "em-new", medicareAllowed: 167 },
  { cpt: "99205", description: "Office visit, new patient, high MDM", category: "em-new", medicareAllowed: 220 },
  { cpt: "99211", description: "Office visit, established, minimal (nurse)", category: "em-established", medicareAllowed: 24 },
  { cpt: "99212", description: "Office visit, established, straightforward MDM", category: "em-established", medicareAllowed: 57 },
  { cpt: "99213", description: "Office visit, established, low MDM", category: "em-established", medicareAllowed: 90 },
  { cpt: "99214", description: "Office visit, established, moderate MDM", category: "em-established", medicareAllowed: 128 },
  { cpt: "99215", description: "Office visit, established, high MDM", category: "em-established", medicareAllowed: 180 },
  { cpt: "99381", description: "Preventive visit, new, infant", category: "preventive", medicareAllowed: 110 },
  { cpt: "99385", description: "Preventive visit, new, 18-39", category: "preventive", medicareAllowed: 150 },
  { cpt: "99395", description: "Preventive visit, established, 18-39", category: "preventive", medicareAllowed: 125 },
  { cpt: "99396", description: "Preventive visit, established, 40-64", category: "preventive", medicareAllowed: 135 },
  { cpt: "99397", description: "Preventive visit, established, 65+", category: "preventive", medicareAllowed: 145 },
  { cpt: "G0438", description: "Annual wellness visit, initial", category: "preventive", medicareAllowed: 170 },
  { cpt: "G0439", description: "Annual wellness visit, subsequent", category: "preventive", medicareAllowed: 115 },
  { cpt: "99490", description: "Chronic care management, 20 min clinical staff", category: "chronic-care", medicareAllowed: 62 },
  { cpt: "99439", description: "CCM each additional 20 min", category: "chronic-care", medicareAllowed: 47, typicalUnitsMax: 2 },
  { cpt: "99453", description: "RPM device setup and education", category: "chronic-care", medicareAllowed: 19, typicalUnitsMax: 1 },
  { cpt: "99454", description: "RPM device supply, 30 days", category: "chronic-care", medicareAllowed: 46, typicalUnitsMax: 1 },
  { cpt: "99457", description: "RPM management, first 20 min", category: "chronic-care", medicareAllowed: 48, typicalUnitsMax: 1 },
  { cpt: "99495", description: "Transitional care mgmt, moderate, 14 days", category: "chronic-care", medicareAllowed: 205 },
  { cpt: "99497", description: "Advance care planning, first 30 min", category: "other", medicareAllowed: 85 },
  { cpt: "96372", description: "Therapeutic injection, IM/SC", category: "procedure", medicareAllowed: 15, globalDays: 0 },
  { cpt: "90471", description: "Immunization administration, first", category: "vaccine", medicareAllowed: 26 },
  { cpt: "90472", description: "Immunization administration, each additional", category: "vaccine", medicareAllowed: 15, typicalUnitsMax: 5 },
  { cpt: "90686", description: "Influenza vaccine, quadrivalent, preservative-free", category: "vaccine", medicareAllowed: 22 },
  { cpt: "12001", description: "Simple wound repair, 2.5 cm or less", category: "procedure", medicareAllowed: 130, globalDays: 0 },
  { cpt: "12002", description: "Simple wound repair, 2.6-7.5 cm", category: "procedure", medicareAllowed: 160, globalDays: 0 },
  { cpt: "17110", description: "Destruction of benign lesions, up to 14", category: "procedure", medicareAllowed: 100, globalDays: 10 },
  { cpt: "11042", description: "Debridement, subcutaneous, first 20 sq cm", category: "procedure", medicareAllowed: 105, globalDays: 0 },
  { cpt: "20610", description: "Arthrocentesis, major joint", category: "procedure", medicareAllowed: 72, globalDays: 0 },
  { cpt: "69210", description: "Cerumen removal, unilateral", category: "procedure", medicareAllowed: 48, globalDays: 0 },
  { cpt: "93000", description: "ECG with interpretation", category: "procedure", medicareAllowed: 17 },
  { cpt: "94010", description: "Spirometry", category: "procedure", medicareAllowed: 34 },
  { cpt: "36415", description: "Venipuncture", category: "lab", medicareAllowed: 3, typicalUnitsMax: 1 },
  { cpt: "80053", description: "Comprehensive metabolic panel", category: "lab", medicareAllowed: 10.5 },
  { cpt: "80061", description: "Lipid panel", category: "lab", medicareAllowed: 13 },
  { cpt: "83036", description: "Hemoglobin A1c", category: "lab", medicareAllowed: 9.7 },
  { cpt: "85025", description: "CBC with differential", category: "lab", medicareAllowed: 7.8 },
  { cpt: "81002", description: "Urinalysis, non-automated, without microscopy", category: "lab", medicareAllowed: 3.5 },
  { cpt: "87880", description: "Strep A rapid test", category: "lab", medicareAllowed: 16 },
  { cpt: "71046", description: "Chest X-ray, 2 views", category: "imaging", medicareAllowed: 27 },
  { cpt: "73030", description: "Shoulder X-ray, 2+ views", category: "imaging", medicareAllowed: 28 },
  { cpt: "70450", description: "CT head without contrast", category: "imaging", medicareAllowed: 110 },
  { cpt: "72148", description: "MRI lumbar spine without contrast", category: "imaging", medicareAllowed: 225 },
  { cpt: "76700", description: "Ultrasound abdomen, complete", category: "imaging", medicareAllowed: 95 },
  { cpt: "G2211", description: "Visit complexity inherent to E/M (add-on)", category: "other", medicareAllowed: 16 },
  { cpt: "99441", description: "Telephone E/M 5-10 min", category: "telehealth", medicareAllowed: 56 },
  { cpt: "G2012", description: "Brief virtual check-in", category: "telehealth", medicareAllowed: 15 },
];

const feeIndex = new Map(FEE_SCHEDULE.map((r) => [r.cpt, r]));
export function feeRow(cpt: string): FeeScheduleRow | undefined {
  return feeIndex.get(cpt.toUpperCase());
}

// NCCI Procedure-to-Procedure seed: column1 (comprehensive) / column2 (component).
// modifierIndicator 1 = bypass allowed with 59/X{E,S,P,U}; 0 = never.
export interface PtpPair { column1: string; column2: string; modifierIndicator: 0 | 1; rationale: string }
export const NCCI_PTP_SEED: PtpPair[] = [
  { column1: "99213", column2: "99211", modifierIndicator: 0, rationale: "Only one E/M per encounter" },
  { column1: "99214", column2: "99213", modifierIndicator: 0, rationale: "Only one E/M per encounter" },
  { column1: "12002", column2: "12001", modifierIndicator: 1, rationale: "Repairs of same classification are summed, not billed separately" },
  { column1: "20610", column2: "96372", modifierIndicator: 1, rationale: "Injection integral to arthrocentesis" },
  { column1: "80053", column2: "36415", modifierIndicator: 0, rationale: "Venipuncture bundled into some panel billing under certain payers" },
  { column1: "17110", column2: "11042", modifierIndicator: 1, rationale: "Debridement at same site integral to destruction" },
  { column1: "G0438", column2: "G0439", modifierIndicator: 0, rationale: "Initial and subsequent AWV mutually exclusive" },
  { column1: "99495", column2: "99490", modifierIndicator: 0, rationale: "CCM not separately billable in TCM period (same month)" },
];

export const NCCI_BYPASS_MODIFIERS = new Set(["59", "XE", "XS", "XP", "XU", "25", "57", "24", "78", "79", "91", "LT", "RT", "50", "E1", "E2", "E3", "E4", "FA", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "TA", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"]);

export const KNOWN_MODIFIERS = new Set([
  "24", "25", "26", "TC", "27", "33", "50", "51", "52", "53", "54", "55", "57", "58", "59", "62", "66", "76", "77", "78", "79", "80", "81", "82", "90", "91", "92", "93", "95", "96", "97", "99",
  "XE", "XS", "XP", "XU", "LT", "RT", "GA", "GX", "GY", "GZ", "GT", "GQ", "G0", "FQ", "FR", "FS", "JW", "JZ", "KX", "Q6", "QW", "AI", "AS", "SA", "TH", "CS", "CR", "GC", "GE",
  "E1", "E2", "E3", "E4", "FA", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "TA", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9",
]);

export const PLACE_OF_SERVICE: Record<string, string> = {
  "02": "Telehealth provided other than in patient's home",
  "10": "Telehealth provided in patient's home",
  "11": "Office",
  "12": "Home",
  "15": "Mobile unit",
  "17": "Walk-in retail health clinic",
  "19": "Off-campus outpatient hospital",
  "20": "Urgent care facility",
  "22": "On-campus outpatient hospital",
  "23": "Emergency room, hospital",
  "24": "Ambulatory surgical center",
  "31": "Skilled nursing facility",
  "49": "Independent clinic",
  "50": "Federally qualified health center",
  "71": "State or local public health clinic",
  "72": "Rural health clinic",
  "81": "Independent laboratory",
};

// CPT age/sex rules (subset).
export const CPT_DEMOGRAPHIC_RULES: Array<{ cpt: string; minAge?: number; maxAge?: number; sex?: "M" | "F" }> = [
  { cpt: "99381", maxAge: 0 },
  { cpt: "99385", minAge: 18, maxAge: 39 },
  { cpt: "99395", minAge: 18, maxAge: 39 },
  { cpt: "99396", minAge: 40, maxAge: 64 },
  { cpt: "99397", minAge: 65 },
  { cpt: "G0438", minAge: 65 },
  { cpt: "G0439", minAge: 65 },
  { cpt: "59400", sex: "F" },
  { cpt: "55250", sex: "M" },
];

// ICD-10 sex rules (subset by chapter prefix).
export const ICD_SEX_RULES: Array<{ prefix: string; sex: "M" | "F" }> = [
  { prefix: "O", sex: "F" },
  { prefix: "N40", sex: "M" },
  { prefix: "N41", sex: "M" },
  { prefix: "Z34", sex: "F" },
  { prefix: "C61", sex: "M" },
  { prefix: "C53", sex: "F" },
];

// HCC-relevant ICD-10 prefixes (CMS-HCC v28 subset) for risk-adjustment capture prompts.
export const HCC_PREFIXES = ["E10", "E11.2", "E11.3", "E11.4", "E11.5", "E11.6", "I50", "J44", "N18.3", "N18.4", "N18.5", "N18.6", "F32.2", "F33", "C34", "C50", "I48", "E66.01", "K70.3", "G20", "M05", "M06", "F20", "F31"];

// Common telehealth-eligible CPTs.
export const TELEHEALTH_CPTS = new Set(["99202", "99203", "99204", "99205", "99212", "99213", "99214", "99215", "99441", "G2012", "99495"]);

// Federal Poverty Level (2026 contiguous US) for sliding-fee / financial assistance screening.
export const FPL_BASE = 15960;
export const FPL_PER_ADDITIONAL = 5680;
