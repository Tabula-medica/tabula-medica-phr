import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import type {
  DataPipelineStatus,
  DataAnomalyType,
  DataAnomalySeverity,
  LineageNodeType,
  DataPipeline,
  DataLineageNode,
  DataLineageEdge,
  DataLineageGraph,
  DataAnomaly,
  RootCauseAnalysis,
  FreshnessMetric,
  VolumeMetric,
  DataObservabilityAlert,
  DataObservabilityMetrics,
  DataObservabilityDashboard,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data observability assistant analyzing data pipeline health and anomalies.

CRITICAL RESTRICTIONS:
- You MUST NOT provide any clinical decision support (CDS)
- You MUST NOT interpret clinical significance of healthcare data
- You MUST NOT suggest diagnoses, treatments, or clinical interventions
- Your role is LIMITED to data infrastructure observability and pipeline monitoring

Focus on:
- Data pipeline health and performance
- Anomaly detection in data freshness, volume, and quality
- Root cause analysis for data infrastructure issues
- Data lineage and flow analysis
- Technical recommendations for data pipeline optimization`;

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

const pipelineStore = new Map<string, DataPipeline>();
const lineageNodeStore = new Map<string, DataLineageNode>();
const lineageEdgeStore = new Map<string, DataLineageEdge>();
const anomalyStore = new Map<string, DataAnomaly>();
const alertStore = new Map<string, DataObservabilityAlert>();
const rootCauseStore = new Map<string, RootCauseAnalysis>();

const volumeHistory = new Map<string, Array<{ timestamp: string; count: number }>>();

export interface FHIRSchemaBaseline {
  id: string;
  resourceType: string;
  sourceId: string;
  version: string;
  fields: Array<{
    path: string;
    type: string;
    isRequired: boolean;
    cardinality: "single" | "array";
  }>;
  capturedAt: string;
  recordCount: number;
}

export interface SchemaDriftEvent {
  id: string;
  baselineId: string;
  resourceType: string;
  sourceId: string;
  driftType: "field_added" | "field_removed" | "type_changed" | "cardinality_changed" | "required_changed";
  severity: "critical" | "high" | "medium" | "low";
  affectedField: string;
  previousValue: string;
  currentValue: string;
  sampleRecordIds: string[];
  detectedAt: string;
  status: "open" | "acknowledged" | "resolved" | "ignored";
  impact: string;
  recommendation: string;
  noCdsCompliance: string;
}

export interface EnhancedRootCauseAnalysis {
  id: string;
  anomalyId: string;
  analysisTimestamp: string;
  aiConfidence: number;
  primaryCause: string;
  contributingFactors: Array<{
    factor: string;
    confidence: number;
    evidence: string[];
  }>;
  affectedComponents: string[];
  upstreamImpact: Array<{
    componentId: string;
    componentName: string;
    impactType: string;
    severity: string;
  }>;
  downstreamImpact: Array<{
    componentId: string;
    componentName: string;
    impactType: string;
    severity: string;
  }>;
  temporalPattern: {
    firstOccurrence: string;
    frequency: string;
    isRecurring: boolean;
    lastOccurrence: string;
  };
  impactAssessment: {
    dataQualityImpact: string;
    operationalImpact: string;
    complianceImpact: string;
    estimatedAffectedRecords: number;
  };
  recommendedActions: Array<{
    action: string;
    priority: "critical" | "high" | "medium" | "low";
    estimatedEffort: string;
    expectedOutcome: string;
  }>;
  correlatedEvents: string[];
  noCdsCompliance: string;
}

export interface DataQualityIssue {
  id: string;
  pipelineId: string;
  resourceType: string;
  issueType: "missing_field" | "invalid_format" | "inconsistent_value" | "orphan_reference" | "duplicate" | "schema_violation";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedRecordCount: number;
  sampleRecordIds: string[];
  detectedAt: string;
  status: "open" | "investigating" | "resolved";
  rootCauseId?: string;
}

const schemaBaselineStore = new Map<string, FHIRSchemaBaseline>();
const schemaDriftStore = new Map<string, SchemaDriftEvent>();
const enhancedRcaStore = new Map<string, EnhancedRootCauseAnalysis>();
const dataQualityIssueStore = new Map<string, DataQualityIssue>();

class AIDataObservabilityService {
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSamplePipelines();
    this.initializeSampleLineage();
    console.log("[AIDataObservability] Service initialized");
  }

  private initializeSamplePipelines(): void {
    const pipelines: DataPipeline[] = [
      {
        id: "pipeline-ehr-ingestion",
        name: "EHR Data Ingestion",
        description: "Ingests patient records from connected EHR systems via FHIR API",
        sourceType: "fhir_api",
        destinationType: "fhir_store",
        status: "healthy",
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        avgLatencyMs: 450,
        recordsProcessed24h: 15420,
        errorRate24h: 0.02,
        freshnessThresholdMinutes: 60,
        volumeThreshold: { min: 100, max: 50000 },
        isActive: true,
        tags: ["ehr", "fhir", "patient-data"],
        metadata: {},
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pipeline-lab-results",
        name: "Lab Results Processing",
        description: "Processes laboratory results from connected lab systems",
        sourceType: "hl7_v2",
        destinationType: "fhir_store",
        status: "healthy",
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        avgLatencyMs: 320,
        recordsProcessed24h: 8750,
        errorRate24h: 0.01,
        freshnessThresholdMinutes: 30,
        volumeThreshold: { min: 500, max: 20000 },
        isActive: true,
        tags: ["lab", "diagnostics", "hl7"],
        metadata: {},
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pipeline-claims-export",
        name: "Claims Data Export",
        description: "Exports claims data to payer systems",
        sourceType: "fhir_store",
        destinationType: "x12_edi",
        status: "warning",
        lastRunAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        lastSuccessAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        avgLatencyMs: 1200,
        recordsProcessed24h: 3200,
        errorRate24h: 0.05,
        freshnessThresholdMinutes: 120,
        volumeThreshold: { min: 100, max: 10000 },
        isActive: true,
        tags: ["claims", "payer", "billing"],
        metadata: {},
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pipeline-analytics-sync",
        name: "Analytics Data Sync",
        description: "Synchronizes aggregated data to analytics warehouse",
        sourceType: "fhir_store",
        destinationType: "bigquery",
        status: "healthy",
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        avgLatencyMs: 2500,
        recordsProcessed24h: 125000,
        errorRate24h: 0.001,
        freshnessThresholdMinutes: 240,
        volumeThreshold: { min: 10000, max: 500000 },
        isActive: true,
        tags: ["analytics", "warehouse", "reporting"],
        metadata: {},
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    pipelines.forEach((p) => pipelineStore.set(p.id, p));
    console.log(`[AIDataObservability] Initialized ${pipelines.length} sample pipelines`);
  }

  private initializeSampleLineage(): void {
    const nodes: DataLineageNode[] = [
      {
        id: "node-epic-ehr",
        name: "Fasten Health EHR",
        type: "source",
        description: "Fasten Health EHR system",
        systemName: "fastenhealth",
        schemaInfo: { fields: [{ name: "patient", type: "Patient", nullable: false }], primaryKey: ["id"] },
        metadata: {},
      },
      {
        id: "node-cerner-ehr",
        name: "Hospital Network",
        type: "source",
        description: "Hospital Network/Cerner EHR system",
        systemName: "fastenhealth",
        metadata: {},
      },
      {
        id: "node-fhir-gateway",
        name: "FHIR API Gateway",
        type: "api",
        description: "Central FHIR R4 API gateway",
        systemName: "fhir-gateway",
        metadata: {},
      },
      {
        id: "node-reconciliation",
        name: "Data Reconciliation Engine",
        type: "transform",
        description: "AI-powered patient data reconciliation",
        systemName: "reconciliation-engine",
        metadata: {},
      },
      {
        id: "node-fhir-store",
        name: "FHIR Data Store",
        type: "database",
        description: "Primary FHIR R4 data store",
        systemName: "fhir-store",
        metadata: {},
      },
      {
        id: "node-analytics",
        name: "Analytics Warehouse",
        type: "destination",
        description: "BigQuery analytics warehouse",
        systemName: "bigquery",
        metadata: {},
      },
      {
        id: "node-lab-system",
        name: "Laboratory System",
        type: "source",
        description: "Connected laboratory information system",
        systemName: "lab-lis",
        metadata: {},
      },
    ];

    const edges: DataLineageEdge[] = [
      {
        id: "edge-epic-gateway",
        sourceNodeId: "node-epic-ehr",
        targetNodeId: "node-fhir-gateway",
        transformationType: "fhir_conversion",
        dataFields: ["Patient", "Observation", "Condition"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-cerner-gateway",
        sourceNodeId: "node-cerner-ehr",
        targetNodeId: "node-fhir-gateway",
        transformationType: "fhir_conversion",
        dataFields: ["Patient", "Encounter", "MedicationRequest"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-gateway-reconciliation",
        sourceNodeId: "node-fhir-gateway",
        targetNodeId: "node-reconciliation",
        transformationType: "passthrough",
        dataFields: ["Patient"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-reconciliation-store",
        sourceNodeId: "node-reconciliation",
        targetNodeId: "node-fhir-store",
        transformationType: "deduplication",
        dataFields: ["Patient"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-gateway-store",
        sourceNodeId: "node-fhir-gateway",
        targetNodeId: "node-fhir-store",
        transformationType: "validation",
        dataFields: ["Observation", "Condition", "Encounter", "MedicationRequest"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-store-analytics",
        sourceNodeId: "node-fhir-store",
        targetNodeId: "node-analytics",
        transformationType: "aggregation",
        dataFields: ["analytics_summary"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
      {
        id: "edge-lab-gateway",
        sourceNodeId: "node-lab-system",
        targetNodeId: "node-fhir-gateway",
        transformationType: "hl7_to_fhir",
        dataFields: ["DiagnosticReport", "Observation"],
        isActive: true,
        lastDataFlowAt: new Date().toISOString(),
        metadata: {},
      },
    ];

    nodes.forEach((n) => lineageNodeStore.set(n.id, n));
    edges.forEach((e) => lineageEdgeStore.set(e.id, e));
    console.log(`[AIDataObservability] Initialized lineage graph: ${nodes.length} nodes, ${edges.length} edges`);
  }

  private logAuditEvent(
    action: string,
    resource: string,
    userId: string,
    details: Record<string, unknown>
  ): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      resource,
      userId: hashIdentifier(userId),
      component: "AIDataObservability",
      details: sanitizePhi(JSON.stringify(details)),
    };
    console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.runAnomalyDetection();
    }, intervalMs);

    console.log(`[AIDataObservability] Monitoring started with ${intervalMs}ms interval`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("[AIDataObservability] Monitoring stopped");
    }
  }

  async runAnomalyDetection(): Promise<DataAnomaly[]> {
    const detectedAnomalies: DataAnomaly[] = [];
    const pipelines = Array.from(pipelineStore.values()).filter((p) => p.isActive);

    for (const pipeline of pipelines) {
      const freshnessAnomaly = await this.checkFreshness(pipeline);
      if (freshnessAnomaly) detectedAnomalies.push(freshnessAnomaly);

      const volumeAnomaly = await this.checkVolume(pipeline);
      if (volumeAnomaly) detectedAnomalies.push(volumeAnomaly);

      const latencyAnomaly = this.checkLatency(pipeline);
      if (latencyAnomaly) detectedAnomalies.push(latencyAnomaly);

      const errorRateAnomaly = this.checkErrorRate(pipeline);
      if (errorRateAnomaly) detectedAnomalies.push(errorRateAnomaly);
    }

    for (const anomaly of detectedAnomalies) {
      if (anomaly.severity === "critical" || anomaly.severity === "high") {
        await this.performRootCauseAnalysis(anomaly);
        await this.sendAlert(anomaly);
      }
    }

    return detectedAnomalies;
  }

  private async checkFreshness(pipeline: DataPipeline): Promise<DataAnomaly | null> {
    if (!pipeline.lastRunAt) return null;

    const lastRun = new Date(pipeline.lastRunAt);
    const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60);

    if (minutesSinceLastRun <= pipeline.freshnessThresholdMinutes) {
      return null;
    }

    const severity: DataAnomalySeverity =
      minutesSinceLastRun > pipeline.freshnessThresholdMinutes * 3
        ? "critical"
        : minutesSinceLastRun > pipeline.freshnessThresholdMinutes * 2
        ? "high"
        : "medium";

    const anomaly: DataAnomaly = {
      id: randomUUID(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      type: "freshness",
      severity,
      title: `Data freshness threshold exceeded for ${pipeline.name}`,
      description: `Pipeline has not received new data for ${Math.round(minutesSinceLastRun)} minutes (threshold: ${pipeline.freshnessThresholdMinutes} minutes)`,
      detectedAt: new Date().toISOString(),
      expectedValue: pipeline.freshnessThresholdMinutes,
      actualValue: Math.round(minutesSinceLastRun),
      deviationPercent: ((minutesSinceLastRun - pipeline.freshnessThresholdMinutes) / pipeline.freshnessThresholdMinutes) * 100,
      status: "open",
      alertSent: false,
      metadata: { thresholdMinutes: pipeline.freshnessThresholdMinutes },
    };

    anomalyStore.set(anomaly.id, anomaly);
    this.logAuditEvent("ANOMALY_DETECTED", "freshness", "system", {
      anomalyId: anomaly.id,
      pipelineId: pipeline.id,
      severity,
    });

    return anomaly;
  }

  private async checkVolume(pipeline: DataPipeline): Promise<DataAnomaly | null> {
    const history = volumeHistory.get(pipeline.id) || [];
    const currentVolume = pipeline.recordsProcessed24h;

    history.push({ timestamp: new Date().toISOString(), count: currentVolume });
    if (history.length > 24) history.shift();
    volumeHistory.set(pipeline.id, history);

    const { min, max } = pipeline.volumeThreshold;

    if (currentVolume >= min && currentVolume <= max) {
      return null;
    }

    const isLow = currentVolume < min;
    const isZero = currentVolume === 0;
    const deviation = isLow
      ? ((min - currentVolume) / min) * 100
      : ((currentVolume - max) / max) * 100;

    const severity: DataAnomalySeverity = isZero
      ? "critical"
      : deviation > 50
      ? "high"
      : deviation > 25
      ? "medium"
      : "low";

    const anomaly: DataAnomaly = {
      id: randomUUID(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      type: isZero ? "missing_data" : "volume",
      severity,
      title: isZero
        ? `No data received for ${pipeline.name}`
        : `Volume ${isLow ? "below" : "above"} threshold for ${pipeline.name}`,
      description: isZero
        ? `Pipeline has processed zero records in the last 24 hours`
        : `Current volume: ${currentVolume} records (expected: ${min}-${max})`,
      detectedAt: new Date().toISOString(),
      expectedValue: { min, max },
      actualValue: currentVolume,
      deviationPercent: deviation,
      affectedRecords: currentVolume,
      status: "open",
      alertSent: false,
      metadata: {},
    };

    anomalyStore.set(anomaly.id, anomaly);
    this.logAuditEvent("ANOMALY_DETECTED", "volume", "system", {
      anomalyId: anomaly.id,
      pipelineId: pipeline.id,
      severity,
    });

    return anomaly;
  }

  private checkLatency(pipeline: DataPipeline): DataAnomaly | null {
    const baselineLatency = 500;
    const latencyThreshold = baselineLatency * 2;

    if (pipeline.avgLatencyMs <= latencyThreshold) {
      return null;
    }

    const deviation = ((pipeline.avgLatencyMs - baselineLatency) / baselineLatency) * 100;
    const severity: DataAnomalySeverity =
      deviation > 300 ? "high" : deviation > 100 ? "medium" : "low";

    const anomaly: DataAnomaly = {
      id: randomUUID(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      type: "latency",
      severity,
      title: `High latency detected for ${pipeline.name}`,
      description: `Average latency is ${pipeline.avgLatencyMs}ms (baseline: ${baselineLatency}ms)`,
      detectedAt: new Date().toISOString(),
      expectedValue: baselineLatency,
      actualValue: pipeline.avgLatencyMs,
      deviationPercent: deviation,
      status: "open",
      alertSent: false,
      metadata: {},
    };

    anomalyStore.set(anomaly.id, anomaly);
    return anomaly;
  }

  private checkErrorRate(pipeline: DataPipeline): DataAnomaly | null {
    const errorRateThreshold = 0.05;

    if (pipeline.errorRate24h <= errorRateThreshold) {
      return null;
    }

    const severity: DataAnomalySeverity =
      pipeline.errorRate24h > 0.2 ? "critical" : pipeline.errorRate24h > 0.1 ? "high" : "medium";

    const anomaly: DataAnomaly = {
      id: randomUUID(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      type: "quality",
      severity,
      title: `High error rate for ${pipeline.name}`,
      description: `Error rate is ${(pipeline.errorRate24h * 100).toFixed(2)}% (threshold: ${(errorRateThreshold * 100).toFixed(2)}%)`,
      detectedAt: new Date().toISOString(),
      expectedValue: errorRateThreshold,
      actualValue: pipeline.errorRate24h,
      deviationPercent: ((pipeline.errorRate24h - errorRateThreshold) / errorRateThreshold) * 100,
      status: "open",
      alertSent: false,
      metadata: {},
    };

    anomalyStore.set(anomaly.id, anomaly);
    return anomaly;
  }

  async performRootCauseAnalysis(anomaly: DataAnomaly): Promise<RootCauseAnalysis> {
    const pipeline = pipelineStore.get(anomaly.pipelineId);
    const lineage = this.getLineageForPipeline(anomaly.pipelineId);
    const relatedAnomalies = this.findCorrelatedAnomalies(anomaly);

    let aiAnalysis: {
      primaryCause: string;
      contributingFactors: string[];
      affectedComponents: string[];
      impactAssessment: string;
      recommendedActions: string[];
    } = {
      primaryCause: "Unable to determine root cause",
      contributingFactors: [],
      affectedComponents: [],
      impactAssessment: "Impact assessment unavailable",
      recommendedActions: ["Investigate pipeline logs", "Check source system connectivity"],
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this data pipeline anomaly and provide root cause analysis:

Anomaly Type: ${anomaly.type}
Severity: ${anomaly.severity}
Title: ${sanitizePhi(anomaly.title)}
Description: ${sanitizePhi(anomaly.description)}
Pipeline: ${pipeline?.name || "Unknown"}
Source Type: ${pipeline?.sourceType || "Unknown"}
Destination Type: ${pipeline?.destinationType || "Unknown"}

Expected Value: ${JSON.stringify(anomaly.expectedValue)}
Actual Value: ${JSON.stringify(anomaly.actualValue)}
Deviation: ${anomaly.deviationPercent?.toFixed(2)}%

Related Anomalies: ${relatedAnomalies.length}
Lineage Depth: ${lineage.nodes.length} nodes

Provide analysis as JSON:
{
  "primaryCause": "Main technical cause of the issue",
  "contributingFactors": ["Factor 1", "Factor 2"],
  "affectedComponents": ["Component 1"],
  "impactAssessment": "Business and data impact description",
  "recommendedActions": ["Action 1", "Action 2"]
}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log(`[AIDataObservability] AI analysis error: ${error}`);
    }

    const rootCause: RootCauseAnalysis = {
      id: randomUUID(),
      anomalyId: anomaly.id,
      analysisTimestamp: new Date().toISOString(),
      aiConfidence: 0.85,
      primaryCause: aiAnalysis.primaryCause,
      contributingFactors: aiAnalysis.contributingFactors,
      affectedComponents: aiAnalysis.affectedComponents,
      impactAssessment: aiAnalysis.impactAssessment,
      recommendedActions: aiAnalysis.recommendedActions,
      correlatedAnomalies: relatedAnomalies.map((a) => a.id),
    };

    rootCauseStore.set(rootCause.id, rootCause);
    anomaly.rootCauseAnalysis = rootCause;

    this.logAuditEvent("ROOT_CAUSE_ANALYSIS", "anomaly", "system", {
      anomalyId: anomaly.id,
      rootCauseId: rootCause.id,
    });

    return rootCause;
  }

  private findCorrelatedAnomalies(anomaly: DataAnomaly): DataAnomaly[] {
    const recentWindow = 60 * 60 * 1000;
    const anomalyTime = new Date(anomaly.detectedAt).getTime();

    return Array.from(anomalyStore.values()).filter((a) => {
      if (a.id === anomaly.id) return false;
      const aTime = new Date(a.detectedAt).getTime();
      return Math.abs(aTime - anomalyTime) < recentWindow;
    });
  }

  private getLineageForPipeline(pipelineId: string): DataLineageGraph {
    const nodes = Array.from(lineageNodeStore.values());
    const edges = Array.from(lineageEdgeStore.values());
    return { nodes, edges, lastUpdatedAt: new Date().toISOString() };
  }

  private async sendAlert(anomaly: DataAnomaly): Promise<void> {
    const alert: DataObservabilityAlert = {
      id: randomUUID(),
      anomalyId: anomaly.id,
      pipelineId: anomaly.pipelineId,
      alertType: anomaly.type,
      severity: anomaly.severity,
      title: anomaly.title,
      message: `${anomaly.description}\n\nRoot Cause: ${anomaly.rootCauseAnalysis?.primaryCause || "Analysis pending"}`,
      createdAt: new Date().toISOString(),
      channels: ["in_app"],
      deliveryStatus: { in_app: "sent" },
      metadata: {},
    };

    alertStore.set(alert.id, alert);
    anomaly.alertSent = true;
    anomaly.alertSentAt = new Date().toISOString();

    automatedAlertingService.recordMetric("data_observability_alert", 1, {
      anomalyId: anomaly.id,
      type: anomaly.type,
      severity: anomaly.severity,
    });

    this.logAuditEvent("ALERT_SENT", "observability_alert", "system", {
      alertId: alert.id,
      anomalyId: anomaly.id,
      severity: anomaly.severity,
    });
  }

  async getPipeline(pipelineId: string): Promise<DataPipeline | null> {
    return pipelineStore.get(pipelineId) || null;
  }

  async listPipelines(filters?: {
    status?: DataPipelineStatus;
    isActive?: boolean;
    tag?: string;
  }): Promise<DataPipeline[]> {
    let pipelines = Array.from(pipelineStore.values());

    if (filters?.status) {
      pipelines = pipelines.filter((p) => p.status === filters.status);
    }
    if (filters?.isActive !== undefined) {
      pipelines = pipelines.filter((p) => p.isActive === filters.isActive);
    }
    if (filters?.tag) {
      pipelines = pipelines.filter((p) => p.tags.includes(filters.tag!));
    }

    return pipelines;
  }

  async createPipeline(
    data: Omit<DataPipeline, "id" | "createdAt" | "updatedAt" | "status" | "lastRunAt" | "lastSuccessAt" | "lastFailureAt" | "avgLatencyMs" | "recordsProcessed24h" | "errorRate24h">
  ): Promise<DataPipeline> {
    const now = new Date().toISOString();
    const pipeline: DataPipeline = {
      ...data,
      id: randomUUID(),
      status: "unknown",
      avgLatencyMs: 0,
      recordsProcessed24h: 0,
      errorRate24h: 0,
      createdAt: now,
      updatedAt: now,
    };

    pipelineStore.set(pipeline.id, pipeline);
    this.logAuditEvent("PIPELINE_CREATED", "pipeline", "system", { pipelineId: pipeline.id });
    return pipeline;
  }

  async updatePipeline(
    pipelineId: string,
    updates: Partial<DataPipeline>
  ): Promise<DataPipeline | null> {
    const pipeline = pipelineStore.get(pipelineId);
    if (!pipeline) return null;

    const updated = {
      ...pipeline,
      ...updates,
      id: pipeline.id,
      createdAt: pipeline.createdAt,
      updatedAt: new Date().toISOString(),
    };

    pipelineStore.set(pipelineId, updated);
    this.logAuditEvent("PIPELINE_UPDATED", "pipeline", "system", {
      pipelineId,
      updates: Object.keys(updates),
    });

    return updated;
  }

  async getLineageGraph(): Promise<DataLineageGraph> {
    return {
      nodes: Array.from(lineageNodeStore.values()),
      edges: Array.from(lineageEdgeStore.values()),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async addLineageNode(node: Omit<DataLineageNode, "id">): Promise<DataLineageNode> {
    const newNode: DataLineageNode = { ...node, id: randomUUID() };
    lineageNodeStore.set(newNode.id, newNode);
    this.logAuditEvent("LINEAGE_NODE_ADDED", "lineage", "system", { nodeId: newNode.id });
    return newNode;
  }

  async addLineageEdge(edge: Omit<DataLineageEdge, "id">): Promise<DataLineageEdge> {
    const newEdge: DataLineageEdge = { ...edge, id: randomUUID() };
    lineageEdgeStore.set(newEdge.id, newEdge);
    this.logAuditEvent("LINEAGE_EDGE_ADDED", "lineage", "system", { edgeId: newEdge.id });
    return newEdge;
  }

  async getAnomaly(anomalyId: string): Promise<DataAnomaly | null> {
    return anomalyStore.get(anomalyId) || null;
  }

  async listAnomalies(filters?: {
    pipelineId?: string;
    type?: DataAnomalyType;
    severity?: DataAnomalySeverity;
    status?: string;
    limit?: number;
  }): Promise<DataAnomaly[]> {
    let anomalies = Array.from(anomalyStore.values());

    if (filters?.pipelineId) {
      anomalies = anomalies.filter((a) => a.pipelineId === filters.pipelineId);
    }
    if (filters?.type) {
      anomalies = anomalies.filter((a) => a.type === filters.type);
    }
    if (filters?.severity) {
      anomalies = anomalies.filter((a) => a.severity === filters.severity);
    }
    if (filters?.status) {
      anomalies = anomalies.filter((a) => a.status === filters.status);
    }

    anomalies.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    if (filters?.limit) {
      anomalies = anomalies.slice(0, filters.limit);
    }

    return anomalies;
  }

  async acknowledgeAnomaly(anomalyId: string, userId: string): Promise<DataAnomaly | null> {
    const anomaly = anomalyStore.get(anomalyId);
    if (!anomaly) return null;

    anomaly.status = "acknowledged";
    this.logAuditEvent("ANOMALY_ACKNOWLEDGED", "anomaly", userId, { anomalyId });
    return anomaly;
  }

  async resolveAnomaly(
    anomalyId: string,
    userId: string,
    notes: string
  ): Promise<DataAnomaly | null> {
    const anomaly = anomalyStore.get(anomalyId);
    if (!anomaly) return null;

    anomaly.status = "resolved";
    anomaly.resolvedAt = new Date().toISOString();
    anomaly.resolvedBy = hashIdentifier(userId);
    anomaly.resolutionNotes = notes;

    this.logAuditEvent("ANOMALY_RESOLVED", "anomaly", userId, { anomalyId, notes: sanitizePhi(notes) });
    return anomaly;
  }

  async getAlerts(filters?: {
    pipelineId?: string;
    severity?: DataAnomalySeverity;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<DataObservabilityAlert[]> {
    let alerts = Array.from(alertStore.values());

    if (filters?.pipelineId) {
      alerts = alerts.filter((a) => a.pipelineId === filters.pipelineId);
    }
    if (filters?.severity) {
      alerts = alerts.filter((a) => a.severity === filters.severity);
    }
    if (filters?.acknowledged !== undefined) {
      alerts = alerts.filter((a) => (a.acknowledgedAt !== undefined) === filters.acknowledged);
    }

    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<DataObservabilityAlert | null> {
    const alert = alertStore.get(alertId);
    if (!alert) return null;

    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = hashIdentifier(userId);

    this.logAuditEvent("ALERT_ACKNOWLEDGED", "alert", userId, { alertId });
    return alert;
  }

  getFreshnessMetrics(): FreshnessMetric[] {
    const metrics: FreshnessMetric[] = [];
    const allPipelines = Array.from(pipelineStore.values());

    for (const pipeline of allPipelines) {
      if (!pipeline.isActive) continue;

      const lastRun = pipeline.lastRunAt ? new Date(pipeline.lastRunAt) : null;
      const minutesSinceLastRun = lastRun
        ? (Date.now() - lastRun.getTime()) / (1000 * 60)
        : Infinity;

      let freshnessStatus: "fresh" | "stale" | "critical" = "fresh";
      if (minutesSinceLastRun > pipeline.freshnessThresholdMinutes * 2) {
        freshnessStatus = "critical";
      } else if (minutesSinceLastRun > pipeline.freshnessThresholdMinutes) {
        freshnessStatus = "stale";
      }

      metrics.push({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        lastDataReceivedAt: pipeline.lastRunAt || "Never",
        expectedIntervalMinutes: pipeline.freshnessThresholdMinutes,
        actualIntervalMinutes: Math.round(minutesSinceLastRun),
        freshnessStatus,
        staleSinceMinutes: freshnessStatus !== "fresh" ? Math.round(minutesSinceLastRun - pipeline.freshnessThresholdMinutes) : undefined,
      });
    }

    return metrics;
  }

  getVolumeMetrics(): VolumeMetric[] {
    const metrics: VolumeMetric[] = [];
    const allPipelines = Array.from(pipelineStore.values());

    for (const pipeline of allPipelines) {
      if (!pipeline.isActive) continue;

      const { min, max } = pipeline.volumeThreshold;
      const current = pipeline.recordsProcessed24h;

      let volumeStatus: "normal" | "low" | "high" | "zero" = "normal";
      let deviation = 0;

      if (current === 0) {
        volumeStatus = "zero";
        deviation = -100;
      } else if (current < min) {
        volumeStatus = "low";
        deviation = ((min - current) / min) * -100;
      } else if (current > max) {
        volumeStatus = "high";
        deviation = ((current - max) / max) * 100;
      }

      metrics.push({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        timestamp: new Date().toISOString(),
        recordCount: current,
        expectedMin: min,
        expectedMax: max,
        deviationPercent: deviation,
        volumeStatus,
      });
    }

    return metrics;
  }

  async getMetrics(): Promise<DataObservabilityMetrics> {
    const pipelines = Array.from(pipelineStore.values());
    const anomalies = Array.from(anomalyStore.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const anomalies24h = anomalies.filter(
      (a) => new Date(a.detectedAt).getTime() > oneDayAgo
    );
    const resolved24h = anomalies.filter(
      (a) => a.resolvedAt && new Date(a.resolvedAt).getTime() > oneDayAgo
    );

    const bySeverity: Record<DataAnomalySeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byType: Record<DataAnomalyType, number> = {
      freshness: 0,
      volume: 0,
      schema: 0,
      quality: 0,
      latency: 0,
      missing_data: 0,
      duplicate_data: 0,
    };

    for (const a of anomalies24h) {
      bySeverity[a.severity]++;
      byType[a.type]++;
    }

    return {
      totalPipelines: pipelines.length,
      healthyPipelines: pipelines.filter((p) => p.status === "healthy").length,
      warningPipelines: pipelines.filter((p) => p.status === "warning").length,
      criticalPipelines: pipelines.filter((p) => p.status === "critical").length,
      totalAnomalies24h: anomalies24h.length,
      openAnomalies: anomalies.filter((a) => a.status === "open").length,
      resolvedAnomalies24h: resolved24h.length,
      avgTimeToDetectionMinutes: 5,
      avgTimeToResolutionMinutes: 45,
      anomaliesBySeverity: bySeverity,
      anomaliesByType: byType,
      pipelineHealthTrend: this.generateHealthTrend(),
    };
  }

  private generateHealthTrend(): Array<{ timestamp: string; healthy: number; warning: number; critical: number }> {
    const trend: Array<{ timestamp: string; healthy: number; warning: number; critical: number }> = [];
    const now = Date.now();

    for (let i = 23; i >= 0; i--) {
      const ts = new Date(now - i * 60 * 60 * 1000);
      trend.push({
        timestamp: ts.toISOString(),
        healthy: 3 + Math.floor(Math.random() * 2),
        warning: Math.floor(Math.random() * 2),
        critical: Math.random() > 0.9 ? 1 : 0,
      });
    }

    return trend;
  }

  async getDashboard(): Promise<DataObservabilityDashboard> {
    const metrics = await this.getMetrics();
    const pipelines = Array.from(pipelineStore.values()).filter((p) => p.isActive);
    const freshnessMetrics = this.getFreshnessMetrics();
    const volumeMetrics = this.getVolumeMetrics();

    const pipelineStatuses = pipelines.map((pipeline) => ({
      pipeline,
      freshnessMetric: freshnessMetrics.find((f) => f.pipelineId === pipeline.id)!,
      volumeMetric: volumeMetrics.find((v) => v.pipelineId === pipeline.id)!,
    }));

    const recentAnomalies = await this.listAnomalies({ limit: 10 });
    const activeAlerts = await this.getAlerts({ acknowledged: false, limit: 10 });

    const nodesByType: Record<LineageNodeType, number> = {
      source: 0,
      transform: 0,
      destination: 0,
      external: 0,
      api: 0,
      database: 0,
      file: 0,
    };

    const allNodes = Array.from(lineageNodeStore.values());
    for (const node of allNodes) {
      nodesByType[node.type as LineageNodeType]++;
    }

    return {
      metrics,
      pipelineStatuses,
      recentAnomalies,
      activeAlerts,
      lineageSummary: {
        totalNodes: lineageNodeStore.size,
        totalEdges: lineageEdgeStore.size,
        nodesByType,
      },
    };
  }

  async captureSchemaBaseline(
    resourceType: string,
    sourceId: string,
    sampleResource: Record<string, unknown>
  ): Promise<FHIRSchemaBaseline> {
    const fields = this.extractSchemaFields(sampleResource, "");
    const baseline: FHIRSchemaBaseline = {
      id: randomUUID(),
      resourceType,
      sourceId,
      version: `v${Date.now()}`,
      fields,
      capturedAt: new Date().toISOString(),
      recordCount: 1,
    };

    const key = `${resourceType}-${sourceId}`;
    schemaBaselineStore.set(key, baseline);
    this.logAuditEvent("SCHEMA_BASELINE_CAPTURED", "schema", "system", {
      baselineId: baseline.id,
      resourceType,
      sourceId,
      fieldCount: fields.length,
    });

    return baseline;
  }

  private extractSchemaFields(
    obj: Record<string, unknown>,
    prefix: string
  ): FHIRSchemaBaseline["fields"] {
    const fields: FHIRSchemaBaseline["fields"] = [];

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        fields.push({
          path,
          type: value.length > 0 ? typeof value[0] : "unknown",
          isRequired: false,
          cardinality: "array",
        });
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
          fields.push(...this.extractSchemaFields(value[0] as Record<string, unknown>, path));
        }
      } else if (typeof value === "object" && value !== null) {
        fields.push({
          path,
          type: "object",
          isRequired: false,
          cardinality: "single",
        });
        fields.push(...this.extractSchemaFields(value as Record<string, unknown>, path));
      } else {
        fields.push({
          path,
          type: typeof value,
          isRequired: value !== null && value !== undefined,
          cardinality: "single",
        });
      }
    }

    return fields;
  }

  async detectSchemaDrift(
    resourceType: string,
    sourceId: string,
    incomingResource: Record<string, unknown>
  ): Promise<SchemaDriftEvent[]> {
    const key = `${resourceType}-${sourceId}`;
    let baseline = schemaBaselineStore.get(key);

    if (!baseline) {
      baseline = await this.captureSchemaBaseline(resourceType, sourceId, incomingResource);
      return [];
    }

    const incomingFields = this.extractSchemaFields(incomingResource, "");
    const driftEvents: SchemaDriftEvent[] = [];
    const baselineFieldPaths = new Set(baseline.fields.map((f) => f.path));
    const incomingFieldPaths = new Set(incomingFields.map((f) => f.path));

    for (const field of incomingFields) {
      if (!baselineFieldPaths.has(field.path)) {
        const drift = this.createDriftEvent(
          baseline,
          "field_added",
          field.path,
          "not present",
          field.type,
          resourceType,
          sourceId
        );
        driftEvents.push(drift);
      }
    }

    for (const baselineField of baseline.fields) {
      if (!incomingFieldPaths.has(baselineField.path)) {
        const drift = this.createDriftEvent(
          baseline,
          "field_removed",
          baselineField.path,
          baselineField.type,
          "not present",
          resourceType,
          sourceId
        );
        driftEvents.push(drift);
      } else {
        const incomingField = incomingFields.find((f) => f.path === baselineField.path)!;
        if (incomingField.type !== baselineField.type) {
          const drift = this.createDriftEvent(
            baseline,
            "type_changed",
            baselineField.path,
            baselineField.type,
            incomingField.type,
            resourceType,
            sourceId
          );
          driftEvents.push(drift);
        }
        if (incomingField.cardinality !== baselineField.cardinality) {
          const drift = this.createDriftEvent(
            baseline,
            "cardinality_changed",
            baselineField.path,
            baselineField.cardinality,
            incomingField.cardinality,
            resourceType,
            sourceId
          );
          driftEvents.push(drift);
        }
      }
    }

    for (const drift of driftEvents) {
      schemaDriftStore.set(drift.id, drift);
      if (drift.severity === "critical" || drift.severity === "high") {
        await this.createSchemaAnomalyFromDrift(drift);
      }
    }

    this.logAuditEvent("SCHEMA_DRIFT_DETECTED", "schema", "system", {
      resourceType,
      sourceId,
      driftCount: driftEvents.length,
    });

    return driftEvents;
  }

  private createDriftEvent(
    baseline: FHIRSchemaBaseline,
    driftType: SchemaDriftEvent["driftType"],
    affectedField: string,
    previousValue: string,
    currentValue: string,
    resourceType: string,
    sourceId: string
  ): SchemaDriftEvent {
    const severity = this.calculateDriftSeverity(driftType, affectedField);
    const impact = this.assessDriftImpact(driftType, affectedField);
    const recommendation = this.generateDriftRecommendation(driftType, affectedField);

    return {
      id: randomUUID(),
      baselineId: baseline.id,
      resourceType,
      sourceId,
      driftType,
      severity,
      affectedField,
      previousValue,
      currentValue,
      sampleRecordIds: [],
      detectedAt: new Date().toISOString(),
      status: "open",
      impact,
      recommendation,
      noCdsCompliance: "Schema drift detection for data infrastructure monitoring only. No clinical decision support provided.",
    };
  }

  private calculateDriftSeverity(
    driftType: SchemaDriftEvent["driftType"],
    field: string
  ): SchemaDriftEvent["severity"] {
    const criticalFields = ["id", "resourceType", "subject", "patient", "identifier"];
    const isCriticalField = criticalFields.some((cf) => field.toLowerCase().includes(cf));

    if (isCriticalField) return "critical";
    if (driftType === "field_removed" || driftType === "type_changed") return "high";
    if (driftType === "cardinality_changed") return "medium";
    return "low";
  }

  private assessDriftImpact(driftType: SchemaDriftEvent["driftType"], field: string): string {
    switch (driftType) {
      case "field_removed":
        return `Removal of field '${field}' may break downstream data processing and reporting.`;
      case "field_added":
        return `New field '${field}' detected. May require schema updates in consuming systems.`;
      case "type_changed":
        return `Type change for '${field}' may cause data parsing errors and validation failures.`;
      case "cardinality_changed":
        return `Cardinality change for '${field}' may affect data processing logic.`;
      default:
        return `Schema change detected for '${field}'.`;
    }
  }

  private generateDriftRecommendation(
    driftType: SchemaDriftEvent["driftType"],
    field: string
  ): string {
    switch (driftType) {
      case "field_removed":
        return `Verify if '${field}' removal is intentional. Update downstream systems to handle missing field gracefully.`;
      case "field_added":
        return `Update schema definitions to include '${field}'. Consider adding validation rules.`;
      case "type_changed":
        return `Review data transformation logic for '${field}'. Update type handlers and validators.`;
      case "cardinality_changed":
        return `Update data processing to handle new cardinality for '${field}'.`;
      default:
        return `Review and update schema handling for '${field}'.`;
    }
  }

  private async createSchemaAnomalyFromDrift(drift: SchemaDriftEvent): Promise<void> {
    const anomaly: DataAnomaly = {
      id: randomUUID(),
      pipelineId: drift.sourceId,
      pipelineName: `${drift.resourceType} Pipeline`,
      type: "schema",
      severity: drift.severity,
      title: `Schema drift detected: ${drift.driftType} for ${drift.affectedField}`,
      description: drift.impact,
      detectedAt: drift.detectedAt,
      expectedValue: drift.previousValue,
      actualValue: drift.currentValue,
      status: "open",
      alertSent: false,
      metadata: { driftId: drift.id, driftType: drift.driftType },
    };

    anomalyStore.set(anomaly.id, anomaly);
  }

  async performEnhancedRootCauseAnalysis(anomalyId: string): Promise<EnhancedRootCauseAnalysis | null> {
    const anomaly = anomalyStore.get(anomalyId);
    if (!anomaly) return null;

    const pipeline = pipelineStore.get(anomaly.pipelineId);
    const correlatedAnomalies = this.findCorrelatedAnomalies(anomaly);
    const recentDrifts = Array.from(schemaDriftStore.values()).filter(
      (d) => new Date(d.detectedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    let aiAnalysis = {
      primaryCause: "Root cause analysis pending",
      contributingFactors: [] as Array<{ factor: string; confidence: number; evidence: string[] }>,
      impactAssessment: {
        dataQualityImpact: "Assessing data quality impact",
        operationalImpact: "Assessing operational impact",
        complianceImpact: "Assessing compliance impact",
        estimatedAffectedRecords: 0,
      },
      recommendedActions: [] as Array<{
        action: string;
        priority: "critical" | "high" | "medium" | "low";
        estimatedEffort: string;
        expectedOutcome: string;
      }>,
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Perform enhanced root cause analysis for this data pipeline anomaly:

Anomaly: ${sanitizePhi(anomaly.title)}
Type: ${anomaly.type}
Severity: ${anomaly.severity}
Description: ${sanitizePhi(anomaly.description)}
Pipeline: ${pipeline?.name || "Unknown"} (${pipeline?.sourceType} -> ${pipeline?.destinationType})
Correlated Anomalies: ${correlatedAnomalies.length}
Recent Schema Drifts: ${recentDrifts.length}

Provide comprehensive analysis as JSON:
{
  "primaryCause": "Main technical root cause",
  "contributingFactors": [
    {"factor": "Factor description", "confidence": 0.9, "evidence": ["Evidence 1", "Evidence 2"]}
  ],
  "impactAssessment": {
    "dataQualityImpact": "Impact on data quality",
    "operationalImpact": "Operational impact",
    "complianceImpact": "Compliance implications",
    "estimatedAffectedRecords": 1000
  },
  "recommendedActions": [
    {"action": "Action description", "priority": "high", "estimatedEffort": "2 hours", "expectedOutcome": "Expected result"}
  ]
}`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log(`[AIDataObservability] Enhanced RCA AI error: ${error}`);
      aiAnalysis = this.generateFallbackRCA(anomaly, correlatedAnomalies, recentDrifts);
    }

    const upstreamNodes = this.findUpstreamComponents(anomaly.pipelineId);
    const downstreamNodes = this.findDownstreamComponents(anomaly.pipelineId);

    const enhancedRca: EnhancedRootCauseAnalysis = {
      id: randomUUID(),
      anomalyId,
      analysisTimestamp: new Date().toISOString(),
      aiConfidence: 0.85,
      primaryCause: aiAnalysis.primaryCause,
      contributingFactors: aiAnalysis.contributingFactors,
      affectedComponents: [anomaly.pipelineName],
      upstreamImpact: upstreamNodes.map((n) => ({
        componentId: n.id,
        componentName: n.name,
        impactType: "data_flow_disruption",
        severity: anomaly.severity,
      })),
      downstreamImpact: downstreamNodes.map((n) => ({
        componentId: n.id,
        componentName: n.name,
        impactType: "stale_data",
        severity: anomaly.severity === "critical" ? "high" : "medium",
      })),
      temporalPattern: {
        firstOccurrence: anomaly.detectedAt,
        frequency: correlatedAnomalies.length > 2 ? "frequent" : "isolated",
        isRecurring: correlatedAnomalies.length > 0,
        lastOccurrence: anomaly.detectedAt,
      },
      impactAssessment: aiAnalysis.impactAssessment,
      recommendedActions: aiAnalysis.recommendedActions,
      correlatedEvents: correlatedAnomalies.map((a) => a.id),
      noCdsCompliance: "Root cause analysis for data infrastructure troubleshooting only. No clinical decision support provided.",
    };

    enhancedRcaStore.set(enhancedRca.id, enhancedRca);
    this.logAuditEvent("ENHANCED_RCA_PERFORMED", "rca", "system", {
      rcaId: enhancedRca.id,
      anomalyId,
      contributingFactorsCount: enhancedRca.contributingFactors.length,
    });

    return enhancedRca;
  }

  private generateFallbackRCA(
    anomaly: DataAnomaly,
    correlated: DataAnomaly[],
    drifts: SchemaDriftEvent[]
  ): typeof aiAnalysis {
    const factors: Array<{ factor: string; confidence: number; evidence: string[] }> = [];

    if (drifts.length > 0) {
      factors.push({
        factor: "Recent schema changes detected",
        confidence: 0.8,
        evidence: drifts.map((d) => `${d.driftType} on ${d.affectedField}`),
      });
    }

    if (correlated.length > 0) {
      factors.push({
        factor: "Correlated anomalies in related pipelines",
        confidence: 0.7,
        evidence: correlated.map((a) => a.title),
      });
    }

    factors.push({
      factor: `${anomaly.type} anomaly detected in pipeline`,
      confidence: 0.9,
      evidence: [anomaly.description],
    });

    return {
      primaryCause: `${anomaly.type} issue detected: ${anomaly.title}`,
      contributingFactors: factors,
      impactAssessment: {
        dataQualityImpact: "Potential data quality degradation",
        operationalImpact: "Pipeline processing may be affected",
        complianceImpact: "Review required for HIPAA compliance",
        estimatedAffectedRecords: anomaly.affectedRecords || 0,
      },
      recommendedActions: [
        {
          action: "Investigate pipeline logs for errors",
          priority: anomaly.severity as "critical" | "high" | "medium" | "low",
          estimatedEffort: "30 minutes",
          expectedOutcome: "Identify specific failure points",
        },
        {
          action: "Review recent configuration changes",
          priority: "medium",
          estimatedEffort: "1 hour",
          expectedOutcome: "Detect configuration drift",
        },
      ],
    };
  }

  private findUpstreamComponents(pipelineId: string): DataLineageNode[] {
    const edges = Array.from(lineageEdgeStore.values());
    const nodes = Array.from(lineageNodeStore.values());
    const pipelineNode = nodes.find((n) => n.id.includes(pipelineId) || n.systemName === pipelineId);
    if (!pipelineNode) return [];

    return nodes.filter((n) =>
      edges.some((e) => e.targetNodeId === pipelineNode.id && e.sourceNodeId === n.id)
    );
  }

  private findDownstreamComponents(pipelineId: string): DataLineageNode[] {
    const edges = Array.from(lineageEdgeStore.values());
    const nodes = Array.from(lineageNodeStore.values());
    const pipelineNode = nodes.find((n) => n.id.includes(pipelineId) || n.systemName === pipelineId);
    if (!pipelineNode) return [];

    return nodes.filter((n) =>
      edges.some((e) => e.sourceNodeId === pipelineNode.id && e.targetNodeId === n.id)
    );
  }

  getSchemaBaselines(): FHIRSchemaBaseline[] {
    return Array.from(schemaBaselineStore.values());
  }

  getSchemaBaseline(resourceType: string, sourceId: string): FHIRSchemaBaseline | null {
    return schemaBaselineStore.get(`${resourceType}-${sourceId}`) || null;
  }

  getSchemaDriftEvents(filters?: {
    resourceType?: string;
    sourceId?: string;
    severity?: SchemaDriftEvent["severity"];
    status?: SchemaDriftEvent["status"];
  }): SchemaDriftEvent[] {
    let events = Array.from(schemaDriftStore.values());

    if (filters?.resourceType) {
      events = events.filter((e) => e.resourceType === filters.resourceType);
    }
    if (filters?.sourceId) {
      events = events.filter((e) => e.sourceId === filters.sourceId);
    }
    if (filters?.severity) {
      events = events.filter((e) => e.severity === filters.severity);
    }
    if (filters?.status) {
      events = events.filter((e) => e.status === filters.status);
    }

    return events.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  getSchemaDriftEvent(id: string): SchemaDriftEvent | null {
    return schemaDriftStore.get(id) || null;
  }

  async acknowledgeSchemaDrift(id: string, userId: string): Promise<SchemaDriftEvent | null> {
    const drift = schemaDriftStore.get(id);
    if (!drift) return null;

    drift.status = "acknowledged";
    this.logAuditEvent("SCHEMA_DRIFT_ACKNOWLEDGED", "schema", userId, { driftId: id });
    return drift;
  }

  async resolveSchemaDrift(id: string, userId: string): Promise<SchemaDriftEvent | null> {
    const drift = schemaDriftStore.get(id);
    if (!drift) return null;

    drift.status = "resolved";
    this.logAuditEvent("SCHEMA_DRIFT_RESOLVED", "schema", userId, { driftId: id });
    return drift;
  }

  getEnhancedRootCauseAnalyses(): EnhancedRootCauseAnalysis[] {
    return Array.from(enhancedRcaStore.values()).sort(
      (a, b) => new Date(b.analysisTimestamp).getTime() - new Date(a.analysisTimestamp).getTime()
    );
  }

  getEnhancedRootCauseAnalysis(id: string): EnhancedRootCauseAnalysis | null {
    return enhancedRcaStore.get(id) || null;
  }

  getEnhancedRootCauseAnalysisForAnomaly(anomalyId: string): EnhancedRootCauseAnalysis | null {
    return Array.from(enhancedRcaStore.values()).find((r) => r.anomalyId === anomalyId) || null;
  }

  recordDataQualityIssue(issue: Omit<DataQualityIssue, "id" | "detectedAt">): DataQualityIssue {
    const newIssue: DataQualityIssue = {
      ...issue,
      id: randomUUID(),
      detectedAt: new Date().toISOString(),
    };
    dataQualityIssueStore.set(newIssue.id, newIssue);
    this.logAuditEvent("DATA_QUALITY_ISSUE_RECORDED", "quality", "system", {
      issueId: newIssue.id,
      issueType: newIssue.issueType,
      severity: newIssue.severity,
    });
    return newIssue;
  }

  getDataQualityIssues(filters?: {
    pipelineId?: string;
    resourceType?: string;
    issueType?: DataQualityIssue["issueType"];
    severity?: DataQualityIssue["severity"];
    status?: DataQualityIssue["status"];
  }): DataQualityIssue[] {
    let issues = Array.from(dataQualityIssueStore.values());

    if (filters?.pipelineId) {
      issues = issues.filter((i) => i.pipelineId === filters.pipelineId);
    }
    if (filters?.resourceType) {
      issues = issues.filter((i) => i.resourceType === filters.resourceType);
    }
    if (filters?.issueType) {
      issues = issues.filter((i) => i.issueType === filters.issueType);
    }
    if (filters?.severity) {
      issues = issues.filter((i) => i.severity === filters.severity);
    }
    if (filters?.status) {
      issues = issues.filter((i) => i.status === filters.status);
    }

    return issues.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  getDataQualityIssue(id: string): DataQualityIssue | null {
    return dataQualityIssueStore.get(id) || null;
  }

  async getEnhancedDashboard(): Promise<{
    metrics: DataObservabilityMetrics;
    pipelineStatuses: Array<{
      pipeline: DataPipeline;
      freshnessMetric: FreshnessMetric;
      volumeMetric: VolumeMetric;
    }>;
    recentAnomalies: DataAnomaly[];
    activeAlerts: DataObservabilityAlert[];
    schemaDriftSummary: {
      totalDrifts: number;
      openDrifts: number;
      criticalDrifts: number;
      byType: Record<string, number>;
      byResourceType: Record<string, number>;
    };
    dataQualitySummary: {
      totalIssues: number;
      openIssues: number;
      criticalIssues: number;
      byType: Record<string, number>;
    };
    rootCauseAnalysisSummary: {
      totalAnalyses: number;
      avgConfidence: number;
      topCauses: Array<{ cause: string; count: number }>;
    };
    lineageSummary: {
      totalNodes: number;
      totalEdges: number;
      nodesByType: Record<LineageNodeType, number>;
    };
    noCdsCompliance: string;
  }> {
    const baseDashboard = await this.getDashboard();
    const drifts = Array.from(schemaDriftStore.values());
    const issues = Array.from(dataQualityIssueStore.values());
    const rcas = Array.from(enhancedRcaStore.values());

    const driftByType: Record<string, number> = {};
    const driftByResource: Record<string, number> = {};
    for (const d of drifts) {
      driftByType[d.driftType] = (driftByType[d.driftType] || 0) + 1;
      driftByResource[d.resourceType] = (driftByResource[d.resourceType] || 0) + 1;
    }

    const issuesByType: Record<string, number> = {};
    for (const i of issues) {
      issuesByType[i.issueType] = (issuesByType[i.issueType] || 0) + 1;
    }

    const causeCounts = new Map<string, number>();
    for (const r of rcas) {
      const cause = r.primaryCause.substring(0, 50);
      causeCounts.set(cause, (causeCounts.get(cause) || 0) + 1);
    }
    const topCauses = Array.from(causeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cause, count]) => ({ cause, count }));

    return {
      ...baseDashboard,
      schemaDriftSummary: {
        totalDrifts: drifts.length,
        openDrifts: drifts.filter((d) => d.status === "open").length,
        criticalDrifts: drifts.filter((d) => d.severity === "critical").length,
        byType: driftByType,
        byResourceType: driftByResource,
      },
      dataQualitySummary: {
        totalIssues: issues.length,
        openIssues: issues.filter((i) => i.status === "open").length,
        criticalIssues: issues.filter((i) => i.severity === "critical").length,
        byType: issuesByType,
      },
      rootCauseAnalysisSummary: {
        totalAnalyses: rcas.length,
        avgConfidence: rcas.length > 0
          ? rcas.reduce((sum, r) => sum + r.aiConfidence, 0) / rcas.length
          : 0,
        topCauses,
      },
      noCdsCompliance: "Data observability dashboard for operational monitoring only. No clinical decision support provided.",
    };
  }
}

export const aiDataObservabilityService = new AIDataObservabilityService();
