import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiDataLineageService, LineageSearchFilter } from "./services/ai-data-lineage";
import { createHash } from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, component: string, details: Record<string, unknown>, userId?: string): void {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp,
    action,
    component,
    userId: userId ? hashIdentifier(userId) : "system",
    details: {
      ...details,
      nodeId: details.nodeId ? hashIdentifier(String(details.nodeId)) : undefined,
    },
  }));
}

const searchFilterSchema = z.object({
  query: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  systems: z.array(z.string()).optional(),
  domains: z.array(z.enum([
    "patient_demographics",
    "clinical_records",
    "financial_billing",
    "operational",
    "research",
    "regulatory",
    "administrative",
    "external_integrations",
  ])).optional(),
  dataClassifications: z.array(z.string()).optional(),
  riskLevels: z.array(z.enum(["critical", "high", "medium", "low"])).optional(),
  complianceStatuses: z.array(z.enum(["compliant", "non_compliant", "review_needed", "unknown"])).optional(),
  nodeTypes: z.array(z.enum([
    "source_system",
    "data_store",
    "transformation",
    "api_gateway",
    "analytics_engine",
    "reporting",
    "archive",
    "external_system",
  ])).optional(),
  includeUpstream: z.boolean().optional(),
  includeDownstream: z.boolean().optional(),
  maxDepth: z.number().min(1).max(10).optional(),
});

router.get("/graph", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_LINEAGE_GRAPH", "DataLineage", { action: "view_full_graph" });
    
    const graph = await aiDataLineageService.getFullLineageGraph();
    
    res.json({ success: true, data: graph });
  } catch (error) {
    console.error("[DataLineage] Error fetching graph:", error);
    res.status(500).json({ success: false, error: "Failed to fetch lineage graph" });
  }
});

router.post("/search", async (req: Request, res: Response) => {
  try {
    const validation = searchFilterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors });
    }

    logHipaaAudit("SEARCH_LINEAGE", "DataLineage", { 
      action: "search",
      hasQuery: !!validation.data.query,
      filterCount: Object.keys(validation.data).length,
    });

    const filter: LineageSearchFilter = validation.data as LineageSearchFilter;
    const graph = await aiDataLineageService.searchLineage(filter);
    
    res.json({ success: true, data: graph });
  } catch (error) {
    console.error("[DataLineage] Search error:", error);
    res.status(500).json({ success: false, error: "Failed to search lineage" });
  }
});

router.get("/nodes/:nodeId", async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    
    logHipaaAudit("VIEW_NODE_DETAILS", "DataLineage", { nodeId });
    
    const node = await aiDataLineageService.getNodeDetails(nodeId);
    
    if (!node) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }
    
    res.json({ success: true, data: node });
  } catch (error) {
    console.error("[DataLineage] Error fetching node:", error);
    res.status(500).json({ success: false, error: "Failed to fetch node details" });
  }
});

const impactAnalysisSchema = z.object({
  direction: z.enum(["upstream", "downstream", "both"]).default("both"),
});

router.get("/nodes/:nodeId/impact", async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const direction = req.query.direction as "upstream" | "downstream" | "both" || "both";

    logHipaaAudit("ANALYZE_IMPACT", "DataLineage", { nodeId, direction });

    const analysis = await aiDataLineageService.getImpactAnalysis(nodeId, direction);
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("[DataLineage] Impact analysis error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze impact" });
  }
});

const aiAnalysisSchema = z.object({
  query: z.string().min(1).max(1000),
  nodeIds: z.array(z.string()).optional(),
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const validation = aiAnalysisSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors });
    }

    logHipaaAudit("AI_LINEAGE_ANALYSIS", "DataLineage", { 
      action: "ai_analyze",
      queryLength: validation.data.query.length,
      hasContext: !!validation.data.nodeIds?.length,
    });

    const analysis = await aiDataLineageService.analyzeLineageWithAI(
      validation.data.query,
      validation.data.nodeIds ? { nodeIds: validation.data.nodeIds } : undefined
    );
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("[DataLineage] AI analysis error:", error);
    res.status(500).json({ success: false, error: "Failed to perform AI analysis" });
  }
});

router.get("/filters/systems", async (_req: Request, res: Response) => {
  try {
    const systems = await aiDataLineageService.getSystems();
    res.json({ success: true, data: systems });
  } catch (error) {
    console.error("[DataLineage] Error fetching systems:", error);
    res.status(500).json({ success: false, error: "Failed to fetch systems" });
  }
});

router.get("/filters/domains", async (_req: Request, res: Response) => {
  try {
    const domains = await aiDataLineageService.getDomains();
    res.json({ success: true, data: domains });
  } catch (error) {
    console.error("[DataLineage] Error fetching domains:", error);
    res.status(500).json({ success: false, error: "Failed to fetch domains" });
  }
});

router.get("/filters/classifications", async (_req: Request, res: Response) => {
  try {
    const classifications = await aiDataLineageService.getDataClassifications();
    res.json({ success: true, data: classifications });
  } catch (error) {
    console.error("[DataLineage] Error fetching classifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch classifications" });
  }
});

export default router;
