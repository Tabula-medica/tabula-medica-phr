/**
 * Durability tests for the onboarding-status store.
 *
 * onboardingStatuses moved out of an in-memory Map into the
 * `app_onboarding_statuses` table (DatabaseStorage, C1). The store is keyed
 * directly by user_id (the interface has no surrogate id). Held only in memory,
 * a user's completed onboarding is forgotten on restart and they are
 * re-prompted from scratch.
 *
 * This suite proves the persisted upsert semantics:
 *   - updateOnboardingStatus inserts a row a fresh instance reads back, then
 *     MERGES a partial update onto the existing row (one row per user).
 *   - completeOnboarding records completion (steps + lastStepCompleted +
 *     completedAt) durably.
 *   - statuses are scoped per user.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/onboarding-status-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appOnboardingStatusesTable } from "@shared/schema";
import { createSchemaTables } from "./helpers/pglite-schema";

const ref = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../server/db", () => ({
  get db() {
    return ref.db;
  },
}));

let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  ref.db = drizzle(client);
  await createSchemaTables(client, { appOnboardingStatusesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_onboarding_statuses;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(userId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_onboarding_statuses WHERE user_id = $1",
    [userId],
  );
  return Number(res.rows[0].count);
}

const USER = "onboarding-user";
const OTHER = "onboarding-other";

describe("updateOnboardingStatus — durable insert then merge", () => {
  it("inserts a status a fresh instance reads back", async () => {
    const writer = await getStorage();
    const created = await writer.updateOnboardingStatus(USER, {
      completedSteps: ["welcome"],
    });
    expect(created.hasCompletedOnboarding).toBe(false); // default
    expect(created.completedSteps).toEqual(["welcome"]);

    const reader = await getStorage();
    const got = await reader.getOnboardingStatus(USER);
    expect(got).toBeDefined();
    expect(got!.completedSteps).toEqual(["welcome"]);
    expect(await rowCount(USER)).toBe(1);
  });

  it("merges a partial update onto the existing row, keeping a single row", async () => {
    const storage = await getStorage();
    await storage.updateOnboardingStatus(USER, { completedSteps: ["welcome", "profile"] });
    // partial update that only flips the boolean — completedSteps must be kept.
    await storage.updateOnboardingStatus(USER, { hasCompletedOnboarding: true });

    expect(await rowCount(USER)).toBe(1);
    const reader = await getStorage();
    const got = await reader.getOnboardingStatus(USER);
    expect(got!.hasCompletedOnboarding).toBe(true); // changed
    expect(got!.completedSteps).toEqual(["welcome", "profile"]); // preserved
  });

  it("returns undefined for a user with no onboarding row", async () => {
    const storage = await getStorage();
    expect(await storage.getOnboardingStatus("nobody")).toBeUndefined();
  });
});

describe("completeOnboarding — records completion durably", () => {
  it("marks onboarding complete with steps, lastStepCompleted, and completedAt", async () => {
    const storage = await getStorage();
    const result = await storage.completeOnboarding(USER, ["welcome", "profile", "done"]);
    expect(result.hasCompletedOnboarding).toBe(true);
    expect(result.lastStepCompleted).toBe("done");
    expect(result.completedAt).toBeTruthy();

    const reader = await getStorage();
    const got = await reader.getOnboardingStatus(USER);
    expect(got!.hasCompletedOnboarding).toBe(true);
    expect(got!.completedSteps).toEqual(["welcome", "profile", "done"]);
    expect(got!.lastStepCompleted).toBe("done");
    expect(await rowCount(USER)).toBe(1);
  });

  it("overwrites an in-progress status when completing", async () => {
    const storage = await getStorage();
    await storage.updateOnboardingStatus(USER, { completedSteps: ["welcome"] });
    await storage.completeOnboarding(USER, ["welcome", "profile"]);

    const reader = await getStorage();
    const got = await reader.getOnboardingStatus(USER);
    expect(got!.hasCompletedOnboarding).toBe(true);
    expect(got!.completedSteps).toEqual(["welcome", "profile"]);
    expect(await rowCount(USER)).toBe(1);
  });
});

describe("onboarding status — scoped per user", () => {
  it("keeps each user's onboarding independent", async () => {
    const storage = await getStorage();
    await storage.completeOnboarding(USER, ["welcome"]);
    await storage.updateOnboardingStatus(OTHER, { completedSteps: ["welcome"] });

    expect((await storage.getOnboardingStatus(USER))!.hasCompletedOnboarding).toBe(true);
    expect((await storage.getOnboardingStatus(OTHER))!.hasCompletedOnboarding).toBe(false);
    expect(await rowCount(USER)).toBe(1);
    expect(await rowCount(OTHER)).toBe(1);
  });
});
