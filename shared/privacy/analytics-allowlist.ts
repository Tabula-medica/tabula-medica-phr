/**
 * Third-party analytics may run only on logged-out marketing pages.
 * Health and account routes are denied by default. A new chart route is
 * untracked until someone adds it here on purpose.
 *
 * Plausible's pageview payload includes the path (and, unless overridden,
 * document.referrer). An exclude list in the shared HTML shell misses every
 * route that is not spelled out, which is how /conditions and /medications
 * were sent to a third party. This allowlist is the opposite rule.
 */

export const PUBLIC_ANALYTICS_PATHS = ["/", "/pricing"] as const;

export const PUBLIC_ANALYTICS_HOSTS = [
  "tabulamedica.health",
  "www.tabulamedica.health",
  "tabulamedica.us",
  "www.tabulamedica.us",
  "tabulamedica.world",
  "www.tabulamedica.world",
  "vista-pd.com",
  "www.vista-pd.com",
] as const;

const HOSTS = new Set<string>(PUBLIC_ANALYTICS_HOSTS);
const PATHS = new Set<string>(PUBLIC_ANALYTICS_PATHS);

export interface AnalyticsDecisionInput {
  pathname: string;
  authenticated: boolean;
  hostname: string;
}

export function normalizeAnalyticsPath(pathname: string): string | null {
  if (!pathname || pathname.includes("\\") || pathname.includes("\0")) return null;
  let path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.includes("..")) return null;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/** True only for a logged-out visitor on an explicit marketing path and host. */
export function mayLoadThirdPartyAnalytics(input: AnalyticsDecisionInput): boolean {
  if (input.authenticated) return false;
  const host = input.hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!HOSTS.has(host)) return false;
  const path = normalizeAnalyticsPath(input.pathname);
  if (!path) return false;
  return PATHS.has(path);
}

/** Page URL sent to analytics: origin + path, never a query string or hash. */
export function analyticsPageUrl(origin: string, pathname: string): string {
  const path = normalizeAnalyticsPath(pathname) ?? "/";
  const base = origin.replace(/\/$/, "");
  return `${base}${path}`;
}
