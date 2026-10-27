import { governedAICall } from "./third-party-data-governance";

interface AutomationTrigger {
  id: string;
  type: "diagnosis_added" | "diagnosis_updated" | "status_changed" | "lab_result_added" | "medication_changed" | "vitals_recorded" | "visit_completed";
  patientId: string;
  recordId: string;
  data: Record<string, any>;
  timestamp: Date;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: AutomationTrigger["type"];
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

interface RuleCondition {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "in" | "exists" | "changed_to";
  value: string | string[];
}

interface RuleAction {
  type: "suggest_document" | "prefill_document" | "prompt_user" | "create_task";
  documentType?: string;
  prefillFields?: Record<string, string>;
  message?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

interface AutomationSuggestion {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerType: AutomationTrigger["type"];
  triggerDescription: string;
  suggestedAction: string;
  documentType: string | null;
  prefillData: Record<string, any>;
  priority: "low" | "medium" | "high" | "urgent";
  patientId: string;
  recordId: string;
  status: "pending" | "accepted" | "dismissed" | "expired";
  createdAt: Date;
  expiresAt: Date;
  scenarioType?: string;
  autoCreateDraft?: boolean;
}

interface PrefillResult {
  documentType: string;
  documentName: string;
  fields: PrefillField[];
  additionalContext: string;
  confidence: number;
  sourceRecords: string[];
  scenarioType?: string;
  draftReady?: boolean;
}

interface PrefillField {
  key: string;
  label: string;
  value: string;
  source: string;
  confidence: number;
  editable: boolean;
}

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: AutomationTrigger["type"];
  documentType: string;
  icon: string;
  color: string;
  fieldTemplates: ScenarioFieldTemplate[];
}

interface ScenarioFieldTemplate {
  key: string;
  label: string;
  sourceType: "trigger" | "patient_conditions" | "patient_medications" | "patient_allergies" | "patient_vitals" | "patient_labs" | "computed" | "ai_generated";
  sourceField?: string;
  defaultValue?: string;
  required: boolean;
}

const CLINICAL_SCENARIOS: ScenarioTemplate[] = [
  {
    id: "scenario_diagnosis_referral",
    name: "Diagnosis Referral Letter",
    description: "When a diagnosis is entered, auto-generate a referral letter with specialty mapping and patient history",
    triggerType: "diagnosis_added",
    documentType: "referral_letter",
    icon: "send",
    color: "#3182CE",
    fieldTemplates: [
      { key: "referralDiagnosis", label: "Primary Diagnosis", sourceType: "trigger", sourceField: "title", required: true },
      { key: "toSpecialty", label: "Referred Specialty", sourceType: "computed", required: true },
      { key: "referralReason", label: "Reason for Referral", sourceType: "ai_generated", required: true },
      { key: "urgency", label: "Urgency", sourceType: "computed", required: true },
      { key: "relevantHistory", label: "Relevant Medical History", sourceType: "patient_conditions", required: true },
      { key: "currentMedications", label: "Current Medications", sourceType: "patient_medications", required: true },
      { key: "allergies", label: "Known Allergies", sourceType: "patient_allergies", required: true },
      { key: "recentLabs", label: "Recent Lab Results", sourceType: "patient_labs", required: false },
      { key: "recentVitals", label: "Recent Vital Signs", sourceType: "patient_vitals", required: false },
      { key: "additionalNotes", label: "Additional Clinical Notes", sourceType: "ai_generated", required: false },
    ],
  },
  {
    id: "scenario_diagnosis_consultation",
    name: "Specialist Consultation Note",
    description: "When a complex diagnosis is entered, auto-generate a consultation note with clinical context",
    triggerType: "diagnosis_added",
    documentType: "consultation",
    icon: "users",
    color: "#805AD5",
    fieldTemplates: [
      { key: "consultationDiagnosis", label: "Consultation Diagnosis", sourceType: "trigger", sourceField: "title", required: true },
      { key: "consultingSpecialty", label: "Consulting Specialty", sourceType: "computed", required: true },
      { key: "reasonForConsultation", label: "Reason for Consultation", sourceType: "ai_generated", required: true },
      { key: "clinicalHistory", label: "Pertinent Clinical History", sourceType: "ai_generated", required: true },
      { key: "currentMedications", label: "Current Medications", sourceType: "patient_medications", required: true },
      { key: "allergies", label: "Allergies", sourceType: "patient_allergies", required: true },
      { key: "physicalExamFindings", label: "Physical Exam Findings", sourceType: "patient_vitals", required: false },
      { key: "diagnosticResults", label: "Diagnostic Test Results", sourceType: "patient_labs", required: false },
      { key: "preliminaryAssessment", label: "Preliminary Assessment", sourceType: "ai_generated", required: false },
      { key: "recommendedWorkup", label: "Recommended Workup", sourceType: "ai_generated", required: false },
    ],
  },
  {
    id: "scenario_discharge_summary",
    name: "Discharge Summary",
    description: "When patient status changes to discharged, auto-generate a discharge summary with all relevant data",
    triggerType: "status_changed",
    documentType: "discharge_summary",
    icon: "log-out",
    color: "#DD6B20",
    fieldTemplates: [
      { key: "dischargeDate", label: "Discharge Date", sourceType: "computed", required: true },
      { key: "admissionDiagnosis", label: "Admission Diagnosis", sourceType: "patient_conditions", required: true },
      { key: "dischargeDiagnosis", label: "Discharge Diagnosis", sourceType: "patient_conditions", required: true },
      { key: "hospitalCourse", label: "Hospital Course Summary", sourceType: "ai_generated", required: true },
      { key: "dischargeMedications", label: "Discharge Medications", sourceType: "patient_medications", required: true },
      { key: "medicationChanges", label: "Medication Changes", sourceType: "ai_generated", required: false },
      { key: "allergies", label: "Allergies", sourceType: "patient_allergies", required: true },
      { key: "dischargeVitals", label: "Discharge Vital Signs", sourceType: "patient_vitals", required: true },
      { key: "pendingLabResults", label: "Pending Lab Results", sourceType: "patient_labs", required: false },
      { key: "followUpInstructions", label: "Follow-Up Instructions", sourceType: "ai_generated", required: true },
      { key: "followUpAppointments", label: "Scheduled Follow-Up Appointments", sourceType: "ai_generated", required: false },
      { key: "dietaryRestrictions", label: "Dietary Restrictions", sourceType: "ai_generated", required: false },
      { key: "activityRestrictions", label: "Activity Restrictions", sourceType: "ai_generated", required: false },
      { key: "warningSignsToWatch", label: "Warning Signs to Watch For", sourceType: "ai_generated", required: true },
      { key: "emergencyContact", label: "Emergency Contact Instructions", sourceType: "computed", defaultValue: "If you experience severe symptoms, call 911 or visit the nearest emergency room.", required: true },
    ],
  },
  {
    id: "scenario_diagnosis_updated_progress",
    name: "Progress Note (Diagnosis Update)",
    description: "When a diagnosis is updated, generate a progress note documenting the change",
    triggerType: "diagnosis_updated",
    documentType: "progress_note",
    icon: "edit-3",
    color: "#38A169",
    fieldTemplates: [
      { key: "updatedDiagnosis", label: "Updated Diagnosis", sourceType: "trigger", sourceField: "title", required: true },
      { key: "previousDiagnosis", label: "Previous Diagnosis", sourceType: "trigger", sourceField: "previousTitle", required: false },
      { key: "changeReason", label: "Reason for Change", sourceType: "ai_generated", required: true },
      { key: "currentStatus", label: "Current Patient Status", sourceType: "ai_generated", required: true },
      { key: "currentMedications", label: "Current Medications", sourceType: "patient_medications", required: true },
      { key: "recentLabs", label: "Recent Lab Results", sourceType: "patient_labs", required: false },
      { key: "recentVitals", label: "Recent Vital Signs", sourceType: "patient_vitals", required: false },
      { key: "treatmentPlanAdjustments", label: "Treatment Plan Adjustments", sourceType: "ai_generated", required: true },
    ],
  },
  {
    id: "scenario_status_transferred",
    name: "Transfer Summary Letter",
    description: "When patient is transferred, auto-generate transfer documentation",
    triggerType: "status_changed",
    documentType: "referral_letter",
    icon: "arrow-right-circle",
    color: "#E53E3E",
    fieldTemplates: [
      { key: "transferReason", label: "Reason for Transfer", sourceType: "ai_generated", required: true },
      { key: "currentDiagnoses", label: "Current Diagnoses", sourceType: "patient_conditions", required: true },
      { key: "activeMedications", label: "Active Medications", sourceType: "patient_medications", required: true },
      { key: "allergies", label: "Allergies", sourceType: "patient_allergies", required: true },
      { key: "recentVitals", label: "Recent Vital Signs", sourceType: "patient_vitals", required: true },
      { key: "pendingResults", label: "Pending Results", sourceType: "patient_labs", required: false },
      { key: "clinicalSummary", label: "Clinical Summary", sourceType: "ai_generated", required: true },
      { key: "urgentConcerns", label: "Urgent Concerns", sourceType: "ai_generated", required: false },
    ],
  },
];

const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule_diagnosis_referral",
    name: "New Diagnosis - Referral Letter",
    description: "When a new diagnosis is added, suggest creating a referral letter for specialist consultation",
    triggerType: "diagnosis_added",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "referral_letter",
        message: "New diagnosis detected. Would you like to create a referral letter for specialist consultation?",
        priority: "medium",
      },
    ],
    priority: 10,
    enabled: true,
  },
  {
    id: "rule_diagnosis_consultation",
    name: "New Diagnosis - Consultation Note",
    description: "When a complex diagnosis is entered, suggest a consultation note template",
    triggerType: "diagnosis_added",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "consultation",
        message: "Consider documenting a consultation note with assessment and recommendations for this diagnosis.",
        priority: "medium",
      },
    ],
    priority: 9,
    enabled: true,
  },
  {
    id: "rule_status_discharged",
    name: "Patient Discharged - Discharge Summary",
    description: "When patient status changes to discharged, prompt discharge summary creation",
    triggerType: "status_changed",
    conditions: [
      { field: "newStatus", operator: "equals", value: "discharged" },
    ],
    actions: [
      {
        type: "suggest_document",
        documentType: "discharge_summary",
        message: "Patient has been discharged. A discharge summary should be created with medications, follow-up instructions, and care plan.",
        priority: "urgent",
      },
    ],
    priority: 20,
    enabled: true,
  },
  {
    id: "rule_status_transferred",
    name: "Patient Transferred - Referral Letter",
    description: "When patient is transferred, suggest creating a referral/transfer letter",
    triggerType: "status_changed",
    conditions: [
      { field: "newStatus", operator: "in", value: ["transferred", "referred"] },
    ],
    actions: [
      {
        type: "suggest_document",
        documentType: "referral_letter",
        message: "Patient is being transferred. Create a referral letter with relevant clinical history for the receiving provider.",
        priority: "high",
      },
    ],
    priority: 18,
    enabled: true,
  },
  {
    id: "rule_lab_abnormal_progress",
    name: "Abnormal Lab Result - Progress Note",
    description: "When an abnormal lab result is recorded, suggest a progress note documenting the finding",
    triggerType: "lab_result_added",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "progress_note",
        message: "New lab result recorded. Consider creating a progress note to document findings and any treatment adjustments.",
        priority: "medium",
      },
    ],
    priority: 8,
    enabled: true,
  },
  {
    id: "rule_medication_change_summary",
    name: "Medication Change - Medication Summary",
    description: "When medications are changed, suggest updating the medication summary",
    triggerType: "medication_changed",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "medication_summary",
        message: "Medication changes detected. Update the medication summary to reflect current prescriptions.",
        priority: "medium",
      },
    ],
    priority: 7,
    enabled: true,
  },
  {
    id: "rule_visit_completed_soap",
    name: "Visit Completed - SOAP Note",
    description: "When a visit is completed, suggest creating a SOAP note",
    triggerType: "visit_completed",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "soap",
        message: "Visit completed. Create a SOAP note to document this encounter.",
        priority: "high",
      },
    ],
    priority: 15,
    enabled: true,
  },
  {
    id: "rule_vitals_abnormal",
    name: "Abnormal Vitals - Progress Note",
    description: "When vitals are outside normal range, suggest documenting with a progress note",
    triggerType: "vitals_recorded",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "progress_note",
        message: "New vitals recorded. Consider documenting current status and any interventions needed.",
        priority: "low",
      },
    ],
    priority: 5,
    enabled: true,
  },
  {
    id: "rule_specialist_diagnosis_referral",
    name: "Specialist Diagnosis - Auto Referral Letter",
    description: "When a diagnosis is added that maps to a specialty, automatically suggest a referral letter for specialist consultation",
    triggerType: "diagnosis_added",
    conditions: [
      { field: "diagnosis", operator: "exists", value: "" },
    ],
    actions: [
      {
        type: "suggest_document",
        documentType: "referral_letter",
        message: "A specialty-related diagnosis has been detected. Suggest creating a referral letter to the appropriate specialist.",
        priority: "high",
      },
    ],
    priority: 16,
    enabled: true,
  },
  {
    id: "rule_visit_completed_discharge",
    name: "Visit Completed - Auto Discharge Summary",
    description: "When a visit is completed, automatically suggest creating a discharge summary",
    triggerType: "visit_completed",
    conditions: [],
    actions: [
      {
        type: "suggest_document",
        documentType: "discharge_summary",
        message: "Visit has been completed. Automatically suggest creating a discharge summary with follow-up instructions and care plan.",
        priority: "medium",
      },
    ],
    priority: 14,
    enabled: true,
  },
  {
    id: "rule_high_cost_medication_prior_auth",
    name: "High-Cost Medication - Auto Prior Authorization",
    description: "When a high-cost or prior-auth-required medication is added or changed, automatically suggest prior authorization document",
    triggerType: "medication_changed",
    conditions: [
      {
        field: "requiresPriorAuth",
        operator: "exists",
        value: "",
      },
    ],
    actions: [
      {
        type: "suggest_document",
        documentType: "prior_authorization",
        message: "This medication requires prior authorization. Automatically suggest generating and submitting a prior authorization request.",
        priority: "urgent",
      },
    ],
    priority: 19,
    enabled: true,
  },
];

const DIAGNOSIS_SPECIALTY_MAP: Record<string, string> = {
  "diabetes": "Endocrinology",
  "type 2 diabetes": "Endocrinology",
  "type 1 diabetes": "Endocrinology",
  "hypertension": "Cardiology",
  "heart failure": "Cardiology",
  "atrial fibrillation": "Cardiology",
  "coronary artery disease": "Cardiology",
  "asthma": "Pulmonology",
  "copd": "Pulmonology",
  "chronic obstructive pulmonary disease": "Pulmonology",
  "rheumatoid arthritis": "Rheumatology",
  "lupus": "Rheumatology",
  "hypothyroidism": "Endocrinology",
  "hyperthyroidism": "Endocrinology",
  "chronic kidney disease": "Nephrology",
  "depression": "Psychiatry",
  "anxiety": "Psychiatry",
  "epilepsy": "Neurology",
  "multiple sclerosis": "Neurology",
  "parkinson's disease": "Neurology",
  "cancer": "Oncology",
  "breast cancer": "Oncology",
  "lung cancer": "Oncology",
  "colorectal cancer": "Oncology",
  "osteoporosis": "Endocrinology",
  "crohn's disease": "Gastroenterology",
  "ulcerative colitis": "Gastroenterology",
  "ibs": "Gastroenterology",
  "gerd": "Gastroenterology",
  "psoriasis": "Dermatology",
  "eczema": "Dermatology",
  "glaucoma": "Ophthalmology",
  "cataracts": "Ophthalmology",
  "hearing loss": "Otolaryngology",
  "sleep apnea": "Sleep Medicine",
  "back pain": "Orthopedics",
  "knee replacement": "Orthopedics",
  "hip replacement": "Orthopedics",
};

class ClinicalAutomationEngine {
  private suggestions: Map<string, AutomationSuggestion> = new Map();
  private userSettings: Map<string, { enabled: boolean; mutedRules: string[] }> = new Map();
  private stats = {
    triggersProcessed: 0,
    suggestionsGenerated: 0,
    suggestionsAccepted: 0,
    suggestionsDismissed: 0,
    documentsPrefilled: 0,
  };

  constructor() {
    console.log("[AutomationEngine] Clinical automation engine initialized");
    console.log(`[AutomationEngine] ${AUTOMATION_RULES.length} automation rules loaded`);
  }

  async processTrigger(trigger: AutomationTrigger, patientRecords: any[]): Promise<AutomationSuggestion[]> {
    this.stats.triggersProcessed++;
    console.log(`[AutomationEngine] Processing trigger: ${trigger.type} for patient ${trigger.patientId}`);

    const userSettings = this.userSettings.get(trigger.patientId);
    if (userSettings && !userSettings.enabled) {
      console.log(`[AutomationEngine] Automation disabled for user ${trigger.patientId}`);
      return [];
    }

    const matchingRules = AUTOMATION_RULES
      .filter(rule => rule.enabled && rule.triggerType === trigger.type)
      .filter(rule => {
        if (userSettings?.mutedRules.includes(rule.id)) return false;
        return this.evaluateConditions(rule.conditions, trigger.data);
      })
      .sort((a, b) => b.priority - a.priority);

    const newSuggestions: AutomationSuggestion[] = [];

    for (const rule of matchingRules) {
      for (const action of rule.actions) {
        const suggestion: AutomationSuggestion = {
          id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: trigger.type,
          triggerDescription: this.describeTrigger(trigger),
          suggestedAction: action.message || "Action suggested based on clinical data change.",
          documentType: action.documentType || null,
          prefillData: {},
          priority: action.priority || "medium",
          patientId: trigger.patientId,
          recordId: trigger.recordId,
          status: "pending",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        if (action.documentType) {
          suggestion.prefillData = await this.generatePrefillData(
            action.documentType,
            trigger,
            patientRecords
          );
        }

        this.suggestions.set(suggestion.id, suggestion);
        newSuggestions.push(suggestion);
        this.stats.suggestionsGenerated++;
      }
    }

    console.log(`[AutomationEngine] Generated ${newSuggestions.length} suggestions from ${matchingRules.length} matching rules`);
    return newSuggestions;
  }

  private evaluateConditions(conditions: RuleCondition[], data: Record<string, any>): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = data[condition.field];
      if (fieldValue === undefined && condition.operator !== "exists") return false;

      switch (condition.operator) {
        case "equals":
          return String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
        case "contains":
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        case "startsWith":
          return String(fieldValue).toLowerCase().startsWith(String(condition.value).toLowerCase());
        case "in":
          return Array.isArray(condition.value) && condition.value.map(v => v.toLowerCase()).includes(String(fieldValue).toLowerCase());
        case "exists":
          return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
        case "changed_to":
          return String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
        default:
          return false;
      }
    });
  }

  private describeTrigger(trigger: AutomationTrigger): string {
    switch (trigger.type) {
      case "diagnosis_added":
        return `New diagnosis added: ${trigger.data.title || trigger.data.name || "Unknown"}`;
      case "diagnosis_updated":
        return `Diagnosis updated: ${trigger.data.title || trigger.data.name || "Unknown"}`;
      case "status_changed":
        return `Patient status changed to: ${trigger.data.newStatus || "Unknown"}`;
      case "lab_result_added":
        return `New lab result: ${trigger.data.title || trigger.data.name || "Unknown"}`;
      case "medication_changed":
        return `Medication change: ${trigger.data.title || trigger.data.name || "Unknown"}`;
      case "vitals_recorded":
        return `Vitals recorded: ${trigger.data.title || "Vital signs"}`;
      case "visit_completed":
        return `Visit completed: ${trigger.data.title || trigger.data.type || "Clinical visit"}`;
      default:
        return "Clinical data updated";
    }
  }

  private async generatePrefillData(
    documentType: string,
    trigger: AutomationTrigger,
    patientRecords: any[]
  ): Promise<Record<string, any>> {
    const prefill: Record<string, any> = {};

    const conditions = patientRecords.filter(r => r.type === "condition");
    const medications = patientRecords.filter(r => r.type === "medication");
    const vitals = patientRecords.filter(r => r.type === "vital").slice(0, 5);
    const labs = patientRecords.filter(r => r.type === "lab" || r.type === "labs").slice(0, 5);
    const allergies = patientRecords.filter(r => r.type === "allergy");
    const visits = patientRecords.filter(r => r.type === "visit").slice(0, 3);

    switch (documentType) {
      case "referral_letter": {
        const diagnosisTitle = (trigger.data.title || trigger.data.name || "").toLowerCase();
        const specialty = this.findSpecialty(diagnosisTitle);
        prefill.toSpecialty = specialty;
        prefill.reason = `Referral for evaluation and management of ${trigger.data.title || trigger.data.name || "recently diagnosed condition"}`;
        prefill.urgency = trigger.data.severity === "critical" ? "Urgent" : "Routine";
        prefill.diagnosis = trigger.data.title || trigger.data.name || "";
        prefill.currentMedications = medications.map(m => m.title).join(", ");
        prefill.allergies = allergies.map(a => a.title).join(", ");
        prefill.relevantHistory = conditions.map(c => c.title).join(", ");
        prefill.recentLabs = labs.map(l => `${l.title}: ${l.summary || ""}`).join("; ");
        break;
      }
      case "discharge_summary": {
        prefill.admissionDiagnosis = trigger.data.admissionDiagnosis || conditions.map(c => c.title).join(", ");
        prefill.dischargeDiagnosis = trigger.data.dischargeDiagnosis || conditions.map(c => c.title).join(", ");
        prefill.dischargeMedications = medications.map(m => `${m.title} - ${m.summary || "as directed"}`).join("\n");
        prefill.allergies = allergies.map(a => a.title).join(", ");
        prefill.recentVitals = vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ");
        prefill.recentLabs = labs.map(l => `${l.title}: ${l.summary || ""}`).join("; ");
        prefill.dischargeDate = new Date().toISOString().split("T")[0];
        break;
      }
      case "consultation": {
        prefill.reasonForConsultation = `Consultation requested for ${trigger.data.title || trigger.data.name || "clinical evaluation"}`;
        prefill.relevantHistory = conditions.map(c => c.title).join(", ");
        prefill.currentMedications = medications.map(m => m.title).join(", ");
        prefill.allergies = allergies.map(a => a.title).join(", ");
        prefill.recentVitals = vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ");
        break;
      }
      case "progress_note": {
        prefill.currentConditions = conditions.map(c => c.title).join(", ");
        prefill.currentMedications = medications.map(m => m.title).join(", ");
        prefill.triggerEvent = this.describeTrigger(trigger);
        prefill.recentVitals = vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ");
        if (trigger.type === "lab_result_added") {
          prefill.labFindings = `${trigger.data.title}: ${trigger.data.summary || trigger.data.value || ""}`;
        }
        break;
      }
      case "soap": {
        prefill.chiefComplaint = trigger.data.title || trigger.data.name || "";
        prefill.currentConditions = conditions.map(c => c.title).join(", ");
        prefill.medications = medications.map(m => m.title).join(", ");
        prefill.allergies = allergies.map(a => a.title).join(", ");
        prefill.vitals = vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ");
        break;
      }
      case "medication_summary": {
        prefill.medications = medications.map(m => ({
          name: m.title,
          dosage: m.summary || "",
          startDate: m.date ? new Date(m.date).toISOString().split("T")[0] : "Unknown",
        }));
        prefill.allergies = allergies.map(a => a.title).join(", ");
        prefill.triggerMedication = trigger.data.title || trigger.data.name || "";
        break;
      }
    }

    return prefill;
  }

  private findSpecialty(diagnosisText: string): string {
    const lower = diagnosisText.toLowerCase().trim();

    for (const [key, specialty] of Object.entries(DIAGNOSIS_SPECIALTY_MAP)) {
      if (lower.includes(key)) return specialty;
    }

    return "";
  }

  async generateAIPrefill(
    documentType: string,
    triggerData: Record<string, any>,
    patientRecords: any[],
    patientName: string
  ): Promise<PrefillResult> {
    this.stats.documentsPrefilled++;

    const conditions = patientRecords.filter(r => r.type === "condition");
    const medications = patientRecords.filter(r => r.type === "medication");
    const vitals = patientRecords.filter(r => r.type === "vital").slice(0, 5);
    const labs = patientRecords.filter(r => r.type === "lab" || r.type === "labs").slice(0, 5);
    const allergies = patientRecords.filter(r => r.type === "allergy");

    const patientContext = [
      `Patient: ${patientName}`,
      `Conditions: ${conditions.map(c => c.title).join(", ") || "None documented"}`,
      `Medications: ${medications.map(m => `${m.title} (${m.summary || ""})`).join(", ") || "None documented"}`,
      `Allergies: ${allergies.map(a => a.title).join(", ") || "None documented"}`,
      `Recent Vitals: ${vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ") || "None documented"}`,
      `Recent Labs: ${labs.map(l => `${l.title}: ${l.summary || ""}`).join("; ") || "None documented"}`,
    ].join("\n");

    const triggerContext = Object.entries(triggerData)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("\n");

    try {
      const govResponse = await governedAICall({
        callerService: "clinical-automation-engine",
        callerMethod: "generateAIPrefill",
        purpose: "documentation",
        model: "gpt-5.2",
        systemPrompt: `You are a clinical documentation automation assistant. Given a clinical trigger event and patient data, generate pre-filled field values for a ${documentType.replace(/_/g, " ")} document template.

Return JSON with this structure:
{
  "fields": [
    {
      "key": "field_key",
      "label": "Field Label",
      "value": "pre-filled value based on patient data",
      "source": "where this data came from (e.g., 'patient conditions', 'recent labs')",
      "confidence": 0.0 to 1.0,
      "editable": true
    }
  ],
  "additionalContext": "A brief clinical context summary to include with the document generation",
  "confidence": 0.0 to 1.0 overall confidence,
  "sourceRecords": ["list of record types used"]
}

Include all relevant fields for the document type. Pre-fill with actual patient data where available. Mark fields as lower confidence when inferred rather than directly from records.`,
        userPrompt: `Generate pre-fill data for a "${documentType.replace(/_/g, " ")}" document.

TRIGGER EVENT:
${triggerContext}

PATIENT DATA:
${patientContext}

Pre-fill all relevant fields with actual patient data. Be specific and clinical.`,
        dataCategories: ["demographics", "conditions", "medications", "vitals", "allergies"],
        maxTokens: 4096,
        responseFormat: { type: "json_object" },
      });

      const parsed = JSON.parse(govResponse.content);

      const docNames: Record<string, string> = {
        referral_letter: "Referral Letter",
        discharge_summary: "Discharge Summary",
        consultation: "Consultation Note",
        progress_note: "Progress Note",
        soap: "SOAP Note",
        medication_summary: "Medication Summary",
        patient_summary: "Patient Summary",
        h_and_p: "History and Physical",
        procedure_note: "Procedure Note",
      };

      return {
        documentType,
        documentName: docNames[documentType] || documentType.replace(/_/g, " "),
        fields: (parsed.fields || []).map((f: any) => ({
          key: f.key || "",
          label: f.label || "",
          value: f.value || "",
          source: f.source || "AI inference",
          confidence: typeof f.confidence === "number" ? f.confidence : 0.7,
          editable: f.editable !== false,
        })),
        additionalContext: parsed.additionalContext || "",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
        sourceRecords: parsed.sourceRecords || [],
      };
    } catch (error) {
      console.error("[AutomationEngine] AI prefill error:", error);
      const basePrefill = await this.generatePrefillData(
        documentType,
        {
          id: "manual",
          type: triggerData.triggerType || "diagnosis_added",
          patientId: "",
          recordId: "",
          data: triggerData,
          timestamp: new Date(),
        },
        patientRecords
      );

      return {
        documentType,
        documentName: documentType.replace(/_/g, " "),
        fields: Object.entries(basePrefill).map(([key, value]) => ({
          key,
          label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
          value: typeof value === "string" ? value : JSON.stringify(value),
          source: "Patient records",
          confidence: 0.6,
          editable: true,
        })),
        additionalContext: `Document generated based on: ${triggerData.title || triggerData.name || "clinical data change"}`,
        confidence: 0.6,
        sourceRecords: ["conditions", "medications", "allergies"],
      };
    }
  }

  async processScenarioTrigger(
    trigger: AutomationTrigger,
    patientRecords: any[],
    patientName: string
  ): Promise<{ suggestions: AutomationSuggestion[]; prefillResults: PrefillResult[] }> {
    const matchingScenarios = CLINICAL_SCENARIOS.filter(s => {
      if (s.triggerType !== trigger.type) return false;
      if (trigger.type === "status_changed" && s.documentType === "discharge_summary") {
        return trigger.data.newStatus === "discharged";
      }
      if (trigger.type === "status_changed" && s.id === "scenario_status_transferred") {
        return ["transferred", "referred"].includes(trigger.data.newStatus);
      }
      return true;
    });

    const suggestions: AutomationSuggestion[] = [];
    const prefillResults: PrefillResult[] = [];

    for (const scenario of matchingScenarios) {
      const prefillResult = await this.generateScenarioPrefill(scenario, trigger, patientRecords, patientName);
      prefillResults.push(prefillResult);

      const suggestion: AutomationSuggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: scenario.id,
        ruleName: scenario.name,
        triggerType: trigger.type,
        triggerDescription: this.describeTrigger(trigger),
        suggestedAction: scenario.description,
        documentType: scenario.documentType,
        prefillData: Object.fromEntries(prefillResult.fields.map(f => [f.key, f.value])),
        priority: this.computeScenarioPriority(scenario, trigger),
        patientId: trigger.patientId,
        recordId: trigger.recordId,
        status: "pending",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scenarioType: scenario.id,
        autoCreateDraft: true,
      };

      this.suggestions.set(suggestion.id, suggestion);
      suggestions.push(suggestion);
      this.stats.suggestionsGenerated++;
    }

    console.log(`[AutomationEngine] Scenario processing: ${matchingScenarios.length} scenarios matched for ${trigger.type}`);
    return { suggestions, prefillResults };
  }

  private computeScenarioPriority(
    scenario: ScenarioTemplate,
    trigger: AutomationTrigger
  ): "low" | "medium" | "high" | "urgent" {
    if (trigger.type === "status_changed" && trigger.data.newStatus === "discharged") return "urgent";
    if (trigger.type === "status_changed" && ["transferred", "referred"].includes(trigger.data.newStatus)) return "high";
    if (trigger.type === "diagnosis_added") {
      const diagnosis = (trigger.data.title || "").toLowerCase();
      const urgentDiagnoses = ["cancer", "stroke", "heart attack", "myocardial infarction", "pulmonary embolism", "sepsis"];
      if (urgentDiagnoses.some(d => diagnosis.includes(d))) return "urgent";
      if (this.findSpecialty(diagnosis)) return "high";
      return "medium";
    }
    if (trigger.type === "diagnosis_updated") return "medium";
    return "medium";
  }

  private async generateScenarioPrefill(
    scenario: ScenarioTemplate,
    trigger: AutomationTrigger,
    patientRecords: any[],
    patientName: string
  ): Promise<PrefillResult> {
    const conditions = patientRecords.filter(r => r.type === "condition");
    const medications = patientRecords.filter(r => r.type === "medication");
    const vitals = patientRecords.filter(r => r.type === "vital").slice(0, 5);
    const labs = patientRecords.filter(r => r.type === "lab" || r.type === "labs").slice(0, 5);
    const allergies = patientRecords.filter(r => r.type === "allergy");

    const fields: PrefillField[] = [];
    const aiFieldKeys: string[] = [];

    for (const template of scenario.fieldTemplates) {
      let value = "";
      let source = "";
      let confidence = 0.9;

      switch (template.sourceType) {
        case "trigger":
          value = trigger.data[template.sourceField || "title"] || template.defaultValue || "";
          source = "Clinical trigger event";
          confidence = value ? 0.95 : 0.3;
          break;
        case "patient_conditions":
          value = conditions.map(c => c.title).join(", ") || "None documented";
          source = "Patient medical history";
          confidence = conditions.length > 0 ? 0.9 : 0.4;
          break;
        case "patient_medications":
          value = medications.map(m => `${m.title}${m.summary ? ` (${m.summary})` : ""}`).join(", ") || "None documented";
          source = "Active medication list";
          confidence = medications.length > 0 ? 0.9 : 0.4;
          break;
        case "patient_allergies":
          value = allergies.map(a => a.title).join(", ") || "No known allergies";
          source = "Allergy records";
          confidence = 0.9;
          break;
        case "patient_vitals":
          value = vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ") || "None recorded";
          source = "Recent vital signs";
          confidence = vitals.length > 0 ? 0.85 : 0.3;
          break;
        case "patient_labs":
          value = labs.map(l => `${l.title}: ${l.summary || ""}`).join("; ") || "None available";
          source = "Recent laboratory results";
          confidence = labs.length > 0 ? 0.85 : 0.3;
          break;
        case "computed":
          if (template.key === "toSpecialty" || template.key === "consultingSpecialty") {
            const diagnosis = (trigger.data.title || trigger.data.name || "").toLowerCase();
            value = this.findSpecialty(diagnosis) || "General Medicine";
            source = "Diagnosis-specialty mapping";
            confidence = value !== "General Medicine" ? 0.9 : 0.5;
          } else if (template.key === "urgency") {
            const severity = trigger.data.severity || "";
            value = severity === "critical" ? "Urgent" : severity === "high" ? "Urgent" : "Routine";
            source = "Clinical assessment";
            confidence = 0.8;
          } else if (template.key === "dischargeDate") {
            value = new Date().toISOString().split("T")[0];
            source = "Current date";
            confidence = 0.95;
          } else if (template.key === "emergencyContact") {
            value = template.defaultValue || "";
            source = "Standard protocol";
            confidence = 0.95;
          }
          break;
        case "ai_generated":
          aiFieldKeys.push(template.key);
          value = "";
          source = "AI analysis";
          confidence = 0;
          break;
      }

      fields.push({
        key: template.key,
        label: template.label,
        value,
        source,
        confidence,
        editable: true,
      });
    }

    if (aiFieldKeys.length > 0) {
      try {
        const aiFields = await this.generateAIFieldValues(
          scenario,
          trigger,
          patientRecords,
          patientName,
          aiFieldKeys
        );
        for (const aiField of aiFields) {
          const fieldIndex = fields.findIndex(f => f.key === aiField.key);
          if (fieldIndex >= 0) {
            fields[fieldIndex].value = aiField.value;
            fields[fieldIndex].confidence = aiField.confidence;
            fields[fieldIndex].source = "AI clinical analysis";
          }
        }
      } catch (error) {
        console.error("[AutomationEngine] AI field generation error:", error);
        for (const key of aiFieldKeys) {
          const fieldIndex = fields.findIndex(f => f.key === key);
          if (fieldIndex >= 0) {
            fields[fieldIndex].value = "Requires manual entry";
            fields[fieldIndex].confidence = 0;
            fields[fieldIndex].source = "AI unavailable - manual entry required";
          }
        }
      }
    }

    const filledFields = fields.filter(f => f.value && f.value !== "Requires manual entry" && f.value !== "None documented");
    const overallConfidence = filledFields.length > 0
      ? filledFields.reduce((sum, f) => sum + f.confidence, 0) / filledFields.length
      : 0.3;

    const docNames: Record<string, string> = {
      referral_letter: "Referral Letter",
      discharge_summary: "Discharge Summary",
      consultation: "Consultation Note",
      progress_note: "Progress Note",
      soap: "SOAP Note",
      medication_summary: "Medication Summary",
    };

    return {
      documentType: scenario.documentType,
      documentName: docNames[scenario.documentType] || scenario.name,
      fields,
      additionalContext: `Auto-generated from ${scenario.name} scenario. Trigger: ${this.describeTrigger(trigger)}. Patient: ${patientName}.`,
      confidence: overallConfidence,
      sourceRecords: ["conditions", "medications", "allergies", "vitals", "labs"].filter(type =>
        patientRecords.some(r => r.type === type || (type === "labs" && r.type === "lab"))
      ),
      scenarioType: scenario.id,
      draftReady: overallConfidence >= 0.6,
    };
  }

  private async generateAIFieldValues(
    scenario: ScenarioTemplate,
    trigger: AutomationTrigger,
    patientRecords: any[],
    patientName: string,
    fieldKeys: string[]
  ): Promise<Array<{ key: string; value: string; confidence: number }>> {
    const conditions = patientRecords.filter(r => r.type === "condition");
    const medications = patientRecords.filter(r => r.type === "medication");
    const vitals = patientRecords.filter(r => r.type === "vital").slice(0, 5);
    const labs = patientRecords.filter(r => r.type === "lab" || r.type === "labs").slice(0, 5);
    const allergies = patientRecords.filter(r => r.type === "allergy");

    const fieldDescriptions = fieldKeys.map(key => {
      const template = scenario.fieldTemplates.find(t => t.key === key);
      return `"${key}": "${template?.label || key}"`;
    }).join(", ");

    const govResponse = await governedAICall({
      callerService: "clinical-automation-engine",
      callerMethod: "generateAIFieldValues",
      purpose: "documentation",
      model: "gpt-5.2",
      systemPrompt: `You are a clinical documentation automation assistant generating pre-fill field values for a ${scenario.name} document. Generate clinically appropriate, concise values for the requested fields based on patient data and the trigger event. Return JSON with this structure:
{ "fields": [ { "key": "field_key", "value": "generated value", "confidence": 0.0-1.0 } ] }
Each field value should be a brief, clinical-quality text suitable for the document type. Confidence should reflect how certain you are about the value given the available data. Do not include any PHI identifiers - use clinical language only.`,
      userPrompt: `Generate values for these fields: {${fieldDescriptions}}

Document type: ${scenario.documentType.replace(/_/g, " ")}
Trigger: ${this.describeTrigger(trigger)}

Patient context:
- Patient: ${patientName}
- Conditions: ${conditions.map(c => c.title).join(", ") || "None documented"}
- Medications: ${medications.map(m => `${m.title} (${m.summary || ""})`).join(", ") || "None"}
- Allergies: ${allergies.map(a => a.title).join(", ") || "No known allergies"}
- Recent Vitals: ${vitals.map(v => `${v.title}: ${v.summary || ""}`).join("; ") || "None"}
- Recent Labs: ${labs.map(l => `${l.title}: ${l.summary || ""}`).join("; ") || "None"}

Generate concise, clinically appropriate values for each field.`,
      dataCategories: ["demographics", "conditions", "medications", "vitals", "allergies"],
      maxTokens: 2048,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(govResponse.content);
    return (parsed.fields || []).map((f: any) => ({
      key: f.key || "",
      value: f.value || "",
      confidence: typeof f.confidence === "number" ? f.confidence : 0.7,
    }));
  }

  getScenarios(): ScenarioTemplate[] {
    return CLINICAL_SCENARIOS;
  }

  getScenariosByTrigger(triggerType: string): ScenarioTemplate[] {
    return CLINICAL_SCENARIOS.filter(s => s.triggerType === triggerType);
  }

  getSuggestionsForUser(userId: string): AutomationSuggestion[] {
    const now = new Date();
    return Array.from(this.suggestions.values())
      .filter(s => s.patientId === userId && s.status === "pending" && s.expiresAt > now)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pa = priorityOrder[a.priority] ?? 3;
        const pb = priorityOrder[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  acceptSuggestion(suggestionId: string): AutomationSuggestion | null {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) return null;
    suggestion.status = "accepted";
    this.stats.suggestionsAccepted++;
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): AutomationSuggestion | null {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) return null;
    suggestion.status = "dismissed";
    this.stats.suggestionsDismissed++;
    return suggestion;
  }

  getUserSettings(userId: string): { enabled: boolean; mutedRules: string[] } {
    return this.userSettings.get(userId) || { enabled: true, mutedRules: [] };
  }

  updateUserSettings(userId: string, settings: { enabled?: boolean; mutedRules?: string[] }): void {
    const current = this.getUserSettings(userId);
    this.userSettings.set(userId, {
      enabled: settings.enabled !== undefined ? settings.enabled : current.enabled,
      mutedRules: settings.mutedRules || current.mutedRules,
    });
  }

  getRules(): AutomationRule[] {
    return AUTOMATION_RULES;
  }

  getActiveRulesSummary() {
    return AUTOMATION_RULES.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      triggerType: rule.triggerType,
      priority: rule.priority,
      enabled: rule.enabled,
    }));
  }

  getStats() {
    return {
      ...this.stats,
      activeRules: AUTOMATION_RULES.filter(r => r.enabled).length,
      totalRules: AUTOMATION_RULES.length,
      pendingSuggestions: Array.from(this.suggestions.values()).filter(s => s.status === "pending").length,
    };
  }
}

export const clinicalAutomationEngine = new ClinicalAutomationEngine();
