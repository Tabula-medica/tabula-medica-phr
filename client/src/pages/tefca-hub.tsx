import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Network,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardList,
  FileText,
  Filter,
  Loader2,
  Search,
  Server,
  Shield,
  TrendingUp,
  XCircle,
  Users,
  Zap,
  BarChart3,
} from "lucide-react";

interface PartnerMetrics {
  qhinId: string;
  name: string;
  status: string;
  capabilities: string[];
  participantCount: number;
  certificationDate: string;
  lastHealthCheck: string;
  totalExchanges: number;
  successfulExchanges: number;
  successRate: number;
  avgLatencyMs: number;
  documentsExchanged: number;
  lastExchangeAt: string | null;
}

interface ExchangeLog {
  queryId: string;
  qhinId: string;
  qhinName: string;
  timestamp: string;
  status: string;
  responseTimeMs: number;
  documentsCount: number;
  matchedPatients: number;
  errorMessage?: string;
}

interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Array<{ errorCode: string; count: number; severity: string; lastOccurrence: string }>;
  errorsByPartner: Array<{ qhinId: string; qhinName: string; errorCount: number }>;
  errorTrend: Array<{ date: string; count: number }>;
}

interface TefcaAuditLog {
  id: string;
  timestamp: string;
  operationType: "query" | "push" | "subscribe";
  partnerId: string;
  partnerName: string;
  dataElements: string[];
  status: "success" | "error" | "timeout" | "partial";
  requestId: string;
  responseTimeMs: number;
  documentsCount: number;
  patientMatchCount: number;
  errorMessage?: string;
  initiatedBy: string;
  purposeOfUse: string;
}

interface AuditLogsResponse {
  logs: TefcaAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

interface AuditStats {
  totalOperations: number;
  successRate: number;
  avgResponseTimeMs: number;
  activePartners: number;
}

function statusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    success: "default",
    pending: "secondary",
    partial: "secondary",
    inactive: "outline",
    maintenance: "outline",
    no_records: "outline",
    error: "destructive",
    timeout: "destructive",
    failed: "destructive",
  };
  return (
    <Badge variant={variants[status] || "outline"} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PartnerCard({ partner, selected, onSelect }: { partner: PartnerMetrics; selected: boolean; onSelect: () => void }) {
  const successColor = partner.successRate >= 95 ? "text-green-600 dark:text-green-400" : partner.successRate >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

  return (
    <Card
      className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
      data-testid={`card-partner-${partner.qhinId}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <CardTitle className="text-base" data-testid={`text-partner-name-${partner.qhinId}`}>{partner.name}</CardTitle>
          </div>
          {statusBadge(partner.status)}
        </div>
        <CardDescription className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {formatNumber(partner.participantCount)} participants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className={`text-lg font-semibold ${successColor}`} data-testid={`text-success-rate-${partner.qhinId}`}>
              {partner.successRate.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Latency</p>
            <p className="text-lg font-semibold" data-testid={`text-latency-${partner.qhinId}`}>
              {formatLatency(partner.avgLatencyMs)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Exchanges</p>
            <p className="text-lg font-semibold" data-testid={`text-exchanges-${partner.qhinId}`}>
              {partner.totalExchanges}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {partner.documentsExchanged} docs
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {partner.lastExchangeAt ? formatDate(partner.lastExchangeAt) : "No exchanges"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {partner.capabilities.slice(0, 3).map(cap => (
            <Badge key={cap} variant="outline" className="text-[10px] px-1.5 py-0">
              {cap.replace(/_/g, " ")}
            </Badge>
          ))}
          {partner.capabilities.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{partner.capabilities.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExchangeLogsTable({ logs, isLoading }: { logs: ExchangeLog[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2" />
        <p>No exchange logs found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px]">
      <div className="space-y-2">
        {logs.map((log, index) => (
          <div
            key={`${log.queryId}-${log.qhinId}-${index}`}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            data-testid={`row-exchange-log-${index}`}
          >
            <div className="shrink-0">
              {log.status === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : log.status === "error" || log.status === "timeout" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate" data-testid={`text-log-partner-${index}`}>{log.qhinName}</span>
                {statusBadge(log.status)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(log.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {formatLatency(log.responseTimeMs)}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {log.documentsCount} docs
                </span>
                <span>{log.matchedPatients} match{log.matchedPatients !== 1 ? "es" : ""}</span>
              </div>
              {log.errorMessage && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 truncate" data-testid={`text-log-error-${index}`}>
                  {log.errorMessage}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function ErrorInsightsPanel({ data, isLoading }: { data: ErrorAnalytics | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.totalErrors === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Shield className="h-8 w-8 mb-2" />
        <p>No errors recorded</p>
        <p className="text-sm">All exchanges are running smoothly</p>
      </div>
    );
  }

  const maxErrorCount = Math.max(...data.errorsByType.map(e => e.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-total-errors">{data.totalErrors}</p>
            <p className="text-xs text-muted-foreground">Total Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-error-types-count">{data.errorsByType.length}</p>
            <p className="text-xs text-muted-foreground">Error Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-affected-partners-count">{data.errorsByPartner.length}</p>
            <p className="text-xs text-muted-foreground">Affected Partners</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Error Frequency by Type
        </h4>
        <div className="space-y-3">
          {data.errorsByType.map((err) => (
            <div key={err.errorCode} className="space-y-1" data-testid={`row-error-type-${err.errorCode}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{err.errorCode.replace(/_/g, " ")}</span>
                  <Badge variant={err.severity === "critical" ? "destructive" : err.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">
                    {err.severity}
                  </Badge>
                </div>
                <span className="text-muted-foreground">{err.count} occurrences</span>
              </div>
              <Progress value={(err.count / maxErrorCount) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">Last: {formatDate(err.lastOccurrence)}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4" />
          Errors by Partner
        </h4>
        <div className="space-y-2">
          {data.errorsByPartner.map((p) => (
            <div key={p.qhinId} className="flex items-center justify-between p-2 rounded border" data-testid={`row-error-partner-${p.qhinId}`}>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{p.qhinName}</span>
              </div>
              <Badge variant="destructive">{p.errorCount}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function operationBadge(op: string) {
  const colors: Record<string, string> = {
    query: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    push: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    subscribe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return (
    <Badge variant="outline" className={colors[op] || ""} data-testid={`badge-operation-${op}`}>
      {op}
    </Badge>
  );
}

export default function TefcaHubPage() {
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");

  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditPartner, setAuditPartner] = useState("all");
  const [auditStatus, setAuditStatus] = useState("all");
  const [auditOperation, setAuditOperation] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState({
    from: "", to: "", partner: "all", status: "all", operation: "all",
  });

  const { data: partners, isLoading: partnersLoading } = useQuery<PartnerMetrics[]>({
    queryKey: ["/api/tefca/partners"],
  });

  const logsEndpoint = selectedPartner
    ? `/api/tefca/partners/${selectedPartner}/logs`
    : "/api/tefca/exchange-logs";

  const { data: exchangeLogs, isLoading: logsLoading } = useQuery<ExchangeLog[]>({
    queryKey: ["/api/tefca/exchange-logs", selectedPartner],
    queryFn: async () => {
      const res = await fetch(`${logsEndpoint}?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch exchange logs");
      return res.json();
    },
  });

  const { data: errorAnalytics, isLoading: errorsLoading } = useQuery<ErrorAnalytics>({
    queryKey: ["/api/tefca/errors/summary"],
  });

  const auditQueryParams = new URLSearchParams();
  if (appliedFilters.from) auditQueryParams.set("from", appliedFilters.from);
  if (appliedFilters.to) auditQueryParams.set("to", appliedFilters.to);
  if (appliedFilters.partner !== "all") auditQueryParams.set("partner", appliedFilters.partner);
  if (appliedFilters.status !== "all") auditQueryParams.set("status", appliedFilters.status);
  if (appliedFilters.operation !== "all") auditQueryParams.set("operation", appliedFilters.operation);

  const { data: auditLogsData, isLoading: auditLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/tefca/audit-logs", appliedFilters.from, appliedFilters.to, appliedFilters.partner, appliedFilters.status, appliedFilters.operation],
    queryFn: async () => {
      const res = await fetch(`/api/tefca/audit-logs?${auditQueryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const { data: auditStats, isLoading: auditStatsLoading } = useQuery<AuditStats>({
    queryKey: ["/api/tefca/audit-logs/stats"],
  });

  const handleAuditSearch = () => {
    setAppliedFilters({
      from: auditDateFrom,
      to: auditDateTo,
      partner: auditPartner,
      status: auditStatus,
      operation: auditOperation,
    });
  };

  const handleAuditClear = () => {
    setAuditDateFrom("");
    setAuditDateTo("");
    setAuditPartner("all");
    setAuditStatus("all");
    setAuditOperation("all");
    setAppliedFilters({ from: "", to: "", partner: "all", status: "all", operation: "all" });
  };

  const filteredLogs = exchangeLogs?.filter(log => {
    if (logFilter === "all") return true;
    if (logFilter === "success") return log.status === "success";
    if (logFilter === "errors") return log.status === "error" || log.status === "timeout";
    return true;
  }) || [];

  const totalExchanges = partners?.reduce((sum, p) => sum + p.totalExchanges, 0) || 0;
  const totalDocs = partners?.reduce((sum, p) => sum + p.documentsExchanged, 0) || 0;
  const avgSuccess = partners && partners.length > 0
    ? partners.reduce((sum, p) => sum + p.successRate, 0) / partners.length
    : 0;
  const activePartners = partners?.filter(p => p.status === "active").length || 0;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Network className="h-6 w-6 text-primary" />
          TEFCA Hub
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage partner connections and monitor data exchange across the Trusted Exchange Framework
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active Partners</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-active-partners">{activePartners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Exchanges</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-exchanges">{totalExchanges}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Avg Success Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-avg-success">{avgSuccess.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Documents Exchanged</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-docs">{totalDocs}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList data-testid="tabs-tefca-hub">
          <TabsTrigger value="partners" data-testid="tab-partners">
            <Network className="h-4 w-4 mr-1" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Activity className="h-4 w-4 mr-1" />
            Exchange Logs
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Error Insights
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <ClipboardList className="h-4 w-4 mr-1" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="space-y-4">
          {partnersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners?.map(partner => (
                <PartnerCard
                  key={partner.qhinId}
                  partner={partner}
                  selected={selectedPartner === partner.qhinId}
                  onSelect={() => setSelectedPartner(
                    selectedPartner === partner.qhinId ? null : partner.qhinId
                  )}
                />
              ))}
            </div>
          )}
          {selectedPartner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Exchanges — {partners?.find(p => p.qhinId === selectedPartner)?.name}
                </CardTitle>
                <CardDescription>
                  Click a partner card to view its exchange history. Click again to deselect.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExchangeLogsTable logs={filteredLogs} isLoading={logsLoading} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Data Exchange Logs</CardTitle>
                  <CardDescription>All exchanges across TEFCA partner network</CardDescription>
                </div>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-log-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Successful</SelectItem>
                    <SelectItem value="errors">Errors Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ExchangeLogsTable logs={filteredLogs} isLoading={logsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Error Analysis
              </CardTitle>
              <CardDescription>Common error types and their frequency across partner exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorInsightsPanel data={errorAnalytics} isLoading={errorsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={auditDateFrom}
                    onChange={(e) => setAuditDateFrom(e.target.value)}
                    data-testid="input-audit-date-from"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={auditDateTo}
                    onChange={(e) => setAuditDateTo(e.target.value)}
                    data-testid="input-audit-date-to"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Partner</label>
                  <Select value={auditPartner} onValueChange={setAuditPartner}>
                    <SelectTrigger className="w-[180px]" data-testid="select-audit-partner">
                      <SelectValue placeholder="All Partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners?.map(p => (
                        <SelectItem key={p.qhinId} value={p.qhinId}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={auditStatus} onValueChange={setAuditStatus}>
                    <SelectTrigger className="w-[140px]" data-testid="select-audit-status">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="timeout">Timeout</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Operation</label>
                  <Select value={auditOperation} onValueChange={setAuditOperation}>
                    <SelectTrigger className="w-[140px]" data-testid="select-audit-operation">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="query">Query</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="subscribe">Subscribe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAuditSearch} data-testid="button-audit-search">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
                <Button variant="outline" onClick={handleAuditClear} data-testid="button-audit-clear">
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Operations</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-audit-total-ops">
                  {auditStatsLoading ? "..." : auditStats?.totalOperations ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Success Rate</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-audit-success-rate">
                  {auditStatsLoading ? "..." : `${auditStats?.successRate ?? 0}%`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Avg Response Time</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-audit-avg-response">
                  {auditStatsLoading ? "..." : formatLatency(auditStats?.avgResponseTimeMs ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Active Partners</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-audit-active-partners">
                  {auditStatsLoading ? "..." : auditStats?.activePartners ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Audit Log Entries
              </CardTitle>
              <CardDescription>
                {auditLogsData ? `Showing ${auditLogsData.logs.length} of ${auditLogsData.total} entries` : "Loading..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !auditLogsData || auditLogsData.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mb-2" />
                  <p>No audit log entries found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {auditLogsData.logs.map((log, index) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                        data-testid={`row-audit-log-${index}`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {log.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : log.status === "error" || log.status === "timeout" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {operationBadge(log.operationType)}
                            <span className="font-medium text-sm" data-testid={`text-audit-partner-${index}`}>{log.partnerName}</span>
                            {statusBadge(log.status)}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.dataElements.slice(0, 2).map(el => (
                              <Badge key={el} variant="outline" className="text-[10px] px-1.5 py-0">{el}</Badge>
                            ))}
                            {log.dataElements.length > 2 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{log.dataElements.length - 2} more</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.timestamp)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {formatLatency(log.responseTimeMs)}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {log.documentsCount} docs
                            </span>
                            <span>{log.patientMatchCount} match{log.patientMatchCount !== 1 ? "es" : ""}</span>
                          </div>
                          {log.errorMessage && (
                            <p className="text-xs text-red-500 dark:text-red-400 truncate" data-testid={`text-audit-error-${index}`}>
                              {log.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
