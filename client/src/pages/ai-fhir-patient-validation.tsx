import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  RefreshCw, 
  ClipboardCheck,
  User,
  FileCheck,
  TrendingUp,
  Lightbulb,
  History,
  ChevronRight,
  ListChecks,
  Target,
  BarChart3
} from "lucide-react";

interface PatientOption {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
}

interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: "critical" | "warning" | "info";
  field: string;
  currentValue: string | null;
  expectedValue?: string;
  message: string;
  suggestion?: string;
}

interface DataQualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  conformance: number;
}

interface AISuggestion {
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedFields: string[];
  suggestedAction: string;
  clinicalGuideline?: string;
}

interface ValidationResult {
  id: string;
  patientId: string;
  patientName: string;
  validatedAt: string;
  dataQualityScore: DataQualityScore;
  issues: ValidationIssue[];
  aiSuggestions: AISuggestion[];
  summary: string;
  complianceStatus: "compliant" | "needs_review" | "non_compliant";
  disclaimer: string;
}

interface Metadata {
  version: string;
  serviceName: string;
  description: string;
  totalRules: number;
  noCdsCompliance: string;
}

export default function AIFHIRPatientValidationPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: metadata } = useQuery<Metadata>({
    queryKey: ["/api/fhir-patient-validation/metadata"]
  });

  const { data: patients, isLoading: patientsLoading, isError: patientsError, refetch: refetchPatients } = useQuery<PatientOption[]>({
    queryKey: ["/api/fhir-patient-validation/patients"]
  });

  const { data: validationHistory, refetch: refetchHistory } = useQuery<ValidationResult[]>({
    queryKey: ["/api/fhir-patient-validation/history", selectedPatientId],
    enabled: !!selectedPatientId
  });

  const validateMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest("POST", "/api/fhir-patient-validation/validate", { patientId });
      return response.json() as Promise<ValidationResult>;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-patient-validation/history", selectedPatientId] });
    }
  });

  const handleValidate = () => {
    if (selectedPatientId) {
      validateMutation.mutate(selectedPatientId);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-chart-4 dark:text-chart-4" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive" data-testid="badge-severity-critical">Critical</Badge>;
      case "warning": return <Badge variant="secondary" data-testid="badge-severity-warning">Warning</Badge>;
      default: return <Badge variant="secondary" data-testid="badge-severity-info">Info</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="destructive" data-testid="badge-priority-high">High</Badge>;
      case "medium": return <Badge variant="secondary" data-testid="badge-priority-medium">Medium</Badge>;
      default: return <Badge variant="outline" data-testid="badge-priority-low">Low</Badge>;
    }
  };

  const getComplianceStatusBadge = (status: string) => {
    switch (status) {
      case "compliant": 
        return <Badge className="bg-chart-2 dark:bg-chart-2 text-chart-2-foreground dark:text-chart-2-foreground" data-testid="badge-status-compliant">Compliant</Badge>;
      case "needs_review": 
        return <Badge variant="secondary" data-testid="badge-status-review">Needs Review</Badge>;
      default: 
        return <Badge variant="destructive" data-testid="badge-status-non-compliant">Non-Compliant</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-chart-2 dark:bg-chart-2";
    if (score >= 60) return "bg-chart-4 dark:bg-chart-4";
    return "bg-destructive";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <ClipboardCheck className="w-8 h-8 text-chart-1 dark:text-chart-1" />
            AI FHIR Patient Validation
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Validate patient data against clinical guidelines and data quality standards
          </p>
        </div>
        {metadata && (
          <Badge variant="outline" className="text-xs" data-testid="badge-version">
            v{metadata.version}
          </Badge>
        )}
      </div>

      {metadata?.noCdsCompliance && (
        <Alert className="border-chart-1/30 bg-chart-1/10 dark:bg-chart-1/20 dark:border-chart-1/40" data-testid="alert-compliance">
          <Shield className="h-4 w-4 text-chart-1 dark:text-chart-1" />
          <AlertTitle data-testid="text-compliance-title">Compliance Notice</AlertTitle>
          <AlertDescription className="text-sm" data-testid="text-compliance-desc">
            {metadata.noCdsCompliance}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Select Patient
            </CardTitle>
            <CardDescription data-testid="text-patient-select-desc">
              Choose a patient to validate their data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientsError ? (
              <div className="text-center py-4" data-testid="patients-error">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Failed to load patients</p>
                <Button variant="outline" size="sm" onClick={() => refetchPatients()} className="mt-2" data-testid="button-retry-patients">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : (
              <Select
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                disabled={patientsLoading}
                data-testid="select-patient"
              >
                <SelectTrigger data-testid="select-patient-trigger">
                  <SelectValue placeholder={patientsLoading ? "Loading..." : "Select a patient"} />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id} data-testid={`patient-option-${patient.id}`}>
                      <div className="flex flex-col">
                        <span>{patient.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {patient.gender} - DOB: {patient.dateOfBirth}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              className="w-full"
              onClick={handleValidate}
              disabled={!selectedPatientId || validateMutation.isPending}
              data-testid="button-validate"
            >
              {validateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 mr-2" />
                  Validate Data
                </>
              )}
            </Button>

            {validateMutation.isError && (
              <Alert variant="destructive" data-testid="alert-validation-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to validate data. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {validationHistory && validationHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1" data-testid="text-history-header">
                  <History className="w-4 h-4" />
                  Recent Validations
                </h4>
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {validationHistory.slice(0, 5).map((result) => (
                      <Button
                        key={result.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setValidationResult(result)}
                        data-testid={`history-item-${result.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{result.dataQualityScore.overall}%</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(result.validatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Validation Results
            </CardTitle>
            {validationResult && (
              <CardDescription data-testid="text-result-header">
                Validation for {validationResult.patientName} on{" "}
                {new Date(validationResult.validatedAt).toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!validationResult ? (
              <div className="text-center py-12">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground" data-testid="text-empty-state">
                  Select a patient and click "Validate Data" to assess data quality
                </p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="issues" data-testid="tab-issues">Issues ({validationResult.issues.length})</TabsTrigger>
                  <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggestions</TabsTrigger>
                  <TabsTrigger value="scores" data-testid="tab-scores">Scores</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card data-testid="card-overall-score">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Overall Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="text-4xl font-bold" data-testid="text-overall-score">
                            {validationResult.dataQualityScore.overall}%
                          </div>
                          <Progress 
                            value={validationResult.dataQualityScore.overall} 
                            className="flex-1"
                            data-testid="progress-overall-score"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-compliance-status">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Compliance Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {getComplianceStatusBadge(validationResult.complianceStatus)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-issues-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ListChecks className="w-4 h-4" />
                          Issues Found
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold" data-testid="text-issue-count">
                            {validationResult.issues.length}
                          </span>
                          <div className="flex gap-1">
                            {validationResult.issues.filter(i => i.severity === "critical").length > 0 && (
                              <Badge variant="destructive" className="text-xs" data-testid="badge-critical-count">
                                {validationResult.issues.filter(i => i.severity === "critical").length} Critical
                              </Badge>
                            )}
                            {validationResult.issues.filter(i => i.severity === "warning").length > 0 && (
                              <Badge variant="secondary" className="text-xs" data-testid="badge-warning-count">
                                {validationResult.issues.filter(i => i.severity === "warning").length} Warning
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card data-testid="card-summary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm" data-testid="text-summary">
                        {validationResult.summary}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="issues" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-chart-4 dark:text-chart-4" />
                        Validation Issues
                      </CardTitle>
                      <CardDescription data-testid="text-issues-desc">
                        Issues identified during data validation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {validationResult.issues.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle className="w-12 h-12 text-chart-2 dark:text-chart-2 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground" data-testid="text-no-issues">
                            No validation issues found. Patient data is complete and accurate.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {validationResult.issues.map((issue, index) => (
                            <div 
                              key={index} 
                              className="p-4 border rounded-lg" 
                              data-testid={`issue-item-${index}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(issue.severity)}
                                  <span className="font-medium" data-testid={`issue-name-${index}`}>{issue.ruleName}</span>
                                  {getSeverityBadge(issue.severity)}
                                </div>
                                <Badge variant="outline" className="text-xs" data-testid={`issue-category-${index}`}>
                                  {issue.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2" data-testid={`issue-message-${index}`}>
                                {issue.message}
                              </p>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-muted-foreground">
                                  Field: <code className="bg-muted px-1 rounded" data-testid={`issue-field-${index}`}>{issue.field}</code>
                                </span>
                                {issue.currentValue && (
                                  <span className="text-muted-foreground">
                                    Current: <span data-testid={`issue-current-${index}`}>{issue.currentValue}</span>
                                  </span>
                                )}
                              </div>
                              {issue.suggestion && (
                                <div className="mt-2 p-2 bg-muted/50 rounded text-xs" data-testid={`issue-suggestion-${index}`}>
                                  <strong>Suggestion:</strong> {issue.suggestion}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="suggestions" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-chart-4 dark:text-chart-4" />
                        AI Suggestions
                      </CardTitle>
                      <CardDescription data-testid="text-suggestions-desc">
                        AI-powered recommendations to improve data quality
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {validationResult.aiSuggestions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-suggestions">
                          No additional suggestions available.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {validationResult.aiSuggestions.map((suggestion, index) => (
                            <div 
                              key={index} 
                              className="p-4 border rounded-lg"
                              data-testid={`suggestion-item-${index}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" data-testid={`suggestion-title-${index}`}>{suggestion.title}</span>
                                  {getPriorityBadge(suggestion.priority)}
                                </div>
                                <Badge variant="outline" className="text-xs" data-testid={`suggestion-type-${index}`}>
                                  {suggestion.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2" data-testid={`suggestion-desc-${index}`}>
                                {suggestion.description}
                              </p>
                              <div className="p-2 bg-muted/50 rounded text-sm" data-testid={`suggestion-action-${index}`}>
                                <strong>Recommended Action:</strong> {suggestion.suggestedAction}
                              </div>
                              {suggestion.clinicalGuideline && (
                                <div className="mt-2 text-xs text-muted-foreground" data-testid={`suggestion-guideline-${index}`}>
                                  Guideline: {suggestion.clinicalGuideline}
                                </div>
                              )}
                              {suggestion.affectedFields.length > 0 && (
                                <div className="mt-2 flex gap-1 flex-wrap">
                                  {suggestion.affectedFields.map((field, i) => (
                                    <Badge key={i} variant="outline" className="text-xs" data-testid={`suggestion-field-${index}-${i}`}>
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="scores" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Data Quality Scores
                      </CardTitle>
                      <CardDescription data-testid="text-scores-desc">
                        Detailed breakdown of data quality dimensions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {Object.entries(validationResult.dataQualityScore).map(([dimension, score]) => (
                        <div key={dimension} className="space-y-2" data-testid={`score-${dimension}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize" data-testid={`score-label-${dimension}`}>
                              {dimension}
                            </span>
                            <span className="text-sm font-bold" data-testid={`score-value-${dimension}`}>
                              {score}%
                            </span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${getScoreColor(score)} transition-all`}
                              style={{ width: `${score}%` }}
                              data-testid={`score-bar-${dimension}`}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {validationResult && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center" data-testid="text-disclaimer">
                  {validationResult.disclaimer}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
