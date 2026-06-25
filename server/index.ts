if (process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}

import { writeFileSync } from "fs";
const gcpKeyJson = process.env.GCP_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (gcpKeyJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const parsed = JSON.parse(gcpKeyJson);
    if (parsed.type === "service_account" && parsed.project_id && parsed.private_key) {
      const credPath = "/tmp/gcp-credentials.json";
      writeFileSync(credPath, gcpKeyJson);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
      console.log("[GCP] Credentials written to", credPath, `(project: ${parsed.project_id})`);
    } else {
      console.error("[GCP] GCP_SERVICE_ACCOUNT_KEY is valid JSON but not a service account key (missing type/project_id/private_key). Skipping.");
    }
  } catch (e: any) {
    console.error("[GCP] GCP_SERVICE_ACCOUNT_KEY is not valid JSON — cannot use as credentials:", e?.message?.slice(0, 80));
  }
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerMobileApiRoutes } from "./mobile-api-routes";
import { adminVhostMiddleware, vhostDiag } from "./middleware/admin-vhost";

import { serveStatic, markApiRoutesReady } from "./static";
import { createServer as createHttpServer, type Server } from "http";
import { startSyncScheduler } from "./sync-scheduler";
import { seedFacilities } from "./seed-facilities";
import { 
  securityHeaders, 
  phiRouteProtection,
  sessionTimeoutMiddleware,
  phiAccessAuditMiddleware,
  getAuditCompliance,
  logger as phiLogger,
  getComplianceStatus,
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
  applyAuthRateLimiting,
  productionErrorHandler,
  startSessionCleanupScheduler,
  csrfProtection,
  atsSecurityHeaders,
  gcpAuditMiddleware,
  complianceSecurityHeaders,
  getGcpAuditStatus,
} from "./security";
import { logPhiKeyFingerprints } from "./security/phi-encryption";
import { 
  requestCorrelationMiddleware, 
  createLogger,
  getRequestId 
} from "./security/production-logger";
import { unifiedComplianceMiddleware, complianceStatusEndpoint } from "./security/compliance-middleware";

const app = express();

if (process.env.ENABLE_ECW_CHECK === 'false' || process.env.USE_TEFCA === 'true') {
  console.log("TEFCA Mode Active: Skipping eCW Firewall Check.");
}

app.get("/", (req, res) => res.status(200).send("HEALTHY"));

const isProduction = process.env.NODE_ENV === "production";


const DEDICATED_HEALTH_PATHS = new Set(["/", "/health", "/api/health", "/_ah/health", "/_ah/start"]);

let dbHealthy = true;
let lastDbCheck = 0;
const DB_CHECK_INTERVAL_MS = 15000;

const DB_HEALTH_TIMEOUT_MS = 4000;

async function checkDbHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastDbCheck < DB_CHECK_INTERVAL_MS) return dbHealthy;
  lastDbCheck = now;
  try {
    const { pool } = await import("./db");
    // Race the connect+query against a hard timeout so a stuck DB never hangs
    // the Cloud Run startup/liveness probe (which previously caused
    // "Startup probes timed out" on revision tabula-medica-web-00142-ssr).
    const probe = (async () => {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    })();
    const timeout = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error(`DB health probe timed out after ${DB_HEALTH_TIMEOUT_MS}ms`)), DB_HEALTH_TIMEOUT_MS),
    );
    dbHealthy = await Promise.race([probe, timeout]);
  } catch (err: any) {
    dbHealthy = false;
    if (err?.message) console.warn("[Health] DB probe failed:", err.message);
  }
  return dbHealthy;
}

function handleRawHealthCheck(req: import("http").IncomingMessage, res: import("http").ServerResponse): boolean {
  const urlPath = (req.url || "/").split("?")[0];
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const isDedicatedHealthPath = DEDICATED_HEALTH_PATHS.has(urlPath);

  if (urlPath === "/") {
    res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": "7", "Cache-Control": "no-cache, no-store" });
    req.method !== "HEAD" ? res.end("HEALTHY") : res.end();
    return true;
  }

  if (isDedicatedHealthPath) {
    checkDbHealth().then((healthy) => {
      const status = healthy ? "ok" : "degraded";
      const statusCode = healthy ? 200 : 503;
      const body = JSON.stringify({ status, database: healthy ? "connected" : "disconnected", timestamp: new Date().toISOString() });
      res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
        "Cache-Control": "no-cache, no-store",
      });
      req.method !== "HEAD" ? res.end(body) : res.end();
    }).catch(() => {
      const body = JSON.stringify({ status: "error", timestamp: new Date().toISOString() });
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
        "Cache-Control": "no-cache, no-store",
      });
      res.end(body);
    });
    return true;
  }
  return false;
}

const httpServer = createHttpServer((req, res) => {
  if (handleRawHealthCheck(req, res)) return;
  app(req, res);
});



declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.get(["/health", "/api/health", "/_ah/health", "/_ah/start"], async (_req, res) => {
  const healthy = await checkDbHealth();
  const status = healthy ? "ok" : "degraded";
  res.status(healthy ? 200 : 503).json({ status, database: healthy ? "connected" : "disconnected", timestamp: new Date().toISOString() });
});

import compression from "compression";
app.use(compression());

app.use(requestCorrelationMiddleware);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(atsSecurityHeaders);
app.use(complianceSecurityHeaders);
app.use(phiRouteProtection);
app.use(gcpAuditMiddleware);

// Resolve request country (Cloudflare CF-IPCountry) into req.country, then
// gate AI guidance routes by jurisdiction (US/CA/GB/FR blocked by default;
// override via AI_BLOCKED_COUNTRIES env var).
import { geoCountryMiddleware } from "./middleware/geo-country";
import { aiCountryGate } from "./middleware/ai-country-gate";
import { hostEditionMiddleware, worldGeofenceMiddleware } from "./middleware/host-edition";
app.use(geoCountryMiddleware());
app.use(aiCountryGate());
// Host-based .us/.world edition split (sets req.edition + req.tefcaAllowed) and the
// .world EU/EEA geofence (GDPR deferred). Runs after geoCountryMiddleware so the
// geofence can read req.country. TEFCA routing only — live connections stay gated.
app.use(hostEditionMiddleware());
app.use(worldGeofenceMiddleware());

// H12 — vhost split (admin.tabulamedica.health vs tabulamedica.health).
// Disabled by default; enable with ADMIN_HOST_SPLIT=enabled + ADMIN_HOST=...
app.use(adminVhostMiddleware());
app.get("/api/_admin-vhost/health", (req, res) => res.json(vhostDiag(req)));

app.use(apiRateLimiter);
applyAuthRateLimiting(app);

app.use(unifiedComplianceMiddleware());

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "10mb";
const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || "10mb";

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: URLENCODED_BODY_LIMIT }));

app.use(csrfProtection);

app.use((err: Error & { type?: string; status?: number }, req: Request, res: Response, next: NextFunction) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "PAYLOAD_TOO_LARGE",
      message: "Request body exceeds size limit. Maximum allowed: " + JSON_BODY_LIMIT,
      requestId: getRequestId(req),
    });
  }
  next(err);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}


const httpLogger = createLogger("HTTP");

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const logEntry = {
        timestamp: new Date().toISOString(),
        request_id: getRequestId(req),
        method: req.method,
        path: path,
        status: res.statusCode,
        duration_ms: duration,
        actor_id: user?.claims?.sub,
      };
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
});

phiLogger.info("Security compliance status", getComplianceStatus());
phiLogger.info("HIPAA audit compliance", getAuditCompliance());
logPhiKeyFingerprints();

async function initializeApp() {
  // Serve static SPA FIRST so the frontend works even if later startup steps
  // log warnings about missing optional config.
  if (isProduction) {
    try {
      serveStatic(app);
      log("Static files ready", "Startup");
    } catch (err) {
      console.error("[Startup] Failed to serve static files:", err instanceof Error ? err.message : err);
    }
  }

  const routesDone = registerRoutes(httpServer, app)
    .then(async () => {
      try { registerMobileApiRoutes(app); } catch (e) {}
      try { const { registerMultimodalRoutes } = await import("./multimodal-routes"); registerMultimodalRoutes(app); } catch (e) {}
      try { const { registerRecordLinkageRoutes } = await import("./record-linkage-routes"); registerRecordLinkageRoutes(app); } catch (e) {}
      try { const { registerMonitoringRoutes } = await import("./monitoring-routes"); registerMonitoringRoutes(app); } catch (e) {}
      app.get("/api/compliance-status", complianceStatusEndpoint);
      try { const { registerSeoRoutes } = await import("./seo/routes"); registerSeoRoutes(app); } catch (e) { console.error("[Startup] SEO routes failed:", e instanceof Error ? e.message : e); }
      app.use(productionErrorHandler);
      markApiRoutesReady();
      log("All API routes registered", "Startup");
    })
    .catch((err) => {
      console.error("[Startup] Route registration failed:", err instanceof Error ? err.message : err);
      app.use(productionErrorHandler);
      markApiRoutesReady();
    });

  await routesDone;

  if (!isProduction) {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  setImmediate(async () => {
    try { seedFacilities().catch(() => {}); }
    catch {}

    try { startSyncScheduler(); }
    catch {}

    try { startSessionCleanupScheduler(); }
    catch {}

    try {
      const { startMinorTransitionScheduler } = await import("./services/minor-transition-scheduler");
      startMinorTransitionScheduler();
    } catch (e) {
      console.error("[Startup] MinorTransition scheduler failed:", e);
    }

    try {
      const { seedAdminUser } = await import("./seed-admin");
      seedAdminUser().catch(() => {});
    } catch {}
  });
}

(async () => {
  const PORT = process.env.PORT || 8080;

  app.get("/healthz", (_req, res) => res.status(200).type("text/plain").send("ok"));

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running and listening on port ${PORT}`);

    // Kick off GCP secret loading in parallel with app initialization.
    // Routes that need a secret read it lazily via process.env at request time,
    // so registering routes early is safe — secrets fill in when they arrive.
    const SECRET_LOAD_TIMEOUT_MS = 15000;
    const secretsPromise = (async () => {
      try {
        const { loadSecretsFromGCP } = await import("./services/gcp-secret-manager");
        await Promise.race([
          loadSecretsFromGCP(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`loadSecretsFromGCP timed out after ${SECRET_LOAD_TIMEOUT_MS}ms`)), SECRET_LOAD_TIMEOUT_MS)
          ),
        ]);
        console.log("[GCP-SecretManager] Secrets loaded");
      } catch (err: any) {
        console.log("[GCP-SecretManager] Skipped or timed out:", err?.message || "not configured");
      }
    })();

    initializeApp()
      .then(() => log("Application initialized (API routes loading in background)"))
      .catch((err) =>
        console.error("[Startup] Application initialization error:", err instanceof Error ? err.message : err)
      );

    // Fire-and-forget; logged inside the IIFE above.
    void secretsPromise;
  });

  async function gracefulShutdown(signal: string) {
    console.log(`[Shutdown] ${signal} received — starting graceful shutdown...`);
    httpServer.close(() => {
      console.log("[Shutdown] HTTP server closed");
    });
    try {
      const { pool } = await import("./db");
      await pool.end();
      console.log("[Shutdown] Database pool drained");
    } catch (err: any) {
      console.error("[Shutdown] Error draining pool:", err.message);
    }
    setTimeout(() => {
      console.error("[Shutdown] Forceful exit after timeout");
      process.exit(1);
    }, 15000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
