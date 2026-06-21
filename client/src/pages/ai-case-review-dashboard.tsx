import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Brain, 
  Stethoscope, 
  FileText, 
  MessageSquare, 
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  Pill,
  UserCog,
  FlaskConical,
  Plus,
  Send,
  RefreshCw,
  ChevronRight,
  Shield,
  Info
} from "lucide-react";

interface DashboardMetrics {
  totalCases: number;
  pendingReviews: number;
  completedReviews: number;
  avgDiagnosesPerCase: number;
  avgTreatmentOptionsPerCase: number;
  clinicalTrialsFound: number;
}

interface CaseSummary {
  id: string;
  providerName: string;
  providerSpecialty: string;
  chiefComplaint: string;
  ageRange: string;
  gender: string;
  status: string;
  urgencyAssessment?: {
    urgencyLevel: string;
    reasoning: string;
  };
  diagnosesCount: number;
  treatmentOptionsCount: number;
  clinicalTrialsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PotentialDiagnosis {
  name: string;
  icdCode: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  differentialConsiderations: string[];
  suggestedTests: string[];
}

interface TreatmentOption {
  category: string;
  name: string;
  description: string;
  evidence: string;
  considerations: string[];
  contraindications: string[];
}

interface ClinicalTrial {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  interventions: string[];
  locations: string[];
  eligibilitySummary: string;
  url: string;
}

interface DiscussionMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  messageType: string;
  mentions: string[];
  timestamp: string;
}

interface CaseReview {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  anonymizedData: {
    ageRange: string;
    gender: string;
    chiefComplaint: string;
    presentIllnessHistory: string;
    relevantMedicalHistory: string[];
    currentMedications: string[];
    allergies: string[];
    vitalSigns: Record<string, string>;
    labResults: Record<string, { value: string; unit: string; range?: string }>;
    imagingFindings: string[];
    socialHistory: string[];
  };
  status: string;
  aiAnalysis?: {
    summary: string;
    keyFindings: string[];
    riskFactors: string[];
    recommendations: string[];
    nocdDisclaimer: string;
  };
  urgencyAssessment?: {
    urgencyLevel: string;
    reasoning: string;
  };
  potentialDiagnoses: PotentialDiagnosis[];
  treatmentOptions: TreatmentOption[];
  clinicalTrials: ClinicalTrial[];
  discussion: DiscussionMessage[];
  createdAt: string;
  updatedAt: string;
}

function DashboardOverview() {
  const { data, isLoading, error } = useQuery<{ success: boolean; metrics: DashboardMetrics; recentCases: CaseSummary[] }>({
    queryKey: ["/api/case-review/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load dashboard metrics</AlertDescription>
      </Alert>
    );
  }

  const { metrics, recentCases } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-total-cases">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCases}</div>
            <p className="text-xs text-muted-foreground">AI-analyzed case reviews</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingReviews}</div>
            <p className="text-xs text-muted-foreground">Awaiting provider input</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completed-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completedReviews}</div>
            <p className="text-xs text-muted-foreground">Finalized case reviews</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-diagnoses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg Diagnoses/Case</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgDiagnosesPerCase.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">AI-suggested differentials</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-treatments">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg Treatments/Case</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgTreatmentOptionsPerCase.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Treatment recommendations</p>
          </CardContent>
        </Card>

        <Card data-testid="card-clinical-trials">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Clinical Trials Found</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.clinicalTrialsFound}</div>
            <p className="text-xs text-muted-foreground">Relevant trial matches</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
          <CardDescription>Latest case reviews submitted for AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCases.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No cases yet. Create your first case review to get started.</p>
          ) : (
            <div className="space-y-3">
              {recentCases.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate" data-testid={`case-row-${c.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.chiefComplaint}</span>
                      <Badge variant={c.status === "completed" ? "default" : c.status === "in_progress" ? "secondary" : "outline"}>
                        {c.status}
                      </Badge>
                      {c.urgencyAssessment && (
                        <Badge variant={c.urgencyAssessment.urgencyLevel === "high" ? "destructive" : c.urgencyAssessment.urgencyLevel === "medium" ? "secondary" : "outline"}>
                          {c.urgencyAssessment.urgencyLevel} urgency
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.ageRange} {c.gender} • {c.providerSpecialty} • {c.diagnosesCount} diagnoses, {c.treatmentOptionsCount} treatments
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>HIPAA Compliance</AlertTitle>
        <AlertDescription>
          All case data is anonymized before AI analysis. No PHI (Protected Health Information) is stored or transmitted to AI services.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function NewCaseForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    providerSpecialty: "",
    ageRange: "",
    gender: "",
    chiefComplaint: "",
    presentIllnessHistory: "",
    relevantMedicalHistory: "",
    currentMedications: "",
    allergies: "",
    vitalSigns: "",
    labResults: "",
    imagingFindings: "",
    socialHistory: "",
  });

  const createCase = useMutation({
    mutationFn: async (data: typeof formData) => {
      const anonymizedData = {
        ageRange: data.ageRange,
        gender: data.gender,
        chiefComplaint: data.chiefComplaint,
        presentIllnessHistory: data.presentIllnessHistory,
        relevantMedicalHistory: data.relevantMedicalHistory.split("\n").filter(Boolean),
        currentMedications: data.currentMedications.split("\n").filter(Boolean),
        allergies: data.allergies.split("\n").filter(Boolean),
        vitalSigns: parseKeyValuePairs(data.vitalSigns),
        labResults: parseLabResults(data.labResults),
        imagingFindings: data.imagingFindings.split("\n").filter(Boolean),
        socialHistory: data.socialHistory.split("\n").filter(Boolean),
      };

      return await apiRequest("POST", "/api/case-review/cases", {
        providerSpecialty: data.providerSpecialty,
        anonymizedData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-review/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-review/cases"] });
      onClose();
    },
  });

  const parseKeyValuePairs = (str: string): Record<string, string> => {
    const result: Record<string, string> = {};
    str.split("\n").filter(Boolean).forEach(line => {
      const [key, value] = line.split(":").map(s => s.trim());
      if (key && value) result[key] = value;
    });
    return result;
  };

  const parseLabResults = (str: string): Record<string, { value: string; unit: string; range?: string }> => {
    const result: Record<string, { value: string; unit: string; range?: string }> = {};
    str.split("\n").filter(Boolean).forEach(line => {
      const parts = line.split(":").map(s => s.trim());
      if (parts[0] && parts[1]) {
        result[parts[0]] = { value: parts[1], unit: parts[2] || "", range: parts[3] };
      }
    });
    return result;
  };

  return (
    <ScrollArea className="max-h-[70vh]">
      <form onSubmit={(e) => { e.preventDefault(); createCase.mutate(formData); }} className="space-y-4 pr-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="providerSpecialty">Provider Specialty</Label>
            <Select value={formData.providerSpecialty} onValueChange={(v) => setFormData(prev => ({ ...prev, providerSpecialty: v }))}>
              <SelectTrigger data-testid="select-specialty">
                <SelectValue placeholder="Select specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General Medicine">General Medicine</SelectItem>
                <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
                <SelectItem value="Cardiology">Cardiology</SelectItem>
                <SelectItem value="Neurology">Neurology</SelectItem>
                <SelectItem value="Oncology">Oncology</SelectItem>
                <SelectItem value="Pulmonology">Pulmonology</SelectItem>
                <SelectItem value="Gastroenterology">Gastroenterology</SelectItem>
                <SelectItem value="Endocrinology">Endocrinology</SelectItem>
                <SelectItem value="Rheumatology">Rheumatology</SelectItem>
                <SelectItem value="Nephrology">Nephrology</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ageRange">Age Range</Label>
            <Select value={formData.ageRange} onValueChange={(v) => setFormData(prev => ({ ...prev, ageRange: v }))}>
              <SelectTrigger data-testid="select-age-range">
                <SelectValue placeholder="Select age range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-17">0-17 (Pediatric)</SelectItem>
                <SelectItem value="18-30">18-30</SelectItem>
                <SelectItem value="31-45">31-45</SelectItem>
                <SelectItem value="46-60">46-60</SelectItem>
                <SelectItem value="61-75">61-75</SelectItem>
                <SelectItem value="76+">76+ (Geriatric)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select value={formData.gender} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}>
              <SelectTrigger data-testid="select-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
          <Input
            id="chiefComplaint"
            value={formData.chiefComplaint}
            onChange={(e) => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))}
            placeholder="e.g., Persistent chest pain radiating to left arm"
            required
            data-testid="input-chief-complaint"
          />
        </div>

        <div>
          <Label htmlFor="presentIllnessHistory">History of Present Illness *</Label>
          <Textarea
            id="presentIllnessHistory"
            value={formData.presentIllnessHistory}
            onChange={(e) => setFormData(prev => ({ ...prev, presentIllnessHistory: e.target.value }))}
            placeholder="Describe the onset, duration, severity, and associated symptoms..."
            rows={4}
            required
            data-testid="input-present-illness"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="relevantMedicalHistory">Relevant Medical History (one per line)</Label>
            <Textarea
              id="relevantMedicalHistory"
              value={formData.relevantMedicalHistory}
              onChange={(e) => setFormData(prev => ({ ...prev, relevantMedicalHistory: e.target.value }))}
              placeholder="Type 2 Diabetes&#10;Hypertension&#10;Previous MI"
              rows={3}
              data-testid="input-medical-history"
            />
          </div>
          <div>
            <Label htmlFor="currentMedications">Current Medications (one per line)</Label>
            <Textarea
              id="currentMedications"
              value={formData.currentMedications}
              onChange={(e) => setFormData(prev => ({ ...prev, currentMedications: e.target.value }))}
              placeholder="Metformin 500mg BID&#10;Lisinopril 10mg daily&#10;Aspirin 81mg daily"
              rows={3}
              data-testid="input-medications"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="allergies">Known Allergies (one per line)</Label>
            <Textarea
              id="allergies"
              value={formData.allergies}
              onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
              placeholder="Penicillin (rash)&#10;Sulfa (anaphylaxis)"
              rows={2}
              data-testid="input-allergies"
            />
          </div>
          <div>
            <Label htmlFor="vitalSigns">Vital Signs (format: Name: Value)</Label>
            <Textarea
              id="vitalSigns"
              value={formData.vitalSigns}
              onChange={(e) => setFormData(prev => ({ ...prev, vitalSigns: e.target.value }))}
              placeholder="BP: 140/90&#10;HR: 88&#10;Temp: 98.6&#10;RR: 18"
              rows={2}
              data-testid="input-vital-signs"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="labResults">Lab Results (format: Test: Value: Unit: Range)</Label>
          <Textarea
            id="labResults"
            value={formData.labResults}
            onChange={(e) => setFormData(prev => ({ ...prev, labResults: e.target.value }))}
            placeholder="Troponin: 0.15: ng/mL: &lt;0.04&#10;BNP: 450: pg/mL: &lt;100&#10;Creatinine: 1.2: mg/dL: 0.7-1.3"
            rows={3}
            data-testid="input-lab-results"
          />
        </div>

        <div>
          <Label htmlFor="imagingFindings">Imaging Findings (one per line)</Label>
          <Textarea
            id="imagingFindings"
            value={formData.imagingFindings}
            onChange={(e) => setFormData(prev => ({ ...prev, imagingFindings: e.target.value }))}
            placeholder="CXR: Mild cardiomegaly&#10;ECG: ST elevations in leads V1-V4"
            rows={2}
            data-testid="input-imaging"
          />
        </div>

        <div>
          <Label htmlFor="socialHistory">Social History (one per line)</Label>
          <Textarea
            id="socialHistory"
            value={formData.socialHistory}
            onChange={(e) => setFormData(prev => ({ ...prev, socialHistory: e.target.value }))}
            placeholder="Former smoker (quit 5 years ago)&#10;Occasional alcohol use&#10;Sedentary lifestyle"
            rows={2}
            data-testid="input-social-history"
          />
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Data Anonymization</AlertTitle>
          <AlertDescription>
            Do not include patient names, DOB, MRN, SSN, or any other identifying information. Use age ranges and general descriptors only.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={createCase.isPending} data-testid="button-submit-case">
            {createCase.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Submit for AI Analysis
              </>
            )}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}

function CaseList() {
  const { data, isLoading, error } = useQuery<{ success: boolean; cases: CaseSummary[]; total: number }>({
    queryKey: ["/api/case-review/cases"],
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load case list</AlertDescription>
      </Alert>
    );
  }

  if (selectedCaseId) {
    return <CaseDetail caseId={selectedCaseId} onBack={() => setSelectedCaseId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">{data.total} case{data.total !== 1 ? "s" : ""} found</p>
      </div>

      {data.cases.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No cases found. Create a new case to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.cases.map((c) => (
            <Card 
              key={c.id} 
              className="cursor-pointer hover-elevate" 
              onClick={() => setSelectedCaseId(c.id)}
              data-testid={`case-card-${c.id}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold">{c.chiefComplaint}</h3>
                      <Badge variant={c.status === "completed" ? "default" : c.status === "in_progress" ? "secondary" : "outline"}>
                        {c.status.replace("_", " ")}
                      </Badge>
                      {c.urgencyAssessment && (
                        <Badge variant={c.urgencyAssessment.urgencyLevel === "high" ? "destructive" : c.urgencyAssessment.urgencyLevel === "medium" ? "secondary" : "outline"}>
                          {c.urgencyAssessment.urgencyLevel} urgency
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Patient:</span> {c.ageRange} {c.gender}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Specialty:</span> {c.providerSpecialty}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Diagnoses:</span> {c.diagnosesCount}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trials:</span> {c.clinicalTrialsCount}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(c.createdAt).toLocaleDateString()} by {c.providerName}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseDetail({ caseId, onBack }: { caseId: string; onBack: () => void }) {
  const { data, isLoading, error } = useQuery<{ success: boolean; case: CaseReview }>({
    queryKey: ["/api/case-review/cases", caseId],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load case details</AlertDescription>
      </Alert>
    );
  }

  const caseReview = data.case;

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} data-testid="button-back">
        Back to Cases
      </Button>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{caseReview.anonymizedData.chiefComplaint}</h2>
          <p className="text-muted-foreground">
            {caseReview.anonymizedData.ageRange} {caseReview.anonymizedData.gender} • {caseReview.providerSpecialty}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={caseReview.status === "completed" ? "default" : "secondary"}>
            {caseReview.status.replace("_", " ")}
          </Badge>
          {caseReview.urgencyAssessment && (
            <Badge variant={caseReview.urgencyAssessment.urgencyLevel === "high" ? "destructive" : "outline"}>
              {caseReview.urgencyAssessment.urgencyLevel} urgency
            </Badge>
          )}
        </div>
      </div>

      {caseReview.aiAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{caseReview.aiAnalysis.summary}</p>
            
            {caseReview.aiAnalysis.keyFindings.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Key Findings</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {caseReview.aiAnalysis.keyFindings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {caseReview.aiAnalysis.riskFactors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Risk Factors</h4>
                <div className="flex gap-2 flex-wrap">
                  {caseReview.aiAnalysis.riskFactors.map((r, i) => (
                    <Badge key={i} variant="outline">{r}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>NO-CDS Disclaimer</AlertTitle>
              <AlertDescription>{caseReview.aiAnalysis.nocdDisclaimer}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="diagnoses">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="diagnoses" data-testid="tab-diagnoses">
            Diagnoses ({caseReview.potentialDiagnoses.length})
          </TabsTrigger>
          <TabsTrigger value="treatments" data-testid="tab-treatments">
            Treatments ({caseReview.treatmentOptions.length})
          </TabsTrigger>
          <TabsTrigger value="trials" data-testid="tab-trials">
            Trials ({caseReview.clinicalTrials.length})
          </TabsTrigger>
          <TabsTrigger value="discussion" data-testid="tab-discussion">
            Discussion ({caseReview.discussion.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnoses" className="space-y-4 mt-4">
          {caseReview.potentialDiagnoses.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No diagnoses generated yet. Run AI analysis to generate potential diagnoses.
              </CardContent>
            </Card>
          ) : (
            caseReview.potentialDiagnoses.map((d, i) => (
              <Card key={i} data-testid={`diagnosis-card-${i}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">{d.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{d.icdCode}</Badge>
                      <Badge variant={d.confidence === "high" ? "default" : d.confidence === "medium" ? "secondary" : "outline"}>
                        {d.confidence} confidence
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{d.reasoning}</p>
                  
                  {d.differentialConsiderations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Differential Considerations</h4>
                      <ul className="list-disc pl-5 text-sm">
                        {d.differentialConsiderations.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.suggestedTests.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Suggested Tests</h4>
                      <div className="flex gap-2 flex-wrap">
                        {d.suggestedTests.map((t, j) => (
                          <Badge key={j} variant="outline">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="treatments" className="space-y-4 mt-4">
          {caseReview.treatmentOptions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No treatment options generated yet.
              </CardContent>
            </Card>
          ) : (
            caseReview.treatmentOptions.map((t, i) => (
              <Card key={i} data-testid={`treatment-card-${i}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <Badge variant="outline">{t.category}</Badge>
                  </div>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Evidence</h4>
                    <p className="text-sm">{t.evidence}</p>
                  </div>

                  {t.considerations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Considerations</h4>
                      <ul className="list-disc pl-5 text-sm">
                        {t.considerations.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {t.contraindications.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1 text-destructive">Contraindications</h4>
                      <ul className="list-disc pl-5 text-sm text-destructive">
                        {t.contraindications.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="trials" className="space-y-4 mt-4">
          {caseReview.clinicalTrials.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No clinical trials found for this case.
              </CardContent>
            </Card>
          ) : (
            caseReview.clinicalTrials.map((trial, i) => (
              <Card key={i} data-testid={`trial-card-${i}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">{trial.title}</CardTitle>
                    <Badge variant="outline">{trial.nctId}</Badge>
                  </div>
                  <CardDescription>{trial.phase} • {trial.status}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Conditions</h4>
                    <div className="flex gap-2 flex-wrap">
                      {trial.conditions.map((c, j) => (
                        <Badge key={j} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Interventions</h4>
                    <div className="flex gap-2 flex-wrap">
                      {trial.interventions.map((int, j) => (
                        <Badge key={j} variant="outline">{int}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Eligibility Summary</h4>
                    <p className="text-sm">{trial.eligibilitySummary}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Locations</h4>
                    <p className="text-sm text-muted-foreground">{trial.locations.join(", ")}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" asChild>
                    <a href={trial.url} target="_blank" rel="noopener noreferrer">
                      View on ClinicalTrials.gov
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="discussion" className="mt-4">
          <DiscussionPanel caseId={caseId} messages={caseReview.discussion} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DiscussionPanel({ caseId, messages }: { caseId: string; messages: DiscussionMessage[] }) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/case-review/cases/${caseId}/messages`, {
        content, messageType: "text", senderRole: "Provider"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-review/cases", caseId] });
      setNewMessage("");
    },
  });

  const summarizeDiscussion = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/case-review/cases/${caseId}/summarize`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Provider Discussion
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => summarizeDiscussion.mutate()}
            disabled={summarizeDiscussion.isPending || messages.length < 2}
            data-testid="button-summarize"
          >
            {summarizeDiscussion.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            AI Summarize
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 mb-4 border rounded-md p-4">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No messages yet. Start the discussion with other providers.
            </p>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{m.senderName}</span>
                    <Badge variant="outline" className="text-xs">{m.senderRole}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {summarizeDiscussion.data && (
          <Alert className="mb-4">
            <Brain className="h-4 w-4" />
            <AlertTitle>AI Summary</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{(summarizeDiscussion.data as any).summary?.summary}</p>
              {(summarizeDiscussion.data as any).summary?.keyPoints?.length > 0 && (
                <div className="mt-2">
                  <strong>Key Points:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {(summarizeDiscussion.data as any).summary.keyPoints.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Add your thoughts to the discussion..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && newMessage.trim() && sendMessage.mutate(newMessage)}
            data-testid="input-new-message"
          />
          <Button 
            onClick={() => sendMessage.mutate(newMessage)} 
            disabled={sendMessage.isPending || !newMessage.trim()}
            data-testid="button-send-message"
          >
            {sendMessage.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AICaseReviewDashboard() {
  const [showNewCase, setShowNewCase] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-8 w-8" />
            AI Case Review
          </h1>
          <p className="text-muted-foreground">
            AI-powered provider collaboration for complex case analysis
          </p>
        </div>
        <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-case">
              <Plus className="h-4 w-4 mr-2" />
              New Case Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Submit New Case for AI Analysis</DialogTitle>
              <DialogDescription>
                Enter anonymized patient data for AI-assisted diagnosis suggestions and treatment options.
              </DialogDescription>
            </DialogHeader>
            <NewCaseForm onClose={() => setShowNewCase(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="cases" data-testid="tab-cases">
            <FileText className="h-4 w-4 mr-2" />
            All Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="cases">
          <CaseList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
