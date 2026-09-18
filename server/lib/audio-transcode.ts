// Audio format prep for GCP Speech-to-Text. Safari's MediaRecorder produces
// mp4/aac, which GCP sync/long-running recognize does NOT accept — so we transcode
// it to FLAC (mono, self-describing sample rate) with ffmpeg (installed in the
// container). All other browser formats (WebM/Opus, Ogg/Opus, WAV, MP3) pass
// through with the right encoding. Everything stays BAA-safe (local transcode +
// GCP STT); nothing goes to OpenAI.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileP = promisify(execFile);

/** mp4/aac/m4a need transcoding; mp3/mpeg are supported natively (MP3). */
export function needsTranscode(mimeType: string): boolean {
  return /(mp4|m4a|aac)/i.test(mimeType) && !/(mpeg|mp3)/i.test(mimeType);
}

/** Transcode a compressed audio buffer to mono FLAC via ffmpeg (temp files — mp4
 *  needs a seekable moov atom, so a pipe can fail). Throws if ffmpeg errors. */
export async function transcodeToFlac(input: Buffer, inputExt = "mp4"): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "stt-"));
  const inPath = join(dir, `in.${inputExt}`);
  const outPath = join(dir, "out.flac");
  try {
    await writeFile(inPath, input);
    await execFileP("ffmpeg", ["-y", "-i", inPath, "-ac", "1", "-f", "flac", outPath], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Normalize any supported browser audio into a GCP-STT-ready payload.
 * mp4/aac → FLAC (transcoded); others → passthrough with mapped encoding.
 */
export async function prepareForStt(
  buffer: Buffer,
  mimeType: string,
): Promise<{ audioContent: string; encoding: string; sampleRateHertz: number }> {
  if (needsTranscode(mimeType)) {
    const ext = /m4a/i.test(mimeType) ? "m4a" : "mp4";
    const flac = await transcodeToFlac(buffer, ext);
    // FLAC carries its sample rate in-stream; GCP reads it (value below is a hint).
    return { audioContent: flac.toString("base64"), encoding: "FLAC", sampleRateHertz: 16000 };
  }
  const encoding =
    /webm/i.test(mimeType) ? "WEBM_OPUS"
    : /ogg/i.test(mimeType) ? "OGG_OPUS"
    : /(wav|x-wav)/i.test(mimeType) ? "LINEAR16"
    : /(mp3|mpeg)/i.test(mimeType) ? "MP3"
    : null;
  if (!encoding) {
    throw new Error(`Unsupported audio format "${mimeType}" for GCP Speech-to-Text.`);
  }
  return { audioContent: buffer.toString("base64"), encoding, sampleRateHertz: 48000 };
}
