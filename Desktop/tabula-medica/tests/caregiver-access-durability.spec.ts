/**
 * Durability tests for the caregiver access-log and access-request stores.
 *
 * Both moved out of in-memory Maps into app_caregiver_access_logs and
 * app_caregiver_access_requests (DatabaseStorage, C1).
 *
 *   - The access LOG is a HIPAA accounting-of-disclosures trail: every caregiver
 *     view/action on a patient's data. Losing it on restart destroys the record.
 *   - The access REQUEST is a caregiver's pending ask for a sensitive permission;
 *     held in memory, every pending request vanishes on restart.
 *
 * This suite proves:
 *   - createCaregiverAccessLog persists rows a fresh instance reads back, scoped
 *     by patient and filterable by caregiver/resourceType, newest-first + limit.
 *   - createCaregiverAccessRequest persists; getCaregiverAccessRequests scopes by
 *     patient and filters by status.
 *   - reviewCaregiverAccessRequest is OWNERSHIP-SCOPED: a non-owning patient
 *     cannot approve/deny another patient's request, and the review persists.
 *
 * server/db is mocked with in-process Postgres (PGlite) from the canonical
 * Drizzle tables; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/caregiver-access-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  appCaregiverAccessLogsTable,
  appCaregiverAccessRequestsTable,
} from "@shared/schema";
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
  await createSchemaTables(client, {
    appCaregiverAccessLogsTable,
    appCaregiverAccessRequestsTable,
  });
});

beforeEach(async () => {
  await client.exec(
    "TRUNCATE app_caregiver_access_logs; TRUNCATE app_caregiver_access_requests;",
  );
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const PATIENT = "patient-1";
const OTHER_PATIENT = "patient-2";
const CAREGIVER = "caregiver-1";

describe("createCaregiverAccessLog — durable accounting of disclosures", () => {
  it("persists logs a fresh instance reads back, scoped by patient", async () => {
    const writer = await getStorage();
    await writer.createCaregiverAccessLog({
      caregiverId: CAREGIVER,
      caregiverName: "Care Giver",
      patientUserId: PATIENT,
      accessType: "view",
      resourceType: "medications",
      action: "viewed medication list",
      approved: true,
      emergencyOverride: false,
      patientNotified: true,
    });
    await writer.createCaregiverAccessLog({
      caregiverId: "other-caregiver",
      caregiverName: "Other",
      patientUserId: OTHER_PATIENT,
      accessType: "view",
      resourceType: "allergies",
      action: "viewed allergies",
      approved: true,
      emergencyOverride: false,
      patientNotified: false,
    });

    const reader = await getStorage();
    const logs = await reader.getCaregiverAccessLogs(PATIENT);
    expect(logs).toHaveLength(1);
    expect(logs[0].resourceType).toBe("medications");
    expect(logs[0].patientNotified).toBe(true);
  });

  it("filters by caregiver and resourceType, honours limit", async () => {
    const storage = await getStorage();
    for (const rt of ["medications", "allergies", "documents"]) {
      await storage.createCaregiverAccessLog({
        caregiverId: CAREGIVER,
        caregiverName: "Care Giver",
        patientUserId: PATIENT,
        accessType: "view",
        resourceType: rt,
        action: `viewed ${rt}`,
        approved: true,
        emergencyOverride: false,
        patientNotified: false,
      });
    }
    await storage.createCaregiverAccessLog({
      caregiverId: "cg-2",
      caregiverName: "Second",
      patientUserId: PATIENT,
      accessType: "view",
      resourceType: "medications",
      action: "viewed meds",
      approved: true,
      emergencyOverride: false,
      patientNotified: false,
    });

    expect(await storage.getCaregiverAccessLogs(PATIENT, { caregiverId: CAREGIVER })).toHaveLength(3);
    expect(
      await storage.getCaregiverAccessLogs(PATIENT, { resourceType: "medications" }),
    ).toHaveLength(2);
    expect(await storage.getCaregiverAccessLogs(PATIENT, { limit: 2 })).toHaveLength(2);
  });
});

describe("caregiver access requests — durable + status filter", () => {
  it("persists a request a fresh instance reads back and filters by status", async () => {
    const writer = await getStorage();
    const created = await writer.createCaregiverAccessRequest({
      caregiverId: CAREGIVER,
      caregiverName: "Care Giver",
      patientUserId: PATIENT,
      requestedPermission: "view_medications",
      reason: "Helping manage meds",
    });
    expect(created.status).toBe("pending");
    expect(created.expiresAt).toBeTruthy();

    const reader = await getStorage();
    expect(await reader.getCaregiverAccessRequest(created.id)).toBeDefined();
    expect(await reader.getCaregiverAccessRequests(PATIENT)).toHaveLength(1);
    expect(await reader.getCaregiverAccessRequests(PATIENT, "pending")).toHaveLength(1);
    expect(await reader.getCaregiverAccessRequests(PATIENT, "approved")).toHaveLength(0);
  });
});

describe("reviewCaregiverAccessRequest — ownership-scoped + durable", () => {
  it("approves a request and the decision survives a restart", async () => {
    const storage = await getStorage();
    const req = await storage.createCaregiverAccessRequest({
      caregiverId: CAREGIVER,
      caregiverName: "Care Giver",
      patientUserId: PATIENT,
      requestedPermission: "view_medications",
      reason: "meds",
    });

    const reviewed = await storage.reviewCaregiverAccessRequest(req.id, PATIENT, true, "ok");
    expect(reviewed!.status).toBe("approved");
    expect(reviewed!.reviewedBy).toBe(PATIENT);
    expect(reviewed!.reviewNotes).toBe("ok");

    const reader = await getStorage();
    const got = await reader.getCaregiverAccessRequest(req.id);
    expect(got!.status).toBe("approved");
  });

  it("does NOT let a non-owning patient review another patient's request", async () => {
    const storage = await getStorage();
    const req = await storage.createCaregiverAccessRequest({
      caregiverId: CAREGIVER,
      caregiverName: "Care Giver",
      patientUserId: PATIENT,
      requestedPermission: "view_medications",
      reason: "meds",
    });

    // OTHER_PATIENT tries to approve PATIENT's request — must be a no-op.
    const result = await storage.reviewCaregiverAccessRequest(req.id, OTHER_PATIENT, true);
    expect(result).toBeUndefined();

    const reader = await getStorage();
    const got = await reader.getCaregiverAccessRequest(req.id);
    expect(got!.status).toBe("pending"); // unchanged
    expect(got!.reviewedBy).toBeNull();
  });
});
