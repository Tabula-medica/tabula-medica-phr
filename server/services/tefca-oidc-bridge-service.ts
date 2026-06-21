import { randomUUID } from "crypto";
import { tefcaFrameworkService, type TEFCAQueryResponse, type TEFCAExchangePurpose, type QHINIdentifier } from "./tefca-framework-service";

export interface OIDCIdentityAssertion {
  sub: string;
  email: string;
  said: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender?: string;
  address?: {
    line: string[];
    city: string;
    state: string;
    postalCode: string;
  };
  auth0OrgId?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface TEFCASessionToken {
  sessionId: string;
  said: string;
  sub: string;
  createdAt: string;
  expiresAt: string;
  tefcaPurpose: TEFCAExchangePurpose;
  identityProofLevel: "IAL1" | "IAL2" | "IAL3";
  qhinAuthorizations: QHINAuthorization[];
  status: "active" | "expired" | "revoked";
}

export interface QHINAuthorization {
  qhinId: QHINIdentifier;
  qhinName: string;
  authorized: boolean;
  authorizedAt: string;
  expiresAt: string;
  patientMatchId?: string;
  matchConfidence?: number;
  scope: string[];
}

export interface UnifiedRecordQuery {
  sessionId: string;
  resourceTypes?: string[];
  dateRange?: { start: string; end: string };
  includeNonTefca?: boolean;
}

export interface UnifiedRecordResult {
  sessionId: string;
  said: string;
  queryTimestamp: string;
  tefcaResults: {
    queryId: string;
    status: string;
    networksQueried: number;
    networksResponded: number;
    totalDocuments: number;
    documentsByNetwork: Record<string, number>;
    sourceOrganizations: string[];
    overallConfidence: number;
  };
  fastenFallback?: {
    nonTefcaProviders: string[];
    requiresManualAuth: boolean;
    connectUrl: string;
  };
  combinedRecordCount: number;
  eliminatedLogins: number;
  auditId: string;
}

export interface TEFCAFlowStatus {
  said: string;
  hasActiveSession: boolean;
  session?: TEFCASessionToken;
  availableNetworks: number;
  connectedNetworks: number;
  lastQueryAt?: string;
  totalRecordsAccessed: number;
  eliminatedLoginCount: number;
}

const TEFCA_SESSION_TTL_HOURS = 24;
const TABULA_MEDICA_OID = "2.16.840.1.113883.3.9999.1";

class TEFCAOidcBridgeService {
  private sessions: Map<string, TEFCASessionToken> = new Map();
  private sessionsBySaid: Map<string, string> = new Map();
  private queryResults: Map<string, UnifiedRecordResult> = new Map();
  private loginEliminationCount: Map<string, number> = new Map();

  async createTefcaSession(
    identity: OIDCIdentityAssertion
  ): Promise<TEFCASessionToken> {
    if (!identity.said || !identity.sub) {
      throw new Error("SAID and OIDC subject are required for TEFCA session");
    }

    const existingSessionId = this.sessionsBySaid.get(identity.said);
    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing && existing.status === "active" && new Date(existing.expiresAt) > new Date()) {
        return existing;
      }
    }

    const sessionId = `tefca-sess-${randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TEFCA_SESSION_TTL_HOURS * 60 * 60 * 1000);

    const ialLevel = this.determineIAL(identity);

    const iasQhins = tefcaFrameworkService.getActiveQHINs("individual_access");
    const authorizations: QHINAuthorization[] = iasQhins.map((qhin) => ({
      qhinId: qhin.qhinId,
      qhinName: qhin.name,
      authorized: true,
      authorizedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      scope: ["patient/*.read", "patient/Patient.read", "patient/Condition.read",
        "patient/Observation.read", "patient/MedicationRequest.read",
        "patient/AllergyIntolerance.read", "patient/Immunization.read",
        "patient/Procedure.read", "patient/DocumentReference.read"],
    }));

    const session: TEFCASessionToken = {
      sessionId,
      said: identity.said,
      sub: identity.sub,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tefcaPurpose: "individual_access",
      identityProofLevel: ialLevel,
      qhinAuthorizations: authorizations,
      status: "active",
    };

    this.sessions.set(sessionId, session);
    this.sessionsBySaid.set(identity.said, sessionId);

    if (!this.loginEliminationCount.has(identity.said)) {
      this.loginEliminationCount.set(identity.said, 0);
    }
    const eliminatedCount = authorizations.filter((a) => a.authorized).length;
    this.loginEliminationCount.set(
      identity.said,
      (this.loginEliminationCount.get(identity.said) || 0) + eliminatedCount
    );

    console.log(
      `[TEFCA-OIDC-Bridge] Session created: ${sessionId} for SAID ${identity.said}, ` +
        `${authorizations.length} QHINs authorized, IAL${ialLevel.charAt(3)}, ` +
        `eliminated ${eliminatedCount} separate EMR logins`
    );

    return session;
  }

  async queryUnifiedRecords(
    sessionId: string,
    identity: OIDCIdentityAssertion,
    options: Partial<UnifiedRecordQuery> = {}
  ): Promise<UnifiedRecordResult> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") {
      throw new Error("Invalid or expired TEFCA session");
    }
    if (new Date(session.expiresAt) < new Date()) {
      session.status = "expired";
      throw new Error("TEFCA session has expired — re-authenticate via Auth0");
    }

    const tefcaQuery = await tefcaFrameworkService.initiateQuery({
      requestId: `ias-${randomUUID()}`,
      purpose: "individual_access",
      patientDemographics: {
        firstName: identity.firstName,
        lastName: identity.lastName,
        dateOfBirth: identity.dateOfBirth,
        gender: identity.gender,
        address: identity.address,
      },
      requestingOrganization: {
        oid: TABULA_MEDICA_OID,
        name: "Tabula Medica",
      },
      requestingUser: {
        name: `${identity.firstName} ${identity.lastName}`,
        role: "patient",
      },
      targetQHINs: session.qhinAuthorizations
        .filter((a) => a.authorized)
        .map((a) => a.qhinId),
      dataElements: options.resourceTypes || [
        "Patient", "Condition", "Observation", "MedicationRequest",
        "AllergyIntolerance", "Immunization", "Procedure",
        "DocumentReference", "DiagnosticReport", "Encounter",
      ],
      dateRange: options.dateRange,
    });

    const networkDocCounts: Record<string, number> = {};
    tefcaQuery.qhinResponses.forEach((r) => {
      networkDocCounts[r.qhinName] = r.documentCount;
      if (r.matchedPatients.length > 0) {
        const auth = session.qhinAuthorizations.find(
          (a) => a.qhinId === r.qhinId
        );
        if (auth) {
          auth.patientMatchId = r.matchedPatients[0].matchId;
          auth.matchConfidence = r.matchedPatients[0].confidence;
        }
      }
    });

    const nonTefcaProviders = this.identifyNonTefcaProviders();

    const result: UnifiedRecordResult = {
      sessionId,
      said: session.said,
      queryTimestamp: new Date().toISOString(),
      tefcaResults: {
        queryId: tefcaQuery.queryId,
        status: tefcaQuery.status,
        networksQueried: tefcaQuery.aggregatedResults.totalQHINsQueried,
        networksResponded: tefcaQuery.aggregatedResults.totalQHINsResponded,
        totalDocuments: tefcaQuery.aggregatedResults.totalDocuments,
        documentsByNetwork: networkDocCounts,
        sourceOrganizations: tefcaQuery.aggregatedResults.sourceOrganizations,
        overallConfidence: tefcaQuery.aggregatedResults.overallConfidence,
      },
      fastenFallback:
        options.includeNonTefca !== false && nonTefcaProviders.length > 0
          ? {
              nonTefcaProviders,
              requiresManualAuth: true,
              connectUrl: "/fasten-connect",
            }
          : undefined,
      combinedRecordCount: tefcaQuery.aggregatedResults.totalDocuments,
      eliminatedLogins: session.qhinAuthorizations.filter((a) => a.authorized).length,
      auditId: `audit-${randomUUID()}`,
    };

    this.queryResults.set(result.auditId, result);

    console.log(
      `[TEFCA-OIDC-Bridge] Unified query complete: ${result.tefcaResults.totalDocuments} docs ` +
        `from ${result.tefcaResults.networksResponded} networks, ` +
        `${result.eliminatedLogins} EMR logins eliminated`
    );

    return result;
  }

  getFlowStatus(said: string): TEFCAFlowStatus {
    const sessionId = this.sessionsBySaid.get(said);
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    const allNetworks = tefcaFrameworkService.getActiveQHINs("individual_access");
    const connectedNetworks = session
      ? session.qhinAuthorizations.filter((a) => a.authorized && a.patientMatchId).length
      : 0;

    let totalRecords = 0;
    this.queryResults.forEach((r) => {
      if (r.said === said) totalRecords += r.combinedRecordCount;
    });

    return {
      said,
      hasActiveSession: !!session && session.status === "active" && new Date(session.expiresAt) > new Date(),
      session: session?.status === "active" ? session : undefined,
      availableNetworks: allNetworks.length,
      connectedNetworks,
      lastQueryAt: session?.createdAt,
      totalRecordsAccessed: totalRecords,
      eliminatedLoginCount: this.loginEliminationCount.get(said) || 0,
    };
  }

  getSession(sessionId: string): TEFCASessionToken | undefined {
    return this.sessions.get(sessionId);
  }

  revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = "revoked";
    this.sessionsBySaid.delete(session.said);
    console.log(`[TEFCA-OIDC-Bridge] Session revoked: ${sessionId}`);
    return true;
  }

  private determineIAL(identity: OIDCIdentityAssertion): "IAL1" | "IAL2" | "IAL3" {
    if (identity.address && identity.dateOfBirth && identity.gender) {
      return "IAL2";
    }
    return "IAL1";
  }

  private identifyNonTefcaProviders(): string[] {
    return [
      "Local Dental Clinic (non-TEFCA)",
      "Independent Pharmacy (non-TEFCA)",
      "Private Practice Specialist (non-TEFCA)",
    ];
  }
}

export const tefcaOidcBridgeService = new TEFCAOidcBridgeService();
