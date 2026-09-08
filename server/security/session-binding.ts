/**
 * Session binding — detects (and optionally terminates) sessions whose
 * device / network context changes mid-life.
 *
 * CrowdStrike 2026: 82% of intrusions were malware-free, vishing intrusions
 * doubled in H1 2026, and AiTM phishing pages + OAuth device-code abuse let
 * adversaries replay a *valid* session or token from their own
 * infrastructure. A stolen cookie presented from a different user agent or
 * country is the observable signature. This module binds a lightweight,
 * PHI-free fingerprint to the Express session at first authenticated use
 * and evaluates every subsequent request against it.
 *
 * Modes (SESSION_BINDING_MODE):
 *   off      — middleware is a no-op.
 *   monitor  — default. Anomalies are logged as security events only.
 *   enforce  — HIGH anomalies (user-agent or country change) destroy the
 *              session and return 401 `SESSION_REBIND_REQUIRED`. Network
 *              changes alone (mobile roaming, Wi-Fi ↔ cellular) are never
 *              enforced.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logSecurityEvent } from "./gcp-audit-logger";
import { getRequestId } from "./production-logger";

export interface SessionFingerprint {
  uaHash: string;
  netHash: string;
  country?: string;
  boundAt: number;
}

export type BindingReason = "user_agent_changed" | "country_changed" | "network_changed";
export type BindingSeverity = "none" | "medium" | "high";

export interface BindingVerdict {
  anomaly: boolean;
  severity: BindingSeverity;
  reasons: BindingReason[];
}

export type SessionBindingMode = "off" | "monitor" | "enforce";

declare module "express-session" {
  interface SessionData {
    tmBinding?: SessionFingerprint;
  }
}

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/** Collapses an IP to a coarse network prefix so DHCP churn inside one network is not an anomaly. */
export function networkPrefix(ip: string | undefined): string {
  if (!ip) return "unknown";
  const clean = ip.replace(/^::ffff:/, "").trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    return clean.split(".").slice(0, 3).join(".") + ".0/24";
  }
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return "unknown";
}

export function clientIpOf(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
  return first?.trim() || req.ip || req.socket?.remoteAddress || undefined;
}

export function fingerprintRequest(req: Request, now: number = Date.now()): SessionFingerprint {
  const ua = (req.headers["user-agent"] as string) || "unknown";
  return {
    uaHash: shortHash(ua),
    netHash: shortHash(networkPrefix(clientIpOf(req))),
    country: req.country,
    boundAt: now,
  };
}

/** Pure comparison used by the middleware and by tests. */
export function evaluateBinding(bound: SessionFingerprint, current: SessionFingerprint): BindingVerdict {
  const reasons: BindingReason[] = [];
  if (bound.uaHash !== current.uaHash) reasons.push("user_agent_changed");
  if (bound.country && current.country && bound.country !== current.country) reasons.push("country_changed");
  if (bound.netHash !== current.netHash) reasons.push("network_changed");

  if (reasons.length === 0) return { anomaly: false, severity: "none", reasons };
  const high = reasons.includes("user_agent_changed") || reasons.includes("country_changed");
  return { anomaly: true, severity: high ? "high" : "medium", reasons };
}

export function resolveSessionBindingMode(explicit?: SessionBindingMode): SessionBindingMode {
  if (explicit) return explicit;
  const env = (process.env.SESSION_BINDING_MODE || "monitor").toLowerCase();
  if (env === "off" || env === "enforce" || env === "monitor") return env;
  return "monitor";
}

export interface SessionBindingOptions {
  mode?: SessionBindingMode;
  excludePaths?: string[];
}

const DEFAULT_EXCLUDES = ["/api/health", "/api/logout", "/api/mobile/auth/logout", "/api/auth/gcip/session", "/api/compliance-status"];

/**
 * Express middleware. Requires session + passport to be initialised first
 * (mounted from `setupAuth`). Only authenticated requests are evaluated.
 */
export function sessionBindingMiddleware(options: SessionBindingOptions = {}): RequestHandler {
  const excludes = options.excludePaths ?? DEFAULT_EXCLUDES;

  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = resolveSessionBindingMode(options.mode);
    if (mode === "off") return next();
    if (excludes.some((p) => req.path.startsWith(p))) return next();

    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;
    const session = req.session;
    if (!userId || !session) return next();

    const current = fingerprintRequest(req);
    const bound = session.tmBinding;

    if (!bound) {
      session.tmBinding = current;
      return next();
    }

    const verdict = evaluateBinding(bound, current);
    if (!verdict.anomaly) return next();

    const enforce = mode === "enforce" && verdict.severity === "high";
    void logSecurityEvent({
      eventType: enforce ? "session_binding_terminated" : "session_binding_anomaly",
      actor: userId,
      ip: clientIpOf(req),
      riskLevel: verdict.severity === "high" ? "high" : "medium",
      details: {
        requestId: getRequestId(req),
        path: req.path,
        method: req.method,
        mode,
        reasons: verdict.reasons,
        boundCountry: bound.country,
        currentCountry: current.country,
        boundAgeMinutes: Math.floor((Date.now() - bound.boundAt) / 60000),
        actionTaken: enforce ? "session_destroyed_401" : "logged_only",
      },
    });

    if (!enforce) {
      // Adopt the new network context so a legitimate roam is reported once,
      // but keep the original UA/country so a hijack keeps firing.
      if (verdict.reasons.length === 1 && verdict.reasons[0] === "network_changed") {
        session.tmBinding = { ...bound, netHash: current.netHash };
      }
      return next();
    }

    const finish = () => {
      res.status(401).json({
        error: "SESSION_REBIND_REQUIRED",
        message: "Your session was used from a different device or location and has been ended. Please sign in again.",
        reasons: verdict.reasons,
        requestId: getRequestId(req),
      });
    };
    const logoutFn = (req as any).logout as ((cb: (err?: unknown) => void) => void) | undefined;
    const destroy = () => session.destroy(() => finish());
    if (typeof logoutFn === "function") {
      try { logoutFn.call(req, () => destroy()); } catch { destroy(); }
    } else {
      destroy();
    }
  };
}
