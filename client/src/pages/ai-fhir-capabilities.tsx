import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, GitMerge, FileJson, Brain, TrendingUp, RefreshCw,
  AlertCircle, CheckCircle, Lightbulb, Wand2, Copy, Download,
  ArrowRight, Target, Activity, BarChart3, XCircle, Send
} from "lucide-react";

export default function AIFHIRCapabilities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("mapper");
  const [nlPrompt, setNlPrompt] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("auto");
  const [sourceJson, setSourceJson] = useState('{\n  "resourceType": "Patient",\n  "name": [{ "family": "Doe", "given": ["John"] }]\n}');

  const { data: mapperStats, isLoading: mapperLoading } = useQuery<any>({
    queryKey: ["/api/ai-fhir-mapper/stats"]
  });

  const { data: insightsStats, isLoading: insightsLoading } = useQuery<any>({
    queryKey: ["/api/ai-fhir-insights/stats"]
  });

  const { data: generatorStats, isLoading: generatorLoading } = useQuery<any>({
    queryKey: ["/api/ai-fhir-generator/stats"]
  });

  const { data: mappingRules } = useQuery<any>({
    queryKey: ["/api/ai-fhir-mapper/rules"]
  });

  const { data: recentInsights } = useQuery<any>({
    queryKey: ["/api/ai-fhir-insights/recent"]
  });

  const { data: generatedResources } = useQuery<any>({
    queryKey: ["/api/ai-fhir-generator/resources"]
  });

  const { data: templates } = useQuery<any>({
    queryKey: ["/api/ai-fhir-generator/templates"]
  });

  const { data: resourceTypes } = useQuery<any>({
    queryKey: ["/api/ai-fhir-generator/resource-types"]
  });

  const mapResourceMutation = useMutation({
    mutationFn: async (data: { sourceResource: any; targetFormat: string }) => {
      const res = await apiRequest("POST", "/api/ai-fhir-mapper/map", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Resource Mapped", description: `Quality score: ${(data.quality?.completeness * 100).toFixed(0)}%` });
    },
    onError: () => {
      toast({ title: "Mapping Failed", variant: "destructive" });
    }
  });

  const generateResourceMutation = useMutation({
    mutationFn: async (data: { prompt: string; resourceType?: string }) => {
      const res = await apiRequest("POST", "/api/ai-fhir-generator/generate", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-fhir-generator/resources"] });
      toast({ 
        title: "Resource Generated", 
        description: `Created ${data.resourceType} with ${data.validation?.isValid ? 'no' : data.validation?.errors?.length || 0} errors`
      });
    },
    onError: () => {
      toast({ title: "Generation Failed", variant: "destructive" });
    }
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async (data: { patientId: string; fhirData: any }) => {
      const res = await apiRequest("POST", "/api/ai-fhir-insights/generate", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-fhir-insights/recent"] });
      toast({ title: "Insights Generated", description: `Created ${data.insights?.length || 0} insights` });
    },
    onError: () => {
      toast({ title: "Insights Generation Failed", variant: "destructive" });
    }
  });

  const handleMapResource = () => {
    try {
      const parsed = JSON.parse(sourceJson);
      mapResourceMutation.mutate({ sourceResource: parsed, targetFormat: "FHIR R4" });
    } catch {
      toast({ title: "Invalid JSON", variant: "destructive" });
    }
  };

  const handleGenerateResource = () => {
    if (!nlPrompt.trim()) {
      toast({ title: "Please enter a description", variant: "destructive" });
      return;
    }
    generateResourceMutation.mutate({ 
      prompt: nlPrompt, 
      resourceType: selectedResourceType !== "auto" ? selectedResourceType : undefined 
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (mapperLoading && insightsLoading && generatorLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            AI-Powered FHIR Capabilities
          </h1>
          <p className="text-muted-foreground">
            Intelligent resource mapping, data insights, and natural language generation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Resource Mapper</CardTitle>
            <GitMerge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mapperStats?.totalRules || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(mapperStats?.totalMappings || 0).toLocaleString()} mappings performed
            </p>
            <Progress value={(mapperStats?.successRate || 0) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Insights Engine</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insightsStats?.totalInsights || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg confidence: {((insightsStats?.avgConfidence || 0) * 100).toFixed(0)}%
            </p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {insightsStats?.recentAlerts?.slice(0, 2).map((alert: any, i: number) => (
                <Badge key={i} variant="destructive" className="text-xs">{alert.type}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Resource Generator</CardTitle>
            <Wand2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{generatorStats?.totalGenerated || 0}</div>
            <p className="text-xs text-muted-foreground">
              Validation score: {((generatorStats?.avgValidationScore || 0) * 100).toFixed(0)}%
            </p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {Object.entries(generatorStats?.byStatus || {}).map(([status, count]: [string, any]) => (
                <Badge key={status} variant="outline" className="text-xs">{status}: {count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="text-sm text-muted-foreground p-3 bg-muted/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        AI-generated content is for informational and testing purposes only. Not for clinical decision-making.
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList data-testid="tabs-ai-fhir">
          <TabsTrigger value="mapper" data-testid="tab-mapper">
            <GitMerge className="w-4 h-4 mr-1" />
            Resource Mapper
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Lightbulb className="w-4 h-4 mr-1" />
            Insights Engine
          </TabsTrigger>
          <TabsTrigger value="generator" data-testid="tab-generator">
            <Wand2 className="w-4 h-4 mr-1" />
            Resource Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapper" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Mapping operations are for data governance and interoperability purposes only.
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Map Resource</CardTitle>
                <CardDescription>Convert FHIR resources to standardized R4 format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  value={sourceJson}
                  onChange={(e) => setSourceJson(e.target.value)}
                  className="font-mono h-48"
                  placeholder="Paste source FHIR resource JSON..."
                  data-testid="textarea-source"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleMapResource}
                    disabled={mapResourceMutation.isPending}
                    data-testid="button-map"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Map to FHIR R4
                  </Button>
                </div>
                {mapResourceMutation.data && (
                  <div className="p-3 bg-muted/50 rounded space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium">Mapping Complete</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-background rounded">
                        <div className="text-muted-foreground">Completeness</div>
                        <div className="font-medium">{((mapResourceMutation.data as any).quality?.completeness * 100).toFixed(0)}%</div>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <div className="text-muted-foreground">Accuracy</div>
                        <div className="font-medium">{((mapResourceMutation.data as any).quality?.accuracy * 100).toFixed(0)}%</div>
                      </div>
                      <div className="p-2 bg-background rounded">
                        <div className="text-muted-foreground">Compliance</div>
                        <div className="font-medium">{((mapResourceMutation.data as any).quality?.standardCompliance * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mapping Rules</CardTitle>
                <CardDescription>Active transformation rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mappingRules?.rules?.slice(0, 5).map((rule: any) => (
                    <div key={rule.id} className="p-3 border rounded-lg hover-elevate">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{rule.name}</div>
                        <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
                          {rule.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{rule.sourceFormat}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{rule.targetFormat}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {rule.usageCount.toLocaleString()} uses | {rule.fieldMappings?.length || 0} field mappings
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            AI insights are for informational purposes only. Verify with clinical judgment before any care decisions.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generate Insights</CardTitle>
                <CardDescription>Analyze patient FHIR data for health insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Patient ID" data-testid="input-patient-id" />
                <Textarea 
                  placeholder="Paste patient FHIR data (Observations, Conditions, etc.)..."
                  className="font-mono h-32"
                  data-testid="textarea-patient-data"
                />
                <Button 
                  onClick={() => generateInsightsMutation.mutate({ 
                    patientId: "patient-default", 
                    fhirData: { resourceType: "Bundle", entry: [] }
                  })}
                  disabled={generateInsightsMutation.isPending}
                  data-testid="button-generate-insights"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Insights
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Insights</CardTitle>
                <CardDescription>Latest AI-generated health insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {recentInsights?.insights?.slice(0, 6).map((insight: any) => (
                    <div key={insight.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{insight.title}</span>
                        </div>
                        <Badge variant={getSeverityColor(insight.severity) as any}>
                          {insight.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.summary}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline">{insight.type.replace('_', ' ')}</Badge>
                        <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                      </div>
                      {insight.recommendations?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Recommendations:</span> {insight.recommendations[0]}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!recentInsights?.insights || recentInsights.insights.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="w-12 h-12 mx-auto mb-2" />
                      No insights generated yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insight Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(insightsStats?.insightsByType || {}).map(([type, count]: [string, any]) => (
                  <div key={type} className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{type.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generator" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Generated resources are for testing and validation. Review thoroughly before clinical use.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Natural Language Generator</CardTitle>
                <CardDescription>Create FHIR resources from plain English descriptions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                  <SelectTrigger data-testid="select-resource-type">
                    <SelectValue placeholder="Auto-detect resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {resourceTypes?.resourceTypes?.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Textarea 
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  placeholder="Describe the FHIR resource in plain English...

Example: Create a patient named John Smith, male, born on 1985-03-15, living in Boston MA with phone number 555-0123"
                  className="h-32"
                  data-testid="textarea-prompt"
                />
                
                <Button 
                  onClick={handleGenerateResource}
                  disabled={generateResourceMutation.isPending}
                  className="w-full"
                  data-testid="button-generate"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {generateResourceMutation.isPending ? "Generating..." : "Generate FHIR Resource"}
                </Button>

                {generateResourceMutation.data && (
                  <div className="p-3 bg-muted/50 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(generateResourceMutation.data as any).validation?.isValid ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium">{(generateResourceMutation.data as any).resourceType}</span>
                      </div>
                      <Badge variant={(generateResourceMutation.data as any).validation?.isValid ? 'default' : 'destructive'}>
                        Score: {((generateResourceMutation.data as any).validation?.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-48">
                      {JSON.stringify((generateResourceMutation.data as any).resource, null, 2)}
                    </pre>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify((generateResourceMutation.data as any).resource, null, 2))}>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Templates & Examples</CardTitle>
                <CardDescription>Quick-start templates for common resource types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templates?.templates?.map((template: any) => (
                    <div key={template.id} className="p-3 border rounded-lg hover-elevate">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-primary" />
                          <span className="font-medium">{template.name}</span>
                        </div>
                        <Badge variant="outline">{template.usageCount} uses</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                      <div className="mt-2">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Example prompts:</div>
                        {template.examplePrompts?.slice(0, 2).map((prompt: string, i: number) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1 px-2 text-left justify-start w-full"
                            onClick={() => {
                              setNlPrompt(prompt);
                              setSelectedResourceType(template.resourceType);
                            }}
                          >
                            "{prompt.substring(0, 50)}..."
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated Resources</CardTitle>
              <CardDescription>History of AI-generated FHIR resources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {generatedResources?.resources?.slice(0, 10).map((res: any) => (
                  <div key={res.id} className="p-3 border rounded-lg flex items-center justify-between hover-elevate">
                    <div className="flex items-center gap-3">
                      <FileJson className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{res.resourceType}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {res.originalPrompt}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={res.status === 'committed' ? 'default' : res.status === 'validated' ? 'secondary' : 'outline'}>
                        {res.status}
                      </Badge>
                      <Badge variant={res.validation?.isValid ? 'default' : 'destructive'}>
                        {(res.validation?.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!generatedResources?.resources || generatedResources.resources.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wand2 className="w-12 h-12 mx-auto mb-2" />
                    No resources generated yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
