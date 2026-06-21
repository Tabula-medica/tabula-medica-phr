import type { Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

interface SessionTimeoutConfig {
  idleTimeoutMs?: number;
  absoluteTimeoutMs?: number;
  excludePaths?: string[];
}

const config: SessionTimeoutConfig = {
  idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || "") || DEFAULT_IDLE_TIMEOUT_MS,
  absoluteTimeoutMs: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MS || "") || DEFAULT_ABSOLUTE_TIMEOUT_MS,
  excludePaths: ["/api/login", "/api/callback", "/auth/callback", "/api/logout", "/api/health", "/api/security/status"],
};

function shouldExcludePath(path: string): boolean {
  return config.excludePaths?.some((p) => path.startsWith(p)) ?? false;
}

export const sessionTimeoutMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (shouldExcludePath(req.path)) {
    next();
    return;
  }

  const user = req.user as { claims?: { sub?: string }; sessionCreatedAt?: number } | undefined;
  const userId = user?.claims?.sub;

  if (!userId) {
    next();
    return;
  }

  try {
    const now = Date.now();
    const sessions = await storage.getUserSessions(userId);

    const userAgent = req.headers["user-agent"] || "Unknown";
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "Unknown";

    let currentSession = sessions.find(
      (s) => s.userAgent === userAgent && s.ipAddress === ipAddress
    );

    if (currentSession) {
      const lastActive = new Date(currentSession.lastActiveAt).getTime();
      const idleTime = now - lastActive;

      if (idleTime > config.idleTimeoutMs!) {
        await storage.createSecurityAuditLog({
          userId,
          eventType: "session_revoked",
          description: `Session expired due to ${Math.floor(idleTime / 60000)} minutes of inactivity`,
          ipAddress,
          userAgent,
          metadata: { reason: "idle_timeout", idleMinutes: String(Math.floor(idleTime / 60000)) },
        });

        res.status(401).json({
          error: "Session expired",
          reason: "idle_timeout",
          message: "Your session has expired due to inactivity. Please log in again.",
        });
        return;
      }

      const sessionAge = now - new Date(currentSession.createdAt).getTime();
      if (sessionAge > config.absoluteTimeoutMs!) {
        await storage.createSecurityAuditLog({
          userId,
          eventType: "session_revoked",
          description: `Session expired after ${Math.floor(sessionAge / 3600000)} hours (absolute timeout)`,
          ipAddress,
          userAgent,
          metadata: { reason: "absolute_timeout", ageHours: String(Math.floor(sessionAge / 3600000)) },
        });

        res.status(401).json({
          error: "Session expired",
          reason: "absolute_timeout",
          message: "Your session has reached its maximum duration. Please log in again.",
        });
        return;
      }

      const timeSinceLastRefresh = now - lastActive;
      if (timeSinceLastRefresh > SESSION_REFRESH_THRESHOLD_MS) {
        await storage.updateUserSession(currentSession.id, {
          lastActiveAt: new Date().toISOString(),
        });
      }
    }

    res.setHeader("X-Session-Timeout", Math.floor(config.idleTimeoutMs! / 1000).toString());
    res.setHeader("X-Session-Refresh-Threshold", Math.floor(SESSION_REFRESH_THRESHOLD_MS / 1000).toString());

    next();
  } catch (error) {
    console.error("[SessionTimeout] Error checking session:", error);
    next();
  }
};

export function getSessionTimeoutConfig(): {
  idleTimeoutSeconds: number;
  absoluteTimeoutSeconds: number;
} {
  return {
    idleTimeoutSeconds: Math.floor(config.idleTimeoutMs! / 1000),
    absoluteTimeoutSeconds: Math.floor(config.absoluteTimeoutMs! / 1000),
  };
}

export async function extendSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    const session = await storage.getUserSession(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }

    const newExpiresAt = new Date(Date.now() + config.idleTimeoutMs!).toISOString();
    await storage.updateUserSession(sessionId, {
      lastActiveAt: new Date().toISOString(),
      expiresAt: newExpiresAt,
    });

    return true;
  } catch (error) {
    console.error("[SessionTimeout] Error extending session:", error);
    return false;
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  let cleanedCount = 0;
  try {
    const allSessions = await storage.getAllSessions?.() ?? [];
    const now = Date.now();

    for (const session of allSessions) {
      const lastActive = new Date(session.lastActiveAt).getTime();
      const createdAt = new Date(session.createdAt).getTime();
      const idleExpired = (now - lastActive) > config.idleTimeoutMs!;
      const absoluteExpired = (now - createdAt) > config.absoluteTimeoutMs!;
      const expiresAtExpired = session.expiresAt && new Date(session.expiresAt).getTime() < now;

      if (idleExpired || absoluteExpired || expiresAtExpired) {
        await storage.deleteUserSession(session.id, session.userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SessionTimeout] Cleaned up ${cleanedCount} expired session(s)`);
    }
  } catch (error) {
    console.error("[SessionTimeout] Error cleaning up sessions:", error);
  }
  return cleanedCount;
}

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function startSessionCleanupScheduler(intervalMs: number = 5 * 60 * 1000): void {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(() => {
    cleanupExpiredSessions().catch((err) =>
      console.error("[SessionTimeout] Scheduled cleanup failed:", err)
    );
  }, intervalMs);
  console.log(`[SessionTimeout] Session cleanup scheduler started (every ${intervalMs / 1000}s)`);
}

export function stopSessionCleanupScheduler(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
