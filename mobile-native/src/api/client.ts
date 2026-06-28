/**
 * Typed HTTP client for the live Tabula Medica backend.
 *
 * - Injects `Authorization: Bearer <gcip-id-token>` on every request.
 * - On 401, force-refreshes the Firebase token once and retries (defeats
 *   short-lived expiry/clock-skew 401s), mirroring the axios interceptor in
 *   tabula-medica-mobile/src/services/api.ts.
 * - Normalizes errors into `ApiError` with status + server `error` code.
 *
 * Uses the platform `fetch` (no axios dependency) with an AbortController
 * timeout.
 */
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";
import { getGcipIdToken, isGcipConfigured } from "./gcip";
import { ApiError } from "./types";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  /** Skip auth header (e.g. unauthenticated public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function authHeader(forceRefresh = false): Promise<Record<string, string>> {
  if (!isGcipConfigured()) return {};
  try {
    const token = await getGcipIdToken(forceRefresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function withTimeout(externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort());
  }
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    code = data.error;
    message = data.message || data.error || message;
  } catch {
    // non-JSON body — keep default message
  }
  return new ApiError(message, res.status, code);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, anonymous = false, signal: externalSignal } = options;
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const doFetch = async (forceRefresh: boolean): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(anonymous ? {} : await authHeader(forceRefresh)),
    };
    const { signal, cancel } = withTimeout(externalSignal);
    try {
      return await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    } finally {
      cancel();
    }
  };

  let res: Response;
  try {
    res = await doFetch(false);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out. Check your connection.", 0, "TIMEOUT");
    }
    throw new ApiError("Network error. Please try again.", 0, "NETWORK");
  }

  // One-shot retry with a freshly minted token on 401.
  if (res.status === 401 && !anonymous && isGcipConfigured()) {
    res = await doFetch(true);
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  // 204 / empty body
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
