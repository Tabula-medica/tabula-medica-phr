import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  generateOnePageSummary,
  getSummaryHistory,
  getSummaryById,
  refreshSummary,
  getSamplePatientData,
  type SummaryGenerationRequest,
  type PatientProfileData,
} from "./services/aiPatientProfileSummaryService";

const router = Router();

const NO_CDS_DISCLAIMER = "IMPORTANT: This summary is for informational and documentation purposes only. It does NOT constitute clinical decision support or medical advice. All information requires verification by qualified healthcare professionals before use in clinical decisions.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][PatientProfileSummaryRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      profileData,
      includeAiInsights = true,
      summaryFormat = "standard",
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: "Patient ID is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const requesterId = (req as any).userId || "anonymous";
    const requesterRole = (req as any).userRole || "user";

    logHipaaAudit("SUMMARY_GENERATION_REQUEST", requesterId, `Generating summary for patient`);

    const dataToUse: PatientProfileData = profileData || getSamplePatientData();

    const request: SummaryGenerationRequest = {
      patientId,
      profileData: dataToUse,
      requesterId,
      requesterRole,
      includeAiInsights,
      summaryFormat,
    };

    const result = await generateOnePageSummary(request);

    logHipaaAudit("SUMMARY_GENERATED", requesterId, `Summary ID: ${hashIdentifier(result.summary.id)}`);

    res.json({
      success: true,
      summary: result.summary,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error generating summary:", error);
    const requesterId = (req as any).userId || "anonymous";
    logHipaaAudit("SUMMARY_GENERATION_ERROR", requesterId, `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to generate health summary",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      profileData,
      includeAiInsights = true,
      summaryFormat = "standard",
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: "Patient ID is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const requesterId = (req as any).userId || "anonymous";
    const requesterRole = (req as any).userRole || "user";

    logHipaaAudit("SUMMARY_REFRESH_REQUEST", requesterId, `Refreshing summary for patient`);

    const dataToUse: PatientProfileData = profileData || getSamplePatientData();

    const request: SummaryGenerationRequest = {
      patientId,
      profileData: dataToUse,
      requesterId,
      requesterRole,
      includeAiInsights,
      summaryFormat,
    };

    const result = await refreshSummary(request);

    logHipaaAudit("SUMMARY_REFRESHED", requesterId, `New summary ID: ${hashIdentifier(result.summary.id)}`);

    res.json({
      success: true,
      summary: result.summary,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error refreshing summary:", error);
    const requesterId = (req as any).userId || "anonymous";
    logHipaaAudit("SUMMARY_REFRESH_ERROR", requesterId, `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to refresh health summary",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const requesterId = (req as any).userId || "anonymous";

    logHipaaAudit("SUMMARY_HISTORY_ACCESS", requesterId, `Accessing summary history`);

    const result = await getSummaryHistory(patientId, requesterId);

    res.json({
      success: true,
      patientId,
      summaries: result.summaries,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error fetching summary history:", error);
    const requesterId = (req as any).userId || "anonymous";
    logHipaaAudit("SUMMARY_HISTORY_ERROR", requesterId, `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to fetch summary history",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/summary/:summaryId", async (req: Request, res: Response) => {
  try {
    const { summaryId } = req.params;
    const requesterId = (req as any).userId || "anonymous";

    logHipaaAudit("SUMMARY_ACCESS", requesterId, `Accessing summary: ${hashIdentifier(summaryId)}`);

    const result = await getSummaryById(summaryId, requesterId);

    if (!result.summary) {
      return res.status(404).json({
        success: false,
        error: "Summary not found or expired",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      success: true,
      summary: result.summary,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error fetching summary:", error);
    const requesterId = (req as any).userId || "anonymous";
    logHipaaAudit("SUMMARY_ACCESS_ERROR", requesterId, `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to fetch summary",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/sample-data", async (_req: Request, res: Response) => {
  try {
    const sampleData = getSamplePatientData();
    res.json({
      success: true,
      sampleData,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error fetching sample data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sample data",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/quick-summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    const requesterId = (req as any).userId || "anonymous";
    const requesterRole = (req as any).userRole || "user";

    logHipaaAudit("QUICK_SUMMARY_REQUEST", requesterId, `Generating quick summary`);

    const request: SummaryGenerationRequest = {
      patientId: patientId || "patient-default",
      profileData: getSamplePatientData(),
      requesterId,
      requesterRole,
      includeAiInsights: true,
      summaryFormat: "condensed",
    };

    const result = await generateOnePageSummary(request);

    res.json({
      success: true,
      summary: result.summary,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[PatientProfileSummary] Error generating quick summary:", error);
    const requesterId = (req as any).userId || "anonymous";
    logHipaaAudit("QUICK_SUMMARY_ERROR", requesterId, `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to generate quick summary",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

console.log("[AIPatientProfileSummary] Routes module loaded");

export default router;
