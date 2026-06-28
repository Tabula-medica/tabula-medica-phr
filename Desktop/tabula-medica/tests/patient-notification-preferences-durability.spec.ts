/**
 * Durability tests for the patient-notification-preferences store.
 *
 * patientNotificationPreferences moved out of an in-memory Map into the
 * `app_patient_notification_preferences` table (DatabaseStorage, C1). These are
 * per-patient channel toggles, reminder cadence, quiet hours, and language. Held
 * only in memory they reset to defaults on every restart.
 *
 * This suite proves the persisted upsert semantics:
 *   - createOrUpdateNotificationPreferences inserts a row a fresh instance reads
 *     back, including the integer cadence and optional quiet-hours fields.
 *   - a second call UPDATES the same patient row (one row), preserving id.
 *   - optional quiet-hours round-trip as undefined when unset.
 *   - preferences are scoped per patient.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/patient-notification-preferences-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appPatientNotificationPreferencesTable } from "@shared/schema";
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
  await createSchemaTables(client, { appPatientNotificationPreferencesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_patient_notification_preferences;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(patientId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_patient_notification_preferences WHERE patient_id = $1",
    [patientId],
  );
  return Number(res.rows[0].count);
}

const PATIENT = "notif-pref-patient";
const OTHER = "notif-pref-other";

describe("createOrUpdateNotificationPreferences — durable insert", () => {
  it("persists prefs a fresh instance reads back, including cadence + quiet hours", async () => {
    const writer = await getStorage();
    const created = await writer.createOrUpdateNotificationPreferences({
      patientId: PATIENT,
      smsEnabled: true,
      reminderDaysBefore: 7,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      preferredLanguage: "es",
    });
    expect(created.smsEnabled).toBe(true);
    expect(created.reminderDaysBefore).toBe(7);

    const reader = await getStorage();
    const got = await reader.getNotificationPreferences(PATIENT);
    expect(got).toBeDefined();
    expect(got!.reminderDaysBefore).toBe(7);
    expect(got!.quietHoursStart).toBe("22:00");
    expect(got!.quietHoursEnd).toBe("07:00");
    expect(got!.preferredLanguage).toBe("es");
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("applies defaults and round-trips unset quiet hours as undefined", async () => {
    const storage = await getStorage();
    const created = await storage.createOrUpdateNotificationPreferences({ patientId: PATIENT });
    expect(created.emailEnabled).toBe(true);
    expect(created.smsEnabled).toBe(false);
    expect(created.reminderDaysBefore).toBe(3);
    expect(created.preferredLanguage).toBe("en");
    expect(created.quietHoursStart).toBeUndefined();

    const reader = await getStorage();
    const got = await reader.getNotificationPreferences(PATIENT);
    expect(got!.quietHoursStart).toBeUndefined();
    expect(got!.quietHoursStart).not.toBeNull();
  });

  it("returns undefined for a patient with no preferences", async () => {
    const storage = await getStorage();
    expect(await storage.getNotificationPreferences("nobody")).toBeUndefined();
  });
});

describe("createOrUpdateNotificationPreferences — update keeps a single row", () => {
  it("updates the existing patient row rather than inserting a duplicate", async () => {
    const storage = await getStorage();
    const first = await storage.createOrUpdateNotificationPreferences({
      patientId: PATIENT,
      pushEnabled: true,
    });
    const second = await storage.createOrUpdateNotificationPreferences({
      patientId: PATIENT,
      pushEnabled: false,
      reminderDaysBefore: 5,
    });

    expect(second.id).toBe(first.id);
    expect(await rowCount(PATIENT)).toBe(1);

    const reader = await getStorage();
    const got = await reader.getNotificationPreferences(PATIENT);
    expect(got!.pushEnabled).toBe(false);
    expect(got!.reminderDaysBefore).toBe(5);
  });
});

describe("createOrUpdateNotificationPreferences — scoped per patient", () => {
  it("keeps each patient's preferences independent", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateNotificationPreferences({ patientId: PATIENT, smsEnabled: true });
    await storage.createOrUpdateNotificationPreferences({ patientId: OTHER, smsEnabled: false });

    expect((await storage.getNotificationPreferences(PATIENT))!.smsEnabled).toBe(true);
    expect((await storage.getNotificationPreferences(OTHER))!.smsEnabled).toBe(false);
    expect(await rowCount(PATIENT)).toBe(1);
    expect(await rowCount(OTHER)).toBe(1);
  });
});
