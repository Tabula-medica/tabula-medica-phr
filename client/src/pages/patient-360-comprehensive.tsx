import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  Heart,
  Pill,
  AlertTriangle,
  Calendar,
  Video,
  Activity,
  FileText,
  Shield,
  Brain,
  Stethoscope,
  ClipboardList,
  CheckCircle,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Sparkles,
  AlertCircle,
  Syringe,
  TestTube,
  BarChart3,
  ExternalLink
} from "lucide-react";

interface PatientSummary {
  patientId: string;
  name: string;
  age: number;
  conditionsCount: number;
  lastUpdated: string;
}

interface DashboardStats {
  totalPatients: number;
  avgDataQuality: number;
  totalAppointments: number;
  totalRiskAssessments: number;
  patientsAtHighRisk: number;
}

interface Demographics {
  patientId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate: string;
  age: number;
  gender: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  mrn?: string;
  insuranceProvider?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

interface Condition {
  id: string;
  name: string;
  code?: string;
  status: "active" | "resolved" | "inactive";
  severity?: "mild" | "moderate" | "severe";
  onsetDate?: string;
  source: string;
}

interface Medication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  status: "active" | "completed" | "stopped" | "on-hold";
  prescriber?: string;
  source: string;
}

interface Allergy {
  id: string;
  allergen: string;
  type: "allergy" | "intolerance";
  category: string;
  severity: "low" | "moderate" | "high";
  reactions?: string[];
}

interface VitalSign {
  id: string;
  type: string;
  value: number;
  unit: string;
  effectiveDate: string;
  interpretation?: "normal" | "low" | "high" | "critical";
}

interface LabResult {
  id: string;
  testName: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  interpretation?: "normal" | "abnormal" | "critical";
  effectiveDate: string;
}

interface TelehealthSession {
  id: string;
  providerName: string;
  specialty: string;
  scheduledAt: string;
  duration: number;
  status: string;
  type: string;
  summary?: string;
}

interface Appointment {
  id: string;
  providerName: string;
  providerSpecialty: string;
  facilityName: string;
  type: string;
  title: string;
  scheduledAt: string;
  duration: number;
  status: string;
  isTelehealth: boolean;
  telehealthUrl?: string;
}

interface RiskAssessment {
  id: string;
  category: string;
  conditionName: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  timeframe: string;
  topFactors: string[];
  aiConfidence: number;
}

interface MedicationSafety {
  overallSafetyLevel: "safe" | "concerns_identified" | "review_urgently";
  safetyScore: number;
  interactionsCount: number;
  allergyConcerns: number;
  dosingConcerns: number;
}

interface CarePlan {
  id: string;
  title: string;
  status: string;
  priorityRecommendations: string[];
  upcomingScreenings: { name: string; dueDate: string }[];
  wellnessGoals: { goal: string; progress: number }[];
}

interface QuickLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  description: string;
  category: string;
  badgeCount?: number;
}

interface Patient360View {
  patientId: string;
  demographics: Demographics;
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  recentVitals: VitalSign[];
  recentLabs: LabResult[];
  telehealthHistory: TelehealthSession[];
  upcomingAppointments: Appointment[];
  pastAppointments: Appointment[];
  riskAssessments: RiskAssessment[];
  medicationSafety: MedicationSafety;
  carePlan: CarePlan | null;
  quickLinks: QuickLink[];
  dataQualitySummary: {
    overallScore: number;
    sourcesCount: number;
    lastUpdated: string;
    issuesCount: number;
  };
  aiSummary: string | null;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

interface SectionVisibility {
  demographics: boolean;
  conditions: boolean;
  medications: boolean;
  allergies: boolean;
  vitals: boolean;
  labs: boolean;
  appointments: boolean;
  telehealth: boolean;
  risks: boolean;
  carePlan: boolean;
  quickLinks: boolean;
}

export default function Patient360Comprehensive() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    demographics: true,
    conditions: true,
    medications: true,
    allergies: true,
    vitals: true,
    labs: true,
    appointments: true,
    telehealth: true,
    risks: true,
    carePlan: true,
    quickLinks: true
  });

  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: ["/api/patient-360-comprehensive/dashboard"]
  });

  const { data: patientsData } = useQuery<{ patients: PatientSummary[] }>({
    queryKey: ["/api/patient-360-comprehensive/patients"]
  });

  const { data: patientViewData, isLoading: isLoadingView, refetch: refetchView } = useQuery<{ view: Patient360View }>({
    queryKey: ["/api/patient-360-comprehensive/patient", selectedPatientId],
    enabled: !!selectedPatientId
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/patient-360-comprehensive/patient/${selectedPatientId}`, { generateAISummary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-360-comprehensive/patient", selectedPatientId] });
    }
  });

  const patientView = patientViewData?.view;
  const patients = patientsData?.patients || [];
  const stats = statsData;

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "moderate": return "bg-yellow-500 text-white";
      default: return "bg-green-500 text-white";
    }
  };

  const getInterpretationColor = (interpretation?: string) => {
    switch (interpretation) {
      case "critical": return "text-red-600 dark:text-red-400";
      case "abnormal":
      case "high":
      case "low": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-green-600 dark:text-green-400";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "severe":
      case "high": return <Badge variant="destructive">{severity}</Badge>;
      case "moderate": return <Badge className="bg-yellow-500">{severity}</Badge>;
      default: return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 text-white">Active</Badge>;
      case "resolved": return <Badge variant="secondary">Resolved</Badge>;
      case "completed": return <Badge variant="outline">Completed</Badge>;
      case "scheduled": return <Badge className="bg-blue-500 text-white">Scheduled</Badge>;
      case "confirmed": return <Badge className="bg-green-500 text-white">Confirmed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getIconForLink = (iconName: string) => {
    const icons: Record<string, any> = {
      Brain, Pill, ClipboardList, CheckCircle, Stethoscope, Calendar, Video, MessageSquare, BarChart3
    };
    const Icon = icons[iconName] || FileText;
    return <Icon className="h-5 w-5" />;
  };

  const toggleSection = (section: keyof SectionVisibility) => {
    setSectionVisibility(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Informational View Only</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          This Patient 360 view consolidates data for informational purposes only. It does NOT constitute clinical decision support or medical advice.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-72 shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Patients</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowCustomizePanel(!showCustomizePanel)} data-testid="button-customize-view">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Select a patient to view</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {patients.map((patient) => (
                    <Button
                      key={patient.patientId}
                      variant={selectedPatientId === patient.patientId ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => setSelectedPatientId(patient.patientId)}
                      data-testid={`button-select-patient-${patient.patientId}`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium">{patient.name}</span>
                        <span className="text-xs opacity-70">
                          {patient.age}yo | {patient.conditionsCount} conditions
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {showCustomizePanel && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Customize View</p>
                  <div className="space-y-2">
                    {Object.entries(sectionVisibility).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={`toggle-${key}`} className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </Label>
                        <Switch
                          id={`toggle-${key}`}
                          checked={value}
                          onCheckedChange={() => toggleSection(key as keyof SectionVisibility)}
                          data-testid={`switch-section-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Dashboard Stats</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted rounded">
                      <p className="font-medium">{stats.totalPatients}</p>
                      <p className="text-muted-foreground">Patients</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="font-medium">{stats.avgDataQuality}%</p>
                      <p className="text-muted-foreground">Avg Quality</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="font-medium">{stats.totalAppointments}</p>
                      <p className="text-muted-foreground">Appointments</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="font-medium">{stats.patientsAtHighRisk}</p>
                      <p className="text-muted-foreground">High Risk</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          {!selectedPatientId ? (
            <Card className="h-96 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a Patient</p>
                <p className="text-sm">Choose a patient from the list to view their comprehensive 360 view</p>
              </div>
            </Card>
          ) : isLoadingView ? (
            <Card className="h-96 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading patient data...</p>
              </div>
            </Card>
          ) : patientView ? (
            <div className="space-y-6">
              {sectionVisibility.demographics && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl" data-testid="text-patient-name">{patientView.demographics.name}</CardTitle>
                          <CardDescription>
                            {patientView.demographics.age}yo {patientView.demographics.gender} | MRN: {patientView.demographics.mrn}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => refetchView()} data-testid="button-refresh-view">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => generateSummaryMutation.mutate()}
                          disabled={generateSummaryMutation.isPending}
                          data-testid="button-generate-summary"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {generateSummaryMutation.isPending ? "Generating..." : "AI Summary"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{patientView.demographics.phone || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{patientView.demographics.email || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{patientView.demographics.city}, {patientView.demographics.state}</span>
                      </div>
                    </div>

                    {patientView.aiSummary && (
                      <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800 dark:text-purple-200">AI Summary</span>
                        </div>
                        <p className="text-sm text-purple-700 dark:text-purple-300" data-testid="text-ai-summary">{patientView.aiSummary}</p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span>Data Quality: {patientView.dataQualitySummary.overallScore}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span>{patientView.dataQualitySummary.sourcesCount} Data Sources</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Updated: {formatDateTime(patientView.lastUpdated)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sectionVisibility.quickLinks && patientView.quickLinks.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Quick Access</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {patientView.quickLinks.map((link) => (
                        <Button
                          key={link.id}
                          variant="outline"
                          className="h-auto py-3 flex flex-col items-center gap-2 relative"
                          onClick={() => window.location.href = link.path}
                          data-testid={`button-quick-link-${link.id}`}
                        >
                          {getIconForLink(link.icon)}
                          <span className="text-xs font-medium">{link.name}</span>
                          {link.badgeCount && link.badgeCount > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {link.badgeCount}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="clinical" data-testid="tab-clinical">Clinical</TabsTrigger>
                  <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
                  <TabsTrigger value="risks" data-testid="tab-risks">AI Insights</TabsTrigger>
                  <TabsTrigger value="care" data-testid="tab-care">Care Plan</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Heart className="h-8 w-8 text-red-500" />
                          <div>
                            <p className="text-2xl font-bold" data-testid="text-conditions-count">{patientView.conditions.filter(c => c.status === "active").length}</p>
                            <p className="text-sm text-muted-foreground">Active Conditions</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Pill className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="text-2xl font-bold" data-testid="text-medications-count">{patientView.medications.filter(m => m.status === "active").length}</p>
                            <p className="text-sm text-muted-foreground">Active Medications</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-8 w-8 text-green-500" />
                          <div>
                            <p className="text-2xl font-bold" data-testid="text-appointments-count">{patientView.upcomingAppointments.length}</p>
                            <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-8 w-8 text-yellow-500" />
                          <div>
                            <p className="text-2xl font-bold" data-testid="text-risks-count">{patientView.riskAssessments.filter(r => r.riskLevel === "high" || r.riskLevel === "moderate").length}</p>
                            <p className="text-sm text-muted-foreground">Risk Alerts</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {sectionVisibility.vitals && patientView.recentVitals.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Recent Vitals
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {patientView.recentVitals.map((vital) => (
                            <div key={vital.id} className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">{vital.type}</p>
                              <p className={`text-lg font-bold ${getInterpretationColor(vital.interpretation)}`}>
                                {vital.value} <span className="text-xs font-normal">{vital.unit}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(vital.effectiveDate)}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sectionVisibility.allergies && patientView.allergies.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Allergies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {patientView.allergies.map((allergy) => (
                            <Badge key={allergy.id} variant="destructive" className="text-sm py-1 px-3">
                              {allergy.allergen} ({allergy.severity})
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="clinical" className="space-y-4">
                  {sectionVisibility.conditions && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Heart className="h-5 w-5" />
                          Conditions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {patientView.conditions.map((condition) => (
                            <div key={condition.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{condition.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {condition.code} | Onset: {condition.onsetDate ? formatDate(condition.onsetDate) : "Unknown"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {condition.severity && getSeverityBadge(condition.severity)}
                                {getStatusBadge(condition.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sectionVisibility.medications && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Pill className="h-5 w-5" />
                            Medications
                          </CardTitle>
                          <Badge className={patientView.medicationSafety.overallSafetyLevel === "safe" ? "bg-green-500" : "bg-yellow-500"}>
                            Safety: {Math.round(patientView.medicationSafety.safetyScore * 100)}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {patientView.medications.map((medication) => (
                            <div key={medication.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{medication.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {medication.dosage} | {medication.frequency}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Prescribed by: {medication.prescriber || "Unknown"}
                                </p>
                              </div>
                              {getStatusBadge(medication.status)}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sectionVisibility.labs && patientView.recentLabs.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TestTube className="h-5 w-5" />
                          Recent Lab Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {patientView.recentLabs.map((lab) => (
                            <div key={lab.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{lab.testName}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(lab.effectiveDate)}</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-medium ${getInterpretationColor(lab.interpretation)}`}>
                                  {lab.value} {lab.unit}
                                </p>
                                <p className="text-xs text-muted-foreground">Ref: {lab.referenceRange}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="appointments" className="space-y-4">
                  {sectionVisibility.appointments && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Upcoming Appointments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {patientView.upcomingAppointments.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No upcoming appointments</p>
                        ) : (
                          <div className="space-y-3">
                            {patientView.upcomingAppointments.map((apt) => (
                              <div key={apt.id} className="p-4 border rounded-lg">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div>
                                    <p className="font-medium flex items-center gap-2">
                                      {apt.title}
                                      {apt.isTelehealth && <Video className="h-4 w-4 text-blue-500" />}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{apt.providerName} - {apt.providerSpecialty}</p>
                                    <p className="text-sm text-muted-foreground">{apt.facilityName}</p>
                                  </div>
                                  <div className="text-right">
                                    {getStatusBadge(apt.status)}
                                    <p className="text-sm font-medium mt-1">{formatDateTime(apt.scheduledAt)}</p>
                                    <p className="text-xs text-muted-foreground">{apt.duration} min</p>
                                  </div>
                                </div>
                                {apt.isTelehealth && apt.telehealthUrl && (
                                  <Button variant="outline" size="sm" className="mt-3" data-testid={`button-join-telehealth-${apt.id}`}>
                                    <Video className="h-4 w-4 mr-2" />
                                    Join Video Call
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {sectionVisibility.telehealth && patientView.telehealthHistory.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Video className="h-5 w-5" />
                          Telehealth History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {patientView.telehealthHistory.map((session) => (
                            <div key={session.id} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-medium">{session.providerName}</p>
                                  <p className="text-sm text-muted-foreground">{session.specialty}</p>
                                  {session.summary && (
                                    <p className="text-sm mt-2 bg-muted p-2 rounded">{session.summary}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  {getStatusBadge(session.status)}
                                  <p className="text-sm mt-1">{formatDateTime(session.scheduledAt)}</p>
                                  <p className="text-xs text-muted-foreground">{session.duration} min</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="risks" className="space-y-4">
                  {sectionVisibility.risks && (
                    <>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            AI Risk Assessments
                          </CardTitle>
                          <CardDescription>
                            AI-generated risk analysis for informational purposes only
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {patientView.riskAssessments.map((risk) => (
                              <div key={risk.id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                                  <div className="flex items-center gap-3">
                                    <Badge className={getRiskLevelColor(risk.riskLevel)}>
                                      {risk.riskLevel.toUpperCase()}
                                    </Badge>
                                    <span className="font-medium">{risk.conditionName}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm">Score: {Math.round(risk.riskScore * 100)}%</p>
                                    <p className="text-xs text-muted-foreground">Timeframe: {risk.timeframe}</p>
                                  </div>
                                </div>
                                <div className="mb-2">
                                  <Progress value={risk.riskScore * 100} className="h-2" />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {risk.topFactors.map((factor, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {factor}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  AI Confidence: {Math.round(risk.aiConfidence * 100)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Medication Safety Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold text-green-600">{Math.round(patientView.medicationSafety.safetyScore * 100)}%</p>
                              <p className="text-xs text-muted-foreground">Safety Score</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{patientView.medicationSafety.interactionsCount}</p>
                              <p className="text-xs text-muted-foreground">Interactions</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{patientView.medicationSafety.allergyConcerns}</p>
                              <p className="text-xs text-muted-foreground">Allergy Concerns</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-2xl font-bold">{patientView.medicationSafety.dosingConcerns}</p>
                              <p className="text-xs text-muted-foreground">Dosing Concerns</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="care" className="space-y-4">
                  {sectionVisibility.carePlan && patientView.carePlan && (
                    <>
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ClipboardList className="h-5 w-5" />
                              {patientView.carePlan.title}
                            </CardTitle>
                            {getStatusBadge(patientView.carePlan.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <p className="font-medium mb-2">Priority Recommendations</p>
                              <div className="space-y-2">
                                {patientView.carePlan.priorityRecommendations.map((rec, idx) => (
                                  <div key={idx} className="flex items-start gap-2 p-2 bg-muted rounded">
                                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                    <span className="text-sm">{rec}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Syringe className="h-5 w-5" />
                            Upcoming Screenings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {patientView.carePlan.upcomingScreenings.map((screening, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <span className="font-medium">{screening.name}</span>
                                <Badge variant="outline">{formatDate(screening.dueDate)}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Wellness Goals
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {patientView.carePlan.wellnessGoals.map((goal, idx) => (
                              <div key={idx}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{goal.goal}</span>
                                  <span className="text-sm text-muted-foreground">{goal.progress}%</span>
                                </div>
                                <Progress value={goal.progress} className="h-2" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
