import { chatComplete } from "./ai-client";
import { logger } from "./utils/logger";

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Chinese (Simplified)",
  ar: "Arabic",
  pt: "Portuguese",
  vi: "Vietnamese",
  ko: "Korean",
  hi: "Hindi",
  pa: "Punjabi",
  ru: "Russian",
  ja: "Japanese",
  de: "German",
  bn: "Bengali",
  tr: "Turkish",
  it: "Italian",
  th: "Thai",
  ur: "Urdu",
  id: "Indonesian",
  tl: "Filipino",
  sw: "Swahili",
  ta: "Tamil",
  mr: "Marathi",
  fa: "Farsi (Persian)",
  te: "Telugu",
  ne: "Nepali",
};

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: "medical" | "general" | "clinical";
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  medicalTermsPreserved: string[];
}

export interface ConversationMessage {
  role: "patient" | "provider";
  text: string;
  language: string;
  timestamp?: string;
}

export interface ConversationTranslationResult {
  messages: Array<{
    originalText: string;
    translatedText: string;
    role: string;
    sourceLanguage: string;
    targetLanguage: string;
  }>;
}

export async function translateText(
  request: TranslationRequest
): Promise<TranslationResult> {
  const sourceLang = SUPPORTED_LANGUAGES[request.sourceLanguage];
  const targetLang = SUPPORTED_LANGUAGES[request.targetLanguage];

  if (!sourceLang || !targetLang) {
    throw new Error(
      `Unsupported language pair: ${request.sourceLanguage} -> ${request.targetLanguage}`
    );
  }

  const contextInstruction =
    request.context === "medical" || request.context === "clinical"
      ? "This is a medical/clinical conversation. Preserve medical terminology accurately. When translating medical terms, keep the clinical meaning precise. Include the original medical term in parentheses if the target language doesn't have a direct equivalent."
      : "This is a general conversation.";

  try {
    const response = await chatComplete({
      model: "fast",
      messages: [
        {
          role: "system",
          content: `You are a professional medical translator. ${contextInstruction}

Translate the following text from ${sourceLang} to ${targetLang}.
Respond with ONLY a JSON object in this exact format:
{
  "translatedText": "the translation here",
  "medicalTermsPreserved": ["list", "of", "medical", "terms", "found"],
  "confidence": 0.95
}

Rules:
- Maintain the original tone and formality level
- Preserve medical terminology accurately
- For medical terms without direct equivalents, transliterate and add the English term in parentheses
- Confidence should be 0.0-1.0 based on translation quality
- Do not add any explanation outside the JSON`,
        },
        { role: "user", content: request.text },
      ],
      temperature: 0.1,
      jsonMode: true,
      dataCategories: ["clinical_notes"],
      purpose: "communication",
      callerService: "translation-service",
      callerMethod: "translateText",
    });

    const content = response.content;
    if (!content) {
      throw new Error("Empty response from translation API");
    }

    const parsed = JSON.parse(content);

    logger.info("Translation completed", {
      category: "api",
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      textLength: request.text.length,
      confidence: parsed.confidence,
    });

    return {
      translatedText: parsed.translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: parsed.confidence || 0.9,
      medicalTermsPreserved: parsed.medicalTermsPreserved || [],
    };
  } catch (error) {
    logger.error("Translation failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    });
    throw error;
  }
}

export async function translateConversation(
  messages: ConversationMessage[],
  targetLanguage: string
): Promise<ConversationTranslationResult> {
  const targetLang = SUPPORTED_LANGUAGES[targetLanguage];
  if (!targetLang) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }

  const results: ConversationTranslationResult["messages"] = [];

  for (const msg of messages) {
    if (msg.language === targetLanguage) {
      results.push({
        originalText: msg.text,
        translatedText: msg.text,
        role: msg.role,
        sourceLanguage: msg.language,
        targetLanguage,
      });
      continue;
    }

    const translation = await translateText({
      text: msg.text,
      sourceLanguage: msg.language,
      targetLanguage,
      context: "medical",
    });

    results.push({
      originalText: msg.text,
      translatedText: translation.translatedText,
      role: msg.role,
      sourceLanguage: msg.language,
      targetLanguage,
    });
  }

  logger.info("Conversation translation completed", {
    category: "api",
    messageCount: messages.length,
    targetLanguage,
  });

  return { messages: results };
}

export async function detectLanguage(text: string): Promise<string> {
  try {
    const response = await chatComplete({
      model: "fast",
      messages: [
        {
          role: "system",
          content: `Detect the language of the following text. Respond with ONLY a JSON object: {"languageCode": "xx", "languageName": "Language Name", "confidence": 0.95}
Use ISO 639-1 codes. Supported codes: ${Object.keys(SUPPORTED_LANGUAGES).join(", ")}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      jsonMode: true,
      dataCategories: [],
      purpose: "communication",
      callerService: "translation-service",
      callerMethod: "detectLanguage",
    });

    const content = response.content;
    if (!content) return "en";

    const parsed = JSON.parse(content);
    return parsed.languageCode || "en";
  } catch (error) {
    logger.error("Language detection failed", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    return "en";
  }
}

export function getSupportedLanguages(): Array<{
  code: string;
  name: string;
}> {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name,
  }));
}
