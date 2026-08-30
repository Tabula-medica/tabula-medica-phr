/**
 * Underinsured "Sesame-style" cash-pay marketplace proxy.
 *
 * The Underinsured API (underinsured.health) locks CORS to first-party origins,
 * so the PHR browser can't call it directly. Instead the PHR server proxies the
 * PUBLIC, non-PHI marketplace read endpoints (providers by specialty + cash
 * price + location) and re-exposes them same-origin under /api/marketplace/*.
 *
 * Config: UNDERINSURED_API_BASE (default https://underinsured.health). Fail-safe:
 * on any upstream error we return an empty result so the PHR tab degrades to an
 * empty state instead of erroring.
 */
const BASE = (process.env.UNDERINSURED_API_BASE || "https://underinsured.health").replace(/\/$/, "");
// Some deployments mount the marketplace router under /api. Overridable.
const PREFIX = process.env.UNDERINSURED_API_PREFIX ?? "/api";

export interface MarketplaceProxyResult {
  ok: boolean;
  data: unknown;
}

export async function proxyMarketplace(
  path: string,
  query?: Record<string, string | undefined>,
): Promise<MarketplaceProxyResult> {
  const rel = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${PREFIX}${rel}`, BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }
  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { ok: false, data: emptyFor(rel) };
    return { ok: true, data: await resp.json() };
  } catch {
    return { ok: false, data: emptyFor(rel) };
  }
}

/** Shape-appropriate empty payloads so the client renders a clean empty state. */
function emptyFor(rel: string): unknown {
  if (rel.includes("/providers")) return { providers: [] };
  if (rel.includes("/specialties")) return { specialties: [] };
  return {};
}
