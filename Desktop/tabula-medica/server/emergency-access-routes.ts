/**
 * Emergency ("break-glass") access routes.
 *
 *  Patient-facing (AUTH): manage the emergency folder, device cards, and tokens.
 *  Break-glass (PUBLIC):  /access/:token (basic, PIN-less) and
 *                         /access/:token/full (PIN/DOB-gated). EMS has no app
 *                         identity, so these are intentionally unauthenticated —
 *                         the token (+ PIN/DOB for full) is the gate and every
 *                         access is audited. They MUST be in the C5 PUBLIC_API
 *                         allowlist (added in routes.ts).
 */
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { emergencyAccessService, type AccessorInfo } from "./services/emergency-access-service";

function getUserId(req: Request): string | undefined {
  const u = (req as any).user;
  return u?.claims?.sub || u?.id || (req as any).session?.userId;
}

function accessorInfo(req: Request): AccessorInfo {
  return {
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || undefined,
    userAgent: req.get("user-agent") || undefined,
    accessorAgency: typeof req.body?.accessorAgency === "string" ? req.body.accessorAgency : (req.query.agency as string) || undefined,
  };
}

// wrap async handlers so a thrown/rejected error becomes a clean 500 instead of
// an unhandled rejection (the break-glass endpoints query the DB unauthenticated).
function safe(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[EmergencyAccess] handler error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Emergency service error" });
    }
  };
}

export function registerEmergencyAccessRoutes(app: Express): void {
  const auth = isAuthenticated as any;

  // ── Patient: emergency profile ─────────────────────────────────────────────
  app.get("/api/emergency/profile", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    res.json((await emergencyAccessService.getProfile(userId)) ?? null);
  }));

  app.put("/api/emergency/profile", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    res.json(await emergencyAccessService.upsertProfile(userId, req.body ?? {}));
  }));

  // ── Patient: implanted device cards ────────────────────────────────────────
  app.get("/api/emergency/devices", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    res.json(await emergencyAccessService.listDevices(userId));
  }));

  app.post("/api/emergency/devices", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    if (!req.body?.deviceType || !req.body?.name) return res.status(400).json({ error: "deviceType and name are required" });
    res.status(201).json(await emergencyAccessService.addDevice(userId, req.body));
  }));

  app.delete("/api/emergency/devices/:id", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    await emergencyAccessService.deleteDevice(userId, req.params.id);
    res.status(204).end();
  }));

  // ── Patient: token lifecycle ───────────────────────────────────────────────
  app.post("/api/emergency/token", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { expiresInHours, maxFullAccesses, pin, dob, label } = req.body ?? {};
    res.status(201).json(await emergencyAccessService.createToken(userId, { expiresInHours, maxFullAccesses, pin, dob, label }));
  }));

  app.get("/api/emergency/tokens", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    res.json(await emergencyAccessService.listTokens(userId));
  }));

  app.post("/api/emergency/token/:token/revoke", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const ok = await emergencyAccessService.revokeToken(userId, req.params.token);
    res.status(ok ? 200 : 404).json({ revoked: ok });
  }));

  app.get("/api/emergency/access-logs", auth, safe(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    res.json(await emergencyAccessService.getAccessLogs(userId, req.query.token as string | undefined));
  }));

  // ── PUBLIC break-glass (EMS/ER) — token-gated + audited, NOT app-authed ─────
  app.get("/api/emergency/access/:token", safe(async (req, res) => {
    const result = await emergencyAccessService.accessBasic(req.params.token, accessorInfo(req));
    if (!result.ok) return res.status(result.status).json({ error: result.error, fullTierProtected: (result as any).fullTierProtected });
    res.json(result);
  }));

  app.post("/api/emergency/access/:token/full", safe(async (req, res) => {
    const { pin, dob } = req.body ?? {};
    const result = await emergencyAccessService.accessFull(req.params.token, { pin, dob }, accessorInfo(req));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result);
  }));

  console.log("[Routes] Emergency break-glass access registered at /api/emergency/* (access endpoints public + audited)");
}
