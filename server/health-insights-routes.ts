import { Router, Request, Response } from "express";
import { healthInsightsService } from "./services/health-insights-service";
import { populationReferenceService } from "./services/population-reference-service";

const router = Router();

router.get("/api/health-insights/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = patientId;
    const summary = await healthInsightsService.getHealthSummary(patientId, userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Error getting health summary:", error);
    res.status(500).json({ success: false, error: "Failed to get health summary" });
  }
});

router.get("/api/health-insights/labs/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { category, startDate, limit } = req.query;
    const userId = patientId;
    
    const labs = await healthInsightsService.getLabResults(patientId, userId, {
      category: category as string,
      startDate: startDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, data: labs });
  } catch (error) {
    console.error("Error getting lab results:", error);
    res.status(500).json({ success: false, error: "Failed to get lab results" });
  }
});

router.get("/api/health-insights/labs/:patientId/trends/:testCode", async (req: Request, res: Response) => {
  try {
    const { patientId, testCode } = req.params;
    const { days } = req.query;
    const userId = patientId;
    
    const trends = await healthInsightsService.getLabTrends(
      patientId,
      userId,
      testCode,
      days ? parseInt(days as string) : 90
    );
    
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error("Error getting lab trends:", error);
    res.status(500).json({ success: false, error: "Failed to get lab trends" });
  }
});

router.get("/api/health-insights/conditions/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;
    const userId = patientId;
    
    const conditions = await healthInsightsService.getConditions(patientId, userId, status as string);
    res.json({ success: true, data: conditions });
  } catch (error) {
    console.error("Error getting conditions:", error);
    res.status(500).json({ success: false, error: "Failed to get conditions" });
  }
});

router.get("/api/health-insights/allergies/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = patientId;
    
    const allergies = await healthInsightsService.getAllergies(patientId, userId);
    res.json({ success: true, data: allergies });
  } catch (error) {
    console.error("Error getting allergies:", error);
    res.status(500).json({ success: false, error: "Failed to get allergies" });
  }
});

router.get("/api/health-insights/medications/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;
    const userId = patientId;
    
    const medications = await healthInsightsService.getMedications(patientId, userId, status as string);
    res.json({ success: true, data: medications });
  } catch (error) {
    console.error("Error getting medications:", error);
    res.status(500).json({ success: false, error: "Failed to get medications" });
  }
});

router.get("/api/health-insights/vitals/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, days } = req.query;
    const userId = patientId;
    
    const vitals = await healthInsightsService.getVitalSigns(
      patientId,
      userId,
      type as string,
      days ? parseInt(days as string) : 30
    );
    
    res.json({ success: true, data: vitals });
  } catch (error) {
    console.error("Error getting vital signs:", error);
    res.status(500).json({ success: false, error: "Failed to get vital signs" });
  }
});

router.get("/api/health-insights/insights/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, category, severity } = req.query;
    const userId = patientId;
    
    const insights = await healthInsightsService.getInsights(patientId, userId, {
      type: type as string,
      category: category as string,
      severity: severity as string,
    });
    
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error("Error getting insights:", error);
    res.status(500).json({ success: false, error: "Failed to get insights" });
  }
});

router.post("/api/health-insights/insights/:patientId/generate", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = patientId;
    
    const insights = await healthInsightsService.generateInsights(patientId, userId);
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).json({ success: false, error: "Failed to generate insights" });
  }
});

router.get("/api/health-insights/timeline/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { days } = req.query;
    const userId = patientId;
    
    const timeline = await healthInsightsService.getTimelineData(
      patientId,
      userId,
      days ? parseInt(days as string) : 90
    );
    
    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error("Error getting timeline:", error);
    res.status(500).json({ success: false, error: "Failed to get timeline data" });
  }
});

router.post("/api/health-insights/initialize/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    await healthInsightsService.initializeSampleData(patientId);
    res.json({ success: true, message: "Sample data initialized" });
  } catch (error) {
    console.error("Error initializing sample data:", error);
    res.status(500).json({ success: false, error: "Failed to initialize sample data" });
  }
});

router.get("/api/population-reference/labs", async (_req: Request, res: Response) => {
  try {
    const references = populationReferenceService.getAllLabReferences();
    res.json({ success: true, data: references });
  } catch (error) {
    console.error("Error getting lab references:", error);
    res.status(500).json({ success: false, error: "Failed to get lab references" });
  }
});

router.get("/api/population-reference/labs/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const reference = populationReferenceService.getLabReference(code);
    if (!reference) {
      return res.status(404).json({ success: false, error: "Lab reference not found" });
    }
    res.json({ success: true, data: reference });
  } catch (error) {
    console.error("Error getting lab reference:", error);
    res.status(500).json({ success: false, error: "Failed to get lab reference" });
  }
});

router.post("/api/population-reference/labs/compare", async (req: Request, res: Response) => {
  try {
    const { code, value } = req.body;
    const comparison = populationReferenceService.getLabValueComparison(code, value);
    if (!comparison) {
      return res.status(404).json({ success: false, error: "Lab reference not found for comparison" });
    }
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error("Error comparing lab value:", error);
    res.status(500).json({ success: false, error: "Failed to compare lab value" });
  }
});

router.get("/api/population-reference/vitals", async (_req: Request, res: Response) => {
  try {
    const references = populationReferenceService.getAllVitalReferences();
    res.json({ success: true, data: references });
  } catch (error) {
    console.error("Error getting vital references:", error);
    res.status(500).json({ success: false, error: "Failed to get vital references" });
  }
});

router.get("/api/population-reference/vitals/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const reference = populationReferenceService.getVitalReference(type);
    if (!reference) {
      return res.status(404).json({ success: false, error: "Vital reference not found" });
    }
    res.json({ success: true, data: reference });
  } catch (error) {
    console.error("Error getting vital reference:", error);
    res.status(500).json({ success: false, error: "Failed to get vital reference" });
  }
});

router.post("/api/population-reference/vitals/compare", async (req: Request, res: Response) => {
  try {
    const { type, value } = req.body;
    const comparison = populationReferenceService.getVitalValueComparison(type, value);
    if (!comparison) {
      return res.status(404).json({ success: false, error: "Vital reference not found for comparison" });
    }
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error("Error comparing vital value:", error);
    res.status(500).json({ success: false, error: "Failed to compare vital value" });
  }
});

router.get("/api/population-reference/conditions", async (_req: Request, res: Response) => {
  try {
    const prevalence = populationReferenceService.getAllConditionPrevalence();
    res.json({ success: true, data: prevalence });
  } catch (error) {
    console.error("Error getting condition prevalence:", error);
    res.status(500).json({ success: false, error: "Failed to get condition prevalence" });
  }
});

router.get("/api/population-reference/conditions/:condition", async (req: Request, res: Response) => {
  try {
    const { condition } = req.params;
    const prevalence = populationReferenceService.getConditionPrevalence(condition);
    if (!prevalence) {
      return res.status(404).json({ success: false, error: "Condition prevalence not found" });
    }
    res.json({ success: true, data: prevalence });
  } catch (error) {
    console.error("Error getting condition prevalence:", error);
    res.status(500).json({ success: false, error: "Failed to get condition prevalence" });
  }
});

router.get("/api/population-reference/allergies", async (_req: Request, res: Response) => {
  try {
    const prevalence = populationReferenceService.getAllAllergyPrevalence();
    res.json({ success: true, data: prevalence });
  } catch (error) {
    console.error("Error getting allergy prevalence:", error);
    res.status(500).json({ success: false, error: "Failed to get allergy prevalence" });
  }
});

router.get("/api/population-reference/allergies/:allergen", async (req: Request, res: Response) => {
  try {
    const { allergen } = req.params;
    const prevalence = populationReferenceService.getAllergyPrevalence(allergen);
    if (!prevalence) {
      return res.status(404).json({ success: false, error: "Allergy prevalence not found" });
    }
    res.json({ success: true, data: prevalence });
  } catch (error) {
    console.error("Error getting allergy prevalence:", error);
    res.status(500).json({ success: false, error: "Failed to get allergy prevalence" });
  }
});

export default router;
