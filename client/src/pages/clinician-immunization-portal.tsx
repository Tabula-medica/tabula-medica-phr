import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Info,
  Link2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Syringe,
  User,
  Users,
  XCircle,
} from "lucide-react";

interface ClinicianProfile {
  id: string;
  name: string;
  credentials: string[];
  role: string;
  organizationName: string;
  canVerifyRecords: boolean;
  canEditRecords: boolean;
  canConnectIIS: boolean;
  canGenerateReports: boolean;
  canCommunicatePatients: boolean;
}

interface PatientProfile {
  patientId: string;
  profileId: string;
  fullName: string;
  dateOfBirth: string;
  mrn?: string;
  phone?: string;
  email?: string;
  vaccineScheduleStatus: VaccineScheduleStatus[];
  immunizationHistory: ImmunizationRecord[];
  iisConsentStatus: IISConsentRecord[];
}

interface VaccineScheduleStatus {
  vaccineGroup: string;
  vaccineName: string;
  status: "up_to_date" | "due" | "overdue" | "not_applicable" | "contraindicated";
  dosesReceived: number;
  dosesRequired: number;
  nextDoseDate?: string;
  catchUpRequired: boolean;
  lastDoseDate?: string;
}

interface ImmunizationRecord {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  vaccineGroup: string;
  administeredDate: string;
  administeredBy?: string;
  lotNumber?: string;
  site?: string;
  verificationStatus: string;
  verifiedBy?: string;
  source: string;
  status: string;
}

interface IISConsentRecord {
  id: string;
  stateCode: string;
  stateName: string;
  consentType: string;
  status: string;
  grantedAt: string;
  expiresAt?: string;
}

interface DetectedStateIIS {
  stateCode: string;
  stateName: string;
  registryName: string;
  source: "current_address" | "address_history" | "birth_state" | "insurance_region";
  confidence: "high" | "medium" | "low";
  hasConsent: boolean;
  consentId?: string;
  consentStatus?: string;
  connectorStatus: "available" | "unavailable" | "connected";
  features: {
    queryByPatient: boolean;
    historyRetrieval: boolean;
    forecastSupport: boolean;
  };
  recommendation: "connect" | "request_consent" | "already_connected" | "unavailable";
  estimatedRecords?: number;
}

interface AutoIISDetectionResult {
  patientId: string;
  detectedStates: DetectedStateIIS[];
  suggestedPrimaryState: string;
  totalStatesDetected: number;
  disclaimer: string;
}

interface DashboardStats {
  totalPatients: number;
  patientsOverdue: number;
  patientsDue: number;
  patientsUpToDate: number;
  pendingVerifications: number;
  recentMessages: number;
  iisConnectionsActive: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: string;
}

const CLINICIAN_ID = "clin-001";

export default function ClinicianImmunizationPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [showAddRecordDialog, setShowAddRecordDialog] = useState(false);
  const [showEditRecordDialog, setShowEditRecordDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showIISConnectDialog, setShowIISConnectDialog] = useState(false);
  const [showCreateConsentDialog, setShowCreateConsentDialog] = useState(false);
  const [showAutoDetectDialog, setShowAutoDetectDialog] = useState(false);
  const [autoDetectDisclaimer, setAutoDetectDisclaimer] = useState("");
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<ImmunizationRecord | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [selectedReportType, setSelectedReportType] = useState("full_history");
  const [newConsentState, setNewConsentState] = useState("CA");
  const [autoDetectionResult, setAutoDetectionResult] = useState<AutoIISDetectionResult | null>(null);
  const [selectedStatesToConnect, setSelectedStatesToConnect] = useState<string[]>([]);
  
  const [newRecord, setNewRecord] = useState({
    vaccineName: "",
    vaccineCode: "",
    vaccineGroup: "",
    administeredDate: "",
    lotNumber: "",
    site: "",
    notes: "",
  });

  const [editRecord, setEditRecord] = useState({
    vaccineName: "",
    vaccineCode: "",
    vaccineGroup: "",
    administeredDate: "",
    lotNumber: "",
    site: "",
    notes: "",
  });
  
  const [newMessage, setNewMessage] = useState({
    subject: "",
    content: "",
    messageType: "reminder",
    priority: "normal",
  });

  const { data: clinicianData, isLoading: clinicianLoading } = useQuery<{ clinician: ClinicianProfile }>({
    queryKey: [`/api/clinician-immunization-portal/clinicians/${CLINICIAN_ID}`],
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ stats: DashboardStats }>({
    queryKey: [`/api/clinician-immunization-portal/dashboard/${CLINICIAN_ID}`],
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery<{ patients: PatientProfile[] }>({
    queryKey: [`/api/clinician-immunization-portal/patients/search?clinicianId=${CLINICIAN_ID}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`],
  });

  const { data: templatesData } = useQuery<{ templates: MessageTemplate[] }>({
    queryKey: ["/api/clinician-immunization-portal/message-templates"],
  });

  const addRecordMutation = useMutation({
    mutationFn: async (data: { patientId: string; record: typeof newRecord }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/immunizations`, {
        ...data.record,
        clinicianId: CLINICIAN_ID,
        status: "completed",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ title: "Success", description: "Immunization record added successfully" });
      setShowAddRecordDialog(false);
      setNewRecord({ vaccineName: "", vaccineCode: "", vaccineGroup: "", administeredDate: "", lotNumber: "", site: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add immunization record", variant: "destructive" });
    },
  });

  const verifyRecordMutation = useMutation({
    mutationFn: async (data: { patientId: string; recordId: string }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/immunizations/${data.recordId}/verify`, {
        clinicianId: CLINICIAN_ID,
        verificationNotes: "Clinician verified",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ title: "Verified", description: "Immunization record verified successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to verify record", variant: "destructive" });
    },
  });

  const connectIISMutation = useMutation({
    mutationFn: async (data: { patientId: string; stateCode: string; consentId: string }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/iis-connect`, {
        clinicianId: CLINICIAN_ID,
        stateCode: data.stateCode,
        consentId: data.consentId,
        connectionType: "query",
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ 
        title: "IIS Connection Successful", 
        description: `Imported ${data.result?.recordsImported || 0} records from state registry` 
      });
      setShowIISConnectDialog(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to connect to State IIS", variant: "destructive" });
    },
  });

  const editRecordMutation = useMutation({
    mutationFn: async (data: { patientId: string; recordId: string; record: typeof editRecord }) => {
      const response = await apiRequest("PUT", `/api/clinician-immunization-portal/patients/${data.patientId}/immunizations/${data.recordId}`, {
        ...data.record,
        clinicianId: CLINICIAN_ID,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ title: "Success", description: "Immunization record updated successfully" });
      setShowEditRecordDialog(false);
      setSelectedRecordToEdit(null);
      setEditRecord({ vaccineName: "", vaccineCode: "", vaccineGroup: "", administeredDate: "", lotNumber: "", site: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update immunization record", variant: "destructive" });
    },
  });

  const createConsentMutation = useMutation({
    mutationFn: async (data: { patientId: string; stateCode: string }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/iis-consent`, {
        clinicianId: CLINICIAN_ID,
        stateCode: data.stateCode,
        consentType: "query_and_report",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ title: "Consent Created", description: "IIS consent record created successfully" });
      setShowCreateConsentDialog(false);
      setNewConsentState("CA");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create consent record", variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { patientId: string; reportType: string }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/reports`, {
        clinicianId: CLINICIAN_ID,
        reportType: data.reportType,
        format: "pdf",
        includeScheduleStatus: true,
        includeRecommendations: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      if (data.report?.downloadUrl) {
        setReportUrl(data.report.downloadUrl);
      }
      toast({ title: "Report Generated", description: "Immunization report has been generated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { patientId: string; message: typeof newMessage }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/messages`, {
        clinicianId: CLINICIAN_ID,
        clinicianName: clinicianData?.clinician?.name || "Clinician",
        ...data.message,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ title: "Message Sent", description: "Message has been sent to the patient" });
      setShowMessageDialog(false);
      setNewMessage({ subject: "", content: "", messageType: "reminder", priority: "normal" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const autoDetectIISMutation = useMutation({
    mutationFn: async (patientId: string) => {
      if (!patientId) throw new Error("Patient ID is required");
      const response = await fetch(`/api/clinician-immunization-portal/patients/${patientId}/iis-auto-detect?clinicianId=${CLINICIAN_ID}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to auto-detect IIS" }));
        throw new Error(error.error || "Failed to auto-detect IIS");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setAutoDetectionResult(data.detection);
      setAutoDetectDisclaimer(data.disclaimer || "");
      setSelectedStatesToConnect([]);
      toast({ 
        title: "IIS Detection Complete", 
        description: `Found ${data.detection.totalStatesDetected} potential state registries` 
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to auto-detect IIS connections", variant: "destructive" });
    },
  });

  const batchConsentMutation = useMutation({
    mutationFn: async (data: { patientId: string; stateCodes: string[] }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/iis-batch-consent`, {
        clinicianId: CLINICIAN_ID,
        stateCodes: data.stateCodes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ 
        title: "Consents Created", 
        description: `Created ${data.consents.length} consent records` 
      });
      if (selectedPatient) {
        autoDetectIISMutation.mutate(selectedPatient.patientId);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create batch consents", variant: "destructive" });
    },
  });

  const batchConnectMutation = useMutation({
    mutationFn: async (data: { patientId: string; stateConnections: { stateCode: string; consentId: string }[] }) => {
      const response = await apiRequest("POST", `/api/clinician-immunization-portal/patients/${data.patientId}/iis-batch-connect`, {
        clinicianId: CLINICIAN_ID,
        stateConnections: data.stateConnections,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] });
      toast({ 
        title: "Batch Connection Complete", 
        description: `Imported ${data.totalImported} records from ${data.results.length} state registries` 
      });
      setShowAutoDetectDialog(false);
      setAutoDetectionResult(null);
      setSelectedStatesToConnect([]);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to batch connect to IIS", variant: "destructive" });
    },
  });

  const clinician = clinicianData?.clinician;
  const stats = dashboardData?.stats;
  const patients = patientsData?.patients || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "up_to_date": return "bg-green-500";
      case "due": return "bg-yellow-500";
      case "overdue": return "bg-red-500";
      case "not_applicable": return "bg-gray-400";
      case "contraindicated": return "bg-purple-500";
      default: return "bg-gray-400";
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "iis_verified": return <Badge variant="default" className="bg-green-600">IIS Verified</Badge>;
      case "clinician_verified": return <Badge variant="default" className="bg-blue-600">Clinician Verified</Badge>;
      case "patient_reported": return <Badge variant="secondary">Patient Reported</Badge>;
      case "unverified": return <Badge variant="outline">Unverified</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (clinicianLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Syringe className="h-8 w-8 text-primary" />
            Clinician Immunization Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            {clinician?.name} - {clinician?.organizationName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            HIPAA Compliant
          </Badge>
          <Badge variant="secondary">NO-CDS Compliant</Badge>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Educational Information Only</AlertTitle>
        <AlertDescription>
          This portal displays vaccine schedule information based on CDC/ACIP guidelines. 
          All clinical decisions should be made by qualified healthcare providers.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Activity className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">
            <Users className="h-4 w-4 mr-2" />
            Patients
          </TabsTrigger>
          <TabsTrigger value="records" data-testid="tab-records">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Records
          </TabsTrigger>
          <TabsTrigger value="communications" data-testid="tab-communications">
            <MessageSquare className="h-4 w-4 mr-2" />
            Communications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-total-patients">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalPatients || 0}</div>
                    <p className="text-xs text-muted-foreground">In your panel</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-overdue">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats?.patientsOverdue || 0}</div>
                    <p className="text-xs text-muted-foreground">Need catch-up</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-due">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{stats?.patientsDue || 0}</div>
                    <p className="text-xs text-muted-foreground">Vaccines due</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-up-to-date">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Up to Date</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats?.patientsUpToDate || 0}</div>
                    <p className="text-xs text-muted-foreground">Fully vaccinated</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.pendingVerifications || 0}</div>
                    <p className="text-xs text-muted-foreground">Records need review</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Recent Messages</CardTitle>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.recentMessages || 0}</div>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">IIS Connections</CardTitle>
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.iisConnectionsActive || 0}</div>
                    <p className="text-xs text-muted-foreground">Active consents</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Search</CardTitle>
              <CardDescription>Search for patients to view their immunization records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, MRN, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-patient-search"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/clinician-immunization-portal"] })}
                  data-testid="button-refresh"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {patientsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : patients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No patients found. Try adjusting your search.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {patients.map((patient) => (
                      <Card 
                        key={patient.patientId} 
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setActiveTab("records");
                        }}
                        data-testid={`card-patient-${patient.patientId}`}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{patient.fullName}</p>
                              <p className="text-sm text-muted-foreground">
                                DOB: {new Date(patient.dateOfBirth).toLocaleDateString()} 
                                {patient.mrn && ` | MRN: ${patient.mrn}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {patient.vaccineScheduleStatus.some(s => s.status === "overdue") && (
                              <Badge variant="destructive">Overdue</Badge>
                            )}
                            {patient.vaccineScheduleStatus.some(s => s.status === "due") && 
                              !patient.vaccineScheduleStatus.some(s => s.status === "overdue") && (
                              <Badge variant="secondary">Due</Badge>
                            )}
                            {patient.vaccineScheduleStatus.every(s => 
                              s.status === "up_to_date" || s.status === "not_applicable"
                            ) && (
                              <Badge className="bg-green-600">Up to Date</Badge>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          {selectedPatient ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {selectedPatient.fullName}
                      </CardTitle>
                      <CardDescription>
                        DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                        {selectedPatient.mrn && ` | MRN: ${selectedPatient.mrn}`}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Dialog open={showAddRecordDialog} onOpenChange={setShowAddRecordDialog}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-add-record">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Record
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add Immunization Record</DialogTitle>
                            <DialogDescription>
                              Manually add an immunization record for {selectedPatient.fullName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="vaccineName">Vaccine Name</Label>
                              <Input
                                id="vaccineName"
                                value={newRecord.vaccineName}
                                onChange={(e) => setNewRecord({ ...newRecord, vaccineName: e.target.value })}
                                placeholder="e.g., MMR, DTaP"
                                data-testid="input-vaccine-name"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="vaccineCode">CVX Code</Label>
                                <Input
                                  id="vaccineCode"
                                  value={newRecord.vaccineCode}
                                  onChange={(e) => setNewRecord({ ...newRecord, vaccineCode: e.target.value })}
                                  placeholder="e.g., 03"
                                  data-testid="input-vaccine-code"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="vaccineGroup">Vaccine Group</Label>
                                <Select
                                  value={newRecord.vaccineGroup}
                                  onValueChange={(v) => setNewRecord({ ...newRecord, vaccineGroup: v })}
                                >
                                  <SelectTrigger data-testid="select-vaccine-group">
                                    <SelectValue placeholder="Select group" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MMR">MMR</SelectItem>
                                    <SelectItem value="DTaP">DTaP</SelectItem>
                                    <SelectItem value="HepB">Hepatitis B</SelectItem>
                                    <SelectItem value="Polio">Polio</SelectItem>
                                    <SelectItem value="Hib">Hib</SelectItem>
                                    <SelectItem value="PCV">PCV</SelectItem>
                                    <SelectItem value="Rotavirus">Rotavirus</SelectItem>
                                    <SelectItem value="Varicella">Varicella</SelectItem>
                                    <SelectItem value="HepA">Hepatitis A</SelectItem>
                                    <SelectItem value="HPV">HPV</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="administeredDate">Date Administered</Label>
                              <Input
                                id="administeredDate"
                                type="date"
                                value={newRecord.administeredDate}
                                onChange={(e) => setNewRecord({ ...newRecord, administeredDate: e.target.value })}
                                data-testid="input-administered-date"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="lotNumber">Lot Number</Label>
                                <Input
                                  id="lotNumber"
                                  value={newRecord.lotNumber}
                                  onChange={(e) => setNewRecord({ ...newRecord, lotNumber: e.target.value })}
                                  placeholder="Optional"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="site">Administration Site</Label>
                                <Select
                                  value={newRecord.site}
                                  onValueChange={(v) => setNewRecord({ ...newRecord, site: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select site" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left_arm">Left Arm</SelectItem>
                                    <SelectItem value="right_arm">Right Arm</SelectItem>
                                    <SelectItem value="left_thigh">Left Thigh</SelectItem>
                                    <SelectItem value="right_thigh">Right Thigh</SelectItem>
                                    <SelectItem value="oral">Oral</SelectItem>
                                    <SelectItem value="nasal">Nasal</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="notes">Notes</Label>
                              <Textarea
                                id="notes"
                                value={newRecord.notes}
                                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                                placeholder="Optional notes..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAddRecordDialog(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={() => addRecordMutation.mutate({ 
                                patientId: selectedPatient.patientId, 
                                record: newRecord 
                              })}
                              disabled={addRecordMutation.isPending || !newRecord.vaccineName || !newRecord.administeredDate}
                              data-testid="button-submit-record"
                            >
                              {addRecordMutation.isPending ? "Adding..." : "Add Record"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button 
                        variant="default" 
                        disabled={!clinician?.canConnectIIS || autoDetectIISMutation.isPending || !selectedPatient?.patientId}
                        onClick={() => {
                          if (selectedPatient?.patientId) {
                            setShowAutoDetectDialog(true);
                            setAutoDetectDisclaimer("");
                            autoDetectIISMutation.mutate(selectedPatient.patientId);
                          }
                        }}
                        data-testid="button-auto-detect-iis"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        {autoDetectIISMutation.isPending ? "Detecting..." : "Auto-Detect IIS"}
                      </Button>

                      <Dialog open={showIISConnectDialog} onOpenChange={setShowIISConnectDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" disabled={!clinician?.canConnectIIS} data-testid="button-iis-connect">
                            <Link2 className="h-4 w-4 mr-2" />
                            Manual Connect
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connect to State IIS</DialogTitle>
                            <DialogDescription>
                              Query state immunization registry for {selectedPatient.fullName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            {selectedPatient.iisConsentStatus.filter(c => c.status === "granted").length > 0 ? (
                              <div className="space-y-4">
                                <p className="text-sm">Active consents available:</p>
                                {selectedPatient.iisConsentStatus
                                  .filter(c => c.status === "granted")
                                  .map((consent) => (
                                    <Card key={consent.id} className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="font-medium">{consent.stateName}</p>
                                          <p className="text-sm text-muted-foreground">
                                            Granted: {new Date(consent.grantedAt).toLocaleDateString()}
                                            {consent.expiresAt && ` | Expires: ${new Date(consent.expiresAt).toLocaleDateString()}`}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => connectIISMutation.mutate({
                                            patientId: selectedPatient.patientId,
                                            stateCode: consent.stateCode,
                                            consentId: consent.id,
                                          })}
                                          disabled={connectIISMutation.isPending}
                                        >
                                          {connectIISMutation.isPending ? "Connecting..." : "Connect"}
                                        </Button>
                                      </div>
                                    </Card>
                                  ))}
                              </div>
                            ) : (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>No Active Consent</AlertTitle>
                                <AlertDescription>
                                  Patient consent is required before connecting to state IIS registries.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showReportDialog} onOpenChange={(open) => { setShowReportDialog(open); if (!open) setReportUrl(null); }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" disabled={!clinician?.canGenerateReports} data-testid="button-generate-report">
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Report
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Generate Immunization Report</DialogTitle>
                            <DialogDescription>
                              Create a report for {selectedPatient.fullName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Report Type</Label>
                              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full_history">Full History</SelectItem>
                                  <SelectItem value="school_form">School Form</SelectItem>
                                  <SelectItem value="daycare_form">Daycare Form</SelectItem>
                                  <SelectItem value="travel">Travel Immunizations</SelectItem>
                                  <SelectItem value="employer">Employer Requirement</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {reportUrl && (
                              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle>Report Ready</AlertTitle>
                                <AlertDescription className="flex items-center gap-2 flex-wrap">
                                  <span>Your report has been generated.</span>
                                  <a 
                                    href={reportUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary underline font-medium"
                                    data-testid="link-download-report"
                                  >
                                    Download Report
                                  </a>
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => { setShowReportDialog(false); setReportUrl(null); }}>
                              {reportUrl ? "Close" : "Cancel"}
                            </Button>
                            {!reportUrl && (
                              <Button
                                onClick={() => generateReportMutation.mutate({
                                  patientId: selectedPatient.patientId,
                                  reportType: selectedReportType,
                                })}
                                disabled={generateReportMutation.isPending}
                              >
                                {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
                              </Button>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showCreateConsentDialog} onOpenChange={setShowCreateConsentDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" data-testid="button-create-consent">
                            <Plus className="h-4 w-4 mr-2" />
                            Add IIS Consent
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create IIS Consent Record</DialogTitle>
                            <DialogDescription>
                              Record patient consent for State IIS registry access for {selectedPatient.fullName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>State Registry</Label>
                              <Select value={newConsentState} onValueChange={setNewConsentState}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CA">California (CAIR2)</SelectItem>
                                  <SelectItem value="NY">New York (NYSIIS)</SelectItem>
                                  <SelectItem value="TX">Texas (ImmTrac2)</SelectItem>
                                  <SelectItem value="FL">Florida (FL SHOTS)</SelectItem>
                                  <SelectItem value="PA">Pennsylvania (PA-SIIS)</SelectItem>
                                  <SelectItem value="IL">Illinois (I-CARE)</SelectItem>
                                  <SelectItem value="OH">Ohio (ImpactSIIS)</SelectItem>
                                  <SelectItem value="GA">Georgia (GRITS)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Consent Required</AlertTitle>
                              <AlertDescription>
                                Patient must provide verbal or written consent before IIS access.
                              </AlertDescription>
                            </Alert>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateConsentDialog(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={() => createConsentMutation.mutate({
                                patientId: selectedPatient.patientId,
                                stateCode: newConsentState,
                              })}
                              disabled={createConsentMutation.isPending}
                            >
                              {createConsentMutation.isPending ? "Creating..." : "Create Consent"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button 
                        variant="ghost" 
                        onClick={() => setSelectedPatient(null)}
                        data-testid="button-back-to-search"
                      >
                        Back to Search
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vaccine Schedule Status</CardTitle>
                    <CardDescription>Based on CDC/ACIP guidelines</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {selectedPatient.vaccineScheduleStatus.map((status) => (
                          <div 
                            key={status.vaccineGroup} 
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-3 w-3 rounded-full ${getStatusColor(status.status)}`} />
                              <div>
                                <p className="font-medium">{status.vaccineName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {status.dosesReceived}/{status.dosesRequired} doses
                                  {status.lastDoseDate && ` | Last: ${new Date(status.lastDoseDate).toLocaleDateString()}`}
                                </p>
                              </div>
                            </div>
                            {status.catchUpRequired && (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                Catch-up Needed
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Immunization History</CardTitle>
                    <CardDescription>All recorded vaccinations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {selectedPatient.immunizationHistory.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No immunization records found
                          </p>
                        ) : (
                          selectedPatient.immunizationHistory.map((record) => (
                            <div 
                              key={record.id} 
                              className="p-3 rounded-lg border space-y-2"
                              data-testid={`record-${record.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{record.vaccineName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(record.administeredDate).toLocaleDateString()}
                                    {record.administeredBy && ` by ${record.administeredBy}`}
                                  </p>
                                </div>
                                {getVerificationBadge(record.verificationStatus)}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {clinician?.canEditRecords && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedRecordToEdit(record);
                                      setEditRecord({
                                        vaccineName: record.vaccineName,
                                        vaccineCode: record.vaccineCode,
                                        vaccineGroup: record.vaccineGroup,
                                        administeredDate: record.administeredDate.split("T")[0],
                                        lotNumber: record.lotNumber || "",
                                        site: record.site || "",
                                        notes: "",
                                      });
                                      setShowEditRecordDialog(true);
                                    }}
                                    data-testid={`button-edit-${record.id}`}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                )}
                                {(record.verificationStatus === "unverified" || record.verificationStatus === "patient_reported") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => verifyRecordMutation.mutate({
                                      patientId: selectedPatient.patientId,
                                      recordId: record.id,
                                    })}
                                    disabled={!clinician?.canVerifyRecords || verifyRecordMutation.isPending}
                                    data-testid={`button-verify-${record.id}`}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verify
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Select a Patient</p>
                <p className="text-muted-foreground mb-4">
                  Search for a patient in the Patients tab to view their immunization records
                </p>
                <Button onClick={() => setActiveTab("patients")}>
                  Go to Patients
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Patient Communications</CardTitle>
                  <CardDescription>Send secure messages to patients about their immunization status</CardDescription>
                </div>
                {selectedPatient && (
                  <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
                    <DialogTrigger asChild>
                      <Button disabled={!clinician?.canCommunicatePatients} data-testid="button-new-message">
                        <Mail className="h-4 w-4 mr-2" />
                        New Message
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Send Message to {selectedPatient.fullName}</DialogTitle>
                        <DialogDescription>
                          Compose a secure message about immunization status
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Use Template</Label>
                          <Select
                            onValueChange={(templateId) => {
                              const template = templatesData?.templates.find(t => t.id === templateId);
                              if (template) {
                                setNewMessage({
                                  ...newMessage,
                                  subject: template.subject,
                                  content: template.content,
                                  messageType: template.type as any,
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a template (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {templatesData?.templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input
                            id="subject"
                            value={newMessage.subject}
                            onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                            placeholder="Message subject"
                            data-testid="input-message-subject"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Message Type</Label>
                            <Select
                              value={newMessage.messageType}
                              onValueChange={(v) => setNewMessage({ ...newMessage, messageType: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reminder">Reminder</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select
                              value={newMessage.priority}
                              onValueChange={(v) => setNewMessage({ ...newMessage, priority: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="content">Message</Label>
                          <Textarea
                            id="content"
                            value={newMessage.content}
                            onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                            placeholder="Write your message..."
                            className="min-h-[150px]"
                            data-testid="textarea-message-content"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => sendMessageMutation.mutate({
                            patientId: selectedPatient.patientId,
                            message: newMessage,
                          })}
                          disabled={sendMessageMutation.isPending || !newMessage.subject || !newMessage.content}
                          data-testid="button-send-message"
                        >
                          {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedPatient ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Message history for {selectedPatient.fullName} will appear here.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "New Message" to send a secure message about immunization status.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a patient to view and send messages
                  </p>
                  <Button className="mt-4" onClick={() => setActiveTab("patients")}>
                    Go to Patients
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedPatient && selectedRecordToEdit && (
        <Dialog open={showEditRecordDialog} onOpenChange={setShowEditRecordDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Immunization Record</DialogTitle>
              <DialogDescription>
                Update immunization record for {selectedPatient.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editVaccineName">Vaccine Name</Label>
                <Input
                  id="editVaccineName"
                  value={editRecord.vaccineName}
                  onChange={(e) => setEditRecord({ ...editRecord, vaccineName: e.target.value })}
                  data-testid="input-edit-vaccine-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editVaccineCode">CVX Code</Label>
                  <Input
                    id="editVaccineCode"
                    value={editRecord.vaccineCode}
                    onChange={(e) => setEditRecord({ ...editRecord, vaccineCode: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editVaccineGroup">Vaccine Group</Label>
                  <Select
                    value={editRecord.vaccineGroup}
                    onValueChange={(v) => setEditRecord({ ...editRecord, vaccineGroup: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MMR">MMR</SelectItem>
                      <SelectItem value="DTaP">DTaP</SelectItem>
                      <SelectItem value="HepB">Hepatitis B</SelectItem>
                      <SelectItem value="Polio">Polio</SelectItem>
                      <SelectItem value="Hib">Hib</SelectItem>
                      <SelectItem value="PCV">PCV</SelectItem>
                      <SelectItem value="Rotavirus">Rotavirus</SelectItem>
                      <SelectItem value="Varicella">Varicella</SelectItem>
                      <SelectItem value="HepA">Hepatitis A</SelectItem>
                      <SelectItem value="HPV">HPV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editAdministeredDate">Date Administered</Label>
                <Input
                  id="editAdministeredDate"
                  type="date"
                  value={editRecord.administeredDate}
                  onChange={(e) => setEditRecord({ ...editRecord, administeredDate: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editLotNumber">Lot Number</Label>
                  <Input
                    id="editLotNumber"
                    value={editRecord.lotNumber}
                    onChange={(e) => setEditRecord({ ...editRecord, lotNumber: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editSite">Administration Site</Label>
                  <Select
                    value={editRecord.site}
                    onValueChange={(v) => setEditRecord({ ...editRecord, site: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left_arm">Left Arm</SelectItem>
                      <SelectItem value="right_arm">Right Arm</SelectItem>
                      <SelectItem value="left_thigh">Left Thigh</SelectItem>
                      <SelectItem value="right_thigh">Right Thigh</SelectItem>
                      <SelectItem value="oral">Oral</SelectItem>
                      <SelectItem value="nasal">Nasal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  value={editRecord.notes}
                  onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })}
                  placeholder="Optional notes about the update..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditRecordDialog(false); setSelectedRecordToEdit(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => editRecordMutation.mutate({ 
                  patientId: selectedPatient.patientId, 
                  recordId: selectedRecordToEdit.id,
                  record: editRecord 
                })}
                disabled={editRecordMutation.isPending || !editRecord.vaccineName || !editRecord.administeredDate}
                data-testid="button-submit-edit-record"
              >
                {editRecordMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAutoDetectDialog} onOpenChange={(open) => { 
        setShowAutoDetectDialog(open); 
        if (!open) { setAutoDetectionResult(null); setSelectedStatesToConnect([]); setAutoDetectDisclaimer(""); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Auto-Detected State IIS Connections
            </DialogTitle>
            <DialogDescription>
              Based on patient address and history, we&apos;ve identified the following state immunization registries.
              Review and confirm which registries to connect.
            </DialogDescription>
          </DialogHeader>
          {autoDetectDisclaimer && (
            <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <Info className="h-4 w-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription className="text-sm">{autoDetectDisclaimer}</AlertDescription>
            </Alert>
          )}
          <div className="py-4">
            {autoDetectIISMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Analyzing patient demographics...</p>
              </div>
            ) : autoDetectionResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Found {autoDetectionResult.totalStatesDetected} potential registries
                  </p>
                  {autoDetectionResult.detectedStates.filter(s => s.hasConsent).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const statesWithConsent = autoDetectionResult.detectedStates
                          .filter(s => s.hasConsent)
                          .map(s => s.stateCode);
                        setSelectedStatesToConnect(statesWithConsent);
                      }}
                    >
                      Select All with Consent
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {autoDetectionResult.detectedStates.map((state) => (
                      <Card 
                        key={state.stateCode} 
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedStatesToConnect.includes(state.stateCode) 
                            ? "border-primary bg-primary/5" 
                            : ""
                        }`}
                        onClick={() => {
                          if (state.hasConsent) {
                            setSelectedStatesToConnect(prev => 
                              prev.includes(state.stateCode)
                                ? prev.filter(s => s !== state.stateCode)
                                : [...prev, state.stateCode]
                            );
                          }
                        }}
                        data-testid={`card-detected-${state.stateCode}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{state.stateName}</p>
                              <Badge variant="outline" className="text-xs">
                                {state.registryName}
                              </Badge>
                              <Badge 
                                variant={state.confidence === "high" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {state.confidence} confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Source: {state.source.replace(/_/g, " ")}
                              {state.estimatedRecords && ` | Est. ${state.estimatedRecords} records`}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {state.features.queryByPatient && (
                                <Badge variant="outline" className="text-xs">Patient Query</Badge>
                              )}
                              {state.features.historyRetrieval && (
                                <Badge variant="outline" className="text-xs">History</Badge>
                              )}
                              {state.features.forecastSupport && (
                                <Badge variant="outline" className="text-xs">Forecast</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {state.hasConsent ? (
                              <>
                                <Badge className="bg-green-600">Consent Active</Badge>
                                {selectedStatesToConnect.includes(state.stateCode) && (
                                  <CheckCircle className="h-5 w-5 text-primary" />
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedPatient) {
                                    batchConsentMutation.mutate({
                                      patientId: selectedPatient.patientId,
                                      stateCodes: [state.stateCode],
                                    });
                                  }
                                }}
                                disabled={batchConsentMutation.isPending}
                              >
                                {batchConsentMutation.isPending ? "Creating..." : "Create Consent"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                {autoDetectionResult.detectedStates.filter(s => !s.hasConsent).length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Consent Required</AlertTitle>
                    <AlertDescription>
                      Some registries require patient consent before connection. 
                      Click "Create Consent" for each state after obtaining patient authorization.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No detection results available.
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setShowAutoDetectDialog(false); setAutoDetectionResult(null); setSelectedStatesToConnect([]); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedPatient && autoDetectionResult) {
                  const stateConnections = autoDetectionResult.detectedStates
                    .filter(s => selectedStatesToConnect.includes(s.stateCode) && s.hasConsent && s.consentId)
                    .map(s => ({ stateCode: s.stateCode, consentId: s.consentId! }));
                  
                  if (stateConnections.length > 0) {
                    batchConnectMutation.mutate({
                      patientId: selectedPatient.patientId,
                      stateConnections,
                    });
                  }
                }
              }}
              disabled={
                batchConnectMutation.isPending || 
                selectedStatesToConnect.length === 0 ||
                !autoDetectionResult?.detectedStates.some(s => 
                  selectedStatesToConnect.includes(s.stateCode) && s.hasConsent
                )
              }
              data-testid="button-confirm-batch-connect"
            >
              {batchConnectMutation.isPending 
                ? "Connecting..." 
                : `Connect to ${selectedStatesToConnect.length} Registry${selectedStatesToConnect.length !== 1 ? "ies" : ""}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-clinician-immunization-portal-disclaimer" />
    </div>
  );
}