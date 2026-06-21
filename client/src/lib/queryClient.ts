import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { emitFeatureGate } from "./feature-gate-events";

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/**
 * Inspect a 403 response. If the body matches the FEATURE_GATED envelope
 * emitted by `requireFeature()` on the server, push it onto the global
 * feature-gate event bus so ServerFeatureGateListener can render a
 * SoftUpgradePrompt anywhere in the app.
 *
 * Returns true if the response was consumed as a feature-gate signal —
 * callers should still propagate the error so calling code can react.
 */
async function maybeEmitFeatureGate(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const cloned = res.clone();
    const body = await cloned.json();
    if (body && body.code === "FEATURE_GATED" && typeof body.feature === "string") {
      emitFeatureGate({
        feature: body.feature,
        currentTier: body.currentTier,
        requiredTier: body.requiredTier,
        upgradeMessage: body.upgradeMessage,
      });
      return true;
    }
  } catch {
    // Body wasn't JSON or parse failed — not a feature-gate signal.
  }
  return false;
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function retryOnTransient<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 600,
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? "";
      const transient =
        /timed out|network|failed to fetch|ECONNABORTED|ERR_NETWORK|^5\d\d:/i.test(msg);
      if (!transient || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      attempt++;
    }
  }
  throw lastErr;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    await maybeEmitFeatureGate(res);
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest", // CSRF protection header
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await retryOnTransient(() =>
    fetchWithTimeout(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    }),
  );

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await retryOnTransient(() =>
      fetchWithTimeout(queryKey.join("/") as string, {
        credentials: "include",
      }),
    );

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
