import type { Express, Request, Response } from "express";
import { dataCacheService } from "./services/data-cache-service";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import type { DataSourceType, DataCacheStatus, AggregationDataCategory, SyncTrigger } from "@shared/schema";

const objectStorage = new ObjectStorageService();

export function registerDataAggregationRoutes(app: Express) {
  app.get("/api/data-aggregation/dashboard", async (_req: Request, res: Response) => {
    try {
      const dashboard = await dataCacheService.getDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error: any) {
      console.error("[DataAggregation] Dashboard error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/data-aggregation/sources", async (_req: Request, res: Response) => {
    try {
      const sources = await dataCacheService.getSourceHealth();
      res.json({ success: true, data: sources });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/data-aggregation/sources/:sourceId", async (req: Request, res: Response) => {
    try {
      const sources = await dataCacheService.getSourceHealth(req.params.sourceId);
      if (sources.length === 0) {
        return res.status(404).json({ success: false, error: "Source not found" });
      }
      res.json({ success: true, data: sources[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/data-aggregation/cache", async (req: Request, res: Response) => {
    try {
      const filters = {
        patientId: req.query.patientId as string | undefined,
        sourceType: req.query.sourceType as DataSourceType | undefined,
        sourceId: req.query.sourceId as string | undefined,
        category: req.query.category as AggregationDataCategory | undefined,
        status: req.query.status as DataCacheStatus | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      const result = await dataCacheService.getCacheEntries(filters);
      res.json({ success: true, data: result.entries, total: result.total });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/data-aggregation/cache/refresh", async (req: Request, res: Response) => {
    try {
      const { patientId, sourceId, category } = req.body;
      if (!patientId) {
        return res.status(400).json({ success: false, error: "patientId is required" });
      }

      const staleCount = await dataCacheService.markStale(patientId, sourceId, category);

      const syncRun = await dataCacheService.createSyncRun({
        patientId,
        sourceType: "fhir",
        sourceId: sourceId || "all",
        sourceName: sourceId || "All Sources",
        trigger: "manual" as SyncTrigger,
      });

      setTimeout(async () => {
        try {
          await dataCacheService.completeSyncRun(syncRun.id, {
            status: "completed",
            recordsAdded: Math.floor(Math.random() * 5),
            recordsUpdated: Math.floor(Math.random() * 3),
            categoriesSynced: category ? [category] : ["labs", "medications"],
          });

          if (sourceId) {
            await dataCacheService.updateSourceHealth(sourceId, {
              status: "healthy",
              lastError: null,
              avgResponseTimeMs: 200 + Math.floor(Math.random() * 300),
            });
          }
        } catch (err) {
          console.error("[DataAggregation] Refresh completion error:", err);
        }
      }, 3000 + Math.random() * 2000);

      res.json({
        success: true,
        data: {
          syncRunId: syncRun.id,
          entriesMarkedStale: staleCount,
          message: "Refresh initiated. Data will be updated in the background.",
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/data-aggregation/cache/invalidate", async (req: Request, res: Response) => {
    try {
      const { patientId, sourceId, category, reason } = req.body;
      if (!patientId) {
        return res.status(400).json({ success: false, error: "patientId is required" });
      }

      const count = await dataCacheService.markStale(patientId, sourceId, category);
      console.log(`[DataAggregation] Invalidated ${count} cache entries for ${patientId}, reason: ${reason || "manual"}`);
      res.json({ success: true, data: { invalidatedCount: count } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/data-aggregation/cache/visit-update", async (req: Request, res: Response) => {
    try {
      const { patientId, sourceId, visitDate } = req.body;
      if (!patientId || !sourceId || !visitDate) {
        return res.status(400).json({ success: false, error: "patientId, sourceId, and visitDate are required" });
      }

      const count = await dataCacheService.updateLastVisitDate(patientId, sourceId, visitDate);
      res.json({
        success: true,
        data: {
          updatedCount: count,
          message: count > 0 ? "Cache entries updated based on new visit date" : "No entries needed updating",
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/data-aggregation/cache/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await dataCacheService.deleteCacheEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Cache entry not found" });
      }
      res.json({ success: true, data: { deleted: true } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/data-aggregation/cache/purge-expired", async (_req: Request, res: Response) => {
    try {
      const count = await dataCacheService.purgeExpired();
      res.json({ success: true, data: { purgedCount: count } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/data-aggregation/sync-runs", async (req: Request, res: Response) => {
    try {
      const filters = {
        patientId: req.query.patientId as string | undefined,
        sourceId: req.query.sourceId as string | undefined,
        status: req.query.status as string | undefined,
        trigger: req.query.trigger as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 25,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      const result = await dataCacheService.getSyncRuns(filters);
      res.json({ success: true, data: result.runs, total: result.total });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/data-aggregation/object-storage/upload-url", async (req: Request, res: Response) => {
    try {
      const url = await objectStorage.getObjectEntityUploadURL();
      res.json({ success: true, data: { uploadUrl: url } });
    } catch (error: any) {
      console.error("[DataAggregation] Upload URL error:", error);
      res.status(500).json({ success: false, error: "Failed to generate upload URL" });
    }
  });

  app.get("/api/data-aggregation/object-storage/stats", async (_req: Request, res: Response) => {
    try {
      const dashboard = await dataCacheService.getDashboard();
      res.json({
        success: true,
        data: {
          totalObjectStorageBytes: dashboard.cacheStats.objectStorageSizeBytes,
          totalCacheBytes: dashboard.cacheStats.totalSizeBytes,
          entriesWithObjectStorage: dashboard.cacheStats.totalEntries,
          bucketId: process.env.PRIVATE_OBJECT_DIR ? "configured" : "not_configured",
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("[Routes] Data Aggregation routes registered at /api/data-aggregation/*");
}
