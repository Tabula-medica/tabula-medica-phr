import { Router, Request, Response } from "express";
import { getComplianceStatus } from "../security";
import {
  queryAuditLogs,
  getAuditReport,
  verifyAuditIntegrity,
  exportAuditLogs,
} from "../security/enhanced-audit-service";
import {
  getSOC2Controls,
  getControlsDueForReview,
  getAccessReviews,
  getChangeRecords,
  getIncidents,
  getVendorAssessments,
  getComplianceDashboard,
  generateComplianceReport,
  recordAccessReview,
  recordChange,
  recordIncident,
} from "../security/soc2-compliance-service";
import {
  getTenant,
  listTenants,
  createTenant,
  updateTenant,
  getTenantStats,
} from "../security/tenant-isolation-service";
import { getSessionStats } from "../security/device-session-service";

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const user = req.user as { role?: string } | undefined;
  if (user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
    });
  }
  next();
}

router.get("/dashboard", requireAdmin, async (req: Request, res: Response) => {
  try {
    const compliance = getComplianceStatus();
    const soc2Dashboard = getComplianceDashboard();
    const tenantStats = getTenantStats();
    const sessionStats = getSessionStats();
    const auditReport = await getAuditReport();

    res.json({
      success: true,
      data: {
        compliance,
        soc2: soc2Dashboard,
        tenants: tenantStats,
        sessions: sessionStats,
        audit: {
          totalEvents: auditReport.summary.totalEvents,
          last24Hours: auditReport.summary.last24Hours,
          phiAccessCount: auditReport.summary.phiAccessCount,
          byRiskLevel: auditReport.summary.byRiskLevel,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/audit-logs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      eventType: req.query.eventType as any,
      category: req.query.category as any,
      targetResourceType: req.query.resourceType as string,
      riskLevel: req.query.riskLevel as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await queryAuditLogs(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/audit-logs/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as "json" | "csv") || "csv";
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const exported = await exportAuditLogs(filters, format);

    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=audit-logs.${format}`);
    res.send(exported);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/audit-logs/verify", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await verifyAuditIntegrity();

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/controls", requireAdmin, async (req: Request, res: Response) => {
  try {
    const controls = getSOC2Controls();
    const dueForReview = getControlsDueForReview();

    res.json({
      success: true,
      data: {
        controls,
        dueForReview: dueForReview.map(c => c.controlId),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/access-reviews", requireAdmin, async (req: Request, res: Response) => {
  try {
    const reviews = getAccessReviews();

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/soc2/access-reviews", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const review = recordAccessReview({
      reviewedBy: user?.claims?.sub || "admin",
      reviewDate: new Date().toISOString(),
      usersReviewed: req.body.usersReviewed || 0,
      changesRequired: req.body.changesRequired || 0,
      changesMade: req.body.changesMade || 0,
      findings: req.body.findings || [],
      nextReviewDate: req.body.nextReviewDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/changes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const changes = getChangeRecords();

    res.json({
      success: true,
      data: changes,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/soc2/changes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const change = recordChange({
      changeType: req.body.changeType || "code",
      description: req.body.description,
      requestedBy: user?.claims?.sub || "admin",
      approvedBy: [],
      implementedBy: "",
      prNumber: req.body.prNumber,
      testingCompleted: false,
      rollbackPlan: req.body.rollbackPlan || "",
    });

    res.json({
      success: true,
      data: change,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/incidents", requireAdmin, async (req: Request, res: Response) => {
  try {
    const incidents = getIncidents();

    res.json({
      success: true,
      data: incidents,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/soc2/incidents", requireAdmin, async (req: Request, res: Response) => {
  try {
    const incident = recordIncident({
      severity: req.body.severity || "P3",
      title: req.body.title,
      description: req.body.description,
      affectedSystems: req.body.affectedSystems || [],
      detectedAt: new Date().toISOString(),
      notifiedParties: req.body.notifiedParties || [],
      isBreachNotificationRequired: req.body.isBreachNotificationRequired || false,
    });

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/vendors", requireAdmin, async (req: Request, res: Response) => {
  try {
    const vendors = getVendorAssessments();

    res.json({
      success: true,
      data: vendors,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/soc2/report", requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = generateComplianceReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/tenants", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenants = listTenants();

    res.json({
      success: true,
      data: tenants,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/tenants/:tenantId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: "Tenant not found",
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/tenants", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = createTenant({
      name: req.body.name,
      domain: req.body.domain,
      tier: req.body.tier || "standard",
      features: req.body.features,
      security: req.body.security,
      compliance: req.body.compliance,
    });

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/tenants/:tenantId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenant = updateTenant(req.params.tenantId, req.body);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: "Tenant not found",
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerSecurityAdminRoutes(app: any): void {
  app.use("/api/security-admin", router);
  console.log("[Routes] Security Admin Dashboard routes registered at /api/security-admin/*");
}

export default router;
