import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Stethoscope,
  Pill,
  FlaskConical,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  ShieldAlert,
  Activity,
  FileText,
  Info,
  Sparkles,
  Heart,
  Thermometer,
  ChevronRight,
  TestTube,
  Building2,
  Calendar,
  CheckCircle,
  TrendingUp,
  ExternalLink,
  BarChart3,
  Bell,
  Shield,
  Syringe,
  Clock,
  Target,
  Users,
  LayoutDashboard,
  CircleAlert,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SymptomEntry {
  name: string;
  severity: number;
  duration: string;
}

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
}

interface LabEntry {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: "normal" | "abnormal" | "critical";
}

interface DifferentialResult {
  condition: string;
  probability: "high" | "medium" | "low";
  supportingEvidence: string[];
  contradictingFactors: string[];
  suggestedWorkup: string[];
}

interface DiagnosisResponse {
  patientId: string;
  generatedAt: string;
  differentials: DifferentialResult[];
  clinicalContext: string;
  dataQualityNotes: string[];
  uscdiDataClasses: string[];
  disclaimer: string;
}

interface DrugInteractionResult {
  id: string;
  medications: { id: string; name: string; dosage: string }[];
  severity: "minor" | "moderate" | "major" | "contraindicated";
  interactionType: string;
  description: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendations: string[];
  alternativeOptions?: string[];
  monitoringRequired: string[];
  aiConfidence: number;
}

interface DrugInteractionResponse {
  patientId: string;
  generatedAt: string;
  interactions: DrugInteractionResult[];
  totalMedicationsAnalyzed: number;
  totalPairsChecked: number;
  severitySummary: {
    contraindicated: number;
    major: number;
    moderate: number;
    minor: number;
  };
  disclaimer: string;
}

interface TestRecommendation {
  testName: string;
  testCode?: string;
  codeSystem?: string;
  category: "laboratory" | "imaging" | "procedure" | "screening";
  priority: "routine" | "urgent" | "stat";
  rationale: string;
  relatedSymptoms: string[];
  expectedFindings: string;
  estimatedTurnaround: string;
}

interface DiagnosticTestResponse {
  patientId: string;
  generatedAt: string;
  recommendations: TestRecommendation[];
  clinicalContext: string;
  uscdiDataClasses: string[];
  disclaimer: string;
}

interface RiskFactor {
  factor: string;
  impact: "high" | "moderate" | "low";
  source: string;
}

interface ConditionRisk {
  condition: string;
  riskLevel: "high" | "moderate" | "low";
  riskScore: number;
  drivers: RiskFactor[];
  dataGaps: string[];
  observationalNotes: string;
}

interface RiskStratificationResponse {
  patientId: string;
  generatedAt: string;
  overallRiskTier: "high" | "moderate" | "low";
  conditionRisks: ConditionRisk[];
  dataCompleteness: number;
  uscdiDataClasses: string[];
  disclaimer: string;
}

interface ScreeningAlert {
  screeningName: string;
  category: "cancer" | "cardiovascular" | "metabolic" | "infectious" | "other";
  status: "overdue" | "due_soon" | "up_to_date";
  guidelineSource: string;
  lastPerformed: string | null;
  dueDate: string;
  intervalMonths: number;
  rationale: string;
  ageRange: string;
  applicableSex: string;
}

interface VaccinationAlert {
  vaccineName: string;
  status: "overdue" | "due_soon" | "up_to_date" | "not_applicable";
  lastDoseDate: string | null;
  dosesCompleted: number;
  dosesRequired: number;
  dueDate: string;
  guidelineSource: string;
  rationale: string;
}

interface PreventiveAlertsResponse {
  patientId: string;
  generatedAt: string;
  screeningAlerts: ScreeningAlert[];
  vaccinationAlerts: VaccinationAlert[];
  overdueCount: number;
  dueSoonCount: number;
  upToDateCount: number;
  uscdiDataClasses: string[];
  disclaimer: string;
}

interface CDSOverviewResponse {
  patientId: string;
  generatedAt: string;
  riskSummary: {
    overallRiskTier: "high" | "moderate" | "low";
    dataCompleteness: number;
    topRisks: {
      condition: string;
      riskLevel: "high" | "moderate" | "low";
      riskScore: number;
      topDriver: string;
    }[];
  };
  overdueSummary: {
    overdueCount: number;
    dueSoonCount: number;
    upToDateCount: number;
    overdueScreenings: { name: string; category: string; guidelineSource: string; dueDate: string }[];
    overdueVaccinations: { name: string; guidelineSource: string; dosesCompleted: number; dosesRequired: number; dueDate: string }[];
    dueSoonScreenings: { name: string; category: string; dueDate: string }[];
    dueSoonVaccinations: { name: string; dueDate: string }[];
  };
  categorySummary: {
    category: string;
    icon: string;
    status: "action_needed" | "review" | "clear";
    count: number;
    description: string;
  }[];
  disclaimer: string;
}

function CDSDisclaimer() {
  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-cds-disclaimer">
      <CardContent className="flex items-start gap-3 p-4">
        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300" data-testid="text-cds-disclaimer-title">
            Informational Only — Not Clinical Decision Support
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70" data-testid="text-cds-disclaimer-body">
            AI-generated content is for informational and operational purposes only. It does not constitute
            medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by
            qualified healthcare professionals based on their independent clinical judgment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function severityColor(severity: string) {
  switch (severity) {
    case "contraindicated": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "major": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "moderate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "minor": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function probabilityColor(prob: string) {
  switch (prob) {
    case "high": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "medium":
    case "moderate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case "stat": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "urgent": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "routine": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "laboratory": return <FlaskConical className="h-4 w-4" />;
    case "imaging": return <Activity className="h-4 w-4" />;
    case "procedure": return <Heart className="h-4 w-4" />;
    case "screening": return <FileText className="h-4 w-4" />;
    default: return <FlaskConical className="h-4 w-4" />;
  }
}

export default function ClinicalDecisionSupportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const [patientId, setPatientId] = useState("patient-001");
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([{ name: "", severity: 5, duration: "" }]);
  const [medications, setMedications] = useState<MedicationEntry[]>([
    { id: "med-1", name: "", dosage: "" },
    { id: "med-2", name: "", dosage: "" },
  ]);
  const [labs, setLabs] = useState<LabEntry[]>([]);
  const [vitals, setVitals] = useState({ bloodPressure: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "" });
  const [demographics, setDemographics] = useState({ age: "", sex: "" });
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [suspectedConditions, setSuspectedConditions] = useState("");

  const diagnosisMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/diagnosis", data);
      return res.json() as Promise<DiagnosisResponse>;
    },
    onError: () => {
      toast({ title: "Analysis Unavailable", description: "Unable to generate analysis. Please try again.", variant: "destructive" });
    },
  });

  const drugInteractionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/drug-interactions", data);
      return res.json() as Promise<DrugInteractionResponse>;
    },
    onError: () => {
      toast({ title: "Analysis Unavailable", description: "Unable to check interactions. Please try again.", variant: "destructive" });
    },
  });

  const diagnosticTestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/diagnostic-tests", data);
      return res.json() as Promise<DiagnosticTestResponse>;
    },
    onError: () => {
      toast({ title: "Analysis Unavailable", description: "Unable to generate test analysis. Please try again.", variant: "destructive" });
    },
  });

  const labResultsQuery = useQuery<{
    results: {
      id: string;
      orderId: string;
      patientId: string;
      providerId: string;
      providerName: string;
      testName: string;
      loincCode: string;
      value: string;
      unit: string;
      referenceRange: string;
      interpretation: "normal" | "abnormal" | "critical" | "indeterminate";
      status: string;
      collectedAt: string;
      reportedAt: string;
      performingLab: string;
    }[];
    totalCount: number;
    noCdsDisclaimer: string;
  }>({
    queryKey: [`/api/lab-diagnostics/results/${patientId}`],
    enabled: activeTab === "lab-results",
  });

  const riskStratificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/risk-stratification", data);
      return res.json() as Promise<RiskStratificationResponse>;
    },
    onError: () => {
      toast({ title: "Analysis Unavailable", description: "Unable to generate risk analysis. Please try again.", variant: "destructive" });
    },
  });

  const preventiveAlertsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/preventive-alerts", data);
      return res.json() as Promise<PreventiveAlertsResponse>;
    },
    onError: () => {
      toast({ title: "Analysis Unavailable", description: "Unable to generate preventive alerts. Please try again.", variant: "destructive" });
    },
  });

  const overviewMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cds/overview", data);
      return res.json() as Promise<CDSOverviewResponse>;
    },
    onError: () => {
      toast({ title: "Dashboard Unavailable", description: "Unable to load CDS overview. Please try again.", variant: "destructive" });
    },
  });

  const [familyHistory, setFamilyHistory] = useState("");
  const [socialFactors, setSocialFactors] = useState("");
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const overviewAutoLoaded = useRef(false);

  useEffect(() => {
    if (activeTab === "overview" && !overviewAutoLoaded.current && !overviewMutation.data && !overviewMutation.isPending) {
      overviewAutoLoaded.current = true;
      const data: any = { patientId };
      if (demographics.age || demographics.sex) {
        data.demographics = {
          ...(demographics.age ? { age: parseInt(demographics.age) } : {}),
          ...(demographics.sex ? { sex: demographics.sex } : {}),
        };
      }
      overviewMutation.mutate(data);
      setOverviewLoaded(true);
    }
  }, [activeTab]);

  function addSymptom() {
    setSymptoms([...symptoms, { name: "", severity: 5, duration: "" }]);
  }

  function removeSymptom(index: number) {
    setSymptoms(symptoms.filter((_, i) => i !== index));
  }

  function updateSymptom(index: number, field: keyof SymptomEntry, value: string | number) {
    const updated = [...symptoms];
    (updated[index] as any)[field] = value;
    setSymptoms(updated);
  }

  function addMedication() {
    setMedications([...medications, { id: `med-${Date.now()}`, name: "", dosage: "" }]);
  }

  function removeMedication(index: number) {
    setMedications(medications.filter((_, i) => i !== index));
  }

  function updateMedication(index: number, field: keyof MedicationEntry, value: string) {
    const updated = [...medications];
    (updated[index] as any)[field] = value;
    setMedications(updated);
  }

  function addLab() {
    setLabs([...labs, { testName: "", value: "", unit: "", referenceRange: "", status: "normal" }]);
  }

  function removeLab(index: number) {
    setLabs(labs.filter((_, i) => i !== index));
  }

  function updateLab(index: number, field: keyof LabEntry, value: string) {
    const updated = [...labs];
    (updated[index] as any)[field] = value;
    setLabs(updated);
  }

  function handleDiagnosisSubmit() {
    const validSymptoms = symptoms.filter(s => s.name.trim());
    if (validSymptoms.length === 0) {
      toast({ title: "Symptoms Required", description: "Please enter at least one symptom.", variant: "destructive" });
      return;
    }

    const vitalData: any = {};
    if (vitals.bloodPressure) vitalData.bloodPressure = vitals.bloodPressure;
    if (vitals.heartRate) vitalData.heartRate = Number(vitals.heartRate);
    if (vitals.temperature) vitalData.temperature = Number(vitals.temperature);
    if (vitals.respiratoryRate) vitalData.respiratoryRate = Number(vitals.respiratoryRate);
    if (vitals.oxygenSaturation) vitalData.oxygenSaturation = Number(vitals.oxygenSaturation);

    const payload: any = {
      patientId,
      symptoms: validSymptoms.map(s => ({ name: s.name, severity: s.severity, duration: s.duration || undefined })),
    };
    if (Object.keys(vitalData).length > 0) payload.vitals = vitalData;
    if (labs.length > 0) payload.labs = labs.filter(l => l.testName.trim());
    if (demographics.age || demographics.sex) {
      payload.demographics = {};
      if (demographics.age) payload.demographics.age = Number(demographics.age);
      if (demographics.sex) payload.demographics.sex = demographics.sex;
    }
    if (conditions.trim()) {
      payload.conditions = conditions.split(",").map(c => ({ name: c.trim(), status: "active" }));
    }

    diagnosisMutation.mutate(payload);
  }

  function handleDrugInteractionSubmit() {
    const validMeds = medications.filter(m => m.name.trim() && m.dosage.trim());
    if (validMeds.length < 2) {
      toast({ title: "Medications Required", description: "Please enter at least 2 medications to check interactions.", variant: "destructive" });
      return;
    }

    const payload: any = {
      patientId,
      medications: validMeds,
    };
    if (allergies.trim()) payload.allergies = allergies.split(",").map(a => a.trim());
    if (conditions.trim()) payload.conditions = conditions.split(",").map(c => c.trim());

    drugInteractionMutation.mutate(payload);
  }

  function handleDiagnosticTestSubmit() {
    const validSymptoms = symptoms.filter(s => s.name.trim());
    if (validSymptoms.length === 0) {
      toast({ title: "Symptoms Required", description: "Please enter at least one symptom.", variant: "destructive" });
      return;
    }

    const payload: any = {
      patientId,
      symptoms: validSymptoms.map(s => ({ name: s.name, severity: s.severity, duration: s.duration || undefined })),
    };
    if (suspectedConditions.trim()) {
      payload.suspectedConditions = suspectedConditions.split(",").map(c => c.trim());
    }
    if (labs.length > 0) payload.existingLabs = labs.filter(l => l.testName.trim());

    const vitalData: any = {};
    if (vitals.bloodPressure) vitalData.bloodPressure = vitals.bloodPressure;
    if (vitals.heartRate) vitalData.heartRate = Number(vitals.heartRate);
    if (vitals.temperature) vitalData.temperature = Number(vitals.temperature);
    if (Object.keys(vitalData).length > 0) payload.vitals = vitalData;
    if (demographics.age || demographics.sex) {
      payload.demographics = {};
      if (demographics.age) payload.demographics.age = Number(demographics.age);
      if (demographics.sex) payload.demographics.sex = demographics.sex;
    }

    diagnosticTestMutation.mutate(payload);
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-cds-page-title">Clinical Decision Support</h1>
            <Badge variant="outline" className="text-xs" data-testid="badge-uscdi-v6">USCDI v6</Badge>
            <Badge variant="outline" className="text-xs" data-testid="badge-no-cds">NO-CDS Compliant</Badge>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-cds-subtitle">
            AI-powered informational analysis for provider review. Uses USCDI v6 data classes for standardized health data interpretation.
          </p>
        </div>

        <CDSDisclaimer />

        <div className="flex items-center gap-3 flex-wrap">
          <Label htmlFor="patient-id" className="text-sm font-medium whitespace-nowrap">Patient ID</Label>
          <Input
            id="patient-id"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="max-w-xs"
            data-testid="input-patient-id"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full flex-wrap h-auto gap-1" data-testid="tabs-cds">
            <TabsTrigger value="overview" className="gap-1 flex-1 min-w-0" data-testid="tab-overview">
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Overview</span>
              <span className="sm:hidden">Dash</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className="gap-1 flex-1 min-w-0" data-testid="tab-diagnosis">
              <Stethoscope className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Diagnosis</span>
              <span className="sm:hidden">Dx</span>
            </TabsTrigger>
            <TabsTrigger value="interactions" className="gap-1 flex-1 min-w-0" data-testid="tab-interactions">
              <Pill className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Interactions</span>
              <span className="sm:hidden">Rx</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="gap-1 flex-1 min-w-0" data-testid="tab-tests">
              <FlaskConical className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Tests</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
            <TabsTrigger value="lab-results" className="gap-1 flex-1 min-w-0" data-testid="tab-lab-results">
              <TestTube className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Labs</span>
              <span className="sm:hidden">Labs</span>
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-1 flex-1 min-w-0" data-testid="tab-risk">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Risk</span>
              <span className="sm:hidden">Risk</span>
            </TabsTrigger>
            <TabsTrigger value="preventive" className="gap-1 flex-1 min-w-0" data-testid="tab-preventive">
              <Bell className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">Preventive</span>
              <span className="sm:hidden">Prev</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold" data-testid="text-overview-title">CDS Dashboard</h2>
              </div>
              <Button
                onClick={() => {
                  const data: any = { patientId };
                  if (demographics.age || demographics.sex) {
                    data.demographics = {
                      ...(demographics.age ? { age: parseInt(demographics.age) } : {}),
                      ...(demographics.sex ? { sex: demographics.sex } : {}),
                    };
                  }
                  if (conditions) data.conditions = conditions.split(",").map((c: string) => c.trim()).filter(Boolean);
                  if (familyHistory) data.familyHistory = familyHistory.split(",").map((f: string) => f.trim()).filter(Boolean);
                  overviewMutation.mutate(data);
                  setOverviewLoaded(true);
                }}
                disabled={overviewMutation.isPending}
                data-testid="button-load-overview"
              >
                {overviewMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading Dashboard...</>
                ) : overviewLoaded ? (
                  <><LayoutDashboard className="h-4 w-4 mr-2" />Refresh Dashboard</>
                ) : (
                  <><LayoutDashboard className="h-4 w-4 mr-2" />Load Patient Dashboard</>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinical-decision-suppor-patient-age" className="text-sm">Patient Age</Label>
                <Input id="clinical-decision-suppor-patient-age"
                  type="number"
                  value={demographics.age}
                  onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                  placeholder="e.g., 55"
                  data-testid="input-overview-age"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinical-decision-suppor-patient-sex" className="text-sm">Patient Sex</Label>
                <Select
                  value={demographics.sex}
                  onValueChange={(val) => setDemographics({ ...demographics, sex: val })}
                >
                  <SelectTrigger id="clinical-decision-suppor-patient-sex" data-testid="select-overview-sex">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {overviewMutation.isPending && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-8 w-16 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            )}

            {overviewMutation.data && (
              <div className="space-y-5" data-testid="overview-results">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className={`${
                    overviewMutation.data.riskSummary.overallRiskTier === "high"
                      ? "border-red-300 dark:border-red-800"
                      : overviewMutation.data.riskSummary.overallRiskTier === "moderate"
                      ? "border-amber-200 dark:border-amber-800"
                      : ""
                  }`}>
                    <CardContent className="p-4 text-center">
                      <Badge className={`mb-1 ${probabilityColor(overviewMutation.data.riskSummary.overallRiskTier)}`} data-testid="badge-overview-risk-tier">
                        {overviewMutation.data.riskSummary.overallRiskTier.toUpperCase()}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Overall Risk</p>
                    </CardContent>
                  </Card>
                  <Card className={overviewMutation.data.overdueSummary.overdueCount > 0 ? "border-red-300 dark:border-red-800" : ""}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-overview-overdue">
                        {overviewMutation.data.overdueSummary.overdueCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CircleAlert className="h-3 w-3" />
                        Overdue
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={overviewMutation.data.overdueSummary.dueSoonCount > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-overview-due-soon">
                        {overviewMutation.data.overdueSummary.dueSoonCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due Soon
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-overview-up-to-date">
                        {overviewMutation.data.overdueSummary.upToDateCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Up to Date
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {overviewMutation.data.overdueSummary.overdueScreenings.length > 0 && (
                  <Card className="border-red-200 dark:border-red-900" data-testid="card-overdue-screenings">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-red-700 dark:text-red-300">Overdue Screenings</span>
                        <Badge variant="destructive" className="text-xs">{overviewMutation.data.overdueSummary.overdueScreenings.length}</Badge>
                      </CardTitle>
                      <CardDescription>Screenings past their recommended schedule require provider attention</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {overviewMutation.data.overdueSummary.overdueScreenings.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 border rounded-md p-3 border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10" data-testid={`overdue-screening-${idx}`}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-medium text-sm" data-testid={`text-overdue-screening-name-${idx}`}>{s.name}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <Badge variant="outline" className="text-xs">{s.category}</Badge>
                                  <span>{s.guidelineSource}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => setActiveTab("preventive")}
                              data-testid={`button-view-screening-${idx}`}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {overviewMutation.data.overdueSummary.overdueVaccinations.length > 0 && (
                  <Card className="border-red-200 dark:border-red-900" data-testid="card-overdue-vaccinations">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Syringe className="h-4 w-4 text-red-500" />
                        <span className="text-red-700 dark:text-red-300">Overdue Vaccinations</span>
                        <Badge variant="destructive" className="text-xs">{overviewMutation.data.overdueSummary.overdueVaccinations.length}</Badge>
                      </CardTitle>
                      <CardDescription>Vaccinations past their recommended schedule</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {overviewMutation.data.overdueSummary.overdueVaccinations.map((v, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 border rounded-md p-3 border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10" data-testid={`overdue-vaccination-${idx}`}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Syringe className="h-4 w-4 text-red-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-medium text-sm" data-testid={`text-overdue-vaccine-name-${idx}`}>{v.name}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <span>{v.dosesCompleted}/{v.dosesRequired} doses</span>
                                  <span>{v.guidelineSource}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => setActiveTab("preventive")}
                              data-testid={`button-view-vaccine-${idx}`}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card data-testid="card-risk-dashboard">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Risk Stratification Dashboard
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={probabilityColor(overviewMutation.data.riskSummary.overallRiskTier)} data-testid="badge-dashboard-risk">
                          {overviewMutation.data.riskSummary.overallRiskTier.toUpperCase()} RISK
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {overviewMutation.data.riskSummary.dataCompleteness}% data completeness
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Progress value={overviewMutation.data.riskSummary.dataCompleteness} className="h-2 mb-4" data-testid="progress-overview-completeness" />
                    <div className="space-y-2">
                      {overviewMutation.data.riskSummary.topRisks.map((risk, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between gap-3 border rounded-md p-3 flex-wrap ${
                            risk.riskLevel === "high"
                              ? "border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10"
                              : risk.riskLevel === "moderate"
                              ? "border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10"
                              : ""
                          }`}
                          data-testid={`overview-risk-${idx}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {risk.riskLevel === "high" ? (
                              <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
                            ) : risk.riskLevel === "moderate" ? (
                              <TrendingDown className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Shield className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-sm" data-testid={`text-overview-risk-name-${idx}`}>{risk.condition}</span>
                              <p className="text-xs text-muted-foreground truncate" data-testid={`text-overview-risk-driver-${idx}`}>
                                {risk.topDriver}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={probabilityColor(risk.riskLevel)} data-testid={`badge-overview-risk-level-${idx}`}>
                              {risk.riskLevel}
                            </Badge>
                            <span className="text-sm font-bold tabular-nums" data-testid={`text-overview-risk-score-${idx}`}>
                              {risk.riskScore}/100
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("risk")} data-testid="button-view-full-risk">
                        View Full Risk Analysis <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="category-summary-grid">
                  {overviewMutation.data.categorySummary.map((cat, idx) => (
                    <Card
                      key={idx}
                      className={`hover-elevate cursor-pointer ${
                        cat.status === "action_needed"
                          ? "border-red-200 dark:border-red-900"
                          : cat.status === "review"
                          ? "border-amber-200 dark:border-amber-800"
                          : ""
                      }`}
                      onClick={() => {
                        if (cat.category === "Risk Stratification") setActiveTab("risk");
                        else if (cat.category === "Overdue Screenings" || cat.category === "Overdue Vaccinations" || cat.category === "Preventive Care") setActiveTab("preventive");
                      }}
                      data-testid={`card-category-${idx}`}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-md ${
                          cat.status === "action_needed"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            : cat.status === "review"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        }`}>
                          {cat.icon === "bar-chart" && <BarChart3 className="h-5 w-5" />}
                          {cat.icon === "file-text" && <FileText className="h-5 w-5" />}
                          {cat.icon === "syringe" && <Syringe className="h-5 w-5" />}
                          {cat.icon === "shield" && <Shield className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" data-testid={`text-category-name-${idx}`}>{cat.category}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-category-desc-${idx}`}>{cat.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {cat.status === "action_needed" && <Badge variant="destructive" className="text-xs">Action Needed</Badge>}
                          {cat.status === "review" && <Badge variant="secondary" className="text-xs">Review</Badge>}
                          {cat.status === "clear" && <Badge variant="outline" className="text-xs">Clear</Badge>}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-start gap-2 border-t pt-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground" data-testid="text-overview-disclaimer">
                    {overviewMutation.data.disclaimer}
                  </p>
                </div>
              </div>
            )}

            {!overviewMutation.data && !overviewMutation.isPending && (
              <Card>
                <CardContent className="p-8 text-center">
                  <LayoutDashboard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Enter patient demographics above and click "Load Patient Dashboard" to see a comprehensive CDS overview.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The dashboard shows risk stratification, overdue screenings, overdue vaccinations, and category summaries at a glance.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="diagnosis" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-300" data-testid="text-section-diagnosis">Diagnosis Tools</h2>
                <p className="text-xs text-muted-foreground">Symptom analysis and differential considerations</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Symptom-Based Analysis
                </CardTitle>
                <CardDescription>
                  Enter patient symptoms, vitals, and lab data to generate informational differential analysis for provider review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <FieldCaption className="font-medium">Symptoms</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addSymptom} data-testid="button-add-symptom">
                      <Plus className="h-4 w-4 mr-1" /> Add Symptom
                    </Button>
                  </div>
                  {symptoms.map((symptom, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Symptom name (e.g. headache, fatigue)"
                        value={symptom.name}
                        onChange={(e) => updateSymptom(i, "name", e.target.value)}
                        className="flex-1 min-w-[180px]"
                        data-testid={`input-symptom-name-${i}`}
                      />
                      <div className="flex items-center gap-1">
                        <FieldCaption className="text-xs whitespace-nowrap">Severity</FieldCaption>
                        <Select value={String(symptom.severity)} onValueChange={(v) => updateSymptom(i, "severity", Number(v))}>
                          <SelectTrigger aria-label="Severity" className="w-16" data-testid={`select-symptom-severity-${i}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        placeholder="Duration (e.g. 3 days)"
                        value={symptom.duration}
                        onChange={(e) => updateSymptom(i, "duration", e.target.value)}
                        className="w-32"
                        data-testid={`input-symptom-duration-${i}`}
                      />
                      {symptoms.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeSymptom(i)} data-testid={`button-remove-symptom-${i}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <FieldCaption className="font-medium flex items-center gap-1">
                      <Activity className="h-4 w-4" /> Vitals (optional)
                    </FieldCaption>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="clinical-decision-suppor-blood-pressure" className="text-xs">Blood Pressure</Label>
                        <Input id="clinical-decision-suppor-blood-pressure" placeholder="120/80" value={vitals.bloodPressure} onChange={(e) => setVitals({...vitals, bloodPressure: e.target.value})} data-testid="input-vital-bp" />
                      </div>
                      <div>
                        <Label htmlFor="clinical-decision-suppor-heart-rate" className="text-xs">Heart Rate</Label>
                        <Input id="clinical-decision-suppor-heart-rate" placeholder="72" value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: e.target.value})} data-testid="input-vital-hr" />
                      </div>
                      <div>
                        <Label htmlFor="clinical-decision-suppor-temperature" className="text-xs">Temperature</Label>
                        <Input id="clinical-decision-suppor-temperature" placeholder="98.6" value={vitals.temperature} onChange={(e) => setVitals({...vitals, temperature: e.target.value})} data-testid="input-vital-temp" />
                      </div>
                      <div>
                        <Label htmlFor="clinical-decision-suppor-spo2" className="text-xs">SpO2 %</Label>
                        <Input id="clinical-decision-suppor-spo2" placeholder="98" value={vitals.oxygenSaturation} onChange={(e) => setVitals({...vitals, oxygenSaturation: e.target.value})} data-testid="input-vital-spo2" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldCaption className="font-medium flex items-center gap-1">
                      <Info className="h-4 w-4" /> Demographics (optional)
                    </FieldCaption>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="clinical-decision-suppor-age" className="text-xs">Age</Label>
                        <Input id="clinical-decision-suppor-age" placeholder="45" value={demographics.age} onChange={(e) => setDemographics({...demographics, age: e.target.value})} data-testid="input-demo-age" />
                      </div>
                      <div>
                        <Label htmlFor="clinical-decision-suppor-sex" className="text-xs">Sex</Label>
                        <Select value={demographics.sex} onValueChange={(v) => setDemographics({...demographics, sex: v})}>
                          <SelectTrigger id="clinical-decision-suppor-sex" data-testid="select-patient-sex">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="clinical-decision-suppor-existing-conditions-comma-separated" className="text-xs">Existing Conditions (comma-separated)</Label>
                      <Input id="clinical-decision-suppor-existing-conditions-comma-separated" placeholder="Type 2 Diabetes, Hypertension" value={conditions} onChange={(e) => setConditions(e.target.value)} data-testid="input-conditions" />
                    </div>
                  </div>
                </div>

                <Button onClick={handleDiagnosisSubmit} disabled={diagnosisMutation.isPending} className="w-full" data-testid="button-analyze-diagnosis">
                  {diagnosisMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing Patient Data...</>
                  ) : (
                    <><Stethoscope className="h-4 w-4 mr-2" /> Generate Informational Analysis</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {diagnosisMutation.data && (
              <div className="space-y-4" data-testid="section-diagnosis-results">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-lg" data-testid="text-diagnosis-results-title">Differential Analysis Results</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {diagnosisMutation.data.uscdiDataClasses.map((dc) => (
                      <Badge key={dc} variant="secondary" className="text-xs">{dc}</Badge>
                    ))}
                  </div>
                </div>

                {diagnosisMutation.data.dataQualityNotes.length > 0 && (
                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardContent className="p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                        {diagnosisMutation.data.dataQualityNotes.map((note, i) => (
                          <p key={i}>{note}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {diagnosisMutation.data.differentials.map((diff, i) => (
                  <Card key={i} data-testid={`card-differential-${i}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="font-medium">{diff.condition}</h4>
                        <Badge className={probabilityColor(diff.probability)}>{diff.probability} relevance</Badge>
                      </div>
                      {diff.supportingEvidence.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Data Points</p>
                          <ul className="text-sm space-y-1">
                            {diff.supportingEvidence.map((ev, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <ChevronRight className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.contradictingFactors.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Contradicting Factors</p>
                          <ul className="text-sm space-y-1">
                            {diff.contradictingFactors.map((cf, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <X className="h-3 w-3 mt-1 text-red-500 shrink-0" />
                                <span>{cf}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diff.suggestedWorkup.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Relevant Workup</p>
                          <ul className="text-sm space-y-1">
                            {diff.suggestedWorkup.map((wu, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <FlaskConical className="h-3 w-3 mt-1 text-blue-500 shrink-0" />
                                <span>{wu}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <p className="text-xs text-muted-foreground italic" data-testid="text-diagnosis-disclaimer">
                  {diagnosisMutation.data.disclaimer}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="interactions" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Pill className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300" data-testid="text-section-interactions">Interaction Checker</h2>
                <p className="text-xs text-muted-foreground">Drug-drug interaction analysis</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Drug Interaction Checker
                </CardTitle>
                <CardDescription>
                  Enter two or more medications to check for potential drug-drug interactions. Analysis is informational only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <FieldCaption className="font-medium">Medications (minimum 2)</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addMedication} data-testid="button-add-medication">
                      <Plus className="h-4 w-4 mr-1" /> Add Medication
                    </Button>
                  </div>
                  {medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Medication name (e.g. Lisinopril)"
                        value={med.name}
                        onChange={(e) => updateMedication(i, "name", e.target.value)}
                        className="flex-1 min-w-[180px]"
                        data-testid={`input-med-name-${i}`}
                      />
                      <Input
                        placeholder="Dosage (e.g. 10mg daily)"
                        value={med.dosage}
                        onChange={(e) => updateMedication(i, "dosage", e.target.value)}
                        className="w-40"
                        data-testid={`input-med-dosage-${i}`}
                      />
                      {medications.length > 2 && (
                        <Button size="icon" variant="ghost" onClick={() => removeMedication(i)} data-testid={`button-remove-med-${i}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clinical-decision-suppor-known-allergies-comma-separated-optional" className="text-xs">Known Allergies (comma-separated, optional)</Label>
                    <Input id="clinical-decision-suppor-known-allergies-comma-separated-optional" placeholder="Penicillin, Sulfa" value={allergies} onChange={(e) => setAllergies(e.target.value)} data-testid="input-allergies" />
                  </div>
                  <div>
                    <Label htmlFor="clinical-decision-suppor-patient-conditions-comma-separated-optio" className="text-xs">Patient Conditions (comma-separated, optional)</Label>
                    <Input id="clinical-decision-suppor-patient-conditions-comma-separated-optio" placeholder="CKD, Heart Failure" value={conditions} onChange={(e) => setConditions(e.target.value)} data-testid="input-interaction-conditions" />
                  </div>
                </div>

                <Button onClick={handleDrugInteractionSubmit} disabled={drugInteractionMutation.isPending} className="w-full" data-testid="button-check-interactions">
                  {drugInteractionMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking Interactions...</>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 mr-2" /> Check Drug Interactions</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {drugInteractionMutation.data && (
              <div className="space-y-4" data-testid="section-interaction-results">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-lg" data-testid="text-interaction-results-title">Interaction Analysis</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {drugInteractionMutation.data.totalMedicationsAnalyzed} medications
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {drugInteractionMutation.data.totalPairsChecked} pairs checked
                    </Badge>
                  </div>
                </div>

                {drugInteractionMutation.data.interactions.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {drugInteractionMutation.data.severitySummary.contraindicated > 0 && (
                      <Badge className={severityColor("contraindicated")}>
                        {drugInteractionMutation.data.severitySummary.contraindicated} Contraindicated
                      </Badge>
                    )}
                    {drugInteractionMutation.data.severitySummary.major > 0 && (
                      <Badge className={severityColor("major")}>
                        {drugInteractionMutation.data.severitySummary.major} Major
                      </Badge>
                    )}
                    {drugInteractionMutation.data.severitySummary.moderate > 0 && (
                      <Badge className={severityColor("moderate")}>
                        {drugInteractionMutation.data.severitySummary.moderate} Moderate
                      </Badge>
                    )}
                    {drugInteractionMutation.data.severitySummary.minor > 0 && (
                      <Badge className={severityColor("minor")}>
                        {drugInteractionMutation.data.severitySummary.minor} Minor
                      </Badge>
                    )}
                  </div>
                )}

                {drugInteractionMutation.data.interactions.length === 0 ? (
                  <Card data-testid="card-no-interactions">
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                      No significant drug-drug interactions detected in the analyzed medication pairs.
                    </CardContent>
                  </Card>
                ) : (
                  drugInteractionMutation.data.interactions.map((interaction, i) => (
                    <Card key={i} data-testid={`card-interaction-${i}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{interaction.medications[0]?.name}</span>
                            <X className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{interaction.medications[1]?.name}</span>
                          </div>
                          <Badge className={severityColor(interaction.severity)}>{interaction.severity}</Badge>
                        </div>
                        <p className="text-sm">{interaction.description}</p>
                        {interaction.clinicalEffects.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Noted Effects</p>
                            <div className="flex flex-wrap gap-1">
                              {interaction.clinicalEffects.map((eff, j) => (
                                <Badge key={j} variant="outline" className="text-xs">{eff}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {interaction.monitoringRequired.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Monitoring Points</p>
                            <ul className="text-sm space-y-1">
                              {interaction.monitoringRequired.map((mon, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <Activity className="h-3 w-3 mt-1 text-amber-500 shrink-0" />
                                  <span>{mon}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center justify-end">
                          <Badge variant="outline" className="text-xs">
                            Confidence: {interaction.aiConfidence}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                <p className="text-xs text-muted-foreground italic" data-testid="text-interaction-disclaimer">
                  {drugInteractionMutation.data.disclaimer}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tests" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-teal-100 dark:bg-teal-900/30">
                <FlaskConical className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-teal-700 dark:text-teal-300" data-testid="text-section-tests">Diagnostic Tests</h2>
                <p className="text-xs text-muted-foreground">Test recommendations and analysis</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Diagnostic Test Analysis
                </CardTitle>
                <CardDescription>
                  Based on documented symptoms and clinical data, identify relevant diagnostic tests for provider consideration. Includes LOINC codes where applicable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <FieldCaption className="font-medium">Symptoms</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addSymptom} data-testid="button-add-symptom-tests">
                      <Plus className="h-4 w-4 mr-1" /> Add Symptom
                    </Button>
                  </div>
                  {symptoms.map((symptom, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Symptom name"
                        value={symptom.name}
                        onChange={(e) => updateSymptom(i, "name", e.target.value)}
                        className="flex-1 min-w-[180px]"
                        data-testid={`input-test-symptom-name-${i}`}
                      />
                      <Select value={String(symptom.severity)} onValueChange={(v) => updateSymptom(i, "severity", Number(v))}>
                        <SelectTrigger className="w-16" data-testid={`select-test-symptom-severity-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="clinical-decision-suppor-suspected-conditions-comma-separated-opt" className="text-xs">Suspected Conditions (comma-separated, optional)</Label>
                  <Input id="clinical-decision-suppor-suspected-conditions-comma-separated-opt"
                    placeholder="Hypothyroidism, Anemia, Diabetes"
                    value={suspectedConditions}
                    onChange={(e) => setSuspectedConditions(e.target.value)}
                    data-testid="input-suspected-conditions"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <FieldCaption className="font-medium">Existing Lab Results (optional)</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addLab} data-testid="button-add-lab">
                      <Plus className="h-4 w-4 mr-1" /> Add Lab
                    </Button>
                  </div>
                  {labs.map((lab, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Test name"
                        value={lab.testName}
                        onChange={(e) => updateLab(i, "testName", e.target.value)}
                        className="flex-1 min-w-[140px]"
                        data-testid={`input-lab-name-${i}`}
                      />
                      <Input
                        placeholder="Value"
                        value={lab.value}
                        onChange={(e) => updateLab(i, "value", e.target.value)}
                        className="w-20"
                        data-testid={`input-lab-value-${i}`}
                      />
                      <Input
                        placeholder="Unit"
                        value={lab.unit}
                        onChange={(e) => updateLab(i, "unit", e.target.value)}
                        className="w-20"
                        data-testid={`input-lab-unit-${i}`}
                      />
                      <Select value={lab.status} onValueChange={(v) => updateLab(i, "status", v)}>
                        <SelectTrigger className="w-24" data-testid={`select-lab-status-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="abnormal">Abnormal</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => removeLab(i)} data-testid={`button-remove-lab-${i}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button onClick={handleDiagnosticTestSubmit} disabled={diagnosticTestMutation.isPending} className="w-full" data-testid="button-analyze-tests">
                  {diagnosticTestMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing Relevant Tests...</>
                  ) : (
                    <><FlaskConical className="h-4 w-4 mr-2" /> Identify Relevant Tests</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {diagnosticTestMutation.data && (
              <div className="space-y-4" data-testid="section-test-results">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-lg" data-testid="text-test-results-title">Diagnostic Test Analysis</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {diagnosticTestMutation.data.uscdiDataClasses.map((dc) => (
                      <Badge key={dc} variant="secondary" className="text-xs">{dc}</Badge>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{diagnosticTestMutation.data.clinicalContext}</p>

                {diagnosticTestMutation.data.recommendations.map((test, i) => (
                  <Card key={i} data-testid={`card-test-${i}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {categoryIcon(test.category)}
                          <h4 className="font-medium">{test.testName}</h4>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={priorityColor(test.priority)}>{test.priority}</Badge>
                          <Badge variant="outline" className="text-xs">{test.category}</Badge>
                          {test.testCode && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {test.codeSystem}: {test.testCode}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{test.rationale}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Expected Findings</p>
                          <p className="text-sm">{test.expectedFindings}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Turnaround</p>
                          <p className="text-sm">{test.estimatedTurnaround}</p>
                        </div>
                      </div>
                      {test.relatedSymptoms.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Related to:</span>
                          {test.relatedSymptoms.map((sym, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{sym}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <p className="text-xs text-muted-foreground italic" data-testid="text-test-disclaimer">
                  {diagnosticTestMutation.data.disclaimer}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="lab-results" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                <TestTube className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300" data-testid="text-section-labs">Lab Results</h2>
                <p className="text-xs text-muted-foreground">FHIR R4 lab results and interpretation</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      Patient Lab Results
                    </CardTitle>
                    <CardDescription>
                      Recent lab results from Quest Diagnostics and LabCorp for clinical analysis
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href="/provider-lab-orders">
                      <Button variant="outline" size="sm" data-testid="button-order-new-labs">
                        <FlaskConical className="h-4 w-4 mr-1" />
                        Order Labs
                      </Button>
                    </Link>
                    <Link href="/lab-results">
                      <Button variant="outline" size="sm" data-testid="button-view-all-results">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Full Results
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {labResultsQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : labResultsQuery.isError ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Unable to load lab results</p>
                  </div>
                ) : labResultsQuery.data?.results?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No lab results available for this patient</p>
                    <Link href="/provider-lab-orders">
                      <Button variant="outline" size="sm" className="mt-3" data-testid="button-order-labs-empty">
                        Order Lab Tests
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold" data-testid="text-lab-total-count">
                          {labResultsQuery.data?.results?.length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Total Results</p>
                      </div>
                      <div className="border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-lab-normal-count">
                          {labResultsQuery.data?.results?.filter((r) => r.interpretation === "normal").length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Normal</p>
                      </div>
                      <div className="border rounded-md p-3 text-center">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-lab-abnormal-count">
                          {labResultsQuery.data?.results?.filter((r) => r.interpretation !== "normal").length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Needs Attention</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {labResultsQuery.data?.results?.map((result) => (
                        <div
                          key={result.id}
                          className={`border rounded-md p-3 flex items-center justify-between gap-3 flex-wrap ${
                            result.interpretation === "critical"
                              ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                              : result.interpretation === "abnormal"
                              ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                              : ""
                          }`}
                          data-testid={`cds-lab-result-${result.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {result.interpretation === "normal" ? (
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : result.interpretation === "critical" ? (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{result.testName}</span>
                                <Badge
                                  variant={
                                    result.interpretation === "critical"
                                      ? "destructive"
                                      : result.interpretation === "abnormal"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {result.interpretation}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  LOINC: {result.loincCode}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <span className="flex items-center gap-1" data-testid={`text-lab-provider-${result.id}`}>
                                  <Building2 className="h-3 w-3" />
                                  {result.providerName}
                                </span>
                                <span className="flex items-center gap-1" data-testid={`text-lab-date-${result.id}`}>
                                  <Calendar className="h-3 w-3" />
                                  {new Date(result.collectedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="text-lg font-bold" data-testid={`text-lab-value-${result.id}`}>{result.value}</span>
                              {result.unit && <span className="text-xs text-muted-foreground" data-testid={`text-lab-unit-${result.id}`}>{result.unit}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground" data-testid={`text-lab-ref-${result.id}`}>Ref: {result.referenceRange}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-start gap-2 border-t pt-3">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground" data-testid="text-lab-cds-disclaimer">
                        {labResultsQuery.data?.noCdsDisclaimer ||
                          "Lab results are informational only. Not clinical decision support."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-orange-700 dark:text-orange-300" data-testid="text-section-risk">Risk Stratification</h2>
                <p className="text-xs text-muted-foreground">Multi-condition risk assessment</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Patient Risk Stratification
                </CardTitle>
                <CardDescription>
                  AI-powered predictive analysis of patient risk factors based on demographics, vitals, labs, and history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-age-2" className="text-sm">Age</Label>
                    <Input id="clinical-decision-suppor-age-2"
                      type="number"
                      value={demographics.age}
                      onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                      placeholder="Patient age"
                      data-testid="input-risk-age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-sex-2" className="text-sm">Sex</Label>
                    <Select
                      value={demographics.sex}
                      onValueChange={(val) => setDemographics({ ...demographics, sex: val })}
                    >
                      <SelectTrigger id="clinical-decision-suppor-sex-2" data-testid="select-risk-sex">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-family-history-comma-separated" className="text-sm">Family History (comma-separated)</Label>
                    <Textarea id="clinical-decision-suppor-family-history-comma-separated"
                      value={familyHistory}
                      onChange={(e) => setFamilyHistory(e.target.value)}
                      placeholder="e.g., Heart disease, Diabetes, Breast cancer"
                      className="resize-none text-sm"
                      rows={2}
                      data-testid="input-risk-family-history"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-social-factors-comma-separated" className="text-sm">Social Factors (comma-separated)</Label>
                    <Textarea id="clinical-decision-suppor-social-factors-comma-separated"
                      value={socialFactors}
                      onChange={(e) => setSocialFactors(e.target.value)}
                      placeholder="e.g., Smoking, Sedentary lifestyle, High stress"
                      className="resize-none text-sm"
                      rows={2}
                      data-testid="input-risk-social-factors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinical-decision-suppor-existing-conditions-comma-separated-2" className="text-sm">Existing Conditions (comma-separated)</Label>
                  <Input id="clinical-decision-suppor-existing-conditions-comma-separated-2"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="e.g., Hypertension, Prediabetes"
                    data-testid="input-risk-conditions"
                  />
                </div>

                <Button
                  onClick={() => {
                    const data: any = { patientId };
                    if (demographics.age || demographics.sex) {
                      data.demographics = {
                        ...(demographics.age ? { age: parseInt(demographics.age) } : {}),
                        ...(demographics.sex ? { sex: demographics.sex } : {}),
                      };
                    }
                    if (vitals.bloodPressure || vitals.heartRate) {
                      data.vitals = {
                        ...(vitals.bloodPressure ? { bloodPressure: vitals.bloodPressure } : {}),
                        ...(vitals.heartRate ? { heartRate: parseInt(vitals.heartRate) } : {}),
                      };
                    }
                    if (conditions) data.conditions = conditions.split(",").map(c => c.trim()).filter(Boolean);
                    if (familyHistory) data.familyHistory = familyHistory.split(",").map(f => f.trim()).filter(Boolean);
                    if (socialFactors) data.socialFactors = socialFactors.split(",").map(s => s.trim()).filter(Boolean);
                    riskStratificationMutation.mutate(data);
                  }}
                  disabled={riskStratificationMutation.isPending}
                  data-testid="button-analyze-risk"
                >
                  {riskStratificationMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing Risk Patterns...</>
                  ) : (
                    <><BarChart3 className="h-4 w-4 mr-2" />Analyze Risk Patterns</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {riskStratificationMutation.data && (
              <div className="space-y-4" data-testid="risk-results">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Overall Risk Assessment
                      </CardTitle>
                      <Badge
                        className={probabilityColor(riskStratificationMutation.data.overallRiskTier)}
                        data-testid="badge-overall-risk"
                      >
                        {riskStratificationMutation.data.overallRiskTier.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <CardDescription>
                      Data completeness: {riskStratificationMutation.data.dataCompleteness}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress
                      value={riskStratificationMutation.data.dataCompleteness}
                      className="h-2"
                      data-testid="progress-data-completeness"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Analysis based on {riskStratificationMutation.data.uscdiDataClasses.join(", ")} data classes
                    </p>
                  </CardContent>
                </Card>

                {riskStratificationMutation.data.conditionRisks.map((risk, idx) => (
                  <Card key={idx} data-testid={`card-condition-risk-${idx}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {risk.condition}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={probabilityColor(risk.riskLevel)}
                            data-testid={`badge-risk-level-${idx}`}
                          >
                            {risk.riskLevel}
                          </Badge>
                          <span className="text-sm font-bold" data-testid={`text-risk-score-${idx}`}>
                            {risk.riskScore}/100
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Risk Drivers</p>
                        <div className="space-y-1">
                          {risk.drivers.map((driver, dIdx) => (
                            <div key={dIdx} className="flex items-center gap-2 text-sm" data-testid={`text-risk-driver-${idx}-${dIdx}`}>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {driver.impact}
                              </Badge>
                              <span className="flex-1">{driver.factor}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{driver.source}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {risk.dataGaps.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Data Gaps</p>
                          <div className="flex gap-1 flex-wrap">
                            {risk.dataGaps.map((gap, gIdx) => (
                              <Badge key={gIdx} variant="outline" className="text-xs">
                                {gap}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground italic" data-testid={`text-risk-notes-${idx}`}>
                        {risk.observationalNotes}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex items-start gap-2 border-t pt-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground" data-testid="text-risk-disclaimer">
                    {riskStratificationMutation.data.disclaimer}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preventive" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                <Bell className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-green-700 dark:text-green-300" data-testid="text-section-preventive">Preventive Care</h2>
                <p className="text-xs text-muted-foreground">Screening and vaccination alerts</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preventive Care Alerts
                </CardTitle>
                <CardDescription>
                  Screening and vaccination alerts based on patient demographics, history, and USPSTF/CDC guidelines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-age-3" className="text-sm">Age</Label>
                    <Input id="clinical-decision-suppor-age-3"
                      type="number"
                      value={demographics.age}
                      onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                      placeholder="Patient age"
                      data-testid="input-preventive-age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-decision-suppor-sex-3" className="text-sm">Sex</Label>
                    <Select
                      value={demographics.sex}
                      onValueChange={(val) => setDemographics({ ...demographics, sex: val })}
                    >
                      <SelectTrigger id="clinical-decision-suppor-sex-3" data-testid="select-preventive-sex">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    const data: any = { patientId };
                    if (demographics.age || demographics.sex) {
                      data.demographics = {
                        ...(demographics.age ? { age: parseInt(demographics.age) } : {}),
                        ...(demographics.sex ? { sex: demographics.sex } : {}),
                      };
                    }
                    if (conditions) data.conditions = conditions.split(",").map(c => c.trim()).filter(Boolean);
                    preventiveAlertsMutation.mutate(data);
                  }}
                  disabled={preventiveAlertsMutation.isPending}
                  data-testid="button-check-preventive"
                >
                  {preventiveAlertsMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking Preventive Care...</>
                  ) : (
                    <><Bell className="h-4 w-4 mr-2" />Check Preventive Care Status</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {preventiveAlertsMutation.data && (
              <div className="space-y-4" data-testid="preventive-results">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-overdue-count">
                        {preventiveAlertsMutation.data.overdueCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Overdue
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-due-soon-count">
                        {preventiveAlertsMutation.data.dueSoonCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due Soon
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-up-to-date-count">
                        {preventiveAlertsMutation.data.upToDateCount}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Up to Date
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {preventiveAlertsMutation.data.screeningAlerts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Screening Alerts
                      </CardTitle>
                      <CardDescription>
                        Based on USPSTF guidelines and patient demographics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {preventiveAlertsMutation.data.screeningAlerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className={`border rounded-md p-3 ${
                              alert.status === "overdue"
                                ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                                : alert.status === "due_soon"
                                ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                                : ""
                            }`}
                            data-testid={`screening-alert-${idx}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                {alert.status === "overdue" ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                ) : alert.status === "due_soon" ? (
                                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                )}
                                <span className="font-medium text-sm" data-testid={`text-screening-name-${idx}`}>
                                  {alert.screeningName}
                                </span>
                                <Badge
                                  variant={alert.status === "overdue" ? "destructive" : alert.status === "due_soon" ? "secondary" : "outline"}
                                  className="text-xs"
                                  data-testid={`badge-screening-status-${idx}`}
                                >
                                  {alert.status === "overdue" ? "Overdue" : alert.status === "due_soon" ? "Due Soon" : "Up to Date"}
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {alert.category}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              <p data-testid={`text-screening-rationale-${idx}`}>{alert.rationale}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last: {alert.lastPerformed ? new Date(alert.lastPerformed).toLocaleDateString() : "No record"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Due: {alert.dueDate}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Ages {alert.ageRange} | {alert.applicableSex === "all" ? "All" : alert.applicableSex}
                                </span>
                              </div>
                              <p className="text-xs opacity-70">{alert.guidelineSource}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {preventiveAlertsMutation.data.vaccinationAlerts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Syringe className="h-4 w-4" />
                        Vaccination Alerts
                      </CardTitle>
                      <CardDescription>
                        Based on CDC/ACIP immunization schedules
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {preventiveAlertsMutation.data.vaccinationAlerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className={`border rounded-md p-3 ${
                              alert.status === "overdue"
                                ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                                : alert.status === "due_soon"
                                ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                                : ""
                            }`}
                            data-testid={`vaccination-alert-${idx}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                {alert.status === "overdue" ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                ) : alert.status === "due_soon" ? (
                                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                )}
                                <span className="font-medium text-sm" data-testid={`text-vaccine-name-${idx}`}>
                                  {alert.vaccineName}
                                </span>
                                <Badge
                                  variant={alert.status === "overdue" ? "destructive" : alert.status === "due_soon" ? "secondary" : "outline"}
                                  className="text-xs"
                                  data-testid={`badge-vaccine-status-${idx}`}
                                >
                                  {alert.status === "overdue" ? "Overdue" : alert.status === "due_soon" ? "Due Soon" : alert.status === "up_to_date" ? "Up to Date" : "N/A"}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-vaccine-doses-${idx}`}>
                                {alert.dosesCompleted}/{alert.dosesRequired} doses
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              <p data-testid={`text-vaccine-rationale-${idx}`}>{alert.rationale}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last: {alert.lastDoseDate ? new Date(alert.lastDoseDate).toLocaleDateString() : "No record"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Due: {alert.dueDate}
                                </span>
                              </div>
                              <p className="text-xs opacity-70">{alert.guidelineSource}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-start gap-2 border-t pt-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground" data-testid="text-preventive-disclaimer">
                    {preventiveAlertsMutation.data.disclaimer}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
