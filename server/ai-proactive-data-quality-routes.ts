import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import {
  getDriftMetrics,
  getDriftMetric,
  getAnomalyPatterns,
  getAnomalyPattern,
  getIntegrityRisks,
  getIntegrityRisk,
  getQualityAlerts,
  getQualityAlert,
  updateAlertStatus,
  getLatestSnapshot,
  getSnapshotHistory,
  getMonitoringConfig,
  updateMonitoringConfig,
  triggerManualScan,
  getAIAnalysis,
  getDashboardSummary,
  startMonitoring,
  stopMonitoring,
  generateDataQualityForecast,
  getQualityForecasts,
  getQualityForecast,
  generateAllForecasts,
  correlateAlertWithFailures,
  getAlertCorrelations,
  getAlertCorrelation,
  getCorrelationForAlert,
  generateNarrativeSummary,
  getNarrativeSummaries,
  getNarrativeSummary,
  getIngestionFailures,
  getHarmonizationFailures,
  recordIngestionFailure,
  recordHarmonizationFailure,
  getPredictiveInsights,
} from "./services/ai-proactive-data-quality";

const ForecastRequestSchema = z.object({
  metricId: z.string().min(1),
  horizon: z.enum(["7_days", "14_days", "30_days"]).optional(),
});

const NarrativeRequestSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(["alert", "drift", "anomaly", "risk", "forecast", "dashboard"]),
  audienceLevel: z.enum(["executive", "technical", "researcher", "general"]).optional(),
  summaryType: z.enum(["issue_explanation", "trend_analysis", "impact_assessment", "root_cause", "comprehensive"]).optional(),
});

const IngestionFailureSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  sourceId: z.string().min(1),
  failureType: z.enum(["schema_mismatch", "missing_required_field", "invalid_value", "duplicate_detected", "reference_not_found"]),
  timestamp: z.string(),
  affectedRecordCount: z.number().min(0),
  errorMessage: z.string().min(1),
  sampleRecordIds: z.array(z.string()),
});

const HarmonizationFailureSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  sourceId: z.string().min(1),
  targetStandard: z.enum(["FHIR_R4", "HL7_v2", "CDA", "custom"]),
  failureType: z.enum(["mapping_not_found", "transformation_error", "code_system_mismatch", "terminology_conflict", "structural_incompatibility"]),
  timestamp: z.string(),
  affectedRecordCount: z.number().min(0),
  errorMessage: z.string().min(1),
  originalValue: z.string(),
  expectedFormat: z.string(),
});

const router = Router();

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA_AUDIT] ${timestamp} | ${action} | ${JSON.stringify(details)}`);
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const summary = getDashboardSummary();
    logHipaaAudit("DATA_QUALITY_DASHBOARD_VIEWED", { 
      overallScore: summary.overallScore, 
      openAlerts: summary.openAlerts.total 
    });
    res.json(summary);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/snapshot", async (_req: Request, res: Response) => {
  try {
    const snapshot = getLatestSnapshot();
    if (!snapshot) {
      return res.status(404).json({ error: "No snapshot available" });
    }
    logHipaaAudit("DATA_QUALITY_SNAPSHOT_VIEWED", { 
      snapshotId: hashIdentifier(snapshot.id), 
      timestamp: snapshot.timestamp 
    });
    res.json(snapshot);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Snapshot error:", error);
    res.status(500).json({ error: "Failed to get snapshot" });
  }
});

router.get("/snapshots", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 24;
    const snapshots = getSnapshotHistory(limit);
    logHipaaAudit("DATA_QUALITY_SNAPSHOT_HISTORY_VIEWED", { count: snapshots.length, limit });
    res.json(snapshots);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Snapshots error:", error);
    res.status(500).json({ error: "Failed to get snapshots" });
  }
});

router.get("/drift-metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = getDriftMetrics();
    logHipaaAudit("DRIFT_METRICS_VIEWED", { count: metrics.length });
    res.json(metrics);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Drift metrics error:", error);
    res.status(500).json({ error: "Failed to get drift metrics" });
  }
});

router.get("/drift-metrics/:id", async (req: Request, res: Response) => {
  try {
    const metric = getDriftMetric(req.params.id);
    if (!metric) {
      return res.status(404).json({ error: "Drift metric not found" });
    }
    logHipaaAudit("DRIFT_METRIC_VIEWED", { metricId: hashIdentifier(req.params.id) });
    res.json(metric);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Drift metric error:", error);
    res.status(500).json({ error: "Failed to get drift metric" });
  }
});

router.get("/anomaly-patterns", async (_req: Request, res: Response) => {
  try {
    const patterns = getAnomalyPatterns();
    logHipaaAudit("ANOMALY_PATTERNS_VIEWED", { count: patterns.length });
    res.json(patterns);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Anomaly patterns error:", error);
    res.status(500).json({ error: "Failed to get anomaly patterns" });
  }
});

router.get("/anomaly-patterns/:id", async (req: Request, res: Response) => {
  try {
    const pattern = getAnomalyPattern(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: "Anomaly pattern not found" });
    }
    logHipaaAudit("ANOMALY_PATTERN_VIEWED", { patternId: hashIdentifier(req.params.id) });
    res.json(pattern);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Anomaly pattern error:", error);
    res.status(500).json({ error: "Failed to get anomaly pattern" });
  }
});

router.get("/integrity-risks", async (_req: Request, res: Response) => {
  try {
    const risks = getIntegrityRisks();
    logHipaaAudit("INTEGRITY_RISKS_VIEWED", { count: risks.length });
    res.json(risks);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Integrity risks error:", error);
    res.status(500).json({ error: "Failed to get integrity risks" });
  }
});

router.get("/integrity-risks/:id", async (req: Request, res: Response) => {
  try {
    const risk = getIntegrityRisk(req.params.id);
    if (!risk) {
      return res.status(404).json({ error: "Integrity risk not found" });
    }
    logHipaaAudit("INTEGRITY_RISK_VIEWED", { riskId: hashIdentifier(req.params.id) });
    res.json(risk);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Integrity risk error:", error);
    res.status(500).json({ error: "Failed to get integrity risk" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.alertType) filters.alertType = req.query.alertType;
    if (req.query.sourceId) filters.sourceId = req.query.sourceId;
    if (req.query.resourceType) filters.resourceType = req.query.resourceType;

    const alerts = getQualityAlerts(Object.keys(filters).length > 0 ? filters : undefined);
    logHipaaAudit("QUALITY_ALERTS_VIEWED", { count: alerts.length, filters });
    res.json(alerts);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Alerts error:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

router.get("/alerts/:id", async (req: Request, res: Response) => {
  try {
    const alert = getQualityAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    logHipaaAudit("QUALITY_ALERT_VIEWED", { alertId: hashIdentifier(req.params.id) });
    res.json(alert);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Alert error:", error);
    res.status(500).json({ error: "Failed to get alert" });
  }
});

router.patch("/alerts/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, userId } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatuses = ["open", "acknowledged", "investigating", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const alert = updateAlertStatus(req.params.id, status, userId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    logHipaaAudit("QUALITY_ALERT_STATUS_UPDATED_VIA_API", { 
      alertId: hashIdentifier(req.params.id), 
      newStatus: status 
    });
    res.json(alert);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Update alert status error:", error);
    res.status(500).json({ error: "Failed to update alert status" });
  }
});

router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = getMonitoringConfig();
    logHipaaAudit("MONITORING_CONFIG_VIEWED", { configId: config.id, enabled: config.enabled });
    res.json(config);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Config error:", error);
    res.status(500).json({ error: "Failed to get monitoring config" });
  }
});

router.patch("/config", async (req: Request, res: Response) => {
  try {
    const config = updateMonitoringConfig(req.body);
    logHipaaAudit("MONITORING_CONFIG_UPDATED_VIA_API", { configId: config.id });
    res.json(config);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Update config error:", error);
    res.status(500).json({ error: "Failed to update monitoring config" });
  }
});

router.post("/scan", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("MANUAL_SCAN_TRIGGERED", {});
    const result = await triggerManualScan();
    res.json(result);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Manual scan error:", error);
    res.status(500).json({ error: "Failed to run manual scan" });
  }
});

router.get("/ai-analysis", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("AI_ANALYSIS_REQUESTED", {});
    const analysis = await getAIAnalysis();
    res.json(analysis);
  } catch (error) {
    console.error("[ProactiveQualityRoutes] AI analysis error:", error);
    res.status(500).json({ error: "Failed to get AI analysis" });
  }
});

router.post("/monitoring/start", async (_req: Request, res: Response) => {
  try {
    startMonitoring();
    logHipaaAudit("MONITORING_STARTED_VIA_API", {});
    res.json({ success: true, message: "Monitoring started" });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Start monitoring error:", error);
    res.status(500).json({ error: "Failed to start monitoring" });
  }
});

router.post("/monitoring/stop", async (_req: Request, res: Response) => {
  try {
    stopMonitoring();
    logHipaaAudit("MONITORING_STOPPED_VIA_API", {});
    res.json({ success: true, message: "Monitoring stopped" });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Stop monitoring error:", error);
    res.status(500).json({ error: "Failed to stop monitoring" });
  }
});

router.get("/forecasts", async (_req: Request, res: Response) => {
  try {
    const forecasts = getQualityForecasts();
    logHipaaAudit("DATA_QUALITY_FORECASTS_VIEWED", { count: forecasts.length });
    res.json({ success: true, forecasts, noCdsCompliance: "Predictive analytics for operational planning only. No clinical decision support provided." });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get forecasts error:", error);
    res.status(500).json({ error: "Failed to get forecasts" });
  }
});

router.get("/forecasts/:id", async (req: Request, res: Response) => {
  try {
    const forecast = getQualityForecast(req.params.id);
    if (!forecast) {
      return res.status(404).json({ error: "Forecast not found" });
    }
    logHipaaAudit("DATA_QUALITY_FORECAST_VIEWED", { forecastId: hashIdentifier(req.params.id) });
    res.json({ success: true, forecast });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get forecast error:", error);
    res.status(500).json({ error: "Failed to get forecast" });
  }
});

router.post("/forecasts/generate", async (req: Request, res: Response) => {
  try {
    const parseResult = ForecastRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("FORECAST_GENERATION_VALIDATION_FAILED", { errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
    }
    const { metricId, horizon } = parseResult.data;
    const forecast = await generateDataQualityForecast(metricId, horizon || "7_days");
    if (!forecast) {
      return res.status(404).json({ error: "Metric not found or insufficient trend data" });
    }
    logHipaaAudit("DATA_QUALITY_FORECAST_GENERATED_VIA_API", { forecastId: hashIdentifier(forecast.id), metricId: hashIdentifier(metricId) });
    res.json({ success: true, forecast });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Generate forecast error:", error);
    res.status(500).json({ error: "Failed to generate forecast" });
  }
});

router.post("/forecasts/generate-all", async (req: Request, res: Response) => {
  try {
    const horizon = (req.query.horizon as "7_days" | "14_days" | "30_days") || "7_days";
    const forecasts = await generateAllForecasts(horizon);
    logHipaaAudit("ALL_FORECASTS_GENERATED_VIA_API", { count: forecasts.length, horizon });
    res.json({ success: true, forecasts, noCdsCompliance: "Predictive analytics for operational planning only. No clinical decision support provided." });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Generate all forecasts error:", error);
    res.status(500).json({ error: "Failed to generate forecasts" });
  }
});

router.get("/predictive-insights", async (_req: Request, res: Response) => {
  try {
    const insights = await getPredictiveInsights();
    logHipaaAudit("PREDICTIVE_INSIGHTS_VIEWED", { forecastCount: insights.forecasts.length, highRiskCount: insights.highRiskMetrics.length });
    res.json({ success: true, ...insights });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Predictive insights error:", error);
    res.status(500).json({ error: "Failed to get predictive insights" });
  }
});

router.get("/correlations", async (_req: Request, res: Response) => {
  try {
    const correlations = getAlertCorrelations();
    logHipaaAudit("ALERT_CORRELATIONS_VIEWED", { count: correlations.length });
    res.json({ success: true, correlations, noCdsCompliance: "Alert correlation for operational troubleshooting only. No clinical decision support provided." });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get correlations error:", error);
    res.status(500).json({ error: "Failed to get correlations" });
  }
});

router.get("/correlations/:id", async (req: Request, res: Response) => {
  try {
    const correlation = getAlertCorrelation(req.params.id);
    if (!correlation) {
      return res.status(404).json({ error: "Correlation not found" });
    }
    logHipaaAudit("ALERT_CORRELATION_VIEWED", { correlationId: hashIdentifier(req.params.id) });
    res.json({ success: true, correlation });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get correlation error:", error);
    res.status(500).json({ error: "Failed to get correlation" });
  }
});

router.post("/correlations/analyze", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.body;
    if (!alertId || typeof alertId !== "string") {
      return res.status(400).json({ error: "alertId is required" });
    }
    const correlation = await correlateAlertWithFailures(alertId);
    if (!correlation) {
      return res.status(404).json({ error: "Alert not found" });
    }
    logHipaaAudit("ALERT_CORRELATION_ANALYZED_VIA_API", { correlationId: hashIdentifier(correlation.id), alertId: hashIdentifier(alertId) });
    res.json({ success: true, correlation });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Analyze correlation error:", error);
    res.status(500).json({ error: "Failed to analyze alert correlation" });
  }
});

router.get("/alerts/:alertId/correlation", async (req: Request, res: Response) => {
  try {
    let correlation = getCorrelationForAlert(req.params.alertId);
    if (!correlation) {
      correlation = await correlateAlertWithFailures(req.params.alertId);
    }
    if (!correlation) {
      return res.status(404).json({ error: "Alert not found or no correlation available" });
    }
    logHipaaAudit("ALERT_CORRELATION_RETRIEVED", { alertId: hashIdentifier(req.params.alertId) });
    res.json({ success: true, correlation });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get alert correlation error:", error);
    res.status(500).json({ error: "Failed to get alert correlation" });
  }
});

router.get("/narratives", async (_req: Request, res: Response) => {
  try {
    const narratives = getNarrativeSummaries();
    logHipaaAudit("NARRATIVE_SUMMARIES_VIEWED", { count: narratives.length });
    res.json({ success: true, narratives, noCdsCompliance: "Narrative summaries for informational purposes only. No clinical decision support provided." });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get narratives error:", error);
    res.status(500).json({ error: "Failed to get narratives" });
  }
});

router.get("/narratives/:id", async (req: Request, res: Response) => {
  try {
    const narrative = getNarrativeSummary(req.params.id);
    if (!narrative) {
      return res.status(404).json({ error: "Narrative not found" });
    }
    logHipaaAudit("NARRATIVE_SUMMARY_VIEWED", { narrativeId: hashIdentifier(req.params.id) });
    res.json({ success: true, narrative });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get narrative error:", error);
    res.status(500).json({ error: "Failed to get narrative" });
  }
});

router.post("/narratives/generate", async (req: Request, res: Response) => {
  try {
    const parseResult = NarrativeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("NARRATIVE_GENERATION_VALIDATION_FAILED", { errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid request", details: parseResult.error.issues });
    }
    const { entityId, entityType, audienceLevel, summaryType } = parseResult.data;
    const narrative = await generateNarrativeSummary(entityId, entityType, audienceLevel || "general", summaryType || "issue_explanation");
    if (!narrative) {
      return res.status(404).json({ error: "Entity not found" });
    }
    logHipaaAudit("NARRATIVE_SUMMARY_GENERATED_VIA_API", { narrativeId: hashIdentifier(narrative.id), entityType, audienceLevel });
    res.json({ success: true, narrative });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Generate narrative error:", error);
    res.status(500).json({ error: "Failed to generate narrative" });
  }
});

router.get("/failures/ingestion", async (_req: Request, res: Response) => {
  try {
    const failures = getIngestionFailures();
    logHipaaAudit("INGESTION_FAILURES_VIEWED", { count: failures.length });
    res.json({ success: true, failures });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get ingestion failures error:", error);
    res.status(500).json({ error: "Failed to get ingestion failures" });
  }
});

router.post("/failures/ingestion", async (req: Request, res: Response) => {
  try {
    const parseResult = IngestionFailureSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("INGESTION_FAILURE_VALIDATION_FAILED", { errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid failure data", details: parseResult.error.issues });
    }
    const failure = recordIngestionFailure(parseResult.data);
    logHipaaAudit("INGESTION_FAILURE_RECORDED_VIA_API", { failureId: hashIdentifier(failure.id), ruleId: failure.ruleId });
    res.status(201).json({ success: true, failure });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Record ingestion failure error:", error);
    res.status(500).json({ error: "Failed to record ingestion failure" });
  }
});

router.get("/failures/harmonization", async (_req: Request, res: Response) => {
  try {
    const failures = getHarmonizationFailures();
    logHipaaAudit("HARMONIZATION_FAILURES_VIEWED", { count: failures.length });
    res.json({ success: true, failures });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Get harmonization failures error:", error);
    res.status(500).json({ error: "Failed to get harmonization failures" });
  }
});

router.post("/failures/harmonization", async (req: Request, res: Response) => {
  try {
    const parseResult = HarmonizationFailureSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("HARMONIZATION_FAILURE_VALIDATION_FAILED", { errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid failure data", details: parseResult.error.issues });
    }
    const failure = recordHarmonizationFailure(parseResult.data);
    logHipaaAudit("HARMONIZATION_FAILURE_RECORDED_VIA_API", { failureId: hashIdentifier(failure.id), ruleId: failure.ruleId });
    res.status(201).json({ success: true, failure });
  } catch (error) {
    console.error("[ProactiveQualityRoutes] Record harmonization failure error:", error);
    res.status(500).json({ error: "Failed to record harmonization failure" });
  }
});

export default router;
