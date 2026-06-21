import { useQuery, useQueryClient } from "@tanstack/react-query";

const AUTH_CHECK_TIMEOUT_MS = 8000;

async function fetchUserProfile(): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
      signal: controller.signal,
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.warn("[useAuth] auth check timed out after 8s — falling through as unauthenticated");
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUserProfile,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const login = () => {
    // Route through the GCIP-backed in-app login page — Auth0 is OFF the
    // patient path (no BAA).
    window.location.href = "/auth/login";
  };

  const logout = () => {
    queryClient.setQueryData(["/api/auth/user"], null);
    window.location.href = "/api/logout";
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    loginWithRedirect: login,
    isLoggingOut: false,
  };
}
