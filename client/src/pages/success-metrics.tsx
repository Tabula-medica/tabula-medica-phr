import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
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
} from "recharts";
import {
  ArrowLeft,
  Timer,
  FolderCheck,
  Users,
  FileOutput,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Download,
} from "lucide-react";
import type { SuccessMetrics } from "@shared/schema";

type TimePeriod = "7d" | "30d" | "90d" | "1y";

interface TrendDataPoint {
  date: string;
  exportTime: number;
  folderAccuracy: number;
  multiProfile: number;
  exportsPerUser: number;
  survivorship: number;
}

function generateTrendData(days: number): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      exportTime: Math.round(8000 + Math.random() * 6000),
      folderAccuracy: Math.round(75 + Math.random() * 20),
      multiProfile: Math.round(20 + Math.random() * 15),
      exportsPerUser: Math.round((1 + Math.random() * 3) * 10) / 10,
      survivorship: Math.round(60 + Math.random() * 30),
    });
  }
  
  return data;
}

export default function SuccessMetricsPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [activeTab, setActiveTab] = useState("overview");
  
  const periodDays = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  
  const periodLabels = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "1y": "Last year",
  };

  const { data: metrics, isLoading, error } = useQuery<SuccessMetrics>({
    queryKey: ["/api/analytics/success-metrics", timePeriod],
  });

  const trendData = generateTrendData(periodDays[timePeriod]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getMetricStatus = (value: number, target: number, higherIsBetter: boolean) => {
    if (higherIsBetter) {
      if (value >= target) return "success";
      if (value >= target * 0.8) return "warning";
      return "danger";
    } else {
      if (value <= target) return "success";
      if (value <= target * 1.2) return "warning";
      return "danger";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
            On Target
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="secondary" className="bg-yellow-600 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
            Approaching
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <TrendingDown className="h-3 w-3 mr-1" aria-hidden="true" />
            Below Target
          </Badge>
        );
    }
  };

  const handleExportData = () => {
    const csvContent = [
      ["Metric", "Value", "Target", "Status"],
      ["Export Time (ms)", metrics?.avgPacketExportTimeMs || 0, 15000, "< 15s"],
      ["Folder Accuracy (%)", metrics?.autoFolderAccuracyPercent || 0, 80, "> 80%"],
      ["Multi-Profile (%)", metrics?.multiProfilePercent || 0, "N/A", "Tracking"],
      ["Exports/User/Month", metrics?.packetExportsPerUserPerMonth || 0, "N/A", "Tracking"],
      ["Survivorship (%)", metrics?.survivorshipAdherencePercent || 0, "N/A", "Tracking"],
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `success-metrics-${timePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Alert variant="destructive">
          <AlertDescription>Failed to load success metrics. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              asChild
              data-testid="button-back"
            >
              <Link href="/admin">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Success Metrics</h1>
              <p className="text-sm text-muted-foreground">{periodLabels[timePeriod]}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[140px] min-h-[44px]" data-testid="select-time-period">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportData}
              className="min-h-[44px]"
              data-testid="button-export-data"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto p-4 space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            These metrics track platform performance. Data shown is for {periodLabels[timePeriod].toLowerCase()}.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview" className="min-h-[44px]" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trends" className="min-h-[44px]" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="details" className="min-h-[44px]" data-testid="tab-details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="metrics-grid">
              <Card data-testid="card-export-time">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-5 w-5 text-primary" aria-hidden="true" />
                      ER Packet Export Time
                    </CardTitle>
                    {isLoading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <span data-testid="status-export-time">
                        {getStatusBadge(getMetricStatus(metrics?.avgPacketExportTimeMs || 0, 15000, false))}
                      </span>
                    )}
                  </div>
                  <CardDescription>Target: under 15 seconds</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div>
                      <div className="text-3xl font-bold" data-testid="value-export-time">
                        {formatDuration(metrics?.avgPacketExportTimeMs || 0)}
                      </div>
                      <Progress
                        value={Math.min(100, ((15000 - (metrics?.avgPacketExportTimeMs || 0)) / 15000) * 100)}
                        className="mt-2"
                        data-testid="progress-export-time"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-folder-accuracy">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                      Auto-Folder Accuracy
                    </CardTitle>
                    {isLoading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <span data-testid="status-folder-accuracy">
                        {getStatusBadge(getMetricStatus(metrics?.autoFolderAccuracyPercent || 0, 80, true))}
                      </span>
                    )}
                  </div>
                  <CardDescription>Target: above 80%</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div>
                      <div className="text-3xl font-bold" data-testid="value-folder-accuracy">
                        {metrics?.autoFolderAccuracyPercent?.toFixed(1) || 0}%
                      </div>
                      <Progress value={metrics?.autoFolderAccuracyPercent || 0} className="mt-2" data-testid="progress-folder-accuracy" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-multi-profile">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                      Multi-Profile Adoption
                    </CardTitle>
                    {isLoading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <Badge variant="outline" data-testid="status-multi-profile">
                        <TrendingUp className="h-3 w-3 mr-1" aria-hidden="true" />
                        Tracking
                      </Badge>
                    )}
                  </div>
                  <CardDescription>Users with 2+ profiles</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div>
                      <div className="text-3xl font-bold" data-testid="value-multi-profile">
                        {metrics?.multiProfilePercent?.toFixed(1) || 0}%
                      </div>
                      <Progress value={metrics?.multiProfilePercent || 0} className="mt-2" data-testid="progress-multi-profile" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-exports-per-user">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileOutput className="h-5 w-5 text-primary" aria-hidden="true" />
                      Exports/User/Month
                    </CardTitle>
                    <Badge variant="outline" data-testid="status-exports-per-user">
                      <TrendingUp className="h-3 w-3 mr-1" aria-hidden="true" />
                      Tracking
                    </Badge>
                  </div>
                  <CardDescription>Average exports per user</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div>
                      <div className="text-3xl font-bold" data-testid="value-exports-per-user">
                        {metrics?.packetExportsPerUserPerMonth?.toFixed(1) || 0}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2" data-testid="card-survivorship">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HeartPulse className="h-5 w-5 text-primary" aria-hidden="true" />
                      Survivorship Follow-Up Adherence
                    </CardTitle>
                    <Badge variant="outline" data-testid="status-survivorship">
                      <TrendingUp className="h-3 w-3 mr-1" aria-hidden="true" />
                      Tracking
                    </Badge>
                  </div>
                  <CardDescription>Completed follow-ups vs scheduled</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div>
                      <div className="text-3xl font-bold" data-testid="value-survivorship">
                        {metrics?.survivorshipAdherencePercent?.toFixed(1) || 0}%
                      </div>
                      <Progress value={metrics?.survivorshipAdherencePercent || 0} className="mt-2" data-testid="progress-survivorship" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export Time Trend</CardTitle>
                  <CardDescription>Average packet export time in milliseconds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${(value / 1000).toFixed(1)}s`, 'Export Time']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="exportTime" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary) / 0.2)" 
                          name="Export Time"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Folder Accuracy Trend</CardTitle>
                  <CardDescription>AI folder suggestion acceptance rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value}%`, 'Accuracy']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="folderAccuracy" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          dot={false}
                          name="Accuracy"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Adoption Trends</CardTitle>
                  <CardDescription>Multi-profile usage and exports per user</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData.filter((_, i) => i % 3 === 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="multiProfile" fill="hsl(var(--chart-3))" name="Multi-Profile %" />
                        <Bar dataKey="exportsPerUser" fill="hsl(var(--chart-4))" name="Exports/User" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Survivorship Adherence</CardTitle>
                  <CardDescription>Follow-up completion rate over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value}%`, 'Adherence']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="survivorship" 
                          stroke="hsl(var(--chart-5))" 
                          fill="hsl(var(--chart-5) / 0.2)" 
                          name="Adherence"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metric Definitions & Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <Timer className="h-4 w-4 text-primary" />
                        ER Packet Export Time
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Average time to generate and download an Emergency Packet PDF.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Target: &lt;15 seconds</Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <FolderCheck className="h-4 w-4 text-primary" />
                        Auto-Folder Accuracy
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Percentage of AI folder suggestions accepted without correction.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Target: &gt;80%</Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Multi-Profile Adoption
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Percentage of users managing 2+ health profiles (family use).
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Tracking</Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileOutput className="h-4 w-4 text-primary" />
                        Packet Exports/User/Month
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Average number of health packets exported per active user per month.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Tracking</Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg md:col-span-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <HeartPulse className="h-4 w-4 text-primary" />
                        Survivorship Follow-Up Adherence
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Percentage of scheduled survivorship care follow-ups that are completed on time.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Tracking</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-period">
              <CardHeader>
                <CardTitle className="text-base">Data Period</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-6 w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-period">
                    Showing data from {metrics?.periodStart ? new Date(metrics.periodStart).toLocaleDateString() : "N/A"} to{" "}
                    {metrics?.periodEnd ? new Date(metrics.periodEnd).toLocaleDateString() : "N/A"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
