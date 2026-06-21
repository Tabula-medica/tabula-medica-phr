import { Router, Request, Response } from "express";
import {
  generatePatientFriendlySummary,
  listAvailablePatients,
} from "../services/patient-friendly-summary-service";

const router = Router();

router.get("/patients", (_req: Request, res: Response) => {
  try {
    const patients = listAvailablePatients();
    res.json({ patients });
  } catch (error: any) {
    console.error("[PatientFriendlySummary] Error listing patients:", error);
    res.status(500).json({ error: "Failed to list patients" });
  }
});

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).user?.claims?.sub || "current-user";

    const summary = await generatePatientFriendlySummary(patientId, userId);
    if (!summary) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json(summary);
  } catch (error: any) {
    console.error("[PatientFriendlySummary] Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export default router;
