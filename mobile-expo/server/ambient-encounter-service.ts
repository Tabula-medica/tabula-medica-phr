// @ts-nocheck
import { chatComplete } from "./ai-client";
import { transcribeMedicalAudio } from "./gcp-medical-speech";
import { logger } from "./utils/logger";

export interface EncounterSummary {
  visitDate: string;
  reasonForVisit: string;
  keyFindings: string[];
  diagnosesDiscussed: string[];
  medicationsDiscussed: Array<{
    name: string;
    action: "new" | "continued" | "changed" | "discontinued";
    details?: string;
  }>;
  followUpActions: string[];
  providerInstructions: string[];
  vitalSigns?: Record<string, string>;
  transcript: string;
  summaryText: string;
  duration: number;
  confidence: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/webm"
): Promise<string> {
  // Routed through GCP Medical Speech (under existing GCP BAA). OpenAI Whisper
  // is no longer used because it is not covered by the GCP BAA and would
  // expose PHI to a non-BAA processor.
  const encoding = mimeType.includes("wav")
    ? "LINEAR16"
    : mimeType.includes("mp3")
      ? "MP3"
      : mimeType.includes("ogg")
        ? "OGG_OPUS"
        : "WEBM_OPUS";

  try {
    const result = await transcribeMedicalAudio({
      audioBase64: audioBuffer.toString("base64"),
      encoding,
      medicalModel: true,
      punctuation: true,
    });

    logger.info("Audio transcription completed", {
      category: "api",
      audioSizeBytes: audioBuffer.length,
      transcriptLength: result.transcript.length,
      provider: result.provider,
    });

    return result.transcript;
  } catch (error) {
    logger.error("Audio transcription failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function generateEncounterSummary(
  transcript: string,
  patientLanguage: string = "en"
): Promise<EncounterSummary> {
  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant. Analyze the following medical encounter transcript and generate a structured summary.

IMPORTANT: This summary is for the PATIENT's personal reference only. It is NOT a clinical document.

Extract the following information from the transcript:
1. Reason for visit
2. Key findings discussed
3. Diagnoses mentioned or discussed
4. Medications mentioned (indicate if new, continued, changed, or discontinued)
5. Follow-up actions recommended
6. Provider instructions given to the patient
7. Any vital signs mentioned
8. A plain-language summary paragraph

Respond with ONLY a JSON object in this format:
{
  "reasonForVisit": "string",
  "keyFindings": ["string"],
  "diagnosesDiscussed": ["string"],
  "medicationsDiscussed": [{"name": "string", "action": "new|continued|changed|discontinued", "details": "string"}],
  "followUpActions": ["string"],
  "providerInstructions": ["string"],
  "vitalSigns": {"key": "value"},
  "summaryText": "A clear, patient-friendly paragraph summarizing the visit",
  "confidence": 0.0-1.0
}

If information is not clearly stated in the transcript, do not fabricate it. Only include what was actually discussed. Set confidence based on audio clarity and completeness.`,
        },
        {
          role: "user",
          content: `Transcript:\n${transcript}`,
        },
      ],
      temperature: 0.1,
      jsonMode: true,
      maxOutputTokens: 2000,
      dataCategories: ["conditions", "medications", "vitals", "clinical_notes"],
      purpose: "documentation",
      callerService: "ambient-encounter-service",
      callerMethod: "generateEncounterSummary",
    });

    const content = response.content;
    if (!content) {
      throw new Error("Empty response from encounter summary API");
    }

    const parsed = JSON.parse(content);

    logger.info("Encounter summary generated", {
      category: "api",
      transcriptLength: transcript.length,
      confidence: parsed.confidence,
      diagnosesCount: parsed.diagnosesDiscussed?.length || 0,
      medicationsCount: parsed.medicationsDiscussed?.length || 0,
    });

    return {
      visitDate: new Date().toISOString(),
      reasonForVisit: parsed.reasonForVisit || "Not specified",
      keyFindings: parsed.keyFindings || [],
      diagnosesDiscussed: parsed.diagnosesDiscussed || [],
      medicationsDiscussed: parsed.medicationsDiscussed || [],
      followUpActions: parsed.followUpActions || [],
      providerInstructions: parsed.providerInstructions || [],
      vitalSigns: parsed.vitalSigns || {},
      transcript,
      summaryText: parsed.summaryText || "",
      duration: 0,
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    logger.error("Encounter summary generation failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export interface ActionItemExtraction {
  title: string;
  description: string;
  category: "lab_test" | "referral" | "imaging" | "follow_up" | "medication" | "lifestyle" | "other";
  priority: "high" | "medium" | "low";
  suggestedDueDays: number | null;
}

export async function extractActionItems(
  transcript: string,
  summary: EncounterSummary
): Promise<ActionItemExtraction[]> {
  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant. From the provided medical encounter transcript and summary, extract actionable to-do items for the PATIENT.

Focus on:
- Lab tests or bloodwork the provider ordered or recommended
- Referrals to specialists
- Imaging studies (X-rays, MRIs, CT scans, ultrasounds)
- Follow-up appointments to schedule
- Medication changes (new prescriptions to fill, dosage adjustments)
- Lifestyle modifications recommended (diet, exercise, etc.)

For each action item, determine:
- A clear, concise title (what the patient needs to do)
- A brief description with any relevant details mentioned
- Category: one of "lab_test", "referral", "imaging", "follow_up", "medication", "lifestyle", "other"
- Priority: "high" (urgent/time-sensitive), "medium" (should be done soon), "low" (general recommendation)
- suggestedDueDays: number of days from now the item should ideally be completed (null if no timeframe mentioned)

Only include items that were actually discussed or recommended. Do not fabricate items.

Respond with ONLY a JSON object:
{
  "actionItems": [
    {
      "title": "string",
      "description": "string",
      "category": "lab_test|referral|imaging|follow_up|medication|lifestyle|other",
      "priority": "high|medium|low",
      "suggestedDueDays": number or null
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Transcript:\n${transcript}\n\nSummary:\nReason: ${summary.reasonForVisit}\nFollow-up actions: ${summary.followUpActions.join(", ")}\nProvider instructions: ${summary.providerInstructions.join(", ")}\nMedications: ${summary.medicationsDiscussed.map((m) => `${m.name} (${m.action})`).join(", ")}`,
        },
      ],
      temperature: 0.1,
      jsonMode: true,
      maxOutputTokens: 1500,
      dataCategories: ["medications", "clinical_notes"],
      purpose: "documentation",
      callerService: "ambient-encounter-service",
      callerMethod: "extractActionItems",
    });

    const content = response.content;
    if (!content) {
      throw new Error("Empty response from action item extraction API");
    }

    const parsed = JSON.parse(content);

    logger.info("Action items extracted from encounter", {
      category: "api",
      actionItemCount: parsed.actionItems?.length || 0,
    });

    return parsed.actionItems || [];
  } catch (error) {
    logger.error("Action item extraction failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function translateEncounterSummary(
  summary: EncounterSummary,
  targetLanguage: string
): Promise<EncounterSummary> {
  if (targetLanguage === "en") return summary;

  try {
    const languageNames: Record<string, string> = {
      fa: "Farsi (Persian)",
      te: "Telugu",
      ne: "Nepali",
      ru: "Russian",
      es: "Spanish",
      fr: "French",
      zh: "Chinese",
      ar: "Arabic",
      hi: "Hindi",
      pa: "Punjabi",
      ko: "Korean",
      ja: "Japanese",
      de: "German",
      bn: "Bengali",
      tr: "Turkish",
      it: "Italian",
      th: "Thai",
      ur: "Urdu",
      vi: "Vietnamese",
      pt: "Portuguese",
      ta: "Tamil",
      mr: "Marathi",
    };

    const langName = languageNames[targetLanguage] || targetLanguage;

    const response = await chatComplete({
      model: "fast",
      messages: [
        {
          role: "system",
          content: `Translate the following medical visit summary to ${langName}. Preserve medical terminology accuracy. Respond with ONLY a JSON object with the same structure but translated values.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            reasonForVisit: summary.reasonForVisit,
            keyFindings: summary.keyFindings,
            diagnosesDiscussed: summary.diagnosesDiscussed,
            followUpActions: summary.followUpActions,
            providerInstructions: summary.providerInstructions,
            summaryText: summary.summaryText,
          }),
        },
      ],
      temperature: 0.1,
      jsonMode: true,
      maxOutputTokens: 1500,
      dataCategories: ["clinical_notes"],
      purpose: "communication",
      callerService: "ambient-encounter-service",
      callerMethod: "translateEncounterSummary",
    });

    const content = response.content;
    if (!content) return summary;

    const translated = JSON.parse(content);
    return {
      ...summary,
      reasonForVisit: translated.reasonForVisit || summary.reasonForVisit,
      keyFindings: translated.keyFindings || summary.keyFindings,
      diagnosesDiscussed:
        translated.diagnosesDiscussed || summary.diagnosesDiscussed,
      followUpActions: translated.followUpActions || summary.followUpActions,
      providerInstructions:
        translated.providerInstructions || summary.providerInstructions,
      summaryText: translated.summaryText || summary.summaryText,
    };
  } catch (error) {
    logger.error("Encounter summary translation failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
      targetLanguage,
    });
    return summary;
  }
}
