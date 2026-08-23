import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowRight, CheckCircle, XCircle, AlertTriangle, Sparkles,
  RefreshCw, FileText, Shield, Layers, GitCompare, Lightbulb
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FHIRVersion = "DSTU2" | "STU3" | "R4" | "R4B" | "R5";

interface MappingRule {
  id: string;
  sourceVersion: FHIRVersion;
  targetVersion: FHIRVersion;
  sourcePath: string;
  targetPath: string;
  transformation?: string;
  notes?: string;
  aiSuggested: boolean;
}

interface VersionMapping {
  id: string;
  name: string;
  sourceVersion: FHIRVersion;
  targetVersion: FHIRVersion;
  resourceType: string;
  rules: MappingRule[];
  createdAt: string;
  status: string;
}

interface TransformationRecommendation {
  id: string;
  type: string;
  priority: string;
  description: string;
  sourcePath: string;
  targetPath: string;
  suggestedTransformation: string;
  rationale: string;
}

interface ValidationIssue {
  severity: string;
  code: string;
  path: string;
  message: string;
  details?: string;
}

interface ValidationResult {
  id: string;
  resourceId: string;
  resourceType: string;
  profile: string;
  valid: boolean;
  issues: ValidationIssue[];
  aiInsights?: string[];
  validatedAt: string;
}

interface FHIRProfile {
  id: string;
  name: string;
  url: string;
  version: FHIRVersion;
  resourceType: string;
  description: string;
}

function VersionMappingCard({ mapping }: { mapping: VersionMapping }) {
  return (
    <Card data-testid={`mapping-${mapping.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{mapping.name}</CardTitle>
          <Badge variant={mapping.status === "active" ? "default" : "secondary"}>
            {mapping.status}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="outline">{mapping.sourceVersion}</Badge>
          <ArrowRight className="w-4 h-4" />
          <Badge variant="outline">{mapping.targetVersion}</Badge>
          <span className="text-muted-foreground">({mapping.resourceType})</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm font-medium">Mapping Rules ({mapping.rules.length})</div>
          <ScrollArea className="h-[150px]">
            <div className="space-y-2 pr-4">
              {mapping.rules.map((rule) => (
                <div 
                  key={rule.id}
                  className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-sm"
                >
                  {rule.aiSuggested && (
                    <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-muted px-1 rounded">{rule.sourcePath}</code>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      <code className="text-xs bg-muted px-1 rounded">{rule.targetPath}</code>
                    </div>
                    {rule.transformation && (
                      <p className="text-xs text-muted-foreground mt-1">{rule.transformation}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ rec }: { rec: TransformationRecommendation }) {
  return (
    <Card data-testid={`recommendation-${rec.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-1 self-stretch rounded-full shrink-0 ${
            rec.priority === "required" ? "bg-red-500" :
            rec.priority === "recommended" ? "bg-yellow-500" :
            "bg-blue-400"
          }`} />
          <Lightbulb className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{rec.type}</Badge>
              <Badge 
                variant={rec.priority === "required" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {rec.priority}
              </Badge>
            </div>
            <p className="text-sm font-medium mt-2">{rec.description}</p>
            <div className="mt-2 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground">{rec.suggestedTransformation}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{rec.rationale}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidationResultCard({ result }: { result: ValidationResult }) {
  return (
    <Card data-testid={`validation-${result.id}`} className="relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${result.valid ? "bg-green-500" : "bg-red-500"}`} />
      <CardHeader className="pb-2 pl-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {result.valid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <CardTitle className="text-base">{result.resourceType}</CardTitle>
          </div>
          <Badge variant={result.valid ? "secondary" : "destructive"}>
            {result.valid ? "Valid" : `${result.issues.length} Issues`}
          </Badge>
        </div>
        <CardDescription>Profile: {result.profile}</CardDescription>
      </CardHeader>
      <CardContent>
        {result.issues.length > 0 && (
          <div className="space-y-2 mb-4">
            {result.issues.map((issue, index) => (
              <div 
                key={index}
                className={`flex items-start gap-2 p-2 rounded-md ${
                  issue.severity === "error" ? "bg-red-50 dark:bg-red-950" :
                  issue.severity === "warning" ? "bg-yellow-50 dark:bg-yellow-950" :
                  "bg-blue-50 dark:bg-blue-950"
                }`}
              >
                {issue.severity === "error" ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm">{issue.message}</p>
                  <p className="text-xs text-muted-foreground">{issue.path}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {result.aiInsights && result.aiInsights.length > 0 && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">AI Insights</span>
            </div>
            <ul className="text-sm space-y-1">
              {result.aiInsights.map((insight, i) => (
                <li key={i} className="text-muted-foreground">{insight}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AIFHIRDataExchange() {
  const [sourceVersion, setSourceVersion] = useState<FHIRVersion>("STU3");
  const [targetVersion, setTargetVersion] = useState<FHIRVersion>("R4");
  const [resourceType, setResourceType] = useState("Patient");
  const [mappingName, setMappingName] = useState("");
  const [validationResource, setValidationResource] = useState("");
  const [validationProfile, setValidationProfile] = useState("");
  const { toast } = useToast();

  const { data: metadata } = useQuery<{ aiEnabled: boolean; supportedVersions: FHIRVersion[] }>({
    queryKey: ["/api/fhir-data-exchange/metadata"]
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<VersionMapping[]>({
    queryKey: ["/api/fhir-data-exchange/mappings"]
  });

  const { data: profiles } = useQuery<FHIRProfile[]>({
    queryKey: ["/api/fhir-data-exchange/profiles"]
  });

  const createMappingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-data-exchange/mappings", {
        name: mappingName || `${resourceType} ${sourceVersion} to ${targetVersion}`,
        resourceType,
        sourceVersion,
        targetVersion
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-exchange/mappings"] });
      toast({ title: "Mapping created", description: "AI-assisted mapping rules generated" });
      setMappingName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create mapping", variant: "destructive" });
    }
  });

  const [recommendations, setRecommendations] = useState<TransformationRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const getRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/fhir-data-exchange/recommendations", { resourceType, sourceVersion, targetVersion });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch {
      toast({ title: "Error", description: "Failed to get recommendations", variant: "destructive" });
    }
    setRecommendationsLoading(false);
  };

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const validateResource = async () => {
    if (!validationResource || !validationProfile) {
      toast({ title: "Missing data", description: "Please enter resource JSON and select a profile" });
      return;
    }
    setValidating(true);
    try {
      const resource = JSON.parse(validationResource);
      const res = await apiRequest("POST", "/api/fhir-data-exchange/validate-with-ai", { resource, profileId: validationProfile });
      const data = await res.json();
      setValidationResult(data);
    } catch (e) {
      toast({ 
        title: "Validation Error", 
        description: e instanceof SyntaxError ? "Invalid JSON" : "Validation failed", 
        variant: "destructive" 
      });
    }
    setValidating(false);
  };

  const resourceTypes = ["Patient", "Observation", "Condition", "MedicationRequest", "Encounter", "Procedure"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">AI FHIR Data Exchange</h2>
          <p className="text-muted-foreground">
            Intelligent version mapping, transformation, and validation
          </p>
        </div>
        {metadata?.aiEnabled && (
          <Badge variant="default" className="gap-1">
            <Sparkles className="w-3 h-3" />
            AI Enhanced
          </Badge>
        )}
      </div>

      <Tabs defaultValue="mapping" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <GitCompare className="w-4 h-4 mr-2" />
            Version Mapping
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Lightbulb className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">
            <Shield className="w-4 h-4 mr-2" />
            Profile Validation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Version Mapping</CardTitle>
              <CardDescription>
                Generate AI-assisted mapping rules between FHIR versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-source-version">Source Version</Label>
                  <Select value={sourceVersion} onValueChange={(v) => setSourceVersion(v as FHIRVersion)}>
                    <SelectTrigger id="ai-fhir-data-exchange-source-version" data-testid="select-source-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(metadata?.supportedVersions || ["DSTU2", "STU3", "R4", "R4B", "R5"]).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-target-version">Target Version</Label>
                  <Select value={targetVersion} onValueChange={(v) => setTargetVersion(v as FHIRVersion)}>
                    <SelectTrigger id="ai-fhir-data-exchange-target-version" data-testid="select-target-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(metadata?.supportedVersions || ["DSTU2", "STU3", "R4", "R4B", "R5"]).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-resource-type">Resource Type</Label>
                  <Select value={resourceType} onValueChange={setResourceType}>
                    <SelectTrigger id="ai-fhir-data-exchange-resource-type" data-testid="select-resource-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceTypes.map(rt => (
                        <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => createMappingMutation.mutate()}
                  disabled={createMappingMutation.isPending || sourceVersion === targetVersion}
                  data-testid="button-create-mapping"
                >
                  {createMappingMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate Mapping
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mappingsLoading ? (
              <Card className="col-span-2">
                <CardContent className="py-8 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                </CardContent>
              </Card>
            ) : mappings && mappings.length > 0 ? (
              mappings.map(mapping => (
                <VersionMappingCard key={mapping.id} mapping={mapping} />
              ))
            ) : (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No mappings created yet</p>
                  <p className="text-sm mt-2">Create a mapping to generate AI-assisted rules</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Get Transformation Recommendations</CardTitle>
              <CardDescription>
                AI-powered suggestions for data transformation during FHIR version migration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-resource-type-2">Resource Type</Label>
                  <Select value={resourceType} onValueChange={setResourceType}>
                    <SelectTrigger id="ai-fhir-data-exchange-resource-type-2" data-testid="select-rec-resource-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceTypes.map(rt => (
                        <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-from-version">From Version</Label>
                  <Select value={sourceVersion} onValueChange={(v) => setSourceVersion(v as FHIRVersion)}>
                    <SelectTrigger id="ai-fhir-data-exchange-from-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(metadata?.supportedVersions || ["STU3", "R4"]).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-to-version">To Version</Label>
                  <Select value={targetVersion} onValueChange={(v) => setTargetVersion(v as FHIRVersion)}>
                    <SelectTrigger id="ai-fhir-data-exchange-to-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(metadata?.supportedVersions || ["R4", "R5"]).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={getRecommendations}
                  disabled={recommendationsLoading}
                  data-testid="button-get-recommendations"
                >
                  {recommendationsLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lightbulb className="w-4 h-4 mr-2" />
                  )}
                  Get Recommendations
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {recommendations.length > 0 ? (
              recommendations.map(rec => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations yet</p>
                  <p className="text-sm mt-2">Select versions and resource type to get AI recommendations</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Validate FHIR Resource</CardTitle>
                <CardDescription>
                  Validate a resource against a FHIR profile with AI insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-profile">Profile</Label>
                  <Select value={validationProfile} onValueChange={setValidationProfile}>
                    <SelectTrigger id="ai-fhir-data-exchange-profile" data-testid="select-validation-profile">
                      <SelectValue placeholder="Select a profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-exchange-resource-json">Resource JSON</Label>
                  <Textarea id="ai-fhir-data-exchange-resource-json"
                    placeholder='{"resourceType": "Patient", "id": "example", ...}'
                    value={validationResource}
                    onChange={(e) => setValidationResource(e.target.value)}
                    className="font-mono text-sm min-h-[200px]"
                    data-testid="textarea-resource-json"
                  />
                </div>

                <Button 
                  onClick={validateResource}
                  disabled={validating || !validationResource || !validationProfile}
                  className="w-full"
                  data-testid="button-validate"
                >
                  {validating ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  Validate with AI
                </Button>
              </CardContent>
            </Card>

            <div>
              {validationResult ? (
                <ValidationResultCard result={validationResult} />
              ) : (
                <Card className="h-full">
                  <CardContent className="py-12 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a FHIR resource to validate</p>
                    <p className="text-sm mt-2">Results will appear here</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Profiles</CardTitle>
              <CardDescription>Supported FHIR profiles for validation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {profiles?.map(profile => (
                  <div 
                    key={profile.id}
                    className="p-3 border rounded-md"
                    data-testid={`profile-${profile.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{profile.name}</span>
                      <Badge variant="outline">{profile.version}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>
                    <p className="text-xs mt-2">
                      <span className="text-muted-foreground">Resource:</span> {profile.resourceType}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
