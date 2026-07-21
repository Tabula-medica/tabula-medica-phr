/**
 * GCIP (Google Cloud Identity Platform / Firebase Auth) — NoorJyoti backend.
 *
 * Portfolio auth standard: GCIP email/password, NO third-party login vendors.
 * Replaces Clerk entirely.
 *
 * Transport = a first-party httpOnly SESSION COOKIE (not a Clerk/third-party
 * cookie, not a bearer header), so the existing cookie-based api-client keeps
 * working unchanged: the web client signs in with the Firebase web SDK, POSTs
 * the fresh ID token to /api/auth/session, and this module mints an httpOnly
 * `nj_session` cookie via firebase-admin. `resolveGcipUser` verifies that cookie
 * on every request (non-blocking) and sets req.gcipUid / req.gcipEmail.
 *
 * Env: FIREBASE_PROJECT_ID (enables auth), ADMIN_EMAILS (admin allowlist),
 *      FIREBASE_SERVICE_ACCOUNT_JSON (base64 SA; optional — Cloud Run ADC by default).
 */

import type { Request, Response, NextFunction } from "express";
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import "./requireAuth"; // pulls in the Express.Request augmentation (gcipUid/gcipEmail)

export const SESSION_COOKIE = "nj_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function gcipConfigured(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID);
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

let _initialized = false;
function ensureApp(): void {
  if (_initialized || getApps().length) {
    _initialized = true;
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const credentials = JSON.parse(Buffer.from(saJson, "base64").toString("utf-8"));
    initializeApp({ credential: cert(credentials), projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  _initialized = true;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    if (part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return undefined;
}

/**
 * App-wide, non-blocking: resolve a GCIP user from either
 *   • an `Authorization: Bearer <ID token>` header (mobile — the api-client
 *     attaches it via setAuthTokenGetter), OR
 *   • the httpOnly `nj_session` cookie (web).
 * Absent/invalid → anonymous; never blocks.
 */
export async function resolveGcipUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!gcipConfigured()) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  try {
    ensureApp();
    if (bearer) {
      const decoded = await getAuth().verifyIdToken(bearer, true);
      req.gcipUid = decoded.uid;
      req.gcipEmail = decoded.email;
    } else {
      const cookie = readCookie(req, SESSION_COOKIE);
      if (cookie) {
        const decoded = await getAuth().verifySessionCookie(cookie, true);
        req.gcipUid = decoded.uid;
        req.gcipEmail = decoded.email;
      }
    }
  } catch {
    // Invalid/expired/revoked credential → treat as anonymous.
  }
  next();
}

/** Exchange a fresh Firebase ID token for a signed session-cookie value. */
export async function createSession(idToken: string): Promise<{ cookie: string; maxAgeMs: number }> {
  ensureApp();
  // Verify (rejects revoked/invalid) before minting the session cookie.
  await getAuth().verifyIdToken(idToken, true);
  const cookie = await getAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  return { cookie, maxAgeMs: SESSION_MAX_AGE_MS };
}

export function sessionCookieHeader(value: string, maxAgeMs: number): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Admin gate: require a verified GCIP user on the ADMIN_EMAILS allowlist. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!gcipConfigured()) {
    res.status(503).json({ error: "Admin is not configured" });
    return;
  }
  if (!req.gcipUid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const allow = adminEmails();
  const email = (req.gcipEmail ?? "").toLowerCase();
  if (allow.length > 0 && !allow.includes(email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
