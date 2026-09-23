/**
 * Sanity check for the session-injection fixture itself (e2e/fixtures).
 * If this fails, every other authenticated test's failure is suspect —
 * fix this one first.
 */
import { test, expect } from "./fixtures/auth-fixtures";

test("authenticatedPage carries a real server-recognized session", async ({ authenticatedPage, testUser }) => {
  const res = await authenticatedPage.request.get("/api/auth/user");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body?.id, JSON.stringify(body)).toBe(testUser.sub);
  expect(body?.email).toBe(testUser.email);
});

test("authenticatedPage can read its own longevity entries (200, not 401)", async ({ authenticatedPage }) => {
  const res = await authenticatedPage.request.get("/api/longevity-preventive/entries");
  expect(res.status()).toBe(200);
});
