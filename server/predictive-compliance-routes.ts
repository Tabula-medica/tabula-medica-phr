import { Router, Request, Response } from "express";
import { aiPredictiveComplianceService } from "./services/ai-predictive-compliance";

const router = Router();

function logHipaaAudit(action: string, resourceType: string, req: Request, details: Record<string, unknown>): void {
  const userId = (req as any).user?.id || "anonymous";
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ${action} | ${resourceType} | User: ${userId} | ${JSON.stringify(details)}`);
}

router.get("/data-sources", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_DATA_SOURCES", "predictive_compliance", req, {});
    const sources = aiPredictiveComplianceService.getDataSources();
    res.json(sources);
  } catch (error) {
    console.error("[PredictiveCompliance] Error fetching data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

router.post("/data-sources", async (req: Request, res: Response) => {
  try {
    const { type, name, refreshIntervalMs, enabled, metadata } = req.body;
    
    if (!type || !name) {
      return res.status(400).json({ error: "type and name are required" });
    }

    logHipaaAudit("ADD_DATA_SOURCE", "predictive_compliance", req, { type, name });
    
    const source = await aiPredictiveComplianceService.addDataSource({
      type,
      name,
      refreshIntervalMs: refreshIntervalMs || 300000,
      enabled: enabled !== false,
      metadata: metadata || {}
    });

    res.status(201).json(source);
  } catch (error) {
    console.error("[PredictiveCompliance] Error adding data source:", error);
    res.status(500).json({ error: "Failed to add data source" });
  }
});

router.post("/data-sources/:sourceId/sync", async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    
    logHipaaAudit("SYNC_DATA_SOURCE", "predictive_compliance", req, { sourceId });
    
    const result = await aiPredictiveComplianceService.syncDataSource(sourceId);
    res.json(result);
  } catch (error: any) {
    console.error("[PredictiveCompliance] Error syncing data source:", error);
    res.status(error.message?.includes("not found") ? 404 : 500).json({ 
      error: error.message || "Failed to sync data source" 
    });
  }
});

router.get("/time-series", async (req: Request, res: Response) => {
  try {
    const { sourceType, category, startDate, endDate, aggregation } = req.query;
    
    if (!sourceType || !category) {
      return res.status(400).json({ error: "sourceType and category are required" });
    }

    logHipaaAudit("VIEW_TIME_SERIES", "predictive_compliance", req, { sourceType, category });

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const data = aiPredictiveComplianceService.getTimeSeriesData(
      sourceType as any,
      category as string,
      start,
      end,
      (aggregation as any) || "daily"
    );

    res.json(data);
  } catch (error) {
    console.error("[PredictiveCompliance] Error fetching time series:", error);
    res.status(500).json({ error: "Failed to fetch time series data" });
  }
});

router.post("/trends/analyze", async (req: Request, res: Response) => {
  try {
    const { category, lookbackDays } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    logHipaaAudit("ANALYZE_TRENDS", "predictive_compliance", req, { category, lookbackDays });

    const analysis = await aiPredictiveComplianceService.analyzeTrends(
      category,
      lookbackDays || 30
    );

    res.json(analysis);
  } catch (error: any) {
    console.error("[PredictiveCompliance] Error analyzing trends:", error);
    res.status(500).json({ error: error.message || "Failed to analyze trends" });
  }
});

router.post("/deviations/predict", async (req: Request, res: Response) => {
  try {
    const { forecastDays } = req.body;
    
    logHipaaAudit("PREDICT_DEVIATIONS", "predictive_compliance", req, { forecastDays });

    const predictions = await aiPredictiveComplianceService.predictDeviations(forecastDays || 14);
    res.json(predictions);
  } catch (error) {
    console.error("[PredictiveCompliance] Error predicting deviations:", error);
    res.status(500).json({ error: "Failed to predict deviations" });
  }
});

router.get("/deviations", async (req: Request, res: Response) => {
  try {
    const { severity, status } = req.query;
    
    logHipaaAudit("LIST_DEVIATIONS", "predictive_compliance", req, { severity, status });

    const deviations = aiPredictiveComplianceService.listDeviations({
      severity: severity as string | undefined,
      status: status as string | undefined
    });

    res.json(deviations);
  } catch (error) {
    console.error("[PredictiveCompliance] Error listing deviations:", error);
    res.status(500).json({ error: "Failed to list deviations" });
  }
});

router.patch("/deviations/:deviationId/status", async (req: Request, res: Response) => {
  try {
    const { deviationId } = req.params;
    const { status } = req.body;
    
    if (!status || !["pending", "acknowledged", "mitigated", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    logHipaaAudit("UPDATE_DEVIATION_STATUS", "predictive_compliance", req, { deviationId, status });

    const deviation = aiPredictiveComplianceService.updateDeviationStatus(deviationId, status);
    
    if (!deviation) {
      return res.status(404).json({ error: "Deviation not found" });
    }

    res.json(deviation);
  } catch (error) {
    console.error("[PredictiveCompliance] Error updating deviation:", error);
    res.status(500).json({ error: "Failed to update deviation" });
  }
});

router.post("/deviations/:deviationId/remediations", async (req: Request, res: Response) => {
  try {
    const { deviationId } = req.params;
    
    logHipaaAudit("GENERATE_REMEDIATIONS", "predictive_compliance", req, { deviationId });

    const suggestions = await aiPredictiveComplianceService.generateRemediationSuggestions(deviationId);
    res.json(suggestions);
  } catch (error: any) {
    console.error("[PredictiveCompliance] Error generating remediations:", error);
    res.status(error.message?.includes("not found") ? 404 : 500).json({ 
      error: error.message || "Failed to generate remediations" 
    });
  }
});

router.get("/remediations", async (req: Request, res: Response) => {
  try {
    const { deviationId, status, priority } = req.query;
    
    logHipaaAudit("LIST_REMEDIATIONS", "predictive_compliance", req, { deviationId, status, priority });

    const remediations = aiPredictiveComplianceService.listRemediations({
      deviationId: deviationId as string | undefined,
      status: status as string | undefined,
      priority: priority as string | undefined
    });

    res.json(remediations);
  } catch (error) {
    console.error("[PredictiveCompliance] Error listing remediations:", error);
    res.status(500).json({ error: "Failed to list remediations" });
  }
});

router.patch("/remediations/:remediationId/status", async (req: Request, res: Response) => {
  try {
    const { remediationId } = req.params;
    const { status } = req.body;
    
    if (!status || !["suggested", "approved", "in_progress", "completed", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    logHipaaAudit("UPDATE_REMEDIATION_STATUS", "predictive_compliance", req, { remediationId, status });

    const remediation = aiPredictiveComplianceService.updateRemediationStatus(remediationId, status);
    
    if (!remediation) {
      return res.status(404).json({ error: "Remediation not found" });
    }

    res.json(remediation);
  } catch (error) {
    console.error("[PredictiveCompliance] Error updating remediation:", error);
    res.status(500).json({ error: "Failed to update remediation" });
  }
});

router.post("/reports/forecast", async (req: Request, res: Response) => {
  try {
    const { forecastDays } = req.body;
    
    logHipaaAudit("GENERATE_FORECAST_REPORT", "predictive_compliance", req, { forecastDays });

    const report = await aiPredictiveComplianceService.generateForecastReport(forecastDays || 30);
    res.json(report);
  } catch (error) {
    console.error("[PredictiveCompliance] Error generating forecast report:", error);
    res.status(500).json({ error: "Failed to generate forecast report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_REPORTS", "predictive_compliance", req, {});

    const reports = aiPredictiveComplianceService.listReports();
    res.json(reports);
  } catch (error) {
    console.error("[PredictiveCompliance] Error listing reports:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

router.get("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    
    logHipaaAudit("VIEW_REPORT", "predictive_compliance", req, { reportId });

    const report = aiPredictiveComplianceService.getReport(reportId);
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    console.error("[PredictiveCompliance] Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_PREDICTIVE_DASHBOARD", "predictive_compliance", req, {});

    const metrics = aiPredictiveComplianceService.getDashboardMetrics();
    const deviations = aiPredictiveComplianceService.listDeviations({ status: "pending" }).slice(0, 5);
    const remediations = aiPredictiveComplianceService.listRemediations({ status: "suggested" }).slice(0, 5);
    const reports = aiPredictiveComplianceService.listReports().slice(0, 3);

    res.json({
      metrics,
      recentDeviations: deviations,
      pendingRemediations: remediations,
      recentReports: reports
    });
  } catch (error) {
    console.error("[PredictiveCompliance] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

export default router;
