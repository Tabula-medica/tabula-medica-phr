import { verifyGcipToken, resolveGcipUser, type GcipClaims } from "./gcip";

// ---------------------------------------------------------------------------
// Step-up (re-)authentication for actions that need more than "there is a
// valid session" — currently: DEA EPCS (21 CFR 1311) requires two-factor,
// identity-proofed authentication specifically at the moment a controlled
// substance (DEA Schedule II-V) prescription is created, not just an
// ordinary logged-in session that could be hours old.
//
// The client re-runs its normal phone sign-in, which Firebase/GCIP will
// upgrade into an MFA challenge if (and only if) the account has a TOTP
// factor enrolled (see client/src/lib/gcip.ts resolveTotpChallenge). The
// resulting fresh ID token is sent as `X-Step-Up-Token` and verified here
// against three things a stale or borrowed token can't satisfy:
//   1. it verifies as a genuine, current GCIP token at all,
//   2. it resolves to the SAME internal user as the session making the
//      request (a valid token for a different person must not count), and
//   3. `firebase.sign_in_second_factor === "totp"` AND `auth_time` is very
//      recent — i.e. this specific token was minted by a TOTP-backed sign-in
//      that just happened, not an old cached session or a bare first factor.
// ---------------------------------------------------------------------------

export const STEP_UP_MAX_AGE_SECONDS = 5 * 60;
export const STEP_UP_REQUIRED_SECOND_FACTOR = "totp";

export type StepUpFailureReason =
  | "missing_token"
  | "invalid_token"
  | "wrong_user"
  | "stale"
  | "second_factor_required";

export type StepUpResult =
  | { ok: true }
  | { ok: false; reason: StepUpFailureReason };

export const STEP_UP_FAILURE_MESSAGES: Record<StepUpFailureReason, string> = {
  missing_token: "Re-verify your identity to prescribe a controlled substance.",
  invalid_token: "That identity verification could not be confirmed. Please try again.",
  wrong_user: "That identity verification does not match your account.",
  stale: "That identity verification has expired. Please verify again.",
  second_factor_required:
    "Prescribing a controlled substance requires an authenticator app (TOTP) as a second factor. Enable one in Security Settings and try again.",
};

/**
 * Pure decision function over already-resolved inputs, kept separate from
 * the network/DB calls in verifyStepUpAssertion() so the DEA-EPCS policy
 * itself — freshness window, required second factor, user-binding — is
 * unit-testable without mocking JWKS or the database.
 */
export function evaluateStepUpClaims(
  claims: GcipClaims | null,
  expectedUserId: string,
  resolvedUserId: string | null,
  nowSeconds: number,
): StepUpResult {
  if (!claims) return { ok: false, reason: "invalid_token" };
  if (!resolvedUserId || resolvedUserId !== expectedUserId) {
    return { ok: false, reason: "wrong_user" };
  }

  const authTime = claims.auth_time ?? (claims.iat as number | undefined);
  if (typeof authTime !== "number" || nowSeconds - authTime > STEP_UP_MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  if (claims.firebase?.sign_in_second_factor !== STEP_UP_REQUIRED_SECOND_FACTOR) {
    return { ok: false, reason: "second_factor_required" };
  }

  return { ok: true };
}

/**
 * Verify a step-up token supplied via the `X-Step-Up-Token` header against
 * the DEA-EPCS policy above. `expectedUserId` is the internal user id of the
 * session making the request (req.user.claims.sub) — never trust a caller-
 * supplied id here.
 */
export async function verifyStepUpAssertion(
  token: string | undefined,
  expectedUserId: string,
): Promise<StepUpResult> {
  if (!token) return { ok: false, reason: "missing_token" };

  const claims = await verifyGcipToken(token);
  const resolvedUser = claims ? await resolveGcipUser(claims) : null;

  return evaluateStepUpClaims(claims, expectedUserId, resolvedUser?.id ?? null, Math.floor(Date.now() / 1000));
}
