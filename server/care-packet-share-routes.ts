import { Router, Request, Response } from "express";
import crypto from "crypto";
import type { CarePacketType } from "@shared/schema";
import { carePacketLabels } from "@shared/schema";

const router = Router();

interface PacketShareData {
  shareId: string;
  packetType: CarePacketType;
  accessCode: string;
  secureLink: string;
  expiresAt: Date;
  createdAt: Date;
  accessCount: number;
  revoked: boolean;
  patientId: string;
}

const packetShares = new Map<string, PacketShareData>();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    category: "CARE_PACKET_SHARE",
  };
  console.log("[HIPAA-AUDIT][CARE-PACKET-SHARE]", JSON.stringify(auditEntry));
}

function generateAccessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function parseExpiration(expiration: string): Date {
  const now = new Date();
  const match = expiration.match(/^(\d+)(h|d)$/);
  if (!match) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  if (unit === "h") {
    return new Date(now.getTime() + value * 60 * 60 * 1000);
  } else if (unit === "d") {
    return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
  }
  
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

router.post("/share", async (req: Request, res: Response) => {
  logHIPAAAudit("CREATE_PACKET_SHARE", { packetType: req.body.packetType }, req);
  
  try {
    const { packetType, expiration } = req.body;
    
    if (!packetType || !carePacketLabels[packetType as CarePacketType]) {
      return res.status(400).json({ error: "Invalid packet type" });
    }
    
    const shareId = `pkt-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const accessCode = generateAccessCode();
    const expiresAt = parseExpiration(expiration || "24h");
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:5000`;
    
    const secureLink = `${baseUrl}/shared-packet/${shareId}`;
    
    const shareData: PacketShareData = {
      shareId,
      packetType: packetType as CarePacketType,
      accessCode,
      secureLink,
      expiresAt,
      createdAt: new Date(),
      accessCount: 0,
      revoked: false,
      patientId: hashForAudit(req.ip || "anonymous"),
    };
    
    packetShares.set(shareId, shareData);
    
    res.json({
      shareId,
      secureLink,
      accessCode,
      expiresAt: expiresAt.toISOString(),
      packetType,
    });
  } catch (error) {
    console.error("Error creating packet share:", error);
    res.status(500).json({ error: "Failed to create share link" });
  }
});

router.get("/shares", async (req: Request, res: Response) => {
  logHIPAAAudit("LIST_PACKET_SHARES", {}, req);
  
  try {
    const patientId = hashForAudit(req.ip || "anonymous");
    
    const shares = Array.from(packetShares.values())
      .filter(share => share.patientId === patientId && !share.revoked)
      .map(share => ({
        shareId: share.shareId,
        packetType: share.packetType,
        expiresAt: share.expiresAt.toISOString(),
        accessCount: share.accessCount,
        createdAt: share.createdAt.toISOString(),
        secureLink: share.secureLink,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(shares);
  } catch (error) {
    console.error("Error listing packet shares:", error);
    res.status(500).json({ error: "Failed to list share links" });
  }
});

router.delete("/shares/:shareId", async (req: Request, res: Response) => {
  logHIPAAAudit("REVOKE_PACKET_SHARE", { shareId: req.params.shareId }, req);
  
  try {
    const { shareId } = req.params;
    const share = packetShares.get(shareId);
    
    if (!share) {
      return res.status(404).json({ error: "Share link not found" });
    }
    
    share.revoked = true;
    packetShares.set(shareId, share);
    
    res.json({ success: true, shareId, revokedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error revoking packet share:", error);
    res.status(500).json({ error: "Failed to revoke share link" });
  }
});

router.get("/access/:shareId", async (req: Request, res: Response) => {
  logHIPAAAudit("ACCESS_SHARED_PACKET", { shareId: req.params.shareId }, req);
  
  try {
    const { shareId } = req.params;
    const { code } = req.query;
    
    const share = packetShares.get(shareId);
    
    if (!share) {
      return res.status(404).json({ error: "Share link not found" });
    }
    
    if (share.revoked) {
      return res.status(410).json({ error: "This share link has been revoked" });
    }
    
    if (new Date() > share.expiresAt) {
      return res.status(410).json({ error: "This share link has expired" });
    }
    
    if (share.accessCode !== code) {
      return res.status(403).json({ error: "Invalid access code" });
    }
    
    share.accessCount++;
    packetShares.set(shareId, share);
    
    res.json({
      valid: true,
      packetType: share.packetType,
      expiresAt: share.expiresAt.toISOString(),
      accessedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error accessing shared packet:", error);
    res.status(500).json({ error: "Failed to access shared packet" });
  }
});

export function registerCarePacketShareRoutes(app: any) {
  app.use("/api/care-packets", router);
}
