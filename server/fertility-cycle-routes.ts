import { Router, Request, Response } from "express";
import { fertilityCycleService } from "./services/fertility-cycle-service";

const router = Router();

router.get("/dashboard/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const dashboard = fertilityCycleService.getDashboard(profileId);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch fertility dashboard", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(fertilityCycleService.getProfile(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch fertility profile" });
  }
});

router.put("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const updates = req.body;
    const profile = fertilityCycleService.updateProfile(profileId, updates);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to update fertility profile" });
  }
});

router.post("/profile/:profileId/connect-mira", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Device ID is required" });
    const profile = fertilityCycleService.connectMiraDevice(profileId, deviceId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to connect MIRA device" });
  }
});

router.post("/profile/:profileId/disconnect-mira", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = fertilityCycleService.disconnectMiraDevice(profileId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect MIRA device" });
  }
});

router.get("/cycles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(fertilityCycleService.getCycles(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cycles" });
  }
});

router.post("/cycles/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const cycle = fertilityCycleService.addCycle(profileId, req.body);
    res.json(cycle);
  } catch (error) {
    res.status(500).json({ error: "Failed to add cycle" });
  }
});

router.patch("/cycles/:profileId/:cycleId", async (req: Request, res: Response) => {
  try {
    const { profileId, cycleId } = req.params;
    const updated = fertilityCycleService.updateCycle(profileId, cycleId, req.body);
    if (!updated) return res.status(404).json({ error: "Cycle not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update cycle" });
  }
});

router.get("/hormones/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { type, startDate, endDate } = req.query;
    const readings = fertilityCycleService.getHormoneReadings(
      profileId,
      type as any,
      startDate as string,
      endDate as string
    );
    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hormone readings" });
  }
});

router.post("/hormones/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const reading = fertilityCycleService.addHormoneReading(profileId, req.body);
    res.json(reading);
  } catch (error) {
    res.status(500).json({ error: "Failed to add hormone reading" });
  }
});

router.post("/share/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const share = fertilityCycleService.createProviderShare(profileId, req.body);
    res.json(share);
  } catch (error) {
    res.status(500).json({ error: "Failed to create provider share link" });
  }
});

router.get("/share/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    res.json(fertilityCycleService.getProviderShares(profileId));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch provider shares" });
  }
});

router.delete("/share/:profileId/:shareId", async (req: Request, res: Response) => {
  try {
    const { profileId, shareId } = req.params;
    const revoked = fertilityCycleService.revokeProviderShare(profileId, shareId);
    if (!revoked) return res.status(404).json({ error: "Share link not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke share link" });
  }
});

router.get("/shared/:shareToken", async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;
    const data = fertilityCycleService.getSharedData(shareToken);
    if (!data) return res.status(404).json({ error: "Invalid or expired share link" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shared data" });
  }
});

export default router;
