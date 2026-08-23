import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  FileText,
  GitMerge,
  Lightbulb,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Zap,
  ChevronRight,
  Check
} from "lucide-react";

interface DataInconsistency {
  id: string;
  resourceType: string;
  resourceId: string;
  fieldPath: string;
  sources: {
    sourceId: string;
    sourceSystem: string;
    value: any;
    timestamp: string;
    confidenceScore: number;
  }[];
  inconsistencyType: string;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: string;
  status: "pending" | "resolved" | "ignored" | "escalated";
  resolvedValue?: any;
  resolutionMethod?: string;
}

interface HarmonizationRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  fieldPath: string;
  ruleType: string;
  priority: number;
  isActive: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  appliedCount: number;
  successRate: number;
}

interface HarmonizationSuggestion {
  id: string;
  targetInconsistency: string;
  suggestedRule: Partial<HarmonizationRule>;
  suggestedValue: any;
  confidence: number;
  reasoning: string;
  alternativeValues: { value: any; confidence: number; source: string }[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface SourceReliability {
  sourceId: string;
  sourceSystem: string;
  overallReliability: number;
  fieldReliability: Record<string, number>;
  lastAssessment: string;
  totalRecords: number;
  conflictRate: number;
  updateFrequency: string;
}

interface HarmonizationStats {
  totalInconsistencies: number;
  pendingInconsistencies: number;
  resolvedInconsistencies: number;
  totalRules: number;
  activeRules: number;
  averageSuccessRate: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export default function FhirHarmonization() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("inconsistencies");
  const [selectedInconsistency, setSelectedInconsistency] = useState<DataInconsistency | null>(null);
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    resourceType: "*",
    fieldPath: "*",
    ruleType: "highest_confidence",
    priority: 1,
    isActive: true,
    configuration: {}
  });

  const { data: statsData, refetch: refetchStats } = useQuery<HarmonizationStats>({
    queryKey: ["/api/harmonization/stats"]
  });

  const { data: inconsistenciesData, refetch: refetchInconsistencies } = useQuery<{ inconsistencies: DataInconsistency[] }>({
    queryKey: ["/api/harmonization/inconsistencies"]
  });

  const { data: rulesData, refetch: refetchRules } = useQuery<{ rules: HarmonizationRule[] }>({
    queryKey: ["/api/harmonization/rules"]
  });

  const { data: reliabilityData } = useQuery<{ sources: SourceReliability[] }>({
    queryKey: ["/api/harmonization/source-reliability"]
  });

  const stats = statsData;
  const inconsistencies = inconsistenciesData?.inconsistencies || [];
  const rules = rulesData?.rules || [];
  const sources = reliabilityData?.sources || [];

  const getSuggestionMutation = useMutation({
    mutationFn: async (inconsistencyId: string) => {
      const res = await apiRequest("POST", `/api/harmonization/suggest/${inconsistencyId}`);
      return res.json();
    }
  });

  const resolveInconsistencyMutation = useMutation({
    mutationFn: async ({ inconsistencyId, resolution }: { inconsistencyId: string; resolution: any }) => {
      const res = await apiRequest("POST", `/api/harmonization/resolve/${inconsistencyId}`, resolution);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resolution Applied", description: "Inconsistency has been resolved." });
      queryClient.invalidateQueries({ queryKey: ["/api/harmonization/inconsistencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/harmonization/stats"] });
      setSelectedInconsistency(null);
    }
  });

  const autoResolveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/harmonization/auto-resolve");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-Resolution Complete",
        description: `Resolved: ${data.resolved}, Skipped: ${data.skipped}, Failed: ${data.failed}`
      });
      refetchInconsistencies();
      refetchStats();
    }
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const res = await apiRequest("POST", "/api/harmonization/rules", rule);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rule Created", description: "Harmonization rule has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/harmonization/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/harmonization/stats"] });
      setShowCreateRuleDialog(false);
      setNewRule({
        name: "",
        description: "",
        resourceType: "*",
        fieldPath: "*",
        ruleType: "highest_confidence",
        priority: 1,
        isActive: true,
        configuration: {}
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "ignored":
        return <Badge variant="secondary">Ignored</Badge>;
      case "escalated":
        return <Badge variant="destructive">Escalated</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleApplySuggestion = async (suggestion: HarmonizationSuggestion) => {
    if (!selectedInconsistency) return;

    resolveInconsistencyMutation.mutate({
      inconsistencyId: selectedInconsistency.id,
      resolution: {
        ruleId: suggestion.suggestedRule?.id,
        resolvedValue: suggestion.suggestedValue,
        resolutionMethod: "ai_assisted",
        reasoning: suggestion.reasoning,
        appliedBy: "user"
      }
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">FHIR Data Harmonization</h1>
          <p className="text-muted-foreground">
            AI-driven inconsistency detection and conflict resolution
          </p>
        </div>
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Data harmonization only. No clinical decision support.
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Inconsistencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-inconsistencies">
              {stats?.totalInconsistencies || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingInconsistencies || 0} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-resolved">
              {stats?.resolvedInconsistencies || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-rules">
              {stats?.activeRules || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {stats?.totalRules || 0} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {(stats?.averageSuccessRate || 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">By Severity</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex gap-2">
            <Badge className="bg-red-500">{stats?.bySeverity?.critical || 0}</Badge>
            <Badge className="bg-orange-500">{stats?.bySeverity?.high || 0}</Badge>
            <Badge className="bg-yellow-500">{stats?.bySeverity?.medium || 0}</Badge>
            <Badge className="bg-blue-500">{stats?.bySeverity?.low || 0}</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="inconsistencies" data-testid="tab-inconsistencies">Inconsistencies</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">Sources</TabsTrigger>
          <TabsTrigger value="resolve" data-testid="tab-resolve">Resolve</TabsTrigger>
        </TabsList>

        <TabsContent value="inconsistencies" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchInconsistencies()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => autoResolveMutation.mutate()}
                disabled={autoResolveMutation.isPending}
                data-testid="button-auto-resolve"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Resolve
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Inconsistencies</CardTitle>
                <CardDescription>Click to view details and resolve</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {inconsistencies.filter(i => i.status === "pending").map((inc) => (
                      <div
                        key={inc.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
                          selectedInconsistency?.id === inc.id ? "border-primary bg-primary/5" : ""
                        }`}
                        {...clickable(() => setSelectedInconsistency(inc))}
                        data-testid={`card-inconsistency-${inc.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(inc.severity)}>{inc.severity}</Badge>
                            <span className="font-medium">{inc.resourceType}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {inc.fieldPath}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {inc.sources.length} conflicting sources
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inconsistency Details</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedInconsistency ? (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an inconsistency to view details</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className={getSeverityColor(selectedInconsistency.severity)}>
                        {selectedInconsistency.severity.toUpperCase()}
                      </Badge>
                      {getStatusBadge(selectedInconsistency.status)}
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Resource</div>
                      <div className="font-medium">
                        {selectedInconsistency.resourceType} / {selectedInconsistency.resourceId}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Field Path</div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {selectedInconsistency.fieldPath}
                      </code>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Type</div>
                      <Badge variant="outline">{selectedInconsistency.inconsistencyType.replace("_", " ")}</Badge>
                    </div>

                    <Separator />

                    <div>
                      <div className="text-sm font-medium mb-2">Conflicting Values</div>
                      <div className="space-y-2">
                        {selectedInconsistency.sources.map((source, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{source.sourceSystem}</span>
                              <Badge variant="outline">
                                {(source.confidenceScore * 100).toFixed(0)}% confidence
                              </Badge>
                            </div>
                            <div className="mt-1">
                              <code className="text-sm">{JSON.stringify(source.value)}</code>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(source.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => getSuggestionMutation.mutate(selectedInconsistency.id)}
                        disabled={getSuggestionMutation.isPending}
                        data-testid="button-get-suggestion"
                      >
                        <Lightbulb className="h-4 w-4 mr-2" />
                        Get AI Suggestion
                      </Button>
                    </div>

                    {getSuggestionMutation.data?.suggestion && (
                      <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>AI Suggestion</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <div className="text-xs text-muted-foreground italic mb-2">
                            {getSuggestionMutation.data.suggestion.noCdsCompliance}
                          </div>
                          <div>
                            <strong>Recommended Value:</strong>{" "}
                            <code>{JSON.stringify(getSuggestionMutation.data.suggestion.suggestedValue)}</code>
                          </div>
                          <div>
                            <strong>Confidence:</strong>{" "}
                            {(getSuggestionMutation.data.suggestion.confidence * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm">{getSuggestionMutation.data.suggestion.reasoning}</div>
                          <Button
                            size="sm"
                            onClick={() => handleApplySuggestion(getSuggestionMutation.data.suggestion)}
                            disabled={resolveInconsistencyMutation.isPending}
                            data-testid="button-apply-suggestion"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Apply Suggestion
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchRules()} data-testid="button-refresh-rules">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <Dialog open={showCreateRuleDialog} onOpenChange={setShowCreateRuleDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-rule">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Harmonization Rule</DialogTitle>
                  <DialogDescription>
                    Define a new rule for resolving data inconsistencies.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Rule Name</Label>
                    <Input
                      id="name"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g., EHR Source Priority"
                      data-testid="input-rule-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      placeholder="Describe what this rule does..."
                      data-testid="input-rule-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resourceType">Resource Type</Label>
                      <Input
                        id="resourceType"
                        value={newRule.resourceType}
                        onChange={(e) => setNewRule({ ...newRule, resourceType: e.target.value })}
                        placeholder="* for all"
                        data-testid="input-resource-type"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fieldPath">Field Path</Label>
                      <Input
                        id="fieldPath"
                        value={newRule.fieldPath}
                        onChange={(e) => setNewRule({ ...newRule, fieldPath: e.target.value })}
                        placeholder="* for all"
                        data-testid="input-field-path"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleType">Rule Type</Label>
                    <Select
                      value={newRule.ruleType}
                      onValueChange={(v) => setNewRule({ ...newRule, ruleType: v })}
                    >
                      <SelectTrigger data-testid="select-rule-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="source_priority">Source Priority</SelectItem>
                        <SelectItem value="most_recent">Most Recent</SelectItem>
                        <SelectItem value="highest_confidence">Highest Confidence</SelectItem>
                        <SelectItem value="majority_vote">Majority Vote</SelectItem>
                        <SelectItem value="custom_logic">Custom Logic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isActive"
                      checked={newRule.isActive}
                      onCheckedChange={(checked) => setNewRule({ ...newRule, isActive: checked })}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateRuleDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createRuleMutation.mutate(newRule)}
                    disabled={createRuleMutation.isPending || !newRule.name}
                    data-testid="button-save-rule"
                  >
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>{rule.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Resource Type</div>
                      <code className="text-xs bg-muted px-1 rounded">{rule.resourceType}</code>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Field Path</div>
                      <code className="text-xs bg-muted px-1 rounded">{rule.fieldPath}</code>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Rule Type</div>
                      <Badge variant="outline">{rule.ruleType.replace("_", " ")}</Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Priority</div>
                      <span className="font-medium">{rule.priority}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Applied</div>
                      <span className="font-medium">{rule.appliedCount.toLocaleString()} times</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <span className="font-medium text-green-600">{rule.successRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Source Reliability Scores</CardTitle>
              <CardDescription>AI-assessed reliability of each data source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sources.map((source) => (
                  <div key={source.sourceId} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">{source.sourceSystem}</div>
                          <div className="text-sm text-muted-foreground">
                            {source.totalRecords.toLocaleString()} records
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {(source.overallReliability * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">reliability</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress value={source.overallReliability * 100} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Conflict Rate</div>
                        <div className="font-medium">{(source.conflictRate * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Update Frequency</div>
                        <Badge variant="outline">{source.updateFrequency}</Badge>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last Assessment</div>
                        <div className="font-medium">
                          {new Date(source.lastAssessment).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolve" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Resolution</CardTitle>
              <CardDescription>
                Automatically resolve inconsistencies using configured rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Auto-Resolution Guidelines</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Critical severity inconsistencies are skipped (require manual review)</li>
                    <li>Only inconsistencies with 85%+ confidence suggestions are resolved</li>
                    <li>All resolutions are logged for audit purposes</li>
                    <li>This is for data quality only - not clinical decision support</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => autoResolveMutation.mutate()}
                  disabled={autoResolveMutation.isPending}
                  data-testid="button-batch-resolve"
                >
                  {autoResolveMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Auto-Resolution
                </Button>
                <div className="text-sm text-muted-foreground">
                  {stats?.pendingInconsistencies || 0} pending inconsistencies
                </div>
              </div>

              {autoResolveMutation.data && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Resolution Results</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {autoResolveMutation.data.resolved}
                      </div>
                      <div className="text-sm text-muted-foreground">Resolved</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">
                        {autoResolveMutation.data.skipped}
                      </div>
                      <div className="text-sm text-muted-foreground">Skipped</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {autoResolveMutation.data.failed}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
