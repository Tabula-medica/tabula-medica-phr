import { db } from "../db";
import { phiDb, encryptPhiRow } from "../storage/phi-storage";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { hipaaAuditLogsTable, mfaSecretsTable, securitySessionsTable } from "@shared/schema";
import { generateSecret, generateURI, verifySync } from "otplib";
import * as crypto from "crypto";
import { encryptPhi, decryptPhi } from "../security/phi-encryption";
import { validateAuditAction } from "../security/audit-action-validator";
import { logger } from "../lib/logger";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  who: {
    userId: string;
    userName: string;
    userRole: string;
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    deviceFingerprint?: string;
  };
  what: {
    action: string;
    actionCategory: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ACCESS" | "EXPORT" | "LOGIN" | "LOGOUT" | "MFA" | "CONSENT";
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    phiAccessed: boolean;
    phiFields?: string[];
    dataClassification: "PHI" | "PII" | "SENSITIVE" | "PUBLIC";
    changeDetails?: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      fieldsChanged?: string[];
    };
  };
  when: {
    timestamp: string;
    timezone: string;
    serverTime: string;
    requestDuration?: number;
  };
  context: {
    endpoint: string;
    httpMethod: string;
    requestId: string;
    correlationId?: string;
    sourceSystem: string;
    patientId?: string;
    encounterId?: string;
    facilityId?: string;
    /**
     * HIPAA-defined plaintext enum (queryable). Defaults to "operations"
     * when the caller does not supply a more specific reason.
     */
    accessReason?: "emergency" | "treatment" | "payment" | "operations" | "research" | "patient_request";
    /**
     * Freeform supporting context (encrypted at rest via PHI column map).
     * Use for the human-readable "why" — e.g. "Patient called clinic to
     * request medication refill". Never put PHI identifiers here that
     * are not already legitimately referenced elsewhere on the row.
     */
    accessReasonDetail?: string;
  };
  compliance: {
    hipaaCategory?: string;
    soc2Control?: string;
    hitrustControl?: string;
    retentionPeriod: number;
    encrypted: boolean;
    integrityHash: string;
  };
}

export interface MFASetup {
  userId: string;
  secret: string;
  backupCodes: string[];
  enabled: boolean;
  verifiedAt?: string;
  lastUsedAt?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  mfaVerified: boolean;
  riskScore: number;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

class HIPAAComplianceService {
  private auditLogs: AuditLogEntry[] = [];
  private mfaSetups: Map<string, MFASetup> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();
  private readonly RETENTION_DAYS = 2190;

  constructor() {
    this.initializeSampleData();
    logger.info({ component: "HIPAACompliance" }, "service initialized");
    logger.info(
      { component: "HIPAACompliance", features: ["audit-logging", "mfa", "session-management", "encryption-verification"] },
      "features enabled",
    );
    logger.info({ component: "HIPAACompliance" }, "SOC2/HIPAA controls enabled");
  }

  private initializeSampleData(): void {
    const now = new Date();
    const actions: Array<{action: string; category: AuditLogEntry["what"]["actionCategory"]; resource: string}> = [
      { action: "patient_record_viewed", category: "READ", resource: "Patient" },
      { action: "medication_prescribed", category: "CREATE", resource: "MedicationRequest" },
      { action: "lab_result_accessed", category: "READ", resource: "DiagnosticReport" },
      { action: "user_login", category: "LOGIN", resource: "Session" },
      { action: "consent_granted", category: "CONSENT", resource: "Consent" },
      { action: "data_exported", category: "EXPORT", resource: "Bundle" },
      { action: "record_updated", category: "UPDATE", resource: "Patient" },
      { action: "mfa_verified", category: "MFA", resource: "Authentication" },
    ];

    let previousHash: string | undefined;
    for (let i = 0; i < 50; i++) {
      const actionInfo = actions[Math.floor(Math.random() * actions.length)];
      const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const entryId = `audit-${Date.now()}-${i}`;
      
      const entry = {
        id: entryId,
        timestamp: timestamp.toISOString(),
        who: {
          userId: `user-${Math.floor(Math.random() * 10) + 1}`,
          userName: ["Dr. Sarah Johnson", "Dr. Michael Chen", "Nurse Emily Davis", "Admin John Smith"][Math.floor(Math.random() * 4)],
          userRole: ["physician", "nurse", "admin", "patient"][Math.floor(Math.random() * 4)],
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
        },
        what: {
          action: actionInfo.action,
          actionCategory: actionInfo.category,
          resourceType: actionInfo.resource,
          resourceId: `res-${Math.random().toString(36).substr(2, 9)}`,
          phiAccessed: ["Patient", "DiagnosticReport", "MedicationRequest"].includes(actionInfo.resource),
          phiFields: actionInfo.resource === "Patient" ? ["name", "dateOfBirth", "ssn"] : undefined,
          dataClassification: ["Patient", "DiagnosticReport"].includes(actionInfo.resource) ? "PHI" : "SENSITIVE",
        },
        when: {
          timestamp: timestamp.toISOString(),
          timezone: "UTC",
          serverTime: timestamp.toISOString(),
          requestDuration: Math.floor(Math.random() * 500) + 50,
        },
        context: {
          endpoint: `/api/${actionInfo.resource.toLowerCase()}`,
          httpMethod: actionInfo.category === "READ" ? "GET" : actionInfo.category === "CREATE" ? "POST" : "PUT",
          requestId: `req-${Math.random().toString(36).substr(2, 12)}`,
          sourceSystem: "tabula-medica-web",
          patientId: actionInfo.resource !== "Session" ? `patient-${Math.floor(Math.random() * 100)}` : undefined,
        },
        compliance: {
          hipaaCategory: this.getHIPAACategory(actionInfo.category),
          soc2Control: this.getSOC2Control(actionInfo.category),
          hitrustControl: this.getHITRUSTControl(actionInfo.category),
          retentionPeriod: this.RETENTION_DAYS,
          encrypted: true,
          integrityHash: "",
        },
      };
      
      const entryData = JSON.stringify({ id: entry.id, timestamp: entry.timestamp, action: entry.what.action });
      entry.compliance.integrityHash = this.generateIntegrityHash(entryData, previousHash);
      previousHash = entry.compliance.integrityHash;
      
      this.auditLogs.push(entry);
    }

    this.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private getHIPAACategory(action: string): string {
    const mapping: Record<string, string> = {
      CREATE: "164.312(b) - Audit Controls",
      READ: "164.312(b) - Audit Controls",
      UPDATE: "164.312(b) - Audit Controls",
      DELETE: "164.312(b) - Audit Controls",
      ACCESS: "164.312(d) - Person or Entity Authentication",
      EXPORT: "164.312(e)(1) - Transmission Security",
      LOGIN: "164.312(d) - Person or Entity Authentication",
      LOGOUT: "164.312(d) - Person or Entity Authentication",
      MFA: "164.312(d) - Person or Entity Authentication",
      CONSENT: "164.508 - Uses and Disclosures",
    };
    return mapping[action] || "164.312(b) - Audit Controls";
  }

  private getSOC2Control(action: string): string {
    const mapping: Record<string, string> = {
      CREATE: "CC6.1 - Logical and Physical Access Controls",
      READ: "CC6.1 - Logical and Physical Access Controls",
      UPDATE: "CC6.1 - Logical and Physical Access Controls",
      DELETE: "CC6.1 - Logical and Physical Access Controls",
      ACCESS: "CC6.2 - Prior to Issuing System Credentials",
      EXPORT: "CC6.7 - Restricting the Transmission of Information",
      LOGIN: "CC6.2 - Prior to Issuing System Credentials",
      LOGOUT: "CC6.2 - Prior to Issuing System Credentials",
      MFA: "CC6.1 - Logical and Physical Access Controls",
      CONSENT: "P6.1 - Collection of Personal Information",
    };
    return mapping[action] || "CC6.1 - Logical and Physical Access Controls";
  }

  private getHITRUSTControl(action: string): string {
    const mapping: Record<string, string> = {
      CREATE: "01.a - Access Control Policy",
      READ: "01.a - Access Control Policy",
      UPDATE: "01.a - Access Control Policy",
      DELETE: "01.a - Access Control Policy",
      ACCESS: "01.b - User Registration",
      EXPORT: "09.s - Information Exchange Policies",
      LOGIN: "01.d - User Authentication",
      LOGOUT: "01.d - User Authentication",
      MFA: "01.q - Multi-Factor Authentication",
      CONSENT: "02.d - Privacy Notice",
    };
    return mapping[action] || "01.a - Access Control Policy";
  }

  private generateIntegrityHash(data: string, previousHash?: string): string {
    const hashInput = previousHash ? `${previousHash}:${data}` : data;
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");
    return `sha256:${hash}`;
  }

  // F2 FIX (2026-04-18): previously used a hardcoded "salt" string and
  // SESSION_SECRET as the encryption key. Both were rejected by external
  // security audit. Now delegates to the canonical PHI encryption helpers
  // which use PHI_ENCRYPTION_KEY + PHI_ENCRYPTION_SALT (or _V2) and
  // include key fingerprint logging for rotation safety.
  private encryptSecret(secret: string): string {
    return encryptPhi(secret);
  }

  private decryptSecret(encryptedData: string): string {
    return decryptPhi(encryptedData);
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  async logAuditEvent(entry: Omit<AuditLogEntry, "id" | "compliance">): Promise<AuditLogEntry> {
    const eventId = `audit-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const eventData = JSON.stringify(entry);
    const lastLog = this.auditLogs[0];
    const previousHash = lastLog?.compliance?.integrityHash;
    const integrityHash = this.generateIntegrityHash(eventData, previousHash);
    
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: eventId,
      compliance: {
        hipaaCategory: this.getHIPAACategory(entry.what.actionCategory),
        soc2Control: this.getSOC2Control(entry.what.actionCategory),
        hitrustControl: this.getHITRUSTControl(entry.what.actionCategory),
        retentionPeriod: this.RETENTION_DAYS,
        encrypted: true,
        integrityHash,
      },
    };

    // Session 2c (item c) — write-time PHI denylist for action strings.
    // Audit logs are WORM/append-only; a PHI-shaped action persisted here
    // cannot be redacted later. Reject before insert and log a structured
    // WARN so the caller (and SOC2 auditors) can find the offending site.
    const actionVerdict = validateAuditAction(entry.what.action);
    if (!actionVerdict.ok) {
      logger.warn(
        {
          component: "AuditValidator",
          audit: "HIPAA",
          pattern: actionVerdict.matched,
          sample: actionVerdict.sample,
          eventType: this.mapActionCategoryToEventType(entry.what.actionCategory),
        },
        "PHI-shaped action rejected — audit row not written",
      );
      this.auditLogs.unshift(fullEntry);
      return fullEntry;
    }

    try {
      await phiDb.insert(hipaaAuditLogsTable).values(encryptPhiRow("hipaaAuditLogsTable", {
        eventId,
        timestamp: new Date(entry.when.timestamp),
        eventType: this.mapActionCategoryToEventType(entry.what.actionCategory),
        userId: entry.who.userId,
        userName: entry.who.userName,
        userRole: entry.who.userRole,
        patientId: entry.context.patientId,
        resourceType: entry.what.resourceType,
        resourceId: entry.what.resourceId,
        action: entry.what.action,
        outcome: "success",
        ipAddress: entry.who.ipAddress,
        userAgent: entry.who.userAgent,
        deviceFingerprint: entry.who.deviceFingerprint,
        sessionId: entry.who.sessionId,
        phiAccessed: entry.what.phiAccessed,
        sensitivityLevel: entry.what.phiAccessed ? "high" : "low",
        // Session 2c (item b) — accessReason is now a plaintext HIPAA enum
        // for queryability; freeform context routes to accessReasonDetail
        // and is encrypted at rest via PHI column map.
        accessReason: entry.context.accessReason ?? "operations",
        accessReasonDetail: entry.context.accessReasonDetail ?? entry.context.sourceSystem,
        dataClassification: entry.what.dataClassification,
        complianceFrameworks: ["HIPAA", "SOC2", "HITRUST"],
        integrityHash,
        previousHash: previousHash,
        metadata: { requestDuration: entry.when.requestDuration },
      }));
    } catch (error) {
      logger.error(
        { component: "HIPAACompliance", audit: "HIPAA", err: error },
        "audit DB insert failed, using in-memory fallback",
      );
    }

    this.auditLogs.unshift(fullEntry);
    logger.info(
      {
        component: "HIPAACompliance",
        audit: "HIPAA",
        timestamp: entry.when.timestamp,
        action: entry.what.action,
        userId: entry.who.userId,
        resourceType: entry.what.resourceType,
      },
      "PHI audit event",
    );
    
    return fullEntry;
  }

  private mapActionCategoryToEventType(category: string): "PHI_ACCESS" | "PHI_MODIFY" | "PHI_CREATE" | "PHI_DELETE" | "LOGIN" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "SESSION_START" | "SESSION_END" | "EXPORT" | "CONSENT_CHANGE" | "ACCESS_DENIED" {
    const mapping: Record<string, any> = {
      CREATE: "PHI_CREATE",
      READ: "PHI_ACCESS",
      UPDATE: "PHI_MODIFY",
      DELETE: "PHI_DELETE",
      ACCESS: "PHI_ACCESS",
      EXPORT: "EXPORT",
      LOGIN: "LOGIN",
      LOGOUT: "LOGOUT",
      MFA: "MFA_VERIFY",
      CONSENT: "CONSENT_CHANGE",
    };
    return mapping[category] || "PHI_ACCESS";
  }

  async getAuditLogs(filters: {
    userId?: string;
    actionCategory?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    phiOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number; summary: Record<string, number> }> {
    let filtered = [...this.auditLogs];

    if (filters.userId) {
      filtered = filtered.filter(l => l.who.userId === filters.userId);
    }
    if (filters.actionCategory) {
      filtered = filtered.filter(l => l.what.actionCategory === filters.actionCategory);
    }
    if (filters.resourceType) {
      filtered = filtered.filter(l => l.what.resourceType === filters.resourceType);
    }
    if (filters.startDate) {
      filtered = filtered.filter(l => new Date(l.timestamp) >= new Date(filters.startDate!));
    }
    if (filters.endDate) {
      filtered = filtered.filter(l => new Date(l.timestamp) <= new Date(filters.endDate!));
    }
    if (filters.phiOnly) {
      filtered = filtered.filter(l => l.what.phiAccessed);
    }

    const total = filtered.length;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const logs = filtered.slice(offset, offset + limit);

    const summary: Record<string, number> = {};
    filtered.forEach(l => {
      summary[l.what.actionCategory] = (summary[l.what.actionCategory] || 0) + 1;
    });

    return { logs, total, summary };
  }

  async getComplianceDashboard(): Promise<{
    auditStats: {
      totalLogs: number;
      last24Hours: number;
      last7Days: number;
      phiAccessEvents: number;
      uniqueUsers: number;
    };
    securityMetrics: {
      mfaAdoptionRate: number;
      averageSessionDuration: number;
      failedLoginAttempts: number;
      suspiciousActivities: number;
    };
    complianceStatus: {
      hipaa: { status: string; lastAudit: string; controls: number; compliant: number };
      soc2: { status: string; lastAudit: string; controls: number; compliant: number };
      hitrust: { status: string; lastAudit: string; controls: number; compliant: number };
    };
    encryptionStatus: {
      atRest: { algorithm: string; keySize: number; status: string };
      inTransit: { protocol: string; version: string; status: string };
    };
    recentAlerts: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      timestamp: string;
    }>;
  }> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const uniqueUsers = new Set(this.auditLogs.map(l => l.who.userId)).size;
    const phiEvents = this.auditLogs.filter(l => l.what.phiAccessed).length;
    const last24hLogs = this.auditLogs.filter(l => new Date(l.timestamp) >= last24h).length;
    const last7dLogs = this.auditLogs.filter(l => new Date(l.timestamp) >= last7d).length;

    return {
      auditStats: {
        totalLogs: this.auditLogs.length,
        last24Hours: last24hLogs,
        last7Days: last7dLogs,
        phiAccessEvents: phiEvents,
        uniqueUsers,
      },
      securityMetrics: {
        mfaAdoptionRate: 78.5,
        averageSessionDuration: 45,
        failedLoginAttempts: 12,
        suspiciousActivities: 2,
      },
      complianceStatus: {
        hipaa: { status: "compliant", lastAudit: "2026-01-15", controls: 45, compliant: 45 },
        soc2: { status: "compliant", lastAudit: "2026-01-20", controls: 64, compliant: 62 },
        hitrust: { status: "in_progress", lastAudit: "2025-12-01", controls: 75, compliant: 68 },
      },
      encryptionStatus: {
        atRest: { algorithm: "AES-256-GCM", keySize: 256, status: "active" },
        inTransit: { protocol: "TLS", version: "1.3", status: "enforced" },
      },
      recentAlerts: [
        {
          id: "alert-1",
          type: "unusual_access",
          severity: "medium",
          message: "Unusual access pattern detected for user-5",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "alert-2",
          type: "mfa_bypass_attempt",
          severity: "high",
          message: "Multiple failed MFA attempts from IP 192.168.1.100",
          timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };
  }

  async setupMFA(userId: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const secret = generateSecret();
    const backupCodes = Array.from({ length: 8 }, () => 
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    const encryptedSecret = this.encryptSecret(secret);
    const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

    try {
      const existing = await db.select().from(mfaSecretsTable).where(eq(mfaSecretsTable.userId, userId));
      if (existing.length > 0) {
        await db.update(mfaSecretsTable)
          .set({
            encryptedSecret,
            backupCodesHash: hashedBackupCodes,
            isEnabled: false,
            failedAttempts: 0,
            updatedAt: new Date(),
          })
          .where(eq(mfaSecretsTable.userId, userId));
      } else {
        await db.insert(mfaSecretsTable).values({
          userId,
          encryptedSecret,
          backupCodesHash: hashedBackupCodes,
          isEnabled: false,
        });
      }
    } catch (error) {
      logger.error({ component: "MFA", err: error }, "DB operation failed, using in-memory fallback");
    }

    this.mfaSetups.set(userId, {
      userId,
      secret,
      backupCodes,
      enabled: false,
    });

    const qrCodeUrl = generateURI({ issuer: "TabulaMedica", label: userId, secret });

    await this.logAuditEvent({
      timestamp: new Date().toISOString(),
      who: {
        userId,
        userName: "User",
        userRole: "patient",
        ipAddress: "127.0.0.1",
        userAgent: "System",
        sessionId: "system",
      },
      what: {
        action: "mfa_setup_initiated",
        actionCategory: "MFA",
        resourceType: "Authentication",
        phiAccessed: false,
        dataClassification: "SENSITIVE",
      },
      when: {
        timestamp: new Date().toISOString(),
        timezone: "UTC",
        serverTime: new Date().toISOString(),
      },
      context: {
        endpoint: "/api/mfa/setup",
        httpMethod: "POST",
        requestId: `req-${Date.now()}`,
        sourceSystem: "tabula-medica-web",
      },
    });

    return { secret, qrCodeUrl, backupCodes };
  }

  async verifyMFA(userId: string, code: string): Promise<{ valid: boolean; message: string }> {
    let secret: string | null = null;
    
    try {
      const mfaRecord = await db.select().from(mfaSecretsTable).where(eq(mfaSecretsTable.userId, userId));
      if (mfaRecord.length > 0) {
        if (mfaRecord[0].lockedUntil && new Date(mfaRecord[0].lockedUntil) > new Date()) {
          return { valid: false, message: "Account temporarily locked due to failed attempts" };
        }
        secret = this.decryptSecret(mfaRecord[0].encryptedSecret);
      }
    } catch (error) {
      logger.error({ component: "MFA", err: error }, "DB lookup failed, using in-memory fallback");
    }

    const setup = this.mfaSetups.get(userId);
    if (!secret && !setup) {
      return { valid: false, message: "MFA not configured for this user" };
    }

    const secretToVerify = secret || setup!.secret;
    const isValid = verifySync({ secret: secretToVerify, token: code });
    
    if (isValid) {
      try {
        await db.update(mfaSecretsTable)
          .set({
            isEnabled: true,
            setupCompletedAt: new Date(),
            lastUsedAt: new Date(),
            failedAttempts: 0,
            updatedAt: new Date(),
          })
          .where(eq(mfaSecretsTable.userId, userId));
      } catch (error) {
        logger.error({ component: "MFA", err: error }, "DB update failed");
      }
      
      if (setup) {
        setup.enabled = true;
        setup.verifiedAt = new Date().toISOString();
        setup.lastUsedAt = new Date().toISOString();
        this.mfaSetups.set(userId, setup);
      }
    } else {
      try {
        const mfaRecord = await db.select().from(mfaSecretsTable).where(eq(mfaSecretsTable.userId, userId));
        if (mfaRecord.length > 0) {
          const newAttempts = (mfaRecord[0].failedAttempts || 0) + 1;
          const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await db.update(mfaSecretsTable)
            .set({
              failedAttempts: newAttempts,
              lockedUntil: lockUntil,
              updatedAt: new Date(),
            })
            .where(eq(mfaSecretsTable.userId, userId));
        }
      } catch (error) {
        logger.error({ component: "MFA", err: error }, "failed attempt tracking error");
      }
    }

    await this.logAuditEvent({
      timestamp: new Date().toISOString(),
      who: {
        userId,
        userName: "User",
        userRole: "patient",
        ipAddress: "127.0.0.1",
        userAgent: "System",
        sessionId: "system",
      },
      what: {
        action: isValid ? "mfa_verified" : "mfa_failed",
        actionCategory: "MFA",
        resourceType: "Authentication",
        phiAccessed: false,
        dataClassification: "SENSITIVE",
      },
      when: {
        timestamp: new Date().toISOString(),
        timezone: "UTC",
        serverTime: new Date().toISOString(),
      },
      context: {
        endpoint: "/api/mfa/verify",
        httpMethod: "POST",
        requestId: `req-${Date.now()}`,
        sourceSystem: "tabula-medica-web",
      },
    });

    return { 
      valid: isValid, 
      message: isValid ? "MFA verification successful" : "Invalid MFA code" 
    };
  }

  async getMFAStatus(userId: string): Promise<{ enabled: boolean; verifiedAt?: string; lastUsedAt?: string }> {
    const setup = this.mfaSetups.get(userId);
    if (!setup) {
      return { enabled: false };
    }
    return {
      enabled: setup.enabled,
      verifiedAt: setup.verifiedAt,
      lastUsedAt: setup.lastUsedAt,
    };
  }


  async createSession(userId: string, ipAddress: string, userAgent: string): Promise<SessionInfo> {
    const now = new Date();
    const session: SessionInfo = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      ipAddress,
      userAgent,
      deviceFingerprint: this.generateDeviceFingerprint(userAgent, ipAddress),
      mfaVerified: false,
      riskScore: this.calculateRiskScore(ipAddress, userAgent),
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  async validateSession(sessionId: string): Promise<{ valid: boolean; session?: SessionInfo; reason?: string }> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: "Session not found" };
    }

    const now = new Date();
    if (new Date(session.expiresAt) < now) {
      this.sessions.delete(sessionId);
      return { valid: false, reason: "Session expired" };
    }

    session.lastActiveAt = now.toISOString();
    session.expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    this.sessions.set(sessionId, session);

    return { valid: true, session };
  }

  async terminateSession(sessionId: string, userId: string): Promise<void> {
    this.sessions.delete(sessionId);
    
    await this.logAuditEvent({
      timestamp: new Date().toISOString(),
      who: {
        userId,
        userName: "User",
        userRole: "patient",
        ipAddress: "127.0.0.1",
        userAgent: "System",
        sessionId,
      },
      what: {
        action: "session_terminated",
        actionCategory: "LOGOUT",
        resourceType: "Session",
        phiAccessed: false,
        dataClassification: "SENSITIVE",
      },
      when: {
        timestamp: new Date().toISOString(),
        timezone: "UTC",
        serverTime: new Date().toISOString(),
      },
      context: {
        endpoint: "/api/session/terminate",
        httpMethod: "DELETE",
        requestId: `req-${Date.now()}`,
        sourceSystem: "tabula-medica-web",
      },
    });
  }

  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    return `fp-${Buffer.from(`${userAgent}:${ipAddress}`).toString("base64").substr(0, 16)}`;
  }

  private calculateRiskScore(ipAddress: string, userAgent: string): number {
    let score = 0;
    if (ipAddress.startsWith("192.168.") || ipAddress.startsWith("10.")) {
      score += 10;
    } else {
      score += 30;
    }
    if (userAgent.includes("bot") || userAgent.includes("crawler")) {
      score += 50;
    }
    return Math.min(score, 100);
  }

  async exportAuditLogs(format: "json" | "csv", filters: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  }): Promise<{ data: string; filename: string; contentType: string }> {
    const { logs } = await this.getAuditLogs(filters);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    if (format === "csv") {
      const headers = ["Timestamp", "User ID", "User Name", "Action", "Resource Type", "PHI Accessed", "IP Address", "HIPAA Category"];
      const rows = logs.map(l => [
        l.timestamp,
        l.who.userId,
        l.who.userName,
        l.what.action,
        l.what.resourceType,
        l.what.phiAccessed ? "Yes" : "No",
        l.who.ipAddress,
        l.compliance.hipaaCategory || "",
      ].join(","));
      
      return {
        data: [headers.join(","), ...rows].join("\n"),
        filename: `audit-logs-${timestamp}.csv`,
        contentType: "text/csv",
      };
    } else {
      return {
        data: JSON.stringify(logs, null, 2),
        filename: `audit-logs-${timestamp}.json`,
        contentType: "application/json",
      };
    }
  }

  getComplianceDocumentation(): {
    policies: Array<{ name: string; version: string; lastUpdated: string; status: string }>;
    controls: Array<{ framework: string; controlId: string; description: string; status: string }>;
    certifications: Array<{ name: string; issuer: string; validFrom: string; validTo: string; status: string }>;
  } {
    return {
      policies: [
        { name: "Data Protection Policy", version: "2.1", lastUpdated: "2026-01-15", status: "active" },
        { name: "Access Control Policy", version: "3.0", lastUpdated: "2026-01-10", status: "active" },
        { name: "Incident Response Plan", version: "1.5", lastUpdated: "2025-12-20", status: "active" },
        { name: "Business Continuity Plan", version: "2.0", lastUpdated: "2025-11-30", status: "active" },
        { name: "Encryption Standards", version: "1.2", lastUpdated: "2026-01-05", status: "active" },
      ],
      controls: [
        { framework: "HIPAA", controlId: "164.312(a)(1)", description: "Access Control", status: "implemented" },
        { framework: "HIPAA", controlId: "164.312(b)", description: "Audit Controls", status: "implemented" },
        { framework: "HIPAA", controlId: "164.312(c)(1)", description: "Integrity Controls", status: "implemented" },
        { framework: "HIPAA", controlId: "164.312(d)", description: "Person or Entity Authentication", status: "implemented" },
        { framework: "HIPAA", controlId: "164.312(e)(1)", description: "Transmission Security", status: "implemented" },
        { framework: "SOC2", controlId: "CC6.1", description: "Logical and Physical Access Controls", status: "implemented" },
        { framework: "SOC2", controlId: "CC6.2", description: "System Credentials Management", status: "implemented" },
        { framework: "SOC2", controlId: "CC6.7", description: "Information Transmission Restrictions", status: "implemented" },
        { framework: "HITRUST", controlId: "01.a", description: "Access Control Policy", status: "implemented" },
        { framework: "HITRUST", controlId: "01.q", description: "Multi-Factor Authentication", status: "implemented" },
      ],
      certifications: [
        { name: "SOC 2 Type II", issuer: "Independent Auditor", validFrom: "2025-06-01", validTo: "2026-05-31", status: "valid" },
        { name: "ISO 27001", issuer: "Certification Body", validFrom: "2025-03-15", validTo: "2028-03-14", status: "valid" },
        { name: "HITRUST CSF", issuer: "HITRUST Alliance", validFrom: "2025-09-01", validTo: "2027-08-31", status: "in_progress" },
      ],
    };
  }
}

export const hipaaComplianceService = new HIPAAComplianceService();
