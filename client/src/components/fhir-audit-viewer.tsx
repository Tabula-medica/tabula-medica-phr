import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  Search, 
  Filter,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Download,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3
} from "lucide-react";

interface FhirAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  userName?: string;
  action: string;
  outcome: string;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  fhirVersion: string;
  operationType: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  responseStatus: number;
  responseTimeMs: number;
  errorMessage?: string;
  phiAccessed: boolean;
  accessReason?: string;
  sourceSystem?: string;
  bundleSize?: number;
  affectedResources?: string[];
  metadata?: Record<string, any>;
}

interface AuditStatistics {
  totalEntries: number;
  byAction: Record<string, number>;
  byOutcome: Record<string, number>;
  byResourceType: Record<string, number>;
  byUserRole: Record<string, number>;
  byFhirVersion: Record<string, number>;
  averageResponseTime: number;
  phiAccessCount: number;
  errorCount: number;
  timeRange: { start: string; end: string };
}

interface AuditMetadata {
  resourceTypes: string[];
  userRoles: string[];
  actions: string[];
  outcomes: string[];
}

export function FhirAuditViewer() {
  const [activeTab, setActiveTab] = useState("logs");
  const [selectedEntry, setSelectedEntry] = useState<FhirAuditEntry | null>(null);
  const [filters, setFilters] = useState({
    action: "",
    outcome: "",
    resourceType: "",
    userRole: "",
    fhirVersion: "",
    phiAccessed: "",
    startDate: "",
    endDate: "",
    searchQuery: "",
  });
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: metadata, isLoading: loadingMetadata } = useQuery<AuditMetadata>({
    queryKey: ["/api/fhir-audit/metadata"],
  });

  const { data: auditData, isLoading: loadingEntries, refetch } = useQuery<{
    entries: FhirAuditEntry[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/fhir-audit/entries", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.action) params.append("action", filters.action);
      if (filters.outcome) params.append("outcome", filters.outcome);
      if (filters.resourceType) params.append("resourceType", filters.resourceType);
      if (filters.userRole) params.append("userRole", filters.userRole);
      if (filters.fhirVersion) params.append("fhirVersion", filters.fhirVersion);
      if (filters.phiAccessed) params.append("phiAccessed", filters.phiAccessed);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("limit", limit.toString());
      params.append("offset", (page * limit).toString());
      
      const res = await fetch(`/api/fhir-audit/entries?${params}`);
      return res.json();
    },
  });

  const { data: statistics, isLoading: loadingStats } = useQuery<AuditStatistics>({
    queryKey: ["/api/fhir-audit/statistics"],
  });

  const { data: dailySummary } = useQuery<any[]>({
    queryKey: ["/api/fhir-audit/summary/daily"],
  });

  const clearFilters = () => {
    setFilters({
      action: "",
      outcome: "",
      resourceType: "",
      userRole: "",
      fhirVersion: "",
      phiAccessed: "",
      startDate: "",
      endDate: "",
      searchQuery: "",
    });
    setPage(0);
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "success":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case "failure":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "partial":
        return <Badge variant="secondary" className="bg-yellow-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      read: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      search: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      export: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      import: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      validate: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      transform: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    };
    return <Badge className={colors[action] || ""}>{action.toUpperCase()}</Badge>;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 100) return <span className="text-green-600">{ms}ms</span>;
    if (ms < 500) return <span className="text-yellow-600">{ms}ms</span>;
    return <span className="text-red-600">{ms}ms</span>;
  };

  if (loadingMetadata) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            FHIR Audit Logs
          </h2>
          <p className="text-muted-foreground">
            Monitor and review all FHIR operations for compliance and security
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="btn-refresh-logs">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Operations</p>
                <p className="text-2xl font-bold">{statistics?.totalEntries || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {statistics ? Math.round((statistics.byOutcome.success / statistics.totalEntries) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">PHI Accesses</p>
                <p className="text-2xl font-bold">{statistics?.phiAccessCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{statistics?.averageResponseTime || 0}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs" data-testid="tab-audit-logs">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-audit-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-audit-compliance">
            <Shield className="h-4 w-4 mr-2" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs">Action</Label>
                  <Select 
                    value={filters.action} 
                    onValueChange={(v) => setFilters(p => ({ ...p, action: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-action">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {metadata?.actions.map(a => (
                        <SelectItem key={a} value={a}>{a.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Outcome</Label>
                  <Select 
                    value={filters.outcome} 
                    onValueChange={(v) => setFilters(p => ({ ...p, outcome: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-outcome">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outcomes</SelectItem>
                      {metadata?.outcomes.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Resource Type</Label>
                  <Select 
                    value={filters.resourceType} 
                    onValueChange={(v) => setFilters(p => ({ ...p, resourceType: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-resource">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      {metadata?.resourceTypes.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">User Role</Label>
                  <Select 
                    value={filters.userRole} 
                    onValueChange={(v) => setFilters(p => ({ ...p, userRole: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-role">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {metadata?.userRoles.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">FHIR Version</Label>
                  <Select 
                    value={filters.fhirVersion} 
                    onValueChange={(v) => setFilters(p => ({ ...p, fhirVersion: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-version">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Versions</SelectItem>
                      <SelectItem value="R4">FHIR R4</SelectItem>
                      <SelectItem value="R5">FHIR R5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">PHI Access</Label>
                  <Select 
                    value={filters.phiAccessed} 
                    onValueChange={(v) => setFilters(p => ({ ...p, phiAccessed: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger data-testid="select-filter-phi">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">PHI Accessed</SelectItem>
                      <SelectItem value="false">No PHI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={filters.startDate}
                    onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))}
                    className="w-40"
                    data-testid="input-date-start"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input 
                    type="date" 
                    value={filters.endDate}
                    onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))}
                    className="w-40"
                    data-testid="input-date-end"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters} data-testid="btn-clear-filters">
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log Table */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Audit Entries
                  {auditData && <span className="text-muted-foreground font-normal ml-2">({auditData.total} total)</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    data-testid="btn-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={!auditData?.hasMore}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="btn-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingEntries ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>PHI</TableHead>
                        <TableHead className="w-[80px]">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData?.entries.map(entry => (
                        <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(entry.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{entry.userName || entry.userId}</span>
                              <span className="text-xs text-muted-foreground">{entry.userRole}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getActionBadge(entry.action)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{entry.resourceType}</span>
                              {entry.resourceId && (
                                <span className="text-xs text-muted-foreground font-mono">{entry.resourceId}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getOutcomeBadge(entry.outcome)}</TableCell>
                          <TableCell>{formatResponseTime(entry.responseTimeMs)}</TableCell>
                          <TableCell>
                            {entry.phiAccessed ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                                <Shield className="w-3 h-3 mr-1" />PHI
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedEntry(entry)}
                              data-testid={`btn-view-entry-${entry.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {auditData?.entries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No audit entries found matching the current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Action */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operations by Action</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statistics && Object.entries(statistics.byAction)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        {getActionBadge(action)}
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${(count / statistics.totalEntries) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* By Resource Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operations by Resource</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statistics && Object.entries(statistics.byResourceType)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([resource, count]) => (
                      <div key={resource} className="flex items-center justify-between">
                        <Badge variant="outline">{resource}</Badge>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${(count / statistics.totalEntries) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* By User Role */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operations by User Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statistics && Object.entries(statistics.byUserRole)
                    .sort((a, b) => b[1] - a[1])
                    .map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize">{role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${(count / statistics.totalEntries) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  7-Day Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dailySummary?.slice(0, 7).map((day: any) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm">{new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">{day.totalOperations} ops</span>
                        <Badge variant={day.successRate >= 95 ? "default" : day.successRate >= 80 ? "secondary" : "destructive"}>
                          {day.successRate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HIPAA Compliance Summary</CardTitle>
              <CardDescription>
                Overview of PHI access patterns and compliance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium">PHI Access Statistics</h4>
                  <div className="text-3xl font-bold text-purple-600">
                    {statistics?.phiAccessCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total PHI accesses in period
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Error Rate</h4>
                  <div className="text-3xl font-bold text-red-600">
                    {statistics ? Math.round((statistics.errorCount / statistics.totalEntries) * 100) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {statistics?.errorCount || 0} failed operations
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">FHIR Version Distribution</h4>
                  <div className="flex gap-4">
                    {statistics && Object.entries(statistics.byFhirVersion).map(([version, count]) => (
                      <div key={version} className="text-center">
                        <div className="text-2xl font-bold">{count}</div>
                        <Badge variant="outline">{version}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Trail Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "PHI Tracking", enabled: true },
                  { label: "Real-time Logging", enabled: true },
                  { label: "User Attribution", enabled: true },
                  { label: "Access Reasons", enabled: true },
                  { label: "IP Tracking", enabled: true },
                  { label: "Response Timing", enabled: true },
                  { label: "Error Logging", enabled: true },
                  { label: "Export Support", enabled: true },
                ].map((feature) => (
                  <div key={feature.label} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
            <DialogDescription>
              Complete information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Entry ID</Label>
                  <p className="font-mono text-sm">{selectedEntry.id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <p className="text-sm">{formatTimestamp(selectedEntry.timestamp)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <p className="text-sm font-medium">{selectedEntry.userName || selectedEntry.userId}</p>
                  <Badge variant="outline" className="mt-1">{selectedEntry.userRole}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Action & Outcome</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getActionBadge(selectedEntry.action)}
                    {getOutcomeBadge(selectedEntry.outcome)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Resource</Label>
                  <p className="text-sm font-medium">{selectedEntry.resourceType}</p>
                  {selectedEntry.resourceId && (
                    <p className="font-mono text-xs text-muted-foreground">{selectedEntry.resourceId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">FHIR Version</Label>
                  <Badge>{selectedEntry.fhirVersion}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Request Path</Label>
                  <p className="font-mono text-xs">{selectedEntry.requestPath}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <Badge variant="outline">{selectedEntry.requestMethod}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status Code</Label>
                  <p className={`text-lg font-bold ${selectedEntry.responseStatus < 400 ? "text-green-600" : "text-red-600"}`}>
                    {selectedEntry.responseStatus}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Response Time</Label>
                  <p className="text-lg font-bold">{selectedEntry.responseTimeMs}ms</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PHI Accessed</Label>
                  <p className="text-lg font-bold">{selectedEntry.phiAccessed ? "Yes" : "No"}</p>
                </div>
              </div>

              {selectedEntry.patientId && (
                <div>
                  <Label className="text-xs text-muted-foreground">Patient ID</Label>
                  <p className="font-mono text-sm">{selectedEntry.patientId}</p>
                </div>
              )}

              {selectedEntry.accessReason && (
                <div>
                  <Label className="text-xs text-muted-foreground">Access Reason</Label>
                  <p className="text-sm">{selectedEntry.accessReason}</p>
                </div>
              )}

              {selectedEntry.errorMessage && (
                <div>
                  <Label className="text-xs text-muted-foreground">Error Message</Label>
                  <p className="text-sm text-red-600">{selectedEntry.errorMessage}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">IP Address</Label>
                  <p className="font-mono text-xs">{selectedEntry.ipAddress}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">User Agent</Label>
                  <p className="text-xs truncate">{selectedEntry.userAgent}</p>
                </div>
              </div>

              {selectedEntry.sourceSystem && (
                <div>
                  <Label className="text-xs text-muted-foreground">Source System</Label>
                  <p className="text-sm">{selectedEntry.sourceSystem}</p>
                </div>
              )}

              {selectedEntry.affectedResources && selectedEntry.affectedResources.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Affected Resources</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedEntry.affectedResources.map(r => (
                      <Badge key={r} variant="outline">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
