import crypto from "crypto";
import { Request } from "express";
import { Logging, type Log, type Entry } from "@google-cloud/logging";

const PII_FIELDS = new Set([
  "name",
  "firstname",
  "lastname",
  "middlename",
  "email",
  "phone",
  "ssn",
  "mrn",
  "dob",
  "dateofbirth",
  "address",
  "streetaddress",
  "city",
  "zipcode",
  "postalcode",
  "clinical_notes",
  "clinicalnotes",
  "notes",
  "diagnosis",
  "medicationname",
  "insurance_id",
  "insuranceid",
  "policynumber",
  "subscribername",
  "beneficiary",
  "emergencycontact",
  "guardian",
  "password",
  "token",
  "secret",
  "authorization",
]);

function isPiiKey(key: string): boolean {
  return PII_FIELDS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

function hashForTracking(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (data instanceof Error) {
    return { message: data.message, stack: data.stack };
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isPiiKey(key)) {
      if (typeof value === "string" && value.length > 0) {
        masked[key] = `[MASKED:${hashForTracking(value)}]`;
      } else {
        masked[key] = "[MASKED]";
      }
    } else if (typeof value === "string" && value.startsWith("enc:")) {
      masked[key] = "[ENCRYPTED_PHI]";
    } else if (typeof value === "object" && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
export type LogCategory =
  | "phi_access"
  | "authentication"
  | "webhook"
  | "security"
  | "data_sync"
  | "audit"
  | "system"
  | "compliance"
  | "api";

interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  service: string;
  environment: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  patientId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  compliance?: {
    hipaaCategory?: string;
    phiAccessed?: boolean;
    minimumNecessary?: boolean;
    breakGlass?: boolean;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const GCP_SEVERITY_MAP: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  critical: "CRITICAL",
};

const LOG_BUFFER: StructuredLogEntry[] = [];
const MAX_BUFFER_SIZE = 5000;
const SERVICE_NAME = "tabula-medica";
const ENVIRONMENT = process.env.NODE_ENV || "development";

let gcpLog: Log | null = null;
let gcpEnabled = false;

function initGcpLogging() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID;
  if (!projectId) return;

  const rawCreds =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_KEY;
  const hasCredsFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawCreds && !hasCredsFile) {
    console.warn(
      "[Logger] GCP Cloud Logging skipped — no credentials in env (set GOOGLE_APPLICATION_CREDENTIALS_JSON or GCP_KEY to enable)",
    );
    return;
  }

  try {
    let credentials: { client_email: string; private_key: string } | undefined;
    if (rawCreds) {
      const parsed = JSON.parse(rawCreds);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error("missing client_email/private_key in service-account JSON");
      }
      credentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    }
    const logging = new Logging(
      credentials ? { projectId, credentials } : { projectId },
    );
    gcpLog = logging.log("tabula-medica-app-log");
    gcpEnabled = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Logger] GCP Cloud Logging init failed — console only (${msg})`);
    gcpLog = null;
    gcpEnabled = false;
  }
}

initGcpLogging();

// Last-line-of-defence for GCP-Logging-only failures.
// `@google-cloud/logging` can leak unhandled rejections from internal gax stub
// initialization that bypass our per-write `.catch()`. We swallow ONLY those
// and re-emit every other unhandled rejection so Node's default behavior
// (warning + non-zero exit code) is fully preserved for unrelated bugs.
const GCP_LOG_REJECTION_RE =
  /default credentials|getApplicationDefaultAsync|@google-cloud\/logging|GoogleAuth/i;

process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  if (gcpEnabled && GCP_LOG_REJECTION_RE.test(msg)) {
    console.warn(
      "[Logger] Disabling GCP Cloud Logging after auth failure — falling back to console-only",
    );
    gcpEnabled = false;
    gcpLog = null;
    return;
  }
  // Not ours — preserve Node's default unhandled-rejection semantics by
  // re-throwing on the next tick so the process exits as it normally would.
  console.error("[unhandledRejection]", reason);
  setImmediate(() => {
    throw reason instanceof Error ? reason : new Error(String(reason));
  });
});

function writeToGcp(entry: StructuredLogEntry) {
  if (!gcpEnabled || !gcpLog) return;

  try {
    const gcpEntry: Entry = gcpLog.entry(
      { severity: GCP_SEVERITY_MAP[entry.level] || "DEFAULT" },
      entry,
    );
    Promise.resolve(gcpLog.write(gcpEntry)).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/default credentials|GoogleAuth/i.test(msg)) {
        gcpEnabled = false;
        gcpLog = null;
        console.warn(
          "[Logger] GCP Cloud Logging auth failed — disabled for this process",
        );
      }
    });
  } catch {
    // never let logging crash the server
  }
}

function buildEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: Partial<StructuredLogEntry>,
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    ...details,
  };
  if (entry.metadata) {
    entry.metadata = maskSensitiveData(entry.metadata) as Record<string, unknown>;
  }
  return entry;
}

function emit(entry: StructuredLogEntry): void {
  const json = JSON.stringify(entry);

  switch (entry.level) {
    case "error":
    case "critical":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    case "debug":
      if (ENVIRONMENT === "development") console.log(json);
      else return;
      break;
    default:
      console.log(json);
  }

  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
    LOG_BUFFER.splice(0, LOG_BUFFER.length - Math.floor(MAX_BUFFER_SIZE / 2));
  }

  writeToGcp(entry);
}

function extractRequestContext(req: Request): Partial<StructuredLogEntry> {
  return {
    traceId: (req.headers["x-request-id"] as string) || undefined,
    userId: (req.headers["x-user-id"] as string) || undefined,
    ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    userAgent: req.headers["user-agent"] || undefined,
    httpMethod: req.method,
    httpPath: req.path,
  };
}

export const logger = {
  info(msg: string, meta?: unknown) {
    const maskedMeta = meta !== undefined ? maskSensitiveData(meta) : undefined;
    const entry = buildEntry("info", "system", msg, {
      metadata: maskedMeta as Record<string, unknown> | undefined,
    });
    emit(entry);
  },
  warn(msg: string, meta?: unknown) {
    const maskedMeta = meta !== undefined ? maskSensitiveData(meta) : undefined;
    const entry = buildEntry("warn", "system", msg, {
      metadata: maskedMeta as Record<string, unknown> | undefined,
    });
    emit(entry);
  },
  error(msg: string, meta?: unknown) {
    const maskedMeta = meta !== undefined ? maskSensitiveData(meta) : undefined;
    const entry = buildEntry("error", "system", msg, {
      metadata: maskedMeta as Record<string, unknown> | undefined,
    });
    emit(entry);
  },
  debug(msg: string, meta?: unknown) {
    const maskedMeta = meta !== undefined ? maskSensitiveData(meta) : undefined;
    const entry = buildEntry("debug", "system", msg, {
      metadata: maskedMeta as Record<string, unknown> | undefined,
    });
    emit(entry);
  },

  critical(
    category: LogCategory,
    message: string,
    err?: Error,
    meta?: Record<string, unknown>,
  ) {
    emit(
      buildEntry("critical", category, message, {
        metadata: meta,
        error: err
          ? { name: err.name, message: err.message, stack: err.stack }
          : undefined,
      }),
    );
  },

  phiAccess(
    req: Request,
    action: string,
    resourceType: string,
    resourceId?: string,
    options?: {
      patientId?: string;
      fieldsAccessed?: string[];
      hipaaCategory?: string;
      breakGlass?: boolean;
    },
  ) {
    emit(
      buildEntry("info", "phi_access", `PHI ${action}: ${resourceType}`, {
        ...extractRequestContext(req),
        action,
        resourceType,
        resourceId,
        patientId: options?.patientId,
        compliance: {
          hipaaCategory: options?.hipaaCategory || "treatment",
          phiAccessed: true,
          minimumNecessary: true,
          breakGlass: options?.breakGlass,
        },
        metadata: {
          fieldsAccessed: options?.fieldsAccessed,
        },
      }),
    );
  },

  webhookEvent(
    req: Request,
    source: string,
    eventType: string,
    status: "received" | "processed" | "rejected" | "duplicate",
    meta?: Record<string, unknown>,
  ) {
    const level: LogLevel = status === "rejected" ? "warn" : "info";
    emit(
      buildEntry(level, "webhook", `Webhook ${status}: ${source}/${eventType}`, {
        ...extractRequestContext(req),
        action: `webhook_${status}`,
        metadata: { source, eventType, ...meta },
      }),
    );
  },

  authEvent(
    req: Request,
    action: string,
    success: boolean,
    meta?: Record<string, unknown>,
  ) {
    const level: LogLevel = success ? "info" : "warn";
    emit(
      buildEntry(level, "authentication", `Auth ${action}: ${success ? "success" : "failure"}`, {
        ...extractRequestContext(req),
        action,
        metadata: { success, ...meta },
      }),
    );
  },

  securityAlert(
    message: string,
    severity: "low" | "medium" | "high" | "critical",
    meta?: Record<string, unknown>,
  ) {
    const level: LogLevel = severity === "critical" || severity === "high" ? "critical" : "warn";
    emit(
      buildEntry(level, "security", `[SECURITY-${severity.toUpperCase()}] ${message}`, {
        metadata: { severity, ...meta },
      }),
    );
  },

  apiRequest(
    req: Request,
    statusCode: number,
    durationMs: number,
    meta?: Record<string, unknown>,
  ) {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    emit(
      buildEntry(level, "api", `${req.method} ${req.path} ${statusCode} ${durationMs}ms`, {
        ...extractRequestContext(req),
        httpStatus: statusCode,
        durationMs,
        metadata: meta,
      }),
    );
  },

  complianceEvent(
    action: string,
    framework: "hipaa" | "soc2" | "hitrust",
    details: string,
    meta?: Record<string, unknown>,
  ) {
    emit(
      buildEntry("info", "compliance", `[${framework.toUpperCase()}] ${action}: ${details}`, {
        action,
        metadata: { framework, ...meta },
      }),
    );
  },
};

export function getRecentLogs(options?: {
  level?: LogLevel;
  category?: LogCategory;
  limit?: number;
  since?: Date;
}): StructuredLogEntry[] {
  let filtered: StructuredLogEntry[] = LOG_BUFFER;

  if (options?.level) {
    filtered = filtered.filter((e) => e.level === options.level);
  }
  if (options?.category) {
    filtered = filtered.filter((e) => e.category === options.category);
  }
  if (options?.since) {
    const sinceTime = options.since.getTime();
    filtered = filtered.filter(
      (e) => new Date(e.timestamp).getTime() >= sinceTime,
    );
  }

  const limit = options?.limit || 100;
  return filtered.slice(-limit);
}

export function getLogStats(): {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  errorsLast24h: number;
  phiAccessesLast24h: number;
} {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = LOG_BUFFER.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff,
  );

  const byLevel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const entry of recent) {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }

  return {
    total: LOG_BUFFER.length,
    byLevel,
    byCategory,
    errorsLast24h: recent.filter(
      (e) => e.level === "error" || e.level === "critical",
    ).length,
    phiAccessesLast24h: recent.filter((e) => e.category === "phi_access").length,
  };
}
