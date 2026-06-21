import { Router } from "express";
import { bidirectionalFhirSyncService } from "./services/bidirectional-fhir-sync-service";

const router = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const dashboard = bidirectionalFhirSyncService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[BidirectionalSync] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get sync dashboard" });
  }
});

router.get("/servers", async (req, res) => {
  try {
    const servers = bidirectionalFhirSyncService.getServers();
    res.json(servers);
  } catch (error) {
    console.error("[BidirectionalSync] Get servers error:", error);
    res.status(500).json({ error: "Failed to get servers" });
  }
});

router.get("/servers/:serverId", async (req, res) => {
  try {
    const server = bidirectionalFhirSyncService.getServer(req.params.serverId);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }
    res.json(server);
  } catch (error) {
    console.error("[BidirectionalSync] Get server error:", error);
    res.status(500).json({ error: "Failed to get server" });
  }
});

router.get("/configurations", async (req, res) => {
  try {
    const { serverId } = req.query;
    const configurations = bidirectionalFhirSyncService.getConfigurations(serverId as string | undefined);
    res.json(configurations);
  } catch (error) {
    console.error("[BidirectionalSync] Get configurations error:", error);
    res.status(500).json({ error: "Failed to get configurations" });
  }
});

router.get("/configurations/:configId", async (req, res) => {
  try {
    const config = bidirectionalFhirSyncService.getConfiguration(req.params.configId);
    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    res.json(config);
  } catch (error) {
    console.error("[BidirectionalSync] Get configuration error:", error);
    res.status(500).json({ error: "Failed to get configuration" });
  }
});

router.patch("/configurations/:configId", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "system";
    const config = await bidirectionalFhirSyncService.updateConfiguration(
      req.params.configId,
      req.body,
      userId
    );
    res.json(config);
  } catch (error) {
    console.error("[BidirectionalSync] Update configuration error:", error);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

router.get("/pending-changes", async (req, res) => {
  try {
    const { serverId, resourceType, status, direction } = req.query;
    const changes = bidirectionalFhirSyncService.getPendingChanges({
      serverId: serverId as string | undefined,
      resourceType: resourceType as any,
      status: status as any,
      direction: direction as any,
    });
    res.json(changes);
  } catch (error) {
    console.error("[BidirectionalSync] Get pending changes error:", error);
    res.status(500).json({ error: "Failed to get pending changes" });
  }
});

router.get("/pending-changes/:changeId", async (req, res) => {
  try {
    const change = bidirectionalFhirSyncService.getPendingChange(req.params.changeId);
    if (!change) {
      return res.status(404).json({ error: "Change not found" });
    }
    res.json(change);
  } catch (error) {
    console.error("[BidirectionalSync] Get pending change error:", error);
    res.status(500).json({ error: "Failed to get pending change" });
  }
});

router.post("/pending-changes/:changeId/approve", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const { notes, fieldResolutions } = req.body;
    const change = await bidirectionalFhirSyncService.approveChange(
      req.params.changeId,
      userId,
      notes,
      fieldResolutions
    );
    res.json({ success: true, change });
  } catch (error) {
    console.error("[BidirectionalSync] Approve change error:", error);
    res.status(500).json({ error: "Failed to approve change" });
  }
});

router.post("/pending-changes/:changeId/reject", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }
    const change = await bidirectionalFhirSyncService.rejectChange(
      req.params.changeId,
      userId,
      reason
    );
    res.json({ success: true, change });
  } catch (error) {
    console.error("[BidirectionalSync] Reject change error:", error);
    res.status(500).json({ error: "Failed to reject change" });
  }
});

router.post("/pending-changes/:changeId/resolve-conflict", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const { fieldPath, resolution } = req.body;
    if (!fieldPath || !resolution) {
      return res.status(400).json({ error: "Field path and resolution are required" });
    }
    const change = await bidirectionalFhirSyncService.resolveConflict(
      req.params.changeId,
      fieldPath,
      resolution,
      userId
    );
    res.json({ success: true, change });
  } catch (error) {
    console.error("[BidirectionalSync] Resolve conflict error:", error);
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

router.get("/pending-changes/:changeId/ai-recommendation", async (req, res) => {
  try {
    const recommendation = await bidirectionalFhirSyncService.getAIConflictRecommendation(
      req.params.changeId
    );
    res.json({ recommendation });
  } catch (error) {
    console.error("[BidirectionalSync] Get AI recommendation error:", error);
    res.status(500).json({ error: "Failed to get AI recommendation" });
  }
});

router.get("/jobs", async (req, res) => {
  try {
    const { serverId, status } = req.query;
    const jobs = bidirectionalFhirSyncService.getSyncJobs({
      serverId: serverId as string | undefined,
      status: status as any,
    });
    res.json(jobs);
  } catch (error) {
    console.error("[BidirectionalSync] Get jobs error:", error);
    res.status(500).json({ error: "Failed to get sync jobs" });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  try {
    const job = bidirectionalFhirSyncService.getSyncJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error("[BidirectionalSync] Get job error:", error);
    res.status(500).json({ error: "Failed to get sync job" });
  }
});

router.post("/jobs/start", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const { serverId, resourceTypes, direction } = req.body;
    if (!serverId || !resourceTypes || !direction) {
      return res.status(400).json({ error: "Server ID, resource types, and direction are required" });
    }
    const job = await bidirectionalFhirSyncService.startSyncJob(
      serverId,
      resourceTypes,
      direction,
      userId
    );
    res.json({ success: true, job });
  } catch (error) {
    console.error("[BidirectionalSync] Start job error:", error);
    res.status(500).json({ error: "Failed to start sync job" });
  }
});

router.post("/jobs/:jobId/pause", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const job = await bidirectionalFhirSyncService.pauseSyncJob(req.params.jobId, userId);
    res.json({ success: true, job });
  } catch (error) {
    console.error("[BidirectionalSync] Pause job error:", error);
    res.status(500).json({ error: "Failed to pause sync job" });
  }
});

router.post("/jobs/:jobId/resume", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "user";
    const job = await bidirectionalFhirSyncService.resumeSyncJob(req.params.jobId, userId);
    res.json({ success: true, job });
  } catch (error) {
    console.error("[BidirectionalSync] Resume job error:", error);
    res.status(500).json({ error: "Failed to resume sync job" });
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const { syncJobId, resourceId } = req.query;
    const logs = bidirectionalFhirSyncService.getAuditLogs({
      syncJobId: syncJobId as string | undefined,
      resourceId: resourceId as string | undefined,
    });
    res.json(logs);
  } catch (error) {
    console.error("[BidirectionalSync] Get audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

console.log("[Routes] Bidirectional FHIR Sync routes registered at /api/fhir-bidirectional-sync/*");

export default router;
