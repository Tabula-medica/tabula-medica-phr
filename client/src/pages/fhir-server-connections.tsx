import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Server, 
  Link2, 
  Link2Off, 
  RefreshCw, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Activity,
  Plus,
  Trash2,
  Play,
  Pause,
  Shield,
  Database,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  Loader2,
  FileCheck,
  AlertCircle,
  Info,
  Zap,
  History,
} from "lucide-react";

type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error" | "testing";
type SyncDirection = "import" | "export" | "bidirectional";
type ResourceType = "Patient" | "Observation" | "Condition" | "MedicationRequest" | "Procedure" | "Encounter" | "AllergyIntolerance" | "Immunization" | "DiagnosticReport" | "CarePlan";

interface FHIRServerConnection {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: "R4" | "R5" | "STU3";
  authType: string;
  status: ConnectionStatus;
  lastConnected?: string;
  lastSynced?: string;
  syncConfig: {
    direction: SyncDirection;
    resourceTypes: ResourceType[];
    schedule: string;
    enabled: boolean;
  };
  metadata: {
    vendor?: string;
    serverVersion?: string;
    supportedResources: ResourceType[];
  };
}

interface SyncJob {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  status: string;
  startedAt: string;
  completedAt?: string;
  progress: number;
  totalResources: number;
  processedResources: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    id: string;
    resourceType: string;
    resourceId?: string;
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
    resolved: boolean;
  }>;
}

interface IntegrationStats {
  totalConnections: number;
  activeConnections: number;
  totalSyncs: number;
  successfulSyncs: number;
  totalResourcesSynced: number;
  errorRate: number;
  lastSyncTime?: string;
}

const ALL_RESOURCE_TYPES: ResourceType[] = [
  "Patient", "Observation", "Condition", "MedicationRequest", "Procedure", 
  "Encounter", "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan"
];

export default function FHIRServerConnections() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connections");
  const [showNewConnectionDialog, setShowNewConnectionDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showImportExportDialog, setShowImportExportDialog] = useState<"import" | "export" | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<FHIRServerConnection | null>(null);
  const [activeSyncJob, setActiveSyncJob] = useState<SyncJob | null>(null);
  const [selectedResources, setSelectedResources] = useState<ResourceType[]>(["Patient", "Observation"]);

  const [newConnection, setNewConnection] = useState({
    name: "",
    baseUrl: "",
    fhirVersion: "R4" as "R4" | "R5" | "STU3",
    authType: "none",
  });

  const { data: stats } = useQuery<IntegrationStats>({
    queryKey: ["/api/fhir-integration/stats"],
  });

  const { data: connections, isLoading: connectionsLoading } = useQuery<FHIRServerConnection[]>({
    queryKey: ["/api/fhir-integration/connections"],
  });

  const { data: syncHistory } = useQuery<SyncJob[]>({
    queryKey: ["/api/fhir-integration/sync/history"],
  });

  const { data: currentSyncJob } = useQuery<SyncJob>({
    queryKey: ["/api/fhir-integration/sync/job", activeSyncJob?.id],
    enabled: !!activeSyncJob && activeSyncJob.status === "syncing",
    refetchInterval: activeSyncJob?.status === "syncing" ? 1000 : false,
  });

  useEffect(() => {
    if (currentSyncJob && currentSyncJob.status !== "syncing") {
      setActiveSyncJob(currentSyncJob);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/stats"] });
    }
  }, [currentSyncJob]);

  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("POST", `/api/fhir-integration/connections/${connectionId}/test`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/stats"] });
      if (data.success) {
        toast({ title: "Connection successful!", description: `Latency: ${data.latencyMs}ms` });
      } else {
        toast({ title: "Connection failed", description: data.errors?.join(", ") || "Unknown error", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to test connection", variant: "destructive" });
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (connectionData: any) => {
      return apiRequest("POST", "/api/fhir-integration/connections", connectionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/stats"] });
      setShowNewConnectionDialog(false);
      setNewConnection({ name: "", baseUrl: "", fhirVersion: "R4", authType: "none" });
      toast({ title: "Connection created!", description: "Test the connection to verify settings" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create connection", variant: "destructive" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("DELETE", `/api/fhir-integration/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/stats"] });
      toast({ title: "Connection deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete connection", variant: "destructive" });
    },
  });

  const startSyncMutation = useMutation({
    mutationFn: async (params: { connectionId: string; direction?: SyncDirection; resourceTypes?: ResourceType[] }): Promise<SyncJob> => {
      return apiRequest("POST", "/api/fhir-integration/sync/start", params) as Promise<SyncJob>;
    },
    onSuccess: (data: SyncJob) => {
      setActiveSyncJob(data);
      setShowSyncDialog(false);
      toast({ title: "Sync started", description: `Syncing ${data.totalResources} resources` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start sync", variant: "destructive" });
    },
  });

  const cancelSyncMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/fhir-integration/sync/job/${jobId}/cancel`);
    },
    onSuccess: () => {
      setActiveSyncJob(null);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/sync/history"] });
      toast({ title: "Sync cancelled" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (params: { connectionId: string; resourceTypes: ResourceType[] }) => {
      return apiRequest("POST", "/api/fhir-integration/import", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/operations"] });
      setShowImportExportDialog(null);
      toast({ title: "Import started", description: "Data import is in progress" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (params: { connectionId: string; resourceTypes: ResourceType[] }) => {
      return apiRequest("POST", "/api/fhir-integration/export", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/operations"] });
      setShowImportExportDialog(null);
      toast({ title: "Export started", description: "Data export is in progress" });
    },
  });

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case "connected": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "disconnected": return <Link2Off className="h-4 w-4 text-muted-foreground" />;
      case "connecting": 
      case "testing": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    const variants: Record<ConnectionStatus, "default" | "secondary" | "destructive" | "outline"> = {
      connected: "default",
      disconnected: "secondary",
      connecting: "outline",
      testing: "outline",
      error: "destructive",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getDirectionIcon = (direction: SyncDirection) => {
    switch (direction) {
      case "import": return <ArrowDown className="h-4 w-4" />;
      case "export": return <ArrowUp className="h-4 w-4" />;
      case "bidirectional": return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const handleCreateConnection = () => {
    if (!newConnection.name || !newConnection.baseUrl) {
      toast({ title: "Missing fields", description: "Name and URL are required", variant: "destructive" });
      return;
    }
    createConnectionMutation.mutate(newConnection);
  };

  const handleStartSync = () => {
    if (!selectedConnection) return;
    startSyncMutation.mutate({
      connectionId: selectedConnection.id,
      resourceTypes: selectedResources,
    });
  };

  const handleImportExport = () => {
    if (!selectedConnection || !showImportExportDialog) return;
    if (showImportExportDialog === "import") {
      importMutation.mutate({ connectionId: selectedConnection.id, resourceTypes: selectedResources });
    } else {
      exportMutation.mutate({ connectionId: selectedConnection.id, resourceTypes: selectedResources });
    }
  };

  const toggleResourceSelection = (resource: ResourceType) => {
    setSelectedResources(prev => 
      prev.includes(resource) 
        ? prev.filter(r => r !== resource)
        : [...prev, resource]
    );
  };

  if (connectionsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">FHIR Server Connections</h1>
        <p className="text-muted-foreground mt-1">Connect to external FHIR servers for seamless data synchronization</p>
      </div>

      {activeSyncJob && activeSyncJob.status === "syncing" && (
        <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
          <Activity className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Sync in Progress
            <Loader2 className="h-4 w-4 animate-spin" />
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Processing {currentSyncJob?.processedResources || 0} of {activeSyncJob.totalResources} resources</span>
                <span>{currentSyncJob?.progress || 0}%</span>
              </div>
              <Progress value={currentSyncJob?.progress || 0} className="h-2" />
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-green-600">Success: {currentSyncJob?.successCount || 0}</span>
                <span className="text-red-600">Errors: {currentSyncJob?.errorCount || 0}</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={() => cancelSyncMutation.mutate(activeSyncJob.id)}
              data-testid="button-cancel-sync"
            >
              <Pause className="h-4 w-4 mr-1" />
              Cancel Sync
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="hover-elevate" data-testid="card-stat-connections">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Connections</p>
                  <p className="text-2xl font-bold">{stats.activeConnections} / {stats.totalConnections}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Link2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-syncs">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful Syncs</p>
                  <p className="text-2xl font-bold">{stats.successfulSyncs} / {stats.totalSyncs}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-resources">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resources Synced</p>
                  <p className="text-2xl font-bold">{stats.totalResourcesSynced.toLocaleString()}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-errors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold">{stats.errorRate.toFixed(1)}%</p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.errorRate < 5 ? "bg-green-500/10" : stats.errorRate < 10 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.errorRate < 5 ? "text-green-500" : stats.errorRate < 10 ? "text-yellow-500" : "text-red-500"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="connections" data-testid="button-tab-connections">
            <Server className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="button-tab-sync">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="button-tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">FHIR Server Connections</h2>
            <Button onClick={() => setShowNewConnectionDialog(true)} data-testid="button-new-connection">
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </div>

          <div className="grid gap-4">
            {connections?.map((connection) => (
              <Card key={connection.id} className="hover-elevate" data-testid={`card-connection-${connection.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                        <Server className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">{connection.name}</h3>
                          {getStatusBadge(connection.status)}
                          <Badge variant="outline">{connection.fhirVersion}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 break-all">{connection.baseUrl}</p>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          {connection.metadata.vendor && (
                            <span className="text-muted-foreground">Vendor: {connection.metadata.vendor}</span>
                          )}
                          {connection.lastSynced && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last sync: {new Date(connection.lastSynced).toLocaleString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {getDirectionIcon(connection.syncConfig.direction)}
                            <span className="capitalize">{connection.syncConfig.direction}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => testConnectionMutation.mutate(connection.id)}
                        disabled={testConnectionMutation.isPending}
                        data-testid={`button-test-${connection.id}`}
                      >
                        {testConnectionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        <span className="ml-1">Test</span>
                      </Button>

                      {connection.status === "connected" && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => { setSelectedConnection(connection); setShowImportExportDialog("import"); }}
                            data-testid={`button-import-${connection.id}`}
                          >
                            <Download className="h-4 w-4" />
                            <span className="ml-1">Import</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => { setSelectedConnection(connection); setShowImportExportDialog("export"); }}
                            data-testid={`button-export-${connection.id}`}
                          >
                            <Upload className="h-4 w-4" />
                            <span className="ml-1">Export</span>
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => { setSelectedConnection(connection); setShowSyncDialog(true); }}
                            data-testid={`button-sync-${connection.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span className="ml-1">Sync</span>
                          </Button>
                        </>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteConnectionMutation.mutate(connection.id)}
                        data-testid={`button-delete-${connection.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {connection.syncConfig.enabled && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-6 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>Auth: {connection.authType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Schedule: {connection.syncConfig.schedule}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {connection.syncConfig.resourceTypes.slice(0, 4).map((rt) => (
                            <Badge key={rt} variant="secondary" className="text-xs">{rt}</Badge>
                          ))}
                          {connection.syncConfig.resourceTypes.length > 4 && (
                            <Badge variant="secondary" className="text-xs">+{connection.syncConfig.resourceTypes.length - 4}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {(!connections || connections.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Connections Yet</h3>
                  <p className="text-muted-foreground mb-4">Add your first FHIR server connection to start syncing data</p>
                  <Button onClick={() => setShowNewConnectionDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sync">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-sync-overview">
              <CardHeader>
                <CardTitle>Data Synchronization</CardTitle>
                <CardDescription>Sync data between Tabula Medica and external FHIR servers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      Bidirectional Sync
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Keep your records in sync with external EHR systems. Changes are merged intelligently with conflict resolution.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Real-time change detection</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Automatic conflict resolution</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Data validation before sync</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Download className="h-4 w-4 text-blue-500" />
                        Import
                      </h4>
                      <p className="text-sm text-muted-foreground">Pull data from external FHIR servers into your records</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Upload className="h-4 w-4 text-green-500" />
                        Export
                      </h4>
                      <p className="text-sm text-muted-foreground">Push your local records to external FHIR servers</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-quick-sync">
              <CardHeader>
                <CardTitle>Quick Sync</CardTitle>
                <CardDescription>Start a sync with a connected server</CardDescription>
              </CardHeader>
              <CardContent>
                {connections?.filter(c => c.status === "connected").length ? (
                  <div className="space-y-3">
                    {connections.filter(c => c.status === "connected").map((conn) => (
                      <div key={conn.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(conn.status)}
                          <div>
                            <p className="font-medium">{conn.name}</p>
                            <p className="text-xs text-muted-foreground">{conn.syncConfig.resourceTypes.length} resource types</p>
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => { setSelectedConnection(conn); setShowSyncDialog(true); }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Sync Now
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2Off className="h-8 w-8 mx-auto mb-2" />
                    <p>No active connections available</p>
                    <Button variant="ghost" onClick={() => setActiveTab("connections")}>
                      Go to Connections
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card data-testid="card-sync-history">
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>View past synchronization jobs and their results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncHistory?.map((job) => {
                  const connection = connections?.find(c => c.id === job.connectionId);
                  return (
                    <div key={job.id} className="flex items-center justify-between p-4 rounded-lg border flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          job.status === "completed" ? "bg-green-500/10" :
                          job.status === "failed" ? "bg-red-500/10" :
                          "bg-yellow-500/10"
                        }`}>
                          {job.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : job.status === "failed" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{connection?.name || "Unknown"}</p>
                            <Badge variant="outline" className="capitalize">{job.direction}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(job.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-wrap">
                        <div className="text-right">
                          <p className="text-sm font-medium">{job.processedResources} / {job.totalResources}</p>
                          <p className="text-xs text-muted-foreground">Resources</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">{job.successCount}</p>
                          <p className="text-xs text-muted-foreground">Success</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">{job.errorCount}</p>
                          <p className="text-xs text-muted-foreground">Errors</p>
                        </div>
                        {job.errorCount > 0 && (
                          <Button variant="outline" size="sm" data-testid={`button-view-errors-${job.id}`}>
                            View Errors
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!syncHistory || syncHistory.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2" />
                    <p>No sync history available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showNewConnectionDialog} onOpenChange={setShowNewConnectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add FHIR Connection</DialogTitle>
            <DialogDescription>Connect to an external FHIR server</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Connection Name *</Label>
              <Input 
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                placeholder="e.g., Production Server"
                data-testid="input-connection-name"
              />
            </div>
            <div>
              <Label>FHIR Server URL *</Label>
              <Input 
                value={newConnection.baseUrl}
                onChange={(e) => setNewConnection({ ...newConnection, baseUrl: e.target.value })}
                placeholder="https://fhir.example.com/r4"
                data-testid="input-connection-url"
              />
            </div>
            <div>
              <Label>FHIR Version</Label>
              <Select 
                value={newConnection.fhirVersion} 
                onValueChange={(v) => setNewConnection({ ...newConnection, fhirVersion: v as any })}
              >
                <SelectTrigger data-testid="select-fhir-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R4">FHIR R4</SelectItem>
                  <SelectItem value="R5">FHIR R5</SelectItem>
                  <SelectItem value="STU3">FHIR STU3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Authentication Type</Label>
              <Select 
                value={newConnection.authType} 
                onValueChange={(v) => setNewConnection({ ...newConnection, authType: v })}
              >
                <SelectTrigger data-testid="select-auth-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Authentication</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                  <SelectItem value="smart">SMART on FHIR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConnectionDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateConnection} disabled={createConnectionMutation.isPending} data-testid="button-create-connection">
              {createConnectionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Synchronization</DialogTitle>
            <DialogDescription>
              {selectedConnection?.name} - Select resources to sync
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Resource Types</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {(selectedConnection?.metadata.supportedResources || ALL_RESOURCE_TYPES).map((rt) => (
                  <div key={rt} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sync-${rt}`}
                      checked={selectedResources.includes(rt)}
                      onCheckedChange={() => toggleResourceSelection(rt)}
                      data-testid={`checkbox-resource-${rt}`}
                    />
                    <label htmlFor={`sync-${rt}`} className="text-sm cursor-pointer">{rt}</label>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sync will {selectedConnection?.syncConfig.direction === "bidirectional" ? "import and export" : selectedConnection?.syncConfig.direction} {selectedResources.length} resource types
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleStartSync} 
              disabled={startSyncMutation.isPending || selectedResources.length === 0}
              data-testid="button-start-sync"
            >
              {startSyncMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showImportExportDialog} onOpenChange={() => setShowImportExportDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showImportExportDialog === "import" ? "Import Data" : "Export Data"}</DialogTitle>
            <DialogDescription>
              {showImportExportDialog === "import" 
                ? `Pull data from ${selectedConnection?.name}`
                : `Push data to ${selectedConnection?.name}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Resource Types</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {(selectedConnection?.metadata.supportedResources || ALL_RESOURCE_TYPES).map((rt) => (
                  <div key={rt} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`ie-${rt}`}
                      checked={selectedResources.includes(rt)}
                      onCheckedChange={() => toggleResourceSelection(rt)}
                    />
                    <label htmlFor={`ie-${rt}`} className="text-sm cursor-pointer">{rt}</label>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <FileCheck className="h-4 w-4" />
              <AlertDescription>
                {showImportExportDialog === "import" 
                  ? "Data will be validated before importing to ensure FHIR compliance"
                  : "Data will be validated and transformed to match the target server's requirements"
                }
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportExportDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleImportExport} 
              disabled={importMutation.isPending || exportMutation.isPending || selectedResources.length === 0}
              data-testid={`button-confirm-${showImportExportDialog}`}
            >
              {(importMutation.isPending || exportMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {showImportExportDialog === "import" ? (
                <><Download className="h-4 w-4 mr-2" /> Start Import</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Start Export</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
