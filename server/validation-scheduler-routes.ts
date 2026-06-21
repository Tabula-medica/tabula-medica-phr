import { Express, Request, Response } from "express";
import {
  checkDataQualityValidation,
  startValidationScheduler,
  stopValidationScheduler,
  triggerValidationOnDataUpdate,
  getSchedulerStatus,
  getSchedulerFailures,
} from "./services/validation-scheduler";

export function registerValidationSchedulerRoutes(app: Express): void {
  app.post("/api/fhir-validation/scheduler/run", async (req: Request, res: Response) => {
    try {
      console.log("[ValidationScheduler] Manual scan triggered via API");
      const result = await checkDataQualityValidation();
      res.json({ success: true, result });
    } catch (error) {
      console.error("[ValidationScheduler] Error running manual scan:", error);
      res.status(500).json({ error: "Failed to run validation scan" });
    }
  });

  app.post("/api/fhir-validation/scheduler/start", async (req: Request, res: Response) => {
    try {
      const { intervalHours = 24 } = req.body;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      startValidationScheduler(intervalMs);
      res.json({ success: true, message: `Scheduler started with ${intervalHours} hour interval` });
    } catch (error) {
      console.error("[ValidationScheduler] Error starting scheduler:", error);
      res.status(500).json({ error: "Failed to start scheduler" });
    }
  });

  app.post("/api/fhir-validation/scheduler/stop", async (req: Request, res: Response) => {
    try {
      stopValidationScheduler();
      res.json({ success: true, message: "Scheduler stopped" });
    } catch (error) {
      console.error("[ValidationScheduler] Error stopping scheduler:", error);
      res.status(500).json({ error: "Failed to stop scheduler" });
    }
  });

  app.post("/api/fhir-validation/scheduler/trigger", async (req: Request, res: Response) => {
    try {
      const { resourceType, resourceId } = req.body;
      if (!resourceType || !resourceId) {
        return res.status(400).json({ error: "resourceType and resourceId are required" });
      }
      triggerValidationOnDataUpdate(resourceType, resourceId);
      res.json({ success: true, message: "Validation triggered for data update" });
    } catch (error) {
      console.error("[ValidationScheduler] Error triggering validation:", error);
      res.status(500).json({ error: "Failed to trigger validation" });
    }
  });

  app.get("/api/fhir-validation/scheduler/status", async (req: Request, res: Response) => {
    try {
      const status = getSchedulerStatus();
      res.json({ status });
    } catch (error) {
      console.error("[ValidationScheduler] Error getting status:", error);
      res.status(500).json({ error: "Failed to get scheduler status" });
    }
  });

  app.get("/api/fhir-validation/scheduler/failures", async (req: Request, res: Response) => {
    try {
      const failures = getSchedulerFailures();
      res.json({ failures });
    } catch (error) {
      console.error("[ValidationScheduler] Error getting failures:", error);
      res.status(500).json({ error: "Failed to get scheduler failures" });
    }
  });
}
