import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";
import { checkGovernanceCompliance, getDocumentTypes, generateDocument } from "./ai-document-generation-service";
import type { DocumentGenerationRequest, GeneratedDocument } from "./ai-document-generation-service";

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated content is for informational and operational purposes only. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.";

function auditLog(action: string, userId: string, patientId?: string, details?: string) {
  logPhiAccess({
    userId,
    patientId: patientId || "N/A",
    resourceType: "AIProviderAssistant",
    action: action.includes("GENERAT") || action.includes("SUMMARIZ") ? "write" : "read",
    details: `[ProviderAssistant] ${action}: ${details || "N/A"}`,
  });
}

export interface ProactiveSuggestion {
  id: string;
  category: "documentation" | "clinical-review" | "follow-up" | "data-quality" | "workflow";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionType: "generate-document" | "summarize" | "review" | "navigate" | "info";
  actionPayload?: Record<string, string>;
  relevantTab?: string;
  aiGenerated: boolean;
}

export interface SummarizeRequest {
  patientId: string;
  patientName: string;
  userId: string;
  selectedDataPoints: SelectedDataPoint[];
  summaryType: "clinical-note" | "progress-update" | "handoff-summary" | "brief-overview";
  additionalInstructions?: string;
}

export interface SelectedDataPoint {
  category: "condition" | "medication" | "vital" | "allergy" | "lab" | "record" | "family-history" | "lifestyle";
  id: string;
  label: string;
  value?: string;
  date?: string;
}

export interface SummarizeResult {
  id: string;
  patientId: string;
  patientName: string;
  summaryType: string;
  content: string;
  dataPointsUsed: number;
  generatedAt: string;
  confidenceScore: number;
  noCdsDisclaimer: string;
  governanceStatus: string;
}

export interface QuickDocumentRequest {
  patientId: string;
  patientName: string;
  userId: string;
  documentTypeId: string;
  selectedDataPoints?: SelectedDataPoint[];
  additionalContext?: Record<string, string>;
}

const samplePatientData: Record<string, {
  conditions: Array<{ name: string; status: string; onset: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  vitals: Array<{ type: string; value: string; unit: string; date: string; status: string }>;
  allergies: Array<{ substance: string; reaction: string; severity: string }>;
  recentLabs: Array<{ name: string; value: string; unit: string; date: string; status: string }>;
}> = {
  "1": {
    conditions: [
      { name: "Type 2 Diabetes Mellitus", status: "active", onset: "2020-03-15" },
      { name: "Essential Hypertension", status: "active", onset: "2019-07-22" },
      { name: "Hyperlipidemia", status: "active", onset: "2021-01-10" },
    ],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "twice daily" },
      { name: "Lisinopril", dosage: "20mg", frequency: "once daily" },
      { name: "Atorvastatin", dosage: "40mg", frequency: "once daily at bedtime" },
    ],
    vitals: [
      { type: "Blood Pressure", value: "142/88", unit: "mmHg", date: "2026-02-20", status: "warning" },
      { type: "Heart Rate", value: "78", unit: "bpm", date: "2026-02-20", status: "normal" },
      { type: "Blood Glucose", value: "185", unit: "mg/dL", date: "2026-02-20", status: "warning" },
      { type: "Weight", value: "198", unit: "lbs", date: "2026-02-20", status: "normal" },
      { type: "Temperature", value: "98.6", unit: "°F", date: "2026-02-20", status: "normal" },
    ],
    allergies: [
      { substance: "Penicillin", reaction: "Hives, rash", severity: "moderate" },
      { substance: "Sulfa drugs", reaction: "GI upset", severity: "mild" },
    ],
    recentLabs: [
      { name: "HbA1c", value: "7.8", unit: "%", date: "2026-02-15", status: "warning" },
      { name: "LDL Cholesterol", value: "128", unit: "mg/dL", date: "2026-02-15", status: "warning" },
      { name: "Creatinine", value: "1.1", unit: "mg/dL", date: "2026-02-15", status: "normal" },
      { name: "eGFR", value: "82", unit: "mL/min", date: "2026-02-15", status: "normal" },
      { name: "TSH", value: "2.4", unit: "mIU/L", date: "2026-02-15", status: "normal" },
    ],
  },
};

function getPatientData(patientId: string) {
  return samplePatientData[patientId] || samplePatientData["1"];
}

export function getProactiveSuggestions(patientId: string, activeTab: string, userId: string): ProactiveSuggestion[] {
  auditLog("SUGGESTIONS_REQUESTED", userId, patientId, `Tab: ${activeTab}`);

  const data = getPatientData(patientId);
  const suggestions: ProactiveSuggestion[] = [];

  const warningVitals = data.vitals.filter(v => v.status === "warning" || v.status === "critical");
  if (warningVitals.length > 0) {
    suggestions.push({
      id: `sug-vitals-${Date.now()}`,
      category: "clinical-review",
      priority: "high",
      title: `${warningVitals.length} abnormal vital sign(s) detected`,
      description: `Review: ${warningVitals.map(v => `${v.type} (${v.value} ${v.unit})`).join(", ")}. Consider generating a progress note.`,
      actionType: "generate-document",
      actionPayload: { documentTypeId: "progress-note" },
      relevantTab: "vitals",
      aiGenerated: true,
    });
  }

  const warningLabs = data.recentLabs.filter(l => l.status === "warning" || l.status === "critical");
  if (warningLabs.length > 0) {
    suggestions.push({
      id: `sug-labs-${Date.now()}`,
      category: "documentation",
      priority: "high",
      title: `${warningLabs.length} lab result(s) outside normal range`,
      description: `Abnormal results: ${warningLabs.map(l => `${l.name}: ${l.value} ${l.unit}`).join(", ")}. Generate a lab report explanation for the patient.`,
      actionType: "generate-document",
      actionPayload: { documentTypeId: "lab-report-explanation" },
      relevantTab: "records",
      aiGenerated: true,
    });
  }

  if (data.conditions.length > 2 && data.medications.length > 2) {
    suggestions.push({
      id: `sug-summary-${Date.now()}`,
      category: "documentation",
      priority: "medium",
      title: "Complex patient — consider a summary",
      description: `Patient has ${data.conditions.length} active conditions and ${data.medications.length} medications. Generate a comprehensive patient summary for care coordination.`,
      actionType: "generate-document",
      actionPayload: { documentTypeId: "patient-summary" },
      aiGenerated: true,
    });
  }

  if (activeTab === "medications" && data.medications.length >= 3) {
    suggestions.push({
      id: `sug-med-review-${Date.now()}`,
      category: "clinical-review",
      priority: "medium",
      title: "Medication reconciliation opportunity",
      description: `Patient is on ${data.medications.length} medications. Consider reviewing for potential interactions and generating a medication summary.`,
      actionType: "summarize",
      aiGenerated: true,
    });
  }

  if (activeTab === "records") {
    suggestions.push({
      id: `sug-note-summary-${Date.now()}`,
      category: "workflow",
      priority: "low",
      title: "Summarize recent records",
      description: "Select records to generate a consolidated clinical summary for handoff or documentation.",
      actionType: "summarize",
      aiGenerated: true,
    });
  }

  if (data.allergies.length > 0) {
    suggestions.push({
      id: `sug-allergy-${Date.now()}`,
      category: "data-quality",
      priority: "low",
      title: "Allergy documentation check",
      description: `${data.allergies.length} allergies documented. Ensure allergy information is current in referral letters or prescriptions.`,
      actionType: "info",
      aiGenerated: true,
    });
  }

  if (activeTab === "vitals" || activeTab === "records") {
    suggestions.push({
      id: `sug-care-plan-${Date.now()}`,
      category: "follow-up",
      priority: "medium",
      title: "Care plan update may be needed",
      description: "Based on recent vitals and lab trends, consider updating the patient's care plan and generating a care plan letter.",
      actionType: "generate-document",
      actionPayload: { documentTypeId: "care-plan-letter" },
      aiGenerated: true,
    });
  }

  return suggestions;
}

export async function summarizeSelectedData(request: SummarizeRequest): Promise<SummarizeResult> {
  auditLog("SUMMARIZE_STARTED", request.userId, request.patientId, `Type: ${request.summaryType}, Data points: ${request.selectedDataPoints.length}`);

  const governance = checkGovernanceCompliance();
  if (!governance.approved) {
    auditLog("SUMMARIZE_BLOCKED", request.userId, request.patientId, `Governance check failed: ${governance.details}`);
    throw new Error(`Governance check failed: ${governance.details}`);
  }

  const groupedData: Record<string, SelectedDataPoint[]> = {};
  for (const dp of request.selectedDataPoints) {
    if (!groupedData[dp.category]) groupedData[dp.category] = [];
    groupedData[dp.category].push(dp);
  }

  const dataDescription = Object.entries(groupedData)
    .map(([cat, points]) => {
      const items = points.map(p => `- ${p.label}${p.value ? `: ${p.value}` : ""}${p.date ? ` (${p.date})` : ""}`).join("\n");
      return `**${cat.charAt(0).toUpperCase() + cat.slice(1)}:**\n${items}`;
    })
    .join("\n\n");

  const summaryTypePrompts: Record<string, string> = {
    "clinical-note": "Generate a structured clinical note based on the selected data points. Use SOAP format (Subjective, Objective, Assessment, Plan) where appropriate. Include relevant clinical codes (ICD-10, CPT) when applicable.",
    "progress-update": "Generate a concise progress update summarizing the patient's current status based on the selected data points. Highlight any changes, improvements, or concerns.",
    "handoff-summary": "Generate a care handoff summary (SBAR format: Situation, Background, Assessment, Recommendation) based on the selected data points. This is for provider-to-provider communication.",
    "brief-overview": "Generate a brief clinical overview (2-3 paragraphs) based on the selected data points. Focus on the most clinically relevant findings and any actionable items.",
  };

  const prompt = `You are a clinical documentation assistant for healthcare providers.

Patient: ${request.patientName} (ID: ${request.patientId})

Task: ${summaryTypePrompts[request.summaryType] || summaryTypePrompts["brief-overview"]}

${request.additionalInstructions ? `Additional Instructions: ${request.additionalInstructions}\n` : ""}
Selected Clinical Data:
${dataDescription}

Requirements:
- Use professional medical terminology appropriate for provider documentation
- Reference specific values and dates from the data provided
- Maintain clinical accuracy and completeness
- Do not fabricate data not provided
- Include relevant clinical context
- This is NOT clinical decision support — it is documentation assistance only`;

  let content: string;

  try {
    content = await generatePhiSafeText({
      system: "You are a HIPAA-compliant clinical documentation assistant. Generate professional medical summaries based on selected patient data. Never fabricate data. Always include relevant clinical context. Output is for provider review only, not clinical decision support.",
      user: prompt,
      temperature: 0.3,
      maxTokens: 2000,
    }) || "";
    if (!content.trim()) {
      content = generateFallbackSummary(request);
    }
  } catch (error) {
    content = generateFallbackSummary(request);
  }

  content += `\n\n---\n${NO_CDS_DISCLAIMER}`;

  const result: SummarizeResult = {
    id: `sum-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    patientId: request.patientId,
    patientName: request.patientName,
    summaryType: request.summaryType,
    content,
    dataPointsUsed: request.selectedDataPoints.length,
    generatedAt: new Date().toISOString(),
    confidenceScore: 0.85,
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
    governanceStatus: governance.integrationStatus,
  };

  auditLog("SUMMARIZE_COMPLETED", request.userId, request.patientId, `Summary ID: ${result.id}, Type: ${request.summaryType}`);

  return result;
}

function generateFallbackSummary(request: SummarizeRequest): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const groupedData: Record<string, SelectedDataPoint[]> = {};
  for (const dp of request.selectedDataPoints) {
    if (!groupedData[dp.category]) groupedData[dp.category] = [];
    groupedData[dp.category].push(dp);
  }

  let summary = `**${request.summaryType === "clinical-note" ? "Clinical Note" : request.summaryType === "progress-update" ? "Progress Update" : request.summaryType === "handoff-summary" ? "Handoff Summary" : "Clinical Overview"}**\n`;
  summary += `Patient: ${request.patientName}\nDate: ${date}\n\n`;

  for (const [category, points] of Object.entries(groupedData)) {
    summary += `**${category.charAt(0).toUpperCase() + category.slice(1).replace("-", " ")}:**\n`;
    for (const point of points) {
      summary += `- ${point.label}`;
      if (point.value) summary += `: ${point.value}`;
      if (point.date) summary += ` (${point.date})`;
      summary += "\n";
    }
    summary += "\n";
  }

  summary += `\n*Summary generated from ${request.selectedDataPoints.length} selected data points. AI-enhanced summary not available; structured data presented for provider review.*`;

  return summary;
}

export async function quickGenerateDocument(request: QuickDocumentRequest): Promise<GeneratedDocument> {
  auditLog("QUICK_DOC_STARTED", request.userId, request.patientId, `Type: ${request.documentTypeId}`);

  const context: Record<string, string> = {
    patientName: request.patientName,
    ...(request.additionalContext || {}),
  };

  if (request.selectedDataPoints && request.selectedDataPoints.length > 0) {
    const groupedData: Record<string, string[]> = {};
    for (const dp of request.selectedDataPoints) {
      if (!groupedData[dp.category]) groupedData[dp.category] = [];
      groupedData[dp.category].push(`${dp.label}${dp.value ? `: ${dp.value}` : ""}${dp.date ? ` (${dp.date})` : ""}`);
    }

    if (groupedData.condition) context.conditions = groupedData.condition.join("; ");
    if (groupedData.medication) context.currentMedications = groupedData.medication.join("; ");
    if (groupedData.vital) context.vitalSigns = groupedData.vital.join("; ");
    if (groupedData.allergy) context.allergies = groupedData.allergy.join("; ");
    if (groupedData.lab) context.labTests = groupedData.lab.join("; ");
    if (groupedData["family-history"]) context.familyHistory = groupedData["family-history"].join("; ");

    if (request.documentTypeId === "patient-summary") {
      context.summaryPeriod = "Last 6 months";
    }
    if (request.documentTypeId === "referral-letter") {
      context.referringProvider = context.referringProvider || "Attending Provider";
      context.referredToProvider = context.referredToProvider || "[Specialist Name]";
      context.reasonForReferral = context.reasonForReferral || groupedData.condition?.[0] || "Clinical evaluation";
    }
    if (request.documentTypeId === "lab-report-explanation") {
      context.labTests = context.labTests || groupedData.lab?.join("; ") || "Recent laboratory results";
    }
  }

  const docRequest: DocumentGenerationRequest = {
    documentTypeId: request.documentTypeId,
    context,
    userId: request.userId,
    patientId: request.patientId,
    patientName: request.patientName,
  };

  const draft = await generateDocument(docRequest);

  auditLog("QUICK_DOC_COMPLETED", request.userId, request.patientId, `Draft ID: ${draft.id}, Type: ${request.documentTypeId}`);

  return draft;
}

export function getAvailableDocumentTypes() {
  return getDocumentTypes().map(dt => ({
    id: dt.id,
    name: dt.name,
    description: dt.description,
    category: dt.category,
  }));
}
