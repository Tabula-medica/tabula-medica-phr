/**
 * F1 Action Item — `noStorePhi` middleware.
 *
 * Adds RFC-7234 / OWASP-recommended cache-suppression headers to every PHI-
 * bearing response so that:
 *   - browsers do not write the response body to the disk cache
 *   - intermediate proxies (CDNs, ISPs, corporate MITM) do not store it
 *   - the Service Worker is signalled (via header inspection) to skip caching
 *   - back/forward navigation re-fetches instead of restoring stale PHI
 *
 * Headers set (per OWASP "Sensitive Data — Cache Control" guidance):
 *   Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0
 *   Pragma:        no-cache                (HTTP/1.0 fallback)
 *   Expires:       0                       (legacy proxy fallback)
 *   Surrogate-Control: no-store            (CDN / Vercel / Fastly hint)
 *   Vary:          *                       (defensive: prevent any key reuse)
 *
 * Usage:
 *   import { noStorePhi } from "./lib/middleware/no-store-phi";
 *   router.use(noStorePhi);
 *
 * Apply to every router that returns PHI in the response body. Current
 * audit-confirmed PHI routers (as of 2026-04-18):
 *   - server/patient-health-record-routes.ts        (mounted at /api/health-records)
 *   - server/medication-routes.ts                   (mounted at /api/medications)
 *   - server/timeline-events-routes.ts              (mounted at /api/timeline)
 *   - server/dashboard-routes.ts                    (mounted at /api/dashboard)
 *   - server/documents-routes.ts                    (mounted at /api/documents)
 *   - server/conditions-routes.ts                   (mounted at /api/conditions)
 *   - server/patient-identity-routes.ts
 *   - server/symptoms-routes.ts
 *   - server/vitals-routes.ts
 *   - server/care-plan-routes.ts
 *   - server/engagement-routes.ts
 *   - server/clinical-ai-audit-routes.ts
 *   - server/dedup-routes.ts
 *   - server/share-link-routes.ts
 *
 * For routers serving a mix of PHI and non-PHI endpoints, attach the
 * middleware at the route-handler level instead of `router.use(...)`.
 *
 * NOTE — Downstream middleware currently strips `Surrogate-Control` and
 * overrides our `Vary: *` (CORS sets `Vary: Origin`). Primary no-cache
 * behavior is preserved via `Cache-Control: no-store`, which is sufficient
 * for browsers, the service worker, and most reverse proxies. However, if a
 * CDN is added in front of the server (Cloudflare, Fastly, Varnish, etc.),
 * confirm that `Surrogate-Control: no-store` actually reaches the edge — or,
 * failing that, configure CDN-side no-cache rules for every PHI route.
 * Without one of those two, an edge cache could store PHI bodies despite the
 * `Cache-Control: no-store` directive (CDNs commonly honor Surrogate-Control
 * over Cache-Control by design).
 *
 * NOTE — This middleware alone is NOT sufficient. The companion fix in
 * `public/sw.js` REMOVES PHI URL prefixes from `CACHEABLE_API_ROUTES` so the
 * service worker never considers them cacheable in the first place. Without
 * that fix the SW would cache the response in memory regardless of headers,
 * because it intercepts the fetch event before the headers arrive at the
 * browser HTTP cache layer.
 */

import type { Request, Response, NextFunction } from "express";

export function noStorePhi(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private, max-age=0",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  // Vary:* tells any cache that the response varies on every request header
  // (i.e. is uncacheable for any reuse). Belt-and-suspenders alongside
  // Cache-Control: no-store.
  res.setHeader("Vary", "*");
  next();
}
