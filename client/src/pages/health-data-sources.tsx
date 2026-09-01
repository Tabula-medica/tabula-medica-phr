import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Apple, Watch, Activity, Building2, Shield, Server, Search, 
  RefreshCw, Link2, Unlink, CheckCircle2, XCircle, Clock, 
  AlertTriangle, Upload, Scale, Moon, Zap, Heart, Footprints,
  Loader2, Plus, Settings, Info, ExternalLink
} from "lucide-react";

const PATIENT_ID = "patient-001";

interface DataSourceInfo {
  id: string;
  name: string;
  description: string;
  category: "wearable" | "health_app" | "ehr";
  icon: string;
  scopes: string[];
  authType: "oauth2" | "file_import" | "smart_on_fhir";
  requiresApiKey: boolean;
}

interface IntegrationConnection {
  id: string;
  patientId: string;
  source: string;
  status: "pending" | "connected" | "disconnected" | "error" | "expired";
  displayName?: string;
  scopes: string[];
  lastSyncAt?: string;
  tokenExpiresAt?: string;
  consentGrantedAt?: string;
  consentVersion?: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Apple: Apple,
  Watch: Watch,
  Activity: Activity,
  Building2: Building2,
  Shield: Shield,
  Server: Server,
  Scale: Scale,
  Moon: Moon,
  Zap: Zap,
};

function getIcon(iconName: string) {
  return ICON_MAP[iconName] || Activity;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "connected":
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
    case "expired":
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
    default:
      return <Badge variant="outline"><Unlink className="w-3 h-3 mr-1" />Disconnected</Badge>;
  }
}

export default function HealthDataSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSourceInfo | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [customFhirDialogOpen, setCustomFhirDialogOpen] = useState(false);
  const [customFhirConfig, setCustomFhirConfig] = useState({
    serverUrl: "",
    serverName: "",
    authType: "none" as "none" | "api_key" | "basic" | "oauth2",
    apiKey: "",
    apiKeyHeader: "Authorization",
    basicUsername: "",
    basicPassword: "",
  });
  const [fileImportDialogOpen, setFileImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ success: boolean; data: DataSourceInfo[]; categories: Category[] }>({
    queryKey: ["/api/health-data-sources"],
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery<{ success: boolean; data: IntegrationConnection[] }>({
    queryKey: ["/api/integration-connections", PATIENT_ID],
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: { patientId: string; source: string; scopes: string[]; displayName?: string }) => {
      const res = await apiRequest("POST", "/api/integration-connections", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
      setConnectDialogOpen(false);
      
      if (selectedSource?.authType === "oauth2") {
        toast({ title: "Connection initiated", description: "Completing authorization..." });
        simulateOAuthFlow(data.data.id);
      } else if (selectedSource?.authType === "file_import") {
        setPendingConnectionId(data.data.id);
        setFileImportDialogOpen(true);
        toast({ title: "Connection created", description: "Please upload your health data export file." });
      } else if (selectedSource?.authType === "smart_on_fhir") {
        toast({ title: "Connection initiated", description: "Connecting via Fasten Health..." });
        simulateSmartOnFhirFlow(data.data.id);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create connection", variant: "destructive" });
    },
  });

  const syncConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integration-connections/${connectionId}/sync?patientId=${PATIENT_ID}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
      toast({ 
        title: "Sync complete", 
        description: `Imported ${data.data.recordsImported} records from ${data.data.source}` 
      });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not sync data", variant: "destructive" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("DELETE", `/api/integration-connections/${connectionId}?patientId=${PATIENT_ID}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
      toast({ title: "Disconnected", description: "Data source has been disconnected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disconnect", variant: "destructive" });
    },
  });

  const simulateOAuthFlow = async (connectionId: string) => {
    setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/integration-connections/${connectionId}/oauth-callback`, { code: "simulated_auth_code" });
        queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
        toast({ title: "Connected", description: "Authorization successful! (Preview mode)" });
      } catch (error) {
        toast({ title: "Connection failed", description: "Could not complete authorization", variant: "destructive" });
      }
    }, 1500);
  };

  const simulateSmartOnFhirFlow = async (connectionId: string) => {
    setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/integration-connections/${connectionId}/oauth-callback`, { code: "smart_fhir_auth_code" });
        queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
        toast({ title: "Connected", description: "Fasten Health authorization successful! (Preview mode)" });
      } catch (error) {
        toast({ title: "Connection failed", description: "Could not complete Fasten Health authorization", variant: "destructive" });
      }
    }, 2000);
  };

  const handleFileImport = async () => {
    if (!pendingConnectionId || !selectedFile) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result;
        await apiRequest("POST", `/api/integration-connections/${pendingConnectionId}/import`, {
          fileData,
          fileName: selectedFile.name,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
        toast({ title: "Import successful", description: `Imported data from ${selectedFile.name}` });
        setFileImportDialogOpen(false);
        setSelectedFile(null);
        setPendingConnectionId(null);
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      toast({ title: "Import failed", description: "Could not import health data file", variant: "destructive" });
    }
  };

  const handleConnect = (source: DataSourceInfo) => {
    if (source.id === "custom_fhir") {
      setCustomFhirDialogOpen(true);
    } else {
      setSelectedSource(source);
      setSelectedScopes(source.scopes);
      setConnectDialogOpen(true);
    }
  };

  const handleConfirmConnect = () => {
    if (!selectedSource) return;
    createConnectionMutation.mutate({
      patientId: PATIENT_ID,
      source: selectedSource.id,
      scopes: selectedScopes,
      displayName: selectedSource.name,
    });
  };

  const handleCustomFhirConnect = async () => {
    try {
      const testRes = await apiRequest("POST", "/api/custom-fhir/test-connection", customFhirConfig);
      const testResult = await testRes.json();

      if (testResult.success) {
        await apiRequest("POST", "/api/custom-fhir/connections", { patientId: PATIENT_ID, config: customFhirConfig });
        queryClient.invalidateQueries({ queryKey: ["/api/integration-connections", PATIENT_ID] });
        toast({ title: "Connected", description: `Connected to ${customFhirConfig.serverName}` });
        setCustomFhirDialogOpen(false);
        setCustomFhirConfig({ serverUrl: "", serverName: "", authType: "none", apiKey: "", apiKeyHeader: "Authorization", basicUsername: "", basicPassword: "" });
      }
    } catch (error) {
      toast({ title: "Connection failed", description: "Could not connect to FHIR server", variant: "destructive" });
    }
  };

  const sources = sourcesData?.data || [];
  const categories = sourcesData?.categories || [];
  const connections = connectionsData?.data || [];

  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         source.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || source.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getConnectionForSource = (sourceId: string): IntegrationConnection | undefined => {
    return connections.find(c => c.source === sourceId);
  };

  const connectedSources = connections.filter(c => c.status === "connected");

  if (sourcesLoading || connectionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Health Data Sources</h1>
        <p className="text-muted-foreground">
          Connect your health apps, wearables, and medical records to get a complete view of your health.
        </p>
      </div>

      <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">Your data is protected</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                All health data is encrypted and stored securely. You control what data is shared and can disconnect at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {connectedSources.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Connected Sources ({connectedSources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connectedSources.map((connection) => {
                const sourceInfo = sources.find(s => s.id === connection.source);
                const IconComponent = sourceInfo ? getIcon(sourceInfo.icon) : Activity;
                return (
                  <Card key={connection.id} className="border-green-200 dark:border-green-800">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                            <IconComponent className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-connected-source-${connection.source}`}>
                              {connection.displayName || sourceInfo?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Last sync: {connection.lastSyncAt 
                                ? new Date(connection.lastSyncAt).toLocaleDateString()
                                : "Never"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => syncConnectionMutation.mutate(connection.id)}
                            disabled={syncConnectionMutation.isPending}
                            data-testid={`button-sync-${connection.source}`}
                          >
                            <RefreshCw className={`w-4 h-4 ${syncConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteConnectionMutation.mutate(connection.id)}
                            data-testid={`button-disconnect-${connection.source}`}
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available Data Sources</CardTitle>
          <CardDescription>Connect to import your health data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search data sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-sources"
              />
            </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="health_app" data-testid="tab-health-apps">
                  <Activity className="w-4 h-4 mr-1" />
                  Apps
                </TabsTrigger>
                <TabsTrigger value="wearable" data-testid="tab-wearables">
                  <Watch className="w-4 h-4 mr-1" />
                  Wearables
                </TabsTrigger>
                <TabsTrigger value="ehr" data-testid="tab-ehr">
                  <Building2 className="w-4 h-4 mr-1" />
                  Providers
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => {
              const connection = getConnectionForSource(source.id);
              const isConnected = connection?.status === "connected";
              const IconComponent = getIcon(source.icon);

              return (
                <Card 
                  key={source.id} 
                  className={`transition-colors ${isConnected ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30' : 'hover-elevate'}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                        <IconComponent className={`w-6 h-6 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold" data-testid={`text-source-name-${source.id}`}>{source.name}</h3>
                          {connection && getStatusBadge(connection.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{source.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {source.authType === "oauth2" ? "OAuth" : 
                             source.authType === "file_import" ? "File Import" : 
                             "Fasten Health"}
                          </Badge>
                          {source.scopes.slice(0, 2).map(scope => (
                            <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                          ))}
                          {source.scopes.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{source.scopes.length - 2}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {isConnected ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => syncConnectionMutation.mutate(connection!.id)}
                            disabled={syncConnectionMutation.isPending}
                            data-testid={`button-sync-source-${source.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${syncConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                            Sync
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteConnectionMutation.mutate(connection!.id)}
                            data-testid={`button-disconnect-source-${source.id}`}
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleConnect(source)}
                          data-testid={`button-connect-${source.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSource && (() => {
                const IconComponent = getIcon(selectedSource.icon);
                return <IconComponent className="w-5 h-5" />;
              })()}
              Connect to {selectedSource?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedSource?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <FieldCaption className="text-sm font-medium mb-2 block">Data permissions</FieldCaption>
              <p className="text-xs text-muted-foreground mb-3">
                Select what data you want to share with Tabula Medica
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedSource?.scopes.map((scope) => (
                  <div key={scope} className="flex items-center space-x-2">
                    <Checkbox aria-label="Data permissions"
                      id={scope}
                      checked={selectedScopes.includes(scope)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedScopes([...selectedScopes, scope]);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== scope));
                        }
                      }}
                    />
                    <label htmlFor={scope} className="text-sm cursor-pointer capitalize">
                      {scope.replace(/[._]/g, " ")}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                By connecting, you agree to share the selected data with Tabula Medica. 
                You can disconnect at any time from this page.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmConnect} 
              disabled={createConnectionMutation.isPending || selectedScopes.length === 0}
              data-testid="button-confirm-connect"
            >
              {createConnectionMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <>Connect<ExternalLink className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customFhirDialogOpen} onOpenChange={setCustomFhirDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Connect to Custom FHIR Server
            </DialogTitle>
            <DialogDescription>
              Connect to any FHIR R4-compliant server with your credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                placeholder="https://fhir.example.com/r4"
                value={customFhirConfig.serverUrl}
                onChange={(e) => setCustomFhirConfig({ ...customFhirConfig, serverUrl: e.target.value })}
                data-testid="input-fhir-url"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serverName">Display Name</Label>
              <Input
                id="serverName"
                placeholder="My Healthcare Provider"
                value={customFhirConfig.serverName}
                onChange={(e) => setCustomFhirConfig({ ...customFhirConfig, serverName: e.target.value })}
                data-testid="input-fhir-name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="authType">Authentication Type</Label>
              <Select 
                value={customFhirConfig.authType} 
                onValueChange={(v: any) => setCustomFhirConfig({ ...customFhirConfig, authType: v })}
              >
                <SelectTrigger data-testid="select-auth-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Authentication</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {customFhirConfig.authType === "api_key" && (
              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={customFhirConfig.apiKey}
                  onChange={(e) => setCustomFhirConfig({ ...customFhirConfig, apiKey: e.target.value })}
                  data-testid="input-api-key"
                />
              </div>
            )}

            {customFhirConfig.authType === "basic" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={customFhirConfig.basicUsername}
                    onChange={(e) => setCustomFhirConfig({ ...customFhirConfig, basicUsername: e.target.value })}
                    data-testid="input-username"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={customFhirConfig.basicPassword}
                    onChange={(e) => setCustomFhirConfig({ ...customFhirConfig, basicPassword: e.target.value })}
                    data-testid="input-password"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomFhirDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCustomFhirConnect}
              disabled={!customFhirConfig.serverUrl || !customFhirConfig.serverName}
              data-testid="button-connect-fhir"
            >
              Test & Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fileImportDialogOpen} onOpenChange={(open) => {
        setFileImportDialogOpen(open);
        if (!open) {
          setSelectedFile(null);
          setPendingConnectionId(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Health Data
            </DialogTitle>
            <DialogDescription>
              Upload your health data export file (JSON or XML format)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Drag and drop your file here, or click to browse
              </p>
              <Input
                type="file"
                accept=".json,.xml,.zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="max-w-xs mx-auto"
                data-testid="input-file-upload"
              />
              {selectedFile && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                To export from Apple Health: Open the Health app, tap your profile, 
                then tap "Export All Health Data" and share the resulting file.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFileImportDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleFileImport}
              disabled={!selectedFile}
              data-testid="button-import-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
