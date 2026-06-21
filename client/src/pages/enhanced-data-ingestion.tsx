import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileWarning,
  Layers,
  Play,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  Unplug,
  Wrench,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";

interface IngestionDashboard {
  totalErrors: number;
  unresolvedErrors: number;
  activeStreams: number;
  profilesGenerated: number;
  recentErrors: IngestionError[];
  streamingSummary: { connected: number; disconnected: number; error: number };
  qualityTrend: { date: string; score: number }[];
}

interface IngestionError {
  id: string;
  jobId: string;
  timestamp: string;
  severity: string;
  category: string;
  code: string;
  message: string;
  details: string;
  context: Record<string, unknown>;
  recovery: RecoveryAttempt[];
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

interface RecoveryAttempt {
  id: string;
  strategy: string;
  attemptedAt: string;
  success: boolean;
  result?: string;
}

interface StreamingSource {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  status: string;
  stats: StreamingStats;
  lastEventAt?: string;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StreamingStats {
  eventsReceived: number;
  eventsProcessed: number;
  eventsFailed: number;
  bytesReceived: number;
  averageLatencyMs: number;
  lastHourEvents: number;
  uptime: number;
  reconnectCount: number;
}

interface DataProfile {
  id: string;
  jobId?: string;
  createdAt: string;
  datasetName: string;
  recordCount: number;
  fieldProfiles: FieldProfile[];
  qualityScore: number;
  qualityDimensions: Record<string, QualityMetric>;
  structureAnalysis: StructureAnalysis;
  anomalies: DataAnomaly[];
  recommendations: ProfileRecommendation[];
  complianceFlags: ComplianceFlag[];
}

interface FieldProfile {
  name: string;
  dataType: string;
  inferredType: string;
  nullable: boolean;
  uniqueCount: number;
  nullCount: number;
  nullPercentage: number;
  statistics: { completeness: number; validity: number; consistency: number; uniqueness: number; accuracy: number };
}

interface QualityMetric {
  score: number;
  weight: number;
  issues: string[];
  affectedFields: string[];
}

interface StructureAnalysis {
  format: string;
  encoding: string;
  nestedDepth: number;
  arrayFields: string[];
  fhirCompliance?: { resourceType?: string; valid: boolean; errors: string[]; warnings: string[] };
}

interface DataAnomaly {
  id: string;
  type: string;
  severity: string;
  field: string;
  description: string;
  affectedRecords: number;
  suggestedAction: string;
}

interface ProfileRecommendation {
  priority: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  automatable: boolean;
}

interface ComplianceFlag {
  standard: string;
  rule: string;
  status: string;
  details: string;
  affectedFields: string[];
}

interface DataSourceValidation {
  id: string;
  sourceId: string;
  sourceName: string;
  triggeredAt: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "failed";
  checks: ValidationCheck[];
  overallScore: number;
  initialQualityProfile?: DataProfile;
  anomalyDetectionTriggered: boolean;
  anomalyResults?: DataAnomaly[];
  recommendations: string[];
}

interface ValidationCheck {
  id: string;
  type: string;
  name: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed" | "warning" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: {
    success: boolean;
    details: Record<string, unknown>;
    metrics?: Record<string, number | string>;
    warnings?: string[];
  };
  errorMessage?: string;
}

const QUALITY_COLORS = ["#22c55e", "#eab308", "#ef4444"];

const SOURCE_TYPES = [
  { value: "hl7_mllp", label: "HL7 MLLP" },
  { value: "fhir_subscription", label: "FHIR Subscription" },
  { value: "kafka", label: "Kafka" },
  { value: "websocket", label: "WebSocket" },
  { value: "file_watch", label: "File Watch" },
  { value: "api_poll", label: "API Poll" },
];

export default function EnhancedDataIngestion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedError, setSelectedError] = useState<IngestionError | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<DataProfile | null>(null);
  const [selectedValidation, setSelectedValidation] = useState<DataSourceValidation | null>(null);
  const [recoveryStrategy, setRecoveryStrategy] = useState("");
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState("");
  const [newSourceEndpoint, setNewSourceEndpoint] = useState("");

  const { data: dashboard, isLoading } = useQuery<IngestionDashboard>({
    queryKey: ["/api/enhanced-ingestion/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/enhanced-ingestion/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: errorsData } = useQuery<{ errors: IngestionError[] }>({
    queryKey: ["/api/enhanced-ingestion/errors"],
    queryFn: async () => {
      const res = await fetch("/api/enhanced-ingestion/errors");
      if (!res.ok) throw new Error("Failed to fetch errors");
      return res.json();
    },
  });

  const { data: sourcesData } = useQuery<{ sources: StreamingSource[] }>({
    queryKey: ["/api/enhanced-ingestion/streaming/sources"],
    queryFn: async () => {
      const res = await fetch("/api/enhanced-ingestion/streaming/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const { data: profilesData } = useQuery<{ profiles: DataProfile[] }>({
    queryKey: ["/api/enhanced-ingestion/profiles"],
    queryFn: async () => {
      const res = await fetch("/api/enhanced-ingestion/profiles");
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return res.json();
    },
  });

  const { data: validationsData } = useQuery<{ validations: DataSourceValidation[] }>({
    queryKey: ["/api/enhanced-ingestion/validations"],
    queryFn: async () => {
      const res = await fetch("/api/enhanced-ingestion/validations");
      if (!res.ok) throw new Error("Failed to fetch validations");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const resolveErrorMutation = useMutation({
    mutationFn: async ({ errorId, notes }: { errorId: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/errors/${errorId}/resolve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/errors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/dashboard"] });
      toast({ title: "Error resolved successfully" });
      setSelectedError(null);
    },
    onError: () => {
      toast({ title: "Failed to resolve error", variant: "destructive" });
    },
  });

  const recoverErrorMutation = useMutation({
    mutationFn: async ({ errorId, strategy }: { errorId: string; strategy: string }) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/errors/${errorId}/recover`, { strategy });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/errors"] });
      toast({ 
        title: data.success ? "Recovery successful" : "Recovery attempted",
        description: data.result,
      });
    },
    onError: () => {
      toast({ title: "Recovery failed", variant: "destructive" });
    },
  });

  const connectSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/streaming/sources/${sourceId}/connect`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/streaming/sources"] });
      toast({ title: "Streaming source connected" });
    },
  });

  const disconnectSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/streaming/sources/${sourceId}/disconnect`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/streaming/sources"] });
      toast({ title: "Streaming source disconnected" });
    },
  });

  const validateSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/streaming/sources/${sourceId}/validate`, {
        runSampleProfiling: true,
        triggerAnomalyDetection: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/validations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/profiles"] });
      toast({ 
        title: "Validation started",
        description: `Running ${data.checks?.length || 0} validation checks...`,
      });
    },
    onError: () => {
      toast({ title: "Failed to start validation", variant: "destructive" });
    },
  });

  const registerSourceMutation = useMutation({
    mutationFn: async ({ name, type, endpoint }: { name: string; type: string; endpoint: string }) => {
      const res = await apiRequest("POST", "/api/enhanced-ingestion/streaming/sources/register", {
        name,
        type,
        config: { endpoint },
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/streaming/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/validations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/profiles"] });
      toast({ 
        title: "Data source registered",
        description: `Validation score: ${data.validation?.overallScore || 0}%`,
      });
      setShowRegisterDialog(false);
      setNewSourceName("");
      setNewSourceType("");
      setNewSourceEndpoint("");
    },
    onError: () => {
      toast({ title: "Failed to register data source", variant: "destructive" });
    },
  });

  const rerunValidationMutation = useMutation({
    mutationFn: async (validationId: string) => {
      const res = await apiRequest("POST", `/api/enhanced-ingestion/validations/${validationId}/rerun`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-ingestion/validations"] });
      toast({ title: "Validation rerun initiated" });
    },
    onError: () => {
      toast({ title: "Failed to rerun validation", variant: "destructive" });
    },
  });

  const getValidationStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getCheckStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "running":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case "skipped":
        return <ChevronRight className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "fatal":
        return <Badge variant="destructive">Fatal</Badge>;
      case "critical":
        return <Badge className="bg-red-500">Critical</Badge>;
      case "error":
        return <Badge className="bg-orange-500">Error</Badge>;
      default:
        return <Badge variant="secondary">Warning</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500">Connected</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "reconnecting":
        return <Badge className="bg-yellow-500">Reconnecting</Badge>;
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(1)} GB`;
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="p-6 space-y-6" data-testid="enhanced-data-ingestion-page">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Database className="w-7 h-7 text-primary" />
          Enhanced Data Ingestion
        </h1>
        <p className="text-muted-foreground">
          Robust error handling, real-time streaming, and automated data profiling
        </p>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-errors">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${dashboard.unresolvedErrors > 0 ? "bg-red-100 dark:bg-red-900" : "bg-green-100 dark:bg-green-900"}`}>
                  <AlertTriangle className={`w-5 h-5 ${dashboard.unresolvedErrors > 0 ? "text-red-600" : "text-green-600"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard.unresolvedErrors}</p>
                  <p className="text-xs text-muted-foreground">Unresolved Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-streams">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <PlugZap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard.activeStreams}</p>
                  <p className="text-xs text-muted-foreground">Active Streams</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-profiles">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard.profilesGenerated}</p>
                  <p className="text-xs text-muted-foreground">Data Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-total-errors">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                  <FileWarning className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard.totalErrors}</p>
                  <p className="text-xs text-muted-foreground">Total Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-ingestion">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="streaming" data-testid="tab-streaming">
            <Activity className="w-4 h-4 mr-2" />
            Streaming
          </TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="profiling" data-testid="tab-profiling">
            <Layers className="w-4 h-4 mr-2" />
            Profiling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Trend</CardTitle>
                <CardDescription>7-day quality score trend</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboard.qualityTrend}>
                        <defs>
                          <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[80, 100]} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#22c55e"
                          fill="url(#qualityGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Streaming Summary</CardTitle>
                <CardDescription>Current streaming source status</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard && (
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Connected", value: dashboard.streamingSummary.connected },
                            { name: "Disconnected", value: dashboard.streamingSummary.disconnected },
                            { name: "Error", value: dashboard.streamingSummary.error },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                        >
                          {[0, 1, 2].map((index) => (
                            <Cell key={`cell-${index}`} fill={QUALITY_COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {dashboard && dashboard.recentErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Latest ingestion errors requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboard.recentErrors.map((error) => (
                    <div
                      key={error.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-md cursor-pointer hover-elevate"
                      onClick={() => setSelectedError(error)}
                      data-testid={`error-item-${error.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getSeverityBadge(error.severity)}
                        <div>
                          <p className="font-medium">{error.code}</p>
                          <p className="text-sm text-muted-foreground">{error.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {error.resolved ? (
                          <Badge className="bg-green-500">Resolved</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingestion Errors</CardTitle>
              <CardDescription>Error handling with recovery strategies</CardDescription>
            </CardHeader>
            <CardContent>
              {errorsData?.errors && errorsData.errors.length > 0 ? (
                <div className="space-y-3">
                  {errorsData.errors.map((error) => (
                    <div
                      key={error.id}
                      className={`p-4 rounded-lg border ${error.resolved ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-red-50 dark:bg-red-950/20 border-red-200"} cursor-pointer`}
                      onClick={() => setSelectedError(error)}
                      data-testid={`error-card-${error.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityBadge(error.severity)}
                            <Badge variant="outline">{error.category}</Badge>
                            <span className="text-sm font-mono">{error.code}</span>
                          </div>
                          <p className="font-medium mb-1">{error.message}</p>
                          <p className="text-sm text-muted-foreground">{error.details}</p>
                        </div>
                        <div className="text-right">
                          {error.resolved ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-sm">Resolved</span>
                            </div>
                          ) : (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedError(error); }}>
                              <Wrench className="w-4 h-4 mr-1" />
                              Resolve
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(error.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {error.recovery.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Recovery Attempts:</p>
                          <div className="flex flex-wrap gap-2">
                            {error.recovery.map((attempt) => (
                              <Badge
                                key={attempt.id}
                                variant={attempt.success ? "default" : "secondary"}
                                className={attempt.success ? "bg-green-500" : ""}
                              >
                                {attempt.strategy}: {attempt.success ? "Success" : "Failed"}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No errors to display</p>
                  <p className="text-sm">All ingestion jobs are running smoothly</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streaming" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Streaming Sources</CardTitle>
                <CardDescription>Real-time data streaming connections</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowRegisterDialog(true)}
                data-testid="button-add-source"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </CardHeader>
            <CardContent>
              {sourcesData?.sources && sourcesData.sources.length > 0 ? (
                <div className="space-y-4">
                  {sourcesData.sources.map((source) => (
                    <Card key={source.id} data-testid={`streaming-source-${source.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Server className="w-5 h-5" />
                              <h4 className="font-medium">{source.name}</h4>
                              {getStatusBadge(source.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{source.type.toUpperCase()}</Badge>
                              {source.lastEventAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Last event: {new Date(source.lastEventAt).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {source.status === "connected" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => disconnectSourceMutation.mutate(source.id)}
                                disabled={disconnectSourceMutation.isPending}
                                data-testid={`button-disconnect-${source.id}`}
                              >
                                <Unplug className="w-4 h-4 mr-1" />
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => connectSourceMutation.mutate(source.id)}
                                disabled={connectSourceMutation.isPending}
                                data-testid={`button-connect-${source.id}`}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Connect
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => validateSourceMutation.mutate(source.id)}
                              disabled={validateSourceMutation.isPending}
                              data-testid={`button-validate-${source.id}`}
                            >
                              <ShieldCheck className="w-4 h-4 mr-1" />
                              Validate
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-2 bg-muted rounded-md">
                            <p className="text-lg font-bold">{formatNumber(source.stats.eventsReceived)}</p>
                            <p className="text-xs text-muted-foreground">Events Received</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded-md">
                            <p className="text-lg font-bold">{formatNumber(source.stats.eventsProcessed)}</p>
                            <p className="text-xs text-muted-foreground">Processed</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded-md">
                            <p className="text-lg font-bold">{source.stats.averageLatencyMs}ms</p>
                            <p className="text-xs text-muted-foreground">Avg Latency</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded-md">
                            <p className="text-lg font-bold">{formatBytes(source.stats.bytesReceived)}</p>
                            <p className="text-xs text-muted-foreground">Data Received</p>
                          </div>
                        </div>

                        {source.errorCount > 0 && (
                          <Alert className="mt-3 bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {source.errorCount} errors encountered. {source.stats.eventsFailed} events failed to process.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <PlugZap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No streaming sources configured</p>
                  <p className="text-sm">Add a streaming source to enable real-time data ingestion</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Source Validations</CardTitle>
                <CardDescription>Automated validation checks, sample profiling, and anomaly detection</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {validationsData?.validations && validationsData.validations.length > 0 ? (
                <div className="space-y-4">
                  {validationsData.validations.map((validation) => (
                    <Card
                      key={validation.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedValidation(validation)}
                      data-testid={`validation-card-${validation.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <ShieldCheck className="w-5 h-5" />
                              <h4 className="font-medium">{validation.sourceName}</h4>
                              {getValidationStatusBadge(validation.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(validation.triggeredAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Score</span>
                              <Badge className={validation.overallScore >= 80 ? "bg-green-500" : validation.overallScore >= 50 ? "bg-yellow-500" : "bg-red-500"}>
                                {validation.overallScore}%
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {validation.checks.map((check) => (
                            <div key={check.id} className="flex items-center gap-1 text-xs">
                              {getCheckStatusIcon(check.status)}
                              <span>{check.name}</span>
                            </div>
                          ))}
                        </div>

                        {validation.anomalyResults && validation.anomalyResults.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span>{validation.anomalyResults.length} anomalies detected in sample data</span>
                          </div>
                        )}

                        {validation.initialQualityProfile && (
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <Layers className="w-4 h-4 text-purple-500" />
                            <span>Initial quality score: {validation.initialQualityProfile.qualityScore.toFixed(1)}%</span>
                          </div>
                        )}

                        <div className="flex justify-end mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              rerunValidationMutation.mutate(validation.id);
                            }}
                            disabled={rerunValidationMutation.isPending}
                            data-testid={`button-rerun-${validation.id}`}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Rerun
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No validations performed yet</p>
                  <p className="text-sm">Validate data sources from the Streaming tab or register new sources</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Profiles</CardTitle>
              <CardDescription>Automated data quality assessment and structure analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {profilesData?.profiles && profilesData.profiles.length > 0 ? (
                <div className="space-y-4">
                  {profilesData.profiles.map((profile) => (
                    <Card
                      key={profile.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedProfile(profile)}
                      data-testid={`profile-card-${profile.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h4 className="font-medium">{profile.datasetName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {profile.recordCount.toLocaleString()} records | {profile.fieldProfiles.length} fields
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Quality Score</span>
                              <Badge className={profile.qualityScore >= 90 ? "bg-green-500" : profile.qualityScore >= 70 ? "bg-yellow-500" : "bg-red-500"}>
                                {profile.qualityScore.toFixed(1)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(profile.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                          {Object.entries(profile.qualityDimensions).map(([name, metric]) => (
                            <div key={name} className="text-center">
                              <Progress value={metric.score} className="h-2 mb-1" />
                              <p className="text-xs capitalize">{name}</p>
                              <p className="text-xs font-medium">{metric.score.toFixed(0)}%</p>
                            </div>
                          ))}
                        </div>

                        {profile.anomalies.length > 0 && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm">{profile.anomalies.length} anomalies detected</span>
                          </div>
                        )}

                        {profile.complianceFlags.some((f) => f.status !== "compliant") && (
                          <div className="flex items-center gap-2 mt-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">
                              {profile.complianceFlags.filter((f) => f.status !== "compliant").length} compliance items need review
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No data profiles available</p>
                  <p className="text-sm">Profiles are automatically generated during data ingestion</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Details
            </DialogTitle>
            <DialogDescription>{selectedError?.code}</DialogDescription>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getSeverityBadge(selectedError.severity)}
                <Badge variant="outline">{selectedError.category}</Badge>
                {selectedError.resolved ? (
                  <Badge className="bg-green-500">Resolved</Badge>
                ) : (
                  <Badge variant="destructive">Unresolved</Badge>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Message:</p>
                <p className="text-sm">{selectedError.message}</p>
              </div>

              <div>
                <p className="font-medium mb-1">Details:</p>
                <p className="text-sm text-muted-foreground">{selectedError.details}</p>
              </div>

              {Object.keys(selectedError.context).length > 0 && (
                <div>
                  <p className="font-medium mb-1">Context:</p>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              )}

              {!selectedError.resolved && (
                <div className="pt-4 border-t space-y-3">
                  <p className="font-medium">Recovery Options:</p>
                  <div className="flex items-center gap-2">
                    <Select value={recoveryStrategy} onValueChange={setRecoveryStrategy}>
                      <SelectTrigger className="w-48" data-testid="select-recovery-strategy">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retry">Retry</SelectItem>
                        <SelectItem value="skip_record">Skip Record</SelectItem>
                        <SelectItem value="use_default">Use Default</SelectItem>
                        <SelectItem value="manual_review">Manual Review</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => recoverErrorMutation.mutate({ errorId: selectedError.id, strategy: recoveryStrategy })}
                      disabled={!recoveryStrategy || recoverErrorMutation.isPending}
                      data-testid="button-attempt-recovery"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Attempt Recovery
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => resolveErrorMutation.mutate({ errorId: selectedError.id, notes: "Manually resolved" })}
                    disabled={resolveErrorMutation.isPending}
                    data-testid="button-resolve-manually"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </div>
              )}

              {selectedError.resolved && selectedError.resolutionNotes && (
                <div className="pt-4 border-t">
                  <p className="font-medium mb-1">Resolution Notes:</p>
                  <p className="text-sm">{selectedError.resolutionNotes}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resolved at: {selectedError.resolvedAt && new Date(selectedError.resolvedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              {selectedProfile?.datasetName}
            </DialogTitle>
            <DialogDescription>
              {selectedProfile?.recordCount.toLocaleString()} records analyzed
            </DialogDescription>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Quality Score:</span>
                  <Badge className={selectedProfile.qualityScore >= 90 ? "bg-green-500" : selectedProfile.qualityScore >= 70 ? "bg-yellow-500" : "bg-red-500"}>
                    {selectedProfile.qualityScore.toFixed(1)}%
                  </Badge>
                </div>
                <Badge variant="outline">{selectedProfile.structureAnalysis.format.toUpperCase()}</Badge>
              </div>

              <div>
                <p className="font-medium mb-2">Quality Dimensions:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(selectedProfile.qualityDimensions).map(([name, metric]) => (
                    <div key={name} className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm capitalize">{name}</span>
                        <span className="text-sm font-medium">{metric.score.toFixed(0)}%</span>
                      </div>
                      <Progress value={metric.score} className="h-2" />
                      {metric.issues.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{metric.issues[0]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedProfile.anomalies.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Anomalies Detected:</p>
                  <div className="space-y-2">
                    {selectedProfile.anomalies.map((anomaly) => (
                      <Alert key={anomaly.id} className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm">{anomaly.field}: {anomaly.type}</AlertTitle>
                        <AlertDescription className="text-xs">
                          {anomaly.description} ({anomaly.affectedRecords} records affected)
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {selectedProfile.recommendations.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Recommendations:</p>
                  <div className="space-y-2">
                    {selectedProfile.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={rec.priority === "critical" ? "destructive" : rec.priority === "high" ? "default" : "secondary"}>
                            {rec.priority}
                          </Badge>
                          <span className="font-medium text-sm">{rec.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedProfile.complianceFlags.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Compliance Status:</p>
                  <div className="space-y-2">
                    {selectedProfile.complianceFlags.map((flag, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {flag.status === "compliant" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : flag.status === "needs_review" ? (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <Badge variant="outline">{flag.standard.toUpperCase()}</Badge>
                        <span className="text-sm">{flag.rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedValidation} onOpenChange={() => setSelectedValidation(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Validation Details
            </DialogTitle>
            <DialogDescription>
              {selectedValidation?.sourceName}
            </DialogDescription>
          </DialogHeader>
          {selectedValidation && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {getValidationStatusBadge(selectedValidation.status)}
                <Badge className={selectedValidation.overallScore >= 80 ? "bg-green-500" : selectedValidation.overallScore >= 50 ? "bg-yellow-500" : "bg-red-500"}>
                  Score: {selectedValidation.overallScore}%
                </Badge>
                {selectedValidation.anomalyDetectionTriggered && (
                  <Badge variant="outline">Anomaly Detection Run</Badge>
                )}
              </div>

              <div>
                <p className="font-medium mb-2">Validation Checks:</p>
                <div className="space-y-2">
                  {selectedValidation.checks.map((check) => (
                    <div key={check.id} className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getCheckStatusIcon(check.status)}
                          <span className="font-medium text-sm">{check.name}</span>
                        </div>
                        {check.durationMs && (
                          <span className="text-xs text-muted-foreground">{check.durationMs}ms</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{check.description}</p>
                      {check.result && (
                        <div className="mt-2 text-xs">
                          {check.result.metrics && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(check.result.metrics).map(([key, value]) => (
                                <Badge key={key} variant="outline">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {check.result.warnings && check.result.warnings.length > 0 && (
                            <div className="mt-1 text-amber-600 dark:text-amber-400">
                              {check.result.warnings.map((w, i) => (
                                <p key={i}>{w}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {check.errorMessage && (
                        <p className="mt-1 text-xs text-red-500">{check.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedValidation.anomalyResults && selectedValidation.anomalyResults.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Anomalies Detected:</p>
                  <div className="space-y-2">
                    {selectedValidation.anomalyResults.map((anomaly) => (
                      <Alert key={anomaly.id} className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm">{anomaly.field}: {anomaly.type}</AlertTitle>
                        <AlertDescription className="text-xs">
                          {anomaly.description} ({anomaly.affectedRecords} records)
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {selectedValidation.recommendations.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Recommendations:</p>
                  <div className="space-y-2">
                    {selectedValidation.recommendations.map((rec, idx) => (
                      <Alert key={idx}>
                        <Settings2 className="h-4 w-4" />
                        <AlertDescription>{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {selectedValidation.initialQualityProfile && (
                <div>
                  <p className="font-medium mb-2">Initial Quality Profile:</p>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4" />
                      <span className="text-sm">{selectedValidation.initialQualityProfile.datasetName}</span>
                      <Badge>{selectedValidation.initialQualityProfile.qualityScore.toFixed(1)}%</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(selectedValidation.initialQualityProfile.qualityDimensions).map(([name, metric]) => (
                        <div key={name} className="text-center">
                          <Progress value={metric.score} className="h-1 mb-1" />
                          <p className="text-xs capitalize">{name}: {metric.score.toFixed(0)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Register New Data Source
            </DialogTitle>
            <DialogDescription>
              Add a new data source with automated validation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source-name">Source Name</Label>
              <Input
                id="source-name"
                placeholder="e.g., EHR Data Feed"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                data-testid="input-source-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-type">Source Type</Label>
              <Select value={newSourceType} onValueChange={setNewSourceType}>
                <SelectTrigger data-testid="select-source-type">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-endpoint">Endpoint URL</Label>
              <Input
                id="source-endpoint"
                placeholder="e.g., https://api.example.com/fhir"
                value={newSourceEndpoint}
                onChange={(e) => setNewSourceEndpoint(e.target.value)}
                data-testid="input-source-endpoint"
              />
            </div>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                After registration, automated validation will run to verify connection, perform sample profiling, and detect anomalies.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => registerSourceMutation.mutate({
                name: newSourceName,
                type: newSourceType,
                endpoint: newSourceEndpoint,
              })}
              disabled={!newSourceName || !newSourceType || registerSourceMutation.isPending}
              data-testid="button-register-source"
            >
              {registerSourceMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Register & Validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
