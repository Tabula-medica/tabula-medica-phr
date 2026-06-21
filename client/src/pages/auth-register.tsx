import { useState } from "react";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Shield, Lock, ChevronLeft, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { signInGcipWithGoogle, signInGcipWithApple, getGcipIdToken, isGcipConfigured } from "@/lib/gcip";

export default function AuthRegister() {
  const [, setLocation] = useLocation();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHipaa, setAcceptHipaa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gcipReady = isGcipConfigured();
  const canSubmit = acceptTerms && acceptHipaa && gcipReady;

  const handleProviderSignUp = async (
    providerLabel: "Google" | "Apple",
    signIn: () => Promise<unknown>,
  ) => {
    if (!canSubmit) {
      setError("Please accept the terms of service and HIPAA acknowledgement to continue.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn();
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
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string } | null;
      const code = err?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        setError(err?.message || `${providerLabel} sign-up failed. Please try again.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignUp = () => handleProviderSignUp("Google", signInGcipWithGoogle);
  const handleAppleSignUp = () => handleProviderSignUp("Apple", signInGcipWithApple);

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
                <CardDescription>Sign up with Google to get started in seconds</CardDescription>
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

                <div className="space-y-2.5">
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    onClick={handleGoogleSignUp}
                    disabled={busy || !canSubmit}
                    data-testid="button-google-signup"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <SiGoogle className="h-4 w-4 mr-2" />
                        Continue with Google
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-black text-white hover:bg-black/90 hover:text-white border-black dark:bg-black dark:text-white dark:hover:bg-black/90 dark:hover:text-white dark:border-black rounded-lg"
                    size="lg"
                    onClick={handleAppleSignUp}
                    disabled={busy || !canSubmit}
                    data-testid="button-apple-signup"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <SiApple className="h-4 w-4 mr-2" />
                        Continue with Apple
                      </>
                    )}
                  </Button>
                </div>
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
