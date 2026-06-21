import OpenAI from "openai";
import crypto from "crypto";
import type { SupportedLanguage } from "./unified-ai-onboarding-service";
import {
  getConditionTranslation,
  getReportTypeTranslation,
  getUITermTranslation,
  getNoCdsDisclaimer as getEnhancedNoCdsDisclaimer,
  translateMedicalText,
  LANGUAGE_METADATA,
} from "./medical-terminology-translation-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][MultilingualSummary] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

export interface HealthRecordData {
  conditions: Array<{ name: string; status: string; severity: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: Array<{ allergen: string; severity: string; reaction: string }>;
  recentLabResults: Array<{ testName: string; value: string; status: string; date: string }>;
  recentVitals: Array<{ type: string; value: string; date: string }>;
  recentEncounters: Array<{ type: string; provider: string; date: string; summary: string }>;
  immunizations: Array<{ name: string; date: string }>;
}

export interface MultilingualSummary {
  id: string;
  patientId: string;
  summaryType: "full" | "conditions" | "medications" | "labs" | "encounters" | "executive";
  englishSummary: string;
  translatedSummary?: string;
  targetLanguage?: SupportedLanguage;
  plainLanguageSummary: string;
  keyPoints: string[];
  keyPointsTranslated?: string[];
  actionItems: string[];
  actionItemsTranslated?: string[];
  generatedAt: string;
  expiresAt: string;
  noCdsDisclaimer: string;
  noCdsDisclaimerTranslated?: string;
  readingLevel: "simple" | "standard" | "technical";
  voiceReadable: boolean;
  metadata: {
    conditionsCount: number;
    medicationsCount: number;
    allergiesCount: number;
    labsCount: number;
    dataFreshness: string;
    sourcesSummarized: string[];
  };
}

export interface SummaryRequest {
  patientId: string;
  healthData: HealthRecordData;
  primaryLanguage: SupportedLanguage;
  secondaryLanguage?: SupportedLanguage;
  summaryType: MultilingualSummary["summaryType"];
  readingLevel: MultilingualSummary["readingLevel"];
  includeVoiceVersion: boolean;
}

const summaryCache: Map<string, MultilingualSummary> = new Map();

const NO_CDS_DISCLAIMER_EN = "IMPORTANT: This summary is for informational purposes only and is NOT medical advice. It does not replace professional medical consultation. Always consult with your healthcare provider for medical decisions. This system does not make clinical recommendations or diagnoses.";

const NO_CDS_DISCLAIMERS: Record<SupportedLanguage, string> = {
  en: NO_CDS_DISCLAIMER_EN,
  es: "IMPORTANTE: Esta información es solo para fines educativos y NO es consejo médico. No reemplaza la consulta médica profesional. Siempre consulte con su proveedor de atención médica para decisiones médicas.",
  zh: "重要提示：此信息仅供教育目的，不构成医疗建议。它不能取代专业医疗咨询。请始终咨询您的医疗保健提供者以做出医疗决定。",
  hi: "महत्वपूर्ण: यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है और चिकित्सा सलाह नहीं है। यह पेशेवर चिकित्सा परामर्श की जगह नहीं लेती। चिकित्सा निर्णयों के लिए हमेशा अपने स्वास्थ्य सेवा प्रदाता से परामर्श करें।",
  ar: "مهم: هذه المعلومات للأغراض التعليمية فقط وليست نصيحة طبية. لا تحل محل الاستشارة الطبية المتخصصة. استشر دائماً مقدم الرعاية الصحية الخاص بك لاتخاذ القرارات الطبية.",
  pt: "IMPORTANTE: Esta informação é apenas para fins educacionais e NÃO é aconselhamento médico. Não substitui a consulta médica profissional. Sempre consulte seu médico para decisões de saúde.",
  bn: "গুরুত্বপূর্ণ: এই তথ্য শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে এবং চিকিৎসা পরামর্শ নয়। এটি পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়। চিকিৎসা সংক্রান্ত সিদ্ধান্তের জন্য সর্বদা আপনার স্বাস্থ্যসেবা প্রদানকারীর সাথে পরামর্শ করুন।",
  ru: "ВАЖНО: Эта информация предназначена только для образовательных целей и НЕ является медицинской рекомендацией. Она не заменяет профессиональную медицинскую консультацию. Всегда консультируйтесь с вашим врачом для принятия медицинских решений.",
  ja: "重要：この情報は教育目的のみであり、医療アドバイスではありません。専門家による医療相談の代わりにはなりません。医療上の決定については必ず医療提供者にご相談ください。",
  pa: "ਮਹੱਤਵਪੂਰਨ: ਇਹ ਜਾਣਕਾਰੀ ਸਿਰਫ਼ ਸਿੱਖਿਆ ਦੇ ਉਦੇਸ਼ਾਂ ਲਈ ਹੈ ਅਤੇ ਡਾਕਟਰੀ ਸਲਾਹ ਨਹੀਂ ਹੈ। ਇਹ ਪੇਸ਼ੇਵਰ ਡਾਕਟਰੀ ਸਲਾਹ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦੀ। ਡਾਕਟਰੀ ਫੈਸਲਿਆਂ ਲਈ ਹਮੇਸ਼ਾ ਆਪਣੇ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।",
  de: "WICHTIG: Diese Information dient nur zu Bildungszwecken und ist KEINE medizinische Beratung. Sie ersetzt keine professionelle medizinische Beratung. Konsultieren Sie immer Ihren Arzt für medizinische Entscheidungen.",
  ko: "중요: 이 정보는 교육 목적으로만 제공되며 의료 조언이 아닙니다. 전문적인 의료 상담을 대체하지 않습니다. 의료 결정은 항상 담당 의료진과 상담하십시오.",
  fr: "IMPORTANT: Cette information est fournie à titre éducatif uniquement et NE constitue PAS un avis médical. Elle ne remplace pas une consultation médicale professionnelle. Consultez toujours votre médecin pour les décisions médicales.",
  vi: "QUAN TRỌNG: Thông tin này chỉ nhằm mục đích giáo dục và KHÔNG phải là lời khuyên y tế. Nó không thay thế tư vấn y tế chuyên nghiệp. Luôn tham khảo ý kiến bác sĩ của bạn để đưa ra quyết định y tế.",
  tl: "MAHALAGA: Ang impormasyong ito ay para lamang sa layuning pang-edukasyon at HINDI medikal na payo. Hindi nito pinapalitan ang propesyonal na konsultasyong medikal. Palaging kumonsulta sa iyong healthcare provider para sa mga desisyong medikal.",
  it: "IMPORTANTE: Queste informazioni sono solo a scopo educativo e NON costituiscono consulenza medica. Non sostituiscono la consulenza medica professionale. Consultare sempre il proprio medico per le decisioni mediche.",
};

const languageNames: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese",
  hi: "Hindi",
  ar: "Arabic",
  pt: "Portuguese",
  bn: "Bengali",
  ru: "Russian",
  ja: "Japanese",
  pa: "Punjabi",
  de: "German",
  ko: "Korean",
  fr: "French",
  vi: "Vietnamese",
  tl: "Tagalog",
  it: "Italian",
};

function generateId(): string {
  return `mhs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function formatHealthDataForPrompt(data: HealthRecordData): string {
  let formatted = "";

  if (data.conditions.length > 0) {
    formatted += "CONDITIONS:\n";
    data.conditions.forEach(c => {
      formatted += `- ${c.name} (${c.status}, ${c.severity})\n`;
    });
    formatted += "\n";
  }

  if (data.medications.length > 0) {
    formatted += "MEDICATIONS:\n";
    data.medications.forEach(m => {
      formatted += `- ${m.name}: ${m.dosage}, ${m.frequency}\n`;
    });
    formatted += "\n";
  }

  if (data.allergies.length > 0) {
    formatted += "ALLERGIES:\n";
    data.allergies.forEach(a => {
      formatted += `- ${a.allergen}: ${a.severity} severity, reaction: ${a.reaction}\n`;
    });
    formatted += "\n";
  }

  if (data.recentLabResults.length > 0) {
    formatted += "RECENT LAB RESULTS:\n";
    data.recentLabResults.slice(0, 10).forEach(l => {
      formatted += `- ${l.testName}: ${l.value} (${l.status}) on ${l.date}\n`;
    });
    formatted += "\n";
  }

  if (data.recentVitals.length > 0) {
    formatted += "RECENT VITALS:\n";
    data.recentVitals.slice(0, 5).forEach(v => {
      formatted += `- ${v.type}: ${v.value} on ${v.date}\n`;
    });
    formatted += "\n";
  }

  if (data.recentEncounters.length > 0) {
    formatted += "RECENT VISITS:\n";
    data.recentEncounters.slice(0, 5).forEach(e => {
      formatted += `- ${e.type} with ${e.provider} on ${e.date}: ${e.summary}\n`;
    });
    formatted += "\n";
  }

  return formatted || "No health data available to summarize.";
}

function getReadingLevelInstructions(level: "simple" | "standard" | "technical"): string {
  switch (level) {
    case "simple":
      return "Use very simple language suitable for someone with a 6th-grade reading level. Avoid all medical jargon. Explain everything as if talking to a child or elderly person who is not familiar with medical terms.";
    case "standard":
      return "Use clear, everyday language suitable for most adults. Explain medical terms when used. Aim for a high school reading level.";
    case "technical":
      return "Include appropriate medical terminology while still being clear. Suitable for someone with health literacy or medical background.";
  }
}

export async function generateMultilingualHealthSummary(
  request: SummaryRequest
): Promise<MultilingualSummary> {
  const summaryId = generateId();
  logHipaaAudit("GENERATE_SUMMARY", request.patientId, `Generating ${request.summaryType} summary in ${request.primaryLanguage}`);

  const formattedData = formatHealthDataForPrompt(request.healthData);
  const readingInstructions = getReadingLevelInstructions(request.readingLevel);

  let englishSummary = "";
  let plainLanguageSummary = "";
  let keyPoints: string[] = [];
  let actionItems: string[] = [];
  let translatedSummary: string | undefined;
  let keyPointsTranslated: string[] | undefined;
  let actionItemsTranslated: string[] | undefined;

  try {
    const systemPrompt = `You are a health information summarizer. Your role is to create clear, accurate summaries of patient health records.

CRITICAL RULES:
1. NEVER provide medical advice, diagnoses, or treatment recommendations
2. NEVER interpret lab results as good or bad unless explicitly marked in the data
3. NEVER suggest changes to medications or treatments
4. Always use factual, objective language
5. Include a reminder that this is informational only
6. ${readingInstructions}

Format your response as JSON with the following structure:
{
  "summary": "A 2-3 paragraph summary of the health record",
  "plainLanguage": "A very simple 2-3 sentence overview for someone with limited health literacy",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "actionItems": ["item 1", "item 2"] // Only include actions like "discuss with doctor" or "bring questions to next visit"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this health record data:\n\n${formattedData}` },
      ],
      max_completion_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    englishSummary = parsed.summary || "Unable to generate summary.";
    plainLanguageSummary = parsed.plainLanguage || englishSummary;
    keyPoints = parsed.keyPoints || [];
    actionItems = parsed.actionItems || [];

    if (request.secondaryLanguage && request.secondaryLanguage !== "en") {
      const targetLang = request.secondaryLanguage as any;
      const langMeta = LANGUAGE_METADATA[targetLang as keyof typeof LANGUAGE_METADATA];
      const langName = langMeta?.name || languageNames[request.secondaryLanguage];
      
      const conditionNames = request.healthData.conditions.map(c => c.name);
      const translatedConditions = conditionNames.map(name => 
        getConditionTranslation(name, targetLang)
      );
      
      const preservedTerms = [
        ...request.healthData.medications.map(m => m.name),
        ...request.healthData.medications.map(m => m.dosage),
      ].filter(Boolean);
      
      const preserveInstruction = preservedTerms.length > 0
        ? `\n\nCRITICAL - PRESERVE THESE TERMS EXACTLY (do NOT translate): ${preservedTerms.slice(0, 30).join(', ')}`
        : "";
      
      const conditionMappings = conditionNames.map((en, i) => 
        `"${en}" -> "${translatedConditions[i]}"`
      ).join('\n');
      
      const translationResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are a medical translator. Translate the following health summary to ${langName}.

RULES:
1. Maintain the same tone and reading level
2. Use medically accurate terminology in ${langName}
3. PRESERVE drug names, dosages, lab values, and units exactly as written${preserveInstruction}
4. Use these condition name translations:
${conditionMappings}

Return JSON with: {"summary": "...", "keyPoints": [...], "actionItems": [...]}`
          },
          { 
            role: "user", 
            content: JSON.stringify({ summary: englishSummary, keyPoints, actionItems }) 
          },
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const translatedContent = translationResponse.choices[0]?.message?.content || "{}";
      const translatedParsed = JSON.parse(translatedContent);
      
      translatedSummary = translatedParsed.summary;
      keyPointsTranslated = translatedParsed.keyPoints;
      actionItemsTranslated = translatedParsed.actionItems;
    }
  } catch (error) {
    console.error("[MultilingualSummary] AI generation failed:", error);
    englishSummary = generateFallbackSummary(request.healthData);
    plainLanguageSummary = englishSummary;
    keyPoints = generateFallbackKeyPoints(request.healthData);
    actionItems = ["Discuss this summary with your healthcare provider"];
  }

  const summary: MultilingualSummary = {
    id: summaryId,
    patientId: request.patientId,
    summaryType: request.summaryType,
    englishSummary,
    translatedSummary,
    targetLanguage: request.secondaryLanguage,
    plainLanguageSummary,
    keyPoints,
    keyPointsTranslated,
    actionItems,
    actionItemsTranslated,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER_EN,
    noCdsDisclaimerTranslated: request.secondaryLanguage ? getEnhancedNoCdsDisclaimer(request.secondaryLanguage as any) : undefined,
    readingLevel: request.readingLevel,
    voiceReadable: request.includeVoiceVersion,
    metadata: {
      conditionsCount: request.healthData.conditions.length,
      medicationsCount: request.healthData.medications.length,
      allergiesCount: request.healthData.allergies.length,
      labsCount: request.healthData.recentLabResults.length,
      dataFreshness: new Date().toISOString(),
      sourcesSummarized: ["conditions", "medications", "allergies", "labs", "vitals", "encounters"],
    },
  };

  summaryCache.set(summaryId, summary);
  logHipaaAudit("SUMMARY_GENERATED", request.patientId, `Summary ${summaryId} generated successfully`);

  return summary;
}

function generateFallbackSummary(data: HealthRecordData): string {
  const parts: string[] = [];
  
  if (data.conditions.length > 0) {
    const activeConditions = data.conditions.filter(c => c.status === "active");
    parts.push(`You have ${activeConditions.length} active health condition${activeConditions.length !== 1 ? "s" : ""} being managed.`);
  }
  
  if (data.medications.length > 0) {
    parts.push(`You are currently taking ${data.medications.length} medication${data.medications.length !== 1 ? "s" : ""}.`);
  }
  
  if (data.allergies.length > 0) {
    parts.push(`You have ${data.allergies.length} documented allerg${data.allergies.length !== 1 ? "ies" : "y"}.`);
  }
  
  if (data.recentLabResults.length > 0) {
    parts.push(`Your recent lab work includes ${data.recentLabResults.length} test${data.recentLabResults.length !== 1 ? "s" : ""}.`);
  }

  return parts.length > 0 
    ? parts.join(" ") + " Please discuss any questions with your healthcare provider."
    : "Your health record summary is being prepared. Please check back later or contact your healthcare provider for details.";
}

function generateFallbackKeyPoints(data: HealthRecordData): string[] {
  const points: string[] = [];
  
  if (data.conditions.length > 0) {
    const active = data.conditions.filter(c => c.status === "active");
    if (active.length > 0) {
      points.push(`${active.length} active health condition${active.length !== 1 ? "s" : ""}`);
    }
  }
  
  if (data.medications.length > 0) {
    points.push(`Currently taking ${data.medications.length} medication${data.medications.length !== 1 ? "s" : ""}`);
  }
  
  if (data.allergies.length > 0) {
    points.push(`${data.allergies.length} documented allerg${data.allergies.length !== 1 ? "ies" : "y"}`);
  }
  
  if (data.recentLabResults.length > 0) {
    points.push(`${data.recentLabResults.length} recent lab result${data.recentLabResults.length !== 1 ? "s" : ""}`);
  }
  
  if (data.recentEncounters.length > 0) {
    points.push(`${data.recentEncounters.length} recent healthcare visit${data.recentEncounters.length !== 1 ? "s" : ""}`);
  }

  return points.length > 0 ? points : ["Your health information is being compiled"];
}

export function getSummary(summaryId: string): MultilingualSummary | undefined {
  return summaryCache.get(summaryId);
}

export function getPatientSummaries(patientId: string): MultilingualSummary[] {
  const allSummaries = Array.from(summaryCache.values());
  const patientSummaries = allSummaries.filter(s => s.patientId === patientId);
  return patientSummaries.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export function getSupportedLanguages(): Record<SupportedLanguage, string> {
  return languageNames;
}

export function getNoCdsDisclaimer(language: SupportedLanguage): string {
  return getEnhancedNoCdsDisclaimer(language as any) || NO_CDS_DISCLAIMERS[language] || NO_CDS_DISCLAIMER_EN;
}

console.log("[MultilingualHealthSummary] Service initialized with AI-powered multilingual summary generation and NO-CDS compliance");
