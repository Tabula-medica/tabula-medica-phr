import { Router, Request, Response } from "express";
import { womensHealthService } from "./services/womens-health-service";

const router = Router();

router.get("/dashboard/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const dashboard = womensHealthService.getDashboard(profileId);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/life-stage/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json({ lifeStage: womensHealthService.getLifeStage(profileId) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch life stage" });
  }
});

router.put("/life-stage/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { stage } = req.body;
    if (!["menstruation", "pregnancy", "menopause", "postmenopause"].includes(stage)) {
      return res.status(400).json({ error: "Invalid life stage" });
    }
    const result = womensHealthService.setLifeStage(profileId, stage);
    res.json({ lifeStage: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to update life stage" });
  }
});

router.get("/cycles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(womensHealthService.getCycles(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cycles" });
  }
});

router.post("/cycles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { startDate, endDate, flowIntensity, symptoms, notes } = req.body;
    if (!startDate || !flowIntensity) {
      return res.status(400).json({ error: "Missing required fields: startDate, flowIntensity" });
    }
    const cycle = womensHealthService.addCycle(profileId, { startDate, endDate, flowIntensity, symptoms: symptoms || [], notes });
    res.status(201).json(cycle);
  } catch (error) {
    res.status(500).json({ error: "Failed to add cycle" });
  }
});

router.delete("/cycles/:profileId/:cycleId", async (req: Request, res: Response) => {
  try {
    const { profileId, cycleId } = req.params;
    const deleted = womensHealthService.deleteCycle(profileId, cycleId);
    if (!deleted) return res.status(404).json({ error: "Cycle not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cycle" });
  }
});

router.get("/pregnancy/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const pregnancy = womensHealthService.getPregnancy(profileId);
    if (!pregnancy) return res.status(404).json({ error: "No pregnancy profile found" });
    res.json(pregnancy);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pregnancy" });
  }
});

router.post("/pregnancy/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { dueDate, lastMenstrualPeriod, provider } = req.body;
    if (!dueDate) {
      return res.status(400).json({ error: "Missing required field: dueDate" });
    }
    const pregnancy = womensHealthService.createPregnancy(profileId, { dueDate, lastMenstrualPeriod, provider });
    res.status(201).json(pregnancy);
  } catch (error) {
    res.status(500).json({ error: "Failed to create pregnancy" });
  }
});

router.patch("/pregnancy/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const result = womensHealthService.updatePregnancy(profileId, req.body);
    if (!result) return res.status(404).json({ error: "No pregnancy profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update pregnancy" });
  }
});

router.post("/pregnancy/:profileId/weight", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { date, weight, unit } = req.body;
    if (!date || !weight || !unit) {
      return res.status(400).json({ error: "Missing required fields: date, weight, unit" });
    }
    const result = womensHealthService.addPregnancyWeight(profileId, { date, weight, unit });
    if (!result) return res.status(404).json({ error: "No pregnancy profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to add weight entry" });
  }
});

router.post("/pregnancy/:profileId/appointment", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { date, type, provider, notes } = req.body;
    if (!date || !type) {
      return res.status(400).json({ error: "Missing required fields: date, type" });
    }
    const result = womensHealthService.addPregnancyAppointment(profileId, { date, type, provider, notes });
    if (!result) return res.status(404).json({ error: "No pregnancy profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to add appointment" });
  }
});

router.patch("/pregnancy/:profileId/milestone", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { milestone, completed, date } = req.body;
    if (!milestone || completed === undefined) {
      return res.status(400).json({ error: "Missing required fields: milestone, completed" });
    }
    const result = womensHealthService.toggleMilestone(profileId, milestone, completed, date);
    if (!result) return res.status(404).json({ error: "No pregnancy profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

router.get("/menopause/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = womensHealthService.getMenopauseProfile(profileId);
    if (!profile) return res.status(404).json({ error: "No menopause profile found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch menopause profile" });
  }
});

router.post("/menopause/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { stage, lastPeriodDate } = req.body;
    if (!stage || !["perimenopause", "menopause", "postmenopause"].includes(stage)) {
      return res.status(400).json({ error: "Invalid or missing stage" });
    }
    const profile = womensHealthService.createMenopauseProfile(profileId, { stage, lastPeriodDate });
    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to create menopause profile" });
  }
});

router.post("/menopause/:profileId/symptoms", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { date, symptoms, notes } = req.body;
    if (!date || !symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: "Missing required fields: date, symptoms" });
    }
    const result = womensHealthService.addMenopauseSymptoms(profileId, { date, symptoms, notes });
    if (!result) return res.status(404).json({ error: "No menopause profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to add symptoms" });
  }
});

router.post("/menopause/:profileId/hrt", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { name, dosage, startDate, sideEffects } = req.body;
    if (!name || !dosage || !startDate) {
      return res.status(400).json({ error: "Missing required fields: name, dosage, startDate" });
    }
    const result = womensHealthService.addHrtMedication(profileId, { name, dosage, startDate, sideEffects });
    if (!result) return res.status(404).json({ error: "No menopause profile found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to add HRT medication" });
  }
});

router.post("/menopause/:profileId/bone-screening", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { date, type, result, tScore, notes } = req.body;
    if (!date || !type) {
      return res.status(400).json({ error: "Missing required fields: date, type" });
    }
    const boneResult = womensHealthService.addBoneHealthScreening(profileId, { date, type, result, tScore, notes });
    if (!boneResult) return res.status(404).json({ error: "No menopause profile found" });
    res.json(boneResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to add bone screening" });
  }
});

router.post("/menopause/:profileId/cardio-screening", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { date, type, result, notes } = req.body;
    if (!date || !type) {
      return res.status(400).json({ error: "Missing required fields: date, type" });
    }
    const cardioResult = womensHealthService.addCardiovascularScreening(profileId, { date, type, result, notes });
    if (!cardioResult) return res.status(404).json({ error: "No menopause profile found" });
    res.json(cardioResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to add cardiovascular screening" });
  }
});

router.get("/education/:stage", async (req: Request, res: Response) => {
  try {
    const { stage } = req.params;
    if (!["menstruation", "pregnancy", "menopause", "postmenopause"].includes(stage)) {
      return res.status(400).json({ error: "Invalid life stage" });
    }
    const content = womensHealthService.getEducationalContent(stage as any);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch educational content" });
  }
});

export default router;
