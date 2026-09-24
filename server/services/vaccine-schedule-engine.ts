import { logPhiAccess } from "../security/hipaa-audit";
import { lookupCVX, normalizeCVXCode, getVaccineGroup, cvxCodesMatchByGroup, resolveCVXFromInput, getAllCVXForGroup } from "./cvx-registry";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and your recorded history. This is NOT medical advice. Always confirm with your clinician or pharmacist before receiving any vaccine.";

export type VaccineStatus = "up_to_date" | "due_soon" | "overdue" | "unknown" | "not_applicable";
export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";
export type RiskFlag = 
  | "pregnancy"
  | "immunocompromised"
  | "chronic_heart"
  | "chronic_lung"
  | "chronic_liver"
  | "chronic_kidney"
  | "diabetes"
  | "asplenia"
  | "cochlear_implant"
  | "csf_leak"
  | "smoker"
  | "long_term_care"
  | "healthcare_worker"
  | "travel";

export interface CVXCode {
  code: string;
  shortDescription: string;
  fullName: string;
  vaccineGroup: string;
  status: "active" | "inactive" | "pending";
}

export interface ImmunizationEvent {
  id: string;
  patientId: string;
  profileId: string;
  vaccineCode: string;
  vaccineName: string;
  vaccineGroup: string;
  dateAdministered: string;
  lotNumber?: string;
  expirationDate?: string;
  performer?: string;
  performerType?: "physician" | "pharmacist" | "nurse" | "other";
  location?: string;
  source: "patient_entered" | "fhir" | "pharmacy" | "iis" | "ehr" | "document_scan";
  confidence: ConfidenceLevel;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  evidenceFileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VaccineSeriesStatus {
  id: string;
  patientId: string;
  profileId: string;
  vaccineGroup: string;
  seriesName: string;
  status: VaccineStatus;
  dosesRequired: number;
  dosesReceived: number;
  nextDoseNumber?: number;
  nextDueDate?: string;
  overdueSince?: string;
  completedDate?: string;
  ruleVersion: string;
  scheduleSource: string;
  lastEvaluatedAt: string;
  confidence: ConfidenceLevel;
  requiresClinicianReview: boolean;
  reviewReason?: string;
}

export interface PatientRiskFlags {
  id: string;
  patientId: string;
  profileId: string;
  flags: RiskFlag[];
  lastUpdated: string;
  updatedBy: string;
}

export interface VaccineReminder {
  id: string;
  patientId: string;
  profileId: string;
  vaccineGroup: string;
  seriesName: string;
  dueDate: string;
  reminderDate: string;
  channel: "push" | "email" | "sms";
  status: "pending" | "sent" | "acknowledged" | "dismissed";
  sentAt?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface EvidenceFile {
  id: string;
  patientId: string;
  profileId: string;
  immunizationEventId?: string;
  fileName: string;
  fileType: "image" | "pdf" | "document";
  fileUrl: string;
  fileHash?: string;
  source: "upload" | "scan" | "fhir" | "iis";
  ocrProcessed: boolean;
  ocrData?: Record<string, string>;
  createdAt: string;
}

export interface VaccineScheduleRule {
  vaccineGroup: string;
  seriesName: string;
  doses: DoseRule[];
  catchUpRules?: CatchUpRule[];
  contraindications: string[];
  riskFlagRecommendations: { flag: RiskFlag; recommendation: string }[];
  scheduleSource: string;
  sourceDate: string;
  ruleVersion: string;
  /** "us-acip" | "in-uip" | "who-epi" — set to restrict rule to a region pack */
  scheduleRegion?: string;
}

export interface DoseRule {
  doseNumber: number;
  minimumAge: number;
  maximumAge?: number;
  minimumInterval?: number;
  recommendedAge?: number;
  notes?: string;
}

export interface CatchUpRule {
  ageRange: { min: number; max: number };
  priorDoses: number;
  intervalDays: number;
  notes?: string;
}

const CVX_CODES: Map<string, CVXCode> = new Map([
  ["03", { code: "03", shortDescription: "MMR", fullName: "Measles, Mumps, Rubella", vaccineGroup: "MMR", status: "active" }],
  ["21", { code: "21", shortDescription: "Varicella", fullName: "Varicella (Chickenpox)", vaccineGroup: "Varicella", status: "active" }],
  ["08", { code: "08", shortDescription: "Hep B", fullName: "Hepatitis B", vaccineGroup: "HepB", status: "active" }],
  ["83", { code: "83", shortDescription: "Hep A", fullName: "Hepatitis A", vaccineGroup: "HepA", status: "active" }],
  ["115", { code: "115", shortDescription: "Tdap", fullName: "Tetanus, Diphtheria, Pertussis", vaccineGroup: "Tdap", status: "active" }],
  ["20", { code: "20", shortDescription: "DTaP", fullName: "Diphtheria, Tetanus, Pertussis (pediatric)", vaccineGroup: "DTaP", status: "active" }],
  ["10", { code: "10", shortDescription: "IPV", fullName: "Inactivated Poliovirus", vaccineGroup: "Polio", status: "active" }],
  ["17", { code: "17", shortDescription: "Hib", fullName: "Haemophilus influenzae type b", vaccineGroup: "Hib", status: "active" }],
  ["133", { code: "133", shortDescription: "PCV13", fullName: "Pneumococcal Conjugate (13-valent)", vaccineGroup: "Pneumococcal", status: "active" }],
  ["152", { code: "152", shortDescription: "PCV15", fullName: "Pneumococcal Conjugate (15-valent)", vaccineGroup: "Pneumococcal", status: "active" }],
  ["216", { code: "216", shortDescription: "PCV20", fullName: "Pneumococcal Conjugate (20-valent)", vaccineGroup: "Pneumococcal", status: "active" }],
  ["33", { code: "33", shortDescription: "PPSV23", fullName: "Pneumococcal Polysaccharide (23-valent)", vaccineGroup: "Pneumococcal", status: "active" }],
  ["114", { code: "114", shortDescription: "MenACWY", fullName: "Meningococcal ACWY", vaccineGroup: "Meningococcal", status: "active" }],
  ["162", { code: "162", shortDescription: "MenB", fullName: "Meningococcal B", vaccineGroup: "Meningococcal", status: "active" }],
  ["62", { code: "62", shortDescription: "HPV", fullName: "Human Papillomavirus (9-valent)", vaccineGroup: "HPV", status: "active" }],
  ["140", { code: "140", shortDescription: "Flu", fullName: "Influenza (Seasonal)", vaccineGroup: "Influenza", status: "active" }],
  ["141", { code: "141", shortDescription: "Flu", fullName: "Influenza (Seasonal, preservative-free)", vaccineGroup: "Influenza", status: "active" }],
  ["197", { code: "197", shortDescription: "Flu", fullName: "Influenza (High-dose)", vaccineGroup: "Influenza", status: "active" }],
  ["213", { code: "213", shortDescription: "COVID-19", fullName: "COVID-19 mRNA", vaccineGroup: "COVID-19", status: "active" }],
  ["229", { code: "229", shortDescription: "COVID-19", fullName: "COVID-19 (Updated 2024-25)", vaccineGroup: "COVID-19", status: "active" }],
  ["121", { code: "121", shortDescription: "Zoster", fullName: "Zoster (Shingrix)", vaccineGroup: "Shingles", status: "active" }],
  ["122", { code: "122", shortDescription: "RV", fullName: "Rotavirus", vaccineGroup: "Rotavirus", status: "active" }],
  ["305", { code: "305", shortDescription: "RSV", fullName: "RSV PreF (Abrysvo/Pfizer)", vaccineGroup: "RSV", status: "active" }],
  ["317", { code: "317", shortDescription: "RSV mRNA", fullName: "RSV mRNA (mResvia/Moderna)", vaccineGroup: "RSV", status: "active" }],
  ["206", { code: "206", shortDescription: "Mpox", fullName: "Mpox/Smallpox Vaccine (JYNNEOS)", vaccineGroup: "Mpox", status: "active" }],
]);

const VACCINE_SCHEDULE_RULES: VaccineScheduleRule[] = [
  {
    vaccineGroup: "MMR",
    seriesName: "MMR Series",
    doses: [
      { doseNumber: 1, minimumAge: 12, recommendedAge: 12, notes: "First dose at 12-15 months" },
      { doseNumber: 2, minimumAge: 48, recommendedAge: 48, minimumInterval: 28, notes: "Second dose at 4-6 years" },
    ],
    catchUpRules: [
      { ageRange: { min: 48, max: 216 }, priorDoses: 0, intervalDays: 28, notes: "Catch-up: 2 doses, 28 days apart" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy", "Severe immunodeficiency"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Needs clinician review - may be contraindicated" },
      { flag: "pregnancy", recommendation: "Contraindicated during pregnancy" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "Tdap",
    seriesName: "Tdap/Td Series",
    doses: [
      { doseNumber: 1, minimumAge: 132, recommendedAge: 132, notes: "Tdap at 11-12 years" },
    ],
    catchUpRules: [
      { ageRange: { min: 84, max: 999 }, priorDoses: 0, intervalDays: 0, notes: "One dose Tdap for catch-up" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Encephalopathy within 7 days of prior dose"],
    riskFlagRecommendations: [
      { flag: "pregnancy", recommendation: "Tdap recommended during each pregnancy at 27-36 weeks gestation" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "HPV",
    seriesName: "HPV Series",
    doses: [
      { doseNumber: 1, minimumAge: 108, recommendedAge: 132, notes: "First dose at 11-12 years (can start at 9)" },
      { doseNumber: 2, minimumAge: 108, minimumInterval: 60, notes: "If started before 15: 2 doses, 6-12 months apart" },
      { doseNumber: 3, minimumAge: 108, minimumInterval: 84, notes: "If started at 15+: 3 doses (0, 1-2, 6 months)" },
    ],
    catchUpRules: [
      { ageRange: { min: 180, max: 312 }, priorDoses: 0, intervalDays: 0, notes: "Routine catch-up through age 26; shared clinical decision-making ages 27-45" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy (defer until after delivery)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "3-dose series recommended regardless of age at initiation" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "Influenza",
    seriesName: "Annual Influenza",
    doses: [
      { doseNumber: 1, minimumAge: 6, recommendedAge: 6, notes: "Annual 2025-26 formula; 6 months and older. High-dose (Fluzone HD) or adjuvanted (Fluad) preferred for ages 65+" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "History of Guillain-Barré syndrome within 6 weeks of prior influenza vaccine"],
    riskFlagRecommendations: [
      { flag: "pregnancy", recommendation: "Recommended during any trimester; inactivated or recombinant formulation only" },
      { flag: "chronic_heart", recommendation: "Annual vaccination strongly recommended" },
      { flag: "chronic_lung", recommendation: "Annual vaccination strongly recommended" },
      { flag: "diabetes", recommendation: "Annual vaccination strongly recommended" },
      { flag: "immunocompromised", recommendation: "Annual vaccination strongly recommended; avoid LAIV (live attenuated)" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-06-26",
    ruleVersion: "2025.2",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "COVID-19",
    seriesName: "COVID-19 Annual Vaccination",
    doses: [
      { doseNumber: 1, minimumAge: 6, recommendedAge: 6, notes: "Updated 2025-26 formula annually for everyone 6 months+. Adults 65+ who received ≥1 dose of updated formula are considered up-to-date." },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component (e.g., polyethylene glycol)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Additional doses may be recommended — shared clinical decision-making with clinician" },
      { flag: "pregnancy", recommendation: "Vaccination recommended during pregnancy" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-06-26",
    ruleVersion: "2025.2",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "Shingles",
    seriesName: "Shingrix Series",
    doses: [
      { doseNumber: 1, minimumAge: 600, recommendedAge: 600, notes: "First dose at age 50+" },
      { doseNumber: 2, minimumAge: 600, minimumInterval: 60, notes: "Second dose 2-6 months after first (8-12 weeks for immunocompromised)" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Current shingles outbreak (defer until resolved)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Recommended at age 19+ if immunocompromised — confirm dosing interval with clinician" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "Pneumococcal",
    seriesName: "Pneumococcal (Adult)",
    doses: [
      { doseNumber: 1, minimumAge: 780, recommendedAge: 780, notes: "PCV20 (preferred) or PCV21 at 65+; or PCV15 followed by PPSV23 ≥1 year later" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "chronic_heart", recommendation: "Recommended at ages 19-64 with qualifying risk condition" },
      { flag: "chronic_lung", recommendation: "Recommended at ages 19-64 with qualifying risk condition" },
      { flag: "diabetes", recommendation: "Recommended at ages 19-64 with qualifying risk condition" },
      { flag: "immunocompromised", recommendation: "Recommended at 19+ — confirm specific product/schedule with clinician" },
      { flag: "asplenia", recommendation: "Recommended at 19+ — confirm specific product/schedule with clinician" },
      { flag: "smoker", recommendation: "Recommended at ages 19-64 for current smokers" },
      { flag: "long_term_care", recommendation: "Recommended for long-term care facility residents" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "HepB",
    seriesName: "Hepatitis B Series",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "First dose at birth" },
      { doseNumber: 2, minimumAge: 1, minimumInterval: 28, notes: "Second dose at 1-2 months" },
      { doseNumber: 3, minimumAge: 6, minimumInterval: 56, notes: "Third dose at 6-18 months" },
    ],
    catchUpRules: [
      { ageRange: { min: 0, max: 228 }, priorDoses: 0, intervalDays: 28, notes: "3-dose catch-up series; Heplisav-B (2-dose) available for adults 18+" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "healthcare_worker", recommendation: "Vaccination required for healthcare workers; post-exposure prophylaxis available" },
      { flag: "diabetes", recommendation: "Recommended for adults 19-59 with diabetes; shared clinical decision-making 60+" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "HepA",
    seriesName: "Hepatitis A Series",
    doses: [
      { doseNumber: 1, minimumAge: 12, recommendedAge: 12, notes: "First dose at 12-23 months" },
      { doseNumber: 2, minimumAge: 18, minimumInterval: 180, notes: "Second dose 6-18 months after first" },
    ],
    catchUpRules: [
      { ageRange: { min: 24, max: 228 }, priorDoses: 0, intervalDays: 180, notes: "2-dose catch-up series for unvaccinated adults" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "chronic_liver", recommendation: "Recommended for all persons with chronic liver disease" },
      { flag: "travel", recommendation: "Recommended before travel to hepatitis A-endemic countries" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  {
    vaccineGroup: "Meningococcal",
    seriesName: "MenACWY Series",
    doses: [
      { doseNumber: 1, minimumAge: 132, recommendedAge: 132, notes: "First dose at 11-12 years" },
      { doseNumber: 2, minimumAge: 192, minimumInterval: 96, notes: "Booster at 16 years" },
    ],
    catchUpRules: [
      { ageRange: { min: 156, max: 252 }, priorDoses: 0, intervalDays: 56, notes: "Catch-up for adolescents/young adults; boosters every 5 years for high-risk" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "asplenia", recommendation: "Additional doses recommended; MenACWY + MenB both indicated — confirm with clinician" },
      { flag: "immunocompromised", recommendation: "Additional doses may be recommended — confirm with clinician" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  // ── RSV (adult 60+) — added 2025 ACIP adult schedule ─────────────────────
  {
    vaccineGroup: "RSV",
    seriesName: "RSV (Adult 60+)",
    doses: [
      { doseNumber: 1, minimumAge: 720, recommendedAge: 720, notes: "Single dose Abrysvo (CVX-305) or mResvia (CVX-317) at age 60+; shared clinical decision-making for healthy adults 60-74 with clinician" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "chronic_heart", recommendation: "RSV vaccination recommended — discuss timing with clinician" },
      { flag: "chronic_lung", recommendation: "RSV vaccination recommended — discuss timing with clinician" },
      { flag: "long_term_care", recommendation: "RSV vaccination recommended for long-term care residents 60+" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  // ── RSV maternal — Abrysvo 32-36 weeks gestation ─────────────────────────
  {
    vaccineGroup: "RSV-Maternal",
    seriesName: "RSV Maternal Vaccine",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "Abrysvo (CVX-305) single dose at 32-36 weeks gestation; protects infant through passive antibody transfer. Do not administer if infant will receive nirsevimab." },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Prior receipt of any RSV vaccine in current or recent pregnancy"],
    riskFlagRecommendations: [
      { flag: "pregnancy", recommendation: "Shared clinical decision-making at 32-36 weeks; discuss nirsevimab vs maternal vaccine with clinician" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  // ── Mpox (JYNNEOS) — ACIP preexposure prophylaxis guidance ───────────────
  {
    vaccineGroup: "Mpox",
    seriesName: "JYNNEOS Mpox Series",
    doses: [
      { doseNumber: 1, minimumAge: 216, recommendedAge: 216, notes: "First dose subcutaneous; intradermal option (0.1 mL) for adults 18+ conserves supply" },
      { doseNumber: 2, minimumAge: 216, minimumInterval: 28, notes: "Second dose 28 days after first" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Subcutaneous route preferred (not intradermal) for immunocompromised — confirm with clinician" },
    ],
    scheduleSource: "CDC/ACIP",
    sourceDate: "2025-02-27",
    ruleVersion: "2025.1",
    scheduleRegion: "us-acip",
  },
  // ── India UIP: Birth Doses ────────────────────────────────────────────────
  {
    vaccineGroup: "BCG-UIP",
    seriesName: "BCG (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "Single dose at birth; preferably within 24 hours for TB meningitis protection" },
    ],
    catchUpRules: [
      { ageRange: { min: 0, max: 12 }, priorDoses: 0, intervalDays: 0, notes: "May be given up to 12 months if missed at birth" },
    ],
    contraindications: ["Symptomatic HIV infection", "High-dose corticosteroids", "Severe primary immunodeficiency"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in symptomatic HIV — confirm HIV status with clinician before administering" },
    ],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "HepB-Birth-UIP",
    seriesName: "Hepatitis B Birth Dose (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "Monovalent HepB dose within 24 hours of birth; subsequent doses given as part of Pentavalent at 6, 10, 14 weeks" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  // ── India UIP: Primary Series (6, 10, 14 weeks) ───────────────────────────
  {
    vaccineGroup: "OPV-UIP",
    seriesName: "Oral Polio Vaccine (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "bOPV dose 0 at birth (within 24 hours)" },
      { doseNumber: 2, minimumAge: 1, recommendedAge: 1, notes: "bOPV dose 1 at 6 weeks" },
      { doseNumber: 3, minimumAge: 2, minimumInterval: 28, notes: "bOPV dose 2 at 10 weeks" },
      { doseNumber: 4, minimumAge: 3, minimumInterval: 28, notes: "bOPV dose 3 at 14 weeks" },
      { doseNumber: 5, minimumAge: 16, recommendedAge: 18, notes: "bOPV booster at 16–24 months" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Symptomatic HIV/AIDS (use IPV instead)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Use IPV instead of OPV for immunocompromised patients and close contacts — confirm with clinician" },
    ],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "fIPV-UIP",
    seriesName: "Fractional IPV (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "fIPV (0.1 mL intradermal) at 6 weeks, co-administered with Pentavalent dose 1" },
      { doseNumber: 2, minimumAge: 3, minimumInterval: 56, notes: "fIPV at 14 weeks, co-administered with Pentavalent dose 3" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "Pentavalent-UIP",
    seriesName: "Pentavalent DPT+HepB+Hib (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "Pentavalent dose 1 at 6 weeks (DPT + HepB + Hib)" },
      { doseNumber: 2, minimumAge: 2, minimumInterval: 28, notes: "Pentavalent dose 2 at 10 weeks" },
      { doseNumber: 3, minimumAge: 3, minimumInterval: 28, notes: "Pentavalent dose 3 at 14 weeks" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Encephalopathy within 7 days of prior DPT dose"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "Rotavirus-UIP",
    seriesName: "Rotavirus — Rotavac (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "Rotavac dose 1 at 6 weeks" },
      { doseNumber: 2, minimumAge: 2, minimumInterval: 28, notes: "Rotavac dose 2 at 10 weeks" },
      { doseNumber: 3, minimumAge: 3, minimumInterval: 28, notes: "Rotavac dose 3 at 14 weeks" },
    ],
    catchUpRules: [],
    contraindications: ["History of intussusception", "Severe combined immunodeficiency disease"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in severe immunodeficiency — confirm with clinician" },
    ],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "PCV-UIP",
    seriesName: "Pneumococcal Conjugate 2+1 (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "PCV13 dose 1 at 6 weeks" },
      { doseNumber: 2, minimumAge: 3, minimumInterval: 56, notes: "PCV13 dose 2 at 14 weeks (minimum 4-week interval from dose 1)" },
      { doseNumber: 3, minimumAge: 9, minimumInterval: 56, notes: "PCV13 booster at 9 months (minimum 8 weeks after dose 2)" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  // ── India UIP: 9-Month Doses ──────────────────────────────────────────────
  {
    vaccineGroup: "MR-UIP",
    seriesName: "Measles-Rubella (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 9, recommendedAge: 9, notes: "MR dose 1 at 9–12 months" },
      { doseNumber: 2, minimumAge: 16, minimumInterval: 28, notes: "MR dose 2 at 16–24 months" },
    ],
    catchUpRules: [
      { ageRange: { min: 9, max: 60 }, priorDoses: 0, intervalDays: 28, notes: "2 doses at least 4 weeks apart for catch-up in children under 5" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy", "Severe immunodeficiency"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in severe immunodeficiency — confirm with clinician" },
      { flag: "pregnancy", recommendation: "Contraindicated — defer until after delivery" },
    ],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "JE-UIP",
    seriesName: "Japanese Encephalitis (India UIP — endemic states)",
    doses: [
      { doseNumber: 1, minimumAge: 9, recommendedAge: 9, notes: "JE dose 1 at 9–12 months; administered in selected endemic states (Assam, Bihar, UP, Karnataka, Tamil Nadu, Goa, and others)" },
      { doseNumber: 2, minimumAge: 16, minimumInterval: 28, notes: "JE dose 2 at 16–24 months in endemic states" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  // ── India UIP: Booster and Adolescent Doses ───────────────────────────────
  {
    vaccineGroup: "DPT-Booster-UIP",
    seriesName: "DPT Booster (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 16, recommendedAge: 16, notes: "DPT booster 1 at 16–24 months" },
      { doseNumber: 2, minimumAge: 60, minimumInterval: 365, notes: "DPT booster 2 at 5–6 years (school entry)" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Encephalopathy within 7 days of prior pertussis dose"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "Td-UIP",
    seriesName: "Tetanus-Diphtheria Adolescent (India UIP)",
    doses: [
      { doseNumber: 1, minimumAge: 120, recommendedAge: 120, notes: "Td dose at 10 years (school-based)" },
      { doseNumber: 2, minimumAge: 192, minimumInterval: 365, notes: "Td dose at 16 years (school-based)" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  {
    vaccineGroup: "HPV-UIP",
    seriesName: "HPV (India UIP — girls 9–14 years)",
    doses: [
      { doseNumber: 1, minimumAge: 108, recommendedAge: 108, notes: "HPV dose 1 at 9–14 years (girls); 3-dose series required if initiated at 15+" },
      { doseNumber: 2, minimumAge: 108, minimumInterval: 180, notes: "HPV dose 2 at least 6 months after dose 1" },
    ],
    catchUpRules: [
      { ageRange: { min: 108, max: 312 }, priorDoses: 0, intervalDays: 180, notes: "2-dose series if started before 15; 3-dose series at 0, 1–2, 6 months if started at 15+" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy (defer until after delivery)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "3-dose series recommended regardless of age at initiation — confirm with clinician" },
    ],
    scheduleSource: "MoHFW/India-UIP",
    sourceDate: "2024-04-01",
    ruleVersion: "2024.1-UIP",
    scheduleRegion: "in-uip",
  },
  // ── WHO EPI: Birth Doses ──────────────────────────────────────────────────
  {
    vaccineGroup: "BCG-WHO",
    seriesName: "BCG (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "Single dose at birth; as early as possible for TB protection" },
    ],
    catchUpRules: [
      { ageRange: { min: 0, max: 12 }, priorDoses: 0, intervalDays: 0, notes: "Catch-up up to 12 months for missed birth dose" },
    ],
    contraindications: ["Symptomatic HIV infection", "Primary immunodeficiency", "High-dose immunosuppressants"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in symptomatic HIV — confirm HIV status before administering" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "HepB-Birth-WHO",
    seriesName: "Hepatitis B Birth Dose (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 0, recommendedAge: 0, notes: "Monovalent HepB within 24 hours of birth; subsequent doses as part of pentavalent at 6, 10, 14 weeks" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  // ── WHO EPI: Primary Series (6, 10, 14 weeks) ────────────────────────────
  {
    vaccineGroup: "Pentavalent-WHO",
    seriesName: "Pentavalent DTwP+HepB+Hib (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "DTwP-HepB-Hib dose 1 at 6 weeks" },
      { doseNumber: 2, minimumAge: 2, minimumInterval: 28, notes: "DTwP-HepB-Hib dose 2 at 10 weeks" },
      { doseNumber: 3, minimumAge: 3, minimumInterval: 28, notes: "DTwP-HepB-Hib dose 3 at 14 weeks" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component", "Encephalopathy within 7 days of prior pertussis dose"],
    riskFlagRecommendations: [],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "OPV-WHO",
    seriesName: "Oral Polio Vaccine (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "bOPV dose 1 at 6 weeks" },
      { doseNumber: 2, minimumAge: 2, minimumInterval: 28, notes: "bOPV dose 2 at 10 weeks" },
      { doseNumber: 3, minimumAge: 3, minimumInterval: 28, notes: "bOPV dose 3 at 14 weeks" },
      { doseNumber: 4, minimumAge: 12, minimumInterval: 28, notes: "bOPV booster at 12–23 months" },
    ],
    catchUpRules: [],
    contraindications: ["Severe immunodeficiency (use IPV instead)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Use IPV instead of OPV — confirm with clinician" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "IPV-WHO",
    seriesName: "Inactivated Polio Vaccine (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 3, recommendedAge: 3, notes: "At least 1 IPV dose in the primary series (WHO recommends at 14 weeks); may be given earlier in high-risk settings" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "PCV-WHO",
    seriesName: "Pneumococcal Conjugate 2+1 (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "PCV dose 1 at 6 weeks" },
      { doseNumber: 2, minimumAge: 3, minimumInterval: 56, notes: "PCV dose 2 at 14 weeks" },
      { doseNumber: 3, minimumAge: 9, minimumInterval: 56, notes: "PCV booster at 9–12 months" },
    ],
    catchUpRules: [],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "Rotavirus-WHO",
    seriesName: "Rotavirus — Rotarix 2-dose (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 1, recommendedAge: 1, notes: "Rotarix dose 1 at 6 weeks (minimum age 6 weeks)" },
      { doseNumber: 2, minimumAge: 2, minimumInterval: 28, notes: "Rotarix dose 2 at 10 weeks (minimum 4-week interval)" },
    ],
    catchUpRules: [],
    contraindications: ["History of intussusception", "Severe combined immunodeficiency disease"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in severe immunodeficiency — confirm with clinician" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  // ── WHO EPI: 9-Month and Older Doses ─────────────────────────────────────
  {
    vaccineGroup: "MMR-WHO",
    seriesName: "MMR/MR Measles-Rubella (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 9, recommendedAge: 9, notes: "First dose at 9 months; in low measles-transmission settings may be given at 12 months" },
      { doseNumber: 2, minimumAge: 15, minimumInterval: 28, notes: "Second dose at 15–18 months (minimum 4-week interval from dose 1)" },
    ],
    catchUpRules: [
      { ageRange: { min: 9, max: 180 }, priorDoses: 0, intervalDays: 28, notes: "2 doses at least 4 weeks apart for catch-up" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy", "Severe immunodeficiency"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "Contraindicated in severe immunodeficiency — confirm with clinician" },
      { flag: "pregnancy", recommendation: "Contraindicated — defer until after delivery" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "HPV-WHO",
    seriesName: "HPV (WHO EPI)",
    doses: [
      { doseNumber: 1, minimumAge: 108, recommendedAge: 108, notes: "HPV dose 1 at 9–14 years; 3-dose series required if initiated at 15+" },
      { doseNumber: 2, minimumAge: 108, minimumInterval: 180, notes: "HPV dose 2 at least 6 months after dose 1" },
    ],
    catchUpRules: [
      { ageRange: { min: 108, max: 312 }, priorDoses: 0, intervalDays: 180, notes: "2-dose series if started before 15; 3-dose series (0, 1–2, 6 months) if started at 15+" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component", "Pregnancy (defer until after delivery)"],
    riskFlagRecommendations: [
      { flag: "immunocompromised", recommendation: "3-dose series recommended regardless of age — confirm with clinician" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "Typhoid-WHO",
    seriesName: "Typhoid Conjugate TCV (WHO EPI — endemic countries)",
    doses: [
      { doseNumber: 1, minimumAge: 9, recommendedAge: 9, notes: "TCV single dose at 9 months+ for countries with moderate-to-high typhoid burden; single dose provides long-term protection" },
    ],
    catchUpRules: [
      { ageRange: { min: 9, max: 180 }, priorDoses: 0, intervalDays: 0, notes: "Catch-up for unvaccinated persons 9 months–14 years in endemic areas" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [
      { flag: "travel", recommendation: "Recommended before travel to typhoid-endemic countries" },
    ],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
  {
    vaccineGroup: "MenA-WHO",
    seriesName: "Meningococcal A MenAfriVac (WHO EPI — sub-Saharan Africa)",
    doses: [
      { doseNumber: 1, minimumAge: 9, recommendedAge: 9, notes: "MenAfriVac single dose at 9–18 months; recommended in meningitis belt of sub-Saharan Africa (Senegal to Ethiopia)" },
    ],
    catchUpRules: [
      { ageRange: { min: 9, max: 216 }, priorDoses: 0, intervalDays: 0, notes: "Catch-up for all unvaccinated persons 9 months to 18 years in meningitis belt countries" },
    ],
    contraindications: ["Severe allergic reaction to vaccine component"],
    riskFlagRecommendations: [],
    scheduleSource: "WHO/EPI",
    sourceDate: "2024-01-01",
    ruleVersion: "2024.1-WHO",
    scheduleRegion: "who-epi",
  },
];

const immunizationEvents = new Map<string, ImmunizationEvent>();
const seriesStatuses = new Map<string, VaccineSeriesStatus>();
const patientRiskFlags = new Map<string, PatientRiskFlags>();
const vaccineReminders = new Map<string, VaccineReminder>();
const evidenceFiles = new Map<string, EvidenceFile>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateAgeInMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function evaluateSeriesStatus(
  patientId: string,
  profileId: string,
  birthDate: string,
  vaccineGroup: string,
  events: ImmunizationEvent[],
  riskFlags: RiskFlag[]
): VaccineSeriesStatus {
  const rule = VACCINE_SCHEDULE_RULES.find((r) => r.vaccineGroup === vaccineGroup);
  if (!rule) {
    return {
      id: generateId("series"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: vaccineGroup,
      status: "unknown",
      dosesRequired: 0,
      dosesReceived: events.length,
      ruleVersion: "unknown",
      scheduleSource: "Unknown",
      lastEvaluatedAt: new Date().toISOString(),
      confidence: "unknown",
      requiresClinicianReview: true,
      reviewReason: "No schedule rule found for this vaccine group",
    };
  }

  const ageMonths = calculateAgeInMonths(birthDate);
  const dosesReceived = events.length;
  const dosesRequired = rule.doses.length;

  let applicableRiskRecommendations = rule.riskFlagRecommendations.filter((r) =>
    riskFlags.includes(r.flag)
  );

  let requiresReview = applicableRiskRecommendations.some(
    (r) => r.recommendation.toLowerCase().includes("needs clinician review") ||
           r.recommendation.toLowerCase().includes("confirm with clinician")
  );

  let reviewReason = applicableRiskRecommendations.length > 0
    ? applicableRiskRecommendations.map((r) => r.recommendation).join("; ")
    : undefined;

  if (dosesReceived >= dosesRequired) {
    return {
      id: generateId("series"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: rule.seriesName,
      status: "up_to_date",
      dosesRequired,
      dosesReceived,
      completedDate: events[events.length - 1]?.dateAdministered,
      ruleVersion: rule.ruleVersion,
      scheduleSource: rule.scheduleSource,
      lastEvaluatedAt: new Date().toISOString(),
      confidence: events.every((e) => e.confidence === "high") ? "high" : "medium",
      requiresClinicianReview: requiresReview,
      reviewReason,
    };
  }

  const nextDose = rule.doses[dosesReceived];
  if (!nextDose) {
    return {
      id: generateId("series"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: rule.seriesName,
      status: "unknown",
      dosesRequired,
      dosesReceived,
      ruleVersion: rule.ruleVersion,
      scheduleSource: rule.scheduleSource,
      lastEvaluatedAt: new Date().toISOString(),
      confidence: "low",
      requiresClinicianReview: true,
      reviewReason: "Unable to determine next dose requirements",
    };
  }

  if (ageMonths < nextDose.minimumAge) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + (nextDose.minimumAge - ageMonths));
    
    return {
      id: generateId("series"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: rule.seriesName,
      status: "up_to_date",
      dosesRequired,
      dosesReceived,
      nextDoseNumber: dosesReceived + 1,
      nextDueDate: dueDate.toISOString().split("T")[0],
      ruleVersion: rule.ruleVersion,
      scheduleSource: rule.scheduleSource,
      lastEvaluatedAt: new Date().toISOString(),
      confidence: events.every((e) => e.confidence === "high") ? "high" : "medium",
      requiresClinicianReview: requiresReview,
      reviewReason,
    };
  }

  const lastDose = events[events.length - 1];
  if (lastDose && nextDose.minimumInterval) {
    const lastDoseDate = new Date(lastDose.dateAdministered);
    const minNextDate = new Date(lastDoseDate);
    minNextDate.setDate(minNextDate.getDate() + nextDose.minimumInterval);
    
    if (new Date() < minNextDate) {
      return {
        id: generateId("series"),
        patientId,
        profileId,
        vaccineGroup,
        seriesName: rule.seriesName,
        status: "up_to_date",
        dosesRequired,
        dosesReceived,
        nextDoseNumber: dosesReceived + 1,
        nextDueDate: minNextDate.toISOString().split("T")[0],
        ruleVersion: rule.ruleVersion,
        scheduleSource: rule.scheduleSource,
        lastEvaluatedAt: new Date().toISOString(),
        confidence: events.every((e) => e.confidence === "high") ? "high" : "medium",
        requiresClinicianReview: requiresReview,
        reviewReason,
      };
    }
  }

  const recommendedAge = nextDose.recommendedAge || nextDose.minimumAge;
  const monthsOverdue = ageMonths - recommendedAge;

  if (monthsOverdue > 12) {
    return {
      id: generateId("series"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: rule.seriesName,
      status: "overdue",
      dosesRequired,
      dosesReceived,
      nextDoseNumber: dosesReceived + 1,
      nextDueDate: new Date().toISOString().split("T")[0],
      overdueSince: new Date(Date.now() - monthsOverdue * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      ruleVersion: rule.ruleVersion,
      scheduleSource: rule.scheduleSource,
      lastEvaluatedAt: new Date().toISOString(),
      confidence: events.length === 0 ? "low" : "medium",
      requiresClinicianReview: requiresReview || monthsOverdue > 24,
      reviewReason: monthsOverdue > 24 ? "Significantly overdue - may need catch-up schedule review" : reviewReason,
    };
  }

  return {
    id: generateId("series"),
    patientId,
    profileId,
    vaccineGroup,
    seriesName: rule.seriesName,
    status: "due_soon",
    dosesRequired,
    dosesReceived,
    nextDoseNumber: dosesReceived + 1,
    nextDueDate: new Date().toISOString().split("T")[0],
    ruleVersion: rule.ruleVersion,
    scheduleSource: rule.scheduleSource,
    lastEvaluatedAt: new Date().toISOString(),
    confidence: events.every((e) => e.confidence === "high") ? "high" : "medium",
    requiresClinicianReview: requiresReview,
    reviewReason,
  };
}

export const vaccineScheduleEngine = {
  getCVXCode(code: string): CVXCode | undefined {
    const local = CVX_CODES.get(code);
    if (local) return local;
    const entry = lookupCVX(code);
    if (entry) {
      return {
        code: entry.code,
        shortDescription: entry.shortName,
        fullName: entry.fullName,
        vaccineGroup: entry.vaccineGroup,
        status: entry.status === "active" ? "active" : "inactive",
      };
    }
    return undefined;
  },

  getAllCVXCodes(): CVXCode[] {
    return Array.from(CVX_CODES.values());
  },

  resolveVaccineCVX(input: string): CVXCode | undefined {
    const entry = resolveCVXFromInput(input);
    if (entry) {
      return {
        code: entry.code,
        shortDescription: entry.shortName,
        fullName: entry.fullName,
        vaccineGroup: entry.vaccineGroup,
        status: entry.status === "active" ? "active" : "inactive",
      };
    }
    return undefined;
  },

  getGroupCVXCodes(vaccineGroup: string): string[] {
    return getAllCVXForGroup(vaccineGroup).map(e => e.code);
  },

  getVaccineGroups(region: "us-acip" | "in-uip" | "who-epi" = "us-acip"): string[] {
    return Array.from(new Set(this.getRulesForRegion(region).map((r) => r.vaccineGroup)));
  },

  getScheduleRule(vaccineGroup: string): VaccineScheduleRule | undefined {
    return VACCINE_SCHEDULE_RULES.find((r) => r.vaccineGroup === vaccineGroup);
  },

  getAllScheduleRules(): VaccineScheduleRule[] {
    return VACCINE_SCHEDULE_RULES;
  },

  async addImmunizationEvent(event: Omit<ImmunizationEvent, "id" | "createdAt" | "updatedAt">, userId: string): Promise<ImmunizationEvent> {
    const newEvent: ImmunizationEvent = {
      ...event,
      id: generateId("imm"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationEvent",
      resourceId: newEvent.id,
      patientId: event.patientId,
      details: `Add immunization: ${event.vaccineName} (${event.vaccineCode})`,
    });

    immunizationEvents.set(newEvent.id, newEvent);
    return newEvent;
  },

  async getImmunizationEvents(patientId: string, profileId: string, userId: string): Promise<ImmunizationEvent[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationEvent",
      resourceId: "list",
      patientId,
      details: `List immunizations for profile ${profileId}`,
    });

    return Array.from(immunizationEvents.values())
      .filter((e) => e.patientId === patientId && e.profileId === profileId)
      .sort((a, b) => new Date(b.dateAdministered).getTime() - new Date(a.dateAdministered).getTime());
  },

  async evaluateAllSeries(
    patientId: string,
    profileId: string,
    birthDate: string,
    userId: string,
    region: "us-acip" | "in-uip" | "who-epi" = "us-acip"
  ): Promise<VaccineSeriesStatus[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineSeriesStatus",
      resourceId: "evaluate",
      patientId,
      details: `Evaluate vaccine series for profile ${profileId} (region: ${region})`,
    });

    const events = Array.from(immunizationEvents.values()).filter(
      (e) => e.patientId === patientId && e.profileId === profileId
    );

    const riskFlagsData = patientRiskFlags.get(`${patientId}-${profileId}`);
    const flags = riskFlagsData?.flags || [];

    const statuses: VaccineSeriesStatus[] = [];
    for (const vaccineGroup of this.getVaccineGroups(region)) {
      const groupEvents = events.filter((e) => e.vaccineGroup === vaccineGroup);
      const status = evaluateSeriesStatus(patientId, profileId, birthDate, vaccineGroup, groupEvents, flags);
      statuses.push(status);
      seriesStatuses.set(`${patientId}-${profileId}-${vaccineGroup}`, status);
    }

    return statuses;
  },

  async getPatientRiskFlags(patientId: string, profileId: string, userId: string): Promise<PatientRiskFlags | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientRiskFlags",
      resourceId: `${patientId}-${profileId}`,
      patientId,
      details: `Get risk flags for profile ${profileId}`,
    });

    return patientRiskFlags.get(`${patientId}-${profileId}`) || null;
  },

  async updatePatientRiskFlags(patientId: string, profileId: string, flags: RiskFlag[], userId: string): Promise<PatientRiskFlags> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PatientRiskFlags",
      resourceId: `${patientId}-${profileId}`,
      patientId,
      details: `Update risk flags: ${flags.join(", ")}`,
    });

    const riskFlagsData: PatientRiskFlags = {
      id: generateId("risk"),
      patientId,
      profileId,
      flags,
      lastUpdated: new Date().toISOString(),
      updatedBy: userId,
    };

    patientRiskFlags.set(`${patientId}-${profileId}`, riskFlagsData);
    return riskFlagsData;
  },

  async createReminder(
    patientId: string,
    profileId: string,
    vaccineGroup: string,
    dueDate: string,
    reminderDate: string,
    channel: "push" | "email" | "sms",
    userId: string
  ): Promise<VaccineReminder> {
    const rule = VACCINE_SCHEDULE_RULES.find((r) => r.vaccineGroup === vaccineGroup);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "VaccineReminder",
      resourceId: "create",
      patientId,
      details: `Create reminder for ${vaccineGroup}`,
    });

    const reminder: VaccineReminder = {
      id: generateId("remind"),
      patientId,
      profileId,
      vaccineGroup,
      seriesName: rule?.seriesName || vaccineGroup,
      dueDate,
      reminderDate,
      channel,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    vaccineReminders.set(reminder.id, reminder);
    return reminder;
  },

  async getReminders(patientId: string, profileId: string, userId: string): Promise<VaccineReminder[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VaccineReminder",
      resourceId: "list",
      patientId,
      details: `List reminders for profile ${profileId}`,
    });

    return Array.from(vaccineReminders.values())
      .filter((r) => r.patientId === patientId && r.profileId === profileId)
      .sort((a, b) => new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime());
  },

  async addEvidenceFile(
    file: Omit<EvidenceFile, "id" | "createdAt">,
    userId: string
  ): Promise<EvidenceFile> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "EvidenceFile",
      resourceId: "create",
      patientId: file.patientId,
      details: `Upload evidence file: ${file.fileName}`,
    });

    const newFile: EvidenceFile = {
      ...file,
      id: generateId("evid"),
      createdAt: new Date().toISOString(),
    };

    evidenceFiles.set(newFile.id, newFile);
    return newFile;
  },

  async getEvidenceFiles(patientId: string, profileId: string, userId: string): Promise<EvidenceFile[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "EvidenceFile",
      resourceId: "list",
      patientId,
      details: `List evidence files for profile ${profileId}`,
    });

    return Array.from(evidenceFiles.values())
      .filter((f) => f.patientId === patientId && f.profileId === profileId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getDisclaimer(): string {
    return NO_CDS_DISCLAIMER;
  },

  /** Returns the most recent sourceDate across all loaded schedule rules. */
  getEffectiveDate(): string {
    const dates = VACCINE_SCHEDULE_RULES.map((r) => r.sourceDate).sort();
    return dates[dates.length - 1];
  },

  /** Returns the latest ruleVersion string (highest lexicographic value). */
  getScheduleVersion(): string {
    const versions = VACCINE_SCHEDULE_RULES.map((r) => r.ruleVersion).sort();
    return versions[versions.length - 1];
  },

  /**
   * Returns rules scoped to a region pack. Pass "us-acip" (default), "in-uip",
   * or "who-epi". Rules without a scheduleRegion field are always included.
   * Country-specific packs (in-uip, who-epi) are not yet populated — this
   * method is the hook for future non-US regional schedules.
   */
  getRulesForRegion(region: "us-acip" | "in-uip" | "who-epi" = "us-acip"): VaccineScheduleRule[] {
    return VACCINE_SCHEDULE_RULES.filter(
      (r) => !r.scheduleRegion || r.scheduleRegion === region
    );
  },

  async getVaccineSummary(
    patientId: string,
    profileId: string,
    birthDate: string,
    userId: string,
    region: "us-acip" | "in-uip" | "who-epi" = "us-acip"
  ): Promise<{
    statuses: VaccineSeriesStatus[];
    summary: { upToDate: number; dueSoon: number; overdue: number; unknown: number };
    nextDue: VaccineSeriesStatus[];
    disclaimer: string;
  }> {
    const statuses = await this.evaluateAllSeries(patientId, profileId, birthDate, userId, region);
    
    const summary = {
      upToDate: statuses.filter((s) => s.status === "up_to_date").length,
      dueSoon: statuses.filter((s) => s.status === "due_soon").length,
      overdue: statuses.filter((s) => s.status === "overdue").length,
      unknown: statuses.filter((s) => s.status === "unknown").length,
    };

    const nextDue = statuses
      .filter((s) => s.status === "due_soon" || s.status === "overdue")
      .sort((a, b) => {
        if (a.status === "overdue" && b.status !== "overdue") return -1;
        if (b.status === "overdue" && a.status !== "overdue") return 1;
        if (!a.nextDueDate) return 1;
        if (!b.nextDueDate) return -1;
        return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
      });

    return {
      statuses,
      summary,
      nextDue,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  },
};

console.log("[VaccineScheduleEngine] Service initialized with CDC/ACIP schedule rules");
console.log("[VaccineScheduleEngine] Loaded", CVX_CODES.size, "CVX codes and", VACCINE_SCHEDULE_RULES.length, "vaccine schedules");
