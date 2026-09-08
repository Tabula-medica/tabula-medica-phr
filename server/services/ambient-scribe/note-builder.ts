/**
 * Transcript to structured note draft.
 *
 * Pure and deterministic. The same transcript produces the same draft, every
 * time, with no network call — which is what makes the draft reviewable, makes
 * the tests meaningful, and means an outage degrades the scribe to "no note"
 * rather than to "a different note".
 *
 * ## Nothing is created that was not said
 *
 * Every `NoteItem` is constructed from a term match in a specific turn, and
 * carries the span it came from. There is no path in this file that produces an
 * item without evidence — `item()` refuses — so the draft cannot contain a
 * finding that no one uttered. That property is what a clinician is relying on
 * when they attest a note they did not type.
 *
 * A model may still be involved downstream, to *phrase* these items into prose.
 * It operates on the closed list this file produces and cannot add to it, the
 * same containment the HCC opportunity finder uses: a hallucination can make
 * the output less useful, it cannot make it false.
 *
 * ## Who said it determines what it is
 *
 * This is the rule the whole module turns on.
 *
 * | Said by | "It's type 2 diabetes" becomes |
 * |---|---|
 * | clinician | an assessment |
 * | patient | a reported belief, in the subjective section |
 * | unknown | not an assessment, and marked for confirmation |
 *
 * The middle row is not pedantry. Patients are often right about their own
 * diagnoses and often wrong, and a note that records a patient's guess as the
 * treating clinician's assessment has manufactured a diagnosis that no
 * clinician made. The same asymmetry governs medications: from the clinician
 * it is a prescription and belongs in the plan; from the patient it is a
 * history of what they are taking.
 *
 * So when roles were never established, `assessment` and `plan` are not
 * populated at all. This makes the scribe materially less useful without a
 * clinician identifying their own voice, which is the correct incentive: the
 * alternative is a plan section assembled from sentences that may have been
 * the patient's suggestions.
 *
 * ## Denial is content
 *
 * "Chest pain nahi hai" produces an item reading "Denies chest pain", not
 * silence and not "chest pain". A negative finding a clinician actually
 * elicited is one of the more valuable things in a note — it is the difference
 * between a symptom that was excluded and one that was never asked about — and
 * this is the only place in the pipeline that can still tell the two apart.
 */

import { randomUUID } from "node:crypto";
import type {
  EvidenceSpan,
  NoteItem,
  NoteItemKind,
  NoteSection,
  ScribeNoteDraft,
  SectionStatus,
  SpeakerRole,
  Transcript,
} from "@shared/ambient-scribe";
import { SCRIBE_LIMITS } from "@shared/ambient-scribe";
import { matchTerms, terminology, type TermMatch } from "./terminology";

const SECTIONS: readonly NoteSection[] = ["subjective", "objective", "assessment", "plan"];

/**
 * Kinds whose section depends on who said them.
 *
 * Everything else has a fixed home: a symptom is subjective wherever it comes
 * from, an examination finding is objective because only the clinician can
 * make one.
 */
const ROLE_DEPENDENT: ReadonlySet<NoteItemKind> = new Set<NoteItemKind>([
  "diagnosis",
  "medication",
  "investigation",
  "advice",
  "follow-up",
]);

function sectionFor(kind: NoteItemKind, role: SpeakerRole): NoteSection {
  switch (kind) {
    case "symptom":
    case "history":
    case "allergy":
      return "subjective";
    case "examination":
    case "vital":
      return "objective";
    case "diagnosis":
      return role === "clinician" ? "assessment" : "subjective";
    case "medication":
    case "investigation":
    case "advice":
    case "follow-up":
      return role === "clinician" ? "plan" : "subjective";
  }
}

/**
 * How the item reads.
 *
 * The phrasing carries the attribution, because a clinician skimming a draft
 * reads the line and not the metadata. "Reports" and "Denies" are doing real
 * work here.
 */
function phrase(match: TermMatch, role: SpeakerRole): string {
  const term = match.entry.display;

  if (match.negated) return `Denies ${term.toLowerCase()}`;
  if (match.uncertain) return `${term} — mentioned conditionally or as family history; confirm`;

  if (match.entry.kind === "diagnosis" && role !== "clinician") {
    return `Reports a diagnosis of ${term.toLowerCase()}`;
  }
  if (match.entry.kind === "medication" && role !== "clinician") {
    return `Reports taking ${term.toLowerCase()}`;
  }
  if (match.entry.kind === "symptom" || match.entry.kind === "history") {
    return `Reports ${term.toLowerCase()}`;
  }
  return term;
}

/**
 * Construct an item, or refuse.
 *
 * The only constructor. An item with no evidence cannot exist, which is
 * enforced here rather than asserted in a comment.
 */
function item(input: {
  section: NoteSection;
  kind: NoteItemKind;
  text: string;
  evidence: readonly EvidenceSpan[];
  confidence: number;
  code?: NoteItem["code"];
}): NoteItem {
  if (input.evidence.length === 0) {
    throw new Error(
      "Refusing to construct a note item with no transcript evidence. Every clinical " +
        "statement in a scribe-generated note must be traceable to the words that " +
        "produced it; an unevidenced item is indistinguishable from an invented one.",
    );
  }
  return {
    id: randomUUID(),
    section: input.section,
    kind: input.kind,
    text: input.text,
    evidence: input.evidence,
    confidence: input.confidence,
    ...(input.code ? { code: input.code } : {}),
  };
}

export interface BuildNoteInput {
  sessionId: string;
  transcript: Transcript;
  /** False when no clinician voice was identified. Constrains what can be built. */
  rolesEstablished: boolean;
  /** Language to render the draft in. */
  language: string;
  /** True when that language has no hand-written copy and English was used. */
  languageFallback: boolean;
  now?: Date;
}

export interface BuiltNote {
  draft: ScribeNoteDraft;
  /** Items below the review threshold, or needing role confirmation. */
  needsReview: readonly NoteItem[];
  /** Human-readable notes about what was deliberately not built. */
  limitations: readonly string[];
}

export function buildNoteDraft(input: BuildNoteInput): BuiltNote {
  const { transcript, rolesEstablished } = input;
  const { terms, codesAvailable } = terminology();

  const items: NoteItem[] = [];
  /** Sections that saw only denials, tracked separately from sections that saw nothing. */
  const negativeOnly = new Set<NoteSection>();

  for (const turn of transcript.turns) {
    for (const match of matchTerms(turn.text, terms)) {
      const kind = match.entry.kind;

      // Without established roles a role-dependent kind cannot be placed. It is
      // not dropped — it is recorded as subjective and marked, so the clinician
      // sees what was said and can move it.
      if (!rolesEstablished && ROLE_DEPENDENT.has(kind)) {
        items.push(
          item({
            section: "subjective",
            kind,
            text: `${match.entry.display} — speaker not identified; confirm whether this was said by the clinician`,
            evidence: [{ turnIndex: turn.index, start: match.start, end: match.end }],
            confidence: Math.min(turn.confidence, 0.4),
          }),
        );
        continue;
      }

      const section = sectionFor(kind, turn.role);
      const text = phrase(match, turn.role);

      // A denial and an assertion are both content, but only an assertion
      // populates a section. Track the difference.
      if (match.negated) negativeOnly.add(section);

      const penalty = match.uncertain ? 0.5 : 1;
      items.push(
        item({
          section,
          kind,
          text,
          evidence: [{ turnIndex: turn.index, start: match.start, end: match.end }],
          confidence: Math.min(1, turn.confidence * penalty),
          ...(codesAvailable && match.entry.code ? { code: { ...match.entry.code, display: match.entry.display } } : {}),
        }),
      );
    }
  }

  const sectionStatus = {} as Record<NoteSection, SectionStatus>;
  for (const section of SECTIONS) {
    const inSection = items.filter((i) => i.section === section);
    const positives = inSection.filter((i) => !i.text.startsWith("Denies "));
    if (positives.length > 0) sectionStatus[section] = "populated";
    else if (inSection.length > 0 || negativeOnly.has(section)) {
      sectionStatus[section] = "explicitly-negative";
    } else sectionStatus[section] = "not-discussed";
  }

  const limitations: string[] = [];
  if (!rolesEstablished) {
    limitations.push(
      "No clinician voice was identified for this session, so no assessment or plan was " +
        "generated. Statements that would belong there are listed under subjective and " +
        "marked for confirmation, because attributing a plan to a sentence the patient " +
        "may have spoken would put a treatment decision in the record that no clinician made.",
    );
  }
  if (!codesAvailable) {
    limitations.push(
      "No terminology file is configured (SCRIBE_TERMINOLOGY_PATH), so items carry text " +
        "but no codes. The text is what was said; a code guessed from the development " +
        "seed would be a claim about meaning that nothing supports.",
    );
  }
  if (transcript.observedLanguages.length > 0) {
    limitations.push(
      `The consultation mixed ${transcript.primaryLanguage} with ` +
        `${transcript.observedLanguages.join(", ")}. Term matching ran over the mixed text, ` +
        "which is the intended behaviour, but recognition confidence for the embedded " +
        "terms is typically lower than the turn-level figure suggests.",
    );
  }

  const needsReview = items.filter(
    (i) => i.confidence < SCRIBE_LIMITS.REVIEW_CONFIDENCE_THRESHOLD,
  );

  const draft: ScribeNoteDraft = {
    sessionId: input.sessionId,
    items,
    sectionStatus,
    language: input.language,
    languageFallback: input.languageFallback,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };

  return { draft, needsReview, limitations };
}

/**
 * The words behind an item, for the reviewer.
 *
 * Review is only possible if it is cheap, and it is only cheap if the clinician
 * can see the source without hunting for it. A note whose provenance is
 * theoretically available but practically buried gets attested unread, which
 * defeats the attestation.
 */
export function evidenceText(transcript: Transcript, item: NoteItem): string[] {
  return item.evidence.map((span) => {
    const turn = transcript.turns[span.turnIndex];
    if (!turn) return "";
    const from = Math.max(0, span.start - 60);
    const to = Math.min(turn.text.length, span.end + 60);
    return turn.text.slice(from, to).trim();
  });
}
