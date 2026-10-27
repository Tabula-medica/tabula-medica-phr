import { db } from "./db";
import { sessionManagement } from "@shared/schema";
import type { InsertSessionManagement, SessionManagement } from "@shared/schema";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import crypto from "crypto";

const DEFAULT_TIMEOUT_MINUTES = 15;
const MAX_SESSION_DURATION_HOURS = 24;
const CLEANUP_RETENTION_DAYS = 30;
const CHECK_INTERVAL_MS = 60_000;

class SessionTimeoutService {
  private checkerInterval: NodeJS.Timeout | null = null;

  async createSession(
    userId: string,
    options: {
      deviceId?: string;
      deviceType?: string;
      ipAddress?: string;
      userAgent?: string;
      timeoutMinutes?: number;
    } = {}
  ): Promise<SessionManagement> {
    const sessionToken = crypto.randomBytes(48).toString("hex");
    const timeoutMinutes = options.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const [session] = await db
      .insert(sessionManagement)
      .values({
        userId,
        sessionToken,
        deviceId: options.deviceId ?? null,
        deviceType: options.deviceType ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
        timeoutMinutes,
        lastActivityAt: now,
        isActive: true,
        mfaVerified: false,
        expiresAt,
      })
      .returning();

    console.log(`[SessionMgmt] Session created for user ${userId} (timeout: ${timeoutMinutes}min)`);
    return session;
  }

  async validateSession(sessionToken: string): Promise<SessionManagement | null> {
    const [session] = await db
      .select()
      .from(sessionManagement)
      .where(
        and(
          eq(sessionManagement.sessionToken, sessionToken),
          eq(sessionManagement.isActive, true)
        )
      );

    if (!session) {
      return null;
    }

    const now = new Date();

    if (now > session.expiresAt) {
      await this.invalidateSession(sessionToken, "timeout");
      console.log(`[SessionMgmt] Session expired (max duration exceeded)`);
      return null;
    }

    const inactivityLimit = new Date(
      session.lastActivityAt.getTime() + (session.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES) * 60 * 1000
    );
    if (now > inactivityLimit) {
      await this.invalidateSession(sessionToken, "timeout");
      console.log(`[SessionMgmt] Session expired (inactivity timeout)`);
      return null;
    }

    await db
      .update(sessionManagement)
      .set({ lastActivityAt: now })
      .where(eq(sessionManagement.sessionToken, sessionToken));

    return { ...session, lastActivityAt: now };
  }

  async touchSession(sessionToken: string): Promise<boolean> {
    const now = new Date();
    const result = await db
      .update(sessionManagement)
      .set({ lastActivityAt: now })
      .where(
        and(
          eq(sessionManagement.sessionToken, sessionToken),
          eq(sessionManagement.isActive, true)
        )
      )
      .returning();

    return result.length > 0;
  }

  async invalidateSession(
    sessionToken: string,
    reason: "user_logout" | "timeout" | "security" | "admin" | "mfa_required"
  ): Promise<boolean> {
    const now = new Date();
    const result = await db
      .update(sessionManagement)
      .set({
        isActive: false,
        terminationReason: reason,
        terminatedAt: now,
      })
      .where(
        and(
          eq(sessionManagement.sessionToken, sessionToken),
          eq(sessionManagement.isActive, true)
        )
      )
      .returning();

    if (result.length > 0) {
      console.log(`[SessionMgmt] Session invalidated (reason: ${reason})`);
    }
    return result.length > 0;
  }

  async invalidateAllUserSessions(
    userId: string,
    reason: "user_logout" | "timeout" | "security" | "admin" | "mfa_required"
  ): Promise<number> {
    const now = new Date();
    const result = await db
      .update(sessionManagement)
      .set({
        isActive: false,
        terminationReason: reason,
        terminatedAt: now,
      })
      .where(
        and(
          eq(sessionManagement.userId, userId),
          eq(sessionManagement.isActive, true)
        )
      )
      .returning();

    console.log(`[SessionMgmt] Invalidated ${result.length} sessions for user ${userId} (reason: ${reason})`);
    return result.length;
  }

  async getUserActiveSessions(userId: string): Promise<SessionManagement[]> {
    return db
      .select()
      .from(sessionManagement)
      .where(
        and(
          eq(sessionManagement.userId, userId),
          eq(sessionManagement.isActive, true)
        )
      )
      .orderBy(desc(sessionManagement.lastActivityAt));
  }

  async getSessionInfo(sessionToken: string): Promise<SessionManagement | null> {
    const [session] = await db
      .select()
      .from(sessionManagement)
      .where(eq(sessionManagement.sessionToken, sessionToken));

    return session ?? null;
  }

  async markMfaVerified(sessionToken: string): Promise<boolean> {
    const now = new Date();
    const result = await db
      .update(sessionManagement)
      .set({
        mfaVerified: true,
        mfaVerifiedAt: now,
      })
      .where(
        and(
          eq(sessionManagement.sessionToken, sessionToken),
          eq(sessionManagement.isActive, true)
        )
      )
      .returning();

    if (result.length > 0) {
      console.log(`[SessionMgmt] Session marked as MFA verified`);
    }
    return result.length > 0;
  }

  async extendSession(sessionToken: string, additionalMinutes: number): Promise<boolean> {
    const [session] = await db
      .select()
      .from(sessionManagement)
      .where(
        and(
          eq(sessionManagement.sessionToken, sessionToken),
          eq(sessionManagement.isActive, true)
        )
      );

    if (!session) {
      return false;
    }

    const newExpiresAt = new Date(session.expiresAt.getTime() + additionalMinutes * 60 * 1000);
    const result = await db
      .update(sessionManagement)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessionManagement.sessionToken, sessionToken))
      .returning();

    if (result.length > 0) {
      console.log(`[SessionMgmt] Session extended by ${additionalMinutes} minutes`);
    }
    return result.length > 0;
  }

  async checkAndExpireSessions(): Promise<number> {
    const now = new Date();

    const activeSessions = await db
      .select()
      .from(sessionManagement)
      .where(eq(sessionManagement.isActive, true));

    let expiredCount = 0;

    for (const session of activeSessions) {
      const inactivityLimit = new Date(
        session.lastActivityAt.getTime() + (session.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES) * 60 * 1000
      );
      const isInactive = now > inactivityLimit;
      const isMaxDurationExceeded = now > session.expiresAt;

      if (isInactive || isMaxDurationExceeded) {
        await db
          .update(sessionManagement)
          .set({
            isActive: false,
            terminationReason: "timeout",
            terminatedAt: now,
          })
          .where(eq(sessionManagement.id, session.id));
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`[SessionMgmt] Expired ${expiredCount} timed-out sessions`);
    }

    return expiredCount;
  }

  async getStats(): Promise<{
    activeSessions: number;
    expiredToday: number;
    averageSessionDurationMinutes: number;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [activeResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionManagement)
      .where(eq(sessionManagement.isActive, true));

    const [expiredTodayResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionManagement)
      .where(
        and(
          eq(sessionManagement.isActive, false),
          sql`${sessionManagement.terminatedAt} >= ${startOfDay}`
        )
      );

    const [avgResult] = await db
      .select({
        avg: sql<number>`coalesce(avg(extract(epoch from (${sessionManagement.terminatedAt} - ${sessionManagement.createdAt})) / 60), 0)::float`,
      })
      .from(sessionManagement)
      .where(
        and(
          eq(sessionManagement.isActive, false),
          sql`${sessionManagement.terminatedAt} is not null`
        )
      );

    return {
      activeSessions: activeResult?.count ?? 0,
      expiredToday: expiredTodayResult?.count ?? 0,
      averageSessionDurationMinutes: Math.round((avgResult?.avg ?? 0) * 100) / 100,
    };
  }

  async getSessionHistory(
    userId: string,
    limit: number = 50
  ): Promise<
    Array<
      SessionManagement & {
        durationMinutes: number | null;
      }
    >
  > {
    const sessions = await db
      .select()
      .from(sessionManagement)
      .where(eq(sessionManagement.userId, userId))
      .orderBy(desc(sessionManagement.createdAt))
      .limit(limit);

    return sessions.map((session) => {
      let durationMinutes: number | null = null;
      if (session.terminatedAt) {
        durationMinutes =
          Math.round(
            ((session.terminatedAt.getTime() - session.createdAt.getTime()) / 60000) * 100
          ) / 100;
      }
      return { ...session, durationMinutes };
    });
  }

  async cleanupExpiredSessions(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_RETENTION_DAYS);

    const result = await db
      .delete(sessionManagement)
      .where(
        and(
          eq(sessionManagement.isActive, false),
          lt(sessionManagement.expiresAt, cutoffDate)
        )
      )
      .returning();

    if (result.length > 0) {
      console.log(`[SessionMgmt] Cleaned up ${result.length} expired sessions (older than ${CLEANUP_RETENTION_DAYS} days)`);
    }

    return result.length;
  }

  startPeriodicCheck(): void {
    if (this.checkerInterval) {
      return;
    }

    this.checkerInterval = setInterval(async () => {
      try {
        await this.checkAndExpireSessions();
      } catch (error) {
        console.error(`[SessionMgmt] Error during periodic session check:`, error);
      }
    }, CHECK_INTERVAL_MS);

    this.checkerInterval.unref();
  }

  stopPeriodicCheck(): void {
    if (this.checkerInterval) {
      clearInterval(this.checkerInterval);
      this.checkerInterval = null;
    }
  }
}

export const sessionTimeoutService = new SessionTimeoutService();

export function initializeSessionTimeout(): void {
  sessionTimeoutService.startPeriodicCheck();
  console.log(`[SessionMgmt] Session timeout service initialized (check interval: ${CHECK_INTERVAL_MS / 1000}s, default timeout: ${DEFAULT_TIMEOUT_MINUTES}min)`);
}
