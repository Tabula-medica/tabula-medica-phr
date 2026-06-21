import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RefreshCw,
  Play,
  Settings,
  GitMerge,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  Zap,
  ArrowRightLeft,
  Filter,
  Database,
  Activity,
  Shield,
  Workflow,
} from "lucide-react";

interface SyncRule {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  priority: number;
  resourceTypes: string[];
  sourceEndpointId: string;
  targetEndpointId: string;
  triggerConfig: {
    eventType: string;
    conditions: TriggerCondition[];
    scheduleConfig?: { cronExpression: string; timezone: string };
  };
  transformations: DataTransformation[];
  conflictResolution: {
    defaultStrategy: string;
    resourceSpecificStrategies: { resourceType: string; strategy: string }[];
    fieldLevelResolution: { resourceType: string; field: string; strategy: string }[];
    escalationConfig: { enabled: boolean; escalateAfterMinutes: number; notifyUsers: string[] };
    auditAllConflicts: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

interface TriggerCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[] | number | boolean;
}

interface DataTransformation {
  id: string;
  name: string;
  type: string;
  order: number;
  sourceField: string;
  targetField: string;
  isEnabled: boolean;
}

interface ConflictWorkflow {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  steps: { id: string; name: string; type: string; order: number }[];
  slaHours: number;
  isEnabled: boolean;
}

interface SyncRuleExecution {
  id: string;
  ruleId: string;
  status: string;
  triggerEvent: string;
  resourcesProcessed: number;
  resourcesSucceeded: number;
  resourcesFailed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

interface Statistics {
  totalRules: number;
  enabledRules: number;
  totalExecutions: number;
  successRate: number;
  conflictsPending: number;
  rulesByResourceType: Record<string, number>;
}

export function FHIRSyncRulesDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rules");
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [selectedResourceFilter, setSelectedResourceFilter] = useState<string>("all");

  const { data: rulesData, isLoading: rulesLoading } = useQuery<{ rules: SyncRule[] }>({
    queryKey: ["/api/fhir-sync-rules/rules"],
  });

  const { data: workflowsData } = useQuery<{ workflows: ConflictWorkflow[] }>({
    queryKey: ["/api/fhir-sync-rules/workflows"],
  });

  const { data: executionsData, refetch: refetchExecutions } = useQuery<{ executions: SyncRuleExecution[] }>({
    queryKey: ["/api/fhir-sync-rules/executions"],
  });

  const { data: statisticsData, refetch: refetchStats } = useQuery<{ statistics: Statistics }>({
    queryKey: ["/api/fhir-sync-rules/statistics"],
  });

  const { data: endpointsData } = useQuery<{ endpoints: { id: string; name: string }[] }>({
    queryKey: ["/api/fhir-sync-rules/endpoints"],
  });

  const rules = rulesData?.rules || [];
  const workflows = workflowsData?.workflows || [];
  const executions = executionsData?.executions || [];
  const statistics = statisticsData?.statistics;
  const endpoints = endpointsData?.endpoints || [];

  const toggleRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("POST", `/api/fhir-sync-rules/rules/${ruleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-rules/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-rules/statistics"] });
      toast({ title: "Rule toggled successfully" });
    },
    onError: () => {
      toast({ title: "Failed to toggle rule", variant: "destructive" });
    },
  });

  const executeRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("POST", `/api/fhir-sync-rules/rules/${ruleId}/execute`, { triggerEvent: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-rules/executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-rules/statistics"] });
      refetchExecutions();
      refetchStats();
      toast({ title: "Rule executed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to execute rule", variant: "destructive" });
    },
  });

  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const getEndpointName = (endpointId: string) => {
    return endpoints.find((e) => e.id === endpointId)?.name || endpointId;
  };

  const getTriggerBadge = (eventType: string) => {
    switch (eventType) {
      case "resource_created":
        return <Badge variant="default"><Plus className="h-3 w-3 mr-1" />Created</Badge>;
      case "resource_updated":
        return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Updated</Badge>;
      case "resource_deleted":
        return <Badge variant="destructive"><Trash2 className="h-3 w-3 mr-1" />Deleted</Badge>;
      case "schedule":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "manual":
        return <Badge variant="outline"><Play className="h-3 w-3 mr-1" />Manual</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  const getStrategyBadge = (strategy: string) => {
    switch (strategy) {
      case "source_wins":
        return <Badge variant="outline">Source Wins</Badge>;
      case "target_wins":
        return <Badge variant="outline">Target Wins</Badge>;
      case "latest_wins":
        return <Badge variant="default">Latest Wins</Badge>;
      case "merge_fields":
        return <Badge variant="secondary">Merge Fields</Badge>;
      case "manual_review":
        return <Badge><Shield className="h-3 w-3 mr-1" />Manual Review</Badge>;
      case "custom_workflow":
        return <Badge variant="secondary"><Workflow className="h-3 w-3 mr-1" />Custom Workflow</Badge>;
      default:
        return <Badge variant="outline">{strategy}</Badge>;
    }
  };

  const filteredRules = selectedResourceFilter === "all" 
    ? rules 
    : rules.filter((rule) => rule.resourceTypes.includes(selectedResourceFilter));

  const allResourceTypes = Array.from(new Set(rules.flatMap((r) => r.resourceTypes)));

  if (rulesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalRules}</p>
                  <p className="text-xs text-muted-foreground">Total Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.enabledRules}</p>
                  <p className="text-xs text-muted-foreground">Active Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalExecutions}</p>
                  <p className="text-xs text-muted-foreground">Executions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.conflictsPending}</p>
                  <p className="text-xs text-muted-foreground">Pending Conflicts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="h-4 w-4 mr-2" />
            Sync Rules
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <Workflow className="h-4 w-4 mr-2" />
            Conflict Workflows
          </TabsTrigger>
          <TabsTrigger value="executions" data-testid="tab-executions">
            <Activity className="h-4 w-4 mr-2" />
            Execution History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Automated Sync Rules</CardTitle>
                  <CardDescription>Define conditions for triggering syncs, transformations, and conflict resolution</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={selectedResourceFilter} onValueChange={setSelectedResourceFilter}>
                    <SelectTrigger className="w-48" data-testid="select-resource-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      {allResourceTypes.map((rt) => (
                        <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button data-testid="btn-add-rule">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredRules.map((rule) => (
                    <Collapsible key={rule.id} open={expandedRules.has(rule.id)} onOpenChange={() => toggleExpanded(rule.id)}>
                      <Card className="hover-elevate" data-testid={`rule-${rule.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <CollapsibleTrigger className="flex items-start gap-3 text-left flex-1">
                              {expandedRules.has(rule.id) ? (
                                <ChevronDown className="h-5 w-5 mt-1" />
                              ) : (
                                <ChevronRight className="h-5 w-5 mt-1" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{rule.name}</h3>
                                  <Badge variant={rule.isEnabled ? "default" : "secondary"}>
                                    {rule.isEnabled ? "Active" : "Disabled"}
                                  </Badge>
                                  <Badge variant="outline">Priority: {rule.priority}</Badge>
                                  {getTriggerBadge(rule.triggerConfig.eventType)}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Database className="h-3 w-3" />
                                    {rule.resourceTypes.join(", ")}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ArrowRightLeft className="h-3 w-3" />
                                    {getEndpointName(rule.sourceEndpointId)} → {getEndpointName(rule.targetEndpointId)}
                                  </span>
                                  {rule.lastTriggeredAt && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.isEnabled}
                                onCheckedChange={() => toggleRuleMutation.mutate(rule.id)}
                                disabled={toggleRuleMutation.isPending}
                                data-testid={`switch-${rule.id}`}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => executeRuleMutation.mutate(rule.id)}
                                disabled={executeRuleMutation.isPending || !rule.isEnabled}
                                data-testid={`btn-execute-${rule.id}`}
                              >
                                {executeRuleMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <CollapsibleContent className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Filter className="h-4 w-4" />
                                  Trigger Conditions
                                </h4>
                                <div className="space-y-2">
                                  {rule.triggerConfig.conditions.length > 0 ? (
                                    rule.triggerConfig.conditions.map((cond) => (
                                      <div key={cond.id} className="text-sm p-2 bg-muted/50 rounded">
                                        <span className="font-mono">{cond.field}</span>{" "}
                                        <Badge variant="outline" className="text-xs">{cond.operator}</Badge>{" "}
                                        <span className="font-mono">{String(cond.value)}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No conditions (always triggers)</p>
                                  )}
                                  {rule.triggerConfig.scheduleConfig && (
                                    <div className="text-sm p-2 bg-muted/50 rounded">
                                      <Clock className="h-3 w-3 inline mr-1" />
                                      Cron: <span className="font-mono">{rule.triggerConfig.scheduleConfig.cronExpression}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <GitMerge className="h-4 w-4" />
                                  Transformations ({rule.transformations.length})
                                </h4>
                                <div className="space-y-2">
                                  {rule.transformations.length > 0 ? (
                                    rule.transformations.slice(0, 3).map((trans) => (
                                      <div key={trans.id} className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between">
                                        <span>{trans.name}</span>
                                        <Badge variant="outline" className="text-xs">{trans.type}</Badge>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No transformations</p>
                                  )}
                                  {rule.transformations.length > 3 && (
                                    <p className="text-xs text-muted-foreground">+{rule.transformations.length - 3} more</p>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Conflict Resolution
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">Default:</span>
                                    {getStrategyBadge(rule.conflictResolution.defaultStrategy)}
                                  </div>
                                  {rule.conflictResolution.fieldLevelResolution.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      {rule.conflictResolution.fieldLevelResolution.length} field-level rules
                                    </div>
                                  )}
                                  {rule.conflictResolution.escalationConfig.enabled && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Escalates after {rule.conflictResolution.escalationConfig.escalateAfterMinutes}m
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Executions: {rule.executionCount}</span>
                                <span className="text-green-600">Success: {rule.successCount}</span>
                                <span className="text-destructive">Failed: {rule.failureCount}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" data-testid={`btn-edit-${rule.id}`}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline" data-testid={`btn-history-${rule.id}`}>
                                  <Activity className="h-4 w-4 mr-1" />
                                  History
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </CardContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conflict Resolution Workflows</CardTitle>
                  <CardDescription>Custom workflows for handling data conflicts based on resource types</CardDescription>
                </div>
                <Button data-testid="btn-add-workflow">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Workflow
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id} className="hover-elevate" data-testid={`workflow-${workflow.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">{workflow.name}</h3>
                            <Badge variant={workflow.isEnabled ? "default" : "secondary"}>
                              {workflow.isEnabled ? "Active" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Resources: {workflow.resourceTypes.join(", ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Steps: {workflow.steps.length}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              SLA: {workflow.slaHours}h
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" data-testid={`btn-edit-workflow-${workflow.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-2">Workflow Steps</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          {workflow.steps.sort((a, b) => a.order - b.order).map((step, index) => (
                            <div key={step.id} className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {step.order}. {step.name}
                              </Badge>
                              {index < workflow.steps.length - 1 && (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Execution History</CardTitle>
                  <CardDescription>Track sync rule executions and their results</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => refetchExecutions()}
                  data-testid="btn-refresh-executions"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {executions.length > 0 ? (
                    executions.map((execution) => {
                      const rule = rules.find((r) => r.id === execution.ruleId);
                      return (
                        <Card key={execution.id} data-testid={`execution-${execution.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {execution.status === "completed" ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : execution.status === "failed" ? (
                                    <XCircle className="h-5 w-5 text-destructive" />
                                  ) : (
                                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                                  )}
                                  <h4 className="font-medium">{rule?.name || execution.ruleId}</h4>
                                  <Badge variant={execution.status === "completed" ? "default" : execution.status === "failed" ? "destructive" : "secondary"}>
                                    {execution.status}
                                  </Badge>
                                  <Badge variant="outline">{execution.triggerEvent}</Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <span>Processed: {execution.resourcesProcessed}</span>
                                  <span className="text-green-600">Success: {execution.resourcesSucceeded}</span>
                                  <span className="text-destructive">Failed: {execution.resourcesFailed}</span>
                                  {execution.conflictsDetected > 0 && (
                                    <span className="text-orange-500">Conflicts: {execution.conflictsDetected}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                <p>{new Date(execution.startedAt).toLocaleString()}</p>
                                {execution.duration && <p>{(execution.duration / 1000).toFixed(1)}s</p>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No executions yet. Run a sync rule to see execution history.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
