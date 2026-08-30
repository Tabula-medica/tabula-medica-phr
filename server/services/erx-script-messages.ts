/**
 * NCPDP SCRIPT CancelRx message construction and the pure decision logic that
 * drives it.
 *
 * Deliberately free of database, network and `openai` imports so it can be
 * unit-tested in isolation (`tests/erx-cancellation.spec.ts`) and so the
 * message shape can be reviewed independently of the persistence layer.
 *
 * Scope note: this module produces a normalised JSON representation of a
 * SCRIPT CancelRx. Serialising that to the XML the network actually accepts is
 * the transport adapter's job (`erx-transport.ts`), because the exact envelope
 * differs per SCRIPT version and per certified connection.
 *
 * IMPORTANT — before enabling a live Surescripts connection, the reason and
 * denial code tables below must be reconciled against the implementation guide
 * for the SCRIPT version the connection is certified on. They follow published
 * SCRIPT conventions but this repo holds no certification artefacts.
 */

import { createHash, randomUUID } from "node:crypto";
import type { ErxCancellationTrigger } from "@shared/schema";

/** SCRIPT version this module emits. Overridable per deployment. */
export const DEFAULT_SCRIPT_VERSION = "2017071";

/**
 * Internal trigger -> SCRIPT CancelRx reason. `code` is carried in the message
 * and echoed back on the CancelRxResponse; `text` populates the human-readable
 * Note the pharmacist sees.
 */
export const CANCEL_REASON_BY_TRIGGER: Record<
  ErxCancellationTrigger,
  { code: string; text: string }
> = {
  dose_change: {
    code: "DOSE_CHANGE",
    text: "Dose changed. A replacement prescription has been sent; do not dispense the prior prescription.",
  },
  medication_discontinued: {
    code: "DISCONTINUED",
    text: "Medication discontinued by the prescriber. Do not dispense.",
  },
  therapy_completed: {
    code: "THERAPY_COMPLETE",
    text: "Course of therapy complete. No further fills are authorized.",
  },
  duplicate_therapy: {
    code: "DUPLICATE_THERAPY",
    text: "Duplicate therapy identified. Cancel this prescription and retain the active one.",
  },
  adverse_reaction: {
    code: "ADVERSE_REACTION",
    text: "Discontinued due to an adverse reaction. Do not dispense.",
  },
  drug_interaction: {
    code: "DRUG_INTERACTION",
    text: "Discontinued due to a drug interaction. Do not dispense.",
  },
  patient_request: {
    code: "PATIENT_REQUEST",
    text: "Cancellation requested by the patient. Do not dispense.",
  },
  prescriber_request: {
    code: "PRESCRIBER_REQUEST",
    text: "Cancellation requested by the prescriber. Do not dispense.",
  },
  patient_deceased: {
    code: "PATIENT_DECEASED",
    text: "Patient is deceased. Cancel all open prescriptions and do not dispense.",
  },
};

/**
 * CancelRxResponse denial reasons. Following SCRIPT convention these are the
 * two-character codes returned when the pharmacy sets Status = Denied.
 * `terminal: true` means retrying the same CancelRx cannot succeed.
 */
export const SCRIPT_DENIAL_REASON_CODES: Record<
  string,
  { description: string; terminal: boolean }
> = {
  AA: { description: "Patient unknown to the pharmacy", terminal: true },
  AB: { description: "Patient never under provider care", terminal: true },
  AC: { description: "Patient no longer under provider care", terminal: true },
  AE: { description: "Medication never prescribed for the patient", terminal: true },
  AH: { description: "Patient has already picked up the prescription", terminal: true },
  AJ: { description: "Patient has picked up a partial fill", terminal: true },
  AK: { description: "Prescription not picked up; drug returned to stock", terminal: true },
  AL: { description: "Change not appropriate", terminal: true },
  AN: { description: "Prescriber not associated with this practice or location", terminal: false },
  AO: { description: "No attempt will be made to fill this prescription", terminal: true },
};

/**
 * A denial is still a resolved cancellation when the drug never left the
 * pharmacy — `AK` (returned to stock) means the waste was avoided even though
 * the pharmacy formally denied the CancelRx.
 */
export const DENIAL_CODES_MEANING_NOT_DISPENSED = new Set(["AE", "AK", "AO"]);

/** Transmission is only useful once the medication has actually left our side. */
export const RETRYABLE_TRANSPORT_ERRORS = new Set([
  "network_error",
  "timeout",
  "rate_limited",
  "service_unavailable",
]);

// ---------------------------------------------------------------------------
// Dose comparison
// ---------------------------------------------------------------------------

export interface ParsedDose {
  value: number | null;
  unit: string | null;
  raw: string;
}

const DOSE_UNIT_ALIASES: Record<string, string> = {
  mcg: "mcg",
  microgram: "mcg",
  micrograms: "mcg",
  µg: "mcg",
  ug: "mcg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  g: "g",
  gram: "g",
  grams: "g",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  unit: "unit",
  units: "unit",
  iu: "iu",
  meq: "meq",
  puff: "puff",
  puffs: "puff",
  tab: "tab",
  tabs: "tab",
  tablet: "tab",
  tablets: "tab",
  cap: "cap",
  caps: "cap",
  capsule: "cap",
  capsules: "cap",
  drop: "drop",
  drops: "drop",
  patch: "patch",
  patches: "patch",
};

/** Canonical mass units, ordered so a dose can be normalised for comparison. */
const MASS_UNIT_TO_MCG: Record<string, number> = { mcg: 1, mg: 1000, g: 1_000_000 };

/**
 * Pull a numeric magnitude and a canonical unit out of a free-text dose such as
 * "10 mg", "0.5MG", "10mg tablet" or "one tablet". Returns `value: null` when no
 * magnitude can be read, which callers treat as "cannot compare".
 */
export function parseDose(dose: string | null | undefined): ParsedDose {
  const raw = (dose ?? "").trim();
  if (!raw) return { value: null, unit: null, raw: "" };

  const normalised = raw.toLowerCase().replace(/,/g, "");
  const match = normalised.match(/(\d+(?:\.\d+)?)\s*([a-zµ]+)?/);
  if (!match) return { value: null, unit: null, raw };

  const value = Number.parseFloat(match[1]);
  const rawUnit = match[2] ?? null;
  const unit = rawUnit ? DOSE_UNIT_ALIASES[rawUnit] ?? rawUnit : null;

  return { value: Number.isFinite(value) ? value : null, unit, raw };
}

/** Convert a parsed mass dose to micrograms so mg/mcg/g compare correctly. */
function toComparableMagnitude(dose: ParsedDose): number | null {
  if (dose.value === null) return null;
  if (dose.unit && MASS_UNIT_TO_MCG[dose.unit] !== undefined) {
    return dose.value * MASS_UNIT_TO_MCG[dose.unit];
  }
  return dose.value;
}

export interface DoseChangeAssessment {
  isMaterial: boolean;
  /** Why the assessment landed where it did — surfaced in the audit trail. */
  reason:
    | "identical"
    | "strength_changed"
    | "unit_changed"
    | "dose_added"
    | "dose_removed"
    | "unparseable_change"
    | "no_previous_dose";
  previous: ParsedDose;
  next: ParsedDose;
}

/**
 * Decide whether a dose edit warrants cancelling the prescription already at the
 * pharmacy. Cosmetic edits ("10mg" -> "10 MG") must not trigger a CancelRx: a
 * spurious cancellation is as disruptive as a missed one.
 */
export function assessDoseChange(
  previousDose: string | null | undefined,
  newDose: string | null | undefined,
): DoseChangeAssessment {
  const previous = parseDose(previousDose);
  const next = parseDose(newDose);

  const prevEmpty = previous.raw === "";
  const nextEmpty = next.raw === "";

  if (prevEmpty && nextEmpty) {
    return { isMaterial: false, reason: "no_previous_dose", previous, next };
  }
  if (prevEmpty) {
    // Nothing was on file to supersede, so there is no old Rx to cancel.
    return { isMaterial: false, reason: "no_previous_dose", previous, next };
  }
  if (nextEmpty) {
    return { isMaterial: true, reason: "dose_removed", previous, next };
  }

  // Whitespace/case-only edits are not clinical changes.
  const canon = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  if (canon(previous.raw) === canon(next.raw)) {
    return { isMaterial: false, reason: "identical", previous, next };
  }

  const prevMagnitude = toComparableMagnitude(previous);
  const nextMagnitude = toComparableMagnitude(next);

  if (prevMagnitude === null || nextMagnitude === null) {
    // Text changed but no magnitude to compare — flag it and let a human decide.
    return { isMaterial: true, reason: "unparseable_change", previous, next };
  }

  const prevIsMass = previous.unit !== null && MASS_UNIT_TO_MCG[previous.unit] !== undefined;
  const nextIsMass = next.unit !== null && MASS_UNIT_TO_MCG[next.unit] !== undefined;

  if (previous.unit !== next.unit && !(prevIsMass && nextIsMass)) {
    return { isMaterial: true, reason: "unit_changed", previous, next };
  }

  if (prevMagnitude !== nextMagnitude) {
    return { isMaterial: true, reason: "strength_changed", previous, next };
  }

  // Same magnitude in different but equivalent units (1000mcg -> 1mg).
  return { isMaterial: false, reason: "identical", previous, next };
}

// ---------------------------------------------------------------------------
// Waste estimation
// ---------------------------------------------------------------------------

/**
 * Coarse per-day acquisition cost tiers, in cents. Used only to quantify
 * avoided waste for reporting — never for billing, patient cost estimates, or
 * anything a patient sees as a price.
 */
export const WASTE_COST_TIERS = {
  generic: 40,
  brand: 950,
  specialty: 12_000,
} as const;
export type WasteCostTier = keyof typeof WASTE_COST_TIERS;

const SPECIALTY_MARKERS = [
  "adalimumab", "etanercept", "ustekinumab", "secukinumab", "dupilumab",
  "pembrolizumab", "nivolumab", "trastuzumab", "rituximab", "bevacizumab",
  "lenalidomide", "ibrutinib", "imatinib", "sofosbuvir", "ledipasvir",
  "insulin glargine", "insulin degludec", "semaglutide", "tirzepatide",
];

/**
 * Classify a medication into a cost tier from its name. Anything not recognised
 * as specialty or brand is assumed generic, which keeps the savings estimate
 * conservative rather than flattering.
 */
export function classifyCostTier(
  medicationName: string,
  hint?: WasteCostTier,
): WasteCostTier {
  if (hint) return hint;
  const name = medicationName.toLowerCase();
  if (SPECIALTY_MARKERS.some((marker) => name.includes(marker))) return "specialty";
  // Brand names are capitalised in prescribing systems; a leading capital with
  // no generic-style suffix is a weak brand signal.
  if (/^[A-Z][a-z]+$/.test(medicationName.trim()) && medicationName.trim().length <= 12) {
    return "brand";
  }
  return "generic";
}

/**
 * Estimate the dispensing cost avoided by cancelling before the fill. Returns 0
 * when there is no remaining supply to waste.
 */
export function estimateWasteAvoidedCents(input: {
  medicationName: string;
  daysSupplyRemaining?: number | null;
  costTier?: WasteCostTier;
}): number {
  const days = input.daysSupplyRemaining ?? 0;
  if (days <= 0) return 0;
  const tier = classifyCostTier(input.medicationName, input.costTier);
  return Math.round(WASTE_COST_TIERS[tier] * days);
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Stable key for "this cancellation, for this patient, for this reason". Two
 * concurrent dose-change saves must not produce two CancelRx messages for the
 * same prescription, so the key is hashed and enforced by a unique index.
 *
 * The key is a one-way SHA-256 digest: it never reveals the medication name or
 * Rx number even though both feed into it.
 */
export function buildIdempotencyKey(input: {
  profileId: string;
  medicationId?: string | null;
  medicationName: string;
  triggerType: ErxCancellationTrigger;
  rxReferenceNumber?: string | null;
  /** Distinguishes repeat cancellations of the same drug over time. */
  discriminator?: string | null;
}): string {
  const parts = [
    input.profileId,
    input.medicationId ?? "",
    input.medicationName.trim().toLowerCase(),
    input.triggerType,
    input.rxReferenceNumber ?? "",
    input.discriminator ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** SHA-256 of a transmitted payload, stored instead of the payload itself. */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// ---------------------------------------------------------------------------
// Message construction
// ---------------------------------------------------------------------------

export interface ScriptParticipant {
  qualifier: string;
  identifier: string;
  name?: string;
}

export interface ScriptCancelRxMessage {
  header: {
    messageId: string;
    sentTime: string;
    scriptVersion: string;
    from: ScriptParticipant;
    to: ScriptParticipant;
    /** MessageID of the NewRx being cancelled, when it is known. */
    relatesToMessageId?: string;
    senderSoftware: { senderSoftwareDeveloper: string; senderSoftwareProduct: string; senderSoftwareVersionRelease: string };
  };
  body: {
    cancelRx: {
      patient: {
        identifier: string;
        deceasedIndicator?: boolean;
        dateOfDeath?: string;
      };
      pharmacy: { ncpdpId?: string; name?: string };
      prescriber: { npi?: string; name?: string };
      medicationPrescribed: {
        drugDescription: string;
        strength?: string;
        rxReferenceNumber?: string;
      };
      cancelReason: { code: string; text: string };
      note?: string;
    };
  };
}

export interface BuildCancelRxInput {
  requestId: string;
  profileReference: string;
  medicationName: string;
  triggerType: ErxCancellationTrigger;
  previousDose?: string | null;
  newDose?: string | null;
  rxReferenceNumber?: string | null;
  originalMessageId?: string | null;
  pharmacyNcpdpId?: string | null;
  pharmacyName?: string | null;
  prescriberNpi?: string | null;
  prescriberName?: string | null;
  reasonText?: string | null;
  deceasedDate?: string | null;
  scriptVersion?: string;
  senderId: string;
  senderName?: string;
  senderSoftware?: { developer: string; product: string; version: string };
  /** Injected in tests so the emitted message is deterministic. */
  now?: Date;
  messageId?: string;
}

const DEFAULT_SENDER_SOFTWARE = {
  developer: "Tabula Medica",
  product: "Tabula Medica PHR eRx Gateway",
  version: "1.0.0",
};

/**
 * Build the CancelRx for a single prescription. The patient is referenced by an
 * opaque identifier rather than by name: the gateway resolves it to the
 * demographics the network requires, so no PHI is written into this repo's
 * queue or logs.
 */
export function buildCancelRxMessage(input: BuildCancelRxInput): ScriptCancelRxMessage {
  const reason = CANCEL_REASON_BY_TRIGGER[input.triggerType];
  const sentTime = (input.now ?? new Date()).toISOString();
  const software = input.senderSoftware ?? DEFAULT_SENDER_SOFTWARE;

  const noteParts: string[] = [];
  if (input.triggerType === "dose_change" && input.newDose) {
    noteParts.push(
      `Dose changed from ${input.previousDose ?? "unspecified"} to ${input.newDose}.`,
    );
  }
  if (input.reasonText) noteParts.push(input.reasonText);

  return {
    header: {
      messageId: input.messageId ?? randomUUID(),
      sentTime,
      scriptVersion: input.scriptVersion ?? DEFAULT_SCRIPT_VERSION,
      from: { qualifier: "P", identifier: input.senderId, name: input.senderName },
      to: {
        qualifier: input.pharmacyNcpdpId ? "D" : "P",
        identifier: input.pharmacyNcpdpId ?? "UNROUTED",
        name: input.pharmacyName ?? undefined,
      },
      relatesToMessageId: input.originalMessageId ?? undefined,
      senderSoftware: {
        senderSoftwareDeveloper: software.developer,
        senderSoftwareProduct: software.product,
        senderSoftwareVersionRelease: software.version,
      },
    },
    body: {
      cancelRx: {
        patient: {
          identifier: input.profileReference,
          deceasedIndicator: input.triggerType === "patient_deceased" ? true : undefined,
          dateOfDeath:
            input.triggerType === "patient_deceased"
              ? input.deceasedDate ?? undefined
              : undefined,
        },
        pharmacy: {
          ncpdpId: input.pharmacyNcpdpId ?? undefined,
          name: input.pharmacyName ?? undefined,
        },
        prescriber: {
          npi: input.prescriberNpi ?? undefined,
          name: input.prescriberName ?? undefined,
        },
        medicationPrescribed: {
          drugDescription: input.medicationName,
          strength: input.previousDose ?? undefined,
          rxReferenceNumber: input.rxReferenceNumber ?? undefined,
        },
        cancelReason: { code: reason.code, text: reason.text },
        note: noteParts.length > 0 ? noteParts.join(" ") : undefined,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Response interpretation
// ---------------------------------------------------------------------------

export interface CancelRxResponseInterpretation {
  status: "acknowledged" | "denied";
  /** True when we can be confident the drug was not handed to the patient. */
  wasteAvoided: boolean;
  denialDescription?: string;
  terminal: boolean;
}

/**
 * Interpret a CancelRxResponse. An unrecognised denial code is treated as
 * terminal and as "not confirmed avoided" — the conservative reading in both
 * directions.
 */
export function interpretCancelRxResponse(input: {
  responseStatus: string;
  denialCode?: string | null;
}): CancelRxResponseInterpretation {
  const approved = input.responseStatus.trim().toLowerCase() === "approved";
  if (approved) {
    return { status: "acknowledged", wasteAvoided: true, terminal: true };
  }

  const code = (input.denialCode ?? "").trim().toUpperCase();
  const known = SCRIPT_DENIAL_REASON_CODES[code];
  return {
    status: "denied",
    wasteAvoided: DENIAL_CODES_MEANING_NOT_DISPENSED.has(code),
    denialDescription: known?.description,
    terminal: known ? known.terminal : true,
  };
}

/** Exponential backoff with a hard ceiling, in milliseconds. */
export function nextRetryDelayMs(attemptCount: number): number {
  const base = 30_000;
  const ceiling = 6 * 60 * 60 * 1000; // 6 hours
  return Math.min(base * 2 ** Math.max(0, attemptCount - 1), ceiling);
}

export const MAX_TRANSMISSION_ATTEMPTS = 6;
