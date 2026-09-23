/**
 * Shareable health summary — medications, diagnoses, allergies.
 *
 * These three lists are what someone actually needs when a patient turns up
 * somewhere new: at an urgent care, at a pharmacy, in front of a relative who
 * has to answer "what does she take?". They are also the three *required*
 * sections of the International Patient Summary, so this module reuses the
 * data `ips-generator.ts` already collects rather than inventing a second
 * shape for the same facts.
 *
 * ## The channel constraint this module exists to satisfy
 *
 * A medication list, a problem list and an allergy list are all
 * `clinical-detail` — the top PHI tier. Both SMS and WhatsApp sit below that
 * ceiling in both jurisdictions (see `jurisdictions.ts`), so the send gate
 * refuses to put any of this content in a message body, and it should: an SMS
 * is stored in plaintext on the handset, in the carrier's logs, and in
 * whatever backup the handset syncs to, and it is displayed on a lock screen
 * to whoever is holding the phone.
 *
 * So the message carries a **link, never the list**. The link is short-lived,
 * revocable, view-capped, and optionally PIN-gated; the content renders over
 * TLS on a page that is never indexed and never cached. The message body stays
 * at `appointment-logistics` — it discloses that a clinic has something for
 * you, which is the same disclosure an appointment reminder makes — and the
 * clinical detail stays off the wire.
 *
 * ## Who is sending matters more than what is sent
 *
 * Three flows, governed differently, and conflating them is how a system ends
 * up either unlawful or uselessly locked down:
 *
 *   1. **Clinic → its own patient.** A covered-entity disclosure. The full
 *      gate applies: consent, quiet hours, frequency cap, channel ceiling. In
 *      the US this means WhatsApp is refused outright, because Meta signs no
 *      BAA and the US WhatsApp ceiling is therefore `none`.
 *
 *   2. **Patient → anyone they choose, from their own handset.** The patient
 *      is not a covered entity and the practice is not the sender, so neither
 *      HIPAA's disclosure rules nor TCPA's consent rules attach to the act of
 *      sending. The server mints the link and hands back a pre-filled `sms:`
 *      or `wa.me` intent; the patient's own device sends it, from the
 *      patient's own number, to a recipient the patient picked. This is the
 *      default path for "text my med list to my daughter", and it is the only
 *      one of the three that needs no consent record for the recipient.
 *
 *   3. **Clinic → a third party at the patient's request.** The practice is
 *      the sender, so the *recipient's* consent is what TCPA looks for — the
 *      patient cannot consent on the recipient's behalf. Same gate as (1),
 *      run against the third party's number.
 *
 * Flow 2 is not a workaround. It is the correct architecture: it moves the
 * send outside the regulated perimeter entirely while giving the patient
 * exactly the thing they asked for.
 */

/** The three lists this module shares. Each maps to a required IPS section. */
export type SummarySection = "medications" | "diagnoses" | "allergies";

export const SUMMARY_SECTIONS: readonly SummarySection[] = [
  "medications",
  "diagnoses",
  "allergies",
] as const;

/**
 * Who initiated the share. Drives which regulatory path applies, and whether
 * the server is permitted to send anything at all.
 */
export type ShareInitiator = "patient" | "clinic";

/** How the link reaches its recipient. */
export type ShareDelivery =
  /** Server sends via the engagement gate. Clinic-initiated only. */
  | "server-sms"
  | "server-whatsapp"
  /** Server returns an intent URL; the patient's own device sends it. */
  | "handoff-sms"
  | "handoff-whatsapp"
  /** Server returns the URL; the patient copies it wherever they like. */
  | "copy-link";

/**
 * Why a section is empty.
 *
 * This distinction is the single most safety-critical thing in the module. A
 * blank allergy section reads to every human being as "no allergies", and a
 * reader acting on that can kill someone with a drug that was known to cause
 * anaphylaxis but was never typed in. An empty table means nobody recorded
 * anything; it does not mean anybody asked.
 *
 * So an empty section renders as `not-recorded` — stated in words, not
 * implied by whitespace — unless somebody affirmatively attested that the
 * answer is none, which produces `attested-none`.
 */
export type EmptyStateKind = "attested-none" | "not-recorded";

/**
 * Affirmative "there are none" statements. Absent a flag here, an empty list
 * is `not-recorded`, never `attested-none`.
 */
export interface SummaryAttestations {
  noKnownAllergies?: boolean;
  noKnownMedications?: boolean;
  noKnownProblems?: boolean;
}

export interface SummaryLine {
  /** Drug name, condition name, allergen. Always present. */
  primary: string;
  /** Dose and frequency, onset date, reaction and severity. */
  secondary?: string;
  /** Status when it is not the default — "stopped", "resolved", "inactive". */
  status?: string;
}

export interface SummarySectionRender {
  key: SummarySection;
  heading: string;
  lines: SummaryLine[];
  /** Set when `lines` is empty. Says which kind of empty, in words. */
  emptyState?: { kind: EmptyStateKind; text: string };
}

export interface HealthSummary {
  patientName: string;
  /** ISO 8601. Rendered in the reader's locale by the view. */
  generatedAt: string;
  /** Language actually used. */
  language: string;
  /** True when the requested language had no strings and English was used. */
  fellBackToEnglish: boolean;
  sections: SummarySectionRender[];
  /**
   * Caveats the reader must see — an unattested empty section, a section the
   * patient chose not to share, a summary older than its data. These are
   * rendered prominently rather than in a footnote, because the failure mode
   * is a reader treating an incomplete list as a complete one.
   */
  warnings: string[];
  /** Standing disclaimer: this is a summary, not the complete record. */
  disclaimer: string;
}

// ── Share grants ────────────────────────────────────────────────────────────

export interface ShareGrant {
  id: string;
  profileId: string;
  /** Which of the three lists this link exposes. Never widens after minting. */
  sections: readonly SummarySection[];
  initiator: ShareInitiator;
  /** Account that minted it, for the audit trail. */
  createdByAccountId: string;
  createdAt: string;
  expiresAt: string;
  /** Views allowed before the link dies. Re-reads are legitimate; scraping is not. */
  maxViews: number;
  viewCount: number;
  /**
   * Wrong PINs so far. Deliberately separate from `viewCount`: a failed
   * attempt must not consume a view (or guessing becomes a way to exhaust
   * somebody else's link) but it must still cost something, or guessing is
   * free. Two counters, two different things to protect.
   */
  pinAttempts: number;
  /** Set when `pinAttempts` hit the cap. The grant is finished. */
  lockedAt?: string;
  revokedAt?: string;
  revokedReason?: string;
  language: string;
  /** True when a PIN must be supplied alongside the token. */
  pinRequired: boolean;
  /**
   * Free-text label the patient gave the share ("Dr Rao", "Mum"), so a
   * revocation list is readable. Never rendered into the summary itself.
   */
  label?: string;
}

/** Everything a caller may be told about a grant. Excludes the token. */
export type ShareGrantView = Omit<ShareGrant, "profileId" | "createdByAccountId">;

export type ShareRefusalReason =
  /** No sections selected — an empty share is a link to nothing. */
  | "no-sections-selected"
  /** Requested lifetime exceeds the hard cap. */
  | "expiry-exceeds-maximum"
  /** Requested view cap exceeds the hard cap. */
  | "views-exceed-maximum"
  /** Patient-initiated flows may not ask the server to send. */
  | "server-send-requires-clinic-initiation"
  /** The profile has no data at all for any selected section, unattested. */
  | "nothing-to-share"
  /** Public base URL is not configured, so no link can be built. */
  | "share-base-url-not-configured";

export type ShareLookupFailure =
  | "token-not-found"
  | "token-expired"
  | "token-revoked"
  | "view-cap-reached"
  | "pin-required"
  | "pin-incorrect"
  /**
   * Too many wrong PINs. The grant is dead and a new link must be minted.
   *
   * A 6-digit PIN is a million-wide space, which is nothing to a machine and
   * everything to a person typing it once. Capping attempts is what makes the
   * PIN a control rather than a speed bump: without it, anyone holding a live
   * link — a forwarded message, an intercepted SMS — walks the space at
   * leisure inside the link's own lifetime.
   */
  | "pin-locked";

/** Hard caps. Requests above these are refused, not silently clamped. */
export const SHARE_LIMITS = {
  /** Default lifetime when the caller does not choose one. */
  DEFAULT_TTL_HOURS: 24,
  /**
   * A link to somebody's full medication and allergy list should not outlive
   * the errand that prompted it. Seven days covers "my appointment is next
   * Tuesday"; anything longer is a standing disclosure and should be a
   * portal account instead.
   */
  MAX_TTL_HOURS: 24 * 7,
  DEFAULT_MAX_VIEWS: 10,
  MAX_MAX_VIEWS: 50,
  /**
   * Wrong PINs before the grant locks. Five is generous for someone reading a
   * number off a message and stingy for someone walking 10^6.
   *
   * The cost of the cap is that whoever holds the link can lock it. That is
   * the right trade: a locked link is recoverable by minting another, and a
   * disclosed medication and allergy list is not recoverable at all.
   */
  MAX_PIN_ATTEMPTS: 5,
  /** Token entropy in bytes, before base64url encoding. */
  TOKEN_BYTES: 32,
  PIN_LENGTH: 6,
} as const;
