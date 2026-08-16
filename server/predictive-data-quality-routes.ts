import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { predictiveDataQualityAI } from "./services/predictive-data-quality-ai";
import { createHash } from "crypto";

import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

const sanitizePhi = (text: string): string => {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${createHash("sha256").update(match).digest("hex").substring(0, 8)}]`
    );
};

const logAuditEvent = (
  action: string,
  resource: string,
  userId: string = "system",
  details: Record<string, unknown> = {}
): void => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId,
    component: "PredictiveDataQualityAPI",
    details: sanitizePhi(JSON.stringify(details)),
  };
  console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
};

const analyzeTrendSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(["patient", "resource_type", "connection"]),
  targetName: z.string().optional(),
});

router.post("/trends/analyze", async (req: Request, res: Response) => {
  try {
    const validation = analyzeTrendSchema.safeParse(req.body);
    if (!validation.success) {
      logAuditEvent("TREND_ANALYSIS_VALIDATION_ERROR", "trends", "api", {
        errors: validation.error.format(),
      });
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.format(),
      });
    }

    const { targetId, targetType, targetName } = validation.data;
    logAuditEvent("TREND_ANALYSIS_REQUESTED", "trends", "api", {
      targetType,
      targetId: sanitizePhi(targetId),
    });

    const trend = await predictiveDataQualityAI.analyzeTrend(
      targetId,
      targetType,
      targetName || targetId
    );

    if (!trend) {
      return res.status(404).json({
        success: false,
        error: "No data available for trend analysis",
      });
    }

    logAuditEvent("TREND_ANALYSIS_COMPLETED", "trends", "api", {
      targetType,
      trendDirection: trend.trendDirection,
      volatility: trend.volatility,
    });

    res.json({ success: true, data: trend });
  } catch (error) {
    logAuditEvent("TREND_ANALYSIS_ERROR", "trends", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to analyze trend",
    });
  }
});

const generatePredictionSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(["patient", "resource_type", "connection"]),
  targetName: z.string().optional(),
  horizonDays: z.number().min(1).max(90).optional(),
});

router.post("/predictions/generate", async (req: Request, res: Response) => {
  try {
    const validation = generatePredictionSchema.safeParse(req.body);
    if (!validation.success) {
      logAuditEvent("PREDICTION_VALIDATION_ERROR", "predictions", "api", {
        errors: validation.error.format(),
      });
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.format(),
      });
    }

    const { targetId, targetType, targetName, horizonDays } = validation.data;
    logAuditEvent("PREDICTION_REQUESTED", "predictions", "api", {
      targetType,
      targetId: sanitizePhi(targetId),
      horizonDays,
    });

    const prediction = await predictiveDataQualityAI.generatePrediction(
      targetId,
      targetType,
      targetName || targetId,
      horizonDays ? `${horizonDays}d` : undefined
    );

    if (!prediction) {
      return res.status(400).json({
        success: false,
        error: "Failed to generate prediction - insufficient data",
      });
    }

    logAuditEvent("PREDICTION_GENERATED", "predictions", "api", {
      predictionId: prediction.id,
      targetType,
      riskLevel: prediction.riskLevel,
      confidence: prediction.confidence,
    });

    res.json({ success: true, data: prediction });
  } catch (error) {
    logAuditEvent("PREDICTION_ERROR", "predictions", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to generate prediction",
    });
  }
});

const listPredictionsSchema = z.object({
  targetType: z.enum(["patient", "resource_type", "connection"]).optional(),
  riskLevel: z.enum(["critical", "high", "medium", "low", "minimal"]).optional(),
  activeOnly: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
});

router.get("/predictions", async (req: Request, res: Response) => {
  try {
    const query = {
      targetType: req.query.targetType as string | undefined,
      riskLevel: req.query.riskLevel as string | undefined,
      activeOnly: req.query.activeOnly === "true",
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const validation = listPredictionsSchema.safeParse(query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: validation.error.format(),
      });
    }

    logAuditEvent("PREDICTIONS_LIST_REQUESTED", "predictions", "api", query);

    const predictions = await predictiveDataQualityAI.listPredictions(
      validation.data as Parameters<typeof predictiveDataQualityAI.listPredictions>[0]
    );

    res.json({
      success: true,
      data: predictions,
      count: predictions.length,
    });
  } catch (error) {
    logAuditEvent("PREDICTIONS_LIST_ERROR", "predictions", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to list predictions",
    });
  }
});

router.get("/predictions/:predictionId", async (req: Request, res: Response) => {
  try {
    const { predictionId } = req.params;
    logAuditEvent("PREDICTION_RETRIEVED", "predictions", "api", { predictionId });

    const prediction = await predictiveDataQualityAI.getPrediction(predictionId);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: "Prediction not found",
      });
    }

    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get prediction",
    });
  }
});

router.patch("/predictions/:predictionId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { predictionId } = req.params;
    const { acknowledgedBy } = req.body;

    logAuditEvent("PREDICTION_ACKNOWLEDGED", "predictions", acknowledgedBy || "api", {
      predictionId,
    });

    const updated = await predictiveDataQualityAI.acknowledgePrediction(
      predictionId,
      getUserId(req)
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Prediction not found",
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to acknowledge prediction",
    });
  }
});

const listAlertsSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  alertType: z.enum(["quality_degradation", "pattern_anomaly", "threshold_breach", "trend_reversal"]).optional(),
  activeOnly: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const query = {
      severity: req.query.severity as string | undefined,
      alertType: req.query.alertType as string | undefined,
      activeOnly: req.query.activeOnly === "true",
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const validation = listAlertsSchema.safeParse(query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: validation.error.format(),
      });
    }

    logAuditEvent("ALERTS_LIST_REQUESTED", "alerts", "api", query);

    const alerts = await predictiveDataQualityAI.listProactiveAlerts(
      validation.data as Parameters<typeof predictiveDataQualityAI.listProactiveAlerts>[0]
    );

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to list alerts",
    });
  }
});

router.get("/alerts/:alertId", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    logAuditEvent("ALERT_RETRIEVED", "alerts", "api", { alertId });

    const alert = await predictiveDataQualityAI.getProactiveAlert(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get alert",
    });
  }
});

router.patch("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;

    logAuditEvent("ALERT_ACKNOWLEDGED", "alerts", acknowledgedBy || "api", { alertId });

    const updated = await predictiveDataQualityAI.acknowledgeProactiveAlert(
      alertId,
      getUserId(req)
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to acknowledge alert",
    });
  }
});

router.patch("/alerts/:alertId/resolve", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy, resolutionNotes } = req.body;

    logAuditEvent("ALERT_RESOLVED", "alerts", resolvedBy || "api", {
      alertId,
      hasNotes: !!resolutionNotes,
    });

    const updated = await predictiveDataQualityAI.resolveProactiveAlert(
      alertId,
      getUserId(req),
      resolutionNotes
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to resolve alert",
    });
  }
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logAuditEvent("DASHBOARD_ACCESSED", "dashboard", "api", {});

    const dashboard = await predictiveDataQualityAI.getDashboard();

    res.json({ success: true, data: dashboard });
  } catch (error) {
    logAuditEvent("DASHBOARD_ERROR", "dashboard", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to get dashboard",
    });
  }
});

router.get("/config", async (_req: Request, res: Response) => {
  try {
    logAuditEvent("CONFIG_LIST_REQUESTED", "config", "api", {});

    const configs = await predictiveDataQualityAI.listConfigs();

    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to list configurations",
    });
  }
});

router.get("/config/:configId", async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    logAuditEvent("CONFIG_RETRIEVED", "config", "api", { configId });

    const config = await predictiveDataQualityAI.getConfig(configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: "Configuration not found",
      });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get configuration",
    });
  }
});

const createConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  targetTypes: z.array(z.enum(["patient", "resource_type", "connection", "data_source"])).optional(),
  predictionHorizons: z.array(z.string()).optional(),
  riskThresholds: z.object({
    critical: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    low: z.number().min(0).max(100),
  }).optional(),
  minDataPoints: z.number().min(1).max(365).optional(),
  retrainIntervalHours: z.number().min(1).max(168).optional(),
  alertOnRiskLevel: z.enum(["critical", "high", "medium", "low", "minimal"]).optional(),
  notificationChannels: z.array(z.enum(["in_app", "email", "webhook"])).optional(),
});

router.post("/config", async (req: Request, res: Response) => {
  try {
    const validation = createConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.format(),
      });
    }

    logAuditEvent("CONFIG_CREATED", "config", "api", {
      name: validation.data.name,
      enabled: validation.data.enabled,
    });

    const config = await predictiveDataQualityAI.createConfig(validation.data);

    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to create configuration",
    });
  }
});

router.patch("/config/:configId", async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const validation = createConfigSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.format(),
      });
    }

    logAuditEvent("CONFIG_UPDATED", "config", "api", {
      configId,
      updates: Object.keys(validation.data),
    });

    const updated = await predictiveDataQualityAI.updateConfig(
      configId,
      validation.data
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Configuration not found",
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update configuration",
    });
  }
});

router.post("/cycle/run", async (_req: Request, res: Response) => {
  try {
    logAuditEvent("PREDICTION_CYCLE_STARTED", "cycle", "api", {});

    const result = await predictiveDataQualityAI.runPredictionCycle();

    logAuditEvent("PREDICTION_CYCLE_COMPLETED", "cycle", "api", result);

    res.json({ success: true, data: result });
  } catch (error) {
    logAuditEvent("PREDICTION_CYCLE_ERROR", "cycle", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to run prediction cycle",
    });
  }
});

router.get("/model/metrics", async (_req: Request, res: Response) => {
  try {
    logAuditEvent("MODEL_METRICS_REQUESTED", "model", "api", {});

    const metrics = await predictiveDataQualityAI.getModelMetrics();

    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get model metrics",
    });
  }
});

router.post("/model/train", async (_req: Request, res: Response) => {
  try {
    logAuditEvent("MODEL_TRAINING_STARTED", "model", "api", {});

    const result = await predictiveDataQualityAI.trainModel();

    logAuditEvent("MODEL_TRAINING_COMPLETED", "model", "api", {
      success: result.success,
      samplesProcessed: result.samplesProcessed,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logAuditEvent("MODEL_TRAINING_ERROR", "model", "api", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to train model",
    });
  }
});

export default router;
