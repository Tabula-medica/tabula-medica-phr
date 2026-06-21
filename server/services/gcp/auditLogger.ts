import type { IAuditLogger, AuditLogEntry, IntegrationConfig } from "../integrations/interfaces";
import { randomUUID } from "crypto";

export class InMemoryAuditLogger implements IAuditLogger {
  readonly providerName = "in_memory";
  private logs: AuditLogEntry[] = [];
  private readonly maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    const fullEntry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.logs.push(fullEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (entry.phiAccessed) {
      console.log(
        `[AUDIT][PHI] User ${entry.userId} (${entry.userRole}) accessed ${entry.resourceType}${entry.resourceId ? `/${entry.resourceId}` : ""} for patient ${entry.patientId || "unknown"} - ${entry.action}`
      );
    }
  }

  async logPhiAccess(
    userId: string,
    userRole: string,
    patientId: string,
    resourceType: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      userId,
      userRole,
      action: "access",
      resourceType,
      patientId,
      ipAddress: "unknown",
      userAgent: "system",
      requestPath: `/api/${resourceType.toLowerCase()}`,
      requestMethod: "GET",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      accessReason: reason,
    });
  }

  async query(filters: {
    userId?: string;
    patientId?: string;
    resourceType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    phiAccessedOnly?: boolean;
  }): Promise<AuditLogEntry[]> {
    let results = [...this.logs];

    if (filters.userId) {
      results = results.filter((log) => log.userId === filters.userId);
    }
    if (filters.patientId) {
      results = results.filter((log) => log.patientId === filters.patientId);
    }
    if (filters.resourceType) {
      results = results.filter((log) => log.resourceType === filters.resourceType);
    }
    if (filters.action) {
      results = results.filter((log) => log.action === filters.action);
    }
    if (filters.startDate) {
      results = results.filter((log) => log.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter((log) => log.timestamp <= filters.endDate!);
    }
    if (filters.phiAccessedOnly) {
      results = results.filter((log) => log.phiAccessed);
    }

    return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getAccessReport(
    patientId: string,
    dateRange: { start: string; end: string }
  ): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    entries: AuditLogEntry[];
  }> {
    const entries = await this.query({
      patientId,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });

    const uniqueUsers = new Set(entries.map((e) => e.userId)).size;
    const byAction: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      byResourceType[entry.resourceType] = (byResourceType[entry.resourceType] || 0) + 1;
    }

    return {
      totalAccesses: entries.length,
      uniqueUsers,
      byAction,
      byResourceType,
      entries,
    };
  }
}

export class DatabaseAuditLogger implements IAuditLogger {
  readonly providerName = "database";
  private fallback: InMemoryAuditLogger;

  constructor() {
    this.fallback = new InMemoryAuditLogger();
    console.log("[AuditLogger] Database audit logger initialized (with in-memory fallback)");
  }

  async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    await this.fallback.log(entry);
  }

  async logPhiAccess(
    userId: string,
    userRole: string,
    patientId: string,
    resourceType: string,
    reason?: string
  ): Promise<void> {
    await this.fallback.logPhiAccess(userId, userRole, patientId, resourceType, reason);
  }

  async query(filters: {
    userId?: string;
    patientId?: string;
    resourceType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    phiAccessedOnly?: boolean;
  }): Promise<AuditLogEntry[]> {
    return this.fallback.query(filters);
  }

  async getAccessReport(
    patientId: string,
    dateRange: { start: string; end: string }
  ): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    entries: AuditLogEntry[];
  }> {
    return this.fallback.getAccessReport(patientId, dateRange);
  }
}

export class CloudLoggingAuditLogger implements IAuditLogger {
  readonly providerName = "cloud_logging";
  private fallback: InMemoryAuditLogger;
  private projectId: string;

  constructor(config: IntegrationConfig) {
    this.fallback = new InMemoryAuditLogger();
    this.projectId = config.gcp?.projectId || "";
    console.log(`[AuditLogger] Cloud Logging initialized for project: ${this.projectId}`);
  }

  async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    const fullEntry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    const severity = entry.phiAccessed ? "NOTICE" : "INFO";
    const logEntry = {
      severity,
      jsonPayload: {
        ...fullEntry,
        logType: "HIPAA_AUDIT",
        projectId: this.projectId,
      },
    };

    console.log(`[CloudLogging][${severity}]`, JSON.stringify(logEntry));

    await this.fallback.log(entry);
  }

  async logPhiAccess(
    userId: string,
    userRole: string,
    patientId: string,
    resourceType: string,
    reason?: string
  ): Promise<void> {
    console.log(
      `[CloudLogging][PHI_ACCESS] User: ${userId}, Role: ${userRole}, Patient: ${patientId}, Resource: ${resourceType}, Reason: ${reason || "not specified"}`
    );

    await this.fallback.logPhiAccess(userId, userRole, patientId, resourceType, reason);
  }

  async query(filters: {
    userId?: string;
    patientId?: string;
    resourceType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    phiAccessedOnly?: boolean;
  }): Promise<AuditLogEntry[]> {
    return this.fallback.query(filters);
  }

  async getAccessReport(
    patientId: string,
    dateRange: { start: string; end: string }
  ): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    entries: AuditLogEntry[];
  }> {
    return this.fallback.getAccessReport(patientId, dateRange);
  }
}

export function createAuditLogger(config: IntegrationConfig): IAuditLogger {
  switch (config.auditProvider) {
    case "cloud_logging":
      return new CloudLoggingAuditLogger(config);
    case "database":
      return new DatabaseAuditLogger();
    case "mock":
    default:
      return new InMemoryAuditLogger();
  }
}
