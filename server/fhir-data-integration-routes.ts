import { Express, Request, Response } from "express";
import { fhirDataIntegrationService, ResourceType, SyncDirection } from "./services/fhir-data-integration-service";

export function registerFHIRDataIntegrationRoutes(app: Express) {
  const routePrefix = "/api/fhir-integration";

  app.get(`${routePrefix}/connections`, async (req: Request, res: Response) => {
    try {
      const connections = await fhirDataIntegrationService.getConnections();
      res.json(connections);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching connections:", error);
      res.status(500).json({ error: "Failed to fetch connections", details: error.message });
    }
  });

  app.get(`${routePrefix}/connections/:id`, async (req: Request, res: Response) => {
    try {
      const connection = await fhirDataIntegrationService.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching connection:", error);
      res.status(500).json({ error: "Failed to fetch connection", details: error.message });
    }
  });

  app.post(`${routePrefix}/connections`, async (req: Request, res: Response) => {
    try {
      const { name, baseUrl, fhirVersion, authType, credentials, syncConfig, metadata } = req.body;
      
      if (!name || !baseUrl || !fhirVersion) {
        return res.status(400).json({ error: "Missing required fields: name, baseUrl, fhirVersion" });
      }
      
      const connection = await fhirDataIntegrationService.createConnection({
        name,
        baseUrl,
        fhirVersion,
        authType: authType || "none",
        credentials,
        syncConfig: syncConfig || {
          direction: "import",
          resourceTypes: ["Patient", "Observation"],
          schedule: "manual",
          conflictResolution: "remote_wins",
          batchSize: 100,
          retryAttempts: 3,
          enabled: false,
        },
        metadata: metadata || { supportedResources: [] },
      });
      
      res.status(201).json(connection);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error creating connection:", error);
      res.status(500).json({ error: "Failed to create connection", details: error.message });
    }
  });

  app.patch(`${routePrefix}/connections/:id`, async (req: Request, res: Response) => {
    try {
      const connection = await fhirDataIntegrationService.updateConnection(req.params.id, req.body);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error updating connection:", error);
      res.status(500).json({ error: "Failed to update connection", details: error.message });
    }
  });

  app.delete(`${routePrefix}/connections/:id`, async (req: Request, res: Response) => {
    try {
      const deleted = await fhirDataIntegrationService.deleteConnection(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[FHIRIntegration] Error deleting connection:", error);
      res.status(500).json({ error: "Failed to delete connection", details: error.message });
    }
  });

  app.post(`${routePrefix}/connections/:id/test`, async (req: Request, res: Response) => {
    try {
      const result = await fhirDataIntegrationService.testConnection(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error testing connection:", error);
      res.status(500).json({ error: "Failed to test connection", details: error.message });
    }
  });

  app.post(`${routePrefix}/connections/:id/disconnect`, async (req: Request, res: Response) => {
    try {
      const disconnected = await fhirDataIntegrationService.disconnect(req.params.id);
      if (!disconnected) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[FHIRIntegration] Error disconnecting:", error);
      res.status(500).json({ error: "Failed to disconnect", details: error.message });
    }
  });

  app.post(`${routePrefix}/sync/start`, async (req: Request, res: Response) => {
    try {
      const { connectionId, direction, resourceTypes } = req.body;
      
      if (!connectionId) {
        return res.status(400).json({ error: "connectionId is required" });
      }
      
      const job = await fhirDataIntegrationService.startSync(
        connectionId,
        direction as SyncDirection | undefined,
        resourceTypes as ResourceType[] | undefined
      );
      
      res.status(201).json(job);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error starting sync:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get(`${routePrefix}/sync/job/:id`, async (req: Request, res: Response) => {
    try {
      const job = await fhirDataIntegrationService.getSyncJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Sync job not found" });
      }
      res.json(job);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching sync job:", error);
      res.status(500).json({ error: "Failed to fetch sync job", details: error.message });
    }
  });

  app.get(`${routePrefix}/sync/history`, async (req: Request, res: Response) => {
    try {
      const connectionId = req.query.connectionId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const jobs = await fhirDataIntegrationService.getSyncHistory(connectionId, limit);
      res.json(jobs);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching sync history:", error);
      res.status(500).json({ error: "Failed to fetch sync history", details: error.message });
    }
  });

  app.post(`${routePrefix}/sync/job/:id/cancel`, async (req: Request, res: Response) => {
    try {
      const cancelled = await fhirDataIntegrationService.cancelSync(req.params.id);
      if (!cancelled) {
        return res.status(400).json({ error: "Cannot cancel this sync job" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[FHIRIntegration] Error cancelling sync:", error);
      res.status(500).json({ error: "Failed to cancel sync", details: error.message });
    }
  });

  app.post(`${routePrefix}/sync/job/:id/retry`, async (req: Request, res: Response) => {
    try {
      const { errorIds } = req.body;
      const result = await fhirDataIntegrationService.retryErrors(req.params.id, errorIds);
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error retrying sync errors:", error);
      res.status(500).json({ error: "Failed to retry errors", details: error.message });
    }
  });

  app.post(`${routePrefix}/import`, async (req: Request, res: Response) => {
    try {
      const { connectionId, resourceTypes, validateOnly } = req.body;
      
      if (!connectionId || !resourceTypes || resourceTypes.length === 0) {
        return res.status(400).json({ error: "connectionId and resourceTypes are required" });
      }
      
      const operation = await fhirDataIntegrationService.startImport(connectionId, resourceTypes, { validateOnly });
      res.status(201).json(operation);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error starting import:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post(`${routePrefix}/export`, async (req: Request, res: Response) => {
    try {
      const { connectionId, resourceTypes, patientId } = req.body;
      
      if (!connectionId || !resourceTypes || resourceTypes.length === 0) {
        return res.status(400).json({ error: "connectionId and resourceTypes are required" });
      }
      
      const operation = await fhirDataIntegrationService.startExport(connectionId, resourceTypes, patientId);
      res.status(201).json(operation);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error starting export:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get(`${routePrefix}/operations/:id`, async (req: Request, res: Response) => {
    try {
      const operation = await fhirDataIntegrationService.getOperation(req.params.id);
      if (!operation) {
        return res.status(404).json({ error: "Operation not found" });
      }
      res.json(operation);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching operation:", error);
      res.status(500).json({ error: "Failed to fetch operation", details: error.message });
    }
  });

  app.get(`${routePrefix}/operations`, async (req: Request, res: Response) => {
    try {
      const connectionId = req.query.connectionId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const operations = await fhirDataIntegrationService.getOperations(connectionId, limit);
      res.json(operations);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching operations:", error);
      res.status(500).json({ error: "Failed to fetch operations", details: error.message });
    }
  });

  app.post(`${routePrefix}/validate`, async (req: Request, res: Response) => {
    try {
      const { resource, resourceType } = req.body;
      
      if (!resource || !resourceType) {
        return res.status(400).json({ error: "resource and resourceType are required" });
      }
      
      const result = await fhirDataIntegrationService.validateResource(resource, resourceType);
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error validating resource:", error);
      res.status(500).json({ error: "Failed to validate resource", details: error.message });
    }
  });

  app.get(`${routePrefix}/stats`, async (req: Request, res: Response) => {
    try {
      const stats = await fhirDataIntegrationService.getIntegrationStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[FHIRIntegration] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats", details: error.message });
    }
  });

  console.log("[Routes] FHIR Data Integration routes registered at /api/fhir-integration/*");
}
