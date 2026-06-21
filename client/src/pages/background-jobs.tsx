import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  PlayCircle, 
  PauseCircle, 
  XCircle, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Skull, 
  Timer,
  Activity,
  TrendingUp,
  ArrowRight,
  Trash2,
  RotateCcw,
  Loader2,
  Server,
  Zap
} from "lucide-react";

interface BackgroundJob {
  id: string;
  type: string;
  priority: string;
  status: string;
  payload: {
    patientId: string;
    userId: string;
    sourceName?: string;
    sourceType?: string;
  };
  result?: {
    recordsProcessed: number;
    recordsImported: number;
    warnings: string[];
  };
  error?: {
    code: string;
    message: string;
    category: string;
    retryable: boolean;
  };
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
}

interface JobStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  deadJobs: number;
  retryingJobs: number;
  averageProcessingTimeMs: number;
  successRate: number;
  jobsByType: { type: string; count: number }[];
  recentErrors: { code: string; message: string; category: string }[];
  throughputPerMinute: number;
}

interface JobQueue {
  id: string;
  name: string;
  concurrency: number;
  rateLimitPerMinute: number;
  activeJobs: number;
  pendingJobs: number;
  isPaused: boolean;
}

interface DeadLetterEntry {
  id: string;
  job: BackgroundJob;
  failureReason: string;
  lastError: { code: string; message: string };
  movedAt: string;
  canRetry: boolean;
}

export default function BackgroundJobsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null);

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ data: BackgroundJob[]; total: number }>({
    queryKey: ["/api/background-jobs/jobs", statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      const url = `/api/background-jobs/jobs${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{ data: JobStats }>({
    queryKey: ["/api/background-jobs/stats"],
    refetchInterval: 5000,
  });

  const { data: queuesData } = useQuery<{ data: JobQueue[] }>({
    queryKey: ["/api/background-jobs/queues"],
    refetchInterval: 10000,
  });

  const { data: deadLetterData } = useQuery<{ data: DeadLetterEntry[] }>({
    queryKey: ["/api/background-jobs/dead-letter"],
    refetchInterval: 10000,
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/background-jobs/jobs/${jobId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/stats"] });
      toast({ title: "Job Cancelled", description: "The job has been cancelled" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel job", variant: "destructive" });
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/background-jobs/jobs/${jobId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/stats"] });
      toast({ title: "Job Retried", description: "The job has been queued for retry" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to retry job", variant: "destructive" });
    },
  });

  const pauseQueueMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await apiRequest("POST", `/api/background-jobs/queues/${queueId}/pause`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/queues"] });
      toast({ title: "Queue Paused", description: "The queue has been paused" });
    },
  });

  const resumeQueueMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await apiRequest("POST", `/api/background-jobs/queues/${queueId}/resume`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/queues"] });
      toast({ title: "Queue Resumed", description: "The queue has been resumed" });
    },
  });

  const retryDeadLetterMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", `/api/background-jobs/dead-letter/${entryId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/dead-letter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/jobs"] });
      toast({ title: "Job Recovered", description: "Job has been moved back to the queue" });
    },
  });

  const purgeDeadLetterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/background-jobs/dead-letter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/dead-letter"] });
      toast({ title: "Queue Purged", description: "Dead letter queue has been cleared" });
    },
  });

  const stats = statsData?.data;
  const jobs = jobsData?.data || [];
  const queues = queuesData?.data || [];
  const deadLetterEntries = deadLetterData?.data || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "retrying": return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "dead": return <Skull className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      running: "default",
      completed: "default",
      failed: "destructive",
      retrying: "secondary",
      dead: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return <Badge className={colors[priority] || colors.normal}>{priority}</Badge>;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  if (statsLoading || jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="background-jobs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Background Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage health data sync jobs</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/jobs", statusFilter, typeFilter] });
            queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/queues"] });
            queryClient.invalidateQueries({ queryKey: ["/api/background-jobs/dead-letter"] });
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stats-total">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-jobs">{stats.totalJobs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.runningJobs} running, {stats.pendingJobs} pending
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-success">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-success-rate">
                {stats.successRate.toFixed(1)}%
              </div>
              <Progress value={stats.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-stats-throughput">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Throughput</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-throughput">
                {stats.throughputPerMinute}/min
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatDuration(stats.averageProcessingTimeMs)}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-failed">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-failed-jobs">
                {stats.failedJobs}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.deadJobs} in dead letter queue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList data-testid="tabs-navigation">
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="queues" data-testid="tab-queues">
            Queues ({queues.length})
          </TabsTrigger>
          <TabsTrigger value="dead-letter" data-testid="tab-dead-letter">
            Dead Letter ({deadLetterEntries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Job Queue</CardTitle>
                <CardDescription>All background jobs with their current status</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="retrying">Retrying</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="health_data_sync">Health Data Sync</SelectItem>
                    <SelectItem value="fhir_import">FHIR Import</SelectItem>
                    <SelectItem value="medication_sync">Medication Sync</SelectItem>
                    <SelectItem value="lab_results_sync">Lab Results Sync</SelectItem>
                    <SelectItem value="wearable_sync">Wearable Sync</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            {getStatusBadge(job.status)}
                          </div>
                        </TableCell>
                        <TableCell>{formatTypeLabel(job.type)}</TableCell>
                        <TableCell>{getPriorityBadge(job.priority)}</TableCell>
                        <TableCell>{job.payload.sourceName || "-"}</TableCell>
                        <TableCell>
                          {job.retryCount > 0 ? (
                            <Badge variant="outline">{job.retryCount}/{job.maxRetries}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{formatDuration(job.processingTimeMs)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedJob(job)}
                                  data-testid={`button-view-job-${job.id}`}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Job Details</DialogTitle>
                                  <DialogDescription>ID: {job.id}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">Status</label>
                                      <div className="flex items-center gap-2 mt-1">
                                        {getStatusIcon(job.status)}
                                        {getStatusBadge(job.status)}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Type</label>
                                      <p className="mt-1">{formatTypeLabel(job.type)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Source</label>
                                      <p className="mt-1">{job.payload.sourceName || "N/A"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Processing Time</label>
                                      <p className="mt-1">{formatDuration(job.processingTimeMs)}</p>
                                    </div>
                                  </div>

                                  {job.result && (
                                    <>
                                      <Separator />
                                      <div>
                                        <label className="text-sm font-medium">Result</label>
                                        <div className="mt-2 grid grid-cols-3 gap-4">
                                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-green-600">{job.result.recordsImported}</p>
                                            <p className="text-xs text-muted-foreground">Imported</p>
                                          </div>
                                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-blue-600">{job.result.recordsProcessed}</p>
                                            <p className="text-xs text-muted-foreground">Processed</p>
                                          </div>
                                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-yellow-600">{job.result.warnings.length}</p>
                                            <p className="text-xs text-muted-foreground">Warnings</p>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {job.error && (
                                    <>
                                      <Separator />
                                      <div>
                                        <label className="text-sm font-medium text-red-600">Error</label>
                                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                          <p className="font-mono text-sm">{job.error.code}</p>
                                          <p className="text-sm text-muted-foreground mt-1">{job.error.message}</p>
                                          <div className="flex gap-2 mt-2">
                                            <Badge variant="outline">{job.error.category}</Badge>
                                            {job.error.retryable && <Badge variant="secondary">Retryable</Badge>}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <DialogFooter>
                                  {(job.status === "failed" || job.status === "dead") && (
                                    <Button
                                      onClick={() => retryJobMutation.mutate(job.id)}
                                      disabled={retryJobMutation.isPending}
                                      data-testid="button-retry-job-dialog"
                                    >
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Retry Job
                                    </Button>
                                  )}
                                  {(job.status === "pending" || job.status === "retrying") && (
                                    <Button
                                      variant="destructive"
                                      onClick={() => cancelJobMutation.mutate(job.id)}
                                      disabled={cancelJobMutation.isPending}
                                      data-testid="button-cancel-job-dialog"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel Job
                                    </Button>
                                  )}
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            {(job.status === "failed" || job.status === "dead") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => retryJobMutation.mutate(job.id)}
                                disabled={retryJobMutation.isPending}
                                data-testid={`button-retry-job-${job.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            {(job.status === "pending" || job.status === "retrying") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelJobMutation.mutate(job.id)}
                                disabled={cancelJobMutation.isPending}
                                data-testid={`button-cancel-job-${job.id}`}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {jobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No jobs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {queues.map((queue) => (
              <Card key={queue.id} data-testid={`card-queue-${queue.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      {queue.name}
                    </CardTitle>
                    <CardDescription>
                      Concurrency: {queue.concurrency} | Rate: {queue.rateLimitPerMinute}/min
                    </CardDescription>
                  </div>
                  <Badge variant={queue.isPaused ? "secondary" : "default"}>
                    {queue.isPaused ? "Paused" : "Active"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-2xl font-bold">{queue.activeJobs}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-2xl font-bold">{queue.pendingJobs}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {queue.isPaused ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => resumeQueueMutation.mutate(queue.id)}
                        disabled={resumeQueueMutation.isPending}
                        data-testid={`button-resume-queue-${queue.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => pauseQueueMutation.mutate(queue.id)}
                        disabled={pauseQueueMutation.isPending}
                        data-testid={`button-pause-queue-${queue.id}`}
                      >
                        <PauseCircle className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="dead-letter" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Skull className="h-5 w-5" />
                  Dead Letter Queue
                </CardTitle>
                <CardDescription>
                  Jobs that have exceeded their retry limits
                </CardDescription>
              </div>
              {deadLetterEntries.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => purgeDeadLetterMutation.mutate()}
                  disabled={purgeDeadLetterMutation.isPending}
                  data-testid="button-purge-dead-letter"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purge All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Failure Reason</TableHead>
                      <TableHead>Last Error</TableHead>
                      <TableHead>Moved At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadLetterEntries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-dead-letter-${entry.id}`}>
                        <TableCell>{formatTypeLabel(entry.job.type)}</TableCell>
                        <TableCell>{entry.failureReason}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-mono text-xs">{entry.lastError.code}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.lastError.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.movedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {entry.canRetry && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryDeadLetterMutation.mutate(entry.id)}
                              disabled={retryDeadLetterMutation.isPending}
                              data-testid={`button-retry-dead-letter-${entry.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {deadLetterEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No dead letter entries
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
