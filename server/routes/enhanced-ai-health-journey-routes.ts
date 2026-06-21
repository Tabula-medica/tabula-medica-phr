import { Router, Request, Response } from "express";
import { enhancedAIHealthJourneyService } from "../services/enhanced-ai-health-journey-service";

const router = Router();

console.log("[EnhancedAIHealthJourney] Routes module loaded");

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[EnhancedAIHealthJourney] Generating enhanced summary for patient ${patientId}, timeframe: ${timeframeDays} days`);
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ENHANCED_SUMMARY_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ENHANCED_SUMMARY_GENERATED | patientId=${patientId} | score=${summary.overallHealthScore}`);
    
    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error generating summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate enhanced health journey summary",
    });
  }
});

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[EnhancedAIHealthJourney] Fetching enhanced summary for patient ${patientId}`);
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ENHANCED_SUMMARY_FETCHED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    const frontendSummary = {
      patientId: summary.patientId,
      generatedAt: summary.generatedAt,
      dateRange: summary.dateRange,
      healthScore: summary.overallHealthScore,
      healthScoreTrend: summary.healthScoreTrend,
      executiveSummary: summary.executiveSummary,
      detailedNarrative: summary.detailedNarrative,
      specialistNotes: summary.specialistNotes,
      vitalTrends: summary.vitalTrends,
      labTrends: summary.labTrends,
      medicationAnalysis: summary.medicationAnalysis,
      episodesOfCare: summary.episodesOfCare,
      proactiveAlerts: summary.proactiveAlerts,
      noCdsDisclaimer: summary.noCdsDisclaimer,
    };
    
    res.json(frontendSummary);
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching summary:", error);
    res.status(500).json({
      error: "Failed to fetch enhanced health journey summary",
    });
  }
});

router.post("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[EnhancedAIHealthJourney] Generating enhanced summary for patient ${patientId}, timeframe: ${timeframeDays} days`);
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ENHANCED_SUMMARY_GENERATED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    const frontendSummary = {
      patientId: summary.patientId,
      generatedAt: summary.generatedAt,
      dateRange: summary.dateRange,
      healthScore: summary.overallHealthScore,
      healthScoreTrend: summary.healthScoreTrend,
      executiveSummary: summary.executiveSummary,
      detailedNarrative: summary.detailedNarrative,
      specialistNotes: summary.specialistNotes,
      vitalTrends: summary.vitalTrends,
      labTrends: summary.labTrends,
      medicationAnalysis: summary.medicationAnalysis,
      episodesOfCare: summary.episodesOfCare,
      proactiveAlerts: summary.proactiveAlerts,
      noCdsDisclaimer: summary.noCdsDisclaimer,
    };
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ENHANCED_SUMMARY_GENERATED_SUCCESS | patientId=${patientId} | score=${summary.overallHealthScore}`);
    
    res.json(frontendSummary);
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error generating summary:", error);
    res.status(500).json({
      error: "Failed to generate enhanced health journey summary",
    });
  }
});

router.get("/vital-trends", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | VITAL_TRENDS_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    res.json({
      success: true,
      vitalTrends: summary.vitalTrends,
      timeframeDays,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching vital trends:", error);
    res.status(500).json({ success: false, error: "Failed to fetch vital trends" });
  }
});

router.get("/lab-trends", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | LAB_TRENDS_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    res.json({
      success: true,
      labTrends: summary.labTrends,
      timeframeDays,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching lab trends:", error);
    res.status(500).json({ success: false, error: "Failed to fetch lab trends" });
  }
});

router.get("/medication-analysis", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | MEDICATION_ANALYSIS_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId);
    
    res.json({
      success: true,
      medicationAnalysis: summary.medicationAnalysis,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching medication analysis:", error);
    res.status(500).json({ success: false, error: "Failed to fetch medication analysis" });
  }
});

router.get("/episodes-of-care", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    const timeframeDays = parseInt(req.query.timeframeDays as string) || 365;
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | EPISODES_OF_CARE_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId, timeframeDays);
    
    res.json({
      success: true,
      episodesOfCare: summary.episodesOfCare,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching episodes of care:", error);
    res.status(500).json({ success: false, error: "Failed to fetch episodes of care" });
  }
});

router.get("/proactive-alerts", async (req: Request, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || "patient_001";
    
    console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | PROACTIVE_ALERTS_REQUESTED | patientId=${patientId}`);
    
    const summary = await enhancedAIHealthJourneyService.generateEnhancedSummary(patientId);
    
    res.json({
      success: true,
      proactiveAlerts: summary.proactiveAlerts,
    });
  } catch (error) {
    console.error("[EnhancedAIHealthJourney] Error fetching proactive alerts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch proactive alerts" });
  }
});

export default router;
