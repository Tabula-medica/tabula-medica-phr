import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Eye,
  FileText,
  Activity,
  Server,
  Download,
  RefreshCw,
  Clock,
  Plus,
  Calendar,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Archive,
  Tag,
  Search,
  Loader2,
  Zap,
  Flag,
  Ticket,
  Bell,
  UserX,
  CircleDot,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { clickable } from "@/lib/a11y";

interface DashboardOverview {
  evidenceStats: {
    total: number;
    byCategory: Record<string, number>;
    bySoc2Category: Record<string, number>;
    byStatus: Record<string, number>;
  };
  latestReport: WeeklyReport | null;
  recentEvidence: EvidenceItem[];
  recentReports: WeeklyReport[];
  overallHealth: {
    score: number;
    soc2Scores: Record<string, number>;
    recommendations: string[];
  };
}

interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  soc2Category: string;
  controlId: string;
  tags: string[];
  source: string;
  severity: string;
  status: string;
  collectedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface WeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalAuditEvents: number;
  totalEvidenceCollected: number;
  newFindings: number;
  resolvedFindings: number;
  overallComplianceScore: number;
  soc2Scores: Record<string, number>;
  eventBreakdown: Record<string, number>;
  criticalEvents: Array<{ type: string; count: number; description: string }>;
  recommendations: string[];
  status: string;
  generatedBy: string;
  approvedBy: string | null;
  createdAt: string;
}

const evidenceCategories = [
  { value: "audit_log", label: "Audit Log" },
  { value: "screenshot", label: "Screenshot" },
  { value: "policy_update", label: "Policy Update" },
  { value: "access_review", label: "Access Review" },
  { value: "risk_assessment", label: "Risk Assessment" },
  { value: "penetration_test", label: "Penetration Test" },
  { value: "vulnerability_scan", label: "Vulnerability Scan" },
  { value: "training_record", label: "Training Record" },
  { value: "incident_response", label: "Incident Response" },
  { value: "change_management", label: "Change Management" },
  { value: "vendor_assessment", label: "Vendor Assessment" },
  { value: "encryption_cert", label: "Encryption Certificate" },
  { value: "backup_verification", label: "Backup Verification" },
  { value: "disaster_recovery", label: "Disaster Recovery" },
  { value: "other", label: "Other" },
];

const soc2Categories = [
  { value: "security", label: "Security", icon: Shield, color: "text-blue-600 dark:text-blue-400" },
  { value: "availability", label: "Availability", icon: Server, color: "text-green-600 dark:text-green-400" },
  { value: "processing_integrity", label: "Processing Integrity", icon: CheckCircle2, color: "text-purple-600 dark:text-purple-400" },
  { value: "confidentiality", label: "Confidentiality", icon: Lock, color: "text-amber-600 dark:text-amber-400" },
  { value: "privacy", label: "Privacy", icon: Eye, color: "text-rose-600 dark:text-rose-400" },
];

function ScoreGauge({ score, label, size = "lg" }: { score: number; label: string; size?: "sm" | "lg" }) {
  const color = score >= 90 ? "text-green-600 dark:text-green-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const bgColor = score >= 90 ? "bg-green-100 dark:bg-green-900/30" : score >= 70 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30";
  const ringColor = score >= 90 ? "stroke-green-500" : score >= 70 ? "stroke-amber-500" : "stroke-red-500";
  const dim = size === "lg" ? 120 : 80;
  const strokeWidth = size === "lg" ? 8 : 6;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5" data-testid={`gauge-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
          <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`${ringColor} transition-all duration-700`} />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
          <span className={size === "lg" ? "text-2xl font-bold" : "text-lg font-semibold"}>{score}%</span>
        </div>
      </div>
      <span className={`text-xs font-medium text-muted-foreground ${size === "lg" ? "mt-1" : ""}`}>{label}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    info: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[severity] || variants.info}`} data-testid={`badge-severity-${severity}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    expired: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    draft: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    reviewed: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  return (
    <Badge variant="outline" className={variants[status] || ""} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function ComplianceDashboard() {
  useSEO({
    title: "SOC 2 Continuous Compliance | Tabula Medica",
    description: "Monitor SOC 2 trust service criteria, collect evidence, and generate weekly compliance reports for management review.",
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSoc2, setFilterSoc2] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addEvidenceOpen, setAddEvidenceOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: overview, isLoading: overviewLoading } = useQuery<DashboardOverview>({
    queryKey: ["/api/soc2-compliance/dashboard-overview"],
  });

  const { data: evidenceData, isLoading: evidenceLoading } = useQuery<{ evidence: EvidenceItem[]; stats: DashboardOverview["evidenceStats"] }>({
    queryKey: ["/api/soc2-compliance/evidence", filterCategory, filterSoc2],
  });

  const { data: reports, isLoading: reportsLoading } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/soc2-compliance/weekly-reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/soc2-compliance/generate-nightly-summary"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance"] });
      toast({ title: "Report Generated", description: "Weekly compliance summary has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate compliance report.", variant: "destructive" });
    },
  });

  const addEvidenceMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/soc2-compliance/evidence", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance"] });
      setAddEvidenceOpen(false);
      toast({ title: "Evidence Added", description: "Compliance evidence has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add evidence.", variant: "destructive" });
    },
  });

  const approveReportMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/soc2-compliance/weekly-reports/${id}`, { status: "approved", approvedBy: "admin", approvedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance"] });
      toast({ title: "Report Approved", description: "Weekly report has been approved for publication." });
    },
  });

  const filteredEvidence = (evidenceData?.evidence || overview?.recentEvidence || []).filter(e => {
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase()) && !e.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const overallScore = overview?.overallHealth?.score ?? 100;
  const stats = overview?.evidenceStats;

  if (overviewLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" data-testid="page-compliance-dashboard-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-compliance-dashboard">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ShieldCheck className="h-7 w-7 text-primary" />
            SOC 2 Continuous Compliance
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Monitor trust service criteria, collect evidence, and generate management reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addEvidenceOpen} onOpenChange={setAddEvidenceOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-evidence">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Evidence
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Compliance Evidence</DialogTitle>
                <DialogDescription>Record new security evidence for SOC 2 audit trail</DialogDescription>
              </DialogHeader>
              <AddEvidenceForm onSubmit={(data) => addEvidenceMutation.mutate(data)} isPending={addEvidenceMutation.isPending} />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => generateReportMutation.mutate()} disabled={generateReportMutation.isPending} data-testid="button-generate-report">
            {generateReportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1.5" />}
            Generate Report
          </Button>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-export-pdf">
                <Download className="h-4 w-4 mr-1.5" />
                Export PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Export Compliance Report</DialogTitle>
                <DialogDescription>
                  Generate a HIPAA-compliant PDF with compliance findings, evidence register, and attestation signatures for external auditor review.
                </DialogDescription>
              </DialogHeader>
              <ExportPdfForm onExport={() => setExportDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-overall-score">
          <CardContent className="pt-6 flex flex-col items-center">
            <ScoreGauge score={overallScore} label="Overall Score" />
          </CardContent>
        </Card>
        <Card data-testid="card-total-evidence">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Evidence</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">{stats?.byStatus?.active ?? 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pending Review</span>
                <span className="font-medium">{stats?.byStatus?.pending_review ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-latest-report">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Weekly Reports</p>
              </div>
            </div>
            {overview?.latestReport && (
              <div className="mt-3 text-xs text-muted-foreground">
                Latest: {overview.latestReport.weekStartDate} <StatusBadge status={overview.latestReport.status} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-recommendations">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.overallHealth?.recommendations?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Recommendations</p>
              </div>
            </div>
            {(overview?.overallHealth?.recommendations?.length ?? 0) > 0 && (
              <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{overview?.overallHealth?.recommendations?.[0]}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-compliance">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="evidence" data-testid="tab-evidence">
            <FileText className="h-4 w-4 mr-1.5" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">
            <Shield className="h-4 w-4 mr-1.5" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="remediation" data-testid="tab-remediation">
            <Zap className="h-4 w-4 mr-1.5" />
            Remediation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-soc2-scores">
              <CardHeader>
                <CardTitle className="text-lg">Trust Service Criteria Scores</CardTitle>
                <CardDescription>SOC 2 Type II compliance posture across all five categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-center gap-6">
                  {soc2Categories.map(cat => (
                    <ScoreGauge
                      key={cat.value}
                      score={overview?.overallHealth?.soc2Scores?.[cat.value] ?? 100}
                      label={cat.label}
                      size="sm"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-recommendations-list">
              <CardHeader>
                <CardTitle className="text-lg">Active Recommendations</CardTitle>
                <CardDescription>Action items from the latest compliance assessment</CardDescription>
              </CardHeader>
              <CardContent>
                {(overview?.overallHealth?.recommendations?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-2 text-green-500" />
                    <p className="text-sm font-medium">No open recommendations</p>
                    <p className="text-xs">All compliance items are in good standing</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {overview?.overallHealth?.recommendations?.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm" data-testid={`recommendation-${i}`}>
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-evidence-by-category">
            <CardHeader>
              <CardTitle className="text-lg">Evidence by Category</CardTitle>
              <CardDescription>Distribution of collected compliance evidence</CardDescription>
            </CardHeader>
            <CardContent>
              {stats && Object.keys(stats.byCategory).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(stats.byCategory).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-2 p-3 rounded-lg border bg-card" data-testid={`evidence-category-${cat}`}>
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{count}</p>
                        <p className="text-xs text-muted-foreground capitalize">{cat.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Archive className="h-10 w-10 mb-2" />
                  <p className="text-sm">No evidence collected yet</p>
                  <p className="text-xs">Add evidence to start tracking compliance</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-evidence">
            <CardHeader>
              <CardTitle className="text-lg">Recent Evidence</CardTitle>
              <CardDescription>Latest compliance evidence entries</CardDescription>
            </CardHeader>
            <CardContent>
              {(overview?.recentEvidence?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {overview?.recentEvidence?.slice(0, 5).map(ev => (
                    <EvidenceRow key={ev.id} evidence={ev} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No evidence entries yet. Click "Add Evidence" to begin.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4 mt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search evidence..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search-evidence" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {evidenceCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSoc2} onValueChange={setFilterSoc2}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-soc2">
                <SelectValue placeholder="Trust Criteria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Criteria</SelectItem>
                {soc2Categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              {evidenceLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : filteredEvidence.length > 0 ? (
                <div className="space-y-3">
                  {filteredEvidence.map(ev => (
                    <EvidenceRow key={ev.id} evidence={ev} detailed />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">No evidence found</p>
                  <p className="text-xs">Try adjusting your filters or add new evidence</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weekly Compliance Reports</CardTitle>
              <CardDescription>Automated nightly summaries aggregated into weekly management reports</CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (reports?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {reports?.map(report => (
                    <ReportCard key={report.id} report={report} onApprove={() => approveReportMutation.mutate(report.id)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">No reports generated yet</p>
                  <p className="text-xs">Click "Generate Report" to create the first weekly summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4 mt-6">
          <ControlsPanel />
        </TabsContent>

        <TabsContent value="remediation" className="space-y-4 mt-6">
          <RemediationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EvidenceRow({ evidence, detailed = false }: { evidence: EvidenceItem; detailed?: boolean }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors" data-testid={`evidence-row-${evidence.id}`}>
      <div className="shrink-0 mt-0.5">
        <SeverityBadge severity={evidence.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium truncate">{evidence.title}</h4>
          <StatusBadge status={evidence.status} />
        </div>
        {detailed && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{evidence.description}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {evidence.category.replace(/_/g, " ")}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {evidence.soc2Category.replace(/_/g, " ")}
          </span>
          <span>·</span>
          <span>{evidence.controlId}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(evidence.createdAt).toLocaleDateString()}
          </span>
          {evidence.tags.length > 0 && (
            <>
              <span>·</span>
              {evidence.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report, onApprove }: { report: WeeklyReport; onApprove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`report-card-${report.id}`}>
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors" {...clickable(() => setExpanded(!expanded))}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">Week of {report.weekStartDate} — {report.weekEndDate}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={report.status} />
              <span className="text-xs text-muted-foreground">Score: {report.overallComplianceScore}%</span>
              <span className="text-xs text-muted-foreground">· {report.totalEvidenceCollected} evidence items</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.status === "draft" && (
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onApprove(); }} data-testid={`button-approve-${report.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Audit Events</p>
              <p className="text-lg font-semibold">{report.totalAuditEvents}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">New Findings</p>
              <p className="text-lg font-semibold text-amber-600">{report.newFindings}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resolved</p>
              <p className="text-lg font-semibold text-green-600">{report.resolvedFindings}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Generated By</p>
              <p className="text-sm font-medium">{report.generatedBy}</p>
            </div>
          </div>

          {Object.keys(report.soc2Scores || {}).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Trust Service Scores</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(report.soc2Scores).map(([cat, score]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs capitalize">{cat.replace(/_/g, " ")}</span>
                    <Progress value={score as number} className="w-20 h-2" />
                    <span className="text-xs font-medium">{score as number}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
              <ul className="space-y-1.5">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.criticalEvents.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Critical Events</p>
              <div className="space-y-1.5">
                {report.criticalEvents.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="capitalize">{evt.type.replace(/_/g, " ")}: {evt.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddEvidenceForm({ onSubmit, isPending }: { onSubmit: (data: Record<string, unknown>) => void; isPending: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("audit_log");
  const [soc2Category, setSoc2Category] = useState("security");
  const [controlId, setControlId] = useState("");
  const [severity, setSeverity] = useState("info");
  const [tags, setTags] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      category,
      soc2Category,
      controlId: controlId || `${soc2Category.toUpperCase().slice(0, 2)}-AUTO`,
      severity,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      source: "manual",
      collectedBy: "admin",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="evidence-title">Title</Label>
        <Input id="evidence-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Q1 Access Review Completion" required data-testid="input-evidence-title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="evidence-description">Description</Label>
        <Textarea id="evidence-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the evidence..." required data-testid="input-evidence-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="compliance-dashboard-category" data-testid="select-evidence-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {evidenceCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-trust-service-criteria">Trust Service Criteria</Label>
          <Select value={soc2Category} onValueChange={setSoc2Category}>
            <SelectTrigger id="compliance-dashboard-trust-service-criteria" data-testid="select-evidence-soc2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {soc2Categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="evidence-control-id">Control ID</Label>
          <Input id="evidence-control-id" value={controlId} onChange={e => setControlId(e.target.value)} placeholder="e.g., CC6.1" data-testid="input-evidence-control-id" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-severity">Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger id="compliance-dashboard-severity" data-testid="select-evidence-severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="evidence-tags">Tags (comma-separated)</Label>
        <Input id="evidence-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g., quarterly, access-control, hipaa" data-testid="input-evidence-tags" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !title || !description} data-testid="button-submit-evidence">
          {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
          Add Evidence
        </Button>
      </DialogFooter>
    </form>
  );
}

function ControlsPanel() {
  const { data: hipaaData, isLoading: hipaaLoading } = useQuery<any>({
    queryKey: ["/api/compliance-dashboard/hipaa-checklist"],
  });

  const { data: soc2Data, isLoading: soc2Loading } = useQuery<any>({
    queryKey: ["/api/compliance-dashboard/soc2-controls"],
  });

  if (hipaaLoading || soc2Loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-soc2-controls">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            SOC 2 Trust Service Controls
          </CardTitle>
          <CardDescription>
            {soc2Data?.summary?.implemented ?? 0} of {soc2Data?.summary?.total ?? 0} controls implemented
          </CardDescription>
          <Progress value={soc2Data?.summary ? (soc2Data.summary.implemented / soc2Data.summary.total) * 100 : 100} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {soc2Data?.security && (
            <ControlGroup title="Security (Common Criteria)" controls={soc2Data.security} icon={<Shield className="h-4 w-4 text-blue-500" />} />
          )}
          {soc2Data?.availability && (
            <ControlGroup title="Availability" controls={soc2Data.availability} icon={<Server className="h-4 w-4 text-green-500" />} />
          )}
          {soc2Data?.confidentiality && (
            <ControlGroup title="Confidentiality" controls={soc2Data.confidentiality} icon={<Lock className="h-4 w-4 text-amber-500" />} />
          )}
          {soc2Data?.processingIntegrity && (
            <ControlGroup title="Processing Integrity" controls={soc2Data.processingIntegrity} icon={<Activity className="h-4 w-4 text-purple-500" />} />
          )}
          {soc2Data?.privacy && (
            <ControlGroup title="Privacy" controls={soc2Data.privacy} icon={<Eye className="h-4 w-4 text-rose-500" />} />
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-hipaa-controls">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            HIPAA Safeguard Checklist
          </CardTitle>
          <CardDescription>
            {hipaaData?.summary?.implemented ?? 0} of {hipaaData?.summary?.total ?? 0} safeguards implemented ({hipaaData?.summary?.compliancePercentage ?? 100}%)
          </CardDescription>
          <Progress value={hipaaData?.summary?.compliancePercentage ?? 100} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {hipaaData?.administrativeSafeguards && (
            <ControlGroup title="Administrative Safeguards" controls={hipaaData.administrativeSafeguards} icon={<FileText className="h-4 w-4 text-blue-500" />} />
          )}
          {hipaaData?.physicalSafeguards && (
            <ControlGroup title="Physical Safeguards" controls={hipaaData.physicalSafeguards} icon={<Server className="h-4 w-4 text-green-500" />} />
          )}
          {hipaaData?.technicalSafeguards && (
            <ControlGroup title="Technical Safeguards" controls={hipaaData.technicalSafeguards} icon={<Lock className="h-4 w-4 text-amber-500" />} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ControlGroup({ title, controls, icon }: { title: string; controls: any[]; icon: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg" data-testid={`control-group-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <button className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">{controls.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {controls.filter((c: any) => c.status === "implemented" || c.status === "cloud_provider").length}/{controls.length} implemented
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t divide-y">
          {controls.map((control: any) => (
            <div key={control.id} className="p-3 text-sm" data-testid={`control-${control.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{control.id || control.section}</span>
                    <span className="font-medium">{control.name || control.requirement}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{control.evidence}</p>
                </div>
                <Badge variant={control.status === "implemented" || control.status === "cloud_provider" ? "default" : "destructive"} className="shrink-0 text-xs">
                  {control.status === "cloud_provider" ? "Cloud Provider" : control.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RemediationWorkflowItem {
  id: string;
  triggerType: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  affectedUserId: string | null;
  affectedUserEmail: string | null;
  accountFlagged: boolean;
  accountFlaggedAt: string | null;
  ticketId: string | null;
  ticketTitle: string | null;
  ticketCreatedAt: string | null;
  alertChannel: string;
  alertSentAt: string | null;
  alertRecipients: string[];
  incidentLogs: Array<{ timestamp: string; level: string; message: string; source: string }>;
  soc2Category: string;
  controlId: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface RemediationStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byTriggerType: Record<string, number>;
  activeCount: number;
  resolvedCount: number;
}

interface TriggerTypeInfo {
  value: string;
  label: string;
  soc2Category: string;
  controlId: string;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

const statusColors: Record<string, string> = {
  triggered: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  account_flagged: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ticket_created: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  alert_sent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function RemediationPanel() {
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<RemediationWorkflowItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  const { data: workflows, isLoading: workflowsLoading } = useQuery<RemediationWorkflowItem[]>({
    queryKey: ["/api/soc2-compliance/remediation/workflows", filterStatus],
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery<RemediationStats>({
    queryKey: ["/api/soc2-compliance/remediation/stats"],
    refetchInterval: 15000,
  });

  const { data: triggerTypes } = useQuery<TriggerTypeInfo[]>({
    queryKey: ["/api/soc2-compliance/remediation/trigger-types"],
  });

  const triggerMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/soc2-compliance/remediation/trigger", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance"] });
      setTriggerDialogOpen(false);
      toast({ title: "Remediation Triggered", description: "Automated remediation workflow has been executed. Account flagged, ticket created, and alerts sent." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to trigger remediation workflow.", variant: "destructive" });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/soc2-compliance/remediation/workflows/${id}/acknowledge`, { acknowledgedBy: "admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance/remediation"] });
      toast({ title: "Acknowledged", description: "Workflow has been acknowledged." });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (data: { id: string; resolvedBy: string; resolutionNotes: string; unflagAccount: boolean }) =>
      apiRequest("PATCH", `/api/soc2-compliance/remediation/workflows/${data.id}/resolve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2-compliance/remediation"] });
      setResolveDialogOpen(false);
      setSelectedWorkflow(null);
      toast({ title: "Resolved", description: "Remediation workflow has been resolved." });
    },
  });

  const filteredWorkflows = filterStatus === "all"
    ? workflows
    : workflows?.filter(w => w.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-incidents">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-incidents">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.activeCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-resolved-incidents">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.resolvedCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-severity-breakdown">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {stats?.bySeverity?.critical ?? 0}C / {stats?.bySeverity?.high ?? 0}H
                </p>
                <p className="text-xs text-muted-foreground">Critical / High</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Automated Remediation Workflows
              </CardTitle>
              <CardDescription>
                When a control fails, remediation automatically flags the account, creates a ticket, and alerts the compliance team
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]" data-testid="select-remediation-filter">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="triggered">Triggered</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-trigger-remediation">
                    <Zap className="h-4 w-4 mr-1.5" />
                    Trigger Remediation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Trigger Automated Remediation</DialogTitle>
                    <DialogDescription>
                      This will automatically: 1) Flag the affected account, 2) Create a remediation ticket, 3) Send security alerts
                    </DialogDescription>
                  </DialogHeader>
                  <TriggerRemediationForm
                    triggerTypes={triggerTypes || []}
                    onSubmit={(data) => triggerMutation.mutate(data)}
                    isPending={triggerMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workflowsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (filteredWorkflows?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {filteredWorkflows?.map(workflow => (
                <RemediationWorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onAcknowledge={() => acknowledgeMutation.mutate(workflow.id)}
                  onResolve={() => { setSelectedWorkflow(workflow); setResolveDialogOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="empty-remediation">
              <ShieldCheck className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">No Remediation Workflows</p>
              <p className="text-xs">All controls are passing. Trigger a test remediation to verify the workflow.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Remediation</DialogTitle>
            <DialogDescription>Provide resolution details for: {selectedWorkflow?.title}</DialogDescription>
          </DialogHeader>
          <ResolveForm
            workflow={selectedWorkflow}
            onSubmit={(data) => resolveMutation.mutate(data)}
            isPending={resolveMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TriggerRemediationForm({ triggerTypes, onSubmit, isPending }: {
  triggerTypes: TriggerTypeInfo[];
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [triggerType, setTriggerType] = useState("failed_auth_spike");
  const [severity, setSeverity] = useState("high");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [affectedEmail, setAffectedEmail] = useState("");
  const [alertChannel, setAlertChannel] = useState("email");
  const [recipients, setRecipients] = useState("security@tabulamedica.health, compliance@tabulamedica.health");

  const selectedType = triggerTypes.find(t => t.value === triggerType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      triggerType,
      severity,
      title: title || `${selectedType?.label || triggerType} Detected`,
      description: description || `Automated detection of ${(selectedType?.label || triggerType).toLowerCase()} incident requiring immediate remediation.`,
      affectedUserEmail: affectedEmail || undefined,
      alertChannel,
      alertRecipients: recipients.split(",").map(r => r.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-trigger-type">Trigger Type</Label>
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger id="compliance-dashboard-trigger-type" data-testid="select-trigger-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {triggerTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType && (
            <p className="text-[10px] text-muted-foreground">
              SOC 2: {selectedType.soc2Category} ({selectedType.controlId})
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-severity-2">Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger id="compliance-dashboard-severity-2" data-testid="select-trigger-severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-title">Incident Title</Label>
        <Input id="rem-title" value={title} onChange={e => setTitle(e.target.value)}
          placeholder={`${selectedType?.label || "Incident"} Detected`} data-testid="input-remediation-title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-desc">Description</Label>
        <Textarea id="rem-desc" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Describe the incident..." rows={2} data-testid="input-remediation-description" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-email">Affected User Email (optional)</Label>
        <Input id="rem-email" type="email" value={affectedEmail} onChange={e => setAffectedEmail(e.target.value)}
          placeholder="user@example.com" data-testid="input-remediation-email" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="compliance-dashboard-alert-channel">Alert Channel</Label>
          <Select value={alertChannel} onValueChange={setAlertChannel}>
            <SelectTrigger id="compliance-dashboard-alert-channel" data-testid="select-alert-channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="both">Email + Slack</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-recipients">Alert Recipients (comma-separated)</Label>
        <Input id="rem-recipients" value={recipients} onChange={e => setRecipients(e.target.value)}
          placeholder="security@company.com, compliance@company.com" data-testid="input-remediation-recipients" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending} variant="destructive" data-testid="button-submit-remediation">
          {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
          Execute Remediation
        </Button>
      </DialogFooter>
    </form>
  );
}

function RemediationWorkflowCard({ workflow, onAcknowledge, onResolve }: {
  workflow: RemediationWorkflowItem;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = !["resolved", "completed"].includes(workflow.status);

  return (
    <div className={`border rounded-lg overflow-hidden ${isActive ? "border-l-4 border-l-red-500" : ""}`}
      data-testid={`remediation-card-${workflow.id}`}>
      <div className="p-4 flex items-start justify-between cursor-pointer hover:bg-accent/50 transition-colors"
        {...clickable(() => setExpanded(!expanded))}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${
            workflow.severity === "critical" ? "bg-red-100 dark:bg-red-900/30" :
            workflow.severity === "high" ? "bg-orange-100 dark:bg-orange-900/30" :
            "bg-amber-100 dark:bg-amber-900/30"
          }`}>
            <AlertTriangle className={`h-5 w-5 ${
              workflow.severity === "critical" ? "text-red-600 dark:text-red-400" :
              workflow.severity === "high" ? "text-orange-600 dark:text-orange-400" :
              "text-amber-600 dark:text-amber-400"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium truncate">{workflow.title}</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${severityColors[workflow.severity] || severityColors.medium}`}>
                {workflow.severity}
              </span>
              <Badge variant="outline" className={statusColors[workflow.status] || ""}>
                {workflow.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{workflow.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              {workflow.ticketId && (
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  {workflow.ticketId}
                </span>
              )}
              {workflow.accountFlagged && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Flag className="h-3 w-3" />
                  Account Flagged
                </span>
              )}
              {workflow.alertSentAt && (
                <span className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Alert via {workflow.alertChannel}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(workflow.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {workflow.status === "completed" && (
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onAcknowledge(); }}
              data-testid={`button-acknowledge-${workflow.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Acknowledge
            </Button>
          )}
          {["completed", "acknowledged"].includes(workflow.status) && (
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onResolve(); }}
              data-testid={`button-resolve-${workflow.id}`}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Resolve
            </Button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Trigger</p>
              <p className="text-sm font-medium">{workflow.triggerType.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">SOC 2 Control</p>
              <p className="text-sm font-medium">{workflow.soc2Category} / {workflow.controlId}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Affected User</p>
              <p className="text-sm font-medium">{workflow.affectedUserEmail || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Alert Recipients</p>
              <p className="text-sm font-medium truncate">{workflow.alertRecipients.join(", ") || "N/A"}</p>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <CircleDot className="h-3.5 w-3.5" />
              Remediation Steps
            </h5>
            <div className="space-y-2">
              <StepIndicator
                icon={<Flag className="h-3.5 w-3.5" />}
                label="Account Flagged"
                completed={workflow.accountFlagged}
                timestamp={workflow.accountFlaggedAt}
                detail={workflow.affectedUserEmail ? `${workflow.affectedUserEmail} flagged for review` : "No user account affected"}
              />
              <StepIndicator
                icon={<Ticket className="h-3.5 w-3.5" />}
                label="Ticket Created"
                completed={!!workflow.ticketId}
                timestamp={workflow.ticketCreatedAt}
                detail={workflow.ticketId ? `${workflow.ticketId}: ${workflow.ticketTitle}` : "Pending"}
              />
              <StepIndicator
                icon={workflow.alertChannel === "slack" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                label={`Alert Sent (${workflow.alertChannel === "both" ? "Email + Slack" : workflow.alertChannel})`}
                completed={!!workflow.alertSentAt}
                timestamp={workflow.alertSentAt}
                detail={workflow.alertRecipients.length > 0 ? `To: ${workflow.alertRecipients.join(", ")}` : "Pending"}
              />
            </div>
          </div>

          {workflow.incidentLogs.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Incident Logs ({workflow.incidentLogs.length})
              </h5>
              <div className="bg-background border rounded-lg p-2 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
                {workflow.incidentLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0 w-[140px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`shrink-0 w-[60px] font-semibold ${
                      log.level === "CRITICAL" ? "text-red-600 dark:text-red-400" :
                      log.level === "ERROR" ? "text-orange-600 dark:text-orange-400" :
                      log.level === "WARN" ? "text-amber-600 dark:text-amber-400" :
                      "text-blue-600 dark:text-blue-400"
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-muted-foreground shrink-0">[{log.source}]</span>
                    <span className="flex-1 break-words">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workflow.resolvedBy && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Resolved by <span className="font-medium text-foreground">{workflow.resolvedBy}</span> on {workflow.resolvedAt ? new Date(workflow.resolvedAt).toLocaleString() : "N/A"}
              </p>
              {workflow.resolutionNotes && (
                <p className="text-xs mt-1">{workflow.resolutionNotes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ icon, label, completed, timestamp, detail }: {
  icon: React.ReactNode;
  label: string;
  completed: boolean;
  timestamp: string | null;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${completed ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
        {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
          {completed && timestamp && (
            <span className="text-[10px] text-muted-foreground">{new Date(timestamp).toLocaleTimeString()}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ResolveForm({ workflow, onSubmit, isPending }: {
  workflow: RemediationWorkflowItem | null;
  onSubmit: (data: { id: string; resolvedBy: string; resolutionNotes: string; unflagAccount: boolean }) => void;
  isPending: boolean;
}) {
  const [resolvedBy, setResolvedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [unflagAccount, setUnflagAccount] = useState(true);

  if (!workflow) return null;

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ id: workflow.id, resolvedBy: resolvedBy || "admin", resolutionNotes: notes, unflagAccount }); }}
      className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="resolve-by">Resolved By</Label>
        <Input id="resolve-by" value={resolvedBy} onChange={e => setResolvedBy(e.target.value)} placeholder="Your name or ID" data-testid="input-resolve-by" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resolve-notes">Resolution Notes</Label>
        <Textarea id="resolve-notes" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Describe the resolution steps taken..." rows={3} data-testid="input-resolve-notes" />
      </div>
      {workflow.accountFlagged && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Unflag Account</p>
              <p className="text-xs text-muted-foreground">Remove the security flag from {workflow.affectedUserEmail}</p>
            </div>
          </div>
          <Switch checked={unflagAccount} onCheckedChange={setUnflagAccount} data-testid="switch-unflag-account" />
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={isPending} data-testid="button-submit-resolve">
          {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
          Resolve Incident
        </Button>
      </DialogFooter>
    </form>
  );
}

function ExportPdfForm({ onExport }: { onExport: () => void }) {
  const [signedBy, setSignedBy] = useState("Compliance Officer");
  const [signedTitle, setSignedTitle] = useState("Chief Information Security Officer");
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeRemediation, setIncludeRemediation] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        signedBy,
        signedTitle,
        includeEvidence: String(includeEvidence),
        includeRemediation: String(includeRemediation),
      });
      const response = await fetch(`/api/soc2-compliance/export-pdf?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : "SOC2-Compliance-Report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "PDF Exported", description: "Compliance report has been downloaded." });
      onExport();
    } catch {
      toast({ title: "Export Failed", description: "Could not generate the compliance PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pdf-signed-by">Attesting Officer Name</Label>
        <Input id="pdf-signed-by" value={signedBy} onChange={e => setSignedBy(e.target.value)}
          placeholder="Name of signing officer" data-testid="input-pdf-signed-by" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pdf-signed-title">Officer Title</Label>
        <Input id="pdf-signed-title" value={signedTitle} onChange={e => setSignedTitle(e.target.value)}
          placeholder="e.g., Chief Information Security Officer" data-testid="input-pdf-signed-title" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div>
            <p className="text-sm font-medium">Include Evidence Register</p>
            <p className="text-xs text-muted-foreground">Detailed table of all compliance evidence items</p>
          </div>
          <Switch checked={includeEvidence} onCheckedChange={setIncludeEvidence} data-testid="switch-include-evidence" />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div>
            <p className="text-sm font-medium">Include Remediation Activity</p>
            <p className="text-xs text-muted-foreground">Automated remediation workflows and incident logs</p>
          </div>
          <Switch checked={includeRemediation} onCheckedChange={setIncludeRemediation} data-testid="switch-include-remediation" />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        The exported PDF is classified CONFIDENTIAL and includes HIPAA compliance disclaimers, attestation signature blocks, and page-level document IDs for audit chain-of-custody.
      </p>
      <DialogFooter>
        <Button onClick={handleExport} disabled={isExporting || !signedBy} data-testid="button-download-pdf">
          {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Download PDF Report
        </Button>
      </DialogFooter>
    </div>
  );
}
