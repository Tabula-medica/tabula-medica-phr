import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ScrollText,
  Image,
  Brain,
  Vote,
  Stethoscope,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Shield,
  TrendingUp,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "auto-approved":
      return <Badge data-testid={`badge-status-${status}`} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Auto-Approved</Badge>;
    case "pending-review":
      return <Badge data-testid={`badge-status-${status}`} className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Pending Review</Badge>;
    case "reviewed":
      return <Badge data-testid={`badge-status-${status}`} className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Reviewed</Badge>;
    case "rejected":
      return <Badge data-testid={`badge-status-${status}`} className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Rejected</Badge>;
    default:
      return <Badge data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function QualityBadge({ gate }: { gate: string }) {
  switch (gate) {
    case "passed":
      return <Badge data-testid={`badge-quality-${gate}`} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Passed</Badge>;
    case "flagged":
      return <Badge data-testid={`badge-quality-${gate}`} className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="w-3 h-3 mr-1" />Flagged</Badge>;
    case "rejected":
      return <Badge data-testid={`badge-quality-${gate}`} className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge data-testid={`badge-quality-${gate}`}>{gate}</Badge>;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge data-testid={`badge-severity-${severity}`} className="bg-red-600 text-white">Critical</Badge>;
    case "high":
      return <Badge data-testid={`badge-severity-${severity}`} className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">High</Badge>;
    case "medium":
      return <Badge data-testid={`badge-severity-${severity}`} className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Medium</Badge>;
    case "low":
      return <Badge data-testid={`badge-severity-${severity}`} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Low</Badge>;
    default:
      return <Badge>{severity}</Badge>;
  }
}

function ConfidenceBar({ value, threshold = 95 }: { value: number; threshold?: number }) {
  const color = value >= threshold ? "bg-green-500" : value >= 85 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" data-testid={`confidence-bar-${Math.round(value)}`}>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-mono font-medium ${value >= threshold ? "text-green-600 dark:text-green-400" : value >= 85 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

export default function ExtractionPipeline() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [queueFilter, setQueueFilter] = useState("all");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [showSideBySide, setShowSideBySide] = useState(false);

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<any>({
    queryKey: ["/api/extraction-pipeline/dashboard"],
  });

  const { data: queueData, isLoading: loadingQueue } = useQuery<any>({
    queryKey: ["/api/extraction-pipeline/queue", queueFilter],
    queryFn: () => fetch(`/api/extraction-pipeline/queue?status=${queueFilter}`).then(r => r.json()),
  });

  const { data: conflictsData, isLoading: loadingConflicts } = useQuery<any>({
    queryKey: ["/api/extraction-pipeline/conflicts"],
  });

  const { data: rangesData } = useQuery<any>({
    queryKey: ["/api/extraction-pipeline/clinical-ranges"],
  });

  const { data: auditsData, isLoading: loadingAudits } = useQuery<any>({
    queryKey: ["/api/extraction-pipeline/golden-audits"],
  });

  if (loadingDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = dashboard?.summary;
  const stages = dashboard?.pipelineStages || [];

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="extraction-pipeline-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="page-title">
            <ScrollText className="w-6 h-6 text-primary" />
            Document Extraction Pipeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enterprise-grade medical document processing with multi-model consensus and clinical validation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="side-by-side" checked={showSideBySide} onCheckedChange={setShowSideBySide} data-testid="toggle-side-by-side" />
            <Label htmlFor="side-by-side" className="text-sm">Side-by-Side View</Label>
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card data-testid="kpi-total-docs">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <FileText className="w-4 h-4" />
                Total Documents
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalDocuments}</div>
              <div className="text-xs text-gray-500 mt-1">Processing queue</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-confidence">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Brain className="w-4 h-4" />
                Avg Confidence
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.averageConfidence}%</div>
              <div className="text-xs text-gray-500 mt-1">Multi-model consensus</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-pending">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                Pending Review
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.pendingReview}</div>
              <div className="text-xs text-gray-500 mt-1">Needs human verification</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-conflicts">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Unresolved Conflicts
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.unresolvedConflicts}</div>
              <div className="text-xs text-gray-500 mt-1">Of {summary.totalConflicts} total</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-clinical-pass">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Stethoscope className="w-4 h-4" />
                Clinical Pass Rate
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.clinicalCheckPassRate}%</div>
              <div className="text-xs text-gray-500 mt-1">Sanity checks passed</div>
            </CardContent>
          </Card>
        </div>
      )}

      {stages.length > 0 && (
        <Card data-testid="pipeline-flow">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pipeline Flow</CardTitle>
            <CardDescription>Document processing stages from ingestion to approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {stages.map((stage: any, i: number) => (
                <div key={stage.name} className="flex items-center gap-2">
                  <div className="min-w-[180px] p-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      {stage.icon === "image" && <Image className="w-4 h-4 text-purple-500" />}
                      {stage.icon === "brain" && <Brain className="w-4 h-4 text-blue-500" />}
                      {stage.icon === "vote" && <Vote className="w-4 h-4 text-indigo-500" />}
                      {stage.icon === "stethoscope" && <Stethoscope className="w-4 h-4 text-green-500" />}
                      {stage.icon === "user-check" && <UserCheck className="w-4 h-4 text-amber-500" />}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{stage.name}</span>
                    </div>
                    {stage.passed !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-green-600">Passed</span><span className="font-medium">{stage.passed}</span></div>
                        <div className="flex justify-between"><span className="text-amber-600">Flagged</span><span className="font-medium">{stage.flagged}</span></div>
                        <div className="flex justify-between"><span className="text-red-600">Rejected</span><span className="font-medium">{stage.rejected}</span></div>
                      </div>
                    )}
                    {stage.avgConfidence !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>Avg Confidence</span><span className="font-medium text-green-600">{stage.avgConfidence}%</span></div>
                        <div className="flex justify-between"><span>Avg Time</span><span className="font-medium">{stage.avgTime}ms</span></div>
                      </div>
                    )}
                    {stage.agreed !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-green-600">Agreed</span><span className="font-medium">{stage.agreed}</span></div>
                        <div className="flex justify-between"><span className="text-red-600">Conflicted</span><span className="font-medium">{stage.conflicted}</span></div>
                      </div>
                    )}
                    {stage.outOfBounds !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>Range Checks</span><span className="font-medium">{stage.total}</span></div>
                        <div className="flex justify-between"><span className="text-red-600">Out of Bounds</span><span className="font-medium">{stage.outOfBounds}</span></div>
                        <div className="flex justify-between"><span className="text-amber-600">Temporal Issues</span><span className="font-medium">{stage.temporalViolations}</span></div>
                      </div>
                    )}
                    {stage.autoApproved !== undefined && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-green-600">Auto-Approved</span><span className="font-medium">{stage.autoApproved}</span></div>
                        <div className="flex justify-between"><span className="text-amber-600">Pending</span><span className="font-medium">{stage.pendingReview}</span></div>
                        <div className="flex justify-between"><span className="text-blue-600">Reviewed</span><span className="font-medium">{stage.reviewed}</span></div>
                      </div>
                    )}
                  </div>
                  {i < stages.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-[700px]" data-testid="pipeline-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Eye className="w-4 h-4 mr-1" />Queue
          </TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            <AlertTriangle className="w-4 h-4 mr-1" />Conflicts
          </TabsTrigger>
          <TabsTrigger value="clinical" data-testid="tab-clinical">
            <Stethoscope className="w-4 h-4 mr-1" />Clinical
          </TabsTrigger>
          <TabsTrigger value="hitl" data-testid="tab-hitl">
            <UserCheck className="w-4 h-4 mr-1" />HITL
          </TabsTrigger>
          <TabsTrigger value="golden" data-testid="tab-golden">
            <Shield className="w-4 h-4 mr-1" />Benchmarks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Filter:</Label>
              {["all", "pending-review", "auto-approved", "reviewed"].map(f => (
                <Button key={f} variant={queueFilter === f ? "default" : "outline"} size="sm" onClick={() => setQueueFilter(f)} data-testid={`filter-${f}`}>
                  {f === "all" ? "All" : f === "pending-review" ? "Pending" : f === "auto-approved" ? "Approved" : "Reviewed"}
                </Button>
              ))}
            </div>

            {loadingQueue ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {queueData?.items?.map((doc: any) => (
                  <Card key={doc.id} className="overflow-hidden" data-testid={`doc-card-${doc.id}`}>
                    <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} data-testid={`doc-toggle-${doc.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedDoc === doc.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {doc.filename}
                              <StatusBadge status={doc.hitlStatus} />
                              <QualityBadge gate={doc.preProcessing.qualityGate} />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {doc.documentType} · {doc.pageCount} pages · {doc.fileSize} · {doc.dpiDetected} DPI
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Confidence</div>
                            <div className="w-32">
                              <ConfidenceBar value={doc.extraction.overallConfidence} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Consensus</div>
                            <div className="text-sm font-medium">{doc.extraction.consensus.consensusRate}%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {expandedDoc === doc.id && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/30" data-testid={`doc-detail-${doc.id}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Image className="w-4 h-4 text-purple-500" /> Pre-Processing</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span className="text-gray-500">Quality Score</span><span className="font-medium">{doc.preProcessing.qualityScore}/100</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">DPI Check</span><span className={doc.preProcessing.dpiCheck === "passed" ? "text-green-600" : "text-amber-600"}>{doc.preProcessing.dpiCheck}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Deskew</span><span>{doc.preProcessing.deskewApplied ? "Applied" : "Not needed"}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Denoise</span><span>{doc.preProcessing.denoiseApplied ? "Applied" : "Not needed"}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Contrast</span><span>{doc.preProcessing.contrastEnhanced ? "Enhanced" : "OK"}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Artifacts Removed</span><span>{doc.preProcessing.artifactsRemoved}</span></div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Brain className="w-4 h-4 text-blue-500" /> Multi-Model Extraction</h4>
                            <div className="space-y-2">
                              <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div className="text-xs font-medium text-gray-500 mb-1">Model A: {doc.extraction.modelA.name}</div>
                                <ConfidenceBar value={doc.extraction.modelA.confidence} />
                                <div className="text-xs text-gray-500 mt-1">{doc.extraction.modelA.extractedFields} fields · {doc.extraction.modelA.timeMs}ms</div>
                              </div>
                              <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div className="text-xs font-medium text-gray-500 mb-1">Model B: {doc.extraction.modelB.name}</div>
                                <ConfidenceBar value={doc.extraction.modelB.confidence} />
                                <div className="text-xs text-gray-500 mt-1">{doc.extraction.modelB.extractedFields} fields · {doc.extraction.modelB.timeMs}ms</div>
                              </div>
                              <div className="text-xs text-center">
                                <span className="text-green-600 font-medium">{doc.extraction.consensus.agreedFields} agreed</span>
                                {doc.extraction.consensus.conflictedFields > 0 && (
                                  <span className="text-red-600 font-medium"> · {doc.extraction.consensus.conflictedFields} conflicts</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Stethoscope className="w-4 h-4 text-green-500" /> Clinical Checks</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span className="text-gray-500">Range Validations</span><span className="font-medium">{doc.clinicalChecks.rangeValidations}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Out of Bounds</span><span className={doc.clinicalChecks.outOfBounds > 0 ? "text-red-600 font-medium" : "text-green-600"}>{doc.clinicalChecks.outOfBounds}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Unit Normalizations</span><span className="font-medium">{doc.clinicalChecks.unitNormalizations}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Temporal Checks</span><span className="font-medium">{doc.clinicalChecks.temporalChecks}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Temporal Violations</span><span className={doc.clinicalChecks.temporalViolations > 0 ? "text-red-600 font-medium" : "text-green-600"}>{doc.clinicalChecks.temporalViolations}</span></div>
                              <div className="flex justify-between pt-1 border-t"><span className="text-gray-500">Overall</span><span className={doc.clinicalChecks.passedAll ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{doc.clinicalChecks.passedAll ? "PASSED" : "FAILED"}</span></div>
                            </div>
                          </div>
                        </div>
                        {doc.reviewerNotes && (
                          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            {doc.reviewerNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4">
          {loadingConflicts ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card data-testid="conflict-total">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{conflictsData?.total}</div>
                    <div className="text-xs text-gray-500">Total Conflicts</div>
                  </CardContent>
                </Card>
                <Card data-testid="conflict-unresolved">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{conflictsData?.unresolved}</div>
                    <div className="text-xs text-gray-500">Unresolved</div>
                  </CardContent>
                </Card>
                <Card data-testid="conflict-critical">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{conflictsData?.bySeverity?.critical}</div>
                    <div className="text-xs text-gray-500">Critical</div>
                  </CardContent>
                </Card>
                <Card data-testid="conflict-human">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{conflictsData?.resolvedByHuman}</div>
                    <div className="text-xs text-gray-500">Resolved by Human</div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="conflict-list">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Model Disagreements</CardTitle>
                  <CardDescription>Fields where GPT-4o and Claude 3.5 Sonnet extracted different values</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conflictsData?.conflicts?.map((c: any) => (
                      <div key={c.id} className={`p-3 rounded-lg border ${c.resolvedBy ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"}`} data-testid={`conflict-${c.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={c.severity} />
                            <span className="font-medium text-gray-900 dark:text-white">{c.fieldName}</span>
                            <span className="text-xs text-gray-500">({c.documentId})</span>
                          </div>
                          {c.resolvedBy && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />Resolved by {c.resolvedBy}
                            </Badge>
                          )}
                        </div>

                        {showSideBySide ? (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                              <div className="text-xs text-gray-500 mb-1">Model A (GPT-4o)</div>
                              <div className="font-mono text-sm font-medium">{c.modelAValue}</div>
                              <div className="text-xs text-gray-500 mt-1">Confidence: {c.modelAConfidence}%</div>
                            </div>
                            <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                              <div className="text-xs text-gray-500 mb-1">Model B (Claude 3.5)</div>
                              <div className="font-mono text-sm font-medium">{c.modelBValue}</div>
                              <div className="text-xs text-gray-500 mt-1">Confidence: {c.modelBConfidence}%</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm mt-1">
                            <span className="text-blue-600 dark:text-blue-400 font-mono">{c.modelAValue}</span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className="text-purple-600 dark:text-purple-400 font-mono">{c.modelBValue}</span>
                            {c.resolvedValue && (
                              <span className="ml-2 text-green-600 dark:text-green-400">→ {c.resolvedValue}</span>
                            )}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">{c.context}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="clinical" className="mt-4">
          <div className="space-y-4">
            <Card data-testid="clinical-ranges-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-green-500" />
                  Physiological Range Database
                </CardTitle>
                <CardDescription>
                  {rangesData?.totalRanges || 0} clinical ranges and {rangesData?.totalConversions || 0} unit conversion rules used for sanity-checking extracted values
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="ranges-table">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Test</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Unit</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-500">Normal Low</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-500">Normal High</th>
                        <th className="text-center py-2 px-3 font-medium text-red-500">Critical Low</th>
                        <th className="text-center py-2 px-3 font-medium text-red-500">Critical High</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangesData?.ranges && Object.entries(rangesData.ranges).map(([name, range]: [string, any]) => (
                        <tr key={name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`range-row-${name.replace(/\s/g, "-")}`}>
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{name}</td>
                          <td className="py-2 px-3 text-gray-500">{range.unit}</td>
                          <td className="py-2 px-3 text-center">{range.min}</td>
                          <td className="py-2 px-3 text-center">{range.max}</td>
                          <td className="py-2 px-3 text-center text-red-600">{range.critical_low ?? "—"}</td>
                          <td className="py-2 px-3 text-center text-red-600">{range.critical_high ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="unit-conversions-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Unit Normalization Rules</CardTitle>
                <CardDescription>Automatic unit detection and conversion to prevent treating different units as the same value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rangesData?.unitConversions && Object.entries(rangesData.unitConversions).map(([category, conversions]: [string, any]) => (
                    <div key={category} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700" data-testid={`conversion-${category}`}>
                      <div className="font-medium text-sm text-gray-900 dark:text-white mb-2">{category}</div>
                      {conversions.map((c: any, i: number) => (
                        <div key={i} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="font-mono">{c.from}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-mono">{c.to}</span>
                          <span className="text-gray-400 ml-1">(×{c.factor})</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="temporal-integrity-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Temporal Integrity Checks</CardTitle>
                <CardDescription>Validates date consistency to catch impossible sequences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { rule: "Discharge date must be after admission date", type: "Discharge Summary", status: "Active" },
                    { rule: "Lab result date cannot be in the future", type: "Lab Report", status: "Active" },
                    { rule: "Follow-up date must be after date of service", type: "All Documents", status: "Active" },
                    { rule: "Medication start date must precede end date", type: "Prescription", status: "Active" },
                    { rule: "Vaccine administration date must be before expiry date", type: "Immunization Record", status: "Active" },
                    { rule: "Operative note date must match procedure date", type: "Operative Note", status: "Active" },
                    { rule: "Patient DOB must be before all service dates", type: "All Documents", status: "Active" },
                    { rule: "Pathology collection date must be before report date", type: "Pathology Report", status: "Active" },
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800/50 text-sm" data-testid={`temporal-rule-${i}`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-900 dark:text-white">{rule.rule}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{rule.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hitl" className="mt-4">
          <div className="space-y-4">
            <Card data-testid="hitl-overview">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-500" />
                  Human-in-the-Loop Verification Queue
                </CardTitle>
                <CardDescription>
                  Documents below {dashboard?.confidenceThreshold || 95}% confidence are routed for human review. 
                  Side-by-side view shows original PDF snippet alongside extracted text for rapid verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center" data-testid="hitl-auto-approved">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary?.autoApproved}</div>
                    <div className="text-xs text-green-700 dark:text-green-300">Auto-Approved (≥95%)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center" data-testid="hitl-pending">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary?.pendingReview}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">Pending Human Review</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center" data-testid="hitl-reviewed">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary?.reviewed}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Human Verified</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                  <h4 className="font-semibold text-sm mb-3">Confidence Threshold Distribution</h4>
                  <div className="space-y-2">
                    {[
                      { range: "98-100%", label: "Excellent", count: 4, color: "bg-green-500" },
                      { range: "95-97%", label: "Good", count: 3, color: "bg-green-400" },
                      { range: "90-94%", label: "Needs Review", count: 1, color: "bg-amber-400" },
                      { range: "85-89%", label: "Low Confidence", count: 1, color: "bg-amber-500" },
                      { range: "<85%", label: "Manual Required", count: 1, color: "bg-red-500" },
                    ].map(band => (
                      <div key={band.range} className="flex items-center gap-3" data-testid={`confidence-band-${band.range}`}>
                        <span className="text-xs text-gray-500 w-16">{band.range}</span>
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${band.color} rounded-full`} style={{ width: `${(band.count / 10) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium w-20">{band.count} docs ({band.label})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <Eye className="w-4 h-4" /> Audit Trail Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    {[
                      { action: "Human corrected medication count on Discharge Summary (doc-003)", time: "2h ago", corrector: "J. Park, MD" },
                      { action: "Human confirmed follow-up date as 2026-04-01 (doc-003)", time: "2h ago", corrector: "J. Park, MD" },
                      { action: "Human confirmed pathology staging T2N0M0 (doc-006)", time: "5h ago", corrector: "R. Kim, MD" },
                    ].map((entry, i) => (
                      <div key={i} className="flex items-start gap-2" data-testid={`audit-entry-${i}`}>
                        <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-gray-900 dark:text-white">{entry.action}</div>
                          <div className="text-xs text-gray-500">{entry.time} · {entry.corrector}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="golden" className="mt-4">
          {loadingAudits ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card data-testid="golden-cer">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{auditsData?.latestCER}%</div>
                    <div className="text-xs text-gray-500">Character Error Rate</div>
                    <div className="text-xs text-green-500 mt-1">
                      <TrendingUp className="w-3 h-3 inline" /> Industry target: &lt;0.05%
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="golden-wer">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{auditsData?.latestWER}%</div>
                    <div className="text-xs text-gray-500">Word Error Rate</div>
                    <div className="text-xs text-green-500 mt-1">
                      <TrendingUp className="w-3 h-3 inline" /> Improving monthly
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="golden-accuracy">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{auditsData?.latestFieldAccuracy}%</div>
                    <div className="text-xs text-gray-500">Field Accuracy</div>
                    <div className="text-xs text-gray-400 mt-1">Across all document types</div>
                  </CardContent>
                </Card>
                <Card data-testid="golden-total-audits">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{auditsData?.totalAudits}</div>
                    <div className="text-xs text-gray-500">Monthly Audits</div>
                    <div className="text-xs text-gray-400 mt-1">100 docs per audit</div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="golden-trend">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Accuracy Trend (Monthly)</CardTitle>
                  <CardDescription>Character Error Rate and Word Error Rate trending toward zero</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {auditsData?.trend?.cer?.map((point: any, i: number) => (
                      <div key={point.date} className="flex items-center gap-4" data-testid={`trend-row-${i}`}>
                        <span className="text-sm font-medium w-24">{point.date}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8">CER</span>
                            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(point.value * 2000, 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono w-16 text-right">{point.value}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8">WER</span>
                            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(auditsData.trend.wer[i].value * 1000, 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono w-16 text-right">{auditsData.trend.wer[i].value}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {auditsData?.audits?.map((audit: any) => (
                <Card key={audit.id} data-testid={`audit-card-${audit.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Audit: {audit.auditDate}</CardTitle>
                        <CardDescription>{audit.verifiedBy} · {audit.sampleSize} samples</CardDescription>
                      </div>
                      <Badge className={audit.overallGrade === "A+" ? "bg-green-600 text-white text-lg px-3 py-1" : "bg-green-500 text-white text-lg px-3 py-1"}>
                        {audit.overallGrade}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid={`audit-table-${audit.id}`}>
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 font-medium text-gray-500">Document Type</th>
                            <th className="text-center py-2 px-3 font-medium text-gray-500">Count</th>
                            <th className="text-center py-2 px-3 font-medium text-gray-500">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audit.documentTypes.map((dt: any) => (
                            <tr key={dt.type} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{dt.type}</td>
                              <td className="py-2 px-3 text-center">{dt.count}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={dt.accuracy >= 99 ? "text-green-600 dark:text-green-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {dt.accuracy}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                        <span className="text-gray-500">False Positives</span>
                        <span className="font-medium">{audit.falsePositives}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                        <span className="text-gray-500">False Negatives</span>
                        <span className="font-medium">{audit.falseNegatives}</span>
                      </div>
                    </div>
                    <div className="mt-3 p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300">
                      {audit.notes}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
