// Google Cloud Text-to-Speech (BAA-covered) via ADC — replaces OpenAI audio TTS
// (no OpenAI BAA). Uses the REST endpoint with the runtime service account, same
// pattern as medical-speech-to-text.ts. No extra npm dependency.
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

// Map the app's legacy OpenAI voice names to Google Neural2 voices (en-US).
const VOICE_MAP: Record<string, string> = {
  alloy: "en-US-Neural2-A",
  echo: "en-US-Neural2-D",
  fable: "en-US-Neural2-J",
  onyx: "en-US-Neural2-I",
  nova: "en-US-Neural2-F",
  shimmer: "en-US-Neural2-G",
};

const FORMAT_MAP: Record<string, string> = {
  mp3: "MP3",
  wav: "LINEAR16",
  pcm16: "LINEAR16",
  opus: "OGG_OPUS",
  flac: "LINEAR16", // Google TTS has no FLAC; return WAV/LINEAR16
};

/**
 * Synthesize speech via Google Cloud TTS. Returns the raw audio Buffer.
 * Fails closed (throws) if ADC/TTS is unavailable — never falls back to OpenAI.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string = "alloy",
  format: string = "wav",
  languageCode = "en-US",
): Promise<Buffer> {
  const token = await auth.getAccessToken();
  if (!token) throw new Error("GCP TTS unavailable (no ADC token) — refusing to use OpenAI (no BAA).");

  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: VOICE_MAP[voice] ?? VOICE_MAP.alloy },
      audioConfig: { audioEncoding: FORMAT_MAP[format] ?? "LINEAR16" },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GCP TTS error ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("GCP TTS returned no audio.");
  return Buffer.from(data.audioContent, "base64");
}
