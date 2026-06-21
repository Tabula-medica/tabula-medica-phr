import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, 
  Users, 
  FileText, 
  Pill, 
  Heart, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3, 
  PieChart,
  ClipboardList,
  Loader2,
  RefreshCw,
  ChevronRight,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Shield,
  Stethoscope
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DashboardSummary {
  patientCount: number;
  conditionCount: number;
  medicationCount: number;
  observationCount: number;
  activeConditions: number;
  activeMedications: number;
  abnormalObservations: number;
  recentReports: any[];
  disclaimer: string;
}

interface PatientDemographics {
  patientId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  age?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  maritalStatus?: string;
  mrn?: string;
}

interface Condition {
  conditionId: string;
  patientId: string;
  name: string;
  icdCode?: string;
  snomedCode?: string;
  status: string;
  severity?: string;
  onsetDate?: string;
  category?: string;
  isActive: boolean;
  isChronic: boolean;
}

interface Medication {
  medicationId: string;
  patientId: string;
  name: string;
  rxNormCode?: string;
  status: string;
  dosage?: string;
  frequency?: string;
  prescribedDate?: string;
  prescriber?: string;
  reasons?: string[];
  isActive: boolean;
}

interface Observation {
  observationId: string;
  patientId: string;
  name: string;
  loincCode?: string;
  value?: number | string;
  unit?: string;
  effectiveDate?: string;
  status: string;
  category?: string;
  interpretation?: string;
  isAbnormal: boolean;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
}

interface RiskPrediction {
  id: string;
  patientId: string;
  riskCategory: string;
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  confidence: number;
  contributingFactors: { factor: string; weight: number; description: string }[];
  recommendations: string[];
  aiRationale: string;
  generatedAt: string;
  disclaimer: string;
}

interface DrugInteraction {
  id: string;
  patientId: string;
  medication1: { name: string };
  medication2: { name: string };
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  clinicalEffect: string;
  managementRecommendation: string;
  evidenceLevel: string;
  generatedAt: string;
  disclaimer: string;
}

interface AggregateReport {
  id: string;
  reportType: string;
  title: string;
  description: string;
  dateRange: { start: string; end: string };
  aggregations: { category: string; count: number; percentage: number; trend?: string; subCategories?: { name: string; count: number }[] }[];
  visualizationData: { chartType: string; labels: string[]; datasets: { label: string; data: number[]; color?: string }[] }[];
  insights: string[];
  generatedAt: string;
  disclaimer: string;
}

export default function FhirClinicalAnalysis() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [reportType, setReportType] = useState<string>("comprehensive");

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<DashboardSummary>({
    queryKey: ["/api/fhir-clinical-analysis/dashboard"],
  });

  const { data: patients = [], isLoading: loadingPatients } = useQuery<PatientDemographics[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients"],
  });

  const { data: conditions = [], isLoading: loadingConditions, isError: errorConditions } = useQuery<Condition[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients", selectedPatientId, "conditions"],
    enabled: !!selectedPatientId,
  });

  const { data: medications = [], isLoading: loadingMedications, isError: errorMedications } = useQuery<Medication[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients", selectedPatientId, "medications"],
    enabled: !!selectedPatientId,
  });

  const { data: observations = [], isLoading: loadingObservations, isError: errorObservations } = useQuery<Observation[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients", selectedPatientId, "observations"],
    enabled: !!selectedPatientId,
  });

  const loadingPatientData = loadingConditions || loadingMedications || loadingObservations;
  const errorPatientData = errorConditions || errorMedications || errorObservations;

  const { data: riskPredictions = [], refetch: refetchRisks } = useQuery<RiskPrediction[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients", selectedPatientId, "risk-predictions"],
    enabled: false,
  });

  const { data: drugInteractions = [], refetch: refetchInteractions } = useQuery<DrugInteraction[]>({
    queryKey: ["/api/fhir-clinical-analysis/patients", selectedPatientId, "drug-interactions"],
    enabled: false,
  });

  const generateRisksMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatientId) return;
      return apiRequest("POST", `/api/fhir-clinical-analysis/patients/${selectedPatientId}/risk-predictions`);
    },
    onSuccess: () => {
      refetchRisks();
    },
  });

  const generateInteractionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatientId) return;
      return apiRequest("POST", `/api/fhir-clinical-analysis/patients/${selectedPatientId}/drug-interactions`);
    },
    onSuccess: () => {
      refetchInteractions();
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest("POST", "/api/fhir-clinical-analysis/reports", { reportType: type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-clinical-analysis/reports"] });
    },
  });

  const { data: reports = [] } = useQuery<AggregateReport[]>({
    queryKey: ["/api/fhir-clinical-analysis/reports"],
  });

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-orange-500 text-white";
      case "moderate": return "bg-yellow-500 text-black";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "contraindicated": return "bg-red-700 text-white";
      case "major": return "bg-red-500 text-white";
      case "moderate": return "bg-orange-500 text-white";
      case "minor": return "bg-yellow-500 text-black";
      default: return "bg-gray-500 text-white";
    }
  };

  const selectedPatient = patients.find(p => p.patientId === selectedPatientId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            FHIR Clinical Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered clinical data analysis with FHIR R4 resource mapping
          </p>
        </div>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <Shield className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
          <strong>NO-CDS Disclaimer:</strong> This analysis is for informational and educational purposes only. 
          It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. 
          All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">
            <Users className="w-4 h-4 mr-2" />
            Patients
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <Stethoscope className="w-4 h-4 mr-2" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loadingDashboard ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="w-8 h-8 text-blue-500" />
                      <span className="text-3xl font-bold">{dashboard?.patientCount || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Heart className="w-8 h-8 text-red-500" />
                      <span className="text-3xl font-bold">{dashboard?.activeConditions || 0}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">of {dashboard?.conditionCount || 0} total</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Medications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Pill className="w-8 h-8 text-green-500" />
                      <span className="text-3xl font-bold">{dashboard?.activeMedications || 0}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">of {dashboard?.medicationCount || 0} total</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Abnormal Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                      <span className="text-3xl font-bold">{dashboard?.abnormalObservations || 0}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">of {dashboard?.observationCount || 0} observations</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      FHIR Resource Summary
                    </CardTitle>
                    <CardDescription>Overview of mapped FHIR R4 resources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-blue-500" />
                          <span>Patient Resources</span>
                        </div>
                        <Badge>{dashboard?.patientCount || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Heart className="w-5 h-5 text-red-500" />
                          <span>Condition Resources</span>
                        </div>
                        <Badge>{dashboard?.conditionCount || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Pill className="w-5 h-5 text-green-500" />
                          <span>MedicationRequest Resources</span>
                        </div>
                        <Badge>{dashboard?.medicationCount || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Activity className="w-5 h-5 text-purple-500" />
                          <span>Observation Resources</span>
                        </div>
                        <Badge>{dashboard?.observationCount || 0}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5" />
                      Recent Reports
                    </CardTitle>
                    <CardDescription>Latest generated analytics reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(dashboard?.recentReports?.length || 0) === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No reports generated yet</p>
                        <Button 
                          className="mt-4" 
                          onClick={() => setActiveTab("reports")}
                          data-testid="button-go-to-reports"
                        >
                          Generate Report
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dashboard?.recentReports?.slice(0, 5).map((report: any) => (
                          <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{report.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(report.generatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Patient List</CardTitle>
                <CardDescription>Select a patient to view FHIR data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {patients.map((patient) => (
                    <div
                      key={patient.patientId}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPatientId === patient.patientId
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover-elevate"
                      }`}
                      onClick={() => setSelectedPatientId(patient.patientId)}
                      data-testid={`patient-${patient.patientId}`}
                    >
                      <div className="flex items-center gap-3">
                        <User className="w-8 h-8" />
                        <div>
                          <p className="font-medium">{patient.fullName}</p>
                          <p className="text-xs opacity-80">
                            {patient.gender}, {patient.age} years
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              {selectedPatient ? (
                <>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {selectedPatient.fullName}
                    </CardTitle>
                    <CardDescription>FHIR Patient Demographics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="text-muted-foreground">DOB:</span> {selectedPatient.birthDate || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {selectedPatient.city}, {selectedPatient.state}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{selectedPatient.phone || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{selectedPatient.email || "N/A"}</span>
                      </div>
                    </div>

                    {loadingPatientData && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Loading patient data...</span>
                      </div>
                    )}

                    {errorPatientData && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          Failed to load patient data. Please try again.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!loadingPatientData && !errorPatientData && (
                      <>
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Heart className="w-4 h-4" /> Conditions ({conditions.length})
                          </h4>
                          <div className="space-y-2">
                            {conditions.map((condition) => (
                              <div key={condition.conditionId} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <p className="font-medium">{condition.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Onset: {condition.onsetDate || "Unknown"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {condition.isChronic && <Badge variant="outline">Chronic</Badge>}
                                  <Badge className={condition.isActive ? "bg-green-500" : "bg-gray-500"}>
                                    {condition.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Pill className="w-4 h-4" /> Medications ({medications.length})
                          </h4>
                          <div className="space-y-2">
                            {medications.map((med) => (
                              <div key={med.medicationId} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <p className="font-medium">{med.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {med.dosage} - {med.frequency}
                                  </p>
                                </div>
                                <Badge className={med.isActive ? "bg-green-500" : "bg-gray-500"}>
                                  {med.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Observations ({observations.length})
                          </h4>
                          <div className="space-y-2">
                            {observations.map((obs) => (
                              <div key={obs.observationId} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <p className="font-medium">{obs.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {obs.effectiveDate || "Unknown date"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">
                                    {obs.value} {obs.unit}
                                  </span>
                                  {obs.isAbnormal && (
                                    <Badge className="bg-amber-500">Abnormal</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center py-20">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select a patient to view their FHIR data</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5" />
                    AI-Powered Clinical Analysis
                  </CardTitle>
                  <CardDescription>Risk prediction and drug interaction analysis</CardDescription>
                </div>
                <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="w-64" data-testid="select-patient-analysis">
                    <SelectValue placeholder="Select a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId}>
                        {p.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedPatientId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Stethoscope className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a patient to run AI analysis</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Risk Predictions
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => generateRisksMutation.mutate()}
                        disabled={generateRisksMutation.isPending}
                        data-testid="button-generate-risks"
                      >
                        {generateRisksMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Generate
                      </Button>
                    </div>
                    {riskPredictions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-muted rounded-lg">
                        <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Click Generate to analyze patient risks</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {riskPredictions.map((risk) => (
                          <div key={risk.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{risk.riskCategory}</span>
                              <Badge className={getRiskBadgeColor(risk.riskLevel)}>
                                {risk.riskLevel.toUpperCase()} ({risk.riskScore}%)
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{risk.aiRationale}</p>
                            <div className="mt-2">
                              <p className="text-xs font-medium mb-1">Recommendations:</p>
                              <ul className="text-xs text-muted-foreground list-disc list-inside">
                                {risk.recommendations.slice(0, 3).map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Drug Interactions
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => generateInteractionsMutation.mutate()}
                        disabled={generateInteractionsMutation.isPending}
                        data-testid="button-generate-interactions"
                      >
                        {generateInteractionsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Analyze
                      </Button>
                    </div>
                    {drugInteractions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-muted rounded-lg">
                        <Pill className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Click Analyze to detect drug interactions</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {drugInteractions.map((interaction) => (
                          <div key={interaction.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">
                                {interaction.medication1.name} + {interaction.medication2.name}
                              </span>
                              <Badge className={getSeverityBadgeColor(interaction.severity)}>
                                {interaction.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{interaction.description}</p>
                            <p className="text-xs mt-2">
                              <strong>Management:</strong> {interaction.managementRecommendation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Aggregate Reports
                  </CardTitle>
                  <CardDescription>Generate and view FHIR data analytics reports</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="w-48" data-testid="select-report-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprehensive">Comprehensive</SelectItem>
                      <SelectItem value="demographics">Demographics</SelectItem>
                      <SelectItem value="conditions">Conditions</SelectItem>
                      <SelectItem value="medications">Medications</SelectItem>
                      <SelectItem value="observations">Observations</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => generateReportMutation.mutate(reportType)}
                    disabled={generateReportMutation.isPending}
                    data-testid="button-generate-report"
                  >
                    {generateReportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <BarChart3 className="w-4 h-4 mr-2" />
                    )}
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No reports generated yet. Select a report type and click Generate.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {reports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">{report.title}</h3>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                        </div>
                        <Badge variant="outline">{report.reportType}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {report.aggregations.slice(0, 6).map((agg, i) => (
                          <div key={i} className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">{agg.category}</p>
                            <p className="text-2xl font-bold">{agg.count}</p>
                            {agg.trend && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {agg.trend}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      {report.insights.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <h4 className="text-sm font-medium mb-2">Key Insights</h4>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {report.insights.map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-3">
                        Generated: {new Date(report.generatedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
