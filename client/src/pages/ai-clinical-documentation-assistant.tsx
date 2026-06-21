import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mic,
  MicOff,
  FileText,
  Code,
  ClipboardCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
  Stethoscope,
  Activity,
  FileCheck,
  Send,
  Clock,
  User,
  Building2,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CodeSuggestion {
  code: string;
  type: "ICD-10" | "CPT";
  description: string;
  confidence: number;
  rationale: string;
}

interface StructuredNote {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  reviewOfSystems: string[];
  physicalExamFindings: string[];
  assessment: string;
  plan: string[];
  medications: { name: string; dosage: string; frequency: string; route: string }[];
  allergies: string[];
}

interface TranscriptionResult {
  text: string;
  structuredNotes: StructuredNote;
  confidence: number;
}

interface ClinicalNoteResponse {
  noteId: string;
  draftNote: string;
  structuredNote: StructuredNote;
  suggestedCodes: CodeSuggestion[];
  generatedAt: string;
  disclaimer: string;
}

interface PriorAuthResponse {
  requestId: string;
  status: string;
  authorizationLetter: string;
  clinicalSummary: string;
  medicalNecessityStatement: string;
  supportingEvidence: string[];
  estimatedProcessingDays: number;
  generatedAt: string;
  disclaimer: string;
}

function TranscriptionTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [manualText, setManualText] = useState("");
  const { toast } = useToast();

  const transcribeMutation = useMutation({
    mutationFn: async (audioBase64: string) => {
      const response = await apiRequest("POST", "/api/ai-clinical-documentation/transcribe", {
        audioBase64,
        mimeType: "audio/webm",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTranscriptionResult(data);
      toast({ title: "Transcription Complete", description: "Audio has been converted to structured notes." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to transcribe audio.", variant: "destructive" });
    },
  });

  const handleSampleTranscription = () => {
    setTranscriptionResult({
      text: "Patient presents with complaints of persistent headache for the past 3 days. Pain is described as throbbing, located in the frontal region, rated 6/10. Patient reports mild nausea but no vomiting. No visual disturbances or fever noted. Patient has been taking over-the-counter ibuprofen with minimal relief. Blood pressure today is 128/82, heart rate 76, temperature 98.6F.",
      structuredNotes: {
        chiefComplaint: "Persistent headache for 3 days",
        historyOfPresentIllness: "Patient presents with throbbing frontal headache, 6/10 severity, associated with mild nausea. No vomiting, visual changes, or fever. Minimal relief with OTC ibuprofen.",
        reviewOfSystems: [
          "Neurological: Headache present, no visual disturbances, no syncope",
          "GI: Mild nausea, no vomiting, appetite normal",
          "Constitutional: No fever, no weight changes",
        ],
        physicalExamFindings: [
          "Alert and oriented x3",
          "HEENT: No focal tenderness, pupils equal and reactive",
          "Neck: Supple, no meningismus",
          "Neurological: No focal deficits, cranial nerves intact",
        ],
        assessment: "Tension-type headache vs. migraine without aura",
        plan: [
          "Continue OTC analgesics as needed",
          "Increase hydration",
          "Consider migraine prophylaxis if frequency increases",
          "Return if symptoms worsen or new symptoms develop",
        ],
        medications: [
          { name: "Ibuprofen", dosage: "400mg", frequency: "every 6 hours as needed", route: "oral" },
        ],
        allergies: ["NKDA (No Known Drug Allergies)"],
      },
      confidence: 0.92,
    });
    toast({ title: "Preview Mode", description: "Sample transcription loaded for preview." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Audio Transcription
          </CardTitle>
          <CardDescription>
            Record or upload patient-provider conversations to generate structured clinical notes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              onClick={() => {
                setIsRecording(!isRecording);
                if (isRecording) {
                  handleSampleTranscription();
                }
              }}
              className="flex-1"
              data-testid="button-record"
            >
              {isRecording ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSampleTranscription} data-testid="button-sample-transcription">
              <Sparkles className="w-4 h-4 mr-2" />
              Load Sample
            </Button>
          </div>

          {isRecording && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording in progress...</span>
              <span className="text-xs text-muted-foreground">Speak clearly into your microphone</span>
            </div>
          )}

          <div>
            <Label>Or paste conversation text:</Label>
            <Textarea
              placeholder="Paste patient-provider conversation text here..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {transcriptionResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Transcription Result
              </CardTitle>
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {(transcriptionResult.confidence * 100).toFixed(0)}% Confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Raw Transcription</Label>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(transcriptionResult.text)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                {transcriptionResult.text}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">Structured Clinical Notes</Label>
              <Accordion type="multiple" className="mt-3">
                <AccordionItem value="chief-complaint">
                  <AccordionTrigger>Chief Complaint</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">{transcriptionResult.structuredNotes.chiefComplaint}</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="hpi">
                  <AccordionTrigger>History of Present Illness</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">{transcriptionResult.structuredNotes.historyOfPresentIllness}</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="ros">
                  <AccordionTrigger>Review of Systems</AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-sm space-y-1">
                      {transcriptionResult.structuredNotes.reviewOfSystems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="exam">
                  <AccordionTrigger>Physical Exam Findings</AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-sm space-y-1">
                      {transcriptionResult.structuredNotes.physicalExamFindings.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Stethoscope className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="assessment">
                  <AccordionTrigger>Assessment</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">{transcriptionResult.structuredNotes.assessment}</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="plan">
                  <AccordionTrigger>Plan</AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-sm space-y-1">
                      {transcriptionResult.structuredNotes.plan.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-medium text-primary">{i + 1}.</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CardContent>
          <CardFooter>
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Draft Only</AlertTitle>
              <AlertDescription className="text-xs">
                This AI-generated transcription is for documentation assistance only. All content must be reviewed and verified by a licensed healthcare provider.
              </AlertDescription>
            </Alert>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function NoteGenerationTab() {
  const [patientId, setPatientId] = useState("");
  const [visitType, setVisitType] = useState<string>("follow_up");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientSummary, setPatientSummary] = useState("");
  const [caseReviewNotes, setCaseReviewNotes] = useState("");
  const [noteResult, setNoteResult] = useState<ClinicalNoteResponse | null>(null);
  const { toast } = useToast();

  const generateNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-clinical-documentation/generate-note", {
        patientId,
        visitType,
        chiefComplaint,
        patientSummary,
        caseReviewNotes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setNoteResult(data);
      toast({ title: "Note Generated", description: "Clinical note draft has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate note.", variant: "destructive" });
    },
  });

  const handleSampleNote = () => {
    setPatientId("PT-2024-001");
    setVisitType("follow_up");
    setChiefComplaint("Follow-up for Type 2 Diabetes management");
    setPatientSummary("58-year-old male with Type 2 Diabetes diagnosed 3 years ago. Currently on Metformin 1000mg BID. Last A1C was 7.2% (3 months ago). Has been compliant with medication and diet modifications. Reports occasional hypoglycemic episodes in the morning.");
    setCaseReviewNotes("Recent case review noted good glycemic control but recommended monitoring for early nephropathy given duration of diabetes.");
    
    setNoteResult({
      noteId: "note-sample-001",
      draftNote: `CLINICAL NOTE - DRAFT

Patient: PT-2024-001
Date: ${new Date().toLocaleDateString()}
Visit Type: Follow-up

CHIEF COMPLAINT:
Follow-up for Type 2 Diabetes management

HISTORY OF PRESENT ILLNESS:
58-year-old male with Type 2 Diabetes mellitus, diagnosed 3 years ago, presents for routine follow-up. Patient has been compliant with Metformin 1000mg twice daily and reports good dietary adherence. He notes occasional morning hypoglycemic episodes, occurring approximately 2-3 times per week, characterized by shakiness and sweating, typically resolving with breakfast intake. No episodes of severe hypoglycemia requiring assistance. Patient denies polyuria, polydipsia, or significant weight changes.

CURRENT MEDICATIONS:
- Metformin 1000mg PO BID

REVIEW OF SYSTEMS:
- Constitutional: No weight loss, fatigue, or fever
- Cardiovascular: No chest pain, palpitations, or edema
- Endocrine: Occasional hypoglycemic episodes as noted above
- Neurological: No numbness, tingling, or vision changes

PHYSICAL EXAMINATION:
- Vital Signs: BP 128/78, HR 72, Temp 98.4F
- General: Well-appearing, in no acute distress
- Cardiovascular: Regular rate and rhythm, no murmurs
- Extremities: No edema, feet exam normal with intact sensation

ASSESSMENT:
1. Type 2 Diabetes Mellitus - overall good control, A1C 7.2%
2. Recurrent mild hypoglycemia - likely related to medication timing

PLAN:
1. Continue Metformin 1000mg BID
2. Patient education on hypoglycemia management
3. Consider bedtime snack to prevent morning hypoglycemia
4. Order fasting labs: A1C, comprehensive metabolic panel, lipid panel, microalbumin/creatinine ratio
5. Follow up in 3 months

---
DRAFT - FOR PHYSICIAN REVIEW ONLY`,
      structuredNote: {
        chiefComplaint: "Follow-up for Type 2 Diabetes management",
        historyOfPresentIllness: "58-year-old male with Type 2 Diabetes mellitus, diagnosed 3 years ago, presents for routine follow-up. Good compliance with Metformin 1000mg BID. Occasional morning hypoglycemic episodes.",
        reviewOfSystems: [
          "Constitutional: No weight loss, fatigue, or fever",
          "Cardiovascular: No chest pain, palpitations, or edema",
          "Endocrine: Occasional hypoglycemic episodes",
          "Neurological: No numbness, tingling, or vision changes",
        ],
        physicalExamFindings: [
          "Vital Signs: BP 128/78, HR 72, Temp 98.4F",
          "General: Well-appearing, no acute distress",
          "Cardiovascular: Regular rate and rhythm",
          "Extremities: No edema, feet exam normal",
        ],
        assessment: "Type 2 Diabetes Mellitus with good control; Recurrent mild hypoglycemia",
        plan: [
          "Continue Metformin 1000mg BID",
          "Hypoglycemia management education",
          "Consider bedtime snack",
          "Order labs: A1C, CMP, lipids, urine microalbumin",
          "Follow up in 3 months",
        ],
        medications: [
          { name: "Metformin", dosage: "1000mg", frequency: "twice daily", route: "oral" },
        ],
        allergies: [],
      },
      suggestedCodes: [
        { code: "E11.65", type: "ICD-10", description: "Type 2 diabetes mellitus with hyperglycemia", confidence: 0.92, rationale: "Primary diagnosis based on documented diabetes management visit" },
        { code: "E16.2", type: "ICD-10", description: "Hypoglycemia, unspecified", confidence: 0.85, rationale: "Patient reports recurrent hypoglycemic episodes" },
        { code: "99214", type: "CPT", description: "Office visit, established patient, moderate complexity", confidence: 0.88, rationale: "Follow-up visit with chronic disease management and treatment adjustment" },
        { code: "83036", type: "CPT", description: "Hemoglobin A1C", confidence: 0.95, rationale: "Ordered for diabetes monitoring" },
        { code: "80053", type: "CPT", description: "Comprehensive metabolic panel", confidence: 0.90, rationale: "Ordered for metabolic monitoring" },
      ],
      generatedAt: new Date().toISOString(),
      disclaimer: "DRAFT - FOR PHYSICIAN REVIEW ONLY. This AI-generated note is for documentation assistance only.",
    });
    toast({ title: "Sample Loaded", description: "Sample clinical note generated for preview." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Generate Clinical Note
          </CardTitle>
          <CardDescription>
            Create draft clinical notes based on patient information and case reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="patientId">Patient ID</Label>
              <Input
                id="patientId"
                placeholder="e.g., PT-2024-001"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="visitType">Visit Type</Label>
              <Select value={visitType} onValueChange={setVisitType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">Initial Visit</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="urgent">Urgent Visit</SelectItem>
                  <SelectItem value="telehealth">Telehealth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="chiefComplaint">Chief Complaint</Label>
            <Input
              id="chiefComplaint"
              placeholder="Primary reason for visit"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="patientSummary">Patient Summary</Label>
            <Textarea
              id="patientSummary"
              placeholder="Brief patient history and current status..."
              value={patientSummary}
              onChange={(e) => setPatientSummary(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="caseReviewNotes">Case Review Notes (Optional)</Label>
            <Textarea
              id="caseReviewNotes"
              placeholder="Any notes from prior case reviews or AI analysis..."
              value={caseReviewNotes}
              onChange={(e) => setCaseReviewNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => generateNoteMutation.mutate()} 
              disabled={generateNoteMutation.isPending || !patientId || !chiefComplaint}
              data-testid="button-generate-note"
            >
              {generateNoteMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Note
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSampleNote} data-testid="button-sample-note">
              Load Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {noteResult && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  Draft Clinical Note
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(noteResult.draftNote)}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
              <CardDescription>
                Note ID: {noteResult.noteId} | Generated: {new Date(noteResult.generatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <pre className="whitespace-pre-wrap text-sm font-mono p-4 bg-muted/50 rounded-lg">
                  {noteResult.draftNote}
                </pre>
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">{noteResult.disclaimer}</AlertDescription>
              </Alert>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-600" />
                Suggested Codes
              </CardTitle>
              <CardDescription>
                AI-suggested ICD-10 and CPT codes based on clinical documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {noteResult.suggestedCodes.map((code, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Badge variant={code.type === "ICD-10" ? "default" : "secondary"}>
                      {code.type}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold">{code.code}</code>
                        <span className="text-sm">{code.description}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{code.rationale}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Progress value={code.confidence * 100} className="w-20 h-2" />
                      <span className="text-xs text-muted-foreground">{(code.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Code suggestions require verification by a certified medical coder or treating physician.
              </p>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}

function CodeSuggestionTab() {
  const [clinicalText, setClinicalText] = useState("");
  const [patientContext, setPatientContext] = useState("");
  const [codes, setCodes] = useState<CodeSuggestion[]>([]);
  const { toast } = useToast();

  const suggestCodesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-clinical-documentation/suggest-codes", {
        clinicalText,
        patientContext,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCodes(data.codes || []);
      toast({ title: "Codes Suggested", description: `${data.codes?.length || 0} codes identified.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suggest codes.", variant: "destructive" });
    },
  });

  const handleSampleCodes = () => {
    setClinicalText("Patient presents with acute exacerbation of COPD, severe dyspnea at rest, productive cough with yellow sputum, and low-grade fever. Chest X-ray shows hyperinflation without infiltrates. O2 saturation 88% on room air. Started on nebulized bronchodilators, systemic corticosteroids, and broad-spectrum antibiotics.");
    setPatientContext("68-year-old female with 40 pack-year smoking history, diagnosed COPD 5 years ago, 2 prior hospitalizations for COPD exacerbations in past year.");
    setCodes([
      { code: "J44.1", type: "ICD-10", description: "Chronic obstructive pulmonary disease with acute exacerbation", confidence: 0.95, rationale: "Primary diagnosis clearly documented as COPD exacerbation" },
      { code: "R06.02", type: "ICD-10", description: "Shortness of breath", confidence: 0.88, rationale: "Severe dyspnea documented" },
      { code: "R09.3", type: "ICD-10", description: "Abnormal sputum", confidence: 0.82, rationale: "Productive cough with yellow sputum noted" },
      { code: "F17.210", type: "ICD-10", description: "Nicotine dependence, cigarettes, uncomplicated", confidence: 0.80, rationale: "40 pack-year smoking history documented" },
      { code: "99223", type: "CPT", description: "Initial hospital care, high complexity", confidence: 0.85, rationale: "Acute exacerbation requiring hospitalization with multiple treatment modalities" },
      { code: "94640", type: "CPT", description: "Nebulizer treatment", confidence: 0.92, rationale: "Nebulized bronchodilator treatment documented" },
      { code: "71046", type: "CPT", description: "Chest X-ray, 2 views", confidence: 0.90, rationale: "Chest X-ray performed and interpreted" },
    ]);
    toast({ title: "Sample Loaded", description: "Sample codes generated for preview." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Code Suggestion Engine
          </CardTitle>
          <CardDescription>
            Get ICD-10 and CPT code suggestions based on clinical documentation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="clinicalText">Clinical Documentation</Label>
            <Textarea
              id="clinicalText"
              placeholder="Paste or type clinical documentation text..."
              value={clinicalText}
              onChange={(e) => setClinicalText(e.target.value)}
              rows={5}
            />
          </div>

          <div>
            <Label htmlFor="patientContext">Patient Context (Optional)</Label>
            <Textarea
              id="patientContext"
              placeholder="Relevant patient history or context..."
              value={patientContext}
              onChange={(e) => setPatientContext(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => suggestCodesMutation.mutate()}
              disabled={suggestCodesMutation.isPending || !clinicalText}
              data-testid="button-suggest-codes"
            >
              {suggestCodesMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Suggest Codes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSampleCodes} data-testid="button-sample-codes">
              Load Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {codes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Codes</CardTitle>
            <CardDescription>
              {codes.length} codes identified based on clinical documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {codes.map((code, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg hover-elevate">
                  <Badge variant={code.type === "ICD-10" ? "default" : "secondary"} className="mt-0.5">
                    {code.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-primary">{code.code}</code>
                      <span className="text-sm">{code.description}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{code.rationale}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Progress value={code.confidence * 100} className="w-16 h-2" />
                    <span className="text-xs text-muted-foreground">{(code.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Code suggestions are for reference only. Final code selection must be verified by a certified medical coder or the treating physician.
              </AlertDescription>
            </Alert>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function PriorAuthTab() {
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    payerId: "",
    payerName: "",
    memberId: "",
    groupNumber: "",
    serviceDescription: "",
    cptCodes: "",
    icd10Codes: "",
    clinicalJustification: "",
  });
  const [authResult, setAuthResult] = useState<PriorAuthResponse | null>(null);
  const { toast } = useToast();

  const generateAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-clinical-documentation/prior-authorization", {
        patientId: formData.patientId,
        patientName: formData.patientName,
        insuranceInfo: {
          payerId: formData.payerId,
          payerName: formData.payerName,
          memberId: formData.memberId,
          groupNumber: formData.groupNumber,
        },
        requestedService: {
          description: formData.serviceDescription,
          cptCodes: formData.cptCodes.split(",").map((c) => c.trim()),
          icd10Codes: formData.icd10Codes.split(",").map((c) => c.trim()),
        },
        clinicalJustification: formData.clinicalJustification,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAuthResult(data);
      toast({ title: "Prior Auth Generated", description: "Authorization request draft has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate prior authorization.", variant: "destructive" });
    },
  });

  const handleSampleAuth = () => {
    setFormData({
      patientId: "PT-2024-001",
      patientName: "John Smith",
      payerId: "BCBS-001",
      payerName: "Blue Cross Blue Shield",
      memberId: "XYZ123456789",
      groupNumber: "GRP-54321",
      serviceDescription: "MRI of lumbar spine without contrast",
      cptCodes: "72148",
      icd10Codes: "M54.5, M51.16",
      clinicalJustification: "Patient presents with persistent lower back pain radiating to left leg for 6 weeks, unresponsive to conservative management including physical therapy and NSAIDs. Neurological exam reveals diminished left ankle reflex and positive straight leg raise test. MRI is indicated to evaluate for lumbar disc herniation or other spinal pathology requiring surgical intervention.",
    });
    
    setAuthResult({
      requestId: "pa-sample-001",
      status: "draft",
      authorizationLetter: `PRIOR AUTHORIZATION REQUEST

Date: ${new Date().toLocaleDateString()}
Request ID: pa-sample-001

TO: Blue Cross Blue Shield
    Prior Authorization Department

RE: Prior Authorization Request for MRI of Lumbar Spine

Patient: John Smith
Member ID: XYZ123456789
Group Number: GRP-54321
Date of Birth: [DOB]

Dear Medical Director,

I am writing to request prior authorization for an MRI of the lumbar spine without contrast (CPT: 72148) for our patient, John Smith.

CLINICAL SUMMARY:
The patient is a male presenting with persistent lower back pain radiating to the left lower extremity for approximately 6 weeks. Despite conservative management including physical therapy sessions and NSAID therapy, the patient has not experienced significant improvement.

OBJECTIVE FINDINGS:
- Diminished left ankle reflex
- Positive straight leg raise test on the left
- Paraspinal muscle tenderness at L4-L5 level
- No motor weakness detected

DIAGNOSIS:
- Low back pain (M54.5)
- Lumbar disc degeneration with radiculopathy, lumbar region (M51.16)

MEDICAL NECESSITY:
An MRI of the lumbar spine is medically necessary to:
1. Evaluate for lumbar disc herniation causing the documented radiculopathy
2. Assess for other spinal pathology that may require surgical intervention
3. Guide further treatment planning given failure of conservative management

Conservative treatments attempted:
- Physical therapy (8 sessions) - minimal improvement
- NSAID therapy (Naproxen 500mg BID x 4 weeks) - inadequate pain relief
- Activity modification - ongoing

The requested imaging study is essential for appropriate diagnosis and treatment planning. Without this imaging, the patient's care cannot progress appropriately, potentially leading to delayed treatment and prolonged disability.

Please contact our office at [Phone] if additional information is required.

Sincerely,

[Physician Signature Required]
[Physician Name, MD]
[Practice Name]
[NPI Number]

---
DRAFT - REQUIRES PHYSICIAN REVIEW AND SIGNATURE BEFORE SUBMISSION`,
      clinicalSummary: "Patient with 6 weeks of lower back pain radiating to left leg, unresponsive to conservative treatment. Neurological exam shows diminished ankle reflex and positive straight leg raise.",
      medicalNecessityStatement: "MRI of lumbar spine is medically necessary to evaluate for disc herniation or other spinal pathology causing documented radiculopathy, given failure of 6 weeks of conservative management including physical therapy and NSAIDs.",
      supportingEvidence: [
        "Failed conservative management (6 weeks physical therapy, NSAIDs)",
        "Positive neurological findings (diminished reflex, positive SLR)",
        "Radicular symptoms requiring imaging for surgical planning",
      ],
      estimatedProcessingDays: 3,
      generatedAt: new Date().toISOString(),
      disclaimer: "DRAFT - FOR REVIEW ONLY. This AI-generated prior authorization request requires physician review and verification before submission.",
    });
    toast({ title: "Sample Loaded", description: "Sample prior authorization generated for preview." });
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Prior Authorization Request Generator
          </CardTitle>
          <CardDescription>
            Automate prior authorization requests with AI-generated clinical justifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <User className="w-4 h-4" /> Patient ID
              </Label>
              <Input
                placeholder="e.g., PT-2024-001"
                value={formData.patientId}
                onChange={(e) => updateField("patientId", e.target.value)}
              />
            </div>
            <div>
              <Label>Patient Name</Label>
              <Input
                placeholder="Full name"
                value={formData.patientName}
                onChange={(e) => updateField("patientName", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <Building2 className="w-4 h-4" /> Payer Name
              </Label>
              <Input
                placeholder="e.g., Blue Cross Blue Shield"
                value={formData.payerName}
                onChange={(e) => updateField("payerName", e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <CreditCard className="w-4 h-4" /> Member ID
              </Label>
              <Input
                placeholder="Insurance member ID"
                value={formData.memberId}
                onChange={(e) => updateField("memberId", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label>Requested Service Description</Label>
            <Input
              placeholder="e.g., MRI of lumbar spine without contrast"
              value={formData.serviceDescription}
              onChange={(e) => updateField("serviceDescription", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>CPT Codes (comma-separated)</Label>
              <Input
                placeholder="e.g., 72148, 72149"
                value={formData.cptCodes}
                onChange={(e) => updateField("cptCodes", e.target.value)}
              />
            </div>
            <div>
              <Label>ICD-10 Codes (comma-separated)</Label>
              <Input
                placeholder="e.g., M54.5, M51.16"
                value={formData.icd10Codes}
                onChange={(e) => updateField("icd10Codes", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Clinical Justification</Label>
            <Textarea
              placeholder="Describe the medical necessity and clinical rationale..."
              value={formData.clinicalJustification}
              onChange={(e) => updateField("clinicalJustification", e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => generateAuthMutation.mutate()}
              disabled={generateAuthMutation.isPending || !formData.patientId || !formData.patientName}
              data-testid="button-generate-auth"
            >
              {generateAuthMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Prior Auth
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSampleAuth} data-testid="button-sample-auth">
              Load Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {authResult && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  Prior Authorization Request
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={authResult.status === "draft" ? "secondary" : "default"}>
                    {authResult.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(authResult.authorizationLetter)}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <CardDescription className="flex items-center gap-4">
                <span>Request ID: {authResult.requestId}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Est. {authResult.estimatedProcessingDays} days processing
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <pre className="whitespace-pre-wrap text-sm font-mono p-4 bg-muted/50 rounded-lg">
                  {authResult.authorizationLetter}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Medical Necessity Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{authResult.medicalNecessityStatement}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supporting Evidence</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {authResult.supportingEvidence.map((evidence, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {evidence}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Draft Only</AlertTitle>
            <AlertDescription className="text-xs">
              {authResult.disclaimer}
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}

export default function AIClinicalDocumentationAssistant() {
  const { data: metadata } = useQuery({
    queryKey: ["/api/ai-clinical-documentation/metadata"],
  });

  return (
    <div className="min-h-screen bg-background" data-testid="ai-clinical-documentation">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            AI Clinical Documentation Assistant
          </h1>
          <p className="text-muted-foreground">
            Streamline clinical documentation with AI-powered transcription, note generation, coding, and prior authorization
          </p>
          <Alert className="bg-primary/5 border-primary/20">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <AlertDescription className="text-xs">
              <strong>NO-CDS Compliant:</strong> All AI-generated content is for documentation assistance only and requires physician verification. This tool does not provide clinical decision support.
            </AlertDescription>
          </Alert>
        </header>

        <Tabs defaultValue="transcription" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transcription" data-testid="tab-transcription">
              <Mic className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Transcribe</span>
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">
              <FileText className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="codes" data-testid="tab-codes">
              <Code className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Codes</span>
            </TabsTrigger>
            <TabsTrigger value="prior-auth" data-testid="tab-prior-auth">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Prior Auth</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcription">
            <TranscriptionTab />
          </TabsContent>

          <TabsContent value="notes">
            <NoteGenerationTab />
          </TabsContent>

          <TabsContent value="codes">
            <CodeSuggestionTab />
          </TabsContent>

          <TabsContent value="prior-auth">
            <PriorAuthTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
