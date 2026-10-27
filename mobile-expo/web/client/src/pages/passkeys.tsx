import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Key, Trash2, Plus, Smartphone, Monitor, AlertCircle, CheckCircle2 } from "lucide-react";

interface StoredCredential {
  credentialId: string;
  deviceName: string;
  aaguid: string;
  transports: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function deviceIcon(transports: string[]) {
  if (transports.includes("internal")) return <Smartphone className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PasskeysPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  useEffect(() => {
    setPasskeySupported(
      typeof window !== "undefined" &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
    );
  }, []);

  const { data: credentials, isLoading } = useQuery<StoredCredential[]>({
    queryKey: ["/api/webauthn/credentials"],
    queryFn: async () => {
      const res = await fetch("/api/webauthn/credentials", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load passkeys");
      return res.json();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const user = await fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json());
      const optRes = await fetch("/api/webauthn/register/options", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!optRes.ok) throw new Error("Failed to get registration options");
      const options = await optRes.json();

      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: base64urlToBuffer(options.challenge),
          user: { ...options.user, id: base64urlToBuffer(options.user.id) },
          excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })),
        },
      })) as PublicKeyCredential;

      if (!credential) throw new Error("Passkey creation cancelled");

      const response = credential.response as AuthenticatorAttestationResponse;
      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          attestationObject: bufferToBase64url(response.attestationObject),
          transports: response.getTransports?.() ?? [],
          deviceName: navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")
            ? "iPhone / iPad"
            : navigator.userAgent.includes("Mac")
            ? "Mac"
            : navigator.userAgent.includes("Windows")
            ? "Windows PC"
            : "Device",
        }),
      });
      if (!verifyRes.ok) throw new Error("Passkey registration failed");
      return verifyRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/credentials"] });
      toast({ title: "Passkey added", description: "You can now sign in with your device biometrics." });
    },
    onError: (err: any) => {
      if (err.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Passkey setup was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const res = await fetch(`/api/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove passkey");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/credentials"] });
      toast({ title: "Passkey removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-8 w-8 text-primary mt-0.5" />
        <div>
          <h1 className="text-2xl font-semibold">Passkeys</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Phishing-resistant sign-in using your device biometrics (Face ID, Touch ID, Windows Hello).
            No password required.
          </p>
        </div>
      </div>

      {passkeySupported === false && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="flex gap-3 items-start pt-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your browser or device does not appear to support platform passkeys. Try Chrome, Safari 16+, or
              Edge on a device with biometric authentication.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Your Passkeys</CardTitle>
              <CardDescription>
                {credentials?.length === 0
                  ? "No passkeys set up yet."
                  : `${credentials?.length} passkey${credentials?.length !== 1 ? "s" : ""} registered`}
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || passkeySupported === false}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {registerMutation.isPending ? "Setting up…" : "Add Passkey"}
            </Button>
          </div>
        </CardHeader>

        {!isLoading && credentials && credentials.length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              {credentials.map((cred, i) => (
                <div key={cred.credentialId}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      {deviceIcon(cred.transports)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{cred.deviceName || "Passkey"}</span>
                        {cred.transports.includes("internal") && (
                          <Badge variant="secondary" className="text-xs">Platform</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDate(cred.createdAt)} · Last used {formatDate(cred.lastUsedAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Remove this passkey?")) deleteMutation.mutate(cred.credentialId);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}

        {isLoading && (
          <CardContent>
            <p className="text-sm text-muted-foreground animate-pulse">Loading passkeys…</p>
          </CardContent>
        )}
      </Card>

      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Why passkeys are more secure
          </div>
          <ul className="text-sm text-green-800 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>Phishing-resistant — credentials are bound to this site's origin</li>
            <li>No shared secret — your private key never leaves your device</li>
            <li>Satisfies the proposed 2026 HIPAA Security Rule "phishing-resistant MFA" requirement</li>
            <li>Backed by FIDO2 / WebAuthn — same standard used by Apple, Google, and Microsoft</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Key className="h-3.5 w-3.5" />
        <span>TOTP authenticator app remains available as a fallback MFA method.</span>
      </div>
    </div>
  );
}
