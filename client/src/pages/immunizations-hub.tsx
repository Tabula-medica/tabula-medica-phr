import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Info,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Syringe,
  Upload,
  XCircle,
} from "lucide-react";

interface VaccineSeriesStatus {
  id: string;
  patientId: string;
  profileId: string;
  vaccineGroup: string;
  seriesName: string;
  status: "up_to_date" | "due_soon" | "overdue" | "unknown" | "not_applicable";
  dosesRequired: number;
  dosesReceived: number;
  nextDoseNumber?: number;
  nextDueDate?: string;
  overdueSince?: string;
  completedDate?: string;
  ruleVersion: string;
  scheduleSource: string;
  lastEvaluatedAt: string;
  confidence: "high" | "medium" | "low" | "unknown";
  requiresClinicianReview: boolean;
  reviewReason?: string;
}

interface ImmunizationEvent {
  id: string;
  patientId: string;
  profileId: string;
  vaccineCode: string;
  vaccineName: string;
  vaccineGroup: string;
  dateAdministered: string;
  lotNumber?: string;
  performer?: string;
  location?: string;
  source: string;
  confidence: string;
  verified: boolean;
  verifiedBy?: string;
}

interface FHIRImportSource {
  id: string;
  name: string;
  supported: boolean;
  fhirVersion: string;
}

interface ImportConflict {
  id: string;
  fhirResourceId: string;
  existingEventId: string;
  conflictType: "duplicate" | "date_mismatch" | "code_mismatch" | "partial_match";
  fhirData: Partial<ImmunizationEvent>;
  existingData: Partial<ImmunizationEvent>;
  resolution: "skip" | "merge" | "override" | "pending";
}

interface RiskFlag {
  id: string;
  label: string;
  description: string;
}

interface VaccineSummary {
  statuses: VaccineSeriesStatus[];
  summary: { upToDate: number; dueSoon: number; overdue: number; unknown: number };
  nextDue: VaccineSeriesStatus[];
  disclaimer: string;
}

const SAMPLE_PATIENT_ID = "patient-1";
const SAMPLE_PROFILE_ID = "profile-1";
const SAMPLE_BIRTH_DATE = "1985-06-15";

export default function ImmunizationsHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("summary");
  const [selectedRiskFlags, setSelectedRiskFlags] = useState<string[]>([]);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [fhirImportOpen, setFhirImportOpen] = useState(false);
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [newRecord, setNewRecord] = useState({
    vaccineCode: "",
    vaccineName: "",
    vaccineGroup: "",
    dateAdministered: "",
    lotNumber: "",
    performer: "",
    location: "",
  });

  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery<VaccineSummary>({
    queryKey: ["/api/vaccines/summary", SAMPLE_PATIENT_ID, SAMPLE_PROFILE_ID, SAMPLE_BIRTH_DATE],
    queryFn: async () => {
      const res = await fetch(`/api/vaccines/summary/${SAMPLE_PATIENT_ID}/${SAMPLE_PROFILE_ID}?birthDate=${SAMPLE_BIRTH_DATE}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: immunizationsData, isLoading: immunizationsLoading } = useQuery<{ events: ImmunizationEvent[] }>({
    queryKey: ["/api/vaccines/immunizations", SAMPLE_PATIENT_ID, SAMPLE_PROFILE_ID],
  });

  const { data: riskFlagsData } = useQuery<{ riskFlags: { flags: string[] } | null; availableFlags: RiskFlag[] }>({
    queryKey: ["/api/vaccines/risk-flags", SAMPLE_PATIENT_ID, SAMPLE_PROFILE_ID],
  });

  const { data: vaccineGroupsData } = useQuery<{ groups: string[] }>({
    queryKey: ["/api/vaccines/vaccine-groups"],
  });

  const { data: fhirSourcesData } = useQuery<{ sources: FHIRImportSource[] }>({
    queryKey: ["/api/vaccines/fhir-import/sources"],
  });

  const addImmunizationMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      const response = await fetch("/api/vaccines/immunizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          patientId: SAMPLE_PATIENT_ID,
          profileId: SAMPLE_PROFILE_ID,
          source: "patient_entered",
          confidence: "medium",
          verified: false,
          evidenceFileIds: [],
        }),
      });
      if (!response.ok) throw new Error("Failed to add immunization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines"] });
      setAddRecordOpen(false);
      setNewRecord({ vaccineCode: "", vaccineName: "", vaccineGroup: "", dateAdministered: "", lotNumber: "", performer: "", location: "" });
      toast({ title: "Record Added", description: "Immunization record has been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add immunization record", variant: "destructive" });
    },
  });

  const updateRiskFlagsMutation = useMutation({
    mutationFn: async (flags: string[]) => {
      const response = await fetch(`/api/vaccines/risk-flags/${SAMPLE_PATIENT_ID}/${SAMPLE_PROFILE_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      });
      if (!response.ok) throw new Error("Failed to update risk flags");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines"] });
      toast({ title: "Risk Flags Updated", description: "Your health conditions have been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update risk flags", variant: "destructive" });
    },
  });

  const fhirImportMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch("/api/vaccines/fhir-import/ehr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: `conn-${sourceId}`,
          patientId: SAMPLE_PATIENT_ID,
          profileId: SAMPLE_PROFILE_ID,
          patientFhirId: "fhir-patient-123",
          accessToken: "access-token",
          fhirServerUrl: `https://fhir.${sourceId}.com/R4`,
          ehrName: sourceId,
        }),
      });
      if (!response.ok) throw new Error("Failed to import from FHIR");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines"] });
      setFhirImportOpen(false);
      if (data.conflicts && data.conflicts.length > 0) {
        setImportConflicts(data.conflicts);
        toast({
          title: "Import Complete with Conflicts",
          description: `Imported ${data.imported} records. ${data.conflicts.length} conflicts need review.`,
        });
      } else {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.imported} immunization records. ${data.duplicates} duplicates skipped.`,
        });
      }
    },
    onError: () => {
      toast({ title: "Import Failed", description: "Failed to import immunization records", variant: "destructive" });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ conflict, resolution }: { conflict: ImportConflict; resolution: "skip" | "merge" | "override" }) => {
      const response = await fetch("/api/vaccines/fhir-import/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflict, resolution }),
      });
      if (!response.ok) throw new Error("Failed to resolve conflict");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccines"] });
      setImportConflicts((prev) => prev.filter((c) => c.id !== variables.conflict.id));
      toast({ title: "Conflict Resolved", description: "The import conflict has been resolved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve conflict", variant: "destructive" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "up_to_date":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "due_soon":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "up_to_date":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Up to Date</Badge>;
      case "due_soon":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Due Soon</Badge>;
      case "overdue":
        return <Badge variant="destructive">May Be Past Due</Badge>;
      case "unknown":
        return <Badge variant="secondary">Unknown</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge variant="outline" className="text-green-600 border-green-300">High Confidence</Badge>;
      case "medium":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Medium Confidence</Badge>;
      case "low":
        return <Badge variant="outline" className="text-red-600 border-red-300">Low Confidence</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getSourceBadge = (event: ImmunizationEvent) => {
    if (event.source === "fhir") {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <Shield className="h-3 w-3 mr-1" />
          Verified by FHIR
        </Badge>
      );
    }
    if (event.source === "iis") {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
          <Shield className="h-3 w-3 mr-1" />
          State IIS
        </Badge>
      );
    }
    if (event.source === "ehr") {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300">
          <Link2 className="h-3 w-3 mr-1" />
          EHR
        </Badge>
      );
    }
    if (event.verified) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    const sourceLabels: Record<string, string> = {
      patient_entered: "Self-Reported",
      pharmacy: "Pharmacy",
      document_scan: "Document Scan",
    };
    return <Badge variant="outline">{sourceLabels[event.source] || event.source.replace("_", " ")}</Badge>;
  };

  const handleAddRecord = () => {
    if (!newRecord.vaccineGroup || !newRecord.dateAdministered) {
      toast({ title: "Missing Information", description: "Please select a vaccine and enter the date", variant: "destructive" });
      return;
    }
    addImmunizationMutation.mutate(newRecord);
  };

  const handleSaveRiskFlags = () => {
    updateRiskFlagsMutation.mutate(selectedRiskFlags);
  };

  useEffect(() => {
    if (riskFlagsData?.riskFlags?.flags) {
      setSelectedRiskFlags(riskFlagsData.riskFlags.flags);
    }
  }, [riskFlagsData?.riskFlags?.flags]);

  const getRiskFlagLabel = (flagId: string): string => {
    return riskFlagsData?.availableFlags?.find(f => f.id === flagId)?.label || flagId;
  };

  const getRiskFlagImpact = (flagId: string): { vaccines: string[]; note: string } => {
    const impacts: Record<string, { vaccines: string[]; note: string }> = {
      pregnancy: { vaccines: ["Tdap", "Influenza", "COVID-19", "RSV"], note: "Some live vaccines contraindicated; Tdap recommended each pregnancy" },
      immunocompromised: { vaccines: ["Pneumococcal", "Influenza", "Shingrix"], note: "May need additional doses; avoid live vaccines" },
      chronic_heart: { vaccines: ["Influenza", "Pneumococcal", "COVID-19"], note: "Annual flu shot strongly recommended" },
      chronic_lung: { vaccines: ["Influenza", "Pneumococcal", "COVID-19"], note: "Annual flu shot strongly recommended" },
      chronic_liver: { vaccines: ["Hepatitis A", "Hepatitis B", "Pneumococcal"], note: "Hepatitis vaccines highly recommended" },
      chronic_kidney: { vaccines: ["Hepatitis B", "Pneumococcal", "Influenza"], note: "May need additional Hep B doses" },
      diabetes: { vaccines: ["Hepatitis B", "Influenza", "Pneumococcal", "COVID-19"], note: "Hepatitis B recommended for adults" },
      asplenia: { vaccines: ["Pneumococcal", "Meningococcal", "Hib"], note: "Enhanced protection against encapsulated bacteria needed" },
      cochlear_implant: { vaccines: ["Pneumococcal", "Meningococcal"], note: "Increased risk of meningitis" },
      csf_leak: { vaccines: ["Pneumococcal", "Meningococcal"], note: "Increased risk of meningitis" },
      smoker: { vaccines: ["Pneumococcal", "Influenza"], note: "Pneumococcal vaccine recommended regardless of age" },
      long_term_care: { vaccines: ["Influenza", "Pneumococcal", "COVID-19"], note: "Annual vaccinations strongly recommended" },
      healthcare_worker: { vaccines: ["Hepatitis B", "Influenza", "Tdap", "MMR", "Varicella"], note: "Occupational exposure protection" },
      travel: { vaccines: ["Hepatitis A", "Typhoid", "Yellow Fever", "Meningococcal"], note: "Depends on travel destination" },
    };
    return impacts[flagId] || { vaccines: [], note: "" };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Immunizations</h1>
          <p className="text-muted-foreground">
            Track your vaccination history and upcoming immunizations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" data-testid="button-export-records">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Dialog open={fhirImportOpen} onOpenChange={setFhirImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-fhir-import">
                <RefreshCw className="h-4 w-4 mr-2" />
                Import from EHR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Import from Healthcare Provider
                </DialogTitle>
                <DialogDescription>
                  Connect to your healthcare provider to import your immunization records via Fasten Health
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Records imported via FHIR are marked as "Verified by FHIR" and have high confidence.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Select Healthcare Provider</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {fhirSourcesData?.sources?.map((source) => (
                      <Button
                        key={source.id}
                        variant="outline"
                        className="justify-between h-auto py-3"
                        onClick={() => fhirImportMutation.mutate(source.id)}
                        disabled={fhirImportMutation.isPending || !source.supported}
                        data-testid={`button-import-${source.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4" />
                          <span>{source.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            FHIR {source.fhirVersion}
                          </Badge>
                          {fhirImportMutation.isPending && fhirImportMutation.variables === source.id && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFhirImportOpen(false)}>Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addRecordOpen} onOpenChange={setAddRecordOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-record">
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Immunization Record</DialogTitle>
                <DialogDescription>
                  Enter details about a vaccination you received
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Vaccine Type</Label>
                  <Select
                    value={newRecord.vaccineGroup}
                    onValueChange={(value) => setNewRecord({ ...newRecord, vaccineGroup: value, vaccineName: value })}
                  >
                    <SelectTrigger data-testid="select-vaccine-type">
                      <SelectValue placeholder="Select vaccine" />
                    </SelectTrigger>
                    <SelectContent>
                      {vaccineGroupsData?.groups?.map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Administered</Label>
                  <Input
                    type="date"
                    value={newRecord.dateAdministered}
                    onChange={(e) => setNewRecord({ ...newRecord, dateAdministered: e.target.value })}
                    data-testid="input-date-administered"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lot Number (optional)</Label>
                  <Input
                    value={newRecord.lotNumber}
                    onChange={(e) => setNewRecord({ ...newRecord, lotNumber: e.target.value })}
                    placeholder="e.g., ABC123"
                    data-testid="input-lot-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provider/Location (optional)</Label>
                  <Input
                    value={newRecord.performer}
                    onChange={(e) => setNewRecord({ ...newRecord, performer: e.target.value })}
                    placeholder="e.g., CVS Pharmacy, Dr. Smith"
                    data-testid="input-performer"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRecordOpen(false)}>Cancel</Button>
                <Button onClick={handleAddRecord} disabled={addImmunizationMutation.isPending} data-testid="button-save-record">
                  {addImmunizationMutation.isPending ? "Saving..." : "Save Record"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {summaryError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load immunization data.</AlertDescription>
        </Alert>
      )}

      {importConflicts.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-5 w-5" />
              Import Conflicts Detected
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              {importConflicts.length} record(s) need your review before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {importConflicts.map((conflict) => (
                <div key={conflict.id} className="p-3 rounded-lg bg-background border">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{conflict.fhirData.vaccineName}</div>
                      <div className="text-sm text-muted-foreground">
                        FHIR Date: {conflict.fhirData.dateAdministered} |
                        Existing Date: {conflict.existingData.dateAdministered}
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {conflict.conflictType.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveConflictMutation.mutate({ conflict, resolution: "skip" })}
                        disabled={resolveConflictMutation.isPending}
                        data-testid={`button-conflict-skip-${conflict.id}`}
                      >
                        Keep Existing
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resolveConflictMutation.mutate({ conflict, resolution: "merge" })}
                        disabled={resolveConflictMutation.isPending}
                        data-testid={`button-conflict-merge-${conflict.id}`}
                      >
                        Merge Both
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => resolveConflictMutation.mutate({ conflict, resolution: "override" })}
                        disabled={resolveConflictMutation.isPending}
                        data-testid={`button-conflict-import-${conflict.id}`}
                      >
                        Use FHIR
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-up-to-date-count">
                  {summaryLoading ? <Skeleton className="h-7 w-8" /> : summaryData?.summary?.upToDate || 0}
                </div>
                <p className="text-xs text-muted-foreground">Up to Date</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-950">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-due-soon-count">
                  {summaryLoading ? <Skeleton className="h-7 w-8" /> : summaryData?.summary?.dueSoon || 0}
                </div>
                <p className="text-xs text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-overdue-count">
                  {summaryLoading ? <Skeleton className="h-7 w-8" /> : summaryData?.summary?.overdue || 0}
                </div>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-unknown-count">
                  {summaryLoading ? <Skeleton className="h-7 w-8" /> : summaryData?.summary?.unknown || 0}
                </div>
                <p className="text-xs text-muted-foreground">Unknown</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {summaryData?.nextDue && summaryData.nextDue.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">Upcoming Immunizations</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            Based on CDC/ACIP schedule and your recorded history, you may be due for:{" "}
            {summaryData.nextDue.slice(0, 3).map((s) => s.seriesName).join(", ")}.
            <strong> Confirm with your clinician or pharmacist.</strong>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap justify-start gap-1">
          <TabsTrigger value="summary" data-testid="tab-summary">
            <Syringe className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Calendar className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="series" data-testid="tab-series">
            <Shield className="h-4 w-4 mr-2" />
            Vaccine Series
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Bell className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  May Be Due
                </CardTitle>
                <CardDescription>Based on CDC/ACIP schedule and your recorded history - confirm with your clinician</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : summaryData?.nextDue && summaryData.nextDue.length > 0 ? (
                  <div className="space-y-3">
                    {summaryData.nextDue.map((series) => (
                      <div key={series.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(series.status)}
                          <div>
                            <div className="font-medium">{series.seriesName}</div>
                            <div className="text-sm text-muted-foreground">
                              {series.nextDoseNumber ? `Dose ${series.nextDoseNumber} of ${series.dosesRequired}` : "Check schedule"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(series.status)}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p>All vaccines up to date!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Syringe className="h-5 w-5" />
                  Recent Immunizations
                </CardTitle>
                <CardDescription>Your most recent vaccination records</CardDescription>
              </CardHeader>
              <CardContent>
                {immunizationsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : immunizationsData?.events && immunizationsData.events.length > 0 ? (
                  <div className="space-y-2">
                    {immunizationsData.events.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <div>
                          <div className="font-medium">{event.vaccineName}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{new Date(event.dateAdministered).toLocaleDateString()}</span>
                            {event.vaccineCode && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold">
                                CVX {event.vaccineCode}
                              </span>
                            )}
                          </div>
                        </div>
                        {getSourceBadge(event)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2" />
                    <p>No records yet</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddRecordOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Record
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Immunization Timeline</CardTitle>
              <CardDescription>Chronological view of all vaccination events</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {immunizationsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : immunizationsData?.events && immunizationsData.events.length > 0 ? (
                  <div className="relative pl-6 space-y-6">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-muted" />
                    {immunizationsData.events.map((event, index) => (
                      <div key={event.id} className="relative">
                        <div className="absolute -left-4 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Syringe className="h-2 w-2 text-primary-foreground" />
                        </div>
                        <Card className="ml-4">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {event.vaccineName}
                                  {event.vaccineCode && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold" data-testid={`cvx-badge-${event.id}`}>
                                      CVX {event.vaccineCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(event.dateAdministered).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </div>
                                {event.performer && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    Provider: {event.performer}
                                  </div>
                                )}
                                {event.lotNumber && (
                                  <div className="text-xs text-muted-foreground">
                                    Lot: {event.lotNumber}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {getSourceBadge(event)}
                                {getConfidenceBadge(event.confidence)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2" />
                    <p>No immunization records found</p>
                    <p className="text-sm">Add your first record to start tracking</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="series" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Vaccine schedules are based on CDC/ACIP guidelines. Always confirm timing with your healthcare provider.
            </AlertDescription>
          </Alert>

          {selectedRiskFlags.length > 0 && (
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20" data-testid="card-active-risk-flags">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                  Personalized Recommendations Active
                </CardTitle>
                <CardDescription>
                  Your vaccine recommendations are personalized based on the following health conditions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedRiskFlags.map(flagId => (
                    <Badge 
                      key={flagId} 
                      variant="secondary" 
                      className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                      data-testid={`badge-active-flag-${flagId}`}
                    >
                      {getRiskFlagLabel(flagId)}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {selectedRiskFlags.slice(0, 3).map(flagId => {
                    const impact = getRiskFlagImpact(flagId);
                    return (
                      <div key={flagId} className="text-sm p-2 rounded bg-background/60">
                        <span className="font-medium">{getRiskFlagLabel(flagId)}:</span>{" "}
                        <span className="text-muted-foreground">{impact.note}</span>
                        {impact.vaccines.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {impact.vaccines.map(v => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selectedRiskFlags.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{selectedRiskFlags.length - 3} more conditions affecting recommendations
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-series-complete">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                    <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-series-complete-count">
                      {summaryData?.statuses?.filter(s => s.status === "up_to_date").length || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Series Complete</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-series-in-progress">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                    <Clock className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-series-in-progress-count">
                      {summaryData?.statuses?.filter(s => s.dosesReceived > 0 && s.dosesReceived < s.dosesRequired).length || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-series-need-review">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
                    <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-series-need-review-count">
                      {summaryData?.statuses?.filter(s => s.requiresClinicianReview).length || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Need Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Vaccine Series Status
              </CardTitle>
              <CardDescription>Visual progress tracking for each vaccine series</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {summaryLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {summaryData?.statuses?.map((series) => {
                      const completionPercent = series.dosesRequired > 0 
                        ? Math.round((series.dosesReceived / series.dosesRequired) * 100) 
                        : 0;
                      const isComplete = series.dosesRequired > 0 && series.dosesReceived >= series.dosesRequired;
                      
                      return (
                        <Card 
                          key={series.id} 
                          className={`${series.requiresClinicianReview ? "border-yellow-300" : ""} ${series.status === "overdue" ? "border-red-300" : ""}`}
                          data-testid={`card-series-${series.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                              <div className="flex items-start gap-3">
                                {getStatusIcon(series.status)}
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-lg">{series.seriesName}</span>
                                    {getStatusBadge(series.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{series.vaccineGroup}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                {getConfidenceBadge(series.confidence)}
                                <div className="text-2xl font-bold mt-1" aria-label={`${completionPercent} percent complete`}>{completionPercent}%</div>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-1">
                                <span className="text-muted-foreground">Series Progress</span>
                                <span className="font-medium">{series.dosesReceived} of {series.dosesRequired} doses</span>
                              </div>
                              <div className="relative">
                                <Progress value={completionPercent} className="h-3" />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                              {Array.from({ length: series.dosesRequired }).map((_, idx) => {
                                const doseNum = idx + 1;
                                const isReceived = doseNum <= series.dosesReceived;
                                const isNext = doseNum === series.nextDoseNumber;
                                
                                return (
                                  <div
                                    key={idx}
                                    role="status"
                                    aria-label={`Dose ${doseNum}: ${isReceived ? "Received" : isNext ? "Next due" : "Pending"}`}
                                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium transition-all ${
                                      isReceived 
                                        ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:text-green-200" 
                                        : isNext 
                                          ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-200 ring-2 ring-blue-300" 
                                          : "bg-muted border-muted-foreground/30 text-muted-foreground"
                                    }`}
                                    data-testid={`dose-indicator-${series.id}-${doseNum}`}
                                  >
                                    {isReceived ? (
                                      <CheckCircle className="h-5 w-5" aria-hidden="true" />
                                    ) : (
                                      doseNum
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {series.nextDueDate && !isComplete && (
                                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Next dose:</span>
                                  <span className={`font-medium ${series.status === "overdue" ? "text-red-600" : ""}`}>
                                    {new Date(series.nextDueDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {series.completedDate && (
                                <div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-muted-foreground">Completed:</span>
                                  <span className="font-medium text-green-700 dark:text-green-400">
                                    {new Date(series.completedDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {series.overdueSince && (
                                <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-950/30">
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                  <span className="text-muted-foreground">Overdue since:</span>
                                  <span className="font-medium text-red-600">
                                    {new Date(series.overdueSince).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Schedule:</span>
                                <span className="font-medium">{series.scheduleSource}</span>
                              </div>
                            </div>

                            {series.requiresClinicianReview && (
                              <Alert className="mt-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                                <Info className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
                                  <strong>Review recommended:</strong> {series.reviewReason || "Discuss timing with your healthcare provider"}
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                CDC Recommended Schedule Reference
              </CardTitle>
              <CardDescription>Standard immunization intervals (for reference only - confirm with provider)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">Hepatitis B</div>
                  <div className="text-muted-foreground">3 doses: Birth, 1-2 mo, 6-18 mo</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">DTaP/Tdap</div>
                  <div className="text-muted-foreground">5 doses + boosters every 10 yrs</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">MMR</div>
                  <div className="text-muted-foreground">2 doses: 12-15 mo, 4-6 yrs</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">Varicella</div>
                  <div className="text-muted-foreground">2 doses: 12-15 mo, 4-6 yrs</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">HPV</div>
                  <div className="text-muted-foreground">2-3 doses: Ages 11-12</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">Influenza</div>
                  <div className="text-muted-foreground">Annual: Every fall season</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">Shingrix</div>
                  <div className="text-muted-foreground">2 doses: Age 50+, 2-6 mo apart</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">Pneumococcal</div>
                  <div className="text-muted-foreground">1-2 doses: Age 65+ or high risk</div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">COVID-19</div>
                  <div className="text-muted-foreground">Primary + annual boosters</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Documents & Proof</span>
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </CardTitle>
              <CardDescription>Upload vaccine cards, printouts, and official forms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
                <p className="text-xs text-muted-foreground">Supports: JPG, PNG, PDF (max 10MB)</p>
                <Button variant="outline" className="mt-4">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Reminder Preferences
                </CardTitle>
                <CardDescription>Configure how you want to be reminded</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified on your device</p>
                  </div>
                  <Checkbox defaultChecked data-testid="checkbox-push-notifications" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Reminders</Label>
                    <p className="text-sm text-muted-foreground">Receive email notifications</p>
                  </div>
                  <Checkbox data-testid="checkbox-email-reminders" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Advance Notice</Label>
                    <p className="text-sm text-muted-foreground">How early to remind you</p>
                  </div>
                  <Select defaultValue="7">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">1 week</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                      <SelectItem value="30">1 month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Health Conditions
                </CardTitle>
                <CardDescription>Select any conditions that may affect vaccine recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {riskFlagsData?.availableFlags?.map((flag) => {
                      const impact = getRiskFlagImpact(flag.id);
                      const isSelected = selectedRiskFlags.includes(flag.id);
                      return (
                        <div 
                          key={flag.id} 
                          className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                            isSelected ? "bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800" : "hover-elevate"
                          }`}
                        >
                          <Checkbox
                            id={flag.id}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRiskFlags([...selectedRiskFlags, flag.id]);
                              } else {
                                setSelectedRiskFlags(selectedRiskFlags.filter((f) => f !== flag.id));
                              }
                            }}
                            data-testid={`checkbox-risk-${flag.id}`}
                          />
                          <div className="flex-1">
                            <Label htmlFor={flag.id} className="font-medium cursor-pointer">
                              {flag.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{flag.description}</p>
                            {isSelected && impact.vaccines.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {impact.vaccines.map(v => (
                                  <Badge 
                                    key={v} 
                                    variant="outline" 
                                    className="text-xs bg-purple-100 dark:bg-purple-900/50 border-purple-300"
                                  >
                                    {v}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <Button
                  className="w-full mt-4"
                  onClick={handleSaveRiskFlags}
                  disabled={updateRiskFlagsMutation.isPending}
                  data-testid="button-save-risk-flags"
                >
                  {updateRiskFlagsMutation.isPending ? "Saving..." : "Save Health Conditions"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {selectedRiskFlags.length > 0 && (
            <Card className="mt-4" data-testid="card-risk-flags-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                  Your Personalized Vaccine Recommendations
                </CardTitle>
                <CardDescription>
                  Based on your selected health conditions, these vaccines may be especially important for you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This is informational only and NOT clinical decision support. Always discuss vaccine timing and eligibility with your healthcare provider.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRiskFlags.map(flagId => {
                    const impact = getRiskFlagImpact(flagId);
                    if (impact.vaccines.length === 0) return null;
                    return (
                      <div 
                        key={flagId} 
                        className="p-4 rounded-lg border bg-card"
                        data-testid={`card-impact-${flagId}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900">
                            {getRiskFlagLabel(flagId)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{impact.note}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Recommended vaccines:</p>
                          <div className="flex flex-wrap gap-1">
                            {impact.vaccines.map(v => (
                              <Badge key={v} variant="outline" className="text-xs">
                                <Syringe className="h-3 w-3 mr-1" />
                                {v}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          {summaryData?.disclaimer || "This information is based on CDC/ACIP published schedules and your recorded history. This is NOT medical advice. Always confirm with your clinician or pharmacist before receiving any vaccine."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
