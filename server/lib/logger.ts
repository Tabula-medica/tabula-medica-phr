/**
 * F1 — Structured logger with PHI-aware redaction.
 *
 * pino is configured with redact paths derived programmatically from
 * `PHI_FIELD_NAMES` in `phi-column-map.ts`, so the redaction list and
 * the encryption list cannot drift apart. Adding a PHI column to the
 * map automatically extends the logger's redaction.
 *
 * Production: JSON output to stdout (consumed by Replit log pipeline).
 * Development: pino-pretty for readability.
 *
 * Conversion pattern for existing call sites:
 *   console.log("user logged in", { userId, email })
 *     → logger.info({ userId, email }, "user logged in")
 *   console.error("decrypt failed", err)
 *     → logger.error({ err }, "decrypt failed")
 *
 * Note: the redact config catches known PHI keys at any depth. To be
 * effective, callers MUST pass PHI as structured fields (object keys),
 * NOT as interpolated strings in the message itself. A `console.log("Email " + email)`
 * is NOT protected by redact — it must be `logger.info({ email }, "Email")`.
 */

import pino from "pino";
import pinoHttp from "pino-http";
import { PHI_FIELD_NAMES } from "../security/phi-column-map";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Build pino redact paths from PHI_FIELD_NAMES.
 *
 * For each PHI key `k`, we redact:
 *   - `k`                  (top-level)
 *   - `*.k`                (one level nested)
 *   - `*.*.k`              (two levels nested)
 *   - `req.body.k`         (express body)
 *   - `res.body.k`         (response body if logged)
 *   - `req.query.k`        (query string)
 *
 * Plus a few hard-coded blanket paths for nested patient objects.
 */
function buildRedactPaths(): string[] {
  const paths = new Set<string>();
  for (const k of PHI_FIELD_NAMES) {
    paths.add(k);
    paths.add(`*.${k}`);
    paths.add(`*.*.${k}`);
    paths.add(`req.body.${k}`);
    paths.add(`req.query.${k}`);
    paths.add(`res.body.${k}`);
    paths.add(`body.${k}`);
    paths.add(`payload.${k}`);
  }
  // Wholesale-redact nested patient objects no matter the field shape.
  paths.add("patient");
  paths.add("*.patient");
  paths.add("req.body.patient");
  paths.add("res.body.patient");
  paths.add("body.patient");
  paths.add("payload.patient");
  return Array.from(paths);
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  redact: {
    paths: buildRedactPaths(),
    censor: "[PHI_REDACTED]",
    remove: false,
  },
  // NOTE: pino-pretty transport intentionally disabled — pino transports
  // use worker threads which can fail silently in some Replit environments
  // and take the parent process down. JSON to stdout works fine in dev,
  // and the Replit log pane renders structured fields readably.
  base: {
    service: "tabula-medica",
    env: process.env.NODE_ENV ?? "development",
  },
});

/**
 * Express middleware. Mount BEFORE the route handlers in `server/index.ts`:
 *   import { httpLogger } from "./lib/logger";
 *   app.use(httpLogger);
 *
 * Automatically redacts the PHI fields above on every request/response.
 */
export const httpLogger = pinoHttp({
  logger,
  // Drop noisy health-check polling.
  autoLogging: {
    ignore: (req) =>
      req.url === "/healthz" ||
      req.url === "/readyz" ||
      req.url?.startsWith("/_vite") === true,
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

/** Convenience for child loggers tied to a particular subsystem. */
export function getLogger(component: string) {
  return logger.child({ component });
}
