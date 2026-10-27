import { chatComplete } from "./ai-client";

export type VoiceIntent =
  | "NAVIGATE"
  | "FILL_FIELD"
  | "CONFIRM"
  | "CANCEL"
  | "READ_BACK"
  | "HELP"
  | "UNKNOWN";

export interface NavigateEntities {
  screen: string;
  screenKey:
    | "HOME"
    | "RECORDS"
    | "LAB_RESULTS"
    | "MEDICATIONS"
    | "TIMELINE"
    | "APPOINTMENTS"
    | "PROFILE"
    | "AI_ASSISTANT"
    | "HEALTH_SUMMARY"
    | "PROVIDER_SHARE"
    | "PRE_VISIT_PREP"
    | "ADD_SOURCE"
    | "BACK"
    | "UNKNOWN";
}

export interface FillFieldEntities {
  field: string;
  value: string;
}

export interface VoiceIntentResult {
  intent: VoiceIntent;
  entities: NavigateEntities | FillFieldEntities | Record<string, string>;
  confidence: number;
  rawTranscript: string;
}

const SYSTEM_PROMPT = `You are a voice command classifier for a healthcare app.
Classify the user's spoken command into exactly one of these intents and extract entities.

INTENTS:
- NAVIGATE: user wants to go to a screen. Identify the target screen.
- FILL_FIELD: user wants to fill a form field with a value. Identify field name and value.
- CONFIRM: user says "confirm", "yes", "accept", "that's correct", "looks good", "apply it", or similar.
- CANCEL: user says "cancel", "no", "undo", "never mind", "discard", or similar. (Do NOT classify "go back" here — "go back" must always route to NAVIGATE(BACK).)
- READ_BACK: user asks to read or repeat back what was entered or shown.
- HELP: user asks for help or available commands.
- UNKNOWN: command is unclear or unrelated to app navigation or form filling.

NAVIGATION SCREEN KEYS (map spoken words to these keys):
- HOME: home, dashboard, main, go home, start, main page
- RECORDS: records, my records, health records, documents, all records
- LAB_RESULTS: lab results, labs, my labs, blood tests, test results, bloodwork, laboratory
- MEDICATIONS: medications, my medications, prescriptions, drugs, pills, current medications
- TIMELINE: timeline, history, health history, chronological, events, past history
- APPOINTMENTS: appointments, my appointments, upcoming appointments, schedule, calendar, visits
- PROFILE: profile, my profile, settings, account, my account, personal settings
- AI_ASSISTANT: AI assistant, health assistant, ask AI, chat, virtual assistant, AI chat
- HEALTH_SUMMARY: health summary, my health summary, AI summary, overall health, health overview, summarize my health
- PROVIDER_SHARE: share with provider, provider summary, share my records, send to doctor, share records
- PRE_VISIT_PREP: pre-visit, pre-visit prep, visit prep, appointment prep, before appointment
- ADD_SOURCE: add source, connect records, import records, connect provider, add provider, new source
- BACK: back, go back, previous, return, previous page

FILL FIELD rules:
- Field names must be normalized to camelCase (e.g., "first name" -> "firstName", "date of birth" -> "dateOfBirth")
- Values are extracted verbatim from speech (e.g., "set first name to John" -> field="firstName", value="John")
- Common fields: firstName, lastName, middleName, dateOfBirth, sex, gender, phone, email,
  addressLine1, city, state, zipCode, occupation, bloodType,
  primaryPhysician, pharmacy, insuranceProvider, memberId

Respond ONLY with valid JSON in this exact shape (no markdown, no explanation):
{
  "intent": "<INTENT>",
  "entities": { ... },
  "confidence": <0.0-1.0>
}

For NAVIGATE: entities = { "screen": "<human label>", "screenKey": "<KEY>" }
For FILL_FIELD: entities = { "field": "<camelCase>", "value": "<spoken value>" }
For all others: entities = {}
`;

export async function classifyVoiceIntent(
  transcript: string
): Promise<VoiceIntentResult> {
  if (!transcript?.trim()) {
    return {
      intent: "UNKNOWN",
      entities: {},
      confidence: 0,
      rawTranscript: transcript ?? "",
    };
  }

  try {
    const result = await chatComplete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript.trim() },
      ],
      // Transcripts may contain patient demographics, conditions, or medication names.
      // Classify broadly so governance layer can apply appropriate minimization.
      dataCategories: ["demographics", "conditions", "medications", "identifiers"],
      purpose: "care_coordination",
      callerService: "voice-intent-service",
      callerMethod: "classifyVoiceIntent",
    });

    const raw = result.content.trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON in response");

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    return {
      intent: (parsed.intent as VoiceIntent) ?? "UNKNOWN",
      entities: parsed.entities ?? {},
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      rawTranscript: transcript,
    };
  } catch {
    return {
      intent: "UNKNOWN",
      entities: {},
      confidence: 0,
      rawTranscript: transcript,
    };
  }
}
