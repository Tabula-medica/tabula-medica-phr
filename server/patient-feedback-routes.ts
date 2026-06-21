import { Router, Request, Response } from "express";
import { z } from "zod";
import { patientFeedbackAnalysisService } from "./services/patient-feedback-analysis-service";

const router = Router();

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated feedback analysis is for INFORMATIONAL purposes only. Insights should be reviewed by appropriate staff and do not constitute clinical or diagnostic recommendations.";

const feedbackInputSchema = z.object({
  patientId: z.string().optional(),
  source: z.enum(["survey", "message", "portal", "phone", "email"]),
  type: z.enum(["general", "visit", "provider", "facility", "billing", "wait_time", "communication"]),
  content: z.string().min(10, "Feedback must be at least 10 characters"),
  rating: z.number().min(1).max(5).optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  visitId: z.string().optional()
});

router.get("/feedback", async (_req: Request, res: Response) => {
  try {
    const feedback = patientFeedbackAnalysisService.getAllFeedback();
    res.json({
      success: true,
      data: feedback,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching feedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch feedback"
    });
  }
});

router.get("/feedback/:id", async (req: Request, res: Response) => {
  try {
    const feedback = patientFeedbackAnalysisService.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: "Feedback not found"
      });
    }
    res.json({
      success: true,
      data: feedback,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching feedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch feedback"
    });
  }
});

router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const parsed = feedbackInputSchema.parse(req.body);
    const feedback = await patientFeedbackAnalysisService.submitFeedback(parsed);
    res.json({
      success: true,
      data: feedback,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors
      });
    }
    console.error("[FeedbackRoutes] Error submitting feedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit feedback"
    });
  }
});

router.post("/feedback/:id/analyze", async (req: Request, res: Response) => {
  try {
    const analysis = await patientFeedbackAnalysisService.analyzeFeedback(req.params.id);
    res.json({
      success: true,
      data: analysis,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error analyzing feedback:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze feedback"
    });
  }
});

router.get("/analyses", async (_req: Request, res: Response) => {
  try {
    const analyses = patientFeedbackAnalysisService.getAllAnalyses();
    res.json({
      success: true,
      data: analyses,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching analyses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analyses"
    });
  }
});

router.get("/themes", async (_req: Request, res: Response) => {
  try {
    const themes = await patientFeedbackAnalysisService.getThemeAnalysis();
    res.json({
      success: true,
      data: themes,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching themes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch theme analysis"
    });
  }
});

router.get("/improvements", async (_req: Request, res: Response) => {
  try {
    const improvements = await patientFeedbackAnalysisService.getImprovementAreas();
    res.json({
      success: true,
      data: improvements,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching improvements:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch improvement areas"
    });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await patientFeedbackAnalysisService.getAnalyticsSummary(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json({
      success: true,
      data: summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[FeedbackRoutes] Error fetching summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analytics summary"
    });
  }
});

export default router;
