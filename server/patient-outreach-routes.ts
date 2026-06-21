import { Express, Request, Response } from "express";
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaignStatus,
  getOutreachMessages,
  sendOutreachMessage,
  getCareTeamTasks,
  createCareTeamTask,
  updateTaskStatus,
  getOutreachCriteria,
  identifyPatientsForOutreach,
  generatePersonalizedMessage,
  runCampaign,
  getOutreachAnalytics,
} from "./services/patient-outreach-service";

export function registerPatientOutreachRoutes(app: Express): void {
  app.get("/api/patient-outreach/campaigns", async (req: Request, res: Response) => {
    try {
      const campaigns = getCampaigns();
      res.json({ campaigns });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/patient-outreach/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const campaign = getCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json({ campaign });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/patient-outreach/campaigns", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const campaign = await createCampaign(req.body, userId, ipAddress, userAgent);
      res.status(201).json({ campaign });
    } catch (error) {
      console.error("[PatientOutreach] Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/patient-outreach/campaigns/:id/status", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status } = req.body;

      const campaign = await updateCampaignStatus(req.params.id, status, userId, ipAddress, userAgent);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json({ campaign });
    } catch (error) {
      console.error("[PatientOutreach] Error updating campaign status:", error);
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  });

  app.post("/api/patient-outreach/campaigns/:id/run", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await runCampaign(req.params.id, userId, ipAddress, userAgent);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[PatientOutreach] Error running campaign:", error);
      res.status(500).json({ error: "Failed to run campaign" });
    }
  });

  app.get("/api/patient-outreach/messages", async (req: Request, res: Response) => {
    try {
      const { campaignId, patientId, status } = req.query;
      const messages = getOutreachMessages({
        campaignId: campaignId as string,
        patientId: patientId as string,
        status: status as any,
      });
      res.json({ messages });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/patient-outreach/messages", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const message = await sendOutreachMessage(req.body, userId, ipAddress, userAgent);
      res.status(201).json({ message });
    } catch (error) {
      console.error("[PatientOutreach] Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/patient-outreach/tasks", async (req: Request, res: Response) => {
    try {
      const { assignedTo, status, patientId } = req.query;
      const tasks = getCareTeamTasks({
        assignedTo: assignedTo as string,
        status: status as string,
        patientId: patientId as string,
      });
      res.json({ tasks });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/patient-outreach/tasks", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const task = await createCareTeamTask(req.body, userId, ipAddress, userAgent);
      res.status(201).json({ task });
    } catch (error) {
      console.error("[PatientOutreach] Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/patient-outreach/tasks/:id/status", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status, notes } = req.body;

      const task = await updateTaskStatus(req.params.id, status, notes, userId, ipAddress, userAgent);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ task });
    } catch (error) {
      console.error("[PatientOutreach] Error updating task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  app.get("/api/patient-outreach/criteria", async (req: Request, res: Response) => {
    try {
      const criteria = getOutreachCriteria();
      res.json({ criteria });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching criteria:", error);
      res.status(500).json({ error: "Failed to fetch criteria" });
    }
  });

  app.get("/api/patient-outreach/identify-patients", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { criteriaId } = req.query;

      const patients = await identifyPatientsForOutreach(
        criteriaId as string,
        userId,
        ipAddress,
        userAgent
      );
      res.json({ patients });
    } catch (error) {
      console.error("[PatientOutreach] Error identifying patients:", error);
      res.status(500).json({ error: "Failed to identify patients" });
    }
  });

  app.post("/api/patient-outreach/generate-message", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const { patientId, patientName, outreachType, context } = req.body;

      const message = await generatePersonalizedMessage(
        patientId,
        patientName,
        outreachType,
        context,
        userId,
        ipAddress,
        userAgent
      );
      res.json({ message });
    } catch (error) {
      console.error("[PatientOutreach] Error generating message:", error);
      res.status(500).json({ error: "Failed to generate message" });
    }
  });

  app.get("/api/patient-outreach/analytics", async (req: Request, res: Response) => {
    try {
      const analytics = getOutreachAnalytics();
      res.json({ analytics });
    } catch (error) {
      console.error("[PatientOutreach] Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  console.log("[PatientOutreach] Routes registered");
}
