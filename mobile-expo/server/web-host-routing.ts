/**
 * Web SPA vs Expo/API host-routing logic, extracted for unit testing.
 *
 * Lives outside server/index.ts so the host/path matrix can be asserted
 * without booting the whole Express app. server/index.ts imports both
 * `WEB_HOSTS` and `shouldServeWebSpa` and the routing middleware uses them
 * verbatim — keep that import-and-reuse pattern so the test stays
 * load-bearing.
 *
 * Web SPA (Vite build) is served on the customer-facing web subdomains.
 * `api.tabulamedica.health` and Expo/EAS clients keep the existing
 * manifest + dist/ behavior. The Replit preview host is included so the
 * staging URL also serves the web SPA.
 */

export const WEB_HOSTS: ReadonlySet<string> = new Set<string>([
  "www.tabulamedica.health",
  "app.tabulamedica.health",
  "portal.tabulamedica.health",
  "tabula-medica-web-verion.replit.app",
  // .us and .world TLDs — same app, different marketing domains
  "tabulamedica.us",
  "www.tabulamedica.us",
  "tabulamedica.world",
  "www.tabulamedica.world",
]);

export function isWebHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return WEB_HOSTS.has(hostname.toLowerCase());
}

/**
 * Returns true iff the request should be served from the Vite SPA bundle
 * (dist/web/). API routes, webhook routes, and non-web hosts must NOT be
 * served from the SPA — they fall through to the existing Express handlers
 * or the Expo dist/ bundle.
 */
export function shouldServeWebSpa(
  hostname: string | undefined | null,
  reqPath: string,
): boolean {
  if (!isWebHost(hostname)) return false;
  if (reqPath.startsWith("/api")) return false;
  if (reqPath.startsWith("/webhooks")) return false;
  return true;
}
