import { Router, Request, Response } from "express";
import { diabetesManagementService } from "./services/diabetes-management-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

router.get("/dashboard/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const summary = await diabetesManagementService.getDashboardSummary(profileId, userId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/glucose/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { days, context } = req.query;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getGlucoseEntries(profileId, userId, {
      days: days ? parseInt(days as string) : undefined,
      context: context as any,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch glucose entries", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/glucose/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const { value, unit, context, timestamp, source, notes } = req.body;
    
    if (!value || !unit || !context || !timestamp) {
      return res.status(400).json({ error: "Missing required fields: value, unit, context, timestamp" });
    }
    
    const entry = await diabetesManagementService.addGlucoseEntry(profileId, userId, {
      value,
      unit,
      context,
      timestamp,
      source: source || "manual",
      notes,
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to add glucose entry", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/events/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { days } = req.query;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getHypoHyperEvents(profileId, userId, days ? parseInt(days as string) : undefined);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/events/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const { eventType, severity, timestamp, symptoms, context, actionTaken, glucoseValue, glucoseUnit, resolved, notes } = req.body;
    
    if (!eventType || !severity || !timestamp || !symptoms) {
      return res.status(400).json({ error: "Missing required fields: eventType, severity, timestamp, symptoms" });
    }
    
    const event = await diabetesManagementService.logHypoHyperEvent(profileId, userId, {
      eventType,
      severity,
      timestamp,
      symptoms,
      context,
      actionTaken,
      glucoseValue,
      glucoseUnit,
      resolved: resolved || false,
      notes,
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to log event", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/medications/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getMedications(profileId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch medications", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/medications/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const med = await diabetesManagementService.addMedication(profileId, userId, req.body);
    res.status(201).json(med);
  } catch (error) {
    res.status(500).json({ error: "Failed to add medication", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/medications/:profileId/adherence", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const adherence = await diabetesManagementService.logMedicationAdherence(profileId, userId, req.body);
    res.status(201).json(adherence);
  } catch (error) {
    res.status(500).json({ error: "Failed to log adherence", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/labs/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { type } = req.query;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getLabResults(profileId, userId, type as any);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch labs", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/labs/:profileId/:labId/explain", async (req: Request, res: Response) => {
  try {
    const { profileId, labId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.explainLabResult(profileId, userId, labId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to explain lab result", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/tasks/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getCareTasks(profileId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch care tasks", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.patch("/tasks/:profileId/:taskId", async (req: Request, res: Response) => {
  try {
    const { profileId, taskId } = req.params;
    const userId = getUserId(req);
    
    const task = await diabetesManagementService.updateCareTask(profileId, userId, taskId, req.body);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/tasks/:profileId/:taskId/complete", async (req: Request, res: Response) => {
  try {
    const { profileId, taskId } = req.params;
    const userId = getUserId(req);
    
    const task = await diabetesManagementService.completeTask(profileId, userId, taskId);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to complete task", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/complications/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getComplications(profileId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complications", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/complications/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const comp = await diabetesManagementService.addComplication(profileId, userId, req.body);
    res.status(201).json(comp);
  } catch (error) {
    res.status(500).json({ error: "Failed to add complication", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/screenings/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getScreenings(profileId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch screenings", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/glucose-ranges/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const result = await diabetesManagementService.getGlucoseRanges(profileId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch glucose ranges", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.patch("/glucose-ranges/:profileId/:rangeId", async (req: Request, res: Response) => {
  try {
    const { profileId, rangeId } = req.params;
    const userId = getUserId(req);
    
    const range = await diabetesManagementService.updateGlucoseRange(profileId, userId, rangeId, req.body);
    
    if (!range) {
      return res.status(404).json({ error: "Range not found" });
    }
    
    res.json(range);
  } catch (error) {
    res.status(500).json({ error: "Failed to update range", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/packet/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const userId = getUserId(req);
    
    const options = req.body;
    
    if (!options.packetType || !options.timeframeMonths) {
      return res.status(400).json({ error: "Missing required fields: packetType, timeframeMonths" });
    }
    
    const packet = await diabetesManagementService.generateVisitPacket(profileId, userId, options);
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate packet", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/templates", async (_req: Request, res: Response) => {
  try {
    const result = diabetesManagementService.getGuidelineTemplates();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

export default router;
