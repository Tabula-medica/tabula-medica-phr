/**
 * Fail-closed gate for PHI speech. GCP_SPEECH_ENABLED must be the string
 * "true" AND Application Default Credentials must work. Otherwise callers
 * get typed input and on-screen text. There is no browser-speech fallback
 * and no placeholder transcript.
 *
 * Cloud Speech-to-Text and Text-to-Speech data logging are project opt-ins
 * and stay off. Do not enable them for this BAA path.
 */
import {
  assertPhiSpeechEngine,
  PHI_SPEECH_MAX_AUDIO_CHARS,
  PHI_SPEECH_MAX_TTS_CHARS,
} from "@shared/voice/policy";

export { PHI_SPEECH_MAX_AUDIO_CHARS, PHI_SPEECH_MAX_TTS_CHARS };

const LANG = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/;

export type GcpEncoding = "WEBM_OPUS" | "OGG_OPUS" | "LINEAR16" | "MP3";

export function gcpSpeechFlagEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.GCP_SPEECH_ENABLED === "true";
}

export function acceptGcpTranscript(result: {
  transcript?: string | null;
  model?: string | null;
}): string | null {
  assertPhiSpeechEngine("gcp-speech");
  const transcript = (result.transcript ?? "").trim();
  if (!transcript) return null;
  if (result.model === "local-fallback") return null;
  if (transcript.startsWith("[MedASR")) return null;
  return transcript;
}

export function encodingForMime(mimeType: string): GcpEncoding | null {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime === "audio/webm") return "WEBM_OPUS";
  if (mime === "audio/ogg") return "OGG_OPUS";
  if (mime === "audio/wav" || mime === "audio/wave" || mime === "audio/x-wav") return "LINEAR16";
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "MP3";
  return null;
}

export function languageOrDefault(languageCode: unknown): string {
  if (typeof languageCode !== "string") return "en-US";
  const trimmed = languageCode.trim();
  return LANG.test(trimmed) ? trimmed : "en-US";
}

export function parsePhiAudioBody(body: {
  audio?: unknown;
  mimeType?: unknown;
  languageCode?: unknown;
}):
  | { ok: true; audio: string; encoding: GcpEncoding; languageCode: string; model: "medical_dictation" | "default" }
  | { ok: false; status: number; error: string } {
  if (typeof body.audio !== "string" || body.audio.trim().length === 0) {
    return { ok: false, status: 400, error: "Audio is required" };
  }
  const audio = body.audio.replace(/\s/g, "");
  if (audio.length > PHI_SPEECH_MAX_AUDIO_CHARS) {
    return { ok: false, status: 413, error: "Audio is too long" };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(audio)) {
    return { ok: false, status: 400, error: "Audio must be base64" };
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "audio/webm";
  const encoding = encodingForMime(mimeType);
  if (!encoding) {
    return { ok: false, status: 415, error: "Unsupported audio type" };
  }
  const languageCode = languageOrDefault(body.languageCode);
  const model = languageCode === "en-US" ? "medical_dictation" : "default";
  return { ok: true, audio, encoding, languageCode, model };
}

export function parsePhiSpeakBody(body: { text?: unknown; languageCode?: unknown }):
  | { ok: true; text: string; languageCode: string }
  | { ok: false; status: number; error: string } {
  if (typeof body.text !== "string") {
    return { ok: false, status: 400, error: "Text is required" };
  }
  const text = body.text.trim();
  if (!text) return { ok: false, status: 400, error: "Text is required" };
  if (text.length > PHI_SPEECH_MAX_TTS_CHARS) {
    return { ok: false, status: 413, error: "Text is too long" };
  }
  assertPhiSpeechEngine("gcp-tts");
  return { ok: true, text, languageCode: languageOrDefault(body.languageCode) };
}
