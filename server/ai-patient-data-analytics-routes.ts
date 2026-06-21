import { Router } from "express";
import { aiPatientDataAnalyticsService } from "./services/ai-patient-data-analytics-service";

const router = Router();

router.get("/metadata", async (req, res) => {
  try {
    const metadata = aiPatientDataAnalyticsService.getMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Metadata error:", error);
    res.status(500).json({ error: "Failed to get service metadata" });
  }
});

router.get("/dashboard/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const dashboard = await aiPatientDataAnalyticsService.getDashboardData(patientId);
    res.json(dashboard);
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
});

router.get("/condition-trends/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { conditionCode, months } = req.query;
    
    const trends = await aiPatientDataAnalyticsService.analyzeConditionTrends(
      patientId,
      conditionCode as string | undefined,
      months ? parseInt(months as string) : 12
    );
    
    res.json({ trends, disclaimer: "INFORMATIONAL ONLY: This analysis is for patient education purposes and does not constitute medical advice." });
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Condition trends error:", error);
    res.status(500).json({ error: "Failed to analyze condition trends" });
  }
});

router.get("/risk-predictions/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { riskTypes } = req.query;
    
    const types = riskTypes ? (riskTypes as string).split(",") : undefined;
    const predictions = await aiPatientDataAnalyticsService.predictHealthRisks(patientId, types);
    
    res.json({ predictions, disclaimer: "INFORMATIONAL ONLY: Risk predictions are for awareness purposes and do not constitute clinical decision support." });
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Risk predictions error:", error);
    res.status(500).json({ error: "Failed to generate risk predictions" });
  }
});

router.get("/health-report/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { reportType } = req.query;
    
    const report = await aiPatientDataAnalyticsService.generatePersonalizedHealthReport(
      patientId,
      (reportType as "comprehensive" | "condition_focused" | "trend_summary" | "risk_assessment") || "comprehensive"
    );
    
    res.json({ report });
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Health report error:", error);
    res.status(500).json({ error: "Failed to generate health report" });
  }
});

router.post("/generate-report", async (req, res) => {
  try {
    const { patientId, reportType } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }
    
    const report = await aiPatientDataAnalyticsService.generatePersonalizedHealthReport(
      patientId,
      reportType || "comprehensive"
    );
    
    res.json({ report, success: true });
  } catch (error) {
    console.error("[AIPatientDataAnalytics] Generate report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

console.log("[Routes] AI Patient Data Analytics routes registered at /api/patient-data-analytics/*");

export default router;
