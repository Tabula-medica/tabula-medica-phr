import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  GitMerge, 
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileCode,
  Layers,
  RefreshCw,
  Lightbulb,
  ClipboardCheck,
  Activity,
  History,
  Zap,
  Target,
  Shield,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ConceptMapping {
  id: string;
  sourceCode: string;
  sourceSystem: string;
  sourceDisplay: string;
  targetCode: string;
  targetSystem: string;
  targetDisplay: string;
  equivalence: string;
  confidence: string;
  confidenceScore: number;
  rationale: string;
  validatedBy?: string;
}

interface DataCleansingResult {
  id: string;
  resourceType: string;
  resourceId: string;
  originalValue: any;
  cleanedValue: any;
  fieldPath: string;
  action: string;
  issueType: string;
  description: string;
  confidence: number;
  applied: boolean;
}

interface ProfileSuggestion {
  id: string;
  resourceType: string;
  suggestedProfile: string;
  profileUrl: string;
  profileVersion: string;
  rationale: string;
  compatibilityScore: number;
  requiredTransformations: { fieldPath: string; transformation: string; complexity: string }[];
}

interface HarmonizationSession {
  id: string;
  name: string;
  status: string;
  resourceCount: number;
  conceptMappings: ConceptMapping[];
  cleansingResults: DataCleansingResult[];
  profileSuggestions: ProfileSuggestion[];
  summary: {
    totalResources: number;
    conceptsMapped: number;
    conceptsUnmapped: number;
    issuesCleansed: number;
    profilesRecommended: number;
    overallQualityScore: number;
    aiInsights: string[];
    recommendations: string[];
    disclaimer: string;
  };
  createdAt: string;
  completedAt?: string;
}

export function FHIRDataHarmonizationDashboard() {
  const [activeTab, setActiveTab] = useState("harmonize");
  const [resourceJson, setResourceJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<HarmonizationSession | null>(null);
  const [sourceCode, setSourceCode] = useState("");
  const [sourceSystem, setSourceSystem] = useState("snomed_ct");
  const [targetSystem, setTargetSystem] = useState("icd10");
  const { toast } = useToast();

  const { data: statsData } = useQuery<{ supportedSystems: string[]; cachedMappings: number; predefinedMappings: number }>({
    queryKey: ["/api/fhir-data-harmonization/stats"],
  });

  const { data: sessionsData, refetch: refetchSessions } = useQuery<{ sessions: HarmonizationSession[] }>({
    queryKey: ["/api/fhir-data-harmonization/sessions"],
  });

  const { data: profilesData } = useQuery<{ profiles: ProfileSuggestion[] }>({
    queryKey: ["/api/fhir-data-harmonization/profiles"],
  });

  // Auto-select the most recent session on load
  useEffect(() => {
    if (sessionsData?.sessions && sessionsData.sessions.length > 0 && !selectedSession) {
      const latestSession = sessionsData.sessions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (latestSession.status === "completed") {
        setSelectedSession(latestSession);
      }
    }
  }, [sessionsData, selectedSession]);

  const createSessionMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; fhirResources: any[] }) => {
      const response = await apiRequest("POST", "/api/fhir-data-harmonization/sessions", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedSession(data.session);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-harmonization/sessions"] });
      toast({ title: "Session Created", description: "Harmonization analysis is in progress." });
      setActiveTab("results");
      pollSession(data.session.id);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const mapConceptMutation = useMutation({
    mutationFn: async (data: { sourceCode: string; sourceSystem: string; sourceDisplay: string; targetSystem: string }) => {
      const response = await apiRequest("POST", "/api/fhir-data-harmonization/map-concept", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Mapping Complete", description: `Mapped to ${data.mapping.targetDisplay}` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const loadSampleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-data-harmonization/generate-sample", {});
      return response.json();
    },
    onSuccess: (data) => {
      setResourceJson(JSON.stringify(data.resources, null, 2));
      toast({ title: "Sample Loaded", description: `Loaded ${data.resources.length} sample resources.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pollSession = async (sessionId: string) => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/fhir-data-harmonization/sessions/${sessionId}`);
        const data = await response.json();
        if (data.session) {
          setSelectedSession(data.session);
          return data.session.status === "completed" || data.session.status === "failed";
        }
      } catch (e) {
        return true;
      }
      return false;
    };

    // Immediate fetch after short delay
    await new Promise(resolve => setTimeout(resolve, 500));
    if (await fetchSession()) {
      refetchSessions();
      return;
    }

    // Then poll every 1 second
    const interval = setInterval(async () => {
      if (await fetchSession()) {
        clearInterval(interval);
        refetchSessions();
      }
    }, 1000);
  };

  const handleStartHarmonization = () => {
    try {
      const resources = JSON.parse(resourceJson);
      if (!Array.isArray(resources)) {
        setJsonError("Input must be a JSON array of FHIR resources");
        return;
      }
      setJsonError(null);
      createSessionMutation.mutate({
        name: "AI Harmonization Session",
        description: "Automated FHIR data harmonization",
        fhirResources: resources
      });
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  const handleQuickMap = () => {
    if (!sourceCode) {
      toast({ title: "Error", description: "Please enter a source code", variant: "destructive" });
      return;
    }
    mapConceptMutation.mutate({ sourceCode, sourceSystem, sourceDisplay: "", targetSystem });
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" data-testid="badge-high-confidence">High</Badge>;
    if (score >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" data-testid="badge-medium-confidence">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" data-testid="badge-low-confidence">Low</Badge>;
  };

  const getEquivalenceBadge = (eq: string) => {
    const colors: Record<string, string> = {
      equivalent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      wider: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      narrower: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      related: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      unmatched: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
    return <Badge className={colors[eq] || colors.unmatched} data-testid={`badge-equivalence-${eq}`}>{eq}</Badge>;
  };

  const sessions = sessionsData?.sessions || [];
  const profiles = profilesData?.profiles || [];

  return (
    <div className="space-y-6" data-testid="page-data-harmonization">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <GitMerge className="h-6 w-6" />
            AI FHIR Data Harmonization
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Harmonize FHIR data with AI-powered concept mapping, cleansing, and profile suggestions
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-systems-count">
            <Layers className="h-3 w-3" /> {statsData?.supportedSystems?.length || 8} Terminologies
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-ai-powered">
            <Sparkles className="h-3 w-3" /> AI Powered
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="harmonize" data-testid="tab-harmonize">
            <GitMerge className="h-4 w-4 mr-2" />
            Harmonize
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results" disabled={!selectedSession}>
            <Activity className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <Target className="h-4 w-4 mr-2" />
            Quick Map
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileCode className="h-4 w-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="harmonize" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-feature-mapping">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-mapping-title">
                  <Target className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Concept Mapping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-mapping-description">
                  Map concepts across SNOMED CT, LOINC, ICD-10, RxNorm, and more
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-feature-cleansing">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-cleansing-title">
                  <Zap className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  Data Cleansing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-cleansing-description">
                  Intelligent standardization and quality improvement
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-feature-profiles">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-profiles-title">
                  <FileCode className="h-4 w-4 text-green-500 dark:text-green-400" />
                  Profile Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-profiles-description">
                  Recommend canonical FHIR profiles for normalization
                </p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-harmonization-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-input-title">
                <Sparkles className="h-5 w-5" />
                Start Harmonization
              </CardTitle>
              <CardDescription data-testid="text-input-description">
                Provide FHIR resources to analyze for harmonization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fhir-data-harmonization--fhir-resources-json-array" data-testid="label-fhir-resources">FHIR Resources (JSON Array)</Label>
                <Textarea id="fhir-data-harmonization--fhir-resources-json-array"
                  placeholder='[{"resourceType": "Patient", ...}, {"resourceType": "Condition", ...}]'
                  className={`font-mono text-sm ${jsonError ? "border-destructive" : ""}`}
                  rows={10}
                  value={resourceJson}
                  onChange={(e) => { setResourceJson(e.target.value); setJsonError(null); }}
                  data-testid="textarea-fhir-resources"
                />
                {jsonError && (
                  <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-json-error">
                    <AlertTriangle className="h-4 w-4" />
                    {jsonError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleStartHarmonization}
                  disabled={createSessionMutation.isPending || !resourceJson.trim()}
                  data-testid="button-start-harmonization"
                >
                  {createSessionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <GitMerge className="h-4 w-4 mr-2" />
                  )}
                  Start Harmonization
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadSampleMutation.mutate()}
                  disabled={loadSampleMutation.isPending}
                  data-testid="button-load-sample"
                >
                  {loadSampleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Load Sample Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {selectedSession && (
            <>
              <Card data-testid="card-session-summary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2" data-testid="text-session-title">
                        {selectedSession.name}
                        {selectedSession.status === "analyzing" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {selectedSession.status === "completed" && <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
                      </CardTitle>
                      <CardDescription data-testid="text-session-status">
                        Status: {selectedSession.status} | {selectedSession.resourceCount} resources
                      </CardDescription>
                    </div>
                    <Badge variant={selectedSession.status === "completed" ? "default" : "secondary"} data-testid="badge-session-status">
                      {selectedSession.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedSession.status === "completed" && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center p-3 rounded bg-muted/50" data-testid="stat-quality-score">
                          <div className="text-2xl font-bold">{Math.round(selectedSession.summary.overallQualityScore * 100)}%</div>
                          <div className="text-xs text-muted-foreground">Quality Score</div>
                        </div>
                        <div className="text-center p-3 rounded bg-muted/50" data-testid="stat-mapped">
                          <div className="text-2xl font-bold">{selectedSession.summary.conceptsMapped}</div>
                          <div className="text-xs text-muted-foreground">Mapped</div>
                        </div>
                        <div className="text-center p-3 rounded bg-muted/50" data-testid="stat-unmapped">
                          <div className="text-2xl font-bold">{selectedSession.summary.conceptsUnmapped}</div>
                          <div className="text-xs text-muted-foreground">Unmapped</div>
                        </div>
                        <div className="text-center p-3 rounded bg-muted/50" data-testid="stat-issues">
                          <div className="text-2xl font-bold">{selectedSession.summary.issuesCleansed}</div>
                          <div className="text-xs text-muted-foreground">Issues Found</div>
                        </div>
                        <div className="text-center p-3 rounded bg-muted/50" data-testid="stat-profiles">
                          <div className="text-2xl font-bold">{selectedSession.summary.profilesRecommended}</div>
                          <div className="text-xs text-muted-foreground">Profiles</div>
                        </div>
                      </div>

                      <Progress value={selectedSession.summary.overallQualityScore * 100} className="h-2" data-testid="progress-quality" />
                    </>
                  )}
                </CardContent>
              </Card>

              {selectedSession.status === "completed" && selectedSession.conceptMappings.length > 0 && (
                <Card data-testid="card-concept-mappings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-mappings-title">
                      <Target className="h-5 w-5" />
                      Concept Mappings ({selectedSession.conceptMappings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3" data-testid="container-mappings">
                    {selectedSession.conceptMappings.slice(0, 10).map(mapping => (
                      <Card key={mapping.id} className="bg-muted/30" data-testid={`card-mapping-${mapping.id}`}>
                        <CardContent className="py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                              <div className="text-sm font-medium" data-testid={`text-source-${mapping.id}`}>{mapping.sourceDisplay}</div>
                              <div className="text-xs text-muted-foreground">{mapping.sourceSystem}: {mapping.sourceCode}</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-[200px]">
                              <div className="text-sm font-medium" data-testid={`text-target-${mapping.id}`}>{mapping.targetDisplay}</div>
                              <div className="text-xs text-muted-foreground">{mapping.targetSystem}: {mapping.targetCode}</div>
                            </div>
                            <div className="flex gap-2">
                              {getEquivalenceBadge(mapping.equivalence)}
                              {getConfidenceBadge(mapping.confidenceScore)}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2" data-testid={`text-rationale-${mapping.id}`}>{mapping.rationale}</p>
                        </CardContent>
                      </Card>
                    ))}
                    {selectedSession.conceptMappings.length > 10 && (
                      <p className="text-sm text-muted-foreground text-center" data-testid="text-more-mappings">
                        +{selectedSession.conceptMappings.length - 10} more mappings
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedSession.status === "completed" && selectedSession.cleansingResults.length > 0 && (
                <Card data-testid="card-cleansing-results">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-cleansing-title">
                      <Zap className="h-5 w-5" />
                      Data Cleansing Suggestions ({selectedSession.cleansingResults.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3" data-testid="container-cleansing">
                    {selectedSession.cleansingResults.slice(0, 5).map(result => (
                      <Card key={result.id} className="bg-muted/30" data-testid={`card-cleansing-${result.id}`}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2" data-testid={`text-cleansing-field-${result.id}`}>
                                {result.resourceType}.{result.fieldPath}
                                <Badge variant="outline" className="text-xs" data-testid={`badge-action-${result.id}`}>{result.action}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground" data-testid={`text-cleansing-desc-${result.id}`}>{result.description}</p>
                            </div>
                            {getConfidenceBadge(result.confidence)}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-red-50 dark:bg-red-950/20" data-testid={`text-original-${result.id}`}>
                              <span className="font-medium">Original:</span> {JSON.stringify(result.originalValue)}
                            </div>
                            <div className="p-2 rounded bg-green-50 dark:bg-green-950/20" data-testid={`text-cleaned-${result.id}`}>
                              <span className="font-medium">Suggested:</span> {JSON.stringify(result.cleanedValue)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}

              {selectedSession.status === "completed" && selectedSession.profileSuggestions.length > 0 && (
                <Card data-testid="card-profile-suggestions">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-profile-suggestions-title">
                      <FileCode className="h-5 w-5" />
                      Profile Suggestions ({selectedSession.profileSuggestions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3" data-testid="container-profile-suggestions">
                    {selectedSession.profileSuggestions.map(suggestion => (
                      <Card key={suggestion.id} className="bg-muted/30" data-testid={`card-profile-${suggestion.id}`}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="text-sm font-medium" data-testid={`text-profile-name-${suggestion.id}`}>{suggestion.suggestedProfile}</div>
                              <div className="text-xs text-muted-foreground" data-testid={`text-profile-resource-${suggestion.id}`}>
                                For: {suggestion.resourceType} | Version: {suggestion.profileVersion}
                              </div>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" data-testid={`badge-compatibility-${suggestion.id}`}>
                              {Math.round(suggestion.compatibilityScore * 100)}% compatible
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2" data-testid={`text-profile-rationale-${suggestion.id}`}>{suggestion.rationale}</p>
                          {suggestion.requiredTransformations.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-medium">Transformations needed:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {suggestion.requiredTransformations.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-transform-${suggestion.id}-${i}`}>
                                    {t.fieldPath}: {t.complexity}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}

              {selectedSession.status === "completed" && selectedSession.summary.aiInsights.length > 0 && (
                <Card data-testid="card-ai-insights">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-insights-title">
                      <Lightbulb className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                      AI Insights & Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4" data-testid="container-insights">
                    <div>
                      <p className="text-sm font-medium mb-2">Key Insights:</p>
                      <ul className="space-y-1">
                        {selectedSession.summary.aiInsights.map((insight, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-insight-${idx}`}>
                            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Recommendations:</p>
                      <ul className="space-y-1">
                        {selectedSession.summary.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-recommendation-${idx}`}>
                            <Shield className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-amber-50 dark:bg-amber-950/20" data-testid="card-disclaimer">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground" data-testid="text-disclaimer">
                    {selectedSession.summary?.disclaimer || "This harmonization analysis is for data quality purposes only, not clinical decision support."}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card data-testid="card-quick-mapping">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-quick-map-title">
                <Search className="h-5 w-5" />
                Quick Concept Mapping
              </CardTitle>
              <CardDescription data-testid="text-quick-map-description">
                Map a single concept between terminologies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-harmonization--source-code" data-testid="label-source-code">Source Code</Label>
                  <Input id="fhir-data-harmonization--source-code"
                    placeholder="e.g., 73211009"
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    data-testid="input-source-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-harmonization--source-system" data-testid="label-source-system">Source System</Label>
                  <Select value={sourceSystem} onValueChange={setSourceSystem}>
                    <SelectTrigger id="fhir-data-harmonization--source-system" data-testid="select-source-system">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snomed_ct" data-testid="select-item-snomed">SNOMED CT</SelectItem>
                      <SelectItem value="loinc" data-testid="select-item-loinc">LOINC</SelectItem>
                      <SelectItem value="icd10" data-testid="select-item-icd10">ICD-10</SelectItem>
                      <SelectItem value="rxnorm" data-testid="select-item-rxnorm">RxNorm</SelectItem>
                      <SelectItem value="cpt" data-testid="select-item-cpt">CPT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-harmonization--target-system" data-testid="label-target-system">Target System</Label>
                  <Select value={targetSystem} onValueChange={setTargetSystem}>
                    <SelectTrigger id="fhir-data-harmonization--target-system" data-testid="select-target-system">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snomed_ct" data-testid="select-item-snomed-target">SNOMED CT</SelectItem>
                      <SelectItem value="loinc" data-testid="select-item-loinc-target">LOINC</SelectItem>
                      <SelectItem value="icd10" data-testid="select-item-icd10-target">ICD-10</SelectItem>
                      <SelectItem value="rxnorm" data-testid="select-item-rxnorm-target">RxNorm</SelectItem>
                      <SelectItem value="cpt" data-testid="select-item-cpt-target">CPT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleQuickMap}
                disabled={mapConceptMutation.isPending || !sourceCode}
                data-testid="button-quick-map"
              >
                {mapConceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                Map Concept
              </Button>

              {mapConceptMutation.data?.mapping && (
                <Card className="bg-muted/30" data-testid="card-mapping-result">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1">
                        <div className="text-sm font-medium" data-testid="text-result-source">{sourceCode}</div>
                        <div className="text-xs text-muted-foreground">{sourceSystem}</div>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="text-sm font-medium" data-testid="text-result-target">{mapConceptMutation.data.mapping.targetDisplay}</div>
                        <div className="text-xs text-muted-foreground">{mapConceptMutation.data.mapping.targetSystem}: {mapConceptMutation.data.mapping.targetCode}</div>
                      </div>
                      {getEquivalenceBadge(mapConceptMutation.data.mapping.equivalence)}
                      {getConfidenceBadge(mapConceptMutation.data.mapping.confidenceScore)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2" data-testid="text-result-rationale">{mapConceptMutation.data.mapping.rationale}</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card data-testid="card-canonical-profiles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-profiles-title">
                <FileCode className="h-5 w-5" />
                Canonical FHIR Profiles
              </CardTitle>
              <CardDescription data-testid="text-profiles-description">
                Standard profiles recommended for data normalization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3" data-testid="container-profiles">
              {profiles.map(profile => (
                <Card key={profile.id} className="bg-muted/30" data-testid={`card-canonical-profile-${profile.id}`}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-sm font-medium" data-testid={`text-canonical-profile-name-${profile.id}`}>{profile.suggestedProfile}</div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-canonical-profile-url-${profile.id}`}>
                          {profile.profileUrl}
                        </div>
                      </div>
                      <Badge variant="outline" data-testid={`badge-canonical-version-${profile.id}`}>v{profile.profileVersion}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2" data-testid={`text-canonical-rationale-${profile.id}`}>{profile.rationale}</p>
                  </CardContent>
                </Card>
              ))}
              {profiles.length === 0 && (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-profiles">
                  No profiles loaded. Start a harmonization session to see profile recommendations.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card data-testid="card-session-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-history-title">
                <History className="h-5 w-5" />
                Session History
              </CardTitle>
              <CardDescription data-testid="text-history-description">
                Previous harmonization sessions
              </CardDescription>
            </CardHeader>
            <CardContent data-testid="container-history">
              {sessions.length > 0 ? (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <Card
                      key={session.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => { setSelectedSession(session); setActiveTab("results"); }}
                      data-testid={`card-history-session-${session.id}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-sm font-medium" data-testid={`text-history-name-${session.id}`}>{session.name}</div>
                            <div className="text-xs text-muted-foreground" data-testid={`text-history-date-${session.id}`}>
                              {new Date(session.createdAt).toLocaleString()} | {session.resourceCount} resources
                            </div>
                          </div>
                          <Badge variant={session.status === "completed" ? "default" : "secondary"} data-testid={`badge-history-status-${session.id}`}>
                            {session.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-empty-history">
                  No harmonization sessions yet. Start your first session from the Harmonize tab.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
