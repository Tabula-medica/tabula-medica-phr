import { openai } from "../replit_integrations/audio/client";
import { logPhiAccess } from "../security/hipaa-audit";
import { SUPPORTED_LANGUAGES, detectLanguage, translateText, ensureSafeContent } from "./multilingualVoiceService";

export interface DocumentTranslationRequest {
  content: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  documentType?: "clinical_note" | "lab_report" | "discharge_summary" | "prescription" | "imaging_report" | "general";
  userId?: string;
}

export interface TranslatedSection {
  originalText: string;
  translatedText: string;
  sectionType?: string;
}

export interface DocumentTranslationResponse {
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  sourceLanguageName: string;
  targetLanguage: string;
  targetLanguageName: string;
  documentType: string;
  sections: TranslatedSection[];
  medicalTermsGlossary: Array<{
    term: string;
    originalTerm: string;
    definition: string;
  }>;
  summary: string;
  confidence: number;
  processingTimeMs: number;
}

const DOCUMENT_TYPE_PROMPTS: Record<string, string> = {
  clinical_note: `This is a clinical note from a healthcare provider. Pay attention to:
- Chief complaint and history of present illness
- Physical examination findings
- Assessment and plan
- Medication lists and dosages`,
  
  lab_report: `This is a laboratory report. Pay attention to:
- Test names and their standardized equivalents
- Reference ranges (convert units if needed)
- Abnormal values and their clinical significance
- Specimen collection details`,
  
  discharge_summary: `This is a hospital discharge summary. Pay attention to:
- Admission and discharge diagnoses
- Hospital course and procedures performed
- Medications at discharge
- Follow-up instructions and appointments`,
  
  prescription: `This is a medical prescription. Pay attention to:
- Medication names (generic and brand names)
- Dosage and frequency
- Route of administration
- Duration and refill information`,
  
  imaging_report: `This is an imaging/radiology report. Pay attention to:
- Imaging modality and technique
- Anatomical findings
- Impression and recommendations
- Comparison with prior studies`,
  
  general: `This is a general medical document. Translate accurately while preserving:
- Medical terminology
- Numerical values and units
- Dates and timelines
- Provider and facility names`,
};

async function extractMedicalTerms(
  originalText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string
): Promise<Array<{ term: string; originalTerm: string; definition: string }>> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a medical terminology expert. Extract key medical terms from the translated text and provide their original forms and brief definitions.

Return a JSON array of objects with:
- term: the translated medical term (in ${SUPPORTED_LANGUAGES[targetLang]?.name || targetLang})
- originalTerm: the original term (in ${SUPPORTED_LANGUAGES[sourceLang]?.name || sourceLang})
- definition: brief plain-language definition (in ${SUPPORTED_LANGUAGES[targetLang]?.name || targetLang})

Return ONLY the JSON array, no other text. Limit to 10 most important terms.`
        },
        {
          role: "user",
          content: `Original text:\n${originalText}\n\nTranslated text:\n${translatedText}`
        }
      ],
      max_completion_tokens: 1000,
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.terms) ? parsed.terms : (Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

async function generateDocumentSummary(
  translatedContent: string,
  documentType: string,
  targetLang: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a medical document summarizer. Provide a brief 2-3 sentence summary of this ${documentType.replace("_", " ")} in ${SUPPORTED_LANGUAGES[targetLang]?.name || "English"}.
          
Use only these safe verbs: "shows", "states", "refers to", "means". Never use medical advice or recommendation language.`
        },
        { role: "user", content: translatedContent }
      ],
      max_completion_tokens: 200,
    });
    
    return ensureSafeContent(response.choices[0]?.message?.content?.trim() || "");
  } catch {
    return "";
  }
}

async function translateDocument(
  content: string,
  sourceLang: string,
  targetLang: string,
  documentType: string
): Promise<string> {
  const docTypePrompt = DOCUMENT_TYPE_PROMPTS[documentType] || DOCUMENT_TYPE_PROMPTS.general;
  const sourceName = SUPPORTED_LANGUAGES[sourceLang]?.name || sourceLang;
  const targetName = SUPPORTED_LANGUAGES[targetLang]?.name || targetLang;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a professional medical document translator specializing in healthcare documentation.

${docTypePrompt}

Translation guidelines:
1. Translate from ${sourceName} to ${targetName}
2. Preserve all medical terminology accurately
3. Keep numerical values, dates, and measurements exactly as written
4. Maintain document structure and formatting
5. Use standardized medical terminology in the target language
6. Do not add interpretations or medical advice
7. Mark any unclear or untranslatable terms with [?]

Return ONLY the translated document, preserving the original structure.`
        },
        { role: "user", content }
      ],
      max_completion_tokens: 4096,
    });
    
    return ensureSafeContent(response.choices[0]?.message?.content?.trim() || content);
  } catch (error) {
    console.error("Translation failed:", error);
    return ensureSafeContent(content);
  }
}

export async function translateMedicalDocument(
  request: DocumentTranslationRequest
): Promise<DocumentTranslationResponse> {
  const startTime = Date.now();
  const {
    content,
    sourceLanguage,
    targetLanguage = "en",
    documentType = "general",
    userId = "patient-default",
  } = request;
  
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "document_translation",
    resourceId: `translation_${Date.now()}`,
    details: { sourceLanguage, targetLanguage, documentType, contentLength: content.length },
    timestamp: new Date().toISOString(),
  });
  
  const detectedSourceLang = sourceLanguage || await detectLanguage(content);
  
  let translatedContent: string;
  if (detectedSourceLang === targetLanguage) {
    translatedContent = ensureSafeContent(content);
  } else {
    translatedContent = await translateDocument(content, detectedSourceLang, targetLanguage, documentType);
  }
  
  const [rawMedicalTermsGlossary, summary] = await Promise.all([
    extractMedicalTerms(content, translatedContent, detectedSourceLang, targetLanguage),
    generateDocumentSummary(translatedContent, documentType, targetLanguage),
  ]);
  
  const medicalTermsGlossary = rawMedicalTermsGlossary.map(term => ({
    term: ensureSafeContent(term.term),
    originalTerm: ensureSafeContent(term.originalTerm),
    definition: ensureSafeContent(term.definition),
  }));
  
  const processingTimeMs = Date.now() - startTime;
  
  const lines = content.split("\n").filter(l => l.trim());
  const translatedLines = translatedContent.split("\n").filter(l => l.trim());
  const sections: TranslatedSection[] = [];
  
  for (let i = 0; i < Math.min(lines.length, translatedLines.length); i++) {
    if (lines[i].trim()) {
      sections.push({
        originalText: lines[i],
        translatedText: translatedLines[i] || lines[i],
      });
    }
  }
  
  return {
    originalContent: content,
    translatedContent,
    sourceLanguage: detectedSourceLang,
    sourceLanguageName: SUPPORTED_LANGUAGES[detectedSourceLang]?.name || detectedSourceLang,
    targetLanguage,
    targetLanguageName: SUPPORTED_LANGUAGES[targetLanguage]?.name || targetLanguage,
    documentType,
    sections,
    medicalTermsGlossary,
    summary,
    confidence: detectedSourceLang === targetLanguage ? 1.0 : 0.95,
    processingTimeMs,
  };
}

export async function detectDocumentLanguage(content: string): Promise<{
  languageCode: string;
  languageName: string;
  confidence: number;
}> {
  const code = await detectLanguage(content);
  return {
    languageCode: code,
    languageName: SUPPORTED_LANGUAGES[code]?.name || code,
    confidence: 0.95,
  };
}

export { SUPPORTED_LANGUAGES };
