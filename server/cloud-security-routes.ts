import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { securityPostureService, RiskLevel, RemediationStatus, ThreatCategory, ControlState } from "./services/ai-security-posture";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

const router = Router();

router.use(isAuthenticated);
router.use(requireRole("admin"));

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Cloud security posture audit log. Operations are for infrastructure security only, not clinical decision-making."
  };
  console.log("[HIPAA-AUDIT][CLOUD-SECURITY]", JSON.stringify(auditEntry));
}

const FindingsFilterSchema = z.object({
  riskLevel: z.enum(["critical", "high", "medium", "low", "informational"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "failed", "skipped"]).optional(),
  autoRemediable: z.preprocess(val => val === "true", z.boolean()).optional()
});

const ThreatsFilterSchema = z.object({
  category: z.enum(["zero_day", "known_vulnerability", "configuration_drift", "access_anomaly", "data_exfiltration", "malware", "insider_threat"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "informational"]).optional(),
  isZeroDay: z.preprocess(val => val === "true", z.boolean()).optional()
});

const ControlStateSchema = z.object({
  state: z.enum(["active", "learning", "standby", "disabled"])
});

const TriggerResponseSchema = z.object({
  responseId: z.string()
});

router.get("/stats", (req: Request, res: Response) => {
  logHIPAAAudit("GET_CLOUD_SECURITY_STATS", {}, req);

  try {
    const stats = securityPostureService.getStats();
    res.json({
      stats,
      noCdsCompliance: "Cloud security statistics for governance monitoring. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting cloud security stats:", error);
    res.status(500).json({ error: "Failed to get cloud security statistics" });
  }
});

router.get("/score", (req: Request, res: Response) => {
  logHIPAAAudit("GET_POSTURE_SCORE", {}, req);

  try {
    const score = securityPostureService.getPostureScore();
    res.json({
      score,
      noCdsCompliance: score.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting posture score:", error);
    res.status(500).json({ error: "Failed to get posture score" });
  }
});

router.post("/score", async (req: Request, res: Response) => {
  logHIPAAAudit("CALCULATE_POSTURE_SCORE", {}, req);

  try {
    const score = await securityPostureService.calculatePostureScore();
    res.json({
      score,
      noCdsCompliance: score.noCdsCompliance
    });
  } catch (error) {
    console.error("Error calculating posture score:", error);
    res.status(500).json({ error: "Failed to calculate posture score" });
  }
});

router.get("/findings", (req: Request, res: Response) => {
  try {
    const validation = FindingsFilterSchema.safeParse(req.query);
    if (!validation.success) {
      logHIPAAAudit("GET_SECURITY_FINDINGS_VALIDATION_FAILED", { errors: validation.error.errors }, req);
      return res.status(400).json({ error: "Invalid filter parameters", details: validation.error.errors });
    }

    logHIPAAAudit("GET_SECURITY_FINDINGS", { filters: validation.data }, req);

    const findings = securityPostureService.getFindings(validation.data as any);
    res.json({
      findings,
      count: findings.length,
      noCdsCompliance: "Security findings for infrastructure protection. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting findings:", error);
    res.status(500).json({ error: "Failed to get findings" });
  }
});

router.get("/findings/:findingId", (req: Request, res: Response) => {
  const { findingId } = req.params;
  logHIPAAAudit("GET_FINDING", { findingId }, req);

  try {
    const finding = securityPostureService.getFinding(findingId);
    if (!finding) {
      return res.status(404).json({ error: "Finding not found" });
    }
    res.json({
      finding,
      noCdsCompliance: finding.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting finding:", error);
    res.status(500).json({ error: "Failed to get finding" });
  }
});

router.post("/findings/:findingId/remediate", async (req: Request, res: Response) => {
  const { findingId } = req.params;
  logHIPAAAudit("AUTO_REMEDIATE_FINDING", { findingId }, req);

  try {
    const remediation = await securityPostureService.autoRemediateFinding(findingId);
    if (!remediation) {
      return res.status(400).json({ error: "Finding not found or not auto-remediable" });
    }
    res.json({
      remediation,
      noCdsCompliance: remediation.noCdsCompliance
    });
  } catch (error) {
    console.error("Error remediating finding:", error);
    res.status(500).json({ error: "Failed to remediate finding" });
  }
});

router.get("/remediations", (req: Request, res: Response) => {
  logHIPAAAudit("GET_REMEDIATIONS", {}, req);

  try {
    const remediations = securityPostureService.getRemediations();
    res.json({
      remediations,
      count: remediations.length,
      noCdsCompliance: "Remediation actions for security governance. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting remediations:", error);
    res.status(500).json({ error: "Failed to get remediations" });
  }
});

router.get("/threats", (req: Request, res: Response) => {
  try {
    const validation = ThreatsFilterSchema.safeParse(req.query);
    if (!validation.success) {
      logHIPAAAudit("GET_THREAT_INTELLIGENCE_VALIDATION_FAILED", { errors: validation.error.errors }, req);
      return res.status(400).json({ error: "Invalid filter parameters", details: validation.error.errors });
    }

    logHIPAAAudit("GET_THREAT_INTELLIGENCE", { filters: validation.data }, req);

    const threats = securityPostureService.getThreats(validation.data as any);
    res.json({
      threats,
      count: threats.length,
      zeroDayCount: threats.filter(t => t.isZeroDay).length,
      noCdsCompliance: "Threat intelligence for infrastructure security. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting threats:", error);
    res.status(500).json({ error: "Failed to get threats" });
  }
});

router.get("/threats/:threatId", (req: Request, res: Response) => {
  const { threatId } = req.params;
  logHIPAAAudit("GET_THREAT", { threatId }, req);

  try {
    const threat = securityPostureService.getThreat(threatId);
    if (!threat) {
      return res.status(404).json({ error: "Threat not found" });
    }
    res.json({
      threat,
      noCdsCompliance: threat.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting threat:", error);
    res.status(500).json({ error: "Failed to get threat" });
  }
});

router.post("/threats/predict", async (req: Request, res: Response) => {
  logHIPAAAudit("GENERATE_THREAT_PREDICTION", {}, req);

  try {
    const threat = await securityPostureService.generateThreatPrediction();
    res.json({
      threat,
      noCdsCompliance: threat.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating threat prediction:", error);
    res.status(500).json({ error: "Failed to generate threat prediction" });
  }
});

router.get("/controls", (req: Request, res: Response) => {
  logHIPAAAudit("GET_SELF_HEALING_CONTROLS", {}, req);

  try {
    const controls = securityPostureService.getControls();
    res.json({
      controls,
      count: controls.length,
      activeCount: controls.filter(c => c.currentState === "active").length,
      noCdsCompliance: "Self-healing controls for infrastructure security. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting controls:", error);
    res.status(500).json({ error: "Failed to get controls" });
  }
});

router.get("/controls/:controlId", (req: Request, res: Response) => {
  const { controlId } = req.params;
  logHIPAAAudit("GET_CONTROL", { controlId }, req);

  try {
    const control = securityPostureService.getControl(controlId);
    if (!control) {
      return res.status(404).json({ error: "Control not found" });
    }
    res.json({
      control,
      noCdsCompliance: control.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting control:", error);
    res.status(500).json({ error: "Failed to get control" });
  }
});

router.patch("/controls/:controlId/state", async (req: Request, res: Response) => {
  const { controlId } = req.params;

  try {
    const validation = ControlStateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("UPDATE_CONTROL_STATE", { controlId, newState: validation.data.state }, req);

    const control = await securityPostureService.updateControlState(controlId, validation.data.state);
    if (!control) {
      return res.status(404).json({ error: "Control not found" });
    }

    res.json({
      control,
      noCdsCompliance: control.noCdsCompliance
    });
  } catch (error) {
    console.error("Error updating control state:", error);
    res.status(500).json({ error: "Failed to update control state" });
  }
});

router.post("/controls/:controlId/trigger", async (req: Request, res: Response) => {
  const { controlId } = req.params;

  try {
    const validation = TriggerResponseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("TRIGGER_ADAPTIVE_RESPONSE", { controlId, responseId: validation.data.responseId }, req);

    const result = await securityPostureService.triggerAdaptiveResponse(controlId, validation.data.responseId);

    res.json({
      ...result,
      noCdsCompliance: "Adaptive response trigger for security automation. Not clinical action."
    });
  } catch (error) {
    console.error("Error triggering adaptive response:", error);
    res.status(500).json({ error: "Failed to trigger adaptive response" });
  }
});

router.post("/reports/remediation", async (req: Request, res: Response) => {
  logHIPAAAudit("GENERATE_REMEDIATION_REPORT", {}, req);

  try {
    const report = await securityPostureService.generateRemediationReport();
    res.json({
      report,
      noCdsCompliance: report.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating remediation report:", error);
    res.status(500).json({ error: "Failed to generate remediation report" });
  }
});

router.get("/unified-view", (req: Request, res: Response) => {
  logHIPAAAudit("GET_UNIFIED_SECURITY_VIEW", {}, req);

  try {
    const view = securityPostureService.getUnifiedSecurityView();
    res.json({
      view,
      noCdsCompliance: view.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting unified view:", error);
    res.status(500).json({ error: "Failed to get unified security view" });
  }
});

router.get("/approvals", (req: Request, res: Response) => {
  logHIPAAAudit("GET_PENDING_APPROVALS", {}, req);

  try {
    const approvals = securityPostureService.getPendingApprovals({ status: "pending" });
    res.json({
      approvals,
      count: approvals.length,
      noCdsCompliance: "Pending approvals for security governance. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting approvals:", error);
    res.status(500).json({ error: "Failed to get pending approvals" });
  }
});

router.get("/approvals/:approvalId", (req: Request, res: Response) => {
  const { approvalId } = req.params;
  logHIPAAAudit("GET_APPROVAL", { approvalId }, req);

  try {
    const approval = securityPostureService.getApproval(approvalId);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    res.json({
      approval,
      noCdsCompliance: approval.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting approval:", error);
    res.status(500).json({ error: "Failed to get approval" });
  }
});

router.post("/approvals/:approvalId/approve", async (req: Request, res: Response) => {
  const { approvalId } = req.params;
  logHIPAAAudit("APPROVE_SECURITY_ACTION", { approvalId }, req);

  try {
    const approval = await securityPostureService.approveAction(approvalId, "admin");
    if (!approval) {
      return res.status(400).json({ error: "Approval not found or already processed" });
    }
    res.json({
      approval,
      message: "Security action approved and will be executed",
      noCdsCompliance: approval.noCdsCompliance
    });
  } catch (error) {
    console.error("Error approving action:", error);
    res.status(500).json({ error: "Failed to approve action" });
  }
});

router.post("/approvals/:approvalId/reject", async (req: Request, res: Response) => {
  const { approvalId } = req.params;
  logHIPAAAudit("REJECT_SECURITY_ACTION", { approvalId }, req);

  try {
    const approval = await securityPostureService.rejectAction(approvalId, "admin");
    if (!approval) {
      return res.status(400).json({ error: "Approval not found or already processed" });
    }
    res.json({
      approval,
      message: "Security action rejected",
      noCdsCompliance: approval.noCdsCompliance
    });
  } catch (error) {
    console.error("Error rejecting action:", error);
    res.status(500).json({ error: "Failed to reject action" });
  }
});

router.get("/insights", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ACTIONABLE_INSIGHTS", {}, req);

  try {
    const insights = securityPostureService.generateActionableInsights();
    res.json({
      insights,
      count: insights.length,
      noCdsCompliance: "Actionable insights for security operations. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting insights:", error);
    res.status(500).json({ error: "Failed to get actionable insights" });
  }
});

export default router;
