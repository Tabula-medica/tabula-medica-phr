import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search, MoreVertical, Plus, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Activity, Users, Shield, RefreshCw, Eye, Trash2, Power, PowerOff, 
  KeyRound, ExternalLink, Settings, BarChart3, Wifi, WifiOff
} from "lucide-react";

interface SmartApp {
  id: string;
  name: string;
  description: string;
  appType: string;
  vendor: { name: string; url?: string; contactEmail: string };
  credentials: { clientId: string; authMethod: string; secretExpiresAt?: string };
  launchConfig: { launchUrl: string; redirectUrls: string[] };
  scopeConfig: { requestedScopes: string[]; approvedScopes: string[] };
  status: string;
  enabledForPatients: boolean;
  enabledForProviders: boolean;
  featured: boolean;
  installCount: number;
  connectionStatus: string;
  connectionErrorMessage?: string;
  lastConnectionAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalApps: number;
  activeApps: number;
  pendingApps: number;
  disabledApps: number;
  patientFacingApps: number;
  providerFacingApps: number;
  totalConnections: number;
  recentErrors: number;
  appsByStatus: Record<string, number>;
}

function StatCard({ title, value, icon: Icon, description, variant }: {
  title: string;
  value: number | string;
  icon: any;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case "success": return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
      case "warning": return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
      case "danger": return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
      default: return "text-primary bg-primary/10";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${getVariantClasses()}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Active</Badge>;
    case "PENDING_APPROVAL":
      return <Badge className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3" />Pending</Badge>;
    case "DISABLED":
      return <Badge className="gap-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"><PowerOff className="h-3 w-3" />Disabled</Badge>;
    case "REVOKED":
      return <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3" />Revoked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ConnectionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "CONNECTED":
      return <Badge variant="outline" className="gap-1 text-green-600 border-green-300"><Wifi className="h-3 w-3" />Connected</Badge>;
    case "ERROR":
      return <Badge variant="outline" className="gap-1 text-red-600 border-red-300"><AlertTriangle className="h-3 w-3" />Error</Badge>;
    case "PENDING":
      return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300"><Clock className="h-3 w-3" />Pending</Badge>;
    case "NEVER_CONNECTED":
      return <Badge variant="outline" className="gap-1 text-muted-foreground"><WifiOff className="h-3 w-3" />Never Connected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RegisterAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    appType: "PATIENT_FACING",
    vendorName: "",
    vendorEmail: "",
    launchUrl: "",
    redirectUrl: "",
    requestedScopes: "openid,fhirUser,patient/*.read",
    authMethod: "NONE"
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/smart-apps", {
        name: formData.name,
        description: formData.description,
        appType: formData.appType,
        vendor: {
          name: formData.vendorName,
          contactEmail: formData.vendorEmail
        },
        launchConfig: {
          launchUrl: formData.launchUrl,
          redirectUrls: [formData.redirectUrl],
          launchContext: formData.appType === "PATIENT_FACING" ? ["patient", "standalone"] : ["practitioner", "encounter"],
          supportedResponseTypes: ["code"]
        },
        scopeConfig: {
          requestedScopes: formData.requestedScopes.split(",").map(s => s.trim()),
          consentRequired: true,
          offlineAccess: false
        },
        fhirVersions: ["R4"],
        authMethod: formData.authMethod
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "App Registered",
        description: `${data.name} has been registered and is pending approval.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Registration Failed",
        description: "Unable to register the app. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New SMART App</DialogTitle>
          <DialogDescription>
            Register a new SMART on FHIR application with custom launch configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">App Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Health App"
                data-testid="input-app-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appType">App Type</Label>
              <Select value={formData.appType} onValueChange={(v) => setFormData({ ...formData, appType: v })}>
                <SelectTrigger data-testid="select-app-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PATIENT_FACING">Patient Facing</SelectItem>
                  <SelectItem value="PROVIDER_FACING">Provider Facing</SelectItem>
                  <SelectItem value="BACKEND_SERVICE">Backend Service</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this app does..."
              data-testid="input-app-description"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor Name</Label>
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Company Name"
                data-testid="input-vendor-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorEmail">Contact Email</Label>
              <Input
                id="vendorEmail"
                type="email"
                value={formData.vendorEmail}
                onChange={(e) => setFormData({ ...formData, vendorEmail: e.target.value })}
                placeholder="support@company.com"
                data-testid="input-vendor-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="launchUrl">Launch URL</Label>
            <Input
              id="launchUrl"
              value={formData.launchUrl}
              onChange={(e) => setFormData({ ...formData, launchUrl: e.target.value })}
              placeholder="https://myapp.com/smart/launch"
              data-testid="input-launch-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="redirectUrl">Redirect URL</Label>
            <Input
              id="redirectUrl"
              value={formData.redirectUrl}
              onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
              placeholder="https://myapp.com/smart/callback"
              data-testid="input-redirect-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scopes">Requested Scopes (comma-separated)</Label>
            <Input
              id="scopes"
              value={formData.requestedScopes}
              onChange={(e) => setFormData({ ...formData, requestedScopes: e.target.value })}
              placeholder="openid,fhirUser,patient/*.read"
              data-testid="input-scopes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authMethod">Authentication Method</Label>
            <Select value={formData.authMethod} onValueChange={(v) => setFormData({ ...formData, authMethod: v })}>
              <SelectTrigger data-testid="select-auth-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Public Client (PKCE only)</SelectItem>
                <SelectItem value="CLIENT_SECRET_BASIC">Client Secret (Basic)</SelectItem>
                <SelectItem value="CLIENT_SECRET_POST">Client Secret (POST)</SelectItem>
                <SelectItem value="PRIVATE_KEY_JWT">Private Key JWT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => registerMutation.mutate()} 
            disabled={registerMutation.isPending || !formData.name || !formData.launchUrl}
            data-testid="button-submit-registration"
          >
            {registerMutation.isPending ? "Registering..." : "Register App"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSmartApps() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SmartApp | null>(null);

  const { data: statsData, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/smart-apps/dashboard"]
  });

  const { data: appsData, isLoading: appsLoading } = useQuery<{ apps: SmartApp[] }>({
    queryKey: ["/api/smart-apps", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/smart-apps?${params}`);
      return response.json();
    }
  });

  const enableMutation = useMutation({
    mutationFn: async ({ appId, forPatients, forProviders }: { appId: string; forPatients?: boolean; forProviders?: boolean }) => {
      const response = await apiRequest("POST", `/api/smart-apps/${appId}/enable`, { forPatients, forProviders });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "App Updated", description: "App visibility settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    }
  });

  const disableMutation = useMutation({
    mutationFn: async (appId: string) => {
      const response = await apiRequest("POST", `/api/smart-apps/${appId}/disable`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "App Disabled", description: "The app has been disabled." });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ appId, scopes }: { appId: string; scopes: string[] }) => {
      const response = await apiRequest("POST", `/api/smart-apps/${appId}/approve`, { approvedScopes: scopes });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "App Approved", description: "The app has been approved and activated." });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    }
  });

  const rotateCredentialsMutation = useMutation({
    mutationFn: async (appId: string) => {
      const response = await apiRequest("POST", `/api/smart-apps/${appId}/rotate-credentials`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Credentials Rotated", 
        description: `New Client ID: ${data.clientId.substring(0, 20)}...`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    }
  });

  const apps = appsData?.apps || [];
  const filteredApps = apps.filter(app => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(query) ||
      app.vendor.name.toLowerCase().includes(query) ||
      app.credentials.clientId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">SMART Apps Management</h1>
            <p className="text-muted-foreground">Register, configure, and monitor SMART on FHIR applications</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setRegisterOpen(true)} data-testid="button-register-app">
          <Plus className="h-4 w-4" />
          Register App
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Total Apps"
              value={statsData?.totalApps || 0}
              icon={Activity}
              description="Registered applications"
            />
            <StatCard
              title="Active Apps"
              value={statsData?.activeApps || 0}
              icon={CheckCircle2}
              variant="success"
              description="Currently enabled"
            />
            <StatCard
              title="Pending Approval"
              value={statsData?.pendingApps || 0}
              icon={Clock}
              variant="warning"
              description="Awaiting review"
            />
            <StatCard
              title="Recent Errors"
              value={statsData?.recentErrors || 0}
              icon={AlertTriangle}
              variant={statsData?.recentErrors ? "danger" : "default"}
              description="Last hour"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="apps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="apps" className="gap-2" data-testid="tab-apps">
            <Activity className="h-4 w-4" />
            All Apps
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
            <Clock className="h-4 w-4" />
            Pending ({statsData?.pendingApps || 0})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search apps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                    <SelectItem value="REVOKED">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {appsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No apps found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>App</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Connection</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApps.map(app => (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{app.name}</p>
                              <p className="text-xs text-muted-foreground">{app.vendor.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={app.status} />
                          </TableCell>
                          <TableCell>
                            <ConnectionStatusBadge status={app.connectionStatus} />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={app.enabledForPatients}
                              disabled={app.status !== "ACTIVE"}
                              onCheckedChange={(checked) => 
                                enableMutation.mutate({ appId: app.id, forPatients: checked })
                              }
                              data-testid={`switch-patient-${app.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={app.enabledForProviders}
                              disabled={app.status !== "ACTIVE"}
                              onCheckedChange={(checked) => 
                                enableMutation.mutate({ appId: app.id, forProviders: checked })
                              }
                              data-testid={`switch-provider-${app.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{app.installCount.toLocaleString()}</span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-menu-${app.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedApp(app)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(app.launchConfig.launchUrl, "_blank")}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open Launch URL
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {app.status === "PENDING_APPROVAL" && (
                                  <DropdownMenuItem onClick={() => 
                                    approveMutation.mutate({ appId: app.id, scopes: app.scopeConfig.requestedScopes })
                                  }>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve App
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => rotateCredentialsMutation.mutate(app.id)}>
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Rotate Credentials
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {app.status === "ACTIVE" ? (
                                  <DropdownMenuItem 
                                    onClick={() => disableMutation.mutate(app.id)}
                                    className="text-red-600"
                                  >
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Disable App
                                  </DropdownMenuItem>
                                ) : app.status === "DISABLED" && (
                                  <DropdownMenuItem onClick={() => 
                                    approveMutation.mutate({ appId: app.id, scopes: app.scopeConfig.approvedScopes })
                                  }>
                                    <Power className="h-4 w-4 mr-2" />
                                    Re-enable App
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review and approve new SMART app registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {appsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-4">
                  {apps.filter(a => a.status === "PENDING_APPROVAL").map(app => (
                    <Card key={app.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold">{app.name}</h3>
                            <p className="text-sm text-muted-foreground">{app.vendor.name} - {app.vendor.contactEmail}</p>
                            <p className="text-sm mt-2">{app.description}</p>
                            <div className="mt-3">
                              <p className="text-xs font-medium mb-1">Requested Scopes:</p>
                              <div className="flex flex-wrap gap-1">
                                {app.scopeConfig.requestedScopes.map(scope => (
                                  <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">
                                Launch URL: {app.launchConfig.launchUrl}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline"
                              onClick={() => disableMutation.mutate(app.id)}
                            >
                              Reject
                            </Button>
                            <Button 
                              onClick={() => approveMutation.mutate({ 
                                appId: app.id, 
                                scopes: app.scopeConfig.requestedScopes 
                              })}
                              data-testid={`button-approve-${app.id}`}
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {apps.filter(a => a.status === "PENDING_APPROVAL").length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-muted-foreground">No pending approvals</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Apps by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statsData?.appsByStatus && Object.entries(statsData.appsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <StatusBadge status={status} />
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>App Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Patient-Facing Apps</span>
                    </div>
                    <span className="font-medium">{statsData?.patientFacingApps || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Provider-Facing Apps</span>
                    </div>
                    <span className="font-medium">{statsData?.providerFacingApps || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span>Total Connections</span>
                    </div>
                    <span className="font-medium">{statsData?.totalConnections || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <RegisterAppDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedApp?.name}</DialogTitle>
            <DialogDescription>{selectedApp?.vendor.name}</DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Client ID</Label>
                <p className="font-mono text-sm break-all">{selectedApp.credentials.clientId}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Authentication Method</Label>
                <p className="text-sm">{selectedApp.credentials.authMethod}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Launch URL</Label>
                <p className="text-sm break-all">{selectedApp.launchConfig.launchUrl}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Redirect URLs</Label>
                {selectedApp.launchConfig.redirectUrls.map((url, i) => (
                  <p key={i} className="text-sm break-all">{url}</p>
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Approved Scopes</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedApp.scopeConfig.approvedScopes.map(scope => (
                    <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
