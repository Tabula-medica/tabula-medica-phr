import { Router } from "express";
import { languagePreferencesService } from "./services/language-preferences";
import { insertUserLanguagePreferenceSchema, supportedSummaryLanguages, type SummaryLanguageCode } from "@shared/schema";

const router = Router();

router.get("/languages", (req, res) => {
  const languages = languagePreferencesService.getSupportedLanguages();
  res.json({ languages });
});

router.get("/preferences/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const preference = languagePreferencesService.getUserPreference(userId);
    const effectiveLanguage = languagePreferencesService.getEffectiveLanguage(userId);
    
    res.json({ 
      preference,
      effectiveLanguage,
      supportedLanguages: languagePreferencesService.getSupportedLanguages()
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error getting preferences:", error);
    res.status(500).json({ error: error.message || "Failed to get language preferences" });
  }
});

router.post("/preferences/:userId/default", (req, res) => {
  try {
    const { userId } = req.params;
    const { language } = req.body;

    if (!language || !supportedSummaryLanguages.includes(language)) {
      return res.status(400).json({ error: "Invalid language code" });
    }

    const preference = languagePreferencesService.setDefaultLanguage(userId, language as SummaryLanguageCode);
    
    console.log(`[HIPAA-AUDIT] Language preference changed | userId: ${userId} | newDefault: ${language}`);
    
    res.json({ 
      success: true, 
      preference,
      message: `Default language set to ${language}`
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error setting default language:", error);
    res.status(500).json({ error: error.message || "Failed to set default language" });
  }
});

router.post("/preferences/:userId/summary/:summaryId", (req, res) => {
  try {
    const { userId, summaryId } = req.params;
    const { language } = req.body;

    if (!language || !supportedSummaryLanguages.includes(language)) {
      return res.status(400).json({ error: "Invalid language code" });
    }

    const preference = languagePreferencesService.setSummaryLanguage(
      userId, 
      summaryId, 
      language as SummaryLanguageCode
    );
    
    console.log(`[HIPAA-AUDIT] Summary language changed | userId: ${userId} | summaryId: ${summaryId} | language: ${language}`);
    
    res.json({ 
      success: true, 
      preference,
      message: `Summary language set to ${language}`
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error setting summary language:", error);
    res.status(500).json({ error: error.message || "Failed to set summary language" });
  }
});

router.delete("/preferences/:userId/summary/:summaryId", (req, res) => {
  try {
    const { userId, summaryId } = req.params;

    const preference = languagePreferencesService.clearSummaryLanguageOverride(userId, summaryId);
    
    res.json({ 
      success: true, 
      preference,
      message: "Summary language override cleared"
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error clearing summary language:", error);
    res.status(500).json({ error: error.message || "Failed to clear summary language override" });
  }
});

router.get("/summaries/:userId/:patientId", async (req, res) => {
  try {
    const { userId, patientId } = req.params;
    const { includePlainLanguage, readingLevel } = req.query;

    const result = await languagePreferencesService.getSummariesWithTranslation(
      userId,
      patientId,
      {
        includePlainLanguage: includePlainLanguage !== "false",
        readingLevel: (readingLevel as "basic" | "intermediate" | "advanced") || "intermediate"
      }
    );
    
    console.log(`[HIPAA-AUDIT] Summaries accessed with translation | userId: ${userId} | patientId: ${patientId}`);
    
    res.json(result);
  } catch (error: any) {
    console.error("[LanguagePreferences] Error getting summaries:", error);
    res.status(500).json({ error: error.message || "Failed to get summaries" });
  }
});

router.post("/translate/:userId/:summaryId", async (req, res) => {
  try {
    const { userId, summaryId } = req.params;
    const { language, includePlainLanguage, readingLevel } = req.body;

    const targetLanguage = language as SummaryLanguageCode | undefined;
    
    const translated = await languagePreferencesService.translateSummaryForUser(
      userId,
      summaryId,
      targetLanguage,
      {
        includePlainLanguage: includePlainLanguage !== false,
        readingLevel: readingLevel || "intermediate"
      }
    );
    
    console.log(`[HIPAA-AUDIT] Summary translated | userId: ${userId} | summaryId: ${summaryId} | language: ${translated.targetLanguage}`);
    
    res.json({ 
      success: true, 
      translation: translated 
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error translating summary:", error);
    res.status(500).json({ error: error.message || "Failed to translate summary" });
  }
});

router.get("/analytics", (req, res) => {
  try {
    const { userId, eventType, startDate, endDate, limit } = req.query;

    const events = languagePreferencesService.getAnalyticsEvents({
      userId: userId as string,
      eventType: eventType as "language_selected" | "summary_language_changed",
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ events });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error getting analytics:", error);
    res.status(500).json({ error: error.message || "Failed to get analytics" });
  }
});

router.get("/analytics/summary", (req, res) => {
  try {
    const summary = languagePreferencesService.getAnalyticsSummary();
    res.json({ summary });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error getting analytics summary:", error);
    res.status(500).json({ error: error.message || "Failed to get analytics summary" });
  }
});

router.post("/document/translate", async (req, res) => {
  try {
    const { userId, documentId, documentType, targetLanguage, content } = req.body;

    if (!userId || !documentId || !documentType || !targetLanguage) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["snapshot_pdf", "discharge_summary", "timeline_monthly"].includes(documentType)) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    if (!supportedSummaryLanguages.includes(targetLanguage)) {
      return res.status(400).json({ error: "Invalid language code" });
    }

    languagePreferencesService.trackTranslationRequested(
      userId,
      documentId,
      documentType,
      targetLanguage as SummaryLanguageCode
    );

    const translated = await languagePreferencesService.translateSummaryForUser(
      userId,
      documentId,
      targetLanguage as SummaryLanguageCode,
      { includePlainLanguage: true }
    );

    languagePreferencesService.trackTranslationCompleted(
      userId,
      documentId,
      documentType,
      targetLanguage as SummaryLanguageCode
    );

    console.log(`[HIPAA-AUDIT] Document translated | userId: ${userId} | documentId: ${documentId} | type: ${documentType} | language: ${targetLanguage}`);

    res.json({
      success: true,
      translation: translated,
      originalContent: content,
      disclaimer: "EDUCATIONAL ONLY. NOT MEDICAL ADVICE. Translation may not preserve all clinical nuances."
    });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error translating document:", error);
    res.status(500).json({ error: error.message || "Failed to translate document" });
  }
});

router.post("/document/view-original", (req, res) => {
  try {
    const { userId, documentId, documentType } = req.body;

    if (!userId || !documentId || !documentType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    languagePreferencesService.trackViewedOriginal(userId, documentId, documentType);

    console.log(`[HIPAA-AUDIT] Viewed original document | userId: ${userId} | documentId: ${documentId} | type: ${documentType}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[LanguagePreferences] Error tracking view original:", error);
    res.status(500).json({ error: error.message || "Failed to track view original" });
  }
});

export default router;
