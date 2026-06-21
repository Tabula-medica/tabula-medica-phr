import OpenAI from "openai";
import { getAuditLogger } from "./integrations/factory";
import { getValidationFailures, type FHIRValidationFailure } from "./fhir-validation-service";

export type CareTeamRole = "physician" | "nurse" | "care_coordinator" | "pharmacist" | "specialist";
export type SummaryLength = "concise" | "standard" | "detailed";

export interface PatientSummaryRequest {
  patientId: string;
  role: CareTeamRole;
  focusAreas?: string[];
  includeRecentUpdates?: boolean;
  timeframeDays?: number;
  summaryLength?: SummaryLength;
  includeDataQualityFlags?: boolean;
  includeActionableInsights?: boolean;
}

export interface FHIRResourceSummary {
  resourceType: string;
  count: number;
  items: Array<{
    id: string;
    display: string;
    date?: string;
    status?: string;
    category?: string;
  }>;
}

export interface DataQualityFlag {
  severity: "critical" | "high" | "medium" | "low";
  resourceType: string;
  resourceId: string;
  issue: string;
  detectedAt: string;
  impact: string;
}

export interface ActionableInsight {
  title: string;
  description: string;
  dataPoints: string[];
  trend?: "increasing" | "decreasing" | "stable" | "fluctuating";
  timeframe: string;
  note: string;
}

export interface PatientSummary {
  id: string;
  patientId: string;
  role: CareTeamRole;
  generatedAt: string;
  summaryLength: SummaryLength;
  summary: string;
  sections: PatientSummarySection[];
  recentUpdates: RecentUpdate[];
  attentionAreas: AttentionArea[];
  dataQualityFlags: DataQualityFlag[];
  actionableInsights: ActionableInsight[];
  sourceResources: FHIRResourceSummary[];
  disclaimer: string;
}

export interface PatientSummarySection {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
}

export interface RecentUpdate {
  date: string;
  resourceType: string;
  description: string;
  isNew: boolean;
}

export interface AttentionArea {
  title: string;
  description: string;
  relatedResources: string[];
  note: string;
}

const summaryHistory = new Map<string, PatientSummary[]>();

function generateId(): string {
  return `summary-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const ROLE_PROMPTS: Record<CareTeamRole, string> = {
  physician: `You are generating a patient summary for a physician. Include ONLY documented information:
- List of documented conditions with their recorded status
- Current medication list with documented dosages
- Most recent documented laboratory values
- Most recent documented vital signs
- Documented care plan goals and their recorded status
Present facts as recorded in the medical record without interpretation.`,

  nurse: `You are generating a patient summary for a nurse. Include ONLY documented information:
- Documented care plan tasks
- Current medication list with documented administration times
- Most recent documented vital signs and observations
- Documented allergies
- Documented patient preferences and communication notes
Present facts as recorded in the medical record without interpretation.`,

  care_coordinator: `You are generating a patient summary for a care coordinator. Include ONLY documented information:
- Documented care plan goals and their recorded status
- Scheduled and completed appointments as documented
- Documented referrals
- Documented care team notes
- Documented transition of care information
Present facts as recorded in the medical record without interpretation.`,

  pharmacist: `You are generating a patient summary for a pharmacist. Include ONLY documented information:
- Complete documented medication list with dosages and frequencies
- Documented allergies and recorded adverse reactions
- Most recent documented renal/hepatic function lab values
- Documented medication changes with dates
- Documented refill information
Present facts as recorded in the medical record without interpretation.`,

  specialist: `You are generating a patient summary for a specialist. Include ONLY documented information:
- Documented condition history relevant to the specialty
- Documented previous consultations
- Documented diagnostic test results
- Documented referral reason
Present facts as recorded in the medical record without interpretation.`,
};

const NO_CDS_GUARDRAIL = `
CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
You MUST NOT provide any of the following:
- NEW diagnoses or differential diagnoses (you MAY list documented conditions)
- Treatment recommendations or suggestions
- Drug dosage changes or recommendations
- Drug interaction warnings or alerts
- Clinical predictions or prognosis
- Risk assessments or scoring
- Triage decisions or urgency ratings
- Any form of medical advice or clinical interpretation
- Statements about what "should" or "could" be done

You may ONLY:
- List documented conditions, medications, and observations exactly as recorded
- Organize and present documented data clearly
- Summarize what IS documented in the medical record
- Present dates and values as recorded
- Group information by category for readability

CRITICAL DISTINCTIONS:
- Listing a documented condition like "Type 2 Diabetes Mellitus (active, documented 2018)" = ALLOWED
- Suggesting a patient "may have" or "appears to have" a condition = NOT ALLOWED
- Listing a documented medication = ALLOWED
- Suggesting medication changes or interactions = NOT ALLOWED
- Presenting documented lab values = ALLOWED
- Interpreting lab values as concerning or abnormal = NOT ALLOWED

If the summary would require clinical interpretation, state: "This summary presents documented information only. Clinical decisions must be made by qualified healthcare professionals."

ALWAYS include a disclaimer that this is an AI-generated summary for informational purposes only and does not constitute clinical advice.
`;

const SUMMARY_LENGTH_CONFIGS: Record<SummaryLength, { maxTokens: number; sectionLimit: number; detailLevel: string }> = {
  concise: {
    maxTokens: 800,
    sectionLimit: 3,
    detailLevel: `Generate a BRIEF summary (2-3 sentences max). Include only the most critical information:
- Top 2-3 active conditions
- Current medications (names only)
- Most recent key observations
Keep each section to 1-2 lines maximum.`,
  },
  standard: {
    maxTokens: 1500,
    sectionLimit: 5,
    detailLevel: `Generate a STANDARD summary with moderate detail:
- All active conditions with status
- Medications with dosages
- Recent observations with values
- Key care plan goals
Include relevant context but remain concise.`,
  },
  detailed: {
    maxTokens: 3000,
    sectionLimit: 8,
    detailLevel: `Generate a COMPREHENSIVE detailed summary:
- Complete condition history with onset dates and categories
- Full medication list with dosages, frequencies, and start dates
- All recent observations with values and dates
- Complete encounter history
- All care plan goals with status and target dates
- Allergies with severity and reactions
Provide thorough documentation while maintaining clarity.`,
  },
};

function detectDataQualityFlags(patientId: string): DataQualityFlag[] {
  try {
    const failures = getValidationFailures({ resourceType: undefined, severity: undefined });
    const patientFailures = failures.filter(f => 
      f.resourceId.includes(patientId) || f.patientId === patientId
    );
    
    const criticalAndError = patientFailures.filter(f => 
      f.severity === "critical" || f.severity === "error"
    );
    
    return criticalAndError.slice(0, 5).map(f => ({
      severity: f.severity === "critical" ? "critical" as const : "high" as const,
      resourceType: f.resourceType,
      resourceId: "[REDACTED]",
      issue: f.errorMessage,
      detectedAt: f.detectedAt,
      impact: f.severity === "critical" 
        ? "Critical severity validation failure documented" 
        : "High severity validation failure documented",
    }));
  } catch {
    return [];
  }
}

function generateActionableInsights(
  patientData: typeof SAMPLE_PATIENT_DATA["patient-001"],
  timeframeDays: number
): ActionableInsight[] {
  const insights: ActionableInsight[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  const recentObs = patientData.observations.filter(o => new Date(o.date) >= cutoffDate);
  if (recentObs.length > 0) {
    const labObs = recentObs.filter(o => o.category === "Laboratory");
    const vitalObs = recentObs.filter(o => o.category === "Vital Signs");
    
    if (labObs.length > 0) {
      insights.push({
        title: "Recent Laboratory Results",
        description: `${labObs.length} laboratory result(s) documented in the past ${timeframeDays} days.`,
        dataPoints: labObs.map(o => `${o.display}: ${o.value} ${o.unit} (${o.date})`),
        timeframe: `Past ${timeframeDays} days`,
        note: "Values presented exactly as documented in the medical record.",
      });
    }
    
    if (vitalObs.length > 0) {
      insights.push({
        title: "Recent Vital Sign Measurements",
        description: `${vitalObs.length} vital sign measurement(s) documented recently.`,
        dataPoints: vitalObs.map(o => `${o.display}: ${o.value} ${o.unit} (${o.date})`),
        timeframe: `Past ${timeframeDays} days`,
        note: "Vital signs presented exactly as recorded in the medical record.",
      });
    }
  }

  const recentEncounters = patientData.encounters.filter(e => new Date(e.date) >= cutoffDate);
  if (recentEncounters.length >= 2) {
    insights.push({
      title: "Recent Healthcare Encounters",
      description: `${recentEncounters.length} healthcare encounter(s) documented in the past ${timeframeDays} days.`,
      dataPoints: recentEncounters.map(e => `${e.type} - ${e.reason} (${e.date})`),
      timeframe: `Past ${timeframeDays} days`,
      note: "Encounters listed exactly as documented in the medical record.",
    });
  }

  const activeGoals = patientData.carePlanGoals.filter(g => g.status === "in-progress");
  if (activeGoals.length > 0) {
    const upcomingGoals = activeGoals.filter(g => {
      const targetDate = new Date(g.targetDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return targetDate <= thirtyDaysFromNow;
    });
    
    if (upcomingGoals.length > 0) {
      insights.push({
        title: "Care Plan Goals with Upcoming Target Dates",
        description: `${upcomingGoals.length} goal(s) have target dates within the next 30 days.`,
        dataPoints: upcomingGoals.map(g => `${g.description} (Target: ${g.targetDate})`),
        timeframe: "Next 30 days",
        note: "Goals and target dates presented exactly as documented in the care plan.",
      });
    }
  }

  const recentMeds = patientData.medications.filter(m => {
    const startDate = new Date(m.startDate);
    return startDate >= cutoffDate;
  });
  if (recentMeds.length > 0) {
    insights.push({
      title: "Recently Started Medications",
      description: `${recentMeds.length} medication(s) started in the past ${timeframeDays} days.`,
      dataPoints: recentMeds.map(m => `${m.display} ${m.dosage} ${m.frequency} (Started: ${m.startDate})`),
      timeframe: `Past ${timeframeDays} days`,
      note: "Medications presented exactly as documented in the medical record.",
    });
  }

  return insights;
}

const SAMPLE_PATIENT_DATA: Record<string, {
  demographics: { name: string; dob: string; gender: string; mrn: string };
  conditions: Array<{ id: string; display: string; status: string; onsetDate: string; category: string }>;
  medications: Array<{ id: string; display: string; dosage: string; frequency: string; status: string; startDate: string }>;
  observations: Array<{ id: string; display: string; value: string; unit: string; date: string; category: string }>;
  allergies: Array<{ id: string; display: string; severity: string; reaction: string }>;
  encounters: Array<{ id: string; type: string; date: string; provider: string; reason: string }>;
  procedures: Array<{ id: string; display: string; date: string; status: string }>;
  carePlanGoals: Array<{ id: string; description: string; status: string; targetDate: string }>;
}> = {
  "patient-001": {
    demographics: { name: "John Smith", dob: "1965-03-15", gender: "Male", mrn: "MRN-12345" },
    conditions: [
      { id: "cond-1", display: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2018-06-10", category: "Metabolic" },
      { id: "cond-2", display: "Essential Hypertension", status: "active", onsetDate: "2016-02-20", category: "Cardiovascular" },
      { id: "cond-3", display: "Hyperlipidemia", status: "active", onsetDate: "2017-08-05", category: "Metabolic" },
      { id: "cond-4", display: "Chronic Kidney Disease Stage 3", status: "active", onsetDate: "2022-01-15", category: "Renal" },
    ],
    medications: [
      { id: "med-1", display: "Metformin", dosage: "1000mg", frequency: "twice daily", status: "active", startDate: "2018-06-15" },
      { id: "med-2", display: "Lisinopril", dosage: "20mg", frequency: "once daily", status: "active", startDate: "2016-03-01" },
      { id: "med-3", display: "Atorvastatin", dosage: "40mg", frequency: "once daily at bedtime", status: "active", startDate: "2017-08-10" },
      { id: "med-4", display: "Aspirin", dosage: "81mg", frequency: "once daily", status: "active", startDate: "2019-01-05" },
    ],
    observations: [
      { id: "obs-1", display: "Blood Pressure", value: "142/88", unit: "mmHg", date: "2026-01-15", category: "Vital Signs" },
      { id: "obs-2", display: "HbA1c", value: "7.8", unit: "%", date: "2026-01-10", category: "Laboratory" },
      { id: "obs-3", display: "eGFR", value: "45", unit: "mL/min/1.73m2", date: "2026-01-10", category: "Laboratory" },
      { id: "obs-4", display: "LDL Cholesterol", value: "118", unit: "mg/dL", date: "2026-01-10", category: "Laboratory" },
      { id: "obs-5", display: "Weight", value: "210", unit: "lbs", date: "2026-01-15", category: "Vital Signs" },
      { id: "obs-6", display: "Serum Creatinine", value: "1.6", unit: "mg/dL", date: "2026-01-10", category: "Laboratory" },
    ],
    allergies: [
      { id: "allergy-1", display: "Penicillin", severity: "moderate", reaction: "Rash" },
      { id: "allergy-2", display: "Sulfa drugs", severity: "severe", reaction: "Anaphylaxis" },
    ],
    encounters: [
      { id: "enc-1", type: "Office Visit", date: "2026-01-15", provider: "Dr. Johnson", reason: "Diabetes follow-up" },
      { id: "enc-2", type: "Lab Visit", date: "2026-01-10", provider: "Quest Diagnostics", reason: "Routine labs" },
      { id: "enc-3", type: "Telehealth", date: "2025-12-20", provider: "Dr. Johnson", reason: "Medication review" },
    ],
    procedures: [
      { id: "proc-1", display: "Diabetic Eye Exam", date: "2025-11-15", status: "completed" },
      { id: "proc-2", display: "Nephrology Consultation", date: "2026-01-08", status: "completed" },
    ],
    carePlanGoals: [
      { id: "goal-1", description: "Reduce HbA1c to below 7%", status: "in-progress", targetDate: "2026-06-01" },
      { id: "goal-2", description: "Blood pressure control <140/90", status: "in-progress", targetDate: "2026-03-01" },
      { id: "goal-3", description: "Weight loss of 10 lbs", status: "in-progress", targetDate: "2026-06-01" },
    ],
  },
  "patient-002": {
    demographics: { name: "Mary Johnson", dob: "1978-08-22", gender: "Female", mrn: "MRN-67890" },
    conditions: [
      { id: "cond-1", display: "Asthma", status: "active", onsetDate: "2005-04-10", category: "Respiratory" },
      { id: "cond-2", display: "Generalized Anxiety Disorder", status: "active", onsetDate: "2019-09-15", category: "Mental Health" },
      { id: "cond-3", display: "Migraine without aura", status: "active", onsetDate: "2015-06-20", category: "Neurological" },
    ],
    medications: [
      { id: "med-1", display: "Fluticasone/Salmeterol", dosage: "250/50mcg", frequency: "twice daily", status: "active", startDate: "2020-02-01" },
      { id: "med-2", display: "Albuterol", dosage: "90mcg", frequency: "as needed", status: "active", startDate: "2005-04-15" },
      { id: "med-3", display: "Sertraline", dosage: "100mg", frequency: "once daily", status: "active", startDate: "2019-10-01" },
      { id: "med-4", display: "Sumatriptan", dosage: "50mg", frequency: "as needed for migraine", status: "active", startDate: "2015-07-01" },
    ],
    observations: [
      { id: "obs-1", display: "Blood Pressure", value: "118/76", unit: "mmHg", date: "2026-01-12", category: "Vital Signs" },
      { id: "obs-2", display: "Peak Flow", value: "420", unit: "L/min", date: "2026-01-12", category: "Respiratory" },
      { id: "obs-3", display: "PHQ-9 Score", value: "8", unit: "points", date: "2026-01-05", category: "Mental Health" },
      { id: "obs-4", display: "Heart Rate", value: "72", unit: "bpm", date: "2026-01-12", category: "Vital Signs" },
    ],
    allergies: [
      { id: "allergy-1", display: "NSAIDs", severity: "moderate", reaction: "GI upset" },
    ],
    encounters: [
      { id: "enc-1", type: "Office Visit", date: "2026-01-12", provider: "Dr. Williams", reason: "Asthma check" },
      { id: "enc-2", type: "Behavioral Health", date: "2026-01-05", provider: "Dr. Garcia", reason: "Anxiety follow-up" },
    ],
    procedures: [
      { id: "proc-1", display: "Spirometry", date: "2026-01-12", status: "completed" },
    ],
    carePlanGoals: [
      { id: "goal-1", description: "Reduce rescue inhaler use to <2x/week", status: "achieved", targetDate: "2026-01-01" },
      { id: "goal-2", description: "PHQ-9 score <5", status: "in-progress", targetDate: "2026-04-01" },
    ],
  },
};

function getPatientFHIRData(patientId: string): typeof SAMPLE_PATIENT_DATA["patient-001"] | undefined {
  return SAMPLE_PATIENT_DATA[patientId];
}

function aggregateFHIRResources(patientData: typeof SAMPLE_PATIENT_DATA["patient-001"], timeframeDays: number): FHIRResourceSummary[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  const summaries: FHIRResourceSummary[] = [];

  summaries.push({
    resourceType: "Condition",
    count: patientData.conditions.length,
    items: patientData.conditions.map((c) => ({
      id: c.id,
      display: c.display,
      date: c.onsetDate,
      status: c.status,
      category: c.category,
    })),
  });

  summaries.push({
    resourceType: "MedicationStatement",
    count: patientData.medications.length,
    items: patientData.medications.map((m) => ({
      id: m.id,
      display: `${m.display} ${m.dosage} ${m.frequency}`,
      date: m.startDate,
      status: m.status,
    })),
  });

  summaries.push({
    resourceType: "Observation",
    count: patientData.observations.length,
    items: patientData.observations.map((o) => ({
      id: o.id,
      display: `${o.display}: ${o.value} ${o.unit}`,
      date: o.date,
      category: o.category,
    })),
  });

  summaries.push({
    resourceType: "AllergyIntolerance",
    count: patientData.allergies.length,
    items: patientData.allergies.map((a) => ({
      id: a.id,
      display: `${a.display} (${a.severity}) - ${a.reaction}`,
      status: a.severity,
    })),
  });

  summaries.push({
    resourceType: "Encounter",
    count: patientData.encounters.length,
    items: patientData.encounters.map((e) => ({
      id: e.id,
      display: `${e.type}: ${e.reason}`,
      date: e.date,
      category: e.provider,
    })),
  });

  summaries.push({
    resourceType: "Procedure",
    count: patientData.procedures.length,
    items: patientData.procedures.map((p) => ({
      id: p.id,
      display: p.display,
      date: p.date,
      status: p.status,
    })),
  });

  summaries.push({
    resourceType: "Goal",
    count: patientData.carePlanGoals.length,
    items: patientData.carePlanGoals.map((g) => ({
      id: g.id,
      display: g.description,
      date: g.targetDate,
      status: g.status,
    })),
  });

  return summaries;
}

function identifyRecentUpdates(patientData: typeof SAMPLE_PATIENT_DATA["patient-001"], timeframeDays: number): RecentUpdate[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  const updates: RecentUpdate[] = [];

  patientData.observations.forEach((o) => {
    const obsDate = new Date(o.date);
    if (obsDate >= cutoffDate) {
      updates.push({
        date: o.date,
        resourceType: "Observation",
        description: `${o.display}: ${o.value} ${o.unit}`,
        isNew: obsDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
    }
  });

  patientData.encounters.forEach((e) => {
    const encDate = new Date(e.date);
    if (encDate >= cutoffDate) {
      updates.push({
        date: e.date,
        resourceType: "Encounter",
        description: `${e.type} with ${e.provider}: ${e.reason}`,
        isNew: encDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
    }
  });

  patientData.procedures.forEach((p) => {
    const procDate = new Date(p.date);
    if (procDate >= cutoffDate) {
      updates.push({
        date: p.date,
        resourceType: "Procedure",
        description: p.display,
        isNew: procDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
    }
  });

  return updates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function buildDataContext(patientData: typeof SAMPLE_PATIENT_DATA["patient-001"]): string {
  const lines: string[] = [];

  lines.push(`PATIENT DEMOGRAPHICS:`);
  lines.push(`- Name: ${patientData.demographics.name}`);
  lines.push(`- Date of Birth: ${patientData.demographics.dob}`);
  lines.push(`- Gender: ${patientData.demographics.gender}`);
  lines.push(`- MRN: ${patientData.demographics.mrn}`);
  lines.push("");

  lines.push(`ACTIVE CONDITIONS (${patientData.conditions.length}):`);
  patientData.conditions.forEach((c) => {
    lines.push(`- ${c.display} (${c.status}, onset: ${c.onsetDate}, category: ${c.category})`);
  });
  lines.push("");

  lines.push(`CURRENT MEDICATIONS (${patientData.medications.length}):`);
  patientData.medications.forEach((m) => {
    lines.push(`- ${m.display} ${m.dosage} ${m.frequency} (${m.status}, started: ${m.startDate})`);
  });
  lines.push("");

  lines.push(`ALLERGIES (${patientData.allergies.length}):`);
  patientData.allergies.forEach((a) => {
    lines.push(`- ${a.display}: ${a.reaction} (severity: ${a.severity})`);
  });
  lines.push("");

  lines.push(`RECENT OBSERVATIONS (${patientData.observations.length}):`);
  patientData.observations.forEach((o) => {
    lines.push(`- ${o.display}: ${o.value} ${o.unit} (${o.date}, category: ${o.category})`);
  });
  lines.push("");

  lines.push(`RECENT ENCOUNTERS (${patientData.encounters.length}):`);
  patientData.encounters.forEach((e) => {
    lines.push(`- ${e.date}: ${e.type} with ${e.provider} - ${e.reason}`);
  });
  lines.push("");

  lines.push(`PROCEDURES (${patientData.procedures.length}):`);
  patientData.procedures.forEach((p) => {
    lines.push(`- ${p.display} (${p.date}, ${p.status})`);
  });
  lines.push("");

  lines.push(`CARE PLAN GOALS (${patientData.carePlanGoals.length}):`);
  patientData.carePlanGoals.forEach((g) => {
    lines.push(`- ${g.description} (${g.status}, target: ${g.targetDate})`);
  });

  return lines.join("\n");
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

async function generateAISummary(
  patientData: typeof SAMPLE_PATIENT_DATA["patient-001"],
  role: CareTeamRole,
  summaryLength: SummaryLength = "standard",
  focusAreas?: string[],
  dataQualityFlags?: DataQualityFlag[]
): Promise<{ summary: string; sections: PatientSummarySection[]; attentionAreas: AttentionArea[] }> {
  const client = getOpenAIClient();
  const dataContext = buildDataContext(patientData);
  const lengthConfig = SUMMARY_LENGTH_CONFIGS[summaryLength];

  const focusPrompt = focusAreas && focusAreas.length > 0
    ? `\nFocus especially on: ${focusAreas.join(", ")}`
    : "";

  const dataQualityContext = dataQualityFlags && dataQualityFlags.length > 0
    ? `\n\nDATA QUALITY FLAGS (${dataQualityFlags.length} issue(s) detected):
${dataQualityFlags.map(f => `- [${f.severity.toUpperCase()}] ${f.resourceType}: ${f.issue}`).join("\n")}
Include a note about these data quality issues in your summary if they are critical or high severity.`
    : "";

  const systemPrompt = `${ROLE_PROMPTS[role]}

${NO_CDS_GUARDRAIL}

SUMMARY LENGTH REQUIREMENT:
${lengthConfig.detailLevel}
Maximum sections: ${lengthConfig.sectionLimit}

You will receive patient health record data. Generate a structured summary with the following JSON format:
{
  "summary": "Overall summary of the patient's current health status",
  "sections": [
    {
      "title": "Section title",
      "content": "Section content",
      "priority": "high|medium|low"
    }
  ],
  "attentionAreas": [
    {
      "title": "Area title",
      "description": "Description of what was documented in this area",
      "relatedResources": ["Resource types involved"],
      "note": "Information presented exactly as documented in the medical record"
    }
  ]
}

Important:
- Attention areas must describe what IS DOCUMENTED, not clinical concerns
- Do not make clinical judgments or recommendations
- Use professional medical terminology appropriate for the role
- Keep each section concise and actionable for the specific role${focusPrompt}${dataQualityContext}`;

  if (!client) {
    return {
      summary: `Patient ${patientData.demographics.name} (${patientData.demographics.gender}, DOB: ${patientData.demographics.dob}) has ${patientData.conditions.length} active conditions and is on ${patientData.medications.length} medications. Recent encounters include ${patientData.encounters.length} visits. This is a fallback summary as AI generation is not available.`,
      sections: [
        {
          title: "Active Conditions",
          content: patientData.conditions.map((c) => c.display).join(", "),
          priority: "high",
        },
        {
          title: "Current Medications",
          content: patientData.medications.map((m) => `${m.display} ${m.dosage}`).join(", "),
          priority: "medium",
        },
        {
          title: "Allergies",
          content: patientData.allergies.map((a) => `${a.display} (${a.severity})`).join(", "),
          priority: "high",
        },
      ],
      attentionAreas: [
        {
          title: "Recent Laboratory Results",
          description: "New laboratory results have been documented.",
          relatedResources: ["Observation"],
          note: "Information presented exactly as documented in the medical record.",
        },
      ],
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataContext },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: lengthConfig.maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "Summary generation incomplete.",
      sections: parsed.sections || [],
      attentionAreas: parsed.attentionAreas || [],
    };
  } catch (e) {
    console.error("[PatientSummaryGenerator] AI generation error:", e);
    return {
      summary: `Patient ${patientData.demographics.name} has ${patientData.conditions.length} documented conditions and ${patientData.medications.length} active medications.`,
      sections: [
        {
          title: "Conditions",
          content: patientData.conditions.map((c) => c.display).join(", "),
          priority: "high" as const,
        },
        {
          title: "Medications",
          content: patientData.medications.map((m) => `${m.display} ${m.dosage}`).join(", "),
          priority: "medium" as const,
        },
      ],
      attentionAreas: [],
    };
  }
}

export async function generatePatientSummary(
  request: PatientSummaryRequest,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<PatientSummary> {
  const { 
    patientId, 
    role, 
    focusAreas, 
    includeRecentUpdates = true, 
    timeframeDays = 30,
    summaryLength = "standard",
    includeDataQualityFlags = true,
    includeActionableInsights = true,
  } = request;

  const patientData = getPatientFHIRData(patientId);
  if (!patientData) {
    throw new Error(`Patient ${patientId} not found`);
  }

  const sourceResources = aggregateFHIRResources(patientData, timeframeDays);
  const recentUpdates = includeRecentUpdates ? identifyRecentUpdates(patientData, timeframeDays) : [];
  
  const dataQualityFlags = includeDataQualityFlags ? detectDataQualityFlags(patientId) : [];
  const actionableInsights = includeActionableInsights ? generateActionableInsights(patientData, timeframeDays) : [];
  
  const { summary, sections, attentionAreas } = await generateAISummary(
    patientData, 
    role, 
    summaryLength,
    focusAreas,
    dataQualityFlags
  );

  const patientSummary: PatientSummary = {
    id: generateId(),
    patientId: "[REDACTED]",
    role,
    summaryLength,
    generatedAt: new Date().toISOString(),
    summary,
    sections,
    recentUpdates,
    attentionAreas,
    dataQualityFlags,
    actionableInsights,
    sourceResources,
    disclaimer: "This AI-generated summary is for informational purposes only and does not constitute clinical advice. All clinical decisions must be made by qualified healthcare professionals based on their clinical judgment and direct patient assessment.",
  };

  const history = summaryHistory.get(patientId) || [];
  history.push(patientSummary);
  if (history.length > 10) history.shift();
  summaryHistory.set(patientId, history);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[SYSTEM]",
      userRole: role,
      action: "read",
      resourceType: "PatientSummary",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/patient-summary/generate",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        summaryRole: role,
        summaryLength,
        resourceCount: sourceResources.reduce((sum, r) => sum + r.count, 0),
        focusAreas: focusAreas?.join(",") || "none",
        dataQualityFlagsCount: dataQualityFlags.length,
        actionableInsightsCount: actionableInsights.length,
      },
    });
  } catch (e) {
    console.error("[PatientSummaryGenerator] Audit logging failed:", e);
  }

  return patientSummary;
}

export function getSummaryHistory(patientId: string): PatientSummary[] {
  return summaryHistory.get(patientId) || [];
}

export function getAvailablePatients(): Array<{ id: string; name: string; mrn: string }> {
  return Object.entries(SAMPLE_PATIENT_DATA).map(([id, data]) => ({
    id,
    name: data.demographics.name,
    mrn: data.demographics.mrn,
  }));
}

export function getSupportedRoles(): CareTeamRole[] {
  return ["physician", "nurse", "care_coordinator", "pharmacist", "specialist"];
}

console.log("[PatientSummaryGenerator] Service initialized");
