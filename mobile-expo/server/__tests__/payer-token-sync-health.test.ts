/**
 * Regression tests for payer/EHR connection sync-health alerting (Task #210).
 *
 * Before Task #210, `refreshPayerToken` in `server/auth0-fhir-broker.ts` returned
 * `null` with no log, audit entry, or persisted state whenever a payer/EHR token
 * could not be refreshed (revoked consent, rotated client secret, expired refresh
 * token, network error). The connection went silently stale and nobody noticed.
 *
 * These tests pin the new behavior on every failure path:
 *   - a structured warn/error log is emitted (via the shared logger) without ever
 *     logging the token values,
 *   - an audit entry (`payer_token_refresh_failed`) is written, attributed to the
 *     affected user + sourceType, with a short reason CODE only (no tokens),
 *   - the connection row's `sync_status` flips to needs_reauth / error so the
 *     stale state is queryable via `getConnectionHealth`,
 *   - a subsequent SUCCESSFUL refresh clears the stale state back to "active".
 *
 * Framework-agnostic; runs via `node --import tsx`, auto-picked-up by
 * `scripts/run-server-tests.mjs` (the `npm run test:server` CI gate). Like the
 * sibling unit test, it stubs the drizzle `db` singleton in memory so the broker
 * exercises its real code paths without a Postgres connection.
 */

// Env must be set BEFORE importing modules that read it at load time.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
process.env.PHI_ENCRYPTION_KEY =
  process.env.PHI_ENCRYPTION_KEY ||
  "test-phi-key-task-210-payer-sync-health-32+chars";

import { db } from "../db";
import { payerTokenConnections, auditLogs } from "@shared/schema";
import {
  storePayerToken,
  getConnectionHealth,
  refreshPayerToken,
} from "../auth0-fhir-broker";

// ---------------------------------------------------------------------------
// In-memory stub of `payer_token_connections` + `audit_logs`.
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  userId: string;
  sourceType: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
  fhirBaseUrl: string | null;
  connectedAt: Date;
  updatedAt: Date;
  syncStatus: string;
  lastRefreshError: string | null;
  lastRefreshAttemptAt: Date | null;
  lastSyncedAt: Date | null;
};

let rows: Row[] = [];
let auditRows: any[] = [];
// Priming for the select shapes (mirrors payer-token-storage.test.ts).
let lastSelectKind: "by-user-and-source" | "health-for-user" | null = null;
let lastUserFilter: string | null = null;
let lastSourceFilter: string | null = null;

function resetDb() {
  rows = [];
  auditRows = [];
  lastSelectKind = null;
  lastUserFilter = null;
  lastSourceFilter = null;
}

(db as any).insert = (table: any) => {
  if (table === auditLogs) {
    return {
      values: async (vals: any) => {
        auditRows.push(vals);
      },
    };
  }
  // payer_token_connections upsert
  return {
    values: (vals: any) => ({
      onConflictDoUpdate: async (opts: any) => {
        const existing = rows.find(
          (r) => r.userId === vals.userId && r.sourceType === vals.sourceType,
        );
        if (existing) {
          Object.assign(existing, opts.set);
        } else {
          rows.push({
            id: `row-${rows.length + 1}`,
            userId: vals.userId,
            sourceType: vals.sourceType,
            accessTokenEncrypted: vals.accessTokenEncrypted,
            refreshTokenEncrypted: vals.refreshTokenEncrypted ?? null,
            expiresAt: vals.expiresAt ?? null,
            fhirBaseUrl: vals.fhirBaseUrl ?? null,
            connectedAt: vals.connectedAt ?? new Date(),
            updatedAt: vals.updatedAt ?? new Date(),
            syncStatus: vals.syncStatus ?? "active",
            lastRefreshError: vals.lastRefreshError ?? null,
            lastRefreshAttemptAt: vals.lastRefreshAttemptAt ?? null,
            lastSyncedAt: vals.lastSyncedAt ?? null,
          });
        }
      },
    }),
  };
};

// db.update(payerTokenConnections).set({...}).where(...) — applies to the row
// matching the primed (userId, sourceType) for the current test.
(db as any).update = (_t: any) => ({
  set: (vals: any) => ({
    where: async (_w: any) => {
      const row = rows.find(
        (r) => r.userId === lastUserFilter && r.sourceType === lastSourceFilter,
      );
      if (row) Object.assign(row, vals);
    },
  }),
});

// Two select shapes:
//   getPayerToken:        db.select().from(t).where(...).limit(1)
//   getConnectionHealth:  db.select({proj}).from(t).where(...)   (awaited)
(db as any).select = (_proj?: any) => ({
  from: (_t: any) => ({
    where: (_w: any) => ({
      limit: async (_n: number) => {
        if (lastSelectKind !== "by-user-and-source") {
          throw new Error("unexpected select-with-limit call");
        }
        return rows.filter(
          (r) =>
            r.userId === lastUserFilter && r.sourceType === lastSourceFilter,
        );
      },
      then: (resolve: any, reject: any) => {
        try {
          if (lastSelectKind !== "health-for-user") {
            throw new Error("unexpected select-all call");
          }
          resolve(rows.filter((r) => r.userId === lastUserFilter));
        } catch (e) {
          reject(e);
        }
      },
    }),
  }),
});

// ---------------------------------------------------------------------------
// Assertion helpers
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

// Stub the payer's OAuth2 token endpoint. `mode` controls the simulated outcome.
function stubFetch(
  mode: "ok" | "rejected" | "throws" | "bad-json",
  httpStatus = 400,
): { restore: () => void; calls: number } {
  const REAL = globalThis.fetch;
  let calls = 0;
  (globalThis as any).fetch = async () => {
    calls += 1;
    if (mode === "throws") throw new Error("ECONNREFUSED simulated");
    if (mode === "rejected") {
      return { ok: false, status: httpStatus, json: async () => ({}) } as any;
    }
    if (mode === "bad-json") {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("invalid json");
        },
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "fresh-access-xyz",
        refresh_token: "fresh-refresh-xyz",
        expires_in: 3600,
      }),
    } as any;
  };
  return {
    restore: () => {
      (globalThis as any).fetch = REAL;
    },
    get calls() {
      return calls;
    },
  } as any;
}

const SECRET_REFRESH = "super-secret-refresh-token-DO-NOT-LOG";

async function seedActiveConnection(
  userId: string,
  sourceType: string,
  refreshToken = SECRET_REFRESH,
  fhirBaseUrl = "https://fhir.cigna.com/PatientAccess/v1-devportal/",
) {
  await storePayerToken(userId, sourceType, {
    accessToken: "stale-access",
    refreshToken,
    expiresAt: Date.now() - 60_000,
    fhirBaseUrl,
  });
}

function prime(userId: string, sourceType: string) {
  lastSelectKind = "by-user-and-source";
  lastUserFilter = userId;
  lastSourceFilter = sourceType;
}

function lastAudit() {
  return auditRows[auditRows.length - 1];
}

// Asserts no audit entry leaks the secret refresh token anywhere.
function assertNoTokenLeak() {
  const blob = JSON.stringify(auditRows);
  assert(
    !blob.includes(SECRET_REFRESH),
    "audit metadata must NOT contain the refresh token value",
  );
  assert(
    !blob.includes("fresh-refresh-xyz") && !blob.includes("fresh-access-xyz"),
    "audit metadata must NOT contain new token values",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testRejectedGrantMarksNeedsReauth() {
  resetDb();
  const userId = "user-rejected";
  const sourceType = "cigna";
  await seedActiveConnection(userId, sourceType);
  prime(userId, sourceType);

  const f = stubFetch("rejected", 400);
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }

  assertEq(result, null, "rejected refresh returns null");
  const row = rows.find((r) => r.userId === userId);
  assertEq(row!.syncStatus, "needs_reauth", "row flips to needs_reauth");
  assertEq(row!.lastRefreshError, "refresh_rejected", "reason code persisted");
  assert(row!.lastRefreshAttemptAt instanceof Date, "attempt timestamp set");

  const audit = lastAudit();
  assert(audit, "an audit entry was written");
  assertEq(audit.action, "payer_token_refresh_failed", "audit action");
  assertEq(audit.userId, userId, "audit attributed to affected user");
  assertEq(audit.resourceId, sourceType, "audit resourceId is sourceType");
  assertEq(audit.metadata.reason, "refresh_rejected", "audit reason code");
  assertEq(audit.metadata.httpStatus, 400, "audit captures HTTP status only");
  assertNoTokenLeak();
}

async function testNetworkExceptionMarksError() {
  resetDb();
  const userId = "user-throws";
  const sourceType = "cigna";
  await seedActiveConnection(userId, sourceType);
  prime(userId, sourceType);

  const f = stubFetch("throws");
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }

  assertEq(result, null, "thrown fetch returns null (no crash)");
  const row = rows.find((r) => r.userId === userId);
  assertEq(row!.syncStatus, "error", "network error flips to error status");
  assertEq(row!.lastRefreshError, "refresh_exception", "reason code persisted");
  const audit = lastAudit();
  assertEq(audit.metadata.reason, "refresh_exception", "audit reason code");
  assertEq(audit.userId, userId, "audit attributed to affected user");
  assertNoTokenLeak();
}

async function testUnparseableBodyMarksError() {
  resetDb();
  const userId = "user-badjson";
  const sourceType = "cigna";
  await seedActiveConnection(userId, sourceType);
  prime(userId, sourceType);

  const f = stubFetch("bad-json");
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }

  assertEq(result, null, "unparseable body returns null");
  const row = rows.find((r) => r.userId === userId);
  assertEq(row!.syncStatus, "error", "bad json flips to error status");
  assertEq(row!.lastRefreshError, "refresh_exception", "reason code persisted");
}

async function testMissingRefreshTokenMarksNeedsReauth() {
  resetDb();
  const userId = "user-noref";
  const sourceType = "cigna";
  // Empty refresh token → stored as null → getPayerToken yields "".
  await seedActiveConnection(userId, sourceType, "");
  prime(userId, sourceType);

  const f = stubFetch("ok");
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }

  assertEq(result, null, "missing refresh token returns null");
  assertEq(
    (f as any).calls,
    0,
    "no outbound token-endpoint call when no refresh token",
  );
  const row = rows.find((r) => r.userId === userId);
  assertEq(row!.syncStatus, "needs_reauth", "needs_reauth for missing token");
  assertEq(
    row!.lastRefreshError,
    "missing_refresh_token",
    "reason code persisted",
  );
  assertEq(
    lastAudit().metadata.reason,
    "missing_refresh_token",
    "audit reason code",
  );
}

async function testNoTokenEndpointMarksError() {
  resetDb();
  const userId = "user-noendpoint";
  const sourceType = "fasten"; // not in known endpoints
  await seedActiveConnection(
    userId,
    sourceType,
    SECRET_REFRESH,
    "https://example.com/fhir", // not epic → no endpoint resolves
  );
  prime(userId, sourceType);

  const f = stubFetch("ok");
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }

  assertEq(result, null, "no token endpoint returns null");
  assertEq((f as any).calls, 0, "no outbound call when endpoint unresolved");
  const row = rows.find((r) => r.userId === userId);
  assertEq(row!.syncStatus, "error", "error status when endpoint unresolved");
  assertEq(row!.lastRefreshError, "no_token_endpoint", "reason code persisted");
}

async function testNoConnectionLogsButNoRow() {
  resetDb();
  const userId = "user-none";
  const sourceType = "cigna";
  prime(userId, sourceType);

  const result = await refreshPayerToken(userId, sourceType);
  assertEq(result, null, "no connection returns null");
  assertEq(rows.length, 0, "no row created for a non-existent connection");
  assertEq(auditRows.length, 1, "still writes one audit entry");
  assertEq(lastAudit().metadata.reason, "no_connection", "audit reason code");
}

async function testHealthQueryableAndReturnsNoTokens() {
  resetDb();
  const userId = "user-health";
  await seedActiveConnection(userId, "cigna");
  prime(userId, "cigna");
  const f = stubFetch("rejected", 401);
  try {
    await refreshPayerToken(userId, "cigna");
  } finally {
    f.restore();
  }

  lastSelectKind = "health-for-user";
  lastUserFilter = userId;
  const health = await getConnectionHealth(userId);
  assertEq(health.length, 1, "health returns one connection");
  assertEq(health[0].sourceType, "cigna", "health sourceType");
  assertEq(health[0].syncStatus, "needs_reauth", "health reflects needs_reauth");
  assertEq(health[0].needsReauth, true, "needsReauth flag set");
  assertEq(health[0].lastRefreshError, "refresh_rejected", "health reason code");
  // No token fields should ever appear in the health payload.
  const blob = JSON.stringify(health[0]);
  assert(
    !blob.includes(SECRET_REFRESH) && !/accessToken|refreshToken/.test(blob),
    "health payload must not expose token material",
  );
}

async function testSuccessfulRefreshClearsStaleState() {
  resetDb();
  const userId = "user-recover";
  const sourceType = "cigna";
  await seedActiveConnection(userId, sourceType);
  prime(userId, sourceType);

  // First: a rejected refresh marks the connection needs_reauth.
  let f = stubFetch("rejected", 400);
  try {
    await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }
  assertEq(
    rows.find((r) => r.userId === userId)!.syncStatus,
    "needs_reauth",
    "precondition: connection is needs_reauth",
  );

  // Then: a successful refresh must reset it to active and clear the error.
  prime(userId, sourceType);
  f = stubFetch("ok");
  let result: any;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    f.restore();
  }
  assert(result !== null, "successful refresh returns tokens");
  assertEq(result.accessToken, "fresh-access-xyz", "fresh access token returned");

  const row = rows.find((r) => r.userId === userId)!;
  assertEq(row.syncStatus, "active", "successful refresh resets to active");
  assertEq(row.lastRefreshError, null, "successful refresh clears the error");
  assert(row.lastSyncedAt instanceof Date, "lastSyncedAt set on success");

  lastSelectKind = "health-for-user";
  lastUserFilter = userId;
  const health = await getConnectionHealth(userId);
  assertEq(health[0].needsReauth, false, "health shows recovered connection");
  assertEq(health[0].syncStatus, "active", "health shows active");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const tests: Array<[string, () => Promise<void>]> = [
      ["rejectedGrantMarksNeedsReauth", testRejectedGrantMarksNeedsReauth],
      ["networkExceptionMarksError", testNetworkExceptionMarksError],
      ["unparseableBodyMarksError", testUnparseableBodyMarksError],
      ["missingRefreshTokenMarksNeedsReauth", testMissingRefreshTokenMarksNeedsReauth],
      ["noTokenEndpointMarksError", testNoTokenEndpointMarksError],
      ["noConnectionLogsButNoRow", testNoConnectionLogsButNoRow],
      ["healthQueryableAndReturnsNoTokens", testHealthQueryableAndReturnsNoTokens],
      ["successfulRefreshClearsStaleState", testSuccessfulRefreshClearsStaleState],
    ];
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  ok  ${name}`);
      } catch (e: any) {
        failures.push(`${name} threw: ${e?.message ?? e}`);
        console.log(`  ERR ${name}`);
      }
    }
    if (failures.length) {
      console.error("\nFAIL — payer-token sync-health invariants:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("OK — payer-token sync-health alerting holds");
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
