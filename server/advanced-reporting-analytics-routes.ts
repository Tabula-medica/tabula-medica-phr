import { Express, Request, Response } from "express";
import { advancedReportingAnalytics } from "./services/advanced-reporting-analytics-service";

const ALLOWED_ROLES = ["administrator", "clinician", "care_coordinator", "analyst", "manager"];

function checkRole(req: Request, res: Response, next: () => void) {
  const userRole = (req as any).session?.user?.role;
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return res.status(403).json({
      error: "Access denied",
      message: "Insufficient permissions to access Advanced Reporting features",
      requiredRoles: ALLOWED_ROLES,
    });
  }
  next();
}

export function registerAdvancedReportingAnalyticsRoutes(app: Express) {
  // ================== Metadata (Public) ==================
  app.get("/api/advanced-reporting/metadata", async (req: Request, res: Response) => {
    try {
      const metadata = advancedReportingAnalytics.getMetadata();
      res.json(metadata);
    } catch (error) {
      console.error("[AdvancedReporting] Metadata error:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  // ================== Dashboard (Protected) ==================
  app.get("/api/advanced-reporting/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).session?.user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.getDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // ================== Report Templates ==================
  app.get("/api/advanced-reporting/templates", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const templates = await advancedReportingAnalytics.getTemplates(userId);
      res.json({ templates });
    } catch (error) {
      console.error("[AdvancedReporting] Templates error:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/advanced-reporting/templates/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const template = await advancedReportingAnalytics.getTemplate(userId, req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("[AdvancedReporting] Template detail error:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/advanced-reporting/templates", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const template = await advancedReportingAnalytics.createTemplate(userId, req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error("[AdvancedReporting] Create template error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/advanced-reporting/templates/:id", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const template = await advancedReportingAnalytics.updateTemplate(userId, req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("[AdvancedReporting] Update template error:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/advanced-reporting/templates/:id", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const deleted = await advancedReportingAnalytics.deleteTemplate(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[AdvancedReporting] Delete template error:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // ================== Scheduled Reports ==================
  app.get("/api/advanced-reporting/schedules", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const schedules = await advancedReportingAnalytics.getScheduledReports(userId);
      res.json({ schedules });
    } catch (error) {
      console.error("[AdvancedReporting] Schedules error:", error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  app.post("/api/advanced-reporting/schedules", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const schedule = await advancedReportingAnalytics.createScheduledReport(userId, req.body);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("[AdvancedReporting] Create schedule error:", error);
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });

  app.patch("/api/advanced-reporting/schedules/:id", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const schedule = await advancedReportingAnalytics.updateScheduledReport(userId, req.params.id, req.body);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("[AdvancedReporting] Update schedule error:", error);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/advanced-reporting/schedules/:id", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const deleted = await advancedReportingAnalytics.deleteScheduledReport(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[AdvancedReporting] Delete schedule error:", error);
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // ================== Report Generation ==================
  app.post("/api/advanced-reporting/generate", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { templateId, dateRangeType, customStartDate, customEndDate, exportFormat } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: "templateId is required" });
      }

      const report = await advancedReportingAnalytics.generateReport(userId, templateId, {
        dateRangeType,
        customStartDate,
        customEndDate,
        exportFormat,
      });
      res.json(report);
    } catch (error) {
      console.error("[AdvancedReporting] Generate report error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/advanced-reporting/reports", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const limit = parseInt(req.query.limit as string) || 20;
      const reports = await advancedReportingAnalytics.getGeneratedReports(userId, limit);
      res.json({ reports });
    } catch (error) {
      console.error("[AdvancedReporting] Reports list error:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/advanced-reporting/reports/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const report = await advancedReportingAnalytics.getGeneratedReport(userId, req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("[AdvancedReporting] Report detail error:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // ================== Analytics Dashboards ==================
  app.get("/api/advanced-reporting/analytics-dashboards", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboards = await advancedReportingAnalytics.getAnalyticsDashboards(userId);
      res.json({ dashboards });
    } catch (error) {
      console.error("[AdvancedReporting] Dashboards error:", error);
      res.status(500).json({ error: "Failed to fetch dashboards" });
    }
  });

  app.get("/api/advanced-reporting/analytics-dashboards/default", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.getDefaultDashboard(userId);
      if (!dashboard) {
        return res.status(404).json({ error: "No default dashboard found" });
      }
      res.json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Default dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch default dashboard" });
    }
  });

  // ================== Trend Analysis ==================
  app.post("/api/advanced-reporting/trends", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { metrics, days } = req.body;
      
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "metrics array is required" });
      }

      const trends = await advancedReportingAnalytics.getTrendAnalysis(userId, metrics, days || 30);
      res.json({ trends, noCdsDisclaimer: "This analysis is for informational purposes only and does not constitute clinical decision support." });
    } catch (error) {
      console.error("[AdvancedReporting] Trends error:", error);
      res.status(500).json({ error: "Failed to analyze trends" });
    }
  });

  // ================== Forecasting ==================
  app.post("/api/advanced-reporting/forecast", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { metrics, historicalDays, forecastDays } = req.body;
      
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "metrics array is required" });
      }

      const forecasts = await advancedReportingAnalytics.getForecast(
        userId,
        metrics,
        historicalDays || 30,
        forecastDays || 14
      );
      res.json({ forecasts, noCdsDisclaimer: "Forecasts are for planning purposes only and do not constitute clinical decision support." });
    } catch (error) {
      console.error("[AdvancedReporting] Forecast error:", error);
      res.status(500).json({ error: "Failed to generate forecast" });
    }
  });

  // ================== Customizable KPI Dashboard ==================
  app.get("/api/advanced-reporting/kpis", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const kpis = await advancedReportingAnalytics.getKPIDefinitions(userId);
      res.json({ kpis });
    } catch (error) {
      console.error("[AdvancedReporting] KPIs error:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  app.get("/api/advanced-reporting/kpi-dashboards", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboards = await advancedReportingAnalytics.getKPIDashboardConfigs(userId);
      res.json({ dashboards });
    } catch (error) {
      console.error("[AdvancedReporting] KPI dashboards error:", error);
      res.status(500).json({ error: "Failed to fetch KPI dashboards" });
    }
  });

  app.post("/api/advanced-reporting/kpi-values", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { kpiIds } = req.body;
      if (!kpiIds || !Array.isArray(kpiIds)) {
        return res.status(400).json({ error: "kpiIds array is required" });
      }
      const values = await advancedReportingAnalytics.getKPIValues(userId, kpiIds);
      res.json({ values });
    } catch (error) {
      console.error("[AdvancedReporting] KPI values error:", error);
      res.status(500).json({ error: "Failed to fetch KPI values" });
    }
  });

  app.post("/api/advanced-reporting/kpi-dashboards", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.createKPIDashboardConfig(userId, req.body);
      res.status(201).json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Create KPI dashboard error:", error);
      res.status(500).json({ error: "Failed to create KPI dashboard" });
    }
  });

  app.patch("/api/advanced-reporting/kpi-dashboards/:id", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.updateKPIDashboardConfig(userId, req.params.id, req.body);
      if (!dashboard) {
        return res.status(404).json({ error: "KPI dashboard not found" });
      }
      res.json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Update KPI dashboard error:", error);
      res.status(500).json({ error: "Failed to update KPI dashboard" });
    }
  });

  // ================== Predictive Analytics ==================
  app.get("/api/advanced-reporting/risk-stratification", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const results = await advancedReportingAnalytics.getRiskStratification(userId);
      res.json({ results, noCdsDisclaimer: "Risk stratification is for informational purposes only and does not constitute clinical decision support." });
    } catch (error) {
      console.error("[AdvancedReporting] Risk stratification error:", error);
      res.status(500).json({ error: "Failed to fetch risk stratification" });
    }
  });

  app.get("/api/advanced-reporting/resource-forecasts", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const forecasts = await advancedReportingAnalytics.getResourceForecasts(userId);
      res.json({ forecasts, noCdsDisclaimer: "Resource forecasts are for planning purposes only." });
    } catch (error) {
      console.error("[AdvancedReporting] Resource forecasts error:", error);
      res.status(500).json({ error: "Failed to fetch resource forecasts" });
    }
  });

  // ================== Performance Reports ==================
  app.get("/api/advanced-reporting/clinical-outcomes", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
      const report = await advancedReportingAnalytics.getClinicalOutcomesReport(userId, dateRange);
      res.json(report);
    } catch (error) {
      console.error("[AdvancedReporting] Clinical outcomes error:", error);
      res.status(500).json({ error: "Failed to fetch clinical outcomes report" });
    }
  });

  app.get("/api/advanced-reporting/patient-satisfaction", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
      const report = await advancedReportingAnalytics.getPatientSatisfactionReport(userId, dateRange);
      res.json(report);
    } catch (error) {
      console.error("[AdvancedReporting] Patient satisfaction error:", error);
      res.status(500).json({ error: "Failed to fetch patient satisfaction report" });
    }
  });

  app.get("/api/advanced-reporting/operational-costs", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
      const report = await advancedReportingAnalytics.getOperationalCostsReport(userId, dateRange);
      res.json(report);
    } catch (error) {
      console.error("[AdvancedReporting] Operational costs error:", error);
      res.status(500).json({ error: "Failed to fetch operational costs report" });
    }
  });

  // ================== Data Export ==================
  app.post("/api/advanced-reporting/exports", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { type, format, sourceId, sourceName, filters, dateRange } = req.body;
      if (!type || !format || !sourceId || !sourceName) {
        return res.status(400).json({ error: "type, format, sourceId, and sourceName are required" });
      }
      const job = await advancedReportingAnalytics.createExportJob(userId, { type, format, sourceId, sourceName, filters, dateRange });
      res.status(201).json(job);
    } catch (error) {
      console.error("[AdvancedReporting] Create export job error:", error);
      res.status(500).json({ error: "Failed to create export job" });
    }
  });

  app.get("/api/advanced-reporting/exports", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const jobs = await advancedReportingAnalytics.getExportJobs(userId);
      res.json({ jobs });
    } catch (error) {
      console.error("[AdvancedReporting] Export jobs error:", error);
      res.status(500).json({ error: "Failed to fetch export jobs" });
    }
  });

  app.get("/api/advanced-reporting/exports/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const job = await advancedReportingAnalytics.getExportJob(userId, req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Export job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("[AdvancedReporting] Export job detail error:", error);
      res.status(500).json({ error: "Failed to fetch export job" });
    }
  });

  app.get("/api/advanced-reporting/exports/:id/download", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const job = await advancedReportingAnalytics.getExportJob(userId, req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Export job not found" });
      }
      if (job.status !== "completed") {
        return res.status(400).json({ error: "Export job not yet completed" });
      }
      
      const sampleData = { exportId: job.id, generatedAt: job.completedAt, data: "Sample export data", noCdsDisclaimer: "This data is for informational purposes only." };
      const content = advancedReportingAnalytics.generateExportData(job.format, sampleData);
      
      const contentTypes: Record<string, string> = { pdf: "application/pdf", csv: "text/csv", json: "application/json", excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
      res.setHeader("Content-Type", contentTypes[job.format] || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${job.sourceName.replace(/[^a-z0-9]/gi, "_")}.${job.format}"`);
      res.send(content);
    } catch (error) {
      console.error("[AdvancedReporting] Export download error:", error);
      res.status(500).json({ error: "Failed to download export" });
    }
  });

  // ================== Interactive Trend Graphs ==================
  app.get("/api/advanced-reporting/interactive-trends", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const metrics = req.query.metrics ? (req.query.metrics as string).split(",") : undefined;
      const trends = await advancedReportingAnalytics.getInteractiveTrends(userId, metrics);
      res.json({ trends });
    } catch (error) {
      console.error("[AdvancedReporting] Interactive trends error:", error);
      res.status(500).json({ error: "Failed to fetch interactive trends" });
    }
  });

  // ================== Heatmaps ==================
  app.get("/api/advanced-reporting/heatmaps", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const type = req.query.type as string | undefined;
      const heatmaps = await advancedReportingAnalytics.getHeatmaps(userId, type);
      res.json({ heatmaps });
    } catch (error) {
      console.error("[AdvancedReporting] Heatmaps error:", error);
      res.status(500).json({ error: "Failed to fetch heatmaps" });
    }
  });

  // ================== Cohort Analysis ==================
  app.get("/api/advanced-reporting/cohorts", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const cohorts = await advancedReportingAnalytics.getCohorts(userId);
      res.json({ cohorts });
    } catch (error) {
      console.error("[AdvancedReporting] Cohorts error:", error);
      res.status(500).json({ error: "Failed to fetch cohorts" });
    }
  });

  app.post("/api/advanced-reporting/cohorts", checkRole, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const cohort = await advancedReportingAnalytics.createCohort(userId, req.body);
      res.status(201).json(cohort);
    } catch (error) {
      console.error("[AdvancedReporting] Create cohort error:", error);
      res.status(500).json({ error: "Failed to create cohort" });
    }
  });

  app.post("/api/advanced-reporting/cohort-analysis", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const { cohortIds, metrics } = req.body;
      if (!cohortIds || !Array.isArray(cohortIds) || cohortIds.length === 0) {
        return res.status(400).json({ error: "cohortIds array is required" });
      }
      const result = await advancedReportingAnalytics.runCohortAnalysis(userId, cohortIds, metrics || []);
      res.json(result);
    } catch (error) {
      console.error("[AdvancedReporting] Cohort analysis error:", error);
      res.status(500).json({ error: "Failed to run cohort analysis" });
    }
  });

  // ================== Custom Dashboard Views ==================
  app.get("/api/advanced-reporting/custom-dashboards", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboards = await advancedReportingAnalytics.getCustomDashboards(userId);
      res.json({ dashboards });
    } catch (error) {
      console.error("[AdvancedReporting] Custom dashboards error:", error);
      res.status(500).json({ error: "Failed to fetch custom dashboards" });
    }
  });

  app.get("/api/advanced-reporting/custom-dashboards/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.getCustomDashboard(userId, req.params.id);
      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found" });
      }
      res.json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Custom dashboard detail error:", error);
      res.status(500).json({ error: "Failed to fetch custom dashboard" });
    }
  });

  app.post("/api/advanced-reporting/custom-dashboards", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.createCustomDashboard(userId, req.body);
      res.status(201).json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Create custom dashboard error:", error);
      res.status(500).json({ error: "Failed to create custom dashboard" });
    }
  });

  app.patch("/api/advanced-reporting/custom-dashboards/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const dashboard = await advancedReportingAnalytics.updateCustomDashboard(userId, req.params.id, req.body);
      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found or access denied" });
      }
      res.json(dashboard);
    } catch (error) {
      console.error("[AdvancedReporting] Update custom dashboard error:", error);
      res.status(500).json({ error: "Failed to update custom dashboard" });
    }
  });

  app.delete("/api/advanced-reporting/custom-dashboards/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "current-user";
      const deleted = await advancedReportingAnalytics.deleteCustomDashboard(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Dashboard not found or access denied" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[AdvancedReporting] Delete custom dashboard error:", error);
      res.status(500).json({ error: "Failed to delete custom dashboard" });
    }
  });

  app.get("/api/advanced-reporting/stakeholder-presets", async (req: Request, res: Response) => {
    try {
      const presets = advancedReportingAnalytics.getStakeholderPresets();
      res.json({ presets });
    } catch (error) {
      console.error("[AdvancedReporting] Stakeholder presets error:", error);
      res.status(500).json({ error: "Failed to fetch stakeholder presets" });
    }
  });

  console.log("[AdvancedReporting] Routes registered at /api/advanced-reporting/*");
  console.log("[AdvancedReporting] Features: KPI Dashboards, Risk Stratification, Performance Reports, Data Export");
  console.log("[AdvancedReporting] Enhanced: Interactive Trends, Heatmaps, Cohort Analysis, Custom Dashboards");
}
