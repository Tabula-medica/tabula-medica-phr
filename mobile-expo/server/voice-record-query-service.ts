import { logger } from "./utils/logger";
import { db } from "./db";
import { healthRecords } from "@shared/schema";
import { eq, and, desc, like, gte, lte } from "drizzle-orm";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const VERTEX_AI_ENABLED = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);
// OPENAI_API_KEY intentionally not read — OpenAI direct egress disabled (no BAA).

const DISCLAIMER = "AI-generated summary. Please verify with your healthcare provider.";

export type QueryIntent =
  | "last_occurrence"
  | "list_medications"
  | "list_conditions"
  | "lab_results"
  | "immunization_history"
  | "appointment_history"
  | "medication_details"
  | "general_health"
  | "unknown";

export interface VoiceQueryRequest {
  query: string;
  userId: string;
  languageCode?: string;
}

export interface VoiceQueryResponse {
  answer: string;
  screenReaderAnswer: string;
  sources: Array<{ recordId: string; title: string; date: string; type: string }>;
  intent: QueryIntent;
  confidence: number;
  provider: "gemini" | "openai" | "rule_based";
  disclaimer: string;
}

interface ParsedIntent {
  intent: QueryIntent;
  entities: {
    recordType?: string;
    medication?: string;
    condition?: string;
    dateRange?: { start?: string; end?: string };
  };
}

interface AuditEntry {
  timestamp: string;
  userId: string;
  query: string;
  intent: QueryIntent;
  provider: "gemini" | "openai" | "rule_based";
  recordCount: number;
  latencyMs: number;
}

const queryAuditLog: AuditEntry[] = [];
const MAX_AUDIT_LOG = 1000;

function addAuditEntry(entry: AuditEntry): void {
  queryAuditLog.push(entry);
  if (queryAuditLog.length > MAX_AUDIT_LOG) {
    queryAuditLog.splice(0, queryAuditLog.length - MAX_AUDIT_LOG);
  }
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<{ content: string; provider: "gemini" }> {
  const endpoint = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/gemini-2.5-pro:generateContent`;

  let accessToken: string | undefined;
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const keyData = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      const { GoogleAuth } = await import("google-auth-library" as any);
      const auth = new GoogleAuth({
        credentials: keyData,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      accessToken = tokenResponse.token || undefined;
    } catch (err: any) {
      logger.warn("Failed to get access token from GCP_SERVICE_ACCOUNT_KEY", { error: err.message });
      throw err;
    }
  } else {
    try {
      const { GoogleAuth } = await import("google-auth-library" as any);
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      accessToken = tokenResponse.token || undefined;
    } catch (err: any) {
      logger.warn("Failed to get access token from GOOGLE_APPLICATION_CREDENTIALS", { error: err.message });
      throw err;
    }
  }

  const body = {
    contents: [
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content, provider: "gemini" };
}

// callOpenAI() removed: raw fetch to api.openai.com is a non-BAA PHI egress
// path. Voice queries carry PHI (medication names, conditions, lab discussion).
// OpenAI fallback is permanently disabled; Vertex/Gemini under GCP BAA is the
// only allowed inference path for this service.

async function callAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; provider: "gemini" }> {
  if (!VERTEX_AI_ENABLED) {
    throw new Error(
      "Voice record query unavailable: Vertex AI is not configured and the " +
      "OpenAI fallback has been disabled for HIPAA compliance (no BAA). " +
      "Configure Vertex AI to restore this feature.",
    );
  }
  return await callGemini(systemPrompt, userPrompt);
}

function ruleBasedIntentParse(query: string): ParsedIntent {
  const q = query.toLowerCase();

  if (/\b(medication|medicine|drug|prescription|pill|taking)\b/.test(q)) {
    if (/\b(detail|info|about|tell me about|dosage|dose|side effect)\b/.test(q)) {
      const medMatch = q.match(/(?:about|for|of)\s+(\w+(?:\s+\w+)?)/);
      return {
        intent: "medication_details",
        entities: { recordType: "medication", medication: medMatch?.[1] || undefined },
      };
    }
    return { intent: "list_medications", entities: { recordType: "medication" } };
  }

  if (/\b(condition|diagnosis|diagnos|disease|illness|chronic)\b/.test(q)) {
    return { intent: "list_conditions", entities: { recordType: "condition" } };
  }

  if (/\b(lab|test|result|blood work|bloodwork|panel|a1c|cholesterol|glucose)\b/.test(q)) {
    return { intent: "lab_results", entities: { recordType: "lab_result" } };
  }

  if (/\b(immunization|vaccine|vaccination|shot|booster|tetanus|flu shot|covid)\b/.test(q)) {
    const vaccineMatch = q.match(/\b(tetanus|flu|covid|hepatitis|mmr|polio|shingles|pneumonia)\b/);
    if (/\b(last|when|recent|latest)\b/.test(q)) {
      return {
        intent: "last_occurrence",
        entities: { recordType: "immunization", medication: vaccineMatch?.[1] || undefined },
      };
    }
    return {
      intent: "immunization_history",
      entities: { recordType: "immunization", medication: vaccineMatch?.[1] || undefined },
    };
  }

  if (/\b(appointment|visit|checkup|check-up|doctor visit|seen)\b/.test(q)) {
    return { intent: "appointment_history", entities: { recordType: "appointment" } };
  }

  if (/\b(last|when was|most recent|latest)\b/.test(q)) {
    return { intent: "last_occurrence", entities: {} };
  }

  if (/\b(health|summary|overview|how am i|status)\b/.test(q)) {
    return { intent: "general_health", entities: {} };
  }

  return { intent: "unknown", entities: {} };
}

export async function parseQueryIntent(query: string): Promise<ParsedIntent> {
  const systemPrompt = `You are a medical records query intent parser. Given a patient's natural language question, extract the intent and entities.

Return valid JSON only, no markdown:
{
  "intent": one of "last_occurrence", "list_medications", "list_conditions", "lab_results", "immunization_history", "appointment_history", "medication_details", "general_health", "unknown",
  "entities": {
    "recordType": optional string like "immunization", "medication", "condition", "lab_result", "appointment",
    "medication": optional string - specific medication or vaccine name,
    "condition": optional string - specific condition name,
    "dateRange": optional { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  }
}

Examples:
- "When was my last tetanus shot?" → {"intent":"last_occurrence","entities":{"recordType":"immunization","medication":"tetanus"}}
- "What medications am I taking?" → {"intent":"list_medications","entities":{"recordType":"medication"}}
- "Show me my latest lab results" → {"intent":"lab_results","entities":{"recordType":"lab_result"}}
- "Do I have any allergies on file?" → {"intent":"list_conditions","entities":{"recordType":"condition","condition":"allergy"}}`;

  try {
    const result = await callAI(systemPrompt, query);
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || "unknown",
        entities: parsed.entities || {},
      };
    }
  } catch (err: any) {
    logger.warn("AI intent parsing failed, using rule-based fallback", { error: err.message });
  }

  return ruleBasedIntentParse(query);
}

async function searchFhirStore(intent: QueryIntent, entities: any): Promise<any[] | null> {
  const gcpConfigured = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);
  const projectId = process.env.GCP_PROJECT_ID;
  const datasetId = process.env.GCP_HEALTHCARE_DATASET_ID;
  const fhirStoreId = process.env.GCP_FHIR_STORE_ID;
  const location = process.env.GCP_LOCATION || "us-central1";

  if (!gcpConfigured || !projectId || !datasetId || !fhirStoreId) {
    return null;
  }

  try {
    const { searchFhirResources } = await import("./gcp-healthcare-client");
    const credentialsRaw = process.env.GCP_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
      : JSON.parse(await import("fs").then(fs => fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, "utf8")));

    const config = { projectId, location, datasetId, fhirStoreId };

    const resourceTypeMap: Record<string, string> = {
      list_medications: "MedicationRequest",
      medication_details: "MedicationRequest",
      list_conditions: "Condition",
      lab_results: "Observation",
      immunization_history: "Immunization",
      appointment_history: "Encounter",
      last_occurrence: "Observation",
      general_health: "Observation",
    };

    const resourceType = resourceTypeMap[intent] || "Observation";
    const params: Record<string, string> = { _count: "20", _sort: "-date" };

    if (entities?.medication) {
      params.code = entities.medication;
    }
    if (entities?.condition) {
      params.code = entities.condition;
    }

    const resources = await searchFhirResources(credentialsRaw, config, resourceType, params);
    if (resources && resources.length > 0) {
      logger.info("FHIR store search returned results", {
        intent,
        resourceType,
        count: resources.length,
      });
      return resources.map((r: any) => ({
        id: r.id,
        type: resourceType.toLowerCase(),
        title: r.code?.coding?.[0]?.display || r.code?.text || r.medicationCodeableConcept?.text || r.resourceType || "Unknown",
        summary: r.text?.div || r.note?.[0]?.text || "",
        date: r.effectiveDateTime || r.authoredOn || r.recordedDate || r.period?.start || null,
        provider: r.performer?.[0]?.display || r.requester?.display || "",
        fhirResourceType: r.resourceType,
        fhirResourceId: r.id,
        rawFhirJson: r,
      }));
    }
  } catch (err: any) {
    logger.warn("FHIR store search failed, falling back to local DB", { error: err.message });
  }
  return null;
}

export async function queryRecords(userId: string, intent: QueryIntent, entities: any): Promise<any[]> {
  const fhirResults = await searchFhirStore(intent, entities);
  if (fhirResults && fhirResults.length > 0) {
    return fhirResults;
  }

  const conditions: any[] = [eq(healthRecords.userId, userId)];

  const intentToType: Record<string, string[]> = {
    list_medications: ["medication"],
    medication_details: ["medication"],
    list_conditions: ["condition", "diagnosis"],
    lab_results: ["lab_result", "lab", "observation"],
    immunization_history: ["immunization", "vaccine"],
    appointment_history: ["appointment", "encounter", "visit"],
    last_occurrence: [],
    general_health: [],
    unknown: [],
  };

  const types = [...(intentToType[intent] || [])];
  if (entities?.recordType) {
    types.push(entities.recordType);
  }

  if (types.length === 1) {
    conditions.push(eq(healthRecords.type, types[0]));
  } else if (types.length > 1) {
    const { inArray } = await import("drizzle-orm");
    conditions.push(inArray(healthRecords.type, types));
  }

  if (entities?.medication) {
    conditions.push(like(healthRecords.title, `%${entities.medication}%`));
  }

  if (entities?.condition) {
    conditions.push(like(healthRecords.title, `%${entities.condition}%`));
  }

  if (entities?.dateRange?.start) {
    conditions.push(gte(healthRecords.date, new Date(entities.dateRange.start)));
  }

  if (entities?.dateRange?.end) {
    conditions.push(lte(healthRecords.date, new Date(entities.dateRange.end)));
  }

  try {
    let query = db
      .select()
      .from(healthRecords)
      .where(and(...conditions))
      .orderBy(desc(healthRecords.date))
      .limit(20);

    const records = await query;
    logger.info("Voice query records fetched", {
      userId,
      intent,
      recordCount: records.length,
    });
    return records;
  } catch (err: any) {
    logger.error("Failed to query health records", { error: err.message, userId, intent });
    return [];
  }
}

function formatDateForScreenReader(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "unknown date";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export async function formatAnswer(
  records: any[],
  intent: QueryIntent,
  query: string,
): Promise<{ answer: string; screenReaderAnswer: string }> {
  if (records.length === 0) {
    const noDataAnswer = "I wasn't able to find any matching health records for your question. This could mean the records haven't been added yet, or the information might be categorized differently. You may want to check with your healthcare provider.";
    return {
      answer: noDataAnswer,
      screenReaderAnswer: noDataAnswer,
    };
  }

  const recordSummaries = records.slice(0, 10).map((r) => ({
    title: r.title,
    type: r.type,
    date: formatDateForScreenReader(r.date),
    summary: r.summary || "",
    provider: r.provider || "",
  }));

  const systemPrompt = `You are a helpful health records assistant creating accessible answers from patient health records.

Rules:
- Create two versions of the answer:
  1. "answer": A conversational, friendly response with relevant details. Can use light formatting.
  2. "screenReaderAnswer": Plain text optimized for screen readers and text-to-speech. No markdown, no special characters, no abbreviations. Dates must be in full format like "January 15, 2024". Numbers under 10 should be spelled out. Use simple sentence structure.
- Never provide medical advice or diagnoses
- Never include personally identifiable information
- Be warm and helpful in tone
- If results are limited, mention that these are the records currently on file

Return valid JSON only:
{"answer": "...", "screenReaderAnswer": "..."}`;

  const userPrompt = `Patient question: "${query}"
Intent: ${intent}
Records found (${records.length} total, showing up to 10):
${JSON.stringify(recordSummaries, null, 2)}

Create a helpful answer based on these records.`;

  try {
    const result = await callAI(systemPrompt, userPrompt);
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || "",
        screenReaderAnswer: parsed.screenReaderAnswer || parsed.answer || "",
      };
    }
  } catch (err: any) {
    logger.warn("AI answer formatting failed, using rule-based formatting", { error: err.message });
  }

  const firstRecord = records[0];
  const simpleAnswer = `I found ${records.length} record${records.length === 1 ? "" : "s"} matching your query. The most recent is "${firstRecord.title}" from ${formatDateForScreenReader(firstRecord.date)}.`;

  return {
    answer: simpleAnswer,
    screenReaderAnswer: simpleAnswer,
  };
}

export async function processVoiceQuery(request: VoiceQueryRequest): Promise<VoiceQueryResponse> {
  const startTime = Date.now();
  const languageCode = request.languageCode || "en-US";

  logger.info("Processing voice query", {
    userId: request.userId,
    queryLength: request.query.length,
    languageCode,
  });

  let provider: "gemini" | "rule_based" = "rule_based";
  let confidence = 0.5;
  let parsedIntent: ParsedIntent;

  try {
    parsedIntent = await parseQueryIntent(request.query);
    if (VERTEX_AI_ENABLED) {
      provider = "gemini";
      confidence = 0.85;
    } else {
      provider = "rule_based";
      confidence = 0.6;
    }
  } catch (err: any) {
    logger.warn("Intent parsing failed entirely, using rule-based", { error: err.message });
    parsedIntent = ruleBasedIntentParse(request.query);
    provider = "rule_based";
    confidence = 0.5;
  }

  const records = await queryRecords(request.userId, parsedIntent.intent, parsedIntent.entities);

  let formattedAnswer: { answer: string; screenReaderAnswer: string };
  try {
    formattedAnswer = await formatAnswer(records, parsedIntent.intent, request.query);
  } catch (err: any) {
    logger.error("Answer formatting failed", { error: err.message });
    formattedAnswer = {
      answer: "I found some records but had trouble formatting the response. Please try again.",
      screenReaderAnswer: "I found some records but had trouble formatting the response. Please try again.",
    };
  }

  const sources = records.slice(0, 10).map((r) => ({
    recordId: r.id,
    title: r.title,
    date: formatDateForScreenReader(r.date),
    type: r.type,
  }));

  const latencyMs = Date.now() - startTime;

  addAuditEntry({
    timestamp: new Date().toISOString(),
    userId: request.userId,
    query: request.query,
    intent: parsedIntent.intent,
    provider,
    recordCount: records.length,
    latencyMs,
  });

  logger.info("Voice query completed", {
    userId: request.userId,
    intent: parsedIntent.intent,
    provider,
    recordCount: records.length,
    latencyMs,
  });

  return {
    answer: formattedAnswer.answer,
    screenReaderAnswer: formattedAnswer.screenReaderAnswer,
    sources,
    intent: parsedIntent.intent,
    confidence,
    provider,
    disclaimer: DISCLAIMER,
  };
}

export function getQueryAuditLog(): AuditEntry[] {
  return [...queryAuditLog];
}
