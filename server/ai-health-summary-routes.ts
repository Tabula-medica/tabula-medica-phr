import { Router, Request, Response } from "express";
import { aiHealthSummaryService } from "./services/ai-health-summary-service";

const router = Router();

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const summary = await aiHealthSummaryService.generateHealthSummary(patientId);
    res.json(summary);
  } catch (error) {
    console.error("[AIHealthSummary] Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate health summary" });
  }
});

router.get("/timeline/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const timeline = await aiHealthSummaryService.getHealthTimeline(patientId);
    res.json({ events: timeline });
  } catch (error) {
    console.error("[AIHealthSummary] Error generating timeline:", error);
    res.status(500).json({ error: "Failed to generate health timeline" });
  }
});

export function registerAIHealthSummaryRoutes(app: Router) {
  app.use("/api/health-summary", router);
  console.log("[Routes] AI Health Summary routes registered at /api/health-summary/*");
}
