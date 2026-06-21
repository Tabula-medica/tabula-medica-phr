import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiPredictiveRiskEngineService } from "./services/ai-predictive-risk-engine";
import { createHash } from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT][PredictiveRisk] ${action}`, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

const entityScoreFiltersSchema = z.object({
  entityType: z.enum(["user", "system", "data_type", "department", "integration"]).optional(),
  minRiskScore: z.string().transform(s => parseInt(s, 10)).optional(),
  trend: z.enum(["increasing", "stable", "decreasing"]).optional(),
});

const predictionFiltersSchema = z.object({
  type: z.enum(["violation", "breach", "audit_failure", "policy_gap", "access_anomaly"]).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  status: z.enum(["not_started", "in_progress", "mitigated", "prevented", "occurred"]).optional(),
});

router.get("/entity-scores", async (req: Request, res: Response) => {
  try {
    const parseResult = entityScoreFiltersSchema.safeParse(req.query);
    const filters = parseResult.success ? parseResult.data : {};

    logHipaaAudit("LIST_ENTITY_SCORES", { filters });

    const scores = aiPredictiveRiskEngineService.getEntityScores(filters);

    res.json({
      success: true,
      scores,
      count: scores.length,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error listing entity scores:", error);
    res.status(500).json({ success: false, error: "Failed to list entity scores" });
  }
});

router.get("/predictions", async (req: Request, res: Response) => {
  try {
    const parseResult = predictionFiltersSchema.safeParse(req.query);
    const filters = parseResult.success ? parseResult.data : {};

    logHipaaAudit("LIST_PREDICTIONS", { filters });

    const predictions = aiPredictiveRiskEngineService.getPredictions(filters);

    res.json({
      success: true,
      predictions,
      count: predictions.length,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error listing predictions:", error);
    res.status(500).json({ success: false, error: "Failed to list predictions" });
  }
});

router.get("/patterns", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_PATTERNS", {});

    const patterns = aiPredictiveRiskEngineService.getPatterns();

    res.json({
      success: true,
      patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error listing patterns:", error);
    res.status(500).json({ success: false, error: "Failed to list patterns" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_REPORTS", {});

    const reports = aiPredictiveRiskEngineService.getReports();

    res.json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error listing reports:", error);
    res.status(500).json({ success: false, error: "Failed to list reports" });
  }
});

const calculateScoreSchema = z.object({
  entityType: z.enum(["user", "system", "data_type", "department", "integration"]),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  horizon: z.enum(["7_days", "30_days", "90_days"]).optional(),
});

router.post("/calculate-score", async (req: Request, res: Response) => {
  try {
    const parseResult = calculateScoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { entityType, entityId, entityName, horizon } = parseResult.data;
    const hashedEntityId = hashIdentifier(entityId);

    logHipaaAudit("CALCULATE_RISK_SCORE", { entityType, hashedEntityId, horizon });

    const score = await aiPredictiveRiskEngineService.calculateEntityRiskScore(
      entityType,
      hashedEntityId,
      entityName,
      horizon || "30_days"
    );

    res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error calculating score:", error);
    res.status(500).json({ success: false, error: "Failed to calculate risk score" });
  }
});

const ingestDataSchema = z.object({
  entityType: z.enum(["user", "system", "data_type", "department", "integration"]),
  entityId: z.string().min(1),
  metric: z.string().min(1),
  value: z.number(),
  source: z.enum(["audit_log", "policy_violation", "risk_assessment", "alert", "incident"]),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/ingest-data", async (req: Request, res: Response) => {
  try {
    const parseResult = ingestDataSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { entityType, entityId, metric, value, source, metadata } = parseResult.data;
    const hashedEntityId = hashIdentifier(entityId);

    logHipaaAudit("INGEST_DATA", { entityType, hashedEntityId, metric, source });

    const dataPoint = await aiPredictiveRiskEngineService.ingestHistoricalData({
      entityType,
      entityId: hashedEntityId,
      timestamp: new Date(),
      metric,
      value,
      source,
      metadata: metadata || {},
    });

    res.json({
      success: true,
      dataPoint,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error ingesting data:", error);
    res.status(500).json({ success: false, error: "Failed to ingest data" });
  }
});

router.post("/analyze-patterns", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("ANALYZE_PATTERNS", {});

    const patterns = await aiPredictiveRiskEngineService.analyzePatterns();

    res.json({
      success: true,
      newPatterns: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error analyzing patterns:", error);
    res.status(500).json({ success: false, error: "Failed to analyze patterns" });
  }
});

const generatePredictionSchema = z.object({
  predictionType: z.enum(["violation", "breach", "audit_failure", "policy_gap", "access_anomaly"]),
  affectedEntities: z.array(z.object({
    type: z.enum(["user", "system", "data_type", "department", "integration"]),
    id: z.string().min(1),
    name: z.string().min(1),
  })),
});

router.post("/generate-prediction", async (req: Request, res: Response) => {
  try {
    const parseResult = generatePredictionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { predictionType, affectedEntities } = parseResult.data;

    logHipaaAudit("GENERATE_PREDICTION", { 
      predictionType, 
      entityCount: affectedEntities.length,
    });

    const hashedEntities = affectedEntities.map(e => ({
      ...e,
      id: hashIdentifier(e.id),
    }));

    const prediction = await aiPredictiveRiskEngineService.generateRiskPrediction(
      predictionType,
      hashedEntities
    );

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error generating prediction:", error);
    res.status(500).json({ success: false, error: "Failed to generate prediction" });
  }
});

const generateReportSchema = z.object({
  forecastDays: z.number().min(7).max(365).optional(),
});

router.post("/generate-report", async (req: Request, res: Response) => {
  try {
    const parseResult = generateReportSchema.safeParse(req.body);
    const forecastDays = parseResult.success ? parseResult.data.forecastDays : 30;

    logHipaaAudit("GENERATE_FORECAST_REPORT", { forecastDays });

    const report = await aiPredictiveRiskEngineService.generateForecastReport(forecastDays);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error generating report:", error);
    res.status(500).json({ success: false, error: "Failed to generate forecast report" });
  }
});

const updatePredictionSchema = z.object({
  status: z.enum(["not_started", "in_progress", "mitigated", "prevented", "occurred"]),
});

router.patch("/predictions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updatePredictionSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { status } = parseResult.data;

    logHipaaAudit("UPDATE_PREDICTION_STATUS", { predictionId: id, status });

    const prediction = await aiPredictiveRiskEngineService.updatePredictionStatus(id, status);

    if (!prediction) {
      return res.status(404).json({ success: false, error: "Prediction not found" });
    }

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error updating prediction:", error);
    res.status(500).json({ success: false, error: "Failed to update prediction" });
  }
});

const updateMeasureSchema = z.object({
  measureId: z.string().min(1),
  status: z.enum(["suggested", "approved", "in_progress", "completed", "rejected"]),
});

router.patch("/entity-scores/:id/measures", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateMeasureSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { measureId, status } = parseResult.data;

    logHipaaAudit("UPDATE_MEASURE_STATUS", { scoreId: id, measureId, status });

    const score = await aiPredictiveRiskEngineService.updateMeasureStatus(id, measureId, status);

    if (!score) {
      return res.status(404).json({ success: false, error: "Entity score not found" });
    }

    res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error updating measure:", error);
    res.status(500).json({ success: false, error: "Failed to update preventative measure" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("GET_DASHBOARD", {});

    const metrics = aiPredictiveRiskEngineService.getDashboardMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("[PredictiveRisk] Error getting dashboard:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

export default router;
