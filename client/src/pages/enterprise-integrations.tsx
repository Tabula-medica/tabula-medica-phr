import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Watch,
  Activity,
  Heart,
  Footprints,
  Moon,
  Thermometer,
  Loader2,
  RefreshCw,
  Link2,
  Unlink,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Database,
  GitBranch,
  Zap,
  Settings,
  Clock,
  TrendingUp,
  ChevronRight,
  Droplets,
  Scale,
  Flame,
  Wind,
} from "lucide-react";

interface ConnectorStatus {
  platform: string;
  displayName: string;
  status: string;
  lastSync: string | null;
  totalDataPoints: number;
  dataTypes: string[];
  apiVersion: string;
  rateLimitRemaining: number;
  rateLimitReset: string;
}

interface MappingRule {
  sourceField: string;
  targetDataType: string;
  transformation: string;
  unitConversion?: { from: string; to: string };
}

interface WearableDevice {
  id: string;
  platform: string;
  deviceName: string;
  model: string;
  status: string;
  lastSync: string | null;
  connectedAt: string;
  capabilities: string[];
  authStatus: string;
}

interface DataFormat {
  platform: string;
  rawFormat: string;
  samplePayload: Record<string, unknown>;
  mappingRules: MappingRule[];
}

interface LineageRecord {
  id: string;
  recordId: string;
  resourceType: string;
  source: {
    sourceName: string;
    sourceType: string;
    connectionMethod: string;
    originalFormat: string;
  };
  importTimestamp: string;
  lastUpdated: string;
  transformations: { id: string; type: string; details: string; engine: string }[];
  validationStatus: string;
  provenanceChain: { id: string; action: string; actor: string; timestamp: string; details: string }[];
}

const dataTypeIcons: Record<string, typeof Heart> = {
  heart_rate: Heart,
  steps: Footprints,
  sleep: Moon,
  blood_oxygen: Droplets,
  temperature: Thermometer,
  stress: Activity,
  hrv: TrendingUp,
  respiratory_rate: Wind,
  calories: Flame,
  activity: Zap,
  blood_pressure: Activity,
  body_composition: Scale,
  weight: Scale,
  ecg: Heart,
};

const platformColors: Record<string, string> = {
  fitbit: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  garmin: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  samsung_health: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

const platformBorderColors: Record<string, string> = {
  fitbit: "border-teal-500/30",
  garmin: "border-blue-500/30",
  samsung_health: "border-indigo-500/30",
};

function ConnectorCard({
  connector,
  device,
  onSync,
  onViewMapping,
  isSyncing,
}: {
  connector: ConnectorStatus;
  device?: WearableDevice;
  onSync: () => void;
  onViewMapping: () => void;
  isSyncing: boolean;
}) {
  const borderColor = platformBorderColors[connector.platform] || "";
  const colorClass = platformColors[connector.platform] || "";

  return (
    <Card className={`${borderColor}`} data-testid={`connector-card-${connector.platform}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{connector.displayName}</CardTitle>
            <Badge
              variant={connector.status === "active" ? "default" : "secondary"}
              data-testid={`badge-status-${connector.platform}`}
            >
              {connector.status === "active" ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {connector.status}
            </Badge>
          </div>
          <CardDescription className="mt-1">
            {device ? device.deviceName : `${connector.displayName} API`} | {connector.apiVersion}
          </CardDescription>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={onSync}
            disabled={isSyncing || connector.status !== "active"}
            data-testid={`button-sync-${connector.platform}`}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onViewMapping}
            data-testid={`button-mapping-${connector.platform}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {device && (
          <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Watch className="h-3 w-3" />
              <span>{device.model}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Synced {new Date(device.lastSync || "").toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {connector.dataTypes.map((dt) => {
            const Icon = dataTypeIcons[dt] || Activity;
            return (
              <Badge key={dt} variant="outline" className={colorClass} data-testid={`datatype-${connector.platform}-${dt}`}>
                <Icon className="h-3 w-3 mr-1" />
                {dt.replace(/_/g, " ")}
              </Badge>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Rate limit: {connector.rateLimitRemaining} remaining</span>
          <span>{connector.totalDataPoints} data points</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingRulesPanel({ platform, rules }: { platform: string; rules: MappingRule[] }) {
  const colorClass = platformColors[platform] || "";
  return (
    <Card data-testid={`mapping-panel-${platform}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Data Mapping Rules</CardTitle>
        <CardDescription>{rules.length} mapping rules configured</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const Icon = dataTypeIcons[rule.targetDataType] || Activity;
            return (
              <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded-md border" data-testid={`mapping-rule-${platform}-${idx}`}>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0 max-w-[180px] truncate">
                  {rule.sourceField}
                </code>
                <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                <Badge variant="outline" className={colorClass}>
                  <Icon className="h-3 w-3 mr-1" />
                  {rule.targetDataType.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{rule.transformation}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LineageSection({ records }: { records: LineageRecord[] }) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No lineage records from wearable sources yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id} data-testid={`lineage-wearable-${record.id}`}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{record.source.sourceType}</Badge>
                <span className="text-sm font-medium">{record.source.sourceName}</span>
              </div>
              <Badge variant={record.validationStatus === "valid" ? "default" : "secondary"}>
                {record.validationStatus}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                {record.resourceType}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {record.transformations.length} transforms
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(record.importTimestamp).toLocaleString()}
              </span>
            </div>
            <div className="pl-4 border-l-2 border-muted space-y-1 mt-2">
              {record.provenanceChain.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-muted-foreground"> by {entry.actor}</span>
                    <span className="text-muted-foreground ml-1">
                      ({new Date(entry.timestamp).toLocaleString()})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function EnterpriseIntegrations() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: connectorData, isLoading: connectorsLoading } = useQuery<{
    success: boolean;
    connectors: ConnectorStatus[];
  }>({
    queryKey: ["/api/infrastructure/wearables/connectors/statuses"],
  });

  const { data: devicesData, isLoading: devicesLoading } = useQuery<{
    success: boolean;
    devices: WearableDevice[];
  }>({
    queryKey: ["/api/infrastructure/wearables/devices/patient-001"],
  });

  const { data: lineageData, isLoading: lineageLoading } = useQuery<{
    success: boolean;
    records: LineageRecord[];
  }>({
    queryKey: ["/api/infrastructure/lineage/patient/patient-001"],
  });

  const { data: mappingData } = useQuery<{
    success: boolean;
    rules: MappingRule[];
  }>({
    queryKey: [`/api/infrastructure/wearables/connectors/mapping/${selectedPlatform}`],
    enabled: !!selectedPlatform,
  });

  const syncMutation = useMutation({
    mutationFn: async ({ patientId, deviceId }: { patientId: string; deviceId: string }) => {
      const res = await apiRequest("POST", `/api/infrastructure/wearables/sync/${patientId}/${deviceId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sync completed", description: `${data.result?.dataPointsSynced || 0} data points synced.` });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/wearables"] });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not sync device data.", variant: "destructive" });
    },
  });

  const connectors = connectorData?.connectors || [];
  const devices = (devicesData?.devices || []).filter(
    (d) => d.platform === "fitbit" || d.platform === "garmin" || d.platform === "samsung_health"
  );
  const allDevices = devicesData?.devices || [];
  const wearableLineage = (lineageData?.records || []).filter(
    (r) => r.source.sourceType === "wearable"
  );
  const mappingRules = mappingData?.rules || [];

  const isLoading = connectorsLoading || devicesLoading;

  const totalDataTypes = connectors.reduce((sum, c) => sum + c.dataTypes.length, 0);
  const activeConnectors = connectors.filter((c) => c.status === "active").length;

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Enterprise Wearable Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Platform-specific connectors for Fitbit, Garmin, and Samsung Health with data mapping and lineage tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10">
                  <Link2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-active-connectors">{activeConnectors}</p>
                  <p className="text-xs text-muted-foreground">Active Connectors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10">
                  <Watch className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-connected-devices">{devices.length}</p>
                  <p className="text-xs text-muted-foreground">Connected Devices</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-data-types">{totalDataTypes}</p>
                  <p className="text-xs text-muted-foreground">Data Types Tracked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10">
                  <GitBranch className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-lineage-records">{wearableLineage.length}</p>
                  <p className="text-xs text-muted-foreground">Lineage Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="fitbit" data-testid="tab-fitbit">Fitbit</TabsTrigger>
            <TabsTrigger value="garmin" data-testid="tab-garmin">Garmin</TabsTrigger>
            <TabsTrigger value="samsung" data-testid="tab-samsung">Samsung Health</TabsTrigger>
            <TabsTrigger value="lineage" data-testid="tab-lineage">Data Lineage</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectors.map((connector) => {
                  const device = devices.find((d) => d.platform === connector.platform);
                  return (
                    <ConnectorCard
                      key={connector.platform}
                      connector={connector}
                      device={device}
                      onSync={() => {
                        if (device) {
                          syncMutation.mutate({ patientId: "patient-001", deviceId: device.id });
                        }
                      }}
                      onViewMapping={() => {
                        setSelectedPlatform(connector.platform);
                        setActiveTab(
                          connector.platform === "samsung_health" ? "samsung" : connector.platform
                        );
                      }}
                      isSyncing={syncMutation.isPending}
                    />
                  );
                })}
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Integration Architecture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">Authentication</p>
                    <p className="text-muted-foreground">OAuth 2.0 with PKCE for all platforms. Token refresh handled automatically.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Data Pipeline</p>
                    <p className="text-muted-foreground">Platform-specific parsers convert raw API JSON to FHIR R4 Observations with LOINC coding.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Compliance</p>
                    <p className="text-muted-foreground">Full HIPAA audit logging. Data lineage tracked from device sensor to Health Graph entity.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fitbit" className="space-y-4 mt-4">
            <PlatformDetailSection
              platform="fitbit"
              displayName="Fitbit"
              connector={connectors.find((c) => c.platform === "fitbit")}
              device={devices.find((d) => d.platform === "fitbit")}
              lineageRecords={wearableLineage.filter((r) => r.source.sourceName.includes("Fitbit"))}
              mappingRules={selectedPlatform === "fitbit" ? mappingRules : []}
              onLoadMappings={() => setSelectedPlatform("fitbit")}
              onSync={(deviceId) => syncMutation.mutate({ patientId: "patient-001", deviceId })}
              isSyncing={syncMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="garmin" className="space-y-4 mt-4">
            <PlatformDetailSection
              platform="garmin"
              displayName="Garmin Connect"
              connector={connectors.find((c) => c.platform === "garmin")}
              device={devices.find((d) => d.platform === "garmin")}
              lineageRecords={wearableLineage.filter((r) => r.source.sourceName.includes("Garmin"))}
              mappingRules={selectedPlatform === "garmin" ? mappingRules : []}
              onLoadMappings={() => setSelectedPlatform("garmin")}
              onSync={(deviceId) => syncMutation.mutate({ patientId: "patient-001", deviceId })}
              isSyncing={syncMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="samsung" className="space-y-4 mt-4">
            <PlatformDetailSection
              platform="samsung_health"
              displayName="Samsung Health"
              connector={connectors.find((c) => c.platform === "samsung_health")}
              device={devices.find((d) => d.platform === "samsung_health")}
              lineageRecords={wearableLineage.filter((r) => r.source.sourceName.includes("Galaxy") || r.source.sourceName.includes("Samsung"))}
              mappingRules={selectedPlatform === "samsung_health" ? mappingRules : []}
              onLoadMappings={() => setSelectedPlatform("samsung_health")}
              onSync={(deviceId) => syncMutation.mutate({ patientId: "patient-001", deviceId })}
              isSyncing={syncMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="lineage" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold">Wearable Data Lineage</h3>
                <p className="text-sm text-muted-foreground">
                  Full provenance chain from device sensor to Health Graph entity for all wearable sources.
                </p>
              </div>
              <Badge variant="secondary">{wearableLineage.length} records</Badge>
            </div>
            {lineageLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <LineageSection records={wearableLineage} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function PlatformDetailSection({
  platform,
  displayName,
  connector,
  device,
  lineageRecords,
  mappingRules,
  onLoadMappings,
  onSync,
  isSyncing,
}: {
  platform: string;
  displayName: string;
  connector?: ConnectorStatus;
  device?: WearableDevice;
  lineageRecords: LineageRecord[];
  mappingRules: MappingRule[];
  onLoadMappings: () => void;
  onSync: (deviceId: string) => void;
  isSyncing: boolean;
}) {
  const colorClass = platformColors[platform] || "";

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">{displayName} Integration</h3>
          <p className="text-sm text-muted-foreground">
            {connector?.apiVersion || "API"} connector with platform-specific data parsing
          </p>
        </div>
        {connector && (
          <Badge
            variant={connector.status === "active" ? "default" : "secondary"}
            data-testid={`badge-detail-status-${platform}`}
          >
            {connector.status === "active" ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
            {connector.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid={`device-detail-${platform}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Watch className="h-4 w-4" />
              Connected Device
            </CardTitle>
          </CardHeader>
          <CardContent>
            {device ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium" data-testid={`text-device-name-${platform}`}>{device.deviceName}</p>
                    <p className="text-sm text-muted-foreground">{device.model}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSync(device.id)}
                      disabled={isSyncing}
                      data-testid={`button-sync-detail-${platform}`}
                    >
                      {isSyncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Sync Now
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{device.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Auth</p>
                    <p className="font-medium capitalize">{device.authStatus}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">{device.lastSync ? new Date(device.lastSync).toLocaleString() : "Never"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p className="font-medium">{new Date(device.connectedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1">
                    {device.capabilities.map((cap) => {
                      const Icon = dataTypeIcons[cap] || Activity;
                      return (
                        <Badge key={cap} variant="outline" className={colorClass}>
                          <Icon className="h-3 w-3 mr-1" />
                          {cap.replace(/_/g, " ")}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Unlink className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No device connected</p>
                <Button size="sm" variant="outline" className="mt-2" data-testid={`button-connect-${platform}`}>
                  <Link2 className="h-3 w-3 mr-1" />
                  Connect Device
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid={`api-detail-${platform}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connector ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">API Version</p>
                    <p className="font-medium">{connector.apiVersion}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data Types</p>
                    <p className="font-medium">{connector.dataTypes.length} types</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rate Limit</p>
                    <p className="font-medium">{connector.rateLimitRemaining} remaining</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data Points</p>
                    <p className="font-medium">{connector.totalDataPoints}</p>
                  </div>
                </div>
                <Separator />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLoadMappings}
                  className="w-full"
                  data-testid={`button-view-mappings-${platform}`}
                >
                  <ChevronRight className="h-3 w-3 mr-1" />
                  View Data Mapping Rules
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p>Connector not available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {mappingRules.length > 0 && (
        <MappingRulesPanel platform={platform} rules={mappingRules} />
      )}

      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Data Lineage from {displayName}
          <Badge variant="secondary">{lineageRecords.length}</Badge>
        </h4>
        <LineageSection records={lineageRecords} />
      </div>
    </>
  );
}
