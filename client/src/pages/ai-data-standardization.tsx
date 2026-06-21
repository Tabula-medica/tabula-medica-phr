import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Database, FileText, Wand2, AlertTriangle, CheckCircle2, 
  Clock, RefreshCw, FileCode, FileSearch, Layers, Code2,
  ArrowRight, Sparkles, Shield, Activity, Zap
} from "lucide-react";

export default function AIDataStandardization() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("standardize");
  
  const [sourceResources, setSourceResources] = useState("");
  const [sourceFormat, setSourceFormat] = useState("FHIR_R4");
  const [standardizationOptions, setStandardizationOptions] = useState({
    harmonizeCodeSystems: true,
    normalizeUnits: true,
    standardizeDates: true,
    deduplicateResources: true,
    inferMissingFields: false
  });

  const [documentContent, setDocumentContent] = useState("");
  const [documentType, setDocumentType] = useState("clinical_note");
  const [patientId, setPatientId] = useState("");

  const { data: standardizationMetadata, isLoading: metadataLoading } = useQuery({
    queryKey: ["/api/ai-data-standardization/standardization/metadata"]
  });

  const { data: extractionMetadata, isLoading: extractionMetadataLoading } = useQuery({
    queryKey: ["/api/ai-data-standardization/extraction/metadata"]
  });

  const { data: combinedStats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/ai-data-standardization/stats"]
  });

  const standardizeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/ai-data-standardization/standardization/standardize", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Standardization Complete", description: `Quality score: ${data.data.result?.qualityScore || 0}%` });
        refetchStats();
      } else {
        toast({ title: "Error", description: data.error?.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Standardization failed", variant: "destructive" });
    }
  });

  const extractMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/ai-data-standardization/extraction/extract", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const resourceCount = data.data.result?.extractedResources?.length || 0;
        toast({ title: "Extraction Complete", description: `Extracted ${resourceCount} FHIR resources` });
        refetchStats();
      } else {
        toast({ title: "Error", description: data.error?.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Extraction failed", variant: "destructive" });
    }
  });

  const handleStandardize = () => {
    try {
      const resources = JSON.parse(sourceResources);
      const resourceArray = Array.isArray(resources) ? resources : [resources];
      standardizeMutation.mutate({
        sourceResources: resourceArray,
        sourceFormat,
        options: standardizationOptions
      });
    } catch (e) {
      toast({ title: "Invalid JSON", description: "Please enter valid FHIR resource JSON", variant: "destructive" });
    }
  };

  const handleExtract = () => {
    if (!documentContent.trim()) {
      toast({ title: "Missing Content", description: "Please enter document content", variant: "destructive" });
      return;
    }
    extractMutation.mutate({
      documentContent,
      documentType,
      contentType: "text",
      patientId: patientId || undefined
    });
  };

  const loadSampleFHIR = () => {
    const sample = [
      {
        resourceType: "Condition",
        id: "example-condition-1",
        code: {
          coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }],
          text: "Type 2 Diabetes"
        },
        subject: { reference: "Patient/example" }
      },
      {
        resourceType: "Observation",
        id: "example-obs-1",
        code: {
          coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose [Mass/volume] in Blood" }]
        },
        valueQuantity: { value: 126, unit: "mg/dL" },
        subject: { reference: "Patient/example" }
      }
    ];
    setSourceResources(JSON.stringify(sample, null, 2));
  };

  const loadSampleDocument = () => {
    const sample = `DISCHARGE SUMMARY

Patient: John Doe
Date: 2024-01-15
Provider: Dr. Sarah Smith, MD - Internal Medicine
Facility: Metro General Hospital

DIAGNOSES:
1. Type 2 Diabetes Mellitus, uncontrolled
2. Hypertension, essential
3. Chronic kidney disease, stage 3

ALLERGIES:
- Penicillin (rash)
- Sulfa drugs (anaphylaxis)

LABORATORY RESULTS:
- Glucose: 186 mg/dL (elevated)
- HbA1c: 8.2%
- Creatinine: 1.8 mg/dL
- eGFR: 42 mL/min
- Blood Pressure: 148/92 mmHg

MEDICATIONS ON DISCHARGE:
1. Metformin 1000mg twice daily
2. Lisinopril 20mg once daily
3. Amlodipine 5mg once daily

FOLLOW-UP:
Patient to follow up with PCP in 2 weeks.`;
    setDocumentContent(sample);
    setDocumentType("discharge_summary");
  };

  const stats = (combinedStats as any)?.data;
  const stdMeta = (standardizationMetadata as any)?.data;
  const extMeta = (extractionMetadata as any)?.data;

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Data Standardization</h1>
              <p className="text-muted-foreground">Transform and harmonize healthcare data into standardized FHIR resources</p>
            </div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Operations</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-operations">{stats.combined?.totalOperations || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-completed-operations">{stats.combined?.completedOperations || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pending Review</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-pending-review">{stats.combined?.pendingReview || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Avg Quality</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-avg-quality">{stats.combined?.avgQuality || 0}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="standardize" data-testid="tab-standardize" className="gap-2">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Standardize</span>
            </TabsTrigger>
            <TabsTrigger value="extract" data-testid="tab-extract" className="gap-2">
              <FileSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Extract</span>
            </TabsTrigger>
            <TabsTrigger value="profiles" data-testid="tab-profiles" className="gap-2">
              <Code2 className="h-4 w-4" />
              <span className="hidden sm:inline">Profiles</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standardize" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    FHIR Resource Input
                  </CardTitle>
                  <CardDescription>Paste FHIR resources to standardize and harmonize</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Source Format</Label>
                    <Select value={sourceFormat} onValueChange={setSourceFormat}>
                      <SelectTrigger className="w-40" data-testid="select-source-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FHIR_R4">FHIR R4</SelectItem>
                        <SelectItem value="FHIR_STU3">FHIR STU3</SelectItem>
                        <SelectItem value="FHIR_DSTU2">FHIR DSTU2</SelectItem>
                        <SelectItem value="HL7_V2">HL7 v2</SelectItem>
                        <SelectItem value="CDA">CDA</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    placeholder="Paste FHIR resource JSON here..."
                    value={sourceResources}
                    onChange={(e) => setSourceResources(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid="input-source-resources"
                  />

                  <Button variant="outline" onClick={loadSampleFHIR} className="w-full" data-testid="button-load-sample-fhir">
                    Load Sample FHIR Resources
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5" />
                      Standardization Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Harmonize Code Systems</Label>
                        <p className="text-sm text-muted-foreground">Map to SNOMED-CT, LOINC, RxNorm</p>
                      </div>
                      <Switch
                        checked={standardizationOptions.harmonizeCodeSystems}
                        onCheckedChange={(v) => setStandardizationOptions(prev => ({ ...prev, harmonizeCodeSystems: v }))}
                        data-testid="switch-harmonize-codes"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Normalize Units</Label>
                        <p className="text-sm text-muted-foreground">Convert to UCUM standard units</p>
                      </div>
                      <Switch
                        checked={standardizationOptions.normalizeUnits}
                        onCheckedChange={(v) => setStandardizationOptions(prev => ({ ...prev, normalizeUnits: v }))}
                        data-testid="switch-normalize-units"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Standardize Dates</Label>
                        <p className="text-sm text-muted-foreground">Convert to ISO 8601 format</p>
                      </div>
                      <Switch
                        checked={standardizationOptions.standardizeDates}
                        onCheckedChange={(v) => setStandardizationOptions(prev => ({ ...prev, standardizeDates: v }))}
                        data-testid="switch-standardize-dates"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Deduplicate Resources</Label>
                        <p className="text-sm text-muted-foreground">Remove duplicate entries</p>
                      </div>
                      <Switch
                        checked={standardizationOptions.deduplicateResources}
                        onCheckedChange={(v) => setStandardizationOptions(prev => ({ ...prev, deduplicateResources: v }))}
                        data-testid="switch-deduplicate"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>AI Infer Missing Fields</Label>
                        <p className="text-sm text-muted-foreground">Use AI to suggest missing values</p>
                      </div>
                      <Switch
                        checked={standardizationOptions.inferMissingFields}
                        onCheckedChange={(v) => setStandardizationOptions(prev => ({ ...prev, inferMissingFields: v }))}
                        data-testid="switch-ai-infer"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleStandardize} 
                  disabled={standardizeMutation.isPending || !sourceResources.trim()}
                  className="w-full h-12"
                  data-testid="button-standardize"
                >
                  {standardizeMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Standardize Resources</>
                  )}
                </Button>

                {standardizeMutation.data?.success && standardizeMutation.data.data.result && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        Standardization Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Quality Score</span>
                        <div className="flex items-center gap-2">
                          <Progress value={standardizeMutation.data.data.result.qualityScore} className="w-20" />
                          <span className="font-bold">{standardizeMutation.data.data.result.qualityScore}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <p className="text-lg font-bold text-green-600">{standardizeMutation.data.data.result.mappingReport.successfullyMapped}</p>
                          <p className="text-xs text-muted-foreground">Mapped</p>
                        </div>
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <p className="text-lg font-bold text-yellow-600">{standardizeMutation.data.data.result.mappingReport.partiallyMapped}</p>
                          <p className="text-xs text-muted-foreground">Partial</p>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <p className="text-lg font-bold text-red-600">{standardizeMutation.data.data.result.issues.length}</p>
                          <p className="text-xs text-muted-foreground">Issues</p>
                        </div>
                      </div>
                      {standardizeMutation.data.data.result.recommendations?.length > 0 && (
                        <div className="space-y-2">
                          <Label>AI Recommendations</Label>
                          <ul className="text-sm space-y-1">
                            {standardizeMutation.data.data.result.recommendations.slice(0, 3).map((rec: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extract" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Document Input
                  </CardTitle>
                  <CardDescription>Paste clinical document text to extract FHIR resources</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger className="w-48" data-testid="select-document-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinical_note">Clinical Note</SelectItem>
                        <SelectItem value="lab_report">Lab Report</SelectItem>
                        <SelectItem value="discharge_summary">Discharge Summary</SelectItem>
                        <SelectItem value="radiology_report">Radiology Report</SelectItem>
                        <SelectItem value="prescription">Prescription</SelectItem>
                        <SelectItem value="referral_letter">Referral Letter</SelectItem>
                        <SelectItem value="fax">Fax</SelectItem>
                        <SelectItem value="external_record">External Record</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    placeholder="Paste document text here..."
                    value={documentContent}
                    onChange={(e) => setDocumentContent(e.target.value)}
                    className="min-h-[350px] font-mono text-sm"
                    data-testid="input-document-content"
                  />

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={loadSampleDocument} className="flex-1" data-testid="button-load-sample-doc">
                      Load Sample Document
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      AI Extraction
                    </CardTitle>
                    <CardDescription>Uses AI to identify conditions, medications, observations, and more</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {extMeta?.outputResourceTypes?.map((type: string) => (
                        <div key={type} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="text-sm">{type}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleExtract} 
                  disabled={extractMutation.isPending || !documentContent.trim()}
                  className="w-full h-12"
                  data-testid="button-extract"
                >
                  {extractMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Extracting...</>
                  ) : (
                    <><FileSearch className="h-4 w-4 mr-2" /> Extract FHIR Resources</>
                  )}
                </Button>

                {extractMutation.data?.success && extractMutation.data.data.result && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        Extraction Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Confidence</span>
                        <div className="flex items-center gap-2">
                          <Progress value={extractMutation.data.data.result.confidence} className="w-20" />
                          <span className="font-bold">{extractMutation.data.data.result.confidence}%</span>
                        </div>
                      </div>

                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {extractMutation.data.data.result.extractedResources.map((r: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <div className="flex items-center gap-2">
                                <Badge variant={r.needsReview ? "outline" : "secondary"}>
                                  {r.resourceType}
                                </Badge>
                                <span className="text-sm truncate max-w-[200px]">{r.sourceText}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{Math.round(r.confidence * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {extractMutation.data.data.result.reviewFlags?.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Review Required</AlertTitle>
                          <AlertDescription>
                            {extractMutation.data.data.result.reviewFlags.length} items need human review
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profiles" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Harmonization Profiles
                  </CardTitle>
                  <CardDescription>Pre-configured profiles for different EHR systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {stdMeta?.profiles?.map((profile: any) => (
                        <div key={profile.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{profile.name}</h4>
                            <Badge variant="secondary">Active</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{profile.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {profile.sourceProfiles?.slice(0, 2).map((sp: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{sp.split("/").pop()}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Common Data Elements
                  </CardTitle>
                  <CardDescription>Identified across multiple FHIR profiles</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {stdMeta?.commonDataElementsCount > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {stdMeta?.commonDataElementsCount} common data elements identified across profiles
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No common elements analyzed yet</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Data Processing Notice</AlertTitle>
          <AlertDescription>
            This module is for data interoperability purposes only. It does not provide clinical decision support, 
            medical advice, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
