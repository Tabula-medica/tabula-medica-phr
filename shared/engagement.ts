/**
 * Patient engagement — shared types.
 *
 * The engine is channel-agnostic on purpose. What a channel is *allowed to
 * carry* is the part that differs, and it is not a matter of taste: SMS
 * traverses carrier infrastructure that no BAA covers end to end, so the
 * content ceiling is a compliance boundary, not a style preference.
 *
 * Two separate bodies of law apply to an outbound patient text and they do
 * not overlap:
 *
 *   - **HIPAA** permits appointment reminders and treatment communications
 *     without separate authorisation. It does not make SMS a safe place to
 *     put clinical detail.
 *   - **TCPA** governs the act of sending to a mobile number at all. Prior
 *     express consent is required, revocation must be honoured immediately
 *     and by any reasonable means, and calls/texts are confined to
 *     8:00–21:00 in the *recipient's* local time.
 *
 * A message can be perfectly fine under HIPAA and still be a TCPA violation.
 * Both gates are enforced separately below.
 */

/** Delivery channels. Voice is declared here; only SMS is wired today. */
export type EngagementChannel = "sms" | "voice" | "email" | "push";

/**
 * How much a channel may carry.
 *
 * Ordered least to most sensitive. A channel declares its ceiling; a template
 * declares its tier; the send refuses when tier exceeds ceiling.
 */
export type PhiTier =
  /** No patient-specific content at all. "Your clinic has an update for you." */
  | "none"
  /**
   * Logistics only: that an appointment exists, when, where, with whom.
   * The fact of a visit is PHI, but it is the minimum necessary for the
   * reminder to work, and HIPAA contemplates exactly this use.
   */
  | "appointment-logistics"
  /**
   * Names a condition, medication, result, or clinical instruction.
   * Never permitted on SMS by this system.
   */
  | "clinical-detail";

export const PHI_TIER_ORDER: readonly PhiTier[] = [
  "none",
  "appointment-logistics",
  "clinical-detail",
] as const;

/**
 * The content ceiling for each channel.
 *
 * SMS stops at appointment logistics. Carrier networks, device lock screens,
 * and shared family handsets are all outside any agreement this deployment
 * holds, so a lab result or a medication name does not go out over one —
 * the message says a result is ready and sends the patient to the portal.
 */
export const CHANNEL_PHI_CEILING: Record<EngagementChannel, PhiTier> = {
  sms: "appointment-logistics",
  voice: "appointment-logistics",
  email: "none",
  push: "none",
};

/** Why the engine reached out. Drives frequency caps and consent scope. */
export type EngagementPurpose =
  | "appointment-reminder"
  | "appointment-confirmation"
  | "pre-visit-preparation"
  | "post-visit-followup"
  | "care-plan-checkin"
  | "recall-reactivation"
  | "consent-management";

/**
 * TCPA consent state for one phone number.
 *
 * `unknown` is a distinct state from `revoked` and both block sending. A
 * number with no consent record is not an implied yes.
 */
export type ConsentState = "granted" | "revoked" | "unknown";

export interface ConsentRecord {
  /** E.164. */
  phone: string;
  state: ConsentState;
  /** Purposes the patient agreed to. Empty on revoke. */
  purposes: readonly EngagementPurpose[];
  /** How consent was captured — needed if the practice is ever challenged. */
  capturedVia?: "patient-portal" | "intake-form" | "verbal-documented" | "sms-double-optin";
  capturedAt?: string;
  revokedAt?: string;
  /** The inbound keyword that revoked, when revocation came by text. */
  revokedByKeyword?: string;
}

export interface EngagementRecipient {
  patientId: string;
  /** E.164. */
  phone: string;
  /** BCP-47 / ISO 639-1 code from the supported-language registry. */
  languageCode: string;
  /**
   * IANA timezone, e.g. "America/Chicago". Required for quiet hours.
   * Absent is handled as absent — never as the practice's own timezone.
   */
  timeZone?: string;
}

export interface EngagementMessage {
  templateId: string;
  purpose: EngagementPurpose;
  tier: PhiTier;
  /** Rendered, localised body. */
  body: string;
}

/** The outcome of asking to send. Refusals are typed and explain themselves. */
export type SendDecision =
  | { status: "send"; channel: EngagementChannel; body: string; scheduledFor: "now" }
  | {
      status: "deferred";
      channel: EngagementChannel;
      /** ISO-8601 instant when the quiet-hours window next opens. */
      sendAfter: string;
      reason: "quiet-hours";
      detail: string;
    }
  | {
      status: "refused";
      reason: SendRefusal;
      detail: string;
    };

export type SendRefusal =
  | "no-consent"
  | "consent-revoked"
  | "purpose-not-consented"
  | "phi-tier-exceeds-channel"
  | "frequency-cap"
  | "unknown-timezone"
  | "invalid-phone"
  | "channel-not-configured";
