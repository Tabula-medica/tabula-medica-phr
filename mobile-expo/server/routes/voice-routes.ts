import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/require-auth";
import { transcribeMedicalAudio } from "../gcp-medical-speech";
import { classifyVoiceIntent } from "../voice-intent-service";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId ?? "";
}

export function registerVoiceRoutes(app: Express): void {
  /**
   * POST /api/voice/command
   * Accepts either:
   *   { audioBase64: string, encoding?: string }  — transcribes first, then classifies
   *   { transcript: string }                       — classifies directly
   *
   * Returns: { intent, entities, confidence, transcript, ttsReadBack }
   * PHI: transcription is session-only; no audio or transcript is persisted.
   */
  app.post(
    "/api/voice/command",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { audioBase64, transcript: rawTranscript, encoding } = req.body as {
          audioBase64?: string;
          transcript?: string;
          encoding?: string;
        };

        if (!audioBase64 && !rawTranscript?.trim()) {
          return res
            .status(400)
            .json({ error: "Provide audioBase64 or transcript" });
        }

        let transcript = rawTranscript?.trim() ?? "";

        if (audioBase64 && !transcript) {
          const transcriptionResult = await transcribeMedicalAudio(
            {
              audioBase64,
              encoding: (encoding as any) ?? "WEBM_OPUS",
              medicalModel: false,
              punctuation: true,
            },
            userId
          );
          transcript = transcriptionResult.transcript;
        }

        if (!transcript) {
          return res.json({
            intent: "UNKNOWN",
            entities: {},
            confidence: 0,
            transcript: "",
            ttsReadBack: "Sorry, I didn't catch that. Please try again.",
          });
        }

        const intentResult = await classifyVoiceIntent(transcript);
        const ttsReadBack = buildReadBack(intentResult.intent, intentResult.entities, transcript);

        res.json({
          intent: intentResult.intent,
          entities: intentResult.entities,
          confidence: intentResult.confidence,
          transcript,
          ttsReadBack,
        });
      } catch (error) {
        console.error("Voice command error:", error);
        res.status(500).json({ error: "Failed to process voice command" });
      }
    }
  );

  /**
   * GET /api/voice/status
   * Returns voice feature availability.
   */
  app.get(
    "/api/voice/status",
    requireAuth,
    (_req: Request, res: Response) => {
      res.json({
        available: true,
        transcriptionProvider: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
          ? "gcp_medical_speech"
          : "local_stub",
        intentProvider: "vertex_ai",
        supportedIntents: [
          "NAVIGATE",
          "FILL_FIELD",
          "CONFIRM",
          "CANCEL",
          "READ_BACK",
          "HELP",
        ],
      });
    }
  );
}

function buildReadBack(
  intent: string,
  entities: Record<string, string>,
  transcript: string
): string {
  switch (intent) {
    case "NAVIGATE":
      return `Navigating to ${entities.screen ?? "that screen"}.`;
    case "FILL_FIELD":
      return `Filled ${entities.field ?? "field"}: ${entities.value ?? ""}. Say confirm to accept or cancel to undo.`;
    case "CONFIRM":
      return "Confirmed.";
    case "CANCEL":
      return "Cancelled.";
    case "READ_BACK":
      return "Reading back your entries.";
    case "HELP":
      return (
        "You can say: Go to records, Go home, Go back, " +
        "Set first name to John, Set date of birth to January 15 1990, " +
        "Confirm, or Cancel."
      );
    default:
      return `I heard: ${transcript}. I'm not sure what to do with that. Say help for available commands.`;
  }
}
