import { Router } from "express";
import * as multilingualSummary from "./services/multilingual-health-summary-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, resourceType: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][MultilingualSummaryRoutes] ${action} - ${resourceType}/${resourceId} by ${hashIdentifier(userId)}: ${details}`);
}

router.get("/api/health-summaries/languages", async (req, res) => {
  try {
    const languages = multilingualSummary.getSupportedLanguages();
    res.json({ success: true, data: languages });
  } catch (error) {
    console.error("[MultilingualSummary] Get languages error:", error);
    res.status(500).json({ success: false, error: "Failed to get supported languages" });
  }
});

router.post("/api/health-summaries/generate", async (req, res) => {
  try {
    const { patientId, healthData, primaryLanguage, secondaryLanguage, summaryType, readingLevel, includeVoiceVersion } = req.body;

    if (!patientId || !healthData) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: patientId, healthData" 
      });
    }

    logHipaaAudit("GENERATE_SUMMARY", patientId, "HealthSummary", "new", `Generating ${summaryType || "full"} summary`);

    const summary = await multilingualSummary.generateMultilingualHealthSummary({
      patientId,
      healthData,
      primaryLanguage: primaryLanguage || "en",
      secondaryLanguage,
      summaryType: summaryType || "full",
      readingLevel: readingLevel || "standard",
      includeVoiceVersion: includeVoiceVersion || false,
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("[MultilingualSummary] Generate summary error:", error);
    res.status(500).json({ success: false, error: "Failed to generate summary" });
  }
});

router.get("/api/health-summaries/:summaryId", async (req, res) => {
  try {
    const summary = multilingualSummary.getSummary(req.params.summaryId);
    if (!summary) {
      return res.status(404).json({ success: false, error: "Summary not found" });
    }

    logHipaaAudit("VIEW_SUMMARY", summary.patientId, "HealthSummary", summary.id, "Viewed summary");
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[MultilingualSummary] Get summary error:", error);
    res.status(500).json({ success: false, error: "Failed to get summary" });
  }
});

router.get("/api/health-summaries/patient/:patientId", async (req, res) => {
  try {
    const summaries = multilingualSummary.getPatientSummaries(req.params.patientId);

    logHipaaAudit("VIEW_PATIENT_SUMMARIES", req.params.patientId, "HealthSummary", "list", `Retrieved ${summaries.length} summaries`);
    res.json({ success: true, data: summaries });
  } catch (error) {
    console.error("[MultilingualSummary] Get patient summaries error:", error);
    res.status(500).json({ success: false, error: "Failed to get patient summaries" });
  }
});

router.get("/api/health-summaries/disclaimer/:language", async (req, res) => {
  try {
    const language = req.params.language as any;
    const disclaimer = multilingualSummary.getNoCdsDisclaimer(language);
    res.json({ success: true, data: { language, disclaimer } });
  } catch (error) {
    console.error("[MultilingualSummary] Get disclaimer error:", error);
    res.status(500).json({ success: false, error: "Failed to get disclaimer" });
  }
});

export function registerMultilingualSummaryRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Multilingual Health Summary routes registered at /api/health-summaries/*");
}

export default router;
