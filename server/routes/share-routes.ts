import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { isAuthenticated } from "../replit_integrations/auth";

interface AuthUser {
  claims?: {
    sub?: string;
  };
}

function getAuthenticatedUserId(req: Request): string | null {
  const user = req.user as AuthUser | undefined;
  return user?.claims?.sub || null;
}

const router = Router();

interface ShareLink {
  id: string;
  url: string;
  pin?: string;
  patientId?: string;
  createdBy: string;
  resourceType: string;
  resourceIds?: string[];
  expiresAt: string;
  viewCount: number;
  maxViews?: number;
  isRevoked: boolean;
  createdAt: string;
  accessLog: { timestamp: string; ipHash: string }[];
}

// In-memory store for share links
const shareLinks: Map<string, ShareLink> = new Map();

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").substring(0, 12);
}

router.post("/create", isAuthenticated, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { patientId, resourceType, resourceIds, settings } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId is required" });
    }

    if (patientId !== userId) {
      return res.status(403).json({ success: false, error: "You can only create shares for your own patient record" });
    }

    const id = uuidv4();
    const expiresAt = new Date(Date.now() + (settings?.expiryHours || 24) * 60 * 60 * 1000);

    const shareLink: ShareLink = {
      id,
      url: `${req.protocol}://${req.get("host")}/share/${id}`,
      pin: settings?.usePin ? generatePin() : undefined,
      patientId,
      createdBy: userId,
      resourceType: resourceType || "summary",
      resourceIds,
      expiresAt: expiresAt.toISOString(),
      viewCount: 0,
      maxViews: settings?.maxViews,
      isRevoked: false,
      createdAt: new Date().toISOString(),
      accessLog: [],
    };

    shareLinks.set(id, shareLink);

    console.log(`[ShareService] Created share link: ${id} (expires: ${shareLink.expiresAt})`);

    res.json(shareLink);
  } catch (error: any) {
    console.error("[ShareService] Error creating share link:", error);
    res.status(500).json({ success: false, error: "Failed to create share link" });
  }
});

router.post("/:shareId/revoke", isAuthenticated, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { shareId } = req.params;

    const shareLink = shareLinks.get(shareId);
    if (!shareLink) {
      return res.status(404).json({ success: false, error: "Share link not found" });
    }

    if (shareLink.createdBy !== userId) {
      return res.status(403).json({ success: false, error: "You can only revoke your own share links" });
    }

    shareLink.isRevoked = true;
    shareLinks.set(shareId, shareLink);

    console.log(`[ShareService] Revoked share link: ${shareId}`);

    res.json({ success: true, message: "Share link revoked" });
  } catch (error: any) {
    console.error("[ShareService] Error revoking share link:", error);
    res.status(500).json({ success: false, error: "Failed to revoke share link" });
  }
});

router.get("/:shareId", (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { pin } = req.query;

    const shareLink = shareLinks.get(shareId);
    if (!shareLink) {
      return res.status(404).json({ success: false, error: "Share link not found" });
    }

    if (shareLink.isRevoked) {
      return res.status(410).json({ success: false, error: "This share link has been revoked" });
    }

    if (new Date(shareLink.expiresAt) < new Date()) {
      return res.status(410).json({ success: false, error: "This share link has expired" });
    }

    if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
      return res.status(410).json({ success: false, error: "This share link has reached its view limit" });
    }

    if (shareLink.pin && shareLink.pin !== pin) {
      return res.status(401).json({ success: false, error: "Invalid PIN", requiresPin: true });
    }

    shareLink.viewCount++;
    shareLink.accessLog.push({
      timestamp: new Date().toISOString(),
      ipHash: hashIp(req.ip || "unknown"),
    });
    shareLinks.set(shareId, shareLink);

    res.json({
      success: true,
      resourceType: shareLink.resourceType,
      resourceIds: shareLink.resourceIds,
      viewCount: shareLink.viewCount,
      expiresAt: shareLink.expiresAt,
    });
  } catch (error: any) {
    console.error("[ShareService] Error accessing share link:", error);
    res.status(500).json({ success: false, error: "Failed to access share link" });
  }
});

router.get("/patient/:patientId/active", isAuthenticated, (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { patientId } = req.params;

    if (patientId !== userId) {
      return res.status(403).json({ success: false, error: "You can only view your own active shares" });
    }

    const activeShares = Array.from(shareLinks.values())
      .filter(link =>
        link.patientId === patientId &&
        link.createdBy === userId &&
        !link.isRevoked &&
        new Date(link.expiresAt) > new Date()
      );

    res.json({ success: true, shares: activeShares });
  } catch (error: any) {
    console.error("[ShareService] Error fetching active shares:", error);
    res.status(500).json({ success: false, error: "Failed to fetch active shares" });
  }
});

export default router;
