import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileJson,
  Shield,
  RefreshCw,
  History,
  Sparkles,
  FileCheck,
  Download,
  Copy,
  ChevronRight,
  Info,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SupportedStandard {
  id: string;
  name: string;
  version: string;
  description: string;
  supportedResourceTypes: string[];
  direction: "from" | "to" | "bidirectional";
}

interface MappingTemplate {
  id: string;
  name: string;
  sourceFormat: string;
  targetFormat: string;
  description: string;
}

interface MappingResult {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  sourceData: any;
  mappedData: any;
  mappingDetails: MappingDetail[];
  validationStatus: "success" | "warning" | "error";
  validationMessages: string[];
  confidence: number;
  timestamp: string;
}

interface MappingDetail {
  sourceField: string;
  targetField: string;
  transformation: string;
  confidence: number;
  notes?: string;
}

interface MappingStatistics {
  totalMappings: number;
  successfulMappings: number;
  failedMappings: number;
  averageConfidence: number;
  mappingsByFormat: Record<string, number>;
  recentActivity: Array<{ date: string; count: number }>;
}

interface ValidationProfile {
  id: string;
  name: string;
  type: string;
  version: string;
  resourceTypes: string[];
}

interface ValidationResult {
  id: string;
  resource: any;
  profile: string;
  isValid: boolean;
  conformanceLevel: "full" | "partial" | "none";
  constraints: ConstraintResult[];
  suggestions: string[];
  aiEnhanced: boolean;
  timestamp: string;
}

interface ConstraintResult {
  id: string;
  path: string;
  severity: "error" | "warning" | "info";
  message: string;
  passed: boolean;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  warning: "outline",
  error: "destructive",
};

const severityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  error: "destructive",
  warning: "outline",
  info: "secondary",
};

export default function FhirStandardsMapping() {
  const [selectedTab, setSelectedTab] = useState("mapping");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-standards-mapping">
            <ArrowRightLeft className="h-8 w-8" />
            FHIR Standards Mapping
          </h1>
          <p className="text-muted-foreground mt-1">
            Map healthcare data between FHIR, C-CDA, HL7v2, and other standards
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          HIPAA Compliant
        </Badge>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg" data-testid="tabs-standards-mapping">
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Data Mapping
          </TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">
            <FileCheck className="h-4 w-4 mr-2" />
            Profile Validation
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-4 mt-4">
          <StandardsMappingTab />
        </TabsContent>

        <TabsContent value="validation" className="space-y-4 mt-4">
          <ProfileValidationTab />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <MappingHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StandardsMappingTab() {
  const { toast } = useToast();
  const [sourceFormat, setSourceFormat] = useState("");
  const [targetFormat, setTargetFormat] = useState("");
  const [sourceData, setSourceData] = useState("");
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);

  const { data: standards, isLoading: loadingStandards } = useQuery<SupportedStandard[]>({
    queryKey: ["/api/fhir-standards-mapping/standards"],
  });

  const { data: templates } = useQuery<MappingTemplate[]>({
    queryKey: ["/api/fhir-standards-mapping/templates"],
  });

  const { data: stats } = useQuery<MappingStatistics>({
    queryKey: ["/api/fhir-standards-mapping/statistics"],
  });

  const mapMutation = useMutation({
    mutationFn: async (data: { sourceFormat: string; targetFormat: string; sourceData: any }) => {
      const response = await apiRequest("POST", "/api/fhir-standards-mapping/map", data);
      return response.json();
    },
    onSuccess: (result) => {
      setMappingResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-standards-mapping/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-standards-mapping/statistics"] });
      toast({
        title: "Mapping Complete",
        description: `Successfully mapped data from ${sourceFormat} to ${targetFormat}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Mapping Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMap = () => {
    try {
      const parsedData = JSON.parse(sourceData);
      mapMutation.mutate({ sourceFormat, targetFormat, sourceData: parsedData });
    } catch (e) {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON data", variant: "destructive" });
    }
  };

  const loadTemplate = (template: MappingTemplate) => {
    setSourceFormat(template.sourceFormat);
    setTargetFormat(template.targetFormat);
    const sampleData = getSampleData(template.sourceFormat);
    setSourceData(JSON.stringify(sampleData, null, 2));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalMappings || 0}</p>
                <p className="text-sm text-muted-foreground">Total Mappings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.successfulMappings || 0}</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{((stats?.averageConfidence || 0) * 100).toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{standards?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Standards</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Data Mapping
            </CardTitle>
            <CardDescription>Convert healthcare data between different industry standards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source Format</Label>
                <Select value={sourceFormat} onValueChange={setSourceFormat}>
                  <SelectTrigger data-testid="select-source-format">
                    <SelectValue placeholder="Select source format" />
                  </SelectTrigger>
                  <SelectContent>
                    {standards?.filter(s => s.direction !== "to").map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Format</Label>
                <Select value={targetFormat} onValueChange={setTargetFormat}>
                  <SelectTrigger data-testid="select-target-format">
                    <SelectValue placeholder="Select target format" />
                  </SelectTrigger>
                  <SelectContent>
                    {standards?.filter(s => s.direction !== "from").map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source Data (JSON)</Label>
              <Textarea
                value={sourceData}
                onChange={(e) => setSourceData(e.target.value)}
                placeholder="Paste your source data here..."
                className="font-mono text-sm min-h-[200px]"
                data-testid="textarea-source-data"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSourceData(""); setMappingResult(null); }} data-testid="button-clear">
                Clear
              </Button>
              <Button onClick={handleMap} disabled={!sourceFormat || !targetFormat || !sourceData || mapMutation.isPending} data-testid="button-map">
                {mapMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Mapping...</>
                ) : (
                  <><ArrowRightLeft className="h-4 w-4 mr-2" />Map Data</>
                )}
              </Button>
            </div>

            {mappingResult && (
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Mapping Result
                      <Badge variant={statusColors[mappingResult.validationStatus]}>{mappingResult.validationStatus}</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{(mappingResult.confidence * 100).toFixed(0)}% confidence</Badge>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(JSON.stringify(mappingResult.mappedData, null, 2))} data-testid="button-copy-result">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 p-2 rounded-md flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">This mapping is for informational purposes only. Verify accuracy before clinical use.</span>
                  </div>

                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">{JSON.stringify(mappingResult.mappedData, null, 2)}</pre>
                  </ScrollArea>

                  {mappingResult.mappingDetails.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Field Mappings</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead></TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Transformation</TableHead>
                            <TableHead>Confidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappingResult.mappingDetails.map((detail, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{detail.sourceField}</TableCell>
                              <TableCell><ChevronRight className="h-4 w-4" /></TableCell>
                              <TableCell className="font-mono text-sm">{detail.targetField}</TableCell>
                              <TableCell>{detail.transformation}</TableCell>
                              <TableCell><Progress value={detail.confidence * 100} className="w-16 h-2" /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {mappingResult.validationMessages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Validation Messages</h4>
                      <div className="space-y-1">
                        {mappingResult.validationMessages.map((msg, i) => (
                          <p key={i} className="text-sm text-muted-foreground">{msg}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" />Quick Templates</CardTitle>
              <CardDescription>Pre-configured mapping templates</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {templates?.map(t => (
                    <Button key={t.id} variant="outline" className="w-full justify-start text-left h-auto py-3" onClick={() => loadTemplate(t)} data-testid={`template-${t.id}`}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.sourceFormat} → {t.targetFormat}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Supported Standards</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {standards?.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.version}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{s.direction}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileValidationTab() {
  const { toast } = useToast();
  const [selectedProfile, setSelectedProfile] = useState("");
  const [resourceData, setResourceData] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const { data: profiles } = useQuery<ValidationProfile[]>({
    queryKey: ["/api/fhir-validation/profiles"],
  });

  const validateMutation = useMutation({
    mutationFn: async (data: { resource: any; profileId: string }) => {
      const response = await apiRequest("POST", "/api/fhir-validation/validate", {
        resource: data.resource,
        profileIds: [data.profileId]
      });
      return response.json();
    },
    onSuccess: (result) => {
      setValidationResult(result);
      toast({
        title: result.isValid ? "Validation Passed" : "Validation Failed",
        description: result.isValid ? "Resource conforms to the selected profile" : `Found ${result.constraints.filter((c: ConstraintResult) => !c.passed).length} constraint violations`,
        variant: result.isValid ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
    },
  });

  const handleValidate = () => {
    try {
      const parsedResource = JSON.parse(resourceData);
      validateMutation.mutate({ resource: parsedResource, profileId: selectedProfile });
    } catch (e) {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON resource data", variant: "destructive" });
    }
  };

  const loadSampleResource = () => {
    const sample = {
      resourceType: "Patient",
      id: "example-patient",
      meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
      identifier: [{ system: "http://hospital.example.org/mrn", value: "12345" }],
      name: [{ use: "official", family: "Smith", given: ["John", "William"] }],
      gender: "male",
      birthDate: "1970-01-15"
    };
    setResourceData(JSON.stringify(sample, null, 2));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5" />FHIR Profile Validation</CardTitle>
            <CardDescription>Validate FHIR resources against US Core, IPS, CARIN BB, and custom profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Validation Profile</Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger data-testid="select-profile">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.version})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>FHIR Resource (JSON)</Label>
                <Button variant="ghost" size="sm" onClick={loadSampleResource} data-testid="button-load-sample">Load Sample Patient</Button>
              </div>
              <Textarea value={resourceData} onChange={(e) => setResourceData(e.target.value)} placeholder="Paste your FHIR resource here..." className="font-mono text-sm min-h-[300px]" data-testid="textarea-resource" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResourceData(""); setValidationResult(null); }}>Clear</Button>
              <Button onClick={handleValidate} disabled={!selectedProfile || !resourceData || validateMutation.isPending} data-testid="button-validate">
                {validateMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Validating...</>
                ) : (
                  <><FileCheck className="h-4 w-4 mr-2" />Validate Resource</>
                )}
              </Button>
            </div>

            {validationResult && (
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Validation Result
                      {validationResult.isValid ? (
                        <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Valid</Badge>
                      ) : (
                        <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Invalid</Badge>
                      )}
                    </CardTitle>
                    <Badge variant="outline">Conformance: {validationResult.conformanceLevel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {validationResult.aiEnhanced && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-md flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">AI-enhanced validation results</span>
                    </div>
                  )}

                  <div className="bg-muted/50 p-2 rounded-md flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Validation is for informational purposes only. This is NOT clinical decision support.</span>
                  </div>

                  {validationResult.constraints.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Constraint Results</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.constraints.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>{c.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}</TableCell>
                              <TableCell className="font-mono text-sm">{c.path}</TableCell>
                              <TableCell><Badge variant={severityColors[c.severity]}>{c.severity}</Badge></TableCell>
                              <TableCell>{c.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {validationResult.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Suggestions</h4>
                      <ul className="space-y-1">
                        {validationResult.suggestions.map((s, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Available Profiles</CardTitle>
              <CardDescription>Standard and custom FHIR profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {profiles?.map(p => (
                    <div key={p.id} className={`p-3 border rounded-md cursor-pointer transition-colors ${selectedProfile === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setSelectedProfile(p.id)} data-testid={`profile-${p.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{p.name}</p>
                        <Badge variant="secondary" className="text-xs">{p.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.version}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.resourceTypes.slice(0, 3).map(rt => (
                          <Badge key={rt} variant="outline" className="text-xs">{rt}</Badge>
                        ))}
                        {p.resourceTypes.length > 3 && <Badge variant="outline" className="text-xs">+{p.resourceTypes.length - 3}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MappingHistoryTab() {
  const { data: history, isLoading } = useQuery<MappingResult[]>({
    queryKey: ["/api/fhir-standards-mapping/history"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Mapping History</CardTitle>
        <CardDescription>Recent data mapping operations with audit trail</CardDescription>
      </CardHeader>
      <CardContent>
        {!history || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No mapping history yet</p>
            <p className="text-sm">Perform a data mapping to see it here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead></TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{new Date(item.timestamp).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{item.sourceFormat}</Badge></TableCell>
                  <TableCell><ChevronRight className="h-4 w-4" /></TableCell>
                  <TableCell><Badge variant="outline">{item.targetFormat}</Badge></TableCell>
                  <TableCell><Badge variant={statusColors[item.validationStatus]}>{item.validationStatus}</Badge></TableCell>
                  <TableCell><Progress value={item.confidence * 100} className="w-16 h-2" /></TableCell>
                  <TableCell><Button size="icon" variant="ghost"><Download className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function getSampleData(format: string): object {
  switch (format) {
    case "fhir-r4":
      return { resourceType: "Patient", id: "example", name: [{ family: "Smith", given: ["John"] }], gender: "male", birthDate: "1970-01-01" };
    case "hl7v2":
      return { MSH: { messageType: "ADT", triggerEvent: "A01" }, PID: { patientId: "12345", patientName: "Smith^John", sex: "M", dateOfBirth: "19700101" } };
    case "c-cda":
      return { templateId: "2.16.840.1.113883.10.20.22.1.1", recordTarget: { patientRole: { patient: { name: { family: "Smith", given: ["John"] }, administrativeGenderCode: "M", birthTime: { value: "19700101" } } } } };
    default:
      return { note: "Enter your data" };
  }
}
