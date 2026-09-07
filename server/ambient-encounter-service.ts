/**
 * Ambient Encounter Notes Service
 *
 * Pipeline:
 *   raw audio buffer (in memory only)
 *     → Whisper transcription
 *     → SOAP note generation (GPT-4)
 *     → Action item extraction (GPT-4)
 *
 * AUDIO STORAGE POLICY (compliance-critical):
 * The audio buffer lives ONLY in process memory for the duration of one
 * request. It is never written to disk, object storage, a database, or
 * any log line. After Whisper returns the transcript, the buffer
 * reference is dropped and garbage collection reclaims it. There is no
 * debug mode that persists audio. Do not add one.
 *
 * Output is text only: transcript + structured SOAP + action items.
 *
 * NO CDS: All AI output is informational support for the patient and
 * must not be used as clinical decision support.
 */

import OpenAI from "openai";
import { medicalSpeechToTextService } from "./services/gcp/medical-speech-to-text";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ActionItem {
  type:
    | "follow_up"
    | "prescription"
    | "referral"
    | "lab_order"
    | "imaging_order"
    | "lifestyle"
    | "other";
  description: string;
  priority: "high" | "medium" | "low";
  dueWindow?: string;
}

export interface AmbientEncounterResult {
  transcript: string;
  soapNote: SoapNote;
  actionItems: ActionItem[];
  language?: string;
  audioRetained: false;
  processedAt: string;
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER =
  "AI-generated visit summary for the patient's personal records. " +
  "Not a substitute for clinical documentation by the treating provider " +
  "and not for clinical decision-making.";

const SOAP_SYSTEM_PROMPT = `You are a medical scribe creating a SOAP note from a transcript of a doctor-patient visit.
Extract content into four sections strictly:
- Subjective: chief complaint, history of present illness, patient-reported symptoms, social/family history mentioned.
- Objective: vital signs, physical exam findings, lab/imaging results discussed.
- Assessment: diagnoses or differential considerations stated by the clinician.
- Plan: treatment plan, prescriptions, follow-ups, referrals, patient education stated.

Rules:
- Use only information present in the transcript. Do not infer or add clinical recommendations of your own.
- If a section has no relevant content, set its value to an empty string.
- Output JSON: { "subjective": string, "objective": string, "assessment": string, "plan": string }.`;

const ACTION_ITEMS_SYSTEM_PROMPT = `You are extracting actionable items from a doctor-patient visit transcript for the patient.
Extract every concrete action the patient is expected to take or that the clinician committed to (refills, referrals, labs, imaging, lifestyle changes, follow-up appointments).

Rules:
- Each item: type (follow_up | prescription | referral | lab_order | imaging_order | lifestyle | other), description (1-2 plain-language sentences), priority (high | medium | low), and optional dueWindow ("within 1 week", "in 3 months", etc).
- Use only items explicitly discussed. Do not invent items.
- Output JSON: { "items": ActionItem[] }.`;

class AmbientEncounterService {
  /**
   * Transcribe raw audio. Buffer is consumed and dropped after this call.
   * @param audioBuffer in-memory audio buffer (webm/opus or mp4/aac)
   * @param mimeType the recording mime type
   * @param language optional ISO code; omit to auto-detect
   */
  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<{ text: string; language?: string }> {
    // PHI-safe transcription: Google Cloud Speech-to-Text (medical model) via ADC —
    // Google-BAA-covered. Whisper/OpenAI is NOT used (no OpenAI BAA). Fails CLOSED
    // with a clear error rather than leaking PHI or returning silent garbage.
    const encoding =
      mimeType.includes("webm") ? "WEBM_OPUS"
      : mimeType.includes("ogg") ? "OGG_OPUS"
      : (mimeType.includes("wav") || mimeType.includes("x-wav")) ? "LINEAR16"
      : (mimeType.includes("mp3") || mimeType.includes("mpeg")) ? "MP3"
      : null;
    if (!encoding) {
      // mp4/aac (Safari MediaRecorder) isn't supported by sync recognize without
      // transcoding — fail closed rather than leak or guess.
      throw new Error(
        `Unsupported audio format "${mimeType}" for GCP Speech-to-Text. ` +
          `Record as WebM/Opus; mp4/aac needs server-side transcoding (follow-up).`,
      );
    }

    const ready = await medicalSpeechToTextService.initialize();
    if (!ready) {
      throw new Error(
        "GCP Speech-to-Text unavailable (ADC not resolvable). Transcription disabled — no PHI is sent to OpenAI.",
      );
    }

    const result = await medicalSpeechToTextService.transcribe({
      audioContent: audioBuffer.toString("base64"),
      encoding: encoding as any,
      sampleRateHertz: 48000, // OPUS: read from the container header; ignored for WEBM/OGG_OPUS
      languageCode: language || "en-US",
      model: "medical_conversation",
      punctuation: true,
    });

    if (!result.transcript || result.model === "local-fallback") {
      // NOTE: sync recognize caps at ~60s / 10MB. Longer encounters need
      // long-running recognize + GCS staging (tracked follow-up).
      throw new Error(
        "GCP Speech-to-Text returned no transcript (audio may exceed the ~60s sync limit — long-running recognize is the follow-up).",
      );
    }

    return { text: result.transcript, language };
  }

  async generateSoapNote(transcript: string): Promise<SoapNote> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SOAP_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Visit transcript:\n\n${transcript}\n\nReturn the JSON SOAP note now.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return {
      subjective: String(parsed.subjective ?? ""),
      objective: String(parsed.objective ?? ""),
      assessment: String(parsed.assessment ?? ""),
      plan: String(parsed.plan ?? ""),
    };
  }

  async extractActionItems(transcript: string): Promise<ActionItem[]> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: ACTION_ITEMS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Visit transcript:\n\n${transcript}\n\nReturn the JSON action items now.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.map((item: any) => ({
      type: this.normalizeType(item.type),
      description: String(item.description ?? "").trim(),
      priority: this.normalizePriority(item.priority),
      dueWindow: item.dueWindow ? String(item.dueWindow) : undefined,
    })) as ActionItem[];
  }

  /**
   * Full pipeline. Audio buffer is referenced only inside this method
   * and is dropped before return. The returned result is text-only.
   */
  async processEncounter(
    audioBuffer: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<AmbientEncounterResult> {
    const { text: transcript, language: detectedLang } = await this.transcribe(
      audioBuffer,
      mimeType,
      language,
    );

    if (!transcript || transcript.trim().length === 0) {
      throw new Error(
        "Transcription produced no text. The recording may have been silent or too short.",
      );
    }

    const [soapNote, actionItems] = await Promise.all([
      this.generateSoapNote(transcript),
      this.extractActionItems(transcript),
    ]);

    return {
      transcript,
      soapNote,
      actionItems,
      language: detectedLang,
      audioRetained: false,
      processedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private normalizeType(t: any): ActionItem["type"] {
    const allowed: ActionItem["type"][] = [
      "follow_up",
      "prescription",
      "referral",
      "lab_order",
      "imaging_order",
      "lifestyle",
      "other",
    ];
    return allowed.includes(t) ? t : "other";
  }

  private normalizePriority(p: any): ActionItem["priority"] {
    return p === "high" || p === "low" ? p : "medium";
  }
}

export const ambientEncounterService = new AmbientEncounterService();
