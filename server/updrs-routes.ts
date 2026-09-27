import { Router, Request, Response } from "express";
import { updrsAssessmentService } from "./services/updrs-assessment-service";

const router = Router();

router.get("/scale-definition", async (_req: Request, res: Response) => {
  try {
    res.json(updrsAssessmentService.getScaleDefinition());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch UPDRS scale definition" });
  }
});

router.post("/assess/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { scores, hoehnYahrStage, notes } = req.body;

    if (!scores || typeof scores !== "object") {
      return res.status(400).json({ error: "Missing required field: scores" });
    }
    if (hoehnYahrStage === undefined || hoehnYahrStage === null) {
      return res.status(400).json({ error: "Missing required field: hoehnYahrStage" });
    }

    const assessment = updrsAssessmentService.calculateAssessment(profileId, scores, hoehnYahrStage, notes);
    res.status(201).json(assessment);
  } catch (error) {
    res.status(400).json({ error: "Assessment failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/latest/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const latest = updrsAssessmentService.getLatest(profileId);
    if (!latest) return res.status(404).json({ error: "No UPDRS assessments found. Use POST to create one." });
    res.json(latest);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest UPDRS assessment" });
  }
});

router.get("/history/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(updrsAssessmentService.getHistory(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch UPDRS history" });
  }
});

export default router;
