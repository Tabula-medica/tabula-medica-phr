import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler, Request } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { storage } from "../../storage";
import { verifyAndResolveGcip, verifyGcipToken } from "../../auth/gcip";

interface SessionUserClaims {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  provider?: string;
  exp?: number;
  [key: string]: unknown;
}

interface SessionUser {
  claims: SessionUserClaims;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

// HIPAA compliance: we have NO BAA with Auth0, so all Auth0 OIDC discovery,
// JWKS validation, and refresh-token machinery has been removed from the
// patient-reachable auth path. Authentication is now GCIP-only.

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[Auth] SESSION_SECRET must be set in production. Refusing to start with a fallback signing key.");
    }
    console.warn("[Auth] SESSION_SECRET is not set. Using insecure fallback secret for development only.");
  }
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "tabula-medica-fallback-secret-dev-only",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  };

  if (process.env.DATABASE_URL) {
    try {
      const pgStore = connectPg(session);
      const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
        errorLog: (err: Error) => {
          console.error("[SessionStore] PG session error:", err.message);
        },
      });
      sessionStore.on("error", (err: Error) => {
        console.error("[SessionStore] Connection error:", err.message);
      });
      sessionConfig.store = sessionStore;
      console.log("[SessionStore] Using PostgreSQL session store");
    } catch (err: any) {
      console.error("[SessionStore] Failed to init PG store, using memory:", err?.message);
    }
  } else {
    console.warn("[SessionStore] No DATABASE_URL, using in-memory session store");
  }

  return session(sessionConfig);
}

function parseDeviceInfo(userAgent: string): string {
  if (!userAgent) return "Unknown Device";
  
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("Android")) return "Android Device";
  if (userAgent.includes("Mac")) return "Mac";
  if (userAgent.includes("Windows")) return "Windows PC";
  if (userAgent.includes("Linux")) return "Linux";
  return "Web Browser";
}

interface AuthAttemptLog {
  timestamp: string;
  event: string;
  domain: string;
  ip: string;
  userAgent: string;
  sessionId: string;
  details: Record<string, any>;
}

const authAttemptLogs: AuthAttemptLog[] = [];
const MAX_AUTH_LOGS = 500;

function logAuthAttempt(event: string, req: Request, details: Record<string, any> = {}) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const domain = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.hostname;
  const entry: AuthAttemptLog = {
    timestamp: new Date().toISOString(),
    event,
    domain,
    ip,
    userAgent: (req.headers["user-agent"] || "unknown").substring(0, 200),
    sessionId: req.sessionID?.substring(0, 12) || "none",
    details,
  };
  authAttemptLogs.push(entry);
  if (authAttemptLogs.length > MAX_AUTH_LOGS) {
    authAttemptLogs.splice(0, authAttemptLogs.length - MAX_AUTH_LOGS);
  }
  console.log(`[Auth] ${event}`, JSON.stringify({ domain, ip, sessionId: entry.sessionId, ...details }));
}

export async function recordLoginAndNotify(
  userId: string,
  req: Request,
  opts?: { platform?: string; provider?: string; extraMetadata?: Record<string, any> }
): Promise<void> {
  try {
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || 
                      req.socket?.remoteAddress || 
                      "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const deviceInfo = parseDeviceInfo(userAgent);
    const platformTag = opts?.platform ? ` (${opts.platform})` : "";
    const extraMetadata = {
      ...(opts?.platform ? { platform: opts.platform } : {}),
      ...(opts?.provider ? { provider: opts.provider } : {}),
      ...(opts?.extraMetadata ?? {}),
    };
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const existingSessions = await storage.getUserSessions(userId);
    const existingSession = existingSessions.find(
      s => s.deviceInfo === deviceInfo && s.ipAddress === ipAddress
    );
    const isNewDevice = !existingSession;

    if (existingSession) {
      await storage.updateUserSession(existingSession.id, {
        lastActiveAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        userAgent,
      });
    } else {
      await storage.createUserSession({
        userId,
        deviceInfo,
        ipAddress,
        userAgent,
        expiresAt: expiresAt.toISOString(),
      });
    }

    await storage.createSecurityAuditLog({
      userId,
      eventType: isNewDevice ? "new_device_login" : "login",
      description: isNewDevice 
        ? `New device login from ${deviceInfo}${platformTag}` 
        : `Login from ${deviceInfo}${platformTag}`,
      ipAddress,
      userAgent,
      metadata: { deviceInfo, ...extraMetadata },
    });

    const settings = await storage.getSecuritySettings(userId);
    const shouldNotifyLogins = settings?.loginNotifications ?? true;
    const shouldNotifyNewDevice = settings?.newDeviceAlerts ?? true;

    if (isNewDevice && shouldNotifyNewDevice) {
      await storage.createSecurityNotification({
        userId,
        type: "new_device",
        title: "New Device Login",
        message: `A new login was detected from ${deviceInfo} at IP ${ipAddress}. If this wasn't you, please review your active sessions.`,
        severity: "warning",
        metadata: { deviceInfo, ipAddress, timestamp: now.toISOString() },
      });
    } else if (shouldNotifyLogins && isNewDevice) {
      await storage.createSecurityNotification({
        userId,
        type: "new_login",
        title: "New Login Detected",
        message: `You logged in from a new device (${deviceInfo}). If this wasn't you, please review your active sessions.`,
        severity: "info",
        metadata: { deviceInfo, ipAddress, timestamp: now.toISOString() },
      });
    }
  } catch (error) {
    console.error("Error recording login:", error);
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // HIPAA compliance: we have NO BAA with Auth0, so patients must never be
  // routed through Auth0's universal login. The previous Auth0 sign-in flow
  // is gone. Any legacy /api/login link (bookmarks, older client bundles,
  // mobile deep-links) is now redirected to the GCIP-backed in-app login
  // page so PHI never crosses an Auth0 endpoint.
  app.get("/api/login", (req, res) => {
    logAuthAttempt("LEGACY_AUTH0_LOGIN_REDIRECTED_TO_GCIP", req, {
      connection: req.query.connection || "default",
    });
    return res.redirect("/auth/login");
  });

  // Same compliance reason: the old /auth/callback handled Auth0's OIDC
  // redirect. It is removed entirely. Any stale callback URL (e.g. from an
  // Auth0 session still open in another tab) is bounced to the GCIP login
  // page rather than triggering a passport authenticate flow.
  app.get("/auth/callback", (req, res) => {
    logAuthAttempt("LEGACY_AUTH0_CALLBACK_REDIRECTED_TO_GCIP", req, {
      hasError: !!req.query.error,
      error: req.query.error || null,
    });
    return res.redirect("/auth/login");
  });

  // Exchange a verified GCIP ID token (sent as Authorization: Bearer) for an
  // Express session cookie. The web client calls this immediately after a
  // successful Firebase/GCIP popup so that subsequent cookie-based requests
  // (e.g. /api/auth/user) stay authenticated without having to attach a
  // bearer token to every fetch.
  app.post("/api/auth/gcip/session", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing bearer token" });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: "Missing bearer token" });
    }

    try {
      const claims = await verifyGcipToken(token);
      if (!claims) {
        logAuthAttempt("GCIP_SESSION_EXCHANGE_INVALID_TOKEN", req, {});
        return res.status(401).json({ message: "Invalid token" });
      }

      const internalUser = await verifyAndResolveGcip(token);
      if (!internalUser) {
        logAuthAttempt("GCIP_SESSION_EXCHANGE_NO_USER", req, {
          sub: claims.sub,
        });
        return res.status(401).json({ message: "Unable to resolve user" });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = typeof claims.exp === "number" ? claims.exp : nowSec + 3600;
      // Freshness claims: downstream reauth gates (e.g. family-hub
      // ssoReauth) read req.user.claims.auth_time / iat to decide whether
      // the session is recent enough for sensitive operations. GCIP
      // emits both in its ID token, but we deliberately re-stamp them
      // server-side so freshness is bound to the moment of this exchange.
      const iatSec = typeof (claims as any).iat === "number" ? (claims as any).iat : nowSec;
      const authTimeSec = typeof (claims as any).auth_time === "number" ? (claims as any).auth_time : nowSec;
      const sessionUser: SessionUser = {
        claims: {
          sub: internalUser.id,
          email: internalUser.email ?? undefined,
          first_name: internalUser.firstName ?? undefined,
          last_name: internalUser.lastName ?? undefined,
          profile_image_url: internalUser.profileImageUrl ?? undefined,
          provider: "gcip",
          iat: iatSec,
          auth_time: authTimeSec,
          exp: expiresAt,
        } as any,
        access_token: token,
        expires_at: expiresAt,
      };

      req.login(sessionUser, async (loginErr) => {
        if (loginErr) {
          logAuthAttempt("GCIP_SESSION_LOGIN_ERROR", req, { error: loginErr.message });
          return res.status(500).json({ message: "Failed to establish session" });
        }

        // Record the underlying sign-in provider (e.g. "apple.com",
        // "google.com", "password") so the audit log distinguishes Apple
        // sign-ins from Google sign-ins. App Store guideline 4.8 + ops
        // visibility both rely on this.
        const signInProvider =
          (claims.firebase?.sign_in_provider as string | undefined) ?? "unknown";
        logAuthAttempt("GCIP_SESSION_LOGIN_SUCCESS", req, {
          userId: internalUser.id,
          provider: signInProvider,
        });

        try {
          await recordLoginAndNotify(internalUser.id, req);
        } catch (err: any) {
          console.error("[Auth] Error recording GCIP login:", err?.message);
        }

        // First-login language auto-detect: if the user has no explicit
        // preferredLanguage (or is still on the schema default "en") AND
        // their browser Accept-Language asks for a different supported
        // language, persist that preference so the next page load is in
        // their language.
        try {
          const { pickLanguageFromAcceptHeader } = await import("../../../shared/i18n");
          const detected = pickLanguageFromAcceptHeader(req.headers["accept-language"] as string | undefined);
          const current = (internalUser as any).preferredLanguage;
          if (detected && detected !== current && (!current || current === "en")) {
            await storage.updateUserPreferredLanguage(internalUser.id, detected);
          }
        } catch (err: any) {
          console.error("[Auth] Language auto-detect failed:", err?.message);
        }

        let needsOnboarding = false;
        try {
          const onboardingStatus = await storage.getOnboardingStatus(internalUser.id);
          needsOnboarding = !onboardingStatus?.hasCompletedOnboarding;
        } catch (err: any) {
          console.error("[Auth] Error checking onboarding after GCIP exchange:", err?.message);
        }

        logAuthAttempt("GCIP_SESSION_EXCHANGE_SUCCESS", req, { userId: internalUser.id });
        return res.json({
          success: true,
          userId: internalUser.id,
          needsOnboarding,
        });
      });
    } catch (err: any) {
      console.error("[Auth] GCIP session exchange error:", err?.message);
      return res.status(500).json({ message: "Session exchange failed" });
    }
  });

  // HIPAA compliance: no BAA with Auth0 — never round-trip the user
  // through Auth0's /v2/logout. Clear the local session/cookies and bounce
  // back to the home page. GCIP sign-out happens client-side in the
  // Firebase SDK before this is called.
  app.get("/api/logout", (req, res) => {
    const userId = (req.user as any)?.claims?.sub;
    logAuthAttempt("LOGOUT", req, { userId });
    req.logout(() => {
      // Also destroy the session record so any residual cookie can't be
      // re-used after sign-out.
      req.session?.destroy(() => {
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
      });
    });
  });

}

// HIPAA compliance: GCIP-only authentication. There is no Auth0 bearer
// validation or OIDC refresh path here. Authentication accepts:
//   1. An existing Express session cookie established by
//      POST /api/auth/gcip/session (the post-Firebase-popup exchange), or
//   2. A `Authorization: Bearer <GCIP ID token>` header, validated against
//      the GCIP project via verifyAndResolveGcip().
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Session cookie path: a valid passport session is sufficient. GCIP
  // ID tokens auto-refresh client-side; the server session has its own
  // TTL governed by express-session and the GCIP_SESSION_EXCHANGE flow.
  if (req.isAuthenticated() && user?.claims?.sub) {
    const exp = user?.expires_at;
    if (!exp || Math.floor(Date.now() / 1000) <= exp) {
      return next();
    }
    // Session-side token has expired. The client must re-exchange a fresh
    // GCIP ID token via POST /api/auth/gcip/session — no server-side
    // refresh path exists.
  }

  // Bearer-token path (mobile + bearer-style web calls): GCIP only.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const gcipUser = await verifyAndResolveGcip(token);
    if (gcipUser) {
      (req as any).user = {
        claims: {
          sub: gcipUser.id,
          email: gcipUser.email,
          first_name: gcipUser.firstName,
          last_name: gcipUser.lastName,
          provider: "gcip",
        },
        access_token: token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      console.log(`[Auth] verified provider=gcip user=${gcipUser.id}`);
      return next();
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};
