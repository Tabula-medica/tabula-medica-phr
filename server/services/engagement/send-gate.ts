/**
 * The send gate — every outbound patient message passes through here.
 *
 * Four independent checks, all of which must pass, evaluated in a fixed order
 * so the refusal a caller sees is the most fundamental one:
 *
 *   1. **Phone validity.** Cannot send, and an invalid number in a campaign
 *      list usually means the list is wrong.
 *   2. **Consent** (TCPA). Unknown is not yes. Revoked is permanent.
 *   3. **PHI tier vs channel ceiling** (HIPAA minimum necessary). A template
 *      above the channel's ceiling is refused outright — not truncated, not
 *      redacted, not "sent with a warning".
 *   4. **Quiet hours** (TCPA) and **frequency cap**.
 *
 * Order matters for what the operator learns. A revoked patient who also has
 * no timezone should hear "revoked", because fixing the timezone would not
 * make the send legal.
 *
 * Quiet hours produce `deferred`, not `refused`: the message is legitimate,
 * it is simply too early or too late, and the caller gets the instant the
 * window opens so it can be queued rather than dropped.
 */

import {
  CHANNEL_PHI_CEILING,
  PHI_TIER_ORDER,
  type EngagementChannel,
  type EngagementMessage,
  type EngagementRecipient,
  type SendDecision,
} from "@shared/engagement";
import { getConsent, normalizePhone } from "./consent";
import { checkQuietHours } from "./quiet-hours";

/**
 * Most messages a patient should receive in a rolling week.
 *
 * Not a legal threshold — a judgement about when a reminder system stops
 * being helpful and becomes the thing people mute. Appointment confirmations
 * the patient triggered are exempt, since those are replies to them.
 */
export const WEEKLY_MESSAGE_CAP = 5;
const ROLLING_WINDOW_MS = 7 * 24 * 3_600_000;

/** Send history, for frequency capping. Keyed by E.164. */
const recentSends = new Map<string, number[]>();

function tierRank(tier: string): number {
  return PHI_TIER_ORDER.indexOf(tier as (typeof PHI_TIER_ORDER)[number]);
}

function countRecent(phone: string, now: number): number {
  const timestamps = recentSends.get(phone) ?? [];
  const live = timestamps.filter((t) => now - t < ROLLING_WINDOW_MS);
  if (live.length !== timestamps.length) recentSends.set(phone, live);
  return live.length;
}

/** Record a completed send so it counts against the cap. */
export function recordSend(phone: string, at: Date = new Date()): void {
  const key = normalizePhone(phone);
  if (!key) return;
  const timestamps = recentSends.get(key) ?? [];
  timestamps.push(at.getTime());
  recentSends.set(key, timestamps);
}

export interface GateContext {
  channel: EngagementChannel;
  /** Whether the channel has working credentials. */
  channelConfigured: boolean;
  now?: Date;
}

export function evaluateSend(
  recipient: EngagementRecipient,
  message: EngagementMessage,
  context: GateContext,
): SendDecision {
  const now = context.now ?? new Date();
  const phone = normalizePhone(recipient.phone);

  if (!phone) {
    return {
      status: "refused",
      reason: "invalid-phone",
      detail: `"${recipient.phone}" is not a usable E.164 number. Nothing was sent.`,
    };
  }

  if (!context.channelConfigured) {
    return {
      status: "refused",
      reason: "channel-not-configured",
      detail:
        `The ${context.channel} channel has no credentials configured, so this message ` +
        "was not sent. It was not silently dropped — configure the channel and resend.",
    };
  }

  // ── Consent ──────────────────────────────────────────────────────────────
  const consent = getConsent(phone);
  if (consent.state === "unknown") {
    return {
      status: "refused",
      reason: "no-consent",
      detail:
        "No TCPA consent on file for this number. Having a patient's phone number is " +
        "not consent to text it; capture consent at intake or in the portal first.",
    };
  }
  if (consent.state === "revoked") {
    return {
      status: "refused",
      reason: "consent-revoked",
      detail:
        `This number opted out${consent.revokedAt ? ` on ${consent.revokedAt}` : ""}. ` +
        "Revocation applies to every purpose, not just the campaign that prompted it. " +
        "Only a fresh affirmative opt-in restores messaging.",
    };
  }
  if (!consent.purposes.includes(message.purpose)) {
    return {
      status: "refused",
      reason: "purpose-not-consented",
      detail:
        `Consent on file covers ${consent.purposes.join(", ") || "nothing"}, not ` +
        `"${message.purpose}". Consent is scoped to what the patient agreed to.`,
    };
  }

  // ── PHI tier vs channel ceiling ──────────────────────────────────────────
  const ceiling = CHANNEL_PHI_CEILING[context.channel];
  if (tierRank(message.tier) > tierRank(ceiling)) {
    return {
      status: "refused",
      reason: "phi-tier-exceeds-channel",
      detail:
        `Template "${message.templateId}" is classified "${message.tier}" but ${context.channel} ` +
        `carries at most "${ceiling}". The message was refused rather than trimmed — ` +
        "send a notification that directs the patient to the portal instead.",
    };
  }

  // ── Frequency cap ────────────────────────────────────────────────────────
  const exemptFromCap = message.purpose === "appointment-confirmation" || message.purpose === "consent-management";
  if (!exemptFromCap && countRecent(phone, now.getTime()) >= WEEKLY_MESSAGE_CAP) {
    return {
      status: "refused",
      reason: "frequency-cap",
      detail:
        `This number has already received ${WEEKLY_MESSAGE_CAP} messages in the past 7 days. ` +
        "Sending more is how a reminder system trains patients to ignore it.",
    };
  }

  // ── Quiet hours ──────────────────────────────────────────────────────────
  const quiet = checkQuietHours(recipient.timeZone, now);
  if (quiet.status === "unknown-timezone") {
    return {
      status: "refused",
      reason: "unknown-timezone",
      detail:
        "No usable IANA timezone for this patient, so TCPA quiet hours cannot be checked. " +
        "The practice's own timezone is not a safe substitute — it is wrong precisely for " +
        "patients who have moved. Capture the timezone and resend.",
    };
  }
  if (quiet.status === "deferred") {
    return {
      status: "deferred",
      channel: context.channel,
      sendAfter: quiet.sendAfter,
      reason: "quiet-hours",
      detail:
        `Local time for this patient is ${String(quiet.localHour).padStart(2, "0")}:00, outside ` +
        "the 08:00–21:00 window. Queued for the next open window rather than dropped.",
    };
  }

  return { status: "send", channel: context.channel, body: message.body, scheduledFor: "now" };
}

/** Test/ops helper. Not exposed over HTTP. */
export function resetSendHistory(): void {
  recentSends.clear();
}
