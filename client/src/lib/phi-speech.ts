/**
 * The only client module allowed to touch speechSynthesis.
 * Recognition never uses the browser Web Speech API. Audio is recorded in
 * the browser and transcribed by POST /api/voice/phi-transcribe (Google Cloud
 * Speech-to-Text under the Cloud BAA) when GCP_SPEECH_ENABLED=true and ADC
 * is configured. Otherwise the caller keeps typed input.
 *
 * Read-aloud uses a voice with localService === true. Remote browser voices
 * are refused. If no local voice exists, audio comes from POST /api/voice/phi-speak
 * or the text stays on screen.
 */
import {
  assertPhiSpeechEngine,
  localSynthesisAllowed,
  PHI_SPEECH_MAX_TTS_CHARS,
  preferSpeechEngine,
} from "@shared/voice/policy";

const CSRF = { "X-Requested-With": "XMLHttpRequest" };

let cloudAudio: HTMLAudioElement | null = null;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(blob);
  });
}

export async function phiSpeechAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
  try {
    const res = await fetch("/api/voice/phi-speech-status", {
      credentials: "include",
      headers: CSRF,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: boolean };
    return body.enabled === true;
  } catch {
    return false;
  }
}

export async function transcribePhiBlob(
  blob: Blob,
  language?: string,
): Promise<{ enabled: true; transcript: string } | { enabled: false }> {
  try {
    const audio = await blobToBase64(blob);
    const res = await fetch("/api/voice/phi-transcribe", {
      method: "POST",
      credentials: "include",
      headers: { ...CSRF, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio,
        mimeType: blob.type || "audio/webm",
        languageCode: language || "en-US",
      }),
    });
    if (!res.ok) return { enabled: false };
    const body = (await res.json()) as { enabled?: boolean; transcript?: string; engine?: string };
    if (body.enabled !== true || !body.transcript) return { enabled: false };
    assertPhiSpeechEngine(body.engine || "gcp-speech");
    return { enabled: true, transcript: body.transcript };
  } catch {
    return { enabled: false };
  }
}

export function cancelPhiSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  if (cloudAudio) {
    cloudAudio.pause();
    cloudAudio.src = "";
    cloudAudio = null;
  }
}

function waitForLocalVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const pick = () => synth.getVoices().filter((voice) => localSynthesisAllowed(voice));
  const ready = pick();
  if (ready.length > 0) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const finish = () => resolve(pick());
    const timer = window.setTimeout(finish, 400);
    synth.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        finish();
      },
      { once: true },
    );
  });
}

async function speakWithCloud(
  text: string,
  language: string,
  onEnd?: () => void,
): Promise<"gcp-tts" | "silent"> {
  assertPhiSpeechEngine("gcp-tts");
  try {
    const res = await fetch("/api/voice/phi-speak", {
      method: "POST",
      credentials: "include",
      headers: { ...CSRF, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, PHI_SPEECH_MAX_TTS_CHARS),
        languageCode: language,
      }),
    });
    if (!res.ok) {
      onEnd?.();
      return "silent";
    }
    const body = (await res.json()) as { enabled?: boolean; audio?: string; format?: string };
    if (body.enabled !== true || !body.audio) {
      onEnd?.();
      return "silent";
    }
    const el = new Audio(`data:audio/${body.format || "mp3"};base64,${body.audio}`);
    cloudAudio = el;
    el.onended = () => onEnd?.();
    el.onerror = () => onEnd?.();
    await el.play();
    return "gcp-tts";
  } catch {
    onEnd?.();
    return "silent";
  }
}

/**
 * Speak text that may contain PHI. Returns which engine ran.
 * "silent" means the words stay on screen and nothing left the device.
 */
export async function speakPhiText(
  text: string,
  opts?: { lang?: string; rate?: number; onEnd?: () => void },
): Promise<"on-device" | "gcp-tts" | "silent"> {
  const trimmed = text.trim();
  if (!trimmed || typeof window === "undefined" || !window.speechSynthesis) {
    if (trimmed && typeof window !== "undefined") {
      return speakWithCloud(trimmed, opts?.lang || "en-US", opts?.onEnd);
    }
    opts?.onEnd?.();
    return "silent";
  }
  const voices = await waitForLocalVoices();
  const lang = (opts?.lang || "en-US").toLowerCase();
  const prefix = lang.split("-")[0] || "en";
  const match = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
  const chosen = match || voices[0] || null;
  const engine = preferSpeechEngine(localSynthesisAllowed(chosen), "gcp-tts");
  assertPhiSpeechEngine(engine);
  if (engine === "on-device" && chosen) {
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.voice = chosen;
    utterance.lang = chosen.lang;
    utterance.rate = opts?.rate ?? 1;
    utterance.onend = () => opts?.onEnd?.();
    utterance.onerror = () => opts?.onEnd?.();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return "on-device";
  }
  return speakWithCloud(trimmed, opts?.lang || "en-US", opts?.onEnd);
}
