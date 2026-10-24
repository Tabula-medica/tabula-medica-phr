/**
 * Speech engines allowed to hear or speak PHI.
 *
 * Google Cloud Speech-to-Text and Text-to-Speech are covered by the Google
 * Cloud BAA when data logging stays off (it is off unless a project opts in).
 * On-device recognition and synthesis never leave the device. The browser
 * Web Speech recognition API (SpeechRecognition / webkitSpeechRecognition)
 * streams audio to the browser vendor's consumer servers in Chrome and in
 * Android WebViews based on it. That path is not Cloud Speech-to-Text and
 * is not covered by the Cloud BAA. Consumer Whisper and consumer TTS
 * endpoints are outside the boundary too.
 *
 * speechSynthesis is on-device only when the chosen voice reports
 * localService === true. Chrome's remote Google voices do not.
 */

export const PHI_SPEECH_ENGINES = ["on-device", "gcp-speech", "gcp-tts"] as const;

/** Caps shared by the browser recorder and the Cloud Speech routes. */
export const PHI_SPEECH_MAX_AUDIO_CHARS = 1_500_000;
export const PHI_SPEECH_MAX_TTS_CHARS = 2_000;
export type PhiSpeechEngine = (typeof PHI_SPEECH_ENGINES)[number];

/** Constructor names the client must not call. The lint rule and the source scan both read this list. */
export const BROWSER_SPEECH_RECOGNITION_APIS = ["SpeechRecognition", "webkitSpeechRecognition"] as const;

const ALLOWED = new Set<string>(PHI_SPEECH_ENGINES);

export function assertPhiSpeechEngine(engine: string): PhiSpeechEngine {
  if (ALLOWED.has(engine)) return engine as PhiSpeechEngine;
  throw new Error(
    `Speech engine "${engine}" cannot carry PHI. Use on-device or Google Cloud Speech/TTS with data logging off.`,
  );
}

/** On-device first. Cloud is the fallback when the device has no local engine. */
export function preferSpeechEngine(
  onDeviceAvailable: boolean,
  cloud: "gcp-speech" | "gcp-tts",
): PhiSpeechEngine {
  return onDeviceAvailable ? "on-device" : cloud;
}

/** A synthesis voice may speak PHI only when the browser says it is local. */
export function localSynthesisAllowed(voice: { localService?: boolean } | null | undefined): boolean {
  return voice?.localService === true;
}
