import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export type AuditEventCategory = 
  | "authentication"
  | "authorization"
  | "data_access"
  | "data_export"
  | "sharing"
  | "permissions"
  | "system"
  | "compliance";

export type AuditEventType =
  | "login"
  | "logout"
  | "login_failed"
  | "mfa_setup"
  | "mfa_verified"
  | "mfa_failed"
  | "session_created"
  | "session_revoked"
  | "session_expired"
  | "logout_all_devices"
  | "record_import"
  | "record_view"
  | "record_update"
  | "record_delete"
  | "record_export"
  | "bulk_export"
  | "share_link_created"
  | "share_link_viewed"
  | "share_link_revoked"
  | "share_link_expired"
  | "caregiver_added"
  | "caregiver_removed"
  | "caregiver_access_changed"
  | "permission_granted"
  | "permission_revoked"
  | "role_assigned"
  | "role_removed"
  | "consent_granted"
  | "consent_revoked"
  | "data_retention_applied"
  | "emergency_access"
  | "break_glass_access";

export interface AuditLogEntry {
  id: string;
  tenantId?: string;
  eventType: AuditEventType;
  category: AuditEventCategory;
  userId: string;
  userRole: string;
  targetUserId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  action: string;
  outcome: "success" | "failure" | "partial";
  ipAddress: string;
  ipAddressHash: string;
  userAgent: string;
  requestPath?: string;
  requestMethod?: string;
  details: Record<string, any>;
  phiAccessed: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  timestamp: string;
  immutableHash: string;
  previousHash?: string;
}

export interface AuditQueryFilters {
  tenantId?: string;
  userId?: string;
  eventType?: AuditEventType;
  category?: AuditEventCategory;
  targetResourceType?: string;
  targetResourceId?: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: string;
  phiAccessed?: boolean;
  limit?: number;
  offset?: number;
}

const auditLogs: AuditLogEntry[] = [];
let lastHash: string = crypto.createHash("sha256").update("genesis").digest("hex");

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function calculateImmutableHash(entry: Omit<AuditLogEntry, "immutableHash" | "previousHash">): string {
  const content = JSON.stringify({
    id: entry.id,
    eventType: entry.eventType,
    userId: entry.userId,
    timestamp: entry.timestamp,
    action: entry.action,
    outcome: entry.outcome,
    details: entry.details,
  });
  return hashValue(content + lastHash);
}

function categorizeEvent(eventType: AuditEventType): AuditEventCategory {
  if (["login", "logout", "login_failed", "mfa_setup", "mfa_verified", "mfa_failed", "session_created", "session_revoked", "session_expired", "logout_all_devices"].includes(eventType)) {
    return "authentication";
  }
  if (["permission_granted", "permission_revoked", "role_assigned", "role_removed", "emergency_access", "break_glass_access"].includes(eventType)) {
    return "authorization";
  }
  if (["record_import", "record_view", "record_update", "record_delete"].includes(eventType)) {
    return "data_access";
  }
  if (["record_export", "bulk_export"].includes(eventType)) {
    return "data_export";
  }
  if (["share_link_created", "share_link_viewed", "share_link_revoked", "share_link_expired"].includes(eventType)) {
    return "sharing";
  }
  if (["caregiver_added", "caregiver_removed", "caregiver_access_changed"].includes(eventType)) {
    return "permissions";
  }
  if (["consent_granted", "consent_revoked", "data_retention_applied"].includes(eventType)) {
    return "compliance";
  }
  return "system";
}

function calculateRiskLevel(eventType: AuditEventType, outcome: string, details: Record<string, any>): AuditLogEntry["riskLevel"] {
  if (["break_glass_access", "bulk_export", "login_failed"].includes(eventType)) {
    return "critical";
  }
  if (["emergency_access", "permission_granted", "role_assigned", "caregiver_added", "share_link_created"].includes(eventType)) {
    return "high";
  }
  if (["record_export", "record_delete", "caregiver_removed", "permission_revoked"].includes(eventType)) {
    return "medium";
  }
  return "low";
}

export async function logAuditEvent(params: {
  tenantId?: string;
  eventType: AuditEventType;
  userId: string;
  userRole: string;
  targetUserId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  action: string;
  outcome: "success" | "failure" | "partial";
  ipAddress: string;
  userAgent: string;
  requestPath?: string;
  requestMethod?: string;
  details?: Record<string, any>;
  phiAccessed?: boolean;
}): Promise<AuditLogEntry> {
  const now = new Date();
  const id = uuidv4();
  
  const category = categorizeEvent(params.eventType);
  const riskLevel = calculateRiskLevel(params.eventType, params.outcome, params.details || {});

  const entryWithoutHash: Omit<AuditLogEntry, "immutableHash" | "previousHash"> = {
    id,
    tenantId: params.tenantId,
    eventType: params.eventType,
    category,
    userId: params.userId,
    userRole: params.userRole,
    targetUserId: params.targetUserId,
    targetResourceType: params.targetResourceType,
    targetResourceId: params.targetResourceId,
    action: params.action,
    outcome: params.outcome,
    ipAddress: "[REDACTED]",
    ipAddressHash: hashValue(params.ipAddress),
    userAgent: params.userAgent.substring(0, 200),
    requestPath: params.requestPath,
    requestMethod: params.requestMethod,
    details: params.details || {},
    phiAccessed: params.phiAccessed || false,
    riskLevel,
    timestamp: now.toISOString(),
  };

  const immutableHash = calculateImmutableHash(entryWithoutHash);
  const previousHash = lastHash;
  lastHash = immutableHash;

  const entry: AuditLogEntry = {
    ...entryWithoutHash,
    immutableHash,
    previousHash,
  };

  auditLogs.push(entry);

  if (riskLevel === "critical" || riskLevel === "high") {
    console.log(`[HIPAA-AUDIT][${riskLevel.toUpperCase()}] ${params.eventType}: ${params.action} by ${params.userId}`);
  }

  return entry;
}

export async function queryAuditLogs(filters: AuditQueryFilters): Promise<{
  logs: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}> {
  let filtered = [...auditLogs];

  if (filters.tenantId) {
    filtered = filtered.filter(l => l.tenantId === filters.tenantId);
  }
  if (filters.userId) {
    filtered = filtered.filter(l => l.userId === filters.userId);
  }
  if (filters.eventType) {
    filtered = filtered.filter(l => l.eventType === filters.eventType);
  }
  if (filters.category) {
    filtered = filtered.filter(l => l.category === filters.category);
  }
  if (filters.targetResourceType) {
    filtered = filtered.filter(l => l.targetResourceType === filters.targetResourceType);
  }
  if (filters.targetResourceId) {
    filtered = filtered.filter(l => l.targetResourceId === filters.targetResourceId);
  }
  if (filters.riskLevel) {
    filtered = filtered.filter(l => l.riskLevel === filters.riskLevel);
  }
  if (filters.phiAccessed !== undefined) {
    filtered = filtered.filter(l => l.phiAccessed === filters.phiAccessed);
  }
  if (filters.startDate) {
    filtered = filtered.filter(l => new Date(l.timestamp) >= new Date(filters.startDate!));
  }
  if (filters.endDate) {
    filtered = filtered.filter(l => new Date(l.timestamp) <= new Date(filters.endDate!));
  }

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = filtered.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 100;

  const paginated = filtered.slice(offset, offset + limit);

  return {
    logs: paginated,
    total,
    hasMore: offset + limit < total,
  };
}

export async function getAuditReport(tenantId?: string): Promise<{
  summary: {
    totalEvents: number;
    byCategory: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byOutcome: Record<string, number>;
    phiAccessCount: number;
    last24Hours: number;
    last7Days: number;
  };
  recentHighRiskEvents: AuditLogEntry[];
  topUsers: Array<{ userId: string; eventCount: number }>;
}> {
  let logs = tenantId ? auditLogs.filter(l => l.tenantId === tenantId) : auditLogs;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const byCategory: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  let phiAccessCount = 0;
  let last24Hours = 0;
  let last7Days = 0;

  for (const log of logs) {
    byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    byRiskLevel[log.riskLevel] = (byRiskLevel[log.riskLevel] || 0) + 1;
    byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
    userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;

    if (log.phiAccessed) phiAccessCount++;

    const timestamp = new Date(log.timestamp);
    if (timestamp >= oneDayAgo) last24Hours++;
    if (timestamp >= sevenDaysAgo) last7Days++;
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, eventCount]) => ({ userId, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10);

  const recentHighRiskEvents = logs
    .filter(l => l.riskLevel === "critical" || l.riskLevel === "high")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return {
    summary: {
      totalEvents: logs.length,
      byCategory,
      byRiskLevel,
      byOutcome,
      phiAccessCount,
      last24Hours,
      last7Days,
    },
    recentHighRiskEvents,
    topUsers,
  };
}

export async function verifyAuditIntegrity(startId?: string, endId?: string): Promise<{
  valid: boolean;
  checkedCount: number;
  errors: Array<{ logId: string; error: string }>;
}> {
  const errors: Array<{ logId: string; error: string }> = [];
  let checkedCount = 0;

  let checking = !startId;
  let previousHash = crypto.createHash("sha256").update("genesis").digest("hex");

  for (const log of auditLogs) {
    if (startId && log.id === startId) checking = true;
    if (!checking) {
      previousHash = log.immutableHash;
      continue;
    }

    checkedCount++;

    if (log.previousHash && log.previousHash !== previousHash) {
      errors.push({
        logId: log.id,
        error: "Previous hash mismatch - chain integrity violated",
      });
    }

    previousHash = log.immutableHash;

    if (endId && log.id === endId) break;
  }

  return {
    valid: errors.length === 0,
    checkedCount,
    errors,
  };
}

export async function exportAuditLogs(
  filters: AuditQueryFilters,
  format: "json" | "csv"
): Promise<string> {
  const result = await queryAuditLogs({ ...filters, limit: 10000 });

  if (format === "csv") {
    const headers = [
      "id", "timestamp", "eventType", "category", "userId", "userRole",
      "targetResourceType", "targetResourceId", "action", "outcome", "riskLevel", "phiAccessed"
    ];
    
    const rows = result.logs.map(log => [
      log.id,
      log.timestamp,
      log.eventType,
      log.category,
      log.userId,
      log.userRole,
      log.targetResourceType || "",
      log.targetResourceId || "",
      log.action,
      log.outcome,
      log.riskLevel,
      log.phiAccessed ? "Yes" : "No",
    ]);

    return [
      headers.join(","),
      ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
  }

  return JSON.stringify(result.logs, null, 2);
}

export function logLoginEvent(userId: string, userRole: string, ipAddress: string, userAgent: string, success: boolean, details?: Record<string, any>) {
  return logAuditEvent({
    eventType: success ? "login" : "login_failed",
    userId,
    userRole,
    action: success ? "User logged in" : "Failed login attempt",
    outcome: success ? "success" : "failure",
    ipAddress,
    userAgent,
    details,
  });
}

export function logShareLinkEvent(
  eventType: "share_link_created" | "share_link_viewed" | "share_link_revoked" | "share_link_expired",
  userId: string,
  userRole: string,
  shareLinkId: string,
  ipAddress: string,
  userAgent: string,
  details?: Record<string, any>
) {
  const actionMap = {
    share_link_created: "Created share link",
    share_link_viewed: "Viewed shared content",
    share_link_revoked: "Revoked share link",
    share_link_expired: "Share link expired",
  };

  return logAuditEvent({
    eventType,
    userId,
    userRole,
    targetResourceType: "ShareLink",
    targetResourceId: shareLinkId,
    action: actionMap[eventType],
    outcome: "success",
    ipAddress,
    userAgent,
    phiAccessed: eventType === "share_link_viewed",
    details,
  });
}

export function logCaregiverEvent(
  eventType: "caregiver_added" | "caregiver_removed" | "caregiver_access_changed",
  userId: string,
  userRole: string,
  caregiverId: string,
  patientId: string,
  ipAddress: string,
  userAgent: string,
  details?: Record<string, any>
) {
  const actionMap = {
    caregiver_added: "Added caregiver access",
    caregiver_removed: "Removed caregiver access",
    caregiver_access_changed: "Changed caregiver permissions",
  };

  return logAuditEvent({
    eventType,
    userId,
    userRole,
    targetUserId: caregiverId,
    targetResourceType: "CaregiverRelationship",
    targetResourceId: patientId,
    action: actionMap[eventType],
    outcome: "success",
    ipAddress,
    userAgent,
    details,
  });
}

export function logExportEvent(
  userId: string,
  userRole: string,
  resourceType: string,
  resourceId: string,
  exportFormat: string,
  ipAddress: string,
  userAgent: string,
  recordCount: number
) {
  return logAuditEvent({
    eventType: recordCount > 100 ? "bulk_export" : "record_export",
    userId,
    userRole,
    targetResourceType: resourceType,
    targetResourceId: resourceId,
    action: `Exported ${recordCount} ${resourceType} records as ${exportFormat}`,
    outcome: "success",
    ipAddress,
    userAgent,
    phiAccessed: true,
    details: { format: exportFormat, recordCount },
  });
}
