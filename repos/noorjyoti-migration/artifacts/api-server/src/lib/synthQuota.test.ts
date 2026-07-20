import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, synthHitsTable } from "@workspace/db";
import {
  SYNTH_DAY_MS,
  SYNTH_MAX_PER_DAY,
  SYNTH_MAX_PER_MINUTE,
  SYNTH_MINUTE_MS,
  getSynthQuotaSnapshot,
  releaseSynthHit,
  reserveSynthHit,
} from "./synthQuota";

const TEST_USER_PREFIX = "test-synthquota-";

function makeUserId(name: string): string {
  return `${TEST_USER_PREFIX}${name}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function clearUser(userId: string): Promise<void> {
  await db.delete(synthHitsTable).where(eq(synthHitsTable.userId, userId));
}

async function seedHits(
  userId: string,
  ages: number[],
): Promise<void> {
  const now = Date.now();
  if (ages.length === 0) return;
  await db
    .insert(synthHitsTable)
    .values(
      ages.map((ageMs) => ({
        userId,
        createdAt: new Date(now - ageMs),
      })),
    );
}

const createdUserIds: string[] = [];
function track(userId: string): string {
  createdUserIds.push(userId);
  return userId;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run synthQuota tests");
  }
});

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) {
    await clearUser(id);
  }
});

afterAll(async () => {
  // Best-effort cleanup of any stragglers from this run.
  // Individual test ids are namespaced by TEST_USER_PREFIX.
});

describe("getSynthQuotaSnapshot", () => {
  it("returns full quota for a user with no hits", async () => {
    const userId = track(makeUserId("empty"));
    const snap = await getSynthQuotaSnapshot(userId);
    expect(snap).toEqual({
      limitPerDay: SYNTH_MAX_PER_DAY,
      limitPerMinute: SYNTH_MAX_PER_MINUTE,
      remainingDay: SYNTH_MAX_PER_DAY,
      remainingMinute: SYNTH_MAX_PER_MINUTE,
      resetDaySeconds: 0,
    });
  });

  it("counts only hits inside the per-minute window for remainingMinute", async () => {
    const userId = track(makeUserId("minute"));
    // 2 fresh hits (within the minute) and 3 older-than-a-minute hits
    // (still within the day window).
    await seedHits(userId, [1_000, 5_000, 90_000, 120_000, 5 * 60_000]);
    const snap = await getSynthQuotaSnapshot(userId);
    expect(snap.remainingMinute).toBe(SYNTH_MAX_PER_MINUTE - 2);
    expect(snap.remainingDay).toBe(SYNTH_MAX_PER_DAY - 5);
  });

  it("clamps remaining values at zero when over the cap", async () => {
    const userId = track(makeUserId("over"));
    const ages = Array.from(
      { length: SYNTH_MAX_PER_MINUTE + 3 },
      (_, i) => 1_000 + i * 100,
    );
    await seedHits(userId, ages);
    const snap = await getSynthQuotaSnapshot(userId);
    expect(snap.remainingMinute).toBe(0);
    expect(snap.remainingDay).toBe(
      SYNTH_MAX_PER_DAY - (SYNTH_MAX_PER_MINUTE + 3),
    );
  });

  it("computes resetDaySeconds from the oldest hit in the day window", async () => {
    const userId = track(makeUserId("reset"));
    const oldestAgeMs = 60 * 60_000; // 1 hour ago
    await seedHits(userId, [oldestAgeMs, 5_000]);
    const snap = await getSynthQuotaSnapshot(userId);
    const expected = Math.ceil((SYNTH_DAY_MS - oldestAgeMs) / 1000);
    // Allow for a few seconds of clock drift between seed and read.
    expect(snap.resetDaySeconds).toBeGreaterThanOrEqual(expected - 5);
    expect(snap.resetDaySeconds).toBeLessThanOrEqual(expected + 1);
  });

  it("ignores hits older than the day window", async () => {
    const userId = track(makeUserId("expired"));
    await seedHits(userId, [SYNTH_DAY_MS + 60_000, SYNTH_DAY_MS + 120_000]);
    const snap = await getSynthQuotaSnapshot(userId);
    expect(snap.remainingDay).toBe(SYNTH_MAX_PER_DAY);
    expect(snap.remainingMinute).toBe(SYNTH_MAX_PER_MINUTE);
    expect(snap.resetDaySeconds).toBe(0);
  });
});

describe("reserveSynthHit", () => {
  it("inserts a row and decrements remaining quota", async () => {
    const userId = track(makeUserId("reserve"));
    const before = await getSynthQuotaSnapshot(userId);
    const result = await reserveSynthHit(userId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.hitId).toBe("number");
    const after = await getSynthQuotaSnapshot(userId);
    expect(after.remainingDay).toBe(before.remainingDay - 1);
    expect(after.remainingMinute).toBe(before.remainingMinute - 1);
  });

  it("rejects with a per-minute retry hint once the minute cap is full", async () => {
    const userId = track(makeUserId("minute-cap"));
    await seedHits(
      userId,
      Array.from({ length: SYNTH_MAX_PER_MINUTE }, (_, i) => 1_000 + i * 100),
    );
    const result = await reserveSynthHit(userId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(result.message).toMatch(/wait about/i);
  });

  it("rejects with a per-day retry hint once the day cap is full", async () => {
    const userId = track(makeUserId("day-cap"));
    // Spread across the day window so none fall into the per-minute window.
    const ages = Array.from(
      { length: SYNTH_MAX_PER_DAY },
      (_, i) => SYNTH_MINUTE_MS * 2 + i * 60_000,
    );
    await seedHits(userId, ages);
    const result = await reserveSynthHit(userId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Day-window backoff is at least 60s by design.
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(60);
    expect(result.message).toMatch(/today's limit/i);
  });
});

describe("releaseSynthHit", () => {
  it("removes the reserved row so the user's quota is refunded", async () => {
    const userId = track(makeUserId("release"));
    const result = await reserveSynthHit(userId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const afterReserve = await getSynthQuotaSnapshot(userId);
    expect(afterReserve.remainingDay).toBe(SYNTH_MAX_PER_DAY - 1);

    await releaseSynthHit(result.hitId);

    const afterRelease = await getSynthQuotaSnapshot(userId);
    expect(afterRelease.remainingDay).toBe(SYNTH_MAX_PER_DAY);
    const remaining = await db
      .select({ id: synthHitsTable.id })
      .from(synthHitsTable)
      .where(eq(synthHitsTable.userId, userId));
    expect(remaining).toHaveLength(0);
  });
});
