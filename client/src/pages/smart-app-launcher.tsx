import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, ExternalLink, Shield, Star, Clock, Users, CheckCircle2, AlertCircle, Smartphone, Activity, Heart } from "lucide-react";

interface SmartApp {
  id: string;
  name: string;
  description: string;
  appType: string;
  vendor: { name: string; url?: string };
  logoUrl?: string;
  status: string;
  enabledForPatients: boolean;
  featured: boolean;
  installCount: number;
  connectionStatus: string;
  tags: string[];
  scopeConfig: {
    requestedScopes: string[];
    approvedScopes: string[];
    consentRequired: boolean;
  };
  launchConfig: {
    launchUrl: string;
    launchContext: string[];
  };
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

function AppCard({ app, onLaunch }: { app: SmartApp; onLaunch: (app: SmartApp) => void }) {
  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case "CONNECTED": return "text-green-600 dark:text-green-400";
      case "ERROR": return "text-red-600 dark:text-red-400";
      case "PENDING": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card className="hover-elevate flex flex-col">
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {app.logoUrl ? (
            <img src={app.logoUrl} alt={app.name} className="h-8 w-8 object-contain" />
          ) : (
            <Activity className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">{app.name}</CardTitle>
            {app.featured && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1">{app.vendor.name}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{app.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {app.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {app.installCount.toLocaleString()} users
          </span>
          <span className={`flex items-center gap-1 ${getConnectionStatusColor(app.connectionStatus)}`}>
            {app.connectionStatus === "CONNECTED" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {app.connectionStatus.replace("_", " ")}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          className="w-full gap-2" 
          onClick={() => onLaunch(app)}
          data-testid={`button-launch-${app.id}`}
        >
          <ExternalLink className="h-4 w-4" />
          Connect & Launch
        </Button>
      </CardFooter>
    </Card>
  );
}

function ConsentDialog({ 
  app, 
  open, 
  onClose, 
  onConfirm,
  isLoading
}: { 
  app: SmartApp | null; 
  open: boolean; 
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  if (!app) return null;

  const canProceed = acceptedTerms && acceptedPrivacy;

  const getScopeDescription = (scope: string) => {
    if (scope.includes("read")) return "Read your health data";
    if (scope.includes("write")) return "Update your health data";
    if (scope.includes("Patient")) return "Access your patient information";
    if (scope.includes("Observation")) return "View your test results and vitals";
    if (scope.includes("Condition")) return "View your diagnoses and conditions";
    if (scope.includes("Medication")) return "View your medications";
    if (scope.includes("AllergyIntolerance")) return "View your allergies";
    if (scope.includes("Immunization")) return "View your immunizations";
    if (scope.includes("Procedure")) return "View your procedures";
    if (scope === "openid") return "Verify your identity";
    if (scope === "fhirUser") return "Access your user profile";
    if (scope.includes("launch")) return "Launch in patient context";
    return scope;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            Connect to {app.name}
          </DialogTitle>
          <DialogDescription>
            Review the permissions this app is requesting access to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Requested Permissions
            </h4>
            <ScrollArea className="h-32">
              <ul className="space-y-2">
                {app.scopeConfig.requestedScopes.map(scope => (
                  <li key={scope} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    {getScopeDescription(scope)}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox 
                id="terms" 
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                data-testid="checkbox-accept-terms"
              />
              <label htmlFor="terms" className="text-sm leading-tight">
                I agree to the{" "}
                {app.termsOfServiceUrl ? (
                  <a href={app.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Terms of Service
                  </a>
                ) : (
                  "Terms of Service"
                )}
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox 
                id="privacy" 
                checked={acceptedPrivacy}
                onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                data-testid="checkbox-accept-privacy"
              />
              <label htmlFor="privacy" className="text-sm leading-tight">
                I agree to the{" "}
                {app.privacyPolicyUrl ? (
                  <a href={app.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Privacy Policy
                  </a>
                ) : (
                  "Privacy Policy"
                )}
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              By connecting, you authorize {app.name} to access your health information as described above. 
              You can revoke access at any time from your Connected Apps settings.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-consent">
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!canProceed || isLoading}
            data-testid="button-confirm-consent"
          >
            {isLoading ? "Connecting..." : "Connect & Launch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SmartAppLauncher() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<SmartApp | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const { data: appsData, isLoading } = useQuery<{ apps: SmartApp[] }>({
    queryKey: ["/api/smart-apps/patient"]
  });

  const launchMutation = useMutation({
    mutationFn: async (appId: string) => {
      const response = await apiRequest("POST", `/api/smart-apps/${appId}/launch`, {
        patientId: "current-patient",
        iss: window.location.origin + "/api/fhir"
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.launchUrl) {
        toast({
          title: "Launching App",
          description: "Opening app in a new window..."
        });
        window.open(data.launchUrl, "_blank", "noopener,noreferrer");
      }
      setConsentOpen(false);
      setSelectedApp(null);
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    },
    onError: () => {
      toast({
        title: "Launch Failed",
        description: "Unable to launch the app. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleLaunchClick = (app: SmartApp) => {
    if (app.scopeConfig.consentRequired) {
      setSelectedApp(app);
      setConsentOpen(true);
    } else {
      launchMutation.mutate(app.id);
    }
  };

  const handleConfirmConsent = () => {
    if (selectedApp) {
      launchMutation.mutate(selectedApp.id);
    }
  };

  const apps = appsData?.apps || [];
  const filteredApps = apps.filter(app => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      app.vendor.name.toLowerCase().includes(query) ||
      app.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const featuredApps = filteredApps.filter(app => app.featured);
  const allApps = filteredApps;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Connect Health Apps</h1>
            <p className="text-muted-foreground">Access your health records through trusted SMART on FHIR apps</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-apps"
          />
        </div>
      </div>

      <Tabs defaultValue="featured" className="space-y-6">
        <TabsList>
          <TabsTrigger value="featured" className="gap-2" data-testid="tab-featured">
            <Star className="h-4 w-4" />
            Featured
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2" data-testid="tab-all">
            <Activity className="h-4 w-4" />
            All Apps
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-2" data-testid="tab-connected">
            <Heart className="h-4 w-4" />
            My Connected Apps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="featured">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="h-5 w-32 mt-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No featured apps available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredApps.map(app => (
                <AppCard key={app.id} app={app} onLaunch={handleLaunchClick} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="h-5 w-32 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : allApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No apps match your search" : "No apps available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allApps.map(app => (
                <AppCard key={app.id} app={app} onLaunch={handleLaunchClick} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connected">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Connected Apps Yet</p>
              <p className="text-muted-foreground text-center max-w-md">
                Connect to health apps to access your medical records. 
                Your connected apps will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConsentDialog
        app={selectedApp}
        open={consentOpen}
        onClose={() => {
          setConsentOpen(false);
          setSelectedApp(null);
        }}
        onConfirm={handleConfirmConsent}
        isLoading={launchMutation.isPending}
      />
    </div>
  );
}
