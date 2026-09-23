import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Wand2,
  FileJson,
  Copy,
  Download,
  History,
  ChevronRight,
  ChevronDown,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  Sparkles,
  User,
  Activity,
  Pill,
  Stethoscope,
  FileText,
  Calendar,
  Building,
  Shield,
} from "lucide-react";

interface ResourceType {
  type: string;
  description: string;
  hasUSCoreProfile: boolean;
}

interface Profile {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
}

interface GeneratedTemplate {
  id: string;
  resourceType: string;
  profile: string;
  fhirVersion: string;
  resource: Record<string, unknown>;
  validationNotes: string[];
  usageGuidance: string;
  relatedResources?: string[];
  generatedAt: string;
}

interface TemplateHistory {
  id: string;
  request: {
    resourceType: string;
    profile: string;
    context: Record<string, unknown>;
  };
  template: GeneratedTemplate;
  createdAt: string;
}

const RESOURCE_ICONS: Record<string, typeof User> = {
  Patient: User,
  Observation: Activity,
  MedicationRequest: Pill,
  Condition: Stethoscope,
  Procedure: Stethoscope,
  DiagnosticReport: FileText,
  Encounter: Calendar,
  Organization: Building,
  Practitioner: User,
  Immunization: Shield,
};

export function FHIRTemplateGenerator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<string>("us-core");
  const [customProfileUrl, setCustomProfileUrl] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [conditions, setConditions] = useState("");
  const [specificDetails, setSpecificDetails] = useState("");
  const [useCase, setUseCase] = useState("");
  const [includeExtensions, setIncludeExtensions] = useState(true);
  const [includeNarrative, setIncludeNarrative] = useState(true);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const { data: resourceTypes = [] } = useQuery<ResourceType[]>({
    queryKey: ["/api/fhir-template-generator/resource-types"],
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["/api/fhir-template-generator/profiles"],
  });

  const { data: history = [], refetch: refetchHistory } = useQuery<TemplateHistory[]>({
    queryKey: ["/api/fhir-template-generator/history"],
  });

  const generateMutation = useMutation({
    mutationFn: async (request: {
      resourceType: string;
      profile: string;
      customProfileUrl?: string;
      context: Record<string, unknown>;
    }) => {
      const response = await apiRequest("POST", "/api/fhir-template-generator/generate", request);
      return response.json();
    },
    onSuccess: (data: GeneratedTemplate) => {
      setGeneratedTemplate(data);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-template-generator/history"] });
      toast({
        title: "Template Generated",
        description: `Successfully generated ${data.resourceType} template`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/fhir-template-generator/history");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-template-generator/history"] });
      toast({
        title: "History Cleared",
        description: "Template generation history has been cleared",
      });
    },
  });

  const handleGenerate = () => {
    if (!selectedResourceType) {
      toast({
        title: "Resource Type Required",
        description: "Please select a FHIR resource type",
        variant: "destructive",
      });
      return;
    }

    const context: Record<string, unknown> = {
      includeExtensions,
      includeNarrativeText: includeNarrative,
    };

    if (patientName || patientAge || patientGender || conditions) {
      context.patientContext = {
        ...(patientName && { name: patientName }),
        ...(patientAge && { age: parseInt(patientAge, 10) }),
        ...(patientGender && { gender: patientGender }),
        ...(conditions && { conditions: conditions.split(",").map(c => c.trim()) }),
      };
    }

    if (specificDetails) {
      context.specificDetails = specificDetails;
    }

    if (useCase) {
      context.useCase = useCase;
    }

    generateMutation.mutate({
      resourceType: selectedResourceType,
      profile: selectedProfile,
      ...(selectedProfile === "custom" && customProfileUrl && { customProfileUrl }),
      context,
    });
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Template copied to clipboard",
    });
  };

  const downloadTemplate = (template: GeneratedTemplate) => {
    const blob = new Blob([JSON.stringify(template.resource, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.resourceType}-${template.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleHistoryExpand = (id: string) => {
    const newExpanded = new Set(expandedHistory);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedHistory(newExpanded);
  };

  const getResourceIcon = (type: string) => {
    const Icon = RESOURCE_ICONS[type] || FileJson;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">AI FHIR Template Generator</h1>
          <p className="text-muted-foreground">
            Generate compliant FHIR resources with AI assistance
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          AI-Powered
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Template
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Resource Configuration
                </CardTitle>
                <CardDescription>
                  Select the resource type and profile for generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resource-type">FHIR Resource Type</Label>
                  <Select
                    value={selectedResourceType}
                    onValueChange={setSelectedResourceType}
                  >
                    <SelectTrigger id="resource-type" data-testid="select-resource-type">
                      <SelectValue placeholder="Select a resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceTypes.map((rt) => (
                        <SelectItem key={rt.type} value={rt.type}>
                          <div className="flex items-center gap-2">
                            {getResourceIcon(rt.type)}
                            <span>{rt.type}</span>
                            {rt.hasUSCoreProfile && (
                              <Badge variant="secondary" className="text-xs">US Core</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedResourceType && resourceTypes.find(r => r.type === selectedResourceType) && (
                    <p className="text-sm text-muted-foreground">
                      {resourceTypes.find(r => r.type === selectedResourceType)?.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile">FHIR Profile</Label>
                  <Select
                    value={selectedProfile}
                    onValueChange={setSelectedProfile}
                  >
                    <SelectTrigger id="profile" data-testid="select-profile">
                      <SelectValue placeholder="Select a profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProfile && profiles.find(p => p.id === selectedProfile) && (
                    <p className="text-sm text-muted-foreground">
                      {profiles.find(p => p.id === selectedProfile)?.description}
                    </p>
                  )}
                </div>

                {selectedProfile === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-profile-url">Custom Profile URL</Label>
                    <Input
                      id="custom-profile-url"
                      placeholder="http://example.org/fhir/StructureDefinition/custom-profile"
                      value={customProfileUrl}
                      onChange={(e) => setCustomProfileUrl(e.target.value)}
                      data-testid="input-custom-profile-url"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FieldCaption>Include Extensions</FieldCaption>
                    <p className="text-sm text-muted-foreground">
                      Add profile-specific extensions
                    </p>
                  </div>
                  <Switch
                    checked={includeExtensions}
                    onCheckedChange={setIncludeExtensions}
                    data-testid="switch-extensions"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FieldCaption>Include Narrative</FieldCaption>
                    <p className="text-sm text-muted-foreground">
                      Generate human-readable text.div
                    </p>
                  </div>
                  <Switch
                    checked={includeNarrative}
                    onCheckedChange={setIncludeNarrative}
                    data-testid="switch-narrative"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Context Details
                </CardTitle>
                <CardDescription>
                  Provide context for more realistic template generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient-name">Patient Name</Label>
                    <Input
                      id="patient-name"
                      placeholder="John Smith"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      data-testid="input-patient-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-age">Age</Label>
                    <Input
                      id="patient-age"
                      type="number"
                      placeholder="45"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      data-testid="input-patient-age"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient-gender">Gender</Label>
                  <Select value={patientGender} onValueChange={setPatientGender}>
                    <SelectTrigger id="patient-gender" data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conditions">Known Conditions</Label>
                  <Input
                    id="conditions"
                    placeholder="Type 2 Diabetes, Hypertension"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    data-testid="input-conditions"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of conditions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="use-case">Use Case</Label>
                  <Input
                    id="use-case"
                    placeholder="e.g., Lab result for annual checkup"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    data-testid="input-use-case"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specific-details">Specific Details</Label>
                  <Textarea
                    id="specific-details"
                    placeholder="Any additional details for the resource..."
                    value={specificDetails}
                    onChange={(e) => setSpecificDetails(e.target.value)}
                    rows={3}
                    data-testid="textarea-details"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedResourceType}
              className="gap-2"
              data-testid="btn-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Wand2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  Generate FHIR Template
                </>
              )}
            </Button>
          </div>

          {generatedTemplate && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <CardTitle>Generated {generatedTemplate.resourceType}</CardTitle>
                    <Badge>{generatedTemplate.profile.toUpperCase()}</Badge>
                    <Badge variant="outline">{generatedTemplate.fhirVersion}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(generatedTemplate.resource, null, 2))}
                      data-testid="btn-copy"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate(generatedTemplate)}
                      data-testid="btn-download"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Generated at {new Date(generatedTemplate.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-sm" data-testid="text-generated-resource">
                    {JSON.stringify(generatedTemplate.resource, null, 2)}
                  </pre>
                </div>

                {generatedTemplate.usageGuidance && (
                  <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Usage Guidance</p>
                      <p className="text-sm text-muted-foreground">
                        {generatedTemplate.usageGuidance}
                      </p>
                    </div>
                  </div>
                )}

                {generatedTemplate.validationNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Validation Notes
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {generatedTemplate.validationNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500">-</span>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedTemplate.relatedResources && generatedTemplate.relatedResources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Related Resources:</span>
                    {generatedTemplate.relatedResources.map((r) => (
                      <Badge key={r} variant="outline" className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedResourceType(r)}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-muted-foreground">
              Previously generated templates
            </p>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearHistoryMutation.mutate()}
                disabled={clearHistoryMutation.isPending}
                data-testid="btn-clear-history"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear History
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No templates generated yet</p>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab("generate")}
                >
                  Generate your first template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <Collapsible
                  key={item.id}
                  open={expandedHistory.has(item.id)}
                  onOpenChange={() => toggleHistoryExpand(item.id)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover-elevate">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {expandedHistory.has(item.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            {getResourceIcon(item.template.resourceType)}
                            <div>
                              <CardTitle className="text-base">
                                {item.template.resourceType}
                              </CardTitle>
                              <CardDescription>
                                {new Date(item.createdAt).toLocaleString()}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{item.template.profile.toUpperCase()}</Badge>
                            <Badge variant="outline">{item.template.fhirVersion}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="bg-muted rounded-lg p-4 overflow-auto max-h-64">
                          <pre className="text-sm">
                            {JSON.stringify(item.template.resource, null, 2)}
                          </pre>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(item.template.resource, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTemplate(item.template)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedResourceType(item.request.resourceType);
                              setSelectedProfile(item.request.profile);
                              setActiveTab("generate");
                            }}
                          >
                            Regenerate
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FHIRTemplateGenerator;
