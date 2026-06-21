import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CheckCircle,
  Edit3,
  Save,
  AlertTriangle,
  Loader2,
  Shield,
  ShieldCheck,
  Activity,
  Pill,
  FlaskConical,
  Heart,
  Stethoscope,
  FileText,
  Clock,
  X,
  ChevronLeft,
  Eye,
  Hash,
  AlertCircle,
  Syringe,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";

const API_BASE = "/api/discharge-review";

interface ClinicalContext {
  conditions: Array<{ name: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  recentLabs: Array<{ name: string; value: string; unit: string; date: string; status: string }>;
  vitals: Array<{ type: string; value: string; date: string }>;
  procedures: string[];
  allergies: string[];
}

interface CodeSuggestion {
  type: string;
  code: string;
  description: string;
  confidence: string;
}

interface EncounterDraft {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate: string;
  primaryDiagnosis: string;
  aiDraftNote: string;
  aiDraftStatus: "GENERATING" | "READY_FOR_REVIEW" | "EDITING" | "APPROVED" | "REJECTED";
  clinicalContext: ClinicalContext;
  codeSuggestions?: CodeSuggestion[];
  signedBy?: string;
  signedAt?: string;
  signatureHash?: string;
  createdAt: string;
  updatedAt: string;
}

interface DraftListItem {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  primaryDiagnosis: string;
  aiDraftStatus: string;
  admissionDate: string;
  dischargeDate: string;
  createdAt: string;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED": return "default";
    case "REJECTED": return "destructive";
    case "EDITING": return "secondary";
    default: return "outline";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function labStatusColor(status: string): string {
  switch (status) {
    case "abnormal": return "text-red-600 dark:text-red-400 font-semibold";
    case "critical": return "text-red-700 dark:text-red-300 font-bold";
    case "borderline": return "text-amber-600 dark:text-amber-400 font-medium";
    default: return "text-foreground";
  }
}

function ContextSidebar({ context, codeSuggestions }: { context: ClinicalContext; codeSuggestions?: CodeSuggestion[] }) {
  return (
    <div className="space-y-4" data-testid="clinical-context-sidebar">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            Active Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {context.conditions.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-1 text-sm" data-testid={`condition-${i}`}>
              <span>{c.name}</span>
              <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                {c.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            Medications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {context.medications.map((m, i) => (
              <div key={i} className="text-sm" data-testid={`medication-${i}`}>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground"> {m.dosage} {m.frequency}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Recent Labs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {context.recentLabs.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-1 text-sm" data-testid={`lab-${i}`}>
                <span>{l.name}</span>
                <span className={labStatusColor(l.status)}>
                  {l.value} {l.unit}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Vitals at Discharge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {context.vitals.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-1 text-sm" data-testid={`vital-${i}`}>
                <span className="text-muted-foreground">{v.type}</span>
                <span className="font-medium">{v.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Syringe className="h-4 w-4 text-muted-foreground" />
            Procedures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {context.procedures.map((p, i) => (
              <div key={i} data-testid={`procedure-${i}`}>{p}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Allergies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {context.allergies.map((a, i) => (
              <Badge key={i} variant="destructive" className="text-xs" data-testid={`allergy-${i}`}>
                {a}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {codeSuggestions && codeSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Suggested Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {codeSuggestions.map((c, i) => (
                <div key={i} className="text-sm" data-testid={`code-suggestion-${i}`}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-mono">
                      {c.type}: {c.code}
                    </Badge>
                    <Badge variant={c.confidence === "high" ? "default" : "secondary"} className="text-xs">
                      {c.confidence}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">{c.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DraftReviewView({ encounterId }: { encounterId: string }) {
  const [editedNote, setEditedNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const { data: draft, isLoading, error, refetch } = useQuery<EncounterDraft>({
    queryKey: ["/api/discharge-review/encounters", encounterId, "ai-draft"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/encounters/${encounterId}/ai-draft`);
      if (!res.ok) throw new Error("Failed to load draft");
      return res.json();
    },
  });

  useEffect(() => {
    if (draft?.aiDraftNote) {
      setEditedNote(draft.aiDraftNote);
    }
  }, [draft?.aiDraftNote]);

  const saveMutation = useMutation({
    mutationFn: async (draftNote: string) => {
      const res = await apiRequest("PUT", `${API_BASE}/encounters/${encounterId}/save-draft`, { draftNote });
      return res.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-review/encounters", encounterId, "ai-draft"] });
      toast({ title: "Draft saved", description: "Your edits have been saved." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save draft. Please try again.", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (finalizedNote: string) => {
      const res = await apiRequest("POST", `${API_BASE}/encounters/${encounterId}/approve-note`, {
        finalizedNote,
        signedBy: "Dr. Current Provider",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-review/encounters", encounterId, "ai-draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-review/drafts"] });
      toast({
        title: "Note Approved & Signed",
        description: `Signature hash: ${data.signatureHash?.slice(0, 12)}... Patient-friendly version will be generated.`,
      });
    },
    onError: () => {
      toast({ title: "Approval failed", description: "Could not approve note. Please try again.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${API_BASE}/encounters/${encounterId}/reject-note`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-review/encounters", encounterId, "ai-draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-review/drafts"] });
      toast({ title: "Draft rejected", description: "The AI draft has been rejected. A new draft can be requested." });
    },
  });

  const handleNoteChange = useCallback((value: string) => {
    setEditedNote(value);
    setHasUnsavedChanges(true);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <Alert variant="destructive" className="m-6" data-testid="error-alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Draft</AlertTitle>
        <AlertDescription>Could not load the discharge summary draft. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const isApproved = draft.aiDraftStatus === "APPROVED";
  const isRejected = draft.aiDraftStatus === "REJECTED";

  return (
    <div className="space-y-4" data-testid="discharge-review-view">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="draft-title">AI Discharge Summary Draft</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={statusVariant(draft.aiDraftStatus)} data-testid="draft-status">
              {statusLabel(draft.aiDraftStatus)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {draft.primaryDiagnosis}
            </span>
            <span className="text-sm text-muted-foreground">
              {draft.admissionDate} — {draft.dischargeDate}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isApproved && !isRejected && (
            <>
              {!isEditing ? (
                <Button variant="secondary" onClick={() => setIsEditing(true)} data-testid="button-edit">
                  <Edit3 className="h-4 w-4 mr-2" /> Edit Draft
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        saveMutation.mutate(editedNote);
                      }
                      setIsEditing(false);
                    }}
                    data-testid="button-preview"
                  >
                    <Eye className="h-4 w-4 mr-2" /> Preview
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => saveMutation.mutate(editedNote)}
                    disabled={saveMutation.isPending || !hasUnsavedChanges}
                    data-testid="button-save"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Draft
                  </Button>
                </>
              )}
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                data-testid="button-reject"
              >
                <X className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button
                onClick={() => approveMutation.mutate(editedNote)}
                disabled={approveMutation.isPending}
                data-testid="button-approve"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve & Sign
              </Button>
            </>
          )}
          {isApproved && (
            <div className="flex items-center gap-2 text-sm" data-testid="signature-info">
              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-muted-foreground">
                Signed by {draft.signedBy} on {draft.signedAt ? new Date(draft.signedAt).toLocaleDateString() : "N/A"}
              </span>
              {draft.signatureHash && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs font-mono">
                        {draft.signatureHash.slice(0, 8)}...
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs">Hash: {draft.signatureHash}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="safety-warning">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">AI-Generated Draft — Clinician Review Required</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          Please verify all medication dosages, follow-up dates, and allergy considerations before signing. This is an informational tool only and does not constitute clinical decision support.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2" data-testid="draft-content-area">
          {isEditing && !isApproved ? (
            <Textarea
              value={editedNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              className="min-h-[600px] font-mono text-sm resize-y"
              data-testid="textarea-draft"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ScrollArea className="h-[600px]">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="draft-preview">
                    {editedNote || draft.aiDraftNote}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {hasUnsavedChanges && !isApproved && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span>You have unsaved changes</span>
            </div>
          )}
        </div>

        <div className="space-y-4" data-testid="context-panel">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Clinical Context (Spot-Check)</h3>
          </div>
          <ScrollArea className="h-[600px] pr-2">
            <ContextSidebar
              context={draft.clinicalContext}
              codeSuggestions={draft.codeSuggestions}
            />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

export default function ClinicianDischargeReview() {
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: draftsData, isLoading: draftsLoading } = useQuery<{ drafts: DraftListItem[] }>({
    queryKey: ["/api/discharge-review/drafts"],
  });

  if (selectedEncounterId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedEncounterId(null)}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Queue
          </Button>
          <DraftReviewView encounterId={selectedEncounterId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="discharge-review-page">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Discharge Summary Review</h1>
          <p className="text-muted-foreground mt-1">
            Review and sign AI-generated discharge summaries. Each draft requires clinician verification before finalization.
          </p>
        </div>

        <Alert data-testid="hitrust-notice">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle className="text-sm">HITRUST & SOC 2 Compliant Workflow</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            All AI drafts go through mandatory human-in-the-loop review. Approved notes are cryptographically signed and logged to the immutable audit trail.
          </AlertDescription>
        </Alert>

        {draftsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3" data-testid="drafts-list">
            {(draftsData?.drafts || []).map((d) => (
              <Card
                key={d.id}
                className="cursor-pointer transition-colors hover:bg-accent/30"
                onClick={() => setSelectedEncounterId(d.encounterId)}
                data-testid={`draft-card-${d.encounterId}`}
              >
                <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{d.patientName}</span>
                      <Badge variant={statusVariant(d.aiDraftStatus)} className="text-xs">
                        {statusLabel(d.aiDraftStatus)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {d.primaryDiagnosis}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {d.admissionDate} — {d.dischargeDate}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180 flex-shrink-0" />
                </CardContent>
              </Card>
            ))}

            {(!draftsData?.drafts || draftsData.drafts.length === 0) && (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No discharge drafts pending</p>
                <p className="text-sm mt-1">AI-generated drafts will appear here when discharge events are triggered.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
