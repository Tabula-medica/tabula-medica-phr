import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Calendar,
  Brain,
  Shield,
  BarChart3,
  Search,
  Plus,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  FileText,
  Stethoscope,
  Sparkles,
  UserPlus,
  Settings,
  Loader2,
  User,
  Hospital,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { clickable } from "@/lib/a11y";

interface PatientRecord {
  id: string;
  name: string;
  dob: string;
  mrn: string;
  lastUpdated: string;
  primaryPhysician: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  intakeStatus: "pending" | "completed" | "in_review";
  lastVisit: string;
  email: string;
  phone: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

interface IntakeEntry {
  id: string;
  patientId: string;
  patientName: string;
  submittedAt: string;
  source: string;
  sections: { name: string; status: "complete" | "incomplete" | "flagged" }[];
  flags: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  startTime: string;
  endTime: string;
  type: string;
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "cancelled" | "no-show";
  location: string;
  notes: string;
}

interface AIInsight {
  id: string;
  patientId: string;
  patientName: string;
  category: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  confidence: number;
  generatedAt: string;
  evidenceRefs: string[];
  status: "new" | "acknowledged" | "resolved" | "dismissed";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

interface AdminMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "stable";
  category: string;
}

interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details: string;
  ipAddress: string;
}

const API_BASE = "/api/infrastructure/provider-admin";

const riskLevelColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const intakeStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const userStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const appointmentStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "in-progress": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "no-show": "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const ALL_PERMISSIONS = [
  "view_patients",
  "edit_patients",
  "view_appointments",
  "manage_appointments",
  "view_insights",
  "manage_users",
  "view_audit_log",
  "admin_settings",
];

function formatDateSafe(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function formatDateTimeSafe(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr;
  }
}

function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function DataSourceBadge({ source }: { source: "patient" | "ehr" }) {
  if (source === "patient") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-300" data-testid="badge-source-patient">
        <User className="h-3 w-3" />
        Patient-Reported
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-900 dark:text-gray-100" data-testid="badge-source-ehr">
      <Hospital className="h-3 w-3" />
      EHR-Imported
    </span>
  );
}

function AISummarySection({ patientId }: { patientId: string }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${API_BASE}/records/${patientId}/ai-summary`, {});
      return res.json();
    },
    onSuccess: (data: { summary: string; generatedAt: string }) => {
      setSummary(data.summary);
      setGeneratedAt(data.generatedAt);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate patient summary", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3" data-testid="section-ai-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium flex items-center gap-1">
          <Sparkles className="h-4 w-4" /> AI Patient Summary
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-summary"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-1" />
              Generate Summary
            </>
          )}
        </Button>
      </div>

      {summary ? (
        <Card data-testid="card-ai-summary">
          <CardContent className="p-4 space-y-2">
            {generatedAt && (
              <p className="text-xs text-muted-foreground" data-testid="text-summary-generated-at">
                Generated {formatDateTimeSafe(generatedAt)}
              </p>
            )}
            <div className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-summary-content">
              {summary.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                }
                if (line.includes("[Patient-Reported]")) {
                  return (
                    <p key={i} className="text-blue-700 dark:text-blue-300">
                      {line.replace("[Patient-Reported]", "")}
                      <span className="ml-1 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">Patient-Reported</span>
                    </p>
                  );
                }
                if (line.includes("[EHR-Imported]")) {
                  return (
                    <p key={i} className="text-gray-900 dark:text-gray-100">
                      {line.replace("[EHR-Imported]", "")}
                      <span className="ml-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">EHR-Imported</span>
                    </p>
                  );
                }
                if (line.includes("[Intake]")) {
                  return (
                    <p key={i} className="text-amber-700 dark:text-amber-300">
                      {line.replace("[Intake]", "")}
                      <span className="ml-1 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Intake</span>
                    </p>
                  );
                }
                return line ? <p key={i}>{line}</p> : <br key={i} />;
              })}
            </div>
          </CardContent>
        </Card>
      ) : !generateMutation.isPending ? (
        <p className="text-sm text-muted-foreground" data-testid="text-summary-placeholder">
          Click "Generate Summary" to create an AI-powered concise summary of this patient's records, conditions, medications, and lab values.
        </p>
      ) : null}
    </div>
  );
}

function PatientRecordsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("query", searchQuery);
  if (riskFilter && riskFilter !== "all") queryParams.set("riskLevel", riskFilter);
  const queryString = queryParams.toString();

  const { data: recordsData, isLoading } = useQuery<{ records: PatientRecord[]; total: number; page: number; totalPages: number }>({
    queryKey: [`${API_BASE}/records${queryString ? `?${queryString}` : ""}`],
  });
  const records = recordsData?.records ?? [];

  const { data: intakeData, isLoading: loadingIntake } = useQuery<{ entries: IntakeEntry[] }>({
    queryKey: [`${API_BASE}/records`, selectedPatient?.id, "intake"],
    enabled: !!selectedPatient,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/records/${selectedPatient!.id}/intake`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch intake");
      return res.json();
    },
  });
  const intakeHistory = intakeData?.entries ?? [];

  const handleView = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-patient-search"
            placeholder="Search by name or MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter} data-testid="filter-risk-level">
          <SelectTrigger className="w-[160px]" data-testid="filter-risk-level">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" data-testid="legend-data-sources">
        <span className="flex items-center gap-1" data-testid="legend-patient-reported">
          <span className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-400" />
          <span className="text-blue-700 dark:text-blue-300 font-medium">Patient-Reported Data</span>
        </span>
        <span className="flex items-center gap-1" data-testid="legend-ehr-imported">
          <span className="w-3 h-3 rounded-sm bg-gray-800 dark:bg-gray-200" />
          <span className="text-gray-900 dark:text-gray-100 font-medium">EHR / Imported Records</span>
        </span>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No patient records found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-7 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span>Name</span>
            <span>MRN</span>
            <span>Primary Physician</span>
            <span>Risk Level</span>
            <span>Intake Status</span>
            <span>Last Visit</span>
            <span>Actions</span>
          </div>
          {records.map((patient) => (
            <Card key={patient.id} data-testid={`card-patient-${patient.id}`}>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                  <span className="font-medium" data-testid={`text-patient-name-${patient.id}`}>
                    {patient.name}
                  </span>
                  <span className="text-sm text-muted-foreground" data-testid={`text-mrn-${patient.id}`}>
                    {patient.mrn}
                  </span>
                  <span className="text-sm" data-testid={`text-physician-${patient.id}`}>
                    {patient.primaryPhysician}
                  </span>
                  <div>
                    <Badge
                      className={`no-default-hover-elevate ${riskLevelColors[patient.riskLevel] || ""}`}
                      data-testid={`badge-risk-${patient.riskLevel}`}
                    >
                      {patient.riskLevel}
                    </Badge>
                  </div>
                  <div>
                    <Badge
                      className={`no-default-hover-elevate ${intakeStatusColors[patient.intakeStatus] || ""}`}
                      data-testid={`badge-intake-${patient.intakeStatus}`}
                    >
                      {patient.intakeStatus.replace("_", " ")}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDateSafe(patient.lastVisit)}
                  </span>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleView(patient)}
                      data-testid={`button-view-patient-${patient.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setSelectedPatient(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden" data-testid="dialog-patient-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">MRN:</span>{" "}
                    <span className="font-medium">{selectedPatient.mrn}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DOB:</span>{" "}
                    <span className="font-medium">{formatDateSafe(selectedPatient.dob)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Physician:</span>{" "}
                    <span className="font-medium">{selectedPatient.primaryPhysician}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Risk Level:</span>{" "}
                    <Badge className={`no-default-hover-elevate ${riskLevelColors[selectedPatient.riskLevel]}`}>
                      {selectedPatient.riskLevel}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-1">
                    <Activity className="h-4 w-4" /> Conditions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.conditions.length > 0 ? selectedPatient.conditions.map((c, i) => (
                      <div key={i} className="flex flex-col items-start gap-0.5">
                        <Badge variant="outline" className="no-default-hover-elevate border-gray-800 dark:border-gray-200 text-gray-900 dark:text-gray-100" data-testid={`badge-condition-ehr-${i}`}>{c}</Badge>
                        <DataSourceBadge source="ehr" />
                      </div>
                    )) : <span className="text-sm text-muted-foreground">None recorded</span>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Medications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.medications.length > 0 ? selectedPatient.medications.map((m, i) => (
                      <div key={i} className="flex flex-col items-start gap-0.5">
                        <Badge variant="secondary" className="no-default-hover-elevate border-gray-800 dark:border-gray-200 text-gray-900 dark:text-gray-100" data-testid={`badge-med-ehr-${i}`}>{m}</Badge>
                        <DataSourceBadge source="ehr" />
                      </div>
                    )) : <span className="text-sm text-muted-foreground">None recorded</span>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Allergies
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.allergies.length > 0 ? selectedPatient.allergies.map((a, i) => (
                      <Badge key={i} className="no-default-hover-elevate bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" data-testid={`badge-allergy-${i}`}>{a}</Badge>
                    )) : <span className="text-sm text-muted-foreground">None recorded</span>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Intake History
                  </h4>
                  {loadingIntake ? (
                    <LoadingSkeleton rows={2} />
                  ) : intakeHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No intake records found</p>
                  ) : (
                    <div className="space-y-3">
                      {intakeHistory.map((entry) => (
                        <Card key={entry.id} data-testid={`card-intake-${entry.id}`}>
                          <CardContent className="p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span className="text-sm font-medium">{formatDateTimeSafe(entry.submittedAt)}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="no-default-hover-elevate">{entry.source}</Badge>
                                <DataSourceBadge source={entry.source === "portal" ? "patient" : "ehr"} />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {entry.sections.map((s, i) => (
                                <Badge
                                  key={i}
                                  className={`no-default-hover-elevate text-[10px] ${
                                    s.status === "complete"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                      : s.status === "flagged"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  }`}
                                >
                                  {s.name}: {s.status}
                                </Badge>
                              ))}
                            </div>
                            {entry.flags.length > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {entry.flags.map((f, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                    {f}
                                  </div>
                                ))}
                              </div>
                            )}
                            {entry.reviewedBy && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Reviewed by {entry.reviewedBy} on {formatDateSafe(entry.reviewedAt || "")}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <AISummarySection key={selectedPatient.id} patientId={selectedPatient.id} />
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: "",
    providerId: "",
    type: "",
    date: "",
    time: "",
    location: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({ patientId: "", providerId: "", type: "", date: "", time: "", location: "", notes: "" });
  };

  const queryString = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data: appointmentsData, isLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: [`${API_BASE}/appointments${queryString}`],
  });
  const appointments = appointmentsData?.appointments ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", `${API_BASE}/appointments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/appointments`] });
      toast({ title: "Appointment Scheduled", description: "New appointment has been created successfully." });
      setScheduleOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create appointment.", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `${API_BASE}/appointments/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/appointments`] });
      toast({ title: "Status Updated", description: "Appointment status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update appointment status.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-appointment-status">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no-show">No-Show</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { resetForm(); setScheduleOpen(true); }} data-testid="button-schedule-appointment">
          <Plus className="h-4 w-4 mr-1" />
          Schedule Appointment
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No appointments found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {appointments.map((apt) => (
            <Card key={apt.id} data-testid={`card-appointment-${apt.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium" data-testid={`text-apt-patient-${apt.id}`}>{apt.patientName}</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-apt-provider-${apt.id}`}>{apt.providerName}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="no-default-hover-elevate" data-testid={`badge-type-${apt.type}`}>
                      {apt.type}
                    </Badge>
                    <Badge
                      className={`no-default-hover-elevate ${appointmentStatusColors[apt.status] || ""}`}
                      data-testid={`badge-status-${apt.status}`}
                    >
                      {apt.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTimeSafe(apt.startTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {apt.location}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Select
                    value={apt.status}
                    onValueChange={(val) => updateStatusMutation.mutate({ id: apt.id, status: val })}
                  >
                    <SelectTrigger className="w-[150px]" data-testid={`filter-update-status-${apt.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no-show">No-Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={scheduleOpen} onOpenChange={(open) => { if (!open) { setScheduleOpen(false); resetForm(); } }}>
        <DialogContent data-testid="dialog-schedule-appointment">
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="provider-admin-portal-patient-id" className="text-sm font-medium">Patient ID</label>
              <Input id="provider-admin-portal-patient-id"
                data-testid="input-appointment-patient-id"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                placeholder="Enter patient ID"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-provider-id" className="text-sm font-medium">Provider ID</label>
              <Input id="provider-admin-portal-provider-id"
                data-testid="input-appointment-provider-id"
                value={formData.providerId}
                onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                placeholder="Enter provider ID"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-type" className="text-sm font-medium">Type</label>
              <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                <SelectTrigger id="provider-admin-portal-type" data-testid="input-appointment-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkup">Checkup</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="specialist">Specialist</SelectItem>
                  <SelectItem value="telehealth">Telehealth</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="provider-admin-portal-date" className="text-sm font-medium">Date</label>
                <Input id="provider-admin-portal-date"
                  data-testid="input-appointment-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="provider-admin-portal-time" className="text-sm font-medium">Time</label>
                <Input id="provider-admin-portal-time"
                  data-testid="input-appointment-time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label htmlFor="provider-admin-portal-location" className="text-sm font-medium">Location</label>
              <Input id="provider-admin-portal-location"
                data-testid="input-appointment-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-notes" className="text-sm font-medium">Notes</label>
              <Input id="provider-admin-portal-notes"
                data-testid="input-appointment-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setScheduleOpen(false); resetForm(); }} data-testid="button-cancel-appointment">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending}
              data-testid="button-submit-appointment"
            >
              {createMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsightsTab() {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryParams = new URLSearchParams();
  if (categoryFilter && categoryFilter !== "all") queryParams.set("category", categoryFilter);
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  const queryString = queryParams.toString();

  const { data: insightsData, isLoading } = useQuery<{ insights: AIInsight[] }>({
    queryKey: [`${API_BASE}/insights${queryString ? `?${queryString}` : ""}`],
  });
  const insights = insightsData?.insights ?? [];

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `${API_BASE}/insights/${id}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/insights`] });
      toast({ title: "Insight Acknowledged", description: "The insight has been acknowledged." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge insight.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]" data-testid="filter-insight-category">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="risk-alert">Risk Alert</SelectItem>
            <SelectItem value="medication-interaction">Medication Interaction</SelectItem>
            <SelectItem value="lab-trend">Lab Trend</SelectItem>
            <SelectItem value="preventive-care">Preventive Care</SelectItem>
            <SelectItem value="chronic-management">Chronic Management</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="filter-insight-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No insights found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight) => (
            <Card key={insight.id} data-testid={`card-insight-${insight.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium" data-testid={`text-insight-patient-${insight.id}`}>{insight.patientName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeSafe(insight.generatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="no-default-hover-elevate" data-testid={`badge-category-${insight.category}`}>
                      {insight.category.replace(/-/g, " ")}
                    </Badge>
                    <Badge
                      className={`no-default-hover-elevate ${severityColors[insight.severity] || ""}`}
                      data-testid={`badge-severity-${insight.severity}`}
                    >
                      {insight.severity}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm" data-testid={`text-insight-summary-${insight.id}`}>{insight.summary}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {Math.round(insight.confidence * 100)}% confidence
                  </span>
                  {insight.evidenceRefs.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {insight.evidenceRefs.length} references
                    </span>
                  )}
                </div>
                {insight.status === "new" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(insight.id)}
                    disabled={acknowledgeMutation.isPending}
                    data-testid={`button-acknowledge-${insight.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                )}
                {insight.status !== "new" && (
                  <Badge
                    className={`no-default-hover-elevate ${
                      insight.status === "acknowledged"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : insight.status === "resolved"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
                    }`}
                    data-testid={`badge-insight-status-${insight.status}`}
                  >
                    {insight.status}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UserManagementTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    role: "",
    department: "",
    permissions: [] as string[],
  });
  const [editForm, setEditForm] = useState({
    role: "",
    permissions: [] as string[],
  });

  const resetNewUserForm = () => {
    setNewUserForm({ name: "", email: "", role: "", department: "", permissions: [] });
  };

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("query", searchQuery);
  if (roleFilter && roleFilter !== "all") queryParams.set("role", roleFilter);
  const queryString = queryParams.toString();

  const { data: usersData, isLoading } = useQuery<{ users: UserAccount[] }>({
    queryKey: [`${API_BASE}/users${queryString ? `?${queryString}` : ""}`],
  });
  const users = usersData?.users ?? [];

  const addUserMutation = useMutation({
    mutationFn: async (data: typeof newUserForm) => {
      const res = await apiRequest("POST", `${API_BASE}/users`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/users`] });
      toast({ title: "User Added", description: "New user has been created successfully." });
      setAddUserOpen(false);
      resetNewUserForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add user.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; role: string; permissions: string[] }) => {
      const res = await apiRequest("PATCH", `${API_BASE}/users/${id}/role`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/users`] });
      toast({ title: "Role Updated", description: "User role has been updated successfully." });
      setEditRoleOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    },
  });

  const handleEditRole = (user: UserAccount) => {
    setSelectedUser(user);
    setEditForm({ role: user.role, permissions: [...user.permissions] });
    setEditRoleOpen(true);
  };

  const togglePermission = (perm: string, form: "new" | "edit") => {
    if (form === "new") {
      setNewUserForm((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(perm)
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(perm)
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-user-search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]" data-testid="filter-user-role">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="physician">Physician</SelectItem>
              <SelectItem value="nurse">Nurse</SelectItem>
              <SelectItem value="pharmacist">Pharmacist</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
              <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetNewUserForm(); setAddUserOpen(true); }} data-testid="button-add-user">
          <UserPlus className="h-4 w-4 mr-1" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="hidden lg:grid grid-cols-7 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Department</span>
            <span>Status</span>
            <span>Last Login</span>
            <span>Actions</span>
          </div>
          {users.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-center">
                  <span className="font-medium" data-testid={`text-user-name-${user.id}`}>{user.name}</span>
                  <span className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                  <div>
                    <Badge variant="outline" className="no-default-hover-elevate" data-testid={`badge-role-${user.role}`}>
                      {user.role}
                    </Badge>
                  </div>
                  <span className="text-sm" data-testid={`text-user-dept-${user.id}`}>{user.department}</span>
                  <div>
                    <Badge
                      className={`no-default-hover-elevate ${userStatusColors[user.status] || ""}`}
                      data-testid={`badge-status-${user.status}`}
                    >
                      {user.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatDateSafe(user.lastLogin)}</span>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditRole(user)}
                      data-testid={`button-edit-role-${user.id}`}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Edit Role
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addUserOpen} onOpenChange={(open) => { if (!open) { setAddUserOpen(false); resetNewUserForm(); } }}>
        <DialogContent data-testid="dialog-add-user">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="provider-admin-portal-name" className="text-sm font-medium">Name</label>
              <Input id="provider-admin-portal-name"
                data-testid="input-new-user-name"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-email" className="text-sm font-medium">Email</label>
              <Input id="provider-admin-portal-email"
                data-testid="input-new-user-email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-role" className="text-sm font-medium">Role</label>
              <Select value={newUserForm.role} onValueChange={(val) => setNewUserForm({ ...newUserForm, role: val })}>
                <SelectTrigger id="provider-admin-portal-role" data-testid="input-new-user-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="physician">Physician</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="provider-admin-portal-department" className="text-sm font-medium">Department</label>
              <Input id="provider-admin-portal-department"
                data-testid="input-new-user-department"
                value={newUserForm.department}
                onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                placeholder="Department"
              />
            </div>
            <div>
              <label htmlFor="provider-admin-portal-permissions" className="text-sm font-medium mb-2 block">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Checkbox id="provider-admin-portal-permissions"
                      data-testid={`checkbox-perm-${perm}`}
                      checked={newUserForm.permissions.includes(perm)}
                      onCheckedChange={() => togglePermission(perm, "new")}
                    />
                    <span className="text-sm">{perm.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddUserOpen(false); resetNewUserForm(); }} data-testid="button-cancel-add-user">
              Cancel
            </Button>
            <Button
              onClick={() => addUserMutation.mutate(newUserForm)}
              disabled={addUserMutation.isPending}
              data-testid="button-submit-add-user"
            >
              {addUserMutation.isPending ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleOpen} onOpenChange={(open) => { if (!open) { setEditRoleOpen(false); setSelectedUser(null); } }}>
        <DialogContent data-testid="dialog-edit-role">
          <DialogHeader>
            <DialogTitle>Edit Role - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="provider-admin-portal-role-2" className="text-sm font-medium">Role</label>
              <Select value={editForm.role} onValueChange={(val) => setEditForm({ ...editForm, role: val })}>
                <SelectTrigger id="provider-admin-portal-role-2" data-testid="input-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="physician">Physician</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="provider-admin-portal-permissions-2" className="text-sm font-medium mb-2 block">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Checkbox id="provider-admin-portal-permissions-2"
                      data-testid={`checkbox-edit-perm-${perm}`}
                      checked={editForm.permissions.includes(perm)}
                      onCheckedChange={() => togglePermission(perm, "edit")}
                    />
                    <span className="text-sm">{perm.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRoleOpen(false); setSelectedUser(null); }} data-testid="button-cancel-edit-role">
              Cancel
            </Button>
            <Button
              onClick={() => selectedUser && updateRoleMutation.mutate({ id: selectedUser.id, ...editForm })}
              disabled={updateRoleMutation.isPending}
              data-testid="button-submit-edit-role"
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminDashboardTab() {
  const [auditPage, setAuditPage] = useState(1);
  const auditLimit = 10;

  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery<{ metrics: AdminMetric[] }>({
    queryKey: [`${API_BASE}/analytics`],
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery<{ entries: AuditEntry[]; total: number; page: number; limit: number }>({
    queryKey: [`${API_BASE}/audit-log?page=${auditPage}&limit=${auditLimit}`],
  });

  const metrics = analyticsData?.metrics || [];
  const auditEntries = auditData?.entries || [];
  const totalPages = auditData ? Math.ceil(auditData.total / auditLimit) : 1;

  const trendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const categoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      patients: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      appointments: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      compliance: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      performance: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    };
    return colors[category] || "";
  };

  return (
    <div className="space-y-6">
      {loadingAnalytics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((metric) => (
            <Card key={metric.id} data-testid={`card-metric-${metric.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <Badge className={`no-default-hover-elevate text-[10px] ${categoryBadge(metric.category)}`} data-testid={`badge-category-${metric.category}`}>
                    {metric.category}
                  </Badge>
                </div>
                <p className="text-2xl font-bold" data-testid={`text-metric-value-${metric.id}`}>{metric.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  {trendIcon(metric.trend)}
                  <span className="text-sm text-muted-foreground">{metric.delta}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Audit Log
        </h3>
        {loadingAudit ? (
          <LoadingSkeleton />
        ) : auditEntries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No audit entries found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              <div className="hidden lg:grid grid-cols-6 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
                <span>Actor</span>
                <span>Action</span>
                <span>Resource</span>
                <span>Timestamp</span>
                <span>Details</span>
                <span>IP Address</span>
              </div>
              {auditEntries.map((entry) => (
                <Card key={entry.id} data-testid={`card-audit-${entry.id}`}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-center">
                      <span className="font-medium text-sm" data-testid={`text-audit-actor-${entry.id}`}>{entry.actorName}</span>
                      <span className="text-sm" data-testid={`text-audit-action-${entry.id}`}>{entry.action}</span>
                      <span className="text-sm text-muted-foreground">{entry.resourceType}/{entry.resourceId}</span>
                      <span className="text-sm text-muted-foreground">{formatDateTimeSafe(entry.timestamp)}</span>
                      <span className="text-sm text-muted-foreground truncate" title={entry.details}>{entry.details}</span>
                      <span className="text-sm text-muted-foreground font-mono">{entry.ipAddress}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage <= 1}
                data-testid="button-audit-prev"
              >
                <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {auditPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAuditPage((p) => Math.min(totalPages, p + 1))}
                disabled={auditPage >= totalPages}
                data-testid="button-audit-next"
              >
                Next
                <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface AdherenceSummary {
  patientId: string;
  patientName: string;
  overallRate: number;
  medicationCount: number;
  activeFlagCount: number;
  recentMissedCount: number;
  lastTaken: string | null;
  riskLevel: "low" | "moderate" | "high" | "critical";
  medications: Array<{
    name: string;
    adherenceRate: number;
    streakDays: number;
    totalDoses: number;
    missed: number;
  }>;
  flags: Array<{
    id: string;
    medicationName: string;
    flagType: string;
    severity: string;
    description: string;
    status: string;
    detectedAt: string;
  }>;
}

const adherenceRiskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function AdherenceRateBar({ rate }: { rate: number }) {
  let color = "bg-green-500";
  if (rate < 50) color = "bg-red-500";
  else if (rate < 70) color = "bg-orange-500";
  else if (rate < 85) color = "bg-amber-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
      <span className="text-sm font-medium w-10 text-right">{rate}%</span>
    </div>
  );
}

function AdherenceTab() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: summaryData, isLoading } = useQuery<{ summaries: AdherenceSummary[] }>({
    queryKey: ["/api/infrastructure/provider-admin/adherence/summary"],
  });

  const summaries = summaryData?.summaries || [];

  const filteredSummaries = riskFilter === "all"
    ? summaries
    : summaries.filter(s => s.riskLevel === riskFilter);

  const avgRate = summaries.length > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.overallRate, 0) / summaries.length)
    : 0;
  const totalFlags = summaries.reduce((sum, s) => sum + s.activeFlagCount, 0);
  const criticalCount = summaries.filter(s => s.riskLevel === "critical" || s.riskLevel === "high").length;

  const selectedSummary = summaries.find(s => s.patientId === selectedPatient);

  async function generateAiInsight(patientId: string) {
    setAiLoading(true);
    setAiInsight(null);
    try {
      const res = await apiRequest("POST", `${API_BASE}/adherence/ai-insights`, { patientId });
      const data = await res.json();
      setAiInsight(data.insight);
    } catch {
      toast({ title: "Error", description: "Failed to generate AI insight", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-avg-adherence-label">Avg. Adherence Rate</p>
                <p className="text-2xl font-bold" data-testid="text-avg-adherence-value">{avgRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-active-flags-label">Active Flags</p>
                <p className="text-2xl font-bold" data-testid="text-active-flags-value">{totalFlags}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-at-risk-label">At-Risk Patients</p>
                <p className="text-2xl font-bold" data-testid="text-at-risk-value">{criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-lg">Patient Adherence Overview</CardTitle>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-risk-filter">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Filter by risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patients</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredSummaries.map((summary) => (
                <div
                  key={summary.patientId}
                  className={`p-3 rounded-md border cursor-pointer transition-colors hover-elevate ${
                    selectedPatient === summary.patientId ? "border-primary bg-accent/50" : ""
                  }`}
                  {...clickable(() => {
                    setSelectedPatient(summary.patientId);
                    setAiInsight(null);
                  })}
                  data-testid={`card-adherence-patient-${summary.patientId}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" data-testid={`text-patient-name-${summary.patientId}`}>{summary.patientName}</span>
                      <Badge className={adherenceRiskColors[summary.riskLevel] || ""} data-testid={`badge-risk-${summary.patientId}`}>
                        {summary.riskLevel}
                      </Badge>
                      {summary.activeFlagCount > 0 && (
                        <Badge variant="destructive" data-testid={`badge-flags-${summary.patientId}`}>
                          {summary.activeFlagCount} flag{summary.activeFlagCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{summary.medicationCount} med{summary.medicationCount !== 1 ? "s" : ""}</span>
                      <span>{summary.recentMissedCount} missed</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <AdherenceRateBar rate={summary.overallRate} />
                  </div>
                </div>
              ))}
              {filteredSummaries.length === 0 && (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-adherence-data">No patients match the selected filter.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                {selectedSummary.patientName} - Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedSummary.medications.map((med, idx) => (
                  <div key={idx} className="p-3 rounded-md border" data-testid={`card-med-detail-${idx}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <span className="font-medium" data-testid={`text-med-name-${idx}`}>{med.name}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{med.totalDoses} doses</span>
                        <span className="text-muted-foreground">|</span>
                        <span>{med.missed} missed</span>
                        <span className="text-muted-foreground">|</span>
                        <span>{med.streakDays}d streak</span>
                      </div>
                    </div>
                    <AdherenceRateBar rate={med.adherenceRate} />
                  </div>
                ))}
                {selectedSummary.medications.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No medication data available.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Non-Adherence Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedSummary.flags.length > 0 ? selectedSummary.flags.map((flag, idx) => (
                    <div key={flag.id} className="p-3 rounded-md border" data-testid={`card-flag-${idx}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-sm">{flag.medicationName}</span>
                        <div className="flex items-center gap-1">
                          <Badge className={severityColors[flag.severity] || ""} data-testid={`badge-flag-severity-${idx}`}>
                            {flag.severity}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-flag-status-${idx}`}>
                            {flag.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Detected: {formatDateTimeSafe(flag.detectedAt)}</p>
                    </div>
                  )) : (
                    <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">No active flags for this patient.</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Adherence Insight
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => generateAiInsight(selectedSummary.patientId)}
                  disabled={aiLoading}
                  data-testid="button-generate-ai-insight"
                >
                  {aiLoading ? (
                    <>
                      <Activity className="h-4 w-4 animate-spin mr-1" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-1" />
                      Generate Insight
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {aiInsight ? (
                  <div className="space-y-2" data-testid="text-ai-insight-content">
                    {aiInsight.split("\n").map((line, i) => {
                      if (!line.trim()) return null;
                      if (line.startsWith("##") || line.startsWith("**")) {
                        return <p key={i} className="font-semibold text-sm mt-2">{line.replace(/[#*]/g, "").trim()}</p>;
                      }
                      if (line.startsWith("- ") || line.startsWith("* ")) {
                        return <p key={i} className="text-sm text-muted-foreground pl-4">{line}</p>;
                      }
                      if (line.toLowerCase().includes("disclaimer") || line.toLowerCase().includes("does not constitute")) {
                        return <p key={i} className="text-xs text-muted-foreground mt-3 italic border-t pt-2">{line}</p>;
                      }
                      return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-ai-insight-placeholder">
                    Click "Generate Insight" to get an AI-powered observational summary of this patient's adherence patterns. This is NOT clinical decision support.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProviderAdminPortalPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Provider & Admin Portal</h1>
            <p className="text-sm text-muted-foreground">Manage patients, appointments, insights, users, and system administration</p>
          </div>
        </div>

        <Tabs defaultValue="records" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="records" className="min-h-[44px] gap-1" data-testid="tab-records">
              <FileText className="h-4 w-4" />
              Patient Records
            </TabsTrigger>
            <TabsTrigger value="appointments" className="min-h-[44px] gap-1" data-testid="tab-appointments">
              <Calendar className="h-4 w-4" />
              Appointments
            </TabsTrigger>
            <TabsTrigger value="adherence" className="min-h-[44px] gap-1" data-testid="tab-adherence">
              <Activity className="h-4 w-4" />
              Medication Adherence
            </TabsTrigger>
            <TabsTrigger value="insights" className="min-h-[44px] gap-1" data-testid="tab-insights">
              <Brain className="h-4 w-4" />
              AI Health Insights
            </TabsTrigger>
            <TabsTrigger value="users" className="min-h-[44px] gap-1" data-testid="tab-users">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="admin" className="min-h-[44px] gap-1" data-testid="tab-admin">
              <BarChart3 className="h-4 w-4" />
              Admin Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records">
            <PatientRecordsTab />
          </TabsContent>
          <TabsContent value="appointments">
            <AppointmentsTab />
          </TabsContent>
          <TabsContent value="adherence">
            <AdherenceTab />
          </TabsContent>
          <TabsContent value="insights">
            <InsightsTab />
          </TabsContent>
          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
          <TabsContent value="admin">
            <AdminDashboardTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
