// @ts-nocheck
import { db } from "./db";
import { smartApps, smartAppTokens, smartAppAccessLogs, patientConsents, consentAuditLogs, users, healthRecords } from "@shared/schema";
import { eq, and, sql, desc, gte, isNull, or } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { phiAuditService } from "./phi-audit-service";
import { logger } from "./utils/logger";

const FHIR_SCOPES = [
  "patient/Patient.read",
  "patient/Condition.read",
  "patient/Observation.read",
  "patient/MedicationRequest.read",
  "patient/AllergyIntolerance.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/DiagnosticReport.read",
  "patient/Encounter.read",
  "patient/CarePlan.read",
  "patient/CareTeam.read",
  "patient/DocumentReference.read",
  "patient/Goal.read",
  "patient/Device.read",
] as const;

type FhirScope = typeof FHIR_SCOPES[number];

function scopeToResourceType(scope: string): string | null {
  const match = scope.match(/^patient\/(\w+)\.\w+$/);
  return match ? match[1] : null;
}

export class FhirDataHubService {
  async authenticatePartner(bearerToken: string): Promise<{
    appId: string;
    userId: string;
    scopes: string[];
    appName: string;
  } | null> {
    if (!bearerToken) return null;

    const tokenHash = createHash("sha256").update(bearerToken).digest("hex");

    const tokens = await db
      .select({
        tokenId: smartAppTokens.id,
        appId: smartAppTokens.appId,
        userId: smartAppTokens.userId,
        scopes: smartAppTokens.scopes,
        expiresAt: smartAppTokens.expiresAt,
        isRevoked: smartAppTokens.isRevoked,
        appName: smartApps.name,
        appIsActive: smartApps.isActive,
      })
      .from(smartAppTokens)
      .innerJoin(smartApps, eq(smartAppTokens.appId, smartApps.id))
      .where(
        and(
          eq(smartAppTokens.accessToken, tokenHash),
          eq(smartAppTokens.isRevoked, false),
          eq(smartApps.isActive, true)
        )
      )
      .limit(1);

    if (tokens.length === 0) return null;

    const token = tokens[0];
    if (new Date(token.expiresAt) < new Date()) return null;

    await db
      .update(smartApps)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${smartApps.accessCount} + 1`,
      })
      .where(eq(smartApps.id, token.appId));

    return {
      appId: token.appId,
      userId: token.userId,
      scopes: (token.scopes as string[]) || [],
      appName: token.appName,
    };
  }

  async queryPatientBundleByEmail(
    partnerAppId: string,
    partnerUserId: string,
    patientEmail: string,
    grantedScopes: string[],
    ipAddress: string,
    userAgent: string
  ): Promise<{ bundle: any; auditId: string }> {
    const patientUsers = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.email, patientEmail.toLowerCase()))
      .limit(1);

    if (patientUsers.length === 0) {
      throw new FhirDataHubError("Patient not found", "not-found", 404);
    }

    const patient = patientUsers[0];

    const consents = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, patient.id),
          eq(patientConsents.appId, partnerAppId),
          eq(patientConsents.status, "active"),
          or(
            isNull(patientConsents.expiresAt),
            gte(patientConsents.expiresAt, new Date())
          )
        )
      );

    if (consents.length === 0) {
      await phiAuditService.logAccess({
        userId: partnerUserId,
        action: "read",
        resourceType: "Patient",
        patientId: patient.id,
        ipAddress,
        userAgent,
        metadata: {
          partnerAppId,
          decision: "denied",
          reason: "No active consent",
          apiEndpoint: "/api/fhir-hub/partner/Patient",
        },
      });
      throw new FhirDataHubError("No active consent for this patient", "forbidden", 403);
    }

    const consent = consents[0];
    const consentedResourceTypes = (consent.resourceTypes as string[]) || [];
    const consentedScopes = (consent.scope as string[]) || [];

    const effectiveScopes = grantedScopes.filter(
      (s) => consentedScopes.includes(s)
    );

    const allowedResourceTypes = effectiveScopes
      .map(scopeToResourceType)
      .filter(Boolean) as string[];

    if (allowedResourceTypes.length === 0) {
      throw new FhirDataHubError("No authorized scopes for this patient", "forbidden", 403);
    }

    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, patient.id));

    const filteredRecords = records.filter((r) => {
      const fhirType = r.fhirResourceType || mapRecordTypeToFhir(r.type);
      return allowedResourceTypes.includes(fhirType);
    });

    const bundle = buildFhirBundle(patient, filteredRecords, allowedResourceTypes);

    await phiAuditService.logAccess({
      userId: partnerUserId,
      action: "read",
      resourceType: "Bundle",
      patientId: patient.id,
      ipAddress,
      userAgent,
      metadata: {
        partnerAppId,
        decision: "permitted",
        scopesUsed: effectiveScopes,
        resourceTypesReturned: allowedResourceTypes,
        recordCount: filteredRecords.length,
        consentId: consent.id,
        apiEndpoint: "/api/fhir-hub/partner/Patient",
      },
    });

    await db.insert(smartAppAccessLogs).values({
      appId: partnerAppId,
      userId: partnerUserId,
      action: "patient_bundle_query",
      resourceType: "Bundle",
      resourceCount: filteredRecords.length,
      scopesUsed: effectiveScopes,
      ipAddress,
      userAgent,
      statusCode: 200,
      metadata: { patientEmail: patientEmail.replace(/(.{2}).*(@.*)/, "$1***$2") },
    });

    await db.insert(consentAuditLogs).values({
      consentId: consent.id,
      action: "accessed",
      performedBy: partnerUserId,
      ipAddress,
      userAgent,
      metadata: {
        appId: partnerAppId,
        scopesUsed: effectiveScopes,
        resourceCount: filteredRecords.length,
      },
    });

    return { bundle, auditId: consent.id };
  }

  async getUserPartnerApps(userId: string): Promise<any[]> {
    const apps = await db
      .select({
        id: smartApps.id,
        name: smartApps.name,
        description: smartApps.description,
        logoUrl: smartApps.logoUrl,
        isActive: smartApps.isActive,
        lastAccessedAt: smartApps.lastAccessedAt,
        accessCount: smartApps.accessCount,
        createdAt: smartApps.createdAt,
      })
      .from(smartApps)
      .where(eq(smartApps.userId, userId))
      .orderBy(desc(smartApps.lastAccessedAt));

    const results = [];
    for (const app of apps) {
      const appConsents = await db
        .select()
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.appId, app.id),
            eq(patientConsents.patientUserId, userId),
            eq(patientConsents.consentType, "app_access"),
            eq(patientConsents.status, "active")
          )
        );

      const activeScopes = appConsents.length > 0
        ? (appConsents[0].scope as string[]) || []
        : [];

      const allowedResourceTypes = appConsents.length > 0
        ? (appConsents[0].resourceTypes as string[]) || []
        : [];

      results.push({
        ...app,
        grantedScopes: activeScopes,
        allowedResourceTypes,
        consentId: appConsents.length > 0 ? appConsents[0].id : null,
        consentStatus: appConsents.length > 0 ? "active" : "none",
        availableScopes: [...FHIR_SCOPES],
      });
    }

    return results;
  }

  async updatePartnerScopes(
    userId: string,
    appId: string,
    scopes: string[],
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const app = await db
      .select()
      .from(smartApps)
      .where(and(eq(smartApps.id, appId), eq(smartApps.userId, userId)))
      .limit(1);

    if (app.length === 0) {
      throw new FhirDataHubError("App not found", "not-found", 404);
    }

    const validScopes = scopes.filter((s) =>
      FHIR_SCOPES.includes(s as FhirScope)
    );

    const resourceTypes = validScopes
      .map(scopeToResourceType)
      .filter(Boolean) as string[];

    const existing = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, userId),
          eq(patientConsents.appId, appId),
          eq(patientConsents.consentType, "app_access")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const previousScopes = (existing[0].scope as string[]) || [];

      await db
        .update(patientConsents)
        .set({
          scope: validScopes,
          resourceTypes,
          status: validScopes.length > 0 ? "active" : "revoked",
          updatedAt: new Date(),
          ...(validScopes.length === 0 ? { revokedAt: new Date(), revokedReason: "User revoked all scopes" } : {}),
        })
        .where(eq(patientConsents.id, existing[0].id));

      await db.insert(consentAuditLogs).values({
        consentId: existing[0].id,
        action: validScopes.length === 0 ? "revoked" : "modified",
        performedBy: userId,
        previousStatus: existing[0].status,
        newStatus: validScopes.length > 0 ? "active" : "revoked",
        changesApplied: { previousScopes, newScopes: validScopes },
        ipAddress,
        userAgent,
      });
    } else if (validScopes.length > 0) {
      const [newConsent] = await db
        .insert(patientConsents)
        .values({
          patientUserId: userId,
          appId,
          consentType: "app_access",
          status: "active",
          scope: validScopes,
          resourceTypes,
          purpose: "FHIR Data Hub API access",
          signatureMethod: "electronic",
        })
        .returning();

      await db.insert(consentAuditLogs).values({
        consentId: newConsent.id,
        action: "granted",
        performedBy: userId,
        newStatus: "active",
        changesApplied: { scopes: validScopes },
        ipAddress,
        userAgent,
      });
    }

    await db
      .update(smartAppTokens)
      .set({ scopes: validScopes, updatedAt: new Date() })
      .where(
        and(
          eq(smartAppTokens.appId, appId),
          eq(smartAppTokens.userId, userId),
          eq(smartAppTokens.isRevoked, false)
        )
      );
  }

  async revokePartnerAccess(
    userId: string,
    appId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const app = await db
      .select()
      .from(smartApps)
      .where(and(eq(smartApps.id, appId), eq(smartApps.userId, userId)))
      .limit(1);

    if (app.length === 0) {
      throw new FhirDataHubError("App not found", "not-found", 404);
    }

    const consents = await db
      .select()
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientUserId, userId),
          eq(patientConsents.appId, appId),
          eq(patientConsents.status, "active")
        )
      );

    for (const consent of consents) {
      await db
        .update(patientConsents)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          revokedReason: "User revoked access via Data Hub",
          updatedAt: new Date(),
        })
        .where(eq(patientConsents.id, consent.id));

      await db.insert(consentAuditLogs).values({
        consentId: consent.id,
        action: "revoked",
        performedBy: userId,
        previousStatus: "active",
        newStatus: "revoked",
        ipAddress,
        userAgent,
      });
    }

    await db
      .update(smartAppTokens)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(
        and(
          eq(smartAppTokens.appId, appId),
          eq(smartAppTokens.userId, userId)
        )
      );

    await db
      .update(smartApps)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(smartApps.id, appId));

    await phiAuditService.logAccess({
      userId,
      action: "revoke",
      resourceType: "Consent",
      ipAddress,
      userAgent,
      metadata: {
        appId,
        appName: app[0].name,
        action: "full_revocation",
      },
    });
  }

  async getPartnerAccessLog(userId: string, days: number = 30): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const apps = await db
      .select({ id: smartApps.id })
      .from(smartApps)
      .where(eq(smartApps.userId, userId));

    if (apps.length === 0) return [];

    const appIds = apps.map((a) => a.id);

    const logs = await db
      .select({
        id: smartAppAccessLogs.id,
        appId: smartAppAccessLogs.appId,
        action: smartAppAccessLogs.action,
        resourceType: smartAppAccessLogs.resourceType,
        resourceCount: smartAppAccessLogs.resourceCount,
        scopesUsed: smartAppAccessLogs.scopesUsed,
        ipAddress: smartAppAccessLogs.ipAddress,
        statusCode: smartAppAccessLogs.statusCode,
        createdAt: smartAppAccessLogs.createdAt,
        appName: smartApps.name,
      })
      .from(smartAppAccessLogs)
      .innerJoin(smartApps, eq(smartAppAccessLogs.appId, smartApps.id))
      .where(
        and(
          sql`${smartAppAccessLogs.appId} = ANY(${appIds})`,
          gte(smartAppAccessLogs.createdAt, since)
        )
      )
      .orderBy(desc(smartAppAccessLogs.createdAt))
      .limit(200);

    return logs;
  }

  async generatePartnerToken(userId: string, appId: string): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const app = await db
      .select()
      .from(smartApps)
      .where(and(eq(smartApps.id, appId), eq(smartApps.userId, userId)))
      .limit(1);

    if (app.length === 0) {
      throw new FhirDataHubError("App not found", "not-found", 404);
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await db.insert(smartAppTokens).values({
      appId,
      userId,
      accessToken: tokenHash,
      tokenType: "Bearer",
      expiresAt,
      scopes: (app[0].scopes as string[]) || [],
    });

    return rawToken;
  }

  getCapabilityStatement(baseUrl: string): any {
    return {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      fhirVersion: "4.0.1",
      format: ["json"],
      rest: [
        {
          mode: "server",
          security: {
            cors: true,
            service: [
              {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                    code: "SMART-on-FHIR",
                  },
                ],
              },
            ],
            description:
              "OAuth2 Bearer token authentication. Tokens are issued per-partner app with granular FHIR scope control.",
          },
          resource: FHIR_SCOPES.map((scope) => {
            const resourceType = scopeToResourceType(scope);
            return {
              type: resourceType,
              interaction: [{ code: "read" }, { code: "search-type" }],
              searchParam: resourceType === "Patient"
                ? [{ name: "email", type: "string" }]
                : [],
            };
          }),
        },
      ],
    };
  }
}

function mapRecordTypeToFhir(recordType: string): string {
  const mapping: Record<string, string> = {
    visit: "Encounter",
    lab: "DiagnosticReport",
    medication: "MedicationRequest",
    imaging: "ImagingStudy",
    procedure: "Procedure",
    immunization: "Immunization",
    vital: "Observation",
    allergy: "AllergyIntolerance",
    condition: "Condition",
    dental: "Encounter",
  };
  return mapping[recordType] || "DocumentReference";
}

function buildFhirBundle(
  patient: { id: string; email: string | null; firstName: string | null; lastName: string | null },
  records: any[],
  allowedResourceTypes: string[]
): any {
  const entries: any[] = [];

  if (allowedResourceTypes.includes("Patient")) {
    entries.push({
      fullUrl: `urn:uuid:${patient.id}`,
      resource: {
        resourceType: "Patient",
        id: patient.id,
        name: [
          {
            use: "official",
            family: patient.lastName || "Unknown",
            given: [patient.firstName || "Unknown"],
          },
        ],
        telecom: patient.email
          ? [{ system: "email", value: patient.email }]
          : [],
      },
      search: { mode: "match" },
    });
  }

  for (const record of records) {
    const fhirType = record.fhirResourceType || mapRecordTypeToFhir(record.type);
    if (record.rawFhirJson) {
      try {
        const fhirResource = typeof record.rawFhirJson === "string"
          ? JSON.parse(record.rawFhirJson)
          : record.rawFhirJson;
        entries.push({
          fullUrl: `urn:uuid:${record.id}`,
          resource: { ...fhirResource, id: record.id },
          search: { mode: "match" },
        });
      } catch {
        entries.push(buildGenericEntry(record, fhirType, patient.id));
      }
    } else {
      entries.push(buildGenericEntry(record, fhirType, patient.id));
    }
  }

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    timestamp: new Date().toISOString(),
    link: [
      {
        relation: "self",
        url: `/api/fhir-hub/partner/Patient?email=${patient.email}`,
      },
    ],
    entry: entries,
  };
}

function buildGenericEntry(record: any, fhirType: string, patientId: string): any {
  return {
    fullUrl: `urn:uuid:${record.id}`,
    resource: {
      resourceType: fhirType,
      id: record.id,
      status: record.status || "final",
      subject: { reference: `Patient/${patientId}` },
      code: record.code
        ? { coding: [{ display: record.code }] }
        : { text: record.title || record.type },
      effectiveDateTime: record.date || record.createdAt,
      ...(record.provider ? { performer: [{ display: record.provider }] } : {}),
    },
    search: { mode: "match" },
  };
}

export class FhirDataHubError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "FhirDataHubError";
  }
}

export const fhirDataHubService = new FhirDataHubService();
