import { Router, Request, Response } from "express";
import { stateIISConnectorService } from "./services/state-iis-connector-service";
import { iisBackgroundSyncService } from "./services/iis-background-sync-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

const NO_CDS_DISCLAIMER = "IMPORTANT: IIS data is for record verification only. This is NOT clinical decision support. All immunization decisions must be made by qualified healthcare providers in consultation with patients.";

router.get("/connectors", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISConnector",
      resourceId: "all",
      details: "IIS list connectors",
    });

    const connectors = stateIISConnectorService.getAllConnectors();
    res.json({
      connectors,
      total: connectors.length,
      connected: connectors.filter((c) => c.connectionStatus === "connected").length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve IIS connectors",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/connectors/:connectorId", requireUser, async (req: Request, res: Response) => {
  try {
    const { connectorId } = req.params;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISConnector",
      resourceId: connectorId,
      details: `IIS get connector: ${connectorId}`,
    });

    const connector = stateIISConnectorService.getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({
        error: "Connector not found",
        connectorId,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      connector,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve connector",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/connectors/state/:stateCode", requireUser, async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISConnector",
      resourceId: stateCode,
      details: `IIS get connector by state: ${stateCode}`,
    });

    const connector = stateIISConnectorService.getConnectorByState(stateCode);
    if (!connector) {
      return res.status(404).json({
        error: "State connector not found",
        stateCode,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      connector,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve state connector",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/connected", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISConnector",
      resourceId: "connected",
      details: "IIS list connected states",
    });

    const connectors = stateIISConnectorService.getConnectedStates();
    res.json({
      connectors,
      count: connectors.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve connected states",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/connect/:stateCode", requireUser, async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const userId = getUserId(req);

    const connector = await stateIISConnectorService.connectState(stateCode, userId);
    res.json({
      success: true,
      connector,
      message: `Successfully connected to ${connector.registryName}`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to connect to state IIS",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/disconnect/:stateCode", requireUser, async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const userId = getUserId(req);

    const connector = await stateIISConnectorService.disconnectState(stateCode, userId);
    res.json({
      success: true,
      connector,
      message: `Successfully disconnected from ${connector.registryName}`,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to disconnect from state IIS",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/sync/:connectorId", requireUser, async (req: Request, res: Response) => {
  try {
    const { connectorId } = req.params;
    const { patientId } = req.body;
    const userId = getUserId(req);

    if (!patientId) {
      return res.status(400).json({
        error: "Patient ID is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const job = await stateIISConnectorService.triggerSync(connectorId, patientId, userId);
    res.json({
      success: true,
      job,
      message: "Sync job queued successfully",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to trigger sync",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/sync/job/:jobId", requireUser, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISSyncJob",
      resourceId: jobId,
      details: `IIS get sync job: ${jobId}`,
    });

    const job = stateIISConnectorService.getSyncJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: "Sync job not found",
        jobId,
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      job,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve sync job",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/sync/patient/:patientId", requireUser, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISSyncJob",
      resourceId: patientId,
      patientId,
      details: `IIS get patient sync jobs: ${patientId}`,
    });

    const jobs = stateIISConnectorService.getPatientSyncJobs(patientId);
    res.json({
      jobs,
      count: jobs.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve patient sync jobs",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/verifications/:patientId", requireUser, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISVerification",
      resourceId: patientId,
      patientId,
      details: `IIS get verifications: ${patientId}`,
    });

    const results = stateIISConnectorService.getVerificationResults(patientId);
    res.json({
      verifications: results,
      count: results.length,
      verifiedCount: results.filter((r) => r.verifiedByIIS).length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve verifications",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/health", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISSyncHealth",
      resourceId: "system",
      details: "IIS get sync health",
    });

    const health = stateIISConnectorService.getSyncHealth();
    res.json({
      ...health,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve sync health",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/errors/:errorIndex/resolve", requireUser, async (req: Request, res: Response) => {
  try {
    const errorIndex = parseInt(req.params.errorIndex, 10);
    const userId = getUserId(req);

    const resolved = await stateIISConnectorService.resolveError(errorIndex, userId);
    if (!resolved) {
      return res.status(404).json({
        error: "Error not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      success: true,
      message: "Error marked as resolved",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to resolve error",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/scheduler/stats", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISScheduler",
      resourceId: "stats",
      details: "IIS get scheduler stats",
    });

    const stats = iisBackgroundSyncService.getStats();
    res.json({
      ...stats,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve scheduler stats",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/schedules", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISSyncSchedule",
      resourceId: "all",
      details: "IIS list sync schedules",
    });

    const schedules = iisBackgroundSyncService.getAllSchedules();
    res.json({
      schedules,
      count: schedules.length,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve schedules",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/schedules", requireUser, async (req: Request, res: Response) => {
  try {
    const { connectorId, patientId, frequency } = req.body;
    const userId = getUserId(req);

    if (!connectorId || !patientId || !frequency) {
      return res.status(400).json({
        error: "connectorId, patientId, and frequency are required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    const schedule = await iisBackgroundSyncService.createSchedule(connectorId, patientId, frequency, userId);
    res.json({
      success: true,
      schedule,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create schedule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.patch("/schedules/:scheduleId", requireUser, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const { frequency, enabled } = req.body;
    const userId = getUserId(req);

    const schedule = await iisBackgroundSyncService.updateSchedule(scheduleId, { frequency, enabled }, userId);
    res.json({
      success: true,
      schedule,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update schedule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.delete("/schedules/:scheduleId", requireUser, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userId = getUserId(req);

    const deleted = await iisBackgroundSyncService.deleteSchedule(scheduleId, userId);
    if (!deleted) {
      return res.status(404).json({
        error: "Schedule not found",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({
      success: true,
      message: "Schedule deleted",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete schedule",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/schedules/:scheduleId/trigger", requireUser, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userId = getUserId(req);

    const job = await iisBackgroundSyncService.triggerManualSync(scheduleId, userId);
    res.json({
      success: true,
      job,
      message: "Manual sync triggered",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to trigger manual sync",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

console.log("[StateIISRoutes] Routes module loaded with 56 state/territory IIS connectors");
console.log("[StateIISRoutes] Background sync scheduler routes registered");

export default router;
