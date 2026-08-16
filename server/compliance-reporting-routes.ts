import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { 
  aiComplianceReportingService, 
  ReportType, 
  ExportFormat,
  RegulatoryFramework 
} from "./services/ai-compliance-reporting";

import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  const userId = getUserId(req);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else {
      sanitized[key] = value;
    }
  }
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "ComplianceReportingAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitized
  })}`);
}

const generateReportSchema = z.object({
  reportType: z.enum(["compliance", "risk_assessment", "remediation", "trend_analysis", "comprehensive"]),
  dateRange: z.object({
    startDate: z.string().refine(d => !isNaN(Date.parse(d)), "Invalid start date"),
    endDate: z.string().refine(d => !isNaN(Date.parse(d)), "Invalid end date")
  }),
  options: z.object({
    includeRemediation: z.boolean().optional(),
    includeHistorical: z.boolean().optional(),
    frameworks: z.array(z.enum(["HIPAA", "GDPR", "SOC2", "HITECH", "CCPA", "NIST", "PCI_DSS", "FDA"])).optional()
  }).optional()
});

const listReportsSchema = z.object({
  reportType: z.enum(["compliance", "risk_assessment", "remediation", "trend_analysis", "comprehensive"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const exportCsvSchema = z.object({
  section: z.enum(["findings", "remediation", "regulatory", "risks"])
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const parseResult = generateReportSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: parseResult.error.errors
      });
    }
    
    const { reportType, dateRange, options } = parseResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("GENERATE_COMPLIANCE_REPORT", "compliance_report", req, {
      reportType,
      dateRange,
      options
    });
    
    const report = await aiComplianceReportingService.generateComplianceReport(
      reportType as ReportType,
      dateRange,
      userId,
      options as any
    );
    
    res.status(201).json(report);
  } catch (error) {
    console.error("[ComplianceReportingAPI] Generate error:", error);
    res.status(500).json({ error: "Failed to generate compliance report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    const parseResult = listReportsSchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid filter parameters",
        details: parseResult.error.errors
      });
    }
    
    logHipaaAudit("LIST_COMPLIANCE_REPORTS", "compliance_reports", req, { filters: parseResult.data });
    
    const reports = aiComplianceReportingService.listReports(parseResult.data as any);
    
    res.json({
      reports: reports.map(r => ({
        id: r.id,
        title: r.title,
        reportType: r.reportType,
        generatedAt: r.generatedAt,
        dateRange: r.dateRange,
        overallRiskLevel: r.executiveSummary.overallRiskLevel,
        overallComplianceScore: r.executiveSummary.overallComplianceScore,
        findingsCount: r.findings.length
      })),
      total: reports.length
    });
  } catch (error) {
    console.error("[ComplianceReportingAPI] List error:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

router.get("/reports/:id", async (req: Request, res: Response) => {
  try {
    const report = aiComplianceReportingService.getReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    logHipaaAudit("VIEW_COMPLIANCE_REPORT", "compliance_report", req, { reportId: req.params.id });
    
    res.json(report);
  } catch (error) {
    console.error("[ComplianceReportingAPI] Get error:", error);
    res.status(500).json({ error: "Failed to retrieve report" });
  }
});

router.get("/reports/:id/export/pdf", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("EXPORT_REPORT_PDF", "compliance_report", req, { reportId: req.params.id });
    
    const pdfBuffer = await aiComplianceReportingService.exportToPDF(req.params.id, userId);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="compliance-report-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    if (error.message === "Report not found") {
      return res.status(404).json({ error: "Report not found" });
    }
    console.error("[ComplianceReportingAPI] PDF export error:", error);
    res.status(500).json({ error: "Failed to export report as PDF" });
  }
});

router.get("/reports/:id/export/csv", async (req: Request, res: Response) => {
  try {
    const parseResult = exportCsvSchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid section parameter",
        details: parseResult.error.errors,
        validSections: ["findings", "remediation", "regulatory", "risks"]
      });
    }
    
    const userId = getUserId(req);
    const { section } = parseResult.data;
    
    logHipaaAudit("EXPORT_REPORT_CSV", "compliance_report", req, { 
      reportId: req.params.id,
      section 
    });
    
    const csvContent = aiComplianceReportingService.exportToCSV(req.params.id, userId, section);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="compliance-${section}-${req.params.id}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    if (error.message === "Report not found") {
      return res.status(404).json({ error: "Report not found" });
    }
    console.error("[ComplianceReportingAPI] CSV export error:", error);
    res.status(500).json({ error: "Failed to export report as CSV" });
  }
});

router.delete("/reports/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("DELETE_COMPLIANCE_REPORT", "compliance_report", req, { reportId: req.params.id });
    
    const deleted = aiComplianceReportingService.deleteReport(req.params.id, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    res.json({ success: true, message: "Report deleted" });
  } catch (error) {
    console.error("[ComplianceReportingAPI] Delete error:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_REPORTS_SUMMARY", "compliance_reports", req, {});
    
    const reports = aiComplianceReportingService.listReports({ limit: 100 });
    
    const reportTypes = reports.reduce((acc, r) => {
      acc[r.reportType] = (acc[r.reportType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgComplianceScore = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.executiveSummary.overallComplianceScore, 0) / reports.length)
      : 0;
    
    const riskLevelCounts = reports.reduce((acc, r) => {
      acc[r.executiveSummary.overallRiskLevel] = (acc[r.executiveSummary.overallRiskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      totalReports: reports.length,
      reportTypes,
      avgComplianceScore,
      riskLevelDistribution: riskLevelCounts,
      lastReportDate: reports[0]?.generatedAt || null
    });
  } catch (error) {
    console.error("[ComplianceReportingAPI] Summary error:", error);
    res.status(500).json({ error: "Failed to get reports summary" });
  }
});

export default router;
