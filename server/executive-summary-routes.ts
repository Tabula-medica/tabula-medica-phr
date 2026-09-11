import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiExecutiveSummaryService, ReportPeriod } from "./services/ai-executive-summary";
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

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  const userId = getUserId(req);
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "ExecutiveSummaryAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitizeDetails(details),
  })}`);
}

const generateReportSchema = z.object({
  reportType: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
});

const listReportsSchema = z.object({
  reportType: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]).optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { reportType, startDate, endDate } = generateReportSchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("GENERATE_EXECUTIVE_SUMMARY", "report", req, { reportType, startDate, endDate });

    const report = await aiExecutiveSummaryService.generateExecutiveSummary(
      reportType as ReportPeriod,
      startDate,
      endDate,
      userId
    );

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[ExecutiveSummaryAPI] Generate error:", error);
    res.status(500).json({ error: "Failed to generate executive summary" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    const filters = listReportsSchema.parse(req.query);
    logHipaaAudit("LIST_EXECUTIVE_REPORTS", "reports", req, { filters });

    const reports = aiExecutiveSummaryService.listReports(filters as any);
    res.json(reports);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[ExecutiveSummaryAPI] List error:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

router.get("/reports/:id", async (req: Request, res: Response) => {
  try {
    const report = aiExecutiveSummaryService.getReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    logHipaaAudit("VIEW_EXECUTIVE_REPORT", "report", req, { reportId: req.params.id });
    res.json(report);
  } catch (error) {
    console.error("[ExecutiveSummaryAPI] Get error:", error);
    res.status(500).json({ error: "Failed to retrieve report" });
  }
});

router.post("/reports/:id/regenerate-insights", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("REGENERATE_INSIGHTS", "report", req, { reportId: req.params.id });

    const report = await aiExecutiveSummaryService.regenerateInsights(req.params.id, userId);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    console.error("[ExecutiveSummaryAPI] Regenerate error:", error);
    res.status(500).json({ error: "Failed to regenerate insights" });
  }
});

export default router;
