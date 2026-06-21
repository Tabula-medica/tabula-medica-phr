import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  Heart,
  Pill,
  TestTube,
  Activity,
  Calendar,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  Info,
  Sparkles,
  ThermometerSun,
  RefreshCw,
  Printer,
  Download,
  Share2,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ChevronRight,
  FileText,
  Shield,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface ConditionSummary {
  name: string;
  plainLanguage: string;
  status: "active" | "monitoring" | "resolving";
}

interface MedicationSummary {
  name: string;
  purpose: string;
  schedule: string;
}

interface LabSummary {
  name: string;
  value: string;
  date: string;
  status: "normal" | "attention" | "critical";
  plainExplanation: string;
}

interface VitalSummary {
  type: string;
  value: string;
  date: string;
  status: "normal" | "attention" | "critical";
  plainExplanation: string;
}

interface AppointmentSummary {
  date: string;
  type: string;
  provider: string;
  purpose: string;
  daysUntil: number;
}

interface AIInsight {
  category: "wellness" | "medication" | "prevention" | "lifestyle";
  title: string;
  description: string;
  priority: "info" | "attention" | "important";
}

interface PatientFriendlySummary {
  patientId: string;
  firstName: string;
  generatedAt: string;
  overallStatus: "good" | "needs-attention" | "urgent";
  overallMessage: string;
  conditions: ConditionSummary[];
  medications: MedicationSummary[];
  recentLabs: LabSummary[];
  vitals: VitalSummary[];
  upcomingAppointments: AppointmentSummary[];
  aiInsights: AIInsight[];
  allergies: string[];
  disclaimer: string;
}

interface PatientOption {
  id: string;
  firstName: string;
  conditionCount: number;
}

const STATUS_CONFIG = {
  good: {
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    label: "Looking Good",
    emoji: "All clear",
  },
  "needs-attention": {
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    icon: AlertTriangle,
    borderColor: "border-amber-200 dark:border-amber-800",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    label: "Needs Attention",
    emoji: "Some items need review",
  },
  urgent: {
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: ShieldAlert,
    borderColor: "border-red-200 dark:border-red-800",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    label: "Urgent Items",
    emoji: "Please review soon",
  },
};

const CONDITION_STATUS_BADGE = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  monitoring: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  resolving: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const LAB_STATUS_CONFIG = {
  normal: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500", barColor: "bg-green-400", label: "Normal" },
  attention: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500", barColor: "bg-amber-400", label: "Needs Attention" },
  critical: { icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500", barColor: "bg-red-400", label: "Critical" },
};

const INSIGHT_ICON = {
  wellness: Heart,
  medication: Pill,
  prevention: ShieldAlert,
  lifestyle: ThermometerSun,
};

const INSIGHT_PRIORITY_COLOR = {
  info: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
  attention: "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
  important: "border-l-red-400 bg-red-50/50 dark:bg-red-950/20",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatusBarWidth(status: "normal" | "attention" | "critical"): number {
  if (status === "normal") return 30;
  if (status === "attention") return 65;
  return 95;
}

function getStatusTrendIcon(status: "normal" | "attention" | "critical") {
  if (status === "normal") return { icon: Minus, color: "text-green-500", label: "Stable" };
  if (status === "attention") return { icon: ArrowUpRight, color: "text-amber-500", label: "Elevated" };
  return { icon: ArrowDownRight, color: "text-red-500", label: "Out of range" };
}

export default function PatientFriendlySummaryPage() {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: patientsData, isLoading: patientsLoading } = useQuery<{ patients: PatientOption[] }>({
    queryKey: ["/api/patient-friendly-summary/patients"],
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
  } = useQuery<PatientFriendlySummary>({
    queryKey: ["/api/patient-friendly-summary/summary", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const patients = patientsData?.patients || [];
  const statusConfig = summary ? STATUS_CONFIG[summary.overallStatus] : null;
  const StatusIcon = statusConfig?.icon || CheckCircle;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    if (!summary) return;
    const text = buildPlainTextSummary(summary);
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "Health summary copied to clipboard." });
    }).catch(() => {
      toast({ title: "Error", description: "Failed to copy.", variant: "destructive" });
    });
  };

  const handleDownloadText = () => {
    if (!summary) return;
    const text = buildPlainTextSummary(summary);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-snapshot-${summary.firstName}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Health summary saved as text file." });
  };

  const labStatusCounts = summary ? {
    normal: summary.recentLabs.filter(l => l.status === "normal").length,
    attention: summary.recentLabs.filter(l => l.status === "attention").length,
    critical: summary.recentLabs.filter(l => l.status === "critical").length,
  } : { normal: 0, attention: 0, critical: 0 };

  const vitalStatusCounts = summary ? {
    normal: summary.vitals.filter(v => v.status === "normal").length,
    attention: summary.vitals.filter(v => v.status === "attention").length,
    critical: summary.vitals.filter(v => v.status === "critical").length,
  } : { normal: 0, attention: 0, critical: 0 };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6 print:max-w-none print:p-0" data-testid="page-patient-friendly-summary">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              My Health Snapshot
            </h1>
            <p className="text-sm text-muted-foreground">
              A simple overview of your health information
            </p>
          </div>
        </div>

        {summary && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyText} data-testid="button-copy-summary">
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadText} data-testid="button-download-summary">
              <Download className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-summary">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        )}
      </div>

      <Card data-testid="card-patient-selector" className="print:hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {patientsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedPatientId} onValueChange={(val) => { setSelectedPatientId(val); setActiveTab("overview"); }}>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Select a patient to view their summary" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id} data-testid={`option-patient-${p.id}`}>
                        {p.firstName} ({p.id}) — {p.conditionCount} condition{p.conditionCount !== 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {summaryFetching && !summaryLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedPatientId && !summaryLoading && (
        <Card className="border-dashed" data-testid="card-empty-state">
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Patient</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Choose a patient above to see a simplified, easy-to-understand summary of their health information including conditions, medications, test results, and personalized wellness tips.
            </p>
          </CardContent>
        </Card>
      )}

      {summaryLoading && selectedPatientId && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {summary && !summaryLoading && (
        <div className="space-y-5" ref={printRef}>
          <Card className={`${statusConfig?.borderColor} border-2`} data-testid="card-overall-status">
            <CardContent className="pt-6">
              <div className={`flex items-start gap-4 p-4 rounded-lg ${statusConfig?.bgColor}`}>
                <StatusIcon className={`h-8 w-8 shrink-0 mt-0.5 ${
                  summary.overallStatus === "good" ? "text-green-600" :
                  summary.overallStatus === "needs-attention" ? "text-amber-600" : "text-red-600"
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-lg font-semibold">
                      Hi {summary.firstName}
                    </h2>
                    <Badge className={statusConfig?.color} data-testid="badge-overall-status">
                      {statusConfig?.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{summary.overallMessage}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <QuickStatCard
                  icon={Activity}
                  label="Conditions"
                  value={`${summary.conditions.length}`}
                  sub={`${summary.conditions.filter(c => c.status === "active").length} active`}
                  testId="quick-stat-conditions"
                />
                <QuickStatCard
                  icon={Pill}
                  label="Medications"
                  value={`${summary.medications.length}`}
                  sub="on file"
                  testId="quick-stat-medications"
                />
                <QuickStatCard
                  icon={TestTube}
                  label="Lab Results"
                  value={`${summary.recentLabs.length}`}
                  sub={labStatusCounts.critical > 0 ? `${labStatusCounts.critical} critical` : labStatusCounts.attention > 0 ? `${labStatusCounts.attention} flagged` : "all normal"}
                  alert={labStatusCounts.critical > 0 ? "critical" : labStatusCounts.attention > 0 ? "attention" : undefined}
                  testId="quick-stat-labs"
                />
                <QuickStatCard
                  icon={Calendar}
                  label="Appointments"
                  value={`${summary.upcomingAppointments.length}`}
                  sub={summary.upcomingAppointments.length > 0 ? `next in ${summary.upcomingAppointments[0].daysUntil}d` : "none scheduled"}
                  testId="quick-stat-appointments"
                />
              </div>
            </CardContent>
          </Card>

          {summary.allergies.length > 0 && (
            <Alert className="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" data-testid="alert-allergies">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm">
                <strong className="text-red-700 dark:text-red-300">Known Allergies:</strong>{" "}
                <span className="text-red-600 dark:text-red-400">{summary.allergies.join(", ")}</span>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Eye className="h-4 w-4 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="results" data-testid="tab-results">
                <BarChart3 className="h-4 w-4 mr-1" />
                Results
              </TabsTrigger>
              <TabsTrigger value="care" data-testid="tab-care">
                <Heart className="h-4 w-4 mr-1" />
                Care Plan
              </TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">
                <Lightbulb className="h-4 w-4 mr-1" />
                Tips
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-5">
              <Card data-testid="card-conditions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Your Conditions
                  </CardTitle>
                  <CardDescription>What your care team is managing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.conditions.map((c, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`condition-${i}`}>
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          c.status === "active" ? "bg-blue-500" : c.status === "resolving" ? "bg-green-500" : "bg-slate-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm">{c.name}</span>
                            <Badge className={`text-[10px] ${CONDITION_STATUS_BADGE[c.status]}`}>
                              {c.status === "active" ? "Active" : c.status === "resolving" ? "Improving" : "Monitoring"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{c.plainLanguage}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {summary.medications.length > 0 ? (
                <Card data-testid="card-medications">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-5 w-5 text-primary" />
                      Your Medications ({summary.medications.length})
                    </CardTitle>
                    <CardDescription>What you're taking and why</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.medications.map((m, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50" data-testid={`medication-${i}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="font-medium text-sm">{m.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{m.schedule}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 pl-5.5">{m.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card data-testid="card-medications-empty">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-5 w-5 text-primary" />
                      Your Medications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No current medications on file. Your care team may discuss treatment options at your next visit.</p>
                  </CardContent>
                </Card>
              )}

              <Card data-testid="card-appointments">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Appointments
                  </CardTitle>
                  <CardDescription>What's coming up next</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.upcomingAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming appointments scheduled. Contact your care team to schedule your next visit.</p>
                  ) : (
                    <div className="space-y-3">
                      {summary.upcomingAppointments.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`appointment-${i}`}>
                          <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg px-3 py-2 shrink-0">
                            <span className="text-xs font-medium text-primary">{formatShortDate(a.date).split(" ")[0]}</span>
                            <span className="text-lg font-bold text-primary">{formatShortDate(a.date).split(" ")[1]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{a.type}</span>
                              {a.daysUntil <= 7 && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Clock className="h-3 w-3 mr-0.5" />
                                  {a.daysUntil === 0 ? "Today" : a.daysUntil === 1 ? "Tomorrow" : `In ${a.daysUntil} days`}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{a.provider}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{a.purpose}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="mt-4 space-y-5">
              <Card data-testid="card-lab-overview">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Lab Results Overview
                  </CardTitle>
                  <CardDescription>Visual summary of your test results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" data-testid="lab-count-normal">
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                      <span className="text-lg font-bold text-green-700 dark:text-green-300">{labStatusCounts.normal}</span>
                      <p className="text-xs text-green-600 dark:text-green-400">Normal</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="lab-count-attention">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{labStatusCounts.attention}</span>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Needs Attention</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="lab-count-critical">
                      <ShieldAlert className="h-5 w-5 text-red-500 mx-auto mb-1" />
                      <span className="text-lg font-bold text-red-700 dark:text-red-300">{labStatusCounts.critical}</span>
                      <p className="text-xs text-red-600 dark:text-red-400">Critical</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-labs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-primary" />
                    Recent Test Results
                  </CardTitle>
                  <CardDescription>Your latest lab values with status indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {summary.recentLabs.map((l, i) => {
                      const statusCfg = LAB_STATUS_CONFIG[l.status];
                      const LabIcon = statusCfg.icon;
                      const trend = getStatusTrendIcon(l.status);
                      const TrendIcon = trend.icon;

                      return (
                        <div key={i} className="p-3 rounded-lg bg-muted/50" data-testid={`lab-${i}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <LabIcon className={`h-4 w-4 ${statusCfg.color}`} />
                            <span className="font-medium text-sm flex-1">{l.name}</span>
                            <div className="flex items-center gap-1">
                              <TrendIcon className={`h-3.5 w-3.5 ${trend.color}`} />
                              <span className="text-xs text-muted-foreground">{trend.label}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{formatShortDate(l.date)}</span>
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono font-medium min-w-[80px]">{l.value}</span>
                            <div className="flex-1">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${statusCfg.barColor}`}
                                  style={{ width: `${getStatusBarWidth(l.status)}%` }}
                                />
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{l.plainExplanation}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {summary.vitals.length > 0 && (
                <Card data-testid="card-vitals">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ThermometerSun className="h-5 w-5 text-primary" />
                      Recent Vitals
                    </CardTitle>
                    <CardDescription>Your latest measurements with indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {summary.vitals.map((v, i) => {
                        const statusCfg = LAB_STATUS_CONFIG[v.status];
                        const VIcon = statusCfg.icon;
                        const trend = getStatusTrendIcon(v.status);
                        const TrendIcon = trend.icon;

                        return (
                          <div key={i} className="p-3 rounded-lg bg-muted/50" data-testid={`vital-${i}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <VIcon className={`h-4 w-4 ${statusCfg.color}`} />
                              <span className="font-medium text-sm flex-1">{v.type}</span>
                              <div className="flex items-center gap-1">
                                <TrendIcon className={`h-3.5 w-3.5 ${trend.color}`} />
                                <span className="text-xs text-muted-foreground">{trend.label}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(v.date)}</span>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-sm font-mono font-medium min-w-[100px]">{v.value}</span>
                              <div className="flex-1">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${statusCfg.barColor}`}
                                    style={{ width: `${getStatusBarWidth(v.status)}%` }}
                                  />
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{v.plainExplanation}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="care" className="mt-4 space-y-5">
              <Card data-testid="card-care-conditions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Active Conditions & Treatment
                  </CardTitle>
                  <CardDescription>Your conditions and how they're being managed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {summary.conditions.filter(c => c.status === "active").map((c, i) => {
                      const relatedMeds = summary.medications.filter(m =>
                        m.purpose.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]) ||
                        c.plainLanguage.toLowerCase().includes(m.name.toLowerCase().split(" ")[0])
                      );
                      return (
                        <div key={i} className="p-4 rounded-lg border bg-card" data-testid={`care-condition-${i}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-medium text-sm">{c.name}</span>
                            <Badge className={`text-[10px] ${CONDITION_STATUS_BADGE[c.status]}`}>Active</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{c.plainLanguage}</p>
                          {relatedMeds.length > 0 && (
                            <div className="pl-4 border-l-2 border-primary/20">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Related Medications:</p>
                              {relatedMeds.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Pill className="h-3 w-3 text-primary" />
                                  <span>{m.name} — {m.schedule}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {summary.conditions.filter(c => c.status !== "active").length > 0 && (
                      <>
                        <Separator />
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitoring / Improving</p>
                        {summary.conditions.filter(c => c.status !== "active").map((c, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30" data-testid={`care-condition-other-${i}`}>
                            <div className={`mt-1.5 w-2 h-2 rounded-full ${c.status === "resolving" ? "bg-green-500" : "bg-slate-400"}`} />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium">{c.name}</span>
                                <Badge className={`text-[10px] ${CONDITION_STATUS_BADGE[c.status]}`}>
                                  {c.status === "resolving" ? "Improving" : "Monitoring"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{c.plainLanguage}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-full-med-list">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="h-5 w-5 text-primary" />
                    Complete Medication List
                  </CardTitle>
                  <CardDescription>All {summary.medications.length} medications with schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.medications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No medications on file.</p>
                  ) : (
                    <div className="divide-y">
                      {summary.medications.map((m, i) => (
                        <div key={i} className="py-3 first:pt-0 last:pb-0" data-testid={`full-med-${i}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium text-sm">{m.name}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{m.purpose}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{m.schedule}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="mt-4 space-y-5">
              <Card data-testid="card-ai-insights">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Wellness Tips & Insights
                  </CardTitle>
                  <CardDescription>Personalized suggestions based on your health profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.aiInsights.map((insight, i) => {
                      const InsightIcon = INSIGHT_ICON[insight.category] || Info;
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-lg border-l-4 ${INSIGHT_PRIORITY_COLOR[insight.priority]}`}
                          data-testid={`insight-${i}`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <InsightIcon className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-sm">{insight.title}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              {insight.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed pl-6">{insight.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" data-testid="alert-insights-disclaimer">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                  These tips are generated by AI based on your health profile for informational purposes only. They are NOT medical advice. Always discuss any health changes with your healthcare provider before making decisions.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <div className="print:block hidden space-y-5">
            <Separator />
            <p className="text-xs font-medium">Conditions: {summary.conditions.map(c => `${c.name} (${c.status})`).join(", ")}</p>
            <p className="text-xs font-medium">Medications: {summary.medications.map(m => `${m.name} - ${m.schedule}`).join(", ")}</p>
            <p className="text-xs font-medium">Labs: {summary.recentLabs.map(l => `${l.name}: ${l.value} (${l.status})`).join(", ")}</p>
          </div>

          <Separator />

          <div className="text-center space-y-2 pb-4" data-testid="section-disclaimer">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span className="text-xs font-medium">Important Notice</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {summary.disclaimer}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Generated {formatDate(summary.generatedAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStatCard({
  icon: Icon,
  label,
  value,
  sub,
  alert,
  testId,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  alert?: "attention" | "critical";
  testId: string;
}) {
  return (
    <div
      className={`p-3 rounded-lg border text-center ${
        alert === "critical" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" :
        alert === "attention" ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" :
        "bg-muted/30"
      }`}
      data-testid={testId}
    >
      <Icon className={`h-4 w-4 mx-auto mb-1 ${
        alert === "critical" ? "text-red-500" : alert === "attention" ? "text-amber-500" : "text-primary"
      }`} />
      <span className="text-lg font-bold block">{value}</span>
      <span className="text-[10px] text-muted-foreground block">{label}</span>
      <span className={`text-[10px] block ${
        alert === "critical" ? "text-red-600 dark:text-red-400 font-medium" :
        alert === "attention" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      }`}>{sub}</span>
    </div>
  );
}

function buildPlainTextSummary(summary: PatientFriendlySummary): string {
  const lines: string[] = [];
  lines.push("=== MY HEALTH SNAPSHOT ===");
  lines.push(`Patient: ${summary.firstName}`);
  lines.push(`Status: ${summary.overallStatus === "good" ? "Looking Good" : summary.overallStatus === "needs-attention" ? "Needs Attention" : "Urgent Items"}`);
  lines.push(`Generated: ${formatDate(summary.generatedAt)}`);
  lines.push("");
  lines.push(summary.overallMessage);
  lines.push("");

  if (summary.allergies.length > 0) {
    lines.push("--- ALLERGIES ---");
    lines.push(summary.allergies.join(", "));
    lines.push("");
  }

  lines.push("--- CONDITIONS ---");
  summary.conditions.forEach(c => {
    lines.push(`- ${c.name} (${c.status}): ${c.plainLanguage}`);
  });
  lines.push("");

  if (summary.medications.length > 0) {
    lines.push("--- MEDICATIONS ---");
    summary.medications.forEach(m => {
      lines.push(`- ${m.name} (${m.schedule}): ${m.purpose}`);
    });
    lines.push("");
  }

  lines.push("--- RECENT LAB RESULTS ---");
  summary.recentLabs.forEach(l => {
    lines.push(`- ${l.name}: ${l.value} [${l.status.toUpperCase()}] (${formatShortDate(l.date)})`);
    lines.push(`  ${l.plainExplanation}`);
  });
  lines.push("");

  if (summary.vitals.length > 0) {
    lines.push("--- VITALS ---");
    summary.vitals.forEach(v => {
      lines.push(`- ${v.type}: ${v.value} [${v.status.toUpperCase()}] (${formatShortDate(v.date)})`);
    });
    lines.push("");
  }

  if (summary.upcomingAppointments.length > 0) {
    lines.push("--- UPCOMING APPOINTMENTS ---");
    summary.upcomingAppointments.forEach(a => {
      lines.push(`- ${formatDate(a.date)}: ${a.type} with ${a.provider}`);
      lines.push(`  ${a.purpose}`);
    });
    lines.push("");
  }

  if (summary.aiInsights.length > 0) {
    lines.push("--- WELLNESS TIPS ---");
    summary.aiInsights.forEach(ins => {
      lines.push(`- ${ins.title}: ${ins.description}`);
    });
    lines.push("");
  }

  lines.push("--- DISCLAIMER ---");
  lines.push(summary.disclaimer);

  return lines.join("\n");
}
