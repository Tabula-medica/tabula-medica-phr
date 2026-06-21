import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import {
  compareMultipleCohorts,
  getComparison,
  getAllComparisons,
  deleteComparison,
} from "./services/ai-cohort-comparison";

const router = Router();

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA_AUDIT] ${timestamp} | ${action} | ${JSON.stringify(details)}`);
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

router.post("/compare", async (req: Request, res: Response) => {
  try {
    const { cohortIds } = req.body;

    if (!cohortIds || !Array.isArray(cohortIds) || cohortIds.length < 2) {
      return res.status(400).json({ error: "At least 2 cohort IDs are required for comparison" });
    }

    if (cohortIds.length > 10) {
      return res.status(400).json({ error: "Maximum 10 cohorts can be compared at once" });
    }

    logHipaaAudit("COHORT_COMPARISON_API_REQUEST", {
      cohortIds: cohortIds.map(hashIdentifier),
      cohortCount: cohortIds.length,
    });

    const comparison = await compareMultipleCohorts(cohortIds);

    logHipaaAudit("COHORT_COMPARISON_API_RESPONSE", {
      comparisonId: hashIdentifier(comparison.id),
      hypothesesGenerated: comparison.aiHypotheses.length,
      metricsCalculated: comparison.metrics.length,
    });

    res.status(201).json(comparison);
  } catch (error: any) {
    console.error("[CohortComparisonRoutes] Compare error:", error);
    logHipaaAudit("COHORT_COMPARISON_API_ERROR", { error: error.message });
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to compare cohorts" });
  }
});

router.get("/comparisons", async (_req: Request, res: Response) => {
  try {
    const comparisons = getAllComparisons();
    res.json(comparisons);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get all comparisons error:", error);
    res.status(500).json({ error: "Failed to get comparisons" });
  }
});

router.get("/comparisons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logHipaaAudit("COHORT_COMPARISON_ACCESSED", { comparisonId: hashIdentifier(id) });

    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get comparison error:", error);
    res.status(500).json({ error: "Failed to get comparison" });
  }
});

router.get("/comparisons/:id/metrics", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json({
      metrics: comparison.metrics,
      significantCount: comparison.metrics.filter(m => m.significance !== "not_significant").length,
    });
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get metrics error:", error);
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

router.get("/comparisons/:id/overlaps", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison.overlaps);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get overlaps error:", error);
    res.status(500).json({ error: "Failed to get overlaps" });
  }
});

router.get("/comparisons/:id/hypotheses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logHipaaAudit("AI_HYPOTHESES_ACCESSED", { comparisonId: hashIdentifier(id) });

    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison.aiHypotheses);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get hypotheses error:", error);
    res.status(500).json({ error: "Failed to get hypotheses" });
  }
});

router.get("/comparisons/:id/risk-factors", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logHipaaAudit("RISK_FACTORS_ACCESSED", { comparisonId: hashIdentifier(id) });

    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison.differentialRiskFactors);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get risk factors error:", error);
    res.status(500).json({ error: "Failed to get risk factors" });
  }
});

router.get("/comparisons/:id/benchmarks", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logHipaaAudit("BENCHMARKS_ACCESSED", { comparisonId: hashIdentifier(id) });

    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison.benchmarkComparisons);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get benchmarks error:", error);
    res.status(500).json({ error: "Failed to get benchmarks" });
  }
});

router.get("/comparisons/:id/visualization", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comparison = getComparison(id);

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json(comparison.visualizationData);
  } catch (error) {
    console.error("[CohortComparisonRoutes] Get visualization error:", error);
    res.status(500).json({ error: "Failed to get visualization data" });
  }
});

router.delete("/comparisons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = deleteComparison(id);

    if (!deleted) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[CohortComparisonRoutes] Delete comparison error:", error);
    res.status(500).json({ error: "Failed to delete comparison" });
  }
});

export default router;
