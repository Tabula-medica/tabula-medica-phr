import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export const SUPPORTED_LANGUAGES = {
  tier1: [
    { code: "es", name: "Spanish", nativeName: "Español" },
    { code: "zh-CN", name: "Mandarin (Simplified)", nativeName: "简体中文" },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
    { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
    { code: "fr", name: "French", nativeName: "Français" },
  ],
  tier2: [
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "ko", name: "Korean", nativeName: "한국어" },
    { code: "pt", name: "Portuguese", nativeName: "Português" },
    { code: "ru", name: "Russian", nativeName: "Русский" },
    { code: "tl", name: "Tagalog", nativeName: "Tagalog" },
  ],
};

export const LOCALIZED_DISCLAIMERS: Record<string, string> = {
  en: "Informational only. Not medical advice. Confirm with your clinician.",
  es: "Solo informativo. No es consejo médico. Confirme con su médico.",
  "zh-CN": "仅供参考。非医疗建议。请与您的医生确认。",
  vi: "Chỉ mang tính thông tin. Không phải lời khuyên y tế. Xác nhận với bác sĩ của bạn.",
  ar: "معلومات فقط. ليست نصيحة طبية. تأكد من طبيبك.",
  fr: "À titre informatif seulement. Pas un avis médical. Confirmez avec votre clinicien.",
  hi: "केवल सूचनात्मक। चिकित्सा सलाह नहीं। अपने चिकित्सक से पुष्टि करें।",
  ko: "정보 제공용입니다. 의료 조언이 아닙니다. 담당 의사와 확인하세요.",
  pt: "Apenas informativo. Não é aconselhamento médico. Confirme com seu médico.",
  ru: "Только для информации. Не является медицинской консультацией. Подтвердите у врача.",
  tl: "Impormasyon lamang. Hindi medikal na payo. Kumpirmahin sa iyong doktor.",
};

export const VERIFY_WITH_CLINICIAN: Record<string, string> = {
  en: "Verify with your clinician",
  es: "Verifique con su médico",
  "zh-CN": "请与您的医生核实",
  vi: "Xác minh với bác sĩ của bạn",
  ar: "تحقق من طبيبك",
  fr: "Vérifiez avec votre clinicien",
  hi: "अपने चिकित्सक से सत्यापित करें",
  ko: "담당 의사와 확인하세요",
  pt: "Verifique com seu médico",
  ru: "Подтвердите у врача",
  tl: "Kumpirmahin sa iyong doktor",
};

export const RECORD_EXPLAINER_SYSTEM_PROMPT = `You are Tabula Medica's "Record Explainer." You must follow these rules:

1. Provide informational summaries only. No medical advice.

2. Do not diagnose, predict, triage, recommend treatments, recommend tests, or provide urgency instructions.

3. Use quote-first grounding: prefer verbatim snippets from the user's record text when available; cite provenance for each quote.

4. If information is missing or unclear, say so. Do not guess.

5. Preserve clinical terms, medication names, and units. Do not translate proper nouns, drug names, or codes (LOINC/SNOMED/ICD).

6. Output must match the requested language exactly.

7. Always include the localized disclaimer at the end.

PROHIBITED OUTPUT:
Do not use phrases like: "you should", "you need to", "go to the ER", "urgent", "this indicates you have", "likely", "treatment", "start/stop/take", "get an MRI/CT/colonoscopy", "overdue", "safe/unsafe", "interacts with".

If asked for advice, respond:
"I can explain what the record says, but I can't provide medical advice. Consider contacting your clinician."`;

const PROHIBITED_PATTERNS = [
  /you should/i,
  /you need to/i,
  /you must/i,
  /i recommend/i,
  /i suggest/i,
  /i advise/i,
  /go to (the )?er/i,
  /go to (the )?emergency/i,
  /seek immediate/i,
  /call 911/i,
  /this means you (need|have|require)/i,
  /you (need|require) treatment/i,
  /take this medication/i,
  /stop taking/i,
  /start taking/i,
  /increase (your )?dose/i,
  /decrease (your )?dose/i,
  /don't worry/i,
  /nothing to worry/i,
  /this is (serious|urgent|critical)/i,
];

const HIGH_RISK_TERMS = [
  "cancer",
  "carcinoma",
  "malignant",
  "metastatic",
  "tumor",
  "stroke",
  "cerebrovascular",
  "myocardial infarction",
  "heart attack",
  "pulmonary embolism",
  "deep vein thrombosis",
  "sepsis",
  "anaphylaxis",
  "pregnancy complication",
  "ectopic pregnancy",
  "preeclampsia",
  "placenta previa",
  "fetal distress",
  "hiv",
  "aids",
  "hepatitis",
  "terminal",
  "hospice",
  "palliative",
  "end-stage",
  "life-threatening",
  "critical condition",
];

const CLINICAL_TERMS_TO_PRESERVE = [
  /\b[A-Z]\d{2}(\.\d{1,2})?\b/g,
  /\b(mg|mcg|mL|L|g|kg|mmol|μg|IU|units?)\/?(kg|L|mL|day|hr|min)?\b/gi,
  /\b(BID|TID|QID|PRN|PO|IV|IM|SC|SQ|QD|QHS|AC|PC|HS)\b/g,
  /\b(CBC|CMP|BMP|LFT|TSH|HbA1c|PT|INR|PTT|BNP|CRP|ESR|WBC|RBC|Hgb|Hct|PLT|MCV|MCH|MCHC|RDW)\b/g,
  /\b(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|omeprazole|losartan|gabapentin|hydrocodone|sertraline|simvastatin|montelukast|escitalopram|rosuvastatin|bupropion|fluticasone|pantoprazole|duloxetine|prednisone|tamsulosin|meloxicam|carvedilol|trazodone|pravastatin|clopidogrel|albuterol|fluoxetine|furosemide|amoxicillin|azithromycin|levothyroxine|insulin|warfarin|aspirin|ibuprofen|acetaminophen)\b/gi,
];

export interface TranslationGuardrailResult {
  isAllowed: boolean;
  violations: string[];
  sanitizedText?: string;
  containsHighRiskContent: boolean;
  highRiskTermsFound: string[];
  preservedClinicalTerms: string[];
}

export interface SourceGroundedSummary {
  translatedText: string;
  originalText: string;
  sourceDocument: {
    name: string;
    date: string;
    source: string;
    id?: string;
  };
  highlightedSentences: Array<{
    original: string;
    translated: string;
    index: number;
  }>;
  disclaimer: string;
  verifyBanner?: string;
  isHighRisk: boolean;
  targetLanguage: string;
}

export function checkForProhibitedPatterns(text: string): { violations: string[]; sanitizedText: string } {
  const violations: string[] = [];
  let sanitizedText = text;

  for (const pattern of PROHIBITED_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      violations.push(`Prohibited pattern detected: "${matches[0]}"`);
      sanitizedText = sanitizedText.replace(pattern, "[REMOVED - Medical advice not permitted]");
    }
  }

  return { violations, sanitizedText };
}

export function detectHighRiskContent(text: string): { isHighRisk: boolean; termsFound: string[] } {
  const lowerText = text.toLowerCase();
  const termsFound: string[] = [];

  for (const term of HIGH_RISK_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      termsFound.push(term);
    }
  }

  return {
    isHighRisk: termsFound.length > 0,
    termsFound,
  };
}

export function extractClinicalTerms(text: string): string[] {
  const terms: string[] = [];

  for (const pattern of CLINICAL_TERMS_TO_PRESERVE) {
    const matches = text.match(pattern);
    if (matches) {
      terms.push(...matches);
    }
  }

  return [...new Set(terms)];
}

export function validateTranslationContent(text: string): TranslationGuardrailResult {
  const { violations, sanitizedText } = checkForProhibitedPatterns(text);
  const { isHighRisk, termsFound } = detectHighRiskContent(text);
  const preservedClinicalTerms = extractClinicalTerms(text);

  return {
    isAllowed: violations.length === 0,
    violations,
    sanitizedText: violations.length > 0 ? sanitizedText : undefined,
    containsHighRiskContent: isHighRisk,
    highRiskTermsFound: termsFound,
    preservedClinicalTerms,
  };
}

export async function translateWithGuardrails(
  text: string,
  targetLanguage: string,
  sourceDocument: { name: string; date: string; source: string; id?: string }
): Promise<SourceGroundedSummary> {
  const guardrailCheck = validateTranslationContent(text);
  const contentToTranslate = guardrailCheck.sanitizedText || text;
  const clinicalTerms = guardrailCheck.preservedClinicalTerms;

  const languageInfo = [...SUPPORTED_LANGUAGES.tier1, ...SUPPORTED_LANGUAGES.tier2]
    .find(l => l.code === targetLanguage);
  const languageName = languageInfo?.name || targetLanguage;

  let translatedText: string;
  const sentences = contentToTranslate.split(/(?<=[.!?])\s+/);
  const highlightedSentences: Array<{ original: string; translated: string; index: number }> = [];

  try {
    if (!aiEnabled) {
      translatedText = `[${languageName} translation]: ${contentToTranslate}`;
      sentences.forEach((sentence, index) => {
        highlightedSentences.push({
          original: sentence,
          translated: `[${languageName}]: ${sentence}`,
          index,
        });
      });
    } else {
      const clinicalTermsList = clinicalTerms.length > 0
        ? `\n\nIMPORTANT: Preserve these clinical terms exactly as written (do not translate): ${clinicalTerms.join(", ")}`
        : "";

      translatedText = (await generatePhiSafeText({
        system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TARGET LANGUAGE: ${languageName}

SOURCE DOCUMENT: "${sourceDocument.name}" from ${sourceDocument.source} (${sourceDocument.date})

TRANSLATION INSTRUCTIONS:
1. ONLY translate - do not interpret, explain, or add commentary
2. Do NOT provide any medical advice or recommendations
3. Preserve all clinical terms, drug names, lab values, ICD/LOINC/SNOMED codes, and units exactly as written
4. Maintain the same structure and formatting as the original
5. If unsure about a term, keep it in the original language
${clinicalTermsList}

DISCLAIMER TO APPEND:
${LOCALIZED_DISCLAIMERS[targetLanguage] || LOCALIZED_DISCLAIMERS.en}

Return ONLY the translation with the disclaimer appended.`,
        user: contentToTranslate,
        temperature: 0.1,
      })) || contentToTranslate;

      for (let i = 0; i < sentences.length; i++) {
        const sentenceTranslation = await generatePhiSafeText({
          system: `Translate this single sentence to ${languageName}. Preserve clinical terms exactly. Return ONLY the translation.`,
          user: sentences[i],
          temperature: 0.1,
        });

        highlightedSentences.push({
          original: sentences[i],
          translated: sentenceTranslation || sentences[i],
          index: i,
        });
      }
    }
  } catch (error) {
    console.error("[TranslationGuardrail] Translation error:", error);
    translatedText = contentToTranslate;
    sentences.forEach((sentence, index) => {
      highlightedSentences.push({
        original: sentence,
        translated: sentence,
        index,
      });
    });
  }

  const disclaimer = LOCALIZED_DISCLAIMERS[targetLanguage] || LOCALIZED_DISCLAIMERS.en;
  const verifyBanner = guardrailCheck.containsHighRiskContent 
    ? (VERIFY_WITH_CLINICIAN[targetLanguage] || VERIFY_WITH_CLINICIAN.en)
    : undefined;

  return {
    translatedText,
    originalText: text,
    sourceDocument,
    highlightedSentences,
    disclaimer,
    verifyBanner,
    isHighRisk: guardrailCheck.containsHighRiskContent,
    targetLanguage,
  };
}

export async function summarizeWithGuardrails(
  text: string,
  targetLanguage: string,
  sourceDocument: { name: string; date: string; source: string; id?: string }
): Promise<SourceGroundedSummary> {
  const guardrailCheck = validateTranslationContent(text);
  const contentToSummarize = guardrailCheck.sanitizedText || text;
  const clinicalTerms = guardrailCheck.preservedClinicalTerms;

  const languageInfo = [...SUPPORTED_LANGUAGES.tier1, ...SUPPORTED_LANGUAGES.tier2]
    .find(l => l.code === targetLanguage);
  const languageName = languageInfo?.name || targetLanguage;

  let summary: string;
  const sentences = contentToSummarize.split(/(?<=[.!?])\s+/).slice(0, 5);
  const highlightedSentences: Array<{ original: string; translated: string; index: number }> = [];

  try {
    if (!aiEnabled) {
      summary = `[${languageName} summary]: Key points from the document.`;
      sentences.forEach((sentence, index) => {
        highlightedSentences.push({
          original: sentence,
          translated: `[Summarized]: ${sentence.substring(0, 50)}...`,
          index,
        });
      });
    } else {
      const clinicalTermsList = clinicalTerms.length > 0
        ? `\n\nPreserve these clinical terms exactly: ${clinicalTerms.join(", ")}`
        : "";

      summary = (await generatePhiSafeText({
        system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TARGET LANGUAGE: ${languageName}

SOURCE DOCUMENT: "${sourceDocument.name}" from ${sourceDocument.source} (${sourceDocument.date})

ADDITIONAL INSTRUCTIONS:
- Use quote-first grounding: When summarizing, prefer verbatim snippets from the record (e.g., "The record states: '...'")
- Cite provenance: Reference the source document for each fact
- Keep summary concise (2-4 sentences)
- Preserve these clinical terms exactly: ${clinicalTerms.length > 0 ? clinicalTerms.join(", ") : "all medication names, lab values, and codes"}

DISCLAIMER TO APPEND:
${LOCALIZED_DISCLAIMERS[targetLanguage] || LOCALIZED_DISCLAIMERS.en}`,
        user: `Please provide an informational summary of this medical record text:\n\n${contentToSummarize}`,
        temperature: 0.1,
      })) || "Summary unavailable.";

      for (let i = 0; i < Math.min(sentences.length, 5); i++) {
        highlightedSentences.push({
          original: sentences[i],
          translated: `[Key point ${i + 1}]`,
          index: i,
        });
      }
    }
  } catch (error) {
    console.error("[TranslationGuardrail] Summary error:", error);
    summary = "Summary unavailable due to processing error.";
  }

  const disclaimer = LOCALIZED_DISCLAIMERS[targetLanguage] || LOCALIZED_DISCLAIMERS.en;
  const verifyBanner = guardrailCheck.containsHighRiskContent 
    ? (VERIFY_WITH_CLINICIAN[targetLanguage] || VERIFY_WITH_CLINICIAN.en)
    : undefined;

  return {
    translatedText: summary,
    originalText: text,
    sourceDocument,
    highlightedSentences,
    disclaimer,
    verifyBanner,
    isHighRisk: guardrailCheck.containsHighRiskContent,
    targetLanguage,
  };
}

export interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  keyFields: Record<string, string>;
  source: string;
  recordId: string;
}

export interface SourceSnippet {
  text: string;
  source: string;
  date: string;
  recordId: string;
}

export interface TimelineStorySummary {
  language: string;
  time_range: string;
  key_events: string[];
  new_results: string[];
  medications_documented: string[];
  documents_added: string[];
  what_changed: string[];
  quoted_evidence: Array<{
    quote: string;
    source: string;
    date: string;
    record_id: string;
  }>;
  limitations: string[];
  disclaimer: string;
}

export async function generateTimelineStorySummary(
  targetLanguage: string,
  startDate: string,
  endDate: string,
  events: TimelineEvent[],
  sourceSnippets?: SourceSnippet[]
): Promise<TimelineStorySummary> {
  const languageInfo = [...SUPPORTED_LANGUAGES.tier1, ...SUPPORTED_LANGUAGES.tier2]
    .find(l => l.code === targetLanguage);
  const languageName = languageInfo?.name || targetLanguage;
  const disclaimer = LOCALIZED_DISCLAIMERS[targetLanguage] || LOCALIZED_DISCLAIMERS.en;
  const timeRange = `${startDate}–${endDate}`;

  const eventsByType: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    if (!eventsByType[event.type]) {
      eventsByType[event.type] = [];
    }
    eventsByType[event.type].push(event);
  }

  if (!aiEnabled) {
    const keyEvents: string[] = [];
    const newResults: string[] = [];
    const medicationsDocumented: string[] = [];
    const documentsAdded: string[] = [];
    const whatChanged: string[] = [];
    const quotedEvidence: TimelineStorySummary["quoted_evidence"] = [];

    if (eventsByType["appointment"]) {
      eventsByType["appointment"].forEach(e => keyEvents.push(`${e.title} on ${e.date}`));
    }
    if (eventsByType["diagnosis"]) {
      eventsByType["diagnosis"].forEach(e => keyEvents.push(`Diagnosis: ${e.title}`));
    }
    if (eventsByType["procedure"]) {
      eventsByType["procedure"].forEach(e => keyEvents.push(`Procedure: ${e.title}`));
    }
    if (eventsByType["lab"]) {
      eventsByType["lab"].forEach(e => newResults.push(`${e.title} (${e.date})`));
    }
    if (eventsByType["medication"]) {
      eventsByType["medication"].forEach(e => medicationsDocumented.push(e.title));
    }
    if (eventsByType["immunization"]) {
      eventsByType["immunization"].forEach(e => documentsAdded.push(`Immunization record: ${e.title}`));
    }

    if (sourceSnippets && sourceSnippets.length > 0) {
      for (const snippet of sourceSnippets.slice(0, 5)) {
        quotedEvidence.push({
          quote: snippet.text.substring(0, 200) + (snippet.text.length > 200 ? "..." : ""),
          source: snippet.source,
          date: snippet.date,
          record_id: snippet.recordId
        });
      }
    }

    return {
      language: targetLanguage,
      time_range: timeRange,
      key_events: keyEvents.length > 0 ? keyEvents : ["No key events recorded"],
      new_results: newResults.length > 0 ? newResults : ["No new results"],
      medications_documented: medicationsDocumented.length > 0 ? medicationsDocumented : ["No medications documented"],
      documents_added: documentsAdded.length > 0 ? documentsAdded : ["No documents added"],
      what_changed: whatChanged.length > 0 ? whatChanged : ["No significant changes documented"],
      quoted_evidence: quotedEvidence,
      limitations: ["AI summary unavailable; using structured data only"],
      disclaimer
    };
  }

  try {
    const eventsJson = JSON.stringify(events, null, 2);
    const snippetsText = sourceSnippets 
      ? sourceSnippets.map(s => `[${s.source}, ${s.date}, ${s.recordId}]: "${s.text}"`).join("\n")
      : "No source snippets provided";

    const content = await generatePhiSafeText({
      system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TASK: Generate a timeline story summary in ${languageName} for the period ${timeRange}.

REQUIREMENTS:
1. Organize into sections: "key_events", "new_results", "medications_documented", "documents_added", "what_changed"
2. Include up to 5 short quotes maximum; each quote must have provenance (source, date, record_id)
3. Never add interpretations or recommendations
4. Use quote-first grounding: prefer verbatim snippets from records
5. If information is missing or unclear, note it in "limitations"
6. Always end with the disclaimer

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "language": "${targetLanguage}",
  "time_range": "${timeRange}",
  "key_events": ["event 1", "event 2", ...],
  "new_results": ["result 1", "result 2", ...],
  "medications_documented": ["medication 1", ...],
  "documents_added": ["document 1", ...],
  "what_changed": ["change 1", "change 2", ...],
  "quoted_evidence": [
    {"quote": "...", "source": "...", "date": "YYYY-MM-DD", "record_id": "..."}
  ],
  "limitations": ["limitation 1", ...],
  "disclaimer": "${disclaimer}"
}`,
      user: `Generate timeline story summary for ${timeRange}.

EVENTS_JSON:
${eventsJson}

SOURCE_SNIPPETS:
${snippetsText}`,
      temperature: 0.1,
      responseMimeType: "application/json"
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content) as TimelineStorySummary;
    
    parsed.language = targetLanguage;
    parsed.time_range = timeRange;
    parsed.disclaimer = disclaimer;
    
    parsed.key_events = parsed.key_events || [];
    parsed.new_results = parsed.new_results || [];
    parsed.medications_documented = parsed.medications_documented || [];
    parsed.documents_added = parsed.documents_added || [];
    parsed.what_changed = parsed.what_changed || [];
    parsed.limitations = parsed.limitations || [];
    
    if (parsed.quoted_evidence && parsed.quoted_evidence.length > 5) {
      parsed.quoted_evidence = parsed.quoted_evidence.slice(0, 5);
    }

    return parsed;

  } catch (error) {
    console.error("[TimelineStorySummary] Generation error:", error);
    
    return {
      language: targetLanguage,
      time_range: timeRange,
      key_events: [`${events.length} health event(s) recorded during this period`],
      new_results: [],
      medications_documented: [],
      documents_added: [],
      what_changed: ["Summary generation encountered an error"],
      quoted_evidence: sourceSnippets?.slice(0, 5).map(s => ({
        quote: s.text.substring(0, 200),
        source: s.source,
        date: s.date,
        record_id: s.recordId
      })) || [],
      limitations: ["AI summary unavailable due to processing error"],
      disclaimer
    };
  }
}

export function getLocalizedDisclaimer(languageCode: string): string {
  return LOCALIZED_DISCLAIMERS[languageCode] || LOCALIZED_DISCLAIMERS.en;
}

export interface DocumentSummaryInput {
  targetLanguage: string;
  documentType: "discharge_summary" | "clinic_note" | "referral_letter" | "lab_report" | "imaging_report" | "procedure_note";
  documentText: string;
  provenance: {
    sourceSystem: string;
    documentDate: string;
    recordId: string;
  };
}

export interface DocumentSummary {
  language: string;
  document_type: string;
  provenance: {
    source: string;
    date: string;
    record_id: string;
  };
  what_this_is: string;
  key_points: string[];
  medications_mentioned: string[];
  follow_up_items_as_written: string[];
  quoted_evidence: Array<{
    quote: string;
    location_hint?: string;
    source: string;
    date: string;
    record_id: string;
  }>;
  limitations: string[];
  disclaimer: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  discharge_summary: "Discharge Summary",
  clinic_note: "Clinic Note",
  referral_letter: "Referral Letter",
  lab_report: "Lab Report",
  imaging_report: "Imaging Report",
  procedure_note: "Procedure Note"
};

export async function generateDocumentSummary(
  input: DocumentSummaryInput
): Promise<DocumentSummary> {
  const { targetLanguage, documentType, documentText, provenance } = input;
  const disclaimer = getLocalizedDisclaimer(targetLanguage);
  const documentTypeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  if (!aiEnabled) {
    const lines = documentText.split("\n").filter(l => l.trim().length > 0);
    const keyPoints: string[] = [];
    const medications: string[] = [];
    const followUp: string[] = [];
    const quotes: DocumentSummary["quoted_evidence"] = [];

    for (const line of lines.slice(0, 10)) {
      if (line.toLowerCase().includes("medication") || line.toLowerCase().includes("prescribed") || line.toLowerCase().includes("mg")) {
        medications.push(line.trim().substring(0, 100));
      } else if (line.toLowerCase().includes("follow") || line.toLowerCase().includes("appointment") || line.toLowerCase().includes("return")) {
        followUp.push(line.trim().substring(0, 150));
      } else if (line.trim().length > 20) {
        keyPoints.push(line.trim().substring(0, 150));
      }
    }

    for (const line of lines.slice(0, 6)) {
      if (line.trim().length > 10) {
        quotes.push({
          quote: line.trim().substring(0, 200),
          source: provenance.sourceSystem,
          date: provenance.documentDate,
          record_id: provenance.recordId
        });
      }
    }

    return {
      language: targetLanguage,
      document_type: documentTypeLabel,
      provenance: {
        source: provenance.sourceSystem,
        date: provenance.documentDate,
        record_id: provenance.recordId
      },
      what_this_is: `This is a ${documentTypeLabel} from ${provenance.sourceSystem} dated ${provenance.documentDate}.`,
      key_points: keyPoints.length > 0 ? keyPoints : ["Document content available for review"],
      medications_mentioned: medications.length > 0 ? medications : ["No medications explicitly mentioned"],
      follow_up_items_as_written: followUp.length > 0 ? followUp : ["No follow-up items explicitly mentioned"],
      quoted_evidence: quotes,
      limitations: ["AI summary unavailable; using basic text extraction"],
      disclaimer
    };
  }

  try {
    const content = await generatePhiSafeText({
      system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TASK: Summarize the following ${documentTypeLabel} in ${languageName}. Use quote-first grounding and preserve clinical terminology.

REQUIREMENTS:
1. Provide: "what_this_is", "key_points", "medications_mentioned", "follow_up_items_as_written"
2. Quote up to 6 short snippets from the document for grounding
3. Do NOT convert follow-up items into advice; only restate what the document says
4. Preserve medication names, dosages, LOINC/SNOMED/ICD codes exactly as written
5. If information is missing or unclear, note it in "limitations"
6. Always include the disclaimer at the end

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "language": "${targetLanguage}",
  "document_type": "${documentTypeLabel}",
  "provenance": {"source": "${provenance.sourceSystem}", "date": "${provenance.documentDate}", "record_id": "${provenance.recordId}"},
  "what_this_is": "Brief description of what this document is",
  "key_points": ["point 1", "point 2", ...],
  "medications_mentioned": ["med 1 with dosage as written", ...],
  "follow_up_items_as_written": ["follow-up item exactly as stated", ...],
  "quoted_evidence": [
    {"quote": "verbatim text", "location_hint": "section name if known", "source": "${provenance.sourceSystem}", "date": "${provenance.documentDate}", "record_id": "${provenance.recordId}"}
  ],
  "limitations": ["limitation 1", ...],
  "disclaimer": "${disclaimer}"
}`,
      user: `Summarize this ${documentTypeLabel} in ${languageName}.

DOCUMENT TEXT:
${documentText}

PROVENANCE:
Source: ${provenance.sourceSystem}
Date: ${provenance.documentDate}
Record ID: ${provenance.recordId}`,
      maxTokens: 2000,
      temperature: 0.2
    });

    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content) as DocumentSummary;
    
    parsed.language = targetLanguage;
    parsed.document_type = documentTypeLabel;
    parsed.provenance = {
      source: provenance.sourceSystem,
      date: provenance.documentDate,
      record_id: provenance.recordId
    };
    parsed.disclaimer = disclaimer;
    
    parsed.key_points = parsed.key_points || [];
    parsed.medications_mentioned = parsed.medications_mentioned || [];
    parsed.follow_up_items_as_written = parsed.follow_up_items_as_written || [];
    parsed.limitations = parsed.limitations || [];
    
    if (parsed.quoted_evidence && parsed.quoted_evidence.length > 6) {
      parsed.quoted_evidence = parsed.quoted_evidence.slice(0, 6);
    }

    return parsed;

  } catch (error) {
    console.error("[DocumentSummary] Generation error:", error);
    
    return {
      language: targetLanguage,
      document_type: documentTypeLabel,
      provenance: {
        source: provenance.sourceSystem,
        date: provenance.documentDate,
        record_id: provenance.recordId
      },
      what_this_is: `This is a ${documentTypeLabel} from ${provenance.sourceSystem}.`,
      key_points: ["Summary generation encountered an error"],
      medications_mentioned: [],
      follow_up_items_as_written: [],
      quoted_evidence: [],
      limitations: ["AI summary unavailable due to processing error"],
      disclaimer
    };
  }
}

export function getVerifyWithClinicianText(languageCode: string): string {
  return VERIFY_WITH_CLINICIAN[languageCode] || VERIFY_WITH_CLINICIAN.en;
}

export function getAllSupportedLanguages() {
  return {
    tier1: SUPPORTED_LANGUAGES.tier1,
    tier2: SUPPORTED_LANGUAGES.tier2,
    all: [...SUPPORTED_LANGUAGES.tier1, ...SUPPORTED_LANGUAGES.tier2],
  };
}

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  date: string;
  flag?: "High" | "Low" | "Normal" | "Critical" | string;
  source: string;
  record_id: string;
}

export interface LabExplanation {
  test_name: string;
  date: string;
  value: string;
  reference_range: string;
  general_meaning: string;
  as_flagged_in_record: string;
  source: string;
  record_id: string;
}

export interface LabExplanationResult {
  language: string;
  lab_explanations: LabExplanation[];
  questions_to_ask: string[];
  limitations: string[];
  disclaimer: string;
}

const COMMON_LAB_EXPLANATIONS: Record<string, string> = {
  "glucose": "Glucose measures the amount of sugar in your blood. It is commonly used to screen for diabetes.",
  "hemoglobin": "Hemoglobin is a protein in red blood cells that carries oxygen throughout your body.",
  "hematocrit": "Hematocrit measures the proportion of your blood that is made up of red blood cells.",
  "wbc": "White blood cell count measures the number of infection-fighting cells in your blood.",
  "rbc": "Red blood cell count measures the number of cells that carry oxygen in your blood.",
  "platelet": "Platelets are cell fragments that help your blood clot.",
  "creatinine": "Creatinine is a waste product from muscle metabolism. It helps assess kidney function.",
  "bun": "Blood urea nitrogen (BUN) is a waste product filtered by kidneys. It helps assess kidney function.",
  "sodium": "Sodium is an electrolyte that helps regulate water balance and nerve/muscle function.",
  "potassium": "Potassium is an electrolyte important for heart, muscle, and nerve function.",
  "chloride": "Chloride is an electrolyte that helps maintain fluid balance and acid-base balance.",
  "co2": "CO2 (carbon dioxide) is a measure of acid-base balance in your blood.",
  "calcium": "Calcium is important for bone health, muscle function, and nerve signaling.",
  "alt": "ALT (alanine aminotransferase) is a liver enzyme. Elevated levels may indicate liver issues.",
  "ast": "AST (aspartate aminotransferase) is found in liver and heart. Elevated levels may indicate tissue damage.",
  "albumin": "Albumin is a protein made by the liver. It helps assess liver function and nutritional status.",
  "bilirubin": "Bilirubin is a byproduct of red blood cell breakdown. It helps assess liver function.",
  "cholesterol": "Cholesterol is a fat-like substance in your blood used to assess cardiovascular risk.",
  "ldl": "LDL is often called 'bad' cholesterol. Higher levels are associated with cardiovascular risk.",
  "hdl": "HDL is often called 'good' cholesterol. Higher levels are generally considered protective.",
  "triglycerides": "Triglycerides are a type of fat in your blood used to assess cardiovascular risk.",
  "tsh": "TSH (thyroid stimulating hormone) helps assess thyroid function.",
  "hba1c": "HbA1c measures average blood sugar over the past 2-3 months. Used for diabetes monitoring.",
  "psa": "PSA (prostate-specific antigen) is used to screen for prostate conditions.",
  "vitamin d": "Vitamin D is important for bone health and immune function.",
  "iron": "Iron is essential for making hemoglobin and carrying oxygen in red blood cells.",
  "ferritin": "Ferritin measures iron stores in your body."
};

const DEFAULT_QUESTIONS = [
  "Can you help me understand what these results mean?",
  "How do these values compare to my previous results?",
  "Is there anything you would like to discuss about these numbers?",
  "What additional information would help provide context for these results?",
  "Are there any questions I should be asking about this lab work?"
];

export async function explainLabResults(
  targetLanguage: string,
  labs: LabResult[],
  optionalRecordSnippet?: string
): Promise<LabExplanationResult> {
  const disclaimer = getLocalizedDisclaimer(targetLanguage);
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  if (!aiEnabled) {
    const labExplanations: LabExplanation[] = labs.map(lab => {
      const testNameLower = lab.name.toLowerCase();
      let generalMeaning = "This test measures a component of your blood or body function.";
      
      for (const [key, meaning] of Object.entries(COMMON_LAB_EXPLANATIONS)) {
        if (testNameLower.includes(key)) {
          generalMeaning = meaning;
          break;
        }
      }

      return {
        test_name: lab.name,
        date: lab.date,
        value: `${lab.value} ${lab.unit}`,
        reference_range: lab.reference_range,
        general_meaning: generalMeaning,
        as_flagged_in_record: lab.flag || "Not provided",
        source: lab.source,
        record_id: lab.record_id
      };
    });

    return {
      language: targetLanguage,
      lab_explanations: labExplanations,
      questions_to_ask: DEFAULT_QUESTIONS,
      limitations: ["AI explanation unavailable; using basic descriptions"],
      disclaimer
    };
  }

  try {
    const labsJson = JSON.stringify(labs, null, 2);
    
    const content = await generatePhiSafeText({
      system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TASK: Explain the lab result(s) in ${languageName} in plain language. Do NOT recommend actions. Preserve units and reference ranges exactly.

REQUIREMENTS:
1. Explain what each test measures in general terms (educational, not diagnostic)
2. Describe whether it's marked high/low based on the provided flag/reference range (do NOT infer or interpret)
3. Include "questions_to_ask" - neutral, non-directive, open-ended questions that do NOT suggest actions or imply clinical recommendations
4. Preserve exact values, units, and reference ranges from the input
5. Never provide clinical interpretations or recommendations

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "language": "${targetLanguage}",
  "lab_explanations": [
    {
      "test_name": "exact name from input",
      "date": "YYYY-MM-DD",
      "value": "value with unit",
      "reference_range": "exact range from input",
      "general_meaning": "what this test measures in general",
      "as_flagged_in_record": "High/Low/Normal/Not provided (from input flag)",
      "source": "source system",
      "record_id": "record id"
    }
  ],
  "questions_to_ask": ["neutral question 1", "neutral question 2", ...],
  "limitations": ["limitation 1", ...],
  "disclaimer": "${disclaimer}"
}`,
      user: `Explain these lab results in ${languageName}.

LAB RESULTS:
${labsJson}
${optionalRecordSnippet ? `\nADDITIONAL CONTEXT FROM RECORD:\n${optionalRecordSnippet}` : ""}`,
      maxTokens: 2500,
      temperature: 0.2
    });

    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content) as LabExplanationResult;
    
    parsed.language = targetLanguage;
    parsed.disclaimer = disclaimer;
    parsed.lab_explanations = parsed.lab_explanations || [];
    parsed.questions_to_ask = parsed.questions_to_ask || DEFAULT_QUESTIONS;
    parsed.limitations = parsed.limitations || [];

    return parsed;

  } catch (error) {
    console.error("[LabExplanation] Generation error:", error);
    
    const labExplanations: LabExplanation[] = labs.map(lab => ({
      test_name: lab.name,
      date: lab.date,
      value: `${lab.value} ${lab.unit}`,
      reference_range: lab.reference_range,
      general_meaning: "Explanation generation encountered an error",
      as_flagged_in_record: lab.flag || "Not provided",
      source: lab.source,
      record_id: lab.record_id
    }));

    return {
      language: targetLanguage,
      lab_explanations: labExplanations,
      questions_to_ask: DEFAULT_QUESTIONS,
      limitations: ["AI explanation unavailable due to processing error"],
      disclaimer
    };
  }
}

export interface ImagingReportInput {
  modality: string;
  body_part: string;
  report_text: string;
  source_system: string;
  report_date: string;
  record_id: string;
}

export interface ImagingQuotedEvidence {
  quote: string;
  source: string;
  date: string;
  record_id: string;
}

export interface ImagingReportSummary {
  language: string;
  study: {
    modality: string;
    body_part: string;
  };
  provenance: {
    source: string;
    date: string;
    record_id: string;
  };
  impression_as_written: string[];
  key_findings_as_written: string[];
  comparison_as_written: string[];
  quoted_evidence: ImagingQuotedEvidence[];
  limitations: string[];
  disclaimer: string;
}

export async function summarizeImagingReport(
  targetLanguage: string,
  input: ImagingReportInput
): Promise<ImagingReportSummary> {
  const disclaimer = getLocalizedDisclaimer(targetLanguage);
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  const fallbackResult: ImagingReportSummary = {
    language: targetLanguage,
    study: {
      modality: input.modality,
      body_part: input.body_part
    },
    provenance: {
      source: input.source_system,
      date: input.report_date,
      record_id: input.record_id
    },
    impression_as_written: ["Summary generation unavailable"],
    key_findings_as_written: [],
    comparison_as_written: [],
    quoted_evidence: [],
    limitations: ["AI summary unavailable"],
    disclaimer
  };

  if (!aiEnabled) {
    return fallbackResult;
  }

  try {
    const content = await generatePhiSafeText({
      system: `${RECORD_EXPLAINER_SYSTEM_PROMPT}

TASK: Summarize this imaging report in ${languageName}. Emphasize that findings are taken from the report text. Do not interpret beyond the report.

REQUIREMENTS:
1. Extract "Impression (as written)" - quote the full Impression section if short, otherwise quote top 2-4 sentences
2. Extract "Key findings (as written)" - list findings verbatim from the report
3. Extract "Comparison (as written)" - if comparison to prior studies is mentioned
4. Include quoted_evidence with verbatim quotes and full provenance
5. No differential diagnosis beyond what's written
6. No clinical recommendations or interpretations

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "language": "${targetLanguage}",
  "study": {"modality": "${input.modality}", "body_part": "${input.body_part}"},
  "provenance": {"source": "${input.source_system}", "date": "${input.report_date}", "record_id": "${input.record_id}"},
  "impression_as_written": ["verbatim impression text..."],
  "key_findings_as_written": ["finding 1 as written...", "finding 2 as written..."],
  "comparison_as_written": ["comparison text if present..."],
  "quoted_evidence": [{"quote": "verbatim text", "source": "${input.source_system}", "date": "${input.report_date}", "record_id": "${input.record_id}"}],
  "limitations": ["limitation 1", ...],
  "disclaimer": "${disclaimer}"
}`,
      user: `Summarize this imaging report in ${languageName}.

MODALITY: ${input.modality}
BODY PART: ${input.body_part}

REPORT TEXT:
${input.report_text}

PROVENANCE:
Source: ${input.source_system}
Date: ${input.report_date}
Record ID: ${input.record_id}`,
      maxTokens: 2000,
      temperature: 0.2
    });

    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content) as ImagingReportSummary;
    
    parsed.language = targetLanguage;
    parsed.study = {
      modality: input.modality,
      body_part: input.body_part
    };
    parsed.provenance = {
      source: input.source_system,
      date: input.report_date,
      record_id: input.record_id
    };
    parsed.disclaimer = disclaimer;
    
    parsed.impression_as_written = parsed.impression_as_written || [];
    parsed.key_findings_as_written = parsed.key_findings_as_written || [];
    parsed.comparison_as_written = parsed.comparison_as_written || [];
    parsed.quoted_evidence = parsed.quoted_evidence || [];
    parsed.limitations = parsed.limitations || [];

    return parsed;

  } catch (error) {
    console.error("[ImagingReportSummary] Generation error:", error);
    return {
      ...fallbackResult,
      limitations: ["AI summary unavailable due to processing error"]
    };
  }
}

console.log("[TranslationGuardrail] Service initialized with safety guardrails");
