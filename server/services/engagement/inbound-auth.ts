/**
 * Authentication for the parts of engagement that face outward.
 *
 * Extracted from the route file because both of these are security decisions
 * that deserve tests, and security logic living inline in a handler is
 * security logic nobody unit-tests.
 *
 * Both fail closed. An unconfigured control refuses rather than permits — the
 * opposite arrangement is how a staging deployment with no credentials ends
 * up accepting anything.
 */

import twilio from "twilio";

// ── Inbound webhook authenticity ─────────────────────────────────────────────

export type SignatureVerdict = { ok: true } | { ok: false; detail: string };

export interface SignableRequest {
  signature: string | undefined;
  /** The exact URL Twilio posted to, including protocol and host. */
  url: string;
  params: Record<string, unknown>;
}

/**
 * Verify an inbound message really came from Twilio.
 *
 * The first cut of this endpoint was open, with "verify the signature at the
 * edge in production" written in a comment. A note in a comment is not a
 * control in this process. Unauthenticated, the endpoint let anyone revoke
 * consent for any number — and, worse, forge a START, which manufactures the
 * `sms-double-optin` record that later lets the clinic text somebody who never
 * agreed. A forged opt-in turns the consent gate into a rubber stamp, which is
 * precisely what the gate exists to prevent.
 */
export function verifyTwilioSignature(
  req: SignableRequest,
  authToken = process.env.TWILIO_AUTH_TOKEN,
): SignatureVerdict {
  if (!authToken) {
    return {
      ok: false,
      detail:
        "TWILIO_AUTH_TOKEN is not configured, so an inbound webhook cannot be authenticated. " +
        "Refusing rather than accepting unverified consent changes.",
    };
  }
  if (!req.signature) {
    return { ok: false, detail: "Missing X-Twilio-Signature header." };
  }

  const valid = twilio.validateRequest(authToken, req.signature, req.url, req.params);
  return valid
    ? { ok: true }
    : { ok: false, detail: "Signature did not validate for this request." };
}

// ── Outbound link safety ─────────────────────────────────────────────────────

export function portalOriginAllowList(raw = process.env.PATIENT_PORTAL_ORIGINS): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Whether a template's `portalUrl` may be sent.
 *
 * `z.string().url()` accepted anything, which turned the pre-visit template
 * into an SMS phishing primitive: clinic-branded copy, the practice's own
 * sender id, and the attacker's link. Patients are trained to trust exactly
 * that message.
 *
 * Absent is fine — a template that needs the variable fails at render. An
 * empty allow-list refuses, because "not configured yet" must not read as
 * "anything goes".
 */
export function isAllowedPortalUrl(
  raw: string | undefined,
  allowList = portalOriginAllowList(),
): boolean {
  if (!raw) return true;
  if (allowList.length === 0) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // https only: a plaintext link in a message about a medical appointment is
  // both interceptable and a credibility signal an attacker can borrow.
  if (url.protocol !== "https:") return false;

  return allowList.some((origin) => {
    try {
      return new URL(origin).origin === url.origin;
    } catch {
      return false;
    }
  });
}

// ── Role ─────────────────────────────────────────────────────────────────────

export interface CallerRole {
  userId?: string;
  role?: string;
  isProvider?: boolean;
}

/**
 * Whether a caller may act on a patient other than themselves.
 *
 * `isAuthenticated` alone admitted any signed-in PHR account, which meant a
 * patient could enrol a stranger's number, read another patient's consent
 * state, and send clinic-branded SMS from the practice's number. Engagement
 * messaging is a staff action performed *on* a patient, not a patient action.
 */
export function isClinicStaff(caller: CallerRole): boolean {
  if (!caller.userId) return false;
  return (
    caller.isProvider === true ||
    caller.role === "provider" ||
    caller.role === "staff" ||
    caller.role === "admin"
  );
}
