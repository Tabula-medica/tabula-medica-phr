import { Router } from "express";
import { 
  aiConflictResolutionService,
  type ConflictResolutionRule,
  type DataSourceType,
  type ExternalDataSource,
  type ConflictAuditEntry
} from "./services/ai-conflict-resolution-service";
import { requireRole } from "./rbac";

const router = Router();

function logHipaaAudit(action: string, userId: string, resourceType: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][ConflictResolutionRoutes] ${action} - ${resourceType}/${resourceId} by ${userId}: ${details}`);
}

router.get("/api/conflict-resolution/conflicts", requireRole("admin"), async (req, res) => {
  try {
    const { status, severity, recordType } = req.query;
    
    const conflicts = aiConflictResolutionService.getConflicts({
      status: status as any,
      severity: severity as any,
      recordType: recordType as string,
    });

    res.json({
      success: true,
      data: conflicts,
      total: conflicts.length,
    });
  } catch (error) {
    console.error("[ConflictResolution] Get conflicts error:", error);
    res.status(500).json({ success: false, error: "Failed to get conflicts" });
  }
});

router.get("/api/conflict-resolution/conflicts/:id", requireRole("admin"), async (req, res) => {
  try {
    const conflict = aiConflictResolutionService.getConflict(req.params.id);
    if (!conflict) {
      return res.status(404).json({ success: false, error: "Conflict not found" });
    }

    res.json({ success: true, data: conflict });
  } catch (error) {
    console.error("[ConflictResolution] Get conflict error:", error);
    res.status(500).json({ success: false, error: "Failed to get conflict" });
  }
});

router.post("/api/conflict-resolution/conflicts/:id/ai-suggestion", requireRole("admin"), async (req, res) => {
  try {
    const suggestion = await aiConflictResolutionService.generateAIMergeSuggestion(req.params.id);

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error("[ConflictResolution] Generate AI suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to generate AI suggestion" });
  }
});

router.post("/api/conflict-resolution/conflicts/:id/apply-rule", requireRole("admin"), async (req, res) => {
  try {
    const { ruleId } = req.body;
    const result = await aiConflictResolutionService.applyResolutionRule(req.params.id, ruleId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: "No applicable rule found" });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[ConflictResolution] Apply rule error:", error);
    res.status(500).json({ success: false, error: "Failed to apply resolution rule" });
  }
});

router.post("/api/conflict-resolution/suggestions/:id/accept", requireRole("admin"), async (req, res) => {
  try {
    const result = aiConflictResolutionService.acceptSuggestion(req.params.id);
    
    if (!result.success) {
      return res.status(404).json({ success: false, error: "Suggestion not found" });
    }

    res.json({
      success: true,
      data: result.mergedRecord,
    });
  } catch (error) {
    console.error("[ConflictResolution] Accept suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to accept suggestion" });
  }
});

router.post("/api/conflict-resolution/suggestions/:id/reject", requireRole("admin"), async (req, res) => {
  try {
    const success = aiConflictResolutionService.rejectSuggestion(req.params.id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: "Suggestion not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[ConflictResolution] Reject suggestion error:", error);
    res.status(500).json({ success: false, error: "Failed to reject suggestion" });
  }
});

router.get("/api/conflict-resolution/rules", requireRole("admin"), async (_req, res) => {
  try {
    const rules = aiConflictResolutionService.getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error("[ConflictResolution] Get rules error:", error);
    res.status(500).json({ success: false, error: "Failed to get rules" });
  }
});

router.get("/api/conflict-resolution/rules/:id", requireRole("admin"), async (req, res) => {
  try {
    const rule = aiConflictResolutionService.getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error("[ConflictResolution] Get rule error:", error);
    res.status(500).json({ success: false, error: "Failed to get rule" });
  }
});

router.post("/api/conflict-resolution/rules", requireRole("admin"), async (req, res) => {
  try {
    const ruleData = req.body as Omit<ConflictResolutionRule, "id" | "createdAt" | "updatedAt" | "appliedCount" | "successRate">;
    
    if (!ruleData.name || !ruleData.ruleType || !ruleData.conditions || !ruleData.actions) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const rule = aiConflictResolutionService.createRule(ruleData);
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error("[ConflictResolution] Create rule error:", error);
    res.status(500).json({ success: false, error: "Failed to create rule" });
  }
});

router.patch("/api/conflict-resolution/rules/:id", requireRole("admin"), async (req, res) => {
  try {
    const updates = req.body;
    const rule = aiConflictResolutionService.updateRule(req.params.id, updates);
    
    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error("[ConflictResolution] Update rule error:", error);
    res.status(500).json({ success: false, error: "Failed to update rule" });
  }
});

router.delete("/api/conflict-resolution/rules/:id", requireRole("admin"), async (req, res) => {
  try {
    const success = aiConflictResolutionService.deleteRule(req.params.id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[ConflictResolution] Delete rule error:", error);
    res.status(500).json({ success: false, error: "Failed to delete rule" });
  }
});

router.get("/api/conflict-resolution/source-priorities", requireRole("admin"), async (_req, res) => {
  try {
    const priorities = aiConflictResolutionService.getSourcePriorities();
    res.json({ success: true, data: priorities });
  } catch (error) {
    console.error("[ConflictResolution] Get source priorities error:", error);
    res.status(500).json({ success: false, error: "Failed to get source priorities" });
  }
});

router.patch("/api/conflict-resolution/source-priorities/:sourceType", requireRole("admin"), async (req, res) => {
  try {
    const sourceType = req.params.sourceType as DataSourceType;
    const updates = req.body;
    
    const priority = aiConflictResolutionService.updateSourcePriority(sourceType, updates);
    
    if (!priority) {
      return res.status(404).json({ success: false, error: "Source type not found" });
    }

    res.json({ success: true, data: priority });
  } catch (error) {
    console.error("[ConflictResolution] Update source priority error:", error);
    res.status(500).json({ success: false, error: "Failed to update source priority" });
  }
});

router.get("/api/conflict-resolution/stats", requireRole("admin"), async (_req, res) => {
  try {
    const stats = aiConflictResolutionService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[ConflictResolution] Get stats error:", error);
    res.status(500).json({ success: false, error: "Failed to get statistics" });
  }
});

router.get("/api/conflict-resolution/external-sources", requireRole("admin"), async (req, res) => {
  try {
    const { sourceType, connectionStatus, isActive } = req.query;
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    
    logHipaaAudit("VIEW_EXTERNAL_SOURCES", userId, "ExternalDataSources", "list", "Viewing external data sources");
    
    const sources = aiConflictResolutionService.getExternalDataSources({
      sourceType: sourceType as DataSourceType,
      connectionStatus: connectionStatus as ExternalDataSource["connectionStatus"],
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    res.json({ success: true, data: sources });
  } catch (error) {
    console.error("[ConflictResolution] Get external sources error:", error);
    res.status(500).json({ success: false, error: "Failed to get external sources" });
  }
});

router.patch("/api/conflict-resolution/external-sources/:id", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { id } = req.params;
    const updates = req.body;

    logHipaaAudit("UPDATE_EXTERNAL_SOURCE", userId, "ExternalDataSource", id, `Updating source: ${JSON.stringify(updates)}`);

    const source = aiConflictResolutionService.updateExternalDataSource(id, updates);
    
    if (!source) {
      return res.status(404).json({ success: false, error: "External source not found" });
    }

    res.json({ success: true, data: source });
  } catch (error) {
    console.error("[ConflictResolution] Update external source error:", error);
    res.status(500).json({ success: false, error: "Failed to update external source" });
  }
});

router.post("/api/conflict-resolution/external-sources/:id/sync", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { id } = req.params;

    logHipaaAudit("SYNC_EXTERNAL_SOURCE", userId, "ExternalDataSource", id, "Initiating sync");

    const result = await aiConflictResolutionService.syncExternalSource(id, userId);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[ConflictResolution] Sync external source error:", error);
    res.status(500).json({ success: false, error: "Failed to sync external source" });
  }
});

router.get("/api/conflict-resolution/audit-trail", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { action, performedBy, startDate, endDate } = req.query;

    logHipaaAudit("VIEW_AUDIT_TRAIL", userId, "AuditTrail", "all", "Viewing conflict resolution audit trail");

    const entries = aiConflictResolutionService.getAllAuditEntries({
      action: action as ConflictAuditEntry["action"],
      performedBy: performedBy as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({ success: true, data: entries, total: entries.length });
  } catch (error) {
    console.error("[ConflictResolution] Get audit trail error:", error);
    res.status(500).json({ success: false, error: "Failed to get audit trail" });
  }
});

router.get("/api/conflict-resolution/conflicts/:id/audit-trail", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { id } = req.params;

    logHipaaAudit("VIEW_CONFLICT_AUDIT", userId, "ConflictAudit", id, "Viewing audit trail for specific conflict");

    const entries = aiConflictResolutionService.getAuditTrail(id);

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("[ConflictResolution] Get conflict audit trail error:", error);
    res.status(500).json({ success: false, error: "Failed to get conflict audit trail" });
  }
});

router.post("/api/conflict-resolution/bulk-auto-resolve", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { conflictIds, useAI } = req.body;

    logHipaaAudit("BULK_AUTO_RESOLVE", userId, "Conflicts", "bulk", `Resolving ${conflictIds?.length || 0} conflicts`);

    if (!Array.isArray(conflictIds) || conflictIds.length === 0) {
      return res.status(400).json({ success: false, error: "No conflict IDs provided" });
    }

    const results: Array<{ conflictId: string; success: boolean; error?: string }> = [];

    for (const conflictId of conflictIds) {
      try {
        const result = await aiConflictResolutionService.applyResolutionRule(conflictId, undefined, userId);
        results.push({ conflictId, success: result.success });
      } catch (err: any) {
        results.push({ conflictId, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        total: conflictIds.length,
        resolved: successCount,
        failed: conflictIds.length - successCount,
        details: results,
      },
    });
  } catch (error) {
    console.error("[ConflictResolution] Bulk auto-resolve error:", error);
    res.status(500).json({ success: false, error: "Failed to bulk auto-resolve conflicts" });
  }
});

router.post("/api/conflict-resolution/conflicts/:id/manual-resolve", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { id } = req.params;
    const { mergedRecord, reason } = req.body;

    logHipaaAudit("MANUAL_RESOLVE", userId, "Conflict", id, `Manual resolution: ${reason || "No reason provided"}`);

    if (!mergedRecord) {
      return res.status(400).json({ success: false, error: "Merged record is required" });
    }

    const conflict = aiConflictResolutionService.getConflict(id);
    if (!conflict) {
      return res.status(404).json({ success: false, error: "Conflict not found" });
    }

    res.json({
      success: true,
      data: {
        conflictId: id,
        status: "manually_resolved",
        mergedRecord,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[ConflictResolution] Manual resolve error:", error);
    res.status(500).json({ success: false, error: "Failed to manually resolve conflict" });
  }
});

export default router;
