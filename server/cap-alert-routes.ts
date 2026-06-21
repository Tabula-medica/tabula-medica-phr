import { Router, Request, Response } from "express";
import * as CAPAlertService from "./services/cap-alert-service";

const router = Router();

router.get("/alerts", (req: Request, res: Response) => {
  try {
    const { categories, severities, acknowledged, scope } = req.query;
    
    const filters: Parameters<typeof CAPAlertService.getActiveAlerts>[0] = {};
    
    if (categories) {
      filters.categories = (categories as string).split(",") as CAPAlertService.CAPCategory[];
    }
    
    if (severities) {
      filters.severities = (severities as string).split(",") as CAPAlertService.CAPSeverity[];
    }
    
    if (acknowledged !== undefined) {
      filters.acknowledged = acknowledged === "true";
    }
    
    if (scope) {
      filters.scope = scope as CAPAlertService.CAPScope;
    }

    const alerts = CAPAlertService.getActiveAlerts(filters);
    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/alerts/health", (_req: Request, res: Response) => {
  try {
    const alerts = CAPAlertService.getHealthRelatedAlerts();
    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching health alerts:", error);
    res.status(500).json({ error: "Failed to fetch health alerts" });
  }
});

router.get("/alerts/emergency", (_req: Request, res: Response) => {
  try {
    const alerts = CAPAlertService.getEmergencyAlerts();
    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching emergency alerts:", error);
    res.status(500).json({ error: "Failed to fetch emergency alerts" });
  }
});

router.get("/alerts/statistics", (_req: Request, res: Response) => {
  try {
    const statistics = CAPAlertService.getAlertStatistics();
    res.json(statistics);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/alerts/:alertId", (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = CAPAlertService.getAlertById(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    res.json(alert);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching alert:", error);
    res.status(500).json({ error: "Failed to fetch alert" });
  }
});

router.post("/alerts/:alertId/acknowledge", (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { userId, userName, notes } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ error: "userId and userName are required" });
    }
    
    const alert = CAPAlertService.acknowledgeAlert(alertId, userId, userName, notes);
    
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    res.json(alert);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error acknowledging alert:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/alerts/:alertId/action", (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { type, userId, userName, notes } = req.body;
    
    if (!type || !userId) {
      return res.status(400).json({ error: "type and userId are required" });
    }
    
    const alert = CAPAlertService.addAlertAction(alertId, {
      type,
      userId,
      userName,
      notes,
    });
    
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    res.json(alert);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error adding action:", error);
    res.status(500).json({ error: "Failed to add action" });
  }
});

router.post("/alerts/parse", (req: Request, res: Response) => {
  try {
    const { xml } = req.body;
    
    if (!xml) {
      return res.status(400).json({ error: "CAP XML content is required" });
    }
    
    const alert = CAPAlertService.parseCapXml(xml);
    
    if (!alert) {
      return res.status(400).json({ error: "Failed to parse CAP XML" });
    }
    
    res.json(alert);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error parsing CAP XML:", error);
    res.status(500).json({ error: "Failed to parse CAP XML" });
  }
});

router.get("/alerts/:alertId/fhir", (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = CAPAlertService.getAlertById(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    const fhirResource = CAPAlertService.convertToFhirCommunication(alert);
    
    if (!fhirResource) {
      return res.status(500).json({ error: "Failed to convert to FHIR" });
    }
    
    res.json(fhirResource);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error converting to FHIR:", error);
    res.status(500).json({ error: "Failed to convert to FHIR" });
  }
});

router.get("/feeds", (_req: Request, res: Response) => {
  try {
    const feeds = CAPAlertService.getAlertFeeds();
    res.json({ feeds });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching feeds:", error);
    res.status(500).json({ error: "Failed to fetch feeds" });
  }
});

router.get("/subscriptions", (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || "default-user";
    const subscriptions = CAPAlertService.getUserSubscriptions(userId);
    res.json({ subscriptions });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error fetching subscriptions:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.post("/subscriptions", (req: Request, res: Response) => {
  try {
    const { userId, name, categories, severities, areas, notificationMethods, active } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ error: "userId and name are required" });
    }
    
    const subscription = CAPAlertService.createSubscription(userId, {
      name,
      active: active ?? true,
      categories: categories || [],
      severities: severities || [],
      areas: areas || [],
      notificationMethods: notificationMethods || ["in_app"],
    });
    
    res.json(subscription);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error creating subscription:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

router.patch("/subscriptions/:subscriptionId", (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.body.userId as string || "default-user";
    
    const subscription = CAPAlertService.updateSubscription(subscriptionId, userId, req.body);
    
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    
    res.json(subscription);
  } catch (error) {
    console.error("[CAPAlertRoutes] Error updating subscription:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

router.delete("/subscriptions/:subscriptionId", (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.query.userId as string || "default-user";
    
    const deleted = CAPAlertService.deleteSubscription(subscriptionId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[CAPAlertRoutes] Error deleting subscription:", error);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

console.log("[CAPAlertRoutes] Routes module loaded");
console.log("[CAPAlertRoutes] Endpoints: /alerts, /alerts/health, /alerts/emergency, /feeds, /subscriptions");

export default router;
