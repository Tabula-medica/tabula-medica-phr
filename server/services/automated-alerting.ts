import { randomUUID } from "crypto";
import { createHash } from "crypto";
import type {
  AlertConfiguration,
  Alert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertThreshold,
  NotificationChannel,
  InAppNotification,
  AlertMetrics,
  CreateAlertConfigurationInput,
} from "@shared/schema";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

interface MetricDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

interface MetricTimeSeries {
  metricName: string;
  dataPoints: MetricDataPoint[];
}

class AutomatedAlertingService {
  private configurations: Map<string, AlertConfiguration> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private notifications: Map<string, InAppNotification> = new Map();
  private metrics: Map<string, MetricTimeSeries> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultConfigurations();
    this.startMonitoring();
    console.log("[AutomatedAlerting] Service initialized");
  }

  private initializeDefaultConfigurations(): void {
    const syncFailureConfig: AlertConfiguration = {
      id: "alert-config-sync-failures",
      name: "High Sync Failure Rate",
      description: "Alert when external connection sync failure rate exceeds threshold",
      alertType: "sync_failure_rate",
      enabled: true,
      severity: "high",
      thresholds: [
        {
          metricName: "sync_failure_rate",
          operator: ">",
          value: 0.1,
          timeWindowMinutes: 15,
        },
      ],
      notificationChannels: ["in_app"],
      cooldownMinutes: 30,
      createdBy: hashIdentifier("system"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dataQualityConfig: AlertConfiguration = {
      id: "alert-config-data-quality",
      name: "Data Quality Issue Increase",
      description: "Alert when data quality issues significantly increase for patients or resource types",
      alertType: "data_quality_increase",
      enabled: true,
      severity: "medium",
      thresholds: [
        {
          metricName: "quality_issue_count",
          operator: ">",
          value: 10,
          timeWindowMinutes: 60,
        },
        {
          metricName: "quality_issue_rate_increase",
          operator: ">",
          value: 0.5,
          timeWindowMinutes: 60,
        },
      ],
      notificationChannels: ["in_app"],
      cooldownMinutes: 60,
      createdBy: hashIdentifier("system"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validationFailureConfig: AlertConfiguration = {
      id: "alert-config-validation-failures",
      name: "High-Severity Validation Failures",
      description: "Alert when new high-severity FHIR validation failures are detected",
      alertType: "validation_failure",
      enabled: true,
      severity: "critical",
      thresholds: [
        {
          metricName: "high_severity_violations",
          operator: ">",
          value: 0,
          timeWindowMinutes: 5,
        },
      ],
      notificationChannels: ["in_app"],
      cooldownMinutes: 15,
      createdBy: hashIdentifier("system"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const securityAnomalyConfig: AlertConfiguration = {
      id: "alert-config-security-anomaly",
      name: "Security Anomaly Detected",
      description: "Alert when unusual security events or potential threats are detected",
      alertType: "security_anomaly",
      enabled: true,
      severity: "critical",
      thresholds: [
        {
          metricName: "security_anomaly_score",
          operator: ">",
          value: 0.7,
          timeWindowMinutes: 10,
        },
        {
          metricName: "failed_auth_attempts",
          operator: ">",
          value: 5,
          timeWindowMinutes: 15,
        },
      ],
      notificationChannels: ["in_app"],
      cooldownMinutes: 5,
      createdBy: hashIdentifier("system"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const systemHealthConfig: AlertConfiguration = {
      id: "alert-config-system-health",
      name: "System Health Degradation",
      description: "Alert when system performance or availability degrades",
      alertType: "system_health",
      enabled: true,
      severity: "high",
      thresholds: [
        {
          metricName: "api_error_rate",
          operator: ">",
          value: 0.05,
          timeWindowMinutes: 10,
        },
        {
          metricName: "response_time_p95",
          operator: ">",
          value: 2000,
          timeWindowMinutes: 5,
        },
      ],
      notificationChannels: ["in_app"],
      cooldownMinutes: 15,
      createdBy: hashIdentifier("system"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.configurations.set(syncFailureConfig.id, syncFailureConfig);
    this.configurations.set(dataQualityConfig.id, dataQualityConfig);
    this.configurations.set(validationFailureConfig.id, validationFailureConfig);
    this.configurations.set(securityAnomalyConfig.id, securityAnomalyConfig);
    this.configurations.set(systemHealthConfig.id, systemHealthConfig);
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.evaluateAllConfigurations();
    }, 60000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async recordMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const timeSeries = this.metrics.get(metricName) || {
      metricName,
      dataPoints: [],
    };

    timeSeries.dataPoints.push({
      timestamp: Date.now(),
      value,
      metadata,
    });

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    timeSeries.dataPoints = timeSeries.dataPoints.filter(
      (dp) => dp.timestamp > oneHourAgo
    );

    this.metrics.set(metricName, timeSeries);

    await this.evaluateAllConfigurations();
  }

  async recordSyncResult(
    connectionId: string,
    success: boolean,
    resourceType?: string
  ): Promise<void> {
    await this.recordMetric("sync_result", success ? 1 : 0, {
      connectionId,
      resourceType,
      success,
    });

    const timeSeries = this.metrics.get("sync_result");
    if (timeSeries && timeSeries.dataPoints.length > 0) {
      const recentPoints = timeSeries.dataPoints.filter(
        (dp) => dp.timestamp > Date.now() - 15 * 60 * 1000
      );
      const failures = recentPoints.filter((dp) => dp.value === 0).length;
      const total = recentPoints.length;
      const failureRate = total > 0 ? failures / total : 0;

      await this.recordMetric("sync_failure_rate", failureRate, {
        connectionId,
        failures,
        total,
      });
    }
  }

  async recordDataQualityIssue(
    patientId: string,
    resourceType: string,
    issueType: string,
    severity: string
  ): Promise<void> {
    await this.recordMetric("quality_issue", 1, {
      patientId: hashIdentifier(patientId),
      resourceType,
      issueType,
      severity,
    });

    const timeSeries = this.metrics.get("quality_issue");
    if (timeSeries) {
      const recentPoints = timeSeries.dataPoints.filter(
        (dp) => dp.timestamp > Date.now() - 60 * 60 * 1000
      );
      await this.recordMetric("quality_issue_count", recentPoints.length, {
        resourceType,
      });
    }
  }

  async recordValidationFailure(
    resourceId: string,
    resourceType: string,
    severity: "error" | "warning" | "info",
    message: string
  ): Promise<void> {
    const severityValue = severity === "error" ? 3 : severity === "warning" ? 2 : 1;
    await this.recordMetric("validation_failure", severityValue, {
      resourceId: hashIdentifier(resourceId),
      resourceType,
      severity,
      message,
    });

    if (severity === "error") {
      await this.recordMetric("high_severity_violations", 1, {
        resourceId: hashIdentifier(resourceId),
        resourceType,
        message,
      });
    }
  }

  async recordSecurityAnomaly(
    eventType: string,
    severity: "critical" | "high" | "medium" | "low",
    details: {
      userId?: string;
      ipAddress?: string;
      action?: string;
      reason?: string;
    }
  ): Promise<void> {
    const anomalyScore = severity === "critical" ? 1.0 : 
                         severity === "high" ? 0.8 :
                         severity === "medium" ? 0.5 : 0.3;
    
    await this.recordMetric("security_anomaly_score", anomalyScore, {
      eventType,
      severity,
      userId: details.userId ? hashIdentifier(details.userId) : undefined,
      ipAddress: details.ipAddress ? hashIdentifier(details.ipAddress) : undefined,
      action: details.action,
      reason: details.reason,
    });

    if (eventType === "failed_auth") {
      await this.recordMetric("failed_auth_attempts", 1, {
        userId: details.userId ? hashIdentifier(details.userId) : undefined,
        ipAddress: details.ipAddress ? hashIdentifier(details.ipAddress) : undefined,
      });
    }
  }

  async recordSystemHealth(
    metricType: "api_error" | "response_time" | "cpu_usage" | "memory_usage" | "disk_usage",
    value: number,
    endpoint?: string
  ): Promise<void> {
    if (metricType === "api_error") {
      const timeSeries = this.metrics.get("api_request") || { metricName: "api_request", dataPoints: [] };
      const recentRequests = timeSeries.dataPoints.filter(
        (dp) => dp.timestamp > Date.now() - 10 * 60 * 1000
      );
      const errorRate = recentRequests.length > 0 
        ? recentRequests.filter(dp => dp.value === 0).length / recentRequests.length 
        : 0;
      
      await this.recordMetric("api_error_rate", errorRate, { endpoint });
    }

    if (metricType === "response_time") {
      await this.recordMetric("response_time_p95", value, { endpoint });
    }

    await this.recordMetric(`system_${metricType}`, value, { endpoint });
  }

  async recordApiRequest(
    success: boolean,
    responseTimeMs: number,
    endpoint?: string
  ): Promise<void> {
    await this.recordMetric("api_request", success ? 1 : 0, {
      responseTimeMs,
      endpoint,
    });

    await this.recordSystemHealth("response_time", responseTimeMs, endpoint);
    
    if (!success) {
      await this.recordSystemHealth("api_error", 1, endpoint);
    }
  }

  private async evaluateAllConfigurations(): Promise<void> {
    for (const config of this.configurations.values()) {
      if (!config.enabled) continue;
      await this.evaluateConfiguration(config);
    }
  }

  private async evaluateConfiguration(config: AlertConfiguration): Promise<void> {
    const lastAlert = this.lastAlertTime.get(config.id);
    if (lastAlert && Date.now() - lastAlert < config.cooldownMinutes * 60 * 1000) {
      return;
    }

    let shouldTrigger = false;
    const triggeredThresholds: AlertThreshold[] = [];
    const details: Record<string, unknown> = {};

    for (const threshold of config.thresholds) {
      const timeSeries = this.metrics.get(threshold.metricName);
      if (!timeSeries) continue;

      const windowStart = Date.now() - threshold.timeWindowMinutes * 60 * 1000;
      const recentPoints = timeSeries.dataPoints.filter(
        (dp) => dp.timestamp > windowStart
      );

      if (recentPoints.length === 0) continue;

      const currentValue =
        recentPoints.reduce((sum, dp) => sum + dp.value, 0) / recentPoints.length;

      const thresholdMet = this.evaluateThreshold(currentValue, threshold);
      if (thresholdMet) {
        shouldTrigger = true;
        triggeredThresholds.push(threshold);
        details[threshold.metricName] = {
          currentValue,
          threshold: threshold.value,
          operator: threshold.operator,
          dataPoints: recentPoints.length,
        };
      }
    }

    if (shouldTrigger) {
      await this.triggerAlert(config, triggeredThresholds, details);
    }
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case ">":
        return value > threshold.value;
      case ">=":
        return value >= threshold.value;
      case "<":
        return value < threshold.value;
      case "<=":
        return value <= threshold.value;
      case "==":
        return value === threshold.value;
      case "!=":
        return value !== threshold.value;
      default:
        return false;
    }
  }

  private async triggerAlert(
    config: AlertConfiguration,
    triggeredThresholds: AlertThreshold[],
    details: Record<string, unknown>
  ): Promise<void> {
    const alert: Alert = {
      id: `alert-${randomUUID()}`,
      configurationId: config.id,
      alertType: config.alertType,
      severity: config.severity,
      status: "active",
      title: config.name,
      message: this.generateAlertMessage(config, triggeredThresholds, details),
      details,
      triggeredAt: new Date().toISOString(),
      notificationsSent: [],
    };

    this.alerts.set(alert.id, alert);
    this.lastAlertTime.set(config.id, Date.now());

    for (const channel of config.notificationChannels) {
      const result = await this.sendNotification(alert, channel, config);
      alert.notificationsSent.push(result);
    }

    console.log(
      `[AutomatedAlerting] Alert triggered: ${alert.title} (${alert.severity})`
    );
  }

  private generateAlertMessage(
    config: AlertConfiguration,
    triggeredThresholds: AlertThreshold[],
    details: Record<string, unknown>
  ): string {
    const thresholdDescriptions = triggeredThresholds.map((t) => {
      const detail = details[t.metricName] as { currentValue: number } | undefined;
      const currentValue = detail?.currentValue?.toFixed(2) || "N/A";
      return `${t.metricName}: ${currentValue} ${t.operator} ${t.value}`;
    });

    return `${config.description}. Triggered conditions: ${thresholdDescriptions.join("; ")}`;
  }

  private async sendNotification(
    alert: Alert,
    channel: NotificationChannel,
    config: AlertConfiguration
  ): Promise<{
    channel: NotificationChannel;
    sentAt: string;
    success: boolean;
    error?: string;
  }> {
    const sentAt = new Date().toISOString();

    try {
      switch (channel) {
        case "in_app":
          await this.sendInAppNotification(alert);
          break;
        case "email":
          await this.sendEmailNotification(alert, config.emailRecipients || []);
          break;
        case "webhook":
          await this.sendWebhookNotification(alert, config.webhookUrl || "");
          break;
      }
      return { channel, sentAt, success: true };
    } catch (error) {
      return {
        channel,
        sentAt,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendInAppNotification(alert: Alert): Promise<void> {
    const notification: InAppNotification = {
      id: `notif-${randomUUID()}`,
      userId: "all",
      alertId: alert.id,
      type: "alert",
      title: alert.title,
      message: alert.message,
      read: false,
      createdAt: new Date().toISOString(),
      actionUrl: `/alerts/${alert.id}`,
      metadata: {
        severity: alert.severity,
        alertType: alert.alertType,
      },
    };

    this.notifications.set(notification.id, notification);
  }

  private async sendEmailNotification(
    alert: Alert,
    recipients: string[]
  ): Promise<void> {
    console.log(
      `[AutomatedAlerting] Email notification would be sent to: ${recipients.join(", ")}`
    );
  }

  private async sendWebhookNotification(
    alert: Alert,
    webhookUrl: string
  ): Promise<void> {
    if (!webhookUrl) {
      throw new Error("Webhook URL not configured");
    }

    const payload = {
      alertId: alert.id,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      triggeredAt: alert.triggeredAt,
      details: alert.details,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      console.error(`[AutomatedAlerting] Webhook notification failed:`, error);
      throw error;
    }
  }

  async createConfiguration(
    input: CreateAlertConfigurationInput,
    userId: string
  ): Promise<AlertConfiguration> {
    const config: AlertConfiguration = {
      id: `alert-config-${randomUUID()}`,
      name: input.name,
      description: input.description || "",
      alertType: input.alertType,
      enabled: input.enabled ?? true,
      severity: input.severity,
      thresholds: input.thresholds,
      notificationChannels: input.notificationChannels,
      emailRecipients: input.emailRecipients,
      webhookUrl: input.webhookUrl,
      cooldownMinutes: input.cooldownMinutes ?? 15,
      filters: input.filters,
      createdBy: hashIdentifier(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.configurations.set(config.id, config);
    return config;
  }

  async updateConfiguration(
    configId: string,
    updates: Partial<CreateAlertConfigurationInput>
  ): Promise<AlertConfiguration | null> {
    const config = this.configurations.get(configId);
    if (!config) return null;

    const updatedConfig: AlertConfiguration = {
      ...config,
      ...updates,
      id: config.id,
      createdBy: config.createdBy,
      createdAt: config.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.configurations.set(configId, updatedConfig);
    return updatedConfig;
  }

  async deleteConfiguration(configId: string): Promise<boolean> {
    return this.configurations.delete(configId);
  }

  async getConfiguration(configId: string): Promise<AlertConfiguration | null> {
    return this.configurations.get(configId) || null;
  }

  async listConfigurations(filters?: {
    alertType?: AlertType;
    enabled?: boolean;
    severity?: AlertSeverity;
  }): Promise<AlertConfiguration[]> {
    let configs = Array.from(this.configurations.values());

    if (filters?.alertType) {
      configs = configs.filter((c) => c.alertType === filters.alertType);
    }
    if (filters?.enabled !== undefined) {
      configs = configs.filter((c) => c.enabled === filters.enabled);
    }
    if (filters?.severity) {
      configs = configs.filter((c) => c.severity === filters.severity);
    }

    return configs;
  }

  async acknowledgeAlert(
    alertId: string,
    userId: string
  ): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = "acknowledged";
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = hashIdentifier(userId);

    return alert;
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = "resolved";
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = hashIdentifier(userId);

    return alert;
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    return this.alerts.get(alertId) || null;
  }

  async listAlerts(filters?: {
    alertType?: AlertType;
    severity?: AlertSeverity;
    status?: AlertStatus;
    configurationId?: string;
    since?: string;
  }): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (filters?.alertType) {
      alerts = alerts.filter((a) => a.alertType === filters.alertType);
    }
    if (filters?.severity) {
      alerts = alerts.filter((a) => a.severity === filters.severity);
    }
    if (filters?.status) {
      alerts = alerts.filter((a) => a.status === filters.status);
    }
    if (filters?.configurationId) {
      alerts = alerts.filter(
        (a) => a.configurationId === filters.configurationId
      );
    }
    if (filters?.since) {
      const sinceTime = new Date(filters.since).getTime();
      alerts = alerts.filter(
        (a) => new Date(a.triggeredAt).getTime() > sinceTime
      );
    }

    return alerts.sort(
      (a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  }

  async getNotifications(
    userId: string,
    unreadOnly?: boolean
  ): Promise<InAppNotification[]> {
    let notifications = Array.from(this.notifications.values()).filter(
      (n) => n.userId === "all" || n.userId === hashIdentifier(userId)
    );

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    return notifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async markNotificationRead(
    notificationId: string,
    userId: string
  ): Promise<InAppNotification | null> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return null;

    if (
      notification.userId !== "all" &&
      notification.userId !== hashIdentifier(userId)
    ) {
      return null;
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    return notification;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const hashedUserId = hashIdentifier(userId);
    let count = 0;

    for (const notification of this.notifications.values()) {
      if (
        !notification.read &&
        (notification.userId === "all" || notification.userId === hashedUserId)
      ) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        count++;
      }
    }

    return count;
  }

  async getMetrics(): Promise<AlertMetrics> {
    const alerts = Array.from(this.alerts.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const alertsByType: Record<AlertType, number> = {
      sync_failure_rate: 0,
      data_quality_increase: 0,
      validation_failure: 0,
      security_anomaly: 0,
      system_health: 0,
    };

    const alertsBySeverity: Record<AlertSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const alertsByStatus: Record<AlertStatus, number> = {
      active: 0,
      acknowledged: 0,
      resolved: 0,
      suppressed: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let triggeredLast24h = 0;
    let resolvedLast24h = 0;

    for (const alert of alerts) {
      alertsByType[alert.alertType]++;
      alertsBySeverity[alert.severity]++;
      alertsByStatus[alert.status]++;

      const triggeredTime = new Date(alert.triggeredAt).getTime();
      if (triggeredTime > oneDayAgo) {
        triggeredLast24h++;
      }

      if (alert.resolvedAt) {
        const resolvedTime = new Date(alert.resolvedAt).getTime();
        if (resolvedTime > oneDayAgo) {
          resolvedLast24h++;
        }
        totalResolutionTime += resolvedTime - triggeredTime;
        resolvedCount++;
      }
    }

    return {
      totalAlerts: alerts.length,
      alertsByType,
      alertsBySeverity,
      alertsByStatus,
      averageResolutionTimeMinutes:
        resolvedCount > 0 ? totalResolutionTime / resolvedCount / 60000 : 0,
      alertsTriggeredLast24h: triggeredLast24h,
      alertsResolvedLast24h: resolvedLast24h,
    };
  }

  async testAlert(configId: string): Promise<Alert | null> {
    const config = this.configurations.get(configId);
    if (!config) return null;

    const testDetails = {
      test: true,
      triggeredManually: true,
    };

    const alert: Alert = {
      id: `alert-test-${randomUUID()}`,
      configurationId: config.id,
      alertType: config.alertType,
      severity: config.severity,
      status: "active",
      title: `[TEST] ${config.name}`,
      message: `This is a test alert for configuration: ${config.name}`,
      details: testDetails,
      triggeredAt: new Date().toISOString(),
      notificationsSent: [],
    };

    this.alerts.set(alert.id, alert);

    for (const channel of config.notificationChannels) {
      const result = await this.sendNotification(alert, channel, config);
      alert.notificationsSent.push(result);
    }

    console.log(`[AutomatedAlerting] Test alert triggered: ${alert.title}`);
    return alert;
  }
}

export const automatedAlertingService = new AutomatedAlertingService();
