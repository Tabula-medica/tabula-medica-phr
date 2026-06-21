import { Router, Request, Response } from "express";
import { z } from "zod";
import { backgroundJobService, JobType, JobPriority, JobStatus } from "./services/background-job-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const createJobSchema = z.object({
  type: z.enum(["health_data_sync", "fhir_import", "document_ingestion", "medication_sync", "lab_results_sync", "wearable_sync"]),
  patientId: z.string().min(1),
  sourceId: z.string().optional(),
  sourceName: z.string().optional(),
  sourceType: z.string().optional(),
  scheduleId: z.string().optional(),
  priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryConfig: z.object({
    strategy: z.enum(["exponential", "linear", "fixed"]).optional(),
    baseDelayMs: z.number().min(100).max(60000).optional(),
    maxDelayMs: z.number().min(1000).max(600000).optional(),
  }).optional(),
});

router.post("/jobs", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const validation = createJobSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request body",
        details: validation.error.errors 
      });
    }

    const { type, patientId, sourceId, sourceName, sourceType, scheduleId, priority, maxRetries, retryConfig } = validation.data;

    const job = await backgroundJobService.createJob({
      type: type as JobType,
      payload: {
        patientId,
        userId,
        sourceId,
        sourceName,
        sourceType,
        scheduleId,
      },
      priority: priority as JobPriority,
      maxRetries,
      retryConfig,
      metadata: {
        triggeredBy: "manual",
        sourceIp: req.ip,
        userAgent: req.headers["user-agent"],
        tags: sourceType ? [sourceType] : [],
      },
    });

    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error creating job:", error);
    res.status(500).json({ success: false, error: "Failed to create job" });
  }
});

router.get("/jobs", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { status, type, patientId, limit, offset } = req.query;

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "BackgroundJob",
      details: `View job list with filters: ${JSON.stringify({ status, type, patientId })}`,
    });

    const result = await backgroundJobService.getJobs({
      status: status as JobStatus | undefined,
      type: type as JobType | undefined,
      patientId: patientId as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ success: true, data: result.jobs, total: result.total });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error getting jobs:", error);
    res.status(500).json({ success: false, error: "Failed to get jobs" });
  }
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await backgroundJobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error getting job:", error);
    res.status(500).json({ success: false, error: "Failed to get job" });
  }
});

router.post("/jobs/:jobId/cancel", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";

    const success = await backgroundJobService.cancelJob(jobId, userId);

    if (!success) {
      return res.status(400).json({ 
        success: false, 
        error: "Cannot cancel job (may be running or already completed)" 
      });
    }

    res.json({ success: true, message: "Job cancelled successfully" });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error cancelling job:", error);
    res.status(500).json({ success: false, error: "Failed to cancel job" });
  }
});

router.post("/jobs/:jobId/retry", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id || "anonymous";

    const job = await backgroundJobService.retryJob(jobId, userId);

    if (!job) {
      return res.status(400).json({ 
        success: false, 
        error: "Cannot retry job (must be in failed or dead state)" 
      });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error retrying job:", error);
    res.status(500).json({ success: false, error: "Failed to retry job" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = backgroundJobService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error getting stats:", error);
    res.status(500).json({ success: false, error: "Failed to get stats" });
  }
});

router.get("/queues", async (_req: Request, res: Response) => {
  try {
    const queues = backgroundJobService.getQueues();
    res.json({ success: true, data: queues });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error getting queues:", error);
    res.status(500).json({ success: false, error: "Failed to get queues" });
  }
});

router.post("/queues/:queueId/pause", async (req: Request, res: Response) => {
  try {
    const { queueId } = req.params;
    const success = await backgroundJobService.pauseQueue(queueId);

    if (!success) {
      return res.status(404).json({ success: false, error: "Queue not found" });
    }

    res.json({ success: true, message: "Queue paused" });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error pausing queue:", error);
    res.status(500).json({ success: false, error: "Failed to pause queue" });
  }
});

router.post("/queues/:queueId/resume", async (req: Request, res: Response) => {
  try {
    const { queueId } = req.params;
    const success = await backgroundJobService.resumeQueue(queueId);

    if (!success) {
      return res.status(404).json({ success: false, error: "Queue not found" });
    }

    res.json({ success: true, message: "Queue resumed" });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error resuming queue:", error);
    res.status(500).json({ success: false, error: "Failed to resume queue" });
  }
});

router.get("/dead-letter", async (_req: Request, res: Response) => {
  try {
    const entries = backgroundJobService.getDeadLetterQueue();
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error getting dead letter queue:", error);
    res.status(500).json({ success: false, error: "Failed to get dead letter queue" });
  }
});

router.post("/dead-letter/:entryId/retry", async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const userId = (req as any).user?.id || "anonymous";

    const job = await backgroundJobService.retryFromDeadLetter(entryId, userId);

    if (!job) {
      return res.status(400).json({ 
        success: false, 
        error: "Cannot retry entry (may not exist or not retryable)" 
      });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error retrying from dead letter:", error);
    res.status(500).json({ success: false, error: "Failed to retry from dead letter queue" });
  }
});

router.delete("/dead-letter", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const count = await backgroundJobService.purgeDeadLetterQueue(userId);
    res.json({ success: true, message: `Purged ${count} entries` });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error purging dead letter queue:", error);
    res.status(500).json({ success: false, error: "Failed to purge dead letter queue" });
  }
});

router.post("/trigger-sync/:scheduleId", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userId = (req as any).user?.id || "anonymous";

    const job = await backgroundJobService.triggerScheduledSync(scheduleId, userId);
    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[BackgroundJobRoutes] Error triggering sync:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to trigger sync" 
    });
  }
});

export default router;
