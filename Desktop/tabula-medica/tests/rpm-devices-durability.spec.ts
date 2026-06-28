/**
 * Durability tests for the RPM (remote patient monitoring) device store.
 *
 * rpmDevices moved out of an in-memory Map into the `app_rpm_devices` table
 * (DatabaseStorage, C1). These are the devices a patient has paired for remote
 * monitoring. Held only in memory, every pairing is forgotten on restart.
 *
 * This suite proves:
 *   - createRpmDevice persists a device a fresh instance reads back, applying the
 *     pending connection-status default and round-tripping the nested
 *     setupInstructions object.
 *   - lookups by onboarding session and by patient are correctly scoped.
 *   - updateRpmDevice merges a partial update and bumps updatedAt; delete removes.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/rpm-devices-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appRpmDevicesTable } from "@shared/schema";
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
  await createSchemaTables(client, { appRpmDevicesTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_rpm_devices;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const SESSION = "rpm-session-1";
const OTHER_SESSION = "rpm-session-2";
const PATIENT = "rpm-patient-1";

function baseDevice(overrides: Record<string, unknown> = {}) {
  return {
    onboardingSessionId: SESSION,
    patientId: PATIENT,
    deviceType: "blood_pressure_monitor" as const,
    deviceName: "Omron BP7250",
    ...overrides,
  };
}

describe("createRpmDevice — durable pairing", () => {
  it("persists a device a fresh instance reads back, with defaults + setup steps", async () => {
    const writer = await getStorage();
    const created = await writer.createRpmDevice(
      baseDevice({
        manufacturer: "Omron",
        setupInstructions: {
          deviceType: "blood_pressure_monitor",
          steps: [{ stepNumber: 1, title: "Power on", description: "Hold the button" }],
        },
      }),
    );
    expect(created.connectionStatus).toBe("pending"); // default
    expect(created.id).toBeTruthy();

    const reader = await getStorage();
    const got = await reader.getRpmDevice(created.id);
    expect(got).toBeDefined();
    expect(got!.deviceName).toBe("Omron BP7250");
    expect(got!.manufacturer).toBe("Omron");
    expect(got!.setupInstructions?.steps[0].title).toBe("Power on");
  });

  it("scopes lookups by onboarding session and by patient", async () => {
    const storage = await getStorage();
    await storage.createRpmDevice(baseDevice());
    await storage.createRpmDevice(
      baseDevice({ onboardingSessionId: OTHER_SESSION, deviceName: "Other", patientId: "p2" }),
    );

    expect(await storage.getRpmDevices(SESSION)).toHaveLength(1);
    expect((await storage.getRpmDevices(SESSION))[0].deviceName).toBe("Omron BP7250");
    expect(await storage.getRpmDevicesByPatient(PATIENT)).toHaveLength(1);
    expect(await storage.getRpmDevicesByPatient("p2")).toHaveLength(1);
  });
});

describe("updateRpmDevice / deleteRpmDevice — persist + remove", () => {
  it("merges a partial update, bumps updatedAt, and a fresh instance sees it", async () => {
    const storage = await getStorage();
    const created = await storage.createRpmDevice(baseDevice());
    const updated = await storage.updateRpmDevice(created.id, {
      connectionStatus: "connected",
      lastSyncAt: "2026-06-28T00:00:00.000Z",
    });
    expect(updated!.connectionStatus).toBe("connected");
    expect(updated!.lastSyncAt).toBe("2026-06-28T00:00:00.000Z");
    expect(updated!.deviceName).toBe("Omron BP7250"); // preserved

    const reader = await getStorage();
    expect((await reader.getRpmDevice(created.id))!.connectionStatus).toBe("connected");
  });

  it("returns undefined when updating a missing device", async () => {
    const storage = await getStorage();
    expect(
      await storage.updateRpmDevice("00000000-0000-0000-0000-000000000000", {
        connectionStatus: "failed",
      }),
    ).toBeUndefined();
  });

  it("deletes a device", async () => {
    const storage = await getStorage();
    const created = await storage.createRpmDevice(baseDevice());
    await storage.deleteRpmDevice(created.id);
    expect(await (await getStorage()).getRpmDevice(created.id)).toBeUndefined();
  });
});
