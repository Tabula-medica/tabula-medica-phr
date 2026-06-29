/**
 * Durability tests for the patient onboarding-session store.
 *
 * onboardingSessions moved out of an in-memory Map into the
 * `app_onboarding_sessions` table (DatabaseStorage, C1). A session holds the
 * in-progress onboarding state plus the patient's entered form data. Held only
 * in memory, an in-progress onboarding is lost on restart and the patient
 * starts over.
 *
 * This suite proves:
 *   - createOnboardingSession persists a session a fresh instance reads back,
 *     with the formData jsonb round-tripping and defaults applied.
 *   - getOnboardingSessionByUser returns the user's still-incomplete session and
 *     stops returning it once complete.
 *   - updateOnboardingSession merges a partial update; completeOnboardingSession
 *     flips isComplete + stamps completedAt durably.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/onboarding-sessions-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appOnboardingSessionsTable } from "@shared/schema";
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
  await createSchemaTables(client, { appOnboardingSessionsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_onboarding_sessions;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const USER = "onb-session-user";

describe("createOnboardingSession — durable, form data round-trips", () => {
  it("persists a session a fresh instance reads back with defaults + formData", async () => {
    const writer = await getStorage();
    const created = await writer.createOnboardingSession({
      userId: USER,
      formData: { personalInfo: { firstName: "Ada", lastName: "Lovelace" } },
    } as Parameters<typeof writer.createOnboardingSession>[0]);
    expect(created.currentStep).toBe("welcome"); // default
    expect(created.isComplete).toBe(false); // default
    expect(created.completedSteps).toEqual([]);

    const reader = await getStorage();
    const got = await reader.getOnboardingSession(created.id);
    expect(got).toBeDefined();
    expect(got!.formData).toEqual({ personalInfo: { firstName: "Ada", lastName: "Lovelace" } });
  });
});

describe("getOnboardingSessionByUser — only the incomplete one", () => {
  it("returns the user's incomplete session, then stops once complete", async () => {
    const storage = await getStorage();
    const created = await storage.createOnboardingSession({
      userId: USER,
    } as Parameters<typeof storage.createOnboardingSession>[0]);

    let byUser = await storage.getOnboardingSessionByUser(USER);
    expect(byUser).toBeDefined();
    expect(byUser!.id).toBe(created.id);

    await storage.completeOnboardingSession(created.id);

    byUser = await storage.getOnboardingSessionByUser(USER);
    expect(byUser).toBeUndefined(); // complete sessions are not returned
  });
});

describe("updateOnboardingSession / completeOnboardingSession — persist", () => {
  it("merges a partial update and a fresh instance sees it", async () => {
    const storage = await getStorage();
    const created = await storage.createOnboardingSession({
      userId: USER,
    } as Parameters<typeof storage.createOnboardingSession>[0]);

    const updated = await storage.updateOnboardingSession(created.id, {
      currentStep: "documents",
      completedSteps: ["welcome"],
    } as Parameters<typeof storage.updateOnboardingSession>[1]);
    expect(updated!.currentStep).toBe("documents");
    expect(updated!.completedSteps).toEqual(["welcome"]);

    const reader = await getStorage();
    expect((await reader.getOnboardingSession(created.id))!.currentStep).toBe("documents");
  });

  it("completeOnboardingSession flips isComplete + stamps completedAt durably", async () => {
    const storage = await getStorage();
    const created = await storage.createOnboardingSession({
      userId: USER,
    } as Parameters<typeof storage.createOnboardingSession>[0]);

    const completed = await storage.completeOnboardingSession(created.id);
    expect(completed!.isComplete).toBe(true);
    expect(completed!.completedAt).toBeTruthy();

    const reader = await getStorage();
    const got = await reader.getOnboardingSession(created.id);
    expect(got!.isComplete).toBe(true);
    expect(got!.completedAt).toBeTruthy();
  });

  it("returns undefined for a missing session id", async () => {
    const storage = await getStorage();
    const missing = "00000000-0000-0000-0000-000000000000";
    expect(await storage.getOnboardingSession(missing)).toBeUndefined();
    expect(await storage.completeOnboardingSession(missing)).toBeUndefined();
  });
});
