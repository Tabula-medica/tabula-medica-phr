import { logPhiAccess } from "../security/hipaa-audit";

export const ENGINE_VERSION = "1.0.0";
export const ENGINE_EFFECTIVE_DATE = "2026-01-23";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is for educational and tracking purposes only. It does NOT constitute medical advice and should NOT replace professional medical consultation. Always discuss any health decisions with your healthcare provider.";

export type RuleDomain = 
  | "diabetes_screening"
  | "vaccine_reminder"
  | "cancer_followup"
  | "pediatric_schedule"
  | "geriatric_care"
  | "preventive_care"
  | "chronic_disease"
  | "medication_adherence";

export type PopulationView = 
  | "standard"
  | "pediatric"
  | "geriatric"
  | "caregiver"
  | "accessibility"
  | "oncology";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "due_soon" | "overdue" | "completed" | "skipped" | "not_applicable";
export type GuardrailAction = "allow" | "block" | "require_review" | "warn";

export interface RuleCitation {
  id: string;
  source: "CDC" | "ACIP" | "ADA" | "ASCO" | "AAP" | "AGS" | "USPSTF" | "FDA" | "WHO" | "NCCN" | "ACS" | "CMS" | "State" | "Institutional";
  documentTitle: string;
  version?: string;
  publicationDate: string;
  effectiveDate: string;
  expirationDate?: string;
  url?: string;
  section?: string;
  footnote?: string;
  accessedAt: string;
}

export interface RuleVersion {
  version: string;
  effectiveDate: string;
  expirationDate?: string;
  publishedAt: string;
  publishedBy: string;
  changeLog: ChangeLogEntry[];
  approvalStatus: "draft" | "pending_review" | "approved" | "deprecated" | "retired";
  approvedBy?: string;
  approvedAt?: string;
}

export interface ChangeLogEntry {
  date: string;
  author: string;
  description: string;
  breaking: boolean;
  affectedRules: string[];
}

export interface ActivationGuardrail {
  id: string;
  name: string;
  description: string;
  condition: GuardrailCondition;
  action: GuardrailAction;
  message: string;
  requiresOverride: boolean;
  overrideRequiresReason: boolean;
  auditRequired: boolean;
}

export interface GuardrailCondition {
  type: "age" | "condition" | "medication" | "lab_value" | "risk_flag" | "contraindication" | "allergy" | "pregnancy" | "custom";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "between" | "in" | "not_in" | "exists" | "not_exists";
  field: string;
  value: string | number | boolean | string[];
  secondaryValue?: string | number;
}

export interface RuleTemplate {
  id: string;
  domain: RuleDomain;
  name: string;
  description: string;
  version: RuleVersion;
  citations: RuleCitation[];
  guardrails: ActivationGuardrail[];
  eligibilityCriteria: EligibilityCriterion[];
  taskDefinition: TaskDefinition;
  cadence: TaskCadence;
  populationAdaptations: PopulationAdaptation[];
  metadata: RuleMetadata;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityCriterion {
  id: string;
  type: "age" | "condition" | "medication" | "lab_result" | "risk_factor" | "procedure_history" | "family_history";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "between" | "in" | "not_in" | "exists" | "not_exists";
  field: string;
  value: string | number | boolean | string[];
  secondaryValue?: string | number;
  required: boolean;
  description: string;
}

export interface TaskDefinition {
  title: string;
  titleTemplate: string;
  description: string;
  descriptionTemplate: string;
  category: "screening" | "lab" | "appointment" | "vaccination" | "self_care" | "medication" | "education" | "followup";
  defaultPriority: TaskPriority;
  estimatedDurationMinutes?: number;
  requiresProvider: boolean;
  providerTypes?: string[];
  associatedCodes?: {
    icd10?: string[];
    cpt?: string[];
    loinc?: string[];
    cvx?: string[];
  };
}

export interface TaskCadence {
  type: "one_time" | "recurring" | "age_based" | "event_triggered";
  intervalMonths?: number;
  intervalDays?: number;
  ageTriggersMonths?: number[];
  eventTriggers?: string[];
  gracePeriodDays: number;
  overdueThresholdDays: number;
}

export interface PopulationAdaptation {
  population: PopulationView;
  titleOverride?: string;
  descriptionOverride?: string;
  priorityOverride?: TaskPriority;
  simplifiedView: boolean;
  largeText: boolean;
  iconEmphasis: boolean;
  voiceEnabled: boolean;
  additionalInstructions?: string;
  hiddenFields?: string[];
  emphasisFields?: string[];
}

export interface RuleMetadata {
  tags: string[];
  targetPopulations: string[];
  riskFlags: string[];
  contraindications: string[];
  relatedRules: string[];
  dependencies: string[];
}

export interface GeneratedTask {
  id: string;
  ruleTemplateId: string;
  ruleVersion: string;
  patientId: string;
  profileId: string;
  domain: RuleDomain;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  overdueDate: string;
  lastCompletedAt?: string;
  nextDueAt?: string;
  citations: RuleCitation[];
  populationView: PopulationView;
  adaptedTitle?: string;
  adaptedDescription?: string;
  guardrailResults: GuardrailResult[];
  requiresReview: boolean;
  reviewReason?: string;
  disclaimer: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailResult {
  guardrailId: string;
  guardrailName: string;
  action: GuardrailAction;
  triggered: boolean;
  message?: string;
  overridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
}

export interface PatientContext {
  patientId: string;
  profileId: string;
  dateOfBirth: string;
  ageMonths: number;
  ageYears: number;
  conditions: string[];
  medications: string[];
  allergies: string[];
  riskFlags: string[];
  labResults: { code: string; value: number; date: string }[];
  procedures: { code: string; date: string }[];
  immunizations: { cvxCode: string; date: string }[];
  familyHistory: string[];
  isPregnant: boolean;
  populationView: PopulationView;
}

export interface TaskGenerationResult {
  tasks: GeneratedTask[];
  blockedTasks: { ruleId: string; reason: string; guardrail: string }[];
  warnings: { ruleId: string; message: string }[];
  disclaimer: string;
  engineVersion: string;
  generatedAt: string;
}

class ClinicalRuleTemplateEngine {
  private ruleTemplates: Map<string, RuleTemplate> = new Map();
  private generatedTasks: Map<string, GeneratedTask[]> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    console.log("[ClinicalRuleEngine] Service initialized");
    console.log("[ClinicalRuleEngine] Version:", ENGINE_VERSION);
    console.log("[ClinicalRuleEngine] Features: unified versioning, citations, guardrails, population adaptations");
    console.log("[ClinicalRuleEngine] Domains: diabetes, vaccines, cancer, pediatric, geriatric, preventive care");
    console.log("[ClinicalRuleEngine] NO-CDS compliance enabled for all outputs");
  }

  private initializeDefaultTemplates(): void {
    const diabetesA1cRule: RuleTemplate = {
      id: "diabetes-a1c-screening",
      domain: "diabetes_screening",
      name: "HbA1c Screening",
      description: "Regular HbA1c testing for diabetes management per ADA guidelines",
      version: {
        version: "2026.1",
        effectiveDate: "2026-01-01",
        publishedAt: "2025-12-15",
        publishedBy: "Clinical Guidelines Team",
        changeLog: [
          { date: "2025-12-15", author: "System", description: "Initial rule based on ADA 2026 Standards", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved",
        approvedBy: "Clinical Committee",
        approvedAt: "2025-12-20"
      },
      citations: [
        {
          id: "ada-2026-a1c",
          source: "ADA",
          documentTitle: "Standards of Care in Diabetes—2026",
          version: "2026",
          publicationDate: "2025-12-01",
          effectiveDate: "2026-01-01",
          section: "6. Glycemic Goals and Hypoglycemia",
          url: "https://diabetesjournals.org/care/issue/49/Supplement_1",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [
        {
          id: "a1c-pregnancy-guardrail",
          name: "Pregnancy A1c Frequency",
          description: "Pregnant patients may require more frequent monitoring",
          condition: { type: "pregnancy", operator: "equals", field: "isPregnant", value: true },
          action: "warn",
          message: "Pregnancy detected: Consider more frequent A1c monitoring per OB-GYN guidance",
          requiresOverride: false,
          overrideRequiresReason: false,
          auditRequired: true
        }
      ],
      eligibilityCriteria: [
        {
          id: "diabetes-diagnosis",
          type: "condition",
          operator: "in",
          field: "conditions",
          value: ["E10", "E11", "E13", "diabetes", "type 1 diabetes", "type 2 diabetes"],
          required: true,
          description: "Patient has diabetes diagnosis"
        }
      ],
      taskDefinition: {
        title: "HbA1c Test",
        titleTemplate: "HbA1c Test Due",
        description: "Schedule your regular HbA1c blood test to monitor blood sugar control over the past 2-3 months",
        descriptionTemplate: "Your HbA1c test helps track your average blood sugar. Last result: {{lastValue}} on {{lastDate}}",
        category: "lab",
        defaultPriority: "medium",
        estimatedDurationMinutes: 15,
        requiresProvider: true,
        providerTypes: ["lab", "primary_care", "endocrinology"],
        associatedCodes: { loinc: ["4548-4", "17856-6"], cpt: ["83036"] }
      },
      cadence: {
        type: "recurring",
        intervalMonths: 3,
        gracePeriodDays: 14,
        overdueThresholdDays: 30
      },
      populationAdaptations: [
        {
          population: "geriatric",
          titleOverride: "Blood Sugar Test",
          descriptionOverride: "Time for your regular blood test to check your diabetes. This test shows how well your blood sugar has been controlled.",
          simplifiedView: true,
          largeText: true,
          iconEmphasis: true,
          voiceEnabled: true,
          hiddenFields: ["loinc", "cpt"],
          emphasisFields: ["dueDate", "priority"]
        },
        {
          population: "pediatric",
          titleOverride: "A1c Check-up",
          descriptionOverride: "Time for the blood test that shows how well diabetes is being managed. Parent/guardian should schedule this appointment.",
          simplifiedView: true,
          largeText: false,
          iconEmphasis: true,
          voiceEnabled: false,
          additionalInstructions: "Coordinate with school nurse if needed"
        },
        {
          population: "caregiver",
          descriptionOverride: "Schedule HbA1c test for your care recipient. This monitors their long-term blood sugar control.",
          simplifiedView: false,
          largeText: false,
          iconEmphasis: false,
          voiceEnabled: false,
          emphasisFields: ["dueDate", "lastResult", "trend"]
        }
      ],
      metadata: {
        tags: ["diabetes", "lab", "a1c", "glycemic-control"],
        targetPopulations: ["adults", "pediatric", "geriatric"],
        riskFlags: ["diabetes"],
        contraindications: [],
        relatedRules: ["diabetes-eye-exam", "diabetes-foot-exam", "diabetes-kidney-labs"],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const diabetesEyeExamRule: RuleTemplate = {
      id: "diabetes-eye-exam",
      domain: "diabetes_screening",
      name: "Dilated Eye Exam",
      description: "Annual dilated eye exam for diabetic retinopathy screening per ADA guidelines",
      version: {
        version: "2026.1",
        effectiveDate: "2026-01-01",
        publishedAt: "2025-12-15",
        publishedBy: "Clinical Guidelines Team",
        changeLog: [
          { date: "2025-12-15", author: "System", description: "Initial rule based on ADA 2026 Standards", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved"
      },
      citations: [
        {
          id: "ada-2026-retinopathy",
          source: "ADA",
          documentTitle: "Standards of Care in Diabetes—2026",
          version: "2026",
          publicationDate: "2025-12-01",
          effectiveDate: "2026-01-01",
          section: "12. Retinopathy, Neuropathy, and Foot Care",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [],
      eligibilityCriteria: [
        {
          id: "diabetes-diagnosis",
          type: "condition",
          operator: "in",
          field: "conditions",
          value: ["E10", "E11", "E13", "diabetes"],
          required: true,
          description: "Patient has diabetes diagnosis"
        }
      ],
      taskDefinition: {
        title: "Dilated Eye Exam",
        titleTemplate: "Annual Eye Exam Due",
        description: "Schedule your annual dilated eye exam to screen for diabetic retinopathy",
        descriptionTemplate: "Annual eye exam to check for diabetes-related eye problems. Last exam: {{lastDate}}",
        category: "screening",
        defaultPriority: "medium",
        estimatedDurationMinutes: 45,
        requiresProvider: true,
        providerTypes: ["ophthalmology", "optometry"],
        associatedCodes: { cpt: ["92004", "92014", "92250"] }
      },
      cadence: {
        type: "recurring",
        intervalMonths: 12,
        gracePeriodDays: 30,
        overdueThresholdDays: 60
      },
      populationAdaptations: [
        {
          population: "geriatric",
          titleOverride: "Eye Doctor Visit",
          descriptionOverride: "Time for your yearly eye checkup. The doctor will put drops in your eyes to check for diabetes-related problems. Bring sunglasses.",
          simplifiedView: true,
          largeText: true,
          iconEmphasis: true,
          voiceEnabled: true,
          additionalInstructions: "Arrange transportation - you cannot drive after this appointment"
        }
      ],
      metadata: {
        tags: ["diabetes", "screening", "retinopathy", "eye-exam"],
        targetPopulations: ["adults", "geriatric"],
        riskFlags: ["diabetes"],
        contraindications: [],
        relatedRules: ["diabetes-a1c-screening"],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const fluVaccineRule: RuleTemplate = {
      id: "flu-vaccine-annual",
      domain: "vaccine_reminder",
      name: "Annual Influenza Vaccine",
      description: "Annual influenza vaccination per CDC/ACIP recommendations",
      version: {
        version: "2025-2026",
        effectiveDate: "2025-09-01",
        expirationDate: "2026-06-30",
        publishedAt: "2025-08-15",
        publishedBy: "Immunization Guidelines Team",
        changeLog: [
          { date: "2025-08-15", author: "System", description: "Updated for 2025-2026 flu season", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved"
      },
      citations: [
        {
          id: "cdc-flu-2025",
          source: "CDC",
          documentTitle: "Prevention and Control of Seasonal Influenza with Vaccines: Recommendations of ACIP — 2025-26",
          publicationDate: "2025-08-01",
          effectiveDate: "2025-09-01",
          url: "https://www.cdc.gov/flu/professionals/acip/index.htm",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [
        {
          id: "flu-egg-allergy",
          name: "Egg Allergy Check",
          description: "Patients with egg allergy may need specific vaccine formulation",
          condition: { type: "allergy", operator: "in", field: "allergies", value: ["egg", "egg allergy"] },
          action: "warn",
          message: "Egg allergy noted: Discuss vaccine formulation options with provider",
          requiresOverride: false,
          overrideRequiresReason: false,
          auditRequired: true
        },
        {
          id: "flu-gbs-history",
          name: "Guillain-Barré Syndrome History",
          description: "History of GBS within 6 weeks of prior flu vaccine",
          condition: { type: "condition", operator: "in", field: "conditions", value: ["G61.0", "guillain-barre"] },
          action: "require_review",
          message: "History of Guillain-Barré Syndrome: Requires clinician review before vaccination",
          requiresOverride: true,
          overrideRequiresReason: true,
          auditRequired: true
        }
      ],
      eligibilityCriteria: [
        {
          id: "age-6-months",
          type: "age",
          operator: "greater_than",
          field: "ageMonths",
          value: 6,
          required: true,
          description: "Patient is 6 months or older"
        }
      ],
      taskDefinition: {
        title: "Flu Shot",
        titleTemplate: "Annual Flu Vaccine Due",
        description: "Get your annual flu shot to protect against seasonal influenza",
        descriptionTemplate: "Time for your yearly flu vaccine. Last flu shot: {{lastDate}}",
        category: "vaccination",
        defaultPriority: "medium",
        estimatedDurationMinutes: 15,
        requiresProvider: true,
        providerTypes: ["pharmacy", "primary_care", "urgent_care"],
        associatedCodes: { cvx: ["141", "150", "158", "161", "171", "185", "186", "197", "205"] }
      },
      cadence: {
        type: "recurring",
        intervalMonths: 12,
        gracePeriodDays: 60,
        overdueThresholdDays: 90
      },
      populationAdaptations: [
        {
          population: "geriatric",
          titleOverride: "Flu Shot",
          descriptionOverride: "Time for your yearly flu shot. Seniors are at higher risk from flu. You can get this at your doctor or pharmacy.",
          priorityOverride: "high",
          simplifiedView: true,
          largeText: true,
          iconEmphasis: true,
          voiceEnabled: true,
          additionalInstructions: "High-dose flu vaccine recommended for adults 65+"
        },
        {
          population: "pediatric",
          titleOverride: "Flu Vaccine",
          descriptionOverride: "Time for the yearly flu vaccine. Children under 9 may need 2 doses if getting flu vaccine for the first time.",
          simplifiedView: true,
          largeText: false,
          iconEmphasis: true,
          voiceEnabled: false,
          additionalInstructions: "Check if child needs 1 or 2 doses based on prior history"
        }
      ],
      metadata: {
        tags: ["vaccine", "flu", "influenza", "annual", "preventive"],
        targetPopulations: ["all"],
        riskFlags: ["immunocompromised", "chronic_lung", "chronic_heart", "pregnancy", "healthcare_worker"],
        contraindications: ["severe-flu-vaccine-reaction"],
        relatedRules: ["pneumonia-vaccine", "covid-vaccine"],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const cancerFollowupRule: RuleTemplate = {
      id: "cancer-survivorship-followup",
      domain: "cancer_followup",
      name: "Cancer Survivorship Follow-up",
      description: "Regular follow-up visits for cancer survivors per ASCO/NCCN guidelines",
      version: {
        version: "2026.1",
        effectiveDate: "2026-01-01",
        publishedAt: "2025-12-01",
        publishedBy: "Oncology Guidelines Team",
        changeLog: [
          { date: "2025-12-01", author: "System", description: "Initial survivorship follow-up rule", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved"
      },
      citations: [
        {
          id: "asco-survivorship-2025",
          source: "ASCO",
          documentTitle: "Cancer Survivorship Care Guidelines",
          publicationDate: "2025-06-01",
          effectiveDate: "2025-06-01",
          url: "https://www.asco.org/practice-patients/guidelines/survivorship",
          accessedAt: "2026-01-23"
        },
        {
          id: "nccn-survivorship-2025",
          source: "NCCN",
          documentTitle: "NCCN Guidelines: Survivorship",
          version: "2.2025",
          publicationDate: "2025-03-01",
          effectiveDate: "2025-03-01",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [
        {
          id: "cancer-active-treatment",
          name: "Active Treatment Check",
          description: "Patient currently receiving active cancer treatment",
          condition: { type: "condition", operator: "in", field: "conditions", value: ["active-chemo", "active-radiation", "active-immunotherapy"] },
          action: "block",
          message: "Patient is in active treatment. Survivorship follow-up applies after treatment completion.",
          requiresOverride: true,
          overrideRequiresReason: true,
          auditRequired: true
        }
      ],
      eligibilityCriteria: [
        {
          id: "cancer-history",
          type: "condition",
          operator: "in",
          field: "conditions",
          value: ["cancer-survivor", "Z85", "history-of-malignancy"],
          required: true,
          description: "Patient has history of cancer"
        }
      ],
      taskDefinition: {
        title: "Cancer Follow-up Visit",
        titleTemplate: "Survivorship Check-up Due",
        description: "Schedule your regular cancer survivorship follow-up visit",
        descriptionTemplate: "Time for your cancer follow-up appointment with your oncology team. Last visit: {{lastDate}}",
        category: "followup",
        defaultPriority: "high",
        estimatedDurationMinutes: 30,
        requiresProvider: true,
        providerTypes: ["oncology", "primary_care"],
        associatedCodes: { cpt: ["99214", "99215"] }
      },
      cadence: {
        type: "recurring",
        intervalMonths: 3,
        gracePeriodDays: 14,
        overdueThresholdDays: 30
      },
      populationAdaptations: [
        {
          population: "oncology",
          simplifiedView: false,
          largeText: false,
          iconEmphasis: true,
          voiceEnabled: false,
          emphasisFields: ["dueDate", "lastVisit", "nextSteps", "symptoms"]
        },
        {
          population: "geriatric",
          titleOverride: "Cancer Check-up",
          descriptionOverride: "Time for your regular check-up with your cancer doctor. This helps make sure you stay healthy after treatment.",
          simplifiedView: true,
          largeText: true,
          iconEmphasis: true,
          voiceEnabled: true
        }
      ],
      metadata: {
        tags: ["cancer", "survivorship", "oncology", "followup"],
        targetPopulations: ["cancer-survivors"],
        riskFlags: [],
        contraindications: [],
        relatedRules: [],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const wellChildVisitRule: RuleTemplate = {
      id: "pediatric-well-child-visit",
      domain: "pediatric_schedule",
      name: "Well-Child Visit",
      description: "Routine well-child visits per AAP Bright Futures schedule",
      version: {
        version: "2026.1",
        effectiveDate: "2026-01-01",
        publishedAt: "2025-11-01",
        publishedBy: "Pediatric Guidelines Team",
        changeLog: [
          { date: "2025-11-01", author: "System", description: "Based on AAP Bright Futures 4th Edition", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved"
      },
      citations: [
        {
          id: "aap-bright-futures-4",
          source: "AAP",
          documentTitle: "Bright Futures: Guidelines for Health Supervision of Infants, Children, and Adolescents, 4th Edition",
          publicationDate: "2017-01-01",
          effectiveDate: "2017-01-01",
          url: "https://brightfutures.aap.org/materials-and-tools/guidelines-and-pocket-guide/Pages/default.aspx",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [],
      eligibilityCriteria: [
        {
          id: "pediatric-age",
          type: "age",
          operator: "less_than",
          field: "ageYears",
          value: 21,
          required: true,
          description: "Patient is under 21 years old"
        }
      ],
      taskDefinition: {
        title: "Well-Child Visit",
        titleTemplate: "Checkup Due",
        description: "Schedule the next well-child checkup for growth, development, and immunizations",
        descriptionTemplate: "Time for your child's regular checkup. Last visit: {{lastDate}}",
        category: "appointment",
        defaultPriority: "medium",
        estimatedDurationMinutes: 30,
        requiresProvider: true,
        providerTypes: ["pediatrics", "family_medicine"],
        associatedCodes: { cpt: ["99381", "99382", "99383", "99384", "99391", "99392", "99393", "99394"] }
      },
      cadence: {
        type: "age_based",
        ageTriggersMonths: [1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252],
        gracePeriodDays: 30,
        overdueThresholdDays: 60
      },
      populationAdaptations: [
        {
          population: "pediatric",
          simplifiedView: true,
          largeText: false,
          iconEmphasis: true,
          voiceEnabled: false,
          emphasisFields: ["dueDate", "milestones", "vaccines"]
        },
        {
          population: "caregiver",
          descriptionOverride: "Schedule the next well-child visit. Bring immunization records and list any concerns about growth or development.",
          simplifiedView: false,
          largeText: false,
          iconEmphasis: false,
          voiceEnabled: false,
          emphasisFields: ["dueDate", "vaccines", "screenings"]
        }
      ],
      metadata: {
        tags: ["pediatric", "well-child", "preventive", "bright-futures"],
        targetPopulations: ["pediatric"],
        riskFlags: [],
        contraindications: [],
        relatedRules: ["pediatric-vaccines", "developmental-screening"],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const medicationReviewRule: RuleTemplate = {
      id: "geriatric-medication-review",
      domain: "geriatric_care",
      name: "Medication Review",
      description: "Annual comprehensive medication review for polypharmacy management in older adults",
      version: {
        version: "2026.1",
        effectiveDate: "2026-01-01",
        publishedAt: "2025-12-01",
        publishedBy: "Geriatric Guidelines Team",
        changeLog: [
          { date: "2025-12-01", author: "System", description: "Based on AGS Beers Criteria 2023", breaking: false, affectedRules: [] }
        ],
        approvalStatus: "approved"
      },
      citations: [
        {
          id: "ags-beers-2023",
          source: "AGS",
          documentTitle: "American Geriatrics Society 2023 Updated AGS Beers Criteria",
          publicationDate: "2023-05-01",
          effectiveDate: "2023-05-01",
          url: "https://agsjournals.onlinelibrary.wiley.com/doi/10.1111/jgs.18372",
          accessedAt: "2026-01-23"
        }
      ],
      guardrails: [
        {
          id: "polypharmacy-alert",
          name: "Polypharmacy Detection",
          description: "Patient taking 5 or more medications",
          condition: { type: "custom", operator: "greater_than", field: "medicationCount", value: 5 },
          action: "warn",
          message: "Polypharmacy detected: Patient taking multiple medications. Review for potential interactions and deprescribing opportunities.",
          requiresOverride: false,
          overrideRequiresReason: false,
          auditRequired: true
        }
      ],
      eligibilityCriteria: [
        {
          id: "geriatric-age",
          type: "age",
          operator: "greater_than",
          field: "ageYears",
          value: 65,
          required: true,
          description: "Patient is 65 years or older"
        }
      ],
      taskDefinition: {
        title: "Medication Review",
        titleTemplate: "Medicine Check-up Due",
        description: "Schedule a comprehensive medication review to check all your medicines",
        descriptionTemplate: "Time to review all your medications with your doctor or pharmacist",
        category: "medication",
        defaultPriority: "medium",
        estimatedDurationMinutes: 30,
        requiresProvider: true,
        providerTypes: ["pharmacy", "primary_care", "geriatrics"],
        associatedCodes: { cpt: ["99605", "99606", "99607"] }
      },
      cadence: {
        type: "recurring",
        intervalMonths: 12,
        gracePeriodDays: 30,
        overdueThresholdDays: 60
      },
      populationAdaptations: [
        {
          population: "geriatric",
          titleOverride: "Medicine Check",
          descriptionOverride: "Time to review all your medicines with your doctor. Bring all your medicine bottles, including vitamins and supplements.",
          simplifiedView: true,
          largeText: true,
          iconEmphasis: true,
          voiceEnabled: true,
          emphasisFields: ["dueDate", "whatToBring"]
        }
      ],
      metadata: {
        tags: ["geriatric", "medication", "polypharmacy", "beers-criteria"],
        targetPopulations: ["geriatric"],
        riskFlags: ["polypharmacy", "falls-risk", "cognitive-impairment"],
        contraindications: [],
        relatedRules: ["falls-prevention", "cognitive-screening"],
        dependencies: []
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ruleTemplates.set(diabetesA1cRule.id, diabetesA1cRule);
    this.ruleTemplates.set(diabetesEyeExamRule.id, diabetesEyeExamRule);
    this.ruleTemplates.set(fluVaccineRule.id, fluVaccineRule);
    this.ruleTemplates.set(cancerFollowupRule.id, cancerFollowupRule);
    this.ruleTemplates.set(wellChildVisitRule.id, wellChildVisitRule);
    this.ruleTemplates.set(medicationReviewRule.id, medicationReviewRule);

    console.log(`[ClinicalRuleEngine] Initialized ${this.ruleTemplates.size} rule templates`);
  }

  async getRuleTemplates(userId: string, domain?: RuleDomain): Promise<RuleTemplate[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "clinical_rule_templates",
      resourceId: domain || "all",
      details: `domain=${domain || 'all'}, count=${this.ruleTemplates.size}`
    });

    const templates = Array.from(this.ruleTemplates.values());
    const filtered = domain ? templates.filter(t => t.domain === domain) : templates;
    return filtered.filter(t => t.isActive);
  }

  async getRuleTemplate(userId: string, ruleId: string): Promise<RuleTemplate | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "clinical_rule_template",
      resourceId: ruleId
    });

    return this.ruleTemplates.get(ruleId) || null;
  }

  async generateTasksForPatient(
    userId: string,
    patientContext: PatientContext
  ): Promise<TaskGenerationResult> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "patient_tasks",
      resourceId: patientContext.patientId,
      details: `profileId=${patientContext.profileId}, view=${patientContext.populationView}`
    });

    const result: TaskGenerationResult = {
      tasks: [],
      blockedTasks: [],
      warnings: [],
      disclaimer: NO_CDS_DISCLAIMER,
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString()
    };

    const templates = Array.from(this.ruleTemplates.values());
    for (const template of templates) {
      if (!template.isActive) continue;

      const eligibilityResult = this.checkEligibility(patientContext, template);
      if (!eligibilityResult.eligible) continue;

      const guardrailResults = this.evaluateGuardrails(patientContext, template);
      const blockedGuardrail = guardrailResults.find(g => g.triggered && g.action === "block" && !g.overridden);
      
      if (blockedGuardrail) {
        result.blockedTasks.push({
          ruleId: template.id,
          reason: blockedGuardrail.message || "Blocked by guardrail",
          guardrail: blockedGuardrail.guardrailName
        });
        continue;
      }

      const warningGuardrails = guardrailResults.filter(g => g.triggered && g.action === "warn");
      for (const warn of warningGuardrails) {
        result.warnings.push({
          ruleId: template.id,
          message: warn.message || "Warning from guardrail"
        });
      }

      const task = this.createTask(patientContext, template, guardrailResults);
      result.tasks.push(task);
    }

    const key = `${patientContext.patientId}-${patientContext.profileId}`;
    this.generatedTasks.set(key, result.tasks);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "patient_tasks_complete",
      resourceId: patientContext.patientId,
      details: `tasksGenerated=${result.tasks.length}, blocked=${result.blockedTasks.length}, warnings=${result.warnings.length}`
    });

    return result;
  }

  private checkEligibility(context: PatientContext, template: RuleTemplate): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    for (const criterion of template.eligibilityCriteria) {
      const value = this.getContextValue(context, criterion.field);
      const matches = this.evaluateCondition(value, criterion.operator, criterion.value, criterion.secondaryValue);
      
      if (!matches && criterion.required) {
        reasons.push(criterion.description);
        return { eligible: false, reasons };
      }
    }
    
    return { eligible: true, reasons: [] };
  }

  private evaluateGuardrails(context: PatientContext, template: RuleTemplate): GuardrailResult[] {
    return template.guardrails.map(guardrail => {
      const value = this.getContextValue(context, guardrail.condition.field);
      const triggered = this.evaluateCondition(
        value, 
        guardrail.condition.operator, 
        guardrail.condition.value,
        guardrail.condition.secondaryValue
      );

      return {
        guardrailId: guardrail.id,
        guardrailName: guardrail.name,
        action: guardrail.action,
        triggered,
        message: triggered ? guardrail.message : undefined,
        overridden: false
      };
    });
  }

  private getContextValue(context: PatientContext, field: string): any {
    switch (field) {
      case "ageMonths": return context.ageMonths;
      case "ageYears": return context.ageYears;
      case "conditions": return context.conditions;
      case "medications": return context.medications;
      case "allergies": return context.allergies;
      case "riskFlags": return context.riskFlags;
      case "isPregnant": return context.isPregnant;
      case "medicationCount": return context.medications.length;
      default: return undefined;
    }
  }

  private evaluateCondition(
    value: any, 
    operator: string, 
    targetValue: string | number | boolean | string[],
    secondaryValue?: string | number
  ): boolean {
    switch (operator) {
      case "equals":
        return value === targetValue;
      case "not_equals":
        return value !== targetValue;
      case "greater_than":
        return typeof value === "number" && value > (targetValue as number);
      case "less_than":
        return typeof value === "number" && value < (targetValue as number);
      case "between":
        return typeof value === "number" && value >= (targetValue as number) && value <= (secondaryValue as number);
      case "in":
        if (Array.isArray(value) && Array.isArray(targetValue)) {
          return value.some(v => targetValue.includes(v.toLowerCase()));
        }
        return Array.isArray(targetValue) && targetValue.includes(value);
      case "not_in":
        if (Array.isArray(value) && Array.isArray(targetValue)) {
          return !value.some(v => targetValue.includes(v.toLowerCase()));
        }
        return Array.isArray(targetValue) && !targetValue.includes(value);
      case "exists":
        return value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : true);
      case "not_exists":
        return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
      default:
        return false;
    }
  }

  private createTask(
    context: PatientContext, 
    template: RuleTemplate, 
    guardrailResults: GuardrailResult[]
  ): GeneratedTask {
    const now = new Date();
    const dueDate = this.calculateDueDate(template.cadence);
    const overdueDate = new Date(dueDate);
    overdueDate.setDate(overdueDate.getDate() + template.cadence.overdueThresholdDays);

    const adaptation = template.populationAdaptations.find(a => a.population === context.populationView);
    const requiresReview = guardrailResults.some(g => g.triggered && g.action === "require_review" && !g.overridden);

    return {
      id: `task-${template.id}-${context.profileId}-${Date.now()}`,
      ruleTemplateId: template.id,
      ruleVersion: template.version.version,
      patientId: context.patientId,
      profileId: context.profileId,
      domain: template.domain,
      title: template.taskDefinition.title,
      description: template.taskDefinition.description,
      category: template.taskDefinition.category,
      priority: adaptation?.priorityOverride || template.taskDefinition.defaultPriority,
      status: this.calculateStatus(dueDate, overdueDate),
      dueDate: dueDate.toISOString(),
      overdueDate: overdueDate.toISOString(),
      citations: template.citations,
      populationView: context.populationView,
      adaptedTitle: adaptation?.titleOverride,
      adaptedDescription: adaptation?.descriptionOverride,
      guardrailResults,
      requiresReview,
      reviewReason: requiresReview ? "Guardrail requires clinician review" : undefined,
      disclaimer: NO_CDS_DISCLAIMER,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  private calculateDueDate(cadence: TaskCadence): Date {
    const now = new Date();
    if (cadence.type === "one_time") {
      return now;
    }
    if (cadence.intervalMonths) {
      const due = new Date(now);
      due.setMonth(due.getMonth() + cadence.intervalMonths);
      return due;
    }
    if (cadence.intervalDays) {
      const due = new Date(now);
      due.setDate(due.getDate() + cadence.intervalDays);
      return due;
    }
    return now;
  }

  private calculateStatus(dueDate: Date, overdueDate: Date): TaskStatus {
    const now = new Date();
    const dueSoonDate = new Date(dueDate);
    dueSoonDate.setDate(dueSoonDate.getDate() - 14);

    if (now > overdueDate) return "overdue";
    if (now > dueDate) return "overdue";
    if (now > dueSoonDate) return "due_soon";
    return "pending";
  }

  async getGeneratedTasks(userId: string, patientId: string, profileId: string): Promise<GeneratedTask[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "generated_tasks",
      resourceId: patientId,
      details: `profileId=${profileId}`
    });

    const key = `${patientId}-${profileId}`;
    return this.generatedTasks.get(key) || [];
  }

  async createRuleTemplate(userId: string, template: Omit<RuleTemplate, "id" | "createdAt" | "updatedAt">): Promise<RuleTemplate> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "clinical_rule_template",
      resourceId: "new",
      details: `domain=${template.domain}, name=${template.name}`
    });

    const newTemplate: RuleTemplate = {
      ...template,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ruleTemplates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateRuleTemplate(userId: string, ruleId: string, updates: Partial<RuleTemplate>): Promise<RuleTemplate | null> {
    const existing = this.ruleTemplates.get(ruleId);
    if (!existing) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "clinical_rule_template",
      resourceId: ruleId
    });

    const updated: RuleTemplate = {
      ...existing,
      ...updates,
      id: ruleId,
      updatedAt: new Date().toISOString()
    };

    this.ruleTemplates.set(ruleId, updated);
    return updated;
  }

  async getCitations(userId: string, ruleId?: string): Promise<RuleCitation[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "rule_citations",
      resourceId: ruleId || "all"
    });

    if (ruleId) {
      const template = this.ruleTemplates.get(ruleId);
      return template?.citations || [];
    }

    const allCitations: RuleCitation[] = [];
    const seen = new Set<string>();
    const templates = Array.from(this.ruleTemplates.values());
    
    for (const template of templates) {
      for (const citation of template.citations) {
        if (!seen.has(citation.id)) {
          seen.add(citation.id);
          allCitations.push(citation);
        }
      }
    }
    
    return allCitations;
  }

  async getEngineMetadata(): Promise<{
    version: string;
    effectiveDate: string;
    domainsSupported: RuleDomain[];
    populationsSupported: PopulationView[];
    totalRules: number;
    activeRules: number;
    disclaimer: string;
  }> {
    const templates = Array.from(this.ruleTemplates.values());
    const domainSet = new Set(templates.map(t => t.domain));
    const populationSet = new Set(templates.flatMap(t => t.populationAdaptations.map(a => a.population)));
    const domains = Array.from(domainSet) as RuleDomain[];
    const populations = Array.from(populationSet) as PopulationView[];

    return {
      version: ENGINE_VERSION,
      effectiveDate: ENGINE_EFFECTIVE_DATE,
      domainsSupported: domains,
      populationsSupported: populations,
      totalRules: templates.length,
      activeRules: templates.filter(t => t.isActive).length,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const clinicalRuleTemplateEngine = new ClinicalRuleTemplateEngine();
