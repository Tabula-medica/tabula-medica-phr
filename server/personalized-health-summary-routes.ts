import { Router, Request, Response } from "express";
import {
  generatePersonalizedHealthSummary,
  getPatientData,
} from "./services/ai-personalized-health-summary-service";

const router = Router();

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const viewMode = (req.query.viewMode as "patient" | "provider") || "patient";
    const userId = (req as any).user?.id || "current-user";

    const summary = await generatePersonalizedHealthSummary(patientId, userId, viewMode);
    res.json(summary);
  } catch (error) {
    console.error("[PersonalizedHealthSummary] Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate health summary" });
  }
});

router.get("/data/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const data = await getPatientData(patientId);
    
    if (!data) {
      return res.status(404).json({ error: "Patient data not found" });
    }
    
    res.json(data);
  } catch (error) {
    console.error("[PersonalizedHealthSummary] Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch patient data" });
  }
});

export default router;

console.log("[PersonalizedHealthSummary] Routes module loaded");
