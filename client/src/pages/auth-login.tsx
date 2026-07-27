import { useState } from "react";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Shield, Lock, ChevronLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInGcipWithGoogle,
  signInGcipWithApple,
  signInGcipWithEmail,
  getGcipIdToken,
  isGcipConfigured,
  isNativeApp,
  isMfaChallenge,
  getMfaResolver,
  resolveTotpChallenge,
  type MultiFactorResolver,
} from "@/lib/gcip";

export default function AuthLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const gcipReady = isGcipConfigured();
  const nativeApp = isNativeApp();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
    const result = (await exchangeRes.json()) as { needsOnboarding?: boolean };
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    setLocation(result?.needsOnboarding ? "/new-patient-onboarding" : "/");
  };

  // Shared error/MFA handling for any GCIP sign-in method.
  const handleSignInError = (e: unknown, fallback: string) => {
    if (isMfaChallenge(e)) {
      try {
        const resolver = getMfaResolver(e);
        setMfaResolver(resolver);
        setError(null);
      } catch (resolverErr: any) {
        setError(resolverErr?.message || "Could not start MFA challenge.");
      }
      return;
    }
    const err = e as { code?: string; message?: string } | null;
    const code = err?.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      setError(null);
    } else if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found"
    ) {
      setError("Incorrect email or password.");
    } else {
      setError(err?.message || fallback);
    }
  };

  const handleEmailSignIn = async () => {
    if (!emailValid || password.length === 0) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signInGcipWithEmail(email.trim(), password);
      await completeSession();
    } catch (e: unknown) {
      handleSignInError(e, "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleProviderSignIn = async (
    providerLabel: "Google" | "Apple",
    signIn: () => Promise<unknown>,
  ) => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
      await completeSession();
    } catch (e: unknown) {
      handleSignInError(e, `${providerLabel} sign-in failed. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = () => handleProviderSignIn("Google", signInGcipWithGoogle);
  const handleAppleSignIn = () => handleProviderSignIn("Apple", signInGcipWithApple);

  const handleMfaSubmit = async () => {
    if (!mfaResolver) return;
    setError(null);
    setBusy(true);
    try {
      await resolveTotpChallenge(mfaResolver, mfaCode);
      await completeSession();
    } catch (e: any) {
      if (e?.code === "auth/invalid-verification-code") {
        setError("That 6-digit code didn't match. Try again.");
      } else {
        setError(e?.message || "Could not verify code.");
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelMfa = () => {
    setMfaResolver(null);
    setMfaCode("");
    setError(null);
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
                <CardTitle className="text-2xl font-normal">Welcome back</CardTitle>
                <CardDescription>Sign in to your Tabula Medica account</CardDescription>
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
                {mfaResolver ? (
                  <div className="space-y-3" data-testid="mfa-challenge">
                    <div>
                      <Label htmlFor="mfa-challenge-code" className="text-sm">
                        Enter the 6-digit code from your authenticator app
                      </Label>
                      <Input
                        id="mfa-challenge-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center text-lg tracking-widest font-mono mt-2"
                        data-testid="input-mfa-challenge-code"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handleMfaSubmit}
                      disabled={busy || mfaCode.length !== 6}
                      data-testid="button-submit-mfa"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                        </>
                      ) : (
                        "Verify and continue"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={cancelMfa}
                      disabled={busy}
                      data-testid="button-cancel-mfa"
                    >
                      Cancel and start over
                    </Button>
                  </div>
                ) : (
                  <>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleEmailSignIn();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email" className="text-sm">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          data-testid="input-login-email"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="login-password" className="text-sm">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          data-testid="input-login-password"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={busy || !gcipReady || !emailValid || password.length === 0}
                        data-testid="button-email-signin"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </form>

                    {!nativeApp && (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-card px-2 text-muted-foreground">or continue with</span>
                          </div>
                        </div>
                        <div className="space-y-2.5">
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
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full bg-black text-white hover:bg-black/90 hover:text-white border-black dark:bg-black dark:text-white dark:hover:bg-black/90 dark:hover:text-white dark:border-black rounded-lg"
                            size="lg"
                            onClick={handleAppleSignIn}
                            disabled={busy || !gcipReady}
                            data-testid="button-apple-signin"
                          >
                            <SiApple className="h-4 w-4 mr-2" />
                            Continue with Apple
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Protected by Google Cloud Identity Platform
                </p>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground text-center mt-6">
              New to Tabula Medica?{" "}
              <Link href="/auth/register" className="text-primary hover:underline font-medium" data-testid="link-register">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
