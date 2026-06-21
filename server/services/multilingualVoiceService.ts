import OpenAI from "openai";
import { Buffer } from "node:buffer";
import { speechToText, textToSpeech, openai } from "../replit_integrations/audio/client";
import { logPhiAccess } from "../security/hipaa-audit";

const PROHIBITED_TERMS = [
  "recommend", "recommends", "recommended", "recommendation", "recommendations",
  "suggest", "suggests", "suggested", "suggestion", "suggestions",
  "advise", "advises", "advised", "advice",
  "should", "must", "need to", "have to", "ought to",
  "prescribe", "prescribes", "prescribed", "prescription",
  "diagnose", "diagnoses", "diagnosed", "diagnosis",
  "treat", "treats", "treated", "treatment", "treatments",
  "cure", "cures", "cured",
  "prevent", "prevents", "prevented", "prevention",
  "cause", "causes", "caused", "causing",
  "indicate", "indicates", "indicated", "indication",
  "predict", "predicts", "predicted", "prediction",
  "determine", "determines", "determined",
  "confirm", "confirms", "confirmed",
  "rule out", "rules out", "ruled out",
  "likely", "unlikely", "probably", "possibly",
  "worsen", "worsens", "worsened", "worsening",
  "improve", "improves", "improved", "improving",
  "better", "worse", "best", "worst",
];

function ensureSafeContent(text: string): string {
  let safe = text;
  for (const term of PROHIBITED_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    safe = safe.replace(regex, "shows");
  }
  return safe;
}

const SUPPORTED_LANGUAGES: Record<string, { name: string; locale: string; voiceHint: string }> = {
  en: { name: "English", locale: "en-US", voiceHint: "English" },
  es: { name: "Spanish", locale: "es-ES", voiceHint: "Spanish" },
  fr: { name: "French", locale: "fr-FR", voiceHint: "French" },
  de: { name: "German", locale: "de-DE", voiceHint: "German" },
  it: { name: "Italian", locale: "it-IT", voiceHint: "Italian" },
  pt: { name: "Portuguese", locale: "pt-BR", voiceHint: "Portuguese" },
  zh: { name: "Chinese", locale: "zh-CN", voiceHint: "Mandarin Chinese" },
  ja: { name: "Japanese", locale: "ja-JP", voiceHint: "Japanese" },
  ko: { name: "Korean", locale: "ko-KR", voiceHint: "Korean" },
  ar: { name: "Arabic", locale: "ar-SA", voiceHint: "Arabic" },
  hi: { name: "Hindi", locale: "hi-IN", voiceHint: "Hindi" },
  ru: { name: "Russian", locale: "ru-RU", voiceHint: "Russian" },
  nl: { name: "Dutch", locale: "nl-NL", voiceHint: "Dutch" },
  pl: { name: "Polish", locale: "pl-PL", voiceHint: "Polish" },
  tr: { name: "Turkish", locale: "tr-TR", voiceHint: "Turkish" },
  vi: { name: "Vietnamese", locale: "vi-VN", voiceHint: "Vietnamese" },
  th: { name: "Thai", locale: "th-TH", voiceHint: "Thai" },
  id: { name: "Indonesian", locale: "id-ID", voiceHint: "Indonesian" },
  uk: { name: "Ukrainian", locale: "uk-UA", voiceHint: "Ukrainian" },
  cs: { name: "Czech", locale: "cs-CZ", voiceHint: "Czech" },
  sv: { name: "Swedish", locale: "sv-SE", voiceHint: "Swedish" },
  da: { name: "Danish", locale: "da-DK", voiceHint: "Danish" },
  fi: { name: "Finnish", locale: "fi-FI", voiceHint: "Finnish" },
  no: { name: "Norwegian", locale: "nb-NO", voiceHint: "Norwegian" },
  el: { name: "Greek", locale: "el-GR", voiceHint: "Greek" },
  he: { name: "Hebrew", locale: "he-IL", voiceHint: "Hebrew" },
  hu: { name: "Hungarian", locale: "hu-HU", voiceHint: "Hungarian" },
  ro: { name: "Romanian", locale: "ro-RO", voiceHint: "Romanian" },
  sk: { name: "Slovak", locale: "sk-SK", voiceHint: "Slovak" },
  bg: { name: "Bulgarian", locale: "bg-BG", voiceHint: "Bulgarian" },
  hr: { name: "Croatian", locale: "hr-HR", voiceHint: "Croatian" },
  sl: { name: "Slovenian", locale: "sl-SI", voiceHint: "Slovenian" },
  lt: { name: "Lithuanian", locale: "lt-LT", voiceHint: "Lithuanian" },
  lv: { name: "Latvian", locale: "lv-LV", voiceHint: "Latvian" },
  et: { name: "Estonian", locale: "et-EE", voiceHint: "Estonian" },
  ms: { name: "Malay", locale: "ms-MY", voiceHint: "Malay" },
  tl: { name: "Filipino", locale: "fil-PH", voiceHint: "Filipino/Tagalog" },
  sw: { name: "Swahili", locale: "sw-KE", voiceHint: "Swahili" },
  af: { name: "Afrikaans", locale: "af-ZA", voiceHint: "Afrikaans" },
  bn: { name: "Bengali", locale: "bn-BD", voiceHint: "Bengali" },
  ta: { name: "Tamil", locale: "ta-IN", voiceHint: "Tamil" },
  te: { name: "Telugu", locale: "te-IN", voiceHint: "Telugu" },
  mr: { name: "Marathi", locale: "mr-IN", voiceHint: "Marathi" },
  gu: { name: "Gujarati", locale: "gu-IN", voiceHint: "Gujarati" },
  kn: { name: "Kannada", locale: "kn-IN", voiceHint: "Kannada" },
  ml: { name: "Malayalam", locale: "ml-IN", voiceHint: "Malayalam" },
  pa: { name: "Punjabi", locale: "pa-IN", voiceHint: "Punjabi" },
  fa: { name: "Persian", locale: "fa-IR", voiceHint: "Persian/Farsi" },
  ur: { name: "Urdu", locale: "ur-PK", voiceHint: "Urdu" },
  ne: { name: "Nepali", locale: "ne-NP", voiceHint: "Nepali" },
};

export interface VoiceAccessRequest {
  audio: string;
  format?: "webm" | "wav" | "mp3";
  inputLanguage?: string;
  outputLanguage?: string;
  userId?: string;
  context?: string;
}

export interface VoiceAccessResponse {
  inputTranscript: string;
  detectedLanguage: string;
  outputText: string;
  outputLanguage: string;
  audioResponse?: string;
  navigationRoute?: string;
  commandType: "navigate" | "explain" | "read" | "translate" | "general";
}

export interface TranscriptionResult {
  text: string;
  detectedLanguage?: string;
}

async function detectLanguage(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: "You are a language detection system. Analyze the text and return ONLY the ISO 639-1 two-letter language code (e.g., 'en', 'es', 'zh', 'ja'). Return only the code, nothing else."
        },
        { role: "user", content: text }
      ],
      max_completion_tokens: 10,
    });
    const code = response.choices[0]?.message?.content?.trim().toLowerCase().slice(0, 2) || "en";
    return SUPPORTED_LANGUAGES[code] ? code : "en";
  } catch {
    return "en";
  }
}

export async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  if (fromLang === toLang) return ensureSafeContent(text);
  
  const fromName = SUPPORTED_LANGUAGES[fromLang]?.name || "English";
  const toName = SUPPORTED_LANGUAGES[toLang]?.name || "English";
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a professional medical translator. Translate the following text from ${fromName} to ${toName}. 
Maintain medical accuracy and use appropriate medical terminology in the target language.
IMPORTANT: Use only these safe verbs: "shows", "states", "refers to", "means". Never use prescriptive language like "should", "recommend", "suggest", "advise".
Return only the translation, nothing else.`
        },
        { role: "user", content: text }
      ],
      max_completion_tokens: 1024,
    });
    return ensureSafeContent(response.choices[0]?.message?.content?.trim() || text);
  } catch {
    return ensureSafeContent(text);
  }
}

function parseVoiceCommand(transcript: string): { type: "navigate" | "explain" | "read" | "translate" | "general"; target?: string; route?: string } {
  const lower = transcript.toLowerCase();
  
  if (lower.includes("timeline") || lower.includes("events") || lower.includes("history") || 
      lower.includes("línea de tiempo") || lower.includes("历史") || lower.includes("タイムライン")) {
    return { type: "navigate", target: "timeline", route: "/timeline" };
  }
  if (lower.includes("medication") || lower.includes("medicine") || lower.includes("medicamento") || 
      lower.includes("药物") || lower.includes("薬")) {
    return { type: "navigate", target: "medications", route: "/medications" };
  }
  if (lower.includes("document") || lower.includes("report") || lower.includes("documento") || 
      lower.includes("文档") || lower.includes("ドキュメント")) {
    return { type: "navigate", target: "documents", route: "/documents" };
  }
  if (lower.includes("condition") || lower.includes("diagnos") || lower.includes("condición") || 
      lower.includes("诊断") || lower.includes("診断")) {
    return { type: "navigate", target: "conditions", route: "/conditions" };
  }
  if (lower.includes("translate") || lower.includes("traducir") || lower.includes("翻译") || lower.includes("翻訳")) {
    return { type: "translate" };
  }
  if (lower.includes("what is") || lower.includes("explain") || lower.includes("qué es") || 
      lower.includes("什么是") || lower.includes("とは")) {
    return { type: "explain" };
  }
  if (lower.includes("read") || lower.includes("list") || lower.includes("leer") || 
      lower.includes("读取") || lower.includes("読む")) {
    return { type: "read" };
  }
  
  return { type: "general" };
}

const HEALTH_ASSISTANT_PROMPT = `You are a multilingual health assistant for Tabula Medica, a patient health records app.
You help patients understand their health information and navigate the app.

Key behaviors:
- Respond in the same language as the user's input
- Explain medical terms in plain, simple language
- Be empathetic and supportive
- Never provide medical advice or diagnoses
- Direct patients to their healthcare providers for medical concerns
- Keep responses concise for voice (2-3 sentences max)

You can help with:
- Navigation: timeline, medications, documents, conditions, appointments
- Explanations of medical terms and conditions
- Reading health data summaries
- Translating medical documents`;

export async function processVoiceAccess(request: VoiceAccessRequest): Promise<VoiceAccessResponse> {
  const { 
    audio, 
    format = "webm", 
    inputLanguage, 
    outputLanguage,
    userId = "patient-default",
    context 
  } = request;
  
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "voice_access",
    resourceId: "multilingual_voice_command",
    details: { inputLanguage, outputLanguage, hasContext: !!context },
    timestamp: new Date().toISOString(),
  });
  
  const audioBuffer = Buffer.from(audio, "base64");
  
  const inputTranscript = await speechToText(audioBuffer, format);
  
  const detectedLanguage = inputLanguage || await detectLanguage(inputTranscript);
  const targetLanguage = outputLanguage || detectedLanguage;
  
  const command = parseVoiceCommand(inputTranscript);
  
  let outputText = "";
  let navigationRoute: string | undefined;
  
  if (command.type === "navigate" && command.route) {
    navigationRoute = command.route;
    const navMessage = `Taking you to ${command.target}.`;
    outputText = targetLanguage !== "en" ? await translateText(navMessage, "en", targetLanguage) : navMessage;
  } else {
    const systemPrompt = targetLanguage !== "en"
      ? `${HEALTH_ASSISTANT_PROMPT}\n\nIMPORTANT: Respond in ${SUPPORTED_LANGUAGES[targetLanguage]?.name || "the user's language"}.`
      : HEALTH_ASSISTANT_PROMPT;
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        ...(context ? [{ role: "user" as const, content: `Context: ${context}` }] : []),
        { role: "user", content: inputTranscript }
      ],
      max_completion_tokens: 300,
    });
    
    outputText = ensureSafeContent(response.choices[0]?.message?.content?.trim() || 
      (targetLanguage === "en" ? "I'm sorry, I didn't understand that." : ""));
  }
  
  outputText = ensureSafeContent(outputText);
  
  let audioResponse: string | undefined;
  try {
    const audioBuffer = await textToSpeech(outputText, "alloy", "mp3");
    audioResponse = audioBuffer.toString("base64");
  } catch (error) {
    console.error("TTS failed:", error);
  }
  
  return {
    inputTranscript,
    detectedLanguage,
    outputText,
    outputLanguage: targetLanguage,
    audioResponse,
    navigationRoute,
    commandType: command.type,
  };
}

export async function transcribeWithLanguageDetection(
  audio: string,
  format: "webm" | "wav" | "mp3" = "webm"
): Promise<TranscriptionResult> {
  const audioBuffer = Buffer.from(audio, "base64");
  const text = await speechToText(audioBuffer, format);
  const detectedLanguage = await detectLanguage(text);
  
  return { text, detectedLanguage };
}

export async function synthesizeSpeech(
  text: string,
  language: string = "en",
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<string> {
  const audioBuffer = await textToSpeech(text, voice, "mp3");
  return audioBuffer.toString("base64");
}

export function getSupportedLanguages() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
    code,
    name: info.name,
    locale: info.locale,
  }));
}

export { SUPPORTED_LANGUAGES, detectLanguage, ensureSafeContent };
