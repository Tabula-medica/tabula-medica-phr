import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  chaptersTable,
  chapterTranslationsTable,
  audioTracksTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { getLanguage, getVoice } from "../lib/voices";
import { isAdminUser } from "../lib/admin";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveUserOrAnon } from "../middlewares/resolveUserOrAnon";
import { objectStorageClient } from "../lib/objectStorage";
import {
  releaseSynthHit,
  reserveSynthHit,
  setSynthQuotaHeaders,
  withSynthLock,
} from "../lib/synthQuota";
import { randomUUID } from "node:crypto";
import multer from "multer";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

const requireAdmin: import("express").RequestHandler = (req, res, next) => {
  if (!isAdminUser(req.userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

async function uploadAudioToObjectStorage(
  audio: Buffer,
  contentType: string,
): Promise<string | null> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!bucketId || !privateDir) return null;
  try {
    const objectId = `audio/${randomUUID()}.mp3`;
    const path = `${privateDir.replace(/\/$/, "")}/${objectId}`;
    const slash = path.indexOf("/", 1);
    const fileName = path.substring(slash + 1);
    const file = objectStorageClient.bucket(bucketId).file(fileName);
    await file.save(audio, { contentType, resumable: false });
    return objectId;
  } catch (err) {
    console.warn("[tracks] object storage upload failed; using DB fallback", err);
    return null;
  }
}

async function deleteAudioFromObjectStorage(objectPath: string): Promise<void> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!bucketId || !privateDir) return;
  try {
    const path = `${privateDir.replace(/\/$/, "")}/${objectPath}`;
    const slash = path.indexOf("/", 1);
    const fileName = path.substring(slash + 1);
    await objectStorageClient.bucket(bucketId).file(fileName).delete();
  } catch (err) {
    console.warn("[tracks] failed to delete orphaned object storage file", err);
  }
}

// Per-(chapterId, language, voice) in-flight synthesis promises.
// When a synthesis is already running for a given combination, concurrent
// requests wait for that shared promise instead of launching duplicate
// paid OpenAI calls.  Entries are removed when the synthesis settles.
type SynthRow = {
  id: number;
  chapterId: number;
  language: string;
  voice: string;
  source: string;
  durationSeconds: number;
};
const inFlightSynths = new Map<string, Promise<SynthRow>>();

function synthKey(
  chapterId: number,
  language: string,
  voice: string,
): string {
  return `${chapterId}\x00${language}\x00${voice}`;
}

const router: IRouter = Router();

async function translatePassage(
  text: string,
  targetLanguageName: string,
): Promise<string> {
  if (targetLanguageName === "English") return text;
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content:
          "You are a careful translator of sacred and philosophical texts. Translate the user's passage into the requested target language faithfully and reverently. Preserve meaning, cadence, and tone. Output only the translated text — no preface, no quotation marks, no explanation.",
      },
      {
        role: "user",
        content: `Target language: ${targetLanguageName}\n\nPassage:\n${text}`,
      },
    ],
    max_completion_tokens: 4096,
  });
  return (completion.choices[0]?.message?.content ?? text).trim();
}

router.post("/synthesize", resolveUserOrAnon, async (req, res, next) => {
  const userId = req.userId!;
  try {
    const body = req.body as {
      chapterId?: number;
      language?: string;
      voice?: string;
    };
    const chapterId = Number(body.chapterId);
    const languageCode = String(body.language ?? "");
    const voiceId = String(body.voice ?? "");

    if (!Number.isFinite(chapterId)) {
      res.status(400).json({ error: "chapterId is required" });
      return;
    }
    const language = getLanguage(languageCode);
    if (!language) {
      res.status(400).json({ error: `Unknown language: ${languageCode}` });
      return;
    }
    const voice = getVoice(voiceId);
    if (!voice) {
      res.status(400).json({ error: `Unknown voice: ${voiceId}` });
      return;
    }

    const chapter = await db.query.chaptersTable.findFirst({
      where: eq(chaptersTable.id, chapterId),
    });
    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    // Cache check first — cache hits are always free (no quota consumed).
    // Charging IP quota before this check would allow an attacker on a shared
    // NAT to exhaust the IP-level budget by repeatedly requesting cached
    // tracks with fresh cookies, denying service to legitimate visitors at
    // the same address without performing any expensive synthesis.
    const existing = await db.query.audioTracksTable.findFirst({
      where: and(
        eq(audioTracksTable.chapterId, chapterId),
        eq(audioTracksTable.language, language.code),
        eq(audioTracksTable.voice, voice.id),
      ),
    });
    if (existing) {
      // Cache hit: serve instantly, do NOT consume any quota.
      await setSynthQuotaHeaders(res, userId);
      res.setHeader("X-Synth-Cache", "hit");
      res.json({
        id: existing.id,
        chapterId: existing.chapterId,
        language: existing.language,
        voice: existing.voice,
        source: existing.source,
        durationSeconds: existing.durationSeconds,
        audioUrl: `/api/tracks/${existing.id}/audio`,
      });
      return;
    }

    // In-process dedup: check the in-flight map and, if not present, register
    // this request's promise — all synchronously before the first `await`.
    // JavaScript is single-threaded: no concurrent request can observe the
    // map between the get() and set() calls below because there is no yield
    // point between them.  This eliminates the TOCTOU window that would
    // otherwise allow two requests to both see an empty entry and both proceed
    // to call OpenAI.
    const key = synthKey(chapterId, language.code, voice.id);
    const inFlight = inFlightSynths.get(key);

    if (inFlight) {
      // Another request on this instance is already synthesizing the same
      // combination.  Wait for the in-flight result without consuming any quota
      // — the synthesizing request already holds the quota reservation.
      try {
        const row = await inFlight;
        await setSynthQuotaHeaders(res, userId);
        res.setHeader("X-Synth-Cache", "dedup");
        res.json({
          id: row.id,
          chapterId: row.chapterId,
          language: row.language,
          voice: row.voice,
          source: row.source,
          durationSeconds: row.durationSeconds,
          audioUrl: `/api/tracks/${row.id}/audio`,
        });
      } catch {
        res.status(503).json({
          error: "Audio generation temporarily unavailable. Please try again.",
        });
      }
      return;
    }

    // No in-flight synthesis for this key on this instance.  Register a
    // deferred promise immediately (still synchronous — no await since the
    // get() above) so any request that arrives while we are awaiting quota /
    // OpenAI / DB will wait on this promise instead of starting its own.
    let resolveSynth!: (row: SynthRow) => void;
    let rejectSynth!: (err: unknown) => void;
    const synthPromise = new Promise<SynthRow>((resolve, reject) => {
      resolveSynth = resolve;
      rejectSynth = reject;
    });
    // Attach a no-op catch so that rejections occurring before any concurrent
    // waiter has attached its own handler (e.g. quota exceeded, OpenAI error)
    // do not surface as unhandled Promise rejections.  Waiters still receive
    // the rejection normally when they await the promise from the map.
    synthPromise.catch(() => {});
    inFlightSynths.set(key, synthPromise); // ← synchronous, no yield since get()

    // Cache miss: this request will hit the paid OpenAI API.
    // Enforce the per-user quota for genuinely new syntheses.
    const quota = await reserveSynthHit(userId);
    if (!quota.ok) {
      inFlightSynths.delete(key);
      rejectSynth(new Error("quota_exceeded"));
      res.setHeader("Retry-After", String(quota.retryAfterSeconds));
      await setSynthQuotaHeaders(res, userId);
      res.status(429).json({ error: quota.message });
      return;
    }

    // Anti-churn guard: charge the IP budget only when a brand-new anonymous
    // cookie was just minted for this request (req.anonCookieIsNew is true).
    // req.anonIpKey is set for ALL anonymous requests (including returning
    // visitors with a valid long-lived cookie), so checking it unconditionally
    // would drain the shared per-IP budget on ordinary cache-miss playback,
    // enabling anyone on the same NAT to exhaust the quota for every other
    // guest — a network-wide denial of service.  Restricting to new-cookie
    // sessions means the IP guardrail only fires during cookie-churn attacks.
    // Placing this check here (after the cache lookup) means cache hits are
    // always free and never drain the shared IP budget.
    let ipHitId: number | undefined;
    if (req.anonIpKey && req.anonCookieIsNew) {
      const ipQuota = await reserveSynthHit(req.anonIpKey);
      if (!ipQuota.ok) {
        // Refund the per-user cookie quota since we won't be synthesizing.
        await releaseSynthHit(quota.hitId);
        inFlightSynths.delete(key);
        rejectSynth(new Error("ip_quota_exceeded"));
        res.setHeader("Retry-After", String(ipQuota.retryAfterSeconds));
        res.status(429).json({ error: ipQuota.message });
        return;
      }
      ipHitId = ipQuota.hitId;
    }

    // Cross-instance dedup via a Postgres session-level advisory lock.
    // The lock serializes synthesis of the same combination across all API
    // replicas.  Inside the lock we re-check the cache: if another instance
    // committed a row while we were waiting, we serve that row and refund
    // quota rather than calling OpenAI a second time.
    let row: SynthRow;
    try {
      // All DB work inside the lock uses `lockedDb` — a Drizzle instance
      // bound to the same dedicated client that holds the advisory lock.
      // This ensures each synth request consumes exactly ONE pool connection,
      // preventing pool exhaustion under concurrency.
      row = await withSynthLock(key, async (lockedDb) => {
        // Re-check cache inside the lock — another instance may have just
        // committed this track while we were waiting to acquire the lock.
        const racedExisting = await lockedDb.query.audioTracksTable.findFirst({
          where: and(
            eq(audioTracksTable.chapterId, chapterId),
            eq(audioTracksTable.language, language.code),
            eq(audioTracksTable.voice, voice.id),
          ),
        });
        if (racedExisting) {
          // Refund both quota slots — no synthesis was performed here.
          await releaseSynthHit(quota.hitId);
          if (ipHitId !== undefined) await releaseSynthHit(ipHitId);
          return racedExisting;
        }

        let passage: string;
        let audioBuffer: Buffer;
        try {
          if (language.code === "en") {
            passage = chapter.passageEn;
          } else {
            // Reuse a previously stored translation when available so we don't
            // re-run the (paid) translation model for text we already have.
            const cached =
              await lockedDb.query.chapterTranslationsTable.findFirst({
                where: and(
                  eq(chapterTranslationsTable.chapterId, chapterId),
                  eq(chapterTranslationsTable.languageCode, language.code),
                ),
              });
            if (cached) {
              passage = cached.translatedPassage;
            } else {
              passage = await translatePassage(
                chapter.passageEn,
                language.name,
              );
              // Persist for future synthesis + text display. onConflictDoNothing
              // tolerates a concurrent writer that inserted the same translation.
              await lockedDb
                .insert(chapterTranslationsTable)
                .values({
                  chapterId,
                  languageCode: language.code,
                  translatedPassage: passage,
                })
                .onConflictDoNothing();
            }
          }
          audioBuffer = await textToSpeech(passage, voice.openaiVoice, "mp3");
        } catch (e) {
          await releaseSynthHit(quota.hitId);
          if (ipHitId !== undefined) await releaseSynthHit(ipHitId);
          throw e;
        }

        const words = passage.split(/\s+/).filter(Boolean).length;
        const durationSeconds = Math.max(8, Math.round((words / 150) * 60));


        const objectPath = await uploadAudioToObjectStorage(
          audioBuffer,
          "audio/mpeg",
        );

        const inserted = await lockedDb
          .insert(audioTracksTable)
          .values({
            chapterId,
            language: language.code,
            voice: voice.id,
            source: "tts",
            durationSeconds,
            audioBytes: objectPath ? null : audioBuffer,
            objectPath,
            contentType: "audio/mpeg",
          })
          .returning();
        return inserted[0]!;
      });
    } catch (e) {
      inFlightSynths.delete(key);
      rejectSynth(e);
      throw e;
    }

    // Resolve the shared promise so any waiting dedup requests can respond,
    // then remove the map entry so future requests do a normal cache lookup.
    inFlightSynths.delete(key);
    resolveSynth(row);


    res.json({
      id: row.id,
      chapterId: row.chapterId,
      language: row.language,
      voice: row.voice,
      source: row.source,
      durationSeconds: row.durationSeconds,
      audioUrl: `/api/tracks/${row.id}/audio`,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/audio", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    const row = await db.query.audioTracksTable.findFirst({
      where: eq(audioTracksTable.id, id),
    });
    if (!row) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    // Clamp the stored content-type to the audio allowlist so legacy rows or
    // any unexpected value can never cause the browser to render active content.
    const safeContentType = ALLOWED_AUDIO_TYPES.has(row.contentType)
      ? row.contentType
      : "audio/mpeg";
    res.setHeader("Content-Type", safeContentType);
    // Force download so even a crafted Content-Type cannot trigger inline rendering.
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");

    if (row.objectPath) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!bucketId || !privateDir) {
        res.status(500).json({ error: "Object storage not configured" });
        return;
      }
      const path = `${privateDir.replace(/\/$/, "")}/${row.objectPath}`;
      const slash = path.indexOf("/", 1);
      const fileName = path.substring(slash + 1);
      const file = objectStorageClient.bucket(bucketId).file(fileName);
      const [meta] = await file.getMetadata();
      if (meta.size != null) {
        res.setHeader("Content-Length", String(meta.size));
      }
      file
        .createReadStream()
        .on("error", (err) => next(err))
        .pipe(res);
      return;
    }

    if (!row.audioBytes) {
      res.status(404).json({ error: "Audio bytes not available" });
      return;
    }
    res.setHeader("Content-Length", row.audioBytes.length.toString());
    res.send(row.audioBytes);
  } catch (err) {
    next(err);
  }
});

// Admin: replace a (chapter, language, voice) audio track with a human-recorded
// upload. Preserves the same /api/tracks/:id/audio URL so clients see no change.
// Authorize via ADMIN_USER_IDS (comma-separated Clerk user ids).
router.post(
  "/admin/replace",
  requireAuth,
  requireAdmin,
  upload.single("audio"),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }
      const uploadedMime = (file.mimetype ?? "").toLowerCase().split(";")[0]!.trim();
      if (!ALLOWED_AUDIO_TYPES.has(uploadedMime)) {
        res.status(415).json({ error: "Unsupported media type: only audio files are accepted" });
        return;
      }
      const chapterId = Number(req.body.chapterId);
      const languageCode = String(req.body.language ?? "");
      const voiceId = String(req.body.voice ?? "");
      const durationSeconds = Number(req.body.durationSeconds);

      if (!Number.isFinite(chapterId)) {
        res.status(400).json({ error: "chapterId is required" });
        return;
      }
      const language = getLanguage(languageCode);
      if (!language) {
        res.status(400).json({ error: `Unknown language: ${languageCode}` });
        return;
      }
      const voice = getVoice(voiceId);
      if (!voice) {
        res.status(400).json({ error: `Unknown voice: ${voiceId}` });
        return;
      }
      const chapter = await db.query.chaptersTable.findFirst({
        where: eq(chaptersTable.id, chapterId),
      });
      if (!chapter) {
        res.status(404).json({ error: "Chapter not found" });
        return;
      }

      const objectPath = await uploadAudioToObjectStorage(
        file.buffer,
        uploadedMime,
      );
      if (!objectPath) {
        res.status(500).json({ error: "Object storage upload failed" });
        return;
      }

      const dur =
        Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.round(durationSeconds)
          : 60;

      const existing = await db.query.audioTracksTable.findFirst({
        where: and(
          eq(audioTracksTable.chapterId, chapterId),
          eq(audioTracksTable.language, language.code),
          eq(audioTracksTable.voice, voice.id),
        ),
      });

      let row;
      if (existing) {
        const updated = await db
          .update(audioTracksTable)
          .set({
            source: "human",
            durationSeconds: dur,
            audioBytes: null,
            objectPath,
            contentType: uploadedMime,
          })
          .where(eq(audioTracksTable.id, existing.id))
          .returning();
        row = updated[0]!;
      } else {
        const inserted = await db
          .insert(audioTracksTable)
          .values({
            chapterId,
            language: language.code,
            voice: voice.id,
            source: "human",
            durationSeconds: dur,
            audioBytes: null,
            objectPath,
            contentType: uploadedMime,
          })
          .returning();
        row = inserted[0]!;
      }

      res.json({
        id: row.id,
        chapterId: row.chapterId,
        language: row.language,
        voice: row.voice,
        source: row.source,
        durationSeconds: row.durationSeconds,
        audioUrl: `/api/tracks/${row.id}/audio`,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
