/**
 * Smart Health Links Service
 * Generates time-limited, encrypted links for sharing the longitudinal medical journey
 */

import { db } from "./db";
import { shareLinks, shareLinkAccessLogs, users, healthRecords } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";
import { medicalJourneyService } from "./medical-journey-service";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.SHARE_LINK_ENCRYPTION_KEY || randomBytes(32).toString("hex");

export interface SmartHealthLink {
  id: string;
  token: string;
  encryptedToken: string;
  shareUrl: string;
  expiresAt: Date;
  expiresInHours: number;
  accessCount: number;
  maxAccessCount?: number;
  isRevoked: boolean;
  recipientEmail?: string;
  recipientName?: string;
  purpose?: string;
  includeJourney: boolean;
  createdAt: Date;
}

export interface CreateSmartLinkOptions {
  userId: string;
  expiresInHours?: number;
  maxAccessCount?: number;
  passcode?: string;
  recipientEmail?: string;
  recipientName?: string;
  purpose?: string;
  includeJourney?: boolean;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  recordIds?: string[];
  categories?: string[];
}

export class SmartHealthLinksService {
  private static instance: SmartHealthLinksService;

  static getInstance(): SmartHealthLinksService {
    if (!SmartHealthLinksService.instance) {
      SmartHealthLinksService.instance = new SmartHealthLinksService();
    }
    return SmartHealthLinksService.instance;
  }

  /**
   * Generate a secure, encrypted token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Encrypt a token for secure transmission
   */
  private encryptToken(token: string): string {
    const key = scryptSync(ENCRYPTION_KEY, "salt", 32);
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a token
   */
  private decryptToken(encryptedData: string): string | null {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
      const key = scryptSync(ENCRYPTION_KEY, "salt", 32);
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      
      const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: 16 });
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      
      return decrypted;
    } catch (error) {
      console.error("Token decryption failed:", error);
      return null;
    }
  }

  /**
   * Create a smart health link for sharing medical journey
   */
  async createSmartHealthLink(options: CreateSmartLinkOptions): Promise<SmartHealthLink> {
    const {
      userId,
      expiresInHours = 24,
      maxAccessCount,
      passcode,
      recipientEmail,
      recipientName,
      purpose,
      includeJourney = true,
      dateRangeStart,
      dateRangeEnd,
      recordIds,
      categories,
    } = options;

    const token = this.generateSecureToken();
    const encryptedToken = this.encryptToken(token);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const [link] = await db
      .insert(shareLinks)
      .values({
        userId,
        token,
        passcode: passcode || null,
        expiresAt,
        isRevoked: false,
        recordIds: recordIds || null,
        categories: categories || null,
        dateRangeStart: dateRangeStart || null,
        dateRangeEnd: dateRangeEnd || null,
      })
      .returning();

    await db.insert(shareLinkAccessLogs).values({
      shareLinkId: link.id,
      action: "created",
      accessorIp: null,
      accessorUserAgent: null,
      metadata: {
        recipientEmail,
        recipientName,
        purpose,
        includeJourney,
        maxAccessCount,
        expiresInHours,
      },
    });

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    return {
      id: link.id,
      token,
      encryptedToken,
      shareUrl: `${baseUrl}/share/${token}`,
      expiresAt,
      expiresInHours,
      accessCount: 0,
      maxAccessCount,
      isRevoked: false,
      recipientEmail,
      recipientName,
      purpose,
      includeJourney,
      createdAt: link.createdAt,
    };
  }

  /**
   * Validate and access a smart health link
   */
  async accessSmartHealthLink(
    token: string,
    passcode?: string,
    accessorInfo?: { ip?: string; userAgent?: string }
  ): Promise<{
    success: boolean;
    error?: string;
    data?: {
      journey?: Awaited<ReturnType<typeof medicalJourneyService.buildMedicalJourney>>;
      records?: any[];
      expiresAt: Date;
      ownerName?: string;
    };
  }> {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .limit(1);

    if (!link) {
      return { success: false, error: "Link not found" };
    }

    if (link.isRevoked) {
      await this.logAccess(link.id, "access_denied_revoked", accessorInfo);
      return { success: false, error: "This link has been revoked" };
    }

    if (new Date() > link.expiresAt) {
      await this.logAccess(link.id, "access_denied_expired", accessorInfo);
      return { success: false, error: "This link has expired" };
    }

    if (link.passcode && link.passcode !== passcode) {
      await this.logAccess(link.id, "access_denied_wrong_passcode", accessorInfo);
      return { success: false, error: "Invalid passcode" };
    }

    const accessLogs = await db
      .select()
      .from(shareLinkAccessLogs)
      .where(eq(shareLinkAccessLogs.shareLinkId, link.id));

    const creationLog = accessLogs.find(log => log.action === "created");
    const maxAccessCount = (creationLog?.metadata as any)?.maxAccessCount;
    const viewCount = accessLogs.filter(log => log.action === "viewed").length;

    if (maxAccessCount && viewCount >= maxAccessCount) {
      await this.logAccess(link.id, "access_denied_max_reached", accessorInfo);
      return { success: false, error: "Maximum access count reached" };
    }

    await db
      .update(shareLinks)
      .set({
        viewCount: (link.viewCount || 0) + 1,
        lastViewedAt: new Date(),
      })
      .where(eq(shareLinks.id, link.id));

    await this.logAccess(link.id, "viewed", accessorInfo);

    const [owner] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1);

    const includeJourney = (creationLog?.metadata as any)?.includeJourney !== false;

    let journey;
    if (includeJourney) {
      journey = await medicalJourneyService.buildMedicalJourney(
        link.userId,
        link.dateRangeStart || undefined,
        link.dateRangeEnd || undefined
      );
    }

    let records;
    if (link.recordIds) {
      records = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.userId, link.userId));
      
      const recordIdList = link.recordIds as string[];
      records = records.filter(r => recordIdList.includes(r.id));
    }

    return {
      success: true,
      data: {
        journey,
        records,
        expiresAt: link.expiresAt,
        ownerName: owner?.name,
      },
    };
  }

  /**
   * Log access attempt
   */
  private async logAccess(
    shareLinkId: string,
    action: string,
    accessorInfo?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await db.insert(shareLinkAccessLogs).values({
      shareLinkId,
      action,
      accessorIp: accessorInfo?.ip || null,
      accessorUserAgent: accessorInfo?.userAgent || null,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Get all smart health links for a user
   */
  async getUserLinks(userId: string): Promise<SmartHealthLink[]> {
    const links = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.userId, userId))
      .orderBy(desc(shareLinks.createdAt));

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    return links.map(link => ({
      id: link.id,
      token: link.token,
      encryptedToken: this.encryptToken(link.token),
      shareUrl: `${baseUrl}/share/${link.token}`,
      expiresAt: link.expiresAt,
      expiresInHours: Math.max(0, Math.round((link.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))),
      accessCount: link.viewCount || 0,
      isRevoked: link.isRevoked || false,
      includeJourney: true,
      createdAt: link.createdAt,
    }));
  }

  /**
   * Revoke a smart health link — caller must own the link
   */
  async revokeLink(linkId: string, revokedBy: string): Promise<boolean> {
    const [link] = await db
      .select({ userId: shareLinks.userId })
      .from(shareLinks)
      .where(eq(shareLinks.id, linkId));

    if (!link) {
      return false;
    }

    if (link.userId !== revokedBy) {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    }

    await db
      .update(shareLinks)
      .set({ isRevoked: true })
      .where(and(eq(shareLinks.id, linkId), eq(shareLinks.userId, revokedBy)));

    await db.insert(shareLinkAccessLogs).values({
      shareLinkId: linkId,
      action: "revoked",
      accessorIp: null,
      accessorUserAgent: null,
      metadata: { revokedBy, timestamp: new Date().toISOString() },
    });

    return true;
  }

  /**
   * Get access history for a link — caller must own the link
   */
  async getLinkAccessHistory(linkId: string, requestingUserId: string): Promise<Array<{
    action: string;
    accessorIp: string | null;
    accessedAt: Date;
  }>> {
    const [link] = await db
      .select({ userId: shareLinks.userId })
      .from(shareLinks)
      .where(eq(shareLinks.id, linkId));

    if (!link) {
      return [];
    }

    if (link.userId !== requestingUserId) {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    }

    const logs = await db
      .select()
      .from(shareLinkAccessLogs)
      .where(eq(shareLinkAccessLogs.shareLinkId, linkId))
      .orderBy(desc(shareLinkAccessLogs.createdAt));

    return logs.map(log => ({
      action: log.action,
      accessorIp: log.accessorIp,
      accessedAt: log.createdAt,
    }));
  }
}

export const smartHealthLinksService = SmartHealthLinksService.getInstance();
