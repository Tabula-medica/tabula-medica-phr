import { transcribeMedicalAudio } from "./gcp-medical-speech";
import { chatComplete } from "./ai-client";
import { governedAICall, evaluateDataFlowPolicy, type DataCategory } from "./third-party-data-governance";

const DISCLAIMER = "AI-generated documentation draft. Must be reviewed, verified, and signed by a licensed healthcare provider before use in clinical care. This is not medical advice.";

interface PatientContext {
  name?: string;
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  recentVisits?: any[];
}

interface TranscriptResult {
  rawTranscript: string;
  structuredTranscript: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: Record<string, string>;
    physicalExamination?: Record<string, string>;
    assessment?: string;
    plan?: string;
  };
  speakerLabels: Array<{ speaker: string; segments: string[] }>;
  medicalTermsExtracted: string[];
  keyPointsSummary: string[];
}

interface ClinicalNoteContent {
  title: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  reviewOfSystems: Record<string, string>;
  physicalExamination: Record<string, string>;
  assessment: string;
  plan: string;
  fullNoteContent: string;
  governanceAuditId?: string;
  phiRedactedCount?: number;
  disclaimer: string;
}

interface CodeSuggestion {
  codeType: "icd10" | "cpt";
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  clinicalEvidence: string;
}

interface PriorAuthJustification {
  clinicalJustification: string;
  medicalNecessity: string;
  supportingEvidence: string[];
  alternativesConsidered: string[];
  expectedOutcome: string;
}

export interface ClinicalNoteSummary {
  chiefComplaint: string;
  diagnosis: string[];
  treatmentPlan: string;
  followUpInstructions: string;
  keyFindings: string[];
  medicationsDiscussed: string[];
  testsOrdered: string[];
  redFlags: string[];
  confidence: number;
  summaryTimestamp: string;
  sourceAttribution: string;
}

interface VoiceNoteInput {
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
  textTranscript?: string;
  clinicianId?: string;
}

interface StructuredDataInput {
  vitals?: Array<{ type: string; value: number; unit: string; date: string; trend?: string }>;
  labResults?: Array<{ name: string; value: string; unit: string; date: string; referenceRange?: string; flag?: string }>;
  conditions?: string[];
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies?: string[];
  procedures?: string[];
  immunizations?: string[];
}

interface AutomatedDraftRequest {
  patientContext: PatientContext;
  structuredData: StructuredDataInput;
  voiceNote?: VoiceNoteInput;
  noteType?: string;
  userId?: string;
  encounterType?: string;
  chiefComplaint?: string;
}

interface AutomatedDraftResponse {
  draftNote: ClinicalNoteContent;
  voiceTranscript?: TranscriptResult;
  codeSuggestions: CodeSuggestion[];
  qualityMetrics: {
    completenessScore: number;
    dataSourcesCited: string[];
    governanceCompliant: boolean;
    phiFieldsRedacted: number;
  };
  governanceAuditIds: string[];
  disclaimer: string;
}

function determineDataCategories(context: PatientContext, structured?: StructuredDataInput): DataCategory[] {
  const categories: DataCategory[] = ["demographics"];
  if (context.conditions?.length || structured?.conditions?.length) categories.push("conditions");
  if (context.medications?.length || structured?.medications?.length) categories.push("medications");
  if (context.allergies?.length || structured?.allergies?.length) categories.push("allergies");
  if (structured?.vitals?.length) categories.push("vitals");
  if (structured?.labResults?.length) categories.push("lab_results");
  if (structured?.immunizations?.length) categories.push("immunizations");
  if (structured?.procedures?.length) categories.push("clinical_notes");
  return categories;
}

export async function transcribeAndStructureConversation(
  transcript: string,
  patientContext?: PatientContext,
  userId?: string
): Promise<TranscriptResult> {
  const contextInfo = patientContext
    ? `Patient Context: ${patientContext.name || "Unknown"}, ${patientContext.age || "Unknown"} years old, ${patientContext.gender || "Unknown"}.
       Known conditions: ${patientContext.conditions?.join(", ") || "None listed"}
       Current medications: ${patientContext.medications?.join(", ") || "None listed"}
       Allergies: ${patientContext.allergies?.join(", ") || "None listed"}`
    : "";

  const dataCategories = patientContext ? determineDataCategories(patientContext) : ["clinical_notes" as DataCategory];

  const systemPrompt = `You are a medical documentation AI assistant specialized in structuring clinical conversations into organized clinical notes. 
Extract and structure the following from the conversation transcript:
1. Identify speakers (provider vs patient)
2. Extract chief complaint
3. Identify history of present illness details
4. Extract review of systems findings
5. Note any physical examination findings mentioned
6. Identify assessment/diagnosis discussion
7. Extract treatment plan details
8. List all medical terms and clinical terminology used
9. Summarize key clinical points

Respond in JSON format with the following structure:
{
  "structuredTranscript": {
    "chiefComplaint": "string",
    "historyOfPresentIllness": "string",
    "reviewOfSystems": { "system": "finding" },
    "physicalExamination": { "system": "finding" },
    "assessment": "string",
    "plan": "string"
  },
  "speakerLabels": [{ "speaker": "Provider/Patient", "segments": ["text"] }],
  "medicalTermsExtracted": ["term1", "term2"],
  "keyPointsSummary": ["point1", "point2"]
}`;

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "transcribeAndStructureConversation",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt,
    userPrompt: `${contextInfo}\n\nTranscript:\n${transcript}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  const result = JSON.parse(response.content);
  return {
    rawTranscript: transcript,
    ...result,
  };
}

export async function generateClinicalNote(
  patientContext: PatientContext,
  transcript?: TranscriptResult,
  caseReview?: any,
  noteType: string = "soap",
  structuredData?: StructuredDataInput,
  userId?: string
): Promise<ClinicalNoteContent> {
  const transcriptInfo = transcript
    ? `Structured Transcript Data:
       Chief Complaint: ${transcript.structuredTranscript?.chiefComplaint || "Not provided"}
       HPI: ${transcript.structuredTranscript?.historyOfPresentIllness || "Not provided"}
       ROS: ${JSON.stringify(transcript.structuredTranscript?.reviewOfSystems || {})}
       Physical Exam: ${JSON.stringify(transcript.structuredTranscript?.physicalExamination || {})}
       Key Points: ${transcript.keyPointsSummary?.join(", ") || "None"}`
    : "";

  const caseReviewInfo = caseReview
    ? `AI Case Review Data:
       Diagnoses: ${JSON.stringify(caseReview.potentialDiagnoses || [])}
       Treatment Options: ${JSON.stringify(caseReview.treatmentOptions || [])}
       Risk Assessment: ${JSON.stringify(caseReview.riskAssessment || {})}`
    : "";

  const structuredInfo = structuredData
    ? `\nStructured Clinical Data:
       Vitals: ${structuredData.vitals?.map(v => `${v.type}: ${v.value} ${v.unit}${v.trend ? ` [${v.trend}]` : ""}`).join(", ") || "None"}
       Labs: ${structuredData.labResults?.map(l => `${l.name}: ${l.value} ${l.unit}${l.flag ? ` [${l.flag}]` : ""}`).join(", ") || "None"}
       Active Conditions: ${structuredData.conditions?.join(", ") || "From patient context"}
       Medications: ${structuredData.medications?.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join(", ") || "From patient context"}
       Allergies: ${structuredData.allergies?.join(", ") || "From patient context"}
       Procedures: ${structuredData.procedures?.join(", ") || "None"}
       Immunizations: ${structuredData.immunizations?.join(", ") || "None"}`
    : "";

  const dataCategories = determineDataCategories(patientContext, structuredData);

  const systemPrompt = `You are a medical documentation AI that generates professional clinical notes following ${noteType.toUpperCase()} format.
Generate a complete clinical note that is:
- Professional and medically accurate
- Properly formatted for EHR documentation
- Includes all relevant clinical details from both structured data and transcript
- Uses appropriate medical terminology
- Incorporates vitals, lab results, and condition history when available

Respond in JSON format:
{
  "title": "Brief descriptive title",
  "chiefComplaint": "Primary reason for visit",
  "historyOfPresentIllness": "Detailed narrative of present illness",
  "reviewOfSystems": { "constitutional": "findings", "cardiovascular": "findings" },
  "physicalExamination": { "vitals": "findings", "general": "findings" },
  "assessment": "Clinical assessment and diagnoses",
  "plan": "Treatment plan with numbered items",
  "fullNoteContent": "Complete formatted note as would appear in EHR"
}`;

  const userPrompt = `Generate a ${noteType} clinical note for:

Patient: ${patientContext.name || "Patient"}, ${patientContext.age || "Unknown"} y/o ${patientContext.gender || ""}
Conditions: ${patientContext.conditions?.join(", ") || "None listed"}
Medications: ${patientContext.medications?.join(", ") || "None listed"}
Allergies: ${patientContext.allergies?.join(", ") || "NKDA"}

${structuredInfo}

${transcriptInfo}

${caseReviewInfo}`;

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "generateClinicalNote",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt,
    userPrompt,
    dataCategories,
    maxTokens: 8192,
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return {
    ...parsed,
    governanceAuditId: response.auditId,
    phiRedactedCount: response.redactedFieldCount,
    disclaimer: DISCLAIMER,
  };
}

export async function suggestMedicalCodes(
  clinicalNoteContent: string,
  patientContext?: PatientContext,
  userId?: string
): Promise<CodeSuggestion[]> {
  const dataCategories: DataCategory[] = ["conditions", "clinical_notes"];
  if (patientContext?.medications?.length) dataCategories.push("medications");

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "suggestMedicalCodes",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a certified medical coder AI assistant. Analyze clinical documentation and suggest appropriate:
1. ICD-10 diagnosis codes - for conditions documented
2. CPT procedure codes - for services rendered

For each code, provide:
- The specific code
- Full description
- Confidence level (0-100)
- Clinical reasoning for why this code applies
- Specific evidence from the documentation

Be conservative and only suggest codes with clear clinical evidence.

Respond in JSON format:
{
  "suggestions": [
    {
      "codeType": "icd10" or "cpt",
      "code": "code",
      "description": "full description",
      "confidence": 85,
      "reasoning": "why this code applies",
      "clinicalEvidence": "specific text from documentation"
    }
  ]
}`,
    userPrompt: `Analyze this clinical documentation and suggest appropriate ICD-10 and CPT codes:

${clinicalNoteContent}

${patientContext ? `Patient Context: ${patientContext.conditions?.join(", ") || "No known conditions"}` : ""}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  const result = JSON.parse(response.content);
  return result.suggestions || [];
}

export async function generatePriorAuthJustification(
  requestType: string,
  serviceDescription: string,
  patientContext: PatientContext,
  clinicalNote?: string,
  existingCodes?: { icd: string[]; cpt: string[] },
  userId?: string
): Promise<PriorAuthJustification> {
  const dataCategories = determineDataCategories(patientContext);

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "generatePriorAuthJustification",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a prior authorization specialist AI. Generate compelling clinical justifications that demonstrate medical necessity for insurance approval.

Your justification should:
- Be evidence-based and cite specific clinical criteria
- Reference relevant clinical guidelines (when applicable)
- Clearly establish medical necessity
- Address common denial reasons proactively
- Include specific patient factors that support the request

Respond in JSON format:
{
  "clinicalJustification": "Comprehensive clinical justification paragraph",
  "medicalNecessity": "Clear statement of medical necessity",
  "supportingEvidence": ["Evidence point 1", "Evidence point 2"],
  "alternativesConsidered": ["Alternative 1 - why not suitable", "Alternative 2 - why not suitable"],
  "expectedOutcome": "Expected clinical benefit and outcome"
}`,
    userPrompt: `Generate a prior authorization justification for:

Request Type: ${requestType}
Service/Procedure: ${serviceDescription}

Patient Information:
- Age: ${patientContext.age || "Unknown"}
- Gender: ${patientContext.gender || "Unknown"}
- Conditions: ${patientContext.conditions?.join(", ") || "Not specified"}
- Current Medications: ${patientContext.medications?.join(", ") || "Not specified"}
- Allergies: ${patientContext.allergies?.join(", ") || "NKDA"}

${existingCodes ? `Supporting Codes:
- ICD-10: ${existingCodes.icd?.join(", ") || "None"}
- CPT: ${existingCodes.cpt?.join(", ") || "None"}` : ""}

${clinicalNote ? `Clinical Documentation:\n${clinicalNote}` : ""}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(response.content);
}

export async function summarizeClinicalNote(
  noteContent: string,
  noteType: string,
  patientContext?: PatientContext,
  userId?: string
): Promise<ClinicalNoteSummary> {
  const contextInfo = patientContext
    ? `Patient Context: ${patientContext.name || "Unknown"}, ${patientContext.age || "Unknown"} years old, ${patientContext.gender || "Unknown"}.
       Known conditions: ${patientContext.conditions?.join(", ") || "None listed"}
       Current medications: ${patientContext.medications?.join(", ") || "None listed"}
       Allergies: ${patientContext.allergies?.join(", ") || "None listed"}`
    : "";

  const dataCategories = patientContext ? determineDataCategories(patientContext) : ["clinical_notes" as DataCategory];

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "summarizeClinicalNote",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a medical documentation AI assistant specialized in summarizing clinical notes for healthcare providers. 
Extract key clinical information from the note and structure it into a concise, actionable summary.

Your summary must be:
1. Accurate - only include information explicitly stated in the note
2. Complete - capture all clinically relevant details
3. Actionable - highlight follow-up instructions and pending items
4. Safe - flag any potential red flags or urgent concerns

${contextInfo}

Respond in JSON format with the following structure:
{
  "chiefComplaint": "Primary reason for visit in 1-2 sentences",
  "diagnosis": ["Array of diagnoses mentioned or suspected"],
  "treatmentPlan": "Concise summary of treatment plan",
  "followUpInstructions": "Follow-up timeline and instructions",
  "keyFindings": ["Array of significant clinical findings"],
  "medicationsDiscussed": ["Array of medications mentioned (new, continued, or changed)"],
  "testsOrdered": ["Array of labs, imaging, or other tests ordered"],
  "redFlags": ["Array of any concerning findings or urgent items - empty if none"],
  "confidence": 0.0-1.0
}`,
    userPrompt: `Summarize this ${noteType} clinical note:\n\n${noteContent}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return {
    chiefComplaint: parsed.chiefComplaint || "Not documented",
    diagnosis: parsed.diagnosis || [],
    treatmentPlan: parsed.treatmentPlan || "Not documented",
    followUpInstructions: parsed.followUpInstructions || "Not documented",
    keyFindings: parsed.keyFindings || [],
    medicationsDiscussed: parsed.medicationsDiscussed || [],
    testsOrdered: parsed.testsOrdered || [],
    redFlags: parsed.redFlags || [],
    confidence: parsed.confidence || 0.85,
    summaryTimestamp: new Date().toISOString(),
    sourceAttribution: `AI-generated summary via governed data flow. PHI de-identified. ${DISCLAIMER}`,
  };
}

export async function transcribeVoiceNote(
  voiceInput: VoiceNoteInput,
  patientContext?: PatientContext,
  userId?: string
): Promise<TranscriptResult> {
  let rawTranscript = voiceInput.textTranscript || "";

  if (!rawTranscript && voiceInput.audioBase64) {
    const policy = evaluateDataFlowPolicy(
      "openai",
      "documentation",
      ["clinical_notes"],
      "ai-clinical-documentation",
      "transcribeVoiceNote",
      undefined,
      userId
    );

    if (!policy.allowed) {
      throw new Error(`Voice transcription blocked by data governance: ${policy.violations.join("; ")}`);
    }

    try {
      // Routed through GCP Medical Speech (covered by existing GCP BAA).
      // Whisper is not used because OpenAI is no longer covered for PHI.
      const mime = voiceInput.mimeType || "audio/mp4";
      const encoding = mime.includes("wav")
        ? "LINEAR16"
        : mime.includes("mp3")
          ? "MP3"
          : mime.includes("ogg")
            ? "OGG_OPUS"
            : "WEBM_OPUS";
      const result = await transcribeMedicalAudio({
        audioBase64: voiceInput.audioBase64,
        encoding,
        medicalModel: true,
        punctuation: true,
      });
      rawTranscript = result.transcript;
      console.log(`[ClinDoc] Voice note transcribed: ${rawTranscript.length} chars (provider=${result.provider})`);
    } catch (err: any) {
      console.error("[ClinDoc] GCP Medical Speech transcription error:", err.message);
      throw new Error(`Voice transcription failed: ${err.message}`);
    }
  }

  if (!rawTranscript) {
    throw new Error("No transcript available. Provide either audioBase64 or textTranscript.");
  }

  return transcribeAndStructureConversation(rawTranscript, patientContext, userId);
}

export async function generateAutomatedDraft(
  request: AutomatedDraftRequest
): Promise<AutomatedDraftResponse> {
  const { patientContext, structuredData, voiceNote, noteType = "soap", userId, encounterType, chiefComplaint } = request;
  const auditIds: string[] = [];
  let totalRedactions = 0;
  const dataSources: string[] = [];

  let voiceTranscript: TranscriptResult | undefined;
  if (voiceNote && (voiceNote.audioBase64 || voiceNote.textTranscript)) {
    voiceTranscript = await transcribeVoiceNote(voiceNote, patientContext, userId);
    dataSources.push("clinician_voice_note");
  }

  if (structuredData.vitals?.length) dataSources.push("vitals");
  if (structuredData.labResults?.length) dataSources.push("lab_results");
  if (structuredData.conditions?.length) dataSources.push("conditions");
  if (structuredData.medications?.length) dataSources.push("medications");
  if (structuredData.allergies?.length) dataSources.push("allergies");
  if (structuredData.procedures?.length) dataSources.push("procedures");
  if (structuredData.immunizations?.length) dataSources.push("immunizations");

  const enrichedContext = {
    ...patientContext,
    conditions: [
      ...(patientContext.conditions || []),
      ...(structuredData.conditions || []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    medications: [
      ...(patientContext.medications || []),
      ...(structuredData.medications?.map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`) || []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    allergies: [
      ...(patientContext.allergies || []),
      ...(structuredData.allergies || []),
    ].filter((v, i, a) => a.indexOf(v) === i),
  };

  const draftNote = await generateClinicalNote(
    enrichedContext,
    voiceTranscript,
    undefined,
    noteType,
    structuredData,
    userId
  );

  if (draftNote.governanceAuditId) auditIds.push(draftNote.governanceAuditId);
  totalRedactions += draftNote.phiRedactedCount || 0;

  const codeSuggestions = await suggestMedicalCodes(
    draftNote.fullNoteContent || draftNote.assessment + " " + draftNote.plan,
    enrichedContext,
    userId
  );

  let completenessScore = 0;
  if (draftNote.chiefComplaint) completenessScore += 15;
  if (draftNote.historyOfPresentIllness) completenessScore += 20;
  if (draftNote.reviewOfSystems && Object.keys(draftNote.reviewOfSystems).length > 0) completenessScore += 15;
  if (draftNote.physicalExamination && Object.keys(draftNote.physicalExamination).length > 0) completenessScore += 15;
  if (draftNote.assessment) completenessScore += 20;
  if (draftNote.plan) completenessScore += 15;

  return {
    draftNote,
    voiceTranscript,
    codeSuggestions,
    qualityMetrics: {
      completenessScore,
      dataSourcesCited: dataSources,
      governanceCompliant: true,
      phiFieldsRedacted: totalRedactions,
    },
    governanceAuditIds: auditIds,
    disclaimer: DISCLAIMER,
  };
}

export async function simulateAudioTranscription(
  audioDescription: string,
  userId?: string
): Promise<string> {
  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "simulateAudioTranscription",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are simulating a medical conversation transcription. Generate a realistic patient-provider conversation based on the description provided. Include:
- Natural dialogue between provider and patient
- Medical terminology
- Chief complaint discussion
- History taking
- Review of symptoms
- Physical exam discussion (if applicable)
- Assessment and plan discussion

Keep the conversation realistic and clinically appropriate.`,
    userPrompt: `Generate a realistic medical conversation transcript based on: ${audioDescription}`,
    dataCategories: ["clinical_notes"],
    maxTokens: 4096,
  });

  return response.content;
}

interface SectionScore {
  chiefComplaint: number;
  hpi: number;
  ros: number;
  physicalExam: number;
  assessment: number;
  plan: number;
}

interface CompletenessIndicator {
  section: string;
  status: "complete" | "partial" | "missing";
  suggestions: string[];
}

interface ClinicalAccuracyFlag {
  issue: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

interface ComplianceCheck {
  check: string;
  passed: boolean;
  notes: string;
}

export interface NoteQualityAssessment {
  overallScore: number;
  sectionScores: SectionScore;
  completenessIndicators: CompletenessIndicator[];
  clinicalAccuracyFlags: ClinicalAccuracyFlag[];
  readabilityScore: number;
  complianceChecks: ComplianceCheck[];
  improvementSuggestions: string[];
  disclaimer: string;
}

export async function assessNoteQuality(
  noteContent: ClinicalNoteContent,
  userId?: string
): Promise<NoteQualityAssessment> {
  const dataCategories: DataCategory[] = ["clinical_notes"];

  const noteText = `
Chief Complaint: ${noteContent.chiefComplaint || "Not provided"}
History of Present Illness: ${noteContent.historyOfPresentIllness || "Not provided"}
Review of Systems: ${JSON.stringify(noteContent.reviewOfSystems || {})}
Physical Examination: ${JSON.stringify(noteContent.physicalExamination || {})}
Assessment: ${noteContent.assessment || "Not provided"}
Plan: ${noteContent.plan || "Not provided"}
`;

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "assessNoteQuality",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a clinical documentation quality expert. Analyze the provided clinical note and provide a comprehensive quality assessment.

Evaluate:
1. Completeness of each section (0-100 for each)
2. Overall documentation quality (0-100)
3. Clinical accuracy and red flags
4. Readability for clinical staff
5. HIPAA and documentation compliance
6. Actionable improvement suggestions

Respond in JSON format:
{
  "overallScore": 0-100,
  "sectionScores": {
    "chiefComplaint": 0-100,
    "hpi": 0-100,
    "ros": 0-100,
    "physicalExam": 0-100,
    "assessment": 0-100,
    "plan": 0-100
  },
  "completenessIndicators": [
    {
      "section": "section name",
      "status": "complete|partial|missing",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "clinicalAccuracyFlags": [
    {
      "issue": "description of issue",
      "severity": "low|medium|high",
      "suggestion": "recommendation"
    }
  ],
  "readabilityScore": 0-100,
  "complianceChecks": [
    {
      "check": "check description",
      "passed": true/false,
      "notes": "explanation"
    }
  ],
  "improvementSuggestions": ["suggestion1", "suggestion2"]
}`,
    userPrompt: `Assess the quality of this clinical note:\n${noteText}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return {
    overallScore: parsed.overallScore || 0,
    sectionScores: parsed.sectionScores || {
      chiefComplaint: 0,
      hpi: 0,
      ros: 0,
      physicalExam: 0,
      assessment: 0,
      plan: 0,
    },
    completenessIndicators: parsed.completenessIndicators || [],
    clinicalAccuracyFlags: parsed.clinicalAccuracyFlags || [],
    readabilityScore: parsed.readabilityScore || 0,
    complianceChecks: parsed.complianceChecks || [],
    improvementSuggestions: parsed.improvementSuggestions || [],
    disclaimer: DISCLAIMER,
  };
}

interface EnrichedClinicalNote extends ClinicalNoteContent {
  enrichmentMetadata?: {
    dataSourcesIntegrated: string[];
    fieldsEnhanced: string[];
    integrationTimestamp: string;
  };
}

export async function enrichNoteFromStructuredData(
  partialNote: Partial<ClinicalNoteContent>,
  structuredData: StructuredDataInput,
  userId?: string
): Promise<EnrichedClinicalNote> {
  const dataCategories = determineDataCategories({}, structuredData);
  dataCategories.push("clinical_notes");

  const structuredDataInfo = `
Available Structured Data:
- Vitals: ${structuredData.vitals?.map(v => `${v.type}: ${v.value} ${v.unit}${v.trend ? ` [${v.trend}]` : ""}`).join(", ") || "None"}
- Labs: ${structuredData.labResults?.map(l => `${l.name}: ${l.value} ${l.unit}${l.flag ? ` [${l.flag}]` : ""}`).join(", ") || "None"}
- Active Conditions: ${structuredData.conditions?.join(", ") || "None"}
- Medications: ${structuredData.medications?.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join(", ") || "None"}
- Allergies: ${structuredData.allergies?.join(", ") || "None"}
- Procedures: ${structuredData.procedures?.join(", ") || "None"}
- Immunizations: ${structuredData.immunizations?.join(", ") || "None"}
`;

  const currentNote = `
Current Note Content (may be partial):
- Chief Complaint: ${partialNote.chiefComplaint || "[Empty - suggest based on vitals/chief reason for visit]"}
- History of Present Illness: ${partialNote.historyOfPresentIllness || "[Empty - enhance with clinical context]"}
- Review of Systems: ${JSON.stringify(partialNote.reviewOfSystems || {})}
- Physical Examination: ${JSON.stringify(partialNote.physicalExamination || {})}
- Assessment: ${partialNote.assessment || "[Empty - generate based on available data]"}
- Plan: ${partialNote.plan || "[Empty - suggest treatment based on conditions and medications]"}
`;

  const response = await governedAICall({
    callerService: "ai-clinical-documentation",
    callerMethod: "enrichNoteFromStructuredData",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a clinical documentation assistant. Your task is to enrich a partial clinical note by integrating available structured data (vitals, labs, conditions, medications) into the appropriate note sections.

For each section:
- Chief Complaint: Ensure it reflects the primary reason for visit
- History of Present Illness: Add relevant clinical findings from available data
- Review of Systems: Include findings that support or refute documented conditions
- Physical Examination: Incorporate vital signs and relevant clinical findings
- Assessment: Create comprehensive assessment based on documented findings and conditions
- Plan: Develop evidence-based plan incorporating current medications and clinical data

Respond in JSON format:
{
  "title": "descriptive title",
  "chiefComplaint": "primary reason for visit",
  "historyOfPresentIllness": "enriched narrative",
  "reviewOfSystems": { "system": "finding" },
  "physicalExamination": { "measurement": "value/finding" },
  "assessment": "comprehensive assessment",
  "plan": "treatment plan",
  "fullNoteContent": "complete formatted note",
  "enrichmentMetadata": {
    "dataSourcesIntegrated": ["source1", "source2"],
    "fieldsEnhanced": ["field1", "field2"],
    "integrationTimestamp": "ISO timestamp"
  }
}`,
    userPrompt: `Enrich this clinical note with structured data:\n${currentNote}\n${structuredDataInfo}`,
    dataCategories,
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return {
    title: parsed.title || partialNote.title || "Clinical Note",
    chiefComplaint: parsed.chiefComplaint || partialNote.chiefComplaint || "",
    historyOfPresentIllness: parsed.historyOfPresentIllness || partialNote.historyOfPresentIllness || "",
    reviewOfSystems: parsed.reviewOfSystems || partialNote.reviewOfSystems || {},
    physicalExamination: parsed.physicalExamination || partialNote.physicalExamination || {},
    assessment: parsed.assessment || partialNote.assessment || "",
    plan: parsed.plan || partialNote.plan || "",
    fullNoteContent: parsed.fullNoteContent || "",
    disclaimer: DISCLAIMER,
    enrichmentMetadata: parsed.enrichmentMetadata || {
      dataSourcesIntegrated: [],
      fieldsEnhanced: [],
      integrationTimestamp: new Date().toISOString(),
    },
  };
}
