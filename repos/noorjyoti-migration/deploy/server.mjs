/**
 * Cloud Run combined entrypoint — NoorJyoti.
 *
 * On Replit the marketing site (Astro SSR) and the Express api-server are two
 * separate deployments. Cloud Run runs ONE container listening on ONE $PORT, so
 * this thin wrapper composes them:
 *
 *   1. imports the already-bundled Express api app (api-server/dist/app.mjs,
 *      which mounts all /api/* routes but does NOT call app.listen()),
 *   2. mounts it first so every /api/* request is handled by it,
 *   3. serves the Astro client assets (dist/client) statically,
 *   4. hands everything else to the Astro SSR middleware `handler`
 *      (dist/server/entry.mjs) so per-Host locale routing + SSR HTML work,
 *   5. listens on $PORT.
 *
 * No application source is modified. This only composes the two build outputs.
 * The api app already configures CORS, body parsing, logging, rate limiting,
 * and (optionally) Clerk — reused verbatim here.
 *
 * Env it honours:
 *   PORT       (required, injected by Cloud Run)
 *   NODE_ENV   ("production" on Cloud Run)
 */
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

// --- The Express api-server app (no listen side-effect). ---
const apiModule = await import(
  path.resolve(__dirname, "../artifacts/api-server/dist/app.mjs")
);
const apiApp = apiModule.default ?? apiModule.app;

// --- The Astro SSR handler (middleware mode -> exports `handler`). ---
const astroModule = await import(
  path.resolve(__dirname, "../artifacts/ekdharma-site/dist/server/entry.mjs")
);
const astroHandler = astroModule.handler;
if (typeof astroHandler !== "function") {
  throw new Error(
    "Astro middleware handler not found. Build ekdharma-site with @astrojs/node mode:'middleware'.",
  );
}

// Astro middleware mode does NOT serve static client assets — we serve them.
const clientDir = path.resolve(
  __dirname,
  "../artifacts/ekdharma-site/dist/client",
);
if (!fs.existsSync(clientDir)) {
  throw new Error(
    `Astro client build not found at ${clientDir}. Run the ekdharma-site build first.`,
  );
}

const server = express();
server.disable("x-powered-by");

// Health check for Cloud Run / uptime probes (in addition to /api/healthz).
server.get("/healthz", (_req, res) => res.status(200).send("ok"));

// API first — everything under /api is handled by the existing Express app.
// Non-/api requests fall through its middleware chain back to this server.
server.use(apiApp);

// The React reader SPA (built to artifacts/web/dist/public with base "/app/").
// Served at /app; a fallback sends index.html for client-side routes so
// /app/library, /app/listen/:id, etc. resolve. The Astro marketing site stays
// at "/". If the web build is absent, this is skipped (site still works).
const webDir = path.resolve(__dirname, "../artifacts/web/dist/public");
if (fs.existsSync(webDir)) {
  server.use(
    "/app",
    express.static(webDir, {
      index: "index.html",
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (/\.[0-9a-f]{8,}\./i.test(path.basename(filePath))) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  server.get(/^\/app(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
}

// Static Astro client assets: hashed _astro/* bundles, public/ files, AND the
// PRERENDERED pages ([lang]/index.astro sets `prerender = true`, emitting
// dist/client/es/index.html, /fr/, /zh/, /yo/, /he/). `index: "index.html"` is
// essential so a directory request like /es/ serves es/index.html — the Astro
// middleware handler only serves ON-DEMAND (SSR) routes, not prerendered ones.
// The SSR root "/" has no dist/client/index.html, so it falls through to the
// Astro handler and renders per-Host, as intended.
server.use(
  express.static(clientDir, {
    index: "index.html",
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (/\.[0-9a-f]{8,}\./i.test(path.basename(filePath))) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// Everything else -> Astro SSR (per-Host locale routing renders full HTML).
server.use(astroHandler);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ level: "info", msg: "Cloud Run server listening", port }),
  );
});
