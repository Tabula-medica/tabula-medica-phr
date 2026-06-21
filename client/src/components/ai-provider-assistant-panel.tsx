import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Brain,
  Sparkles,
  FileText,
  ClipboardList,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  X,
  PanelRightOpen,
  PanelRightClose,
  RefreshCw,
  Zap,
  Activity,
  Pill,
  Heart,
  ShieldAlert,
  Stethoscope,
  ScrollText,
  Send,
} from "lucide-react";

interface SelectedDataPoint {
  category: "condition" | "medication" | "vital" | "allergy" | "lab" | "record" | "family-history" | "lifestyle";
  id: string;
  label: string;
  value?: string;
  date?: string;
}

interface ProactiveSuggestion {
  id: string;
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionType: string;
  actionPayload?: Record<string, string>;
  relevantTab?: string;
  aiGenerated: boolean;
}

interface SummarizeResult {
  id: string;
  patientId: string;
  patientName: string;
  summaryType: string;
  content: string;
  dataPointsUsed: number;
  generatedAt: string;
  confidenceScore: number;
  noCdsDisclaimer: string;
  governanceStatus: string;
}

interface DocumentTypeOption {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface PatientDataForSelection {
  conditions?: Array<{ id: string; name: string; status: string; onset?: string }>;
  medications?: Array<{ id: string; name: string; dosage: string; frequency: string }>;
  vitals?: Array<{ id: string; type: string; value: string; unit: string; date: string; status: string }>;
  allergies?: Array<{ id: string; substance: string; reaction: string; severity: string }>;
  labs?: Array<{ id: string; name: string; value: string; unit: string; date: string; status: string }>;
  records?: Array<{ id: string; title: string; type: string; date: string }>;
}

interface AIProviderAssistantPanelProps {
  patientId: string;
  patientName: string;
  activeTab?: string;
  patientData?: PatientDataForSelection;
  isOpen: boolean;
  onToggle: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const categoryIcons: Record<string, typeof Activity> = {
  condition: Stethoscope,
  medication: Pill,
  vital: Heart,
  allergy: ShieldAlert,
  lab: Activity,
  record: FileText,
  "family-history": ScrollText,
  lifestyle: Zap,
};

const priorityColors: Record<string, string> = {
  high: "border-red-500/50 bg-red-500/5",
  medium: "border-yellow-500/50 bg-yellow-500/5",
  low: "border-blue-500/50 bg-blue-500/5",
};

const priorityBadgeVariants: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export function AIProviderAssistantPanel({
  patientId,
  patientName,
  activeTab = "records",
  patientData,
  isOpen,
  onToggle,
  onNavigateToTab,
}: AIProviderAssistantPanelProps) {
  const { toast } = useToast();
  const [assistantTab, setAssistantTab] = useState("suggestions");
  const [selectedPoints, setSelectedPoints] = useState<SelectedDataPoint[]>([]);
  const [summaryType, setSummaryType] = useState<string>("brief-overview");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [currentSummary, setCurrentSummary] = useState<SummarizeResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("");

  const suggestionsQuery = useQuery<{ suggestions: ProactiveSuggestion[] }>({
    queryKey: ["/api/ai-provider-assistant/suggestions", patientId, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams({ patientId: patientId || "", activeTab: activeTab || "" });
      const res = await fetch(`/api/ai-provider-assistant/suggestions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: isOpen && !!patientId,
  });

  const docTypesQuery = useQuery<{ types: DocumentTypeOption[] }>({
    queryKey: ["/api/ai-provider-assistant/document-types"],
    enabled: isOpen,
  });

  const summarizeMutation = useMutation({
    mutationFn: async (data: {
      patientId: string;
      patientName: string;
      selectedDataPoints: SelectedDataPoint[];
      summaryType: string;
      additionalInstructions?: string;
    }) => {
      const res = await apiRequest("POST", "/api/ai-provider-assistant/summarize", data);
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentSummary(data.summary);
      toast({ title: "Summary generated", description: "AI note summary is ready for review." });
    },
    onError: (error: Error) => {
      toast({ title: "Summarization failed", description: error.message, variant: "destructive" });
    },
  });

  const quickDocMutation = useMutation({
    mutationFn: async (data: {
      patientId: string;
      patientName: string;
      documentTypeId: string;
      selectedDataPoints?: SelectedDataPoint[];
    }) => {
      const res = await apiRequest("POST", "/api/ai-provider-assistant/quick-document", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Document generated", description: `Draft "${data.draft.title}" is ready for review.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Document generation failed", description: error.message, variant: "destructive" });
    },
  });

  const availableDataPoints = useCallback((): Record<string, SelectedDataPoint[]> => {
    if (!patientData) return {};
    const result: Record<string, SelectedDataPoint[]> = {};

    if (patientData.conditions?.length) {
      result.condition = patientData.conditions.map(c => ({
        category: "condition" as const,
        id: c.id,
        label: c.name,
        value: c.status,
        date: c.onset,
      }));
    }
    if (patientData.medications?.length) {
      result.medication = patientData.medications.map(m => ({
        category: "medication" as const,
        id: m.id,
        label: m.name,
        value: `${m.dosage} ${m.frequency}`,
      }));
    }
    if (patientData.vitals?.length) {
      result.vital = patientData.vitals.map(v => ({
        category: "vital" as const,
        id: v.id,
        label: v.type,
        value: `${v.value} ${v.unit}`,
        date: v.date,
      }));
    }
    if (patientData.allergies?.length) {
      result.allergy = patientData.allergies.map(a => ({
        category: "allergy" as const,
        id: a.id,
        label: a.substance,
        value: `${a.reaction} (${a.severity})`,
      }));
    }
    if (patientData.labs?.length) {
      result.lab = patientData.labs.map(l => ({
        category: "lab" as const,
        id: l.id,
        label: l.name,
        value: `${l.value} ${l.unit}`,
        date: l.date,
      }));
    }
    if (patientData.records?.length) {
      result.record = patientData.records.map(r => ({
        category: "record" as const,
        id: r.id,
        label: r.title,
        value: r.type,
        date: r.date,
      }));
    }

    return result;
  }, [patientData]);

  const toggleDataPoint = (point: SelectedDataPoint) => {
    setSelectedPoints(prev => {
      const exists = prev.find(p => p.id === point.id && p.category === point.category);
      if (exists) return prev.filter(p => !(p.id === point.id && p.category === point.category));
      return [...prev, point];
    });
  };

  const isPointSelected = (point: SelectedDataPoint) => {
    return selectedPoints.some(p => p.id === point.id && p.category === point.category);
  };

  const selectAllInCategory = (category: string, points: SelectedDataPoint[]) => {
    const allSelected = points.every(p => isPointSelected(p));
    if (allSelected) {
      setSelectedPoints(prev => prev.filter(p => p.category !== category));
    } else {
      setSelectedPoints(prev => {
        const withoutCategory = prev.filter(p => p.category !== category);
        return [...withoutCategory, ...points];
      });
    }
  };

  const handleSummarize = () => {
    if (selectedPoints.length === 0) {
      toast({ title: "No data selected", description: "Select at least one data point to summarize.", variant: "destructive" });
      return;
    }
    summarizeMutation.mutate({
      patientId,
      patientName,
      selectedDataPoints: selectedPoints,
      summaryType,
      additionalInstructions: additionalInstructions.trim() || undefined,
    });
  };

  const handleQuickDocument = (docTypeId: string) => {
    quickDocMutation.mutate({
      patientId,
      patientName,
      documentTypeId: docTypeId,
      selectedDataPoints: selectedPoints.length > 0 ? selectedPoints : undefined,
    });
  };

  const handleSuggestionAction = (suggestion: ProactiveSuggestion) => {
    if (suggestion.actionType === "generate-document" && suggestion.actionPayload?.documentTypeId) {
      setAssistantTab("documents");
      setSelectedDocType(suggestion.actionPayload.documentTypeId);
    } else if (suggestion.actionType === "summarize") {
      setAssistantTab("summarize");
    } else if (suggestion.actionType === "navigate" && suggestion.relevantTab) {
      onNavigateToTab?.(suggestion.relevantTab);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied", description: "Content copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const suggestions = suggestionsQuery.data?.suggestions || [];
  const docTypes = docTypesQuery.data?.types || [];
  const dataGroups = availableDataPoints();

  useEffect(() => {
    if (selectedDocType && docTypes.length > 0) {
      const exists = docTypes.find(dt => dt.id === selectedDocType);
      if (!exists) setSelectedDocType("");
    }
  }, [selectedDocType, docTypes]);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed right-4 top-20 z-40 gap-2 shadow-md bg-background"
        data-testid="button-open-ai-assistant"
      >
        <Brain className="h-4 w-4" />
        <span className="hidden sm:inline">AI Assistant</span>
        {suggestions.filter(s => s.priority === "high").length > 0 && (
          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
            {suggestions.filter(s => s.priority === "high").length}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetContent side="right" className="w-full sm:w-[460px] p-0 flex flex-col" data-testid="panel-ai-assistant">
        <SheetHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base" data-testid="text-assistant-title">AI Clinical Assistant</SheetTitle>
                <SheetDescription className="text-xs">{patientName}</SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              AI-Powered
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={assistantTab} onValueChange={setAssistantTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 grid grid-cols-3">
            <TabsTrigger value="suggestions" className="text-xs gap-1" data-testid="tab-suggestions">
              <Lightbulb className="h-3.5 w-3.5" />
              Suggestions
              {suggestions.filter(s => s.priority === "high").length > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px] rounded-full">
                  {suggestions.filter(s => s.priority === "high").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="summarize" className="text-xs gap-1" data-testid="tab-summarize">
              <ClipboardList className="h-3.5 w-3.5" />
              Summarize
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1" data-testid="tab-documents">
              <FileText className="h-3.5 w-3.5" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{suggestions.length} suggestion(s) for current view</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-provider-assistant/suggestions"] })}
                  data-testid="button-refresh-suggestions"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>

              {suggestionsQuery.isLoading ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Analyzing patient data...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No suggestions at this time.</p>
                  <p className="text-xs mt-1">Suggestions update as you navigate tabs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className={`${priorityColors[suggestion.priority]} cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => handleSuggestionAction(suggestion)}
                      data-testid={`card-suggestion-${suggestion.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`text-[10px] px-1.5 py-0 ${priorityBadgeVariants[suggestion.priority]}`}>
                                {suggestion.priority}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {suggestion.category}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium" data-testid={`text-suggestion-title-${suggestion.id}`}>
                              {suggestion.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-700 dark:text-yellow-400">
                    AI suggestions are for informational purposes only and do NOT constitute clinical decision support.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="summarize" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Summary Type</label>
                  <Select value={summaryType} onValueChange={setSummaryType}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-summary-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief-overview">Brief Overview</SelectItem>
                      <SelectItem value="clinical-note">Clinical Note (SOAP)</SelectItem>
                      <SelectItem value="progress-update">Progress Update</SelectItem>
                      <SelectItem value="handoff-summary">Handoff Summary (SBAR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium">Select Data Points ({selectedPoints.length} selected)</label>
                    {selectedPoints.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedPoints([])} data-testid="button-clear-selection">
                        Clear all
                      </Button>
                    )}
                  </div>

                  {Object.keys(dataGroups).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No patient data available for selection.</p>
                      <p className="text-[10px] mt-1">Navigate to a patient chart to load data.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto border rounded-lg p-2">
                      {Object.entries(dataGroups).map(([category, points]) => {
                        const Icon = categoryIcons[category] || Activity;
                        const allSelected = points.every(p => isPointSelected(p));
                        return (
                          <div key={category} className="space-y-1">
                            <div
                              className="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-muted/50 rounded"
                              onClick={() => selectAllInCategory(category, points)}
                              data-testid={`category-${category}`}
                            >
                              <Checkbox checked={allSelected} className="h-3.5 w-3.5" />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium capitalize">{category.replace("-", " ")}s</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto">{points.length}</Badge>
                            </div>
                            <div className="ml-6 space-y-0.5">
                              {points.map((point) => (
                                <div
                                  key={`${point.category}-${point.id}`}
                                  className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-muted/30 rounded"
                                  onClick={() => toggleDataPoint(point)}
                                  data-testid={`datapoint-${point.category}-${point.id}`}
                                >
                                  <Checkbox checked={isPointSelected(point)} className="h-3 w-3" />
                                  <span className="text-xs truncate flex-1">{point.label}</span>
                                  {point.value && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{point.value}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block">Additional Instructions (optional)</label>
                  <Textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="E.g., Focus on cardiovascular concerns..."
                    className="text-xs min-h-[60px] resize-none"
                    data-testid="textarea-instructions"
                  />
                </div>

                <Button
                  onClick={handleSummarize}
                  disabled={selectedPoints.length === 0 || summarizeMutation.isPending}
                  className="w-full gap-2"
                  data-testid="button-generate-summary"
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Generate Summary ({selectedPoints.length} points)
                    </>
                  )}
                </Button>

                {currentSummary && (
                  <Card className="border-primary/20" data-testid="card-summary-result">
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {summaryType === "clinical-note" ? "Clinical Note" :
                           summaryType === "progress-update" ? "Progress Update" :
                           summaryType === "handoff-summary" ? "Handoff Summary" : "Clinical Overview"}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyToClipboard(currentSummary.content, currentSummary.id)}
                          data-testid="button-copy-summary"
                        >
                          {copiedId === currentSummary.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{currentSummary.dataPointsUsed} data points</Badge>
                        <Badge variant="outline" className="text-[10px]">{Math.round(currentSummary.confidenceScore * 100)}% confidence</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto" data-testid="text-summary-content">
                        {currentSummary.content}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400">
                      AI-generated summaries require provider review. Not clinical decision support.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="documents" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full px-4 pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Generate clinical documents pre-filled with selected patient data.
                {selectedPoints.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">{selectedPoints.length} data points will be included</Badge>
                )}
              </p>

              {docTypesQuery.isLoading ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Loading document types...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {["clinical", "administrative", "patient-facing"].map((cat) => {
                    const typesInCat = docTypes.filter(dt => dt.category === cat);
                    if (typesInCat.length === 0) return null;
                    return (
                      <div key={cat}>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                          {cat.replace("-", " ")}
                        </h4>
                        <div className="space-y-2">
                          {typesInCat.map((dt) => (
                            <Card
                              key={dt.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${selectedDocType === dt.id ? "ring-2 ring-primary" : ""}`}
                              onClick={() => setSelectedDocType(dt.id === selectedDocType ? "" : dt.id)}
                              data-testid={`card-doctype-${dt.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{dt.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{dt.description}</p>
                                  </div>
                                  {selectedDocType === dt.id && (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs gap-1 ml-2 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickDocument(dt.id);
                                      }}
                                      disabled={quickDocMutation.isPending}
                                      data-testid={`button-generate-${dt.id}`}
                                    >
                                      {quickDocMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Zap className="h-3 w-3" />
                                      )}
                                      Generate
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {quickDocMutation.isSuccess && quickDocMutation.data?.draft && (
                <Card className="mt-4 border-green-500/30 bg-green-500/5" data-testid="card-generated-doc">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <p className="text-sm font-medium">Document generated</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{quickDocMutation.data.draft.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => copyToClipboard(quickDocMutation.data.draft.content, quickDocMutation.data.draft.id)}
                        data-testid="button-copy-generated-doc"
                      >
                        {copiedId === quickDocMutation.data.draft.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy
                      </Button>
                      <Badge variant="secondary" className="text-[10px]">
                        {quickDocMutation.data.draft.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-700 dark:text-yellow-400">
                    All AI-generated documents require provider review before clinical use. Not clinical decision support.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export function AIAssistantToggleButton({
  onClick,
  suggestionCount = 0,
}: {
  onClick: () => void;
  suggestionCount?: number;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2 shadow-sm"
      data-testid="button-toggle-ai-assistant"
    >
      <Brain className="h-4 w-4" />
      AI Assistant
      {suggestionCount > 0 && (
        <Badge variant="destructive" className="h-5 min-w-[20px] p-0 flex items-center justify-center text-xs rounded-full">
          {suggestionCount}
        </Badge>
      )}
    </Button>
  );
}
