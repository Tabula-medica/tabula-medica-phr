import type { Express, Request, Response } from "express";
import { requireUser, aiUserRateLimiter } from "./middleware/require-user";
import { medicalSpeechToTextService } from "./services/gcp/medical-speech-to-text";
import { synthesizeSpeech } from "./lib/gcp-tts";
import {
  acceptGcpTranscript,
  gcpSpeechFlagEnabled,
  parsePhiAudioBody,
  parsePhiSpeakBody,
} from "./services/phi-speech";

let credentialsProbe: Promise<boolean> | null = null;

function phiSpeechReady(): Promise<boolean> {
  if (!gcpSpeechFlagEnabled()) return Promise.resolve(false);
  if (!credentialsProbe) {
    credentialsProbe = medicalSpeechToTextService.initialize().then(
      (ready) => ready === true,
      () => false,
    );
  }
  return credentialsProbe;
}

function disabled(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json({ enabled: false, engine: null });
}

/**
 * BAA speech for PHI. Off unless GCP_SPEECH_ENABLED=true and ADC works.
 * Browser SpeechRecognition is never a fallback. Transcripts and audio are
 * not written to logs.
 */
export function registerPhiSpeechRoutes(app: Express): void {
  app.get("/api/voice/phi-speech-status", async (_req: Request, res: Response) => {
    const enabled = await phiSpeechReady();
    res.setHeader("Cache-Control", "no-store");
    res.json({ enabled, engine: enabled ? "gcp-speech" : null });
  });

  app.post("/api/voice/phi-transcribe", requireUser, aiUserRateLimiter, async (req: Request, res: Response) => {
    const parsed = parsePhiAudioBody(req.body ?? {});
    if (!parsed.ok) {
      res.status(parsed.status).json({ enabled: false, error: parsed.error });
      return;
    }
    if (!(await phiSpeechReady())) {
      disabled(res);
      return;
    }
    try {
      const result = await medicalSpeechToTextService.transcribe({
        audioContent: parsed.audio,
        encoding: parsed.encoding,
        sampleRateHertz: 48000,
        languageCode: parsed.languageCode,
        model: parsed.model,
        punctuation: true,
      });
      const transcript = acceptGcpTranscript(result);
      if (!transcript) {
        disabled(res);
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ enabled: true, engine: "gcp-speech", transcript });
    } catch {
      console.error("[phi-speech] transcribe failed");
      disabled(res);
    }
  });

  app.post("/api/voice/phi-speak", requireUser, aiUserRateLimiter, async (req: Request, res: Response) => {
    const parsed = parsePhiSpeakBody(req.body ?? {});
    if (!parsed.ok) {
      res.status(parsed.status).json({ enabled: false, error: parsed.error });
      return;
    }
    if (!(await phiSpeechReady())) {
      disabled(res);
      return;
    }
    try {
      const audio = await synthesizeSpeech(parsed.text, "alloy", "mp3", parsed.languageCode);
      res.setHeader("Cache-Control", "no-store");
      res.json({ enabled: true, engine: "gcp-tts", audio: audio.toString("base64"), format: "mp3" });
    } catch {
      console.error("[phi-speech] speak failed");
      disabled(res);
    }
  });
}
