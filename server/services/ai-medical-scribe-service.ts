import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (apiKey && baseURL) {
      openaiClient = new OpenAI({ apiKey, baseURL });
    }
  }
  return openaiClient;
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This AI-generated clinical documentation is for EDUCATIONAL and DOCUMENTATION ASSISTANCE purposes only. It is NOT a substitute for clinical judgment. All notes must be reviewed, verified, and signed by a licensed healthcare provider before becoming part of the official medical record. This system does NOT provide clinical decision support.";

function logHipaaAudit(action: string, userId: string, patientId?: string, details?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][MedicalScribe] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId || 'N/A'} | Details: ${details || 'N/A'}`);
}

export interface ClinicalNote {
  noteId: string;
  noteType: "SOAP" | "progress" | "discharge" | "consultation" | "procedure" | "initial_assessment";
  patientId?: string;
  encounterId?: string;
  generatedAt: string;
  status: "draft" | "pending_review" | "reviewed" | "finalized";
  sections: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: ReviewOfSystems;
    pastMedicalHistory?: string[];
    medications?: Medication[];
    allergies?: Allergy[];
    physicalExam?: PhysicalExam;
    assessment?: Assessment[];
    plan?: TreatmentPlan[];
    subjective?: string;
    objective?: string;
    procedures?: string[];
    instructions?: string[];
    followUp?: FollowUp;
  };
  extractedEntities: ExtractedEntities;
  confidence: number;
  disclaimer: string;
}

export interface ReviewOfSystems {
  constitutional?: string;
  cardiovascular?: string;
  respiratory?: string;
  gastrointestinal?: string;
  musculoskeletal?: string;
  neurological?: string;
  psychiatric?: string;
  skin?: string;
  endocrine?: string;
  hematologic?: string;
  allergicImmunologic?: string;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: "active" | "discontinued" | "as_needed";
  startDate?: string;
}

export interface Allergy {
  allergen: string;
  reaction?: string;
  severity?: "mild" | "moderate" | "severe" | "unknown";
}

export interface PhysicalExam {
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
    height?: string;
    bmi?: string;
  };
  general?: string;
  heent?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdominal?: string;
  musculoskeletal?: string;
  neurological?: string;
  skin?: string;
  psychiatric?: string;
}

export interface Assessment {
  diagnosis: string;
  icdCode?: string;
  status: "confirmed" | "suspected" | "ruled_out" | "differential";
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
}

export interface TreatmentPlan {
  intervention: string;
  type: "medication" | "procedure" | "referral" | "lifestyle" | "monitoring" | "education" | "other";
  details?: string;
  frequency?: string;
  duration?: string;
  priority: "routine" | "urgent" | "emergent";
}

export interface FollowUp {
  timing?: string;
  reason?: string;
  provider?: string;
  instructions?: string[];
}

export interface ActionItem {
  id: string;
  task: string;
  category: "medication" | "appointment" | "lab_test" | "lifestyle" | "monitoring" | "referral" | "other";
  priority: "high" | "medium" | "low";
  dueDescription?: string;
  dueDays?: number;
  completed: boolean;
}

export interface PostVisitSummary {
  summaryId: string;
  patientFriendlySummary: string;
  whatWasDiscussed: string[];
  actionItems: ActionItem[];
  medicationChanges: Array<{ medication: string; change: string }>;
  followUpAppointments: Array<{ description: string; timing: string; dueDays?: number }>;
  warningSignsToWatch: string[];
  questionsToAsk: string[];
  generatedAt: string;
  disclaimer: string;
}

export interface ExtractedEntities {
  symptoms: string[];
  diagnoses: string[];
  medications: string[];
  procedures: string[];
  labTests: string[];
  vitals: string[];
  allergies: string[];
  socialHistory?: string[];
  familyHistory?: string[];
  actionItems?: ActionItem[];
}

export interface ScribeInput {
  inputType: "free_text" | "conversation" | "audio_transcript";
  content: string;
  patientId?: string;
  encounterId?: string;
  noteType?: ClinicalNote["noteType"];
  providerName?: string;
  encounterDate?: string;
  additionalContext?: string;
}

export interface ScribeSession {
  sessionId: string;
  userId: string;
  patientId?: string;
  startedAt: string;
  status: "active" | "completed" | "cancelled";
  inputs: ScribeInput[];
  generatedNotes: ClinicalNote[];
}

const activeSessions: Map<string, ScribeSession> = new Map();

export async function generateClinicalNote(
  userId: string,
  input: ScribeInput
): Promise<{ note: ClinicalNote; disclaimer: string }> {
  logHipaaAudit("GENERATE_CLINICAL_NOTE", userId, input.patientId, `Note type: ${input.noteType || 'SOAP'}, Input type: ${input.inputType}`);
  
  const openai = getOpenAI();
  if (!openai) {
    console.log("[MedicalScribe] OpenAI not configured, using fallback note generation");
    return buildFallbackNote(input);
  }
  
  const noteType = input.noteType || "SOAP";
  
  const systemPrompt = `You are an AI medical scribe assistant that generates structured clinical documentation from doctor-patient conversations or clinical notes. You MUST:

1. Extract and organize clinical information into a structured ${noteType} note format
2. Identify and categorize: symptoms, diagnoses, medications, procedures, lab tests, vitals, allergies
3. Maintain medical accuracy and use appropriate clinical terminology
4. Flag any unclear or potentially concerning information
5. NEVER provide clinical decision support, treatment recommendations, or diagnostic conclusions beyond what is explicitly stated
6. Include confidence levels for extracted information

IMPORTANT COMPLIANCE REQUIREMENTS:
- This is for DOCUMENTATION ASSISTANCE only, NOT clinical decision support
- All notes require provider review and verification before use
- Do not infer diagnoses not explicitly mentioned
- Preserve patient safety by noting any concerning symptoms or red flags mentioned

Output JSON with this structure:
{
  "sections": {
    "chiefComplaint": "string",
    "historyOfPresentIllness": "string",
    "reviewOfSystems": { /* organ systems */ },
    "pastMedicalHistory": ["string"],
    "medications": [{ "name": "string", "dosage": "string", "frequency": "string", "status": "active|discontinued|as_needed" }],
    "allergies": [{ "allergen": "string", "reaction": "string", "severity": "mild|moderate|severe" }],
    "physicalExam": { "vitalSigns": {}, "general": "string", /* other systems */ },
    "assessment": [{ "diagnosis": "string", "icdCode": "string if known", "status": "confirmed|suspected|differential" }],
    "plan": [{ "intervention": "string", "type": "medication|procedure|referral|lifestyle|monitoring|education", "priority": "routine|urgent" }],
    "subjective": "string (patient's reported symptoms)",
    "objective": "string (observed findings)",
    "followUp": { "timing": "string", "reason": "string", "instructions": ["string"] }
  },
  "extractedEntities": {
    "symptoms": ["string"],
    "diagnoses": ["string"],
    "medications": ["string"],
    "procedures": ["string"],
    "labTests": ["string"],
    "vitals": ["string"],
    "allergies": ["string"],
    "socialHistory": ["string"],
    "familyHistory": ["string"],
    "actionItems": [{ "task": "string", "category": "medication|appointment|lab_test|lifestyle|monitoring|referral|other", "priority": "high|medium|low", "dueDescription": "string (e.g. 'in 2 weeks', 'daily', 'before next visit')", "dueDays": "number or null" }]
  },
  "confidence": 0.0-1.0
}`;

  const userPrompt = `Generate a structured ${noteType} clinical note from the following ${input.inputType}:

${input.additionalContext ? `Additional Context: ${input.additionalContext}\n\n` : ""}${input.providerName ? `Provider: ${input.providerName}\n` : ""}${input.encounterDate ? `Encounter Date: ${input.encounterDate}\n` : ""}
---
${input.content}
---

Extract all relevant clinical information and organize into the specified structure. Be thorough but only include information explicitly stated or clearly implied from the input.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    
    const result = JSON.parse(content);
    
    const note: ClinicalNote = {
      noteId: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      noteType,
      patientId: input.patientId,
      encounterId: input.encounterId,
      generatedAt: new Date().toISOString(),
      status: "draft",
      sections: result.sections || {},
      extractedEntities: {
        symptoms: result.extractedEntities?.symptoms || [],
        diagnoses: result.extractedEntities?.diagnoses || [],
        medications: result.extractedEntities?.medications || [],
        procedures: result.extractedEntities?.procedures || [],
        labTests: result.extractedEntities?.labTests || [],
        vitals: result.extractedEntities?.vitals || [],
        allergies: result.extractedEntities?.allergies || [],
        socialHistory: result.extractedEntities?.socialHistory || [],
        familyHistory: result.extractedEntities?.familyHistory || [],
        actionItems: (result.extractedEntities?.actionItems || []).map((item: any, idx: number) => ({
          id: `action-${Date.now()}-${idx}`,
          task: item.task || "",
          category: item.category || "other",
          priority: item.priority || "medium",
          dueDescription: item.dueDescription,
          dueDays: item.dueDays ?? null,
          completed: false,
        })),
      },
      confidence: result.confidence || 0.75,
      disclaimer: NO_CDS_DISCLAIMER,
    };
    
    logHipaaAudit("CLINICAL_NOTE_GENERATED", userId, input.patientId, `Note ID: ${note.noteId}, Confidence: ${note.confidence}`);
    
    return { note, disclaimer: NO_CDS_DISCLAIMER };
  } catch (error) {
    console.error("[MedicalScribe] Error generating clinical note:", error);
    logHipaaAudit("CLINICAL_NOTE_ERROR", userId, input.patientId, `Error: ${error}`);
    return buildFallbackNote(input);
  }
}

function buildFallbackNote(input: ScribeInput): { note: ClinicalNote; disclaimer: string } {
  const symptoms = extractBasicSymptoms(input.content);
  const medications = extractBasicMedications(input.content);
  
  const note: ClinicalNote = {
    noteId: `note-fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    noteType: input.noteType || "SOAP",
    patientId: input.patientId,
    encounterId: input.encounterId,
    generatedAt: new Date().toISOString(),
    status: "draft",
    sections: {
      subjective: input.content.substring(0, 500) + (input.content.length > 500 ? "..." : ""),
      chiefComplaint: symptoms[0] || "See detailed notes",
      historyOfPresentIllness: "Please review raw input for complete history.",
      assessment: [],
      plan: [],
    },
    extractedEntities: {
      symptoms,
      diagnoses: [],
      medications,
      procedures: [],
      labTests: [],
      vitals: extractBasicVitals(input.content),
      allergies: [],
    },
    confidence: 0.5,
    disclaimer: NO_CDS_DISCLAIMER,
  };
  
  return { note, disclaimer: NO_CDS_DISCLAIMER };
}

function extractBasicSymptoms(text: string): string[] {
  const symptomPatterns = [
    /pain\s+(?:in\s+)?(?:the\s+)?(\w+)/gi,
    /(\w+)\s+pain/gi,
    /(headache|nausea|vomiting|dizziness|fatigue|fever|cough|shortness of breath|chest pain)/gi,
    /(difficulty\s+\w+ing)/gi,
  ];
  
  const symptoms: string[] = [];
  for (const pattern of symptomPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      symptoms.push(...matches.map(m => m.toLowerCase().trim()));
    }
  }
  return Array.from(new Set(symptoms)).slice(0, 10);
}

function extractBasicMedications(text: string): string[] {
  const medPatterns = [
    /(aspirin|ibuprofen|acetaminophen|metformin|lisinopril|atorvastatin|omeprazole|amlodipine|metoprolol|losartan|gabapentin|hydrocodone|tramadol|prednisone|amoxicillin|azithromycin|levothyroxine|albuterol)/gi,
    /(\w+)\s+(?:\d+\s*)?(?:mg|mcg|ml)/gi,
  ];
  
  const meds: string[] = [];
  for (const pattern of medPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      meds.push(...matches.map(m => m.toLowerCase().trim()));
    }
  }
  return Array.from(new Set(meds)).slice(0, 10);
}

function extractBasicVitals(text: string): string[] {
  const vitalPatterns = [
    /BP\s*[:=]?\s*\d+\/\d+/gi,
    /blood pressure\s*[:=]?\s*\d+\/\d+/gi,
    /HR\s*[:=]?\s*\d+/gi,
    /heart rate\s*[:=]?\s*\d+/gi,
    /temp(?:erature)?\s*[:=]?\s*[\d.]+/gi,
    /O2\s*(?:sat)?\s*[:=]?\s*\d+/gi,
    /SpO2\s*[:=]?\s*\d+/gi,
    /weight\s*[:=]?\s*[\d.]+\s*(?:kg|lbs?|pounds?)?/gi,
  ];
  
  const vitals: string[] = [];
  for (const pattern of vitalPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      vitals.push(...matches.map(m => m.trim()));
    }
  }
  return Array.from(new Set(vitals));
}

export async function startScribeSession(userId: string, patientId?: string): Promise<{ session: ScribeSession; disclaimer: string }> {
  logHipaaAudit("START_SCRIBE_SESSION", userId, patientId, "New scribe session started");
  
  const session: ScribeSession = {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    patientId,
    startedAt: new Date().toISOString(),
    status: "active",
    inputs: [],
    generatedNotes: [],
  };
  
  activeSessions.set(session.sessionId, session);
  
  return { session, disclaimer: NO_CDS_DISCLAIMER };
}

export async function addInputToSession(
  userId: string,
  sessionId: string,
  input: ScribeInput
): Promise<{ session: ScribeSession; note: ClinicalNote; disclaimer: string }> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  
  if (session.userId !== userId) {
    logHipaaAudit("UNAUTHORIZED_SESSION_ACCESS", userId, session.patientId, `Attempted access to session: ${sessionId}`);
    throw new Error("Unauthorized access to session");
  }
  
  logHipaaAudit("ADD_INPUT_TO_SESSION", userId, session.patientId, `Session: ${sessionId}, Input type: ${input.inputType}`);
  
  session.inputs.push(input);
  
  const { note } = await generateClinicalNote(userId, {
    ...input,
    patientId: session.patientId || input.patientId,
  });
  
  session.generatedNotes.push(note);
  
  return { session, note, disclaimer: NO_CDS_DISCLAIMER };
}

export async function getSession(userId: string, sessionId: string): Promise<{ session: ScribeSession; disclaimer: string }> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  
  if (session.userId !== userId) {
    logHipaaAudit("UNAUTHORIZED_SESSION_ACCESS", userId, session.patientId, `Attempted access to session: ${sessionId}`);
    throw new Error("Unauthorized access to session");
  }
  
  logHipaaAudit("GET_SESSION", userId, session.patientId, `Session: ${sessionId}`);
  
  return { session, disclaimer: NO_CDS_DISCLAIMER };
}

export async function completeSession(userId: string, sessionId: string): Promise<{ session: ScribeSession; disclaimer: string }> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  
  if (session.userId !== userId) {
    throw new Error("Unauthorized access to session");
  }
  
  session.status = "completed";
  logHipaaAudit("COMPLETE_SCRIBE_SESSION", userId, session.patientId, `Session: ${sessionId}, Notes generated: ${session.generatedNotes.length}`);
  
  return { session, disclaimer: NO_CDS_DISCLAIMER };
}

export async function updateNoteStatus(
  userId: string,
  noteId: string,
  status: ClinicalNote["status"],
  reviewerNotes?: string
): Promise<{ success: boolean; disclaimer: string }> {
  logHipaaAudit("UPDATE_NOTE_STATUS", userId, undefined, `Note: ${noteId}, New status: ${status}${reviewerNotes ? ', Has reviewer notes' : ''}`);
  
  for (const session of Array.from(activeSessions.values())) {
    const note = session.generatedNotes.find((n: ClinicalNote) => n.noteId === noteId);
    if (note) {
      if (session.userId !== userId) {
        logHipaaAudit("UNAUTHORIZED_NOTE_STATUS_UPDATE", userId, session.patientId, `Attempted update on note: ${noteId} owned by: ${session.userId}`);
        throw new Error("Unauthorized access to note");
      }
      note.status = status;
      if (reviewerNotes) {
        (note as any).reviewerNotes = reviewerNotes;
      }
      return { success: true, disclaimer: NO_CDS_DISCLAIMER };
    }
  }
  
  return { success: false, disclaimer: NO_CDS_DISCLAIMER };
}

export async function summarizeConversation(
  userId: string,
  conversation: string,
  patientId?: string
): Promise<{ summary: ConversationSummary; disclaimer: string }> {
  logHipaaAudit("SUMMARIZE_CONVERSATION", userId, patientId, `Conversation length: ${conversation.length} chars`);
  
  const openai = getOpenAI();
  if (!openai) {
    console.log("[MedicalScribe] OpenAI not configured, using fallback summary");
    return buildFallbackSummary(conversation);
  }
  
  const systemPrompt = `You are a medical scribe assistant that summarizes doctor-patient conversations. Extract and organize:
1. Key symptoms discussed
2. Diagnoses mentioned or considered
3. Treatment decisions made
4. Patient concerns and questions
5. Follow-up plans
6. Any safety concerns or red flags

IMPORTANT: This is for documentation assistance only, NOT clinical decision support.

Output JSON:
{
  "keyPoints": ["string"],
  "symptoms": ["string"],
  "diagnoses": ["string"],
  "treatments": ["string"],
  "patientConcerns": ["string"],
  "followUpPlan": "string",
  "safetyFlags": ["string"],
  "duration": "estimated duration if discernible",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this medical conversation:\n\n${conversation}` }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response");
    }
    
    const result = JSON.parse(content);
    
    const summary: ConversationSummary = {
      summaryId: `summary-${Date.now()}`,
      keyPoints: result.keyPoints || [],
      symptoms: result.symptoms || [],
      diagnoses: result.diagnoses || [],
      treatments: result.treatments || [],
      patientConcerns: result.patientConcerns || [],
      followUpPlan: result.followUpPlan || "No follow-up discussed",
      safetyFlags: result.safetyFlags || [],
      generatedAt: new Date().toISOString(),
      confidence: result.confidence || 0.75,
    };
    
    return { summary, disclaimer: NO_CDS_DISCLAIMER };
  } catch (error) {
    console.error("[MedicalScribe] Error summarizing conversation:", error);
    return buildFallbackSummary(conversation);
  }
}

export interface ConversationSummary {
  summaryId: string;
  keyPoints: string[];
  symptoms: string[];
  diagnoses: string[];
  treatments: string[];
  patientConcerns: string[];
  followUpPlan: string;
  safetyFlags: string[];
  generatedAt: string;
  confidence: number;
}

function buildFallbackSummary(conversation: string): { summary: ConversationSummary; disclaimer: string } {
  const symptoms = extractBasicSymptoms(conversation);
  const medications = extractBasicMedications(conversation);
  
  const summary: ConversationSummary = {
    summaryId: `summary-fb-${Date.now()}`,
    keyPoints: ["Please review full conversation for complete details"],
    symptoms,
    diagnoses: [],
    treatments: medications.map(m => `Medication mentioned: ${m}`),
    patientConcerns: [],
    followUpPlan: "Review conversation for follow-up details",
    safetyFlags: [],
    generatedAt: new Date().toISOString(),
    confidence: 0.4,
  };
  
  return { summary, disclaimer: NO_CDS_DISCLAIMER };
}

export async function getRecentNotes(userId: string): Promise<{ notes: ClinicalNote[]; disclaimer: string }> {
  logHipaaAudit("GET_RECENT_NOTES", userId, undefined, "Fetching recent notes");
  
  const userSessions = Array.from(activeSessions.values()).filter(s => s.userId === userId);
  const notes = userSessions.flatMap(s => s.generatedNotes);
  
  notes.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  
  return { notes: notes.slice(0, 20), disclaimer: NO_CDS_DISCLAIMER };
}

export function getNoteTypes(): { noteTypes: Array<{ value: ClinicalNote["noteType"]; label: string; description: string }>; disclaimer: string } {
  return {
    noteTypes: [
      { value: "SOAP", label: "SOAP Note", description: "Subjective, Objective, Assessment, Plan format" },
      { value: "progress", label: "Progress Note", description: "Follow-up visit documentation" },
      { value: "initial_assessment", label: "Initial Assessment", description: "New patient comprehensive evaluation" },
      { value: "consultation", label: "Consultation Note", description: "Specialist consultation documentation" },
      { value: "procedure", label: "Procedure Note", description: "Documentation of procedures performed" },
      { value: "discharge", label: "Discharge Summary", description: "Hospital discharge documentation" },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function generatePostVisitSummary(
  userId: string,
  conversation: string,
  patientId?: string
): Promise<{ postVisitSummary: PostVisitSummary; disclaimer: string }> {
  logHipaaAudit("GENERATE_POST_VISIT_SUMMARY", userId, patientId, `Conversation length: ${conversation.length} chars`);

  const openai = getOpenAI();
  if (!openai) {
    return buildFallbackPostVisitSummary(conversation);
  }

  const systemPrompt = `You are a patient-friendly medical assistant that creates clear, easy-to-understand post-visit summaries. Generate a summary that helps the patient understand what happened during their visit and what they need to do next.

IMPORTANT: This is for DOCUMENTATION ASSISTANCE only, NOT clinical decision support. Use simple, non-medical language where possible.

Output JSON:
{
  "patientFriendlySummary": "A 2-3 sentence plain-language summary of the visit",
  "whatWasDiscussed": ["Simple descriptions of topics covered"],
  "actionItems": [
    {
      "task": "Clear action the patient needs to take",
      "category": "medication|appointment|lab_test|lifestyle|monitoring|referral|other",
      "priority": "high|medium|low",
      "dueDescription": "When to do it (e.g. 'every morning', 'within 1 week', 'at next visit')",
      "dueDays": null or number of days until due
    }
  ],
  "medicationChanges": [
    { "medication": "Drug name", "change": "What changed (started, stopped, dose changed, etc.)" }
  ],
  "followUpAppointments": [
    { "description": "What the follow-up is for", "timing": "When to schedule", "dueDays": null or number }
  ],
  "warningSignsToWatch": ["Symptoms that should prompt calling the doctor or going to ER"],
  "questionsToAsk": ["Questions the patient might want to ask at the next visit"],
  "confidence": 0.0-1.0
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a patient-friendly post-visit summary from this encounter:\n\n${conversation}` }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3072,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const result = JSON.parse(content);

    const postVisitSummary: PostVisitSummary = {
      summaryId: `pvs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      patientFriendlySummary: result.patientFriendlySummary || "Visit summary generated. Please review details below.",
      whatWasDiscussed: result.whatWasDiscussed || [],
      actionItems: (result.actionItems || []).map((item: any, idx: number) => ({
        id: `pvs-action-${Date.now()}-${idx}`,
        task: item.task || "",
        category: item.category || "other",
        priority: item.priority || "medium",
        dueDescription: item.dueDescription,
        dueDays: item.dueDays ?? null,
        completed: false,
      })),
      medicationChanges: result.medicationChanges || [],
      followUpAppointments: (result.followUpAppointments || []).map((apt: any) => ({
        description: apt.description || "",
        timing: apt.timing || "",
        dueDays: apt.dueDays ?? null,
      })),
      warningSignsToWatch: result.warningSignsToWatch || [],
      questionsToAsk: result.questionsToAsk || [],
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };

    return { postVisitSummary, disclaimer: NO_CDS_DISCLAIMER };
  } catch (error) {
    console.error("[MedicalScribe] Error generating post-visit summary:", error);
    return buildFallbackPostVisitSummary(conversation);
  }
}

function buildFallbackPostVisitSummary(conversation: string): { postVisitSummary: PostVisitSummary; disclaimer: string } {
  const symptoms = extractBasicSymptoms(conversation);
  const medications = extractBasicMedications(conversation);

  const actionItems: ActionItem[] = medications.map((med, i) => ({
    id: `pvs-fb-action-${Date.now()}-${i}`,
    task: `Continue taking ${med} as directed`,
    category: "medication" as const,
    priority: "medium" as const,
    dueDescription: "Ongoing",
    completed: false,
  }));

  const postVisitSummary: PostVisitSummary = {
    summaryId: `pvs-fb-${Date.now()}`,
    patientFriendlySummary: "Your visit summary has been generated. Please review the details below and discuss any questions with your provider.",
    whatWasDiscussed: symptoms.length > 0 ? [`Symptoms discussed: ${symptoms.join(", ")}`] : ["Please review the full conversation for details"],
    actionItems,
    medicationChanges: medications.map(m => ({ medication: m, change: "Discussed during visit" })),
    followUpAppointments: [],
    warningSignsToWatch: [],
    questionsToAsk: [],
    generatedAt: new Date().toISOString(),
    disclaimer: NO_CDS_DISCLAIMER,
  };

  return { postVisitSummary, disclaimer: NO_CDS_DISCLAIMER };
}

console.log("[AIMedicalScribe] Service initialized with NO-CDS compliance");
