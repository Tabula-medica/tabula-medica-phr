/**
 * Regression tests for the GCIP (Google Cloud Identity Platform) dual-validation
 * auth path introduced in Task #68.
 *
 * Covers:
 *   - `verifyGcipToken`: bad signature, expired, wrong audience → null
 *   - `resolveGcipUser`: existing link resolves, unverified-email auto-link
 *     is BLOCKED (account-takeover guard), verified-email auto-link is allowed
 *   - `POST /api/auth/gcip` route: 400 (no token) / 401 (invalid) / 200 (valid)
 *
 * Wire-up: framework-agnostic. Runs directly via
 *   `node --import tsx server/__tests__/auth-gcip.test.ts`
 * matching the pattern in `ai-policy.test.ts`.
 *
 * The route integration test imports the real production handler factory
 * from `server/auth/gcip-route.ts` (Task #103) — the same factory the
 * production route in `server/routes/clinical-1.ts` is wired to. No inline
 * copy to drift.
 */

// Env must be set BEFORE importing modules that read it at load time.
process.env.GCIP_PROJECT_ID = process.env.GCIP_PROJECT_ID || "test-gcip-project";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import {
  generateKeyPair,
  SignJWT,
  exportJWK,
  createLocalJWKSet,
  type KeyLike,
} from "jose";
import { db } from "../db";
import { storage } from "../storage";

// gcip.ts reads GCIP_PROJECT_ID at module-load time, and ESM `import`s are
// hoisted above the `process.env.* = ...` assignments at the top of this
// file. So we MUST import gcip dynamically AFTER env is set.
type GcipModule = typeof import("../auth/gcip");
let gcip!: GcipModule;

// ---------------------------------------------------------------------------
// JWKS injection
// ---------------------------------------------------------------------------
//
// jose's createRemoteJWKSet uses raw `node:https.get` (not globalThis.fetch),
// so neither a fetch stub nor a partial https stub can reliably intercept its
// key fetch across all jose versions. Instead, we inject a local JWKS
// resolver via gcip's test-only `__setJwksForTesting` hook.

const REAL_FETCH = globalThis.fetch.bind(globalThis);
let SIGNING_KEY: KeyLike;
let WRONG_KEY: KeyLike;
let PUBLIC_JWK: any;

async function setupKeys() {
  gcip = await import("../auth/gcip");
  const pair1 = await generateKeyPair("RS256");
  const pair2 = await generateKeyPair("RS256");
  SIGNING_KEY = pair1.privateKey;
  WRONG_KEY = pair2.privateKey;
  PUBLIC_JWK = await exportJWK(pair1.publicKey);
  PUBLIC_JWK.kid = "test-kid";
  PUBLIC_JWK.alg = "RS256";
  PUBLIC_JWK.use = "sig";

  const localJwks = createLocalJWKSet({ keys: [PUBLIC_JWK] });
  gcip.__setJwksForTesting(localJwks as any);
}

const ISSUER = `https://securetoken.google.com/${process.env.GCIP_PROJECT_ID}`;
const AUDIENCE = process.env.GCIP_PROJECT_ID!;

async function makeToken(
  opts: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    exp?: number;
    signWith?: KeyLike;
    audience?: string;
    issuer?: string;
  } = {},
): Promise<string> {
  const payload: Record<string, any> = {};
  if (opts.email !== undefined) payload.email = opts.email;
  if (opts.email_verified !== undefined) payload.email_verified = opts.email_verified;
  if (opts.name !== undefined) payload.name = opts.name;

  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setSubject(opts.sub ?? "gcip-sub-default")
    .setIssuedAt();
  builder.setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 3600);
  return builder.sign(opts.signWith ?? SIGNING_KEY);
}

// ---------------------------------------------------------------------------
// DB / storage stubs — replace methods on the imported singletons so the
// gcip module under test sees them via its live ESM bindings.
// ---------------------------------------------------------------------------

type Link = {
  id: string;
  userId: string;
  provider: string;
  externalSub: string;
  email: string | null;
  emailVerified: boolean;
  lastSeenAt?: Date;
};

const links: Link[] = [];
const insertCalls: { values: any }[] = [];
const updateCalls: { values: any; whereDesc: string }[] = [];
let lastSelectFilter: { provider?: string; externalSub?: string } = {};

function resetDb() {
  links.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  lastSelectFilter = {};
}

// db.select().from(externalIdentities).where(and(eq(...provider, "gcip"), eq(...externalSub, sub))).limit(1)
(db as any).select = () => ({
  from: (_t: any) => ({
    where: (_w: any) => ({
      limit: async (_n: number) => {
        // The only db.select() call in gcip.ts looks up an external_identities
        // row by (provider, externalSub). Since we can't easily introspect the
        // drizzle SQL fragment, we cheat: return the link the test pre-seeded
        // that matches the most recent token's sub. Tests set up `links` so
        // there is at most one row matching the verified sub.
        if (links.length === 0) return [];
        // Best-effort filter using whatever sub the test passed in via the
        // makeToken call; we expose `lastSelectFilter` for explicit tests.
        if (lastSelectFilter.externalSub) {
          return links.filter(
            (l) =>
              l.provider === lastSelectFilter.provider &&
              l.externalSub === lastSelectFilter.externalSub,
          );
        }
        return links.slice();
      },
    }),
  }),
});

(db as any).insert = (_t: any) => ({
  values: (vals: any) => ({
    onConflictDoNothing: async () => {
      insertCalls.push({ values: vals });
      const exists = links.some(
        (l) => l.provider === vals.provider && l.externalSub === vals.externalSub,
      );
      if (!exists) {
        links.push({
          id: `link-${links.length + 1}`,
          userId: vals.userId,
          provider: vals.provider,
          externalSub: vals.externalSub,
          email: vals.email ?? null,
          emailVerified: !!vals.emailVerified,
        });
      }
    },
  }),
});

(db as any).update = (_t: any) => ({
  set: (vals: any) => ({
    where: async (_w: any) => {
      updateCalls.push({ values: vals, whereDesc: "by-id" });
    },
  }),
});

type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash?: string | null;
};
const usersById = new Map<string, StoredUser>();
const usersByEmail = new Map<string, StoredUser>();
let createUserCalls = 0;

function resetStorage() {
  usersById.clear();
  usersByEmail.clear();
  createUserCalls = 0;
}

function seedUser(u: StoredUser) {
  usersById.set(u.id, u);
  usersByEmail.set(u.email, u);
}

(storage as any).getUser = async (id: string) => usersById.get(id);
(storage as any).getUserByEmail = async (email: string) => usersByEmail.get(email);
(storage as any).createUser = async (u: any) => {
  createUserCalls += 1;
  const created: StoredUser = {
    id: `user-${createUserCalls}`,
    email: u.email,
    name: u.name,
    passwordHash: null,
  };
  seedUser(created);
  return created;
};
(storage as any).createUserSession = async (s: any) => ({
  id: `session-${Date.now()}`,
  ...s,
});
(storage as any).createAuditLog = async () => undefined;
(storage as any).updateUserSessionActivity = async () => undefined;

// Helper: prime the select filter to match a specific (provider, externalSub).
function expectSelect(provider: string, externalSub: string) {
  lastSelectFilter = { provider, externalSub };
}

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
// Unit tests — verifyGcipToken
// ---------------------------------------------------------------------------

async function testBadSignature() {
  resetDb();
  resetStorage();
  const token = await makeToken({ signWith: WRONG_KEY });
  const claims = await gcip.verifyGcipToken(token);
  assertEq(claims, null, "bad signature must yield null");
}

async function testExpired() {
  resetDb();
  resetStorage();
  const past = Math.floor(Date.now() / 1000) - 300;
  const token = await makeToken({ exp: past });
  const claims = await gcip.verifyGcipToken(token);
  assertEq(claims, null, "expired token must yield null");
}

async function testWrongAudience() {
  resetDb();
  resetStorage();
  const token = await makeToken({ audience: "some-other-project" });
  const claims = await gcip.verifyGcipToken(token);
  assertEq(claims, null, "wrong audience must yield null");
}

async function testWrongIssuer() {
  resetDb();
  resetStorage();
  const token = await makeToken({ issuer: "https://attacker.example.com/" });
  const claims = await gcip.verifyGcipToken(token);
  assertEq(claims, null, "wrong issuer must yield null");
}

async function testGarbageToken() {
  resetDb();
  resetStorage();
  const claims = await gcip.verifyGcipToken("not.a.jwt");
  assertEq(claims, null, "garbage token must yield null");
}

// ---------------------------------------------------------------------------
// Unit tests — resolveGcipUser
// ---------------------------------------------------------------------------

async function testValidResolvesExistingLink() {
  resetDb();
  resetStorage();
  seedUser({ id: "user-existing", email: "linked@example.com", name: "Linked" });
  links.push({
    id: "l1",
    userId: "user-existing",
    provider: "gcip",
    externalSub: "gcip-sub-linked",
    email: "linked@example.com",
    emailVerified: true,
  });
  expectSelect("gcip", "gcip-sub-linked");

  const token = await makeToken({
    sub: "gcip-sub-linked",
    email: "linked@example.com",
    email_verified: true,
  });
  const claims = await gcip.verifyGcipToken(token);
  assert(claims, "claims must verify");
  const user = await gcip.resolveGcipUser(claims!);
  assert(user, "user must resolve from existing link");
  assertEq(user?.id, "user-existing", "resolved user id");
  // Give the fire-and-forget touchLastSeen() a chance to run.
  await new Promise((r) => setTimeout(r, 10));
  assert(
    updateCalls.length >= 1,
    "lastSeenAt should be touched on successful resolve",
  );
}

async function testUnverifiedEmailBlocksAutoLink() {
  resetDb();
  resetStorage();
  // Victim with the email an attacker is trying to ride in on.
  seedUser({ id: "user-victim", email: "victim@example.com", name: "Victim" });
  expectSelect("gcip", "gcip-attacker-sub");

  const claims: gcip.GcipClaims = {
    sub: "gcip-attacker-sub",
    email: "victim@example.com",
    email_verified: false,
  } as any;
  const user = await gcip.resolveGcipUser(claims);
  assertEq(
    user,
    null,
    "unverified email MUST NOT auto-link to existing user (takeover guard)",
  );
  assertEq(
    insertCalls.length,
    0,
    "no external_identities insert may happen on unverified auto-link attempt",
  );
}

async function testVerifiedEmailAllowsAutoLink() {
  resetDb();
  resetStorage();
  seedUser({ id: "user-found", email: "found@example.com", name: "Found" });
  expectSelect("gcip", "gcip-new-sub");

  const claims: gcip.GcipClaims = {
    sub: "gcip-new-sub",
    email: "found@example.com",
    email_verified: true,
  } as any;
  const user = await gcip.resolveGcipUser(claims);
  assertEq(user?.id, "user-found", "verified email must auto-link to existing user");
  assertEq(insertCalls.length, 1, "exactly one external_identities insert");
  assertEq(insertCalls[0].values.provider, "gcip", "linked as gcip provider");
  assertEq(
    insertCalls[0].values.externalSub,
    "gcip-new-sub",
    "linked externalSub matches token sub",
  );
  assertEq(
    insertCalls[0].values.emailVerified,
    true,
    "linked row records email_verified=true",
  );
}

async function testUnknownEmailReturnsNull() {
  resetDb();
  resetStorage();
  expectSelect("gcip", "gcip-orphan-sub");
  const claims: gcip.GcipClaims = {
    sub: "gcip-orphan-sub",
    email: "orphan@example.com",
    email_verified: true,
  } as any;
  const user = await gcip.resolveGcipUser(claims);
  assertEq(user, null, "verified email with no matching user should return null");
}

// ---------------------------------------------------------------------------
// Integration test — POST /api/auth/gcip (mirrors handler in server/routes.ts)
// ---------------------------------------------------------------------------

async function testRouteIntegration() {
  resetDb();
  resetStorage();

  const express = (await import("express")).default;
  const http = await import("node:http");
  const app = express();
  app.use(express.json());

  // Import the REAL production handler factory and mount it. This is the
  // same factory wired up in server/routes/clinical-1.ts, so any drift in
  // status codes, response shape, or audit metadata is caught here.
  const { createGcipAuthHandler } = await import("../auth/gcip-route");
  const auditCalls: any[] = [];
  const handler = createGcipAuthHandler({
    createAuthSession: async (_userId: string) => ({
      accessToken: "atk-raw",
      refreshToken: "rtk-raw",
    }),
    auditLog: (_req, action, resourceType, resourceId, metadata) => {
      auditCalls.push({ action, resourceType, resourceId, metadata });
    },
  });
  app.post("/api/auth/gcip", handler);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 400 — missing token
    const r400 = await REAL_FETCH(`${base}/api/auth/gcip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEq(r400.status, 400, "missing token must return 400");

    // 401 — bad-signature token
    const badToken = await makeToken({ signWith: WRONG_KEY, sub: "any" });
    const r401 = await REAL_FETCH(`${base}/api/auth/gcip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: badToken }),
    });
    assertEq(r401.status, 401, "invalid token must return 401");

    // 200 — valid token (auto-provisions a new user, since no link/email match)
    expectSelect("gcip", "gcip-route-new");
    const goodToken = await makeToken({
      sub: "gcip-route-new",
      email: "route-new@example.com",
      email_verified: true,
      name: "Route New",
    });
    const r200 = await REAL_FETCH(`${base}/api/auth/gcip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: goodToken }),
    });
    assertEq(r200.status, 200, "valid token must return 200");
    const body: any = await r200.json();
    assert(body.accessToken && body.refreshToken, "200 response carries session tokens");
    assert(body.user?.id, "200 response carries a user with id");
    assert(!("passwordHash" in (body.user || {})), "passwordHash must be stripped");
    assertEq(auditCalls.length, 1, "auditLog called exactly once on success");
    const a = auditCalls[0] ?? {};
    assertEq(a.action, "login", "audit action is 'login'");
    assertEq(a.resourceType, "user", "audit resourceType is 'user'");
    assertEq(a.metadata?.method, "gcip", "audit metadata.method is 'gcip'");
    assertEq(a.metadata?.flow, "id_token", "audit metadata.flow is 'id_token'");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS: Array<[string, () => Promise<void>]> = [
  ["verifyGcipToken: bad signature → null", testBadSignature],
  ["verifyGcipToken: expired → null", testExpired],
  ["verifyGcipToken: wrong audience → null", testWrongAudience],
  ["verifyGcipToken: wrong issuer → null", testWrongIssuer],
  ["verifyGcipToken: garbage → null", testGarbageToken],
  ["resolveGcipUser: existing link → resolved user", testValidResolvesExistingLink],
  ["resolveGcipUser: unverified email auto-link BLOCKED", testUnverifiedEmailBlocksAutoLink],
  ["resolveGcipUser: verified email auto-link allowed", testVerifiedEmailAllowsAutoLink],
  ["resolveGcipUser: no matching user → null", testUnknownEmailReturnsNull],
  ["POST /api/auth/gcip: 400 / 401 / 200", testRouteIntegration],
];

export async function run(): Promise<{ pass: number; fail: number }> {
  await setupKeys();
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
  // Reset the test-only JWKS override so this module doesn't bleed state
  // into any other gcip-touching test that might share the process.
  try {
    gcip.__setJwksForTesting(null);
  } catch {
    // ignore — only relevant if setupKeys ran successfully
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
