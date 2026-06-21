import type { Request, Response, NextFunction } from "express";

/**
 * Phase 1 launch posture: AI guidance features are NOT available in
 * regulated medical-AI jurisdictions (US, Canada, UK, France) until we
 * have the corresponding clearances (FDA, Health Canada, MHRA, ANSM).
 *
 * The block list is overridable via the AI_BLOCKED_COUNTRIES env var,
 * e.g. AI_BLOCKED_COUNTRIES="US,CA,GB,FR,AU".
 *
 * If req.country cannot be resolved we FAIL OPEN (allow), to avoid
 * blocking legitimate users whose CDN/proxy did not set a country
 * header. Tighten by setting AI_BLOCK_UNKNOWN=true once geo coverage
 * is fully verified in production.
 */

const DEFAULT_BLOCKED = ["US", "CA", "GB", "FR"];

function parseBlocked(): Set<string> {
  const raw = process.env.AI_BLOCKED_COUNTRIES;
  const list = (raw && raw.trim().length > 0 ? raw.split(",") : DEFAULT_BLOCKED)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length === 2);
  return new Set(list);
}

let cached: { set: Set<string>; raw: string | undefined } | null = null;
function getBlocked(): Set<string> {
  if (!cached || cached.raw !== process.env.AI_BLOCKED_COUNTRIES) {
    cached = { set: parseBlocked(), raw: process.env.AI_BLOCKED_COUNTRIES };
  }
  return cached.set;
}

const AI_PATH_RE = /^\/api\/ai[-/]/;

export function aiCountryGate() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!AI_PATH_RE.test(req.path)) return next();

    const blocked = getBlocked();
    if (blocked.size === 0) return next();

    const country = req.country;
    if (!country) {
      if (process.env.AI_BLOCK_UNKNOWN === "true") {
        return res.status(451).json({
          error: "AI_GUIDANCE_UNAVAILABLE_REGION",
          message:
            "AI guidance is not yet available in your region. We are working on bringing this feature to more countries.",
        });
      }
      return next();
    }

    if (blocked.has(country)) {
      return res.status(451).json({
        error: "AI_GUIDANCE_UNAVAILABLE_REGION",
        country,
        message:
          "AI guidance is not yet available in your country. We are working with local regulators to bring this feature to you soon.",
      });
    }

    next();
  };
}
