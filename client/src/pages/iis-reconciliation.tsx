import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  FileCheck, 
  Search, 
  Filter,
  ChevronRight,
  Activity,
  Zap,
  ClipboardList,
  History,
  Settings
} from "lucide-react";

interface MatchingFactor {
  factor: string;
  score: number;
  weight: number;
  details: string;
}

interface FieldDiscrepancy {
  field: string;
  localValue: string;
  iisValue: string;
  severity: "critical" | "major" | "minor";
  suggestedResolution: string;
  confidence: number;
}

interface ReconciliationMatch {
  id: string;
  localRecordId: string;
  iisRecordId: string;
  patientId: string;
  matchConfidence: number;
  confidenceLevel: "high" | "medium" | "low" | "no_match";
  matchingFactors: MatchingFactor[];
  discrepancies: FieldDiscrepancy[];
  status: "pending" | "auto_verified" | "needs_review" | "resolved" | "rejected";
  autoVerified: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface ReconciliationStats {
  totalMatches: number;
  pendingReview: number;
  autoVerified: number;
  manuallyResolved: number;
  rejected: number;
  averageConfidence: number;
  matchesByConfidenceLevel: Record<string, number>;
  commonDiscrepancies: { field: string; count: number }[];
  processingStats: {
    totalProcessed24h: number;
    autoVerified24h: number;
    flaggedForReview24h: number;
  };
}

interface AuditLog {
  id: string;
  matchId: string;
  action: string;
  userId: string;
  userRole: string;
  previousStatus?: string;
  newStatus: string;
  details: string;
  timestamp: string;
}

interface LocalRecord {
  id: string;
  patientId: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  lotNumber?: string;
  manufacturer?: string;
  doseNumber?: number;
  source: string;
}

interface IISRecord {
  id: string;
  patientId: string;
  iisSource: string;
  stateCode: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  lotNumber?: string;
  manufacturer?: string;
  doseNumber?: number;
  reportingFacility?: string;
}

export default function IISReconciliationPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMatch, setSelectedMatch] = useState<ReconciliationMatch | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionType, setResolutionType] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [patientIdFilter, setPatientIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: statsData, isLoading: statsLoading } = useQuery<{ data: ReconciliationStats }>({
    queryKey: ["/api/iis-reconciliation/stats"]
  });

  const queueQueryKey = statusFilter && statusFilter !== "all" 
    ? `/api/iis-reconciliation/review-queue?status=${statusFilter}`
    : "/api/iis-reconciliation/review-queue";

  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery<{ data: ReconciliationMatch[] }>({
    queryKey: [queueQueryKey]
  });

  const { data: auditData } = useQuery<{ data: AuditLog[] }>({
    queryKey: ["/api/iis-reconciliation/audit-logs"]
  });

  const { data: matchDetailsData, isLoading: matchDetailsLoading } = useQuery<{
    data: { match: ReconciliationMatch; localRecord: LocalRecord; iisRecord: IISRecord };
  }>({
    queryKey: ["/api/iis-reconciliation/match", selectedMatch?.id],
    enabled: !!selectedMatch?.id
  });

  const runReconciliationMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return apiRequest("POST", "/api/iis-reconciliation/run", { patientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/stats"] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ matchId, resolutionType, notes }: { matchId: string; resolutionType: string; notes: string }) => {
      return apiRequest("POST", `/api/iis-reconciliation/match/${matchId}/resolve`, { resolutionType, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/audit-logs"] });
      setShowResolveDialog(false);
      setSelectedMatch(null);
      setResolutionType("");
      setResolutionNotes("");
    }
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/iis-reconciliation/bulk-verify", { confidenceThreshold: 0.98 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iis-reconciliation/stats"] });
    }
  });

  const stats = statsData?.data;
  const queue = queueData?.data || [];
  const auditLogs = auditData?.data || [];
  const matchDetails = matchDetailsData?.data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "auto_verified":
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400" data-testid="badge-status-auto-verified"><CheckCircle2 className="w-3 h-3 mr-1" />Auto Verified</Badge>;
      case "resolved":
        return <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400" data-testid="badge-status-resolved"><FileCheck className="w-3 h-3 mr-1" />Resolved</Badge>;
      case "needs_review":
        return <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400" data-testid="badge-status-needs-review"><AlertTriangle className="w-3 h-3 mr-1" />Needs Review</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400" data-testid="badge-status-rejected"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-400" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getConfidenceBadge = (level: string, score: number) => {
    const percent = (score * 100).toFixed(0);
    switch (level) {
      case "high":
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400" data-testid="badge-confidence-high">{percent}% High</Badge>;
      case "medium":
        return <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400" data-testid="badge-confidence-medium">{percent}% Medium</Badge>;
      case "low":
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400" data-testid="badge-confidence-low">{percent}% Low</Badge>;
      default:
        return <Badge className="bg-gray-500/20" data-testid="badge-confidence-unknown">{percent}%</Badge>;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-600 dark:text-red-400";
      case "major": return "text-amber-600 dark:text-amber-400";
      case "minor": return "text-blue-600 dark:text-blue-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-iis-reconciliation">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">IIS Data Reconciliation</h1>
          <p className="text-muted-foreground">Review and resolve immunization record discrepancies</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => refetchQueue()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => bulkVerifyMutation.mutate()}
            disabled={bulkVerifyMutation.isPending}
            data-testid="button-bulk-verify"
          >
            <Zap className="w-4 h-4 mr-2" />
            {bulkVerifyMutation.isPending ? "Verifying..." : "Bulk Auto-Verify"}
          </Button>
        </div>
      </div>

      <Alert data-testid="alert-no-cds">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important Disclaimer</AlertTitle>
        <AlertDescription>
          This reconciliation tool is for data verification purposes only and does not provide clinical decision support. 
          All immunization records should be reviewed by a qualified healthcare provider before making patient care decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-main">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Activity className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">
            <ClipboardList className="w-4 h-4 mr-2" />
            Review Queue
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-2" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="run" data-testid="tab-run">
            <Settings className="w-4 h-4 mr-2" />
            Run Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-stat-total">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-stat-total">{stats.totalMatches}</div>
                    <p className="text-xs text-muted-foreground">All time records processed</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-stat-pending">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600" data-testid="text-stat-pending">{stats.pendingReview}</div>
                    <p className="text-xs text-muted-foreground">Requires clinician action</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-stat-auto-verified">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Auto Verified</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-stat-auto-verified">{stats.autoVerified}</div>
                    <p className="text-xs text-muted-foreground">High-confidence matches</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-stat-confidence">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                    <Activity className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-stat-confidence">{(stats.averageConfidence * 100).toFixed(1)}%</div>
                    <Progress value={stats.averageConfidence * 100} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card data-testid="card-confidence-breakdown">
                  <CardHeader>
                    <CardTitle className="text-lg">Confidence Level Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(stats.matchesByConfidenceLevel).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="capitalize">{level.replace("_", " ")}</span>
                        <Badge variant="outline" data-testid={`badge-breakdown-${level}`}>{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card data-testid="card-common-discrepancies">
                  <CardHeader>
                    <CardTitle className="text-lg">Common Discrepancies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stats.commonDiscrepancies.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No discrepancies found</p>
                    ) : (
                      stats.commonDiscrepancies.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="capitalize">{d.field.replace("_", " ")}</span>
                          <Badge variant="outline" data-testid={`badge-discrepancy-${d.field}`}>{d.count}</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-processing-stats">
                <CardHeader>
                  <CardTitle className="text-lg">Processing Stats (Last 24 Hours)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-processed-24h">{stats.processingStats.totalProcessed24h}</div>
                      <p className="text-sm text-muted-foreground">Processed</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600" data-testid="text-auto-verified-24h">{stats.processingStats.autoVerified24h}</div>
                      <p className="text-sm text-muted-foreground">Auto Verified</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-600" data-testid="text-flagged-24h">{stats.processingStats.flaggedForReview24h}</div>
                      <p className="text-sm text-muted-foreground">Flagged for Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No statistics available. Run a reconciliation to get started.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Review Queue</CardTitle>
                  <CardDescription>Records requiring clinician review and resolution</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="needs_review">Needs Review</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="auto_verified">Auto Verified</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : queue.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No records in the review queue matching the current filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => setSelectedMatch(match)}
                      data-testid={`card-match-${match.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(match.status)}
                          {getConfidenceBadge(match.confidenceLevel, match.matchConfidence)}
                          {match.discrepancies.length > 0 && (
                            <Badge variant="outline" className="text-amber-600" data-testid={`badge-discrepancies-${match.id}`}>
                              {match.discrepancies.length} discrepancies
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient: {match.patientId} | Created: {new Date(match.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" data-testid={`button-view-match-${match.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedMatch && (
            <Card data-testid="card-match-details">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Match Details</CardTitle>
                  <div className="flex gap-2">
                    {selectedMatch.status !== "resolved" && selectedMatch.status !== "rejected" && (
                      <Button
                        onClick={() => setShowResolveDialog(true)}
                        data-testid="button-resolve-match"
                      >
                        Resolve Match
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setSelectedMatch(null)}
                      data-testid="button-close-details"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {matchDetailsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : matchDetails ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card data-testid="card-local-record">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Local Record</CardTitle>
                          <Badge variant="outline">{matchDetails.localRecord.source}</Badge>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <div><strong>Vaccine:</strong> {matchDetails.localRecord.vaccineName}</div>
                          <div className="flex items-center gap-2">
                            <strong>CVX Code:</strong>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-semibold">
                              {matchDetails.localRecord.vaccineCode || "—"}
                            </span>
                          </div>
                          <div><strong>Date:</strong> {matchDetails.localRecord.administeredDate}</div>
                          <div><strong>Lot:</strong> {matchDetails.localRecord.lotNumber || "N/A"}</div>
                          <div><strong>Manufacturer:</strong> {matchDetails.localRecord.manufacturer || "N/A"}</div>
                          <div><strong>Dose:</strong> {matchDetails.localRecord.doseNumber || "N/A"}</div>
                        </CardContent>
                      </Card>

                      <Card data-testid="card-iis-record">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">State Registry (IIS) Record</CardTitle>
                          <Badge variant="outline">{matchDetails.iisRecord.iisSource}</Badge>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <div><strong>Vaccine:</strong> {matchDetails.iisRecord.vaccineName}</div>
                          <div className="flex items-center gap-2">
                            <strong>CVX Code:</strong>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold">
                              {matchDetails.iisRecord.vaccineCode || "—"}
                            </span>
                          </div>
                          <div><strong>Date:</strong> {matchDetails.iisRecord.administeredDate}</div>
                          <div><strong>Lot:</strong> {matchDetails.iisRecord.lotNumber || "N/A"}</div>
                          <div><strong>Manufacturer:</strong> {matchDetails.iisRecord.manufacturer || "N/A"}</div>
                          <div><strong>Dose:</strong> {matchDetails.iisRecord.doseNumber || "N/A"}</div>
                          <div><strong>Facility:</strong> {matchDetails.iisRecord.reportingFacility || "N/A"}</div>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedMatch.discrepancies.length > 0 && (
                      <Card data-testid="card-discrepancies-detail">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Discrepancies</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {selectedMatch.discrepancies.map((d, i) => (
                              <div key={i} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className={`font-medium capitalize ${getSeverityColor(d.severity)}`}>
                                    {d.field.replace("_", " ")}
                                  </span>
                                  <Badge variant="outline" className={getSeverityColor(d.severity)}>
                                    {d.severity}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Local: </span>
                                    <span>{d.localValue}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">IIS: </span>
                                    <span>{d.iisValue}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Suggested: {d.suggestedResolution.replace("_", " ")} ({(d.confidence * 100).toFixed(0)}% confidence)
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card data-testid="card-matching-factors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Matching Factors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedMatch.matchingFactors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{f.factor}</span>
                                <p className="text-xs text-muted-foreground">{f.details}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={f.score * 100} className="w-24" />
                                <span className="text-sm">{(f.score * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <p className="text-muted-foreground">Could not load match details</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card data-testid="card-audit-log">
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete history of reconciliation actions</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No audit logs available.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 50).map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-3 border rounded-lg" data-testid={`audit-log-${log.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">{log.action.replace("_", " ")}</Badge>
                          <span className="text-sm text-muted-foreground">{log.userId} ({log.userRole})</span>
                        </div>
                        <p className="text-sm mt-1">{log.details}</p>
                        {log.previousStatus && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Status: {log.previousStatus} → {log.newStatus}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="run" className="space-y-4">
          <Card data-testid="card-run-reconciliation">
            <CardHeader>
              <CardTitle>Run Reconciliation</CardTitle>
              <CardDescription>
                Start a new reconciliation process for a specific patient to compare local records with IIS data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="patientId"
                    value={patientIdFilter}
                    onChange={(e) => setPatientIdFilter(e.target.value)}
                    placeholder="Enter patient ID (e.g., patient-1)"
                    data-testid="input-patient-id"
                  />
                  <Button
                    onClick={() => runReconciliationMutation.mutate(patientIdFilter)}
                    disabled={!patientIdFilter || runReconciliationMutation.isPending}
                    data-testid="button-run-reconciliation"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {runReconciliationMutation.isPending ? "Running..." : "Run"}
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sample Patient IDs</AlertTitle>
                <AlertDescription>
                  For testing, use: patient-1, patient-2, or patient-3
                </AlertDescription>
              </Alert>

              {runReconciliationMutation.isSuccess && (
                <Alert className="border-green-500">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Reconciliation Complete</AlertTitle>
                  <AlertDescription>
                    Check the Review Queue tab to see the results.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent data-testid="dialog-resolve">
          <DialogHeader>
            <DialogTitle>Resolve Match</DialogTitle>
            <DialogDescription>
              Choose how to resolve this data discrepancy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Type</Label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger data-testid="select-resolution-type">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept_local">Accept Local Record</SelectItem>
                  <SelectItem value="accept_iis">Accept IIS Record</SelectItem>
                  <SelectItem value="merge">Merge Records</SelectItem>
                  <SelectItem value="manual_entry">Manual Entry</SelectItem>
                  <SelectItem value="reject">Reject Match</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add any notes about this resolution..."
                data-testid="textarea-resolution-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)} data-testid="button-cancel-resolve">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMatch && resolutionType) {
                  resolveMutation.mutate({
                    matchId: selectedMatch.id,
                    resolutionType,
                    notes: resolutionNotes
                  });
                }
              }}
              disabled={!resolutionType || resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "Resolving..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
