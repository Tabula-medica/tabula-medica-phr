import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { advancedAnalyticsService } from "./services/ai-advanced-analytics";

const router = Router();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Advanced analytics audit log. Operations are for data governance and security only, not clinical decision-making."
  };
  console.log("[HIPAA-AUDIT][ADVANCED-ANALYTICS]", JSON.stringify(auditEntry));
}

const ForecastRequestSchema = z.object({
  historicalData: z.array(z.object({
    metricName: z.string(),
    values: z.array(z.number()),
    timestamps: z.array(z.string())
  })).optional(),
  forecastDays: z.number().min(7).max(90).optional()
});

const PatternAnalysisRequestSchema = z.object({
  analysisType: z.enum(["cross_patient", "cross_system", "temporal", "comprehensive"]).optional()
});

const ControlUpdateSchema = z.object({
  newState: z.enum(["active", "standby", "disabled"])
});

router.get("/stats", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ANALYTICS_STATS", {}, req);

  try {
    const stats = advancedAnalyticsService.getStats();
    res.json({
      stats,
      noCdsCompliance: "Analytics statistics for operational monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting analytics stats:", error);
    res.status(500).json({ error: "Failed to get analytics statistics" });
  }
});

router.get("/forecasts", (req: Request, res: Response) => {
  logHIPAAAudit("GET_FORECASTS", {}, req);

  try {
    const forecasts = advancedAnalyticsService.getForecasts();
    res.json({
      forecasts,
      count: forecasts.length,
      noCdsCompliance: "Data quality forecasts for operational planning only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting forecasts:", error);
    res.status(500).json({ error: "Failed to get forecasts" });
  }
});

router.post("/forecasts", async (req: Request, res: Response) => {
  try {
    const validation = ForecastRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("GENERATE_FORECAST", { forecastDays: validation.data.forecastDays }, req);

    const historicalData = (validation.data.historicalData || []).map(d => ({
      ...d,
      timestamps: d.timestamps.map(t => new Date(t))
    }));

    const forecast = await advancedAnalyticsService.generateDataQualityForecast(
      historicalData,
      validation.data.forecastDays
    );

    res.json({
      forecast,
      noCdsCompliance: forecast.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    res.status(500).json({ error: "Failed to generate forecast" });
  }
});

router.get("/patterns", (req: Request, res: Response) => {
  logHIPAAAudit("GET_PATTERN_ANALYSES", {}, req);

  try {
    const analyses = advancedAnalyticsService.getPatternAnalyses();
    res.json({
      analyses,
      count: analyses.length,
      totalPatterns: analyses.reduce((sum, a) => sum + a.patterns.length, 0),
      noCdsCompliance: "Pattern analyses for data governance only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting pattern analyses:", error);
    res.status(500).json({ error: "Failed to get pattern analyses" });
  }
});

router.post("/patterns", async (req: Request, res: Response) => {
  try {
    const validation = PatternAnalysisRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("GENERATE_PATTERN_ANALYSIS", { analysisType: validation.data.analysisType }, req);

    const analysis = await advancedAnalyticsService.analyzeSystemicPatterns(
      validation.data.analysisType || "comprehensive"
    );

    res.json({
      analysis,
      noCdsCompliance: analysis.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating pattern analysis:", error);
    res.status(500).json({ error: "Failed to generate pattern analysis" });
  }
});

router.get("/security", (req: Request, res: Response) => {
  logHIPAAAudit("GET_SECURITY_ANALYSES", {}, req);

  try {
    const analyses = advancedAnalyticsService.getSecurityAnalyses();
    res.json({
      analyses,
      count: analyses.length,
      noCdsCompliance: "Security analyses for infrastructure protection only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting security analyses:", error);
    res.status(500).json({ error: "Failed to get security analyses" });
  }
});

router.post("/security", async (req: Request, res: Response) => {
  try {
    logHIPAAAudit("GENERATE_SECURITY_ANALYSIS", {}, req);

    const analysis = await advancedAnalyticsService.analyzeSecurityPosture();

    res.json({
      analysis,
      noCdsCompliance: analysis.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating security analysis:", error);
    res.status(500).json({ error: "Failed to generate security analysis" });
  }
});

router.get("/security/:analysisId", (req: Request, res: Response) => {
  const { analysisId } = req.params;

  logHIPAAAudit("GET_SECURITY_ANALYSIS", { analysisId }, req);

  try {
    const analysis = advancedAnalyticsService.getSecurityAnalysis(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Security analysis not found" });
    }

    res.json({
      analysis,
      noCdsCompliance: analysis.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting security analysis:", error);
    res.status(500).json({ error: "Failed to get security analysis" });
  }
});

router.patch("/security/:analysisId/controls/:controlId", async (req: Request, res: Response) => {
  const { analysisId, controlId } = req.params;

  try {
    const validation = ControlUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("UPDATE_ADAPTIVE_CONTROL", { analysisId, controlId, newState: validation.data.newState }, req);

    const control = await advancedAnalyticsService.updateAdaptiveControl(
      analysisId,
      controlId,
      validation.data.newState
    );

    if (!control) {
      return res.status(404).json({ error: "Control not found" });
    }

    res.json({
      control,
      noCdsCompliance: "Adaptive control update for security management only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error updating adaptive control:", error);
    res.status(500).json({ error: "Failed to update adaptive control" });
  }
});

export default router;
