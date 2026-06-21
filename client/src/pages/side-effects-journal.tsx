import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  Loader2,
  Pill,
  Plus,
  User,
  Activity,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import type {
  MedicationEntry,
  SymptomEntry,
  SymptomType,
  SeverityLevel,
} from "@shared/schema";
import {
  symptomTypes,
  symptomTypeLabels,
  severityLevels,
  severityLabels,
} from "@shared/schema";

export default function SideEffectsJournal() {
  const [selectedMedication, setSelectedMedication] = useState<MedicationEntry | null>(null);
  const [showAddMedicationDialog, setShowAddMedicationDialog] = useState(false);
  const [showAddSymptomDialog, setShowAddSymptomDialog] = useState(false);
  const [showActiveMedsOnly, setShowActiveMedsOnly] = useState(true);
  const { toast } = useToast();

  const { data: medications, isLoading: loadingMeds } = useQuery<MedicationEntry[]>({
    queryKey: ["/api/side-effects/medications", showActiveMedsOnly ? "active=true" : ""],
  });

  const { data: symptoms } = useQuery<SymptomEntry[]>({
    queryKey: ["/api/side-effects/medications", selectedMedication?.id, "symptoms"],
    enabled: !!selectedMedication,
  });

  const { data: summary } = useQuery<{
    totalActiveMedications: number;
    totalOngoingSymptoms: number;
    medicationsWithSymptoms: Array<{
      medication: MedicationEntry;
      totalSymptoms: number;
      ongoingSymptoms: number;
      symptoms: SymptomEntry[];
    }>;
  }>({
    queryKey: ["/api/side-effects/summary"],
  });

  const severityColors: Record<SeverityLevel, string> = {
    mild: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    moderate: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
    severe: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
  };

  const improvesIcons = {
    yes: <CheckCircle className="h-4 w-4 text-green-500" />,
    no: <XCircle className="h-4 w-4 text-red-500" />,
    unknown: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> This journal helps you track symptoms you experience while taking medications. 
          Always discuss symptoms with your healthcare provider.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Side Effects Journal
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track symptoms you experience while taking medications
          </p>
        </div>
        <Button onClick={() => setShowAddMedicationDialog(true)} data-testid="button-add-medication">
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalActiveMedications}</div>
              <p className="text-sm text-muted-foreground">Active Medications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.totalOngoingSymptoms}</div>
              <p className="text-sm text-muted-foreground">Ongoing Symptoms</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-80 shrink-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Medications
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={showActiveMedsOnly}
                onCheckedChange={setShowActiveMedsOnly}
                id="active-only"
                data-testid="switch-active-meds"
              />
              <Label htmlFor="active-only" className="text-sm">Active only</Label>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {loadingMeds ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : medications && medications.length > 0 ? (
              <div className="space-y-1">
                {medications.map((med) => {
                  const medSymptoms = summary?.medicationsWithSymptoms.find(
                    (m) => m.medication.id === med.id
                  );
                  return (
                    <button
                      key={med.id}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedMedication?.id === med.id
                          ? "bg-primary/10 border-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSelectedMedication(med)}
                      data-testid={`button-med-${med.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{med.medicationName}</p>
                          <p className="text-sm text-muted-foreground">{med.dose}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!med.isActive && (
                            <Badge variant="outline" className="text-xs">Stopped</Badge>
                          )}
                          {medSymptoms && medSymptoms.ongoingSymptoms > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {medSymptoms.ongoingSymptoms}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Pill className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No medications added</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddMedicationDialog(true)}
                  data-testid="button-add-first-med"
                >
                  Add First Medication
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4">
          {selectedMedication ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {selectedMedication.medicationName}
                        {!selectedMedication.isActive && (
                          <Badge variant="outline">Stopped</Badge>
                        )}
                      </CardTitle>
                      {selectedMedication.genericName && (
                        <CardDescription>{selectedMedication.genericName}</CardDescription>
                      )}
                    </div>
                    <Button
                      onClick={() => setShowAddSymptomDialog(true)}
                      data-testid="button-add-symptom"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Log Symptom
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Dose</p>
                      <p className="font-medium">{selectedMedication.dose}</p>
                    </div>
                    {selectedMedication.frequency && (
                      <div>
                        <p className="text-muted-foreground">Frequency</p>
                        <p className="font-medium">{selectedMedication.frequency}</p>
                      </div>
                    )}
                    {selectedMedication.indication && (
                      <div>
                        <p className="text-muted-foreground">Indication</p>
                        <p className="font-medium">{selectedMedication.indication}</p>
                      </div>
                    )}
                    {selectedMedication.prescriber && (
                      <div>
                        <p className="text-muted-foreground">Prescriber</p>
                        <p className="font-medium">{selectedMedication.prescriber}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {new Date(selectedMedication.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedMedication.stopDate && (
                      <div>
                        <p className="text-muted-foreground">Stop Date</p>
                        <p className="font-medium">
                          {new Date(selectedMedication.stopDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedMedication.notes && (
                    <>
                      <Separator className="my-4" />
                      <p className="text-sm text-muted-foreground">{selectedMedication.notes}</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Reported symptoms while taking {selectedMedication.medicationName}
                  </CardTitle>
                  <CardDescription>
                    These are symptoms you've logged during this medication period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {symptoms && symptoms.length > 0 ? (
                    <div className="space-y-3">
                      {symptoms.map((symptom) => (
                        <div
                          key={symptom.id}
                          className="p-4 rounded-lg border"
                          data-testid={`symptom-${symptom.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {symptom.symptomType === "other" && symptom.customSymptomName
                                    ? symptom.customSymptomName
                                    : symptomTypeLabels[symptom.symptomType]}
                                </span>
                                <Badge className={severityColors[symptom.severity as SeverityLevel] || ""}>
                                  {severityLabels[symptom.severity as SeverityLevel] || symptom.severity}
                                </Badge>
                                {symptom.isOngoing ? (
                                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                                    Ongoing
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-500/30">
                                    Resolved
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Started: {new Date(symptom.startDate).toLocaleDateString()}
                                </span>
                                {symptom.endDate && (
                                  <span>
                                    Ended: {new Date(symptom.endDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-sm">
                                <span className="text-muted-foreground">Improves after dose?</span>
                                {improvesIcons[symptom.improvesAfterDose]}
                                <span className="capitalize">{symptom.improvesAfterDose}</span>
                              </div>
                              {symptom.notes && (
                                <p className="mt-2 text-sm text-muted-foreground">{symptom.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No symptoms logged for this medication</p>
                      <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => setShowAddSymptomDialog(true)}
                        data-testid="button-log-first-symptom"
                      >
                        Log First Symptom
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Medication</h3>
                <p className="text-muted-foreground">
                  Choose a medication from the list to view and log symptoms
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AddMedicationDialog
        open={showAddMedicationDialog}
        onOpenChange={setShowAddMedicationDialog}
      />

      {selectedMedication && (
        <AddSymptomDialog
          open={showAddSymptomDialog}
          onOpenChange={setShowAddSymptomDialog}
          medication={selectedMedication}
        />
      )}
    </div>
  );
}

function AddMedicationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [medicationName, setMedicationName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [indication, setIndication] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/side-effects/medications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects/summary"] });
      toast({ title: "Medication added", description: "Your medication has been saved." });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setMedicationName("");
    setGenericName("");
    setDose("");
    setFrequency("");
    setIndication("");
    setPrescriber("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Medication</DialogTitle>
          <DialogDescription>
            Add a medication to track symptoms you experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="med-name">Medication Name *</Label>
            <Input
              id="med-name"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="e.g., Tamoxifen"
              data-testid="input-med-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="generic-name">Generic Name (optional)</Label>
            <Input
              id="generic-name"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="e.g., Tamoxifen Citrate"
              data-testid="input-generic-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dose">Dose *</Label>
              <Input
                id="dose"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="e.g., 20mg"
                data-testid="input-dose"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g., Once daily"
                data-testid="input-frequency"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="indication">Indication (reason for taking)</Label>
            <Input
              id="indication"
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="e.g., Breast cancer hormone therapy"
              data-testid="input-indication"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescriber">Prescriber</Label>
            <Input
              id="prescriber"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
              placeholder="e.g., Dr. Smith"
              data-testid="input-prescriber"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date *</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-start-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-notes">Notes (optional)</Label>
            <Textarea
              id="med-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              data-testid="input-med-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-cancel-med">
            Cancel
          </Button>
          <Button
            onClick={() => {
              addMutation.mutate({
                profileId: "profile-default",
                medicationName,
                genericName: genericName || undefined,
                dose,
                frequency: frequency || undefined,
                indication: indication || undefined,
                prescriber: prescriber || undefined,
                startDate,
                isActive: true,
                notes: notes || undefined,
              });
            }}
            disabled={addMutation.isPending || !medicationName || !dose || !startDate}
            data-testid="button-submit-med"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Medication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSymptomDialog({
  open,
  onOpenChange,
  medication,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: MedicationEntry;
}) {
  const [symptomType, setSymptomType] = useState<SymptomType>("fatigue");
  const [customSymptomName, setCustomSymptomName] = useState("");
  const [severity, setSeverity] = useState<SeverityLevel>("mild");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [improvesAfterDose, setImprovesAfterDose] = useState<"yes" | "no" | "unknown">("unknown");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/side-effects/symptoms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects/medications", medication.id, "symptoms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/side-effects/summary"] });
      toast({ title: "Symptom logged", description: "Your symptom entry has been saved." });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSymptomType("fatigue");
    setCustomSymptomName("");
    setSeverity("mild");
    setStartDate(new Date().toISOString().split("T")[0]);
    setImprovesAfterDose("unknown");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Symptom</DialogTitle>
          <DialogDescription>
            Record a symptom you're experiencing while taking {medication.medicationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="symptom-type">Symptom *</Label>
            <Select value={symptomType} onValueChange={(v) => setSymptomType(v as SymptomType)}>
              <SelectTrigger data-testid="select-symptom-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symptomTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {symptomTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {symptomType === "other" && (
            <div className="space-y-2">
              <Label htmlFor="custom-symptom">Describe symptom</Label>
              <Input
                id="custom-symptom"
                value={customSymptomName}
                onChange={(e) => setCustomSymptomName(e.target.value)}
                placeholder="e.g., Hot flashes"
                data-testid="input-custom-symptom"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="severity">Severity *</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityLevel)}>
              <SelectTrigger data-testid="select-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severityLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {severityLabels[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptom-start">Start Date *</Label>
            <Input
              id="symptom-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-symptom-start"
            />
          </div>

          <div className="space-y-2">
            <Label>Improves after dose?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={improvesAfterDose === "yes" ? "default" : "outline"}
                size="sm"
                onClick={() => setImprovesAfterDose("yes")}
                data-testid="button-improves-yes"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={improvesAfterDose === "no" ? "default" : "outline"}
                size="sm"
                onClick={() => setImprovesAfterDose("no")}
                data-testid="button-improves-no"
              >
                No
              </Button>
              <Button
                type="button"
                variant={improvesAfterDose === "unknown" ? "default" : "outline"}
                size="sm"
                onClick={() => setImprovesAfterDose("unknown")}
                data-testid="button-improves-unknown"
              >
                Not sure
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptom-notes">Notes (optional)</Label>
            <Textarea
              id="symptom-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe how this symptom affects you..."
              rows={3}
              data-testid="input-symptom-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-cancel-symptom">
            Cancel
          </Button>
          <Button
            onClick={() => {
              addMutation.mutate({
                profileId: "profile-default",
                medicationId: medication.id,
                symptomType,
                customSymptomName: symptomType === "other" ? customSymptomName : undefined,
                severity,
                startDate,
                isOngoing: true,
                improvesAfterDose,
                notes: notes || undefined,
              });
            }}
            disabled={addMutation.isPending || !symptomType || !severity || !startDate}
            data-testid="button-submit-symptom"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log Symptom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
