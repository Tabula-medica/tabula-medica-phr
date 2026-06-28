/**
 * Durability tests for the default-sharing-policies store.
 *
 * defaultSharingPolicies moved out of an in-memory Map into the
 * `app_default_sharing_policies` table (DatabaseStorage, C1). These are
 * access-control config: a patient's default PHI access level + auto-approve
 * flag per (recipientType, dataCategory). Held only in memory, the patient's
 * sharing defaults silently drop back to nothing on every restart.
 *
 * This suite proves the persisted upsert semantics:
 *   - createOrUpdateDefaultPolicy inserts a row a fresh instance reads back.
 *   - getDefaultSharingPolicy resolves by the (patient, recipientType,
 *     dataCategory) composite key.
 *   - a second call on the same composite UPDATES (one row), preserving id +
 *     createdAt; a different category/recipient is a distinct row.
 *   - getDefaultSharingPolicies is scoped per patient.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table (including the composite unique index); assertions read back
 * through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/default-sharing-policies-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appDefaultSharingPoliciesTable } from "@shared/schema";
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
  await createSchemaTables(client, { appDefaultSharingPoliciesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_default_sharing_policies;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(patientUserId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_default_sharing_policies WHERE patient_user_id = $1",
    [patientUserId],
  );
  return Number(res.rows[0].count);
}

const PATIENT = "policy-patient";
const OTHER = "policy-other";

describe("createOrUpdateDefaultPolicy — durable, composite-keyed", () => {
  it("persists a policy a fresh instance reads back by composite key", async () => {
    const writer = await getStorage();
    const created = await writer.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "read",
      autoApprove: true,
    });
    expect(created.defaultAccessLevel).toBe("read");
    expect(created.autoApprove).toBe(true);

    const reader = await getStorage();
    const got = await reader.getDefaultSharingPolicy(PATIENT, "doctor", "medications");
    expect(got).toBeDefined();
    expect(got!.defaultAccessLevel).toBe("read");
    expect(got!.id).toBe(created.id);
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("defaults defaultAccessLevel to none and autoApprove to false", async () => {
    const storage = await getStorage();
    const created = await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "caregiver",
      dataCategory: "conditions",
    });
    expect(created.defaultAccessLevel).toBe("none");
    expect(created.autoApprove).toBe(false);
  });

  it("returns undefined for an unset composite", async () => {
    const storage = await getStorage();
    expect(await storage.getDefaultSharingPolicy(PATIENT, "doctor", "medications")).toBeUndefined();
  });
});

describe("createOrUpdateDefaultPolicy — upsert on composite key", () => {
  it("updates the same row for the same composite, preserving id + createdAt", async () => {
    const storage = await getStorage();
    const first = await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "read",
    });
    const second = await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "full",
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.defaultAccessLevel).toBe("full");
    expect(await rowCount(PATIENT)).toBe(1);
  });

  it("treats a different category or recipient as a distinct policy", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "read",
    });
    await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "conditions",
      defaultAccessLevel: "full",
    });
    await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "caregiver",
      dataCategory: "medications",
      defaultAccessLevel: "none",
    });

    expect(await rowCount(PATIENT)).toBe(3);
    expect(await storage.getDefaultSharingPolicies(PATIENT)).toHaveLength(3);
  });
});

describe("getDefaultSharingPolicies — scoped per patient", () => {
  it("returns only the given patient's policies", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateDefaultPolicy({
      patientUserId: PATIENT,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "read",
    });
    await storage.createOrUpdateDefaultPolicy({
      patientUserId: OTHER,
      recipientType: "doctor",
      dataCategory: "medications",
      defaultAccessLevel: "full",
    });

    expect(await storage.getDefaultSharingPolicies(PATIENT)).toHaveLength(1);
    expect(await storage.getDefaultSharingPolicies(OTHER)).toHaveLength(1);
    expect((await storage.getDefaultSharingPolicies(PATIENT))[0].defaultAccessLevel).toBe("read");
  });
});
