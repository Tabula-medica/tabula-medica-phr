import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Play,
  FileText,
  Stethoscope,
  Activity,
  Pill,
  FlaskConical,
  Heart,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Eye,
  Edit3,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Bell,
  Sparkles,
  Hash,
  Clock,
  Send,
  Save,
} from "lucide-react";
import { useLocation } from "wouter";

interface AutoFillScenario {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  triggerPattern: string;
  targetDocumentTypeId: string;
  fieldMappings: Array<{
    targetField: string;
    sourceType: string;
    sourceKey?: string;
    computeFn?: string;
    description: string;
  }>;
  priority: string;
}

interface AutoFillPrompt {
  title: string;
  message: string;
  action: string;
  priority: string;
  dismissable: boolean;
}

interface AutoFillResult {
  scenarioId: string;
  scenarioName: string;
  targetDocumentTypeId: string;
  targetDocumentTypeName: string;
  prefilledFields: Record<string, string>;
  fieldsAutoFilled: number;
  totalFields: number;
  confidence: string;
  prompt: AutoFillPrompt;
}

const CLINICAL_EVENT_PRESETS: Record<string, {
  label: string;
  description: string;
  triggerType: string;
  patientId: string;
  patientName: string;
  data: Record<string, string>;
  icon: typeof Stethoscope;
  color: string;
}> = {
  new_diabetes_diagnosis: {
    label: "New Diabetes Diagnosis",
    description: "Patient diagnosed with Type 2 Diabetes — triggers referral to Endocrinology and progress note",
    triggerType: "diagnosis",
    patientId: "PT-2005",
    patientName: "Sarah Miller",
    data: {
      diagnosis: "Type 2 Diabetes Mellitus",
      diagnosisCode: "E11.65",
      severity: "moderate",
    },
    icon: Stethoscope,
    color: "text-blue-600 dark:text-blue-400",
  },
  heart_failure_diagnosis: {
    label: "Heart Failure Diagnosis",
    description: "Heart failure detected — triggers Cardiology referral with pre-filled specialist questions",
    triggerType: "diagnosis",
    patientId: "PT-2001",
    patientName: "Jane Doe",
    data: {
      diagnosis: "Congestive Heart Failure",
      diagnosisCode: "I50.9",
      severity: "severe",
    },
    icon: Heart,
    color: "text-red-600 dark:text-red-400",
  },
  patient_discharged: {
    label: "Patient Discharged",
    description: "Patient discharged after pneumonia hospitalization — triggers discharge summary and care plan",
    triggerType: "status_change",
    patientId: "PT-2003",
    patientName: "Mary Johnson",
    data: {
      newStatus: "discharged",
      primaryDiagnosis: "Community-Acquired Pneumonia",
      admissionDate: "2026-02-15",
      reasonForAdmission: "Fever, productive cough, dyspnea. CXR confirmed RLL consolidation.",
      hospitalCourse: "IV antibiotics x3 days, transitioned to oral. Afebrile, WBC normalizing.",
      conditionAtDischarge: "Stable. SpO2 96% RA. Tolerating PO.",
    },
    icon: ClipboardList,
    color: "text-purple-600 dark:text-purple-400",
  },
  critical_lab_result: {
    label: "Critical Lab: Troponin Elevated",
    description: "Troponin I critically elevated — triggers urgent patient notification document",
    triggerType: "lab_result",
    patientId: "PT-2004",
    patientName: "David Chen",
    data: {
      labTests: "Troponin I",
      labValues: "0.8 ng/mL",
      referenceRange: "<0.04 ng/mL",
      significance: "critical — possible myocardial injury",
      status: "critical",
    },
    icon: FlaskConical,
    color: "text-amber-600 dark:text-amber-400",
  },
  new_medication: {
    label: "New Medication Prescribed",
    description: "Biologic prescribed — triggers prior authorization pre-fill",
    triggerType: "medication",
    patientId: "PT-2001",
    patientName: "Jane Doe",
    data: {
      medicationName: "Adalimumab (Humira) 40mg",
      indication: "Rheumatoid Arthritis",
      diagnosisCode: "M05.79",
      previousTreatments: "Methotrexate 15mg (inadequate response), Sulfasalazine (intolerance)",
    },
    icon: Pill,
    color: "text-green-600 dark:text-green-400",
  },
  abnormal_vitals: {
    label: "Abnormal Vitals: Hypertensive Crisis",
    description: "BP 180/110 — triggers care plan with monitoring instructions",
    triggerType: "vitals",
    patientId: "PT-2008",
    patientName: "Michael Taylor",
    data: {
      vitalType: "Blood Pressure",
      vitalValue: "180/110 mmHg",
      normalRange: "< 140/90 mmHg",
      status: "critical",
    },
    icon: Activity,
    color: "text-orange-600 dark:text-orange-400",
  },
  referral_request: {
    label: "Referral to Neurology",
    description: "Referral requested for chronic migraines — pre-fills referral letter with specialty questions",
    triggerType: "referral",
    patientId: "PT-2006",
    patientName: "John Smith",
    data: {
      specialty: "Neurology",
      reason: "Chronic migraines refractory to current therapy. Frequency: 12+ days/month. Failed topiramate and sumatriptan.",
      urgency: "routine",
    },
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-400",
  },
};

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    default: return "outline";
  }
}

function confidenceBadge(confidence: string) {
  switch (confidence) {
    case "high":
      return <Badge variant="default" className="text-xs" data-testid="badge-confidence-high">High Confidence</Badge>;
    case "medium":
      return <Badge variant="secondary" className="text-xs" data-testid="badge-confidence-medium">Medium</Badge>;
    default:
      return <Badge variant="outline" className="text-xs" data-testid="badge-confidence-low">Low</Badge>;
  }
}

function triggerIcon(triggerType: string) {
  switch (triggerType) {
    case "diagnosis": return <Stethoscope className="h-4 w-4" />;
    case "status_change": return <ClipboardList className="h-4 w-4" />;
    case "lab_result": return <FlaskConical className="h-4 w-4" />;
    case "medication": return <Pill className="h-4 w-4" />;
    case "referral": return <Users className="h-4 w-4" />;
    case "vitals": return <Activity className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function PrefilledFieldsPreview({ fields, onAccept, onDismiss, result }: {
  fields: Record<string, string>;
  onAccept: () => void;
  onDismiss: () => void;
  result: AutoFillResult;
}) {
  const [expanded, setExpanded] = useState(false);
  const fieldEntries = Object.entries(fields);
  const visibleFields = expanded ? fieldEntries : fieldEntries.slice(0, 4);

  return (
    <div className="space-y-3" data-testid={`prefilled-preview-${result.scenarioId}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{result.targetDocumentTypeName}</span>
          {confidenceBadge(result.confidence)}
          <Badge variant="outline" className="text-xs">
            {result.fieldsAutoFilled}/{result.totalFields} fields
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onAccept} data-testid={`button-accept-${result.scenarioId}`}>
            <Edit3 className="h-4 w-4 mr-2" /> Open & Edit
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss} data-testid={`button-dismiss-${result.scenarioId}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleFields.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[140px_1fr] gap-2 text-sm" data-testid={`field-${key}`}>
            <span className="text-muted-foreground font-medium truncate">
              {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
            </span>
            <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 text-sm border border-green-200 dark:border-green-800">
              <span className="whitespace-pre-wrap break-words">{value.length > 200 ? value.slice(0, 200) + "..." : value}</span>
            </div>
          </div>
        ))}
      </div>

      {fieldEntries.length > 4 && (
        <Button
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-${result.scenarioId}`}
        >
          {expanded ? (
            <><ChevronUp className="h-4 w-4 mr-2" /> Show less</>
          ) : (
            <><ChevronDown className="h-4 w-4 mr-2" /> Show {fieldEntries.length - 4} more fields</>
          )}
        </Button>
      )}
    </div>
  );
}

export default function ClinicalAutoFillDashboard() {
  const [activeTab, setActiveTab] = useState("simulate");
  const [autoFillResults, setAutoFillResults] = useState<AutoFillResult[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customTriggerType, setCustomTriggerType] = useState<string>("");
  const [customPatientId, setCustomPatientId] = useState<string>("");
  const [customData, setCustomData] = useState<string>("");
  const [acceptedResult, setAcceptedResult] = useState<AutoFillResult | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: scenariosData, isLoading: scenariosLoading } = useQuery<{ scenarios: AutoFillScenario[] }>({
    queryKey: ["/api/ai-document-generation/autofill/scenarios"],
  });

  const scenarios = scenariosData?.scenarios || [];

  const evaluateMutation = useMutation({
    mutationFn: async (params: { triggerType: string; data: Record<string, string>; patientContext?: any }) => {
      const res = await apiRequest("POST", "/api/ai-document-generation/autofill/evaluate", params);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        setAutoFillResults(data.results);
        setActiveTab("results");
        toast({
          title: `${data.count} Auto-Fill Match${data.count !== 1 ? "es" : ""} Found`,
          description: "Documents have been pre-populated based on the clinical event. Review below.",
        });
      } else {
        toast({
          title: "No Matches",
          description: "No auto-fill scenarios matched this event. Try a different clinical event.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Evaluation Failed", description: error.message || "Could not evaluate auto-fill scenarios.", variant: "destructive" });
    },
  });

  const handleSimulatePreset = (presetKey: string) => {
    const preset = CLINICAL_EVENT_PRESETS[presetKey];
    if (!preset) return;
    setSelectedPreset(presetKey);
    evaluateMutation.mutate({
      triggerType: preset.triggerType,
      data: {
        ...preset.data,
        patientId: preset.patientId,
        patientName: preset.patientName,
      },
    });
  };

  const handleCustomEvaluate = () => {
    if (!customTriggerType) return;
    let parsedData: Record<string, string> = {};
    try {
      parsedData = customData.trim() ? JSON.parse(customData) : {};
    } catch {
      toast({ title: "Invalid JSON", description: "Custom data must be valid JSON.", variant: "destructive" });
      return;
    }
    if (customPatientId) parsedData.patientId = customPatientId;
    evaluateMutation.mutate({ triggerType: customTriggerType, data: parsedData });
  };

  const handleAcceptResult = (result: AutoFillResult) => {
    setAcceptedResult(result);
    setEditedFields({ ...result.prefilledFields });
    setActiveTab("editor");
    toast({
      title: "Document Ready for Editing",
      description: `${result.fieldsAutoFilled} fields pre-filled in ${result.targetDocumentTypeName}. Review and complete.`,
    });
  };

  const handleDismissResult = (scenarioId: string) => {
    setAutoFillResults(prev => prev.filter(r => r.scenarioId !== scenarioId));
  };

  const handleFieldEdit = (key: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [key]: value }));
  };

  const saveDraftMutation = useMutation({
    mutationFn: async (params: { documentTypeId: string; fields: Record<string, string>; patientId?: string }) => {
      const res = await apiRequest("POST", "/api/ai-document-generation/generate", {
        documentTypeId: params.documentTypeId,
        context: params.fields,
        patientId: params.patientId || "auto-fill",
        additionalInstructions: "Document pre-populated via Clinical Auto-Fill. Review all fields for accuracy.",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/stats"] });
      toast({
        title: "Document Generated & Saved",
        description: `${acceptedResult?.targetDocumentTypeName} draft created with ${Object.keys(editedFields).length} fields. View it in Document Generation.`,
      });
      setAcceptedResult(null);
      setEditedFields({});
      setAutoFillResults([]);
      setActiveTab("simulate");
    },
    onError: (error: any) => {
      toast({ title: "Save Failed", description: error.message || "Could not save draft.", variant: "destructive" });
    },
  });

  const handleSaveDocument = () => {
    if (!acceptedResult) return;
    saveDraftMutation.mutate({
      documentTypeId: acceptedResult.targetDocumentTypeId,
      fields: editedFields,
    });
  };

  const handleSendToGeneration = () => {
    if (!acceptedResult) return;
    saveDraftMutation.mutate({
      documentTypeId: acceptedResult.targetDocumentTypeId,
      fields: editedFields,
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="clinical-autofill-page">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Clinical Auto-Fill Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Automated data entry for clinical workflows. When diagnoses are entered, patients discharged, or labs flagged, relevant documents are pre-populated automatically.
          </p>
        </div>

        <Alert data-testid="compliance-notice">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle className="text-sm">HIPAA-Compliant Auto-Fill</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            All auto-filled fields are sourced from audited patient records. Pre-populated documents require clinician review before finalization. PHI access is logged.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="simulate" data-testid="tab-simulate">
              <Play className="h-4 w-4 mr-1" /> Clinical Events
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              <Bell className="h-4 w-4 mr-1" />
              Results
              {autoFillResults.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">
                  {autoFillResults.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="editor" data-testid="tab-editor" disabled={!acceptedResult}>
              <Edit3 className="h-4 w-4 mr-1" /> Document Editor
            </TabsTrigger>
            <TabsTrigger value="scenarios" data-testid="tab-scenarios">
              <Zap className="h-4 w-4 mr-1" /> Scenarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simulate" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Simulate Clinical Events</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Select a clinical scenario to see how documents are automatically pre-populated. Each event triggers matching auto-fill scenarios.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="event-presets">
              {Object.entries(CLINICAL_EVENT_PRESETS).map(([key, preset]) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === key;
                return (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-colors ${isSelected ? "ring-2 ring-primary" : "hover:bg-accent/30"}`}
                    onClick={() => handleSimulatePreset(key)}
                    data-testid={`preset-${key}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${preset.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{preset.label}</span>
                            <Badge variant="outline" className="text-[10px]">{preset.patientName}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                        </div>
                        {evaluateMutation.isPending && isSelected ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator />

            <div data-testid="custom-event-section">
              <h3 className="text-sm font-semibold mb-3">Custom Clinical Event</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Trigger Type</Label>
                  <Select value={customTriggerType} onValueChange={setCustomTriggerType}>
                    <SelectTrigger data-testid="select-trigger-type">
                      <SelectValue placeholder="Select trigger..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diagnosis">Diagnosis</SelectItem>
                      <SelectItem value="status_change">Status Change</SelectItem>
                      <SelectItem value="lab_result">Lab Result</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="vitals">Vitals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Patient ID (optional)</Label>
                  <Input
                    value={customPatientId}
                    onChange={e => setCustomPatientId(e.target.value)}
                    placeholder="PT-2001"
                    data-testid="input-custom-patient-id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Event Data (JSON)</Label>
                  <Input
                    value={customData}
                    onChange={e => setCustomData(e.target.value)}
                    placeholder='{"diagnosis":"...","diagnosisCode":"..."}'
                    data-testid="input-custom-data"
                  />
                </div>
              </div>
              <Button
                className="mt-3"
                onClick={handleCustomEvaluate}
                disabled={!customTriggerType || evaluateMutation.isPending}
                data-testid="button-custom-evaluate"
              >
                {evaluateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Evaluate Auto-Fill
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {autoFillResults.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="empty-results">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No Auto-Fill Results Yet</p>
                <p className="text-sm mt-1">Simulate a clinical event to see pre-populated document matches.</p>
                <Button variant="secondary" className="mt-4" onClick={() => setActiveTab("simulate")} data-testid="button-go-simulate">
                  <Play className="h-4 w-4 mr-2" /> Go to Clinical Events
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold">Auto-Fill Results</h2>
                    <p className="text-sm text-muted-foreground">
                      {autoFillResults.length} document{autoFillResults.length !== 1 ? "s" : ""} pre-populated from the clinical event. Review and accept to proceed.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setAutoFillResults([])} data-testid="button-clear-results">
                    Clear All
                  </Button>
                </div>

                <div className="space-y-4" data-testid="results-list">
                  {autoFillResults.map((result) => (
                    <Card key={result.scenarioId} data-testid={`result-card-${result.scenarioId}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Bell className="h-4 w-4 text-muted-foreground" />
                              {result.prompt.title}
                            </CardTitle>
                            <CardDescription className="mt-1">{result.prompt.message}</CardDescription>
                          </div>
                          <Badge variant={priorityVariant(result.prompt.priority)} className="text-xs">
                            {result.prompt.priority}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <PrefilledFieldsPreview
                          fields={result.prefilledFields}
                          result={result}
                          onAccept={() => handleAcceptResult(result)}
                          onDismiss={() => handleDismissResult(result.scenarioId)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="editor" className="space-y-4">
            {!acceptedResult ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="no-document">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No Document Selected</p>
                <p className="text-sm mt-1">Accept an auto-fill result to start editing.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      {acceptedResult.targetDocumentTypeName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {confidenceBadge(acceptedResult.confidence)}
                      <Badge variant="outline" className="text-xs">
                        {acceptedResult.fieldsAutoFilled} auto-filled / {acceptedResult.totalFields} total
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        from scenario: {acceptedResult.scenarioName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleSaveDocument} disabled={saveDraftMutation.isPending} data-testid="button-save-document">
                      {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Draft
                    </Button>
                    <Button onClick={handleSendToGeneration} disabled={saveDraftMutation.isPending} data-testid="button-send-generation">
                      {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Generate with AI
                    </Button>
                  </div>
                </div>

                <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" data-testid="autofill-summary-alert">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-800 dark:text-green-200 text-sm">Fields Pre-Populated</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                    {acceptedResult.fieldsAutoFilled} of {acceptedResult.totalFields} fields were automatically filled from patient records and clinical event data. Green-highlighted fields are auto-filled. Review all values for accuracy.
                  </AlertDescription>
                </Alert>

                <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="review-warning">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">Clinician Review Required</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                    Auto-filled content is for convenience only. Verify all clinical data, especially medications and dosages, before finalizing.
                  </AlertDescription>
                </Alert>

                <Card data-testid="field-editor">
                  <CardContent className="pt-6">
                    <ScrollArea className="h-[500px] pr-2">
                      <div className="space-y-4">
                        {Object.entries(editedFields).map(([key, value]) => {
                          const isAutoFilled = key in acceptedResult.prefilledFields;
                          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                          const isLongField = value.length > 100;

                          return (
                            <div key={key} className="space-y-1.5" data-testid={`editor-field-${key}`}>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium">{label}</Label>
                                {isAutoFilled && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                    <Zap className="h-2.5 w-2.5 mr-0.5" /> Auto-filled
                                  </Badge>
                                )}
                              </div>
                              {isLongField ? (
                                <Textarea
                                  value={value}
                                  onChange={e => handleFieldEdit(key, e.target.value)}
                                  className={`text-sm resize-y min-h-[80px] ${isAutoFilled ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20" : ""}`}
                                  data-testid={`textarea-${key}`}
                                />
                              ) : (
                                <Input
                                  value={value}
                                  onChange={e => handleFieldEdit(key, e.target.value)}
                                  className={`text-sm ${isAutoFilled ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20" : ""}`}
                                  data-testid={`input-${key}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Active Auto-Fill Scenarios</h2>
              <p className="text-sm text-muted-foreground mt-1">
                These scenarios define which clinical events trigger automatic document pre-population. Each scenario maps patient data to document template fields.
              </p>
            </div>

            {scenariosLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3" data-testid="scenarios-list">
                {scenarios.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
                {scenarios.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No auto-fill scenarios configured.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: AutoFillScenario }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card data-testid={`scenario-card-${scenario.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="text-muted-foreground mt-0.5">
              {triggerIcon(scenario.triggerType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{scenario.name}</span>
                <Badge variant={priorityVariant(scenario.priority)} className="text-[10px]">
                  {scenario.priority}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {scenario.triggerType}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{scenario.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span>Target: <span className="font-medium">{scenario.targetDocumentTypeId}</span></span>
                <span>{scenario.fieldMappings.length} field mappings</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-scenario-${scenario.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2" data-testid={`scenario-details-${scenario.id}`}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Field Mappings</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {scenario.fieldMappings.map((mapping, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                    {mapping.sourceType}
                  </Badge>
                  <span className="text-muted-foreground">{mapping.sourceKey || mapping.computeFn || "static"}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">{mapping.targetField}</span>
                  <span className="text-muted-foreground truncate">— {mapping.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
