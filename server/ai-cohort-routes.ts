import { Router, Request, Response } from "express";
import {
  parseNaturalLanguageQuery,
  createCohort,
  executeCohort,
  getCohort,
  getAllCohorts,
  updateCohort,
  deleteCohort,
  getCohortCharacteristics,
  exportCohort,
  suggestCohortRefinements,
  CriteriaGroup,
} from "./services/ai-patient-cohort-builder";
import {
  forecastCohortOutcomes,
  identifyRiskSubpopulations,
  generateCohortComparison,
  getCohortPredictions,
  getCohortSubpopulations,
  getCohortComparisons,
  getAvailableBenchmarks,
} from "./services/ai-cohort-predictive-analytics";
import {
  discoverPatterns,
  generateSyntheticData,
  performCausalInference,
  getCohortPatterns,
  getCohortSyntheticData,
  getCohortCausalAnalyses,
} from "./services/ai-cohort-advanced-analytics";

const router = Router();

router.post("/parse-query", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query string is required" });
    }

    const parsed = await parseNaturalLanguageQuery(query);
    res.json(parsed);
  } catch (error) {
    console.error("[CohortRoutes] Parse query error:", error);
    res.status(500).json({ error: "Failed to parse query" });
  }
});

router.post("/cohorts", async (req: Request, res: Response) => {
  try {
    const { name, description, naturalLanguageQuery, criteria } = req.body;
    const userId = (req as any).user?.id || "anonymous";

    if (!name || !criteria) {
      return res.status(400).json({ error: "Name and criteria are required" });
    }

    const cohort = await createCohort(
      name,
      description || "",
      naturalLanguageQuery || "",
      criteria as CriteriaGroup,
      userId
    );

    res.status(201).json(cohort);
  } catch (error) {
    console.error("[CohortRoutes] Create cohort error:", error);
    res.status(500).json({ error: "Failed to create cohort" });
  }
});

router.get("/cohorts", async (_req: Request, res: Response) => {
  try {
    const cohorts = getAllCohorts();
    res.json(cohorts);
  } catch (error) {
    console.error("[CohortRoutes] Get cohorts error:", error);
    res.status(500).json({ error: "Failed to get cohorts" });
  }
});

router.get("/cohorts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cohort = getCohort(id);
    
    if (!cohort) {
      return res.status(404).json({ error: "Cohort not found" });
    }

    res.json(cohort);
  } catch (error) {
    console.error("[CohortRoutes] Get cohort error:", error);
    res.status(500).json({ error: "Failed to get cohort" });
  }
});

router.patch("/cohorts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = updateCohort(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: "Cohort not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[CohortRoutes] Update cohort error:", error);
    res.status(500).json({ error: "Failed to update cohort" });
  }
});

router.delete("/cohorts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = deleteCohort(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Cohort not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[CohortRoutes] Delete cohort error:", error);
    res.status(500).json({ error: "Failed to delete cohort" });
  }
});

router.post("/cohorts/:id/execute", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const matches = await executeCohort(id);
    res.json({ matches, count: matches.length });
  } catch (error: any) {
    console.error("[CohortRoutes] Execute cohort error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found" });
    }
    res.status(500).json({ error: "Failed to execute cohort" });
  }
});

router.get("/cohorts/:id/characteristics", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const characteristics = getCohortCharacteristics(id);
    
    if (!characteristics) {
      return res.status(404).json({ error: "Cohort characteristics not found. Execute the cohort first." });
    }

    res.json(characteristics);
  } catch (error) {
    console.error("[CohortRoutes] Get characteristics error:", error);
    res.status(500).json({ error: "Failed to get cohort characteristics" });
  }
});

router.post("/cohorts/:id/export", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = "json", includeFields = [], deIdentified = true } = req.body;

    const exportData = exportCohort(id, format, includeFields, deIdentified);
    
    if (!exportData) {
      return res.status(404).json({ error: "Cohort not found or not executed" });
    }

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=cohort-${id}.csv`);
      return res.send(exportData.data);
    }

    res.json(exportData);
  } catch (error) {
    console.error("[CohortRoutes] Export cohort error:", error);
    res.status(500).json({ error: "Failed to export cohort" });
  }
});

router.get("/cohorts/:id/refinements", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const suggestions = await suggestCohortRefinements(id);
    res.json({ suggestions });
  } catch (error) {
    console.error("[CohortRoutes] Get refinements error:", error);
    res.status(500).json({ error: "Failed to get refinement suggestions" });
  }
});

router.post("/cohorts/:id/predictions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outcomeType = "general", timeframeMonths = 12 } = req.body;
    const prediction = await forecastCohortOutcomes(id, outcomeType, timeframeMonths);
    res.json(prediction);
  } catch (error: any) {
    console.error("[CohortRoutes] Forecast outcomes error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to forecast outcomes" });
  }
});

router.get("/cohorts/:id/predictions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const predictions = getCohortPredictions(id);
    res.json(predictions);
  } catch (error) {
    console.error("[CohortRoutes] Get predictions error:", error);
    res.status(500).json({ error: "Failed to get predictions" });
  }
});

router.post("/cohorts/:id/subpopulations", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { riskType } = req.body;
    const subpopulations = await identifyRiskSubpopulations(id, riskType);
    res.json(subpopulations);
  } catch (error: any) {
    console.error("[CohortRoutes] Identify subpopulations error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to identify subpopulations" });
  }
});

router.get("/cohorts/:id/subpopulations", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subpopulations = getCohortSubpopulations(id);
    res.json(subpopulations);
  } catch (error) {
    console.error("[CohortRoutes] Get subpopulations error:", error);
    res.status(500).json({ error: "Failed to get subpopulations" });
  }
});

router.post("/cohorts/:id/comparisons", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comparisonType = "benchmark", comparisonSource } = req.body;
    const comparison = await generateCohortComparison(id, comparisonType, comparisonSource);
    res.json(comparison);
  } catch (error: any) {
    console.error("[CohortRoutes] Generate comparison error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to generate comparison" });
  }
});

router.get("/cohorts/:id/comparisons", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comparisons = getCohortComparisons(id);
    res.json(comparisons);
  } catch (error) {
    console.error("[CohortRoutes] Get comparisons error:", error);
    res.status(500).json({ error: "Failed to get comparisons" });
  }
});

router.get("/benchmarks", async (_req: Request, res: Response) => {
  try {
    const benchmarks = getAvailableBenchmarks();
    res.json(benchmarks);
  } catch (error) {
    console.error("[CohortRoutes] Get benchmarks error:", error);
    res.status(500).json({ error: "Failed to get benchmarks" });
  }
});

router.post("/cohorts/:id/patterns", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patterns = await discoverPatterns(id);
    res.json(patterns);
  } catch (error: any) {
    console.error("[CohortRoutes] Discover patterns error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to discover patterns" });
  }
});

router.get("/cohorts/:id/patterns", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patterns = getCohortPatterns(id);
    res.json(patterns);
  } catch (error) {
    console.error("[CohortRoutes] Get patterns error:", error);
    res.status(500).json({ error: "Failed to get patterns" });
  }
});

router.post("/cohorts/:id/synthetic-data", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { count = 100 } = req.body;
    const syntheticData = await generateSyntheticData(id, count);
    res.json(syntheticData);
  } catch (error: any) {
    console.error("[CohortRoutes] Generate synthetic data error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to generate synthetic data" });
  }
});

router.get("/cohorts/:id/synthetic-data", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const syntheticData = getCohortSyntheticData(id);
    res.json(syntheticData);
  } catch (error) {
    console.error("[CohortRoutes] Get synthetic data error:", error);
    res.status(500).json({ error: "Failed to get synthetic data" });
  }
});

router.post("/cohorts/:id/causal-analysis", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { treatmentVariable, outcomeVariable, analysisType = "propensity_score" } = req.body;

    if (!treatmentVariable || !outcomeVariable) {
      return res.status(400).json({ error: "Treatment and outcome variables are required" });
    }

    const analysis = await performCausalInference(id, treatmentVariable, outcomeVariable, analysisType);
    res.json(analysis);
  } catch (error: any) {
    console.error("[CohortRoutes] Causal analysis error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Cohort not found or has no patients" });
    }
    res.status(500).json({ error: "Failed to perform causal analysis" });
  }
});

router.get("/cohorts/:id/causal-analyses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analyses = getCohortCausalAnalyses(id);
    res.json(analyses);
  } catch (error) {
    console.error("[CohortRoutes] Get causal analyses error:", error);
    res.status(500).json({ error: "Failed to get causal analyses" });
  }
});

export default router;
