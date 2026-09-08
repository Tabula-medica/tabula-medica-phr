/**
 * Turning a provider's diarised output into a transcript this system will act on.
 *
 * Speech providers return speaker *tags* — anonymous integers meaning "the same
 * voice as before". They do not return roles, and the gap between those two
 * things is where the most damaging class of scribe error lives.
 *
 * ## Why a wrong role is worse than a wrong word
 *
 * A misheard word usually reads as nonsense and gets corrected. A misattributed
 * turn reads perfectly and is wrong in a way that survives review. Two examples,
 * both from the ordinary shape of an outpatient consultation:
 *
 * - The patient says "I think it's just acidity". Attributed to the clinician,
 *   that becomes an assessment in the note. It was a patient's guess.
 * - The clinician says "stop the ibuprofen". Attributed to the patient, it
 *   becomes a reported history of having stopped it. It was an instruction, and
 *   the note now shows a drug discontinued that the patient is still taking.
 *
 * Neither looks like an error on the page. Both change care.
 *
 * ## So roles are established, not inferred
 *
 * The reliable signal is out-of-band: the clinician identifies their own voice,
 * once, at the start of the session. Where that is available it is used and
 * nothing else is guessed at.
 *
 * Where it is not, this module assigns `unknown` and says so. It does not fall
 * back to "the first speaker is the doctor" — in a real OPD the first voice is
 * as often the attendant settling the patient into the chair — nor to "whoever
 * asks questions", because patients ask questions and clinicians dictate
 * statements. A heuristic that is right most of the time is exactly what
 * produces the two errors above at a rate low enough for nobody to catch.
 *
 * `unknown` is not a failure state. It is a truthful one, and the note builder
 * knows what it may and may not construct from it.
 */

import type { SpeakerRole, TranscriptTurn, Transcript } from "@shared/ambient-scribe";
import { SCRIBE_LIMITS } from "@shared/ambient-scribe";

/** What a provider hands back, before roles exist. */
export interface RawTurn {
  speakerTag: number;
  text: string;
  language: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface RoleAssignment {
  /**
   * The diarisation tag belonging to the clinician, established out-of-band —
   * the clinician identifying their own voice at session start. Absent means
   * absent; it is never derived from the audio.
   */
  clinicianSpeakerTag?: number;
  /**
   * Tags known to be a companion — an attendant, relative or interpreter.
   * Usually empty, and usually only known when someone said so.
   */
  companionSpeakerTags?: readonly number[];
}

/**
 * Order turns, index them, and drop nothing.
 *
 * Low-confidence turns stay. The temptation is to filter below some threshold
 * for a cleaner transcript, and it is the wrong instinct: the turns a
 * recogniser is least sure of are disproportionately the code-mixed ones,
 * which is to say the ones containing the English drug names. Dropping them
 * removes the clinical content and leaves the pleasantries.
 */
export function normaliseTurns(raw: readonly RawTurn[]): TranscriptTurn[] {
  return [...raw]
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
    .map((t, index) => ({
      index,
      speakerTag: t.speakerTag,
      role: "unknown" as SpeakerRole,
      text: t.text,
      language: t.language,
      startMs: t.startMs,
      endMs: t.endMs,
      confidence: t.confidence,
    }));
}

/**
 * Apply established roles.
 *
 * With a clinician tag: that tag is the clinician, declared companions are
 * companions, and every *other* tag is the patient — which is safe, because in
 * a two-or-three-voice consultation the remainder after the clinician and the
 * named companions is the person being treated.
 *
 * Without a clinician tag: everything stays `unknown`. There is no partial
 * credit here. Assigning roles to some turns and not others produces a
 * transcript that looks authoritative in patches, which is harder to review
 * than one that is uniformly honest about not knowing.
 */
export function assignSpeakerRoles(
  turns: readonly TranscriptTurn[],
  assignment: RoleAssignment,
): { turns: TranscriptTurn[]; rolesEstablished: boolean } {
  const clinicianTag = assignment.clinicianSpeakerTag;
  if (clinicianTag === undefined) {
    return { turns: turns.map((t) => ({ ...t, role: "unknown" })), rolesEstablished: false };
  }

  const companions = new Set(assignment.companionSpeakerTags ?? []);
  const assigned = turns.map((t) => {
    let role: SpeakerRole;
    if (t.speakerTag === clinicianTag) role = "clinician";
    else if (companions.has(t.speakerTag)) role = "companion";
    else role = "patient";
    return { ...t, role };
  });

  return { turns: assigned, rolesEstablished: true };
}

export type TranscriptRefusal = { ok: false; reason: "transcript-empty" | "recording-too-long"; detail: string };

/**
 * Assemble a transcript, refusing the two shapes that must not become a note.
 *
 * An empty or near-empty transcript is refused rather than turned into an
 * empty note, because an empty note is indistinguishable from a consultation
 * in which nothing was found — and this repository already treats that
 * confusion, in the allergy list, as the most dangerous thing it can ship.
 */
export function buildTranscript(input: {
  turns: readonly TranscriptTurn[];
  primaryLanguage: string;
  engine: string;
}): { ok: true; transcript: Transcript } | TranscriptRefusal {
  const { turns, primaryLanguage, engine } = input;

  if (turns.length < SCRIBE_LIMITS.MIN_TRANSCRIPT_TURNS) {
    return {
      ok: false,
      reason: "transcript-empty",
      detail:
        `The transcript has ${turns.length} turn(s), below the minimum of ` +
        `${SCRIBE_LIMITS.MIN_TRANSCRIPT_TURNS}. Refusing to build a note: an empty note ` +
        "reads as a consultation in which nothing was found, and this was a consultation " +
        "that was not captured.",
    };
  }

  const durationMs = turns.reduce((max, t) => Math.max(max, t.endMs), 0);
  if (durationMs > SCRIBE_LIMITS.MAX_RECORDING_MS) {
    return {
      ok: false,
      reason: "recording-too-long",
      detail:
        `The recording spans ${Math.round(durationMs / 60000)} minutes, beyond the ` +
        `${SCRIBE_LIMITS.MAX_RECORDING_MS / 60000}-minute ceiling. A session this long is ` +
        "far more likely to be a recorder left running between patients than a single " +
        "consultation, and that is a privacy incident rather than a long appointment.",
    };
  }

  const observed = new Set<string>();
  for (const t of turns) {
    const base = t.language.split("-")[0].toLowerCase();
    if (base && base !== primaryLanguage) observed.add(base);
  }

  return {
    ok: true,
    transcript: {
      turns,
      primaryLanguage,
      observedLanguages: Array.from(observed).sort(),
      durationMs,
      engine,
    },
  };
}

/** Proportion of turns the recogniser was unsure about. Surfaced, not acted on. */
export function lowConfidenceShare(transcript: Transcript, threshold = 0.5): number {
  if (transcript.turns.length === 0) return 0;
  const low = transcript.turns.filter((t) => t.confidence < threshold).length;
  return low / transcript.turns.length;
}
