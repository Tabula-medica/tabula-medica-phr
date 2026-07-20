import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  db,
  audioTracksTable,
  chaptersTable,
  scripturesTable,
  synthHitsTable,
  traditionsTable,
} from "@workspace/db";
import {
  SYNTH_MAX_PER_DAY,
  SYNTH_MAX_PER_MINUTE,
} from "../lib/synthQuota";

// Auth now comes from req.gcipUid (set by resolveGcipUser after GCIP token
// verify). The test injects a deterministic user id via a middleware in
// beforeAll rather than mocking an auth SDK.
let currentUserId: string | null = null;

// Imports below must come AFTER vi.mock so the mocked module is in effect.
const { default: meRouter } = await import("./me");
const { default: tracksRouter } = await import("./tracks");

let app: Express;
let traditionId: number;
let scriptureId: number;
let chapterId: number;
let trackId: number;

const TEST_TAG = `quota-integ-${Date.now()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run integration tests");
  }

  app = express();
  app.use(express.json());
  // Inject the GCIP user id the same way resolveGcipUser would (from a verified token).
  app.use((req, _res, next) => { if (currentUserId) (req as unknown as { gcipUid?: string }).gcipUid = currentUserId; next(); });
  app.use("/api/me", meRouter);
  app.use("/api/tracks", tracksRouter);

  const [tradition] = await db
    .insert(traditionsTable)
    .values({
      slug: `${TEST_TAG}-tradition`,
      name: "Test Tradition",
      shortDescription: "test",
      longDescription: "test",
      founded: "n/a",
      region: "n/a",
      accentColor: "#000000",
      symbolName: "om",
      sortOrder: 9999,
    })
    .returning();
  traditionId = tradition!.id;

  const [scripture] = await db
    .insert(scripturesTable)
    .values({
      traditionId,
      slug: `${TEST_TAG}-scripture`,
      name: "Test Scripture",
      originalName: "Test",
      description: "test",
      era: "modern",
      sortOrder: 9999,
    })
    .returning();
  scriptureId = scripture!.id;

  const [chapter] = await db
    .insert(chaptersTable)
    .values({
      scriptureId,
      number: 1,
      title: "Test Chapter",
      summary: "summary",
      passageEn: "Be still.",
      estimatedReadSeconds: 30,
      sortOrder: 1,
    })
    .returning();
  chapterId = chapter!.id;

  const [track] = await db
    .insert(audioTracksTable)
    .values({
      chapterId,
      language: "en",
      voice: "female_warm",
      source: "tts",
      durationSeconds: 30,
      audioBytes: Buffer.from([0x00, 0x01, 0x02]),
      objectPath: null,
      contentType: "audio/mpeg",
    })
    .returning();
  trackId = track!.id;
});

afterEach(async () => {
  currentUserId = null;
});

afterAll(async () => {
  // Tear down in FK-safe order. audioTracks/chapters cascade from scripture/tradition.
  if (trackId) {
    await db.delete(audioTracksTable).where(eq(audioTracksTable.id, trackId));
  }
  if (traditionId) {
    await db
      .delete(traditionsTable)
      .where(eq(traditionsTable.id, traditionId));
  }
});

async function clearUserHits(userId: string): Promise<void> {
  await db.delete(synthHitsTable).where(eq(synthHitsTable.userId, userId));
}

describe("GET /api/me/quota", () => {
  it("requires authentication", async () => {
    currentUserId = null;
    // requireAuth has a dev-mode bypass (NODE_ENV !== "production") that
    // injects an anon user. Pin NODE_ENV=production for this assertion so
    // we are actually exercising the unauthenticated rejection path.
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await request(app).get("/api/me/quota");
      expect(res.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns the full snapshot for a fresh user", async () => {
    const userId = `${TEST_TAG}-quota-fresh`;
    currentUserId = userId;
    await clearUserHits(userId);
    try {
      const res = await request(app).get("/api/me/quota");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        limitPerDay: SYNTH_MAX_PER_DAY,
        limitPerMinute: SYNTH_MAX_PER_MINUTE,
        remainingDay: SYNTH_MAX_PER_DAY,
        remainingMinute: SYNTH_MAX_PER_MINUTE,
        resetDaySeconds: 0,
      });
    } finally {
      await clearUserHits(userId);
    }
  });

  it("reflects already-recorded hits in remainingDay", async () => {
    const userId = `${TEST_TAG}-quota-used`;
    currentUserId = userId;
    await clearUserHits(userId);
    try {
      const now = new Date();
      await db
        .insert(synthHitsTable)
        .values([
          { userId, createdAt: new Date(now.getTime() - 2 * 60_000) },
          { userId, createdAt: new Date(now.getTime() - 3 * 60_000) },
        ]);
      const res = await request(app).get("/api/me/quota");
      expect(res.status).toBe(200);
      expect(res.body.remainingDay).toBe(SYNTH_MAX_PER_DAY - 2);
      // Both hits are older than 1 minute.
      expect(res.body.remainingMinute).toBe(SYNTH_MAX_PER_MINUTE);
    } finally {
      await clearUserHits(userId);
    }
  });
});

describe("POST /api/tracks/synthesize quota headers", () => {
  it("serves a cached track without consuming quota and surfaces X-Synth-Remaining-Day", async () => {
    const userId = `${TEST_TAG}-cache-hit`;
    currentUserId = userId;
    await clearUserHits(userId);
    try {
      const res = await request(app)
        .post("/api/tracks/synthesize")
        .send({
          chapterId,
          language: "en",
          voice: "female_warm",
        });

      expect(res.status).toBe(200);
      expect(res.headers["x-synth-cache"]).toBe("hit");
      expect(res.headers["x-synth-remaining-day"]).toBe(
        String(SYNTH_MAX_PER_DAY),
      );
      expect(res.headers["x-synth-limit-day"]).toBe(String(SYNTH_MAX_PER_DAY));
      expect(res.headers["x-synth-remaining-minute"]).toBe(
        String(SYNTH_MAX_PER_MINUTE),
      );
      expect(res.body).toMatchObject({
        chapterId,
        language: "en",
        voice: "female_warm",
        source: "tts",
      });

      // Cache hit must NOT consume quota — no synth_hits row should exist.
      const remaining = await db
        .select({ id: synthHitsTable.id })
        .from(synthHitsTable)
        .where(eq(synthHitsTable.userId, userId));
      expect(remaining).toHaveLength(0);
    } finally {
      await clearUserHits(userId);
    }
  });

  it("allows an UNAUTHENTICATED visitor to synthesize (anon device id, cache hit)", async () => {
    // Regression lock: anonymous users must be able to tap play immediately.
    // resolveUserOrAnon mints a signed `nj_anon` cookie and keys quota on
    // `anon:cookie:<uuid>`. A secondary anti-churn guard checks
    // `anon:ip:<clientIp>` before the cache-hit shortcut (to prevent bulk
    // cookie minting via cache hits), but that should not block a fresh
    // visitor. With no Clerk session and no incoming cookie, this request
    // must succeed (cache hit path) AND set the anonymous device cookie.
    currentUserId = null;
    vi.stubEnv("NODE_ENV", "production");
    // ANON_COOKIE_SECRET is required in production mode; provide a test value.
    vi.stubEnv("ANON_COOKIE_SECRET", "test-secret-for-anon-cookie-signing");
    // The anti-churn guard writes an anon:ip:127.0.0.1 synth_hit row.
    // Clear any pre-existing hits so the test is not order-dependent.
    const anonIpKey = "anon:ip:127.0.0.1";
    await clearUserHits(anonIpKey);
    try {
      const res = await request(app)
        .post("/api/tracks/synthesize")
        .send({
          chapterId,
          language: "en",
          voice: "female_warm",
        });

      expect(res.status).toBe(200);
      expect(res.headers["x-synth-cache"]).toBe("hit");
      expect(res.body).toMatchObject({
        chapterId,
        language: "en",
        voice: "female_warm",
        source: "tts",
      });
      // The middleware must have set the long-lived signed anon cookie so
      // the next request from this device reuses the same device identity.
      // Cookie value format: <uuid>.<hex-hmac> (URL-encoded dot as %2E).
      const setCookie = res.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie)
        ? setCookie.join("\n")
        : String(setCookie ?? "");
      expect(cookieStr).toMatch(/nj_anon=/);
      expect(cookieStr).toMatch(/HttpOnly/);
      expect(cookieStr).toMatch(/SameSite=Lax/);
      expect(cookieStr).toMatch(/Secure/);
    } finally {
      await clearUserHits(anonIpKey);
      vi.unstubAllEnvs();
    }
  });

  it("returns 429 with Retry-After when the per-day cap is reached", async () => {
    const userId = `${TEST_TAG}-day-cap`;
    currentUserId = userId;
    await clearUserHits(userId);
    try {
      const now = Date.now();
      // Fill the day quota with hits all older than the per-minute window so
      // we exercise the per-day branch (not the per-minute one).
      await db.insert(synthHitsTable).values(
        Array.from({ length: SYNTH_MAX_PER_DAY }, (_, i) => ({
          userId,
          createdAt: new Date(now - 2 * 60_000 - i * 60_000),
        })),
      );

      // Use a (chapter, language, voice) combo that does NOT exist so it is
      // a cache miss and goes through the quota check.
      const res = await request(app)
        .post("/api/tracks/synthesize")
        .send({
          chapterId,
          language: "fr",
          voice: "male_clear",
        });

      expect(res.status).toBe(429);
      expect(res.headers["retry-after"]).toBeDefined();
      expect(Number(res.headers["retry-after"])).toBeGreaterThanOrEqual(60);
      expect(res.headers["x-synth-remaining-day"]).toBe("0");
    } finally {
      await clearUserHits(userId);
    }
  });
});
