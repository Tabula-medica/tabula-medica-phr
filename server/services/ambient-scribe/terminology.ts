/**
 * Recognising clinical terms in what was actually said.
 *
 * The EOI asks for solutions that "accurately interpret medical terminology".
 * In an Indian outpatient consultation that is a harder problem than it sounds,
 * and it fails in three specific ways that a lexicon built for US English does
 * not encounter.
 *
 * ## 1. Brand names are the vocabulary
 *
 * Nobody in the room says "paracetamol". They say Crocin, or Dolo, or Calpol.
 * A generic-only lexicon — like the one embedded in
 * `services/gcp/medical-speech-to-text.ts`, which lists `metformin` and
 * `atorvastatin` — will miss most of the drugs mentioned in most Indian
 * consultations while appearing to work, because the handful of generics it
 * does catch make the output look populated.
 *
 * ## 2. The clinical nouns are in a different language from the sentence
 *
 * "Aapko blood pressure ki dawai continue karni hai" is one clause with three
 * English clinical tokens inside Hindi grammar. Matching has to run over the
 * raw mixed text rather than over a language-tagged segmentation, because the
 * segmentation would split exactly where the terms are.
 *
 * ## 3. Negation carries the clinical meaning
 *
 * "Chest pain nahi hai" contains the term "chest pain" and asserts its
 * absence. An extractor that matches terms and ignores polarity produces a note
 * listing the symptom the patient specifically denied. This is the single most
 * common way a naive scribe produces a confidently wrong note, and it is
 * handled here rather than left to the model downstream.
 *
 * ## No terminology is bundled for production use
 *
 * The same posture as the RVU and HCC tables. A real deployment loads its
 * terminology from `SCRIBE_TERMINOLOGY_PATH` — for ABDM that means the NRCeS
 * SNOMED CT India edition and the ABDM-published value sets, which are
 * versioned, licensed, and revised on their own schedule.
 *
 * `SEED_TERMS` below exists so the pipeline is exercisable in development and
 * in tests. It is small, it is marked, and it is **not** a clinical
 * terminology. When no terminology file is loaded, terms still match from the
 * seed but **no code is attached** — an uncoded note item is a true statement
 * of what was said, whereas an item carrying a code guessed from a seed table
 * is a false statement about what it means.
 */

import { readFileSync } from "node:fs";
import type { NoteItemKind } from "@shared/ambient-scribe";

export interface TermEntry {
  /** Canonical display, used in the note when this term matched. */
  display: string;
  kind: NoteItemKind;
  /**
   * Surface forms to match, lower-cased. Brand names and common
   * transliterations belong here — they are what is actually said.
   */
  aliases: readonly string[];
  /** Attached only when a real terminology file supplied it. Never from the seed. */
  code?: { system: string; code: string };
}

/**
 * Development seed. Not a clinical terminology and deliberately tiny.
 *
 * Chosen to exercise the three hazards above rather than to cover practice:
 * brand-name entries, terms that appear inside code-mixed clauses, and terms
 * that are routinely negated.
 */
export const SEED_TERMS: readonly TermEntry[] = [
  { display: "Paracetamol", kind: "medication", aliases: ["paracetamol", "crocin", "dolo", "calpol", "acetaminophen"] },
  { display: "Amoxicillin-clavulanate", kind: "medication", aliases: ["augmentin", "amoxiclav", "amoxicillin clavulanate"] },
  { display: "Metformin", kind: "medication", aliases: ["metformin", "glycomet"] },
  { display: "Amlodipine", kind: "medication", aliases: ["amlodipine", "amlong", "amlokind"] },
  { display: "Pantoprazole", kind: "medication", aliases: ["pantoprazole", "pan", "pan-d", "pantop"] },
  { display: "Fever", kind: "symptom", aliases: ["fever", "bukhar", "बुखार", "jvar", "ज्वर", "காய்ச்சல்"] },
  { display: "Cough", kind: "symptom", aliases: ["cough", "khansi", "खांसी", "இருமல்"] },
  { display: "Chest pain", kind: "symptom", aliases: ["chest pain", "seene mein dard", "सीने में दर्द"] },
  { display: "Breathlessness", kind: "symptom", aliases: ["breathlessness", "shortness of breath", "saans phoolna", "सांस फूलना"] },
  { display: "Type 2 diabetes mellitus", kind: "diagnosis", aliases: ["type 2 diabetes", "diabetes", "sugar", "शुगर", "madhumeh", "मधुमेह"] },
  { display: "Hypertension", kind: "diagnosis", aliases: ["hypertension", "high blood pressure", "bp", "blood pressure"] },
  { display: "Complete blood count", kind: "investigation", aliases: ["cbc", "complete blood count", "haemogram", "hemogram"] },
  { display: "Blood glucose", kind: "investigation", aliases: ["blood sugar", "fasting sugar", "hba1c", "glucose"] },
  { display: "Chest X-ray", kind: "investigation", aliases: ["chest x-ray", "chest xray", "cxr"] },
  { display: "Penicillin allergy", kind: "allergy", aliases: ["penicillin allergy", "allergic to penicillin"] },
];

/**
 * Cues that the term immediately following them is being *denied*.
 *
 * Split by position because Indian languages put the negator after the noun
 * where English puts it before: English "no fever", Hindi "bukhar nahi". A
 * single pre-term list would catch the English and miss the Hindi, which is
 * the failure that puts a denied symptom into the note.
 */
const NEGATION_BEFORE = [
  "no", "not", "denies", "denied", "without", "negative for", "ruled out",
  "koi nahi", "nahi hai", "कोई नहीं",
];

const NEGATION_AFTER = [
  "nahi", "nahin", "नहीं", "nahi hai", "नहीं है", "illai", "இல்லை",
  "nai", "naikko", "নেই", "ನಿಲ್ಲ", "ইল্লা",
];

/** Cues that the mention is hypothetical or another person's — not this patient's finding. */
const UNCERTAIN_CUES = [
  "if", "in case", "agar", "अगर", "might", "may be", "maybe", "shayad", "शायद",
  "family history", "father", "mother", "brother", "sister", "papa", "mummy",
];

export interface TermMatch {
  entry: TermEntry;
  /** Character offsets into the turn text. */
  start: number;
  end: number;
  /** The literal surface form that matched. */
  surface: string;
  /** True when a negation cue governs this mention. */
  negated: boolean;
  /** True when the mention is hypothetical, conditional, or about a relative. */
  uncertain: boolean;
}

/** Window, in characters, within which a cue is taken to govern a term. */
const CUE_WINDOW = 40;

function hasCue(haystack: string, cues: readonly string[]): boolean {
  return cues.some((c) => haystack.includes(c));
}

/**
 * Find every known term in one utterance, with its polarity.
 *
 * Longest alias wins where two overlap, so "chest pain" is not also reported as
 * a bare "pain" match, and overlapping regions are consumed once.
 */
export function matchTerms(text: string, terms: readonly TermEntry[]): TermMatch[] {
  const lower = text.toLowerCase();
  const candidates: TermMatch[] = [];

  for (const entry of terms) {
    for (const alias of entry.aliases) {
      let from = 0;
      for (;;) {
        const at = lower.indexOf(alias, from);
        if (at === -1) break;
        from = at + 1;

        // Require a token boundary so "pan" does not match inside "pancreas".
        const before = at === 0 ? " " : lower[at - 1];
        const afterIdx = at + alias.length;
        const after = afterIdx >= lower.length ? " " : lower[afterIdx];
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;

        const pre = lower.slice(Math.max(0, at - CUE_WINDOW), at);
        const post = lower.slice(afterIdx, afterIdx + CUE_WINDOW);

        candidates.push({
          entry,
          start: at,
          end: afterIdx,
          surface: text.slice(at, afterIdx),
          negated: hasCue(pre, NEGATION_BEFORE) || hasCue(post, NEGATION_AFTER),
          uncertain: hasCue(pre, UNCERTAIN_CUES),
        });
      }
    }
  }

  // Longest first, then drop anything overlapping something already kept.
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: TermMatch[] = [];
  for (const c of candidates) {
    if (kept.some((k) => c.start < k.end && k.start < c.end)) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.start - b.start);
}

let loaded: readonly TermEntry[] | null = null;
let loadedFrom: string | null = null;

/**
 * The terminology this process will use.
 *
 * With `SCRIBE_TERMINOLOGY_PATH` set, the operator's file is used and its codes
 * are attached to matches. Without it, the seed is used and `codesAvailable` is
 * false, which the note builder honours by emitting uncoded items.
 */
export function terminology(): {
  terms: readonly TermEntry[];
  codesAvailable: boolean;
  source: string;
} {
  const path = process.env.SCRIBE_TERMINOLOGY_PATH;
  if (!path) {
    return { terms: SEED_TERMS, codesAvailable: false, source: "seed (development only)" };
  }
  if (loaded && loadedFrom === path) {
    return { terms: loaded, codesAvailable: true, source: path };
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as TermEntry[];
  loaded = parsed;
  loadedFrom = path;
  return { terms: parsed, codesAvailable: true, source: path };
}

/** Test seam. Never called from a request path. */
export function __resetTerminologyCache(): void {
  loaded = null;
  loadedFrom = null;
}
