/**
 * A clinical string keeps the source text beside any translation.
 * The original is the record. The translation is a reading aid.
 */

export type TranslationEngine = "human" | "cloud-translation" | "vertex";

export interface LangText {
  lang: string;
  text: string;
}

export interface RecordTranslation extends LangText {
  engine: TranslationEngine;
  translatedAt: string;
}

export interface BilingualRecord {
  original: LangText;
  translation: RecordTranslation | null;
}

export function createBilingualRecord(
  original: LangText,
  translation?: RecordTranslation | null,
): BilingualRecord {
  if (!original.lang.trim() || !original.text.trim()) {
    throw new Error("A bilingual record needs the original language and text.");
  }
  if (!translation || translation.lang === original.lang) {
    return { original: { lang: original.lang, text: original.text }, translation: null };
  }
  if (!translation.text.trim()) {
    throw new Error("A translation needs text. Leave it unset to keep the original only.");
  }
  return {
    original: { lang: original.lang, text: original.text },
    translation: { ...translation },
  };
}

export function textForReader(
  record: BilingualRecord,
  preferredLang: string,
): { text: string; lang: string; isTranslation: boolean } {
  if (record.translation && record.translation.lang === preferredLang) {
    return { text: record.translation.text, lang: record.translation.lang, isTranslation: true };
  }
  return { text: record.original.text, lang: record.original.lang, isTranslation: false };
}
