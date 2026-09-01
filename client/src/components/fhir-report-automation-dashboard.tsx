import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Users, 
  Shield, 
  Activity,
  Sparkles,
  Loader2,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Lightbulb,
  Calendar,
  FileBarChart,
  ClipboardCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ReportConfiguration {
  id: string;
  name: string;
  type: string;
  description: string;
  filters: any;
  schedule?: {
    frequency: string;
    nextRunAt: string;
  };
  exportFormats: string[];
  isActive: boolean;
  createdAt: string;
}

interface GeneratedReport {
  id: string;
  configurationId: string;
  type: string;
  title: string;
  generatedAt: string;
  status: string;
  sections: any[];
  summary: {
    totalRecords: number;
    dateRange: { start: string; end: string };
    keyFindings: string[];
    highlights: { label: string; value: string | number; severity?: string; trend?: string }[];
    aiGeneratedSummary: string;
  };
  aiInsights: AIInsight[];
  metadata: any;
  disclaimer: string;
}

interface AIInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  actionItems: string[];
}

export function FHIRReportAutomationDashboard() {
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [resourceJson, setResourceJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const { toast } = useToast();

  const { data: configsData } = useQuery<{ configurations: ReportConfiguration[] }>({
    queryKey: ["/api/fhir-report-automation/configurations"],
  });

  const { data: reportsData } = useQuery<{ reports: GeneratedReport[] }>({
    queryKey: ["/api/fhir-report-automation/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { configurationId: string; fhirResources: any[] }) => {
      const response = await apiRequest("POST", "/api/fhir-report-automation/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedReport(data.report);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-report-automation/reports"] });
      toast({ title: "Report Generated", description: "Your comprehensive report is ready for review." });
      setActiveTab("view");
    },
    onError: (error: any) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const loadSampleDataMutation = useMutation({
    mutationFn: async (reportType: string) => {
      const response = await apiRequest("POST", "/api/fhir-report-automation/generate-sample", { reportType });
      return response.json();
    },
    onSuccess: (data) => {
      setResourceJson(JSON.stringify(data.resources, null, 2));
      toast({ title: "Sample Data Loaded", description: `Loaded ${data.resources.length} sample FHIR resources.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleGenerateReport = () => {
    if (!selectedConfig) {
      toast({ title: "Error", description: "Please select a report configuration", variant: "destructive" });
      return;
    }

    try {
      const resources = JSON.parse(resourceJson);
      if (!Array.isArray(resources)) {
        setJsonError("Input must be a JSON array of FHIR resources");
        return;
      }
      setJsonError(null);
      generateReportMutation.mutate({ configurationId: selectedConfig, fhirResources: resources });
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "patient_summary":
      case "clinical_transfer":
        return <FileText className="h-4 w-4" />;
      case "population_health":
      case "demographic_analysis":
        return <Users className="h-4 w-4" />;
      case "data_quality":
        return <Activity className="h-4 w-4" />;
      case "governance_compliance":
        return <Shield className="h-4 w-4" />;
      default:
        return <FileBarChart className="h-4 w-4" />;
    }
  };

  const getReportTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      patient_summary: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      clinical_transfer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      population_health: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      demographic_analysis: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      data_quality: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      governance_compliance: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  const configurations = configsData?.configurations || [];
  const reports = reportsData?.reports || [];

  return (
    <div className="space-y-6" data-testid="page-report-automation">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileBarChart className="h-6 w-6" />
            AI FHIR Report Automation
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Automate comprehensive report generation from FHIR data with AI insights
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-report-types">
            <FileText className="h-3 w-3" /> 4 Report Types
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-ai-powered">
            <Sparkles className="h-3 w-3" /> AI Powered
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="view" data-testid="tab-view" disabled={!generatedReport}>
            <FileText className="h-4 w-4 mr-2" />
            View
          </TabsTrigger>
          <TabsTrigger value="configs" data-testid="tab-configs">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-report-patient-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-card-patient-summary-title">
                  <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Patient Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-card-patient-summary-description">
                  Comprehensive patient records for clinician review or care transfers
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-report-population">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-card-population-title">
                  <Users className="h-4 w-4 text-green-500 dark:text-green-400" />
                  Population Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-card-population-description">
                  Demographics, risk stratification, and quality measures
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-report-quality">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-card-quality-title">
                  <Activity className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  Data Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-card-quality-description">
                  Completeness, accuracy, and validity assessments
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-report-compliance">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-card-compliance-title">
                  <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-card-compliance-description">
                  HIPAA compliance and governance auditing
                </p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-report-generator">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-generator-title">
                <Sparkles className="h-5 w-5" />
                Generate Report
              </CardTitle>
              <CardDescription data-testid="text-generator-description">
                Select a report template and provide FHIR resources to generate a comprehensive report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fhir-report-automation-d-report-template" data-testid="label-report-template">Report Template</Label>
                <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                  <SelectTrigger id="fhir-report-automation-d-report-template" data-testid="select-report-template">
                    <SelectValue placeholder="Select a report template" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurations.map(config => (
                      <SelectItem key={config.id} value={config.id} data-testid={`select-item-${config.id}`}>
                        <span className="flex items-center gap-2">
                          {getReportTypeIcon(config.type)}
                          {config.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fhir-report-automation-d-fhir-resources-json-array" data-testid="label-fhir-resources">FHIR Resources (JSON Array)</Label>
                <Textarea id="fhir-report-automation-d-fhir-resources-json-array"
                  placeholder='[{"resourceType": "Patient", "id": "1", ...}, ...]'
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
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending || !selectedConfig || !resourceJson.trim()}
                  data-testid="button-generate-report"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const config = configurations.find(c => c.id === selectedConfig);
                    loadSampleDataMutation.mutate(config?.type || "patient_summary");
                  }}
                  disabled={loadSampleDataMutation.isPending}
                  data-testid="button-load-sample"
                >
                  {loadSampleDataMutation.isPending ? (
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

        <TabsContent value="view" className="space-y-4">
          {generatedReport && (
            <>
              <Card data-testid="card-report-header">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2" data-testid="text-report-title">
                        {getReportTypeIcon(generatedReport.type)}
                        {generatedReport.title}
                      </CardTitle>
                      <CardDescription data-testid="text-report-meta">
                        Generated {new Date(generatedReport.generatedAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getReportTypeBadge(generatedReport.type)} data-testid="badge-report-type">
                        {generatedReport.type.replace(/_/g, " ")}
                      </Badge>
                      <Button variant="outline" size="sm" data-testid="button-download-report">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {generatedReport.summary.highlights.map((highlight, idx) => (
                      <Badge 
                        key={idx} 
                        variant={getSeverityColor(highlight.severity) as any}
                        className="flex items-center gap-1"
                        data-testid={`badge-highlight-${idx}`}
                      >
                        {highlight.trend === "up" && <TrendingUp className="h-3 w-3" />}
                        {highlight.trend === "down" && <TrendingDown className="h-3 w-3" />}
                        {highlight.label}: {highlight.value}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-ai-summary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2" data-testid="text-ai-summary-title">
                    <Sparkles className="h-4 w-4" />
                    AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground" data-testid="text-ai-summary-content">
                    {generatedReport.summary.aiGeneratedSummary}
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium" data-testid="label-key-findings">Key Findings:</p>
                    <ul className="space-y-1">
                      {generatedReport.summary.keyFindings.map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-finding-${idx}`}>
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="container-sections">
                {generatedReport.sections.filter(s => s.type !== "ai_analysis").map(section => (
                  <Card key={section.id} data-testid={`card-section-${section.id}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm" data-testid={`text-section-title-${section.id}`}>
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {section.type === "table" && Array.isArray(section.content) && (
                        <div className="text-xs space-y-1" data-testid={`content-section-${section.id}`}>
                          {section.content.slice(0, 5).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span>{item.display || item.name || item.condition || item.test || item.type || JSON.stringify(item).slice(0, 40)}</span>
                              {item.status && <Badge variant="outline" className="text-xs">{item.status}</Badge>}
                            </div>
                          ))}
                          {section.content.length > 5 && (
                            <p className="text-muted-foreground">+{section.content.length - 5} more items</p>
                          )}
                        </div>
                      )}
                      {section.type === "metrics" && (
                        <div className="grid grid-cols-2 gap-2 text-xs" data-testid={`content-section-${section.id}`}>
                          {Object.entries(section.content).slice(0, 4).map(([key, value]: [string, any]) => (
                            <div key={key} className="p-2 rounded bg-muted/50">
                              <p className="font-medium">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                              <p className="text-muted-foreground">{typeof value === "object" ? JSON.stringify(value).slice(0, 30) : String(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {section.type === "text" && (
                        <div className="text-sm" data-testid={`content-section-${section.id}`}>
                          {typeof section.content === "object" ? (
                            <div className="space-y-1">
                              {Object.entries(section.content).map(([key, value]: [string, any]) => (
                                <p key={key}><span className="font-medium">{key}:</span> {String(value)}</p>
                              ))}
                            </div>
                          ) : section.content}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {generatedReport.aiInsights.length > 0 && (
                <Card data-testid="card-ai-insights">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="text-ai-insights-title">
                      <Lightbulb className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                      AI Insights & Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4" data-testid="container-ai-insights">
                    {generatedReport.aiInsights.map(insight => (
                      <Card key={insight.id} className="bg-muted/30" data-testid={`card-insight-${insight.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <CardTitle className="text-sm flex items-center gap-2" data-testid={`text-insight-title-${insight.id}`}>
                              {insight.title}
                            </CardTitle>
                            <Badge variant="outline" data-testid={`badge-insight-confidence-${insight.id}`}>
                              {Math.round(insight.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground" data-testid={`text-insight-description-${insight.id}`}>
                            {insight.description}
                          </p>
                          {insight.actionItems.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium" data-testid={`label-action-items-${insight.id}`}>Action Items:</p>
                              <ul className="space-y-1">
                                {insight.actionItems.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs" data-testid={`text-action-item-${insight.id}-${idx}`}>
                                    <span className="font-medium">{idx + 1}.</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-amber-50 dark:bg-amber-950/20" data-testid="card-disclaimer">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground" data-testid="text-disclaimer">
                    {generatedReport.disclaimer}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="configs" className="space-y-4">
          <Card data-testid="card-templates">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-templates-title">
                <ClipboardCheck className="h-5 w-5" />
                Report Templates
              </CardTitle>
              <CardDescription data-testid="text-templates-description">
                Pre-configured report templates for common healthcare reporting needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4" data-testid="container-templates">
              {configurations.map(config => (
                <Card key={config.id} data-testid={`card-template-${config.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2" data-testid={`text-template-name-${config.id}`}>
                          {getReportTypeIcon(config.type)}
                          {config.name}
                        </CardTitle>
                        <CardDescription className="text-xs" data-testid={`text-template-description-${config.id}`}>
                          {config.description}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getReportTypeBadge(config.type)} data-testid={`badge-template-type-${config.id}`}>
                          {config.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant={config.isActive ? "default" : "secondary"} data-testid={`badge-template-status-${config.id}`}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        Formats: {config.exportFormats.join(", ")}
                      </span>
                      {config.schedule && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {config.schedule.frequency}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card data-testid="card-report-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-history-title">
                <Clock className="h-5 w-5" />
                Report History
              </CardTitle>
              <CardDescription data-testid="text-history-description">
                Previously generated reports
              </CardDescription>
            </CardHeader>
            <CardContent data-testid="container-history">
              {reports.length > 0 ? (
                <div className="space-y-2">
                  {reports.map(report => (
                    <Card key={report.id} className="cursor-pointer hover-elevate" data-testid={`card-history-${report.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {getReportTypeIcon(report.type)}
                            <div>
                              <p className="text-sm font-medium" data-testid={`text-history-title-${report.id}`}>{report.title}</p>
                              <p className="text-xs text-muted-foreground" data-testid={`text-history-date-${report.id}`}>
                                {new Date(report.generatedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getReportTypeBadge(report.type)} data-testid={`badge-history-type-${report.id}`}>
                              {report.type.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant={report.status === "completed" ? "default" : "secondary"} data-testid={`badge-history-status-${report.id}`}>
                              {report.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-empty-history">
                  No reports generated yet. Create your first report from the Generate tab.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
