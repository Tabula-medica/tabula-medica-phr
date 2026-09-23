import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText, Mic, MicOff, Sparkles, Shield, ShieldCheck, ShieldAlert,
  CheckCircle, Clock, AlertTriangle, Loader2, Send, Activity,
  Heart, Pill, FlaskConical, Stethoscope, ClipboardList, Eye,
  Save, RefreshCw, ChevronRight, BarChart3, Code,
  Plus, Trash2, Volume2,
} from "lucide-react";

const API_BASE = "/api/ai-automated-documentation";

interface GovernanceCheck {
  approved: boolean;
  integrationStatus: string;
  baaInPlace: boolean;
  dataMinimization: boolean;
  encryptionVerified: boolean;
  complianceFrameworks: string[];
  checkedAt: string;
  details: string;
}

interface CodeSuggestion {
  type: string;
  code: string;
  description: string;
  confidence: string;
  rationale: string;
}

interface DraftNote {
  id: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  noteType: string;
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    fullNote: string;
  };
  suggestedCodes: CodeSuggestion[];
  sources: {
    structuredData: boolean;
    voiceTranscription: boolean;
    transcriptText?: string;
  };
  governanceStatus: GovernanceCheck;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  disclaimer: string;
}

interface TranscriptionResult {
  text: string;
  structuredExtraction: Record<string, unknown>;
  confidence: number;
}

interface LabEntry {
  test: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "abnormal" | "critical";
}

interface MedEntry {
  name: string;
  dose: string;
  frequency: string;
}

export default function AIAutomatedDocumentation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("builder");

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: Record<string, unknown>; governance: GovernanceCheck }>({
    queryKey: [API_BASE, "stats"],
  });

  const { data: draftsData, isLoading: draftsLoading } = useQuery<{ drafts: DraftNote[]; total: number }>({
    queryKey: [API_BASE, "drafts"],
  });

  const governance = statsData?.governance;
  const stats = statsData?.stats as { totalDrafts: number; byStatus: Record<string, number>; byNoteType: Record<string, number>; recentDrafts: number; voiceNotesUsed: number } | undefined;

  return (
    <div className="min-h-screen bg-background" data-testid="automated-documentation-page">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="page-title">AI Automated Clinical Documentation</h1>
                <p className="text-sm text-muted-foreground">Generate draft clinical notes from structured data and voice notes</p>
              </div>
            </div>
            <GovernanceBadge governance={governance} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="alert-no-cds">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm font-medium">Documentation Assistance Only — NO Clinical Decision Support</AlertTitle>
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
            All AI-generated notes are DRAFTS requiring physician review and validation. This system does not provide diagnostic reasoning, treatment recommendations, or clinical decision support. Final documentation authority rests with the licensed healthcare provider.
          </AlertDescription>
        </Alert>

        {!statsLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={FileText} label="Total Drafts" value={stats.totalDrafts} testId="stat-total-drafts" />
            <StatCard icon={Clock} label="Pending Review" value={stats.byStatus?.pending_review || 0} testId="stat-pending" />
            <StatCard icon={CheckCircle} label="Finalized" value={stats.byStatus?.finalized || 0} testId="stat-finalized" />
            <StatCard icon={BarChart3} label="Last 24h" value={stats.recentDrafts} testId="stat-recent" />
            <StatCard icon={Mic} label="Voice Notes" value={stats.voiceNotesUsed} testId="stat-voice" />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="builder" data-testid="tab-builder">
              <Sparkles className="h-4 w-4 mr-2" />
              Smart Note Builder
            </TabsTrigger>
            <TabsTrigger value="drafts" data-testid="tab-drafts">
              <ClipboardList className="h-4 w-4 mr-2" />
              Draft Queue ({draftsData?.total || 0})
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Governance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-6">
            <SmartNoteBuilder governance={governance} />
          </TabsContent>

          <TabsContent value="drafts" className="mt-6">
            <DraftQueue drafts={draftsData?.drafts || []} isLoading={draftsLoading} />
          </TabsContent>

          <TabsContent value="governance" className="mt-6">
            <GovernancePanel governance={governance} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, testId }: { icon: typeof FileText; label: string; value: number; testId: string }) {
  return (
    <Card className="p-3" data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

function GovernanceBadge({ governance }: { governance?: GovernanceCheck }) {
  if (!governance) return null;
  return (
    <Badge
      variant={governance.approved ? "default" : "destructive"}
      className="gap-1"
      data-testid="badge-governance"
    >
      {governance.approved ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {governance.approved ? "Governance: Approved" : "Governance: Blocked"}
    </Badge>
  );
}

function SmartNoteBuilder({ governance }: { governance?: GovernanceCheck }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"input" | "review">("input");
  const [noteType, setNoteType] = useState<string>("soap");
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<DraftNote | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [form, setForm] = useState({
    patientId: "",
    patientName: "",
    dateOfBirth: "",
    visitDate: new Date().toISOString().split("T")[0],
    visitType: "follow_up" as string,
    chiefComplaint: "",
    bp: "",
    hr: "",
    temp: "",
    rr: "",
    spo2: "",
    weight: "",
    height: "",
    conditions: "",
    allergies: "",
    symptoms: "",
    assessmentNotes: "",
    followUp: "",
  });

  const [labs, setLabs] = useState<LabEntry[]>([]);
  const [meds, setMeds] = useState<MedEntry[]>([]);

  const updateForm = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const transcribeMutation = useMutation({
    mutationFn: async (audioBase64: string) => {
      const res = await apiRequest("POST", `${API_BASE}/transcribe`, {
        audioBase64,
        mimeType: "audio/webm",
        clinicianId: "current-clinician",
      });
      return res.json();
    },
    onSuccess: (data: { transcription: TranscriptionResult }) => {
      setTranscription(data.transcription);
      toast({ title: "Voice Note Transcribed", description: `Transcription complete (${data.transcription.confidence * 100}% confidence)` });
    },
    onError: () => {
      toast({ title: "Transcription Failed", description: "Could not transcribe voice note. Please try again.", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const structuredData = {
        patientId: form.patientId || `patient-${Date.now()}`,
        patientName: form.patientName,
        dateOfBirth: form.dateOfBirth || undefined,
        visitDate: form.visitDate,
        visitType: form.visitType,
        chiefComplaint: form.chiefComplaint,
        vitalSigns: {
          bloodPressure: form.bp || undefined,
          heartRate: form.hr ? parseFloat(form.hr) : undefined,
          temperature: form.temp ? parseFloat(form.temp) : undefined,
          respiratoryRate: form.rr ? parseFloat(form.rr) : undefined,
          oxygenSaturation: form.spo2 ? parseFloat(form.spo2) : undefined,
          weight: form.weight ? parseFloat(form.weight) : undefined,
          height: form.height ? parseFloat(form.height) : undefined,
        },
        conditions: form.conditions ? form.conditions.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        allergies: form.allergies ? form.allergies.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        symptoms: form.symptoms ? form.symptoms.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        medications: meds.length > 0 ? meds : undefined,
        labResults: labs.length > 0 ? labs : undefined,
        assessmentNotes: form.assessmentNotes || undefined,
        followUp: form.followUp || undefined,
      };

      const res = await apiRequest("POST", `${API_BASE}/generate`, {
        structuredData,
        transcription: transcription || undefined,
        noteType,
        clinicianId: "current-clinician",
      });
      return res.json();
    },
    onSuccess: (data: { draft: DraftNote }) => {
      setGeneratedDraft(data.draft);
      setStep("review");
      queryClient.invalidateQueries({ queryKey: [API_BASE, "drafts"] });
      queryClient.invalidateQueries({ queryKey: [API_BASE, "stats"] });
      toast({ title: "Draft Note Generated", description: "Review the AI-generated note below." });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate note. Please try again.", variant: "destructive" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          transcribeMutation.mutate(base64);
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone. Please check permissions.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const canGenerate = form.patientName && form.chiefComplaint && governance?.approved;

  if (step === "review" && generatedDraft) {
    return <NoteReviewPanel draft={generatedDraft} onBack={() => { setStep("input"); setGeneratedDraft(null); }} />;
  }

  return (
    <div className="space-y-6" data-testid="smart-note-builder">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="h-5 w-5 text-primary" />
                Patient & Visit Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName">Patient Name *</Label>
                  <Input id="patientName" value={form.patientName} onChange={e => updateForm("patientName", e.target.value)} placeholder="Jane Doe" data-testid="input-patient-name" />
                </div>
                <div>
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input id="patientId" value={form.patientId} onChange={e => updateForm("patientId", e.target.value)} placeholder="Auto-generated" data-testid="input-patient-id" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="date" value={form.dateOfBirth} onChange={e => updateForm("dateOfBirth", e.target.value)} data-testid="input-dob" />
                </div>
                <div>
                  <Label htmlFor="visitDate">Visit Date</Label>
                  <Input id="visitDate" type="date" value={form.visitDate} onChange={e => updateForm("visitDate", e.target.value)} data-testid="input-visit-date" />
                </div>
                <div>
                  <Label htmlFor="visitType">Visit Type</Label>
                  <Select value={form.visitType} onValueChange={v => updateForm("visitType", v)}>
                    <SelectTrigger data-testid="select-visit-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Initial Visit</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="telehealth">Telehealth</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="cc">Chief Complaint *</Label>
                <Input id="cc" value={form.chiefComplaint} onChange={e => updateForm("chiefComplaint", e.target.value)} placeholder="e.g., Persistent headache for 3 days" data-testid="input-chief-complaint" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Vital Signs & Structured Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="ai-automated-documentati-blood-pressure">Blood Pressure</Label>
                  <Input id="ai-automated-documentati-blood-pressure" value={form.bp} onChange={e => updateForm("bp", e.target.value)} placeholder="120/80" data-testid="input-bp" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-heart-rate-bpm">Heart Rate (bpm)</Label>
                  <Input id="ai-automated-documentati-heart-rate-bpm" value={form.hr} onChange={e => updateForm("hr", e.target.value)} placeholder="72" data-testid="input-hr" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-temperature-f">Temperature (°F)</Label>
                  <Input id="ai-automated-documentati-temperature-f" value={form.temp} onChange={e => updateForm("temp", e.target.value)} placeholder="98.6" data-testid="input-temp" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-resp-rate-min">Resp Rate (/min)</Label>
                  <Input id="ai-automated-documentati-resp-rate-min" value={form.rr} onChange={e => updateForm("rr", e.target.value)} placeholder="16" data-testid="input-rr" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-spo2">SpO2 (%)</Label>
                  <Input id="ai-automated-documentati-spo2" value={form.spo2} onChange={e => updateForm("spo2", e.target.value)} placeholder="99" data-testid="input-spo2" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-weight-kg">Weight (kg)</Label>
                  <Input id="ai-automated-documentati-weight-kg" value={form.weight} onChange={e => updateForm("weight", e.target.value)} placeholder="70" data-testid="input-weight" />
                </div>
                <div>
                  <Label htmlFor="ai-automated-documentati-height-cm">Height (cm)</Label>
                  <Input id="ai-automated-documentati-height-cm" value={form.height} onChange={e => updateForm("height", e.target.value)} placeholder="175" data-testid="input-height" />
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="ai-automated-documentati-active-conditions-comma-separated">Active Conditions (comma-separated)</Label>
                <Input id="ai-automated-documentati-active-conditions-comma-separated" value={form.conditions} onChange={e => updateForm("conditions", e.target.value)} placeholder="e.g., Hypertension, Type 2 Diabetes" data-testid="input-conditions" />
              </div>
              <div>
                <Label htmlFor="ai-automated-documentati-allergies-comma-separated">Allergies (comma-separated)</Label>
                <Input id="ai-automated-documentati-allergies-comma-separated" value={form.allergies} onChange={e => updateForm("allergies", e.target.value)} placeholder="e.g., Penicillin, Sulfa drugs" data-testid="input-allergies" />
              </div>
              <div>
                <Label htmlFor="ai-automated-documentati-reported-symptoms-comma-separated">Reported Symptoms (comma-separated)</Label>
                <Input id="ai-automated-documentati-reported-symptoms-comma-separated" value={form.symptoms} onChange={e => updateForm("symptoms", e.target.value)} placeholder="e.g., Headache, Nausea, Photophobia" data-testid="input-symptoms" />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <FieldCaption className="flex items-center gap-1"><Pill className="h-4 w-4" />Medications</FieldCaption>
                  <Button variant="outline" size="sm" onClick={() => setMeds(prev => [...prev, { name: "", dose: "", frequency: "" }])} data-testid="button-add-med"><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {meds.map((med, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                    <Input placeholder="Medication name" value={med.name} onChange={e => { const n = [...meds]; n[i].name = e.target.value; setMeds(n); }} data-testid={`input-med-name-${i}`} />
                    <Input placeholder="Dose" value={med.dose} onChange={e => { const n = [...meds]; n[i].dose = e.target.value; setMeds(n); }} data-testid={`input-med-dose-${i}`} />
                    <Input placeholder="Frequency" value={med.frequency} onChange={e => { const n = [...meds]; n[i].frequency = e.target.value; setMeds(n); }} data-testid={`input-med-freq-${i}`} />
                    <Button variant="ghost" size="sm" onClick={() => setMeds(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-med-${i}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <FieldCaption className="flex items-center gap-1"><FlaskConical className="h-4 w-4" />Lab Results</FieldCaption>
                  <Button variant="outline" size="sm" onClick={() => setLabs(prev => [...prev, { test: "", value: "", unit: "", referenceRange: "", flag: "normal" }])} data-testid="button-add-lab"><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {labs.map((lab, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 mb-2">
                    <Input placeholder="Test name" value={lab.test} onChange={e => { const n = [...labs]; n[i].test = e.target.value; setLabs(n); }} data-testid={`input-lab-test-${i}`} />
                    <Input placeholder="Value" value={lab.value} onChange={e => { const n = [...labs]; n[i].value = e.target.value; setLabs(n); }} data-testid={`input-lab-value-${i}`} />
                    <Input placeholder="Unit" value={lab.unit} onChange={e => { const n = [...labs]; n[i].unit = e.target.value; setLabs(n); }} data-testid={`input-lab-unit-${i}`} />
                    <Input placeholder="Ref Range" value={lab.referenceRange} onChange={e => { const n = [...labs]; n[i].referenceRange = e.target.value; setLabs(n); }} data-testid={`input-lab-range-${i}`} />
                    <Select value={lab.flag} onValueChange={v => { const n = [...labs]; n[i].flag = v as LabEntry["flag"]; setLabs(n); }}>
                      <SelectTrigger data-testid={`select-lab-flag-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="abnormal">Abnormal</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => setLabs(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-lab-${i}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div>
                <Label htmlFor="ai-automated-documentati-assessment-clinical-notes">Assessment / Clinical Notes</Label>
                <Textarea id="ai-automated-documentati-assessment-clinical-notes" value={form.assessmentNotes} onChange={e => updateForm("assessmentNotes", e.target.value)} placeholder="Additional clinical observations or assessment notes..." rows={3} data-testid="input-assessment-notes" />
              </div>
              <div>
                <Label htmlFor="ai-automated-documentati-follow-up-plan">Follow-up Plan</Label>
                <Input id="ai-automated-documentati-follow-up-plan" value={form.followUp} onChange={e => updateForm("followUp", e.target.value)} placeholder="e.g., Return in 2 weeks" data-testid="input-followup" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mic className="h-5 w-5 text-primary" />
                Voice Note
              </CardTitle>
              <CardDescription>Record a clinician voice note to supplement structured data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="lg"
                  className="w-32 h-32 rounded-full flex flex-col gap-2"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={transcribeMutation.isPending}
                  data-testid="button-record"
                >
                  {transcribeMutation.isPending ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-xs">Processing...</span>
                    </>
                  ) : isRecording ? (
                    <>
                      <MicOff className="h-8 w-8" />
                      <span className="text-xs">Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-8 w-8" />
                      <span className="text-xs">Record</span>
                    </>
                  )}
                </Button>
              </div>
              {isRecording && (
                <div className="text-center">
                  <Badge variant="destructive" className="animate-pulse gap-1">
                    <Volume2 className="h-3 w-3" /> Recording...
                  </Badge>
                </div>
              )}
              {transcription && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/50" data-testid="transcription-result">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Transcript</span>
                    <Badge variant="outline" className="text-xs">{Math.round(transcription.confidence * 100)}% confidence</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{transcription.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Note Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ai-automated-documentati-note-type">Note Type</Label>
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger id="ai-automated-documentati-note-type" data-testid="select-note-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soap">SOAP Note</SelectItem>
                    <SelectItem value="progress">Progress Note</SelectItem>
                    <SelectItem value="discharge">Discharge Summary</SelectItem>
                    <SelectItem value="procedure">Procedure Note</SelectItem>
                    <SelectItem value="consultation">Consultation Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-lg border space-y-2" data-testid="data-sources-panel">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Data Sources</h4>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${form.patientName ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={!form.patientName ? "text-muted-foreground" : ""}>Patient Demographics</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${(form.bp || form.hr || form.temp) ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={!(form.bp || form.hr || form.temp) ? "text-muted-foreground" : ""}>Vital Signs</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${form.conditions ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={!form.conditions ? "text-muted-foreground" : ""}>Conditions/Diagnoses</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${meds.length > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={meds.length === 0 ? "text-muted-foreground" : ""}>Medications ({meds.length})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${labs.length > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={labs.length === 0 ? "text-muted-foreground" : ""}>Lab Results ({labs.length})</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {transcription ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={!transcription ? "text-muted-foreground" : ""}>Voice Transcription</span>
                </div>
              </div>

              <DraftQualityChecklist
                hasPatient={!!form.patientName}
                hasChiefComplaint={!!form.chiefComplaint}
                hasVitals={!!(form.bp || form.hr || form.temp)}
                hasConditions={!!form.conditions}
                hasMeds={meds.length > 0}
                hasLabs={labs.length > 0}
                hasAssessment={!!form.assessmentNotes}
                hasVoice={!!transcription}
                noteType={noteType}
              />

              <Button
                className="w-full"
                size="lg"
                disabled={!canGenerate || generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
                data-testid="button-generate-note"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Draft Note
                  </>
                )}
              </Button>
              {!governance?.approved && (
                <p className="text-xs text-destructive text-center">Governance check must pass before generating notes</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NoteReviewPanel({ draft, onBack }: { draft: DraftNote; onBack: () => void }) {
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `${API_BASE}/drafts/${draft.id}/status`, {
        status,
        clinicianId: "current-clinician",
      });
      return res.json();
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: [API_BASE, "drafts"] });
      queryClient.invalidateQueries({ queryKey: [API_BASE, "stats"] });
      toast({ title: "Status Updated", description: `Draft marked as ${status}` });
    },
  });

  return (
    <div className="space-y-6" data-testid="note-review-panel">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back-to-builder">
          <ChevronRight className="h-4 w-4 mr-1 rotate-180" /> Back to Builder
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{draft.noteType.toUpperCase()}</Badge>
          <Badge variant={draft.status === "draft" ? "secondary" : draft.status === "finalized" ? "default" : "outline"}>
            {draft.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle data-testid="text-draft-patient">{draft.patientName}</CardTitle>
              <CardDescription>Visit: {draft.visitDate} | Created: {new Date(draft.createdAt).toLocaleString()}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatusMutation.mutate("pending_review")}
                disabled={updateStatusMutation.isPending}
                data-testid="button-mark-pending"
              >
                <Eye className="h-4 w-4 mr-1" /> Send for Review
              </Button>
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate("finalized")}
                disabled={updateStatusMutation.isPending}
                data-testid="button-finalize"
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Finalize
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {draft.content.subjective && (
            <NoteSection title="Subjective" content={draft.content.subjective} icon={<ClipboardList className="h-4 w-4" />} testId="section-subjective" />
          )}
          {draft.content.objective && (
            <NoteSection title="Objective" content={draft.content.objective} icon={<Activity className="h-4 w-4" />} testId="section-objective" />
          )}
          {draft.content.assessment && (
            <NoteSection title="Assessment" content={draft.content.assessment} icon={<Stethoscope className="h-4 w-4" />} testId="section-assessment" />
          )}
          {draft.content.plan && (
            <NoteSection title="Plan" content={draft.content.plan} icon={<FileText className="h-4 w-4" />} testId="section-plan" />
          )}

          {draft.sources.voiceTranscription && draft.sources.transcriptText && (
            <>
              <Separator />
              <div data-testid="section-voice-transcript">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2"><Mic className="h-4 w-4 text-primary" />Voice Note Transcript</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{draft.sources.transcriptText}</p>
              </div>
            </>
          )}

          {draft.suggestedCodes.length > 0 && (
            <>
              <Separator />
              <div data-testid="section-codes">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3"><Code className="h-4 w-4 text-primary" />Suggested Codes</h4>
                <div className="space-y-2">
                  {draft.suggestedCodes.map((code, i) => (
                    <div key={i} className="flex items-start justify-between p-3 rounded-lg border" data-testid={`code-suggestion-${i}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{code.type}</Badge>
                          <span className="font-mono text-sm font-medium">{code.code}</span>
                          <Badge variant={code.confidence === "high" ? "default" : code.confidence === "medium" ? "secondary" : "outline"} className="text-xs">
                            {code.confidence}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{code.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{code.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <Shield className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              {draft.disclaimer}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

function NoteSection({ title, content, icon, testId }: { title: string; content: string; icon: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId}>
      <h4 className="text-sm font-medium flex items-center gap-2 mb-2">{icon}{title}</h4>
      <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border">{content}</div>
    </div>
  );
}

function DraftQueue({ drafts, isLoading }: { drafts: DraftNote[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [selectedDraft, setSelectedDraft] = useState<DraftNote | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `${API_BASE}/drafts/${id}/status`, {
        status,
        clinicianId: "current-clinician",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_BASE, "drafts"] });
      queryClient.invalidateQueries({ queryKey: [API_BASE, "stats"] });
      toast({ title: "Status Updated" });
    },
  });

  if (selectedDraft) {
    return <NoteReviewPanel draft={selectedDraft} onBack={() => setSelectedDraft(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drafts.length) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Draft Notes</h3>
          <p className="text-muted-foreground">Generate your first draft note using the Smart Note Builder.</p>
        </CardContent>
      </Card>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    pending_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    reviewed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    finalized: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <div className="space-y-3" data-testid="draft-queue">
      {drafts.map(draft => (
        <Card key={draft.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedDraft(draft)} data-testid={`draft-card-${draft.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium" data-testid={`draft-patient-${draft.id}`}>{draft.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {draft.noteType.toUpperCase()} &middot; {draft.visitDate} &middot; {draft.suggestedCodes.length} codes
                    {draft.sources.voiceTranscription && (
                      <span className="ml-1"><Mic className="h-3 w-3 inline" /> Voice</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[draft.status] || ""}`}>
                  {draft.status.replace("_", " ")}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GovernancePanel({ governance }: { governance?: GovernanceCheck }) {
  if (!governance) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="governance-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {governance.approved ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
            Data Governance Status
          </CardTitle>
          <CardDescription>{governance.details}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GovernanceItem label="Integration Status" value={governance.integrationStatus} ok={governance.integrationStatus === "approved"} testId="gov-integration" />
            <GovernanceItem label="BAA In Place" value={governance.baaInPlace ? "Yes" : "No"} ok={governance.baaInPlace} testId="gov-baa" />
            <GovernanceItem label="Data Minimization" value={governance.dataMinimization ? "Enforced" : "Not Enforced"} ok={governance.dataMinimization} testId="gov-minimization" />
            <GovernanceItem label="Encryption" value={governance.encryptionVerified ? "Verified" : "Not Verified"} ok={governance.encryptionVerified} testId="gov-encryption" />
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Compliance Frameworks</h4>
            <div className="flex flex-wrap gap-2">
              {governance.complianceFrameworks.map(fw => (
                <Badge key={fw} variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {fw}
                </Badge>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Last checked: {new Date(governance.checkedAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Data Flow Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">No PHI Storage by AI Provider</p>
                <p className="text-xs text-muted-foreground">Patient data sent to OpenAI for note generation is processed in real-time and not stored by the AI provider per BAA terms</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">TLS 1.3 Encryption In Transit</p>
                <p className="text-xs text-muted-foreground">All data transmitted to OpenAI is encrypted via TLS 1.3</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Data Minimization Enforced</p>
                <p className="text-xs text-muted-foreground">Only clinically relevant data fields are sent for AI processing; PII is limited to what is necessary for accurate documentation</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">HIPAA Audit Logging</p>
                <p className="text-xs text-muted-foreground">All AI documentation operations are logged with clinician ID, patient ID, action type, and timestamp for audit trail compliance</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GovernanceItem({ label, value, ok, testId }: { label: string; value: string; ok: boolean; testId: string }) {
  return (
    <div className="p-3 rounded-lg border" data-testid={testId}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1">
        {ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
        <span className="text-sm font-medium capitalize">{value}</span>
      </div>
    </div>
  );
}

function DraftQualityChecklist({
  hasPatient,
  hasChiefComplaint,
  hasVitals,
  hasConditions,
  hasMeds,
  hasLabs,
  hasAssessment,
  hasVoice,
  noteType,
}: {
  hasPatient: boolean;
  hasChiefComplaint: boolean;
  hasVitals: boolean;
  hasConditions: boolean;
  hasMeds: boolean;
  hasLabs: boolean;
  hasAssessment: boolean;
  hasVoice: boolean;
  noteType: string;
}) {
  const checks = [
    { label: "Patient name", required: true, met: hasPatient },
    { label: "Chief complaint", required: true, met: hasChiefComplaint },
    { label: "Vital signs", required: noteType === "soap" || noteType === "progress", met: hasVitals },
    { label: "Conditions/Diagnoses", required: false, met: hasConditions },
    { label: "Medications list", required: false, met: hasMeds },
    { label: "Lab results", required: false, met: hasLabs },
    { label: "Assessment notes", required: noteType === "soap", met: hasAssessment },
    { label: "Voice note", required: false, met: hasVoice },
  ];

  const requiredMet = checks.filter(c => c.required && c.met).length;
  const requiredTotal = checks.filter(c => c.required).length;
  const optionalMet = checks.filter(c => !c.required && c.met).length;
  const totalMet = checks.filter(c => c.met).length;
  const quality = totalMet >= 6 ? "Excellent" : totalMet >= 4 ? "Good" : totalMet >= 2 ? "Basic" : "Incomplete";
  const qualityColor = totalMet >= 6 ? "text-green-600" : totalMet >= 4 ? "text-blue-600" : totalMet >= 2 ? "text-amber-600" : "text-red-600";
  const progressPercent = Math.round((totalMet / checks.length) * 100);

  return (
    <div className="p-3 rounded-lg border space-y-2" data-testid="quality-checklist">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase">Draft Quality</h4>
        <span className={`text-xs font-medium ${qualityColor}`}>{quality}</span>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
      <div className="space-y-1">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {check.met ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : check.required ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={check.met ? "" : check.required ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
              {check.label}
              {check.required && " *"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {requiredMet}/{requiredTotal} required + {optionalMet} optional data sources
      </p>
    </div>
  );
}
