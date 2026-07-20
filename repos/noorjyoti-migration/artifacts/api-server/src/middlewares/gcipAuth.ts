/**
 * GCIP (Google Cloud Identity Platform / Firebase Auth) — NoorJyoti backend.
 *
 * Portfolio auth standard: GCIP email/password, NO third-party login UI.
 * Replaces Clerk. The web client (and mobile) sign in with the Firebase web SDK
 * and send the resulting ID token as `Authorization: Bearer <idToken>`.
 *
 * `resolveGcipUser` runs app-wide and is NON-BLOCKING: it verifies the Bearer
 * token if present and sets req.gcipUid / req.gcipEmail, but never rejects — an
 * absent/invalid token simply means "anonymous", so the public catalog/player
 * keeps working. Per-route `requireAuth` (see requireAuth.ts) enforces sign-in
 * where needed; `requireAdmin` gates the /admin surface via an allowlist.
 *
 * Env: FIREBASE_PROJECT_ID (enables auth), ADMIN_EMAILS (admin allowlist),
 *      FIREBASE_SERVICE_ACCOUNT_JSON (base64 SA; optional — Cloud Run ADC by default).
 */

import type { Request, Response, NextFunction } from "express";
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import "./requireAuth"; // pulls in the Express.Request augmentation (gcipUid/gcipEmail)

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

/** App-wide, non-blocking: resolve a GCIP user from the Bearer ID token (if any). */
export async function resolveGcipUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token && gcipConfigured()) {
    try {
      ensureApp();
      const decoded = await getAuth().verifyIdToken(token);
      req.gcipUid = decoded.uid;
      req.gcipEmail = decoded.email;
    } catch {
      // Invalid/expired token → treat as anonymous. Never block the request.
    }
  }
  next();
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
