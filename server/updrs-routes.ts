import { Router, Request, Response } from "express";
import { updrsAssessmentService, UpdrsInputError } from "./services/updrs-assessment-service";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireProfile } from "./services/resolve-profile";
import { noStorePhi } from "./lib/middleware/no-store-phi";

const router = Router();

router.use(isAuthenticated, requireProfile, noStorePhi);

function ownProfileId(req: Request): string {
  return (req as any).resolvedProfileId as string;
}

router.get("/scale-definition", async (_req: Request, res: Response) => {
  res.json(updrsAssessmentService.getScaleDefinition());
});

router.post("/assess", async (req: Request, res: Response) => {
  const { scores, hoehnYahrStage, notes } = req.body ?? {};

  if (!scores || typeof scores !== "object") {
    return res.status(400).json({ error: "Missing required field: scores" });
  }
  if (typeof hoehnYahrStage !== "number") {
    return res.status(400).json({ error: "Missing required field: hoehnYahrStage" });
  }

  try {
    const assessment = await updrsAssessmentService.calculateAssessment(ownProfileId(req), scores, hoehnYahrStage, notes);
    res.status(201).json(assessment);
  } catch (error) {
    if (error instanceof UpdrsInputError) {
      return res.status(400).json({ error: "Assessment failed", message: error.message });
    }
    console.error("[UPDRS] Failed to save assessment:", error instanceof Error ? error.name : "unknown");
    res.status(500).json({ error: "Failed to save UPDRS assessment" });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const latest = await updrsAssessmentService.getLatest(ownProfileId(req));
    if (!latest) return res.status(404).json({ error: "No UPDRS assessments found. Use POST to create one." });
    res.json(latest);
  } catch (error) {
    console.error("[UPDRS] Failed to load latest assessment:", error instanceof Error ? error.name : "unknown");
    res.status(500).json({ error: "Failed to fetch latest UPDRS assessment" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    res.json(await updrsAssessmentService.getHistory(ownProfileId(req)));
  } catch (error) {
    console.error("[UPDRS] Failed to load history:", error instanceof Error ? error.name : "unknown");
    res.status(500).json({ error: "Failed to fetch UPDRS history" });
  }
});

export default router;
