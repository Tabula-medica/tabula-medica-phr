/**
 * Regression tests for the payer-token storage path introduced in Task #104
 * (Verified end-to-end in Task #116).
 *
 * Task #104 moved per-user SMART-on-FHIR / TEFCA payer tokens out of Auth0
 * user_metadata into the `payer_token_connections` Postgres table, keyed by
 * internal `users.id` and encrypted with `PHI_ENCRYPTION_KEY`. The broker
 * helpers live in `server/auth0-fhir-broker.ts` and are exercised by the two
 * routes `/api/fasten/connect-payer` and `/api/fasten/connected-sources`, plus
 * the `refreshPayerToken` helper.
 *
 * These tests cover the round-trip end-to-end:
 *   - storePayerToken encrypts access/refresh and writes a row (insert path)
 *   - storing the same (userId, sourceType) again upserts in place (no dupes)
 *   - getPayerToken decrypts and returns the original plaintext tokens
 *   - encrypted columns persisted to the table are NOT the plaintext (so a
 *     PHI_ENCRYPTION_KEY regression / accidental plaintext write would fail
 *     loudly here)
 *   - getConnectedSources lists every sourceType the user has connected
 *   - refreshPayerToken exchanges the stored refresh_token at the payer's
 *     token endpoint and re-encrypts the new access_token in place
 *
 * Framework-agnostic, runs via `node --import tsx server/__tests__/payer-token-storage.test.ts`,
 * picked up automatically by `scripts/run-server-tests.mjs` (the `npm run
 * test:server` CI gate).
 */

// Env must be set BEFORE importing modules that read it at load time.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
process.env.PHI_ENCRYPTION_KEY =
  process.env.PHI_ENCRYPTION_KEY ||
  "test-phi-key-task-116-payer-token-storage-32+chars";

import { db } from "../db";
import {
  storePayerToken,
  getPayerToken,
  getConnectedSources,
  refreshPayerToken,
  type PayerTokens,
} from "../auth0-fhir-broker";

// ---------------------------------------------------------------------------
// In-memory stub of the `payer_token_connections` table.
// We stub the drizzle methods on the imported `db` singleton so the broker
// module under test exercises its real code paths (including encrypt/decrypt)
// without needing a real Postgres connection.
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
};

let rows: Row[] = [];
let lastSelectKind: "all-for-user" | "by-user-and-source" | null = null;
let lastUserFilter: string | null = null;
let lastSourceFilter: string | null = null;

function resetDb() {
  rows = [];
  lastSelectKind = null;
  lastUserFilter = null;
  lastSourceFilter = null;
}

// db.insert(payerTokenConnections).values({...}).onConflictDoUpdate({...})
(db as any).insert = (_t: any) => ({
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
        });
      }
    },
  }),
});

// Two select shapes are used by the broker:
//   getPayerToken:       db.select().from(t).where(and(eq(userId), eq(sourceType))).limit(1)
//   getConnectedSources: db.select({sourceType}).from(t).where(eq(userId))
// The test sets `lastSelectKind` (and the user/source filters) right before
// calling the helper, so the stub knows which shape to honor. The broker
// itself never calls .limit / .where in a way we can introspect from the
// outside, so this priming pattern matches the one used in auth-gcip.test.ts.
(db as any).select = (_proj?: any) => ({
  from: (_t: any) => ({
    where: (_w: any) => {
      const result = {
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
          // getConnectedSources awaits the where(...) directly (no .limit).
          try {
            if (lastSelectKind !== "all-for-user") {
              throw new Error("unexpected select-all call");
            }
            const out = rows
              .filter((r) => r.userId === lastUserFilter)
              .map((r) => ({ sourceType: r.sourceType }));
            resolve(out);
          } catch (e) {
            reject(e);
          }
        },
      };
      return result;
    },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testStoreAndRoundTrip() {
  resetDb();
  const userId = "user-abc";
  const sourceType = "cigna";
  const tokens: PayerTokens = {
    accessToken: "ACCESS-PLAINTEXT-12345",
    refreshToken: "REFRESH-PLAINTEXT-67890",
    expiresAt: Date.now() + 3_600_000,
    fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal/",
  };

  await storePayerToken(userId, sourceType, tokens);

  assertEq(rows.length, 1, "should insert exactly one row");
  const stored = rows[0];
  assertEq(stored.userId, userId, "row userId matches");
  assertEq(stored.sourceType, sourceType, "row sourceType matches");
  assertEq(
    stored.fhirBaseUrl,
    tokens.fhirBaseUrl,
    "row fhirBaseUrl matches",
  );

  // Encryption invariant: ciphertext must NOT equal plaintext anywhere.
  assert(
    !stored.accessTokenEncrypted.includes(tokens.accessToken),
    "access token must be encrypted at rest, not plaintext",
  );
  assert(
    stored.refreshTokenEncrypted !== null &&
      !stored.refreshTokenEncrypted.includes(tokens.refreshToken),
    "refresh token must be encrypted at rest, not plaintext",
  );
  // AES-GCM format from said-patient-service is "iv:authTag:ciphertext".
  assertEq(
    stored.accessTokenEncrypted.split(":").length,
    3,
    "ciphertext should be iv:authTag:ciphertext (3 hex segments)",
  );

  // Read it back through the public API.
  lastSelectKind = "by-user-and-source";
  lastUserFilter = userId;
  lastSourceFilter = sourceType;
  const fetched = await getPayerToken(userId, sourceType);
  assert(fetched !== null, "getPayerToken must return a record");
  assertEq(
    fetched!.accessToken,
    tokens.accessToken,
    "round-trip access token decrypts to original",
  );
  assertEq(
    fetched!.refreshToken,
    tokens.refreshToken,
    "round-trip refresh token decrypts to original",
  );
  assertEq(
    fetched!.fhirBaseUrl,
    tokens.fhirBaseUrl,
    "round-trip fhirBaseUrl preserved",
  );
  assertEq(
    fetched!.sourceType,
    sourceType,
    "round-trip sourceType preserved",
  );
}

async function testMissingTokenReturnsNull() {
  resetDb();
  lastSelectKind = "by-user-and-source";
  lastUserFilter = "user-with-nothing";
  lastSourceFilter = "cigna";
  const fetched = await getPayerToken("user-with-nothing", "cigna");
  assertEq(fetched, null, "missing record must return null, not throw");
}

async function testUpsertReplacesInPlace() {
  resetDb();
  const userId = "user-upsert";
  const sourceType = "epic";
  await storePayerToken(userId, sourceType, {
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: Date.now() + 1000,
    fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
  });
  assertEq(rows.length, 1, "first store inserts one row");
  const firstCiphertext = rows[0].accessTokenEncrypted;

  await storePayerToken(userId, sourceType, {
    accessToken: "new-access",
    refreshToken: "new-refresh",
    expiresAt: Date.now() + 7200_000,
    fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
  });
  assertEq(
    rows.length,
    1,
    "upsert on (userId, sourceType) must NOT create a duplicate row",
  );
  assert(
    rows[0].accessTokenEncrypted !== firstCiphertext,
    "upsert must rewrite the encrypted access token",
  );

  lastSelectKind = "by-user-and-source";
  lastUserFilter = userId;
  lastSourceFilter = sourceType;
  const fetched = await getPayerToken(userId, sourceType);
  assertEq(
    fetched!.accessToken,
    "new-access",
    "upsert leaves the freshest plaintext readable",
  );
  assertEq(
    fetched!.refreshToken,
    "new-refresh",
    "upsert rewrites the refresh token too",
  );
}

async function testListConnectedSources() {
  resetDb();
  const userId = "user-multi";
  for (const sourceType of ["cigna", "epic", "aetna"]) {
    await storePayerToken(userId, sourceType, {
      accessToken: `access-${sourceType}`,
      refreshToken: `refresh-${sourceType}`,
      expiresAt: Date.now() + 3_600_000,
      fhirBaseUrl: `https://fhir.${sourceType}.example/`,
    });
  }
  // Another user's connection must NOT leak through.
  await storePayerToken("user-other", "cigna", {
    accessToken: "other-access",
    refreshToken: "other-refresh",
    expiresAt: Date.now() + 3_600_000,
    fhirBaseUrl: "https://fhir.cigna.com/",
  });

  lastSelectKind = "all-for-user";
  lastUserFilter = userId;
  const sources = await getConnectedSources(userId);
  assertEq(sources.length, 3, "lists every source for the user");
  for (const s of ["cigna", "epic", "aetna"]) {
    assert(sources.includes(s), `connected sources include ${s}`);
  }
  assert(
    !sources.includes("other-user-only-source"),
    "no cross-user leakage in connected sources",
  );
}

async function testRefreshPayerToken() {
  resetDb();
  const userId = "user-refresh";
  const sourceType = "cigna";
  await storePayerToken(userId, sourceType, {
    accessToken: "stale-access",
    refreshToken: "valid-refresh-abc",
    expiresAt: Date.now() - 60_000,
    fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal/",
  });
  const staleCiphertext = rows[0].accessTokenEncrypted;

  // Stub global fetch to simulate the payer's OAuth2 token endpoint.
  const REAL_FETCH = globalThis.fetch;
  const fetchCalls: Array<{ url: string; body: string }> = [];
  (globalThis as any).fetch = async (url: any, init: any) => {
    fetchCalls.push({ url: String(url), body: String(init?.body ?? "") });
    return {
      ok: true,
      json: async () => ({
        access_token: "fresh-access-xyz",
        refresh_token: "fresh-refresh-xyz",
        expires_in: 3600,
      }),
    } as any;
  };

  // Prime stub for both reads (initial fetch + post-store read inside upsert
  // path), plus the final round-trip read below.
  lastSelectKind = "by-user-and-source";
  lastUserFilter = userId;
  lastSourceFilter = sourceType;

  let result: PayerTokens | null;
  try {
    result = await refreshPayerToken(userId, sourceType);
  } finally {
    (globalThis as any).fetch = REAL_FETCH;
  }

  assert(result !== null, "refreshPayerToken must return new tokens");
  assertEq(
    result!.accessToken,
    "fresh-access-xyz",
    "refresh returns the new access token",
  );
  assertEq(
    result!.refreshToken,
    "fresh-refresh-xyz",
    "refresh returns the new refresh token (server-provided)",
  );

  assertEq(
    fetchCalls.length,
    1,
    "refreshPayerToken should hit the token endpoint exactly once",
  );
  assertEq(
    fetchCalls[0].url,
    "https://oauth.cigna.com/oauth2/token",
    "refresh hits the Cigna OAuth token endpoint",
  );
  assert(
    fetchCalls[0].body.includes("grant_type=refresh_token"),
    "refresh request uses grant_type=refresh_token",
  );
  assert(
    fetchCalls[0].body.includes("refresh_token=valid-refresh-abc"),
    "refresh request sends the stored refresh token",
  );

  // The stored row must have been rewritten with a new ciphertext.
  assertEq(rows.length, 1, "refresh upserts in place — no duplicate row");
  assert(
    rows[0].accessTokenEncrypted !== staleCiphertext,
    "stored access-token ciphertext rotated after refresh",
  );

  // And the round-trip from storage should now yield the fresh tokens.
  lastSelectKind = "by-user-and-source";
  lastUserFilter = userId;
  lastSourceFilter = sourceType;
  const fetched = await getPayerToken(userId, sourceType);
  assertEq(
    fetched!.accessToken,
    "fresh-access-xyz",
    "post-refresh decrypt returns the fresh access token",
  );
  assertEq(
    fetched!.refreshToken,
    "fresh-refresh-xyz",
    "post-refresh decrypt returns the fresh refresh token",
  );
}

async function testRefreshWithoutStoredTokenReturnsNull() {
  resetDb();
  lastSelectKind = "by-user-and-source";
  lastUserFilter = "user-none";
  lastSourceFilter = "cigna";
  const result = await refreshPayerToken("user-none", "cigna");
  assertEq(result, null, "refresh with no stored token must return null");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const tests: Array<[string, () => Promise<void>]> = [
      ["storeAndRoundTrip", testStoreAndRoundTrip],
      ["missingTokenReturnsNull", testMissingTokenReturnsNull],
      ["upsertReplacesInPlace", testUpsertReplacesInPlace],
      ["listConnectedSources", testListConnectedSources],
      ["refreshPayerToken", testRefreshPayerToken],
      ["refreshWithoutStoredTokenReturnsNull", testRefreshWithoutStoredTokenReturnsNull],
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
      console.error("\nFAIL — payer-token storage invariants:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("OK — payer-token storage round-trip holds");
    // The drizzle pool is kept alive by `server/db.ts`; force-exit so the
    // runner moves on to the next test file instead of hanging on open handles.
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
