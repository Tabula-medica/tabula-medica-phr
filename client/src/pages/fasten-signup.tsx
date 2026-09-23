import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Lock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  MessageSquare,
  HeartPulse,
} from "lucide-react";
import {
  startPhoneSignIn,
  confirmPhoneCode,
  normalizePhoneE164,
  clearRecaptcha,
  getGcipIdToken,
  isGcipConfigured,
  type ConfirmationResult,
} from "@/lib/gcip";

/**
 * Fasten "bring your own identity" (BYOI) signup.
 *
 * Stage 1 (connect): the patient connects a real health provider through the
 * Fasten Stitch widget — logging into their provider portal PROVES who they
 * are. The widget hands us an org_connection_id.
 * Stage 2 (secure): they verify a mobile number (GCIP phone auth) — this is
 * the durable login credential so every future sign-in is one-tap phone/SMS.
 * On success we mint the GCIP session, then POST the org_connection_id to
 * /api/auth/fasten/link, which RE-VERIFIES it server-side (private key) and
 * attaches the connection + starts the records import.
 */
export default function FastenSignup() {
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetLoadedRef = useRef(false);
  const [stage, setStage] = useState<"connect" | "secure">("connect");
  const [orgConnectionId, setOrgConnectionId] = useState<string | null>(null);
  const [platformType, setPlatformType] = useState<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // Phone stage
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "code">("enter");
  const [smsCode, setSmsCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gcipReady = isGcipConfigured();
  const phoneE164 = normalizePhoneE164(phone);

  const { data: configData } = useQuery<{ publicId: string; redirectUri: string }>({
    queryKey: ["/api/fasten-connect/config"],
    retry: 2,
    staleTime: 60000,
  });

  // Mount the Fasten Stitch widget for stage 1.
  useEffect(() => {
    if (stage !== "connect" || !configData?.publicId || widgetLoadedRef.current) return;
    if (configData.publicId.length < 5) {
      setWidgetError("Fasten Health is not configured. Please contact support.");
      return;
    }
    let cancelled = false;

    if (!document.querySelector('link[href*="fastenhealth.com/connect"]')) {
      const link = document.createElement("link");
      link.href = "https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="fastenhealth.com/connect"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.js";
      script.type = "module";
      script.onerror = () => {
        if (!cancelled) setWidgetError("Failed to load the Fasten Health widget. Check your connection and try again.");
      };
      document.head.appendChild(script);
    }

    function mountWidget() {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      const el = document.createElement("fasten-stitch-element");
      el.setAttribute("public-id", configData!.publicId);
      if (configData!.redirectUri) el.setAttribute("redirect-uri", configData!.redirectUri);
      el.setAttribute("data-testid", "fasten-stitch-widget");
      containerRef.current.appendChild(el);

      el.addEventListener("eventBus", ((event: CustomEvent) => {
        try {
          const raw = event.detail?.data;
          const data = typeof raw === "string" ? JSON.parse(raw) : raw || {};
          const authorized =
            data.event_type === "connection.complete" ||
            data.event_type === "widget.complete" ||
            data.connection_status === "authorized";
          if (authorized) {
            const id =
              data.org_connection_id ||
              data.data?.org_connection_id ||
              data.connection?.org_connection_id ||
              null;
            if (id) {
              setOrgConnectionId(String(id));
              setPlatformType(data.platform_type || data.data?.platform_type || null);
              setStage("secure");
            } else {
              setWidgetError("Connected, but we didn't receive a connection id. Please try again.");
            }
          } else if (data.event_type === "connection.error" || data.connection_status === "failed") {
            setWidgetError(data.error_message || "Could not connect to your provider. Please try again.");
          }
        } catch {
          /* ignore unparseable widget chatter */
        }
      }) as EventListener);

      widgetLoadedRef.current = true;
    }

    if (customElements.get("fasten-stitch-element")) {
      mountWidget();
    } else {
      customElements
        .whenDefined("fasten-stitch-element")
        .then(() => !cancelled && mountWidget())
        .catch(() => !cancelled && setWidgetError("Failed to initialize the Fasten Health widget. Please refresh."));
    }
    return () => {
      cancelled = true;
    };
  }, [stage, configData?.publicId, configData?.redirectUri]);

  useEffect(() => () => clearRecaptcha(), []);

  // After the GCIP session is minted, link the verified Fasten connection and
  // route into the app.
  const finishSignup = async () => {
    const idToken = await getGcipIdToken(true);
    if (!idToken) throw new Error("Could not complete sign-in. Please try again.");
    const sessionRes = await fetch("/api/auth/gcip/session", {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${idToken}`, "X-Requested-With": "XMLHttpRequest" },
    });
    if (!sessionRes.ok) {
      const body = await sessionRes.json().catch(() => ({}));
      throw new Error(body?.message || "Failed to complete sign-in.");
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

    // Attach the health-record connection to the new account (server re-verifies).
    if (orgConnectionId) {
      try {
        await fetch("/api/auth/fasten/link", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ orgConnectionId }),
        });
      } catch {
        // Non-fatal: the account exists; records can be re-linked from Connections.
      }
    }
    setLocation("/new-patient-onboarding");
  };

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
      if (code === "auth/invalid-phone-number") setError("That doesn't look like a valid mobile number.");
      else if (code === "auth/too-many-requests") setError("Too many attempts. Please wait a few minutes.");
      else setError(e?.message || "Couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmation || smsCode.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      await confirmPhoneCode(confirmation, smsCode);
      await finishSignup();
    } catch (e: any) {
      if (e?.code === "auth/invalid-verification-code") setError("That code didn't match. Try again.");
      else if (e?.code === "auth/code-expired") setError("That code expired. Tap “Resend code.”");
      else setError(e?.message || "Couldn't verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col" data-testid="page-fasten-signup">
      <div className="p-6">
        <Link href="/auth/login">
          <Button variant="ghost" size="sm" data-testid="link-back-login">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to sign in
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <img src="/logo.png" alt="Tabula Medica" className="h-10 mx-auto mb-4" />
            <h1 className="text-2xl font-normal">Get started</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your health records to create your account — we verify who you are through your provider. No password.
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className={stage === "connect" ? "font-semibold text-primary" : ""}>1. Connect records</span>
            <span>›</span>
            <span className={stage === "secure" ? "font-semibold text-primary" : ""}>2. Secure account</span>
          </div>

          {stage === "connect" ? (
            <Card className="border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg font-normal flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-primary" />
                  Connect your health records
                </CardTitle>
                <CardDescription>
                  Sign in to your hospital or clinic — Fasten Health connects 25,000+ US providers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {widgetError && (
                  <Alert variant="destructive" data-testid="alert-widget-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{widgetError}</AlertDescription>
                  </Alert>
                )}
                <div ref={containerRef} data-testid="fasten-widget-container" className="min-h-[120px]" />
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Your provider credentials are entered with Fasten, never stored by us.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  Records connected{platformType ? ` (${platformType})` : ""}
                </div>
                <CardTitle className="text-lg font-normal">Secure your account</CardTitle>
                <CardDescription>
                  Add your mobile number so you can sign back in with a one-tap text code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!gcipReady && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Sign-in is temporarily unavailable. Please try again shortly.</AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive" data-testid="alert-secure-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {phoneStep === "enter" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendCode();
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-sm">Mobile number</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(571) 555-0123"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        data-testid="input-signup-phone"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={busy || !gcipReady || !phoneE164}
                      data-testid="button-signup-send-code"
                    >
                      {busy ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending code...</>
                      ) : (
                        <><MessageSquare className="h-4 w-4 mr-2" /> Text me a code</>
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-3" data-testid="signup-code-step">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-sms-code" className="text-sm">
                        Enter the code we texted to {phoneE164}
                      </Label>
                      <Input
                        id="signup-sms-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center text-lg tracking-widest font-mono"
                        data-testid="input-signup-sms-code"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handleVerifyCode}
                      disabled={busy || smsCode.length !== 6}
                      data-testid="button-signup-verify"
                    >
                      {busy ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finishing...</>
                      ) : (
                        "Create my account"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecaptcha();
                        setConfirmation(null);
                        setPhoneStep("enter");
                        setSmsCode("");
                        setError(null);
                      }}
                      disabled={busy}
                      className="text-sm text-muted-foreground hover:underline w-full disabled:opacity-50"
                      data-testid="link-signup-change-number"
                    >
                      Change number
                    </button>
                  </div>
                )}
                {/* Invisible reCAPTCHA target for Firebase phone auth. */}
                <div id="recaptcha-container" />
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              HIPAA-compliant. Your records are encrypted and yours to control.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline font-medium" data-testid="link-signin">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
