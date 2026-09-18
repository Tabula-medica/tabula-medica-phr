import { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { redactPath } from "./redact-path";

export interface StructuredLogEntry {
  timestamp: string;
  request_id: string;
  level: "debug" | "info" | "warn" | "error";
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  actor_id?: string;
  tenant_id?: string;
  error_code?: string;
  message: string;
  component?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  request_id: string;
  actor_id: string;
  tenant_id?: string;
  event_type: "record_viewed" | "record_exported" | "record_shared" | "record_created" | "record_updated" | "record_deleted" | "auth_success" | "auth_failure" | "consent_granted" | "consent_revoked";
  resource_type: string;
  resource_id?: string;
  patient_id?: string;
  outcome: "success" | "failure";
  details?: Record<string, string>;
}

const ALLOW_DEBUG_PAYLOADS = process.env.NODE_ENV === "development" && process.env.ENABLE_DEBUG_PAYLOADS === "true";

const PHI_FIELDS_NEVER_LOG = new Set([
  "name", "firstName", "lastName", "first_name", "last_name", "patientName", "patient_name",
  "fullName", "full_name", "givenName", "familyName", "given", "family",
  "dateOfBirth", "dob", "birthDate", "birth_date", "birthdate",
  "ssn", "socialSecurityNumber", "social_security_number",
  "address", "streetAddress", "street_address", "street", "city", "state", "zip", "zipCode", "zip_code", "postalCode",
  "phone", "phoneNumber", "phone_number", "mobile", "cell", "telephone", "fax",
  "email", "emailAddress", "email_address",
  "mrn", "medicalRecordNumber", "medical_record_number",
  "diagnosis", "diagnoses", "condition", "conditions", "dx",
  "medication", "medications", "drug", "drugs", "prescription", "prescriptions", "rx",
  "labValue", "lab_value", "labResult", "lab_result", "result", "value", "observation",
  "notes", "note", "clinicalNotes", "clinical_notes", "narrative", "text", "description",
  "document", "documentText", "document_text", "content", "body", "payload",
  "entry", "resource", "bundle", "fhirBundle", "fhir_bundle",
  "allergen", "allergy", "allergies",
  "procedure", "procedures", "surgery", "surgeries",
  "immunization", "immunizations", "vaccine", "vaccines",
  "vitals", "vital", "vitalSigns", "vital_signs",
  "insurance", "insuranceId", "insurance_id", "memberId", "member_id", "policyNumber", "policy_number",
  "photo", "image", "attachment", "binary",
]);

const requestIdSymbol = Symbol("requestId");

declare global {
  namespace Express {
    interface Request {
      [requestIdSymbol]?: string;
      requestId?: string;
    }
  }
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

export function getRequestId(req?: Request): string {
  return req?.requestId || req?.[requestIdSymbol] || "no-request-id";
}

export const requestCorrelationMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers["x-request-id"] as string;
  const requestId = existingId || generateRequestId();
  
  req.requestId = requestId;
  (req as any)[requestIdSymbol] = requestId;
  
  res.setHeader("x-request-id", requestId);
  
  next();
};

function isPhiField(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return PHI_FIELDS_NEVER_LOG.has(key) || PHI_FIELDS_NEVER_LOG.has(lowerKey);
}

function deepRedact(obj: unknown, depth: number = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    if (obj.length > 100) return "[REDACTED-LONG-STRING]";
    return obj;
  }
  
  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 10) return `[ARRAY-${obj.length}-ITEMS]`;
    return obj.map(item => deepRedact(item, depth + 1));
  }
  
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj);
    
    if (keys.length > 20) {
      return `[OBJECT-${keys.length}-KEYS]`;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (isPhiField(key)) {
        result[key] = "[PHI-REDACTED]";
      } else {
        result[key] = deepRedact(value, depth + 1);
      }
    }
    return result;
  }
  
  return "[UNKNOWN-TYPE]";
}

class ProductionLogger {
  private component: string;
  private isProduction: boolean;
  
  constructor(component: string) {
    this.component = component;
    this.isProduction = process.env.NODE_ENV === "production";
  }
  
  private formatLog(entry: StructuredLogEntry): string {
    return JSON.stringify(entry);
  }
  
  private createEntry(
    level: StructuredLogEntry["level"],
    message: string,
    req?: Request,
    extra?: Partial<StructuredLogEntry>
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      request_id: getRequestId(req),
      level,
      message,
      component: this.component,
      ...extra,
    };
    
    if (req) {
      entry.method = req.method;
      entry.path = redactPath(req.path);
      
      const user = req.user as { claims?: { sub?: string } } | undefined;
      if (user?.claims?.sub) {
        entry.actor_id = user.claims.sub;
      }
    }
    
    return entry;
  }
  
  debug(message: string, req?: Request, extra?: Partial<StructuredLogEntry>): void {
    if (this.isProduction) return;
    const entry = this.createEntry("debug", message, req, extra);
    console.log(this.formatLog(entry));
  }
  
  info(message: string, req?: Request, extra?: Partial<StructuredLogEntry>): void {
    const entry = this.createEntry("info", message, req, extra);
    console.log(this.formatLog(entry));
  }
  
  warn(message: string, req?: Request, extra?: Partial<StructuredLogEntry>): void {
    const entry = this.createEntry("warn", message, req, extra);
    console.warn(this.formatLog(entry));
  }
  
  error(message: string, errorCode?: string, req?: Request, extra?: Partial<StructuredLogEntry>): void {
    const entry = this.createEntry("error", message, req, {
      ...extra,
      error_code: errorCode,
    });
    console.error(this.formatLog(entry));
  }
  
  requestComplete(req: Request, res: Response, durationMs: number): void {
    const entry = this.createEntry("info", "Request completed", req, {
      status: res.statusCode,
      duration_ms: durationMs,
    });
    console.log(this.formatLog(entry));
  }
  
  debugPayload(message: string, payload: unknown, req?: Request): void {
    if (!ALLOW_DEBUG_PAYLOADS) return;
    
    const redacted = deepRedact(payload);
    const entry = this.createEntry("debug", message, req);
    console.log(this.formatLog(entry), "payload:", JSON.stringify(redacted));
  }
}

const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || "/tmp/audit_logs";
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, "hipaa_audit.jsonl");

function ensureAuditLogDir(): void {
  try {
    if (!fs.existsSync(AUDIT_LOG_DIR)) {
      fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    }
  } catch (e) {
  }
}

class AuditLogger {
  private static instance: AuditLogger;
  private logs: AuditLogEntry[] = [];
  private maxLogs = 10000;
  private writeStream: fs.WriteStream | null = null;
  
  private constructor() {
    ensureAuditLogDir();
    try {
      this.writeStream = fs.createWriteStream(AUDIT_LOG_FILE, { flags: "a" });
    } catch (e) {
      console.error("[AuditLogger] Failed to create audit log file stream");
    }
  }
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  private formatAuditLog(entry: AuditLogEntry): string {
    return JSON.stringify({ ...entry, log_type: "AUDIT" });
  }
  
  private writeToFile(logLine: string): void {
    if (this.writeStream) {
      this.writeStream.write(logLine + "\n");
    }
  }
  
  log(entry: Omit<AuditLogEntry, "timestamp">): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    
    const logLine = this.formatAuditLog(fullEntry);
    
    console.log(logLine);
    
    this.writeToFile(logLine);
    
    this.logs.push(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2);
    }
  }
  
  recordViewed(req: Request, resourceType: string, resourceId?: string, patientId?: string): void {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    this.log({
      request_id: getRequestId(req),
      actor_id: user?.claims?.sub || "anonymous",
      event_type: "record_viewed",
      resource_type: resourceType,
      resource_id: resourceId,
      patient_id: patientId,
      outcome: "success",
    });
  }
  
  recordExported(req: Request, resourceType: string, exportFormat: string, patientId?: string): void {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    this.log({
      request_id: getRequestId(req),
      actor_id: user?.claims?.sub || "anonymous",
      event_type: "record_exported",
      resource_type: resourceType,
      patient_id: patientId,
      outcome: "success",
      details: { format: exportFormat },
    });
  }
  
  recordShared(req: Request, resourceType: string, recipientType: string, patientId?: string): void {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    this.log({
      request_id: getRequestId(req),
      actor_id: user?.claims?.sub || "anonymous",
      event_type: "record_shared",
      resource_type: resourceType,
      patient_id: patientId,
      outcome: "success",
      details: { recipient_type: recipientType },
    });
  }
  
  authEvent(req: Request, success: boolean, method?: string): void {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    this.log({
      request_id: getRequestId(req),
      actor_id: user?.claims?.sub || "anonymous",
      event_type: success ? "auth_success" : "auth_failure",
      resource_type: "authentication",
      outcome: success ? "success" : "failure",
      details: method ? { method } : undefined,
    });
  }
  
  queryLogs(filters: {
    actor_id?: string;
    event_type?: AuditLogEntry["event_type"];
    patient_id?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.logs];
    
    if (filters.actor_id) {
      results = results.filter(l => l.actor_id === filters.actor_id);
    }
    if (filters.event_type) {
      results = results.filter(l => l.event_type === filters.event_type);
    }
    if (filters.patient_id) {
      results = results.filter(l => l.patient_id === filters.patient_id);
    }
    if (filters.startDate) {
      results = results.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter(l => l.timestamp <= filters.endDate!);
    }
    
    return results.slice(-(filters.limit || 100));
  }
  
  exportForPayers(startDate: string, endDate: string): AuditLogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= startDate && 
      log.timestamp <= endDate &&
      (log.event_type === "record_viewed" || 
       log.event_type === "record_exported" || 
       log.event_type === "record_shared")
    );
  }
}

export const requestLoggingMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const logger = createLogger("HTTP");
  
  const originalSend = res.send.bind(res);
  res.send = function(body: any) {
    const durationMs = Date.now() - startTime;
    logger.requestComplete(req, res, durationMs);
    return originalSend(body);
  };
  
  next();
};

export function createLogger(component: string): ProductionLogger {
  return new ProductionLogger(component);
}

export const auditLog = AuditLogger.getInstance();

export { ProductionLogger };
