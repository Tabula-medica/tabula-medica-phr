import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  Eye,
  Download,
  Shield,
  AlertCircle,
  Clock,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  outcome: "success" | "failure" | "denied";
  details?: Record<string, unknown>;
  phiAccessed: boolean;
}

const actionTypes = [
  { value: "all", label: "All Actions" },
  { value: "view", label: "View Records" },
  { value: "export", label: "Export Data" },
  { value: "share", label: "Share Records" },
  { value: "update", label: "Update Records" },
  { value: "login", label: "Login/Logout" },
  { value: "consent", label: "Consent Changes" },
];

const resourceTypes = [
  { value: "all", label: "All Resources" },
  { value: "patient", label: "Patient" },
  { value: "observation", label: "Observations" },
  { value: "medication", label: "Medications" },
  { value: "encounter", label: "Encounters" },
  { value: "document", label: "Documents" },
  { value: "share_link", label: "Share Links" },
];

const outcomeStyles = {
  success: "bg-accent/50 text-accent-foreground",
  failure: "bg-destructive/10 text-destructive",
  denied: "bg-muted text-muted-foreground",
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7d");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit/logs", { action: actionFilter, resource: resourceFilter, range: dateRange, q: searchQuery }],
  });

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }),
    };
  };

  const getActionIcon = (action: string) => {
    if (action.includes("view") || action.includes("read")) return Eye;
    if (action.includes("export") || action.includes("download")) return Download;
    if (action.includes("login") || action.includes("auth")) return User;
    if (action.includes("share")) return ExternalLink;
    return Activity;
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const dateRangeLabel = dateRange === "24h" ? "Last 24 hours" : dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : "Last 90 days";
      const metadata = [
        `# Tabula Medica Audit Log Export`,
        `# Exported At: ${new Date().toISOString()}`,
        `# Filters Applied:`,
        `#   Action Type: ${actionFilter === "all" ? "All Actions" : actionFilter}`,
        `#   Resource Type: ${resourceFilter === "all" ? "All Resources" : resourceFilter}`,
        `#   Time Range: ${dateRangeLabel}`,
        `#   Search Query: ${searchQuery || "(none)"}`,
        `# Total Records: ${filteredLogs.length}`,
        ``
      ].join("\n");
      
      const headers = ["Timestamp", "Action", "Resource Type", "Resource ID", "User", "IP Address", "Outcome", "PHI Accessed"];
      const csvContent = [
        metadata,
        headers.join(","),
        ...filteredLogs.map(log => [
          `"${log.timestamp}"`,
          `"${log.action}"`,
          `"${log.resourceType}"`,
          `"${log.resourceId || ''}"`,
          `"${log.userName}"`,
          `"${log.ipAddress}"`,
          `"${log.outcome}"`,
          log.phiAccessed ? "Yes" : "No"
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `audit-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "Export Complete",
        description: `Exported ${filteredLogs.length} audit records to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export audit logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        filters: { actionFilter, resourceFilter, dateRange, searchQuery },
        totalRecords: filteredLogs.length,
        records: filteredLogs.map(log => ({
          ...log,
          details: log.details || {}
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `audit-report-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "Export Complete",
        description: `Exported ${filteredLogs.length} audit records to JSON.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export audit logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.resourceType.toLowerCase().includes(query) ||
        log.userName.toLowerCase().includes(query) ||
        log.ipAddress.includes(query)
      );
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-6" data-testid="page-audit-logs">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-title">
            Audit Logs
          </h1>
          <p className="text-muted-foreground">
            View all access and activity logs for compliance and security monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            HIPAA Compliant
          </Badge>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={exportToCSV}
            disabled={isExporting || filteredLogs.length === 0}
            data-testid="button-export-csv"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={exportToJSON}
            disabled={isExporting || filteredLogs.length === 0}
            data-testid="button-export-json"
          >
            <FileDown className="h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-6" data-testid="card-filters">
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="audit-logs-action-type">Action Type</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger id="audit-logs-action-type" data-testid="select-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-logs-resource-type">Resource Type</Label>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger id="audit-logs-resource-type" data-testid="select-resource">
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-logs-time-range">Time Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="audit-logs-time-range" data-testid="select-date-range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-logs">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${filteredLogs.length} entries found`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-export">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const { date, time } = formatTimestamp(log.timestamp);
                  const ActionIcon = getActionIcon(log.action);
                  
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-3 rounded-lg border hover-elevate cursor-pointer"
                      {...clickable(() => setSelectedLog(log))}
                      data-testid={`log-${log.id}`}
                    >
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <ActionIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{log.action}</span>
                            <Badge variant="outline" className="text-xs">
                              {log.resourceType}
                            </Badge>
                            {log.phiAccessed && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <AlertCircle className="h-3 w-3" />
                                PHI
                              </Badge>
                            )}
                          </div>
                          <Badge className={`text-xs ${outcomeStyles[log.outcome]}`}>
                            {log.outcome}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.userName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {date} at {time}
                          </span>
                          <span>{log.ipAddress}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Audit Log Details</SheetTitle>
          </SheetHeader>
          
          {selectedLog && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <FieldCaption className="text-muted-foreground text-xs">Action</FieldCaption>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldCaption className="text-muted-foreground text-xs">Resource Type</FieldCaption>
                    <p>{selectedLog.resourceType}</p>
                  </div>
                  <div>
                    <FieldCaption className="text-muted-foreground text-xs">Resource ID</FieldCaption>
                    <p className="font-mono text-sm">{selectedLog.resourceId || "N/A"}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <FieldCaption className="text-muted-foreground text-xs">Timestamp</FieldCaption>
                  <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                
                <div>
                  <FieldCaption className="text-muted-foreground text-xs">User</FieldCaption>
                  <p>{selectedLog.userName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedLog.userId}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldCaption className="text-muted-foreground text-xs">IP Address</FieldCaption>
                    <p className="font-mono text-sm">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <FieldCaption className="text-muted-foreground text-xs">Outcome</FieldCaption>
                    <Badge className={outcomeStyles[selectedLog.outcome]}>
                      {selectedLog.outcome}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <FieldCaption className="text-muted-foreground text-xs">User Agent</FieldCaption>
                  <p className="text-xs font-mono break-all">{selectedLog.userAgent}</p>
                </div>
                
                {selectedLog.phiAccessed && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="h-4 w-4" />
                      Protected Health Information Accessed
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This action accessed patient health information
                    </p>
                  </div>
                )}
                
                {selectedLog.details && (
                  <div>
                    <FieldCaption className="text-muted-foreground text-xs">Additional Details</FieldCaption>
                    <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
