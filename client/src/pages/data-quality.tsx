import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Database,
  RefreshCw,
  Eye,
  FileWarning,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DataQualitySummary {
  overview: {
    totalMembers: number;
    avgCompletenessScore: number;
    duplicateConflictRate: number;
    pendingConflicts: number;
    resolvedConflicts: number;
    totalDedupGroups: number;
  };
  syncDistribution: {
    last24h: number;
    last7d: number;
    last30d: number;
    older: number;
    never: number;
  };
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  topMissingFields: { field: string; count: number; percentage: number }[];
}

interface MemberScore {
  patientId: string;
  name: string;
  score: number;
  missingFields: string[];
  lastSync: string | null;
}

interface MemberDetails {
  patientId: string;
  name: string;
  overallScore: number;
  fieldDetails: { field: string; value: string | null; isComplete: boolean }[];
  recordCounts: { medications: number; vitals: number; labResults: number };
  lastSync: string | null;
  connectionStatus: string;
}

const SCORE_COLORS = {
  excellent: "#22c55e",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#ef4444",
};

const SYNC_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#6b7280"];

export default function DataQuality() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sortBy, setSortBy] = useState("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<DataQualitySummary>({
    queryKey: ["/api/data-quality/summary"],
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{
    members: MemberScore[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/data-quality/members", page, sortBy, sortOrder],
    queryFn: async () => {
      const response = await fetch(
        `/api/data-quality/members?page=${page}&limit=15&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
  });

  const { data: memberDetails, isLoading: detailsLoading } = useQuery<MemberDetails>({
    queryKey: ["/api/data-quality/members", selectedMember],
    queryFn: async () => {
      const response = await fetch(`/api/data-quality/members/${selectedMember}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch member details");
      return response.json();
    },
    enabled: !!selectedMember,
  });

  // Standard analytics context
  const getAnalyticsPayload = (event: string, extra?: Record<string, string>) => ({
    event,
    platform: "web" as const,
    appVersion: "1.0.0",
    source: "data_quality_dashboard",
    ...extra,
  });

  useEffect(() => {
    fetch("/api/data-quality/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(getAnalyticsPayload("dq_dashboard_opened")),
    }).catch(() => {});
  }, []);

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 90) return "default";
    if (score >= 70) return "secondary";
    if (score >= 50) return "outline";
    return "destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
  };

  const scoreChartData = summary ? [
    { name: "Excellent (90-100%)", value: summary.scoreDistribution.excellent, fill: SCORE_COLORS.excellent },
    { name: "Good (70-89%)", value: summary.scoreDistribution.good, fill: SCORE_COLORS.good },
    { name: "Fair (50-69%)", value: summary.scoreDistribution.fair, fill: SCORE_COLORS.fair },
    { name: "Poor (<50%)", value: summary.scoreDistribution.poor, fill: SCORE_COLORS.poor },
  ] : [];

  const syncChartData = summary ? [
    { name: "Last 24h", value: summary.syncDistribution.last24h },
    { name: "Last 7d", value: summary.syncDistribution.last7d },
    { name: "Last 30d", value: summary.syncDistribution.last30d },
    { name: "Older", value: summary.syncDistribution.older },
    { name: "Never", value: summary.syncDistribution.never },
  ] : [];

  const handleViewMember = (patientId: string) => {
    setSelectedMember(patientId);
    fetch("/api/data-quality/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(getAnalyticsPayload("dq_member_score_viewed", { patientId })),
    }).catch(() => {});
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-data-quality">
            <BarChart3 className="h-6 w-6 text-primary" />
            Data Quality Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Member-level completeness metrics for payer security review
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchSummary()}
          disabled={summaryLoading}
          data-testid="button-refresh-dq"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${summaryLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-members">
                {summary.overview.totalMembers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Patient records analyzed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completeness</CardTitle>
              {summary.overview.avgCompletenessScore >= 70 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-completeness">
                {summary.overview.avgCompletenessScore}%
              </div>
              <Progress 
                value={summary.overview.avgCompletenessScore} 
                className="mt-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duplicate Rate</CardTitle>
              <FileWarning className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-duplicate-rate">
                {summary.overview.duplicateConflictRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.overview.pendingConflicts} pending conflicts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dedup Groups</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-dedup-groups">
                {summary.overview.totalDedupGroups}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.overview.resolvedConflicts} conflicts resolved
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Member Scores</TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">Sync Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Score Distribution</CardTitle>
                <CardDescription>Member completeness score breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={scoreChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {scoreChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync Timestamp Distribution</CardTitle>
                <CardDescription>Last sync time for EHR connections</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={syncChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6">
                        {syncChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SYNC_COLORS[index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Missing Fields</CardTitle>
              <CardDescription>Most common incomplete data fields across members</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-40" />
              ) : summary?.topMissingFields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>All required fields are complete across members</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.topMissingFields.map((field) => (
                    <div key={field.field} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize font-medium">{field.field.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-muted-foreground">{field.count} members ({field.percentage}%)</span>
                      </div>
                      <Progress value={field.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Member Completeness Scores</span>
                {membersData && (
                  <Badge variant="secondary">
                    {membersData.pagination.total} total
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Individual member data quality metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => toggleSort("name")}
                          >
                            <span className="flex items-center gap-1">
                              Member Name
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => toggleSort("score")}
                          >
                            <span className="flex items-center gap-1">
                              Score
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </TableHead>
                          <TableHead>Missing Fields</TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => toggleSort("lastSync")}
                          >
                            <span className="flex items-center gap-1">
                              Last Sync
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membersData?.members.map((member) => (
                          <TableRow key={member.patientId} data-testid={`row-member-${member.patientId}`}>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            <TableCell>
                              <Badge variant={getScoreBadgeVariant(member.score)}>
                                {member.score}% - {getScoreLabel(member.score)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {member.missingFields.length === 0 ? (
                                <span className="text-green-600 text-sm">Complete</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {member.missingFields.join(", ")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {member.lastSync ? (
                                <span className="text-sm flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(member.lastSync), { addSuffix: true })}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewMember(member.patientId)}
                                data-testid={`button-view-member-${member.patientId}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {membersData && membersData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {membersData.pagination.page} of {membersData.pagination.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page - 1)}
                          disabled={page <= 1}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page + 1)}
                          disabled={page >= membersData.pagination.totalPages}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sync Status by Connection</CardTitle>
              <CardDescription>EHR connection sync timestamps and status</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-60" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{summary?.syncDistribution.last24h || 0}</div>
                      <p className="text-sm text-muted-foreground">Last 24 hours</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{summary?.syncDistribution.last7d || 0}</div>
                      <p className="text-sm text-muted-foreground">Last 7 days</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">{summary?.syncDistribution.last30d || 0}</div>
                      <p className="text-sm text-muted-foreground">Last 30 days</p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{summary?.syncDistribution.older || 0}</div>
                      <p className="text-sm text-muted-foreground">Older than 30d</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">{summary?.syncDistribution.never || 0}</div>
                      <p className="text-sm text-muted-foreground">Never synced</p>
                    </div>
                  </div>
                  
                  {(summary?.syncDistribution.older || 0) + (summary?.syncDistribution.never || 0) > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Stale Data Warning</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {(summary?.syncDistribution.older || 0) + (summary?.syncDistribution.never || 0)} connections 
                          have not synced recently. This may affect data quality scores.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Data Quality Details</DialogTitle>
            <DialogDescription>
              Detailed completeness analysis for {memberDetails?.name}
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
            </div>
          ) : memberDetails && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-3xl font-bold">{memberDetails.overallScore}%</span>
                    <Badge variant={getScoreBadgeVariant(memberDetails.overallScore)}>
                      {getScoreLabel(memberDetails.overallScore)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Connection Status</p>
                  <Badge variant={memberDetails.connectionStatus === "connected" ? "default" : "secondary"}>
                    {memberDetails.connectionStatus}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Field Completeness</h4>
                <div className="grid grid-cols-2 gap-3">
                  {memberDetails.fieldDetails.map((field) => (
                    <div 
                      key={field.field}
                      className={`p-3 rounded-lg border ${
                        field.isComplete 
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" 
                          : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {field.field.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        {field.isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.isComplete ? "Complete" : "Missing"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Associated Records</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-2xl font-bold">{memberDetails.recordCounts.medications}</div>
                    <p className="text-xs text-muted-foreground">Medications</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-2xl font-bold">{memberDetails.recordCounts.vitals}</div>
                    <p className="text-xs text-muted-foreground">Vitals</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-2xl font-bold">{memberDetails.recordCounts.labResults}</div>
                    <p className="text-xs text-muted-foreground">Lab Results</p>
                  </div>
                </div>
              </div>

              {memberDetails.lastSync && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last synced: {format(new Date(memberDetails.lastSync), "PPpp")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
