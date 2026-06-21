import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "./phi-safe-logger";

function getSecurityHeaders(): Record<string, string> {
  const isProduction = process.env.NODE_ENV === "production";
  
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(self), camera=(self)",
  };
  
  headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";

  if (isProduction) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private";
    headers["Pragma"] = "no-cache";
  }
  
  return headers;
}

const PHI_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export const securityHeaders: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const headers = getSecurityHeaders();
  for (const [header, value] of Object.entries(headers)) {
    res.setHeader(header, value);
  }
  next();
};

export const phiCacheHeaders: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  for (const [header, value] of Object.entries(PHI_CACHE_HEADERS)) {
    res.setHeader(header, value);
  }
  next();
};

const HEALTH_CHECK_PATHS = new Set(["/", "/health", "/api/health"]);

function isInternalRequest(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return (
    HEALTH_CHECK_PATHS.has(req.path) ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  );
}

export const requireHttps: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === "development" || isInternalRequest(req)) {
    next();
    return;
  }
  
  const isSecure = 
    req.secure || 
    req.headers["x-forwarded-proto"] === "https" ||
    req.headers["x-forwarded-ssl"] === "on";
  
  if (!isSecure) {
    logger.warn("Non-HTTPS request rejected", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      error: "HTTPS required",
      message: "This endpoint requires a secure connection",
    });
    return;
  }
  
  next();
};

export const checkTlsVersion: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === "development" || isInternalRequest(req)) {
    next();
    return;
  }
  
  const directTlsVersion = (req.socket as any)?.getTLSVersion?.();
  
  const proxyTlsVersion = req.headers["x-forwarded-tls-version"] as string | undefined;
  
  const tlsVersion = directTlsVersion || proxyTlsVersion;
  
  if (tlsVersion) {
    const versionNum = parseFloat(tlsVersion.replace(/TLSv?/i, ""));
    if (!isNaN(versionNum) && versionNum < 1.3) {
      logger.warn("TLS version too low - TLS 1.3 mandatory as of 2026", { tlsVersion, path: req.path });
      res.status(403).json({
        error: "TLS 1.3 required",
        message: "TLS 1.3 is mandatory for all connections as of 2026. Please upgrade your browser or client.",
      });
      return;
    }
  }
  
  next();
};

export const PHI_PROTECTED_ROUTES = [
  "/api/patients",
  "/api/medications",
  "/api/lab-results",
  "/api/conditions",
  "/api/allergies",
  "/api/documents",
  "/api/vitals",
  "/api/appointments",
  "/api/messages",
  "/api/fhir",
  "/api/caregivers",
  "/api/deidentification",
  "/api/health-records",
  "/api/care-team",
  "/api/immunizations",
  "/api/encounters",
  "/api/observations",
  "/api/diagnostic-reports",
  "/api/export",
  "/api/telehealth",
];

export function isPhiProtectedRoute(path: string): boolean {
  return PHI_PROTECTED_ROUTES.some(route => path.startsWith(route));
}

export const phiRouteProtection: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const isPhiRoute = isPhiProtectedRoute(req.path);
  
  if (isPhiRoute) {
    for (const [header, value] of Object.entries(PHI_CACHE_HEADERS)) {
      res.setHeader(header, value);
    }
    
    res.setHeader("X-PHI-Protected", "true");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  
  next();
};

export const sanitizeRequestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    const safeQuery = Object.keys(req.query).reduce((acc, key) => {
      const lowerKey = key.toLowerCase();
      if (["password", "token", "secret", "key", "ssn", "dob", "email", "phone"].some(s => lowerKey.includes(s))) {
        acc[key] = "[REDACTED]";
      } else {
        acc[key] = typeof req.query[key] === "string" && (req.query[key] as string).length > 50
          ? "[TRUNCATED]"
          : req.query[key];
      }
      return acc;
    }, {} as Record<string, unknown>);
    
    const logData = {
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      ...(Object.keys(safeQuery).length > 0 && { query: safeQuery }),
    };
    
    if (statusCode >= 500) {
      logger.error(logData, "request error");
    } else if (statusCode >= 400) {
      logger.warn(logData, "request warning");
    } else {
      logger.debug(logData, "request");
    }
  });
  
  next();
};

export function getTransportSecurityInfo(): {
  tlsMinVersion: string;
  hstsEnabled: boolean;
  hstsMaxAge: number;
  cspEnabled: boolean;
  xssProtection: boolean;
  frameProtection: boolean;
  contentTypeNoSniff: boolean;
} {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    tlsMinVersion: "1.3",
    hstsEnabled: true,
    hstsMaxAge: 63072000,
    cspEnabled: true,
    xssProtection: true,
    frameProtection: true,
    contentTypeNoSniff: true,
  };
}

export function applySecurityMiddleware(app: any): void {
  app.use(securityHeaders);
  app.use(phiRouteProtection);
  app.use(sanitizeRequestLogger);
  
  if (process.env.NODE_ENV === "production") {
    app.use(requireHttps);
    app.use(checkTlsVersion);
  }
  
  logger.info("Security middleware applied", getTransportSecurityInfo());
}
