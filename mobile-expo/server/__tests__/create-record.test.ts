/**
 * Regression tests for POST /api/records (Task #94).
 *
 * Why this exists:
 *   Task #13 split the route into a must-succeed Phase 1 (storage.createHealthRecord)
 *   and a best-effort Phase 2 (awardPoints, incrementRecordsLogged, auditLog,
 *   clinicalAutomationEngine.processTrigger). That reliability win means a
 *   regression in awardPoints or the gamification schema would silently stop
 *   awarding points without any user-visible signal. These tests pin the
 *   gamification contract end-to-end against the real Postgres-backed
 *   `storage` singleton so a schema/columns drift, a missing `awardPoints`
 *   write, or a missing `incrementRecordsLogged` update would all fail CI:
 *
 *     1. Happy path: a successful POST /api/records persists a row in
 *        `point_transactions` (25 pts, reason=first_record_logged) AND bumps
 *        `user_gamification.records_logged` to 1 AND returns 201.
 *     2. Recurring path: when the user already has records, the next POST
 *        writes a `record_logged` row worth 15 pts in category `logging`.
 *     3. Resilience: when `awardPoints` throws, the route still returns 201
 *        with the saved record (no 500), the health_record is still
 *        persisted, and `incrementRecordsLogged` still runs (independent
 *        catch). Verified by inspecting the real DB rows.
 *
 * Wire-up: identical pattern to ai-policy.test.ts and auth-gcip.test.ts —
 * framework-agnostic, runs via `node --import tsx server/__tests__/create-record.test.ts`,
 * which is what `npm run test:server` does for every *.test.ts under here.
 *
 * The handler under test is imported from `server/routes/create-record-handler.ts`
 * — the same factory the production route in `server/routes/collab-2.ts` mounts.
 * No inline copy that could drift.
 *
 * Requires a reachable Postgres at $DATABASE_URL with the drizzle schema
 * already pushed (the dev DB created by Replit satisfies this; CI runs
 * `npm run db:push` before the suite).
 */

import express, { type Request } from "express";
import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { createCreateRecordHandler } from "../routes/create-record-handler";
import { storage } from "../storage";
import { db } from "../db";
import {
  users,
  healthRecords,
  pointTransactions,
  userGamification,
} from "../../shared/schema";

// ---------------------------------------------------------------------------
// HTTP harness — mounts the real handler with the real storage singleton.
// ---------------------------------------------------------------------------

async function withMountedHandler(
  userId: string,
  storageOverride: any,
  fn: (base: string) => Promise<void>,
): Promise<{ automationCalls: any[]; auditCalls: any[] }> {
  const app = express();
  app.use(express.json());

  const automationCalls: any[] = [];
  const auditCalls: any[] = [];

  const handler = createCreateRecordHandler({
    storage: storageOverride,
    clinicalAutomationEngine: {
      async processTrigger(event: any, recs: any[]) {
        automationCalls.push({ event, count: recs.length });
      },
    },
    auditLog: (_req, action, resourceType, resourceId, metadata) => {
      auditCalls.push({ action, resourceType, resourceId, metadata });
    },
    getUserId: (_req: Request) => userId,
  });

  app.post("/api/records", handler);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const port = (server.address() as any).port;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }

  return { automationCalls, auditCalls };
}

// ---------------------------------------------------------------------------
// DB test-data helpers
// ---------------------------------------------------------------------------

async function createTestUser(): Promise<string> {
  const tag = randomUUID();
  const [row] = await db
    .insert(users)
    .values({
      email: `task94-${tag}@test.local`,
      name: "Task94 Tester",
    })
    .returning({ id: users.id });
  return row.id;
}

async function deleteTestUser(userId: string): Promise<void> {
  // ON DELETE CASCADE on the FKs cleans up health_records, point_transactions
  // and user_gamification automatically.
  await db.delete(users).where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Assertion helpers (same shape as the other test files in this dir)
// ---------------------------------------------------------------------------

const failures: string[] = [];
function assert(cond: any, msg: string) {
  if (!cond) failures.push(msg);
}
function assertEq(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    failures.push(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testHappyPathAwardsPointsAndIncrementsCounter() {
  const userId = await createTestUser();
  try {
    let body: any = null;
    await withMountedHandler(userId, storage, async (base) => {
      const r = await fetch(`${base}/api/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "lab",
          title: "CBC",
          summary: "Within normal limits",
          date: "2026-01-15T00:00:00.000Z",
        }),
      });
      assertEq(r.status, 201, "successful create must return 201");
      body = await r.json();
      assert(body?.id, "201 response carries the saved record id");
      assertEq(body.userId, userId, "record is owned by the authenticated user");
      assertEq(body.isManual, true, "record is flagged isManual=true");
    });

    // Phase-1 invariant: exactly one health_record row for this user.
    const recRows = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId));
    assertEq(recRows.length, 1, "exactly one health_records row persisted in Postgres");
    assertEq(recRows[0].id, body.id, "persisted row id matches 201 response id");

    // Phase-2 invariants — the gamification contract Task #94 guards.
    const txns = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));
    assertEq(txns.length, 1, "awardPoints wrote exactly one point_transactions row");
    const txn = txns[0];
    assertEq(txn.userId, userId, "point_transactions.user_id matches caller");
    assertEq(txn.points, 25, "first record awards 25 points");
    assertEq(txn.reason, "first_record_logged", "reason is first_record_logged");
    assertEq(txn.category, "milestones", "category is milestones");
    assertEq(txn.relatedEntityType, "record", "related_entity_type is record");
    assertEq(txn.relatedEntityId, body.id, "related_entity_id is the new record id");

    const [gam] = await db
      .select()
      .from(userGamification)
      .where(eq(userGamification.userId, userId));
    assert(gam, "user_gamification row exists after first record");
    assertEq(gam!.recordsLogged, 1, "user_gamification.records_logged incremented to 1");
    assertEq(gam!.totalPoints, 25, "user_gamification.total_points includes the awarded 25");
  } finally {
    await deleteTestUser(userId);
  }
}

async function testSecondRecordTakesRecurringRecordLoggedBranch() {
  const userId = await createTestUser();
  try {
    // Seed an existing record so the route takes the non-first-record branch
    // (15 pts, category=logging, reason=record_logged).
    await storage.createHealthRecord({
      userId,
      type: "vital",
      title: "Pre-existing",
      date: new Date("2025-12-01T00:00:00.000Z"),
      isManual: false,
    } as any);

    let body: any = null;
    await withMountedHandler(userId, storage, async (base) => {
      const r = await fetch(`${base}/api/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "vital",
          title: "BP reading",
          date: "2026-01-20T00:00:00.000Z",
        }),
      });
      assertEq(r.status, 201, "second record still returns 201");
      body = await r.json();
    });

    const recRows = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId));
    assertEq(recRows.length, 2, "two health_records rows after a second create");

    const txns = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));
    assertEq(txns.length, 1, "exactly one point_transactions row from the route");
    const txn = txns[0];
    assertEq(txn.points, 15, "recurring record awards 15 points");
    assertEq(txn.reason, "record_logged", "reason is record_logged on recurring");
    assertEq(txn.category, "logging", "category is logging on recurring");
    assertEq(txn.relatedEntityId, body.id, "related_entity_id is the new record id");

    const [gam] = await db
      .select()
      .from(userGamification)
      .where(eq(userGamification.userId, userId));
    assertEq(gam!.recordsLogged, 1, "records_logged incremented exactly once for the route call");
    assertEq(gam!.totalPoints, 15, "total_points reflects the 15-pt award");
  } finally {
    await deleteTestUser(userId);
  }
}

async function testAwardPointsFailureStillReturns201() {
  const userId = await createTestUser();

  // Wrap the real storage and override only awardPoints to throw. Everything
  // else (createHealthRecord, getHealthRecords, incrementRecordsLogged) keeps
  // hitting Postgres exactly like production.
  const wrappedStorage = new Proxy(storage as any, {
    get(target, prop, receiver) {
      if (prop === "awardPoints") {
        return async () => {
          throw new Error("simulated awardPoints failure");
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  // Swallow the expected non-blocking warning so the test output stays clean.
  const realWarn = console.warn;
  const warns: any[] = [];
  console.warn = (...args: any[]) => {
    warns.push(args);
  };

  let status = 0;
  let body: any = null;
  try {
    await withMountedHandler(userId, wrappedStorage, async (base) => {
      const r = await fetch(`${base}/api/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "condition",
          title: "Hypertension",
          date: "2026-01-25T00:00:00.000Z",
        }),
      });
      status = r.status;
      body = await r.json();
    });
  } finally {
    console.warn = realWarn;
  }

  try {
    assertEq(status, 201, "awardPoints failure MUST NOT turn the route into a 500");
    assert(body?.id, "201 response still carries the saved record");

    // The health record is still persisted in Postgres even when awardPoints throws.
    const recRows = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId));
    assertEq(recRows.length, 1, "health_records row still persisted when awardPoints throws");

    // No points row written because awardPoints itself blew up.
    const txns = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));
    assertEq(txns.length, 0, "no point_transactions row when awardPoints threw");

    // incrementRecordsLogged is independently caught, so it must still have run
    // against the real DB.
    const [gam] = await db
      .select()
      .from(userGamification)
      .where(eq(userGamification.userId, userId));
    assert(gam, "user_gamification row created by incrementRecordsLogged");
    assertEq(
      gam!.recordsLogged,
      1,
      "records_logged still bumped to 1 even though awardPoints threw (independent catch)",
    );
    assertEq(gam!.totalPoints, 0, "total_points stayed at 0 because awardPoints never wrote");

    // The non-blocking warn was emitted (proving the swallow path was taken,
    // not a different code path that just skipped awardPoints entirely).
    assert(
      warns.some((args) =>
        String(args[0] ?? "").includes("[Records] awardPoints failed (non-blocking):"),
      ),
      "awardPoints failure logs a non-blocking warning",
    );
  } finally {
    await deleteTestUser(userId);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS: Array<[string, () => Promise<void>]> = [
  [
    "POST /api/records: 201 + point_transactions row + records_logged++ (happy path, real DB)",
    testHappyPathAwardsPointsAndIncrementsCounter,
  ],
  [
    "POST /api/records: recurring record takes record_logged branch (15 pts, real DB)",
    testSecondRecordTakesRecurringRecordLoggedBranch,
  ],
  [
    "POST /api/records: awardPoints throws → still 201, record persisted, counter still bumped (real DB)",
    testAwardPointsFailureStillReturns201,
  ],
];

export async function run(): Promise<{ pass: number; fail: number }> {
  let pass = 0;
  let fail = 0;
  for (const [name, fn] of TESTS) {
    const before = failures.length;
    try {
      await fn();
      const added = failures.slice(before);
      if (added.length === 0) {
        console.log(`  ok    ${name}`);
        pass += 1;
      } else {
        console.log(`  FAIL  ${name}`);
        for (const m of added) console.log(`         - ${m}`);
        fail += 1;
      }
    } catch (e: any) {
      console.log(`  FAIL  ${name} — threw: ${e?.message ?? e}`);
      if (e?.stack) console.log(e.stack);
      fail += 1;
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => {
      if (fail > 0) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
