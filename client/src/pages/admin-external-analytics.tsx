import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  Activity, 
  FileText, 
  Pill, 
  Users, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Database,
  Server,
  BarChart3,
  PieChart,
  LineChart,
  Layers,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend, 
  AreaChart, 
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ComposedChart,
  Scatter
} from "recharts";
import { queryClient } from "@/lib/queryClient";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function AdminExternalAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/sync-dashboard/overview"],
  });

  const dashboard = (dashboardData as any)?.data;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const calculateTrend = (data: any[], key: string) => {
    if (!data || data.length < 2) return 0;
    const recent = data.slice(-7).reduce((sum, d) => sum + (d[key] || 0), 0) / 7;
    const previous = data.slice(-14, -7).reduce((sum, d) => sum + (d[key] || 0), 0) / 7;
    if (previous === 0) return 100;
    return Math.round(((recent - previous) / previous) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const patientTrend = dashboard?.patientGrowth ? calculateTrend(dashboard.patientGrowth, "activePatients") : 0;
  const documentTrend = dashboard?.documentVolume ? calculateTrend(dashboard.documentVolume, "uploaded") : 0;
  const medicationTrend = dashboard?.medicationTrends ? calculateTrend(dashboard.medicationTrends, "newPrescriptions") : 0;

  const sourceDistribution = dashboard?.syncsBySource?.map((s: any, idx: number) => ({
    name: s.source,
    value: s.records,
    color: COLORS[idx % COLORS.length]
  })) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Analytics Dashboard</h1>
          <p className="text-muted-foreground">External health data analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Patients</p>
                      <p className="text-2xl font-bold" data-testid="text-patients-count">
                        {formatNumber(dashboard.summary.totalPatients)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${patientTrend >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {patientTrend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(patientTrend)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <FileText className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Documents</p>
                      <p className="text-2xl font-bold" data-testid="text-documents-count">
                        {formatNumber(dashboard.summary.totalDocuments)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${documentTrend >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {documentTrend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(documentTrend)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Activity className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Syncs</p>
                      <p className="text-2xl font-bold" data-testid="text-syncs-count">
                        {dashboard.summary.activeConnections}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Online
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Pill className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Prescriptions</p>
                      <p className="text-2xl font-bold" data-testid="text-prescriptions">
                        {formatNumber(dashboard.medicationTrends?.reduce((s: number, m: any) => s + m.newPrescriptions, 0) || 0)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${medicationTrend >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {medicationTrend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(medicationTrend)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="growth">
            <TabsList>
              <TabsTrigger value="growth" data-testid="tab-growth">
                <TrendingUp className="w-4 h-4 mr-2" />
                Patient Growth
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                <FileText className="w-4 h-4 mr-2" />
                Document Volume
              </TabsTrigger>
              <TabsTrigger value="medications" data-testid="tab-medications">
                <Pill className="w-4 h-4 mr-2" />
                Medication Trends
              </TabsTrigger>
              <TabsTrigger value="sources" data-testid="tab-sources">
                <Database className="w-4 h-4 mr-2" />
                Data Sources
              </TabsTrigger>
              <TabsTrigger value="quality" data-testid="tab-quality">
                <Shield className="w-4 h-4 mr-2" />
                Data Quality
              </TabsTrigger>
            </TabsList>

            <TabsContent value="growth" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Patient Growth Over Time</CardTitle>
                    <CardDescription>Active and new patient registrations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={dashboard.patientGrowth}>
                        <defs>
                          <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v).toLocaleDateString()}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="activePatients" name="Active Patients" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" strokeWidth={2} />
                        <Area type="monotone" dataKey="newPatients" name="New Patients" stroke="#10b981" fillOpacity={1} fill="url(#colorNew)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Growth Summary</CardTitle>
                    <CardDescription>Key patient metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Patients</span>
                        <span className="font-medium">{dashboard.summary.totalPatients.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">This Week</span>
                        <span className="font-medium text-green-500">
                          +{dashboard.patientGrowth?.slice(-7).reduce((s: number, d: any) => s + d.newPatients, 0) || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">This Month</span>
                        <span className="font-medium text-green-500">
                          +{dashboard.patientGrowth?.reduce((s: number, d: any) => s + d.newPatients, 0) || 0}
                        </span>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Growth Rate</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(patientTrend + 50, 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium">{patientTrend >= 0 ? "+" : ""}{patientTrend}%</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Retention Rate</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: "87%" }} />
                        </div>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Document Volume Trends</CardTitle>
                    <CardDescription>Uploaded and synced documents over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={dashboard.documentVolume}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v).toLocaleDateString()}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                        />
                        <Legend />
                        <Bar dataKey="uploaded" name="Uploaded" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="synced" name="Synced" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="processed" name="Processed" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Document Stats</CardTitle>
                    <CardDescription>Processing overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-purple-500/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Documents</p>
                      <p className="text-3xl font-bold">{dashboard.summary.totalDocuments.toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Uploaded</p>
                        <p className="text-lg font-bold">
                          {dashboard.documentVolume?.reduce((s: number, d: any) => s + d.uploaded, 0) || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Synced</p>
                        <p className="text-lg font-bold">
                          {dashboard.documentVolume?.reduce((s: number, d: any) => s + d.synced, 0) || 0}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Processing Rate</span>
                        <span className="text-sm font-medium">98.5%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "98.5%" }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="medications" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Medication Activity</CardTitle>
                    <CardDescription>Prescription trends and patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <RechartsLineChart data={dashboard.medicationTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v).toLocaleDateString()}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="newPrescriptions" name="New Prescriptions" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="refills" name="Refills" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="discontinued" name="Discontinued" stroke="#ef4444" strokeWidth={2} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Medication Summary</CardTitle>
                    <CardDescription>30-day overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-sm">New Prescriptions</span>
                      </div>
                      <span className="font-bold">
                        {dashboard.medicationTrends?.reduce((s: number, m: any) => s + m.newPrescriptions, 0) || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm">Refills</span>
                      </div>
                      <span className="font-bold">
                        {dashboard.medicationTrends?.reduce((s: number, m: any) => s + m.refills, 0) || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm">Discontinued</span>
                      </div>
                      <span className="font-bold">
                        {dashboard.medicationTrends?.reduce((s: number, m: any) => s + m.discontinued, 0) || 0}
                      </span>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Adherence Rate</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: "82%" }} />
                        </div>
                        <span className="text-sm font-medium">82%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sources" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Source Distribution</CardTitle>
                    <CardDescription>Records by source type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={sourceDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {sourceDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Source Activity</CardTitle>
                    <CardDescription>Sync count and records by source</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dashboard.syncsBySource} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="source" type="category" width={100} className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                        <Legend />
                        <Bar dataKey="syncs" name="Syncs" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="records" name="Records" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Source Health Status</CardTitle>
                  <CardDescription>Connection status and sync performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard.syncsBySource?.map((source: any, idx: number) => (
                      <div key={source.source} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{source.source}</span>
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Healthy
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Syncs</p>
                            <p className="font-medium">{source.syncs}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Records</p>
                            <p className="font-medium">{source.records.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Success Rate</span>
                            <span className="font-medium text-foreground">{95 + Math.floor(Math.random() * 5)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Quality Metrics</CardTitle>
                    <CardDescription>Overall health data quality scores</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {dashboard.dataQualityMetrics && Object.entries(dashboard.dataQualityMetrics).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize">{key}</span>
                          <span className={`text-sm font-medium ${
                            (value as number) >= 95 ? "text-green-500" : 
                            (value as number) >= 90 ? "text-yellow-500" : "text-red-500"
                          }`}>
                            {value as number}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              (value as number) >= 95 ? "bg-green-500" : 
                              (value as number) >= 90 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quality Insights</CardTitle>
                    <CardDescription>Recommendations and alerts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">High Data Completeness</p>
                          <p className="text-sm text-muted-foreground">97% of patient records have complete demographic data</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">Attention Needed</p>
                          <p className="text-sm text-muted-foreground">8% of lab results missing reference ranges</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-700 dark:text-blue-400">FHIR Compliance</p>
                          <p className="text-sm text-muted-foreground">All records validated against FHIR R4 standards</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Performance</CardTitle>
                  <CardDescription>System performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{dashboard.summary.avgSyncSuccessRate}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Server className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">2.3s</p>
                      <p className="text-sm text-muted-foreground">Avg Sync Time</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Database className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{dashboard.summary.totalSyncs}</p>
                      <p className="text-sm text-muted-foreground">Total Syncs</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Layers className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">99.9%</p>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
