import { Router, Request, Response } from "express";
import { realTimeMonitoringService, AlertStatus, AlertCategory } from "./services/real-time-monitoring";
import { z } from "zod";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][MONITORING] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "System monitoring audit. NOT clinical data."
  })}`);
}

router.get("/dashboard", (req: Request, res: Response) => {
  logHIPAAAudit("GET_MONITORING_DASHBOARD", {}, req);

  try {
    const dashboard = realTimeMonitoringService.getDashboard();
    res.json({
      ...dashboard,
      noCdsCompliance: "Real-time monitoring dashboard. NOT clinical decision support."
    });
  } catch (error) {
    console.error("Error getting monitoring dashboard:", error);
    res.status(500).json({ error: "Failed to get monitoring dashboard" });
  }
});

router.get("/alerts", (req: Request, res: Response) => {
  const { status, category } = req.query;
  logHIPAAAudit("GET_ALERTS", { status, category }, req);

  try {
    const alerts = realTimeMonitoringService.getAlerts(
      status as AlertStatus | undefined,
      category as AlertCategory | undefined
    );
    res.json({
      alerts,
      count: alerts.length,
      noCdsCompliance: "Alert data for operational monitoring."
    });
  } catch (error) {
    console.error("Error getting alerts:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

const AcknowledgeAlertSchema = z.object({
  userId: z.string().optional().default("anonymous")
});

router.post("/alerts/:alertId/acknowledge", (req: Request, res: Response) => {
  const { alertId } = req.params;
  logHIPAAAudit("ACKNOWLEDGE_ALERT", { alertId }, req);

  try {
    const validation = AcknowledgeAlertSchema.safeParse(req.body);
    const userId = validation.success ? validation.data.userId : "anonymous";
    
    const success = realTimeMonitoringService.acknowledgeAlert(alertId, userId);
    
    if (!success) {
      return res.status(404).json({ error: "Alert not found or already processed" });
    }

    res.json({ success: true, message: "Alert acknowledged" });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/alerts/:alertId/resolve", (req: Request, res: Response) => {
  const { alertId } = req.params;
  logHIPAAAudit("RESOLVE_ALERT", { alertId }, req);

  try {
    const success = realTimeMonitoringService.resolveAlert(alertId);
    
    if (!success) {
      return res.status(404).json({ error: "Alert not found or already resolved" });
    }

    res.json({ success: true, message: "Alert resolved" });
  } catch (error) {
    console.error("Error resolving alert:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

router.post("/alerts/:alertId/escalate", (req: Request, res: Response) => {
  const { alertId } = req.params;
  logHIPAAAudit("ESCALATE_ALERT", { alertId }, req);

  try {
    const success = realTimeMonitoringService.escalateAlert(alertId);
    
    if (!success) {
      return res.status(404).json({ error: "Alert not found or cannot be escalated" });
    }

    res.json({ success: true, message: "Alert escalated" });
  } catch (error) {
    console.error("Error escalating alert:", error);
    res.status(500).json({ error: "Failed to escalate alert" });
  }
});

const CreatePatientAlertSchema = z.object({
  patientId: z.string(),
  riskScore: z.number().min(0).max(100),
  reason: z.string()
});

router.post("/alerts/patient-risk", (req: Request, res: Response) => {
  logHIPAAAudit("CREATE_PATIENT_RISK_ALERT", req.body, req);

  try {
    const validation = CreatePatientAlertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const { patientId, riskScore, reason } = validation.data;
    const alert = realTimeMonitoringService.createPatientRiskAlert(patientId, riskScore, reason);

    res.json({
      alert,
      noCdsCompliance: "Patient risk alert for care coordination. NOT clinical advice."
    });
  } catch (error) {
    console.error("Error creating patient risk alert:", error);
    res.status(500).json({ error: "Failed to create patient risk alert" });
  }
});

router.get("/jobs", (req: Request, res: Response) => {
  const { status } = req.query;
  logHIPAAAudit("GET_JOBS", { status }, req);

  try {
    const jobs = realTimeMonitoringService.getJobs(status as any);
    res.json({
      jobs,
      count: jobs.length,
      noCdsCompliance: "Automation job data for operational monitoring."
    });
  } catch (error) {
    console.error("Error getting jobs:", error);
    res.status(500).json({ error: "Failed to get jobs" });
  }
});

router.get("/vulnerabilities", (req: Request, res: Response) => {
  const { status } = req.query;
  logHIPAAAudit("GET_VULNERABILITIES", { status }, req);

  try {
    const vulnerabilities = realTimeMonitoringService.getVulnerabilities(status as any);
    res.json({
      vulnerabilities,
      count: vulnerabilities.length,
      noCdsCompliance: "Security vulnerability data for compliance monitoring."
    });
  } catch (error) {
    console.error("Error getting vulnerabilities:", error);
    res.status(500).json({ error: "Failed to get vulnerabilities" });
  }
});

const UpdateVulnSchema = z.object({
  status: z.enum(["open", "in_progress", "mitigated", "resolved", "accepted_risk"]),
  progress: z.number().min(0).max(100).optional()
});

router.patch("/vulnerabilities/:vulnId", (req: Request, res: Response) => {
  const { vulnId } = req.params;
  logHIPAAAudit("UPDATE_VULNERABILITY", { vulnId, ...req.body }, req);

  try {
    const validation = UpdateVulnSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const success = realTimeMonitoringService.updateVulnerabilityStatus(
      vulnId,
      validation.data.status,
      validation.data.progress
    );
    
    if (!success) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    res.json({ success: true, message: "Vulnerability updated" });
  } catch (error) {
    console.error("Error updating vulnerability:", error);
    res.status(500).json({ error: "Failed to update vulnerability" });
  }
});

router.get("/metrics/history", (req: Request, res: Response) => {
  logHIPAAAudit("GET_METRICS_HISTORY", {}, req);

  try {
    const history = realTimeMonitoringService.getMetricsHistory();
    res.json({
      metrics: history,
      count: history.length,
      noCdsCompliance: "Performance metrics for system monitoring."
    });
  } catch (error) {
    console.error("Error getting metrics history:", error);
    res.status(500).json({ error: "Failed to get metrics history" });
  }
});

export default router;
