import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Database,
  Upload,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileJson,
  Table2,
  GitMerge,
  Sparkles,
  Lightbulb,
  TrendingUp,
  Shield,
  RefreshCw,
  Trash2,
  Plus,
  Eye,
  FileCode,
  Layers,
  Target,
} from "lucide-react";

interface MappingRule {
  id: string;
  sourcePath: string;
  sourceFormat: string;
  targetFhirPath: string;
  targetResourceType: string;
  transformationType: string;
  transformationLogic?: string;
  required: boolean;
  validated: boolean;
}

interface IntegrationConflict {
  id: string;
  integrationId: string;
  conflictType: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  sourcePath: string;
  sourceValue: any;
  targetPath?: string;
  suggestedResolution: string;
  resolutionDetails?: string;
  resolvedAt?: string;
  actualResolution?: string;
}

interface DataQualityInsight {
  id: string;
  integrationId: string;
  category: string;
  score: number;
  findings: string[];
  recommendations: string[];
  affectedFields: string[];
  trend?: string;
}

interface FhirTransformedResource {
  resourceType: string;
  id: string;
  originalSourceId: string;
  sourceFormat: string;
  fhirResource: any;
  mappingsApplied: string[];
  qualityScore: number;
  validationErrors: string[];
  createdAt: string;
}

interface DataIntegration {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  sourceFormat: string;
  status: string;
  mappingRules: MappingRule[];
  conflicts: IntegrationConflict[];
  qualityInsights: DataQualityInsight[];
  transformedResources: FhirTransformedResource[];
  statistics: {
    totalRecords: number;
    successfulTransforms: number;
    failedTransforms: number;
    conflictsDetected: number;
    conflictsResolved: number;
    averageQualityScore: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface SourceFormat {
  id: string;
  name: string;
  description: string;
}

export default function FhirDataIntegration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedIntegration, setSelectedIntegration] = useState<DataIntegration | null>(null);
  const [newIntegrationName, setNewIntegrationName] = useState("");
  const [newIntegrationDesc, setNewIntegrationDesc] = useState("");
  const [newIntegrationSystem, setNewIntegrationSystem] = useState("");
  const [newIntegrationFormat, setNewIntegrationFormat] = useState("csv");
  const [sampleDataInput, setSampleDataInput] = useState("");
  const [dataToTransform, setDataToTransform] = useState("");

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<DataIntegration[]>({
    queryKey: ["/api/fhir-integration/integrations"],
  });

  const { data: supportedFormats = { formats: [] } } = useQuery<{ formats: SourceFormat[] }>({
    queryKey: ["/api/fhir-integration/supported-formats"],
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; sourceSystem: string; sourceFormat: string }) => {
      const response = await apiRequest("POST", "/api/fhir-integration/integrations", data);
      return response.json();
    },
    onSuccess: (data: DataIntegration) => {
      setSelectedIntegration(data);
      setNewIntegrationName("");
      setNewIntegrationDesc("");
      setNewIntegrationSystem("");
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({ title: "Integration Created", description: `${data.name} is ready for mapping` });
    },
    onError: () => {
      toast({ title: "Creation Failed", description: "Could not create integration", variant: "destructive" });
    },
  });

  const generateMappingsMutation = useMutation({
    mutationFn: async (data: { integrationId: string; sampleData: any[] }) => {
      const response = await apiRequest("POST", `/api/fhir-integration/integrations/${data.integrationId}/generate-mappings`, {
        sampleData: data.sampleData,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({ title: "Mappings Generated", description: `${data.count} mapping rules created` });
      refreshIntegration();
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate mappings", variant: "destructive" });
    },
  });

  const transformDataMutation = useMutation({
    mutationFn: async (data: { integrationId: string; format: string; records: any[] }) => {
      const response = await apiRequest("POST", `/api/fhir-integration/integrations/${data.integrationId}/transform`, {
        format: data.format,
        sourceSystem: selectedIntegration?.sourceSystem || "unknown",
        records: data.records,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({
        title: "Transformation Complete",
        description: `${data.transformedResources.length} FHIR resources created`,
      });
      refreshIntegration();
    },
    onError: () => {
      toast({ title: "Transformation Failed", description: "Could not transform data", variant: "destructive" });
    },
  });

  const qualityInsightsMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest("POST", `/api/fhir-integration/integrations/${integrationId}/quality-insights`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({ title: "Insights Generated", description: `${data.count} quality insights available` });
      refreshIntegration();
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not generate insights", variant: "destructive" });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async (data: { integrationId: string; conflictId: string; resolution: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/fhir-integration/integrations/${data.integrationId}/conflicts/${data.conflictId}/resolve`,
        { resolution: data.resolution }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({ title: "Conflict Resolved", description: "Resolution applied successfully" });
      refreshIntegration();
    },
    onError: () => {
      toast({ title: "Resolution Failed", description: "Could not resolve conflict", variant: "destructive" });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-integration/integrations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      setSelectedIntegration(null);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-integration/integrations"] });
      toast({ title: "Integration Deleted", description: "Integration removed successfully" });
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete integration", variant: "destructive" });
    },
  });

  function refreshIntegration() {
    if (selectedIntegration) {
      const updated = integrations.find((i) => i.id === selectedIntegration.id);
      if (updated) setSelectedIntegration(updated);
    }
  }

  function handleCreateIntegration() {
    if (!newIntegrationName.trim() || !newIntegrationSystem.trim()) return;
    createIntegrationMutation.mutate({
      name: newIntegrationName,
      description: newIntegrationDesc,
      sourceSystem: newIntegrationSystem,
      sourceFormat: newIntegrationFormat,
    });
  }

  function handleGenerateMappings() {
    if (!selectedIntegration || !sampleDataInput.trim()) return;
    try {
      const parsed = JSON.parse(sampleDataInput);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      generateMappingsMutation.mutate({
        integrationId: selectedIntegration.id,
        sampleData: records,
      });
    } catch {
      toast({ title: "Invalid JSON", description: "Please provide valid JSON data", variant: "destructive" });
    }
  }

  function handleTransformData() {
    if (!selectedIntegration || !dataToTransform.trim()) return;
    try {
      const parsed = JSON.parse(dataToTransform);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      transformDataMutation.mutate({
        integrationId: selectedIntegration.id,
        format: selectedIntegration.sourceFormat,
        records,
      });
    } catch {
      toast({ title: "Invalid JSON", description: "Please provide valid JSON data", variant: "destructive" });
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "conflict_detected":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Conflicts</Badge>;
      case "transforming":
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Transforming</Badge>;
      case "mapping":
        return <Badge variant="secondary"><GitMerge className="w-3 h-3 mr-1" />Mapping</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              AI FHIR Data Integration
            </h1>
            <p className="text-muted-foreground mt-1">
              Automatically map, transform, and integrate data from various sources into FHIR R4 format
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <Layers className="w-4 h-4 mr-1" />
              {integrations.length} Integrations
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  New Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-integration-name">Name</Label>
                  <Input id="fhir-data-integration-name"
                    value={newIntegrationName}
                    onChange={(e) => setNewIntegrationName(e.target.value)}
                    placeholder="My Data Integration"
                    data-testid="input-integration-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-integration-description">Description</Label>
                  <Input id="fhir-data-integration-description"
                    value={newIntegrationDesc}
                    onChange={(e) => setNewIntegrationDesc(e.target.value)}
                    placeholder="Optional description"
                    data-testid="input-integration-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-integration-source-system">Source System</Label>
                  <Input id="fhir-data-integration-source-system"
                    value={newIntegrationSystem}
                    onChange={(e) => setNewIntegrationSystem(e.target.value)}
                    placeholder="e.g., Hospital, Lab System"
                    data-testid="input-source-system"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-data-integration-source-format">Source Format</Label>
                  <Select value={newIntegrationFormat} onValueChange={setNewIntegrationFormat}>
                    <SelectTrigger id="fhir-data-integration-source-format" data-testid="select-source-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedFormats.formats.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreateIntegration}
                  disabled={createIntegrationMutation.isPending || !newIntegrationName.trim() || !newIntegrationSystem.trim()}
                  className="w-full"
                  data-testid="button-create-integration"
                >
                  {createIntegrationMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Integration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {integrationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : integrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No integrations yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {integrations.map((integration) => (
                        <div
                          key={integration.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate transition-colors ${
                            selectedIntegration?.id === integration.id ? "border-primary bg-primary/5" : ""
                          }`}
                          {...clickable(() => setSelectedIntegration(integration))}
                          data-testid={`integration-card-${integration.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{integration.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{integration.sourceSystem}</p>
                            </div>
                            {getStatusBadge(integration.status)}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{integration.statistics.totalRecords} records</span>
                            {integration.statistics.conflictsDetected > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {integration.statistics.conflictsDetected - integration.statistics.conflictsResolved} conflicts
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!selectedIntegration ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ArrowRightLeft className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">Select or create an integration to begin</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    <Eye className="w-4 h-4 mr-1" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="mappings" data-testid="tab-mappings">
                    <GitMerge className="w-4 h-4 mr-1" />
                    Mappings
                  </TabsTrigger>
                  <TabsTrigger value="transform" data-testid="tab-transform">
                    <ArrowRightLeft className="w-4 h-4 mr-1" />
                    Transform
                  </TabsTrigger>
                  <TabsTrigger value="conflicts" data-testid="tab-conflicts">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Conflicts
                  </TabsTrigger>
                  <TabsTrigger value="quality" data-testid="tab-quality">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Quality
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle>{selectedIntegration.name}</CardTitle>
                        <CardDescription>{selectedIntegration.description || "No description"}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(selectedIntegration.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteIntegrationMutation.mutate(selectedIntegration.id)}
                          data-testid="button-delete-integration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Source System</p>
                          <p className="text-lg font-medium">{selectedIntegration.sourceSystem}</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Source Format</p>
                          <p className="text-lg font-medium uppercase">{selectedIntegration.sourceFormat}</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-3xl font-bold text-primary">{selectedIntegration.statistics.totalRecords}</p>
                          <p className="text-sm text-muted-foreground">Total Records</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-3xl font-bold text-green-500">{selectedIntegration.statistics.successfulTransforms}</p>
                          <p className="text-sm text-muted-foreground">Successful</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-3xl font-bold text-red-500">{selectedIntegration.statistics.failedTransforms}</p>
                          <p className="text-sm text-muted-foreground">Failed</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-3xl font-bold">{Math.round(selectedIntegration.statistics.averageQualityScore)}%</p>
                          <p className="text-sm text-muted-foreground">Quality Score</p>
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Mapping Rules</span>
                          <Badge variant="outline">{selectedIntegration.mappingRules.length}</Badge>
                        </div>
                        <Progress value={(selectedIntegration.mappingRules.filter(r => r.validated).length / Math.max(selectedIntegration.mappingRules.length, 1)) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedIntegration.mappingRules.filter(r => r.validated).length} of {selectedIntegration.mappingRules.length} validated
                        </p>
                      </div>

                      {selectedIntegration.transformedResources.length > 0 && (
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm font-medium mb-2">Transformed Resources</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(selectedIntegration.transformedResources.map(r => r.resourceType))).map(type => (
                              <Badge key={type} variant="secondary">
                                {type}: {selectedIntegration.transformedResources.filter(r => r.resourceType === type).length}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="mappings" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitMerge className="w-5 h-5" />
                        AI-Generated Mapping Rules
                      </CardTitle>
                      <CardDescription>
                        Provide sample source data to generate FHIR R4 mapping rules automatically
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fhir-data-integration-sample-data-json">Sample Data (JSON)</Label>
                        <Textarea id="fhir-data-integration-sample-data-json"
                          value={sampleDataInput}
                          onChange={(e) => setSampleDataInput(e.target.value)}
                          placeholder='[{"mrn": "12345", "first_name": "John", "last_name": "Doe", "date_of_birth": "1985-03-15", "gender": "M"}]'
                          className="font-mono text-sm h-32"
                          data-testid="textarea-sample-data"
                        />
                      </div>
                      <Button
                        onClick={handleGenerateMappings}
                        disabled={generateMappingsMutation.isPending || !sampleDataInput.trim()}
                        data-testid="button-generate-mappings"
                      >
                        {generateMappingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Generate Mappings
                      </Button>

                      {selectedIntegration.mappingRules.length > 0 && (
                        <div className="mt-6">
                          <p className="text-sm font-medium mb-3">Current Mapping Rules ({selectedIntegration.mappingRules.length})</p>
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-2">
                              {selectedIntegration.mappingRules.map((rule, i) => (
                                <div key={rule.id} className="p-3 border rounded-lg" data-testid={`mapping-rule-${i}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileCode className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-mono text-sm">{rule.sourcePath}</span>
                                    </div>
                                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm text-primary">{rule.targetFhirPath}</span>
                                      {rule.validated ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-yellow-500" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">{rule.transformationType}</Badge>
                                    <Badge variant="secondary" className="text-xs">{rule.targetResourceType}</Badge>
                                    {rule.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                                  </div>
                                  {rule.transformationLogic && (
                                    <p className="text-xs text-muted-foreground mt-2">{rule.transformationLogic}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transform" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5" />
                        Transform Data to FHIR
                      </CardTitle>
                      <CardDescription>
                        Provide source data to transform into FHIR R4 resources using the generated mapping rules
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fhir-data-integration-data-to-transform-json">Data to Transform (JSON)</Label>
                        <Textarea id="fhir-data-integration-data-to-transform-json"
                          value={dataToTransform}
                          onChange={(e) => setDataToTransform(e.target.value)}
                          placeholder='[{"mrn": "12345", "first_name": "John", "last_name": "Doe", ...}]'
                          className="font-mono text-sm h-40"
                          data-testid="textarea-transform-data"
                        />
                      </div>
                      <Button
                        onClick={handleTransformData}
                        disabled={transformDataMutation.isPending || !dataToTransform.trim() || selectedIntegration.mappingRules.length === 0}
                        data-testid="button-transform-data"
                      >
                        {transformDataMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                        Transform to FHIR
                      </Button>

                      {selectedIntegration.transformedResources.length > 0 && (
                        <div className="mt-6">
                          <p className="text-sm font-medium mb-3">Transformed FHIR Resources ({selectedIntegration.transformedResources.length})</p>
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-2">
                              {selectedIntegration.transformedResources.slice(0, 20).map((resource, i) => (
                                <div key={resource.id} className="p-3 border rounded-lg" data-testid={`transformed-resource-${i}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileJson className="w-4 h-4 text-primary" />
                                      <span className="font-medium">{resource.resourceType}</span>
                                      <span className="text-xs text-muted-foreground font-mono">{resource.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={resource.qualityScore >= 80 ? "default" : resource.qualityScore >= 60 ? "secondary" : "destructive"}>
                                        {resource.qualityScore}%
                                      </Badge>
                                      {resource.validationErrors.length > 0 && (
                                        <Badge variant="destructive">{resource.validationErrors.length} errors</Badge>
                                      )}
                                    </div>
                                  </div>
                                  {resource.validationErrors.length > 0 && (
                                    <div className="mt-2">
                                      {resource.validationErrors.map((err, j) => (
                                        <p key={j} className="text-xs text-red-500">{err}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conflicts" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Data Conflicts
                      </CardTitle>
                      <CardDescription>
                        Detected conflicts during data integration that require review or resolution
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedIntegration.conflicts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                          <p>No conflicts detected</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-3">
                            {selectedIntegration.conflicts.map((conflict, i) => (
                              <div
                                key={conflict.id}
                                className={`p-4 border rounded-lg ${conflict.resolvedAt ? "opacity-60" : ""}`}
                                data-testid={`conflict-${i}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {getSeverityBadge(conflict.severity)}
                                      <Badge variant="outline">{conflict.conflictType.replace("_", " ")}</Badge>
                                      {conflict.resolvedAt && <Badge className="bg-green-500">Resolved</Badge>}
                                    </div>
                                    <p className="text-sm">{conflict.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Path: <span className="font-mono">{conflict.sourcePath}</span>
                                    </p>
                                    {conflict.resolutionDetails && (
                                      <p className="text-xs text-muted-foreground mt-1">{conflict.resolutionDetails}</p>
                                    )}
                                  </div>
                                  {!conflict.resolvedAt && (
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => resolveConflictMutation.mutate({
                                          integrationId: selectedIntegration.id,
                                          conflictId: conflict.id,
                                          resolution: conflict.suggestedResolution,
                                        })}
                                        data-testid={`button-resolve-${conflict.id}`}
                                      >
                                        Apply: {conflict.suggestedResolution.replace("_", " ")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => resolveConflictMutation.mutate({
                                          integrationId: selectedIntegration.id,
                                          conflictId: conflict.id,
                                          resolution: "skip",
                                        })}
                                        data-testid={`button-skip-${conflict.id}`}
                                      >
                                        Skip
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="quality" className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          AI Data Quality Insights
                        </CardTitle>
                        <CardDescription>
                          AI-driven analysis of data quality from integrated sources
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => qualityInsightsMutation.mutate(selectedIntegration.id)}
                        disabled={qualityInsightsMutation.isPending || selectedIntegration.transformedResources.length === 0}
                        data-testid="button-generate-insights"
                      >
                        {qualityInsightsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Analyze Quality
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedIntegration.qualityInsights.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Transform data first, then analyze quality</p>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          {selectedIntegration.qualityInsights.map((insight, i) => (
                            <Card key={insight.id} data-testid={`quality-insight-${i}`}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm capitalize">{insight.category}</CardTitle>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={insight.score >= 80 ? "default" : insight.score >= 60 ? "secondary" : "destructive"}>
                                      {insight.score}%
                                    </Badge>
                                    {insight.trend && (
                                      <TrendingUp className={`w-4 h-4 ${insight.trend === "improving" ? "text-green-500" : insight.trend === "declining" ? "text-red-500" : "text-muted-foreground"}`} />
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div>
                                  <p className="text-xs font-medium mb-1">Findings</p>
                                  <ul className="text-xs text-muted-foreground space-y-1">
                                    {insight.findings.map((f, j) => (
                                      <li key={j} className="flex items-start gap-1">
                                        <Shield className="w-3 h-3 mt-0.5 text-primary" />
                                        <span>{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                {insight.recommendations.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium mb-1">Recommendations</p>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                      {insight.recommendations.map((r, j) => (
                                        <li key={j} className="flex items-start gap-1">
                                          <Lightbulb className="w-3 h-3 mt-0.5 text-yellow-500" />
                                          <span>{r}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
