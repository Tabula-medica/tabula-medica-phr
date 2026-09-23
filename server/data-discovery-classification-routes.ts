import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import {
  aiDataDiscoveryClassificationService,
  SensitiveDataType,
  DataSourceType,
  ScanConfiguration,
} from "./services/ai-data-discovery-classification";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    component: "DataDiscoveryClassification",
    details,
  })}`);
}

const sensitiveDataTypes: SensitiveDataType[] = [
  "PHI", "PII", "FINANCIAL", "GENETIC", "MENTAL_HEALTH", "SUBSTANCE_ABUSE",
  "HIV_AIDS", "MINORS", "BIOMETRIC", "LOCATION", "EMPLOYMENT", "INSURANCE", "LEGAL", "RESEARCH"
];

const dataSourceTypes: DataSourceType[] = [
  "fhir_resource", "database_table", "file_storage", "api_endpoint", "ehr_integration", "document", "form_submission"
];

const createDataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(dataSourceTypes as [DataSourceType, ...DataSourceType[]]),
  connectionDetails: z.record(z.string()),
  scanFrequency: z.enum(["daily", "weekly", "monthly", "on_demand"]),
  enabled: z.boolean().default(true),
});

const createPatternSchema = z.object({
  name: z.string().min(1),
  dataType: z.enum(sensitiveDataTypes as [SensitiveDataType, ...SensitiveDataType[]]),
  pattern: z.string().min(1),
  isRegex: z.boolean(),
  description: z.string(),
  examples: z.array(z.string()),
  falsePositiveRate: z.number().min(0).max(1),
  regulatoryBasis: z.array(z.string()),
  enabled: z.boolean().default(true),
});

const scanConfigSchema = z.object({
  dataTypes: z.array(z.enum(sensitiveDataTypes as [SensitiveDataType, ...SensitiveDataType[]])),
  sampleSize: z.number().min(1).max(10000).default(100),
  deepScan: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  contextAnalysis: z.boolean().default(false),
  customPatterns: z.array(z.string()).default([]),
});

const startScanSchema = z.object({
  sourceId: z.string().min(1),
  config: scanConfigSchema,
});

const analyzeContentSchema = z.object({
  content: z.string().min(1),
  context: z.string().optional().default(""),
});

const idParamSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
});

const scanJobIdParamSchema = z.object({
  scanJobId: z.string().uuid().or(z.string().min(1)),
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_CLASSIFICATION_DASHBOARD", {});
    const dashboard = aiDataDiscoveryClassificationService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

router.get("/sources", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_DATA_SOURCES", {});
    const sources = aiDataDiscoveryClassificationService.getDataSources();
    res.json({ success: true, data: sources });
  } catch (error) {
    console.error("[DataDiscoveryClassification] List sources error:", error);
    res.status(500).json({ success: false, error: "Failed to list sources" });
  }
});

router.get("/sources/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid source ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("VIEW_DATA_SOURCE", { sourceId: hashIdentifier(id) });
    const source = aiDataDiscoveryClassificationService.getDataSource(id);
    if (!source) {
      return res.status(404).json({ success: false, error: "Source not found" });
    }
    res.json({ success: true, data: source });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Get source error:", error);
    res.status(500).json({ success: false, error: "Failed to get source" });
  }
});

router.post("/sources", async (req: Request, res: Response) => {
  try {
    const parseResult = createDataSourceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error });
    }

    logHipaaAudit("CREATE_DATA_SOURCE", { name: parseResult.data.name, type: parseResult.data.type });
    const source = aiDataDiscoveryClassificationService.createDataSource(parseResult.data);
    res.status(201).json({ success: true, data: source });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Create source error:", error);
    res.status(500).json({ success: false, error: "Failed to create source" });
  }
});

router.get("/patterns", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_DETECTION_PATTERNS", {});
    const patterns = aiDataDiscoveryClassificationService.getPatterns();
    res.json({ success: true, data: patterns });
  } catch (error) {
    console.error("[DataDiscoveryClassification] List patterns error:", error);
    res.status(500).json({ success: false, error: "Failed to list patterns" });
  }
});

router.post("/patterns", async (req: Request, res: Response) => {
  try {
    const parseResult = createPatternSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error });
    }

    logHipaaAudit("CREATE_DETECTION_PATTERN", { name: parseResult.data.name, dataType: parseResult.data.dataType });
    const pattern = aiDataDiscoveryClassificationService.createPattern(parseResult.data);
    res.status(201).json({ success: true, data: pattern });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Create pattern error:", error);
    res.status(500).json({ success: false, error: "Failed to create pattern" });
  }
});

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const parseResult = startScanSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error });
    }

    const userId = getUserId(req);
    logHipaaAudit("START_DATA_SCAN", { sourceId: hashIdentifier(parseResult.data.sourceId), userId: hashIdentifier(userId) });
    
    const job = await aiDataDiscoveryClassificationService.scanDataSource(
      parseResult.data.sourceId,
      parseResult.data.config as ScanConfiguration,
      userId
    );
    res.status(202).json({ success: true, data: job });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Start scan error:", error);
    res.status(500).json({ success: false, error: "Failed to start scan" });
  }
});

router.get("/scans", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_SCAN_JOBS", {});
    const jobs = aiDataDiscoveryClassificationService.getScanJobs();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error("[DataDiscoveryClassification] List scans error:", error);
    res.status(500).json({ success: false, error: "Failed to list scans" });
  }
});

router.get("/scans/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid scan job ID" });
    }
    const { id } = paramResult.data;
    logHipaaAudit("VIEW_SCAN_JOB", { jobId: hashIdentifier(id) });
    const job = aiDataDiscoveryClassificationService.getScanJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: "Scan job not found" });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Get scan error:", error);
    res.status(500).json({ success: false, error: "Failed to get scan" });
  }
});

router.get("/discoveries", async (req: Request, res: Response) => {
  try {
    const filters: { sourceId?: string; dataType?: SensitiveDataType; needsReview?: boolean } = {};
    
    if (req.query.sourceId) {
      filters.sourceId = req.query.sourceId as string;
    }
    if (req.query.dataType) {
      const dataType = req.query.dataType as string;
      if (sensitiveDataTypes.includes(dataType as SensitiveDataType)) {
        filters.dataType = dataType as SensitiveDataType;
      }
    }
    if (req.query.needsReview !== undefined) {
      filters.needsReview = req.query.needsReview === "true";
    }

    logHipaaAudit("LIST_DISCOVERIES", { filters });
    const discoveries = aiDataDiscoveryClassificationService.getDiscoveredData(filters);
    res.json({ success: true, data: discoveries });
  } catch (error) {
    console.error("[DataDiscoveryClassification] List discoveries error:", error);
    res.status(500).json({ success: false, error: "Failed to list discoveries" });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const discoveredDataId = req.query.discoveredDataId as string | undefined;
    logHipaaAudit("LIST_CLASSIFICATION_SUGGESTIONS", { discoveredDataId: discoveredDataId ? hashIdentifier(discoveredDataId) : undefined });
    const suggestions = aiDataDiscoveryClassificationService.getClassificationSuggestions(discoveredDataId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("[DataDiscoveryClassification] List suggestions error:", error);
    res.status(500).json({ success: false, error: "Failed to list suggestions" });
  }
});

router.post("/suggestions/:id/approve", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    logHipaaAudit("APPROVE_CLASSIFICATION_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const suggestion = await aiDataDiscoveryClassificationService.approveSuggestion(id, userId);
    res.json({ success: true, data: suggestion });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Approve suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to approve suggestion" });
  }
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    logHipaaAudit("REJECT_CLASSIFICATION_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const suggestion = await aiDataDiscoveryClassificationService.rejectSuggestion(id, userId);
    res.json({ success: true, data: suggestion });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Reject suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to reject suggestion" });
  }
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const parseResult = analyzeContentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error });
    }

    logHipaaAudit("AI_CONTENT_ANALYSIS", { contentLength: parseResult.data.content.length });
    const analysis = await aiDataDiscoveryClassificationService.analyzeWithAI(
      parseResult.data.content,
      parseResult.data.context
    );
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Analyze content error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze content" });
  }
});

router.get("/reports/:scanJobId", async (req: Request, res: Response) => {
  try {
    const paramResult = scanJobIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid scan job ID" });
    }
    const { scanJobId } = paramResult.data;
    logHipaaAudit("GENERATE_CLASSIFICATION_REPORT", { scanJobId: hashIdentifier(scanJobId) });
    const report = await aiDataDiscoveryClassificationService.generateClassificationReport(scanJobId);
    res.json({ success: true, data: report });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Generate report error:", error);
    res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});

router.get("/governance-integration", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_GOVERNANCE_INTEGRATION", {});
    
    const dashboard = aiDataDiscoveryClassificationService.getDashboard();
    const discoveries = aiDataDiscoveryClassificationService.getDiscoveredData({ needsReview: true });
    const suggestions = aiDataDiscoveryClassificationService.getClassificationSuggestions();
    
    const pendingSuggestions = suggestions.filter(s => s.status === "pending");
    const acceptedSuggestions = suggestions.filter(s => s.status === "accepted");
    
    const dataTypeDistribution: Record<string, number> = {};
    for (const discovery of discoveries) {
      for (const dataType of discovery.detectedDataTypes) {
        dataTypeDistribution[dataType] = (dataTypeDistribution[dataType] || 0) + 1;
      }
    }
    
    const governanceView = {
      summary: {
        totalDataSources: dashboard.totalDataSources,
        discoveredSensitiveData: dashboard.discoveredSensitiveData,
        pendingClassifications: dashboard.pendingClassifications,
        classificationCoverage: dashboard.classificationCoverage,
        complianceScore: dashboard.complianceScore,
      },
      dataTypeDistribution,
      pendingActions: {
        reviewsNeeded: discoveries.length,
        suggestionsToReview: pendingSuggestions.length,
        recentlyApproved: acceptedSuggestions.length,
      },
      topSensitiveDataTypes: dashboard.topSensitiveDataTypes,
      recentScans: dashboard.recentScans.slice(0, 3),
      governanceRecommendations: [
        discoveries.length > 10 
          ? { priority: "high", action: "Review pending classifications", count: discoveries.length }
          : null,
        pendingSuggestions.length > 5
          ? { priority: "medium", action: "Process classification suggestions", count: pendingSuggestions.length }
          : null,
        dashboard.classificationCoverage < 80
          ? { priority: "high", action: "Improve classification coverage", target: "80%", current: `${dashboard.classificationCoverage}%` }
          : null,
      ].filter(Boolean),
      lastUpdated: new Date().toISOString(),
    };
    
    res.json({ success: true, data: governanceView });
  } catch (error) {
    console.error("[DataDiscoveryClassification] Governance integration error:", error);
    res.status(500).json({ success: false, error: "Failed to get governance integration view" });
  }
});

export default router;
