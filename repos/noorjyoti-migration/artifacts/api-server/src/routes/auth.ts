import { Router, type IRouter } from "express";
import {
  createSession,
  sessionCookieHeader,
  clearSessionCookieHeader,
  gcipConfigured,
} from "../middlewares/gcipAuth";

const router: IRouter = Router();

/**
 * Exchange a fresh Firebase (GCIP) ID token for a first-party httpOnly session
 * cookie. The web client calls this once after email/password sign-in; every
 * subsequent api call is authenticated by the cookie (credentials: "include").
 */
router.post("/session", async (req, res) => {
  if (!gcipConfigured()) {
    res.status(503).json({ error: "Auth is not configured" });
    return;
  }
  const idToken = (req.body?.idToken ?? "") as unknown;
  if (typeof idToken !== "string" || !idToken) {
    res.status(400).json({ error: "idToken required" });
    return;
  }
  try {
    const { cookie, maxAgeMs } = await createSession(idToken);
    res.setHeader("Set-Cookie", sessionCookieHeader(cookie, maxAgeMs));
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

/** Clear the session cookie (sign out). */
router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.json({ ok: true });
});

export default router;
