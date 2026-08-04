import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Shield, Lock, ChevronLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import {
  signInGcipWithGoogleRedirect,
  signInGcipWithAppleRedirect,
  completeGcipRedirectSignIn,
  signUpGcipWithEmail,
  getGcipIdToken,
  isGcipConfigured,
  isNativeApp,
} from "@/lib/gcip";

export default function AuthRegister() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHipaa, setAcceptHipaa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gcipReady = isGcipConfigured();
  const nativeApp = isNativeApp();
  const consentGiven = acceptTerms && acceptHipaa && gcipReady;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canEmailSubmit =
    consentGiven && emailValid && password.length >= 8 && password === confirmPassword;

  // Complete the server session after any successful GCIP sign-up.
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
      throw new Error(body?.message || "Failed to complete sign-up.");
    }
    const result = (await exchangeRes.json()) as { needsOnboarding?: boolean };
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    setLocation(result?.needsOnboarding ? "/new-patient-onboarding" : "/");
  };

  const handleEmailSignUp = async () => {
    if (!consentGiven) {
      setError("Please accept the terms of service and HIPAA acknowledgement to continue.");
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signUpGcipWithEmail(email.trim(), password);
      await completeSession();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string } | null;
      switch (err?.code) {
        case "auth/email-already-in-use":
          setError("An account with this email already exists. Please sign in instead.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/weak-password":
          setError("Please choose a stronger password (at least 8 characters).");
          break;
        default:
          setError(err?.message || "Sign-up failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Redirect flow: signIn() navigates the whole page to Google/Apple after
  // consent is captured. Completion happens on return via the effect below, so
  // we don't call completeSession() here.
  const handleProviderSignUp = async (
    providerLabel: "Google" | "Apple",
    signIn: () => Promise<void>,
  ) => {
    if (!consentGiven) {
      setError("Please accept the terms of service and HIPAA acknowledgement to continue.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string } | null;
      setError(err?.message || `${providerLabel} sign-up failed. Please try again.`);
      setBusy(false);
    }
  };

  const handleGoogleSignUp = () => handleProviderSignUp("Google", signInGcipWithGoogleRedirect);
  const handleAppleSignUp = () => handleProviderSignUp("Apple", signInGcipWithAppleRedirect);

  // Finish a Google/Apple redirect sign-up when the page loads back from the
  // provider. No-op on a normal page load.
  useEffect(() => {
    if (!gcipReady) return;
    let active = true;
    (async () => {
      try {
        const user = await completeGcipRedirectSignIn();
        if (user && active) {
          setBusy(true);
          await completeSession();
        }
      } catch (e: unknown) {
        const err = e as { message?: string } | null;
        if (active) setError(err?.message || "Sign-up failed. Please try again.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex" data-testid="page-auth-register">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-50 via-cyan-50/40 to-white dark:from-muted/10 dark:via-primary/5 dark:to-muted/15 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(8,145,178,0.10)_0%,_transparent_60%)] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center mb-8">
            <img src="/logo.png" alt="Tabula Medica" className="h-12 drop-shadow-sm" />
          </div>
          <h1 className="text-4xl font-light text-foreground mb-6 leading-tight tracking-tight">
            Take control of<br />
            <span className="text-primary font-normal">your health story</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
            Create a free account to unify records from every provider, get AI-powered explanations, and share with care teams on your terms.
          </p>
        </div>
        <div className="relative space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Free, forever</p>
              <p className="text-sm text-muted-foreground">Core health-record features at no cost to patients.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">HIPAA-compliant from day one</p>
              <p className="text-sm text-muted-foreground">Identity verified by Google Cloud Identity Platform.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Built around you</p>
              <p className="text-sm text-muted-foreground">Granular sharing — you decide who sees what, and for how long.</p>
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
                <CardTitle className="text-2xl font-normal">Create your account</CardTitle>
                <CardDescription>Create your free account to get started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!gcipReady && (
                  <Alert variant="destructive" data-testid="alert-gcip-unconfigured">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Sign-up is temporarily unavailable. Please try again in a moment.
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive" data-testid="alert-signup-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      data-testid="checkbox-accept-terms"
                    />
                    <label htmlFor="accept-terms" className="text-sm text-foreground leading-snug cursor-pointer">
                      I agree to the{" "}
                      <Link href="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="accept-hipaa"
                      checked={acceptHipaa}
                      onCheckedChange={(v) => setAcceptHipaa(v === true)}
                      data-testid="checkbox-accept-hipaa"
                    />
                    <label htmlFor="accept-hipaa" className="text-sm text-foreground leading-snug cursor-pointer">
                      I acknowledge the{" "}
                      <Link href="/hipaa-notice" className="text-primary hover:underline">HIPAA Notice of Privacy Practices</Link>{" "}
                      describing how my health information is used and disclosed.
                    </label>
                  </div>
                </div>

                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailSignUp();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="register-email" className="text-sm">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-register-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className="text-sm">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-register-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirm" className="text-sm">Confirm password</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-register-confirm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={busy || !canEmailSubmit}
                    data-testid="button-email-signup"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center pt-1 flex items-center justify-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Protected by Google Cloud Identity Platform
                </p>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline font-medium" data-testid="link-login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
