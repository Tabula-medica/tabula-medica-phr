/**
 * The 22 languages of the Eighth Schedule to the Constitution of India, plus
 * English, modelled for clinical speech capture and clinical documentation.
 *
 * ## Why this file exists rather than a flat string list
 *
 * The engagement module shipped template copy in 12 Indian languages and the
 * docs recorded "only 10 of the 22 Eighth Schedule languages have template
 * copy" as a known gap. A flat list of codes cannot close that gap honestly,
 * because "supported" is not one property. Three different things get called
 * language support and they fail in different ways:
 *
 * | Capability | What it means | What a wrong answer costs |
 * |---|---|---|
 * | `writtenCopy` | Hand-written UI/notice strings exist | The reader sees English, or worse, a machine translation of a safety string |
 * | `speechInput` | The configured ASR provider transcribes it | Audio is silently transcribed as the wrong language and the note is fiction |
 * | `clinicalTerms` | Medical vocabulary is normalised in it | Drug and diagnosis mentions are missed, so the note is incomplete |
 *
 * A single boolean would let a session start in Santali because the notice
 * text exists, hand the audio to a recogniser that has never heard Santali,
 * and produce a confident transcript of nothing. So the registry carries what
 * is *intrinsic* to the language — code, script, direction, native name — and
 * the capabilities are resolved at runtime against the operator's actual
 * provider configuration in `language-support.ts`. This file never asserts
 * that a vendor supports a language.
 *
 * ## Why the script matters, not just the code
 *
 * Four of these languages are routinely written in more than one script, and
 * the choice is not cosmetic:
 *
 * - **Kashmiri** and **Sindhi** are written in Perso-Arabic and in Devanagari.
 * - **Manipuri** is written in Meitei Mayek and in the Bengali script.
 * - **Santali** has its own script, Ol Chiki, devised for it.
 *
 * Rendering Kashmiri right-to-left in an Arabic script when the reader expects
 * Devanagari does not merely look wrong — a mixed-direction line containing a
 * dose ("10 mg") can reorder visually, which is a medication-safety problem,
 * not a typography one. So direction is explicit and per-entry.
 *
 * ## Code-mixing is the normal case, not an error
 *
 * An Indian consultation is very often conducted in two languages at once —
 * Hindi grammar with English clinical nouns is the default register in much of
 * North India, and the same pattern holds for Tamil-English, Bengali-English
 * and the rest. A recogniser locked to a single language tag will mis-transcribe
 * the English clinical terms, which are precisely the words that carry the
 * clinical content. `COMMON_CODE_MIXES` records the pairs a deployment should
 * expect so a session can declare them rather than discover them.
 *
 * Sources: the Eighth Schedule as amended by the Constitution (Ninety-Second
 * Amendment) Act, 2003, which added Bodo, Dogri, Maithili and Santali; ISO
 * 639-1/639-3 for the codes; ISO 15924 for the scripts.
 */

/** ISO 15924 script codes used by the languages in this registry. */
export type ScriptCode =
  | "Arab" // Perso-Arabic
  | "Beng" // Bengali-Assamese
  | "Deva" // Devanagari
  | "Gujr" // Gujarati
  | "Guru" // Gurmukhi
  | "Knda" // Kannada
  | "Latn" // Latin
  | "Mlym" // Malayalam
  | "Mtei" // Meitei Mayek
  | "Olck" // Ol Chiki
  | "Orya" // Odia
  | "Taml" // Tamil
  | "Telu"; // Telugu

export type TextDirection = "ltr" | "rtl";

export interface IndiaLanguage {
  /** ISO 639-1 where one exists, otherwise ISO 639-3. Stable key. */
  code: string;
  /** English name, as used in the Eighth Schedule. */
  name: string;
  /** Endonym, in the language's own primary script. */
  nativeName: string;
  /** Primary script in official and clinical use. */
  script: ScriptCode;
  /**
   * Scripts other than `script` in substantial current use. Empty for most.
   * A deployment serving a region that uses a secondary script must say so
   * explicitly; it is never inferred.
   */
  alternateScripts: readonly ScriptCode[];
  direction: TextDirection;
  /**
   * BCP-47 tag to *request* from a speech provider. Candidate, not a claim:
   * whether the provider honours it is decided by configuration.
   */
  speechTag: string;
  /** In the Eighth Schedule. False for English. */
  eighthSchedule: boolean;
}

const L = (
  code: string,
  name: string,
  nativeName: string,
  script: ScriptCode,
  speechTag: string,
  opts: {
    direction?: TextDirection;
    alternateScripts?: readonly ScriptCode[];
    eighthSchedule?: boolean;
  } = {},
): IndiaLanguage => ({
  code,
  name,
  nativeName,
  script,
  alternateScripts: opts.alternateScripts ?? [],
  direction: opts.direction ?? "ltr",
  speechTag,
  eighthSchedule: opts.eighthSchedule ?? true,
});

/**
 * The 22 Eighth Schedule languages in the Schedule's own alphabetical order,
 * followed by English.
 *
 * English is included because it is the associate official language and the
 * register most Indian clinical documentation is actually written in — a
 * scribe that could not emit English would be unusable — but it is flagged
 * `eighthSchedule: false` so a count of the constitutional languages stays
 * correct.
 */
export const INDIA_LANGUAGES: readonly IndiaLanguage[] = [
  L("as", "Assamese", "অসমীয়া", "Beng", "as-IN"),
  L("bn", "Bengali", "বাংলা", "Beng", "bn-IN"),
  L("brx", "Bodo", "बड़ो", "Deva", "brx-IN"),
  L("doi", "Dogri", "डोगरी", "Deva", "doi-IN"),
  L("gu", "Gujarati", "ગુજરાતી", "Gujr", "gu-IN"),
  L("hi", "Hindi", "हिन्दी", "Deva", "hi-IN"),
  L("kn", "Kannada", "ಕನ್ನಡ", "Knda", "kn-IN"),
  L("ks", "Kashmiri", "کٲشُر", "Arab", "ks-IN", {
    direction: "rtl",
    alternateScripts: ["Deva"],
  }),
  L("kok", "Konkani", "कोंकणी", "Deva", "kok-IN"),
  L("mai", "Maithili", "मैथिली", "Deva", "mai-IN"),
  L("ml", "Malayalam", "മലയാളം", "Mlym", "ml-IN"),
  L("mni", "Manipuri", "ꯃꯤꯇꯩꯂꯣꯟ", "Mtei", "mni-IN", { alternateScripts: ["Beng"] }),
  L("mr", "Marathi", "मराठी", "Deva", "mr-IN"),
  L("ne", "Nepali", "नेपाली", "Deva", "ne-IN"),
  L("or", "Odia", "ଓଡ଼ିଆ", "Orya", "or-IN"),
  L("pa", "Punjabi", "ਪੰਜਾਬੀ", "Guru", "pa-Guru-IN"),
  L("sa", "Sanskrit", "संस्कृतम्", "Deva", "sa-IN"),
  L("sat", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ", "Olck", "sat-IN"),
  L("sd", "Sindhi", "سنڌي", "Arab", "sd-IN", {
    direction: "rtl",
    alternateScripts: ["Deva"],
  }),
  L("ta", "Tamil", "தமிழ்", "Taml", "ta-IN"),
  L("te", "Telugu", "తెలుగు", "Telu", "te-IN"),
  L("ur", "Urdu", "اردو", "Arab", "ur-IN", { direction: "rtl" }),
  L("en", "English", "English", "Latn", "en-IN", { eighthSchedule: false }),
];

const BY_CODE = new Map(INDIA_LANGUAGES.map((l) => [l.code, l]));

/** Null for an unknown code. Callers must decide what to do; never defaults. */
export function indiaLanguage(code: string): IndiaLanguage | null {
  return BY_CODE.get(code) ?? null;
}

/** The 22 constitutional languages, excluding English. */
export const EIGHTH_SCHEDULE_LANGUAGES: readonly IndiaLanguage[] =
  INDIA_LANGUAGES.filter((l) => l.eighthSchedule);

/** Every code this registry knows, including English. */
export const INDIA_LANGUAGE_CODES: readonly string[] = INDIA_LANGUAGES.map((l) => l.code);

/**
 * Language pairs a deployment should expect to hear together in one
 * consultation.
 *
 * Every pair here is with English, which is not an accident of listing: the
 * mixing that breaks clinical transcription is overwhelmingly the substitution
 * of English clinical nouns — drug names, investigations, anatomy — into an
 * Indian-language matrix. A recogniser told only "Hindi" will render
 * "metformin" as a Hindi-sounding non-word, and the medication list built from
 * that transcript will be wrong in the one place it matters.
 *
 * This is a list of what to expect, not a claim that any provider handles it.
 * `language-support.ts` decides whether a session may declare a mix.
 */
export const COMMON_CODE_MIXES: readonly (readonly [string, string])[] = [
  ["hi", "en"],
  ["bn", "en"],
  ["ta", "en"],
  ["te", "en"],
  ["mr", "en"],
  ["gu", "en"],
  ["kn", "en"],
  ["ml", "en"],
  ["pa", "en"],
  ["or", "en"],
  ["as", "en"],
  ["ur", "en"],
];

/** True when the two codes are a documented code-mixing pair, in either order. */
export function isKnownCodeMix(a: string, b: string): boolean {
  return COMMON_CODE_MIXES.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/**
 * Direction for a run of text in this language.
 *
 * Exposed separately because a note rendered for a Kashmiri, Sindhi or Urdu
 * reader mixes right-to-left prose with left-to-right dose numerals, and the
 * renderer needs the base direction to isolate those runs correctly.
 */
export function textDirection(code: string): TextDirection | null {
  return BY_CODE.get(code)?.direction ?? null;
}
