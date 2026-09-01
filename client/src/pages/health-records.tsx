import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Pill,
  FlaskConical,
  CalendarDays,
  Clock,
  Activity,
  FileText,
  AlertCircle,
  Stethoscope,
  Syringe,
  Heart,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Filter,
  Plus,
  Target,
  TrendingUp,
  Share2,
  Users,
  Eye,
  XCircle,
  FileUp,
  Paperclip,
  Search,
  ArrowUpDown,
  Download,
  Hospital,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { ProvenanceBadge, generateMockProvenance } from "@/components/provenance-badge";
import { formatDate, formatDateTime, LoadingState as SharedLoadingState } from "@/components/shared";

interface PersonalMetric {
  id: string;
  patientId: string;
  metricType: string;
  customName?: string;
  value: number;
  unit: string;
  notes?: string;
  source: string;
  recordedAt: string;
}

interface MetricGoal {
  id: string;
  patientId: string;
  metricType: string;
  targetValue: number;
  comparison: string;
  targetValueMax?: number;
  unit: string;
  frequency: string;
  isActive: boolean;
}

interface SharedHealthData {
  id: string;
  patientId: string;
  recipientType: string;
  recipientId: string;
  recipientName: string;
  dataCategories: string[];
  accessLevel: string;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
}

interface UploadedDocument {
  id: string;
  patientId: string;
  documentType: string;
  fileName: string;
  originalFileName: string;
  uploadedAt: string;
  isVerified: boolean;
  linkedRecordType?: string;
  linkedRecordId?: string;
  notes?: string;
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  provider: string;
  sortOrder: "newest" | "oldest";
}

const metricTypeLabels: Record<string, string> = {
  weight: "Weight",
  blood_pressure_systolic: "Blood Pressure (Systolic)",
  blood_pressure_diastolic: "Blood Pressure (Diastolic)",
  heart_rate: "Heart Rate",
  blood_glucose: "Blood Glucose",
  steps: "Steps",
  sleep_hours: "Sleep Hours",
  water_intake: "Water Intake",
  mood: "Mood",
  pain_level: "Pain Level",
  energy_level: "Energy Level",
  stress_level: "Stress Level",
  exercise_minutes: "Exercise Minutes",
  custom: "Custom",
};

type TimelineItem = {
  id: string;
  type: "encounter" | "observation" | "medication" | "procedure" | "condition" | "immunization" | "diagnostic_report";
  date: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  provider?: string;
};

const DOC_TYPES = [
  { value: "lab_result", label: "Lab Result" },
  { value: "imaging", label: "Imaging" },
  { value: "prescription", label: "Prescription" },
  { value: "referral", label: "Referral" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "other", label: "Other" },
];


function getTimelineIcon(type: TimelineItem["type"]) {
  switch (type) {
    case "encounter": return <CalendarDays className="w-4 h-4" />;
    case "observation": return <Activity className="w-4 h-4" />;
    case "medication": return <Pill className="w-4 h-4" />;
    case "procedure": return <Stethoscope className="w-4 h-4" />;
    case "condition": return <Heart className="w-4 h-4" />;
    case "immunization": return <Syringe className="w-4 h-4" />;
    case "diagnostic_report": return <FileText className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
}

function getTimelineColor(type: TimelineItem["type"]) {
  switch (type) {
    case "encounter": return "bg-blue-500";
    case "observation": return "bg-green-500";
    case "medication": return "bg-purple-500";
    case "procedure": return "bg-orange-500";
    case "condition": return "bg-red-500";
    case "immunization": return "bg-teal-500";
    case "diagnostic_report": return "bg-amber-500";
    default: return "bg-muted";
  }
}

function LoadingState() {
  return <SharedLoadingState message="Loading records..." />;
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function extractDate(item: any, ...fields: string[]): string | undefined {
  for (const f of fields) {
    const parts = f.split(".");
    let val: any = item;
    for (const p of parts) {
      val = val?.[p];
    }
    if (val) return val;
  }
  return undefined;
}

function applyFilters<T>(items: T[], filters: FilterState, getDate: (item: T) => string | undefined, getProvider?: (item: T) => string | undefined): T[] {
  let result = [...items];
  if (filters.dateFrom) {
    const from = parseISO(filters.dateFrom);
    result = result.filter((item) => {
      const d = getDate(item);
      if (!d) return true;
      try { return !isBefore(parseISO(d), from); } catch { return true; }
    });
  }
  if (filters.dateTo) {
    const to = parseISO(filters.dateTo);
    result = result.filter((item) => {
      const d = getDate(item);
      if (!d) return true;
      try { return !isAfter(parseISO(d), to); } catch { return true; }
    });
  }
  if (filters.provider && getProvider) {
    const search = filters.provider.toLowerCase();
    result = result.filter((item) => {
      const p = getProvider(item);
      return !p || p.toLowerCase().includes(search);
    });
  }
  result.sort((a, b) => {
    const da = getDate(a) || "";
    const db = getDate(b) || "";
    return filters.sortOrder === "newest" ? db.localeCompare(da) : da.localeCompare(db);
  });
  return result;
}

function AttachDocumentDialog({ recordType, recordId }: { recordType: string; recordId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("other");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: async (response) => {
      if (!selectedFile) return;
      try {
        await apiRequest("POST", "/api/health-records/documents", {
          documentType: docType,
          title: selectedFile.name,
          fileName: selectedFile.name,
          originalFileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          storageUrl: response.objectPath,
          linkedRecordType: recordType,
          linkedRecordId: recordId,
          notes: notes || undefined,
        });
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/health-records/documents");
          },
        });
        toast({ title: "Document Attached", description: "File has been uploaded and linked to this record." });
        setOpen(false);
        setSelectedFile(null);
        setNotes("");
        setDocType("other");
      } catch {
        toast({ title: "Error", description: "Failed to save document metadata.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Could not upload the file.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedFile) return;
    uploadFile(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-attach-doc-${recordType}-${recordId}`}>
          <Paperclip className="w-4 h-4 mr-2" />
          Attach Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach Document</DialogTitle>
          <DialogDescription>Upload a document and link it to this record</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="health-records-file">File</Label>
            <Input id="health-records-file"
              ref={fileInputRef}
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              data-testid={`input-file-${recordType}-${recordId}`}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="health-records-document-type">Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger id="health-records-document-type" data-testid={`select-doc-type-${recordType}-${recordId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="health-records-notes-optional">Notes (optional)</Label>
            <Textarea id="health-records-notes-optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this document..."
              data-testid={`input-doc-notes-${recordType}-${recordId}`}
            />
          </div>
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} data-testid="progress-upload" />
              <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!selectedFile || isUploading} data-testid={`button-submit-doc-${recordType}-${recordId}`}>
            {isUploading ? "Uploading..." : "Upload & Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkedDocumentsList({ recordType, recordId }: { recordType: string; recordId: string }) {
  const docsUrl = `/api/health-records/documents?linkedRecordType=${recordType}&linkedRecordId=${recordId}`;
  const { data: docs = [] } = useQuery<UploadedDocument[]>({
    queryKey: [docsUrl],
  });

  if (docs.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Attached Documents</p>
      {docs.map((doc) => (
        <div key={doc.id} className="flex items-center gap-2 text-sm p-2 border rounded-md" data-testid={`linked-doc-${doc.id}`}>
          <FileText className="w-3 h-3 text-muted-foreground" />
          <span>{doc.originalFileName}</span>
          <Badge variant="outline" className="text-xs ml-auto">{doc.documentType.replace(/_/g, " ")}</Badge>
        </div>
      ))}
    </div>
  );
}

function FilterBar({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  return (
    <Card data-testid="filter-bar">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter & Sort</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="health-records-start-date" className="text-xs">Start Date</Label>
            <Input id="health-records-start-date"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              data-testid="input-filter-date-from"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="health-records-end-date" className="text-xs">End Date</Label>
            <Input id="health-records-end-date"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              data-testid="input-filter-date-to"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="health-records-provider" className="text-xs">Provider</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="health-records-provider"
                className="pl-8"
                placeholder="Search provider..."
                value={filters.provider}
                onChange={(e) => onChange({ ...filters, provider: e.target.value })}
                data-testid="input-filter-provider"
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="health-records-sort-order" className="text-xs">Sort Order</Label>
            <Select value={filters.sortOrder} onValueChange={(v) => onChange({ ...filters, sortOrder: v as "newest" | "oldest" })}>
              <SelectTrigger id="health-records-sort-order" data-testid="select-sort-order">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationsTab({ patientId, filters }: { patientId: string; filters: FilterState }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<{
    medicationRequests: any[];
    medicationStatements: any[];
    combined: any[];
  }>({
    queryKey: ["/api/fhir/patient", patientId, "medications"],
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Failed to load medications" />;

  const raw = data?.combined || [];
  const medications = applyFilters(
    raw,
    filters,
    (med) => extractDate(med, "authoredOn", "effectivePeriod.start", "dateAsserted"),
    (med) => med.requester?.display || med.informationSource?.display,
  );

  if (medications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No medications found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-medications-count">{medications.length} medication(s)</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-medications">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      <div className="grid gap-3">
        {medications.map((med: any) => {
          const name = med.medicationCodeableConcept?.text || med.medicationCodeableConcept?.coding?.[0]?.display || "Unknown Medication";
          const dosage = med.dosageInstruction?.[0]?.text || med.dosage?.[0]?.text;
          const status = med.status;
          const date = med.authoredOn || med.effectivePeriod?.start || med.dateAsserted;
          const isOpen = expandedId === med.id;
          const prescriber = med.requester?.display || med.informationSource?.display;
          const coding = med.medicationCodeableConcept?.coding?.[0];
          const refills = med.dispenseRequest?.numberOfRepeatsAllowed;
          const startDate = med.effectivePeriod?.start || med.authoredOn;
          const endDate = med.effectivePeriod?.end;

          return (
            <Collapsible key={med.id} open={isOpen} onOpenChange={(o) => setExpandedId(o ? med.id : null)}>
              <Card className="hover-elevate" data-testid={`card-medication-${med.id}`}>
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Pill className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="font-medium" data-testid={`text-medication-name-${med.id}`}>{name}</h3>
                          {dosage && <p className="text-sm text-muted-foreground">{dosage}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Prescribed: {formatDate(date)}</p>
                          <div className="mt-2">
                            <ProvenanceBadge
                              provenance={generateMockProvenance({ source: "fhir", verified: status === "active", hasCoding: true })}
                              variant="compact"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status === "active" ? "default" : "secondary"} data-testid={`badge-medication-status-${med.id}`}>
                          {status}
                        </Badge>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4 space-y-3 text-sm" data-testid={`detail-medication-${med.id}`}>
                    <div className="grid grid-cols-2 gap-3">
                      {dosage && (
                        <div>
                          <p className="text-xs text-muted-foreground">Dosage Instructions</p>
                          <p>{dosage}</p>
                        </div>
                      )}
                      {prescriber && (
                        <div>
                          <p className="text-xs text-muted-foreground">Prescriber</p>
                          <p>{prescriber}</p>
                        </div>
                      )}
                      {startDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Start Date</p>
                          <p>{formatDate(startDate)}</p>
                        </div>
                      )}
                      {endDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">End Date</p>
                          <p>{formatDate(endDate)}</p>
                        </div>
                      )}
                      {refills !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Refills Allowed</p>
                          <p>{refills}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="capitalize">{status}</p>
                      </div>
                      {coding && (
                        <div>
                          <p className="text-xs text-muted-foreground">Code / System</p>
                          <p>{coding.code} ({coding.system})</p>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <AttachDocumentDialog recordType="medication" recordId={med.id} />
                    </div>
                    <LinkedDocumentsList recordType="medication" recordId={med.id} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function LabsTab({ patientId, filters }: { patientId: string; filters: FilterState }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<{
    labObservations: any[];
    diagnosticReports: any[];
  }>({
    queryKey: ["/api/fhir/patient", patientId, "labs"],
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Failed to load lab results" />;

  const rawObs = data?.labObservations || [];
  const rawReports = data?.diagnosticReports || [];

  const observations = applyFilters(
    rawObs, filters,
    (obs) => obs.effectiveDateTime,
    (obs) => obs.performer?.[0]?.display,
  );
  const reports = applyFilters(
    rawReports, filters,
    (r) => r.effectiveDateTime || r.issued,
    (r) => r.performer?.[0]?.display,
  );

  if (observations.length === 0 && reports.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No lab results found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-labs-count">{observations.length} observation(s), {reports.length} report(s)</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-labs">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {reports.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Diagnostic Reports
          </h3>
          <div className="grid gap-3">
            {reports.map((report: any) => {
              const name = report.code?.text || report.code?.coding?.[0]?.display || "Lab Report";
              return (
                <Card key={report.id} className="hover-elevate" data-testid={`card-report-${report.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <FileText className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-medium">{name}</h4>
                          {report.conclusion && <p className="text-sm text-muted-foreground">{report.conclusion}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{formatDateTime(report.effectiveDateTime || report.issued)}</p>
                        </div>
                      </div>
                      <Badge variant={report.status === "final" ? "default" : "secondary"}>{report.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Lab Observations
          </h3>
          <div className="grid gap-3">
            {observations.map((obs: any) => {
              const name = obs.code?.text || obs.code?.coding?.[0]?.display || "Observation";
              const value = obs.valueQuantity ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}` : null;
              const isOpen = expandedId === obs.id;
              const refRange = obs.referenceRange?.[0];
              const interpretation = obs.interpretation?.[0]?.text || obs.interpretation?.[0]?.coding?.[0]?.display;
              const performer = obs.performer?.[0]?.display;
              const specimen = obs.specimen?.display;

              return (
                <Collapsible key={obs.id} open={isOpen} onOpenChange={(o) => setExpandedId(o ? obs.id : null)}>
                  <Card className="hover-elevate" data-testid={`card-observation-${obs.id}`}>
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                              <Activity className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                              <h4 className="font-medium">{name}</h4>
                              <p className="text-xs text-muted-foreground">{formatDateTime(obs.effectiveDateTime)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {value && <p className="font-medium">{value}</p>}
                              <Badge variant="outline" className="text-xs">{obs.status}</Badge>
                            </div>
                            {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 space-y-3 text-sm" data-testid={`detail-lab-${obs.id}`}>
                        <div className="grid grid-cols-2 gap-3">
                          {refRange && (
                            <div>
                              <p className="text-xs text-muted-foreground">Reference Range</p>
                              <p>
                                {refRange.low?.value !== undefined && `${refRange.low.value} ${refRange.low.unit || ""}`}
                                {refRange.low?.value !== undefined && refRange.high?.value !== undefined && " - "}
                                {refRange.high?.value !== undefined && `${refRange.high.value} ${refRange.high.unit || ""}`}
                                {refRange.text && refRange.text}
                              </p>
                            </div>
                          )}
                          {interpretation && (
                            <div>
                              <p className="text-xs text-muted-foreground">Interpretation</p>
                              <p>{interpretation}</p>
                            </div>
                          )}
                          {obs.valueQuantity?.unit && (
                            <div>
                              <p className="text-xs text-muted-foreground">Unit</p>
                              <p>{obs.valueQuantity.unit}</p>
                            </div>
                          )}
                          {performer && (
                            <div>
                              <p className="text-xs text-muted-foreground">Performer</p>
                              <p>{performer}</p>
                            </div>
                          )}
                          {specimen && (
                            <div>
                              <p className="text-xs text-muted-foreground">Specimen</p>
                              <p>{specimen}</p>
                            </div>
                          )}
                        </div>
                        <Separator />
                        <div className="flex items-center gap-2">
                          <AttachDocumentDialog recordType="lab" recordId={obs.id} />
                        </div>
                        <LinkedDocumentsList recordType="lab" recordId={obs.id} />
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EncountersTab({ patientId, filters }: { patientId: string; filters: FilterState }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: encounters, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/fhir/patient", patientId, "encounters"],
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Failed to load encounters" />;

  if (!encounters || encounters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No encounters found</p>
      </div>
    );
  }

  const filtered = applyFilters(
    encounters,
    filters,
    (enc) => enc.period?.start,
    (enc) => enc.serviceProvider?.display,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-encounters-count">{filtered.length} encounter(s)</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-encounters">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      <div className="grid gap-3">
        {filtered.map((encounter: any) => {
          const type = encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || "Encounter";
          const encClass = encounter.class?.display || encounter.class?.code || "Unknown";
          const reason = encounter.reasonCode?.[0]?.text || encounter.reasonCode?.[0]?.coding?.[0]?.display;
          const provider = encounter.serviceProvider?.display;
          const startDate = encounter.period?.start;
          const endDate = encounter.period?.end;
          const isOpen = expandedId === encounter.id;
          const location = encounter.location?.[0]?.location?.display;
          const participants = encounter.participant || [];

          return (
            <Collapsible key={encounter.id} open={isOpen} onOpenChange={(o) => setExpandedId(o ? encounter.id : null)}>
              <Card className="hover-elevate" data-testid={`card-encounter-${encounter.id}`}>
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <CalendarDays className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-medium">{type}</h3>
                          <Badge variant="outline" className="mt-1">{encClass}</Badge>
                          {reason && <p className="text-sm text-muted-foreground mt-2">{reason}</p>}
                          {provider && <p className="text-xs text-muted-foreground mt-1">{provider}</p>}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(startDate)}</span>
                            {endDate && (
                              <>
                                <ChevronRight className="w-3 h-3" />
                                <span>{formatDateTime(endDate)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={encounter.status === "finished" ? "default" : "secondary"}>{encounter.status}</Badge>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4 space-y-3 text-sm" data-testid={`detail-encounter-${encounter.id}`}>
                    <div className="grid grid-cols-2 gap-3">
                      {reason && (
                        <div>
                          <p className="text-xs text-muted-foreground">Reason</p>
                          <p>{reason}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Class</p>
                        <p className="capitalize">{encClass}</p>
                      </div>
                      {provider && (
                        <div>
                          <p className="text-xs text-muted-foreground">Service Provider</p>
                          <p>{provider}</p>
                        </div>
                      )}
                      {location && (
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p>{location}</p>
                        </div>
                      )}
                      {startDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Period Start</p>
                          <p>{formatDateTime(startDate)}</p>
                        </div>
                      )}
                      {endDate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Period End</p>
                          <p>{formatDateTime(endDate)}</p>
                        </div>
                      )}
                    </div>
                    {participants.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Participants</p>
                        <div className="flex flex-wrap gap-2">
                          {participants.map((p: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {p.individual?.display || p.type?.[0]?.text || "Participant"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center gap-2">
                      <AttachDocumentDialog recordType="encounter" recordId={encounter.id} />
                    </div>
                    <LinkedDocumentsList recordType="encounter" recordId={encounter.id} />
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function TimelineTab({ patientId, filters }: { patientId: string; filters: FilterState }) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data: timeline, isLoading, isError, refetch } = useQuery<TimelineItem[]>({
    queryKey: ["/api/fhir/patient", patientId, "timeline"],
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Failed to load timeline" />;

  const types: TimelineItem["type"][] = ["encounter", "observation", "medication", "procedure", "condition", "immunization", "diagnostic_report"];

  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No health events found</p>
      </div>
    );
  }

  let filtered = typeFilter ? timeline.filter((item) => item.type === typeFilter) : [...timeline];
  filtered = applyFilters(
    filtered,
    filters,
    (item) => item.date,
    (item) => item.provider,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Button variant={typeFilter === null ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(null)} data-testid="button-filter-all">All</Button>
          {types.map((type) => (
            <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)} data-testid={`button-filter-${type}`}>
              {type.replace("_", " ")}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-timeline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} event(s)</p>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-4 pl-12">
          {filtered.map((item) => (
            <div key={`${item.type}-${item.id}`} className="relative" data-testid={`timeline-item-${item.type}-${item.id}`}>
              <div className={`absolute -left-7 w-4 h-4 rounded-full ${getTimelineColor(item.type)} flex items-center justify-center`}>
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
              <Card className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getTimelineColor(item.type)}/10`}>
                        {getTimelineIcon(item.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.title}</h4>
                          <Badge variant="outline" className="text-xs capitalize">{item.type.replace("_", " ")}</Badge>
                        </div>
                        {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                        {item.provider && <p className="text-xs text-muted-foreground mt-1">{item.provider}</p>}
                        <p className="text-xs text-muted-foreground mt-2">{formatDateTime(item.date)}</p>
                      </div>
                    </div>
                    {item.status && <Badge variant="secondary">{item.status}</Badge>}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonalMetricsTab() {
  const { toast } = useToast();
  const [isAddMetricOpen, setIsAddMetricOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<PersonalMetric[]>({
    queryKey: ["/api/health-records/metrics"],
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<MetricGoal[]>({
    queryKey: ["/api/health-records/goals"],
  });

  const addMetricMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/health-records/metrics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records/metrics"] });
      setIsAddMetricOpen(false);
      toast({ title: "Metric Added", description: "Your health metric has been recorded." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add metric.", variant: "destructive" }),
  });

  const addGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/health-records/goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records/goals"] });
      setIsAddGoalOpen(false);
      toast({ title: "Goal Created", description: "Your health goal has been set." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create goal.", variant: "destructive" }),
  });

  if (metricsLoading || goalsLoading) return <LoadingState />;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Personal Metrics</CardTitle>
            <CardDescription>Track your health measurements</CardDescription>
          </div>
          <Dialog open={isAddMetricOpen} onOpenChange={setIsAddMetricOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-metric"><Plus className="h-4 w-4 mr-2" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Health Metric</DialogTitle>
                <DialogDescription>Record a new health measurement</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addMetricMutation.mutate({
                  metricType: formData.get("metricType"),
                  value: parseFloat(formData.get("value") as string),
                  unit: formData.get("unit"),
                  notes: formData.get("notes") || undefined,
                  source: "manual",
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="health-records-metric-type">Metric Type</Label>
                    <Select name="metricType" defaultValue="weight">
                      <SelectTrigger id="health-records-metric-type" data-testid="select-metric-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(metricTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-value">Value</Label>
                      <Input id="health-records-value" name="value" type="number" step="0.1" required data-testid="input-metric-value" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-unit">Unit</Label>
                      <Input id="health-records-unit" name="unit" placeholder="lbs, mmHg, etc." required data-testid="input-metric-unit" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="health-records-notes-optional-2">Notes (optional)</Label>
                    <Textarea id="health-records-notes-optional-2" name="notes" placeholder="Any additional notes..." data-testid="input-metric-notes" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addMetricMutation.isPending} data-testid="button-save-metric">
                    {addMetricMutation.isPending ? "Saving..." : "Save Metric"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {metrics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No metrics recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.slice(0, 10).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`metric-${metric.id}`}>
                    <div>
                      <p className="font-medium text-sm">{metricTypeLabels[metric.metricType] || metric.metricType}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(metric.recordedAt), "MMM d, h:mm a")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{metric.value} {metric.unit}</p>
                      <Badge variant="outline" className="text-xs">{metric.source}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Health Goals</CardTitle>
            <CardDescription>Set targets for your metrics</CardDescription>
          </div>
          <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-goal"><Target className="h-4 w-4 mr-2" />Set Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Health Goal</DialogTitle>
                <DialogDescription>Create a target for a health metric</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addGoalMutation.mutate({
                  metricType: formData.get("metricType"),
                  targetValue: parseFloat(formData.get("targetValue") as string),
                  comparison: formData.get("comparison"),
                  unit: formData.get("unit"),
                  frequency: formData.get("frequency") || "daily",
                  isActive: true,
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="health-records-metric-type-2">Metric Type</Label>
                    <Select name="metricType" defaultValue="weight">
                      <SelectTrigger id="health-records-metric-type-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(metricTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-target-value">Target Value</Label>
                      <Input id="health-records-target-value" name="targetValue" type="number" step="0.1" required data-testid="input-goal-value" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-unit-2">Unit</Label>
                      <Input id="health-records-unit-2" name="unit" placeholder="lbs, steps, etc." required data-testid="input-goal-unit" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-comparison">Comparison</Label>
                      <Select name="comparison" defaultValue="less_than">
                        <SelectTrigger id="health-records-comparison"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="less_than">Less than</SelectItem>
                          <SelectItem value="greater_than">Greater than</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="health-records-frequency">Frequency</Label>
                      <Select name="frequency" defaultValue="daily">
                        <SelectTrigger id="health-records-frequency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addGoalMutation.isPending} data-testid="button-save-goal">
                    {addGoalMutation.isPending ? "Saving..." : "Create Goal"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {goals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No goals set yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="p-3 border rounded-lg" data-testid={`goal-${goal.id}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{metricTypeLabels[goal.metricType] || goal.metricType}</p>
                      <Badge variant={goal.isActive ? "default" : "secondary"}>
                        {goal.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {goal.comparison === "less_than" && "< "}
                      {goal.comparison === "greater_than" && "> "}
                      {goal.targetValue} {goal.unit}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{goal.frequency}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

const DATA_CATEGORIES = [
  { value: "medications", label: "Medications" },
  { value: "conditions", label: "Conditions" },
  { value: "vitals", label: "Vitals" },
  { value: "lab_results", label: "Lab Results" },
  { value: "encounters", label: "Encounters" },
  { value: "allergies", label: "Allergies" },
  { value: "immunizations", label: "Immunizations" },
  { value: "documents", label: "Documents" },
];

function SharingTab() {
  const { toast } = useToast();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["medications", "conditions", "vitals"]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const { data: shares = [], isLoading } = useQuery<SharedHealthData[]>({
    queryKey: ["/api/health-records/sharing"],
  });

  const shareMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/health-records/sharing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records/sharing"] });
      setIsShareOpen(false);
      setSelectedCategories(["medications", "conditions", "vitals"]);
      toast({ title: "Shared", description: "Health data shared successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to share data.", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/health-records/sharing/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records/sharing"] });
      toast({ title: "Revoked", description: "Access has been revoked." });
    },
  });

  if (isLoading) return <LoadingState />;

  const activeShares = shares.filter(s => s.isActive);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Data Sharing</CardTitle>
          <CardDescription>Manage who has access to your health information</CardDescription>
        </div>
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-share">
              <Users className="h-4 w-4 mr-2" />Add Recipient
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Health Data</DialogTitle>
              <DialogDescription>Share your health information with care team members</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (selectedCategories.length === 0) {
                toast({ title: "Required", description: "Select at least one data category to share.", variant: "destructive" });
                return;
              }
              shareMutation.mutate({
                recipientType: formData.get("recipientType"),
                recipientId: formData.get("recipientId"),
                recipientName: formData.get("recipientName"),
                dataCategories: selectedCategories,
                accessLevel: formData.get("accessLevel") || "view",
                validFrom: new Date().toISOString(),
              });
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="health-records-recipient-type">Recipient Type</Label>
                  <Select name="recipientType" defaultValue="provider">
                    <SelectTrigger id="health-records-recipient-type" data-testid="select-recipient-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="provider">Healthcare Provider</SelectItem>
                      <SelectItem value="caregiver">Caregiver</SelectItem>
                      <SelectItem value="family">Family Member</SelectItem>
                      <SelectItem value="care_team">Care Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health-records-recipient-name">Recipient Name</Label>
                  <Input id="health-records-recipient-name" name="recipientName" placeholder="Dr. Jane Smith" required data-testid="input-recipient-name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health-records-recipient-email-id">Recipient Email/ID</Label>
                  <Input id="health-records-recipient-email-id" name="recipientId" placeholder="jane.smith@hospital.com" required data-testid="input-recipient-id" />
                </div>
                <div className="grid gap-2">
                  <FieldCaption>Data Categories</FieldCaption>
                  <div className="flex flex-wrap gap-2" data-testid="category-selector">
                    {DATA_CATEGORIES.map((cat) => (
                      <Badge
                        key={cat.value}
                        variant={selectedCategories.includes(cat.value) ? "default" : "outline"}
                        className="cursor-pointer toggle-elevate"
                        onClick={() => toggleCategory(cat.value)}
                        data-testid={`category-${cat.value}`}
                      >
                        {cat.label}
                      </Badge>
                    ))}
                  </div>
                  {selectedCategories.length === 0 && (
                    <p className="text-xs text-destructive">Select at least one category</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health-records-access-level">Access Level</Label>
                  <Select name="accessLevel" defaultValue="view">
                    <SelectTrigger id="health-records-access-level" data-testid="select-access-level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="view_and_download">View & Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={shareMutation.isPending || selectedCategories.length === 0} data-testid="button-confirm-share">
                  {shareMutation.isPending ? "Sharing..." : "Share Data"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {activeShares.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active shares</p>
            <p className="text-sm mt-2">Share your health data with providers or caregivers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeShares.map((share) => (
              <div key={share.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`share-${share.id}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{share.recipientName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{share.recipientType.replace(/_/g, " ")}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {share.dataCategories.slice(0, 3).map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                      ))}
                      {share.dataCategories.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{share.dataCategories.length - 3}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={share.accessLevel === "view_and_download" ? "default" : "secondary"}>
                    <Eye className="h-3 w-3 mr-1" />
                    {share.accessLevel === "view_and_download" ? "View & Download" : "View Only"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => revokeMutation.mutate(share.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-${share.id}`}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsTab() {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile: doUpload, isUploading, progress: uploadProgress } = useUpload({
    onSuccess: async (response) => {
      if (!uploadFile) return;
      try {
        await apiRequest("POST", "/api/health-records/documents", {
          documentType: uploadDocType,
          title: uploadFile.name,
          fileName: uploadFile.name,
          originalFileName: uploadFile.name,
          mimeType: uploadFile.type,
          fileSize: uploadFile.size,
          storageUrl: response.objectPath,
          notes: uploadNotes || undefined,
        });
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/health-records/documents");
          },
        });
        toast({ title: "Document Uploaded", description: "File has been uploaded successfully." });
        setUploadOpen(false);
        setUploadFile(null);
        setUploadNotes("");
        setUploadDocType("other");
      } catch {
        toast({ title: "Error", description: "Failed to save document metadata.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Could not upload the file.", variant: "destructive" });
    },
  });

  const { data: documents = [], isLoading, refetch } = useQuery<UploadedDocument[]>({
    queryKey: ["/api/health-records/documents"],
  });

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Health Documents</CardTitle>
          <CardDescription>Your uploaded medical documents and records</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-documents">
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-upload-document">
                <FileUp className="h-4 w-4 mr-2" />Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Upload a medical document to your health records</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="health-records-file-2">File</Label>
                  <Input id="health-records-file-2"
                    ref={uploadInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.txt,.csv,.doc,.docx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    data-testid="input-upload-file"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health-records-document-type-2">Document Type</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger id="health-records-document-type-2" data-testid="select-upload-doc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="health-records-notes-optional-3">Notes (optional)</Label>
                  <Textarea id="health-records-notes-optional-3"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Add any notes about this document..."
                    data-testid="input-upload-notes"
                  />
                </div>
                {isUploading && <Progress value={uploadProgress} className="w-full" />}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)} data-testid="button-cancel-upload">Cancel</Button>
                <Button onClick={() => { if (uploadFile) doUpload(uploadFile); }} disabled={!uploadFile || isUploading} data-testid="button-submit-upload">
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded</p>
            <p className="text-sm mt-2">Upload medical records, lab reports, and other health documents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`document-${doc.id}`}>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.originalFileName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.documentType.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{format(parseISO(doc.uploadedAt), "MMM d, yyyy")}</span>
                  {doc.isVerified ? (
                    <Badge variant="default">Verified</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PatientSummaryCard({ patientId }: { patientId: string }) {
  const { data: summary, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/fhir/patient", patientId, "summary"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !summary) {
    return null;
  }

  return (
    <Card data-testid="card-patient-summary">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle data-testid="text-patient-name">{summary.patient?.name || "Patient"}</CardTitle>
            <CardDescription>
              {summary.patient?.gender && <span className="capitalize">{summary.patient.gender}</span>}
              {summary.patient?.birthDate && <span> | Born {formatDate(summary.patient.birthDate)}</span>}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-primary" data-testid="count-conditions">{summary.counts?.activeConditions || 0}</p>
            <p className="text-xs text-muted-foreground">Active Conditions</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-purple-500" data-testid="count-medications">{summary.counts?.activeMedications || 0}</p>
            <p className="text-xs text-muted-foreground">Active Medications</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-orange-500" data-testid="count-allergies">{summary.counts?.activeAllergies || 0}</p>
            <p className="text-xs text-muted-foreground">Known Allergies</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-500" data-testid="count-encounters">{summary.counts?.encounters || 0}</p>
            <p className="text-xs text-muted-foreground">Total Encounters</p>
          </div>
        </div>

        {summary.activeAllergies && summary.activeAllergies.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Active Allergies
            </h4>
            <div className="flex flex-wrap gap-2">
              {summary.activeAllergies.map((allergy: any) => (
                <Badge key={allergy.id} variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                  {allergy.display}
                  {allergy.severity && ` (${allergy.severity})`}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HealthRecordsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const patientId = user?.id || "patient-default";
  const [activeTab, setActiveTab] = useState("timeline");
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    provider: "",
    sortOrder: "newest",
  });

  const connectionsQuery = useQuery<{ success: boolean; connections: any[] }>({
    queryKey: ["/api/ehr-integration/connections", { userId: user?.id || "current-user" }],
  });

  const activeConnections = connectionsQuery.data?.connections?.filter(
    (c: any) => c.status === "connected" || c.status === "syncing"
  ) || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="health-records-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold" data-testid="page-title">Health Records</h1>
              <p className="text-muted-foreground">View your complete health history in one place</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeConnections.length > 0 && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-active-connections">
                <Hospital className="w-3 h-3" />
                {activeConnections.length} connected
              </Badge>
            )}
            <Button
              onClick={() => setLocation("/connections")}
              data-testid="button-import-records"
            >
              <Download className="w-4 h-4 mr-2" />
              Import Records from Epic
            </Button>
          </div>
        </div>

        <PatientSummaryCard patientId={patientId} />

        <FilterBar filters={filters} onChange={setFilters} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-2" data-testid="tabs-list">
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="medications" data-testid="tab-medications">
              <Pill className="w-4 h-4 mr-2" />
              Medications
            </TabsTrigger>
            <TabsTrigger value="labs" data-testid="tab-labs">
              <FlaskConical className="w-4 h-4 mr-2" />
              Labs
            </TabsTrigger>
            <TabsTrigger value="encounters" data-testid="tab-encounters">
              <CalendarDays className="w-4 h-4 mr-2" />
              Encounters
            </TabsTrigger>
            <TabsTrigger value="metrics" data-testid="tab-metrics">
              <TrendingUp className="w-4 h-4 mr-2" />
              My Metrics
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="sharing" data-testid="tab-sharing">
              <Share2 className="w-4 h-4 mr-2" />
              Sharing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-6">
            <TimelineTab patientId={patientId} filters={filters} />
          </TabsContent>

          <TabsContent value="medications" className="mt-6">
            <MedicationsTab patientId={patientId} filters={filters} />
          </TabsContent>

          <TabsContent value="labs" className="mt-6">
            <LabsTab patientId={patientId} filters={filters} />
          </TabsContent>

          <TabsContent value="encounters" className="mt-6">
            <EncountersTab patientId={patientId} filters={filters} />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <PersonalMetricsTab />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <DocumentsTab />
          </TabsContent>

          <TabsContent value="sharing" className="mt-6">
            <SharingTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
