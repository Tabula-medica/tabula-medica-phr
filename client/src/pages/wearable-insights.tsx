import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Watch, 
  Footprints, 
  Moon, 
  Heart, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Plus,
  Unplug,
  Battery,
  Zap,
  Brain,
  BarChart3,
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import { SiApple, SiFitbit, SiGooglefit, SiGarmin, SiSamsung } from "react-icons/si";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WearableDevice {
  id: string;
  provider: string;
  name: string;
  model: string;
  lastSync: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  batteryLevel?: number;
}

interface DailySteps {
  date: string;
  steps: number;
  distance: number;
  caloriesBurned: number;
  activeMinutes: number;
  floors?: number;
}

interface SleepData {
  date: string;
  totalMinutes: number;
  deepSleepMinutes: number;
  lightSleepMinutes: number;
  remSleepMinutes: number;
  awakeDuration: number;
  sleepEfficiency: number;
  bedtime: string;
  wakeTime: string;
  sleepScore?: number;
}

interface HeartRateData {
  timestamp: string;
  bpm: number;
  zone: string;
}

interface HeartRateVariability {
  date: string;
  avgHrv: number;
  minHrv: number;
  maxHrv: number;
}

interface ActivityData {
  date: string;
  type: string;
  duration: number;
  caloriesBurned: number;
  avgHeartRate?: number;
  distance?: number;
}

interface HealthCorrelation {
  id: string;
  type: string;
  title: string;
  description: string;
  correlationStrength: number;
  trend: "positive" | "negative" | "neutral";
  dataPoints: Array<{ x: number; y: number; date: string }>;
  insight: string;
  noCdsDisclaimer: string;
}

interface WearableSummary {
  todaySteps: number;
  weeklyAvgSteps: number;
  lastNightSleep: SleepData | null;
  avgSleepScore: number;
  restingHeartRate: number;
  avgHrv: number;
  activeMinutesToday: number;
  weeklyActiveMinutes: number;
  caloriesBurnedToday: number;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function DeviceCard({ device, onSync, onDisconnect, isSyncing }: { 
  device: WearableDevice; 
  onSync: () => void; 
  onDisconnect: () => void;
  isSyncing: boolean;
}) {
  const Icon = providerIcons[device.provider] || Watch;
  
  return (
    <Card className="hover-elevate" data-testid={`card-device-${device.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{device.name}</h4>
              <p className="text-sm text-muted-foreground">{device.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {device.batteryLevel && (
              <Badge variant="outline" className="gap-1">
                <Battery className="h-3 w-3" />
                {device.batteryLevel}%
              </Badge>
            )}
            <Badge variant={device.status === "connected" ? "default" : "secondary"}>
              {device.status === "connected" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {device.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            Last synced: {new Date(device.lastSync).toLocaleString()}
          </span>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onSync}
              disabled={isSyncing}
              data-testid={`button-sync-${device.id}`}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onDisconnect}
              data-testid={`button-disconnect-${device.id}`}
            >
              <Unplug className="h-3 w-3 mr-1" />
              Disconnect
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon: Icon, title, value, subtitle, trend, color = "primary" }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card data-testid={`card-summary-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <Icon className={`h-5 w-5 text-${color}`} />
          </div>
          {trend && (
            <Badge variant={trend === "up" ? "default" : trend === "down" ? "secondary" : "outline"}>
              {trend === "up" ? <TrendingUp className="h-3 w-3" /> : 
               trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CorrelationCard({ correlation }: { correlation: HealthCorrelation }) {
  const trendColor = correlation.trend === "positive" ? "text-green-600" : 
                     correlation.trend === "negative" ? "text-red-600" : "text-yellow-600";
  
  return (
    <Card className="hover-elevate" data-testid={`card-correlation-${correlation.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{correlation.title}</CardTitle>
            <CardDescription>{correlation.description}</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <BarChart3 className="h-3 w-3" />
            {Math.round(correlation.correlationStrength * 100)}% correlation
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="x" 
                type="number" 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis 
                dataKey="y" 
                type="number" 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                content={({ payload }) => {
                  if (payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover p-2 rounded-md border text-xs">
                        <p>Date: {formatDate(data.date)}</p>
                        <p>X: {data.x.toFixed(1)}</p>
                        <p>Y: {data.y.toFixed(1)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                data={correlation.dataPoints} 
                fill="hsl(var(--primary))"
                opacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm">{correlation.insight}</p>
          </div>
          
          <Alert variant="default" className="bg-amber-500/10 border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              {correlation.noCdsDisclaimer}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WearableInsights() {
  const [activeTab, setActiveTab] = useState("overview");
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null);

  const { data: devicesData, isLoading: devicesLoading } = useQuery<{ devices: WearableDevice[] }>({
    queryKey: ["/api/wearables/devices"]
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ summary: WearableSummary }>({
    queryKey: ["/api/wearables/summary"]
  });

  const { data: stepsData } = useQuery<{ data: DailySteps[] }>({
    queryKey: ["/api/wearables/steps", { days: 30 }]
  });

  const { data: sleepData } = useQuery<{ data: SleepData[] }>({
    queryKey: ["/api/wearables/sleep", { days: 30 }]
  });

  const { data: heartRateData } = useQuery<{ data: HeartRateData[] }>({
    queryKey: ["/api/wearables/heart-rate", { days: 7 }]
  });

  const { data: hrvData } = useQuery<{ data: HeartRateVariability[] }>({
    queryKey: ["/api/wearables/hrv", { days: 30 }]
  });

  const { data: activityData } = useQuery<{ data: ActivityData[] }>({
    queryKey: ["/api/wearables/activity", { days: 30 }]
  });

  const { data: correlationsData, isLoading: correlationsLoading } = useQuery<{ correlations: HealthCorrelation[] }>({
    queryKey: ["/api/wearables/correlations"]
  });

  const syncMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      setSyncingDevice(deviceId);
      return apiRequest("POST", "/api/wearables/sync", { deviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wearables"] });
      setSyncingDevice(null);
    },
    onError: () => {
      setSyncingDevice(null);
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("POST", "/api/wearables/disconnect", { deviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wearables/devices"] });
    }
  });

  const devices = devicesData?.devices || [];
  const summary = summaryData?.summary;
  const steps = stepsData?.data || [];
  const sleep = sleepData?.data || [];
  const heartRate = heartRateData?.data || [];
  const hrv = hrvData?.data || [];
  const activities = activityData?.data || [];
  const correlations = correlationsData?.correlations || [];

  const stepsGoal = 10000;
  const stepsProgress = summary ? (summary.todaySteps / stepsGoal) * 100 : 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Watch className="h-8 w-8 text-primary" />
            Wearable Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your health data from connected devices
          </p>
        </div>
        <Button data-testid="button-add-device">
          <Plus className="h-4 w-4 mr-2" />
          Connect Device
        </Button>
      </div>

      <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle>Educational Content Only</AlertTitle>
        <AlertDescription>
          Wearable data and health correlations are for informational and educational purposes only. 
          This information does NOT constitute medical advice. Always consult your healthcare provider 
          for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          <TabsTrigger value="sleep" data-testid="tab-sleep">Sleep</TabsTrigger>
          <TabsTrigger value="heart" data-testid="tab-heart">Heart</TabsTrigger>
          <TabsTrigger value="correlations" data-testid="tab-correlations">Correlations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={Footprints}
              title="Today's Steps"
              value={summary?.todaySteps?.toLocaleString() || "0"}
              subtitle={`Goal: ${stepsGoal.toLocaleString()}`}
              trend={summary && summary.todaySteps >= stepsGoal ? "up" : "neutral"}
            />
            <SummaryCard
              icon={Moon}
              title="Last Night's Sleep"
              value={summary?.lastNightSleep ? formatDuration(summary.lastNightSleep.totalMinutes) : "No data"}
              subtitle={summary?.lastNightSleep ? `Score: ${summary.lastNightSleep.sleepScore}` : undefined}
              trend={summary?.lastNightSleep && summary.lastNightSleep.sleepScore && summary.lastNightSleep.sleepScore >= 80 ? "up" : "neutral"}
            />
            <SummaryCard
              icon={Heart}
              title="Resting Heart Rate"
              value={`${summary?.restingHeartRate || 0} bpm`}
              subtitle="Last measured"
              trend="neutral"
            />
            <SummaryCard
              icon={Activity}
              title="Avg HRV"
              value={`${summary?.avgHrv || 0} ms`}
              subtitle="7-day average"
              trend={summary && summary.avgHrv >= 45 ? "up" : "neutral"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Footprints className="h-5 w-5" />
                Steps Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{summary?.todaySteps?.toLocaleString() || 0} steps</span>
                  <span className="text-muted-foreground">{stepsGoal.toLocaleString()} goal</span>
                </div>
                <Progress value={Math.min(stepsProgress, 100)} className="h-3" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Steps Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={steps.slice(-7)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip 
                        content={({ payload, label }) => {
                          if (payload && payload.length > 0) {
                            return (
                              <div className="bg-popover p-2 rounded-md border text-sm">
                                <p className="font-medium">{formatDate(label)}</p>
                                <p>{payload[0].value?.toLocaleString()} steps</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="steps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sleep Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sleep.slice(-7)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip 
                        content={({ payload, label }) => {
                          if (payload && payload.length > 0) {
                            return (
                              <div className="bg-popover p-2 rounded-md border text-sm">
                                <p className="font-medium">{formatDate(label)}</p>
                                <p>Score: {payload[0].value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="sleepScore" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Watch className="h-5 w-5" />
                Connected Devices
              </CardTitle>
              <CardDescription>
                Manage your wearable device connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {devicesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
              ) : devices.length === 0 ? (
                <div className="text-center py-8">
                  <Watch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No devices connected</p>
                  <Button className="mt-4" data-testid="button-connect-first-device">
                    <Plus className="h-4 w-4 mr-2" />
                    Connect Your First Device
                  </Button>
                </div>
              ) : (
                devices.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onSync={() => syncMutation.mutate(device.id)}
                    onDisconnect={() => disconnectMutation.mutate(device.id)}
                    isSyncing={syncingDevice === device.id}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              icon={Footprints}
              title="Weekly Avg Steps"
              value={summary?.weeklyAvgSteps?.toLocaleString() || "0"}
              subtitle="Past 7 days"
            />
            <SummaryCard
              icon={Flame}
              title="Calories Today"
              value={summary?.caloriesBurnedToday?.toLocaleString() || "0"}
              subtitle="From activity"
            />
            <SummaryCard
              icon={Clock}
              title="Active Minutes"
              value={summary?.weeklyActiveMinutes?.toString() || "0"}
              subtitle="This week"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>30-Day Steps History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={steps}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip 
                      content={({ payload, label }) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload as DailySteps;
                          return (
                            <div className="bg-popover p-3 rounded-md border text-sm space-y-1">
                              <p className="font-medium">{formatDate(label)}</p>
                              <p>Steps: {data.steps.toLocaleString()}</p>
                              <p>Distance: {data.distance.toFixed(2)} km</p>
                              <p>Calories: {data.caloriesBurned}</p>
                              <p>Active: {data.activeMinutes} min</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="steps" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No recent activities</p>
                  ) : (
                    activities.slice(-10).reverse().map((activity, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{activity.type.replace("_", " ")}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(activity.date)}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p>{formatDuration(activity.duration)}</p>
                          <p className="text-muted-foreground">{activity.caloriesBurned} cal</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sleep" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={Moon}
              title="Avg Sleep Duration"
              value={sleep.length > 0 ? formatDuration(Math.floor(sleep.reduce((s, d) => s + d.totalMinutes, 0) / sleep.length)) : "0h"}
              subtitle="Past 30 days"
            />
            <SummaryCard
              icon={Zap}
              title="Avg Sleep Score"
              value={summary?.avgSleepScore?.toString() || "0"}
              subtitle="Out of 100"
            />
            <SummaryCard
              icon={Brain}
              title="Avg Deep Sleep"
              value={sleep.length > 0 ? formatDuration(Math.floor(sleep.reduce((s, d) => s + d.deepSleepMinutes, 0) / sleep.length)) : "0h"}
              subtitle="Per night"
            />
            <SummaryCard
              icon={Activity}
              title="Sleep Efficiency"
              value={`${sleep.length > 0 ? Math.floor(sleep.reduce((s, d) => s + d.sleepEfficiency, 0) / sleep.length) : 0}%`}
              subtitle="Time asleep vs in bed"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sleep Breakdown (Last 7 Nights)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sleep.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip 
                      content={({ payload, label }) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload as SleepData;
                          return (
                            <div className="bg-popover p-3 rounded-md border text-sm space-y-1">
                              <p className="font-medium">{formatDate(label)}</p>
                              <p>Total: {formatDuration(data.totalMinutes)}</p>
                              <p>Deep: {formatDuration(data.deepSleepMinutes)}</p>
                              <p>REM: {formatDuration(data.remSleepMinutes)}</p>
                              <p>Light: {formatDuration(data.lightSleepMinutes)}</p>
                              <p>Score: {data.sleepScore}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="deepSleepMinutes" stackId="a" fill="#4f46e5" name="Deep" />
                    <Bar dataKey="remSleepMinutes" stackId="a" fill="#7c3aed" name="REM" />
                    <Bar dataKey="lightSleepMinutes" stackId="a" fill="#a78bfa" name="Light" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heart" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              icon={Heart}
              title="Resting Heart Rate"
              value={`${summary?.restingHeartRate || 0} bpm`}
              subtitle="Today's reading"
            />
            <SummaryCard
              icon={Activity}
              title="Avg HRV"
              value={`${summary?.avgHrv || 0} ms`}
              subtitle="7-day average"
              trend={summary && summary.avgHrv >= 45 ? "up" : "neutral"}
            />
            <SummaryCard
              icon={TrendingUp}
              title="HRV Trend"
              value={hrv.length >= 2 && hrv[hrv.length - 1].avgHrv > hrv[hrv.length - 2].avgHrv ? "Improving" : "Stable"}
              subtitle="Compared to yesterday"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Heart Rate Variability (30 Days)</CardTitle>
              <CardDescription>
                Higher HRV generally indicates better recovery and stress management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrv}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip 
                      content={({ payload, label }) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload as HeartRateVariability;
                          return (
                            <div className="bg-popover p-3 rounded-md border text-sm space-y-1">
                              <p className="font-medium">{formatDate(label)}</p>
                              <p>Avg: {data.avgHrv} ms</p>
                              <p>Min: {data.minHrv} ms</p>
                              <p>Max: {data.maxHrv} ms</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgHrv" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Alert variant="default" className="bg-amber-500/10 border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              Heart rate and HRV data are for informational purposes only. They do NOT diagnose or treat any medical condition. 
              Consult your healthcare provider for any heart-related concerns.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="correlations" className="space-y-6">
          <Alert variant="default" className="bg-blue-500/10 border-blue-500/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle>Understanding Health Correlations</AlertTitle>
            <AlertDescription>
              These correlations show patterns between your wearable data and health records. 
              Correlations do NOT prove causation and are for educational purposes only. 
              Always discuss health patterns with your healthcare provider.
            </AlertDescription>
          </Alert>

          {correlationsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 animate-pulse" />
              <p>Analyzing your health data correlations...</p>
            </div>
          ) : correlations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Not enough data to show correlations yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Connect a wearable device and sync data for at least 2 weeks to see health correlations.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {correlations.map(correlation => (
                <CorrelationCard key={correlation.id} correlation={correlation} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
