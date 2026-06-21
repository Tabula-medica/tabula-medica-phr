import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Activity,
  Pill,
  ClipboardList,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  TestTube,
  Heart,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PatientListItem {
  patientId: string;
  patientName: string;
  age: number;
  sex: string;
  conditionCount: number;
  primaryCondition: string;
}

interface Condition {
  name: string;
  status: string;
  onsetDate?: string;
  severity?: string;
}

interface Vital {
  type: string;
  value: string;
  unit: string;
  date?: string;
  status?: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
}

interface TreatmentEfficacy {
  treatment: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  trend: string;
  adherence: number;
}

interface LabResult {
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  flag?: string;
}

interface PatientContext {
  patientId: string;
  patientName?: string;
  age?: number;
  sex?: string;
  conditions: Condition[];
  vitals: Vital[];
  medications: Medication[];
  allergies: string[];
  treatmentEfficacy?: TreatmentEfficacy[];
  recentLabs?: LabResult[];
}

interface CodeSuggestion {
  code: string;
  type: "ICD-10" | "CPT";
  description: string;
  confidence: number;
  rationale: string;
}

interface BillingComplexity {
  level: number;
  justification: string;
  suggestedEMCode?: string;
  emCode?: string;
  mdmComplexity?: string;
  timeEstimate?: string;
}

interface NoteResult {
  noteId: string;
  patientId: string;
  draftNote: string;
  structuredSections: Record<string, string>;
  summary: string;
  nextSteps: string[];
  concerns: string[];
  suggestedCodes: CodeSuggestion[];
  billingComplexity: BillingComplexity;
  generatedAt: string;
  disclaimer: string;
}

interface SummaryResult {
  summary: string;
  keyFindings: string[];
  treatmentProgress: string;
  activeProblems: string[];
  medicationReview: string;
  preventiveCare: string[];
  patientId: string;
  generatedAt: string;
  disclaimer: string;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === "worsening") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-yellow-500" />;
}

function PatientDataPanel({ patient }: { patient: PatientContext }) {
  return (
    <div className="space-y-4" data-testid="panel-patient-data">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold" data-testid="text-patient-name">{patient.patientName}</h3>
          <p className="text-sm text-muted-foreground" data-testid="text-patient-demographics">
            {patient.age}y {patient.sex} | ID: {patient.patientId}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
          <Heart className="h-3.5 w-3.5" /> Active Conditions
        </h4>
        <div className="space-y-1">
          {patient.conditions.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm" data-testid={`condition-item-${i}`}>
              <span>{c.name}</span>
              {c.severity && (
                <Badge variant={c.severity === "moderate" ? "default" : "secondary"} className="text-xs">
                  {c.severity}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5" /> Current Vitals
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {patient.vitals.map((v, i) => (
            <div
              key={i}
              className={`text-sm p-2 rounded-md ${
                v.status === "elevated" || v.status === "borderline" || v.status === "irregular"
                  ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                  : "bg-muted/50"
              }`}
              data-testid={`vital-item-${i}`}
            >
              <span className="text-muted-foreground text-xs">{v.type}</span>
              <div className="font-medium">
                {v.value} <span className="text-xs text-muted-foreground">{v.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
          <Pill className="h-3.5 w-3.5" /> Medications
        </h4>
        <div className="space-y-1.5">
          {patient.medications.map((m, i) => (
            <div key={i} className="text-sm" data-testid={`medication-item-${i}`}>
              <span className="font-medium">{m.name}</span>{" "}
              <span className="text-muted-foreground">{m.dosage} {m.frequency}</span>
            </div>
          ))}
        </div>
      </div>

      {patient.allergies.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Allergies
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {patient.allergies.map((a, i) => (
                <Badge key={i} variant="destructive" className="text-xs" data-testid={`allergy-badge-${i}`}>{a}</Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {patient.treatmentEfficacy && patient.treatmentEfficacy.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5" /> Treatment Efficacy
            </h4>
            <div className="space-y-2">
              {patient.treatmentEfficacy.map((t, i) => (
                <div key={i} className="text-sm p-2 rounded-md bg-muted/50" data-testid={`efficacy-item-${i}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{t.treatment}</span>
                    <TrendIcon trend={t.trend} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{t.metric}: {t.currentValue} → {t.targetValue}</span>
                    <span className="text-xs">{t.adherence}%</span>
                  </div>
                  <Progress value={t.adherence} className="h-1 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {patient.recentLabs && patient.recentLabs.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <TestTube className="h-3.5 w-3.5" /> Recent Labs
            </h4>
            <div className="space-y-1">
              {patient.recentLabs.map((l, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                    l.flag && l.flag !== "normal"
                      ? "bg-red-50 dark:bg-red-950/30"
                      : ""
                  }`}
                  data-testid={`lab-item-${i}`}
                >
                  <span>{l.name}</span>
                  <div className="text-right">
                    <span className={`font-medium ${l.flag && l.flag !== "normal" ? "text-red-600 dark:text-red-400" : ""}`}>
                      {l.value} {l.unit}
                    </span>
                    {l.referenceRange && (
                      <span className="text-xs text-muted-foreground ml-1">({l.referenceRange})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AINoteAssistantPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [visitType, setVisitType] = useState("follow_up");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [noteFormat, setNoteFormat] = useState("soap");
  const [noteResult, setNoteResult] = useState<NoteResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const patientsQuery = useQuery<{ success: boolean; data: PatientListItem[] }>({
    queryKey: ["/api/ai-note-assistant/patients"],
  });

  const patientQuery = useQuery<{ success: boolean; data: PatientContext }>({
    queryKey: ["/api/ai-note-assistant/patient", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const patient = patientQuery.data?.data;

  const generateNote = useCallback(async () => {
    if (!selectedPatientId || !chiefComplaint) {
      toast({ title: "Missing Information", description: "Please select a patient and enter a chief complaint.", variant: "destructive" });
      return;
    }

    setIsStreaming(true);
    setStreamedContent("");
    setNoteResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai-note-assistant/draft-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          visitType,
          chiefComplaint,
          additionalNotes,
          noteFormat,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate note");
      }

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No reader available");

        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "chunk") {
                  accumulated += parsed.content;
                  setStreamedContent(accumulated);
                } else if (parsed.type === "complete") {
                  setNoteResult(parsed.data);
                }
              } catch {
                // skip unparseable chunks
              }
            }
          }
        }
      } else {
        const json = await response.json();
        if (json.success && json.data) {
          setNoteResult(json.data);
        }
      }

      toast({ title: "Note Generated", description: "Clinical note draft is ready for review." });
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({ title: "Generation Failed", description: error.message || "Could not generate note.", variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [selectedPatientId, visitType, chiefComplaint, additionalNotes, noteFormat, toast]);

  const summaryMutation = useMutation({
    mutationFn: async ({ patientId, focusArea }: { patientId: string; focusArea?: string }) => {
      const res = await apiRequest("POST", "/api/ai-note-assistant/summarize", { patientId, focusArea });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSummaryResult(data.data);
        toast({ title: "Summary Generated", description: "Patient summary is ready for review." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate patient summary.", variant: "destructive" });
    },
  });

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  }, [toast]);

  const downloadNote = useCallback(() => {
    if (!noteResult) return;
    const content = `CLINICAL NOTE DRAFT\n${"=".repeat(50)}\nPatient: ${patient?.patientName || noteResult.patientId}\nDate: ${new Date(noteResult.generatedAt).toLocaleString()}\nNote ID: ${noteResult.noteId}\n${"=".repeat(50)}\n\n${noteResult.draftNote}\n\n${"=".repeat(50)}\n${noteResult.disclaimer}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical-note-${noteResult.noteId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [noteResult, patient]);

  const patients = patientsQuery.data?.data || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-ai-note-assistant">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Clinical Note Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate comprehensive clinical documentation from integrated patient data
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-compliance">
            <Shield className="h-3 w-3" /> NO-CDS Compliant
          </Badge>
        </div>

        <Alert data-testid="alert-disclaimer">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            All AI-generated content is for documentation assistance only and requires physician verification.
            This tool does not provide clinical decision support.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <Card data-testid="card-patient-select">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Patient Selection</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedPatientId}
                  onValueChange={(val) => {
                    setSelectedPatientId(val);
                    setNoteResult(null);
                    setSummaryResult(null);
                    setStreamedContent("");
                  }}
                >
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Select a patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId} data-testid={`option-patient-${p.patientId}`}>
                        {p.patientName} ({p.patientId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {patientQuery.isLoading && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            )}

            {patient && (
              <Card data-testid="card-patient-details">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Patient Data</CardTitle>
                  <CardDescription>Conditions, vitals, medications & labs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-3">
                    <PatientDataPanel patient={patient} />
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-8">
            <Tabs defaultValue="generate" className="w-full">
              <TabsList className="grid w-full grid-cols-3" data-testid="tabs-main">
                <TabsTrigger value="generate" data-testid="tab-generate">
                  <FileText className="h-4 w-4 mr-1.5" /> Generate Note
                </TabsTrigger>
                <TabsTrigger value="codes" data-testid="tab-codes">
                  <ClipboardList className="h-4 w-4 mr-1.5" /> Billing Codes
                </TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <Activity className="h-4 w-4 mr-1.5" /> Patient Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-4 mt-4">
                <Card data-testid="card-note-form">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Note Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="visitType">Visit Type</Label>
                        <Select value={visitType} onValueChange={setVisitType}>
                          <SelectTrigger id="visitType" data-testid="select-visit-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="follow_up">Follow-up</SelectItem>
                            <SelectItem value="initial">Initial Visit</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="telehealth">Telehealth</SelectItem>
                            <SelectItem value="annual_wellness">Annual Wellness</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="noteFormat">Note Format</Label>
                        <Select value={noteFormat} onValueChange={setNoteFormat}>
                          <SelectTrigger id="noteFormat" data-testid="select-note-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="soap">SOAP Note</SelectItem>
                            <SelectItem value="hp">H&P</SelectItem>
                            <SelectItem value="progress">Progress Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
                      <Textarea
                        id="chiefComplaint"
                        placeholder="Enter the patient's chief complaint..."
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        className="min-h-[60px]"
                        data-testid="input-chief-complaint"
                      />
                    </div>

                    <div>
                      <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
                      <Textarea
                        id="additionalNotes"
                        placeholder="Any additional context or observations..."
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        className="min-h-[40px]"
                        data-testid="input-additional-notes"
                      />
                    </div>

                    <Button
                      onClick={generateNote}
                      disabled={!selectedPatientId || !chiefComplaint || isStreaming}
                      className="w-full"
                      data-testid="button-generate-note"
                    >
                      {isStreaming ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Clinical Note
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {isStreaming && streamedContent && (
                  <Card data-testid="card-streaming">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating Draft...
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                          {streamedContent}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {noteResult && (
                  <div className="space-y-4">
                    <Card data-testid="card-generated-note">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Draft Clinical Note
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(noteResult.draftNote)}
                              data-testid="button-copy-note"
                            >
                              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={downloadNote}
                              data-testid="button-download-note"
                            >
                              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                            </Button>
                          </div>
                        </div>
                        <CardDescription>
                          Generated {new Date(noteResult.generatedAt).toLocaleString()} | ID: {noteResult.noteId}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px]">
                          <pre className="text-sm whitespace-pre-wrap font-mono" data-testid="text-draft-note">
                            {noteResult.draftNote}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {noteResult.summary && (
                      <Card data-testid="card-note-summary">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm" data-testid="text-note-summary">{noteResult.summary}</p>
                        </CardContent>
                      </Card>
                    )}

                    {noteResult.concerns && noteResult.concerns.length > 0 && (
                      <Card className="border-yellow-200 dark:border-yellow-800" data-testid="card-concerns">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Items Requiring Attention ({noteResult.concerns.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1.5">
                            {noteResult.concerns.map((c, i) => (
                              <li key={i} className="text-sm flex items-start gap-2" data-testid={`concern-item-${i}`}>
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {noteResult.nextSteps && noteResult.nextSteps.length > 0 && (
                      <Card data-testid="card-next-steps">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Suggested Next Steps</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1.5">
                            {noteResult.nextSteps.map((s, i) => (
                              <li key={i} className="text-sm flex items-start gap-2" data-testid={`next-step-${i}`}>
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {noteResult.suggestedCodes && noteResult.suggestedCodes.length > 0 && (
                      <Card data-testid="card-inline-codes">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Suggested Billing Codes
                          </CardTitle>
                          {noteResult.billingComplexity && (
                            <CardDescription>
                              E/M Level: {noteResult.billingComplexity.suggestedEMCode || noteResult.billingComplexity.emCode || "N/A"} |
                              Complexity: {noteResult.billingComplexity.level}/5
                              {noteResult.billingComplexity.mdmComplexity && ` | MDM: ${noteResult.billingComplexity.mdmComplexity}`}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {noteResult.suggestedCodes.map((code, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                                data-testid={`code-item-${i}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant={code.type === "ICD-10" ? "default" : "secondary"} className="text-xs">
                                    {code.type}
                                  </Badge>
                                  <div>
                                    <span className="text-sm font-mono font-medium">{code.code}</span>
                                    <span className="text-sm text-muted-foreground ml-2">{code.description}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={code.confidence * 100} className="h-1.5 w-16" />
                                  <span className="text-xs text-muted-foreground">{Math.round(code.confidence * 100)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Alert variant="default" data-testid="alert-note-disclaimer">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{noteResult.disclaimer}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="codes" className="mt-4">
                <CodesTab
                  patientId={selectedPatientId}
                  noteContent={noteResult?.draftNote}
                  toast={toast}
                />
              </TabsContent>

              <TabsContent value="summary" className="mt-4 space-y-4">
                <Card data-testid="card-summary-generate">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Generate Patient Summary</CardTitle>
                    <CardDescription>AI-powered summary from integrated patient data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => {
                        if (selectedPatientId) {
                          summaryMutation.mutate({ patientId: selectedPatientId });
                        }
                      }}
                      disabled={!selectedPatientId || summaryMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-summary"
                    >
                      {summaryMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Summary...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" /> Generate Patient Summary
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {summaryResult && (
                  <div className="space-y-4">
                    <Card data-testid="card-summary-result">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Patient Summary</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(summaryResult.summary)}
                            data-testid="button-copy-summary"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm" data-testid="text-summary">{summaryResult.summary}</p>
                      </CardContent>
                    </Card>

                    {summaryResult.keyFindings && summaryResult.keyFindings.length > 0 && (
                      <Card data-testid="card-key-findings">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Key Findings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {summaryResult.keyFindings.map((f, i) => (
                              <li key={i} className="text-sm flex items-start gap-2" data-testid={`finding-${i}`}>
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {summaryResult.treatmentProgress && (
                      <Card data-testid="card-treatment-progress">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Treatment Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm" data-testid="text-treatment-progress">{summaryResult.treatmentProgress}</p>
                        </CardContent>
                      </Card>
                    )}

                    {summaryResult.activeProblems && summaryResult.activeProblems.length > 0 && (
                      <Card data-testid="card-active-problems">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Active Problems</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {summaryResult.activeProblems.map((p, i) => (
                              <Badge key={i} variant="outline" data-testid={`problem-${i}`}>{p}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {summaryResult.medicationReview && (
                      <Card data-testid="card-med-review">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Medication Review</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{summaryResult.medicationReview}</p>
                        </CardContent>
                      </Card>
                    )}

                    <Alert variant="default" data-testid="alert-summary-disclaimer">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{summaryResult.disclaimer}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodesTab({
  patientId,
  noteContent,
  toast,
}: {
  patientId: string;
  noteContent?: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [clinicalText, setClinicalText] = useState("");
  const [codeResult, setCodeResult] = useState<{ codes: CodeSuggestion[]; billingLevel?: any } | null>(null);

  const codeMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/ai-note-assistant/suggest-codes", {
        clinicalText: text,
        patientId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCodeResult(data.data);
        toast({ title: "Codes Suggested", description: `${(data.data.codes || []).length} billing codes identified.` });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suggest billing codes.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card data-testid="card-code-input">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ICD-10 & CPT Code Suggestions</CardTitle>
          <CardDescription>Enter clinical text or use the generated note to get billing code suggestions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {noteContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClinicalText(noteContent)}
              data-testid="button-use-note"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Use Generated Note
            </Button>
          )}
          <div>
            <Label htmlFor="clinicalText">Clinical Documentation</Label>
            <Textarea
              id="clinicalText"
              placeholder="Paste or type clinical documentation to analyze for billing codes..."
              value={clinicalText}
              onChange={(e) => setClinicalText(e.target.value)}
              className="min-h-[120px]"
              data-testid="input-clinical-text"
            />
          </div>
          <Button
            onClick={() => codeMutation.mutate(clinicalText)}
            disabled={!clinicalText || codeMutation.isPending}
            className="w-full"
            data-testid="button-suggest-codes"
          >
            {codeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4 mr-2" /> Suggest Billing Codes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {codeResult && (
        <div className="space-y-4">
          {codeResult.billingLevel && (
            <Card data-testid="card-billing-level">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Billing Level Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-md bg-primary/10">
                    <div className="text-2xl font-bold text-primary">{codeResult.billingLevel.emCode || "99214"}</div>
                    <div className="text-xs text-muted-foreground">E/M Code</div>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <div className="text-2xl font-bold">{codeResult.billingLevel.level || 4}</div>
                    <div className="text-xs text-muted-foreground">Level</div>
                  </div>
                  {codeResult.billingLevel.mdmComplexity && (
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-lg font-bold">{codeResult.billingLevel.mdmComplexity}</div>
                      <div className="text-xs text-muted-foreground">MDM</div>
                    </div>
                  )}
                  {codeResult.billingLevel.timeEstimate && (
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-lg font-bold">{codeResult.billingLevel.timeEstimate}</div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </div>
                  )}
                </div>
                {codeResult.billingLevel.justification && (
                  <p className="text-sm text-muted-foreground mt-3">{codeResult.billingLevel.justification}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-code-results">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Suggested Codes ({(codeResult.codes || []).length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = (codeResult.codes || []).map(c => `${c.type}: ${c.code} - ${c.description}`).join("\n");
                    navigator.clipboard.writeText(text);
                    toast({ title: "Copied", description: "Codes copied to clipboard." });
                  }}
                  data-testid="button-copy-codes"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(codeResult.codes || []).map((code, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-md border"
                    data-testid={`code-result-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={code.type === "ICD-10" ? "default" : "secondary"}>
                          {code.type}
                        </Badge>
                        <span className="font-mono font-medium">{code.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={code.confidence * 100} className="h-2 w-20" />
                        <span className="text-xs font-medium">{Math.round(code.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm mt-1">{code.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{code.rationale}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
