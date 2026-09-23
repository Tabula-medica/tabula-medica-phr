import { logPhiAccess } from "../security/hipaa-audit";
import { unifiedNotificationService } from "./unified-notification-service";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated insights are for INFORMATIONAL and OPERATIONAL purposes only. They do NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.";

export type InsightCategory = "care_gap" | "follow_up" | "preventive" | "coordination" | "documentation" | "medication_review" | "lab_review" | "vitals_trend";
export type InsightPriority = "critical" | "high" | "medium" | "low";
export type AlertSeverity = "critical" | "warning" | "info";
export type FormType = "encounter_note" | "referral" | "lab_order" | "medication_reconciliation" | "care_plan" | "discharge_summary" | "follow_up" | "patient_summary";

export interface FHIRPatientContext {
  patientId: string;
  demographics: {
    name: string;
    age: number;
    gender: string;
    birthDate: string;
  };
  conditions: Array<{
    code: string;
    display: string;
    status: string;
    onsetDate?: string;
    category?: string;
  }>;
  medications: Array<{
    code: string;
    display: string;
    status: string;
    dosage?: string;
    frequency?: string;
  }>;
  allergies: Array<{
    substance: string;
    severity: string;
    reaction?: string;
  }>;
  recentLabs: Array<{
    code: string;
    display: string;
    value: number | string;
    unit?: string;
    referenceRange?: string;
    date: string;
    status: string;
    interpretation?: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
  }>;
  upcomingAppointments: Array<{
    id: string;
    date: string;
    type: string;
    provider: string;
    status: string;
  }>;
  recentEncounters: Array<{
    id: string;
    date: string;
    type: string;
    reason?: string;
    provider?: string;
  }>;
  carePlans: Array<{
    id: string;
    title: string;
    status: string;
    goals: string[];
  }>;
}

export interface AIWorkflowInsight {
  id: string;
  patientId: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  description: string;
  rationale: string;
  suggestedTasks: Array<{
    id: string;
    title: string;
    description: string;
    assignee: string;
    dueInHours: number;
    automated: boolean;
  }>;
  relatedFHIRResources: Array<{
    resourceType: string;
    resourceId: string;
    display: string;
  }>;
  confidenceScore: number;
  generatedAt: string;
  expiresAt: string;
  status: "pending" | "acknowledged" | "actioned" | "dismissed";
  actionedBy?: string;
  actionedAt?: string;
  aiGenerated: boolean;
  noCdsDisclaimer: string;
}

export interface PrePopulatedFormData {
  formId: string;
  formType: FormType;
  patientId: string;
  generatedAt: string;
  fields: Array<{
    fieldId: string;
    fieldName: string;
    value: string | number | boolean | string[];
    source: "fhir" | "ai_suggested" | "default";
    fhirResourceType?: string;
    fhirResourceId?: string;
    editable: boolean;
    required: boolean;
    validated: boolean;
  }>;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    fieldIds: string[];
    collapsed: boolean;
  }>;
  metadata: {
    patientName: string;
    patientMRN: string;
    providerName?: string;
    encounterDate?: string;
  };
  aiSuggestions: Array<{
    fieldId: string;
    suggestion: string;
    confidence: number;
    rationale: string;
  }>;
  validationErrors: Array<{
    fieldId: string;
    error: string;
  }>;
  completionPercentage: number;
  noCdsDisclaimer: string;
}

export interface CriticalFHIRAlert {
  id: string;
  patientId: string;
  severity: AlertSeverity;
  alertType: string;
  title: string;
  description: string;
  fhirResourceType: string;
  fhirResourceId: string;
  previousValue?: string | number;
  currentValue: string | number;
  changePercentage?: number;
  detectedAt: string;
  requiredAction: string;
  assignedTo?: string;
  status: "active" | "acknowledged" | "resolved" | "escalated";
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  escalationLevel: number;
  notificationSent: boolean;
  aiAnalysis?: string;
  noCdsDisclaimer: string;
}

export interface WorkflowDashboardStats {
  totalPendingInsights: number;
  criticalAlerts: number;
  highPriorityTasks: number;
  pendingFormReviews: number;
  insightsByCategory: Record<InsightCategory, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  recentActivity: Array<{
    id: string;
    type: "insight" | "alert" | "form" | "task";
    description: string;
    timestamp: string;
    patientId: string;
  }>;
}

const insightStore = new Map<string, AIWorkflowInsight[]>();
const alertStore = new Map<string, CriticalFHIRAlert[]>();
const formStore = new Map<string, PrePopulatedFormData[]>();

const samplePatientContexts = new Map<string, FHIRPatientContext>();

function initializeSampleData(): void {
  const patient1Context: FHIRPatientContext = {
    patientId: "patient-001",
    demographics: {
      name: "John Smith",
      age: 49,
      gender: "Male",
      birthDate: "1975-06-15"
    },
    conditions: [
      { code: "I10", display: "Essential Hypertension", status: "active", onsetDate: "2020-03-15", category: "chronic" },
      { code: "E11", display: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2019-08-22", category: "chronic" },
      { code: "E78.0", display: "Hyperlipidemia", status: "active", onsetDate: "2021-01-10", category: "chronic" },
    ],
    medications: [
      { code: "860975", display: "Metformin 500mg", status: "active", dosage: "500mg", frequency: "twice daily" },
      { code: "311354", display: "Lisinopril 10mg", status: "active", dosage: "10mg", frequency: "once daily" },
      { code: "617312", display: "Atorvastatin 20mg", status: "active", dosage: "20mg", frequency: "once daily at bedtime" },
      { code: "198211", display: "Aspirin 81mg", status: "active", dosage: "81mg", frequency: "once daily" },
    ],
    allergies: [
      { substance: "Penicillin", severity: "high", reaction: "Anaphylaxis" },
      { substance: "Shellfish", severity: "moderate", reaction: "Hives" }
    ],
    recentLabs: [
      { code: "4548-4", display: "HbA1c", value: 7.8, unit: "%", referenceRange: "< 7.0%", date: "2026-01-10", status: "final", interpretation: "above_normal" },
      { code: "2345-7", display: "Glucose", value: 145, unit: "mg/dL", referenceRange: "70-100 mg/dL", date: "2026-01-10", status: "final", interpretation: "high" },
      { code: "2093-3", display: "Total Cholesterol", value: 195, unit: "mg/dL", referenceRange: "< 200 mg/dL", date: "2026-01-10", status: "final", interpretation: "normal" },
      { code: "2085-9", display: "HDL Cholesterol", value: 42, unit: "mg/dL", referenceRange: "> 40 mg/dL", date: "2026-01-10", status: "final", interpretation: "normal" },
      { code: "13457-7", display: "LDL Cholesterol", value: 118, unit: "mg/dL", referenceRange: "< 100 mg/dL", date: "2026-01-10", status: "final", interpretation: "above_normal" },
      { code: "2160-0", display: "Creatinine", value: 1.1, unit: "mg/dL", referenceRange: "0.7-1.3 mg/dL", date: "2026-01-10", status: "final", interpretation: "normal" },
    ],
    vitals: [
      { type: "Blood Pressure Systolic", value: 142, unit: "mmHg", date: "2026-01-20" },
      { type: "Blood Pressure Diastolic", value: 88, unit: "mmHg", date: "2026-01-20" },
      { type: "Heart Rate", value: 78, unit: "bpm", date: "2026-01-20" },
      { type: "Weight", value: 198, unit: "lbs", date: "2026-01-20" },
      { type: "BMI", value: 29.3, unit: "kg/m2", date: "2026-01-20" },
    ],
    upcomingAppointments: [
      { id: "apt-001", date: "2026-01-28", type: "Follow-up", provider: "Dr. Martinez", status: "scheduled" },
      { id: "apt-002", date: "2026-02-15", type: "Lab Work", provider: "Lab Services", status: "scheduled" },
    ],
    recentEncounters: [
      { id: "enc-001", date: "2026-01-10", type: "Office Visit", reason: "Diabetes Management", provider: "Dr. Martinez" },
      { id: "enc-002", date: "2025-12-15", type: "Annual Physical", reason: "Preventive Care", provider: "Dr. Johnson" },
    ],
    carePlans: [
      { id: "cp-001", title: "Diabetes Management Plan", status: "active", goals: ["Maintain HbA1c < 7.0%", "Daily glucose monitoring", "Lifestyle modifications"] },
      { id: "cp-002", title: "Cardiovascular Risk Reduction", status: "active", goals: ["BP < 130/80", "LDL < 100 mg/dL", "Regular exercise"] },
    ]
  };

  const patient2Context: FHIRPatientContext = {
    patientId: "patient-002",
    demographics: {
      name: "Sarah Johnson",
      age: 36,
      gender: "Female",
      birthDate: "1989-03-22"
    },
    conditions: [
      { code: "J45", display: "Asthma", status: "active", onsetDate: "2010-05-10", category: "chronic" },
    ],
    medications: [
      { code: "746762", display: "Albuterol HFA", status: "active", dosage: "90mcg", frequency: "as needed" },
      { code: "896188", display: "Fluticasone 250mcg", status: "active", dosage: "250mcg", frequency: "twice daily" },
    ],
    allergies: [
      { substance: "Sulfa drugs", severity: "moderate", reaction: "Rash" }
    ],
    recentLabs: [
      { code: "26453-1", display: "WBC", value: 7.2, unit: "K/uL", referenceRange: "4.5-11.0 K/uL", date: "2026-01-05", status: "final", interpretation: "normal" },
    ],
    vitals: [
      { type: "Blood Pressure Systolic", value: 118, unit: "mmHg", date: "2026-01-15" },
      { type: "Blood Pressure Diastolic", value: 72, unit: "mmHg", date: "2026-01-15" },
      { type: "Heart Rate", value: 72, unit: "bpm", date: "2026-01-15" },
      { type: "Peak Flow", value: 420, unit: "L/min", date: "2026-01-15" },
    ],
    upcomingAppointments: [
      { id: "apt-003", date: "2026-02-01", type: "Pulmonology", provider: "Dr. Chen", status: "scheduled" },
    ],
    recentEncounters: [
      { id: "enc-003", date: "2026-01-05", type: "Office Visit", reason: "Asthma Review", provider: "Dr. Chen" },
    ],
    carePlans: [
      { id: "cp-003", title: "Asthma Action Plan", status: "active", goals: ["Peak flow > 80% personal best", "Minimize rescue inhaler use", "Avoid triggers"] },
    ]
  };

  samplePatientContexts.set("patient-001", patient1Context);
  samplePatientContexts.set("patient-002", patient2Context);

  generateInitialInsightsForPatient(patient1Context);
  generateInitialInsightsForPatient(patient2Context);
  generateInitialAlertsForPatient(patient1Context);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateInitialInsightsForPatient(context: FHIRPatientContext): void {
  const insights: AIWorkflowInsight[] = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (context.patientId === "patient-001") {
    const hba1cLab = context.recentLabs.find(l => l.code === "4548-4");
    if (hba1cLab && typeof hba1cLab.value === "number" && hba1cLab.value > 7.0) {
      insights.push({
        id: generateId("insight"),
        patientId: context.patientId,
        category: "lab_review",
        priority: "high",
        title: "Elevated HbA1c Requires Care Coordination",
        description: `Patient's HbA1c of ${hba1cLab.value}% is above target. Care team coordination recommended for diabetes management optimization.`,
        rationale: "HbA1c exceeds target of 7.0%. Operational follow-up needed to ensure patient has access to diabetes education resources and care coordination support.",
        suggestedTasks: [
          { id: generateId("task"), title: "Schedule diabetes education session", description: "Coordinate with patient education department", assignee: "care_coordinator", dueInHours: 48, automated: false },
          { id: generateId("task"), title: "Send care plan reminder", description: "Automated reminder for upcoming follow-up", assignee: "system", dueInHours: 24, automated: true },
          { id: generateId("task"), title: "Notify primary care team", description: "Alert care team of elevated lab values", assignee: "care_coordinator", dueInHours: 4, automated: true },
        ],
        relatedFHIRResources: [
          { resourceType: "Observation", resourceId: "obs-hba1c-001", display: "HbA1c 7.8%" },
          { resourceType: "CarePlan", resourceId: "cp-001", display: "Diabetes Management Plan" },
        ],
        confidenceScore: 94,
        generatedAt: now.toISOString(),
        expiresAt,
        status: "pending",
        aiGenerated: true,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const bpSystolic = context.vitals.find(v => v.type === "Blood Pressure Systolic");
    if (bpSystolic && bpSystolic.value > 140) {
      insights.push({
        id: generateId("insight"),
        patientId: context.patientId,
        category: "vitals_trend",
        priority: "high",
        title: "Blood Pressure Above Target - Coordination Needed",
        description: `Patient's blood pressure reading of ${bpSystolic.value}/${context.vitals.find(v => v.type === "Blood Pressure Diastolic")?.value} mmHg is elevated. Care coordination follow-up recommended.`,
        rationale: "Blood pressure exceeds guideline targets. Operational follow-up to ensure patient has BP monitoring resources and scheduled follow-ups.",
        suggestedTasks: [
          { id: generateId("task"), title: "Confirm home BP monitoring setup", description: "Verify patient has access to home BP monitoring", assignee: "care_coordinator", dueInHours: 24, automated: false },
          { id: generateId("task"), title: "Schedule follow-up appointment", description: "Ensure timely follow-up for BP review", assignee: "scheduler", dueInHours: 48, automated: false },
        ],
        relatedFHIRResources: [
          { resourceType: "Observation", resourceId: "obs-bp-001", display: "BP 142/88 mmHg" },
        ],
        confidenceScore: 91,
        generatedAt: now.toISOString(),
        expiresAt,
        status: "pending",
        aiGenerated: true,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    insights.push({
      id: generateId("insight"),
      patientId: context.patientId,
      category: "preventive",
      priority: "medium",
      title: "Annual Eye Exam Due - Scheduling Reminder",
      description: "Patient with diabetes is due for annual dilated eye exam per preventive care guidelines.",
      rationale: "Patients with diabetes should have annual eye exams. No record of eye exam in the past 12 months.",
      suggestedTasks: [
        { id: generateId("task"), title: "Schedule ophthalmology referral", description: "Coordinate with ophthalmology for annual exam", assignee: "scheduler", dueInHours: 72, automated: false },
        { id: generateId("task"), title: "Send patient reminder", description: "Notify patient about preventive care due", assignee: "system", dueInHours: 24, automated: true },
      ],
      relatedFHIRResources: [
        { resourceType: "Condition", resourceId: "cond-001", display: "Type 2 Diabetes" },
      ],
      confidenceScore: 88,
      generatedAt: now.toISOString(),
      expiresAt,
      status: "pending",
      aiGenerated: true,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }

  if (context.patientId === "patient-002") {
    insights.push({
      id: generateId("insight"),
      patientId: context.patientId,
      category: "follow_up",
      priority: "medium",
      title: "Asthma Control Assessment Due",
      description: "Patient is due for asthma control assessment questionnaire.",
      rationale: "Regular asthma control assessments improve care coordination and patient outcomes tracking.",
      suggestedTasks: [
        { id: generateId("task"), title: "Send ACQ questionnaire", description: "Send Asthma Control Questionnaire to patient portal", assignee: "system", dueInHours: 24, automated: true },
        { id: generateId("task"), title: "Review peak flow trends", description: "Compile peak flow data for provider review", assignee: "care_coordinator", dueInHours: 48, automated: false },
      ],
      relatedFHIRResources: [
        { resourceType: "Condition", resourceId: "cond-asthma-001", display: "Asthma" },
        { resourceType: "CarePlan", resourceId: "cp-003", display: "Asthma Action Plan" },
      ],
      confidenceScore: 85,
      generatedAt: now.toISOString(),
      expiresAt,
      status: "pending",
      aiGenerated: true,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }

  if (insights.length > 0) {
    insightStore.set(context.patientId, insights);
  }
}

function generateInitialAlertsForPatient(context: FHIRPatientContext): void {
  const alerts: CriticalFHIRAlert[] = [];

  if (context.patientId === "patient-001") {
    const hba1cLab = context.recentLabs.find(l => l.code === "4548-4");
    if (hba1cLab && typeof hba1cLab.value === "number" && hba1cLab.value > 7.5) {
      alerts.push({
        id: generateId("alert"),
        patientId: context.patientId,
        severity: "warning",
        alertType: "lab_result_elevated",
        title: "HbA1c Above Target Range",
        description: `HbA1c result of ${hba1cLab.value}% exceeds target of 7.0%. Care coordination follow-up recommended.`,
        fhirResourceType: "Observation",
        fhirResourceId: "obs-hba1c-001",
        previousValue: 7.2,
        currentValue: hba1cLab.value,
        changePercentage: 8.3,
        detectedAt: new Date().toISOString(),
        requiredAction: "Review patient care plan and coordinate follow-up",
        status: "active",
        escalationLevel: 0,
        notificationSent: false,
        aiAnalysis: "Trend analysis indicates gradual increase over past 6 months. Care coordination recommended to ensure patient engagement with diabetes management resources.",
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const ldlLab = context.recentLabs.find(l => l.code === "13457-7");
    if (ldlLab && typeof ldlLab.value === "number" && ldlLab.value > 100) {
      alerts.push({
        id: generateId("alert"),
        patientId: context.patientId,
        severity: "info",
        alertType: "lab_result_monitoring",
        title: "LDL Cholesterol Above Goal",
        description: `LDL Cholesterol of ${ldlLab.value} mg/dL is above target for cardiovascular risk reduction.`,
        fhirResourceType: "Observation",
        fhirResourceId: "obs-ldl-001",
        currentValue: ldlLab.value,
        detectedAt: new Date().toISOString(),
        requiredAction: "Flag for provider review at next visit",
        status: "active",
        escalationLevel: 0,
        notificationSent: false,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }
  }

  if (alerts.length > 0) {
    alertStore.set(context.patientId, alerts);
  }
}

export async function generateAIInsightsForPatient(
  patientId: string,
  userId: string
): Promise<AIWorkflowInsight[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "AIWorkflowInsight",
    resourceId: patientId,
    patientId,
    details: "Generate AI workflow insights for patient"
  });

  const context = samplePatientContexts.get(patientId);
  if (!context) {
    return [];
  }

  const existingInsights = insightStore.get(patientId) || [];
  
  if (!aiEnabled) {
    return existingInsights;
  }

  try {
    const prompt = `Analyze this patient's FHIR data and suggest OPERATIONAL workflow tasks (NOT clinical recommendations):

Patient: ${context.demographics.name}, ${context.demographics.age}yo ${context.demographics.gender}
Conditions: ${context.conditions.map(c => c.display).join(", ")}
Active Medications: ${context.medications.length}
Recent Labs: ${context.recentLabs.map(l => `${l.display}: ${l.value} ${l.unit || ""} (${l.interpretation || "normal"})`).join("; ")}
Upcoming Appointments: ${context.upcomingAppointments.length}

Suggest 2-3 OPERATIONAL tasks focused on:
- Care coordination and scheduling
- Patient education and outreach
- Documentation completeness
- Follow-up reminders

DO NOT suggest any clinical interventions, medication changes, or treatment recommendations.

Respond in JSON format:
{
  "insights": [
    {
      "category": "care_gap|follow_up|preventive|coordination|documentation",
      "priority": "high|medium|low",
      "title": "Brief title",
      "description": "Description of operational task",
      "tasks": ["task1", "task2"]
    }
  ]
}`;

    const content = await generatePhiSafeText({
      system: "You are a healthcare operations assistant. You ONLY suggest administrative and care coordination tasks. You NEVER provide clinical advice or treatment recommendations.",
      user: prompt,
      maxTokens: 500,
      responseMimeType: "application/json"
    });

    const aiResponse = JSON.parse(content || "{}");
    
    if (aiResponse.insights && Array.isArray(aiResponse.insights)) {
      const now = new Date();
      const newInsights: AIWorkflowInsight[] = aiResponse.insights.map((insight: any) => ({
        id: generateId("insight"),
        patientId,
        category: insight.category || "coordination",
        priority: insight.priority || "medium",
        title: insight.title,
        description: insight.description,
        rationale: "AI-generated operational suggestion based on patient data analysis.",
        suggestedTasks: (insight.tasks || []).map((task: string) => ({
          id: generateId("task"),
          title: task,
          description: task,
          assignee: "care_coordinator",
          dueInHours: 48,
          automated: false
        })),
        relatedFHIRResources: [],
        confidenceScore: 80,
        generatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "pending" as const,
        aiGenerated: true,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      }));

      const allInsights = [...existingInsights, ...newInsights];
      insightStore.set(patientId, allInsights);
      return allInsights;
    }
  } catch (error) {
    console.error("[AIProviderWorkflow] AI insight generation error:", error);
  }

  return existingInsights;
}

export function getPatientInsights(patientId: string, userId: string): AIWorkflowInsight[] {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "AIWorkflowInsight",
    resourceId: patientId,
    patientId,
    details: "Get patient workflow insights"
  });

  return insightStore.get(patientId) || [];
}

export function acknowledgeInsight(insightId: string, patientId: string, userId: string): boolean {
  const insights = insightStore.get(patientId);
  if (!insights) return false;

  const insight = insights.find(i => i.id === insightId);
  if (!insight) return false;

  insight.status = "acknowledged";
  insight.actionedBy = userId;
  insight.actionedAt = new Date().toISOString();

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "AIWorkflowInsight",
    resourceId: insightId,
    patientId,
    details: "Acknowledge workflow insight"
  });

  return true;
}

export function prePopulateForm(
  formType: FormType,
  patientId: string,
  userId: string
): PrePopulatedFormData | null {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "PrePopulatedForm",
    resourceId: patientId,
    patientId,
    details: `Pre-populate ${formType} form with FHIR data`
  });

  const context = samplePatientContexts.get(patientId);
  if (!context) return null;

  const formId = generateId("form");
  const now = new Date().toISOString();

  const baseFields: PrePopulatedFormData["fields"] = [
    { fieldId: "patient_name", fieldName: "Patient Name", value: context.demographics.name, source: "fhir", fhirResourceType: "Patient", editable: false, required: true, validated: true },
    { fieldId: "patient_dob", fieldName: "Date of Birth", value: context.demographics.birthDate, source: "fhir", fhirResourceType: "Patient", editable: false, required: true, validated: true },
    { fieldId: "patient_age", fieldName: "Age", value: context.demographics.age, source: "fhir", fhirResourceType: "Patient", editable: false, required: true, validated: true },
    { fieldId: "patient_gender", fieldName: "Gender", value: context.demographics.gender, source: "fhir", fhirResourceType: "Patient", editable: false, required: true, validated: true },
  ];

  const conditionFields: PrePopulatedFormData["fields"] = context.conditions.map((c, idx) => ({
    fieldId: `condition_${idx}`,
    fieldName: `Active Condition ${idx + 1}`,
    value: c.display,
    source: "fhir" as const,
    fhirResourceType: "Condition",
    fhirResourceId: `cond-${idx}`,
    editable: true,
    required: false,
    validated: true
  }));

  const medicationFields: PrePopulatedFormData["fields"] = context.medications.map((m, idx) => ({
    fieldId: `medication_${idx}`,
    fieldName: `Active Medication ${idx + 1}`,
    value: `${m.display} - ${m.dosage || ""} ${m.frequency || ""}`.trim(),
    source: "fhir" as const,
    fhirResourceType: "MedicationStatement",
    fhirResourceId: `med-${idx}`,
    editable: true,
    required: false,
    validated: true
  }));

  const allergyFields: PrePopulatedFormData["fields"] = context.allergies.map((a, idx) => ({
    fieldId: `allergy_${idx}`,
    fieldName: `Allergy ${idx + 1}`,
    value: `${a.substance} (${a.severity}) - ${a.reaction || "Unknown reaction"}`,
    source: "fhir" as const,
    fhirResourceType: "AllergyIntolerance",
    fhirResourceId: `allergy-${idx}`,
    editable: true,
    required: false,
    validated: true
  }));

  const labFields: PrePopulatedFormData["fields"] = context.recentLabs.slice(0, 5).map((l, idx) => ({
    fieldId: `lab_${idx}`,
    fieldName: l.display,
    value: `${l.value} ${l.unit || ""} (${l.date})`,
    source: "fhir" as const,
    fhirResourceType: "Observation",
    fhirResourceId: `obs-${idx}`,
    editable: false,
    required: false,
    validated: true
  }));

  const vitalFields: PrePopulatedFormData["fields"] = context.vitals.map((v, idx) => ({
    fieldId: `vital_${idx}`,
    fieldName: v.type,
    value: `${v.value} ${v.unit}`,
    source: "fhir" as const,
    fhirResourceType: "Observation",
    fhirResourceId: `vital-${idx}`,
    editable: false,
    required: false,
    validated: true
  }));

  let additionalFields: PrePopulatedFormData["fields"] = [];
  let sections: PrePopulatedFormData["sections"] = [];
  let aiSuggestions: PrePopulatedFormData["aiSuggestions"] = [];

  switch (formType) {
    case "encounter_note":
      additionalFields = [
        { fieldId: "chief_complaint", fieldName: "Chief Complaint", value: "", source: "default", editable: true, required: true, validated: false },
        { fieldId: "encounter_date", fieldName: "Encounter Date", value: now.split("T")[0], source: "default", editable: true, required: true, validated: true },
        { fieldId: "provider_notes", fieldName: "Provider Notes", value: "", source: "default", editable: true, required: false, validated: true },
      ];
      sections = [
        { sectionId: "demographics", sectionName: "Patient Demographics", fieldIds: baseFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "conditions", sectionName: "Active Conditions", fieldIds: conditionFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "medications", sectionName: "Current Medications", fieldIds: medicationFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "allergies", sectionName: "Allergies", fieldIds: allergyFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "vitals", sectionName: "Recent Vitals", fieldIds: vitalFields.map(f => f.fieldId), collapsed: true },
        { sectionId: "encounter", sectionName: "Encounter Details", fieldIds: additionalFields.map(f => f.fieldId), collapsed: false },
      ];
      break;

    case "medication_reconciliation":
      additionalFields = [
        { fieldId: "reconciliation_date", fieldName: "Reconciliation Date", value: now.split("T")[0], source: "default", editable: false, required: true, validated: true },
        { fieldId: "reconciliation_notes", fieldName: "Reconciliation Notes", value: "", source: "default", editable: true, required: false, validated: true },
        { fieldId: "discrepancies_found", fieldName: "Discrepancies Found", value: false, source: "default", editable: true, required: true, validated: true },
      ];
      sections = [
        { sectionId: "demographics", sectionName: "Patient Demographics", fieldIds: baseFields.map(f => f.fieldId), collapsed: true },
        { sectionId: "medications", sectionName: "Current Medications", fieldIds: medicationFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "allergies", sectionName: "Allergies", fieldIds: allergyFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "reconciliation", sectionName: "Reconciliation Details", fieldIds: additionalFields.map(f => f.fieldId), collapsed: false },
      ];
      aiSuggestions = [
        { fieldId: "reconciliation_notes", suggestion: "Review aspirin dosage with patient - confirm 81mg daily compliance", confidence: 78, rationale: "Multiple cardiovascular medications present" }
      ];
      break;

    case "patient_summary":
      sections = [
        { sectionId: "demographics", sectionName: "Patient Demographics", fieldIds: baseFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "conditions", sectionName: "Active Conditions", fieldIds: conditionFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "medications", sectionName: "Current Medications", fieldIds: medicationFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "allergies", sectionName: "Allergies", fieldIds: allergyFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "labs", sectionName: "Recent Labs", fieldIds: labFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "vitals", sectionName: "Recent Vitals", fieldIds: vitalFields.map(f => f.fieldId), collapsed: false },
      ];
      break;

    case "referral":
      additionalFields = [
        { fieldId: "referral_reason", fieldName: "Reason for Referral", value: "", source: "default", editable: true, required: true, validated: false },
        { fieldId: "referral_specialty", fieldName: "Specialty", value: "", source: "default", editable: true, required: true, validated: false },
        { fieldId: "referral_urgency", fieldName: "Urgency", value: "routine", source: "default", editable: true, required: true, validated: true },
        { fieldId: "clinical_question", fieldName: "Clinical Question", value: "", source: "default", editable: true, required: false, validated: true },
      ];
      sections = [
        { sectionId: "demographics", sectionName: "Patient Demographics", fieldIds: baseFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "conditions", sectionName: "Relevant Conditions", fieldIds: conditionFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "medications", sectionName: "Current Medications", fieldIds: medicationFields.map(f => f.fieldId), collapsed: true },
        { sectionId: "labs", sectionName: "Recent Labs", fieldIds: labFields.map(f => f.fieldId), collapsed: true },
        { sectionId: "referral", sectionName: "Referral Details", fieldIds: additionalFields.map(f => f.fieldId), collapsed: false },
      ];
      break;

    default:
      sections = [
        { sectionId: "demographics", sectionName: "Patient Demographics", fieldIds: baseFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "conditions", sectionName: "Active Conditions", fieldIds: conditionFields.map(f => f.fieldId), collapsed: false },
        { sectionId: "medications", sectionName: "Current Medications", fieldIds: medicationFields.map(f => f.fieldId), collapsed: false },
      ];
  }

  const allFields = [...baseFields, ...conditionFields, ...medicationFields, ...allergyFields, ...labFields, ...vitalFields, ...additionalFields];
  const requiredFields = allFields.filter(f => f.required);
  const completedFields = requiredFields.filter(f => f.validated && f.value !== "");
  const completionPercentage = requiredFields.length > 0 ? Math.round((completedFields.length / requiredFields.length) * 100) : 100;

  const formData: PrePopulatedFormData = {
    formId,
    formType,
    patientId,
    generatedAt: now,
    fields: allFields,
    sections,
    metadata: {
      patientName: context.demographics.name,
      patientMRN: patientId === "patient-001" ? "MRN-12345" : "MRN-67890",
      encounterDate: now.split("T")[0]
    },
    aiSuggestions,
    validationErrors: [],
    completionPercentage,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };

  const existingForms = formStore.get(patientId) || [];
  existingForms.push(formData);
  formStore.set(patientId, existingForms);

  return formData;
}

export function getCriticalAlerts(patientId: string, userId: string): CriticalFHIRAlert[] {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CriticalFHIRAlert",
    resourceId: patientId,
    patientId,
    details: "Get critical FHIR alerts for patient"
  });

  return alertStore.get(patientId) || [];
}

export function acknowledgeAlert(alertId: string, patientId: string, userId: string): boolean {
  const alerts = alertStore.get(patientId);
  if (!alerts) return false;

  const alert = alerts.find(a => a.id === alertId);
  if (!alert) return false;

  alert.status = "acknowledged";
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date().toISOString();

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "CriticalFHIRAlert",
    resourceId: alertId,
    patientId,
    details: "Acknowledge critical alert"
  });

  return true;
}

export function resolveAlert(alertId: string, patientId: string, userId: string): boolean {
  const alerts = alertStore.get(patientId);
  if (!alerts) return false;

  const alert = alerts.find(a => a.id === alertId);
  if (!alert) return false;

  alert.status = "resolved";
  alert.resolvedAt = new Date().toISOString();

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "CriticalFHIRAlert",
    resourceId: alertId,
    patientId,
    details: "Resolve critical alert"
  });

  return true;
}

export async function triggerCriticalAlert(
  patientId: string,
  alertData: Omit<CriticalFHIRAlert, "id" | "patientId" | "detectedAt" | "status" | "escalationLevel" | "notificationSent" | "noCdsDisclaimer">,
  userId: string
): Promise<CriticalFHIRAlert> {
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "CriticalFHIRAlert",
    resourceId: patientId,
    patientId,
    details: `Trigger critical alert: ${alertData.alertType}`
  });

  const alert: CriticalFHIRAlert = {
    id: generateId("alert"),
    patientId,
    ...alertData,
    detectedAt: new Date().toISOString(),
    status: "active",
    escalationLevel: 0,
    notificationSent: false,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };

  const existingAlerts = alertStore.get(patientId) || [];
  existingAlerts.unshift(alert);
  alertStore.set(patientId, existingAlerts);

  if (alert.severity === "critical") {
    try {
      unifiedNotificationService.createNotification(userId, {
        category: "alert",
        priority: "urgent",
        title: alert.title,
        message: alert.description,
        actionUrl: `/ai-provider-workflow?patient=${patientId}&alert=${alert.id}`,
        actionLabel: "View Alert",
        metadata: {
          alertId: alert.id,
          patientId,
          alertType: alert.alertType
        }
      });
      alert.notificationSent = true;
    } catch (error) {
      console.error("[AIProviderWorkflow] Failed to send notification:", error);
    }
  }

  return alert;
}

export function getWorkflowDashboardStats(userId: string): WorkflowDashboardStats {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "WorkflowDashboard",
    details: "Access workflow dashboard statistics"
  });

  let totalPendingInsights = 0;
  let criticalAlerts = 0;
  let highPriorityTasks = 0;
  let pendingFormReviews = 0;

  const insightsByCategory: Record<InsightCategory, number> = {
    care_gap: 0,
    follow_up: 0,
    preventive: 0,
    coordination: 0,
    documentation: 0,
    medication_review: 0,
    lab_review: 0,
    vitals_trend: 0
  };

  const alertsBySeverity: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0
  };

  const recentActivity: WorkflowDashboardStats["recentActivity"] = [];

  insightStore.forEach((insights, patientId) => {
    insights.forEach(insight => {
      if (insight.status === "pending") {
        totalPendingInsights++;
        insightsByCategory[insight.category]++;
        if (insight.priority === "high" || insight.priority === "critical") {
          highPriorityTasks++;
        }
        recentActivity.push({
          id: insight.id,
          type: "insight",
          description: insight.title,
          timestamp: insight.generatedAt,
          patientId
        });
      }
    });
  });

  alertStore.forEach((alerts, patientId) => {
    alerts.forEach(alert => {
      if (alert.status === "active") {
        alertsBySeverity[alert.severity]++;
        if (alert.severity === "critical") {
          criticalAlerts++;
        }
        recentActivity.push({
          id: alert.id,
          type: "alert",
          description: alert.title,
          timestamp: alert.detectedAt,
          patientId
        });
      }
    });
  });

  formStore.forEach((forms, patientId) => {
    forms.forEach(form => {
      if (form.completionPercentage < 100) {
        pendingFormReviews++;
        recentActivity.push({
          id: form.formId,
          type: "form",
          description: `${form.formType} form pending completion`,
          timestamp: form.generatedAt,
          patientId
        });
      }
    });
  });

  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    totalPendingInsights,
    criticalAlerts,
    highPriorityTasks,
    pendingFormReviews,
    insightsByCategory,
    alertsBySeverity,
    recentActivity: recentActivity.slice(0, 20)
  };
}

export function getAvailableFormTypes(): { type: FormType; label: string; description: string }[] {
  return [
    { type: "encounter_note", label: "Encounter Note", description: "Document a patient encounter with pre-populated clinical data" },
    { type: "referral", label: "Referral Form", description: "Create a specialist referral with patient history" },
    { type: "lab_order", label: "Lab Order", description: "Order laboratory tests with relevant clinical context" },
    { type: "medication_reconciliation", label: "Medication Reconciliation", description: "Review and reconcile patient medications" },
    { type: "care_plan", label: "Care Plan", description: "Create or update a patient care plan" },
    { type: "discharge_summary", label: "Discharge Summary", description: "Document discharge with care instructions" },
    { type: "follow_up", label: "Follow-Up Note", description: "Document a follow-up visit" },
    { type: "patient_summary", label: "Patient Summary", description: "Generate a comprehensive patient summary" },
  ];
}

export function getPatientContext(patientId: string): FHIRPatientContext | null {
  return samplePatientContexts.get(patientId) || null;
}

export function listPatients(): Array<{ patientId: string; name: string; age: number; conditionsCount: number }> {
  const patients: Array<{ patientId: string; name: string; age: number; conditionsCount: number }> = [];
  samplePatientContexts.forEach((context, patientId) => {
    patients.push({
      patientId,
      name: context.demographics.name,
      age: context.demographics.age,
      conditionsCount: context.conditions.length
    });
  });
  return patients;
}

initializeSampleData();

export const aiProviderWorkflowService = {
  generateAIInsightsForPatient,
  getPatientInsights,
  acknowledgeInsight,
  prePopulateForm,
  getCriticalAlerts,
  acknowledgeAlert,
  resolveAlert,
  triggerCriticalAlert,
  getWorkflowDashboardStats,
  getAvailableFormTypes,
  getPatientContext,
  listPatients,
  NO_CDS_DISCLAIMER
};
