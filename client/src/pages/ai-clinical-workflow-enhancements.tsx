import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  ListChecks,
  FileText,
  AlertTriangle,
  Bell,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  Stethoscope,
  FlaskConical,
  Pill,
  CalendarCheck,
  Eye,
  Shield,
  Copy,
  X,
  ArrowRight,
} from "lucide-react";

interface FollowUpSuggestion {
  id: string;
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  category: string;
  suggestedDueDate?: string;
  status: string;
}

interface ClinicalDraft {
  id: string;
  type: "clinical_note" | "referral_letter";
  title: string;
  content: string;
  summary: string;
  status: string;
}

interface SmartAlert {
  id: string;
  alertType: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  status: string;
}

const priorityConfig = {
  high: { color: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400", label: "High" },
  medium: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400", label: "Medium" },
  low: { color: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400", label: "Low" },
};

const severityConfig = {
  critical: { color: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400", icon: AlertTriangle },
  warning: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400", icon: Bell },
  info: { color: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400", icon: Eye },
};

const categoryIcons: Record<string, typeof Stethoscope> = {
  lab: FlaskConical,
  medication: Pill,
  appointment: CalendarCheck,
  referral: ArrowRight,
  screening: Eye,
  monitoring: Stethoscope,
};

export default function AIClinicalWorkflowEnhancements() {
  const { toast } = useToast();
  const patientsQuery = useQuery<{ patients: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/ai-clinical-workflow-enhancements/patients"],
  });
  const patients = patientsQuery.data?.patients || [];
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
  const [drafts, setDrafts] = useState<ClinicalDraft[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [draftType, setDraftType] = useState<"clinical_note" | "referral_letter">("clinical_note");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  const effectivePatientId = selectedPatientId || (patients.length > 0 ? patients[0].id : "");
  const selectedPatientName = patients.find(p => p.id === effectivePatientId)?.name || "Patient";

  const suggestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-clinical-workflow-enhancements/suggestions/${effectivePatientId}`);
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setDisclaimer(data.disclaimer || "");
      setDismissedSuggestions(new Set());
      toast({ title: `${(data.suggestions || []).length} follow-up suggestions generated` });
    },
    onError: () => {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-clinical-workflow-enhancements/drafts/${effectivePatientId}`, {
        type: draftType,
        additionalInstructions: additionalInstructions || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.draft) {
        setDrafts((prev) => [data.draft, ...prev]);
        setDisclaimer(data.disclaimer || "");
        setExpandedDraft(data.draft.id);
        toast({ title: `${data.draft.type === "clinical_note" ? "Clinical note" : "Referral letter"} draft generated` });
      }
    },
    onError: () => {
      toast({ title: "Failed to generate draft", variant: "destructive" });
    },
  });

  const alertsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-clinical-workflow-enhancements/alerts/${effectivePatientId}`);
      return res.json();
    },
    onSuccess: (data) => {
      setAlerts(data.alerts || []);
      setDisclaimer(data.disclaimer || "");
      setAcknowledgedAlerts(new Set());
      toast({ title: `${(data.alerts || []).length} smart alerts generated` });
    },
    onError: () => {
      toast({ title: "Failed to generate alerts", variant: "destructive" });
    },
  });

  const activeSuggestions = suggestions.filter(s => !dismissedSuggestions.has(s.id));
  const activeAlerts = alerts.filter(a => !acknowledgedAlerts.has(a.id));
  const criticalAlertCount = activeAlerts.filter(a => a.severity === "critical").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Clinical Workflow Enhancements
              </h1>
              <p className="text-muted-foreground mt-1">
                AI-powered follow-up suggestions, clinical drafts, and smart alerts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={effectivePatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="w-[220px]" data-testid="select-patient">
                  <SelectValue placeholder={patientsQuery.isLoading ? "Loading..." : "Select patient"} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id} data-testid={`patient-option-${p.id}`}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {criticalAlertCount > 0 && (
                <Badge variant="destructive" className="animate-pulse" data-testid="critical-alert-badge">
                  {criticalAlertCount} Critical
                </Badge>
              )}
            </div>
          </div>

          {disclaimer && (
            <Alert data-testid="ncd-disclaimer">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">{disclaimer}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="suggestions" className="w-full">
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
              <TabsTrigger value="suggestions" className="gap-2" data-testid="tab-suggestions">
                <ListChecks className="h-4 w-4" />
                Follow-up Tasks
                {activeSuggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-1" data-testid="badge-suggestions-count">{activeSuggestions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-2" data-testid="tab-drafts">
                <FileText className="h-4 w-4" />
                Clinical Drafts
                {drafts.length > 0 && (
                  <Badge variant="secondary" className="ml-1" data-testid="badge-drafts-count">{drafts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2" data-testid="tab-alerts">
                <Bell className="h-4 w-4" />
                Smart Alerts
                {activeAlerts.length > 0 && (
                  <Badge variant={criticalAlertCount > 0 ? "destructive" : "secondary"} className="ml-1" data-testid="badge-alerts-count">
                    {activeAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggestions" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Follow-up Task Suggestions</CardTitle>
                    <CardDescription>
                      AI-analyzed patient data with recommended follow-up actions for {selectedPatientName}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => suggestionsMutation.mutate()}
                    disabled={suggestionsMutation.isPending}
                    data-testid="btn-generate-suggestions"
                  >
                    {suggestionsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {suggestionsMutation.isPending ? "Analyzing..." : "Generate Suggestions"}
                  </Button>
                </CardHeader>
                <CardContent>
                  {activeSuggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="suggestions-empty">
                      <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No follow-up suggestions yet. Click "Generate Suggestions" to analyze patient data.</p>
                    </div>
                  ) : (
                    <div className="space-y-3" data-testid="suggestions-list">
                      {activeSuggestions.map((s) => {
                        const CategoryIcon = categoryIcons[s.category] || Stethoscope;
                        const priority = priorityConfig[s.priority];
                        return (
                          <div
                            key={s.id}
                            className="border rounded-lg p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors"
                            data-testid={`suggestion-card-${s.id}`}
                          >
                            <div className="mt-0.5">
                              <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm" data-testid={`suggestion-title-${s.id}`}>{s.title}</h4>
                                <Badge className={`${priority.color} text-xs`} data-testid={`suggestion-priority-${s.id}`}>
                                  {priority.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs" data-testid={`suggestion-category-${s.id}`}>{s.category}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`suggestion-rationale-${s.id}`}>
                                {s.rationale}
                              </p>
                              {s.suggestedDueDate && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>Suggested by: {new Date(s.suggestedDueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  toast({ title: "Task accepted", description: s.title });
                                }}
                                data-testid={`btn-accept-suggestion-${s.id}`}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setDismissedSuggestions(prev => { const next = new Set(Array.from(prev)); next.add(s.id); return next; })}
                                data-testid={`btn-dismiss-suggestion-${s.id}`}
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drafts" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Generate Clinical Draft</CardTitle>
                  <CardDescription>
                    Create AI-drafted clinical notes or referral letters from {selectedPatientName}'s structured data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={draftType} onValueChange={(v) => setDraftType(v as "clinical_note" | "referral_letter")}>
                      <SelectTrigger className="w-[200px]" data-testid="select-draft-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinical_note">Clinical Note (SOAP)</SelectItem>
                        <SelectItem value="referral_letter">Referral Letter</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => draftMutation.mutate()}
                      disabled={draftMutation.isPending}
                      data-testid="btn-generate-draft"
                    >
                      {draftMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      {draftMutation.isPending ? "Generating..." : "Generate Draft"}
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Additional instructions (optional) — e.g., 'Focus on cardiovascular concerns' or 'Referral to cardiology for chest pain evaluation'"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="min-h-[60px]"
                    data-testid="input-additional-instructions"
                  />
                </CardContent>
              </Card>

              {drafts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground" data-testid="drafts-empty">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No drafts generated yet. Select a draft type and click "Generate Draft".</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3" data-testid="drafts-list">
                  {drafts.map((d) => (
                    <Card key={d.id} data-testid={`draft-card-${d.id}`}>
                      <CardHeader
                        className="cursor-pointer pb-2"
                        onClick={() => setExpandedDraft(expandedDraft === d.id ? null : d.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <CardTitle className="text-sm" data-testid={`draft-title-${d.id}`}>{d.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {d.type === "clinical_note" ? "SOAP Note" : "Referral"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">DRAFT</Badge>
                          </div>
                        </div>
                        {expandedDraft !== d.id && (
                          <CardDescription className="text-xs mt-1 line-clamp-2">{d.summary}</CardDescription>
                        )}
                      </CardHeader>
                      {expandedDraft === d.id && (
                        <CardContent>
                          <Separator className="mb-3" />
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm"
                            data-testid={`draft-content-${d.id}`}
                          >
                            {d.content}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(d.content);
                                toast({ title: "Draft copied to clipboard" });
                              }}
                              data-testid={`btn-copy-draft-${d.id}`}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDrafts(prev => prev.filter(x => x.id !== d.id))}
                              data-testid={`btn-discard-draft-${d.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Discard
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Smart Clinical Alerts</CardTitle>
                    <CardDescription>
                      AI-detected critical changes and concerning patterns for {selectedPatientName}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => alertsMutation.mutate()}
                    disabled={alertsMutation.isPending}
                    data-testid="btn-generate-alerts"
                  >
                    {alertsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {alertsMutation.isPending ? "Scanning..." : "Scan for Alerts"}
                  </Button>
                </CardHeader>
                <CardContent>
                  {activeAlerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="alerts-empty">
                      <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No alerts detected. Click "Scan for Alerts" to analyze patient status.</p>
                    </div>
                  ) : (
                    <div className="space-y-3" data-testid="alerts-list">
                      {activeAlerts
                        .sort((a, b) => {
                          const order = { critical: 0, warning: 1, info: 2 };
                          return order[a.severity] - order[b.severity];
                        })
                        .map((a) => {
                          const config = severityConfig[a.severity];
                          const SeverityIcon = config.icon;
                          return (
                            <div
                              key={a.id}
                              className={`border rounded-lg p-4 ${
                                a.severity === "critical"
                                  ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10"
                                  : a.severity === "warning"
                                  ? "border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/10"
                                  : ""
                              }`}
                              data-testid={`alert-card-${a.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <SeverityIcon className={`h-5 w-5 mt-0.5 shrink-0 ${
                                  a.severity === "critical" ? "text-red-600 dark:text-red-400" :
                                  a.severity === "warning" ? "text-yellow-600 dark:text-yellow-400" :
                                  "text-blue-600 dark:text-blue-400"
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-sm" data-testid={`alert-title-${a.id}`}>{a.title}</h4>
                                    <Badge className={`${config.color} text-xs`} data-testid={`alert-severity-${a.id}`}>
                                      {a.severity.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs" data-testid={`alert-type-${a.id}`}>{a.alertType.replace(/_/g, " ")}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1" data-testid={`alert-message-${a.id}`}>
                                    {a.message}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 h-7 text-xs"
                                  onClick={() => setAcknowledgedAlerts(prev => { const next = new Set(Array.from(prev)); next.add(a.id); return next; })}
                                  data-testid={`btn-acknowledge-alert-${a.id}`}
                                >
                                  Acknowledge
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
