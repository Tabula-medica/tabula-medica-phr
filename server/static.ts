import express, { type Express } from "express";
import fs from "fs";
import path from "path";

let apiRoutesReady = false;

export function markApiRoutesReady() {
  apiRoutesReady = true;
}

export function areApiRoutesReady() {
  return apiRoutesReady;
}

function findDistPath(): string | null {
  const candidates = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(__dirname, "..", "dist", "public"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.existsSync(path.resolve(candidate, "index.html"))) {
        return candidate;
      }
    } catch {}
  }
  console.error("[Static] No build directory found. Tried:", candidates);
  return null;
}

function isApiOrInfraPath(url: string): boolean {
  // NOTE: /auth/* is intentionally NOT treated as infra here. /auth/login and
  // /auth/register are SPA routes that must fall through to index.html so
  // direct navigation, bookmarks, and full reloads work in production. The
  // few real server handlers under /auth/* (e.g. /auth/callback legacy
  // redirect) are mounted BEFORE serveStatic and match first.
  return (
    url.startsWith("/api/") ||
    url === "/health" ||
    url === "/healthz" ||
    url.startsWith("/_ah/")
  );
}

export function serveStatic(app: Express) {
  const distPath = findDistPath();

  if (distPath) {
    app.use(express.static(distPath, { index: false }));
    console.log(`[Static] Serving static files from ${distPath}`);
  } else {
    console.error("[Static] WARNING: serving SPA without static asset directory. Asset URLs will 404 but routes will still resolve to fallback HTML.");
  }

  app.use("*", (req, res, next) => {
    const url = req.originalUrl.split("?")[0];

    if (isApiOrInfraPath(url)) {
      if (!apiRoutesReady) {
        if (url === "/api/login" || url === "/api/auth/login") {
          return res.status(503).set("Retry-After", "5").json({
            error: "SERVICE_STARTING",
            message: "The application is still starting up. Please try again in a few seconds.",
          });
        }
        return res.status(503).set("Retry-After", "5").json({
          error: "SERVICE_STARTING",
          message: "API is loading, please retry shortly.",
        });
      }
      return next();
    }

    if (distPath) {
      const indexPath = path.resolve(distPath, "index.html");
      return res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("[Static] Failed to send index.html:", err);
          res.status(500).type("text/plain").send("Application failed to load. Please contact support.");
        }
      });
    }

    res
      .status(503)
      .type("text/html")
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><title>Tabula Medica</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui;max-width:480px;margin:64px auto;padding:24px;text-align:center"><h1>We'll be right back</h1><p>Tabula Medica is restarting. Please retry in a few seconds.</p></body></html>`
      );
  });
}
