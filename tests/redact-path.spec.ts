/**
 * Path redaction tests.
 *
 * Round 11 found a share token in stdout for the second time, through a
 * different logger than round 5. The fix that matters is not the route change
 * — it is that every globally mounted path logger now goes through one
 * function. These tests pin that function's judgement, because the whole point
 * is that the next route to carry a secret in a URL is covered before anyone
 * notices it needs to be.
 */

import { describe, it, expect } from "vitest";
import { redactPath, pathWasRedacted, REDACTED } from "../server/security/redact-path";

const TOKEN = "Ab3dEf0123456789AbCdEf0123456789AbCdEf0123456789AbCd";

describe("capability tokens", () => {
  it("redacts the share token that reached stdout in round 11", () => {
    expect(redactPath(`/s/${TOKEN}`)).toBe(`/s/${REDACTED}`);
  });

  it("keeps the route structure so the audit record still says what was hit", () => {
    // A log line that loses the route is useless; one that keeps the secret is
    // dangerous. Structure stays, capability goes.
    expect(redactPath(`/s/${TOKEN}`)).toContain("/s/");
  });

  it("redacts a registered prefix even when the token is short", () => {
    // The prefix registry is authoritative and does not depend on entropy.
    expect(redactPath("/s/abc123")).toBe(`/s/${REDACTED}`);
  });

  it("leaves the bare prefix alone", () => {
    expect(redactPath("/s")).toBe("/s");
    expect(redactPath("/s/")).toBe("/s/");
  });

  it("reports whether anything was removed", () => {
    expect(pathWasRedacted(`/s/${TOKEN}`)).toBe(true);
    expect(pathWasRedacted("/api/health")).toBe(false);
  });
});

describe("the unregistered route nobody remembered", () => {
  it("redacts a high-entropy segment on a path with no registered prefix", () => {
    // The failure mode this file exists to break: a future capability route
    // added without touching the registry.
    expect(redactPath(`/download/${TOKEN}`)).toBe(`/download/${REDACTED}`);
  });

  it("redacts a token in a query string wholesale", () => {
    expect(redactPath(`/s/x?pin=123456&t=${TOKEN}`)).toContain("[redacted-query]");
    expect(redactPath(`/s/x?t=${TOKEN}`)).not.toContain(TOKEN);
  });
});

describe("what must NOT be redacted", () => {
  it("leaves a UUID intact", () => {
    // A UUID names a resource that still needs auth to reach. Redacting it
    // would destroy audit correlation and buy no real secrecy.
    const p = "/api/patients/3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(redactPath(p)).toBe(p);
  });

  it("leaves ordinary API routes untouched", () => {
    for (const p of [
      "/api/health",
      "/api/engagement/share/policy",
      "/api/care-management/evaluate",
      "/api/scribe/capabilities",
    ]) {
      expect(redactPath(p), p).toBe(p);
    }
  });

  it("leaves long lowercase route words alone", () => {
    // A run of letters is a word however long; requiring mixed shape keeps
    // legitimate long route names readable in the log.
    const p = "/api/comprehensivecareplanmanagement";
    expect(redactPath(p)).toBe(p);
  });

  it("leaves version and file segments alone", () => {
    expect(redactPath("/api/v1.2.3/status")).toBe("/api/v1.2.3/status");
  });

  it("handles an empty path without throwing", () => {
    expect(redactPath("")).toBe("");
    expect(redactPath("/")).toBe("/");
  });
});
