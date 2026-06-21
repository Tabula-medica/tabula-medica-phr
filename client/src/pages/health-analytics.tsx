import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Heart,
  Moon,
  Apple,
  Dumbbell,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Droplets,
  Flame,
  Watch,
  Smartphone,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Settings,
  Download,
  Calendar,
  Clock,
  BarChart3,
  Brain,
  Shield,
  Link2,
  Unlink,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// Types
interface WearableDevice {
  id: string;
  platform: string;
  displayName: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSyncAt?: string;
  enabledDataTypes: string[];
  iconType: "watch" | "smartphone" | "activity" | "heart" | "droplets" | "zap" | "moon" | "dumbbell";
}

interface HealthMetric {
  label: string;
  value: string | number;
  unit: string;
  trend: "up" | "down" | "stable";
  trendValue: string;
  icon: React.ReactNode;
  color: string;
  goal?: number;
  current?: number;
}

interface TrendData {
  date: string;
  steps: number;
  calories: number;
  activeMinutes: number;
  sleep: number;
  heartRate: number;
  weight: number;
}

// Icon renderer for devices
function getDeviceIcon(iconType: WearableDevice["iconType"]) {
  const iconClass = "h-6 w-6";
  switch (iconType) {
    case "watch": return <Watch className={iconClass} />;
    case "smartphone": return <Smartphone className={iconClass} />;
    case "activity": return <Activity className={iconClass} />;
    case "heart": return <Heart className={iconClass} />;
    case "droplets": return <Droplets className={iconClass} />;
    case "zap": return <Zap className={iconClass} />;
    case "moon": return <Moon className={iconClass} />;
    case "dumbbell": return <Dumbbell className={iconClass} />;
    default: return <Watch className={iconClass} />;
  }
}

// Mock data
const mockDevices: WearableDevice[] = [
  {
    id: "device-1",
    platform: "apple_health",
    displayName: "Apple Watch Series 9",
    status: "connected",
    lastSyncAt: "2026-01-18T04:30:00Z",
    enabledDataTypes: ["steps", "heart_rate", "sleep", "workouts", "calories"],
    iconType: "watch",
  },
  {
    id: "device-2",
    platform: "fitbit",
    displayName: "Fitbit Sense 2",
    status: "disconnected",
    lastSyncAt: "2026-01-15T10:00:00Z",
    enabledDataTypes: ["steps", "sleep", "heart_rate"],
    iconType: "smartphone",
  },
  {
    id: "device-3",
    platform: "withings",
    displayName: "Withings Body+",
    status: "connected",
    lastSyncAt: "2026-01-18T06:00:00Z",
    enabledDataTypes: ["weight", "body_fat", "bmi"],
    iconType: "activity",
  },
];

const mockTrendData: TrendData[] = [
  { date: "Jan 12", steps: 8234, calories: 2150, activeMinutes: 45, sleep: 7.2, heartRate: 68, weight: 175 },
  { date: "Jan 13", steps: 10521, calories: 2380, activeMinutes: 62, sleep: 6.8, heartRate: 72, weight: 174.8 },
  { date: "Jan 14", steps: 6892, calories: 1980, activeMinutes: 35, sleep: 8.1, heartRate: 65, weight: 174.5 },
  { date: "Jan 15", steps: 12045, calories: 2520, activeMinutes: 78, sleep: 7.5, heartRate: 70, weight: 174.2 },
  { date: "Jan 16", steps: 9876, calories: 2290, activeMinutes: 55, sleep: 6.5, heartRate: 73, weight: 174.0 },
  { date: "Jan 17", steps: 11234, calories: 2410, activeMinutes: 68, sleep: 7.8, heartRate: 69, weight: 173.8 },
  { date: "Jan 18", steps: 7543, calories: 2100, activeMinutes: 42, sleep: 7.0, heartRate: 71, weight: 173.5 },
];

const mockHealthMetrics: HealthMetric[] = [
  {
    label: "Steps Today",
    value: "7,543",
    unit: "steps",
    trend: "down",
    trendValue: "-15%",
    icon: <Activity className="h-5 w-5" />,
    color: "text-blue-500",
    goal: 10000,
    current: 7543,
  },
  {
    label: "Heart Rate",
    value: "71",
    unit: "bpm",
    trend: "stable",
    trendValue: "0%",
    icon: <Heart className="h-5 w-5" />,
    color: "text-red-500",
  },
  {
    label: "Sleep Last Night",
    value: "7.0",
    unit: "hours",
    trend: "down",
    trendValue: "-10%",
    icon: <Moon className="h-5 w-5" />,
    color: "text-purple-500",
    goal: 8,
    current: 7,
  },
  {
    label: "Calories Burned",
    value: "2,100",
    unit: "kcal",
    trend: "up",
    trendValue: "+5%",
    icon: <Flame className="h-5 w-5" />,
    color: "text-orange-500",
    goal: 2500,
    current: 2100,
  },
  {
    label: "Active Minutes",
    value: "42",
    unit: "min",
    trend: "down",
    trendValue: "-38%",
    icon: <Zap className="h-5 w-5" />,
    color: "text-yellow-500",
    goal: 60,
    current: 42,
  },
  {
    label: "Water Intake",
    value: "6",
    unit: "glasses",
    trend: "up",
    trendValue: "+20%",
    icon: <Droplets className="h-5 w-5" />,
    color: "text-cyan-500",
    goal: 8,
    current: 6,
  },
];

const sleepStagesData = [
  { name: "Deep", value: 90, color: "#6366f1" },
  { name: "Light", value: 180, color: "#a5b4fc" },
  { name: "REM", value: 105, color: "#818cf8" },
  { name: "Awake", value: 45, color: "#e5e7eb" },
];

const weeklyActivityData = [
  { day: "Mon", workout: 45, steps: 8500 },
  { day: "Tue", workout: 60, steps: 10500 },
  { day: "Wed", workout: 30, steps: 6800 },
  { day: "Thu", workout: 75, steps: 12000 },
  { day: "Fri", workout: 55, steps: 9800 },
  { day: "Sat", workout: 90, steps: 15000 },
  { day: "Sun", workout: 40, steps: 7500 },
];

function getTrendIcon(trend: "up" | "down" | "stable") {
  switch (trend) {
    case "up": return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    case "down": return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    case "stable": return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "connected": return <Badge className="bg-green-500">Connected</Badge>;
    case "syncing": return <Badge className="bg-blue-500">Syncing...</Badge>;
    case "disconnected": return <Badge variant="secondary">Disconnected</Badge>;
    case "error": return <Badge variant="destructive">Error</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function MetricCard({ metric }: { metric: HealthMetric }) {
  const progress = metric.goal && metric.current ? (metric.current / metric.goal) * 100 : null;

  return (
    <Card className="hover-elevate" data-testid={`card-metric-${metric.label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg bg-muted ${metric.color}`}>
            {metric.icon}
          </div>
          <div className="flex items-center gap-1">
            {getTrendIcon(metric.trend)}
            <span className={`text-sm ${metric.trend === "up" ? "text-green-500" : metric.trend === "down" ? "text-red-500" : "text-gray-500"}`}>
              {metric.trendValue}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{metric.value}</span>
            <span className="text-sm text-muted-foreground">{metric.unit}</span>
          </div>
          <p className="text-sm text-muted-foreground">{metric.label}</p>
        </div>
        {progress !== null && (
          <div className="mt-3 space-y-1">
            <Progress value={Math.min(progress, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress)}% of daily goal
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceCard({ device, onConnect, onDisconnect, onSync }: { 
  device: WearableDevice; 
  onConnect: () => void; 
  onDisconnect: () => void;
  onSync: () => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-device-${device.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">{getDeviceIcon(device.iconType)}</div>
            <div>
              <h4 className="font-medium">{device.displayName}</h4>
              <p className="text-sm text-muted-foreground capitalize">{device.platform.replace("_", " ")}</p>
            </div>
          </div>
          {getStatusBadge(device.status)}
        </div>
        
        {device.lastSyncAt && (
          <p className="text-xs text-muted-foreground mt-3">
            Last synced: {new Date(device.lastSyncAt).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mt-3">
          {device.enabledDataTypes.slice(0, 4).map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type.replace("_", " ")}
            </Badge>
          ))}
          {device.enabledDataTypes.length > 4 && (
            <Badge variant="outline" className="text-xs">+{device.enabledDataTypes.length - 4}</Badge>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {device.status === "connected" ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={onSync}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </Button>
              <Button variant="outline" size="sm" onClick={onDisconnect}>
                <Unlink className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1" onClick={onConnect}>
              <Link2 className="h-3 w-3 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HealthAnalytics() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("7d");
  const [showConnectDevice, setShowConnectDevice] = useState(false);

  const devices = mockDevices;
  const trendData = mockTrendData;
  const healthMetrics = mockHealthMetrics;

  const handleConnectDevice = (platform: string) => {
    toast({
      title: "Connecting Device",
      description: `Initiating connection with ${platform}...`,
    });
    setShowConnectDevice(false);
  };

  const handleSyncDevice = (deviceId: string) => {
    toast({
      title: "Syncing",
      description: "Syncing health data from your device...",
    });
  };

  const handleDisconnectDevice = (deviceId: string) => {
    toast({
      title: "Device Disconnected",
      description: "Device has been disconnected from your account.",
    });
  };

  const connectedDevices = devices.filter(d => d.status === "connected").length;

  return (
    <div className="p-6 space-y-6" data-testid="page-health-analytics">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Health Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive view of your health data with AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={showConnectDevice} onOpenChange={setShowConnectDevice}>
            <DialogTrigger asChild>
              <Button data-testid="button-connect-device">
                <Plus className="h-4 w-4 mr-2" />
                Connect Device
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Connect a Device or App</DialogTitle>
                <DialogDescription>
                  Import your health data from wearables and health apps
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {[
                  { id: "apple_health", name: "Apple Health", icon: <Apple className="h-5 w-5" />, desc: "iPhone & Apple Watch" },
                  { id: "google_fit", name: "Google Fit", icon: <Activity className="h-5 w-5" />, desc: "Android devices" },
                  { id: "fitbit", name: "Fitbit", icon: <Smartphone className="h-5 w-5" />, desc: "Fitbit devices" },
                  { id: "garmin", name: "Garmin Connect", icon: <Watch className="h-5 w-5" />, desc: "Garmin watches" },
                  { id: "whoop", name: "WHOOP", icon: <Dumbbell className="h-5 w-5" />, desc: "WHOOP band" },
                  { id: "oura", name: "Oura Ring", icon: <Moon className="h-5 w-5" />, desc: "Oura Ring" },
                  { id: "withings", name: "Withings", icon: <Activity className="h-5 w-5" />, desc: "Scales & devices" },
                  { id: "dexcom", name: "Dexcom", icon: <Droplets className="h-5 w-5" />, desc: "CGM data" },
                ].map((platform) => (
                  <Button
                    key={platform.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleConnectDevice(platform.id)}
                    data-testid={`button-connect-${platform.id}`}
                  >
                    <div className="p-2 rounded-lg bg-muted mr-3">{platform.icon}</div>
                    <div className="text-left">
                      <div className="font-medium">{platform.name}</div>
                      <div className="text-xs text-muted-foreground">{platform.desc}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <Watch className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{connectedDevices}</div>
              <div className="text-sm text-muted-foreground">Connected Devices</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">76,345</div>
              <div className="text-sm text-muted-foreground">Steps This Week</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Moon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">6.8</div>
              <div className="text-sm text-muted-foreground">Avg Sleep (hrs)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
              <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">70</div>
              <div className="text-sm text-muted-foreground">Avg Heart Rate</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="sleep" data-testid="tab-sleep">
            <Moon className="h-4 w-4 mr-2" />
            Sleep
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <Heart className="h-4 w-4 mr-2" />
            Vitals
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Watch className="h-4 w-4 mr-2" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Brain className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Activity Trends
                </CardTitle>
                <CardDescription>Steps and calories over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="steps" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Steps" />
                    <Area yAxisId="right" type="monotone" dataKey="calories" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="Calories" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Heart Rate Trend
                </CardTitle>
                <CardDescription>Resting heart rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[55, 85]} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444" }} name="Heart Rate (bpm)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Activity Summary</CardTitle>
                <CardDescription>Workout minutes and steps by day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyActivityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="workout" fill="#8b5cf6" name="Workout (min)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="steps" fill="#3b82f6" name="Steps" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Goals</CardTitle>
                <CardDescription>Your progress toward daily goals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { label: "Steps", current: 7543, goal: 10000, color: "bg-blue-500" },
                  { label: "Active Minutes", current: 42, goal: 60, color: "bg-purple-500" },
                  { label: "Calories Burned", current: 2100, goal: 2500, color: "bg-orange-500" },
                  { label: "Stand Hours", current: 10, goal: 12, color: "bg-green-500" },
                ].map((goal) => (
                  <div key={goal.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{goal.label}</span>
                      <span className="font-medium">{goal.current.toLocaleString()} / {goal.goal.toLocaleString()}</span>
                    </div>
                    <Progress value={(goal.current / goal.goal) * 100} className={`h-3 ${goal.color}`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sleep" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sleep Duration Trend</CardTitle>
                <CardDescription>Hours of sleep over the past week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 10]} className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="sleep" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Sleep (hours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sleep Stages (Last Night)</CardTitle>
                <CardDescription>Breakdown of your sleep phases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width={250} height={250}>
                    <PieChart>
                      <Pie
                        data={sleepStagesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sleepStagesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {sleepStagesData.map((stage) => (
                    <div key={stage.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-sm">{stage.name}: {stage.value} min</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weight Trend</CardTitle>
                <CardDescription>Weight changes over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[170, 180]} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} name="Weight (lbs)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Vitals</CardTitle>
                <CardDescription>Latest measurements from your devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Blood Pressure", value: "128/82", unit: "mmHg", status: "normal", time: "Today, 6:30 AM" },
                  { label: "Resting Heart Rate", value: "71", unit: "bpm", status: "normal", time: "Today, 7:00 AM" },
                  { label: "Blood Oxygen", value: "98", unit: "%", status: "normal", time: "Today, 7:00 AM" },
                  { label: "Body Temperature", value: "98.6", unit: "°F", status: "normal", time: "Today, 6:00 AM" },
                  { label: "Weight", value: "173.5", unit: "lbs", status: "trending_down", time: "Today, 6:00 AM" },
                ].map((vital) => (
                  <div key={vital.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{vital.label}</p>
                      <p className="text-xs text-muted-foreground">{vital.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{vital.value} <span className="text-sm font-normal text-muted-foreground">{vital.unit}</span></p>
                      <Badge variant={vital.status === "normal" ? "outline" : "secondary"} className="text-xs">
                        {vital.status === "normal" ? "Normal" : vital.status === "trending_down" ? "↓ Trending Down" : vital.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onConnect={() => handleConnectDevice(device.platform)}
                onDisconnect={() => handleDisconnectDevice(device.id)}
                onSync={() => handleSyncDevice(device.id)}
              />
            ))}
            <Card className="flex items-center justify-center min-h-[200px] border-dashed cursor-pointer hover-elevate" onClick={() => setShowConnectDevice(true)}>
              <div className="text-center space-y-2">
                <div className="p-4 rounded-full bg-muted inline-flex">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">Connect a Device</p>
                <p className="text-sm text-muted-foreground">Add wearable or health app</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI Health Insights
                </CardTitle>
                <CardDescription>Personalized observations from your health data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    type: "positive",
                    title: "Improved Sleep Consistency",
                    description: "Your sleep schedule shows you've been going to bed within a 30-minute window for the past 5 days, which refers to better sleep hygiene.",
                  },
                  {
                    type: "attention",
                    title: "Activity Level Below Goal",
                    description: "Your step count data shows an average of 8,500 steps this week, which means you're at 85% of your 10,000 step goal.",
                  },
                  {
                    type: "positive",
                    title: "Weight Trend Positive",
                    description: "Your weight data states a gradual decrease of 1.5 lbs over the past week, which shows steady progress toward your goal.",
                  },
                  {
                    type: "info",
                    title: "Heart Rate Variability",
                    description: "Your HRV data refers to good recovery levels, with an average of 45ms this week.",
                  },
                ].map((insight, idx) => (
                  <div key={idx} className={`p-4 ${
                    insight.type === "positive" ? "bg-green-50 dark:bg-green-900/20" :
                    insight.type === "attention" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                    "bg-blue-50 dark:bg-blue-900/20"
                  }`}>
                    <div className="flex items-start gap-2">
                      {insight.type === "positive" ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" /> :
                       insight.type === "attention" ? <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" /> :
                       <Brain className="h-5 w-5 text-blue-500 shrink-0" />}
                      <div>
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Recommendations
                </CardTitle>
                <CardDescription>Suggested actions based on your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    priority: "high",
                    action: "Daily water intake observation",
                    reason: "Your hydration data shows an average of 6 glasses per day, which means you are 2 glasses below the recommended 8 glasses.",
                  },
                  {
                    priority: "medium",
                    action: "Walking activity observation",
                    reason: "Your step data refers to a slight decline on weekdays. Adding a short afternoon walk shows potential to help reach your goal.",
                  },
                  {
                    priority: "low",
                    action: "Sleep schedule observation",
                    reason: "Your sleep data states an average of 6.5 hours. Earlier bedtime shows potential to improve energy levels.",
                  },
                ].map((rec, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-muted/50 hover-elevate">
                    <div className="flex items-start gap-3">
                      <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"} className="text-xs">
                        {rec.priority}
                      </Badge>
                      <div>
                        <h4 className="font-medium">{rec.action}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
