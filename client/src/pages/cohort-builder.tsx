import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Search,
  Users,
  Plus,
  Play,
  Download,
  Trash2,
  Brain,
  BarChart3,
  Filter,
  Sparkles,
  Loader2,
  FileJson,
  FileText,
  Database,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  Eye,
  TrendingUp,
  AlertTriangle,
  Target,
  LineChart,
  Scale,
  FlaskConical,
  GitBranch,
  Shuffle,
  Microscope,
  Network,
  Beaker,
  Shield,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface CohortCriterion {
  id: string;
  type: string;
  field: string;
  operator: string;
  value: unknown;
  label: string;
}

interface CriteriaGroup {
  id: string;
  operator: "AND" | "OR" | "NOT";
  criteria: (CohortCriterion | CriteriaGroup)[];
}

interface CohortDefinition {
  id: string;
  name: string;
  description: string;
  naturalLanguageQuery: string;
  criteria: CriteriaGroup;
  createdAt: string;
  updatedAt: string;
  status: string;
  patientCount?: number;
  lastExecutedAt?: string;
}

interface PatientMatch {
  patientId: string;
  patientName: string;
  matchScore: number;
  matchedCriteria: string[];
  demographics: { age: number; gender: string; location?: string };
  conditions: string[];
  medications: string[];
  procedures: string[];
  lastEncounter?: string;
}

interface CohortCharacteristics {
  demographics: {
    ageDistribution: Array<{ range: string; count: number; percentage: number }>;
    genderDistribution: Array<{ gender: string; count: number; percentage: number }>;
    locationDistribution: Array<{ location: string; count: number; percentage: number }>;
  };
  conditions: Array<{ condition: string; count: number; percentage: number }>;
  medications: Array<{ medication: string; count: number; percentage: number }>;
  procedures: Array<{ procedure: string; count: number; percentage: number }>;
  encounters: {
    totalEncounters: number;
    averageEncountersPerPatient: number;
    encounterTypeDistribution: Array<{ type: string; count: number }>;
  };
  journeyPatterns: Array<{ pattern: string; count: number; description: string }>;
}

interface ParsedQuery {
  criteria: CriteriaGroup;
  suggestedName: string;
  description: string;
  confidence: number;
  interpretation: string;
}

interface OutcomePrediction {
  id: string;
  cohortId: string;
  outcomeType: string;
  timeframeMonths: number;
  predictions: Array<{ category: string; probability: number; confidence: number; sampleSize: number }>;
  riskFactors: Array<{ factor: string; impact: "high" | "medium" | "low"; prevalence: number }>;
  methodology: string;
  limitations: string[];
  generatedAt: string;
}

interface RiskSubpopulation {
  id: string;
  cohortId: string;
  name: string;
  description: string;
  riskLevel: "high" | "medium" | "low";
  patientCount: number;
  patientIds: string[];
  riskFactors: Array<{ factor: string; prevalence: number; contribution: number }>;
  characteristics: {
    avgAge: number;
    genderDistribution: Record<string, number>;
    topConditions: string[];
    topMedications: string[];
  };
  identifiedAt: string;
}

interface CohortComparison {
  id: string;
  cohortId: string;
  comparisonType: "historical" | "benchmark" | "peer";
  comparisonSource: string;
  metrics: Array<{
    name: string;
    cohortValue: number;
    comparisonValue: number;
    difference: number;
    differencePercent: number;
    significance: "significant" | "not_significant" | "marginal";
  }>;
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

interface Benchmark {
  id: string;
  name: string;
  description: string;
}

interface PatternDiscovery {
  id: string;
  cohortId: string;
  patterns: Array<{
    type: "correlation" | "cluster" | "trend" | "anomaly";
    name: string;
    description: string;
    strength: number;
    confidence: number;
    affectedPatients: number;
    variables: string[];
  }>;
  correlationMatrix: Array<{
    variable1: string;
    variable2: string;
    correlation: number;
    pValue: number;
    significance: "significant" | "marginal" | "not_significant";
  }>;
  clusterAnalysis: Array<{
    clusterId: string;
    name: string;
    size: number;
    characteristics: string[];
    centroid: Record<string, number>;
  }>;
  methodology: string;
  limitations: string[];
  generatedAt: string;
}

interface SyntheticPatientData {
  id: string;
  cohortId: string;
  syntheticPatients: Array<{
    syntheticId: string;
    demographics: { age: number; gender: string; location: string };
    conditions: string[];
    medications: string[];
    procedures: string[];
    encounters: number;
  }>;
  generationMethod: string;
  privacyGuarantees: string[];
  validationMetrics: {
    demographicFidelity: number;
    conditionDistributionMatch: number;
    medicationDistributionMatch: number;
    overallQuality: number;
  };
  generatedAt: string;
}

interface CausalInferenceResult {
  id: string;
  cohortId: string;
  treatmentVariable: string;
  outcomeVariable: string;
  analysisType: "propensity_score" | "difference_in_differences" | "instrumental_variable" | "regression_discontinuity";
  results: {
    estimatedEffect: number;
    confidenceInterval: [number, number];
    pValue: number;
    sampleSize: number;
    treatmentGroup: number;
    controlGroup: number;
  };
  confounders: Array<{ variable: string; adjustmentMethod: string; balanceScore: number }>;
  assumptions: string[];
  limitations: string[];
  methodology: string;
  researchImplications: string[];
  generatedAt: string;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899"];

export default function CohortBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("query");
  const [naturalQuery, setNaturalQuery] = useState("");
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<CohortDefinition | null>(null);
  const [cohortResults, setCohortResults] = useState<PatientMatch[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortDescription, setCohortDescription] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "fhir_bundle">("json");
  const [exportDeIdentified, setExportDeIdentified] = useState(true);
  const [exportFields, setExportFields] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<OutcomePrediction[]>([]);
  const [subpopulations, setSubpopulations] = useState<RiskSubpopulation[]>([]);
  const [comparisons, setComparisons] = useState<CohortComparison[]>([]);
  const [selectedOutcomeType, setSelectedOutcomeType] = useState("hospitalization");
  const [selectedTimeframe, setSelectedTimeframe] = useState(12);
  const [selectedBenchmark, setSelectedBenchmark] = useState("");
  const [patterns, setPatterns] = useState<PatternDiscovery[]>([]);
  const [syntheticData, setSyntheticData] = useState<SyntheticPatientData[]>([]);
  const [causalAnalyses, setCausalAnalyses] = useState<CausalInferenceResult[]>([]);
  const [syntheticCount, setSyntheticCount] = useState(100);
  const [treatmentVariable, setTreatmentVariable] = useState("medication_adherence");
  const [outcomeVariable, setOutcomeVariable] = useState("hospitalization");
  const [causalAnalysisType, setCausalAnalysisType] = useState<CausalInferenceResult["analysisType"]>("propensity_score");

  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery<CohortDefinition[]>({
    queryKey: ["/api/cohort-builder/cohorts"],
  });

  const { data: benchmarks = [] } = useQuery<Benchmark[]>({
    queryKey: ["/api/cohort-builder/benchmarks"],
  });

  const { data: characteristics } = useQuery<CohortCharacteristics>({
    queryKey: ["/api/cohort-builder/cohorts", selectedCohort?.id, "characteristics"],
    enabled: !!selectedCohort?.id && cohortResults.length > 0,
  });

  const { data: refinements } = useQuery<{ suggestions: string[] }>({
    queryKey: ["/api/cohort-builder/cohorts", selectedCohort?.id, "refinements"],
    enabled: !!selectedCohort?.id && cohortResults.length > 0,
  });

  const parseQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/cohort-builder/parse-query", { query });
      return response.json();
    },
    onSuccess: (data: ParsedQuery) => {
      setParsedQuery(data);
      setCohortName(data.suggestedName);
      setCohortDescription(data.description);
      toast({ title: "Query Parsed", description: `Extracted ${countCriteria(data.criteria)} criteria with ${Math.round(data.confidence * 100)}% confidence` });
    },
    onError: () => {
      toast({ title: "Parse Failed", description: "Could not interpret the query", variant: "destructive" });
    },
  });

  const createCohortMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; naturalLanguageQuery: string; criteria: CriteriaGroup }) => {
      const response = await apiRequest("POST", "/api/cohort-builder/cohorts", data);
      return response.json();
    },
    onSuccess: (data: CohortDefinition) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-builder/cohorts"] });
      setSelectedCohort(data);
      setShowCreateDialog(false);
      setParsedQuery(null);
      setNaturalQuery("");
      toast({ title: "Cohort Created", description: `"${data.name}" is ready to execute` });
    },
    onError: () => {
      toast({ title: "Creation Failed", description: "Could not create cohort", variant: "destructive" });
    },
  });

  const executeCohortMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${cohortId}/execute`, {});
      return response.json();
    },
    onSuccess: (data: { matches: PatientMatch[]; count: number }) => {
      setCohortResults(data.matches);
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-builder/cohorts", selectedCohort?.id, "characteristics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-builder/cohorts", selectedCohort?.id, "refinements"] });
      toast({ title: "Cohort Executed", description: `Found ${data.count} matching patients` });
    },
    onError: () => {
      toast({ title: "Execution Failed", description: "Could not execute cohort", variant: "destructive" });
    },
  });

  const exportCohortMutation = useMutation({
    mutationFn: async (data: { cohortId: string; format: string; includeFields: string[]; deIdentified: boolean }) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${data.cohortId}/export`, data);
      return response.json();
    },
    onSuccess: (data) => {
      setShowExportDialog(false);
      if (exportFormat === "csv") {
        const blob = new Blob([data.data as string], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cohort-export-${selectedCohort?.id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cohort-export-${selectedCohort?.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: "Export Complete", description: `Exported ${data.patientCount} patients in ${exportFormat.toUpperCase()} format` });
    },
    onError: () => {
      toast({ title: "Export Failed", description: "Could not export cohort data", variant: "destructive" });
    },
  });

  const deleteCohortMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      await apiRequest("DELETE", `/api/cohort-builder/cohorts/${cohortId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cohort-builder/cohorts"] });
      setSelectedCohort(null);
      setCohortResults([]);
      toast({ title: "Cohort Deleted" });
    },
  });

  const forecastMutation = useMutation({
    mutationFn: async (data: { cohortId: string; outcomeType: string; timeframeMonths: number }) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${data.cohortId}/predictions`, {
        outcomeType: data.outcomeType,
        timeframeMonths: data.timeframeMonths,
      });
      return response.json();
    },
    onSuccess: (data: OutcomePrediction) => {
      setPredictions(prev => [...prev, data]);
      toast({ title: "Forecast Generated", description: `Outcome predictions for ${data.timeframeMonths} months` });
    },
    onError: () => {
      toast({ title: "Forecast Failed", description: "Could not generate predictions", variant: "destructive" });
    },
  });

  const subpopulationMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${cohortId}/subpopulations`, {});
      return response.json();
    },
    onSuccess: (data: RiskSubpopulation[]) => {
      setSubpopulations(data);
      toast({ title: "Subpopulations Identified", description: `Found ${data.length} risk subgroups` });
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not identify subpopulations", variant: "destructive" });
    },
  });

  const comparisonMutation = useMutation({
    mutationFn: async (data: { cohortId: string; comparisonType: string; comparisonSource?: string }) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${data.cohortId}/comparisons`, data);
      return response.json();
    },
    onSuccess: (data: CohortComparison) => {
      setComparisons(prev => [...prev, data]);
      toast({ title: "Comparison Generated", description: `Compared against ${data.comparisonSource} benchmarks` });
    },
    onError: () => {
      toast({ title: "Comparison Failed", description: "Could not generate comparison", variant: "destructive" });
    },
  });

  const patternsMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${cohortId}/patterns`, {});
      return response.json();
    },
    onSuccess: (data: PatternDiscovery) => {
      setPatterns(prev => [...prev, data]);
      toast({ title: "Patterns Discovered", description: `Found ${data.patterns.length} patterns and ${data.clusterAnalysis.length} clusters` });
    },
    onError: () => {
      toast({ title: "Discovery Failed", description: "Could not discover patterns", variant: "destructive" });
    },
  });

  const syntheticDataMutation = useMutation({
    mutationFn: async (data: { cohortId: string; count: number }) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${data.cohortId}/synthetic-data`, { count: data.count });
      return response.json();
    },
    onSuccess: (data: SyntheticPatientData) => {
      setSyntheticData(prev => [...prev, data]);
      toast({ title: "Synthetic Data Generated", description: `Created ${data.syntheticPatients.length} synthetic patients` });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate synthetic data", variant: "destructive" });
    },
  });

  const causalAnalysisMutation = useMutation({
    mutationFn: async (data: { cohortId: string; treatmentVariable: string; outcomeVariable: string; analysisType: string }) => {
      const response = await apiRequest("POST", `/api/cohort-builder/cohorts/${data.cohortId}/causal-analysis`, data);
      return response.json();
    },
    onSuccess: (data: CausalInferenceResult) => {
      setCausalAnalyses(prev => [...prev, data]);
      toast({ title: "Causal Analysis Complete", description: `Estimated effect: ${(data.results.estimatedEffect * 100).toFixed(1)}%` });
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not perform causal analysis", variant: "destructive" });
    },
  });

  function countCriteria(group: CriteriaGroup): number {
    let count = 0;
    for (const item of group.criteria) {
      if ("operator" in item && "criteria" in item) {
        count += countCriteria(item as CriteriaGroup);
      } else {
        count++;
      }
    }
    return count;
  }

  function handleParseQuery() {
    if (!naturalQuery.trim()) return;
    parseQueryMutation.mutate(naturalQuery);
  }

  function handleCreateCohort() {
    if (!parsedQuery || !cohortName.trim()) return;
    createCohortMutation.mutate({
      name: cohortName,
      description: cohortDescription,
      naturalLanguageQuery: naturalQuery,
      criteria: parsedQuery.criteria,
    });
  }

  function handleExecuteCohort() {
    if (!selectedCohort) return;
    executeCohortMutation.mutate(selectedCohort.id);
  }

  function handleExportCohort() {
    if (!selectedCohort) return;
    exportCohortMutation.mutate({
      cohortId: selectedCohort.id,
      format: exportFormat,
      includeFields: exportFields,
      deIdentified: exportDeIdentified,
    });
  }

  function renderCriteria(group: CriteriaGroup, depth: number = 0): JSX.Element {
    return (
      <div className={`space-y-2 ${depth > 0 ? "pl-4 border-l-2 border-muted" : ""}`}>
        <Badge variant="outline">{group.operator}</Badge>
        {group.criteria.map((item, idx) => {
          if ("operator" in item && "criteria" in item) {
            return <div key={idx}>{renderCriteria(item as CriteriaGroup, depth + 1)}</div>;
          }
          const criterion = item as CohortCriterion;
          return (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded" data-testid={`criterion-${criterion.id}`}>
              <Badge variant="secondary">{criterion.type}</Badge>
              <span className="text-sm">{criterion.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              AI Patient Cohort Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Define and analyze patient cohorts using natural language or structured criteria
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <Database className="w-4 h-4 mr-1" />
              {cohorts.length} Cohorts
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Saved Cohorts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {cohortsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : cohorts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No cohorts defined yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cohorts.map((cohort) => (
                        <div
                          key={cohort.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate transition-colors ${selectedCohort?.id === cohort.id ? "border-primary bg-primary/5" : ""}`}
                          {...clickable(() => setSelectedCohort(cohort))}
                          data-testid={`cohort-card-${cohort.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" data-testid={`cohort-name-${cohort.id}`}>{cohort.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{cohort.description}</p>
                            </div>
                            <Badge variant={cohort.status === "active" ? "default" : "secondary"}>
                              {cohort.patientCount ?? "—"}
                            </Badge>
                          </div>
                          {cohort.lastExecutedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last run: {new Date(cohort.lastExecutedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="query" data-testid="tab-query">
                  <Brain className="w-4 h-4 mr-1" />
                  Query
                </TabsTrigger>
                <TabsTrigger value="results" data-testid="tab-results">
                  <Users className="w-4 h-4 mr-1" />
                  Results
                </TabsTrigger>
                <TabsTrigger value="visualizations" data-testid="tab-visualizations">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Charts
                </TabsTrigger>
                <TabsTrigger value="predictions" data-testid="tab-predictions">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Predict
                </TabsTrigger>
                <TabsTrigger value="advanced" data-testid="tab-advanced">
                  <FlaskConical className="w-4 h-4 mr-1" />
                  Advanced
                </TabsTrigger>
                <TabsTrigger value="comparisons" data-testid="tab-comparisons">
                  <Scale className="w-4 h-4 mr-1" />
                  Compare
                </TabsTrigger>
                <TabsTrigger value="export" data-testid="tab-export">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </TabsTrigger>
              </TabsList>

              <TabsContent value="query" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Natural Language Query
                    </CardTitle>
                    <CardDescription>
                      Describe the patient cohort you want to find in plain language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="natural-query">Describe your cohort</Label>
                      <Textarea
                        id="natural-query"
                        placeholder="Example: Patients over 65 with diabetes and hypertension who had an encounter in the last year"
                        value={naturalQuery}
                        onChange={(e) => setNaturalQuery(e.target.value)}
                        className="min-h-[100px]"
                        data-testid="input-natural-query"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleParseQuery} disabled={parseQueryMutation.isPending || !naturalQuery.trim()} data-testid="button-parse-query">
                        {parseQueryMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        Parse Query
                      </Button>
                      {parsedQuery && (
                        <Button variant="secondary" onClick={() => setShowCreateDialog(true)} data-testid="button-create-cohort">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Cohort
                        </Button>
                      )}
                    </div>

                    {parsedQuery && (
                      <div className="space-y-4 mt-6">
                        <div className="p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">AI Interpretation</h4>
                            <Badge variant="outline" data-testid="text-confidence">
                              {Math.round(parsedQuery.confidence * 100)}% Confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid="text-interpretation">{parsedQuery.interpretation}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Extracted Criteria</h4>
                          {renderCriteria(parsedQuery.criteria)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedCohort && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Eye className="w-5 h-5" />
                          {selectedCohort.name}
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleExecuteCohort} disabled={executeCohortMutation.isPending} data-testid="button-execute-cohort">
                            {executeCohortMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteCohortMutation.mutate(selectedCohort.id)} data-testid="button-delete-cohort">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardTitle>
                      <CardDescription>{selectedCohort.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <FieldCaption className="text-xs text-muted-foreground">Original Query</FieldCaption>
                          <p className="text-sm" data-testid="text-original-query">{selectedCohort.naturalLanguageQuery || "No query specified"}</p>
                        </div>
                        <div>
                          <FieldCaption className="text-xs text-muted-foreground">Criteria</FieldCaption>
                          {renderCriteria(selectedCohort.criteria)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="results" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Matching Patients
                      </span>
                      <Badge variant="secondary" data-testid="text-patient-count">{cohortResults.length} patients</Badge>
                    </CardTitle>
                    {refinements?.suggestions && refinements.suggestions.length > 0 && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 mt-0.5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Refinement Suggestions</p>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                              {refinements.suggestions.map((s, i) => (
                                <li key={i} data-testid={`suggestion-${i}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {cohortResults.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No results yet. Execute a cohort to see matching patients.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {cohortResults.map((patient) => (
                            <div key={patient.patientId} className="p-4 border rounded-lg" data-testid={`patient-card-${patient.patientId}`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium" data-testid={`patient-name-${patient.patientId}`}>{patient.patientName}</span>
                                    <Badge variant="outline">{patient.demographics.age}y, {patient.demographics.gender}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{patient.demographics.location}</p>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {patient.conditions.slice(0, 3).map((c, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                                    ))}
                                    {patient.conditions.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">+{patient.conditions.length - 3} more</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-primary" data-testid={`match-score-${patient.patientId}`}>
                                    {Math.round(patient.matchScore * 100)}%
                                  </div>
                                  <p className="text-xs text-muted-foreground">Match</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="visualizations" className="mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Age Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {characteristics?.demographics.ageDistribution ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={characteristics.demographics.ageDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                          Execute a cohort to see visualizations
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Gender Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {characteristics?.demographics.genderDistribution ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={characteristics.demographics.genderDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ gender, percentage }) => `${gender} ${percentage}%`}
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="count"
                            >
                              {characteristics.demographics.genderDistribution.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {characteristics?.conditions && characteristics.conditions.length > 0 ? (
                        <div className="space-y-2">
                          {characteristics.conditions.slice(0, 5).map((c, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="truncate flex-1">{c.condition}</span>
                                <span className="text-muted-foreground ml-2">{c.percentage}%</span>
                              </div>
                              <Progress value={c.percentage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Medications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {characteristics?.medications && characteristics.medications.length > 0 ? (
                        <div className="space-y-2">
                          {characteristics.medications.slice(0, 5).map((m, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="truncate flex-1">{m.medication}</span>
                                <span className="text-muted-foreground ml-2">{m.percentage}%</span>
                              </div>
                              <Progress value={m.percentage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Journey Patterns</CardTitle>
                      <CardDescription>Common care pathway patterns identified in this cohort</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {characteristics?.journeyPatterns && characteristics.journeyPatterns.length > 0 ? (
                        <div className="grid md:grid-cols-3 gap-4">
                          {characteristics.journeyPatterns.map((p, i) => (
                            <div key={i} className="p-4 border rounded-lg" data-testid={`journey-pattern-${i}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <ChevronRight className="w-4 h-4 text-primary" />
                                <span className="font-medium">{p.pattern.replace("_", " ")}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                              <Badge variant="secondary">{p.count} patients</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No journey patterns detected
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="predictions" className="mt-4">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Outcome Predictions
                      </CardTitle>
                      <CardDescription>
                        AI-powered forecasting of patient outcomes for research and operational planning
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedCohort || cohortResults.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Execute a cohort to enable predictive analytics</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-outcome-type">Outcome Type</Label>
                              <Select value={selectedOutcomeType} onValueChange={setSelectedOutcomeType}>
                                <SelectTrigger id="cohort-builder-outcome-type" data-testid="select-outcome-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hospitalization">Hospitalization</SelectItem>
                                  <SelectItem value="emergency_visits">Emergency Visits</SelectItem>
                                  <SelectItem value="readmission">Readmission</SelectItem>
                                  <SelectItem value="general">General Outcomes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-timeframe-months">Timeframe (months)</Label>
                              <Select value={String(selectedTimeframe)} onValueChange={(v) => setSelectedTimeframe(Number(v))}>
                                <SelectTrigger id="cohort-builder-timeframe-months" data-testid="select-timeframe">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="6">6 months</SelectItem>
                                  <SelectItem value="12">12 months</SelectItem>
                                  <SelectItem value="24">24 months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                onClick={() => forecastMutation.mutate({
                                  cohortId: selectedCohort.id,
                                  outcomeType: selectedOutcomeType,
                                  timeframeMonths: selectedTimeframe,
                                })}
                                disabled={forecastMutation.isPending}
                                data-testid="button-generate-forecast"
                              >
                                {forecastMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                                Generate Forecast
                              </Button>
                            </div>
                          </div>

                          {predictions.length > 0 && (
                            <div className="space-y-4 mt-6">
                              {predictions.filter(p => p.cohortId === selectedCohort.id).slice(-1).map((prediction) => (
                                <div key={prediction.id} className="space-y-4">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Outcome Probabilities</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="h-[200px]">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={prediction.predictions}>
                                              <CartesianGrid strokeDasharray="3 3" />
                                              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                                              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                                              <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                                              <Bar dataKey="probability" fill="#3b82f6" />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Risk Factors</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-2">
                                          {prediction.riskFactors.map((rf, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border rounded" data-testid={`risk-factor-${i}`}>
                                              <span className="text-sm">{rf.factor}</span>
                                              <Badge variant={rf.impact === "high" ? "destructive" : rf.impact === "medium" ? "default" : "secondary"}>
                                                {rf.impact}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                        Methodology & Limitations
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm text-muted-foreground mb-2">{prediction.methodology}</p>
                                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                                        {prediction.limitations.map((l, i) => (
                                          <li key={i}>{l}</li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Risk Subpopulations
                      </CardTitle>
                      <CardDescription>
                        Identify patient subgroups with specific risk factors
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!selectedCohort || cohortResults.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>Execute a cohort first</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Button
                            onClick={() => subpopulationMutation.mutate(selectedCohort.id)}
                            disabled={subpopulationMutation.isPending}
                            data-testid="button-identify-subpopulations"
                          >
                            {subpopulationMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                            Identify Subpopulations
                          </Button>

                          {subpopulations.length > 0 && (
                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                              {subpopulations.map((subpop) => (
                                <Card key={subpop.id} className={`${subpop.riskLevel === "high" ? "border-red-500" : subpop.riskLevel === "medium" ? "border-yellow-500" : "border-green-500"}`} data-testid={`subpopulation-${subpop.id}`}>
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <CardTitle className="text-sm">{subpop.name}</CardTitle>
                                      <Badge variant={subpop.riskLevel === "high" ? "destructive" : subpop.riskLevel === "medium" ? "default" : "secondary"}>
                                        {subpop.riskLevel} risk
                                      </Badge>
                                    </div>
                                    <CardDescription className="text-xs">{subpop.description}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-sm">
                                        <span>Patients:</span>
                                        <Badge variant="outline">{subpop.patientCount}</Badge>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span>Avg Age:</span>
                                        <span>{subpop.characteristics.avgAge}</span>
                                      </div>
                                      <div className="mt-2">
                                        <span className="text-xs text-muted-foreground">Top conditions:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {subpop.characteristics.topConditions.slice(0, 3).map((c, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-4">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Network className="w-5 h-5" />
                        Pattern Discovery
                      </CardTitle>
                      <CardDescription>
                        AI-powered discovery of hidden patterns and correlations within the cohort
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedCohort || cohortResults.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Execute a cohort to enable pattern discovery</p>
                        </div>
                      ) : (
                        <>
                          <Button
                            onClick={() => patternsMutation.mutate(selectedCohort.id)}
                            disabled={patternsMutation.isPending}
                            data-testid="button-discover-patterns"
                          >
                            {patternsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Microscope className="w-4 h-4 mr-2" />}
                            Discover Patterns
                          </Button>

                          {patterns.filter(p => p.cohortId === selectedCohort.id).length > 0 && (
                            <div className="space-y-4 mt-4">
                              {patterns.filter(p => p.cohortId === selectedCohort.id).slice(-1).map((discovery) => (
                                <div key={discovery.id} className="space-y-4">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Discovered Patterns</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-2">
                                          {discovery.patterns.map((pattern, i) => (
                                            <div key={i} className="p-2 border rounded" data-testid={`pattern-${i}`}>
                                              <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{pattern.name}</span>
                                                <Badge variant={pattern.type === "correlation" ? "default" : pattern.type === "cluster" ? "secondary" : "outline"}>
                                                  {pattern.type}
                                                </Badge>
                                              </div>
                                              <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                                              <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                  Strength: {(pattern.strength * 100).toFixed(0)}%
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                  {pattern.affectedPatients} patients
                                                </Badge>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Correlation Matrix</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-2">
                                          {discovery.correlationMatrix.map((corr, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border rounded" data-testid={`correlation-${i}`}>
                                              <span className="text-xs">{corr.variable1} ↔ {corr.variable2}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{corr.correlation.toFixed(2)}</span>
                                                <Badge variant={corr.significance === "significant" ? "default" : "outline"} className="text-xs">
                                                  p={corr.pValue.toFixed(3)}
                                                </Badge>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  {discovery.clusterAnalysis.length > 0 && (
                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Cluster Analysis</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          {discovery.clusterAnalysis.map((cluster, i) => (
                                            <div key={i} className="p-3 border rounded" data-testid={`cluster-${i}`}>
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-sm">{cluster.name}</span>
                                                <Badge variant="secondary">{cluster.size} patients</Badge>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {cluster.characteristics.map((char, j) => (
                                                  <Badge key={j} variant="outline" className="text-xs">{char}</Badge>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shuffle className="w-5 h-5" />
                        Synthetic Data Generation
                      </CardTitle>
                      <CardDescription>
                        Generate privacy-preserving synthetic patient data for testing and research
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedCohort || cohortResults.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Shuffle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Execute a cohort to generate synthetic data</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-end gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-number-of-synthetic-patients">Number of Synthetic Patients</Label>
                              <Input id="cohort-builder-number-of-synthetic-patients"
                                type="number"
                                min={10}
                                max={500}
                                value={syntheticCount}
                                onChange={(e) => setSyntheticCount(Number(e.target.value))}
                                className="w-32"
                                data-testid="input-synthetic-count"
                              />
                            </div>
                            <Button
                              onClick={() => syntheticDataMutation.mutate({ cohortId: selectedCohort.id, count: syntheticCount })}
                              disabled={syntheticDataMutation.isPending}
                              data-testid="button-generate-synthetic"
                            >
                              {syntheticDataMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Beaker className="w-4 h-4 mr-2" />}
                              Generate Synthetic Data
                            </Button>
                          </div>

                          {syntheticData.filter(s => s.cohortId === selectedCohort.id).length > 0 && (
                            <div className="space-y-4 mt-4">
                              {syntheticData.filter(s => s.cohortId === selectedCohort.id).slice(-1).map((data) => (
                                <div key={data.id} className="space-y-4">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Shield className="w-4 h-4 text-green-500" />
                                          Privacy Guarantees
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <ul className="text-sm space-y-1">
                                          {data.privacyGuarantees.map((g, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                              <ChevronRight className="w-4 h-4 mt-0.5 text-green-500" />
                                              <span>{g}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Validation Metrics</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="flex justify-between text-sm mb-1">
                                              <span>Demographic Fidelity</span>
                                              <span>{(data.validationMetrics.demographicFidelity * 100).toFixed(0)}%</span>
                                            </div>
                                            <Progress value={data.validationMetrics.demographicFidelity * 100} />
                                          </div>
                                          <div>
                                            <div className="flex justify-between text-sm mb-1">
                                              <span>Condition Distribution</span>
                                              <span>{(data.validationMetrics.conditionDistributionMatch * 100).toFixed(0)}%</span>
                                            </div>
                                            <Progress value={data.validationMetrics.conditionDistributionMatch * 100} />
                                          </div>
                                          <div>
                                            <div className="flex justify-between text-sm mb-1">
                                              <span>Medication Distribution</span>
                                              <span>{(data.validationMetrics.medicationDistributionMatch * 100).toFixed(0)}%</span>
                                            </div>
                                            <Progress value={data.validationMetrics.medicationDistributionMatch * 100} />
                                          </div>
                                          <div className="pt-2 border-t">
                                            <div className="flex justify-between text-sm font-medium">
                                              <span>Overall Quality</span>
                                              <Badge variant={data.validationMetrics.overallQuality > 0.7 ? "default" : "secondary"}>
                                                {(data.validationMetrics.overallQuality * 100).toFixed(0)}%
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Sample Synthetic Patients ({data.syntheticPatients.length} generated)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <ScrollArea className="h-[200px]">
                                        <div className="space-y-2">
                                          {data.syntheticPatients.slice(0, 10).map((patient, i) => (
                                            <div key={i} className="p-2 border rounded text-sm" data-testid={`synthetic-patient-${i}`}>
                                              <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs text-muted-foreground">{patient.syntheticId}</span>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="outline">{patient.demographics.age}y</Badge>
                                                  <Badge variant="outline">{patient.demographics.gender}</Badge>
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {patient.conditions.slice(0, 3).map((c, j) => (
                                                  <Badge key={j} variant="secondary" className="text-xs">{c}</Badge>
                                                ))}
                                                {patient.conditions.length > 3 && (
                                                  <Badge variant="outline" className="text-xs">+{patient.conditions.length - 3}</Badge>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </CardContent>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5" />
                        Causal Inference Analysis
                      </CardTitle>
                      <CardDescription>
                        Analyze treatment effectiveness within the cohort (for research purposes only)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedCohort || cohortResults.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Execute a cohort to enable causal analysis</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-treatment-variable">Treatment Variable</Label>
                              <Select value={treatmentVariable} onValueChange={setTreatmentVariable}>
                                <SelectTrigger id="cohort-builder-treatment-variable" data-testid="select-treatment-variable">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="medication_adherence">Medication Adherence</SelectItem>
                                  <SelectItem value="preventive_care">Preventive Care</SelectItem>
                                  <SelectItem value="care_management">Care Management</SelectItem>
                                  <SelectItem value="telehealth_utilization">Telehealth Utilization</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-outcome-variable">Outcome Variable</Label>
                              <Select value={outcomeVariable} onValueChange={setOutcomeVariable}>
                                <SelectTrigger id="cohort-builder-outcome-variable" data-testid="select-outcome-variable">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hospitalization">Hospitalization</SelectItem>
                                  <SelectItem value="emergency_visits">Emergency Visits</SelectItem>
                                  <SelectItem value="readmission">Readmission</SelectItem>
                                  <SelectItem value="quality_score">Quality Score</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cohort-builder-analysis-type">Analysis Type</Label>
                              <Select value={causalAnalysisType} onValueChange={(v) => setCausalAnalysisType(v as CausalInferenceResult["analysisType"])}>
                                <SelectTrigger id="cohort-builder-analysis-type" data-testid="select-analysis-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="propensity_score">Propensity Score</SelectItem>
                                  <SelectItem value="difference_in_differences">Difference-in-Differences</SelectItem>
                                  <SelectItem value="instrumental_variable">Instrumental Variable</SelectItem>
                                  <SelectItem value="regression_discontinuity">Regression Discontinuity</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                onClick={() => causalAnalysisMutation.mutate({
                                  cohortId: selectedCohort.id,
                                  treatmentVariable,
                                  outcomeVariable,
                                  analysisType: causalAnalysisType,
                                })}
                                disabled={causalAnalysisMutation.isPending}
                                data-testid="button-run-causal-analysis"
                              >
                                {causalAnalysisMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                                Run Analysis
                              </Button>
                            </div>
                          </div>

                          {causalAnalyses.filter(c => c.cohortId === selectedCohort.id).length > 0 && (
                            <div className="space-y-4 mt-4">
                              {causalAnalyses.filter(c => c.cohortId === selectedCohort.id).slice(-1).map((analysis) => (
                                <div key={analysis.id} className="space-y-4">
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">
                                        Effect of {analysis.treatmentVariable.replace("_", " ")} on {analysis.outcomeVariable.replace("_", " ")}
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid md:grid-cols-3 gap-4">
                                        <div className="text-center p-4 border rounded">
                                          <p className="text-3xl font-bold text-primary">
                                            {analysis.results.estimatedEffect > 0 ? "+" : ""}{(analysis.results.estimatedEffect * 100).toFixed(1)}%
                                          </p>
                                          <p className="text-sm text-muted-foreground">Estimated Effect</p>
                                        </div>
                                        <div className="text-center p-4 border rounded">
                                          <p className="text-lg font-medium">
                                            [{(analysis.results.confidenceInterval[0] * 100).toFixed(1)}%, {(analysis.results.confidenceInterval[1] * 100).toFixed(1)}%]
                                          </p>
                                          <p className="text-sm text-muted-foreground">95% Confidence Interval</p>
                                        </div>
                                        <div className="text-center p-4 border rounded">
                                          <Badge variant={analysis.results.pValue < 0.05 ? "default" : "secondary"} className="text-lg px-3 py-1">
                                            p = {analysis.results.pValue.toFixed(3)}
                                          </Badge>
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {analysis.results.pValue < 0.05 ? "Statistically Significant" : "Not Significant"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex justify-center gap-8 mt-4 text-sm text-muted-foreground">
                                        <span>Treatment Group: {analysis.results.treatmentGroup}</span>
                                        <span>Control Group: {analysis.results.controlGroup}</span>
                                        <span>Total Sample: {analysis.results.sampleSize}</span>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <div className="grid md:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Confounders Adjusted</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-2">
                                          {analysis.confounders.map((conf, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border rounded" data-testid={`confounder-${i}`}>
                                              <span className="text-sm">{conf.variable}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{conf.adjustmentMethod}</span>
                                                <Badge variant={conf.balanceScore > 0.9 ? "default" : "secondary"}>
                                                  {(conf.balanceScore * 100).toFixed(0)}%
                                                </Badge>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Research Implications</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <ul className="text-sm space-y-1">
                                          {analysis.researchImplications.map((impl, i) => (
                                            <li key={i} className="flex items-start gap-2" data-testid={`implication-${i}`}>
                                              <Lightbulb className="w-4 h-4 mt-0.5 text-yellow-500" />
                                              <span>{impl}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                        Assumptions & Limitations
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-medium mb-2">Key Assumptions</p>
                                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                                            {analysis.assumptions.map((a, i) => (
                                              <li key={i}>{a}</li>
                                            ))}
                                          </ul>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium mb-2">Limitations</p>
                                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                                            {analysis.limitations.map((l, i) => (
                                              <li key={i}>{l}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="comparisons" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5" />
                      Cohort Comparisons
                    </CardTitle>
                    <CardDescription>
                      Compare cohort metrics against benchmarks and historical data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedCohort || cohortResults.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Scale className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Execute a cohort to enable comparisons</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cohort-builder-benchmark-source">Benchmark Source</Label>
                            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
                              <SelectTrigger id="cohort-builder-benchmark-source" data-testid="select-benchmark">
                                <SelectValue placeholder="Select benchmark" />
                              </SelectTrigger>
                              <SelectContent>
                                {benchmarks.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              onClick={() => comparisonMutation.mutate({
                                cohortId: selectedCohort.id,
                                comparisonType: "benchmark",
                                comparisonSource: selectedBenchmark || undefined,
                              })}
                              disabled={comparisonMutation.isPending}
                              data-testid="button-generate-comparison"
                            >
                              {comparisonMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
                              Generate Comparison
                            </Button>
                          </div>
                        </div>

                        {comparisons.filter(c => c.cohortId === selectedCohort.id).length > 0 && (
                          <div className="space-y-4 mt-6">
                            {comparisons.filter(c => c.cohortId === selectedCohort.id).slice(-1).map((comparison) => (
                              <div key={comparison.id} className="space-y-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Metrics Comparison vs {comparison.comparisonSource.replace("_", " ")}</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      {comparison.metrics.map((metric, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 border rounded" data-testid={`comparison-metric-${i}`}>
                                          <span className="text-sm font-medium">{metric.name}</span>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <div className="text-sm">
                                                <span className="text-muted-foreground">Cohort: </span>
                                                <span className="font-medium">{(metric.cohortValue * 100).toFixed(1)}%</span>
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                Benchmark: {(metric.comparisonValue * 100).toFixed(1)}%
                                              </div>
                                            </div>
                                            <Badge variant={metric.significance === "significant" ? (metric.difference > 0 ? "destructive" : "default") : "outline"}>
                                              {metric.differencePercent > 0 ? "+" : ""}{metric.differencePercent.toFixed(1)}%
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>

                                <div className="grid md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" />
                                        Key Insights
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="text-sm space-y-1">
                                        {comparison.insights.map((insight, i) => (
                                          <li key={i} className="flex items-start gap-2" data-testid={`insight-${i}`}>
                                            <ChevronRight className="w-4 h-4 mt-0.5 text-primary" />
                                            <span>{insight}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Operational Recommendations
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="text-sm space-y-1">
                                        {comparison.recommendations.map((rec, i) => (
                                          <li key={i} className="flex items-start gap-2" data-testid={`recommendation-${i}`}>
                                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-500" />
                                            <span>{rec}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="export" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Export Cohort Data
                    </CardTitle>
                    <CardDescription>
                      Export patient cohort data for research and analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!selectedCohort || cohortResults.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Select and execute a cohort to enable export</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid md:grid-cols-3 gap-4">
                          <Card className={`cursor-pointer transition-all ${exportFormat === "csv" ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => setExportFormat("csv")} data-testid="card-format-csv">
                            <CardContent className="pt-6 text-center">
                              <FileText className="w-8 h-8 mx-auto mb-2 text-green-600" />
                              <h4 className="font-medium">CSV</h4>
                              <p className="text-xs text-muted-foreground">Spreadsheet format</p>
                            </CardContent>
                          </Card>
                          <Card className={`cursor-pointer transition-all ${exportFormat === "json" ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => setExportFormat("json")} data-testid="card-format-json">
                            <CardContent className="pt-6 text-center">
                              <FileJson className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                              <h4 className="font-medium">JSON</h4>
                              <p className="text-xs text-muted-foreground">Structured data</p>
                            </CardContent>
                          </Card>
                          <Card className={`cursor-pointer transition-all ${exportFormat === "fhir_bundle" ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => setExportFormat("fhir_bundle")} data-testid="card-format-fhir">
                            <CardContent className="pt-6 text-center">
                              <Database className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                              <h4 className="font-medium">FHIR Bundle</h4>
                              <p className="text-xs text-muted-foreground">Healthcare standard</p>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox id="deidentified" checked={exportDeIdentified} onCheckedChange={(v) => setExportDeIdentified(v as boolean)} data-testid="checkbox-deidentified" />
                          <Label htmlFor="deidentified">De-identify patient data (recommended for research)</Label>
                        </div>

                        <div className="space-y-2">
                          <FieldCaption>Include Fields</FieldCaption>
                          <div className="flex flex-wrap gap-2">
                            {["patientId", "patientName", "age", "gender", "location", "conditions", "medications", "procedures", "matchScore"].map((field) => (
                              <Badge
                                key={field}
                                variant={exportFields.includes(field) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => {
                                  if (exportFields.includes(field)) {
                                    setExportFields(exportFields.filter((f) => f !== field));
                                  } else {
                                    setExportFields([...exportFields, field]);
                                  }
                                }}
                                data-testid={`field-${field}`}
                              >
                                {field}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">Leave empty to include all fields</p>
                        </div>

                        <Button className="w-full" onClick={handleExportCohort} disabled={exportCohortMutation.isPending} data-testid="button-export">
                          {exportCohortMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                          Export {cohortResults.length} Patients
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Cohort</DialogTitle>
              <DialogDescription>Save this cohort definition for future use</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cohort-name">Cohort Name</Label>
                <Input id="cohort-name" value={cohortName} onChange={(e) => setCohortName(e.target.value)} placeholder="e.g., Diabetic Seniors" data-testid="input-cohort-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cohort-desc">Description</Label>
                <Textarea id="cohort-desc" value={cohortDescription} onChange={(e) => setCohortDescription(e.target.value)} placeholder="Describe the purpose of this cohort..." data-testid="input-cohort-desc" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button onClick={handleCreateCohort} disabled={createCohortMutation.isPending || !cohortName.trim()} data-testid="button-confirm-create">
                {createCohortMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Cohort
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
