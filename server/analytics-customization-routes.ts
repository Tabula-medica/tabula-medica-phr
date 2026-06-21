import { Router, Request, Response } from "express";
import { analyticsCustomizationService } from "./services/analytics-customization";
import { analyticsDashboardService } from "./services/analytics-dashboard";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][ANALYTICS-CUSTOM] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Analytics customization audit. Operational data only."
  })}`);
}

// Available metrics
router.get("/metrics", (req: Request, res: Response) => {
  logHIPAAAudit("GET_AVAILABLE_METRICS", {}, req);
  const metrics = analyticsCustomizationService.getAvailableMetrics();
  res.json({ metrics, noCdsCompliance: "Metric definitions for operational analytics." });
});

// Custom Reports
router.get("/reports", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("GET_CUSTOM_REPORTS", { userId }, req);
  
  try {
    const reports = await analyticsCustomizationService.getReports(userId);
    res.json({ reports, noCdsCompliance: "Custom reports for operational analytics." });
  } catch (error) {
    console.error("Error getting reports:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
});

router.post("/reports", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("CREATE_CUSTOM_REPORT", { userId, reportName: req.body.name }, req);
  
  try {
    const report = await analyticsCustomizationService.createReport(userId, req.body);
    res.status(201).json({ report, noCdsCompliance: "Custom report created for operational analytics." });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

router.put("/reports/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("UPDATE_CUSTOM_REPORT", { reportId: req.params.id }, req);
  
  try {
    const report = await analyticsCustomizationService.updateReport(req.params.id, req.body);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json({ report, noCdsCompliance: "Custom report updated." });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
});

router.delete("/reports/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("DELETE_CUSTOM_REPORT", { reportId: req.params.id }, req);
  
  try {
    const deleted = await analyticsCustomizationService.deleteReport(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// Alert Thresholds
router.get("/thresholds", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("GET_ALERT_THRESHOLDS", { userId }, req);
  
  try {
    const thresholds = await analyticsCustomizationService.getThresholds(userId);
    res.json({ thresholds, noCdsCompliance: "Alert thresholds for operational monitoring." });
  } catch (error) {
    console.error("Error getting thresholds:", error);
    res.status(500).json({ error: "Failed to get thresholds" });
  }
});

router.post("/thresholds", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("CREATE_ALERT_THRESHOLD", { userId, thresholdName: req.body.name }, req);
  
  try {
    const threshold = await analyticsCustomizationService.createThreshold(userId, req.body);
    res.status(201).json({ threshold, noCdsCompliance: "Alert threshold created for operational monitoring." });
  } catch (error) {
    console.error("Error creating threshold:", error);
    res.status(500).json({ error: "Failed to create threshold" });
  }
});

router.put("/thresholds/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("UPDATE_ALERT_THRESHOLD", { thresholdId: req.params.id }, req);
  
  try {
    const threshold = await analyticsCustomizationService.updateThreshold(req.params.id, req.body);
    if (!threshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }
    res.json({ threshold, noCdsCompliance: "Alert threshold updated." });
  } catch (error) {
    console.error("Error updating threshold:", error);
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

router.delete("/thresholds/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("DELETE_ALERT_THRESHOLD", { thresholdId: req.params.id }, req);
  
  try {
    const deleted = await analyticsCustomizationService.deleteThreshold(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Threshold not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting threshold:", error);
    res.status(500).json({ error: "Failed to delete threshold" });
  }
});

// Custom KPIs
router.get("/kpis", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("GET_CUSTOM_KPIS", { userId }, req);
  
  try {
    const kpis = await analyticsCustomizationService.getKPIs(userId);
    res.json({ kpis, noCdsCompliance: "Custom KPIs for operational analytics." });
  } catch (error) {
    console.error("Error getting KPIs:", error);
    res.status(500).json({ error: "Failed to get KPIs" });
  }
});

router.post("/kpis", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("CREATE_CUSTOM_KPI", { userId, kpiName: req.body.name }, req);
  
  try {
    const kpi = await analyticsCustomizationService.createKPI(userId, req.body);
    res.status(201).json({ kpi, noCdsCompliance: "Custom KPI created for operational analytics." });
  } catch (error) {
    console.error("Error creating KPI:", error);
    res.status(500).json({ error: "Failed to create KPI" });
  }
});

router.put("/kpis/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("UPDATE_CUSTOM_KPI", { kpiId: req.params.id }, req);
  
  try {
    const kpi = await analyticsCustomizationService.updateKPI(req.params.id, req.body);
    if (!kpi) {
      return res.status(404).json({ error: "KPI not found" });
    }
    res.json({ kpi, noCdsCompliance: "Custom KPI updated." });
  } catch (error) {
    console.error("Error updating KPI:", error);
    res.status(500).json({ error: "Failed to update KPI" });
  }
});

router.delete("/kpis/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("DELETE_CUSTOM_KPI", { kpiId: req.params.id }, req);
  
  try {
    const deleted = await analyticsCustomizationService.deleteKPI(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "KPI not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting KPI:", error);
    res.status(500).json({ error: "Failed to delete KPI" });
  }
});

// Export
router.post("/exports", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  const { format, dataType, filters } = req.body;
  logHIPAAAudit("REQUEST_EXPORT", { userId, format, dataType }, req);
  
  try {
    const exportRequest = await analyticsCustomizationService.requestExport(userId, format, dataType, filters);
    res.status(202).json({ export: exportRequest, noCdsCompliance: "Export request created for operational data." });
  } catch (error) {
    console.error("Error requesting export:", error);
    res.status(500).json({ error: "Failed to request export" });
  }
});

router.get("/exports", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user-001";
  logHIPAAAudit("GET_EXPORTS", { userId }, req);
  
  try {
    const exports = await analyticsCustomizationService.getExports(userId);
    res.json({ exports, noCdsCompliance: "Export history for operational data." });
  } catch (error) {
    console.error("Error getting exports:", error);
    res.status(500).json({ error: "Failed to get exports" });
  }
});

router.get("/exports/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_EXPORT_STATUS", { exportId: req.params.id }, req);
  
  try {
    const exportRequest = await analyticsCustomizationService.getExportStatus(req.params.id);
    if (!exportRequest) {
      return res.status(404).json({ error: "Export not found" });
    }
    res.json({ export: exportRequest });
  } catch (error) {
    console.error("Error getting export status:", error);
    res.status(500).json({ error: "Failed to get export status" });
  }
});

router.get("/exports/:id/download", async (req: Request, res: Response) => {
  logHIPAAAudit("DOWNLOAD_EXPORT", { exportId: req.params.id }, req);
  
  try {
    const exportRequest = await analyticsCustomizationService.getExportStatus(req.params.id);
    if (!exportRequest) {
      return res.status(404).json({ error: "Export not found" });
    }
    if (exportRequest.status !== "completed") {
      return res.status(400).json({ error: "Export not ready" });
    }

    const dashboard = await analyticsDashboardService.getDashboard();
    
    if (exportRequest.format === "csv") {
      const data = [
        { metric: "Automation Success Rate", value: (dashboard.automation.successRate * 100).toFixed(2), unit: "%" },
        { metric: "Total Jobs", value: dashboard.automation.totalJobs.toString(), unit: "count" },
        { metric: "Failed Jobs", value: dashboard.automation.failedJobs.toString(), unit: "count" },
        { metric: "Avg Processing Time", value: dashboard.automation.averageProcessingTimeMs.toFixed(0), unit: "ms" },
        { metric: "Critical Risk Patients", value: dashboard.riskScores.criticalRiskPatients.toString(), unit: "count" },
        { metric: "High Risk Patients", value: dashboard.riskScores.highRiskPatients.toString(), unit: "count" },
        { metric: "Data Quality Resolution Rate", value: (dashboard.dataQuality.resolutionRate * 100).toFixed(2), unit: "%" },
        { metric: "Pending Issues", value: dashboard.dataQuality.pendingIssues.toString(), unit: "count" },
        { metric: "Compliance Score", value: dashboard.security.overallComplianceScore.toFixed(2), unit: "%" },
        { metric: "Open Vulnerabilities", value: (dashboard.security.totalVulnerabilities - dashboard.security.remediatedVulnerabilities).toString(), unit: "count" },
        { metric: "Daily Active Users", value: dashboard.engagement.dailyActiveUsers.toString(), unit: "count" },
        { metric: "Avg Session Duration", value: dashboard.engagement.averageSessionDurationMinutes.toFixed(1), unit: "minutes" }
      ];
      const csv = analyticsCustomizationService.generateCSV(data, ["metric", "value", "unit"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="healthcare-kpi-export-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      const content = analyticsCustomizationService.generatePDFContent("Healthcare KPI Analytics", dashboard);
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="healthcare-kpi-export-${Date.now()}.txt"`);
      res.send(content);
    }
  } catch (error) {
    console.error("Error downloading export:", error);
    res.status(500).json({ error: "Failed to download export" });
  }
});

export default router;
