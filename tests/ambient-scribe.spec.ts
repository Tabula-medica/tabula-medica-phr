/**
 * Ambient scribe tests.
 *
 * Weighted towards the refusals rather than the happy path, because every
 * defect this module is designed against produces output that *looks correct*.
 * A scribe that mis-attributes a sentence, transcribes an unsupported language,
 * or files an unsigned draft does not throw — it returns a fluent, plausible,
 * wrong note. So the assertions that matter are the ones pinning what the
 * module declines to produce.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  INDIA_LANGUAGES,
  EIGHTH_SCHEDULE_LANGUAGES,
  indiaLanguage,
  isKnownCodeMix,
  textDirection,
} from "@shared/india-languages";
import { SCRIBE_LIMITS } from "@shared/ambient-scribe";
import type { TranscriptTurn } from "@shared/ambient-scribe";
import {
  INDIA_COPY_COVERAGE,
  SUMMARY_STRINGS,
  summaryStrings,
} from "../server/services/engagement/summary-strings";
import {
  resolveScribeLanguage,
  speechAllowList,
  hasWrittenCopy,
} from "../server/services/ambient-scribe/language-support";
import { checkResidency } from "../server/services/ambient-scribe/residency";
import {
  evaluateRecordingConsent,
  withdrawalEffect,
  NOTICE_ELEMENTS,
  type RecordingConsent,
} from "../server/services/ambient-scribe/consent";
import {
  normaliseTurns,
  assignSpeakerRoles,
  buildTranscript,
  lowConfidenceShare,
} from "../server/services/ambient-scribe/transcript";
import { matchTerms, SEED_TERMS, terminology, __resetTerminologyCache } from "../server/services/ambient-scribe/terminology";
import { buildNoteDraft, evidenceText } from "../server/services/ambient-scribe/note-builder";
import { buildOpConsultBundle, NotAttestedError } from "../server/services/ambient-scribe/abdm-bundle";
import { createMemoryScribeStore, __setScribeStore, scribeStore } from "../server/services/ambient-scribe/scribe-store";
import { getTableConfig } from "drizzle-orm/pg-core";
import { scribeConsentsTable } from "@shared/schema";

const ENV_KEYS = [
  "SCRIBE_SPEECH_LANGUAGES",
  "SCRIBE_INFERENCE_REGION",
  "VERTEX_LOCATION",
  "SCRIBE_RESIDENCY_REGIONS_IN",
  "SCRIBE_RESIDENCY_REGIONS_US",
  "SCRIBE_TERMINOLOGY_PATH",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetTerminologyCache();
  __setScribeStore(createMemoryScribeStore());
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ---------------------------------------------------------------------------

describe("Eighth Schedule language registry", () => {
  it("carries exactly the 22 constitutional languages, plus English separately", () => {
    expect(EIGHTH_SCHEDULE_LANGUAGES).toHaveLength(22);
    expect(INDIA_LANGUAGES.filter((l) => !l.eighthSchedule).map((l) => l.code)).toEqual(["en"]);
  });

  it("includes the four added by the 92nd Amendment", () => {
    for (const code of ["brx", "doi", "mai", "sat"]) {
      expect(indiaLanguage(code), `${code} missing`).not.toBeNull();
    }
  });

  it("returns null for an unknown code rather than a default", () => {
    expect(indiaLanguage("xx")).toBeNull();
    expect(textDirection("xx")).toBeNull();
  });

  it("marks the Perso-Arabic languages right-to-left", () => {
    for (const code of ["ur", "ks", "sd"]) {
      expect(textDirection(code), code).toBe("rtl");
    }
    expect(textDirection("hi")).toBe("ltr");
  });

  it("records secondary scripts where a language genuinely has two", () => {
    expect(indiaLanguage("ks")!.alternateScripts).toContain("Deva");
    expect(indiaLanguage("mni")!.alternateScripts).toContain("Beng");
    // Santali's own script is primary and it has no widely-used alternate here.
    expect(indiaLanguage("sat")!.script).toBe("Olck");
  });

  it("treats code-mixing as symmetric", () => {
    expect(isKnownCodeMix("hi", "en")).toBe(true);
    expect(isKnownCodeMix("en", "hi")).toBe(true);
    expect(isKnownCodeMix("hi", "ta")).toBe(false);
  });
});

describe("written copy coverage", () => {
  it("reports coverage derived from the string table, not a hand-kept list", () => {
    for (const code of INDIA_COPY_COVERAGE.present) {
      expect(SUMMARY_STRINGS[code], `${code} claimed present`).toBeDefined();
    }
    for (const code of INDIA_COPY_COVERAGE.absent) {
      expect(SUMMARY_STRINGS[code], `${code} claimed absent`).toBeUndefined();
    }
  });

  it("accounts for all 22 with no language counted twice", () => {
    const all = [...INDIA_COPY_COVERAGE.present, ...INDIA_COPY_COVERAGE.absent];
    expect(all).toHaveLength(22);
    expect(new Set(all).size).toBe(22);
  });

  it("added the five Devanagari languages that were missing", () => {
    for (const code of ["ne", "mai", "doi", "kok", "sa"]) {
      expect(INDIA_COPY_COVERAGE.present).toContain(code);
    }
  });

  it("still declares the five that were not written, rather than shipping guesses", () => {
    expect([...INDIA_COPY_COVERAGE.absent].sort()).toEqual(["brx", "ks", "mni", "sat", "sd"]);
  });

  it("falls back to English for an absent language and says so", () => {
    const r = summaryStrings("sat");
    expect(r.fellBackToEnglish).toBe(true);
    expect(r.language).toBe("en");
  });

  it("keeps every new empty-state string distinct from the attested-none string", () => {
    // The safety property: "nothing was recorded" must never collapse into
    // "there are none". If a translation made them identical the distinction
    // the whole design rests on would be invisible to that reader.
    for (const code of ["ne", "mai", "doi", "kok", "sa"]) {
      const s = SUMMARY_STRINGS[code];
      expect(s.notRecordedAllergies, code).not.toBe(s.attestedNoneAllergies);
      expect(s.notRecordedMedications, code).not.toBe(s.attestedNoneMedications);
      expect(s.notRecordedDiagnoses, code).not.toBe(s.attestedNoneDiagnoses);
    }
  });

  it("gives every new language a non-empty value for all 15 keys", () => {
    const keys = Object.keys(SUMMARY_STRINGS.en) as (keyof typeof SUMMARY_STRINGS.en)[];
    for (const code of ["ne", "mai", "doi", "kok", "sa"]) {
      for (const key of keys) {
        expect(SUMMARY_STRINGS[code][key], `${code}.${String(key)}`).toBeTruthy();
      }
    }
  });

  it("keeps the share-message placeholders intact in the new languages", () => {
    for (const code of ["ne", "mai", "doi", "kok", "sa"]) {
      expect(SUMMARY_STRINGS[code].shareMessage, code).toContain("{{practiceName}}");
      expect(SUMMARY_STRINGS[code].shareMessage, code).toContain("{{shareUrl}}");
    }
  });
});

// ---------------------------------------------------------------------------

describe("speech language gate", () => {
  it("refuses everything when the allow-list is unset", () => {
    expect(speechAllowList()).toEqual([]);
    const r = resolveScribeLanguage({ primary: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("language-speech-not-enabled");
  });

  it("does not fall back to Hindi or English when a language is not enabled", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "hi,en";
    const r = resolveScribeLanguage({ primary: "sat" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("language-speech-not-enabled");
  });

  it("refuses an unknown code", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "hi";
    const r = resolveScribeLanguage({ primary: "klingon" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("language-unknown");
  });

  it("permits an enabled language and hands back its speech tag", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "mr,en";
    const r = resolveScribeLanguage({ primary: "mr", mixedWith: ["en"] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.speechTag).toBe("mr-IN");
      expect(r.mixedWith).toEqual(["en"]);
      expect(r.copyFallsBackToEnglish).toBe(false);
    }
  });

  it("uses the Gurmukhi-qualified tag for Punjabi", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "pa";
    const r = resolveScribeLanguage({ primary: "pa" });
    expect(r.ok && r.speechTag).toBe("pa-Guru-IN");
  });

  it("refuses a declared code-mix whose second language is not enabled", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "ta";
    const r = resolveScribeLanguage({ primary: "ta", mixedWith: ["en"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("language-speech-not-enabled");
  });

  it("refuses an undocumented pair even when both languages are enabled", () => {
    process.env.SCRIBE_SPEECH_LANGUAGES = "hi,ta";
    const r = resolveScribeLanguage({ primary: "hi", mixedWith: ["ta"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("code-mix-not-declared");
  });

  it("runs a session in a language with no copy, reporting the fallback", () => {
    // Missing copy degrades the note's headings; it does not stop the capture.
    process.env.SCRIBE_SPEECH_LANGUAGES = "sat";
    const r = resolveScribeLanguage({ primary: "sat" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.copyFallsBackToEnglish).toBe(true);
    expect(hasWrittenCopy("sat")).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("data residency", () => {
  it("refuses when no region is approved for the jurisdiction", () => {
    process.env.SCRIBE_INFERENCE_REGION = "asia-south1";
    const r = checkResidency("IN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("residency-not-configured");
  });

  it("refuses the US default region for an Indian consultation", () => {
    // The exact live hazard: baa-chat.ts defaults to us-central1, which is
    // correct under HIPAA and wrong for an Indian patient's voice.
    process.env.SCRIBE_RESIDENCY_REGIONS_IN = "asia-south1,asia-south2";
    process.env.VERTEX_LOCATION = "us-central1";
    const r = checkResidency("IN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("residency-violation");
  });

  it("permits an approved in-country region", () => {
    process.env.SCRIBE_RESIDENCY_REGIONS_IN = "asia-south1";
    process.env.SCRIBE_INFERENCE_REGION = "asia-south1";
    const r = checkResidency("IN");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.region).toBe("asia-south1");
  });

  it("prefers the scribe-specific region over the ambient Vertex location", () => {
    process.env.SCRIBE_RESIDENCY_REGIONS_IN = "asia-south1";
    process.env.VERTEX_LOCATION = "us-central1";
    process.env.SCRIBE_INFERENCE_REGION = "asia-south1";
    expect(checkResidency("IN").ok).toBe(true);
  });

  it("refuses when the process cannot say where it would send data", () => {
    process.env.SCRIBE_RESIDENCY_REGIONS_IN = "asia-south1";
    const r = checkResidency("IN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("residency-not-configured");
  });

  it("keeps jurisdictions independent", () => {
    process.env.SCRIBE_RESIDENCY_REGIONS_US = "us-central1";
    process.env.SCRIBE_INFERENCE_REGION = "us-central1";
    expect(checkResidency("US").ok).toBe(true);
    expect(checkResidency("IN").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

const fullConsent = (over: Partial<RecordingConsent> = {}): RecordingConsent => ({
  patientId: "p1",
  jurisdiction: "IN",
  purpose: "ambient-documentation",
  state: "granted",
  method: "verbal-attested",
  noticeLanguage: "hi",
  noticeVersion: "v1",
  noticeElements: [...NOTICE_ELEMENTS],
  capturedAt: new Date().toISOString(),
  capturedBy: "dr-1",
  ...over,
});

describe("recording consent", () => {
  it("refuses when nothing is on file", () => {
    const r = evaluateRecordingConsent(null, "ambient-documentation");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("consent-not-captured");
  });

  it("refuses a declined patient", () => {
    const r = evaluateRecordingConsent(fullConsent({ state: "refused" }), "ambient-documentation");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("consent-refused");
  });

  it("refuses after withdrawal", () => {
    const r = evaluateRecordingConsent(
      fullConsent({ state: "withdrawn", withdrawnAt: new Date().toISOString() }),
      "ambient-documentation",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("consent-withdrawn");
  });

  it("refuses when the notice omitted a DPDP s.5 element", () => {
    const partial = fullConsent({
      noticeElements: NOTICE_ELEMENTS.filter((e) => e !== "board-complaint-route"),
    });
    const r = evaluateRecordingConsent(partial, "ambient-documentation");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("consent-not-captured");
      expect(r.detail).toContain("board-complaint-route");
    }
  });

  it("refuses verbal consent with nobody attesting to having asked", () => {
    const r = evaluateRecordingConsent(
      fullConsent({ method: "verbal-attested", capturedBy: undefined }),
      "ambient-documentation",
    );
    expect(r.ok).toBe(false);
  });

  it("accepts written consent without a capturing clinician", () => {
    const r = evaluateRecordingConsent(
      fullConsent({ method: "written", capturedBy: undefined }),
      "ambient-documentation",
    );
    expect(r.ok).toBe(true);
  });

  it("refuses an unrecognised notice language", () => {
    const r = evaluateRecordingConsent(
      fullConsent({ noticeLanguage: "zz" }),
      "ambient-documentation",
    );
    expect(r.ok).toBe(false);
  });

  it("accepts a complete grant", () => {
    expect(evaluateRecordingConsent(fullConsent(), "ambient-documentation").ok).toBe(true);
  });
});

describe("withdrawal", () => {
  it("destroys audio and draft when nothing was attested", () => {
    const e = withdrawalEffect(false);
    expect(e.deleteAudio).toBe(true);
    expect(e.deleteDraft).toBe(true);
    expect(e.retainAttestedNote).toBe(false);
  });

  it("keeps an attested note but still destroys the audio", () => {
    const e = withdrawalEffect(true);
    expect(e.deleteAudio).toBe(true);
    expect(e.deleteDraft).toBe(false);
    expect(e.retainAttestedNote).toBe(true);
  });
});

// ---------------------------------------------------------------------------

const turn = (over: Partial<TranscriptTurn> & { text: string }): TranscriptTurn => ({
  index: 0,
  speakerTag: 0,
  role: "unknown",
  language: "hi-IN",
  startMs: 0,
  endMs: 1000,
  confidence: 0.9,
  ...over,
});

describe("transcript assembly", () => {
  it("orders turns by start time and reindexes", () => {
    const out = normaliseTurns([
      { speakerTag: 1, text: "second", language: "hi", startMs: 500, endMs: 900, confidence: 0.9 },
      { speakerTag: 0, text: "first", language: "hi", startMs: 0, endMs: 400, confidence: 0.9 },
    ]);
    expect(out.map((t) => t.text)).toEqual(["first", "second"]);
    expect(out.map((t) => t.index)).toEqual([0, 1]);
  });

  it("keeps low-confidence turns rather than filtering them out", () => {
    // Those are disproportionately the code-mixed ones, which carry the drugs.
    const out = normaliseTurns([
      { speakerTag: 0, text: "metformin continue karo", language: "hi", startMs: 0, endMs: 100, confidence: 0.2 },
    ]);
    expect(out).toHaveLength(1);
  });

  it("leaves every role unknown when no clinician voice was identified", () => {
    const { turns, rolesEstablished } = assignSpeakerRoles(
      [turn({ text: "a", speakerTag: 0 }), turn({ text: "b", speakerTag: 1, index: 1 })],
      {},
    );
    expect(rolesEstablished).toBe(false);
    expect(turns.every((t) => t.role === "unknown")).toBe(true);
  });

  it("assigns clinician, companion and patient from an established tag", () => {
    const { turns, rolesEstablished } = assignSpeakerRoles(
      [
        turn({ text: "a", speakerTag: 0 }),
        turn({ text: "b", speakerTag: 1, index: 1 }),
        turn({ text: "c", speakerTag: 2, index: 2 }),
      ],
      { clinicianSpeakerTag: 0, companionSpeakerTags: [2] },
    );
    expect(rolesEstablished).toBe(true);
    expect(turns.map((t) => t.role)).toEqual(["clinician", "patient", "companion"]);
  });

  it("refuses a transcript too short to be a consultation", () => {
    const r = buildTranscript({ turns: [turn({ text: "hello" })], primaryLanguage: "hi", engine: "test" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("transcript-empty");
  });

  it("refuses a recording long enough to be a forgotten microphone", () => {
    const tooLong = SCRIBE_LIMITS.MAX_RECORDING_MS + 1000;
    const r = buildTranscript({
      turns: [turn({ text: "a" }), turn({ text: "b", index: 1, startMs: tooLong - 10, endMs: tooLong })],
      primaryLanguage: "hi",
      engine: "test",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("recording-too-long");
  });

  it("reports a second language observed in the room as normal, not an error", () => {
    const r = buildTranscript({
      turns: [
        turn({ text: "bukhar hai" }),
        turn({ text: "take paracetamol", index: 1, language: "en-IN" }),
      ],
      primaryLanguage: "hi",
      engine: "test",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.transcript.observedLanguages).toEqual(["en"]);
  });

  it("measures the low-confidence share without acting on it", () => {
    const r = buildTranscript({
      turns: [turn({ text: "a", confidence: 0.2 }), turn({ text: "b", index: 1, confidence: 0.95 })],
      primaryLanguage: "hi",
      engine: "test",
    });
    expect(r.ok && lowConfidenceShare(r.transcript)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------

describe("terminology matching", () => {
  it("matches Indian brand names, not only generics", () => {
    const m = matchTerms("crocin de dena", SEED_TERMS);
    expect(m.map((x) => x.entry.display)).toContain("Paracetamol");
  });

  it("matches an English clinical term embedded in a Hindi clause", () => {
    const m = matchTerms("aapko blood pressure ki dawai continue karni hai", SEED_TERMS);
    expect(m.map((x) => x.entry.display)).toContain("Hypertension");
  });

  it("detects post-positional negation, which is how Indian languages negate", () => {
    const m = matchTerms("chest pain nahi hai", SEED_TERMS);
    const hit = m.find((x) => x.entry.display === "Chest pain");
    expect(hit?.negated).toBe(true);
  });

  it("detects English pre-positional negation", () => {
    const m = matchTerms("no fever since yesterday", SEED_TERMS);
    expect(m.find((x) => x.entry.display === "Fever")?.negated).toBe(true);
  });

  it("does not mark an unnegated mention as negated", () => {
    const m = matchTerms("fever since yesterday", SEED_TERMS);
    expect(m.find((x) => x.entry.display === "Fever")?.negated).toBe(false);
  });

  it("flags a family-history mention as uncertain rather than the patient's finding", () => {
    const m = matchTerms("father ko diabetes tha", SEED_TERMS);
    expect(m.find((x) => x.entry.display.includes("diabetes"))?.uncertain).toBe(true);
  });

  it("prefers the longer alias where two overlap", () => {
    const m = matchTerms("complete blood count", SEED_TERMS);
    expect(m).toHaveLength(1);
    expect(m[0].entry.display).toBe("Complete blood count");
  });

  it("respects token boundaries so 'pan' does not match inside a longer word", () => {
    const m = matchTerms("pancreas is normal", SEED_TERMS);
    expect(m.map((x) => x.entry.display)).not.toContain("Pantoprazole");
  });

  it("reports that no codes are available when no terminology file is configured", () => {
    const t = terminology();
    expect(t.codesAvailable).toBe(false);
    expect(t.source).toContain("seed");
  });
});

// ---------------------------------------------------------------------------

function transcriptOf(turns: TranscriptTurn[]) {
  const r = buildTranscript({ turns, primaryLanguage: "hi", engine: "test" });
  if (!r.ok) throw new Error(r.detail);
  return r.transcript;
}

describe("note builder", () => {
  it("gives every item transcript evidence", () => {
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin lijiye", index: 1, role: "clinician" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1",
      transcript: t,
      rolesEstablished: true,
      language: "hi",
      languageFallback: false,
    });
    expect(draft.items.length).toBeGreaterThan(0);
    for (const i of draft.items) expect(i.evidence.length).toBeGreaterThan(0);
  });

  it("makes a clinician's diagnosis an assessment", () => {
    const t = transcriptOf([
      turn({ text: "aapko hypertension hai", role: "clinician" }),
      turn({ text: "theek hai", index: 1, role: "patient" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    const dx = draft.items.find((i) => i.kind === "diagnosis");
    expect(dx?.section).toBe("assessment");
  });

  it("makes the same sentence from the patient a reported belief, not an assessment", () => {
    const t = transcriptOf([
      turn({ text: "mujhe hypertension hai", role: "patient" }),
      turn({ text: "dekhte hain", index: 1, role: "clinician" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    const dx = draft.items.find((i) => i.kind === "diagnosis");
    expect(dx?.section).toBe("subjective");
    expect(dx?.text.toLowerCase()).toContain("reports");
    expect(draft.sectionStatus.assessment).toBe("not-discussed");
  });

  it("builds no assessment or plan at all when roles were never established", () => {
    const t = transcriptOf([
      turn({ text: "aapko hypertension hai" }),
      turn({ text: "crocin lijiye", index: 1 }),
    ]);
    const { draft, limitations } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: false, language: "hi", languageFallback: false,
    });
    expect(draft.sectionStatus.assessment).toBe("not-discussed");
    expect(draft.sectionStatus.plan).toBe("not-discussed");
    expect(limitations.join(" ")).toContain("No clinician voice was identified");
  });

  it("still surfaces what was said when roles are unknown, marked for confirmation", () => {
    const t = transcriptOf([
      turn({ text: "aapko hypertension hai" }),
      turn({ text: "theek hai", index: 1 }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: false, language: "hi", languageFallback: false,
    });
    const dx = draft.items.find((i) => i.kind === "diagnosis");
    expect(dx).toBeDefined();
    expect(dx!.section).toBe("subjective");
    expect(dx!.text).toContain("speaker not identified");
  });

  it("records a denial as a denial, never as the symptom", () => {
    const t = transcriptOf([
      turn({ text: "chest pain nahi hai", role: "patient" }),
      turn({ text: "accha", index: 1, role: "clinician" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    const item = draft.items.find((i) => i.text.includes("chest pain"));
    expect(item?.text).toBe("Denies chest pain");
    expect(draft.items.some((i) => i.text === "Reports chest pain")).toBe(false);
  });

  it("distinguishes a section that was never discussed from one with only negatives", () => {
    const t = transcriptOf([
      turn({ text: "fever nahi hai", role: "patient" }),
      turn({ text: "accha", index: 1, role: "clinician" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    expect(draft.sectionStatus.subjective).toBe("explicitly-negative");
    expect(draft.sectionStatus.objective).toBe("not-discussed");
  });

  it("attaches no code when no terminology file is loaded", () => {
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    const { draft, limitations } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    expect(draft.items.every((i) => i.code === undefined)).toBe(true);
    expect(limitations.join(" ")).toContain("SCRIBE_TERMINOLOGY_PATH");
  });

  it("is deterministic apart from item ids", () => {
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin lijiye", index: 1, role: "clinician" }),
    ]);
    const a = buildNoteDraft({ sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false });
    const b = buildNoteDraft({ sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false });
    expect(a.draft.items.map((i) => [i.section, i.kind, i.text])).toEqual(
      b.draft.items.map((i) => [i.section, i.kind, i.text]),
    );
  });

  it("hands the reviewer the words behind an item", () => {
    const t = transcriptOf([
      turn({ text: "mujhe teen din se bukhar hai", role: "patient" }),
      turn({ text: "accha", index: 1, role: "clinician" }),
    ]);
    const { draft } = buildNoteDraft({
      sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
    });
    const quotes = evidenceText(t, draft.items[0]);
    expect(quotes[0]).toContain("bukhar");
  });
});

// ---------------------------------------------------------------------------

const attestation = {
  attestedBy: "dr-1",
  attestedByName: "Dr A Rao",
  attestedAt: "2026-09-02T10:00:00.000Z",
  editedItemCount: 1,
  removedItemCount: 0,
};

function draftFor() {
  const t = transcriptOf([
    turn({ text: "bukhar hai", role: "patient" }),
    turn({ text: "crocin lijiye", index: 1, role: "clinician" }),
  ]);
  return buildNoteDraft({
    sessionId: "s1", transcript: t, rolesEstablished: true, language: "hi", languageFallback: false,
  }).draft;
}

describe("ABDM OP Consultation Record", () => {
  it("refuses to build from an unattested draft", () => {
    expect(() =>
      buildOpConsultBundle({
        draft: draftFor(),
        attestation: { ...attestation, attestedBy: "", attestedAt: "" },
        patient: { id: "p1", name: "A" },
        practitioner: { id: "dr-1", name: "Dr A Rao" },
      }),
    ).toThrow(NotAttestedError);
  });

  it("emits a FHIR document bundle naming the attesting clinician as author", () => {
    const { bundle } = buildOpConsultBundle({
      draft: draftFor(),
      attestation,
      patient: { id: "p1", name: "A Patel" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
    });
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("document");
    const comp = bundle.entry[0].resource as Record<string, unknown>;
    expect(comp.resourceType).toBe("Composition");
    expect((comp.author as { reference: string }[])[0].reference).toBe("Practitioner/dr-1");
    expect(comp.date).toBe(attestation.attestedAt);
  });

  it("omits section codes and says so when no validated IG map is supplied", () => {
    const { assurance, caveats, bundle } = buildOpConsultBundle({
      draft: draftFor(),
      attestation,
      patient: { id: "p1", name: "A" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
    });
    expect(assurance).toBe("titles-only");
    expect(caveats.join(" ")).toContain("no terminology codes");
    const comp = bundle.entry[0].resource as unknown as { section: { code: Record<string, unknown> }[] };
    expect(comp.section.every((s) => !("coding" in s.code))).toBe(true);
  });

  it("uses supplied IG section codes when given them", () => {
    const { assurance, bundle } = buildOpConsultBundle({
      draft: draftFor(),
      attestation,
      patient: { id: "p1", name: "A" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
      sectionCodes: {
        assessment: { system: "http://snomed.info/sct", code: "51848007", display: "Assessment" },
      },
    });
    expect(assurance).toBe("ig-validated-codes");
    const comp = bundle.entry[0].resource as unknown as { section: { title: string; code: Record<string, unknown> }[] };
    const assess = comp.section.find((s) => s.title === "Assessment")!;
    expect(assess.code.coding).toBeDefined();
  });

  it("renders an undiscussed section as absence of information, never as a negative", () => {
    const { bundle } = buildOpConsultBundle({
      draft: draftFor(),
      attestation,
      patient: { id: "p1", name: "A" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
    });
    const comp = bundle.entry[0].resource as unknown as {
      section: { title: string; text: { div: string } }[];
    };
    const objective = comp.section.find((s) => s.title.startsWith("Physical examination"))!;
    expect(objective.text.div).toContain("absence of information");
    expect(objective.text.div).not.toContain("No abnormality");
  });

  it("escapes note text rather than letting it become markup", () => {
    const base = draftFor();
    const draft = {
      ...base,
      items: [{ ...base.items[0], text: '<img src=x onerror="alert(1)">' }],
    };
    const { bundle } = buildOpConsultBundle({
      draft,
      attestation,
      patient: { id: "p1", name: "A" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
    });
    const comp = bundle.entry[0].resource as unknown as { section: { text: { div: string } }[] };
    const all = comp.section.map((s) => s.text.div).join("");
    // The text survives as inert display text; what must not survive is a tag.
    expect(all).not.toContain("<img");
    expect(all).toContain("&lt;img");
  });

  it("reports uncoded items rather than implying the note is machine-comparable", () => {
    const { caveats } = buildOpConsultBundle({
      draft: draftFor(),
      attestation,
      patient: { id: "p1", name: "A" },
      practitioner: { id: "dr-1", name: "Dr A Rao" },
    });
    expect(caveats.join(" ")).toContain("no terminology code");
  });
});

// ---------------------------------------------------------------------------

describe("scribe store contract", () => {
  const start = () =>
    scribeStore().createSession({
      profileId: "p1",
      clinicianAccountId: "dr-1",
      jurisdiction: "IN",
      language: "hi",
      mixedWith: ["en"],
      processedInRegion: "asia-south1",
      draftExpiresAt: new Date(Date.now() + 3600_000),
    });

  it("starts a session in the recording state with no attestation", async () => {
    const s = await start();
    expect(s.status).toBe("recording");
    expect(s.attestation).toBeUndefined();
  });

  it("accepts one attestation and refuses the second", async () => {
    const s = await start();
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({
      id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test",
    });

    const first = await scribeStore().attest(s.id, attestation);
    expect(first?.status).toBe("attested");

    // The conditional-update semantics: a second signature does not overwrite
    // the first, and the caller is told rather than silently succeeding.
    const second = await scribeStore().attest(s.id, { ...attestation, attestedBy: "dr-2" });
    expect(second).toBeNull();
  });

  it("refuses to replace the transcript behind an attestation", async () => {
    const s = await start();
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });
    await scribeStore().attest(s.id, attestation);

    const again = await scribeStore().saveDraft({
      id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "other",
    });
    expect(again).toBeNull();
  });

  it("purges an unattested draft on withdrawal", async () => {
    const s = await start();
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });

    await scribeStore().purgeDraft(s.id);
    const after = await scribeStore().getSession(s.id);
    expect(after?.transcript).toBeUndefined();
    expect(after?.draft).toBeUndefined();
    expect(after?.status).toBe("abandoned");
    expect(after?.audioDeletedAt).toBeTruthy();
  });

  it("never purges the content behind an attested note", async () => {
    const s = await start();
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });
    await scribeStore().attest(s.id, attestation);

    await scribeStore().purgeDraft(s.id);
    const after = await scribeStore().getSession(s.id);
    expect(after?.draft).toBeDefined();
    expect(after?.status).toBe("attested");
  });

  it("round-trips a consent record", async () => {
    await scribeStore().putConsent(fullConsent());
    const found = await scribeStore().findConsent("p1", "ambient-documentation");
    expect(found?.state).toBe("granted");
    expect(found?.noticeElements).toHaveLength(NOTICE_ELEMENTS.length);
  });
});

// ---------------------------------------------------------------------------

/**
 * Round 9 — the withdrawal that could be outvoted by a stale grant.
 *
 * `putConsent` was a bare insert against a table with no unique constraint,
 * and `findConsent` was `LIMIT 1` with no ordering. Writing a withdrawal
 * appended a second row and left the superseded `granted` row equally
 * reachable, so recording could continue for a patient who had exercised DPDP
 * s.6(6) — with the withdrawal sitting in the table looking honoured.
 *
 * The memory double hid it by keying on profile+purpose, which made the double
 * *more correct than production*. These tests pin both halves: the behaviour,
 * against a double that now mirrors the real semantics, and the DDL, which no
 * in-memory double can ever check.
 */
describe("consent supersession", () => {
  const at = (iso: string) => fullConsent({ capturedAt: iso });

  it("returns the withdrawal, not the grant it superseded", async () => {
    await scribeStore().putConsent(at("2026-09-02T09:00:00.000Z"));
    await scribeStore().putConsent({
      ...at("2026-09-02T09:30:00.000Z"),
      state: "withdrawn",
      withdrawnAt: "2026-09-02T09:30:00.000Z",
    });

    const found = await scribeStore().findConsent("p1", "ambient-documentation");
    expect(found?.state).toBe("withdrawn");
  });

  it("refuses a session once the withdrawal is the current state", async () => {
    // The property that actually matters: the gate sees the withdrawal.
    await scribeStore().putConsent(at("2026-09-02T09:00:00.000Z"));
    await scribeStore().putConsent({
      ...at("2026-09-02T09:30:00.000Z"),
      state: "withdrawn",
      withdrawnAt: "2026-09-02T09:30:00.000Z",
    });

    const found = await scribeStore().findConsent("p1", "ambient-documentation");
    const decision = evaluateRecordingConsent(found, "ambient-documentation");
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("consent-withdrawn");
  });

  it("does not let an older grant arriving late overwrite a newer withdrawal", async () => {
    // A retry, a slow instance, a queued request. Last-writer-wins by arrival
    // would resurrect consent here; the write is conditional on capturedAt.
    await scribeStore().putConsent({
      ...at("2026-09-02T09:30:00.000Z"),
      state: "withdrawn",
      withdrawnAt: "2026-09-02T09:30:00.000Z",
    });
    await scribeStore().putConsent(at("2026-09-02T09:00:00.000Z"));

    const found = await scribeStore().findConsent("p1", "ambient-documentation");
    expect(found?.state).toBe("withdrawn");
  });

  it("reports the state that stands when a write is superseded", async () => {
    await scribeStore().putConsent({
      ...at("2026-09-02T09:30:00.000Z"),
      state: "withdrawn",
      withdrawnAt: "2026-09-02T09:30:00.000Z",
    });
    // The caller is told what is true, not that their rejected grant landed.
    const returned = await scribeStore().putConsent(at("2026-09-02T09:00:00.000Z"));
    expect(returned.state).toBe("withdrawn");
  });

  it("still accepts a genuine later re-grant", async () => {
    // Withdrawal is not permanent: a patient who declined last visit can agree
    // at the next one, and the monotonic guard must not block that.
    await scribeStore().putConsent({
      ...at("2026-09-02T09:30:00.000Z"),
      state: "withdrawn",
      withdrawnAt: "2026-09-02T09:30:00.000Z",
    });
    await scribeStore().putConsent(at("2026-09-09T10:00:00.000Z"));

    const found = await scribeStore().findConsent("p1", "ambient-documentation");
    expect(found?.state).toBe("granted");
  });

  it("destroys unattested drafts when the withdrawal is recorded, not later", async () => {
    // Round 10: the consent route returned withdrawalEffect(false) — an object
    // saying deleteDraft: true — and purged nothing. The draft survived until
    // some *later* request happened to re-check consent, and could be attested
    // and exported in the meantime.
    const s = await scribeStore().createSession({
      profileId: "p1",
      clinicianAccountId: "dr-1",
      jurisdiction: "IN",
      language: "hi",
      mixedWith: [],
      processedInRegion: "asia-south1",
      draftExpiresAt: new Date(Date.now() + 3600_000),
    });
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });

    const applied = await scribeStore().applyWithdrawal("p1");
    expect(applied.purgedDrafts).toBe(1);
    expect(applied.attestedRetained).toBe(0);

    const after = await scribeStore().getSession(s.id);
    expect(after?.draft).toBeUndefined();
    expect(after?.transcript).toBeUndefined();
    expect(after?.status).toBe("abandoned");
    expect(after?.audioDeletedAt).toBeTruthy();
  });

  it("keeps an attested note on withdrawal but destroys its transcript", async () => {
    const s = await scribeStore().createSession({
      profileId: "p1",
      clinicianAccountId: "dr-1",
      jurisdiction: "IN",
      language: "hi",
      mixedWith: [],
      processedInRegion: "asia-south1",
      draftExpiresAt: new Date(Date.now() + 3600_000),
    });
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: s.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });
    await scribeStore().attest(s.id, attestation);

    const applied = await scribeStore().applyWithdrawal("p1");
    expect(applied.attestedRetained).toBe(1);
    expect(applied.purgedDrafts).toBe(0);

    const after = await scribeStore().getSession(s.id);
    // The record of care survives; the verbatim capture of the room does not.
    expect(after?.draft).toBeDefined();
    expect(after?.attestation).toBeDefined();
    expect(after?.transcript).toBeUndefined();
  });

  it("leaves another patient's sessions untouched", async () => {
    const mine = await scribeStore().createSession({
      profileId: "p1", clinicianAccountId: "dr-1", jurisdiction: "IN", language: "hi",
      mixedWith: [], processedInRegion: "asia-south1", draftExpiresAt: new Date(Date.now() + 3600_000),
    });
    const theirs = await scribeStore().createSession({
      profileId: "p2", clinicianAccountId: "dr-1", jurisdiction: "IN", language: "hi",
      mixedWith: [], processedInRegion: "asia-south1", draftExpiresAt: new Date(Date.now() + 3600_000),
    });
    const t = transcriptOf([
      turn({ text: "bukhar hai", role: "patient" }),
      turn({ text: "crocin", index: 1, role: "clinician" }),
    ]);
    await scribeStore().saveDraft({ id: mine.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });
    await scribeStore().saveDraft({ id: theirs.id, transcript: t, draft: draftFor(), rolesEstablished: true, engine: "test" });

    await scribeStore().applyWithdrawal("p1");

    expect((await scribeStore().getSession(mine.id))?.draft).toBeUndefined();
    expect((await scribeStore().getSession(theirs.id))?.draft).toBeDefined();
  });

  it("keeps one row per patient and purpose, enforced in the schema", () => {
    // The half no in-memory double can catch. Without this index the postgres
    // store appends, and every behavioural test above still passes.
    const cfg = getTableConfig(scribeConsentsTable);
    const unique = cfg.indexes.filter((i) => i.config.unique);
    const cols = unique.map((i) =>
      (i.config.columns as { name?: string }[]).map((c) => c.name).sort().join(","),
    );
    expect(cols).toContain("profile_id,purpose");
  });
});
