import { Router, Request, Response } from "express";
import { z } from "zod";
import * as aiProfileInsightsService from "./services/ai-profile-insights-service";

const router = Router();

const profileIdParamSchema = z.object({
  profileId: z.string().min(1),
});

const queryParamsSchema = z.object({
  userId: z.string().min(1).optional(),
  forceRefresh: z.string().optional(),
});

router.get("/history-summary/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);
    const userId = req.query.userId as string || profileId;

    const summary = await aiProfileInsightsService.generatePatientHistorySummary(profileId, userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[AIProfileInsights] Error generating history summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate patient history summary",
      disclaimer: "This is an educational feature only - not clinical decision support.",
    });
  }
});

router.get("/risk-assessment/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);
    const userId = req.query.userId as string || profileId;

    const assessment = await aiProfileInsightsService.generateHealthRiskAssessment(profileId, userId);
    res.json({ success: true, data: assessment });
  } catch (error) {
    console.error("[AIProfileInsights] Error generating risk assessment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate health risk assessment",
      disclaimer: "This is an educational feature only - not clinical decision support.",
    });
  }
});

router.get("/care-plan-adjustments/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);
    const userId = req.query.userId as string || profileId;

    const adjustments = await aiProfileInsightsService.generateCarePlanAdjustments(profileId, userId);
    res.json({ success: true, data: adjustments });
  } catch (error) {
    console.error("[AIProfileInsights] Error generating care plan adjustments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate care plan adjustment suggestions",
      disclaimer: "This is an educational feature only - not clinical decision support.",
    });
  }
});

router.get("/full-insights/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);
    const userId = req.query.userId as string || profileId;
    const forceRefresh = req.query.forceRefresh === "true";

    const insights = await aiProfileInsightsService.getFullProfileInsights(profileId, userId, forceRefresh);
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error("[AIProfileInsights] Error generating full insights:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate comprehensive profile insights",
      disclaimer: "This is an educational feature only - not clinical decision support.",
    });
  }
});

router.get("/ehr-sources/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);

    const sources = aiProfileInsightsService.getEHRDataSources(profileId);
    res.json({ success: true, data: sources });
  } catch (error) {
    console.error("[AIProfileInsights] Error getting EHR sources:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get EHR data sources",
    });
  }
});

router.get("/ehr-data-summary/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = profileIdParamSchema.parse(req.params);
    const userId = req.query.userId as string || profileId;

    const summary = aiProfileInsightsService.getEHRDataSummary(profileId, userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[AIProfileInsights] Error getting EHR data summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get EHR data summary",
    });
  }
});

export function registerAIProfileInsightsRoutes(app: any) {
  app.use("/api/ai-profile-insights", router);
  console.log("[Routes] AI Profile Insights routes registered at /api/ai-profile-insights/*");
}

export default router;
