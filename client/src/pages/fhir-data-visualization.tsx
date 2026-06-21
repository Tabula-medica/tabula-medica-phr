import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LiveEventStream } from "@/components/live-event-stream";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  FileCheck,
  GitMerge,
  Layers,
  LineChart as LineChartIcon,
  Network,
  RefreshCw,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
  Eye,
  Radio,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface DataQualityScore {
  patientId: string;
  patientName: string;
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  issueCount: number;
  lastUpdated: string;
  trend: "up" | "down" | "stable";
}

interface ReconciliationProgress {
  id: string;
  resourceType: string;
  totalRecords: number;
  matchedRecords: number;
  conflictingRecords: number;
  pendingReview: number;
  autoMerged: number;
  manuallyResolved: number;
  progress: number;
  lastActivity: string;
}

interface GatewayMetrics {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  lastHourTrend: number;
}

interface DrillDownData {
  type: "quality" | "reconciliation" | "gateway";
  id: string;
  title: string;
  data: unknown;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function FhirDataVisualization() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("24h");
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);

  const { data: dashboardData, isLoading, refetch, isFetching } = useQuery<{
    qualityScores: DataQualityScore[];
    reconciliationProgress: ReconciliationProgress[];
    gatewayMetrics: GatewayMetrics[];
    overview: {
      totalPatients: number;
      avgQualityScore: number;
      reconciliationRate: number;
      apiSuccessRate: number;
      activeConnections: number;
      pendingIssues: number;
    };
    trends: {
      qualityTrend: Array<{ date: string; score: number }>;
      reconciliationTrend: Array<{ date: string; matched: number; pending: number }>;
      apiTrend: Array<{ time: string; requests: number; errors: number; latency: number }>;
    };
  }>({
    queryKey: ["/api/fhir-visualization/dashboard", timeRange],
  });

  const handleDrillDown = (type: DrillDownData["type"], id: string, title: string, data: unknown) => {
    setDrillDownData({ type, id, title, data });
    setDrillDownOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const overview = dashboardData?.overview || {
    totalPatients: 0,
    avgQualityScore: 0,
    reconciliationRate: 0,
    apiSuccessRate: 0,
    activeConnections: 0,
    pendingIssues: 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            FHIR Data Visualization Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive dashboards for data quality, reconciliation, and API performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setSelectedTab("quality")} data-testid="card-quality-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-quality-score">{overview.avgQualityScore}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>+2.3% from last week</span>
            </div>
            <Progress value={overview.avgQualityScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setSelectedTab("reconciliation")} data-testid="card-reconciliation-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Reconciliation Rate</CardTitle>
            <GitMerge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-reconciliation-rate">{overview.reconciliationRate}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>{overview.totalPatients} patients processed</span>
            </div>
            <Progress value={overview.reconciliationRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setSelectedTab("gateway")} data-testid="card-api-success-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">API Success Rate</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-api-success-rate">{overview.apiSuccessRate}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Server className="h-3 w-3" />
              <span>{overview.activeConnections} active connections</span>
            </div>
            <Progress value={overview.apiSuccessRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-pending-issues">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-issues">{overview.pendingIssues}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Requires attention</span>
            </div>
            <div className="flex gap-1 mt-2">
              <Badge variant="destructive" className="text-xs">Critical: 3</Badge>
              <Badge variant="secondary" className="text-xs">High: 8</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Layers className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">
            <Shield className="h-4 w-4 mr-2" />
            Data Quality
          </TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">
            <GitMerge className="h-4 w-4 mr-2" />
            Reconciliation
          </TabsTrigger>
          <TabsTrigger value="gateway" data-testid="tab-gateway">
            <Network className="h-4 w-4 mr-2" />
            API Gateway
          </TabsTrigger>
          <TabsTrigger value="live" data-testid="tab-live">
            <Radio className="h-4 w-4 mr-2" />
            Live Events
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quality Score Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  Data Quality Trend
                </CardTitle>
                <CardDescription>Average quality score over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData?.trends?.qualityTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[0, 100]} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={CHART_COLORS[0]}
                        fill={CHART_COLORS[0]}
                        fillOpacity={0.3}
                        name="Quality Score"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Reconciliation Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Reconciliation Activity
                </CardTitle>
                <CardDescription>Records matched vs pending review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData?.trends?.reconciliationTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="matched" fill={CHART_COLORS[0]} name="Matched" />
                      <Bar dataKey="pending" fill={CHART_COLORS[2]} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* API Performance */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API Gateway Performance
                </CardTitle>
                <CardDescription>Request volume, errors, and latency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData?.trends?.apiTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="requests"
                        stroke={CHART_COLORS[0]}
                        name="Requests"
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="errors"
                        stroke={CHART_COLORS[3]}
                        name="Errors"
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="latency"
                        stroke={CHART_COLORS[1]}
                        name="Latency (ms)"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          <DataQualitySection
            qualityScores={dashboardData?.qualityScores || []}
            onDrillDown={(score) => handleDrillDown("quality", score.patientId, `Quality Details: ${score.patientName}`, score)}
          />
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-4">
          <ReconciliationSection
            progressData={dashboardData?.reconciliationProgress || []}
            onDrillDown={(item) => handleDrillDown("reconciliation", item.id, `Reconciliation: ${item.resourceType}`, item)}
          />
        </TabsContent>

        {/* API Gateway Tab */}
        <TabsContent value="gateway" className="space-y-4">
          <GatewaySection
            metrics={dashboardData?.gatewayMetrics || []}
            onDrillDown={(metric) => handleDrillDown("gateway", metric.endpoint, `Gateway: ${metric.endpoint}`, metric)}
          />
        </TabsContent>

        {/* Live Events Tab */}
        <TabsContent value="live" className="space-y-4">
          <LiveEventStream maxHeight="600px" showControls={true} />
        </TabsContent>
      </Tabs>

      {/* Drill-Down Dialog */}
      <DrillDownDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        data={drillDownData}
      />
    </div>
  );
}

function DataQualitySection({
  qualityScores,
  onDrillDown,
}: {
  qualityScores: DataQualityScore[];
  onDrillDown: (score: DataQualityScore) => void;
}) {
  const [sortBy, setSortBy] = useState<"score" | "issues">("score");

  const sortedScores = [...qualityScores].sort((a, b) => {
    if (sortBy === "score") return a.overallScore - b.overallScore;
    return b.issueCount - a.issueCount;
  });

  const avgMetrics = qualityScores.length > 0 ? {
    completeness: Math.round(qualityScores.reduce((sum, s) => sum + s.completeness, 0) / qualityScores.length),
    accuracy: Math.round(qualityScores.reduce((sum, s) => sum + s.accuracy, 0) / qualityScores.length),
    consistency: Math.round(qualityScores.reduce((sum, s) => sum + s.consistency, 0) / qualityScores.length),
    timeliness: Math.round(qualityScores.reduce((sum, s) => sum + s.timeliness, 0) / qualityScores.length),
  } : { completeness: 0, accuracy: 0, consistency: 0, timeliness: 0 };

  const radarData = [
    { metric: "Completeness", value: avgMetrics.completeness, fullMark: 100 },
    { metric: "Accuracy", value: avgMetrics.accuracy, fullMark: 100 },
    { metric: "Consistency", value: avgMetrics.consistency, fullMark: 100 },
    { metric: "Timeliness", value: avgMetrics.timeliness, fullMark: 100 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Quality Radar Chart */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Quality Dimensions
          </CardTitle>
          <CardDescription>Average scores across all patients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" className="text-xs" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke={CHART_COLORS[0]}
                  fill={CHART_COLORS[0]}
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {Object.entries(avgMetrics).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <span className="text-sm capitalize">{key}</span>
                <Badge variant={value >= 80 ? "default" : value >= 60 ? "secondary" : "destructive"}>
                  {value}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patient Quality Table */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Patient Data Quality Scores
              </CardTitle>
              <CardDescription>Click on a patient for detailed breakdown</CardDescription>
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "score" | "issues")}>
              <SelectTrigger className="w-40" data-testid="select-quality-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Score</SelectItem>
                <SelectItem value="issues">Sort by Issues</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Overall Score</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedScores.map((score) => (
                  <TableRow
                    key={score.patientId}
                    className="cursor-pointer hover-elevate"
                    onClick={() => onDrillDown(score)}
                    data-testid={`row-patient-${score.patientId}`}
                  >
                    <TableCell className="font-medium">{score.patientName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={score.overallScore} className="w-16 h-2" />
                        <span className="text-sm font-medium">{score.overallScore}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={score.issueCount > 5 ? "destructive" : score.issueCount > 0 ? "secondary" : "default"}>
                        {score.issueCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {score.trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                      {score.trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
                      {score.trend === "stable" && <CircleDot className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(score.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ReconciliationSection({
  progressData,
  onDrillDown,
}: {
  progressData: ReconciliationProgress[];
  onDrillDown: (item: ReconciliationProgress) => void;
}) {
  const totalRecords = progressData.reduce((sum, p) => sum + p.totalRecords, 0);
  const totalMatched = progressData.reduce((sum, p) => sum + p.matchedRecords, 0);
  const totalConflicting = progressData.reduce((sum, p) => sum + p.conflictingRecords, 0);
  const totalPending = progressData.reduce((sum, p) => sum + p.pendingReview, 0);

  const pieData = [
    { name: "Matched", value: totalMatched, color: CHART_COLORS[0] },
    { name: "Conflicting", value: totalConflicting, color: CHART_COLORS[3] },
    { name: "Pending", value: totalPending, color: CHART_COLORS[2] },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Reconciliation Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Records</span>
              <span className="font-bold">{totalRecords.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Successfully Matched</span>
              <span className="font-bold text-green-600">{totalMatched.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-600">Pending Review</span>
              <span className="font-bold text-yellow-600">{totalPending.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress by Resource Type */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Progress by Resource Type
          </CardTitle>
          <CardDescription>Click on a resource type for detailed view</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <div className="space-y-4">
              {progressData.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => onDrillDown(item)}
                  data-testid={`card-reconciliation-${item.resourceType}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      <span className="font-medium">{item.resourceType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.totalRecords} total</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <Progress value={item.progress} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{item.progress}% complete</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {item.matchedRecords} matched
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        {item.pendingReview} pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function GatewaySection({
  metrics,
  onDrillDown,
}: {
  metrics: GatewayMetrics[];
  onDrillDown: (metric: GatewayMetrics) => void;
}) {
  const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const avgLatency = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length)
    : 0;
  const overallErrorRate = metrics.length > 0
    ? (metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-4">
      {/* Gateway Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLatency}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallErrorRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Endpoints</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Endpoint Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Endpoint Performance
          </CardTitle>
          <CardDescription>Click on an endpoint for detailed metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Avg Response</TableHead>
                  <TableHead>P95</TableHead>
                  <TableHead>P99</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => {
                  const successRate = metric.totalRequests > 0
                    ? ((metric.successfulRequests / metric.totalRequests) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <TableRow
                      key={metric.endpoint}
                      className="cursor-pointer hover-elevate"
                      onClick={() => onDrillDown(metric)}
                      data-testid={`row-endpoint-${metric.endpoint.replace(/\//g, '-')}`}
                    >
                      <TableCell className="font-mono text-sm">{metric.endpoint}</TableCell>
                      <TableCell>{metric.totalRequests.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={parseFloat(successRate) >= 99 ? "default" : parseFloat(successRate) >= 95 ? "secondary" : "destructive"}>
                          {successRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>{metric.avgResponseTime}ms</TableCell>
                      <TableCell>{metric.p95ResponseTime}ms</TableCell>
                      <TableCell>{metric.p99ResponseTime}ms</TableCell>
                      <TableCell>
                        {metric.lastHourTrend > 0 ? (
                          <div className="flex items-center text-green-500">
                            <ArrowUpRight className="h-4 w-4" />
                            <span className="text-xs">{metric.lastHourTrend}%</span>
                          </div>
                        ) : metric.lastHourTrend < 0 ? (
                          <div className="flex items-center text-red-500">
                            <ArrowDownRight className="h-4 w-4" />
                            <span className="text-xs">{Math.abs(metric.lastHourTrend)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Stable</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function DrillDownDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DrillDownData | null;
}) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {data.title}
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown and historical data
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {data.type === "quality" && <QualityDrillDown data={data.data as DataQualityScore} />}
          {data.type === "reconciliation" && <ReconciliationDrillDown data={data.data as ReconciliationProgress} />}
          {data.type === "gateway" && <GatewayDrillDown data={data.data as GatewayMetrics} />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function QualityDrillDown({ data }: { data: DataQualityScore }) {
  const dimensions = [
    { name: "Completeness", value: data.completeness, description: "Required fields populated" },
    { name: "Accuracy", value: data.accuracy, description: "Data values are correct" },
    { name: "Consistency", value: data.consistency, description: "Data matches across sources" },
    { name: "Timeliness", value: data.timeliness, description: "Data is up to date" },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        {dimensions.map((dim) => (
          <Card key={dim.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{dim.name}</CardTitle>
              <CardDescription className="text-xs">{dim.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Progress value={dim.value} className="flex-1 h-3" />
                <span className="font-bold text-lg">{dim.value}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Issue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>Total Issues</span>
            <Badge variant={data.issueCount > 5 ? "destructive" : "secondary"}>{data.issueCount}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReconciliationDrillDown({ data }: { data: ReconciliationProgress }) {
  const statusBreakdown = [
    { label: "Auto-Merged", value: data.autoMerged, color: "text-green-500" },
    { label: "Manually Resolved", value: data.manuallyResolved, color: "text-blue-500" },
    { label: "Pending Review", value: data.pendingReview, color: "text-yellow-500" },
    { label: "Conflicting", value: data.conflictingRecords, color: "text-red-500" },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={data.progress} className="flex-1 h-3" />
              <span className="text-2xl font-bold">{data.progress}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statusBreakdown.map((status) => (
              <div key={status.label} className="flex items-center justify-between">
                <span className={status.color}>{status.label}</span>
                <span className="font-medium">{status.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GatewayDrillDown({ data }: { data: GatewayMetrics }) {
  const successRate = data.totalRequests > 0
    ? ((data.successfulRequests / data.totalRequests) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{successRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.errorRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Response Time Percentiles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Average</span>
              <span className="font-mono">{data.avgResponseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span>P95</span>
              <span className="font-mono">{data.p95ResponseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span>P99</span>
              <span className="font-mono">{data.p99ResponseTime}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
