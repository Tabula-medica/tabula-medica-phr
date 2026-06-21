import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiDataObservabilityService } from "./services/ai-data-observability";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${createHash("sha256").update(match).digest("hex").substring(0, 8)}]`
    );
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ["description", "title", "notes", "message"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveFields.includes(key) && typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function logHipaaAudit(
  action: string,
  resource: string,
  req: Request,
  details: Record<string, unknown>
): void {
  const userId = (req as any).user?.id || "anonymous";
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "DataObservabilityAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    userAgent: req.get("user-agent")?.substring(0, 100),
    details: sanitizeDetails(details),
  };
  console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
}

const pipelineFiltersSchema = z.object({
  status: z.enum(["healthy", "warning", "critical", "unknown", "inactive"]).optional(),
  isActive: z.coerce.boolean().optional(),
  tag: z.string().optional(),
});

const anomalyFiltersSchema = z.object({
  pipelineId: z.string().optional(),
  type: z.enum(["freshness", "volume", "schema", "quality", "latency", "missing_data", "duplicate_data"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const alertFiltersSchema = z.object({
  pipelineId: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  acknowledged: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const createPipelineSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  sourceType: z.string().min(1),
  destinationType: z.string().min(1),
  freshnessThresholdMinutes: z.number().min(1),
  volumeThreshold: z.object({
    min: z.number().min(0),
    max: z.number().min(1),
  }),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const lineageNodeSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["source", "transform", "destination", "external", "api", "database", "file"]),
  description: z.string().max(2000),
  systemName: z.string().min(1),
  schemaInfo: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
    })),
    primaryKey: z.array(z.string()).optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const lineageEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  transformationType: z.string().min(1),
  transformationLogic: z.string().optional(),
  dataFields: z.array(z.string()),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_OBSERVABILITY_DASHBOARD", "dashboard", req, {});
    const dashboard = await aiDataObservabilityService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[DataObservabilityAPI] Dashboard error:", error);
    res.status(500).json({ error: "Failed to retrieve dashboard" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_OBSERVABILITY_METRICS", "metrics", req, {});
    const metrics = await aiDataObservabilityService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[DataObservabilityAPI] Metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
});

router.get("/freshness", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_FRESHNESS_METRICS", "freshness", req, {});
    const metrics = aiDataObservabilityService.getFreshnessMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[DataObservabilityAPI] Freshness metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve freshness metrics" });
  }
});

router.get("/volume", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_VOLUME_METRICS", "volume", req, {});
    const metrics = aiDataObservabilityService.getVolumeMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[DataObservabilityAPI] Volume metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve volume metrics" });
  }
});

router.get("/pipelines", async (req: Request, res: Response) => {
  try {
    const filters = pipelineFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_PIPELINES", "pipelines", req, { filters });
    const pipelines = await aiDataObservabilityService.listPipelines(filters);
    res.json(pipelines);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataObservabilityAPI] List pipelines error:", error);
    res.status(500).json({ error: "Failed to list pipelines" });
  }
});

router.get("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const pipeline = await aiDataObservabilityService.getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    logHipaaAudit("VIEW_PIPELINE", "pipeline", req, { pipelineId: req.params.id });
    res.json(pipeline);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get pipeline error:", error);
    res.status(500).json({ error: "Failed to retrieve pipeline" });
  }
});

router.post("/pipelines", async (req: Request, res: Response) => {
  try {
    const data = createPipelineSchema.parse(req.body);
    logHipaaAudit("CREATE_PIPELINE", "pipeline", req, { name: data.name });

    const pipeline = await aiDataObservabilityService.createPipeline({
      ...data,
      metadata: data.metadata || {},
    });
    res.status(201).json(pipeline);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid pipeline data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Create pipeline error:", error);
    res.status(500).json({ error: "Failed to create pipeline" });
  }
});

router.patch("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const updates = createPipelineSchema.partial().parse(req.body);
    logHipaaAudit("UPDATE_PIPELINE", "pipeline", req, {
      pipelineId: req.params.id,
      updates: Object.keys(updates),
    });

    const pipeline = await aiDataObservabilityService.updatePipeline(req.params.id, updates);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }

    res.json(pipeline);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Update pipeline error:", error);
    res.status(500).json({ error: "Failed to update pipeline" });
  }
});

router.get("/lineage", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_LINEAGE_GRAPH", "lineage", req, {});
    const graph = await aiDataObservabilityService.getLineageGraph();
    res.json(graph);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get lineage error:", error);
    res.status(500).json({ error: "Failed to retrieve lineage graph" });
  }
});

router.post("/lineage/nodes", async (req: Request, res: Response) => {
  try {
    const data = lineageNodeSchema.parse(req.body);
    logHipaaAudit("ADD_LINEAGE_NODE", "lineage", req, { name: data.name, type: data.type });

    const node = await aiDataObservabilityService.addLineageNode({
      ...data,
      metadata: data.metadata || {},
    });
    res.status(201).json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid node data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Add lineage node error:", error);
    res.status(500).json({ error: "Failed to add lineage node" });
  }
});

router.post("/lineage/edges", async (req: Request, res: Response) => {
  try {
    const data = lineageEdgeSchema.parse(req.body);
    logHipaaAudit("ADD_LINEAGE_EDGE", "lineage", req, {
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
    });

    const edge = await aiDataObservabilityService.addLineageEdge({
      ...data,
      metadata: data.metadata || {},
    });
    res.status(201).json(edge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid edge data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Add lineage edge error:", error);
    res.status(500).json({ error: "Failed to add lineage edge" });
  }
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const filters = anomalyFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_ANOMALIES", "anomalies", req, { filters });
    const anomalies = await aiDataObservabilityService.listAnomalies(filters);
    res.json(anomalies);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataObservabilityAPI] List anomalies error:", error);
    res.status(500).json({ error: "Failed to list anomalies" });
  }
});

router.get("/anomalies/:id", async (req: Request, res: Response) => {
  try {
    const anomaly = await aiDataObservabilityService.getAnomaly(req.params.id);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    logHipaaAudit("VIEW_ANOMALY", "anomaly", req, { anomalyId: req.params.id });
    res.json(anomaly);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get anomaly error:", error);
    res.status(500).json({ error: "Failed to retrieve anomaly" });
  }
});

router.post("/anomalies/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ACKNOWLEDGE_ANOMALY", "anomaly", req, { anomalyId: req.params.id });

    const anomaly = await aiDataObservabilityService.acknowledgeAnomaly(req.params.id, userId);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }

    res.json(anomaly);
  } catch (error) {
    console.error("[DataObservabilityAPI] Acknowledge anomaly error:", error);
    res.status(500).json({ error: "Failed to acknowledge anomaly" });
  }
});

router.post("/anomalies/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { notes } = z.object({ notes: z.string().min(1).max(2000) }).parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("RESOLVE_ANOMALY", "anomaly", req, {
      anomalyId: req.params.id,
      notes: notes.substring(0, 100),
    });

    const anomaly = await aiDataObservabilityService.resolveAnomaly(req.params.id, userId, notes);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }

    res.json(anomaly);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid resolve data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Resolve anomaly error:", error);
    res.status(500).json({ error: "Failed to resolve anomaly" });
  }
});

router.post("/anomalies/:id/analyze", async (req: Request, res: Response) => {
  try {
    const anomaly = await aiDataObservabilityService.getAnomaly(req.params.id);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }

    logHipaaAudit("REQUEST_ROOT_CAUSE_ANALYSIS", "anomaly", req, { anomalyId: req.params.id });

    const rootCause = await aiDataObservabilityService.performRootCauseAnalysis(anomaly);
    res.json(rootCause);
  } catch (error) {
    console.error("[DataObservabilityAPI] Root cause analysis error:", error);
    res.status(500).json({ error: "Failed to perform root cause analysis" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const filters = alertFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_ALERTS", "alerts", req, { filters });
    const alerts = await aiDataObservabilityService.getAlerts(filters);
    res.json(alerts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataObservabilityAPI] List alerts error:", error);
    res.status(500).json({ error: "Failed to list alerts" });
  }
});

router.post("/alerts/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ACKNOWLEDGE_ALERT", "alert", req, { alertId: req.params.id });

    const alert = await aiDataObservabilityService.acknowledgeAlert(req.params.id, userId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(alert);
  } catch (error) {
    console.error("[DataObservabilityAPI] Acknowledge alert error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/detect", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("RUN_ANOMALY_DETECTION", "detection", req, {});
    const anomalies = await aiDataObservabilityService.runAnomalyDetection();
    res.json({ detected: anomalies.length, anomalies });
  } catch (error) {
    console.error("[DataObservabilityAPI] Anomaly detection error:", error);
    res.status(500).json({ error: "Failed to run anomaly detection" });
  }
});

router.post("/monitoring/start", async (req: Request, res: Response) => {
  try {
    const { intervalMs } = z.object({
      intervalMs: z.number().min(10000).max(3600000).default(60000),
    }).parse(req.body);

    logHipaaAudit("START_MONITORING", "monitoring", req, { intervalMs });
    aiDataObservabilityService.startMonitoring(intervalMs);
    res.json({ message: "Monitoring started", intervalMs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid interval", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Start monitoring error:", error);
    res.status(500).json({ error: "Failed to start monitoring" });
  }
});

router.post("/monitoring/stop", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("STOP_MONITORING", "monitoring", req, {});
    aiDataObservabilityService.stopMonitoring();
    res.json({ message: "Monitoring stopped" });
  } catch (error) {
    console.error("[DataObservabilityAPI] Stop monitoring error:", error);
    res.status(500).json({ error: "Failed to stop monitoring" });
  }
});

const schemaDriftFiltersSchema = z.object({
  resourceType: z.string().optional(),
  sourceId: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.enum(["open", "acknowledged", "resolved", "ignored"]).optional(),
});

const detectSchemaDriftSchema = z.object({
  resourceType: z.string().min(1),
  sourceId: z.string().min(1),
  resource: z.record(z.unknown()),
});

const captureBaselineSchema = z.object({
  resourceType: z.string().min(1),
  sourceId: z.string().min(1),
  sampleResource: z.record(z.unknown()),
});

const dataQualityIssueSchema = z.object({
  pipelineId: z.string().min(1),
  resourceType: z.string().min(1),
  issueType: z.enum(["missing_field", "invalid_format", "inconsistent_value", "orphan_reference", "duplicate", "schema_violation"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  affectedRecordCount: z.number().min(0),
  sampleRecordIds: z.array(z.string()).default([]),
  status: z.enum(["open", "investigating", "resolved"]).default("open"),
});

router.get("/enhanced-dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_ENHANCED_DASHBOARD", "dashboard", req, {});
    const dashboard = await aiDataObservabilityService.getEnhancedDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[DataObservabilityAPI] Enhanced dashboard error:", error);
    res.status(500).json({ error: "Failed to retrieve enhanced dashboard" });
  }
});

router.get("/schema/baselines", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_SCHEMA_BASELINES", "schema", req, {});
    const baselines = aiDataObservabilityService.getSchemaBaselines();
    res.json({ baselines, noCdsCompliance: "Schema baselines for data infrastructure monitoring only." });
  } catch (error) {
    console.error("[DataObservabilityAPI] List baselines error:", error);
    res.status(500).json({ error: "Failed to list schema baselines" });
  }
});

router.get("/schema/baselines/:resourceType/:sourceId", async (req: Request, res: Response) => {
  try {
    const { resourceType, sourceId } = req.params;
    logHipaaAudit("VIEW_SCHEMA_BASELINE", "schema", req, { resourceType, sourceId });
    const baseline = aiDataObservabilityService.getSchemaBaseline(resourceType, sourceId);
    if (!baseline) {
      return res.status(404).json({ error: "Baseline not found" });
    }
    res.json(baseline);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get baseline error:", error);
    res.status(500).json({ error: "Failed to retrieve baseline" });
  }
});

router.post("/schema/baselines", async (req: Request, res: Response) => {
  try {
    const data = captureBaselineSchema.parse(req.body);
    logHipaaAudit("CAPTURE_SCHEMA_BASELINE", "schema", req, {
      resourceType: data.resourceType,
      sourceId: data.sourceId,
    });
    const baseline = await aiDataObservabilityService.captureSchemaBaseline(
      data.resourceType,
      data.sourceId,
      data.sampleResource
    );
    res.status(201).json(baseline);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Capture baseline error:", error);
    res.status(500).json({ error: "Failed to capture baseline" });
  }
});

router.get("/schema/drift", async (req: Request, res: Response) => {
  try {
    const filters = schemaDriftFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_SCHEMA_DRIFT_EVENTS", "schema", req, { filters });
    const events = aiDataObservabilityService.getSchemaDriftEvents(filters);
    res.json({ events, noCdsCompliance: "Schema drift detection for data infrastructure monitoring only." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataObservabilityAPI] List drift events error:", error);
    res.status(500).json({ error: "Failed to list drift events" });
  }
});

router.get("/schema/drift/:id", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_SCHEMA_DRIFT_EVENT", "schema", req, { driftId: req.params.id });
    const event = aiDataObservabilityService.getSchemaDriftEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Drift event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get drift event error:", error);
    res.status(500).json({ error: "Failed to retrieve drift event" });
  }
});

router.post("/schema/detect-drift", async (req: Request, res: Response) => {
  try {
    const data = detectSchemaDriftSchema.parse(req.body);
    logHipaaAudit("DETECT_SCHEMA_DRIFT", "schema", req, {
      resourceType: data.resourceType,
      sourceId: data.sourceId,
    });
    const driftEvents = await aiDataObservabilityService.detectSchemaDrift(
      data.resourceType,
      data.sourceId,
      data.resource
    );
    res.json({
      detected: driftEvents.length,
      events: driftEvents,
      noCdsCompliance: "Schema drift detection for data infrastructure monitoring only.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Detect drift error:", error);
    res.status(500).json({ error: "Failed to detect schema drift" });
  }
});

router.post("/schema/drift/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ACKNOWLEDGE_SCHEMA_DRIFT", "schema", req, { driftId: req.params.id });
    const event = await aiDataObservabilityService.acknowledgeSchemaDrift(req.params.id, userId);
    if (!event) {
      return res.status(404).json({ error: "Drift event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("[DataObservabilityAPI] Acknowledge drift error:", error);
    res.status(500).json({ error: "Failed to acknowledge drift" });
  }
});

router.post("/schema/drift/:id/resolve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("RESOLVE_SCHEMA_DRIFT", "schema", req, { driftId: req.params.id });
    const event = await aiDataObservabilityService.resolveSchemaDrift(req.params.id, userId);
    if (!event) {
      return res.status(404).json({ error: "Drift event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("[DataObservabilityAPI] Resolve drift error:", error);
    res.status(500).json({ error: "Failed to resolve drift" });
  }
});

router.get("/rca/enhanced", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ENHANCED_RCA", "rca", req, {});
    const analyses = aiDataObservabilityService.getEnhancedRootCauseAnalyses();
    res.json({ analyses, noCdsCompliance: "Root cause analysis for data infrastructure troubleshooting only." });
  } catch (error) {
    console.error("[DataObservabilityAPI] List enhanced RCA error:", error);
    res.status(500).json({ error: "Failed to list enhanced RCA" });
  }
});

router.get("/rca/enhanced/:id", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_ENHANCED_RCA", "rca", req, { rcaId: req.params.id });
    const analysis = aiDataObservabilityService.getEnhancedRootCauseAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }
    res.json(analysis);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get enhanced RCA error:", error);
    res.status(500).json({ error: "Failed to retrieve enhanced RCA" });
  }
});

router.post("/rca/enhanced/:anomalyId", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("PERFORM_ENHANCED_RCA", "rca", req, { anomalyId: req.params.anomalyId });
    const analysis = await aiDataObservabilityService.performEnhancedRootCauseAnalysis(req.params.anomalyId);
    if (!analysis) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    res.json(analysis);
  } catch (error) {
    console.error("[DataObservabilityAPI] Enhanced RCA error:", error);
    res.status(500).json({ error: "Failed to perform enhanced RCA" });
  }
});

router.get("/rca/anomaly/:anomalyId", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_RCA_FOR_ANOMALY", "rca", req, { anomalyId: req.params.anomalyId });
    let analysis = aiDataObservabilityService.getEnhancedRootCauseAnalysisForAnomaly(req.params.anomalyId);
    if (!analysis) {
      analysis = await aiDataObservabilityService.performEnhancedRootCauseAnalysis(req.params.anomalyId);
    }
    if (!analysis) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    res.json(analysis);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get RCA for anomaly error:", error);
    res.status(500).json({ error: "Failed to get RCA for anomaly" });
  }
});

router.get("/quality-issues", async (req: Request, res: Response) => {
  try {
    const filters = z.object({
      pipelineId: z.string().optional(),
      resourceType: z.string().optional(),
      issueType: z.enum(["missing_field", "invalid_format", "inconsistent_value", "orphan_reference", "duplicate", "schema_violation"]).optional(),
      severity: z.enum(["critical", "high", "medium", "low"]).optional(),
      status: z.enum(["open", "investigating", "resolved"]).optional(),
    }).parse(req.query);
    logHipaaAudit("LIST_QUALITY_ISSUES", "quality", req, { filters });
    const issues = aiDataObservabilityService.getDataQualityIssues(filters);
    res.json({ issues, noCdsCompliance: "Data quality issues for operational monitoring only." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataObservabilityAPI] List quality issues error:", error);
    res.status(500).json({ error: "Failed to list quality issues" });
  }
});

router.get("/quality-issues/:id", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_QUALITY_ISSUE", "quality", req, { issueId: req.params.id });
    const issue = aiDataObservabilityService.getDataQualityIssue(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(issue);
  } catch (error) {
    console.error("[DataObservabilityAPI] Get quality issue error:", error);
    res.status(500).json({ error: "Failed to retrieve quality issue" });
  }
});

router.post("/quality-issues", async (req: Request, res: Response) => {
  try {
    const data = dataQualityIssueSchema.parse(req.body);
    logHipaaAudit("RECORD_QUALITY_ISSUE", "quality", req, {
      pipelineId: data.pipelineId,
      issueType: data.issueType,
      severity: data.severity,
    });
    const issue = aiDataObservabilityService.recordDataQualityIssue(data);
    res.status(201).json(issue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("[DataObservabilityAPI] Record quality issue error:", error);
    res.status(500).json({ error: "Failed to record quality issue" });
  }
});

export default router;
