import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Archive,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  FileText,
  GitBranch,
  History,
  Layers,
  PenTool,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PolicyEntity {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  version: number;
  updatedAt: string;
  nextReviewDate?: string;
  regulatoryMappings: string[];
}

interface PolicyConflict {
  id: string;
  policy1Id: string;
  policy1Name: string;
  policy2Id: string;
  policy2Name: string;
  conflictType: string;
  severity: string;
  description: string;
  aiRecommendation: string;
  impactAssessment: string;
  resolvedAt?: string;
}

interface PolicyRedundancy {
  id: string;
  primaryPolicyName: string;
  redundantPolicyName: string;
  overlapPercentage: number;
  recommendation: string;
  rationale: string;
  resolvedAt?: string;
}

interface RetirementRecommendation {
  id: string;
  policyId: string;
  policyName: string;
  reason: string;
  recommendation: string;
  transitionPlan: string[];
  riskAssessment: string;
  status: string;
}

interface ApprovalWorkflow {
  id: string;
  policyId: string;
  workflowType: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  requiredApprovals: number;
  currentApprovals: number;
  dueDate: string;
}

interface Dashboard {
  totalPolicies: number;
  byStatus: Record<string, number>;
  pendingApprovals: number;
  conflictsDetected: number;
  redundanciesFound: number;
  outdatedPolicies: number;
  retirementCandidates: number;
  complianceScore: number;
  aiInsights: string[];
}

interface PolicyDraft {
  id: string;
  request: {
    name: string;
    description: string;
    type: string;
    regulatoryFrameworks: string[];
    dataTypes: string[];
    roles: string[];
    enforcementLevel: string;
  };
  generatedPolicy: PolicyEntity;
  aiRationale: string;
  suggestedRules: { id: string; name: string; condition: string; action: string; priority: number }[];
  complianceNotes: string[];
  riskConsiderations: string[];
  createdAt: string;
  status: string;
}

interface AmendmentSuggestion {
  id: string;
  policyId: string;
  policyName: string;
  trigger: string;
  triggerDetails: string;
  severity: string;
  suggestedChanges: { field: string; oldValue: unknown; newValue: unknown; changeType: string }[];
  rationale: string;
  impactAnalysis: string;
  implementationSteps: string[];
  estimatedEffort: string;
  regulatoryDeadline?: string;
  createdAt: string;
  status: string;
}

interface AutoReviewSchedule {
  id: string;
  policyId: string;
  policyName: string;
  reviewFrequency: string;
  nextReviewDate: string;
  autoArchiveIfInactive: boolean;
  status: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  draft: "secondary",
  pending_approval: "outline",
  deprecated: "destructive",
  archived: "secondary",
  retired: "secondary",
};

const severityColors: Record<string, "destructive" | "default" | "secondary"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export default function PolicyLifecycle() {
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [selectedConflict, setSelectedConflict] = useState<PolicyConflict | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { toast } = useToast();

  const { data: dashboardData, refetch: refetchDashboard } = useQuery<{ success: boolean; data: Dashboard }>({
    queryKey: ["/api/policy-lifecycle/dashboard"],
  });

  const dashboard = dashboardData?.data;

  const detectConflictsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/detect-conflicts", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Conflict Detection Complete", description: `Found ${data.data.length} conflicts` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to detect conflicts", variant: "destructive" });
    },
  });

  const detectRedundanciesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/detect-redundancies", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/redundancies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Redundancy Detection Complete", description: `Found ${data.data.length} redundancies` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to detect redundancies", variant: "destructive" });
    },
  });

  const analyzeOutdatedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/analyze-outdated", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Analysis Complete", description: `Found ${data.data.length} policies needing attention` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze policies", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-lifecycle">
            <GitBranch className="h-8 w-8" />
            Policy Lifecycle Management
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered policy governance, conflict detection, and versioning
          </p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="text-center">
            <p className={`text-2xl font-bold ${(dashboard?.complianceScore || 0) >= 80 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`} data-testid="text-compliance-score">
              {dashboard?.complianceScore || 0}%
            </p>
            <p className="text-xs text-muted-foreground">Compliance</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" data-testid="text-total-policies">{dashboard?.totalPolicies || 0}</p>
            <p className="text-xs text-muted-foreground">Policies</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-300" data-testid="text-conflicts">{dashboard?.conflictsDetected || 0}</p>
            <p className="text-xs text-muted-foreground">Conflicts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-300" data-testid="text-pending">{dashboard?.pendingApprovals || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="flex flex-wrap gap-1 w-full max-w-4xl" data-testid="tabs-list">
          <TabsTrigger value="dashboard" data-testid="trigger-dashboard">
            <Shield className="h-4 w-4 mr-1" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="trigger-policies">
            <FileText className="h-4 w-4 mr-1" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="drafting" data-testid="trigger-drafting">
            <PenTool className="h-4 w-4 mr-1" />
            AI Drafting
          </TabsTrigger>
          <TabsTrigger value="amendments" data-testid="trigger-amendments">
            <Edit className="h-4 w-4 mr-1" />
            Amendments
          </TabsTrigger>
          <TabsTrigger value="auto-review" data-testid="trigger-auto-review">
            <Calendar className="h-4 w-4 mr-1" />
            Auto-Review
          </TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="trigger-conflicts">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Conflicts
          </TabsTrigger>
          <TabsTrigger value="approvals" data-testid="trigger-approvals">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <DashboardTab
            dashboard={dashboard}
            onDetectConflicts={() => detectConflictsMutation.mutate()}
            onDetectRedundancies={() => detectRedundanciesMutation.mutate()}
            onAnalyzeOutdated={() => analyzeOutdatedMutation.mutate()}
            isAnalyzing={detectConflictsMutation.isPending || detectRedundanciesMutation.isPending || analyzeOutdatedMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          <PoliciesTab />
        </TabsContent>

        <TabsContent value="drafting" className="space-y-4 mt-4">
          <DraftingTab />
        </TabsContent>

        <TabsContent value="amendments" className="space-y-4 mt-4">
          <AmendmentsTab />
        </TabsContent>

        <TabsContent value="auto-review" className="space-y-4 mt-4">
          <AutoReviewTab />
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4 mt-4">
          <ConflictsTab
            onSelectConflict={setSelectedConflict}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 mt-4">
          <ApprovalsTab />
        </TabsContent>
      </Tabs>

      {selectedConflict && (
        <ConflictResolutionDialog
          conflict={selectedConflict}
          open={!!selectedConflict}
          onClose={() => {
            setSelectedConflict(null);
            setResolutionNotes("");
          }}
          resolutionNotes={resolutionNotes}
          setResolutionNotes={setResolutionNotes}
        />
      )}
    </div>
  );
}

function DashboardTab({
  dashboard,
  onDetectConflicts,
  onDetectRedundancies,
  onAnalyzeOutdated,
  isAnalyzing,
}: {
  dashboard?: Dashboard;
  onDetectConflicts: () => void;
  onDetectRedundancies: () => void;
  onAnalyzeOutdated: () => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Analysis Actions
          </CardTitle>
          <CardDescription>Run AI-powered policy analysis</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button onClick={onDetectConflicts} disabled={isAnalyzing} data-testid="button-detect-conflicts">
            {isAnalyzing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Detect Conflicts
          </Button>
          <Button onClick={onDetectRedundancies} disabled={isAnalyzing} variant="outline" data-testid="button-detect-redundancies">
            {isAnalyzing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
            Find Redundancies
          </Button>
          <Button onClick={onAnalyzeOutdated} disabled={isAnalyzing} variant="outline" data-testid="button-analyze-outdated">
            {isAnalyzing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Analyze Outdated
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Score</CardTitle>
          <CardDescription>Overall policy health</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={352}
                  strokeDashoffset={352 - (352 * (dashboard?.complianceScore || 0)) / 100}
                  className={`${(dashboard?.complianceScore || 0) >= 80 ? "text-emerald-500" : (dashboard?.complianceScore || 0) >= 50 ? "text-amber-500" : "text-rose-500"}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{dashboard?.complianceScore || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Policy Status</CardTitle>
          <CardDescription>Breakdown by lifecycle stage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard?.byStatus && Object.entries(dashboard.byStatus).map(([status, count]) => (
            count > 0 && (
              <div key={status} className="flex items-center justify-between">
                <Badge variant={statusColors[status] || "secondary"} className="capitalize">
                  {status.replace("_", " ")}
                </Badge>
                <span className="font-mono">{count}</span>
              </div>
            )
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issues Summary</CardTitle>
          <CardDescription>Action items requiring attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Conflicts
            </span>
            <Badge variant={dashboard?.conflictsDetected ? "destructive" : "secondary"}>
              {dashboard?.conflictsDetected || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              Redundancies
            </span>
            <Badge variant={dashboard?.redundanciesFound ? "default" : "secondary"}>
              {dashboard?.redundanciesFound || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Outdated
            </span>
            <Badge variant={dashboard?.outdatedPolicies ? "default" : "secondary"}>
              {dashboard?.outdatedPolicies || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Retirement Candidates
            </span>
            <Badge variant="secondary">
              {dashboard?.retirementCandidates || 0}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Insights
          </CardTitle>
          <CardDescription>Automated recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard?.aiInsights && dashboard.aiInsights.length > 0 ? (
            <ul className="space-y-2">
              {dashboard.aiInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No insights available. Run analysis to generate recommendations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PoliciesTab() {
  const { data: policiesData, isLoading } = useQuery<{ success: boolean; data: PolicyEntity[] }>({
    queryKey: ["/api/policy-lifecycle/policies"],
  });

  const policies = policiesData?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Policies</CardTitle>
        <CardDescription>Complete policy inventory with lifecycle status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading policies...</span>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Regulations</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{policy.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{policy.type.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[policy.status] || "secondary"} className="capitalize">
                        {policy.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">v{policy.version}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {policy.regulatoryMappings.slice(0, 2).map((reg) => (
                          <Badge key={reg} variant="secondary" className="text-xs">{reg}</Badge>
                        ))}
                        {policy.regulatoryMappings.length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{policy.regulatoryMappings.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(policy.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictsTab({ onSelectConflict }: { onSelectConflict: (c: PolicyConflict) => void }) {
  const { data: conflictsData, isLoading } = useQuery<{ success: boolean; data: PolicyConflict[] }>({
    queryKey: ["/api/policy-lifecycle/conflicts"],
  });

  const conflicts = conflictsData?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Policy Conflicts
        </CardTitle>
        <CardDescription>Detected conflicts between policies requiring resolution</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading conflicts...</span>
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
            <p>No conflicts detected</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {conflicts.map((conflict) => (
                <Card key={conflict.id} data-testid={`card-conflict-${conflict.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={severityColors[conflict.severity]}>{conflict.severity}</Badge>
                      <Badge variant="outline">{conflict.conflictType.replace("_", " ")}</Badge>
                    </div>
                    <CardTitle className="text-base">
                      {conflict.policy1Name} ↔ {conflict.policy2Name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{conflict.description}</p>
                    <div className="bg-muted p-3 rounded text-sm">
                      <p className="font-medium mb-1">AI Recommendation:</p>
                      <p className="text-muted-foreground">{conflict.aiRecommendation}</p>
                    </div>
                    <Button size="sm" onClick={() => onSelectConflict(conflict)} data-testid={`button-resolve-${conflict.id}`}>
                      <Scale className="h-4 w-4 mr-2" />
                      Resolve Conflict
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictResolutionDialog({
  conflict,
  open,
  onClose,
  resolutionNotes,
  setResolutionNotes,
}: {
  conflict: PolicyConflict;
  open: boolean;
  onClose: () => void;
  resolutionNotes: string;
  setResolutionNotes: (v: string) => void;
}) {
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/conflicts/${conflict.id}/resolve`, {
        resolutionNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Conflict Resolved" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve conflict", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Policy Conflict</DialogTitle>
          <DialogDescription>Document how this conflict was resolved</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={severityColors[conflict.severity]}>{conflict.severity}</Badge>
            <span className="text-sm">{conflict.conflictType.replace("_", " ")}</span>
          </div>

          <div className="text-sm">
            <p className="font-medium mb-1">Policies:</p>
            <p>{conflict.policy1Name} ↔ {conflict.policy2Name}</p>
          </div>

          <div className="bg-muted p-3 rounded text-sm">
            <p className="font-medium mb-1">AI Recommendation:</p>
            <p className="text-muted-foreground">{conflict.aiRecommendation}</p>
          </div>

          <div>
            <label htmlFor="policy-lifecycle-resolution-notes" className="text-sm font-medium mb-2 block">Resolution Notes</label>
            <Textarea id="policy-lifecycle-resolution-notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Describe how this conflict was resolved..."
              rows={4}
              data-testid="input-resolution-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-resolution">
            Cancel
          </Button>
          <Button
            onClick={() => resolveMutation.mutate()}
            disabled={!resolutionNotes.trim() || resolveMutation.isPending}
            data-testid="button-confirm-resolution"
          >
            {resolveMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Resolved
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedundanciesTab() {
  const { toast } = useToast();
  const { data: redundanciesData, isLoading } = useQuery<{ success: boolean; data: PolicyRedundancy[] }>({
    queryKey: ["/api/policy-lifecycle/redundancies"],
  });

  const redundancies = redundanciesData?.data || [];

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/redundancies/${id}/resolve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/redundancies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Redundancy Resolved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve redundancy", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Policy Redundancies
        </CardTitle>
        <CardDescription>Overlapping policies that may need consolidation</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading redundancies...</span>
          </div>
        ) : redundancies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
            <p>No redundancies detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {redundancies.map((r) => (
              <Card key={r.id} data-testid={`card-redundancy-${r.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.primaryPolicyName}</CardTitle>
                    <Badge variant="default">{r.overlapPercentage}% overlap</Badge>
                  </div>
                  <CardDescription>overlaps with {r.redundantPolicyName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={r.overlapPercentage} className="h-2" />
                  <p className="text-sm">{r.rationale}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">{r.recommendation.replace("_", " ")}</Badge>
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(r.id)}
                      disabled={resolveMutation.isPending}
                      data-testid={`button-resolve-redundancy-${r.id}`}
                    >
                      Apply Recommendation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalsTab() {
  const { toast } = useToast();
  const { data: workflowsData, isLoading } = useQuery<{ success: boolean; data: ApprovalWorkflow[] }>({
    queryKey: ["/api/policy-lifecycle/approval-workflows"],
  });

  const workflows = workflowsData?.data || [];

  const submitDecisionMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/approval-workflows/${id}/decision`, { decision });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/approval-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Decision Submitted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit decision", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Approval Workflows
        </CardTitle>
        <CardDescription>Pending policy changes requiring approval</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading workflows...</span>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
            <p>No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((w) => (
              <Card key={w.id} data-testid={`card-workflow-${w.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">{w.workflowType.replace("_", " ")}</Badge>
                    <Badge variant={w.status === "pending" ? "default" : w.status === "approved" ? "default" : "secondary"}>
                      {w.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    Requested by {w.requestedBy} • Due {new Date(w.dueDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Approvals:</span>
                    <span className="font-mono">{w.currentApprovals}/{w.requiredApprovals}</span>
                  </div>
                  {w.status === "pending" || w.status === "in_review" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => submitDecisionMutation.mutate({ id: w.id, decision: "approved" })}
                        disabled={submitDecisionMutation.isPending}
                        data-testid={`button-approve-${w.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => submitDecisionMutation.mutate({ id: w.id, decision: "rejected" })}
                        disabled={submitDecisionMutation.isPending}
                        data-testid={`button-reject-${w.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DraftingTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "access_control",
    regulatoryFrameworks: ["HIPAA"],
    dataTypes: ["PHI"],
    roles: ["physician", "nurse"],
    enforcementLevel: "strict",
    additionalContext: "",
  });

  const { data: draftsData, isLoading } = useQuery<{ success: boolean; data: PolicyDraft[] }>({
    queryKey: ["/api/policy-lifecycle/drafts"],
  });

  const drafts = draftsData?.data || [];

  const createDraftMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/drafts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/drafts"] });
      toast({ title: "Policy Draft Created", description: "AI has generated your policy draft" });
      setShowForm(false);
      setFormData({
        name: "",
        description: "",
        type: "access_control",
        regulatoryFrameworks: ["HIPAA"],
        dataTypes: ["PHI"],
        roles: ["physician", "nurse"],
        enforcementLevel: "strict",
        additionalContext: "",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create draft", variant: "destructive" });
    },
  });

  const acceptDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/drafts/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/dashboard"] });
      toast({ title: "Draft Accepted", description: "Policy submitted for approval" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept draft", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Policy Drafting
          </h3>
          <p className="text-sm text-muted-foreground">Generate new policies using AI assistance</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-draft">
          <Plus className="h-4 w-4 mr-2" />
          Draft New Policy
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Policy Draft</CardTitle>
            <CardDescription>Provide details and AI will generate a comprehensive policy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Policy Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., PHI Access Control Policy"
                  data-testid="input-policy-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Policy Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="select-policy-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access_control">Access Control</SelectItem>
                    <SelectItem value="retention">Data Retention</SelectItem>
                    <SelectItem value="encryption">Encryption</SelectItem>
                    <SelectItem value="consent">Consent Management</SelectItem>
                    <SelectItem value="audit">Audit Logging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose and scope of this policy..."
                data-testid="input-policy-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldCaption>Regulatory Frameworks</FieldCaption>
                <div className="flex flex-wrap gap-2">
                  {["HIPAA", "GDPR", "SOC2", "PCI_DSS", "NIST"].map((reg) => (
                    <Badge
                      key={reg}
                      variant={formData.regulatoryFrameworks.includes(reg) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newRegs = formData.regulatoryFrameworks.includes(reg)
                          ? formData.regulatoryFrameworks.filter((r) => r !== reg)
                          : [...formData.regulatoryFrameworks, reg];
                        setFormData({ ...formData, regulatoryFrameworks: newRegs });
                      }}
                      data-testid={`badge-reg-${reg}`}
                    >
                      {reg}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <FieldCaption>Data Types</FieldCaption>
                <div className="flex flex-wrap gap-2">
                  {["PHI", "PII", "PCI", "audit_log", "operational"].map((dt) => (
                    <Badge
                      key={dt}
                      variant={formData.dataTypes.includes(dt) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newDts = formData.dataTypes.includes(dt)
                          ? formData.dataTypes.filter((d) => d !== dt)
                          : [...formData.dataTypes, dt];
                        setFormData({ ...formData, dataTypes: newDts });
                      }}
                      data-testid={`badge-dt-${dt}`}
                    >
                      {dt}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enforcement">Enforcement Level</Label>
              <Select value={formData.enforcementLevel} onValueChange={(v) => setFormData({ ...formData, enforcementLevel: v })}>
                <SelectTrigger data-testid="select-enforcement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict</SelectItem>
                  <SelectItem value="mandatory">Mandatory</SelectItem>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={() => createDraftMutation.mutate(formData)}
                disabled={!formData.name || !formData.description || createDraftMutation.isPending}
                data-testid="button-generate-draft"
              >
                {createDraftMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Draft
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Policy Drafts</CardTitle>
          <CardDescription>AI-generated policy drafts pending review</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading drafts...</span>
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <PenTool className="h-12 w-12 mb-4 opacity-50" />
              <p>No drafts yet. Create one above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <Card key={draft.id} data-testid={`card-draft-${draft.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{draft.request.name}</CardTitle>
                      <Badge variant={draft.status === "draft" ? "secondary" : "default"}>{draft.status}</Badge>
                    </div>
                    <CardDescription>{draft.request.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium mb-1">AI Rationale</p>
                      <p className="text-sm text-muted-foreground">{draft.aiRationale}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.suggestedRules.map((rule) => (
                        <Badge key={rule.id} variant="outline" className="text-xs">
                          {rule.name}
                        </Badge>
                      ))}
                    </div>
                    {draft.status === "draft" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptDraftMutation.mutate(draft.id)}
                          disabled={acceptDraftMutation.isPending}
                          data-testid={`button-accept-draft-${draft.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Accept & Submit for Approval
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AmendmentsTab() {
  const { toast } = useToast();

  const { data: amendmentsData, isLoading } = useQuery<{ success: boolean; data: AmendmentSuggestion[] }>({
    queryKey: ["/api/policy-lifecycle/amendments"],
  });

  const { data: policiesData } = useQuery<{ success: boolean; data: PolicyEntity[] }>({
    queryKey: ["/api/policy-lifecycle/policies"],
  });

  const amendments = amendmentsData?.data || [];
  const policies = policiesData?.data?.filter((p) => p.status === "active") || [];

  const bulkScanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/bulk-amendment-scan", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/amendments"] });
      toast({
        title: "Bulk Scan Complete",
        description: `Scanned ${data.data.policiesScanned} policies, found ${data.data.amendmentsSuggested} amendments`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run bulk scan", variant: "destructive" });
    },
  });

  const suggestAmendmentsMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/policies/${policyId}/suggest-amendments`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/amendments"] });
      toast({ title: "Amendments Suggested", description: `Found ${data.data.length} potential amendments` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suggest amendments", variant: "destructive" });
    },
  });

  const acceptAmendmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/amendments/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/amendments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/policies"] });
      toast({ title: "Amendment Accepted", description: "Policy version created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept amendment", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Edit className="h-5 w-5" />
            AI Amendment Suggestions
          </h3>
          <p className="text-sm text-muted-foreground">Suggested policy amendments based on regulatory changes and risks</p>
        </div>
        <Button onClick={() => bulkScanMutation.mutate()} disabled={bulkScanMutation.isPending} data-testid="button-bulk-scan">
          {bulkScanMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Scan All Policies
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Policy Scan</CardTitle>
          <CardDescription>Select a policy to suggest amendments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {policies.slice(0, 5).map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                onClick={() => suggestAmendmentsMutation.mutate(p.id)}
                disabled={suggestAmendmentsMutation.isPending}
                data-testid={`button-scan-${p.id}`}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Amendments</CardTitle>
          <CardDescription>Review and accept AI-suggested policy amendments</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading amendments...</span>
            </div>
          ) : amendments.filter((a) => a.status === "pending").length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
              <p>No pending amendments. Run a scan to detect needed changes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {amendments
                .filter((a) => a.status === "pending")
                .map((amendment) => (
                  <Card key={amendment.id} data-testid={`card-amendment-${amendment.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{amendment.policyName}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant={severityColors[amendment.severity] || "default"}>{amendment.severity}</Badge>
                          <Badge variant="outline">{amendment.trigger.replace("_", " ")}</Badge>
                        </div>
                      </div>
                      <CardDescription>{amendment.triggerDetails}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-sm font-medium mb-1">Rationale</p>
                        <p className="text-sm text-muted-foreground">{amendment.rationale}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Implementation Steps</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {amendment.implementationSteps.slice(0, 3).map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                      {amendment.regulatoryDeadline && (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Deadline: {new Date(amendment.regulatoryDeadline).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptAmendmentMutation.mutate(amendment.id)}
                          disabled={acceptAmendmentMutation.isPending}
                          data-testid={`button-accept-amendment-${amendment.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Accept Amendment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AutoReviewTab() {
  const { toast } = useToast();

  const { data: schedulesData, isLoading } = useQuery<{ success: boolean; data: AutoReviewSchedule[] }>({
    queryKey: ["/api/policy-lifecycle/auto-review-schedules"],
  });

  const { data: resultsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/policy-lifecycle/auto-review-results"],
  });

  const schedules = schedulesData?.data || [];
  const results = resultsData?.data || [];

  const runDueReviewsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-lifecycle/run-due-reviews", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/auto-review-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/auto-review-schedules"] });
      toast({ title: "Reviews Complete", description: `Completed ${data.data.length} policy reviews` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run reviews", variant: "destructive" });
    },
  });

  const runReviewMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await apiRequest("POST", `/api/policy-lifecycle/auto-review-schedules/${scheduleId}/run`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/auto-review-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-lifecycle/auto-review-schedules"] });
      toast({ title: "Review Complete" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run review", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Automated Policy Reviews
          </h3>
          <p className="text-sm text-muted-foreground">Scheduled reviews with automatic archival capabilities</p>
        </div>
        <Button onClick={() => runDueReviewsMutation.mutate()} disabled={runDueReviewsMutation.isPending} data-testid="button-run-due">
          {runDueReviewsMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Run Due Reviews
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Review Schedules</CardTitle>
            <CardDescription>Active automated review schedules</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p>No review schedules configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`schedule-${schedule.id}`}>
                    <div>
                      <p className="font-medium text-sm">{schedule.policyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.reviewFrequency} - Next: {new Date(schedule.nextReviewDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runReviewMutation.mutate(schedule.id)}
                      disabled={runReviewMutation.isPending}
                    >
                      Run Now
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Review Results</CardTitle>
            <CardDescription>Latest automated review findings</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
                <p>No review results yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 5).map((result) => (
                  <div key={result.id} className="p-3 border rounded-md" data-testid={`result-${result.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{result.policyName}</p>
                      <Badge variant={result.recommendation === "no_action" ? "secondary" : result.recommendation === "archive" ? "destructive" : "default"}>
                        {result.recommendation.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(result.reviewDate).toLocaleDateString()} - Risk: {result.findings?.riskAssessment?.level || "N/A"}
                    </p>
                    {result.autoActionTaken && (
                      <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">{result.autoActionTaken}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
