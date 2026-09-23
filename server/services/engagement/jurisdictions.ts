/**
 * Per-jurisdiction messaging policy.
 *
 * One table, so the difference between countries is legible in one place
 * rather than scattered through the sender as conditionals. Each field below
 * traces to a specific instrument, named in the comment, because a rule
 * nobody can trace is a rule nobody can update when the law moves.
 */

import {
  type EngagementChannel,
  type Jurisdiction,
  type PhiTier,
  type PurposeClass,
} from "@shared/engagement";

export interface TimeWindow {
  /** Inclusive, recipient local time. */
  startHour: number;
  /** Exclusive — this hour is already too late. */
  endHour: number;
}

export interface ChannelPolicy {
  /** Whether this channel may be used at all in this jurisdiction. */
  permitted: boolean;
  /** Most sensitive content this channel may carry here. */
  phiCeiling: PhiTier;
  /**
   * Sending requires a pre-registered template id issued by a regulator or
   * platform — India SMS (TRAI DLT) and WhatsApp everywhere (Meta review).
   */
  requiresRegisteredTemplate: boolean;
  /** Free-form text is only permitted inside a recent-inbound window. */
  serviceWindowHours?: number;
  note: string;
}

export interface JurisdictionPolicy {
  jurisdiction: Jurisdiction;
  displayName: string;
  /** The instruments this policy encodes, for the audit trail. */
  legalBasis: readonly string[];
  /** Time windows by purpose class, in the recipient's local time. */
  windows: Record<PurposeClass, TimeWindow>;
  channels: Record<EngagementChannel, ChannelPolicy>;
  /** Messages per rolling week before the engine stops. */
  weeklyCap: number;
  /**
   * Whether a recorded consent notice is required before any send.
   * India: yes — DPDP s.5 makes the notice part of what consent *is*.
   */
  requiresConsentNotice: boolean;
  /** Languages the consent notice may lawfully be presented in. */
  noticeLanguagePolicy: string;
}

const US_POLICY: JurisdictionPolicy = {
  jurisdiction: "US",
  displayName: "United States",
  legalBasis: [
    "47 U.S.C. 227 (TCPA) — prior express consent, revocation by any reasonable means",
    "47 C.F.R. 64.1200 — 8:00–21:00 in the called party's local time",
    "45 C.F.R. 164.502(b) (HIPAA) — minimum necessary",
  ],
  windows: {
    // TCPA's time restriction is written for telephone solicitations. Applying
    // it to transactional traffic too is deliberately conservative: the
    // distinction is litigated, the cost of being wrong is per-message
    // statutory damages, and nobody has ever been sued for texting at 10am.
    transactional: { startHour: 8, endHour: 21 },
    promotional: { startHour: 8, endHour: 21 },
  },
  channels: {
    sms: {
      permitted: true,
      phiCeiling: "appointment-logistics",
      requiresRegisteredTemplate: false,
      note: "Twilio is BAA-eligible. Content still stops at logistics — carrier networks and lock screens are outside any agreement held here.",
    },
    whatsapp: {
      permitted: true,
      // The whole point of the tier system. Meta does not sign a BAA for the
      // WhatsApp Business API, so nothing patient-specific may cross it in a
      // HIPAA jurisdiction — not even the fact that an appointment exists.
      phiCeiling: "none",
      requiresRegisteredTemplate: true,
      serviceWindowHours: 24,
      note: "No BAA available from Meta. Permitted only for content that identifies no patient — a 'your clinic has an update' nudge to the portal.",
    },
    voice: {
      permitted: true,
      phiCeiling: "appointment-logistics",
      requiresRegisteredTemplate: false,
      note: "Declared; no telephony adapter is wired yet.",
    },
    email: {
      permitted: true,
      phiCeiling: "none",
      requiresRegisteredTemplate: false,
      note: "Operational email stays PHI-free by house rule even where the vendor is BAA-eligible.",
    },
    push: {
      permitted: true,
      phiCeiling: "none",
      requiresRegisteredTemplate: false,
      note: "Lock-screen previews are outside the app's control.",
    },
  },
  weeklyCap: 5,
  requiresConsentNotice: false,
  noticeLanguagePolicy:
    "No statutory language requirement. Templates are translated for the practice's population.",
};

const IN_POLICY: JurisdictionPolicy = {
  jurisdiction: "IN",
  displayName: "India",
  legalBasis: [
    "Digital Personal Data Protection Act 2023, ss.5–6 — notice, and consent that is free, specific, informed, unconditional and unambiguous",
    "DPDP Act 2023 s.6(4) — withdrawal must be as easy as the giving",
    "Digital Personal Data Protection Rules 2025 (notified November 2025)",
    "TRAI TCCCPR 2018 — DLT registration, registered header, pre-registered template; 09:00–21:00 for promotional traffic",
    "Meta WhatsApp Business Messaging Policy — prior opt-in, template approval, 24-hour service window",
  ],
  windows: {
    // TCCCPR's clock restriction attaches to promotional traffic. Service
    // messages a patient is expecting are not confined to it, but a clinic
    // texting at 03:00 is not a clinic anyone thanks, so transactional gets a
    // civil window rather than none.
    transactional: { startHour: 7, endHour: 22 },
    promotional: { startHour: 9, endHour: 21 },
  },
  channels: {
    sms: {
      permitted: true,
      // No HIPAA here, but DPDP's purpose limitation and the practical
      // reality of shared handsets land in the same place.
      phiCeiling: "appointment-logistics",
      // The India-specific one people miss: an unregistered header or an
      // unapproved template is not "delivered with a warning", it is dropped
      // by the operator. Refusing locally makes the failure visible.
      requiresRegisteredTemplate: true,
      note: "TRAI DLT: registered sender header and pre-registered template are mandatory. Unregistered traffic is discarded by the operator, not delivered.",
    },
    whatsapp: {
      permitted: true,
      // WhatsApp is the primary channel here, and DPDP has no HIPAA-style
      // BAA construct — the obligation runs to the Data Fiduciary directly,
      // so appointment logistics are permissible with consent.
      phiCeiling: "appointment-logistics",
      requiresRegisteredTemplate: true,
      serviceWindowHours: 24,
      note: "Outside TRAI DLT — WhatsApp is data-channel, not telecom signalling. Governed by Meta: prior opt-in, approved template, 24-hour service window for free-form replies.",
    },
    voice: {
      permitted: true,
      phiCeiling: "appointment-logistics",
      requiresRegisteredTemplate: false,
      note: "Declared; no telephony adapter is wired yet.",
    },
    email: {
      permitted: true,
      phiCeiling: "none",
      requiresRegisteredTemplate: false,
      note: "PHI-free by house rule.",
    },
    push: {
      permitted: true,
      phiCeiling: "none",
      requiresRegisteredTemplate: false,
      note: "Lock-screen previews are outside the app's control.",
    },
  },
  weeklyCap: 5,
  requiresConsentNotice: true,
  noticeLanguagePolicy:
    "DPDP Rules 2025: the notice must be available in English or any of the 22 languages in the Eighth Schedule to the Constitution.",
};

export const JURISDICTIONS: Record<Jurisdiction, JurisdictionPolicy> = {
  US: US_POLICY,
  IN: IN_POLICY,
};

export function policyFor(jurisdiction: Jurisdiction): JurisdictionPolicy {
  return JURISDICTIONS[jurisdiction];
}

export function channelPolicy(
  jurisdiction: Jurisdiction,
  channel: EngagementChannel,
): ChannelPolicy {
  return JURISDICTIONS[jurisdiction].channels[channel];
}
