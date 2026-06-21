import { Router, type Request, type Response } from "express";
import { networkHealthService } from "./services/network-health-service";
import { extractUserContext, requireRole, type AuthorizedRequest } from "./middleware/rbac-authorization";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();
router.use(extractUserContext);

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = networkHealthService.getSummary();
    res.json(summary);
  } catch (error) {
    console.error("[NetworkHealth] Summary error:", error);
    res.status(500).json({ error: "Failed to get network health summary" });
  }
});

router.get("/endpoints", async (_req: Request, res: Response) => {
  try {
    const records = networkHealthService.getAllRecords();
    res.json(records);
  } catch (error) {
    console.error("[NetworkHealth] Endpoints error:", error);
    res.status(500).json({ error: "Failed to get endpoint records" });
  }
});

router.get("/endpoints/:partnerId", async (req: Request, res: Response) => {
  try {
    const records = networkHealthService.getPartnerRecords(req.params.partnerId);
    if (records.length === 0) {
      return res.status(404).json({ error: "Partner not found" });
    }
    res.json(records);
  } catch (error) {
    console.error("[NetworkHealth] Partner endpoints error:", error);
    res.status(500).json({ error: "Failed to get partner endpoint records" });
  }
});

router.get("/uptime", async (_req: Request, res: Response) => {
  try {
    const uptime = networkHealthService.getUptimeByPartner();
    res.json(uptime);
  } catch (error) {
    console.error("[NetworkHealth] Uptime error:", error);
    res.status(500).json({ error: "Failed to get uptime data" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const history = networkHealthService.getHistory({
      partnerId: req.query.partnerId as string,
      endpointType: req.query.endpointType as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 200,
    });
    res.json(history);
  } catch (error) {
    console.error("[NetworkHealth] History error:", error);
    res.status(500).json({ error: "Failed to get health history" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const alerts = networkHealthService.getAlerts({
      severity: req.query.severity as string,
      acknowledged: req.query.acknowledged ? req.query.acknowledged === "true" : undefined,
      partnerId: req.query.partnerId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.json(alerts);
  } catch (error) {
    console.error("[NetworkHealth] Alerts error:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

router.post("/alerts/:alertId/acknowledge", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const alert = networkHealthService.acknowledgeAlert(req.params.alertId, req.userId || "anonymous");
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    logPhiAccess({
      action: "update",
      userId: req.userId || "anonymous",
      resourceType: "NetworkHealthAlert",
      details: `ALERT_ACKNOWLEDGED id=${req.params.alertId}`,
    });

    res.json(alert);
  } catch (error) {
    console.error("[NetworkHealth] Acknowledge error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/alerts/acknowledge-all", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const count = networkHealthService.acknowledgeAllAlerts(req.userId || "anonymous");

    logPhiAccess({
      action: "update",
      userId: req.userId || "anonymous",
      resourceType: "NetworkHealthAlert",
      details: `ALL_ALERTS_ACKNOWLEDGED count=${count}`,
    });

    res.json({ acknowledged: count });
  } catch (error) {
    console.error("[NetworkHealth] Acknowledge all error:", error);
    res.status(500).json({ error: "Failed to acknowledge all alerts" });
  }
});

router.post("/scan", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    logPhiAccess({
      action: "execute",
      userId: req.userId || "anonymous",
      resourceType: "NetworkHealthScan",
      details: "MANUAL_NETWORK_SCAN_TRIGGERED",
    });

    await networkHealthService.runFullScan();
    const summary = networkHealthService.getSummary();
    res.json({ message: "Scan complete", summary });
  } catch (error) {
    console.error("[NetworkHealth] Manual scan error:", error);
    res.status(500).json({ error: "Failed to run manual scan" });
  }
});

export default router;
