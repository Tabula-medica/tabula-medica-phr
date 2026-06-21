import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Shield, Lock, Link2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function FastenConnectPage() {
  useSEO({
    title: "Connect Health Records | Tabula Medica",
    description: "Securely connect your health records from 25,000+ US healthcare providers via Fasten Health",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetLoadedRef = useRef(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: configData, isLoading, error: configError } = useQuery<{ publicId: string; redirectUri: string }>({
    queryKey: ["/api/fasten-connect/config"],
    retry: 2,
    staleTime: 60000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      setConnectionStatus(status);
      if (status === "authorized" || status === "complete") {
        queryClient.invalidateQueries({ queryKey: ["/api/ehr-integration/connections"] });
        toast({
          title: "Health Records Connected",
          description: "Your health records have been successfully linked. Data sync is in progress.",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!configData?.publicId || widgetLoaded || connectionStatus === "authorized" || connectionStatus === "complete") return;

    if (!configData.publicId || configData.publicId.length < 5) {
      setWidgetError("Fasten Health is not configured. Please contact support.");
      return;
    }

    let cancelled = false;

    const existingLink = document.querySelector('link[href*="fastenhealth.com/connect"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.href = "https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[src*="fastenhealth.com/connect"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.js";
      script.type = "module";
      script.onerror = () => {
        if (!cancelled) {
          setWidgetError("Failed to load the Fasten Health connection widget. Please check your internet connection and try again.");
        }
      };
      document.head.appendChild(script);
    }

    function mountWidget() {
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      const el = document.createElement("fasten-stitch-element");
      el.setAttribute("public-id", configData!.publicId);
      if (configData!.redirectUri) {
        el.setAttribute("redirect-uri", configData!.redirectUri);
      }
      el.setAttribute("data-testid", "fasten-stitch-widget");
      containerRef.current.appendChild(el);

      el.addEventListener("eventBus", ((event: CustomEvent) => {
        try {
          const raw = event.detail?.data;
          const data = typeof raw === "string" ? JSON.parse(raw) : raw || {};
          console.log("[FastenConnect] Event:", data);

          if (data.event_type === "connection.complete" || data.connection_status === "authorized") {
            setConnectionStatus("authorized");
            queryClient.invalidateQueries({ queryKey: ["/api/ehr-integration/connections"] });
            toast({
              title: "Health Records Connected",
              description: "Your health records have been successfully linked.",
            });
          } else if (data.event_type === "connection.error" || data.connection_status === "failed") {
            setConnectionStatus("failed");
            toast({
              title: "Connection Failed",
              description: data.error_message || "Could not connect to your healthcare provider. Please try again.",
              variant: "destructive",
            });
          }
        } catch {
          console.log("[FastenConnect] Event received (unparseable)");
        }
      }) as EventListener);

      widgetLoadedRef.current = true;
      setWidgetLoaded(true);
    }

    if (customElements.get("fasten-stitch-element")) {
      mountWidget();
    } else {
      customElements.whenDefined("fasten-stitch-element").then(() => {
        if (!cancelled) mountWidget();
      }).catch(() => {
        if (!cancelled) {
          setWidgetError("Failed to initialize the Fasten Health widget. Please refresh the page and try again.");
        }
      });

      const timeout = setTimeout(() => {
        if (!cancelled && !widgetLoadedRef.current) {
          setWidgetError("The Fasten Health widget took too long to load. Please check your connection and try again.");
        }
      }, 30000);

      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [configData?.publicId, configData?.redirectUri, widgetLoaded, connectionStatus]);

  const handleRetry = () => {
    setWidgetError(null);
    widgetLoadedRef.current = false;
    setWidgetLoaded(false);
    setConnectionStatus(null);
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  };

  const isConnected = connectionStatus === "authorized" || connectionStatus === "complete";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/connections">
            <Button variant="ghost" size="icon" data-testid="button-back-connections">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Connect Your Health Records
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
              Powered by Fasten Health — 25,000+ US healthcare providers
            </p>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="banner-connected">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Successfully connected to your healthcare provider!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Your records are being synced. This may take a few minutes.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/connections")}
              data-testid="button-go-to-connections"
            >
              View Connections
            </Button>
          </div>
        )}

        {connectionStatus === "failed" && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20" data-testid="banner-failed">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Connection failed. Please try again or select a different provider.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry} data-testid="button-retry-after-fail">
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        <div className="flex items-center gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="banner-security">
          <Shield className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">
            Your credentials are handled directly by Fasten Health. Tabula Medica never sees your provider login.
          </p>
        </div>

        {!isConnected && (
          <Card data-testid="section-fasten-widget">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Select Your Healthcare Provider
              </CardTitle>
              <CardDescription>
                Search for and connect to your healthcare provider below. You will be asked to log in to your provider's patient portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : configError || !configData?.publicId ? (
                <div className="text-center py-8" data-testid="text-config-error">
                  <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
                  <p className="text-sm text-destructive font-medium">
                    Fasten Health integration is not configured.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Please ensure the FASTEN_HEALTH_CLIENT_ID environment variable is set.
                  </p>
                </div>
              ) : widgetError ? (
                <div className="text-center py-8" data-testid="text-widget-error">
                  <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
                  <p className="text-sm text-destructive">{widgetError}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleRetry}
                    data-testid="button-retry"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div ref={containerRef} className="min-h-[400px]" data-testid="container-fasten-widget">
                  {!widgetLoaded && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-48 w-full" />
                      <p className="text-sm text-muted-foreground">Loading Fasten Health widget...</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50" data-testid="info-hipaa">
            <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">HIPAA Compliant</p>
              <p className="text-xs text-muted-foreground">End-to-end encryption protects your health data</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50" data-testid="info-fhir">
            <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">FHIR Standard</p>
              <p className="text-xs text-muted-foreground">Industry-standard format for healthcare data exchange</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FastenConnectPage;
