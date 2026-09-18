/**
 * CSRF Protection Middleware
 * 
 * Implements defense-in-depth CSRF protection:
 * 1. SameSite=Lax cookies (configured in session)
 * 2. Origin/Referer header validation
 * 3. Custom header requirement (X-Requested-With)
 * 
 * This protects state-changing endpoints (POST, PUT, PATCH, DELETE)
 * from cross-site request forgery attacks.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { redactPath } from "./redact-path";

// Allowed origins for the application
function getAllowedOrigins(req: Request): string[] {
  const host = req.get("host") || "";
  return [
    `https://${host}`,
    `http://${host}`, // Allow http for local development
    // Replit preview domains
    host,
  ].filter(Boolean);
}

/**
 * Validates that the request origin matches the expected host
 */
function isValidOrigin(req: Request): boolean {
  const origin = req.get("origin");
  const referer = req.get("referer");
  const host = req.get("host");
  
  // If no origin or referer, this might be a same-origin request
  // (some browsers don't send Origin for same-origin)
  if (!origin && !referer) {
    // Allow if it looks like a same-origin request
    // This is safe because SameSite=Lax prevents cross-origin cookie sending
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins(req);
  
  // Check Origin header
  if (origin) {
    if (allowedOrigins.some(allowed => origin === allowed || origin.includes(host || ""))) {
      return true;
    }
  }
  
  // Check Referer header as fallback
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (allowedOrigins.some(allowed => refererOrigin === allowed || refererOrigin.includes(host || ""))) {
        return true;
      }
    } catch {
      // Invalid referer URL
    }
  }
  
  return false;
}

/**
 * Checks for custom header that JavaScript must set
 * This prevents simple CSRF because forms can't set custom headers
 */
function hasCustomHeader(req: Request): boolean {
  // X-Requested-With is commonly used for AJAX requests
  // Forms and simple cross-origin requests can't set this
  const xRequestedWith = req.get("X-Requested-With");
  const contentType = req.get("Content-Type");
  
  // Allow if X-Requested-With is present (AJAX request)
  if (xRequestedWith) {
    return true;
  }
  
  // Allow JSON content type (can't be sent by simple forms)
  if (contentType && contentType.includes("application/json")) {
    return true;
  }
  
  return false;
}

/**
 * CSRF protection middleware for state-changing endpoints
 * 
 * Applies to: POST, PUT, PATCH, DELETE
 * Skips: GET, HEAD, OPTIONS (safe methods)
 */
export const csrfProtection: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Safe methods don't need CSRF protection
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for OAuth callbacks (they have their own state protection)
  if (req.path === "/api/callback" || req.path === "/auth/callback" || req.path === "/api/login") {
    return next();
  }
  
  // Skip for webhook endpoints that use signature verification
  if (req.path.startsWith("/api/webhooks/") || req.path.startsWith("/webhooks/")) {
    return next();
  }
  
  // Validate origin
  if (!isValidOrigin(req)) {
    console.warn(`[CSRF] Origin validation failed for ${req.method} ${redactPath(req.path)}`, {
      origin: req.get("origin"),
      referer: req.get("referer"),
      host: req.get("host"),
    });
    return res.status(403).json({
      error: "Forbidden",
      code: "CSRF_ORIGIN_MISMATCH",
      message: "Cross-origin request blocked",
    });
  }
  
  // Require custom header for non-form requests
  if (!hasCustomHeader(req)) {
    // Check if it's a form submission (multipart or urlencoded)
    const contentType = req.get("Content-Type") || "";
    const isFormSubmission = contentType.includes("multipart/form-data") || 
                              contentType.includes("application/x-www-form-urlencoded");
    
    if (!isFormSubmission) {
      console.warn(`[CSRF] Missing custom header for ${req.method} ${redactPath(req.path)}`);
      return res.status(403).json({
        error: "Forbidden", 
        code: "CSRF_HEADER_MISSING",
        message: "Request must include Content-Type: application/json or X-Requested-With header",
      });
    }
    // Form submissions are allowed if origin check passed
    // (SameSite=Lax + origin validation provides protection)
  }
  
  next();
};

/**
 * Middleware to ensure session is regenerated on privilege escalation
 * Call this after successful login for non-OIDC flows
 */
export const regenerateSession: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.session) {
    const oldSession = { ...req.session };
    req.session.regenerate((err) => {
      if (err) {
        console.error("[Session] Failed to regenerate session:", err);
        return next(err);
      }
      // Restore session data to new session
      Object.assign(req.session, oldSession);
      next();
    });
  } else {
    next();
  }
};

export default csrfProtection;
