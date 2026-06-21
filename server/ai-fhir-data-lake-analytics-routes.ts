import type { Express, Request, Response } from "express";
import { dataLakeAnalyticsService } from "./services/ai-fhir-data-lake-analytics-service";

const HIPAA_DISCLAIMER = "This analysis is for informational and data governance purposes only. Not for clinical decision-making.";

export function registerAIFHIRDataLakeAnalyticsRoutes(app: Express) {
  console.log("[HIPAA-AUDIT][DataLakeAnalytics] Registering AI FHIR Data Lake Analytics routes");

  app.get("/api/data-lake-analytics/metadata", async (_req: Request, res: Response) => {
    try {
      const metrics = dataLakeAnalyticsService.getMetrics();
      
      res.json({
        version: "2.0.0",
        capabilities: [
          "predictive_insights",
          "population_trends",
          "anomaly_detection",
          "quality_metrics",
          "recommendations",
          "custom_reports",
          "ai_analysis"
        ],
        dataLakeMetrics: metrics,
        supportedInsightCategories: [
          "patient_outcome",
          "readmission_risk",
          "disease_progression",
          "resource_utilization",
          "care_gap"
        ],
        supportedTrendCategories: [
          "prevalence",
          "incidence",
          "outcome",
          "utilization",
          "cost"
        ],
        supportedAlertTypes: [
          "data_quality",
          "clinical_pattern",
          "resource_usage",
          "compliance",
          "security"
        ],
        supportedReportTypes: [
          "executive_summary",
          "clinical_quality",
          "population_health",
          "operational",
          "financial",
          "custom"
        ],
        disclaimer: HIPAA_DISCLAIMER
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Metadata error:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  app.get("/api/data-lake-analytics/metrics", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] METRICS_REQUEST - Fetching data lake metrics");
      const metrics = dataLakeAnalyticsService.getMetrics();
      res.json({ metrics, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataLakeAnalytics] Metrics error:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/data-lake-analytics/predictive-insights", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] INSIGHTS_REQUEST - Generating predictive insights");
      const insights = await dataLakeAnalyticsService.getPredictiveInsights();
      res.json({ 
        insights, 
        total: insights.length,
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Predictive insights error:", error);
      res.status(500).json({ error: "Failed to generate predictive insights" });
    }
  });

  app.get("/api/data-lake-analytics/population-trends", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] TRENDS_REQUEST - Analyzing population trends");
      const trends = await dataLakeAnalyticsService.getPopulationTrends();
      res.json({ 
        trends, 
        total: trends.length,
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Population trends error:", error);
      res.status(500).json({ error: "Failed to analyze population trends" });
    }
  });

  app.get("/api/data-lake-analytics/anomaly-alerts", async (req: Request, res: Response) => {
    try {
      const { severity, type, status } = req.query;
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] ALERTS_REQUEST - Fetching anomaly alerts");
      
      let alerts = await dataLakeAnalyticsService.getAnomalyAlerts();
      
      if (severity) {
        alerts = alerts.filter(a => a.severity === severity);
      }
      if (type) {
        alerts = alerts.filter(a => a.type === type);
      }
      if (status) {
        alerts = alerts.filter(a => a.status === status);
      }
      
      const criticalCount = alerts.filter(a => a.severity === 'critical').length;
      const highCount = alerts.filter(a => a.severity === 'high').length;
      const activeCount = alerts.filter(a => a.status === 'active').length;
      
      res.json({ 
        alerts, 
        total: alerts.length,
        summary: {
          critical: criticalCount,
          high: highCount,
          active: activeCount
        },
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Anomaly alerts error:", error);
      res.status(500).json({ error: "Failed to fetch anomaly alerts" });
    }
  });

  app.patch("/api/data-lake-analytics/anomaly-alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const result = dataLakeAnalyticsService.updateAlertStatus(alertId, 'acknowledged');
      
      res.json({ 
        ...result, 
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Alert acknowledge error:", error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.patch("/api/data-lake-analytics/anomaly-alerts/:alertId/resolve", async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const { resolution } = req.body;
      const result = dataLakeAnalyticsService.updateAlertStatus(alertId, 'resolved', resolution);
      
      res.json({ 
        ...result, 
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Alert resolve error:", error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.get("/api/data-lake-analytics/quality-metrics", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] QUALITY_METRICS_REQUEST - Fetching quality metrics");
      const metrics = await dataLakeAnalyticsService.getQualityMetrics();
      
      const averageScore = metrics.reduce((sum, m) => sum + m.currentScore, 0) / metrics.length;
      const belowTarget = metrics.filter(m => m.currentScore < m.targetScore).length;
      
      res.json({ 
        metrics, 
        total: metrics.length,
        summary: {
          averageScore: Math.round(averageScore * 10) / 10,
          belowTarget,
          improving: metrics.filter(m => m.trend === 'improving').length,
          declining: metrics.filter(m => m.trend === 'declining').length
        },
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Quality metrics error:", error);
      res.status(500).json({ error: "Failed to fetch quality metrics" });
    }
  });

  app.get("/api/data-lake-analytics/recommendations", async (req: Request, res: Response) => {
    try {
      const { priority, category, status } = req.query;
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] RECOMMENDATIONS_REQUEST - Fetching recommendations");
      
      let recommendations = await dataLakeAnalyticsService.getRecommendations();
      
      if (priority) {
        recommendations = recommendations.filter(r => r.priority === priority);
      }
      if (category) {
        recommendations = recommendations.filter(r => r.category === category);
      }
      if (status) {
        recommendations = recommendations.filter(r => r.status === status);
      }
      
      res.json({ 
        recommendations, 
        total: recommendations.length,
        summary: {
          critical: recommendations.filter(r => r.priority === 'critical').length,
          high: recommendations.filter(r => r.priority === 'high').length,
          pending: recommendations.filter(r => r.status === 'pending').length,
          inProgress: recommendations.filter(r => r.status === 'in_progress').length
        },
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Recommendations error:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.patch("/api/data-lake-analytics/recommendations/:recommendationId/status", async (req: Request, res: Response) => {
    try {
      const { recommendationId } = req.params;
      const { status, assignedTo } = req.body;
      
      const allowedStatuses = ['pending', 'in_progress', 'completed', 'dismissed'];
      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `status is required and must be one of: ${allowedStatuses.join(', ')}` 
        });
      }
      
      console.log(`[HIPAA-AUDIT][DataLakeAnalytics] RECOMMENDATION_STATUS_UPDATE - Recommendation ${recommendationId} status changed to ${status}`);
      
      const result = dataLakeAnalyticsService.updateRecommendationStatus(recommendationId, status, assignedTo);
      
      res.json({ 
        ...result, 
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Recommendation update error:", error);
      res.status(500).json({ error: "Failed to update recommendation" });
    }
  });

  app.post("/api/data-lake-analytics/ai-analysis", async (req: Request, res: Response) => {
    try {
      const { insightType, context } = req.body;
      
      if (!insightType) {
        return res.status(400).json({ error: "insightType is required" });
      }
      
      console.log(`[HIPAA-AUDIT][DataLakeAnalytics] AI_ANALYSIS - Generating AI analysis for ${insightType}`);
      
      const analysis = await dataLakeAnalyticsService.generateAIInsight(insightType, context || {});
      
      res.json({ 
        ...analysis,
        insightType,
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] AI analysis error:", error);
      res.status(500).json({ error: "Failed to generate AI analysis" });
    }
  });

  app.post("/api/data-lake-analytics/reports/generate", async (req: Request, res: Response) => {
    try {
      const { type, title, parameters, includeSections } = req.body;
      
      if (!type || !title || (typeof title === 'string' && !title.trim())) {
        return res.status(400).json({ error: "type and non-empty title are required" });
      }
      
      console.log(`[HIPAA-AUDIT][DataLakeAnalytics] REPORT_GENERATE - Generating ${type} report: ${title}`);
      
      const report = await dataLakeAnalyticsService.generateReport({
        type,
        title,
        parameters: parameters || {},
        includeSections: includeSections || ['metrics', 'trends', 'alerts', 'insights', 'recommendations']
      });
      
      res.json({ 
        report,
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Report generation error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/data-lake-analytics/dashboard-summary", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataLakeAnalytics] DASHBOARD_SUMMARY - Fetching comprehensive summary");
      
      const [metrics, insights, trends, alerts, qualityMetrics, recommendations] = await Promise.all([
        Promise.resolve(dataLakeAnalyticsService.getMetrics()),
        dataLakeAnalyticsService.getPredictiveInsights(),
        dataLakeAnalyticsService.getPopulationTrends(),
        dataLakeAnalyticsService.getAnomalyAlerts(),
        dataLakeAnalyticsService.getQualityMetrics(),
        dataLakeAnalyticsService.getRecommendations()
      ]);
      
      const activeAlerts = alerts.filter(a => a.status === 'active');
      const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'active');
      const pendingRecommendations = recommendations.filter(r => r.status === 'pending' || r.status === 'in_progress');
      const criticalRecommendations = recommendations.filter(r => r.priority === 'critical' && r.status === 'pending');
      
      res.json({
        dataLake: metrics,
        insights: {
          total: insights.length,
          topInsights: insights.slice(0, 3),
          categories: {
            readmission_risk: insights.filter(i => i.category === 'readmission_risk').length,
            disease_progression: insights.filter(i => i.category === 'disease_progression').length,
            care_gap: insights.filter(i => i.category === 'care_gap').length,
            resource_utilization: insights.filter(i => i.category === 'resource_utilization').length,
            patient_outcome: insights.filter(i => i.category === 'patient_outcome').length
          }
        },
        trends: {
          total: trends.length,
          improving: trends.filter(t => t.trend === 'down' && t.category === 'outcome' || t.trend === 'up' && t.category !== 'outcome').length,
          declining: trends.filter(t => t.trend === 'up' && t.category === 'outcome' || t.trend === 'down' && t.category !== 'outcome').length,
          topTrends: trends.slice(0, 3)
        },
        alerts: {
          total: alerts.length,
          active: activeAlerts.length,
          critical: criticalAlerts.length,
          recentAlerts: activeAlerts.slice(0, 5)
        },
        quality: {
          averageScore: Math.round(qualityMetrics.reduce((sum, m) => sum + m.currentScore, 0) / qualityMetrics.length * 10) / 10,
          belowTarget: qualityMetrics.filter(m => m.currentScore < m.targetScore).length,
          improving: qualityMetrics.filter(m => m.trend === 'improving').length,
          metrics: qualityMetrics.slice(0, 3)
        },
        recommendations: {
          total: recommendations.length,
          pending: pendingRecommendations.length,
          critical: criticalRecommendations.length,
          topRecommendations: recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').slice(0, 3)
        },
        generatedAt: new Date().toISOString(),
        disclaimer: HIPAA_DISCLAIMER
      });
    } catch (error) {
      console.error("[DataLakeAnalytics] Dashboard summary error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  console.log("[HIPAA-AUDIT][DataLakeAnalytics] AI FHIR Data Lake Analytics routes registered successfully");
}
