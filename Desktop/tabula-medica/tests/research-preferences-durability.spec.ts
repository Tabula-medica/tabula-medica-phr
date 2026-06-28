/**
 * Durability tests for the research-preferences store.
 *
 * researchPreferences moved out of an in-memory Map into the
 * `app_research_preferences` table (DatabaseStorage, C1). This is a CONSENT
 * record: whether a patient permits their data to be used for research /
 * monetization, with which de-identification method and purposes. Held only in
 * memory it would silently reset to the no-consent default on every restart —
 * a consent-integrity problem, not just a durability one.
 *
 * This suite proves the persisted upsert semantics:
 *   - createOrUpdateResearchPreferences inserts a row a fresh instance reads
 *     back, including the jsonb array fields.
 *   - a second call UPDATES the same patient row (one row per patient),
 *     preserving id + createdAt while changing the rest.
 *   - preferences are scoped per patient.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/research-preferences-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appResearchPreferencesTable } from "@shared/schema";
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
  await createSchemaTables(client, { appResearchPreferencesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_research_preferences;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(patientUserId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_research_preferences WHERE patient_user_id = $1",
    [patientUserId],
  );
  return Number(res.rows[0].count);
}

const PATIENT = "research-patient";
const OTHER = "research-other";

describe("createOrUpdateResearchPreferences — durable consent record", () => {
  it("persists a consent opt-in a fresh instance reads back, arrays included", async () => {
    const writer = await getStorage();
    const created = await writer.createOrUpdateResearchPreferences({
      patientUserId: PATIENT,
      allowResearch: true,
      allowMonetization: true,
      allowedPurposes: ["clinical_research"],
      excludedCategories: ["conditions"],
    });
    expect(created.allowResearch).toBe(true);
    expect(created.allowedPurposes).toEqual(["clinical_research"]);

    const reader = await getStorage();
    const got = await reader.getResearchPreferences(PATIENT);
    expect(got).toBeDefined();
    expect(got!.allowResearch).toBe(true);
    expect(got!.allowMonetization).toBe(true);
    expect(got!.allowedPurposes).toEqual(["clinical_research"]);
    expect(got!.excludedCategories).toEqual(["conditions"]);
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("defaults to no-consent when unspecified", async () => {
    const storage = await getStorage();
    const created = await storage.createOrUpdateResearchPreferences({ patientUserId: PATIENT });
    expect(created.allowResearch).toBe(false);
    expect(created.allowMonetization).toBe(false);
    expect(created.preferredMethod).toBe("safe_harbor");
    expect(created.requireNotification).toBe(true);
    expect(created.allowedPurposes).toEqual([]);
  });

  it("returns undefined for a patient with no preferences", async () => {
    const storage = await getStorage();
    expect(await storage.getResearchPreferences("nobody")).toBeUndefined();
  });
});

describe("createOrUpdateResearchPreferences — update keeps id + createdAt", () => {
  it("updates the same patient row, preserving id and createdAt", async () => {
    const storage = await getStorage();
    const first = await storage.createOrUpdateResearchPreferences({
      patientUserId: PATIENT,
      allowResearch: true,
    });
    const second = await storage.createOrUpdateResearchPreferences({
      patientUserId: PATIENT,
      allowResearch: false,
    });

    expect(second.id).toBe(first.id); // surrogate id preserved
    expect(second.createdAt).toBe(first.createdAt); // createdAt preserved
    expect(second.allowResearch).toBe(false); // value changed
    expect(await rowCount(PATIENT)).toBe(1);

    const reader = await getStorage();
    expect((await reader.getResearchPreferences(PATIENT))!.allowResearch).toBe(false);
  });
});

describe("createOrUpdateResearchPreferences — scoped per patient", () => {
  it("keeps each patient's consent independent", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateResearchPreferences({ patientUserId: PATIENT, allowResearch: true });
    await storage.createOrUpdateResearchPreferences({ patientUserId: OTHER, allowResearch: false });

    expect((await storage.getResearchPreferences(PATIENT))!.allowResearch).toBe(true);
    expect((await storage.getResearchPreferences(OTHER))!.allowResearch).toBe(false);
    expect(await rowCount(PATIENT)).toBe(1);
    expect(await rowCount(OTHER)).toBe(1);
  });
});
