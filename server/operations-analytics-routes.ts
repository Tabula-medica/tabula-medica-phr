import { Router, Request, Response } from "express";
import { z } from "zod";
import { operationsAnalyticsService } from "./services/operations-analytics-service";

const router = Router();

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated analytics are for INFORMATIONAL and operational planning purposes only. They do NOT constitute clinical decision support, medical advice, or financial advice. All operational decisions should be validated by qualified professionals.";

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await operationsAnalyticsService.getAnalyticsSummary();
    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analytics summary"
    });
  }
});

router.get("/staffing/predictions", async (_req: Request, res: Response) => {
  try {
    const predictions = await operationsAnalyticsService.getStaffingPredictions();
    res.json({
      success: true,
      data: predictions,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching staffing predictions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch staffing predictions"
    });
  }
});

router.get("/staffing/predictions/:date", async (req: Request, res: Response) => {
  try {
    const prediction = await operationsAnalyticsService.getStaffingPredictionByDate(req.params.date);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: "Prediction not found for this date"
      });
    }
    res.json({
      success: true,
      data: prediction,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching prediction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch staffing prediction"
    });
  }
});

const generatePredictionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});

router.post("/staffing/predictions/generate", async (req: Request, res: Response) => {
  try {
    const parsed = generatePredictionSchema.parse(req.body);
    const prediction = await operationsAnalyticsService.generateStaffingPrediction(parsed.date);
    res.json({
      success: true,
      data: prediction,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors
      });
    }
    console.error("[OperationsAnalyticsRoutes] Error generating prediction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate staffing prediction"
    });
  }
});

router.get("/staffing/historical", async (_req: Request, res: Response) => {
  try {
    const data = operationsAnalyticsService.getHistoricalData();
    res.json({
      success: true,
      data,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching historical data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch historical data"
    });
  }
});

router.get("/costs", async (_req: Request, res: Response) => {
  try {
    const analysis = await operationsAnalyticsService.getCostAnalysis();
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Cost analysis not available"
      });
    }
    res.json({
      success: true,
      data: analysis,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching cost analysis:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cost analysis"
    });
  }
});

router.post("/costs/analyze", async (_req: Request, res: Response) => {
  try {
    const analysis = await operationsAnalyticsService.analyzeOperationalCosts();
    res.json({
      success: true,
      data: analysis,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error analyzing costs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze costs"
    });
  }
});

router.get("/resources/forecast", async (_req: Request, res: Response) => {
  try {
    const forecast = await operationsAnalyticsService.getResourceForecast();
    if (!forecast) {
      return res.status(404).json({
        success: false,
        error: "Resource forecast not available"
      });
    }
    res.json({
      success: true,
      data: forecast,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[OperationsAnalyticsRoutes] Error fetching resource forecast:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch resource forecast"
    });
  }
});

const resourceTypeSchema = z.object({
  type: z.enum(["equipment", "supplies", "medications", "ppe", "technology", "furniture"]).optional()
});

router.get("/resources/needs", async (req: Request, res: Response) => {
  try {
    const resourceType = req.query.type as string | undefined;
    if (resourceType) {
      const parsed = resourceTypeSchema.parse({ type: resourceType });
      const resources = await operationsAnalyticsService.forecastResourceNeeds(parsed.type);
      res.json({
        success: true,
        data: resources,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    } else {
      const resources = await operationsAnalyticsService.forecastResourceNeeds();
      res.json({
        success: true,
        data: resources,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid resource type"
      });
    }
    console.error("[OperationsAnalyticsRoutes] Error forecasting resources:", error);
    res.status(500).json({
      success: false,
      error: "Failed to forecast resource needs"
    });
  }
});

export default router;
