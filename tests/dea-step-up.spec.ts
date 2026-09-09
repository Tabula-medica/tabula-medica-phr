import { describe, expect, it } from "vitest";
import {
  evaluateStepUpClaims,
  STEP_UP_MAX_AGE_SECONDS,
} from "../server/auth/step-up";
import type { GcipClaims } from "../server/auth/gcip";

const NOW = 1_700_000_000;
const USER_ID = "user-123";

function claims(overrides: Partial<GcipClaims> = {}): GcipClaims {
  return {
    sub: "gcip-sub-1",
    auth_time: NOW,
    firebase: { sign_in_provider: "phone", sign_in_second_factor: "totp" },
    ...overrides,
  };
}

describe("evaluateStepUpClaims", () => {
  it("accepts a fresh, TOTP-backed sign-in for the same user", () => {
    const result = evaluateStepUpClaims(claims(), USER_ID, USER_ID, NOW);
    expect(result).toEqual({ ok: true });
  });

  it("rejects when claims are missing entirely (unverifiable token)", () => {
    const result = evaluateStepUpClaims(null, USER_ID, null, NOW);
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects when the token resolves to a different user than the session", () => {
    const result = evaluateStepUpClaims(claims(), USER_ID, "someone-else", NOW);
    expect(result).toEqual({ ok: false, reason: "wrong_user" });
  });

  it("rejects when the token could not be resolved to any internal user", () => {
    const result = evaluateStepUpClaims(claims(), USER_ID, null, NOW);
    expect(result).toEqual({ ok: false, reason: "wrong_user" });
  });

  it("rejects a stale sign-in older than the freshness window", () => {
    const staleAuthTime = NOW - STEP_UP_MAX_AGE_SECONDS - 1;
    const result = evaluateStepUpClaims(claims({ auth_time: staleAuthTime }), USER_ID, USER_ID, NOW);
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("accepts a sign-in exactly at the edge of the freshness window", () => {
    const edgeAuthTime = NOW - STEP_UP_MAX_AGE_SECONDS;
    const result = evaluateStepUpClaims(claims({ auth_time: edgeAuthTime }), USER_ID, USER_ID, NOW);
    expect(result).toEqual({ ok: true });
  });

  it("falls back to iat when auth_time is absent", () => {
    const result = evaluateStepUpClaims(
      claims({ auth_time: undefined, iat: NOW }),
      USER_ID,
      USER_ID,
      NOW,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects when neither auth_time nor iat is present", () => {
    const result = evaluateStepUpClaims(
      claims({ auth_time: undefined, iat: undefined }),
      USER_ID,
      USER_ID,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects a fresh sign-in that did not complete a TOTP second factor (bare phone re-auth)", () => {
    const result = evaluateStepUpClaims(
      claims({ firebase: { sign_in_provider: "phone" } }),
      USER_ID,
      USER_ID,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "second_factor_required" });
  });

  it("rejects a second factor of a different kind (defense in depth against future factor types)", () => {
    const result = evaluateStepUpClaims(
      claims({ firebase: { sign_in_provider: "phone", sign_in_second_factor: "sms" } }),
      USER_ID,
      USER_ID,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "second_factor_required" });
  });
});
