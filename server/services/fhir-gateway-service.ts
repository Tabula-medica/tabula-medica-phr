import { getAuditLogger } from "./integrations/factory";
import { z } from "zod";
import crypto from "crypto";

export type GatewayAuthType = "smart_on_fhir" | "oauth2" | "api_key" | "basic";
export type GatewayScope = "patient/*.read" | "patient/*.write" | "user/*.read" | "user/*.write" | "launch/patient" | "openid" | "fhirUser" | "offline_access";
export type ExchangeType = "demographics" | "clinical_summary" | "outreach_status" | "medications" | "observations" | "conditions" | "allergies";
export type GatewayRequestStatus = "pending" | "authorized" | "completed" | "failed" | "rate_limited";

export interface GatewayConnection {
  id: string;
  externalSystemId: string;
  name: string;
  fhirEndpoint: string;
  authType: GatewayAuthType;
  authConfig: SMARTAuthConfig | OAuth2Config | ApiKeyConfig | BasicAuthConfig;
  supportedExchangeTypes: ExchangeType[];
  allowedScopes: GatewayScope[];
  isActive: boolean;
  tokenData?: TokenData;
  rateLimitConfig: RateLimitConfig;
  consentPolicyId?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SMARTAuthConfig {
  type: "smart_on_fhir";
  issuer: string;
  clientId: string;
  redirectUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  jwksUri?: string;
  pkceRequired: boolean;
  scopes: string[];
}

export interface OAuth2Config {
  type: "oauth2";
  clientId: string;
  clientSecret?: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
}

export interface ApiKeyConfig {
  type: "api_key";
  apiKeyHeader: string;
  apiKeyValue: string;
}

export interface BasicAuthConfig {
  type: "basic";
  username: string;
  password: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
  patientId?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

export interface PKCESession {
  connectionId: string;
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

export interface GatewayRequest {
  id: string;
  connectionId: string;
  direction: "inbound" | "outbound";
  exchangeType: ExchangeType;
  resourceType: string;
  patientId: string;
  status: GatewayRequestStatus;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  errorMessage?: string;
  scopesUsed: string[];
  consentVerified: boolean;
  auditId?: string;
  startedAt: string;
  completedAt?: string;
}

export interface GatewayAuditEntry {
  id: string;
  requestId: string;
  connectionId: string;
  externalSystemId: string;
  direction: "inbound" | "outbound";
  exchangeType: ExchangeType;
  resourceType: string;
  patientId: string;
  userId: string;
  scopes: string[];
  consentId?: string;
  status: "success" | "failure" | "denied";
  errorCode?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  responseTimeMs: number;
}

const connections = new Map<string, GatewayConnection>();
const pkceSessions = new Map<string, PKCESession>();
const gatewayRequests = new Map<string, GatewayRequest>();
const rateLimitCounters = new Map<string, { minute: number; hour: number; lastMinuteReset: number; lastHourReset: number }>();

function generateId(): string {
  return `gw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generatePKCEVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generatePKCEChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

const sampleConnections: GatewayConnection[] = [
  {
    id: "conn-epic",
    externalSystemId: "sys-epic",
    name: "Fasten Health EHR Integration",
    fhirEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    authType: "smart_on_fhir",
    authConfig: {
      type: "smart_on_fhir",
      issuer: "https://fhir.epic.com",
      clientId: "tabula-medica-client",
      redirectUri: "/api/fhir-gateway/auth/callback",
      authorizeEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
      tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
      jwksUri: "https://fhir.epic.com/.well-known/jwks.json",
      pkceRequired: true,
      scopes: ["patient/*.read", "patient/*.write", "launch/patient", "openid", "fhirUser", "offline_access"],
    },
    supportedExchangeTypes: ["demographics", "clinical_summary", "medications", "observations", "conditions", "allergies"],
    allowedScopes: ["patient/*.read", "patient/*.write", "launch/patient", "openid", "fhirUser", "offline_access"],
    isActive: true,
    rateLimitConfig: { requestsPerMinute: 60, requestsPerHour: 1000, burstLimit: 10 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conn-cerner",
    externalSystemId: "sys-cerner",
    name: "Hospital Network Integration",
    fhirEndpoint: "https://fhir-open.cerner.com/r4",
    authType: "smart_on_fhir",
    authConfig: {
      type: "smart_on_fhir",
      issuer: "https://authorization.cerner.com",
      clientId: "tabula-medica-cerner",
      redirectUri: "/api/fhir-gateway/auth/callback",
      authorizeEndpoint: "https://authorization.cerner.com/tenants/{tenant}/protocol/openid-connect/auth",
      tokenEndpoint: "https://authorization.cerner.com/tenants/{tenant}/protocol/openid-connect/token",
      pkceRequired: true,
      scopes: ["patient/*.read", "launch/patient", "openid", "offline_access"],
    },
    supportedExchangeTypes: ["demographics", "clinical_summary", "medications", "observations", "conditions"],
    allowedScopes: ["patient/*.read", "launch/patient", "openid", "offline_access"],
    isActive: true,
    rateLimitConfig: { requestsPerMinute: 30, requestsPerHour: 500, burstLimit: 5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conn-hie",
    externalSystemId: "sys-hie",
    name: "Regional HIE Network",
    fhirEndpoint: "https://hie.regional.org/fhir/r4",
    authType: "oauth2",
    authConfig: {
      type: "oauth2",
      clientId: "tabula-medica-hie",
      authorizeEndpoint: "https://auth.hie.regional.org/oauth2/authorize",
      tokenEndpoint: "https://auth.hie.regional.org/oauth2/token",
      scopes: ["patient.read", "document.read", "document.write"],
    },
    supportedExchangeTypes: ["demographics", "clinical_summary", "outreach_status"],
    allowedScopes: ["patient/*.read", "patient/*.write"],
    isActive: true,
    rateLimitConfig: { requestsPerMinute: 20, requestsPerHour: 200, burstLimit: 5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function initializeSampleConnections(): void {
  sampleConnections.forEach((conn) => connections.set(conn.id, conn));
}

initializeSampleConnections();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logGatewayAudit(
  entry: Omit<GatewayAuditEntry, "id" | "timestamp">,
): Promise<string> {
  const auditId = generateId();
  
  const hashedUserId = entry.userId ? hashIdentifier(entry.userId) : "anonymous";
  const hashedPatientId = entry.patientId ? hashIdentifier(entry.patientId) : "none";
  const hashedIp = entry.ipAddress ? hashIdentifier(entry.ipAddress) : "unknown";
  
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashedUserId,
      userRole: "system",
      action: entry.direction === "inbound" ? "read" : "create",
      resourceType: `FHIRGateway-${entry.exchangeType}`,
      resourceId: entry.requestId ? hashIdentifier(entry.requestId) : auditId,
      patientId: hashedPatientId,
      ipAddress: hashedIp,
      userAgent: entry.userAgent ? entry.userAgent.substring(0, 50) : "unknown",
      requestPath: `/api/fhir-gateway/${entry.direction}`,
      requestMethod: entry.direction === "inbound" ? "GET" : "POST",
      responseStatus: entry.status === "success" ? 200 : entry.status === "denied" ? 403 : 500,
      responseTimeMs: entry.responseTimeMs,
      phiAccessed: true,
      details: {
        gatewayAction: entry.direction,
        exchangeType: entry.exchangeType,
        resourceType: entry.resourceType,
        externalSystemId: entry.externalSystemId,
        connectionId: entry.connectionId,
        scopes: entry.scopes.join(","),
        consentId: entry.consentId || "none",
        status: entry.status,
        errorCode: entry.errorCode,
        userIdHash: hashedUserId,
        patientIdHash: hashedPatientId,
      },
    });
  } catch (e) {
    console.error("[FHIRGateway] Audit logging failed:", e);
  }
  
  return auditId;
}

function checkRateLimit(connectionId: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  let counter = rateLimitCounters.get(connectionId);
  
  if (!counter) {
    counter = { minute: 0, hour: 0, lastMinuteReset: now, lastHourReset: now };
    rateLimitCounters.set(connectionId, counter);
  }
  
  if (now - counter.lastMinuteReset > 60000) {
    counter.minute = 0;
    counter.lastMinuteReset = now;
  }
  
  if (now - counter.lastHourReset > 3600000) {
    counter.hour = 0;
    counter.lastHourReset = now;
  }
  
  if (counter.minute >= config.requestsPerMinute) {
    return { allowed: false, retryAfterMs: 60000 - (now - counter.lastMinuteReset) };
  }
  
  if (counter.hour >= config.requestsPerHour) {
    return { allowed: false, retryAfterMs: 3600000 - (now - counter.lastHourReset) };
  }
  
  counter.minute++;
  counter.hour++;
  rateLimitCounters.set(connectionId, counter);
  
  return { allowed: true };
}

export const validateDemographicsSchema = z.object({
  identifier: z.array(z.object({
    system: z.string().optional(),
    value: z.string(),
  })).optional(),
  name: z.array(z.object({
    use: z.string().optional(),
    family: z.string().optional(),
    given: z.array(z.string()).optional(),
  })).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().optional(),
  address: z.array(z.object({
    use: z.string().optional(),
    line: z.array(z.string()).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })).optional(),
  telecom: z.array(z.object({
    system: z.string().optional(),
    value: z.string().optional(),
    use: z.string().optional(),
  })).optional(),
});

export const validateClinicalSummarySchema = z.object({
  resourceType: z.literal("Composition").or(z.literal("Bundle")),
  status: z.string().optional(),
  type: z.object({
    coding: z.array(z.object({
      system: z.string().optional(),
      code: z.string(),
      display: z.string().optional(),
    })).optional(),
  }).optional(),
  subject: z.object({
    reference: z.string().optional(),
    display: z.string().optional(),
  }).optional(),
  date: z.string().optional(),
  section: z.array(z.object({
    title: z.string().optional(),
    code: z.object({
      coding: z.array(z.object({
        system: z.string().optional(),
        code: z.string(),
        display: z.string().optional(),
      })).optional(),
    }).optional(),
    text: z.object({
      status: z.string().optional(),
      div: z.string().optional(),
    }).optional(),
    entry: z.array(z.object({
      reference: z.string().optional(),
    })).optional(),
  })).optional(),
});

export const validateOutreachStatusSchema = z.object({
  resourceType: z.literal("Communication").or(z.literal("Task")),
  status: z.enum(["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"]),
  priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  subject: z.object({
    reference: z.string().optional(),
    display: z.string().optional(),
  }).optional(),
  sent: z.string().optional(),
  received: z.string().optional(),
  payload: z.array(z.object({
    contentString: z.string().optional(),
    contentReference: z.object({
      reference: z.string().optional(),
    }).optional(),
  })).optional(),
});

export const fhirGatewayService = {
  getConnections(): GatewayConnection[] {
    return Array.from(connections.values());
  },

  getConnection(id: string): GatewayConnection | undefined {
    return connections.get(id);
  },

  getActiveConnections(): GatewayConnection[] {
    return Array.from(connections.values()).filter(c => c.isActive);
  },

  async createConnection(
    data: Omit<GatewayConnection, "id" | "createdAt" | "updatedAt">,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<GatewayConnection> {
    const id = generateId();
    const now = new Date().toISOString();
    
    const connection: GatewayConnection = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    connections.set(id, connection);
    
    await logGatewayAudit({
      requestId: id,
      connectionId: id,
      externalSystemId: data.externalSystemId,
      direction: "outbound",
      exchangeType: "demographics",
      resourceType: "GatewayConnection",
      patientId: "system",
      userId,
      scopes: [],
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: 0,
    });
    
    return connection;
  },

  async updateConnection(
    id: string,
    updates: Partial<GatewayConnection>,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<GatewayConnection | null> {
    const connection = connections.get(id);
    if (!connection) return null;
    
    const updated: GatewayConnection = {
      ...connection,
      ...updates,
      id: connection.id,
      createdAt: connection.createdAt,
      updatedAt: new Date().toISOString(),
    };
    
    connections.set(id, updated);
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId: id,
      externalSystemId: connection.externalSystemId,
      direction: "outbound",
      exchangeType: "demographics",
      resourceType: "GatewayConnection",
      patientId: "system",
      userId,
      scopes: [],
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: 0,
    });
    
    return updated;
  },

  startSMARTAuth(connectionId: string): { authUrl: string; state: string } | null {
    const connection = connections.get(connectionId);
    if (!connection || connection.authType !== "smart_on_fhir") return null;
    
    const authConfig = connection.authConfig as SMARTAuthConfig;
    const codeVerifier = generatePKCEVerifier();
    const codeChallenge = generatePKCEChallenge(codeVerifier);
    const state = generateState();
    const nonce = generateNonce();
    
    const pkceSession: PKCESession = {
      connectionId,
      codeVerifier,
      codeChallenge,
      state,
      nonce,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    
    pkceSessions.set(state, pkceSession);
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      scope: authConfig.scopes.join(" "),
      state,
      nonce,
      aud: connection.fhirEndpoint,
    });
    
    if (authConfig.pkceRequired) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    
    const authUrl = `${authConfig.authorizeEndpoint}?${params.toString()}`;
    
    return { authUrl, state };
  },

  async handleAuthCallback(
    state: string,
    code: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const pkceSession = pkceSessions.get(state);
    if (!pkceSession) {
      return { success: false, error: "Invalid or expired state parameter" };
    }
    
    if (new Date(pkceSession.expiresAt) < new Date()) {
      pkceSessions.delete(state);
      return { success: false, error: "Authentication session expired" };
    }
    
    const connection = connections.get(pkceSession.connectionId);
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }
    
    const authConfig = connection.authConfig as SMARTAuthConfig;
    
    const tokenData: TokenData = {
      accessToken: `mock-access-token-${Date.now()}`,
      refreshToken: `mock-refresh-token-${Date.now()}`,
      tokenType: "Bearer",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scopes: authConfig.scopes,
      patientId: "sample-patient-id",
    };
    
    const updatedConnection: GatewayConnection = {
      ...connection,
      tokenData,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    connections.set(connection.id, updatedConnection);
    pkceSessions.delete(state);
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId: connection.id,
      externalSystemId: connection.externalSystemId,
      direction: "inbound",
      exchangeType: "demographics",
      resourceType: "OAuthToken",
      patientId: tokenData.patientId || "unknown",
      userId,
      scopes: authConfig.scopes,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: 0,
    });
    
    return { success: true, connectionId: connection.id };
  },

  async refreshToken(connectionId: string, userId: string, ipAddress: string, userAgent: string): Promise<boolean> {
    const connection = connections.get(connectionId);
    if (!connection || !connection.tokenData?.refreshToken) return false;
    
    const newTokenData: TokenData = {
      ...connection.tokenData,
      accessToken: `refreshed-access-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    
    const updatedConnection: GatewayConnection = {
      ...connection,
      tokenData: newTokenData,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    connections.set(connectionId, updatedConnection);
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId,
      externalSystemId: connection.externalSystemId,
      direction: "inbound",
      exchangeType: "demographics",
      resourceType: "OAuthTokenRefresh",
      patientId: connection.tokenData.patientId || "unknown",
      userId,
      scopes: connection.tokenData.scopes,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: 0,
    });
    
    return true;
  },

  isTokenValid(connectionId: string): boolean {
    const connection = connections.get(connectionId);
    if (!connection?.tokenData) return false;
    return new Date(connection.tokenData.expiresAt) > new Date();
  },

  hasRequiredScopes(connectionId: string, requiredScopes: GatewayScope[]): boolean {
    const connection = connections.get(connectionId);
    if (!connection?.tokenData) return false;
    
    return requiredScopes.every(scope => 
      connection.tokenData!.scopes.some(s => 
        s === scope || s.startsWith(scope.split(".")[0])
      )
    );
  },

  async fetchDemographics(
    connectionId: string,
    patientId: string,
    userId: string,
    consentVerified: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    const startTime = Date.now();
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }
    
    const rateLimitResult = checkRateLimit(connectionId, connection.rateLimitConfig);
    if (!rateLimitResult.allowed) {
      await logGatewayAudit({
        requestId: generateId(),
        connectionId,
        externalSystemId: connection.externalSystemId,
        direction: "inbound",
        exchangeType: "demographics",
        resourceType: "Patient",
        patientId,
        userId,
        scopes: [],
        status: "failure",
        errorCode: "RATE_LIMITED",
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });
      return { success: false, error: `Rate limited. Retry after ${rateLimitResult.retryAfterMs}ms` };
    }
    
    if (!consentVerified) {
      await logGatewayAudit({
        requestId: generateId(),
        connectionId,
        externalSystemId: connection.externalSystemId,
        direction: "inbound",
        exchangeType: "demographics",
        resourceType: "Patient",
        patientId,
        userId,
        scopes: [],
        status: "denied",
        errorCode: "CONSENT_NOT_VERIFIED",
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });
      return { success: false, error: "Patient consent not verified for this data exchange" };
    }
    
    if (!this.isTokenValid(connectionId)) {
      const refreshed = await this.refreshToken(connectionId, userId, ipAddress, userAgent);
      if (!refreshed) {
        return { success: false, error: "Authentication expired. Please re-authenticate." };
      }
    }
    
    const demographics = {
      resourceType: "Patient",
      id: patientId,
      identifier: [
        { system: "http://hospital.example.org", value: patientId },
        { system: "http://hl7.org/fhir/sid/us-ssn", value: "[REDACTED]" },
      ],
      name: [{ use: "official", family: "Thompson", given: ["Margaret", "Ann"] }],
      gender: "female",
      birthDate: "1958-03-15",
      address: [{
        use: "home",
        line: ["123 Main Street"],
        city: "Springfield",
        state: "IL",
        postalCode: "62701",
        country: "USA",
      }],
      telecom: [
        { system: "phone", value: "(555) 123-4567", use: "home" },
        { system: "email", value: "m.thompson@email.com", use: "home" },
      ],
      active: true,
    };
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId,
      externalSystemId: connection.externalSystemId,
      direction: "inbound",
      exchangeType: "demographics",
      resourceType: "Patient",
      patientId,
      userId,
      scopes: connection.tokenData?.scopes || [],
      consentId: connection.consentPolicyId,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: Date.now() - startTime,
    });
    
    return { success: true, data: demographics };
  },

  async fetchClinicalSummary(
    connectionId: string,
    patientId: string,
    userId: string,
    consentVerified: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    const startTime = Date.now();
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }
    
    const rateLimitResult = checkRateLimit(connectionId, connection.rateLimitConfig);
    if (!rateLimitResult.allowed) {
      return { success: false, error: `Rate limited. Retry after ${rateLimitResult.retryAfterMs}ms` };
    }
    
    if (!consentVerified) {
      await logGatewayAudit({
        requestId: generateId(),
        connectionId,
        externalSystemId: connection.externalSystemId,
        direction: "inbound",
        exchangeType: "clinical_summary",
        resourceType: "Composition",
        patientId,
        userId,
        scopes: [],
        status: "denied",
        errorCode: "CONSENT_NOT_VERIFIED",
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });
      return { success: false, error: "Patient consent not verified for this data exchange" };
    }
    
    const clinicalSummary = {
      resourceType: "Composition",
      id: `summary-${patientId}`,
      status: "final",
      type: {
        coding: [{
          system: "http://loinc.org",
          code: "34133-9",
          display: "Summary of episode note",
        }],
      },
      subject: { reference: `Patient/${patientId}`, display: "Margaret Thompson" },
      date: new Date().toISOString(),
      author: [{ display: "Fasten Health System" }],
      title: "Clinical Summary",
      section: [
        {
          title: "Active Conditions",
          code: { coding: [{ system: "http://loinc.org", code: "11450-4", display: "Problem list" }] },
          entry: [
            { reference: "Condition/cond-1", display: "Type 2 Diabetes Mellitus" },
            { reference: "Condition/cond-2", display: "Essential Hypertension" },
            { reference: "Condition/cond-3", display: "Hyperlipidemia" },
          ],
        },
        {
          title: "Current Medications",
          code: { coding: [{ system: "http://loinc.org", code: "10160-0", display: "Medication use" }] },
          entry: [
            { reference: "MedicationRequest/med-1", display: "Metformin 1000mg twice daily" },
            { reference: "MedicationRequest/med-2", display: "Lisinopril 20mg daily" },
            { reference: "MedicationRequest/med-3", display: "Atorvastatin 40mg daily" },
          ],
        },
        {
          title: "Allergies",
          code: { coding: [{ system: "http://loinc.org", code: "48765-2", display: "Allergies and adverse reactions" }] },
          entry: [
            { reference: "AllergyIntolerance/allergy-1", display: "Penicillin - Hives" },
          ],
        },
      ],
    };
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId,
      externalSystemId: connection.externalSystemId,
      direction: "inbound",
      exchangeType: "clinical_summary",
      resourceType: "Composition",
      patientId,
      userId,
      scopes: connection.tokenData?.scopes || [],
      consentId: connection.consentPolicyId,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: Date.now() - startTime,
    });
    
    return { success: true, data: clinicalSummary };
  },

  async pushOutreachStatus(
    connectionId: string,
    patientId: string,
    outreachData: Record<string, unknown>,
    userId: string,
    consentVerified: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    const startTime = Date.now();
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }
    
    if (!connection.supportedExchangeTypes.includes("outreach_status")) {
      return { success: false, error: "Connection does not support outreach status exchange" };
    }
    
    const rateLimitResult = checkRateLimit(connectionId, connection.rateLimitConfig);
    if (!rateLimitResult.allowed) {
      return { success: false, error: `Rate limited. Retry after ${rateLimitResult.retryAfterMs}ms` };
    }
    
    if (!consentVerified) {
      await logGatewayAudit({
        requestId: generateId(),
        connectionId,
        externalSystemId: connection.externalSystemId,
        direction: "outbound",
        exchangeType: "outreach_status",
        resourceType: "Communication",
        patientId,
        userId,
        scopes: [],
        status: "denied",
        errorCode: "CONSENT_NOT_VERIFIED",
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });
      return { success: false, error: "Patient consent not verified for this data exchange" };
    }
    
    const validationResult = validateOutreachStatusSchema.safeParse(outreachData);
    if (!validationResult.success) {
      return { success: false, error: `Validation failed: ${validationResult.error.message}` };
    }
    
    const resourceId = `comm-${Date.now()}`;
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId,
      externalSystemId: connection.externalSystemId,
      direction: "outbound",
      exchangeType: "outreach_status",
      resourceType: "Communication",
      patientId,
      userId,
      scopes: connection.tokenData?.scopes || [],
      consentId: connection.consentPolicyId,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: Date.now() - startTime,
    });
    
    return { success: true, resourceId };
  },

  async pushDemographics(
    connectionId: string,
    patientData: Record<string, unknown>,
    userId: string,
    consentVerified: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    const startTime = Date.now();
    const connection = connections.get(connectionId);
    
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }
    
    const rateLimitResult = checkRateLimit(connectionId, connection.rateLimitConfig);
    if (!rateLimitResult.allowed) {
      return { success: false, error: `Rate limited. Retry after ${rateLimitResult.retryAfterMs}ms` };
    }
    
    if (!consentVerified) {
      await logGatewayAudit({
        requestId: generateId(),
        connectionId,
        externalSystemId: connection.externalSystemId,
        direction: "outbound",
        exchangeType: "demographics",
        resourceType: "Patient",
        patientId: (patientData as any).id || "unknown",
        userId,
        scopes: [],
        status: "denied",
        errorCode: "CONSENT_NOT_VERIFIED",
        ipAddress,
        userAgent,
        responseTimeMs: Date.now() - startTime,
      });
      return { success: false, error: "Patient consent not verified for this data exchange" };
    }
    
    const validationResult = validateDemographicsSchema.safeParse(patientData);
    if (!validationResult.success) {
      return { success: false, error: `Validation failed: ${validationResult.error.message}` };
    }
    
    const resourceId = (patientData as any).id || `patient-${Date.now()}`;
    
    await logGatewayAudit({
      requestId: generateId(),
      connectionId,
      externalSystemId: connection.externalSystemId,
      direction: "outbound",
      exchangeType: "demographics",
      resourceType: "Patient",
      patientId: resourceId,
      userId,
      scopes: connection.tokenData?.scopes || [],
      consentId: connection.consentPolicyId,
      status: "success",
      ipAddress,
      userAgent,
      responseTimeMs: Date.now() - startTime,
    });
    
    return { success: true, resourceId };
  },

  getConnectionStatus(connectionId: string): {
    connected: boolean;
    authenticated: boolean;
    tokenValid: boolean;
    lastActivity?: string;
    scopes: string[];
  } | null {
    const connection = connections.get(connectionId);
    if (!connection) return null;
    
    return {
      connected: connection.isActive,
      authenticated: !!connection.tokenData,
      tokenValid: this.isTokenValid(connectionId),
      lastActivity: connection.lastActivityAt,
      scopes: connection.tokenData?.scopes || [],
    };
  },

  getGatewayStats(): {
    totalConnections: number;
    activeConnections: number;
    authenticatedConnections: number;
    supportedExchangeTypes: ExchangeType[];
  } {
    const allConnections = Array.from(connections.values());
    const exchangeTypes = new Set<ExchangeType>();
    
    allConnections.forEach(c => c.supportedExchangeTypes.forEach(t => exchangeTypes.add(t)));
    
    return {
      totalConnections: allConnections.length,
      activeConnections: allConnections.filter(c => c.isActive).length,
      authenticatedConnections: allConnections.filter(c => c.tokenData && this.isTokenValid(c.id)).length,
      supportedExchangeTypes: Array.from(exchangeTypes),
    };
  },
};
