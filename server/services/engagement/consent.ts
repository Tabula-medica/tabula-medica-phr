/**
 * TCPA consent for outbound patient messaging.
 *
 * The rule this module exists to enforce: **a number with no consent record
 * is not a yes.** Marketing platforms routinely treat "we have their number
 * because they're a patient" as permission to text. Having the number is how
 * you can text them; consent is whether you may. Statutory damages run
 * $500–$1,500 per message and there is no de-minimis exception, so a
 * practice-wide reminder blast to an unconsented list is a five-figure
 * mistake before anyone notices.
 *
 * Revocation handling is deliberately blunt:
 *
 *   - Any recognised stop keyword revokes, in any casing, with or without
 *     punctuation.
 *   - Revocation is **global across purposes**, not scoped to the campaign
 *     that prompted it. A patient who texts STOP to a recall message has not
 *     asked to keep receiving appointment reminders; they have asked the
 *     texting to stop.
 *   - Revocation is immediate and persists. Re-consent requires a fresh
 *     affirmative act, never an inference from later portal activity.
 *
 * The FCC also requires honouring revocation by "any reasonable means", so
 * the keyword list is generous rather than minimal, and free-text that
 * clearly reads as a stop request is surfaced for staff review rather than
 * silently ignored.
 */

import type {
  ConsentRecord,
  ConsentState,
  EngagementPurpose,
} from "@shared/engagement";

/**
 * Keywords that revoke on sight.
 *
 * The first five are the CTIA-standard set every aggregator already honours
 * at the carrier level; the rest are common real-world variants that would
 * otherwise reach the practice as an un-actioned inbound message.
 */
const STOP_KEYWORDS: ReadonlySet<string> = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
  "opt-out",
  "remove",
  "revoke",
]);

/** Keywords that re-subscribe. Deliberately short — opting back in should be explicit. */
const START_KEYWORDS: ReadonlySet<string> = new Set(["start", "unstop", "yes", "optin", "opt-in"]);

/** Keywords that must return help text rather than being treated as content. */
const HELP_KEYWORDS: ReadonlySet<string> = new Set(["help", "info"]);

export type InboundIntent = "revoke" | "resubscribe" | "help" | "possible-revoke" | "other";

/**
 * Classify an inbound message.
 *
 * `possible-revoke` is the honest middle: free text that reads like a stop
 * request but is not a keyword ("please stop texting me", "take me off this
 * list"). The FCC expects these to be honoured, but a regex is not a reliable
 * reader of intent, so the engine revokes AND flags for staff review rather
 * than choosing between silently ignoring it and silently acting on a guess.
 */
export function classifyInbound(rawBody: string): InboundIntent {
  const normalised = rawBody
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .trim();

  if (STOP_KEYWORDS.has(normalised)) return "revoke";
  if (START_KEYWORDS.has(normalised)) return "resubscribe";
  if (HELP_KEYWORDS.has(normalised)) return "help";

  // Free text that reads as a stop request. Matched conservatively: the verb
  // and the object both have to be present, so "stop by the front desk" and
  // "I had to cancel my ride" do not trip it.
  const looksLikeStop =
    /\b(stop|quit|cease|no more)\b[\s\S]{0,30}\b(text|message|msg|sms|contact|calling|reminder)/.test(
      normalised,
    ) ||
    /\b(take|remove)\s+me\s+off\b/.test(normalised) ||
    /\b(unsubscribe|opt\s*out)\b/.test(normalised) ||
    /\bdo\s*n[o']?t\s+(text|message|contact)\s+me\b/.test(normalised);

  if (looksLikeStop) return "possible-revoke";

  return "other";
}

/**
 * In-memory consent registry.
 *
 * Deliberately not a PHI table: a phone number plus a consent flag is
 * contact-preference metadata, and keeping it out of the encrypted PHI path
 * means the consent check can run before any PHI is loaded. A production
 * deployment persists this; the interface is what matters here.
 */
const registry = new Map<string, ConsentRecord>();

/** E.164 normalisation. Returns null when the input cannot be one. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    // Already international: 8–15 digits per E.164.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function getConsent(phone: string): ConsentRecord {
  const key = normalizePhone(phone);
  if (!key) {
    return { phone, state: "unknown", purposes: [] };
  }
  return registry.get(key) ?? { phone: key, state: "unknown", purposes: [] };
}

export function grantConsent(params: {
  phone: string;
  purposes: readonly EngagementPurpose[];
  capturedVia: NonNullable<ConsentRecord["capturedVia"]>;
  at?: string;
  /**
   * Language the DPDP notice was shown in, and which notice it was.
   * India requires both: s.5 makes the notice constitutive of valid consent,
   * so a consent record that cannot say what the patient was told is not
   * evidence of informed consent.
   */
  noticeLanguage?: string;
  noticeVersion?: string;
}): ConsentRecord {
  const key = normalizePhone(params.phone);
  if (!key) {
    throw new Error(`"${params.phone}" is not a usable phone number.`);
  }
  const record: ConsentRecord = {
    phone: key,
    state: "granted",
    purposes: [...params.purposes],
    capturedVia: params.capturedVia,
    capturedAt: params.at ?? new Date().toISOString(),
    noticeLanguage: params.noticeLanguage,
    noticeVersion: params.noticeVersion,
  };
  registry.set(key, record);
  return record;
}

/**
 * Revoke. Global across purposes — see the module header for why.
 */
export function revokeConsent(params: {
  phone: string;
  keyword?: string;
  at?: string;
}): ConsentRecord {
  const key = normalizePhone(params.phone);
  if (!key) {
    throw new Error(`"${params.phone}" is not a usable phone number.`);
  }
  const record: ConsentRecord = {
    phone: key,
    state: "revoked",
    purposes: [],
    revokedAt: params.at ?? new Date().toISOString(),
    revokedByKeyword: params.keyword,
  };
  registry.set(key, record);
  return record;
}

export interface InboundResult {
  intent: InboundIntent;
  consent: ConsentRecord;
  /** Reply to send back, or null when no automatic reply is appropriate. */
  autoReply: string | null;
  /** True when a human should look at this message. */
  needsStaffReview: boolean;
}

/**
 * Process one inbound message and apply its effect on consent.
 *
 * HELP and STOP replies are the two the carriers expect to see and are sent
 * regardless of consent state — a confirmation of revocation is not itself a
 * marketing message.
 */
export function handleInbound(params: {
  phone: string;
  body: string;
  practiceName: string;
  at?: string;
}): InboundResult {
  const intent = classifyInbound(params.body);

  switch (intent) {
    case "revoke":
      return {
        intent,
        consent: revokeConsent({
          phone: params.phone,
          keyword: params.body.trim().toLowerCase(),
          at: params.at,
        }),
        autoReply:
          `${params.practiceName}: You are unsubscribed and will get no further texts. ` +
          `Reply START to resubscribe. This does not change your appointments — ` +
          `call the office for anything you need.`,
        needsStaffReview: false,
      };

    case "possible-revoke":
      // Revoke first, ask questions later. Erring toward not-texting costs a
      // reminder; erring the other way is the violation.
      return {
        intent,
        consent: revokeConsent({ phone: params.phone, at: params.at }),
        autoReply:
          `${params.practiceName}: We have stopped texting you. Reply START to resume. ` +
          `Call the office for anything you need.`,
        needsStaffReview: true,
      };

    case "resubscribe":
      // A START keyword restores the baseline appointment-related purposes
      // only. Anything broader has to be captured deliberately elsewhere.
      return {
        intent,
        consent: grantConsent({
          phone: params.phone,
          purposes: [
            "appointment-reminder",
            "appointment-confirmation",
            "pre-visit-preparation",
            "consent-management",
          ],
          capturedVia: "sms-double-optin",
          at: params.at,
        }),
        autoReply:
          `${params.practiceName}: You are resubscribed to appointment messages. ` +
          `Reply STOP to unsubscribe, HELP for help. Msg & data rates may apply.`,
        needsStaffReview: false,
      };

    case "help":
      return {
        intent,
        consent: getConsent(params.phone),
        autoReply:
          `${params.practiceName} appointment messages. Reply STOP to unsubscribe. ` +
          `Msg & data rates may apply. For medical questions call the office; ` +
          `if this is an emergency call 911.`,
        needsStaffReview: false,
      };

    default:
      // A real reply from a patient. Never auto-answer clinical content over
      // SMS — route it to a human.
      return {
        intent,
        consent: getConsent(params.phone),
        autoReply: null,
        needsStaffReview: true,
      };
  }
}

/** Test/ops helper. Not exposed over HTTP. */
export function resetConsentRegistry(): void {
  registry.clear();
}
