import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Network,
  Database,
  Watch,
  ArrowRight,
  CheckCircle,
  Shield,
  Loader2,
  Server,
  Zap,
  FileText,
  Activity,
  Heart,
  Footprints,
  Moon,
  Thermometer,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  Link2,
  Unlink,
  GitBranch,
  History,
  Search,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

interface BundleSource {
  id: string;
  name: string;
  networkType: string;
  status: string;
  capabilities: string[];
  supportedResourceTypes: string[];
  fhirVersion: string;
  endpoint: string;
  authMethod: string;
  lastSync: string;
  recordCount: number;
}

interface WearablePlatform {
  platform: string;
  displayName: string;
  capabilities: string[];
  authType: string;
  description: string;
  apiEndpoint: string;
  iconKey: string;
}

interface WearableDevice {
  id: string;
  platform: string;
  deviceName: string;
  model: string;
  status: string;
  lastSync: string;
  connectedAt: string;
  capabilities: string[];
  authStatus: string;
}

interface LineageSummary {
  totalRecords: number;
  bySource: Record<string, number>;
  byResourceType: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
  averageTransformations: number;
  oldestRecord: string;
  newestRecord: string;
  dataFreshness: Record<string, any>;
}

interface LineageRecord {
  id: string;
  recordId: string;
  resourceType: string;
  patientId: string;
  source: {
    sourceId: string;
    sourceName: string;
    sourceType: string;
    networkName?: string;
    connectionMethod: string;
    fhirVersion?: string;
    originalFormat: string;
  };
  importTimestamp: string;
  lastUpdated: string;
  transformations: Array<{
    id: string;
    type: string;
    appliedAt: string;
    details: string;
    engine: string;
  }>;
  validationStatus: string;
  provenanceChain: Array<{
    id: string;
    action: string;
    actor: string;
    timestamp: string;
    details: string;
  }>;
  currentVersion: number;
}

interface SourceBreakdown {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  recordCount: number;
  lastSync: string;
  resourceTypes: string[];
}

const SAMPLE_PATIENT_ID = "patient-001";

function getSourceTypeIcon(type: string) {
  switch (type) {
    case 'ehr': return <Database className="h-4 w-4" />;
    case 'lab': return <FileText className="h-4 w-4" />;
    case 'pharmacy': return <Shield className="h-4 w-4" />;
    case 'wearable': return <Watch className="h-4 w-4" />;
    case 'fhir_network': return <Network className="h-4 w-4" />;
    case 'health_exchange': return <Server className="h-4 w-4" />;
    case 'imaging': return <Activity className="h-4 w-4" />;
    case 'claims': return <FileText className="h-4 w-4" />;
    default: return <Database className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
    case 'connected':
    case 'valid':
      return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
    case 'pending':
    case 'syncing':
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {status}</Badge>;
    case 'inactive':
    case 'disconnected':
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><AlertCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function getVitalIcon(type: string) {
  switch (type) {
    case 'heart_rate': return <Heart className="h-4 w-4 text-red-500" />;
    case 'steps': return <Footprints className="h-4 w-4 text-blue-500" />;
    case 'sleep': return <Moon className="h-4 w-4 text-indigo-500" />;
    case 'temperature': return <Thermometer className="h-4 w-4 text-orange-500" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

export default function DataIntegrationHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSource, setSelectedSource] = useState<string>("");

  const { data: bundleSources, isLoading: sourcesLoading } = useQuery<{ success: boolean; totalSources: number; activeSources: number; sources: BundleSource[] }>({
    queryKey: ['/api/infrastructure/bundle-import/sources']
  });

  const { data: wearablePlatforms, isLoading: platformsLoading } = useQuery<{ success: boolean; totalPlatforms: number; platforms: WearablePlatform[] }>({
    queryKey: ['/api/infrastructure/wearables/platforms']
  });

  const { data: connectedDevices, isLoading: devicesLoading } = useQuery<{ success: boolean; totalDevices: number; devices: WearableDevice[] }>({
    queryKey: ['/api/infrastructure/wearables/devices', SAMPLE_PATIENT_ID]
  });

  const { data: lineageSummary, isLoading: lineageLoading } = useQuery<{ success: boolean; summary: LineageSummary }>({
    queryKey: ['/api/infrastructure/lineage/summary', SAMPLE_PATIENT_ID]
  });

  const { data: lineageRecords } = useQuery<{ success: boolean; totalRecords: number; records: LineageRecord[] }>({
    queryKey: ['/api/infrastructure/lineage/patient', SAMPLE_PATIENT_ID]
  });

  const { data: sourceBreakdown } = useQuery<{ success: boolean; breakdown: SourceBreakdown[] }>({
    queryKey: ['/api/infrastructure/lineage/sources', SAMPLE_PATIENT_ID]
  });

  const { data: importStats } = useQuery<{ success: boolean; stats: any }>({
    queryKey: ['/api/infrastructure/bundle-import/stats']
  });

  const { data: vitals } = useQuery<{ success: boolean; vitals: any }>({
    queryKey: ['/api/infrastructure/wearables/vitals', SAMPLE_PATIENT_ID]
  });

  const importMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", "/api/infrastructure/bundle-import/import", {
        sourceId,
        patientId: SAMPLE_PATIENT_ID,
        format: 'json'
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import Complete", description: `Imported ${data.result?.importedResources || 0} resources successfully.` });
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/bundle-import'] });
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/lineage'] });
    },
    onError: () => {
      toast({ title: "Import Failed", description: "Could not import FHIR bundle.", variant: "destructive" });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiRequest("POST", `/api/infrastructure/wearables/sync/${SAMPLE_PATIENT_ID}/${deviceId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sync Complete", description: `Synced ${data.result?.dataPointsSynced || 0} data points.` });
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/wearables'] });
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Could not sync device data.", variant: "destructive" });
    }
  });

  const summary = lineageSummary?.summary;
  const records = lineageRecords?.records || [];
  const sources = bundleSources?.sources || [];
  const platforms = wearablePlatforms?.platforms || [];
  const devices = connectedDevices?.devices || [];
  const breakdown = sourceBreakdown?.breakdown || [];

  const isLoading = sourcesLoading || platformsLoading || devicesLoading || lineageLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Integration Hub</h1>
          <p className="text-muted-foreground mt-1">
            Import health records, connect wearable devices, and track data provenance across all sources
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Network className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-sources">{sources.length}</p>
                  <p className="text-xs text-muted-foreground">Health Networks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-500/10">
                  <Watch className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-connected-devices">{devices.length}</p>
                  <p className="text-xs text-muted-foreground">Wearable Devices</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-purple-500/10">
                  <GitBranch className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-lineage-records">{summary?.totalRecords || 0}</p>
                  <p className="text-xs text-muted-foreground">Tracked Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-orange-500/10">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-avg-transforms">{summary?.averageTransformations?.toFixed(1) || "0"}</p>
                  <p className="text-xs text-muted-foreground">Avg Transforms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="fhir-import" data-testid="tab-fhir-import">FHIR Import</TabsTrigger>
            <TabsTrigger value="wearables" data-testid="tab-wearables">Wearables</TabsTrigger>
            <TabsTrigger value="lineage" data-testid="tab-lineage">Data Lineage</TabsTrigger>
            <TabsTrigger value="provenance" data-testid="tab-provenance">Provenance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Source Breakdown
                  </CardTitle>
                  <CardDescription>Records by data source</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {breakdown.length > 0 ? breakdown.map((src, i) => (
                    <div key={i} className="flex items-center justify-between gap-2" data-testid={`source-breakdown-${i}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {getSourceTypeIcon(src.sourceType)}
                        <span className="text-sm truncate">{src.sourceName}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">{src.recordCount}</Badge>
                        <Badge variant="secondary" className="text-xs">{src.sourceType}</Badge>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No source data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Connected Wearables
                  </CardTitle>
                  <CardDescription>Active device connections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {devices.length > 0 ? devices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between gap-2" data-testid={`device-overview-${device.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Watch className="h-4 w-4 text-green-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{device.deviceName}</p>
                          <p className="text-xs text-muted-foreground">{device.model}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(device.status)}
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No wearable devices connected</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Records by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(summary.byResourceType || {}).map(([type, count]) => (
                      <div key={type} className="p-3 rounded-md border" data-testid={`resource-type-${type}`}>
                        <p className="text-lg font-bold">{count as number}</p>
                        <p className="text-xs text-muted-foreground capitalize">{type.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="fhir-import" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Health Information Networks
                </CardTitle>
                <CardDescription>
                  Import FHIR R4 bundles from additional networks beyond TEFCA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sources.map((source) => (
                  <Card key={source.id} className="hover-elevate" data-testid={`bundle-source-${source.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-md bg-muted">
                            <Server className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm">{source.name}</h3>
                              {getStatusBadge(source.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {source.networkType} | FHIR {source.fhirVersion} | {source.authMethod}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {source.capabilities.slice(0, 3).map((cap) => (
                                <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                              ))}
                              {source.capabilities.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{source.capabilities.length - 3}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Last sync: {new Date(source.lastSync).toLocaleDateString()} | {source.recordCount.toLocaleString()} records
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSource(source.id)}
                            data-testid={`button-view-source-${source.id}`}
                          >
                            <Search className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            disabled={source.status !== 'active' || importMutation.isPending}
                            onClick={() => importMutation.mutate(source.id)}
                            data-testid={`button-import-${source.id}`}
                          >
                            {importMutation.isPending ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            Import
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {importStats?.stats && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Import Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-md border" data-testid="stat-total-imports">
                      <p className="text-xl font-bold">{importStats.stats.totalImports || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Imports</p>
                    </div>
                    <div className="text-center p-3 rounded-md border" data-testid="stat-total-resources">
                      <p className="text-xl font-bold">{importStats.stats.totalResourcesImported?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">Resources Imported</p>
                    </div>
                    <div className="text-center p-3 rounded-md border" data-testid="stat-active-sources">
                      <p className="text-xl font-bold">{importStats.stats.activeSources || 0}</p>
                      <p className="text-xs text-muted-foreground">Active Sources</p>
                    </div>
                    <div className="text-center p-3 rounded-md border" data-testid="stat-success-rate">
                      <p className="text-xl font-bold">{importStats.stats.successRate || "N/A"}%</p>
                      <p className="text-xs text-muted-foreground">Success Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="wearables" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Watch className="h-4 w-4" />
                    Connected Devices
                  </CardTitle>
                  <CardDescription>Your wearable device connections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {devices.length > 0 ? devices.map((device) => (
                    <Card key={device.id} data-testid={`wearable-device-${device.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm">{device.deviceName}</h3>
                              {getStatusBadge(device.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{device.model} | {device.platform}</p>
                            <p className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Last sync: {new Date(device.lastSync).toLocaleString()}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {device.capabilities.slice(0, 4).map((cap) => (
                                <Badge key={cap} variant="outline" className="text-xs capitalize">{cap.replace(/_/g, ' ')}</Badge>
                              ))}
                              {device.capabilities.length > 4 && (
                                <Badge variant="outline" className="text-xs">+{device.capabilities.length - 4}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              disabled={syncMutation.isPending}
                              onClick={() => syncMutation.mutate(device.id)}
                              data-testid={`button-sync-${device.id}`}
                            >
                              {syncMutation.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1" />
                              )}
                              Sync
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <p className="text-sm text-muted-foreground">No devices connected. Connect a wearable device to start tracking.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Supported Platforms
                  </CardTitle>
                  <CardDescription>Available wearable integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {platforms.map((platform) => (
                    <div key={platform.platform} className="flex items-center justify-between gap-2 p-2 rounded-md border" data-testid={`platform-${platform.platform}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{platform.displayName}</p>
                        <p className="text-xs text-muted-foreground">{platform.capabilities.length} data types | {platform.authType}</p>
                      </div>
                      <Button size="sm" variant="outline" data-testid={`button-connect-${platform.platform}`}>
                        <Link2 className="h-3 w-3 mr-1" />
                        Connect
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {vitals?.vitals && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Aggregated Vitals
                  </CardTitle>
                  <CardDescription>Latest readings from all connected devices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(vitals.vitals).map(([key, data]: [string, any]) => (
                      <div key={key} className="p-3 rounded-md border" data-testid={`vital-${key}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {getVitalIcon(key)}
                          <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                        </div>
                        {data?.latest !== undefined ? (
                          <div>
                            <p className="text-lg font-bold">{typeof data.latest === 'object' ? JSON.stringify(data.latest) : data.latest} {data.unit || ''}</p>
                            {data.average !== undefined && (
                              <p className="text-xs text-muted-foreground">Avg: {typeof data.average === 'number' ? data.average.toFixed(1) : data.average} | Range: {data.min}-{data.max}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {data.totalReadings || 0} readings | {data.deviceCount || 0} device(s)
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No data available</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lineage" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Data Lineage Records
                </CardTitle>
                <CardDescription>
                  Source tracking and timestamps for all imported health records
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {records.length > 0 ? records.map((record) => (
                  <Card key={record.id} data-testid={`lineage-record-${record.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            {getSourceTypeIcon(record.source.sourceType)}
                            <span className="font-medium text-sm">{record.source.sourceName}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs capitalize">{record.resourceType.replace(/_/g, ' ')}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(record.validationStatus)}
                            <Badge variant="outline" className="text-xs">v{record.currentVersion}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            Imported: {new Date(record.importTimestamp).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updated: {new Date(record.lastUpdated).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {record.transformations.length} transformation(s)
                          </span>
                          <span className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            {record.provenanceChain.length} provenance entries
                          </span>
                        </div>
                        {record.source.networkName && (
                          <p className="text-xs text-muted-foreground">
                            via {record.source.networkName} | {record.source.connectionMethod} | {record.source.originalFormat}
                          </p>
                        )}
                        {record.transformations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {record.transformations.map((t) => (
                              <Badge key={t.id} variant="outline" className="text-xs capitalize">
                                {t.type.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <p className="text-sm text-muted-foreground">No lineage records available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provenance" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Provenance Chain
                </CardTitle>
                <CardDescription>
                  Complete audit trail showing who accessed, modified, or verified each record
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {records.length > 0 ? records.filter(r => r.provenanceChain.length > 0).slice(0, 10).map((record) => (
                  <div key={record.id} data-testid={`provenance-record-${record.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {getSourceTypeIcon(record.source.sourceType)}
                      <span className="font-medium text-sm">{record.source.sourceName}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{record.resourceType.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="ml-6 border-l-2 border-muted pl-4 space-y-2">
                      {record.provenanceChain.map((entry, i) => (
                        <div key={entry.id} className="relative" data-testid={`provenance-entry-${entry.id}`}>
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">{entry.details}</p>
                              <p className="text-xs text-muted-foreground">Actor: {entry.actor}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {record !== records.filter(r => r.provenanceChain.length > 0).slice(0, 10).at(-1) && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No provenance data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}