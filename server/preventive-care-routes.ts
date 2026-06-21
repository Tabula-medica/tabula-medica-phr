import { Router, Request, Response } from "express";
import { uspstfGuidelinesService } from "./services/uspstf-guidelines";
import { claimsAnalysisService } from "./services/claims-analysis";
import { clinicalSummaryTranslationService } from "./services/clinical-summary-translation";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][PREVENTIVE-CARE] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Educational/administrative information only. No clinical decision support."
  })}`);
}

// USPSTF Guidelines Routes
router.get("/uspstf/guidelines", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ALL_GUIDELINES", {}, req);
  const guidelines = uspstfGuidelinesService.getAllGuidelines();
  const categories = uspstfGuidelinesService.getCategories();
  res.json({
    guidelines,
    categories,
    noCdsCompliance: "USPSTF guidelines for educational purposes. NOT clinical recommendations."
  });
});

router.get("/uspstf/categories", (req: Request, res: Response) => {
  const categories = uspstfGuidelinesService.getCategories();
  res.json({ categories });
});

router.post("/uspstf/recommendations", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_PATIENT_RECOMMENDATIONS", { profile: req.body }, req);
  
  try {
    const { age, gender, riskFactors, smokingHistory, conditions, useAI } = req.body;
    
    if (!age || !gender) {
      return res.status(400).json({ error: "Age and gender are required" });
    }

    const profile = {
      age: Number(age),
      gender: gender as "male" | "female" | "other",
      riskFactors,
      smokingHistory,
      conditions
    };

    if (useAI) {
      const result = await uspstfGuidelinesService.getAIEnhancedRecommendations(profile);
      res.json(result);
    } else {
      const result = uspstfGuidelinesService.getRecommendationsForPatient(profile);
      res.json(result);
    }
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// Claims Analysis Routes
router.get("/claims/:patientId", (req: Request, res: Response) => {
  logHIPAAAudit("GET_CLAIMS", { patientId: req.params.patientId }, req);
  const claims = claimsAnalysisService.getClaims(req.params.patientId);
  res.json({
    claims,
    noCdsCompliance: "Claims data for financial/administrative purposes only."
  });
});

router.get("/claims/:patientId/analysis", (req: Request, res: Response) => {
  logHIPAAAudit("ANALYZE_CLAIMS", { patientId: req.params.patientId }, req);
  const analysis = claimsAnalysisService.analyzeClaimsData(req.params.patientId);
  res.json({
    analysis,
    noCdsCompliance: "Claims analysis for financial/administrative purposes. NOT medical advice."
  });
});

router.get("/claims/:patientId/ai-insights", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_AI_CLAIMS_INSIGHTS", { patientId: req.params.patientId }, req);
  
  try {
    const result = await claimsAnalysisService.getAIInsights(req.params.patientId);
    res.json(result);
  } catch (error) {
    console.error("Error getting AI insights:", error);
    res.status(500).json({ error: "Failed to get AI insights" });
  }
});

// Clinical Summary Translation Routes
router.get("/translations/languages", (req: Request, res: Response) => {
  const languages = clinicalSummaryTranslationService.getSupportedLanguages();
  res.json({ languages });
});

router.get("/translations/summaries/:patientId", (req: Request, res: Response) => {
  logHIPAAAudit("GET_SUMMARIES", { patientId: req.params.patientId }, req);
  const summaries = clinicalSummaryTranslationService.getSummaries(req.params.patientId);
  res.json({ summaries });
});

router.post("/translations/translate/:summaryId", async (req: Request, res: Response) => {
  logHIPAAAudit("TRANSLATE_SUMMARY", { 
    summaryId: req.params.summaryId, 
    targetLanguage: req.body.targetLanguage 
  }, req);
  
  try {
    const { targetLanguage, includePlainLanguage, readingLevel } = req.body;
    
    if (!targetLanguage) {
      return res.status(400).json({ error: "Target language is required" });
    }

    const result = await clinicalSummaryTranslationService.translateSummary(
      req.params.summaryId,
      targetLanguage,
      { includePlainLanguage, readingLevel }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate" });
  }
});

router.post("/translations/translate-text", async (req: Request, res: Response) => {
  logHIPAAAudit("TRANSLATE_TEXT", { 
    sourceLanguage: req.body.sourceLanguage,
    targetLanguage: req.body.targetLanguage 
  }, req);
  
  try {
    const { text, sourceLanguage, targetLanguage, context } = req.body;
    
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Text and target language are required" });
    }

    const result = await clinicalSummaryTranslationService.translateCustomText(
      text,
      sourceLanguage || "English",
      targetLanguage,
      context
    );
    res.json(result);
  } catch (error: any) {
    console.error("Translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate" });
  }
});

export default router;
