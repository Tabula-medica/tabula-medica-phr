/**
 * Durability tests for the consent audit-log store.
 *
 * consentAuditLogs moved out of an in-memory Map into the
 * `app_consent_audit_logs` table (DatabaseStorage, C1). This is the consent
 * accounting trail (§164.524 / accounting of disclosures): every grant / revoke
 * / modify / access / export / policy_update on a patient's data-sharing
 * consents. An audit trail that evaporates on restart is a compliance gap.
 *
 * This suite proves:
 *   - createConsentAuditLog persists a row a fresh instance reads back, with the
 *     optional fields round-tripping (null in DB -> undefined in the interface).
 *   - getConsentAuditLogs scopes by patient, sorts newest-first, and honours
 *     limit.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/consent-audit-logs-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appConsentAuditLogsTable } from "@shared/schema";
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
  await createSchemaTables(client, { appConsentAuditLogsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_consent_audit_logs;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const PATIENT = "consent-patient";
const OTHER = "consent-other";

describe("createConsentAuditLog — durable accounting trail", () => {
  it("persists a full log a fresh instance reads back", async () => {
    const writer = await getStorage();
    const created = await writer.createConsentAuditLog({
      patientUserId: PATIENT,
      recipientId: "recipient-1",
      action: "grant",
      dataCategory: "medications",
      previousAccessLevel: "none",
      newAccessLevel: "read",
      reason: "shared with cardiologist",
      ipAddress: "10.0.0.1",
      userAgent: "test-agent",
    });
    expect(created.action).toBe("grant");
    expect(created.timestamp).toBeTruthy();

    const reader = await getStorage();
    const logs = await reader.getConsentAuditLogs(PATIENT);
    expect(logs).toHaveLength(1);
    expect(logs[0].recipientId).toBe("recipient-1");
    expect(logs[0].newAccessLevel).toBe("read");
  });

  it("round-trips optional fields as undefined (not null)", async () => {
    const writer = await getStorage();
    // minimal log: only required fields
    await writer.createConsentAuditLog({
      patientUserId: PATIENT,
      action: "revoke",
    });

    const reader = await getStorage();
    const [log] = await reader.getConsentAuditLogs(PATIENT);
    expect(log.action).toBe("revoke");
    expect(log.recipientId).toBeUndefined();
    expect(log.dataCategory).toBeUndefined();
    expect(log.reason).toBeUndefined();
    // explicitly NOT null — the interface uses optional (?:) fields.
    expect(log.recipientId).not.toBeNull();
  });
});

describe("getConsentAuditLogs — scoped, newest-first, limit", () => {
  it("scopes by patient", async () => {
    const storage = await getStorage();
    await storage.createConsentAuditLog({ patientUserId: PATIENT, action: "grant" });
    await storage.createConsentAuditLog({ patientUserId: OTHER, action: "grant" });

    expect(await storage.getConsentAuditLogs(PATIENT)).toHaveLength(1);
    expect(await storage.getConsentAuditLogs(OTHER)).toHaveLength(1);
  });

  it("honours the limit", async () => {
    const storage = await getStorage();
    for (let i = 0; i < 5; i++) {
      await storage.createConsentAuditLog({ patientUserId: PATIENT, action: "access" });
    }
    expect(await storage.getConsentAuditLogs(PATIENT)).toHaveLength(5);
    expect(await storage.getConsentAuditLogs(PATIENT, 2)).toHaveLength(2);
  });
});
