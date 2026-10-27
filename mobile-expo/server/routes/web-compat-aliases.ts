import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { requireAuth } from "../middleware/require-auth";
import { getUserId } from "./_helpers";

function toProfile(user: { name?: string | null; email?: string | null }) {
  const displayName = (user.name || "").trim() || (user.email || "User");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    displayName,
    email: user.email || "",
    phone: "",
    avatarInitials: initials,
  };
}

const PATH_ALIASES: Record<string, string> = {
  "POST /api/auth/gcip/session": "/api/auth/gcip",
  "GET /api/auth/user": "/api/auth/me",
  "GET /api/auth/mfa/status": "/api/security/mfa/status",
  "POST /api/mfa/confirm": "/api/security/mfa/confirm",
  "POST /api/mfa/backup-codes/regenerate": "/api/security/mfa/generate-backup-codes",
  "POST /api/mfa/resend": "/api/security/mfa/enroll",
};

export function registerWebCompatAliases(app: Express): void {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.method} ${req.path}`;
    const target = PATH_ALIASES[key];
    if (target) {
      const suffix = req.url.slice(req.path.length);
      req.url = target + suffix;
    }
    next();
  });

  app.get("/api/user-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toProfile(user));
    } catch (error) {
      console.error("[web-compat] GET /api/user-profile error:", error);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  app.patch("/api/user-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const { displayName, email } = (req.body || {}) as { displayName?: string; email?: string; phone?: string };
      const updates: { name?: string; email?: string } = {};
      if (typeof displayName === "string" && displayName.trim()) updates.name = displayName.trim();
      if (typeof email === "string" && email.trim()) updates.email = email.trim();
      const updated = Object.keys(updates).length > 0
        ? await storage.updateUser(userId, updates)
        : await storage.getUser(userId);
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json(toProfile(updated));
    } catch (error) {
      console.error("[web-compat] PATCH /api/user-profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/logout", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const rawToken = authHeader.substring(7).trim();
        if (rawToken) {
          const hashedToken = createHash("sha256").update(rawToken).digest("hex");
          try {
            const session = await storage.getUserSessionByAccessToken(hashedToken);
            if (session) {
              await storage.revokeUserSession(session.id);
            }
          } catch (err) {
            console.warn("[web-compat] /api/logout: session revoke failed (non-fatal):", err);
          }
        }
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("[web-compat] /api/logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  console.log("[web-compat] Registered web frontend compatibility aliases:", {
    pathAliases: Object.keys(PATH_ALIASES).length,
    extraHandlers: ["POST /api/logout", "GET /api/user-profile", "PATCH /api/user-profile"],
  });
}
