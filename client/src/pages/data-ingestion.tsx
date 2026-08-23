import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileJson,
  FileCode,
  Image as ImageIcon,
  Activity,
  Pill,
  Stethoscope,
  TestTube,
  Heart,
  ClipboardList,
  User,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface SupportedFormat {
  format: string;
  description: string;
  extensions: string[];
}

interface IngestionJob {
  id: string;
  filename: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  processingTimeMs?: number;
  errorCount: number;
}

interface IngestionSummary {
  jobId: string;
  status: string;
  format: string;
  resourceCounts: {
    patients: number;
    encounters: number;
    conditions: number;
    medications: number;
    observations: number;
    procedures: number;
    imagingStudies: number;
    documents: number;
    allergies: number;
    immunizations: number;
  };
  validationSummary: {
    totalResources: number;
    validResources: number;
    errorCount: number;
    warningCount: number;
  };
  processingTimeMs: number;
  aiConfidenceScore: number;
}

interface ParsedData {
  format: string;
  patient?: {
    name?: { given?: string[]; family?: string };
    birthDate?: string;
    gender?: string;
  };
  conditions?: { displayText: string; code?: string }[];
  medications?: { displayText: string; dosage?: string }[];
  observations?: { displayText: string; value?: string; unit?: string }[];
  procedures?: { displayText: string }[];
  imagingStudies?: { modality: string; description?: string }[];
}

interface ExtractedEntities {
  diagnoses: { text: string; confidence: number }[];
  medications: { text: string; confidence: number }[];
  procedures: { text: string; confidence: number }[];
  labResults: { text: string; normalizedValue?: string; confidence: number }[];
  vitalSigns: { text: string; normalizedValue?: string; confidence: number }[];
  allergies: { text: string; confidence: number }[];
  immunizations: { text: string; confidence: number }[];
  socialHistory: { text: string; confidence: number }[];
  familyHistory: { text: string; confidence: number }[];
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  fhir_r4: <FileJson className="h-4 w-4" />,
  hl7_v2: <FileCode className="h-4 w-4" />,
  ccd: <FileText className="h-4 w-4" />,
  ccda: <FileText className="h-4 w-4" />,
  dicom: <ImageIcon className="h-4 w-4" />,
  csv: <FileText className="h-4 w-4" />,
  json: <FileJson className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500",
  detecting: "bg-blue-500",
  parsing: "bg-blue-500",
  extracting: "bg-purple-500",
  normalizing: "bg-orange-500",
  validating: "bg-yellow-500",
  completed: "bg-green-500",
  error: "bg-red-500",
};

export default function DataIngestionPage() {
  const [rawData, setRawData] = useState("");
  const [filename, setFilename] = useState("sample-data.json");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const { data: formats } = useQuery<{ formats: SupportedFormat[] }>({
    queryKey: ["/api/ingestion/formats"],
  });

  const { data: jobsData, refetch: refetchJobs } = useQuery<{ jobs: IngestionJob[] }>({
    queryKey: ["/api/ingestion/jobs"],
  });

  const { data: summary, refetch: refetchSummary } = useQuery<IngestionSummary>({
    queryKey: ["/api/ingestion/jobs", currentJobId, "summary"],
    enabled: !!currentJobId,
  });

  const { data: parsedData } = useQuery<{ parsedData: ParsedData }>({
    queryKey: ["/api/ingestion/jobs", currentJobId, "parsed"],
    enabled: !!currentJobId && summary?.status === "completed",
  });

  const { data: entitiesData } = useQuery<{ extractedEntities: ExtractedEntities }>({
    queryKey: ["/api/ingestion/jobs", currentJobId, "entities"],
    enabled: !!currentJobId && summary?.status === "completed",
  });

  const ingestMutation = useMutation({
    mutationFn: async (): Promise<{ jobId: string; status: string; format: string }> => {
      const response = await fetch("/api/ingestion/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rawData, filename }),
      });
      if (!response.ok) throw new Error("Ingestion failed");
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      refetchJobs();
      refetchSummary();
    },
  });

  const detectFormatMutation = useMutation({
    mutationFn: async (): Promise<{ format: string }> => {
      const response = await fetch("/api/ingestion/detect-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rawData, filename }),
      });
      if (!response.ok) throw new Error("Format detection failed");
      return response.json();
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilename(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setRawData(content);
        detectFormatMutation.mutate();
      };
      reader.readAsText(file);
    }
  };

  const loadSampleHL7 = () => {
    const sampleHL7 = `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ORU^R01|MSG00001|P|2.5.1
PID|1|12345|MRN001^^^HOSPITAL^MR||DOE^JOHN^A||19800515|M|||123 MAIN ST^^ANYTOWN^CA^90210||5551234567
OBR|1|ORD001|ACC001|CBC^Complete Blood Count^L|||20240115100000
OBX|1|NM|WBC^White Blood Cell Count^L||7.5|10^9/L|4.5-11.0|N|||F
OBX|2|NM|RBC^Red Blood Cell Count^L||4.8|10^12/L|4.5-5.5|N|||F
OBX|3|NM|HGB^Hemoglobin^L||14.2|g/dL|13.5-17.5|N|||F
OBX|4|NM|HCT^Hematocrit^L||42.5|%|38.8-50.0|N|||F
OBX|5|NM|PLT^Platelet Count^L||225|10^9/L|150-400|N|||F`;
    setRawData(sampleHL7);
    setFilename("sample-labs.hl7");
    detectFormatMutation.mutate();
  };

  const loadSampleFHIR = () => {
    const sampleFHIR = JSON.stringify({
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-001",
            name: [{ family: "Smith", given: ["Jane", "Marie"] }],
            birthDate: "1985-03-15",
            gender: "female",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            id: "condition-001",
            code: {
              coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }],
            },
            clinicalStatus: { coding: [{ code: "active" }] },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: "obs-001",
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }],
            },
            valueQuantity: { value: 7.2, unit: "%" },
            effectiveDateTime: "2024-01-10",
          },
        },
        {
          resource: {
            resourceType: "MedicationStatement",
            id: "med-001",
            status: "active",
            medicationCodeableConcept: {
              coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500mg" }],
            },
          },
        },
      ],
    }, null, 2);
    setRawData(sampleFHIR);
    setFilename("sample-bundle.json");
    detectFormatMutation.mutate();
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "patients": return <User className="h-4 w-4" />;
      case "conditions": return <Stethoscope className="h-4 w-4" />;
      case "medications": return <Pill className="h-4 w-4" />;
      case "observations": return <TestTube className="h-4 w-4" />;
      case "procedures": return <Activity className="h-4 w-4" />;
      case "imagingStudies": return <ImageIcon className="h-4 w-4" />;
      case "allergies": return <AlertCircle className="h-4 w-4" />;
      case "immunizations": return <Heart className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Data Ingestion</h1>
            <p className="text-muted-foreground mt-1">
              Import and structure health data from multiple formats with AI-powered extraction
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            <Activity className="h-3 w-3 mr-1" />
            Multi-Format Support
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Health Data
                </CardTitle>
                <CardDescription>
                  Upload or paste health data in any supported format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={loadSampleHL7} data-testid="button-sample-hl7">
                    Load Sample HL7
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadSampleFHIR} data-testid="button-sample-fhir">
                    Load Sample FHIR
                  </Button>
                  <div className="relative">
                    <Input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileUpload}
                      accept=".json,.hl7,.xml,.csv,.txt"
                      data-testid="input-file-upload"
                    />
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="filename">Filename</Label>
                  <Input
                    id="filename"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="data-file.json"
                    data-testid="input-filename"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FieldCaption>Raw Data</FieldCaption>
                    {detectFormatMutation.data && (
                      <Badge variant="secondary" data-testid="badge-detected-format">
                        {FORMAT_ICONS[detectFormatMutation.data.format] || <FileText className="h-4 w-4" />}
                        <span className="ml-1">{detectFormatMutation.data.format}</span>
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                    placeholder="Paste your health data here (FHIR JSON, HL7 v2, CCD/C-CDA XML, CSV, etc.)"
                    className="font-mono text-sm min-h-[200px]"
                    data-testid="textarea-raw-data"
                  />
                </div>

                <Button
                  onClick={() => ingestMutation.mutate()}
                  disabled={ingestMutation.isPending || !rawData.trim()}
                  className="w-full"
                  data-testid="button-ingest"
                >
                  {ingestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Process & Extract Data
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Ingestion Results
                  </CardTitle>
                  <CardDescription>
                    Job ID: {summary.jobId}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="summary">
                    <TabsList className="grid w-full grid-cols-3 gap-1">
                      <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
                      <TabsTrigger value="parsed" data-testid="tab-parsed">Parsed Data</TabsTrigger>
                      <TabsTrigger value="entities" data-testid="tab-entities">Entities</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-4 space-y-4">
                      <div className="flex items-center gap-4">
                        <Badge className={STATUS_COLORS[summary.status]} data-testid="badge-status">
                          {summary.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : summary.status === "error" ? (
                            <XCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          )}
                          {summary.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Format: {summary.format}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {summary.processingTimeMs}ms
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">AI Confidence</span>
                          <span className="text-sm">{Math.round(summary.aiConfidenceScore * 100)}%</span>
                        </div>
                        <Progress value={summary.aiConfidenceScore * 100} data-testid="progress-confidence" />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(summary.resourceCounts).map(([key, count]) => (
                          <div key={key} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" data-testid={`stat-${key}`}>
                            {getResourceIcon(key)}
                            <div>
                              <p className="text-2xl font-bold">{count}</p>
                              <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="stat-valid">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {summary.validationSummary.validResources}
                          </p>
                          <p className="text-xs text-muted-foreground">Valid Resources</p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid="stat-errors">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {summary.validationSummary.errorCount}
                          </p>
                          <p className="text-xs text-muted-foreground">Validation Errors</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="parsed" className="mt-4">
                      <ScrollArea className="h-[400px]">
                        {parsedData?.parsedData ? (
                          <div className="space-y-4">
                            {parsedData.parsedData.patient && (
                              <div className="p-3 border rounded-lg" data-testid="section-patient">
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <User className="h-4 w-4" />
                                  Patient
                                </h4>
                                <div className="text-sm space-y-1">
                                  {parsedData.parsedData.patient.name && (
                                    <p>Name: {parsedData.parsedData.patient.name.given?.join(" ")} {parsedData.parsedData.patient.name.family}</p>
                                  )}
                                  {parsedData.parsedData.patient.birthDate && (
                                    <p>DOB: {parsedData.parsedData.patient.birthDate}</p>
                                  )}
                                  {parsedData.parsedData.patient.gender && (
                                    <p>Gender: {parsedData.parsedData.patient.gender}</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {parsedData.parsedData.conditions && parsedData.parsedData.conditions.length > 0 && (
                              <div className="p-3 border rounded-lg" data-testid="section-conditions">
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <Stethoscope className="h-4 w-4" />
                                  Conditions ({parsedData.parsedData.conditions.length})
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {parsedData.parsedData.conditions.map((c, i) => (
                                    <li key={i}>{c.displayText} {c.code && <Badge variant="outline" className="ml-2 text-xs">{c.code}</Badge>}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {parsedData.parsedData.medications && parsedData.parsedData.medications.length > 0 && (
                              <div className="p-3 border rounded-lg" data-testid="section-medications">
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <Pill className="h-4 w-4" />
                                  Medications ({parsedData.parsedData.medications.length})
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {parsedData.parsedData.medications.map((m, i) => (
                                    <li key={i}>{m.displayText} {m.dosage && `- ${m.dosage}`}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {parsedData.parsedData.observations && parsedData.parsedData.observations.length > 0 && (
                              <div className="p-3 border rounded-lg" data-testid="section-observations">
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <TestTube className="h-4 w-4" />
                                  Observations ({parsedData.parsedData.observations.length})
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {parsedData.parsedData.observations.map((o, i) => (
                                    <li key={i}>
                                      {o.displayText}: {o.value} {o.unit}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No parsed data available</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="entities" className="mt-4">
                      <ScrollArea className="h-[400px]">
                        {entitiesData?.extractedEntities ? (
                          <div className="space-y-4">
                            {Object.entries(entitiesData.extractedEntities).map(([category, entities]) => (
                              entities.length > 0 && (
                                <div key={category} className="p-3 border rounded-lg" data-testid={`entities-${category}`}>
                                  <h4 className="font-medium capitalize mb-2">
                                    {category.replace(/([A-Z])/g, " $1")} ({entities.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {entities.map((e: any, i: number) => (
                                      <Badge
                                        key={i}
                                        variant={e.confidence > 0.8 ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {e.text}
                                        {e.normalizedValue && `: ${e.normalizedValue}`}
                                        <span className="ml-1 opacity-60">{Math.round(e.confidence * 100)}%</span>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No extracted entities available</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Supported Formats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {formats?.formats?.map((f) => (
                    <div key={f.format} className="flex items-center gap-2 p-2 bg-muted/30 rounded" data-testid={`format-${f.format}`}>
                      {FORMAT_ICONS[f.format] || <FileText className="h-4 w-4" />}
                      <div>
                        <p className="text-sm font-medium">{f.format.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {jobsData?.jobs?.length ? (
                    <div className="space-y-2">
                      {jobsData.jobs.slice(0, 10).map((job) => (
                        <div
                          key={job.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${currentJobId === job.id ? "border-primary bg-primary/5" : "hover-elevate"}`}
                          {...clickable(() => setCurrentJobId(job.id))}
                          data-testid={`job-${job.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{job.filename}</span>
                            <Badge className={`${STATUS_COLORS[job.status]} text-xs`}>
                              {job.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {job.format}
                            </Badge>
                            <span>{new Date(job.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No ingestion jobs yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This tool extracts and structures health data for analysis. It does not provide clinical recommendations or medical advice. All PHI is handled per HIPAA requirements.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
