import { generateText, getProviderForFeature } from "./ai-provider";

export interface MedicalEntity {
  text: string;
  type: "PROBLEM" | "PROCEDURE" | "MEDICATION" | "ANATOMY" | "TEST" | "TREATMENT";
  icdCode?: string;
  cptCode?: string;
  snomedCode?: string;
  confidence: number;
  offset?: { start: number; end: number };
}

export interface NLPExtractionResult {
  entities: MedicalEntity[];
  icdSuggestions: CodeSuggestion[];
  cptSuggestions: CodeSuggestion[];
  relationships: EntityRelationship[];
  sourceMethod: "healthcare-nlp-api" | "ai-provider-extraction";
  processedAt: string;
}

export interface CodeSuggestion {
  type: "ICD-10" | "CPT";
  code: string;
  description: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
  linkedEntity?: string;
}

export interface EntityRelationship {
  subjectEntity: string;
  relation: "TREATS" | "DIAGNOSES" | "CAUSES" | "ASSOCIATED_WITH" | "CONTRAINDICATED_WITH";
  objectEntity: string;
}

const ENTITY_EXTRACTION_PROMPT = `You are a medical NLP entity extraction engine. Analyze the clinical text and extract structured medical entities with standardized code mappings.

For each entity found, determine:
1. The entity text (exact span from the clinical text)
2. The entity type: PROBLEM (diagnoses/conditions), PROCEDURE (surgical/diagnostic procedures), MEDICATION (drugs/therapeutics), ANATOMY (body parts/systems), TEST (lab tests/imaging), TREATMENT (non-medication treatments)
3. The most specific ICD-10-CM code (for PROBLEMs)
4. The most specific CPT code (for PROCEDUREs and TESTs)
5. A confidence score (0.0 to 1.0) based on how clearly the entity is stated

Also identify relationships between entities:
- TREATS: medication/treatment → problem
- DIAGNOSES: test → problem
- CAUSES: problem → problem
- ASSOCIATED_WITH: anatomy → problem
- CONTRAINDICATED_WITH: medication → medication/problem

Return valid JSON:
{
  "entities": [
    {
      "text": "exact text from input",
      "type": "PROBLEM|PROCEDURE|MEDICATION|ANATOMY|TEST|TREATMENT",
      "icdCode": "code or null",
      "cptCode": "code or null",
      "snomedCode": "code or null",
      "confidence": 0.0-1.0
    }
  ],
  "icdSuggestions": [
    {
      "type": "ICD-10",
      "code": "E11.65",
      "description": "Type 2 diabetes mellitus with hyperglycemia",
      "confidence": "high|medium|low",
      "rationale": "linking evidence from clinical text",
      "linkedEntity": "the entity text this code maps to"
    }
  ],
  "cptSuggestions": [
    {
      "type": "CPT",
      "code": "99214",
      "description": "Office visit, established patient, moderate complexity",
      "confidence": "high|medium|low",
      "rationale": "linking evidence from clinical text",
      "linkedEntity": "the entity text this code maps to"
    }
  ],
  "relationships": [
    {
      "subjectEntity": "entity text",
      "relation": "TREATS|DIAGNOSES|CAUSES|ASSOCIATED_WITH|CONTRAINDICATED_WITH",
      "objectEntity": "entity text"
    }
  ]
}

RULES:
- Extract ALL clinically relevant entities, not just diagnoses.
- Code to the highest specificity supported by the documentation.
- For ICD-10: include laterality, episode, and type qualifiers when documented.
- For CPT: consider E/M level based on complexity indicators in the text.
- Confidence scoring: 1.0 = explicitly stated with supporting detail; 0.7-0.9 = clearly implied; 0.4-0.6 = possibly relevant but ambiguous.
- These are SUGGESTIONS only — all codes require professional coder/physician review.`;

function isHealthcareNLPAvailable(): boolean {
  return !!(
    process.env.GCP_HEALTHCARE_NLP_ENDPOINT &&
    process.env.VERTEX_PROJECT_ID
  );
}

async function extractViaHealthcareNLP(clinicalText: string): Promise<NLPExtractionResult> {
  const projectId = process.env.VERTEX_PROJECT_ID || "united-planet-485003-n7";
  const location = process.env.VERTEX_LOCATION || "us-central1";
  const endpoint = process.env.GCP_HEALTHCARE_NLP_ENDPOINT ||
    `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/services/nlp:analyzeEntities`;

  console.log(`[HealthcareNLP] Using GCP Healthcare NLP API at ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GCP_ACCESS_TOKEN || ""}`,
      },
      body: JSON.stringify({
        documentContent: clinicalText,
        licensedVocabularies: ["ICD10CM", "SNOMEDCT_US"],
      }),
    });

    if (!response.ok) {
      throw new Error(`Healthcare NLP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    const entities: MedicalEntity[] = (data.entityMentions || []).map((mention: any) => ({
      text: mention.text?.content || "",
      type: mapNLPEntityType(mention.type),
      icdCode: extractVocabCode(mention.linkedEntities, "ICD10CM"),
      snomedCode: extractVocabCode(mention.linkedEntities, "SNOMEDCT_US"),
      confidence: mention.confidence || 0.5,
      offset: mention.text?.beginOffset ? { start: mention.text.beginOffset, end: mention.text.beginOffset + (mention.text.content?.length || 0) } : undefined,
    }));

    const icdSuggestions: CodeSuggestion[] = entities
      .filter(e => e.icdCode && e.type === "PROBLEM")
      .map(e => ({
        type: "ICD-10" as const,
        code: e.icdCode!,
        description: e.text,
        confidence: e.confidence > 0.8 ? "high" as const : e.confidence > 0.5 ? "medium" as const : "low" as const,
        rationale: `Extracted from clinical text via Healthcare NLP API — entity: "${e.text}"`,
        linkedEntity: e.text,
      }));

    return {
      entities,
      icdSuggestions,
      cptSuggestions: [],
      relationships: extractNLPRelationships(data.relationships || []),
      sourceMethod: "healthcare-nlp-api",
      processedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("[HealthcareNLP] API call failed, falling back to AI extraction:", error.message);
    throw error;
  }
}

function mapNLPEntityType(nlpType: string): MedicalEntity["type"] {
  const mapping: Record<string, MedicalEntity["type"]> = {
    "PROBLEM": "PROBLEM",
    "PROCEDURE": "PROCEDURE",
    "MEDICATION": "MEDICATION",
    "ANATOMICAL_STRUCTURE": "ANATOMY",
    "LAB_VALUE": "TEST",
    "BODY_MEASUREMENT": "TEST",
  };
  return mapping[nlpType] || "PROBLEM";
}

function extractVocabCode(linkedEntities: any[], vocab: string): string | undefined {
  if (!linkedEntities) return undefined;
  for (const le of linkedEntities) {
    if (le.vocabularies) {
      for (const v of le.vocabularies) {
        if (v.vocabulary === vocab && v.codes?.length > 0) {
          return v.codes[0].value;
        }
      }
    }
  }
  return undefined;
}

function extractNLPRelationships(relationships: any[]): EntityRelationship[] {
  return relationships.map((r: any) => ({
    subjectEntity: r.subjectEntity?.text?.content || "",
    relation: (r.type || "ASSOCIATED_WITH") as EntityRelationship["relation"],
    objectEntity: r.objectEntity?.text?.content || "",
  }));
}

async function extractViaAIProvider(clinicalText: string): Promise<NLPExtractionResult> {
  const provider = getProviderForFeature("medical-nlp");
  console.log(`[HealthcareNLP] Using AI provider (${provider}) for entity extraction`);

  const result = await generateText({
    systemPrompt: ENTITY_EXTRACTION_PROMPT,
    userPrompt: clinicalText,
    responseFormat: "json",
    maxTokens: 3000,
    temperature: 0.2,
  }, "medical-nlp");

  const parsed = JSON.parse(result || '{"entities":[],"icdSuggestions":[],"cptSuggestions":[],"relationships":[]}');

  return {
    entities: parsed.entities || [],
    icdSuggestions: (parsed.icdSuggestions || []).map((s: any) => ({ ...s, type: "ICD-10" })),
    cptSuggestions: (parsed.cptSuggestions || []).map((s: any) => ({ ...s, type: "CPT" })),
    relationships: parsed.relationships || [],
    sourceMethod: "ai-provider-extraction",
    processedAt: new Date().toISOString(),
  };
}

export async function extractMedicalEntities(clinicalText: string): Promise<NLPExtractionResult> {
  if (isHealthcareNLPAvailable()) {
    try {
      return await extractViaHealthcareNLP(clinicalText);
    } catch {
      return await extractViaAIProvider(clinicalText);
    }
  }
  return await extractViaAIProvider(clinicalText);
}

export async function suggestCodesFromNote(
  noteContent: { subjective?: string; objective?: string; assessment?: string; plan?: string },
  chiefComplaint: string,
  conditions?: string[]
): Promise<{ icd: CodeSuggestion[]; cpt: CodeSuggestion[] }> {
  const clinicalText = [
    chiefComplaint ? `Chief Complaint: ${chiefComplaint}` : "",
    noteContent.assessment ? `Assessment: ${noteContent.assessment}` : "",
    noteContent.plan ? `Plan: ${noteContent.plan}` : "",
    noteContent.objective ? `Objective: ${noteContent.objective}` : "",
    conditions?.length ? `Active Conditions: ${conditions.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const result = await extractMedicalEntities(clinicalText);

  return {
    icd: result.icdSuggestions,
    cpt: result.cptSuggestions,
  };
}
