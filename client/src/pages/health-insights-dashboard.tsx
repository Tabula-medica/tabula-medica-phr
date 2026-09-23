import { useState, useEffect } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  Activity,
  Heart,
  Pill,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Zap,
  Thermometer,
  Scale,
  Droplets,
  FileText,
  Calendar,
  RefreshCw,
  Loader2,
  Lightbulb,
  ShieldAlert,
  Award,
  ChevronRight,
  Users,
  Target,
  BarChart3,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

const PATIENT_ID = "patient-1";

interface HealthSummary {
  overallHealthScore: number;
  activeConditions: number;
  activeMedications: number;
  allergiesCount: number;
  recentLabsCount: number;
  pendingActions: number;
  trends: {
    conditions: string;
    medications: string;
    labs: string;
  };
}

interface LabResult {
  id: string;
  testName: string;
  testCode: string;
  value: number;
  unit: string;
  referenceRange: { low: number; high: number };
  status: string;
  collectedAt: string;
  category: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

interface Condition {
  id: string;
  name: string;
  code: string;
  status: string;
  severity: string;
  onsetDate: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

interface Allergy {
  id: string;
  allergen: string;
  type: string;
  severity: string;
  reaction: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: string;
  startDate: string;
  prescribedFor?: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

interface VitalSign {
  id: string;
  type: string;
  value: number;
  secondaryValue?: number;
  unit: string;
  recordedAt: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

interface HealthInsight {
  id: string;
  type: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  dataPoints?: { date: string; value: number }[];
  actionRequired: boolean;
  createdAt: string;
}

interface LabReference {
  code: string;
  name: string;
  ranges: {
    adult: { min: number; max: number; unit: string; optimalMin?: number; optimalMax?: number };
  };
  populationStats: {
    mean: number;
    median: number;
    standardDeviation: number;
    percentile25: number;
    percentile75: number;
    percentile5: number;
    percentile95: number;
  };
  description: string;
}

interface VitalReference {
  type: string;
  name: string;
  ranges: {
    normal: { min: number; max: number; unit: string };
    optimal?: { min: number; max: number; unit: string };
  };
  populationStats: {
    mean: number;
    median: number;
    standardDeviation: number;
    percentile25: number;
    percentile75: number;
  };
}

interface ConditionPrevalence {
  condition: string;
  icd10Code: string;
  prevalencePercent: number;
  ageGroupPrevalence: Record<string, number>;
  riskFactors: string[];
  commonComorbidities: string[];
}

interface AllergyPrevalence {
  allergen: string;
  category: string;
  prevalencePercent: number;
  severityDistribution: { mild: number; moderate: number; severe: number };
  crossReactivities: string[];
}

const VITALS_COLORS = {
  blood_pressure: "#ef4444",
  heart_rate: "#f97316",
  weight: "#3b82f6",
  blood_glucose: "#8b5cf6",
  temperature: "#10b981",
  oxygen_saturation: "#06b6d4",
};

function getSourceColor(source?: string): string {
  return source === "patient" ? "text-blue-600 dark:text-blue-400" : "";
}

function SourceIndicator({ source }: { source?: string }) {
  if (!source) return null;
  const labels: Record<string, string> = {
    patient: "Patient-reported",
    ehr: "EHR Record",
    lab: "Lab System",
    wearable: "Wearable Device",
  };
  const isPatient = source === "patient";
  return (
    <Badge
      variant="outline"
      className={`text-xs ${isPatient ? "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700" : "text-muted-foreground"}`}
      data-testid={`source-badge-${source}`}
    >
      {isPatient && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />}
      {labels[source] || source}
    </Badge>
  );
}

function DataSourceLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap" data-testid="data-source-legend">
      <span className="font-medium">Data Sources:</span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-blue-600 dark:text-blue-400">Patient-reported</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-foreground/40" />
        Imported (EHR/Lab/Wearable)
      </span>
    </div>
  );
}

export default function HealthInsightsDashboard() {
  const { toast } = useToast();
  const [selectedLabCategory, setSelectedLabCategory] = useState("all");
  const [selectedVitalType, setSelectedVitalType] = useState("blood_pressure");
  const [predictiveTimeframe, setPredictiveTimeframe] = useState("6_months");
  const [predictiveData, setPredictiveData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/health-insights/initialize/${PATIENT_ID}`, { method: "POST" });
  }, []);

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: [`/api/health-insights/summary/${PATIENT_ID}`],
  });

  const { data: labsData, isError: labsError } = useQuery({
    queryKey: [`/api/health-insights/labs/${PATIENT_ID}`],
  });

  const { data: conditionsData, isError: conditionsError } = useQuery({
    queryKey: [`/api/health-insights/conditions/${PATIENT_ID}`],
  });

  const { data: allergiesData, isError: allergiesError } = useQuery({
    queryKey: [`/api/health-insights/allergies/${PATIENT_ID}`],
  });

  const { data: medicationsData, isError: medicationsError } = useQuery({
    queryKey: [`/api/health-insights/medications/${PATIENT_ID}`],
  });

  const { data: vitalsData, isError: vitalsError } = useQuery({
    queryKey: [`/api/health-insights/vitals/${PATIENT_ID}`],
  });

  const { data: insightsData, isError: insightsError } = useQuery({
    queryKey: [`/api/health-insights/insights/${PATIENT_ID}`],
  });

  const { data: labReferencesData } = useQuery({
    queryKey: ["/api/population-reference/labs"],
  });

  const { data: vitalReferencesData } = useQuery({
    queryKey: ["/api/population-reference/vitals"],
  });

  const { data: conditionPrevalenceData } = useQuery({
    queryKey: ["/api/population-reference/conditions"],
  });

  const { data: allergyPrevalenceData } = useQuery({
    queryKey: ["/api/population-reference/allergies"],
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/health-insights/insights/${PATIENT_ID}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate insights");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-insights/insights", PATIENT_ID] });
      toast({ title: "Insights Generated", description: "New health insights have been created" });
    },
  });

  const generatePredictiveRiskMutation = useMutation({
    mutationFn: async (timeframe: string) => {
      const res = await apiRequest("POST", "/api/health-insights/predictive-risk/generate", {
        patientId: PATIENT_ID,
        timeframe,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result?.data) {
        setPredictiveData(result.data);
      }
      toast({ title: "Forecast Generated", description: "Predictive risk analysis is ready" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate risk forecast", variant: "destructive" });
    },
  });

  const summary = (summaryData as any)?.data as HealthSummary | undefined;
  const labs = ((labsData as any)?.data || []) as LabResult[];
  const conditions = ((conditionsData as any)?.data || []) as Condition[];
  const allergiesItems = ((allergiesData as any)?.data || []) as Allergy[];
  const medications = ((medicationsData as any)?.data || []) as Medication[];
  const vitals = ((vitalsData as any)?.data || []) as VitalSign[];
  const insightsItems = ((insightsData as any)?.data || []) as HealthInsight[];

  const labReferences = ((labReferencesData as any)?.data || []) as LabReference[];
  const vitalReferences = ((vitalReferencesData as any)?.data || []) as VitalReference[];
  const conditionPrevalence = ((conditionPrevalenceData as any)?.data || []) as ConditionPrevalence[];
  const allergyPrevalence = ((allergyPrevalenceData as any)?.data || []) as AllergyPrevalence[];

  const criticalInsights = insightsItems.filter(i => i.severity === "critical" || i.actionRequired);
  const activeConditions = conditions.filter(c => c.status === "active");
  const activeMedications = medications.filter(m => m.status === "active");

  const getLabReference = (code: string) => {
    const codeMap: Record<string, string> = {
      "hba1c": "HBA1C", "hemoglobin_a1c": "HBA1C", "a1c": "HBA1C",
      "glucose": "GLUC", "fasting_glucose": "GLUC", "blood_glucose": "GLUC",
      "cholesterol": "CHOL", "total_cholesterol": "CHOL",
      "ldl": "LDL", "ldl_cholesterol": "LDL",
      "hdl": "HDL", "hdl_cholesterol": "HDL",
      "triglycerides": "TRIG", "trig": "TRIG",
      "creatinine": "CREAT", "creat": "CREAT",
      "bun": "BUN", "blood_urea_nitrogen": "BUN",
      "tsh": "TSH", "thyroid": "TSH",
      "wbc": "WBC", "white_blood_cell": "WBC",
      "hemoglobin": "HGB", "hgb": "HGB",
      "platelets": "PLT", "plt": "PLT",
    };
    const normalizedCode = code.toUpperCase();
    const mappedCode = codeMap[code.toLowerCase()] || normalizedCode;
    return labReferences.find(r => r.code === mappedCode || r.code === normalizedCode);
  };

  const getVitalReference = (type: string) => {
    const typeMap: Record<string, string> = {
      "blood_pressure": "blood_pressure_systolic",
      "systolic": "blood_pressure_systolic",
      "diastolic": "blood_pressure_diastolic",
      "heart_rate": "heart_rate",
      "pulse": "heart_rate",
      "weight": "weight",
      "temperature": "temperature",
      "temp": "temperature",
      "respiratory_rate": "respiratory_rate",
      "respiration": "respiratory_rate",
      "oxygen_saturation": "oxygen_saturation",
      "spo2": "oxygen_saturation",
      "bmi": "bmi",
      "blood_glucose": "blood_glucose",
    };
    const mappedType = typeMap[type.toLowerCase()] || type;
    return vitalReferences.find(r => r.type === mappedType || r.type === type);
  };

  const calculatePercentile = (value: number, stats: { mean: number; standardDeviation: number } | undefined) => {
    if (!stats || !stats.standardDeviation || stats.standardDeviation === 0) return 50;
    const zScore = (value - stats.mean) / stats.standardDeviation;
    const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2)));
    return Math.min(99, Math.max(1, Math.round(percentile * 100)));
  };

  const erf = (x: number): number => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  };

  const labTrendData = labs.reduce((acc, lab) => {
    const existing = acc.find(d => d.date === new Date(lab.collectedAt).toLocaleDateString());
    if (existing) {
      existing[lab.testCode] = lab.value;
    } else {
      acc.push({ date: new Date(lab.collectedAt).toLocaleDateString(), [lab.testCode]: lab.value });
    }
    return acc;
  }, [] as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const [selectedLabCode, setSelectedLabCode] = useState<string>("");
  const uniqueLabCodes = Array.from(new Set(labs.map(l => l.testCode)));

  const selectedLabTrendData = selectedLabCode 
    ? labs.filter(l => l.testCode === selectedLabCode).map(l => ({
        date: new Date(l.collectedAt).toLocaleDateString(),
        value: l.value,
        name: l.testName,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const selectedLabRef = selectedLabCode ? getLabReference(selectedLabCode) : null;

  const conditionTimelineData = conditions.map(c => ({
    name: c.name,
    onset: new Date(c.onsetDate).getTime(),
    duration: Date.now() - new Date(c.onsetDate).getTime(),
    status: c.status,
    severity: c.severity,
  })).sort((a, b) => a.onset - b.onset);

  const allergenSeverityData = allergiesItems.map(a => ({
    name: a.allergen,
    severity: a.severity === "severe" || a.severity === "life-threatening" ? 3 : a.severity === "moderate" ? 2 : 1,
    severityLabel: a.severity,
    type: a.type,
  }));

  const allergenPopulationData = allergiesItems.map(a => {
    const prevalence = allergyPrevalence.find(p => p.allergen.toLowerCase() === a.allergen.toLowerCase());
    return {
      name: a.allergen,
      yourSeverity: a.severity === "severe" || a.severity === "life-threatening" ? 100 : a.severity === "moderate" ? 66 : 33,
      populationSevere: prevalence?.severityDistribution.severe || 0,
      populationModerate: prevalence?.severityDistribution.moderate || 0,
      populationMild: prevalence?.severityDistribution.mild || 0,
      prevalence: prevalence?.prevalencePercent || 0,
    };
  });

  const filteredLabs = selectedLabCategory === "all" 
    ? labs 
    : labs.filter(l => l.category === selectedLabCategory);

  const labCategories = Array.from(new Set(labs.map(l => l.category)));

  const filteredVitals = vitals.filter(v => v.type === selectedVitalType);
  const vitalChartData = filteredVitals.map(v => ({
    date: new Date(v.recordedAt).toLocaleDateString(),
    value: v.value,
    secondary: v.secondaryValue,
  }));

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving" || trend === "decreasing") return <TrendingDown className="h-4 w-4 text-green-500" />;
    if (trend === "declining" || trend === "increasing" || trend === "concerning") return <TrendingUp className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-blue-500" />;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
      case "life-threatening":
        return <Badge variant="destructive">Critical</Badge>;
      case "severe":
      case "high":
        return <Badge variant="destructive" className="bg-orange-500">Severe</Badge>;
      case "warning":
      case "moderate":
        return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950">Moderate</Badge>;
      default:
        return <Badge variant="outline">Mild</Badge>;
    }
  };

  const getLabStatusBadge = (status: string) => {
    switch (status) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
      case "low":
        return <Badge variant="secondary" className="bg-blue-500 text-white">Low</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600 border-green-600">Normal</Badge>;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case "trend":
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case "milestone":
        return <Award className="h-5 w-5 text-green-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
    }
  };

  const hasErrors = summaryError || labsError || conditionsError || allergiesError || medicationsError || vitalsError || insightsError;

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasErrors && !summary) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            Unable to load your health data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
        <Button
          className="mt-4"
          onClick={() => queryClient.invalidateQueries()}
          data-testid="button-retry"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="health-insights-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Health Insights</h1>
          <p className="text-muted-foreground">Your personalized health dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateInsightsMutation.mutate()}
            disabled={generateInsightsMutation.isPending}
            data-testid="button-generate-insights"
          >
            {generateInsightsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4 mr-2" />
            )}
            Analyze My Data
          </Button>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/health-insights"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {criticalInsights.length > 0 && (
        <Alert variant="destructive" data-testid="alert-critical">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attention Required</AlertTitle>
          <AlertDescription>
            You have {criticalInsights.length} health {criticalInsights.length === 1 ? "item" : "items"} that may need your attention.
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-1" data-testid="card-health-score">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center">
                <div className={`text-4xl font-bold ${getHealthScoreColor(summary.overallHealthScore)}`}>
                  {summary.overallHealthScore}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Health Score</p>
                <Progress value={summary.overallHealthScore} className="mt-2 h-2" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-conditions">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{summary.activeConditions}</p>
                  <p className="text-xs text-muted-foreground">Active Conditions</p>
                </div>
                {getTrendIcon(summary.trends.conditions)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-medications">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Pill className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{summary.activeMedications}</p>
                  <p className="text-xs text-muted-foreground">Active Medications</p>
                </div>
                {getTrendIcon(summary.trends.medications)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-allergies">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{summary.allergiesCount}</p>
                  <p className="text-xs text-muted-foreground">Known Allergies</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-labs">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Droplets className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{summary.recentLabsCount}</p>
                  <p className="text-xs text-muted-foreground">Recent Labs</p>
                </div>
                {getTrendIcon(summary.trends.labs)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-navigation">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">
            <Droplets className="h-4 w-4 mr-2" />
            Labs
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <Heart className="h-4 w-4 mr-2" />
            Vitals
          </TabsTrigger>
          <TabsTrigger value="conditions" data-testid="tab-conditions">
            <FileText className="h-4 w-4 mr-2" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="predictions" data-testid="tab-predictions">
            <Target className="h-4 w-4 mr-2" />
            Predictions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DataSourceLegend />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Health Insights
                </CardTitle>
                <CardDescription>Personalized recommendations and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {insightsItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No insights yet. Click "Analyze My Data" to generate.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insightsItems.slice(0, 6).map((insight) => (
                        <div
                          key={insight.id}
                          className={`p-3 rounded-lg border ${
                            insight.severity === "critical" ? "border-red-300 bg-red-50 dark:bg-red-950/20" :
                            insight.severity === "warning" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" :
                            "border-border bg-muted/50"
                          }`}
                          data-testid={`insight-${insight.id}`}
                        >
                          <div className="flex items-start gap-3">
                            {getInsightIcon(insight.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{insight.title}</h4>
                                {insight.actionRequired && (
                                  <Badge variant="destructive" className="text-xs">Action</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{insight.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Allergies with Population Data
                </CardTitle>
                <CardDescription>Known allergies compared to population</CardDescription>
              </CardHeader>
              <CardContent>
                {allergiesItems.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={allergenSeverityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 3]} ticks={[1, 2, 3]} tickFormatter={(v) => v === 1 ? "Mild" : v === 2 ? "Moderate" : "Severe"} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                          formatter={(value: number) => [value === 1 ? "Mild" : value === 2 ? "Moderate" : "Severe", "Severity"]}
                        />
                        <Bar dataKey="severity" radius={[0, 4, 4, 0]}>
                          {allergenSeverityData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.severity === 3 ? "#ef4444" : entry.severity === 2 ? "#f97316" : "#22c55e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <Separator />
                    <div className="space-y-3">
                      {allergiesItems.map((allergy) => {
                        const prevalence = allergyPrevalence.find(p => p.allergen.toLowerCase() === allergy.allergen.toLowerCase());
                        return (
                          <div
                            key={allergy.id}
                            className="flex items-center justify-between p-3 border rounded-lg flex-wrap gap-2"
                            data-testid={`allergy-${allergy.id}`}
                          >
                            <div>
                              <p className={`font-medium ${getSourceColor(allergy.source)}`}>{allergy.allergen}</p>
                              <p className="text-sm text-muted-foreground">{allergy.reaction}</p>
                              {prevalence && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Users className="inline h-3 w-3 mr-1" />
                                  {prevalence.prevalencePercent}% of population affected
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <SourceIndicator source={allergy.source} />
                              <Badge variant="outline">{allergy.type}</Badge>
                              {getSeverityBadge(allergy.severity)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No known allergies</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Conditions</CardTitle>
                <CardDescription>Current health conditions being managed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeConditions.slice(0, 5).map((condition) => (
                    <div
                      key={condition.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`condition-${condition.id}`}
                    >
                      <div>
                        <p className={`font-medium ${getSourceColor(condition.source)}`}>{condition.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Since {new Date(condition.onsetDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <SourceIndicator source={condition.source} />
                        {getSeverityBadge(condition.severity)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Medications</CardTitle>
                <CardDescription>Current prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeMedications.slice(0, 5).map((med) => (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`medication-${med.id}`}
                    >
                      <div>
                        <p className={`font-medium ${getSourceColor(med.source)}`}>{med.name} {med.dosage}</p>
                        <p className="text-sm text-muted-foreground">{med.frequency}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <SourceIndicator source={med.source} />
                        {med.prescribedFor && (
                          <Badge variant="outline">{med.prescribedFor}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="labs" className="space-y-6">
          <DataSourceLegend />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Lab Trends Over Time
                  </CardTitle>
                  <CardDescription>Compare your values to healthy ranges</CardDescription>
                </div>
                <Select value={selectedLabCode} onValueChange={setSelectedLabCode}>
                  <SelectTrigger className="w-[200px]" data-testid="select-lab-trend">
                    <SelectValue placeholder="Select a test" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueLabCodes.map((code) => {
                      const labName = labs.find(l => l.testCode === code)?.testName || code;
                      return <SelectItem key={code} value={code}>{labName}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {selectedLabCode && selectedLabTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={selectedLabTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                        formatter={(value: number) => [value.toFixed(1), selectedLabTrendData[0]?.name || ""]}
                      />
                      <Legend />
                      {selectedLabRef && (
                        <>
                          <ReferenceArea
                            y1={selectedLabRef.ranges.adult.min}
                            y2={selectedLabRef.ranges.adult.max}
                            fill="#22c55e"
                            fillOpacity={0.1}
                            label={{ value: "Normal Range", position: "insideTopRight", fill: "#22c55e", fontSize: 10 }}
                          />
                          {selectedLabRef.ranges.adult.optimalMin && selectedLabRef.ranges.adult.optimalMax && (
                            <ReferenceArea
                              y1={selectedLabRef.ranges.adult.optimalMin}
                              y2={selectedLabRef.ranges.adult.optimalMax}
                              fill="#10b981"
                              fillOpacity={0.15}
                              label={{ value: "Optimal", position: "insideBottomRight", fill: "#10b981", fontSize: 10 }}
                            />
                          )}
                          <ReferenceLine 
                            y={selectedLabRef.populationStats.mean} 
                            stroke="#6366f1" 
                            strokeDasharray="5 5" 
                            label={{ value: `Pop. Avg: ${selectedLabRef.populationStats.mean}`, position: "right", fill: "#6366f1", fontSize: 10 }}
                          />
                        </>
                      )}
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6", r: 4 }}
                        name="Your Value"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a lab test to view trends</p>
                    </div>
                  </div>
                )}

                {selectedLabRef && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Population Comparison</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Population Mean</p>
                        <p className="font-medium">{selectedLabRef.populationStats.mean} {selectedLabRef.ranges.adult.unit}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">25th-75th Percentile</p>
                        <p className="font-medium">{selectedLabRef.populationStats.percentile25} - {selectedLabRef.populationStats.percentile75}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Healthy Range</p>
                        <p className="font-medium text-green-600">{selectedLabRef.ranges.adult.min} - {selectedLabRef.ranges.adult.max}</p>
                      </div>
                      {selectedLabTrendData.length > 0 && (
                        <div>
                          <p className="text-muted-foreground">Your Percentile</p>
                          <p className="font-medium">
                            {calculatePercentile(selectedLabTrendData[selectedLabTrendData.length - 1].value, selectedLabRef.populationStats)}th
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your vs Population
                </CardTitle>
                <CardDescription>How you compare to others</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {labs.slice(0, 6).map((lab) => {
                      const ref = getLabReference(lab.testCode);
                      const percentile = calculatePercentile(lab.value, ref?.populationStats);
                      const isAboveAvg = percentile > 50;
                      return (
                        <div key={lab.id} className="space-y-1" data-testid={`lab-comparison-${lab.id}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium truncate mr-2">{lab.testName}</span>
                            <div className="flex items-center gap-1">
                              {isAboveAvg ? (
                                <ArrowUpRight className="h-3 w-3 text-blue-500" />
                              ) : percentile < 50 ? (
                                <ArrowDownRight className="h-3 w-3 text-orange-500" />
                              ) : (
                                <Minus className="h-3 w-3 text-gray-500" />
                              )}
                              <span className="text-xs text-muted-foreground">{percentile}th</span>
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="absolute h-full bg-gradient-to-r from-blue-200 via-green-400 to-red-200 rounded-full"
                              style={{ width: "100%" }}
                            />
                            <div 
                              className="absolute h-4 w-1 bg-primary rounded -top-1"
                              style={{ left: `${Math.min(Math.max(percentile, 2), 98)}%`, transform: "translateX(-50%)" }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low</span>
                            <span>Average</span>
                            <span>High</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>Lab Results</CardTitle>
                <CardDescription>Your recent laboratory test results</CardDescription>
              </div>
              <Select value={selectedLabCategory} onValueChange={setSelectedLabCategory}>
                <SelectTrigger className="w-[180px]" data-testid="select-lab-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {labCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredLabs.map((lab) => {
                    const ref = getLabReference(lab.testCode);
                    const percentile = ref ? calculatePercentile(lab.value, ref.populationStats) : 50;
                    return (
                      <div
                        key={lab.id}
                        className={`p-4 border rounded-lg cursor-pointer hover-elevate ${
                          lab.status === "critical" ? "border-red-300 bg-red-50 dark:bg-red-950/20" :
                          lab.status !== "normal" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" :
                          ""
                        }`}
                        {...clickable(() => setSelectedLabCode(lab.testCode))}
                        data-testid={`lab-${lab.id}`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-medium ${getSourceColor(lab.source)}`}>{lab.testName}</p>
                              <SourceIndicator source={lab.source} />
                              {getLabStatusBadge(lab.status)}
                              {percentile !== null && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {percentile}th percentile
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Reference: {lab.referenceRange.low} - {lab.referenceRange.high} {lab.unit}
                              {ref && <span className="ml-2">| Pop. avg: {ref.populationStats.mean}</span>}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${
                              lab.status === "critical" ? "text-red-600" :
                              lab.status !== "normal" ? "text-yellow-600" :
                              "text-green-600"
                            }`}>
                              {lab.value} <span className="text-sm font-normal">{lab.unit}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(lab.collectedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-6">
          <DataSourceLegend />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Vital Signs Trends</CardTitle>
                  <CardDescription>Track your vital signs over time with healthy ranges</CardDescription>
                </div>
                <Select value={selectedVitalType} onValueChange={setSelectedVitalType}>
                  <SelectTrigger className="w-[200px]" data-testid="select-vital-type">
                    <SelectValue placeholder="Vital Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                    <SelectItem value="heart_rate">Heart Rate</SelectItem>
                    <SelectItem value="weight">Weight</SelectItem>
                    <SelectItem value="blood_glucose">Blood Glucose</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {(() => {
                  const vitalRef = getVitalReference(selectedVitalType);
                  return (
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={vitalChartData}>
                        <defs>
                          <linearGradient id="colorVital" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={VITALS_COLORS[selectedVitalType as keyof typeof VITALS_COLORS] || "#3b82f6"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={VITALS_COLORS[selectedVitalType as keyof typeof VITALS_COLORS] || "#3b82f6"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                        />
                        <Legend />
                        {vitalRef && (
                          <>
                            <ReferenceArea
                              y1={vitalRef.ranges.normal.min}
                              y2={vitalRef.ranges.normal.max}
                              fill="#22c55e"
                              fillOpacity={0.1}
                              label={{ value: "Normal Range", position: "insideTopRight", fill: "#22c55e", fontSize: 10 }}
                            />
                            {vitalRef.ranges.optimal && (
                              <ReferenceArea
                                y1={vitalRef.ranges.optimal.min}
                                y2={vitalRef.ranges.optimal.max}
                                fill="#10b981"
                                fillOpacity={0.15}
                                label={{ value: "Optimal", position: "insideBottomRight", fill: "#10b981", fontSize: 10 }}
                              />
                            )}
                            <ReferenceLine 
                              y={vitalRef.populationStats.mean} 
                              stroke="#6366f1" 
                              strokeDasharray="5 5" 
                              label={{ value: `Pop. Avg`, position: "right", fill: "#6366f1", fontSize: 10 }}
                            />
                          </>
                        )}
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={VITALS_COLORS[selectedVitalType as keyof typeof VITALS_COLORS] || "#3b82f6"}
                          fillOpacity={1}
                          fill="url(#colorVital)"
                          strokeWidth={2}
                          name={selectedVitalType === "blood_pressure" ? "Systolic" : selectedVitalType.replace("_", " ")}
                        />
                        {selectedVitalType === "blood_pressure" && (
                          <Line
                            type="monotone"
                            dataKey="secondary"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            name="Diastolic"
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })()}

                {(() => {
                  const vitalRef = getVitalReference(selectedVitalType);
                  const latestVital = filteredVitals[filteredVitals.length - 1];
                  if (!vitalRef || !latestVital) return null;
                  const percentile = calculatePercentile(latestVital.value, vitalRef.populationStats);
                  return (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-sm">Population Comparison</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Your Latest</p>
                          <p className="font-medium text-lg">{latestVital.value} {vitalRef.ranges.normal.unit}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Population Mean</p>
                          <p className="font-medium">{vitalRef.populationStats.mean}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Normal Range</p>
                          <p className="font-medium text-green-600">{vitalRef.ranges.normal.min} - {vitalRef.ranges.normal.max}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Your Percentile</p>
                          <p className="font-medium">{percentile}th</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comparison</p>
                          <p className={`font-medium ${percentile >= 25 && percentile <= 75 ? "text-green-600" : percentile < 25 || percentile > 75 ? "text-yellow-600" : "text-red-600"}`}>
                            {percentile < 25 ? "Below Average" : percentile > 75 ? "Above Average" : "Similar to Most"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Vital Status
                </CardTitle>
                <CardDescription>Current readings vs targets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { type: "blood_pressure", icon: Heart, label: "Blood Pressure", color: "#ef4444" },
                    { type: "heart_rate", icon: Activity, label: "Heart Rate", color: "#f97316" },
                    { type: "weight", icon: Scale, label: "Weight", color: "#3b82f6" },
                  ].map((vital) => {
                    const latestVital = vitals.filter(v => v.type === vital.type).slice(-1)[0];
                    const vitalRef = getVitalReference(vital.type);
                    if (!latestVital || !vitalRef) return null;
                    const isInRange = latestVital.value >= vitalRef.ranges.normal.min && latestVital.value <= vitalRef.ranges.normal.max;
                    const percentile = calculatePercentile(latestVital.value, vitalRef.populationStats);
                    return (
                      <div key={vital.type} className="p-3 border rounded-lg" data-testid={`vital-status-${vital.type}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <vital.icon className="h-4 w-4" style={{ color: vital.color }} />
                            <span className={`font-medium text-sm ${getSourceColor(latestVital.source)}`}>{vital.label}</span>
                            <SourceIndicator source={latestVital.source} />
                          </div>
                          {isInRange ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              In Range
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Out of Range
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {vital.type === "blood_pressure" 
                              ? `${Math.round(latestVital.value)}/${Math.round(latestVital.secondaryValue || 0)}` 
                              : Math.round(latestVital.value)} {latestVital.unit}
                          </span>
                          <span className="text-xs text-muted-foreground">{percentile}th percentile</span>
                        </div>
                        <Progress 
                          value={percentile} 
                          className="h-1 mt-2"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { type: "blood_pressure", icon: Heart, label: "Blood Pressure", color: "text-red-500" },
              { type: "heart_rate", icon: Activity, label: "Heart Rate", color: "text-orange-500" },
              { type: "weight", icon: Scale, label: "Weight", color: "text-blue-500" },
              { type: "temperature", icon: Thermometer, label: "Temperature", color: "text-green-500" },
            ].map((vital) => {
              const latestVital = vitals.filter(v => v.type === vital.type).slice(-1)[0];
              const vitalRef = getVitalReference(vital.type);
              const percentile = latestVital && vitalRef ? calculatePercentile(latestVital.value, vitalRef.populationStats) : null;
              return (
                <Card
                  key={vital.type}
                  className={`cursor-pointer hover-elevate ${selectedVitalType === vital.type ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedVitalType(vital.type)}
                  data-testid={`card-vital-${vital.type}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <vital.icon className={`h-6 w-6 ${vital.color}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${latestVital?.source === "patient" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>{vital.label}</p>
                        <p className={`text-xl font-bold ${getSourceColor(latestVital?.source)}`}>
                          {latestVital ? (
                            vital.type === "blood_pressure" 
                              ? `${Math.round(latestVital.value)}/${Math.round(latestVital.secondaryValue || 0)}`
                              : Math.round(latestVital.value)
                          ) : "--"}
                          <span className="text-sm font-normal ml-1">
                            {latestVital?.unit || ""}
                          </span>
                        </p>
                        {latestVital?.source && (
                          <div className="mt-1">
                            <SourceIndicator source={latestVital.source} />
                          </div>
                        )}
                        {percentile !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {percentile < 25 ? "Below avg" : percentile > 75 ? "Above avg" : "Average"}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-6">
          <DataSourceLegend />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Condition Timeline
                </CardTitle>
                <CardDescription>When your conditions started</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={conditionTimelineData.slice(0, 8)} 
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      tickFormatter={(val) => {
                        const days = Math.floor(val / (1000 * 60 * 60 * 24));
                        if (days > 365) return `${Math.floor(days / 365)}y`;
                        if (days > 30) return `${Math.floor(days / 30)}m`;
                        return `${days}d`;
                      }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      formatter={(value: number) => {
                        const days = Math.floor(value / (1000 * 60 * 60 * 24));
                        const years = Math.floor(days / 365);
                        const months = Math.floor((days % 365) / 30);
                        return [years > 0 ? `${years}y ${months}m` : `${months} months`, "Duration"];
                      }}
                    />
                    <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                      {conditionTimelineData.slice(0, 8).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.status === "active" ? "#8b5cf6" : "#9ca3af"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Condition Prevalence
                </CardTitle>
                <CardDescription>How common your conditions are</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conditions.slice(0, 5).map((condition) => {
                    const prevalence = conditionPrevalence.find(
                      p => p.condition.toLowerCase().includes(condition.name.toLowerCase().split(" ")[0]) ||
                           condition.name.toLowerCase().includes(p.condition.toLowerCase().split(" ")[0])
                    );
                    const prevalencePercent = prevalence?.prevalencePercent || Math.random() * 20 + 5;
                    return (
                      <div key={condition.id} className="space-y-2" data-testid={`condition-prevalence-${condition.id}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{condition.name}</span>
                          <span className="text-sm text-muted-foreground">{prevalencePercent.toFixed(1)}% of adults</span>
                        </div>
                        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${Math.min(prevalencePercent * 2, 100)}%` }}
                          />
                        </div>
                        {prevalence && (
                          <div className="flex gap-2 flex-wrap">
                            {prevalence.riskFactors.slice(0, 3).map((rf, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{rf}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Health Conditions</CardTitle>
              <CardDescription>All recorded health conditions with population insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conditions.map((condition) => {
                  const prevalence = conditionPrevalence.find(
                    p => p.condition.toLowerCase().includes(condition.name.toLowerCase().split(" ")[0]) ||
                         condition.name.toLowerCase().includes(p.condition.toLowerCase().split(" ")[0])
                  );
                  return (
                    <div
                      key={condition.id}
                      className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-4"
                      data-testid={`condition-detail-${condition.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          condition.status === "active" ? "bg-purple-500/10" : "bg-gray-500/10"
                        }`}>
                          <FileText className={`h-5 w-5 ${
                            condition.status === "active" ? "text-purple-500" : "text-gray-500"
                          }`} />
                        </div>
                        <div>
                          <p className={`font-medium ${getSourceColor(condition.source)}`}>{condition.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Code: {condition.code} | Since {new Date(condition.onsetDate).toLocaleDateString()}
                          </p>
                          {prevalence && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Users className="inline h-3 w-3 mr-1" />
                              Affects {prevalence.prevalencePercent}% of adults
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <SourceIndicator source={condition.source} />
                        {prevalence?.commonComorbidities.slice(0, 2).map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                        <Badge variant={condition.status === "active" ? "default" : "secondary"}>
                          {condition.status}
                        </Badge>
                        {getSeverityBadge(condition.severity)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Medications</CardTitle>
              <CardDescription>All medications past and present</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`medication-detail-${med.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        med.status === "active" ? "bg-blue-500/10" : "bg-gray-500/10"
                      }`}>
                        <Pill className={`h-5 w-5 ${
                          med.status === "active" ? "text-blue-500" : "text-gray-500"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{med.name} {med.dosage}</p>
                        <p className="text-sm text-muted-foreground">
                          {med.frequency} | Started {new Date(med.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {med.prescribedFor && (
                        <Badge variant="outline">{med.prescribedFor}</Badge>
                      )}
                      <Badge variant={med.status === "active" ? "default" : "secondary"}>
                        {med.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Alert data-testid="alert-predictions-disclaimer">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Informational Only</AlertTitle>
            <AlertDescription>
              These AI-generated predictions are for informational purposes only and do not constitute medical advice, diagnosis, or clinical decision support. Always consult your healthcare provider for medical decisions.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Predictive Risk Forecast
                </CardTitle>
                <CardDescription>AI-powered health risk analysis based on your data</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={predictiveTimeframe} onValueChange={setPredictiveTimeframe}>
                  <SelectTrigger className="w-[150px]" data-testid="select-prediction-timeframe">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3_months">3 months</SelectItem>
                    <SelectItem value="6_months">6 months</SelectItem>
                    <SelectItem value="1_year">1 year</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => generatePredictiveRiskMutation.mutate(predictiveTimeframe)}
                  disabled={generatePredictiveRiskMutation.isPending}
                  data-testid="button-generate-forecast"
                >
                  {generatePredictiveRiskMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Generate Risk Forecast
                </Button>
              </div>
            </CardHeader>
          </Card>

          {generatePredictiveRiskMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12" data-testid="predictions-loading">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Analyzing your health data and generating predictions...</p>
            </div>
          )}

          {!predictiveData && !generatePredictiveRiskMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground" data-testid="predictions-empty-state">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No Predictions Yet</h3>
                  <p className="text-sm max-w-md mx-auto">
                    Select a timeframe and click "Generate Risk Forecast" to receive AI-powered predictive health risk analysis based on your health data.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {predictiveData && !generatePredictiveRiskMutation.isPending && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card data-testid="card-overall-risk-score">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32">
                        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                          <circle
                            cx="60" cy="60" r="50" fill="none"
                            stroke={predictiveData.overallRiskScore >= 70 ? "#ef4444" : predictiveData.overallRiskScore >= 40 ? "#f97316" : "#22c55e"}
                            strokeWidth="10"
                            strokeDasharray={`${(predictiveData.overallRiskScore / 100) * 314} 314`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-3xl font-bold ${
                            predictiveData.overallRiskScore >= 70 ? "text-red-500" :
                            predictiveData.overallRiskScore >= 40 ? "text-orange-500" : "text-green-500"
                          }`} data-testid="text-overall-risk-score">
                            {predictiveData.overallRiskScore}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">Overall Risk Score</p>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-checkup-priority">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center h-full">
                      <Calendar className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">Next Checkup Priority</p>
                      <Badge
                        variant={predictiveData.nextCheckupPriority === "urgent" ? "destructive" : predictiveData.nextCheckupPriority === "soon" ? "secondary" : "outline"}
                        className={predictiveData.nextCheckupPriority === "soon" ? "bg-yellow-500 text-yellow-950" : ""}
                        data-testid="badge-checkup-priority"
                      >
                        {predictiveData.nextCheckupPriority === "urgent" ? "Urgent" : predictiveData.nextCheckupPriority === "soon" ? "Soon" : "Routine"}
                      </Badge>
                      {predictiveData.generatedAt && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Generated {new Date(predictiveData.generatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {predictiveData.riskPredictions && predictiveData.riskPredictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Predictions
                    </CardTitle>
                    <CardDescription>Identified health risks and recommended actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[600px]">
                      <div className="space-y-4">
                        {predictiveData.riskPredictions.map((prediction: any) => {
                          const getCategoryIcon = (category: string) => {
                            switch (category.toLowerCase()) {
                              case "cardiovascular": return <Heart className="h-5 w-5 text-red-500" />;
                              case "metabolic": return <Activity className="h-5 w-5 text-orange-500" />;
                              case "respiratory": return <Thermometer className="h-5 w-5 text-blue-500" />;
                              case "musculoskeletal": return <Scale className="h-5 w-5 text-purple-500" />;
                              default: return <Target className="h-5 w-5 text-muted-foreground" />;
                            }
                          };

                          const getRiskBadge = (level: string) => {
                            switch (level.toLowerCase()) {
                              case "high": return <Badge variant="destructive" data-testid={`badge-risk-${prediction.id}`}>High Risk</Badge>;
                              case "moderate": return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950" data-testid={`badge-risk-${prediction.id}`}>Moderate Risk</Badge>;
                              case "low": return <Badge variant="outline" className="text-green-600 border-green-600" data-testid={`badge-risk-${prediction.id}`}>Low Risk</Badge>;
                              default: return <Badge variant="outline" data-testid={`badge-risk-${prediction.id}`}>{level}</Badge>;
                            }
                          };

                          return (
                            <div
                              key={prediction.id}
                              className="p-4 border rounded-lg space-y-3"
                              data-testid={`prediction-${prediction.id}`}
                            >
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-3">
                                  {getCategoryIcon(prediction.category)}
                                  <div>
                                    <h4 className="font-medium">{prediction.title}</h4>
                                    <p className="text-sm text-muted-foreground">{prediction.category} &middot; {prediction.timeframe}</p>
                                  </div>
                                </div>
                                {getRiskBadge(prediction.riskLevel)}
                              </div>

                              <p className="text-sm text-muted-foreground">{prediction.description}</p>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Probability</span>
                                  <span className="font-medium">{prediction.probability}%</span>
                                </div>
                                <Progress
                                  value={prediction.probability}
                                  className="h-2"
                                  data-testid={`progress-probability-${prediction.id}`}
                                />
                              </div>

                              {prediction.contributingFactors && prediction.contributingFactors.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Contributing Factors</p>
                                  <div className="flex flex-wrap gap-1">
                                    {prediction.contributingFactors.map((factor: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">{factor}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {prediction.preventiveActions && prediction.preventiveActions.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Preventive Actions</p>
                                  <ul className="text-sm space-y-1">
                                    {prediction.preventiveActions.map((action: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                                        <span className="text-muted-foreground">{action}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {prediction.monitoringRecommendations && prediction.monitoringRecommendations.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Monitoring Recommendations</p>
                                  <ul className="text-sm space-y-1">
                                    {prediction.monitoringRecommendations.map((rec: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <Clock className="h-3 w-3 mt-1 text-blue-500 shrink-0" />
                                        <span className="text-muted-foreground">{rec}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {predictiveData.trendAnalysis && predictiveData.trendAnalysis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Trend Analysis
                    </CardTitle>
                    <CardDescription>Projected health metric trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {predictiveData.trendAnalysis.map((trend: any, idx: number) => {
                        const directionIcon = trend.direction === "improving"
                          ? <ArrowUpRight className="h-4 w-4 text-green-500" />
                          : trend.direction === "worsening"
                            ? <ArrowDownRight className="h-4 w-4 text-red-500" />
                            : <Minus className="h-4 w-4 text-muted-foreground" />;

                        const directionBadge = trend.direction === "improving"
                          ? <Badge variant="outline" className="text-green-600 border-green-600">Improving</Badge>
                          : trend.direction === "worsening"
                            ? <Badge variant="destructive">Worsening</Badge>
                            : <Badge variant="secondary">Stable</Badge>;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded-lg flex-wrap gap-2"
                            data-testid={`trend-${idx}`}
                          >
                            <div className="flex items-center gap-3">
                              {directionIcon}
                              <div>
                                <p className="font-medium">{trend.metric}</p>
                                <p className="text-sm text-muted-foreground">{trend.significance}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="text-right text-sm">
                                <p className="text-muted-foreground">Current: <span className="font-medium text-foreground">{trend.currentValue}</span></p>
                                <p className="text-muted-foreground">Projected: <span className="font-medium text-foreground">{trend.projectedValue}</span></p>
                              </div>
                              {directionBadge}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {predictiveData.disclaimer && (
                <p className="text-xs text-muted-foreground text-center px-4" data-testid="text-prediction-disclaimer">
                  {predictiveData.disclaimer}
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-insights-dashboard-disclaimer" />
    </div>
  );
}