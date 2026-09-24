import { useState } from "react";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

/**
 * tabulamedica.us hard paywall — $9.99 per year.
 *
 * Rendered INSTEAD of the app by App.tsx when the .us edition paywall is
 * configured and the signed-in user has no active subscription. Calm and
 * price-forward. Language is intentionally plain: "subscription", "$9.99 per
 * year" — no "discount", "member rate", or "plan" framing.
 */
export default function UsPaywall() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/us/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`checkout_failed_${res.status}`);
      }
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("no_checkout_url");
    } catch (e) {
      console.error("[UsPaywall] subscribe error:", e);
      setError(
        "We couldn't start checkout just now. Please try again in a moment.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your Tabula Medica subscription
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A subscription keeps your health records unified, private, and
              available whenever you need them.
            </p>
          </div>

          <div className="my-8 flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight" data-testid="text-price">
                $9.99
              </span>
              <span className="text-lg text-muted-foreground">/ year</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              $9.99 per year, billed annually. Cancel anytime.
            </p>
          </div>

          {error && (
            <p className="mb-4 text-center text-sm text-destructive" data-testid="text-error">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubscribe}
            disabled={loading}
            data-testid="button-subscribe"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to secure checkout…
              </>
            ) : (
              "Subscribe"
            )}
          </Button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Secure payment processed by Stripe</span>
          </div>

          <div className="mt-8 border-t pt-4 text-center text-sm text-muted-foreground">
            {user?.email && (
              <p className="mb-1" data-testid="text-signed-in-as">
                Signed in as {user.email}
              </p>
            )}
            <button
              type="button"
              onClick={logout}
              className="text-primary underline-offset-4 hover:underline"
              data-testid="link-sign-out"
            >
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
