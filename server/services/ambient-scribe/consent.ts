/**
 * Consent to record a consultation.
 *
 * This is a different consent from the one the engagement module already
 * holds, and conflating them would be a real error. That one is permission to
 * *contact* a person on a phone number. This one is permission to *capture the
 * room* — the patient's voice, their name as spoken aloud, whatever a relative
 * volunteers, and in a partitioned OPD the audible remainder of somebody
 * else's consultation. A patient who agreed to appointment reminders has
 * agreed to nothing here.
 *
 * ## Under the DPDP Act the notice is the consent
 *
 * Section 5 makes the notice constitutive rather than procedural: consent
 * given without a compliant notice is not defective consent, it is not
 * consent. Section 6 requires it to be free, specific, informed, unconditional
 * and unambiguous, given by a clear affirmative action, and limited to the
 * purpose it names. Recording a consultation to generate documentation is one
 * purpose. Using the same recording later to train a model is a different one
 * and needs its own consent — `purpose` is a closed union here so that the
 * second use cannot be quietly served by the first record.
 *
 * ## Why no notice text ships in this file
 *
 * The obvious thing to add is a table of consent notices in 22 languages. It
 * would be wrong. A DPDP notice has to name *this* Data Fiduciary, *this*
 * grievance officer, and the route to the Data Protection Board — facts this
 * repository does not know and must not invent. A plausible-looking notice
 * with a placeholder where the accountable entity should be is worse than no
 * notice, because it looks discharged.
 *
 * So the deployment supplies its own notice, and this module checks that the
 * record of delivery declares every element section 5 requires
 * (`NOTICE_ELEMENTS`). Missing elements refuse. What is verified is that a
 * compliant notice was delivered in a language the patient was offered — not
 * the wording, which is the operator's and their counsel's to write.
 *
 * ## Withdrawal is prospective, and the line is attestation
 *
 * Section 6(6) gives the right to withdraw with the same ease as giving.
 * Withdrawal always stops capture and always destroys the audio. What it does
 * to the note depends on where the note is:
 *
 * - **Before attestation** the draft is working material derived from a
 *   session the patient has now ended. It is destroyed with the audio.
 * - **After attestation** the note is a clinical record of care that was
 *   actually delivered, retained under medical-records law rather than held on
 *   consent. Deleting it on withdrawal would destroy the treating clinician's
 *   record of a consultation that happened, which serves nobody — least of all
 *   the patient, whose next clinician needs it.
 *
 * That boundary is encoded rather than left to judgement, because the two
 * cases look identical from the API and only one of them is deletable.
 */

import type { ScribeRefusal } from "@shared/ambient-scribe";
import { indiaLanguage } from "@shared/india-languages";

/**
 * What the recording may be used for. One value, deliberately.
 *
 * Every additional purpose someone wants — quality review, model training,
 * teaching — is a fresh consent under DPDP s.6, so it belongs here as a new
 * member with its own captured record, never as a broadened reading of this
 * one.
 */
export type RecordingPurpose = "ambient-documentation";

export type ConsentMethod =
  /** Patient said yes, and the clinician attests to having asked. */
  | "verbal-attested"
  /** Patient signed or ticked in the portal before the visit. */
  | "written"
  /** Captured on the patient's own device in the waiting area. */
  | "patient-device";

export type ConsentState = "granted" | "refused" | "withdrawn";

/**
 * The elements DPDP s.5 requires a notice to contain.
 *
 * A deployment declares which of these its notice covers. All of them must be
 * declared; the check is that the operator has actually thought about each,
 * not that this file can read their notice.
 */
export const NOTICE_ELEMENTS = [
  /** What is collected — here, audio of the consultation. */
  "personal-data-described",
  /** The purpose, stated specifically. */
  "purpose-stated",
  /** How to exercise rights under ss.11-14. */
  "rights-exercise-route",
  /** How to complain to the Data Protection Board. */
  "board-complaint-route",
  /** Who the Data Fiduciary is, named. */
  "fiduciary-identified",
] as const;

export type NoticeElement = (typeof NOTICE_ELEMENTS)[number];

export interface RecordingConsent {
  patientId: string;
  jurisdiction: string;
  purpose: RecordingPurpose;
  state: ConsentState;
  method: ConsentMethod;
  /** Language the notice was delivered in. */
  noticeLanguage: string;
  /** Operator's identifier for the notice text used. Traceable to a version. */
  noticeVersion: string;
  /** Which s.5 elements that notice covers. */
  noticeElements: readonly NoticeElement[];
  capturedAt: string;
  /** The clinician who asked. Required for `verbal-attested`. */
  capturedBy?: string;
  withdrawnAt?: string;
}

export type ConsentDecision =
  | { ok: true; consent: RecordingConsent }
  | {
      ok: false;
      reason: Extract<
        ScribeRefusal,
        "consent-not-captured" | "consent-refused" | "consent-withdrawn"
      >;
      detail: string;
    };

/**
 * Whether this consent record permits recording to start, right now.
 *
 * Deliberately takes the record rather than fetching it, so the caller decides
 * where consent lives and this stays a pure predicate — the same shape
 * `evaluateSend` was refactored into for the engagement gate, and for the same
 * reason: a rule that does its own I/O cannot be tested against the awkward
 * cases.
 */
export function evaluateRecordingConsent(
  consent: RecordingConsent | null,
  purpose: RecordingPurpose,
): ConsentDecision {
  if (!consent) {
    return {
      ok: false,
      reason: "consent-not-captured",
      detail:
        "No recording consent on file for this patient. Having the patient in the room " +
        "is how you can record them; consent is whether you may.",
    };
  }

  if (consent.state === "refused") {
    return {
      ok: false,
      reason: "consent-refused",
      detail:
        "The patient declined to be recorded. The consultation proceeds; the scribe does not.",
    };
  }

  if (consent.state === "withdrawn") {
    return {
      ok: false,
      reason: "consent-withdrawn",
      detail:
        `Consent was withdrawn at ${consent.withdrawnAt ?? "an unrecorded time"}. ` +
        "Withdrawal under DPDP s.6(6) must be as easy as granting, so it takes effect " +
        "immediately and is not re-litigated per session.",
    };
  }

  if (consent.purpose !== purpose) {
    return {
      ok: false,
      reason: "consent-not-captured",
      detail:
        `Consent on file is for "${consent.purpose}", not "${purpose}". Under DPDP s.6 a ` +
        "new purpose needs fresh consent; it is not covered by a broad reading of an " +
        "existing one.",
    };
  }

  const missing = NOTICE_ELEMENTS.filter((e) => !consent.noticeElements.includes(e));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "consent-not-captured",
      detail:
        `The notice delivered with this consent does not cover: ${missing.join(", ")}. ` +
        "Under DPDP s.5 the notice is constitutive — consent given without a compliant " +
        "notice is not consent that can be relied on, so this is a refusal rather than " +
        "a warning.",
    };
  }

  if (consent.method === "verbal-attested" && !consent.capturedBy) {
    return {
      ok: false,
      reason: "consent-not-captured",
      detail:
        "Verbal consent is recorded without the clinician who attests to having asked. " +
        "An unattributed 'they said yes' is not a record of anything.",
    };
  }

  if (!indiaLanguage(consent.noticeLanguage)) {
    return {
      ok: false,
      reason: "consent-not-captured",
      detail:
        `The notice language "${consent.noticeLanguage}" is not one this system recognises. ` +
        "DPDP s.5(3) gives the individual the option of English or any Eighth Schedule " +
        "language, so an unrecognised code means the record cannot show which option was " +
        "honoured.",
    };
  }

  return { ok: true, consent };
}

/**
 * What withdrawal destroys, given where the session had got to.
 *
 * Returns the decision rather than performing it: the caller owns the storage,
 * and a function that deletes as a side effect of being asked a question is
 * the wrong shape for something this irreversible.
 */
export function withdrawalEffect(sessionAttested: boolean): {
  deleteAudio: true;
  deleteDraft: boolean;
  retainAttestedNote: boolean;
  rationale: string;
} {
  if (sessionAttested) {
    return {
      deleteAudio: true,
      deleteDraft: false,
      retainAttestedNote: true,
      rationale:
        "The note was attested before withdrawal, so it is a clinical record of care that " +
        "was delivered, held under medical-records retention rather than on consent. The " +
        "audio is still destroyed: it was working material, and nothing needs it once the " +
        "clinician has signed the note.",
    };
  }
  return {
    deleteAudio: true,
    deleteDraft: true,
    retainAttestedNote: false,
    rationale:
      "Nothing was attested, so there is no clinical record — only a machine-generated " +
      "draft of a conversation the patient has now withdrawn from. Both the audio and " +
      "the draft go.",
  };
}
