import { Router, Request, Response } from "express";
import { aiFHIRVisualizationService } from "./services/ai-fhir-visualization-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "AI FHIR Visualization",
    version: "1.0.0",
    description: "AI-powered visualization and dashboard generation for FHIR data",
    capabilities: [
      "Automatic chart generation from FHIR resources",
      "Clinical trend analysis",
      "Patient population insights",
      "Data quality visualization",
      "AI-enhanced recommendations",
    ],
    chartTypes: ["line", "bar", "pie", "doughnut", "area", "scatter", "radar", "heatmap"],
    categories: ["clinical_trends", "patient_population", "data_quality", "utilization", "outcomes"],
  });
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { resources } = req.body;

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "Resources array is required" });
    }

    const analysis = await aiFHIRVisualizationService.analyzeFHIRData(resources);
    res.json({ analysis });
  } catch (error) {
    console.error("FHIR analysis error:", error);
    res.status(500).json({ error: "Failed to analyze FHIR data" });
  }
});

router.post("/visualizations", async (req: Request, res: Response) => {
  try {
    const { resources, preferences } = req.body;

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "Resources array is required" });
    }

    const analysis = await aiFHIRVisualizationService.analyzeFHIRData(resources);
    const visualizations = await aiFHIRVisualizationService.generateVisualizationSuggestions(analysis, preferences);

    res.json({ visualizations, analysis });
  } catch (error) {
    console.error("Visualization generation error:", error);
    res.status(500).json({ error: "Failed to generate visualizations" });
  }
});

router.post("/dashboard", async (req: Request, res: Response) => {
  try {
    const { resources, name } = req.body;

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "Resources array is required" });
    }

    const dashboard = await aiFHIRVisualizationService.generateDashboard(resources, name);
    res.json({ dashboard });
  } catch (error) {
    console.error("Dashboard generation error:", error);
    res.status(500).json({ error: "Failed to generate dashboard" });
  }
});

router.post("/insights", async (req: Request, res: Response) => {
  try {
    const { resources } = req.body;

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "Resources array is required" });
    }

    const analysis = await aiFHIRVisualizationService.analyzeFHIRData(resources);
    const insights = await aiFHIRVisualizationService.generateAIInsights(analysis);

    res.json({ insights, analysis });
  } catch (error) {
    console.error("Insights generation error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

router.get("/sample-data", (_req: Request, res: Response) => {
  const sampleResources = [
    {
      resourceType: "Patient",
      id: "patient-1",
      gender: "female",
      birthDate: "1985-03-15",
      meta: { lastUpdated: "2024-01-15T10:00:00Z" },
    },
    {
      resourceType: "Patient",
      id: "patient-2",
      gender: "male",
      birthDate: "1972-08-22",
      meta: { lastUpdated: "2024-01-16T11:30:00Z" },
    },
    {
      resourceType: "Patient",
      id: "patient-3",
      gender: "female",
      birthDate: "1990-11-08",
      meta: { lastUpdated: "2024-02-01T09:15:00Z" },
    },
    {
      resourceType: "Condition",
      id: "condition-1",
      code: { coding: [{ display: "Type 2 Diabetes Mellitus" }] },
      recordedDate: "2024-01-10T08:00:00Z",
    },
    {
      resourceType: "Condition",
      id: "condition-2",
      code: { coding: [{ display: "Essential Hypertension" }] },
      recordedDate: "2024-01-12T14:00:00Z",
    },
    {
      resourceType: "Condition",
      id: "condition-3",
      code: { coding: [{ display: "Type 2 Diabetes Mellitus" }] },
      recordedDate: "2024-02-05T16:30:00Z",
    },
    {
      resourceType: "MedicationRequest",
      id: "med-1",
      medicationCodeableConcept: { coding: [{ display: "Metformin 500mg" }] },
      authoredOn: "2024-01-11T10:00:00Z",
    },
    {
      resourceType: "MedicationRequest",
      id: "med-2",
      medicationCodeableConcept: { coding: [{ display: "Lisinopril 10mg" }] },
      authoredOn: "2024-01-13T15:00:00Z",
    },
    {
      resourceType: "Observation",
      id: "obs-1",
      code: { coding: [{ display: "Blood Pressure" }] },
      effectiveDateTime: "2024-01-14T09:00:00Z",
    },
    {
      resourceType: "Observation",
      id: "obs-2",
      code: { coding: [{ display: "HbA1c" }] },
      effectiveDateTime: "2024-02-10T11:00:00Z",
    },
  ];

  res.json({ resources: sampleResources });
});

export default router;
