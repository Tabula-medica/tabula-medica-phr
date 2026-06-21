import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Database,
  Play,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  Layers,
  GitBranch,
  Shield,
  Zap,
  Bell,
  BarChart3,
  FileCheck,
  ArrowRight,
  XCircle,
  Server,
  FileText,
  Brain,
  TrendingUp,
} from "lucide-react";

interface DataSource {
  id: string;
  name: string;
  type: "ehr" | "lab" | "pharmacy" | "registry" | "payer" | "hie" | "custom";
  connectionConfig: {
    endpoint: string;
    authMethod: string;
    format: string;
  };
  schedule: {
    enabled: boolean;
    cronExpression: string;
    timezone: string;
    lastRun?: string;
    nextRun?: string;
  };
  status: "active" | "paused" | "error" | "pending";
  healthCheck: {
    lastCheck: string;
    status: "healthy" | "degraded" | "unavailable";
    latencyMs: number;
    errorMessage?: string;
  };
}

interface HarmonizationRule {
  id: string;
  name: string;
  description: string;
  ruleType: "code_mapping" | "standardization" | "reconciliation" | "transformation" | "enrichment";
  sourceField: string;
  targetField: string;
  priority: number;
  enabled: boolean;
  lastApplied?: string;
  successRate: number;
}

interface ValidationProfile {
  id: string;
  name: string;
  profileUrl: string;
  resourceTypes: string[];
  severity: "error" | "warning" | "info";
  enabled: boolean;
  autoRemediate: boolean;
}

interface PipelineStage {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  inputCount: number;
  outputCount: number;
  errorCount: number;
  details: Record<string, any>;
}

interface PipelineError {
  id: string;
  stage: string;
  severity: "critical" | "error" | "warning";
  code: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface PipelineRun {
  id: string;
  pipelineId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  stages: PipelineStage[];
  metrics: {
    totalRecordsProcessed: number;
    recordsIngested: number;
    recordsHarmonized: number;
    recordsValidated: number;
    recordsAnalyzed: number;
    validationPassRate: number;
    harmonizationSuccessRate: number;
    processingTimeMs: number;
    throughputRecordsPerSecond: number;
  };
  errors: PipelineError[];
}

interface CohortAnalysisTask {
  id: string;
  taskType: "prediction" | "pattern_discovery" | "causal_inference" | "risk_stratification";
  cohortId: string;
  cohortName: string;
  status: "pending" | "running" | "completed" | "failed";
  results?: {
    summary: string;
    findings: string[];
    confidence: number;
  };
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  dataSources: string[];
  harmonizationRules: string[];
  validationProfiles: string[];
  cohortAnalysisTasks: CohortAnalysisTask[];
  schedule: {
    enabled: boolean;
    cronExpression: string;
    timezone: string;
  };
  notificationConfig: {
    channels: string[];
    recipients: string[];
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
    notifyOnWarning: boolean;
  };
  status: "active" | "paused" | "error";
  lastRun?: PipelineRun;
}

interface PipelineHealth {
  overallStatus: "healthy" | "degraded" | "critical";
  dataSourceHealth: { healthy: number; degraded: number; unavailable: number };
  recentRunStats: { successful: number; failed: number; avgProcessingTimeMs: number };
  activeAlerts: number;
}

export default function FhirDataPipeline() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/fhir-pipeline/pipelines"],
  });

  const { data: dataSources = [] } = useQuery<DataSource[]>({
    queryKey: ["/api/fhir-pipeline/data-sources"],
  });

  const { data: harmonizationRules = [] } = useQuery<HarmonizationRule[]>({
    queryKey: ["/api/fhir-pipeline/harmonization-rules"],
  });

  const { data: validationProfiles = [] } = useQuery<ValidationProfile[]>({
    queryKey: ["/api/fhir-pipeline/validation-profiles"],
  });

  const { data: health } = useQuery<PipelineHealth>({
    queryKey: ["/api/fhir-pipeline/health"],
    refetchInterval: 30000,
  });

  const executeMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      const response = await apiRequest("POST", `/api/fhir-pipeline/pipelines/${pipelineId}/execute`);
      return response.json();
    },
    onSuccess: (run: PipelineRun) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-pipeline/pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-pipeline/health"] });
      toast({
        title: "Pipeline Execution Complete",
        description: `Processed ${run.metrics.totalRecordsProcessed} records with ${(run.metrics.validationPassRate * 100).toFixed(1)}% validation pass rate`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Pipeline Execution Failed",
        description: error.message || "Failed to execute pipeline",
        variant: "destructive",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/fhir-pipeline/harmonization-rules/${id}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-pipeline/harmonization-rules"] });
      toast({ title: "Rule Updated" });
    },
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/fhir-pipeline/data-sources/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-pipeline/data-sources"] });
      toast({ title: "Data Source Updated" });
    },
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
      case "healthy":
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case "paused":
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      case "running":
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Degraded</Badge>;
      case "error":
      case "failed":
      case "critical":
      case "unavailable":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getRuleTypeBadge(type: string) {
    const colors: Record<string, string> = {
      code_mapping: "bg-blue-500",
      standardization: "bg-purple-500",
      reconciliation: "bg-green-500",
      transformation: "bg-orange-500",
      enrichment: "bg-pink-500",
    };
    return <Badge className={colors[type] || "bg-gray-500"}>{type.replace("_", " ")}</Badge>;
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  const currentPipeline = selectedPipeline || (pipelines.length > 0 ? pipelines[0] : null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-primary" />
              FHIR Data Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated ingestion, harmonization, validation, and cohort analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <Badge
                className={
                  health.overallStatus === "healthy"
                    ? "bg-green-500"
                    : health.overallStatus === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }
              >
                <Activity className="w-4 h-4 mr-1" />
                {health.overallStatus}
              </Badge>
            )}
            {currentPipeline && (
              <Button
                onClick={() => executeMutation.mutate(currentPipeline.id)}
                disabled={executeMutation.isPending}
                data-testid="button-run-pipeline"
              >
                {executeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Run Pipeline
              </Button>
            )}
          </div>
        </div>

        {health && (
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-green-500">{health.dataSourceHealth.healthy}</span>
                  <span className="text-lg text-yellow-500">{health.dataSourceHealth.degraded}</span>
                  <span className="text-lg text-red-500">{health.dataSourceHealth.unavailable}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">healthy / degraded / unavailable</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Recent Runs (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-green-500">{health.recentRunStats.successful}</span>
                  <span className="text-lg text-red-500">{health.recentRunStats.failed}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">successful / failed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Avg Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatDuration(health.recentRunStats.avgProcessingTimeMs)}</p>
                <p className="text-xs text-muted-foreground mt-1">average pipeline run time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${health.activeAlerts > 0 ? "text-red-500" : "text-green-500"}`}>
                  {health.activeAlerts}
                </p>
                <p className="text-xs text-muted-foreground mt-1">unresolved critical errors</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Layers className="w-4 h-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">
              <Database className="w-4 h-4 mr-1" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="harmonization" data-testid="tab-harmonization">
              <RefreshCw className="w-4 h-4 mr-1" />
              Harmonize
            </TabsTrigger>
            <TabsTrigger value="validation" data-testid="tab-validation">
              <FileCheck className="w-4 h-4 mr-1" />
              Validate
            </TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">
              <Brain className="w-4 h-4 mr-1" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="errors" data-testid="tab-errors">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Errors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {pipelinesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : !currentPipeline ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No pipelines configured</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{currentPipeline.name}</CardTitle>
                        <CardDescription>{currentPipeline.description}</CardDescription>
                      </div>
                      {getStatusBadge(currentPipeline.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Data Sources</p>
                        <p className="font-medium">{currentPipeline.dataSources.length} configured</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Harmonization Rules</p>
                        <p className="font-medium">{currentPipeline.harmonizationRules.length} active</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Validation Profiles</p>
                        <p className="font-medium">{currentPipeline.validationProfiles.length} enabled</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Analysis Tasks</p>
                        <p className="font-medium">{currentPipeline.cohortAnalysisTasks.length} scheduled</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {currentPipeline.lastRun && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Last Pipeline Run
                      </CardTitle>
                      <CardDescription>
                        {new Date(currentPipeline.lastRun.startedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          {currentPipeline.lastRun.stages.map((stage, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="text-center">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    stage.status === "completed"
                                      ? "bg-green-500"
                                      : stage.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-gray-300"
                                  }`}
                                >
                                  {stage.status === "completed" ? (
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                  ) : stage.status === "failed" ? (
                                    <XCircle className="w-5 h-5 text-white" />
                                  ) : (
                                    <Clock className="w-5 h-5 text-white" />
                                  )}
                                </div>
                                <p className="text-xs mt-1">{stage.name}</p>
                              </div>
                              {i < (currentPipeline.lastRun?.stages.length ?? 0) - 1 && (
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="grid md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">{currentPipeline.lastRun.metrics.totalRecordsProcessed}</p>
                            <p className="text-xs text-muted-foreground">Records Processed</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">
                              {(currentPipeline.lastRun.metrics.harmonizationSuccessRate * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Harmonization Rate</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">
                              {(currentPipeline.lastRun.metrics.validationPassRate * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Validation Pass Rate</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">
                              {formatDuration(currentPipeline.lastRun.metrics.processingTimeMs)}
                            </p>
                            <p className="text-xs text-muted-foreground">Processing Time</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Schedule & Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="font-medium mb-2">Schedule</p>
                        <div className="flex items-center gap-2 mb-2">
                          <Switch checked={currentPipeline.schedule.enabled} disabled />
                          <span className="text-sm">
                            {currentPipeline.schedule.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Cron: {currentPipeline.schedule.cronExpression}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Timezone: {currentPipeline.schedule.timezone}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Notifications</p>
                        <div className="flex flex-wrap gap-2">
                          {currentPipeline.notificationConfig.channels.map((ch, i) => (
                            <Badge key={i} variant="outline">{ch}</Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {currentPipeline.notificationConfig.recipients.join(", ")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Integrated Data Sources
                </CardTitle>
                <CardDescription>
                  Scheduled ingestion from EHRs, labs, pharmacies, and other healthcare systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataSources.map((source) => (
                    <div
                      key={source.id}
                      className="p-4 border rounded-lg"
                      data-testid={`source-${source.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {source.connectionConfig.endpoint}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{source.type}</Badge>
                          {getStatusBadge(source.status)}
                          <Switch
                            checked={source.status === "active"}
                            onCheckedChange={(checked) =>
                              toggleSourceMutation.mutate({
                                id: source.id,
                                status: checked ? "active" : "paused",
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-4 gap-4 text-sm mt-3">
                        <div>
                          <p className="text-muted-foreground">Format</p>
                          <p className="font-medium">{source.connectionConfig.format}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Auth</p>
                          <p className="font-medium">{source.connectionConfig.authMethod}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Run</p>
                          <p className="font-medium">
                            {source.schedule.lastRun
                              ? new Date(source.schedule.lastRun).toLocaleString()
                              : "Never"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Health</p>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(source.healthCheck.status)}
                            <span className="text-xs">{source.healthCheck.latencyMs}ms</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="harmonization" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Harmonization Rules
                </CardTitle>
                <CardDescription>
                  Code mapping, standardization, and reconciliation rules for FHIR data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {harmonizationRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-4 border rounded-lg"
                      data-testid={`rule-${rule.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium">{rule.priority}</span>
                          </div>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">{rule.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRuleTypeBadge(rule.ruleType)}
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) =>
                              toggleRuleMutation.mutate({ id: rule.id, enabled: checked })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4 text-sm mt-3">
                        <div>
                          <p className="text-muted-foreground">Source</p>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{rule.sourceField}</code>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Target</p>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{rule.targetField}</code>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <div className="flex items-center gap-2">
                            <Progress value={rule.successRate * 100} className="w-20 h-2" />
                            <span className="text-sm">{(rule.successRate * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5" />
                  Validation Profiles
                </CardTitle>
                <CardDescription>
                  FHIR profile validation against US Core, HIPAA, and custom profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {validationProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="p-4 border rounded-lg"
                      data-testid={`profile-${profile.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            <p className="text-xs text-muted-foreground">{profile.profileUrl}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              profile.severity === "error"
                                ? "destructive"
                                : profile.severity === "warning"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {profile.severity}
                          </Badge>
                          {profile.autoRemediate && (
                            <Badge className="bg-blue-500">
                              <Zap className="w-3 h-3 mr-1" />
                              Auto-fix
                            </Badge>
                          )}
                          <Switch checked={profile.enabled} disabled />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.resourceTypes.map((rt, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{rt}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Cohort Analysis Tasks
                </CardTitle>
                <CardDescription>
                  AI-powered analysis including prediction, pattern discovery, and causal inference
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentPipeline?.cohortAnalysisTasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No analysis tasks configured</p>
                    <p className="text-sm">Add cohort analysis tasks to run on harmonized data</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentPipeline?.cohortAnalysisTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 border rounded-lg"
                        data-testid={`task-${task.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium">{task.cohortName}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {task.taskType.replace("_", " ")}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>
                        {task.results && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            <p className="text-sm mb-2">{task.results.summary}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground">Confidence:</span>
                              <Progress value={task.results.confidence * 100} className="w-20 h-2" />
                              <span className="text-xs">{(task.results.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <ul className="text-xs space-y-1">
                              {task.results.findings.slice(0, 3).map((f, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Pipeline Errors & Notifications
                </CardTitle>
                <CardDescription>
                  Error tracking and notification history for pipeline runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!currentPipeline?.lastRun || currentPipeline.lastRun.errors.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                    <p>No recent errors</p>
                    <p className="text-sm">Pipeline is running smoothly</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {currentPipeline.lastRun.errors.map((error) => (
                        <div
                          key={error.id}
                          className={`p-4 border rounded-lg ${
                            error.severity === "critical"
                              ? "border-red-500 bg-red-500/5"
                              : error.severity === "error"
                              ? "border-orange-500 bg-orange-500/5"
                              : "border-yellow-500 bg-yellow-500/5"
                          }`}
                          data-testid={`error-${error.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  error.severity === "critical"
                                    ? "destructive"
                                    : error.severity === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {error.severity}
                              </Badge>
                              <span className="font-medium">{error.stage}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(error.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{error.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span>Code: {error.code}</span>
                            {error.resolved && (
                              <Badge variant="outline" className="text-green-500">
                                Resolved
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
