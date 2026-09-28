import { Router, Request, Response } from "express";
import { updrsAssessmentService } from "./services/updrs-assessment-service";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireProfile } from "./services/resolve-profile";
import { noStorePhi } from "./lib/middleware/no-store-phi";

const router = Router();

router.use(isAuthenticated, requireProfile, noStorePhi);

function ownProfileId(req: Request): string {
  return (req as any).resolvedProfileId as string;
}

router.get("/scale-definition", async (_req: Request, res: Response) => {
  try {
    res.json(updrsAssessmentService.getScaleDefinition());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch UPDRS scale definition" });
  }
});

router.post("/assess", async (req: Request, res: Response) => {
  try {
    const { scores, hoehnYahrStage, notes } = req.body;

    if (!scores || typeof scores !== "object") {
      return res.status(400).json({ error: "Missing required field: scores" });
    }
    if (hoehnYahrStage === undefined || hoehnYahrStage === null) {
      return res.status(400).json({ error: "Missing required field: hoehnYahrStage" });
    }

    const assessment = updrsAssessmentService.calculateAssessment(ownProfileId(req), scores, hoehnYahrStage, notes);
    res.status(201).json(assessment);
  } catch (error) {
    res.status(400).json({ error: "Assessment failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const latest = updrsAssessmentService.getLatest(ownProfileId(req));
    if (!latest) return res.status(404).json({ error: "No UPDRS assessments found. Use POST to create one." });
    res.json(latest);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest UPDRS assessment" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    res.json(updrsAssessmentService.getHistory(ownProfileId(req)));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch UPDRS history" });
  }
});

export default router;
