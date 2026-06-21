import { Router, Request, Response } from "express";
import {
  getCDCDashboard,
  getCDCOutbreakAlerts,
  getCDCFluData,
  getCDCVaccinationData,
  fetchLiveCDCData,
  getAIInsightsForData,
  getAvailableDatasets,
  NO_CDS_DISCLAIMER
} from "./services/cdc-feeds-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function createErrorResponse(error: string, details?: any) {
  return {
    error,
    details,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    res.json({
      name: "CDC Public Health Feeds",
      version: "1.0.0",
      description: "Integration with CDC public health data feeds for outbreak alerts, flu surveillance, and vaccination coverage",
      features: [
        "Real-time outbreak alerts",
        "Flu surveillance data by region",
        "Vaccination coverage tracking",
        "Live CDC dataset access",
        "AI-powered data insights",
        "Public health trend analysis"
      ],
      dataCategories: [
        "COVID-19 Surveillance",
        "Influenza Activity",
        "Vaccination Coverage",
        "Notifiable Diseases",
        "Environmental Health",
        "Chronic Disease Indicators"
      ],
      source: "CDC Data Portal (data.cdc.gov)",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to get metadata"));
  }
});

router.get("/datasets", (_req: Request, res: Response) => {
  try {
    const datasets = getAvailableDatasets();
    res.json({
      datasets,
      count: datasets.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Datasets error:", error);
    res.status(500).json(createErrorResponse("Failed to get datasets"));
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const dashboard = await getCDCDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[CDC Feeds] Dashboard error:", error);
    res.status(500).json(createErrorResponse("Failed to get dashboard"));
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const alerts = await getCDCOutbreakAlerts(userId);
    res.json({
      alerts,
      count: alerts.length,
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Alerts error:", error);
    res.status(500).json(createErrorResponse("Failed to get outbreak alerts"));
  }
});

router.get("/flu", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const region = req.query.region as string | undefined;
    const fluData = await getCDCFluData(userId, region);
    res.json({
      data: fluData,
      count: fluData.length,
      filter: region ? { region } : null,
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Flu data error:", error);
    res.status(500).json(createErrorResponse("Failed to get flu data"));
  }
});

router.get("/vaccination", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const vaccineType = req.query.type as string | undefined;
    const vaccinationData = await getCDCVaccinationData(userId, vaccineType);
    res.json({
      data: vaccinationData,
      count: vaccinationData.length,
      filter: vaccineType ? { type: vaccineType } : null,
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Vaccination data error:", error);
    res.status(500).json(createErrorResponse("Failed to get vaccination data"));
  }
});

router.get("/live/:datasetId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { datasetId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "CDCLiveData",
      details: `Fetch live data from dataset ${datasetId}`
    });
    
    const data = await fetchLiveCDCData(userId, datasetId, limit);
    res.json({
      datasetId,
      data,
      count: data.length,
      limit,
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Live data error:", error);
    res.status(500).json(createErrorResponse("Failed to fetch live data"));
  }
});

router.post("/insights", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { data, context } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json(createErrorResponse("Data array is required"));
    }
    
    const insights = await getAIInsightsForData(userId, data, context || "CDC data analysis");
    res.json({
      insights,
      generatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CDC Feeds] Insights error:", error);
    res.status(500).json(createErrorResponse("Failed to generate insights"));
  }
});

export default router;
