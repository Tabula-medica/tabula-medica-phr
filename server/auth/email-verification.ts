/**
 * Sign-up anti-bot gate: prove the address is real, don't force a second factor.
 *
 * Tabula Medica does not require MFA to create or use an account — TOTP stays
 * opt-in from Security settings (`/api/auth/mfa/*`). The abuse control on the
 * registration path is instead an email round-trip: an email/password sign-up
 * only becomes a real account once the person clicks the link GCIP mails them.
 * A script can POST the sign-up form, but it cannot read the inbox.
 *
 * Only self-asserted addresses need the round-trip:
 *   - `password`  -> the user typed the address; GCIP has not checked it. GATED.
 *   - `google.com` / `apple.com` -> the IdP already verified the address, and
 *     the token carries `email_verified: true`. Not gated.
 *   - `phone`     -> possession of the SMS code is the proof; there is no email
 *     on the token at all. Not gated.
 *
 * This module deliberately has no imports (no DB, no Firebase) so the rule is
 * a pure function that can be unit-tested and reused from every entry point
 * that mints a session (web exchange, mobile exchange, bearer path).
 */

/** The subset of GCIP ID-token claims this rule looks at. */
export interface EmailVerificationClaims {
  email?: string | null;
  email_verified?: boolean;
  phone_number?: string | null;
  firebase?: {
    sign_in_provider?: string;
    [key: string]: unknown;
  };
}

/**
 * Firebase sign-in providers whose email address is whatever the user typed
 * into our own form. Email-link sign-in also reports as "password", and that
 * flow sets `email_verified` itself, so it passes the check below unchanged.
 */
const SELF_ASSERTED_EMAIL_PROVIDERS = new Set(["password", "email"]);

/** Error code returned to clients so the UI can render the "check your inbox" state. */
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";

/** User-facing copy for the gate; kept in one place so web and mobile match. */
export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Please confirm your email address. We sent you a verification link — open it, then sign in again.";

/**
 * Ops escape hatch. Defaults to ON; set REQUIRE_SIGNUP_EMAIL_VERIFICATION=false
 * to disable the gate without a code rollback (e.g. if outbound mail is down).
 */
export function isSignupEmailVerificationRequired(): boolean {
  const raw = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (raw === undefined || raw === null || raw === "") return true;
  return !["false", "0", "no", "off"].includes(raw.trim().toLowerCase());
}

/**
 * True when these claims describe a self-asserted email address that has not
 * been confirmed yet, i.e. the caller must be told to go read their email
 * before an account is created for them.
 */
export function requiresEmailVerification(claims: EmailVerificationClaims | null | undefined): boolean {
  if (!claims) return false;
  if (!isSignupEmailVerificationRequired()) return false;

  const provider = claims.firebase?.sign_in_provider ?? "";
  if (!SELF_ASSERTED_EMAIL_PROVIDERS.has(provider)) return false;

  // A password-provider token with no email at all cannot be email-gated;
  // let the normal resolve/create path reject it instead.
  if (!claims.email) return false;

  return claims.email_verified !== true;
}
