import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Code, 
  Sparkles, 
  ClipboardList, 
  AlertTriangle, 
  Check, 
  Clock,
  RefreshCw,
  Save,
  FlaskConical,
  Stethoscope
} from "lucide-react";

interface CodeSuggestion {
  type: "ICD-10" | "CPT" | "HCPCS";
  code: string;
  description: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
  relatedDocumentation?: string;
}

interface GeneratedNote {
  id: string;
  patientId: string;
  visitDate: string;
  noteType: "soap" | "progress" | "discharge" | "procedure" | "consultation";
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    fullNote?: string;
  };
  suggestedCodes: CodeSuggestion[];
  generatedAt: string;
  status: "draft" | "reviewed" | "finalized";
  disclaimer: string;
}

export default function AIClinicalDocumentation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedNote, setSelectedNote] = useState<GeneratedNote | null>(null);
  
  const [visitForm, setVisitForm] = useState({
    patientId: "",
    patientName: "",
    visitDate: new Date().toISOString().split("T")[0],
    visitType: "Follow-up",
    chiefComplaint: "",
    symptoms: "",
    bloodPressure: "",
    heartRate: "",
    temperature: "",
    diagnoses: "",
    assessmentPlan: ""
  });
  
  const [noteType, setNoteType] = useState<"soap" | "progress" | "discharge" | "procedure" | "consultation">("soap");
  
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    success: boolean;
    stats: {
      totalNotes: number;
      draftNotes: number;
      reviewedNotes: number;
      finalizedNotes: number;
      notesByType: Record<string, number>;
      recentNotes: GeneratedNote[];
    };
    commonCodes: {
      icd10: CodeSuggestion[];
      cpt: CodeSuggestion[];
    };
    disclaimer: string;
  }>({
    queryKey: ["/api/clinical-documentation/dashboard"]
  });
  
  const { data: notesData, isLoading: notesLoading } = useQuery<{
    success: boolean;
    notes: GeneratedNote[];
    count: number;
    disclaimer: string;
  }>({
    queryKey: ["/api/clinical-documentation/notes"]
  });
  
  const generateNoteMutation = useMutation({
    mutationFn: async (data: { visitData: any; noteType: string }) => {
      const response = await apiRequest("POST", "/api/clinical-documentation/notes/generate", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Note Generated",
        description: "AI has generated a clinical note draft for your review."
      });
      setSelectedNote(data.note);
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/dashboard"] });
      setActiveTab("review");
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate clinical note. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ noteId, status }: { noteId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/clinical-documentation/notes/${noteId}/status`, { status, userId: "clinician-001" });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Status Updated",
        description: `Note status changed to ${data.note.status}.`
      });
      setSelectedNote(data.note);
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/dashboard"] });
    }
  });
  
  const handleGenerateNote = () => {
    const visitData = {
      patientId: visitForm.patientId || `patient-${Date.now()}`,
      patientName: visitForm.patientName || "Patient",
      visitDate: visitForm.visitDate,
      visitType: visitForm.visitType,
      chiefComplaint: visitForm.chiefComplaint,
      symptoms: visitForm.symptoms ? visitForm.symptoms.split(",").map(s => s.trim()) : undefined,
      vitalSigns: {
        bloodPressure: visitForm.bloodPressure || undefined,
        heartRate: visitForm.heartRate ? parseInt(visitForm.heartRate) : undefined,
        temperature: visitForm.temperature ? parseFloat(visitForm.temperature) : undefined
      },
      diagnoses: visitForm.diagnoses ? visitForm.diagnoses.split(",").map(d => d.trim()) : undefined,
      assessmentPlan: visitForm.assessmentPlan || undefined
    };
    
    generateNoteMutation.mutate({ visitData, noteType });
  };
  
  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "finalized": return "default";
      case "reviewed": return "secondary";
      case "draft": return "outline";
      default: return "outline";
    }
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Clinical Documentation
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-assisted clinical note generation and ICD/CPT code suggestions
          </p>
        </div>
      </div>
      
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Documentation Assistance Only</AlertTitle>
        <AlertDescription>
          AI-generated content requires clinician review and validation before use. 
          All code suggestions require professional verification before billing.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-notes">
              {dashboardLoading ? "..." : dashboardData?.stats?.totalNotes || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-draft-notes">
              {dashboardLoading ? "..." : dashboardData?.stats?.draftNotes || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Reviewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-reviewed-notes">
              {dashboardLoading ? "..." : dashboardData?.stats?.reviewedNotes || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Check className="h-4 w-4" />
              Finalized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-finalized-notes">
              {dashboardLoading ? "..." : dashboardData?.stats?.finalizedNotes || 0}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <FileText className="h-4 w-4 mr-2" />
            Generate Note
          </TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">
            <ClipboardList className="h-4 w-4 mr-2" />
            Review Notes
          </TabsTrigger>
          <TabsTrigger value="codes" data-testid="tab-codes">
            <Code className="h-4 w-4 mr-2" />
            Code Reference
          </TabsTrigger>
          <TabsTrigger value="lab-summary" data-testid="tab-lab-summary">
            <FlaskConical className="h-4 w-4 mr-2" />
            Lab Summary
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Visit Information
              </CardTitle>
              <CardDescription>
                Enter visit details to generate a clinical note
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input
                    id="patientName"
                    data-testid="input-patient-name"
                    placeholder="Enter patient name"
                    value={visitForm.patientName}
                    onChange={(e) => setVisitForm({ ...visitForm, patientName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input
                    id="patientId"
                    data-testid="input-patient-id"
                    placeholder="Enter patient ID (optional)"
                    value={visitForm.patientId}
                    onChange={(e) => setVisitForm({ ...visitForm, patientId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitDate">Visit Date</Label>
                  <Input
                    id="visitDate"
                    type="date"
                    data-testid="input-visit-date"
                    value={visitForm.visitDate}
                    onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitType">Visit Type</Label>
                  <Select
                    value={visitForm.visitType}
                    onValueChange={(value) => setVisitForm({ ...visitForm, visitType: value })}
                  >
                    <SelectTrigger data-testid="select-visit-type">
                      <SelectValue placeholder="Select visit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Patient">New Patient</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                      <SelectItem value="Annual Physical">Annual Physical</SelectItem>
                      <SelectItem value="Consultation">Consultation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
                <Textarea
                  id="chiefComplaint"
                  data-testid="input-chief-complaint"
                  placeholder="Describe the patient's main concern..."
                  value={visitForm.chiefComplaint}
                  onChange={(e) => setVisitForm({ ...visitForm, chiefComplaint: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms (comma-separated)</Label>
                <Input
                  id="symptoms"
                  data-testid="input-symptoms"
                  placeholder="e.g., headache, nausea, fatigue"
                  value={visitForm.symptoms}
                  onChange={(e) => setVisitForm({ ...visitForm, symptoms: e.target.value })}
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bloodPressure">Blood Pressure</Label>
                  <Input
                    id="bloodPressure"
                    data-testid="input-blood-pressure"
                    placeholder="e.g., 120/80"
                    value={visitForm.bloodPressure}
                    onChange={(e) => setVisitForm({ ...visitForm, bloodPressure: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
                  <Input
                    id="heartRate"
                    type="number"
                    data-testid="input-heart-rate"
                    placeholder="e.g., 72"
                    value={visitForm.heartRate}
                    onChange={(e) => setVisitForm({ ...visitForm, heartRate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (F)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    data-testid="input-temperature"
                    placeholder="e.g., 98.6"
                    value={visitForm.temperature}
                    onChange={(e) => setVisitForm({ ...visitForm, temperature: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="diagnoses">Known Diagnoses (comma-separated)</Label>
                <Input
                  id="diagnoses"
                  data-testid="input-diagnoses"
                  placeholder="e.g., Hypertension, Type 2 Diabetes"
                  value={visitForm.diagnoses}
                  onChange={(e) => setVisitForm({ ...visitForm, diagnoses: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assessmentPlan">Initial Assessment/Plan Notes</Label>
                <Textarea
                  id="assessmentPlan"
                  data-testid="input-assessment-plan"
                  placeholder="Optional notes about assessment or plan..."
                  value={visitForm.assessmentPlan}
                  onChange={(e) => setVisitForm({ ...visitForm, assessmentPlan: e.target.value })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Label>Note Type</Label>
                  <Select value={noteType} onValueChange={(v: any) => setNoteType(v)}>
                    <SelectTrigger className="w-48" data-testid="select-note-type">
                      <SelectValue placeholder="Select note type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soap">SOAP Note</SelectItem>
                      <SelectItem value="progress">Progress Note</SelectItem>
                      <SelectItem value="discharge">Discharge Summary</SelectItem>
                      <SelectItem value="procedure">Procedure Note</SelectItem>
                      <SelectItem value="consultation">Consultation Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  size="lg"
                  onClick={handleGenerateNote}
                  disabled={!visitForm.chiefComplaint || generateNoteMutation.isPending}
                  data-testid="button-generate-note"
                >
                  {generateNoteMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Clinical Note
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="review" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Generated Notes</CardTitle>
                <CardDescription>Select a note to review</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {notesLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading notes...</div>
                ) : notesData?.notes && notesData.notes.length > 0 ? (
                  notesData.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                        selectedNote?.id === note.id ? "border-primary bg-accent" : ""
                      }`}
                      onClick={() => setSelectedNote(note)}
                      data-testid={`note-item-${note.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{note.patientId}</span>
                        <Badge variant={getStatusBadgeVariant(note.status)}>
                          {note.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {note.noteType.toUpperCase()} - {note.visitDate}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No notes generated yet
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Note Content</CardTitle>
                <CardDescription>
                  {selectedNote ? `${selectedNote.noteType.toUpperCase()} Note - ${selectedNote.visitDate}` : "Select a note to view"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedNote ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant={getStatusBadgeVariant(selectedNote.status)}>
                        {selectedNote.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Generated: {new Date(selectedNote.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    
                    {selectedNote.content.subjective && (
                      <div className="space-y-1">
                        <Label className="font-semibold">Subjective</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                          {selectedNote.content.subjective}
                        </div>
                      </div>
                    )}
                    
                    {selectedNote.content.objective && (
                      <div className="space-y-1">
                        <Label className="font-semibold">Objective</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                          {selectedNote.content.objective}
                        </div>
                      </div>
                    )}
                    
                    {selectedNote.content.assessment && (
                      <div className="space-y-1">
                        <Label className="font-semibold">Assessment</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                          {selectedNote.content.assessment}
                        </div>
                      </div>
                    )}
                    
                    {selectedNote.content.plan && (
                      <div className="space-y-1">
                        <Label className="font-semibold">Plan</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                          {selectedNote.content.plan}
                        </div>
                      </div>
                    )}
                    
                    {selectedNote.content.fullNote && (
                      <div className="space-y-1">
                        <Label className="font-semibold">Full Note</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                          {selectedNote.content.fullNote}
                        </div>
                      </div>
                    )}
                    
                    {selectedNote.suggestedCodes.length > 0 && (
                      <div className="space-y-2">
                        <Label className="font-semibold">Suggested Codes</Label>
                        <div className="space-y-2">
                          {selectedNote.suggestedCodes.map((code, idx) => (
                            <div key={idx} className="p-3 border rounded-md">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge>{code.type}</Badge>
                                <span className="font-mono font-bold">{code.code}</span>
                                <Badge variant={getConfidenceBadgeVariant(code.confidence)}>
                                  {code.confidence}
                                </Badge>
                              </div>
                              <p className="text-sm mt-1">{code.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Rationale: {code.rationale}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      {selectedNote.status === "draft" && (
                        <Button
                          onClick={() => updateStatusMutation.mutate({ noteId: selectedNote.id, status: "reviewed" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid="button-mark-reviewed"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Reviewed
                        </Button>
                      )}
                      {selectedNote.status === "reviewed" && (
                        <Button
                          onClick={() => updateStatusMutation.mutate({ noteId: selectedNote.id, status: "finalized" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid="button-finalize"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Finalize Note
                        </Button>
                      )}
                    </div>
                    
                    <Alert variant="default">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedNote.disclaimer}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a note from the list to view its content
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="codes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Common ICD-10 Codes</CardTitle>
                <CardDescription>Frequently used diagnosis codes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData?.commonCodes?.icd10?.map((code, idx) => (
                  <div key={idx} className="p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge>ICD-10</Badge>
                      <span className="font-mono font-bold">{code.code}</span>
                    </div>
                    <p className="text-sm mt-1">{code.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Common CPT Codes</CardTitle>
                <CardDescription>Frequently used procedure codes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData?.commonCodes?.cpt?.map((code, idx) => (
                  <div key={idx} className="p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge>CPT</Badge>
                      <span className="font-mono font-bold">{code.code}</span>
                    </div>
                    <p className="text-sm mt-1">{code.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="lab-summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Lab Results Summary
              </CardTitle>
              <CardDescription>
                Generate AI summaries of laboratory results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Lab summary generation creates organized summaries of lab results, highlighting abnormal findings.
                  All summaries require clinician review. This feature is available via the API at 
                  <code className="ml-1">/api/clinical-documentation/notes/lab-summary</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
