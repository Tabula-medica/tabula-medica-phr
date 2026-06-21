import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  GitBranch, 
  Sparkles, 
  BookOpen, 
  Brain, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  ChevronRight, 
  RefreshCw, 
  Loader2, 
  Code2, 
  Database,
  FileSearch,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Wand2
} from "lucide-react";

interface VersionMapping {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  resourceType: string;
  structuralChanges: Array<{
    id: string;
    changeType: string;
    sourcePath: string;
    targetPath: string;
    description: string;
    breakingChange: boolean;
  }>;
  elementMappings: Array<{
    id: string;
    sourceElement: string;
    targetElement: string;
    sourceCardinality: string;
    targetCardinality: string;
    transformationRequired: boolean;
    dataLossRisk: string;
    aiConfidence: number;
  }>;
  aiConfidence: number;
  aiRationale: string;
  status: string;
  createdAt: string;
}

interface TerminologySuggestion {
  id: string;
  sourceText: string;
  sourceContext: string;
  resourceType: string;
  fieldPath: string;
  suggestions: Array<{
    id: string;
    system: string;
    systemName: string;
    code: string;
    display: string;
    confidence: number;
    matchType: string;
  }>;
  aiConfidence: number;
  aiRationale: string;
  status: string;
  createdAt: string;
}

interface DataInference {
  id: string;
  patientId: string;
  resourceType: string;
  inferredField: string;
  inferredValue: any;
  inferenceType: string;
  sourceEvidence: Array<{
    resourceId: string;
    resourceType: string;
    fieldPath: string;
    value: any;
    contributionWeight: number;
  }>;
  knowledgeGraphNodes: Array<{
    nodeType: string;
    nodeId: string;
    nodeName: string;
    relationship: string;
    relationshipStrength: number;
  }>;
  aiConfidence: number;
  aiRationale: string;
  status: string;
  createdAt: string;
}

interface AccuracyMetrics {
  totalMappings: number;
  approvedMappings: number;
  rejectedMappings: number;
  refinedMappings: number;
  approvalRate: number;
  avgConfidenceScore: number;
  avgConfidenceApproved: number;
  avgConfidenceRejected: number;
  improvementTrend: Array<{ period: string; approvalRate: number }>;
}

interface DashboardData {
  stats: {
    versionMappings: { total: number; pendingReview: number; approved: number; rejected: number };
    terminologySuggestions: { total: number; pendingReview: number; approved: number; rejected: number };
    dataInferences: { total: number; pendingReview: number; approved: number; rejected: number };
    feedbackEntries: number;
  };
  pendingItems: {
    versionMappings: VersionMapping[];
    terminologySuggestions: TerminologySuggestion[];
    dataInferences: DataInference[];
  };
  accuracyMetrics: AccuracyMetrics;
}

export default function AIAdvancedStandardization() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sourceResource, setSourceResource] = useState("");
  const [sourceVersion, setSourceVersion] = useState<string>("STU3");
  const [termText, setTermText] = useState("");
  const [termContext, setTermContext] = useState("");
  const [termResourceType, setTermResourceType] = useState("Condition");
  const [termFieldPath, setTermFieldPath] = useState("Condition.code");
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({});
  const [refineItem, setRefineItem] = useState<string | null>(null);
  const [refineRationale, setRefineRationale] = useState("");

  const { data: dashboard, isLoading: dashboardLoading, refetch } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/ai-advanced-standardization/dashboard"],
  });

  const versionMappingMutation = useMutation({
    mutationFn: async (data: { sourceResource: any; sourceVersion: string }) => {
      return apiRequest("POST", "/api/ai-advanced-standardization/version-mapping/analyze", data);
    },
    onSuccess: () => {
      toast({ title: "Version Mapping Analyzed", description: "AI analysis complete. Pending clinician review." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advanced-standardization/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze version mapping", variant: "destructive" });
    }
  });

  const terminologySuggestionMutation = useMutation({
    mutationFn: async (data: { text: string; context: string; resourceType: string; fieldPath: string }) => {
      return apiRequest("POST", "/api/ai-advanced-standardization/terminology/suggest", data);
    },
    onSuccess: () => {
      toast({ title: "Terminology Suggested", description: "AI suggestions generated. Pending clinician review." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advanced-standardization/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate terminology suggestions", variant: "destructive" });
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: async (data: { itemType: string; itemId: string; action: string; comments?: string }) => {
      return apiRequest("POST", "/api/ai-advanced-standardization/feedback", { ...data, reviewerRole: "clinician" });
    },
    onSuccess: (_, variables) => {
      toast({ title: "Feedback Submitted", description: `${variables.action} recorded for AI mapping.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-advanced-standardization/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    }
  });

  const handleVersionMappingAnalysis = () => {
    try {
      const resource = JSON.parse(sourceResource);
      versionMappingMutation.mutate({ sourceResource: resource, sourceVersion });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid FHIR resource JSON", variant: "destructive" });
    }
  };

  const handleTerminologySuggestion = () => {
    terminologySuggestionMutation.mutate({
      text: termText,
      context: termContext,
      resourceType: termResourceType,
      fieldPath: termFieldPath
    });
  };

  const handleFeedback = (itemType: string, itemId: string, action: string) => {
    const payload: any = {
      itemType,
      itemId,
      action,
      comments: feedbackComments[itemId]
    };
    
    if (action === "refine" && refineRationale) {
      payload.refinement = {
        refinementType: "correction",
        rationale: refineRationale,
        impactScore: 0.7
      };
    }
    
    feedbackMutation.mutate(payload);
    setRefineItem(null);
    setRefineRationale("");
  };

  const loadSampleResource = () => {
    const sample = {
      resourceType: "Patient",
      id: "example-stu3",
      name: [{ use: "official", family: "Smith", given: ["John"] }],
      gender: "male",
      birthDate: "1970-01-25",
      identifier: [{ system: "http://example.org/mrn", value: "MRN123456" }]
    };
    setSourceResource(JSON.stringify(sample, null, 2));
  };

  const loadSampleTerminology = () => {
    setTermText("Type 2 diabetes mellitus with diabetic nephropathy");
    setTermContext("Chief complaint extracted from clinical encounter note");
    setTermResourceType("Condition");
    setTermFieldPath("Condition.code");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review": return <Badge variant="secondary" data-testid="badge-pending">Pending Review</Badge>;
      case "approved": return <Badge className="bg-green-500" data-testid="badge-approved">Approved</Badge>;
      case "rejected": return <Badge variant="destructive" data-testid="badge-rejected">Rejected</Badge>;
      case "refined": return <Badge className="bg-blue-500" data-testid="badge-refined">Refined</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const stats = dashboard?.data?.stats;
  const pendingItems = dashboard?.data?.pendingItems;
  const accuracyMetrics = dashboard?.data?.accuracyMetrics;

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="ai-advanced-standardization">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Advanced FHIR Standardization
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered version mapping, terminology suggestion, and data inference with clinician feedback
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="border-yellow-500/50 bg-yellow-500/10" data-testid="card-top-disclaimer">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              <strong>NO-CDS Notice:</strong> AI-generated mappings are for DATA INTEROPERABILITY purposes only. Clinician review required before use.
            </p>
          </div>
        </CardContent>
      </Card>

      {dashboardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-version-mappings">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Version Mappings</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-version-total">
                {stats?.versionMappings.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.versionMappings.pendingReview || 0} pending review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-terminology-suggestions">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Terminology Suggestions</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-terminology-total">
                {stats?.terminologySuggestions.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.terminologySuggestions.pendingReview || 0} pending review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-data-inferences">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Data Inferences</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-inference-total">
                {stats?.dataInferences.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.dataInferences.pendingReview || 0} pending review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-approval-rate">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-approval-rate">
                {Math.round((accuracyMetrics?.approvalRate || 0) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.feedbackEntries || 0} feedback entries
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Database className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="version-mapping" data-testid="tab-version-mapping">
            <GitBranch className="h-4 w-4 mr-2" />
            Version Map
          </TabsTrigger>
          <TabsTrigger value="terminology" data-testid="tab-terminology">
            <BookOpen className="h-4 w-4 mr-2" />
            Terminology
          </TabsTrigger>
          <TabsTrigger value="inference" data-testid="tab-inference">
            <Brain className="h-4 w-4 mr-2" />
            Inference
          </TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Accuracy Improvement Trend
                </CardTitle>
                <CardDescription>AI mapping approval rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accuracyMetrics?.improvementTrend?.map((point, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{point.period}</span>
                      <div className="flex items-center gap-2 flex-1 mx-4">
                        <Progress value={point.approvalRate * 100} className="flex-1" />
                        <span className="text-sm font-medium w-12">{Math.round(point.approvalRate * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Confidence Analysis
                </CardTitle>
                <CardDescription>AI confidence scores by outcome</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Confidence (All)</span>
                    <span className="font-medium">{Math.round((accuracyMetrics?.avgConfidenceScore || 0) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600">Average Confidence (Approved)</span>
                    <span className="font-medium text-green-600">{Math.round((accuracyMetrics?.avgConfidenceApproved || 0) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-600">Average Confidence (Rejected)</span>
                    <span className="font-medium text-red-600">{Math.round((accuracyMetrics?.avgConfidenceRejected || 0) * 100)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Items Pending Review
              </CardTitle>
              <CardDescription>AI-generated mappings awaiting clinician approval</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {pendingItems?.versionMappings?.map((mapping) => (
                    <div key={mapping.id} className="p-4 border rounded-lg" data-testid={`pending-vm-${mapping.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span className="font-medium">{mapping.resourceType}</span>
                          <Badge variant="outline">{mapping.sourceVersion} → {mapping.targetVersion}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${getConfidenceColor(mapping.aiConfidence)}`}>
                            {Math.round(mapping.aiConfidence * 100)}% confidence
                          </span>
                          {getStatusBadge(mapping.status)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{mapping.aiRationale}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Button size="sm" onClick={() => handleFeedback("version_mapping", mapping.id, "approve")} disabled={feedbackMutation.isPending} data-testid={`button-approve-${mapping.id}`}>
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleFeedback("version_mapping", mapping.id, "reject")} disabled={feedbackMutation.isPending} data-testid={`button-reject-${mapping.id}`}>
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRefineItem(refineItem === mapping.id ? null : mapping.id)} disabled={feedbackMutation.isPending} data-testid={`button-refine-${mapping.id}`}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Refine
                        </Button>
                      </div>
                      {refineItem === mapping.id && (
                        <div className="mt-3 space-y-2" data-testid={`refine-form-${mapping.id}`}>
                          <Textarea
                            placeholder="Describe how this mapping should be refined..."
                            value={refineRationale}
                            onChange={(e) => setRefineRationale(e.target.value)}
                            className="text-sm"
                            data-testid={`input-refine-rationale-${mapping.id}`}
                          />
                          <Button size="sm" onClick={() => handleFeedback("version_mapping", mapping.id, "refine")} disabled={feedbackMutation.isPending || !refineRationale} data-testid={`button-submit-refine-${mapping.id}`}>
                            Submit Refinement
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {pendingItems?.terminologySuggestions?.map((suggestion) => (
                    <div key={suggestion.id} className="p-4 border rounded-lg" data-testid={`pending-ts-${suggestion.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          <span className="font-medium">"{suggestion.sourceText}"</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${getConfidenceColor(suggestion.aiConfidence)}`}>
                            {Math.round(suggestion.aiConfidence * 100)}% confidence
                          </span>
                          {getStatusBadge(suggestion.status)}
                        </div>
                      </div>
                      <div className="space-y-1 mt-2">
                        {suggestion.suggestions.slice(0, 3).map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-sm">
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="outline">{s.systemName}</Badge>
                            <code className="text-xs">{s.code}</code>
                            <span className="text-muted-foreground">{s.display}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleFeedback("terminology_suggestion", suggestion.id, "approve")} disabled={feedbackMutation.isPending}>
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleFeedback("terminology_suggestion", suggestion.id, "reject")} disabled={feedbackMutation.isPending}>
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRefineItem(refineItem === suggestion.id ? null : suggestion.id)} disabled={feedbackMutation.isPending} data-testid={`button-refine-${suggestion.id}`}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Refine
                        </Button>
                      </div>
                      {refineItem === suggestion.id && (
                        <div className="mt-3 space-y-2" data-testid={`refine-form-${suggestion.id}`}>
                          <Textarea
                            placeholder="Describe how this suggestion should be refined..."
                            value={refineRationale}
                            onChange={(e) => setRefineRationale(e.target.value)}
                            className="text-sm"
                            data-testid={`input-refine-rationale-${suggestion.id}`}
                          />
                          <Button size="sm" onClick={() => handleFeedback("terminology_suggestion", suggestion.id, "refine")} disabled={feedbackMutation.isPending || !refineRationale} data-testid={`button-submit-refine-${suggestion.id}`}>
                            Submit Refinement
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {pendingItems?.dataInferences?.map((inference) => (
                    <div key={inference.id} className="p-4 border rounded-lg" data-testid={`pending-di-${inference.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          <span className="font-medium">{inference.inferredField}</span>
                          <Badge variant="outline">{inference.inferenceType}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${getConfidenceColor(inference.aiConfidence)}`}>
                            {Math.round(inference.aiConfidence * 100)}% confidence
                          </span>
                          {getStatusBadge(inference.status)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{inference.aiRationale}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleFeedback("data_inference", inference.id, "approve")} disabled={feedbackMutation.isPending}>
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleFeedback("data_inference", inference.id, "reject")} disabled={feedbackMutation.isPending}>
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRefineItem(refineItem === inference.id ? null : inference.id)} disabled={feedbackMutation.isPending} data-testid={`button-refine-${inference.id}`}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Refine
                        </Button>
                      </div>
                      {refineItem === inference.id && (
                        <div className="mt-3 space-y-2" data-testid={`refine-form-${inference.id}`}>
                          <Textarea
                            placeholder="Describe how this inference should be refined..."
                            value={refineRationale}
                            onChange={(e) => setRefineRationale(e.target.value)}
                            className="text-sm"
                            data-testid={`input-refine-rationale-${inference.id}`}
                          />
                          <Button size="sm" onClick={() => handleFeedback("data_inference", inference.id, "refine")} disabled={feedbackMutation.isPending || !refineRationale} data-testid={`button-submit-refine-${inference.id}`}>
                            Submit Refinement
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {(!pendingItems?.versionMappings?.length && !pendingItems?.terminologySuggestions?.length && !pendingItems?.dataInferences?.length) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No items pending review</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="version-mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                AI Version Mapping Analysis
              </CardTitle>
              <CardDescription>
                Analyze FHIR resource structural differences across versions (DSTU2, STU3, R4, R4B, R5)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Select value={sourceVersion} onValueChange={setSourceVersion}>
                  <SelectTrigger className="w-[150px]" data-testid="select-source-version">
                    <SelectValue placeholder="Source version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSTU2">DSTU2</SelectItem>
                    <SelectItem value="STU3">STU3</SelectItem>
                    <SelectItem value="R4">R4</SelectItem>
                    <SelectItem value="R4B">R4B</SelectItem>
                    <SelectItem value="R5">R5</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="py-2">Target: R4</Badge>
                <Button variant="outline" onClick={loadSampleResource} data-testid="button-load-sample-resource">
                  Load Sample
                </Button>
              </div>

              <Textarea
                placeholder="Paste FHIR resource JSON here..."
                value={sourceResource}
                onChange={(e) => setSourceResource(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                data-testid="input-source-resource"
              />

              <Button
                onClick={handleVersionMappingAnalysis}
                disabled={!sourceResource || versionMappingMutation.isPending}
                className="w-full"
                data-testid="button-analyze-mapping"
              >
                {versionMappingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Analyze Version Mapping
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminology" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                AI Terminology Suggestion
              </CardTitle>
              <CardDescription>
                Map unstructured clinical text to standardized codes (SNOMED CT, LOINC, RxNorm, ICD-10)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Select value={termResourceType} onValueChange={setTermResourceType}>
                  <SelectTrigger className="w-[180px]" data-testid="select-term-resource-type">
                    <SelectValue placeholder="Resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Condition">Condition</SelectItem>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                    <SelectItem value="Procedure">Procedure</SelectItem>
                    <SelectItem value="AllergyIntolerance">AllergyIntolerance</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="FHIR field path (e.g., Condition.code)"
                  value={termFieldPath}
                  onChange={(e) => setTermFieldPath(e.target.value)}
                  className="w-[250px]"
                  data-testid="input-term-field-path"
                />

                <Button variant="outline" onClick={loadSampleTerminology} data-testid="button-load-sample-term">
                  Load Sample
                </Button>
              </div>

              <Textarea
                placeholder="Enter clinical text to map to terminology codes..."
                value={termText}
                onChange={(e) => setTermText(e.target.value)}
                rows={3}
                data-testid="input-term-text"
              />

              <Textarea
                placeholder="Provide context (e.g., source document type, clinical setting)..."
                value={termContext}
                onChange={(e) => setTermContext(e.target.value)}
                rows={2}
                data-testid="input-term-context"
              />

              <Button
                onClick={handleTerminologySuggestion}
                disabled={!termText || !termContext || terminologySuggestionMutation.isPending}
                className="w-full"
                data-testid="button-suggest-terminology"
              >
                {terminologySuggestionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Suggestions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Suggest Terminology Codes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inference" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Data Inference
              </CardTitle>
              <CardDescription>
                Infer missing data using clinical knowledge graphs and existing patient records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Data inference requires patient context</p>
                <p className="text-sm">Use the API directly or integrate with patient records for inference capabilities</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Clinician Feedback Loop
              </CardTitle>
              <CardDescription>
                Review, approve, reject, or refine AI-generated mappings to improve accuracy over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-green-600">{accuracyMetrics?.approvedMappings || 0}</div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <div className="text-2xl font-bold text-red-600">{accuracyMetrics?.rejectedMappings || 0}</div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Edit3 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold text-blue-600">{accuracyMetrics?.refinedMappings || 0}</div>
                    <p className="text-sm text-muted-foreground">Refined</p>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">How Feedback Improves AI</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Approved mappings reinforce correct AI behavior
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Rejected mappings help identify error patterns
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Refined mappings provide explicit corrections for learning
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Confidence thresholds adjust based on outcome patterns
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-yellow-500/50 bg-yellow-500/5" data-testid="card-disclaimer">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-300 text-sm">NO-CDS Compliance Notice</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1" data-testid="text-disclaimer">
                This AI-powered FHIR standardization system is for DATA INTEROPERABILITY AND TECHNICAL PURPOSES ONLY. AI-generated mappings, terminology suggestions, and data inferences are for review by qualified healthcare informatics professionals. They do NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
