/**
 * Regression tests for the canonical Bearer-token middleware in
 * `server/middleware/require-auth.ts`.
 *
 * Every authenticated API route in the app flows through this gate, so a
 * regression here would silently break auth for the entire backend.
 *
 * Covers:
 *   - missing Authorization header → 401 { error: "Unauthorized" }
 *   - malformed/short bearer token → 401 { error: "Invalid token" }
 *   - valid GCIP / Firebase JWT → next(), `_authProvider === "gcip"`,
 *     `x-auth-provider: gcip` response header, `x-user-id` request header set
 *   - valid opaque session token whose owner has a gcip external_identity link
 *     → next(), `_authProvider === "gcip"` (inferred)
 *   - valid opaque session token with no gcip link → next(),
 *     `_authProvider === "session"` (inferred default)
 *   - expired opaque session token → 401 { code: "TOKEN_EXPIRED" }
 *   - unknown opaque token (no session row) → 401 { error: "Unauthorized" }
 *
 * Note on scope: Task #102 originally mentioned a "valid Auth0 JWT" branch,
 * but Task #71 retired the Auth0 raw-token path from this middleware — there
 * is no `server/auth/auth0-verify.ts` and `require-auth.ts` only accepts
 * GCIP JWTs or opaque sessions. The Auth0 case is covered indirectly by the
 * session-with-gcip-link inference (which is what survives from the dual-
 * validation design).
 *
 * Wire-up mirrors `auth-gcip.test.ts`: framework-agnostic, runs via
 *   `node --import tsx server/__tests__/require-auth.test.ts`.
 */

// Env must be set BEFORE importing modules that read it at load time.
process.env.GCIP_PROJECT_ID = process.env.GCIP_PROJECT_ID || "test-gcip-project";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import { createHash } from "crypto";
import { EventEmitter } from "events";
import { createRequire } from "module";
import { generateKeyPair, SignJWT, exportJWK, type KeyLike } from "jose";
import { db } from "../db";
import { storage } from "../storage";

// Use createRequire so we get the real (writable) CJS https module — `import
// * as https` gives an ESM namespace whose properties are read-only getters.
const nodeRequire = createRequire(__filename || process.cwd() + "/");
const httpsModule: typeof import("https") = nodeRequire("https");

// Dynamic import after env is set (matches auth-gcip.test.ts pattern).
type RequireAuthModule = typeof import("../middleware/require-auth");
let mw!: RequireAuthModule;

// ---------------------------------------------------------------------------
// JWKS / fetch stub
// ---------------------------------------------------------------------------

// jose's createRemoteJWKSet uses raw `node:https.get` (not globalThis.fetch),
// so we monkey-patch https.get to serve our test JWKS in-process. This lets
// the real `verifyGcipToken` path execute against tokens we sign locally.
let SIGNING_KEY: KeyLike;
let WRONG_KEY: KeyLike;
let PUBLIC_JWK: any;
const ORIGINAL_HTTPS_GET = httpsModule.get.bind(httpsModule);

function fakeHttpsGetResponse(body: string) {
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.headers = { "content-type": "application/jwk-set+json" };
  res[Symbol.asyncIterator] = async function* () {
    yield Buffer.from(body);
  };
  return res;
}

function installHttpsStub() {
  (httpsModule as any).get = (urlArg: any, _opts: any, _cb?: any): any => {
    const url = typeof urlArg === "string" ? urlArg : (urlArg?.href ?? String(urlArg));
    if (url.includes("googleapis.com") || url.includes("securetoken")) {
      const req: any = new EventEmitter();
      req.destroy = () => undefined;
      const body = JSON.stringify({ keys: [PUBLIC_JWK] });
      setImmediate(() => req.emit("response", fakeHttpsGetResponse(body)));
      return req;
    }
    return ORIGINAL_HTTPS_GET(urlArg, _opts, _cb);
  };
}

const ISSUER = `https://securetoken.google.com/${process.env.GCIP_PROJECT_ID}`;
const AUDIENCE = process.env.GCIP_PROJECT_ID!;

async function makeGcipToken(
  opts: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    exp?: number;
    signWith?: KeyLike;
    audience?: string;
    issuer?: string;
  } = {},
): Promise<string> {
  const payload: Record<string, any> = {};
  if (opts.email !== undefined) payload.email = opts.email;
  if (opts.email_verified !== undefined) payload.email_verified = opts.email_verified;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setSubject(opts.sub ?? "gcip-mw-sub")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 3600)
    .sign(opts.signWith ?? SIGNING_KEY);
}

async function setupModules() {
  const pair1 = await generateKeyPair("RS256");
  const pair2 = await generateKeyPair("RS256");
  SIGNING_KEY = pair1.privateKey;
  WRONG_KEY = pair2.privateKey;
  PUBLIC_JWK = await exportJWK(pair1.publicKey);
  PUBLIC_JWK.kid = "test-kid";
  PUBLIC_JWK.alg = "RS256";
  PUBLIC_JWK.use = "sig";
  installHttpsStub();
  mw = await import("../middleware/require-auth");
}

// ---------------------------------------------------------------------------
// DB / storage stubs
// ---------------------------------------------------------------------------

type Link = {
  id: string;
  userId: string;
  provider: string;
  externalSub: string;
  email: string | null;
  emailVerified: boolean;
};
type StoredUser = { id: string; email: string; name: string };
type Session = {
  id: string;
  userId: string;
  accessToken: string; // sha256 hex
  accessTokenExpiresAt: Date;
  isActive: boolean;
};

const links: Link[] = [];
const sessions: Session[] = [];
const usersById = new Map<string, StoredUser>();
const usersByEmail = new Map<string, StoredUser>();
let activityUpdates = 0;

function resetAll() {
  links.length = 0;
  sessions.length = 0;
  usersById.clear();
  usersByEmail.clear();
  activityUpdates = 0;
}

function seedUser(u: StoredUser) {
  usersById.set(u.id, u);
  usersByEmail.set(u.email, u);
}

function seedSession(
  rawToken: string,
  userId: string,
  opts: { expiresInMs?: number; isActive?: boolean } = {},
) {
  const hashed = createHash("sha256").update(rawToken).digest("hex");
  sessions.push({
    id: `sess-${sessions.length + 1}`,
    userId,
    accessToken: hashed,
    accessTokenExpiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60_000)),
    isActive: opts.isActive ?? true,
  });
}

// db.select() is called by both `inferSessionProvider` (await where()) and
// `resolveGcipUser` (where().limit(1)). We can't introspect drizzle's SQL
// fragment, so we side-channel: when `expectedUserId` is set we filter to
// that user's links (for inferSessionProvider tests); otherwise we return
// all links (resolveGcipUser only seeds one matching row per test). The
// returned object is a thenable AND exposes `.limit(n)`.
let expectedUserId: string | null = null;
(db as any).select = () => ({
  from: (_t: any) => ({
    where: (_w: any) => {
      const rows = expectedUserId
        ? links.filter((l) => l.userId === expectedUserId)
        : links.slice();
      const obj: any = {
        limit: async (_n: number) => rows,
        then: (resolve: any, reject: any) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return obj;
    },
  }),
});

(storage as any).getUserSessionByAccessToken = async (hashed: string) => {
  return sessions.find((s) => s.accessToken === hashed) ?? null;
};
(storage as any).updateUserSessionActivity = async (_id: string) => {
  activityUpdates += 1;
};
(storage as any).getUser = async (id: string) => usersById.get(id);
(storage as any).getUserByEmail = async (email: string) => usersByEmail.get(email);
(storage as any).createUser = async (u: any) => {
  const created: StoredUser = {
    id: `user-auto-${usersById.size + 1}`,
    email: u.email,
    name: u.name,
  };
  seedUser(created);
  return created;
};

// gcip.ts touches lastSeenAt on resolve via db.update(); also calls
// db.insert() during auto-provision. Stub both as no-ops.
(db as any).update = (_t: any) => ({
  set: (_v: any) => ({ where: async (_w: any) => undefined }),
});
(db as any).insert = (_t: any) => ({
  values: (_v: any) => ({ onConflictDoNothing: async () => undefined }),
});

// ---------------------------------------------------------------------------
// Mock Express req/res
// ---------------------------------------------------------------------------

function makeReqRes(authHeader?: string) {
  const reqHeaders: Record<string, any> = {};
  if (authHeader) reqHeaders["authorization"] = authHeader;
  const req: any = { headers: reqHeaders };
  const resHeaders: Record<string, string> = {};
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    setHeader(name: string, value: string) {
      resHeaders[name.toLowerCase()] = value;
    },
  };
  res.getHeader = (name: string) => resHeaders[name.toLowerCase()];
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return {
    req,
    res,
    next,
    nextWasCalled: () => nextCalled,
  };
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
// Tests
// ---------------------------------------------------------------------------

async function testNoAuthHeader() {
  resetAll();
  const { req, res, next, nextWasCalled } = makeReqRes();
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "next() must not be called");
  assertEq(res.statusCode, 401, "missing header → 401");
  assertEq(res.body?.error, "Unauthorized", "401 body has Unauthorized error");
}

async function testNonBearerHeader() {
  resetAll();
  const { req, res, next, nextWasCalled } = makeReqRes("Basic dXNlcjpwYXNz");
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "next() must not be called");
  assertEq(res.statusCode, 401, "non-Bearer scheme → 401");
  assertEq(res.body?.error, "Unauthorized", "non-Bearer body has Unauthorized");
}

async function testMalformedShortBearer() {
  resetAll();
  const { req, res, next, nextWasCalled } = makeReqRes("Bearer short");
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "next() must not be called");
  assertEq(res.statusCode, 401, "short bearer → 401");
  assertEq(res.body?.error, "Invalid token", "short bearer body has Invalid token");
}

async function testValidGcipJwt() {
  resetAll();
  seedUser({ id: "user-gcip", email: "gcip-mw@example.com", name: "Gcip MW" });
  // Pre-link the GCIP sub to the existing user so resolveGcipUser short-
  // circuits via the external_identities lookup (avoids the auto-link path).
  links.push({
    id: "l-gcip-mw",
    userId: "user-gcip",
    provider: "gcip",
    externalSub: "gcip-mw-good-sub",
    email: "gcip-mw@example.com",
    emailVerified: true,
  });

  const token = await makeGcipToken({
    sub: "gcip-mw-good-sub",
    email: "gcip-mw@example.com",
    email_verified: true,
  });
  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${token}`);
  await mw.requireAuth(req, res, next);

  assertEq(nextWasCalled(), true, "valid GCIP token → next() called");
  assertEq(res.statusCode, 0, "no status set on success");
  assertEq((req as any)._authProvider, "gcip", "_authProvider === gcip");
  assertEq((req as any)._authenticatedUserId, "user-gcip", "user id propagated");
  assertEq(req.headers["x-user-id"], "user-gcip", "x-user-id request header set");
  assertEq(res.getHeader("x-auth-provider"), "gcip", "x-auth-provider response header set");
}

async function testValidSessionTokenWithGcipLink() {
  resetAll();
  seedUser({ id: "user-sess-gcip", email: "s1@example.com", name: "S1" });
  links.push({
    id: "l1",
    userId: "user-sess-gcip",
    provider: "gcip",
    externalSub: "gcip-sub-s1",
    email: "s1@example.com",
    emailVerified: true,
  });
  // Use a token that LOOKS like an opaque session, not a JWT, so the GCIP
  // fast-path is bypassed. 64-char hex matches the production format
  // (randomBytes(32).toString("hex")) and has no dots.
  const rawToken = "a".repeat(64);
  seedSession(rawToken, "user-sess-gcip");
  expectedUserId = "user-sess-gcip";

  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${rawToken}`);
  await mw.requireAuth(req, res, next);

  assertEq(nextWasCalled(), true, "valid session → next() called");
  assertEq(
    (req as any)._authProvider,
    "gcip",
    "session for gcip-linked user → _authProvider inferred as gcip",
  );
  assertEq(
    (req as any)._authenticatedUserId,
    "user-sess-gcip",
    "session resolves to correct user",
  );
  assertEq(res.getHeader("x-auth-provider"), "gcip", "response header tagged gcip");
  // fire-and-forget activity update may race; allow a tick
  await new Promise((r) => setTimeout(r, 10));
  assert(activityUpdates >= 1, "session activity touched");
}

async function testValidSessionTokenWithoutGcipLink() {
  resetAll();
  seedUser({ id: "user-sess-plain", email: "s2@example.com", name: "S2" });
  // No links at all → inferSessionProvider returns "session".
  const rawToken = "b".repeat(64);
  seedSession(rawToken, "user-sess-plain");
  expectedUserId = "user-sess-plain";

  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${rawToken}`);
  await mw.requireAuth(req, res, next);

  assertEq(nextWasCalled(), true, "valid session → next() called");
  assertEq(
    (req as any)._authProvider,
    "session",
    "session for non-federated user → _authProvider === session",
  );
  assertEq(res.getHeader("x-auth-provider"), "session", "response header tagged session");
}

async function testExpiredSessionToken() {
  resetAll();
  seedUser({ id: "user-expired", email: "exp@example.com", name: "Exp" });
  const rawToken = "c".repeat(64);
  seedSession(rawToken, "user-expired", { expiresInMs: -60_000 });

  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${rawToken}`);
  await mw.requireAuth(req, res, next);

  assertEq(nextWasCalled(), false, "expired session must NOT call next()");
  assertEq(res.statusCode, 401, "expired session → 401");
  assertEq(res.body?.error, "Token expired", "expired body error");
  assertEq(res.body?.code, "TOKEN_EXPIRED", "expired body code === TOKEN_EXPIRED");
}

async function testUnknownOpaqueToken() {
  resetAll();
  // No session seeded → storage lookup returns null.
  const rawToken = "d".repeat(64);
  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${rawToken}`);
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "unknown token must NOT call next()");
  assertEq(res.statusCode, 401, "unknown opaque token → 401");
  assertEq(res.body?.error, "Unauthorized", "unknown token body has Unauthorized");
}

async function testBadlySignedJwtFallsThroughTo401() {
  resetAll();
  // A JWT signed with the wrong key fails GCIP verification, then the
  // session lookup also misses (hash doesn't match any seeded session) → 401.
  const token = await makeGcipToken({ sub: "x", signWith: WRONG_KEY });
  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${token}`);
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "bad-sig JWT must NOT call next()");
  assertEq(res.statusCode, 401, "bad-sig JWT → 401");
  assertEq(res.body?.error, "Unauthorized", "bad-sig body has Unauthorized");
}

async function testExpiredGcipJwtFallsThroughTo401() {
  resetAll();
  // GCIP verification returns null for expired tokens; the session fallback
  // also misses → 401. This guards against accidentally accepting expired
  // Firebase ID tokens via the catch-all session path.
  const token = await makeGcipToken({
    sub: "x",
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const { req, res, next, nextWasCalled } = makeReqRes(`Bearer ${token}`);
  await mw.requireAuth(req, res, next);
  assertEq(nextWasCalled(), false, "expired JWT must NOT call next()");
  assertEq(res.statusCode, 401, "expired JWT → 401");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS: Array<[string, () => Promise<void>]> = [
  ["no Authorization header → 401 Unauthorized", testNoAuthHeader],
  ["non-Bearer scheme → 401 Unauthorized", testNonBearerHeader],
  ["short Bearer token → 401 Invalid token", testMalformedShortBearer],
  ["valid GCIP JWT → next(), _authProvider=gcip", testValidGcipJwt],
  ["bad-signature GCIP JWT → 401 Unauthorized", testBadlySignedJwtFallsThroughTo401],
  ["expired GCIP JWT → 401 Unauthorized", testExpiredGcipJwtFallsThroughTo401],
  [
    "valid session token, user gcip-linked → next(), _authProvider=gcip",
    testValidSessionTokenWithGcipLink,
  ],
  [
    "valid session token, no federated link → next(), _authProvider=session",
    testValidSessionTokenWithoutGcipLink,
  ],
  ["expired session token → 401 TOKEN_EXPIRED", testExpiredSessionToken],
  ["unknown opaque token → 401 Unauthorized", testUnknownOpaqueToken],
];

export async function run(): Promise<{ pass: number; fail: number }> {
  await setupModules();
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
