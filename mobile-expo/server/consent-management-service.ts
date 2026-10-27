import { db } from "./db";
import { eq, and, or, gte, lte, isNull, sql, desc } from "drizzle-orm";
import {
  patientConsents,
  consentAuditLogs,
  smartApps,
  users,
  PatientConsent,
  InsertPatientConsent,
  ConsentAuditLog,
  CONSENT_TYPES,
  CONSENT_STATUSES,
} from "@shared/schema";

export interface ConsentRequest {
  patientUserId: string;
  appId: string;
  consentType: string;
  scope: string[];
  resourceTypes?: string[];
  purpose?: string;
  dataPeriodStart?: Date;
  dataPeriodEnd?: Date;
  expiresAt?: Date;
  signatureMethod?: string;
  consentDocument?: string;
}

export interface ConsentSummary {
  id: string;
  appName: string;
  appLogo?: string;
  status: string;
  scope: string[];
  resourceTypes: string[];
  grantedAt: Date;
  expiresAt?: Date;
  lastAccessed?: Date;
  purpose?: string;
}

export class ConsentManagementService {
  async grantConsent(request: ConsentRequest): Promise<PatientConsent> {
    const existingConsent = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, request.patientUserId),
          eq(patientConsents.appId, request.appId),
          eq(patientConsents.status, "active")
        )
      )
      .limit(1);

    if (existingConsent.length > 0) {
      return this.updateConsent(existingConsent[0].id, {
        scope: request.scope,
        resourceTypes: request.resourceTypes,
        purpose: request.purpose,
        dataPeriodStart: request.dataPeriodStart,
        dataPeriodEnd: request.dataPeriodEnd,
        expiresAt: request.expiresAt,
      });
    }

    const [consent] = await db
      .insert(patientConsents)
      .values({
        patientUserId: request.patientUserId,
        appId: request.appId,
        consentType: request.consentType,
        status: "active",
        scope: request.scope,
        resourceTypes: request.resourceTypes || [],
        purpose: request.purpose,
        dataPeriodStart: request.dataPeriodStart,
        dataPeriodEnd: request.dataPeriodEnd,
        grantedAt: new Date(),
        expiresAt: request.expiresAt,
        signatureMethod: request.signatureMethod || "electronic",
        consentDocument: request.consentDocument,
      })
      .returning();

    await this.logConsentAction(consent.id, "granted", request.patientUserId, undefined, "active");

    return consent;
  }

  async updateConsent(
    consentId: string,
    updates: Partial<{
      scope: string[];
      resourceTypes: string[];
      purpose: string;
      dataPeriodStart: Date;
      dataPeriodEnd: Date;
      expiresAt: Date;
    }>
  ): Promise<PatientConsent> {
    const currentConsent = await db
      .select()
      .from(patientConsents)
      .where(eq(patientConsents.id, consentId))
      .limit(1);

    if (currentConsent.length === 0) {
      throw new Error("Consent not found");
    }

    const [updated] = await db
      .update(patientConsents)
      .set({
        ...updates,
        scope: updates.scope || currentConsent[0].scope,
        resourceTypes: updates.resourceTypes || currentConsent[0].resourceTypes,
        updatedAt: new Date(),
      })
      .where(eq(patientConsents.id, consentId))
      .returning();

    await this.logConsentAction(
      consentId,
      "modified",
      currentConsent[0].patientUserId,
      currentConsent[0].status,
      updated.status,
      { changesApplied: updates }
    );

    return updated;
  }

  async revokeConsent(
    consentId: string,
    reason?: string,
    performedBy?: string
  ): Promise<PatientConsent> {
    const currentConsent = await db
      .select()
      .from(patientConsents)
      .where(eq(patientConsents.id, consentId))
      .limit(1);

    if (currentConsent.length === 0) {
      throw new Error("Consent not found");
    }

    const [revoked] = await db
      .update(patientConsents)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(patientConsents.id, consentId))
      .returning();

    await this.logConsentAction(
      consentId,
      "revoked",
      performedBy || currentConsent[0].patientUserId,
      currentConsent[0].status,
      "revoked",
      { reason }
    );

    return revoked;
  }

  async getPatientConsents(patientUserId: string): Promise<ConsentSummary[]> {
    const consents = await db
      .select({
        consent: patientConsents,
        app: smartApps,
      })
      .from(patientConsents)
      .leftJoin(smartApps, eq(patientConsents.appId, smartApps.id))
      .where(eq(patientConsents.patientUserId, patientUserId))
      .orderBy(desc(patientConsents.grantedAt));

    return consents.map((row) => ({
      id: row.consent.id,
      appName: row.app?.name || "Unknown App",
      appLogo: row.app?.logoUrl || undefined,
      status: row.consent.status,
      scope: (row.consent.scope as string[]) || [],
      resourceTypes: (row.consent.resourceTypes as string[]) || [],
      grantedAt: row.consent.grantedAt,
      expiresAt: row.consent.expiresAt || undefined,
      lastAccessed: row.app?.lastAccessedAt || undefined,
      purpose: row.consent.purpose || undefined,
    }));
  }

  async getActiveConsentsForApp(appId: string): Promise<PatientConsent[]> {
    return db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.appId, appId),
          eq(patientConsents.status, "active"),
          or(
            isNull(patientConsents.expiresAt),
            gte(patientConsents.expiresAt, new Date())
          )
        )
      );
  }

  async getConsentById(consentId: string): Promise<PatientConsent | null> {
    const consents = await db
      .select()
      .from(patientConsents)
      .where(eq(patientConsents.id, consentId))
      .limit(1);

    return consents[0] || null;
  }

  async getConsentWithApp(consentId: string): Promise<{
    consent: PatientConsent;
    app: typeof smartApps.$inferSelect | null;
  } | null> {
    const result = await db
      .select({
        consent: patientConsents,
        app: smartApps,
      })
      .from(patientConsents)
      .leftJoin(smartApps, eq(patientConsents.appId, smartApps.id))
      .where(eq(patientConsents.id, consentId))
      .limit(1);

    if (result.length === 0) return null;
    return { consent: result[0].consent, app: result[0].app };
  }

  async checkExpiredConsents(): Promise<number> {
    const result = await db
      .update(patientConsents)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(patientConsents.status, "active"),
          lte(patientConsents.expiresAt, new Date())
        )
      )
      .returning();

    for (const consent of result) {
      await this.logConsentAction(
        consent.id,
        "expired",
        undefined,
        "active",
        "expired"
      );
    }

    return result.length;
  }

  async getConsentAuditLog(consentId: string): Promise<ConsentAuditLog[]> {
    return db
      .select()
      .from(consentAuditLogs)
      .where(eq(consentAuditLogs.consentId, consentId))
      .orderBy(desc(consentAuditLogs.createdAt));
  }

  async getPatientConsentAuditHistory(patientUserId: string): Promise<ConsentAuditLog[]> {
    const consents = await db
      .select({ id: patientConsents.id })
      .from(patientConsents)
      .where(eq(patientConsents.patientUserId, patientUserId));

    if (consents.length === 0) return [];

    const consentIds = consents.map((c) => c.id);

    return db
      .select()
      .from(consentAuditLogs)
      .where(sql`${consentAuditLogs.consentId} = ANY(ARRAY[${sql.join(consentIds.map(id => sql`${id}`), sql`, `)}]::varchar[])`)
      .orderBy(desc(consentAuditLogs.createdAt));
  }

  private async logConsentAction(
    consentId: string,
    action: string,
    performedBy?: string,
    previousStatus?: string,
    newStatus?: string,
    metadata?: { changesApplied?: any; reason?: string }
  ): Promise<void> {
    try {
      await db.insert(consentAuditLogs).values({
        consentId,
        action,
        performedBy,
        previousStatus,
        newStatus,
        changesApplied: metadata?.changesApplied,
        metadata: metadata?.reason ? { reason: metadata.reason } : undefined,
      });
    } catch (error) {
      console.error("Failed to log consent action:", error);
    }
  }

  async getConsentStatistics(patientUserId: string): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
    pending: number;
  }> {
    const consents = await db
      .select({ status: patientConsents.status })
      .from(patientConsents)
      .where(eq(patientConsents.patientUserId, patientUserId));

    const stats = {
      total: consents.length,
      active: 0,
      revoked: 0,
      expired: 0,
      pending: 0,
    };

    for (const consent of consents) {
      switch (consent.status) {
        case "active":
          stats.active++;
          break;
        case "revoked":
          stats.revoked++;
          break;
        case "expired":
          stats.expired++;
          break;
        case "pending":
          stats.pending++;
          break;
      }
    }

    return stats;
  }

  getSupportedConsentTypes(): string[] {
    return [...CONSENT_TYPES];
  }

  getSupportedConsentStatuses(): string[] {
    return [...CONSENT_STATUSES];
  }

  async createEmergencyAccessConsent(
    patientUserId: string,
    appId: string,
    duration: number = 24
  ): Promise<PatientConsent> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + duration);

    return this.grantConsent({
      patientUserId,
      appId,
      consentType: "emergency",
      scope: ["patient/*.read"],
      resourceTypes: ["*"],
      purpose: "Emergency access for urgent care",
      expiresAt,
      signatureMethod: "emergency_override",
    });
  }

  async validateConsentForAccess(
    patientUserId: string,
    appId: string,
    resourceType: string,
    action: "read" | "write"
  ): Promise<{ valid: boolean; consent?: PatientConsent; reason?: string }> {
    const consent = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, patientUserId),
          eq(patientConsents.appId, appId),
          eq(patientConsents.status, "active"),
          or(
            isNull(patientConsents.expiresAt),
            gte(patientConsents.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    if (consent.length === 0) {
      return { valid: false, reason: "No active consent found" };
    }

    const currentConsent = consent[0];
    const resourceTypes = (currentConsent.resourceTypes as string[]) || [];

    if (resourceTypes.length > 0 && !resourceTypes.includes(resourceType) && !resourceTypes.includes("*")) {
      return {
        valid: false,
        consent: currentConsent,
        reason: `Resource type '${resourceType}' not authorized`,
      };
    }

    const scopes = (currentConsent.scope as string[]) || [];
    const requiredScopePattern = new RegExp(`^patient/(\\*|${resourceType})\\.(${action}|\\*)$`);
    const hasMatchingScope = scopes.some((s) => requiredScopePattern.test(s));

    if (!hasMatchingScope) {
      return {
        valid: false,
        consent: currentConsent,
        reason: `Scope for '${action}' action on '${resourceType}' not authorized`,
      };
    }

    if (currentConsent.dataPeriodStart || currentConsent.dataPeriodEnd) {
      const now = new Date();
      if (currentConsent.dataPeriodStart && now < currentConsent.dataPeriodStart) {
        return {
          valid: false,
          consent: currentConsent,
          reason: "Consent data period has not started",
        };
      }
      if (currentConsent.dataPeriodEnd && now > currentConsent.dataPeriodEnd) {
        return {
          valid: false,
          consent: currentConsent,
          reason: "Consent data period has ended",
        };
      }
    }

    return { valid: true, consent: currentConsent };
  }
}

export const consentManagementService = new ConsentManagementService();
