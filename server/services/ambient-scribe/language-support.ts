/**
 * Which languages this deployment may actually run a scribe session in.
 *
 * The registry in `shared/india-languages.ts` says what the 22 Eighth Schedule
 * languages *are*. This file answers a different and much narrower question:
 * whether *this* installation, with *this* speech provider, can transcribe a
 * consultation in a given language without producing fiction.
 *
 * ## Why it is configuration and not a table
 *
 * The tempting shape is a constant listing the languages the ASR vendor
 * supports. It would be wrong within a quarter — providers add and remove
 * languages, and the set differs between a cloud endpoint and the on-premise
 * model an NHA deployment would run on approved infrastructure. Worse, a stale
 * table fails in the dangerous direction: it says yes for a language the
 * deployed recogniser has never seen, and a recogniser handed audio in a
 * language it does not model does not return an error. It returns confident
 * text. The words are wrong, the transcript is fluent, and the extractor
 * downstream cannot tell.
 *
 * So the allow-list is set by whoever knows the answer — the operator, from
 * their own provider's documented and tested coverage — and an **unset
 * allow-list refuses everything**. A deployment that has configured nothing
 * can transcribe nothing. That is the same posture the engagement module takes
 * for portal-link origins and DLT sender ids, for the same reason: a default
 * that guesses is indistinguishable from a default that works until the day it
 * matters.
 *
 * ## Three capabilities, resolved separately
 *
 * | Capability | Source of truth | Failure if wrong |
 * |---|---|---|
 * | speech input | `SCRIBE_SPEECH_LANGUAGES` | Fluent transcript of words nobody said |
 * | written copy | the string tables themselves | Reader gets English, and is told so |
 * | code-mixing | declared per session, checked here | English drug names mangled |
 *
 * A session needs speech input. Written copy missing is a degradation the
 * reader is warned about, not a refusal — an English safety banner is worth
 * more than no banner.
 */

import {
  indiaLanguage,
  isKnownCodeMix,
  type IndiaLanguage,
} from "@shared/india-languages";
import { SUMMARY_STRINGS } from "../engagement/summary-strings";
import type { ScribeRefusal } from "@shared/ambient-scribe";

/**
 * Codes the operator has confirmed their speech provider transcribes, as a
 * comma-separated list (`SCRIBE_SPEECH_LANGUAGES=hi,mr,en`).
 *
 * Read per call rather than cached at import so a deployment can change it
 * without a restart, and so tests can set it per case.
 */
export function speechAllowList(): readonly string[] {
  const raw = process.env.SCRIBE_SPEECH_LANGUAGES;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether hand-written copy exists for this language. Derived, never asserted. */
export function hasWrittenCopy(code: string): boolean {
  return code in SUMMARY_STRINGS;
}

export interface ResolvedScribeLanguage {
  ok: true;
  language: IndiaLanguage;
  /** The tag to hand the speech provider. */
  speechTag: string;
  /** Secondary languages the session declared and that are permitted. */
  mixedWith: readonly string[];
  /**
   * True when the draft will be rendered in English because this language has
   * no copy. The session still runs; the reader is told.
   */
  copyFallsBackToEnglish: boolean;
}

export interface RefusedScribeLanguage {
  ok: false;
  reason: Extract<
    ScribeRefusal,
    "language-unknown" | "language-speech-not-enabled" | "code-mix-not-declared"
  >;
  detail: string;
}

/**
 * Decide whether a session may start in this language.
 *
 * `mixedWith` is the caller's declaration that the consultation will also
 * contain another language — in practice almost always English. It is checked
 * rather than inferred: a recogniser configured for one language will not
 * quietly do better because the room switched, and a deployment that has not
 * enabled the second language cannot honour the declaration.
 */
export function resolveScribeLanguage(input: {
  primary: string;
  mixedWith?: readonly string[];
}): ResolvedScribeLanguage | RefusedScribeLanguage {
  const primary = input.primary.trim().toLowerCase();
  const language = indiaLanguage(primary);

  if (!language) {
    return {
      ok: false,
      reason: "language-unknown",
      detail:
        `"${input.primary}" is not in the Eighth Schedule registry. A scribe session ` +
        "cannot be started in a language the system has no entry for, because there " +
        "is no speech tag to request and no way to check whether it is enabled.",
    };
  }

  const allowed = speechAllowList();
  if (allowed.length === 0) {
    return {
      ok: false,
      reason: "language-speech-not-enabled",
      detail:
        "SCRIBE_SPEECH_LANGUAGES is unset, so no language is enabled for speech capture. " +
        "This is a refusal rather than a default: a recogniser handed audio in a language " +
        "it does not model returns fluent text rather than an error, so guessing here " +
        "produces a transcript that reads correctly and says something nobody said.",
    };
  }

  if (!allowed.includes(primary)) {
    return {
      ok: false,
      reason: "language-speech-not-enabled",
      detail:
        `${language.name} (${primary}) is not in SCRIBE_SPEECH_LANGUAGES. The operator has ` +
        "not confirmed the configured speech provider transcribes it.",
    };
  }

  const mixedWith: string[] = [];
  for (const raw of input.mixedWith ?? []) {
    const secondary = raw.trim().toLowerCase();
    if (secondary === primary) continue;

    if (!indiaLanguage(secondary)) {
      return {
        ok: false,
        reason: "language-unknown",
        detail: `Declared code-mix language "${raw}" is not in the registry.`,
      };
    }
    if (!allowed.includes(secondary)) {
      return {
        ok: false,
        reason: "language-speech-not-enabled",
        detail:
          `The session declares mixing with ${secondary}, which is not in ` +
          "SCRIBE_SPEECH_LANGUAGES. Accepting the declaration without the capability " +
          "would mean the English clinical terms — the drug and investigation names " +
          "that carry the actual content — are transcribed by a model that was not " +
          "asked to expect them.",
      };
    }
    if (!isKnownCodeMix(primary, secondary)) {
      return {
        ok: false,
        reason: "code-mix-not-declared",
        detail:
          `${primary} mixed with ${secondary} is not a documented pair in ` +
          "COMMON_CODE_MIXES. Add it there, with the deployment that observed it, " +
          "rather than letting an arbitrary pair through unreviewed.",
      };
    }
    mixedWith.push(secondary);
  }

  return {
    ok: true,
    language,
    speechTag: language.speechTag,
    mixedWith,
    copyFallsBackToEnglish: !hasWrittenCopy(primary),
  };
}
