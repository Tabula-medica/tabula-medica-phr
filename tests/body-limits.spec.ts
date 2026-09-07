import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  UNAUTHENTICATED_BODY_LIMITS,
  PASSPORT_VERIFY_BODY_LIMIT,
  WEBHOOK_BODY_LIMIT,
  bodyLimitFor,
} from "../server/security/body-limits";

/**
 * Round 13 found `POST /api/engagement/inbound` inheriting the global 10mb
 * parsers and running its Twilio signature check over the *parsed* params —
 * so an unsigned 10mb body was read, parsed and HMAC'd in full before being
 * rejected, on the process that also serves clinical routes.
 *
 * The reported route was one of three. `/api/world/ips/verify` had a cap;
 * `/api/engagement/inbound` and `/s/redeem` did not. These tests pin the
 * table, and pin that `server/index.ts` still mounts from it — because a
 * table nobody reads is documentation, not a control.
 */
describe("unauthenticated body limits", () => {
  const KB = 1024;

  function bytes(limit: string): number {
    const match = /^(\d+)(kb|mb)$/i.exec(limit);
    expect(match, `${limit} must be a plain kb/mb size`).not.toBeNull();
    const value = Number(match![1]);
    return match![2].toLowerCase() === "mb" ? value * KB * KB : value * KB;
  }

  it("covers every route that is reachable without credentials", () => {
    const paths = UNAUTHENTICATED_BODY_LIMITS.map((entry) => entry.path).sort();
    expect(paths).toEqual([
      "/api/engagement/inbound",
      "/api/world/ips/verify",
      "/s/redeem",
    ]);
  });

  it("keeps every cap far below the global 10mb allowance", () => {
    // The point of the table is that none of these is anywhere near the
    // upload-sized global limit. 1mb is a generous ceiling for a webhook.
    for (const entry of UNAUTHENTICATED_BODY_LIMITS) {
      expect(bytes(entry.limit), `${entry.path} is capped`).toBeLessThanOrEqual(
        1 * KB * KB,
      );
    }
  });

  it("gives the webhook routes the tighter of the two caps", () => {
    // A Twilio SMS body and a six-digit PIN are not a signed IPS document.
    expect(bytes(WEBHOOK_BODY_LIMIT)).toBeLessThan(
      bytes(PASSPORT_VERIFY_BODY_LIMIT),
    );
  });

  it("states why each route is reachable without credentials", () => {
    // A row without a reason is a row nobody can evaluate later.
    for (const entry of UNAUTHENTICATED_BODY_LIMITS) {
      expect(entry.reason.length, `${entry.path} explains itself`).toBeGreaterThan(20);
    }
  });

  describe("bodyLimitFor", () => {
    it("resolves each capped path to its own limit", () => {
      expect(bodyLimitFor("/api/engagement/inbound")?.limit).toBe(WEBHOOK_BODY_LIMIT);
      expect(bodyLimitFor("/s/redeem")?.limit).toBe(WEBHOOK_BODY_LIMIT);
      expect(bodyLimitFor("/api/world/ips/verify")?.limit).toBe(
        PASSPORT_VERIFY_BODY_LIMIT,
      );
    });

    it("returns null for a route the global cap governs", () => {
      expect(bodyLimitFor("/api/patients")).toBeNull();
      expect(bodyLimitFor("/api/engagement/consent")).toBeNull();
    });

    it("does not let a capped path claim a lookalike sibling", () => {
      // `/s/redeem` must not swallow `/s/redeemer`, and the share-token GET
      // route `/s/<token>` is not the redemption POST.
      expect(bodyLimitFor("/s/redeemer")).toBeNull();
      expect(bodyLimitFor("/s/abc123")).toBeNull();
      expect(bodyLimitFor("/api/world/ips/verifyer")).toBeNull();
    });

    it("still matches a sub-path of a capped mount", () => {
      // `app.use(path, ...)` covers everything beneath it, so the 413 message
      // has to resolve the same way the mount does.
      expect(bodyLimitFor("/s/redeem/confirm")?.limit).toBe(WEBHOOK_BODY_LIMIT);
    });
  });

  /**
   * The table only does anything if `server/index.ts` mounts from it. Importing
   * that module would boot the server, so this reads the source instead — the
   * one thing a unit test cannot otherwise observe.
   */
  describe("server/index.ts wiring", () => {
    const source = readFileSync(
      new URL("../server/index.ts", import.meta.url),
      "utf8",
    );

    it("mounts the capped parsers from the table", () => {
      expect(source).toContain("UNAUTHENTICATED_BODY_LIMITS");
      expect(source).toMatch(
        /for \(const \{ path, limit \} of UNAUTHENTICATED_BODY_LIMITS\)/,
      );
    });

    it("caps both JSON and urlencoded for those routes", () => {
      // Twilio posts form-encoded and the share form posts form-encoded; a
      // JSON-only cap would leave the actual traffic uncapped.
      expect(source).toMatch(/app\.use\(path, express\.json\(\{ limit \}\)\)/);
      expect(source).toMatch(
        /app\.use\(path, express\.urlencoded\(\{ extended: false, limit \}\)\)/,
      );
    });

    it("mounts the capped parsers before the global ones", () => {
      // body-parser skips an already-parsed body, so a cap mounted after the
      // global parser never applies.
      const capped = source.indexOf("of UNAUTHENTICATED_BODY_LIMITS");
      const global = source.indexOf("limit: JSON_BODY_LIMIT");
      expect(capped).toBeGreaterThan(-1);
      expect(global).toBeGreaterThan(-1);
      expect(capped).toBeLessThan(global);
    });

    it("reports the limit that actually rejected the request", () => {
      // A 413 naming the global 10mb for a route capped at 64kb sends the
      // caller off to debug the wrong number.
      expect(source).toContain("bodyLimitFor(req.path)");
    });
  });
});
