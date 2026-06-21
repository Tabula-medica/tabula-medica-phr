import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Pill,
  FlaskConical,
  Calendar,
  Shield,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  Activity,
  ClipboardList,
} from "lucide-react";
import type {
  ClinicianNote,
  Prescription,
  LabResultRecord,
  AppointmentHistoryEntry,
} from "@shared/schema";
import {
  StatusBadge,
  FlagBadge,
  formatDate,
  formatDateTime,
  StatCardGrid,
  DataFiltersBar,
  PageHeader,
  LoadingState,
  EmptyState,
} from "@/components/shared";
import type { StatCardItem } from "@/components/shared";

const PATIENT_ID = "patient-secure-001";
const API_BASE = "/api/secure-health-records";

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const filtered = Object.entries(params).filter(([, v]) => v && v !== "all");
  if (filtered.length === 0) return path;
  const qs = new URLSearchParams(filtered).toString();
  return `${path}?${qs}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

function NoteTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    progress: "Progress Note",
    consultation: "Consultation",
    procedure: "Procedure",
    discharge: "Discharge",
    telephone: "Phone Call",
    nursing: "Nursing",
    social_work: "Social Work",
    therapy: "Therapy",
  };
  return <Badge variant="outline" data-testid={`badge-note-type-${type}`}>{labels[type] || type}</Badge>;
}

function OverviewTab() {
  const { data: summary, isLoading } = useQuery<{
    totalConsultations: number;
    totalPrescriptions: number;
    activePrescriptions: number;
    totalLabResults: number;
    abnormalLabResults: number;
    totalVisits: number;
    completedVisits: number;
    scheduledVisits: number;
    recentConsultation: string | null;
    recentLabDate: string | null;
    nextAppointment: AppointmentHistoryEntry | null;
  }>({
    queryKey: ["secure-health-records", "summary", PATIENT_ID],
    queryFn: () => fetchJson(`${API_BASE}/summary/${PATIENT_ID}`),
  });

  if (isLoading) {
    return <LoadingState data-testid="loading-overview" />;
  }

  if (!summary) return null;

  const stats: StatCardItem[] = [
    { label: "Consultations", value: summary.totalConsultations, icon: FileText, color: "text-blue-600 dark:text-blue-400", testId: "stat-consultations" },
    { label: "Active Prescriptions", value: summary.activePrescriptions, icon: Pill, color: "text-green-600 dark:text-green-400", testId: "stat-active-rx" },
    { label: "Total Prescriptions", value: summary.totalPrescriptions, icon: ClipboardList, color: "text-indigo-600 dark:text-indigo-400", testId: "stat-total-rx" },
    { label: "Lab Results", value: summary.totalLabResults, icon: FlaskConical, color: "text-amber-600 dark:text-amber-400", testId: "stat-labs" },
    { label: "Abnormal Results", value: summary.abnormalLabResults, icon: AlertTriangle, color: "text-red-600 dark:text-red-400", testId: "stat-abnormal-labs" },
    { label: "Completed Visits", value: summary.completedVisits, icon: CheckCircle, color: "text-teal-600 dark:text-teal-400", testId: "stat-completed-visits" },
    { label: "Scheduled Visits", value: summary.scheduledVisits, icon: Calendar, color: "text-purple-600 dark:text-purple-400", testId: "stat-scheduled-visits" },
    { label: "Total Visits", value: summary.totalVisits, icon: Activity, color: "text-cyan-600 dark:text-cyan-400", testId: "stat-total-visits" },
  ];

  return (
    <div className="space-y-6" data-testid="tab-overview">
      <StatCardGrid stats={stats} columns={4} />

      {summary.nextAppointment && (
        <Card data-testid="card-next-appointment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium" data-testid="text-next-appt-type">{summary.nextAppointment.appointmentType}</p>
                <p className="text-sm text-muted-foreground">{summary.nextAppointment.provider}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium" data-testid="text-next-appt-date">{formatDate(summary.nextAppointment.appointmentDate)}</p>
                <p className="text-xs text-muted-foreground">{summary.nextAppointment.appointmentTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>All access to health records is logged and monitored per HIPAA requirements</span>
      </div>
    </div>
  );
}

function ConsultationsTab() {
  const [search, setSearch] = useState("");
  const [noteType, setNoteType] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ records: ClinicianNote[]; total: number }>({
    queryKey: ["secure-health-records", "consultations", PATIENT_ID, search, noteType],
    queryFn: () => fetchJson(buildUrl(`${API_BASE}/consultations/${PATIENT_ID}`, { search, noteType })),
  });

  return (
    <div className="space-y-4" data-testid="tab-consultations">
      <DataFiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search consultations..."
        searchTestId="input-search-consultations"
        filters={[
          {
            value: noteType,
            onChange: setNoteType,
            placeholder: "Note Type",
            testId: "select-note-type",
            options: [
              { value: "all", label: "All Types" },
              { value: "progress", label: "Progress" },
              { value: "consultation", label: "Consultation" },
              { value: "procedure", label: "Procedure" },
              { value: "telephone", label: "Phone Call" },
              { value: "discharge", label: "Discharge" },
            ],
          },
        ]}
      />

      {isLoading ? (
        <LoadingState />
      ) : !data?.records.length ? (
        <EmptyState title="No consultation notes found." description="" icon={FileText} />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3">
            {data.records.map((note) => {
              const isExpanded = expandedId === note.id;
              return (
                <Card key={note.id} data-testid={`card-consultation-${note.id}`}>
                  <CardContent className="p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : note.id)}
                      data-testid={`button-expand-${note.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm" data-testid={`text-note-title-${note.id}`}>{note.title}</h3>
                            <NoteTypeBadge type={note.noteType} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {note.author} - {note.authorRole}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(note.encounterDate)}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3" data-testid={`detail-consultation-${note.id}`}>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Clinical Notes</p>
                          <p className="text-sm leading-relaxed">{note.content}</p>
                        </div>
                        {note.diagnosisCodes && note.diagnosisCodes.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Diagnosis Codes</p>
                            <div className="flex gap-1 flex-wrap">
                              {note.diagnosisCodes.map((code) => (
                                <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {note.procedureCodes && note.procedureCodes.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Procedure Codes</p>
                            <div className="flex gap-1 flex-wrap">
                              {note.procedureCodes.map((code) => (
                                <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {note.signedBy && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Signed by {note.signedBy} on {note.signedAt ? formatDateTime(note.signedAt) : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function PrescriptionsTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ records: Prescription[]; total: number }>({
    queryKey: ["secure-health-records", "prescriptions", PATIENT_ID, search, status],
    queryFn: () => fetchJson(buildUrl(`${API_BASE}/prescriptions/${PATIENT_ID}`, { search, status })),
  });

  return (
    <div className="space-y-4" data-testid="tab-prescriptions">
      <DataFiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search prescriptions..."
        searchTestId="input-search-prescriptions"
        filters={[
          {
            value: status,
            onChange: setStatus,
            placeholder: "Status",
            testId: "select-rx-status",
            options: [
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "filled", label: "Filled" },
              { value: "expired", label: "Expired" },
              { value: "on_hold", label: "On Hold" },
            ],
          },
        ]}
      />

      {isLoading ? (
        <LoadingState />
      ) : !data?.records.length ? (
        <EmptyState title="No prescriptions found." description="" icon={Pill} />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3">
            {data.records.map((rx) => {
              const isExpanded = expandedId === rx.id;
              return (
                <Card key={rx.id} data-testid={`card-prescription-${rx.id}`}>
                  <CardContent className="p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : rx.id)}
                      data-testid={`button-expand-${rx.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm" data-testid={`text-rx-name-${rx.id}`}>
                              {rx.medicationName} {rx.strength}
                            </h3>
                            <StatusBadge status={rx.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{rx.directions}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{rx.providerName}</span>
                            <span>{formatDate(rx.prescribedDate)}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t" data-testid={`detail-prescription-${rx.id}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Generic Name</p>
                            <p>{rx.genericName || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Dosage Form</p>
                            <p className="capitalize">{rx.dosageForm}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Quantity</p>
                            <p>{rx.quantity} ({rx.daysSupply} day supply)</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Refills</p>
                            <p>{rx.refillsRemaining} of {rx.refillsAuthorized} remaining</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Pharmacy</p>
                            <p>{rx.pharmacyName || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Expires</p>
                            <p>{formatDate(rx.expirationDate)}</p>
                          </div>
                          {rx.lastFilledDate && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Last Filled</p>
                              <p>{formatDate(rx.lastFilledDate)}</p>
                            </div>
                          )}
                          {rx.diagnosis && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                              <p>{rx.diagnosis} {rx.icdCode ? `(${rx.icdCode})` : ""}</p>
                            </div>
                          )}
                        </div>
                        {rx.isControlledSubstance && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Controlled Substance - DEA Schedule {rx.deaSchedule}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function LabResultsTab() {
  const [search, setSearch] = useState("");
  const [flag, setFlag] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ records: LabResultRecord[]; total: number; categories: string[] }>({
    queryKey: ["secure-health-records", "labs", PATIENT_ID, search, flag],
    queryFn: () => fetchJson(buildUrl(`${API_BASE}/lab-results/${PATIENT_ID}`, { search, flag })),
  });

  return (
    <div className="space-y-4" data-testid="tab-lab-results">
      <DataFiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search lab results..."
        searchTestId="input-search-labs"
        filters={[
          {
            value: flag,
            onChange: setFlag,
            placeholder: "Result Flag",
            testId: "select-lab-flag",
            options: [
              { value: "all", label: "All Results" },
              { value: "normal", label: "Normal" },
              { value: "abnormal", label: "Abnormal" },
              { value: "high", label: "High" },
              { value: "low", label: "Low" },
              { value: "critical_high", label: "Critical High" },
              { value: "critical_low", label: "Critical Low" },
            ],
          },
        ]}
      />

      {isLoading ? (
        <LoadingState />
      ) : !data?.records.length ? (
        <EmptyState title="No lab results found." description="" icon={FlaskConical} />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3">
            {data.records.map((lab) => {
              const isExpanded = expandedId === lab.id;
              return (
                <Card key={lab.id} data-testid={`card-lab-${lab.id}`}>
                  <CardContent className="p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : lab.id)}
                      data-testid={`button-expand-${lab.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm" data-testid={`text-lab-name-${lab.id}`}>{lab.testName}</h3>
                            <FlagBadge flag={lab.flag} />
                            <StatusBadge status={lab.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{lab.category}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(lab.resultDate)}
                            </span>
                            <span>{lab.performingLab}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3" data-testid={`detail-lab-${lab.id}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Value</p>
                            <p className="font-mono text-sm">{lab.value} {lab.unit !== "See components" ? lab.unit : ""}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Reference Range</p>
                            <p className="font-mono text-sm">{lab.referenceRange}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Collection Date</p>
                            <p>{formatDate(lab.collectionDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Ordering Provider</p>
                            <p>{lab.orderingProvider}</p>
                          </div>
                        </div>
                        {lab.notes && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                            <p className="text-sm">{lab.notes}</p>
                          </div>
                        )}
                        {lab.interpretation && (
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Clinical Interpretation</p>
                            <p className="text-sm">{lab.interpretation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function VisitHistoryTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ records: AppointmentHistoryEntry[]; total: number }>({
    queryKey: ["secure-health-records", "visits", PATIENT_ID, search, status],
    queryFn: () => fetchJson(buildUrl(`${API_BASE}/visits/${PATIENT_ID}`, { search, status })),
  });

  return (
    <div className="space-y-4" data-testid="tab-visits">
      <DataFiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search visits..."
        searchTestId="input-search-visits"
        filters={[
          {
            value: status,
            onChange: setStatus,
            placeholder: "Status",
            testId: "select-visit-status",
            options: [
              { value: "all", label: "All Statuses" },
              { value: "completed", label: "Completed" },
              { value: "scheduled", label: "Scheduled" },
              { value: "cancelled", label: "Cancelled" },
              { value: "no_show", label: "No Show" },
            ],
          },
        ]}
      />

      {isLoading ? (
        <LoadingState />
      ) : !data?.records.length ? (
        <EmptyState title="No visit records found." description="" icon={Calendar} />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3">
            {data.records.map((visit) => {
              const isExpanded = expandedId === visit.id;
              return (
                <Card key={visit.id} data-testid={`card-visit-${visit.id}`}>
                  <CardContent className="p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : visit.id)}
                      data-testid={`button-expand-${visit.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm" data-testid={`text-visit-type-${visit.id}`}>{visit.appointmentType}</h3>
                            <StatusBadge status={visit.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{visit.reasonForVisit}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {visit.provider}
                              {visit.providerSpecialty ? ` - ${visit.providerSpecialty}` : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(visit.appointmentDate)} at {visit.appointmentTime}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t" data-testid={`detail-visit-${visit.id}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Location</p>
                            <p className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {visit.location}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Duration</p>
                            <p className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {visit.duration} minutes
                            </p>
                          </div>
                        </div>
                        {visit.notes && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                            <p className="text-sm">{visit.notes}</p>
                          </div>
                        )}
                        {visit.followUpRequired && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Follow-up {visit.followUpDate ? `scheduled for ${formatDate(visit.followUpDate)}` : "required"}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default function SecureHealthRecords() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4" data-testid="secure-health-records-page">
      <PageHeader
        title="Health Records"
        subtitle="Securely view your medical history, consultations, prescriptions, and lab results"
        showSecurityBadge
        data-testid="page-header"
      />

      <Separator />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-health-records">
          <TabsTrigger value="overview" data-testid="tab-trigger-overview">
            <Activity className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="consultations" data-testid="tab-trigger-consultations">
            <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="prescriptions" data-testid="tab-trigger-prescriptions">
            <Pill className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Rx
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-trigger-labs">
            <FlaskConical className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Labs
          </TabsTrigger>
          <TabsTrigger value="visits" data-testid="tab-trigger-visits">
            <Calendar className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Visits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="consultations">
          <ConsultationsTab />
        </TabsContent>
        <TabsContent value="prescriptions">
          <PrescriptionsTab />
        </TabsContent>
        <TabsContent value="labs">
          <LabResultsTab />
        </TabsContent>
        <TabsContent value="visits">
          <VisitHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
