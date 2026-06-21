import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Stethoscope, 
  FlaskConical, 
  Pill, 
  Scan, 
  Shield, 
  Network, 
  Database,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Pause,
  Play,
  History,
  Link,
  Unlink,
  FileText,
  Activity,
  Loader2,
  Info,
  ChevronRight
} from "lucide-react";

interface DataPermission {
  dataType: string;
  canRead: boolean;
  canShare: boolean;
  autoSync: boolean;
  retentionDays?: number;
}

interface DataSourceConnection {
  id: string;
  patientId: string;
  sourceType: 'ehr' | 'clinic' | 'lab' | 'pharmacy' | 'imaging' | 'payer' | 'hie' | 'other';
  sourceName: string;
  sourceOrganization: string;
  connectionStatus: 'pending' | 'active' | 'paused' | 'error' | 'disconnected';
  protocol: 'fhir' | 'hl7v2' | 'ccda' | 'x12' | 'direct';
  endpoint?: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  dataPermissions: DataPermission[];
  credentials?: {
    type: 'oauth2' | 'api-key' | 'certificate' | 'basic';
    configured: boolean;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncEvent {
  id: string;
  connectionId: string;
  eventType: string;
  status: 'success' | 'partial' | 'failed';
  recordsProcessed?: number;
  recordsFailed?: number;
  details?: string;
  timestamp: string;
}

interface DataSourceType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface DataType {
  id: string;
  name: string;
  description: string;
}

interface Protocol {
  id: string;
  name: string;
  description: string;
}

const sourceTypeIcons: Record<string, typeof Building2> = {
  ehr: Building2,
  clinic: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
  imaging: Scan,
  payer: Shield,
  hie: Network,
  other: Database,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  disconnected: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  active: CheckCircle2,
  paused: Pause,
  error: AlertCircle,
  disconnected: XCircle,
};

const PATIENT_ID = "patient-001";

export function InteroperabilityHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connections");
  const [selectedConnection, setSelectedConnection] = useState<DataSourceConnection | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showSyncHistoryDialog, setShowSyncHistoryDialog] = useState(false);

  const [newConnection, setNewConnection] = useState({
    sourceType: '' as DataSourceConnection['sourceType'] | '',
    sourceName: '',
    sourceOrganization: '',
    protocol: '' as DataSourceConnection['protocol'] | '',
    endpoint: '',
    syncFrequency: 'daily' as DataSourceConnection['syncFrequency'],
    dataPermissions: [] as DataPermission[],
  });

  const { data: sourceTypes = [] } = useQuery<DataSourceType[]>({
    queryKey: ['/api/interoperability-hub/source-types'],
  });

  const { data: dataTypes = [] } = useQuery<DataType[]>({
    queryKey: ['/api/interoperability-hub/data-types'],
  });

  const { data: protocols = [] } = useQuery<Protocol[]>({
    queryKey: ['/api/interoperability-hub/protocols'],
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<DataSourceConnection[]>({
    queryKey: ['/api/interoperability-hub/connections', PATIENT_ID],
    queryFn: async () => {
      const response = await fetch(`/api/interoperability-hub/connections/${PATIENT_ID}`);
      if (!response.ok) throw new Error('Failed to fetch connections');
      return response.json();
    },
  });

  const { data: syncHistory = [] } = useQuery<SyncEvent[]>({
    queryKey: ['/api/interoperability-hub/connections', selectedConnection?.id, 'sync-history'],
    enabled: !!selectedConnection && showSyncHistoryDialog,
    queryFn: async () => {
      const response = await fetch(`/api/interoperability-hub/connections/${selectedConnection?.id}/sync-history`);
      if (!response.ok) throw new Error('Failed to fetch sync history');
      return response.json();
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: typeof newConnection) => {
      return apiRequest('POST', '/api/interoperability-hub/connections', {
        patientId: PATIENT_ID,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interoperability-hub/connections', PATIENT_ID] });
      setShowAddDialog(false);
      setNewConnection({
        sourceType: '',
        sourceName: '',
        sourceOrganization: '',
        protocol: '',
        endpoint: '',
        syncFrequency: 'daily',
        dataPermissions: [],
      });
      toast({
        title: "Connection Created",
        description: "Your new data source connection has been created. Please configure credentials to activate it.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create connection",
        variant: "destructive",
      });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest('DELETE', `/api/interoperability-hub/connections/${connectionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interoperability-hub/connections', PATIENT_ID] });
      toast({
        title: "Connection Removed",
        description: "The data source connection has been removed.",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest('POST', `/api/interoperability-hub/connections/${connectionId}/test`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/interoperability-hub/connections', PATIENT_ID] });
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: `Connected in ${data.latencyMs}ms`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
  });

  const syncConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest('POST', `/api/interoperability-hub/connections/${connectionId}/sync`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/interoperability-hub/connections', PATIENT_ID] });
      if (data.success) {
        toast({
          title: "Sync Complete",
          description: data.event?.details || "Data synchronized successfully",
        });
      } else {
        toast({
          title: "Sync Failed",
          description: data.event?.details || "Failed to sync data",
          variant: "destructive",
        });
      }
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ connectionId, permissions }: { connectionId: string; permissions: DataPermission[] }) => {
      return apiRequest('PATCH', `/api/interoperability-hub/connections/${connectionId}`, { dataPermissions: permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interoperability-hub/connections', PATIENT_ID] });
      setShowPermissionsDialog(false);
      toast({
        title: "Permissions Updated",
        description: "Your data sharing permissions have been updated.",
      });
    },
  });

  const toggleDataPermission = (dataTypeId: string, field: 'canRead' | 'canShare' | 'autoSync') => {
    if (!selectedConnection) return;

    const updatedPermissions = [...(selectedConnection.dataPermissions || [])];
    const existingIndex = updatedPermissions.findIndex(p => p.dataType === dataTypeId);

    if (existingIndex >= 0) {
      updatedPermissions[existingIndex] = {
        ...updatedPermissions[existingIndex],
        [field]: !updatedPermissions[existingIndex][field],
      };
    } else {
      updatedPermissions.push({
        dataType: dataTypeId,
        canRead: field === 'canRead',
        canShare: field === 'canShare',
        autoSync: field === 'autoSync',
      });
    }

    setSelectedConnection({
      ...selectedConnection,
      dataPermissions: updatedPermissions,
    });
  };

  const getPermissionValue = (dataTypeId: string, field: 'canRead' | 'canShare' | 'autoSync'): boolean => {
    const permission = selectedConnection?.dataPermissions?.find(p => p.dataType === dataTypeId);
    return permission?.[field] || false;
  };

  const renderConnectionCard = (connection: DataSourceConnection) => {
    const IconComponent = sourceTypeIcons[connection.sourceType] || Database;
    const StatusIcon = statusIcons[connection.connectionStatus];

    return (
      <Card key={connection.id} className="hover-elevate" data-testid={`card-connection-${connection.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <IconComponent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{connection.sourceName}</CardTitle>
                <CardDescription>{connection.sourceOrganization}</CardDescription>
              </div>
            </div>
            <Badge className={statusColors[connection.connectionStatus]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {connection.connectionStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Protocol:</span>
              <span className="ml-2 font-medium">{connection.protocol.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sync:</span>
              <span className="ml-2 font-medium capitalize">{connection.syncFrequency}</span>
            </div>
            {connection.lastSyncAt && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Last sync:</span>
                <span className="ml-2">{new Date(connection.lastSyncAt).toLocaleString()}</span>
              </div>
            )}
            {connection.errorMessage && (
              <div className="col-span-2 text-red-600 dark:text-red-400 text-xs">
                {connection.errorMessage}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-3">
            {connection.dataPermissions?.slice(0, 4).map(p => (
              <Badge key={p.dataType} variant="outline" className="text-xs">
                {p.dataType}
              </Badge>
            ))}
            {(connection.dataPermissions?.length || 0) > 4 && (
              <Badge variant="outline" className="text-xs">
                +{connection.dataPermissions.length - 4} more
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 pt-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => testConnectionMutation.mutate(connection.id)}
            disabled={testConnectionMutation.isPending}
            data-testid={`button-test-${connection.id}`}
          >
            {testConnectionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link className="h-4 w-4 mr-1" />
            )}
            Test
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncConnectionMutation.mutate(connection.id)}
            disabled={syncConnectionMutation.isPending || connection.connectionStatus !== 'active'}
            data-testid={`button-sync-${connection.id}`}
          >
            {syncConnectionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Sync
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedConnection(connection);
              setShowPermissionsDialog(true);
            }}
            data-testid={`button-permissions-${connection.id}`}
          >
            <Settings className="h-4 w-4 mr-1" />
            Permissions
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedConnection(connection);
              setShowSyncHistoryDialog(true);
            }}
            data-testid={`button-history-${connection.id}`}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              if (confirm('Are you sure you want to remove this connection?')) {
                deleteConnectionMutation.mutate(connection.id);
              }
            }}
            data-testid={`button-delete-${connection.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-6" data-testid="interoperability-hub">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Interoperability Hub</h2>
          <p className="text-muted-foreground">
            Connect and manage your health data sources from hospitals, clinics, labs, and more
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-connection">
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Data Source</DialogTitle>
              <DialogDescription>
                Connect to a new healthcare provider or data source to import your health records
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={newConnection.sourceType}
                  onValueChange={(value) => setNewConnection({ ...newConnection, sourceType: value as DataSourceConnection['sourceType'] })}
                >
                  <SelectTrigger data-testid="select-source-type">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypes.map((type) => {
                      const Icon = sourceTypeIcons[type.id] || Database;
                      return (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{type.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <Input
                    placeholder="e.g., City General Hospital"
                    value={newConnection.sourceName}
                    onChange={(e) => setNewConnection({ ...newConnection, sourceName: e.target.value })}
                    data-testid="input-source-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    placeholder="e.g., ABC Health System"
                    value={newConnection.sourceOrganization}
                    onChange={(e) => setNewConnection({ ...newConnection, sourceOrganization: e.target.value })}
                    data-testid="input-source-org"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select
                    value={newConnection.protocol}
                    onValueChange={(value) => setNewConnection({ ...newConnection, protocol: value as DataSourceConnection['protocol'] })}
                  >
                    <SelectTrigger data-testid="select-protocol">
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      {protocols.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select
                    value={newConnection.syncFrequency}
                    onValueChange={(value) => setNewConnection({ ...newConnection, syncFrequency: value as DataSourceConnection['syncFrequency'] })}
                  >
                    <SelectTrigger data-testid="select-sync-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endpoint URL (optional)</Label>
                <Input
                  placeholder="https://api.hospital.com/fhir/r4"
                  value={newConnection.endpoint}
                  onChange={(e) => setNewConnection({ ...newConnection, endpoint: e.target.value })}
                  data-testid="input-endpoint"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Data Types to Import</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {dataTypes.map((dt) => {
                    const isSelected = newConnection.dataPermissions.some(p => p.dataType === dt.id);
                    return (
                      <div key={dt.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`dt-${dt.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewConnection({
                                ...newConnection,
                                dataPermissions: [
                                  ...newConnection.dataPermissions,
                                  { dataType: dt.id, canRead: true, canShare: false, autoSync: true },
                                ],
                              });
                            } else {
                              setNewConnection({
                                ...newConnection,
                                dataPermissions: newConnection.dataPermissions.filter(p => p.dataType !== dt.id),
                              });
                            }
                          }}
                          data-testid={`checkbox-datatype-${dt.id}`}
                        />
                        <label htmlFor={`dt-${dt.id}`} className="text-sm cursor-pointer">
                          {dt.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createConnectionMutation.mutate(newConnection)}
                disabled={!newConnection.sourceType || !newConnection.sourceName || !newConnection.sourceOrganization || !newConnection.protocol || createConnectionMutation.isPending}
                data-testid="button-create-connection"
              >
                {createConnectionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>IMPORTANT NOTICE:</strong> This interoperability hub allows you to connect to external health data sources. 
            All data retrieved is for informational purposes only and does not constitute medical advice. 
            Always consult with your healthcare provider for medical decisions.
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <Link className="h-4 w-4 mr-2" />
            My Connections
          </TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">
            <Building2 className="h-4 w-4 mr-2" />
            Available Sources
          </TabsTrigger>
          <TabsTrigger value="standards" data-testid="tab-standards">
            <FileText className="h-4 w-4 mr-2" />
            Data Standards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          {connectionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Unlink className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Connections Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Connect to your healthcare providers to import your health records
                </p>
                <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-connection">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map(renderConnectionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sourceTypes.map((type) => {
              const Icon = sourceTypeIcons[type.id] || Database;
              return (
                <Card key={type.id} className="hover-elevate cursor-pointer" onClick={() => {
                  setNewConnection({ ...newConnection, sourceType: type.id as DataSourceConnection['sourceType'] });
                  setShowAddDialog(true);
                }} data-testid={`card-source-type-${type.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{type.name}</CardTitle>
                        <CardDescription className="text-xs">{type.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button variant="ghost" size="sm" className="ml-auto">
                      Connect <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="standards" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {protocols.map((p) => (
              <Card key={p.id} data-testid={`card-protocol-${p.id}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    {p.name}
                  </CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {p.id === 'fhir' && (
                      <p>Modern REST-based standard for healthcare data exchange. Supports SMART on FHIR for secure OAuth2 authentication.</p>
                    )}
                    {p.id === 'hl7v2' && (
                      <p>Traditional messaging standard widely used in hospitals. Supports ADT, ORU, ORM and other message types.</p>
                    )}
                    {p.id === 'ccda' && (
                      <p>XML-based clinical document standard. Commonly used for sharing Continuity of Care Documents.</p>
                    )}
                    {p.id === 'x12' && (
                      <p>EDI standard for healthcare claims and eligibility. Used for insurance transactions.</p>
                    )}
                    {p.id === 'direct' && (
                      <p>Secure messaging protocol for healthcare. Enables encrypted message exchange between providers.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Data Sharing Permissions</DialogTitle>
            <DialogDescription>
              Control what data can be imported and shared from {selectedConnection?.sourceName}
            </DialogDescription>
          </DialogHeader>
          {selectedConnection && (
            <ScrollArea className="max-h-96">
              <div className="space-y-4 pr-4">
                {dataTypes.map((dt) => (
                  <div key={dt.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium">{dt.name}</div>
                      <div className="text-xs text-muted-foreground">{dt.description}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`read-${dt.id}`}
                          checked={getPermissionValue(dt.id, 'canRead')}
                          onCheckedChange={() => toggleDataPermission(dt.id, 'canRead')}
                          data-testid={`switch-read-${dt.id}`}
                        />
                        <Label htmlFor={`read-${dt.id}`} className="text-xs">Import</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`share-${dt.id}`}
                          checked={getPermissionValue(dt.id, 'canShare')}
                          onCheckedChange={() => toggleDataPermission(dt.id, 'canShare')}
                          data-testid={`switch-share-${dt.id}`}
                        />
                        <Label htmlFor={`share-${dt.id}`} className="text-xs">Share</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`sync-${dt.id}`}
                          checked={getPermissionValue(dt.id, 'autoSync')}
                          onCheckedChange={() => toggleDataPermission(dt.id, 'autoSync')}
                          data-testid={`switch-sync-${dt.id}`}
                        />
                        <Label htmlFor={`sync-${dt.id}`} className="text-xs">Auto</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedConnection) {
                  updatePermissionsMutation.mutate({
                    connectionId: selectedConnection.id,
                    permissions: selectedConnection.dataPermissions,
                  });
                }
              }}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updatePermissionsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSyncHistoryDialog} onOpenChange={setShowSyncHistoryDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync History</DialogTitle>
            <DialogDescription>
              Recent synchronization events for {selectedConnection?.sourceName}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {syncHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sync events yet
                </div>
              ) : (
                syncHistory.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-md">
                    {event.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : event.status === 'partial' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm capitalize">
                        {event.eventType.replace(/_/g, ' ')}
                      </div>
                      {event.details && (
                        <div className="text-xs text-muted-foreground">{event.details}</div>
                      )}
                      {event.recordsProcessed !== undefined && (
                        <div className="text-xs mt-1">
                          <Badge variant="outline" className="mr-2">
                            {event.recordsProcessed} processed
                          </Badge>
                          {event.recordsFailed !== undefined && event.recordsFailed > 0 && (
                            <Badge variant="outline" className="text-red-600">
                              {event.recordsFailed} failed
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InteroperabilityHub;
