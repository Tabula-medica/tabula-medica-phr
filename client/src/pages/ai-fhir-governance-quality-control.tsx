import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Shield,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  FileJson,
  Activity,
  Database,
  Search,
  BarChart3,
  Eye,
  ArrowRight
} from "lucide-react";

interface ConformanceIssue {
  profile: string;
  path: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedFix?: string;
}

interface ConformanceValidationResult {
  resourceId: string;
  resourceType: string;
  validatedAt: string;
  overallStatus: 'compliant' | 'non_compliant' | 'partial';
  profilesChecked: string[];
  issues: ConformanceIssue[];
  aiRecommendations: string[];
  complianceScore: number;
  noCdsCompliance: string;
}

interface AnomalyDetails {
  description: string;
  affectedResources: string[];
  confidence: number;
  suggestedAction: string;
}

interface DetectedAnomaly {
  id: string;
  type: 'temporal_inconsistency' | 'duplicate_records' | 'conflicting_values' | 'orphaned_references' | 'missing_required_data' | 'outlier_values' | 'terminology_mismatch' | 'invalid_references';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectedAt: string;
  details: AnomalyDetails;
  status: 'new' | 'reviewed' | 'resolved' | 'ignored';
  aiAnalysis: string;
}

interface AnomalyDetectionResult {
  analysisId: string;
  analyzedAt: string;
  resourcesScanned: number;
  anomaliesDetected: DetectedAnomaly[];
  overallDataQuality: number;
  recommendations: string[];
  noCdsCompliance: string;
}

interface EnrichmentSuggestion {
  id: string;
  type: 'missing_data' | 'data_correction' | 'terminology_mapping' | 'reference_linking' | 'format_standardization';
  priority: 'high' | 'medium' | 'low';
  resourceId: string;
  resourceType: string;
  field: string;
  currentValue?: string;
  suggestedValue: string;
  rationale: string;
  confidence: number;
  status: 'pending' | 'applied' | 'rejected';
}

interface EnrichmentResult {
  enrichmentId: string;
  generatedAt: string;
  resourcesAnalyzed: number;
  suggestions: EnrichmentSuggestion[];
  potentialImprovements: {
    dataCompleteness: number;
    dataAccuracy: number;
    terminologyConsistency: number;
  };
  noCdsCompliance: string;
}

interface GovernanceStatus {
  lastConformanceCheck?: string;
  lastAnomalyDetection?: string;
  lastEnrichmentGeneration?: string;
  totalValidations: number;
  totalAnomalies: number;
  totalEnrichments: number;
  overallHealthScore: number;
}

const RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Condition',
  'MedicationRequest',
  'Encounter',
  'DiagnosticReport',
  'Procedure',
  'AllergyIntolerance',
  'Immunization',
  'CarePlan'
];

const PROFILES = [
  'us-core-patient',
  'us-core-observation',
  'us-core-condition',
  'us-core-medication-request',
  'us-core-encounter'
];

export default function AIFHIRGovernanceQualityControlPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("validation");
  const [selectedResourceType, setSelectedResourceType] = useState("Patient");
  const [selectedProfile, setSelectedProfile] = useState("us-core-patient");

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery<GovernanceStatus>({
    queryKey: ['/api/fhir-governance-qc/status']
  });

  const { data: validationHistory, isLoading: validationHistoryLoading } = useQuery<ConformanceValidationResult[]>({
    queryKey: ['/api/fhir-governance-qc/validation-history']
  });

  const { data: anomalyHistory, isLoading: anomalyHistoryLoading } = useQuery<AnomalyDetectionResult[]>({
    queryKey: ['/api/fhir-governance-qc/anomaly-history']
  });

  const { data: enrichmentHistory, isLoading: enrichmentHistoryLoading } = useQuery<EnrichmentResult[]>({
    queryKey: ['/api/fhir-governance-qc/enrichment-history']
  });

  const validateMutation = useMutation({
    mutationFn: async (params: { resourceType: string; profiles: string[] }) => {
      const response = await apiRequest('POST', '/api/fhir-governance-qc/validate', params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Validation Complete", description: "Conformance validation has been completed." });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/validation-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/status'] });
    },
    onError: (error: Error) => {
      toast({ title: "Validation Failed", description: error.message, variant: "destructive" });
    }
  });

  const detectAnomaliesMutation = useMutation({
    mutationFn: async (params: { resourceTypes: string[] }) => {
      const response = await apiRequest('POST', '/api/fhir-governance-qc/detect-anomalies', params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Detection Complete", description: "Anomaly detection has been completed." });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/anomaly-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/status'] });
    },
    onError: (error: Error) => {
      toast({ title: "Detection Failed", description: error.message, variant: "destructive" });
    }
  });

  const generateEnrichmentsMutation = useMutation({
    mutationFn: async (params: { resourceTypes: string[] }) => {
      const response = await apiRequest('POST', '/api/fhir-governance-qc/generate-enrichments', params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Generation Complete", description: "Enrichment suggestions have been generated." });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/enrichment-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/status'] });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    }
  });

  const updateAnomalyStatusMutation = useMutation({
    mutationFn: async (params: { anomalyId: string; status: string }) => {
      const response = await apiRequest('POST', '/api/fhir-governance-qc/anomaly-status', params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Anomaly status has been updated." });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/anomaly-history'] });
    }
  });

  const updateEnrichmentStatusMutation = useMutation({
    mutationFn: async (params: { enrichmentId: string; status: string }) => {
      const response = await apiRequest('POST', '/api/fhir-governance-qc/enrichment-status', params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Enrichment status has been updated." });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-governance-qc/enrichment-history'] });
    }
  });

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    };
    return <Badge className={variants[severity] || "bg-muted text-muted-foreground"}>{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      compliant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      non_compliant: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      reviewed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      ignored: "bg-muted text-muted-foreground",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      applied: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    };
    return <Badge className={variants[status] || "bg-muted text-muted-foreground"}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="governance-qc-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">AI FHIR Data Governance & Quality Control</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered conformance validation, anomaly detection, and data enrichment suggestions
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetchStatus()}
          disabled={statusLoading}
          data-testid="button-refresh-status"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                INFORMATIONAL ONLY - NO CLINICAL DECISION SUPPORT
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                All AI-generated validations, anomaly detections, and enrichment suggestions are for 
                data governance and operational purposes only. Not intended for clinical decision-making.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Health Score</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-health-score">
              {statusLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${statusData?.overallHealthScore || 0}%`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-4 w-4" />
              Data quality score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Validations</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-validations">
              {statusLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : statusData?.totalValidations || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              Conformance checks
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Detected Anomalies</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-anomalies">
              {statusLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : statusData?.totalAnomalies || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Search className="h-4 w-4" />
              Data issues found
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enrichment Suggestions</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-enrichments">
              {statusLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : statusData?.totalEnrichments || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Improvement opportunities
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-navigation">
          <TabsTrigger value="validation" data-testid="tab-validation">
            <Shield className="h-4 w-4 mr-2" />
            Conformance Validation
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="enrichment" data-testid="tab-enrichment">
            <Sparkles className="h-4 w-4 mr-2" />
            Enrichment Suggestions
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                FHIR Conformance Validation
              </CardTitle>
              <CardDescription>
                Validate FHIR resources against US Core and custom profiles with AI-powered recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-governance-quali-resource-type">Resource Type</Label>
                  <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                    <SelectTrigger id="ai-fhir-governance-quali-resource-type" data-testid="select-resource-type">
                      <SelectValue placeholder="Select resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-governance-quali-profile">Profile</Label>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger id="ai-fhir-governance-quali-profile" data-testid="select-profile">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILES.map(profile => (
                        <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => validateMutation.mutate({ 
                  resourceType: selectedResourceType, 
                  profiles: [selectedProfile] 
                })}
                disabled={validateMutation.isPending}
                data-testid="button-run-validation"
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Run Conformance Validation
              </Button>
            </CardContent>
          </Card>

          {validationHistoryLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : validationHistory && validationHistory.length > 0 ? (
            <div className="space-y-4">
              {validationHistory.slice(0, 3).map((result, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{result.resourceType}</CardTitle>
                        {getStatusBadge(result.overallStatus)}
                      </div>
                      <Badge className="bg-muted text-muted-foreground">
                        Score: {result.complianceScore}%
                      </Badge>
                    </div>
                    <CardDescription>
                      Validated at {formatDate(result.validatedAt)} | Profiles: {result.profilesChecked.join(', ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.issues.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">Issues Found ({result.issues.length})</h4>
                        <div className="space-y-2">
                          {result.issues.slice(0, 3).map((issue, issueIndex) => (
                            <div key={issueIndex} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                              {getSeverityBadge(issue.severity)}
                              <div className="flex-1">
                                <p className="text-sm text-foreground">{issue.message}</p>
                                <p className="text-xs text-muted-foreground">Path: {issue.path}</p>
                                {issue.suggestedFix && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    <ArrowRight className="h-3 w-3 inline mr-1" />
                                    {issue.suggestedFix}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.aiRecommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2 text-foreground">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          AI Recommendations
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {result.aiRecommendations.map((rec, recIndex) => (
                            <li key={recIndex} className="text-sm text-muted-foreground">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No validation history yet. Run a validation to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Anomaly Detection
              </CardTitle>
              <CardDescription>
                Detect data quality issues including duplicates, temporal inconsistencies, and orphaned references
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <FieldCaption>Resource Types to Analyze</FieldCaption>
                <div className="flex flex-wrap gap-2">
                  {RESOURCE_TYPES.slice(0, 5).map(type => (
                    <Badge key={type} className="bg-muted text-muted-foreground">{type}</Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => detectAnomaliesMutation.mutate({ 
                  resourceTypes: RESOURCE_TYPES.slice(0, 5) 
                })}
                disabled={detectAnomaliesMutation.isPending}
                data-testid="button-detect-anomalies"
              >
                {detectAnomaliesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Run Anomaly Detection
              </Button>
            </CardContent>
          </Card>

          {anomalyHistoryLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : anomalyHistory && anomalyHistory.length > 0 ? (
            <div className="space-y-4">
              {anomalyHistory.slice(0, 2).map((result, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-lg">Anomaly Analysis</CardTitle>
                      <Badge className="bg-muted text-muted-foreground">
                        Quality Score: {result.overallDataQuality}%
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatDate(result.analyzedAt)} | Scanned {result.resourcesScanned} resources | 
                      Found {result.anomaliesDetected.length} anomalies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.anomaliesDetected.length > 0 && (
                      <div className="space-y-2">
                        {result.anomaliesDetected.slice(0, 5).map((anomaly, anomalyIndex) => (
                          <div key={anomalyIndex} className="flex items-start justify-between gap-4 p-3 rounded border">
                            <div className="flex items-start gap-2 flex-1">
                              <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-foreground">{anomaly.type.replace(/_/g, ' ')}</span>
                                  {getSeverityBadge(anomaly.severity)}
                                  {getStatusBadge(anomaly.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">{anomaly.details.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Confidence: {Math.round(anomaly.details.confidence * 100)}% | 
                                  Affected: {anomaly.details.affectedResources.length} resources
                                </p>
                                {anomaly.aiAnalysis && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    AI Analysis: {anomaly.aiAnalysis}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => updateAnomalyStatusMutation.mutate({ 
                                  anomalyId: anomaly.id, 
                                  status: 'reviewed' 
                                })}
                                disabled={anomaly.status !== 'new'}
                                data-testid={`button-review-anomaly-${anomaly.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Review
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => updateAnomalyStatusMutation.mutate({ 
                                  anomalyId: anomaly.id, 
                                  status: 'resolved' 
                                })}
                                disabled={anomaly.status === 'resolved'}
                                data-testid={`button-resolve-anomaly-${anomaly.id}`}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolve
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2 text-foreground">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          Recommendations
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {result.recommendations.map((rec, recIndex) => (
                            <li key={recIndex} className="text-sm text-muted-foreground">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No anomaly detection history. Run a detection to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="enrichment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                Data Enrichment Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered suggestions for missing data, terminology mapping, and format standardization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <FieldCaption>Resource Types to Analyze</FieldCaption>
                <div className="flex flex-wrap gap-2">
                  {RESOURCE_TYPES.slice(0, 5).map(type => (
                    <Badge key={type} className="bg-muted text-muted-foreground">{type}</Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => generateEnrichmentsMutation.mutate({ 
                  resourceTypes: RESOURCE_TYPES.slice(0, 5) 
                })}
                disabled={generateEnrichmentsMutation.isPending}
                data-testid="button-generate-enrichments"
              >
                {generateEnrichmentsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Enrichment Suggestions
              </Button>
            </CardContent>
          </Card>

          {enrichmentHistoryLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : enrichmentHistory && enrichmentHistory.length > 0 ? (
            <div className="space-y-4">
              {enrichmentHistory.slice(0, 2).map((result, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-lg">Enrichment Suggestions</CardTitle>
                      <div className="flex gap-2">
                        <Badge className="bg-muted text-muted-foreground">
                          Completeness: +{result.potentialImprovements.dataCompleteness}%
                        </Badge>
                        <Badge className="bg-muted text-muted-foreground">
                          Accuracy: +{result.potentialImprovements.dataAccuracy}%
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {formatDate(result.generatedAt)} | Analyzed {result.resourcesAnalyzed} resources | 
                      {result.suggestions.length} suggestions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.suggestions.length > 0 && (
                      <div className="space-y-2">
                        {result.suggestions.slice(0, 5).map((suggestion, suggestionIndex) => (
                          <div key={suggestionIndex} className="flex items-start justify-between gap-4 p-3 rounded border">
                            <div className="flex items-start gap-2 flex-1">
                              <Database className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-foreground">{suggestion.type.replace(/_/g, ' ')}</span>
                                  <Badge className={
                                    suggestion.priority === 'high' 
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      : suggestion.priority === 'medium'
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  }>
                                    {suggestion.priority}
                                  </Badge>
                                  {getStatusBadge(suggestion.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {suggestion.resourceType} / {suggestion.field}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {suggestion.currentValue && (
                                    <span>Current: <code className="bg-muted px-1 rounded">{suggestion.currentValue}</code> → </span>
                                  )}
                                  Suggested: <code className="bg-muted px-1 rounded">{suggestion.suggestedValue}</code>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {suggestion.rationale} (Confidence: {Math.round(suggestion.confidence * 100)}%)
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => updateEnrichmentStatusMutation.mutate({ 
                                  enrichmentId: suggestion.id, 
                                  status: 'applied' 
                                })}
                                disabled={suggestion.status !== 'pending'}
                                data-testid={`button-apply-enrichment-${suggestion.id}`}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Apply
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => updateEnrichmentStatusMutation.mutate({ 
                                  enrichmentId: suggestion.id, 
                                  status: 'rejected' 
                                })}
                                disabled={suggestion.status !== 'pending'}
                                data-testid={`button-reject-enrichment-${suggestion.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No enrichment suggestions yet. Generate suggestions to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Validation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validationHistoryLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : validationHistory && validationHistory.length > 0 ? (
                  <div className="space-y-2">
                    {validationHistory.slice(0, 5).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{result.resourceType}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(result.validatedAt)}</p>
                        </div>
                        {getStatusBadge(result.overallStatus)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No validation history</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  Anomaly History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {anomalyHistoryLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : anomalyHistory && anomalyHistory.length > 0 ? (
                  <div className="space-y-2">
                    {anomalyHistory.slice(0, 5).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{result.anomaliesDetected.length} anomalies</p>
                          <p className="text-xs text-muted-foreground">{formatDate(result.analyzedAt)}</p>
                        </div>
                        <Badge className="bg-muted text-muted-foreground">
                          {result.overallDataQuality}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No anomaly history</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  Enrichment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {enrichmentHistoryLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : enrichmentHistory && enrichmentHistory.length > 0 ? (
                  <div className="space-y-2">
                    {enrichmentHistory.slice(0, 5).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{result.suggestions.length} suggestions</p>
                          <p className="text-xs text-muted-foreground">{formatDate(result.generatedAt)}</p>
                        </div>
                        <Badge className="bg-muted text-muted-foreground">
                          +{result.potentialImprovements.dataCompleteness}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No enrichment history</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
