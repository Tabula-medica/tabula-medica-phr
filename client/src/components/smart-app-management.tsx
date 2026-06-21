import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket,
  Shield,
  Key,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Star,
  Download,
  Settings,
  Trash2,
  RefreshCw,
  Play,
  Lock,
  Unlock,
  Users,
  Activity,
  FileText,
  Globe,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertTriangle,
  Sparkles,
  Link2,
} from "lucide-react";

interface SMARTScope {
  resource: string;
  permissions: string[];
  contextRequired?: boolean;
}

interface SMARTApp {
  id: string;
  clientId: string;
  name: string;
  description: string;
  vendor: {
    name: string;
    url?: string;
    email?: string;
  };
  category: string;
  launchUrl: string;
  redirectUrls: string[];
  logoUrl?: string;
  launchContext: string[];
  scopes: SMARTScope[];
  fhirVersion: string;
  capabilities: string[];
  certifications: {
    type: string;
    issuer: string;
    verified: boolean;
  }[];
  status: string;
  trusted: boolean;
  installCount: number;
  rating?: number;
  ratingCount?: number;
  lastUpdated: string;
}

interface SMARTInstallation {
  id: string;
  appId: string;
  userId: string;
  organizationId?: string;
  installedAt: string;
  lastLaunchedAt?: string;
  launchCount: number;
  customScopes?: SMARTScope[];
  status: string;
}

interface AppCategory {
  category: string;
  name: string;
  description: string;
  count: number;
}

interface AppStatistics {
  totalApps: number;
  trustedApps: number;
  totalInstallations: number;
  totalLaunches: number;
  topApps: { app: SMARTApp; launchCount: number }[];
}

interface WellKnownConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  capabilities: string[];
}

export function SMARTAppManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [expandedInstallation, setExpandedInstallation] = useState<string | null>(null);

  const { data: appsData, isLoading: appsLoading } = useQuery<{ apps: SMARTApp[] }>({
    queryKey: ["/api/smart-apps/gallery"],
  });

  const { data: installations = { installations: [] }, isLoading: installationsLoading } = useQuery<{ installations: SMARTInstallation[] }>({
    queryKey: ["/api/smart-apps/installations"],
  });

  const { data: categories = { categories: [] } } = useQuery<{ categories: AppCategory[] }>({
    queryKey: ["/api/smart-apps/categories"],
  });

  const { data: statistics } = useQuery<AppStatistics>({
    queryKey: ["/api/smart-apps/statistics"],
  });

  const { data: wellKnownConfig } = useQuery<WellKnownConfig>({
    queryKey: ["/api/smart-apps/.well-known/smart-configuration"],
  });

  const installAppMutation = useMutation({
    mutationFn: async (data: { appId: string; userId: string; customScopes?: SMARTScope[] }) => {
      const response = await apiRequest("POST", "/api/smart-apps/install", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps/installations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps/statistics"] });
      toast({ title: "App authorized successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Authorization failed", description: error.message, variant: "destructive" });
    },
  });

  const uninstallAppMutation = useMutation({
    mutationFn: async (installationId: string) => {
      const response = await apiRequest("DELETE", `/api/smart-apps/installations/${installationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps/installations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps/statistics"] });
      toast({ title: "App authorization revoked" });
    },
    onError: (error: Error) => {
      toast({ title: "Revocation failed", description: error.message, variant: "destructive" });
    },
  });

  const launchAppMutation = useMutation({
    mutationFn: async (data: { installationId: string; patientId?: string }) => {
      const response = await apiRequest("POST", "/api/smart-apps/launch", {
        installationId: data.installationId,
        userId: "default-user",
        launchContext: "patient",
        contextParams: data.patientId ? { patient: data.patientId } : {},
      });
      return response.json();
    },
    onSuccess: (data: { launchUrl: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps/installations"] });
      if (data.launchUrl) {
        window.open(data.launchUrl, "_blank");
      }
      toast({ title: "App launched successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Launch failed", description: error.message, variant: "destructive" });
    },
  });

  const apps = appsData?.apps || [];
  const filteredApps = apps.filter((app) => {
    const matchesSearch = !searchQuery || 
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getAppById = (appId: string) => apps.find((a) => a.id === appId);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "clinical-decision-support": return <Activity className="h-4 w-4" />;
      case "patient-engagement": return <Users className="h-4 w-4" />;
      case "data-visualization": return <Activity className="h-4 w-4" />;
      case "care-coordination": return <Users className="h-4 w-4" />;
      case "medication-management": return <FileText className="h-4 w-4" />;
      case "imaging": return <FileText className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const formatScopeDisplay = (scope: SMARTScope) => {
    return `${scope.resource}/${scope.permissions.join(", ")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">SMART App Launch</h1>
          <p className="text-muted-foreground mt-1">
            Manage authorized external applications and their FHIR data access
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          OAuth 2.0 + PKCE
        </Badge>
      </div>

      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalApps}</p>
                  <p className="text-xs text-muted-foreground">Available Apps</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.trustedApps}</p>
                  <p className="text-xs text-muted-foreground">Trusted Apps</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalInstallations}</p>
                  <p className="text-xs text-muted-foreground">Authorized</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalLaunches}</p>
                  <p className="text-xs text-muted-foreground">Total Launches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gallery" data-testid="tab-gallery">
            <Rocket className="h-4 w-4 mr-2" />
            App Gallery
          </TabsTrigger>
          <TabsTrigger value="authorized" data-testid="tab-authorized">
            <Shield className="h-4 w-4 mr-2" />
            Authorized ({installations.installations.length})
          </TabsTrigger>
          <TabsTrigger value="scopes" data-testid="tab-scopes">
            <Key className="h-4 w-4 mr-2" />
            Scopes
          </TabsTrigger>
          <TabsTrigger value="configuration" data-testid="tab-configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search apps..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-apps"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px]" data-testid="select-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.categories.map((cat) => (
                      <SelectItem key={cat.category} value={cat.category}>
                        {cat.name} ({cat.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          {appsLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading apps...</p>
              </CardContent>
            </Card>
          ) : filteredApps.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Rocket className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">No apps found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <Card key={app.id} className="hover-elevate" data-testid={`card-app-${app.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getCategoryIcon(app.category)}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {app.name}
                            {app.trusted && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Trusted
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{app.vendor.name}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{app.fhirVersion}</Badge>
                      {app.launchContext.map((ctx) => (
                        <Badge key={ctx} variant="secondary" className="text-xs">
                          {ctx}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {app.installCount} installs
                      </span>
                      {app.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {app.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                      data-testid={`btn-details-${app.id}`}
                    >
                      {expandedApp === app.id ? (
                        <ChevronUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      )}
                      Details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => installAppMutation.mutate({ appId: app.id, userId: "default-user" })}
                      disabled={installAppMutation.isPending}
                      data-testid={`btn-authorize-${app.id}`}
                    >
                      {installAppMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Shield className="h-4 w-4 mr-1" />
                      )}
                      Authorize
                    </Button>
                  </CardFooter>
                  {expandedApp === app.id && (
                    <CardContent className="pt-0 border-t mt-2">
                      <div className="space-y-3 pt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Client ID</Label>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                              {app.clientId}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => {
                                navigator.clipboard.writeText(app.clientId);
                                toast({ title: "Client ID copied" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Launch URL</Label>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                              {app.launchUrl}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => window.open(app.launchUrl, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Requested Scopes</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {app.scopes.map((scope, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Key className="h-3 w-3 mr-1" />
                                {formatScopeDisplay(scope)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {app.certifications.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Certifications</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.certifications.map((cert, idx) => (
                                <Badge
                                  key={idx}
                                  variant={cert.verified ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {cert.verified ? (
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Clock className="h-3 w-3 mr-1" />
                                  )}
                                  {cert.type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="authorized" className="space-y-4">
          {installationsLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading authorized apps...</p>
              </CardContent>
            </Card>
          ) : installations.installations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">No authorized apps</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("gallery")}>
                  Browse App Gallery
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {installations.installations.map((installation) => {
                const app = getAppById(installation.appId);
                if (!app) return null;

                return (
                  <Card key={installation.id} data-testid={`card-installation-${installation.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            {getCategoryIcon(app.category)}
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {app.name}
                              <Badge
                                variant={installation.status === "active" ? "default" : "secondary"}
                              >
                                {installation.status}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <span>Authorized {new Date(installation.installedAt).toLocaleDateString()}</span>
                              {installation.lastLaunchedAt && (
                                <>
                                  <span className="text-muted-foreground">|</span>
                                  <span>Last launched {new Date(installation.lastLaunchedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            <Play className="h-3 w-3 mr-1" />
                            {installation.launchCount} launches
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setExpandedInstallation(
                              expandedInstallation === installation.id ? null : installation.id
                            )}
                          >
                            {expandedInstallation === installation.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {expandedInstallation === installation.id && (
                      <CardContent className="pt-0 space-y-4">
                        <Separator />
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Granted Scopes</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(installation.customScopes || app.scopes).map((scope, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {scope.permissions.includes("write") ? (
                                    <Unlock className="h-3 w-3 mr-1 text-yellow-500" />
                                  ) : (
                                    <Lock className="h-3 w-3 mr-1 text-green-500" />
                                  )}
                                  {formatScopeDisplay(scope)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Launch Context</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.launchContext.map((ctx) => (
                                <Badge key={ctx} variant="secondary" className="text-xs">
                                  {ctx}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => launchAppMutation.mutate({ installationId: installation.id })}
                            disabled={launchAppMutation.isPending}
                            data-testid={`btn-launch-${installation.id}`}
                          >
                            {launchAppMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            Launch App
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => uninstallAppMutation.mutate(installation.id)}
                            disabled={uninstallAppMutation.isPending}
                            data-testid={`btn-revoke-${installation.id}`}
                          >
                            {uninstallAppMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-1" />
                            )}
                            Revoke Access
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scopes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                SMART on FHIR Scopes
              </CardTitle>
              <CardDescription>
                Understanding OAuth scopes for FHIR data access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-500" />
                      Read-Only Scopes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {["patient/*.read", "user/*.read", "system/*.read"].map((scope) => (
                          <div key={scope} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                            <code className="text-xs">{scope}</code>
                            <Badge variant="outline" className="text-xs">Read</Badge>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2">
                          Read-only scopes allow apps to view but not modify health data
                        </p>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Unlock className="h-4 w-4 text-yellow-500" />
                      Write Scopes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {["patient/*.write", "user/*.write", "system/*.write"].map((scope) => (
                          <div key={scope} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                            <code className="text-xs">{scope}</code>
                            <Badge className="text-xs bg-yellow-500">Write</Badge>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2">
                          Write scopes allow apps to create and modify health data
                        </p>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Launch Context Scopes</h4>
                <div className="grid md:grid-cols-4 gap-2">
                  <div className="bg-muted p-3 rounded">
                    <code className="text-xs font-medium">launch/patient</code>
                    <p className="text-xs text-muted-foreground mt-1">Access within patient context</p>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <code className="text-xs font-medium">launch/encounter</code>
                    <p className="text-xs text-muted-foreground mt-1">Access within encounter context</p>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <code className="text-xs font-medium">openid</code>
                    <p className="text-xs text-muted-foreground mt-1">User identity information</p>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <code className="text-xs font-medium">fhirUser</code>
                    <p className="text-xs text-muted-foreground mt-1">FHIR user resource reference</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Security Note</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Always review requested scopes before authorizing an app. Grant only the minimum permissions necessary for the app to function.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                SMART Configuration
              </CardTitle>
              <CardDescription>
                FHIR server SMART on FHIR capability statement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {wellKnownConfig ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Issuer</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-3 py-2 rounded flex-1 truncate">
                          {wellKnownConfig.issuer}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(wellKnownConfig.issuer)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Authorization Endpoint</Label>
                        <code className="text-xs bg-muted px-2 py-1 rounded block mt-1 truncate">
                          {wellKnownConfig.authorization_endpoint}
                        </code>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Token Endpoint</Label>
                        <code className="text-xs bg-muted px-2 py-1 rounded block mt-1 truncate">
                          {wellKnownConfig.token_endpoint}
                        </code>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs text-muted-foreground">Supported Scopes</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {wellKnownConfig.scopes_supported?.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Capabilities</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {wellKnownConfig.capabilities?.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Loading configuration...</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Discovery Endpoints
              </CardTitle>
              <CardDescription>
                Standard SMART on FHIR discovery URLs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                  <div>
                    <p className="text-sm font-medium">SMART Configuration</p>
                    <code className="text-xs text-muted-foreground">/.well-known/smart-configuration</code>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.open("/api/smart-apps/.well-known/smart-configuration", "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
                <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                  <div>
                    <p className="text-sm font-medium">FHIR Capability Statement</p>
                    <code className="text-xs text-muted-foreground">/metadata</code>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.open("/api/fhir/metadata", "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
