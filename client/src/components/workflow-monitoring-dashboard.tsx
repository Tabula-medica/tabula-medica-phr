import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, Pause, AlertTriangle, CheckCircle, XCircle, 
  Clock, Activity, RefreshCw, Bell, BellOff, ArrowRight,
  Zap, Database, FileText, Eye
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StepExecution {
  stepId: string;
  stepName: string;
  stepType: string;
  status: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  resourcesProcessed?: number;
  error?: string;
  warnings?: string[];
}

interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  steps: StepExecution[];
  currentStepIndex: number;
  progress: number;
  metrics: {
    resourcesInput: number;
    resourcesOutput: number;
    transformationsApplied: number;
    errorsEncountered: number;
    warningsRaised: number;
  };
}

interface WorkflowAlert {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  type: string;
  severity: string;
  stepId?: string;
  stepName?: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface MonitoringDashboard {
  activeExecutions: WorkflowExecution[];
  recentExecutions: WorkflowExecution[];
  alerts: WorkflowAlert[];
  statistics: {
    totalExecutions24h: number;
    successRate: number;
    averageDurationMs: number;
    activeAlerts: number;
    resourcesProcessed24h: number;
  };
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "running":
      return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "skipped":
      return <Pause className="w-4 h-4 text-gray-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function StepTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "trigger":
      return <Zap className="w-4 h-4" />;
    case "transformation":
      return <RefreshCw className="w-4 h-4" />;
    case "action":
      return <Play className="w-4 h-4" />;
    case "condition":
      return <FileText className="w-4 h-4" />;
    default:
      return <Database className="w-4 h-4" />;
  }
}

function ExecutionPlayByPlay({ execution }: { execution: WorkflowExecution }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{execution.workflowName}</CardTitle>
            <CardDescription className="text-xs">
              Started {new Date(execution.startTime).toLocaleString()}
            </CardDescription>
          </div>
          <Badge 
            variant={execution.status === "running" ? "default" : 
                    execution.status === "completed" ? "secondary" : "destructive"}
            data-testid={`badge-execution-status-${execution.executionId}`}
          >
            {execution.status}
          </Badge>
        </div>
        <Progress value={execution.progress} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {execution.steps.map((step, index) => (
            <div 
              key={step.stepId}
              className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                step.status === "running" ? "bg-blue-50 dark:bg-blue-950" :
                step.status === "failed" ? "bg-red-50 dark:bg-red-950" :
                step.status === "completed" ? "bg-green-50/50 dark:bg-green-950/50" :
                "bg-muted/30"
              }`}
              data-testid={`step-${step.stepId}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <StepStatusIcon status={step.status} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <StepTypeIcon type={step.stepType} />
                  <span className="font-medium text-sm truncate">{step.stepName}</span>
                </div>
                {step.error && (
                  <p className="text-xs text-red-500 mt-1">{step.error}</p>
                )}
                {step.warnings && step.warnings.length > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">{step.warnings[0]}</p>
                )}
              </div>

              <div className="text-right text-xs text-muted-foreground">
                {step.durationMs && <div>{step.durationMs}ms</div>}
                {step.resourcesProcessed !== undefined && (
                  <div>{step.resourcesProcessed} resources</div>
                )}
              </div>

              {index < execution.steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold">{execution.metrics.resourcesInput}</div>
            <div className="text-xs text-muted-foreground">Input</div>
          </div>
          <div>
            <div className="text-lg font-bold">{execution.metrics.resourcesOutput}</div>
            <div className="text-xs text-muted-foreground">Output</div>
          </div>
          <div>
            <div className="text-lg font-bold">{execution.metrics.transformationsApplied}</div>
            <div className="text-xs text-muted-foreground">Transforms</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-500">{execution.metrics.errorsEncountered}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceFlowChart({ execution }: { execution: WorkflowExecution }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resource Flow</CardTitle>
        <CardDescription>Data transformation between steps</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg className="w-full h-32" viewBox="0 0 600 100">
            {execution.steps.map((step, index) => {
              const x = 50 + (index * (500 / Math.max(execution.steps.length - 1, 1)));
              const color = step.status === "completed" ? "#22c55e" :
                           step.status === "running" ? "#3b82f6" :
                           step.status === "failed" ? "#ef4444" : "#9ca3af";
              
              return (
                <g key={step.stepId}>
                  {index < execution.steps.length - 1 && (
                    <line
                      x1={x + 15}
                      y1={50}
                      x2={50 + ((index + 1) * (500 / Math.max(execution.steps.length - 1, 1))) - 15}
                      y2={50}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={step.status === "pending" ? "4" : "0"}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={50}
                    r={15}
                    fill={color}
                    className={step.status === "running" ? "animate-pulse" : ""}
                  />
                  <text
                    x={x}
                    y={55}
                    textAnchor="middle"
                    fill="white"
                    fontSize={12}
                    fontWeight="bold"
                  >
                    {index + 1}
                  </text>
                  <text
                    x={x}
                    y={85}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize={9}
                    className="fill-muted-foreground"
                  >
                    {step.stepName.length > 12 ? step.stepName.slice(0, 12) + "..." : step.stepName}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsList({ alerts, onAcknowledge }: { alerts: WorkflowAlert[]; onAcknowledge: (id: string) => void }) {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 pr-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <Card 
              key={alert.id}
              data-testid={`alert-${alert.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${
                    alert.severity === "critical" ? "bg-red-500" :
                    alert.severity === "error" ? "bg-red-400" :
                    alert.severity === "warning" ? "bg-yellow-500" :
                    "bg-blue-400"
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTriangle className={`w-4 h-4 ${
                        alert.severity === "critical" || alert.severity === "error" 
                          ? "text-red-500" 
                          : "text-yellow-500"
                      }`} />
                      <Badge variant="outline" className="text-xs">
                        {alert.type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Workflow: {alert.workflowName}
                      {alert.stepName && ` / Step: ${alert.stepName}`}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onAcknowledge(alert.id)}
                      data-testid={`button-acknowledge-${alert.id}`}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

export default function WorkflowMonitoringDashboard() {
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: dashboard, isLoading, refetch } = useQuery<MonitoringDashboard>({
    queryKey: ["/api/workflow-monitoring/dashboard"],
    refetchInterval: 5000
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/workflow-monitoring/alerts/${alertId}/acknowledge`, { userId: "current-user" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-monitoring/dashboard"] });
      toast({ title: "Alert acknowledged" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const stats = dashboard?.statistics;
  const activeExecution = dashboard?.activeExecutions[0];
  const unacknowledgedAlerts = dashboard?.alerts.filter(a => !a.acknowledged) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Workflow Monitoring</h2>
          <p className="text-muted-foreground">Real-time execution visualization and alerting</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats?.totalExecutions24h || 0}</div>
            <div className="text-xs text-muted-foreground">Executions (24h)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats?.successRate || 0}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{Math.round((stats?.averageDurationMs || 0) / 1000)}s</div>
            <div className="text-xs text-muted-foreground">Avg Duration</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats?.activeAlerts || 0}</div>
            <div className="text-xs text-muted-foreground">Active Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats?.resourcesProcessed24h || 0}</div>
            <div className="text-xs text-muted-foreground">Resources (24h)</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            <Activity className="w-4 h-4 mr-2" />
            Active Executions
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="w-4 h-4 mr-2" />
            Recent History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeExecution ? (
            <>
              <ExecutionPlayByPlay execution={activeExecution} />
              <ResourceFlowChart execution={activeExecution} />
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No workflows currently executing</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Workflow Alerts
              </CardTitle>
              <CardDescription>
                Step failures, delays, and other issues requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertsList 
                alerts={dashboard?.alerts || []} 
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {dashboard?.recentExecutions.map((execution) => (
            <Card 
              key={execution.executionId}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedExecution(
                selectedExecution === execution.executionId ? null : execution.executionId
              )}
              data-testid={`history-item-${execution.executionId}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {execution.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">{execution.workflowName}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(execution.startTime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{execution.metrics.resourcesInput} resources</span>
                    <span>{Math.round((execution.totalDurationMs || 0) / 1000)}s</span>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                
                {selectedExecution === execution.executionId && (
                  <div className="mt-4 pt-4 border-t">
                    <ExecutionPlayByPlay execution={execution} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {!dashboard?.recentExecutions.length && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent execution history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
