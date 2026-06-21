import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data analyst assistant that helps clinicians with documentation, data quality, and patient education. 

STRICT NO-CDS COMPLIANCE RULES:
- You MUST NOT provide clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT triage patients or suggest urgency levels for clinical conditions
- You MUST NOT interpret lab results or vitals clinically
- You MUST NOT suggest specific tests, medications, or procedures
- You CAN identify documentation gaps, missing data, and data quality issues
- You CAN suggest general educational materials (not treatment-specific)
- You CAN aggregate and summarize data for visibility
- You CAN identify workflow efficiency opportunities

PROHIBITED OUTPUT:
Do not use phrases like: "you should", "you need to", "go to the ER", "urgent", "this indicates you have", "likely", "treatment", "start/stop/take", "get an MRI/CT/colonoscopy", "overdue", "safe/unsafe", "interacts with".

If asked for advice, respond:
"I can explain what the record says, but I can't provide medical advice. Consider contacting your clinician."

Every response MUST include the disclaimer: "Data quality insights only. Not clinical advice. Clinical decisions require provider evaluation."`;

export interface PatientDataSummary {
  patient_id: string;
  patient_name: string;
  vitals: VitalReading[];
  labs: LabResult[];
  documents: DocumentRecord[];
  messages: MessageRecord[];
}

export interface VitalReading {
  type: string;
  value: string;
  unit: string;
  date: string;
  source: string;
}

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  date: string;
  source: string;
}

export interface DocumentRecord {
  type: string;
  title: string;
  date: string;
  source: string;
  has_been_reviewed: boolean;
}

export interface MessageRecord {
  from: string;
  subject: string;
  date: string;
  is_read: boolean;
  priority: "normal" | "high";
}

export interface CopilotInsight {
  id: string;
  category: "documentation_gap" | "data_quality" | "education_opportunity" | "workflow_efficiency" | "pending_review";
  severity: "info" | "attention" | "needs_review";
  title: string;
  description: string;
  affected_patient_id?: string;
  affected_patient_name?: string;
  suggested_action?: string;
  education_material_id?: string;
  data_source: string;
  created_at: string;
}

export interface CopilotDashboardData {
  total_patients_analyzed: number;
  insights: CopilotInsight[];
  summary: {
    documentation_gaps: number;
    data_quality_issues: number;
    education_opportunities: number;
    workflow_items: number;
    pending_reviews: number;
  };
  disclaimer: string;
}

const EDUCATION_MATERIALS = [
  { id: "edu-bp", topic: "Blood Pressure Understanding", category: "vitals" },
  { id: "edu-glucose", topic: "Understanding Blood Sugar Levels", category: "labs" },
  { id: "edu-cholesterol", topic: "Cholesterol Basics", category: "labs" },
  { id: "edu-kidney", topic: "Kidney Health Markers", category: "labs" },
  { id: "edu-medication", topic: "Medication Adherence", category: "general" },
  { id: "edu-preventive", topic: "Preventive Care Schedule", category: "general" },
  { id: "edu-nutrition", topic: "Nutrition Basics", category: "general" },
  { id: "edu-exercise", topic: "Physical Activity Guidelines", category: "general" },
];

function generateId(): string {
  return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function analyzeDocumentationGaps(patients: PatientDataSummary[]): CopilotInsight[] {
  const insights: CopilotInsight[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const patient of patients) {
    const recentVitals = patient.vitals.filter(v => new Date(v.date) > thirtyDaysAgo);
    if (recentVitals.length === 0 && patient.vitals.length > 0) {
      insights.push({
        id: generateId(),
        category: "documentation_gap",
        severity: "attention",
        title: "No recent vital signs documented",
        description: `Patient ${patient.patient_name} has no vital signs recorded in the last 30 days. Last recorded: ${patient.vitals[0]?.date || 'unknown'}`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        suggested_action: "Consider documenting current vital signs at next encounter",
        data_source: "Vitals Analysis",
        created_at: now.toISOString()
      });
    }

    const unreadMessages = patient.messages.filter(m => !m.is_read);
    if (unreadMessages.length > 0) {
      insights.push({
        id: generateId(),
        category: "pending_review",
        severity: "needs_review",
        title: `${unreadMessages.length} unread message(s)`,
        description: `Patient ${patient.patient_name} has ${unreadMessages.length} unread message(s) pending review`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        suggested_action: "Review pending messages",
        data_source: "Messages",
        created_at: now.toISOString()
      });
    }

    const unreviewedDocs = patient.documents.filter(d => !d.has_been_reviewed);
    if (unreviewedDocs.length > 0) {
      insights.push({
        id: generateId(),
        category: "pending_review",
        severity: "attention",
        title: `${unreviewedDocs.length} document(s) pending review`,
        description: `Patient ${patient.patient_name} has ${unreviewedDocs.length} document(s) that have not been marked as reviewed`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        suggested_action: "Review and acknowledge documents",
        data_source: "Documents",
        created_at: now.toISOString()
      });
    }
  }

  return insights;
}

function analyzeDataQuality(patients: PatientDataSummary[]): CopilotInsight[] {
  const insights: CopilotInsight[] = [];
  const now = new Date();

  for (const patient of patients) {
    for (const lab of patient.labs) {
      if (!lab.reference_range || lab.reference_range === "" || lab.reference_range === "N/A") {
        insights.push({
          id: generateId(),
          category: "data_quality",
          severity: "info",
          title: "Missing reference range",
          description: `Lab result "${lab.name}" for ${patient.patient_name} is missing a reference range`,
          affected_patient_id: patient.patient_id,
          affected_patient_name: patient.patient_name,
          suggested_action: "Verify reference range with lab source",
          data_source: lab.source,
          created_at: now.toISOString()
        });
      }

      if (!lab.unit || lab.unit === "") {
        insights.push({
          id: generateId(),
          category: "data_quality",
          severity: "info",
          title: "Missing unit of measurement",
          description: `Lab result "${lab.name}" for ${patient.patient_name} is missing unit of measurement`,
          affected_patient_id: patient.patient_id,
          affected_patient_name: patient.patient_name,
          suggested_action: "Verify unit with lab source",
          data_source: lab.source,
          created_at: now.toISOString()
        });
      }
    }

    for (const vital of patient.vitals) {
      if (!vital.unit || vital.unit === "") {
        insights.push({
          id: generateId(),
          category: "data_quality",
          severity: "info",
          title: "Missing vital sign unit",
          description: `Vital "${vital.type}" for ${patient.patient_name} is missing unit of measurement`,
          affected_patient_id: patient.patient_id,
          affected_patient_name: patient.patient_name,
          data_source: vital.source,
          created_at: now.toISOString()
        });
      }
    }
  }

  return insights;
}

function identifyEducationOpportunities(patients: PatientDataSummary[]): CopilotInsight[] {
  const insights: CopilotInsight[] = [];
  const now = new Date();

  for (const patient of patients) {
    const labTypes = patient.labs.map(l => l.name.toLowerCase());
    
    if (labTypes.some(t => t.includes("glucose") || t.includes("hba1c") || t.includes("a1c"))) {
      insights.push({
        id: generateId(),
        category: "education_opportunity",
        severity: "info",
        title: "Blood sugar education available",
        description: `Patient ${patient.patient_name} has glucose-related lab results. General educational materials about blood sugar may be helpful.`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        education_material_id: "edu-glucose",
        suggested_action: "Consider sharing blood sugar educational content",
        data_source: "Labs Analysis",
        created_at: now.toISOString()
      });
    }

    if (labTypes.some(t => t.includes("cholesterol") || t.includes("ldl") || t.includes("hdl") || t.includes("triglyceride"))) {
      insights.push({
        id: generateId(),
        category: "education_opportunity",
        severity: "info",
        title: "Cholesterol education available",
        description: `Patient ${patient.patient_name} has lipid panel results. General educational materials about cholesterol may be helpful.`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        education_material_id: "edu-cholesterol",
        suggested_action: "Consider sharing cholesterol educational content",
        data_source: "Labs Analysis",
        created_at: now.toISOString()
      });
    }

    const vitalTypes = patient.vitals.map(v => v.type.toLowerCase());
    if (vitalTypes.some(t => t.includes("blood pressure") || t.includes("bp"))) {
      insights.push({
        id: generateId(),
        category: "education_opportunity",
        severity: "info",
        title: "Blood pressure education available",
        description: `Patient ${patient.patient_name} has blood pressure readings. General educational materials about blood pressure may be helpful.`,
        affected_patient_id: patient.patient_id,
        affected_patient_name: patient.patient_name,
        education_material_id: "edu-bp",
        suggested_action: "Consider sharing blood pressure educational content",
        data_source: "Vitals Analysis",
        created_at: now.toISOString()
      });
    }
  }

  return insights;
}

function analyzeWorkflowEfficiency(patients: PatientDataSummary[]): CopilotInsight[] {
  const insights: CopilotInsight[] = [];
  const now = new Date();

  const totalUnreadMessages = patients.reduce((sum, p) => sum + p.messages.filter(m => !m.is_read).length, 0);
  if (totalUnreadMessages > 10) {
    insights.push({
      id: generateId(),
      category: "workflow_efficiency",
      severity: "attention",
      title: "High volume of unread messages",
      description: `There are ${totalUnreadMessages} unread messages across your patient panel. Consider batch processing.`,
      suggested_action: "Review messages in priority order",
      data_source: "Messages Analysis",
      created_at: now.toISOString()
    });
  }

  const totalUnreviewedDocs = patients.reduce((sum, p) => sum + p.documents.filter(d => !d.has_been_reviewed).length, 0);
  if (totalUnreviewedDocs > 5) {
    insights.push({
      id: generateId(),
      category: "workflow_efficiency",
      severity: "attention",
      title: "Documents awaiting review",
      description: `There are ${totalUnreviewedDocs} documents across your patient panel that have not been reviewed.`,
      suggested_action: "Schedule time for document review",
      data_source: "Documents Analysis",
      created_at: now.toISOString()
    });
  }

  return insights;
}

export async function generateCopilotInsights(patients: PatientDataSummary[]): Promise<CopilotDashboardData> {
  const disclaimer = "Data quality insights only. Not clinical advice. Clinical decisions require provider evaluation.";

  const documentationGaps = analyzeDocumentationGaps(patients);
  const dataQualityIssues = analyzeDataQuality(patients);
  const educationOpportunities = identifyEducationOpportunities(patients);
  const workflowItems = analyzeWorkflowEfficiency(patients);

  const allInsights = [...documentationGaps, ...dataQualityIssues, ...educationOpportunities, ...workflowItems];

  allInsights.sort((a, b) => {
    const severityOrder: Record<string, number> = { needs_review: 0, attention: 1, info: 2 };
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });

  return {
    total_patients_analyzed: patients.length,
    insights: allInsights,
    summary: {
      documentation_gaps: documentationGaps.filter(i => i.category === "documentation_gap").length,
      data_quality_issues: dataQualityIssues.length,
      education_opportunities: educationOpportunities.length,
      workflow_items: workflowItems.length,
      pending_reviews: allInsights.filter(i => i.category === "pending_review").length,
    },
    disclaimer
  };
}

export async function generateAIEnhancedInsights(
  patients: PatientDataSummary[],
  targetLanguage: string = "en"
): Promise<CopilotDashboardData> {
  const baseInsights = await generateCopilotInsights(patients);
  
  if (!openai || patients.length === 0) {
    return baseInsights;
  }

  try {
    const patientSummaries = patients.map(p => ({
      id: p.patient_id,
      name: p.patient_name,
      vitals_count: p.vitals.length,
      labs_count: p.labs.length,
      documents_count: p.documents.length,
      unread_messages: p.messages.filter(m => !m.is_read).length,
      unreviewed_docs: p.documents.filter(d => !d.has_been_reviewed).length,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: NO_CDS_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Analyze this patient panel data and provide additional data quality and workflow insights. 
DO NOT provide any clinical recommendations.

PATIENT SUMMARIES:
${JSON.stringify(patientSummaries, null, 2)}

EXISTING INSIGHTS COUNT:
- Documentation gaps: ${baseInsights.summary.documentation_gaps}
- Data quality issues: ${baseInsights.summary.data_quality_issues}
- Pending reviews: ${baseInsights.summary.pending_reviews}

Provide a brief (2-3 sentence) workflow summary focusing on documentation completeness and data quality only.
Return JSON: {"workflow_summary": "...", "additional_notes": ["..."]}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        const aiData = JSON.parse(content);
        if (aiData.workflow_summary) {
          baseInsights.insights.unshift({
            id: generateId(),
            category: "workflow_efficiency",
            severity: "info",
            title: "Panel Overview",
            description: aiData.workflow_summary,
            data_source: "AI Analysis",
            created_at: new Date().toISOString()
          });
        }
      } catch {
        console.log("[HealthCopilot] AI response parse error, using base insights");
      }
    }
  } catch (error) {
    console.error("[HealthCopilot] AI enhancement error:", error);
  }

  return baseInsights;
}

export function getEducationMaterials() {
  return EDUCATION_MATERIALS;
}

export function dismissInsight(insightId: string): boolean {
  return true;
}

console.log("[HealthCopilot] Service initialized with NO-CDS compliance");
