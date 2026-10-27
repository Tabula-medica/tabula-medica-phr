import { Request } from "express";
import { storage } from "../storage";

export enum AuditAction {
  VIEW_PHI = "view_phi",
  CREATE_PHI = "create_phi",
  UPDATE_PHI = "update_phi",
  DELETE_PHI = "delete_phi",
  EXPORT_PHI = "export_phi",
  SHARE_PHI = "share_phi",
  PRINT_PHI = "print_phi",
  DOWNLOAD_PHI = "download_phi",
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  MFA_ENABLED = "mfa_enabled",
  MFA_DISABLED = "mfa_disabled",
  MFA_VERIFIED = "mfa_verified",
  MFA_FAILED = "mfa_failed",
  PASSWORD_CHANGED = "password_changed",
  ACCOUNT_CREATED = "account_created",
  ACCOUNT_DELETED = "account_deleted",
  CONSENT_GRANTED = "consent_granted",
  CONSENT_REVOKED = "consent_revoked",
  DATA_BREACH_DETECTED = "data_breach_detected",
  UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt",
  SESSION_TIMEOUT = "session_timeout",
  ENCRYPTION_KEY_ROTATED = "encryption_key_rotated",
}

export enum ResourceType {
  HEALTH_RECORD = "health_record",
  PATIENT_PROFILE = "patient_profile",
  MEDICATION = "medication",
  LAB_RESULT = "lab_result",
  IMAGING = "imaging",
  IMMUNIZATION = "immunization",
  ALLERGY = "allergy",
  VITAL_SIGN = "vital_sign",
  PROCEDURE = "procedure",
  VISIT = "visit",
  DATA_SOURCE = "data_source",
  SHARE_LINK = "share_link",
  USER_ACCOUNT = "user_account",
  CONSENT = "consent",
  AUDIT_LOG = "audit_log",
  FHIR_CONNECTION = "fhir_connection",
  CARE_PATHWAY = "care_pathway",
  HEALTH_GOAL = "health_goal",
}

export interface AuditContext {
  userId: string | null;
  sessionId?: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId?: string;
  correlationId?: string;
}

export interface PHIAccessDetails {
  fieldsAccessed?: string[];
  fieldsModified?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  accessReason?: string;
  accessDuration?: number;
  recordCount?: number;
  exportFormat?: string;
  shareRecipient?: string;
  shareExpiration?: Date;
}

export interface ComplianceMetadata {
  hipaaCategory?: "treatment" | "payment" | "operations" | "authorization" | "required_by_law";
  minimumNecessary?: boolean;
  breakTheGlass?: boolean;
  emergencyAccess?: boolean;
  patientDirected?: boolean;
  covered_entity?: string;
  business_associate?: string;
}

export interface AuditEntry {
  action: AuditAction | string;
  resourceType: ResourceType | string;
  resourceId?: string;
  context: AuditContext;
  phiDetails?: PHIAccessDetails;
  compliance?: ComplianceMetadata;
  outcome: "success" | "failure" | "partial";
  errorMessage?: string;
  timestamp: Date;
}

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function extractAuditContext(req: Request): AuditContext {
  return {
    userId: getHeader(req, "x-user-id") || null,
    sessionId: getHeader(req, "x-session-id"),
    ipAddress: req.ip || getHeader(req, "x-forwarded-for") || getHeader(req, "x-real-ip") || null,
    userAgent: getHeader(req, "user-agent") || null,
    requestId: getHeader(req, "x-request-id") || crypto.randomUUID(),
    correlationId: getHeader(req, "x-correlation-id"),
  };
}

export async function createAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    const metadata = {
      sessionId: entry.context.sessionId,
      requestId: entry.context.requestId,
      correlationId: entry.context.correlationId,
      outcome: entry.outcome,
      errorMessage: entry.errorMessage,
      phiDetails: entry.phiDetails,
      compliance: entry.compliance,
      timestamp: entry.timestamp.toISOString(),
    };

    await storage.createAuditLog({
      userId: entry.context.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId || null,
      ipAddress: entry.context.ipAddress,
      userAgent: entry.context.userAgent,
      metadata,
    });
  } catch (error) {
    console.error("[AUDIT] Failed to create audit entry:", error);
    console.error("[AUDIT] Entry data:", JSON.stringify(entry, null, 2));
  }
}

export function auditPHIAccess(
  req: Request,
  action: AuditAction,
  resourceType: ResourceType | string,
  resourceId?: string,
  options?: {
    phiDetails?: PHIAccessDetails;
    compliance?: ComplianceMetadata;
    outcome?: "success" | "failure" | "partial";
    errorMessage?: string;
  }
): void {
  const entry: AuditEntry = {
    action,
    resourceType,
    resourceId,
    context: extractAuditContext(req),
    phiDetails: options?.phiDetails,
    compliance: options?.compliance,
    outcome: options?.outcome || "success",
    errorMessage: options?.errorMessage,
    timestamp: new Date(),
  };

  createAuditEntry(entry).catch(console.error);
}

export function auditLogin(
  req: Request,
  userId: string,
  success: boolean,
  method: "apple" | "demo" | "mfa" | "biometric",
  errorMessage?: string
): void {
  const context = extractAuditContext(req);
  context.userId = userId;

  const entry: AuditEntry = {
    action: success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
    resourceType: ResourceType.USER_ACCOUNT,
    resourceId: userId,
    context,
    phiDetails: {
      accessReason: `Authentication via ${method}`,
    },
    outcome: success ? "success" : "failure",
    errorMessage,
    timestamp: new Date(),
  };

  createAuditEntry(entry).catch(console.error);
}

export function auditDataExport(
  req: Request,
  resourceType: ResourceType | string,
  resourceIds: string[],
  format: string,
  recipient?: string
): void {
  auditPHIAccess(req, AuditAction.EXPORT_PHI, resourceType, resourceIds.join(","), {
    phiDetails: {
      recordCount: resourceIds.length,
      exportFormat: format,
      shareRecipient: recipient,
    },
    compliance: {
      minimumNecessary: true,
      patientDirected: !!recipient,
    },
  });
}

export function auditShareLink(
  req: Request,
  shareLinkId: string,
  action: "create" | "access" | "revoke",
  recordIds: string[],
  expiresAt?: Date
): void {
  const auditAction = action === "create" 
    ? AuditAction.SHARE_PHI 
    : action === "access" 
      ? AuditAction.VIEW_PHI 
      : AuditAction.DELETE_PHI;

  auditPHIAccess(req, auditAction, ResourceType.SHARE_LINK, shareLinkId, {
    phiDetails: {
      recordCount: recordIds.length,
      shareExpiration: expiresAt,
    },
    compliance: {
      patientDirected: true,
      minimumNecessary: true,
    },
  });
}

export function auditBulkRecordAccess(
  req: Request,
  action: AuditAction,
  resourceType: ResourceType | string,
  resourceIds: string[],
  reason?: string
): void {
  auditPHIAccess(req, action, resourceType, undefined, {
    phiDetails: {
      recordCount: resourceIds.length,
      accessReason: reason,
    },
    compliance: {
      minimumNecessary: true,
    },
  });
}

export function auditConsentChange(
  req: Request,
  userId: string,
  consentType: string,
  granted: boolean,
  details?: Record<string, unknown>
): void {
  auditPHIAccess(
    req,
    granted ? AuditAction.CONSENT_GRANTED : AuditAction.CONSENT_REVOKED,
    ResourceType.CONSENT,
    userId,
    {
      phiDetails: {
        fieldsModified: [consentType],
        newValues: details,
      },
      compliance: {
        patientDirected: true,
      },
    }
  );
}

export function auditSecurityEvent(
  req: Request,
  action: AuditAction,
  details: string,
  severity: "low" | "medium" | "high" | "critical"
): void {
  const context = extractAuditContext(req);

  const entry: AuditEntry = {
    action,
    resourceType: "security_event",
    context,
    phiDetails: {
      accessReason: details,
    },
    compliance: {
      hipaaCategory: "required_by_law",
    },
    outcome: severity === "critical" || severity === "high" ? "failure" : "success",
    timestamp: new Date(),
  };

  createAuditEntry(entry).catch(console.error);

  if (severity === "critical") {
    console.error(`[SECURITY ALERT - ${severity.toUpperCase()}] ${details}`);
  }
}

export const AuditService = {
  createEntry: createAuditEntry,
  phiAccess: auditPHIAccess,
  login: auditLogin,
  dataExport: auditDataExport,
  shareLink: auditShareLink,
  bulkAccess: auditBulkRecordAccess,
  consentChange: auditConsentChange,
  securityEvent: auditSecurityEvent,
  AuditAction,
  ResourceType,
};
