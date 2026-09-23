/**
 * MFA Security Notification Emails
 *
 * Every change to a user's second factor is a security-relevant event: if
 * an attacker enrolls their own authenticator or disables MFA, the account
 * owner must hear about it out-of-band. This module builds and sends those
 * confirmation emails for all MFA lifecycle events.
 *
 * PHI safety: these emails carry account-security metadata only (event
 * type, timestamp, IP, device summary). No health data, no patient names,
 * no record identifiers ever enter the body.
 *
 * Failure policy: sending is best-effort. A mail outage must never block
 * or roll back an MFA change, so every failure is logged and reported back
 * to the caller as a boolean rather than thrown.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { sendEmail, isEmailConfigured } from "./email-service";

export type MfaEmailEvent =
  | "enrolled"
  | "disabled"
  | "recovery_codes_regenerated"
  | "recovery_code_used";

export interface MfaEventContext {
  ipAddress?: string;
  userAgent?: string;
  occurredAt?: Date;
  /** Recovery codes left after the event, when the event changes the count. */
  recoveryCodesRemaining?: number;
}

export interface MfaNotificationOutcome {
  sent: boolean;
  reason?: "no-recipient" | "not-configured" | "no-api-key" | "sdk-missing" | "send-failed";
  error?: string;
}

// Read at call time, not module load, so deployments that inject env vars
// after import order settles (and tests) both see the right values.
function supportEmail(): string {
  return process.env.SUPPORT_EMAIL || "support@tabulamedica.health";
}

function securitySettingsUrl(): string {
  const base = (process.env.APP_PUBLIC_URL || "https://app.tabulamedica.health").replace(/\/+$/, "");
  return `${base}/settings/security`;
}

interface EventCopy {
  subject: string;
  headline: string;
  body: string;
  /** Shown when the event was NOT initiated by the account owner. */
  warning: string;
}

const EVENT_COPY: Record<MfaEmailEvent, EventCopy> = {
  enrolled: {
    subject: "Two-factor authentication is now on for your Tabula Medica account",
    headline: "Two-factor authentication enabled",
    body:
      "An authenticator app was added to your Tabula Medica account. From now on " +
      "you'll be asked for a 6-digit code each time you sign in.",
    warning:
      "If you did not turn this on, someone else may have access to your account. " +
      "Contact us immediately — do not wait.",
  },
  disabled: {
    subject: "Two-factor authentication was turned off for your Tabula Medica account",
    headline: "Two-factor authentication disabled",
    body:
      "Two-factor authentication was removed from your Tabula Medica account. Your " +
      "account is now protected by your password alone, and your recovery codes have " +
      "been deleted.",
    warning:
      "If you did not turn this off, your account may be compromised. Re-enable " +
      "two-factor authentication and contact us immediately.",
  },
  recovery_codes_regenerated: {
    subject: "Your Tabula Medica recovery codes were regenerated",
    headline: "New recovery codes issued",
    body:
      "A new set of recovery codes was generated for your Tabula Medica account. " +
      "Your previous codes no longer work. Store the new codes somewhere safe and " +
      "offline.",
    warning:
      "If you did not request new recovery codes, someone else may have access to " +
      "your account. Contact us immediately.",
  },
  recovery_code_used: {
    subject: "A recovery code was used to sign in to your Tabula Medica account",
    headline: "Recovery code used",
    body:
      "A single-use recovery code was accepted for your Tabula Medica account. Each " +
      "code works only once.",
    warning:
      "If this wasn't you, regenerate your recovery codes and contact us immediately.",
  },
};

/** Trim and neutralize a user-agent string before it lands in an email body. */
function summarizeUserAgent(userAgent?: string): string {
  if (!userAgent) return "Unknown device";
  return userAgent.replace(/[\r\n<>]/g, " ").trim().slice(0, 160) || "Unknown device";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMfaEmail(
  event: MfaEmailEvent,
  context: MfaEventContext = {}
): { subject: string; text: string; html: string } {
  const copy = EVENT_COPY[event];
  const when = (context.occurredAt || new Date()).toISOString().replace("T", " ").slice(0, 19);
  const device = summarizeUserAgent(context.userAgent);
  const ip = context.ipAddress || "Unknown";

  const details: string[] = [
    `When: ${when} UTC`,
    `IP address: ${ip}`,
    `Device: ${device}`,
  ];
  if (typeof context.recoveryCodesRemaining === "number") {
    details.push(`Recovery codes remaining: ${context.recoveryCodesRemaining}`);
  }

  const text = [
    copy.headline,
    "",
    copy.body,
    "",
    ...details,
    "",
    copy.warning,
    `Security settings: ${securitySettingsUrl()}`,
    `Support: ${supportEmail()}`,
    "",
    "This is an automated security notice. It contains no health information.",
  ].join("\n");

  const html = [
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;color:#1a3a52">`,
    `<h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(copy.headline)}</h2>`,
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(copy.body)}</p>`,
    `<ul style="margin:0 0 16px;padding-left:18px;line-height:1.6">`,
    ...details.map((d) => `<li>${escapeHtml(d)}</li>`),
    `</ul>`,
    `<p style="margin:0 0 16px;line-height:1.5"><strong>${escapeHtml(copy.warning)}</strong></p>`,
    `<p style="margin:0 0 8px"><a href="${escapeHtml(securitySettingsUrl())}">Review your security settings</a></p>`,
    `<p style="margin:0 0 16px">Questions? <a href="mailto:${escapeHtml(supportEmail())}">${escapeHtml(supportEmail())}</a></p>`,
    `<p style="margin:0;font-size:12px;color:#5c7a91">This is an automated security notice. It contains no health information.</p>`,
    `</div>`,
  ].join("");

  return { subject: copy.subject, text, html };
}

/**
 * Resolve the address to notify. The session claim is authoritative and
 * avoids a round trip; the users table is the fallback for bearer-token
 * sessions that never carried an email claim.
 */
export async function resolveNotificationEmail(
  userId: string,
  claimEmail?: string | null
): Promise<string | null> {
  if (claimEmail && claimEmail.includes("@")) return claimEmail;
  try {
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.email && row.email.includes("@") ? row.email : null;
  } catch (err: any) {
    console.error("[MFA] recipient lookup failed:", err?.message);
    return null;
  }
}

export async function sendMfaSecurityEmail(
  userId: string,
  claimEmail: string | null | undefined,
  event: MfaEmailEvent,
  context: MfaEventContext = {}
): Promise<MfaNotificationOutcome> {
  if (!isEmailConfigured()) {
    console.warn(
      `[MFA] security email for "${event}" skipped — RESEND_API_KEY is not configured`
    );
    return { sent: false, reason: "not-configured" };
  }

  const to = await resolveNotificationEmail(userId, claimEmail);
  if (!to) {
    console.warn(`[MFA] security email for "${event}" skipped — no address on file`);
    return { sent: false, reason: "no-recipient" };
  }

  const { subject, text, html } = buildMfaEmail(event, context);
  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    tags: [
      { name: "channel", value: "mfa-security" },
      { name: "event", value: event },
    ],
  });

  if (!result.ok) {
    console.error(
      `[MFA] security email for "${event}" failed (${result.reason}): ${result.error || ""}`
    );
    return { sent: false, reason: result.reason, error: result.error };
  }

  console.log(`[MFA] security email sent for "${event}" (id=${result.id || "n/a"})`);
  return { sent: true };
}
