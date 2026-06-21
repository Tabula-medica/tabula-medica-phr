import { Router, Request, Response } from "express";
import { fhirChartAnalyticsService } from "./services/fhir-chart-analytics-service";

const router = Router();

router.get("/medications/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getMedicationChartData(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch medication chart data", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

router.get("/conditions/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getConditionChartData(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch condition chart data", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

router.get("/encounters/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getEncounterChartData(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch encounter chart data", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

router.get("/health-trends/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getPatientHealthTrends(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch health trends", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

router.get("/provider-dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getProviderDashboardData(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch provider dashboard data", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

router.get("/patient-dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "system";
    const data = await fhirChartAnalyticsService.getPatientDashboardData(patientId, userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch patient dashboard data", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;
