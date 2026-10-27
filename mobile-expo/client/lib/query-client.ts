import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateDomain, enforceHttps } from "@/lib/security";
import { getAccessToken } from "@/lib/api";

const USER_ID_KEY = "@tabula_medica_user_id";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return "http://localhost:5000";
    }
    
    // Replit dev/preview: the Express backend (internal port 5000) is exposed
    // on the standard HTTPS port via .replit's externalPort=80 mapping. The
    // frontend (Metro) is proxied through the same Express server, so the API
    // lives on the *same origin* as window.location — no port suffix needed.
    // Adding ":5000" here causes the browser to try a non-existent external
    // port and fail with "A network error occurred" → app stuck on launch.
    if (hostname.includes('replit.dev') || hostname.includes('repl.co')) {
      return `${window.location.protocol}//${window.location.host}`;
    }

    if (hostname.includes('replit.app') || hostname.includes('run.app')) {
      return `${window.location.protocol}//${window.location.host}`;
    }

    return `${window.location.protocol}//${window.location.host}`;
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}`;
  }
  
  return "https://api.tabulamedica.health";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  if (!validateDomain(url.toString())) {
    throw new Error(`[Security] Request blocked: untrusted domain`);
  }

  const securedUrl = enforceHttps(url.toString());

  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const userId = await getUserId();
  if (userId) {
    headers["x-user-id"] = userId;
  }

  const res = await fetch(securedUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    if (!validateDomain(url.toString())) {
      throw new Error(`[Security] Query blocked: untrusted domain`);
    }

    const securedUrl = enforceHttps(url.toString());

    const headers: Record<string, string> = {};
    const token = await getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const userId = await getUserId();
    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch(securedUrl, {
      credentials: "include",
      headers,
    });

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
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.startsWith("401:")) return false;
        if (error instanceof Error && error.message.includes("Security")) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
