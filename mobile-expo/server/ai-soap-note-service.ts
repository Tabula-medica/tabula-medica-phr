import { governedAICall, type DataCategory } from "./third-party-data-governance";

const DISCLAIMER = "AI-generated documentation draft. Must be reviewed, verified, and signed by a licensed healthcare provider before use in clinical care. This is not medical advice.";

export interface SOAPSection {
  title: string;
  content: string;
  aiConfidence: number;
  sourceSnippets: string[];
}

export interface ExtractedEntity {
  type: "diagnosis" | "medication" | "procedure" | "symptom" | "vital_sign" | "allergy" | "lab_result";
  value: string;
  context: string;
  confidence: number;
}

export interface CodeSuggestion {
  codeType: "icd10" | "cpt";
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  clinicalEvidence: string;
}

export interface SOAPNoteResult {
  subjective: SOAPSection;
  objective: SOAPSection;
  assessment: SOAPSection;
  plan: SOAPSection;
  entities: ExtractedEntity[];
  codeSuggestions: CodeSuggestion[];
  qualityScore: number;
  warnings: string[];
  disclaimer: string;
  governanceAuditId?: string;
}

export interface PatientContext {
  name?: string;
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
}

function determineDataCategories(context?: PatientContext): DataCategory[] {
  const categories: DataCategory[] = ["clinical_notes"];
  if (context?.conditions?.length) categories.push("conditions");
  if (context?.medications?.length) categories.push("medications");
  if (context?.allergies?.length) categories.push("allergies");
  return categories;
}

export async function processNoteToSOAP(
  freeText: string,
  patientContext?: PatientContext,
  userId?: string
): Promise<SOAPNoteResult> {
  const dataCategories = determineDataCategories(patientContext);

  const contextInfo = patientContext
    ? `\nPatient Context:
- Name: ${patientContext.name || "Not provided"}
- Age: ${patientContext.age || "Unknown"}
- Gender: ${patientContext.gender || "Unknown"}
- Known Conditions: ${patientContext.conditions?.join(", ") || "None listed"}
- Current Medications: ${patientContext.medications?.join(", ") || "None listed"}
- Allergies: ${patientContext.allergies?.join(", ") || "NKDA"}`
    : "";

  const systemPrompt = `You are an expert clinical documentation AI assistant. Your task is to:

1. Take free-text clinical notes (dictated or typed) and organize them into proper SOAP format
2. Extract all clinically relevant entities (diagnoses, medications, procedures, symptoms, vital signs, allergies, lab results)
3. Suggest appropriate ICD-10 and CPT codes based on the documented findings

Rules:
- Only include information actually present in the input text
- Do not fabricate or assume clinical findings not mentioned
- For each SOAP section, cite which parts of the input text support the content
- Confidence scores should reflect how clearly the input supports the categorization
- Be conservative with code suggestions - only suggest codes with clear clinical evidence
- Flag any quality concerns (missing information, unclear documentation, contradictions)

Respond in JSON format:
{
  "subjective": {
    "title": "Subjective",
    "content": "Organized subjective findings including chief complaint, HPI, ROS, PMH, social/family history",
    "aiConfidence": 85,
    "sourceSnippets": ["relevant quotes from input"]
  },
  "objective": {
    "title": "Objective",
    "content": "Organized objective findings including vitals, physical exam, labs, imaging",
    "aiConfidence": 90,
    "sourceSnippets": ["relevant quotes from input"]
  },
  "assessment": {
    "title": "Assessment",
    "content": "Clinical assessment, differential diagnoses, clinical reasoning",
    "aiConfidence": 80,
    "sourceSnippets": ["relevant quotes from input"]
  },
  "plan": {
    "title": "Plan",
    "content": "Treatment plan, medications, follow-up, patient education",
    "aiConfidence": 85,
    "sourceSnippets": ["relevant quotes from input"]
  },
  "entities": [
    {
      "type": "diagnosis|medication|procedure|symptom|vital_sign|allergy|lab_result",
      "value": "entity name",
      "context": "surrounding text where entity was found",
      "confidence": 90
    }
  ],
  "codeSuggestions": [
    {
      "codeType": "icd10|cpt",
      "code": "code value",
      "description": "full code description",
      "confidence": 85,
      "reasoning": "why this code applies",
      "clinicalEvidence": "specific text supporting this code"
    }
  ],
  "qualityScore": 75,
  "warnings": ["Any documentation quality concerns"]
}`;

  const userPrompt = `Process the following clinical note into SOAP format, extract entities, and suggest codes:
${contextInfo}

Clinical Note Text:
${freeText}`;

  const response = await governedAICall({
    callerService: "ai-soap-note-service",
    callerMethod: "processNoteToSOAP",
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
    subjective: parsed.subjective || { title: "Subjective", content: "No subjective data found", aiConfidence: 0, sourceSnippets: [] },
    objective: parsed.objective || { title: "Objective", content: "No objective data found", aiConfidence: 0, sourceSnippets: [] },
    assessment: parsed.assessment || { title: "Assessment", content: "No assessment data found", aiConfidence: 0, sourceSnippets: [] },
    plan: parsed.plan || { title: "Plan", content: "No plan data found", aiConfidence: 0, sourceSnippets: [] },
    entities: parsed.entities || [],
    codeSuggestions: parsed.codeSuggestions || [],
    qualityScore: parsed.qualityScore || 0,
    warnings: parsed.warnings || [],
    disclaimer: DISCLAIMER,
    governanceAuditId: response.auditId,
  };
}

export async function extractEntities(
  text: string,
  userId?: string
): Promise<ExtractedEntity[]> {
  const response = await governedAICall({
    callerService: "ai-soap-note-service",
    callerMethod: "extractEntities",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a clinical NLP engine. Extract all clinically relevant entities from the text.

Entity types to extract:
- diagnosis: Any mentioned conditions, diseases, disorders
- medication: Any drugs, dosages, frequencies
- procedure: Any procedures, surgeries, tests ordered
- symptom: Any reported symptoms or complaints
- vital_sign: Any vital sign measurements
- allergy: Any mentioned allergies or adverse reactions
- lab_result: Any lab values or test results

Respond in JSON:
{
  "entities": [
    {
      "type": "diagnosis|medication|procedure|symptom|vital_sign|allergy|lab_result",
      "value": "extracted entity",
      "context": "surrounding sentence or phrase",
      "confidence": 90
    }
  ]
}`,
    userPrompt: text,
    dataCategories: ["clinical_notes"],
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return parsed.entities || [];
}

export async function suggestCodes(
  noteContent: string,
  entities: ExtractedEntity[],
  userId?: string
): Promise<CodeSuggestion[]> {
  const entitySummary = entities
    .filter(e => e.type === "diagnosis" || e.type === "procedure")
    .map(e => `${e.type}: ${e.value} (confidence: ${e.confidence}%)`)
    .join("\n");

  const response = await governedAICall({
    callerService: "ai-soap-note-service",
    callerMethod: "suggestCodes",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a certified medical coder. Analyze clinical documentation and extracted entities to suggest appropriate ICD-10 and CPT codes.

Guidelines:
- ICD-10 codes for documented diagnoses and conditions
- CPT codes for documented procedures and services
- Include E/M level codes when visit documentation supports it
- Be specific - use the most specific code supported by documentation
- Include confidence scores based on documentation clarity
- Only suggest codes with clear clinical evidence

Respond in JSON:
{
  "suggestions": [
    {
      "codeType": "icd10|cpt",
      "code": "code",
      "description": "full description",
      "confidence": 85,
      "reasoning": "clinical justification",
      "clinicalEvidence": "specific supporting text"
    }
  ]
}`,
    userPrompt: `Note Content:\n${noteContent}\n\nExtracted Entities:\n${entitySummary}`,
    dataCategories: ["conditions", "clinical_notes"],
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);
  return parsed.suggestions || [];
}

export async function refineSOAPSection(
  section: "subjective" | "objective" | "assessment" | "plan",
  currentContent: string,
  editInstructions: string,
  fullNoteContext: string,
  userId?: string
): Promise<SOAPSection> {
  const response = await governedAICall({
    callerService: "ai-soap-note-service",
    callerMethod: "refineSOAPSection",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a clinical documentation assistant. Refine the ${section.toUpperCase()} section of a SOAP note based on the provider's instructions. Maintain clinical accuracy and professional formatting.

Respond in JSON:
{
  "title": "${section.charAt(0).toUpperCase() + section.slice(1)}",
  "content": "refined content",
  "aiConfidence": 90,
  "sourceSnippets": ["relevant context"]
}`,
    userPrompt: `Current ${section} section:\n${currentContent}\n\nFull note context:\n${fullNoteContext}\n\nProvider instructions:\n${editInstructions}`,
    dataCategories: ["clinical_notes"],
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(response.content);
}

export interface SOAPSectionQuality {
  section: string;
  completeness: number;
  clinicalDepth: number;
  documentationStandard: "below" | "meets" | "exceeds";
  missingElements: string[];
  strengthIndicators: string[];
}

export interface SOAPQualityReport {
  sections: SOAPSectionQuality[];
  overallCompleteness: number;
  codeConfidenceSummary: {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  entityCoverage: {
    totalEntities: number;
    coveredInNote: number;
    missingFromNote: number;
  };
  actionableImprovements: string[];
  disclaimer: string;
}

export async function assessSOAPQuality(
  soapResult: SOAPNoteResult,
  userId?: string
): Promise<SOAPQualityReport> {
  const soapText = [
    `Subjective (confidence ${soapResult.subjective.aiConfidence}%): ${soapResult.subjective.content}`,
    `Objective (confidence ${soapResult.objective.aiConfidence}%): ${soapResult.objective.content}`,
    `Assessment (confidence ${soapResult.assessment.aiConfidence}%): ${soapResult.assessment.content}`,
    `Plan (confidence ${soapResult.plan.aiConfidence}%): ${soapResult.plan.content}`,
  ].join("\n\n");

  const entitySummary = soapResult.entities
    .map(e => `${e.type}: ${e.value} (${e.confidence}%)`)
    .join("; ");

  const codeSummary = soapResult.codeSuggestions
    .map(c => `${c.codeType} ${c.code}: ${c.description} (${c.confidence}%)`)
    .join("; ");

  const response = await governedAICall({
    callerService: "ai-soap-note-service",
    callerMethod: "assessSOAPQuality",
    purpose: "documentation",
    userId,
    model: "gpt-5.2",
    systemPrompt: `You are a clinical documentation quality auditor. Assess each SOAP section for completeness, clinical depth, and documentation standards.

For each section evaluate:
- Completeness (0-100): Does it contain all expected elements?
- Clinical Depth (0-100): Is the clinical detail sufficient for billing and continuity?
- Documentation Standard: "below", "meets", or "exceeds" typical standards
- Missing Elements: What expected elements are absent?
- Strength Indicators: What is well-documented?

Also assess:
- Entity coverage: How many extracted entities are reflected in the note?
- Code confidence: Categorize code suggestions by confidence level
- Actionable improvements: What specific changes would improve the note?

Respond in JSON:
{
  "sections": [
    {
      "section": "Subjective",
      "completeness": 85,
      "clinicalDepth": 80,
      "documentationStandard": "meets",
      "missingElements": ["family history", "social history"],
      "strengthIndicators": ["detailed HPI", "clear chief complaint"]
    }
  ],
  "overallCompleteness": 82,
  "codeConfidenceSummary": { "highConfidence": 3, "mediumConfidence": 1, "lowConfidence": 0 },
  "entityCoverage": { "totalEntities": 10, "coveredInNote": 8, "missingFromNote": 2 },
  "actionableImprovements": ["Add social history to subjective", "Include follow-up timeline in plan"]
}`,
    userPrompt: `Assess the quality of this SOAP note:\n\n${soapText}\n\nExtracted entities: ${entitySummary}\n\nCode suggestions: ${codeSummary}`,
    dataCategories: ["clinical_notes"],
    responseFormat: { type: "json_object" },
  });

  const parsed = JSON.parse(response.content);

  return {
    sections: parsed.sections || [],
    overallCompleteness: parsed.overallCompleteness || soapResult.qualityScore,
    codeConfidenceSummary: parsed.codeConfidenceSummary || {
      highConfidence: soapResult.codeSuggestions.filter(c => c.confidence >= 80).length,
      mediumConfidence: soapResult.codeSuggestions.filter(c => c.confidence >= 50 && c.confidence < 80).length,
      lowConfidence: soapResult.codeSuggestions.filter(c => c.confidence < 50).length,
    },
    entityCoverage: parsed.entityCoverage || {
      totalEntities: soapResult.entities.length,
      coveredInNote: soapResult.entities.length,
      missingFromNote: 0,
    },
    actionableImprovements: parsed.actionableImprovements || [],
    disclaimer: DISCLAIMER,
  };
}

export async function batchProcessNotes(
  notes: Array<{ id: string; text: string; patientContext?: PatientContext }>,
  userId?: string
): Promise<Array<{ id: string; result: SOAPNoteResult }>> {
  const results: Array<{ id: string; result: SOAPNoteResult }> = [];

  for (const note of notes) {
    try {
      const result = await processNoteToSOAP(note.text, note.patientContext, userId);
      results.push({ id: note.id, result });
    } catch (error: any) {
      console.error(`[SOAP] Batch processing error for note ${note.id}:`, error.message);
      results.push({
        id: note.id,
        result: {
          subjective: { title: "Subjective", content: "Processing failed", aiConfidence: 0, sourceSnippets: [] },
          objective: { title: "Objective", content: "Processing failed", aiConfidence: 0, sourceSnippets: [] },
          assessment: { title: "Assessment", content: "Processing failed", aiConfidence: 0, sourceSnippets: [] },
          plan: { title: "Plan", content: "Processing failed", aiConfidence: 0, sourceSnippets: [] },
          entities: [],
          codeSuggestions: [],
          qualityScore: 0,
          warnings: [`Processing failed: ${error.message}`],
          disclaimer: DISCLAIMER,
        },
      });
    }
  }

  return results;
}
