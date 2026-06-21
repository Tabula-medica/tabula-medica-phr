import { Router } from "express";
import { automatedAlertingService } from "./services/automated-alerting";
import { createAlertConfigurationSchema } from "@shared/schema";

export function registerAlertingRoutes(router: Router): void {
  router.get("/api/alerting/configurations", async (req, res) => {
    try {
      const { alertType, enabled, severity } = req.query;
      
      const configurations = await automatedAlertingService.listConfigurations({
        alertType: alertType as string | undefined,
        enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
        severity: severity as string | undefined,
      });

      res.json({
        success: true,
        configurations,
      });
    } catch (error) {
      console.error("[Alerting] List configurations error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list alert configurations",
      });
    }
  });

  router.get("/api/alerting/configurations/:configId", async (req, res) => {
    try {
      const { configId } = req.params;
      const configuration = await automatedAlertingService.getConfiguration(configId);

      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: "Configuration not found",
        });
      }

      res.json({
        success: true,
        configuration,
      });
    } catch (error) {
      console.error("[Alerting] Get configuration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get alert configuration",
      });
    }
  });

  router.post("/api/alerting/configurations", async (req, res) => {
    try {
      const parseResult = createAlertConfigurationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid configuration data",
          details: parseResult.error.errors,
        });
      }

      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      const configuration = await automatedAlertingService.createConfiguration(
        parseResult.data,
        userId
      );

      res.status(201).json({
        success: true,
        configuration,
      });
    } catch (error) {
      console.error("[Alerting] Create configuration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create alert configuration",
      });
    }
  });

  router.patch("/api/alerting/configurations/:configId", async (req, res) => {
    try {
      const { configId } = req.params;
      
      const configuration = await automatedAlertingService.updateConfiguration(
        configId,
        req.body
      );

      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: "Configuration not found",
        });
      }

      res.json({
        success: true,
        configuration,
      });
    } catch (error) {
      console.error("[Alerting] Update configuration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update alert configuration",
      });
    }
  });

  router.delete("/api/alerting/configurations/:configId", async (req, res) => {
    try {
      const { configId } = req.params;
      const deleted = await automatedAlertingService.deleteConfiguration(configId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Configuration not found",
        });
      }

      res.json({
        success: true,
        message: "Configuration deleted",
      });
    } catch (error) {
      console.error("[Alerting] Delete configuration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete alert configuration",
      });
    }
  });

  router.post("/api/alerting/configurations/:configId/test", async (req, res) => {
    try {
      const { configId } = req.params;
      const alert = await automatedAlertingService.testAlert(configId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Configuration not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      console.error("[Alerting] Test alert error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to trigger test alert",
      });
    }
  });

  router.get("/api/alerting/alerts", async (req, res) => {
    try {
      const { alertType, severity, status, configurationId, since } = req.query;
      
      const alerts = await automatedAlertingService.listAlerts({
        alertType: alertType as string | undefined,
        severity: severity as string | undefined,
        status: status as string | undefined,
        configurationId: configurationId as string | undefined,
        since: since as string | undefined,
      });

      res.json({
        success: true,
        alerts,
      });
    } catch (error) {
      console.error("[Alerting] List alerts error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list alerts",
      });
    }
  });

  router.get("/api/alerting/alerts/:alertId", async (req, res) => {
    try {
      const { alertId } = req.params;
      const alert = await automatedAlertingService.getAlert(alertId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      console.error("[Alerting] Get alert error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get alert",
      });
    }
  });

  router.post("/api/alerting/alerts/:alertId/acknowledge", async (req, res) => {
    try {
      const { alertId } = req.params;
      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      
      const alert = await automatedAlertingService.acknowledgeAlert(alertId, userId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      console.error("[Alerting] Acknowledge alert error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to acknowledge alert",
      });
    }
  });

  router.post("/api/alerting/alerts/:alertId/resolve", async (req, res) => {
    try {
      const { alertId } = req.params;
      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      
      const alert = await automatedAlertingService.resolveAlert(alertId, userId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      console.error("[Alerting] Resolve alert error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to resolve alert",
      });
    }
  });

  router.get("/api/alerting/notifications", async (req, res) => {
    try {
      const { unreadOnly } = req.query;
      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      
      const notifications = await automatedAlertingService.getNotifications(
        userId,
        unreadOnly === "true"
      );

      res.json({
        success: true,
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      });
    } catch (error) {
      console.error("[Alerting] Get notifications error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get notifications",
      });
    }
  });

  router.post("/api/alerting/notifications/:notificationId/read", async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      
      const notification = await automatedAlertingService.markNotificationRead(
        notificationId,
        userId
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: "Notification not found",
        });
      }

      res.json({
        success: true,
        notification,
      });
    } catch (error) {
      console.error("[Alerting] Mark notification read error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark notification as read",
      });
    }
  });

  router.post("/api/alerting/notifications/read-all", async (req, res) => {
    try {
      const userId = (req as { user?: { id: string } }).user?.id || "anonymous";
      const count = await automatedAlertingService.markAllNotificationsRead(userId);

      res.json({
        success: true,
        markedRead: count,
      });
    } catch (error) {
      console.error("[Alerting] Mark all notifications read error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark all notifications as read",
      });
    }
  });

  router.get("/api/alerting/metrics", async (req, res) => {
    try {
      const metrics = await automatedAlertingService.getMetrics();

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      console.error("[Alerting] Get metrics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get alerting metrics",
      });
    }
  });

  router.post("/api/alerting/record/sync-result", async (req, res) => {
    try {
      const { connectionId, success, resourceType } = req.body as {
        connectionId: string;
        success: boolean;
        resourceType?: string;
      };

      if (!connectionId || success === undefined) {
        return res.status(400).json({
          success: false,
          error: "connectionId and success are required",
        });
      }

      await automatedAlertingService.recordSyncResult(connectionId, success, resourceType);

      res.json({
        success: true,
        message: "Sync result recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record sync result error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record sync result",
      });
    }
  });

  router.post("/api/alerting/record/quality-issue", async (req, res) => {
    try {
      const { patientId, resourceType, issueType, severity } = req.body as {
        patientId: string;
        resourceType: string;
        issueType: string;
        severity: string;
      };

      if (!patientId || !resourceType || !issueType || !severity) {
        return res.status(400).json({
          success: false,
          error: "patientId, resourceType, issueType, and severity are required",
        });
      }

      await automatedAlertingService.recordDataQualityIssue(
        patientId,
        resourceType,
        issueType,
        severity
      );

      res.json({
        success: true,
        message: "Quality issue recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record quality issue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record quality issue",
      });
    }
  });

  router.post("/api/alerting/record/validation-failure", async (req, res) => {
    try {
      const { resourceId, resourceType, severity, message } = req.body as {
        resourceId: string;
        resourceType: string;
        severity: "error" | "warning" | "info";
        message: string;
      };

      if (!resourceId || !resourceType || !severity || !message) {
        return res.status(400).json({
          success: false,
          error: "resourceId, resourceType, severity, and message are required",
        });
      }

      await automatedAlertingService.recordValidationFailure(
        resourceId,
        resourceType,
        severity,
        message
      );

      res.json({
        success: true,
        message: "Validation failure recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record validation failure error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record validation failure",
      });
    }
  });

  router.post("/api/alerting/record/security-anomaly", async (req, res) => {
    try {
      const { eventType, severity, userId, ipAddress, action, reason } = req.body as {
        eventType: string;
        severity: "critical" | "high" | "medium" | "low";
        userId?: string;
        ipAddress?: string;
        action?: string;
        reason?: string;
      };

      if (!eventType || !severity) {
        return res.status(400).json({
          success: false,
          error: "eventType and severity are required",
        });
      }

      await automatedAlertingService.recordSecurityAnomaly(eventType, severity, {
        userId,
        ipAddress,
        action,
        reason,
      });

      res.json({
        success: true,
        message: "Security anomaly recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record security anomaly error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record security anomaly",
      });
    }
  });

  router.post("/api/alerting/record/system-health", async (req, res) => {
    try {
      const { metricType, value, endpoint } = req.body as {
        metricType: "api_error" | "response_time" | "cpu_usage" | "memory_usage" | "disk_usage";
        value: number;
        endpoint?: string;
      };

      if (!metricType || value === undefined) {
        return res.status(400).json({
          success: false,
          error: "metricType and value are required",
        });
      }

      await automatedAlertingService.recordSystemHealth(metricType, value, endpoint);

      res.json({
        success: true,
        message: "System health metric recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record system health error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record system health metric",
      });
    }
  });

  router.post("/api/alerting/record/api-request", async (req, res) => {
    try {
      const { success, responseTimeMs, endpoint } = req.body as {
        success: boolean;
        responseTimeMs: number;
        endpoint?: string;
      };

      if (success === undefined || responseTimeMs === undefined) {
        return res.status(400).json({
          success: false,
          error: "success and responseTimeMs are required",
        });
      }

      await automatedAlertingService.recordApiRequest(success, responseTimeMs, endpoint);

      res.json({
        success: true,
        message: "API request recorded",
      });
    } catch (error) {
      console.error("[Alerting] Record API request error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record API request",
      });
    }
  });

  console.log("[Routes] Automated Alerting routes registered at /api/alerting/*");
}
