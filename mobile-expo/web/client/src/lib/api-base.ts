/**
 * API origin routing for the co-located web client.
 *
 * The web SPA is served from the unified frontend hosting
 * (www/app/portal.tabulamedica.health) by the consolidated Express server,
 * but its backend lives on the web app's own dedicated server. To keep web
 * API traffic on that dedicated backend — instead of the mobile Express
 * backend that serves the SPA shell — we prepend an absolute origin to every
 * root-relative `/api`, `/webhooks`, and `/ws` request.
 *
 * Configure via the build-time env var `VITE_API_BASE_URL`, e.g.
 *   VITE_API_BASE_URL=https://<dedicated-web-backend-host>
 *
 * When unset (the default), requests stay same-origin so local dev and the
 * original standalone deployment behave exactly as before.
 */

const RAW_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

/** Absolute origin for the dedicated web backend, or "" for same-origin. */
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

/** Root-relative HTTP paths that must be routed to the dedicated backend. */
const HTTP_PATH_RE = /^\/(api|webhooks)(\/|$|\?)/;

/**
 * Prepend the configured backend origin to a root-relative API path.
 * Leaves absolute URLs and non-API paths untouched.
 */
export function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (typeof path === "string" && HTTP_PATH_RE.test(path)) {
    return API_BASE_URL + path;
  }
  return path;
}

/**
 * Build a WebSocket URL for a root-relative `/ws...` path, pointed at the
 * dedicated backend origin when configured, otherwise the current host.
 */
export function resolveWsUrl(path: string): string {
  if (API_BASE_URL) {
    const u = new URL(API_BASE_URL);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

/**
 * Install a one-time global `fetch` interceptor that rewrites root-relative
 * `/api` and `/webhooks` requests to the dedicated backend origin and forces
 * credentialed (cookie) requests for cross-origin auth.
 *
 * This is the single chokepoint covering every call site — `apiRequest`,
 * the TanStack `getQueryFn`, and the many direct `fetch("/api/...")` calls
 * scattered across pages/hooks — without editing each one.
 *
 * No-op when `VITE_API_BASE_URL` is unset (same-origin behavior preserved).
 */
export function installApiBaseInterceptor(): void {
  if (!API_BASE_URL) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function")
    return;
  if (
    (window as unknown as { __apiBaseInterceptorInstalled?: boolean })
      .__apiBaseInterceptorInstalled
  ) {
    return;
  }
  (
    window as unknown as { __apiBaseInterceptorInstalled?: boolean }
  ).__apiBaseInterceptorInstalled = true;

  const original = window.fetch.bind(window);
  const origin = window.location.origin;

  window.fetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      if (typeof input === "string") {
        if (HTTP_PATH_RE.test(input)) {
          return original(API_BASE_URL + input, {
            ...init,
            credentials: "include",
          });
        }
      } else if (input instanceof URL) {
        if (input.origin === origin && HTTP_PATH_RE.test(input.pathname)) {
          return original(
            API_BASE_URL + input.pathname + input.search + input.hash,
            {
              ...init,
              credentials: "include",
            },
          );
        }
      } else if (typeof Request !== "undefined" && input instanceof Request) {
        const parsed = new URL(input.url, origin);
        if (parsed.origin === origin && HTTP_PATH_RE.test(parsed.pathname)) {
          const rewritten = new Request(
            API_BASE_URL + parsed.pathname + parsed.search + parsed.hash,
            input,
          );
          return original(rewritten, { ...init, credentials: "include" });
        }
      }
    } catch {
      // Fall through to the original fetch on any unexpected input shape.
    }
    return original(input as RequestInfo, init);
  };
}
