import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Pill,
  AlertTriangle,
  Scissors,
  Stethoscope,
  Users,
  Syringe,
  Heart,
  Clock,
  FileText,
  Share2,
  Plus,
  Loader2,
  Link2,
  CheckCircle,
  Shield,
  Calendar,
  Home,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";

interface HealthRecord {
  id: string;
  category: string;
  name: string;
  details: string;
  date: string;
  status: string;
  source: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  category: string;
  title: string;
  description: string;
  source: string;
}

interface EhrConnectionResponse {
  id: number;
  status: string;
  facilityName: string;
  platform: string;
  lastSyncAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    current: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    resolved: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    discontinued: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  };
  return (
    <Badge className={colors[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <Badge variant="outline" className="text-[10px] font-normal" data-testid={`badge-source-${source.replace(/\s+/g, '-').toLowerCase()}`}>
      {source}
    </Badge>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon: any }) {
  return (
    <div className="text-center py-12 space-y-3" data-testid="empty-state">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/50" />
      <p className="text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground/70">Connect your health records or add entries manually.</p>
    </div>
  );
}

function RecordCard({ record }: { record: HealthRecord }) {
  return (
    <Card data-testid={`record-card-${record.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold" data-testid={`text-record-name-${record.id}`}>{record.name}</h4>
              <StatusBadge status={record.status} />
              <SourceBadge source={record.source} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{record.details}</p>
            {record.date && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(record.date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddRecordDialog({ category, onAdd }: { category: string; onAdd: (data: any) => void }) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("active");
  const [open, setOpen] = useState(false);

  const categoryLabels: Record<string, string> = {
    medications: "Medication",
    allergies: "Allergy",
    surgeries: "Surgery / Procedure",
    medical_history: "Condition / Diagnosis",
    social_history: "Social History Item",
    vaccines: "Vaccine",
    sdoh: "SDOH Factor",
  };

  const namePlaceholders: Record<string, string> = {
    medications: "e.g., Lisinopril 10mg",
    allergies: "e.g., Penicillin",
    surgeries: "e.g., Appendectomy",
    medical_history: "e.g., Type 2 Diabetes",
    social_history: "e.g., Non-smoker",
    vaccines: "e.g., COVID-19 Pfizer",
    sdoh: "e.g., Food insecurity",
  };

  const detailPlaceholders: Record<string, string> = {
    medications: "Dosage, frequency, prescribing doctor...",
    allergies: "Reaction type, severity...",
    surgeries: "Hospital, surgeon, outcome...",
    medical_history: "Onset, treatment, notes...",
    social_history: "Details about lifestyle, habits...",
    vaccines: "Dose number, lot number, location...",
    sdoh: "Screening results, risk factors...",
  };

  const statusOptions: Record<string, string[]> = {
    medications: ["active", "discontinued", "as-needed"],
    allergies: ["active", "resolved", "suspected"],
    surgeries: ["completed", "scheduled", "cancelled"],
    medical_history: ["active", "resolved", "chronic"],
    social_history: ["current", "former", "never"],
    vaccines: ["completed", "scheduled", "overdue"],
    sdoh: ["active", "resolved", "at-risk"],
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      category,
      name: name.trim(),
      details: details.trim(),
      date: date || new Date().toISOString().split("T")[0],
      status,
    });
    setName("");
    setDetails("");
    setDate("");
    setStatus("active");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-add-${category}`}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent data-testid={`dialog-add-${category}`}>
        <DialogHeader>
          <DialogTitle>Add {categoryLabels[category]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`name-${category}`}>Name</Label>
            <Input
              id={`name-${category}`}
              placeholder={namePlaceholders[category]}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid={`input-name-${category}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`details-${category}`}>Details</Label>
            <Textarea
              id={`details-${category}`}
              placeholder={detailPlaceholders[category]}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              data-testid={`input-details-${category}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`date-${category}`}>Date</Label>
              <Input
                id={`date-${category}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid={`input-date-${category}`}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid={`select-status-${category}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(statusOptions[category] || ["active"]).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/-/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid={`button-cancel-${category}`}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!name.trim()} data-testid={`button-save-${category}`}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HealthTab({ category, icon: Icon, label, color }: {
  category: string;
  icon: any;
  label: string;
  color: string;
}) {
  const { toast } = useToast();

  const apiCategory = category === "medical_history" ? "medical-history" : category === "social_history" ? "social-history" : category;

  const { data, isLoading } = useQuery<{ records: HealthRecord[] }>({
    queryKey: ["/api/patient-health-record", apiCategory],
    queryFn: async () => {
      const res = await fetch(`/api/patient-health-record/${apiCategory}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const mapFormToBackend = (data: any) => {
    const fieldMap: Record<string, (d: any) => any> = {
      medications: (d) => ({ name: d.name, dose: d.details, status: d.status, startDate: d.date }),
      allergies: (d) => ({ allergen: d.name, reaction: d.details, status: d.status, onsetDate: d.date }),
      surgeries: (d) => ({ procedureName: d.name, notes: d.details, surgeryDate: d.date }),
      medical_history: (d) => ({ condition: d.name, notes: d.details, status: d.status, diagnosedDate: d.date }),
      social_history: (d) => ({ category: d.name, description: d.details || d.name, status: d.status, startDate: d.date }),
      vaccines: (d) => ({ vaccineName: d.name, notes: d.details, dateAdministered: d.date }),
      sdoh: (d) => ({ domain: d.name, response: d.details || d.name, screeningDate: d.date }),
    };
    return (fieldMap[category] || fieldMap.medications)(data);
  };

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const mapped = mapFormToBackend(newRecord);
      const res = await apiRequest("POST", `/api/patient-health-record/${apiCategory}`, mapped);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health-record", apiCategory] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health-record", "timeline"] });
      toast({ title: "Record added", description: `Your ${label.toLowerCase()} record has been saved.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save record. Please try again.", variant: "destructive" });
    },
  });

  const records = data?.records || [];

  return (
    <div className="space-y-4" data-testid={`tab-content-${category}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          {label}
          {records.length > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid={`count-${category}`}>{records.length}</Badge>
          )}
        </h3>
        <AddRecordDialog category={category} onAdd={(data) => addMutation.mutate(data)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState message={`No ${label.toLowerCase()} records yet.`} icon={Icon} />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineTab() {
  const { data, isLoading } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: ["/api/patient-health-record", "timeline"],
    queryFn: async () => {
      const res = await fetch("/api/patient-health-record/timeline");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const events = data?.events || [];

  const categoryIcons: Record<string, { icon: any; color: string }> = {
    medications: { icon: Pill, color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30" },
    allergies: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30" },
    surgeries: { icon: Scissors, color: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30" },
    medical_history: { icon: Stethoscope, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30" },
    social_history: { icon: Users, color: "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30" },
    vaccines: { icon: Syringe, color: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" },
    sdoh: { icon: Home, color: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return <EmptyState message="No timeline events yet." icon={Clock} />;
  }

  return (
    <div className="space-y-1" data-testid="tab-content-timeline">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        Health Timeline
      </h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {events.map((event) => {
            const cat = categoryIcons[event.category] || categoryIcons.medical_history;
            const EventIcon = cat.icon;
            return (
              <div key={event.id} className="relative flex gap-4 pl-2" data-testid={`timeline-event-${event.id}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full z-10 ${cat.color}`}>
                  <EventIcon className="h-4 w-4" />
                </div>
                <Card className="flex-1">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm" data-testid={`text-event-title-${event.id}`}>{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString()}</p>
                        <SourceBadge source={event.source} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryTab() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<{ summary: any }>({
    queryKey: ["/api/patient-health-record", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/patient-health-record/summary");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-4" data-testid="tab-content-summary">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        Health Summary
      </h3>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium" data-testid="text-summary-name">{user?.firstName} {user?.middleName !== "NMN" ? user?.middleName + " " : ""}{user?.lastName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date of Birth</p>
              <p className="font-medium" data-testid="text-summary-dob">{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "Not set"}</p>
            </div>
          </div>

          {summary && (
            <>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Medications", count: summary.medicationsCount ?? 0, icon: Pill, color: "text-blue-600" },
                  { label: "Allergies", count: summary.allergiesCount ?? 0, icon: AlertTriangle, color: "text-red-600" },
                  { label: "Conditions", count: summary.conditionsCount ?? 0, icon: Stethoscope, color: "text-indigo-600" },
                  { label: "Vaccines", count: summary.vaccinesCount ?? 0, icon: Syringe, color: "text-green-600" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 bg-muted/30 rounded-lg" data-testid={`summary-stat-${stat.label.toLowerCase()}`}>
                    <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              {summary.aiSummary && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">AI Health Summary</p>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-ai-summary">{summary.aiSummary}</p>
                    <p className="text-xs text-muted-foreground mt-2 italic">This is for informational purposes only and does not constitute medical advice.</p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShareTab() {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState("");

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/patient-health-record/share", {
        expiresInHours: 24,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShareUrl(data.shareUrl || `${window.location.origin}/shared/${data.shareId}`);
      toast({ title: "Share link created", description: "Link valid for 24 hours." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create share link.", variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Copied", description: "Link copied to clipboard." });
  };

  return (
    <div className="space-y-4" data-testid="tab-content-share">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Share2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        Share Your Records
      </h3>

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a secure, time-limited link to share your health records with a provider or family member.
            Links expire after 24 hours and are encrypted end-to-end.
          </p>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => shareMutation.mutate()}
              disabled={shareMutation.isPending}
              data-testid="button-create-share-link"
            >
              {shareMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Create Share Link
            </Button>
            <Button variant="outline" data-testid="button-download-records">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {shareUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" data-testid="share-url-container">
              <Input value={shareUrl} readOnly className="text-sm" data-testid="input-share-url" />
              <Button size="icon" variant="outline" onClick={copyToClipboard} data-testid="button-copy-share-url">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>HIPAA-compliant sharing with end-to-end encryption</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FastenHealthBanner() {
  const { toast } = useToast();

  const { data: connections, isLoading: connectionsLoading } = useQuery<EhrConnectionResponse[]>({
    queryKey: ["/api/ehr-integration/connections"],
  });

  const connectedCount = connections?.filter((c) => c.status === "connected").length ?? 0;

  const handleConnect = () => {
    window.location.href = "/fasten-connect";
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="fasten-health-banner">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base" data-testid="text-fasten-title">Connect Your Health Records</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Import records from 25,000+ US healthcare providers securely via Fasten Health.
            </p>
            {connectedCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400" data-testid="text-connected-count">
                  {connectedCount} source{connectedCount !== 1 ? "s" : ""} connected
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={handleConnect}
            disabled={connectionsLoading}
            className="shrink-0"
            data-testid="button-connect-fasten"
          >
            {connectionsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            {connectedCount > 0 ? "Connect More" : "Connect Records"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const tabs = [
  { value: "medicines", label: "Medicines", icon: Pill, color: "text-blue-600 dark:text-blue-400", category: "medications" },
  { value: "allergies", label: "Allergies", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", category: "allergies" },
  { value: "surgeries", label: "Surgeries", icon: Scissors, color: "text-purple-600 dark:text-purple-400", category: "surgeries" },
  { value: "medical-history", label: "Medical History", icon: Stethoscope, color: "text-indigo-600 dark:text-indigo-400", category: "medical_history" },
  { value: "social-history", label: "Social History", icon: Users, color: "text-teal-600 dark:text-teal-400", category: "social_history" },
  { value: "vaccines", label: "Vaccines", icon: Syringe, color: "text-green-600 dark:text-green-400", category: "vaccines" },
  { value: "sdoh", label: "SDOH", icon: Home, color: "text-amber-600 dark:text-amber-400", category: "sdoh" },
  { value: "timeline", label: "Timeline", icon: Clock, color: "text-gray-600 dark:text-gray-400", category: "timeline" },
  { value: "summary", label: "Summary", icon: FileText, color: "text-gray-600 dark:text-gray-400", category: "summary" },
  { value: "share", label: "Share", icon: Share2, color: "text-gray-600 dark:text-gray-400", category: "share" },
];

export default function MyHealthRecord() {
  useSEO({
    title: "My Health Record | Tabula Medica",
    description: "View and manage your complete health records in one secure place",
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="page-title-health-record">
              My Health Record
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="text-subtitle">
              Your complete health history in one place.
            </p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            <Shield className="h-3 w-3 mr-1" />
            HIPAA Protected
          </Badge>
        </div>

        <FastenHealthBanner />

        <Tabs defaultValue="medicines" className="w-full">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
            <TabsList className="flex w-max sm:w-full sm:flex-wrap h-auto gap-1 bg-muted/50 p-1 min-w-full" data-testid="health-record-tabs">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="shrink-0 sm:flex-1 text-xs sm:text-sm whitespace-nowrap"
                  data-testid={`tab-${tab.value}`}
                >
                  <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-4">
            {tabs.filter(t => !["timeline", "summary", "share"].includes(t.value)).map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <HealthTab
                  category={tab.category}
                  icon={tab.icon}
                  label={tab.label}
                  color={tab.color}
                />
              </TabsContent>
            ))}
            <TabsContent value="timeline"><TimelineTab /></TabsContent>
            <TabsContent value="summary"><SummaryTab /></TabsContent>
            <TabsContent value="share"><ShareTab /></TabsContent>
          </div>
        </Tabs>

        <Separator />

        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>This information is for your personal records only and does not constitute medical advice.</p>
        </div>
      </div>
    </div>
  );
}
