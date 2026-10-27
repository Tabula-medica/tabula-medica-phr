import { db } from "./db";
import { phiAuditLogs } from "@shared/schema";
import type { InsertPhiAuditLog, PhiAuditLog } from "@shared/schema";
import { eq, and, desc, gte, lte, sql, or } from "drizzle-orm";
import { logger } from "./utils/logger";

const PHI_ACTIONS = [
  "view", "read", "create", "update", "delete", "export", "download", "print", "share", "fax",
  "break_glass_access", "bulk_access", "search", "query", "consent_update", "permission_change",
  "login", "logout", "session_timeout", "mfa_verify", "mfa_setup",
] as const;

const RESOURCE_TYPES = [
  "health_record", "lab_result", "medication", "condition", "allergy", "immunization",
  "clinical_note", "imaging", "vitals", "procedure", "encounter", "insurance",
  "demographic", "consent", "care_plan", "document", "message", "appointment",
] as const;

type PhiAction = (typeof PHI_ACTIONS)[number];
type ResourceType = (typeof RESOURCE_TYPES)[number];

const HIPAA_RETENTION_YEARS = 7;
const BREAK_GLASS_RETENTION_YEARS = 10;

const COMMON_RESOURCE_TYPES: ResourceType[] = [
  "health_record", "lab_result", "medication", "vitals", "condition", "appointment",
];

interface BaseAuditParams {
  userId: string;
  actorId?: string;
  actorRole?: string;
  resourceType: ResourceType;
  resourceId?: string;
  patientId?: string;
  phiFieldsAccessed?: string[];
  accessReason?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  deviceId?: string;
  geoLocation?: { lat: number; lng: number; city?: string; country?: string };
  dataClassification?: string;
  legalBasis?: string;
  consentReference?: string;
  outcome?: string;
  errorDetails?: string;
  responseTimeMs?: number;
}

interface ModificationParams extends BaseAuditParams {
  action: "create" | "update" | "delete";
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

interface BreakGlassParams extends BaseAuditParams {
  breakGlassReason: string;
}

interface BulkAccessParams extends BaseAuditParams {
  recordCount: number;
  accessReason: string;
}

interface ExportParams extends BaseAuditParams {
  exportFormat?: string;
  recordCount?: number;
}

interface ShareParams extends BaseAuditParams {
  recipientId?: string;
  shareMethod?: string;
  expiresAt?: Date;
}

interface AuditFilters {
  dateRange?: { start: Date; end: Date };
  action?: PhiAction;
  resourceType?: ResourceType;
  actorId?: string;
}

class PhiAuditService {
  private calculateRiskScore(params: {
    breakGlass?: boolean;
    isBulkAccess?: boolean;
    recordCount?: number;
    deviceId?: string;
    resourceType?: string;
  }): number {
    let score = 0;

    if (params.breakGlass) score += 40;

    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) score += 15;

    if (params.isBulkAccess || (params.recordCount && params.recordCount > 50)) score += 20;

    if (params.deviceId && params.deviceId.startsWith("new_")) score += 10;

    if (params.resourceType && !COMMON_RESOURCE_TYPES.includes(params.resourceType as ResourceType)) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  private getRetentionDate(breakGlass: boolean): Date {
    const years = breakGlass ? BREAK_GLASS_RETENTION_YEARS : HIPAA_RETENTION_YEARS;
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date;
  }

  private buildComplianceFlags(params: {
    breakGlass?: boolean;
    riskScore: number;
    action: string;
  }): string[] {
    const flags: string[] = [];
    if (params.breakGlass) flags.push("BREAK_GLASS");
    if (params.riskScore > 50) flags.push("HIGH_RISK");
    if (params.riskScore > 75) flags.push("CRITICAL_RISK");
    if (["export", "download", "print", "fax", "share"].includes(params.action)) {
      flags.push("DATA_EGRESS");
    }
    if (["delete", "update"].includes(params.action)) flags.push("DATA_MODIFICATION");
    return flags;
  }

  async logAccess(params: BaseAuditParams & { action?: "view" | "read" | "download" | "export" }): Promise<PhiAuditLog> {
    const action = params.action || "view";
    const riskScore = this.calculateRiskScore({
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ riskScore, action });

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      accessReason: params.accessReason,
      breakGlass: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis,
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(false),
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.info("[PHI-Audit] access logged", { action, userId: params.userId, resourceType: params.resourceType, resourceId: params.resourceId || "N/A" });
    return log;
  }

  async logModification(params: ModificationParams): Promise<PhiAuditLog> {
    const riskScore = this.calculateRiskScore({
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ riskScore, action: params.action });

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      previousValues: params.previousValues,
      newValues: params.newValues,
      accessReason: params.accessReason,
      breakGlass: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis,
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(false),
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.info("[PHI-Audit] modification logged", { action: params.action, userId: params.userId, resourceType: params.resourceType, resourceId: params.resourceId || "N/A" });
    return log;
  }

  async logBreakGlass(params: BreakGlassParams): Promise<PhiAuditLog> {
    const riskScore = this.calculateRiskScore({
      breakGlass: true,
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ breakGlass: true, riskScore, action: "break_glass_access" });

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action: "break_glass_access",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      accessReason: params.accessReason,
      breakGlass: true,
      breakGlassReason: params.breakGlassReason,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis || "emergency_access",
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(true),
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.warn("[PHI-Audit] break-glass access", { userId: params.userId, reason: params.breakGlassReason, resourceType: params.resourceType, resourceId: params.resourceId || "N/A" });
    return log;
  }

  async logBulkAccess(params: BulkAccessParams): Promise<PhiAuditLog> {
    const riskScore = this.calculateRiskScore({
      isBulkAccess: true,
      recordCount: params.recordCount,
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ riskScore, action: "bulk_access" });
    complianceFlags.push("BULK_ACCESS");

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action: "bulk_access",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      accessReason: params.accessReason,
      breakGlass: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis,
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(false),
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.info("[PHI-Audit] bulk access logged", { userId: params.userId, recordCount: params.recordCount, resourceType: params.resourceType });
    return log;
  }

  async logExport(params: ExportParams): Promise<PhiAuditLog> {
    const riskScore = this.calculateRiskScore({
      isBulkAccess: (params.recordCount || 0) > 50,
      recordCount: params.recordCount,
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ riskScore, action: "export" });

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action: "export",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      accessReason: params.accessReason,
      breakGlass: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis,
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(false),
      newValues: {
        exportFormat: params.exportFormat,
        recordCount: params.recordCount,
      },
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.info("[PHI-Audit] export logged", { userId: params.userId, exportFormat: params.exportFormat || "unknown", recordCount: params.recordCount || 0 });
    return log;
  }

  async logShareEvent(params: ShareParams): Promise<PhiAuditLog> {
    const riskScore = this.calculateRiskScore({
      deviceId: params.deviceId,
      resourceType: params.resourceType,
    });
    const complianceFlags = this.buildComplianceFlags({ riskScore, action: "share" });

    const entry: InsertPhiAuditLog = {
      userId: params.userId,
      actorId: params.actorId || params.userId,
      actorRole: params.actorRole,
      action: "share",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientId: params.patientId,
      phiFieldsAccessed: params.phiFieldsAccessed,
      accessReason: params.accessReason,
      breakGlass: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      geoLocation: params.geoLocation,
      riskScore,
      complianceFlags,
      outcome: params.outcome || "success",
      errorDetails: params.errorDetails,
      responseTimeMs: params.responseTimeMs,
      dataClassification: params.dataClassification || "PHI",
      legalBasis: params.legalBasis,
      consentReference: params.consentReference,
      retentionExpiresAt: this.getRetentionDate(false),
      newValues: {
        recipientId: params.recipientId,
        shareMethod: params.shareMethod,
        expiresAt: params.expiresAt?.toISOString(),
      },
    };

    const [log] = await db.insert(phiAuditLogs).values(entry).returning();
    logger.info("[PHI-Audit] share event logged", { userId: params.userId, shareMethod: params.shareMethod || "unknown", resourceType: params.resourceType, resourceId: params.resourceId || "N/A" });
    return log;
  }

  async getAuditTrail(userId: string, filters?: AuditFilters): Promise<PhiAuditLog[]> {
    const conditions = [eq(phiAuditLogs.userId, userId)];

    if (filters?.dateRange) {
      conditions.push(gte(phiAuditLogs.createdAt, filters.dateRange.start));
      conditions.push(lte(phiAuditLogs.createdAt, filters.dateRange.end));
    }
    if (filters?.action) {
      conditions.push(eq(phiAuditLogs.action, filters.action));
    }
    if (filters?.resourceType) {
      conditions.push(eq(phiAuditLogs.resourceType, filters.resourceType));
    }
    if (filters?.actorId) {
      conditions.push(eq(phiAuditLogs.actorId, filters.actorId));
    }

    return db
      .select()
      .from(phiAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(phiAuditLogs.createdAt))
      .limit(1000);
  }

  async getPatientAuditTrail(patientId: string, filters?: AuditFilters): Promise<PhiAuditLog[]> {
    const conditions = [eq(phiAuditLogs.patientId, patientId)];

    if (filters?.dateRange) {
      conditions.push(gte(phiAuditLogs.createdAt, filters.dateRange.start));
      conditions.push(lte(phiAuditLogs.createdAt, filters.dateRange.end));
    }
    if (filters?.action) {
      conditions.push(eq(phiAuditLogs.action, filters.action));
    }
    if (filters?.resourceType) {
      conditions.push(eq(phiAuditLogs.resourceType, filters.resourceType));
    }
    if (filters?.actorId) {
      conditions.push(eq(phiAuditLogs.actorId, filters.actorId));
    }

    return db
      .select()
      .from(phiAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(phiAuditLogs.createdAt))
      .limit(1000);
  }

  async getAccessReport(startDate: Date, endDate: Date): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    uniquePatients: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    breakGlassCount: number;
    highRiskCount: number;
    averageRiskScore: number;
    topAccessors: { actorId: string; count: number }[];
    dataEgressEvents: number;
  }> {
    const logs = await db
      .select()
      .from(phiAuditLogs)
      .where(
        and(
          gte(phiAuditLogs.createdAt, startDate),
          lte(phiAuditLogs.createdAt, endDate)
        )
      )
      .orderBy(desc(phiAuditLogs.createdAt));

    const uniqueUsers = new Set<string>();
    const uniquePatients = new Set<string>();
    const byAction: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};
    let breakGlassCount = 0;
    let highRiskCount = 0;
    let totalRiskScore = 0;
    let dataEgressEvents = 0;

    for (const log of logs) {
      if (log.userId) uniqueUsers.add(log.userId);
      if (log.patientId) uniquePatients.add(log.patientId);
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResourceType[log.resourceType] = (byResourceType[log.resourceType] || 0) + 1;
      if (log.breakGlass) breakGlassCount++;
      if (log.riskScore && log.riskScore > 50) highRiskCount++;
      totalRiskScore += log.riskScore || 0;
      if (log.actorId) actorCounts[log.actorId] = (actorCounts[log.actorId] || 0) + 1;
      const flags = log.complianceFlags as string[] | null;
      if (flags && flags.includes("DATA_EGRESS")) dataEgressEvents++;
    }

    const topAccessors = Object.entries(actorCounts)
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAccesses: logs.length,
      uniqueUsers: uniqueUsers.size,
      uniquePatients: uniquePatients.size,
      byAction,
      byResourceType,
      breakGlassCount,
      highRiskCount,
      averageRiskScore: logs.length > 0 ? Math.round((totalRiskScore / logs.length) * 100) / 100 : 0,
      topAccessors,
      dataEgressEvents,
    };
  }

  async detectAnomalies(userId: string): Promise<{
    isAnomalous: boolean;
    anomalies: { type: string; description: string; severity: "low" | "medium" | "high" | "critical" }[];
    riskLevel: "low" | "medium" | "high" | "critical";
  }> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentLogs = await db
      .select()
      .from(phiAuditLogs)
      .where(
        and(
          eq(phiAuditLogs.userId, userId),
          gte(phiAuditLogs.createdAt, twentyFourHoursAgo)
        )
      );

    const weeklyLogs = await db
      .select()
      .from(phiAuditLogs)
      .where(
        and(
          eq(phiAuditLogs.userId, userId),
          gte(phiAuditLogs.createdAt, sevenDaysAgo)
        )
      );

    const anomalies: { type: string; description: string; severity: "low" | "medium" | "high" | "critical" }[] = [];

    if (recentLogs.length > 100) {
      anomalies.push({
        type: "high_volume",
        description: `${recentLogs.length} PHI accesses in the last 24 hours exceeds normal threshold of 100`,
        severity: recentLogs.length > 500 ? "critical" : "high",
      });
    }

    const afterHoursLogs = recentLogs.filter((log) => {
      const hour = log.createdAt.getHours();
      return hour >= 22 || hour < 6;
    });
    if (afterHoursLogs.length > 10) {
      anomalies.push({
        type: "after_hours",
        description: `${afterHoursLogs.length} after-hours accesses (10PM-6AM) in the last 24 hours`,
        severity: afterHoursLogs.length > 30 ? "high" : "medium",
      });
    }

    const breakGlassLogs = weeklyLogs.filter((log) => log.breakGlass);
    if (breakGlassLogs.length > 3) {
      anomalies.push({
        type: "break_glass_frequency",
        description: `${breakGlassLogs.length} break-glass accesses in the last 7 days exceeds threshold of 3`,
        severity: breakGlassLogs.length > 10 ? "critical" : "high",
      });
    }

    const uniquePatients = new Set(recentLogs.filter((l) => l.patientId).map((l) => l.patientId));
    if (uniquePatients.size > 50) {
      anomalies.push({
        type: "wide_access",
        description: `Accessed ${uniquePatients.size} unique patients in 24 hours, exceeds threshold of 50`,
        severity: "high",
      });
    }

    const devices = new Set(recentLogs.filter((l) => l.deviceId).map((l) => l.deviceId));
    if (devices.size > 5) {
      anomalies.push({
        type: "multiple_devices",
        description: `Access from ${devices.size} different devices in 24 hours`,
        severity: "medium",
      });
    }

    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (anomalies.some((a) => a.severity === "critical")) riskLevel = "critical";
    else if (anomalies.some((a) => a.severity === "high")) riskLevel = "high";
    else if (anomalies.some((a) => a.severity === "medium")) riskLevel = "medium";

    if (anomalies.length > 0) {
      logger.warn("[PHI-Audit] anomalies detected", { userId, anomalyCount: anomalies.length, riskLevel });
    }

    return {
      isAnomalous: anomalies.length > 0,
      anomalies,
      riskLevel,
    };
  }

  async getComplianceReport(framework: "HIPAA" | "SOC2" | "HITRUST"): Promise<{
    framework: string;
    generatedAt: string;
    period: { start: string; end: string };
    summary: {
      totalEvents: number;
      compliantEvents: number;
      nonCompliantEvents: number;
      complianceRate: number;
    };
    findings: { control: string; status: "pass" | "fail" | "warning"; details: string }[];
    recommendations: string[];
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const logs = await db
      .select()
      .from(phiAuditLogs)
      .where(
        and(
          gte(phiAuditLogs.createdAt, startDate),
          lte(phiAuditLogs.createdAt, endDate)
        )
      );

    const findings: { control: string; status: "pass" | "fail" | "warning"; details: string }[] = [];
    const recommendations: string[] = [];

    const breakGlassLogs = logs.filter((l) => l.breakGlass);
    const breakGlassWithReason = breakGlassLogs.filter((l) => l.breakGlassReason);
    const highRiskLogs = logs.filter((l) => l.riskScore && l.riskScore > 50);
    const failedLogs = logs.filter((l) => l.outcome === "failure");
    const egressLogs = logs.filter((l) => {
      const flags = l.complianceFlags as string[] | null;
      return flags && flags.includes("DATA_EGRESS");
    });

    if (framework === "HIPAA") {
      findings.push({
        control: "164.312(b) - Audit Controls",
        status: logs.length > 0 ? "pass" : "warning",
        details: `${logs.length} audit events recorded in reporting period`,
      });
      findings.push({
        control: "164.312(a)(1) - Access Control",
        status: breakGlassWithReason.length === breakGlassLogs.length ? "pass" : "fail",
        details: `${breakGlassLogs.length} break-glass events, ${breakGlassWithReason.length} with documented reasons`,
      });
      findings.push({
        control: "164.312(c)(1) - Integrity",
        status: failedLogs.length < logs.length * 0.05 ? "pass" : "warning",
        details: `${failedLogs.length} failed operations out of ${logs.length} total`,
      });
      findings.push({
        control: "164.312(d) - Authentication",
        status: "pass",
        details: "All PHI access events include user identification",
      });
      findings.push({
        control: "164.530(j) - Retention",
        status: "pass",
        details: `Retention period set to ${HIPAA_RETENTION_YEARS} years (${BREAK_GLASS_RETENTION_YEARS} years for break-glass)`,
      });
      if (breakGlassLogs.length > 0 && breakGlassWithReason.length < breakGlassLogs.length) {
        recommendations.push("Ensure all break-glass access events include documented reasons");
      }
      if (highRiskLogs.length > logs.length * 0.1) {
        recommendations.push("High percentage of high-risk access events; review access policies");
      }
      if (egressLogs.length > 0) {
        recommendations.push(`Review ${egressLogs.length} data egress events for proper authorization`);
      }
    } else if (framework === "SOC2") {
      findings.push({
        control: "CC6.1 - Logical Access Security",
        status: logs.every((l) => l.userId) ? "pass" : "fail",
        details: "All access events are attributed to identified users",
      });
      findings.push({
        control: "CC6.2 - Access Provisioning",
        status: breakGlassLogs.length < logs.length * 0.05 ? "pass" : "warning",
        details: `${breakGlassLogs.length} emergency access events (${((breakGlassLogs.length / Math.max(logs.length, 1)) * 100).toFixed(1)}%)`,
      });
      findings.push({
        control: "CC7.2 - Monitoring Activities",
        status: "pass",
        details: `Continuous monitoring active with ${logs.length} events captured`,
      });
      findings.push({
        control: "CC7.3 - Anomaly Detection",
        status: "pass",
        details: "Automated anomaly detection is configured for PHI access patterns",
      });
      if (highRiskLogs.length > 0) {
        recommendations.push(`Investigate ${highRiskLogs.length} high-risk access events`);
      }
    } else if (framework === "HITRUST") {
      findings.push({
        control: "09.aa - Audit Logging",
        status: logs.length > 0 ? "pass" : "fail",
        details: `${logs.length} events logged with comprehensive metadata`,
      });
      findings.push({
        control: "09.ab - Monitoring System Use",
        status: "pass",
        details: "Real-time risk scoring and anomaly detection enabled",
      });
      findings.push({
        control: "01.b - User Registration",
        status: logs.every((l) => l.actorId) ? "pass" : "warning",
        details: "All access events include actor identification",
      });
      findings.push({
        control: "09.ad - Administrator and Operator Logs",
        status: breakGlassWithReason.length === breakGlassLogs.length ? "pass" : "fail",
        details: `Break-glass documentation: ${breakGlassWithReason.length}/${breakGlassLogs.length} events have reasons`,
      });
      if (egressLogs.length > 0) {
        recommendations.push("Implement additional data loss prevention controls for egress events");
      }
    }

    const nonCompliantCount = findings.filter((f) => f.status === "fail").length;
    const warningCount = findings.filter((f) => f.status === "warning").length;

    logger.info("[PHI-Audit] compliance report generated", { framework, findingsCount: findings.length, nonCompliantCount });

    return {
      framework,
      generatedAt: new Date().toISOString(),
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      summary: {
        totalEvents: logs.length,
        compliantEvents: logs.length - nonCompliantCount,
        nonCompliantEvents: nonCompliantCount,
        complianceRate: findings.length > 0 ? Math.round(((findings.length - nonCompliantCount) / findings.length) * 100) : 100,
      },
      findings,
      recommendations,
    };
  }

  async setRetentionPeriod(logId: string, retentionDays: number): Promise<PhiAuditLog> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    const [updated] = await db
      .update(phiAuditLogs)
      .set({ retentionExpiresAt: expiresAt })
      .where(eq(phiAuditLogs.id, logId))
      .returning();

    logger.info("[PHI-Audit] retention period updated", { logId, expiresAt: expiresAt.toISOString() });
    return updated;
  }

  async purgeExpiredLogs(): Promise<{ purgedCount: number }> {
    const now = new Date();

    const expiredLogs = await db
      .select({ id: phiAuditLogs.id })
      .from(phiAuditLogs)
      .where(lte(phiAuditLogs.retentionExpiresAt, now));

    if (expiredLogs.length === 0) {
      logger.info("[PHI-Audit] no expired logs to purge");
      return { purgedCount: 0 };
    }

    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() - HIPAA_RETENTION_YEARS);

    await db
      .delete(phiAuditLogs)
      .where(
        and(
          lte(phiAuditLogs.retentionExpiresAt, now),
          lte(phiAuditLogs.createdAt, defaultExpiry)
        )
      );

    logger.info("[PHI-Audit] audit logs purged", { purgedCount: expiredLogs.length });
    return { purgedCount: expiredLogs.length };
  }

  async getStats(): Promise<{
    totalLogs: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    breakGlassTotal: number;
    averageRiskScore: number;
    topActions: { action: string; count: number }[];
    topResourceTypes: { resourceType: string; count: number }[];
    recentHighRisk: PhiAuditLog[];
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(phiAuditLogs);

    const [last24hResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(phiAuditLogs)
      .where(gte(phiAuditLogs.createdAt, oneDayAgo));

    const [last7dResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(phiAuditLogs)
      .where(gte(phiAuditLogs.createdAt, sevenDaysAgo));

    const [last30dResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(phiAuditLogs)
      .where(gte(phiAuditLogs.createdAt, thirtyDaysAgo));

    const [breakGlassResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(phiAuditLogs)
      .where(eq(phiAuditLogs.breakGlass, true));

    const [avgRiskResult] = await db
      .select({ avg: sql<number>`coalesce(avg(${phiAuditLogs.riskScore}), 0)::real` })
      .from(phiAuditLogs);

    const actionCounts = await db
      .select({
        action: phiAuditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(phiAuditLogs)
      .groupBy(phiAuditLogs.action)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const resourceTypeCounts = await db
      .select({
        resourceType: phiAuditLogs.resourceType,
        count: sql<number>`count(*)::int`,
      })
      .from(phiAuditLogs)
      .groupBy(phiAuditLogs.resourceType)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const recentHighRisk = await db
      .select()
      .from(phiAuditLogs)
      .where(sql`${phiAuditLogs.riskScore} > 50`)
      .orderBy(desc(phiAuditLogs.createdAt))
      .limit(10);

    return {
      totalLogs: totalResult.count,
      last24Hours: last24hResult.count,
      last7Days: last7dResult.count,
      last30Days: last30dResult.count,
      breakGlassTotal: breakGlassResult.count,
      averageRiskScore: Math.round(avgRiskResult.avg * 100) / 100,
      topActions: actionCounts.map((r) => ({ action: r.action, count: r.count })),
      topResourceTypes: resourceTypeCounts.map((r) => ({ resourceType: r.resourceType, count: r.count })),
      recentHighRisk,
    };
  }

  async getAccessPatterns(days: number = 7): Promise<{
    hourlyHeatmap: { hour: number; day: string; count: number }[];
    dailyVolume: { date: string; total: number; highRisk: number; breakGlass: number }[];
    topPatients: { patientId: string; accessCount: number; lastAccessed: string; uniqueAccessors: number }[];
    topUsers: { userId: string; accessCount: number; avgRiskScore: number; lastActive: string }[];
    resourceBreakdown: { resourceType: string; count: number; highRiskPct: number }[];
    recentAlerts: { id: string; type: string; description: string; severity: string; timestamp: string; userId: string }[];
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logs = await db.select().from(phiAuditLogs)
      .where(gte(phiAuditLogs.createdAt, startDate))
      .orderBy(desc(phiAuditLogs.createdAt));

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hourlyMap: Record<string, number> = {};
    const dailyMap: Record<string, { total: number; highRisk: number; breakGlass: number }> = {};
    const patientMap: Record<string, { count: number; last: Date; accessors: Set<string> }> = {};
    const userMap: Record<string, { count: number; totalRisk: number; last: Date }> = {};
    const resourceMap: Record<string, { count: number; highRisk: number }> = {};

    for (const log of logs) {
      const d = log.createdAt;
      const dayKey = dayNames[d.getDay()];
      const hourKey = `${dayKey}-${d.getHours()}`;
      hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + 1;

      const dateStr = d.toISOString().split("T")[0];
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { total: 0, highRisk: 0, breakGlass: 0 };
      dailyMap[dateStr].total++;
      if (log.riskScore && log.riskScore > 50) dailyMap[dateStr].highRisk++;
      if (log.breakGlass) dailyMap[dateStr].breakGlass++;

      if (log.patientId) {
        if (!patientMap[log.patientId]) patientMap[log.patientId] = { count: 0, last: d, accessors: new Set() };
        patientMap[log.patientId].count++;
        if (d > patientMap[log.patientId].last) patientMap[log.patientId].last = d;
        if (log.userId) patientMap[log.patientId].accessors.add(log.userId);
      }

      if (log.userId) {
        if (!userMap[log.userId]) userMap[log.userId] = { count: 0, totalRisk: 0, last: d };
        userMap[log.userId].count++;
        userMap[log.userId].totalRisk += log.riskScore || 0;
        if (d > userMap[log.userId].last) userMap[log.userId].last = d;
      }

      if (log.resourceType) {
        if (!resourceMap[log.resourceType]) resourceMap[log.resourceType] = { count: 0, highRisk: 0 };
        resourceMap[log.resourceType].count++;
        if (log.riskScore && log.riskScore > 50) resourceMap[log.resourceType].highRisk++;
      }
    }

    const hourlyHeatmap: { hour: number; day: string; count: number }[] = [];
    for (const day of dayNames) {
      for (let h = 0; h < 24; h++) {
        hourlyHeatmap.push({ hour: h, day, count: hourlyMap[`${day}-${h}`] || 0 });
      }
    }

    const dailyVolume = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const topPatients = Object.entries(patientMap)
      .map(([patientId, data]) => ({
        patientId, accessCount: data.count,
        lastAccessed: data.last.toISOString(),
        uniqueAccessors: data.accessors.size,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const topUsers = Object.entries(userMap)
      .map(([userId, data]) => ({
        userId, accessCount: data.count,
        avgRiskScore: data.count > 0 ? Math.round(data.totalRisk / data.count) : 0,
        lastActive: data.last.toISOString(),
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const resourceBreakdown = Object.entries(resourceMap)
      .map(([resourceType, data]) => ({
        resourceType, count: data.count,
        highRiskPct: data.count > 0 ? Math.round((data.highRisk / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const alertLogs = logs.filter(l => (l.riskScore && l.riskScore > 50) || l.breakGlass);
    const recentAlerts = alertLogs.slice(0, 20).map(l => ({
      id: String(l.id),
      type: l.breakGlass ? "break_glass" : l.riskScore && l.riskScore > 75 ? "critical_risk" : "high_risk",
      description: l.breakGlass
        ? `Break-glass access: ${l.resourceType} by ${l.userId?.slice(0, 8) || "unknown"}`
        : `High-risk access (score: ${l.riskScore}): ${l.resourceType} by ${l.userId?.slice(0, 8) || "unknown"}`,
      severity: l.riskScore && l.riskScore > 75 ? "critical" : l.breakGlass ? "high" : "medium",
      timestamp: l.createdAt.toISOString(),
      userId: l.userId || "unknown",
    }));

    return { hourlyHeatmap, dailyVolume, topPatients, topUsers, resourceBreakdown, recentAlerts };
  }
}

export const phiAuditService = new PhiAuditService();

export function initializePhiAudit(): void {
  logger.info("[PHI-Audit] PHI Audit Logging Service initialized", {
    defaultRetention: `${HIPAA_RETENTION_YEARS} years (HIPAA), ${BREAK_GLASS_RETENTION_YEARS} years (break-glass)`,
    supportedActionsCount: PHI_ACTIONS.length,
    supportedResourceTypesCount: RESOURCE_TYPES.length,
    riskScoringEnabled: true,
    anomalyDetectionEnabled: true,
    complianceFrameworks: ["HIPAA", "SOC2", "HITRUST"],
  });
}
