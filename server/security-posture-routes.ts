import { Router, Request, Response } from "express";
import { securityPostureEngine, CloudProvider, FindingSeverity, FindingStatus, ComplianceFramework, DataClassification } from "./services/security-posture-engine";
import { getAuditLogger } from "./services/integrations/factory";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);
router.use(isAuthenticated);
router.use(requireRole("admin"));

async function logSecurityAudit(action: string, details: Record<string, unknown>, userId: string = "system") {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.logAuditEvent({
      timestamp: new Date().toISOString(),
      action: action,
      resourceType: "SecurityPosture",
      resourceId: details.resourceId as string || "system",
      userId: userId,
      outcome: "success",
      details: details,
    });
  } catch (error) {
    console.error("[SecurityPosture] Audit logging error:", error);
  }
}

router.get("/posture", async (_req: Request, res: Response) => {
  try {
    const posture = await securityPostureEngine.getSecurityPosture();

    await logSecurityAudit("SECURITY_POSTURE_VIEWED", { 
      resourceId: "dashboard",
      score: posture.overallScore,
      environments: posture.environments.length,
    });

    res.json({
      success: true,
      data: posture,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error getting posture:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get security posture",
    });
  }
});

router.get("/findings", async (req: Request, res: Response) => {
  try {
    const { provider, severity, status, framework, dataType } = req.query;

    const findings = await securityPostureEngine.getFindings({
      provider: provider as CloudProvider,
      severity: severity as FindingSeverity,
      status: status as FindingStatus,
      framework: framework as ComplianceFramework,
      dataType: dataType as DataClassification,
    });

    res.json({
      success: true,
      data: findings,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error getting findings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get findings",
    });
  }
});

router.patch("/findings/:findingId", async (req: Request, res: Response) => {
  try {
    const { findingId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Missing status",
      });
    }

    const finding = await securityPostureEngine.updateFindingStatus(findingId, status, notes);

    await logSecurityAudit("FINDING_STATUS_UPDATED", { 
      resourceId: findingId, 
      newStatus: status,
      notes: notes,
    });

    res.json({
      success: true,
      data: finding,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error updating finding:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update finding",
    });
  }
});

router.post("/findings/:findingId/remediate", async (req: Request, res: Response) => {
  try {
    const { findingId } = req.params;
    const userId = getUserId(req);

    const result = await securityPostureEngine.applyRemediation(findingId, userId);

    if (result.success) {
      await logSecurityAudit("REMEDIATION_APPLIED", {
        resourceId: findingId,
        userId: userId,
        message: result.message,
        automated: true,
      }, userId);
    }

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error applying remediation:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply remediation",
    });
  }
});

router.post("/analyze", async (_req: Request, res: Response) => {
  try {
    const analysis = await securityPostureEngine.analyzeRisks();

    await logSecurityAudit("RISK_ANALYSIS_RUN", {
      resourceId: "risk-analysis",
      findingsAnalyzed: analysis.prioritizedFindings.length,
      recommendations: analysis.recommendations.length,
      estimatedRiskReduction: analysis.estimatedRiskReduction,
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error analyzing risks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze risks",
    });
  }
});

router.get("/alerts", async (_req: Request, res: Response) => {
  try {
    const alerts = await securityPostureEngine.getAlerts();

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error getting alerts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get alerts",
    });
  }
});

router.patch("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = await securityPostureEngine.acknowledgeAlert(alertId);

    await logSecurityAudit("ALERT_ACKNOWLEDGED", {
      resourceId: alertId,
      alertType: alert.type,
      severity: alert.severity,
    });

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error acknowledging alert:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to acknowledge alert",
    });
  }
});

router.get("/environments", async (_req: Request, res: Response) => {
  try {
    const environments = await securityPostureEngine.getEnvironments();

    res.json({
      success: true,
      data: environments,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error getting environments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get environments",
    });
  }
});

router.post("/environments/:environmentId/sync", async (req: Request, res: Response) => {
  try {
    const { environmentId } = req.params;
    const result = await securityPostureEngine.syncEnvironment(environmentId);

    await logSecurityAudit("ENVIRONMENT_SYNCED", {
      resourceId: environmentId,
      newFindings: result.newFindings,
      syncSuccess: result.success,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error syncing environment:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync environment",
    });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = securityPostureEngine.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[SecurityPosture] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
    });
  }
});

export default router;
