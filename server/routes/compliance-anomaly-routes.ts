import { Router, Request, Response } from "express";
import { 
  complianceAnomalyService, 
  AlertSeverity, 
  AlertCategory, 
  AlertStatus 
} from "../services/compliance-anomaly-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "Compliance Anomaly Detection",
    version: "1.0.0",
    features: [
      "Merge/rejection rate monitoring",
      "PHI access pattern detection",
      "Access review tracking",
      "Audit log anomaly detection"
    ],
    compliance: ["HIPAA", "SOC2", "HITRUST"],
    categories: ["merge_rejection", "phi_access", "access_review", "audit_anomaly"],
    severities: ["critical", "high", "medium", "low", "info"]
  });
});

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const statistics = complianceAnomalyService.getStatistics();
    const activeAlerts = complianceAnomalyService.getAlerts({ 
      status: ["active", "acknowledged"] 
    });
    const thresholds = complianceAnomalyService.getThresholds();
    const accessReviews = complianceAnomalyService.getAccessReviews(["overdue", "critical"]);
    const mergeMetrics = complianceAnomalyService.getMergeRejectionMetrics();
    const phiPatterns = complianceAnomalyService.getPHIAccessPatterns();

    res.json({
      statistics,
      recentAlerts: activeAlerts.slice(0, 10),
      thresholds: thresholds.filter(t => t.enabled),
      overdueAccessReviews: accessReviews,
      mergeRejectionMetrics: mergeMetrics,
      topPHIAccessPatterns: phiPatterns.filter(p => p.riskScore > 30)
    });
  } catch (error) {
    console.error("[ComplianceAnomaly] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

router.get("/alerts", (req: Request, res: Response) => {
  try {
    const { status, severity, category, startDate, endDate } = req.query;
    
    const filters: {
      status?: AlertStatus[];
      severity?: AlertSeverity[];
      category?: AlertCategory[];
      startDate?: string;
      endDate?: string;
    } = {};

    if (status) {
      filters.status = (status as string).split(",") as AlertStatus[];
    }
    if (severity) {
      filters.severity = (severity as string).split(",") as AlertSeverity[];
    }
    if (category) {
      filters.category = (category as string).split(",") as AlertCategory[];
    }
    if (startDate) {
      filters.startDate = startDate as string;
    }
    if (endDate) {
      filters.endDate = endDate as string;
    }

    const alerts = complianceAnomalyService.getAlerts(filters);
    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[ComplianceAnomaly] Get alerts error:", error);
    res.status(500).json({ error: "Failed to retrieve alerts" });
  }
});

router.get("/alerts/:id", (req: Request, res: Response) => {
  try {
    const alert = complianceAnomalyService.getAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    console.error("[ComplianceAnomaly] Get alert error:", error);
    res.status(500).json({ error: "Failed to retrieve alert" });
  }
});

router.post("/alerts/:id/acknowledge", (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || "system";
    const alert = complianceAnomalyService.acknowledgeAlert(req.params.id, userId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found or already acknowledged" });
    }
    console.log(`[HIPAA-AUDIT][ComplianceAnomaly] Alert ${req.params.id} acknowledged by ${userId}`);
    res.json(alert);
  } catch (error) {
    console.error("[ComplianceAnomaly] Acknowledge error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/alerts/:id/resolve", (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || "system";
    const alert = complianceAnomalyService.resolveAlert(req.params.id, userId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found or already resolved" });
    }
    console.log(`[HIPAA-AUDIT][ComplianceAnomaly] Alert ${req.params.id} resolved by ${userId}`);
    res.json(alert);
  } catch (error) {
    console.error("[ComplianceAnomaly] Resolve error:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

router.post("/alerts/:id/dismiss", (req: Request, res: Response) => {
  try {
    const alert = complianceAnomalyService.dismissAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    console.log(`[HIPAA-AUDIT][ComplianceAnomaly] Alert ${req.params.id} dismissed`);
    res.json(alert);
  } catch (error) {
    console.error("[ComplianceAnomaly] Dismiss error:", error);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

router.get("/thresholds", (_req: Request, res: Response) => {
  try {
    const thresholds = complianceAnomalyService.getThresholds();
    res.json({ thresholds });
  } catch (error) {
    console.error("[ComplianceAnomaly] Get thresholds error:", error);
    res.status(500).json({ error: "Failed to retrieve thresholds" });
  }
});

router.get("/thresholds/:id", (req: Request, res: Response) => {
  try {
    const threshold = complianceAnomalyService.getThresholdById(req.params.id);
    if (!threshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }
    res.json(threshold);
  } catch (error) {
    console.error("[ComplianceAnomaly] Get threshold error:", error);
    res.status(500).json({ error: "Failed to retrieve threshold" });
  }
});

router.patch("/thresholds/:id", (req: Request, res: Response) => {
  try {
    const threshold = complianceAnomalyService.updateThreshold(req.params.id, req.body);
    if (!threshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }
    console.log(`[HIPAA-AUDIT][ComplianceAnomaly] Threshold ${req.params.id} updated`);
    res.json(threshold);
  } catch (error) {
    console.error("[ComplianceAnomaly] Update threshold error:", error);
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

router.get("/statistics", (_req: Request, res: Response) => {
  try {
    const statistics = complianceAnomalyService.getStatistics();
    res.json(statistics);
  } catch (error) {
    console.error("[ComplianceAnomaly] Get statistics error:", error);
    res.status(500).json({ error: "Failed to retrieve statistics" });
  }
});

router.get("/access-reviews", (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const statusFilter = status 
      ? (status as string).split(",") as Array<"current" | "due_soon" | "overdue" | "critical">
      : undefined;
    const reviews = complianceAnomalyService.getAccessReviews(statusFilter);
    res.json({ reviews, total: reviews.length });
  } catch (error) {
    console.error("[ComplianceAnomaly] Get access reviews error:", error);
    res.status(500).json({ error: "Failed to retrieve access reviews" });
  }
});

router.get("/merge-metrics", (_req: Request, res: Response) => {
  try {
    const metrics = complianceAnomalyService.getMergeRejectionMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[ComplianceAnomaly] Get merge metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve merge metrics" });
  }
});

router.get("/phi-patterns", (_req: Request, res: Response) => {
  try {
    const patterns = complianceAnomalyService.getPHIAccessPatterns();
    res.json({ patterns });
  } catch (error) {
    console.error("[ComplianceAnomaly] Get PHI patterns error:", error);
    res.status(500).json({ error: "Failed to retrieve PHI patterns" });
  }
});

router.post("/scan", (_req: Request, res: Response) => {
  try {
    const result = complianceAnomalyService.runAnomalyDetection();
    console.log(`[HIPAA-AUDIT][ComplianceAnomaly] Anomaly detection scan completed`);
    res.json(result);
  } catch (error) {
    console.error("[ComplianceAnomaly] Scan error:", error);
    res.status(500).json({ error: "Failed to run anomaly detection" });
  }
});

export function registerComplianceAnomalyRoutes(app: any): void {
  app.use("/api/compliance-anomaly", router);
  console.log("[Routes] Compliance Anomaly Detection routes registered at /api/compliance-anomaly/*");
}
