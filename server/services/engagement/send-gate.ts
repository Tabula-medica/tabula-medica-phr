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
  PHI_TIER_ORDER,
  PURPOSE_CLASS,
  type EngagementChannel,
  type EngagementMessage,
  type EngagementRecipient,
  type ConsentRecord,
  type SendDecision,
} from "@shared/engagement";
import { normalizePhone } from "./consent";
import { checkQuietHours } from "./quiet-hours";
import { channelPolicy, policyFor } from "./jurisdictions";
import { isValidNoticeLanguageIN } from "./languages";

/**
 * Default weekly volume. Jurisdictions may override; both currently agree.
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
  /**
   * Registered template identity for channels that demand one — the DLT
   * template id for India SMS, the approved template name for WhatsApp.
   * Absent is a refusal, not a warning: an unregistered message is discarded
   * at the operator or by Meta, and a "successful" send that never arrives is
   * the worst failure mode available.
   */
  registeredTemplateId?: string;
  /**
   * Consent for this number, fetched by the caller.
   *
   * Passed in rather than looked up here so the gate stays a pure function of
   * its inputs. That matters beyond tidiness: consent now lives in Postgres
   * because a process-local copy meant a STOP reached one instance out of ten,
   * and a synchronous lookup inside a synchronous gate is exactly what made
   * the in-memory version look reasonable.
   */
  consent: ConsentRecord;
  now?: Date;
}

export function evaluateSend(
  recipient: EngagementRecipient,
  message: EngagementMessage,
  context: GateContext,
): SendDecision {
  const now = context.now ?? new Date();
  const phone = normalizePhone(recipient.phone);
  const jurisdiction = policyFor(recipient.jurisdiction);
  const channel = channelPolicy(recipient.jurisdiction, context.channel);

  if (!phone) {
    return {
      status: "refused",
      reason: "invalid-phone",
      detail: `"${recipient.phone}" is not a usable E.164 number. Nothing was sent.`,
    };
  }

  if (!channel.permitted) {
    return {
      status: "refused",
      reason: "channel-not-permitted-in-jurisdiction",
      detail: `${context.channel} is not permitted in ${jurisdiction.displayName}. ${channel.note}`,
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
  const consent = context.consent;
  if (consent.state === "unknown") {
    return {
      status: "refused",
      reason: "no-consent",
      detail:
        "No consent on file for this number. Having a patient's phone number is not " +
        "consent to message it; capture consent at intake or in the portal first.",
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

  // ── DPDP: consent is only consent if a notice was given ──────────────────
  //
  // s.5 makes the notice constitutive rather than decorative: consent taken
  // without one, or in a language outside English and the Eighth Schedule, is
  // not informed consent and cannot be relied on.
  if (jurisdiction.requiresConsentNotice) {
    if (!consent.noticeLanguage) {
      return {
        status: "refused",
        reason: "consent-notice-missing",
        detail:
          "No consent notice recorded against this consent. Under the DPDP Act the notice " +
          "is part of what makes consent valid, not paperwork alongside it — record which " +
          "notice was shown and in which language.",
      };
    }
    if (recipient.jurisdiction === "IN" && !isValidNoticeLanguageIN(consent.noticeLanguage)) {
      return {
        status: "refused",
        reason: "consent-notice-missing",
        detail:
          `The notice was recorded in "${consent.noticeLanguage}", which is neither English ` +
          "nor one of the 22 Eighth Schedule languages the DPDP Rules 2025 permit.",
      };
    }
  }

  // ── Registered template / service window ─────────────────────────────────
  //
  // These interact, and the order matters. On a channel with a service window
  // (WhatsApp), an approved template may be sent at any time, and free-form
  // text is permitted *instead* while the window the patient opened is still
  // open. Checking template registration first would make free-form
  // unreachable, which is the bug this ordering exists to avoid. On a channel
  // with no window (India SMS under TRAI DLT), registration is unconditional.
  if (channel.requiresRegisteredTemplate && !context.registeredTemplateId) {
    if (channel.serviceWindowHours) {
      const lastInbound = recipient.lastInboundAt ? Date.parse(recipient.lastInboundAt) : NaN;
      const withinWindow =
        !Number.isNaN(lastInbound) &&
        now.getTime() - lastInbound < channel.serviceWindowHours * 3_600_000;

      if (!withinWindow) {
        return {
          status: "refused",
          reason: "outside-service-window",
          detail:
            `No approved template for "${message.templateId}", and the patient's ` +
            `${channel.serviceWindowHours}-hour service window is closed. Free-form is only ` +
            "permitted while the window the patient opened is still open; outside it, send " +
            "an approved template.",
        };
      }
      // Inside the window: free-form is allowed, fall through.
    } else {
      const isSms = context.channel === "sms";
      return {
        status: "refused",
        reason: isSms ? "dlt-registration-missing" : "whatsapp-template-not-approved",
        detail: isSms
          ? `Template "${message.templateId}" has no TRAI DLT template id. Indian operators ` +
            "discard unregistered traffic rather than delivering it, so this refuses locally " +
            "where the failure is visible instead of vanishing at the operator."
          : `Template "${message.templateId}" has no approved template name.`,
      };
    }
  }

  // ── PHI tier vs channel ceiling ──────────────────────────────────────────
  if (tierRank(message.tier) > tierRank(channel.phiCeiling)) {
    return {
      status: "refused",
      reason: "phi-tier-exceeds-channel",
      detail:
        `Template "${message.templateId}" is classified "${message.tier}" but ${context.channel} ` +
        `in ${jurisdiction.displayName} carries at most "${channel.phiCeiling}". ${channel.note} ` +
        "The message was refused rather than trimmed — send a notification that directs the " +
        "patient to the portal instead.",
    };
  }

  // ── Frequency cap ────────────────────────────────────────────────────────
  const exemptFromCap =
    message.purpose === "appointment-confirmation" || message.purpose === "consent-management";
  if (!exemptFromCap && countRecent(phone, now.getTime()) >= jurisdiction.weeklyCap) {
    return {
      status: "refused",
      reason: "frequency-cap",
      detail:
        `This number has already received ${jurisdiction.weeklyCap} messages in the past 7 days. ` +
        "Sending more is how a reminder system trains patients to ignore it.",
    };
  }

  // ── Quiet hours, by purpose class ────────────────────────────────────────
  const purposeClass = PURPOSE_CLASS[message.purpose];
  const window = jurisdiction.windows[purposeClass];
  const quiet = checkQuietHours(recipient.timeZone, window, now);

  if (quiet.status === "unknown-timezone") {
    return {
      status: "refused",
      reason: "unknown-timezone",
      detail:
        "No usable IANA timezone for this patient, so the local-time window cannot be checked. " +
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
        `the ${String(window.startHour).padStart(2, "0")}:00–${String(window.endHour).padStart(2, "0")}:00 ` +
        `window that ${jurisdiction.displayName} applies to ${purposeClass} messages. ` +
        "Queued for the next open window rather than dropped.",
    };
  }

  return { status: "send", channel: context.channel, body: message.body, scheduledFor: "now" };
}

/** Test/ops helper. Not exposed over HTTP. */
export function resetSendHistory(): void {
  recentSends.clear();
}
