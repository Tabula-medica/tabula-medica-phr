import { fhirAuditService } from "./fhir-audit-service";

export const FHIR_OAUTH_VERSION = "1.0.0";

export type OAuthGrantType = "authorization_code" | "client_credentials" | "refresh_token";
export type AuthMethod = "oauth2" | "oidc" | "smart_on_fhir" | "basic" | "api_key" | "mtls";

export interface OAuthClientConfig {
  id: string;
  name: string;
  description: string;
  endpointId: string;
  authMethod: AuthMethod;
  grantType: OAuthGrantType;
  clientId: string;
  clientSecretHash?: string;
  redirectUri?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  issuer?: string;
  scopes: string[];
  smartAppLaunch?: {
    launchUri: string;
    redirectUri: string;
    capabilities: string[];
  };
  tokenLifetime: number;
  refreshTokenEnabled: boolean;
  pkceEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface OAuthToken {
  id: string;
  clientConfigId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresAt: string;
  refreshExpiresAt?: string;
  scopes: string[];
  issuedAt: string;
  lastUsed?: string;
  isRevoked: boolean;
}

export interface OAuthAuthorizationRequest {
  id: string;
  clientConfigId: string;
  userId: string;
  state: string;
  nonce?: string;
  codeVerifier?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  redirectUri: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
}

export interface SmartOnFhirContext {
  patient?: string;
  encounter?: string;
  fhirUser?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
}

export interface TokenExchangeResult {
  success: boolean;
  token?: OAuthToken;
  error?: string;
  errorDescription?: string;
}

export interface OAuthAuditEntry {
  id: string;
  timestamp: string;
  action: "authorize" | "token_issue" | "token_refresh" | "token_revoke" | "token_validate" | "introspect";
  clientConfigId: string;
  userId?: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  scopes?: string[];
  errorCode?: string;
  errorMessage?: string;
  tokenId?: string;
  endpointId?: string;
}

class FhirOAuthService {
  private clientConfigs: Map<string, OAuthClientConfig> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();
  private authRequests: Map<string, OAuthAuthorizationRequest> = new Map();
  private auditEntries: OAuthAuditEntry[] = [];

  constructor() {
    this.initializeSampleData();
    console.log("[FHIROAuth] Service initialized");
    console.log(`[FHIROAuth] Version: ${FHIR_OAUTH_VERSION}`);
    console.log("[FHIROAuth] Features: OAuth 2.0, OpenID Connect, SMART on FHIR, PKCE");
  }

  private initializeSampleData(): void {
    const now = new Date().toISOString();

    const sampleConfigs: OAuthClientConfig[] = [
      {
        id: "oauth-epic-prod",
        name: "Fasten Health OAuth",
        description: "OAuth 2.0 configuration for Fasten Health FHIR API",
        endpointId: "epic-prod",
        authMethod: "smart_on_fhir",
        grantType: "authorization_code",
        clientId: "tabula-medica-epic-client",
        clientSecretHash: "hashed_secret_epic",
        redirectUri: "https://tabulamedica.app/oauth/callback/epic",
        authorizationEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
        tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
        jwksUri: "https://fhir.epic.com/interconnect-fhir-oauth/.well-known/jwks.json",
        issuer: "https://fhir.epic.com",
        scopes: ["openid", "fhirUser", "launch/patient", "patient/*.read", "offline_access"],
        smartAppLaunch: {
          launchUri: "https://tabulamedica.app/launch/epic",
          redirectUri: "https://tabulamedica.app/oauth/callback/epic",
          capabilities: ["launch-standalone", "launch-ehr", "context-standalone-patient", "sso-openid-connect"]
        },
        tokenLifetime: 3600,
        refreshTokenEnabled: true,
        pkceEnabled: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "system"
      },
      {
        id: "oauth-cerner-prod",
        name: "Hospital Network OAuth",
        description: "OAuth 2.0 configuration for Hospital FHIR API",
        endpointId: "cerner-prod",
        authMethod: "smart_on_fhir",
        grantType: "authorization_code",
        clientId: "tabula-medica-cerner-client",
        redirectUri: "https://tabulamedica.app/oauth/callback/cerner",
        authorizationEndpoint: "https://authorization.cerner.com/tenants/{tenant}/oidc/token",
        tokenEndpoint: "https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token",
        issuer: "https://authorization.cerner.com",
        scopes: ["openid", "fhirUser", "patient/Patient.read", "patient/Observation.read", "offline_access"],
        tokenLifetime: 3600,
        refreshTokenEnabled: true,
        pkceEnabled: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "system"
      },
      {
        id: "oauth-backend-sync",
        name: "Backend Sync Client",
        description: "Client credentials for server-to-server sync operations",
        endpointId: "internal-fhir",
        authMethod: "oauth2",
        grantType: "client_credentials",
        clientId: "tabula-medica-sync-service",
        clientSecretHash: "hashed_secret_sync",
        tokenEndpoint: "https://auth.internal.tabulamedica.app/oauth/token",
        scopes: ["system/*.read", "system/*.write"],
        tokenLifetime: 1800,
        refreshTokenEnabled: false,
        pkceEnabled: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "system"
      }
    ];

    sampleConfigs.forEach(c => this.clientConfigs.set(c.id, c));
  }

  async createClientConfig(config: Omit<OAuthClientConfig, "id" | "createdAt" | "updatedAt">): Promise<OAuthClientConfig> {
    const id = `oauth-${Date.now()}`;
    const now = new Date().toISOString();
    
    const newConfig: OAuthClientConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.clientConfigs.set(id, newConfig);

    this.addAuditEntry({
      action: "authorize",
      clientConfigId: id,
      success: true,
      ipAddress: "system",
      userAgent: "internal"
    });

    return newConfig;
  }

  async getClientConfig(id: string): Promise<OAuthClientConfig | undefined> {
    return this.clientConfigs.get(id);
  }

  async listClientConfigs(filter?: { endpointId?: string; authMethod?: AuthMethod; isActive?: boolean }): Promise<OAuthClientConfig[]> {
    let configs = Array.from(this.clientConfigs.values());

    if (filter?.endpointId) {
      configs = configs.filter(c => c.endpointId === filter.endpointId);
    }
    if (filter?.authMethod) {
      configs = configs.filter(c => c.authMethod === filter.authMethod);
    }
    if (filter?.isActive !== undefined) {
      configs = configs.filter(c => c.isActive === filter.isActive);
    }

    return configs;
  }

  async updateClientConfig(id: string, updates: Partial<OAuthClientConfig>): Promise<OAuthClientConfig | null> {
    const existing = this.clientConfigs.get(id);
    if (!existing) return null;

    const updated: OAuthClientConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    this.clientConfigs.set(id, updated);
    return updated;
  }

  async deleteClientConfig(id: string): Promise<boolean> {
    const existing = this.clientConfigs.get(id);
    if (!existing) return false;

    for (const token of Array.from(this.tokens.values())) {
      if (token.clientConfigId === id) {
        token.isRevoked = true;
      }
    }

    return this.clientConfigs.delete(id);
  }

  async initiateAuthorization(
    clientConfigId: string,
    userId: string,
    scopes: string[],
    redirectUri: string
  ): Promise<{ authUrl: string; state: string } | null> {
    const config = this.clientConfigs.get(clientConfigId);
    if (!config || !config.isActive) return null;
    if (!config.authorizationEndpoint) return null;

    const state = this.generateSecureString(32);
    const nonce = this.generateSecureString(16);
    
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    
    if (config.pkceEnabled) {
      codeVerifier = this.generateSecureString(64);
      codeChallenge = await this.generateCodeChallenge(codeVerifier);
    }

    const authRequest: OAuthAuthorizationRequest = {
      id: `auth-${Date.now()}`,
      clientConfigId,
      userId,
      state,
      nonce,
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: config.pkceEnabled ? "S256" : undefined,
      redirectUri,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      isUsed: false
    };

    this.authRequests.set(state, authRequest);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      nonce
    });

    if (config.pkceEnabled && codeChallenge) {
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", "S256");
    }

    const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;

    this.addAuditEntry({
      action: "authorize",
      clientConfigId,
      userId,
      success: true,
      ipAddress: "client",
      userAgent: "browser",
      scopes
    });

    return { authUrl, state };
  }

  async exchangeAuthorizationCode(
    state: string,
    code: string,
    ipAddress: string,
    userAgent: string
  ): Promise<TokenExchangeResult> {
    const authRequest = this.authRequests.get(state);
    if (!authRequest) {
      return { success: false, error: "invalid_grant", errorDescription: "Invalid or expired state" };
    }

    if (authRequest.isUsed) {
      return { success: false, error: "invalid_grant", errorDescription: "Authorization code already used" };
    }

    if (new Date(authRequest.expiresAt) < new Date()) {
      return { success: false, error: "invalid_grant", errorDescription: "Authorization request expired" };
    }

    const config = this.clientConfigs.get(authRequest.clientConfigId);
    if (!config) {
      return { success: false, error: "invalid_client", errorDescription: "Client configuration not found" };
    }

    authRequest.isUsed = true;

    const now = new Date();
    const token: OAuthToken = {
      id: `token-${Date.now()}`,
      clientConfigId: authRequest.clientConfigId,
      userId: authRequest.userId,
      accessToken: this.generateSecureString(64),
      refreshToken: config.refreshTokenEnabled ? this.generateSecureString(64) : undefined,
      tokenType: "Bearer",
      expiresAt: new Date(now.getTime() + config.tokenLifetime * 1000).toISOString(),
      refreshExpiresAt: config.refreshTokenEnabled 
        ? new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString()
        : undefined,
      scopes: authRequest.scopes,
      issuedAt: now.toISOString(),
      isRevoked: false
    };

    this.tokens.set(token.id, token);

    this.addAuditEntry({
      action: "token_issue",
      clientConfigId: authRequest.clientConfigId,
      userId: authRequest.userId,
      success: true,
      ipAddress,
      userAgent,
      scopes: authRequest.scopes,
      tokenId: token.id
    });

    fhirAuditService.log({
      userId: authRequest.userId,
      userRole: "system",
      action: "create",
      outcome: "success",
      resourceType: "OAuthToken",
      resourceId: token.id,
      fhirVersion: "R4",
      operationType: "TokenExchange",
      ipAddress,
      userAgent,
      requestPath: "/oauth/token",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 50,
      phiAccessed: false
    });

    return { success: true, token };
  }

  async refreshAccessToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<TokenExchangeResult> {
    const existingToken = Array.from(this.tokens.values()).find(
      t => t.refreshToken === refreshToken && !t.isRevoked
    );

    if (!existingToken) {
      return { success: false, error: "invalid_grant", errorDescription: "Invalid refresh token" };
    }

    if (existingToken.refreshExpiresAt && new Date(existingToken.refreshExpiresAt) < new Date()) {
      return { success: false, error: "invalid_grant", errorDescription: "Refresh token expired" };
    }

    const config = this.clientConfigs.get(existingToken.clientConfigId);
    if (!config) {
      return { success: false, error: "invalid_client", errorDescription: "Client configuration not found" };
    }

    existingToken.isRevoked = true;

    const now = new Date();
    const newToken: OAuthToken = {
      id: `token-${Date.now()}`,
      clientConfigId: existingToken.clientConfigId,
      userId: existingToken.userId,
      accessToken: this.generateSecureString(64),
      refreshToken: config.refreshTokenEnabled ? this.generateSecureString(64) : undefined,
      tokenType: "Bearer",
      expiresAt: new Date(now.getTime() + config.tokenLifetime * 1000).toISOString(),
      refreshExpiresAt: config.refreshTokenEnabled 
        ? new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString()
        : undefined,
      scopes: existingToken.scopes,
      issuedAt: now.toISOString(),
      isRevoked: false
    };

    this.tokens.set(newToken.id, newToken);

    this.addAuditEntry({
      action: "token_refresh",
      clientConfigId: existingToken.clientConfigId,
      userId: existingToken.userId,
      success: true,
      ipAddress,
      userAgent,
      scopes: existingToken.scopes,
      tokenId: newToken.id
    });

    return { success: true, token: newToken };
  }

  async validateToken(accessToken: string): Promise<{ valid: boolean; token?: OAuthToken; userId?: string; scopes?: string[] }> {
    const token = Array.from(this.tokens.values()).find(t => t.accessToken === accessToken);

    if (!token) {
      return { valid: false };
    }

    if (token.isRevoked) {
      return { valid: false };
    }

    if (new Date(token.expiresAt) < new Date()) {
      return { valid: false };
    }

    token.lastUsed = new Date().toISOString();

    return {
      valid: true,
      token,
      userId: token.userId,
      scopes: token.scopes
    };
  }

  async revokeToken(tokenId: string, userId: string, ipAddress: string, userAgent: string): Promise<boolean> {
    const token = this.tokens.get(tokenId);
    if (!token) return false;

    token.isRevoked = true;

    this.addAuditEntry({
      action: "token_revoke",
      clientConfigId: token.clientConfigId,
      userId,
      success: true,
      ipAddress,
      userAgent,
      tokenId
    });

    return true;
  }

  async revokeAllUserTokens(userId: string, ipAddress: string, userAgent: string): Promise<number> {
    let count = 0;
    for (const token of Array.from(this.tokens.values())) {
      if (token.userId === userId && !token.isRevoked) {
        token.isRevoked = true;
        count++;
      }
    }

    if (count > 0) {
      this.addAuditEntry({
        action: "token_revoke",
        clientConfigId: "all",
        userId,
        success: true,
        ipAddress,
        userAgent
      });
    }

    return count;
  }

  async getTokensForUser(userId: string): Promise<OAuthToken[]> {
    return Array.from(this.tokens.values()).filter(t => t.userId === userId && !t.isRevoked);
  }

  async introspectToken(accessToken: string): Promise<Record<string, unknown>> {
    const result = await this.validateToken(accessToken);
    
    if (!result.valid || !result.token) {
      return { active: false };
    }

    const config = this.clientConfigs.get(result.token.clientConfigId);

    return {
      active: true,
      scope: result.token.scopes.join(" "),
      client_id: config?.clientId,
      username: result.token.userId,
      token_type: "Bearer",
      exp: Math.floor(new Date(result.token.expiresAt).getTime() / 1000),
      iat: Math.floor(new Date(result.token.issuedAt).getTime() / 1000),
      sub: result.token.userId,
      iss: config?.issuer
    };
  }

  async getClientCredentialsToken(
    clientConfigId: string,
    scopes: string[],
    ipAddress: string,
    userAgent: string
  ): Promise<TokenExchangeResult> {
    const config = this.clientConfigs.get(clientConfigId);
    if (!config || !config.isActive) {
      return { success: false, error: "invalid_client", errorDescription: "Client not found or inactive" };
    }

    if (config.grantType !== "client_credentials") {
      return { success: false, error: "unauthorized_client", errorDescription: "Grant type not allowed" };
    }

    const now = new Date();
    const token: OAuthToken = {
      id: `token-${Date.now()}`,
      clientConfigId,
      userId: `service:${config.clientId}`,
      accessToken: this.generateSecureString(64),
      tokenType: "Bearer",
      expiresAt: new Date(now.getTime() + config.tokenLifetime * 1000).toISOString(),
      scopes,
      issuedAt: now.toISOString(),
      isRevoked: false
    };

    this.tokens.set(token.id, token);

    this.addAuditEntry({
      action: "token_issue",
      clientConfigId,
      success: true,
      ipAddress,
      userAgent,
      scopes,
      tokenId: token.id
    });

    return { success: true, token };
  }

  getAuditEntries(filter?: { clientConfigId?: string; userId?: string; action?: string; limit?: number }): OAuthAuditEntry[] {
    let entries = [...this.auditEntries];

    if (filter?.clientConfigId) {
      entries = entries.filter(e => e.clientConfigId === filter.clientConfigId);
    }
    if (filter?.userId) {
      entries = entries.filter(e => e.userId === filter.userId);
    }
    if (filter?.action) {
      entries = entries.filter(e => e.action === filter.action);
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }

    return entries;
  }

  getStatistics(): Record<string, unknown> {
    const activeTokens = Array.from(this.tokens.values()).filter(t => 
      !t.isRevoked && new Date(t.expiresAt) > new Date()
    );

    return {
      totalClientConfigs: this.clientConfigs.size,
      activeClientConfigs: Array.from(this.clientConfigs.values()).filter(c => c.isActive).length,
      totalTokensIssued: this.tokens.size,
      activeTokens: activeTokens.length,
      revokedTokens: Array.from(this.tokens.values()).filter(t => t.isRevoked).length,
      expiredTokens: Array.from(this.tokens.values()).filter(t => 
        !t.isRevoked && new Date(t.expiresAt) <= new Date()
      ).length,
      auditEntries: this.auditEntries.length,
      authMethods: {
        oauth2: Array.from(this.clientConfigs.values()).filter(c => c.authMethod === "oauth2").length,
        oidc: Array.from(this.clientConfigs.values()).filter(c => c.authMethod === "oidc").length,
        smart_on_fhir: Array.from(this.clientConfigs.values()).filter(c => c.authMethod === "smart_on_fhir").length
      }
    };
  }

  private addAuditEntry(entry: Omit<OAuthAuditEntry, "id" | "timestamp">): void {
    this.auditEntries.push({
      ...entry,
      id: `oauth-audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString()
    });

    if (this.auditEntries.length > 10000) {
      this.auditEntries = this.auditEntries.slice(-5000);
    }
  }

  private generateSecureString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    
    let base64 = "";
    hashArray.forEach(byte => {
      base64 += String.fromCharCode(byte);
    });
    
    return btoa(base64)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
}

export const fhirOAuthService = new FhirOAuthService();
