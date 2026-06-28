import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Brain, CheckCircle2,
  Eye, FileSearch, Flag, Info, Minus, ShieldCheck,
  Sparkles, TrendingUp, Zap,
} from "lucide-react";

interface SourceGrounding {
  sentence: string;
  sourceDocument: string;
  sourceField: string;
  highlightStart: number;
  highlightEnd: number;
}

interface ExplainabilityFactor {
  factor: string;
  weight: number;
  direction: "positive" | "negative" | "neutral";
}

interface AuditEntry {
  id: string;
  timestamp: string;
  patientId: string;
  patientName: string;
  aiSummary: string;
  modelVersion: string;
  status: string;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  sourceGrounding: SourceGrounding[];
  explainabilityFactors: ExplainabilityFactor[];
  clinicianVerification: "verified" | "flagged" | "pending";
  clinicianFeedback: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rlhfFeedbackSubmitted: string | null;
  requestPayload: Record<string, unknown>;
}

interface AuditDashboard {
  overview: {
    totalAudits: number;
    verifiedCount: number;
    flaggedCount: number;
    pendingCount: number;
    averageConfidence: number;
    lowConfidenceCount: number;
    rlhfFeedbackCount: number;
  };
  entries: AuditEntry[];
  modelBreakdown: Array<{ model: string; count: number; avgConfidence: number }>;
  confidenceDistribution: Array<{ range: string; count: number }>;
}

function ConfidenceGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 6;
  const offset = circumference - (circumference * score) / 100;
  const colorClasses = score >= 90
    ? "text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
    : score >= 75
    ? "text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
    : "text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400";

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border w-fit ${colorClasses}`}
      role="img" aria-label={`${score}% confidence`} data-testid={`confidence-gauge-${score}`}>
      <svg className="w-4 h-4 transform -rotate-90" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="transparent" className="opacity-20" />
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="opacity-100 transition-all duration-700 ease-out" />
      </svg>
      <span className="text-xs font-bold tracking-tight">{score.toFixed(1)}% Confidence</span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" data-testid="badge-verified">
      <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" /> Verified
    </Badge>
  );
  if (status === "flagged") return (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" data-testid="badge-flagged">
      <Flag className="h-3 w-3 mr-1" aria-hidden="true" /> Flagged
    </Badge>
  );
  return (
    <Badge variant="secondary" data-testid="badge-pending">
      <AlertCircle className="h-3 w-3 mr-1" aria-hidden="true" /> Pending Review
    </Badge>
  );
}

function ExplainabilityTooltip({ factors, children }: { factors: ExplainabilityFactor[]; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const insights = factors.slice(0, 3).map((f) => {
    const arrow = f.direction === "positive" ? "↑" : f.direction === "negative" ? "↓" : "→";
    return `${arrow} ${f.factor} (${Math.round(f.weight * 100)}% weight)`;
  });

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      data-testid="explainability-tooltip-wrapper"
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full mb-3 left-0 w-72 p-4 bg-slate-900 text-white rounded-xl shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in duration-150" data-testid="tooltip-explainability">
          <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
            <Brain className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
              Vertex AI Reasoning
            </span>
          </div>
          <ul className="space-y-2">
            {insights.map((note, index) => (
              <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                <span className="text-emerald-500">•</span>
                {note}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-700 pt-2">
            SHAP values — feature importance in prediction
          </p>
          <div className="absolute top-full left-6 -mt-1 border-[6px] border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

function SourceGroundingPanel({ sources, aiSummary }: { sources: SourceGrounding[]; aiSummary: string }) {
  const [activeSource, setActiveSource] = useState<number | null>(null);

  return (
    <div className="space-y-3" data-testid="source-grounding-panel">
      <div className="p-4 rounded-lg bg-muted/50 dark:bg-muted/20 border border-border dark:border-border">
        <p className="text-sm leading-relaxed text-foreground">
          {sources.map((src, i) => {
            const isActive = activeSource === i;
            return (
              <span key={i}>
                <span
                  className={`transition-all duration-300 ${isActive ? "bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5 font-medium" : ""}`}
                  data-testid={`grounded-text-${i}`}
                >
                  {src.sentence}
                </span>
                {i < sources.length - 1 ? ". " : "."}
              </span>
            );
          })}
          {aiSummary.length > sources.reduce((s, src) => s + src.sentence.length, 0) + sources.length * 2 && (
            <span className="text-muted-foreground italic"> [Additional AI inference not directly grounded]</span>
          )}
        </p>
      </div>
      <div className="space-y-2">
        {sources.map((src, i) => (
          <button
            key={i}
            className={`w-full text-left border rounded-lg p-3 transition-all hover:shadow-sm cursor-pointer ${
              activeSource === i
                ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                : "border-border dark:border-border bg-card dark:bg-card"
            }`}
            onClick={() => setActiveSource(activeSource === i ? null : i)}
            data-testid={`source-button-${i}`}
            aria-label={`Source: ${src.sourceDocument}`}
          >
            <div className="flex items-start gap-2">
              <FileSearch className={`h-4 w-4 mt-0.5 shrink-0 ${activeSource === i ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{src.sourceDocument}</p>
                <p className="text-xs text-muted-foreground mt-0.5">FHIR Path: <code className="text-xs bg-muted dark:bg-muted rounded px-1">{src.sourceField}</code></p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{src.sentence}"</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300" data-testid="ai-audit-loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2 bg-card">
            <Skeleton className="h-3 w-20 rounded-sm" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-6 w-20" /></div>
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-16" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClinicalAiAudit() {
  const { toast } = useToast();
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [verifyAction, setVerifyAction] = useState<"verified" | "flagged">("verified");
  const [feedbackText, setFeedbackText] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const dashQ = useQuery<AuditDashboard>({ queryKey: ["/api/clinical-ai-audit/dashboard"] });
  const d = dashQ.data;

  const verifyMutation = useMutation({
    mutationFn: (data: { entryId: string; verification: string; feedback: string; clinicianName: string }) =>
      apiRequest("POST", `/api/clinical-ai-audit/entries/${data.entryId}/verify`, {
        verification: data.verification,
        feedback: data.feedback,
        clinicianName: data.clinicianName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-ai-audit/dashboard"] });
      setShowVerifyDialog(false);
      setFeedbackText("");
      toast({ title: verifyAction === "verified" ? "AI output verified" : "AI output flagged — RLHF feedback queued" });
    },
  });

  const openVerifyDialog = (entry: AuditEntry, action: "verified" | "flagged") => {
    setSelectedEntry(entry);
    setVerifyAction(action);
    setFeedbackText("");
    setShowVerifyDialog(true);
  };

  if (dashQ.isLoading) return <DashboardSkeleton />;

  const overview = d?.overview;
  const entries = d?.entries || [];
  const confDist = d?.confidenceDistribution || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500" data-testid="clinical-ai-audit-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Clinical AI Audit
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Vertex AI safety verification — confidence scoring, source grounding, explainability & human-in-the-loop
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1.5 self-start md:self-center border-primary/50" data-testid="badge-model-version">
          <Sparkles className="h-3 w-3 mr-1.5 text-primary" aria-hidden="true" />
          gemini-2.5-flash
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" role="list" aria-label="Audit overview metrics">
        <Card className="border-border dark:border-border" data-testid="metric-total">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Audits</p>
            <p className="text-2xl font-bold text-foreground mt-1">{overview?.totalAudits || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-border" data-testid="metric-verified">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verified</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{overview?.verifiedCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-border" data-testid="metric-flagged">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Flagged</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{overview?.flaggedCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-border" data-testid="metric-pending">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{overview?.pendingCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-border" data-testid="metric-avg-confidence">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Confidence</p>
            <p className="text-2xl font-bold text-foreground mt-1">{overview?.averageConfidence || 0}%</p>
          </CardContent>
        </Card>
        <Card className={`border-border dark:border-border ${(overview?.lowConfidenceCount || 0) > 0 ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : ""}`} data-testid="metric-low-confidence">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Low Confidence</p>
            <p className={`text-2xl font-bold mt-1 ${(overview?.lowConfidenceCount || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{overview?.lowConfidenceCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border dark:border-border" data-testid="metric-rlhf">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">RLHF Feedback</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{overview?.rlhfFeedbackCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border dark:border-border" data-testid="card-confidence-distribution">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {confDist.map((d) => (
              <div key={d.range} className="flex-1 text-center">
                <div className={`h-12 rounded-md flex items-center justify-center text-sm font-bold ${
                  d.range === "90-100%" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                  d.range === "80-89%" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                  d.range === "70-79%" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`} data-testid={`conf-dist-${d.range}`}>
                  {d.count}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{d.range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="audit-log" className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-sm" role="tablist" aria-label="Audit sections">
          <TabsTrigger value="audit-log" data-testid="tab-audit-log" className="min-h-[44px] text-sm">Audit Log</TabsTrigger>
          <TabsTrigger value="detail-view" data-testid="tab-detail-view" className="min-h-[44px] text-sm">Detail View</TabsTrigger>
        </TabsList>

        <TabsContent value="audit-log" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="border border-border dark:border-border rounded-lg overflow-hidden bg-card dark:bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 dark:bg-muted/20">
                    <TableHead className="text-xs font-semibold">Time</TableHead>
                    <TableHead className="text-xs font-semibold">Patient</TableHead>
                    <TableHead className="text-xs font-semibold">Confidence & Why</TableHead>
                    <TableHead className="text-xs font-semibold">Summary</TableHead>
                    <TableHead className="text-xs font-semibold">Sources</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isLowConf = entry.confidenceScore < 80;
                    return (
                      <TableRow
                        key={entry.id}
                        className={`transition-colors ${
                          isLowConf ? "bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/60 dark:hover:bg-amber-950/20" : "hover:bg-muted/50 dark:hover:bg-muted/20"
                        }`}
                        data-testid={`audit-row-${entry.id}`}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          <br />
                          <span className="text-[10px]">{new Date(entry.timestamp).toLocaleDateString()}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium text-foreground">{entry.patientName}</span>
                            <br />
                            <span className="text-[10px] text-muted-foreground font-mono">{entry.patientId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ExplainabilityTooltip factors={entry.explainabilityFactors}>
                            <ConfidenceGauge score={entry.confidenceScore} />
                          </ExplainabilityTooltip>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{entry.aiSummary}</p>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-primary"
                            onClick={() => setExpandedSource(expandedSource === entry.id ? null : entry.id)}
                            data-testid={`button-sources-${entry.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
                            <span className="text-xs">{entry.sourceGrounding.length}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <VerificationBadge status={entry.clinicianVerification} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {entry.clinicianVerification === "pending" && (
                              <>
                                <Button variant="outline" size="sm" className="h-8 text-xs min-h-[36px] text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30"
                                  onClick={() => openVerifyDialog(entry, "verified")} data-testid={`button-verify-${entry.id}`}>
                                  <ShieldCheck className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Verify
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs min-h-[36px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => openVerifyDialog(entry, "flagged")} data-testid={`button-flag-${entry.id}`}>
                                  <Flag className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Flag
                                </Button>
                              </>
                            )}
                            {entry.clinicianVerification !== "pending" && (
                              <span className="text-[10px] text-muted-foreground">{entry.verifiedBy?.split(",")[0]}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {expandedSource && (
              <div className="border-t border-border dark:border-border p-4 bg-muted/30 dark:bg-muted/10 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="expanded-source-panel">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
                    Source Grounding — Deep Links to EHR Records
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedSource(null)} className="h-8 text-xs">Close</Button>
                </div>
                {(() => {
                  const entry = entries.find(e => e.id === expandedSource);
                  if (!entry) return null;
                  return <SourceGroundingPanel sources={entry.sourceGrounding} aiSummary={entry.aiSummary} />;
                })()}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="detail-view" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Accordion type="multiple" defaultValue={entries.filter(e => e.clinicianVerification === "pending" || e.confidenceScore < 80).map(e => e.id)} className="space-y-3">
            {entries.map((entry) => {
              const isLowConf = entry.confidenceScore < 80;
              return (
                <AccordionItem key={entry.id} value={entry.id} className={`border rounded-lg overflow-hidden ${
                  isLowConf ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" : "border-border dark:border-border bg-card dark:bg-card"
                }`} data-testid={`detail-entry-${entry.id}`}>
                  <AccordionTrigger className="px-5 py-4 hover:no-underline">
                    <div className="flex items-center gap-3 text-left flex-1 mr-4">
                      <ExplainabilityTooltip factors={entry.explainabilityFactors}>
                        <ConfidenceGauge score={entry.confidenceScore} />
                      </ExplainabilityTooltip>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{entry.patientName}</span>
                          <span className="text-xs text-muted-foreground font-mono">{entry.patientId}</span>
                          <VerificationBadge status={entry.clinicianVerification} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.aiSummary.slice(0, 100)}...</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</h5>
                        <p className="text-sm text-foreground leading-relaxed bg-muted/30 dark:bg-muted/10 rounded-lg p-3 border border-border dark:border-border">{entry.aiSummary}</p>
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                          <FileSearch className="h-3.5 w-3.5" aria-hidden="true" /> Source Grounding
                        </h5>
                        <SourceGroundingPanel sources={entry.sourceGrounding} aiSummary={entry.aiSummary} />
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5" aria-hidden="true" /> Explainability Factors (SHAP/LIME)
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {entry.explainabilityFactors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between border border-border dark:border-border rounded-lg p-3 bg-background dark:bg-background" data-testid={`factor-${entry.id}-${i}`}>
                              <div className="flex items-center gap-2">
                                {f.direction === "positive" ? <TrendingUp className="h-4 w-4 text-green-500" aria-hidden="true" /> :
                                 f.direction === "negative" ? <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" /> :
                                 <Minus className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                                <span className="text-sm text-foreground">{f.factor}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={f.weight * 100} className="h-2 w-24" aria-label={`${f.factor}: ${Math.round(f.weight * 100)}% weight`} />
                                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{Math.round(f.weight * 100)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {entry.clinicianFeedback && (
                        <div>
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Clinician Feedback</h5>
                          <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-sm text-foreground">{entry.clinicianFeedback}</p>
                            <p className="text-xs text-muted-foreground mt-2">— {entry.verifiedBy}</p>
                          </div>
                        </div>
                      )}

                      {entry.rlhfFeedbackSubmitted && (
                        <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400" data-testid={`rlhf-badge-${entry.id}`}>
                          <Zap className="h-3 w-3 mr-1" aria-hidden="true" /> RLHF feedback submitted {new Date(entry.rlhfFeedbackSubmitted).toLocaleString()}
                        </Badge>
                      )}

                      {entry.clinicianVerification === "pending" && (
                        <div className="flex gap-2 pt-2 border-t border-border dark:border-border">
                          <Button size="sm" variant="outline"
                            className="min-h-[44px] text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => openVerifyDialog(entry, "verified")} data-testid={`button-verify-detail-${entry.id}`}>
                            <ShieldCheck className="h-4 w-4 mr-1.5" aria-hidden="true" /> Verify AI Output
                          </Button>
                          <Button size="sm" variant="outline"
                            className="min-h-[44px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => openVerifyDialog(entry, "flagged")} data-testid={`button-flag-detail-${entry.id}`}>
                            <Flag className="h-4 w-4 mr-1.5" aria-hidden="true" /> Flag for RLHF
                          </Button>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground pt-1">
                        Model: {entry.modelVersion} | Analysis: {String(entry.requestPayload.analysisType || "—")} | Window: {String(entry.requestPayload.dataWindow || "—")}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>
      </Tabs>

      <Alert className="bg-muted/50 dark:bg-muted/20 border-border dark:border-border">
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          <strong>NO-CDS Disclaimer:</strong> All AI-generated summaries are informational only and do not constitute clinical decision support (CDS). Confidence scores reflect model self-assessment, not clinical accuracy. Always verify AI outputs with clinical judgment. Flagged entries are queued for RLHF (Reinforcement Learning from Human Feedback) to improve future model performance.
        </AlertDescription>
      </Alert>

      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {verifyAction === "verified" ? (
                <><ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" /> Verify AI Output</>
              ) : (
                <><Flag className="h-5 w-5 text-red-600 dark:text-red-400" /> Flag AI Output for RLHF</>
              )}
            </DialogTitle>
            <DialogDescription>
              {verifyAction === "verified"
                ? "Confirm this AI-generated summary is clinically accurate."
                : "Flag this output as inaccurate or requiring review. Your feedback will be used to improve the model via RLHF."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEntry && (
              <div className="bg-muted/50 dark:bg-muted/20 rounded-lg p-3 border border-border dark:border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm text-foreground">{selectedEntry.patientName}</span>
                  <ConfidenceGauge score={selectedEntry.confidenceScore} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{selectedEntry.aiSummary}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground">Your Name & Title</Label>
              <Input value={clinicianName} onChange={(e) => setClinicianName(e.target.value)}
                placeholder="e.g. Dr. Sarah Chen, MD — Endocrinology" data-testid="input-clinician-name" className="min-h-[44px]" />
            </div>
            {verifyAction === "flagged" && (
              <div className="space-y-2">
                <Label className="text-foreground">Feedback (Required for RLHF)</Label>
                <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe what's inaccurate and what the correct interpretation should be..."
                  data-testid="input-feedback" className="min-h-[100px]" />
                <p className="text-[10px] text-muted-foreground">This feedback helps us improve the AI model's accuracy.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)} className="min-h-[44px]">Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedEntry || !clinicianName) return;
                verifyMutation.mutate({
                  entryId: selectedEntry.id,
                  verification: verifyAction,
                  feedback: feedbackText,
                  clinicianName,
                });
              }}
              disabled={!clinicianName || (verifyAction === "flagged" && !feedbackText) || verifyMutation.isPending}
              className={`min-h-[44px] ${verifyAction === "flagged" ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600" : ""}`}
              data-testid="button-submit-verification"
            >
              {verifyMutation.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Processing...</> :
               verifyAction === "verified" ? "Confirm Verification" : "Submit Flag & Queue RLHF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
