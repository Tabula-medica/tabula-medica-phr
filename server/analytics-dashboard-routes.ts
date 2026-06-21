import { Router, Request, Response } from "express";
import { analyticsDashboardService } from "./services/analytics-dashboard";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][ANALYTICS] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Analytics dashboard audit. Operational metrics only."
  })}`);
}

router.get("/dashboard", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_ANALYTICS_DASHBOARD", {}, req);

  try {
    const { startDate, endDate } = req.query;
    const timeRange = startDate && endDate ? {
      start: startDate as string,
      end: endDate as string
    } : undefined;

    const dashboard = await analyticsDashboardService.getDashboard(timeRange);
    res.json(dashboard);
  } catch (error) {
    console.error("Error getting analytics dashboard:", error);
    res.status(500).json({ error: "Failed to get analytics dashboard" });
  }
});

router.get("/automation", (req: Request, res: Response) => {
  logHIPAAAudit("GET_AUTOMATION_METRICS", {}, req);

  try {
    const metrics = analyticsDashboardService.getAutomationMetrics();
    res.json({
      ...metrics,
      noCdsCompliance: "Automation metrics for operational monitoring."
    });
  } catch (error) {
    console.error("Error getting automation metrics:", error);
    res.status(500).json({ error: "Failed to get automation metrics" });
  }
});

router.get("/risk-scores", (req: Request, res: Response) => {
  logHIPAAAudit("GET_RISK_SCORE_METRICS", {}, req);

  try {
    const metrics = analyticsDashboardService.getRiskScoreMetrics();
    res.json({
      ...metrics,
      noCdsCompliance: "Risk score trends for care coordination. NOT clinical advice."
    });
  } catch (error) {
    console.error("Error getting risk score metrics:", error);
    res.status(500).json({ error: "Failed to get risk score metrics" });
  }
});

router.get("/data-quality", (req: Request, res: Response) => {
  logHIPAAAudit("GET_DATA_QUALITY_METRICS", {}, req);

  try {
    const metrics = analyticsDashboardService.getDataQualityMetrics();
    res.json({
      ...metrics,
      noCdsCompliance: "Data quality metrics for governance monitoring."
    });
  } catch (error) {
    console.error("Error getting data quality metrics:", error);
    res.status(500).json({ error: "Failed to get data quality metrics" });
  }
});

router.get("/security", (req: Request, res: Response) => {
  logHIPAAAudit("GET_SECURITY_METRICS", {}, req);

  try {
    const metrics = analyticsDashboardService.getSecurityComplianceMetrics();
    res.json({
      ...metrics,
      noCdsCompliance: "Security compliance metrics for audit monitoring."
    });
  } catch (error) {
    console.error("Error getting security metrics:", error);
    res.status(500).json({ error: "Failed to get security metrics" });
  }
});

router.get("/engagement", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ENGAGEMENT_METRICS", {}, req);

  try {
    const metrics = analyticsDashboardService.getUserEngagementMetrics();
    res.json({
      ...metrics,
      noCdsCompliance: "User engagement metrics for feature optimization."
    });
  } catch (error) {
    console.error("Error getting engagement metrics:", error);
    res.status(500).json({ error: "Failed to get engagement metrics" });
  }
});

export default router;
