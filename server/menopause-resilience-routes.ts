import { Router, Request, Response } from "express";
import { menopauseResilienceService } from "./services/menopause-resilience-service";

const router = Router();

router.get("/dashboard/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(menopauseResilienceService.getDashboard(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch menopause dashboard", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.getProfile(req.params.profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.updateProfile(req.params.profileId, req.body));
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/hormones/:profileId", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    res.json(menopauseResilienceService.getHormoneReadings(req.params.profileId, type as any));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hormone readings" });
  }
});

router.post("/hormones/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.addHormoneReading(req.params.profileId, req.body));
  } catch (error) {
    res.status(500).json({ error: "Failed to add hormone reading" });
  }
});

router.get("/biomarkers/:profileId", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    res.json(menopauseResilienceService.getBiomarkerReadings(req.params.profileId, type as any));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch biomarker readings" });
  }
});

router.post("/biomarkers/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.addBiomarkerReading(req.params.profileId, req.body));
  } catch (error) {
    res.status(500).json({ error: "Failed to add biomarker reading" });
  }
});

router.get("/resilience/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.getResilienceScore(req.params.profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate resilience score" });
  }
});

router.post("/share/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.createProviderShare(req.params.profileId, req.body));
  } catch (error) {
    res.status(500).json({ error: "Failed to create provider share" });
  }
});

router.get("/share/:profileId", async (req: Request, res: Response) => {
  try {
    res.json(menopauseResilienceService.getProviderShares(req.params.profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch provider shares" });
  }
});

router.delete("/share/:profileId/:shareId", async (req: Request, res: Response) => {
  try {
    const revoked = menopauseResilienceService.revokeProviderShare(req.params.profileId, req.params.shareId);
    if (!revoked) return res.status(404).json({ error: "Share not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke share" });
  }
});

router.get("/shared/:shareToken", async (req: Request, res: Response) => {
  try {
    const data = menopauseResilienceService.getSharedData(req.params.shareToken);
    if (!data) return res.status(404).json({ error: "Invalid or expired share link" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shared data" });
  }
});

export default router;
