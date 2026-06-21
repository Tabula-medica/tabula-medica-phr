import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import {
  aiDataCatalogService,
  DataDomain,
  AssetStatus,
} from "./services/ai-data-catalog";
import { SensitiveDataType } from "./services/ai-data-discovery-classification";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    component: "DataCatalog",
    details,
  })}`);
}

const dataDomains: DataDomain[] = [
  "patient_demographics", "clinical_records", "financial_billing", "operational",
  "research", "regulatory", "administrative", "external_integrations"
];

const assetStatuses: AssetStatus[] = ["discovered", "documented", "certified", "deprecated", "archived"];

const sensitiveDataTypes: SensitiveDataType[] = [
  "PHI", "PII", "FINANCIAL", "GENETIC", "MENTAL_HEALTH", "SUBSTANCE_ABUSE",
  "HIV_AIDS", "MINORS", "BIOMETRIC", "LOCATION", "EMPLOYMENT", "INSURANCE", "LEGAL", "RESEARCH"
];

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_CATALOG_DASHBOARD", {});
    const dashboard = aiDataCatalogService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[DataCatalog] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

const assetQuerySchema = z.object({
  domain: z.enum(dataDomains as [DataDomain, ...DataDomain[]]).optional(),
  status: z.enum(assetStatuses as [AssetStatus, ...AssetStatus[]]).optional(),
  riskLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
  sensitiveType: z.enum(sensitiveDataTypes as [SensitiveDataType, ...SensitiveDataType[]]).optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
});

router.get("/assets", async (req: Request, res: Response) => {
  try {
    const parseResult = assetQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters", details: parseResult.error.errors });
    }
    
    const { domain, status, riskLevel, sensitiveType, owner, search } = parseResult.data;
    logHipaaAudit("LIST_DATA_ASSETS", { filters: { domain, status, riskLevel, sensitiveType, search } });
    
    const result = aiDataCatalogService.getAssets({
      domain,
      status,
      riskLevel,
      sensitiveType,
      owner,
      search,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[DataCatalog] List assets error:", error);
    res.status(500).json({ success: false, error: "Failed to list assets" });
  }
});

router.get("/assets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("VIEW_DATA_ASSET", { assetId: hashIdentifier(id) });
    
    const asset = aiDataCatalogService.getAsset(id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error("[DataCatalog] Get asset error:", error);
    res.status(500).json({ success: false, error: "Failed to get asset" });
  }
});

router.post("/discover", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("DISCOVER_ASSETS_INITIATED", { userId });
    
    const result = await aiDataCatalogService.discoverAssets(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[DataCatalog] Discover assets error:", error);
    res.status(500).json({ success: false, error: "Failed to discover assets" });
  }
});

const updateAssetSchema = z.object({
  description: z.string().optional(),
  dataOwner: z.string().optional(),
  dataSteward: z.string().optional(),
  technicalOwner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  businessCriticality: z.enum(["critical", "high", "medium", "low"]).optional(),
});

router.patch("/assets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateAssetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("UPDATE_DATA_ASSET", { assetId: hashIdentifier(id), userId });
    
    const asset = await aiDataCatalogService.updateAsset(id, parseResult.data, userId);
    if (!asset) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error("[DataCatalog] Update asset error:", error);
    res.status(500).json({ success: false, error: "Failed to update asset" });
  }
});

router.post("/assets/:id/enrich", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ENRICH_ASSET_WITH_AI", { assetId: hashIdentifier(id), userId });
    
    const enrichment = await aiDataCatalogService.enrichAssetWithAI(id, userId);
    if (!enrichment) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: enrichment });
  } catch (error) {
    console.error("[DataCatalog] Enrich asset error:", error);
    res.status(500).json({ success: false, error: "Failed to enrich asset" });
  }
});

router.post("/assets/:id/link-policies", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("LINK_GOVERNANCE_POLICIES", { assetId: hashIdentifier(id), userId });
    
    const policies = await aiDataCatalogService.linkGovernancePolicies(id, userId);
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error("[DataCatalog] Link policies error:", error);
    res.status(500).json({ success: false, error: "Failed to link policies" });
  }
});

router.post("/assets/:id/assess-risk", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ASSESS_ASSET_RISK", { assetId: hashIdentifier(id), userId });
    
    const riskInfo = await aiDataCatalogService.assessAssetRisk(id, userId);
    if (!riskInfo) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: riskInfo });
  } catch (error) {
    console.error("[DataCatalog] Assess risk error:", error);
    res.status(500).json({ success: false, error: "Failed to assess risk" });
  }
});

router.post("/assets/:id/assess-quality", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("ASSESS_ASSET_QUALITY", { assetId: hashIdentifier(id), userId });
    
    const metrics = await aiDataCatalogService.runQualityAssessment(id, userId);
    if (!metrics) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error("[DataCatalog] Assess quality error:", error);
    res.status(500).json({ success: false, error: "Failed to assess quality" });
  }
});

const documentAssetSchema = z.object({
  description: z.string().optional(),
  dataOwner: z.string().optional(),
  dataSteward: z.string().optional(),
  technicalOwner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  glossaryTerms: z.array(z.object({
    term: z.string(),
    definition: z.string(),
    domain: z.string(),
  })).optional(),
  customProperties: z.record(z.string()).optional(),
});

router.post("/assets/:id/document", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = documentAssetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("DOCUMENT_ASSET", { assetId: hashIdentifier(id), userId });
    
    const asset = await aiDataCatalogService.documentAsset(id, parseResult.data, userId);
    if (!asset) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error("[DataCatalog] Document asset error:", error);
    res.status(500).json({ success: false, error: "Failed to document asset" });
  }
});

router.post("/assets/:id/certify", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "system";
    logHipaaAudit("CERTIFY_ASSET", { assetId: hashIdentifier(id), userId });
    
    const asset = await aiDataCatalogService.certifyAsset(id, userId);
    if (!asset) {
      return res.status(400).json({ success: false, error: "Asset cannot be certified. Ensure it is documented and meets quality/compliance thresholds." });
    }
    
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error("[DataCatalog] Certify asset error:", error);
    res.status(500).json({ success: false, error: "Failed to certify asset" });
  }
});

router.get("/assets/:id/lineage", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("VIEW_ASSET_LINEAGE", { assetId: hashIdentifier(id) });
    
    const lineage = aiDataCatalogService.getAssetLineage(id);
    if (!lineage) {
      return res.status(404).json({ success: false, error: "Asset not found" });
    }
    
    res.json({ success: true, data: lineage });
  } catch (error) {
    console.error("[DataCatalog] Get lineage error:", error);
    res.status(500).json({ success: false, error: "Failed to get lineage" });
  }
});

router.get("/assets/:id/related", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("VIEW_RELATED_ASSETS", { assetId: hashIdentifier(id) });
    
    const relatedAssets = aiDataCatalogService.getRelatedAssets(id);
    res.json({ success: true, data: relatedAssets });
  } catch (error) {
    console.error("[DataCatalog] Get related assets error:", error);
    res.status(500).json({ success: false, error: "Failed to get related assets" });
  }
});

router.get("/audit-log", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.query;
    logHipaaAudit("VIEW_CATALOG_AUDIT_LOG", { assetId: assetId ? hashIdentifier(assetId as string) : undefined });
    
    const logs = aiDataCatalogService.getAuditLog(assetId as string);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("[DataCatalog] Get audit log error:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

router.get("/domains", async (_req: Request, res: Response) => {
  res.json({ success: true, data: dataDomains });
});

router.get("/statuses", async (_req: Request, res: Response) => {
  res.json({ success: true, data: assetStatuses });
});

router.get("/sensitive-types", async (_req: Request, res: Response) => {
  res.json({ success: true, data: sensitiveDataTypes });
});

export default router;
