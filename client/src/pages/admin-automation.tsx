import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  FileEdit, 
  Sparkles, 
  Clock, 
  User, 
  Building2,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  Stethoscope,
  Brain,
  Loader2,
  Star,
  ChevronRight
} from "lucide-react";

interface OptimizedSlot {
  id: string;
  providerId: string;
  providerName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  convenienceScore: number;
  providerAvailabilityScore: number;
  overallScore: number;
  reasoning: string;
  isOptimal: boolean;
}

interface ScheduleOptimizationResult {
  patientId: string;
  requestType: string;
  recommendedSlots: OptimizedSlot[];
  aiInsights: {
    patientPreferenceMatch: string;
    providerLoadBalancing: string;
    urgencyConsideration: string;
    additionalSuggestions: string[];
  };
  generatedAt: string;
}

interface PriorAuthResult {
  request: {
    id: string;
    patientName: string;
    procedureName: string;
    status: string;
    priority: string;
  };
  aiGeneratedContent: {
    clinicalNarrative: string;
    medicalNecessityStatement: string;
    supportingEvidence: string[];
    approvalLikelihood: number;
    approvalLikelihoodReasoning: string;
    recommendedAttachments: string[];
  };
  submissionReadiness: {
    isComplete: boolean;
    missingElements: string[];
    recommendations: string[];
  };
}

interface VisitSummary {
  id: string;
  patientName: string;
  visitDate: string;
  visitType: string;
  providerName: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  patientFriendlySummary: string;
  patientInstructions: string;
}

interface ReferralLetter {
  id: string;
  patientName: string;
  referringProviderName: string;
  referredToSpecialty: string;
  urgency: string;
  reason: string;
  letterContent: string;
}

interface IntakeFormSection {
  id: string;
  title: string;
  description: string;
  fields: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: { value: string; label: string }[];
  }[];
}

interface AdaptiveIntakeForm {
  id: string;
  patientId: string;
  visitType: string;
  sections: IntakeFormSection[];
  aiPersonalization: {
    addedFields: { fieldId: string; reason: string }[];
    focusAreas: string[];
  };
  estimatedCompletionTime: number;
}

function SchedulingTab() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    patientId: "patient_001",
    appointmentType: "follow_up" as const,
    preferredTimeOfDay: "morning" as const,
    specialtyRequired: "",
    urgencyLevel: "routine" as const,
  });
  const [result, setResult] = useState<ScheduleOptimizationResult | null>(null);

  const optimizeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin-automation/schedule/optimize", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Schedule Optimized", description: "AI has found optimal appointment slots" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to optimize schedule", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Intelligent Scheduling
          </CardTitle>
          <CardDescription>
            AI-powered appointment scheduling that optimizes provider availability and patient convenience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID</Label>
              <Input
                id="patientId"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                placeholder="Enter patient ID"
                data-testid="input-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentType">Appointment Type</Label>
              <Select
                value={formData.appointmentType}
                onValueChange={(value: any) => setFormData({ ...formData, appointmentType: value })}
              >
                <SelectTrigger data-testid="select-appointment-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_patient">New Patient</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="telehealth">Telehealth</SelectItem>
                  <SelectItem value="annual_wellness">Annual Wellness</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredTime">Preferred Time</Label>
              <Select
                value={formData.preferredTimeOfDay}
                onValueChange={(value: any) => setFormData({ ...formData, preferredTimeOfDay: value })}
              >
                <SelectTrigger data-testid="select-preferred-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="any">Any Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency Level</Label>
              <Select
                value={formData.urgencyLevel}
                onValueChange={(value: any) => setFormData({ ...formData, urgencyLevel: value })}
              >
                <SelectTrigger data-testid="select-urgency">
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="soon">Soon (within 1 week)</SelectItem>
                  <SelectItem value="urgent">Urgent (within 24-48h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty">Specialty Required (Optional)</Label>
            <Input
              id="specialty"
              value={formData.specialtyRequired}
              onChange={(e) => setFormData({ ...formData, specialtyRequired: e.target.value })}
              placeholder="e.g., Cardiology, Endocrinology"
              data-testid="input-specialty"
            />
          </div>
          <Button 
            onClick={() => optimizeMutation.mutate(formData)}
            disabled={optimizeMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-optimize-schedule"
          >
            {optimizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Find Optimal Appointments
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="schedule-results">
          <CardHeader>
            <CardTitle className="text-lg">Recommended Appointment Slots</CardTitle>
            <CardDescription>{result.recommendedSlots.length} slots found</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {result.recommendedSlots.map((slot, index) => (
                <Card key={slot.id} className={slot.isOptimal ? "border-green-500/50 bg-green-500/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap" data-testid="slot-card-content">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{slot.providerName}</span>
                          {slot.isOptimal && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3" /> Best Match
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{slot.specialty}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(slot.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{slot.overallScore}%</div>
                        <p className="text-xs text-muted-foreground">Match Score</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{slot.reasoning}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Patient Preference:</strong> {result.aiInsights.patientPreferenceMatch}</p>
                <p><strong>Provider Balancing:</strong> {result.aiInsights.providerLoadBalancing}</p>
                <p><strong>Urgency:</strong> {result.aiInsights.urgencyConsideration}</p>
                {result.aiInsights.additionalSuggestions.length > 0 && (
                  <div>
                    <strong>Suggestions:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {result.aiInsights.additionalSuggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PriorAuthTab() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    patientId: "patient_001",
    procedureCode: "99213",
    procedureName: "Office Visit - Established Patient",
    diagnosisCodes: ["E11.9", "I10"],
    providerId: "prov_001",
  });
  const [result, setResult] = useState<PriorAuthResult | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin-automation/prior-auth/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Prior Auth Generated", description: "AI has prepared the authorization request" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate prior authorization", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Prior Authorization Generator
          </CardTitle>
          <CardDescription>
            AI automatically generates prior authorization requests with clinical justification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pa-patientId">Patient ID</Label>
              <Input
                id="pa-patientId"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                data-testid="input-pa-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-providerId">Provider ID</Label>
              <Input
                id="pa-providerId"
                value={formData.providerId}
                onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                data-testid="input-pa-provider-id"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="procedureCode">CPT/Procedure Code</Label>
              <Input
                id="procedureCode"
                value={formData.procedureCode}
                onChange={(e) => setFormData({ ...formData, procedureCode: e.target.value })}
                data-testid="input-procedure-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="procedureName">Procedure Name</Label>
              <Input
                id="procedureName"
                value={formData.procedureName}
                onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
                data-testid="input-procedure-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="diagnosisCodes">Diagnosis Codes (comma-separated)</Label>
            <Input
              id="diagnosisCodes"
              value={formData.diagnosisCodes.join(", ")}
              onChange={(e) => setFormData({ ...formData, diagnosisCodes: e.target.value.split(",").map(s => s.trim()) })}
              placeholder="E11.9, I10"
              data-testid="input-diagnosis-codes"
            />
          </div>
          <Button 
            onClick={() => generateMutation.mutate(formData)}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-generate-prior-auth"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Prior Authorization
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="prior-auth-results">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2" data-testid="prior-auth-header">
              <CardTitle className="text-lg">Prior Authorization Request</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={result.aiGeneratedContent.approvalLikelihood >= 70 ? "default" : "secondary"}>
                  {result.aiGeneratedContent.approvalLikelihood}% Approval Likelihood
                </Badge>
                <Badge variant="outline">{result.request.status}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Patient</p>
                <p className="text-muted-foreground">{result.request.patientName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Procedure</p>
                <p className="text-muted-foreground">{result.request.procedureName}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Clinical Narrative</h4>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                {result.aiGeneratedContent.clinicalNarrative}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Medical Necessity Statement</h4>
              <p className="text-sm text-muted-foreground">
                {result.aiGeneratedContent.medicalNecessityStatement}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Supporting Evidence</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {result.aiGeneratedContent.supportingEvidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>

            <Card className={result.submissionReadiness.isComplete ? "border-green-500/50" : "border-yellow-500/50"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {result.submissionReadiness.isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    {result.submissionReadiness.isComplete ? "Ready to Submit" : "Additional Items Needed"}
                  </span>
                </div>
                {result.submissionReadiness.missingElements.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {result.submissionReadiness.missingElements.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VisitSummaryTab() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    patientId: "patient_001",
    visitDate: new Date().toISOString().split("T")[0],
    visitType: "follow_up",
    providerId: "prov_001",
    chiefComplaint: "Follow-up for diabetes management",
    clinicalNotes: "Patient reports improved blood glucose control. A1C decreased from 8.2% to 7.4%. Continue current medication regimen.",
  });
  const [result, setResult] = useState<VisitSummary | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin-automation/visit-summary/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Summary Generated", description: "AI has created the visit summary" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate visit summary", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Visit Summary Generator
          </CardTitle>
          <CardDescription>
            AI generates comprehensive visit summaries in SOAP format with patient-friendly explanations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="vs-patientId">Patient ID</Label>
              <Input
                id="vs-patientId"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                data-testid="input-vs-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vs-visitDate">Visit Date</Label>
              <Input
                id="vs-visitDate"
                type="date"
                value={formData.visitDate}
                onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                data-testid="input-visit-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vs-visitType">Visit Type</Label>
              <Select
                value={formData.visitType}
                onValueChange={(value) => setFormData({ ...formData, visitType: value })}
              >
                <SelectTrigger data-testid="select-visit-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_patient">New Patient</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="annual_wellness">Annual Wellness</SelectItem>
                  <SelectItem value="urgent">Urgent Care</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint">Chief Complaint</Label>
            <Input
              id="chiefComplaint"
              value={formData.chiefComplaint}
              onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
              placeholder="Primary reason for visit"
              data-testid="input-chief-complaint"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicalNotes">Clinical Notes</Label>
            <Textarea
              id="clinicalNotes"
              value={formData.clinicalNotes}
              onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
              placeholder="Enter clinical observations and findings..."
              rows={4}
              data-testid="textarea-clinical-notes"
            />
          </div>
          <Button 
            onClick={() => generateMutation.mutate(formData)}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-generate-summary"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Visit Summary
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4" data-testid="visit-summary-results">
          <Card className="bg-accent/50">
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Patient-Friendly Summary
              </h4>
              <p className="text-muted-foreground">{result.patientFriendlySummary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SOAP Note</CardTitle>
              <CardDescription>
                {result.patientName} - {new Date(result.visitDate).toLocaleDateString()} with {result.providerName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Subjective</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{result.subjective}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Objective</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{result.objective}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Assessment</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{result.assessment}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Plan</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{result.plan}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Patient Instructions</h4>
                <p className="text-sm text-muted-foreground">{result.patientInstructions}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReferralTab() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    patientId: "patient_001",
    referringProviderId: "prov_001",
    referredToSpecialty: "Cardiology",
    reason: "Cardiac evaluation for atypical chest pain",
    urgency: "routine" as const,
  });
  const [result, setResult] = useState<ReferralLetter | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin-automation/referral/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Referral Generated", description: "AI has created the referral letter" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate referral letter", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Referral Letter Generator
          </CardTitle>
          <CardDescription>
            AI generates professional referral letters with complete clinical context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ref-patientId">Patient ID</Label>
              <Input
                id="ref-patientId"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                data-testid="input-ref-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-specialty">Referred to Specialty</Label>
              <Input
                id="ref-specialty"
                value={formData.referredToSpecialty}
                onChange={(e) => setFormData({ ...formData, referredToSpecialty: e.target.value })}
                placeholder="e.g., Cardiology, Neurology"
                data-testid="input-ref-specialty"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-reason">Reason for Referral</Label>
            <Textarea
              id="ref-reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Describe the reason for referral..."
              rows={2}
              data-testid="textarea-ref-reason"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-urgency">Urgency</Label>
            <Select
              value={formData.urgency}
              onValueChange={(value: any) => setFormData({ ...formData, urgency: value })}
            >
              <SelectTrigger data-testid="select-ref-urgency">
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergent">Emergent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={() => generateMutation.mutate(formData)}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-generate-referral"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Referral Letter
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="referral-results">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2" data-testid="referral-header">
              <CardTitle className="text-lg">Referral Letter</CardTitle>
              <Badge variant={
                result.urgency === "emergent" ? "destructive" : 
                result.urgency === "urgent" ? "secondary" : "outline"
              }>
                {result.urgency}
              </Badge>
            </div>
            <CardDescription>
              {result.patientName} to {result.referredToSpecialty}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
              {result.letterContent}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IntakeFormTab() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    patientId: "patient_001",
    visitType: "follow_up",
  });
  const [result, setResult] = useState<AdaptiveIntakeForm | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin-automation/intake-form/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Form Generated", description: "AI has personalized the intake form" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate intake form", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            Adaptive Intake Forms
          </CardTitle>
          <CardDescription>
            AI personalizes patient intake forms based on medical history and visit type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="if-patientId">Patient ID</Label>
              <Input
                id="if-patientId"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                data-testid="input-if-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="if-visitType">Visit Type</Label>
              <Select
                value={formData.visitType}
                onValueChange={(value) => setFormData({ ...formData, visitType: value })}
              >
                <SelectTrigger data-testid="select-if-visit-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_patient">New Patient</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="annual_wellness">Annual Wellness</SelectItem>
                  <SelectItem value="urgent">Urgent Care</SelectItem>
                  <SelectItem value="procedure">Pre-Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            onClick={() => generateMutation.mutate(formData)}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-generate-intake-form"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Personalized Form
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="intake-form-results">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2" data-testid="intake-form-header">
              <CardTitle className="text-lg">Personalized Intake Form</CardTitle>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                ~{result.estimatedCompletionTime} min
              </Badge>
            </div>
            <CardDescription>
              {result.sections.reduce((acc, s) => acc + s.fields.length, 0)} questions across {result.sections.length} sections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.aiPersonalization.focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Focus areas:</span>
                {result.aiPersonalization.focusAreas.map((area, i) => (
                  <Badge key={i} variant="secondary">{area}</Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {result.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <div>
                      <h4 className="font-medium">{section.title}</h4>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <div className="space-y-2 pl-4 border-l-2">
                      {section.fields.map((field) => (
                        <div key={field.id} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span>{field.label}</span>
                          {field.required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{field.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {result.aiPersonalization.addedFields.length > 0 && (
              <Card className="bg-accent/50">
                <CardContent className="p-4">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Personalization
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.aiPersonalization.addedFields.map((f, i) => (
                      <li key={i}>Added question about: {f.reason}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminAutomation() {
  const [activeTab, setActiveTab] = useState("scheduling");

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="admin-automation-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" />
            AI Administrative Automation
          </h1>
          <p className="text-muted-foreground">
            Streamline administrative tasks with AI-powered automation
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5" data-testid="admin-tabs">
          <TabsTrigger value="scheduling" data-testid="tab-scheduling" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Scheduling</span>
          </TabsTrigger>
          <TabsTrigger value="prior-auth" data-testid="tab-prior-auth" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Prior Auth</span>
          </TabsTrigger>
          <TabsTrigger value="visit-summary" data-testid="tab-visit-summary" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Summaries</span>
          </TabsTrigger>
          <TabsTrigger value="referral" data-testid="tab-referral" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Referrals</span>
          </TabsTrigger>
          <TabsTrigger value="intake" data-testid="tab-intake" className="gap-2">
            <FileEdit className="h-4 w-4" />
            <span className="hidden sm:inline">Intake</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduling" data-testid="content-scheduling">
          <SchedulingTab />
        </TabsContent>
        <TabsContent value="prior-auth" data-testid="content-prior-auth">
          <PriorAuthTab />
        </TabsContent>
        <TabsContent value="visit-summary" data-testid="content-visit-summary">
          <VisitSummaryTab />
        </TabsContent>
        <TabsContent value="referral" data-testid="content-referral">
          <ReferralTab />
        </TabsContent>
        <TabsContent value="intake" data-testid="content-intake">
          <IntakeFormTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
