import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getRequestId } from "./production-logger";
import { isPhiProtectedRoute } from "./tls-middleware";

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
const LOG_NAME = "tabula-medica-audit";
const PHI_LOG_NAME = "tabula-medica-phi-access";
const SECURITY_LOG_NAME = "tabula-medica-security";

let loggingClient: any = null;
let auditLog: any = null;
let phiLog: any = null;
let securityLog: any = null;
let gcpEnabled = false;

async function initGcpLogging(): Promise<boolean> {
  if (gcpEnabled) return true;
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !GCP_PROJECT) {
    console.log("[GCP Audit] No GCP credentials found — audit logs will use stdout only");
    return false;
  }

  try {
    const { Logging } = await import("@google-cloud/logging");
    loggingClient = new Logging({ projectId: GCP_PROJECT });
    auditLog = loggingClient.log(LOG_NAME);
    phiLog = loggingClient.log(PHI_LOG_NAME);
    securityLog = loggingClient.log(SECURITY_LOG_NAME);
    gcpEnabled = true;
    console.log(`[GCP Audit] Cloud Logging initialized (project: ${GCP_PROJECT})`);
    return true;
  } catch (err: any) {
    console.error("[GCP Audit] Failed to initialize Cloud Logging:", err?.message?.slice(0, 120));
    return false;
  }
}

initGcpLogging();

const PHI_FIELDS = new Set([
  "password", "ssn", "dob", "dateOfBirth", "mrn", "email", "phone",
  "address", "name", "firstName", "lastName", "birthDate", "token",
  "secret", "key", "authorization", "cookie", "creditCard",
]);

function sanitizeForLog(obj: Record<string, any> | undefined): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (PHI_FIELDS.has(lowerKey) || [...PHI_FIELDS].some(f => lowerKey.includes(f))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      sanitized[key] = "[TRUNCATED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function extractActorId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub || user?.sub || user?.id || "anonymous";
}

function classifyRiskLevel(req: Request, statusCode: number): "low" | "medium" | "high" | "critical" {
  const method = req.method;
  const path = req.path;
  const isPhi = isPhiProtectedRoute(path);

  if (statusCode === 401 || statusCode === 403) return "high";
  if (path.includes("break-glass") || path.includes("emergency-access")) return "critical";
  if (path.includes("export") || path.includes("bulk")) return "high";
  if (isPhi && (method === "DELETE" || method === "PUT" || method === "PATCH")) return "high";
  if (isPhi && method === "POST") return "medium";
  if (isPhi) return "medium";
  if (method === "DELETE") return "medium";
  return "low";
}

function determineSeverity(statusCode: number, riskLevel: string): string {
  if (statusCode >= 500) return "ERROR";
  if (statusCode === 401 || statusCode === 403) return "WARNING";
  if (riskLevel === "critical") return "CRITICAL";
  if (riskLevel === "high") return "WARNING";
  return "INFO";
}

interface AuditEntry {
  timestamp: string;
  requestId: string;
  actor: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userAgent: string;
  phiAccess: boolean;
  riskLevel: string;
  resourceType: string;
  queryParams: Record<string, any>;
}

function extractResourceType(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "api" && segments[1]) return segments[1];
  return "unknown";
}

let _gcpWriteWarned = false;
async function writeToGcp(logInstance: any, entry: any, severity: string): Promise<void> {
  if (!gcpEnabled || !logInstance) return;

  try {
    const metadata = {
      resource: { type: "global" },
      severity,
      labels: {
        app: "tabula-medica",
        environment: process.env.NODE_ENV || "development",
        risk_level: entry.riskLevel,
        phi_access: String(entry.phiAccess),
      },
    };

    const gcpEntry = logInstance.entry(metadata, entry);
    await logInstance.write(gcpEntry);
  } catch (err: any) {
    if (!_gcpWriteWarned) {
      console.warn("[GCP Audit] GCP write unavailable — logs going to stdout only:", err?.message?.slice(0, 100));
      _gcpWriteWarned = true;
    }
  }
}

export const gcpAuditMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on("finish", () => {
    if (req.path === "/" || req.path === "/health" || req.path === "/api/health") return;
    if (!req.path.startsWith("/api")) return;

    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const isPhi = isPhiProtectedRoute(req.path);
    const riskLevel = classifyRiskLevel(req, statusCode);
    const severity = determineSeverity(statusCode, riskLevel);

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      requestId: getRequestId(req),
      actor: extractActorId(req),
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: duration,
      ip: req.ip || req.socket?.remoteAddress || "unknown",
      userAgent: (req.headers["user-agent"] || "unknown").slice(0, 200),
      phiAccess: isPhi,
      riskLevel,
      resourceType: extractResourceType(req.path),
      queryParams: sanitizeForLog(req.query as Record<string, any>),
    };

    console.log(JSON.stringify({ _gcpAudit: true, ...entry }));

    const targetLog = isPhi ? phiLog : auditLog;
    writeToGcp(targetLog, entry, severity);

    if (statusCode === 401 || statusCode === 403) {
      const secEntry = {
        ...entry,
        eventType: statusCode === 401 ? "unauthorized_access" : "forbidden_access",
        alertLevel: "security_event",
      };
      console.log(JSON.stringify({ _securityEvent: true, ...secEntry }));
      writeToGcp(securityLog, secEntry, "WARNING");
    }
  });

  next();
};

export async function logSecurityEvent(event: {
  eventType: string;
  actor: string;
  details: Record<string, any>;
  riskLevel?: "low" | "medium" | "high" | "critical";
  ip?: string;
}): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
    riskLevel: event.riskLevel || "medium",
  };

  console.log(JSON.stringify({ _securityEvent: true, ...entry }));
  await writeToGcp(securityLog, entry as any, event.riskLevel === "critical" ? "CRITICAL" : "WARNING");
}

export async function logPhiAccess(event: {
  actor: string;
  action: "read" | "write" | "delete" | "export";
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  reason?: string;
  ip?: string;
}): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    phiAccess: true,
    riskLevel: event.action === "export" ? "high" : event.action === "delete" ? "high" : "medium",
    ...event,
  };

  console.log(JSON.stringify({ _phiAudit: true, ...entry }));
  await writeToGcp(phiLog, entry as any, "INFO");
}

export function getGcpAuditStatus(): {
  enabled: boolean;
  project: string | undefined;
  logs: string[];
} {
  return {
    enabled: gcpEnabled,
    project: GCP_PROJECT,
    logs: gcpEnabled ? [LOG_NAME, PHI_LOG_NAME, SECURITY_LOG_NAME] : [],
  };
}
