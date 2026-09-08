/**
 * Shared types for the ambient clinical scribe.
 *
 * Built against the NHA / ABDM open call of 2 September 2026 for "Ambient
 * AI-enabled Voice-to-Text (VTT) solutions", which asks for systems that
 * capture doctor-patient conversations, support multilingual clinical
 * documentation, interpret medical terminology, and emit structured, editable
 * and interoperable ABDM-enabled health records.
 *
 * Four properties are load-bearing and every type here exists to enforce one
 * of them.
 *
 * ## 1. A draft is not a record
 *
 * The output of transcription plus extraction is a `ScribeNoteDraft`, and a
 * draft is inert: it is not a clinical record, it does not enter the chart,
 * and it cannot be exchanged. It becomes a record only when a named clinician
 * attests it (`Attestation`). This is the difference between a documentation
 * aid and an unsupervised system that writes into a patient's permanent
 * record, and the type system draws the line rather than a code review.
 *
 * ## 2. Every clinical claim cites its source
 *
 * Each `NoteItem` carries `evidence`: the transcript spans it came from. An
 * item with no evidence cannot be constructed, so a model cannot contribute a
 * plausible-sounding finding that nobody said. The clinician reviewing the
 * draft can jump from any line to the words that produced it, which is what
 * makes review possible at the speed the EOI's premise — reducing
 * documentation burden — actually requires.
 *
 * ## 3. Absence is recorded as absence
 *
 * The same rule the shared summary follows. A section with nothing in it means
 * the conversation did not cover it, never that the answer was negative. A
 * scribe is *more* exposed to this than a form is: silence in a recording is
 * indistinguishable from a question that was never asked, so `sectionStatus`
 * distinguishes "not discussed" from "explicitly negative" and the two render
 * differently.
 *
 * ## 4. Audio is the most identifying PHI in the system
 *
 * A recording carries the patient's voice, their name as spoken, whatever a
 * relative says in the room, and often another patient audible through a
 * curtain. It is not a document that happens to be audio. `RETENTION` and the
 * residency gate exist because the safe default for it is to not exist for
 * long and to not leave the jurisdiction at all.
 */

/** Where a session is in its lifecycle. Only `attested` is a clinical record. */
export type ScribeSessionStatus =
  | "consent-pending"
  | "recording"
  | "transcribing"
  | "draft"
  | "attested"
  | "abandoned";

/**
 * Who is speaking.
 *
 * `companion` is separate from `patient` on purpose. A relative, attendant or
 * interpreter in the room is extremely common in Indian outpatient practice,
 * and attributing their words to the patient produces a history the patient
 * never gave. `unknown` is a real and frequent value — diarisation fails on
 * crosstalk — and it must stay distinguishable rather than being rounded to
 * the nearest confident guess.
 */
export type SpeakerRole = "clinician" | "patient" | "companion" | "unknown";

/** One diarised utterance. */
export interface TranscriptTurn {
  /** Position in the transcript. Stable; evidence spans reference it. */
  index: number;
  /** Provider's diarisation label, before role assignment. */
  speakerTag: number;
  role: SpeakerRole;
  text: string;
  /** BCP-47 or bare code the recogniser reported for this turn. */
  language: string;
  startMs: number;
  endMs: number;
  /** 0-1, as reported. Low-confidence turns are kept and marked, not dropped. */
  confidence: number;
}

export interface Transcript {
  turns: readonly TranscriptTurn[];
  /** The language the session was conducted in, as declared at start. */
  primaryLanguage: string;
  /**
   * Additional languages actually observed. A consultation conducted in
   * Marathi with English drug names has `["en"]` here, and that is normal
   * rather than an error.
   */
  observedLanguages: readonly string[];
  durationMs: number;
  /** Opaque provider identifier, recorded so a note can be traced to a model. */
  engine: string;
}

/** A span of transcript that justifies a note item. */
export interface EvidenceSpan {
  turnIndex: number;
  /** Character offsets into that turn's `text`. */
  start: number;
  end: number;
}

export type NoteSection = "subjective" | "objective" | "assessment" | "plan";

/**
 * What kind of clinical thing an item is.
 *
 * Kept coarse deliberately. A finer taxonomy would invite the extractor to
 * assert distinctions the audio does not support — "chief complaint" versus
 * "history of present illness" is an authoring judgement, not something
 * recoverable from a sentence.
 */
export type NoteItemKind =
  | "symptom"
  | "history"
  | "examination"
  | "vital"
  | "medication"
  | "allergy"
  | "diagnosis"
  | "investigation"
  | "advice"
  | "follow-up";

export interface NoteItem {
  id: string;
  section: NoteSection;
  kind: NoteItemKind;
  /** Clinician-facing text. Derived from the transcript, never invented. */
  text: string;
  /**
   * Where in the transcript this came from. Never empty — the builder refuses
   * to construct an item without it.
   */
  evidence: readonly EvidenceSpan[];
  /** Terminology binding, when a term matched a catalog entry. Never guessed. */
  code?: { system: string; code: string; display: string };
  /** 0-1 extraction confidence, distinct from ASR confidence. */
  confidence: number;
  /** True when the clinician changed the text after extraction. */
  edited?: boolean;
}

/**
 * Why a section has no items.
 *
 * The distinction this draws is the whole point. `not-discussed` is the honest
 * default and must never be rendered as a negative finding.
 */
export type SectionStatus = "populated" | "not-discussed" | "explicitly-negative";

export interface ScribeNoteDraft {
  sessionId: string;
  items: readonly NoteItem[];
  sectionStatus: Readonly<Record<NoteSection, SectionStatus>>;
  /** Language the draft is written in. May differ from the spoken language. */
  language: string;
  /** True when the note was rendered in a language whose copy is unverified. */
  languageFallback: boolean;
  generatedAt: string;
}

export interface Attestation {
  /** The clinician taking responsibility. Never a service account. */
  attestedBy: string;
  attestedByName: string;
  attestedAt: string;
  /** Count of items the clinician changed before attesting. */
  editedItemCount: number;
  /** Count of items the clinician deleted. Recorded, because zero is a signal. */
  removedItemCount: number;
}

/** Every way a scribe request is refused. Each is a deliberate refusal. */
export type ScribeRefusal =
  | "consent-not-captured"
  | "consent-refused"
  | "consent-withdrawn"
  | "language-unknown"
  | "language-speech-not-enabled"
  | "language-copy-absent"
  | "code-mix-not-declared"
  | "residency-not-configured"
  | "residency-violation"
  | "recording-too-long"
  | "transcript-empty"
  | "no-evidence-for-item"
  | "not-attested"
  | "already-attested";

export const SCRIBE_LIMITS = {
  /**
   * A single consultation. Longer than this and the session is almost
   * certainly a recorder left running, which is a privacy incident rather
   * than a long appointment.
   */
  MAX_RECORDING_MS: 90 * 60 * 1000,
  /** Below this, there is nothing to build a note from; refuse rather than emit an empty note. */
  MIN_TRANSCRIPT_TURNS: 2,
  /**
   * Audio is deleted this long after attestation. The note is the record; the
   * recording is working material and keeping it indefinitely creates a
   * voice-biometric corpus nobody consented to.
   */
  AUDIO_RETENTION_HOURS: 24,
  /** An unattested draft expires. An abandoned session must not linger as a shadow record. */
  DRAFT_TTL_HOURS: 72,
  /** Items below this extraction confidence are surfaced for review, never auto-included. */
  REVIEW_CONFIDENCE_THRESHOLD: 0.6,
} as const;
