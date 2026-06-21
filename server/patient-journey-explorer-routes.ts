import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  aiPatientJourneyExplorer,
  JourneyFilter,
} from "./services/ai-patient-journey-explorer";
import { JourneyPhase, RiskLevel, PatternType } from "./services/ai-clinical-workflow-automation";

const router = Router();

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT][JourneyExplorer] ${action}:`, JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    ...details,
  }));
}

const phaseSchema = z.enum(["intake", "assessment", "treatment", "monitoring", "follow_up", "discharge", "transition"]);
const riskLevelSchema = z.enum(["critical", "high", "medium", "low"]);
const patternTypeSchema = z.enum(["care_gap", "workflow_bottleneck", "coordination_issue", "documentation_gap", "follow_up_needed", "transition_risk"]);

const filterSchema = z.object({
  phases: z.array(phaseSchema).optional(),
  riskLevels: z.array(riskLevelSchema).optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  patternTypes: z.array(patternTypeSchema).optional(),
  includeDecisionPoints: z.boolean().optional(),
  includeInterventions: z.boolean().optional(),
  showCriticalOnly: z.boolean().optional(),
  segmentId: z.string().optional(),
}).optional();

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
});

const patientIdParamSchema = z.object({
  patientId: z.string().min(1).max(100),
});

const querySchema = z.object({
  query: z.string().min(1).max(1000),
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_EXPLORER_DASHBOARD", {});
    const dashboard = aiPatientJourneyExplorer.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[JourneyExplorer] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

router.get("/pathways", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_PATHWAYS", {});
    const pathways = aiPatientJourneyExplorer.getAllPathways();
    res.json({ success: true, data: pathways, count: pathways.length });
  } catch (error) {
    console.error("[JourneyExplorer] List pathways error:", error);
    res.status(500).json({ success: false, error: "Failed to list pathways" });
  }
});

router.get("/pathways/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    logHipaaAudit("VIEW_PATHWAY", { pathwayId: paramResult.data.id });
    const pathway = aiPatientJourneyExplorer.getPathway(paramResult.data.id);

    if (!pathway) {
      return res.status(404).json({ success: false, error: "Pathway not found" });
    }

    res.json({ success: true, data: pathway });
  } catch (error) {
    console.error("[JourneyExplorer] Get pathway error:", error);
    res.status(500).json({ success: false, error: "Failed to get pathway" });
  }
});

router.get("/pathways/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const paramResult = patientIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid patient ID" });
    }

    logHipaaAudit("LIST_PATIENT_PATHWAYS", { patientId: paramResult.data.patientId });
    const pathways = aiPatientJourneyExplorer.getPatientPathways(paramResult.data.patientId);

    res.json({ success: true, data: pathways, count: pathways.length });
  } catch (error) {
    console.error("[JourneyExplorer] List patient pathways error:", error);
    res.status(500).json({ success: false, error: "Failed to list patient pathways" });
  }
});

router.post("/pathways/:id/visualization", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    const filterResult = filterSchema.safeParse(req.body);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: filterResult.error.errors });
    }

    logHipaaAudit("GET_VISUALIZATION_DATA", { 
      pathwayId: paramResult.data.id,
      hasFilters: !!filterResult.data,
    });

    const filter = filterResult.data as JourneyFilter | undefined;
    const vizData = aiPatientJourneyExplorer.getVisualizationData(paramResult.data.id, filter);

    if (!vizData) {
      return res.status(404).json({ success: false, error: "Pathway not found" });
    }

    res.json({ success: true, data: vizData });
  } catch (error) {
    console.error("[JourneyExplorer] Get visualization error:", error);
    res.status(500).json({ success: false, error: "Failed to get visualization data" });
  }
});

router.post("/pathways/:id/filter", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    const filterResult = filterSchema.safeParse(req.body);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: filterResult.error.errors });
    }

    logHipaaAudit("FILTER_PATHWAY", { 
      pathwayId: paramResult.data.id,
      filters: filterResult.data,
    });

    const filter = filterResult.data as JourneyFilter;
    const filteredPathway = aiPatientJourneyExplorer.getFilteredPathway(paramResult.data.id, filter);

    if (!filteredPathway) {
      return res.status(404).json({ success: false, error: "Pathway not found" });
    }

    res.json({ success: true, data: filteredPathway });
  } catch (error) {
    console.error("[JourneyExplorer] Filter pathway error:", error);
    res.status(500).json({ success: false, error: "Failed to filter pathway" });
  }
});

router.get("/pathways/:id/segments", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    logHipaaAudit("LIST_SEGMENTS", { pathwayId: paramResult.data.id });
    const segments = aiPatientJourneyExplorer.getSegments(paramResult.data.id);

    res.json({ success: true, data: segments, count: segments.length });
  } catch (error) {
    console.error("[JourneyExplorer] List segments error:", error);
    res.status(500).json({ success: false, error: "Failed to list segments" });
  }
});

router.get("/pathways/:id/temporal-analysis", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    logHipaaAudit("ANALYZE_TEMPORAL", { pathwayId: paramResult.data.id });
    const analysis = await aiPatientJourneyExplorer.analyzeTemporalCorrelations(paramResult.data.id);

    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("[JourneyExplorer] Temporal analysis error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze temporal correlations" });
  }
});

router.post("/pathways/:id/predictive-insights", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pathway ID" });
    }

    const queryResult = querySchema.safeParse(req.body);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: queryResult.error.errors });
    }

    logHipaaAudit("GENERATE_PREDICTIVE_INSIGHTS", { 
      pathwayId: paramResult.data.id,
      queryLength: queryResult.data.query.length,
    });

    const insights = await aiPatientJourneyExplorer.generatePredictiveInsights(
      paramResult.data.id,
      queryResult.data.query
    );

    res.json({ success: true, data: insights });
  } catch (error) {
    console.error("[JourneyExplorer] Predictive insights error:", error);
    res.status(500).json({ success: false, error: "Failed to generate predictive insights" });
  }
});

router.get("/segments", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ALL_SEGMENTS", {});
    const segments = aiPatientJourneyExplorer.getSegments();
    res.json({ success: true, data: segments, count: segments.length });
  } catch (error) {
    console.error("[JourneyExplorer] List all segments error:", error);
    res.status(500).json({ success: false, error: "Failed to list segments" });
  }
});

export default router;
