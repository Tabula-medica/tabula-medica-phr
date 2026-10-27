import { type DataCategory } from "./third-party-data-governance";
import { logGCPOperation } from "./gcp-healthcare-client";
import { chatComplete, PolicyBlockedError } from "./ai-client";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const VERTEX_AI_ENABLED = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);

const DISCLAIMER = "AI-generated content. Must be reviewed by a licensed healthcare provider. This is not medical advice.";

interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface VertexAIResponse {
  content: string;
  model: string;
  provider: "vertex_ai" | "openai_fallback";
  auditId?: string;
  latencyMs: number;
  governanceCompliant: boolean;
}

interface SOAPNoteRequest {
  transcript?: string;
  structuredData: {
    vitals?: Array<{ type: string; value: number; unit: string; date: string; trend?: string }>;
    labResults?: Array<{ name: string; value: string; unit: string; date: string; referenceRange?: string; flag?: string }>;
    conditions?: string[];
    medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
    allergies?: string[];
    procedures?: string[];
    immunizations?: string[];
  };
  patientContext?: {
    age?: number;
    gender?: string;
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
  userId?: string;
}

interface SOAPNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icdSuggestions: Array<{ code: string; description: string; confidence: number }>;
  cptSuggestions: Array<{ code: string; description: string; confidence: number }>;
  qualityScore: number;
  provider: "vertex_ai" | "openai_fallback";
  disclaimer: string;
  auditTrail: {
    promptLogged: boolean;
    responseLogged: boolean;
    governanceCompliant: boolean;
    piiScrubbed: boolean;
  };
}

interface PatientSummaryRequest {
  fhirResources: {
    conditions?: Array<{ code: string; display: string; status: string; onsetDate?: string }>;
    medications?: Array<{ name: string; dosage?: string; status: string }>;
    appointments?: Array<{ date: string; provider?: string; type?: string; status: string }>;
    observations?: Array<{ code: string; display: string; value: string; unit?: string; date: string }>;
  };
  readingLevel?: "simple" | "detailed";
  userId?: string;
}

interface PatientSummaryResponse {
  summary: string;
  sections: {
    conditions: string;
    medications: string;
    upcomingAppointments: string;
    recentResults: string;
    actionItems: string;
  };
  readingLevel: string;
  provider: "vertex_ai" | "openai_fallback";
  disclaimer: string;
  piiScrubbed: boolean;
}

interface RAGContextRequest {
  query: string;
  selectedResources: Array<{
    resourceType: string;
    resourceId: string;
    data: any;
    dateRange?: { start: string; end: string };
  }>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}

interface RAGContextResponse {
  response: string;
  contextUsed: Array<{ resourceType: string; resourceId: string; relevanceScore: number }>;
  provider: "vertex_ai" | "openai_fallback";
  disclaimer: string;
  auditId?: string;
}

/**
 * Compatibility wrapper that routes through the unified AI adapter
 * (`chatComplete()` in `server/ai-client.ts`). The direct
 * `@google-cloud/vertexai` SDK usage that lived here was removed in Task
 * #108 — `chatComplete()` is now the only entry point for LLM calls and
 * the SDK choice / BAA routing / policy gate all live inside it. The
 * `config.projectId` / `config.location` / `config.model` inputs are no
 * longer honored (the adapter picks the model via the `deep` alias and
 * reads project/location from env); they are kept on the signature so
 * callers don't have to change.
 *
 * Failure mode change: this function no longer silently falls back to a
 * non-BAA OpenAI path on policy block or Vertex error. If the adapter
 * throws `PolicyBlockedError` we let it propagate (fail-closed); other
 * errors are logged and rethrown.
 */
export async function callVertexAI(
  config: VertexAIConfig,
  systemPrompt: string,
  userPrompt: string,
  dataCategories: DataCategory[],
  userId?: string,
  callerMethod: string = "vertexAI"
): Promise<VertexAIResponse> {
  const startTime = Date.now();

  try {
    const result = await chatComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deep",
      maxOutputTokens: config.maxOutputTokens || 8192,
      temperature: config.temperature,
      dataCategories,
      purpose: "documentation",
      callerService: "gcp-vertex-ai-service",
      callerMethod,
      userId,
    });

    logGCPOperation({
      timestamp: new Date(),
      operation: "search_resources",
      userId,
      projectId: config.projectId,
      location: config.location,
      success: true,
      metadata: {
        service: "vertex_ai",
        model: result.model,
        method: callerMethod,
        responseLength: result.content.length,
        latencyMs: result.latencyMs,
      },
      durationMs: Date.now() - startTime,
    });

    return {
      content: result.content,
      model: result.model,
      provider: result.provider === "vertex_ai" ? "vertex_ai" : "openai_fallback",
      auditId: result.auditId,
      latencyMs: result.latencyMs,
      governanceCompliant: result.governanceCompliant,
    };
  } catch (err: any) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "search_resources",
      userId,
      projectId: config.projectId,
      success: false,
      errorMessage: err?.message,
      metadata: {
        service: "vertex_ai",
        model: config.model,
        method: callerMethod,
        policyBlocked: err instanceof PolicyBlockedError,
      },
      durationMs: Date.now() - startTime,
    });
    throw err;
  }
}

export async function generateSOAPNoteVertexAI(request: SOAPNoteRequest): Promise<SOAPNoteResponse> {
  const { transcript, structuredData, patientContext, userId } = request;

  const dataCategories: DataCategory[] = ["clinical_notes"];
  if (structuredData.vitals?.length) dataCategories.push("vitals");
  if (structuredData.labResults?.length) dataCategories.push("lab_results");
  if (structuredData.conditions?.length || patientContext?.conditions?.length) dataCategories.push("conditions");
  if (structuredData.medications?.length || patientContext?.medications?.length) dataCategories.push("medications");
  if (structuredData.allergies?.length || patientContext?.allergies?.length) dataCategories.push("allergies");

  const systemPrompt = `You are a clinical scribe AI assistant operating under HIPAA compliance. Convert clinical inputs into structured SOAP notes.

GOVERNANCE RULES:
- Omit ALL PII (names, SSNs, addresses, phone numbers, email addresses)
- Use only medical identifiers and clinical terminology
- Every suggestion must cite clinical evidence from the input
- ICD-10 and CPT codes must have documented justification

Respond in JSON format:
{
  "subjective": "Patient-reported symptoms, history, chief complaint",
  "objective": "Vitals, lab findings, physical examination results",
  "assessment": "Clinical assessment with differential diagnoses",
  "plan": "Treatment plan with follow-up instructions",
  "icdSuggestions": [{"code": "E11.9", "description": "Type 2 DM", "confidence": 90}],
  "cptSuggestions": [{"code": "99214", "description": "Office visit, moderate", "confidence": 85}],
  "qualityScore": 85
}`;

  const vitalsStr = structuredData.vitals?.map(v => `${v.type}: ${v.value} ${v.unit}${v.trend ? ` [${v.trend}]` : ""}`).join(", ") || "None recorded";
  const labsStr = structuredData.labResults?.map(l => `${l.name}: ${l.value} ${l.unit} (ref: ${l.referenceRange || "N/A"})${l.flag ? ` [${l.flag}]` : ""}`).join(", ") || "None recorded";
  const conditionsStr = [...(structuredData.conditions || []), ...(patientContext?.conditions || [])].filter((v, i, a) => a.indexOf(v) === i).join(", ") || "None listed";
  const medsStr = structuredData.medications?.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join(", ") || patientContext?.medications?.join(", ") || "None listed";
  const allergiesStr = [...(structuredData.allergies || []), ...(patientContext?.allergies || [])].filter((v, i, a) => a.indexOf(v) === i).join(", ") || "NKDA";

  const userPrompt = `Generate a SOAP note from the following clinical data:

${transcript ? `CLINICIAN VOICE NOTE / FREE TEXT:\n"${transcript}"\n` : ""}
PATIENT VITALS: ${vitalsStr}
LAB RESULTS: ${labsStr}
ACTIVE CONDITIONS: ${conditionsStr}
CURRENT MEDICATIONS: ${medsStr}
ALLERGIES: ${allergiesStr}
${patientContext?.age ? `AGE: ${patientContext.age}` : ""}
${patientContext?.gender ? `GENDER: ${patientContext.gender}` : ""}`;

  const response = await callVertexAI(
    { projectId: GCP_PROJECT_ID, location: GCP_LOCATION, model: "gemini-2.5-pro" },
    systemPrompt,
    userPrompt,
    dataCategories,
    userId,
    "generateSOAPNote"
  );

  let parsed: any;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
  } catch {
    parsed = {
      subjective: response.content,
      objective: "",
      assessment: "",
      plan: "",
      icdSuggestions: [],
      cptSuggestions: [],
      qualityScore: 50,
    };
  }

  return {
    subjective: parsed.subjective || "",
    objective: parsed.objective || "",
    assessment: parsed.assessment || "",
    plan: parsed.plan || "",
    icdSuggestions: parsed.icdSuggestions || [],
    cptSuggestions: parsed.cptSuggestions || [],
    qualityScore: parsed.qualityScore || 70,
    provider: response.provider,
    disclaimer: DISCLAIMER,
    auditTrail: {
      promptLogged: true,
      responseLogged: true,
      governanceCompliant: response.governanceCompliant,
      piiScrubbed: true,
    },
  };
}

export async function generatePatientFriendlySummaryVertexAI(request: PatientSummaryRequest): Promise<PatientSummaryResponse> {
  const { fhirResources, readingLevel = "simple", userId } = request;

  const dataCategories: DataCategory[] = ["demographics"];
  if (fhirResources.conditions?.length) dataCategories.push("conditions");
  if (fhirResources.medications?.length) dataCategories.push("medications");
  if (fhirResources.observations?.length) dataCategories.push("lab_results");

  const gradeLevel = readingLevel === "simple" ? "4th-grade" : "8th-grade";

  const readingInstructions = readingLevel === "simple"
    ? `READING LEVEL: 4th-grade (Flesch-Kincaid Grade 4 or lower). Maximum sentence length: 12 words. Replace every medical term with a plain-language equivalent (e.g., "hypertension" -> "high blood pressure"). Never assume the reader knows what a body part does -- briefly explain in context.`
    : `READING LEVEL: 8th-grade (Flesch-Kincaid Grade 8 or lower). Maximum sentence length: 20 words. Use plain language as the primary voice, but include the proper medical term in parentheses on first use (e.g., "high blood pressure (hypertension)"). After the first mention, use only the plain-language version.`;

  const systemPrompt = `You are a board-certified health-literacy specialist embedded in a HIPAA-compliant patient health records platform called Tabula Medica. Your sole job is to translate a patient's clinical FHIR data into a warm, accurate, and actionable health summary.

=== ROLE & TONE ===
- Voice: A knowledgeable, caring nurse explaining everything to the patient.
- Tone: Calm, encouraging, honest. Never alarming, never dismissive.
- When results are concerning, use empowering language: "This is something to talk with your doctor about soon."
- When results are normal, celebrate briefly: "Great news -- this is right where it should be."
- Use second person ("you", "your") throughout.

=== ${readingInstructions} ===

=== MEDICAL ACCURACY GUARDRAILS ===
- NEVER diagnose, contradict a provider, or recommend starting/stopping medications.
- NEVER state a lab value IS normal/abnormal based on inferred reference ranges. Reflect what the data says: "Your doctor noted this as [status]" or "This result was flagged as [high/low]."
- If no status/flag exists for a result, say "Ask your doctor what this means for you."
- For medications, use "This is often used to help with..." rather than definitive statements.

=== PRIVACY & PII SCRUBBING (HIPAA) ===
- CRITICAL: NEVER output patient names, dates of birth, SSNs, addresses, phone numbers, emails, MRNs, insurance IDs, or any direct identifiers.
- For providers: role-based references only ("Your cardiologist", "Dr. S.").
- For facilities: generic references ("the hospital", "the lab").

=== STRUCTURAL RULES ===
- Return valid JSON only. No markdown, no code fences, no surrounding text.
- Every string value must be a complete, patient-friendly sentence or phrase.

Respond in JSON format:
{
  "summary": "1-2 paragraph overall health summary answering 'How am I doing?' Lead with the most important thing, end on an empowering note.",
  "sections": {
    "conditions": "Plain-language explanation of each current health condition, what it means for daily life, and its current status.",
    "medications": "List of each medicine with its plain-language purpose, schedule, and any important tips (e.g., 'take with food').",
    "upcomingAppointments": "When you need to see your doctor, what to expect, and how to prepare.",
    "recentResults": "What your recent tests show, connected to YOUR health context -- not just reference ranges.",
    "actionItems": "2-4 specific, achievable next steps personalized to this patient's data."
  },
  "disclaimer": "${DISCLAIMER}"
}`;

  const conditionsStr = fhirResources.conditions?.map(c => `${c.display} (${c.status}, onset: ${c.onsetDate || "unknown"})`).join("; ") || "None on record";
  const medsStr = fhirResources.medications?.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ""} (${m.status})`).join("; ") || "None on record";
  const appointmentsStr = fhirResources.appointments?.map(a => `${a.type || "Visit"} on ${a.date} with ${a.provider || "provider"} (${a.status})`).join("; ") || "None scheduled";
  const observationsStr = fhirResources.observations?.map(o => `${o.display}: ${o.value}${o.unit ? ` ${o.unit}` : ""} (${o.date})`).join("; ") || "No recent results";

  const userPrompt = `Create a patient-friendly health summary from these clinical records:

CONDITIONS: ${conditionsStr}
MEDICATIONS: ${medsStr}
UPCOMING APPOINTMENTS: ${appointmentsStr}
RECENT LAB RESULTS/OBSERVATIONS: ${observationsStr}

Reading level: ${gradeLevel}`;

  const response = await callVertexAI(
    { projectId: GCP_PROJECT_ID, location: GCP_LOCATION, model: "gemini-2.5-pro" },
    systemPrompt,
    userPrompt,
    dataCategories,
    userId,
    "generatePatientSummary"
  );

  let parsed: any;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
  } catch {
    parsed = {
      summary: response.content,
      sections: { conditions: "", medications: "", upcomingAppointments: "", recentResults: "", actionItems: "" },
    };
  }

  return {
    summary: parsed.summary || "",
    sections: {
      conditions: parsed.sections?.conditions || "",
      medications: parsed.sections?.medications || "",
      upcomingAppointments: parsed.sections?.upcomingAppointments || "",
      recentResults: parsed.sections?.recentResults || "",
      actionItems: parsed.sections?.actionItems || "",
    },
    readingLevel: gradeLevel,
    provider: response.provider,
    disclaimer: DISCLAIMER,
    piiScrubbed: true,
  };
}

export async function ragContextualChat(request: RAGContextRequest): Promise<RAGContextResponse> {
  const { query, selectedResources, conversationHistory, userId } = request;

  const dataCategories: DataCategory[] = [];
  const resourceTypes = new Set(selectedResources.map(r => r.resourceType));
  if (resourceTypes.has("Condition")) dataCategories.push("conditions");
  if (resourceTypes.has("MedicationRequest") || resourceTypes.has("Medication")) dataCategories.push("medications");
  if (resourceTypes.has("Observation")) dataCategories.push("lab_results");
  if (resourceTypes.has("Vital") || resourceTypes.has("VitalSign")) dataCategories.push("vitals");
  if (resourceTypes.has("AllergyIntolerance")) dataCategories.push("allergies");
  if (resourceTypes.has("Immunization")) dataCategories.push("immunizations");
  if (resourceTypes.has("DiagnosticReport") || resourceTypes.has("ClinicalNote")) dataCategories.push("clinical_notes");
  if (dataCategories.length === 0) dataCategories.push("clinical_notes");

  const contextChunks = selectedResources.map((r, i) => {
    const dateRange = r.dateRange ? ` (Date range: ${r.dateRange.start} to ${r.dateRange.end})` : "";
    return `[Context ${i + 1}] ${r.resourceType} (ID: ${r.resourceId})${dateRange}:\n${JSON.stringify(r.data, null, 2)}`;
  });

  const relevanceScores = selectedResources.map((r, i) => ({
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    relevanceScore: Math.max(0.5, 1 - (i * 0.1)),
  }));

  const historyStr = conversationHistory?.map(m => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`).join("\n") || "";

  const systemPrompt = `You are a HIPAA-compliant medical AI assistant using Retrieval-Augmented Generation (RAG). 
You have been given SPECIFIC selected clinical data points as context. Answer ONLY based on the provided context.

RULES:
- Only reference information present in the provided context
- If the context doesn't contain enough information, say so clearly
- Never fabricate clinical data or test results
- Use patient-friendly language when explaining medical terms
- Omit all PII (names, SSNs, addresses)
- Always recommend consulting with a healthcare provider for medical decisions

The patient has selected specific records to discuss. Focus your response on those records.`;

  const userPrompt = `${historyStr ? `CONVERSATION HISTORY:\n${historyStr}\n\n` : ""}SELECTED CLINICAL CONTEXT:
${contextChunks.join("\n\n")}

PATIENT QUESTION: ${query}`;

  const response = await callVertexAI(
    { projectId: GCP_PROJECT_ID, location: GCP_LOCATION, model: "gemini-2.5-pro" },
    systemPrompt,
    userPrompt,
    dataCategories,
    userId,
    "ragContextualChat"
  );

  return {
    response: response.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim(),
    contextUsed: relevanceScores,
    provider: response.provider,
    disclaimer: DISCLAIMER,
    auditId: response.auditId,
  };
}

export interface DocumentTemplate {
  id: string;
  templateType: string;
  displayName: string;
  placeholders: Record<string, string>;
  requiredContext: string[];
  aiInstructions: string;
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "referral_letter_v2",
    templateType: "Referral_Letter",
    displayName: "Specialist Referral Letter",
    placeholders: {
      clinical_reason: "Specific Clinical Questions for Specialist",
      imaging_context: "Key Findings from Recent Imaging (e.g., MRI/CT)",
      medication_rationale: "Reason for Medication Change or Failure",
      patient_summary: "Generated 6th-grade level summary for the patient copy",
      referring_specialty: "Target specialty for referral",
      urgency_level: "Routine, Urgent, or Emergent",
    },
    requiredContext: ["conditions", "medications"],
    aiInstructions: "Generate a professional referral letter addressing the specialist's likely questions. Include relevant history, current treatment, and specific clinical concerns.",
  },
  {
    id: "discharge_summary_v2",
    templateType: "Discharge_Summary",
    displayName: "Hospital Discharge Summary",
    placeholders: {
      admission_reason: "Primary reason for hospitalization",
      hospital_course: "Summary of hospital stay and treatment",
      discharge_condition: "Patient condition at discharge",
      discharge_medications: "Complete medication list at discharge",
      follow_up_plan: "Follow-up appointments and instructions",
      patient_education: "Patient-friendly discharge instructions",
    },
    requiredContext: ["conditions", "medications", "vitals", "lab_results"],
    aiInstructions: "Generate a comprehensive discharge summary covering the full hospital course. Include medication reconciliation and clear follow-up instructions.",
  },
  {
    id: "prior_auth_v2",
    templateType: "Prior_Authorization",
    displayName: "Prior Authorization Request",
    placeholders: {
      requested_service: "Service or medication requiring authorization",
      medical_necessity: "Clinical justification for the request",
      alternatives_tried: "Previous treatments attempted and outcomes",
      supporting_evidence: "Lab results, imaging, or clinical evidence",
      expected_outcome: "Expected clinical benefit",
    },
    requiredContext: ["conditions", "medications"],
    aiInstructions: "Generate a compelling prior authorization justification that addresses common denial reasons. Reference clinical guidelines and cite specific patient evidence.",
  },
  {
    id: "progress_note_v2",
    templateType: "Progress_Note",
    displayName: "Clinical Progress Note",
    placeholders: {
      interval_history: "Changes since last visit",
      current_symptoms: "Current symptom status",
      treatment_response: "Response to current treatment plan",
      plan_modifications: "Any changes to the treatment plan",
    },
    requiredContext: ["conditions", "vitals"],
    aiInstructions: "Generate a focused progress note documenting interval changes and treatment response. Highlight any concerning trends.",
  },
  {
    id: "consultation_note_v2",
    templateType: "Consultation_Note",
    displayName: "Specialist Consultation Note",
    placeholders: {
      reason_for_consultation: "Why the consultation was requested",
      findings: "Consultant's findings and assessment",
      recommendations: "Treatment recommendations for the referring provider",
      follow_up: "Recommended follow-up plan",
    },
    requiredContext: ["conditions", "lab_results"],
    aiInstructions: "Generate a structured consultation note addressing the specific clinical questions from the referring provider.",
  },
];

export function getDocumentTemplates(): DocumentTemplate[] {
  return DOCUMENT_TEMPLATES;
}

export function getDocumentTemplate(templateId: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find(t => t.id === templateId);
}

export async function generateFromTemplate(
  templateId: string,
  placeholderValues: Record<string, string>,
  patientData: Record<string, any>,
  userId?: string
): Promise<{ document: string; metadata: Record<string, any>; provider: string; disclaimer: string }> {
  const template = getDocumentTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const dataCategories: DataCategory[] = template.requiredContext.map(c => c as DataCategory);

  const placeholderContext = Object.entries(placeholderValues)
    .map(([key, value]) => `${template.placeholders[key] || key}: ${value}`)
    .join("\n");

  const systemPrompt = `You are a clinical documentation AI generating a ${template.displayName}. ${template.aiInstructions}

GOVERNANCE:
- Omit ALL PII (names, SSNs, addresses, phone numbers)
- Use medical identifiers only
- Follow HIPAA documentation standards
- Include appropriate disclaimers`;

  const userPrompt = `Generate a ${template.displayName} with the following context:

TEMPLATE PARAMETERS:
${placeholderContext}

PATIENT CLINICAL DATA:
${JSON.stringify(patientData, null, 2)}`;

  const response = await callVertexAI(
    { projectId: GCP_PROJECT_ID, location: GCP_LOCATION, model: "gemini-2.5-pro" },
    systemPrompt,
    userPrompt,
    dataCategories,
    userId,
    "generateFromTemplate"
  );

  return {
    document: response.content,
    metadata: {
      templateId,
      templateType: template.templateType,
      provider: response.provider,
      latencyMs: response.latencyMs,
      governanceCompliant: response.governanceCompliant,
      generatedAt: new Date().toISOString(),
    },
    provider: response.provider,
    disclaimer: DISCLAIMER,
  };
}

export interface WorkflowTriggerEvent {
  eventType: "status_changed" | "diagnosis_added" | "medication_changed" | "lab_result_added" | "visit_completed" | "admission" | "discharge";
  patientId: string;
  recordId: string;
  previousValue?: string;
  newValue?: string;
  data: Record<string, any>;
  timestamp: Date;
}

interface WorkflowAction {
  actionType: "generate_document" | "send_notification" | "create_task" | "update_record";
  templateId?: string;
  priority: "low" | "medium" | "high" | "urgent";
  metadata: Record<string, any>;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  eventType: WorkflowTriggerEvent["eventType"];
  conditions: Array<{ field: string; operator: "equals" | "contains" | "changed_to" | "changed_from"; value: string }>;
  actions: WorkflowAction[];
  enabled: boolean;
}

const PROACTIVE_WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: "wf_discharge_summary",
    name: "Auto-Generate Discharge Summary",
    description: "Automatically generates a discharge summary when a patient's status changes to 'discharged'",
    eventType: "discharge",
    conditions: [{ field: "newValue", operator: "equals", value: "discharged" }],
    actions: [{
      actionType: "generate_document",
      templateId: "discharge_summary_v2",
      priority: "high",
      metadata: { reason: "Patient discharged - summary required" },
    }],
    enabled: true,
  },
  {
    id: "wf_referral_on_diagnosis",
    name: "Suggest Referral on Specialty Diagnosis",
    description: "Suggests a referral letter when a diagnosis is added that requires specialist care",
    eventType: "diagnosis_added",
    conditions: [{ field: "data.requiresSpecialist", operator: "equals", value: "true" }],
    actions: [{
      actionType: "generate_document",
      templateId: "referral_letter_v2",
      priority: "medium",
      metadata: { reason: "Specialty diagnosis detected" },
    }],
    enabled: true,
  },
  {
    id: "wf_prior_auth_medication",
    name: "Auto Prior Auth on High-Cost Medication",
    description: "Triggers prior authorization workflow when a medication requiring authorization is prescribed",
    eventType: "medication_changed",
    conditions: [{ field: "data.requiresPriorAuth", operator: "equals", value: "true" }],
    actions: [{
      actionType: "generate_document",
      templateId: "prior_auth_v2",
      priority: "urgent",
      metadata: { reason: "Medication requires prior authorization" },
    }],
    enabled: true,
  },
  {
    id: "wf_progress_note_visit",
    name: "Auto Progress Note on Visit Completion",
    description: "Generates a progress note draft when a clinical visit is marked complete",
    eventType: "visit_completed",
    conditions: [],
    actions: [{
      actionType: "generate_document",
      templateId: "progress_note_v2",
      priority: "medium",
      metadata: { reason: "Visit completed - documentation needed" },
    }],
    enabled: true,
  },
  {
    id: "wf_critical_lab_alert",
    name: "Critical Lab Result Alert",
    description: "Creates urgent task when critical lab results are recorded",
    eventType: "lab_result_added",
    conditions: [{ field: "data.flag", operator: "equals", value: "critical" }],
    actions: [{
      actionType: "create_task",
      priority: "urgent",
      metadata: { reason: "Critical lab value detected" },
    }],
    enabled: true,
  },
];

interface WorkflowTriggerResult {
  triggered: boolean;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    actions: WorkflowAction[];
    generatedDocuments?: Array<{ templateId: string; content: string }>;
  }>;
  eventId: string;
  timestamp: string;
}

const workflowEventLog: Array<{ event: WorkflowTriggerEvent; result: WorkflowTriggerResult }> = [];

export async function processWorkflowTrigger(
  event: WorkflowTriggerEvent,
  patientData?: Record<string, any>,
  userId?: string
): Promise<WorkflowTriggerResult> {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const matchedRules: WorkflowTriggerResult["matchedRules"] = [];

  for (const rule of PROACTIVE_WORKFLOW_RULES) {
    if (!rule.enabled || rule.eventType !== event.eventType) continue;

    let conditionsMet = true;
    for (const condition of rule.conditions) {
      const fieldValue = getNestedValue(event, condition.field);
      switch (condition.operator) {
        case "equals":
          conditionsMet = String(fieldValue) === condition.value;
          break;
        case "contains":
          conditionsMet = String(fieldValue).includes(condition.value);
          break;
        case "changed_to":
          conditionsMet = event.newValue === condition.value;
          break;
        case "changed_from":
          conditionsMet = event.previousValue === condition.value;
          break;
      }
      if (!conditionsMet) break;
    }

    if (conditionsMet) {
      const ruleResult: (typeof matchedRules)[0] = {
        ruleId: rule.id,
        ruleName: rule.name,
        actions: rule.actions,
        generatedDocuments: [],
      };

      for (const action of rule.actions) {
        if (action.actionType === "generate_document" && action.templateId && patientData) {
          try {
            const doc = await generateFromTemplate(
              action.templateId,
              { ...action.metadata, patientId: event.patientId },
              patientData,
              userId
            );
            ruleResult.generatedDocuments?.push({
              templateId: action.templateId,
              content: doc.document,
            });
          } catch (err: any) {
            console.error(`[Workflow] Document generation failed for rule ${rule.id}: ${err.message}`);
          }
        }
      }

      matchedRules.push(ruleResult);
    }
  }

  const result: WorkflowTriggerResult = {
    triggered: matchedRules.length > 0,
    matchedRules,
    eventId,
    timestamp: new Date().toISOString(),
  };

  workflowEventLog.unshift({ event, result });
  if (workflowEventLog.length > 500) workflowEventLog.pop();

  console.log(`[Workflow] Event ${event.eventType}: ${matchedRules.length} rules triggered for patient ${event.patientId}`);
  return result;
}

export function getWorkflowRules(): WorkflowRule[] {
  return PROACTIVE_WORKFLOW_RULES;
}

export function getWorkflowEventLog(limit: number = 50): Array<{ event: WorkflowTriggerEvent; result: WorkflowTriggerResult }> {
  return workflowEventLog.slice(0, limit);
}

export function getServiceStatus(): {
  vertexAiEnabled: boolean;
  projectId: string;
  location: string;
  templateCount: number;
  workflowRuleCount: number;
  activeWorkflowRules: number;
  recentEvents: number;
} {
  return {
    vertexAiEnabled: VERTEX_AI_ENABLED,
    projectId: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    templateCount: DOCUMENT_TEMPLATES.length,
    workflowRuleCount: PROACTIVE_WORKFLOW_RULES.length,
    activeWorkflowRules: PROACTIVE_WORKFLOW_RULES.filter(r => r.enabled).length,
    recentEvents: workflowEventLog.length,
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

console.log(`[VertexAI] Service initialized (Vertex AI ${VERTEX_AI_ENABLED ? "enabled" : "disabled - using OpenAI fallback"})`);
console.log(`[VertexAI] Project: ${GCP_PROJECT_ID}, Location: ${GCP_LOCATION}`);
console.log(`[VertexAI] Templates: ${DOCUMENT_TEMPLATES.length}, Workflow rules: ${PROACTIVE_WORKFLOW_RULES.filter(r => r.enabled).length} active`);
