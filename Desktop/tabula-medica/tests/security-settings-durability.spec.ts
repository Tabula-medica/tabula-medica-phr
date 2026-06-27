/**
 * Durability tests for the per-user security-settings store.
 *
 * securitySettings moved out of an in-memory Map into the
 * `app_security_settings` table (DatabaseStorage, C1). Alert preferences that
 * live only in memory reset to defaults on every restart — a silent change of a
 * user's security posture. This suite proves the persisted upsert semantics:
 *
 *   - createOrUpdateSecuritySettings inserts a row a fresh instance reads back,
 *     applying defaults for unspecified flags.
 *   - a second call UPDATES the same row (no duplicate; one row per user) and
 *     only changes the supplied flags.
 *   - settings are scoped per user.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/security-settings-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appSecuritySettingsTable } from "@shared/schema";
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
  await createSchemaTables(client, { appSecuritySettingsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_security_settings;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rowCount(userId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_security_settings WHERE user_id = $1",
    [userId],
  );
  return Number(res.rows[0].count);
}

const USER = "settings-user";
const OTHER = "settings-other";

describe("createOrUpdateSecuritySettings — insert with defaults", () => {
  it("creates a row with defaults a fresh instance reads back (restart)", async () => {
    const writer = await getStorage();
    const created = await writer.createOrUpdateSecuritySettings(USER, {
      sessionActivityAlerts: true,
    });
    // unspecified flags take defaults; the one supplied flag is applied.
    expect(created.loginNotifications).toBe(true);
    expect(created.newDeviceAlerts).toBe(true);
    expect(created.sessionActivityAlerts).toBe(true);
    expect(created.emailNotifications).toBe(true);

    const reader = await getStorage();
    const got = await reader.getSecuritySettings(USER);
    expect(got).toBeDefined();
    expect(got!.sessionActivityAlerts).toBe(true);
    expect(got!.id).toBe(created.id);
    expect(await rowCount(USER)).toBe(1);
  });

  it("returns undefined for a user with no settings", async () => {
    const storage = await getStorage();
    expect(await storage.getSecuritySettings("nobody")).toBeUndefined();
  });
});

describe("createOrUpdateSecuritySettings — update keeps a single row", () => {
  it("updates the existing row rather than inserting a duplicate", async () => {
    const storage = await getStorage();
    const first = await storage.createOrUpdateSecuritySettings(USER, {
      loginNotifications: true,
    });
    const second = await storage.createOrUpdateSecuritySettings(USER, {
      loginNotifications: false,
      emailNotifications: false,
    });

    // same row id, one row total.
    expect(second.id).toBe(first.id);
    expect(await rowCount(USER)).toBe(1);

    const reader = await getStorage();
    const got = await reader.getSecuritySettings(USER);
    expect(got!.loginNotifications).toBe(false); // changed
    expect(got!.emailNotifications).toBe(false); // changed
    expect(got!.newDeviceAlerts).toBe(true); // untouched default
  });
});

describe("createOrUpdateSecuritySettings — scoped per user", () => {
  it("keeps each user's settings independent", async () => {
    const storage = await getStorage();
    await storage.createOrUpdateSecuritySettings(USER, { newDeviceAlerts: false });
    await storage.createOrUpdateSecuritySettings(OTHER, { newDeviceAlerts: true });

    expect((await storage.getSecuritySettings(USER))!.newDeviceAlerts).toBe(false);
    expect((await storage.getSecuritySettings(OTHER))!.newDeviceAlerts).toBe(true);
    expect(await rowCount(USER)).toBe(1);
    expect(await rowCount(OTHER)).toBe(1);
  });
});
