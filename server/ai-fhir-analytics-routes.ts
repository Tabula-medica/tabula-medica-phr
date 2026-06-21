import { Express, Request, Response } from "express";
import { z } from "zod";
import { aiFHIRAnalyticsService } from "./services/ai-fhir-analytics-service";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";

const predictiveModelSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  modelType: z.enum(["readmission_risk", "disease_progression", "mortality_risk", "complication_risk", "treatment_response"]),
});

const populationTrendSchema = z.object({
  trendType: z.enum(["prevalence", "incidence", "outcome", "utilization", "cost"]),
  condition: z.string().optional(),
  timeRangeMonths: z.number().min(1).max(60).optional(),
});

const nlReportSchema = z.object({
  reportType: z.enum(["patient_summary", "population_analysis", "trend_report", "risk_assessment", "quality_metrics"]),
  patientId: z.string().optional(),
  condition: z.string().optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

function getUserId(req: Request): string {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  return user?.claims?.sub || "anonymous";
}

async function logRouteAudit(
  userId: string,
  action: string,
  resourceType: string,
  success: boolean,
  metadata: Record<string, unknown>,
  req: Request
): Promise<void> {
  await comprehensiveAuditTrailService.logAuditEntry(userId, {
    who: {
      userId,
      userRole: "user",
      ipAddress: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      sessionId: `session-${Date.now()}`,
    },
    what: {
      category: "ai_prediction",
      action: success ? "read" : "error",
      resourceType,
      description: `AI FHIR Analytics: ${action}`,
    },
    why: {
      reason: "AI-driven FHIR analytics operation",
      automatedAction: false,
    },
    result: {
      success,
      errorMessage: !success && metadata.error ? String(metadata.error) : undefined,
    },
    context: {
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
    severity: success ? "info" : "warning",
    tags: ["ai", "fhir", "analytics"],
    phiAccessed: true,
    complianceFlags: ["HIPAA", "NO-CDS"],
    metadata,
  });
}

export function registerAIFHIRAnalyticsRoutes(app: Express): void {
  app.get("/api/fhir-analytics/metadata", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const metadata = aiFHIRAnalyticsService.getMetadata();
      await logRouteAudit(userId, "get_metadata", "Metadata", true, {}, req);
      res.json(metadata);
    } catch (error) {
      await logRouteAudit(userId, "get_metadata", "Metadata", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Metadata error:", error);
      res.status(500).json({ error: "Failed to get metadata" });
    }
  });

  app.get("/api/fhir-analytics/patients", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const patients = aiFHIRAnalyticsService.getSamplePatients();
      await logRouteAudit(userId, "list_patients", "Patient", true, { count: patients.length }, req);
      res.json({ patients });
    } catch (error) {
      await logRouteAudit(userId, "list_patients", "Patient", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Get patients error:", error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  });

  app.get("/api/fhir-analytics/predictions", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const predictions = aiFHIRAnalyticsService.getPredictiveModels();
      await logRouteAudit(userId, "list_predictions", "PredictiveModel", true, { count: predictions.length }, req);
      res.json({ predictions });
    } catch (error) {
      await logRouteAudit(userId, "list_predictions", "PredictiveModel", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Get predictions error:", error);
      res.status(500).json({ error: "Failed to get predictions" });
    }
  });

  app.post("/api/fhir-analytics/predictions", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = predictiveModelSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "create_prediction", "PredictiveModel", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { patientId, modelType } = validation.data;
      const result = await aiFHIRAnalyticsService.generatePredictiveModel(userId, patientId, modelType);

      await logRouteAudit(userId, "create_prediction", "PredictiveModel", true, {
        predictionId: result.id,
        patientId,
        modelType,
        probability: result.prediction.probability,
      }, req);
      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "create_prediction", "PredictiveModel", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Generate prediction error:", error);
      res.status(500).json({
        error: "Failed to generate prediction",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/fhir-analytics/predictions/:id", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const deleted = aiFHIRAnalyticsService.deletePrediction(userId, req.params.id);
      if (!deleted) {
        await logRouteAudit(userId, "delete_prediction", "PredictiveModel", false, { error: "Not found" }, req);
        res.status(404).json({ error: "Prediction not found" });
        return;
      }

      await logRouteAudit(userId, "delete_prediction", "PredictiveModel", true, { predictionId: req.params.id }, req);
      res.json({ success: true });
    } catch (error) {
      await logRouteAudit(userId, "delete_prediction", "PredictiveModel", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Delete prediction error:", error);
      res.status(500).json({ error: "Failed to delete prediction" });
    }
  });

  app.get("/api/fhir-analytics/trends", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const trends = aiFHIRAnalyticsService.getPopulationTrends();
      await logRouteAudit(userId, "list_trends", "PopulationHealthTrend", true, { count: trends.length }, req);
      res.json({ trends });
    } catch (error) {
      await logRouteAudit(userId, "list_trends", "PopulationHealthTrend", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Get trends error:", error);
      res.status(500).json({ error: "Failed to get trends" });
    }
  });

  app.post("/api/fhir-analytics/trends", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = populationTrendSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "create_trend", "PopulationHealthTrend", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { trendType, condition, timeRangeMonths } = validation.data;
      const result = await aiFHIRAnalyticsService.analyzePopulationHealthTrends(
        userId,
        trendType,
        condition,
        timeRangeMonths
      );

      await logRouteAudit(userId, "create_trend", "PopulationHealthTrend", true, {
        trendId: result.id,
        trendType,
        condition,
        trend: result.statistics.trend,
        percentChange: result.statistics.percentChange,
      }, req);
      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "create_trend", "PopulationHealthTrend", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Analyze trends error:", error);
      res.status(500).json({
        error: "Failed to analyze trends",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/fhir-analytics/trends/:id", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const deleted = aiFHIRAnalyticsService.deleteTrend(userId, req.params.id);
      if (!deleted) {
        await logRouteAudit(userId, "delete_trend", "PopulationHealthTrend", false, { error: "Not found" }, req);
        res.status(404).json({ error: "Trend not found" });
        return;
      }

      await logRouteAudit(userId, "delete_trend", "PopulationHealthTrend", true, { trendId: req.params.id }, req);
      res.json({ success: true });
    } catch (error) {
      await logRouteAudit(userId, "delete_trend", "PopulationHealthTrend", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Delete trend error:", error);
      res.status(500).json({ error: "Failed to delete trend" });
    }
  });

  app.get("/api/fhir-analytics/reports", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const reports = aiFHIRAnalyticsService.getNLReports();
      await logRouteAudit(userId, "list_reports", "NaturalLanguageReport", true, { count: reports.length }, req);
      res.json({ reports });
    } catch (error) {
      await logRouteAudit(userId, "list_reports", "NaturalLanguageReport", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Get reports error:", error);
      res.status(500).json({ error: "Failed to get reports" });
    }
  });

  app.post("/api/fhir-analytics/reports", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const validation = nlReportSchema.safeParse(req.body);
      if (!validation.success) {
        await logRouteAudit(userId, "create_report", "NaturalLanguageReport", false, { error: "Validation failed" }, req);
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { reportType, patientId, condition, timeRange } = validation.data;
      const result = await aiFHIRAnalyticsService.generateNaturalLanguageReport(userId, reportType, {
        patientId,
        condition,
        timeRange,
      });

      await logRouteAudit(userId, "create_report", "NaturalLanguageReport", true, {
        reportId: result.id,
        reportType,
        patientId,
        condition,
        title: result.title,
      }, req);
      res.json(result);
    } catch (error) {
      await logRouteAudit(userId, "create_report", "NaturalLanguageReport", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Generate report error:", error);
      res.status(500).json({
        error: "Failed to generate report",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/fhir-analytics/reports/:id", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const deleted = aiFHIRAnalyticsService.deleteReport(userId, req.params.id);
      if (!deleted) {
        await logRouteAudit(userId, "delete_report", "NaturalLanguageReport", false, { error: "Not found" }, req);
        res.status(404).json({ error: "Report not found" });
        return;
      }

      await logRouteAudit(userId, "delete_report", "NaturalLanguageReport", true, { reportId: req.params.id }, req);
      res.json({ success: true });
    } catch (error) {
      await logRouteAudit(userId, "delete_report", "NaturalLanguageReport", false, { error: error instanceof Error ? error.message : "Unknown" }, req);
      console.error("[AIFHIRAnalytics] Delete report error:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  console.log("[Routes] AI FHIR Analytics routes registered at /api/fhir-analytics/*");
}
