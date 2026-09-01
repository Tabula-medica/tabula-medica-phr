import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Database,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
  Plus,
  Table,
  FileText,
  Settings,
  BarChart3,
  Download,
  Layers,
  Cpu,
  Shield,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BigQueryTableSchema {
  tableName: string;
  description: string;
  fields: Array<{
    name: string;
    type: string;
    mode: string;
    description?: string;
  }>;
}

interface DataWarehouseJob {
  jobId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  tables?: string[];
  recordsProcessed?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface ScheduledExport {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  exportType: string;
  tables: string[];
  deIdentify: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

function getStatusBadge(status: DataWarehouseJob["status"]) {
  switch (status) {
    case "completed":
      return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />{status}</Badge>;
    case "running":
      return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />{status}</Badge>;
    case "pending":
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
    case "failed":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "schema_creation":
      return <Database className="w-4 h-4" />;
    case "full_export":
      return <Download className="w-4 h-4" />;
    case "incremental_export":
      return <RefreshCw className="w-4 h-4" />;
    case "transformation":
      return <Cpu className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SchemasTab() {
  const { data: schemasData, isLoading, isError, refetch } = useQuery<{
    schemas: BigQueryTableSchema[];
    totalTables: number;
    categories: Record<string, number>;
  }>({
    queryKey: ["/api/warehouse/schemas"],
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/warehouse/schemas/initialize");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/jobs"] });
    },
  });

  const { toast } = useToast();

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <Card className="border-destructive" data-testid="error-schemas">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive opacity-50" />
          <p className="text-destructive font-medium">Failed to load schemas</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4" data-testid="button-retry-schemas">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const schemas = schemasData?.schemas || [];
  const categories = schemasData?.categories || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-stat-dimensions">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{categories.dimensions || 0}</p>
                <p className="text-xs text-muted-foreground">Dimensions</p>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-facts">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{categories.facts || 0}</p>
                <p className="text-xs text-muted-foreground">Facts</p>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-aggregates">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{categories.aggregates || 0}</p>
                <p className="text-xs text-muted-foreground">Aggregates</p>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-ml">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{categories.ml || 0}</p>
                <p className="text-xs text-muted-foreground">ML Features</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Button
          onClick={() => {
            initMutation.mutate();
            toast({ title: "Initializing schemas", description: "Creating BigQuery tables..." });
          }}
          disabled={initMutation.isPending}
          data-testid="button-init-schemas"
        >
          {initMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Database className="w-4 h-4 mr-2" />
          )}
          Initialize Schemas
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {schemas.map((schema) => (
          <AccordionItem key={schema.tableName} value={schema.tableName} className="border rounded-lg px-4" data-testid={`schema-${schema.tableName}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Table className="w-4 h-4 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{schema.tableName}</p>
                  <p className="text-xs text-muted-foreground">{schema.fields.length} columns</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground mb-4">{schema.description}</p>
              <ScrollArea className="h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Column</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Mode</th>
                      <th className="text-left p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.fields.map((field) => (
                      <tr key={field.name} className="border-b border-muted">
                        <td className="p-2 font-mono text-xs">{field.name}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">{field.type}</Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{field.mode}</td>
                        <td className="p-2 text-xs text-muted-foreground">{field.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function ExportsTab() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<"full" | "incremental">("full");
  const [deIdentify, setDeIdentify] = useState(true);
  const { toast } = useToast();

  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: DataWarehouseJob[] }>({
    queryKey: ["/api/warehouse/jobs"],
  });

  const fullExportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/warehouse/export/full", { deIdentify });
      return response.json();
    },
    onSuccess: () => {
      setExportDialogOpen(false);
      refetch();
      toast({ title: "Export started", description: "Full export job has been queued" });
    },
    onError: (error: any) => {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    },
  });

  const incrementalExportMutation = useMutation({
    mutationFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response = await apiRequest("POST", "/api/warehouse/export/incremental", { since, deIdentify });
      return response.json();
    },
    onSuccess: () => {
      setExportDialogOpen(false);
      refetch();
      toast({ title: "Export started", description: "Incremental export job has been queued" });
    },
    onError: (error: any) => {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingState />;

  const jobs = jobsData?.jobs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" data-testid="text-job-count">
          {jobs.length} export job(s)
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-jobs">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-export">
                <Plus className="w-4 h-4 mr-2" />
                New Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Data Export</DialogTitle>
                <DialogDescription>
                  Export de-identified FHIR data to the BigQuery data warehouse.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="data-warehouse-export-type">Export Type</Label>
                  <Select value={exportType} onValueChange={(v) => setExportType(v as "full" | "incremental")}>
                    <SelectTrigger id="data-warehouse-export-type" data-testid="select-export-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Export</SelectItem>
                      <SelectItem value="incremental">Incremental (Last 24h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FieldCaption>De-identify Data</FieldCaption>
                    <p className="text-xs text-muted-foreground">HIPAA-compliant de-identification</p>
                  </div>
                  <Switch checked={deIdentify} onCheckedChange={setDeIdentify} data-testid="switch-deidentify" />
                </div>
                {!deIdentify && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-destructive mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">PHI Export Warning</p>
                        <p className="text-xs text-muted-foreground">
                          Exporting without de-identification includes protected health information. Ensure proper authorization.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExportDialogOpen(false)} data-testid="button-cancel-export">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (exportType === "full") {
                      fullExportMutation.mutate();
                    } else {
                      incrementalExportMutation.mutate();
                    }
                  }}
                  disabled={fullExportMutation.isPending || incrementalExportMutation.isPending}
                  data-testid="button-confirm-export"
                >
                  {(fullExportMutation.isPending || incrementalExportMutation.isPending) ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Start Export
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-jobs">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No export jobs yet</p>
          <p className="text-sm mt-2">Start a new export to populate the data warehouse</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.jobId} data-testid={`card-job-${job.jobId}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {getTypeIcon(job.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{job.type.replace(/_/g, " ")}</p>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(parseISO(job.createdAt))} ago</span>
                        {job.recordsProcessed !== undefined && (
                          <span>{job.recordsProcessed.toLocaleString()} records</span>
                        )}
                        {job.completedAt && job.startedAt && (
                          <span>
                            {Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s
                          </span>
                        )}
                      </div>
                      {job.error && (
                        <p className="text-xs text-destructive mt-2">{job.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedulesTab() {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("02:00");
  const [exportType, setExportType] = useState<"full" | "incremental">("incremental");
  const [deIdentify, setDeIdentify] = useState(true);
  const { toast } = useToast();

  const { data: schedulesData, isLoading, refetch } = useQuery<{ schedules: ScheduledExport[] }>({
    queryKey: ["/api/warehouse/schedules"],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/warehouse/schedules", {
        name,
        schedule,
        exportType,
        deIdentify,
        tables: [],
      });
      return response.json();
    },
    onSuccess: () => {
      setScheduleDialogOpen(false);
      setName("");
      refetch();
      toast({ title: "Schedule created", description: "Automated export schedule has been created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create schedule", description: error.message, variant: "destructive" });
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/warehouse/schedules/${id}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/warehouse/schedules/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Schedule deleted" });
    },
  });

  if (isLoading) return <LoadingState />;

  const schedules = schedulesData?.schedules || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" data-testid="text-schedule-count">
          {schedules.length} scheduled export(s)
        </p>
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-schedule">
              <Plus className="w-4 h-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Export Schedule</DialogTitle>
              <DialogDescription>
                Set up automated data exports to the data warehouse.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="data-warehouse-schedule-name">Schedule Name</Label>
                <Input id="data-warehouse-schedule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Daily incremental export"
                  data-testid="input-schedule-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-warehouse-run-time-24h-format">Run Time (24h format)</Label>
                <Input id="data-warehouse-run-time-24h-format"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="02:00"
                  data-testid="input-schedule-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-warehouse-export-type-2">Export Type</Label>
                <Select value={exportType} onValueChange={(v) => setExportType(v as "full" | "incremental")}>
                  <SelectTrigger id="data-warehouse-export-type-2" data-testid="select-schedule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Export</SelectItem>
                    <SelectItem value="incremental">Incremental Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="data-warehouse-de-identify-data">De-identify Data</Label>
                <Switch id="data-warehouse-de-identify-data" checked={deIdentify} onCheckedChange={setDeIdentify} data-testid="switch-schedule-deidentify" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} data-testid="button-cancel-schedule">
                Cancel
              </Button>
              <Button
                onClick={() => createScheduleMutation.mutate()}
                disabled={createScheduleMutation.isPending || !name.trim()}
                data-testid="button-confirm-schedule"
              >
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-schedules">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No scheduled exports</p>
          <p className="text-sm mt-2">Create a schedule to automate data exports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((sched) => (
            <Card key={sched.id} data-testid={`card-schedule-${sched.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{sched.name}</p>
                        <Badge variant={sched.enabled ? "default" : "secondary"}>
                          {sched.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Badge variant="outline">{sched.exportType}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Runs daily at {sched.schedule}</span>
                        {sched.lastRun && (
                          <span>Last run: {formatDistanceToNow(parseISO(sched.lastRun))} ago</span>
                        )}
                        {sched.nextRun && (
                          <span>Next: {format(parseISO(sched.nextRun), "MMM d, h:mm a")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sched.enabled}
                      onCheckedChange={(enabled) => toggleScheduleMutation.mutate({ id: sched.id, enabled })}
                      data-testid={`switch-toggle-${sched.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteScheduleMutation.mutate(sched.id)}
                      data-testid={`button-delete-${sched.id}`}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const { data: dashboard, isLoading } = useQuery<{
    populationHealth: {
      totalPatients: number;
      activePatients: number;
      avgAge: number;
      preventiveCareCompliance: number;
      vaccinationCoverage: number;
      averageRiskScore: number;
    };
    operationalMetrics: {
      totalEncounters: number;
      avgEncounterDuration: number;
      readmissionRate30Day: number;
      avgLengthOfStay: number;
    };
  }>({
    queryKey: ["/api/warehouse/analytics/dashboard"],
  });

  if (isLoading) return <LoadingState />;

  const pop = dashboard?.populationHealth;
  const ops = dashboard?.operationalMetrics;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Population Health Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card data-testid="card-total-patients">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.totalPatients || 0}</p>
              <p className="text-sm text-muted-foreground">Total Patients</p>
            </CardContent>
          </Card>
          <Card data-testid="card-active-patients">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.activePatients || 0}</p>
              <p className="text-sm text-muted-foreground">Active Patients</p>
            </CardContent>
          </Card>
          <Card data-testid="card-avg-age">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.avgAge?.toFixed(1) || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Average Age</p>
            </CardContent>
          </Card>
          <Card data-testid="card-preventive-care">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.preventiveCareCompliance ? `${(pop.preventiveCareCompliance * 100).toFixed(0)}%` : "N/A"}</p>
              <p className="text-sm text-muted-foreground">Preventive Care</p>
            </CardContent>
          </Card>
          <Card data-testid="card-vaccination">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.vaccinationCoverage ? `${(pop.vaccinationCoverage * 100).toFixed(0)}%` : "N/A"}</p>
              <p className="text-sm text-muted-foreground">Vaccination Rate</p>
            </CardContent>
          </Card>
          <Card data-testid="card-risk-score">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{pop?.averageRiskScore?.toFixed(2) || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Avg Risk Score</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Operational Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-encounters">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{ops?.totalEncounters || 0}</p>
              <p className="text-sm text-muted-foreground">Total Encounters</p>
            </CardContent>
          </Card>
          <Card data-testid="card-avg-duration">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{ops?.avgEncounterDuration?.toFixed(0) || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Avg Duration (min)</p>
            </CardContent>
          </Card>
          <Card data-testid="card-readmission">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{ops?.readmissionRate30Day ? `${(ops.readmissionRate30Day * 100).toFixed(1)}%` : "N/A"}</p>
              <p className="text-sm text-muted-foreground">30-Day Readmit</p>
            </CardContent>
          </Card>
          <Card data-testid="card-los">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{ops?.avgLengthOfStay?.toFixed(1) || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Avg LOS (days)</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DataWarehousePage() {
  const [activeTab, setActiveTab] = useState("schemas");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="data-warehouse-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-full">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="page-title">Data Warehouse</h1>
            <p className="text-muted-foreground">Manage BigQuery schemas, exports, and analytics</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
            <TabsTrigger value="schemas" data-testid="tab-schemas">
              <Table className="w-4 h-4 mr-2" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="exports" data-testid="tab-exports">
              <Download className="w-4 h-4 mr-2" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">
              <Calendar className="w-4 h-4 mr-2" />
              Schedules
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schemas" className="mt-6">
            <SchemasTab />
          </TabsContent>

          <TabsContent value="exports" className="mt-6">
            <ExportsTab />
          </TabsContent>

          <TabsContent value="schedules" className="mt-6">
            <SchedulesTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
