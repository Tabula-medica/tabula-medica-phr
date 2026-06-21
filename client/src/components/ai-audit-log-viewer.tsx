import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  AlertTriangle,
  Activity,
  Brain,
  ChevronDown,
  Download,
  Filter,
  RefreshCw,
  Clock,
  User,
  Shield,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
} from "lucide-react";
import type { AiAuditLogEntry, AiAuditEventType, AiAuditLogStats } from "@shared/schema";

const EVENT_TYPE_LABELS: Record<AiAuditEventType, string> = {
  patient_summary_generated: "Patient Summary",
  risk_stratification_generated: "Risk Stratification",
  imaging_analysis_generated: "Imaging Analysis",
  document_summary_generated: "Document Summary",
  lab_explanation_generated: "Lab Explanation",
  medication_summary_generated: "Medication Summary",
  trend_analysis_generated: "Trend Analysis",
  insight_generated: "AI Insight",
  clinical_documentation_generated: "Clinical Documentation",
  referral_note_generated: "Referral Note",
  preventive_care_orders_generated: "Preventive Care Orders",
};

const EVENT_TYPE_ICONS: Record<AiAuditEventType, typeof FileText> = {
  patient_summary_generated: FileText,
  risk_stratification_generated: AlertTriangle,
  imaging_analysis_generated: Brain,
  document_summary_generated: FileText,
  lab_explanation_generated: Activity,
  medication_summary_generated: Activity,
  trend_analysis_generated: BarChart3,
  insight_generated: Brain,
  clinical_documentation_generated: FileText,
  referral_note_generated: FileText,
  preventive_care_orders_generated: Activity,
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface AuditLogFilters {
  eventType?: AiAuditEventType;
  userRole?: string;
  startDate?: string;
  endDate?: string;
}

export function AIAuditLogViewer() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const buildQueryString = (f: AuditLogFilters): string => {
    const params = new URLSearchParams();
    if (f.eventType) params.set("eventType", f.eventType);
    if (f.userRole) params.set("userRole", f.userRole);
    if (f.startDate) params.set("startDate", f.startDate);
    if (f.endDate) params.set("endDate", f.endDate);
    return params.toString();
  };

  const queryString = buildQueryString(filters);
  const logsUrl = queryString ? `/api/ai-audit-log?${queryString}` : "/api/ai-audit-log";

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{
    success: boolean;
    data: AiAuditLogEntry[];
    pagination: { limit: number; offset: number; total: number };
  }>({
    queryKey: ["/api/ai-audit-log", filters],
    queryFn: async () => {
      const response = await fetch(logsUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      return response.json();
    },
  });

  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<{
    success: boolean;
    data: AiAuditLogStats;
  }>({
    queryKey: ["/api/ai-audit-log/stats"],
    queryFn: async () => {
      const response = await fetch("/api/ai-audit-log/stats", { credentials: "include" });
      if (!response.ok) {
        if (response.status === 403) {
          return { success: false, data: null };
        }
        throw new Error("Failed to fetch stats");
      }
      return response.json();
    },
    retry: false,
  });

  const logs = logsData?.data || [];
  const stats = statsData?.data;

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.eventType) params.set("eventType", filters.eventType);
    
    window.open(`/api/ai-audit-log/export/csv?${params.toString()}`, "_blank");
  };

  const getEventBadgeVariant = (eventType: AiAuditEventType): "default" | "secondary" | "outline" => {
    if (eventType.includes("risk") || eventType.includes("imaging")) {
      return "default";
    }
    return "secondary";
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "provider" || role === "clinician") return "default";
    if (role === "admin") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-4" data-testid="ai-audit-log-viewer">
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Entries</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-stat-total">{stats.totalEntries}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Confidence</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-stat-confidence">
                {(stats.avgConfidenceScore * 100).toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Response Time</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-stat-duration">
                {formatDuration(stats.avgRequestDurationMs)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inaccuracy Reports</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-stat-inaccuracies">
                {stats.inaccuracyReportsCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                AI Audit Log
              </CardTitle>
              <CardDescription>
                Complete record of all AI-generated summaries and insights
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLogs()}
                data-testid="button-refresh-logs"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={showFilters}>
          <CollapsibleContent>
            <div className="px-6 pb-4 grid gap-4 md:grid-cols-4 border-b">
              <div className="space-y-2">
                <Label htmlFor="filter-event-type">Event Type</Label>
                <Select
                  value={filters.eventType || "all"}
                  onValueChange={(value) => 
                    setFilters({ ...filters, eventType: value === "all" ? undefined : value as AiAuditEventType })
                  }
                >
                  <SelectTrigger id="filter-event-type" data-testid="select-filter-event-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-user-role">User Role</Label>
                <Select
                  value={filters.userRole || "all"}
                  onValueChange={(value) => 
                    setFilters({ ...filters, userRole: value === "all" ? undefined : value })
                  }
                >
                  <SelectTrigger id="filter-user-role" data-testid="select-filter-user-role">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="provider">Provider</SelectItem>
                    <SelectItem value="caregiver">Caregiver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-start-date">Start Date</Label>
                <Input
                  id="filter-start-date"
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                  data-testid="input-filter-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-end-date">End Date</Label>
                <Input
                  id="filter-end-date"
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                  data-testid="input-filter-end-date"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <CardContent className="p-0">
          {logsLoading || statsLoading ? (
            <div className="flex items-center justify-center p-8" data-testid="loading-spinner">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground" data-testid="text-no-logs">
              No audit log entries found. AI-generated summaries will appear here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((entry) => {
                  const Icon = EVENT_TYPE_ICONS[entry.eventType] || FileText;
                  const isExpanded = expandedRows.has(entry.id);

                  return (
                    <Collapsible key={entry.id} open={isExpanded}>
                      <TableRow
                        className="cursor-pointer hover-elevate"
                        onClick={() => toggleRowExpansion(entry.id)}
                        data-testid={`row-audit-log-${entry.id}`}
                      >
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-expand-${entry.id}`}>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatTimestamp(entry.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEventBadgeVariant(entry.eventType)} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {EVENT_TYPE_LABELS[entry.eventType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant={getRoleBadgeVariant(entry.userRole)} className="capitalize">
                              {entry.userRole}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={entry.summary.title}>
                          {entry.summary.title}
                        </TableCell>
                        <TableCell>
                          {entry.summary.confidenceScore !== undefined ? (
                            <Badge 
                              variant={entry.summary.confidenceScore >= 0.8 ? "default" : "secondary"}
                              data-testid={`badge-confidence-${entry.id}`}
                            >
                              {(entry.summary.confidenceScore * 100).toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(entry.metadata.requestDurationMs)}
                        </TableCell>
                        <TableCell>
                          {entry.feedback ? (
                            <div className="flex items-center gap-1">
                              {entry.feedback.isInaccurate ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Inaccurate
                                </Badge>
                              ) : entry.feedback.accuracyRating && entry.feedback.accuracyRating >= 4 ? (
                                <ThumbsUp className="h-4 w-4 text-green-500" />
                              ) : entry.feedback.accuracyRating && entry.feedback.accuracyRating < 3 ? (
                                <ThumbsDown className="h-4 w-4 text-red-500" />
                              ) : (
                                <span className="text-muted-foreground text-sm">Mixed</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30" data-testid={`row-details-${entry.id}`}>
                          <TableCell colSpan={8}>
                            <div className="p-4 space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="font-medium mb-2">Content Preview</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {entry.summary.contentPreview}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-medium mb-2">Parameters Used</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.parameters.sensitivity && (
                                      <Badge variant="outline">
                                        Sensitivity: {entry.parameters.sensitivity}
                                      </Badge>
                                    )}
                                    {entry.parameters.timeframeDays && (
                                      <Badge variant="outline">
                                        Timeframe: {entry.parameters.timeframeDays} days
                                      </Badge>
                                    )}
                                    {entry.parameters.modelUsed && (
                                      <Badge variant="outline">
                                        Model: {entry.parameters.modelUsed}
                                      </Badge>
                                    )}
                                    {entry.parameters.smoothingEnabled !== undefined && (
                                      <Badge variant="outline">
                                        Smoothing: {entry.parameters.smoothingEnabled ? "On" : "Off"}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {entry.summary.warningsGenerated && entry.summary.warningsGenerated.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    Warnings Generated
                                  </h4>
                                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                    {entry.summary.warningsGenerated.map((warning, i) => (
                                      <li key={i}>{warning}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>ID: {entry.id}</span>
                                <span>Patient: {entry.patientId}</span>
                                <span>User: {entry.userId}</span>
                                {entry.metadata.cacheHit && (
                                  <Badge variant="outline">Cache Hit</Badge>
                                )}
                                {entry.metadata.fallbackUsed && (
                                  <Badge variant="secondary">Fallback Used</Badge>
                                )}
                                {entry.summary.disclaimersIncluded && (
                                  <Badge variant="outline">Disclaimers Included</Badge>
                                )}
                              </div>

                              {entry.feedback && (
                                <div className="border-t pt-4">
                                  <h4 className="font-medium mb-2">User Feedback</h4>
                                  <div className="flex gap-4 text-sm">
                                    <span>Accuracy: {entry.feedback.accuracyRating}/5</span>
                                    <span>Usefulness: {entry.feedback.usefulnessRating}/5</span>
                                    <span>Submitted: {formatTimestamp(entry.feedback.feedbackTimestamp)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground p-2">
        <p>
          This audit log is maintained for HIPAA compliance and accountability purposes.
          All entries are tamper-resistant and include NO-CDS disclaimers by design.
        </p>
      </div>
    </div>
  );
}
