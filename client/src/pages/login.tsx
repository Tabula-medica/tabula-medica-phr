import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * Legacy /login route.
 *
 * This page used to expose Auth0-backed social sign-in buttons
 * (Google, GitHub, Apple, X). HIPAA compliance: we have NO BAA with
 * Auth0, so patients must never be routed through Auth0. All sign-in
 * traffic now goes through the GCIP-backed page at /auth/login.
 *
 * Kept as a redirect so external links, bookmarks, and older emails
 * pointing at /login still land in the right place.
 */
export default function Login() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/auth/login");
  }, [setLocation]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      data-testid="page-login-redirect"
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Redirecting to sign in…</span>
      </div>
    </div>
  );
}
