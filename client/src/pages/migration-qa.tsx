import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, LoadingState } from "@/components/shared";
import {
  Shield,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Activity,
  Clock,
  Hash,
  FileCheck,
  Bell,
  TrendingUp,
  Server,
  Eye,
} from "lucide-react";

interface RecordCounts {
  medical_record: number;
  lab_result: number;
  prescription: number;
  medication: number;
}

interface PreMigrationChecklist {
  snapshotTaken: boolean;
  snapshotId?: string;
  sampleExported: boolean;
  sampleRecordCount: number;
  auditFrozen: boolean;
  auditFrozenAt?: string;
  allChecksPassed: boolean;
}

interface DuplicateGroup {
  fingerprint: string;
  records: Array<{
    hash: string;
    recordId: string;
    recordType: string;
    patientId: string;
    timestamp: string;
    providerId: string;
    rawFields: Record<string, string>;
  }>;
  primaryRecordId: string;
  duplicateRecordIds: string[];
  conflictDetails?: Array<{
    field: string;
    values: Array<{ recordId: string; value: string; source: string; updatedAt: string }>;
    resolvedValue?: string;
    resolutionReason?: string;
  }>;
  resolution: string;
}

interface MigrationResult {
  id: string;
  startedAt: string;
  completedAt?: string;
  phase: string;
  initialCounts: RecordCounts;
  finalCounts: RecordCounts;
  duplicatesDetected: number;
  duplicatesRemoved: number;
  conflictsDetected: number;
  conflictsResolved: number;
  duplicateGroups: DuplicateGroup[];
  errors: string[];
}

interface ValidationResult {
  integrityCheck: {
    passed: boolean;
    orphanedPrescriptions: number;
    orphanedLabResults: number;
    invalidPatientReferences: string[];
  };
  countVerification: {
    passed: boolean;
    expectedCount: number;
    actualCount: number;
    discrepancy: number;
  };
  aiSummaryValidation: {
    passed: boolean;
    profilesTested: number;
    summariesImproved: number;
    averageConciseness: number;
  };
}

interface MonitoringAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  route?: string;
  value?: number;
  threshold?: number;
  createdAt: string;
  acknowledged: boolean;
}

interface MonitoringDashboard {
  isMonitoring: boolean;
  hoursElapsed: number;
  totalSnapshots: number;
  latestSnapshot: {
    timestamp: string;
    errorRate: { total: number; status404: number; status500: number; route: string };
    apiLatency: { averageMs: number; p95Ms: number; p99Ms: number; targetMs: number; route: string };
    auditHealth: { eventsLogged: number; failures: number; phiAccessLogged: boolean };
  } | null;
  activeAlerts: MonitoringAlert[];
  alertSummary: Record<string, number>;
  trends: { avgLatency: number[]; errorRates: number[]; timestamps: string[] };
}

interface MigrationStatus {
  success: boolean;
  phase: string;
  migration: MigrationResult | null;
  checklist: PreMigrationChecklist;
  snapshot: { id: string; createdAt: string; recordCounts: RecordCounts; totalRecords: number } | null;
}

function StatusIcon({ passed }: { passed: boolean }) {
  return passed ? (
    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
  ) : (
    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const variants: Record<string, string> = {
    idle: "bg-muted text-muted-foreground",
    pre_check: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    snapshot: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    scanning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    deduplicating: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    validating: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    monitoring: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${variants[phase] || variants.idle}`} data-testid={`badge-phase-${phase}`}>
      {phase.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    critical: "destructive",
    high: "destructive",
    medium: "outline",
    low: "secondary",
  };
  return (
    <Badge variant={variants[severity] || "outline"} data-testid={`badge-severity-${severity}`}>
      {severity}
    </Badge>
  );
}

export default function MigrationQA() {
  const [activeTab, setActiveTab] = useState("checklist");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const { data: status, isLoading } = useQuery<MigrationStatus>({
    queryKey: ["/api/infrastructure/migration/status"],
    refetchInterval: 5000,
  });

  const { data: monitoring } = useQuery<MonitoringDashboard & { success: boolean }>({
    queryKey: ["/api/infrastructure/migration/monitoring/dashboard"],
    refetchInterval: 10000,
  });

  const snapshotMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/snapshot"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/status"] }),
  });

  const exportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/export-sample", { sampleSize: 100 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/status"] }),
  });

  const freezeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/freeze-audit"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/status"] }),
  });

  const runMigrationMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/status"] }),
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/infrastructure/migration/validate");
      const data = await res.json();
      setValidationResult(data.validation);
      return data;
    },
  });

  const startMonitoringMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/monitoring/start"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/monitoring/dashboard"] }),
  });

  const stopMonitoringMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/monitoring/stop"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/monitoring/dashboard"] }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest("POST", `/api/infrastructure/migration/monitoring/acknowledge/${alertId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/monitoring/dashboard"] }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/infrastructure/migration/reset"),
    onSuccess: () => {
      setValidationResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/migration/monitoring/dashboard"] });
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading migration data..." data-testid="loading-migration" />;
  }

  const checklist = status?.checklist;
  const migration = status?.migration;
  const phase = status?.phase || "idle";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-migration-qa">
      <PageHeader
        title="Migration & QA Pipeline"
        subtitle="Record deduplication, validation, and post-launch monitoring"
        icon={<Database className="h-6 w-6" />}
        actions={
          <div className="flex items-center gap-2">
            <PhaseBadge phase={phase} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => resetMutation.mutate()} data-testid="button-reset-migration">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset migration state</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-migration">
        <TabsList data-testid="tabs-list-migration">
          <TabsTrigger value="checklist" data-testid="tab-checklist">Pre-Migration</TabsTrigger>
          <TabsTrigger value="migration" data-testid="tab-migration">Migration</TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">Validation</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-4" data-testid="content-checklist">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck className="h-5 w-5" />
                Pre-Migration Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50" data-testid="checklist-snapshot">
                  <div className="flex items-center gap-3">
                    <StatusIcon passed={checklist?.snapshotTaken || false} />
                    <div>
                      <p className="text-sm font-medium">Full Snapshot</p>
                      <p className="text-xs text-muted-foreground">
                        Point-in-time backup of production database
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => snapshotMutation.mutate()}
                    disabled={snapshotMutation.isPending || checklist?.snapshotTaken}
                    data-testid="button-take-snapshot"
                  >
                    {snapshotMutation.isPending ? "Creating..." : checklist?.snapshotTaken ? "Done" : "Take Snapshot"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50" data-testid="checklist-sample">
                  <div className="flex items-center gap-3">
                    <StatusIcon passed={checklist?.sampleExported || false} />
                    <div>
                      <p className="text-sm font-medium">Sample Export</p>
                      <p className="text-xs text-muted-foreground">
                        Export 100 random duplicated records for manual verification
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending || !checklist?.snapshotTaken || checklist?.sampleExported}
                    data-testid="button-export-sample"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {exportMutation.isPending ? "Exporting..." : checklist?.sampleExported ? `${checklist.sampleRecordCount} exported` : "Export Sample"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50" data-testid="checklist-audit">
                  <div className="flex items-center gap-3">
                    <StatusIcon passed={checklist?.auditFrozen || false} />
                    <div>
                      <p className="text-sm font-medium">Audit Freeze</p>
                      <p className="text-xs text-muted-foreground">
                        Temporarily disable automated audit logging during migration
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => freezeMutation.mutate()}
                    disabled={freezeMutation.isPending || checklist?.auditFrozen}
                    data-testid="button-freeze-audit"
                  >
                    {freezeMutation.isPending ? "Freezing..." : checklist?.auditFrozen ? "Frozen" : "Freeze Audit"}
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {checklist?.allChecksPassed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                    <span className="text-sm font-medium" data-testid="text-checklist-status">
                      {checklist?.allChecksPassed ? "All checks passed - ready to migrate" : "Complete all checks before migration"}
                    </span>
                  </div>
                  <Progress
                    value={
                      ((checklist?.snapshotTaken ? 1 : 0) +
                        (checklist?.sampleExported ? 1 : 0) +
                        (checklist?.auditFrozen ? 1 : 0)) *
                      33.33
                    }
                    className="w-32"
                    data-testid="progress-checklist"
                  />
                </div>
              </div>

              {status?.snapshot && (
                <Card className="mt-4" data-testid="card-snapshot-info">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium mb-2">Snapshot Summary</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-lg font-bold" data-testid="text-count-medical-records">
                          {status.snapshot.recordCounts.medical_record}
                        </p>
                        <p className="text-xs text-muted-foreground">Medical Records</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-lg font-bold" data-testid="text-count-lab-results">
                          {status.snapshot.recordCounts.lab_result}
                        </p>
                        <p className="text-xs text-muted-foreground">Lab Results</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-lg font-bold" data-testid="text-count-medications">
                          {status.snapshot.recordCounts.medication}
                        </p>
                        <p className="text-xs text-muted-foreground">Medications</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-lg font-bold" data-testid="text-count-total">
                          {status.snapshot.totalRecords}
                        </p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-4" data-testid="content-migration">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-5 w-5" />
                Record Deduplication
              </CardTitle>
              <Button
                onClick={() => runMigrationMutation.mutate()}
                disabled={runMigrationMutation.isPending || !checklist?.allChecksPassed || phase === "complete"}
                data-testid="button-run-migration"
              >
                <Play className="h-4 w-4 mr-1" />
                {runMigrationMutation.isPending ? "Running..." : "Run Migration"}
              </Button>
            </CardHeader>
            <CardContent>
              {!migration ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-migration">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {checklist?.allChecksPassed
                      ? "Pre-checks passed. Click 'Run Migration' to begin."
                      : "Complete the pre-migration checklist first."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <PhaseBadge phase={migration.phase} />
                    <span className="text-xs text-muted-foreground" data-testid="text-migration-time">
                      Started: {new Date(migration.startedAt).toLocaleString()}
                      {migration.completedAt && ` | Completed: ${new Date(migration.completedAt).toLocaleString()}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card data-testid="stat-duplicates-detected">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{migration.duplicatesDetected}</p>
                        <p className="text-xs text-muted-foreground">Duplicates Detected</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="stat-duplicates-removed">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{migration.duplicatesRemoved}</p>
                        <p className="text-xs text-muted-foreground">Duplicates Removed</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="stat-conflicts-detected">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{migration.conflictsDetected}</p>
                        <p className="text-xs text-muted-foreground">Conflicts Detected</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="stat-conflicts-resolved">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{migration.conflictsResolved}</p>
                        <p className="text-xs text-muted-foreground">Conflicts Resolved</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card data-testid="card-initial-counts">
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium mb-2">Initial Record Counts</p>
                        <div className="space-y-1.5">
                          {Object.entries(migration.initialCounts).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-muted-foreground">{type.replace(/_/g, " ")}</span>
                              <span className="font-mono">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-final-counts">
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium mb-2">Final Record Counts</p>
                        <div className="space-y-1.5">
                          {Object.entries(migration.finalCounts).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-muted-foreground">{type.replace(/_/g, " ")}</span>
                              <span className="font-mono">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {migration.duplicateGroups.length > 0 && (
                    <div data-testid="section-duplicate-groups">
                      <p className="text-sm font-medium mb-2">
                        Duplicate Groups ({migration.duplicateGroups.length})
                      </p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {migration.duplicateGroups.slice(0, 20).map((group, i) => (
                          <Card key={group.fingerprint} data-testid={`card-duplicate-group-${i}`}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono">
                                    {group.fingerprint.substring(0, 12)}...
                                  </code>
                                  <Badge variant="outline">
                                    {group.records[0]?.recordType.replace(/_/g, " ")}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {group.records.length} records
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {group.conflictDetails && group.conflictDetails.length > 0 && (
                                    <Badge variant="destructive">
                                      {group.conflictDetails.length} conflicts
                                    </Badge>
                                  )}
                                  <Badge variant="outline">
                                    {group.resolution}
                                  </Badge>
                                </div>
                              </div>
                              {group.conflictDetails && group.conflictDetails.length > 0 && (
                                <div className="mt-2 pl-4 border-l-2 border-border space-y-1">
                                  {group.conflictDetails.map((conflict, ci) => (
                                    <div key={ci} className="text-xs">
                                      <span className="font-medium">{conflict.field}:</span>{" "}
                                      <span className="text-muted-foreground">
                                        {conflict.values.map((v) => v.value).join(" vs ")}
                                      </span>
                                      {conflict.resolvedValue && (
                                        <span className="ml-1">
                                          {" -> "}
                                          <span className="text-green-600 dark:text-green-400">{conflict.resolvedValue}</span>
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {migration.errors.length > 0 && (
                    <Card data-testid="card-migration-errors">
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Errors</p>
                        {migration.errors.map((err, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{err}</p>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4" data-testid="content-validation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5" />
                Post-Migration Validation
              </CardTitle>
              <Button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending || phase !== "complete"}
                data-testid="button-run-validation"
              >
                <FileCheck className="h-4 w-4 mr-1" />
                {validateMutation.isPending ? "Validating..." : "Run Validation"}
              </Button>
            </CardHeader>
            <CardContent>
              {!validationResult ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-validation">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {phase === "complete"
                      ? "Migration complete. Click 'Run Validation' to verify integrity."
                      : "Complete the migration first."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card data-testid="card-integrity-check">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <StatusIcon passed={validationResult.integrityCheck.passed} />
                        <p className="text-sm font-medium">Integrity Check</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.integrityCheck.orphanedPrescriptions}</p>
                          <p className="text-xs text-muted-foreground">Orphaned Prescriptions</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.integrityCheck.orphanedLabResults}</p>
                          <p className="text-xs text-muted-foreground">Orphaned Lab Results</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.integrityCheck.invalidPatientReferences.length}</p>
                          <p className="text-xs text-muted-foreground">Invalid References</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-count-verification">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <StatusIcon passed={validationResult.countVerification.passed} />
                        <p className="text-sm font-medium">Count Verification</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Expected: Initial Count - Detected Duplicates = Final Count
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.countVerification.expectedCount}</p>
                          <p className="text-xs text-muted-foreground">Expected</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.countVerification.actualCount}</p>
                          <p className="text-xs text-muted-foreground">Actual</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.countVerification.discrepancy}</p>
                          <p className="text-xs text-muted-foreground">Discrepancy</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-ai-validation">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <StatusIcon passed={validationResult.aiSummaryValidation.passed} />
                        <p className="text-sm font-medium">AI Summary Validation</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.aiSummaryValidation.profilesTested}</p>
                          <p className="text-xs text-muted-foreground">Profiles Tested</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">{validationResult.aiSummaryValidation.summariesImproved}</p>
                          <p className="text-xs text-muted-foreground">Summaries Improved</p>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50 text-center">
                          <p className="text-lg font-bold">
                            {Math.round(validationResult.aiSummaryValidation.averageConciseness * 100)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Conciseness</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4" data-testid="content-monitoring">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5" />
                72-Hour Post-Launch Monitoring
              </CardTitle>
              <div className="flex items-center gap-2">
                {monitoring?.isMonitoring ? (
                  <Button variant="outline" onClick={() => stopMonitoringMutation.mutate()} data-testid="button-stop-monitoring">
                    <Pause className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={() => startMonitoringMutation.mutate()} data-testid="button-start-monitoring">
                    <Play className="h-4 w-4 mr-1" />
                    Start Monitoring
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!monitoring?.latestSnapshot ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-monitoring">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Start monitoring to track post-migration health.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span data-testid="text-monitoring-hours">{monitoring.hoursElapsed}h elapsed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{monitoring.totalSnapshots} snapshots</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bell className="h-4 w-4" />
                      <span data-testid="text-active-alerts">{monitoring.activeAlerts.length} active alerts</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card data-testid="card-error-rate">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Error Rate</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">404 Errors</span>
                            <span className="font-mono" data-testid="text-404-count">
                              {monitoring.latestSnapshot.errorRate.status404}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">500 Errors</span>
                            <span className="font-mono" data-testid="text-500-count">
                              {monitoring.latestSnapshot.errorRate.status500}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Route</span>
                            <code className="text-xs">{monitoring.latestSnapshot.errorRate.route}</code>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-api-latency">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">API Latency</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Average</span>
                            <span className="font-mono" data-testid="text-avg-latency">
                              {monitoring.latestSnapshot.apiLatency.averageMs}ms
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">P95</span>
                            <span className="font-mono">{monitoring.latestSnapshot.apiLatency.p95Ms}ms</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Target</span>
                            <span className="font-mono">&lt;{monitoring.latestSnapshot.apiLatency.targetMs}ms</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Progress
                            value={Math.min(
                              100,
                              (monitoring.latestSnapshot.apiLatency.averageMs / monitoring.latestSnapshot.apiLatency.targetMs) * 100
                            )}
                            className="h-1.5"
                            data-testid="progress-latency"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-audit-health">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Audit Health</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Events Logged</span>
                            <span className="font-mono" data-testid="text-audit-events">
                              {monitoring.latestSnapshot.auditHealth.eventsLogged}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Failures</span>
                            <span className="font-mono">{monitoring.latestSnapshot.auditHealth.failures}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">PHI Logging</span>
                            <StatusIcon passed={monitoring.latestSnapshot.auditHealth.phiAccessLogged} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {monitoring.activeAlerts.length > 0 && (
                    <div data-testid="section-alerts">
                      <p className="text-sm font-medium mb-2">Active Alerts ({monitoring.activeAlerts.length})</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {monitoring.activeAlerts.map((alert) => (
                          <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <SeverityBadge severity={alert.severity} />
                                  <Badge variant="outline">{alert.type.replace(/_/g, " ")}</Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                                  data-testid={`button-ack-${alert.id}`}
                                >
                                  Acknowledge
                                </Button>
                              </div>
                              <p className="text-sm mt-1">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(alert.createdAt).toLocaleString()}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
