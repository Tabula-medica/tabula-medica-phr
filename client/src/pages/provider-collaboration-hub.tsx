import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageGate } from "@/components/page-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  FileText,
  BookOpen,
  Send,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit,
  Copy,
  ExternalLink,
  Sparkles,
  Info,
  User,
  Stethoscope,
  ClipboardList,
  FileSearch,
  Mail
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface PatientCaseSummary {
  id: string;
  patientId: string;
  consultingSpecialty: string;
  summaryType: string;
  generatedAt: string;
  chiefComplaint: string;
  clinicalSummary: string;
  relevantHistory: string[];
  currentMedications: string[];
  recentLabResults: { name: string; value: string; date: string; status: string }[];
  clinicalQuestions: string[];
  urgencyLevel: string;
  keyFindings: string[];
  recommendedFocus: string[];
  aiInsights: string;
  noCdsDisclaimer: string;
}

interface ResearchPaperSuggestion {
  id: string;
  patientId: string;
  generatedAt: string;
  clinicalContext: string;
  suggestedPapers: {
    id: string;
    title: string;
    authors: string[];
    journal: string;
    year: number;
    doi: string;
    abstract: string;
    relevanceScore: number;
    relevanceExplanation: string;
    keyFindings: string[];
    clinicalImplications: string[];
  }[];
  searchTermsUsed: string[];
  aiRationale: string;
  noCdsDisclaimer: string;
}

interface InterProviderCommunication {
  id: string;
  patientId: string;
  fromProviderName: string;
  toProviderName: string;
  toProviderSpecialty: string;
  communicationType: string;
  generatedAt: string;
  subject: string;
  draftContent: string;
  structuredSections: {
    greeting: string;
    patientIntroduction: string;
    clinicalBackground: string;
    reasonForCommunication: string;
    specificQuestions: string[];
    relevantFindings: string;
    urgencyStatement: string;
    requestedActions: string[];
    closingRemarks: string;
    signature: string;
  };
  priority: string;
  status: string;
  aiSuggestions: string[];
  noCdsDisclaimer: string;
}

interface DashboardData {
  recentSummaries: PatientCaseSummary[];
  recentResearchSuggestions: ResearchPaperSuggestion[];
  pendingCommunications: InterProviderCommunication[];
  sentCommunications: InterProviderCommunication[];
  statistics: {
    totalSummariesGenerated: number;
    totalResearchSuggested: number;
    totalCommunicationsDrafted: number;
    pendingReviews: number;
  };
  noCdsDisclaimer: string;
}

const specialties = [
  "Cardiology", "Nephrology", "Endocrinology", "Rheumatology", "Pulmonology",
  "Gastroenterology", "Neurology", "Oncology", "Hematology", "Infectious Disease"
];

const summaryTypes = [
  { value: "specialist_referral", label: "Specialist Referral" },
  { value: "second_opinion", label: "Second Opinion" },
  { value: "care_transition", label: "Care Transition" },
  { value: "case_conference", label: "Case Conference" }
];

const communicationTypes = [
  { value: "referral", label: "Referral Request" },
  { value: "consultation_request", label: "Consultation Request" },
  { value: "care_handoff", label: "Care Handoff" },
  { value: "follow_up", label: "Follow-up" },
  { value: "urgent_notification", label: "Urgent Notification" },
  { value: "care_coordination", label: "Care Coordination" }
];

export default function ProviderCollaborationHub() {
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [selectedSummary, setSelectedSummary] = useState<PatientCaseSummary | null>(null);
  const [selectedResearch, setSelectedResearch] = useState<ResearchPaperSuggestion | null>(null);
  const [selectedCommunication, setSelectedCommunication] = useState<InterProviderCommunication | null>(null);

  // Form states
  const [summaryForm, setSummaryForm] = useState({
    patientId: "patient-001",
    consultingSpecialty: "",
    summaryType: "specialist_referral",
    additionalContext: ""
  });

  const [researchForm, setResearchForm] = useState({
    patientId: "patient-001",
    caseContext: "",
    clinicalKeywords: ""
  });

  const [commForm, setCommForm] = useState({
    patientId: "patient-001",
    toProviderName: "",
    toProviderSpecialty: "",
    communicationType: "consultation_request",
    specificRequest: ""
  });

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/provider-collaboration/dashboard"]
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (data: typeof summaryForm) => {
      return apiRequest("POST", "/api/provider-collaboration/case-summary", data);
    },
    onSuccess: async (response) => {
      const summary = await response.json();
      setSelectedSummary(summary);
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/dashboard"] });
    }
  });

  const suggestResearchMutation = useMutation({
    mutationFn: async (data: typeof researchForm) => {
      return apiRequest("POST", "/api/provider-collaboration/research-papers", {
        ...data,
        clinicalKeywords: data.clinicalKeywords ? data.clinicalKeywords.split(",").map(k => k.trim()) : undefined
      });
    },
    onSuccess: async (response) => {
      const research = await response.json();
      setSelectedResearch(research);
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/dashboard"] });
    }
  });

  const draftCommMutation = useMutation({
    mutationFn: async (data: typeof commForm) => {
      return apiRequest("POST", "/api/provider-collaboration/communication", data);
    },
    onSuccess: async (response) => {
      const comm = await response.json();
      setSelectedCommunication(comm);
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/dashboard"] });
    }
  });

  const sendCommMutation = useMutation({
    mutationFn: async (communicationId: string) => {
      return apiRequest("POST", `/api/provider-collaboration/communication/${communicationId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/dashboard"] });
      setSelectedCommunication(null);
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <PageGate feature="provider_collaboration" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Users className="h-6 w-6" />
              Provider Collaboration Hub
            </h1>
            <p className="text-muted-foreground">AI-powered tools for seamless healthcare provider collaboration</p>
          </div>
          <Button onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-summaries">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{dashboard?.statistics.totalSummariesGenerated || 0}</div>
                  <p className="text-sm text-muted-foreground">Case Summaries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-research">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{dashboard?.statistics.totalResearchSuggested || 0}</div>
                  <p className="text-sm text-muted-foreground">Research Suggestions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-communications">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{dashboard?.statistics.totalCommunicationsDrafted || 0}</div>
                  <p className="text-sm text-muted-foreground">Communications</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-pending">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{dashboard?.statistics.pendingReviews || 0}</div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="flex-wrap" data-testid="tabs-main">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="case-summary" data-testid="tab-case-summary">Case Summary</TabsTrigger>
            <TabsTrigger value="research" data-testid="tab-research">Research Papers</TabsTrigger>
            <TabsTrigger value="communication" data-testid="tab-communication">Communication</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Recent Case Summaries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard?.recentSummaries && dashboard.recentSummaries.length > 0 ? (
                    <div className="space-y-3">
                      {dashboard.recentSummaries.slice(0, 5).map((summary) => (
                        <div
                          key={summary.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          {...clickable(() => {
                            setSelectedSummary(summary);
                            setSelectedTab("case-summary");
                          })}
                          data-testid={`summary-item-${summary.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{summary.consultingSpecialty}</span>
                            </div>
                            <Badge variant="outline">{summary.summaryType.replace(/_/g, " ")}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{summary.chiefComplaint}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(summary.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No case summaries yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Pending Communications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard?.pendingCommunications && dashboard.pendingCommunications.length > 0 ? (
                    <div className="space-y-3">
                      {dashboard.pendingCommunications.slice(0, 5).map((comm) => (
                        <div
                          key={comm.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          {...clickable(() => {
                            setSelectedCommunication(comm);
                            setSelectedTab("communication");
                          })}
                          data-testid={`comm-item-${comm.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">To: Dr. {comm.toProviderName}</span>
                            <Badge className={comm.priority === "urgent" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                              {comm.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{comm.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Status: {comm.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No pending communications</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {dashboard?.noCdsDisclaimer}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="case-summary" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Case Summary
                  </CardTitle>
                  <CardDescription>Create an AI-powered case summary for specialist consultation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-patient">Patient</Label>
                    <Select
                      value={summaryForm.patientId}
                      onValueChange={(v) => setSummaryForm({ ...summaryForm, patientId: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-patient" data-testid="select-patient-summary">
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient-001">John Smith (65M, Diabetes/HTN)</SelectItem>
                        <SelectItem value="patient-002">Sarah Johnson (45F, Lupus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-consulting-specialty">Consulting Specialty</Label>
                    <Select
                      value={summaryForm.consultingSpecialty}
                      onValueChange={(v) => setSummaryForm({ ...summaryForm, consultingSpecialty: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-consulting-specialty" data-testid="select-specialty">
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-summary-type">Summary Type</Label>
                    <Select
                      value={summaryForm.summaryType}
                      onValueChange={(v) => setSummaryForm({ ...summaryForm, summaryType: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-summary-type" data-testid="select-summary-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {summaryTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-additional-context-optional">Additional Context (Optional)</Label>
                    <Textarea id="provider-collaboration-h-additional-context-optional"
                      placeholder="Add any additional clinical context..."
                      value={summaryForm.additionalContext}
                      onChange={(e) => setSummaryForm({ ...summaryForm, additionalContext: e.target.value })}
                      data-testid="input-additional-context"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => generateSummaryMutation.mutate(summaryForm)}
                    disabled={generateSummaryMutation.isPending || !summaryForm.consultingSpecialty}
                    data-testid="button-generate-summary"
                  >
                    {generateSummaryMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {selectedSummary && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Case Summary</CardTitle>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedSummary.clinicalSummary)}
                        data-testid="button-copy-summary"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      {selectedSummary.consultingSpecialty} - {selectedSummary.summaryType.replace(/_/g, " ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1">Chief Complaint</h4>
                      <p className="text-sm">{selectedSummary.chiefComplaint}</p>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-1">Clinical Summary</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedSummary.clinicalSummary}</p>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-2">Key Findings</h4>
                      <div className="space-y-1">
                        {selectedSummary.keyFindings.map((finding, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                            <span>{finding}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Clinical Questions</h4>
                      <div className="space-y-1">
                        {selectedSummary.clinicalQuestions.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedSummary.aiInsights && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                          <Sparkles className="h-4 w-4" />
                          AI Insights
                        </h4>
                        <p className="text-sm">{selectedSummary.aiInsights}</p>
                      </div>
                    )}

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedSummary.noCdsDisclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="research" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5" />
                    Suggest Research Papers
                  </CardTitle>
                  <CardDescription>Find relevant research for complex cases</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-patient-2">Patient</Label>
                    <Select
                      value={researchForm.patientId}
                      onValueChange={(v) => setResearchForm({ ...researchForm, patientId: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-patient-2" data-testid="select-patient-research">
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient-001">John Smith (65M, Diabetes/HTN)</SelectItem>
                        <SelectItem value="patient-002">Sarah Johnson (45F, Lupus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-case-context">Case Context</Label>
                    <Textarea id="provider-collaboration-h-case-context"
                      placeholder="Describe the clinical question or complex case scenario..."
                      value={researchForm.caseContext}
                      onChange={(e) => setResearchForm({ ...researchForm, caseContext: e.target.value })}
                      rows={4}
                      data-testid="input-case-context"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-clinical-keywords-optional">Clinical Keywords (Optional)</Label>
                    <Input id="provider-collaboration-h-clinical-keywords-optional"
                      placeholder="e.g., diabetes, nephropathy, SGLT2 inhibitors"
                      value={researchForm.clinicalKeywords}
                      onChange={(e) => setResearchForm({ ...researchForm, clinicalKeywords: e.target.value })}
                      data-testid="input-keywords"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => suggestResearchMutation.mutate(researchForm)}
                    disabled={suggestResearchMutation.isPending || !researchForm.caseContext}
                    data-testid="button-suggest-research"
                  >
                    {suggestResearchMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-4 w-4 mr-2" />
                        Find Research
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {selectedResearch && (
                <Card>
                  <CardHeader>
                    <CardTitle>Suggested Research Papers</CardTitle>
                    <CardDescription>
                      {selectedResearch.suggestedPapers.length} papers found
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedResearch.aiRationale && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                          <Sparkles className="h-4 w-4" />
                          AI Rationale
                        </h4>
                        <p className="text-sm">{selectedResearch.aiRationale}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {selectedResearch.suggestedPapers.map((paper) => (
                        <div key={paper.id} className="border rounded-lg p-4" data-testid={`paper-${paper.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm">{paper.title}</h4>
                            <Badge variant="outline">{Math.round(paper.relevanceScore * 100)}%</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {paper.authors.join(", ")} - {paper.journal} ({paper.year})
                          </p>
                          <p className="text-sm mt-2">{paper.abstract}</p>
                          <div className="mt-2">
                            <p className="text-xs font-medium">Why relevant:</p>
                            <p className="text-xs text-muted-foreground">{paper.relevanceExplanation}</p>
                          </div>
                          {paper.keyFindings.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium">Key Findings:</p>
                              <ul className="text-xs text-muted-foreground list-disc ml-4">
                                {paper.keyFindings.map((f, i) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" data-testid={`button-view-paper-${paper.id}`}>
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Paper
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedResearch.noCdsDisclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="communication" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Draft Communication
                  </CardTitle>
                  <CardDescription>Create professional inter-provider messages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-patient-3">Patient</Label>
                    <Select
                      value={commForm.patientId}
                      onValueChange={(v) => setCommForm({ ...commForm, patientId: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-patient-3" data-testid="select-patient-comm">
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient-001">John Smith (65M, Diabetes/HTN)</SelectItem>
                        <SelectItem value="patient-002">Sarah Johnson (45F, Lupus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-receiving-provider-name">Receiving Provider Name</Label>
                    <Input id="provider-collaboration-h-receiving-provider-name"
                      placeholder="e.g., Smith"
                      value={commForm.toProviderName}
                      onChange={(e) => setCommForm({ ...commForm, toProviderName: e.target.value })}
                      data-testid="input-provider-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-provider-specialty">Provider Specialty</Label>
                    <Select
                      value={commForm.toProviderSpecialty}
                      onValueChange={(v) => setCommForm({ ...commForm, toProviderSpecialty: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-provider-specialty" data-testid="select-provider-specialty">
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-communication-type">Communication Type</Label>
                    <Select
                      value={commForm.communicationType}
                      onValueChange={(v) => setCommForm({ ...commForm, communicationType: v })}
                    >
                      <SelectTrigger id="provider-collaboration-h-communication-type" data-testid="select-comm-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {communicationTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-collaboration-h-specific-request-optional">Specific Request (Optional)</Label>
                    <Textarea id="provider-collaboration-h-specific-request-optional"
                      placeholder="What specifically would you like to communicate?"
                      value={commForm.specificRequest}
                      onChange={(e) => setCommForm({ ...commForm, specificRequest: e.target.value })}
                      data-testid="input-specific-request"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => draftCommMutation.mutate(commForm)}
                    disabled={draftCommMutation.isPending || !commForm.toProviderName || !commForm.toProviderSpecialty}
                    data-testid="button-draft-communication"
                  >
                    {draftCommMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Drafting...
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Draft Communication
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {selectedCommunication && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Communication Draft</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedCommunication.draftContent)}
                          data-testid="button-copy-comm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      To: Dr. {selectedCommunication.toProviderName} ({selectedCommunication.toProviderSpecialty})
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedCommunication.communicationType.replace(/_/g, " ")}</Badge>
                      <Badge className={selectedCommunication.priority === "urgent" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                        {selectedCommunication.priority}
                      </Badge>
                      <Badge variant="outline">{selectedCommunication.status}</Badge>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-1">Subject</h4>
                      <p className="text-sm">{selectedCommunication.subject}</p>
                    </div>

                    <Separator />

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{selectedCommunication.draftContent}</pre>
                    </div>

                    {selectedCommunication.aiSuggestions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                          <Sparkles className="h-4 w-4" />
                          AI Suggestions
                        </h4>
                        <ul className="space-y-1">
                          {selectedCommunication.aiSuggestions.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => sendCommMutation.mutate(selectedCommunication.id)}
                        disabled={sendCommMutation.isPending}
                        data-testid="button-send-communication"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </Button>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedCommunication.noCdsDisclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
