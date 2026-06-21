import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, User, Pill, AlertTriangle, Activity, Heart, Stethoscope, Clock, Brain, CheckCircle, Calendar, ChevronRight, Plus, History, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AIDisclaimer } from "@/components/ai-transparency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MedicalSummary, Patient, SummaryType, SummaryPurpose, ExtractedDataPoint } from "@shared/schema";

const summaryTypeOptions: { value: SummaryType; label: string; description: string }[] = [
  { value: "comprehensive", label: "Comprehensive", description: "Full medical history with all details" },
  { value: "focused", label: "Focused", description: "Targeted summary for specific concerns" },
  { value: "brief", label: "Brief", description: "Quick overview for handoffs" },
  { value: "emergency", label: "Emergency", description: "Critical info for urgent situations" },
];

const purposeOptions: { value: SummaryPurpose; label: string }[] = [
  { value: "new_provider_visit", label: "New Provider Visit" },
  { value: "specialist_referral", label: "Specialist Referral" },
  { value: "emergency_transfer", label: "Emergency Transfer" },
  { value: "care_coordination", label: "Care Coordination" },
  { value: "insurance_review", label: "Insurance Review" },
  { value: "patient_request", label: "Patient Request" },
];

function RelevanceBadge({ relevance }: { relevance: string }) {
  const colors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <Badge variant="outline" className={colors[relevance as keyof typeof colors] || colors.low}>
      {relevance}
    </Badge>
  );
}

function DataPointCard({ point }: { point: ExtractedDataPoint }) {
  const iconMap = {
    condition: Heart,
    medication: Pill,
    allergy: AlertTriangle,
    lab: Activity,
    vital: Activity,
    triage: Stethoscope,
    family_history: User,
    procedure: FileText,
  };
  const Icon = iconMap[point.category] || FileText;

  return (
    <div className="flex items-start gap-3 p-3 rounded-md border bg-card" data-testid={`data-point-${point.name}`}>
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{point.name}</span>
          <RelevanceBadge relevance={point.relevance} />
        </div>
        {point.value && <p className="text-sm text-muted-foreground mt-0.5">{point.value}</p>}
        {point.date && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(point.date).toLocaleDateString()}
          </p>
        )}
        {point.notes && <p className="text-xs text-muted-foreground mt-1 italic">{point.notes}</p>}
      </div>
    </div>
  );
}

function SummaryCard({ summary, onView }: { summary: MedicalSummary; onView: (id: string) => void }) {
  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      onClick={() => onView(summary.id)}
      data-testid={`summary-card-${summary.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{summary.title}</CardTitle>
            <CardDescription className="text-sm">
              {purposeOptions.find(p => p.value === summary.purpose)?.label || summary.purpose}
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex-shrink-0">
            {summary.summaryType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(summary.generatedAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {summary.metadata.totalRecordsReviewed} records
          </span>
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            {Math.round(summary.extractionConfidence * 100)}% confidence
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm text-primary">
          View details <ChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryDetails({ summary }: { summary: MedicalSummary }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold" data-testid="text-summary-title">{summary.title}</h2>
          <p className="text-muted-foreground">
            Generated {new Date(summary.generatedAt).toLocaleString()} | {summary.metadata.totalRecordsReviewed} records reviewed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{summary.summaryType}</Badge>
          <Badge>{Math.round(summary.extractionConfidence * 100)}% confidence</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium" data-testid="text-patient-name">{summary.patientOverview.name}</p>
            </div>
            {summary.patientOverview.dateOfBirth && (
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{summary.patientOverview.dateOfBirth}</p>
              </div>
            )}
            {summary.patientOverview.gender && (
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium">{summary.patientOverview.gender}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {summary.chiefConcerns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Chief Concerns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.chiefConcerns.map((concern, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span data-testid={`text-concern-${i}`}>{concern}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clinical Narrative
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AIDisclaimer text="the patient's health records" />
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-narrative">
            {summary.narrativeSummary}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="conditions" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="conditions">Conditions ({summary.activeConditions.length})</TabsTrigger>
          <TabsTrigger value="medications">Medications ({summary.currentMedications.length})</TabsTrigger>
          <TabsTrigger value="allergies">Allergies ({summary.allergies.length})</TabsTrigger>
          <TabsTrigger value="vitals">Vitals ({summary.recentVitals?.length || 0})</TabsTrigger>
          <TabsTrigger value="labs" className="hidden lg:inline-flex">Labs ({summary.relevantLabResults.length})</TabsTrigger>
          <TabsTrigger value="triage" className="hidden lg:inline-flex">Triage ({summary.recentTriageHistory.length})</TabsTrigger>
          <TabsTrigger value="family" className="hidden lg:inline-flex">Family ({summary.familyHistory.length})</TabsTrigger>
          <TabsTrigger value="impressions" className="hidden lg:inline-flex">Impressions</TabsTrigger>
        </TabsList>

        <TabsContent value="conditions" className="mt-4">
          <div className="grid gap-3">
            {summary.activeConditions.length > 0 ? (
              summary.activeConditions.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No conditions extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="medications" className="mt-4">
          <div className="grid gap-3">
            {summary.currentMedications.length > 0 ? (
              summary.currentMedications.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No medications extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="allergies" className="mt-4">
          <div className="grid gap-3">
            {summary.allergies.length > 0 ? (
              summary.allergies.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No allergies extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="mt-4">
          <div className="grid gap-3">
            {(summary.recentVitals?.length || 0) > 0 ? (
              summary.recentVitals.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No vitals extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="labs" className="mt-4">
          <div className="grid gap-3">
            {summary.relevantLabResults.length > 0 ? (
              summary.relevantLabResults.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No lab results extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="triage" className="mt-4">
          <div className="grid gap-3">
            {summary.recentTriageHistory.length > 0 ? (
              summary.recentTriageHistory.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No triage history extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          <div className="grid gap-3">
            {summary.familyHistory.length > 0 ? (
              summary.familyHistory.map((point, i) => <DataPointCard key={i} point={point} />)
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No family history extracted</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="impressions" className="mt-4">
          <div className="space-y-4">
            {summary.clinicalImpressions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Clinical Impressions</h4>
                <ul className="space-y-2">
                  {summary.clinicalImpressions.map((impression, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{impression}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="space-y-2">
                  {summary.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span data-testid={`text-recommendation-${i}`}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MedicalSummariesPage() {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>("comprehensive");
  const [purpose, setPurpose] = useState<SummaryPurpose>("new_provider_visit");
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");

  const { data: patients = [], isLoading: loadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: summaries = [], isLoading: loadingSummaries } = useQuery<MedicalSummary[]>({
    queryKey: ["/api/medical-summaries/patient", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const selectedSummary = summaries.find(s => s.id === selectedSummaryId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/medical-summaries/generate", {
        patientId: selectedPatientId,
        summaryType,
        purpose,
      });
      return await res.json() as MedicalSummary;
    },
    onSuccess: (data) => {
      toast({ title: "Summary Generated", description: "AI has created a medical history summary." });
      queryClient.invalidateQueries({ queryKey: ["/api/medical-summaries/patient", selectedPatientId] });
      setSelectedSummaryId(data.id);
      setActiveTab("history");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate summary", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <FileText className="h-6 w-6" />
          Medical History Summaries
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate AI-powered clinical summaries from patient health records
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Patient</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPatientId} onValueChange={(val) => {
                setSelectedPatientId(val);
                setSelectedSummaryId(null);
              }}>
                <SelectTrigger data-testid="select-patient">
                  <SelectValue placeholder="Choose a patient..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingPatients ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id} data-testid={`select-patient-${patient.id}`}>
                        {patient.firstName} {patient.lastName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedPatientId && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "history")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="generate" data-testid="tab-generate">
                  <Plus className="h-4 w-4 mr-1" />
                  Generate
                </TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">
                  <History className="h-4 w-4 mr-1" />
                  History ({summaries.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Summary Type</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summaryTypeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSummaryType(opt.value)}
                        className={`w-full p-3 rounded-md border text-left transition-colors ${
                          summaryType === opt.value 
                            ? "border-primary bg-primary/5" 
                            : "hover-elevate"
                        }`}
                        data-testid={`button-type-${opt.value}`}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Purpose</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={purpose} onValueChange={(v) => setPurpose(v as SummaryPurpose)}>
                      <SelectTrigger data-testid="select-purpose">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {purposeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || !selectedPatientId}
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Summary...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingSummaries ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : summaries.length > 0 ? (
                    <div className="space-y-3">
                      {summaries.map((summary) => (
                        <SummaryCard 
                          key={summary.id} 
                          summary={summary} 
                          onView={setSelectedSummaryId}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No summaries generated yet</p>
                      <p className="text-sm">Generate your first summary to see it here</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedSummary ? (
            <Card>
              <CardContent className="p-6">
                <SummaryDetails summary={selectedSummary} />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No Summary Selected</h3>
                <p className="text-sm max-w-sm mx-auto">
                  {selectedPatientId 
                    ? "Generate a new summary or select one from the history to view details"
                    : "Select a patient to get started with AI-powered medical summaries"
                  }
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-medical-summaries-disclaimer" />
    </div>
  );
}