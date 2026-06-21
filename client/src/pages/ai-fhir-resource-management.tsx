import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, FileJson, Link2, Lightbulb, AlertCircle, 
  Loader2, RefreshCw, Plus, Trash2, ArrowRight, 
  CheckCircle, FileText, Settings, Brain, Info
} from "lucide-react";

interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

interface GeneratedResource {
  id: string;
  resource: FHIRResource;
  naturalLanguageInput: string;
  generatedAt: string;
  confidence: number;
  warnings: string[];
  linkedResources: ResourceLink[];
  disclaimer: string;
}

interface ResourceLink {
  id: string;
  sourceResourceType: string;
  sourceResourceId: string;
  targetResourceType: string;
  targetResourceId: string;
  linkType: string;
  confidence: number;
  autoLinked: boolean;
  rationale: string;
}

interface SuggestedField {
  path: string;
  description: string;
  required: boolean;
  dataType: string;
  example: string;
  clinicalRelevance: "critical" | "high" | "medium" | "low";
}

interface StructureSuggestion {
  id: string;
  resourceType: string;
  useCase: string;
  clinicalGuideline?: string;
  suggestedFields: SuggestedField[];
  requiredExtensions: Array<{ url: string; description: string; valueType: string; required: boolean }>;
  validationRules: string[];
  examples: FHIRResource[];
  confidence: number;
  rationale: string;
}

interface ResourceMetadata {
  version: string;
  supportedResourceTypes: string[];
  totalGenerated: number;
  totalLinks: number;
  totalSuggestions: number;
  noCdsCompliance: string;
}

export default function AIFHIRResourceManagement() {
  const { toast } = useToast();
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("");
  const [useCaseInput, setUseCaseInput] = useState("");
  const [structureResourceType, setStructureResourceType] = useState<string>("");
  const [sourceResourceId, setSourceResourceId] = useState<string>("");
  const [targetResourceId, setTargetResourceId] = useState<string>("");
  const [linkType, setLinkType] = useState<string>("subject");
  const [selectedGeneratedResource, setSelectedGeneratedResource] = useState<GeneratedResource | null>(null);
  const [generatedSuggestion, setGeneratedSuggestion] = useState<StructureSuggestion | null>(null);

  const { data: metadata } = useQuery<ResourceMetadata>({
    queryKey: ['/api/fhir-resource-management/metadata'],
  });

  const { data: resourcesData } = useQuery<{ resources: GeneratedResource[] }>({
    queryKey: ['/api/fhir-resource-management/resources'],
  });

  const { data: linksData } = useQuery<{ links: ResourceLink[] }>({
    queryKey: ['/api/fhir-resource-management/links'],
  });

  const { data: suggestionsData } = useQuery<{ suggestions: StructureSuggestion[] }>({
    queryKey: ['/api/fhir-resource-management/suggestions'],
  });

  const resources = resourcesData?.resources || [];
  const links = linksData?.links || [];
  const suggestions = suggestionsData?.suggestions || [];

  const generateMutation = useMutation({
    mutationFn: async (data: { naturalLanguageInput: string; resourceType?: string }) => {
      const response = await apiRequest('POST', '/api/fhir-resource-management/generate', data);
      return await response.json() as GeneratedResource;
    },
    onSuccess: (data: GeneratedResource) => {
      setSelectedGeneratedResource(data);
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
      toast({ 
        title: "Resource Generated", 
        description: `Created ${data.resource.resourceType} with ${Math.round(data.confidence * 100)}% confidence` 
      });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate FHIR resource", variant: "destructive" });
    }
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: { sourceResourceId: string; targetResourceId: string; linkType: string }) => {
      const response = await apiRequest('POST', '/api/fhir-resource-management/links', data);
      return await response.json() as ResourceLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
      toast({ title: "Link Created", description: "Resources linked successfully" });
      setSourceResourceId("");
      setTargetResourceId("");
    },
    onError: () => {
      toast({ title: "Link Failed", description: "Could not create resource link", variant: "destructive" });
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest('DELETE', `/api/fhir-resource-management/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
      toast({ title: "Link Deleted", description: "Resource link removed" });
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete link", variant: "destructive" });
    }
  });

  const suggestStructureMutation = useMutation({
    mutationFn: async (data: { resourceType: string; useCase: string }) => {
      const response = await apiRequest('POST', '/api/fhir-resource-management/suggest-structure', data);
      return await response.json() as StructureSuggestion;
    },
    onSuccess: (data: StructureSuggestion) => {
      setGeneratedSuggestion(data);
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
      toast({ 
        title: "Structure Suggested", 
        description: `Found ${data.suggestedFields.length} recommended fields` 
      });
    },
    onError: () => {
      toast({ title: "Suggestion Failed", description: "Could not generate structure suggestion", variant: "destructive" });
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      await apiRequest('DELETE', `/api/fhir-resource-management/resources/${resourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
      toast({ title: "Resource Deleted", description: "Generated resource removed" });
      setSelectedGeneratedResource(null);
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete resource", variant: "destructive" });
    }
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/metadata'] });
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/resources'] });
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/links'] });
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-resource-management/suggestions'] });
    toast({ title: "Refreshed", description: "Data reloaded" });
  };

  const getRelevanceBadge = (relevance: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "default",
      medium: "secondary",
      low: "outline"
    };
    return <Badge variant={variants[relevance] || "outline"} data-testid={`badge-relevance-${relevance}`}>{relevance}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">AI FHIR Resource Management</h1>
            <p className="text-muted-foreground">
              Generate, link, and manage FHIR resources using natural language and AI
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">NO-CDS Compliance Notice</p>
              <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="text-compliance-notice">
                {metadata?.noCdsCompliance || "INFORMATIONAL ONLY: This AI-generated FHIR resource is for DATA MANAGEMENT and INTEROPERABILITY purposes ONLY. It does NOT constitute clinical decision support, medical advice, or treatment recommendations."}
              </p>
            </div>
          </div>
        </div>

        {metadata && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-generated-count">{metadata.totalGenerated}</p>
                    <p className="text-sm text-muted-foreground">Generated Resources</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-links-count">{metadata.totalLinks}</p>
                    <p className="text-sm text-muted-foreground">Resource Links</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-suggestions-count">{metadata.totalSuggestions}</p>
                    <p className="text-sm text-muted-foreground">Structure Suggestions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-types-count">{metadata.supportedResourceTypes.length}</p>
                    <p className="text-sm text-muted-foreground">Supported Types</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Brain className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="link" data-testid="tab-link">
              <Link2 className="h-4 w-4 mr-2" />
              Auto-Link
            </TabsTrigger>
            <TabsTrigger value="suggest" data-testid="tab-suggest">
              <Lightbulb className="h-4 w-4 mr-2" />
              Suggest
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <FileText className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate FHIR Resource from Natural Language
                </CardTitle>
                <CardDescription>
                  Describe the clinical data in plain English and AI will generate a valid FHIR R4 resource
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nl-input">Natural Language Description</Label>
                  <Textarea
                    id="nl-input"
                    placeholder="Example: Create a patient record for John Smith, a 45-year-old male with Type 2 diabetes diagnosed in 2020. He lives at 123 Oak Street, Boston, MA and his phone number is 555-0123."
                    value={naturalLanguageInput}
                    onChange={(e) => setNaturalLanguageInput(e.target.value)}
                    rows={4}
                    data-testid="textarea-nl-input"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resource Type (Optional)</Label>
                    <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                      <SelectTrigger data-testid="select-resource-type">
                        <SelectValue placeholder="Auto-detect from description" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        {metadata?.supportedResourceTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => generateMutation.mutate({ 
                        naturalLanguageInput, 
                        resourceType: selectedResourceType && selectedResourceType !== "auto" ? selectedResourceType : undefined 
                      })}
                      disabled={naturalLanguageInput.length < 10 || generateMutation.isPending}
                      className="w-full"
                      data-testid="button-generate"
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Resource
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedGeneratedResource && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      Generated {selectedGeneratedResource.resource.resourceType}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {Math.round(selectedGeneratedResource.confidence * 100)}% confidence
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => deleteResourceMutation.mutate(selectedGeneratedResource.id)}
                        data-testid="button-delete-resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Generated at {new Date(selectedGeneratedResource.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedGeneratedResource.warnings.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Warnings
                      </p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                        {selectedGeneratedResource.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedGeneratedResource.linkedResources.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3">
                      <p className="font-medium text-green-800 dark:text-green-200 mb-1 flex items-center gap-1">
                        <Link2 className="h-4 w-4" />
                        Auto-Linked Resources
                      </p>
                      <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                        {selectedGeneratedResource.linkedResources.map((link) => (
                          <li key={link.id} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3" />
                            {link.sourceResourceType} → {link.targetResourceType} ({link.linkType})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-muted rounded-md p-4 overflow-x-auto">
                    <pre className="text-sm" data-testid="text-generated-json">
                      {JSON.stringify(selectedGeneratedResource.resource, null, 2)}
                    </pre>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      <Info className="h-4 w-4 inline mr-1" />
                      {selectedGeneratedResource.disclaimer}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Link FHIR Resources
                </CardTitle>
                <CardDescription>
                  Create relationships between FHIR resources (e.g., connect Observations to Patients)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Source Resource</Label>
                    <Select value={sourceResourceId} onValueChange={setSourceResourceId}>
                      <SelectTrigger data-testid="select-source-resource">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {resources.map((r) => (
                          <SelectItem key={r.id} value={r.resource.id}>
                            {r.resource.resourceType}/{r.resource.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Link Type</Label>
                    <Select value={linkType} onValueChange={setLinkType}>
                      <SelectTrigger data-testid="select-link-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subject">Subject (Patient)</SelectItem>
                        <SelectItem value="performer">Performer (Practitioner)</SelectItem>
                        <SelectItem value="encounter">Encounter</SelectItem>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="basedOn">Based On</SelectItem>
                        <SelectItem value="partOf">Part Of</SelectItem>
                        <SelectItem value="reference">Reference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Resource</Label>
                    <Select value={targetResourceId} onValueChange={setTargetResourceId}>
                      <SelectTrigger data-testid="select-target-resource">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        {resources.map((r) => (
                          <SelectItem key={r.id} value={r.resource.id}>
                            {r.resource.resourceType}/{r.resource.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => createLinkMutation.mutate({ sourceResourceId, targetResourceId, linkType })}
                  disabled={!sourceResourceId || !targetResourceId || createLinkMutation.isPending}
                  data-testid="button-create-link"
                >
                  {createLinkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Link
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Resource Links</CardTitle>
                <CardDescription>
                  View and manage relationships between FHIR resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {links.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No resource links yet</p>
                ) : (
                  <div className="space-y-3">
                    {links.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-muted rounded-md gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{link.sourceResourceType}</Badge>
                          <span className="text-sm text-muted-foreground">{link.sourceResourceId}</span>
                          <ArrowRight className="h-4 w-4" />
                          <Badge variant={link.autoLinked ? "default" : "secondary"}>
                            {link.linkType}
                          </Badge>
                          <ArrowRight className="h-4 w-4" />
                          <Badge variant="outline">{link.targetResourceType}</Badge>
                          <span className="text-sm text-muted-foreground">{link.targetResourceId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {Math.round(link.confidence * 100)}%
                          </Badge>
                          {link.autoLinked && <Badge variant="outline">Auto</Badge>}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => deleteLinkMutation.mutate(link.id)}
                            data-testid={`button-delete-link-${link.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Suggest FHIR Resource Structure
                </CardTitle>
                <CardDescription>
                  Get AI-powered recommendations for FHIR resource structure based on clinical guidelines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resource Type</Label>
                    <Select value={structureResourceType} onValueChange={setStructureResourceType}>
                      <SelectTrigger data-testid="select-structure-type">
                        <SelectValue placeholder="Select resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        {metadata?.supportedResourceTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Use Case</Label>
                    <Input
                      placeholder="e.g., Recording vital signs, Lab results entry"
                      value={useCaseInput}
                      onChange={(e) => setUseCaseInput(e.target.value)}
                      data-testid="input-use-case"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => suggestStructureMutation.mutate({ 
                    resourceType: structureResourceType, 
                    useCase: useCaseInput 
                  })}
                  disabled={!structureResourceType || useCaseInput.length < 5 || suggestStructureMutation.isPending}
                  data-testid="button-suggest-structure"
                >
                  {suggestStructureMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lightbulb className="h-4 w-4 mr-2" />
                  )}
                  Get Suggestions
                </Button>
              </CardContent>
            </Card>

            {generatedSuggestion && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" />
                        {generatedSuggestion.resourceType} Structure
                      </CardTitle>
                      <CardDescription>
                        Use case: {generatedSuggestion.useCase}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {Math.round(generatedSuggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedSuggestion.clinicalGuideline && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <Info className="h-4 w-4 inline mr-1" />
                        Based on: {generatedSuggestion.clinicalGuideline}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-2">Suggested Fields</h4>
                    <div className="space-y-2">
                      {generatedSuggestion.suggestedFields.map((field, i) => (
                        <div key={i} className="p-3 bg-muted rounded-md">
                          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                                {field.path}
                              </code>
                              {field.required && <Badge>Required</Badge>}
                              {getRelevanceBadge(field.clinicalRelevance)}
                            </div>
                            <Badge variant="outline">{field.dataType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">Example: {field.example}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {generatedSuggestion.validationRules.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Validation Rules</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {generatedSuggestion.validationRules.map((rule, i) => (
                          <li key={i}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-muted rounded-md p-3">
                    <p className="text-sm text-muted-foreground">
                      {generatedSuggestion.rationale}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {suggestions.length > 0 && !generatedSuggestion && (
              <Card>
                <CardHeader>
                  <CardTitle>Previous Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suggestions.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-3 bg-muted rounded-md cursor-pointer"
                        onClick={() => setGeneratedSuggestion(s)}
                        data-testid={`suggestion-${s.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{s.resourceType}</Badge>
                            <span className="text-sm">{s.useCase}</span>
                          </div>
                          <Badge variant="secondary">{s.suggestedFields.length} fields</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Resources History
                </CardTitle>
                <CardDescription>
                  View all previously generated FHIR resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resources.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No generated resources yet</p>
                ) : (
                  <div className="space-y-3">
                    {resources.map((r) => (
                      <div 
                        key={r.id} 
                        className="p-4 bg-muted rounded-md cursor-pointer"
                        onClick={() => setSelectedGeneratedResource(r)}
                        data-testid={`resource-${r.id}`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            <Badge variant="outline">{r.resource.resourceType}</Badge>
                            <span className="text-sm font-mono">{r.resource.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {Math.round(r.confidence * 100)}%
                            </Badge>
                            {r.linkedResources.length > 0 && (
                              <Badge variant="outline">
                                <Link2 className="h-3 w-3 mr-1" />
                                {r.linkedResources.length} links
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteResourceMutation.mutate(r.id);
                              }}
                              data-testid={`button-delete-${r.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {r.naturalLanguageInput}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Generated: {new Date(r.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
