import { Router, Request, Response } from "express";
import { ascvdCalculatorService } from "./services/ascvd-calculator-service";

const router = Router();

router.get("/calculate/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const history = ascvdCalculatorService.getHistory(profileId);
    if (history.length === 0) return res.status(404).json({ error: "No ASCVD calculations found. Use POST to calculate." });
    res.json(history[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ASCVD result", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/calculate/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { age, sex, race, totalCholesterol, hdlCholesterol, systolicBP, onBPMeds, diabetic, smoker, ldlCholesterol, a1c, bmi, familyHistory } = req.body;

    if (!age || !sex || !totalCholesterol || !hdlCholesterol || !systolicBP) {
      return res.status(400).json({ error: "Missing required fields: age, sex, totalCholesterol, hdlCholesterol, systolicBP" });
    }

    const result = ascvdCalculatorService.calculateASCVD(profileId, {
      age, sex, race: race || "white", totalCholesterol, hdlCholesterol, systolicBP,
      onBPMeds: onBPMeds || false, diabetic: diabetic || false, smoker: smoker || false,
      ldlCholesterol, a1c, bmi, familyHistory,
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: "Calculation failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/auto-calculate/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const result = await ascvdCalculatorService.autoCalculateFromPatientData(profileId);
    if ("error" in result) {
      return res.status(422).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "AI auto-calculation failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/history/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(ascvdCalculatorService.getHistory(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/guidelines", async (_req: Request, res: Response) => {
  try {
    res.json(ascvdCalculatorService.getPreventiveGuidelines());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch guidelines" });
  }
});

router.get("/guidelines/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    res.json(ascvdCalculatorService.getGuidelinesByCategory(category));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch guidelines" });
  }
});

export default router;
