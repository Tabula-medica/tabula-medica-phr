import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Brain, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  Settings,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Cpu,
  Database,
  Shield,
  Layers,
  ChevronRight,
  FlaskConical,
  Gauge,
  Zap,
  Target,
  Split,
  LineChart
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { clickable } from "@/lib/a11y";

interface PerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  latencyMs: number;
  throughputQps: number;
  driftScore: number;
  lastEvaluatedAt: string;
  evaluationDatasetSize: number;
}

interface ModelDeployment {
  id: string;
  modelId: string;
  version: string;
  environment: string;
  status: string;
  replicas: number;
  resourceAllocation: { cpu: string; memory: string; gpu?: string };
  endpoint?: string;
  healthStatus?: string;
  createdAt: string;
}

interface TrainingJob {
  id: string;
  modelId: string;
  version: string;
  status: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
}

interface DriftAlert {
  id: string;
  modelId: string;
  severity: string;
  driftType: string;
  detectedAt: string;
  message: string;
  acknowledged: boolean;
}

interface DriftMonitoringConfig {
  id: string;
  modelId: string;
  enabled: boolean;
  checkIntervalMinutes: number;
  thresholds: {
    dataDrift: number;
    conceptDrift: number;
    performanceDrift: number;
  };
  alertRecipients: string[];
  autoRetrainTrigger: boolean;
  autoRetrainThreshold: number;
  ruleEngineIntegration: {
    enabled: boolean;
    triggerRuleIds: string[];
    createTaskOnDrift: boolean;
    taskPriority: string;
  };
  lastCheckAt?: string;
  nextCheckAt?: string;
}

interface DriftCheckResult {
  id: string;
  modelId: string;
  checkTimestamp: string;
  metrics: {
    dataDriftScore: number;
    conceptDriftScore: number;
    performanceDriftScore: number;
    baselineAccuracy: number;
    currentAccuracy: number;
    sampleSize: number;
  };
  status: string;
  alertsGenerated: string[];
  tasksTriggered: string[];
}

interface ABExperiment {
  id: string;
  name: string;
  description: string;
  modelId: string;
  status: string;
  variants: ABVariant[];
  trafficAllocation: Record<string, number>;
  primaryMetric: string;
  secondaryMetrics: string[];
  statisticalConfig: {
    confidenceLevel: number;
    minimumSampleSize: number;
    minimumDuration: string;
  };
  startedAt?: string;
  completedAt?: string;
  winner?: string;
  results?: ABExperimentResults;
  createdAt: string;
}

interface ABVariant {
  id: string;
  name: string;
  modelVersion: string;
  isControl: boolean;
  sampleCount: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    latencyMs?: number;
    errorRate?: number;
  };
}

interface ABExperimentResults {
  winnerVariantId?: string;
  winnerConfidence?: number;
  statisticalSignificance: boolean;
  pValue?: number;
  effectSize?: number;
  recommendation: string;
}

interface RuleEngineAction {
  id: string;
  triggerId: string;
  triggerType: string;
  modelId: string;
  actionType: string;
  status: string;
  executedAt?: string;
  createdAt: string;
}

interface EnhancedDashboardData extends DashboardData {
  summary: DashboardData["summary"] & {
    activeExperiments: number;
    driftAlertsCount: number;
    pendingActions: number;
  };
  runningExperiments: ABExperiment[];
  recentDriftChecks: DriftCheckResult[];
  pendingRuleActions: RuleEngineAction[];
}

interface AIModel {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  currentVersion: string;
  performanceMetrics: PerformanceMetrics;
  deployments: ModelDeployment[];
  trainingJobs: TrainingJob[];
  driftAlerts: DriftAlert[];
}

interface DashboardData {
  summary: {
    totalModels: number;
    deployedModels: number;
    modelsByType: Record<string, number>;
    modelsByStatus: Record<string, number>;
  };
  activeDeployments: Array<{
    modelName: string;
    version: string;
    environment: string;
    healthStatus: string;
    metrics: PerformanceMetrics;
  }>;
  recentAlerts: DriftAlert[];
  activeTrainingJobs: TrainingJob[];
  noCdsDisclaimer: string;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "deployed":
    case "active":
    case "healthy":
    case "completed":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "training":
    case "deploying":
    case "validating":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "degraded":
    case "warning":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "failed":
    case "unhealthy":
    case "critical":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "retired":
    case "stopped":
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getModelTypeIcon(type: string) {
  switch (type) {
    case "risk_stratification":
      return <Shield className="h-4 w-4" />;
    case "diagnostic_assistance":
      return <Activity className="h-4 w-4" />;
    case "anomaly_detection":
      return <AlertTriangle className="h-4 w-4" />;
    case "predictive_analytics":
      return <TrendingUp className="h-4 w-4" />;
    default:
      return <Brain className="h-4 w-4" />;
  }
}

function formatMetricValue(value: number | undefined, isPercentage: boolean = true): string {
  if (value === undefined) return "N/A";
  return isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
}

function MetricsCard({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Accuracy</p>
        <p className="text-2xl font-bold" data-testid="text-metric-accuracy">
          {formatMetricValue(metrics.accuracy)}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Precision</p>
        <p className="text-2xl font-bold">{formatMetricValue(metrics.precision)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Recall</p>
        <p className="text-2xl font-bold">{formatMetricValue(metrics.recall)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">F1 Score</p>
        <p className="text-2xl font-bold">{formatMetricValue(metrics.f1Score)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">AUC</p>
        <p className="text-lg font-semibold">{formatMetricValue(metrics.auc)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Latency</p>
        <p className="text-lg font-semibold">{metrics.latencyMs}ms</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Throughput</p>
        <p className="text-lg font-semibold">{metrics.throughputQps} QPS</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Drift Score</p>
        <p className="text-lg font-semibold" data-testid="text-metric-drift">
          {formatMetricValue(metrics.driftScore, false)}
        </p>
      </div>
    </div>
  );
}

function ModelCard({ model, onViewDetails }: { model: AIModel; onViewDetails: () => void }) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`card-model-${model.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getModelTypeIcon(model.type)}
            <CardTitle className="text-lg">{model.name}</CardTitle>
          </div>
          <Badge className={getStatusColor(model.status)} data-testid={`badge-status-${model.id}`}>
            {model.status}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{model.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>v{model.currentVersion}</span>
          </div>
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            <span>{formatMetricValue(model.performanceMetrics.accuracy)} accuracy</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{model.performanceMetrics.latencyMs}ms</span>
          </div>
        </div>
        {model.deployments.filter(d => d.status === "active").length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              {model.deployments.filter(d => d.status === "active").length} active deployment(s)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeployDialog({ model, onDeploy }: { model: AIModel; onDeploy: (config: any) => void }) {
  const [version, setVersion] = useState(model.currentVersion);
  const [environment, setEnvironment] = useState("development");
  const [replicas, setReplicas] = useState("2");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Deploy Model</DialogTitle>
        <DialogDescription>
          Deploy {model.name} to an environment
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="version">Version</Label>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger data-testid="select-deploy-version">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={model.currentVersion}>{model.currentVersion} (current)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="environment">Environment</Label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger data-testid="select-deploy-environment">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="replicas">Replicas</Label>
          <Input 
            id="replicas" 
            type="number" 
            min="1" 
            max="10" 
            value={replicas}
            onChange={(e) => setReplicas(e.target.value)}
            data-testid="input-deploy-replicas"
          />
        </div>
      </div>
      <DialogFooter>
        <Button 
          onClick={() => onDeploy({ 
            version, 
            environment, 
            replicas: parseInt(replicas), 
            resourceAllocation: { cpu: "2", memory: "8Gi" }
          })}
          data-testid="button-deploy-confirm"
        >
          <Play className="mr-2 h-4 w-4" />
          Deploy
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RetrainDialog({ model, onRetrain }: { model: AIModel; onRetrain: (config: any) => void }) {
  const [trainingDataset, setTrainingDataset] = useState("");
  const [validationDataset, setValidationDataset] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Retrain Model</DialogTitle>
        <DialogDescription>
          Start a retraining job for {model.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="training-dataset">Training Dataset ID</Label>
          <Input 
            id="training-dataset"
            placeholder="e.g., dataset-train-2026-01"
            value={trainingDataset}
            onChange={(e) => setTrainingDataset(e.target.value)}
            data-testid="input-retrain-training-dataset"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="validation-dataset">Validation Dataset ID</Label>
          <Input 
            id="validation-dataset"
            placeholder="e.g., dataset-val-2026-01"
            value={validationDataset}
            onChange={(e) => setValidationDataset(e.target.value)}
            data-testid="input-retrain-validation-dataset"
          />
        </div>
      </div>
      <DialogFooter>
        <Button 
          onClick={() => onRetrain({ 
            trainingDatasetId: trainingDataset,
            validationDatasetId: validationDataset
          })}
          disabled={!trainingDataset || !validationDataset}
          data-testid="button-retrain-confirm"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Start Retraining
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function AIModelManagement() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedExperiment, setSelectedExperiment] = useState<ABExperiment | null>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<EnhancedDashboardData>({
    queryKey: ["/api/ai-model-management/enhanced-dashboard"]
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery<{ models: AIModel[]; total: number }>({
    queryKey: ["/api/ai-model-management/models"]
  });

  const { data: trainingJobs } = useQuery<{ jobs: TrainingJob[]; total: number }>({
    queryKey: ["/api/ai-model-management/training-jobs"]
  });

  const { data: driftAlerts } = useQuery<{ alerts: DriftAlert[]; total: number }>({
    queryKey: ["/api/ai-model-management/drift-alerts"]
  });

  const { data: driftMonitoring } = useQuery<{ configs: DriftMonitoringConfig[] }>({
    queryKey: ["/api/ai-model-management/drift-monitoring"]
  });

  const { data: abExperiments } = useQuery<{ experiments: ABExperiment[] }>({
    queryKey: ["/api/ai-model-management/ab-experiments"]
  });

  const deployMutation = useMutation({
    mutationFn: async ({ modelId, config }: { modelId: string; config: any }) => {
      return apiRequest("POST", `/api/ai-model-management/models/${modelId}/deploy`, config);
    },
    onSuccess: () => {
      toast({ title: "Deployment initiated", description: "Model deployment has started" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management"] });
    },
    onError: () => {
      toast({ title: "Deployment failed", description: "Failed to deploy model", variant: "destructive" });
    }
  });

  const retrainMutation = useMutation({
    mutationFn: async ({ modelId, config }: { modelId: string; config: any }) => {
      return apiRequest("POST", `/api/ai-model-management/models/${modelId}/retrain`, config);
    },
    onSuccess: () => {
      toast({ title: "Retraining started", description: "Model retraining job has been queued" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management"] });
    },
    onError: () => {
      toast({ title: "Retraining failed", description: "Failed to start retraining", variant: "destructive" });
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/ai-model-management/drift-alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      toast({ title: "Alert acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management/drift-alerts"] });
    }
  });

  const executeDriftCheckMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await apiRequest("POST", `/api/ai-model-management/drift-monitoring/${configId}/execute`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Drift check completed", 
        description: `Status: ${data.result?.status || "completed"}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management"] });
    },
    onError: () => {
      toast({ title: "Drift check failed", variant: "destructive" });
    }
  });

  const updateDriftConfigMutation = useMutation({
    mutationFn: async ({ configId, updates }: { configId: string; updates: Partial<DriftMonitoringConfig> }) => {
      return apiRequest("PATCH", `/api/ai-model-management/drift-monitoring/${configId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Configuration updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management/drift-monitoring"] });
    }
  });

  const startExperimentMutation = useMutation({
    mutationFn: async (experimentId: string) => {
      const response = await apiRequest("POST", `/api/ai-model-management/ab-experiments/${experimentId}/start`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Experiment started" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management/ab-experiments"] });
    },
    onError: () => {
      toast({ title: "Failed to start experiment", variant: "destructive" });
    }
  });

  const stopExperimentMutation = useMutation({
    mutationFn: async ({ experimentId, reason }: { experimentId: string; reason: string }) => {
      return apiRequest("POST", `/api/ai-model-management/ab-experiments/${experimentId}/stop`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Experiment stopped" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management/ab-experiments"] });
    }
  });

  const analyzeExperimentMutation = useMutation({
    mutationFn: async (experimentId: string) => {
      const response = await apiRequest("POST", `/api/ai-model-management/ab-experiments/${experimentId}/analyze`);
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedExperiment(data.experiment);
      toast({ 
        title: "Analysis complete",
        description: data.results?.statisticalSignificance 
          ? "Statistically significant winner found!" 
          : "No significant difference yet"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-model-management/ab-experiments"] });
    }
  });

  if (dashboardLoading || modelsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-7xl space-y-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Model Management</h1>
          <p className="text-muted-foreground">
            View, deploy, monitor, and retrain AI models for risk stratification and diagnostic assistance
          </p>
        </div>

        {dashboard?.noCdsDisclaimer && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>NO-CDS Compliance Notice</AlertTitle>
            <AlertDescription className="text-sm">
              {dashboard.noCdsDisclaimer}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-model-management" className="flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="models" data-testid="tab-models">Models</TabsTrigger>
            <TabsTrigger value="drift-monitoring" data-testid="tab-drift-monitoring">
              <Gauge className="mr-1 h-4 w-4" />
              Drift Monitoring
            </TabsTrigger>
            <TabsTrigger value="ab-testing" data-testid="tab-ab-testing">
              <FlaskConical className="mr-1 h-4 w-4" />
              A/B Testing
              {abExperiments && abExperiments.experiments.filter(e => e.status === "running").length > 0 && (
                <Badge className="ml-2 bg-blue-500/15 text-blue-700">
                  {abExperiments.experiments.filter(e => e.status === "running").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">Training Jobs</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              Drift Alerts
              {driftAlerts && driftAlerts.alerts.filter(a => !a.acknowledged).length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {driftAlerts.alerts.filter(a => !a.acknowledged).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Models</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-total-models">
                    {dashboard?.summary.totalModels || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Deployed Models</CardDescription>
                  <CardTitle className="text-3xl text-green-600" data-testid="text-deployed-models">
                    {dashboard?.summary.deployedModels || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Training Jobs</CardDescription>
                  <CardTitle className="text-3xl text-blue-600">
                    {dashboard?.activeTrainingJobs.length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Unacknowledged Alerts</CardDescription>
                  <CardTitle className="text-3xl text-orange-600">
                    {driftAlerts?.alerts.filter(a => !a.acknowledged).length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Active Deployments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard?.activeDeployments.map((deployment, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{deployment.modelName}</p>
                          <p className="text-sm text-muted-foreground">
                            v{deployment.version} - {deployment.environment}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(deployment.healthStatus)}>
                            {deployment.healthStatus}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatMetricValue(deployment.metrics.accuracy)} accuracy
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!dashboard?.activeDeployments || dashboard.activeDeployments.length === 0) && (
                      <p className="text-center text-muted-foreground">No active deployments</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Recent Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard?.recentAlerts.slice(0, 5).map((alert) => (
                      <div 
                        key={alert.id} 
                        className="flex items-start justify-between rounded-lg border p-3"
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-sm">{alert.driftType} drift</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                            {alert.message}
                          </p>
                        </div>
                        {!alert.acknowledged && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            data-testid={`button-acknowledge-${alert.id}`}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    ))}
                    {(!dashboard?.recentAlerts || dashboard.recentAlerts.length === 0) && (
                      <p className="text-center text-muted-foreground">No recent alerts</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            {selectedModel ? (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedModel(null)} data-testid="button-back-to-models">
                  <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                  Back to Models
                </Button>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      {getModelTypeIcon(selectedModel.type)}
                      <h2 className="text-2xl font-bold">{selectedModel.name}</h2>
                      <Badge className={getStatusColor(selectedModel.status)}>
                        {selectedModel.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">{selectedModel.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Version: {selectedModel.currentVersion}</span>
                      <span>Type: {selectedModel.type.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button data-testid="button-deploy-model">
                          <Play className="mr-2 h-4 w-4" />
                          Deploy
                        </Button>
                      </DialogTrigger>
                      <DeployDialog 
                        model={selectedModel} 
                        onDeploy={(config) => deployMutation.mutate({ modelId: selectedModel.id, config })}
                      />
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="button-retrain-model">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retrain
                        </Button>
                      </DialogTrigger>
                      <RetrainDialog 
                        model={selectedModel} 
                        onRetrain={(config) => retrainMutation.mutate({ modelId: selectedModel.id, config })}
                      />
                    </Dialog>
                  </div>
                </div>

                <Separator />

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>
                      Last evaluated: {new Date(selectedModel.performanceMetrics.lastEvaluatedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MetricsCard metrics={selectedModel.performanceMetrics} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Deployments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedModel.deployments.map((deployment) => (
                        <div 
                          key={deployment.id} 
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{deployment.environment}</Badge>
                              <span className="text-sm">v{deployment.version}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {deployment.replicas} replica(s) - {deployment.resourceAllocation.cpu} CPU, {deployment.resourceAllocation.memory} RAM
                              {deployment.resourceAllocation.gpu && `, ${deployment.resourceAllocation.gpu} GPU`}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge className={getStatusColor(deployment.status)}>
                              {deployment.status}
                            </Badge>
                            {deployment.healthStatus && (
                              <Badge className={getStatusColor(deployment.healthStatus)}>
                                {deployment.healthStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedModel.deployments.length === 0 && (
                        <p className="text-center text-muted-foreground">No deployments</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modelsData?.models.map((model) => (
                  <ModelCard 
                    key={model.id} 
                    model={model} 
                    onViewDetails={() => setSelectedModel(model)}
                  />
                ))}
                {(!modelsData?.models || modelsData.models.length === 0) && (
                  <div className="col-span-full text-center text-muted-foreground">
                    No models registered
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drift-monitoring" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Monitors</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-active-monitors">
                    {driftMonitoring?.configs.filter(c => c.enabled).length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Recent Drift Checks</CardDescription>
                  <CardTitle className="text-3xl text-blue-600">
                    {dashboard?.recentDriftChecks?.length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Rule Engine Actions</CardDescription>
                  <CardTitle className="text-3xl text-purple-600">
                    {dashboard?.pendingRuleActions?.length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Drift Monitoring Configurations
                </CardTitle>
                <CardDescription>
                  Configure automated drift detection thresholds and alert settings for each model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {driftMonitoring?.configs.map((config) => {
                    const model = modelsData?.models.find(m => m.id === config.modelId);
                    return (
                      <div 
                        key={config.id} 
                        className="rounded-lg border p-4"
                        data-testid={`drift-config-${config.id}`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <Switch 
                                checked={config.enabled}
                                onCheckedChange={(enabled) => 
                                  updateDriftConfigMutation.mutate({ 
                                    configId: config.id, 
                                    updates: { enabled } 
                                  })
                                }
                                data-testid={`switch-enabled-${config.id}`}
                              />
                              <span className="font-medium">{model?.name || config.modelId}</span>
                              <Badge className={config.enabled ? "bg-green-500/15 text-green-700" : "bg-gray-500/15 text-gray-700"}>
                                {config.enabled ? "Active" : "Paused"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Check Interval</p>
                                <p className="font-medium">{config.checkIntervalMinutes} min</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Last Check</p>
                                <p className="font-medium">
                                  {config.lastCheckAt ? new Date(config.lastCheckAt).toLocaleTimeString() : "Never"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Next Check</p>
                                <p className="font-medium">
                                  {config.nextCheckAt ? new Date(config.nextCheckAt).toLocaleTimeString() : "N/A"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Data Drift:</span>
                                <Badge variant="outline">{(config.thresholds.dataDrift * 100).toFixed(0)}%</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Concept Drift:</span>
                                <Badge variant="outline">{(config.thresholds.conceptDrift * 100).toFixed(0)}%</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Performance Drift:</span>
                                <Badge variant="outline">{(config.thresholds.performanceDrift * 100).toFixed(0)}%</Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {config.autoRetrainTrigger && (
                                <Badge className="bg-blue-500/15 text-blue-700">
                                  <Zap className="mr-1 h-3 w-3" />
                                  Auto-Retrain
                                </Badge>
                              )}
                              {config.ruleEngineIntegration.enabled && (
                                <Badge className="bg-purple-500/15 text-purple-700">
                                  <Target className="mr-1 h-3 w-3" />
                                  Rule Engine Integration
                                </Badge>
                              )}
                              {config.ruleEngineIntegration.createTaskOnDrift && (
                                <Badge variant="outline">
                                  Creates Tasks on Drift
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => executeDriftCheckMutation.mutate(config.id)}
                              disabled={executeDriftCheckMutation.isPending}
                              data-testid={`button-run-check-${config.id}`}
                            >
                              <Play className="mr-1 h-4 w-4" />
                              Run Check
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!driftMonitoring?.configs || driftMonitoring.configs.length === 0) && (
                    <p className="text-center text-muted-foreground">No drift monitoring configurations</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {dashboard?.recentDriftChecks && dashboard.recentDriftChecks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Recent Drift Check Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.recentDriftChecks.map((check) => (
                      <div key={check.id} className="rounded-lg border p-4" data-testid={`drift-check-${check.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(check.status)}>{check.status}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(check.checkTimestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Data Drift</p>
                                <p className="font-medium">{(check.metrics.dataDriftScore * 100).toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Concept Drift</p>
                                <p className="font-medium">{(check.metrics.conceptDriftScore * 100).toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Performance Drift</p>
                                <p className="font-medium">{(check.metrics.performanceDriftScore * 100).toFixed(2)}%</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Accuracy: {(check.metrics.baselineAccuracy * 100).toFixed(1)}% baseline → {(check.metrics.currentAccuracy * 100).toFixed(1)}% current
                            </p>
                          </div>
                          {check.alertsGenerated.length > 0 && (
                            <Badge variant="destructive">
                              {check.alertsGenerated.length} alert(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ab-testing" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Running Experiments</CardDescription>
                  <CardTitle className="text-3xl text-blue-600" data-testid="text-running-experiments">
                    {abExperiments?.experiments.filter(e => e.status === "running").length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Completed Experiments</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    {abExperiments?.experiments.filter(e => e.status === "completed").length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Draft Experiments</CardDescription>
                  <CardTitle className="text-3xl text-gray-600">
                    {abExperiments?.experiments.filter(e => e.status === "draft").length || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {selectedExperiment ? (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedExperiment(null)} data-testid="button-back-to-experiments">
                  <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                  Back to Experiments
                </Button>

                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FlaskConical className="h-5 w-5" />
                          {selectedExperiment.name}
                        </CardTitle>
                        <CardDescription className="mt-1">{selectedExperiment.description}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(selectedExperiment.status)}>
                        {selectedExperiment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Primary Metric</p>
                        <p className="font-medium">{selectedExperiment.primaryMetric}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Confidence Level</p>
                        <p className="font-medium">{(selectedExperiment.statisticalConfig.confidenceLevel * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Min Sample Size</p>
                        <p className="font-medium">{selectedExperiment.statisticalConfig.minimumSampleSize.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p className="font-medium">
                          {selectedExperiment.startedAt ? new Date(selectedExperiment.startedAt).toLocaleDateString() : "Not started"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="mb-4 font-medium">Variants</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {selectedExperiment.variants.map((variant) => (
                          <Card key={variant.id} className={variant.id === selectedExperiment.winner ? "border-green-500 border-2" : ""}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                  {variant.name}
                                  {variant.isControl && (
                                    <Badge variant="outline">Control</Badge>
                                  )}
                                  {variant.id === selectedExperiment.winner && (
                                    <Badge className="bg-green-500/15 text-green-700">Winner</Badge>
                                  )}
                                </CardTitle>
                                <span className="text-sm text-muted-foreground">v{variant.modelVersion}</span>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Samples</p>
                                  <p className="font-medium">{variant.sampleCount.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Traffic</p>
                                  <p className="font-medium">
                                    {selectedExperiment.trafficAllocation[variant.id] || 50}%
                                  </p>
                                </div>
                                {variant.metrics.accuracy !== undefined && (
                                  <div>
                                    <p className="text-muted-foreground">Accuracy</p>
                                    <p className="font-medium">{(variant.metrics.accuracy * 100).toFixed(1)}%</p>
                                  </div>
                                )}
                                {variant.metrics.f1Score !== undefined && (
                                  <div>
                                    <p className="text-muted-foreground">F1 Score</p>
                                    <p className="font-medium">{(variant.metrics.f1Score * 100).toFixed(1)}%</p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {selectedExperiment.results && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="mb-4 font-medium">Analysis Results</h4>
                          <Alert className={selectedExperiment.results.statisticalSignificance ? "border-green-500" : ""}>
                            <Target className="h-4 w-4" />
                            <AlertTitle>
                              {selectedExperiment.results.statisticalSignificance 
                                ? "Statistically Significant Result" 
                                : "No Significant Difference Yet"}
                            </AlertTitle>
                            <AlertDescription>
                              {selectedExperiment.results.recommendation}
                              {selectedExperiment.results.pValue && (
                                <p className="mt-2 text-sm">
                                  p-value: {selectedExperiment.results.pValue.toFixed(4)} | 
                                  Effect size: {selectedExperiment.results.effectSize?.toFixed(4) || "N/A"}
                                </p>
                              )}
                            </AlertDescription>
                          </Alert>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2">
                      {selectedExperiment.status === "draft" && (
                        <Button 
                          onClick={() => startExperimentMutation.mutate(selectedExperiment.id)}
                          data-testid="button-start-experiment"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start Experiment
                        </Button>
                      )}
                      {selectedExperiment.status === "running" && (
                        <>
                          <Button 
                            onClick={() => analyzeExperimentMutation.mutate(selectedExperiment.id)}
                            variant="outline"
                            data-testid="button-analyze-experiment"
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Analyze Results
                          </Button>
                          <Button 
                            onClick={() => stopExperimentMutation.mutate({ 
                              experimentId: selectedExperiment.id, 
                              reason: "Manual stop" 
                            })}
                            variant="destructive"
                            data-testid="button-stop-experiment"
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Stop Experiment
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Split className="h-5 w-5" />
                    A/B Experiments
                  </CardTitle>
                  <CardDescription>
                    Compare model versions with statistical rigor to determine the best performing variant
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {abExperiments?.experiments.map((experiment) => (
                      <div 
                        key={experiment.id} 
                        className="cursor-pointer rounded-lg border p-4 hover-elevate"
                        {...clickable(() => setSelectedExperiment(experiment))}
                        data-testid={`experiment-card-${experiment.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-4 w-4" />
                              <span className="font-medium">{experiment.name}</span>
                              <Badge className={getStatusColor(experiment.status)}>{experiment.status}</Badge>
                              {experiment.winner && (
                                <Badge className="bg-green-500/15 text-green-700">Has Winner</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {experiment.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{experiment.variants.length} variants</span>
                              <span>Primary: {experiment.primaryMetric}</span>
                              <span>
                                Samples: {experiment.variants.reduce((sum, v) => sum + v.sampleCount, 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                    {(!abExperiments?.experiments || abExperiments.experiments.length === 0) && (
                      <p className="text-center text-muted-foreground">No A/B experiments</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="training" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Jobs</CardTitle>
                <CardDescription>Monitor active and completed training jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trainingJobs?.jobs.map((job) => (
                    <div key={job.id} className="rounded-lg border p-4" data-testid={`training-job-${job.id}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                            <span className="font-medium">v{job.version}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Job ID: {job.id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : "Pending"}
                          </p>
                        </div>
                        {["queued", "preparing", "training", "evaluating"].includes(job.status) && (
                          <div className="w-32">
                            <Progress value={job.progress} className="h-2" />
                            <p className="mt-1 text-center text-xs text-muted-foreground">
                              {job.progress}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!trainingJobs?.jobs || trainingJobs.jobs.length === 0) && (
                    <p className="text-center text-muted-foreground">No training jobs</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Drift Alerts</CardTitle>
                <CardDescription>Monitor data and concept drift across deployed models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {driftAlerts?.alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`rounded-lg border p-4 ${alert.acknowledged ? "opacity-60" : ""}`}
                      data-testid={`drift-alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(alert.severity)}>{alert.severity}</Badge>
                            <Badge variant="outline">{alert.driftType} drift</Badge>
                            {alert.acknowledged && (
                              <Badge variant="secondary">Acknowledged</Badge>
                            )}
                          </div>
                          <p className="mt-2">{alert.message}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Detected: {new Date(alert.detectedAt).toLocaleString()}
                          </p>
                        </div>
                        {!alert.acknowledged && (
                          <Button 
                            variant="outline"
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            data-testid={`button-ack-alert-${alert.id}`}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!driftAlerts?.alerts || driftAlerts.alerts.length === 0) && (
                    <p className="text-center text-muted-foreground">No drift alerts</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
