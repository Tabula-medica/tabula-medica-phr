/**
 * Geo-fencing middleware for FHIR / TEFCA / Fasten health-data routes.
 *
 * HIPAA-covered health data exchange APIs must only be accessible from
 * US-based IP addresses. This middleware reads the country code from three
 * sources in priority order:
 *
 *   1. CF-IPCountry   — Cloudflare (primary CDN in production). Authoritative
 *                       when GEO_FENCE_REQUIRE_CF_PROXY is set (see below).
 *   2. X-AppEngine-Country — GCP App Engine / Cloud Run via LB.
 *   3. X-Forwarded-For IP-lookup — real client IP extracted from the leftmost
 *                       non-private hop, resolved via the embedded MaxMind
 *                       GeoLite2 database bundled with geoip-lite.
 *
 * Non-US requests to RESTRICTED_PATH_PREFIXES receive:
 *   HTTP 403  { "error": "Access to this resource is restricted to the
 *               United States.", "code": "GEO_RESTRICTED" }
 *
 * Header trust model — PRODUCTION SETUP REQUIRED:
 *   CF-IPCountry is only tamper-proof when requests must enter through
 *   Cloudflare. In Cloud Run this requires TWO infrastructure controls:
 *
 *   (a) Cloud Run ingress policy = "internal-and-cloud-load-balancing"
 *       — set via: gcloud run services update tabula-medica-web
 *           --ingress=internal-and-cloud-load-balancing
 *       This blocks direct-to-origin access (*.run.app) so clients CANNOT
 *       reach Cloud Run except via the HTTPS LB that Cloudflare sits in front of.
 *
 *   (b) GEO_FENCE_REQUIRE_CF_PROXY=1 env var (set in Cloud Run secrets)
 *       — enables the CF-Ray header guard: if CF-IPCountry is absent or the
 *       CF-Ray header (set by Cloudflare on every proxied request) is absent,
 *       the request is blocked with 403 GEO_RESTRICTED. This catches any
 *       request that somehow bypassed Cloudflare and arrived at origin directly.
 *
 *   Together these ensure CF-IPCountry is always from Cloudflare, not from a
 *   client-supplied header. Without (a), a client with direct *.run.app access
 *   can spoof CF-IPCountry=US; without (b), the app cannot detect the bypass.
 *
 * Configuration:
 *   GEO_ALLOWED_COUNTRIES (CSV, default "US")
 *     — override list of ISO 3166-1 alpha-2 country codes.
 *   GEO_FENCE_BYPASS (any non-empty value)
 *     — disables enforcement entirely. NEVER set in production.
 *   GEO_FENCE_REQUIRE_CF_PROXY (any non-empty value)
 *     — enforce that CF-Ray header is present. Blocks requests that arrive
 *       without a CF-Ray, i.e. bypassed Cloudflare. Enable in production once
 *       Cloud Run ingress is restricted to internal-and-cloud-load-balancing.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const RESTRICTED_PATH_PREFIXES = [
  "/api/fhir-data-hub",
  "/api/tefca",
  "/api/fasten",
];

// ── Private IP detection ──────────────────────────────────────────────────────

const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fd[0-9a-f]{2}:|fc[0-9a-f]{2}:)/i;

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RE.test(ip.trim());
}

// ── GeoIP lookup via geoip-lite (lazy-loaded) ────────────────────────────────

let _geoipLookup: ((ip: string) => string | null) | null | undefined = undefined;

function geoipCountry(ip: string): string | null {
  if (_geoipLookup === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const geoip = require("geoip-lite");
      _geoipLookup = (addr: string): string | null => geoip.lookup(addr)?.country ?? null;
      logger.info("[GeoFence] geoip-lite loaded for X-Forwarded-For IP fallback");
    } catch {
      _geoipLookup = null;
      logger.warn(
        "[GeoFence] geoip-lite not available — XFF IP fallback disabled (fail-closed)",
      );
    }
  }
  if (_geoipLookup === null) return null;
  try {
    return _geoipLookup(ip);
  } catch {
    return null;
  }
}

// ── X-Forwarded-For client IP extraction ─────────────────────────────────────

/**
 * Return the leftmost non-private IP from the X-Forwarded-For header.
 * Returns null when all hops are private (= internal probe traffic).
 */
export function extractClientIpFromXff(xff: string): string | null {
  const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
  for (const hop of hops) {
    if (hop && !isPrivateIp(hop)) return hop;
  }
  return null;
}

// ── Country code resolution ───────────────────────────────────────────────────

/**
 * Resolve country code from the request using the three-source priority chain.
 *
 * Returns:
 *   - ISO 3166-1 alpha-2 string (e.g. "US", "GB") for a resolved geo country
 *   - "PRIVATE" when all resolvable source IPs are RFC-1918 / loopback
 *     (internal health-check traffic that must never be geo-blocked)
 *   - null when the country cannot be determined (fail-closed)
 */
function getCountryCode(req: Request): string | null {
  // ── Source 1: Cloudflare CF-IPCountry ───────────────────────────────────────
  // CF-Ray is set by Cloudflare on every proxied request. If CF-Ray is absent
  // and GEO_FENCE_REQUIRE_CF_PROXY is set, we treat the CF-IPCountry header as
  // untrusted (it may have been spoofed by a client that reached origin directly).
  const cfRay = req.header("cf-ray");
  const cfCountry = req.header("cf-ipcountry");
  const requireCfProxy = Boolean(process.env.GEO_FENCE_REQUIRE_CF_PROXY);

  if (cfCountry) {
    if (requireCfProxy && !cfRay) {
      // CF-IPCountry is present but CF-Ray is absent → Cloudflare bypass detected.
      // Treat CF-IPCountry as untrusted and reject immediately.
      logger.warn(
        "[GeoFence] CF-IPCountry present but CF-Ray absent — possible Cloudflare bypass; " +
          "blocking request (GEO_FENCE_REQUIRE_CF_PROXY=1)",
      );
      return null; // Causes fail-closed block below.
    }
    // "XX" = Cloudflare unknown country, "T1" = Tor exit node → fall through.
    if (cfCountry !== "XX" && cfCountry !== "T1") {
      return cfCountry.toUpperCase();
    }
  } else if (requireCfProxy) {
    // No CF-IPCountry at all AND proxy enforcement is on → Cloudflare bypass.
    logger.warn(
      "[GeoFence] CF-IPCountry absent — Cloudflare bypass detected " +
        "(GEO_FENCE_REQUIRE_CF_PROXY=1); blocking request",
    );
    return null;
  }

  // ── Source 2: GCP App Engine / Cloud Run LB ──────────────────────────────
  const aeCountry = req.header("x-appengine-country");
  if (aeCountry && aeCountry !== "ZZ") {
    // "ZZ" = GCP unknown country.
    return aeCountry.toUpperCase();
  }

  // ── Source 3: X-Forwarded-For IP-lookup (GeoIP fallback) ────────────────
  const xff = req.header("x-forwarded-for");
  if (xff) {
    const clientIp = extractClientIpFromXff(xff);
    if (clientIp) {
      const country = geoipCountry(clientIp);
      if (country) {
        logger.info(`[GeoFence] XFF geo-lookup: ip=${clientIp} → country=${country}`);
        return country.toUpperCase();
      }
      // GeoIP failed for a public IP — fall through to req.ip check below.
    } else {
      // All XFF hops are private — internal probe traffic.
      logger.info("[GeoFence] XFF hops are all private — skipping geo-check (PRIVATE)");
      return "PRIVATE";
    }
  }

  // ── Fallback: req.ip (Express socket remote address) ─────────────────────
  const reqIp = req.ip ?? (req as any).socket?.remoteAddress;
  if (reqIp) {
    if (isPrivateIp(reqIp)) return "PRIVATE";
    const country = geoipCountry(reqIp);
    if (country) return country.toUpperCase();
  }

  return null; // Fail-closed.
}

// ── Path restriction check ────────────────────────────────────────────────────

function isRestricted(path: string): boolean {
  return RESTRICTED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Express middleware that enforces geo-fencing on restricted API routes.
 * Register BEFORE route handlers in server/index.ts (after CORS, after security
 * headers). See module-level comment for required Cloud Run ingress policy.
 *
 * Usage:
 *   import { geoFenceMiddleware } from "./middleware/geo-fence";
 *   app.use(geoFenceMiddleware);
 */
export function geoFenceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Allow test/dev bypass without source changes.
  if (process.env.GEO_FENCE_BYPASS) {
    next();
    return;
  }

  // Only inspect requests targeting a restricted route prefix.
  if (!isRestricted(req.path)) {
    next();
    return;
  }

  const allowedCountries = parseAllowedCountries();
  const countryCode = getCountryCode(req);

  // "PRIVATE" sentinel → internal health-check traffic, never geo-blocked.
  if (countryCode === "PRIVATE") {
    next();
    return;
  }

  if (countryCode && allowedCountries.has(countryCode)) {
    next();
    return;
  }

  const reason = countryCode
    ? `country "${countryCode}" not in allowed list (${[...allowedCountries].join(", ")})`
    : "country undetermined — failing closed";

  logger.warn(
    `[GeoFence] Blocked ${req.method} ${req.path} — ${reason} ` +
      `[ip=${req.ip ?? "unknown"}, cf-ray=${req.header("cf-ray") ?? "none"}]`,
  );

  res.status(403).json({
    error: "Access to this resource is restricted to the United States.",
    code: "GEO_RESTRICTED",
  });
}

function parseAllowedCountries(): Set<string> {
  const raw = process.env.GEO_ALLOWED_COUNTRIES ?? "US";
  return new Set(
    raw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
}

export { RESTRICTED_PATH_PREFIXES };
