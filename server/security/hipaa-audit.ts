import type { Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { isPhiProtectedRoute } from "./tls-middleware";
import { recordPhiAccess, recordBulkExport } from "./compliance-validator";

async function getUserRoleFromStorage(userId: string): Promise<string> {
  try {
    const user = await storage.getUser(userId);
    return user?.role || "patient";
  } catch {
    return "unknown";
  }
}

export interface PhiAccessLogEntry {
  userId: string;
  userRole: string;
  patientId?: string;
  resourceType: string;
  resourceId?: string;
  action: "read" | "write" | "delete" | "export";
  accessReason?: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  responseStatus?: number;
  responseTimeMs?: number;
  timestamp: string;
}

const PHI_RESOURCE_PATTERNS: Record<string, string> = {
  "/api/patients": "Patient",
  "/api/medications": "Medication",
  "/api/lab-results": "LabResult",
  "/api/conditions": "Condition",
  "/api/allergies": "Allergy",
  "/api/documents": "Document",
  "/api/vitals": "VitalSign",
  "/api/appointments": "Appointment",
  "/api/messages": "SecureMessage",
  "/api/fhir": "FhirResource",
  "/api/caregivers": "CaregiverRelationship",
  "/api/deidentification": "DeidentifiedData",
};

function determineAction(method: string): "read" | "write" | "delete" | "export" {
  switch (method.toUpperCase()) {
    case "POST":
    case "PUT":
    case "PATCH":
      return "write";
    case "DELETE":
      return "delete";
    default:
      return "read";
  }
}

function extractResourceInfo(path: string): { resourceType: string; resourceId?: string } {
  for (const [pattern, resourceType] of Object.entries(PHI_RESOURCE_PATTERNS)) {
    if (path.startsWith(pattern)) {
      const remaining = path.slice(pattern.length);
      const idMatch = remaining.match(/^\/([a-zA-Z0-9-]+)/);
      return {
        resourceType,
        resourceId: idMatch?.[1],
      };
    }
  }
  return { resourceType: "Unknown" };
}

function extractPatientId(req: Request): string | undefined {
  return (
    (req.params as Record<string, string>).patientId ||
    (req.query as Record<string, string>).patientId ||
    (req.body as Record<string, string>)?.patientId ||
    undefined
  );
}

export const phiAccessAuditMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!isPhiProtectedRoute(req.path)) {
    next();
    return;
  }

  const user = req.user as { claims?: { sub?: string } } | undefined;
  const userId = user?.claims?.sub;

  if (!userId) {
    next();
    return;
  }

  const startTime = Date.now();
  const { resourceType, resourceId } = extractResourceInfo(req.path);
  const action = determineAction(req.method);
  const patientId = extractPatientId(req);
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "Unknown";
  const userAgent = req.headers["user-agent"] || "Unknown";
  
  const userRole = (req as any).userRole || await getUserRoleFromStorage(userId);

  const originalSend = res.send.bind(res);
  res.send = function (body: string | Buffer) {
    const responseTime = Date.now() - startTime;

    logPhiAccess({
      userId,
      userRole,
      patientId,
      resourceType,
      resourceId,
      action,
      ipAddress,
      userAgent,
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus: res.statusCode,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("[HipaaAudit] Error logging PHI access:", err));

    try {
      recordPhiAccess(userId, resourceType);
      if (action === "export") {
        recordBulkExport(userId, 1, resourceType);
      }
    } catch {};

    return originalSend(body);
  };

  next();
};

export async function logPhiAccess(entry: Partial<PhiAccessLogEntry> & { userId: string; patientId?: string; resourceType: string; action: "read" | "write" | "delete" | "export"; details?: string }): Promise<void> {
  try {
    const eventType = entry.action === "read" ? "data_access" : entry.action === "export" ? "data_export" : "data_access";

    await storage.createSecurityAuditLog({
      userId: entry.userId,
      eventType,
      description: entry.details || `${entry.action.toUpperCase()} ${entry.resourceType}${entry.resourceId ? `/${entry.resourceId}` : ""}${entry.patientId ? ` for patient ${entry.patientId}` : ""}`,
      ipAddress: entry.ipAddress || "unknown",
      userAgent: entry.userAgent || "unknown",
      platform: "web",
      appVersion: "1.0.0",
      metadata: {
        userRole: entry.userRole || "unknown",
        resourceType: entry.resourceType,
        resourceId: entry.resourceId || "",
        patientId: entry.patientId || "",
        action: entry.action,
        requestPath: entry.requestPath || "",
        requestMethod: entry.requestMethod || "",
        responseStatus: String(entry.responseStatus || 0),
        responseTimeMs: String(entry.responseTimeMs || 0),
      },
    });
  } catch (error) {
    console.error("[HipaaAudit] Error logging PHI access:", error);
  }
}

export async function queryAuditLogs(filters: {
  userId?: string;
  patientId?: string;
  resourceType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<PhiAccessLogEntry[]> {
  const limit = filters.limit || 100;
  let logs = await storage.getSecurityAuditLogs(filters.userId || "", limit * 10);

  if (filters.patientId) {
    logs = logs.filter((log) => log.metadata?.patientId === filters.patientId);
  }
  if (filters.resourceType) {
    logs = logs.filter((log) => log.metadata?.resourceType === filters.resourceType);
  }
  if (filters.action) {
    logs = logs.filter((log) => log.metadata?.action === filters.action);
  }
  if (filters.startDate) {
    logs = logs.filter((log) => log.createdAt >= filters.startDate!);
  }
  if (filters.endDate) {
    logs = logs.filter((log) => log.createdAt <= filters.endDate!);
  }

  return logs.slice(0, limit).map((log) => ({
    userId: log.userId,
    userRole: log.metadata?.userRole || "unknown",
    patientId: log.metadata?.patientId,
    resourceType: log.metadata?.resourceType || "Unknown",
    resourceId: log.metadata?.resourceId,
    action: (log.metadata?.action as "read" | "write" | "delete" | "export") || "read",
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    requestPath: log.metadata?.requestPath || "",
    requestMethod: log.metadata?.requestMethod || "",
    responseStatus: parseInt(log.metadata?.responseStatus || "0"),
    responseTimeMs: parseInt(log.metadata?.responseTimeMs || "0"),
    timestamp: log.createdAt,
  }));
}

export async function getPatientAccessReport(
  patientId: string,
  dateRange: { start: string; end: string }
): Promise<{
  totalAccesses: number;
  uniqueUsers: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
  recentAccesses: PhiAccessLogEntry[];
}> {
  const logs = await queryAuditLogs({
    patientId,
    startDate: dateRange.start,
    endDate: dateRange.end,
    limit: 1000,
  });

  const uniqueUsers = new Set(logs.map((l) => l.userId)).size;
  const byAction: Record<string, number> = {};
  const byResourceType: Record<string, number> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byResourceType[log.resourceType] = (byResourceType[log.resourceType] || 0) + 1;
  }

  return {
    totalAccesses: logs.length,
    uniqueUsers,
    byAction,
    byResourceType,
    recentAccesses: logs.slice(0, 50),
  };
}

export function getAuditCompliance(): {
  phiAuditingEnabled: boolean;
  retentionDays: number;
  realTimeLogging: boolean;
  accessReporting: boolean;
} {
  return {
    phiAuditingEnabled: true,
    retentionDays: 2555,
    realTimeLogging: true,
    accessReporting: true,
  };
}

export async function logSecurityEvent(event: {
  userId: string;
  eventType: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await storage.createSecurityAuditLog({
      userId: event.userId,
      eventType: event.eventType as any,
      description: event.details,
      ipAddress: event.ipAddress || "unknown",
      userAgent: event.userAgent || "unknown",
      platform: "web",
      appVersion: "1.0.0",
      metadata: {},
    });
  } catch (error) {
    console.error("[HipaaAudit] Error logging security event:", error);
  }
}
