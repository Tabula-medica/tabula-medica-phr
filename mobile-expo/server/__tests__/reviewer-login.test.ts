/**
 * Regression test: reviewer login shortcut must remain active in production.
 *
 * Background
 * ----------
 * The reviewer shortcut in `POST /api/auth/login` was previously wrapped in
 * an `!IS_PRODUCTION` guard, which silently disabled it for Apple's App
 * Review team. That guard was removed, but no automated test blocked it from
 * being reintroduced.
 *
 * What these tests verify
 * -----------------------
 * 1. When REVIEWER_EMAIL + REVIEWER_PASSWORD are set AND IS_PRODUCTION = true
 *    (NODE_ENV=production), POST /api/auth/login with the reviewer credentials
 *    returns HTTP 200 with an `accessToken` — i.e. the shortcut is NOT
 *    gated behind `!IS_PRODUCTION`.
 * 2. When the reviewer env vars are absent, the shortcut block is a no-op and
 *    the same credentials return HTTP 401 — proving the block is inactive
 *    without the secrets.
 * 3. The authenticated session can verify itself via GET /api/auth/me.
 * 4. Demo data is seeded: GET /api/records returns ≥3 records.
 *
 * Wire-up
 * -------
 * NODE_ENV must be "production" before _shared.ts is evaluated so that the
 * IS_PRODUCTION constant captured in the closure is true. assertEnvPolicy()
 * in server/ai-client.ts only throws when NODE_ENV=production AND one of the
 * AI_INTEGRATIONS_* forbidden vars is present; we delete those from
 * process.env before the first import so the guard passes cleanly.
 *
 * Runs via:
 *   node --import tsx server/__tests__/reviewer-login.test.ts
 * Auto-picked up by `npm run test:server`.
 *
 * Live-endpoint complement
 * ------------------------
 * This file exercises the login route in isolation (in-process, fake DB row).
 * `scripts/smoke-test-reviewer-login.sh` is the paired live-endpoint check —
 * it POSTs against the real production URL with the actual CI secrets and
 * verifies the full round-trip (session, demo data, data sources).
 * Keep the two in sync: any new behavior added to `POST /api/auth/login`
 * (rate-limiting, IP allow-listing, new response fields, etc.) that the
 * shell script already covers should also be reflected here, and vice-versa.
 *
 * SYNC-CHECK tags
 * ---------------
 * Each behavioral assertion below is annotated with a machine-readable tag:
 *   // SYNC-CHECK: <id>
 *
 * The contract checker (server/__tests__/reviewer-login-contract.test.ts) reads
 * this file and scripts/smoke-test-reviewer-login.sh and verifies that every
 * non-(live-only) SYNC-CHECK tag in the shell script also appears here with a
 * matching assertion.  To ADD a new behavioral check to the shell script: add
 * a SYNC-CHECK tag there, add the same tag here with a real assertion, and CI
 * will enforce the pairing going forward.
 */

// ─── Step 1: pin env BEFORE any module is loaded ─────────────────────────────

process.env.NODE_ENV = "production";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

// assertEnvPolicy() in server/ai-client.ts refuses to boot when
// NODE_ENV=production and any AI_INTEGRATIONS_* var is present (Replit's AI
// Integration injects these at workspace level). Clear them so the guard
// passes; this is purely a test-env artefact and does not affect runtime
// routing (which goes through Vertex AI regardless).
const FORBIDDEN_AI_VARS = [
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
] as const;

const savedAiVars: Record<string, string | undefined> = {};
for (const v of FORBIDDEN_AI_VARS) {
  savedAiVars[v] = process.env[v];
  delete process.env[v];
}

// ─── Step 2: unique reviewer credentials for this test run ───────────────────

// Use a test-only email that won't collide with a real reviewer account.
const REVIEWER_EMAIL = `reviewer-regression-${Date.now()}@tabula-test.invalid`;
const REVIEWER_PASSWORD = `RegPass-${Math.random().toString(36).slice(2)}`;

// ─── Step 3: imports (after env is prepared) ─────────────────────────────────

import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { eq } from "drizzle-orm";

import { registerRoutes } from "../routes";
import { db } from "../db";
import { users } from "../../shared/schema";

// ─── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok    ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

async function getJson(
  baseUrl: string,
  path: string,
  accessToken: string,
): Promise<{ status: number; json: any }> {
  const res = await fetch(baseUrl + path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  let app: Express;
  let server: Server;
  let baseUrl = "";

  try {
    // Boot a real Express app with the full production route set.
    // process.env.NODE_ENV is already "production" so IS_PRODUCTION === true
    // inside the route closure.
    app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: false, limit: "1mb" }));
    await registerRoutes(app);
    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // ── Test 1: reviewer shortcut works when IS_PRODUCTION = true ────────────
    console.log("\n=== Reviewer login shortcut (IS_PRODUCTION = true) ===");

    process.env.REVIEWER_EMAIL = REVIEWER_EMAIL;
    process.env.REVIEWER_PASSWORD = REVIEWER_PASSWORD;

    const r1 = await postJson(baseUrl, "/api/auth/login", {
      email: REVIEWER_EMAIL,
      password: REVIEWER_PASSWORD,
    });

    // SYNC-CHECK: login-200
    ok(
      "reviewer login with IS_PRODUCTION=true → HTTP 200",
      r1.status === 200,
    );
    // SYNC-CHECK: access-token
    ok(
      "response contains accessToken",
      typeof r1.json?.accessToken === "string" && r1.json.accessToken.length > 0,
    );
    // SYNC-CHECK: user-id
    ok(
      "response contains user object",
      r1.json?.user != null && typeof r1.json.user.id === "string",
    );
    // SYNC-CHECK: refresh-token
    ok(
      "response contains refreshToken",
      typeof r1.json?.refreshToken === "string" && r1.json.refreshToken.length > 0,
    );

    const missingCredentials = await postJson(baseUrl, "/api/auth/login", {});
    // SYNC-CHECK: login-error
    ok(
      "missing credentials returns 400 with an error message",
      missingCredentials.status === 400 &&
        typeof missingCredentials.json?.error === "string" &&
        missingCredentials.json.error.length > 0,
    );

    // ── Test 2: authenticated session is valid (mirrors shell step 2) ────────
    console.log("\n=== Session verification via /api/auth/me ===");

    const accessToken: string = r1.json?.accessToken ?? "";

    if (accessToken) {
      const me = await getJson(baseUrl, "/api/auth/me", accessToken);
      // SYNC-CHECK: session-verify
      ok(
        "GET /api/auth/me with reviewer token → HTTP 200",
        me.status === 200,
      );
      ok(
        "/api/auth/me returns user object",
        me.json?.user != null || me.json?.id != null,
      );
    } else {
      console.warn("  SKIP  session-verify (no accessToken from login step)");
    }

    // ── Test 3: demo data is seeded — health records (mirrors shell step 3) ──
    console.log("\n=== Demo data check via /api/records ===");

    if (accessToken) {
      const records = await getJson(baseUrl, "/api/records", accessToken);
      const recordArray = Array.isArray(records.json) ? records.json : [];
      // SYNC-CHECK: demo-records
      ok(
        `GET /api/records returns ≥3 demo records (got ${recordArray.length})`,
        recordArray.length >= 3,
      );
    } else {
      console.warn("  SKIP  demo-records (no accessToken from login step)");
    }

    // ── Test 4: shortcut is a no-op when env vars are absent ─────────────────
    console.log("\n=== Reviewer shortcut absent when env vars unset ===");

    delete process.env.REVIEWER_EMAIL;
    delete process.env.REVIEWER_PASSWORD;

    // Remove the reviewer user so only the shortcut path could authenticate
    // these credentials (i.e. the normal bcrypt path has no user to match).
    await db.delete(users).where(eq(users.email, REVIEWER_EMAIL));

    // Same credentials, same IS_PRODUCTION, but no env vars and no user row
    // → shortcut is a no-op → normal auth path → 401.
    const r2 = await postJson(baseUrl, "/api/auth/login", {
      email: REVIEWER_EMAIL,
      password: REVIEWER_PASSWORD,
    });

    ok(
      "same credentials without env vars → HTTP 401 (shortcut inactive)",
      r2.status === 401,
    );

  } finally {
    // Restore env vars removed at the top of this file.
    for (const [k, v] of Object.entries(savedAiVars)) {
      if (v !== undefined) process.env[k] = v;
    }

    // Clean up any reviewer user created by the shortcut.
    try {
      await db.delete(users).where(eq(users.email, REVIEWER_EMAIL));
    } catch {
      // Best-effort cleanup — failure here doesn't affect test results.
    }

    if (server!) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((e) => {
  console.error("Test runner threw:", e);
  process.exit(1);
});
