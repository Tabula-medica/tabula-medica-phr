import { logPhiAccess } from "../security/hipaa-audit";

export type AuditActionCategory = 
  | "data_source"
  | "configuration"
  | "rule_execution"
  | "ai_prediction"
  | "user_management"
  | "access_control"
  | "patient_record"
  | "system_event"
  | "integration"
  | "export";

export type AuditActionType =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "execute"
  | "configure"
  | "approve"
  | "reject"
  | "export"
  | "import"
  | "connect"
  | "disconnect"
  | "login"
  | "logout"
  | "prediction"
  | "validation"
  | "error";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  environment?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  who: {
    userId: string;
    userRole: string;
    userName?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  what: {
    category: AuditActionCategory;
    action: AuditActionType;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    description: string;
    changes?: {
      field: string;
      oldValue?: any;
      newValue?: any;
    }[];
  };
  when: {
    timestamp: string;
    timezone: string;
    epochMs: number;
  };
  why: {
    reason?: string;
    businessJustification?: string;
    triggeredBy?: string;
    workflowId?: string;
    ruleId?: string;
    automatedAction?: boolean;
  };
  result: {
    success: boolean;
    statusCode?: number;
    errorMessage?: string;
    errorCode?: string;
    duration_ms?: number;
  };
  context: AuditContext;
  severity: AuditSeverity;
  tags: string[];
  metadata?: Record<string, any>;
  phiAccessed?: boolean;
  complianceFlags?: string[];
}

export interface AuditLogFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  userRole?: string;
  category?: AuditActionCategory;
  action?: AuditActionType;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  success?: boolean;
  phiAccessed?: boolean;
  tags?: string[];
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: "timestamp" | "severity" | "category";
  sortOrder?: "asc" | "desc";
}

export interface AuditStatistics {
  totalLogs: number;
  byCategory: Record<AuditActionCategory, number>;
  byAction: Record<AuditActionType, number>;
  bySeverity: Record<AuditSeverity, number>;
  byUser: { userId: string; count: number }[];
  successRate: number;
  errorCount: number;
  phiAccessCount: number;
  timeRange: { start: string; end: string };
}

export interface AuditAlertConfig {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    category?: AuditActionCategory[];
    action?: AuditActionType[];
    severity?: AuditSeverity[];
    userRole?: string[];
    phiAccessed?: boolean;
    errorThreshold?: number;
    timeWindowMinutes?: number;
  };
  notifications: {
    email?: string[];
    webhook?: string;
    inApp?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

class ComprehensiveAuditTrailService {
  private auditLogs: AuditEntry[] = [];
  private alertConfigs: AuditAlertConfig[] = [];
  private version = "1.0.0";
  private retentionDays = 2555;

  constructor() {
    this.initializeSampleData();
    console.log("[AuditTrail] Service initialized");
    console.log(`[AuditTrail] Version: ${this.version}`);
    console.log(`[AuditTrail] Retention: ${this.retentionDays} days (HIPAA compliant)`);
    console.log("[AuditTrail] Features: structured logging, compliance tracking, alerting");
  }

  private initializeSampleData(): void {
    const now = new Date();
    
    this.auditLogs = [
      {
        id: "audit-001",
        timestamp: new Date(now.getTime() - 3600000).toISOString(),
        who: {
          userId: "admin-001",
          userRole: "administrator",
          userName: "System Admin",
          ipAddress: "192.168.1.100",
          sessionId: "sess-abc123"
        },
        what: {
          category: "data_source",
          action: "create",
          resourceType: "DataSource",
          resourceId: "ds-epic-001",
          resourceName: "Fasten Health Connection",
          description: "Registered new EHR data source: Fasten Health"
        },
        when: {
          timestamp: new Date(now.getTime() - 3600000).toISOString(),
          timezone: "UTC",
          epochMs: now.getTime() - 3600000
        },
        why: {
          reason: "New hospital integration",
          businessJustification: "Patient data consolidation initiative",
          triggeredBy: "manual",
          automatedAction: false
        },
        result: {
          success: true,
          statusCode: 201,
          duration_ms: 245
        },
        context: {
          environment: "development",
          requestId: "req-001"
        },
        severity: "info",
        tags: ["ehr", "fastenhealth", "integration"],
        phiAccessed: false,
        complianceFlags: ["HIPAA", "SOC2"]
      },
      {
        id: "audit-002",
        timestamp: new Date(now.getTime() - 1800000).toISOString(),
        who: {
          userId: "clinician-001",
          userRole: "clinician",
          userName: "Dr. Sarah Johnson",
          ipAddress: "192.168.1.105",
          sessionId: "sess-def456"
        },
        what: {
          category: "rule_execution",
          action: "execute",
          resourceType: "ClinicalRule",
          resourceId: "rule-diabetes-001",
          resourceName: "Diabetes Screening Rule",
          description: "Executed diabetes screening rule for patient cohort"
        },
        when: {
          timestamp: new Date(now.getTime() - 1800000).toISOString(),
          timezone: "UTC",
          epochMs: now.getTime() - 1800000
        },
        why: {
          reason: "Scheduled preventive care screening",
          ruleId: "rule-diabetes-001",
          triggeredBy: "scheduler",
          automatedAction: true
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 1523
        },
        context: {
          environment: "development",
          correlationId: "corr-xyz789"
        },
        severity: "info",
        tags: ["clinical", "diabetes", "screening", "automated"],
        phiAccessed: true,
        complianceFlags: ["HIPAA", "NO-CDS"]
      },
      {
        id: "audit-003",
        timestamp: new Date(now.getTime() - 900000).toISOString(),
        who: {
          userId: "ai-system",
          userRole: "system",
          userName: "AI Prediction Service"
        },
        what: {
          category: "ai_prediction",
          action: "prediction",
          resourceType: "AIModel",
          resourceId: "model-risk-001",
          resourceName: "Patient Risk Stratification Model",
          description: "Generated risk predictions for 150 patients"
        },
        when: {
          timestamp: new Date(now.getTime() - 900000).toISOString(),
          timezone: "UTC",
          epochMs: now.getTime() - 900000
        },
        why: {
          reason: "Daily risk assessment batch",
          workflowId: "workflow-risk-batch",
          triggeredBy: "cron",
          automatedAction: true
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 8750
        },
        context: {
          environment: "development"
        },
        severity: "info",
        tags: ["ai", "prediction", "risk", "batch"],
        phiAccessed: true,
        complianceFlags: ["HIPAA", "NO-CDS"],
        metadata: {
          patientsProcessed: 150,
          highRiskIdentified: 23,
          modelVersion: "v2.1.0"
        }
      },
      {
        id: "audit-004",
        timestamp: new Date(now.getTime() - 600000).toISOString(),
        who: {
          userId: "admin-002",
          userRole: "administrator",
          userName: "IT Admin",
          ipAddress: "192.168.1.101"
        },
        what: {
          category: "configuration",
          action: "update",
          resourceType: "SystemConfig",
          resourceId: "config-security",
          resourceName: "Security Settings",
          description: "Updated session timeout from 30 to 60 minutes",
          changes: [
            { field: "sessionTimeoutMinutes", oldValue: 30, newValue: 60 }
          ]
        },
        when: {
          timestamp: new Date(now.getTime() - 600000).toISOString(),
          timezone: "UTC",
          epochMs: now.getTime() - 600000
        },
        why: {
          reason: "User feedback on session expiration",
          businessJustification: "Improve user experience while maintaining security",
          triggeredBy: "manual",
          automatedAction: false
        },
        result: {
          success: true,
          statusCode: 200,
          duration_ms: 45
        },
        context: {
          environment: "development"
        },
        severity: "warning",
        tags: ["security", "configuration", "session"],
        phiAccessed: false,
        complianceFlags: ["SOC2"]
      }
    ];

    this.alertConfigs = [
      {
        id: "alert-001",
        name: "Critical Error Alert",
        enabled: true,
        conditions: {
          severity: ["critical", "error"],
          timeWindowMinutes: 15,
          errorThreshold: 5
        },
        notifications: {
          inApp: true
        },
        createdAt: new Date(now.getTime() - 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 86400000).toISOString()
      },
      {
        id: "alert-002",
        name: "PHI Access Monitor",
        enabled: true,
        conditions: {
          phiAccessed: true,
          category: ["patient_record", "ai_prediction"]
        },
        notifications: {
          inApp: true
        },
        createdAt: new Date(now.getTime() - 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 86400000).toISOString()
      }
    ];
  }

  async getServiceMetadata(): Promise<{
    version: string;
    retentionDays: number;
    totalLogs: number;
    categories: AuditActionCategory[];
    actions: AuditActionType[];
    severities: AuditSeverity[];
    features: string[];
    complianceStandards: string[];
  }> {
    return {
      version: this.version,
      retentionDays: this.retentionDays,
      totalLogs: this.auditLogs.length,
      categories: [
        "data_source", "configuration", "rule_execution", "ai_prediction",
        "user_management", "access_control", "patient_record", "system_event",
        "integration", "export"
      ],
      actions: [
        "create", "read", "update", "delete", "execute", "configure",
        "approve", "reject", "export", "import", "connect", "disconnect",
        "login", "logout", "prediction", "validation", "error"
      ],
      severities: ["info", "warning", "error", "critical"],
      features: [
        "Structured who/what/when/why logging",
        "Change tracking with before/after values",
        "PHI access flagging",
        "Compliance tagging (HIPAA, SOC2, NO-CDS)",
        "Configurable alerts",
        "Full-text search",
        "Export capabilities",
        "Statistics and analytics"
      ],
      complianceStandards: ["HIPAA", "SOC2", "GDPR", "NO-CDS"]
    };
  }

  async logAuditEntry(
    userId: string,
    entry: Omit<AuditEntry, "id" | "timestamp" | "when">
  ): Promise<AuditEntry> {
    const now = new Date();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const fullEntry: AuditEntry = {
      ...entry,
      id,
      timestamp: now.toISOString(),
      when: {
        timestamp: now.toISOString(),
        timezone: "UTC",
        epochMs: now.getTime()
      }
    };

    this.auditLogs.unshift(fullEntry);

    logPhiAccess({
      action: "write",
      userId,
      resourceType: "AuditLog",
      resourceId: id,
      details: `AUDIT_LOG_CREATED: ${entry.what.category}/${entry.what.action} on ${entry.what.resourceType}`,
    });

    await this.checkAlerts(fullEntry);

    return fullEntry;
  }

  async logDataSourceAction(
    userId: string,
    userRole: string,
    action: AuditActionType,
    dataSource: { id: string; name: string; type: string },
    details: {
      description: string;
      reason?: string;
      success: boolean;
      errorMessage?: string;
      changes?: { field: string; oldValue?: any; newValue?: any }[];
    },
    context?: AuditContext
  ): Promise<AuditEntry> {
    return this.logAuditEntry(userId, {
      who: {
        userId,
        userRole,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        sessionId: context?.sessionId
      },
      what: {
        category: "data_source",
        action,
        resourceType: "DataSource",
        resourceId: dataSource.id,
        resourceName: dataSource.name,
        description: details.description,
        changes: details.changes
      },
      why: {
        reason: details.reason,
        triggeredBy: "manual",
        automatedAction: false
      },
      result: {
        success: details.success,
        statusCode: details.success ? 200 : 500,
        errorMessage: details.errorMessage
      },
      context: context || {},
      severity: details.success ? "info" : "error",
      tags: ["data_source", dataSource.type, action],
      phiAccessed: false,
      complianceFlags: ["HIPAA", "SOC2"]
    });
  }

  async logConfigurationChange(
    userId: string,
    userRole: string,
    config: { id: string; name: string; type: string },
    changes: { field: string; oldValue?: any; newValue?: any }[],
    details: {
      reason: string;
      businessJustification?: string;
      success: boolean;
      errorMessage?: string;
    },
    context?: AuditContext
  ): Promise<AuditEntry> {
    const severity: AuditSeverity = config.type === "security" ? "warning" : "info";

    return this.logAuditEntry(userId, {
      who: {
        userId,
        userRole,
        ipAddress: context?.ipAddress,
        sessionId: context?.sessionId
      },
      what: {
        category: "configuration",
        action: "update",
        resourceType: "Configuration",
        resourceId: config.id,
        resourceName: config.name,
        description: `Updated configuration: ${changes.map(c => c.field).join(", ")}`,
        changes
      },
      why: {
        reason: details.reason,
        businessJustification: details.businessJustification,
        triggeredBy: "manual",
        automatedAction: false
      },
      result: {
        success: details.success,
        errorMessage: details.errorMessage
      },
      context: context || {},
      severity,
      tags: ["configuration", config.type],
      phiAccessed: false,
      complianceFlags: config.type === "security" ? ["SOC2", "HIPAA"] : ["SOC2"]
    });
  }

  async logRuleExecution(
    userId: string,
    userRole: string,
    rule: { id: string; name: string; domain: string },
    execution: {
      triggeredBy: "manual" | "scheduler" | "event";
      patientsAffected?: number;
      tasksGenerated?: number;
      duration_ms: number;
      success: boolean;
      errorMessage?: string;
    },
    context?: AuditContext
  ): Promise<AuditEntry> {
    return this.logAuditEntry(userId, {
      who: {
        userId,
        userRole,
        ipAddress: context?.ipAddress,
        sessionId: context?.sessionId
      },
      what: {
        category: "rule_execution",
        action: "execute",
        resourceType: "ClinicalRule",
        resourceId: rule.id,
        resourceName: rule.name,
        description: `Executed clinical rule: ${rule.name} (${rule.domain})`
      },
      why: {
        reason: execution.triggeredBy === "scheduler" 
          ? "Scheduled rule execution" 
          : execution.triggeredBy === "event" 
            ? "Event-triggered execution" 
            : "Manual rule execution",
        ruleId: rule.id,
        triggeredBy: execution.triggeredBy,
        automatedAction: execution.triggeredBy !== "manual"
      },
      result: {
        success: execution.success,
        duration_ms: execution.duration_ms,
        errorMessage: execution.errorMessage
      },
      context: context || {},
      severity: execution.success ? "info" : "error",
      tags: ["clinical", "rule", rule.domain],
      phiAccessed: true,
      complianceFlags: ["HIPAA", "NO-CDS"],
      metadata: {
        patientsAffected: execution.patientsAffected,
        tasksGenerated: execution.tasksGenerated
      }
    });
  }

  async logAIPrediction(
    userId: string,
    userRole: string,
    model: { id: string; name: string; version: string },
    prediction: {
      inputType: string;
      outputType: string;
      recordsProcessed?: number;
      duration_ms: number;
      success: boolean;
      errorMessage?: string;
      confidenceScore?: number;
    },
    context?: AuditContext
  ): Promise<AuditEntry> {
    return this.logAuditEntry(userId, {
      who: {
        userId,
        userRole,
        ipAddress: context?.ipAddress,
        sessionId: context?.sessionId
      },
      what: {
        category: "ai_prediction",
        action: "prediction",
        resourceType: "AIModel",
        resourceId: model.id,
        resourceName: model.name,
        description: `AI prediction using model: ${model.name} v${model.version}`
      },
      why: {
        reason: "AI-powered analysis request",
        triggeredBy: userRole === "system" ? "automated" : "manual",
        automatedAction: userRole === "system"
      },
      result: {
        success: prediction.success,
        duration_ms: prediction.duration_ms,
        errorMessage: prediction.errorMessage
      },
      context: context || {},
      severity: prediction.success ? "info" : "error",
      tags: ["ai", "prediction", model.name],
      phiAccessed: true,
      complianceFlags: ["HIPAA", "NO-CDS"],
      metadata: {
        modelVersion: model.version,
        inputType: prediction.inputType,
        outputType: prediction.outputType,
        recordsProcessed: prediction.recordsProcessed,
        confidenceScore: prediction.confidenceScore
      }
    });
  }

  async logAccessControlAction(
    userId: string,
    userRole: string,
    action: AuditActionType,
    target: { type: string; id: string; name?: string },
    details: {
      description: string;
      decision?: "allowed" | "denied";
      reason?: string;
      success: boolean;
    },
    context?: AuditContext
  ): Promise<AuditEntry> {
    return this.logAuditEntry(userId, {
      who: {
        userId,
        userRole,
        ipAddress: context?.ipAddress,
        sessionId: context?.sessionId
      },
      what: {
        category: "access_control",
        action,
        resourceType: target.type,
        resourceId: target.id,
        resourceName: target.name,
        description: details.description
      },
      why: {
        reason: details.reason,
        triggeredBy: "system",
        automatedAction: true
      },
      result: {
        success: details.success
      },
      context: context || {},
      severity: details.decision === "denied" ? "warning" : "info",
      tags: ["access_control", action, details.decision || "unknown"],
      phiAccessed: false,
      complianceFlags: ["HIPAA", "SOC2"],
      metadata: {
        decision: details.decision
      }
    });
  }

  async getAuditLogs(
    requesterId: string,
    filter?: AuditLogFilter
  ): Promise<{ logs: AuditEntry[]; total: number; hasMore: boolean }> {
    logPhiAccess({
      action: "read",
      userId: requesterId,
      resourceType: "AuditLog",
      details: `AUDIT_LOGS_QUERIED: filter=${JSON.stringify(filter || {})}`,
    });

    let logs = [...this.auditLogs];

    if (filter?.startDate) {
      const start = new Date(filter.startDate).getTime();
      logs = logs.filter(l => l.when.epochMs >= start);
    }

    if (filter?.endDate) {
      const end = new Date(filter.endDate).getTime();
      logs = logs.filter(l => l.when.epochMs <= end);
    }

    if (filter?.userId) {
      logs = logs.filter(l => l.who.userId === filter.userId);
    }

    if (filter?.userRole) {
      logs = logs.filter(l => l.who.userRole === filter.userRole);
    }

    if (filter?.category) {
      logs = logs.filter(l => l.what.category === filter.category);
    }

    if (filter?.action) {
      logs = logs.filter(l => l.what.action === filter.action);
    }

    if (filter?.resourceType) {
      logs = logs.filter(l => l.what.resourceType === filter.resourceType);
    }

    if (filter?.resourceId) {
      logs = logs.filter(l => l.what.resourceId === filter.resourceId);
    }

    if (filter?.severity) {
      logs = logs.filter(l => l.severity === filter.severity);
    }

    if (filter?.success !== undefined) {
      logs = logs.filter(l => l.result.success === filter.success);
    }

    if (filter?.phiAccessed !== undefined) {
      logs = logs.filter(l => l.phiAccessed === filter.phiAccessed);
    }

    if (filter?.tags && filter.tags.length > 0) {
      logs = logs.filter(l => 
        filter.tags!.some(tag => l.tags.includes(tag))
      );
    }

    if (filter?.searchText) {
      const search = filter.searchText.toLowerCase();
      logs = logs.filter(l =>
        l.what.description.toLowerCase().includes(search) ||
        l.what.resourceName?.toLowerCase().includes(search) ||
        l.who.userName?.toLowerCase().includes(search) ||
        l.why.reason?.toLowerCase().includes(search)
      );
    }

    const sortBy = filter?.sortBy || "timestamp";
    const sortOrder = filter?.sortOrder || "desc";
    logs.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "timestamp") {
        comparison = a.when.epochMs - b.when.epochMs;
      } else if (sortBy === "severity") {
        const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
        comparison = severityOrder[a.severity] - severityOrder[b.severity];
      } else if (sortBy === "category") {
        comparison = a.what.category.localeCompare(b.what.category);
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    const total = logs.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    const paginatedLogs = logs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total,
      hasMore: offset + limit < total
    };
  }

  async getAuditLogById(
    requesterId: string,
    logId: string
  ): Promise<AuditEntry | null> {
    const log = this.auditLogs.find(l => l.id === logId);

    if (log) {
      logPhiAccess({
        action: "read",
        userId: requesterId,
        resourceType: "AuditLog",
        resourceId: logId,
        details: `AUDIT_LOG_VIEWED: ${log.what.category}/${log.what.action}`,
      });
    }

    return log || null;
  }

  async getAuditStatistics(
    requesterId: string,
    filter?: { startDate?: string; endDate?: string }
  ): Promise<AuditStatistics> {
    logPhiAccess({
      action: "read",
      userId: requesterId,
      resourceType: "AuditStatistics",
      details: `AUDIT_STATISTICS_QUERIED: ${JSON.stringify(filter || {})}`,
    });

    let logs = [...this.auditLogs];

    if (filter?.startDate) {
      const start = new Date(filter.startDate).getTime();
      logs = logs.filter(l => l.when.epochMs >= start);
    }

    if (filter?.endDate) {
      const end = new Date(filter.endDate).getTime();
      logs = logs.filter(l => l.when.epochMs <= end);
    }

    const byCategory: Record<AuditActionCategory, number> = {
      data_source: 0, configuration: 0, rule_execution: 0, ai_prediction: 0,
      user_management: 0, access_control: 0, patient_record: 0, system_event: 0,
      integration: 0, export: 0
    };

    const byAction: Record<AuditActionType, number> = {
      create: 0, read: 0, update: 0, delete: 0, execute: 0, configure: 0,
      approve: 0, reject: 0, export: 0, import: 0, connect: 0, disconnect: 0,
      login: 0, logout: 0, prediction: 0, validation: 0, error: 0
    };

    const bySeverity: Record<AuditSeverity, number> = {
      info: 0, warning: 0, error: 0, critical: 0
    };

    const userCounts: Record<string, number> = {};
    let successCount = 0;
    let errorCount = 0;
    let phiAccessCount = 0;

    for (const log of logs) {
      byCategory[log.what.category]++;
      byAction[log.what.action]++;
      bySeverity[log.severity]++;

      userCounts[log.who.userId] = (userCounts[log.who.userId] || 0) + 1;

      if (log.result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      if (log.phiAccessed) {
        phiAccessCount++;
      }
    }

    const byUser = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const timestamps = logs.map(l => l.when.epochMs);
    const start = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString();
    const end = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();

    return {
      totalLogs: logs.length,
      byCategory,
      byAction,
      bySeverity,
      byUser,
      successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 100,
      errorCount,
      phiAccessCount,
      timeRange: { start, end }
    };
  }

  async exportAuditLogs(
    requesterId: string,
    filter?: AuditLogFilter,
    format: "json" | "csv" = "json"
  ): Promise<{ data: string; filename: string; contentType: string }> {
    logPhiAccess({
      action: "export",
      userId: requesterId,
      resourceType: "AuditLog",
      details: `AUDIT_LOGS_EXPORTED: format=${format}`,
    });

    const { logs } = await this.getAuditLogs(requesterId, { ...filter, limit: 10000 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    if (format === "csv") {
      const headers = [
        "ID", "Timestamp", "User ID", "User Role", "Category", "Action",
        "Resource Type", "Resource ID", "Description", "Success", "Severity",
        "PHI Accessed", "Compliance Flags"
      ].join(",");

      const rows = logs.map(log => [
        log.id,
        log.timestamp,
        log.who.userId,
        log.who.userRole,
        log.what.category,
        log.what.action,
        log.what.resourceType,
        log.what.resourceId || "",
        `"${log.what.description.replace(/"/g, '""')}"`,
        log.result.success,
        log.severity,
        log.phiAccessed,
        (log.complianceFlags || []).join(";")
      ].join(","));

      return {
        data: [headers, ...rows].join("\n"),
        filename: `audit-logs-${timestamp}.csv`,
        contentType: "text/csv"
      };
    }

    return {
      data: JSON.stringify(logs, null, 2),
      filename: `audit-logs-${timestamp}.json`,
      contentType: "application/json"
    };
  }

  async getAlertConfigs(requesterId: string): Promise<AuditAlertConfig[]> {
    logPhiAccess({
      action: "read",
      userId: requesterId,
      resourceType: "AuditAlertConfig",
      details: "AUDIT_ALERT_CONFIGS_LISTED",
    });

    return [...this.alertConfigs];
  }

  async createAlertConfig(
    requesterId: string,
    config: Omit<AuditAlertConfig, "id" | "createdAt" | "updatedAt">
  ): Promise<AuditAlertConfig> {
    const now = new Date().toISOString();
    const newConfig: AuditAlertConfig = {
      ...config,
      id: `alert-${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };

    this.alertConfigs.push(newConfig);

    logPhiAccess({
      action: "write",
      userId: requesterId,
      resourceType: "AuditAlertConfig",
      resourceId: newConfig.id,
      details: `AUDIT_ALERT_CONFIG_CREATED: ${newConfig.name}`,
    });

    return newConfig;
  }

  async updateAlertConfig(
    requesterId: string,
    configId: string,
    updates: Partial<Omit<AuditAlertConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<AuditAlertConfig | null> {
    const index = this.alertConfigs.findIndex(c => c.id === configId);
    if (index === -1) return null;

    this.alertConfigs[index] = {
      ...this.alertConfigs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    logPhiAccess({
      action: "write",
      userId: requesterId,
      resourceType: "AuditAlertConfig",
      resourceId: configId,
      details: `AUDIT_ALERT_CONFIG_UPDATED: ${this.alertConfigs[index].name}`,
    });

    return this.alertConfigs[index];
  }

  async deleteAlertConfig(requesterId: string, configId: string): Promise<boolean> {
    const index = this.alertConfigs.findIndex(c => c.id === configId);
    if (index === -1) return false;

    const config = this.alertConfigs[index];
    this.alertConfigs.splice(index, 1);

    logPhiAccess({
      action: "delete",
      userId: requesterId,
      resourceType: "AuditAlertConfig",
      resourceId: configId,
      details: `AUDIT_ALERT_CONFIG_DELETED: ${config.name}`,
    });

    return true;
  }

  private async checkAlerts(entry: AuditEntry): Promise<void> {
    for (const config of this.alertConfigs) {
      if (!config.enabled) continue;

      let matches = true;

      if (config.conditions.category && config.conditions.category.length > 0) {
        matches = matches && config.conditions.category.includes(entry.what.category);
      }

      if (config.conditions.action && config.conditions.action.length > 0) {
        matches = matches && config.conditions.action.includes(entry.what.action);
      }

      if (config.conditions.severity && config.conditions.severity.length > 0) {
        matches = matches && config.conditions.severity.includes(entry.severity);
      }

      if (config.conditions.phiAccessed !== undefined) {
        matches = matches && entry.phiAccessed === config.conditions.phiAccessed;
      }

      if (matches) {
        console.log(`[AuditTrail] Alert triggered: ${config.name} for entry ${entry.id}`);
      }
    }
  }
}

export const comprehensiveAuditTrailService = new ComprehensiveAuditTrailService();
