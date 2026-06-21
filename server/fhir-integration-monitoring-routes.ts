import type { Express, Request, Response } from "express";
import { fhirIntegrationMonitoringService } from "./services/fhir-integration-monitoring-service";

const HIPAA_DISCLAIMER = "This monitoring data is for operational purposes only. Not for clinical decision-making.";

export function registerFHIRIntegrationMonitoringRoutes(app: Express): void {
  console.log("[HIPAA-AUDIT][FHIRIntegrationMonitoring] Registering FHIR Integration Monitoring routes");

  app.get("/api/fhir-monitoring/dashboard", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][FHIRMonitoring] DASHBOARD_REQUEST - Fetching dashboard summary");
      const summary = fhirIntegrationMonitoringService.getDashboardSummary();
      res.json({ ...summary, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  app.get("/api/fhir-monitoring/endpoints", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][FHIRMonitoring] ENDPOINTS_REQUEST - Fetching integration endpoints");
      const endpoints = fhirIntegrationMonitoringService.getEndpoints();
      res.json({ endpoints, total: endpoints.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Endpoints error:", error);
      res.status(500).json({ error: "Failed to fetch endpoints" });
    }
  });

  app.get("/api/fhir-monitoring/endpoints/:endpointId", async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;
      console.log(`[HIPAA-AUDIT][FHIRMonitoring] ENDPOINT_DETAILS - Fetching endpoint ${endpointId}`);
      
      const endpoint = fhirIntegrationMonitoringService.getEndpointById(endpointId);
      if (!endpoint) {
        return res.status(404).json({ error: "Endpoint not found" });
      }

      const metrics = fhirIntegrationMonitoringService.getTrafficMetrics(endpointId, 24);
      const utilization = fhirIntegrationMonitoringService.getResourceUtilization(endpointId, 24);
      const errors = fhirIntegrationMonitoringService.getErrorLogs(endpointId);
      const alerts = fhirIntegrationMonitoringService.getAlerts().filter(a => a.endpointId === endpointId);

      res.json({
        endpoint,
        metrics,
        utilization,
        errors,
        alerts,
        disclaimer: HIPAA_DISCLAIMER
      });
    } catch (error) {
      console.error("[FHIRMonitoring] Endpoint details error:", error);
      res.status(500).json({ error: "Failed to fetch endpoint details" });
    }
  });

  app.get("/api/fhir-monitoring/traffic", async (req: Request, res: Response) => {
    try {
      const { endpointId, hours } = req.query;
      console.log("[HIPAA-AUDIT][FHIRMonitoring] TRAFFIC_REQUEST - Fetching traffic metrics");
      
      const metrics = fhirIntegrationMonitoringService.getTrafficMetrics(
        endpointId as string | undefined,
        hours ? parseInt(hours as string) : 24
      );

      const aggregated = {
        totalRequests: metrics.reduce((sum, m) => sum + m.requestCount, 0),
        totalErrors: metrics.reduce((sum, m) => sum + m.errorCount, 0),
        avgLatency: metrics.length > 0 
          ? Math.round(metrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / metrics.length)
          : 0,
        totalBytesIn: metrics.reduce((sum, m) => sum + m.bytesIn, 0),
        totalBytesOut: metrics.reduce((sum, m) => sum + m.bytesOut, 0)
      };

      res.json({
        metrics,
        aggregated,
        count: metrics.length,
        disclaimer: HIPAA_DISCLAIMER
      });
    } catch (error) {
      console.error("[FHIRMonitoring] Traffic error:", error);
      res.status(500).json({ error: "Failed to fetch traffic metrics" });
    }
  });

  app.get("/api/fhir-monitoring/live/:endpointId", async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;
      const liveMetrics = fhirIntegrationMonitoringService.getLiveMetrics(endpointId);
      res.json({ ...liveMetrics, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Live metrics error:", error);
      res.status(500).json({ error: "Failed to fetch live metrics" });
    }
  });

  app.get("/api/fhir-monitoring/errors", async (req: Request, res: Response) => {
    try {
      const { endpointId, resolved } = req.query;
      console.log("[HIPAA-AUDIT][FHIRMonitoring] ERRORS_REQUEST - Fetching error logs");
      
      const errors = fhirIntegrationMonitoringService.getErrorLogs(
        endpointId as string | undefined,
        resolved !== undefined ? resolved === 'true' : undefined
      );

      const summary = {
        total: errors.length,
        resolved: errors.filter(e => e.resolved).length,
        unresolved: errors.filter(e => !e.resolved).length,
        byType: errors.reduce((acc, e) => {
          acc[e.errorType] = (acc[e.errorType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      res.json({ errors, summary, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Errors error:", error);
      res.status(500).json({ error: "Failed to fetch error logs" });
    }
  });

  app.patch("/api/fhir-monitoring/errors/:errorId/resolve", async (req: Request, res: Response) => {
    try {
      const { errorId } = req.params;
      const { resolvedBy } = req.body;
      
      const error = fhirIntegrationMonitoringService.resolveError(errorId, resolvedBy || 'system');
      if (!error) {
        return res.status(404).json({ error: "Error not found" });
      }

      res.json({ error, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Resolve error error:", error);
      res.status(500).json({ error: "Failed to resolve error" });
    }
  });

  app.get("/api/fhir-monitoring/alerts", async (req: Request, res: Response) => {
    try {
      const { status, severity } = req.query;
      console.log("[HIPAA-AUDIT][FHIRMonitoring] ALERTS_REQUEST - Fetching monitoring alerts");
      
      const alerts = fhirIntegrationMonitoringService.getAlerts(
        status as string | undefined,
        severity as string | undefined
      );

      const summary = {
        total: alerts.length,
        byStatus: {
          active: alerts.filter(a => a.status === 'active').length,
          acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
          resolved: alerts.filter(a => a.status === 'resolved').length,
          suppressed: alerts.filter(a => a.status === 'suppressed').length
        },
        bySeverity: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length,
          info: alerts.filter(a => a.severity === 'info').length
        }
      };

      res.json({ alerts, summary, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Alerts error:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/fhir-monitoring/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const alert = fhirIntegrationMonitoringService.acknowledgeAlert(alertId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ alert, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Acknowledge alert error:", error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.patch("/api/fhir-monitoring/alerts/:alertId/resolve", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const alert = fhirIntegrationMonitoringService.resolveAlert(alertId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ alert, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Resolve alert error:", error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.patch("/api/fhir-monitoring/alerts/:alertId/suppress", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const alert = fhirIntegrationMonitoringService.suppressAlert(alertId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ alert, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Suppress alert error:", error);
      res.status(500).json({ error: "Failed to suppress alert" });
    }
  });

  app.get("/api/fhir-monitoring/utilization", async (req: Request, res: Response) => {
    try {
      const { endpointId, hours } = req.query;
      console.log("[HIPAA-AUDIT][FHIRMonitoring] UTILIZATION_REQUEST - Fetching resource utilization");
      
      const utilization = fhirIntegrationMonitoringService.getResourceUtilization(
        endpointId as string | undefined,
        hours ? parseInt(hours as string) : 24
      );

      res.json({ utilization, count: utilization.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Utilization error:", error);
      res.status(500).json({ error: "Failed to fetch utilization" });
    }
  });

  app.get("/api/fhir-monitoring/historical/:endpointId", async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;
      const { days } = req.query;
      console.log(`[HIPAA-AUDIT][FHIRMonitoring] HISTORICAL_REQUEST - Fetching historical data for ${endpointId}`);
      
      const historical = fhirIntegrationMonitoringService.getHistoricalData(
        endpointId,
        days ? parseInt(days as string) : 30
      );

      const trends = {
        avgRequestCount: historical.length > 0 
          ? Math.round(historical.reduce((sum, h) => sum + h.requestCount, 0) / historical.length)
          : 0,
        avgErrorRate: historical.length > 0
          ? Math.round(historical.reduce((sum, h) => sum + h.errorRate, 0) / historical.length * 100) / 100
          : 0,
        avgLatency: historical.length > 0
          ? Math.round(historical.reduce((sum, h) => sum + h.avgLatencyMs, 0) / historical.length)
          : 0,
        avgAvailability: historical.length > 0
          ? Math.round(historical.reduce((sum, h) => sum + h.availability, 0) / historical.length * 100) / 100
          : 0
      };

      res.json({ historical, trends, count: historical.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Historical error:", error);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  app.get("/api/fhir-monitoring/alert-rules", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][FHIRMonitoring] ALERT_RULES_REQUEST - Fetching alert rules");
      const rules = fhirIntegrationMonitoringService.getAlertRules();
      res.json({ rules, total: rules.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Alert rules error:", error);
      res.status(500).json({ error: "Failed to fetch alert rules" });
    }
  });

  app.post("/api/fhir-monitoring/alert-rules", async (req: Request, res: Response) => {
    try {
      const ruleData = req.body;
      
      if (!ruleData.name || !ruleData.metric || !ruleData.operator || ruleData.threshold === undefined) {
        return res.status(400).json({ error: "name, metric, operator, and threshold are required" });
      }

      const rule = fhirIntegrationMonitoringService.createAlertRule(ruleData);
      res.status(201).json({ rule, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Create alert rule error:", error);
      res.status(500).json({ error: "Failed to create alert rule" });
    }
  });

  app.patch("/api/fhir-monitoring/alert-rules/:ruleId", async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      
      const rule = fhirIntegrationMonitoringService.updateAlertRule(ruleId, updates);
      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }

      res.json({ rule, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Update alert rule error:", error);
      res.status(500).json({ error: "Failed to update alert rule" });
    }
  });

  app.delete("/api/fhir-monitoring/alert-rules/:ruleId", async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const deleted = fhirIntegrationMonitoringService.deleteAlertRule(ruleId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Alert rule not found" });
      }

      res.json({ success: true, message: "Alert rule deleted", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Delete alert rule error:", error);
      res.status(500).json({ error: "Failed to delete alert rule" });
    }
  });

  app.get("/api/fhir-monitoring/ai-insights", async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.query;
      console.log("[HIPAA-AUDIT][FHIRMonitoring] AI_INSIGHTS_REQUEST - Generating AI insights");
      
      const insights = await fhirIntegrationMonitoringService.generateAIInsights(
        endpointId as string | undefined
      );

      res.json({ 
        ...insights, 
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[FHIRMonitoring] AI insights error:", error);
      res.status(500).json({ error: "Failed to generate AI insights" });
    }
  });

  app.post("/api/fhir-monitoring/record-metric", async (req: Request, res: Response) => {
    try {
      const { endpointId, ...metric } = req.body;
      
      if (!endpointId) {
        return res.status(400).json({ error: "endpointId is required" });
      }

      fhirIntegrationMonitoringService.recordMetric(endpointId, metric);
      res.json({ success: true, message: "Metric recorded", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[FHIRMonitoring] Record metric error:", error);
      res.status(500).json({ error: "Failed to record metric" });
    }
  });

  console.log("[HIPAA-AUDIT][FHIRIntegrationMonitoring] Routes registered successfully at /api/fhir-monitoring/*");
}
