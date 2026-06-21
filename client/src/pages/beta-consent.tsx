import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgreementResponse {
  version: string;
  sha256: string;
  text: string;
}
interface StatusResponse {
  unlocked: boolean;
  currentVersion: string;
  signedVersion: string | null;
  signedAt: string | null;
}

export default function BetaConsentPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [acknowledged, setAcknowledged] = useState(false);

  const agreementQuery = useQuery<AgreementResponse>({
    queryKey: ["/api/beta-consent/agreement"],
  });
  const statusQuery = useQuery<StatusResponse>({
    queryKey: ["/api/beta-consent/status"],
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/beta-consent/sign", {
        acknowledged: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beta-consent/status"] });
      toast({
        title: "Beta agreement signed",
        description:
          "Real-EHR connections are now unlocked. You can connect a hospital from Connections.",
      });
      setTimeout(() => navigate("/connections"), 600);
    },
    onError: (err: any) => {
      toast({
        title: "Could not record signature",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (statusQuery.data?.unlocked) {
      // Already unlocked — no need to keep showing the form.
    }
  }, [statusQuery.data?.unlocked]);

  if (agreementQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="status-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const alreadySigned =
    statusQuery.data?.unlocked &&
    statusQuery.data?.signedVersion === agreementQuery.data?.version;

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Beta Participant Agreement
          </h1>
          <p className="text-sm text-muted-foreground">
            Required before connecting a real EHR. Synthetic-data sandbox stays
            open without signing.
          </p>
        </div>
      </div>

      {alreadySigned && (
        <Alert className="mb-6" data-testid="alert-already-signed">
          <CheckCircle2 className="h-5 w-5" />
          <AlertTitle>You've already signed</AlertTitle>
          <AlertDescription>
            Version {statusQuery.data?.signedVersion} signed on{" "}
            {statusQuery.data?.signedAt
              ? new Date(statusQuery.data.signedAt).toLocaleString()
              : "—"}
            . Real-EHR access is unlocked on your account.
          </AlertDescription>
        </Alert>
      )}

      {!alreadySigned && (
        <Alert variant="default" className="mb-6 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle>Read carefully</AlertTitle>
          <AlertDescription>
            Tabula Medica is in closed beta. SOC 2 Type II audit is in progress
            but not yet complete. By signing you accept the security posture
            described below.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agreement text — version {agreementQuery.data?.version}</CardTitle>
          <CardDescription>
            SHA-256 fingerprint:{" "}
            <code className="text-xs break-all" data-testid="text-agreement-sha256">
              {agreementQuery.data?.sha256}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre
            className="whitespace-pre-wrap text-sm font-mono bg-muted/40 rounded-md p-4 max-h-[420px] overflow-y-auto"
            data-testid="text-agreement-body"
          >
            {agreementQuery.data?.text}
          </pre>

          {!alreadySigned && (
            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer" data-testid="label-acknowledge">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  data-testid="checkbox-acknowledge"
                />
                <span className="text-sm">
                  I have read this agreement, I am at least 18 years old, and I
                  consent on my own behalf to Tabula Medica receiving and
                  storing my Protected Health Information.
                </span>
              </label>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!acknowledged || signMutation.isPending}
                  onClick={() => signMutation.mutate()}
                  data-testid="button-sign"
                >
                  {signMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  I agree and sign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-skip"
                >
                  Not now — keep using sandbox
                </Button>
              </div>
            </div>
          )}

          {alreadySigned && (
            <div className="mt-6">
              <Button onClick={() => navigate("/connections")} data-testid="button-go-connect">
                Go to Connections
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
