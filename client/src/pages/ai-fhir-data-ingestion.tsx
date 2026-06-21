import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, FileText, CheckCircle, XCircle, AlertTriangle, Activity, Database, RefreshCw, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface ExtractedEntity {
  type: string;
  value: string;
  code?: string;
  codeSystem?: string;
  confidence: number;
  context?: string;
}

interface ParsedClinicalData {
  id: string;
  noteId: string;
  patientId: string;
  entities: ExtractedEntity[];
  summary: string;
  parseTimestamp: string;
  aiModel: string;
  confidence: number;
  processingTimeMs: number;
}

interface FHIRMappingResult {
  id: string;
  parsedDataId: string;
  patientId: string;
  resourceType: string;
  fhirResource: Record<string, any>;
  terminology: {
    system: string;
    code: string;
    display: string;
  };
  mappingConfidence: number;
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessages: string[];
  createdAt: string;
}

interface IngestionJob {
  id: string;
  status: 'pending' | 'parsing' | 'mapping' | 'validating' | 'completed' | 'failed';
  noteId: string;
  patientId: string;
  noteType: string;
  startTime: string;
  endTime?: string;
  progress: number;
  parsedDataId?: string;
  mappingResults?: string[];
  errors: string[];
  warnings: string[];
}

interface QualityIssue {
  id: string;
  jobId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  affectedResource?: string;
  suggestedAction: string;
  status: 'open' | 'reviewing' | 'resolved' | 'ignored';
  createdAt: string;
}

interface QualityMetrics {
  totalIngested: number;
  successRate: number;
  avgConfidence: number;
  avgProcessingTime: number;
  issuesByCategory: Record<string, number>;
  recentTrends: { date: string; ingested: number; success: number; failed: number }[];
}

interface DashboardData {
  metrics: QualityMetrics;
  recentJobs: IngestionJob[];
  openIssues: QualityIssue[];
  recentMappings: FHIRMappingResult[];
  noCdsCompliance: string;
}

interface ListResponse<T> {
  items: T[];
  noCdsCompliance: string;
}

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'completed': return 'default';
    case 'failed': return 'destructive';
    case 'pending': case 'parsing': case 'mapping': case 'validating': return 'secondary';
    default: return 'outline';
  }
}

function getSeverityVariant(severity: string): BadgeVariant {
  switch (severity) {
    case 'critical': case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
}

function getValidationVariant(status: string): BadgeVariant {
  switch (status) {
    case 'valid': return 'default';
    case 'warning': return 'secondary';
    case 'error': return 'destructive';
    default: return 'outline';
  }
}

export default function AIFHIRDataIngestionPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const [noteForm, setNoteForm] = useState({
    patientId: '',
    noteType: 'doctor_note' as const,
    rawText: '',
    sourceSystem: '',
    documentDate: new Date().toISOString().split('T')[0]
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['/api/fhir-data-ingestion/dashboard']
  });

  const { data: jobsData } = useQuery<ListResponse<IngestionJob>>({
    queryKey: ['/api/fhir-data-ingestion/jobs']
  });

  const { data: issuesData } = useQuery<ListResponse<QualityIssue>>({
    queryKey: ['/api/fhir-data-ingestion/quality/issues']
  });

  const { data: mappingsData } = useQuery<ListResponse<FHIRMappingResult>>({
    queryKey: ['/api/fhir-data-ingestion/mappings']
  });

  const submitNoteMutation = useMutation({
    mutationFn: async (data: typeof noteForm) => {
      return apiRequest('POST', '/api/fhir-data-ingestion/submit', data);
    },
    onSuccess: () => {
      toast({ title: "Clinical note submitted", description: "AI ingestion has started processing" });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/mappings'] });
      setNoteForm({ patientId: '', noteType: 'doctor_note', rawText: '', sourceSystem: '', documentDate: new Date().toISOString().split('T')[0] });
    },
    onError: (error) => {
      toast({ title: "Submission failed", description: String(error), variant: "destructive" });
    }
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ issueId, status }: { issueId: string; status: string }) => {
      return apiRequest('PATCH', `/api/fhir-data-ingestion/quality/issues/${issueId}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Issue updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/quality/issues'] });
    }
  });

  const reprocessJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest('POST', `/api/fhir-data-ingestion/jobs/${jobId}/reprocess`);
    },
    onSuccess: () => {
      toast({ title: "Job reprocessing started" });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-data-ingestion/jobs'] });
    }
  });

  const jobs = jobsData?.items || [];
  const issues = issuesData?.items || [];
  const mappings = mappingsData?.items || [];
  const metrics = dashboard?.metrics;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">AI FHIR Data Ingestion</h1>
          <p className="text-muted-foreground">
            Automated clinical note parsing, FHIR mapping, and quality monitoring
          </p>
        </div>
        <Badge variant="outline">
          <Database className="w-3 h-3 mr-1" />
          FHIR R4 Compliant
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {dashboard?.noCdsCompliance || "INFORMATIONAL ONLY - AI-generated content for data governance purposes. Not for clinical decision-making."}
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Activity className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="ingest" data-testid="tab-ingest">
            <Upload className="w-4 h-4 mr-2" />
            Ingest Notes
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <FileText className="w-4 h-4 mr-2" />
            FHIR Mappings
          </TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">
            <CheckCircle className="w-4 h-4 mr-2" />
            Quality Assurance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Ingested</CardDescription>
                    <CardTitle className="text-2xl" data-testid="metric-total">{metrics.totalIngested}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Success Rate</CardDescription>
                    <CardTitle className="text-2xl" data-testid="metric-success-rate">{metrics.successRate.toFixed(1)}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Avg Confidence</CardDescription>
                    <CardTitle className="text-2xl" data-testid="metric-confidence">{metrics.avgConfidence.toFixed(1)}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Avg Processing Time</CardDescription>
                    <CardTitle className="text-2xl" data-testid="metric-processing-time">{metrics.avgProcessingTime.toFixed(0)}ms</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Ingestion Jobs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.recentJobs.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No recent jobs</p>
                    ) : (
                      dashboard.recentJobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`job-${job.id}`}>
                          <div className="flex items-center gap-3">
                            {job.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-foreground" />
                            ) : job.status === 'failed' ? (
                              <XCircle className="w-5 h-5 text-destructive" />
                            ) : (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{job.noteType.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">Patient: {job.patientId}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                            {job.status !== 'completed' && job.status !== 'failed' && (
                              <span className="text-xs">{job.progress}%</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Open Quality Issues</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.openIssues.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No open issues</p>
                    ) : (
                      dashboard.openIssues.map((issue) => (
                        <div key={issue.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`issue-${issue.id}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityVariant(issue.severity)}>{issue.severity}</Badge>
                              <span className="text-sm font-medium">{issue.category.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateIssueMutation.mutate({ issueId: issue.id, status: 'resolved' })}
                            data-testid={`resolve-issue-${issue.id}`}
                          >
                            Resolve
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="ingest" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Clinical Note for AI Ingestion</CardTitle>
              <CardDescription>
                Upload unstructured clinical notes for AI-powered parsing and FHIR mapping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input
                    id="patientId"
                    value={noteForm.patientId}
                    onChange={(e) => setNoteForm({ ...noteForm, patientId: e.target.value })}
                    placeholder="Enter patient ID"
                    data-testid="input-patient-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="noteType">Note Type</Label>
                  <Select
                    value={noteForm.noteType}
                    onValueChange={(value: any) => setNoteForm({ ...noteForm, noteType: value })}
                  >
                    <SelectTrigger data-testid="select-note-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor_note">Doctor's Note</SelectItem>
                      <SelectItem value="lab_report">Lab Report</SelectItem>
                      <SelectItem value="discharge_summary">Discharge Summary</SelectItem>
                      <SelectItem value="radiology_report">Radiology Report</SelectItem>
                      <SelectItem value="pathology_report">Pathology Report</SelectItem>
                      <SelectItem value="consultation_note">Consultation Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceSystem">Source System (Optional)</Label>
                  <Input
                    id="sourceSystem"
                    value={noteForm.sourceSystem}
                    onChange={(e) => setNoteForm({ ...noteForm, sourceSystem: e.target.value })}
                    placeholder="e.g., Fasten Health"
                    data-testid="input-source-system"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentDate">Document Date</Label>
                  <Input
                    id="documentDate"
                    type="date"
                    value={noteForm.documentDate}
                    onChange={(e) => setNoteForm({ ...noteForm, documentDate: e.target.value })}
                    data-testid="input-document-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rawText">Clinical Note Content</Label>
                <Textarea
                  id="rawText"
                  value={noteForm.rawText}
                  onChange={(e) => setNoteForm({ ...noteForm, rawText: e.target.value })}
                  placeholder="Paste or type the clinical note content here..."
                  className="min-h-[200px]"
                  data-testid="textarea-raw-text"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => submitNoteMutation.mutate(noteForm)}
                disabled={submitNoteMutation.isPending || !noteForm.patientId || !noteForm.rawText}
                data-testid="button-submit-note"
              >
                {submitNoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit for AI Ingestion
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingestion Job History</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No ingestion jobs yet</p>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-4 border rounded-lg" data-testid={`history-job-${job.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                          <span className="font-medium">{job.noteType.replace(/_/g, ' ')}</span>
                          <span className="text-sm text-muted-foreground">Patient: {job.patientId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {job.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reprocessJobMutation.mutate(job.id)}
                              disabled={reprocessJobMutation.isPending}
                              data-testid={`reprocess-${job.id}`}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Retry
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                            data-testid={`view-${job.id}`}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            {selectedJob === job.id ? 'Hide' : 'View'}
                          </Button>
                        </div>
                      </div>
                      {job.status !== 'completed' && job.status !== 'failed' && (
                        <Progress value={job.progress} className="h-2 mb-2" />
                      )}
                      {job.warnings.length > 0 && (
                        <div className="mt-2">
                          {job.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {w}
                            </p>
                          ))}
                        </div>
                      )}
                      {job.errors.length > 0 && (
                        <div className="mt-2">
                          {job.errors.map((e, i) => (
                            <p key={i} className="text-xs text-destructive flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> {e}
                            </p>
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

        <TabsContent value="mappings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Resource Mappings</CardTitle>
              <CardDescription>
                View AI-generated FHIR resources mapped from clinical notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No mappings available</p>
              ) : (
                <div className="space-y-4">
                  {mappings.map((mapping) => (
                    <Card key={mapping.id} data-testid={`mapping-${mapping.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{mapping.resourceType}</Badge>
                            <Badge variant={getValidationVariant(mapping.validationStatus)}>
                              {mapping.validationStatus}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Confidence: {(mapping.mappingConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">Terminology Mapping</p>
                          <p className="text-xs text-muted-foreground">
                            {mapping.terminology.system}: {mapping.terminology.code} - {mapping.terminology.display}
                          </p>
                        </div>
                        {mapping.validationMessages.length > 0 && (
                          <div>
                            <p className="text-sm font-medium">Validation Messages</p>
                            {mapping.validationMessages.map((msg, i) => (
                              <p key={i} className="text-xs text-muted-foreground">{msg}</p>
                            ))}
                          </div>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View FHIR Resource JSON
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(mapping.fhirResource, null, 2)}
                          </pre>
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(metrics.issuesByCategory).map(([category, count]) => (
                    <div key={category} className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{category.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Quality Issues</CardTitle>
              <CardDescription>
                Review and resolve flagged issues from the ingestion pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No quality issues found</p>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue) => (
                    <div key={issue.id} className="p-4 border rounded-lg" data-testid={`qa-issue-${issue.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityVariant(issue.severity)}>{issue.severity}</Badge>
                            <Badge variant="outline">{issue.category.replace(/_/g, ' ')}</Badge>
                            <Badge variant={issue.status === 'resolved' ? 'default' : 'secondary'}>
                              {issue.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{issue.description}</p>
                          {issue.affectedResource && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Affected: {issue.affectedResource}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Suggested: {issue.suggestedAction}
                          </p>
                        </div>
                        {issue.status === 'open' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateIssueMutation.mutate({ issueId: issue.id, status: 'reviewing' })}
                              data-testid={`review-issue-${issue.id}`}
                            >
                              Review
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateIssueMutation.mutate({ issueId: issue.id, status: 'resolved' })}
                              data-testid={`resolve-qa-issue-${issue.id}`}
                            >
                              Resolve
                            </Button>
                          </div>
                        )}
                        {issue.status === 'reviewing' && (
                          <Button
                            size="sm"
                            onClick={() => updateIssueMutation.mutate({ issueId: issue.id, status: 'resolved' })}
                            data-testid={`complete-review-${issue.id}`}
                          >
                            Complete Review
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
