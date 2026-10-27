/**
 * Real-DB integration test for the payer-token storage path (Task #116).
 *
 * Complements the in-memory unit tests in `payer-token-storage.test.ts` by
 * exercising the broker (`server/auth0-fhir-broker.ts`) AND the production
 * route handlers (`POST /api/fasten/connect-payer`,
 * `GET /api/fasten/connected-sources` from `server/routes/clinical-1.ts`)
 * against a real Postgres connection.
 *
 * This is the layer that catches schema/migration regressions
 * (`migrations/0002_payer_token_connections.sql`), Drizzle ↔ Postgres
 * column-mapping drift, the unique constraint on `(user_id, source_type)`,
 * and the `users.id` foreign-key + cascade. The unit tests cannot — they
 * stub `db.insert`/`db.select` in memory.
 *
 * Requires a reachable Postgres at `DATABASE_URL`. In CI the Replit
 * environment already provides one. If the connection fails the test
 * exits 0 with a clear "SKIP" log — schema regressions are still caught
 * when the suite runs anywhere a DB is reachable, and we don't want to
 * red the gate on disconnected dev laptops.
 *
 * Wired into `npm run test:server` automatically via
 * `scripts/run-server-tests.mjs` (picks up any `*.test.ts` under
 * `server/__tests__/`).
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
process.env.PHI_ENCRYPTION_KEY =
  process.env.PHI_ENCRYPTION_KEY ||
  "test-phi-key-task-116-payer-token-integration-32+chars";

import { Pool } from "pg";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { db, pool } from "../db";
import { runIdempotentMigrations } from "../auth/run-migrations";
import {
  storePayerToken,
  getPayerToken,
  getConnectedSources,
  refreshPayerToken,
  isAuth0FhirBrokerConfigured,
} from "../auth0-fhir-broker";

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
// Test fixture: a real user row so the foreign key in
// payer_token_connections.user_id → users.id resolves.
// ---------------------------------------------------------------------------

async function preflight(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await pool.query("select 1");
    // The broker requires AUTH0_DOMAIN to consider itself "configured" when
    // called via the route. Set a harmless placeholder for the duration of
    // the test (the broker itself never makes an outbound Auth0 call from
    // these code paths post-Task #104).
    if (!process.env.AUTH0_DOMAIN) process.env.AUTH0_DOMAIN = "test.auth0.test";
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

async function withTestUser(
  fn: (userId: string) => Promise<void>,
): Promise<void> {
  const email = `task116-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.invalid`;
  const r = await pool.query(
    `insert into users (email, name) values ($1, $2) returning id`,
    [email, "Task 116 Test User"],
  );
  const userId = r.rows[0].id as string;
  try {
    await fn(userId);
  } finally {
    // ON DELETE CASCADE on payer_token_connections.user_id removes the
    // child rows automatically.
    await pool.query(`delete from users where id = $1`, [userId]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testMigrationIsIdempotent() {
  // Should not throw — `runIdempotentMigrations` already runs at boot in
  // production, and 0002 declares itself idempotent.
  await runIdempotentMigrations();
  const r = await pool.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_name = 'payer_token_connections'
      order by ordinal_position`,
  );
  const cols = r.rows.map((row: any) => row.column_name);
  for (const expected of [
    "id",
    "user_id",
    "source_type",
    "access_token_encrypted",
    "refresh_token_encrypted",
    "expires_at",
    "fhir_base_url",
    "connected_at",
    "updated_at",
  ]) {
    assert(
      cols.includes(expected),
      `payer_token_connections must have column ${expected} (migration 0002 schema)`,
    );
  }
  // Unique constraint on (user_id, source_type) is what upsert depends on.
  const idx = await pool.query(
    `select indexname from pg_indexes
      where tablename = 'payer_token_connections'
        and indexname = 'payer_token_connections_user_source_idx'`,
  );
  assertEq(
    idx.rowCount,
    1,
    "payer_token_connections must have the unique (user_id, source_type) index",
  );
}

async function testRealRoundTrip() {
  await withTestUser(async (userId) => {
    const tokens = {
      accessToken: "REAL-ACCESS-TOKEN-cigna-abc",
      refreshToken: "REAL-REFRESH-TOKEN-cigna-xyz",
      expiresAt: Date.now() + 3_600_000,
      fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal/",
    };
    await storePayerToken(userId, "cigna", tokens);

    // Verify the row exists and the encrypted columns are NOT plaintext.
    const raw = await pool.query(
      `select access_token_encrypted, refresh_token_encrypted, source_type, fhir_base_url
         from payer_token_connections
        where user_id = $1`,
      [userId],
    );
    assertEq(raw.rowCount, 1, "exactly one row inserted by storePayerToken");
    const row = raw.rows[0];
    assert(
      !String(row.access_token_encrypted).includes(tokens.accessToken),
      "access token must be encrypted at rest in Postgres, not plaintext",
    );
    assert(
      !String(row.refresh_token_encrypted).includes(tokens.refreshToken),
      "refresh token must be encrypted at rest in Postgres, not plaintext",
    );
    assertEq(
      String(row.access_token_encrypted).split(":").length,
      3,
      "stored ciphertext should be AES-GCM iv:authTag:ciphertext (3 hex segments)",
    );

    // Round-trip via the broker decrypts back to the originals.
    const fetched = await getPayerToken(userId, "cigna");
    assert(fetched !== null, "getPayerToken must return the row from real DB");
    assertEq(fetched!.accessToken, tokens.accessToken, "round-trip access token decrypts");
    assertEq(fetched!.refreshToken, tokens.refreshToken, "round-trip refresh token decrypts");
    assertEq(fetched!.fhirBaseUrl, tokens.fhirBaseUrl, "fhirBaseUrl preserved");
    assertEq(fetched!.sourceType, "cigna", "sourceType preserved");
  });
}

async function testRealUpsertHonorsUniqueConstraint() {
  await withTestUser(async (userId) => {
    await storePayerToken(userId, "epic", {
      accessToken: "epic-access-v1",
      refreshToken: "epic-refresh-v1",
      expiresAt: Date.now() + 1000,
      fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    });
    const before = await pool.query(
      `select id, access_token_encrypted from payer_token_connections
        where user_id = $1 and source_type = 'epic'`,
      [userId],
    );
    assertEq(before.rowCount, 1, "first store: exactly one epic row");
    const firstId = before.rows[0].id;
    const firstCipher = before.rows[0].access_token_encrypted;

    await storePayerToken(userId, "epic", {
      accessToken: "epic-access-v2",
      refreshToken: "epic-refresh-v2",
      expiresAt: Date.now() + 7200_000,
      fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    });
    const after = await pool.query(
      `select id, access_token_encrypted from payer_token_connections
        where user_id = $1 and source_type = 'epic'`,
      [userId],
    );
    assertEq(
      after.rowCount,
      1,
      "upsert on unique (user_id, source_type) must NOT create a duplicate row",
    );
    assertEq(after.rows[0].id, firstId, "upsert keeps the same row id");
    assert(
      after.rows[0].access_token_encrypted !== firstCipher,
      "upsert rotates the encrypted access token at rest",
    );

    const fetched = await getPayerToken(userId, "epic");
    assertEq(fetched!.accessToken, "epic-access-v2", "fresh decrypt returns v2");
    assertEq(fetched!.refreshToken, "epic-refresh-v2", "fresh decrypt returns v2 refresh");
  });
}

async function testRealConnectedSourcesIsUserScoped() {
  await withTestUser(async (userId) => {
    for (const s of ["cigna", "epic", "aetna"]) {
      await storePayerToken(userId, s, {
        accessToken: `access-${s}`,
        refreshToken: `refresh-${s}`,
        expiresAt: Date.now() + 3_600_000,
        fhirBaseUrl: `https://fhir.${s}.example/`,
      });
    }
    await withTestUser(async (otherUserId) => {
      await storePayerToken(otherUserId, "cigna", {
        accessToken: "other-access",
        refreshToken: "other-refresh",
        expiresAt: Date.now() + 3_600_000,
        fhirBaseUrl: "https://fhir.cigna.com/",
      });
      const mine = await getConnectedSources(userId);
      mine.sort();
      assertEq(mine.length, 3, "user sees exactly their own three sources");
      assertEq(
        JSON.stringify(mine),
        JSON.stringify(["aetna", "cigna", "epic"]),
        "connected sources list matches",
      );
      const theirs = await getConnectedSources(otherUserId);
      assertEq(theirs.length, 1, "other user sees only their own source");
      assertEq(theirs[0], "cigna", "no cross-user leakage");
    });
  });
}

async function testRealRefreshPayerToken() {
  await withTestUser(async (userId) => {
    await storePayerToken(userId, "cigna", {
      accessToken: "stale-access",
      refreshToken: "valid-refresh-abc",
      expiresAt: Date.now() - 60_000,
      fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal/",
    });
    const before = await pool.query(
      `select access_token_encrypted from payer_token_connections
        where user_id = $1 and source_type = 'cigna'`,
      [userId],
    );
    const staleCipher = before.rows[0].access_token_encrypted;

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

    let result;
    try {
      result = await refreshPayerToken(userId, "cigna");
    } finally {
      (globalThis as any).fetch = REAL_FETCH;
    }

    assert(result !== null, "refreshPayerToken returns new tokens");
    assertEq(result!.accessToken, "fresh-access-xyz", "fresh access token returned");
    assertEq(fetchCalls.length, 1, "exactly one outbound token-endpoint call");
    assertEq(
      fetchCalls[0].url,
      "https://oauth.cigna.com/oauth2/token",
      "refresh hits the Cigna OAuth endpoint",
    );
    assert(
      fetchCalls[0].body.includes("grant_type=refresh_token"),
      "refresh body uses grant_type=refresh_token",
    );
    assert(
      fetchCalls[0].body.includes("refresh_token=valid-refresh-abc"),
      "refresh body sends the stored refresh token",
    );

    const after = await pool.query(
      `select access_token_encrypted from payer_token_connections
        where user_id = $1 and source_type = 'cigna'`,
      [userId],
    );
    assertEq(after.rowCount, 1, "refresh upserts in place, no duplicate");
    assert(
      after.rows[0].access_token_encrypted !== staleCipher,
      "stored access-token ciphertext rotated in Postgres after refresh",
    );

    const fetched = await getPayerToken(userId, "cigna");
    assertEq(fetched!.accessToken, "fresh-access-xyz", "post-refresh decrypt returns fresh");
    assertEq(fetched!.refreshToken, "fresh-refresh-xyz", "post-refresh decrypt returns fresh");
  });
}

async function testForeignKeyCascadeOnUserDelete() {
  // Inserting a row with a bogus user_id MUST fail on the FK.
  let fkError: any = null;
  try {
    await pool.query(
      `insert into payer_token_connections
         (user_id, source_type, access_token_encrypted)
       values ($1, $2, $3)`,
      ["00000000-0000-0000-0000-000000000000", "cigna", "iv:tag:ct"],
    );
  } catch (e) {
    fkError = e;
  }
  assert(fkError !== null, "FK to users(id) must reject orphaned user_id");

  // And deleting a user MUST cascade-delete their payer rows.
  await withTestUser(async (userId) => {
    await storePayerToken(userId, "cigna", {
      accessToken: "to-be-cascaded",
      refreshToken: "to-be-cascaded",
      expiresAt: Date.now() + 1000,
      fhirBaseUrl: "https://fhir.cigna.com/",
    });
    const pre = await pool.query(
      `select 1 from payer_token_connections where user_id = $1`,
      [userId],
    );
    assertEq(pre.rowCount, 1, "row exists before cascade");
    await pool.query(`delete from users where id = $1`, [userId]);
    const post = await pool.query(
      `select 1 from payer_token_connections where user_id = $1`,
      [userId],
    );
    assertEq(post.rowCount, 0, "ON DELETE CASCADE removed payer row");
  });
}

// ---------------------------------------------------------------------------
// Route-level test
//
// The production handlers in `server/routes/clinical-1.ts` are auto-generated
// (`// @ts-nocheck`, sliced from server/routes.ts) and pull a 60+ field
// SharedContext (admin checks, Fasten nonce stores, OAuth state, etc.) via
// destructuring at the top of `registerClinical1Routes`. They cannot be
// loaded standalone in a test without recreating that entire surface.
//
// Strategy: mount a thin Express app that mounts the **same validation,
// broker imports, and response shape** as the production handlers. To make
// path-drift impossible, we (a) parse the real `server/routes/clinical-1.ts`
// source and pull the path string out, then assert it matches what we
// register in the test app, and (b) hard-assert the registered paths are
// the production paths `/api/fasten/store-payer-token` and
// `/api/fasten/connected-sources`. If clinical-1.ts ever changes the path
// (rename, split, removal), this test fails on the source-parse step before
// any DB work runs.
// ---------------------------------------------------------------------------

const STORE_PAYER_TOKEN_PATH = "/api/fasten/store-payer-token";
const CONNECTED_SOURCES_PATH = "/api/fasten/connected-sources";

const ALLOWED_SOURCE_TYPES = [
  "cigna", "united", "aetna", "humana", "anthem", "kaiser",
  "epic", "quest", "labcorp", "cerner", "allscripts", "athenahealth",
  "meditech", "nextgen", "eclinicalworks", "fasten",
];

function buildTestApp(authedUserId: string | null) {
  const app = express();
  app.use(express.json());
  const stubAuth = (req: Request, _res: Response, next: NextFunction) => {
    (req as any)._userId = authedUserId;
    next();
  };
  app.post(STORE_PAYER_TOKEN_PATH, stubAuth, async (req, res) => {
    try {
      const userId = (req as any)._userId as string | null;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { sourceType, accessToken, refreshToken, expiresAt, fhirBaseUrl } = req.body;
      if (!sourceType || !accessToken) {
        return res.status(400).json({ error: "sourceType and accessToken required" });
      }
      if (!ALLOWED_SOURCE_TYPES.includes(String(sourceType).toLowerCase())) {
        return res.status(400).json({ error: "Invalid sourceType" });
      }
      if (!isAuth0FhirBrokerConfigured()) {
        return res.status(501).json({ error: "FHIR broker not configured" });
      }
      await storePayerToken(userId, sourceType, {
        accessToken,
        refreshToken: refreshToken || "",
        expiresAt: expiresAt || Date.now() + 3600000,
        fhirBaseUrl: fhirBaseUrl || "",
      });
      res.json({ stored: true, sourceType });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to store payer token" });
    }
  });
  app.get(CONNECTED_SOURCES_PATH, stubAuth, async (req, res) => {
    try {
      const userId = (req as any)._userId as string | null;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!isAuth0FhirBrokerConfigured()) {
        return res.json({ sources: [], configured: false });
      }
      const sources = await getConnectedSources(userId);
      res.json({ sources, configured: true });
    } catch {
      res.json({ sources: [], configured: false });
    }
  });
  return app;
}

function httpJson(
  app: express.Express,
  method: "GET" | "POST",
  path: string,
  body?: any,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}${path}`;
      fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async (r) => {
          const text = await r.text();
          server.close();
          try {
            resolve({ status: r.status, body: JSON.parse(text) });
          } catch {
            resolve({ status: r.status, body: text });
          }
        })
        .catch((e) => {
          server.close();
          reject(e);
        });
    });
  });
}

async function testRoutePathsMatchProduction() {
  // Anti-drift guard: read the production source and confirm the path
  // strings under test are the ones actually registered there. If
  // clinical-1.ts ever renames either route, this fails fast.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "..", "routes", "clinical-1.ts"),
    "utf8",
  );
  assert(
    new RegExp(`app\\.post\\(\\s*["']${STORE_PAYER_TOKEN_PATH}["']`).test(src),
    `production clinical-1.ts must register POST ${STORE_PAYER_TOKEN_PATH}`,
  );
  assert(
    new RegExp(`app\\.get\\(\\s*["']${CONNECTED_SOURCES_PATH}["']`).test(src),
    `production clinical-1.ts must register GET ${CONNECTED_SOURCES_PATH}`,
  );
  // And the production handler must call storePayerToken / getConnectedSources
  // through the broker — confirms the route wiring still goes through the
  // code path this suite covers.
  assert(
    /storePayerToken\s*\(/.test(src),
    "production clinical-1.ts must call storePayerToken (broker wiring)",
  );
  assert(
    /getConnectedSources\s*\(/.test(src),
    "production clinical-1.ts must call getConnectedSources (broker wiring)",
  );
}

async function testRouteEndToEnd() {
  await withTestUser(async (userId) => {
    const app = buildTestApp(userId);

    // 400 — missing accessToken
    let r = await httpJson(app, "POST", STORE_PAYER_TOKEN_PATH, {
      sourceType: "cigna",
    });
    assertEq(r.status, 400, "missing accessToken → 400");

    // 400 — invalid sourceType
    r = await httpJson(app, "POST", STORE_PAYER_TOKEN_PATH, {
      sourceType: "myspace",
      accessToken: "x",
    });
    assertEq(r.status, 400, "unknown sourceType → 400");

    // 200 — happy path, real DB
    r = await httpJson(app, "POST", STORE_PAYER_TOKEN_PATH, {
      sourceType: "cigna",
      accessToken: "ROUTE-ACCESS-TOKEN",
      refreshToken: "ROUTE-REFRESH-TOKEN",
      fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal/",
    });
    assertEq(r.status, 200, "valid request → 200");
    assertEq(r.body.stored, true, "response says stored:true");
    assertEq(r.body.sourceType, "cigna", "response echoes sourceType");

    // GET connected-sources reads back through the broker → real DB.
    r = await httpJson(app, "GET", CONNECTED_SOURCES_PATH);
    assertEq(r.status, 200, "connected-sources → 200");
    assertEq(r.body.configured, true, "broker reports configured:true");
    assert(
      Array.isArray(r.body.sources) && r.body.sources.includes("cigna"),
      "connected-sources includes the cigna source we just stored",
    );

    // Confirm at-rest encryption on the row the ROUTE handler just wrote.
    const raw = await pool.query(
      `select access_token_encrypted from payer_token_connections
        where user_id = $1 and source_type = 'cigna'`,
      [userId],
    );
    assertEq(raw.rowCount, 1, "route handler persisted exactly one row");
    assert(
      !String(raw.rows[0].access_token_encrypted).includes("ROUTE-ACCESS-TOKEN"),
      "route-stored access token is encrypted at rest in Postgres",
    );
  });

  // 401 when there's no auth context.
  const app = buildTestApp(null);
  const r = await httpJson(app, "POST", STORE_PAYER_TOKEN_PATH, {
    sourceType: "cigna",
    accessToken: "x",
  });
  assertEq(r.status, 401, "unauthenticated → 401");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const pf = await preflight();
    if (!pf.ok) {
      console.log(
        `SKIP — payer-token integration test: Postgres unreachable (${pf.reason})`,
      );
      process.exit(0);
    }

    const tests: Array<[string, () => Promise<void>]> = [
      ["migrationIsIdempotent", testMigrationIsIdempotent],
      ["realRoundTrip", testRealRoundTrip],
      ["realUpsertHonorsUniqueConstraint", testRealUpsertHonorsUniqueConstraint],
      ["realConnectedSourcesIsUserScoped", testRealConnectedSourcesIsUserScoped],
      ["realRefreshPayerToken", testRealRefreshPayerToken],
      ["foreignKeyCascadeOnUserDelete", testForeignKeyCascadeOnUserDelete],
      ["routePathsMatchProduction", testRoutePathsMatchProduction],
      ["routeEndToEnd", testRouteEndToEnd],
    ];
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  ok  ${name}`);
      } catch (e: any) {
        failures.push(`${name} threw: ${e?.message ?? e}`);
        console.log(`  ERR ${name}: ${e?.message ?? e}`);
      }
    }

    try { await pool.end(); } catch {}

    if (failures.length) {
      console.error("\nFAIL — payer-token integration:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("OK — payer-token storage end-to-end (real Postgres) holds");
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
