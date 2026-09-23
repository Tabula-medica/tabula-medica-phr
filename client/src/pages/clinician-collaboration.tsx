import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  MessageSquare,
  AlertTriangle,
  FileText,
  Plus,
  Send,
  Brain,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

interface DiscussionNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isAiGenerated: boolean;
}

interface DifferentialConsideration {
  id: string;
  condition: string;
  supportingEvidence: string[];
  againstEvidence: string[];
  likelihood: "high" | "moderate" | "low" | "ruled_out";
  addedBy: string;
  addedByName: string;
  addedAt: string;
}

interface CaseAlert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  createdAt: string;
  reviewedBy: string[];
  status: "pending" | "acknowledged" | "addressed";
  aiAnalysis?: string;
}

interface SharedPatientCase {
  id: string;
  patientId: string;
  patientName: string;
  sharedBy: string;
  sharedByName: string;
  sharedWith: string[];
  createdAt: string;
  status: "active" | "resolved" | "archived";
  summary: string;
  clinicalContext: string;
  discussionNotes: DiscussionNote[];
  differentialDraft?: {
    id: string;
    considerations: DifferentialConsideration[];
    lastUpdated: string;
    contributors: string[];
    aiSuggestions?: string;
  };
  alerts: CaseAlert[];
}

export default function ClinicianCollaboration() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [supportingEvidence, setSupportingEvidence] = useState("");
  const [againstEvidence, setAgainstEvidence] = useState("");
  const [likelihood, setLikelihood] = useState<string>("moderate");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [alertAnalyses, setAlertAnalyses] = useState<Record<string, string>>({});

  const casesQuery = useQuery<{ success: boolean; data: SharedPatientCase[] }>({
    queryKey: ["/api/collaboration/cases"],
  });

  const caseDetailQuery = useQuery<{ success: boolean; data: SharedPatientCase }>({
    queryKey: ["/api/collaboration/cases", selectedCaseId],
    enabled: !!selectedCaseId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/collaboration/cases/${selectedCaseId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/cases", selectedCaseId] });
      setNewNote("");
    },
  });

  const addDifferentialMutation = useMutation({
    mutationFn: async (data: {
      condition: string;
      supportingEvidence: string[];
      againstEvidence: string[];
      likelihood: string;
    }) => {
      const res = await apiRequest("POST", `/api/collaboration/cases/${selectedCaseId}/differential`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/cases", selectedCaseId] });
      setNewCondition("");
      setSupportingEvidence("");
      setAgainstEvidence("");
      setLikelihood("moderate");
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/collaboration/cases/${selectedCaseId}/alerts/${alertId}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/cases", selectedCaseId] });
    },
  });

  const generateAiSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/collaboration/cases/${selectedCaseId}/ai-summary`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setAiSummary(data.data.summary);
    },
  });

  const analyzeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/collaboration/cases/${selectedCaseId}/alerts/${alertId}/analyze`);
      const response = await res.json();
      return { alertId, analysis: response.data.analysis };
    },
    onSuccess: (data: { alertId: string; analysis: string }) => {
      setAlertAnalyses((prev) => ({ ...prev, [data.alertId]: data.analysis }));
    },
  });

  const cases = casesQuery.data?.data || [];
  const currentCase = caseDetailQuery.data?.data;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
      case "high":
        return "destructive";
      case "moderate":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (casesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-cases">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (casesQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="error-cases">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load shared cases</p>
        <Button onClick={() => casesQuery.refetch()} data-testid="button-retry-cases">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!selectedCaseId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Educational Content Only - Not Clinical Decision Support
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            This collaboration tool facilitates clinical documentation and discussion. AI-generated
            content is for documentation purposes only and does not constitute medical advice or
            clinical decision support. All clinical decisions must be made by licensed healthcare providers.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-4 mb-6">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Clinician Collaboration</h1>
            <p className="text-muted-foreground">
              Securely share and discuss patient cases with your care team
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {cases.length === 0 ? (
            <Card data-testid="empty-cases">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No shared cases yet</p>
              </CardContent>
            </Card>
          ) : (
            cases.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedCaseId(c.id)}
                data-testid={`card-case-${c.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {c.patientName}
                      <Badge variant={c.status === "active" ? "default" : "outline"}>
                        {c.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">{c.summary}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      Shared by {c.sharedByName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {c.discussionNotes.length} notes
                    </Badge>
                    {c.alerts.filter((a) => a.status === "pending").length > 0 && (
                      <Badge variant="secondary">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {c.alerts.filter((a) => a.status === "pending").length} pending alerts
                      </Badge>
                    )}
                    {c.differentialDraft && (
                      <Badge variant="outline">
                        <FileText className="h-3 w-3 mr-1" />
                        {c.differentialDraft.considerations.length} differentials
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  if (caseDetailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-case-detail">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="error-case-detail">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Case not found</p>
        <Button onClick={() => setSelectedCaseId(null)} data-testid="button-back-to-cases">
          Back to Cases
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          Educational Content Only - Not Clinical Decision Support
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          AI-generated summaries and analyses are for documentation purposes only. All clinical
          decisions must be made by licensed healthcare providers using their professional judgment.
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setSelectedCaseId(null);
            setAiSummary("");
            setAlertAnalyses({});
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{currentCase.patientName}</h1>
          <p className="text-muted-foreground">
            Shared by {currentCase.sharedByName} on {formatDate(currentCase.createdAt)}
          </p>
        </div>
        <Badge variant={currentCase.status === "active" ? "default" : "outline"}>
          {currentCase.status}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Clinical Context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{currentCase.summary}</p>
          {currentCase.clinicalContext && (
            <>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">{currentCase.clinicalContext}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="discussion" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="discussion" data-testid="tab-discussion">
            <MessageSquare className="h-4 w-4 mr-2" />
            Discussion ({currentCase.discussionNotes.length})
          </TabsTrigger>
          <TabsTrigger value="differential" data-testid="tab-differential">
            <FileText className="h-4 w-4 mr-2" />
            Differential ({currentCase.differentialDraft?.considerations.length || 0})
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts ({currentCase.alerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discussion" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Team Discussion</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateAiSummaryMutation.mutate()}
                disabled={generateAiSummaryMutation.isPending}
                data-testid="button-generate-summary"
              >
                {generateAiSummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Generate AI Summary
              </Button>
            </CardHeader>
            <CardContent>
              {aiSummary && (
                <Alert className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">
                    AI-Generated Summary (Documentation Only)
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300 whitespace-pre-wrap">
                    {aiSummary}
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {currentCase.discussionNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-md bg-muted/50"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{note.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Textarea
                  placeholder="Add your clinical observations or questions..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                  data-testid="input-new-note"
                />
                <Button
                  onClick={() => addNoteMutation.mutate(newNote)}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="differential" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Differential Considerations</CardTitle>
              <CardDescription>
                Collaboratively document and discuss potential diagnoses. This is a documentation tool
                and does not provide clinical decision support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentCase.differentialDraft?.considerations.length ? (
                <Accordion type="single" collapsible className="mb-6">
                  {currentCase.differentialDraft.considerations.map((consideration) => (
                    <AccordionItem
                      key={consideration.id}
                      value={consideration.id}
                      data-testid={`differential-${consideration.id}`}
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <span>{consideration.condition}</span>
                          <Badge variant={getLikelihoodColor(consideration.likelihood)}>
                            {consideration.likelihood}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                              Supporting Evidence:
                            </p>
                            {consideration.supportingEvidence.length > 0 ? (
                              <ul className="list-disc list-inside text-sm">
                                {consideration.supportingEvidence.map((ev, i) => (
                                  <li key={i}>{ev}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">None documented</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                              Against Evidence:
                            </p>
                            {consideration.againstEvidence.length > 0 ? (
                              <ul className="list-disc list-inside text-sm">
                                {consideration.againstEvidence.map((ev, i) => (
                                  <li key={i}>{ev}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">None documented</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Added by {consideration.addedByName} on {formatDate(consideration.addedAt)}
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">
                  No differential considerations documented yet.
                </p>
              )}

              <Separator className="my-4" />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Consideration
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="clinician-collaboration-condition" className="text-sm font-medium">Condition</label>
                    <Input id="clinician-collaboration-condition"
                      placeholder="Enter condition name"
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      data-testid="input-condition"
                    />
                  </div>
                  <div>
                    <label htmlFor="clinician-collaboration-likelihood" className="text-sm font-medium">Likelihood</label>
                    <Select value={likelihood} onValueChange={setLikelihood}>
                      <SelectTrigger id="clinician-collaboration-likelihood" data-testid="select-likelihood">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="ruled_out">Ruled Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label htmlFor="clinician-collaboration-supporting-evidence-comma-separated" className="text-sm font-medium">Supporting Evidence (comma-separated)</label>
                  <Input id="clinician-collaboration-supporting-evidence-comma-separated"
                    placeholder="E.g., Elevated HbA1c, Polyuria, Family history"
                    value={supportingEvidence}
                    onChange={(e) => setSupportingEvidence(e.target.value)}
                    data-testid="input-supporting-evidence"
                  />
                </div>
                <div>
                  <label htmlFor="clinician-collaboration-against-evidence-comma-separated" className="text-sm font-medium">Against Evidence (comma-separated)</label>
                  <Input id="clinician-collaboration-against-evidence-comma-separated"
                    placeholder="E.g., Normal fasting glucose, No ketones"
                    value={againstEvidence}
                    onChange={(e) => setAgainstEvidence(e.target.value)}
                    data-testid="input-against-evidence"
                  />
                </div>
                <Button
                  onClick={() =>
                    addDifferentialMutation.mutate({
                      condition: newCondition,
                      supportingEvidence: supportingEvidence
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      againstEvidence: againstEvidence
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      likelihood,
                    })
                  }
                  disabled={!newCondition.trim() || addDifferentialMutation.isPending}
                  data-testid="button-add-differential"
                >
                  {addDifferentialMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Consideration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Case Alerts</CardTitle>
              <CardDescription>
                Review and acknowledge alerts collaboratively. AI analysis provides educational
                context only, not clinical guidance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentCase.alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts for this case.</p>
              ) : (
                <div className="space-y-4">
                  {currentCase.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-md border"
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          {alert.status === "pending" ? (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          <span className="font-medium">{alert.title}</span>
                          <Badge variant={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mb-3">{alert.description}</p>

                      {alertAnalyses[alert.id] && (
                        <Alert className="mb-3 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <AlertTitle className="text-blue-800 dark:text-blue-200 text-sm">
                            AI Educational Context (Not Clinical Advice)
                          </AlertTitle>
                          <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm whitespace-pre-wrap">
                            {alertAnalyses[alert.id]}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex items-center gap-2">
                        {alert.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                            disabled={acknowledgeAlertMutation.isPending}
                            data-testid={`button-acknowledge-${alert.id}`}
                          >
                            {acknowledgeAlertMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Acknowledge
                          </Button>
                        )}
                        {!alertAnalyses[alert.id] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => analyzeAlertMutation.mutate(alert.id)}
                            disabled={analyzeAlertMutation.isPending}
                            data-testid={`button-analyze-${alert.id}`}
                          >
                            {analyzeAlertMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Brain className="h-4 w-4 mr-1" />
                            )}
                            AI Context
                          </Button>
                        )}
                        {alert.reviewedBy.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Reviewed by {alert.reviewedBy.length} clinician(s)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
