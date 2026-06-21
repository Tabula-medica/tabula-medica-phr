import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FHIRMappingDesigner } from "./fhir-mapping-designer";
import { 
  Server, 
  Plug, 
  Search, 
  Download, 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Database,
  FileText,
  Shield,
  Activity,
  Zap,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Layers
} from "lucide-react";

interface FHIRServer {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: string;
  authMethod: string;
  status: string;
  lastConnectedAt?: string;
  supportedResources: string[];
  isTestServer: boolean;
  errorMessage?: string;
}

interface DataExchange {
  id: string;
  serverId: string;
  direction: string;
  resourceType: string;
  resourceCount: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface SupportedResource {
  type: string;
  description: string;
  usCore: boolean;
}

interface SearchParam {
  name: string;
  type: string;
  description: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    connected: { variant: "default", icon: CheckCircle },
    disconnected: { variant: "secondary", icon: XCircle },
    connecting: { variant: "outline", icon: RefreshCw },
    error: { variant: "destructive", icon: AlertCircle },
    completed: { variant: "default", icon: CheckCircle },
    in_progress: { variant: "outline", icon: Clock },
    failed: { variant: "destructive", icon: XCircle },
    pending: { variant: "secondary", icon: Clock },
  };

  const config = variants[status] || { variant: "secondary" as const, icon: AlertCircle };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function FHIRInteroperabilityDashboard() {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [searchResourceType, setSearchResourceType] = useState("Patient");
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    baseUrl: "",
    fhirVersion: "R4" as "R4" | "STU3" | "DSTU2",
    authMethod: "none" as "none" | "basic" | "bearer",
  });
  const { toast } = useToast();

  const { data: serversData, isLoading: serversLoading } = useQuery<{ success: boolean; data: FHIRServer[] }>({
    queryKey: ["/api/fhir/external/servers"],
  });

  const { data: exchangesData } = useQuery<{ success: boolean; data: DataExchange[] }>({
    queryKey: ["/api/fhir/external/exchanges"],
  });

  const { data: resourcesData } = useQuery<{ success: boolean; data: SupportedResource[] }>({
    queryKey: ["/api/fhir/external/supported-resources"],
  });

  const { data: searchParamsData } = useQuery<{ success: boolean; data: SearchParam[] }>({
    queryKey: [`/api/fhir/external/search-params/${searchResourceType}`],
    enabled: !!searchResourceType,
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return apiRequest("POST", `/api/fhir/external/servers/${serverId}/test`);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/external/servers"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to test connection", variant: "destructive" });
    },
  });

  const addServerMutation = useMutation({
    mutationFn: async (data: typeof newServer) => {
      return apiRequest("POST", "/api/fhir/external/servers", data);
    },
    onSuccess: () => {
      toast({ title: "Server added", description: "FHIR server configuration saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/external/servers"] });
      setShowAddServer(false);
      setNewServer({ name: "", baseUrl: "", fhirVersion: "R4", authMethod: "none" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add server", variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async ({ serverId, resourceType, params }: { serverId: string; resourceType: string; params: Record<string, string> }) => {
      return apiRequest("POST", `/api/fhir/external/servers/${serverId}/search`, {
        resourceType,
        params,
        includeCount: true,
        pageSize: 20,
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Search complete", 
        description: `Found ${data.data?.total || data.data?.entries?.length || 0} resources` 
      });
    },
    onError: () => {
      toast({ title: "Search failed", description: "Unable to execute search query", variant: "destructive" });
    },
  });

  const servers = serversData?.data || [];
  const exchanges = exchangesData?.data || [];
  const supportedResources = resourcesData?.data || [];
  const searchParamsList = searchParamsData?.data || [];

  const selectedServerData = selectedServer ? servers.find(s => s.id === selectedServer) : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" />
            FHIR Interoperability Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect to external FHIR servers for secure health data exchange
          </p>
        </div>
        <Dialog open={showAddServer} onOpenChange={setShowAddServer}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-server">
              <Plus className="w-4 h-4 mr-2" />
              Add Server
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add FHIR Server</DialogTitle>
              <DialogDescription>
                Configure a new external FHIR server connection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="server-name">Server Name</Label>
                <Input
                  id="server-name"
                  data-testid="input-server-name"
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  placeholder="My Healthcare System"
                />
              </div>
              <div>
                <Label htmlFor="server-url">Base URL</Label>
                <Input
                  id="server-url"
                  data-testid="input-server-url"
                  value={newServer.baseUrl}
                  onChange={(e) => setNewServer({ ...newServer, baseUrl: e.target.value })}
                  placeholder="https://fhir.example.com/baseR4"
                />
              </div>
              <div>
                <Label>FHIR Version</Label>
                <Select
                  value={newServer.fhirVersion}
                  onValueChange={(v) => setNewServer({ ...newServer, fhirVersion: v as "R4" | "STU3" | "DSTU2" })}
                >
                  <SelectTrigger data-testid="select-fhir-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R4">FHIR R4</SelectItem>
                    <SelectItem value="STU3">FHIR STU3</SelectItem>
                    <SelectItem value="DSTU2">FHIR DSTU2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Authentication</Label>
                <Select
                  value={newServer.authMethod}
                  onValueChange={(v) => setNewServer({ ...newServer, authMethod: v as "none" | "basic" | "bearer" })}
                >
                  <SelectTrigger data-testid="select-auth-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Public)</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddServer(false)}>Cancel</Button>
              <Button 
                data-testid="button-confirm-add-server"
                onClick={() => addServerMutation.mutate(newServer)}
                disabled={!newServer.name || !newServer.baseUrl}
              >
                Add Server
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected Servers</p>
                <p className="text-2xl font-bold" data-testid="text-connected-count">
                  {servers.filter(s => s.status === "connected").length}
                </p>
              </div>
              <Server className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">US Core Profiles</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Data Exchanges</p>
                <p className="text-2xl font-bold">{exchanges.length}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resources Synced</p>
                <p className="text-2xl font-bold">
                  {exchanges.reduce((sum, e) => sum + e.resourceCount, 0)}
                </p>
              </div>
              <Database className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="servers" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="servers" data-testid="tab-servers">
            <Server className="w-4 h-4 mr-2" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="smart" data-testid="tab-smart">
            <Shield className="w-4 h-4 mr-2" />
            SMART Launch
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="w-4 h-4 mr-2" />
            FHIR Search
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileText className="w-4 h-4 mr-2" />
            US Core Profiles
          </TabsTrigger>
          <TabsTrigger value="outbound" data-testid="tab-outbound">
            <Upload className="w-4 h-4 mr-2" />
            Outbound API
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Config
          </TabsTrigger>
          <TabsTrigger value="exchanges" data-testid="tab-exchanges">
            <Zap className="w-4 h-4 mr-2" />
            Data Exchange
          </TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <Layers className="w-4 h-4 mr-2" />
            Custom Mappings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="space-y-4">
          {serversLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : servers.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold">No FHIR Servers Configured</h3>
                <p className="text-muted-foreground mt-2">Add an external FHIR server to start exchanging health data</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.map(server => (
                <Card key={server.id} data-testid={`card-server-${server.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {server.name}
                          {server.isTestServer && (
                            <Badge variant="outline" className="text-xs">Test</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {server.baseUrl}
                        </CardDescription>
                      </div>
                      <StatusBadge status={server.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Version:</span>
                        <Badge variant="secondary">{server.fhirVersion}</Badge>
                        <span className="text-muted-foreground">Auth:</span>
                        <Badge variant="outline">{server.authMethod}</Badge>
                      </div>
                      {server.supportedResources.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Supported Resources ({server.supportedResources.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {server.supportedResources.slice(0, 5).map(r => (
                              <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                            ))}
                            {server.supportedResources.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{server.supportedResources.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {server.lastConnectedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last connected: {new Date(server.lastConnectedAt).toLocaleString()}
                        </p>
                      )}
                      {server.errorMessage && (
                        <p className="text-xs text-destructive">{server.errorMessage}</p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-test-${server.id}`}
                          onClick={() => testConnectionMutation.mutate(server.id)}
                          disabled={testConnectionMutation.isPending}
                        >
                          <Plug className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedServer(server.id)}
                        >
                          <Search className="w-4 h-4 mr-1" />
                          Query
                        </Button>
                        {!server.isTestServer && (
                          <Button size="sm" variant="ghost">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                SMART on FHIR App Launch
              </CardTitle>
              <CardDescription>
                OAuth 2.0 + PKCE authorization for secure EHR integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Register SMART App</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Client ID</Label>
                      <Input 
                        placeholder="your-smart-app-client-id" 
                        data-testid="input-smart-client-id"
                      />
                    </div>
                    <div>
                      <Label>FHIR Server Base URL</Label>
                      <Input 
                        placeholder="https://fhir.example.org/r4" 
                        data-testid="input-smart-fhir-url"
                      />
                    </div>
                    <div>
                      <Label>Redirect URI</Label>
                      <Input 
                        placeholder={typeof window !== "undefined" ? `${window.location.origin}/smart/callback` : "/smart/callback"}
                        data-testid="input-smart-redirect"
                      />
                    </div>
                    <div>
                      <Label>Scopes</Label>
                      <Input 
                        placeholder="openid fhirUser launch/patient patient/*.read" 
                        data-testid="input-smart-scopes"
                      />
                    </div>
                    <Button className="w-full" data-testid="btn-register-smart-app">
                      <Plus className="w-4 h-4 mr-2" />
                      Register App Configuration
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">SMART Launch Types</h4>
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded">
                            <Globe className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h5 className="font-medium">Standalone Launch</h5>
                            <p className="text-sm text-muted-foreground">
                              Patient authorizes app directly from patient portal
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded">
                            <Database className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h5 className="font-medium">EHR Launch</h5>
                            <p className="text-sm text-muted-foreground">
                              Launched from within EHR with context (patient, encounter)
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-2">Supported Features</h5>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">OAuth 2.0</Badge>
                      <Badge variant="outline">PKCE (S256)</Badge>
                      <Badge variant="outline">Refresh Tokens</Badge>
                      <Badge variant="outline">Launch Context</Badge>
                      <Badge variant="outline">FHIR Scopes</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                FHIR Resource Search
              </CardTitle>
              <CardDescription>
                Query external FHIR servers using standard search parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Server</Label>
                  <Select value={selectedServer || ""} onValueChange={setSelectedServer}>
                    <SelectTrigger data-testid="select-search-server">
                      <SelectValue placeholder="Select server" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers.filter(s => s.status === "connected").map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Resource Type</Label>
                  <Select value={searchResourceType} onValueChange={setSearchResourceType}>
                    <SelectTrigger data-testid="select-resource-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedResources.map(r => (
                        <SelectItem key={r.type} value={r.type}>
                          {r.type} {r.usCore && "(US Core)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    data-testid="button-execute-search"
                    onClick={() => {
                      if (selectedServer) {
                        searchMutation.mutate({
                          serverId: selectedServer,
                          resourceType: searchResourceType,
                          params: searchParams,
                        });
                      }
                    }}
                    disabled={!selectedServer || searchMutation.isPending}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Execute Search
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Search Parameters for {searchResourceType}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchParamsList.slice(0, 9).map(param => (
                    <div key={param.name}>
                      <Label className="text-xs">{param.name} ({param.type})</Label>
                      <Input
                        size={1}
                        placeholder={param.description}
                        value={searchParams[param.name] || ""}
                        onChange={(e) => setSearchParams({ ...searchParams, [param.name]: e.target.value })}
                        data-testid={`input-param-${param.name}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {searchMutation.data && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Search Results</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Found {(searchMutation.data as any).data?.total || (searchMutation.data as any).data?.entries?.length || 0} resources
                  </p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {((searchMutation.data as any).data?.entries || []).slice(0, 10).map((entry: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{entry.resource?.resourceType}</p>
                              <p className="text-xs text-muted-foreground">{entry.resource?.id}</p>
                            </div>
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                US Core Implementation Guide Profiles
              </CardTitle>
              <CardDescription>
                FHIR R4 profiles conforming to US Core 6.0.0 for USCDI compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "Patient", desc: "Demographics and identifiers", status: "active" },
                  { name: "Observation", desc: "Labs, vitals, and clinical observations", status: "active" },
                  { name: "Condition", desc: "Problems and diagnoses", status: "active" },
                  { name: "MedicationRequest", desc: "Medication orders and prescriptions", status: "active" },
                  { name: "AllergyIntolerance", desc: "Allergy and intolerance records", status: "active" },
                  { name: "Procedure", desc: "Surgical and therapeutic procedures", status: "active" },
                  { name: "Immunization", desc: "Vaccination history", status: "active" },
                  { name: "DiagnosticReport", desc: "Laboratory and imaging reports", status: "active" },
                  { name: "CarePlan", desc: "Treatment and care plans", status: "active" },
                  { name: "Goal", desc: "Patient health goals", status: "active" },
                  { name: "Encounter", desc: "Healthcare visits", status: "active" },
                  { name: "DocumentReference", desc: "Clinical documents", status: "active" },
                ].map(profile => (
                  <Card key={profile.name} data-testid={`card-profile-${profile.name}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{profile.name}</h4>
                        <Badge variant="default" className="text-xs">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.desc}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        US Core 6.0.0
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Outbound FHIR API
              </CardTitle>
              <CardDescription>
                Push data to external FHIR servers with US Core compliance validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Push Vital Signs</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Target Server</Label>
                      <Select>
                        <SelectTrigger data-testid="select-outbound-server">
                          <SelectValue placeholder="Select connected server" />
                        </SelectTrigger>
                        <SelectContent>
                          {servers.filter(s => s.status === "connected").map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Vital Type</Label>
                      <Select>
                        <SelectTrigger data-testid="select-vital-type">
                          <SelectValue placeholder="Select vital type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blood-pressure">Blood Pressure</SelectItem>
                          <SelectItem value="heart-rate">Heart Rate</SelectItem>
                          <SelectItem value="body-temperature">Body Temperature</SelectItem>
                          <SelectItem value="respiratory-rate">Respiratory Rate</SelectItem>
                          <SelectItem value="pulse-oximetry">Pulse Oximetry</SelectItem>
                          <SelectItem value="body-weight">Body Weight</SelectItem>
                          <SelectItem value="body-height">Body Height</SelectItem>
                          <SelectItem value="bmi">BMI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Value</Label>
                        <Input type="number" placeholder="120" data-testid="input-vital-value" />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <Input placeholder="mmHg" data-testid="input-vital-unit" />
                      </div>
                    </div>
                    <Button className="w-full" data-testid="btn-push-vital">
                      <Upload className="w-4 h-4 mr-2" />
                      Push to External Server
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Supported Operations</h4>
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-500/10 rounded">
                            <Plus className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h5 className="font-medium">Create Resource</h5>
                            <p className="text-sm text-muted-foreground">
                              POST new FHIR resources with US Core validation
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-500/10 rounded">
                            <RefreshCw className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h5 className="font-medium">Update Resource</h5>
                            <p className="text-sm text-muted-foreground">
                              PUT updates to existing resources
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-500/10 rounded">
                            <Zap className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h5 className="font-medium">Transaction Bundle</h5>
                            <p className="text-sm text-muted-foreground">
                              Atomic batch operations for multiple resources
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-2">US Core Profiles</h5>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Patient</Badge>
                      <Badge variant="outline">Observation</Badge>
                      <Badge variant="outline">Condition</Badge>
                      <Badge variant="outline">MedicationRequest</Badge>
                      <Badge variant="outline">CarePlan</Badge>
                      <Badge variant="outline">Goal</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Bidirectional Sync Configuration
              </CardTitle>
              <CardDescription>
                Configure automatic data synchronization with external FHIR servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">2</div>
                      <p className="text-sm text-muted-foreground">Sync Configurations</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">1</div>
                      <p className="text-sm text-muted-foreground">Active Syncs</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">8</div>
                      <p className="text-sm text-muted-foreground">US Core Profiles</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Sync Configurations</h4>
                  <Button size="sm" data-testid="btn-add-sync-config">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Configuration
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">Primary EHR Sync</h5>
                            <Badge variant="default">Active</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Sync vitals and care plans with primary EHR system
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">Observation</Badge>
                            <Badge variant="outline">CarePlan</Badge>
                            <Badge variant="outline">Goal</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Direction: Push</span>
                            <span>Frequency: Realtime</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" data-testid="btn-sync-now-1">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync Now
                          </Button>
                          <Button size="sm" variant="ghost" data-testid="btn-edit-sync-1">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">Health Network Exchange</h5>
                            <Badge variant="secondary">Disabled</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Bidirectional sync with regional health information exchange
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">Patient</Badge>
                            <Badge variant="outline">Condition</Badge>
                            <Badge variant="outline">MedicationRequest</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Direction: Bidirectional</span>
                            <span>Frequency: Hourly</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled data-testid="btn-sync-now-2">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync Now
                          </Button>
                          <Button size="sm" variant="ghost" data-testid="btn-edit-sync-2">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Supported Resource Types</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {["Patient", "Observation", "Condition", "MedicationRequest", "CarePlan", "Goal", "Procedure", "Immunization"].map(type => (
                      <div key={type} className="flex items-center gap-2 p-2 border rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Sync Validation</h4>
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <span className="font-medium">US Core Profile Validation</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All resources are validated against US Core profiles before syncing to external servers
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Required field validation</li>
                      <li>Code system binding checks</li>
                      <li>Must-support field warnings</li>
                      <li>HIPAA audit logging</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exchanges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Data Exchange History
              </CardTitle>
              <CardDescription>
                Track imports and exports with external FHIR servers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exchanges.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold">No Data Exchanges Yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Import or export patient data to see exchange history
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exchanges.map(exchange => (
                    <Card key={exchange.id} data-testid={`card-exchange-${exchange.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {exchange.direction === "import" ? (
                              <Download className="w-5 h-5 text-blue-500" />
                            ) : (
                              <Upload className="w-5 h-5 text-green-500" />
                            )}
                            <div>
                              <p className="font-medium">
                                {exchange.direction === "import" ? "Import" : "Export"}: {exchange.resourceType}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {exchange.resourceCount} resources - {new Date(exchange.startedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={exchange.status} />
                        </div>
                        {exchange.errorMessage && (
                          <p className="text-sm text-destructive mt-2">{exchange.errorMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <FHIRMappingDesigner />
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center">
            This platform implements FHIR R4 with US Core 6.0.0 profiles for USCDI compliance. 
            All data exchanges are logged for HIPAA audit requirements. 
            This system is for health information management purposes only and does not provide clinical decision support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
