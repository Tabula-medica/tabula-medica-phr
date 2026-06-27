/**
 * Durability + at-rest-encryption tests for the two-factor-auth (MFA) store.
 *
 * twoFactorAuths moved out of an in-memory Map into the `app_two_factor_auths`
 * table (DatabaseStorage, C1). MFA seeds are auth secrets, so this suite proves
 * two things the Map never gave us:
 *
 *   1. DURABILITY — a TOTP enrollment made via createTwoFactorAuth outlives the
 *      process: a brand-new DatabaseStorage instance (a cold restart) reads the
 *      same secret/backup codes back FROM the DB, and update/delete persist.
 *
 *   2. ENCRYPTION AT REST — the TOTP `secret` and every `backupCodes` entry are
 *      AES-256-GCM encrypted in the row (a raw SQL read sees ciphertext, never
 *      the plaintext seed), while the storage API still returns plaintext to the
 *      caller. A leaked DB dump must not hand an attacker working MFA seeds.
 *
 * server/db is mocked with an in-process Postgres (PGlite) built from the
 * canonical Drizzle table, and every assertion reads back through a fresh
 * DatabaseStorage (no in-process cache).
 *
 * Run:
 *   npx vitest run tests/two-factor-auth-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appTwoFactorAuthsTable } from "@shared/schema";
import { createSchemaTables } from "./helpers/pglite-schema";

const ref = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../server/db", () => ({
  get db() {
    return ref.db;
  },
}));

let client: PGlite;

beforeAll(async () => {
  // Deterministic key so encrypt/decrypt round-trips the same across instances.
  process.env.PHI_ENCRYPTION_KEY = "a".repeat(64);
  process.env.PHI_ENCRYPTION_SALT = "b".repeat(64);
  client = new PGlite();
  ref.db = drizzle(client);
  await createSchemaTables(client, { appTwoFactorAuthsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_two_factor_auths;");
});

// A fresh DatabaseStorage models a cold process: no in-memory 2FA state, so
// anything it returns came from the persisted table.
async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

async function rawRow(userId: string) {
  const res = await client.query<{
    secret: string;
    backup_codes: string[];
    enabled: boolean;
  }>(
    "SELECT secret, backup_codes, enabled FROM app_two_factor_auths WHERE user_id = $1",
    [userId],
  );
  return res.rows[0];
}

async function rowCount(userId: string): Promise<number> {
  const res = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM app_two_factor_auths WHERE user_id = $1",
    [userId],
  );
  return Number(res.rows[0].count);
}

const USER = "2fa-user";
const SECRET = "JBSWY3DPEHPK3PXP"; // sample base32 TOTP seed

describe("createTwoFactorAuth — durable + encrypted at rest", () => {
  it("persists an enrollment a fresh instance reads back (restart)", async () => {
    const writer = await getStorage();
    const created = await writer.createTwoFactorAuth({ userId: USER, secret: SECRET });

    // Caller sees plaintext seed + 10 backup codes.
    expect(created.secret).toBe(SECRET);
    expect(created.backupCodes).toHaveLength(10);
    expect(created.enabled).toBe(false);

    const reader = await getStorage();
    const got = await reader.getTwoFactorAuth(USER);
    expect(got).toBeDefined();
    expect(got!.secret).toBe(SECRET); // decrypted on read
    expect(got!.backupCodes).toEqual(created.backupCodes);
    expect(await rowCount(USER)).toBe(1);
  });

  it("stores the secret and backup codes ENCRYPTED in the row (not plaintext)", async () => {
    const writer = await getStorage();
    const created = await writer.createTwoFactorAuth({ userId: USER, secret: SECRET });

    const row = await rawRow(USER);
    // Ciphertext is the iv:tag:data form — never the plaintext seed.
    expect(row.secret).not.toBe(SECRET);
    expect(row.secret).toContain(":");
    expect(row.secret.split(":")).toHaveLength(3);
    // Every backup code is encrypted too.
    for (let i = 0; i < row.backup_codes.length; i++) {
      expect(row.backup_codes[i]).not.toBe(created.backupCodes[i]);
      expect(row.backup_codes[i].split(":")).toHaveLength(3);
    }
  });
});

describe("updateTwoFactorAuth — persists changes, keeps encryption", () => {
  it("enables MFA and the change survives a restart", async () => {
    const writer = await getStorage();
    await writer.createTwoFactorAuth({ userId: USER, secret: SECRET });

    const verifiedAt = "2026-06-27T00:00:00.000Z";
    const updated = await writer.updateTwoFactorAuth(USER, { enabled: true, verifiedAt });
    expect(updated!.enabled).toBe(true);
    expect(updated!.verifiedAt).toBe(verifiedAt);

    const reader = await getStorage();
    const got = await reader.getTwoFactorAuth(USER);
    expect(got!.enabled).toBe(true);
    expect(got!.verifiedAt).toBe(verifiedAt);
    // Secret still decrypts correctly and is still encrypted at rest.
    expect(got!.secret).toBe(SECRET);
    expect((await rawRow(USER)).secret).not.toBe(SECRET);
  });

  it("returns undefined when updating a user with no enrollment", async () => {
    const storage = await getStorage();
    expect(await storage.updateTwoFactorAuth("nobody", { enabled: true })).toBeUndefined();
  });
});

describe("deleteTwoFactorAuth — removes the row", () => {
  it("deletes the enrollment so a fresh instance sees none", async () => {
    const storage = await getStorage();
    await storage.createTwoFactorAuth({ userId: USER, secret: SECRET });
    expect(await rowCount(USER)).toBe(1);

    await storage.deleteTwoFactorAuth(USER);

    const reader = await getStorage();
    expect(await reader.getTwoFactorAuth(USER)).toBeUndefined();
    expect(await rowCount(USER)).toBe(0);
  });

  it("is scoped to the user — does not touch another user's enrollment", async () => {
    const storage = await getStorage();
    await storage.createTwoFactorAuth({ userId: USER, secret: SECRET });
    await storage.createTwoFactorAuth({ userId: "other-user", secret: "OTHERSEED2222222" });

    await storage.deleteTwoFactorAuth(USER);

    expect(await rowCount(USER)).toBe(0);
    expect(await rowCount("other-user")).toBe(1);
    const other = await (await getStorage()).getTwoFactorAuth("other-user");
    expect(other!.secret).toBe("OTHERSEED2222222");
  });
});
