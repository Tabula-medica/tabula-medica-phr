import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  User,
  Calendar,
  Activity,
  FlaskConical,
  FileText,
  Phone,
  Mail,
  MapPin,
  Shield,
  Heart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  Stethoscope,
  DollarSign,
  CalendarPlus,
  Wifi,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Bell,
  Loader2,
  Video,
  MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type {
  ComprehensiveHealthRecord,
  AppointmentHistoryEntry,
  VitalSignRecord,
  LabResultRecord,
  ClinicianNote,
  HealthRecordSearchResult,
  TelehealthSession,
  ConsultationNote,
} from "@shared/schema";
import { Link } from "wouter";
import { StatusBadge, FlagBadge, LoadingState } from "@/components/shared";

const DEFAULT_PATIENT_ID = "patient-001";

function DemographicsSection({ demographics }: { demographics: ComprehensiveHealthRecord["demographics"] }) {
  return (
    <Card data-testid="card-demographics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Patient Demographics
        </CardTitle>
        <CardDescription>Personal and contact information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Personal Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium" data-testid="text-patient-name">
                  {demographics.firstName} {demographics.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Birth:</span>
                <span>{demographics.dateOfBirth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gender:</span>
                <span>{demographics.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language:</span>
                <span>{demographics.preferredLanguage}</span>
              </div>
              {demographics.maritalStatus && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marital Status:</span>
                  <span>{demographics.maritalStatus}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
            <div className="space-y-2">
              {demographics.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{demographics.phone}</span>
                </div>
              )}
              {demographics.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{demographics.email}</span>
                </div>
              )}
              {demographics.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm">
                    <div>{demographics.address.street}</div>
                    <div>
                      {demographics.address.city}, {demographics.address.state} {demographics.address.zipCode}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Healthcare Information</h4>
            <div className="space-y-2">
              {demographics.primaryCareProvider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PCP:</span>
                  <span className="text-right">{demographics.primaryCareProvider}</span>
                </div>
              )}
              {demographics.insuranceInfo && (
                <>
                  <div className="flex items-center gap-2 mt-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Insurance</span>
                  </div>
                  <div className="text-sm space-y-1 pl-6">
                    <div>{demographics.insuranceInfo.provider}</div>
                    <div className="text-muted-foreground">Policy: {demographics.insuranceInfo.policyNumber}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {demographics.emergencyContact && (
          <>
            <Separator className="my-4" />
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Emergency Contact</h4>
              <div className="flex gap-4 text-sm">
                <span className="font-medium">{demographics.emergencyContact.name}</span>
                <span className="text-muted-foreground">({demographics.emergencyContact.relationship})</span>
                <span>{demographics.emergencyContact.phone}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentCard({ appointment }: { appointment: AppointmentHistoryEntry }) {
  return (
    <div 
      className="p-4 border rounded-lg space-y-2"
      data-testid={`card-appointment-${appointment.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">{appointment.appointmentType}</h4>
          <p className="text-sm text-muted-foreground">{appointment.provider}</p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {appointment.appointmentDate}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {appointment.appointmentTime}
        </div>
        <span>{appointment.duration} min</span>
      </div>
      <p className="text-sm">{appointment.reasonForVisit}</p>
      {appointment.notes && (
        <p className="text-sm text-muted-foreground italic">{appointment.notes}</p>
      )}
      {appointment.followUpRequired && appointment.followUpDate && (
        <div className="text-sm text-blue-600 dark:text-blue-400">
          Follow-up scheduled: {appointment.followUpDate}
        </div>
      )}
    </div>
  );
}

function VitalCard({ vital }: { vital: VitalSignRecord }) {
  const getBPStatus = (systolic?: number, diastolic?: number) => {
    if (!systolic || !diastolic) return null;
    if (systolic >= 140 || diastolic >= 90) return { label: "High", color: "text-red-600" };
    if (systolic >= 130 || diastolic >= 80) return { label: "Elevated", color: "text-yellow-600" };
    return { label: "Normal", color: "text-green-600" };
  };

  const bpStatus = getBPStatus(vital.bloodPressureSystolic, vital.bloodPressureDiastolic);

  return (
    <div 
      className="p-4 border rounded-lg space-y-3"
      data-testid={`card-vital-${vital.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {new Date(vital.recordedAt).toLocaleDateString()} at{" "}
          {new Date(vital.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <span className="text-sm">{vital.location}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {vital.bloodPressureSystolic && vital.bloodPressureDiastolic && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Blood Pressure</div>
            <div className="font-medium">
              {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
            </div>
            {bpStatus && <div className={`text-xs ${bpStatus.color}`}>{bpStatus.label}</div>}
          </div>
        )}
        {vital.heartRate && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Heart Rate</div>
            <div className="font-medium">{vital.heartRate} bpm</div>
          </div>
        )}
        {vital.temperature && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Temperature</div>
            <div className="font-medium">
              {vital.temperature}°{vital.temperatureUnit}
            </div>
          </div>
        )}
        {vital.oxygenSaturation && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">O2 Saturation</div>
            <div className="font-medium">{vital.oxygenSaturation}%</div>
          </div>
        )}
        {vital.weight && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Weight</div>
            <div className="font-medium">
              {vital.weight} {vital.weightUnit}
            </div>
          </div>
        )}
        {vital.bmi && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">BMI</div>
            <div className="font-medium">{vital.bmi}</div>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">Recorded by: {vital.recordedBy}</div>
      {vital.notes && <p className="text-sm text-muted-foreground italic">{vital.notes}</p>}
    </div>
  );
}

function LabResultCard({ lab }: { lab: LabResultRecord }) {
  return (
    <div 
      className="p-4 border rounded-lg space-y-2"
      data-testid={`card-lab-${lab.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">{lab.testName}</h4>
          <p className="text-sm text-muted-foreground">{lab.category}</p>
        </div>
        <FlagBadge flag={lab.flag} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{lab.value}</span>
        <span className="text-muted-foreground">{lab.unit}</span>
        <span className="text-sm text-muted-foreground">({lab.referenceRange})</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Collected: {lab.collectionDate}</span>
        <span>Result: {lab.resultDate}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        Ordered by: {lab.orderingProvider} | Lab: {lab.performingLab}
      </div>
      {lab.interpretation && (
        <p className="text-sm bg-muted/50 p-2 rounded">{lab.interpretation}</p>
      )}
    </div>
  );
}

function ClinicianNoteCard({ note }: { note: ClinicianNote }) {
  const [expanded, setExpanded] = useState(false);

  const noteTypeLabels: Record<string, string> = {
    progress: "Progress Note",
    consultation: "Consultation",
    procedure: "Procedure Note",
    discharge: "Discharge Summary",
    telephone: "Telephone Encounter",
    nursing: "Nursing Note",
    social_work: "Social Work Note",
    therapy: "Therapy Note",
  };

  return (
    <div 
      className="p-4 border rounded-lg space-y-2"
      data-testid={`card-note-${note.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">{note.title}</h4>
          <p className="text-sm text-muted-foreground">
            {note.author} ({note.authorRole})
          </p>
        </div>
        <Badge variant="outline">{noteTypeLabels[note.noteType] || note.noteType}</Badge>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{note.encounterDate}</span>
        {note.encounterType && <span>{note.encounterType}</span>}
        {note.signedAt && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Signed
          </span>
        )}
      </div>
      <div className="text-sm">
        {expanded ? (
          <pre className="whitespace-pre-wrap font-sans">{note.content}</pre>
        ) : (
          <p>{note.content.substring(0, 200)}...</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-note-${note.id}`}
      >
        {expanded ? "Show Less" : "Read More"}
      </Button>
      {note.diagnosisCodes && note.diagnosisCodes.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {note.diagnosisCodes.map((code) => (
            <Badge key={code} variant="secondary" className="text-xs">
              {code}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ results }: { results: HealthRecordSearchResult[] }) {
  const typeIcons: Record<string, typeof Calendar> = {
    appointment: Calendar,
    vital: Activity,
    lab: FlaskConical,
    note: FileText,
  };

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const Icon = typeIcons[result.type] || FileText;
        return (
          <div 
            key={`${result.type}-${result.id}`} 
            className="p-3 border rounded-lg flex items-start gap-3"
            data-testid={`search-result-${result.id}`}
          >
            <div className="p-2 bg-muted rounded">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {result.type}
                </Badge>
                <span className="text-sm text-muted-foreground">{result.date}</span>
              </div>
              <h4 className="font-medium truncate">{result.title}</h4>
              <p className="text-sm text-muted-foreground truncate">{result.summary}</p>
              {result.provider && (
                <p className="text-xs text-muted-foreground">{result.provider}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PatientHealthRecord() {
  const [patientId] = useState(DEFAULT_PATIENT_ID);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRecordType, setSelectedRecordType] = useState<string>("all");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>("all");
  const [vitalsLocationFilter, setVitalsLocationFilter] = useState<string>("all");
  const [labCategoryFilter, setLabCategoryFilter] = useState<string>("all");
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>("all");

  const { data: healthRecord, isLoading, refetch } = useQuery<ComprehensiveHealthRecord>({
    queryKey: ["/api/patient-health-record/patient", patientId],
  });

  const { data: labCategories } = useQuery<string[]>({
    queryKey: ["/api/patient-health-record/lab-categories"],
  });

  const { data: noteTypes } = useQuery<Array<{ value: string; label: string }>>({
    queryKey: ["/api/patient-health-record/note-types"],
  });

  const { data: uspstfGuidelines, isLoading: uspstfLoading } = useQuery<{
    recommendations: Array<{
      id: string;
      title: string;
      grade: "A" | "B" | "C" | "D" | "I";
      category: string;
      ageRange: { min: number; max: number };
      gender: string;
      frequency: string;
      description: string;
      rationale: string;
    }>;
    aiSummary: string;
    educationalNotes: string[];
    noCdsCompliance: string;
  }>({
    queryKey: ["/api/patient-health-record/patient", patientId, "uspstf-guidelines"],
    enabled: activeTab === "preventive",
  });

  const { data: claimsAnalysis, isLoading: claimsLoading } = useQuery<{
    totalClaims: number;
    totalCharged: number;
    totalPaid: number;
    totalPatientResponsibility: number;
    approvalRate: number;
    denialRate: number;
    byCategory: Record<string, { count: number; charged: number; paid: number }>;
    byStatus: Record<string, number>;
    monthlyTrends: Array<{ month: string; claims: number; charged: number; paid: number }>;
    topDiagnoses: Array<{ code: string; description: string; count: number }>;
    topProcedures: Array<{ code: string; description: string; count: number; avgCost: number }>;
  }>({
    queryKey: ["/api/patient-health-record/patient", patientId, "claims-analysis"],
    enabled: activeTab === "preventive",
  });

  const { data: claimsInsights, isLoading: insightsLoading } = useQuery<{
    insights: Array<{
      category: string;
      insight: string;
      recommendation: string;
      priority: "high" | "medium" | "low";
      potentialSavings?: number;
    }>;
    summary: string;
    noCdsCompliance: string;
  }>({
    queryKey: ["/api/patient-health-record/patient", patientId, "claims-insights"],
    enabled: activeTab === "preventive",
  });

  const { data: upcomingAppointments, refetch: refetchAppointments } = useQuery<AppointmentHistoryEntry[]>({
    queryKey: ["/api/patient-health-record/patient", patientId, "upcoming-appointments"],
    enabled: activeTab === "preventive",
  });

  const { data: telehealthSessions, isLoading: telehealthSessionsLoading } = useQuery<TelehealthSession[]>({
    queryKey: ["/api/patients", patientId, "telehealth", "sessions"],
    enabled: activeTab === "telehealth",
  });

  const { data: consultationNotes, isLoading: consultationNotesLoading } = useQuery<ConsultationNote[]>({
    queryKey: ["/api/patients", patientId, "telehealth", "notes"],
    enabled: activeTab === "telehealth",
  });

  const { data: monitoringDashboard, isLoading: monitoringLoading } = useQuery<{
    patientId: string;
    patientName: string;
    recentVitals: Array<{
      id: string;
      vitalType: string;
      value: number;
      unit: string;
      recordedAt: string;
      isAbnormal: boolean;
      abnormalReason?: string;
      source: string;
      deviceName?: string;
    }>;
    recentStatusUpdates: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      overallFeeling: number;
      submittedAt: string;
      flaggedForAttention: boolean;
    }>;
    flaggedItems: number;
    lastSubmission: string;
    complianceScore: number;
    trends: Array<{
      vitalType: string;
      average: number;
      min: number;
      max: number;
      trend: string;
      dataPoints: number;
      unit: string;
    }>;
  }>({
    queryKey: ["/api/patient-health-record/patient", patientId, "monitoring-dashboard"],
    enabled: activeTab === "preventive",
  });

  const [preventiveSubTab, setPreventiveSubTab] = useState("uspstf");
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: { appointmentDate: string; appointmentTime: string; appointmentType: string; reasonForVisit: string }) => {
      const response = await apiRequest("POST", `/api/patient-health-record/patient/${patientId}/appointments`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchAppointments();
      setNewAppointmentOpen(false);
    },
  });

  const setReminderMutation = useMutation({
    mutationFn: async ({ appointmentId, reminderDate }: { appointmentId: string; reminderDate: string }) => {
      const response = await apiRequest("POST", `/api/patient-health-record/patient/${patientId}/appointments/${appointmentId}/reminder`, { reminderDate });
      return response.json();
    },
  });

  const [searchResults, setSearchResults] = useState<HealthRecordSearchResult[]>([]);
  const searchMutation = useMutation({
    mutationFn: async ({ query, recordType }: { query: string; recordType: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/patient-health-record/patient/${patientId}/search`,
        { searchQuery: query, recordType }
      );
      return response.json() as Promise<HealthRecordSearchResult[]>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchMutation.mutate({ query, recordType: selectedRecordType });
    } else {
      setSearchResults([]);
    }
  };

  const handleRecordTypeChange = (value: string) => {
    setSelectedRecordType(value);
    if (searchQuery.trim()) {
      searchMutation.mutate({ query: searchQuery, recordType: value });
    }
  };

  const filteredAppointments = healthRecord?.appointmentHistory.filter((apt) => {
    if (appointmentStatusFilter !== "all" && apt.status !== appointmentStatusFilter) return false;
    return true;
  });

  const filteredVitals = healthRecord?.vitalSigns.filter((vital) => {
    if (vitalsLocationFilter !== "all" && vital.location !== vitalsLocationFilter) return false;
    return true;
  });

  const vitalLocations = healthRecord?.vitalSigns
    ? Array.from(new Set(healthRecord.vitalSigns.map((v) => v.location)))
    : [];

  const filteredLabs = healthRecord?.labResults.filter((lab) => {
    if (labCategoryFilter !== "all" && lab.category !== labCategoryFilter) return false;
    return true;
  });

  const filteredNotes = healthRecord?.clinicianNotes.filter((note) => {
    if (noteTypeFilter !== "all" && note.noteType !== noteTypeFilter) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!healthRecord) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No patient record found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-patient-health-record">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Patient Health Record</h1>
          <p className="text-muted-foreground">
            Comprehensive view of all patient health data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-record"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card data-testid="card-search">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records (appointments, vitals, labs, notes)..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                data-testid="input-search-records"
              />
            </div>
            <Select value={selectedRecordType} onValueChange={handleRecordTypeChange}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-record-type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Record type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="select-item-all">All Records</SelectItem>
                <SelectItem value="appointments" data-testid="select-item-appointments">Appointments</SelectItem>
                <SelectItem value="vitals" data-testid="select-item-vitals">Vital Signs</SelectItem>
                <SelectItem value="labs" data-testid="select-item-labs">Lab Results</SelectItem>
                <SelectItem value="notes" data-testid="select-item-notes">Clinical Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchQuery.trim() && (
            <div className="mt-4">
              {searchMutation.isPending ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <>
                  <div className="text-sm text-muted-foreground mb-2">
                    Found {searchResults.length} results
                  </div>
                  <SearchResults results={searchResults} />
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No results found</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-appointments">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{healthRecord.totalRecords.appointments}</div>
                <div className="text-sm text-muted-foreground">Appointments</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-vitals">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{healthRecord.totalRecords.vitals}</div>
                <div className="text-sm text-muted-foreground">Vital Records</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-labs">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{healthRecord.totalRecords.labs}</div>
                <div className="text-sm text-muted-foreground">Lab Results</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-notes">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{healthRecord.totalRecords.notes}</div>
                <div className="text-sm text-muted-foreground">Clinical Notes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7" data-testid="tabs-health-record">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">Labs</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          <TabsTrigger value="telehealth" data-testid="tab-telehealth">Telehealth</TabsTrigger>
          <TabsTrigger value="preventive" data-testid="tab-preventive">Preventive</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <DemographicsSection demographics={healthRecord.demographics} />

          <div className="grid md:grid-cols-2 gap-6">
            <Card data-testid="card-recent-appointments">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {healthRecord.appointmentHistory.slice(0, 3).map((apt) => (
                      <AppointmentCard key={apt.id} appointment={apt} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-latest-vitals">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Latest Vitals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthRecord.vitalSigns[0] && (
                  <VitalCard vital={healthRecord.vitalSigns[0]} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-recent-labs">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Recent Lab Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {healthRecord.labResults.slice(0, 4).map((lab) => (
                  <LabResultCard key={lab.id} lab={lab} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Appointment History
                </CardTitle>
                <Select value={appointmentStatusFilter} onValueChange={setAppointmentStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-appointment-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-apt-status-all">All Statuses</SelectItem>
                    <SelectItem value="completed" data-testid="select-apt-status-completed">Completed</SelectItem>
                    <SelectItem value="scheduled" data-testid="select-apt-status-scheduled">Scheduled</SelectItem>
                    <SelectItem value="cancelled" data-testid="select-apt-status-cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show" data-testid="select-apt-status-no-show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredAppointments?.map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Vital Signs History
                  </CardTitle>
                  <CardDescription>
                    Complete record of vital sign measurements
                  </CardDescription>
                </div>
                <Select value={vitalsLocationFilter} onValueChange={setVitalsLocationFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-vitals-location">
                    <SelectValue placeholder="Filter by location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-vitals-loc-all">All Locations</SelectItem>
                    {vitalLocations.map((loc) => (
                      <SelectItem key={loc} value={loc} data-testid={`select-vitals-loc-${loc.toLowerCase().replace(/\s+/g, '-')}`}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredVitals?.map((vital) => (
                    <VitalCard key={vital.id} vital={vital} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Laboratory Results
                </CardTitle>
                <Select value={labCategoryFilter} onValueChange={setLabCategoryFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-lab-category">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-lab-cat-all">All Categories</SelectItem>
                    {labCategories?.map((cat) => (
                      <SelectItem key={cat} value={cat} data-testid={`select-lab-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="grid md:grid-cols-2 gap-3">
                  {filteredLabs?.map((lab) => (
                    <LabResultCard key={lab.id} lab={lab} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Clinical Notes
                </CardTitle>
                <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-note-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="select-note-type-all">All Types</SelectItem>
                    {noteTypes?.map((type) => (
                      <SelectItem key={type.value} value={type.value} data-testid={`select-note-type-${type.value}`}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredNotes?.map((note) => (
                    <ClinicianNoteCard key={note.id} note={note} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telehealth" className="space-y-6 mt-6">
          <Alert>
            <Video className="h-4 w-4" />
            <AlertDescription>
              View your telehealth session history and consultation notes. Schedule new virtual appointments through the Appointments tab.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <Card data-testid="card-telehealth-sessions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Telehealth Sessions
                </CardTitle>
                <CardDescription>
                  Video consultation history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {telehealthSessionsLoading ? (
                  <LoadingState />
                ) : telehealthSessions && telehealthSessions.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {telehealthSessions.map((session) => (
                        <Card key={session.id} className="p-4" data-testid={`card-telehealth-session-${session.id}`}>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">{session.providerName}</div>
                              {session.providerSpecialty && (
                                <div className="text-sm text-muted-foreground">{session.providerSpecialty}</div>
                              )}
                              <div className="text-sm text-muted-foreground capitalize">
                                {session.consultationType.replace(/_/g, " ")}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(session.scheduledAt).toLocaleString()}
                                {session.duration && <span>({session.duration} min)</span>}
                              </div>
                            </div>
                            <StatusBadge
                              status={session.status}
                              data-testid={`badge-session-status-${session.id}`}
                            />
                          </div>
                          <div className="mt-2 text-sm">{session.reasonForVisit}</div>
                          {session.status === "scheduled" && (
                            <div className="mt-3">
                              <Link href={`/patients/${patientId}/telehealth/room/${session.roomId}`}>
                                <Button size="sm" data-testid={`button-join-session-${session.id}`}>
                                  <Video className="h-4 w-4 mr-2" />
                                  Join Session
                                </Button>
                              </Link>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No telehealth sessions yet</p>
                    <Link href={`/patients/${patientId}/telehealth`}>
                      <Button variant="outline" className="mt-3" data-testid="button-schedule-telehealth">
                        Schedule a Virtual Visit
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-consultation-notes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Consultation Notes
                </CardTitle>
                <CardDescription>
                  Documentation from video consultations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {consultationNotesLoading ? (
                  <LoadingState />
                ) : consultationNotes && consultationNotes.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {consultationNotes.map((note) => (
                        <Card key={note.id} className="p-4" data-testid={`card-consultation-note-${note.id}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium">{note.chiefComplaint}</div>
                              <div className="text-sm text-muted-foreground">{note.providerName}</div>
                            </div>
                            {note.signedAt && (
                              <Badge variant="secondary">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Signed
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Assessment: </span>
                              <span>{note.assessment}</span>
                            </div>

                            {note.diagnoses && note.diagnoses.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {note.diagnoses.map((dx, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {dx.code}: {dx.description}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {note.prescriptions && note.prescriptions.length > 0 && (
                              <div>
                                <span className="text-muted-foreground">Prescriptions: </span>
                                {note.prescriptions.map((rx) => rx.medicationName).join(", ")}
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No consultation notes yet</p>
                    <p className="text-sm">Notes from completed telehealth visits will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-telehealth-quick-actions">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link href={`/patients/${patientId}/telehealth`}>
                  <Button variant="outline" data-testid="button-view-all-sessions">
                    <Video className="h-4 w-4 mr-2" />
                    View All Sessions
                  </Button>
                </Link>
                <Link href={`/patients/${patientId}/messages`}>
                  <Button variant="outline" data-testid="button-message-provider">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message Provider
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preventive" className="mt-6">
          <Alert className="mb-6">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>EDUCATIONAL INFORMATION ONLY.</strong> This section provides general health education and administrative tools. 
              It does NOT provide medical advice or recommendations. Always consult your healthcare provider for personalized care decisions.
            </AlertDescription>
          </Alert>

          <Tabs value={preventiveSubTab} onValueChange={setPreventiveSubTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6" data-testid="tabs-preventive">
              <TabsTrigger value="uspstf" data-testid="subtab-uspstf">
                <Stethoscope className="h-4 w-4 mr-2" />
                USPSTF Guidelines
              </TabsTrigger>
              <TabsTrigger value="claims" data-testid="subtab-claims">
                <DollarSign className="h-4 w-4 mr-2" />
                Claims Analysis
              </TabsTrigger>
              <TabsTrigger value="scheduling" data-testid="subtab-scheduling">
                <CalendarPlus className="h-4 w-4 mr-2" />
                Appointments
              </TabsTrigger>
              <TabsTrigger value="monitoring" data-testid="subtab-monitoring">
                <Wifi className="h-4 w-4 mr-2" />
                Remote Monitoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="uspstf">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    Age-Based Preventive Care Guidelines
                  </CardTitle>
                  <CardDescription>
                    USPSTF recommendations based on age and risk factors (educational purposes only)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {uspstfLoading ? (
                    <LoadingState />
                  ) : uspstfGuidelines ? (
                    <div className="space-y-6">
                      <Alert>
                        <AlertDescription className="text-sm">
                          {uspstfGuidelines.aiSummary}
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <h4 className="font-medium">Educational Notes:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {uspstfGuidelines.educationalNotes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {uspstfGuidelines.recommendations.map((rec) => (
                            <Card key={rec.id} className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant={rec.grade === "A" ? "default" : "secondary"}>
                                      Grade {rec.grade}
                                    </Badge>
                                    <Badge variant="outline">{rec.category}</Badge>
                                  </div>
                                  <h4 className="font-medium">{rec.title}</h4>
                                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>Ages {rec.ageRange.min}-{rec.ageRange.max}</span>
                                    <span>Frequency: {rec.frequency}</span>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>

                      <Alert variant="default" className="bg-muted">
                        <AlertDescription className="text-xs">
                          {uspstfGuidelines.noCdsCompliance}
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No guidelines available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="claims">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Claims Data Analysis
                    </CardTitle>
                    <CardDescription>
                      Financial and administrative analysis of healthcare claims (billing information only)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {claimsLoading || insightsLoading ? (
                      <LoadingState />
                    ) : claimsAnalysis ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="p-4">
                            <div className="text-sm text-muted-foreground">Total Claims</div>
                            <div className="text-2xl font-bold">{claimsAnalysis.totalClaims}</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-sm text-muted-foreground">Total Charged</div>
                            <div className="text-2xl font-bold">${claimsAnalysis.totalCharged.toLocaleString()}</div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-sm text-muted-foreground">Approval Rate</div>
                            <div className="text-2xl font-bold text-green-600">
                              {(claimsAnalysis.approvalRate * 100).toFixed(1)}%
                            </div>
                          </Card>
                          <Card className="p-4">
                            <div className="text-sm text-muted-foreground">Patient Responsibility</div>
                            <div className="text-2xl font-bold text-orange-600">
                              ${claimsAnalysis.totalPatientResponsibility.toLocaleString()}
                            </div>
                          </Card>
                        </div>

                        {claimsInsights && (
                          <div className="space-y-4">
                            <h4 className="font-medium">AI Billing Insights</h4>
                            {claimsInsights.insights.map((insight, i) => (
                              <Card key={i} className="p-4">
                                <div className="flex items-start gap-3">
                                  <Badge variant={insight.priority === "high" ? "destructive" : insight.priority === "medium" ? "default" : "secondary"}>
                                    {insight.priority}
                                  </Badge>
                                  <div>
                                    <div className="font-medium text-sm">{insight.category}</div>
                                    <p className="text-sm text-muted-foreground">{insight.insight}</p>
                                    <p className="text-sm mt-1">{insight.recommendation}</p>
                                  </div>
                                </div>
                              </Card>
                            ))}
                            <Alert variant="default" className="bg-muted">
                              <AlertDescription className="text-xs">
                                {claimsInsights.noCdsCompliance}
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}

                        <Separator />

                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-3">Top Procedures by Cost</h4>
                            <div className="space-y-2">
                              {claimsAnalysis.topProcedures.slice(0, 5).map((proc) => (
                                <div key={proc.code} className="flex justify-between text-sm">
                                  <span className="truncate flex-1">{proc.description}</span>
                                  <span className="text-muted-foreground ml-2">${proc.avgCost.toFixed(0)} avg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-3">Claims by Status</h4>
                            <div className="space-y-2">
                              {Object.entries(claimsAnalysis.byStatus).map(([status, count]) => (
                                <div key={status} className="flex justify-between text-sm">
                                  <span className="capitalize">{status.replace("_", " ")}</span>
                                  <Badge variant="outline">{count}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No claims data available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scheduling">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarPlus className="h-5 w-5" />
                          Appointment Management
                        </CardTitle>
                        <CardDescription>
                          Schedule, reschedule, and set reminders for appointments
                        </CardDescription>
                      </div>
                      <Button onClick={() => setNewAppointmentOpen(!newAppointmentOpen)} data-testid="button-new-appointment">
                        <Plus className="h-4 w-4 mr-2" />
                        New Appointment
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {newAppointmentOpen && (
                      <Card className="mb-6 p-4 bg-muted/50">
                        <h4 className="font-medium mb-4">Schedule New Appointment</h4>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            scheduleAppointmentMutation.mutate({
                              appointmentDate: formData.get("date") as string,
                              appointmentTime: formData.get("time") as string,
                              appointmentType: formData.get("type") as string,
                              reasonForVisit: formData.get("reason") as string,
                            });
                          }}
                          className="grid md:grid-cols-2 gap-4"
                        >
                          <div>
                            <label className="text-sm font-medium">Date</label>
                            <Input type="date" name="date" required data-testid="input-appointment-date" />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Time</label>
                            <Input type="time" name="time" required data-testid="input-appointment-time" />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Type</label>
                            <Select name="type" defaultValue="follow-up">
                              <SelectTrigger data-testid="select-appointment-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="follow-up" data-testid="select-apt-type-followup">Follow-up</SelectItem>
                                <SelectItem value="annual-physical" data-testid="select-apt-type-annual">Annual Physical</SelectItem>
                                <SelectItem value="specialist" data-testid="select-apt-type-specialist">Specialist Consultation</SelectItem>
                                <SelectItem value="lab-work" data-testid="select-apt-type-lab">Lab Work</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Reason</label>
                            <Input name="reason" placeholder="Reason for visit" data-testid="input-appointment-reason" />
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            <Button type="submit" disabled={scheduleAppointmentMutation.isPending} data-testid="button-schedule-appointment">
                              {scheduleAppointmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Schedule
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setNewAppointmentOpen(false)} data-testid="button-cancel-appointment">
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </Card>
                    )}

                    <div className="space-y-4">
                      <h4 className="font-medium">Upcoming Appointments</h4>
                      {upcomingAppointments && upcomingAppointments.length > 0 ? (
                        <div className="space-y-3">
                          {upcomingAppointments.map((apt) => (
                            <Card key={apt.id} className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline">{apt.appointmentType}</Badge>
                                    <span className="text-sm text-muted-foreground">{apt.appointmentDate} at {apt.appointmentTime}</span>
                                  </div>
                                  <p className="font-medium">{apt.provider}</p>
                                  <p className="text-sm text-muted-foreground">{apt.location}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReminderMutation.mutate({ appointmentId: apt.id, reminderDate: apt.appointmentDate })}
                                  disabled={setReminderMutation.isPending}
                                  data-testid={`button-reminder-${apt.id}`}
                                >
                                  <Bell className="h-4 w-4 mr-1" />
                                  Remind Me
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No upcoming appointments scheduled.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="monitoring">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Remote Patient Monitoring
                  </CardTitle>
                  <CardDescription>
                    Track vital signs and health status updates remotely
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {monitoringLoading ? (
                    <LoadingState />
                  ) : monitoringDashboard ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                          <div className="text-sm text-muted-foreground">Compliance Score</div>
                          <div className="text-2xl font-bold text-green-600">{monitoringDashboard.complianceScore}%</div>
                          <Progress value={monitoringDashboard.complianceScore} className="mt-2" />
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-muted-foreground">Flagged Items</div>
                          <div className={`text-2xl font-bold ${monitoringDashboard.flaggedItems > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {monitoringDashboard.flaggedItems}
                          </div>
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-muted-foreground">Recent Vitals</div>
                          <div className="text-2xl font-bold">{monitoringDashboard.recentVitals.length}</div>
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-muted-foreground">Last Submission</div>
                          <div className="text-sm font-medium">
                            {monitoringDashboard.lastSubmission ? new Date(monitoringDashboard.lastSubmission).toLocaleDateString() : "N/A"}
                          </div>
                        </Card>
                      </div>

                      <Separator />

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3">Recent Vital Submissions</h4>
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-3">
                              {monitoringDashboard.recentVitals.map((vital) => (
                                <Card key={vital.id} className={`p-3 ${vital.isAbnormal ? "border-orange-500" : ""}`}>
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium capitalize">{vital.vitalType.replace(/_/g, " ")}</span>
                                        {vital.isAbnormal && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                      </div>
                                      <div className="text-lg font-bold">{vital.value} {vital.unit}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(vital.recordedAt).toLocaleString()} via {vital.source.replace(/_/g, " ")}
                                      </div>
                                    </div>
                                    {vital.deviceName && (
                                      <Badge variant="outline" className="text-xs">{vital.deviceName}</Badge>
                                    )}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Vital Trends (30 Days)</h4>
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-3">
                              {monitoringDashboard.trends.map((trend) => (
                                <Card key={trend.vitalType} className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium capitalize">{trend.vitalType.replace(/_/g, " ")}</span>
                                      <div className="text-sm text-muted-foreground">
                                        Avg: {trend.average} {trend.unit} ({trend.dataPoints} readings)
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {trend.trend === "improving" && <TrendingUp className="h-4 w-4 text-green-600" />}
                                      {trend.trend === "worsening" && <TrendingDown className="h-4 w-4 text-red-600" />}
                                      {trend.trend === "stable" && <Minus className="h-4 w-4 text-blue-600" />}
                                      <Badge variant={trend.trend === "improving" ? "default" : trend.trend === "worsening" ? "destructive" : "secondary"}>
                                        {trend.trend}
                                      </Badge>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-3">Recent Health Status Updates</h4>
                        <div className="space-y-3">
                          {monitoringDashboard.recentStatusUpdates.slice(0, 3).map((status) => (
                            <Card key={status.id} className={`p-4 ${status.flaggedForAttention ? "border-orange-500" : ""}`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="capitalize">{status.type.replace(/_/g, " ")}</Badge>
                                    {status.flaggedForAttention && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                  </div>
                                  <h5 className="font-medium">{status.title}</h5>
                                  <p className="text-sm text-muted-foreground">{status.description}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>Feeling: {status.overallFeeling}/10</span>
                                    <span>{new Date(status.submittedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No monitoring data available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
