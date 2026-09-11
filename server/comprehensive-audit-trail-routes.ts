import { Router, Request, Response } from "express";
import { 
  comprehensiveAuditTrailService,
  AuditActionCategory,
  AuditActionType,
  AuditSeverity,
  AuditLogFilter
} from "./services/comprehensive-audit-trail-service";
import { extractUserContext, requireRole, AuthorizedRequest } from "./middleware/rbac-authorization";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

router.use(extractUserContext);

router.get("/metadata", async (req: AuthorizedRequest, res: Response) => {
  try {
    logPhiAccess({
      action: "read",
      userId: getUserId(req),
      resourceType: "AuditTrailMetadata",
      details: "AUDIT_TRAIL_METADATA_ACCESSED",
    });

    const metadata = await comprehensiveAuditTrailService.getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[AuditTrail] Error getting metadata:", error);
    res.status(500).json({ error: "Failed to get audit trail metadata" });
  }
});

router.get("/logs", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    
    const filter: AuditLogFilter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      userId: req.query.userId as string,
      userRole: req.query.userRole as string,
      category: req.query.category as AuditActionCategory,
      action: req.query.action as AuditActionType,
      resourceType: req.query.resourceType as string,
      resourceId: req.query.resourceId as string,
      severity: req.query.severity as AuditSeverity,
      success: req.query.success ? req.query.success === "true" : undefined,
      phiAccessed: req.query.phiAccessed ? req.query.phiAccessed === "true" : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      searchText: req.query.searchText as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      sortBy: req.query.sortBy as "timestamp" | "severity" | "category",
      sortOrder: req.query.sortOrder as "asc" | "desc"
    };

    const result = await comprehensiveAuditTrailService.getAuditLogs(userId, filter);
    res.json(result);
  } catch (error) {
    console.error("[AuditTrail] Error getting logs:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

router.get("/logs/:logId", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { logId } = req.params;

    const log = await comprehensiveAuditTrailService.getAuditLogById(userId, logId);
    if (!log) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    res.json({ log });
  } catch (error) {
    console.error("[AuditTrail] Error getting log:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

router.get("/statistics", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const statistics = await comprehensiveAuditTrailService.getAuditStatistics(userId, filter);
    res.json(statistics);
  } catch (error) {
    console.error("[AuditTrail] Error getting statistics:", error);
    res.status(500).json({ error: "Failed to get audit statistics" });
  }
});

router.post("/export", requireRole("administrator", "auditor"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { filter, format } = req.body;

    const result = await comprehensiveAuditTrailService.exportAuditLogs(
      userId,
      filter,
      format || "json"
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error("[AuditTrail] Error exporting logs:", error);
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});

router.post("/log/data-source", requireRole("administrator", "clinician", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const userRole = req.userRole || "unknown";
    const { action, dataSource, details, context } = req.body;

    if (!action || !dataSource || !details) {
      return res.status(400).json({ 
        error: "action, dataSource, and details are required" 
      });
    }

    const entry = await comprehensiveAuditTrailService.logDataSourceAction(
      userId,
      userRole,
      action,
      dataSource,
      details,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      }
    );

    res.status(201).json({ entry });
  } catch (error) {
    console.error("[AuditTrail] Error logging data source action:", error);
    res.status(500).json({ error: "Failed to log data source action" });
  }
});

router.post("/log/configuration", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const userRole = req.userRole || "unknown";
    const { config, changes, details, context } = req.body;

    if (!config || !changes || !details) {
      return res.status(400).json({ 
        error: "config, changes, and details are required" 
      });
    }

    const entry = await comprehensiveAuditTrailService.logConfigurationChange(
      userId,
      userRole,
      config,
      changes,
      details,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      }
    );

    res.status(201).json({ entry });
  } catch (error) {
    console.error("[AuditTrail] Error logging configuration change:", error);
    res.status(500).json({ error: "Failed to log configuration change" });
  }
});

router.post("/log/rule-execution", requireRole("administrator", "clinician"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const userRole = req.userRole || "unknown";
    const { rule, execution, context } = req.body;

    if (!rule || !execution) {
      return res.status(400).json({ 
        error: "rule and execution are required" 
      });
    }

    const entry = await comprehensiveAuditTrailService.logRuleExecution(
      userId,
      userRole,
      rule,
      execution,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      }
    );

    res.status(201).json({ entry });
  } catch (error) {
    console.error("[AuditTrail] Error logging rule execution:", error);
    res.status(500).json({ error: "Failed to log rule execution" });
  }
});

router.post("/log/ai-prediction", requireRole("administrator", "clinician", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const userRole = req.userRole || "unknown";
    const { model, prediction, context } = req.body;

    if (!model || !prediction) {
      return res.status(400).json({ 
        error: "model and prediction are required" 
      });
    }

    const entry = await comprehensiveAuditTrailService.logAIPrediction(
      userId,
      userRole,
      model,
      prediction,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      }
    );

    res.status(201).json({ entry });
  } catch (error) {
    console.error("[AuditTrail] Error logging AI prediction:", error);
    res.status(500).json({ error: "Failed to log AI prediction" });
  }
});

router.post("/log/access-control", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const userRole = req.userRole || "unknown";
    const { action, target, details, context } = req.body;

    if (!action || !target || !details) {
      return res.status(400).json({ 
        error: "action, target, and details are required" 
      });
    }

    const entry = await comprehensiveAuditTrailService.logAccessControlAction(
      userId,
      userRole,
      action,
      target,
      details,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      }
    );

    res.status(201).json({ entry });
  } catch (error) {
    console.error("[AuditTrail] Error logging access control action:", error);
    res.status(500).json({ error: "Failed to log access control action" });
  }
});

router.get("/alerts", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const configs = await comprehensiveAuditTrailService.getAlertConfigs(userId);
    res.json({ 
      configs,
      count: configs.length
    });
  } catch (error) {
    console.error("[AuditTrail] Error getting alert configs:", error);
    res.status(500).json({ error: "Failed to get alert configurations" });
  }
});

router.post("/alerts", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, enabled, conditions, notifications } = req.body;

    if (!name || !conditions) {
      return res.status(400).json({ 
        error: "name and conditions are required" 
      });
    }

    const config = await comprehensiveAuditTrailService.createAlertConfig(userId, {
      name,
      enabled: enabled !== false,
      conditions,
      notifications: notifications || { inApp: true }
    });

    res.status(201).json({ 
      config,
      message: "Alert configuration created successfully"
    });
  } catch (error) {
    console.error("[AuditTrail] Error creating alert config:", error);
    res.status(500).json({ error: "Failed to create alert configuration" });
  }
});

router.patch("/alerts/:alertId", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { alertId } = req.params;

    const config = await comprehensiveAuditTrailService.updateAlertConfig(
      userId,
      alertId,
      req.body
    );

    if (!config) {
      return res.status(404).json({ error: "Alert configuration not found" });
    }

    res.json({ 
      config,
      message: "Alert configuration updated successfully"
    });
  } catch (error) {
    console.error("[AuditTrail] Error updating alert config:", error);
    res.status(500).json({ error: "Failed to update alert configuration" });
  }
});

router.delete("/alerts/:alertId", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { alertId } = req.params;

    const success = await comprehensiveAuditTrailService.deleteAlertConfig(userId, alertId);
    if (!success) {
      return res.status(404).json({ error: "Alert configuration not found" });
    }

    res.json({ message: "Alert configuration deleted successfully" });
  } catch (error) {
    console.error("[AuditTrail] Error deleting alert config:", error);
    res.status(500).json({ error: "Failed to delete alert configuration" });
  }
});

console.log("[AuditTrail] Routes registered at /api/audit-trail/*");
console.log("[AuditTrail] Endpoints: /metadata, /logs, /statistics, /export, /log/*, /alerts");

export default router;
