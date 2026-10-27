/**
 * Regression tests for Task #140: Sharing and Collaboration Authorization
 *
 * Proves the two medium-severity controls that were already implemented
 * before this task (and confirmed not regressed):
 *
 *   1. Share-link passcode lockout — repeated wrong passcode attempts
 *      against GET /api/share/:token are throttled and locked out using
 *      the in-process map in server/share-passcode-lockout-service.ts.
 *
 *   2. One-tap share-package access controls — packages configured with
 *      allowedIPRanges / restrictToRecipientEmail / requireIdentityVerification
 *      are denied to callers that do not satisfy the controls. The checks
 *      live in OneTapShareService.accessPackage() in
 *      server/one-tap-share-service.ts.
 *
 * Run via: node --import tsx server/__tests__/share-authorization.test.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import {
  sharePasscodeLockouts,
  applySharePasscodeLockout,
  pruneSharePasscodeLockouts,
  SHARE_PASSCODE_WINDOW_MS,
  type SharePasscodeRecord,
} from "../share-passcode-lockout-service";
import { oneTapShareService } from "../one-tap-share-service";

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

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

(async () => {
  // ─── 1. Share-link passcode lockout unit tests ───────────────────────────

  section("Share-link passcode lockout (applySharePasscodeLockout)");

  {
    const now = Date.now();

    // Fresh record — no lockout yet (below first threshold)
    const rec1: SharePasscodeRecord = { failures: 1, lastFailure: now, lockedUntil: 0 };
    applySharePasscodeLockout(rec1);
    ok("1 failure → no lockout yet (lockedUntil=0)", rec1.lockedUntil === 0);

    // 5 failures → first threshold (60 s lockout)
    const rec5: SharePasscodeRecord = { failures: 5, lastFailure: now, lockedUntil: 0 };
    applySharePasscodeLockout(rec5);
    ok("5 failures → lockout applied (lockedUntil > now)", rec5.lockedUntil > now);
    ok(
      "5 failures → lockout ≤ 60 s from now",
      rec5.lockedUntil <= now + 60_000 + 500
    );

    // 10 failures → second threshold (5 min lockout)
    const rec10: SharePasscodeRecord = { failures: 10, lastFailure: now, lockedUntil: 0 };
    applySharePasscodeLockout(rec10);
    ok("10 failures → lockout > 60 s", rec10.lockedUntil > now + 60_000);
    ok("10 failures → lockout ≤ 300 s from now", rec10.lockedUntil <= now + 300_000 + 500);

    // 20 failures → fourth threshold (60 min lockout)
    const rec20: SharePasscodeRecord = { failures: 20, lastFailure: now, lockedUntil: 0 };
    applySharePasscodeLockout(rec20);
    ok("20 failures → lockout ≈ 60 min", rec20.lockedUntil >= now + 3_600_000 - 500);
  }

  section("Share-link passcode lockout (pruneSharePasscodeLockouts)");

  {
    sharePasscodeLockouts.clear();

    const staleTs = Date.now() - SHARE_PASSCODE_WINDOW_MS - 1;
    for (let i = 0; i < 50_001; i++) {
      sharePasscodeLockouts.set(`key-${i}`, {
        failures: 1,
        lastFailure: i % 2 === 0 ? staleTs : Date.now(),
        lockedUntil: 0,
      });
    }
    ok("map exceeds 50 000 before prune", sharePasscodeLockouts.size > 50_000);
    pruneSharePasscodeLockouts(Date.now());
    ok("stale entries pruned (map shrinks)", sharePasscodeLockouts.size < 50_001);

    sharePasscodeLockouts.clear();
  }

  // ─── 2. One-tap share-package access controls ────────────────────────────

  section("One-tap share-package: allowedIPRanges enforcement");

  {
    const pkg = await oneTapShareService.createSharePackage(
      "patient-test-1",
      "specialist_referral",
      { name: "Test Provider" },
      { allowedIPRanges: ["192.168.1.0/24"] }
    );

    const allowedResult = await oneTapShareService.accessPackage(
      pkg.id,
      undefined,
      { ipAddress: "192.168.1.50" }
    );
    ok("IP in allowed range → authorized", allowedResult.authorized === true);

    const blockedResult = await oneTapShareService.accessPackage(
      pkg.id,
      undefined,
      { ipAddress: "10.0.0.1" }
    );
    ok("IP outside allowed range → not authorized", blockedResult.authorized === false);
    ok(
      "IP outside allowed range → error mentions network location",
      typeof blockedResult.error === "string" &&
        blockedResult.error.toLowerCase().includes("network")
    );
  }

  section("One-tap share-package: restrictToRecipientEmail enforcement");

  {
    const pkg = await oneTapShareService.createSharePackage(
      "patient-test-2",
      "specialist_referral",
      { name: "Test Provider", email: "provider@example.com" },
      { restrictToRecipientEmail: true }
    );

    const result = await oneTapShareService.accessPackage(pkg.id, undefined, {
      ipAddress: "1.2.3.4",
    });
    ok(
      "restrictToRecipientEmail → not authorized for anonymous caller",
      result.authorized === false
    );
    ok(
      "restrictToRecipientEmail → error mentions recipient",
      typeof result.error === "string" &&
        result.error.toLowerCase().includes("recipient")
    );
  }

  section("One-tap share-package: requireIdentityVerification enforcement");

  {
    const pkg = await oneTapShareService.createSharePackage(
      "patient-test-3",
      "second_opinion",
      { name: "Attorney" },
      { requireIdentityVerification: true }
    );

    const result = await oneTapShareService.accessPackage(pkg.id, undefined, {
      ipAddress: "1.2.3.4",
    });
    ok(
      "requireIdentityVerification → not authorized for anonymous caller",
      result.authorized === false
    );
    ok(
      "requireIdentityVerification → error mentions verification",
      typeof result.error === "string" &&
        result.error.toLowerCase().includes("verif")
    );
  }

  section("One-tap share-package: passcode lockout after repeated failures");

  {
    const pkg = await oneTapShareService.createSharePackage(
      "patient-test-4",
      "caregiver",
      { name: "Test" },
      { passcode: "correct-code" }
    );

    const testIp = "203.0.113.99";
    for (let i = 0; i < 5; i++) {
      await oneTapShareService.accessPackage(pkg.id, "wrong-code", {
        ipAddress: testIp,
      });
    }

    // 6th attempt (even with correct passcode) should be locked out
    const lockedResult = await oneTapShareService.accessPackage(
      pkg.id,
      "correct-code",
      { ipAddress: testIp }
    );
    ok(
      "5 wrong passcode attempts → subsequent attempt locked out",
      lockedResult.authorized === false
    );
    ok(
      "locked-out attempt returns retryAfter",
      typeof (lockedResult as any).retryAfter === "number"
    );
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})();
