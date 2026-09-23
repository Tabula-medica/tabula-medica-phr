import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pill,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Sparkles,
  Flag,
  Merge,
  ChevronRight,
  ClipboardEdit,
  ThumbsUp,
  ThumbsDown,
  Clock,
} from "lucide-react";

type MedicationStatus = "taking" | "not_taking" | "unsure";

interface MedicationFlag {
  type: "wrong_dose" | "duplicate" | "discontinued" | "changed" | "other";
  description: string;
  suggestedCorrection?: string;
}

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescriber?: string;
  source: string;
  lastUpdated: string;
  status?: MedicationStatus;
  patientNotes?: string;
  flags?: MedicationFlag[];
}

interface MergeSuggestion {
  id: string;
  type: "duplicate" | "dose_conflict" | "frequency_conflict";
  medications: string[];
  medicationIds: string[];
  reason: string;
  suggestedAction: string;
  confidence: number;
}

interface ReconciliationResult {
  patientId: string;
  medications: MedicationEntry[];
  mergeSuggestions: MergeSuggestion[];
  summary: {
    total: number;
    taking: number;
    notTaking: number;
    unsure: number;
    flagged: number;
  };
  generatedAt: string;
}

const statusConfig = {
  taking: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Taking" },
  not_taking: { icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Not Taking" },
  unsure: { icon: HelpCircle, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Unsure" },
};

const flagTypeLabels: Record<string, string> = {
  wrong_dose: "Wrong Dose",
  duplicate: "Duplicate Entry",
  discontinued: "Should Be Removed",
  changed: "Details Changed",
  other: "Other Issue",
};

function MedicationCard({
  medication,
  onUpdate,
  isUpdating,
}: {
  medication: MedicationEntry;
  onUpdate: (id: string, status: MedicationStatus, notes?: string, flags?: MedicationFlag[]) => void;
  isUpdating: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<MedicationStatus>(medication.status || "unsure");
  const [notes, setNotes] = useState(medication.patientNotes || "");
  const [selectedFlags, setSelectedFlags] = useState<string[]>(
    medication.flags?.map(f => f.type) || []
  );

  const currentStatus = statusConfig[medication.status || "unsure"];
  const StatusIcon = currentStatus.icon;

  const handleSave = () => {
    const flags: MedicationFlag[] = selectedFlags.map(type => ({
      type: type as MedicationFlag["type"],
      description: flagTypeLabels[type],
    }));
    onUpdate(medication.id, status, notes || undefined, flags.length > 0 ? flags : undefined);
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-lg border" data-testid={`med-card-${medication.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${currentStatus.bg}`}>
            <StatusIcon className={`h-4 w-4 ${currentStatus.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{medication.name}</p>
            <p className="text-xs text-muted-foreground">{medication.dosage} - {medication.frequency}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{medication.source}</Badge>
              {medication.prescriber && (
                <span className="text-xs text-muted-foreground">by {medication.prescriber}</span>
              )}
            </div>
            {medication.flags && medication.flags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {medication.flags.map((flag, i) => (
                  <Badge key={i} variant="destructive" className="text-xs">
                    <Flag className="h-3 w-3 mr-1" />
                    {flagTypeLabels[flag.type]}
                  </Badge>
                ))}
              </div>
            )}
            {medication.patientNotes && (
              <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded italic">
                "{medication.patientNotes}"
              </p>
            )}
          </div>
        </div>
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid={`button-edit-med-${medication.id}`}>
              <ClipboardEdit className="h-3.5 w-3.5 mr-1" />
              Fix It
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update {medication.name}</DialogTitle>
              <DialogDescription>
                Let us know if this medication entry is correct
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <FieldCaption className="text-sm font-medium">Are you currently taking this?</FieldCaption>
                <RadioGroup
                  value={status}
                  onValueChange={(v) => setStatus(v as MedicationStatus)}
                  className="space-y-2"
                >
                  <div role="presentation" className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setStatus("taking")}>
                    <RadioGroupItem value="taking" id="taking" data-testid="radio-taking" />
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <Label htmlFor="taking" className="flex-1 cursor-pointer">Yes, I'm taking this</Label>
                  </div>
                  <div role="presentation" className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setStatus("not_taking")}>
                    <RadioGroupItem value="not_taking" id="not_taking" data-testid="radio-not-taking" />
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Label htmlFor="not_taking" className="flex-1 cursor-pointer">No, I'm not taking this</Label>
                  </div>
                  <div role="presentation" className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setStatus("unsure")}>
                    <RadioGroupItem value="unsure" id="unsure" data-testid="radio-unsure" />
                    <HelpCircle className="h-4 w-4 text-yellow-500" />
                    <Label htmlFor="unsure" className="flex-1 cursor-pointer">I'm not sure</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <FieldCaption className="text-sm font-medium">Is there a problem with this entry?</FieldCaption>
                <div className="space-y-2">
                  {Object.entries(flagTypeLabels).map(([type, label]) => (
                    <div key={type} className="flex items-center space-x-3 p-2 rounded-lg border">
                      <Checkbox aria-label="Is there a problem with this entry?"
                        id={`flag-${type}`}
                        checked={selectedFlags.includes(type)}
                        onCheckedChange={(checked) => {
                          setSelectedFlags(prev =>
                            checked ? [...prev, type] : prev.filter(f => f !== type)
                          );
                        }}
                        data-testid={`checkbox-flag-${type}`}
                      />
                      <Label htmlFor={`flag-${type}`} className="flex-1 cursor-pointer text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Additional notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., 'I stopped taking this 2 months ago' or 'The dose is now 20mg'"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                  data-testid="input-med-notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isUpdating} data-testid="button-save-med-update">
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function MergeSuggestionCard({
  suggestion,
  onAction,
  isProcessing,
}: {
  suggestion: MergeSuggestion;
  onAction: (id: string, action: "accept" | "reject" | "defer") => void;
  isProcessing: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const typeConfig = {
    duplicate: { icon: Merge, color: "text-blue-500", label: "Possible Duplicate" },
    dose_conflict: { icon: AlertTriangle, color: "text-orange-500", label: "Dose Conflict" },
    frequency_conflict: { icon: AlertTriangle, color: "text-yellow-500", label: "Frequency Conflict" },
  };

  const config = typeConfig[suggestion.type];
  const Icon = config.icon;

  return (
    <>
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5" data-testid={`merge-suggestion-${suggestion.id}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <span className="text-sm font-medium">{config.label}</span>
              <Badge variant="secondary" className="text-xs">
                {Math.round(suggestion.confidence * 100)}% confident
              </Badge>
            </div>
            <p className="text-sm">{suggestion.reason}</p>
            <div className="flex gap-1 flex-wrap">
              {suggestion.medications.map((med, i) => (
                <Badge key={i} variant="outline" className="text-xs">{med}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{suggestion.suggestedAction}</p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowConfirm(true)}
                disabled={isProcessing}
                data-testid={`button-accept-merge-${suggestion.id}`}
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                Looks Right
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(suggestion.id, "reject")}
                disabled={isProcessing}
                data-testid={`button-reject-merge-${suggestion.id}`}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                Not the Same
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction(suggestion.id, "defer")}
                disabled={isProcessing}
                data-testid={`button-defer-merge-${suggestion.id}`}
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm This Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will flag these entries for your healthcare provider to review and merge.
              You are not making any medical decisions - your provider will verify before making changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onAction(suggestion.id, "accept");
                setShowConfirm(false);
              }}
              data-testid="button-confirm-merge"
            >
              Yes, Flag for Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MedReconciliationFlow() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { data: reconciliation, isLoading, refetch } = useQuery<ReconciliationResult>({
    queryKey: ["/api/med-reconciliation"],
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      medicationId,
      status,
      notes,
      flags,
    }: {
      medicationId: string;
      status: MedicationStatus;
      notes?: string;
      flags?: MedicationFlag[];
    }) => {
      const response = await apiRequest("POST", "/api/med-reconciliation/update", {
        medicationId,
        status,
        notes,
        flags,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/med-reconciliation"] });
      toast({ title: "Updated", description: "Your medication status has been saved." });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ suggestionId, action }: { suggestionId: string; action: "accept" | "reject" | "defer" }) => {
      const response = await apiRequest("POST", "/api/med-reconciliation/merge", {
        suggestionId,
        action,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/med-reconciliation"] });
      toast({ title: "Done", description: data.message });
    },
  });

  const handleUpdate = (id: string, status: MedicationStatus, notes?: string, flags?: MedicationFlag[]) => {
    updateMutation.mutate({ medicationId: id, status, notes, flags });
  };

  const handleMergeAction = (id: string, action: "accept" | "reject" | "defer") => {
    mergeMutation.mutate({ suggestionId: id, action });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-med-reconciliation">
          <ClipboardEdit className="h-4 w-4" />
          My Med List is Wrong
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Fix Your Medication List
          </DialogTitle>
          <DialogDescription>
            Help us keep your medication list accurate. Review each medication and let us know if it's correct.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : reconciliation ? (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-muted/50">
                <div className="text-center">
                  <p className="text-2xl font-bold">{reconciliation.summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{reconciliation.summary.taking}</p>
                  <p className="text-xs text-muted-foreground">Taking</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{reconciliation.summary.notTaking}</p>
                  <p className="text-xs text-muted-foreground">Not Taking</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-500">{reconciliation.summary.unsure}</p>
                  <p className="text-xs text-muted-foreground">Unsure</p>
                </div>
              </div>

              {reconciliation.mergeSuggestions.length > 0 && (
                <Accordion type="single" collapsible defaultValue="suggestions">
                  <AccordionItem value="suggestions" className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Suggestions</span>
                        <Badge variant="secondary">{reconciliation.mergeSuggestions.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pb-2">
                        <p className="text-xs text-muted-foreground">
                          We found potential issues. Review and confirm - you're always in control.
                        </p>
                        {reconciliation.mergeSuggestions.map((suggestion) => (
                          <MergeSuggestionCard
                            key={suggestion.id}
                            suggestion={suggestion}
                            onAction={handleMergeAction}
                            isProcessing={mergeMutation.isPending}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Your Medications</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    data-testid="button-refresh-meds"
                  >
                    Refresh
                  </Button>
                </div>
                {reconciliation.medications.map((med) => (
                  <MedicationCard
                    key={med.id}
                    medication={med}
                    onUpdate={handleUpdate}
                    isUpdating={updateMutation.isPending}
                  />
                ))}
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">
                  Your updates will be flagged for your healthcare provider to review.
                  This helps ensure your medication list is accurate for safer care.
                </p>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No medications found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MedReconciliationCard() {
  return (
    <Card data-testid="card-med-reconciliation">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Medication List Accuracy</CardTitle>
        </div>
        <CardDescription>
          Help us keep your medication list up-to-date for safer care
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg border border-dashed">
          <div className="space-y-1">
            <p className="text-sm font-medium">Is your medication list correct?</p>
            <p className="text-xs text-muted-foreground">
              Review and update your medications to ensure accuracy
            </p>
          </div>
          <MedReconciliationFlow />
        </div>
      </CardContent>
    </Card>
  );
}
