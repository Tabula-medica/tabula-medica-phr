import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Brain,
  Check,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Key,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: string;
  name: string;
  description: string;
  baseAccessLevel: string;
  permissions: string[];
  resourceRestrictions: string[];
}

interface PolicyCondition {
  id: string;
  type: string;
  operator: string;
  field: string;
  value: string | number | boolean | string[];
  description: string;
}

interface DataElementAccess {
  element: string;
  accessLevel: string;
  sensitivityLevel: string;
  maskingRule?: string;
  auditRequired: boolean;
}

interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  roleId: string;
  resourceType: string;
  accessLevel: string;
  conditions: PolicyCondition[];
  dataElements: DataElementAccess[];
  status: string;
  aiSuggested: boolean;
  aiConfidence?: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  createdBy: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  accessLevel: string;
  policyId: string;
  outcome: string;
  denialReason?: string;
  riskScore: number;
  anomalyFlags: string[];
  noCdsCompliance: string;
}

interface PatternFinding {
  id: string;
  type: string;
  severity: string;
  description: string;
  affectedEntities: string[];
  occurrenceCount: number;
  suggestedAction: string;
}

interface PatternAnalysis {
  id: string;
  analysisType: string;
  periodStart: string;
  periodEnd: string;
  findings: PatternFinding[];
  recommendations: string[];
  complianceScore: number;
  riskIndicators: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface PolicySuggestion {
  id: string;
  forRoleId: string;
  forResourceType: string;
  suggestedPolicy: Partial<AccessPolicy>;
  reasoning: string;
  confidence: number;
  basedOn: string[];
  status: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface AccessControlStats {
  totalRoles: number;
  totalPolicies: number;
  activePolicies: number;
  aiSuggestedPolicies: number;
  activeAdjustments: number;
  auditEntriesLast24h: number;
  accessDenials24h: number;
  pendingSuggestions: number;
  complianceScore: number;
}

export default function AccessControl() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("Patient");
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [newPolicyForm, setNewPolicyForm] = useState({
    name: "",
    description: "",
    roleId: "",
    resourceType: "Patient",
    accessLevel: "read"
  });
  const { toast } = useToast();

  const { data: statsData, refetch: refetchStats } = useQuery<{ stats: AccessControlStats }>({
    queryKey: ["/api/access-control/stats"]
  });

  const { data: rolesData } = useQuery<{ roles: Role[] }>({
    queryKey: ["/api/access-control/roles"]
  });

  const { data: policiesData, refetch: refetchPolicies } = useQuery<{ policies: AccessPolicy[] }>({
    queryKey: ["/api/access-control/policies"]
  });

  const { data: auditData, refetch: refetchAudit } = useQuery<{ entries: AuditEntry[] }>({
    queryKey: ["/api/access-control/audit"]
  });

  const { data: patternsData, refetch: refetchPatterns } = useQuery<{ analyses: PatternAnalysis[] }>({
    queryKey: ["/api/access-control/pattern-analysis"]
  });

  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery<{ suggestions: PolicySuggestion[] }>({
    queryKey: ["/api/access-control/suggestions"]
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (data: typeof newPolicyForm) => {
      return apiRequest("POST", "/api/access-control/policies", data);
    },
    onSuccess: () => {
      toast({ title: "Policy Created", description: "New access policy created successfully" });
      refetchPolicies();
      refetchStats();
      setShowCreatePolicy(false);
      setNewPolicyForm({ name: "", description: "", roleId: "", resourceType: "Patient", accessLevel: "read" });
    }
  });

  const generateSuggestionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/access-control/suggestions", {
        roleId: selectedRole,
        resourceType: selectedResourceType
      });
    },
    onSuccess: () => {
      toast({ title: "Suggestion Generated", description: "AI policy suggestion created" });
      refetchSuggestions();
      refetchStats();
    }
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest("POST", `/api/access-control/suggestions/${suggestionId}/accept`, {});
    },
    onSuccess: () => {
      toast({ title: "Suggestion Accepted", description: "Policy created from AI suggestion" });
      refetchPolicies();
      refetchSuggestions();
      refetchStats();
    }
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest("POST", `/api/access-control/suggestions/${suggestionId}/reject`, {});
    },
    onSuccess: () => {
      toast({ title: "Suggestion Rejected", description: "AI suggestion has been rejected" });
      refetchSuggestions();
      refetchStats();
    }
  });

  const analyzePatternsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/access-control/pattern-analysis", { analysisType: "anomaly" });
    },
    onSuccess: () => {
      toast({ title: "Analysis Complete", description: "Access patterns analyzed for compliance" });
      refetchPatterns();
    }
  });

  const stats = statsData?.stats;
  const roles = rolesData?.roles || [];
  const policies = policiesData?.policies || [];
  const auditEntries = auditData?.entries || [];
  const patternAnalyses = patternsData?.analyses || [];
  const suggestions = suggestionsData?.suggestions || [];

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "allowed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "denied": return <X className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchPolicies();
    refetchAudit();
    refetchPatterns();
    refetchSuggestions();
    toast({ title: "Refreshed", description: "All access control data refreshed" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            AI Access Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Granular patient data access with AI-driven policy management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreatePolicy} onOpenChange={setShowCreatePolicy}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-policy">
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Access Policy</DialogTitle>
                <DialogDescription>Define a new role-based access policy for patient data.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Policy Name</Label>
                  <Input
                    value={newPolicyForm.name}
                    onChange={(e) => setNewPolicyForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Nurse Read-Only Lab Access"
                    data-testid="input-policy-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newPolicyForm.description}
                    onChange={(e) => setNewPolicyForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the purpose of this policy..."
                    data-testid="input-policy-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newPolicyForm.roleId} onValueChange={(v) => setNewPolicyForm(p => ({ ...p, roleId: v }))}>
                      <SelectTrigger data-testid="select-policy-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Access Level</Label>
                    <Select value={newPolicyForm.accessLevel} onValueChange={(v) => setNewPolicyForm(p => ({ ...p, accessLevel: v }))}>
                      <SelectTrigger data-testid="select-access-level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="write">Write</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resource Type</Label>
                  <Select value={newPolicyForm.resourceType} onValueChange={(v) => setNewPolicyForm(p => ({ ...p, resourceType: v }))}>
                    <SelectTrigger data-testid="select-resource-type">
                      <SelectValue placeholder="Select resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Patient">Patient</SelectItem>
                      <SelectItem value="Observation">Observation</SelectItem>
                      <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                      <SelectItem value="Condition">Condition</SelectItem>
                      <SelectItem value="Encounter">Encounter</SelectItem>
                      <SelectItem value="DiagnosticReport">DiagnosticReport</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreatePolicy(false)}>Cancel</Button>
                <Button 
                  onClick={() => createPolicyMutation.mutate(newPolicyForm)}
                  disabled={!newPolicyForm.name || !newPolicyForm.roleId || createPolicyMutation.isPending}
                  data-testid="button-submit-policy"
                >
                  Create Policy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          NO-CDS COMPLIANCE: Access control operations are for DATA GOVERNANCE and SECURITY purposes ONLY. This system does NOT make clinical decisions or provide treatment recommendations.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activePolicies || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.aiSuggestedPolicies || 0} AI-suggested</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRoles || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Audit (24h)</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.auditEntriesLast24h || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.accessDenials24h || 0} denials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pending AI</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingSuggestions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.complianceScore || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">Policies</TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">AI Suggestions</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Role Definitions
                </CardTitle>
                <CardDescription>Configured access roles and their base permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {roles.map(role => (
                      <div key={role.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{role.name}</span>
                          <Badge variant="outline">{role.baseAccessLevel}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.slice(0, 3).map((perm, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{perm}</Badge>
                          ))}
                          {role.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{role.permissions.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Generate AI Suggestion
                </CardTitle>
                <CardDescription>Get AI-powered policy recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger data-testid="select-suggestion-role">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resource Type</Label>
                  <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                    <SelectTrigger data-testid="select-suggestion-resource">
                      <SelectValue placeholder="Choose resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Patient">Patient</SelectItem>
                      <SelectItem value="Observation">Observation</SelectItem>
                      <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                      <SelectItem value="Condition">Condition</SelectItem>
                      <SelectItem value="Encounter">Encounter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => generateSuggestionMutation.mutate()}
                  disabled={!selectedRole || generateSuggestionMutation.isPending}
                  data-testid="button-generate-suggestion"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Suggestion
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Recent Access Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {auditEntries.slice(0, 10).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {getOutcomeIcon(entry.outcome)}
                        <div>
                          <span className="font-medium text-sm">{entry.userId}</span>
                          <span className="text-muted-foreground text-sm"> accessed </span>
                          <span className="font-medium text-sm">{entry.resourceType}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.anomalyFlags.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Anomaly
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {policies.map(policy => (
                <Card key={policy.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{policy.name}</CardTitle>
                        {policy.aiSuggested && (
                          <Badge variant="secondary">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI ({((policy.aiConfidence || 0) * 100).toFixed(0)}%)
                          </Badge>
                        )}
                      </div>
                      <Badge variant={policy.status === "active" ? "default" : "secondary"}>
                        {policy.status}
                      </Badge>
                    </div>
                    <CardDescription>{policy.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{policy.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Role</Label>
                        <p className="font-medium">{roles.find(r => r.id === policy.roleId)?.name || policy.roleId}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Resource</Label>
                        <p className="font-medium">{policy.resourceType}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Access Level</Label>
                        <Badge variant="outline">{policy.accessLevel}</Badge>
                      </div>
                    </div>

                    {policy.conditions.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Conditions</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {policy.conditions.map(cond => (
                            <Badge key={cond.id} variant="outline" className="text-xs">
                              {cond.type}: {cond.description}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {policy.dataElements.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Data Elements</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {policy.dataElements.map((elem, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {elem.element} ({elem.accessLevel})
                              {elem.auditRequired && <Eye className="h-3 w-3 ml-1" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {suggestions.map(suggestion => (
                <Card key={suggestion.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        {suggestion.suggestedPolicy.name || "AI Policy Suggestion"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Confidence: {(suggestion.confidence * 100).toFixed(0)}%
                        </Badge>
                        <Badge variant={suggestion.status === "pending" ? "default" : "secondary"}>
                          {suggestion.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      For {roles.find(r => r.id === suggestion.forRoleId)?.name || suggestion.forRoleId} accessing {suggestion.forResourceType}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{suggestion.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div>
                      <Label className="text-muted-foreground">AI Reasoning</Label>
                      <p className="text-sm mt-1">{suggestion.reasoning}</p>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Based On</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {suggestion.basedOn.map((basis, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{basis}</Badge>
                        ))}
                      </div>
                    </div>

                    {suggestion.suggestedPolicy.accessLevel && (
                      <div>
                        <Label className="text-muted-foreground">Suggested Access Level</Label>
                        <Badge variant="secondary" className="ml-2">{suggestion.suggestedPolicy.accessLevel}</Badge>
                      </div>
                    )}

                    {suggestion.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          onClick={() => acceptSuggestionMutation.mutate(suggestion.id)}
                          disabled={acceptSuggestionMutation.isPending}
                          data-testid={`button-accept-${suggestion.id}`}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => rejectSuggestionMutation.mutate(suggestion.id)}
                          disabled={rejectSuggestionMutation.isPending}
                          data-testid={`button-reject-${suggestion.id}`}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {suggestions.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No AI suggestions yet. Generate one from the Overview tab.
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {auditEntries.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getOutcomeIcon(entry.outcome)}
                        <div>
                          <div className="font-medium">
                            {entry.userId} <span className="text-muted-foreground font-normal">({entry.userRole})</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.action} on {entry.resourceType}/{entry.resourceId}
                          </div>
                          {entry.denialReason && (
                            <div className="text-sm text-red-500 mt-1">{entry.denialReason}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Risk: {entry.riskScore}
                          </Badge>
                          {entry.anomalyFlags.map((flag, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4 mt-4">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => analyzePatternsMutation.mutate()}
              disabled={analyzePatternsMutation.isPending}
              data-testid="button-analyze-patterns"
            >
              <Play className="h-4 w-4 mr-2" />
              Analyze Access Patterns
            </Button>
          </div>

          <ScrollArea className="h-[450px]">
            <div className="space-y-4">
              {patternAnalyses.map(analysis => (
                <Card key={analysis.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">{analysis.analysisType} Analysis</CardTitle>
                      <Badge variant={analysis.complianceScore >= 80 ? "default" : analysis.complianceScore >= 60 ? "secondary" : "destructive"}>
                        Compliance: {analysis.complianceScore}%
                      </Badge>
                    </div>
                    <CardDescription>
                      {new Date(analysis.periodStart).toLocaleDateString()} - {new Date(analysis.periodEnd).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.noCdsCompliance}</AlertDescription>
                    </Alert>

                    {analysis.findings.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">Findings</Label>
                        <div className="space-y-2">
                          {analysis.findings.map(finding => (
                            <div key={finding.id} className="p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium capitalize">{finding.type.replace(/_/g, " ")}</span>
                                <Badge variant={getSeverityVariant(finding.severity)}>{finding.severity}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                              <div className="text-xs text-muted-foreground">
                                <strong>Action:</strong> {finding.suggestedAction}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.recommendations.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">Recommendations</Label>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {analysis.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {patternAnalyses.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pattern analyses yet. Click "Analyze Access Patterns" to generate one.
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
