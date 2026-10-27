// Side-effect import: runs assertEnvPolicy() at boot. If a forbidden non-BAA
// AI env var (AI_INTEGRATIONS_OPENAI_*, etc.) is present in production, the
// process refuses to start. Must be imported before anything else that may
// touch AI code paths. See server/ai-client.ts FORBIDDEN_ENV_VARS.
import "./ai-client";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerSeoRoutes } from "./routes/seo-routes";
import { isWebHost as isWebHostFn, WEB_HOSTS } from "./web-host-routing";
import { registerPortalRoutes } from "./portal-routes";
import { geoFenceMiddleware } from "./middleware/geo-fence";
import * as fs from "fs";
import * as path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { SecurityMiddleware } from "./compliance/security-middleware";
import compression from "compression";
import { spawn, type ChildProcess } from "child_process";

if (!process.env.NODE_ENV) {
  console.error(
    "[SECURITY] NODE_ENV is not set. Reviewer credential bypass is active when NODE_ENV is not 'production'. " +
    "Set NODE_ENV=production for all production/deployment contexts."
  );
}

const app = express();
app.use(compression());
import { logger } from "./utils/logger";
const log = (...args: unknown[]) => logger.info(args.map(String).join(" "));
const isDev = process.env.NODE_ENV === "development";

let metroProcess: ChildProcess | null = null;

function spawnMetroBundler() {
  if (!isDev) return;
  if (process.env.SKIP_METRO === "true") return;

  const domain = process.env.REPLIT_DEV_DOMAIN || "localhost";

  const env = {
    ...process.env,
    EXPO_PACKAGER_PROXY_URL: `https://${domain}`,
    REACT_NATIVE_PACKAGER_HOSTNAME: domain,
    EXPO_PUBLIC_DOMAIN: `${domain}:5000`,
  };

  log("[Metro] Spawning Expo Metro bundler on port 8081...");

  metroProcess = spawn("npx", ["expo", "start", "--localhost", "--no-dev", "--port", "8081"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  metroProcess.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[Metro] ${line}`);
  });

  metroProcess.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes("ExperimentalWarning")) {
      console.error(`[Metro] ${line}`);
    }
  });

  metroProcess.on("exit", (code) => {
    log(`[Metro] Process exited with code ${code}`);
    metroProcess = null;
  });

  process.on("SIGTERM", () => {
    if (metroProcess) {
      log("[Metro] Shutting down Metro bundler...");
      metroProcess.kill("SIGTERM");
    }
    process.exit(0);
  });

  process.on("SIGINT", () => {
    if (metroProcess) {
      metroProcess.kill("SIGTERM");
    }
    process.exit(0);
  });
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:5000`);
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:8081`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
        origins.add(`https://${d.trim()}:5000`);
        origins.add(`https://${d.trim()}:8081`);
      });
    }

    origins.add("https://api.tabulamedica.health");
    origins.add("https://tabulamedica.health");
    origins.add("https://www.tabulamedica.health");
    origins.add("https://tabulamedica.com");
    origins.add("https://app.tabulamedica.health");
    origins.add("https://portal.tabulamedica.health");
    origins.add("https://tabula-medica-web-verion.replit.app");
    origins.add("https://tabula-medica-mobile-1060107259776.us-east4.run.app");
    origins.add("https://tabula-medica-web-1060107259776.us-central1.run.app");

    origins.add("https://uninsurance.care");
    origins.add("https://www.uninsurance.care");
    origins.add("https://app.uninsurance.care");

    if (process.env.UNINSURANCE_ORIGIN) {
      process.env.UNINSURANCE_ORIGIN.split(",").forEach((o: string) => {
        origins.add(o.trim());
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    const isExpoGo = !origin && isDev && (
      req.header("user-agent")?.includes("Expo") ||
      req.header("expo-platform") !== undefined
    );

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, x-user-id, Authorization, x-mfa-verified, x-request-id");
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (isExpoGo) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, x-user-id, Authorization, x-mfa-verified, x-request-id");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;
      // Task #68 dual-validation observability: tag every authenticated API
      // request with the validating auth provider so we can graph the
      // Auth0 → GCIP cutover ramp. requireAuth sets req._authProvider and a
      // shadow x-auth-provider response header. Anonymous endpoints (login,
      // landing, webhooks) have no provider and log as "anon".
      const provider =
        (req as any)._authProvider ||
        (res.getHeader("x-auth-provider") as string | undefined) ||
        "anon";
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms [authProvider=${provider}]`;
      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  // Dynamically rewrite URLs based on the current host
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG && `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  const host = forwardedHost || replitDomain || req.get("host") || "";
  const baseUrl = `${protocol}://${host}`;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // Extract timestamp from the launchAsset URL
  const launchUrl = manifest.launchAsset?.url || "";
  const timestampMatch = launchUrl.match(/\/(\d+-\d+)\/_expo/);
  const timestamp = timestampMatch ? timestampMatch[1] : "";

  // Rewrite launchAsset URL
  if (manifest.launchAsset?.url && timestamp) {
    manifest.launchAsset.url = `${baseUrl}/${timestamp}/_expo/static/js/${platform}/bundle.js`;
  }

  // Rewrite asset URLs
  if (manifest.assets && Array.isArray(manifest.assets)) {
    manifest.assets = manifest.assets.map((asset: { url?: string; hash?: string }) => {
      if (asset.url && timestamp) {
        const pathMatch = asset.url.match(/\/\d+-\d+\/(.+)$/);
        if (pathMatch) {
          asset.url = `${baseUrl}/${timestamp}/${pathMatch[1]}`;
        }
      }
      return asset;
    });
  }

  // Rewrite expoClient and expoGo URLs
  if (manifest.extra?.expoClient) {
    manifest.extra.expoClient.hostUri = `${host}/${platform}`;
  }
  if (manifest.extra?.expoGo) {
    manifest.extra.expoGo.debuggerHost = `${host}/${platform}`;
  }

  // Fix splash image URL
  if (manifest.extra?.expoClient?.splash?.imageUrl) {
    const splashPath = manifest.extra.expoClient.splash.image;
    if (splashPath) {
      const cleanPath = splashPath.replace(/^\.\//, '/');
      manifest.extra.expoClient.splash.imageUrl = `${baseUrl}/${timestamp}/_expo/static/js${cleanPath}`;
    }
  }

  // Fix icon URL
  if (manifest.extra?.expoClient?.iconUrl) {
    const iconPath = manifest.extra.expoClient.icon;
    if (iconPath) {
      const cleanPath = iconPath.replace(/^\.\//, '/');
      manifest.extra.expoClient.iconUrl = `${baseUrl}/${timestamp}/_expo/static/js${cleanPath}`;
    }
  }

  // Fix adaptive icon URLs for Android
  if (platform === "android" && manifest.extra?.expoClient?.android?.adaptiveIcon) {
    const ai = manifest.extra.expoClient.android.adaptiveIcon;
    for (const key of ['foregroundImageUrl', 'backgroundImageUrl', 'monochromeImageUrl']) {
      if (ai[key]) {
        const srcKey = key.replace('Url', '').replace('Image', 'Image');
        const srcPath = ai[srcKey.replace('Url', '')] || ai[key];
        if (typeof srcPath === 'string' && srcPath.startsWith('./')) {
          ai[key] = `${baseUrl}/${timestamp}/_expo/static/js${srcPath.replace(/^\.\//, '/')}`;
        }
      }
    }
  }

  log(`Serving ${platform} manifest with baseUrl: ${baseUrl}`);
  res.send(JSON.stringify(manifest));
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG && `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  const host = forwardedHost || replitDomain || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  
  const privacyPolicyPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "privacy-policy.html",
  );
  const privacyPolicyTemplate = fs.readFileSync(privacyPolicyPath, "utf-8");
  
  const appName = getAppName();

  const portalTemplatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "portal.html",
  );
  const portalTemplate = fs.readFileSync(portalTemplatePath, "utf-8");

  // Serve public media assets (tutorial video, etc.)
  app.use(
    "/media",
    express.static(path.resolve(process.cwd(), "server", "public", "media"), {
      maxAge: "7d",
      immutable: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=604800");
      },
    }),
  );

  app.get("/api/og-image", (_req: Request, res: Response) => {
    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0F172A"/>
          <stop offset="50%" style="stop-color:#1E293B"/>
          <stop offset="100%" style="stop-color:#0F172A"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#0284C7"/>
          <stop offset="100%" style="stop-color:#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect x="80" y="280" width="120" height="4" rx="2" fill="url(#accent)"/>
      <text x="80" y="260" font-family="Inter,-apple-system,sans-serif" font-size="64" font-weight="800" fill="#FFFFFF">Tabula Medica</text>
      <text x="80" y="340" font-family="Inter,-apple-system,sans-serif" font-size="28" fill="rgba(255,255,255,0.7)">Your Complete Health Record, One Secure Place</text>
      <text x="80" y="400" font-family="Inter,-apple-system,sans-serif" font-size="18" fill="rgba(255,255,255,0.5)">HIPAA Compliant  |  Zero-Knowledge Encryption  |  50,000+ Provider Connections</text>
      <circle cx="1060" cy="180" r="60" fill="url(#accent)" opacity="0.15"/>
      <circle cx="1000" cy="120" r="30" fill="url(#accent)" opacity="0.1"/>
      <rect x="80" y="560" width="1040" height="1" fill="rgba(255,255,255,0.1)"/>
      <text x="80" y="595" font-family="Inter,-apple-system,sans-serif" font-size="14" fill="rgba(255,255,255,0.4)">tabulamedica.com  |  tabulamedica.health</text>
    </svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(svg);
  });

  // Serve privacy policy page
  app.get(["/privacy", "/privacy.html"], (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(privacyPolicyTemplate);
  });

  // NOTE: /robots.txt, /sitemap.xml, and /llms.txt are served by
  // registerSeoRoutes() (called inside registerRoutes) which generates
  // dynamic content including all geo pages, hreflang, and priority tuning.
  // Do NOT add static handlers for these paths here — they would shadow the
  // dynamic routes because configureExpoAndLanding runs before registerRoutes.

  // Serve provider portal — intentionally non-indexable (authenticated PHI surface).
  // The HTML <meta name="robots"> noindex is the primary signal; the response-header
  // X-Robots-Tag below is a belt-and-braces directive that also covers crawlers that
  // don't parse the document body.
  app.get("/portal", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    res.status(200).send(portalTemplate);
  });

  log("Serving static Expo files with dynamic manifest routing");

  // In development, proxy non-API requests to Metro bundler
  if (isDev) {
    log("Development mode: Proxying frontend requests to Metro (port 8081)");
    
    // Proxy Metro bundler requests
    const metroProxy = createProxyMiddleware({
      target: "http://localhost:8081",
      changeOrigin: true,
      ws: true,
      logger: console,
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.removeHeader("origin");
        },
        error: (err, req, res) => {
          log("Proxy error:", err.message);
        }
      }
    });

    const staticBuildPath = path.resolve(process.cwd(), "static-build");
    const assetsPath = path.resolve(process.cwd(), "assets");

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        log(`[Proxy] API request detected: ${req.method} ${req.path} - passing to API routes`);
        return next();
      }

      if (req.path.startsWith("/webhooks")) {
        log(`[Proxy] Webhook request detected: ${req.method} ${req.path} - passing to webhook handler`);
        return next();
      }

      if (req.path === "/portal" || req.path === "/privacy" || req.path === "/privacy.html") {
        return next();
      }

      if (req.path.startsWith("/assets/")) {
        const filePath = path.join(assetsPath, req.path.replace("/assets/", ""));
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
      
      log(`[Proxy] Non-API request: ${req.method} ${req.path} - proxying to Metro`);
      return metroProxy(req, res, next);
    });
  } else {
    // Production mode: serve static files from dist/
    const distPath = path.resolve(process.cwd(), "dist");
    const webDistPath = path.resolve(process.cwd(), "dist", "web");

    // Host-based routing. See server/web-host-routing.ts for the host/path
    // matrix (unit-tested in server/__tests__/web-host-routing.test.ts).
    const isWebHost = (req: Request): boolean => isWebHostFn(req.hostname);

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        return next();
      }

      // Web subdomains never serve the Expo manifest — they're the Vite SPA.
      if (isWebHost(req)) {
        return next();
      }

      if (req.path === "/manifest" || req.path === "/") {
        const platform = req.header("expo-platform");
        if (platform && (platform === "ios" || platform === "android")) {
          return serveExpoManifest(platform, req, res);
        }
      }

      next();
    });

    app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));

    app.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
      const filePath = path.resolve(process.cwd(), "server/well-known/assetlinks.json");
      if (fs.existsSync(filePath)) return res.type("json").sendFile(filePath);
      res.status(404).end();
    });
    app.get("/.well-known/apple-app-site-association", (_req: Request, res: Response) => {
      const filePath = path.resolve(process.cwd(), "server/well-known/apple-app-site-association");
      if (fs.existsSync(filePath)) return res.type("json").sendFile(filePath);
      res.status(404).end();
    });

    // Web SPA static + history-API fallback for the web subdomains only.
    // This must come BEFORE the Expo `dist/` static middleware so requests
    // from web hosts can't accidentally fall through to mobile assets.
    const webDistPresent = fs.existsSync(webDistPath);
    if (!webDistPresent) {
      // Fail LOUD, not silent — silently serving the Expo bundle on web
      // subdomains would ship the wrong app to web users. Web hosts get an
      // explicit 503 until `npm run build:web` is run; mobile/API hosts are
      // unaffected.
      log(
        `[Web SPA] WARNING: dist/web/ not found at boot. Run 'npm run build:web' ` +
          `before deploy. Requests to ${[...WEB_HOSTS].join(", ")} will return 503.`,
      );
    }
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!isWebHost(req)) return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
        return next();
      }
      // SEO crawl paths must always be served by the dynamic registerSeoRoutes
      // handlers (registered before this middleware).  Pass through so static
      // files in dist/web/ cannot shadow the authoritative dynamic content.
      if (
        req.path === "/sitemap.xml" ||
        req.path === "/robots.txt" ||
        req.path === "/llms.txt"
      ) {
        return next();
      }
      if (!webDistPresent) {
        return res.status(503).json({
          error: "Web frontend bundle not deployed",
          code: "WEB_BUNDLE_MISSING",
        });
      }
      return express.static(webDistPath)(req, res, next);
    });
    // Auth/OAuth callback paths must never appear in search indexes or LLM
    // training caches — they carry transient tokens and serve empty app shells.
    // Belt-and-braces: the X-Robots-Tag header covers crawlers that don't
    // parse the HTML body; a <meta name="robots"> noindex inside the SPA also
    // applies at the document level.
    const AUTH_CALLBACK_PATHS = [
      "/callback",
      "/auth/callback",
      "/ehr-callback",
      "/smart/callback",
      "/fhir/callback",
      "/oauth/callback",
      "/oidc/callback",
    ];
    const isAuthCallbackPath = (p: string): boolean =>
      AUTH_CALLBACK_PATHS.some((cb) => p === cb || p.startsWith(cb + "?") || p.startsWith(cb + "/"));

    app.get("/{*path}", (req: Request, res: Response, next: NextFunction) => {
      if (!isWebHost(req)) return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
        return next();
      }
      if (!webDistPresent) {
        return res.status(503).json({
          error: "Web frontend bundle not deployed",
          code: "WEB_BUNDLE_MISSING",
        });
      }
      if (isAuthCallbackPath(req.path)) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
      const indexPath = path.join(webDistPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });

    app.use(express.static(distPath));

    app.get("/{*path}", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
        return next();
      }
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      type?: string;
    };

    const status = error.status || error.statusCode || 500;

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Request payload too large", code: "PAYLOAD_TOO_LARGE" });
    }

    const safeMessage = status >= 500
      ? "An internal error occurred. Please try again later."
      : error.message || "Request could not be processed";

    return res.status(status).json({ error: safeMessage });
  });
}

function setupSecurityMiddleware(app: express.Application) {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });

  app.use(SecurityMiddleware.requestIdMiddleware);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });

  app.use("/api/", SecurityMiddleware.securityHeaders);
  app.use("/api/", SecurityMiddleware.inputSanitizer);
  app.use("/api/", SecurityMiddleware.sanitizeUserId);
  app.use("/api/", SecurityMiddleware.sqlInjectionGuard);
  app.use("/api/", SecurityMiddleware.errorResponseScrubber);
  app.use("/api/", SecurityMiddleware.requestSizeLimiter(1048576));
  app.use("/api/", SecurityMiddleware.tlsEnforcement);

  app.use("/api/", SecurityMiddleware.sessionTimeout(15 * 60 * 1000));

  app.use("/api/", SecurityMiddleware.mfaEnforcement({
    requiredForAdmin: true,
    requiredForAll: false,
    exemptPaths: ["/api/auth", "/api/health", "/api/uscdi", "/api/security"],
  }));

  app.use("/api/", SecurityMiddleware.rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: "api",
  }));

  app.use("/api/", SecurityMiddleware.requestFingerprint);

  app.use("/api/auth/login", SecurityMiddleware.bruteForceProtection);
  app.use("/api/portal/auth/login", SecurityMiddleware.bruteForceProtection);

  app.use("/api/auth/", SecurityMiddleware.rateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 15,
    keyPrefix: "auth",
  }));

  app.use("/api/portal/auth/", SecurityMiddleware.rateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: "portal-auth",
  }));

  app.use("/api/ai-assistant/", SecurityMiddleware.rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: "ai",
  }));

  app.use("/api/document-generation/", SecurityMiddleware.rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "docgen",
  }));

  app.use("/api/safety-analysis/", SecurityMiddleware.rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 15,
    keyPrefix: "safety",
  }));

  app.use("/api/health-records", SecurityMiddleware.phiAccessLogger("health_record"));
  app.use("/api/medications", SecurityMiddleware.phiAccessLogger("medication"));
  app.use("/api/patient-profile", SecurityMiddleware.phiAccessLogger("patient_profile"));
  app.use("/api/intake", SecurityMiddleware.phiAccessLogger("intake_form"));
  app.use("/api/phr", SecurityMiddleware.phiAccessLogger("phr_consolidated"));
  app.use("/api/fhir", SecurityMiddleware.phiAccessLogger("fhir_resource"));
  app.use("/api/smart-health-card", SecurityMiddleware.phiAccessLogger("smart_health_card"));
  app.use("/api/share-links", SecurityMiddleware.phiAccessLogger("share_link"));
  app.use("/api/records", SecurityMiddleware.phiAccessLogger("health_record"));
  app.use("/api/attachments", SecurityMiddleware.phiAccessLogger("record_attachment"));
  app.use("/api/ai-assistant", SecurityMiddleware.phiAccessLogger("ai_conversation"));
  app.use("/api/medication-reminders", SecurityMiddleware.phiAccessLogger("medication_reminder"));
  app.use("/api/care-summary", SecurityMiddleware.phiAccessLogger("care_summary"));
  app.use("/api/dental-records", SecurityMiddleware.phiAccessLogger("dental_record"));
  app.use("/api/telehealth", SecurityMiddleware.phiAccessLogger("telehealth_visit"));
  app.use("/api/document-generation", SecurityMiddleware.phiAccessLogger("document_generation"));
  app.use("/api/safety-analysis", SecurityMiddleware.phiAccessLogger("safety_analysis"));
  app.use("/api/clinical-linker", SecurityMiddleware.phiAccessLogger("clinical_data_link"));
  app.use("/api/doc-assistant", SecurityMiddleware.phiAccessLogger("clinical_documentation"));
  app.use("/api/clinical-workflow", SecurityMiddleware.phiAccessLogger("clinical_workflow"));
  app.use("/api/chart-intelligence", SecurityMiddleware.phiAccessLogger("chart_intelligence"));
  app.use("/api/provider-workflow", SecurityMiddleware.phiAccessLogger("provider_workflow"));
  app.use("/api/wearable", SecurityMiddleware.phiAccessLogger("wearable_data"));
  app.use("/api/immunizations", SecurityMiddleware.phiAccessLogger("immunization"));
  app.use("/api/family-history", SecurityMiddleware.phiAccessLogger("family_history"));
}

(async () => {
  // Fail-fast crypto guard (audit M-2). Force PHI encryption-key derivation
  // at boot in production so a missing PHI_ENCRYPTION_SALT or PHI_ENCRYPTION_KEY
  // crashes the container immediately rather than at first encrypt/decrypt.
  if (process.env.NODE_ENV === "production") {
    try {
      const { EncryptionService } = await import("./compliance/encryption-service");
      // Round-trip a sentinel to force getEncryptionKey() to run all guards.
      EncryptionService.decrypt(EncryptionService.encrypt("startup-check"));
    } catch (err: any) {
      console.error(`[Startup] PHI encryption guard failed: ${err?.message ?? err}`);
      process.exit(1);
    }
  }

  setupCors(app);
  setupBodyParsing(app);
  setupSecurityMiddleware(app);
  setupRequestLogging(app);

  // SEO routes MUST be registered before configureExpoAndLanding so that
  // express.static(dist/web) cannot shadow /sitemap.xml, /robots.txt, /llms.txt
  // with a stale pre-built file.  The first matching route wins in Express.
  registerSeoRoutes(app);

  configureExpoAndLanding(app);

  // Geo-fence: restrict FHIR / TEFCA / Fasten routes to US-based IPs.
  // Reads CF-IPCountry (Cloudflare) → X-AppEngine-Country (GCP) → X-Country-Code.
  // Non-US requests to /api/fhir-data-hub, /api/tefca, /api/fasten receive 403 GEO_RESTRICTED.
  // Override via GEO_ALLOWED_COUNTRIES (CSV) or GEO_FENCE_BYPASS (dev/test only).
  app.use(geoFenceMiddleware);

  registerPortalRoutes(app);

  const { registerWebCompatAliases } = await import("./routes/web-compat-aliases");
  registerWebCompatAliases(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`express server serving on port ${port}`);

      spawnMetroBundler();

      // Task #71 — Auth0 healthcare-hardening startup log was removed along
      // with the Auth0 user-login retirement. The post-cutover identity
      // provider for user login is GCIP (BAA-covered).

      // Task #68 / #104 — apply additive auth migrations (external_identities,
      // payer_token_connections, plus the Auth0 column/row drop). Idempotent; failures
      // are logged but do not block startup.
      try {
        const { runIdempotentMigrations } = await import("./auth/run-migrations");
        await runIdempotentMigrations();
      } catch (err) {
        console.warn("[boot] migration runner failed:", err);
      }

      // --------------------------------------------------------------
      // Deferred enterprise-service initialization (audit finding C-1).
      // Each init runs in its own try/catch so a single slow or failing
      // integration (Vertex, Particle Health, Redox, Epic, etc.) cannot
      // block the container from staying up. Previously these ran inside
      // registerRoutes() before server.listen() and caused the 3-day outage.
      // --------------------------------------------------------------
      // `critical: true` => failure in production crashes the process so the
      // orchestrator restarts it. This preserves the audit's "fail loudly"
      // intent for security controls (auth, PHI audit, MFA) even though
      // init now runs after listen(). Non-critical services degrade silently.
      type DeferredInit = { name: string; critical: boolean; run: () => Promise<unknown> };
      const deferredInits: DeferredInit[] = [
        { name: "PayerTokenRetry", critical: false, run: async () => (await import("./payer-token-retry-service")).startPayerTokenRetryScheduler() },
        { name: "ParticleHealth",          critical: false, run: async () => (await import("./particle-health-service")).initializeParticleHealth() },
        { name: "Redox",                   critical: false, run: async () => (await import("./redox-service")).initializeRedox() },
        { name: "DICOMImaging",            critical: false, run: async () => (await import("./dicom-imaging-service")).initializeDICOMImaging() },
        { name: "InsuranceClaims",         critical: false, run: async () => (await import("./insurance-claims-service")).initializeInsuranceClaims() },
        { name: "LabsIntegration",         critical: false, run: async () => (await import("./labs-integration-service")).initializeLabsIntegration() },
        { name: "GoogleCloudSecurity",     critical: true,  run: async () => (await import("./google-cloud-security-service")).initializeGoogleCloudSecurity() },
        { name: "EnhancedAuth",            critical: true,  run: async () => (await import("./enhanced-auth-service")).initializeEnhancedAuth() },
        { name: "VantaCompliance",         critical: false, run: async () => (await import("./vanta-compliance-service")).initializeVantaCompliance() },
        { name: "CompAICompliance",        critical: false, run: async () => (await import("./comp-ai-compliance-service")).initializeCompAICompliance() },
        { name: "ZeroClickDiscovery",      critical: false, run: async () => (await import("./zero-click-discovery-service")).initializeZeroClickDiscovery() },
        { name: "HealthGraph",             critical: false, run: async () => (await import("./health-graph-service")).initializeHealthGraph() },
        { name: "AIChartExplanation",      critical: false, run: async () => (await import("./ai-chart-explanation-service")).initializeAIChartExplanation() },
        { name: "OneTapShare",             critical: false, run: async () => (await import("./one-tap-share-service")).initializeOneTapShare() },
        { name: "PatientDataPermissions",  critical: true,  run: async () => (await import("./patient-data-permissions-service")).initializePatientDataPermissions() },
        { name: "DuplicateTestPrevention", critical: false, run: async () => (await import("./duplicate-test-prevention-service")).initializeDuplicateTestPrevention() },
        { name: "USCDIv6",                 critical: false, run: async () => (await import("./uscdi-v5-service")).initializeUSCDIv6() },
        { name: "DocumentationAssistant",  critical: false, run: async () => (await import("./ai-documentation-assistant")).initializeDocumentationAssistant() },
        { name: "SafetyAnalysis",          critical: false, run: async () => (await import("./ai-safety-analysis-service")).initializeSafetyAnalysis() },
        { name: "ClinicalDataLinker",      critical: false, run: async () => (await import("./ai-clinical-data-linker")).initializeClinicalDataLinker() },
        { name: "TEFCAFramework",          critical: false, run: async () => (await import("./tefca-framework-service")).initializeTEFCAFramework() },
        { name: "EpicIntegration",         critical: false, run: async () => (await import("./epic-integration-service")).initializeEpicIntegration() },
        { name: "ExtendedFHIRNetworks",    critical: false, run: async () => (await import("./extended-fhir-networks-service")).initializeExtendedFHIRNetworks() },
        { name: "WearableDevices",         critical: false, run: async () => (await import("./wearable-device-service")).initializeWearableDevices() },
        { name: "DataLineage",             critical: false, run: async () => (await import("./data-lineage-service")).initializeDataLineage() },
        { name: "GCSHIPAAStorage",         critical: true,  run: async () => (await import("./gcs-hipaa-storage")).initializeGCSHIPAAStorage() },
        { name: "IDmeIntegration",         critical: false, run: async () => (await import("./idme-integration-service")).initializeIDmeIntegration() },
        { name: "PhiAudit",                critical: true,  run: async () => (await import("./phi-audit-service")).initializePhiAudit() },
        { name: "SessionTimeout",          critical: true,  run: async () => (await import("./session-timeout-service")).initializeSessionTimeout() },
        { name: "MfaTotp",                 critical: true,  run: async () => (await import("./mfa-totp-service")).initializeMfaTotp() },
        { name: "DataRetention",           critical: false, run: async () => (await import("./data-retention-service")).initializeDataRetention() },
        { name: "PopulationBenchmarks",    critical: false, run: async () => (await import("./population-benchmarks-service")).initializePopulationBenchmarks() },
        { name: "TreatmentEfficacy",       critical: false, run: async () => (await import("./treatment-efficacy-service")).initializeTreatmentEfficacy() },
        { name: "AdaptiveDashboard",       critical: false, run: async () => (await import("./adaptive-dashboard-service")).initializeAdaptiveDashboard() },
        { name: "GeospatialHealth",        critical: false, run: async () => (await import("./geospatial-health-service")).initializeGeospatialHealth() },
      ];

      const isProd = process.env.NODE_ENV === "production";
      void Promise.all(
        deferredInits.map(async ({ name, critical, run }) => {
          try {
            await run();
            return { name, ok: true };
          } catch (err: any) {
            const msg = err?.message ?? String(err);
            console.error(`[DeferredInit] ${name} failed: ${msg}`);
            if (critical && isProd) {
              console.error(`[DeferredInit] CRITICAL service ${name} failed in production - exiting so orchestrator restarts.`);
              // brief delay so the log line flushes before exit
              setTimeout(() => process.exit(1), 100);
            }
            return { name, ok: false };
          }
        }),
      ).then((results) => {
        const ok = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok).map((r) => r.name);
        if (failed.length === 0) {
          console.log(`[DeferredInit] ${ok}/${results.length} enterprise services initialized`);
        } else {
          console.warn(`[DeferredInit] ${ok}/${results.length} initialized; failed: ${failed.join(", ")}`);
        }
      });

      try {
        const { appointmentReminderService } = await import("./appointment-reminder-service");
        const { twilioSmsService } = await import("./twilio-sms-service");

        const { networkHealthService } = await import("./network-health-service");
        networkHealthService.initialize();

        const { startBlockchainAnchorCron } = await import("./blockchain-anchor-cron");
        startBlockchainAnchorCron();

        const { initializeBackgroundSync } = await import("./background-sync-service");
        initializeBackgroundSync();

        const { soc2ComplianceService } = await import("./soc2-compliance-service");
        soc2ComplianceService.initialize();

        const PROCESSOR_INTERVAL = 60000;
        console.log(`[Reminder Processor] Starting unified scheduler (${PROCESSOR_INTERVAL / 1000}s interval)`);

        setInterval(async () => {
          try {
            const appointmentResults = await appointmentReminderService.processReminders();
            if (appointmentResults.length > 0) {
              console.log(`[Reminder Processor] Appointment reminders processed: ${appointmentResults.length}`);
            }
          } catch (err: any) {
            console.error("[Reminder Processor] Appointment error:", err.message);
          }

          try {
            const medResults = await twilioSmsService.processScheduledReminders();
            if (medResults.sent > 0 || medResults.failed > 0) {
              console.log(`[Reminder Processor] Medication reminders - Sent: ${medResults.sent}, Failed: ${medResults.failed}`);
            }
          } catch (err: any) {
            console.error("[Reminder Processor] Medication error:", err.message);
          }

          try {
            const { baaAgreementService } = await import("./baa-agreement-service");
            const baaResults = await baaAgreementService.processExpirationReminders();
            if (baaResults.sent > 0 || baaResults.errors > 0) {
              console.log(`[Reminder Processor] BAA reminders - Sent: ${baaResults.sent}, Errors: ${baaResults.errors}`);
            }
          } catch (err: any) {
            console.error("[Reminder Processor] BAA reminder error:", err.message);
          }
        }, PROCESSOR_INTERVAL);
      } catch (err) {
        console.error("Failed to start reminder processor:", err);
      }
    },
  );
})();
