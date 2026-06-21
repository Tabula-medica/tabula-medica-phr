export const SUPPORTED_LANGUAGE_CODES = [
  "en", "es", "zh", "hi", "ar", "pt", "bn", "ru", "ja", "pa",
  "de", "ko", "fr", "vi", "tl", "it", "fa", "te", "ne",
  "ur", "he", "ps",
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en";

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGE_CODES);

export function isSupportedLanguage(code: string | null | undefined): code is SupportedLanguageCode {
  return !!code && SUPPORTED_SET.has(code);
}

export function normalizeLanguageCode(raw: string | null | undefined): SupportedLanguageCode | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  if (SUPPORTED_SET.has(lower)) return lower as SupportedLanguageCode;
  const base = lower.split(/[-_]/)[0];
  if (SUPPORTED_SET.has(base)) return base as SupportedLanguageCode;
  return null;
}

/**
 * Pick the best supported language from an HTTP Accept-Language header.
 * Returns null if no entry matches a supported code.
 */
export function pickLanguageFromAcceptHeader(header: string | null | undefined): SupportedLanguageCode | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q=([0-9.]+)$/i);
        if (m) q = parseFloat(m[1]) || 0;
      }
      return { tag: tag.trim(), q };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const match = normalizeLanguageCode(tag);
    if (match) return match;
  }
  return null;
}
