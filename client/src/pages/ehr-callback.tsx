import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

type CallbackState = "processing" | "success" | "error";

export default function EHRCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<CallbackState>("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") || params.get("connection_status");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setErrorMessage(errorDescription || error || "Authorization was denied");
      setState("error");
      return;
    }

    if (status === "authorized" || status === "complete") {
      setState("success");
      queryClient.invalidateQueries({ queryKey: ["/api/ehr-integration/connections"] });
      toast({
        title: "Health Records Connected",
        description: "Your health records have been successfully linked.",
      });
      setTimeout(() => setLocation("/"), 2000);
      return;
    }

    if (status === "failed") {
      setErrorMessage("Connection to your healthcare provider failed. Please try again.");
      setState("error");
      return;
    }

    const code = params.get("code");
    const stateParam = params.get("state");

    if (code && stateParam) {
      completeTokenExchange(code, stateParam);
      return;
    }

    setLocation("/connections");
  }, []);

  async function completeTokenExchange(code: string, stateParam: string) {
    try {
      const codeVerifier = sessionStorage.getItem("ehr_code_verifier");
      const platform = sessionStorage.getItem("ehr_platform");
      const facilityName = sessionStorage.getItem("ehr_facility_name");

      if (!codeVerifier || !platform) {
        setErrorMessage("Missing authentication context. Please try connecting again.");
        setState("error");
        return;
      }

      const res = await apiRequest("POST", "/api/ehr-integration/auth/callback", {
        platform,
        userId: "current-user",
        code,
        codeVerifier,
        redirectUri: `${window.location.origin}/ehr-callback`,
        state: stateParam,
        facilityName: facilityName || undefined,
      });

      const result = await res.json();

      sessionStorage.removeItem("ehr_code_verifier");
      sessionStorage.removeItem("ehr_state");
      sessionStorage.removeItem("ehr_platform");
      sessionStorage.removeItem("ehr_facility_name");

      if (result.success) {
        setState("success");
        queryClient.invalidateQueries({ queryKey: ["/api/ehr-integration/connections"] });
        queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
        toast({
          title: "Health Records Connected",
          description: `Successfully connected to ${facilityName || platform}.`,
        });
        setTimeout(() => setLocation("/"), 2000);
      } else {
        setErrorMessage(result.error || "Failed to complete authentication");
        setState("error");
      }
    } catch (err) {
      console.error("[EHR Callback] Token exchange failed:", err);
      setErrorMessage("Failed to complete authentication. Please try again.");
      setState("error");
    }
  }

  const handleRetry = () => {
    setLocation("/connections");
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          {state === "processing" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" data-testid="icon-loading" />
              <h2 className="text-lg font-semibold" data-testid="text-processing-title">Connecting Health Records</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-processing-description">
                Processing your healthcare provider connection...
              </p>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" data-testid="icon-success" />
              <h2 className="text-lg font-semibold" data-testid="text-success-title">Successfully Connected</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-success-description">
                Your health records have been linked. Redirecting to your dashboard...
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" data-testid="icon-error" />
              <h2 className="text-lg font-semibold" data-testid="text-error-title">Connection Failed</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-error-description">
                {errorMessage}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button onClick={handleRetry} data-testid="button-retry">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
