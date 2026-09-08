/**
 * Language registry for patient messaging.
 *
 * Two separate questions, deliberately kept apart:
 *
 *   1. **What may a DPDP consent notice be presented in?** India answers this
 *      by statute: English or any of the 22 languages in the Eighth Schedule
 *      to the Constitution. That list is fixed by law, not by what this
 *      system happens to have translated.
 *
 *   2. **What has actually been translated here?** A much shorter list.
 *
 * Conflating them is the failure worth preventing. A system that offers 22
 * language choices and silently serves English for 14 of them has not met the
 * notice requirement — it has produced a dropdown. So the registry reports
 * both, and every render says which language the patient actually received.
 */

/**
 * The 22 languages of the Eighth Schedule, with ISO 639-1/639-3 codes.
 *
 * Santali and Bodo have no ISO 639-1 two-letter code; their 639-3 codes are
 * used, which is why the field is not typed as a two-letter string.
 */
export const EIGHTH_SCHEDULE_LANGUAGES: readonly {
  code: string;
  name: string;
  nativeName: string;
}[] = [
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "brx", name: "Bodo", nativeName: "बड़ो" },
  { code: "doi", name: "Dogri", nativeName: "डोगरी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ks", name: "Kashmiri", nativeName: "کٲشُر" },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mni", name: "Manipuri", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
];

const EIGHTH_SCHEDULE_CODES: ReadonlySet<string> = new Set(
  EIGHTH_SCHEDULE_LANGUAGES.map((l) => l.code),
);

/** Right-to-left scripts, for anything that renders these strings. */
export const RTL_LANGUAGES: ReadonlySet<string> = new Set(["ur", "ks", "sd", "ar", "fa", "he"]);

/**
 * Whether a DPDP consent notice may lawfully be served in this language.
 * English is permitted alongside the Eighth Schedule list.
 */
export function isValidNoticeLanguageIN(code: string): boolean {
  const base = code.split("-")[0];
  return base === "en" || EIGHTH_SCHEDULE_CODES.has(base) || EIGHTH_SCHEDULE_CODES.has(code);
}

export function isRtl(code: string): boolean {
  return RTL_LANGUAGES.has(code.split("-")[0]);
}
