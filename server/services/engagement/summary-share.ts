/**
 * Share grants — mint, redeem, revoke the links that carry a health summary.
 *
 * The message sends a link; the link resolves to a page; the page renders the
 * summary. Nothing clinical crosses SMS or WhatsApp. See `shared/health-summary.ts`
 * for why that split exists and what the three initiation flows are.
 *
 * ## The two jurisdictions disagree about what this feature *is*
 *
 * In the United States, transmitting a patient's own record where they direct
 * is a **duty**. 45 CFR 164.524(c)(2)(i)-(ii) requires the copy in the form
 * and format the individual asks for where readily producible; OCR's right of
 * access guidance reads mail and email as readily producible, so a request to
 * send by an unsecured channel must be honoured after a brief warning about
 * interception risk, and the covered entity is not responsible for a
 * disclosure occurring in transit once that warning was given and accepted.
 * Worth stating plainly for anyone who goes looking: **the regulation itself
 * never mentions email, SMS, or encryption.** The duty is built from the
 * general form-and-format rule plus OCR interpretation, so a reader who
 * greps 164.524 for "unencrypted" and finds nothing has not found a gap.
 *
 * In India there is no equivalent. The DPDP Act 2023 gives a Data Principal
 * rights to information about processing (s.11), correction and erasure
 * (s.12), grievance redressal (s.13) and nomination (s.14) — **there is no
 * right to data portability and no duty to transmit to a third party.**
 * Portability appeared in the 2019 Bill and was dropped. So the same button
 * is a right the practice must honour in Chicago and a discretionary
 * disclosure the practice must justify in Mumbai, where sharing to a third
 * party is a fresh purpose needing its own s.6 consent and s.5 notice.
 *
 * Encoding that asymmetry is the point. A single "share" feature with one
 * compliance story would be wrong in one of the two countries.
 *
 * ## Storage
 *
 * In memory, matching the rest of this module. Two consequences that must be
 * closed before this carries real patient data, and are stated here rather
 * than discovered later:
 *
 *   - A restart drops every outstanding grant. Links stop working. That fails
 *     in the safe direction — a dead link discloses nothing — but it is not
 *     acceptable behaviour for a patient who handed the link to their doctor.
 *   - **Revocation does not propagate across instances.** With more than one
 *     process serving traffic, a revoke on one does not stop a read on
 *     another. This one fails *unsafely* and is the reason the module must
 *     move to shared storage before a multi-instance deployment.
 */

import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import {
  SHARE_LIMITS,
  SUMMARY_SECTIONS,
  type ShareDelivery,
  type ShareGrant,
  type ShareGrantView,
  type ShareInitiator,
  type ShareLookupFailure,
  type ShareRefusalReason,
  type SummarySection,
} from "@shared/health-summary";
import type { Jurisdiction } from "@shared/engagement";

/**
 * A written direction under 45 CFR 164.524(c)(3)(ii), which requires the
 * individual's request to be in writing, signed by the individual, and to
 * clearly identify both the designated person and where to send the copy.
 *
 * Since *Ciox Health, LLC v. Azar*, 435 F. Supp. 3d 30 (D.D.C. 2020), the
 * mandatory third-party directive reaches electronic PHI held in an EHR and
 * requested in electronic form; the court vacated the directive insofar as it
 * extended past that, and held the (c)(4) fee cap inapplicable to third-party
 * transmittals. A medication, problem and allergy list sent electronically is
 * inside what survives — but a comment citing (c)(3)(ii) as a flat mandate
 * without citing Ciox would be wrong, so it is cited here.
 *
 * This record is **separate from** the recipient's TCPA consent and must not
 * be collapsed into it. The patient's signed direction authorises the
 * disclosure; it does not authorise texting the recipient's mobile. Those are
 * two different permissions from two different people.
 */
export interface ThirdPartyDirective {
  /** ISO 8601. */
  recordedAt: string;
  /** Reference to the stored signed writing — not the writing itself. */
  signatureRef: string;
  /** Who the individual designated. */
  designatedPerson: string;
  /** Where they said to send it. */
  destination: string;
}

/** Per-jurisdiction rules for sharing a record with someone else. */
export interface SharePolicy {
  jurisdiction: Jurisdiction;
  /**
   * True where transmitting at the individual's direction is an enforceable
   * right rather than a favour the practice may decline.
   */
  transmissionIsADuty: boolean;
  /** True where (c)(3)(ii)'s signed writing is required for a third party. */
  requiresSignedDirective: boolean;
  /** True where a distinct, purpose-specific consent must exist to disclose. */
  requiresFreshPurposeConsent: boolean;
  legalBasis: readonly string[];
}

export const SHARE_POLICIES: Record<Jurisdiction, SharePolicy> = {
  US: {
    jurisdiction: "US",
    transmissionIsADuty: true,
    requiresSignedDirective: true,
    requiresFreshPurposeConsent: false,
    legalBasis: [
      "45 CFR 164.524(c)(2)(i)-(ii) — copy in the form and format requested where readily producible",
      "45 CFR 164.524(c)(3)(ii) — written, signed direction to a designated third party",
      "HHS OCR right of access guidance — unsecured transmission honoured after a risk warning; no responsibility for interception in transit",
      "Ciox Health, LLC v. Azar, 435 F. Supp. 3d 30 (D.D.C. 2020) — third-party directive vacated as expanded beyond electronic PHI from an EHR in electronic form",
    ],
  },
  IN: {
    jurisdiction: "IN",
    transmissionIsADuty: false,
    requiresSignedDirective: false,
    requiresFreshPurposeConsent: true,
    legalBasis: [
      "DPDP Act 2023 s.4 — processing only for a lawful purpose on consent or a legitimate use",
      "DPDP Act 2023 s.6 — consent free, specific, informed, unconditional, unambiguous; a new purpose needs fresh consent",
      "DPDP Act 2023 s.5 and DPDP Rules 2025 r.3 — itemised notice; the Fiduciary bears the burden of proving it was given",
      "DPDP Act 2023 ss.11-14 — no portability right and no duty to transmit to a third party (dropped from the 2019 Bill)",
    ],
  },
};

export function sharePolicyFor(jurisdiction: Jurisdiction): SharePolicy {
  return SHARE_POLICIES[jurisdiction];
}

// ── Registry ────────────────────────────────────────────────────────────────

interface StoredGrant extends ShareGrant {
  /** SHA-256 of the token, hex. The token itself is never stored. */
  tokenHash: string;
  /** scrypt(pin, salt) when a PIN is set. */
  pinHash?: Buffer;
  pinSalt?: Buffer;
  directive?: ThirdPartyDirective;
}

const grants = new Map<string, StoredGrant>();
/** tokenHash -> grant id. */
const byTokenHash = new Map<string, string>();

/** Test seam. Never called from request paths. */
export function __resetShares(): void {
  grants.clear();
  byTokenHash.clear();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashPin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, 32);
}

function toView(grant: StoredGrant): ShareGrantView {
  const { profileId: _p, createdByAccountId: _c, tokenHash: _t, pinHash: _ph, pinSalt: _ps, directive: _d, ...view } =
    grant as StoredGrant & Record<string, unknown>;
  return view as ShareGrantView;
}

// ── Minting ─────────────────────────────────────────────────────────────────

export interface MintShareParams {
  profileId: string;
  createdByAccountId: string;
  sections: readonly SummarySection[];
  initiator: ShareInitiator;
  jurisdiction: Jurisdiction;
  delivery: ShareDelivery;
  language: string;
  ttlHours?: number;
  maxViews?: number;
  /** Ask for a PIN. Generated here so it never comes from a caller's guess. */
  withPin?: boolean;
  label?: string;
  directive?: ThirdPartyDirective;
  /** ISO 8601, injected for testability. */
  now?: Date;
}

export type MintShareResult =
  | {
      ok: true;
      grant: ShareGrantView;
      /** Shown once. Never stored, never logged, never returned again. */
      token: string;
      url: string;
      /** Present only when a PIN was requested. Shown once. */
      pin?: string;
    }
  | { ok: false; reason: ShareRefusalReason; detail: string };

/**
 * The public origin share links are built on.
 *
 * Unset refuses rather than falling back to a request header: `Host` is
 * attacker-controlled, and a link built from it would point wherever the
 * attacker said, which is a phishing primitive handed out under the clinic's
 * own name in the clinic's own SMS.
 */
export function shareBaseUrl(raw = process.env.HEALTH_SHARE_BASE_URL): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function mintShare(params: MintShareParams): MintShareResult {
  const now = params.now ?? new Date();

  const sections = SUMMARY_SECTIONS.filter((s) => params.sections.includes(s));
  if (sections.length === 0) {
    return {
      ok: false,
      reason: "no-sections-selected",
      detail:
        "A share with no sections is a link to an empty page. Select at least one of " +
        `${SUMMARY_SECTIONS.join(", ")}.`,
    };
  }

  // A patient-initiated share hands the link back to the patient's own device.
  // Letting it ask the server to send would put the practice back in the
  // sender's chair — and under TCPA the consent that matters then belongs to
  // the recipient, which the patient cannot supply on their behalf.
  const serverSends = params.delivery === "server-sms" || params.delivery === "server-whatsapp";
  if (serverSends && params.initiator === "patient") {
    return {
      ok: false,
      reason: "server-send-requires-clinic-initiation",
      detail:
        "A patient-initiated share returns a link for the patient's own handset to send. " +
        "Asking the server to send makes the practice the sender, and TCPA then requires the " +
        "recipient's own prior express consent — which the patient cannot give on their behalf.",
    };
  }

  const ttlHours = params.ttlHours ?? SHARE_LIMITS.DEFAULT_TTL_HOURS;
  if (ttlHours <= 0 || ttlHours > SHARE_LIMITS.MAX_TTL_HOURS) {
    return {
      ok: false,
      reason: "expiry-exceeds-maximum",
      detail:
        `Requested ${ttlHours}h; the cap is ${SHARE_LIMITS.MAX_TTL_HOURS}h. A link to somebody's ` +
        "medication and allergy list should not outlive the errand that prompted it. Refused " +
        "rather than silently shortened, so the caller knows what it got.",
    };
  }

  const maxViews = params.maxViews ?? SHARE_LIMITS.DEFAULT_MAX_VIEWS;
  if (maxViews <= 0 || maxViews > SHARE_LIMITS.MAX_MAX_VIEWS) {
    return {
      ok: false,
      reason: "views-exceed-maximum",
      detail: `Requested ${maxViews} views; the cap is ${SHARE_LIMITS.MAX_MAX_VIEWS}.`,
    };
  }

  const base = shareBaseUrl();
  if (!base) {
    return {
      ok: false,
      reason: "share-base-url-not-configured",
      detail:
        "HEALTH_SHARE_BASE_URL is unset or is not an https origin, so no link can be built. " +
        "It is not derived from the request Host header: that is attacker-controlled, and a " +
        "link built from it would be a phishing target sent under the clinic's own name.",
    };
  }

  const token = randomBytes(SHARE_LIMITS.TOKEN_BYTES).toString("base64url");
  const tokenHash = sha256Hex(token);

  let pin: string | undefined;
  let pinHash: Buffer | undefined;
  let pinSalt: Buffer | undefined;
  if (params.withPin) {
    // randomInt is rejection-sampled, so the digits are uniform. A PIN built
    // from Math.random would be predictable enough to walk.
    pin = Array.from({ length: SHARE_LIMITS.PIN_LENGTH }, () => randomInt(0, 10)).join("");
    pinSalt = randomBytes(16);
    pinHash = hashPin(pin, pinSalt);
  }

  const grant: StoredGrant = {
    id: randomUUID(),
    profileId: params.profileId,
    createdByAccountId: params.createdByAccountId,
    sections,
    initiator: params.initiator,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlHours * 3_600_000).toISOString(),
    maxViews,
    viewCount: 0,
    language: params.language,
    pinRequired: Boolean(params.withPin),
    label: params.label,
    tokenHash,
    pinHash,
    pinSalt,
    directive: params.directive,
  };

  grants.set(grant.id, grant);
  byTokenHash.set(tokenHash, grant.id);

  return {
    ok: true,
    grant: toView(grant),
    token,
    url: `${base}/s/${token}`,
    pin,
  };
}

// ── Redemption ──────────────────────────────────────────────────────────────

export type RedeemResult =
  | { ok: true; grant: StoredGrant }
  | { ok: false; failure: ShareLookupFailure; detail: string };

/**
 * Resolve a token to its grant, enforcing expiry, revocation, the view cap and
 * the PIN. Every failure path returns without disclosing whether the token
 * existed, beyond the coarse reason — a caller probing tokens learns nothing
 * about which random strings are real.
 *
 * The view counter increments only on a fully successful redemption. A wrong
 * PIN must not burn a view, or an attacker could exhaust a legitimate link by
 * guessing at it.
 */
export function redeemShare(
  token: string,
  opts: { pin?: string; now?: Date } = {},
): RedeemResult {
  const now = opts.now ?? new Date();

  if (!token || typeof token !== "string") {
    return { ok: false, failure: "token-not-found", detail: "No share token supplied." };
  }

  const id = byTokenHash.get(sha256Hex(token));
  const grant = id ? grants.get(id) : undefined;
  if (!grant) {
    return { ok: false, failure: "token-not-found", detail: "This link is not valid." };
  }

  if (grant.revokedAt) {
    return { ok: false, failure: "token-revoked", detail: "This link was revoked." };
  }

  if (Date.parse(grant.expiresAt) <= now.getTime()) {
    return { ok: false, failure: "token-expired", detail: "This link has expired." };
  }

  if (grant.viewCount >= grant.maxViews) {
    return {
      ok: false,
      failure: "view-cap-reached",
      detail: "This link has already been opened the maximum number of times.",
    };
  }

  if (grant.pinRequired) {
    if (!opts.pin) {
      return { ok: false, failure: "pin-required", detail: "This link needs its PIN." };
    }
    if (!grant.pinHash || !grant.pinSalt) {
      // A grant marked pinRequired with no stored hash cannot be satisfied.
      // Refusing is the only safe reading; accepting would treat a corrupt
      // record as an absent requirement.
      return { ok: false, failure: "pin-incorrect", detail: "This link's PIN cannot be checked." };
    }
    const candidate = hashPin(opts.pin, grant.pinSalt);
    if (
      candidate.length !== grant.pinHash.length ||
      !timingSafeEqual(candidate, grant.pinHash)
    ) {
      return { ok: false, failure: "pin-incorrect", detail: "That PIN is not correct." };
    }
  }

  grant.viewCount += 1;
  return { ok: true, grant };
}

export function revokeShare(id: string, reason: string, now: Date = new Date()): ShareGrantView | null {
  const grant = grants.get(id);
  if (!grant) return null;
  if (!grant.revokedAt) {
    grant.revokedAt = now.toISOString();
    grant.revokedReason = reason;
    // The token hash stays mapped so a later attempt returns "revoked" rather
    // than "not found". The distinction matters to the person holding the
    // link, who otherwise cannot tell a revocation from a typo.
  }
  return toView(grant);
}

/** Every grant minted for a profile, newest first. Excludes tokens. */
export function listShares(profileId: string): ShareGrantView[] {
  return Array.from(grants.values())
    .filter((g) => g.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toView);
}

export function getShare(id: string): StoredGrant | undefined {
  return grants.get(id);
}

// ── Handoff intents ─────────────────────────────────────────────────────────

export interface ShareIntents {
  /**
   * `sms:` intent. The `?&body=` form is the one that works on both iOS and
   * Android; `?body=` alone fails on iOS and `&body=` alone fails on Android.
   */
  sms: string;
  /** WhatsApp click-to-chat with no number, so the patient picks the contact. */
  whatsapp: string;
  /** The bare link, for "copy" and for anything else the patient prefers. */
  copy: string;
}

/**
 * Build the intent URLs the patient's own device acts on.
 *
 * Nothing here is sent by the server. That is the entire point: the message
 * leaves the patient's handset, from the patient's number, to a recipient the
 * patient chose, so neither the HIPAA disclosure rules nor TCPA's consent
 * requirement attaches to the practice for the act of sending.
 *
 * `message` is the fully rendered body and already contains the link — the
 * template owns where the URL sits in the sentence, which differs by language
 * and is not something to append blindly at the end.
 */
export function buildShareIntents(url: string, message: string): ShareIntents {
  const body = encodeURIComponent(message);
  return {
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
    copy: url,
  };
}
