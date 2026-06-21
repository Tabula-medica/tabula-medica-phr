import { Express, Request, Response } from "express";
import { aiPublicHealthForecasting } from "./services/ai-public-health-forecasting-service";

export function registerAIPublicHealthForecastingRoutes(app: Express) {
  app.get("/api/public-health-forecasting/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const dashboard = await aiPublicHealthForecasting.getDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch forecasting dashboard" });
    }
  });

  app.get("/api/public-health-forecasting/outbreaks", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const forecasts = await aiPublicHealthForecasting.getOutbreakForecasts(userId);
      res.json({ forecasts });
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Outbreaks error:", error);
      res.status(500).json({ error: "Failed to fetch outbreak forecasts" });
    }
  });

  app.get("/api/public-health-forecasting/outbreaks/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const forecast = await aiPublicHealthForecasting.getOutbreakForecast(userId, req.params.id);
      if (!forecast) {
        return res.status(404).json({ error: "Forecast not found" });
      }
      res.json(forecast);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Outbreak detail error:", error);
      res.status(500).json({ error: "Failed to fetch outbreak forecast" });
    }
  });

  app.post("/api/public-health-forecasting/outbreaks/generate", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { diseaseType, region, historicalData } = req.body;

      if (!diseaseType || !region || !historicalData) {
        return res.status(400).json({ error: "Missing required fields: diseaseType, region, historicalData" });
      }

      const forecast = await aiPublicHealthForecasting.generateAIOutbreakForecast(
        userId,
        diseaseType,
        region,
        historicalData
      );
      res.json(forecast);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Generate forecast error:", error);
      res.status(500).json({ error: "Failed to generate outbreak forecast" });
    }
  });

  app.get("/api/public-health-forecasting/shortages", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const shortages = await aiPublicHealthForecasting.getMedicationShortages(userId);
      res.json({ shortages });
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Shortages error:", error);
      res.status(500).json({ error: "Failed to fetch medication shortages" });
    }
  });

  app.get("/api/public-health-forecasting/shortages/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const shortage = await aiPublicHealthForecasting.getMedicationShortage(userId, req.params.id);
      if (!shortage) {
        return res.status(404).json({ error: "Shortage not found" });
      }
      res.json(shortage);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Shortage detail error:", error);
      res.status(500).json({ error: "Failed to fetch medication shortage" });
    }
  });

  app.post("/api/public-health-forecasting/shortages/analyze", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { medicationName, supplyData } = req.body;

      if (!medicationName || !supplyData) {
        return res.status(400).json({ error: "Missing required fields: medicationName, supplyData" });
      }

      const shortage = await aiPublicHealthForecasting.analyzeSupplyChainRisk(
        userId,
        medicationName,
        supplyData
      );
      res.json(shortage);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Analyze shortage error:", error);
      res.status(500).json({ error: "Failed to analyze supply chain risk" });
    }
  });

  app.get("/api/public-health-forecasting/interventions", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const interventionsList = await aiPublicHealthForecasting.getInterventions(userId);
      res.json({ interventions: interventionsList });
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Interventions error:", error);
      res.status(500).json({ error: "Failed to fetch interventions" });
    }
  });

  app.get("/api/public-health-forecasting/interventions/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const intervention = await aiPublicHealthForecasting.getIntervention(userId, req.params.id);
      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }
      res.json(intervention);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Intervention detail error:", error);
      res.status(500).json({ error: "Failed to fetch intervention" });
    }
  });

  app.post("/api/public-health-forecasting/interventions/generate", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { threatType, region, population, currentMetrics } = req.body;

      if (!threatType || !region) {
        return res.status(400).json({ error: "Missing required fields: threatType, region" });
      }

      const intervention = await aiPublicHealthForecasting.generateAIIntervention(userId, {
        threatType,
        region,
        population: population || 100000,
        currentMetrics: currentMetrics || {},
      });
      res.json(intervention);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Generate intervention error:", error);
      res.status(500).json({ error: "Failed to generate intervention recommendation" });
    }
  });

  app.get("/api/public-health-forecasting/trends", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const analyses = await aiPublicHealthForecasting.getTrendAnalyses(userId);
      res.json({ analyses });
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Trends error:", error);
      res.status(500).json({ error: "Failed to fetch trend analyses" });
    }
  });

  app.get("/api/public-health-forecasting/trends/:id", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const analysis = await aiPublicHealthForecasting.getTrendAnalysis(userId, req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Trend analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Trend detail error:", error);
      res.status(500).json({ error: "Failed to fetch trend analysis" });
    }
  });

  app.post("/api/public-health-forecasting/trends/generate", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const { analysisType, dataPoints, context } = req.body;

      if (!analysisType || !dataPoints || dataPoints.length === 0) {
        return res.status(400).json({ error: "Missing required fields: analysisType, dataPoints" });
      }

      const analysis = await aiPublicHealthForecasting.generateAITrendAnalysis(
        userId,
        analysisType,
        dataPoints,
        context || ""
      );
      res.json(analysis);
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Generate trend error:", error);
      res.status(500).json({ error: "Failed to generate trend analysis" });
    }
  });

  console.log("[AIPublicHealthForecastingRoutes] Routes registered at /api/public-health-forecasting/*");
  console.log("[AIPublicHealthForecastingRoutes] Endpoints: /dashboard, /outbreaks, /shortages, /interventions, /trends");
}
