import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Brain,
  Shield,
  Pill,
  Heart,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Target,
  Zap,
  AlertCircle,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DashboardData {
  totalAnalysesGenerated: number;
  riskProfilesInCache: number;
  safetyAnalysesInCache: number;
  carePlansInCache: number;
  supportedRiskCategories: string[];
  supportedInteractionTypes: string[];
  modelVersion: string;
  noCdsDisclaimer: string;
}

interface RiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
  dataSource: string;
}

interface ConditionRiskPrediction {
  id: string;
  conditionCategory: string;
  conditionName: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  riskPercentile: number;
  timeframe: string;
  contributingFactors: RiskFactor[];
  protectiveFactors: RiskFactor[];
  trendsObserved: string[];
  historicalComparison: string;
  aiConfidence: number;
  modelVersion: string;
  generatedAt: string;
}

interface PatientRiskProfile {
  id: string;
  patientId: string;
  patientName: string;
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  overallRiskScore: number;
  predictions: ConditionRiskPrediction[];
  prioritizedConcerns: string[];
  dataCompleteness: number;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

interface DrugInteraction {
  id: string;
  medication1: { name: string; dosage: string };
  medication2: { name: string; dosage?: string };
  type: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  mechanism: string;
  clinicalEffects: string[];
  managementConsiderations: string;
  monitoringParameters: string[];
  aiConfidence: number;
  evidenceLevel: string;
}

interface MedicationSafetyAnalysis {
  id: string;
  patientId: string;
  patientName: string;
  analyzedAt: string;
  medicationsAnalyzed: number;
  overallSafetyLevel: "safe" | "concerns_identified" | "review_urgently";
  safetyScore: number;
  interactions: DrugInteraction[];
  therapeuticDuplications: Array<{
    drugClass: string;
    medications: string[];
    concern: string;
  }>;
  allergyConflicts: Array<{
    medication: string;
    allergen: string;
    reactionType: string;
    severity: string;
  }>;
  summary: string;
  prioritizedFindings: string[];
  aiConfidence: number;
  noCdsDisclaimer: string;
}

interface CareRecommendation {
  id: string;
  category: string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  rationale: string;
  relevantConditions: string[];
  evidenceBasis: string;
  timeframe: string;
  patientEducationPoints: string[];
}

interface PersonalizedCarePlan {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  executiveSummary: string;
  healthStatusOverview: string;
  recommendations: CareRecommendation[];
  screeningSchedule: Array<{
    screening: string;
    dueDate: string;
    frequency: string;
    rationale: string;
  }>;
  wellnessGoals: Array<{
    goal: string;
    currentStatus: string;
    targetMetric?: string;
    timeline: string;
  }>;
  educationalResources: Array<{
    topic: string;
    description: string;
    relevance: string;
  }>;
  careTeamNotes: string;
  patientSummary: string;
  aiConfidence: number;
  noCdsDisclaimer: string;
}

const SAMPLE_PATIENT_DATA = {
  patientId: "patient-001",
  patientName: "John Smith",
  demographics: {
    age: 62,
    gender: "Male",
    ethnicity: "Caucasian",
  },
  conditions: [
    { name: "Type 2 Diabetes Mellitus", code: "E11.9", status: "active", severity: "moderate" },
    { name: "Essential Hypertension", code: "I10", status: "active", severity: "controlled" },
    { name: "Hyperlipidemia", code: "E78.5", status: "active" },
    { name: "Obesity", code: "E66.9", status: "active" },
  ],
  medications: [
    { name: "Metformin", dosage: "1000mg", frequency: "twice daily", status: "active" },
    { name: "Lisinopril", dosage: "20mg", frequency: "once daily", status: "active" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "once daily at bedtime", status: "active" },
    { name: "Aspirin", dosage: "81mg", frequency: "once daily", status: "active" },
    { name: "Metoprolol", dosage: "50mg", frequency: "twice daily", status: "active" },
  ],
  allergies: [
    { substance: "Penicillin", reaction: "Rash", severity: "moderate" },
    { substance: "Sulfa drugs", reaction: "Hives", severity: "moderate" },
  ],
  vitals: [
    { type: "Blood Pressure Systolic", value: 138, unit: "mmHg", date: "2026-01-20" },
    { type: "Blood Pressure Diastolic", value: 88, unit: "mmHg", date: "2026-01-20" },
    { type: "Heart Rate", value: 72, unit: "bpm", date: "2026-01-20" },
    { type: "Weight", value: 98, unit: "kg", date: "2026-01-20" },
    { type: "BMI", value: 31.2, unit: "kg/m2", date: "2026-01-20" },
  ],
  labResults: [
    { name: "HbA1c", value: 7.8, unit: "%", date: "2026-01-15", abnormal: true },
    { name: "Fasting Glucose", value: 142, unit: "mg/dL", date: "2026-01-15", abnormal: true },
    { name: "Total Cholesterol", value: 198, unit: "mg/dL", date: "2026-01-15" },
    { name: "LDL Cholesterol", value: 118, unit: "mg/dL", date: "2026-01-15", abnormal: true },
    { name: "HDL Cholesterol", value: 42, unit: "mg/dL", date: "2026-01-15", abnormal: true },
    { name: "Triglycerides", value: 185, unit: "mg/dL", date: "2026-01-15", abnormal: true },
    { name: "Creatinine", value: 1.2, unit: "mg/dL", date: "2026-01-15" },
    { name: "eGFR", value: 68, unit: "mL/min/1.73m2", date: "2026-01-15" },
  ],
  familyHistory: [
    { condition: "Type 2 Diabetes", relationship: "Father" },
    { condition: "Heart Disease", relationship: "Father" },
    { condition: "Stroke", relationship: "Mother" },
  ],
  socialHistory: {
    smokingStatus: "Former smoker (quit 5 years ago)",
    alcoholUse: "Occasional (1-2 drinks/week)",
    exerciseFrequency: "Sedentary (less than 1x/week)",
    diet: "Western diet, high in processed foods",
  },
  encounters: [
    { type: "Office Visit", date: "2026-01-20", reason: "Diabetes follow-up", provider: "Dr. Wilson" },
    { type: "Lab Work", date: "2026-01-15", reason: "Routine labs" },
    { type: "Office Visit", date: "2025-10-15", reason: "Annual physical", provider: "Dr. Wilson" },
  ],
};

function getRiskLevelColor(level: string): string {
  switch (level) {
    case "critical":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "high":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "moderate":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "low":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "contraindicated":
      return "bg-red-600/15 text-red-700 dark:text-red-400";
    case "major":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "moderate":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "minor":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getSafetyLevelColor(level: string): string {
  switch (level) {
    case "safe":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "concerns_identified":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "review_urgently":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "high":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "medium":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "low":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "preventive":
      return <Shield className="h-4 w-4" />;
    case "monitoring":
      return <Activity className="h-4 w-4" />;
    case "lifestyle":
      return <Heart className="h-4 w-4" />;
    case "follow_up":
      return <Users className="h-4 w-4" />;
    case "screening":
      return <Search className="h-4 w-4" />;
    case "education":
      return <FileText className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export default function AIPatientIntelligence() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [riskProfile, setRiskProfile] = useState<PatientRiskProfile | null>(null);
  const [medicationSafety, setMedicationSafety] = useState<MedicationSafetyAnalysis | null>(null);
  const [carePlan, setCarePlan] = useState<PersonalizedCarePlan | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<ConditionRiskPrediction | null>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/ai-patient-intelligence/dashboard"],
  });

  const generateRiskProfileMutation = useMutation({
    mutationFn: async (): Promise<PatientRiskProfile> => {
      const response = await apiRequest("POST", "/api/ai-patient-intelligence/risk-profile", {
        patientData: SAMPLE_PATIENT_DATA,
        categories: ["diabetes_complications", "cardiovascular", "renal", "falls", "readmission"],
      });
      if (response.status === 403) {
        throw new Error("ACCESS_DENIED");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setRiskProfile(data);
      toast({ title: "Risk Profile Generated", description: "Patient risk analysis is complete." });
    },
    onError: (error: Error) => {
      if (error.message === "ACCESS_DENIED") {
        toast({ title: "Access Denied", description: "You need administrator, clinician, care coordinator, or nurse role to access this feature.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to generate risk profile.", variant: "destructive" });
      }
    },
  });

  const analyzeMedicationSafetyMutation = useMutation({
    mutationFn: async (): Promise<MedicationSafetyAnalysis> => {
      const response = await apiRequest("POST", "/api/ai-patient-intelligence/medication-safety", {
        patientData: SAMPLE_PATIENT_DATA,
      });
      if (response.status === 403) {
        throw new Error("ACCESS_DENIED");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMedicationSafety(data);
      toast({ title: "Medication Safety Analysis Complete", description: "Drug interaction check is complete." });
    },
    onError: (error: Error) => {
      if (error.message === "ACCESS_DENIED") {
        toast({ title: "Access Denied", description: "You need administrator, clinician, care coordinator, or nurse role to access this feature.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to analyze medication safety.", variant: "destructive" });
      }
    },
  });

  const generateCarePlanMutation = useMutation({
    mutationFn: async (): Promise<PersonalizedCarePlan> => {
      const response = await apiRequest("POST", "/api/ai-patient-intelligence/care-plan", {
        patientData: SAMPLE_PATIENT_DATA,
      });
      if (response.status === 403) {
        throw new Error("ACCESS_DENIED");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCarePlan(data);
      toast({ title: "Care Plan Generated", description: "Personalized care recommendations are ready." });
    },
    onError: (error: Error) => {
      if (error.message === "ACCESS_DENIED") {
        toast({ title: "Access Denied", description: "You need administrator, clinician, care coordinator, or nurse role to access this feature.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to generate care plan.", variant: "destructive" });
      }
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async (): Promise<{ riskProfile: PatientRiskProfile; medicationSafety: MedicationSafetyAnalysis; carePlan: PersonalizedCarePlan }> => {
      const response = await apiRequest("POST", "/api/ai-patient-intelligence/comprehensive", {
        patientData: SAMPLE_PATIENT_DATA,
      });
      if (response.status === 403) {
        throw new Error("ACCESS_DENIED");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setRiskProfile(data.riskProfile);
      setMedicationSafety(data.medicationSafety);
      setCarePlan(data.carePlan);
      toast({ title: "Comprehensive Analysis Complete", description: "All patient intelligence analyses are ready." });
    },
    onError: (error: Error) => {
      if (error.message === "ACCESS_DENIED") {
        toast({ title: "Access Denied", description: "You need administrator, clinician, care coordinator, or nurse role to access this feature.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to generate comprehensive analysis.", variant: "destructive" });
      }
    },
  });

  const isLoading = generateRiskProfileMutation.isPending || 
    analyzeMedicationSafetyMutation.isPending || 
    generateCarePlanMutation.isPending ||
    generateAllMutation.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-8 w-8 text-primary" />
            AI Patient Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered patient risk prediction, drug interaction detection, and personalized care recommendations
          </p>
        </div>
        <Button
          onClick={() => generateAllMutation.mutate()}
          disabled={isLoading}
          data-testid="button-generate-all"
        >
          {generateAllMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Comprehensive Analysis
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Not Clinical Decision Support</AlertTitle>
        <AlertDescription>
          This AI-generated analysis is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice or clinical decision support. All healthcare decisions must be made by qualified healthcare providers.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            Risk Prediction
            {riskProfile && (
              <Badge className={`ml-2 ${getRiskLevelColor(riskProfile.overallRiskLevel)}`}>
                {riskProfile.overallRiskLevel}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            Drug Safety
            {medicationSafety && medicationSafety.interactions.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {medicationSafety.interactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="care-plan" data-testid="tab-care-plan">Care Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Sample Patient</CardDescription>
                <CardTitle className="text-xl" data-testid="text-patient-name">
                  {SAMPLE_PATIENT_DATA.patientName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {SAMPLE_PATIENT_DATA.demographics.age}yo {SAMPLE_PATIENT_DATA.demographics.gender}
                </p>
                <p className="text-sm text-muted-foreground">
                  {SAMPLE_PATIENT_DATA.conditions.length} conditions, {SAMPLE_PATIENT_DATA.medications.length} medications
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Analyses Generated</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-analyses-count">
                  {dashboard?.totalAnalysesGenerated || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Risk Categories</CardDescription>
                <CardTitle className="text-3xl">
                  {dashboard?.supportedRiskCategories?.length || 8}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Model Version</CardDescription>
                <CardTitle className="text-lg">
                  {dashboard?.modelVersion || "gpt-5.1"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover-elevate cursor-pointer" onClick={() => {
              generateRiskProfileMutation.mutate();
              setActiveTab("risk");
            }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Risk Prediction
                </CardTitle>
                <CardDescription>
                  Predict patient risk for conditions like diabetes complications, cardiovascular events, and hospital readmission
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled={generateRiskProfileMutation.isPending} data-testid="button-generate-risk">
                  {generateRiskProfileMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Generate Risk Profile
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => {
              analyzeMedicationSafetyMutation.mutate();
              setActiveTab("medications");
            }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-blue-500" />
                  Drug Interaction Check
                </CardTitle>
                <CardDescription>
                  Identify potential drug-drug interactions, allergy conflicts, and therapeutic duplications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled={analyzeMedicationSafetyMutation.isPending} data-testid="button-analyze-meds">
                  {analyzeMedicationSafetyMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  Analyze Medication Safety
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => {
              generateCarePlanMutation.mutate();
              setActiveTab("care-plan");
            }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Personalized Care Plan
                </CardTitle>
                <CardDescription>
                  Generate personalized health recommendations, screening schedules, and wellness goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled={generateCarePlanMutation.isPending} data-testid="button-generate-care-plan">
                  {generateCarePlanMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate Care Plan
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sample Patient Data</CardTitle>
              <CardDescription>Sample patient data used for showcasing AI capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Active Conditions</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {SAMPLE_PATIENT_DATA.conditions.map((c, i) => (
                      <li key={i}>• {c.name}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Current Medications</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {SAMPLE_PATIENT_DATA.medications.map((m, i) => (
                      <li key={i}>• {m.name} {m.dosage}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Known Allergies</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {SAMPLE_PATIENT_DATA.allergies.map((a, i) => (
                      <li key={i}>• {a.substance} ({a.reaction})</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Recent Labs (Abnormal)</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {SAMPLE_PATIENT_DATA.labResults.filter(l => l.abnormal).map((l, i) => (
                      <li key={i}>• {l.name}: {l.value} {l.unit}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          {!riskProfile ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Risk Profile Generated</h3>
                <p className="text-muted-foreground mb-4">Generate a risk profile to see condition risk predictions</p>
                <Button onClick={() => generateRiskProfileMutation.mutate()} disabled={generateRiskProfileMutation.isPending}>
                  {generateRiskProfileMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Generate Risk Profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Overall Risk Level</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getRiskLevelColor(riskProfile.overallRiskLevel)} data-testid="badge-overall-risk">
                        {riskProfile.overallRiskLevel.toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Risk Score</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-risk-score">
                      {(riskProfile.overallRiskScore * 100).toFixed(0)}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Conditions Analyzed</CardDescription>
                    <CardTitle className="text-3xl">
                      {riskProfile.predictions.length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Data Completeness</CardDescription>
                    <CardTitle className="text-3xl">
                      {(riskProfile.dataCompleteness * 100).toFixed(0)}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {riskProfile.prioritizedConcerns.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Priority Concerns Identified</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1">
                      {riskProfile.prioritizedConcerns.map((concern, i) => (
                        <li key={i}>• {concern}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Condition Risk Predictions</CardTitle>
                  <CardDescription>AI-generated risk assessment for each condition category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {riskProfile.predictions.map((prediction) => (
                      <Card 
                        key={prediction.id} 
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedPrediction(prediction)}
                        data-testid={`card-prediction-${prediction.conditionCategory}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{prediction.conditionName}</CardTitle>
                            <Badge className={getRiskLevelColor(prediction.riskLevel)}>
                              {prediction.riskLevel}
                            </Badge>
                          </div>
                          <CardDescription>Timeframe: {prediction.timeframe}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Risk Score</span>
                                <span>{(prediction.riskScore * 100).toFixed(0)}%</span>
                              </div>
                              <Progress value={prediction.riskScore * 100} className="h-2" />
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>Percentile: {prediction.riskPercentile}th</span>
                              <span>Confidence: {(prediction.aiConfidence * 100).toFixed(0)}%</span>
                            </div>
                            {prediction.contributingFactors.length > 0 && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Top factor: </span>
                                <span>{prediction.contributingFactors[0].factor}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedPrediction && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          {selectedPrediction.conditionName}
                        </CardTitle>
                        <CardDescription>Detailed risk analysis</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPrediction(null)}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          Contributing Factors
                        </h4>
                        <ul className="text-sm space-y-2">
                          {selectedPrediction.contributingFactors.map((f, i) => (
                            <li key={i} className="p-2 bg-muted rounded-lg">
                              <div className="font-medium">{f.factor}</div>
                              <div className="text-muted-foreground">{f.description}</div>
                              <div className="text-xs text-muted-foreground mt-1">Source: {f.dataSource}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          Protective Factors
                        </h4>
                        <ul className="text-sm space-y-2">
                          {selectedPrediction.protectiveFactors.length > 0 ? (
                            selectedPrediction.protectiveFactors.map((f, i) => (
                              <li key={i} className="p-2 bg-muted rounded-lg">
                                <div className="font-medium">{f.factor}</div>
                                <div className="text-muted-foreground">{f.description}</div>
                              </li>
                            ))
                          ) : (
                            <li className="text-muted-foreground">No significant protective factors identified</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    {selectedPrediction.trendsObserved.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Observed Trends</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {selectedPrediction.trendsObserved.map((t, i) => (
                            <li key={i}>• {t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium mb-2">Historical Comparison</h4>
                      <p className="text-sm text-muted-foreground">{selectedPrediction.historicalComparison}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="medications" className="space-y-6">
          {!medicationSafety ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Pill className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Medication Safety Analysis</h3>
                <p className="text-muted-foreground mb-4">Analyze medications to check for drug interactions</p>
                <Button onClick={() => analyzeMedicationSafetyMutation.mutate()} disabled={analyzeMedicationSafetyMutation.isPending}>
                  {analyzeMedicationSafetyMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  Analyze Medication Safety
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Safety Level</CardDescription>
                    <CardTitle>
                      <Badge className={getSafetyLevelColor(medicationSafety.overallSafetyLevel)} data-testid="badge-safety-level">
                        {medicationSafety.overallSafetyLevel.replace("_", " ").toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Medications Analyzed</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-meds-analyzed">
                      {medicationSafety.medicationsAnalyzed}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Interactions Found</CardDescription>
                    <CardTitle className="text-3xl text-orange-600">
                      {medicationSafety.interactions.length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Allergy Conflicts</CardDescription>
                    <CardTitle className="text-3xl text-red-600">
                      {medicationSafety.allergyConflicts.length}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Safety Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{medicationSafety.summary}</p>
                  {medicationSafety.prioritizedFindings.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Priority Findings</h4>
                      <ul className="space-y-1">
                        {medicationSafety.prioritizedFindings.map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {medicationSafety.interactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Drug Interactions Detected
                    </CardTitle>
                    <CardDescription>
                      Potential interactions between current medications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {medicationSafety.interactions.map((interaction) => (
                        <div key={interaction.id} className="border rounded-lg p-4" data-testid={`interaction-${interaction.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              <span className="font-medium">{interaction.medication1.name}</span>
                              <ChevronRight className="h-4 w-4" />
                              <span className="font-medium">{interaction.medication2.name}</span>
                            </div>
                            <Badge className={getSeverityColor(interaction.severity)}>
                              {interaction.severity}
                            </Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Mechanism</p>
                              <p>{interaction.mechanism}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Clinical Effects</p>
                              <p>{interaction.clinicalEffects.join(", ")}</p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-muted-foreground">Considerations</p>
                              <p>{interaction.managementConsiderations}</p>
                            </div>
                            {interaction.monitoringParameters.length > 0 && (
                              <div className="md:col-span-2">
                                <p className="text-muted-foreground">Monitoring Parameters</p>
                                <p>{interaction.monitoringParameters.join(", ")}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>Evidence: {interaction.evidenceLevel}</span>
                            <span>Confidence: {(interaction.aiConfidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {medicationSafety.therapeuticDuplications.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Therapeutic Duplications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {medicationSafety.therapeuticDuplications.map((dup, i) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="font-medium">{dup.drugClass}</div>
                          <div className="text-sm text-muted-foreground">
                            Medications: {dup.medications.join(", ")}
                          </div>
                          <div className="text-sm mt-1">{dup.concern}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {medicationSafety.allergyConflicts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Allergy Conflicts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {medicationSafety.allergyConflicts.map((conflict, i) => (
                        <Alert key={i} variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{conflict.medication}</AlertTitle>
                          <AlertDescription>
                            Known allergy to {conflict.allergen} - {conflict.reactionType} ({conflict.severity})
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="care-plan" className="space-y-6">
          {!carePlan ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Care Plan Generated</h3>
                <p className="text-muted-foreground mb-4">Generate a personalized care plan with recommendations</p>
                <Button onClick={() => generateCarePlanMutation.mutate()} disabled={generateCarePlanMutation.isPending}>
                  {generateCarePlanMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate Care Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">{carePlan.executiveSummary}</p>
                  <Separator className="my-4" />
                  <p className="text-muted-foreground">{carePlan.healthStatusOverview}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Care Recommendations</CardTitle>
                  <CardDescription>Personalized recommendations based on patient data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {carePlan.recommendations.map((rec) => (
                      <Card key={rec.id} data-testid={`recommendation-${rec.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              {getCategoryIcon(rec.category)}
                              {rec.title}
                            </CardTitle>
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <CardDescription>{rec.category}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <p>{rec.description}</p>
                          <p className="text-muted-foreground"><strong>Rationale:</strong> {rec.rationale}</p>
                          <p className="text-muted-foreground"><strong>Evidence:</strong> {rec.evidenceBasis}</p>
                          <p className="text-muted-foreground"><strong>Timeframe:</strong> {rec.timeframe}</p>
                          {rec.patientEducationPoints.length > 0 && (
                            <div>
                              <p className="text-muted-foreground font-medium">Patient Education:</p>
                              <ul className="list-disc list-inside text-muted-foreground">
                                {rec.patientEducationPoints.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {carePlan.screeningSchedule.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Screening Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {carePlan.screeningSchedule.map((s, i) => (
                        <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <div className="font-medium">{s.screening}</div>
                            <div className="text-sm text-muted-foreground">{s.rationale}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">{s.dueDate}</div>
                            <div className="text-xs text-muted-foreground">{s.frequency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {carePlan.wellnessGoals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Wellness Goals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {carePlan.wellnessGoals.map((g, i) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="font-medium">{g.goal}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>Current: {g.currentStatus}</span>
                            {g.targetMetric && <span> | Target: {g.targetMetric}</span>}
                            <span> | Timeline: {g.timeline}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Patient Summary</CardTitle>
                  <CardDescription>Plain-language summary for patient understanding</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{carePlan.patientSummary}</p>
                </CardContent>
              </Card>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Care Team Notes</AlertTitle>
                <AlertDescription>{carePlan.careTeamNotes}</AlertDescription>
              </Alert>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
