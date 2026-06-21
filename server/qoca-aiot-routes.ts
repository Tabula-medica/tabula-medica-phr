import { Router, Request, Response } from "express";
import { qocaAIoTService } from "./services/qoca-aiot-service";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const summary = await qocaAIoTService.getDashboardSummary(patientId);
    res.json(summary);
  } catch (error) {
    console.error("[QOCAAIoT] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/devices", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const devices = await qocaAIoTService.getDevices(patientId);
    res.json(devices);
  } catch (error) {
    console.error("[QOCAAIoT] Devices error:", error);
    res.status(500).json({ error: "Failed to load devices" });
  }
});

router.get("/devices/:deviceId", async (req: Request, res: Response) => {
  try {
    const device = await qocaAIoTService.getDevice(req.params.deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to load device" });
  }
});

router.post("/devices", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const device = await qocaAIoTService.registerDevice({
      ...req.body,
      patientId,
    });
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.patch("/devices/:deviceId/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const device = await qocaAIoTService.updateDeviceStatus(req.params.deviceId, status);
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to update device status" });
  }
});

router.get("/readings", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const deviceType = req.query.deviceType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const readings = await qocaAIoTService.getReadingsByPatient(patientId, deviceType as any, limit);
    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to load readings" });
  }
});

router.get("/readings/:deviceId", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 24;
    const readings = await qocaAIoTService.getReadings(req.params.deviceId, limit);
    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to load readings" });
  }
});

router.post("/readings", async (req: Request, res: Response) => {
  try {
    const reading = await qocaAIoTService.addReading(req.body);
    res.status(201).json(reading);
  } catch (error) {
    res.status(500).json({ error: "Failed to add reading" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const acknowledged = req.query.acknowledged === "true" ? true : req.query.acknowledged === "false" ? false : undefined;
    const alerts = await qocaAIoTService.getAlerts(patientId, acknowledged);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

router.post("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const acknowledgedBy = req.body.acknowledgedBy || "User";
    const alert = await qocaAIoTService.acknowledgeAlert(req.params.alertId, acknowledgedBy);
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.get("/care-events", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const events = await qocaAIoTService.getCareEvents(patientId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to load care events" });
  }
});

router.get("/ai-insight", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "sample-patient";
    const locale = (req.query.locale as string) || "en";
    const insight = await qocaAIoTService.getAIHealthInsight(patientId, locale);
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate AI insight" });
  }
});

router.get("/supported-locales", (_req: Request, res: Response) => {
  res.json(qocaAIoTService.getSupportedLocales());
});

router.get("/device-models", (_req: Request, res: Response) => {
  res.json(qocaAIoTService.getDeviceModels());
});

export default router;
