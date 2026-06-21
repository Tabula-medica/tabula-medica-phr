import { randomUUID, createHash, randomBytes } from "crypto";

/**
 * SMART App Launch Service
 * 
 * SECURITY NOTES FOR PRODUCTION DEPLOYMENT:
 * 1. All SMART endpoints must be protected with authentication/RBAC
 * 2. Discovery URLs should be validated against an allowlist to prevent SSRF
 * 3. Client secrets must be stored encrypted and never returned in GET responses
 * 4. Token endpoints should validate issuer/audience/nonce per SMART spec
 * 5. Rate limiting should be applied to prevent abuse
 * 
 * This implementation provides the framework for SMART on FHIR integration.
 * Production deployments require additional security hardening.
 */

export interface SMARTConfig {
  id: string;
  ownerId?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string;
  fhirBaseUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  introspectionEndpoint?: string;
  revocationEndpoint?: string;
  managementEndpoint?: string;
  launchContext?: LaunchContext;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchContext {
  patient?: string;
  encounter?: string;
  practitioner?: string;
  organization?: string;
  location?: string;
  intent?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
}

export interface PKCESession {
  id: string;
  configId: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  launchContext?: LaunchContext;
  expiresAt: Date;
  createdAt: Date;
  userId: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  patient?: string;
  encounter?: string;
  practitioner?: string;
  id_token?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
}

export interface ActiveSession {
  id: string;
  configId: string;
  userId?: string;
  ownerId?: string;
  patientId?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  expiresAt: Date;
  launchContext?: LaunchContext;
  createdAt: Date;
}

export interface WellKnownConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  scopes_supported?: string[];
  response_types_supported?: string[];
  capabilities?: string[];
  code_challenge_methods_supported?: string[];
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = Object.entries(details)
    .map(([k, v]) => `${k}:${typeof v === "string" && k.includes("Id") ? hashIdentifier(v) : v}`)
    .join(" ");
  console.log(`[HIPAA-AUDIT][SMART] ${timestamp} - ${action} - ${sanitizedDetails}`);
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

const SMART_SCOPES = {
  patientRead: "patient/*.read",
  patientWrite: "patient/*.write",
  patientAll: "patient/*.*",
  userRead: "user/*.read",
  userWrite: "user/*.write",
  userAll: "user/*.*",
  launchPatient: "launch/patient",
  launchEncounter: "launch/encounter",
  launchPractitioner: "launch/practitioner",
  openid: "openid",
  fhirUser: "fhirUser",
  profile: "profile",
  offlineAccess: "offline_access",
  onlineAccess: "online_access",
};

const US_CORE_SCOPES = [
  "patient/Patient.read",
  "patient/Observation.read",
  "patient/Condition.read",
  "patient/MedicationRequest.read",
  "patient/AllergyIntolerance.read",
  "patient/Procedure.read",
  "patient/Immunization.read",
  "patient/DiagnosticReport.read",
  "patient/CarePlan.read",
  "patient/Goal.read",
  "patient/Encounter.read",
  "patient/DocumentReference.read",
];

class SMARTAppLaunchService {
  private configs: Map<string, SMARTConfig> = new Map();
  private pkceSessions: Map<string, PKCESession> = new Map();
  private activeSessions: Map<string, ActiveSession> = new Map();
  private wellKnownCache: Map<string, { config: WellKnownConfiguration; expiresAt: Date }> = new Map();

  constructor() {
    console.log("[SMART] SMART App Launch service initialized");
    console.log("[SMART] Supported scopes:", Object.keys(SMART_SCOPES).join(", "));
    console.log("[SMART] US Core resource scopes:", US_CORE_SCOPES.length);
  }

  async discoverConfiguration(fhirBaseUrl: string): Promise<WellKnownConfiguration | null> {
    const cached = this.wellKnownCache.get(fhirBaseUrl);
    if (cached && cached.expiresAt > new Date()) {
      return cached.config;
    }

    try {
      const wellKnownUrl = `${fhirBaseUrl.replace(/\/$/, "")}/.well-known/smart-configuration`;
      const response = await fetch(wellKnownUrl, {
        headers: { Accept: "application/json" },
        redirect: "manual",
      });

      if (!response.ok) {
        const metadataUrl = `${fhirBaseUrl.replace(/\/$/, "")}/metadata`;
        const metaResponse = await fetch(metadataUrl, {
          headers: { Accept: "application/fhir+json" },
          redirect: "manual",
        });

        if (metaResponse.ok) {
          const capability = await metaResponse.json();
          const security = capability.rest?.[0]?.security;
          const oauthExtension = security?.extension?.find(
            (e: any) => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
          );

          if (oauthExtension) {
            const getUri = (name: string) =>
              oauthExtension.extension?.find((e: any) => e.url === name)?.valueUri;

            const config: WellKnownConfiguration = {
              issuer: fhirBaseUrl,
              authorization_endpoint: getUri("authorize") || "",
              token_endpoint: getUri("token") || "",
              registration_endpoint: getUri("register"),
              capabilities: ["launch-ehr", "launch-standalone", "client-public", "client-confidential-symmetric"],
              code_challenge_methods_supported: ["S256"],
            };

            this.wellKnownCache.set(fhirBaseUrl, {
              config,
              expiresAt: new Date(Date.now() + 3600000),
            });

            return config;
          }
        }

        return null;
      }

      const config = await response.json() as WellKnownConfiguration;
      this.wellKnownCache.set(fhirBaseUrl, {
        config,
        expiresAt: new Date(Date.now() + 3600000),
      });

      logHipaaAudit("SMART_DISCOVERY_SUCCESS", {
        fhirBaseUrl,
        hasAuth: !!config.authorization_endpoint,
        hasToken: !!config.token_endpoint,
      });

      return config;
    } catch (error) {
      logHipaaAudit("SMART_DISCOVERY_FAILED", {
        fhirBaseUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  async registerApp(config: Omit<SMARTConfig, "id" | "createdAt" | "updatedAt">): Promise<SMARTConfig> {
    const id = `smart-config-${randomUUID().slice(0, 8)}`;
    const fullConfig: SMARTConfig = {
      ...config,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.configs.set(id, fullConfig);

    logHipaaAudit("SMART_APP_REGISTERED", {
      configId: id,
      clientId: config.clientId,
      fhirBaseUrl: config.fhirBaseUrl,
      scope: config.scope,
    });

    return fullConfig;
  }

  initiateAuthorization(
    configId: string,
    userId: string,
    launchContext?: LaunchContext,
    additionalState?: Record<string, unknown>
  ): { authorizationUrl: string; sessionId: string } {
    const config = this.configs.get(configId);
    if (!config) {
      throw new Error("SMART configuration not found");
    }

    const state = randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const pkceSession: PKCESession = {
      id: randomUUID(),
      configId,
      state,
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: "S256",
      launchContext,
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
      userId,
    };

    this.pkceSessions.set(state, pkceSession);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      aud: config.fhirBaseUrl,
    });

    if (launchContext?.patient) {
      params.set("launch", launchContext.patient);
    }

    const authorizationUrl = `${config.authorizationEndpoint}?${params.toString()}`;

    logHipaaAudit("SMART_AUTH_INITIATED", {
      configId,
      sessionId: pkceSession.id,
      scope: config.scope,
    });

    return { authorizationUrl, sessionId: pkceSession.id };
  }

  async exchangeCodeForToken(
    code: string,
    state: string,
    ownerId?: string
  ): Promise<{ session: ActiveSession; tokenResponse: TokenResponse }> {
    const pkceSession = this.pkceSessions.get(state);
    if (!pkceSession) {
      throw new Error("Invalid or expired PKCE session");
    }

    if (pkceSession.expiresAt < new Date()) {
      this.pkceSessions.delete(state);
      throw new Error("PKCE session expired");
    }

    const config = this.configs.get(pkceSession.configId);
    if (!config) {
      throw new Error("SMART configuration not found");
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: pkceSession.codeVerifier,
    });

    if (config.clientSecret) {
      tokenParams.set("client_secret", config.clientSecret);
    }

    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logHipaaAudit("SMART_TOKEN_EXCHANGE_FAILED", {
        configId: config.id,
        error: errorText,
      });
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json() as TokenResponse;

    const session: ActiveSession = {
      id: randomUUID(),
      configId: config.id,
      userId: pkceSession.userId,
      ownerId,
      patientId: tokens.patient,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      launchContext: {
        ...pkceSession.launchContext,
        patient: tokens.patient,
        encounter: tokens.encounter,
        practitioner: tokens.practitioner,
        need_patient_banner: tokens.need_patient_banner,
        smart_style_url: tokens.smart_style_url,
      },
      createdAt: new Date(),
    };

    this.activeSessions.set(session.id, session);
    this.pkceSessions.delete(state);

    logHipaaAudit("SMART_TOKEN_EXCHANGE_SUCCESS", {
      configId: config.id,
      sessionId: session.id,
      patientId: tokens.patient,
      scope: tokens.scope,
    });

    return { session, tokenResponse: tokens };
  }

  async refreshToken(sessionId: string, callerId?: string): Promise<ActiveSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (callerId && session.ownerId && session.ownerId !== callerId) {
      throw new Error("Access denied: session not owned by caller");
    }

    if (!session.refreshToken) {
      throw new Error("No refresh token available");
    }

    const config = this.configs.get(session.configId);
    if (!config) {
      throw new Error("SMART configuration not found");
    }

    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      tokenParams.set("client_secret", config.clientSecret);
    }

    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      logHipaaAudit("SMART_TOKEN_REFRESH_FAILED", {
        sessionId,
        configId: config.id,
      });
      throw new Error("Token refresh failed");
    }

    const tokens = await tokenResponse.json() as TokenResponse;

    session.accessToken = tokens.access_token;
    session.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    if (tokens.refresh_token) {
      session.refreshToken = tokens.refresh_token;
    }

    this.activeSessions.set(sessionId, session);

    logHipaaAudit("SMART_TOKEN_REFRESH_SUCCESS", {
      sessionId,
      configId: config.id,
    });

    return session;
  }

  async makeFHIRRequest(
    sessionId: string,
    resourcePath: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    callerId?: string
  ): Promise<unknown> {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (callerId && session.ownerId && session.ownerId !== callerId) {
      throw new Error("Access denied: session not owned by caller");
    }

    if (session.expiresAt <= new Date()) {
      if (session.refreshToken) {
        session = await this.refreshToken(sessionId);
      } else {
        throw new Error("Session expired and no refresh token available");
      }
    }

    const config = this.configs.get(session.configId);
    if (!config) {
      throw new Error("SMART configuration not found");
    }

    const url = `${config.fhirBaseUrl}/${resourcePath}`;
    const headers: Record<string, string> = {
      Authorization: `${session.tokenType} ${session.accessToken}`,
      Accept: "application/fhir+json",
    };

    if (body) {
      headers["Content-Type"] = "application/fhir+json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    logHipaaAudit("SMART_FHIR_REQUEST", {
      sessionId,
      method,
      resourcePath,
      statusCode: response.status,
    });

    if (!response.ok) {
      throw new Error(`FHIR request failed: ${response.status}`);
    }

    return response.json();
  }

  revokeSession(sessionId: string, callerId?: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    if (callerId && session.ownerId && session.ownerId !== callerId) {
      return false;
    }

    this.activeSessions.delete(sessionId);

    logHipaaAudit("SMART_SESSION_REVOKED", {
      sessionId,
      configId: session.configId,
    });

    return true;
  }

  getSession(sessionId: string): ActiveSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getConfig(configId: string): SMARTConfig | undefined {
    return this.configs.get(configId);
  }

  getAllConfigs(): SMARTConfig[] {
    return Array.from(this.configs.values());
  }

  getAllConfigsForOwner(ownerId: string): Omit<SMARTConfig, "clientSecret">[] {
    return Array.from(this.configs.values())
      .filter(c => !c.ownerId || c.ownerId === ownerId)
      .map(({ clientSecret: _secret, ...safe }) => safe);
  }

  getActiveSessions(): ActiveSession[] {
    return Array.from(this.activeSessions.values());
  }

  getActiveSessionsByUser(userId: string): ActiveSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.userId === userId || s.ownerId === userId);
  }

  getActiveSessionsForOwner(ownerId: string): ActiveSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.ownerId === ownerId);
  }

  getSessionForOwner(sessionId: string, ownerId: string): ActiveSession | undefined {
    const session = this.activeSessions.get(sessionId);
    if (!session) return undefined;
    if (session.ownerId && session.ownerId !== ownerId) return undefined;
    return session;
  }

  getSupportedScopes(): typeof SMART_SCOPES {
    return SMART_SCOPES;
  }

  getUSCoreScopes(): string[] {
    return [...US_CORE_SCOPES];
  }

  generateStandaloneScope(resources: string[], includeWrite: boolean = false): string {
    const baseScopes = ["openid", "fhirUser", "launch/patient"];
    const resourceScopes = resources.map(r => 
      includeWrite ? `patient/${r}.*` : `patient/${r}.read`
    );
    return [...baseScopes, ...resourceScopes].join(" ");
  }

  generateEHRLaunchScope(resources: string[], includeWrite: boolean = false): string {
    const baseScopes = ["openid", "fhirUser", "launch"];
    const resourceScopes = resources.map(r => 
      includeWrite ? `patient/${r}.*` : `patient/${r}.read`
    );
    return [...baseScopes, ...resourceScopes].join(" ");
  }
}

export const smartAppLaunchService = new SMARTAppLaunchService();
