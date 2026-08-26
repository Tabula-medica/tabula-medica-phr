import { describe, it, expect, afterEach } from "vitest";
import {
  requiresEmailVerification,
  isSignupEmailVerificationRequired,
  EMAIL_NOT_VERIFIED_CODE,
} from "../server/auth/email-verification";

const passwordClaims = (overrides: Record<string, unknown> = {}) => ({
  email: "person@example.com",
  email_verified: false,
  firebase: { sign_in_provider: "password" },
  ...overrides,
});

afterEach(() => {
  delete process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
});

describe("requiresEmailVerification", () => {
  it("gates an unverified email/password sign-up", () => {
    expect(requiresEmailVerification(passwordClaims())).toBe(true);
  });

  it("lets a confirmed email/password account straight through", () => {
    expect(requiresEmailVerification(passwordClaims({ email_verified: true }))).toBe(false);
  });

  it("treats a missing email_verified claim as unverified", () => {
    const claims = passwordClaims();
    delete (claims as Record<string, unknown>).email_verified;
    expect(requiresEmailVerification(claims)).toBe(true);
  });

  it("does not gate Google or Apple sign-in (the IdP already verified the address)", () => {
    for (const provider of ["google.com", "apple.com"]) {
      expect(
        requiresEmailVerification({
          email: "person@example.com",
          email_verified: true,
          firebase: { sign_in_provider: provider },
        })
      ).toBe(false);
    }
  });

  it("does not gate phone/SMS sign-in, which carries no email at all", () => {
    expect(
      requiresEmailVerification({
        phone_number: "+15715550123",
        firebase: { sign_in_provider: "phone" },
      })
    ).toBe(false);
  });

  it("does not gate a password token with no email — that fails the normal resolve path", () => {
    expect(
      requiresEmailVerification({ firebase: { sign_in_provider: "password" } })
    ).toBe(false);
  });

  it("is a no-op for null/undefined claims", () => {
    expect(requiresEmailVerification(null)).toBe(false);
    expect(requiresEmailVerification(undefined)).toBe(false);
  });

  it("can be switched off with REQUIRE_SIGNUP_EMAIL_VERIFICATION=false", () => {
    process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION = "false";
    expect(isSignupEmailVerificationRequired()).toBe(false);
    expect(requiresEmailVerification(passwordClaims())).toBe(false);
  });

  it("stays on for any other value of the flag", () => {
    for (const value of ["true", "1", "yes", "", "anything"]) {
      process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION = value;
      expect(requiresEmailVerification(passwordClaims())).toBe(true);
    }
  });

  it("exposes a stable error code for clients to branch on", () => {
    expect(EMAIL_NOT_VERIFIED_CODE).toBe("email_not_verified");
  });
});
