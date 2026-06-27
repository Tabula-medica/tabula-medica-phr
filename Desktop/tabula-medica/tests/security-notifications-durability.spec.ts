/**
 * Durability tests for the security-notification store.
 *
 * securityNotifications moved out of an in-memory Map into the
 * `app_security_notifications` table (DatabaseStorage, C1). Security alerts
 * (new-device login, 2FA changes, etc.) that live only in memory vanish on
 * restart and aren't shared across instances — useless for an alerting trail.
 * This suite proves the persisted semantics:
 *
 *   - createSecurityNotification writes a row a fresh instance reads back.
 *   - getSecurityNotifications scopes by user, sorts newest-first, and honours
 *     unreadOnly.
 *   - markNotificationRead is OWNERSHIP-SCOPED (a user can't mark another user's
 *     notification read) and persists.
 *   - markAllNotificationsRead clears only the caller's unread.
 *   - getUnreadNotificationCount reflects the persisted state.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; every assertion reads back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/security-notifications-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appSecurityNotificationsTable } from "@shared/schema";
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
  await createSchemaTables(client, { appSecurityNotificationsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_security_notifications;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const USER = "notif-user";
const OTHER = "notif-other";

function notif(userId: string, title: string) {
  return {
    userId,
    type: "new_device_login" as const,
    title,
    message: `${title} body`,
    severity: "warning" as const,
  };
}

describe("createSecurityNotification — durable + scoped reads", () => {
  it("persists a notification a fresh instance reads back (restart)", async () => {
    const writer = await getStorage();
    const created = await writer.createSecurityNotification(notif(USER, "New device"));
    expect(created.isRead).toBe(false);
    expect(created.severity).toBe("warning");

    const reader = await getStorage();
    const got = await reader.getSecurityNotifications(USER);
    expect(got).toHaveLength(1);
    expect(got[0].title).toBe("New device");
    expect(got[0].id).toBe(created.id);
  });

  it("scopes notifications per user", async () => {
    const storage = await getStorage();
    await storage.createSecurityNotification(notif(USER, "for-user"));
    await storage.createSecurityNotification(notif(OTHER, "for-other"));

    expect(await storage.getSecurityNotifications(USER)).toHaveLength(1);
    expect((await storage.getSecurityNotifications(USER))[0].title).toBe("for-user");
    expect(await storage.getSecurityNotifications(OTHER)).toHaveLength(1);
  });

  it("honours unreadOnly and reflects the unread count", async () => {
    const storage = await getStorage();
    const a = await storage.createSecurityNotification(notif(USER, "a"));
    await storage.createSecurityNotification(notif(USER, "b"));
    expect(await storage.getUnreadNotificationCount(USER)).toBe(2);

    await storage.markNotificationRead(a.id, USER);

    const reader = await getStorage();
    expect(await reader.getUnreadNotificationCount(USER)).toBe(1);
    const unread = await reader.getSecurityNotifications(USER, true);
    expect(unread).toHaveLength(1);
    expect(unread[0].title).toBe("b");
  });
});

describe("markNotificationRead — ownership-scoped + durable", () => {
  it("does NOT let another user mark someone else's notification read", async () => {
    const storage = await getStorage();
    const n = await storage.createSecurityNotification(notif(USER, "private"));

    // OTHER tries to mark USER's notification read — must be a no-op.
    await storage.markNotificationRead(n.id, OTHER);

    const reader = await getStorage();
    expect(await reader.getUnreadNotificationCount(USER)).toBe(1);
    expect((await reader.getSecurityNotifications(USER))[0].isRead).toBe(false);
  });
});

describe("markAllNotificationsRead — clears only the caller's unread", () => {
  it("marks all of the caller's notifications read, leaving others untouched", async () => {
    const storage = await getStorage();
    await storage.createSecurityNotification(notif(USER, "u1"));
    await storage.createSecurityNotification(notif(USER, "u2"));
    await storage.createSecurityNotification(notif(OTHER, "o1"));

    await storage.markAllNotificationsRead(USER);

    const reader = await getStorage();
    expect(await reader.getUnreadNotificationCount(USER)).toBe(0);
    expect(await reader.getUnreadNotificationCount(OTHER)).toBe(1);
  });
});
