import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  Brain,
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  FileJson,
  FileCode,
  Database,
  RefreshCw,
  Download,
  Upload,
  Play,
  Pause,
  Settings,
  Shield,
  Zap,
  GitBranch,
  Code,
  Link,
  Loader2,
  Copy,
  Eye,
  Trash2,
  Plus,
} from "lucide-react";

interface FieldMapping {
  id: string;
  sourceField: string;
  sourcePath: string;
  sourceType: string;
  targetField: string;
  targetPath: string;
  targetType: string;
  confidence: number;
  status: "auto" | "confirmed" | "manual" | "review";
  transformation?: string;
  codeTranslation?: CodeTranslation;
}

interface CodeTranslation {
  sourceSystem: string;
  targetSystem: string;
  mappings: { sourceCode: string; targetCode: string; display: string }[];
}

interface MappingConfig {
  id: string;
  name: string;
  sourceFormat: string;
  targetFormat: string;
  fieldMappings: number;
  codeTranslations: number;
  status: "draft" | "active" | "testing";
  lastModified: string;
  confidence: number;
}

const mockConfigs: MappingConfig[] = [
  {
    id: "cfg-1",
    name: "HL7v2 to FHIR R4",
    sourceFormat: "HL7v2 ADT",
    targetFormat: "FHIR R4 Patient",
    fieldMappings: 45,
    codeTranslations: 12,
    status: "active",
    lastModified: "2026-01-15",
    confidence: 0.94,
  },
  {
    id: "cfg-2",
    name: "CCD to FHIR R4",
    sourceFormat: "C-CDA 2.1",
    targetFormat: "FHIR R4 Bundle",
    fieldMappings: 78,
    codeTranslations: 24,
    status: "active",
    lastModified: "2026-01-12",
    confidence: 0.91,
  },
  {
    id: "cfg-3",
    name: "Lab System JSON to FHIR",
    sourceFormat: "Custom JSON",
    targetFormat: "FHIR R4 DiagnosticReport",
    fieldMappings: 32,
    codeTranslations: 8,
    status: "testing",
    lastModified: "2026-01-16",
    confidence: 0.87,
  },
];

const mockFieldMappings: FieldMapping[] = [
  {
    id: "map-1",
    sourceField: "PID.5.1",
    sourcePath: "PID-5-1",
    sourceType: "ST",
    targetField: "Patient.name.family",
    targetPath: "Patient.name[0].family",
    targetType: "string",
    confidence: 0.98,
    status: "confirmed",
  },
  {
    id: "map-2",
    sourceField: "PID.5.2",
    sourcePath: "PID-5-2",
    sourceType: "ST",
    targetField: "Patient.name.given",
    targetPath: "Patient.name[0].given[0]",
    targetType: "string",
    confidence: 0.98,
    status: "confirmed",
  },
  {
    id: "map-3",
    sourceField: "PID.7.1",
    sourcePath: "PID-7-1",
    sourceType: "DTM",
    targetField: "Patient.birthDate",
    targetPath: "Patient.birthDate",
    targetType: "date",
    confidence: 0.95,
    status: "auto",
    transformation: "HL7DateTime_to_FHIRDate",
  },
  {
    id: "map-4",
    sourceField: "PID.8",
    sourcePath: "PID-8",
    sourceType: "IS",
    targetField: "Patient.gender",
    targetPath: "Patient.gender",
    targetType: "code",
    confidence: 0.92,
    status: "auto",
    codeTranslation: {
      sourceSystem: "HL7v2 Table 0001",
      targetSystem: "http://hl7.org/fhir/administrative-gender",
      mappings: [
        { sourceCode: "M", targetCode: "male", display: "Male" },
        { sourceCode: "F", targetCode: "female", display: "Female" },
        { sourceCode: "U", targetCode: "unknown", display: "Unknown" },
        { sourceCode: "O", targetCode: "other", display: "Other" },
      ],
    },
  },
  {
    id: "map-5",
    sourceField: "PID.11",
    sourcePath: "PID-11",
    sourceType: "XAD",
    targetField: "Patient.address",
    targetPath: "Patient.address[0]",
    targetType: "Address",
    confidence: 0.78,
    status: "review",
  },
  {
    id: "map-6",
    sourceField: "PID.13",
    sourcePath: "PID-13",
    sourceType: "XTN",
    targetField: "Patient.telecom",
    targetPath: "Patient.telecom[0]",
    targetType: "ContactPoint",
    confidence: 0.85,
    status: "auto",
    transformation: "HL7XTN_to_FHIRContactPoint",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <Badge variant="default" className="bg-green-600 dark:bg-green-700"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
    case "auto":
      return <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />Auto</Badge>;
    case "manual":
      return <Badge variant="outline"><Settings className="h-3 w-3 mr-1" />Manual</Badge>;
    case "review":
      return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400"><AlertCircle className="h-3 w-3 mr-1" />Review</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getConfigStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-600 dark:bg-green-700">Active</Badge>;
    case "testing":
      return <Badge variant="secondary">Testing</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 0.9) return "text-green-600 dark:text-green-400";
  if (confidence >= 0.7) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function DataMapping() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("configs");
  const [selectedConfig, setSelectedConfig] = useState<MappingConfig | null>(null);
  const [showMappingDetail, setShowMappingDetail] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<FieldMapping | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [sourceFormat, setSourceFormat] = useState("");
  const [targetFormat, setTargetFormat] = useState("");
  const [sourceSample, setSourceSample] = useState("");
  const [generatedMappings, setGeneratedMappings] = useState<FieldMapping[]>(mockFieldMappings);
  const [analysisSummary, setAnalysisSummary] = useState<{totalMappings: number; autoMapped: number; needsReview: number; avgConfidence: number} | null>(null);

  const handleAnalyze = async () => {
    if (!sourceFormat || !targetFormat) {
      toast({ title: "Select source and target formats", variant: "destructive" });
      return;
    }
    
    setAnalyzing(true);
    setAnalyzeProgress(0);
    
    // Show progress animation while API call happens
    const interval = setInterval(() => {
      setAnalyzeProgress(prev => prev < 90 ? prev + 5 : prev);
    }, 100);

    try {
      const response = await fetch("/api/data-mapping/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFormat, targetFormat, sourceSample }),
      });
      
      if (!response.ok) throw new Error("Analysis failed");
      
      const result = await response.json();
      
      clearInterval(interval);
      setAnalyzeProgress(100);
      
      // Store the generated mappings in state
      setGeneratedMappings(result.fieldMappings);
      setAnalysisSummary(result.summary);
      
      toast({ 
        title: "Analysis Complete",
        description: `${result.summary.totalMappings} field mappings and ${result.summary.codeTranslationCount} code translations (${result.summary.avgConfidence}% match)`
      });
      
      setActiveTab("mappings");
    } catch (error) {
      clearInterval(interval);
      toast({ 
        title: "Analysis failed",
        description: "Could not analyze formats",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewMapping = (mapping: FieldMapping) => {
    setSelectedMapping(mapping);
    setShowMappingDetail(true);
  };

  const handleConfirmMapping = (mappingId: string) => {
    toast({ title: "Mapping confirmed" });
    setShowMappingDetail(false);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-data-mapping">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI DataMapping Engine
          </h1>
          <p className="text-muted-foreground">
            Field mappings and code translations between healthcare data formats
          </p>
        </div>
        <Button data-testid="button-new-config">
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">AI-Powered Interoperability</h4>
            <p className="text-sm text-muted-foreground">
              Analysis shows field mappings between FHIR, HL7v2, C-CDA, and custom formats. 
              Mappings refer to structural transformations only. Review all mappings before use.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{mockConfigs.length}</div>
              <div className="text-sm text-muted-foreground">Configurations</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <GitBranch className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">155</div>
              <div className="text-sm text-muted-foreground">Field Mappings</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Code className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">44</div>
              <div className="text-sm text-muted-foreground">Code Translations</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-lg font-bold">91%</div>
              <div className="text-sm text-muted-foreground">Avg Confidence</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="configs" data-testid="tab-configs">
            <Database className="h-4 w-4 mr-2" />
            Configurations
          </TabsTrigger>
          <TabsTrigger value="analyze" data-testid="tab-analyze">
            <Brain className="h-4 w-4 mr-2" />
            Analyze New
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <GitBranch className="h-4 w-4 mr-2" />
            Field Mappings
          </TabsTrigger>
          <TabsTrigger value="codes" data-testid="tab-codes">
            <Code className="h-4 w-4 mr-2" />
            Code Systems
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapping Configurations</CardTitle>
              <CardDescription>
                Saved data mapping configurations for external system integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
                    {...clickable(() => setSelectedConfig(config))}
                    data-testid={`config-${config.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Link className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.name}</span>
                          {getConfigStatusBadge(config.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{config.sourceFormat}</Badge>
                          <ArrowRight className="h-3 w-3" />
                          <Badge variant="outline" className="text-xs">{config.targetFormat}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {config.fieldMappings} mappings | {config.codeTranslations} code translations | 
                          <span className={`ml-1 ${getConfidenceColor(config.confidence)}`}>
                            {Math.round(config.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${config.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-export-${config.id}`}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyze" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Format Analysis
              </CardTitle>
              <CardDescription>
                Analyze source and target formats to auto-generate field mappings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="data-mapping-source-format">Source Format</Label>
                    <Select value={sourceFormat} onValueChange={setSourceFormat}>
                      <SelectTrigger id="data-mapping-source-format" data-testid="select-source-format">
                        <SelectValue placeholder="Select source format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hl7v2_adt">HL7v2 ADT Message</SelectItem>
                        <SelectItem value="hl7v2_oru">HL7v2 ORU Message</SelectItem>
                        <SelectItem value="hl7v2_orm">HL7v2 ORM Message</SelectItem>
                        <SelectItem value="ccda">C-CDA 2.1</SelectItem>
                        <SelectItem value="custom_json">Custom JSON</SelectItem>
                        <SelectItem value="csv">CSV/Flat File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-mapping-sample-data-optional">Sample Data (optional)</Label>
                    <Textarea id="data-mapping-sample-data-optional"
                      placeholder="Paste sample source data for better analysis..."
                      className="h-40 font-mono text-sm"
                      value={sourceSample}
                      onChange={(e) => setSourceSample(e.target.value)}
                      data-testid="input-source-sample"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="data-mapping-target-format">Target Format</Label>
                    <Select value={targetFormat} onValueChange={setTargetFormat}>
                      <SelectTrigger id="data-mapping-target-format" data-testid="select-target-format">
                        <SelectValue placeholder="Select target format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fhir_patient">FHIR R4 Patient</SelectItem>
                        <SelectItem value="fhir_observation">FHIR R4 Observation</SelectItem>
                        <SelectItem value="fhir_diagnostic">FHIR R4 DiagnosticReport</SelectItem>
                        <SelectItem value="fhir_medication">FHIR R4 MedicationRequest</SelectItem>
                        <SelectItem value="fhir_bundle">FHIR R4 Bundle</SelectItem>
                        <SelectItem value="custom_json">Custom JSON Schema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 h-40 overflow-auto">
                    <h4 className="text-sm font-medium mb-2">Target Schema Preview</h4>
                    <pre className="text-xs text-muted-foreground font-mono">
{targetFormat === "fhir_patient" ? `{
  "resourceType": "Patient",
  "name": [{ "family": "", "given": [] }],
  "birthDate": "",
  "gender": "",
  "address": [],
  "telecom": []
}` : "Select a target format to see schema..."}
                    </pre>
                  </div>
                </div>
              </div>

              {analyzing ? (
                <div className="space-y-4 p-6 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium">Analyzing formats...</span>
                  </div>
                  <Progress value={analyzeProgress} />
                  <div className="text-sm text-muted-foreground">
                    {analyzeProgress < 30 && "Parsing source format structure..."}
                    {analyzeProgress >= 30 && analyzeProgress < 60 && "Matching fields to target schema..."}
                    {analyzeProgress >= 60 && analyzeProgress < 90 && "Generating code system translations..."}
                    {analyzeProgress >= 90 && "Calculating confidence scores..."}
                  </div>
                </div>
              ) : (
                <Button onClick={handleAnalyze} className="w-full" data-testid="button-analyze">
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze and Generate Mappings
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 w-fit mx-auto mb-2">
                    <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="font-medium">1. Parse Source</div>
                  <div className="text-xs text-muted-foreground">Analysis shows source structure</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 w-fit mx-auto mb-2">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="font-medium">2. AI Matching</div>
                  <div className="text-xs text-muted-foreground">Mappings show field relationships</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto mb-2">
                    <Code className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="font-medium">3. Code Translation</div>
                  <div className="text-xs text-muted-foreground">Translations show code equivalents</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 w-fit mx-auto mb-2">
                    <CheckCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="font-medium">4. Review</div>
                  <div className="text-xs text-muted-foreground">Your review shows final mappings</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Field Mappings</CardTitle>
              <CardDescription>
                Review and confirm auto-generated field mappings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Field</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Target Field</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedMappings.map((mapping) => (
                      <TableRow key={mapping.id} data-testid={`mapping-row-${mapping.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-mono text-sm">{mapping.sourceField}</div>
                            <div className="text-xs text-muted-foreground">{mapping.sourceType}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-mono text-sm">{mapping.targetField}</div>
                            <div className="text-xs text-muted-foreground">{mapping.targetType}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={getConfidenceColor(mapping.confidence)}>
                            {Math.round(mapping.confidence * 100)}%
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(mapping.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleViewMapping(mapping)}
                              data-testid={`button-view-mapping-${mapping.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {mapping.status !== "confirmed" && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleConfirmMapping(mapping.id)}
                                data-testid={`button-confirm-mapping-${mapping.id}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code System Translations</CardTitle>
              <CardDescription>
                Mappings between different healthcare code systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">Administrative Gender</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">HL7v2 Table 0001</Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="outline">FHIR administrative-gender</Badge>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">4 codes</Badge>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source Code</TableHead>
                          <TableHead></TableHead>
                          <TableHead>Target Code</TableHead>
                          <TableHead>Display</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">M</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                          <TableCell className="font-mono">male</TableCell>
                          <TableCell>Male</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">F</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                          <TableCell className="font-mono">female</TableCell>
                          <TableCell>Female</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">U</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                          <TableCell className="font-mono">unknown</TableCell>
                          <TableCell>Unknown</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">O</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                          <TableCell className="font-mono">other</TableCell>
                          <TableCell>Other</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">Marital Status</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">HL7v2 Table 0002</Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="outline">FHIR marital-status</Badge>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">8 codes</Badge>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-expand-marital">
                    <Eye className="h-4 w-4 mr-2" />
                    View Code Mappings
                  </Button>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">Address Type</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">HL7v2 Table 0190</Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="outline">FHIR address-type</Badge>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">6 codes</Badge>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-expand-address">
                    <Eye className="h-4 w-4 mr-2" />
                    View Code Mappings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mapping Detail Dialog */}
      <Dialog open={showMappingDetail} onOpenChange={setShowMappingDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Field Mapping Details
            </DialogTitle>
            <DialogDescription>
              Review mapping configuration
            </DialogDescription>
          </DialogHeader>
          {selectedMapping && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Source
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Field:</span> <span className="font-mono">{selectedMapping.sourceField}</span></div>
                    <div><span className="text-muted-foreground">Path:</span> <span className="font-mono">{selectedMapping.sourcePath}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> {selectedMapping.sourceType}</div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    Target
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Field:</span> <span className="font-mono">{selectedMapping.targetField}</span></div>
                    <div><span className="text-muted-foreground">Path:</span> <span className="font-mono">{selectedMapping.targetPath}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> {selectedMapping.targetType}</div>
                  </div>
                </div>
              </div>

              {selectedMapping.transformation && (
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Transformation
                  </h4>
                  <Badge variant="secondary" className="font-mono">{selectedMapping.transformation}</Badge>
                </div>
              )}

              {selectedMapping.codeTranslation && (
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Code Translation
                  </h4>
                  <div className="text-sm text-muted-foreground mb-2">
                    {selectedMapping.codeTranslation.sourceSystem} → {selectedMapping.codeTranslation.targetSystem}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedMapping.codeTranslation.mappings.map((m, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono">
                        {m.sourceCode} → {m.targetCode}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className={`font-bold ${getConfidenceColor(selectedMapping.confidence)}`}>
                    {Math.round(selectedMapping.confidence * 100)}%
                  </span>
                </div>
                {getStatusBadge(selectedMapping.status)}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMappingDetail(false)} data-testid="button-close-mapping">
              Close
            </Button>
            {selectedMapping?.status !== "confirmed" && (
              <Button onClick={() => selectedMapping && handleConfirmMapping(selectedMapping.id)} data-testid="button-confirm-mapping-dialog">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Mapping
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
