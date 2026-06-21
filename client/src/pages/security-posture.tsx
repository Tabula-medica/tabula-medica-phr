import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cloud,
  Eye,
  Lock,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
  XCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SecurityFinding {
  id: string;
  provider: string;
  sourceService: string;
  findingType: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  resourceType: string;
  resourceId: string;
  resourceRegion: string;
  affectedDataTypes: string[];
  complianceFrameworks: string[];
  riskScore: number;
  exploitability: string;
  remediation?: {
    title: string;
    description: string;
    automatable: boolean;
    estimatedEffort: string;
    steps: string[];
    riskReduction: number;
  };
}

interface SecurityPosture {
  overallScore: number;
  trend: string;
  lastAssessment: string;
  environments: CloudEnvironment[];
  topRisks: SecurityFinding[];
  complianceStatus: Record<string, { score: number; findings: number }>;
  dataAtRisk: { classification: string; resourceCount: number; findingsCount: number }[];
}

interface CloudEnvironment {
  id: string;
  name: string;
  provider: string;
  accountId: string;
  region: string;
  status: string;
  lastSync: string;
  findingsCount: { critical: number; high: number; medium: number; low: number };
  complianceScore: number;
}

const severityColors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
  informational: "outline",
};

function getProviderIcon(provider: string) {
  switch (provider) {
    case "aws": return <Cloud className="h-4 w-4 text-orange-500" />;
    case "azure": return <Cloud className="h-4 w-4 text-blue-500" />;
    case "gcp": return <Cloud className="h-4 w-4 text-red-500" />;
    default: return <Cloud className="h-4 w-4" />;
  }
}

export default function SecurityPosture() {
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [showRemediationDialog, setShowRemediationDialog] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const { toast } = useToast();

  const { data: postureData, refetch: refetchPosture } = useQuery<{ success: boolean; data: SecurityPosture }>({
    queryKey: ["/api/security-posture/posture"],
  });

  const posture = postureData?.data;

  const { data: statsData } = useQuery<{ success: boolean; data: { totalFindings: number; openFindings: number; criticalFindings: number; phiAtRisk: number; environments: number; overallScore: number } }>({
    queryKey: ["/api/security-posture/stats"],
  });

  const stats = statsData?.data || { totalFindings: 0, openFindings: 0, criticalFindings: 0, phiAtRisk: 0, environments: 0, overallScore: 0 };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security-posture/analyze", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Risk Analysis Complete",
        description: `Found ${data.data.recommendations.length} recommendations`,
      });
      refetchPosture();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze risks", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-security">
            <ShieldAlert className="h-8 w-8" />
            Security Posture Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Proactive cloud security monitoring and compliance
          </p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="text-center">
            <p className={`text-2xl font-bold ${stats.overallScore >= 80 ? "text-emerald-600 dark:text-emerald-300" : stats.overallScore >= 50 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`} data-testid="text-stat-score">
              {stats.overallScore}%
            </p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-300" data-testid="text-stat-critical">{stats.criticalFindings}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-300" data-testid="text-stat-phi">{stats.phiAtRisk}</p>
            <p className="text-xs text-muted-foreground">PHI at Risk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" data-testid="text-stat-envs">{stats.environments}</p>
            <p className="text-xs text-muted-foreground">Environments</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg" data-testid="tabs-list-security">
          <TabsTrigger value="dashboard" data-testid="trigger-tab-dashboard">
            <Shield className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="findings" data-testid="trigger-tab-findings">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Findings
          </TabsTrigger>
          <TabsTrigger value="environments" data-testid="trigger-tab-environments">
            <Cloud className="h-4 w-4 mr-2" />
            Environments
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="trigger-tab-compliance">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <DashboardTab posture={posture} analyzeMutation={analyzeMutation} />
        </TabsContent>

        <TabsContent value="findings" className="space-y-4 mt-4">
          <FindingsTab
            filterProvider={filterProvider}
            setFilterProvider={setFilterProvider}
            filterSeverity={filterSeverity}
            setFilterSeverity={setFilterSeverity}
            onSelectFinding={(f) => {
              setSelectedFinding(f);
              setShowRemediationDialog(true);
            }}
          />
        </TabsContent>

        <TabsContent value="environments" className="space-y-4 mt-4">
          <EnvironmentsTab />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4 mt-4">
          <ComplianceTab posture={posture} />
        </TabsContent>
      </Tabs>

      {selectedFinding && (
        <RemediationDialog
          open={showRemediationDialog}
          onClose={() => {
            setShowRemediationDialog(false);
            setSelectedFinding(null);
          }}
          finding={selectedFinding}
        />
      )}
    </div>
  );
}

function DashboardTab({ posture, analyzeMutation }: { posture?: SecurityPosture; analyzeMutation: ReturnType<typeof useMutation<unknown, Error, void, unknown>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Posture Score
          </CardTitle>
          <CardDescription>Overall security health across all environments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none" className="text-muted" />
                <circle
                  cx="80" cy="80" r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * (posture?.overallScore || 0)) / 100}
                  className={`${(posture?.overallScore || 0) >= 80 ? "text-emerald-500" : (posture?.overallScore || 0) >= 50 ? "text-amber-500" : "text-rose-500"}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-4xl font-bold">{posture?.overallScore || 0}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {posture?.trend === "improving" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
            {posture?.trend === "declining" && <TrendingDown className="h-4 w-4 text-rose-500" />}
            <span className="text-sm capitalize">{posture?.trend || "stable"}</span>
          </div>

          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="w-full"
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyze Risks
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Risks
          </CardTitle>
          <CardDescription>Highest priority security findings</CardDescription>
        </CardHeader>
        <CardContent>
          {posture?.topRisks && posture.topRisks.length > 0 ? (
            <div className="space-y-3">
              {posture.topRisks.slice(0, 4).map((risk) => {
                return (
                  <div key={risk.id} className="flex items-start gap-3 p-2 rounded bg-muted" data-testid={`risk-${risk.id}`}>
                    {getProviderIcon(risk.provider)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={severityColors[risk.severity]}>{risk.severity}</Badge>
                        <span className="font-mono text-xs">{risk.riskScore}</span>
                      </div>
                      <p className="text-sm truncate">{risk.title}</p>
                      <div className="flex gap-1 mt-1">
                        {risk.affectedDataTypes.slice(0, 2).map((dt) => (
                          <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mb-4 opacity-50" />
              <p>No critical risks detected</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Data at Risk
          </CardTitle>
          <CardDescription>Sensitive data types affected by open findings</CardDescription>
        </CardHeader>
        <CardContent>
          {posture?.dataAtRisk && posture.dataAtRisk.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {posture.dataAtRisk.map((data) => (
                <div key={data.classification} className="p-4 rounded bg-muted text-center" data-testid={`data-risk-${data.classification}`}>
                  <p className="text-2xl font-bold">{data.findingsCount}</p>
                  <p className="text-sm text-muted-foreground">{data.classification}</p>
                  <p className="text-xs text-muted-foreground">{data.resourceCount} resources</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No sensitive data at risk</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FindingsTab({
  filterProvider,
  setFilterProvider,
  filterSeverity,
  setFilterSeverity,
  onSelectFinding,
}: {
  filterProvider: string;
  setFilterProvider: (v: string) => void;
  filterSeverity: string;
  setFilterSeverity: (v: string) => void;
  onSelectFinding: (f: SecurityFinding) => void;
}) {
  const queryParams = new URLSearchParams();
  if (filterProvider && filterProvider !== "all") queryParams.set("provider", filterProvider);
  if (filterSeverity && filterSeverity !== "all") queryParams.set("severity", filterSeverity);

  const { data: findingsData, isLoading, refetch } = useQuery<{ success: boolean; data: SecurityFinding[] }>({
    queryKey: [`/api/security-posture/findings?${queryParams.toString()}`],
  });

  const findings = findingsData?.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Security Findings</CardTitle>
          <CardDescription>All security and compliance findings across environments</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={filterProvider} onValueChange={setFilterProvider}>
            <SelectTrigger className="w-32" data-testid="select-provider">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-provider-all">All</SelectItem>
              <SelectItem value="aws" data-testid="option-provider-aws">AWS</SelectItem>
              <SelectItem value="azure" data-testid="option-provider-azure">Azure</SelectItem>
              <SelectItem value="gcp" data-testid="option-provider-gcp">GCP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-32" data-testid="select-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-severity-all">All</SelectItem>
              <SelectItem value="critical" data-testid="option-severity-critical">Critical</SelectItem>
              <SelectItem value="high" data-testid="option-severity-high">High</SelectItem>
              <SelectItem value="medium" data-testid="option-severity-medium">Medium</SelectItem>
              <SelectItem value="low" data-testid="option-severity-low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-findings">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading findings...</span>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Data Types</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((finding) => {
                  return (
                    <TableRow key={finding.id} data-testid={`row-finding-${finding.id}`}>
                      <TableCell>
                        <Badge variant={severityColors[finding.severity]}>{finding.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getProviderIcon(finding.provider)}
                          <span className="text-xs uppercase">{finding.provider}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{finding.title}</p>
                          <p className="text-xs text-muted-foreground">{finding.sourceService}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {finding.affectedDataTypes.slice(0, 2).map((dt) => (
                            <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{finding.riskScore}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={finding.status === "open" ? "destructive" : "secondary"}>
                          {finding.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectFinding(finding)}
                          data-testid={`button-remediate-${finding.id}`}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Remediate
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function RemediationDialog({ open, onClose, finding }: { open: boolean; onClose: () => void; finding: SecurityFinding }) {
  const { toast } = useToast();

  const remediateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/security-posture/findings/${finding.id}/remediate`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-posture/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security-posture/posture"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security-posture/stats"] });
      toast({
        title: data.data.success ? "Remediation Applied" : "Manual Action Required",
        description: data.data.message,
        variant: data.data.success ? "default" : "destructive",
      });
      if (data.data.success) onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply remediation", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Remediation Details
          </DialogTitle>
          <DialogDescription>Review and apply recommended fixes</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {getProviderIcon(finding.provider)}
            <div>
              <Badge variant={severityColors[finding.severity]} className="mb-1">{finding.severity}</Badge>
              <p className="font-medium">{finding.title}</p>
            </div>
          </div>

          <div className="bg-muted p-3 rounded">
            <p className="text-sm">{finding.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Resource</p>
              <p className="font-mono text-xs">{finding.resourceId.substring(0, 50)}...</p>
            </div>
            <div>
              <p className="text-muted-foreground">Region</p>
              <p>{finding.resourceRegion}</p>
            </div>
          </div>

          {finding.remediation && (
            <>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{finding.remediation.title}</p>
                  {finding.remediation.automatable && (
                    <Badge variant="default">Automatable</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{finding.remediation.description}</p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Steps:</p>
                  <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                    {finding.remediation.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="flex gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Estimated Effort</p>
                    <p className="capitalize">{finding.remediation.estimatedEffort}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Reduction</p>
                    <p className="text-emerald-600 dark:text-emerald-300">-{finding.remediation.riskReduction} points</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-remediation">
            Cancel
          </Button>
          {finding.remediation?.automatable && (
            <Button
              onClick={() => remediateMutation.mutate()}
              disabled={remediateMutation.isPending}
              data-testid="button-apply-remediation"
            >
              {remediateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Apply Remediation
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnvironmentsTab() {
  const { toast } = useToast();

  const { data: envData, isLoading, refetch } = useQuery<{ success: boolean; data: CloudEnvironment[] }>({
    queryKey: ["/api/security-posture/environments"],
  });

  const environments = envData?.data || [];

  const syncMutation = useMutation({
    mutationFn: async (envId: string) => {
      const res = await apiRequest("POST", `/api/security-posture/environments/${envId}/sync`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-posture/environments"] });
      toast({ title: "Environment Synced" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sync environment", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Cloud Environments</CardTitle>
          <CardDescription>Connected cloud provider accounts and security status</CardDescription>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-envs">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading environments...</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {environments.map((env) => {
              return (
                <Card key={env.id} data-testid={`card-env-${env.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(env.provider)}
                        <CardTitle className="text-base">{env.name}</CardTitle>
                      </div>
                      <Badge variant={env.status === "connected" ? "default" : "destructive"}>
                        {env.status}
                      </Badge>
                    </div>
                    <CardDescription>{env.region}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compliance Score</span>
                      <span className={`font-bold ${env.complianceScore >= 80 ? "text-emerald-600 dark:text-emerald-300" : env.complianceScore >= 50 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`}>
                        {env.complianceScore}%
                      </span>
                    </div>
                    <Progress value={env.complianceScore} className="h-2" />

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="font-bold text-rose-600 dark:text-rose-300">{env.findingsCount.critical}</p>
                        <p className="text-muted-foreground">Critical</p>
                      </div>
                      <div>
                        <p className="font-bold text-orange-600 dark:text-orange-300">{env.findingsCount.high}</p>
                        <p className="text-muted-foreground">High</p>
                      </div>
                      <div>
                        <p className="font-bold text-amber-600 dark:text-amber-300">{env.findingsCount.medium}</p>
                        <p className="text-muted-foreground">Medium</p>
                      </div>
                      <div>
                        <p className="font-bold">{env.findingsCount.low}</p>
                        <p className="text-muted-foreground">Low</p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => syncMutation.mutate(env.id)}
                      disabled={syncMutation.isPending}
                      data-testid={`button-sync-${env.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComplianceTab({ posture }: { posture?: SecurityPosture }) {
  const frameworks = ["HIPAA", "SOC2", "PCI_DSS", "GDPR", "NIST", "CIS"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Frameworks</CardTitle>
        <CardDescription>Compliance posture across regulatory frameworks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((framework) => {
            const status = posture?.complianceStatus?.[framework] || { score: 100, findings: 0 };
            return (
              <Card key={framework} data-testid={`card-compliance-${framework}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{framework.replace("_", "-")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Compliance</span>
                    <span className={`text-xl font-bold ${status.score >= 80 ? "text-emerald-600 dark:text-emerald-300" : status.score >= 50 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`}>
                      {status.score}%
                    </span>
                  </div>
                  <Progress value={status.score} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Open Findings</span>
                    <Badge variant={status.findings > 0 ? "destructive" : "secondary"}>
                      {status.findings}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
