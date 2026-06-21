import { Router, Request, Response } from "express";
import { fhirSyncScheduler } from "./services/fhir-sync-scheduler";

const router = Router();

router.get("/statistics", async (_req: Request, res: Response) => {
  try {
    const statistics = fhirSyncScheduler.getStatistics();
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
  }
});

router.get("/endpoints", async (_req: Request, res: Response) => {
  try {
    const endpoints = fhirSyncScheduler.getEndpoints();
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get endpoints" });
  }
});

router.get("/endpoints/:id", async (req: Request, res: Response) => {
  try {
    const endpoint = fhirSyncScheduler.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get endpoint" });
  }
});

router.post("/endpoints", async (req: Request, res: Response) => {
  try {
    const endpoint = fhirSyncScheduler.createEndpoint(req.body);
    res.status(201).json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create endpoint" });
  }
});

router.patch("/endpoints/:id", async (req: Request, res: Response) => {
  try {
    const endpoint = fhirSyncScheduler.updateEndpoint(req.params.id, req.body);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update endpoint" });
  }
});

router.delete("/endpoints/:id", async (req: Request, res: Response) => {
  try {
    const success = fhirSyncScheduler.deleteEndpoint(req.params.id);
    if (!success) {
      return res.status(400).json({ error: "Cannot delete endpoint with active configurations" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete endpoint" });
  }
});

router.post("/endpoints/:id/test", async (req: Request, res: Response) => {
  try {
    const result = await fhirSyncScheduler.testEndpointConnection(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to test connection" });
  }
});

router.get("/configurations", async (_req: Request, res: Response) => {
  try {
    const configurations = fhirSyncScheduler.getConfigurations();
    res.json(configurations);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get configurations" });
  }
});

router.get("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const configuration = fhirSyncScheduler.getConfiguration(req.params.id);
    if (!configuration) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get configuration" });
  }
});

router.post("/configurations", async (req: Request, res: Response) => {
  try {
    const configuration = fhirSyncScheduler.createConfiguration(req.body);
    res.status(201).json(configuration);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create configuration" });
  }
});

router.patch("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const configuration = fhirSyncScheduler.updateConfiguration(req.params.id, req.body);
    if (!configuration) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update configuration" });
  }
});

router.delete("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const success = fhirSyncScheduler.deleteConfiguration(req.params.id);
    if (!success) {
      return res.status(400).json({ error: "Cannot delete configuration with running jobs" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete configuration" });
  }
});

router.post("/configurations/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const configuration = fhirSyncScheduler.toggleConfiguration(req.params.id, isActive);
    if (!configuration) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to toggle configuration" });
  }
});

router.get("/jobs", async (req: Request, res: Response) => {
  try {
    const { configurationId, status, limit } = req.query;
    const jobs = fhirSyncScheduler.getJobs(
      configurationId as string | undefined,
      status as "idle" | "running" | "completed" | "failed" | "paused" | undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get jobs" });
  }
});

router.get("/jobs/:id", async (req: Request, res: Response) => {
  try {
    const job = fhirSyncScheduler.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get job" });
  }
});

router.post("/jobs", async (req: Request, res: Response) => {
  try {
    const { configurationId, triggeredBy = "manual" } = req.body;
    const job = await fhirSyncScheduler.startSyncJob(configurationId, triggeredBy);
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to start sync job" });
  }
});

router.post("/jobs/:id/cancel", async (req: Request, res: Response) => {
  try {
    const job = await fhirSyncScheduler.cancelJob(req.params.id);
    if (!job) {
      return res.status(400).json({ error: "Job not running or not found" });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to cancel job" });
  }
});

router.get("/conflicts", async (req: Request, res: Response) => {
  try {
    const { configurationId, status } = req.query;
    const conflicts = fhirSyncScheduler.getConflicts(
      configurationId as string | undefined,
      status as "pending" | "resolved" | "dismissed" | undefined
    );
    res.json(conflicts);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get conflicts" });
  }
});

router.get("/conflicts/:id", async (req: Request, res: Response) => {
  try {
    const conflict = fhirSyncScheduler.getConflict(req.params.id);
    if (!conflict) {
      return res.status(404).json({ error: "Conflict not found" });
    }
    res.json(conflict);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get conflict" });
  }
});

router.post("/conflicts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { strategy, userId = "admin" } = req.body;
    const conflict = await fhirSyncScheduler.resolveConflict(req.params.id, strategy, userId);
    if (!conflict) {
      return res.status(400).json({ error: "Conflict not pending or not found" });
    }
    res.json(conflict);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to resolve conflict" });
  }
});

router.post("/conflicts/:id/merge", async (req: Request, res: Response) => {
  try {
    const { mergedData, userId = "admin" } = req.body;
    const conflict = await fhirSyncScheduler.resolveConflictWithMerge(req.params.id, mergedData, userId);
    if (!conflict) {
      return res.status(400).json({ error: "Conflict not pending or not found" });
    }
    res.json(conflict);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to merge conflict" });
  }
});

router.post("/conflicts/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const { userId = "admin" } = req.body;
    const conflict = fhirSyncScheduler.dismissConflict(req.params.id, userId);
    if (!conflict) {
      return res.status(400).json({ error: "Conflict not pending or not found" });
    }
    res.json(conflict);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to dismiss conflict" });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const { jobId, configurationId, level, startTime, endTime, limit } = req.query;
    const logs = fhirSyncScheduler.getLogs({
      jobId: jobId as string | undefined,
      configurationId: configurationId as string | undefined,
      level: level as "info" | "warning" | "error" | "debug" | undefined,
      startTime: startTime as string | undefined,
      endTime: endTime as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get logs" });
  }
});

router.get("/resource-types", async (_req: Request, res: Response) => {
  try {
    const resourceTypes = fhirSyncScheduler.getSupportedResourceTypes();
    res.json(resourceTypes);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get resource types" });
  }
});

router.get("/conflict-strategies", async (_req: Request, res: Response) => {
  try {
    const strategies = fhirSyncScheduler.getConflictResolutionStrategies();
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get strategies" });
  }
});

router.get("/frequencies", async (_req: Request, res: Response) => {
  try {
    const frequencies = fhirSyncScheduler.getSyncFrequencies();
    res.json(frequencies);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get frequencies" });
  }
});

router.get("/resource-metadata/:configurationId", async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.query;
    const metadata = fhirSyncScheduler.getResourceMetadata(
      req.params.configurationId,
      resourceType as string | undefined
    );
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get resource metadata" });
  }
});

export function registerFHIRSyncSchedulerRoutes(app: Router): void {
  app.use("/api/fhir-sync-scheduler", router);
  console.log("[Routes] FHIR Sync Scheduler routes registered at /api/fhir-sync-scheduler/*");
}
