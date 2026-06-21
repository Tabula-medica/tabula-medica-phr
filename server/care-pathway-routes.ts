import { Router, Request, Response } from "express";
import { carePathwayService } from "./services/care-pathway-service";

const router = Router();

router.get("/pathways", async (_req: Request, res: Response) => {
  try {
    const pathways = await carePathwayService.getAllPathways();
    res.json(pathways);
  } catch (error) {
    console.error("[CarePathway] Error fetching pathways:", error);
    res.status(500).json({ error: "Failed to fetch pathways" });
  }
});

router.get("/pathways/:pathwayId", async (req: Request, res: Response) => {
  try {
    const { pathwayId } = req.params;
    const pathway = await carePathwayService.getPathway(pathwayId);
    if (!pathway) {
      return res.status(404).json({ error: "Pathway not found" });
    }
    res.json(pathway);
  } catch (error) {
    console.error("[CarePathway] Error fetching pathway:", error);
    res.status(500).json({ error: "Failed to fetch pathway" });
  }
});

router.get("/pathways/condition/:conditionCode", async (req: Request, res: Response) => {
  try {
    const { conditionCode } = req.params;
    const pathways = await carePathwayService.getPathwaysByCondition(conditionCode);
    res.json(pathways);
  } catch (error) {
    console.error("[CarePathway] Error searching pathways:", error);
    res.status(500).json({ error: "Failed to search pathways" });
  }
});

router.post("/assignments", async (req: Request, res: Response) => {
  try {
    const { pathwayId, patientId, providerId, startDate, notes } = req.body;
    
    if (!pathwayId || !patientId || !providerId) {
      return res.status(400).json({ error: "pathwayId, patientId, and providerId are required" });
    }

    const assignment = await carePathwayService.assignPathwayToPatient(
      pathwayId,
      patientId,
      providerId,
      startDate ? new Date(startDate) : undefined,
      notes
    );
    res.status(201).json(assignment);
  } catch (error) {
    console.error("[CarePathway] Error assigning pathway:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to assign pathway" });
  }
});

router.get("/patient/:patientId/pathways", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const pathways = await carePathwayService.getPatientPathways(patientId);
    res.json(pathways);
  } catch (error) {
    console.error("[CarePathway] Error fetching patient pathways:", error);
    res.status(500).json({ error: "Failed to fetch patient pathways" });
  }
});

router.get("/assignments/:patientPathwayId", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const assignment = await carePathwayService.getPatientPathway(patientPathwayId);
    if (!assignment) {
      return res.status(404).json({ error: "Patient pathway not found" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("[CarePathway] Error fetching assignment:", error);
    res.status(500).json({ error: "Failed to fetch assignment" });
  }
});

router.get("/provider/:providerId/assignments", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const assignments = await carePathwayService.getProviderAssignments(providerId);
    res.json(assignments);
  } catch (error) {
    console.error("[CarePathway] Error fetching provider assignments:", error);
    res.status(500).json({ error: "Failed to fetch provider assignments" });
  }
});

router.patch("/assignments/:patientPathwayId/status", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const { status, providerId, reason } = req.body;

    if (!status || !providerId) {
      return res.status(400).json({ error: "status and providerId are required" });
    }

    const assignment = await carePathwayService.updatePathwayStatus(
      patientPathwayId,
      status,
      providerId,
      reason
    );
    res.json(assignment);
  } catch (error) {
    console.error("[CarePathway] Error updating status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/assignments/:patientPathwayId/tasks/:taskId/complete", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId, taskId } = req.params;
    const { notes, measuredValue, measuredUnit } = req.body;

    const completion = await carePathwayService.completeTask(
      patientPathwayId,
      taskId,
      notes,
      measuredValue,
      measuredUnit
    );
    res.status(201).json(completion);
  } catch (error) {
    console.error("[CarePathway] Error completing task:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to complete task" });
  }
});

router.post("/assignments/:patientPathwayId/content/:contentId/engage", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId, contentId } = req.params;
    const { progressPercent, quizScore } = req.body;

    if (progressPercent === undefined) {
      return res.status(400).json({ error: "progressPercent is required" });
    }

    const engagement = await carePathwayService.engageContent(
      patientPathwayId,
      contentId,
      progressPercent,
      quizScore
    );
    res.json(engagement);
  } catch (error) {
    console.error("[CarePathway] Error engaging content:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to engage content" });
  }
});

router.get("/assignments/:patientPathwayId/adherence", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const analytics = await carePathwayService.getAdherenceAnalytics(patientPathwayId);
    res.json(analytics);
  } catch (error) {
    console.error("[CarePathway] Error fetching adherence:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to fetch adherence" });
  }
});

router.get("/patient/:patientId/nudges", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const unreadOnly = req.query.unreadOnly === 'true';
    const nudges = await carePathwayService.getPatientNudges(patientId, unreadOnly);
    res.json(nudges);
  } catch (error) {
    console.error("[CarePathway] Error fetching nudges:", error);
    res.status(500).json({ error: "Failed to fetch nudges" });
  }
});

router.patch("/patient/:patientId/nudges/:nudgeId/read", async (req: Request, res: Response) => {
  try {
    const { patientId, nudgeId } = req.params;
    const nudge = await carePathwayService.markNudgeRead(nudgeId, patientId);
    if (!nudge) {
      return res.status(404).json({ error: "Nudge not found" });
    }
    res.json(nudge);
  } catch (error) {
    console.error("[CarePathway] Error marking nudge read:", error);
    res.status(500).json({ error: "Failed to mark nudge read" });
  }
});

router.get("/assignments/:patientPathwayId/recommendations/content", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const recommendations = await carePathwayService.generateAIContentRecommendations(patientPathwayId);
    res.json(recommendations);
  } catch (error) {
    console.error("[CarePathway] Error generating content recommendations:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to generate recommendations" });
  }
});

router.get("/assignments/:patientPathwayId/recommendations/tasks", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const recommendations = await carePathwayService.generateAITaskRecommendations(patientPathwayId);
    res.json(recommendations);
  } catch (error) {
    console.error("[CarePathway] Error generating task recommendations:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to generate recommendations" });
  }
});

router.post("/assignments/:patientPathwayId/nudges/generate", async (req: Request, res: Response) => {
  try {
    const { patientPathwayId } = req.params;
    const nudges = await carePathwayService.generateAutomatedNudges(patientPathwayId);
    res.json(nudges);
  } catch (error) {
    console.error("[CarePathway] Error generating nudges:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to generate nudges" });
  }
});

export function registerCarePathwayRoutes(app: Router) {
  app.use("/api/care-pathways", router);
  console.log("[Routes] Care Pathway routes registered at /api/care-pathways/*");
}
