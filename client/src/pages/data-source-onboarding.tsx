import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Server,
  FolderSync,
  Wifi,
  Radio,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Activity,
  BarChart3,
  Bell,
  Clock,
  Shield,
  Zap,
  FileText,
  Plus,
  ChevronRight,
  Video,
  X,
  Timer,
} from "lucide-react";

interface ConnectionConfig {
  type: "api" | "sftp" | "database" | "hl7_mllp" | "fhir_subscription" | "kafka";
  name: string;
  description?: string;
  endpoint?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  apiKey?: string;
  authType?: "none" | "basic" | "bearer" | "oauth2" | "api_key" | "mtls";
  sslEnabled?: boolean;
  timeout?: number;
}

interface OnboardingSession {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  connectionConfig: ConnectionConfig;
  connectionTestResult?: any;
  sampleDataProfile?: any;
  anomalyConfig?: any;
  registeredSourceId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errors: string[];
  progress: Array<{
    step: number;
    name: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    message?: string;
  }>;
}

interface RegisteredDataSource {
  id: string;
  name: string;
  type: string;
  qualityScore: number;
  qualityGrade: string;
  status: string;
  lastSyncAt?: string;
  totalRecordsSynced: number;
  registeredAt: string;
  anomalyAlerts: any[];
}

const sourceTypeIcons: Record<string, any> = {
  api: Server,
  sftp: FolderSync,
  database: Database,
  hl7_mllp: MessageSquare,
  fhir_subscription: Radio,
  kafka: Wifi,
};

const sourceTypeLabels: Record<string, string> = {
  api: "REST API / FHIR Endpoint",
  sftp: "SFTP File Transfer",
  database: "Database Connection",
  hl7_mllp: "HL7 MLLP Interface",
  fhir_subscription: "FHIR Subscription",
  kafka: "Kafka Stream",
};

const STEP_TIMES_MINUTES = [3, 2, 3, 2, 1];
const TOTAL_ESTIMATED_MINUTES = STEP_TIMES_MINUTES.reduce((a, b) => a + b, 0);

export default function DataSourceOnboarding() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("wizard");
  const [wizardStep, setWizardStep] = useState(0);
  const [currentSession, setCurrentSession] = useState<OnboardingSession | null>(null);
  const [showVideo, setShowVideo] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [config, setConfig] = useState<ConnectionConfig>({
    type: "api",
    name: "",
    endpoint: "",
    authType: "bearer",
    sslEnabled: true,
    timeout: 30000,
  });
  const [anomalyConfig, setAnomalyConfig] = useState({
    enabled: true,
    thresholds: {
      qualityDropPercent: 10,
      volumeChangePercent: 50,
      errorRatePercent: 5,
      latencySpikeFactor: 3,
    },
    alertChannels: ["in_app"] as string[],
    checkIntervalMinutes: 60,
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<RegisteredDataSource[]>({
    queryKey: ["/api/data-onboarding/sources"],
  });

  const createSessionMutation = useMutation({
    mutationFn: async (cfg: ConnectionConfig) => {
      const res = await apiRequest("POST", "/api/data-onboarding/sessions", cfg);
      return res.json();
    },
    onSuccess: (session: OnboardingSession) => {
      setCurrentSession(session);
      setWizardStep(1);
      toast({ title: "Session Created", description: "Ready to test connection" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/data-onboarding/sessions/${sessionId}/test-connection`);
      return res.json();
    },
    onSuccess: (result, sessionId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/data-onboarding/sessions/${sessionId}`] });
      if (result.success) {
        toast({ title: "Connection Successful", description: result.message });
        refreshSession(sessionId);
        setWizardStep(2);
      } else {
        toast({ title: "Connection Failed", description: result.message, variant: "destructive" });
        refreshSession(sessionId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const profileDataMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/data-onboarding/sessions/${sessionId}/profile-data`);
      return res.json();
    },
    onSuccess: (profile, sessionId) => {
      refreshSession(sessionId);
      toast({
        title: "Profiling Complete",
        description: `Quality Score: ${profile.qualityScore}% (Grade ${profile.qualityGrade})`,
      });
      setWizardStep(3);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const configureAnomalyMutation = useMutation({
    mutationFn: async ({ sessionId, config }: { sessionId: string; config: any }) => {
      const res = await apiRequest("POST", `/api/data-onboarding/sessions/${sessionId}/anomaly-config`, config);
      return res.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      toast({ title: "Anomaly Detection Configured" });
      setWizardStep(4);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/data-onboarding/sessions/${sessionId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-onboarding/sources"] });
      toast({ title: "Onboarding Complete", description: "Data source registered successfully" });
      setWizardStep(5);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const triggerAnomalyCheckMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/data-onboarding/sources/${sourceId}/anomaly-check`);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-onboarding/sources"] });
      if (result.alerts.length > 0) {
        toast({ title: "Anomalies Detected", description: `${result.alerts.length} alert(s) found`, variant: "destructive" });
      } else {
        toast({ title: "Check Complete", description: "No anomalies detected" });
      }
    },
  });

  const refreshSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/data-onboarding/sessions/${sessionId}`);
      const session = await res.json();
      setCurrentSession(session);
    } catch (e) {
      console.error("Failed to refresh session", e);
    }
  };

  const resetWizard = () => {
    setCurrentSession(null);
    setWizardStep(0);
    setConfig({
      type: "api",
      name: "",
      endpoint: "",
      authType: "bearer",
      sslEnabled: true,
      timeout: 30000,
    });
  };

  const getStepStatus = (step: number) => {
    if (!currentSession) return "pending";
    const progress = currentSession.progress[step];
    return progress?.status || "pending";
  };

  const renderStep0Configuration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Step 1: Configure Data Source
        </CardTitle>
        <CardDescription>
          Enter connection details for your data source
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="data-source-onboarding-source-type">Source Type</Label>
            <Select
              value={config.type}
              onValueChange={(v) => setConfig({ ...config, type: v as ConnectionConfig["type"] })}
            >
              <SelectTrigger id="data-source-onboarding-source-type" data-testid="select-source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sourceTypeLabels).map(([key, label]) => {
                  const Icon = sourceTypeIcons[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-source-onboarding-source-name">Source Name</Label>
            <Input id="data-source-onboarding-source-name"
              data-testid="input-source-name"
              placeholder="e.g., Hospital Connection"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </div>
        </div>

        {(config.type === "api" || config.type === "fhir_subscription") && (
          <>
            <div className="space-y-2">
              <Label htmlFor="data-source-onboarding-api-endpoint-url">API Endpoint URL</Label>
              <Input id="data-source-onboarding-api-endpoint-url"
                data-testid="input-endpoint"
                placeholder="https://fhir.example.com/api/FHIR/R4"
                value={config.endpoint || ""}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-authentication-type">Authentication Type</Label>
                <Select
                  value={config.authType}
                  onValueChange={(v) => setConfig({ ...config, authType: v as any })}
                >
                  <SelectTrigger id="data-source-onboarding-authentication-type" data-testid="select-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="mtls">mTLS Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-timeout-ms">Timeout (ms)</Label>
                <Input id="data-source-onboarding-timeout-ms"
                  data-testid="input-timeout"
                  type="number"
                  value={config.timeout || 30000}
                  onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </>
        )}

        {(config.type === "sftp" || config.type === "database" || config.type === "hl7_mllp" || config.type === "kafka") && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-host">Host</Label>
                <Input id="data-source-onboarding-host"
                  data-testid="input-host"
                  placeholder="sftp.example.com"
                  value={config.host || ""}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-port">Port</Label>
                <Input id="data-source-onboarding-port"
                  data-testid="input-port"
                  type="number"
                  placeholder="22"
                  value={config.port || ""}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-username">Username</Label>
                <Input id="data-source-onboarding-username"
                  data-testid="input-username"
                  placeholder="username"
                  value={config.username || ""}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-source-onboarding-password">Password</Label>
                <Input id="data-source-onboarding-password"
                  data-testid="input-password"
                  type="password"
                  placeholder="********"
                  value={config.password || ""}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-4">
          <Switch
            id="ssl"
            checked={config.sslEnabled}
            onCheckedChange={(v) => setConfig({ ...config, sslEnabled: v })}
          />
          <Label htmlFor="ssl" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Enable SSL/TLS Encryption
          </Label>
        </div>

        <div className="flex justify-end">
          <Button
            data-testid="button-start-onboarding"
            onClick={() => createSessionMutation.mutate(config)}
            disabled={!config.name || createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Start Onboarding
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep1ConnectionTest = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Step 2: Test Connection
        </CardTitle>
        <CardDescription>
          Verify connectivity to your data source
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            {(() => {
              const Icon = sourceTypeIcons[config.type];
              return <Icon className="h-8 w-8 text-primary" />;
            })()}
            <div>
              <p className="font-medium">{config.name}</p>
              <p className="text-sm text-muted-foreground">
                {sourceTypeLabels[config.type]}
              </p>
            </div>
          </div>
        </div>

        {currentSession?.connectionTestResult && (
          <div className={`rounded-lg p-4 ${
            currentSession.connectionTestResult.success
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-destructive/10 border border-destructive/20"
          }`}>
            <div className="flex items-start gap-3">
              {currentSession.connectionTestResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {currentSession.connectionTestResult.success ? "Connection Successful" : "Connection Failed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentSession.connectionTestResult.message}
                </p>
                {currentSession.connectionTestResult.details && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {currentSession.connectionTestResult.details.serverVersion && (
                      <div>
                        <span className="text-muted-foreground">Server:</span>{" "}
                        {currentSession.connectionTestResult.details.serverVersion}
                      </div>
                    )}
                    {currentSession.connectionTestResult.details.tlsVersion && (
                      <div>
                        <span className="text-muted-foreground">TLS:</span>{" "}
                        {currentSession.connectionTestResult.details.tlsVersion}
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Latency:</span>{" "}
                      {currentSession.connectionTestResult.latencyMs}ms
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setWizardStep(0)} data-testid="button-back-step1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => currentSession && testConnectionMutation.mutate(currentSession.id)}
              disabled={testConnectionMutation.isPending}
              data-testid="button-test-connection"
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {currentSession?.connectionTestResult ? "Retry Test" : "Test Connection"}
            </Button>
            {currentSession?.connectionTestResult?.success && (
              <Button onClick={() => setWizardStep(2)} data-testid="button-next-step2">
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to Profiling
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2DataProfiling = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Step 3: Sample Data Profiling
        </CardTitle>
        <CardDescription>
          Analyze data quality and structure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentSession?.sampleDataProfile ? (
          <>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-3xl font-bold">{currentSession.sampleDataProfile.qualityScore}%</p>
                <p className="text-sm text-muted-foreground">Quality Score</p>
              </div>
              <Badge
                variant={
                  currentSession.sampleDataProfile.qualityGrade === "A"
                    ? "default"
                    : currentSession.sampleDataProfile.qualityGrade === "B"
                    ? "secondary"
                    : "destructive"
                }
                className="text-lg px-3 py-1"
              >
                Grade {currentSession.sampleDataProfile.qualityGrade}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {Object.entries(currentSession.sampleDataProfile.dimensions).map(([key, dim]: [string, any]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{key}</span>
                    <span className="text-sm">{dim.score}%</span>
                  </div>
                  <Progress value={dim.score} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">{dim.details}</p>
                </div>
              ))}
            </div>

            {currentSession.sampleDataProfile.recommendations.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Recommendations</span>
                </div>
                <ul className="text-sm space-y-1">
                  {currentSession.sampleDataProfile.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Click below to fetch sample data and analyze its quality
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setWizardStep(1)} data-testid="button-back-step2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {!currentSession?.sampleDataProfile && (
              <Button
                onClick={() => currentSession && profileDataMutation.mutate(currentSession.id)}
                disabled={profileDataMutation.isPending}
                data-testid="button-profile-data"
              >
                {profileDataMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Profiling
              </Button>
            )}
            {currentSession?.sampleDataProfile && (
              <Button onClick={() => setWizardStep(3)} data-testid="button-next-step3">
                <ArrowRight className="h-4 w-4 mr-2" />
                Configure Anomaly Detection
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3AnomalyConfig = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Step 4: Anomaly Detection Setup
        </CardTitle>
        <CardDescription>
          Configure automated monitoring and alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5" />
            <div>
              <p className="font-medium">Enable Anomaly Detection</p>
              <p className="text-sm text-muted-foreground">
                Automatically monitor data quality and volume changes
              </p>
            </div>
          </div>
          <Switch
            checked={anomalyConfig.enabled}
            onCheckedChange={(v) => setAnomalyConfig({ ...anomalyConfig, enabled: v })}
          />
        </div>

        {anomalyConfig.enabled && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label htmlFor="data-source-onboarding-alert-thresholds" className="text-base">Alert Thresholds</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data-source-onboarding-quality-drop" className="text-sm">Quality Drop (%)</Label>
                  <Input id="data-source-onboarding-quality-drop" id="data-source-onboarding-alert-thresholds"
                    type="number"
                    value={anomalyConfig.thresholds.qualityDropPercent}
                    onChange={(e) =>
                      setAnomalyConfig({
                        ...anomalyConfig,
                        thresholds: {
                          ...anomalyConfig.thresholds,
                          qualityDropPercent: parseInt(e.target.value),
                        },
                      })
                    }
                    data-testid="input-quality-threshold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-source-onboarding-volume-change" className="text-sm">Volume Change (%)</Label>
                  <Input id="data-source-onboarding-volume-change"
                    type="number"
                    value={anomalyConfig.thresholds.volumeChangePercent}
                    onChange={(e) =>
                      setAnomalyConfig({
                        ...anomalyConfig,
                        thresholds: {
                          ...anomalyConfig.thresholds,
                          volumeChangePercent: parseInt(e.target.value),
                        },
                      })
                    }
                    data-testid="input-volume-threshold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-source-onboarding-error-rate" className="text-sm">Error Rate (%)</Label>
                  <Input id="data-source-onboarding-error-rate"
                    type="number"
                    value={anomalyConfig.thresholds.errorRatePercent}
                    onChange={(e) =>
                      setAnomalyConfig({
                        ...anomalyConfig,
                        thresholds: {
                          ...anomalyConfig.thresholds,
                          errorRatePercent: parseInt(e.target.value),
                        },
                      })
                    }
                    data-testid="input-error-threshold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-source-onboarding-check-interval-minutes" className="text-sm">Check Interval (minutes)</Label>
                  <Input id="data-source-onboarding-check-interval-minutes"
                    type="number"
                    value={anomalyConfig.checkIntervalMinutes}
                    onChange={(e) =>
                      setAnomalyConfig({
                        ...anomalyConfig,
                        checkIntervalMinutes: parseInt(e.target.value),
                      })
                    }
                    data-testid="input-check-interval"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setWizardStep(2)} data-testid="button-back-step3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() =>
              currentSession &&
              configureAnomalyMutation.mutate({
                sessionId: currentSession.id,
                config: anomalyConfig,
              })
            }
            disabled={configureAnomalyMutation.isPending}
            data-testid="button-save-anomaly-config"
          >
            {configureAnomalyMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Save & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4Complete = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Step 5: Complete Registration
        </CardTitle>
        <CardDescription>
          Review and finalize data source registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {currentSession?.progress.map((step) => (
            <div key={step.step} className="flex items-center gap-3">
              {step.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : step.status === "failed" ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="font-medium">{step.name}</p>
                {step.message && (
                  <p className="text-sm text-muted-foreground">{step.message}</p>
                )}
              </div>
              <Badge
                variant={
                  step.status === "completed"
                    ? "default"
                    : step.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
              >
                {step.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setWizardStep(3)} data-testid="button-back-step4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => currentSession && completeOnboardingMutation.mutate(currentSession.id)}
            disabled={completeOnboardingMutation.isPending}
            data-testid="button-complete-onboarding"
          >
            {completeOnboardingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Complete Registration
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep5Success = () => (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Data Source Registered Successfully</h3>
        <p className="text-muted-foreground mb-6">
          Your data source is now active and being monitored for anomalies
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={resetWizard} data-testid="button-add-another">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Source
          </Button>
          <Button onClick={() => setActiveTab("sources")} data-testid="button-view-sources">
            <FileText className="h-4 w-4 mr-2" />
            View All Sources
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const remainingMinutes = STEP_TIMES_MINUTES.slice(wizardStep).reduce((a, b) => a + b, 0);

  const renderExplainerVideo = () => {
    if (!showVideo) return null;
    return (
      <Card className="mb-6 overflow-hidden border-blue-200 dark:border-blue-800" data-testid="card-explainer-video">
        <CardContent className="p-0">
          <div className="relative w-full" style={{ paddingBottom: "min(56.25%, 360px)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center">
              {!videoPlaying ? (
                <div className="text-center space-y-4 px-6">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Video className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-white text-lg font-semibold">TEFCA Partner Onboarding Overview</h3>
                    <p className="text-slate-300 text-sm mt-1">Learn how to connect your data source in under 2 minutes</p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      size="lg"
                      className="gap-2 rounded-full px-6"
                      onClick={() => setVideoPlaying(true)}
                      data-testid="button-play-video"
                    >
                      <Play className="h-5 w-5" />
                      Watch Explainer
                    </Button>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                      <Clock className="h-3 w-3 mr-1" />
                      2 min
                    </Badge>
                  </div>
                </div>
              ) : (
                // Placeholder explainer clip. The production video must ship
                // with a WebVTT caption track (WCAG 2.2 AA 1.2.2, Captions
                // (Prerecorded)); tracked in the conformance report.
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  controls
                  autoPlay
                  playsInline
                  poster=""
                  data-testid="video-explainer"
                  onEnded={() => setVideoPlaying(false)}
                >
                  <source
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20 h-8 w-8"
                onClick={() => {
                  setShowVideo(false);
                  setVideoPlaying(false);
                }}
                data-testid="button-dismiss-video"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWizardProgress = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {[
            { step: 0, label: "Configure" },
            { step: 1, label: "Connect" },
            { step: 2, label: "Profile" },
            { step: 3, label: "Anomaly" },
            { step: 4, label: "Complete" },
          ].map(({ step, label }, i, arr) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardStep > step
                    ? "bg-primary text-primary-foreground"
                    : wizardStep === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {wizardStep > step ? <CheckCircle2 className="h-4 w-4" /> : step + 1}
              </div>
              <span className="ml-2 text-sm hidden sm:inline">{label}</span>
              {i < arr.length - 1 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-2 ${
                    wizardStep > step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border" data-testid="label-estimated-time">
          <Timer className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Est.</span>
          <span className="font-medium text-foreground">{remainingMinutes} min</span>
          <span className="hidden sm:inline">remaining</span>
        </div>
      </div>
    </div>
  );

  const renderSourcesList = () => (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Sources Registered</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first data source using the onboarding wizard
            </p>
            <Button onClick={() => setActiveTab("wizard")} data-testid="button-start-wizard">
              <Plus className="h-4 w-4 mr-2" />
              Add Data Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        sources.map((source) => (
          <Card key={source.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(() => {
                    const Icon = sourceTypeIcons[source.type] || Database;
                    return <Icon className="h-8 w-8 text-primary" />;
                  })()}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{source.name}</h4>
                      <Badge
                        variant={source.status === "active" ? "default" : "secondary"}
                      >
                        {source.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {sourceTypeLabels[source.type] || source.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{source.qualityScore}%</p>
                    <p className="text-xs text-muted-foreground">Quality</p>
                  </div>
                  <Badge
                    variant={
                      source.qualityGrade === "A"
                        ? "default"
                        : source.qualityGrade === "B"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    Grade {source.qualityGrade}
                  </Badge>
                  <div className="text-right">
                    <p className="font-medium">{source.totalRecordsSynced.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Records Synced</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerAnomalyCheckMutation.mutate(source.id)}
                    disabled={triggerAnomalyCheckMutation.isPending}
                    data-testid={`button-check-anomaly-${source.id}`}
                  >
                    {triggerAnomalyCheckMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Activity className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {source.anomalyAlerts.length > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">{source.anomalyAlerts.length} active alert(s)</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          Data Source Onboarding
        </h1>
        <p className="text-muted-foreground">
          Connect, validate, and monitor your health data sources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="wizard" data-testid="tab-wizard">
            <Plus className="h-4 w-4 mr-2" />
            Onboarding Wizard
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">
            <Database className="h-4 w-4 mr-2" />
            Registered Sources ({sources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wizard">
          {renderExplainerVideo()}
          {renderWizardProgress()}
          {wizardStep === 0 && renderStep0Configuration()}
          {wizardStep === 1 && renderStep1ConnectionTest()}
          {wizardStep === 2 && renderStep2DataProfiling()}
          {wizardStep === 3 && renderStep3AnomalyConfig()}
          {wizardStep === 4 && renderStep4Complete()}
          {wizardStep === 5 && renderStep5Success()}
        </TabsContent>

        <TabsContent value="sources">
          {sourcesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            renderSourcesList()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
