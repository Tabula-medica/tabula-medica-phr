import { useState } from "react";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Shield, Lock, ChevronLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInGcipWithEmail,
  signUpGcipWithEmail,
  signInGcipWithGoogle,
  getGcipIdToken,
  isGcipConfigured,
} from "@/lib/gcip";

/**
 * DEAD-SIMPLE login. Email/password + Google, nothing else.
 *
 * Flow: Firebase client SDK signs the user in (email/password OR Google
 * popup) -> we exchange the resulting Firebase ID token for a server
 * session cookie at POST /api/auth/gcip/session -> the server tells us
 * whether the account still needs onboarding. App-level routing
 * (client/src/App.tsx) then gates onboarding vs. the app, so all we do
 * here is land the user on "/".
 *
 * Removed (was over-engineered / breaking sign-in): Apple sign-in, the
 * TOTP/MFA challenge UI, and the separate register page. Account creation
 * is handled inline via the Sign in / Create account toggle.
 */

/** Map raw Firebase auth/* error codes to plain, friendly copy. */
function friendlyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Switch to Sign in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled for this project yet.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return fallback || "Something went wrong. Please try again.";
  }
}

export default function AuthLogin() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gcipReady = isGcipConfigured();

  // Exchange the freshly-minted Firebase ID token for a server session
  // cookie, then route into the app. The onboarding gate in App.tsx
  // decides whether the onboarding screen shows.
  const completeSession = async () => {
    const idToken = await getGcipIdToken(true);
    if (!idToken) {
      throw new Error("Could not get sign-in token. Please try again.");
    }
    const exchangeRes = await fetch("/api/auth/gcip/session", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!exchangeRes.ok) {
      const body = await exchangeRes.json().catch(() => ({}));
      throw new Error(body?.message || "Failed to complete sign-in.");
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
    // Always land on "/"; App.tsx redirects to onboarding if it isn't done.
    setLocation("/");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpGcipWithEmail(email.trim(), password);
      } else {
        await signInGcipWithEmail(email.trim(), password);
      }
      await completeSession();
    } catch (err: unknown) {
      const e2 = err as { code?: string; message?: string } | null;
      setError(friendlyAuthError(e2?.code, e2?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInGcipWithGoogle();
      await completeSession();
    } catch (err: unknown) {
      const e2 = err as { code?: string; message?: string } | null;
      const code = e2?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        setError(friendlyAuthError(code, e2?.message));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex" data-testid="page-auth-login">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-50 via-cyan-50/40 to-white dark:from-muted/10 dark:via-primary/5 dark:to-muted/15 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(8,145,178,0.10)_0%,_transparent_60%)] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center mb-8">
            <img src="/logo.png" alt="Tabula Medica" className="h-12 drop-shadow-sm" />
          </div>
          <h1 className="text-4xl font-light text-foreground mb-6 leading-tight tracking-tight">
            Your health records,<br />
            <span className="text-primary font-normal">unified and secure</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
            Sign in to access your complete medical history from every provider, all in one place.
          </p>
        </div>
        <div className="relative space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">HIPAA-compliant sign-in</p>
              <p className="text-sm text-muted-foreground">Identity verified by Google Cloud Identity Platform.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">End-to-end encrypted</p>
              <p className="text-sm text-muted-foreground">PHI is encrypted at rest and in transit.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">You own your data</p>
              <p className="text-sm text-muted-foreground">Granular sharing controls put you in charge.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to home
            </Button>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <img src="/logo.png" alt="Tabula Medica" className="h-10 mx-auto mb-4" />
            </div>
            <Card className="border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-normal">
                  {mode === "signin" ? "Welcome back" : "Create your account"}
                </CardTitle>
                <CardDescription>
                  {mode === "signin"
                    ? "Sign in to your Tabula Medica account"
                    : "Sign up with your email to get started"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!gcipReady && (
                  <Alert variant="destructive" data-testid="alert-gcip-unconfigured">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Sign-in is temporarily unavailable. Please try again in a moment.
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive" data-testid="alert-signin-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form className="space-y-3" onSubmit={handleEmailSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy || !gcipReady}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy || !gcipReady}
                      data-testid="input-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={busy || !gcipReady}
                    data-testid="button-email-submit"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {mode === "signin" ? "Signing in..." : "Creating account..."}
                      </>
                    ) : mode === "signin" ? (
                      "Sign in"
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </form>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={busy || !gcipReady}
                  data-testid="button-google-signin"
                >
                  <SiGoogle className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>

                <p className="text-sm text-muted-foreground text-center pt-1">
                  {mode === "signin" ? (
                    <>
                      New to Tabula Medica?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() => { setMode("signup"); setError(null); }}
                        data-testid="button-switch-signup"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() => { setMode("signin"); setError(null); }}
                        data-testid="button-switch-signin"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                <p className="text-xs text-muted-foreground text-center pt-1 flex items-center justify-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Protected by Google Cloud Identity Platform
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
