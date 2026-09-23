import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Sparkles,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings2,
  RefreshCw,
  Plus,
  ArrowRight,
  Clock,
  Database,
  Shield,
  TrendingUp,
  FileText,
  Loader2,
  ChevronRight,
  Brain,
  Scale,
  Zap,
  ListChecks,
  Activity,
  Watch,
  Heart,
  Smartphone,
  History,
  Link2,
  Wifi,
  WifiOff,
  Play,
  User
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DataRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  recordType: string;
  data: Record<string, any>;
  lastUpdated: string;
  confidence: number;
}

interface DataConflict {
  id: string;
  conflictType: string;
  severity: string;
  recordType: string;
  fieldName: string;
  records: DataRecord[];
  detectedAt: string;
  status: string;
  aiSuggestion?: AIMergeSuggestion;
}

interface AIMergeSuggestion {
  id: string;
  conflictId: string;
  suggestedMergedRecord: Record<string, any>;
  confidence: number;
  reasoning: string;
  fieldDecisions: FieldDecision[];
  generatedAt: string;
  status: string;
}

interface FieldDecision {
  fieldName: string;
  selectedValue: any;
  selectedSource: string;
  reason: string;
  confidence: number;
}

interface ConflictResolutionRule {
  id: string;
  name: string;
  description: string;
  ruleType: string;
  isActive: boolean;
  priority: number;
  conditions: { field: string; operator: string; value: any }[];
  actions: { actionType: string; parameters: Record<string, any> }[];
  appliedCount: number;
  successRate: number;
}

interface SourcePriority {
  sourceType: string;
  priority: number;
  trustScore: number;
  notes?: string;
}

interface ExternalDataSource {
  id: string;
  name: string;
  sourceType: string;
  vendor: string;
  connectionStatus: "connected" | "disconnected" | "pending" | "error";
  lastSyncAt: string | null;
  syncFrequency: string;
  dataTypes: string[];
  trustScore: number;
  isActive: boolean;
}

interface ConflictAuditEntry {
  id: string;
  conflictId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: {
    previousState?: string;
    newState?: string;
    appliedRule?: string;
    aiConfidence?: number;
    reason?: string;
  };
}

export default function ConflictResolution() {
  const { toast } = useToast();
  const [selectedConflict, setSelectedConflict] = useState<DataConflict | null>(null);
  const [showRuleDialog, setShowRuleDialog] = useState(false);

  const { data: conflictsData, isLoading: conflictsLoading } = useQuery({
    queryKey: ["/api/conflict-resolution/conflicts"],
  });

  const { data: rulesData } = useQuery({
    queryKey: ["/api/conflict-resolution/rules"],
  });

  const { data: prioritiesData } = useQuery({
    queryKey: ["/api/conflict-resolution/source-priorities"],
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/conflict-resolution/stats"],
  });

  const { data: externalSourcesData } = useQuery({
    queryKey: ["/api/conflict-resolution/external-sources"],
  });

  const { data: auditTrailData } = useQuery({
    queryKey: ["/api/conflict-resolution/audit-trail"],
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/conflict-resolution/external-sources/${sourceId}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/external-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/conflicts"] });
      toast({ 
        title: "Sync Complete", 
        description: `Received ${data.data?.recordsReceived || 0} records, detected ${data.data?.conflictsDetected || 0} conflicts` 
      });
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Failed to sync external source", variant: "destructive" });
    },
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/conflict-resolution/external-sources/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/external-sources"] });
      toast({ title: "Source Updated", description: "External source status updated" });
    },
  });

  const bulkResolveMutation = useMutation({
    mutationFn: async (conflictIds: string[]) => {
      const res = await apiRequest("POST", `/api/conflict-resolution/bulk-auto-resolve`, { conflictIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/stats"] });
      toast({ 
        title: "Bulk Resolution Complete", 
        description: `Resolved ${data.data?.resolved || 0} of ${data.data?.total || 0} conflicts` 
      });
    },
  });

  const generateSuggestionMutation = useMutation({
    mutationFn: async (conflictId: string) => {
      const res = await apiRequest("POST", `/api/conflict-resolution/conflicts/${conflictId}/ai-suggestion`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/stats"] });
      if (selectedConflict) {
        setSelectedConflict({ ...selectedConflict, aiSuggestion: data.data });
      }
      toast({ title: "AI Suggestion Generated", description: "Review the suggested merge below" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate AI suggestion", variant: "destructive" });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/conflict-resolution/suggestions/${suggestionId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/stats"] });
      setSelectedConflict(null);
      toast({ title: "Merge Accepted", description: "Records have been merged successfully" });
    },
  });

  const applyRuleMutation = useMutation({
    mutationFn: async ({ conflictId, ruleId }: { conflictId: string; ruleId?: string }) => {
      const res = await apiRequest("POST", `/api/conflict-resolution/conflicts/${conflictId}/apply-rule`, { ruleId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/stats"] });
      toast({ title: "Rule Applied", description: "Conflict resolved using the selected rule" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/conflict-resolution/rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conflict-resolution/rules"] });
    },
  });

  const conflicts = ((conflictsData as any)?.data || []) as DataConflict[];
  const rules = ((rulesData as any)?.data || []) as ConflictResolutionRule[];
  const priorities = ((prioritiesData as any)?.data || []) as SourcePriority[];
  const externalSources = ((externalSourcesData as any)?.data || []) as ExternalDataSource[];
  const auditTrail = ((auditTrailData as any)?.data || []) as ConflictAuditEntry[];
  const stats = (statsData as any)?.data || {};

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "auto_resolved":
        return <Badge className="bg-green-500">Auto Resolved</Badge>;
      case "manually_resolved":
        return <Badge className="bg-blue-500">Manually Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRuleTypeBadge = (type: string) => {
    switch (type) {
      case "source_priority":
        return <Badge variant="outline"><Database className="w-3 h-3 mr-1" />Source Priority</Badge>;
      case "recency":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Recency</Badge>;
      case "confidence":
        return <Badge variant="outline"><TrendingUp className="w-3 h-3 mr-1" />Confidence</Badge>;
      case "ai_assisted":
        return <Badge variant="outline"><Brain className="w-3 h-3 mr-1" />AI Assisted</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (conflictsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <GitMerge className="w-8 h-8" />
            AI Conflict Resolution
          </h1>
          <p className="text-muted-foreground">Intelligent data merging with customizable resolution rules</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Conflicts</p>
                <p className="text-3xl font-bold" data-testid="text-pending-count">{stats.pendingConflicts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-3xl font-bold" data-testid="text-resolved-count">{stats.resolvedConflicts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Suggestions</p>
                <p className="text-3xl font-bold" data-testid="text-ai-count">{stats.aiSuggestionsGenerated || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto Resolution Rate</p>
                <p className="text-3xl font-bold" data-testid="text-auto-rate">
                  {((stats.autoResolutionRate || 0) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conflicts">
        <TabsList>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Conflicts
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <ListChecks className="w-4 h-4 mr-2" />
            Resolution Rules
          </TabsTrigger>
          <TabsTrigger value="priorities" data-testid="tab-priorities">
            <Scale className="w-4 h-4 mr-2" />
            Source Priorities
          </TabsTrigger>
          <TabsTrigger value="external-sources" data-testid="tab-external-sources">
            <Link2 className="w-4 h-4 mr-2" />
            External Sources
          </TabsTrigger>
          <TabsTrigger value="audit-trail" data-testid="tab-audit-trail">
            <History className="w-4 h-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="space-y-4">
          {selectedConflict ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GitMerge className="w-5 h-5" />
                      Conflict Details
                    </CardTitle>
                    <CardDescription>
                      {selectedConflict.conflictType.replace(/_/g, " ")} in {selectedConflict.recordType}
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedConflict(null)} data-testid="button-back-to-list">
                    Back to List
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  {getSeverityBadge(selectedConflict.severity)}
                  {getStatusBadge(selectedConflict.status)}
                  <Badge variant="outline">
                    <FileText className="w-3 h-3 mr-1" />
                    {selectedConflict.fieldName}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Conflicting Records</h4>
                  <div className="grid gap-4">
                    {selectedConflict.records.map((record, idx) => (
                      <Card key={record.id} className={idx === 0 ? "border-blue-500" : ""}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{record.sourceName}</Badge>
                                <Badge variant="secondary">{record.sourceType}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Confidence: {(record.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <pre className="text-sm bg-muted p-3 rounded-lg overflow-auto">
                                {JSON.stringify(record.data, null, 2)}
                              </pre>
                              <p className="text-xs text-muted-foreground mt-2">
                                Last updated: {new Date(record.lastUpdated).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => generateSuggestionMutation.mutate(selectedConflict.id)}
                    disabled={generateSuggestionMutation.isPending}
                    data-testid="button-generate-ai"
                  >
                    {generateSuggestionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate AI Suggestion
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => applyRuleMutation.mutate({ conflictId: selectedConflict.id })}
                    disabled={applyRuleMutation.isPending}
                    data-testid="button-apply-auto"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Apply Auto Rule
                  </Button>
                </div>

                {selectedConflict.aiSuggestion && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      <h4 className="font-medium">AI Merge Suggestion</h4>
                      <Badge variant="outline">
                        Confidence: {(selectedConflict.aiSuggestion.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    <Card className="border-purple-500/50 bg-purple-500/5">
                      <CardContent className="pt-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Suggested Merged Record</p>
                          <pre className="text-sm bg-muted p-3 rounded-lg overflow-auto">
                            {JSON.stringify(selectedConflict.aiSuggestion.suggestedMergedRecord, null, 2)}
                          </pre>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Reasoning</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedConflict.aiSuggestion.reasoning}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Field Decisions</p>
                          <div className="space-y-2">
                            {selectedConflict.aiSuggestion.fieldDecisions.map((decision, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                <Badge variant="outline">{decision.fieldName}</Badge>
                                <ArrowRight className="w-4 h-4" />
                                <span className="font-mono text-sm">{String(decision.selectedValue)}</span>
                                <span className="text-xs text-muted-foreground">
                                  from {decision.selectedSource}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => acceptSuggestionMutation.mutate(selectedConflict.aiSuggestion!.id)}
                            disabled={acceptSuggestionMutation.isPending}
                            data-testid="button-accept-suggestion"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Accept & Merge
                          </Button>
                          <Button variant="outline" data-testid="button-reject-suggestion">
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {conflicts.filter(c => c.status === "pending").length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                      <h3 className="font-semibold text-lg">No Pending Conflicts</h3>
                      <p className="text-muted-foreground">All data conflicts have been resolved</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                conflicts.filter(c => c.status === "pending").map((conflict) => (
                  <Card
                    key={conflict.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedConflict(conflict)}
                    data-testid={`card-conflict-${conflict.id}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${
                            conflict.severity === "critical" ? "bg-red-500/10" :
                            conflict.severity === "high" ? "bg-orange-500/10" :
                            "bg-yellow-500/10"
                          }`}>
                            <AlertTriangle className={`w-6 h-6 ${
                              conflict.severity === "critical" ? "text-red-500" :
                              conflict.severity === "high" ? "text-orange-500" :
                              "text-yellow-500"
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">
                                {conflict.conflictType.replace(/_/g, " ")}
                              </h4>
                              {getSeverityBadge(conflict.severity)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {conflict.recordType} - {conflict.fieldName} ({conflict.records.length} sources)
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Resolution Rules</h3>
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-rule">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Resolution Rule</DialogTitle>
                  <DialogDescription>Define a new automatic conflict resolution rule</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="conflict-resolution-rule-name">Rule Name</Label>
                      <Input id="conflict-resolution-rule-name" placeholder="e.g., Prefer EHR for Medications" data-testid="input-rule-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conflict-resolution-rule-type">Rule Type</Label>
                      <Select>
                        <SelectTrigger id="conflict-resolution-rule-type" data-testid="select-rule-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="source_priority">Source Priority</SelectItem>
                          <SelectItem value="recency">Recency</SelectItem>
                          <SelectItem value="confidence">Confidence</SelectItem>
                          <SelectItem value="ai_assisted">AI Assisted</SelectItem>
                          <SelectItem value="composite">Composite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conflict-resolution-description">Description</Label>
                    <Input id="conflict-resolution-description" placeholder="Describe what this rule does" data-testid="input-rule-desc" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conflict-resolution-priority-lower-higher-priority">Priority (lower = higher priority)</Label>
                    <Input id="conflict-resolution-priority-lower-higher-priority" type="number" defaultValue={10} data-testid="input-rule-priority" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
                  <Button onClick={() => setShowRuleDialog(false)}>Create Rule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                        data-testid={`switch-rule-${rule.id}`}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rule.name}</h4>
                          {getRuleTypeBadge(rule.ruleType)}
                          <Badge variant="outline">Priority: {rule.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{rule.appliedCount} applied</p>
                        <p className="text-xs text-muted-foreground">
                          {(rule.successRate * 100).toFixed(0)}% success
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" data-testid={`button-rule-settings-${rule.id}`}>
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="priorities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Source Priority</CardTitle>
              <CardDescription>
                Configure which data sources are preferred when resolving conflicts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Trust Score</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priorities.map((priority) => (
                    <TableRow key={priority.sourceType}>
                      <TableCell>
                        <Badge variant="outline">{priority.priority}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {priority.sourceType.replace(/_/g, " ").toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={priority.trustScore * 100} className="w-24 h-2" />
                          <span className="text-sm">{(priority.trustScore * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{priority.notes}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" data-testid={`button-priority-settings-${priority.sourceType}`}>
                          <Settings2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external-sources" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">External Data Sources</h3>
              <p className="text-sm text-muted-foreground">
                Manage connections to wearables, fitness trackers, and external health systems
              </p>
            </div>
            <Button onClick={() => toast({ title: "Coming Soon", description: "Add new source wizard in development" })} data-testid="button-add-source">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {externalSources.map((source) => (
              <Card key={source.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {source.sourceType === "wearable" && <Watch className="w-5 h-5" />}
                      {source.sourceType === "fitness_tracker" && <Activity className="w-5 h-5" />}
                      {source.sourceType === "glucose_monitor" && <Heart className="w-5 h-5" />}
                      {source.sourceType === "blood_pressure_monitor" && <Heart className="w-5 h-5" />}
                      {source.sourceType === "external_emr" && <Database className="w-5 h-5" />}
                      {source.sourceType === "health_app" && <Smartphone className="w-5 h-5" />}
                      {source.name}
                    </CardTitle>
                    <Switch
                      checked={source.isActive}
                      onCheckedChange={(checked) => toggleSourceMutation.mutate({ id: source.id, isActive: checked })}
                      data-testid={`switch-source-${source.id}`}
                    />
                  </div>
                  <CardDescription>{source.vendor}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {source.connectionStatus === "connected" ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <Wifi className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : source.connectionStatus === "pending" ? (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Pending
                      </Badge>
                    ) : source.connectionStatus === "error" ? (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <WifiOff className="w-3 h-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                    <Badge variant="outline">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {source.syncFrequency}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Trust Score: </span>
                    <Progress value={source.trustScore * 100} className="w-20 h-2" />
                    <span className="text-sm font-medium">{(source.trustScore * 100).toFixed(0)}%</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {source.lastSyncAt ? (
                      <>Last sync: {new Date(source.lastSyncAt).toLocaleString()}</>
                    ) : (
                      <>Never synced</>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {source.dataTypes.slice(0, 3).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                    {source.dataTypes.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{source.dataTypes.length - 3} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => syncSourceMutation.mutate(source.id)}
                    disabled={source.connectionStatus !== "connected" || syncSourceMutation.isPending}
                    data-testid={`button-sync-${source.id}`}
                  >
                    {syncSourceMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {externalSources.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Link2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No External Sources Connected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect wearables, fitness trackers, and other health systems to integrate external data
                </p>
                <Button data-testid="button-add-first-source">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Source
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit-trail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Conflict Resolution Audit Trail
              </CardTitle>
              <CardDescription>
                Comprehensive log of all conflict resolution actions for compliance and review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Conflict ID</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditTrail.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {new Date(entry.performedAt).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.action.includes("accepted") || entry.action.includes("resolved")
                              ? "default"
                              : entry.action.includes("rejected")
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {entry.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.conflictId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {entry.performedBy}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.details.reason && (
                          <span className="text-muted-foreground">{entry.details.reason}</span>
                        )}
                        {entry.details.appliedRule && (
                          <Badge variant="outline" className="ml-2">
                            Rule: {entry.details.appliedRule}
                          </Badge>
                        )}
                        {entry.details.aiConfidence !== undefined && (
                          <Badge variant="outline" className="ml-2">
                            AI: {(entry.details.aiConfidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {auditTrail.length === 0 && (
                <div className="text-center py-8">
                  <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No audit entries yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
