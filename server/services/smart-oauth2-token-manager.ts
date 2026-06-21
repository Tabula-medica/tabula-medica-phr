import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][SmartOAuth2] ${action} - ResourceType:${resourceType} ResourceId:${resourceId} User:${userId} - ${details}`);
}

export type TokenStatus = "active" | "expired" | "revoked" | "refreshing" | "invalid";
export type TokenType = "access" | "refresh" | "id";

export interface TokenMetadata {
  id: string;
  appId: string;
  clientId: string;
  userId: string;
  tokenType: TokenType;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  refreshedAt?: string;
  revokedAt?: string;
  status: TokenStatus;
  scopes: string[];
  grantType: "authorization_code" | "refresh_token" | "client_credentials";
  audience?: string;
  issuer?: string;
  jti?: string;
  refreshCount: number;
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
    platform?: string;
  };
}

export interface TokenSession {
  id: string;
  userId: string;
  appId: string;
  clientId: string;
  accessTokenId: string;
  refreshTokenId?: string;
  idTokenId?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  launchContext?: {
    patient?: string;
    encounter?: string;
    practitioner?: string;
  };
  grantedScopes: string[];
  effectiveScopes: string[];
  metadata?: Record<string, any>;
}

export interface TokenRefreshResult {
  success: boolean;
  newAccessToken?: string;
  newRefreshToken?: string;
  expiresIn?: number;
  error?: string;
  tokenMetadata?: TokenMetadata;
}

export interface TokenIntrospectionResult {
  active: boolean;
  scope?: string;
  clientId?: string;
  username?: string;
  tokenType?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
}

export interface TokenAnalytics {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  revokedTokens: number;
  tokensByApp: Record<string, number>;
  tokensByUser: Record<string, number>;
  avgSessionDuration: number;
  refreshRate: number;
  peakUsageTime?: string;
  expiringWithin24h: number;
  recentActivity: TokenActivity[];
}

export interface TokenActivity {
  id: string;
  tokenId: string;
  action: "created" | "refreshed" | "used" | "revoked" | "expired" | "introspected";
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  success: boolean;
  error?: string;
}

export interface RefreshSchedule {
  id: string;
  tokenId: string;
  scheduledAt: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  error?: string;
}

export interface OAuth2ClientConfig {
  clientId: string;
  clientSecret?: string;
  tokenEndpoint: string;
  authorizationEndpoint: string;
  introspectionEndpoint?: string;
  revocationEndpoint?: string;
  usePkce: boolean;
  scopes: string[];
  redirectUris: string[];
  grantTypes: ("authorization_code" | "refresh_token" | "client_credentials")[];
  tokenRefreshThreshold: number;
  maxRefreshAttempts: number;
  refreshRetryDelay: number;
}

const tokens = new Map<string, TokenMetadata>();
const sessions = new Map<string, TokenSession>();
const activities = new Map<string, TokenActivity>();
const refreshSchedules = new Map<string, RefreshSchedule>();
const clientConfigs = new Map<string, OAuth2ClientConfig>();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").substring(0, 32);
}

function initializeSampleData(): void {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const sampleTokens: TokenMetadata[] = [
    {
      id: "token-001",
      appId: "growth-chart-app",
      clientId: "growth-chart-client",
      userId: "user-001",
      tokenType: "access",
      tokenHash: hashToken("sample-access-token-001"),
      issuedAt: oneHourAgo.toISOString(),
      expiresAt: twoHoursFromNow.toISOString(),
      lastUsedAt: now.toISOString(),
      status: "active",
      scopes: ["patient/*.read", "launch/patient", "openid", "profile"],
      grantType: "authorization_code",
      audience: "https://fhir.example.com",
      issuer: "https://auth.example.com",
      jti: crypto.randomUUID(),
      refreshCount: 2,
      deviceInfo: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ipAddress: "192.168.1.100",
        platform: "Windows"
      }
    },
    {
      id: "token-002",
      appId: "growth-chart-app",
      clientId: "growth-chart-client",
      userId: "user-001",
      tokenType: "refresh",
      tokenHash: hashToken("sample-refresh-token-001"),
      issuedAt: oneHourAgo.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: now.toISOString(),
      status: "active",
      scopes: ["offline_access"],
      grantType: "authorization_code",
      refreshCount: 0
    },
    {
      id: "token-003",
      appId: "medication-tracker",
      clientId: "med-tracker-client",
      userId: "user-002",
      tokenType: "access",
      tokenHash: hashToken("sample-access-token-002"),
      issuedAt: yesterday.toISOString(),
      expiresAt: new Date(yesterday.getTime() + 60 * 60 * 1000).toISOString(),
      status: "expired",
      scopes: ["patient/MedicationRequest.read", "patient/MedicationStatement.read"],
      grantType: "authorization_code",
      refreshCount: 5
    }
  ];

  sampleTokens.forEach(token => tokens.set(token.id, token));

  const sampleSession: TokenSession = {
    id: "session-001",
    userId: "user-001",
    appId: "growth-chart-app",
    clientId: "growth-chart-client",
    accessTokenId: "token-001",
    refreshTokenId: "token-002",
    createdAt: oneHourAgo.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: twoHoursFromNow.toISOString(),
    status: "active",
    launchContext: {
      patient: "patient-123",
      encounter: "encounter-456"
    },
    grantedScopes: ["patient/*.read", "launch/patient", "openid", "profile", "offline_access"],
    effectiveScopes: ["patient/*.read", "launch/patient", "openid", "profile"]
  };
  sessions.set(sampleSession.id, sampleSession);

  const sampleActivities: TokenActivity[] = [
    {
      id: generateId("activity"),
      tokenId: "token-001",
      action: "created",
      timestamp: oneHourAgo.toISOString(),
      ipAddress: "192.168.1.100",
      success: true
    },
    {
      id: generateId("activity"),
      tokenId: "token-001",
      action: "used",
      timestamp: now.toISOString(),
      resource: "Patient/patient-123",
      success: true
    },
    {
      id: generateId("activity"),
      tokenId: "token-001",
      action: "refreshed",
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      success: true
    }
  ];
  sampleActivities.forEach(a => activities.set(a.id, a));

  const sampleClientConfig: OAuth2ClientConfig = {
    clientId: "growth-chart-client",
    tokenEndpoint: "https://auth.example.com/oauth2/token",
    authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
    introspectionEndpoint: "https://auth.example.com/oauth2/introspect",
    revocationEndpoint: "https://auth.example.com/oauth2/revoke",
    usePkce: true,
    scopes: ["patient/*.read", "launch/patient", "openid", "profile", "offline_access"],
    redirectUris: ["https://app.example.com/callback"],
    grantTypes: ["authorization_code", "refresh_token"],
    tokenRefreshThreshold: 300,
    maxRefreshAttempts: 3,
    refreshRetryDelay: 30
  };
  clientConfigs.set(sampleClientConfig.clientId, sampleClientConfig);
}

initializeSampleData();

class SmartOAuth2TokenManager {
  async createToken(params: {
    appId: string;
    clientId: string;
    userId: string;
    tokenValue: string;
    tokenType: TokenType;
    expiresIn: number;
    scopes: string[];
    grantType: "authorization_code" | "refresh_token" | "client_credentials";
    deviceInfo?: TokenMetadata["deviceInfo"];
    audience?: string;
    issuer?: string;
  }): Promise<TokenMetadata> {
    const now = new Date();
    const token: TokenMetadata = {
      id: generateId("token"),
      appId: params.appId,
      clientId: params.clientId,
      userId: params.userId,
      tokenType: params.tokenType,
      tokenHash: hashToken(params.tokenValue),
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + params.expiresIn * 1000).toISOString(),
      status: "active",
      scopes: params.scopes,
      grantType: params.grantType,
      jti: crypto.randomUUID(),
      refreshCount: 0,
      deviceInfo: params.deviceInfo,
      audience: params.audience,
      issuer: params.issuer
    };

    tokens.set(token.id, token);

    await this.logActivity({
      tokenId: token.id,
      action: "created",
      ipAddress: params.deviceInfo?.ipAddress,
      userAgent: params.deviceInfo?.userAgent,
      success: true
    });

    auditLog("TOKEN_CREATED", "OAuthToken", token.id, params.userId, 
      `Created ${params.tokenType} token for app ${params.appId}`);

    return token;
  }

  async getToken(tokenId: string): Promise<TokenMetadata | null> {
    return tokens.get(tokenId) || null;
  }

  async getTokenByHash(tokenHash: string): Promise<TokenMetadata | null> {
    const allTokens = Array.from(tokens.values());
    for (const token of allTokens) {
      if (token.tokenHash === tokenHash) {
        return token;
      }
    }
    return null;
  }

  async introspectToken(tokenValue: string): Promise<TokenIntrospectionResult> {
    const tokenHash = hashToken(tokenValue);
    const token = await this.getTokenByHash(tokenHash);

    if (!token) {
      return { active: false };
    }

    const now = new Date();
    const isExpired = new Date(token.expiresAt) < now;
    const isActive = token.status === "active" && !isExpired;

    if (isExpired && token.status === "active") {
      token.status = "expired";
      tokens.set(token.id, token);
    }

    await this.logActivity({
      tokenId: token.id,
      action: "introspected",
      success: true
    });

    auditLog("TOKEN_INTROSPECTED", "OAuthToken", token.id, token.userId, 
      `Token introspection: active=${isActive}`);

    return {
      active: isActive,
      scope: token.scopes.join(" "),
      clientId: token.clientId,
      tokenType: token.tokenType,
      exp: Math.floor(new Date(token.expiresAt).getTime() / 1000),
      iat: Math.floor(new Date(token.issuedAt).getTime() / 1000),
      sub: token.userId,
      aud: token.audience,
      iss: token.issuer,
      jti: token.jti
    };
  }

  async refreshToken(refreshTokenValue: string, _clientConfig?: Partial<OAuth2ClientConfig>): Promise<TokenRefreshResult> {
    const tokenHash = hashToken(refreshTokenValue);
    const refreshToken = await this.getTokenByHash(tokenHash);

    if (!refreshToken) {
      return { success: false, error: "Invalid refresh token" };
    }

    if (refreshToken.status !== "active") {
      return { success: false, error: `Token is ${refreshToken.status}` };
    }

    if (new Date(refreshToken.expiresAt) < new Date()) {
      refreshToken.status = "expired";
      tokens.set(refreshToken.id, refreshToken);
      return { success: false, error: "Refresh token expired" };
    }

    const config = clientConfigs.get(refreshToken.clientId);
    if (config && refreshToken.refreshCount >= config.maxRefreshAttempts * 10) {
      return { success: false, error: "Maximum refresh count exceeded" };
    }

    refreshToken.status = "refreshing";
    tokens.set(refreshToken.id, refreshToken);

    try {
      const now = new Date();
      const expiresIn = 3600;
      const newAccessTokenValue = crypto.randomBytes(32).toString("hex");
      const newRefreshTokenValue = crypto.randomBytes(32).toString("hex");

      const newAccessToken = await this.createToken({
        appId: refreshToken.appId,
        clientId: refreshToken.clientId,
        userId: refreshToken.userId,
        tokenValue: newAccessTokenValue,
        tokenType: "access",
        expiresIn,
        scopes: refreshToken.scopes,
        grantType: "refresh_token",
        deviceInfo: refreshToken.deviceInfo,
        audience: refreshToken.audience,
        issuer: refreshToken.issuer
      });

      refreshToken.refreshCount++;
      refreshToken.refreshedAt = now.toISOString();
      refreshToken.status = "active";
      tokens.set(refreshToken.id, refreshToken);

      await this.logActivity({
        tokenId: refreshToken.id,
        action: "refreshed",
        success: true
      });

      auditLog("TOKEN_REFRESHED", "OAuthToken", refreshToken.id, refreshToken.userId, 
        `Token refreshed, count: ${refreshToken.refreshCount}`);

      return {
        success: true,
        newAccessToken: newAccessTokenValue,
        newRefreshToken: newRefreshTokenValue,
        expiresIn,
        tokenMetadata: newAccessToken
      };
    } catch (error) {
      refreshToken.status = "active";
      tokens.set(refreshToken.id, refreshToken);

      await this.logActivity({
        tokenId: refreshToken.id,
        action: "refreshed",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed"
      };
    }
  }

  async revokeToken(tokenId: string, userId: string, reason?: string): Promise<boolean> {
    const token = tokens.get(tokenId);
    if (!token) return false;

    token.status = "revoked";
    token.revokedAt = new Date().toISOString();
    tokens.set(tokenId, token);

    await this.logActivity({
      tokenId,
      action: "revoked",
      success: true
    });

    auditLog("TOKEN_REVOKED", "OAuthToken", tokenId, userId, reason || "Token revoked by user");

    return true;
  }

  async revokeAllTokensForUser(userId: string, appId?: string): Promise<number> {
    let revokedCount = 0;
    const now = new Date().toISOString();
    const allTokens = Array.from(tokens.entries());

    for (const [id, token] of allTokens) {
      if (token.userId === userId && token.status === "active") {
        if (appId && token.appId !== appId) continue;
        
        token.status = "revoked";
        token.revokedAt = now;
        tokens.set(id, token);
        revokedCount++;
      }
    }

    auditLog("TOKENS_BULK_REVOKED", "OAuthToken", userId, userId, 
      `Revoked ${revokedCount} tokens${appId ? ` for app ${appId}` : ""}`);

    return revokedCount;
  }

  async markTokenUsed(tokenId: string, resource?: string): Promise<void> {
    const token = tokens.get(tokenId);
    if (!token) return;

    token.lastUsedAt = new Date().toISOString();
    tokens.set(tokenId, token);

    await this.logActivity({
      tokenId,
      action: "used",
      resource,
      success: true
    });
  }

  async createSession(params: {
    userId: string;
    appId: string;
    clientId: string;
    accessTokenId: string;
    refreshTokenId?: string;
    idTokenId?: string;
    expiresIn: number;
    launchContext?: TokenSession["launchContext"];
    grantedScopes: string[];
    effectiveScopes: string[];
  }): Promise<TokenSession> {
    const now = new Date();
    const session: TokenSession = {
      id: generateId("session"),
      userId: params.userId,
      appId: params.appId,
      clientId: params.clientId,
      accessTokenId: params.accessTokenId,
      refreshTokenId: params.refreshTokenId,
      idTokenId: params.idTokenId,
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + params.expiresIn * 1000).toISOString(),
      status: "active",
      launchContext: params.launchContext,
      grantedScopes: params.grantedScopes,
      effectiveScopes: params.effectiveScopes
    };

    sessions.set(session.id, session);

    auditLog("SESSION_CREATED", "TokenSession", session.id, params.userId, 
      `Session created for app ${params.appId}`);

    return session;
  }

  async getSession(sessionId: string): Promise<TokenSession | null> {
    return sessions.get(sessionId) || null;
  }

  async getSessionsForUser(userId: string): Promise<TokenSession[]> {
    return Array.from(sessions.values()).filter(s => s.userId === userId);
  }

  async terminateSession(sessionId: string, userId: string): Promise<boolean> {
    const session = sessions.get(sessionId);
    if (!session) return false;

    session.status = "revoked";
    sessions.set(sessionId, session);

    if (session.accessTokenId) {
      await this.revokeToken(session.accessTokenId, userId, "Session terminated");
    }
    if (session.refreshTokenId) {
      await this.revokeToken(session.refreshTokenId, userId, "Session terminated");
    }

    auditLog("SESSION_TERMINATED", "TokenSession", sessionId, userId, "Session terminated");

    return true;
  }

  async scheduleRefresh(tokenId: string, refreshAt: Date): Promise<RefreshSchedule> {
    const schedule: RefreshSchedule = {
      id: generateId("schedule"),
      tokenId,
      scheduledAt: refreshAt.toISOString(),
      status: "pending",
      attempts: 0
    };

    refreshSchedules.set(schedule.id, schedule);
    return schedule;
  }

  async getExpiringTokens(withinMinutes: number = 60): Promise<TokenMetadata[]> {
    const threshold = new Date(Date.now() + withinMinutes * 60 * 1000);
    return Array.from(tokens.values()).filter(
      t => t.status === "active" && new Date(t.expiresAt) <= threshold
    );
  }

  async getAnalytics(): Promise<TokenAnalytics> {
    const allTokens = Array.from(tokens.values());
    const allActivities = Array.from(activities.values());
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const activeTokens = allTokens.filter(t => t.status === "active");
    const expiredTokens = allTokens.filter(t => t.status === "expired");
    const revokedTokens = allTokens.filter(t => t.status === "revoked");

    const tokensByApp: Record<string, number> = {};
    const tokensByUser: Record<string, number> = {};

    for (const token of allTokens) {
      tokensByApp[token.appId] = (tokensByApp[token.appId] || 0) + 1;
      tokensByUser[token.userId] = (tokensByUser[token.userId] || 0) + 1;
    }

    const refreshActivities = allActivities.filter(a => a.action === "refreshed");
    const refreshRate = allActivities.length > 0 
      ? refreshActivities.length / allActivities.length 
      : 0;

    const expiringWithin24h = activeTokens.filter(
      t => new Date(t.expiresAt) <= oneDayFromNow
    ).length;

    const recentActivity = allActivities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const allSessions = Array.from(sessions.values());
    const sessionDurations = allSessions
      .filter(s => s.status !== "active")
      .map(s => new Date(s.lastActivityAt).getTime() - new Date(s.createdAt).getTime());
    const avgSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length / 1000 / 60
      : 0;

    return {
      totalTokens: allTokens.length,
      activeTokens: activeTokens.length,
      expiredTokens: expiredTokens.length,
      revokedTokens: revokedTokens.length,
      tokensByApp,
      tokensByUser,
      avgSessionDuration,
      refreshRate,
      expiringWithin24h,
      recentActivity
    };
  }

  async getTokensForApp(appId: string): Promise<TokenMetadata[]> {
    return Array.from(tokens.values()).filter(t => t.appId === appId);
  }

  async getTokensForUser(userId: string): Promise<TokenMetadata[]> {
    return Array.from(tokens.values()).filter(t => t.userId === userId);
  }

  async getClientConfig(clientId: string): Promise<OAuth2ClientConfig | null> {
    return clientConfigs.get(clientId) || null;
  }

  async setClientConfig(config: OAuth2ClientConfig): Promise<void> {
    clientConfigs.set(config.clientId, config);
    
    auditLog("CLIENT_CONFIG_UPDATED", "OAuth2Client", config.clientId, "system", 
      "OAuth2 client configuration updated");
  }

  async getAllClientConfigs(): Promise<OAuth2ClientConfig[]> {
    return Array.from(clientConfigs.values());
  }

  async getActivities(tokenId?: string, limit: number = 50): Promise<TokenActivity[]> {
    let result = Array.from(activities.values());
    
    if (tokenId) {
      result = result.filter(a => a.tokenId === tokenId);
    }
    
    return result
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  private async logActivity(params: {
    tokenId: string;
    action: TokenActivity["action"];
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    const activity: TokenActivity = {
      id: generateId("activity"),
      tokenId: params.tokenId,
      action: params.action,
      timestamp: new Date().toISOString(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      resource: params.resource,
      success: params.success,
      error: params.error
    };

    activities.set(activity.id, activity);
  }

  async cleanupExpiredTokens(olderThanDays: number = 30): Promise<number> {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    const allTokens = Array.from(tokens.entries());

    for (const [id, token] of allTokens) {
      if (
        (token.status === "expired" || token.status === "revoked") &&
        new Date(token.expiresAt) < threshold
      ) {
        tokens.delete(id);
        cleaned++;
      }
    }

    auditLog("TOKENS_CLEANUP", "OAuthToken", "system", "system", 
      `Cleaned up ${cleaned} expired/revoked tokens older than ${olderThanDays} days`);

    return cleaned;
  }
}

export const smartOAuth2TokenManager = new SmartOAuth2TokenManager();

console.log("[SmartOAuth2TokenManager] Service initialized");
console.log("[SmartOAuth2TokenManager] Sample tokens:", tokens.size);
console.log("[SmartOAuth2TokenManager] Sample sessions:", sessions.size);
console.log("[SmartOAuth2TokenManager] Features: Token lifecycle, refresh scheduling, introspection, analytics");
