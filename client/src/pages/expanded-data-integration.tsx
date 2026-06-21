import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Database,
  Watch,
  Smartphone,
  Activity,
  Link2,
  Shield,
  Clock,
  Users,
  FileText,
  Heart,
  Dumbbell,
  Apple,
  Zap,
  Radio,
  CircleDot,
} from "lucide-react";

interface PortalPlatform {
  platform: string;
  displayName: string;
  vendor: string;
  description: string;
  authMethod: string;
  fhirVersion: string;
  supportedCategories: string[];
  patientCount: string;
  logoColor: string;
  connectionCount: number;
  activeCount: number;
}

interface PortalConnection {
  id: string;
  platform: string;
  displayName: string;
  organizationName: string;
  status: "connected" | "disconnected" | "expired" | "pending_auth" | "error";
  lastSync: string | null;
  recordCount: number;
  dataCategories: string[];
}

interface PortalDashboard {
  dashboard: {
    totalPlatforms: number;
    activeConnections: number;
    totalConnections: number;
    totalRecords: number;
    platforms: PortalPlatform[];
    connections: PortalConnection[];
  };
}

interface WearablePlatformInfo {
  platform: string;
  displayName: string;
  description: string;
  authType: string;
  capabilities: string[];
  supportedMetrics?: string[];
  apiEndpoint?: string;
  iconKey?: string;
}

interface WearablePlatformsResponse {
  totalPlatforms: number;
  platforms: WearablePlatformInfo[];
}

interface HealthAppPlatform {
  platform: string;
  displayName: string;
  category: "nutrition" | "fitness" | "wellness";
  description: string;
  supportedDataTypes: string[];
  primaryFocus: string;
  userBase: string;
  logoColor: string;
  connectionCount: number;
  activeCount: number;
}

interface HealthAppConnection {
  id: string;
  platform: string;
  displayName: string;
  username: string;
  status: "connected" | "disconnected" | "expired" | "pending_auth" | "error";
  lastSync: string | null;
  recordCount: number;
  dataTypes: string[];
  syncFrequency: string;
}

interface HealthAppDashboard {
  dashboard: {
    totalPlatforms: number;
    activeConnections: number;
    totalConnections: number;
    totalRecords: number;
    platforms: HealthAppPlatform[];
    connections: HealthAppConnection[];
    nutritionSources: number;
    fitnessSources: number;
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "connected":
      return <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-700" data-testid={`badge-status-${status}`}>{status}</Badge>;
    case "disconnected":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{status}</Badge>;
    case "expired":
      return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-status-${status}`}>{status}</Badge>;
    case "pending_auth":
      return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400" data-testid={`badge-status-${status}`}>pending auth</Badge>;
    case "error":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}>{status}</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function formatSyncTime(timestamp: string | null): string {
  if (!timestamp) return "Never synced";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCapability(cap: string): string {
  return cap.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ExpandedDataIntegration() {
  const [, setLocation] = useLocation();

  const { data: portalData, isLoading: portalsLoading } = useQuery<PortalDashboard>({
    queryKey: ["/api/infrastructure/patient-portals/dashboard"],
  });

  const { data: wearableData, isLoading: wearablesLoading } = useQuery<WearablePlatformsResponse>({
    queryKey: ["/api/infrastructure/wearables/platforms"],
  });

  const { data: healthAppData, isLoading: healthAppsLoading } = useQuery<HealthAppDashboard>({
    queryKey: ["/api/infrastructure/health-apps/dashboard"],
  });

  const portalDash = portalData?.dashboard;
  const wearablePlatforms = wearableData?.platforms || [];
  const healthAppDash = healthAppData?.dashboard;

  const totalPlatforms =
    (portalDash?.totalPlatforms || 0) +
    (wearableData?.totalPlatforms || 0) +
    (healthAppDash?.totalPlatforms || 0);

  const activeConnections =
    (portalDash?.activeConnections || 0) +
    (healthAppDash?.activeConnections || 0);

  const totalRecords =
    (portalDash?.totalRecords || 0) +
    (healthAppDash?.totalRecords || 0);

  const dataSources = 3;

  const isLoading = portalsLoading || wearablesLoading || healthAppsLoading;

  const newConnectors: WearablePlatformInfo[] = [
    {
      platform: "oura",
      displayName: "Oura Ring",
      description: "Smart ring for sleep, readiness scores, and activity tracking with temperature sensing",
      authType: "oauth2",
      capabilities: ["sleep", "hrv", "activity", "temperature", "blood_oxygen", "heart_rate"],
    },
    {
      platform: "whoop",
      displayName: "WHOOP",
      description: "Performance optimization wearable with strain tracking and recovery analytics",
      authType: "oauth2",
      capabilities: ["hrv", "respiratory_rate", "blood_oxygen", "sleep", "stress", "heart_rate", "calories"],
    },
    {
      platform: "suunto",
      displayName: "Suunto",
      description: "Sports watch platform with training load analysis and route tracking for outdoor activities",
      authType: "oauth2",
      capabilities: ["heart_rate", "activity", "calories", "steps"],
    },
  ];

  const allWearables = [
    ...wearablePlatforms.filter(
      (p) => !["oura", "whoop", "suunto"].includes(p.platform)
    ),
    ...newConnectors,
    ...wearablePlatforms.filter((p) =>
      ["oura", "whoop", "suunto"].includes(p.platform)
    ),
  ];

  const uniqueWearables = allWearables.reduce<WearablePlatformInfo[]>((acc, p) => {
    if (!acc.find((x) => x.platform === p.platform)) acc.push(p);
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto" data-testid="page-expanded-data-integration">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Expanded Data Integration
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Connect EHR portals, wearable devices, and health apps to centralize your health data
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="section-summary-stats">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Platforms</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-platforms">{totalPlatforms}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-active-connections">{activeConnections}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-records">{totalRecords.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-data-sources">{dataSources}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="portals" data-testid="tabs-data-integration">
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
              <TabsTrigger value="portals" data-testid="tab-trigger-portals">
                <Database className="h-4 w-4 mr-2" />
                Patient Portals
              </TabsTrigger>
              <TabsTrigger value="wearables" data-testid="tab-trigger-wearables">
                <Watch className="h-4 w-4 mr-2" />
                Wearable Devices
              </TabsTrigger>
              <TabsTrigger value="health-apps" data-testid="tab-trigger-health-apps">
                <Smartphone className="h-4 w-4 mr-2" />
                Health Apps
              </TabsTrigger>
            </TabsList>

            <TabsContent value="portals" className="space-y-6 mt-4" data-testid="tab-content-portals">
              {portalDash?.connections && portalDash.connections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold" data-testid="text-active-connections-header">Active Connections</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portalDash.connections.map((conn) => (
                      <Card key={conn.id} data-testid={`card-portal-connection-${conn.id}`}>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{conn.organizationName}</CardTitle>
                            <p className="text-sm text-muted-foreground">{conn.displayName}</p>
                          </div>
                          {getStatusBadge(conn.status)}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last sync: {formatSyncTime(conn.lastSync)}
                            </span>
                            <span className="font-medium" data-testid={`text-record-count-${conn.id}`}>
                              {conn.recordCount.toLocaleString()} records
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {conn.dataCategories.map((cat) => (
                              <Badge key={cat} variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-category-${cat}`}>
                                {formatCapability(cat)}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold" data-testid="text-available-platforms-header">Available Platforms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {portalDash?.platforms.map((platform) => (
                    <Card key={platform.platform} data-testid={`card-portal-platform-${platform.platform}`}>
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{platform.displayName}</CardTitle>
                          <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`badge-patient-count-${platform.platform}`}>
                            {platform.patientCount}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{platform.vendor}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">{platform.description}</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-auth-${platform.platform}`}>
                            <Shield className="h-3 w-3 mr-1" />
                            {platform.authMethod.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-fhir-${platform.platform}`}>
                            FHIR {platform.fhirVersion}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" disabled className="w-full" data-testid={`button-connect-portal-${platform.platform}`}>
                          Connect
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="wearables" className="space-y-6 mt-4" data-testid="tab-content-wearables">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold" data-testid="text-wearable-platforms-header">Wearable Platforms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uniqueWearables.map((platform) => (
                    <Card key={platform.platform} data-testid={`card-wearable-${platform.platform}`}>
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{platform.displayName}</CardTitle>
                          <Badge variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-auth-type-${platform.platform}`}>
                            {platform.authType}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">{platform.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {platform.capabilities.slice(0, 6).map((cap) => (
                            <Badge key={cap} variant="secondary" className="text-xs no-default-active-elevate" data-testid={`badge-capability-${platform.platform}-${cap}`}>
                              {formatCapability(cap)}
                            </Badge>
                          ))}
                          {platform.capabilities.length > 6 && (
                            <Badge variant="secondary" className="text-xs no-default-active-elevate">
                              +{platform.capabilities.length - 6} more
                            </Badge>
                          )}
                        </div>
                        <Button variant="outline" size="sm" disabled className="w-full" data-testid={`button-connect-wearable-${platform.platform}`}>
                          Connect
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="health-apps" className="space-y-6 mt-4" data-testid="tab-content-health-apps">
              {healthAppDash?.connections && healthAppDash.connections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold" data-testid="text-health-app-connections-header">Active Connections</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {healthAppDash.connections.map((conn) => (
                      <Card key={conn.id} data-testid={`card-health-app-connection-${conn.id}`}>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{conn.displayName}</CardTitle>
                            <p className="text-sm text-muted-foreground">@{conn.username}</p>
                          </div>
                          {getStatusBadge(conn.status)}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last sync: {formatSyncTime(conn.lastSync)}
                            </span>
                            <span className="font-medium" data-testid={`text-health-app-records-${conn.id}`}>
                              {conn.recordCount.toLocaleString()} records
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Sync: {conn.syncFrequency}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {conn.dataTypes.map((dt) => (
                              <Badge key={dt} variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-datatype-${conn.id}-${dt}`}>
                                {formatCapability(dt)}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold" data-testid="text-available-health-apps-header">Available Platforms</h3>
                {(["nutrition", "fitness", "wellness"] as const).map((category) => {
                  const categoryPlatforms = healthAppDash?.platforms.filter(
                    (p) => p.category === category
                  ) || [];
                  if (categoryPlatforms.length === 0) return null;
                  return (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2" data-testid={`text-category-${category}`}>
                        {category === "nutrition" && <Apple className="h-4 w-4" />}
                        {category === "fitness" && <Dumbbell className="h-4 w-4" />}
                        {category === "wellness" && <Heart className="h-4 w-4" />}
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryPlatforms.map((platform) => (
                          <Card key={platform.platform} data-testid={`card-health-app-platform-${platform.platform}`}>
                            <CardHeader className="space-y-1 pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base">{platform.displayName}</CardTitle>
                                <Badge variant="secondary" className="text-xs no-default-active-elevate" data-testid={`badge-userbase-${platform.platform}`}>
                                  {platform.userBase}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{platform.primaryFocus}</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <p className="text-sm text-muted-foreground line-clamp-2">{platform.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {platform.supportedDataTypes.slice(0, 4).map((dt) => (
                                  <Badge key={dt} variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-supported-${platform.platform}-${dt}`}>
                                    {formatCapability(dt)}
                                  </Badge>
                                ))}
                                {platform.supportedDataTypes.length > 4 && (
                                  <Badge variant="outline" className="text-xs no-default-active-elevate">
                                    +{platform.supportedDataTypes.length - 4} more
                                  </Badge>
                                )}
                              </div>
                              <Button variant="outline" size="sm" disabled className="w-full" data-testid={`button-connect-health-app-${platform.platform}`}>
                                Connect
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
