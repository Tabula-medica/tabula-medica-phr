/**
 * Regression tests — Portal Tenant Isolation (Task #183)
 *
 * Guards the security invariants introduced by the tenant-isolation fix:
 *
 *   1. Non-lossy migration key: md5(trim(organization)) is case-sensitive.
 *      "Acme Health", "ACME HEALTH", and "Acme-Health" each produce a
 *      different md5 value, so the migration assigns them separate tenants.
 *
 *   2. Dead slug-fallback: orgToSlug() and getOrCreateTenantId() no longer
 *      exist in portal-routes.ts as live function declarations.
 *
 *   3. Fail-closed source proof: getRequestTenantId() contains no reference
 *      to orgToSlug or getOrCreateTenantId — if either returns, the test
 *      would catch a reintroduction of the slug-fallback path.
 *
 *   4. Route-level tenant scoping (source proof): patient-count query in
 *      /dashboard/stats uses portalProviders.tenantId, not .organization.
 *
 *   5. Unauthenticated access to every patient-scoped portal route → 401.
 *      This exercises real route registration without needing a live DB:
 *      requirePortalAuth returns 401 on a missing Bearer token before any
 *      DB query runs.
 *
 * Run via: node --import tsx server/__tests__/portal-tenant-isolation.test.ts
 * Automatically picked up by: npm run test:server
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import express from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { registerPortalRoutes } from "../portal-routes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function md5TenantSlug(org: string): string {
  return "portal-org-" + createHash("md5").update(org.trim()).digest("hex");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PORTAL_ROUTES_SRC = join(__dirname, "..", "portal-routes.ts");

// ---------------------------------------------------------------------------
// 1. Unit tests — md5(trim(org)) is truly non-lossy (no DB required)
// ---------------------------------------------------------------------------

function testMigrationKeyNonLossy(): void {
  console.log("\n=== Migration key: md5(trim(org)) is case/punctuation-sensitive ===");

  const slugA  = md5TenantSlug("Acme Health");
  const slugA2 = md5TenantSlug("Acme Health");     // identical → same key
  const slugB  = md5TenantSlug("ACME HEALTH");      // case variant → different key
  const slugC  = md5TenantSlug("Acme-Health");      // punctuation variant → different key
  const slugD  = md5TenantSlug("  Acme Health  ");  // leading/trailing spaces → same as A
  const slugE  = md5TenantSlug("Acme  Health");     // internal extra space → different

  ok('Same string → same key',                    slugA  === slugA2);
  ok('"Acme Health" ≠ "ACME HEALTH" (case)',       slugA  !== slugB);
  ok('"Acme Health" ≠ "Acme-Health" (punct)',      slugA  !== slugC);
  ok('Leading/trailing spaces trimmed away',       slugA  === slugD);
  ok('Internal spaces NOT collapsed (non-lossy)',  slugA  !== slugE);
  ok('All slugs start with "portal-org-"',
    [slugA, slugB, slugC, slugD, slugE].every(s => s.startsWith("portal-org-")));
}

// ---------------------------------------------------------------------------
// 2. Source-code proofs — slug-fallback helpers removed; fail-closed confirmed
// ---------------------------------------------------------------------------

async function testSourceInvariants(): Promise<void> {
  console.log("\n=== Source invariants: slug fallback gone, fail-closed in place ===");

  const src = await readFile(PORTAL_ROUTES_SRC, "utf8");

  // Dead code: neither slug-fallback helper should exist as a function declaration
  ok("orgToSlug() function declaration is gone",
    !/^function orgToSlug\b/m.test(src));
  ok("getOrCreateTenantId() function declaration is gone",
    !/^async function getOrCreateTenantId\b/m.test(src));

  // Fail-closed: extract the getRequestTenantId function body and verify it
  // (a) does NOT call orgToSlug / getOrCreateTenantId
  // (b) DOES return 403 when tenantId is falsy
  const fnMatch = src.match(
    /async function getRequestTenantId[\s\S]*?^}/m,
  );
  const fn = fnMatch?.[0] ?? "";
  ok("getRequestTenantId body exists",        fn.length > 0);
  ok("No orgToSlug call in getRequestTenantId",
    !fn.includes("orgToSlug"));
  ok("No getOrCreateTenantId call in getRequestTenantId",
    !fn.includes("getOrCreateTenantId"));
  ok("getRequestTenantId returns 403 when tenantId is absent",
    fn.includes("403"));

  // Route-level scoping: dashboard/stats must query by tenantId, not adminOrg
  const statsRouteMatch = src.match(
    /router\.get\("\/dashboard\/stats"[\s\S]*?(?=router\.\w+\()/,
  );
  const statsHandler = statsRouteMatch?.[0] ?? "";
  ok("dashboard/stats handler found",
    statsHandler.length > 0);
  ok("dashboard/stats activeProviderCount scoped by tenantId (not adminOrg)",
    statsHandler.includes("tenantId") &&
    !statsHandler.includes("organization, adminOrg"));
}

// ---------------------------------------------------------------------------
// 3. HTTP-level: unauthenticated access returns 401 (no DB needed — the
//    requirePortalAuth middleware short-circuits before any DB query).
// ---------------------------------------------------------------------------

const PATIENT_SCOPED_ROUTES: Array<[string, string]> = [
  ["GET",  "/api/portal/dashboard/stats"],
  ["GET",  "/api/portal/patients"],
  ["GET",  "/api/portal/appointments"],
  ["GET",  "/api/portal/insights/summary"],
];

let server: Server;
let baseUrl: string;

async function setupUnauthServer(): Promise<void> {
  const app = express();
  app.use(express.json());
  registerPortalRoutes(app);

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((r) => server.close(() => r()));
}

async function testUnauthReturns401(): Promise<void> {
  console.log("\n=== Unauthenticated patient-scoped routes → 401 ===");

  for (const [method, path] of PATIENT_SCOPED_ROUTES) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
    });
    ok(`No auth ${method} ${path} → 401`, res.status === 401);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async () => {
  // Phase 1 — pure unit tests (no server, no DB)
  testMigrationKeyNonLossy();
  await testSourceInvariants();

  // Phase 2 — HTTP tests (unauthenticated paths only; no DB needed)
  try {
    await setupUnauthServer();
    await testUnauthReturns401();
  } catch (e: any) {
    console.error("Server setup or test error:", e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    failed++;
  } finally {
    try { await teardownServer(); } catch {}
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
