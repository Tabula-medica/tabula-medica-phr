import OpenAI from "openai";
import { Buffer } from "node:buffer";
import { medicalSpeechToTextService } from "../../services/gcp/medical-speech-to-text";
import { synthesizeSpeech } from "../../lib/gcp-tts";

// NOTE: `openai` here is the Vertex shim (build alias) — chat.completions routes to
// Vertex/Gemini (BAA). Its `.audio`/`.images` are hard-disabled. Audio in this module
// therefore uses GCP Speech-to-Text + Google Cloud TTS (both BAA-covered). Single-model
// audio-in/audio-out (voiceChat*) can't run on Gemini and is fail-closed → use the
// cascade voiceChatWithTextModel (STT → Vertex text → TTS) instead.
export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Map the app's audio container hints to GCP STT encodings; fail closed on mp4/aac.
function sttEncoding(format: string): "WEBM_OPUS" | "OGG_OPUS" | "LINEAR16" | "MP3" {
  if (format.includes("webm")) return "WEBM_OPUS";
  if (format.includes("ogg")) return "OGG_OPUS";
  if (format.includes("mp3") || format.includes("mpeg")) return "MP3";
  if (format.includes("wav")) return "LINEAR16";
  throw new Error(`Unsupported audio format "${format}" for GCP Speech-to-Text (mp4/aac needs transcoding — follow-up).`);
}

async function transcribeBaaSafe(audioBuffer: Buffer, format: string): Promise<string> {
  const ready = await medicalSpeechToTextService.initialize();
  if (!ready) throw new Error("GCP Speech-to-Text unavailable (ADC) — no PHI is sent to OpenAI.");
  const r = await medicalSpeechToTextService.transcribe({
    audioContent: audioBuffer.toString("base64"),
    encoding: sttEncoding(format),
    sampleRateHertz: 48000,
    languageCode: "en-US",
    model: "medical_conversation",
    punctuation: true,
  });
  if (!r.transcript || r.model === "local-fallback") {
    throw new Error("GCP STT returned no transcript (audio may exceed the ~60s sync limit — long-running recognize is a follow-up).");
  }
  return r.transcript;
}


/**
 * Voice Chat: User speaks, LLM responds with audio (audio-in, audio-out).
 * Uses gpt-audio-mini model via Replit AI Integrations.
 * Note: Browser records WebM/opus - convert to WAV using ffmpeg before calling this.
 */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  // FAIL-CLOSED: OpenAI single-model audio-in/audio-out (gpt-audio-mini) has no BAA
  // and no Gemini/Vertex equivalent. Use the BAA-safe cascade voiceChatWithTextModel.
  throw new Error("voiceChat disabled (no OpenAI BAA for audio models). Use voiceChatWithTextModel (GCP STT → Vertex text → GCP TTS).");
}

/**
 * Streaming Voice Chat: For real-time audio responses.
 * Note: Browser records WebM/opus - convert to WAV using ffmpeg before calling this.
 * Note: Streaming only supports pcm16 output format.
 */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  // FAIL-CLOSED: see voiceChat. No BAA-safe single-model streaming audio-in/out.
  throw new Error("voiceChatStream disabled (no OpenAI BAA for audio models). Use voiceChatWithTextModel (GCP STT → Vertex text → GCP TTS).");
}

/**
 * Text-to-Speech: Converts text to speech verbatim.
 * Uses gpt-audio-mini model via Replit AI Integrations.
 */
export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"
): Promise<Buffer> {
  // Google Cloud TTS (BAA-covered) instead of OpenAI audio (no BAA).
  return synthesizeSpeech(text, voice, format);
}

/**
 * Streaming Text-to-Speech: Converts text to speech with real-time streaming.
 * Uses gpt-audio-mini model via Replit AI Integrations.
 * Note: Streaming only supports pcm16 output format.
 */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<AsyncIterable<string>> {
  // Google Cloud TTS (BAA). No token-level streaming — synthesize once and yield a
  // single base64 chunk (callers consume an async iterable of base64 audio).
  const audio = await synthesizeSpeech(text, voice, "pcm16");
  return (async function* () {
    yield audio.toString("base64");
  })();
}

/**
 * Speech-to-Text: Transcribes audio using dedicated transcription model.
 * Uses gpt-4o-mini-transcribe for accurate transcription.
 */
export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  // GCP Speech-to-Text (BAA) instead of OpenAI Whisper (no BAA).
  return transcribeBaaSafe(audioBuffer, format);
}

/**
 * Streaming Speech-to-Text: Transcribes audio with real-time streaming.
 * Uses gpt-4o-mini-transcribe for accurate transcription.
 */
export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  // GCP STT sync recognize isn't token-streaming; transcribe once, yield the result.
  const text = await transcribeBaaSafe(audioBuffer, format);
  return (async function* () {
    yield text;
  })();
}

// ============================================================
// Sentence Parser - Multilingual using Intl.Segmenter
// ============================================================

/**
 * Extracts complete sentences from streaming text using Intl.Segmenter.
 * Supports multilingual text (handles CJK, Arabic, etc. properly).
 */
export class SentenceParser {
  private buffer = "";
  private seq = 0;
  private segmenter: Intl.Segmenter;

  constructor(locale = "en") {
    // Intl.Segmenter handles sentence boundaries for all Unicode languages
    // Falls back gracefully if locale not supported
    this.segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  }

  /**
   * Feed tokens from LLM stream.
   * Returns complete sentences with sequence numbers.
   */
  feed(token: string): Array<{ seq: number; text: string }> {
    this.buffer += token;
    const sentences: Array<{ seq: number; text: string }> = [];

    // Segment current buffer
    const segments = [...this.segmenter.segment(this.buffer)];

    // All segments except the last are complete sentences
    // (last segment might be incomplete, still accumulating tokens)
    for (let i = 0; i < segments.length - 1; i++) {
      const text = segments[i].segment.trim();
      if (text) {
        sentences.push({ seq: this.seq++, text });
      }
    }

    // Keep only the last (potentially incomplete) segment in buffer
    if (segments.length > 0) {
      this.buffer = segments[segments.length - 1].segment;
    }

    return sentences;
  }

  /** Flush any remaining text as final sentence */
  flush(): { seq: number; text: string } | null {
    const text = this.buffer.trim();
    this.buffer = "";
    return text ? { seq: this.seq++, text } : null;
  }

  reset() {
    this.buffer = "";
    this.seq = 0;
  }
}

// ============================================================
// Cascading Voice Chat - STT → Text Model → TTS Pipeline
// ============================================================

export interface VoiceChatStreamEvent {
  type: "user_transcript" | "sentence" | "audio" | "transcript" | "done" | "error";
  seq?: number;
  data?: string;
  text?: string;
  error?: string;
}

/** Internal type for tracking active TTS streams */
interface TTSStream {
  seq: number;
  iterator: AsyncIterator<string>;
  done: boolean;
}

/**
 * Voice chat using separate text model and TTS.
 *
 * Key behaviors:
 * - TTS starts immediately when a sentence completes (doesn't wait for previous TTS)
 * - Audio yields in sequence order (always yields seq 0 chunks before seq 1)
 * - Multiple TTS streams can run concurrently
 * - Low latency: streams chunks as they arrive from the current sentence's TTS
 */
export async function* voiceChatWithTextModel(
  audioBuffer: Buffer,
  options: {
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    inputFormat?: "wav" | "mp3";
    systemPrompt?: string;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    textModel?: string;
    locale?: string; // For sentence segmentation (e.g., "en", "ja", "zh")
  } = {}
): AsyncGenerator<VoiceChatStreamEvent> {
  const {
    voice = "alloy",
    inputFormat = "wav",
    systemPrompt = "You are a helpful assistant.",
    chatHistory = [],
    textModel = "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
    locale = "en",
  } = options;

  // 1. Transcribe user audio
  const userText = await speechToText(audioBuffer, inputFormat);
  yield { type: "user_transcript", data: userText };

  // 2. Build messages for text model
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...chatHistory,
    { role: "user" as const, content: userText },
  ];

  // 3. Stream text from LLM
  const textStream = await openai.chat.completions.create({
    model: textModel,
    messages,
    stream: true,
  });

  // 4. Parse sentences and dispatch TTS in parallel
  const parser = new SentenceParser(locale);
  const activeStreams: TTSStream[] = [];
  let nextSeqToYield = 0;
  let fullTranscript = "";

  /**
   * Start TTS for a sentence. Runs concurrently with other TTS streams.
   */
  const startTTS = async (sentence: { seq: number; text: string }) => {
    const stream = await textToSpeechStream(sentence.text, voice);
    activeStreams.push({
      seq: sentence.seq,
      iterator: stream[Symbol.asyncIterator](),
      done: false,
    });
  };

  /**
   * Yield audio chunks from active TTS streams in sequence order.
   * - Always yields from the current sequence (nextSeqToYield) first
   * - Buffers are not needed here because we yield directly from iterators
   * - When current sequence's TTS is done, moves to next
   */
  async function* drainAudioInOrder(): AsyncGenerator<VoiceChatStreamEvent> {
    while (activeStreams.length > 0) {
      // Find the stream for the current sequence we should yield
      const currentStream = activeStreams.find((s) => s.seq === nextSeqToYield);

      if (!currentStream) {
        // Next sequence hasn't started TTS yet, yield control back
        return;
      }

      if (currentStream.done) {
        // Current stream exhausted, move to next sequence
        activeStreams.splice(activeStreams.indexOf(currentStream), 1);
        nextSeqToYield++;
        continue;
      }

      // Pull next chunk from current stream
      const { value, done } = await currentStream.iterator.next();

      if (done) {
        currentStream.done = true;
        activeStreams.splice(activeStreams.indexOf(currentStream), 1);
        nextSeqToYield++;
      } else {
        yield { type: "audio", seq: currentStream.seq, data: value };
      }
    }
  }

  // 5. Process text stream: parse sentences, dispatch TTS, yield audio
  for await (const chunk of textStream) {
    const token = chunk.choices[0]?.delta?.content || "";
    if (!token) continue;

    fullTranscript += token;

    // Extract complete sentences
    const sentences = parser.feed(token);
    for (const sentence of sentences) {
      yield { type: "sentence", seq: sentence.seq, text: sentence.text };
      await startTTS(sentence);
    }

    // Yield any ready audio (non-blocking: only yields if current seq has data)
    for await (const event of drainAudioInOrder()) {
      yield event;
    }
  }

  // 6. Flush remaining sentence
  const finalSentence = parser.flush();
  if (finalSentence) {
    yield { type: "sentence", seq: finalSentence.seq, text: finalSentence.text };
    await startTTS(finalSentence);
  }

  // 7. Drain all remaining TTS audio (blocking: wait for all to complete)
  while (activeStreams.length > 0) {
    for await (const event of drainAudioInOrder()) {
      yield event;
    }
    // Small yield to prevent tight loop if waiting for TTS
    if (activeStreams.length > 0 && !activeStreams.find((s) => s.seq === nextSeqToYield)) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  yield { type: "transcript", data: fullTranscript };
  yield { type: "done" };
}
