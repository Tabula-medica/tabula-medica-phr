/**
 * Locale-aware formatters for dates, numbers, currencies, and units.
 *
 * Why a wrapper instead of calling Intl directly everywhere:
 *   1. Our app's `language` value (e.g. "zh", "ar", "ur") is not always a
 *      valid BCP-47 tag on its own. Some need region tags (zh-CN, pt-BR).
 *      `toBcp47()` normalizes.
 *   2. Medication doses, lab values, and dates are high-risk areas. A bug
 *      that flips "1,500 mg" to "1.500 mg" (European decimal) is a patient
 *      safety issue. Centralize the formatting so the rule is enforced.
 *   3. Numerals: Arabic and Persian users often expect Western digits in
 *      medical contexts (drug doses), not Eastern Arabic digits, even
 *      though their UI is in Arabic/Farsi. We force `numberingSystem: latn`
 *      for any value tagged as `medical: true`.
 */

const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  es: "es",
  zh: "zh-CN",
  hi: "hi-IN",
  ar: "ar",
  pt: "pt-BR",
  bn: "bn-IN",
  ru: "ru-RU",
  ja: "ja-JP",
  pa: "pa-IN",
  de: "de-DE",
  ko: "ko-KR",
  fr: "fr-FR",
  vi: "vi-VN",
  tl: "tl-PH",
  it: "it-IT",
  fa: "fa-IR",
  te: "te-IN",
  ne: "ne-NP",
  ur: "ur-PK",
  he: "he-IL",
  ps: "ps-AF",
};

export function toBcp47(language: string): string {
  return LOCALE_TO_BCP47[language] || language || "en-US";
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  /** Force Western digits for medical/clinical contexts. */
  medical?: boolean;
}

export function formatDate(
  value: Date | string | number,
  language: string,
  options: DateFormatOptions = { dateStyle: "medium" },
): string {
  const { medical, ...intlOpts } = options;
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const opts: Intl.DateTimeFormatOptions = { ...intlOpts };
  if (medical) {
    (opts as any).numberingSystem = "latn";
  }
  return new Intl.DateTimeFormat(toBcp47(language), opts).format(date);
}

export function formatDateTime(
  value: Date | string | number,
  language: string,
  options: DateFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return formatDate(value, language, options);
}

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  /** Force Western digits — required for medication doses, lab values. */
  medical?: boolean;
}

export function formatNumber(
  value: number,
  language: string,
  options: NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "";
  const { medical, ...intlOpts } = options;
  const opts: Intl.NumberFormatOptions = { ...intlOpts };
  if (medical) {
    (opts as any).numberingSystem = "latn";
  }
  return new Intl.NumberFormat(toBcp47(language), opts).format(value);
}

/**
 * Medication dose formatter — ALWAYS uses Western digits and the user's
 * locale's decimal separator stripped of grouping that could be confused
 * with a decimal point. Use for any drug/lab value.
 *
 * Examples (en):  1500     -> "1500"
 *                 1.5      -> "1.5"
 * Examples (de):  1500     -> "1500"   (no thousands sep, avoids "1.500" ambiguity)
 *                 1.5      -> "1,5"    (German comma is fine; only grouping is risky)
 */
export function formatDose(
  value: number,
  language: string,
  fractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return "";
  return formatNumber(value, language, {
    medical: true,
    useGrouping: false,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCurrency(
  value: number,
  language: string,
  currency = "USD",
): string {
  return formatNumber(value, language, { style: "currency", currency });
}

/**
 * Relative time, e.g. "in 3 days", "2 hours ago".
 */
export function formatRelativeTime(
  value: Date | string | number,
  language: string,
): string {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(toBcp47(language), { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
    ["second", 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === "second") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "second");
}
