import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AuditService, AuditAction } from "./audit-service";

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  res.setHeader("X-Frame-Options", "DENY");
  
  res.setHeader("X-XSS-Protection", "0");
  
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");
  
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${nonce}'; ` +
    `style-src 'self' 'nonce-${nonce}'; ` +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' " +
    "https://api.tabulamedica.health " +
    "https://tabulamedica.health " +
    "https://healthcare.googleapis.com " +
    "https://rxnav.nlm.nih.gov " +
    "https://clinicaltables.nlm.nih.gov " +
    "wss://api.tabulamedica.health; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests;"
  );

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  next();
}

export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${options.keyPrefix || ""}:${req.ip}`;
    const now = Date.now();

    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + options.windowMs };
      requests.set(key, record);
    }

    record.count++;

    res.setHeader("X-RateLimit-Limit", options.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, options.maxRequests - record.count).toString());
    res.setHeader("X-RateLimit-Reset", record.resetTime.toString());

    if (record.count > options.maxRequests) {
      AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, 
        `Rate limit exceeded for IP ${req.ip}`, "medium");

      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    if (requests.size > 10000) {
      const keysToDelete: string[] = [];
      requests.forEach((value, key) => {
        if (now > value.resetTime) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => requests.delete(key));
    }

    next();
  };
}

export function inputSanitizer(req: Request, res: Response, next: NextFunction): void {
  const decodeEntities = (str: string): string => {
    let decoded = str;
    let prev = "";
    const maxIterations = 10;
    let i = 0;
    while (decoded !== prev && i < maxIterations) {
      prev = decoded;
      decoded = decoded
        .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'");
      i++;
    }
    return decoded;
  };

  const stripTags = (str: string): string => {
    let result = decodeEntities(str);
    let prev = "";
    const maxIterations = 20;
    let i = 0;
    while (result !== prev && i < maxIterations) {
      prev = result;
      result = result
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, "")
        .replace(/<\/script\s*>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style\s*>/gi, "")
        .replace(/<\/style\s*>/gi, "")
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
        .replace(/<iframe\b[^>]*\/?>/gi, "")
        .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, "")
        .replace(/<embed\b[^>]*\/?>/gi, "")
        .replace(/<link\b[^>]*\/?>/gi, "")
        .replace(/<meta\b[^>]*\/?>/gi, "")
        .replace(/<base\b[^>]*\/?>/gi, "")
        .replace(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi, "")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, "")
        .replace(/<math\b[^>]*>[\s\S]*?<\/math\s*>/gi, "");
      i++;
    }
    result = result
      .replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, "")
      .replace(/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, "")
      .replace(/data\s*:\s*text\/html/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .replace(/expression\s*\(/gi, "")
      .replace(/url\s*\(\s*['"]?\s*javascript:/gi, "url(")
      .replace(/-moz-binding\s*:/gi, "");
    return result;
  };

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return stripTags(value);
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === "object" && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === "object") {
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === "string") {
        Object.defineProperty(req.query, key, {
          value: stripTags(val),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  }

  next();
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers["x-request-id"];
  const requestId = (Array.isArray(headerValue) ? headerValue[0] : headerValue) || crypto.randomUUID();
  
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
}

export function sessionTimeout(timeoutMs: number = 15 * 60 * 1000) {
  const sessions = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any)._authenticatedUserId as string;
    
    if (!userId) {
      next();
      return;
    }

    const now = Date.now();
    const lastActivity = sessions.get(userId);

    if (lastActivity && now - lastActivity > timeoutMs) {
      sessions.delete(userId);
      
      AuditService.securityEvent(req, AuditAction.SESSION_TIMEOUT, 
        `Session timeout for user ${userId}`, "low");

      res.status(401).json({
        error: "Session expired",
        code: "SESSION_TIMEOUT",
      });
      return;
    }

    sessions.set(userId, now);

    next();
  };
}

export function tlsEnforcement(req: Request, res: Response, next: NextFunction): void {
  const isSecure = req.secure || 
    req.headers["x-forwarded-proto"] === "https" ||
    process.env.NODE_ENV === "development";

  if (!isSecure) {
    AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      "Non-HTTPS request blocked", "medium");

    res.status(403).json({
      error: "HTTPS required",
      message: "All connections must use TLS 1.3 or higher (2026 compliance requirement)",
    });
    return;
  }

  next();
}

export function tlsVersionCheck(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "development") {
    next();
    return;
  }

  const protocol = (req.socket as any).getProtocol?.();

  if (protocol && (protocol === "TLSv1" || protocol === "TLSv1.1" || protocol === "TLSv1.2")) {
    AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      `TLS version ${protocol} rejected - TLS 1.3 required`, "high");

    res.status(403).json({
      error: "TLS 1.3 required",
      message: "All connections must use TLS 1.3 or higher (2026 compliance requirement)",
      code: "TLS_VERSION_INSUFFICIENT",
    });
    return;
  }

  next();
}

export function mfaEnforcement(config: {
  requiredForAdmin?: boolean;
  requiredForAll?: boolean;
  exemptPaths?: string[];
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.exemptPaths?.some(path => req.path.startsWith(path))) {
      next();
      return;
    }

    const isAdminRoute = req.path.startsWith("/api/portal") || req.path.startsWith("/api/admin");
    const mfaRequired = config.requiredForAll || (isAdminRoute && config.requiredForAdmin !== false);

    if (!mfaRequired) {
      next();
      return;
    }

    const mfaVerified = (req as any)._mfaVerifiedFromSession === true;

    if (!mfaVerified) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[MFA] Warning: MFA not verified for ${req.method} ${req.path} - allowing in development mode`);
        next();
        return;
      }

      AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        `MFA required but not verified for ${req.path}`, "high");

      res.status(403).json({
        error: "Multi-factor authentication required",
        code: "MFA_REQUIRED",
      });
      return;
    }

    next();
  };
}

export function phiAccessLogger(resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function(body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = req.method === "GET" 
          ? AuditAction.VIEW_PHI 
          : req.method === "POST" 
            ? AuditAction.CREATE_PHI 
            : req.method === "PUT" || req.method === "PATCH"
              ? AuditAction.UPDATE_PHI
              : req.method === "DELETE"
                ? AuditAction.DELETE_PHI
                : AuditAction.VIEW_PHI;

        const resourceId = typeof req.params.id === "string" ? req.params.id : undefined;
        AuditService.phiAccess(req, action, resourceType, resourceId);
      }

      return originalJson(body);
    };

    next();
  };
}

export function validateRequestBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === "GET" || req.method === "DELETE") {
      next();
      return;
    }

    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({
        error: "Invalid request body",
        code: "INVALID_BODY",
      });
      return;
    }

    const missing = requiredFields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      res.status(400).json({
        error: "Missing required fields",
        code: "MISSING_FIELDS",
        fields: missing,
      });
      return;
    }

    next();
  };
}

export function validateQueryParams(allowedParams: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const unknownParams = Object.keys(req.query).filter(
      key => !allowedParams.includes(key)
    );

    if (unknownParams.length > 0) {
      res.status(400).json({
        error: "Unknown query parameters",
        code: "UNKNOWN_PARAMS",
        params: unknownParams,
      });
      return;
    }

    next();
  };
}

export function sanitizeUserId(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers["x-user-id"];
  if (typeof userId === "string" && userId.length > 0) {
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        `Invalid user ID format attempted: ${userId.substring(0, 20)}`, "high");
      res.status(400).json({
        error: "Invalid user identifier",
        code: "INVALID_USER_ID",
      });
      return;
    }
  }
  next();
}

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|UNION)\b\s)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
  /('|")\s*(OR|AND)\s*('|"|\d)/i,
  /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\()/i,
  /(WAITFOR\s+DELAY|BENCHMARK\s*\()/i,
];

export function sqlInjectionGuard(req: Request, res: Response, next: NextFunction): void {
  const checkValue = (value: unknown, path: string): boolean => {
    if (typeof value === "string") {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
            `Potential SQL injection detected in ${path}`, "critical");
          return true;
        }
      }
    }
    if (Array.isArray(value)) {
      return value.some((v, i) => checkValue(v, `${path}[${i}]`));
    }
    if (typeof value === "object" && value !== null) {
      return Object.entries(value).some(([k, v]) => checkValue(v, `${path}.${k}`));
    }
    return false;
  };

  const paramsHasInjection = Object.entries(req.params).some(([k, v]) => checkValue(v, `params.${k}`));
  const queryHasInjection = Object.entries(req.query).some(([k, v]) => checkValue(v, `query.${k}`));
  const bodyHasInjection = req.body && typeof req.body === "object"
    ? Object.entries(req.body).some(([k, v]) => checkValue(v, `body.${k}`))
    : false;

  if (paramsHasInjection || queryHasInjection || bodyHasInjection) {
    res.status(400).json({ error: "Invalid request parameters", code: "INVALID_INPUT" });
    return;
  }

  next();
}

const PHI_PATTERNS_FOR_SCRUB = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "***-**-****" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL REDACTED]" },
];

export function errorResponseScrubber(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function(body: unknown) {
    if (res.statusCode >= 400 && typeof body === "object" && body !== null) {
      const scrubbed = JSON.parse(JSON.stringify(body));
      const scrubString = (obj: Record<string, unknown>) => {
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === "string") {
            let val = obj[key] as string;
            for (const { pattern, replacement } of PHI_PATTERNS_FOR_SCRUB) {
              val = val.replace(pattern, replacement);
            }
            val = val.replace(/password['":\s]*['"][^'"]+['"]/gi, 'password: "[REDACTED]"');
            val = val.replace(/api[_-]?key['":\s]*['"][^'"]+['"]/gi, 'api_key: "[REDACTED]"');
            val = val.replace(/token['":\s]*['"][^'"]+['"]/gi, 'token: "[REDACTED]"');
            val = val.replace(/secret['":\s]*['"][^'"]+['"]/gi, 'secret: "[REDACTED]"');
            obj[key] = val;
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            scrubString(obj[key] as Record<string, unknown>);
          }
        }
      };
      scrubString(scrubbed);
      return originalJson(scrubbed);
    }
    return originalJson(body);
  };

  next();
}

export function requestSizeLimiter(maxBodyBytes: number = 1048576) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxBodyBytes) {
      AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        `Oversized request body: ${contentLength} bytes (limit: ${maxBodyBytes})`, "medium");
      res.status(413).json({
        error: "Request payload too large",
        code: "PAYLOAD_TOO_LARGE",
        maxSize: `${Math.round(maxBodyBytes / 1024)}KB`,
      });
      return;
    }
    next();
  };
}

type AuthAttemptRecord = { failures: number; lastFailure: number; lockedUntil: number };
const authAttemptsByIpEmail = new Map<string, AuthAttemptRecord>();
const authAttemptsByAccount = new Map<string, AuthAttemptRecord>();
const AUTH_LOCKOUT_THRESHOLDS = [
  { failures: 5, lockoutMs: 60_000 },
  { failures: 10, lockoutMs: 300_000 },
  { failures: 15, lockoutMs: 900_000 },
  { failures: 25, lockoutMs: 3_600_000 },
];
const ACCOUNT_LOCKOUT_THRESHOLDS = [
  { failures: 10, lockoutMs: 300_000 },
  { failures: 20, lockoutMs: 900_000 },
  { failures: 30, lockoutMs: 3_600_000 },
];
const AUTH_ATTEMPT_WINDOW_MS = 3_600_000;

function checkAndGetLockout(store: Map<string, AuthAttemptRecord>, key: string, now: number): AuthAttemptRecord | undefined {
  let record = store.get(key);
  if (record && now - record.lastFailure > AUTH_ATTEMPT_WINDOW_MS) {
    store.delete(key);
    return undefined;
  }
  return record;
}

function applyThresholds(record: AuthAttemptRecord, thresholds: typeof AUTH_LOCKOUT_THRESHOLDS): void {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (record.failures >= thresholds[i].failures) {
      record.lockedUntil = Date.now() + thresholds[i].lockoutMs;
      break;
    }
  }
}

function pruneStore(store: Map<string, AuthAttemptRecord>, now: number): void {
  if (store.size > 50000) {
    const cutoff = now - AUTH_ATTEMPT_WINDOW_MS;
    for (const [k, v] of store) {
      if (v.lastFailure < cutoff) store.delete(k);
    }
  }
}

export function bruteForceProtection(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";

  const ipEmailKey = email ? `${ip}:${email}` : ip;
  const now = Date.now();

  const ipRecord = checkAndGetLockout(authAttemptsByIpEmail, ipEmailKey, now);
  const accountRecord = email ? checkAndGetLockout(authAttemptsByAccount, email, now) : undefined;

  const lockedRecord = (ipRecord && ipRecord.lockedUntil > now) ? ipRecord
    : (accountRecord && accountRecord.lockedUntil > now) ? accountRecord : null;

  if (lockedRecord) {
    const retryAfter = Math.ceil((lockedRecord.lockedUntil - now) / 1000);
    AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      `Brute-force lockout active (${lockedRecord.failures} failures)`, "critical");
    res.status(423).json({
      error: "Account temporarily locked due to too many failed attempts",
      retryAfter,
      code: "ACCOUNT_LOCKED",
    });
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = function(body: unknown) {
    if (res.statusCode === 401) {
      const ipRec = authAttemptsByIpEmail.get(ipEmailKey) || { failures: 0, lastFailure: 0, lockedUntil: 0 };
      ipRec.failures++;
      ipRec.lastFailure = Date.now();
      applyThresholds(ipRec, AUTH_LOCKOUT_THRESHOLDS);
      authAttemptsByIpEmail.set(ipEmailKey, ipRec);

      if (email) {
        const acctRec = authAttemptsByAccount.get(email) || { failures: 0, lastFailure: 0, lockedUntil: 0 };
        acctRec.failures++;
        acctRec.lastFailure = Date.now();
        applyThresholds(acctRec, ACCOUNT_LOCKOUT_THRESHOLDS);
        authAttemptsByAccount.set(email, acctRec);
      }

      const totalFailures = (authAttemptsByIpEmail.get(ipEmailKey)?.failures || 0);
      if (totalFailures >= 5) {
        AuditService.securityEvent(req, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
          `Auth failure #${totalFailures} from ${ip.substring(0, 20)}`, totalFailures >= 15 ? "critical" : "high");
      }
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      authAttemptsByIpEmail.delete(ipEmailKey);
      if (email) authAttemptsByAccount.delete(email);
    }
    return originalJson(body);
  };

  pruneStore(authAttemptsByIpEmail, now);
  pruneStore(authAttemptsByAccount, now);

  next();
}

export function requestFingerprint(req: Request, res: Response, next: NextFunction): void {
  const ua = req.headers["user-agent"] || "";
  const accept = req.headers["accept"] || "";
  const lang = req.headers["accept-language"] || "";
  const encoding = req.headers["accept-encoding"] || "";

  const raw = `${ua}|${accept}|${lang}|${encoding}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex").substring(0, 16);
  req.headers["x-device-fingerprint"] = hash;
  res.setHeader("X-Device-Fingerprint", hash);

  next();
}

export const SecurityMiddleware = {
  securityHeaders,
  rateLimiter,
  inputSanitizer,
  requestIdMiddleware,
  sessionTimeout,
  tlsEnforcement,
  tlsVersionCheck,
  mfaEnforcement,
  phiAccessLogger,
  validateRequestBody,
  validateQueryParams,
  sanitizeUserId,
  sqlInjectionGuard,
  errorResponseScrubber,
  requestSizeLimiter,
  bruteForceProtection,
  requestFingerprint,
};
