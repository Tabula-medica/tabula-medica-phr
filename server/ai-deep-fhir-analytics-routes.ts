import { Express } from "express";
import { aiDeepFHIRAnalyticsService } from "./services/ai-deep-fhir-analytics-service";

export function registerAIDeepFHIRAnalyticsRoutes(app: Express): void {
  const BASE_PATH = "/api/deep-fhir-analytics";

  app.get(`${BASE_PATH}/metadata`, async (req, res) => {
    try {
      const metadata = await aiDeepFHIRAnalyticsService.getMetadata();
      res.json(metadata);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Metadata error:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  app.get(`${BASE_PATH}/dashboard`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const dashboard = await aiDeepFHIRAnalyticsService.getDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  app.post(`${BASE_PATH}/predictive-analysis`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { analysisType, patientId, populationCriteria, timeframe } = req.body;
      
      if (!analysisType) {
        return res.status(400).json({ error: "analysisType is required" });
      }

      const analysis = await aiDeepFHIRAnalyticsService.generatePredictiveAnalysis(userId, {
        analysisType,
        patientId,
        populationCriteria,
        timeframe,
      });
      res.json(analysis);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Predictive analysis error:", error);
      res.status(500).json({ error: "Failed to generate predictive analysis" });
    }
  });

  app.get(`${BASE_PATH}/predictions`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const predictions = await aiDeepFHIRAnalyticsService.getPredictions(userId);
      res.json({ predictions });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Get predictions error:", error);
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  app.post(`${BASE_PATH}/at-risk-populations`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { riskCategory, criteria } = req.body;
      
      if (!riskCategory) {
        return res.status(400).json({ error: "riskCategory is required" });
      }

      const population = await aiDeepFHIRAnalyticsService.identifyAtRiskPopulations(userId, {
        riskCategory,
        criteria,
      });
      res.json(population);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] At-risk population error:", error);
      res.status(500).json({ error: "Failed to identify at-risk populations" });
    }
  });

  app.post(`${BASE_PATH}/natural-language-query`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }

      const result = await aiDeepFHIRAnalyticsService.processNaturalLanguageQuery(userId, query);
      res.json(result);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] NL query error:", error);
      res.status(500).json({ error: "Failed to process natural language query" });
    }
  });

  app.get(`${BASE_PATH}/query-history`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const limit = parseInt(req.query.limit as string) || 20;
      const queries = await aiDeepFHIRAnalyticsService.getQueryHistory(userId, limit);
      res.json({ queries });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Query history error:", error);
      res.status(500).json({ error: "Failed to fetch query history" });
    }
  });

  app.post(`${BASE_PATH}/detect-anomalies`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { detectionType, resourceType, scope } = req.body;

      const anomalies = await aiDeepFHIRAnalyticsService.detectAnomalies(userId, {
        detectionType,
        resourceType,
        scope,
      });
      res.json({ anomalies });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Anomaly detection error:", error);
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  app.get(`${BASE_PATH}/anomalies`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { status, severity, type } = req.query;
      
      const anomalies = await aiDeepFHIRAnalyticsService.getAnomalies(userId, {
        status: status as string,
        severity: severity as string,
        type: type as string,
      });
      res.json({ anomalies });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Get anomalies error:", error);
      res.status(500).json({ error: "Failed to fetch anomalies" });
    }
  });

  app.patch(`${BASE_PATH}/anomalies/:anomalyId/status`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { anomalyId } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const anomaly = await aiDeepFHIRAnalyticsService.updateAnomalyStatus(userId, anomalyId, status);
      if (!anomaly) {
        return res.status(404).json({ error: "Anomaly not found" });
      }
      res.json(anomaly);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Update anomaly status error:", error);
      res.status(500).json({ error: "Failed to update anomaly status" });
    }
  });

  app.post(`${BASE_PATH}/health-trend-forecast`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { forecastType, condition, timeHorizon } = req.body;
      
      if (!forecastType) {
        return res.status(400).json({ error: "forecastType is required" });
      }

      const forecast = await aiDeepFHIRAnalyticsService.generateHealthTrendForecast(userId, {
        forecastType,
        condition,
        timeHorizon,
      });
      res.json(forecast);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Health trend forecast error:", error);
      res.status(500).json({ error: "Failed to generate health trend forecast" });
    }
  });

  app.get(`${BASE_PATH}/forecasts`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const forecasts = await aiDeepFHIRAnalyticsService.getForecasts(userId);
      res.json({ forecasts });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Get forecasts error:", error);
      res.status(500).json({ error: "Failed to fetch forecasts" });
    }
  });

  console.log("[AIDeepFHIRAnalytics] Routes registered at /api/deep-fhir-analytics/*");
  console.log("[AIDeepFHIRAnalytics] Endpoints: /dashboard, /predictive-analysis, /at-risk-populations, /natural-language-query, /detect-anomalies, /health-trend-forecast");
}
