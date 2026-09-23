import { Express } from "express";
import { requireUser, getUserId } from "./middleware/require-user";
import { aiDeepFHIRAnalyticsService } from "./services/ai-deep-fhir-analytics-service";

export function registerAIDeepFHIRAnalyticsRoutes(app: Express): void {
  const BASE_PATH = "/api/deep-fhir-analytics";

  app.get(`${BASE_PATH}/metadata`, requireUser, async (req, res) => {
    try {
      const metadata = await aiDeepFHIRAnalyticsService.getMetadata();
      res.json(metadata);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Metadata error:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  app.get(`${BASE_PATH}/dashboard`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const dashboard = await aiDeepFHIRAnalyticsService.getDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  app.post(`${BASE_PATH}/predictive-analysis`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.get(`${BASE_PATH}/predictions`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const predictions = await aiDeepFHIRAnalyticsService.getPredictions(userId);
      res.json({ predictions });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Get predictions error:", error);
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  app.post(`${BASE_PATH}/at-risk-populations`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.post(`${BASE_PATH}/natural-language-query`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.get(`${BASE_PATH}/query-history`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 20;
      const queries = await aiDeepFHIRAnalyticsService.getQueryHistory(userId, limit);
      res.json({ queries });
    } catch (error) {
      console.error("[AIDeepFHIRAnalytics] Query history error:", error);
      res.status(500).json({ error: "Failed to fetch query history" });
    }
  });

  app.post(`${BASE_PATH}/detect-anomalies`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.get(`${BASE_PATH}/anomalies`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.patch(`${BASE_PATH}/anomalies/:anomalyId/status`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.post(`${BASE_PATH}/health-trend-forecast`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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

  app.get(`${BASE_PATH}/forecasts`, requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
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
