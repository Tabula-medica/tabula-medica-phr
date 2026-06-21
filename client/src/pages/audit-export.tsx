import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SecurityAuditLog } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Shield,
  Calendar,
  User,
  Activity,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface AuditExportResponse {
  total: number;
  filters: {
    userId?: string;
    profileId?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
  };
  logs: SecurityAuditLog[];
}

interface EventTypesResponse {
  eventTypes: string[];
}

export default function AuditExport() {
  const [filters, setFilters] = useState({
    userId: "",
    profileId: "",
    eventType: "",
    startDate: "",
    endDate: "",
    limit: "500",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState<"json" | "csv" | null>(null);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.userId) params.append("userId", filters.userId);
    if (filters.profileId) params.append("profileId", filters.profileId);
    if (filters.eventType && filters.eventType !== "all") params.append("eventType", filters.eventType);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.limit) params.append("limit", filters.limit);
    return params.toString();
  };

  const { data: eventTypesData } = useQuery<EventTypesResponse>({
    queryKey: ["/api/admin/audit-export/event-types"],
  });

  const { data, isLoading, refetch, isFetching } = useQuery<AuditExportResponse>({
    queryKey: ["/api/admin/audit-export", buildQueryString()],
    queryFn: async () => {
      const qs = buildQueryString();
      const response = await fetch(`/api/admin/audit-export${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(format);
    try {
      const qs = buildQueryString();
      const response = await fetch(`/api/admin/audit-export/${format}${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error(`Failed to export as ${format.toUpperCase()}`);
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `audit-logs.${format}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(null);
    }
  };

  const toggleRowExpanded = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const getEventTypeBadgeVariant = (eventType: string): "default" | "secondary" | "destructive" | "outline" => {
    if (eventType.includes("failed") || eventType.includes("denied") || eventType.includes("locked")) {
      return "destructive";
    }
    if (eventType.includes("success") || eventType.includes("completed") || eventType.includes("verified")) {
      return "default";
    }
    if (eventType.includes("warning") || eventType.includes("alert")) {
      return "secondary";
    }
    return "outline";
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-audit-export">
            <Shield className="h-6 w-6 text-primary" />
            Audit Log Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Enterprise security review - export audit logs for compliance validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("json")}
            disabled={isExporting !== null || !data?.logs?.length}
            data-testid="button-export-json"
          >
            {isExporting === "json" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4 mr-2" />
            )}
            Export JSON
          </Button>
          <Button
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null || !data?.logs?.length}
            data-testid="button-export-csv"
          >
            {isExporting === "csv" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter audit logs by user, profile, event type, and date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                User ID
              </Label>
              <Input
                id="userId"
                placeholder="Filter by user..."
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                data-testid="input-filter-user-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileId" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Profile ID
              </Label>
              <Input
                id="profileId"
                placeholder="Filter by profile..."
                value={filters.profileId}
                onChange={(e) => setFilters({ ...filters, profileId: e.target.value })}
                data-testid="input-filter-profile-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventType" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Event Type
              </Label>
              <Select
                value={filters.eventType}
                onValueChange={(value) => setFilters({ ...filters, eventType: value })}
              >
                <SelectTrigger id="eventType" data-testid="select-filter-event-type">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {eventTypesData?.eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatEventType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                data-testid="input-filter-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                data-testid="input-filter-end-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit" className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                Max Records
              </Label>
              <Select
                value={filters.limit}
                onValueChange={(value) => setFilters({ ...filters, limit: value })}
              >
                <SelectTrigger id="limit" data-testid="select-filter-limit">
                  <SelectValue placeholder="500" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1,000</SelectItem>
                  <SelectItem value="5000">5,000</SelectItem>
                  <SelectItem value="10000">10,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setFilters({
                userId: "",
                profileId: "",
                eventType: "",
                startDate: "",
                endDate: "",
                limit: "500",
              })}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Audit Logs
            </span>
            {data && (
              <Badge variant="secondary" data-testid="badge-log-count">
                {data.total.toLocaleString()} records
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Security audit trail for access, sharing, and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.logs?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found matching the current filters.</p>
              <p className="text-sm mt-2">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[150px]">Event Type</TableHead>
                    <TableHead className="w-[120px]">User ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <Collapsible key={log.id} asChild>
                      <>
                        <TableRow
                          className="cursor-pointer hover-elevate"
                          onClick={() => toggleRowExpanded(log.id)}
                          data-testid={`row-log-${log.id}`}
                        >
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {expandedRows.has(log.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEventTypeBadgeVariant(log.eventType)}>
                              {formatEventType(log.eventType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm truncate max-w-[120px]">
                            {log.userId}
                          </TableCell>
                          <TableCell className="truncate max-w-[300px]">
                            {log.description}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ipAddress}
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(log.id) && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/50">
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Full User Agent</Label>
                                    <p className="text-sm font-mono break-all">
                                      {log.userAgent || "Unknown"}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Log ID</Label>
                                    <p className="text-sm font-mono">{log.id}</p>
                                  </div>
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Metadata</Label>
                                    <pre className="text-sm font-mono bg-background p-2 rounded-md mt-1 overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">HIPAA Compliance</h4>
              <p className="text-muted-foreground">
                All access events are logged with timestamps, user IDs, and IP addresses per HIPAA requirements.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Data Retention</h4>
              <p className="text-muted-foreground">
                Audit logs are retained for 7 years (2,555 days) per healthcare compliance standards.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Export Formats</h4>
              <p className="text-muted-foreground">
                JSON for programmatic analysis, CSV for spreadsheet review and reporting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
