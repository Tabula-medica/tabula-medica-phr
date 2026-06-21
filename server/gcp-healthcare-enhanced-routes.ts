import { Express, Request, Response } from "express";
import { gcpHealthcareEnhancedService } from "./services/gcp/gcp-healthcare-enhanced-service";
import { getIntegrationConfig } from "./services/gcp/config";

export function registerGcpHealthcareEnhancedRoutes(app: Express): void {
  const prefix = "/api/gcp-healthcare";

  gcpHealthcareEnhancedService.initialize(getIntegrationConfig()).catch(err => {
    console.warn("[GCPHealthcareRoutes] Service initialization warning:", err.message);
  });

  app.get(`${prefix}/dashboard`, async (_req: Request, res: Response) => {
    try {
      const stats = await gcpHealthcareEnhancedService.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.post(`${prefix}/operations/export`, async (req: Request, res: Response) => {
    try {
      const { datasetId, fhirStoreId, exportConfig } = req.body;
      if (!datasetId || !fhirStoreId || !exportConfig) {
        return res.status(400).json({ error: "datasetId, fhirStoreId, and exportConfig are required" });
      }

      const operation = await gcpHealthcareEnhancedService.startBulkExport({
        datasetId,
        fhirStoreId,
        exportConfig,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(202).json(operation);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error starting export:", error);
      res.status(500).json({ error: "Failed to start bulk export" });
    }
  });

  app.post(`${prefix}/operations/import`, async (req: Request, res: Response) => {
    try {
      const { datasetId, fhirStoreId, importConfig } = req.body;
      if (!datasetId || !fhirStoreId || !importConfig) {
        return res.status(400).json({ error: "datasetId, fhirStoreId, and importConfig are required" });
      }

      const operation = await gcpHealthcareEnhancedService.startBulkImport({
        datasetId,
        fhirStoreId,
        importConfig,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(202).json(operation);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error starting import:", error);
      res.status(500).json({ error: "Failed to start bulk import" });
    }
  });

  app.post(`${prefix}/operations/deidentify`, async (req: Request, res: Response) => {
    try {
      const { datasetId, fhirStoreId, deidentifyConfig } = req.body;
      if (!datasetId || !fhirStoreId || !deidentifyConfig) {
        return res.status(400).json({ error: "datasetId, fhirStoreId, and deidentifyConfig are required" });
      }

      const operation = await gcpHealthcareEnhancedService.startDeidentification({
        datasetId,
        fhirStoreId,
        deidentifyConfig,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(202).json(operation);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error starting deidentification:", error);
      res.status(500).json({ error: "Failed to start deidentification" });
    }
  });

  app.get(`${prefix}/operations`, async (req: Request, res: Response) => {
    try {
      const operations = await gcpHealthcareEnhancedService.listOperations({
        status: req.query.status as any,
        type: req.query.type as any,
        datasetId: req.query.datasetId as string,
        fhirStoreId: req.query.fhirStoreId as string,
        limit: parseInt(req.query.limit as string) || 50
      });

      res.json({ operations });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error listing operations:", error);
      res.status(500).json({ error: "Failed to list operations" });
    }
  });

  app.get(`${prefix}/operations/:operationId`, async (req: Request, res: Response) => {
    try {
      const operation = await gcpHealthcareEnhancedService.getOperationStatus(req.params.operationId);
      if (!operation) {
        return res.status(404).json({ error: "Operation not found" });
      }
      res.json(operation);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error fetching operation:", error);
      res.status(500).json({ error: "Failed to fetch operation status" });
    }
  });

  app.post(`${prefix}/operations/:operationId/cancel`, async (req: Request, res: Response) => {
    try {
      const success = await gcpHealthcareEnhancedService.cancelOperation(
        req.params.operationId,
        (req as any).user?.id || "api-user"
      );

      if (!success) {
        return res.status(400).json({ error: "Operation cannot be cancelled or not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error cancelling operation:", error);
      res.status(500).json({ error: "Failed to cancel operation" });
    }
  });

  app.get(`${prefix}/datasets`, async (_req: Request, res: Response) => {
    try {
      const datasets = await gcpHealthcareEnhancedService.listDatasets();
      res.json({ datasets });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error listing datasets:", error);
      res.status(500).json({ error: "Failed to list datasets" });
    }
  });

  app.post(`${prefix}/datasets`, async (req: Request, res: Response) => {
    try {
      const { name, location, timeZone, labels } = req.body;
      if (!name || !location) {
        return res.status(400).json({ error: "name and location are required" });
      }

      const dataset = await gcpHealthcareEnhancedService.createDataset({
        name,
        location,
        timeZone,
        labels,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(201).json(dataset);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error creating dataset:", error);
      res.status(500).json({ error: "Failed to create dataset" });
    }
  });

  app.get(`${prefix}/datasets/:datasetId`, async (req: Request, res: Response) => {
    try {
      const dataset = await gcpHealthcareEnhancedService.getDataset(req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error fetching dataset:", error);
      res.status(500).json({ error: "Failed to fetch dataset" });
    }
  });

  app.delete(`${prefix}/datasets/:datasetId`, async (req: Request, res: Response) => {
    try {
      const success = await gcpHealthcareEnhancedService.deleteDataset(
        req.params.datasetId,
        (req as any).user?.id || "api-user"
      );

      if (!success) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error deleting dataset:", error);
      res.status(500).json({ error: "Failed to delete dataset" });
    }
  });

  app.get(`${prefix}/fhir-stores`, async (req: Request, res: Response) => {
    try {
      const stores = await gcpHealthcareEnhancedService.listFhirStores(req.query.datasetId as string);
      res.json({ fhirStores: stores });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error listing FHIR stores:", error);
      res.status(500).json({ error: "Failed to list FHIR stores" });
    }
  });

  app.post(`${prefix}/fhir-stores`, async (req: Request, res: Response) => {
    try {
      const {
        datasetId, name, version, enableUpdateCreate,
        disableReferentialIntegrity, disableResourceVersioning,
        labels, streamConfigs, notificationConfigs
      } = req.body;

      if (!datasetId || !name || !version) {
        return res.status(400).json({ error: "datasetId, name, and version are required" });
      }

      const store = await gcpHealthcareEnhancedService.createFhirStore({
        datasetId,
        name,
        version,
        enableUpdateCreate,
        disableReferentialIntegrity,
        disableResourceVersioning,
        labels,
        streamConfigs,
        notificationConfigs,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(201).json(store);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error creating FHIR store:", error);
      res.status(500).json({ error: "Failed to create FHIR store" });
    }
  });

  app.get(`${prefix}/fhir-stores/:fhirStoreId`, async (req: Request, res: Response) => {
    try {
      const store = await gcpHealthcareEnhancedService.getFhirStore(req.params.fhirStoreId);
      if (!store) {
        return res.status(404).json({ error: "FHIR store not found" });
      }
      res.json(store);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error fetching FHIR store:", error);
      res.status(500).json({ error: "Failed to fetch FHIR store" });
    }
  });

  app.put(`${prefix}/fhir-stores/:fhirStoreId`, async (req: Request, res: Response) => {
    try {
      const { labels, streamConfigs, notificationConfigs } = req.body;

      const store = await gcpHealthcareEnhancedService.updateFhirStore({
        fhirStoreId: req.params.fhirStoreId,
        labels,
        streamConfigs,
        notificationConfigs,
        userId: (req as any).user?.id || "api-user"
      });

      if (!store) {
        return res.status(404).json({ error: "FHIR store not found" });
      }

      res.json(store);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error updating FHIR store:", error);
      res.status(500).json({ error: "Failed to update FHIR store" });
    }
  });

  app.delete(`${prefix}/fhir-stores/:fhirStoreId`, async (req: Request, res: Response) => {
    try {
      const success = await gcpHealthcareEnhancedService.deleteFhirStore(
        req.params.fhirStoreId,
        (req as any).user?.id || "api-user"
      );

      if (!success) {
        return res.status(404).json({ error: "FHIR store not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error deleting FHIR store:", error);
      res.status(500).json({ error: "Failed to delete FHIR store" });
    }
  });

  app.get(`${prefix}/fhir-stores/:fhirStoreId/resource-counts`, async (req: Request, res: Response) => {
    try {
      const counts = await gcpHealthcareEnhancedService.getFhirStoreResourceCounts(
        req.params.fhirStoreId,
        (req as any).user?.id || "api-user"
      );

      res.json({ resourceCounts: counts });
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error fetching resource counts:", error);
      res.status(500).json({ error: "Failed to fetch resource counts" });
    }
  });

  app.post(`${prefix}/fhir-stores/:fhirStoreId/stream-config`, async (req: Request, res: Response) => {
    try {
      const { resourceTypes, bigQueryDataset, schemaType } = req.body;
      if (!resourceTypes || !bigQueryDataset) {
        return res.status(400).json({ error: "resourceTypes and bigQueryDataset are required" });
      }

      const config = await gcpHealthcareEnhancedService.configureStreamToBigQuery({
        fhirStoreId: req.params.fhirStoreId,
        resourceTypes,
        bigQueryDataset,
        schemaType,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(201).json(config);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error configuring stream:", error);
      res.status(500).json({ error: "Failed to configure BigQuery stream" });
    }
  });

  app.post(`${prefix}/fhir-stores/:fhirStoreId/notification-config`, async (req: Request, res: Response) => {
    try {
      const { pubsubTopic, sendFullResource, sendPreviousResource } = req.body;
      if (!pubsubTopic) {
        return res.status(400).json({ error: "pubsubTopic is required" });
      }

      const config = await gcpHealthcareEnhancedService.configureNotifications({
        fhirStoreId: req.params.fhirStoreId,
        pubsubTopic,
        sendFullResource,
        sendPreviousResource,
        userId: (req as any).user?.id || "api-user"
      });

      res.status(201).json(config);
    } catch (error: any) {
      console.error("[GCPHealthcareRoutes] Error configuring notifications:", error);
      res.status(500).json({ error: "Failed to configure notifications" });
    }
  });

  console.log("[HIPAA-AUDIT][GCPHealthcareEnhanced] Routes registered at", prefix);
  console.log("[HIPAA-AUDIT][GCPHealthcareEnhanced] Features: Async bulk operations, dataset/store management, comprehensive audit logging");
}
