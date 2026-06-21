import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Heart, 
  Moon, 
  Footprints, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Database,
  Eye,
  History,
  Lock,
  Loader2,
  Zap,
  Flame,
  BarChart3,
  Plus,
} from "lucide-react";
import { SiApple, SiFitbit, SiGooglefit, SiGarmin, SiSamsung } from "react-icons/si";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";

// All fields are optional to support granular consent-based filtering
// Only fields for which user has granted consent will be populated
interface ConsolidatedHealthData {
  vitals?: {
    heartRate?: { current: number; resting: number; trend: "up" | "down" | "stable" };
    hrv?: { current: number; average: number; trend: "up" | "down" | "stable" };
  };
  activity?: {
    stepsToday?: number;
    stepsGoal?: number;
    stepsProgress?: number;
    activeMinutes?: number;
    caloriesBurned?: number;
    distance?: number;
    floors?: number;
    weeklyTrend?: Array<{ date: string; steps: number }>;
  };
  sleep?: {
    lastNight: {
      totalHours: number;
      deepSleepPercent: number;
      remSleepPercent: number;
      efficiency: number;
      score?: number;
    } | null;
    weeklyAverage: number;
    trend: "improving" | "declining" | "stable";
  };
  sources: Array<{
    id: string;
    name: string;
    provider: string;
    lastSync: string;
    status: string;
    dataTypes: string[];
  }>;
  lastUpdated: string;
}

interface DataConsent {
  id: string;
  dataSource: string;
  dataTypes: string[];
  consentGiven: boolean;
  consentDate: string;
  expirationDate?: string;
  purpose: string;
  canShare: boolean;
  shareWith: string[];
}

interface AuditLogEntry {
  action: string;
  timestamp: string;
  actor: string;
  dataSource: string;
  consentId: string;
}

const providerIcons: Record<string, any> = {
  fitbit: SiFitbit,
  apple_health: SiApple,
  google_fit: SiGooglefit,
  garmin: SiGarmin,
  samsung_health: SiSamsung
};

const providerNames: Record<string, string> = {
  fitbit: "Fitbit",
  apple_health: "Apple Health",
  google_fit: "Google Fit",
  garmin: "Garmin Connect",
  samsung_health: "Samsung Health"
};

function TrendBadge({ trend }: { trend: "up" | "down" | "stable" | "improving" | "declining" }) {
  if (trend === "up" || trend === "improving") {
    return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30"><TrendingUp className="h-3 w-3 mr-1" /> Improving</Badge>;
  }
  if (trend === "down" || trend === "declining") {
    return <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30"><TrendingDown className="h-3 w-3 mr-1" /> Declining</Badge>;
  }
  return <Badge variant="outline">Stable</Badge>;
}

export default function ConsolidatedHealthDashboard() {
  useSEO({
    title: "Consolidated Health Dashboard | Tabula Medica",
    description: "View all your health data from connected wearables and apps in one place"
  });

  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: healthData, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<{
    success: boolean;
    data: ConsolidatedHealthData | null;
    requiresConsent?: boolean;
    message?: string;
    noCdsDisclaimer?: string;
    consentedDataTypes?: string[];
    availableSections?: string[];
    partialData?: boolean;
    partialDataMessage?: string;
  }>({
    queryKey: ["/api/health-data/consolidated"],
  });

  const { data: consentsData, isLoading: loadingConsents } = useQuery<{
    success: boolean;
    consents: DataConsent[];
  }>({
    queryKey: ["/api/health-data/consents"],
  });

  const { data: auditData } = useQuery<{
    success: boolean;
    auditLog: AuditLogEntry[];
  }>({
    queryKey: ["/api/health-data/audit-log"],
  });

  const { data: sourcesData } = useQuery<{
    success: boolean;
    sources: Array<{
      id: string;
      name: string;
      description: string;
      dataTypes: string[];
      icon: string;
    }>;
  }>({
    queryKey: ["/api/health-data/available-sources"],
  });

  const updateConsentMutation = useMutation({
    mutationFn: async (data: { dataSource: string; dataTypes: string[]; consentGiven: boolean }) => {
      return apiRequest("POST", "/api/health-data/consents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-data/consents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-data/consolidated"] });
      toast({ title: "Consent updated", description: "Your data sharing preferences have been saved." });
    },
  });

  const data = healthData?.data;
  const consents = consentsData?.consents || [];
  const auditLog = auditData?.auditLog || [];
  const availableSources = sourcesData?.sources || [];

  if (loadingHealth || loadingConsents) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-health-dashboard">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 px-4 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-consolidated-health">
            <Activity className="h-6 w-6 text-primary" />
            Consolidated Health Dashboard
          </h1>
          <p className="text-muted-foreground">
            All your health data from connected devices in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetchHealth()}
            data-testid="button-refresh-health"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert className="bg-amber-500/10 border-amber-500/30 mb-6">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200" data-testid="text-no-cds-disclaimer">
          <strong>NOT medical advice.</strong> This health data is for informational and educational purposes only. 
          Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2 hidden sm:block" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">
            <Database className="h-4 w-4 mr-2 hidden sm:block" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Shield className="h-4 w-4 mr-2 hidden sm:block" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2 hidden sm:block" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!data ? (
            <Card className="text-center py-12" data-testid="card-no-data">
              <CardContent>
                <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Health Data Available</h3>
                <p className="text-muted-foreground mb-4">
                  Connect wearable devices and grant consent to see your consolidated health data.
                </p>
                <Button onClick={() => setActiveTab("sources")} data-testid="button-connect-sources">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Data Sources
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {healthData?.partialData && healthData?.partialDataMessage && (
                <Alert className="bg-blue-500/10 border-blue-500/30" data-testid="alert-partial-data">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>Limited data shown based on your consent settings.</strong> {healthData.partialDataMessage}
                    <Button 
                      variant="link" 
                      className="p-0 ml-2 h-auto" 
                      onClick={() => setActiveTab("privacy")}
                      data-testid="link-manage-consents"
                    >
                      Manage Consents
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {data.activity?.stepsToday !== undefined && (
                  <Card data-testid="card-steps-today">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Footprints className="h-5 w-5 text-blue-600" />
                        </div>
                        <TrendBadge trend={(data.activity?.stepsProgress ?? 0) >= 100 ? "up" : "stable"} />
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold">{data.activity.stepsToday.toLocaleString()}</p>
                        <p className="text-sm font-medium">Steps Today</p>
                        <Progress value={data.activity?.stepsProgress ?? 0} className="mt-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {data.activity?.stepsProgress ?? 0}% of {(data.activity?.stepsGoal ?? 10000).toLocaleString()} goal
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {data.vitals?.heartRate && (
                  <Card data-testid="card-heart-rate">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-red-500/10">
                          <Heart className="h-5 w-5 text-red-600" />
                        </div>
                        <TrendBadge trend={data.vitals.heartRate.trend} />
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold">{data.vitals.heartRate.current} <span className="text-sm font-normal">bpm</span></p>
                        <p className="text-sm font-medium">Heart Rate</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Resting: {data.vitals.heartRate.resting} bpm
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {data.sleep && (
                  <Card data-testid="card-sleep">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Moon className="h-5 w-5 text-purple-600" />
                        </div>
                        <TrendBadge trend={data.sleep.trend} />
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold">
                          {data.sleep.lastNight ? data.sleep.lastNight.totalHours.toFixed(1) : "--"} <span className="text-sm font-normal">hrs</span>
                        </p>
                        <p className="text-sm font-medium">Last Night's Sleep</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Weekly avg: {data.sleep.weeklyAverage.toFixed(1)} hrs
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {data.activity?.caloriesBurned !== undefined && (
                  <Card data-testid="card-activity">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <Flame className="h-5 w-5 text-orange-600" />
                        </div>
                        <Badge variant="outline">{data.activity?.activeMinutes ?? 0} min</Badge>
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold">{data.activity.caloriesBurned.toLocaleString()}</p>
                        <p className="text-sm font-medium">Calories Burned</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Distance: {(data.activity?.distance ?? 0).toFixed(1)} km
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {data.activity?.weeklyTrend && data.activity.weeklyTrend.length > 0 && (
                <Card data-testid="card-weekly-activity">
                  <CardHeader>
                    <CardTitle>Weekly Activity Trend</CardTitle>
                    <CardDescription>Your step count over the past week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.activity.weeklyTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(date) => new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                            className="text-xs"
                          />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            formatter={(value: number) => [value.toLocaleString(), "Steps"]}
                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="steps" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary) / 0.2)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.sleep?.lastNight && (
                <Card data-testid="card-sleep-breakdown">
                  <CardHeader>
                    <CardTitle>Sleep Breakdown</CardTitle>
                    <CardDescription>Last night's sleep stages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Deep Sleep</p>
                        <p className="text-xl font-bold text-purple-600">{data.sleep.lastNight.deepSleepPercent}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">REM Sleep</p>
                        <p className="text-xl font-bold text-blue-600">{data.sleep.lastNight.remSleepPercent}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Efficiency</p>
                        <p className="text-xl font-bold text-green-600">{data.sleep.lastNight.efficiency}%</p>
                      </div>
                      {data.sleep.lastNight.score && (
                        <div>
                          <p className="text-sm text-muted-foreground">Sleep Score</p>
                          <p className="text-xl font-bold">{data.sleep.lastNight.score}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="text-xs text-muted-foreground text-center">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Connected Data Sources</h2>
            <p className="text-muted-foreground mb-4">
              Manage your connected health data sources
            </p>
          </div>

          {data?.sources && data.sources.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.sources.map((source) => {
                const Icon = providerIcons[source.provider] || Activity;
                return (
                  <Card key={source.id} data-testid={`card-source-${source.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{source.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {providerNames[source.provider] || source.provider}
                            </p>
                          </div>
                        </div>
                        <Badge className={source.status === "connected" ? "bg-green-500/20 text-green-700 dark:text-green-300" : ""}>
                          {source.status === "connected" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {source.status}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1">
                        {source.dataTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Last synced: {new Date(source.lastSync).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-muted-foreground">No data sources connected yet.</p>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Available Sources</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {availableSources.map((source) => {
                const Icon = providerIcons[source.id] || Activity;
                return (
                  <Card key={source.id} data-testid={`card-available-${source.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{source.name}</h4>
                          <p className="text-sm text-muted-foreground">{source.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {source.dataTypes.slice(0, 4).map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" data-testid={`button-connect-${source.id}`}>
                          <Plus className="h-4 w-4 mr-1" />
                          Connect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Your Data, Your Control</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              You decide which data sources can share information with your health record. 
              You can revoke access at any time.
            </AlertDescription>
          </Alert>

          <div>
            <h2 className="text-lg font-semibold mb-4">Data Sharing Consents</h2>
            <div className="space-y-4">
              {consents.length > 0 ? (
                consents.map((consent) => {
                  const Icon = providerIcons[consent.dataSource] || Activity;
                  return (
                    <Card key={consent.id} data-testid={`card-consent-${consent.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5" />
                            <div>
                              <h4 className="font-medium">{providerNames[consent.dataSource] || consent.dataSource}</h4>
                              <p className="text-sm text-muted-foreground">{consent.purpose}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`consent-${consent.id}`}
                                checked={consent.consentGiven}
                                onCheckedChange={(checked) => {
                                  updateConsentMutation.mutate({
                                    dataSource: consent.dataSource,
                                    dataTypes: consent.dataTypes,
                                    consentGiven: checked,
                                  });
                                }}
                                data-testid={`switch-consent-${consent.dataSource}`}
                              />
                              <Label htmlFor={`consent-${consent.id}`}>
                                {consent.consentGiven ? "Enabled" : "Disabled"}
                              </Label>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {consent.dataTypes.map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4">
                          <span>Granted: {new Date(consent.consentDate).toLocaleDateString()}</span>
                          {consent.expirationDate && (
                            <span>Expires: {new Date(consent.expirationDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No data consents configured yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Connect a data source to manage its permissions.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Data Access Audit Log</h2>
            <p className="text-muted-foreground mb-4">
              Track all consent changes and data access events
            </p>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {auditLog.length > 0 ? (
                auditLog.map((entry, index) => (
                  <Card key={index} data-testid={`audit-entry-${index}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            entry.action.includes("grant") ? "bg-green-500/20" : 
                            entry.action.includes("revoke") ? "bg-red-500/20" : "bg-blue-500/20"
                          }`}>
                            {entry.action.includes("grant") ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : entry.action.includes("revoke") ? (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            ) : (
                              <Eye className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium capitalize">
                              {entry.action.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {providerNames[entry.dataSource] || entry.dataSource}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{entry.actor}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No audit log entries yet.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
