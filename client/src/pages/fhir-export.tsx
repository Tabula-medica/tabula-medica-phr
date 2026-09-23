import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Download, FileJson, FileSpreadsheet, FileCode, FileText, Sparkles,
  CheckCircle2, Clock, XCircle, AlertTriangle, Play, Eye, Loader2, Lightbulb, Package
} from "lucide-react";

interface ExportFormat {
  format: string;
  name: string;
  description: string;
  mimeType: string;
}

interface ResourceType {
  type: string;
  displayName: string;
  category: string;
}

interface ExportJob {
  id: string;
  requestId: string;
  status: string;
  format: string;
  resourceTypes: string[];
  progress: number;
  totalResources: number;
  exportedResources: number;
  startedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
  metadata: { patientCount?: number; resourceCounts?: Record<string, number> };
}

interface ExportSuggestion {
  id: string;
  name: string;
  description: string;
  useCase: string;
  resourceTypes: string[];
  suggestedFormat: string;
  priority: string;
  estimatedRecords: number;
  rationale: string;
}

interface ExportPreview {
  resourceCounts: Record<string, number>;
  totalRecords: number;
  estimatedFileSize: string;
  sampleData: Record<string, unknown[]>;
  warnings: string[];
}

function FormatIcon({ format }: { format: string }) {
  switch (format) {
    case "fhir_json": return <FileJson className="h-4 w-4" />;
    case "fhir_xml": return <FileCode className="h-4 w-4" />;
    case "csv": return <FileSpreadsheet className="h-4 w-4" />;
    case "hl7v2": return <FileText className="h-4 w-4" />;
    case "ndjson": return <FileJson className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; className: string }> = {
    pending: { icon: Clock, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    processing: { icon: Loader2, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    completed: { icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    failed: { icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { icon: XCircle, className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  };
  const Icon = config[status]?.icon || Clock;
  return (
    <Badge className={`gap-1 ${config[status]?.className || ""}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {status}
    </Badge>
  );
}

export default function FHIRExportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("create");
  const [selectedResources, setSelectedResources] = useState<string[]>(["Patient", "Observation", "Condition"]);
  const [selectedFormat, setSelectedFormat] = useState("fhir_json");
  const [exportName, setExportName] = useState("My Export");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [includeRelated, setIncludeRelated] = useState(true);
  const [deidentify, setDeidentify] = useState(false);

  const { data: formatsData } = useQuery<{ formats: ExportFormat[] }>({
    queryKey: ["/api/fhir-export/formats"],
  });

  const { data: resourceTypesData } = useQuery<{ resourceTypes: ResourceType[] }>({
    queryKey: ["/api/fhir-export/resource-types"],
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ jobs: ExportJob[] }>({
    queryKey: ["/api/fhir-export/jobs"],
    refetchInterval: 3000,
  });

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery<{ suggestions: ExportSuggestion[] }>({
    queryKey: ["/api/fhir-export/suggestions"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-export/suggestions", {});
      return res.json();
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-export/preview", {
        name: exportName,
        resourceTypes: selectedResources,
        format: selectedFormat,
        filters: {
          dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
          includeRelatedResources: includeRelated,
        },
        options: { deidentify },
      });
      return res.json();
    },
  });

  const createExportMutation = useMutation({
    mutationFn: async () => {
      const reqRes = await apiRequest("POST", "/api/fhir-export/requests", {
        name: exportName,
        resourceTypes: selectedResources,
        format: selectedFormat,
        filters: {
          dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
          includeRelatedResources: includeRelated,
        },
        options: { deidentify },
      });
      const request = await reqRes.json();
      const jobRes = await apiRequest("POST", `/api/fhir-export/start/${request.id}`, {});
      return jobRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-export/jobs"] });
      toast({ title: "Export Started", description: "Your export is being processed." });
      setActiveTab("history");
    },
    onError: () => {
      toast({ title: "Export Failed", description: "Unable to start export.", variant: "destructive" });
    },
  });

  const applySuggestion = (suggestion: ExportSuggestion) => {
    setSelectedResources(suggestion.resourceTypes);
    setSelectedFormat(suggestion.suggestedFormat);
    setExportName(suggestion.name);
    toast({ title: "Suggestion Applied", description: `Configured export for: ${suggestion.name}` });
  };

  const toggleResource = (resource: string) => {
    setSelectedResources((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]
    );
  };

  const preview = previewMutation.data as ExportPreview | undefined;

  const groupedResources = resourceTypesData?.resourceTypes.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, ResourceType[]>) || {};

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Data Export</h1>
          <p className="text-muted-foreground">Export health records in multiple formats with AI-powered suggestions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="create" className="gap-2" data-testid="tab-create">
            <Package className="h-4 w-4" />Create Export
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2" data-testid="tab-suggestions">
            <Sparkles className="h-4 w-4" />AI Suggestions
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />Export History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Select Resources</CardTitle>
                  <CardDescription>Choose which FHIR resources to include in your export</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupedResources).map(([category, resources]) => (
                      <div key={category}>
                        <h4 className="font-medium text-sm mb-2">{category}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {resources.map((r) => (
                            <div role="presentation"
                              key={r.type}
                              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover-elevate ${
                                selectedResources.includes(r.type) ? "border-primary bg-primary/5" : ""
                              }`}
                              onClick={() => toggleResource(r.type)}
                              data-testid={`resource-${r.type}`}
                            >
                              <Checkbox
                                checked={selectedResources.includes(r.type)}
                                onCheckedChange={() => toggleResource(r.type)}
                              />
                              <span className="text-sm">{r.displayName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Export Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fhir-export-export-name">Export Name</Label>
                      <Input id="fhir-export-export-name"
                        value={exportName}
                        onChange={(e) => setExportName(e.target.value)}
                        placeholder="My Health Records"
                        data-testid="input-export-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fhir-export-export-format">Export Format</Label>
                      <Select value={selectedFormat} onValueChange={setSelectedFormat} data-testid="select-format">
                        <SelectTrigger id="fhir-export-export-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formatsData?.formats.map((f) => (
                            <SelectItem key={f.format} value={f.format}>
                              <div className="flex items-center gap-2">
                                <FormatIcon format={f.format} />
                                {f.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fhir-export-date-range-start">Date Range Start</Label>
                      <Input id="fhir-export-date-range-start"
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        data-testid="input-date-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fhir-export-date-range-end">Date Range End</Label>
                      <Input id="fhir-export-date-range-end"
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        data-testid="input-date-end"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={includeRelated} onCheckedChange={setIncludeRelated} data-testid="switch-related" />
                      <FieldCaption>Include related resources</FieldCaption>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={deidentify} onCheckedChange={setDeidentify} data-testid="switch-deidentify" />
                      <FieldCaption>De-identify data (for research)</FieldCaption>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />Export Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => previewMutation.mutate()}
                    disabled={previewMutation.isPending || selectedResources.length === 0}
                    data-testid="button-preview"
                  >
                    {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Generate Preview
                  </Button>

                  {preview && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Total Records:</span>
                        <span className="font-medium">{preview.totalRecords}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Estimated Size:</span>
                        <span className="font-medium">{preview.estimatedFileSize}</span>
                      </div>
                      <Separator />
                      <div className="space-y-1">
                        {Object.entries(preview.resourceCounts).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{type}:</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                      {preview.warnings.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            {preview.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-yellow-600">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                {w}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                className="w-full gap-2"
                onClick={() => createExportMutation.mutate()}
                disabled={createExportMutation.isPending || selectedResources.length === 0}
                data-testid="button-start-export"
              >
                {createExportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start Export
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI-Powered Export Suggestions
              </CardTitle>
              <CardDescription>
                Intelligent recommendations based on common healthcare data export use cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {suggestionsData?.suggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="hover-elevate">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium">{suggestion.name}</h4>
                          <Badge variant={
                            suggestion.priority === "high" ? "default" :
                            suggestion.priority === "medium" ? "secondary" : "outline"
                          }>{suggestion.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {suggestion.resourceTypes.slice(0, 4).map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                          {suggestion.resourceTypes.length > 4 && (
                            <Badge variant="secondary" className="text-xs">+{suggestion.resourceTypes.length - 4}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <FormatIcon format={suggestion.suggestedFormat} />
                          <span>{formatsData?.formats.find((f) => f.format === suggestion.suggestedFormat)?.name}</span>
                          <span>|</span>
                          <span>~{suggestion.estimatedRecords} records</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs mb-3">
                          <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
                          <span className="text-muted-foreground">{suggestion.rationale}</span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => {
                            applySuggestion(suggestion);
                            setActiveTab("create");
                          }}
                          data-testid={`button-apply-${suggestion.id}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          Use This Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
              <CardDescription>View and download your previous exports</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {jobsData?.jobs.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <FormatIcon format={job.format} />
                                <span className="font-medium">{job.format.toUpperCase()}</span>
                                <StatusBadge status={job.status} />
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {job.resourceTypes.slice(0, 4).map((r) => (
                                  <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                                ))}
                                {job.resourceTypes.length > 4 && (
                                  <Badge variant="secondary" className="text-xs">+{job.resourceTypes.length - 4}</Badge>
                                )}
                              </div>
                              {job.status === "processing" && (
                                <div className="space-y-1">
                                  <Progress value={job.progress} className="h-2" />
                                  <p className="text-xs text-muted-foreground">
                                    {job.exportedResources} / {job.totalResources} resources ({job.progress}%)
                                  </p>
                                </div>
                              )}
                              {job.status === "completed" && (
                                <div className="text-xs text-muted-foreground">
                                  {job.totalResources} resources | {job.fileSize ? `${(job.fileSize / 1024).toFixed(1)} KB` : ""}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Started: {new Date(job.startedAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              {job.status === "completed" && job.downloadUrl && (
                                <Button size="sm" className="gap-2" asChild data-testid={`button-download-${job.id}`}>
                                  <a href={job.downloadUrl} download>
                                    <Download className="h-4 w-4" />
                                    Download
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {(!jobsData?.jobs || jobsData.jobs.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No exports yet. Create one to get started.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
