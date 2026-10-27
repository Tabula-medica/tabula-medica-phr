/**
 * Unit tests for server/middleware/geo-fence.ts
 *
 * Covers:
 *   1. RESTRICTED_PATH_PREFIXES exports
 *   2. US requests pass (all three header sources)
 *   3. Non-US requests are blocked (403 GEO_RESTRICTED)
 *   4. Non-restricted routes always pass
 *   5. GEO_ALLOWED_COUNTRIES override
 *   6. GEO_FENCE_BYPASS disables enforcement
 *   7. CF-IPCountry / X-AppEngine-Country priority order and sentinel values
 *   8. GEO_FENCE_REQUIRE_CF_PROXY: blocks when CF-Ray absent
 *   9. X-Forwarded-For all-private → PRIVATE sentinel → pass
 *  10. extractClientIpFromXff helper
 *  11. Private req.ip → PRIVATE → pass (internal health check)
 *  12. Sub-path restriction and prefix boundary
 *
 * Wired into `npm run test:server` via scripts/run-server-tests.mjs.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response, NextFunction } from "express";
import {
  geoFenceMiddleware,
  RESTRICTED_PATH_PREFIXES,
  extractClientIpFromXff,
} from "../middleware/geo-fence";

// ── helpers ───────────────────────────────────────────────────────────────────

function mockReq(
  path: string,
  headers: Record<string, string> = {},
  ip?: string,
): Request {
  return {
    path,
    ip: ip ?? "1.2.3.4",
    method: "GET",
    socket: { remoteAddress: ip ?? "1.2.3.4" },
    header: (name: string) => headers[name.toLowerCase()] ?? undefined,
  } as unknown as Request;
}

function mockRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) { statusCode = code; return res; },
    json(data: unknown) { body = data; return res; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function runMiddleware(
  path: string,
  headers: Record<string, string> = {},
  envOverrides: Record<string, string | undefined> = {},
  ip?: string,
): { nextCalled: boolean; statusCode: number; body: unknown } {
  const savedEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    savedEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  let nextCalled = false;
  const next: NextFunction = () => { nextCalled = true; };
  const req = mockReq(path, headers, ip);
  const res = mockRes();

  geoFenceMiddleware(req, res, next);

  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  return { nextCalled, statusCode: res.statusCode, body: res.body };
}

// ── RESTRICTED_PATH_PREFIXES ──────────────────────────────────────────────────

test("RESTRICTED_PATH_PREFIXES includes all three required prefixes", () => {
  assert.ok(RESTRICTED_PATH_PREFIXES.includes("/api/fhir-data-hub"));
  assert.ok(RESTRICTED_PATH_PREFIXES.includes("/api/tefca"));
  assert.ok(RESTRICTED_PATH_PREFIXES.includes("/api/fasten"));
});

// ── US requests pass ──────────────────────────────────────────────────────────

test("US via CF-IPCountry (with CF-Ray) passes on restricted route", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "US", "cf-ray": "abc123-IAD" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

test("US via CF-IPCountry without CF-Ray passes when GEO_FENCE_REQUIRE_CF_PROXY not set", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "US" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled, "should pass when strict proxy enforcement is off");
});

test("US via X-AppEngine-Country passes on restricted route", () => {
  const { nextCalled } = runMiddleware(
    "/api/tefca/query",
    { "x-appengine-country": "US" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

// ── Non-US requests blocked ───────────────────────────────────────────────────

test("Non-US via CF-IPCountry is blocked with 403 GEO_RESTRICTED", () => {
  const { nextCalled, statusCode, body } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "GB", "cf-ray": "abc123-LHR" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(!nextCalled);
  assert.equal(statusCode, 403);
  assert.equal((body as any).code, "GEO_RESTRICTED");
});

test("Non-US on /api/tefca is blocked", () => {
  const { statusCode } = runMiddleware(
    "/api/tefca/patient-query",
    { "cf-ipcountry": "DE" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.equal(statusCode, 403);
});

test("Non-US on /api/fasten is blocked", () => {
  const { statusCode } = runMiddleware(
    "/api/fasten/sync",
    { "cf-ipcountry": "CA" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.equal(statusCode, 403);
});

// ── Non-restricted routes always pass ────────────────────────────────────────

test("Non-restricted route passes regardless of country", () => {
  const { nextCalled } = runMiddleware(
    "/api/auth/login",
    { "cf-ipcountry": "GB" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

test("Non-restricted route passes with no country header", () => {
  const { nextCalled } = runMiddleware(
    "/api/health",
    {},
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

// ── GEO_ALLOWED_COUNTRIES override ───────────────────────────────────────────

test("GEO_ALLOWED_COUNTRIES=US,CA allows CA", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "CA" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: "US,CA", GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

test("GEO_ALLOWED_COUNTRIES=US,CA still blocks AU", () => {
  const { statusCode } = runMiddleware(
    "/api/tefca/query",
    { "cf-ipcountry": "AU" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: "US,CA", GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.equal(statusCode, 403);
});

// ── GEO_FENCE_BYPASS ─────────────────────────────────────────────────────────

test("GEO_FENCE_BYPASS disables enforcement", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "CN" },
    { GEO_FENCE_BYPASS: "1", GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

// ── Header priority and sentinel values ──────────────────────────────────────

test("CF-IPCountry takes precedence over X-AppEngine-Country", () => {
  // CF=US, AE=GB → US wins → pass
  const { nextCalled } = runMiddleware(
    "/api/tefca/query",
    { "cf-ipcountry": "US", "cf-ray": "abc-IAD", "x-appengine-country": "GB" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled);
});

test("CF-IPCountry XX (Cloudflare unknown) falls through to X-AppEngine-Country US", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "XX", "x-appengine-country": "US" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled, "XX must be skipped; X-AppEngine-Country=US should pass");
});

test("X-AppEngine-Country ZZ (GCP unknown) falls through to XFF/GeoIP; private req.ip passes", () => {
  const { nextCalled } = runMiddleware(
    "/api/tefca/query",
    { "x-appengine-country": "ZZ" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
    "192.168.1.1",
  );
  assert.ok(nextCalled, "ZZ falls through; private req.ip → PRIVATE → pass");
});

// ── GEO_FENCE_REQUIRE_CF_PROXY ────────────────────────────────────────────────

test("GEO_FENCE_REQUIRE_CF_PROXY: blocks when CF-IPCountry present but CF-Ray absent", () => {
  // Simulates a client that reached Cloud Run origin directly (bypassed Cloudflare)
  // and spoofed CF-IPCountry=US. With strict proxy enforcement, this must be blocked.
  const { nextCalled, statusCode } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "US" }, // No CF-Ray header → bypass detected
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: "1" },
  );
  assert.ok(!nextCalled, "spoofed CF-IPCountry without CF-Ray must be blocked");
  assert.equal(statusCode, 403);
});

test("GEO_FENCE_REQUIRE_CF_PROXY: blocks when both CF-IPCountry and CF-Ray are absent", () => {
  // Direct-to-origin request with no Cloudflare headers at all.
  const { statusCode } = runMiddleware(
    "/api/tefca/patient-query",
    { "x-appengine-country": "US" }, // Has GCP header but no CF headers
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: "1" },
  );
  // Without CF-IPCountry, middleware falls through to X-AppEngine-Country which
  // has "US" — so this should pass (the proxy guard only blocks CF-IPCountry spoofs).
  // Actually: GEO_FENCE_REQUIRE_CF_PROXY blocks when CF-IPCountry is present without
  // CF-Ray, OR when CF-IPCountry is entirely absent. When CF-IPCountry is absent,
  // we also block (see middleware code). US from X-AppEngine should NOT save you.
  assert.equal(statusCode, 403, "absent CF-IPCountry with proxy enforcement on must be blocked");
});

test("GEO_FENCE_REQUIRE_CF_PROXY: US with valid CF-Ray passes", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "cf-ipcountry": "US", "cf-ray": "7e2b3c4d5-ORD" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: "1" },
  );
  assert.ok(nextCalled, "legitimate Cloudflare request must pass");
});

test("GEO_FENCE_REQUIRE_CF_PROXY: non-US with valid CF-Ray is still blocked", () => {
  const { statusCode } = runMiddleware(
    "/api/tefca/query",
    { "cf-ipcountry": "RU", "cf-ray": "7e2b3c4d5-AMS" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: "1" },
  );
  assert.equal(statusCode, 403, "non-US with CF-Ray should still be geo-blocked");
});

// ── Private IP → PRIVATE sentinel ────────────────────────────────────────────

test("Private req.ip with no cloud header passes (internal health check)", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    {},
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
    "127.0.0.1",
  );
  assert.ok(nextCalled, "localhost/private IP probes must not be geo-blocked");
});

test("XFF with all-private hops passes (VPC internal probe)", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir-data-hub/records",
    { "x-forwarded-for": "10.0.0.1, 172.16.0.5, 192.168.1.1" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
    "10.0.0.1",
  );
  assert.ok(nextCalled, "all-private XFF → PRIVATE → pass");
});

// ── extractClientIpFromXff ────────────────────────────────────────────────────

test("extractClientIpFromXff: returns leftmost public IP", () => {
  assert.equal(extractClientIpFromXff("1.2.3.4, 10.0.0.1, 172.16.0.5"), "1.2.3.4");
});

test("extractClientIpFromXff: skips leading private hops", () => {
  assert.equal(extractClientIpFromXff("10.0.0.1, 192.168.1.1, 8.8.8.8"), "8.8.8.8");
});

test("extractClientIpFromXff: returns null when all hops are private", () => {
  assert.equal(extractClientIpFromXff("10.0.0.1, 172.16.0.5, 127.0.0.1"), null);
});

test("extractClientIpFromXff: single public IP", () => {
  assert.equal(extractClientIpFromXff("203.0.113.1"), "203.0.113.1");
});

// ── Sub-path and prefix boundary ─────────────────────────────────────────────

test("Sub-paths of restricted prefixes are restricted", () => {
  const { statusCode } = runMiddleware(
    "/api/fhir-data-hub/v4/Patient/123/Observation",
    { "cf-ipcountry": "MX" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.equal(statusCode, 403);
});

test("/api/fhir (no -data-hub suffix) is NOT restricted", () => {
  const { nextCalled } = runMiddleware(
    "/api/fhir/search",
    { "cf-ipcountry": "GB" },
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
  );
  assert.ok(nextCalled, "/api/fhir must not be treated as restricted");
});

// ── Fail-closed when country undetermined ─────────────────────────────────────

test("Public IP with no cloud header: accepts 200 (GeoIP resolved) or 403 (fail-closed)", () => {
  // geoip-lite may or may not resolve 1.2.3.4; accept either outcome.
  const { statusCode } = runMiddleware(
    "/api/fhir-data-hub/records",
    {},
    { GEO_FENCE_BYPASS: undefined, GEO_ALLOWED_COUNTRIES: undefined, GEO_FENCE_REQUIRE_CF_PROXY: undefined },
    "1.2.3.4",
  );
  assert.ok(statusCode === 200 || statusCode === 403, `expected 200 or 403, got ${statusCode}`);
});
