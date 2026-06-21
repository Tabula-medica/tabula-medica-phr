import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and your recorded history. This is NOT medical advice. Always confirm with your clinician or pharmacist before receiving any vaccine.";

export const RULES_ENGINE_VERSION = "2.0.0";
export const RULES_EFFECTIVE_DATE = "2024-02-08";
export const RULES_LAST_UPDATED = "2025-01-23";

export type ImmunocompromiseLevel = "none" | "mild" | "moderate" | "severe";
export type ImmunocompromiseCategory = 
  | "hiv_cd4_above_200"
  | "hiv_cd4_below_200"
  | "primary_immunodeficiency"
  | "solid_organ_transplant"
  | "bone_marrow_transplant"
  | "active_cancer_treatment"
  | "high_dose_corticosteroids"
  | "biologic_agents"
  | "asplenia_functional"
  | "asplenia_anatomic"
  | "complement_deficiency"
  | "other";

export interface ImmunocompromiseStatus {
  level: ImmunocompromiseLevel;
  categories: ImmunocompromiseCategory[];
  onsetDate?: string;
  expectedDuration?: "temporary" | "permanent" | "unknown";
  lastAssessedDate: string;
  clinicianNotes?: string;
}

export interface DoseIntervalRule {
  doseNumber: number;
  minimumAgeDays: number;
  recommendedAgeDays: number;
  maximumAgeDays?: number;
  minimumIntervalDays: number;
  recommendedIntervalDays: number;
  maximumIntervalDays?: number;
  absoluteMinimumIntervalDays?: number;
  gracePeriodDays?: number;
  notes: string;
  citation: RuleCitation;
}

export interface CatchUpScheduleRule {
  id: string;
  startingAgeMonths: number;
  endingAgeMonths: number;
  priorDosesReceived: number;
  remainingDosesNeeded: number;
  intervals: CatchUpInterval[];
  specialPopulations?: SpecialPopulationModifier[];
  citation: RuleCitation;
}

export interface CatchUpInterval {
  fromDose: number;
  toDose: number;
  minimumIntervalDays: number;
  recommendedIntervalDays: number;
  notes?: string;
}

export interface SpecialPopulationModifier {
  condition: string;
  riskFlags: string[];
  modification: "additional_doses" | "reduced_interval" | "extended_interval" | "contraindicated" | "clinician_review";
  modifiedValue?: number;
  rationale: string;
  citation: RuleCitation;
}

export interface ImmunocompromiseRule {
  vaccineGroup: string;
  immunocompromiseLevel: ImmunocompromiseLevel;
  categories?: ImmunocompromiseCategory[];
  recommendation: "standard" | "modified" | "contraindicated" | "clinician_required";
  modifications?: {
    additionalDoses?: number;
    reducedInterval?: boolean;
    liveVaccineContraindicated?: boolean;
    serologyRequired?: boolean;
    boosterFrequency?: string;
  };
  rationale: string;
  requiresClinicianReview: boolean;
  reviewUrgency: "routine" | "urgent" | "immediate";
  citation: RuleCitation;
}

export interface RuleCitation {
  source: "CDC" | "ACIP" | "FDA" | "WHO" | "AAP" | "AAFP" | "State";
  documentTitle: string;
  publicationDate: string;
  url?: string;
  section?: string;
  footnote?: string;
}

export interface VaccineScheduleRuleV2 {
  id: string;
  vaccineGroup: string;
  seriesName: string;
  cvxCodes: string[];
  isLiveVaccine: boolean;
  routineSchedule: DoseIntervalRule[];
  catchUpSchedule: CatchUpScheduleRule[];
  immunocompromiseRules: ImmunocompromiseRule[];
  contraindications: ContraindicationRule[];
  precautions: PrecautionRule[];
  specialPopulations: SpecialPopulationRule[];
  metadata: RuleMetadata;
}

export interface ContraindicationRule {
  condition: string;
  severity: "absolute" | "temporary";
  duration?: string;
  citation: RuleCitation;
}

export interface PrecautionRule {
  condition: string;
  recommendation: string;
  requiresClinicianReview: boolean;
  citation: RuleCitation;
}

export interface SpecialPopulationRule {
  population: string;
  riskFlags: string[];
  ageModification?: { minimumAgeMonths?: number; maximumAgeMonths?: number };
  doseModification?: { additionalDoses?: number; reducedDoses?: number };
  intervalModification?: { factor: number };
  recommendation: string;
  citation: RuleCitation;
}

export interface RuleMetadata {
  version: string;
  effectiveDate: string;
  expirationDate?: string;
  lastReviewedDate: string;
  reviewedBy: string;
  changeLog: ChangeLogEntry[];
}

export interface ChangeLogEntry {
  version: string;
  date: string;
  changes: string[];
  reviewer: string;
}

export interface RulesExportFormat {
  engineVersion: string;
  exportDate: string;
  exportedBy: string;
  rules: VaccineScheduleRuleV2[];
  metadata: {
    totalRules: number;
    vaccineGroups: string[];
    citationSources: string[];
    complianceStatement: string;
  };
  disclaimer: string;
}

export interface ScheduleEvaluationResult {
  patientId: string;
  profileId: string;
  evaluationDate: string;
  vaccineGroup: string;
  seriesName: string;
  status: "complete" | "on_schedule" | "due_soon" | "overdue" | "catch_up_needed" | "contraindicated" | "unknown";
  dosesReceived: number;
  dosesRequired: number;
  nextDose?: {
    doseNumber: number;
    minimumDate: string;
    recommendedDate: string;
    overdueDate?: string;
    intervalType: "routine" | "catch_up" | "accelerated";
  };
  completionDate?: string;
  confidence: "high" | "medium" | "low";
  clinicianReviewRequired: boolean;
  reviewReasons: string[];
  immunocompromiseConsiderations?: string[];
  appliedRules: {
    ruleId: string;
    ruleVersion: string;
    citations: RuleCitation[];
  };
  warnings: string[];
  disclaimer: string;
}

const COMPREHENSIVE_VACCINE_RULES: VaccineScheduleRuleV2[] = [
  {
    id: "mmr-v2",
    vaccineGroup: "MMR",
    seriesName: "Measles, Mumps, Rubella Series",
    cvxCodes: ["03", "94", "05", "06", "07"],
    isLiveVaccine: true,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 365,
        recommendedAgeDays: 365,
        maximumAgeDays: 456,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "First dose at 12-15 months of age",
        citation: {
          source: "CDC",
          documentTitle: "Recommended Child and Adolescent Immunization Schedule",
          publicationDate: "2024-02-08",
          url: "https://www.cdc.gov/vaccines/schedules/hcp/imz/child-adolescent.html",
          section: "Table 1",
        },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 1461,
        recommendedAgeDays: 1461,
        maximumAgeDays: 2191,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 1096,
        absoluteMinimumIntervalDays: 28,
        gracePeriodDays: 4,
        notes: "Second dose at 4-6 years, minimum 28 days after dose 1",
        citation: {
          source: "ACIP",
          documentTitle: "General Best Practice Guidelines for Immunization",
          publicationDate: "2024-02-08",
          section: "Timing and Spacing of Immunobiologics",
          footnote: "Table 3-2",
        },
      },
    ],
    catchUpSchedule: [
      {
        id: "mmr-catchup-child",
        startingAgeMonths: 12,
        endingAgeMonths: 48,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0, notes: "Administer immediately" },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 84, notes: "Minimum 4 weeks between doses" },
        ],
        citation: {
          source: "CDC",
          documentTitle: "Catch-up Immunization Schedule",
          publicationDate: "2024-02-08",
          section: "Table 2",
        },
      },
      {
        id: "mmr-catchup-school",
        startingAgeMonths: 48,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
        ],
        citation: {
          source: "CDC",
          documentTitle: "Catch-up Immunization Schedule",
          publicationDate: "2024-02-08",
          section: "Table 2",
        },
      },
      {
        id: "mmr-catchup-1dose",
        startingAgeMonths: 48,
        endingAgeMonths: 216,
        priorDosesReceived: 1,
        remainingDosesNeeded: 1,
        intervals: [
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
        ],
        citation: {
          source: "CDC",
          documentTitle: "Catch-up Immunization Schedule",
          publicationDate: "2024-02-08",
        },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "MMR",
        immunocompromiseLevel: "severe",
        recommendation: "contraindicated",
        modifications: {
          liveVaccineContraindicated: true,
        },
        rationale: "Live vaccines are contraindicated in severely immunocompromised patients due to risk of vaccine-strain infection",
        requiresClinicianReview: true,
        reviewUrgency: "immediate",
        citation: {
          source: "ACIP",
          documentTitle: "General Best Practice Guidelines for Immunization",
          publicationDate: "2024-02-08",
          section: "Altered Immunocompetence",
        },
      },
      {
        vaccineGroup: "MMR",
        immunocompromiseLevel: "moderate",
        categories: ["hiv_cd4_above_200", "high_dose_corticosteroids"],
        recommendation: "clinician_required",
        rationale: "May be administered if CD4 count ≥200 cells/μL; timing relative to immunosuppressive therapy requires clinical judgment",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: {
          source: "CDC",
          documentTitle: "Vaccination of Persons with HIV Infection",
          publicationDate: "2023-10-01",
        },
      },
      {
        vaccineGroup: "MMR",
        immunocompromiseLevel: "mild",
        recommendation: "standard",
        rationale: "Standard schedule applies for mild immunocompromise",
        requiresClinicianReview: false,
        reviewUrgency: "routine",
        citation: {
          source: "CDC",
          documentTitle: "General Best Practice Guidelines",
          publicationDate: "2024-02-08",
        },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction (e.g., anaphylaxis) after a previous dose or to a vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08" },
      },
      {
        condition: "Known severe immunodeficiency (e.g., hematologic and solid tumors, chemotherapy, congenital immunodeficiency, long-term immunosuppressive therapy, HIV with CD4 <200)",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "MMR Vaccine Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "Pregnancy",
        severity: "absolute",
        citation: { source: "CDC", documentTitle: "Pregnancy and Vaccination", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [
      {
        condition: "Recent (within 11 months) receipt of antibody-containing blood product",
        recommendation: "Defer MMR vaccination based on product received",
        requiresClinicianReview: true,
        citation: { source: "ACIP", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08", section: "Table 3-5" },
      },
      {
        condition: "History of thrombocytopenia or thrombocytopenic purpura",
        recommendation: "Benefits usually outweigh risks; consider serologic testing",
        requiresClinicianReview: true,
        citation: { source: "CDC", documentTitle: "MMR Vaccine Information", publicationDate: "2024-02-08" },
      },
    ],
    specialPopulations: [
      {
        population: "Healthcare personnel",
        riskFlags: ["healthcare_worker"],
        recommendation: "Two doses required regardless of birth year",
        citation: { source: "ACIP", documentTitle: "Immunization of Health-Care Personnel", publicationDate: "2024-02-08" },
      },
      {
        population: "International travelers",
        riskFlags: ["travel"],
        ageModification: { minimumAgeMonths: 6 },
        recommendation: "Infants 6-11 months: 1 dose before travel (does not count toward routine series)",
        citation: { source: "CDC", documentTitle: "Yellow Book - Health Information for International Travel", publicationDate: "2024" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [
        {
          version: "2024.1.0",
          date: "2024-02-08",
          changes: ["Initial v2 rule format with comprehensive catch-up and immunocompromise logic"],
          reviewer: "System",
        },
      ],
    },
  },
  {
    id: "dtap-tdap-v2",
    vaccineGroup: "DTaP/Tdap",
    seriesName: "Diphtheria, Tetanus, Pertussis Series",
    cvxCodes: ["20", "106", "107", "110", "115", "138", "139"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 42,
        recommendedAgeDays: 60,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "DTaP dose 1 at 2 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08", section: "Table 1" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 70,
        recommendedAgeDays: 120,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        absoluteMinimumIntervalDays: 28,
        gracePeriodDays: 4,
        notes: "DTaP dose 2 at 4 months, minimum 4 weeks after dose 1",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 98,
        recommendedAgeDays: 180,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        absoluteMinimumIntervalDays: 28,
        gracePeriodDays: 4,
        notes: "DTaP dose 3 at 6 months, minimum 4 weeks after dose 2",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 4,
        minimumAgeDays: 365,
        recommendedAgeDays: 455,
        minimumIntervalDays: 180,
        recommendedIntervalDays: 180,
        absoluteMinimumIntervalDays: 180,
        notes: "DTaP dose 4 at 15-18 months, minimum 6 months after dose 3",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 5,
        minimumAgeDays: 1461,
        recommendedAgeDays: 1461,
        maximumAgeDays: 2556,
        minimumIntervalDays: 180,
        recommendedIntervalDays: 1095,
        notes: "DTaP dose 5 at 4-6 years; not needed if dose 4 given at ≥4 years",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 6,
        minimumAgeDays: 4017,
        recommendedAgeDays: 4017,
        minimumIntervalDays: 1825,
        recommendedIntervalDays: 1825,
        notes: "Tdap booster at 11-12 years",
        citation: { source: "ACIP", documentTitle: "Recommended Adult Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "dtap-catchup-under7",
        startingAgeMonths: 2,
        endingAgeMonths: 84,
        priorDosesReceived: 0,
        remainingDosesNeeded: 5,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 3, toDose: 4, minimumIntervalDays: 180, recommendedIntervalDays: 180, notes: "6 month minimum interval" },
          { fromDose: 4, toDose: 5, minimumIntervalDays: 180, recommendedIntervalDays: 180, notes: "If dose 4 given before age 4" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08", section: "Table 2" },
      },
      {
        id: "tdap-catchup-7-18",
        startingAgeMonths: 84,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 3,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0, notes: "Tdap preferred for dose 1" },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28, notes: "Td or Tdap" },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 180, recommendedIntervalDays: 180, notes: "Td or Tdap" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "DTaP/Tdap",
        immunocompromiseLevel: "severe",
        recommendation: "standard",
        rationale: "Inactivated vaccine; safe for immunocompromised patients. Response may be reduced.",
        requiresClinicianReview: false,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction after previous dose or to vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "ACIP DTaP/Tdap Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "Encephalopathy within 7 days of previous pertussis-containing vaccine",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "ACIP DTaP/Tdap Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [
      {
        condition: "Guillain-Barré syndrome within 6 weeks of previous tetanus-containing vaccine",
        recommendation: "Assess risk vs benefit",
        requiresClinicianReview: true,
        citation: { source: "ACIP", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08" },
      },
      {
        condition: "Progressive neurologic disorder",
        recommendation: "Defer pertussis-containing vaccine until condition stabilized",
        requiresClinicianReview: true,
        citation: { source: "ACIP", documentTitle: "DTaP Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    specialPopulations: [
      {
        population: "Pregnant persons",
        riskFlags: ["pregnancy"],
        recommendation: "Tdap during each pregnancy, preferably 27-36 weeks gestation",
        citation: { source: "ACIP", documentTitle: "Tdap in Pregnancy", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "hepb-v2",
    vaccineGroup: "HepB",
    seriesName: "Hepatitis B Series",
    cvxCodes: ["08", "42", "43", "44", "45", "51", "104", "110", "189", "220"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 0,
        recommendedAgeDays: 0,
        maximumAgeDays: 1,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "Birth dose within 24 hours of birth",
        citation: { source: "ACIP", documentTitle: "Prevention of Hepatitis B Virus Infection", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 28,
        recommendedAgeDays: 30,
        maximumAgeDays: 60,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 28,
        absoluteMinimumIntervalDays: 28,
        notes: "Dose 2 at 1-2 months of age",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 168,
        recommendedAgeDays: 180,
        maximumAgeDays: 547,
        minimumIntervalDays: 56,
        recommendedIntervalDays: 120,
        absoluteMinimumIntervalDays: 56,
        notes: "Dose 3 at 6-18 months; minimum age 24 weeks; minimum 8 weeks after dose 2 and 16 weeks after dose 1",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "hepb-catchup-child",
        startingAgeMonths: 0,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 3,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28, notes: "4 weeks minimum" },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 56, recommendedIntervalDays: 56, notes: "8 weeks minimum; 16 weeks after dose 1" },
        ],
        specialPopulations: [
          {
            condition: "Hemodialysis patients",
            riskFlags: ["chronic_kidney"],
            modification: "additional_doses",
            modifiedValue: 4,
            rationale: "4-dose series with higher antigen content for hemodialysis patients",
            citation: { source: "ACIP", documentTitle: "Hepatitis B Recommendations", publicationDate: "2024-02-08" },
          },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
      {
        id: "hepb-catchup-adult",
        startingAgeMonths: 216,
        endingAgeMonths: 708,
        priorDosesReceived: 0,
        remainingDosesNeeded: 3,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 56, recommendedIntervalDays: 120 },
        ],
        citation: { source: "ACIP", documentTitle: "Adult Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "HepB",
        immunocompromiseLevel: "severe",
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
          serologyRequired: true,
        },
        rationale: "Immunocompromised patients may require additional doses and post-vaccination serology to confirm immunity",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "Hepatitis B Recommendations", publicationDate: "2024-02-08" },
      },
      {
        vaccineGroup: "HepB",
        immunocompromiseLevel: "moderate",
        categories: ["hiv_cd4_above_200", "hiv_cd4_below_200"],
        recommendation: "modified",
        modifications: {
          serologyRequired: true,
        },
        rationale: "HIV-positive patients should have anti-HBs testing 1-2 months after series completion",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "CDC", documentTitle: "HIV/AIDS and HBV", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component (including yeast)",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Hepatitis B Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [
      {
        population: "Healthcare personnel",
        riskFlags: ["healthcare_worker"],
        recommendation: "Complete 3-dose series; post-vaccination serology recommended",
        citation: { source: "ACIP", documentTitle: "Immunization of HCP", publicationDate: "2024-02-08" },
      },
      {
        population: "Patients with diabetes",
        riskFlags: ["diabetes"],
        recommendation: "Unvaccinated adults 19-59 should receive series; 60+ at clinician discretion",
        citation: { source: "ACIP", documentTitle: "Hepatitis B and Diabetes", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "polio-v2",
    vaccineGroup: "Polio",
    seriesName: "Inactivated Poliovirus Series",
    cvxCodes: ["10", "89", "110", "120"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 42,
        recommendedAgeDays: 60,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "IPV dose 1 at 2 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 70,
        recommendedAgeDays: 120,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        absoluteMinimumIntervalDays: 28,
        notes: "IPV dose 2 at 4 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 98,
        recommendedAgeDays: 180,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "IPV dose 3 at 6-18 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 4,
        minimumAgeDays: 1461,
        recommendedAgeDays: 1461,
        maximumAgeDays: 2556,
        minimumIntervalDays: 180,
        recommendedIntervalDays: 1095,
        notes: "IPV dose 4 at 4-6 years; minimum 6 months after dose 3; minimum age 4 years for final dose",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "polio-catchup-under18",
        startingAgeMonths: 2,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 4,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 3, toDose: 4, minimumIntervalDays: 180, recommendedIntervalDays: 180, notes: "Final dose at ≥4 years" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "Polio",
        immunocompromiseLevel: "severe",
        recommendation: "standard",
        rationale: "IPV is inactivated and safe for immunocompromised patients",
        requiresClinicianReview: false,
        reviewUrgency: "routine",
        citation: { source: "CDC", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Poliomyelitis Prevention", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "hib-v2",
    vaccineGroup: "Hib",
    seriesName: "Haemophilus influenzae type b Series",
    cvxCodes: ["17", "46", "47", "48", "49", "50", "51", "120", "148"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 42,
        recommendedAgeDays: 60,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "Hib dose 1 at 2 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 70,
        recommendedAgeDays: 120,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        absoluteMinimumIntervalDays: 28,
        notes: "Hib dose 2 at 4 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 98,
        recommendedAgeDays: 180,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "Hib dose 3 at 6 months (if using ActHIB, Hiberix, or Pentacel)",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 4,
        minimumAgeDays: 365,
        recommendedAgeDays: 365,
        maximumAgeDays: 456,
        minimumIntervalDays: 56,
        recommendedIntervalDays: 180,
        notes: "Booster at 12-15 months; minimum 8 weeks after prior dose",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "hib-catchup-under12mo",
        startingAgeMonths: 2,
        endingAgeMonths: 12,
        priorDosesReceived: 0,
        remainingDosesNeeded: 4,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 28, recommendedIntervalDays: 28, notes: "If needed based on product" },
          { fromDose: 3, toDose: 4, minimumIntervalDays: 56, recommendedIntervalDays: 56 },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
      {
        id: "hib-catchup-12-59mo",
        startingAgeMonths: 12,
        endingAgeMonths: 59,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 56, recommendedIntervalDays: 56 },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08", footnote: "For unvaccinated 12-14 months: 2 doses; 15-59 months: 1 dose only" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "Hib",
        immunocompromiseLevel: "severe",
        categories: ["asplenia_anatomic", "asplenia_functional", "bone_marrow_transplant"],
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
        },
        rationale: "Patients with asplenia or HSCT recipients should receive additional Hib vaccine",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "Hib Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Hib Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "Age <6 weeks",
        severity: "absolute",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [
      {
        population: "Asplenia/sickle cell",
        riskFlags: ["asplenia"],
        recommendation: "Unvaccinated persons ≥5 years with asplenia: 1 dose regardless of Hib vaccination history",
        citation: { source: "ACIP", documentTitle: "Hib Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "pcv-v2",
    vaccineGroup: "Pneumococcal",
    seriesName: "Pneumococcal Conjugate Vaccine Series",
    cvxCodes: ["133", "152", "216", "33", "109"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 42,
        recommendedAgeDays: 60,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "PCV15 or PCV20 dose 1 at 2 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 70,
        recommendedAgeDays: 120,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "Dose 2 at 4 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 98,
        recommendedAgeDays: 180,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "Dose 3 at 6 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 4,
        minimumAgeDays: 365,
        recommendedAgeDays: 365,
        minimumIntervalDays: 56,
        recommendedIntervalDays: 180,
        notes: "Booster at 12-15 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "pcv-catchup-7-23mo",
        startingAgeMonths: 7,
        endingAgeMonths: 23,
        priorDosesReceived: 0,
        remainingDosesNeeded: 3,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28 },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 56, recommendedIntervalDays: 56, notes: "Booster at ≥12 months, 8 weeks after prior" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
      {
        id: "pcv-catchup-24-59mo",
        startingAgeMonths: 24,
        endingAgeMonths: 59,
        priorDosesReceived: 0,
        remainingDosesNeeded: 1,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0, notes: "1 dose if no prior doses" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "Pneumococcal",
        immunocompromiseLevel: "severe",
        categories: ["asplenia_anatomic", "asplenia_functional", "primary_immunodeficiency", "hiv_cd4_below_200", "solid_organ_transplant", "bone_marrow_transplant"],
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
          boosterFrequency: "PPSV23 5 years after PCV series completion",
        },
        rationale: "High-risk patients need additional pneumococcal protection including PPSV23 booster",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "Pneumococcal ACIP Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Pneumococcal Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [
      {
        population: "Adults 65+",
        riskFlags: [],
        ageModification: { minimumAgeMonths: 780 },
        recommendation: "1 dose PCV20 or PCV15 followed by PPSV23",
        citation: { source: "ACIP", documentTitle: "Adult Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        population: "Chronic conditions 19-64",
        riskFlags: ["chronic_heart", "chronic_lung", "chronic_liver", "diabetes", "smoker"],
        recommendation: "PCV20 or PCV15+PPSV23 series for adults 19-64 with underlying conditions",
        citation: { source: "ACIP", documentTitle: "Pneumococcal Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "rotavirus-v2",
    vaccineGroup: "Rotavirus",
    seriesName: "Rotavirus Series",
    cvxCodes: ["116", "119", "122"],
    isLiveVaccine: true,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 42,
        recommendedAgeDays: 60,
        maximumAgeDays: 104,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "Rotavirus dose 1 at 2 months; maximum age for dose 1 is 14 weeks 6 days",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 70,
        recommendedAgeDays: 120,
        maximumAgeDays: 232,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "Dose 2 at 4 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 98,
        recommendedAgeDays: 180,
        maximumAgeDays: 232,
        minimumIntervalDays: 28,
        recommendedIntervalDays: 60,
        notes: "Dose 3 at 6 months (RotaTeq only); maximum age for any dose is 8 months 0 days",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [],
    immunocompromiseRules: [
      {
        vaccineGroup: "Rotavirus",
        immunocompromiseLevel: "severe",
        recommendation: "contraindicated",
        modifications: {
          liveVaccineContraindicated: true,
        },
        rationale: "Live oral vaccine; contraindicated in SCID and immunocompromised infants",
        requiresClinicianReview: true,
        reviewUrgency: "immediate",
        citation: { source: "ACIP", documentTitle: "Rotavirus Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Rotavirus Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "SCID",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Rotavirus Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "History of intussusception",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Rotavirus Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [
      {
        condition: "Altered immunocompetence other than SCID",
        recommendation: "Assess benefits and risks",
        requiresClinicianReview: true,
        citation: { source: "ACIP", documentTitle: "Rotavirus Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    specialPopulations: [],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "hpv-v2",
    vaccineGroup: "HPV",
    seriesName: "Human Papillomavirus Series",
    cvxCodes: ["62", "118", "137", "165"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 3285,
        recommendedAgeDays: 4017,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "HPV dose 1 at 11-12 years; can start as early as 9 years",
        citation: { source: "CDC", documentTitle: "Child/Adolescent Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 3465,
        recommendedAgeDays: 4197,
        minimumIntervalDays: 150,
        recommendedIntervalDays: 180,
        notes: "Dose 2 at 6-12 months after dose 1 (if started before age 15)",
        citation: { source: "ACIP", documentTitle: "HPV Vaccine Recommendations", publicationDate: "2024-02-08", footnote: "2-dose schedule for <15yo" },
      },
      {
        doseNumber: 3,
        minimumAgeDays: 3549,
        recommendedAgeDays: 4197,
        minimumIntervalDays: 84,
        recommendedIntervalDays: 150,
        notes: "Dose 3 only needed if series started at ≥15 years or immunocompromised",
        citation: { source: "ACIP", documentTitle: "HPV Vaccine Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "hpv-catchup-15-26",
        startingAgeMonths: 180,
        endingAgeMonths: 312,
        priorDosesReceived: 0,
        remainingDosesNeeded: 3,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 60, notes: "Minimum 4 weeks" },
          { fromDose: 2, toDose: 3, minimumIntervalDays: 84, recommendedIntervalDays: 120, notes: "12 weeks after dose 2, 5 months after dose 1" },
        ],
        citation: { source: "ACIP", documentTitle: "HPV Catch-up", publicationDate: "2024-02-08" },
      },
      {
        id: "hpv-catchup-9-14-2dose",
        startingAgeMonths: 108,
        endingAgeMonths: 179,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 150, recommendedIntervalDays: 180, notes: "6-12 months interval; if <5 months, need 3rd dose" },
        ],
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "HPV",
        immunocompromiseLevel: "moderate",
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
        },
        rationale: "Immunocompromised persons should receive 3-dose series regardless of age at vaccination initiation",
        requiresClinicianReview: false,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
      {
        vaccineGroup: "HPV",
        immunocompromiseLevel: "severe",
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
        },
        rationale: "3-dose series required; vaccine is safe but immunogenicity may be reduced",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component (including yeast)",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [
      {
        condition: "Pregnancy",
        recommendation: "Vaccination not recommended during pregnancy; no adverse outcomes observed, but defer until after pregnancy",
        requiresClinicianReview: false,
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    specialPopulations: [
      {
        population: "Ages 27-45 shared decision",
        riskFlags: [],
        ageModification: { minimumAgeMonths: 324, maximumAgeMonths: 540 },
        recommendation: "Shared clinical decision-making for adults 27-45 not previously vaccinated",
        citation: { source: "ACIP", documentTitle: "HPV Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "menacwy-v2",
    vaccineGroup: "Meningococcal ACWY",
    seriesName: "Meningococcal ACWY Series",
    cvxCodes: ["114", "136", "147", "148", "203"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 4017,
        recommendedAgeDays: 4017,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "MenACWY dose 1 at 11-12 years",
        citation: { source: "CDC", documentTitle: "Adolescent Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 5844,
        recommendedAgeDays: 5844,
        minimumIntervalDays: 56,
        recommendedIntervalDays: 1461,
        notes: "Booster at 16 years",
        citation: { source: "CDC", documentTitle: "Adolescent Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "menacwy-catchup-13-15",
        startingAgeMonths: 156,
        endingAgeMonths: 191,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 56, recommendedIntervalDays: 56, notes: "Booster at 16-18 years" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
      {
        id: "menacwy-catchup-16-18",
        startingAgeMonths: 192,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 1,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0, notes: "1 dose if first dose at 16+" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "Meningococcal ACWY",
        immunocompromiseLevel: "severe",
        categories: ["asplenia_anatomic", "asplenia_functional", "complement_deficiency", "hiv_cd4_below_200"],
        recommendation: "modified",
        modifications: {
          additionalDoses: 1,
          boosterFrequency: "Every 5 years",
        },
        rationale: "2-dose primary series 8 weeks apart; boosters every 5 years for ongoing risk",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "Meningococcal ACIP Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Meningococcal Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [
      {
        population: "College freshmen in dorms",
        riskFlags: [],
        recommendation: "Ensure up-to-date MenACWY; dose at 16+ preferred",
        citation: { source: "ACIP", documentTitle: "Meningococcal Recommendations", publicationDate: "2024-02-08" },
      },
      {
        population: "Military recruits",
        riskFlags: [],
        recommendation: "MenACWY required",
        citation: { source: "ACIP", documentTitle: "Meningococcal Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "hepa-v2",
    vaccineGroup: "HepA",
    seriesName: "Hepatitis A Series",
    cvxCodes: ["83", "84", "85", "104"],
    isLiveVaccine: false,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 365,
        recommendedAgeDays: 365,
        maximumAgeDays: 699,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "HepA dose 1 at 12-23 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 547,
        recommendedAgeDays: 547,
        minimumIntervalDays: 180,
        recommendedIntervalDays: 180,
        notes: "Dose 2 at least 6 months after dose 1",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "hepa-catchup",
        startingAgeMonths: 12,
        endingAgeMonths: 216,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 180, recommendedIntervalDays: 180 },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "HepA",
        immunocompromiseLevel: "severe",
        recommendation: "standard",
        rationale: "Inactivated vaccine; safe for immunocompromised patients. Response may be reduced.",
        requiresClinicianReview: false,
        reviewUrgency: "routine",
        citation: { source: "CDC", documentTitle: "Hepatitis A Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Hepatitis A Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [],
    specialPopulations: [
      {
        population: "Chronic liver disease",
        riskFlags: ["chronic_liver"],
        recommendation: "Vaccination recommended for persons with chronic liver disease",
        citation: { source: "ACIP", documentTitle: "Hepatitis A Recommendations", publicationDate: "2024-02-08" },
      },
      {
        population: "International travelers",
        riskFlags: ["travel"],
        recommendation: "Vaccination recommended before travel to endemic areas",
        citation: { source: "CDC", documentTitle: "Yellow Book", publicationDate: "2024" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
  {
    id: "varicella-v2",
    vaccineGroup: "Varicella",
    seriesName: "Varicella (Chickenpox) Series",
    cvxCodes: ["21", "94"],
    isLiveVaccine: true,
    routineSchedule: [
      {
        doseNumber: 1,
        minimumAgeDays: 365,
        recommendedAgeDays: 365,
        maximumAgeDays: 456,
        minimumIntervalDays: 0,
        recommendedIntervalDays: 0,
        notes: "Varicella dose 1 at 12-15 months",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
      {
        doseNumber: 2,
        minimumAgeDays: 1461,
        recommendedAgeDays: 1461,
        maximumAgeDays: 2191,
        minimumIntervalDays: 84,
        recommendedIntervalDays: 1096,
        absoluteMinimumIntervalDays: 84,
        gracePeriodDays: 4,
        notes: "Dose 2 at 4-6 years; minimum 3 months after dose 1",
        citation: { source: "CDC", documentTitle: "Child Immunization Schedule", publicationDate: "2024-02-08" },
      },
    ],
    catchUpSchedule: [
      {
        id: "varicella-catchup-child",
        startingAgeMonths: 12,
        endingAgeMonths: 156,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 84, recommendedIntervalDays: 84, notes: "3 months minimum if <13 years" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
      {
        id: "varicella-catchup-teen-adult",
        startingAgeMonths: 156,
        endingAgeMonths: 999,
        priorDosesReceived: 0,
        remainingDosesNeeded: 2,
        intervals: [
          { fromDose: 0, toDose: 1, minimumIntervalDays: 0, recommendedIntervalDays: 0 },
          { fromDose: 1, toDose: 2, minimumIntervalDays: 28, recommendedIntervalDays: 28, notes: "4 weeks minimum for ≥13 years" },
        ],
        citation: { source: "CDC", documentTitle: "Catch-up Schedule", publicationDate: "2024-02-08" },
      },
    ],
    immunocompromiseRules: [
      {
        vaccineGroup: "Varicella",
        immunocompromiseLevel: "severe",
        recommendation: "contraindicated",
        modifications: {
          liveVaccineContraindicated: true,
        },
        rationale: "Live vaccine; contraindicated in severely immunocompromised patients",
        requiresClinicianReview: true,
        reviewUrgency: "immediate",
        citation: { source: "ACIP", documentTitle: "Varicella ACIP Recommendations", publicationDate: "2024-02-08" },
      },
      {
        vaccineGroup: "Varicella",
        immunocompromiseLevel: "moderate",
        categories: ["hiv_cd4_above_200"],
        recommendation: "clinician_required",
        rationale: "May be considered for HIV-infected persons with CD4 ≥200 cells/μL",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citation: { source: "ACIP", documentTitle: "Varicella Recommendations", publicationDate: "2024-02-08" },
      },
    ],
    contraindications: [
      {
        condition: "Severe allergic reaction to previous dose or vaccine component (including gelatin, neomycin)",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Varicella Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "Severe immunodeficiency",
        severity: "absolute",
        citation: { source: "ACIP", documentTitle: "Varicella Recommendations", publicationDate: "2024-02-08" },
      },
      {
        condition: "Pregnancy",
        severity: "absolute",
        citation: { source: "CDC", documentTitle: "Pregnancy and Vaccination", publicationDate: "2024-02-08" },
      },
    ],
    precautions: [
      {
        condition: "Recent blood product receipt",
        recommendation: "Defer vaccination based on product received",
        requiresClinicianReview: true,
        citation: { source: "ACIP", documentTitle: "General Best Practice Guidelines", publicationDate: "2024-02-08" },
      },
    ],
    specialPopulations: [
      {
        population: "Healthcare personnel without evidence of immunity",
        riskFlags: ["healthcare_worker"],
        recommendation: "2-dose series required",
        citation: { source: "ACIP", documentTitle: "Immunization of HCP", publicationDate: "2024-02-08" },
      },
    ],
    metadata: {
      version: "2024.1.0",
      effectiveDate: "2024-02-08",
      lastReviewedDate: "2025-01-23",
      reviewedBy: "Tabula Medica Clinical Team",
      changeLog: [],
    },
  },
];

export const vaccineRulesEngineV2 = {
  getVersion(): string {
    return RULES_ENGINE_VERSION;
  },

  getEffectiveDate(): string {
    return RULES_EFFECTIVE_DATE;
  },

  getAllRules(): VaccineScheduleRuleV2[] {
    return COMPREHENSIVE_VACCINE_RULES;
  },

  getRuleByVaccineGroup(vaccineGroup: string): VaccineScheduleRuleV2 | undefined {
    return COMPREHENSIVE_VACCINE_RULES.find(r => 
      r.vaccineGroup.toLowerCase() === vaccineGroup.toLowerCase() ||
      r.id.toLowerCase().includes(vaccineGroup.toLowerCase())
    );
  },

  exportRulesForAudit(exportedBy: string): RulesExportFormat {
    const allCitations = new Set<string>();
    COMPREHENSIVE_VACCINE_RULES.forEach(rule => {
      rule.routineSchedule.forEach(d => allCitations.add(d.citation.source));
      rule.catchUpSchedule.forEach(c => allCitations.add(c.citation.source));
      rule.immunocompromiseRules.forEach(i => allCitations.add(i.citation.source));
      rule.contraindications.forEach(c => allCitations.add(c.citation.source));
    });

    return {
      engineVersion: RULES_ENGINE_VERSION,
      exportDate: new Date().toISOString(),
      exportedBy,
      rules: COMPREHENSIVE_VACCINE_RULES,
      metadata: {
        totalRules: COMPREHENSIVE_VACCINE_RULES.length,
        vaccineGroups: COMPREHENSIVE_VACCINE_RULES.map(r => r.vaccineGroup),
        citationSources: Array.from(allCitations),
        complianceStatement: "These rules are based on CDC/ACIP published immunization schedules and recommendations. They are intended for informational purposes only and do not constitute medical advice.",
      },
      disclaimer: NO_CDS_DISCLAIMER,
    };
  },

  evaluateImmunocompromiseStatus(
    vaccineGroup: string,
    immunoStatus: ImmunocompromiseStatus
  ): {
    recommendation: string;
    requiresClinicianReview: boolean;
    reviewUrgency: "routine" | "urgent" | "immediate";
    modifications?: ImmunocompromiseRule["modifications"];
    citations: RuleCitation[];
  } {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    if (!rule) {
      return {
        recommendation: "unknown",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citations: [],
      };
    }

    const applicableRules = rule.immunocompromiseRules.filter(ir => {
      if (ir.immunocompromiseLevel !== immunoStatus.level) return false;
      if (ir.categories && ir.categories.length > 0) {
        return ir.categories.some(c => immunoStatus.categories.includes(c));
      }
      return true;
    });

    if (applicableRules.length === 0) {
      const fallbackRule = rule.immunocompromiseRules.find(ir => ir.immunocompromiseLevel === immunoStatus.level);
      if (fallbackRule) {
        return {
          recommendation: fallbackRule.recommendation,
          requiresClinicianReview: fallbackRule.requiresClinicianReview,
          reviewUrgency: fallbackRule.reviewUrgency,
          modifications: fallbackRule.modifications,
          citations: [fallbackRule.citation],
        };
      }
      return {
        recommendation: "clinician_required",
        requiresClinicianReview: true,
        reviewUrgency: "routine",
        citations: [],
      };
    }

    const mostRestrictive = applicableRules.reduce((prev, curr) => {
      const urgencyOrder = { immediate: 3, urgent: 2, routine: 1 };
      return urgencyOrder[curr.reviewUrgency] > urgencyOrder[prev.reviewUrgency] ? curr : prev;
    });

    return {
      recommendation: mostRestrictive.recommendation,
      requiresClinicianReview: mostRestrictive.requiresClinicianReview,
      reviewUrgency: mostRestrictive.reviewUrgency,
      modifications: mostRestrictive.modifications,
      citations: applicableRules.map(r => r.citation),
    };
  },

  calculateCatchUpSchedule(
    vaccineGroup: string,
    ageMonths: number,
    dosesReceived: number,
    lastDoseDate?: string
  ): {
    remainingDoses: number;
    intervals: CatchUpInterval[];
    nextDoseMinimumDate: string;
    nextDoseRecommendedDate: string;
    citation?: RuleCitation;
  } | null {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    if (!rule) return null;

    const applicableCatchUp = rule.catchUpSchedule.find(cu =>
      ageMonths >= cu.startingAgeMonths &&
      ageMonths < cu.endingAgeMonths &&
      dosesReceived === cu.priorDosesReceived
    );

    if (!applicableCatchUp) {
      if (dosesReceived >= rule.routineSchedule.length) {
        return {
          remainingDoses: 0,
          intervals: [],
          nextDoseMinimumDate: "",
          nextDoseRecommendedDate: "",
        };
      }
      return null;
    }

    const today = new Date();
    const nextInterval = applicableCatchUp.intervals.find(i => i.fromDose === dosesReceived);
    
    let minimumDate = today;
    let recommendedDate = today;

    if (lastDoseDate && nextInterval) {
      const lastDate = new Date(lastDoseDate);
      minimumDate = new Date(lastDate);
      minimumDate.setDate(minimumDate.getDate() + nextInterval.minimumIntervalDays);
      recommendedDate = new Date(lastDate);
      recommendedDate.setDate(recommendedDate.getDate() + nextInterval.recommendedIntervalDays);
    }

    if (minimumDate < today) minimumDate = today;
    if (recommendedDate < today) recommendedDate = today;

    return {
      remainingDoses: applicableCatchUp.remainingDosesNeeded - dosesReceived,
      intervals: applicableCatchUp.intervals.slice(dosesReceived),
      nextDoseMinimumDate: minimumDate.toISOString().split("T")[0],
      nextDoseRecommendedDate: recommendedDate.toISOString().split("T")[0],
      citation: applicableCatchUp.citation,
    };
  },

  evaluateScheduleWithIntervals(
    vaccineGroup: string,
    birthDate: string,
    dosesWithDates: { doseNumber: number; dateAdministered: string }[],
    immunoStatus?: ImmunocompromiseStatus
  ): ScheduleEvaluationResult {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    const ageMonths = Math.floor((today.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    const ageDays = Math.floor((today.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24));

    const baseResult: ScheduleEvaluationResult = {
      patientId: "",
      profileId: "",
      evaluationDate: today.toISOString(),
      vaccineGroup,
      seriesName: rule?.seriesName || vaccineGroup,
      status: "unknown",
      dosesReceived: dosesWithDates.length,
      dosesRequired: rule?.routineSchedule.length || 0,
      confidence: "low",
      clinicianReviewRequired: true,
      reviewReasons: [],
      appliedRules: {
        ruleId: rule?.id || "unknown",
        ruleVersion: rule?.metadata.version || "unknown",
        citations: [],
      },
      warnings: [],
      disclaimer: NO_CDS_DISCLAIMER,
    };

    if (!rule) {
      baseResult.reviewReasons.push("No vaccine schedule rule found for this vaccine group");
      return baseResult;
    }

    if (immunoStatus && immunoStatus.level !== "none") {
      const immunoEval = this.evaluateImmunocompromiseStatus(vaccineGroup, immunoStatus);
      baseResult.immunocompromiseConsiderations = [immunoEval.recommendation];
      if (immunoEval.requiresClinicianReview) {
        baseResult.clinicianReviewRequired = true;
        baseResult.reviewReasons.push(`Immunocompromise (${immunoStatus.level}): ${immunoEval.recommendation}`);
      }
      if (immunoEval.recommendation === "contraindicated") {
        baseResult.status = "contraindicated";
        baseResult.reviewReasons.push("Vaccine may be contraindicated due to immunocompromise status");
        return baseResult;
      }
      baseResult.appliedRules.citations.push(...immunoEval.citations);
    }

    const sortedDoses = [...dosesWithDates].sort((a, b) => 
      new Date(a.dateAdministered).getTime() - new Date(b.dateAdministered).getTime()
    );

    for (let i = 0; i < sortedDoses.length; i++) {
      const dose = sortedDoses[i];
      const expectedRule = rule.routineSchedule[i];
      if (!expectedRule) continue;

      const doseDate = new Date(dose.dateAdministered);
      const doseAgeDays = Math.floor((doseDate.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24));

      if (doseAgeDays < expectedRule.minimumAgeDays - (expectedRule.gracePeriodDays || 4)) {
        baseResult.warnings.push(
          `Dose ${dose.doseNumber} may have been administered too early (age ${Math.floor(doseAgeDays / 30)} months, minimum ${Math.floor(expectedRule.minimumAgeDays / 30)} months)`
        );
        baseResult.clinicianReviewRequired = true;
        baseResult.reviewReasons.push("Dose timing may not meet minimum age requirements");
      }

      if (i > 0) {
        const prevDose = sortedDoses[i - 1];
        const prevDate = new Date(prevDose.dateAdministered);
        const intervalDays = Math.floor((doseDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const absoluteMin = expectedRule.absoluteMinimumIntervalDays || expectedRule.minimumIntervalDays;
        const graceAdjusted = absoluteMin - (expectedRule.gracePeriodDays || 4);

        if (intervalDays < graceAdjusted) {
          baseResult.warnings.push(
            `Interval between dose ${i} and ${i + 1} (${intervalDays} days) is less than minimum (${absoluteMin} days)`
          );
          baseResult.clinicianReviewRequired = true;
          baseResult.reviewReasons.push("Dose interval may not meet minimum requirements");
        }
      }

      baseResult.appliedRules.citations.push(expectedRule.citation);
    }

    const dosesRequired = immunoStatus?.level === "severe" || immunoStatus?.level === "moderate"
      ? rule.routineSchedule.length + (rule.immunocompromiseRules.find(ir => ir.modifications?.additionalDoses)?.modifications?.additionalDoses || 0)
      : rule.routineSchedule.length;

    baseResult.dosesRequired = dosesRequired;

    if (sortedDoses.length >= dosesRequired) {
      baseResult.status = "complete";
      baseResult.completionDate = sortedDoses[sortedDoses.length - 1].dateAdministered;
      baseResult.confidence = baseResult.warnings.length === 0 ? "high" : "medium";
      if (baseResult.warnings.length === 0) {
        baseResult.clinicianReviewRequired = false;
        baseResult.reviewReasons = [];
      }
      return baseResult;
    }

    const nextDoseNumber = sortedDoses.length + 1;
    const nextDoseRule = rule.routineSchedule[sortedDoses.length];

    if (!nextDoseRule) {
      const catchUp = this.calculateCatchUpSchedule(
        vaccineGroup,
        ageMonths,
        sortedDoses.length,
        sortedDoses[sortedDoses.length - 1]?.dateAdministered
      );

      if (catchUp) {
        baseResult.status = "catch_up_needed";
        baseResult.nextDose = {
          doseNumber: nextDoseNumber,
          minimumDate: catchUp.nextDoseMinimumDate,
          recommendedDate: catchUp.nextDoseRecommendedDate,
          intervalType: "catch_up",
        };
        if (catchUp.citation) {
          baseResult.appliedRules.citations.push(catchUp.citation);
        }
      }
      baseResult.confidence = "medium";
      return baseResult;
    }

    let minimumDate: Date;
    let recommendedDate: Date;

    if (sortedDoses.length === 0) {
      minimumDate = new Date(birthDateObj);
      minimumDate.setDate(minimumDate.getDate() + nextDoseRule.minimumAgeDays);
      recommendedDate = new Date(birthDateObj);
      recommendedDate.setDate(recommendedDate.getDate() + nextDoseRule.recommendedAgeDays);
    } else {
      const lastDose = sortedDoses[sortedDoses.length - 1];
      const lastDate = new Date(lastDose.dateAdministered);
      
      const ageBasedMin = new Date(birthDateObj);
      ageBasedMin.setDate(ageBasedMin.getDate() + nextDoseRule.minimumAgeDays);
      
      const intervalBasedMin = new Date(lastDate);
      intervalBasedMin.setDate(intervalBasedMin.getDate() + nextDoseRule.minimumIntervalDays);
      
      minimumDate = ageBasedMin > intervalBasedMin ? ageBasedMin : intervalBasedMin;
      
      const ageBasedRec = new Date(birthDateObj);
      ageBasedRec.setDate(ageBasedRec.getDate() + nextDoseRule.recommendedAgeDays);
      
      const intervalBasedRec = new Date(lastDate);
      intervalBasedRec.setDate(intervalBasedRec.getDate() + nextDoseRule.recommendedIntervalDays);
      
      recommendedDate = ageBasedRec > intervalBasedRec ? ageBasedRec : intervalBasedRec;
    }

    const overdueDays = 30;
    const overdueDate = new Date(recommendedDate);
    overdueDate.setDate(overdueDate.getDate() + overdueDays);

    if (today < minimumDate) {
      baseResult.status = "on_schedule";
    } else if (today >= minimumDate && today <= recommendedDate) {
      baseResult.status = "due_soon";
    } else if (today > recommendedDate && today <= overdueDate) {
      baseResult.status = "due_soon";
    } else {
      baseResult.status = "overdue";
    }

    baseResult.nextDose = {
      doseNumber: nextDoseNumber,
      minimumDate: minimumDate.toISOString().split("T")[0],
      recommendedDate: recommendedDate.toISOString().split("T")[0],
      overdueDate: overdueDate.toISOString().split("T")[0],
      intervalType: "routine",
    };

    baseResult.appliedRules.citations.push(nextDoseRule.citation);
    baseResult.confidence = baseResult.warnings.length === 0 ? "high" : "medium";

    if (baseResult.warnings.length === 0 && !baseResult.immunocompromiseConsiderations?.length) {
      baseResult.clinicianReviewRequired = false;
      baseResult.reviewReasons = [];
    }

    return baseResult;
  },

  getContraindications(vaccineGroup: string): ContraindicationRule[] {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    return rule?.contraindications || [];
  },

  getPrecautions(vaccineGroup: string): PrecautionRule[] {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    return rule?.precautions || [];
  },

  getSpecialPopulationRecommendations(
    vaccineGroup: string,
    riskFlags: string[]
  ): SpecialPopulationRule[] {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    if (!rule) return [];

    return rule.specialPopulations.filter(sp =>
      sp.riskFlags.length === 0 || sp.riskFlags.some(f => riskFlags.includes(f))
    );
  },

  isLiveVaccine(vaccineGroup: string): boolean {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    return rule?.isLiveVaccine || false;
  },

  getCVXCodesForGroup(vaccineGroup: string): string[] {
    const rule = this.getRuleByVaccineGroup(vaccineGroup);
    return rule?.cvxCodes || [];
  },
};

export default vaccineRulesEngineV2;
