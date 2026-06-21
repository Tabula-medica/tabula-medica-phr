import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export interface DeviceSession {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
  ipAddress: string;
  ipAddressHash: string;
  location?: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

interface StoredToken {
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
}

const ACCESS_TOKEN_EXPIRY_MINUTES = 15;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_SESSIONS_PER_USER = 10;

const deviceSessions = new Map<string, DeviceSession>();
const refreshTokens = new Map<string, StoredToken>();
const accessTokens = new Map<string, StoredToken>();

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function parseUserAgent(userAgent: string): { browser: string; os: string; deviceType: DeviceSession["deviceType"] } {
  let browser = "Unknown";
  let os = "Unknown";
  let deviceType: DeviceSession["deviceType"] = "unknown";

  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edge")) browser = "Edge";
  else if (userAgent.includes("MSIE") || userAgent.includes("Trident")) browser = "Internet Explorer";

  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
    deviceType = "mobile";
  } else if (userAgent.includes("iPad") || userAgent.includes("Tablet")) {
    deviceType = "tablet";
  } else if (userAgent.includes("Windows") || userAgent.includes("Mac") || userAgent.includes("Linux")) {
    deviceType = "desktop";
  }

  return { browser, os, deviceType };
}

function generateDeviceFingerprint(ipAddress: string, userAgent: string): string {
  return hashValue(`${ipAddress}:${userAgent}`).substring(0, 16);
}

export async function createDeviceSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  deviceName?: string
): Promise<{ session: DeviceSession; tokens: TokenPair }> {
  const { browser, os, deviceType } = parseUserAgent(userAgent);
  const deviceFingerprint = generateDeviceFingerprint(ipAddress, userAgent);

  const existingSessions = Array.from(deviceSessions.values())
    .filter(s => s.userId === userId && !s.isRevoked)
    .sort((a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime());

  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    const oldestSession = existingSessions[0];
    await revokeSession(oldestSession.id, userId, "max_sessions_exceeded");
  }

  const now = new Date();
  const sessionId = uuidv4();

  const session: DeviceSession = {
    id: sessionId,
    userId,
    deviceFingerprint,
    deviceName: deviceName || `${browser} on ${os}`,
    deviceType,
    browser,
    os,
    ipAddress: "[REDACTED]",
    ipAddressHash: hashValue(ipAddress),
    lastActiveAt: now.toISOString(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    isCurrent: true,
    isRevoked: false,
  };

  deviceSessions.set(sessionId, session);

  const tokens = await generateTokenPair(userId, sessionId);

  console.log(`[DeviceSession] Created session ${sessionId} for user ${userId} (${deviceType}/${browser})`);

  return { session, tokens };
}

async function generateTokenPair(userId: string, sessionId: string): Promise<TokenPair> {
  const accessToken = generateSecureToken();
  const refreshToken = generateSecureToken();

  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  accessTokens.set(hashValue(accessToken), {
    userId,
    sessionId,
    tokenHash: hashValue(accessToken),
    expiresAt: accessTokenExpiresAt.toISOString(),
    isRevoked: false,
    createdAt: now.toISOString(),
  });

  refreshTokens.set(hashValue(refreshToken), {
    userId,
    sessionId,
    tokenHash: hashValue(refreshToken),
    expiresAt: refreshTokenExpiresAt.toISOString(),
    isRevoked: false,
    createdAt: now.toISOString(),
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export async function refreshTokens_rotate(
  refreshToken: string,
  ipAddress: string
): Promise<{ tokens: TokenPair; session: DeviceSession } | null> {
  const tokenHash = hashValue(refreshToken);
  const storedToken = refreshTokens.get(tokenHash);

  if (!storedToken) {
    console.log("[DeviceSession] Refresh token not found");
    return null;
  }

  if (storedToken.isRevoked) {
    console.log("[DeviceSession] Refresh token already revoked - potential replay attack");
    await revokeAllUserSessions(storedToken.userId, "refresh_token_reuse");
    return null;
  }

  if (new Date(storedToken.expiresAt) < new Date()) {
    console.log("[DeviceSession] Refresh token expired");
    return null;
  }

  const session = deviceSessions.get(storedToken.sessionId);
  if (!session || session.isRevoked) {
    console.log("[DeviceSession] Session not found or revoked");
    return null;
  }

  storedToken.isRevoked = true;
  refreshTokens.set(tokenHash, storedToken);

  const ipHash = hashValue(ipAddress);
  if (session.ipAddressHash !== ipHash) {
    console.log(`[DeviceSession] IP address changed for session ${session.id}`);
  }

  session.lastActiveAt = new Date().toISOString();
  session.ipAddressHash = ipHash;
  deviceSessions.set(session.id, session);

  const tokens = await generateTokenPair(storedToken.userId, storedToken.sessionId);

  console.log(`[DeviceSession] Rotated tokens for session ${session.id}`);

  return { tokens, session };
}

export async function validateAccessToken(accessToken: string): Promise<{ userId: string; sessionId: string } | null> {
  const tokenHash = hashValue(accessToken);
  const storedToken = accessTokens.get(tokenHash);

  if (!storedToken) return null;
  if (storedToken.isRevoked) return null;
  if (new Date(storedToken.expiresAt) < new Date()) return null;

  const session = deviceSessions.get(storedToken.sessionId);
  if (!session || session.isRevoked) return null;

  session.lastActiveAt = new Date().toISOString();
  deviceSessions.set(session.id, session);

  return { userId: storedToken.userId, sessionId: storedToken.sessionId };
}

export async function getUserDeviceSessions(userId: string): Promise<DeviceSession[]> {
  return Array.from(deviceSessions.values())
    .filter(s => s.userId === userId && !s.isRevoked && new Date(s.expiresAt) > new Date())
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  reason: string = "user_logout"
): Promise<boolean> {
  const session = deviceSessions.get(sessionId);

  if (!session) return false;
  if (session.userId !== userId) return false;

  session.isRevoked = true;
  session.revokedAt = new Date().toISOString();
  session.revokedReason = reason;
  deviceSessions.set(sessionId, session);

  for (const [hash, token] of accessTokens.entries()) {
    if (token.sessionId === sessionId) {
      token.isRevoked = true;
      accessTokens.set(hash, token);
    }
  }

  for (const [hash, token] of refreshTokens.entries()) {
    if (token.sessionId === sessionId) {
      token.isRevoked = true;
      refreshTokens.set(hash, token);
    }
  }

  console.log(`[DeviceSession] Revoked session ${sessionId} for user ${userId} (${reason})`);

  return true;
}

export async function revokeAllUserSessions(
  userId: string,
  reason: string = "logout_all_devices",
  exceptSessionId?: string
): Promise<number> {
  let revokedCount = 0;

  for (const [sessionId, session] of deviceSessions.entries()) {
    if (session.userId === userId && !session.isRevoked && sessionId !== exceptSessionId) {
      await revokeSession(sessionId, userId, reason);
      revokedCount++;
    }
  }

  console.log(`[DeviceSession] Revoked ${revokedCount} sessions for user ${userId} (${reason})`);

  return revokedCount;
}

export async function revokeAllExceptCurrent(
  userId: string,
  currentSessionId: string
): Promise<number> {
  return revokeAllUserSessions(userId, "logout_other_devices", currentSessionId);
}

export function cleanupExpiredSessions(): void {
  const now = new Date();
  let cleanedSessions = 0;
  let cleanedTokens = 0;

  for (const [sessionId, session] of deviceSessions.entries()) {
    if (new Date(session.expiresAt) < now || session.isRevoked) {
      deviceSessions.delete(sessionId);
      cleanedSessions++;
    }
  }

  for (const [hash, token] of accessTokens.entries()) {
    if (new Date(token.expiresAt) < now || token.isRevoked) {
      accessTokens.delete(hash);
      cleanedTokens++;
    }
  }

  for (const [hash, token] of refreshTokens.entries()) {
    if (new Date(token.expiresAt) < now || token.isRevoked) {
      refreshTokens.delete(hash);
      cleanedTokens++;
    }
  }

  if (cleanedSessions > 0 || cleanedTokens > 0) {
    console.log(`[DeviceSession] Cleaned up ${cleanedSessions} sessions and ${cleanedTokens} tokens`);
  }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

export function getSessionStats(): {
  totalActiveSessions: number;
  sessionsByDevice: Record<string, number>;
  averageSessionsPerUser: number;
} {
  const activeSessions = Array.from(deviceSessions.values()).filter(
    s => !s.isRevoked && new Date(s.expiresAt) > new Date()
  );

  const sessionsByDevice: Record<string, number> = {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    unknown: 0,
  };

  const userSessionCounts = new Map<string, number>();

  for (const session of activeSessions) {
    sessionsByDevice[session.deviceType]++;
    userSessionCounts.set(
      session.userId,
      (userSessionCounts.get(session.userId) || 0) + 1
    );
  }

  const uniqueUsers = userSessionCounts.size;
  const averageSessionsPerUser = uniqueUsers > 0 ? activeSessions.length / uniqueUsers : 0;

  return {
    totalActiveSessions: activeSessions.length,
    sessionsByDevice,
    averageSessionsPerUser: Math.round(averageSessionsPerUser * 100) / 100,
  };
}
