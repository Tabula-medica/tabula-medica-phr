import { Router, Request, Response } from "express";
import { fhirSyncEngine } from "./services/fhir-sync-engine";

const router = Router();

/**
 * FHIR Bidirectional Sync Routes
 * 
 * DEVELOPMENT/MOCK IMPLEMENTATION
 * These routes provide the API interface for the FHIR sync engine.
 * 
 * PRODUCTION REQUIREMENTS:
 * - Authentication/RBAC middleware on all endpoints
 * - Zod schema validation for request bodies
 * - Rate limiting to prevent abuse
 * - Input size limits on /events and /sync endpoints
 * - HIPAA audit logging (implemented via sync engine)
 */

// Get sync engine metadata
router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    service: "FHIR Bidirectional Sync Engine",
    version: "1.0.0",
    capabilities: [
      "bidirectional-sync",
      "us-core-validation",
      "realtime-sync",
      "scheduled-sync",
      "event-queue"
    ],
    supportedFrequencies: ["realtime", "hourly", "daily", "manual"],
    supportedDirections: ["push", "pull", "bidirectional"],
    profiles: fhirSyncEngine.getSupportedProfiles()
  });
});

// Get sync statistics
router.get("/statistics", (req: Request, res: Response) => {
  const stats = fhirSyncEngine.getSyncStatistics();
  res.json(stats);
});

// Configuration endpoints
router.get("/configurations", (req: Request, res: Response) => {
  const configs = fhirSyncEngine.getConfigurations();
  res.json(configs);
});

router.get("/configurations/:id", (req: Request, res: Response) => {
  const config = fhirSyncEngine.getConfiguration(req.params.id);
  if (!config) {
    return res.status(404).json({ error: "Configuration not found" });
  }
  res.json(config);
});

router.post("/configurations", (req: Request, res: Response) => {
  try {
    const config = fhirSyncEngine.createConfiguration(req.body);
    res.status(201).json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/configurations/:id", (req: Request, res: Response) => {
  const config = fhirSyncEngine.updateConfiguration(req.params.id, req.body);
  if (!config) {
    return res.status(404).json({ error: "Configuration not found" });
  }
  res.json(config);
});

router.delete("/configurations/:id", (req: Request, res: Response) => {
  const deleted = fhirSyncEngine.deleteConfiguration(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Configuration not found" });
  }
  res.json({ success: true });
});

// Toggle configuration enabled state
router.post("/configurations/:id/toggle", (req: Request, res: Response) => {
  const config = fhirSyncEngine.getConfiguration(req.params.id);
  if (!config) {
    return res.status(404).json({ error: "Configuration not found" });
  }

  const updated = fhirSyncEngine.updateConfiguration(req.params.id, {
    enabled: !config.enabled
  });

  res.json(updated);
});

// Sync job endpoints
router.get("/jobs", (req: Request, res: Response) => {
  const configId = req.query.configId as string | undefined;
  const jobs = fhirSyncEngine.getSyncJobs(configId);
  res.json(jobs);
});

router.get("/jobs/:id", (req: Request, res: Response) => {
  const job = fhirSyncEngine.getSyncJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});

router.post("/jobs/:id/cancel", async (req: Request, res: Response) => {
  const cancelled = await fhirSyncEngine.cancelSyncJob(req.params.id);
  if (!cancelled) {
    return res.status(400).json({ error: "Job cannot be cancelled" });
  }
  res.json({ success: true });
});

// Trigger manual sync
router.post("/sync", async (req: Request, res: Response) => {
  const { configurationId, direction } = req.body;

  if (!configurationId) {
    return res.status(400).json({ error: "configurationId is required" });
  }

  try {
    const job = await fhirSyncEngine.executeSyncJob(
      configurationId,
      direction || "push"
    );
    res.json(job);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Queue a sync event (for realtime sync)
router.post("/events", (req: Request, res: Response) => {
  const { type, resourceType, resourceId, patientId, data } = req.body;

  if (!type || !resourceType || !resourceId || !data) {
    return res.status(400).json({
      error: "type, resourceType, resourceId, and data are required"
    });
  }

  fhirSyncEngine.queueSyncEvent({
    type,
    resourceType,
    resourceId,
    patientId,
    data
  });

  res.json({ success: true, message: "Event queued for sync" });
});

// Validate a resource against US Core
router.post("/validate", (req: Request, res: Response) => {
  const { resource, resourceType } = req.body;

  if (!resource || !resourceType) {
    return res.status(400).json({
      error: "resource and resourceType are required"
    });
  }

  const result = fhirSyncEngine.validateAgainstUSCore(resource, resourceType);
  res.json(result);
});

// Get supported US Core profiles
router.get("/profiles", (req: Request, res: Response) => {
  const profiles = fhirSyncEngine.getSupportedProfiles();
  res.json(profiles);
});

export function registerFHIRSyncRoutes(app: any): void {
  app.use("/api/fhir-sync", router);
  console.log("[Routes] FHIR Bidirectional Sync routes registered at /api/fhir-sync/*");
}
