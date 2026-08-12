import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Shield, Lock, ChevronLeft, AlertCircle, Loader2, ShieldCheck, Phone, MessageSquare, Mail, HeartPulse } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInGcipWithGoogleRedirect,
  signInGcipWithAppleRedirect,
  completeGcipRedirectSignIn,
  signInGcipWithEmail,
  sendGcipPasswordReset,
  startPhoneSignIn,
  confirmPhoneCode,
  normalizePhoneE164,
  clearRecaptcha,
  getGcipIdToken,
  isGcipConfigured,
  isNativeApp,
  isMfaChallenge,
  getMfaResolver,
  resolveTotpChallenge,
  type MultiFactorResolver,
  type ConfirmationResult,
} from "@/lib/gcip";

export default function AuthLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [resetSent, setResetSent] = useState(false);
  // Phone (SMS) sign-in — the default, HealthEx-style passwordless path.
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "code">("enter");
  const [smsCode, setSmsCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const gcipReady = isGcipConfigured();
  const nativeApp = isNativeApp();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneE164 = normalizePhoneE164(phone);

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

  // Phone step 1: send the SMS code.
  const handleSendCode = async () => {
    if (!phoneE164) {
      setError("Enter a valid mobile number, e.g. (571) 555-0123.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await startPhoneSignIn(phoneE164, "recaptcha-container");
      setConfirmation(result);
      setPhoneStep("code");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/invalid-phone-number") {
        setError("That doesn't look like a valid mobile number.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (code === "auth/captcha-check-failed" || code === "auth/argument-error") {
        setError("Couldn't verify this device. Refresh the page and try again.");
      } else {
        handleSignInError(e, "Couldn't send the code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Phone step 2: verify the 6-digit SMS code.
  const handleVerifyCode = async () => {
    if (!confirmation || smsCode.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      await confirmPhoneCode(confirmation, smsCode);
      await completeSession();
    } catch (e: any) {
      if (e?.code === "auth/invalid-verification-code") {
        setError("That code didn't match. Check the text and try again.");
      } else if (e?.code === "auth/code-expired") {
        setError("That code expired. Tap “Resend code.”");
      } else {
        handleSignInError(e, "Couldn't verify the code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Back to the number entry step (e.g. wrong number, or to resend).
  const resetPhoneFlow = () => {
    clearRecaptcha();
    setConfirmation(null);
    setPhoneStep("enter");
    setSmsCode("");
    setError(null);
  };

  const handlePasswordReset = async () => {
    if (!emailValid) {
      setError("Enter your email above, then tap “Forgot password.”");
      return;
    }
    setError(null);
    setResetSent(false);
    setBusy(true);
    try {
      await sendGcipPasswordReset(email.trim());
      setResetSent(true);
    } catch (e: unknown) {
      handleSignInError(e, "Could not send the reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Redirect flow: signIn() navigates the whole page to Google/Apple. There's
  // no inline result — completion happens on return via the effect below. So we
  // don't call completeSession() here; on success the page has already unloaded.
  const handleProviderSignIn = async (
    providerLabel: "Google" | "Apple",
    signIn: () => Promise<void>,
  ) => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (e: unknown) {
      handleSignInError(e, `${providerLabel} sign-in failed. Please try again.`);
      setBusy(false);
    }
  };

  const handleGoogleSignIn = () => handleProviderSignIn("Google", signInGcipWithGoogleRedirect);
  const handleAppleSignIn = () => handleProviderSignIn("Apple", signInGcipWithAppleRedirect);

  // When the page loads back from a Google/Apple redirect, finish the sign-in.
  // No-op on a normal page load (getRedirectResult returns null).
  //
  // IMPORTANT: skip this entirely inside the native app. In-app the third-party
  // buttons are hidden (email/password only), so there is never a redirect to
  // complete — and calling getRedirectResult() inside an iOS WKWebView throws
  // auth/internal-error, whose catch used to render an error banner on a freshly
  // loaded login page. That is the "error message on the Login/Registration
  // page" that got the app rejected repeatedly (App Store Guideline 2.1a).
  useEffect(() => {
    if (!gcipReady || nativeApp) return;
    let active = true;
    (async () => {
      try {
        const user = await completeGcipRedirectSignIn();
        if (user && active) {
          setBusy(true);
          await completeSession();
        }
      } catch (e: unknown) {
        // A background redirect-completion check must never surface as an error
        // on a fresh login page. Only a genuine MFA challenge (from an actual
        // social redirect) needs UI; anything else is logged, not shown.
        if (active && isMfaChallenge(e)) {
          handleSignInError(e, "");
        } else if (import.meta.env.DEV) {
          console.warn("[auth] redirect completion skipped:", e);
        }
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear down the invisible reCAPTCHA widget when leaving the page so a
  // remount (or route change) rebuilds it from a clean slate.
  useEffect(() => {
    return () => clearRecaptcha();
  }, []);

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
                {resetSent && (
                  <Alert data-testid="alert-reset-sent">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      If an account exists for {email.trim()}, a password-reset link is on its way. Check your email (and spam folder).
                    </AlertDescription>
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
                ) : method === "phone" ? (
                  <div className="space-y-4" data-testid="phone-signin">
                    {phoneStep === "enter" ? (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSendCode();
                        }}
                      >
                        <div className="space-y-1.5">
                          <Label htmlFor="login-phone" className="text-sm">Mobile number</Label>
                          <Input
                            id="login-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="(571) 555-0123"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            data-testid="input-login-phone"
                          />
                          <p className="text-xs text-muted-foreground">
                            We'll text you a 6-digit code. Standard message rates may apply.
                          </p>
                        </div>
                        <Button
                          type="submit"
                          className="w-full"
                          size="lg"
                          disabled={busy || !gcipReady || !phoneE164}
                          data-testid="button-send-code"
                        >
                          {busy ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending code...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Text me a code
                            </>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <div className="space-y-3" data-testid="phone-code-step">
                        <div className="space-y-1.5">
                          <Label htmlFor="login-sms-code" className="text-sm">
                            Enter the code we texted to {phoneE164}
                          </Label>
                          <Input
                            id="login-sms-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            maxLength={6}
                            value={smsCode}
                            onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                            className="text-center text-lg tracking-widest font-mono"
                            data-testid="input-login-sms-code"
                          />
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          size="lg"
                          onClick={handleVerifyCode}
                          disabled={busy || smsCode.length !== 6}
                          data-testid="button-verify-code"
                        >
                          {busy ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                            </>
                          ) : (
                            "Verify and sign in"
                          )}
                        </Button>
                        <div className="flex items-center justify-between text-sm">
                          <button
                            type="button"
                            onClick={resetPhoneFlow}
                            disabled={busy}
                            className="text-muted-foreground hover:underline disabled:opacity-50"
                            data-testid="link-change-number"
                          >
                            Change number
                          </button>
                          <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={busy}
                            className="text-primary font-medium hover:underline disabled:opacity-50"
                            data-testid="link-resend-code"
                          >
                            Resend code
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Invisible reCAPTCHA target for Firebase phone auth. */}
                    <div id="recaptcha-container" />
                    <button
                      type="button"
                      onClick={() => {
                        resetPhoneFlow();
                        setMethod("email");
                      }}
                      disabled={busy}
                      className="text-sm text-muted-foreground hover:text-primary hover:underline text-center w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
                      data-testid="link-use-email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Use email &amp; password instead
                    </button>
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
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={busy || !gcipReady}
                        className="text-sm text-primary hover:underline font-medium text-center w-full disabled:opacity-50"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMethod("phone");
                      }}
                      disabled={busy}
                      className="text-sm text-muted-foreground hover:text-primary hover:underline text-center w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
                      data-testid="link-use-phone"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Sign in with my phone number instead
                    </button>
                  </>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Protected by Google Cloud Identity Platform
                </p>
              </CardContent>
            </Card>
            <div className="mt-6 space-y-3">
              <Link href="/auth/get-started" data-testid="link-get-started">
                <Button variant="outline" className="w-full" size="lg">
                  <HeartPulse className="h-4 w-4 mr-2" />
                  New here? Set up by connecting your records
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground text-center">
                Prefer email?{" "}
                <Link href="/auth/register" className="text-primary hover:underline font-medium" data-testid="link-register">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
