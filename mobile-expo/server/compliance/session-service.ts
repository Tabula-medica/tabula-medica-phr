import { randomBytes, createHash } from "crypto";
import { Request } from "express";
import { storage } from "../storage";
import { AuditAction, auditLogin, auditSecurityEvent } from "./audit-service";
import type { InsertUserSession, UserSession, InsertShareLinkAccessLog } from "../../shared/schema";

const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  platform: string;
  browserName: string;
  browserVersion: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseUserAgent(userAgent: string): Partial<DeviceInfo> {
  const ua = userAgent.toLowerCase();
  
  let deviceType: DeviceInfo["deviceType"] = "unknown";
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    deviceType = ua.includes("tablet") || ua.includes("ipad") ? "tablet" : "mobile";
  } else if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) {
    deviceType = "desktop";
  }

  let platform = "Unknown";
  if (ua.includes("iphone") || ua.includes("ipad")) platform = "iOS";
  else if (ua.includes("android")) platform = "Android";
  else if (ua.includes("windows")) platform = "Windows";
  else if (ua.includes("macintosh")) platform = "macOS";
  else if (ua.includes("linux")) platform = "Linux";

  let browserName = "Unknown";
  let browserVersion = "";
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browserName = "Chrome";
    const match = ua.match(/chrome\/(\d+)/);
    browserVersion = match ? match[1] : "";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browserName = "Safari";
    const match = ua.match(/version\/(\d+)/);
    browserVersion = match ? match[1] : "";
  } else if (ua.includes("firefox")) {
    browserName = "Firefox";
    const match = ua.match(/firefox\/(\d+)/);
    browserVersion = match ? match[1] : "";
  } else if (ua.includes("edg")) {
    browserName = "Edge";
    const match = ua.match(/edg\/(\d+)/);
    browserVersion = match ? match[1] : "";
  }

  return {
    deviceType,
    platform,
    browserName,
    browserVersion,
  };
}

function generateDeviceId(req: Request): string {
  const userAgent = req.headers["user-agent"] || "";
  const ip = req.ip || req.headers["x-forwarded-for"] || "";
  return hashToken(`${userAgent}:${ip}`).substring(0, 16);
}

export class SessionService {
  static async createSession(
    req: Request,
    userId: string
  ): Promise<{ session: UserSession; tokens: TokenPair }> {
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";
    const deviceInfo = parseUserAgent(userAgent);
    const deviceId = generateDeviceId(req);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const now = new Date();

    const sessionData: InsertUserSession = {
      userId,
      deviceId,
      deviceName: `${deviceInfo.browserName} on ${deviceInfo.platform}`,
      deviceType: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      browserName: deviceInfo.browserName,
      browserVersion: deviceInfo.browserVersion,
      ipAddress,
      accessToken: hashToken(accessToken),
      refreshToken: hashToken(refreshToken),
      accessTokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_MS),
      refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS),
      isActive: true,
      lastActivityAt: now,
    };

    const session = await storage.createUserSession(sessionData);

    auditLogin(req, userId, true, "demo");

    return {
      session,
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: sessionData.accessTokenExpiresAt,
        refreshTokenExpiresAt: sessionData.refreshTokenExpiresAt,
      },
    };
  }

  static async validateAccessToken(token: string): Promise<UserSession | null> {
    const hashedToken = hashToken(token);
    const session = await storage.getUserSessionByAccessToken(hashedToken);

    if (!session) return null;
    if (!session.isActive) return null;
    if (session.revokedAt) return null;
    if (new Date() > session.accessTokenExpiresAt) return null;

    await storage.updateUserSessionActivity(session.id);
    return session;
  }

  static async refreshTokens(
    req: Request,
    refreshToken: string
  ): Promise<{ session: UserSession; tokens: TokenPair } | null> {
    const hashedToken = hashToken(refreshToken);
    const session = await storage.getUserSessionByRefreshToken(hashedToken);

    if (!session) return null;
    if (!session.isActive) return null;
    if (session.revokedAt) return null;
    if (new Date() > session.refreshTokenExpiresAt) {
      await this.revokeSession(req, session.id, "expired");
      return null;
    }

    const newAccessToken = generateToken();
    const newRefreshToken = generateToken();
    const now = new Date();

    const updatedSession = await storage.rotateSessionTokens(session.id, {
      accessToken: hashToken(newAccessToken),
      refreshToken: hashToken(newRefreshToken),
      accessTokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_MS),
      refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS),
      lastActivityAt: now,
    });

    if (!updatedSession) return null;

    auditSecurityEvent(
      req,
      AuditAction.ENCRYPTION_KEY_ROTATED,
      `Token rotated for session ${session.id}`,
      "low"
    );

    return {
      session: updatedSession,
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_MS),
        refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS),
      },
    };
  }

  static async revokeSession(
    req: Request,
    sessionId: string,
    reason: string = "user_logout"
  ): Promise<boolean> {
    const session = await storage.revokeUserSession(sessionId);
    
    if (session) {
      auditSecurityEvent(req, AuditAction.LOGOUT, `Session revoked: ${reason}`, "low");
      return true;
    }
    return false;
  }

  static async revokeAllSessions(
    req: Request,
    userId: string,
    exceptSessionId?: string
  ): Promise<number> {
    const revokedCount = await storage.revokeAllUserSessions(userId, exceptSessionId);

    auditSecurityEvent(
      req,
      AuditAction.SESSION_TIMEOUT,
      `All sessions revoked for user ${userId}${exceptSessionId ? " except current" : ""}`,
      "high"
    );

    return revokedCount;
  }

  static async getUserDevices(userId: string): Promise<UserSession[]> {
    return storage.getActiveUserSessions(userId);
  }

  static formatDeviceForDisplay(session: UserSession): {
    id: string;
    name: string;
    type: string;
    platform: string;
    browser: string;
    lastActive: string;
    location: string | null;
    isCurrent: boolean;
    ipAddress: string | null;
  } {
    const lastActive = session.lastActivityAt || session.createdAt;
    const isRecent = new Date().getTime() - lastActive.getTime() < 5 * 60 * 1000;

    return {
      id: session.id,
      name: session.deviceName || "Unknown Device",
      type: session.deviceType || "unknown",
      platform: session.platform || "Unknown",
      browser: session.browserName 
        ? `${session.browserName}${session.browserVersion ? ` ${session.browserVersion}` : ""}`
        : "Unknown",
      lastActive: isRecent ? "Active now" : lastActive.toISOString(),
      location: session.location,
      isCurrent: false,
      ipAddress: session.ipAddress,
    };
  }
}

export async function logShareLinkAccess(
  shareLinkId: string,
  action: "created" | "viewed" | "revoked" | "pin_verified" | "pin_failed",
  req: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";
  const userAgent = req.headers["user-agent"] || "";

  await storage.createShareLinkAccessLog({
    shareLinkId,
    action,
    accessorIp: ipAddress,
    accessorUserAgent: userAgent,
    metadata,
  });

  const auditAction = action === "created" 
    ? AuditAction.SHARE_PHI 
    : action === "viewed" 
      ? AuditAction.VIEW_PHI 
      : AuditAction.CONSENT_REVOKED;

  auditSecurityEvent(
    req,
    auditAction,
    `Share link ${action}: ${shareLinkId}`,
    action === "revoked" ? "medium" : "low"
  );
}
