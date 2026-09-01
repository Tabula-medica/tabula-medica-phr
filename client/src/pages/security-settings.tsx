import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Smartphone,
  KeyRound,
} from "lucide-react";
import {
  startTotpEnrollment,
  finalizeTotpEnrollment,
  signInGcipWithGoogle,
  unenrollAllFactors,
  hasEnrolledTotp,
  isGcipConfigured,
} from "@/lib/gcip";
import type { TotpSecret } from "firebase/auth";

type MfaStatus = { enrolled: boolean; recoveryCodesRemaining: number };

export default function SecuritySettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const gcipReady = isGcipConfigured();

  const [step, setStep] = useState<"idle" | "qr" | "verify" | "codes">("idle");
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [secretKey, setSecretKey] = useState<string>("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!qrCodeUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrCodeUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrCodeUrl]);

  const statusQuery = useQuery<MfaStatus>({
    queryKey: ["/api/auth/mfa/status"],
  });

  useEffect(() => {
    document.title = "Security — Tabula Medica";
  }, []);

  const beginEnrollment = async () => {
    setError(null);
    setBusy(true);
    try {
      const started = await startTotpEnrollment("Tabula Medica account");
      setSecret(started.secret);
      setSecretKey(started.secretKey);
      setQrCodeUrl(started.qrCodeUrl);
      setStep("qr");
    } catch (e: any) {
      if (e?.code === "auth/requires-recent-login") {
        try {
          await signInGcipWithGoogle();
          const retry = await startTotpEnrollment("Tabula Medica account");
          setSecret(retry.secret);
          setSecretKey(retry.secretKey);
          setQrCodeUrl(retry.qrCodeUrl);
          setStep("qr");
        } catch (e2: any) {
          setError(e2?.message || "Could not start enrollment.");
        }
      } else {
        setError(e?.message || "Could not start enrollment.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!secret) return;
    setError(null);
    setBusy(true);
    try {
      await finalizeTotpEnrollment(secret, code);
      const res = await apiRequest("POST", "/api/auth/mfa/enrolled");
      const body = (await res.json()) as { recoveryCodes: string[] };
      setRecoveryCodes(body.recoveryCodes);
      setStep("codes");
      setCode("");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
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

  const finishEnrollment = () => {
    setStep("idle");
    setSecret(null);
    setQrCodeUrl("");
    setSecretKey("");
    setRecoveryCodes(null);
    setAcknowledged(false);
    setCopied(false);
    toast({
      title: "Multi-factor authentication enabled",
      description: "You'll be prompted for a 6-digit code on next sign-in.",
    });
  };

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/mfa/recovery-codes/regenerate");
      return (await res.json()) as { recoveryCodes: string[] };
    },
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setStep("codes");
      setAcknowledged(false);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
    },
    onError: (e: any) => {
      toast({
        title: "Could not regenerate codes",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      try {
        await signInGcipWithGoogle();
        await unenrollAllFactors();
      } catch (e: any) {
        if (e?.code === "auth/popup-closed-by-user") {
          throw new Error("Sign-in was cancelled. MFA was not disabled.");
        }
        throw e;
      }
      await apiRequest("POST", "/api/auth/mfa/disabled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      toast({
        title: "Multi-factor authentication disabled",
        description: "You can re-enable it from this page at any time.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Could not disable MFA",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const status = statusQuery.data;
  const showingCodes = step === "codes" && recoveryCodes;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background" data-testid="page-security-settings">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="link-back-settings">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to settings
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" /> Security
          </h1>
          <p className="text-muted-foreground mt-2">
            Add an extra layer of protection to your account with an authenticator app.
          </p>
        </div>

        {!gcipReady && (
          <Alert variant="destructive" className="mb-6" data-testid="alert-gcip-unconfigured">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Security features are temporarily unavailable. Please try again in a moment.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-normal flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Multi-factor authentication
                </CardTitle>
                <CardDescription className="mt-1">
                  Time-based one-time passwords (TOTP) from apps like Google Authenticator, 1Password, or Authy.
                </CardDescription>
              </div>
              {statusQuery.isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : status?.enrolled ? (
                <Badge variant="default" className="gap-1" data-testid="badge-mfa-enabled">
                  <ShieldCheck className="h-3 w-3" /> Enabled
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1" data-testid="badge-mfa-disabled">
                  <ShieldAlert className="h-3 w-3" /> Not enabled
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive" data-testid="alert-mfa-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "idle" && !status?.enrolled && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>You'll need an authenticator app on your phone. Common choices:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Google Authenticator</li>
                    <li>1Password / Bitwarden</li>
                    <li>Authy</li>
                  </ul>
                </div>
                <Button
                  onClick={beginEnrollment}
                  disabled={busy || !gcipReady}
                  data-testid="button-begin-enrollment"
                >
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Enable multi-factor authentication
                </Button>
              </div>
            )}

            {step === "idle" && status?.enrolled && !showingCodes && (
              <div className="space-y-4">
                <Alert>
                  <KeyRound className="h-4 w-4" />
                  <AlertTitle>Recovery codes</AlertTitle>
                  <AlertDescription>
                    You have <strong data-testid="text-codes-remaining">{status.recoveryCodesRemaining}</strong> recovery
                    code{status.recoveryCodesRemaining === 1 ? "" : "s"} left. Use these only if you lose your authenticator.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    data-testid="button-regenerate-codes"
                  >
                    {regenerateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Regenerate recovery codes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => disableMutation.mutate()}
                    disabled={disableMutation.isPending}
                    data-testid="button-disable-mfa"
                  >
                    {disableMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Disable MFA
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Disabling MFA re-prompts you to sign in with Google to confirm it's you.
                </p>
              </div>
            )}

            {step === "qr" && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium mb-2">Step 1 · Scan this code with your authenticator app</p>
                  <p className="text-muted-foreground">
                    Or enter the secret manually if you can't scan.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="bg-white p-3 rounded-md border" data-testid="img-qr-code">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR code for authenticator app"
                        width={220}
                        height={220}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 220, height: 220 }}
                      >
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="w-full">
                    <FieldCaption className="text-xs text-muted-foreground">Secret key (manual entry)</FieldCaption>
                    <code
                      className="block text-sm font-mono bg-muted/50 rounded px-3 py-2 mt-1 break-all"
                      data-testid="text-secret-key"
                    >
                      {secretKey}
                    </code>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("idle")} data-testid="button-cancel-enroll">
                    Cancel
                  </Button>
                  <Button onClick={() => setStep("verify")} data-testid="button-next-verify">
                    I've added it — next
                  </Button>
                </div>
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium mb-1">Step 2 · Enter the 6-digit code</p>
                  <p className="text-muted-foreground">
                    Open your authenticator app and enter the current code for Tabula Medica.
                  </p>
                </div>
                <div className="max-w-xs">
                  <Label htmlFor="mfa-code">Verification code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-lg tracking-widest font-mono"
                    data-testid="input-mfa-code"
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("qr")} data-testid="button-back-qr">
                    Back
                  </Button>
                  <Button
                    onClick={submitCode}
                    disabled={busy || code.length !== 6}
                    data-testid="button-verify-code"
                  >
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Verify and enable
                  </Button>
                </div>
              </div>
            )}

            {showingCodes && recoveryCodes && (
              <div className="space-y-4">
                <Alert>
                  <KeyRound className="h-4 w-4" />
                  <AlertTitle>Save your recovery codes now</AlertTitle>
                  <AlertDescription>
                    Each code works once if you lose access to your authenticator. We won't show these again.
                  </AlertDescription>
                </Alert>
                <div
                  className="grid grid-cols-2 gap-2 bg-muted/40 rounded-md p-4 font-mono text-sm"
                  data-testid="list-recovery-codes"
                >
                  {recoveryCodes.map((c, i) => (
                    <div key={i} data-testid={`text-recovery-code-${i}`}>
                      {c}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={copyCodes} data-testid="button-copy-codes">
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied" : "Copy all codes"}
                </Button>
                <Separator />
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ack-codes"
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                    data-testid="checkbox-ack-codes"
                  />
                  <label htmlFor="ack-codes" className="text-sm cursor-pointer">
                    I've saved these recovery codes in a safe place.
                  </label>
                </div>
                <Button
                  onClick={finishEnrollment}
                  disabled={!acknowledged}
                  data-testid="button-finish-enrollment"
                >
                  Done
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Your authenticator secret is stored by Google Cloud Identity Platform. Recovery codes are hashed before storage and never shown again after this screen.
        </p>
      </div>
    </div>
  );
}
