/**
 * Speech engines allowed to hear or speak PHI.
 * Google Cloud Speech-to-Text and Text-to-Speech are covered by the Google
 * Cloud BAA when data logging is off. On-device recognition and synthesis
 * never leave the phone. Browser Web Speech, consumer Whisper, and consumer
 * TTS endpoints are outside that boundary.
 */

export const PHI_SPEECH_ENGINES = ["on-device", "gcp-speech", "gcp-tts"] as const;
export type PhiSpeechEngine = (typeof PHI_SPEECH_ENGINES)[number];

export type VoiceIntent =
  | { type: "navigate"; route: string }
  | { type: "record-symptom"; text: string; lang: string }
  | { type: "record-medication"; text: string; lang: string }
  | { type: "record-vital"; kind: string; value: number; unit: string; lang: string }
  | { type: "read-aloud"; text: string; lang: string };

const ALLOWED = new Set<string>(PHI_SPEECH_ENGINES);

export function assertPhiSpeechEngine(engine: string): PhiSpeechEngine {
  if (ALLOWED.has(engine)) return engine as PhiSpeechEngine;
  throw new Error(`Speech engine "${engine}" cannot carry PHI. Use on-device or Google Cloud Speech/TTS with data logging off.`);
}

/** On-device first. Cloud is the fallback when the phone lacks that language. */
export function preferSpeechEngine(onDeviceAvailable: boolean, cloud: "gcp-speech" | "gcp-tts"): PhiSpeechEngine {
  return onDeviceAvailable ? "on-device" : cloud;
}
