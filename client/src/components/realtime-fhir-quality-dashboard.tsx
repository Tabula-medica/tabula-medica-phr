import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  BarChart3, 
  FileSearch, 
  Sparkles,
  Clock,
  TrendingUp,
  Database,
  Shield,
  RefreshCw,
  Check,
  X
} from "lucide-react";

interface QualityIssue {
  id: string;
  field: string;
  issueType: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  currentValue: any;
  suggestedValue?: any;
  confidence: number;
  autoFixable: boolean;
}

interface CorrectionSuggestion {
  id: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
  source: "ai" | "rule" | "reference_data";
  acceptanceStatus?: "pending" | "accepted" | "rejected";
}

interface ValidationResult {
  id: string;
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  isValid: boolean;
  overallScore: number;
  issues: QualityIssue[];
  corrections: CorrectionSuggestion[];
  processingTimeMs: number;
  aiAnalysis?: string;
}

interface MonitoringEvent {
  id: string;
  eventType: "create" | "update" | "delete" | "batch";
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  qualityScore: number;
  issueCount: number;
  correctionCount: number;
  autoFixesApplied: number;
  processingTimeMs: number;
  status: "passed" | "warnings" | "blocked" | "corrected";
}

interface DashboardData {
  recentEvents: MonitoringEvent[];
  statistics: {
    totalValidations: number;
    passRate: number;
    avgQualityScore: number;
    avgProcessingTime: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  };
  trends: {
    hourly: { hour: string; validations: number; passRate: number }[];
  };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "text-red-600 bg-red-50 dark:bg-red-950";
    case "error": return "text-red-500 bg-red-50 dark:bg-red-950";
    case "warning": return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950";
    case "info": return "text-blue-500 bg-blue-50 dark:bg-blue-950";
    default: return "text-muted-foreground bg-muted";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "passed": return "bg-green-500";
    case "warnings": return "bg-yellow-500";
    case "blocked": return "bg-red-500";
    case "corrected": return "bg-blue-500";
    default: return "bg-muted";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "passed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "warnings": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "blocked": return <XCircle className="w-4 h-4 text-red-500" />;
    case "corrected": return <Sparkles className="w-4 h-4 text-blue-500" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

export default function RealtimeFhirQualityDashboard() {
  const [activeTab, setActiveTab] = useState("monitoring");
  const [resourceJson, setResourceJson] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [profilingResources, setProfilingResources] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dashboardLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/realtime-fhir-quality/dashboard"],
    refetchInterval: 10000,
  });

  const validateMutation = useMutation({
    mutationFn: async (resource: any) => {
      const response = await apiRequest("POST", "/api/realtime-fhir-quality/validate", {
        resource,
        generateAISuggestions: true,
        generateAnalysis: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/realtime-fhir-quality/dashboard"] });
      toast({
        title: data.isValid ? "Validation Passed" : "Validation Issues Found",
        description: `Quality score: ${data.overallScore}%, ${data.issues.length} issues, ${data.corrections.length} suggestions`,
      });
    },
    onError: () => {
      toast({ title: "Validation Failed", description: "Could not validate resource", variant: "destructive" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async ({ resources, name }: { resources: any[]; name: string }) => {
      const response = await apiRequest("POST", "/api/realtime-fhir-quality/profile", {
        resources,
        datasetName: name,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Dataset Profiled",
        description: `Quality score: ${data.overallQualityScore}%, ${data.fieldProfiles.length} fields analyzed`,
      });
    },
    onError: () => {
      toast({ title: "Profiling Failed", description: "Could not profile dataset", variant: "destructive" });
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async ({ validationId, correctionId, action }: { validationId: string; correctionId: string; action: "accept" | "reject" }) => {
      const response = await apiRequest("POST", `/api/realtime-fhir-quality/validations/${validationId}/corrections/${correctionId}`, {
        action,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Correction Applied", description: data.message });
      if (validationResult) {
        const updated = { ...validationResult };
        const correction = updated.corrections.find((c: CorrectionSuggestion) => c.id === data.correctionId);
        if (correction) {
          correction.acceptanceStatus = data.action === "accept" ? "accepted" : "rejected";
        }
        setValidationResult(updated);
      }
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not apply correction", variant: "destructive" });
    },
  });

  const handleValidate = () => {
    try {
      const resource = JSON.parse(resourceJson);
      validateMutation.mutate(resource);
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON", variant: "destructive" });
    }
  };

  const handleProfile = () => {
    try {
      const resources = JSON.parse(profilingResources);
      if (!Array.isArray(resources)) {
        toast({ title: "Invalid Format", description: "Please provide an array of resources", variant: "destructive" });
        return;
      }
      profileMutation.mutate({ resources, name: datasetName || "Unnamed Dataset" });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON array", variant: "destructive" });
    }
  };

  const samplePatient = {
    resourceType: "Patient",
    id: "example-001",
    name: [{ family: "Smith", given: ["John"] }],
    gender: "Male",
    birthDate: "1990-05-15",
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Real-time FHIR Data Quality</h1>
          <p className="text-muted-foreground">AI-powered validation and correction before data is saved</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950">
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-validations">{dashboardData.statistics.totalValidations}</p>
                  <p className="text-xs text-muted-foreground">Validations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pass-rate">{dashboardData.statistics.passRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Pass Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-950">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-avg-score">{dashboardData.statistics.avgQualityScore.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-orange-50 dark:bg-orange-950">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-avg-time">{dashboardData.statistics.avgProcessingTime}ms</p>
                  <p className="text-xs text-muted-foreground">Avg Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-red-50 dark:bg-red-950">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-issues">
                    {Object.values(dashboardData.statistics.issuesBySeverity).reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">
            <Activity className="w-4 h-4 mr-2" />
            Real-time Monitoring
          </TabsTrigger>
          <TabsTrigger value="validate" data-testid="tab-validate">
            <Shield className="w-4 h-4 mr-2" />
            Validate Resource
          </TabsTrigger>
          <TabsTrigger value="profiling" data-testid="tab-profiling">
            <BarChart3 className="w-4 h-4 mr-2" />
            Data Profiling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Recent Validation Events
                </CardTitle>
                <CardDescription>Live stream of resource validations</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : dashboardData?.recentEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No recent events</div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData?.recentEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className="flex items-center justify-between gap-4 p-3 rounded-md border"
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(event.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.resourceType}</span>
                              <Badge variant="outline" className="text-xs">
                                {event.eventType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleTimeString()}
                              {event.resourceId && ` • ${event.resourceId}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{event.qualityScore}%</p>
                            <p className="text-xs text-muted-foreground">{event.processingTimeMs}ms</p>
                          </div>
                          <div className={`w-2 h-8 rounded-full ${getStatusColor(event.status)}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Issue Distribution
                </CardTitle>
                <CardDescription>Breakdown by type and severity</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">By Severity</h4>
                      <div className="space-y-2">
                        {Object.entries(dashboardData.statistics.issuesBySeverity).map(([severity, count]) => (
                          <div key={severity} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                severity === "critical" ? "bg-red-600" :
                                severity === "error" ? "bg-red-500" :
                                severity === "warning" ? "bg-yellow-500" : "bg-blue-500"
                              }`} />
                              <span className="text-sm capitalize">{severity}</span>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">By Type</h4>
                      <div className="space-y-2">
                        {Object.entries(dashboardData.statistics.issuesByType).slice(0, 5).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between gap-4">
                            <span className="text-sm">{type.replace(/_/g, " ")}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="validate" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-blue-500" />
                  Validate FHIR Resource
                </CardTitle>
                <CardDescription>Get AI-powered quality analysis and correction suggestions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste FHIR resource JSON here..."
                  value={resourceJson}
                  onChange={(e) => setResourceJson(e.target.value)}
                  className="min-h-[250px] font-mono text-sm"
                  data-testid="textarea-resource-json"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    onClick={handleValidate} 
                    disabled={!resourceJson || validateMutation.isPending}
                    data-testid="button-validate"
                  >
                    {validateMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Validate Resource
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setResourceJson(JSON.stringify(samplePatient, null, 2))}
                    data-testid="button-load-sample"
                  >
                    Load Sample Patient
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Validation Results
                </CardTitle>
                <CardDescription>Quality issues and AI correction suggestions</CardDescription>
              </CardHeader>
              <CardContent>
                {!validationResult ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a FHIR resource and click Validate</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted">
                      <div>
                        <p className="font-medium">{validationResult.resourceType}</p>
                        <p className="text-xs text-muted-foreground">
                          Processed in {validationResult.processingTimeMs}ms
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold">{validationResult.overallScore}%</p>
                          <p className="text-xs text-muted-foreground">Quality Score</p>
                        </div>
                        {validationResult.isValid ? (
                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                        ) : (
                          <XCircle className="w-8 h-8 text-red-500" />
                        )}
                      </div>
                    </div>

                    {validationResult.aiAnalysis && (
                      <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950">
                        <p className="text-sm flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                          <span>{validationResult.aiAnalysis}</span>
                        </p>
                      </div>
                    )}

                    {validationResult.issues.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Issues ({validationResult.issues.length})</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {validationResult.issues.map((issue) => (
                            <div 
                              key={issue.id} 
                              className={`p-2 rounded-md ${getSeverityColor(issue.severity)}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">{issue.field}</span>
                                <Badge variant="outline" className="text-xs capitalize">{issue.severity}</Badge>
                              </div>
                              <p className="text-sm mt-1">{issue.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationResult.corrections.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">AI Correction Suggestions ({validationResult.corrections.length})</h4>
                        <div className="space-y-2">
                          {validationResult.corrections.map((correction) => (
                            <div 
                              key={correction.id} 
                              className="p-3 rounded-md border bg-blue-50 dark:bg-blue-950"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="font-medium text-sm">{correction.field}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {Math.round(correction.confidence * 100)}% confidence
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                <div>
                                  <p className="text-muted-foreground">Current</p>
                                  <p className="font-mono bg-muted p-1 rounded">{JSON.stringify(correction.currentValue)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Suggested</p>
                                  <p className="font-mono bg-green-100 dark:bg-green-900 p-1 rounded">{JSON.stringify(correction.suggestedValue)}</p>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{correction.reason}</p>
                              {correction.acceptanceStatus === "pending" && (
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => correctionMutation.mutate({ 
                                      validationId: validationResult.id, 
                                      correctionId: correction.id, 
                                      action: "accept" 
                                    })}
                                    data-testid={`button-accept-${correction.id}`}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Accept
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => correctionMutation.mutate({ 
                                      validationId: validationResult.id, 
                                      correctionId: correction.id, 
                                      action: "reject" 
                                    })}
                                    data-testid={`button-reject-${correction.id}`}
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {correction.acceptanceStatus && correction.acceptanceStatus !== "pending" && (
                                <Badge variant={correction.acceptanceStatus === "accepted" ? "default" : "secondary"}>
                                  {correction.acceptanceStatus}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profiling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-500" />
                Dataset Profiling
              </CardTitle>
              <CardDescription>Analyze a collection of FHIR resources to identify quality patterns and anomalies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Dataset Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Patient Records Q4 2025"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                      data-testid="input-dataset-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">FHIR Resources (JSON Array)</label>
                    <Textarea
                      placeholder='[{"resourceType": "Patient", ...}, {"resourceType": "Observation", ...}]'
                      value={profilingResources}
                      onChange={(e) => setProfilingResources(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                      data-testid="textarea-profiling-resources"
                    />
                  </div>
                  <Button 
                    onClick={handleProfile} 
                    disabled={!profilingResources || profileMutation.isPending}
                    data-testid="button-profile"
                  >
                    {profileMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Profiling...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Profile Dataset
                      </>
                    )}
                  </Button>
                </div>

                <div className="p-4 rounded-md bg-muted">
                  <h4 className="font-medium mb-3">What Data Profiling Does</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>Analyzes field completeness and null rates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>Detects data anomalies and outliers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>Identifies cross-resource reference issues</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>Calculates quality scores across dimensions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>Provides statistical summaries for numeric fields</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        All AI-powered insights are for informational purposes only and do not constitute clinical decision support.
      </p>
    </div>
  );
}
