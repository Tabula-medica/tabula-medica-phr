import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * Account creation is now handled inline on the single /auth/login page
 * (Sign in / Create account toggle). This page is kept only so existing
 * links, bookmarks, and the landing-page "Get started" CTA that point at
 * /auth/register still resolve — it just forwards to the unified login.
 */
export default function AuthRegister() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/auth/login");
  }, [setLocation]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      data-testid="page-register-redirect"
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Redirecting to sign in…</span>
      </div>
    </div>
  );
}
