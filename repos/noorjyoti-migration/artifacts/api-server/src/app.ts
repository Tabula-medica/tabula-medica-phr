import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { resolveGcipUser } from "./middlewares/gcipAuth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop so req.ip reflects the real client address
// through Replit's ingress and any load balancer in front of the API.
// Anonymous quota uses dual-key enforcement: per-visitor HMAC-signed
// nj_anon cookie UUID as primary key, plus req.ip as a secondary
// churn-proof guardrail (set as req.anonIpKey) enforced in the synthesis
// route so cookie-farming attacks cannot bypass the IP-level cap.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// NoorJyoti owns these seven doorway domains; each routes to the same
// deployment and must be allowed to call the API.
const NOORJYOTI_DOMAINS = [
  "noorjyoti.com",
  "noorjyoti.app",
  "noorjyoti.world",
  "lumina-sacred.com",
  "or-sacred.com",
  "guangming-app.com",
  "imole-app.com",
] as const;

const allowedOrigins = new Set<string>(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);
for (const domain of NOORJYOTI_DOMAINS) {
  allowedOrigins.add(`https://${domain}`);
  allowedOrigins.add(`https://www.${domain}`);
}
const replitDomain = process.env.REPLIT_DEV_DOMAIN;
if (replitDomain) allowedOrigins.add(`https://${replitDomain}`);
const expoDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;
if (expoDomain) allowedOrigins.add(`https://${expoDomain}`);
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://localhost:8081");
}

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Same-origin / non-browser requests have no Origin header.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // In production, also auto-allow same-host first-party calls so the
      // deployed web client never gets blocked when CORS_ALLOWED_ORIGINS
      // hasn't been set explicitly. Cross-host origins still require the
      // explicit allowlist.
      try {
        const url = new URL(origin);
        const host = url.host;
        const hostname = url.hostname;
        if (host === process.env.REPLIT_DOMAIN) return cb(null, true);
        if (host === process.env.REPLIT_DEV_DOMAIN) return cb(null, true);
        if (host === process.env.REPLIT_EXPO_DEV_DOMAIN) return cb(null, true);
        if (process.env.NODE_ENV !== "production") {
          if (hostname === "localhost" || hostname === "127.0.0.1") {
            return cb(null, true);
          }
          if (hostname.endsWith(".replit.dev") || hostname.endsWith(".repl.co")) {
            return cb(null, true);
          }
        }
      } catch (err) {
        console.warn("[cors] failed to parse Origin header", origin, err);
      }
      return cb(new Error("Origin not allowed by CORS"), false);
    },
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// GCIP: resolve the signed-in user from the Bearer ID token (non-blocking).
// Optional — when FIREBASE_PROJECT_ID is unset it no-ops and the public app
// (catalog, tracks, SSR site) still works; only auth'd routes require sign-in.
app.use(resolveGcipUser);

app.use("/api", router);

// Centralised error handler. Without this, Express's default finalhandler logs
// only the top-level error's stack — which for drizzle is the opaque
// "Failed query: ..." wrapper — hiding the underlying Postgres cause (code +
// message). Surfacing err.cause makes DB/connection failures diagnosable in
// Cloud Logging while still returning a generic 500 to clients.
app.use(
  (
    err: Error & { cause?: { code?: string; message?: string; detail?: string } },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const cause = err?.cause;
    logger.error(
      {
        err_message: err?.message,
        cause_code: cause?.code,
        cause_message: cause?.message,
        cause_detail: cause?.detail,
      },
      "api request failed",
    );
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal Server Error" });
  },
);

export default app;
