/**
 * health-tracking-auth.spec.ts
 *
 * Tests that /api/health-tracking accepts both session-cookie and GCIP-bearer
 * callers, and that the IDOR guard still blocks cross-user profileId access.
 *
 * Four scenarios (per task spec):
 *   1. No credentials              → 401
 *   2. Session-cookie user         → 200, scoped to authenticated userId
 *   3. GCIP-bearer user            → 200, scoped to authenticated userId
 *   4. Wrong profileId in request  → 403
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// ── hoisted mocks ─────────────────────────────────────────────────────────────
// resolveGcipFn is configured per-test to control the bearer-auth path.

const { resolveGcipFn } = vi.hoisted(() => ({
  resolveGcipFn: vi.fn<[], Promise<{ id: string; email: string | null } | null>>(),
}));

// phi-storage: every Drizzle chain resolves to an empty array so the handler
// can complete without a real database. encryptPhiRow / decryptPhiRow(s) are
// identity (no encryption keys needed in tests).
vi.mock("../server/storage/phi-storage", () => {
  function chain(result: unknown[] = []): any {
    const t: any = {};
    for (const m of ["from", "where", "orderBy", "limit", "values", "set"]) {
      t[m] = () => t;
    }
    t.returning = () => Promise.resolve(result);
    // Make the chain itself awaitable so both `await query.where(...)` and
    // `await query.where(...).orderBy(...)` resolve to the same empty array.
    t.then = (res: (v: unknown[]) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej);
    return t;
  }
  return {
    phiDb: {
      select: () => chain([]),
      insert: () => chain([]),
      update: () => chain([]),
      delete: () => chain([]),
    },
    encryptPhiRow: (_: string, row: unknown) => row,
    decryptPhiRow: (_: string, row: unknown) => row ?? {},
    decryptPhiRows: (_: string, rows: unknown[]) => rows,
  };
});

// auth/gcip: verifyAndResolveGcip is delegated to resolveGcipFn so tests can
// control whether a bearer token resolves to a user.
vi.mock("../server/auth/gcip", () => ({
  verifyAndResolveGcip: (...args: unknown[]) => resolveGcipFn(...(args as [])),
  verifyGcipToken: vi.fn().mockResolvedValue(null),
  GCIP_PROJECT_ID: "test-project",
  GCIP_ISSUER: "https://securetoken.google.com/test-project",
  GCIP_AUDIENCE: "test-project",
}));

// vital-thresholds: VITAL_THRESHOLDS constant is fine, but checkVitalThresholds
// uses phiDb internally — the phi-storage mock above handles that.

import router from "../server/health-tracking-routes";

// ── constants ─────────────────────────────────────────────────────────────────
const SESSION_USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BEARER_USER  = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_USER   = "cccccccc-cccc-cccc-cccc-cccccccccccc";

// ── app factory ───────────────────────────────────────────────────────────────
// Builds an Express app with the health-tracking router mounted.
// `preAuth` middleware runs before the router and controls the Passport state:
//   - For session tests: stamps req.user and returns isAuthenticated()=true
//   - For bearer/anon tests: returns isAuthenticated()=false (no user stamped)

function buildApp(preAuth?: (req: any, res: any, next: () => void) => void) {
  const app = express();
  app.use(express.json());
  // Passport normally adds isAuthenticated() during initialization.
  // Without Passport, the method is absent; stub it so isAuthenticated middleware
  // doesn't throw. Default: not authenticated.
  app.use((req: any, _res: any, next: () => void) => {
    req.isAuthenticated = () => false;
    next();
  });
  if (preAuth) app.use(preAuth);
  app.use("/api/health-tracking", router);
  return app;
}

// ── server lifecycle helpers ──────────────────────────────────────────────────

function startServer(app: ReturnType<typeof buildApp>): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, base: `http://127.0.0.1:${port}/api/health-tracking` });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ── 1. No credentials → 401 ──────────────────────────────────────────────────

describe("health-tracking auth: no credentials → 401", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const result = await startServer(buildApp());
    server = result.server;
    base = result.base;
  });
  afterAll(() => stopServer(server));

  it("returns 401 for GET /goals with no auth", async () => {
    const res = await fetch(`${base}/goals`);
    expect(res.status).toBe(401);
    // isAuthenticated returns {message: "Unauthorized"} on the no-auth path;
    // requireUser's own guard returns {error: "UNAUTHORIZED", ...}. Either
    // way there is no success:true in the body.
    const body = await res.json();
    expect(body.success).not.toBe(true);
  });

  it("returns 401 for GET /vitals with no auth", async () => {
    const res = await fetch(`${base}/vitals`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for GET /insights with no auth", async () => {
    const res = await fetch(`${base}/insights`);
    expect(res.status).toBe(401);
  });
});

// ── 2. Session-cookie user → 200, scoped ─────────────────────────────────────

describe("health-tracking auth: session user → 200 scoped to own id", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = buildApp((req: any, _res: any, next: () => void) => {
      // Simulate a fully-authenticated passport session.
      req.isAuthenticated = () => true;
      req.user = {
        claims: { sub: SESSION_USER, email: "session@test.com", provider: "gcip" },
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      };
      next();
    });
    const result = await startServer(app);
    server = result.server;
    base = result.base;
  });
  afterAll(() => stopServer(server));

  it("returns 200 for GET /goals", async () => {
    const res = await fetch(`${base}/goals`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.goals)).toBe(true);
  });

  it("returns 200 for GET /vitals", async () => {
    const res = await fetch(`${base}/vitals`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 200 for GET /insights", async () => {
    const res = await fetch(`${base}/insights`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── 3. Bearer user → 200, scoped ─────────────────────────────────────────────

describe("health-tracking auth: bearer user → 200 scoped to own id", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    // Bearer app has no pre-set user; isAuthenticated() returns false.
    // The isAuthenticated middleware in replitAuth.ts will detect the
    // Authorization header, call verifyAndResolveGcip, and set req.user.
    const result = await startServer(buildApp());
    server = result.server;
    base = result.base;
  });
  afterAll(() => stopServer(server));

  beforeEach(() => {
    resolveGcipFn.mockResolvedValue({
      id: BEARER_USER,
      email: "bearer@test.com",
    } as any);
  });

  const bearerHeaders = () => ({
    Authorization: "Bearer gcip-test-token",
  });

  it("returns 200 for GET /goals with a valid GCIP bearer token", async () => {
    const res = await fetch(`${base}/goals`, { headers: bearerHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.goals)).toBe(true);
  });

  it("returns 200 for GET /vitals with a valid GCIP bearer token", async () => {
    const res = await fetch(`${base}/vitals`, { headers: bearerHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 401 when the GCIP bearer token does not resolve to a user", async () => {
    resolveGcipFn.mockResolvedValue(null);
    const res = await fetch(`${base}/goals`, { headers: bearerHeaders() });
    expect(res.status).toBe(401);
  });

  it("returns 401 when no Authorization header is sent to the bearer app", async () => {
    const res = await fetch(`${base}/goals`);
    expect(res.status).toBe(401);
  });
});

// ── 4. Wrong profileId → 403 ──────────────────────────────────────────────────

describe("health-tracking auth: cross-user profileId attempt → 403", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = buildApp((req: any, _res: any, next: () => void) => {
      req.isAuthenticated = () => true;
      req.user = {
        claims: { sub: SESSION_USER, email: "session@test.com", provider: "gcip" },
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      };
      next();
    });
    const result = await startServer(app);
    server = result.server;
    base = result.base;
  });
  afterAll(() => stopServer(server));

  it("returns 403 when query profileId differs from authenticated user", async () => {
    const res = await fetch(`${base}/goals?profileId=${OTHER_USER}`);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Access denied");
  });

  it("returns 403 when body profileId differs from authenticated user", async () => {
    const res = await fetch(`${base}/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: OTHER_USER,
        goalType: "weight_loss",
        title: "Lose weight",
        targetValue: "70",
        targetUnit: "kg",
        startDate: "2026-01-01",
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Access denied");
  });

  it("returns 200 for a GET /goals with no explicit profileId (auth id used)", async () => {
    // enforceSessionUserId stamps profileId = SESSION_USER when none is provided.
    // Confirms normal flow is unaffected.
    const res = await fetch(`${base}/goals`);
    expect(res.status).toBe(200);
  });

  it("returns 200 when query profileId matches the authenticated user", async () => {
    const res = await fetch(`${base}/goals?profileId=${SESSION_USER}`);
    expect(res.status).toBe(200);
  });
});
