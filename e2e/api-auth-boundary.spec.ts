/**
 * API auth-boundary tests.
 *
 * These hit the HTTP API directly (no browser session, no cookies) and
 * assert the server enforces access control itself. This matters because
 * the client is not a trust boundary here (see use-auth.ts / my-health-record
 * .tsx — pages render without checking auth client-side); every PHI-bearing
 * route must reject an unauthenticated caller on its own.
 *
 * Add a new route to PROTECTED_ENDPOINTS or PUBLIC_ENDPOINTS whenever you add
 * one — an endpoint that's neither reviewed here nor exercised by another
 * test is exactly the kind of gap that ships an IDOR.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Endpoints that touch a specific user's data and MUST reject an
 * unauthenticated request. 401 or 403 both count as "rejected" — routers in
 * this codebase use both depending on age.
 */
const PROTECTED_ENDPOINTS: Array<{ method: "GET" | "POST" | "PUT" | "DELETE"; path: string; body?: unknown }> = [
  { method: "GET", path: "/api/longevity-preventive/entries" },
  { method: "PUT", path: "/api/longevity-preventive/entries", body: {} },
];

/**
 * Endpoints that are deliberately public / anonymous by design — listed
 * explicitly so a reviewer can see the "public" decision was intentional,
 * not a gap. Each should still avoid echoing anything user-identifying.
 */
const PUBLIC_ENDPOINTS: Array<{ method: "GET" | "POST"; path: string; body?: unknown }> = [
  { method: "GET", path: "/api/longevity-preventive/protocol" },
  {
    method: "POST",
    path: "/api/longevity-preventive/plan",
    body: { profile: { age: 52, sex: "female" }, region: "us" },
  },
  {
    method: "POST",
    path: "/api/longevity-preventive/assess",
    body: { sex: "female", values: [{ id: "apob", value: 90 }] },
  },
  // Session probe: must resolve (200) with a null/empty user, not error,
  // so the client can distinguish "checked, logged out" from "check failed".
  { method: "GET", path: "/api/auth/user" },
];

async function request(ctx: APIRequestContext, method: string, path: string, body?: unknown) {
  const opts = body !== undefined ? { data: body } : undefined;
  switch (method) {
    case "GET":
      return ctx.get(path);
    case "POST":
      return ctx.post(path, opts);
    case "PUT":
      return ctx.put(path, opts);
    case "DELETE":
      return ctx.delete(path);
    default:
      throw new Error(`Unsupported method ${method}`);
  }
}

test.describe("API auth boundary — unauthenticated caller", () => {
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`${ep.method} ${ep.path} is rejected without a session`, async ({ request: ctx }) => {
      const res = await request(ctx, ep.method, ep.path, ep.body);
      expect([401, 403], `expected ${ep.method} ${ep.path} to reject an unauthenticated caller, got ${res.status()}`).toContain(
        res.status(),
      );
      // Defense in depth: the rejection body shouldn't accidentally include
      // a stored value (e.g. from a previous session's data leaking via a
      // shared in-memory store keyed wrong).
      const text = await res.text();
      expect(text.length, "401/403 body should be short — an error, not a data payload").toBeLessThan(2000);
    });
  }

  for (const ep of PUBLIC_ENDPOINTS) {
    test(`${ep.method} ${ep.path} is reachable without a session (public by design)`, async ({ request: ctx }) => {
      const res = await request(ctx, ep.method, ep.path, ep.body);
      expect(res.status(), `expected ${ep.method} ${ep.path} to succeed for an anonymous caller`).toBeLessThan(400);
    });
  }

  test("GET /api/auth/user returns a JSON null, not a user record, when logged out", async ({ request: ctx }) => {
    const res = await ctx.get("/api/auth/user");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body, "unauthenticated /api/auth/user leaked a user object").toBeNull();
  });
});

test.describe("Longevity API — no cross-user data via client-supplied identifiers", () => {
  test("PUT /entries ignores any userId/patientId the caller tries to inject in the body", async ({ request: ctx }) => {
    // Without a session this is still a 401 (covered above), but this test
    // documents the intended invariant for when a session-cookie fixture is
    // added later: the server must derive the subject from req.user.claims
    // .sub (the session), never from the request body, or one authenticated
    // user could overwrite another's entries by naming their id in the body.
    const res = await ctx.put("/api/longevity-preventive/entries", {
      data: { userId: "some-other-users-id", patientId: "some-other-users-id", completions: { x: "2026-01-01" } },
    });
    expect(res.status()).toBe(401);
    // TODO(security): once a seeded second test account + session-cookie
    // fixture exists (see e2e/README.md), extend this into a real IDOR
    // check: log in as user A, PUT with patientId spoofed to user B, then
    // GET /entries as user B and assert A's write did not land there.
  });
});
