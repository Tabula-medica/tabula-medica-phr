import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getAllHEDISMeasures,
  getHEDISMeasureDefinition,
  calculateHEDISResults,
  createReportConfiguration,
  getReportConfiguration,
  listReportConfigurations,
  generateReport,
  generateCSVExport,
  generatePDFExport,
  validateDownloadToken,
  getExportContent,
  scheduleReportDelivery,
  getReportDeliveryStatus,
  getACODashboardData,
  getReportTemplates,
  getReportTemplate,
  getGeneratedReport,
  listGeneratedReports,
  recordReportAccess,
  HEDISMeasureCode,
  ReportType,
  ExportFormat,
  DeliveryMethod
} from "../services/aco-payer-reporting-service";

const router = Router();

const hedisCodeSchema = z.enum([
  "BCS", "CCS", "COL", "CHL", "CDC", "CWP", "CBP",
  "SPR", "AMM", "FUH", "FUM", "ADD", "PCR", "IMA",
  "W34", "AWC", "AAB", "CIS", "LSC", "PPC", "WCC"
]);

const reportFilterSchema = z.object({
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  providers: z.array(z.string()).optional(),
  patientPopulation: z.array(z.string()).optional(),
  measureCodes: z.array(hedisCodeSchema).optional(),
  riskLevels: z.array(z.enum(["low", "moderate", "high", "critical"])).optional(),
  ageGroups: z.array(z.string()).optional(),
  payerIds: z.array(z.string()).optional(),
  facilityIds: z.array(z.string()).optional(),
  diagnosisCodes: z.array(z.string()).optional()
});

const reportSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["summary", "chart", "table", "metrics", "narrative", "compliance_checklist"]),
  order: z.number(),
  dataSource: z.string(),
  visualizationType: z.enum(["bar", "line", "pie", "heatmap", "table", "scorecard"]).optional(),
  columns: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  includeInExport: z.boolean()
});

const createReportConfigSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  type: z.enum(["quality_metrics", "population_health", "provider_performance", "compliance_audit", "financial_summary", "care_gap_analysis", "risk_stratification", "utilization_review"]),
  filters: reportFilterSchema,
  sections: z.array(reportSectionSchema),
  exportFormats: z.array(z.enum(["csv", "pdf", "json", "excel"])),
  createdBy: z.string(),
  isTemplate: z.boolean().optional().default(false),
  organizationId: z.string()
});

const generateReportSchema = z.object({
  configId: z.string(),
  generatedBy: z.string(),
  overrideFilters: reportFilterSchema.partial().optional()
});

const hedisCalculationSchema = z.object({
  organizationId: z.string(),
  measureCodes: z.array(hedisCodeSchema),
  filters: reportFilterSchema
});

const exportReportSchema = z.object({
  reportId: z.string(),
  userId: z.string(),
  format: z.enum(["csv", "pdf"])
});

const scheduleDeliverySchema = z.object({
  reportId: z.string(),
  scheduledBy: z.string(),
  recipients: z.array(z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.string(),
    deliveryMethod: z.enum(["download", "email", "secure_portal", "sftp"]),
    encryptionRequired: z.boolean()
  }))
});

const recordAccessSchema = z.object({
  reportId: z.string(),
  userId: z.string(),
  userName: z.string(),
  action: z.enum(["view", "download", "share", "print"]),
  ipAddress: z.string().optional().default("unknown"),
  userAgent: z.string().optional().default("unknown")
});

router.get("/dashboard/:organizationId", async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const dashboardData = getACODashboardData(organizationId);
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
  }
});

router.get("/hedis/measures", async (_req: Request, res: Response) => {
  try {
    const measures = getAllHEDISMeasures();
    res.json({ success: true, data: measures });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch HEDIS measures" });
  }
});

router.get("/hedis/measures/:code", async (req: Request, res: Response) => {
  try {
    const measure = getHEDISMeasureDefinition(req.params.code as HEDISMeasureCode);
    if (!measure) {
      return res.status(404).json({ success: false, error: "HEDIS measure not found" });
    }
    res.json({ success: true, data: measure });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch HEDIS measure" });
  }
});

router.post("/hedis/calculate", async (req: Request, res: Response) => {
  try {
    const validation = hedisCalculationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    
    const { organizationId, measureCodes, filters } = validation.data;
    const results = calculateHEDISResults(
      organizationId, 
      measureCodes as HEDISMeasureCode[], 
      { ...filters, measureCodes: filters.measureCodes as HEDISMeasureCode[] | undefined }
    );
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to calculate HEDIS results" });
  }
});

router.get("/templates", async (_req: Request, res: Response) => {
  try {
    const templates = getReportTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch report templates" });
  }
});

router.get("/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const template = getReportTemplate(req.params.templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch template" });
  }
});

router.post("/configurations", async (req: Request, res: Response) => {
  try {
    const validation = createReportConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    
    const configData = {
      ...validation.data,
      filters: {
        ...validation.data.filters,
        measureCodes: validation.data.filters.measureCodes as HEDISMeasureCode[] | undefined
      }
    };
    const config = createReportConfiguration(configData as any);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create report configuration" });
  }
});

router.get("/configurations", async (req: Request, res: Response) => {
  try {
    const { organizationId, type } = req.query;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization ID required" });
    }
    
    const configs = listReportConfigurations(
      organizationId as string, 
      type as ReportType | undefined
    );
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch configurations" });
  }
});

router.get("/configurations/:configId", async (req: Request, res: Response) => {
  try {
    const config = getReportConfiguration(req.params.configId);
    if (!config) {
      return res.status(404).json({ success: false, error: "Configuration not found" });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch configuration" });
  }
});

router.post("/reports/generate", async (req: Request, res: Response) => {
  try {
    const validation = generateReportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    
    const { configId, generatedBy, overrideFilters } = validation.data;
    const typedFilters = overrideFilters ? {
      ...overrideFilters,
      measureCodes: overrideFilters.measureCodes as HEDISMeasureCode[] | undefined
    } : undefined;
    const report = await generateReport(configId, generatedBy, typedFilters as any);
    res.status(201).json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to generate report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    const { organizationId, type, status } = req.query;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization ID required" });
    }
    
    const reports = listGeneratedReports(organizationId as string, {
      type: type as ReportType | undefined,
      status: status as any
    });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch reports" });
  }
});

router.get("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const report = getGeneratedReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    
    const userId = req.query.userId as string || (req as any).user?.id || "anonymous";
    const ipAddress = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    
    recordReportAccess(
      req.params.reportId,
      userId,
      "Report Viewer",
      "view",
      ipAddress,
      userAgent
    );
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch report" });
  }
});

router.post("/reports/:reportId/export/csv", async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }
    
    const exportRecord = generateCSVExport(reportId, userId);
    res.json({ success: true, data: exportRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to export CSV" });
  }
});

router.post("/reports/:reportId/export/pdf", async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }
    
    const exportRecord = generatePDFExport(reportId, userId);
    res.json({ success: true, data: exportRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to export PDF" });
  }
});

router.get("/download/:exportId", async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    const { token, userId } = req.query;
    
    if (!token) {
      return res.status(400).json({ success: false, error: "Download token required" });
    }
    
    const validation = validateDownloadToken(token as string);
    if (!validation.valid) {
      return res.status(403).json({ success: false, error: validation.reason });
    }
    
    if (validation.exportId !== exportId) {
      return res.status(403).json({ success: false, error: "Token does not match export" });
    }
    
    const content = getExportContent(exportId);
    if (!content) {
      return res.status(404).json({ success: false, error: "Export not found" });
    }

    const requestUserId = (userId as string) || (req as any).user?.id || "anonymous";
    const ipAddress = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    
    recordReportAccess(
      exportId.replace("exp_", "rpt_"),
      requestUserId,
      "Download User",
      "download",
      ipAddress,
      userAgent
    );
    
    res.setHeader("Content-Type", content.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${content.fileName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(content.content);
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to download export" });
  }
});

router.post("/reports/:reportId/delivery", async (req: Request, res: Response) => {
  try {
    const validation = scheduleDeliverySchema.safeParse({
      ...req.body,
      reportId: req.params.reportId
    });
    
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    
    const { reportId, scheduledBy, recipients } = validation.data;
    const deliveries = scheduleReportDelivery(reportId, recipients, scheduledBy);
    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to schedule delivery" });
  }
});

router.get("/reports/:reportId/delivery/status", async (req: Request, res: Response) => {
  try {
    const deliveries = getReportDeliveryStatus(req.params.reportId);
    res.json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch delivery status" });
  }
});

router.post("/reports/:reportId/access", async (req: Request, res: Response) => {
  try {
    const validation = recordAccessSchema.safeParse({
      ...req.body,
      reportId: req.params.reportId
    });
    
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    
    const { reportId, userId, userName, action, ipAddress, userAgent } = validation.data;
    recordReportAccess(reportId, userId, userName, action, ipAddress, userAgent);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to record access" });
  }
});

router.get("/quality-summary/:organizationId", async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const defaultMeasures: HEDISMeasureCode[] = ["BCS", "CCS", "COL", "CDC", "CBP"];
    
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    
    const results = calculateHEDISResults(organizationId, defaultMeasures, {
      dateRange: {
        start: yearStart.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0]
      }
    });
    
    const overallScore = results.reduce((sum, r) => sum + r.rate, 0) / results.length;
    const starRating = results.reduce((sum, r) => sum + r.starRating, 0) / results.length;
    
    res.json({
      success: true,
      data: {
        overallScore: Math.round(overallScore * 10) / 10,
        avgStarRating: Math.round(starRating * 10) / 10,
        totalMeasures: results.length,
        meetingTarget: results.filter(r => r.rate >= r.targetRate).length,
        belowTarget: results.filter(r => r.rate < r.targetRate).length,
        totalCareGaps: results.reduce((sum, r) => sum + r.gapCount, 0),
        measures: results
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch quality summary" });
  }
});

export function registerACOPayerReportingRoutes(app: any) {
  app.use("/api/aco-reporting", router);
  console.log("[Routes] ACO Payer Reporting routes registered at /api/aco-reporting/*");
}
