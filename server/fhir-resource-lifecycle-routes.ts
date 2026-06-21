import type { Express, Request, Response } from "express";
import { fhirResourceLifecycleService } from "./services/fhir-resource-lifecycle-service";

const HIPAA_DISCLAIMER = "This resource data is for informational purposes only. Not for clinical decision-making.";

export function registerFHIRResourceLifecycleRoutes(app: Express): void {
  console.log("[HIPAA-AUDIT][FHIRResourceLifecycle] Registering FHIR Resource Lifecycle Management routes");

  app.get("/api/resource-lifecycle/stats", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][ResourceLifecycle] STATS_REQUEST - Fetching lifecycle statistics");
      const stats = fhirResourceLifecycleService.getStats();
      res.json({ ...stats, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Stats error:", error);
      res.status(500).json({ error: "Failed to fetch lifecycle stats" });
    }
  });

  app.get("/api/resource-lifecycle/resources", async (req: Request, res: Response) => {
    try {
      const { resourceType, limit } = req.query;
      console.log("[HIPAA-AUDIT][ResourceLifecycle] RESOURCES_LIST - Fetching resources");
      
      const resources = fhirResourceLifecycleService.getResources(
        resourceType as string | undefined,
        limit ? parseInt(limit as string) : 100
      );
      res.json({ resources, total: resources.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resources list error:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  app.get("/api/resource-lifecycle/resources/:resourceType/:id", async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;
      console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_READ - ${resourceType}/${id}`);
      
      const resource = fhirResourceLifecycleService.getResource(resourceType, id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      res.json({ resource, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource read error:", error);
      res.status(500).json({ error: "Failed to fetch resource" });
    }
  });

  app.post("/api/resource-lifecycle/resources", async (req: Request, res: Response) => {
    try {
      const resource = req.body;

      if (!resource.resourceType) {
        return res.status(400).json({ error: "resourceType is required" });
      }

      const created = fhirResourceLifecycleService.createResource(resource);
      res.status(201).json({ resource: created, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource create error:", error);
      res.status(500).json({ error: "Failed to create resource" });
    }
  });

  app.put("/api/resource-lifecycle/resources/:resourceType/:id", async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;
      const { changeReason, ...updates } = req.body;

      const updated = fhirResourceLifecycleService.updateResource(resourceType, id, updates, changeReason);
      if (!updated) {
        return res.status(404).json({ error: "Resource not found" });
      }

      res.json({ resource: updated, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource update error:", error);
      res.status(500).json({ error: "Failed to update resource" });
    }
  });

  app.delete("/api/resource-lifecycle/resources/:resourceType/:id", async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;

      const deleted = fhirResourceLifecycleService.deleteResource(resourceType, id);
      if (!deleted) {
        return res.status(404).json({ error: "Resource not found" });
      }

      res.json({ success: true, message: "Resource deleted", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource delete error:", error);
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  app.get("/api/resource-lifecycle/resources/:resourceType/:id/history", async (req: Request, res: Response) => {
    try {
      const { resourceType, id } = req.params;
      console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_HISTORY - ${resourceType}/${id}`);
      
      const history = fhirResourceLifecycleService.getResourceHistory(resourceType, id);
      res.json({ history, total: history.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource history error:", error);
      res.status(500).json({ error: "Failed to fetch resource history" });
    }
  });

  app.get("/api/resource-lifecycle/resources/:resourceType/:id/_history/:versionId", async (req: Request, res: Response) => {
    try {
      const { resourceType, id, versionId } = req.params;
      console.log(`[HIPAA-AUDIT][ResourceLifecycle] RESOURCE_VERSION - ${resourceType}/${id} v${versionId}`);
      
      const resource = fhirResourceLifecycleService.getResourceVersion(resourceType, id, versionId);
      if (!resource) {
        return res.status(404).json({ error: "Version not found" });
      }

      res.json({ resource, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Resource version error:", error);
      res.status(500).json({ error: "Failed to fetch resource version" });
    }
  });

  app.post("/api/resource-lifecycle/resources/:resourceType/:id/rollback/:targetVersionId", async (req: Request, res: Response) => {
    try {
      const { resourceType, id, targetVersionId } = req.params;
      
      const restored = fhirResourceLifecycleService.rollbackResource(resourceType, id, targetVersionId);
      if (!restored) {
        return res.status(404).json({ error: "Version not found" });
      }

      res.json({ resource: restored, success: true, rolledBackTo: targetVersionId, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Rollback error:", error);
      res.status(500).json({ error: "Failed to rollback resource" });
    }
  });

  app.post("/api/resource-lifecycle/search", async (req: Request, res: Response) => {
    try {
      const { text, resourceType, semantic, filters } = req.body;
      console.log("[HIPAA-AUDIT][ResourceLifecycle] SEARCH_REQUEST");
      
      const results = await fhirResourceLifecycleService.searchResources({
        text,
        resourceType,
        semantic,
        filters
      });

      res.json({ results, total: results.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Search error:", error);
      res.status(500).json({ error: "Failed to search resources" });
    }
  });

  app.post("/api/resource-lifecycle/bulk/import", async (req: Request, res: Response) => {
    try {
      const { format, resourceTypes, data, validateOnImport, createdBy } = req.body;

      if (!format || !resourceTypes || !data) {
        return res.status(400).json({ error: "format, resourceTypes, and data are required" });
      }

      const operation = fhirResourceLifecycleService.startBulkImport({
        format,
        resourceTypes,
        data,
        validateOnImport,
        createdBy
      });

      res.status(202).json({ operation, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Bulk import error:", error);
      res.status(500).json({ error: "Failed to start bulk import" });
    }
  });

  app.post("/api/resource-lifecycle/bulk/export", async (req: Request, res: Response) => {
    try {
      const { format, resourceTypes, createdBy } = req.body;

      if (!format || !resourceTypes) {
        return res.status(400).json({ error: "format and resourceTypes are required" });
      }

      const operation = fhirResourceLifecycleService.startBulkExport({
        format,
        resourceTypes,
        createdBy
      });

      res.status(202).json({ operation, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Bulk export error:", error);
      res.status(500).json({ error: "Failed to start bulk export" });
    }
  });

  app.get("/api/resource-lifecycle/bulk/operations", async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      console.log("[HIPAA-AUDIT][ResourceLifecycle] BULK_OPERATIONS_LIST");
      
      const operations = fhirResourceLifecycleService.getBulkOperations(type as 'import' | 'export' | undefined);
      res.json({ operations, total: operations.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Bulk operations list error:", error);
      res.status(500).json({ error: "Failed to fetch bulk operations" });
    }
  });

  app.get("/api/resource-lifecycle/bulk/operations/:operationId", async (req: Request, res: Response) => {
    try {
      const { operationId } = req.params;
      
      const operation = fhirResourceLifecycleService.getBulkOperation(operationId);
      if (!operation) {
        return res.status(404).json({ error: "Operation not found" });
      }

      res.json({ operation, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Bulk operation detail error:", error);
      res.status(500).json({ error: "Failed to fetch bulk operation" });
    }
  });

  app.post("/api/resource-lifecycle/bulk/operations/:operationId/cancel", async (req: Request, res: Response) => {
    try {
      const { operationId } = req.params;
      
      const cancelled = fhirResourceLifecycleService.cancelBulkOperation(operationId);
      if (!cancelled) {
        return res.status(400).json({ error: "Operation cannot be cancelled" });
      }

      res.json({ success: true, message: "Operation cancelled", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Cancel operation error:", error);
      res.status(500).json({ error: "Failed to cancel operation" });
    }
  });

  app.post("/api/resource-lifecycle/playground/sessions", async (req: Request, res: Response) => {
    try {
      const { name, createdBy } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      const session = fhirResourceLifecycleService.createPlaygroundSession(name, createdBy);
      res.status(201).json({ session, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Create playground session error:", error);
      res.status(500).json({ error: "Failed to create playground session" });
    }
  });

  app.get("/api/resource-lifecycle/playground/sessions", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][ResourceLifecycle] PLAYGROUND_SESSIONS_LIST");
      const sessions = fhirResourceLifecycleService.getPlaygroundSessions();
      res.json({ sessions, total: sessions.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Playground sessions list error:", error);
      res.status(500).json({ error: "Failed to fetch playground sessions" });
    }
  });

  app.get("/api/resource-lifecycle/playground/sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const session = fhirResourceLifecycleService.getPlaygroundSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({ session, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Playground session detail error:", error);
      res.status(500).json({ error: "Failed to fetch playground session" });
    }
  });

  app.post("/api/resource-lifecycle/playground/sessions/:sessionId/resources", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const resource = req.body;

      const session = fhirResourceLifecycleService.addResourceToPlayground(sessionId, resource);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({ session, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Add resource to playground error:", error);
      res.status(500).json({ error: "Failed to add resource to playground" });
    }
  });

  app.put("/api/resource-lifecycle/playground/sessions/:sessionId/resources/:index", async (req: Request, res: Response) => {
    try {
      const { sessionId, index } = req.params;
      const resource = req.body;

      const session = fhirResourceLifecycleService.updatePlaygroundResource(sessionId, parseInt(index), resource);
      if (!session) {
        return res.status(404).json({ error: "Session or resource not found" });
      }

      res.json({ session, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Update playground resource error:", error);
      res.status(500).json({ error: "Failed to update playground resource" });
    }
  });

  app.delete("/api/resource-lifecycle/playground/sessions/:sessionId/resources/:index", async (req: Request, res: Response) => {
    try {
      const { sessionId, index } = req.params;

      const session = fhirResourceLifecycleService.removeResourceFromPlayground(sessionId, parseInt(index));
      if (!session) {
        return res.status(404).json({ error: "Session or resource not found" });
      }

      res.json({ session, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Remove playground resource error:", error);
      res.status(500).json({ error: "Failed to remove playground resource" });
    }
  });

  app.post("/api/resource-lifecycle/playground/sessions/:sessionId/validate", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const results = fhirResourceLifecycleService.validatePlaygroundResources(sessionId);
      const session = fhirResourceLifecycleService.getPlaygroundSession(sessionId);

      res.json({ 
        results, 
        session,
        valid: results.every(r => r.valid),
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[ResourceLifecycle] Validate playground error:", error);
      res.status(500).json({ error: "Failed to validate playground resources" });
    }
  });

  app.post("/api/resource-lifecycle/playground/sessions/:sessionId/push", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const result = fhirResourceLifecycleService.pushPlaygroundResources(sessionId);
      res.json({ ...result, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Push playground error:", error);
      res.status(500).json({ error: "Failed to push playground resources" });
    }
  });

  app.delete("/api/resource-lifecycle/playground/sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const deleted = fhirResourceLifecycleService.deletePlaygroundSession(sessionId);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({ success: true, message: "Session deleted", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Delete playground session error:", error);
      res.status(500).json({ error: "Failed to delete playground session" });
    }
  });

  app.get("/api/resource-lifecycle/usage-patterns", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][ResourceLifecycle] USAGE_PATTERNS_REQUEST");
      const patterns = fhirResourceLifecycleService.getUsagePatterns();
      res.json({ patterns, total: patterns.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Usage patterns error:", error);
      res.status(500).json({ error: "Failed to fetch usage patterns" });
    }
  });

  app.post("/api/resource-lifecycle/analyze-usage", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][ResourceLifecycle] USAGE_ANALYSIS_REQUEST");
      const analysis = await fhirResourceLifecycleService.analyzeUsagePatterns();
      res.json({ ...analysis, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[ResourceLifecycle] Usage analysis error:", error);
      res.status(500).json({ error: "Failed to analyze usage patterns" });
    }
  });

  console.log("[HIPAA-AUDIT][FHIRResourceLifecycle] Routes registered successfully at /api/resource-lifecycle/*");
}
