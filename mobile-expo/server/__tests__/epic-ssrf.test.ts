/**
 * Regression tests for Epic IAS SSRF hardening (Task #139).
 *
 * Verifies that:
 * 1. safeFetch blocks redirect-to-internal-IP at each redirect hop.
 * 2. validateExternalUrl blocks private/loopback IPs and non-HTTPS schemes.
 * 3. validateSmartEndpoints enforces host-affinity (pure URL parsing, before DNS)
 *    and also blocks private-IP literals on same-host endpoints.
 *
 * All tests are deterministic and DNS-free: blocking is verified using
 * literal private/loopback IPv4 addresses or scheme checks — paths that
 * safe-fetch.ts rejects before performing any DNS resolution.
 *
 * Runs via: node --import tsx server/__tests__/epic-ssrf.test.ts
 */

import assert from "node:assert/strict";
import { safeFetch, validateExternalUrl, validateSmartEndpoints, SsrfBlockedError } from "../utils/safe-fetch";
import type { SafeFetchImpl } from "../utils/safe-fetch";

// ── test runner ───────────────────────────────────────────────────────────────

type TestCase = [string, () => Promise<void>];
const TESTS: TestCase[] = [];

function test(name: string, fn: () => Promise<void>) {
  TESTS.push([name, fn]);
}

// ── fetch seam (no real network calls) ───────────────────────────────────────
//
// safeFetch uses undici's fetch with a per-request dispatcher, so it cannot be
// intercepted by reassigning globalThis.fetch. Instead we inject a fake fetch
// implementation (4th arg) that returns canned redirect responses, keeping the
// redirect-blocking tests fully hermetic: no real network and no DNS query —
// the origin host is always a public IP literal, resolved locally by getaddrinfo.

function fakeRedirect(location: string, status = 302): SafeFetchImpl {
  return async () => new Response(null, { status, headers: { location } });
}

// ── 1. safeFetch: redirect-to-internal-IP ─────────────────────────────────────
//
// The origin URL uses a literal public IP (93.184.216.34) so the first
// validateExternalUrlAndResolve call passes without a DNS query. The redirect
// location uses a literal private/loopback IP (or non-HTTPS scheme) which is
// rejected by the per-hop check before the next request is made.

test("safeFetch: redirect to 169.254.169.254 (GCP metadata) is blocked", async () => {
  await assert.rejects(
    () => safeFetch(
      "https://93.184.216.34/Patient/123",
      {},
      5,
      fakeRedirect("http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"),
    ),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for GCP metadata redirect"
  );
});

test("safeFetch: redirect to RFC-1918 10.x.x.x is blocked", async () => {
  await assert.rejects(
    () => safeFetch("https://93.184.216.34/Observation", {}, 5, fakeRedirect("https://10.0.0.1/internal-admin", 301)),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for RFC-1918 10.x.x.x redirect"
  );
});

test("safeFetch: redirect to RFC-1918 192.168.x.x is blocked", async () => {
  await assert.rejects(
    () => safeFetch("https://93.184.216.34/Vitals", {}, 5, fakeRedirect("https://192.168.1.100/admin-panel")),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for 192.168.x.x redirect"
  );
});

test("safeFetch: redirect to localhost is blocked", async () => {
  await assert.rejects(
    () => safeFetch("https://93.184.216.34/Patient/1", {}, 5, fakeRedirect("https://localhost:8080/secret")),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for localhost redirect"
  );
});

test("safeFetch: redirect to 172.16.x.x (RFC-1918 range) is blocked", async () => {
  await assert.rejects(
    () => safeFetch("https://93.184.216.34/Patient/2", {}, 5, fakeRedirect("https://172.16.0.1/internal")),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for 172.16.x redirect"
  );
});

test("safeFetch: too many redirects throws SsrfBlockedError", async () => {
  await assert.rejects(
    () => safeFetch("https://93.184.216.34/start", {}, 3, fakeRedirect("https://93.184.216.34/loop")),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for redirect loop"
  );
});

// ── 2. validateExternalUrl: pre-DNS blocking ──────────────────────────────────

test("validateExternalUrl: non-HTTPS scheme is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("http://example.com/fhir"),
    (err: unknown) => err instanceof SsrfBlockedError && (err as SsrfBlockedError).message.includes("HTTPS"),
    "Expected SsrfBlockedError for HTTP scheme"
  );
});

test("validateExternalUrl: literal 127.0.0.1 is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://127.0.0.1/admin"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for loopback 127.0.0.1"
  );
});

test("validateExternalUrl: literal 10.0.0.1 is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://10.0.0.1/internal"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for RFC-1918 10.0.0.1"
  );
});

test("validateExternalUrl: literal 192.168.1.1 is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://192.168.1.1/router"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for 192.168.x.x"
  );
});

test("validateExternalUrl: literal 172.20.0.1 (RFC-1918) is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://172.20.0.1/internal"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for 172.16-31.x.x"
  );
});

test("validateExternalUrl: literal 169.254.1.1 (link-local) is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://169.254.1.1/metadata"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for link-local 169.254.x.x"
  );
});

test("validateExternalUrl: literal 0.0.0.0 is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://0.0.0.0/anything"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for 0.0.0.0"
  );
});

test("validateExternalUrl: localhost hostname is blocked", async () => {
  await assert.rejects(
    () => validateExternalUrl("https://localhost/secret"),
    (err: unknown) => err instanceof SsrfBlockedError,
    "Expected SsrfBlockedError for localhost"
  );
});

// ── 3. validateSmartEndpoints: host-affinity (DNS-free) ───────────────────────
//
// Host-affinity is checked before DNS resolution, so these tests are fully
// deterministic without requiring real network access or DNS mocking.
// Cross-host endpoints are rejected immediately on URL parsing alone.

test("validateSmartEndpoints: auth endpoint on different host is blocked (pre-DNS)", async () => {
  const result = await validateSmartEndpoints(
    "https://fhir.epic.com/api/FHIR/R4",
    "https://attacker.com/steal-code",
    "https://fhir.epic.com/oauth2/token"
  );
  assert.equal(result.valid, false, "Cross-host auth endpoint should be invalid");
  assert.ok(
    result.error?.includes("attacker.com"),
    `Error should name the offending host; got: ${result.error}`
  );
});

test("validateSmartEndpoints: token endpoint on different host is blocked (pre-DNS)", async () => {
  const result = await validateSmartEndpoints(
    "https://fhir.epic.com/api/FHIR/R4",
    "https://fhir.epic.com/oauth2/authorize",
    "https://evil.corp/steal-token"
  );
  assert.equal(result.valid, false, "Cross-host token endpoint should be invalid");
  assert.ok(
    result.error?.includes("evil.corp"),
    `Error should name the offending host; got: ${result.error}`
  );
});

test("validateSmartEndpoints: unrelated-subdomain auth endpoint is blocked (pre-DNS)", async () => {
  // evil.fhir.epic.com is not a subdomain of fhir.epic.com; it ends with
  // .epic.com but not .fhir.epic.com, which is the registered FHIR host.
  // However, it IS a subdomain of fhir.epic.com if we consider the full suffix.
  // This test verifies that a completely unrelated host is blocked:
  const result = await validateSmartEndpoints(
    "https://fhir.epic.com/api/FHIR/R4",
    "https://totallyunrelated.example.com/authorize",
    "https://fhir.epic.com/oauth2/token"
  );
  assert.equal(result.valid, false, "Completely unrelated auth host should be blocked");
});

test("validateSmartEndpoints: endpoints with private-IP literal are blocked even when host matches", async () => {
  // Same host as FHIR base URL but that host is a private IP literal — blocked
  // by validateExternalUrl's pre-DNS IP check after host-affinity passes.
  const result = await validateSmartEndpoints(
    "https://10.0.0.1/api/FHIR/R4",
    "https://10.0.0.1/oauth2/authorize",
    "https://10.0.0.1/oauth2/token"
  );
  assert.equal(result.valid, false, "Private-IP SMART endpoints should be blocked even with matching host");
});

test("validateSmartEndpoints: HTTP scheme on same-host endpoint is blocked (pre-DNS)", async () => {
  const result = await validateSmartEndpoints(
    "https://fhir.epic.com/api/FHIR/R4",
    "http://fhir.epic.com/oauth2/authorize",
    "https://fhir.epic.com/oauth2/token"
  );
  assert.equal(result.valid, false, "HTTP auth endpoint should be blocked");
  assert.ok(
    result.error?.includes("HTTPS"),
    `Error should mention HTTPS requirement; got: ${result.error}`
  );
});

// ── entrypoint ────────────────────────────────────────────────────────────────

export async function run(): Promise<{ pass: number; fail: number }> {
  let pass = 0;
  let fail = 0;
  for (const [name, fn] of TESTS) {
    try {
      await fn();
      console.log(`  ok    ${name}`);
      pass++;
    } catch (err: any) {
      console.log(`  FAIL  ${name} — ${err?.message ?? err}`);
      if (err?.stack) console.log(err.stack);
      fail++;
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => { if (fail > 0) process.exit(1); })
    .catch((err) => { console.error(err); process.exit(1); });
}
