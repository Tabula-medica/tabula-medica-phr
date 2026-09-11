import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  aiFhirInteroperabilityHub,
  ExchangePointStatus,
  ExchangePointType,
  MismatchSeverity,
  MismatchCategory,
  SuggestionType,
  SuggestionStatus,
} from "./services/ai-fhir-interoperability-hub";

import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function hashIdentifier(id: string): string {
  return `hash_${id.slice(0, 4)}...${id.slice(-4)}`;
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const sanitizedDetails = Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (typeof value === "string" && (key.includes("id") || key.includes("Id"))) {
        return [key, hashIdentifier(value)];
      }
      return [key, value];
    })
  );
  console.log(`[HIPAA_AUDIT][InteroperabilityHub] ${action}:`, JSON.stringify(sanitizedDetails));
}

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
});

const exchangePointFiltersSchema = z.object({
  status: z.enum(["healthy", "degraded", "error", "offline", "unknown"]).optional(),
  type: z.enum(["fhir_endpoint", "hl7_interface", "api_gateway", "data_pipeline", "batch_import"]).optional(),
}).optional();

const mismatchFiltersSchema = z.object({
  exchangePointId: z.string().min(1).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  category: z.enum(["semantic", "structural", "terminology", "cardinality", "extension", "validation"]).optional(),
  status: z.enum(["open", "acknowledged", "resolved", "ignored"]).optional(),
}).optional();

const suggestionFiltersSchema = z.object({
  type: z.enum(["mapping", "profile_adoption", "terminology_binding", "extension_alignment", "validation_rule"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.enum(["pending", "applied", "rejected", "in_review"]).optional(),
  exchangePointId: z.string().min(1).optional(),
}).optional();

const compareServersSchema = z.object({
  serverA: z.string().min(1).max(100),
  serverB: z.string().min(1).max(100),
});

const alertsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
}).optional();

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_INTEROPERABILITY_DASHBOARD", {});
    const dashboard = aiFhirInteroperabilityHub.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[InteroperabilityHub] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

router.get("/exchange-points", async (req: Request, res: Response) => {
  try {
    const filterResult = exchangePointFiltersSchema.safeParse(req.query);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: "Invalid filter parameters" });
    }
    const filters = filterResult.data || {};
    
    logHipaaAudit("LIST_EXCHANGE_POINTS", { filters });
    const exchangePoints = aiFhirInteroperabilityHub.getExchangePoints(filters as any);
    res.json({ success: true, data: exchangePoints });
  } catch (error) {
    console.error("[InteroperabilityHub] List exchange points error:", error);
    res.status(500).json({ success: false, error: "Failed to list exchange points" });
  }
});

router.get("/exchange-points/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid exchange point ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("VIEW_EXCHANGE_POINT", { exchangePointId: hashIdentifier(id) });
    const exchangePoint = aiFhirInteroperabilityHub.getExchangePoint(id);
    
    if (!exchangePoint) {
      return res.status(404).json({ success: false, error: "Exchange point not found" });
    }
    
    res.json({ success: true, data: exchangePoint });
  } catch (error) {
    console.error("[InteroperabilityHub] Get exchange point error:", error);
    res.status(500).json({ success: false, error: "Failed to get exchange point" });
  }
});

router.post("/exchange-points/:id/monitor", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid exchange point ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("MONITOR_EXCHANGE_POINT", { exchangePointId: hashIdentifier(id) });
    const exchangePoint = await aiFhirInteroperabilityHub.monitorExchangePoint(id);
    res.json({ success: true, data: exchangePoint });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Monitor exchange point error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to monitor exchange point" });
  }
});

router.post("/exchange-points/:id/detect-mismatches", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid exchange point ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("DETECT_MISMATCHES", { exchangePointId: hashIdentifier(id) });
    const mismatches = await aiFhirInteroperabilityHub.detectMismatches(id);
    res.json({ success: true, data: mismatches });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Detect mismatches error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to detect mismatches" });
  }
});

router.post("/exchange-points/:id/analyze-flow", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid exchange point ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("ANALYZE_DATA_FLOW", { exchangePointId: hashIdentifier(id) });
    const analysis = await aiFhirInteroperabilityHub.analyzeDataFlow(id);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Analyze data flow error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to analyze data flow" });
  }
});

router.get("/mismatches", async (req: Request, res: Response) => {
  try {
    const filterResult = mismatchFiltersSchema.safeParse(req.query);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: "Invalid filter parameters" });
    }
    const filters = filterResult.data || {};
    
    logHipaaAudit("LIST_MISMATCHES", { filters });
    const mismatches = aiFhirInteroperabilityHub.getMismatches(filters as any);
    res.json({ success: true, data: mismatches });
  } catch (error) {
    console.error("[InteroperabilityHub] List mismatches error:", error);
    res.status(500).json({ success: false, error: "Failed to list mismatches" });
  }
});

router.get("/mismatches/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid mismatch ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("VIEW_MISMATCH", { mismatchId: hashIdentifier(id) });
    const mismatch = aiFhirInteroperabilityHub.getMismatch(id);
    
    if (!mismatch) {
      return res.status(404).json({ success: false, error: "Mismatch not found" });
    }
    
    res.json({ success: true, data: mismatch });
  } catch (error) {
    console.error("[InteroperabilityHub] Get mismatch error:", error);
    res.status(500).json({ success: false, error: "Failed to get mismatch" });
  }
});

router.post("/mismatches/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid mismatch ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("ACKNOWLEDGE_MISMATCH", { mismatchId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const mismatch = aiFhirInteroperabilityHub.acknowledgeMismatch(id, userId);
    res.json({ success: true, data: mismatch });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Acknowledge mismatch error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to acknowledge mismatch" });
  }
});

router.post("/mismatches/:id/resolve", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid mismatch ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("RESOLVE_MISMATCH", { mismatchId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const mismatch = aiFhirInteroperabilityHub.resolveMismatch(id, userId);
    res.json({ success: true, data: mismatch });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Resolve mismatch error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to resolve mismatch" });
  }
});

router.post("/mismatches/:id/generate-suggestions", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid mismatch ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("GENERATE_SUGGESTIONS", { mismatchId: hashIdentifier(id) });
    const suggestions = await aiFhirInteroperabilityHub.generateSuggestions(id);
    res.json({ success: true, data: suggestions });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Generate suggestions error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate suggestions" });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const filterResult = suggestionFiltersSchema.safeParse(req.query);
    if (!filterResult.success) {
      return res.status(400).json({ success: false, error: "Invalid filter parameters" });
    }
    const filters = filterResult.data || {};
    
    logHipaaAudit("LIST_SUGGESTIONS", { filters });
    const suggestions = aiFhirInteroperabilityHub.getSuggestions(filters as any);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("[InteroperabilityHub] List suggestions error:", error);
    res.status(500).json({ success: false, error: "Failed to list suggestions" });
  }
});

router.get("/suggestions/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("VIEW_SUGGESTION", { suggestionId: hashIdentifier(id) });
    const suggestion = aiFhirInteroperabilityHub.getSuggestion(id);
    
    if (!suggestion) {
      return res.status(404).json({ success: false, error: "Suggestion not found" });
    }
    
    res.json({ success: true, data: suggestion });
  } catch (error) {
    console.error("[InteroperabilityHub] Get suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to get suggestion" });
  }
});

router.post("/suggestions/:id/apply", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("APPLY_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const suggestion = aiFhirInteroperabilityHub.applySuggestion(id, userId);
    res.json({ success: true, data: suggestion });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Apply suggestion error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to apply suggestion" });
  }
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid suggestion ID" });
    }
    const { id } = paramResult.data;
    const userId = getUserId(req);
    
    logHipaaAudit("REJECT_SUGGESTION", { suggestionId: hashIdentifier(id), userId: hashIdentifier(userId) });
    const suggestion = aiFhirInteroperabilityHub.rejectSuggestion(id, userId);
    res.json({ success: true, data: suggestion });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Reject suggestion error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to reject suggestion" });
  }
});

router.post("/compare-servers", async (req: Request, res: Response) => {
  try {
    const parseResult = compareServersSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request: serverA and serverB required" });
    }
    const { serverA, serverB } = parseResult.data;
    
    logHipaaAudit("COMPARE_SERVERS", { serverA, serverB });
    const analysis = await aiFhirInteroperabilityHub.compareServers(serverA, serverB);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error("[InteroperabilityHub] Compare servers error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to compare servers" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const queryResult = alertsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }
    const limit = queryResult.data?.limit || 20;
    
    logHipaaAudit("LIST_ALERTS", { limit });
    const alerts = aiFhirInteroperabilityHub.getAlerts(limit);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error("[InteroperabilityHub] List alerts error:", error);
    res.status(500).json({ success: false, error: "Failed to list alerts" });
  }
});

router.delete("/alerts/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid alert ID" });
    }
    const { id } = paramResult.data;
    
    logHipaaAudit("CLEAR_ALERT", { alertId: hashIdentifier(id) });
    const cleared = aiFhirInteroperabilityHub.clearAlert(id);
    
    if (!cleared) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }
    
    res.json({ success: true, message: "Alert cleared" });
  } catch (error) {
    console.error("[InteroperabilityHub] Clear alert error:", error);
    res.status(500).json({ success: false, error: "Failed to clear alert" });
  }
});

export default router;
