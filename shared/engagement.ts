/**
 * Patient engagement — shared types.
 *
 * The engine is jurisdiction-aware, not US-shaped with an international
 * escape hatch. What is lawful to send, to whom, at what hour, over which
 * channel, and in what language differs by country in ways that do not
 * reduce to a feature flag:
 *
 *   **United States.** TCPA governs the act of sending to a mobile number —
 *   prior express consent, immediate revocation, 08:00–21:00 in the
 *   recipient's local time, $500–$1,500 per message. HIPAA separately governs
 *   the content. Both gates, independently.
 *
 *   **India.** The DPDP Act 2023 and the DPDP Rules 2025 (notified November
 *   2025) govern the data: consent must be free, specific, informed,
 *   unconditional and unambiguous, given by clear affirmative action, and
 *   withdrawable as easily as it was given. The notice must be available in
 *   English or any of the 22 languages in the Eighth Schedule. Separately,
 *   TRAI's TCCCPR governs SMS as a telecom resource — registered DLT header,
 *   pre-registered template, 09:00–21:00 for promotional traffic. WhatsApp is
 *   **outside** DLT (it is data-channel, not telecom signalling) and is
 *   governed instead by Meta's Business Messaging Policy: prior opt-in,
 *   pre-approved templates, and a 24-hour service window.
 *
 * Getting this wrong in the safe-looking direction — applying TCPA quiet
 * hours in India, or DLT rules to WhatsApp — produces a system that looks
 * compliant while enforcing the wrong law, which is worse than enforcing
 * nothing because it stops anyone from asking.
 */

export type Jurisdiction = "US" | "IN";

export type EngagementChannel = "sms" | "whatsapp" | "voice" | "email" | "push";

/**
 * How much a channel may carry.
 *
 * Ordered least to most sensitive. A channel+jurisdiction declares its
 * ceiling; a template declares its tier; the send refuses when tier exceeds
 * ceiling.
 */
export type PhiTier =
  /** Nothing patient-specific. "Your clinic has an update for you." */
  | "none"
  /** That a visit exists, when, where, with whom. */
  | "appointment-logistics"
  /** A condition, medication, result, or clinical instruction. */
  | "clinical-detail";

export const PHI_TIER_ORDER: readonly PhiTier[] = [
  "none",
  "appointment-logistics",
  "clinical-detail",
] as const;

/** Why the engine reached out. Drives consent scope, caps, and time windows. */
export type EngagementPurpose =
  | "appointment-reminder"
  | "appointment-confirmation"
  | "pre-visit-preparation"
  | "post-visit-followup"
  | "care-plan-checkin"
  | "recall-reactivation"
  | "consent-management"
  /**
   * Notifying someone that a health summary has been shared with them. The
   * message carries a link and nothing else — the medication, diagnosis and
   * allergy lists it points at are `clinical-detail` and may not travel in a
   * message body on any channel. See `shared/health-summary.ts`.
   */
  | "record-share";

/**
 * Transactional or promotional.
 *
 * The distinction is load-bearing in India: TCCCPR's 09:00–21:00 restriction
 * attaches to promotional traffic, while service messages a patient is
 * expecting are treated differently. Recall of a lapsed patient is
 * promotional however warmly it is worded; an appointment reminder is not.
 */
export type PurposeClass = "transactional" | "promotional";

export const PURPOSE_CLASS: Record<EngagementPurpose, PurposeClass> = {
  "appointment-reminder": "transactional",
  "appointment-confirmation": "transactional",
  "pre-visit-preparation": "transactional",
  "post-visit-followup": "transactional",
  "care-plan-checkin": "transactional",
  // Reaching out to someone who has not been seen in a year is marketing,
  // whatever the copy says. Classifying it honestly is what keeps it inside
  // the promotional rules instead of quietly outside them.
  "recall-reactivation": "promotional",
  "consent-management": "transactional",
  // A summary the patient asked for, or that their clinician is sending
  // them. Nothing is being marketed, so the promotional windows do not apply.
  "record-share": "transactional",
};

/**
 * Meta's WhatsApp template categories.
 *
 * Not cosmetic: category determines pricing, whether a template survives
 * review, and what may be sent outside the 24-hour service window.
 */
export type WhatsAppCategory = "utility" | "marketing" | "authentication" | "service";

/** DPDP / TCPA consent state for one contact point. */
export type ConsentState = "granted" | "revoked" | "unknown";

export interface ConsentRecord {
  /** E.164. */
  phone: string;
  state: ConsentState;
  purposes: readonly EngagementPurpose[];
  capturedVia?:
    | "patient-portal"
    | "intake-form"
    | "verbal-documented"
    | "sms-double-optin"
    | "whatsapp-optin";
  capturedAt?: string;
  revokedAt?: string;
  revokedByKeyword?: string;
  /**
   * DPDP Act s.5: the notice shown when consent was taken, and the language
   * it was shown in. A consent with no recorded notice is not informed
   * consent, and India requires the notice itself to be retrievable.
   */
  noticeLanguage?: string;
  noticeVersion?: string;
}

export interface EngagementRecipient {
  patientId: string;
  /** E.164. */
  phone: string;
  /** BCP-47 / ISO 639-1. */
  languageCode: string;
  /** IANA timezone. Absent is handled as absent, never as the practice's. */
  timeZone?: string;
  /** Which country's rules govern this patient. */
  jurisdiction: Jurisdiction;
  /**
   * Last inbound message from this patient, ISO-8601. Opens WhatsApp's
   * 24-hour service window, inside which free-form replies are permitted.
   */
  lastInboundAt?: string;
}

export interface EngagementMessage {
  templateId: string;
  purpose: EngagementPurpose;
  tier: PhiTier;
  body: string;
}

export type SendDecision =
  | { status: "send"; channel: EngagementChannel; body: string; scheduledFor: "now" }
  | {
      status: "deferred";
      channel: EngagementChannel;
      sendAfter: string;
      reason: "quiet-hours";
      detail: string;
    }
  | { status: "refused"; reason: SendRefusal; detail: string };

export type SendRefusal =
  | "no-consent"
  | "consent-revoked"
  | "purpose-not-consented"
  | "phi-tier-exceeds-channel"
  | "frequency-cap"
  | "unknown-timezone"
  | "invalid-phone"
  | "channel-not-configured"
  | "channel-not-permitted-in-jurisdiction"
  /** India SMS: no registered DLT header / pre-registered template id. */
  | "dlt-registration-missing"
  /** WhatsApp: template not approved by Meta, or free-form outside the window. */
  | "whatsapp-template-not-approved"
  | "outside-service-window"
  /** DPDP: consent taken without a recorded notice, or in no valid language. */
  | "consent-notice-missing";
