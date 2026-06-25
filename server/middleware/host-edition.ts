import type { Request, Response, NextFunction } from "express";

/**
 * Host-based edition split for the one PHR codebase:
 *   tabulamedica.us     -> "us"     : US networks (TEFCA/Carequality/CommonWell/Blue Button) ALLOWED
 *   tabulamedica.world  -> "world"  : global, NO US networks, EU/EEA geofenced (GDPR deferred)
 *   tabulamedica.health / anything  -> "default" : legacy/alias; falls back to user preference
 *
 * This sets req.edition + req.tefcaAllowed. It is ROUTING/CONFIG only — actual live
 * TEFCA connections remain separately gated on counsel + participation agreements.
 */

export type Edition = "us" | "world" | "default";

declare global {
  namespace Express {
    interface Request {
      edition?: Edition;
      tefcaAllowed?: boolean;
    }
  }
}

function hostOf(req: Request): string {
  const xfh = req.headers["x-forwarded-host"];
  const raw = (Array.isArray(xfh) ? xfh[0] : xfh) || (req.headers.host as string) || "";
  return raw.split(",")[0].trim().split(":")[0].toLowerCase();
}

export function editionFromHost(host: string): Edition {
  if (host === "tabulamedica.us" || host.endsWith(".tabulamedica.us")) return "us";
  if (host === "tabulamedica.world" || host.endsWith(".tabulamedica.world")) return "world";
  return "default";
}

export function hostEditionMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const edition = editionFromHost(hostOf(req));
    req.edition = edition;
    req.tefcaAllowed = edition === "us"; // US edition only
    next();
  };
}

// EU-27 + EEA (IS, LI, NO) + UK (UK-GDPR) + CH (FADP). Defer these markets.
const GEOFENCED = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO", "GB", "CH",
]);

/**
 * Blocks the .world edition for EU/EEA/UK/CH visitors (GDPR/UK-GDPR deferred).
 *
 * Relies on req.country from geoCountryMiddleware (CF-IPCountry / X-Country-Code /
 * DEV_COUNTRY_CODE). IMPORTANT: in the current grey-cloud (DNS-only) setup, Cloudflare
 * is NOT in the path, so CF-IPCountry is absent and country is "unknown" → this
 * FAILS OPEN unless WORLD_GEOFENCE_STRICT=true. For a reliable production EU block,
 * populate the country signal via Google Cloud Armor (LB geo-policy) or Cloudflare
 * proxy mode. See deploy/GEOFENCE.md.
 */
export function worldGeofenceMiddleware() {
  const strict = process.env.WORLD_GEOFENCE_STRICT === "true";
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.edition !== "world") return next();

    const country = req.country;
    if (country && GEOFENCED.has(country)) {
      return res.status(451).json({
        error: "not_available_in_region",
        message: "Tabula Medica is not yet available in your region.",
      });
    }
    // Country unknown: fail-closed only if explicitly configured (needs a reliable
    // geo signal first), else fail-open so we don't block the whole world.
    if (!country && strict) {
      return res.status(451).json({
        error: "region_unverified",
        message: "Region could not be verified.",
      });
    }
    next();
  };
}
