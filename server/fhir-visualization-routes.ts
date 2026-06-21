import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirVisualizationService } from "./services/fhir-visualization-service";

const router = Router();

function logHipaaAudit(action: string, resource: string, userId: string = "system") {
  console.log(`[HIPAA Audit] ${new Date().toISOString()} | Action: ${action} | Resource: ${resource} | User: ${userId}`);
}

// Sample data for visualization
const sampleQualityScores = [
  {
    patientId: "patient-001",
    patientName: "John Doe",
    overallScore: 92,
    completeness: 95,
    accuracy: 90,
    consistency: 88,
    timeliness: 94,
    issueCount: 2,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    trend: "up" as const,
  },
  {
    patientId: "patient-002",
    patientName: "Jane Smith",
    overallScore: 78,
    completeness: 85,
    accuracy: 72,
    consistency: 75,
    timeliness: 80,
    issueCount: 5,
    lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    trend: "stable" as const,
  },
  {
    patientId: "patient-003",
    patientName: "Robert Johnson",
    overallScore: 65,
    completeness: 70,
    accuracy: 60,
    consistency: 65,
    timeliness: 65,
    issueCount: 8,
    lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    trend: "down" as const,
  },
  {
    patientId: "patient-004",
    patientName: "Emily Davis",
    overallScore: 88,
    completeness: 90,
    accuracy: 85,
    consistency: 90,
    timeliness: 87,
    issueCount: 3,
    lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    trend: "up" as const,
  },
  {
    patientId: "patient-005",
    patientName: "Michael Wilson",
    overallScore: 95,
    completeness: 98,
    accuracy: 94,
    consistency: 93,
    timeliness: 95,
    issueCount: 1,
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    trend: "stable" as const,
  },
];

const sampleReconciliationProgress = [
  {
    id: "recon-001",
    resourceType: "Patient",
    totalRecords: 1250,
    matchedRecords: 1180,
    conflictingRecords: 35,
    pendingReview: 35,
    autoMerged: 950,
    manuallyResolved: 230,
    progress: 94,
    lastActivity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "recon-002",
    resourceType: "MedicationRequest",
    totalRecords: 3420,
    matchedRecords: 3100,
    conflictingRecords: 120,
    pendingReview: 200,
    autoMerged: 2800,
    manuallyResolved: 300,
    progress: 91,
    lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "recon-003",
    resourceType: "Condition",
    totalRecords: 890,
    matchedRecords: 850,
    conflictingRecords: 15,
    pendingReview: 25,
    autoMerged: 780,
    manuallyResolved: 70,
    progress: 96,
    lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: "recon-004",
    resourceType: "Observation",
    totalRecords: 8540,
    matchedRecords: 7800,
    conflictingRecords: 340,
    pendingReview: 400,
    autoMerged: 7200,
    manuallyResolved: 600,
    progress: 91,
    lastActivity: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: "recon-005",
    resourceType: "AllergyIntolerance",
    totalRecords: 420,
    matchedRecords: 400,
    conflictingRecords: 8,
    pendingReview: 12,
    autoMerged: 380,
    manuallyResolved: 20,
    progress: 95,
    lastActivity: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "recon-006",
    resourceType: "DocumentReference",
    totalRecords: 2150,
    matchedRecords: 1900,
    conflictingRecords: 100,
    pendingReview: 150,
    autoMerged: 1700,
    manuallyResolved: 200,
    progress: 88,
    lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

const sampleGatewayMetrics = [
  {
    endpoint: "/api/fhir/Patient",
    totalRequests: 15420,
    successfulRequests: 15280,
    failedRequests: 140,
    avgResponseTime: 125,
    p95ResponseTime: 280,
    p99ResponseTime: 450,
    errorRate: 0.91,
    lastHourTrend: 5,
  },
  {
    endpoint: "/api/fhir/Observation",
    totalRequests: 28650,
    successfulRequests: 28400,
    failedRequests: 250,
    avgResponseTime: 95,
    p95ResponseTime: 210,
    p99ResponseTime: 380,
    errorRate: 0.87,
    lastHourTrend: 12,
  },
  {
    endpoint: "/api/fhir/MedicationRequest",
    totalRequests: 8920,
    successfulRequests: 8850,
    failedRequests: 70,
    avgResponseTime: 145,
    p95ResponseTime: 320,
    p99ResponseTime: 520,
    errorRate: 0.78,
    lastHourTrend: -3,
  },
  {
    endpoint: "/api/fhir/Condition",
    totalRequests: 6340,
    successfulRequests: 6290,
    failedRequests: 50,
    avgResponseTime: 110,
    p95ResponseTime: 240,
    p99ResponseTime: 400,
    errorRate: 0.79,
    lastHourTrend: 0,
  },
  {
    endpoint: "/api/fhir/DocumentReference",
    totalRequests: 4280,
    successfulRequests: 4180,
    failedRequests: 100,
    avgResponseTime: 185,
    p95ResponseTime: 420,
    p99ResponseTime: 680,
    errorRate: 2.34,
    lastHourTrend: -8,
  },
  {
    endpoint: "/api/fhir/AllergyIntolerance",
    totalRequests: 2150,
    successfulRequests: 2140,
    failedRequests: 10,
    avgResponseTime: 85,
    p95ResponseTime: 180,
    p99ResponseTime: 290,
    errorRate: 0.47,
    lastHourTrend: 2,
  },
];

function generateQualityTrend(days: number) {
  const trend = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: Math.round(75 + Math.random() * 20 + (days - i) * 0.5),
    });
  }
  return trend;
}

function generateReconciliationTrend(days: number) {
  const trend = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const matched = Math.round(80 + Math.random() * 50);
    trend.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      matched,
      pending: Math.round(10 + Math.random() * 20),
    });
  }
  return trend;
}

function generateApiTrend(hours: number) {
  const trend = [];
  const now = new Date();
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now);
    time.setHours(time.getHours() - i);
    trend.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      requests: Math.round(100 + Math.random() * 200),
      errors: Math.round(Math.random() * 5),
      latency: Math.round(80 + Math.random() * 100),
    });
  }
  return trend;
}

const timeRangeSchema = z.object({
  timeRange: z.enum(["1h", "24h", "7d", "30d"]).optional().default("24h"),
});

// Main dashboard endpoint
router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const { timeRange } = timeRangeSchema.parse(req.query);
    logHipaaAudit("READ", "fhir-visualization-dashboard");

    let trendDays = 7;
    let trendHours = 24;
    switch (timeRange) {
      case "1h":
        trendDays = 1;
        trendHours = 1;
        break;
      case "24h":
        trendDays = 1;
        trendHours = 24;
        break;
      case "7d":
        trendDays = 7;
        trendHours = 24;
        break;
      case "30d":
        trendDays = 30;
        trendHours = 24;
        break;
    }

    const avgQualityScore = Math.round(
      sampleQualityScores.reduce((sum, s) => sum + s.overallScore, 0) / sampleQualityScores.length
    );

    const totalRecords = sampleReconciliationProgress.reduce((sum, p) => sum + p.totalRecords, 0);
    const matchedRecords = sampleReconciliationProgress.reduce((sum, p) => sum + p.matchedRecords, 0);
    const reconciliationRate = Math.round((matchedRecords / totalRecords) * 100);

    const totalRequests = sampleGatewayMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const successfulRequests = sampleGatewayMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const apiSuccessRate = Math.round((successfulRequests / totalRequests) * 100 * 100) / 100;

    const pendingIssues = sampleQualityScores.reduce((sum, s) => sum + s.issueCount, 0) +
      sampleReconciliationProgress.reduce((sum, p) => sum + p.pendingReview, 0);

    res.json({
      qualityScores: sampleQualityScores,
      reconciliationProgress: sampleReconciliationProgress,
      gatewayMetrics: sampleGatewayMetrics,
      overview: {
        totalPatients: sampleQualityScores.length,
        avgQualityScore,
        reconciliationRate,
        apiSuccessRate,
        activeConnections: 6,
        pendingIssues,
      },
      trends: {
        qualityTrend: generateQualityTrend(trendDays),
        reconciliationTrend: generateReconciliationTrend(trendDays),
        apiTrend: generateApiTrend(trendHours),
      },
    });
  } catch (error) {
    console.error("[FhirVisualization] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// Patient quality scores endpoint
router.get("/quality-scores", (req: Request, res: Response) => {
  try {
    logHipaaAudit("READ", "quality-scores");
    res.json({ success: true, data: sampleQualityScores });
  } catch (error) {
    console.error("[FhirVisualization] Quality scores error:", error);
    res.status(500).json({ error: "Failed to fetch quality scores" });
  }
});

// Individual patient quality details
router.get("/quality-scores/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("READ", `quality-score-${patientId}`);

    const score = sampleQualityScores.find(s => s.patientId === patientId);
    if (!score) {
      return res.status(404).json({ error: "Patient quality score not found" });
    }

    // Generate historical data for drill-down
    const history = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString(),
        overallScore: Math.max(50, Math.min(100, score.overallScore + (Math.random() - 0.5) * 10)),
        completeness: Math.max(50, Math.min(100, score.completeness + (Math.random() - 0.5) * 8)),
        accuracy: Math.max(50, Math.min(100, score.accuracy + (Math.random() - 0.5) * 8)),
        consistency: Math.max(50, Math.min(100, score.consistency + (Math.random() - 0.5) * 8)),
        timeliness: Math.max(50, Math.min(100, score.timeliness + (Math.random() - 0.5) * 8)),
      });
    }

    res.json({
      success: true,
      data: {
        ...score,
        history,
        issues: [
          { type: "missing_field", field: "telecom.email", severity: "medium" },
          { type: "stale_data", field: "address", severity: "low", lastUpdated: "2024-06-15" },
        ].slice(0, score.issueCount),
      },
    });
  } catch (error) {
    console.error("[FhirVisualization] Quality score detail error:", error);
    res.status(500).json({ error: "Failed to fetch quality score details" });
  }
});

// Reconciliation progress endpoint
router.get("/reconciliation-progress", (req: Request, res: Response) => {
  try {
    logHipaaAudit("READ", "reconciliation-progress");
    res.json({ success: true, data: sampleReconciliationProgress });
  } catch (error) {
    console.error("[FhirVisualization] Reconciliation progress error:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation progress" });
  }
});

// Individual resource type reconciliation details
router.get("/reconciliation-progress/:resourceType", (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    logHipaaAudit("READ", `reconciliation-${resourceType}`);

    const progress = sampleReconciliationProgress.find(
      p => p.resourceType.toLowerCase() === resourceType.toLowerCase()
    );
    if (!progress) {
      return res.status(404).json({ error: "Resource type reconciliation not found" });
    }

    // Generate detailed conflict data
    const conflicts = [];
    for (let i = 0; i < Math.min(progress.conflictingRecords, 10); i++) {
      conflicts.push({
        id: `conflict-${i + 1}`,
        fieldPath: ["name", "birthDate", "address", "telecom", "identifier"][Math.floor(Math.random() * 5)],
        sources: [
          { name: "Primary Care Provider", value: `Value-A-${i}`, confidence: 0.95 },
          { name: "Hospital Network", value: `Value-B-${i}`, confidence: 0.88 },
        ],
        status: ["pending", "resolved", "dismissed"][Math.floor(Math.random() * 3)],
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        ...progress,
        conflicts,
        recentActivity: [
          { action: "auto_merge", count: 15, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
          { action: "manual_resolve", count: 3, timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
          { action: "conflict_detected", count: 5, timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        ],
      },
    });
  } catch (error) {
    console.error("[FhirVisualization] Reconciliation detail error:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation details" });
  }
});

// Gateway metrics endpoint
router.get("/gateway-metrics", (req: Request, res: Response) => {
  try {
    logHipaaAudit("READ", "gateway-metrics");
    res.json({ success: true, data: sampleGatewayMetrics });
  } catch (error) {
    console.error("[FhirVisualization] Gateway metrics error:", error);
    res.status(500).json({ error: "Failed to fetch gateway metrics" });
  }
});

// Individual endpoint metrics
router.get("/gateway-metrics/:endpoint", (req: Request, res: Response) => {
  try {
    const endpoint = decodeURIComponent(req.params.endpoint);
    logHipaaAudit("READ", `gateway-${endpoint}`);

    const metric = sampleGatewayMetrics.find(m => m.endpoint === endpoint);
    if (!metric) {
      return res.status(404).json({ error: "Endpoint metrics not found" });
    }

    // Generate time series data
    const timeSeries = [];
    const now = new Date();
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now);
      time.setHours(time.getHours() - i);
      timeSeries.push({
        time: time.toISOString(),
        requests: Math.round(metric.totalRequests / 24 + (Math.random() - 0.5) * 50),
        errors: Math.round(Math.random() * 3),
        avgLatency: Math.round(metric.avgResponseTime + (Math.random() - 0.5) * 30),
        p95Latency: Math.round(metric.p95ResponseTime + (Math.random() - 0.5) * 50),
      });
    }

    res.json({
      success: true,
      data: {
        ...metric,
        timeSeries,
        errorBreakdown: [
          { code: 400, count: Math.round(metric.failedRequests * 0.3), description: "Bad Request" },
          { code: 401, count: Math.round(metric.failedRequests * 0.1), description: "Unauthorized" },
          { code: 404, count: Math.round(metric.failedRequests * 0.2), description: "Not Found" },
          { code: 500, count: Math.round(metric.failedRequests * 0.25), description: "Internal Server Error" },
          { code: 503, count: Math.round(metric.failedRequests * 0.15), description: "Service Unavailable" },
        ],
      },
    });
  } catch (error) {
    console.error("[FhirVisualization] Gateway metric detail error:", error);
    res.status(500).json({ error: "Failed to fetch gateway metric details" });
  }
});

// Health check
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// AI-powered FHIR data visualization endpoints
router.get("/patient-data/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("READ", `fhir-visualization-data-${patientId}`);
    const data = fhirVisualizationService.getVisualizationData(patientId);
    res.json(data);
  } catch (error) {
    console.error("[FhirVisualization] Patient data error:", error);
    res.status(500).json({ error: "Failed to fetch visualization data" });
  }
});

router.get("/ai-recommendations/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("READ", `ai-chart-recommendations-${patientId}`);
    const recommendations = await fhirVisualizationService.getChartRecommendations(patientId);
    res.json(recommendations);
  } catch (error) {
    console.error("[FhirVisualization] AI recommendations error:", error);
    res.status(500).json({ error: "Failed to generate chart recommendations" });
  }
});

router.get("/observation-trends/:patientId/:type", async (req: Request, res: Response) => {
  try {
    const { patientId, type } = req.params;
    logHipaaAudit("READ", `observation-trends-${patientId}-${type}`);
    const trends = fhirVisualizationService.getObservationTrends(patientId, type);
    res.json(trends);
  } catch (error) {
    console.error("[FhirVisualization] Observation trends error:", error);
    res.status(500).json({ error: "Failed to fetch observation trends" });
  }
});

router.get("/conditions-summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("READ", `conditions-summary-${patientId}`);
    const conditions = fhirVisualizationService.getConditionSummaries(patientId);
    res.json(conditions);
  } catch (error) {
    console.error("[FhirVisualization] Conditions summary error:", error);
    res.status(500).json({ error: "Failed to fetch condition summaries" });
  }
});

router.get("/medications-summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("READ", `medications-summary-${patientId}`);
    const medications = fhirVisualizationService.getMedicationSummaries(patientId);
    res.json(medications);
  } catch (error) {
    console.error("[FhirVisualization] Medications summary error:", error);
    res.status(500).json({ error: "Failed to fetch medication summaries" });
  }
});

export default router;
