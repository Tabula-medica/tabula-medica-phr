import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      country?: string;
      countrySource?: "cf" | "header" | "env" | "unknown";
    }
  }
}

function readHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

/**
 * Resolves the request's country into req.country (ISO-3166-1 alpha-2, uppercase).
 *
 * Sources, in priority order:
 *   1. CF-IPCountry header (Cloudflare edge, free)
 *   2. X-Country-Code header (custom upstream proxies / testing)
 *   3. DEV_COUNTRY_CODE env var (dev/local override)
 *
 * Leaves req.country undefined if nothing is resolvable; downstream gates
 * MUST decide their own fail-open vs fail-closed policy.
 */
export function geoCountryMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const cf = readHeader(req, "cf-ipcountry");
    if (cf && cf.length === 2) {
      req.country = cf.toUpperCase();
      req.countrySource = "cf";
      return next();
    }

    const custom = readHeader(req, "x-country-code");
    if (custom && custom.length === 2) {
      req.country = custom.toUpperCase();
      req.countrySource = "header";
      return next();
    }

    const devOverride = process.env.DEV_COUNTRY_CODE;
    if (devOverride && devOverride.length === 2 && process.env.NODE_ENV !== "production") {
      req.country = devOverride.toUpperCase();
      req.countrySource = "env";
      return next();
    }

    req.countrySource = "unknown";
    next();
  };
}
