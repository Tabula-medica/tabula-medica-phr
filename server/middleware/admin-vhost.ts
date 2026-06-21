/**
 * H12 — Admin vhost split
 *
 * Two production hostnames:
 *   - tabulamedica.health         → patient/clinician app, NO admin surfaces
 *   - admin.tabulamedica.health   → admin/compliance surfaces ONLY
 *
 * On the public hostname, admin URLs return 404 (so we don't even reveal
 * their existence). On the admin hostname, the patient app is hidden.
 *
 * The split is OFF by default (dev convenience). Enable in prod by setting:
 *   ADMIN_HOST_SPLIT=enabled
 *   ADMIN_HOST=admin.tabulamedica.health
 *   MAIN_HOST=tabulamedica.health         (optional — defaults to "everything else")
 *
 * Replit dev domains and localhost always pass through as MAIN host so the
 * existing dev workflow (one preview URL, see everything) stays intact.
 *
 * Sentinels are matched by URL prefix. Adding a new admin route? Add its
 * prefix to ADMIN_PATH_PREFIXES below.
 */

import type { Request, Response, NextFunction } from "express";

export const ADMIN_PATH_PREFIXES = [
  // SPA pages
  "/admin",
  // API surfaces
  "/api/admin",
  "/api/admin-automation",
  "/api/compliance-roles",
  "/api/audit-export",
  "/api/audit-visualization",
  "/api/worm-audit",
  "/api/hipaa-",
  "/api/ai-admin-",
  "/api/admin-data",
  "/api/admin-workflow",
];

// Paths that must work on BOTH hosts even when split is enabled.
// Auth + healthchecks + static assets + the SPA shell + the report verify
// oracle (intentionally cross-host so external auditors can verify).
const SHARED_PATH_PREFIXES = [
  "/api/auth",
  "/api/login",
  "/api/logout",
  "/api/callback",
  "/api/health",
  "/api/reports/public-key",
  "/api/reports/verify",
  "/assets",
  "/@vite",
  "/@react-refresh",
  "/src",
  "/node_modules",
  "/favicon",
  "/manifest.webmanifest",
  "/sw.js",
];

function isAdminPath(url: string): boolean {
  return ADMIN_PATH_PREFIXES.some((p) => url === p || url.startsWith(p + "/") || url.startsWith(p + "?"));
}
function isSharedPath(url: string): boolean {
  return SHARED_PATH_PREFIXES.some((p) => url === p || url.startsWith(p));
}

function isLocalOrDevHost(host: string): boolean {
  // Replit preview domains, localhost, and any private/dev host. Always
  // treated as MAIN so devs still see everything in one place.
  if (!host) return true;
  const h = host.toLowerCase().split(":")[0];
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".replit.dev") ||
    h.endsWith(".repl.co") ||
    h.endsWith(".replit.app") ||
    h.endsWith(".picard.replit.dev")
  );
}

export interface AdminVhostConfig {
  enabled: boolean;
  adminHost: string | null;
  mainHost: string | null;
}

export function getAdminVhostConfig(): AdminVhostConfig {
  return {
    enabled: process.env.ADMIN_HOST_SPLIT === "enabled",
    adminHost: process.env.ADMIN_HOST?.toLowerCase().trim() || null,
    mainHost: process.env.MAIN_HOST?.toLowerCase().trim() || null,
  };
}

/**
 * Return value (used by the diag endpoint and by tests).
 *   "main"  — request is on the public app host
 *   "admin" — request is on the admin host
 *   "dev"   — local/replit dev host, treated as main+admin (no gating)
 */
export type VhostKind = "main" | "admin" | "dev";
export function classifyHost(host: string, cfg: AdminVhostConfig): VhostKind {
  if (!cfg.enabled) return "dev";
  if (isLocalOrDevHost(host)) return "dev";
  const h = (host || "").toLowerCase().split(":")[0];
  if (cfg.adminHost && h === cfg.adminHost) return "admin";
  return "main";
}

export function adminVhostMiddleware() {
  const cfg = getAdminVhostConfig();
  if (cfg.enabled) {
    console.log(
      `[AdminVhost] ENABLED adminHost=${cfg.adminHost ?? "(unset)"} mainHost=${cfg.mainHost ?? "(any)"}`,
    );
    if (!cfg.adminHost) {
      console.warn("[AdminVhost] ADMIN_HOST_SPLIT=enabled but ADMIN_HOST is unset — admin paths will 404 everywhere");
    }
  } else {
    console.log("[AdminVhost] disabled (single-host mode)");
  }

  return function middleware(req: Request, res: Response, next: NextFunction) {
    if (!cfg.enabled) return next();
    const host = (req.headers.host as string) || "";
    const kind = classifyHost(host, cfg);
    if (kind === "dev") return next();

    const url = req.originalUrl || req.url;
    if (isSharedPath(url)) return next();

    const adminish = isAdminPath(url);

    if (kind === "main" && adminish) {
      // Hide admin surfaces from the public host. Plain 404, no leak.
      return res.status(404).end();
    }
    if (kind === "admin" && !adminish) {
      // On admin host, redirect SPA root to /admin so the dashboard loads
      // first; everything else 404s.
      if (url === "/" || url === "/index.html") {
        return res.redirect(302, "/admin");
      }
      return res.status(404).end();
    }
    next();
  };
}

/**
 * Diagnostic — shows current config and how the calling host classifies.
 * Used by the /api/_admin-vhost/health endpoint.
 */
export function vhostDiag(req: Request) {
  const cfg = getAdminVhostConfig();
  const host = (req.headers.host as string) || "";
  return {
    enabled: cfg.enabled,
    adminHost: cfg.adminHost,
    mainHost: cfg.mainHost,
    requestHost: host,
    classifiedAs: classifyHost(host, cfg),
    adminPathPrefixes: ADMIN_PATH_PREFIXES,
  };
}
