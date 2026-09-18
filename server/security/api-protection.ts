import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { validateCorsOrigin } from "./cors-config";
import { getRequestId } from "./production-logger";
import { logSecurityEvent } from "./gcp-audit-logger";

/**
 * Shared 429 handler: emits a PHI-free security event (fanned out to Cloud
 * Logging + SIEM) before answering. CrowdStrike 2026: credential stuffing
 * and vishing-driven takeover attempts show up first as bursts against the
 * session-exchange and recovery endpoints — those bursts must be visible to
 * the SOC, not just silently throttled.
 */
function rateLimitHandler(limiterName: string) {
  return (req: Request, res: Response, _next: NextFunction, options: { message: unknown; statusCode: number }) => {
    void logSecurityEvent({
      eventType: "auth_rate_limited",
      actor: (req.user as any)?.claims?.sub || "anonymous",
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
      riskLevel: "medium",
      details: {
        requestId: getRequestId(req),
        limiter: limiterName,
        path: req.path,
        method: req.method,
        userAgent: (req.headers["user-agent"] || "unknown").toString().slice(0, 120),
      },
    });
    res.status(options.statusCode).json(options.message);
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "AUTH_RATE_LIMITED",
    message: "Too many authentication attempts. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: rateLimitHandler("auth"),
  skip: (req) => {
    return req.method === "OPTIONS";
  },
});

/**
 * Token → session exchange endpoints (web + mobile). More generous than
 * `authRateLimiter` because a legitimate household or clinic NAT can share
 * one IP, but tight enough that a replayed/stolen-token spray is throttled
 * and surfaced as a security event.
 */
export const sessionExchangeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: {
    error: "AUTH_RATE_LIMITED",
    message: "Too many sign-in attempts from this network. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: rateLimitHandler("session_exchange"),
  skip: (req) => req.method === "OPTIONS",
});

export const mfaRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    error: "MFA_RATE_LIMITED",
    message: "Too many MFA attempts. Please wait before trying again.",
    retryAfter: "5 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: rateLimitHandler("mfa"),
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: "RESET_RATE_LIMITED",
    message: "Too many password reset requests. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: rateLimitHandler("password_reset"),
});

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: {
    error: "API_RATE_LIMITED",
    message: "Too many requests. Please slow down.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skip: (req) => {
    return !req.path.startsWith("/api");
  },
});

const isProduction = process.env.NODE_ENV === "production";

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction
        ? ["'self'", "https://cdn.fastenhealth.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.fastenhealth.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.fastenhealth.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "https:", "https://*.fastenhealth.com"],
      frameSrc: ["'self'", "https://*.fastenhealth.com", "https://fastenhealth.com"],
      frameAncestors: isProduction 
        ? ["'self'", "*.tabulamedica.health", "tabulamedica.health"]
        : ["'self'", "*.replit.dev", "*.replit.app", "*.repl.co", "*.tabulamedica.health", "tabulamedica.health"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
});

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  
  if (origin && validateCorsOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-Requested-With, X-CSRF-Token");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining");
  }
  
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  
  next();
}

export function productionErrorHandler(err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const requestId = getRequestId(req);
  
  const errorCodes: Record<string, string> = {
    "ValidationError": "VALIDATION_ERROR",
    "UnauthorizedError": "UNAUTHORIZED",
    "ForbiddenError": "FORBIDDEN",
    "NotFoundError": "NOT_FOUND",
    "ConflictError": "CONFLICT",
    "RateLimitError": "RATE_LIMITED",
  };
  
  const errorCode = errorCodes[err.name] || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    request_id: requestId,
    level: "error",
    error_code: errorCode,
    status: status,
    path: req.path,
    method: req.method,
  }));
  
  const safeMessage = status >= 500 
    ? "An internal error occurred. Please try again later."
    : err.message || "Request failed";
  
  res.status(status).json({
    error: errorCode,
    message: safeMessage,
    requestId: requestId,
  });
}

export function applyAuthRateLimiting(app: { use: (path: string, handler: RequestHandler) => unknown }) {
  app.use("/api/auth/reset-password", passwordResetRateLimiter);
  app.use("/api/auth/forgot-password", passwordResetRateLimiter);
  // Identity-first hardening: every endpoint that turns a bearer token into
  // a session (or links an external identity) is a takeover chokepoint.
  app.use("/api/auth/gcip/session", sessionExchangeRateLimiter);
  app.use("/api/mobile/auth/gcip/session", sessionExchangeRateLimiter);
  app.use("/api/auth/fasten/verify", sessionExchangeRateLimiter);
}
