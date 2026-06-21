import { Router, Request, Response } from "express";
import { automatedSyncScheduler } from "./services/automated-sync-scheduler";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/api/external-sync/schedules/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const schedules = await automatedSyncScheduler.getSchedules(patientId);

    await logPhiAccess({
      action: "read",
      resourceType: "SyncSchedule",
      patientId,
      userId: patientId,
      details: `Retrieved ${schedules.length} sync schedules`,
    });

    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("Error fetching sync schedules:", error);
    res.status(500).json({ success: false, error: "Failed to fetch sync schedules" });
  }
});

router.post("/api/external-sync/schedules", async (req: Request, res: Response) => {
  try {
    const { patientId, sourceId, sourceName, sourceType, frequency } = req.body;

    if (!patientId || !sourceId || !sourceName || !sourceType || !frequency) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const schedule = await automatedSyncScheduler.createSchedule({
      patientId,
      sourceId,
      sourceName,
      sourceType,
      frequency,
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("Error creating sync schedule:", error);
    res.status(500).json({ success: false, error: "Failed to create sync schedule" });
  }
});

router.patch("/api/external-sync/schedules/:scheduleId", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const { frequency, status } = req.body;

    const schedule = await automatedSyncScheduler.updateSchedule(scheduleId, { frequency, status });
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("Error updating sync schedule:", error);
    res.status(500).json({ success: false, error: "Failed to update sync schedule" });
  }
});

router.delete("/api/external-sync/schedules/:scheduleId", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const patientId = req.query.patientId as string;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId query parameter is required" });
    }

    const success = await automatedSyncScheduler.deleteSchedule(scheduleId, patientId);
    if (!success) {
      return res.status(404).json({ success: false, error: "Schedule not found or access denied" });
    }

    res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting sync schedule:", error);
    res.status(500).json({ success: false, error: "Failed to delete sync schedule" });
  }
});

router.post("/api/external-sync/schedules/:scheduleId/sync", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;

    const result = await automatedSyncScheduler.triggerManualSync(scheduleId);
    if (!result) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error triggering manual sync:", error);
    res.status(500).json({ success: false, error: "Failed to trigger sync" });
  }
});

router.get("/api/external-sync/history/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await automatedSyncScheduler.getSyncHistory(patientId, limit);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Error fetching sync history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch sync history" });
  }
});

router.get("/api/external-sync/analytics/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const analytics = await automatedSyncScheduler.getAnalytics(patientId);

    await logPhiAccess({
      action: "read",
      resourceType: "SyncAnalytics",
      patientId,
      userId: patientId,
      details: "Retrieved sync analytics",
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Error fetching sync analytics:", error);
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
});

router.get("/api/sync-dashboard/overview", async (_req: Request, res: Response) => {
  try {
    const patientId = "patient-1";
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const patientGrowth = [];
    const documentVolume = [];
    const medicationTrends = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      patientGrowth.push({
        date: dateStr,
        newPatients: Math.floor(Math.random() * 15) + 5,
        activePatients: 1000 + Math.floor(Math.random() * 50) + i * 10,
        totalProfiles: 2500 + i * 25,
      });

      documentVolume.push({
        date: dateStr,
        uploaded: Math.floor(Math.random() * 100) + 20,
        synced: Math.floor(Math.random() * 200) + 50,
        processed: Math.floor(Math.random() * 250) + 60,
      });

      medicationTrends.push({
        date: dateStr,
        newPrescriptions: Math.floor(Math.random() * 50) + 10,
        refills: Math.floor(Math.random() * 80) + 20,
        discontinued: Math.floor(Math.random() * 10) + 2,
      });
    }

    const syncsBySource = [
      { source: "Primary Care Provider", syncs: 1250, records: 45000 },
      { source: "Quest Diagnostics", syncs: 890, records: 12000 },
      { source: "CVS Pharmacy", syncs: 450, records: 8500 },
      { source: "Fitbit", syncs: 8640, records: 120000 },
      { source: "Apple Health", syncs: 2100, records: 85000 },
    ];

    const dataQualityMetrics = {
      completeness: 94.5,
      accuracy: 98.2,
      consistency: 96.8,
      timeliness: 91.3,
    };

    res.json({
      success: true,
      data: {
        patientGrowth,
        documentVolume,
        medicationTrends,
        syncsBySource,
        dataQualityMetrics,
        summary: {
          totalPatients: 2850,
          totalDocuments: 125000,
          totalSyncs: 45230,
          activeConnections: 12400,
          avgSyncSuccessRate: 98.5,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
  }
});

export default router;
