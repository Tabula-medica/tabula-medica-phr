import { Router, Request, Response } from "express";
import {
  medicalTerminologyTranslationService,
  getConditionTranslation,
  getReportTypeTranslation,
  getUITermTranslation,
  getNoCdsDisclaimer,
  translateMedicalText,
  translateHealthSummary,
  getSupportedLanguages,
  translateMultipleConditions,
  translateReportTypes,
  COMMON_CONDITIONS,
  REPORT_TYPES,
  UI_MEDICAL_TERMS,
  type SupportedLanguage,
} from "./services/medical-terminology-translation-service";

const router = Router();

router.get("/languages", (_req: Request, res: Response) => {
  try {
    const languages = getSupportedLanguages();
    const languageArray = Array.isArray(languages) ? languages : Object.values(languages);
    res.json({ 
      languages: languageArray,
      count: languageArray.length,
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error fetching languages:", error);
    res.status(500).json({ error: error.message || "Failed to fetch languages" });
  }
});

router.get("/conditions", (_req: Request, res: Response) => {
  try {
    const conditions = Object.keys(COMMON_CONDITIONS);
    res.json({
      conditions,
      count: conditions.length,
      message: "Available conditions with pre-translated medical terminology",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/report-types", (_req: Request, res: Response) => {
  try {
    const reportTypes = Object.keys(REPORT_TYPES);
    res.json({
      reportTypes,
      count: reportTypes.length,
      message: "Available report types with pre-translated terminology",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ui-terms", (_req: Request, res: Response) => {
  try {
    const uiTerms = Object.keys(UI_MEDICAL_TERMS);
    res.json({
      uiTerms,
      count: uiTerms.length,
      message: "Available UI medical terms with translations",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/translate/condition", (req: Request, res: Response) => {
  try {
    const { condition, language } = req.body;
    
    if (!condition || !language) {
      return res.status(400).json({ error: "condition and language are required" });
    }
    
    const translation = getConditionTranslation(condition, language as SupportedLanguage);
    
    res.json({
      original: condition,
      translated: translation,
      language,
      type: "condition",
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating condition:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/conditions", (req: Request, res: Response) => {
  try {
    const { conditions, language } = req.body;
    
    if (!conditions || !Array.isArray(conditions) || !language) {
      return res.status(400).json({ error: "conditions (array) and language are required" });
    }
    
    const translations = translateMultipleConditions(conditions, language as SupportedLanguage);
    
    res.json({
      original: conditions,
      translated: translations,
      language,
      count: conditions.length,
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating conditions:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/report-type", (req: Request, res: Response) => {
  try {
    const { reportType, language } = req.body;
    
    if (!reportType || !language) {
      return res.status(400).json({ error: "reportType and language are required" });
    }
    
    const translation = getReportTypeTranslation(reportType, language as SupportedLanguage);
    
    res.json({
      original: reportType,
      translated: translation,
      language,
      type: "reportType",
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating report type:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/report-types", (req: Request, res: Response) => {
  try {
    const { reportTypes, language } = req.body;
    
    if (!reportTypes || !Array.isArray(reportTypes) || !language) {
      return res.status(400).json({ error: "reportTypes (array) and language are required" });
    }
    
    const translations = translateReportTypes(reportTypes, language as SupportedLanguage);
    
    res.json({
      original: reportTypes,
      translated: translations,
      language,
      count: reportTypes.length,
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating report types:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/ui-term", (req: Request, res: Response) => {
  try {
    const { term, language } = req.body;
    
    if (!term || !language) {
      return res.status(400).json({ error: "term and language are required" });
    }
    
    const translation = getUITermTranslation(term, language as SupportedLanguage);
    
    res.json({
      original: term,
      translated: translation,
      language,
      type: "uiTerm",
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating UI term:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/text", async (req: Request, res: Response) => {
  try {
    const { text, language, options } = req.body;
    
    if (!text || !language) {
      return res.status(400).json({ error: "text and language are required" });
    }
    
    const result = await translateMedicalText(text, language as SupportedLanguage, {
      preserveTerms: options?.preserveTerms !== false,
      readingLevel: options?.readingLevel || "standard",
      includeDisclaimer: options?.includeDisclaimer || false,
      patientId: options?.patientId,
      userId: (req as any).userId,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating text:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.post("/translate/health-summary", async (req: Request, res: Response) => {
  try {
    const { summary, language, options } = req.body;
    
    if (!summary || !language) {
      return res.status(400).json({ error: "summary and language are required" });
    }
    
    if (!summary.title || !Array.isArray(summary.conditions)) {
      return res.status(400).json({ 
        error: "summary must include title and conditions array",
        expected: {
          title: "string",
          conditions: "string[]",
          medications: "string[]",
          allergies: "string[]",
          keyPoints: "string[]",
          actionItems: "string[]",
        },
      });
    }
    
    const result = await translateHealthSummary(
      {
        title: summary.title,
        conditions: summary.conditions || [],
        medications: summary.medications || [],
        allergies: summary.allergies || [],
        keyPoints: summary.keyPoints || [],
        actionItems: summary.actionItems || [],
      },
      language as SupportedLanguage,
      {
        patientId: options?.patientId,
        userId: (req as any).userId,
        readingLevel: options?.readingLevel || "standard",
      }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("[TranslationRoutes] Error translating health summary:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

router.get("/disclaimer/:language", (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const disclaimer = getNoCdsDisclaimer(language as SupportedLanguage);
    
    res.json({
      language,
      disclaimer,
      type: "noCdsDisclaimer",
    });
  } catch (error: any) {
    console.error("[TranslationRoutes] Error fetching disclaimer:", error);
    res.status(500).json({ error: error.message || "Failed to fetch disclaimer" });
  }
});

router.get("/condition/:condition/:language", (req: Request, res: Response) => {
  try {
    const { condition, language } = req.params;
    const translation = getConditionTranslation(
      decodeURIComponent(condition), 
      language as SupportedLanguage
    );
    
    res.json({
      original: decodeURIComponent(condition),
      translated: translation,
      language,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/condition-dictionary/:language", (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const lang = language as SupportedLanguage;
    
    const dictionary: Record<string, string> = {};
    for (const [key, translations] of Object.entries(COMMON_CONDITIONS)) {
      dictionary[key] = translations[lang] || translations.en;
    }
    
    res.json({
      language,
      dictionary,
      count: Object.keys(dictionary).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/report-type-dictionary/:language", (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const lang = language as SupportedLanguage;
    
    const dictionary: Record<string, string> = {};
    for (const [key, translations] of Object.entries(REPORT_TYPES)) {
      dictionary[key] = translations[lang] || translations.en;
    }
    
    res.json({
      language,
      dictionary,
      count: Object.keys(dictionary).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ui-term-dictionary/:language", (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const lang = language as SupportedLanguage;
    
    const dictionary: Record<string, string> = {};
    for (const [key, translations] of Object.entries(UI_MEDICAL_TERMS)) {
      dictionary[key] = translations[lang] || translations.en;
    }
    
    res.json({
      language,
      dictionary,
      count: Object.keys(dictionary).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
console.log("[MedicalTerminologyTranslation] Routes module loaded with 16-language support");
