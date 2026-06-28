/**
 * Durability tests for the per-user AI-preferences store.
 *
 * aiPreferences moved out of an in-memory Map into the `app_ai_preferences`
 * table (DatabaseStorage, C1). The store is keyed directly by user_id (the
 * interface has no surrogate id). Held only in memory, a user's AI toggles
 * reset to defaults on every restart.
 *
 * This suite proves the persisted upsert semantics:
 *   - createOrUpdateAIPreferences inserts a row a fresh instance reads back,
 *     applying defaults for unspecified toggles.
 *   - a second call UPDATES the same user row (one row per user) and only
 *     changes the supplied toggles.
 *   - preferences are scoped per user.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/ai-preferences-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appAiPreferencesTable } from "@shared/schema";
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
  await createSchemaTables(client, { appAiPreferencesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_ai_preferences;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(userId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_ai_preferences WHERE user_id = $1",
    [userId],
  );
  return Number(res.rows[0].count);
}

const USER = "ai-user";
const OTHER = "ai-other";

describe("createOrUpdateAIPreferences — insert with defaults", () => {
  it("creates a row with defaults a fresh instance reads back (restart)", async () => {
    const writer = await getStorage();
    const created = await writer.createOrUpdateAIPreferences(USER, {
      aiSummariesEnabled: false,
    });
    expect(created.aiExplanationsEnabled).toBe(true); // default
    expect(created.aiSummariesEnabled).toBe(false); // supplied

    const reader = await getStorage();
    const got = await reader.getAIPreferences(USER);
    expect(got).toBeDefined();
    expect(got!.aiSummariesEnabled).toBe(false);
    expect(got!.userId).toBe(USER);
    expect(await rowCount(USER)).toBe(1);
  });

  it("returns undefined for a user with no preferences", async () => {
    const storage = await getStorage();
    expect(await storage.getAIPreferences("nobody")).toBeUndefined();
  });
});

describe("createOrUpdateAIPreferences — update keeps a single row", () => {
  it("updates the existing user row rather than inserting a duplicate", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateAIPreferences(USER, { aiExplanationsEnabled: true });
    await storage.createOrUpdateAIPreferences(USER, { aiExplanationsEnabled: false });

    expect(await rowCount(USER)).toBe(1);
    const reader = await getStorage();
    const got = await reader.getAIPreferences(USER);
    expect(got!.aiExplanationsEnabled).toBe(false); // changed
    expect(got!.aiSummariesEnabled).toBe(true); // untouched default
  });
});

describe("createOrUpdateAIPreferences — scoped per user", () => {
  it("keeps each user's preferences independent", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateAIPreferences(USER, { aiExplanationsEnabled: false });
    await storage.createOrUpdateAIPreferences(OTHER, { aiExplanationsEnabled: true });

    expect((await storage.getAIPreferences(USER))!.aiExplanationsEnabled).toBe(false);
    expect((await storage.getAIPreferences(OTHER))!.aiExplanationsEnabled).toBe(true);
    expect(await rowCount(USER)).toBe(1);
    expect(await rowCount(OTHER)).toBe(1);
  });
});
