import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, Eye, EyeOff, AlertTriangle, CheckCircle, FileText, Sparkles, Lock, Unlock, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type DeidentificationStrategy = "safe_harbor" | "pseudonymization" | "generalization" | "suppression" | "perturbation" | "k_anonymity";

interface PHIDetection {
  id: string;
  path: string;
  value: any;
  category: string;
  confidence: number;
  hipaaIdentifier: string;
  riskLevel: "high" | "medium" | "low";
  suggestedAction: DeidentificationStrategy;
}

interface AnonymizationResult {
  id: string;
  originalResource: any;
  anonymizedResource: any;
  detections: PHIDetection[];
  appliedRules: any[];
  dataUtilityScore: number;
  privacyScore: number;
  complianceStatus: {
    hipaaCompliant: boolean;
    safeHarborCompliant: boolean;
    issues: string[];
  };
  auditLog: any[];
  timestamp: string;
}

export default function PHIAnonymizationDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("detect");
  const [resourceJson, setResourceJson] = useState("");
  const [strategy, setStrategy] = useState<DeidentificationStrategy>("safe_harbor");
  const [preserveFields, setPreserveFields] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [anonymizationResult, setAnonymizationResult] = useState<AnonymizationResult | null>(null);
  const [aiSuggestions, setAISuggestions] = useState<any>(null);

  const { data: metadata } = useQuery<any>({
    queryKey: ["/api/phi-anonymization/metadata"],
  });

  const detectMutation = useMutation({
    mutationFn: async (resource: any) => {
      const res = await apiRequest("POST", "/api/phi-anonymization/detect", { resource });
      return res.json();
    },
    onSuccess: (data: any) => {
      setDetectionResult(data);
      toast({ title: "PHI Detection Complete", description: `Found ${data.detectionCount} PHI elements` });
    },
    onError: () => {
      toast({ title: "Detection Failed", description: "Could not detect PHI in resource", variant: "destructive" });
    },
  });

  const anonymizeMutation = useMutation({
    mutationFn: async ({ resource, strategy }: { resource: any; strategy: DeidentificationStrategy }) => {
      const res = await apiRequest("POST", "/api/phi-anonymization/anonymize", { resource, strategy });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAnonymizationResult(data);
      toast({ title: "Anonymization Complete", description: `Privacy score: ${data.privacyScore}%, Utility: ${data.dataUtilityScore}%` });
    },
    onError: () => {
      toast({ title: "Anonymization Failed", description: "Could not anonymize resource", variant: "destructive" });
    },
  });

  const aiSuggestionsMutation = useMutation({
    mutationFn: async ({ resource, preserveFields }: { resource: any; preserveFields: string[] }) => {
      const res = await apiRequest("POST", "/api/phi-anonymization/ai-suggestions", { resource, preserveFields });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAISuggestions(data);
      toast({ title: "AI Analysis Complete", description: `Generated ${data.suggestions?.length || 0} suggestions` });
    },
    onError: () => {
      toast({ title: "AI Analysis Failed", description: "Could not generate suggestions", variant: "destructive" });
    },
  });

  const handleDetect = () => {
    try {
      const resource = JSON.parse(resourceJson);
      detectMutation.mutate(resource);
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid FHIR resource JSON", variant: "destructive" });
    }
  };

  const handleAnonymize = () => {
    try {
      const resource = JSON.parse(resourceJson);
      anonymizeMutation.mutate({ resource, strategy });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid FHIR resource JSON", variant: "destructive" });
    }
  };

  const handleAISuggestions = () => {
    try {
      const resource = JSON.parse(resourceJson);
      const fields = preserveFields.split(",").map((f) => f.trim()).filter(Boolean);
      aiSuggestionsMutation.mutate({ resource, preserveFields: fields });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid FHIR resource JSON", variant: "destructive" });
    }
  };

  const loadSamplePatient = () => {
    const sample = {
      resourceType: "Patient",
      id: "patient-12345",
      identifier: [{ system: "http://hospital.example.org/mrn", value: "MRN-987654321" }],
      name: [{ family: "Rodriguez", given: ["Maria", "Elena"], text: "Maria Elena Rodriguez" }],
      gender: "female",
      birthDate: "1985-03-15",
      address: [
        {
          line: ["123 Oak Street", "Apt 4B"],
          city: "San Francisco",
          state: "CA",
          postalCode: "94102",
          country: "USA",
        },
      ],
      telecom: [
        { system: "phone", value: "(415) 555-1234", use: "home" },
        { system: "email", value: "maria.rodriguez@email.com" },
      ],
      maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    };
    setResourceJson(JSON.stringify(sample, null, 2));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "JSON copied to clipboard" });
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-6 w-6 text-primary" />
            PHI Anonymization & De-identification
          </h1>
          <p className="text-muted-foreground mt-1">
            HIPAA-compliant de-identification of FHIR resources for research and testing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" />
            HIPAA Safe Harbor
          </Badge>
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            18 Identifiers
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Strategies Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-strategy-count">
              {metadata?.strategies?.length || 6}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PHI Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-category-count">
              {metadata?.categories?.length || 18}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Default Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rules-count">
              {metadata?.defaultRules?.length || 17}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-compliance">
              HIPAA Ready
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="detect" data-testid="tab-detect">
            <Eye className="h-4 w-4 mr-2" />
            Detect PHI
          </TabsTrigger>
          <TabsTrigger value="anonymize" data-testid="tab-anonymize">
            <EyeOff className="h-4 w-4 mr-2" />
            Anonymize
          </TabsTrigger>
          <TabsTrigger value="ai-suggestions" data-testid="tab-ai-suggestions">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Suggestions
          </TabsTrigger>
          <TabsTrigger value="strategies" data-testid="tab-strategies">
            <FileText className="h-4 w-4 mr-2" />
            Strategies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detect" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>FHIR Resource</CardTitle>
                <CardDescription>
                  Enter a FHIR resource to detect Protected Health Information (PHI)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder='{"resourceType": "Patient", ...}'
                  className="font-mono text-sm min-h-[300px]"
                  value={resourceJson}
                  onChange={(e) => setResourceJson(e.target.value)}
                  data-testid="textarea-resource-json"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleDetect} disabled={detectMutation.isPending} data-testid="button-detect">
                    {detectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                    Detect PHI
                  </Button>
                  <Button variant="outline" onClick={loadSamplePatient} data-testid="button-load-sample">
                    Load Sample Patient
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detection Results</CardTitle>
                <CardDescription>
                  PHI elements found in the resource with risk assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detectionResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant={detectionResult.phiDetected ? "destructive" : "secondary"}>
                          {detectionResult.detectionCount} PHI Elements
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="destructive">{detectionResult.riskSummary?.high || 0} High</Badge>
                        <Badge variant="secondary">{detectionResult.riskSummary?.medium || 0} Medium</Badge>
                        <Badge variant="outline">{detectionResult.riskSummary?.low || 0} Low</Badge>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {detectionResult.detections?.map((d: PHIDetection) => (
                        <div key={d.id} className="p-3 bg-muted rounded-md space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <code className="text-xs bg-background px-2 py-1 rounded">{d.path}</code>
                            <Badge variant={getRiskBadgeVariant(d.riskLevel)}>{d.riskLevel}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Category:</span> {d.category}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">HIPAA:</span> {d.hipaaIdentifier}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Suggested:</span>{" "}
                            <Badge variant="outline" className="text-xs">{d.suggestedAction}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Enter a FHIR resource and click "Detect PHI" to analyze
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anonymize" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Anonymization Settings</CardTitle>
                <CardDescription>
                  Configure de-identification strategy and anonymize FHIR resources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>De-identification Strategy</Label>
                  <Select value={strategy} onValueChange={(v) => setStrategy(v as DeidentificationStrategy)}>
                    <SelectTrigger data-testid="select-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe_harbor">HIPAA Safe Harbor</SelectItem>
                      <SelectItem value="pseudonymization">Pseudonymization</SelectItem>
                      <SelectItem value="generalization">Generalization</SelectItem>
                      <SelectItem value="suppression">Suppression</SelectItem>
                      <SelectItem value="perturbation">Perturbation</SelectItem>
                      <SelectItem value="k_anonymity">K-Anonymity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder='{"resourceType": "Patient", ...}'
                  className="font-mono text-sm min-h-[200px]"
                  value={resourceJson}
                  onChange={(e) => setResourceJson(e.target.value)}
                  data-testid="textarea-anonymize-json"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleAnonymize} disabled={anonymizeMutation.isPending} data-testid="button-anonymize">
                    {anonymizeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <EyeOff className="h-4 w-4 mr-2" />}
                    Anonymize Resource
                  </Button>
                  <Button variant="outline" onClick={loadSamplePatient} data-testid="button-load-sample-anon">
                    Load Sample
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                  <span>Anonymization Result</span>
                  {anonymizationResult && (
                    <div className="flex items-center gap-2">
                      <Switch checked={showOriginal} onCheckedChange={setShowOriginal} data-testid="switch-show-original" />
                      <Label className="text-sm font-normal">{showOriginal ? "Original" : "Anonymized"}</Label>
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  Compare original and anonymized resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {anonymizationResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex gap-2">
                        <Badge variant={anonymizationResult.complianceStatus.hipaaCompliant ? "default" : "destructive"}>
                          {anonymizationResult.complianceStatus.hipaaCompliant ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> HIPAA Compliant</>
                          ) : (
                            <><AlertTriangle className="h-3 w-3 mr-1" /> Non-Compliant</>
                          )}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">Privacy: {anonymizationResult.privacyScore}%</Badge>
                        <Badge variant="outline">Utility: {anonymizationResult.dataUtilityScore}%</Badge>
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-[250px]">
                        {JSON.stringify(
                          showOriginal ? anonymizationResult.originalResource : anonymizationResult.anonymizedResource,
                          null,
                          2
                        )}
                      </pre>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(
                                showOriginal ? anonymizationResult.originalResource : anonymizationResult.anonymizedResource,
                                null,
                                2
                              )
                            )
                          }
                          data-testid="button-copy"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            downloadJson(
                              anonymizationResult.anonymizedResource,
                              `anonymized-${anonymizationResult.anonymizedResource.resourceType}-${Date.now()}.json`
                            )
                          }
                          data-testid="button-download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Audit Log ({anonymizationResult.auditLog.length} changes)</h4>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {anonymizationResult.auditLog.map((log: any) => (
                          <div key={log.id} className="text-xs bg-muted p-2 rounded flex items-center justify-between gap-2 flex-wrap">
                            <code>{log.path}</code>
                            <Badge variant="outline" className="text-xs">{log.strategy}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Configure settings and click "Anonymize Resource" to de-identify
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-suggestions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Anonymization
                </CardTitle>
                <CardDescription>
                  Get intelligent suggestions that balance privacy and data utility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder='{"resourceType": "Patient", ...}'
                  className="font-mono text-sm min-h-[200px]"
                  value={resourceJson}
                  onChange={(e) => setResourceJson(e.target.value)}
                  data-testid="textarea-ai-json"
                />
                <div className="space-y-2">
                  <Label>Fields to Preserve (comma-separated)</Label>
                  <Input
                    placeholder="e.g., gender, maritalStatus, code"
                    value={preserveFields}
                    onChange={(e) => setPreserveFields(e.target.value)}
                    data-testid="input-preserve-fields"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleAISuggestions} disabled={aiSuggestionsMutation.isPending} data-testid="button-ai-suggest">
                    {aiSuggestionsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Get AI Suggestions
                  </Button>
                  <Button variant="outline" onClick={loadSamplePatient} data-testid="button-load-sample-ai">
                    Load Sample
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>
                  Smart anonymization suggestions with utility impact analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aiSuggestions ? (
                  <div className="space-y-4">
                    {aiSuggestions.overallRecommendation && (
                      <div className="p-3 bg-primary/10 rounded-md">
                        <h4 className="text-sm font-medium mb-1">Overall Recommendation</h4>
                        <p className="text-sm text-muted-foreground">{aiSuggestions.overallRecommendation}</p>
                      </div>
                    )}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {aiSuggestions.suggestions?.map((s: any, i: number) => (
                        <div key={i} className="p-3 bg-muted rounded-md space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <code className="text-xs bg-background px-2 py-1 rounded">{s.path}</code>
                            <Badge
                              variant={
                                s.utilityImpact === "high" ? "destructive" : s.utilityImpact === "medium" ? "secondary" : "outline"
                              }
                            >
                              {s.utilityImpact} impact
                            </Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Strategy:</span>{" "}
                            <Badge variant="outline" className="text-xs">{s.strategy}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Suggested:</span>{" "}
                            <code className="text-xs bg-background px-1 rounded">
                              {typeof s.suggestedValue === "object" ? JSON.stringify(s.suggestedValue) : s.suggestedValue}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Enter a FHIR resource and click "Get AI Suggestions" for smart recommendations
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metadata?.strategies?.map((s: any) => (
              <Card key={s.strategy}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {s.strategy === "safe_harbor" && <Shield className="h-5 w-5 text-green-600" />}
                    {s.strategy === "pseudonymization" && <Unlock className="h-5 w-5 text-blue-600" />}
                    {s.strategy === "generalization" && <FileText className="h-5 w-5 text-purple-600" />}
                    {s.strategy === "suppression" && <EyeOff className="h-5 w-5 text-red-600" />}
                    {s.strategy === "perturbation" && <Sparkles className="h-5 w-5 text-orange-600" />}
                    {s.strategy === "k_anonymity" && <Lock className="h-5 w-5 text-cyan-600" />}
                    {s.strategy.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </CardContent>
              </Card>
            )) || (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      Safe Harbor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      HIPAA Safe Harbor method - removes or generalizes all 18 identifiers
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Unlock className="h-5 w-5 text-blue-600" />
                      Pseudonymization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Replaces identifiers with consistent fake values
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      Generalization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Reduces precision of values (e.g., full date to year only)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <EyeOff className="h-5 w-5 text-red-600" />
                      Suppression
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Completely removes the value
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-orange-600" />
                      Perturbation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Adds random noise to values (e.g., date shifting)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lock className="h-5 w-5 text-cyan-600" />
                      K-Anonymity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Ensures each record is indistinguishable from k-1 others
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>HIPAA Safe Harbor 18 Identifiers</CardTitle>
              <CardDescription>
                These identifiers must be removed or generalized for Safe Harbor compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {metadata?.categories?.map((c: any) => (
                  <div key={c.category} className="p-2 bg-muted rounded-md">
                    <div className="font-medium text-sm">{c.category}</div>
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  </div>
                )) || (
                  <>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Names</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Addresses</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Dates</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Phone Numbers</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Fax Numbers</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">Email Addresses</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">SSN</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="font-medium text-sm">MRN</div></div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
