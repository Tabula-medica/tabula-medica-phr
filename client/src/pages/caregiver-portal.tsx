import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  Eye,
  FileText,
  Heart,
  History,
  Mail,
  MessageSquare,
  Pill,
  Plus,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  User,
  UserPlus,
  Users,
  Activity,
  Droplets,
  Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const SAMPLE_CAREGIVER_ID = "caregiver-001";
const SAMPLE_PATIENT_ID = "patient-001";

interface CaregiverAccess {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  patientId: string;
  patientName: string;
  role: string;
  accessLevel: string;
  isActive: boolean;
  isPrimary: boolean;
  notificationsEnabled: boolean;
  permissions: {
    canScheduleAppointments: boolean;
    canSendMessages: boolean;
    canViewMessages: boolean;
    canManageMedications: boolean;
    canAccessEmergencyInfo: boolean;
    canAddCareNotes: boolean;
    dataCategories: Record<string, { canView: boolean; canAdd: boolean; canEdit: boolean }>;
  };
  createdAt: string;
  lastAccessAt?: string;
}

interface CareNote {
  id: string;
  caregiverId: string;
  patientId: string;
  noteType: string;
  content: string;
  severity?: string;
  sharedWithCareTeam: boolean;
  createdAt: string;
}

interface CriticalAlert {
  id: string;
  type: string;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  isRead: boolean;
  requiresAction: boolean;
}

const VITAL_TYPES = [
  { id: "blood_pressure", name: "Blood Pressure", icon: Activity, unit: "mmHg" },
  { id: "glucose", name: "Blood Glucose", icon: Droplets, unit: "mg/dL" },
  { id: "weight", name: "Weight", icon: Scale, unit: "lbs" },
  { id: "temperature", name: "Temperature", icon: Thermometer, unit: "F" },
  { id: "heart_rate", name: "Heart Rate", icon: Heart, unit: "bpm" },
];

const NOTE_TYPES = [
  { value: "observation", label: "General Observation" },
  { value: "concern", label: "Health Concern" },
  { value: "medication_given", label: "Medication Given" },
  { value: "symptom", label: "Symptom Noted" },
  { value: "behavior", label: "Behavior Change" },
  { value: "nutrition", label: "Nutrition/Diet" },
  { value: "activity", label: "Physical Activity" },
];

const ROLE_LABELS: Record<string, string> = {
  family_caregiver: "Family Caregiver",
  professional_caregiver: "Professional Caregiver",
  healthcare_proxy: "Healthcare Proxy",
  guardian: "Legal Guardian",
  parent: "Parent",
  child_of_patient: "Child of Patient",
  spouse: "Spouse",
  sibling: "Sibling",
  other: "Other",
};

const ACCESS_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  full: { label: "Full Access", color: "bg-green-500" },
  limited: { label: "Limited Access", color: "bg-blue-500" },
  view_only: { label: "View Only", color: "bg-yellow-500" },
  emergency_only: { label: "Emergency Only", color: "bg-red-500" },
};

function InviteCaregiverDialog({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("family_caregiver");
  const [accessLevel, setAccessLevel] = useState("limited");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-access/invitation", {
        patientId,
        patientName: "Patient",
        inviteeEmail: email,
        inviteeName: name,
        role,
        accessLevel,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Invitation Sent", 
        description: `An invitation has been sent to ${email}. Code: ${data.data?.invitationCode?.slice(0, 8)}...` 
      });
      setOpen(false);
      setEmail("");
      setName("");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send invitation.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-invite-caregiver">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Caregiver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Caregiver</DialogTitle>
          <DialogDescription>
            Send an invitation to a family member or caregiver to grant them controlled access to health records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Caregiver Name</Label>
            <Input
              id="name"
              placeholder="Enter caregiver's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-caregiver-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="caregiver@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-caregiver-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Relationship</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessLevel">Access Level</Label>
            <Select value={accessLevel} onValueChange={setAccessLevel}>
              <SelectTrigger data-testid="select-access-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCESS_LEVEL_LABELS).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              The caregiver will receive an email with a secure code to accept the invitation. You can revoke access at any time.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-invitation">Cancel</Button>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={!email || !name || mutation.isPending}
            data-testid="button-send-invitation"
          >
            {mutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCareNoteDialog({ patientId, caregiverId, onSuccess }: { patientId: string; caregiverId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState("observation");
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [shareWithTeam, setShareWithTeam] = useState(true);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-access/care-note", {
        caregiverId,
        patientId,
        noteType,
        content,
        severity,
        sharedWithCareTeam: shareWithTeam,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Note Added", description: "Your care note has been saved." });
      setOpen(false);
      setContent("");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-note">
          <Plus className="h-4 w-4 mr-2" />
          Add Care Note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Care Note</DialogTitle>
          <DialogDescription>
            Record observations, concerns, or activities to share with the care team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="caregiver-portal-note-type">Note Type</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger id="caregiver-portal-note-type" data-testid="select-note-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="caregiver-portal-severity">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="caregiver-portal-severity" data-testid="select-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="concerning">Concerning</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="caregiver-portal-note-content">Note Content</Label>
            <Textarea id="caregiver-portal-note-content"
              placeholder="Describe what you observed..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              data-testid="textarea-note-content"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shareWithTeam"
              checked={shareWithTeam}
              onChange={(e) => setShareWithTeam(e.target.checked)}
              className="rounded"
              data-testid="checkbox-share-with-team"
            />
            <Label htmlFor="shareWithTeam" className="text-sm cursor-pointer">
              Share with care team
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-note">Cancel</Button>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={!content || mutation.isPending}
            data-testid="button-save-note"
          >
            {mutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogVitalDialog({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [vitalType, setVitalType] = useState("blood_pressure");
  const [value, setValue] = useState("");
  const [secondaryValue, setSecondaryValue] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        throw new Error("Invalid value");
      }
      const data: any = {
        type: vitalType,
        value: parsedValue,
        unit: VITAL_TYPES.find(t => t.id === vitalType)?.unit || "",
        source: "caregiver",
      };
      if (vitalType === "blood_pressure" && secondaryValue) {
        const parsedSecondary = parseFloat(secondaryValue);
        if (isNaN(parsedSecondary)) {
          throw new Error("Invalid diastolic value");
        }
        data.secondaryValue = parsedSecondary;
      }
      const res = await apiRequest("POST", `/api/patient-health/vitals?userId=${patientId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vital Recorded", description: "The vital sign has been logged." });
      setOpen(false);
      setValue("");
      setSecondaryValue("");
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record vital.", variant: "destructive" });
    },
  });

  const selectedType = VITAL_TYPES.find(t => t.id === vitalType);
  const Icon = selectedType?.icon || Activity;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-log-vital">
          <Heart className="h-4 w-4 mr-2" />
          Log Vital
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Vital Sign</DialogTitle>
          <DialogDescription>
            Record a vital sign reading for the patient.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="caregiver-portal-vital-type">Vital Type</Label>
            <Select value={vitalType} onValueChange={setVitalType}>
              <SelectTrigger id="caregiver-portal-vital-type" data-testid="select-vital-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VITAL_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>{vitalType === "blood_pressure" ? "Systolic" : "Value"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Enter value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  data-testid="input-vital-value"
                />
                <span className="text-sm text-muted-foreground">{selectedType?.unit}</span>
              </div>
            </div>
            {vitalType === "blood_pressure" && (
              <div className="flex-1 space-y-2">
                <Label htmlFor="caregiver-portal-diastolic">Diastolic</Label>
                <Input id="caregiver-portal-diastolic"
                  type="number"
                  placeholder="Enter value"
                  value={secondaryValue}
                  onChange={(e) => setSecondaryValue(e.target.value)}
                  data-testid="input-vital-diastolic"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-vital">Cancel</Button>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={!value || mutation.isPending}
            data-testid="button-save-vital"
          >
            {mutation.isPending ? "Saving..." : "Save Vital"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CriticalAlertsCard({ alerts }: { alerts: CriticalAlert[] }) {
  const urgentAlerts = alerts.filter(a => a.priority === "urgent" || a.priority === "high");

  if (urgentAlerts.length === 0) {
    return (
      <Card data-testid="card-no-alerts">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p>No critical alerts at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/50" data-testid="card-critical-alerts">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-red-600">
          <BellRing className="h-5 w-5" />
          Critical Alerts ({urgentAlerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {urgentAlerts.map((alert) => (
            <Alert key={alert.id} variant="destructive" data-testid={`alert-${alert.id}`}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>
                {alert.message}
                <p className="text-xs mt-1 opacity-70">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PatientHealthSummary({ patientId }: { patientId: string }) {
  const { data: vitalsData, isLoading: vitalsLoading } = useQuery<{ vitals?: any[] }>({
    queryKey: [`/api/patient-health/vitals?userId=${patientId}`],
  });

  const { data: symptomsData, isLoading: symptomsLoading } = useQuery<{ symptoms?: any[] }>({
    queryKey: [`/api/patient-health/symptoms?userId=${patientId}`],
  });

  const { data: adherenceData, isLoading: adherenceLoading } = useQuery<{ score?: any }>({
    queryKey: [`/api/patient-health/adherence/score?userId=${patientId}`],
  });

  const vitals = vitalsData?.vitals || [];
  const symptoms = symptomsData?.symptoms || [];
  const adherenceScore = adherenceData?.score?.score || 0;

  const recentVitals = vitals.slice(0, 4);
  const recentSymptoms = symptoms.slice(0, 3);

  if (vitalsLoading || symptomsLoading || adherenceLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card data-testid="card-care-plan-adherence">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Care Plan Adherence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Adherence</span>
              <span className="font-medium">{adherenceScore}%</span>
            </div>
            <Progress value={adherenceScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-recent-vitals">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentVitals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vitals recorded yet</p>
          ) : (
            <div className="space-y-2">
              {recentVitals.map((vital: any) => {
                const vitalType = VITAL_TYPES.find(t => t.id === vital.type);
                const displayValue = vital.type === "blood_pressure" && vital.secondaryValue
                  ? `${vital.value}/${vital.secondaryValue}`
                  : vital.value;
                return (
                  <div key={vital.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {vitalType && <vitalType.icon className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">{vitalType?.name || vital.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{displayValue}</span>
                      <span className="text-xs text-muted-foreground ml-1">{vital.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-recent-symptoms">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Recent Symptoms
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSymptoms.length === 0 ? (
            <p className="text-muted-foreground text-sm">No symptoms logged</p>
          ) : (
            <div className="space-y-2">
              {recentSymptoms.map((symptom: any) => (
                <div key={symptom.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm capitalize">{symptom.symptom.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className={
                    symptom.severity === "severe" ? "text-red-600 border-red-500" :
                    symptom.severity === "moderate" ? "text-yellow-600 border-yellow-500" :
                    "text-green-600 border-green-500"
                  }>
                    {symptom.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentsCard({ patientId }: { patientId: string }) {
  const mockAppointments = [
    { id: "1", date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Smith", type: "Follow-up", location: "Main Clinic" },
    { id: "2", date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Johnson", type: "Lab Work", location: "Lab Center" },
    { id: "3", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Williams", type: "Annual Physical", location: "Health Center" },
  ];

  return (
    <Card data-testid="card-appointments">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Appointments
          </CardTitle>
          <Button variant="outline" size="sm" data-testid="button-schedule-appointment">
            <Plus className="h-4 w-4 mr-1" />
            Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockAppointments.map((apt) => (
            <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate" data-testid={`appointment-${apt.id}`}>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{apt.type}</p>
                <p className="text-sm text-muted-foreground">{apt.provider}</p>
                <p className="text-xs text-muted-foreground">{apt.location}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{new Date(apt.date).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(apt.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CareNotesTab({ patientId, caregiverId }: { patientId: string; caregiverId: string }) {
  const { data: notesData, isLoading, refetch } = useQuery<{ success: boolean; data: CareNote[] }>({
    queryKey: [`/api/caregiver-access/care-notes/${patientId}`],
  });

  const notes = notesData?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Care Notes</h3>
        <AddCareNoteDialog 
          patientId={patientId} 
          caregiverId={caregiverId} 
          onSuccess={() => refetch()} 
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No care notes yet. Add your first note to track observations.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {notes.map((note) => (
              <Card key={note.id} data-testid={`note-${note.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline">{note.noteType.replace(/_/g, " ")}</Badge>
                    {note.severity && note.severity !== "normal" && (
                      <Badge variant={note.severity === "urgent" ? "destructive" : "secondary"}>
                        {note.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{note.content}</p>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                    {note.sharedWithCareTeam && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface CareTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToName?: string;
  createdByName: string;
  dueDate?: string;
  dueTime?: string;
  notes: string[];
  createdAt: string;
}

interface SharedNote {
  id: string;
  authorName: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  reactions: { userName: string; reaction: string }[];
  comments: { authorName: string; content: string; createdAt: string }[];
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  startTime: string;
  endTime?: string;
  location?: string;
  assignedToName?: string;
  createdByName: string;
  color?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-green-500 text-white",
};

const CATEGORY_ICONS: Record<string, typeof Pill> = {
  medication: Pill,
  appointment: Calendar,
  hygiene: User,
  nutrition: Heart,
  exercise: Activity,
  monitoring: Stethoscope,
  transportation: Calendar,
  companionship: Users,
  other: FileText,
};

interface MedicationSchedule {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  instructions?: string;
  prescribedBy?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  refillsRemaining?: number;
  isActive: boolean;
  notificationSettings: {
    enablePush: boolean;
    enableSms: boolean;
    enableEmail: boolean;
    advanceMinutes: number;
    caregiverAlert: boolean;
    missedDoseAlert: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface MedicationLog {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  scheduleId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  actualTime: string;
  status: "administered" | "refused" | "skipped" | "partial" | "late";
  notes?: string;
  createdAt: string;
}

interface RefillRequest {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  medicationId: string;
  medicationName: string;
  prescriptionId?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  status: "pending" | "submitted" | "processing" | "approved" | "denied" | "ready" | "completed";
  requestedAt: string;
  notes?: string;
  urgency: "routine" | "urgent" | "emergency";
  deliveryPreference: "pickup" | "delivery" | "mail";
  updatedAt: string;
}

interface InteractionWarning {
  id: string;
  patientId: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  medication1: string;
  medication2: string;
  description: string;
  recommendation: string;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

type SeverityLevel = "minor" | "moderate" | "major" | "contraindicated";

function MedicationsTab({ patientId, caregiverId }: { patientId: string; caregiverId: string }) {
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [logIntakeOpen, setLogIntakeOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<MedicationSchedule | null>(null);
  const [newMed, setNewMed] = useState({
    medicationName: "",
    dosage: "",
    frequency: "once_daily",
    scheduledTimes: ["08:00"],
    instructions: "",
    prescribedBy: "",
    pharmacyName: "",
  });
  const { toast } = useToast();

  const { data: schedulesData, isLoading: loadingSchedules, refetch: refetchSchedules } = useQuery<{ success: boolean; data: MedicationSchedule[] }>({
    queryKey: [`/api/caregiver-medication/schedules/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-medication/schedules/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
  });

  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useQuery<{ success: boolean; data: any }>({
    queryKey: [`/api/caregiver-medication/today/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-medication/today/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch today's medications");
      return res.json();
    },
  });

  const { data: warningsData } = useQuery<{ success: boolean; data: InteractionWarning[] }>({
    queryKey: [`/api/caregiver-medication/warnings/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-medication/warnings/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch warnings");
      return res.json();
    },
  });

  const { data: refillsData, refetch: refetchRefills } = useQuery<{ success: boolean; data: RefillRequest[] }>({
    queryKey: [`/api/caregiver-medication/refills/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-medication/refills/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch refills");
      return res.json();
    },
  });

  const { data: statsData } = useQuery<{ success: boolean; data: any }>({
    queryKey: [`/api/caregiver-medication/stats/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-medication/stats/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}&days=30`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-medication/schedules", {
        patientId,
        caregiverId,
        caregiverName: "Caregiver",
        medicationName: newMed.medicationName,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        scheduledTimes: newMed.scheduledTimes,
        instructions: newMed.instructions,
        pharmacyName: newMed.pharmacyName,
        startDate: new Date().toISOString(),
        isActive: true,
        notificationSettings: {
          enablePush: true,
          enableSms: false,
          enableEmail: true,
          advanceMinutes: 30,
          caregiverAlert: true,
          missedDoseAlert: true,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Medication Added", description: "The medication schedule has been created." });
      setAddMedOpen(false);
      setNewMed({ medicationName: "", dosage: "", frequency: "once_daily", scheduledTimes: ["08:00"], instructions: "", prescribedBy: "", pharmacyName: "" });
      refetchSchedules();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add medication. Please try again.", variant: "destructive" });
    },
  });

  const logIntakeMutation = useMutation({
    mutationFn: async ({ medicationId, status, notes }: { medicationId: string; status: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/caregiver-medication/logs", {
        patientId,
        caregiverId,
        caregiverName: "Caregiver",
        scheduleId: selectedMed?.id || "",
        medicationId: selectedMed?.medicationId || medicationId,
        medicationName: selectedMed?.medicationName || "Unknown",
        dosage: selectedMed?.dosage || "",
        scheduledTime: new Date().toISOString(),
        actualTime: new Date().toISOString(),
        status: status === "taken" ? "administered" : status === "missed" ? "refused" : status,
        notes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Logged", description: "Medication intake has been recorded." });
      setLogIntakeOpen(false);
      setSelectedMed(null);
      refetchToday();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log intake. Please try again.", variant: "destructive" });
    },
  });

  const requestRefillMutation = useMutation({
    mutationFn: async (med: MedicationSchedule) => {
      const res = await apiRequest("POST", "/api/caregiver-medication/refills", {
        patientId,
        caregiverId,
        caregiverName: "Caregiver",
        medicationId: med.medicationId,
        medicationName: med.medicationName,
        pharmacyId: med.pharmacyId,
        pharmacyName: med.pharmacyName || "Default Pharmacy",
        urgency: "routine",
        deliveryPreference: "pickup",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refill Requested", description: "Your refill request has been submitted to the pharmacy." });
      refetchRefills();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request refill. Please try again.", variant: "destructive" });
    },
  });

  const schedules = schedulesData?.data || [];
  const todayMeds = todayData?.data || { pending: [], completed: [], upcoming: [] };
  const warnings = warningsData?.data || [];
  const refills = refillsData?.data || [];
  const stats = statsData?.data || { adherenceRate: 0, taken: 0, missed: 0, skipped: 0 };
  const activeWarnings = warnings.filter(w => !w.acknowledged && (w.severity === "major" || w.severity === "contraindicated"));

  const frequencyLabels: Record<string, string> = {
    once_daily: "Once daily",
    twice_daily: "Twice daily",
    three_times_daily: "3 times daily",
    four_times_daily: "4 times daily",
    weekly: "Weekly",
    as_needed: "As needed",
    custom: "Custom",
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "contraindicated": return "bg-red-500 text-white";
      case "major": return "bg-orange-500 text-white";
      case "moderate": return "bg-yellow-500 text-black";
      case "minor": return "bg-blue-500 text-white";
      default: return "bg-blue-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "administered": return "text-green-600";
      case "taken": return "text-green-600";
      case "late": return "text-yellow-600";
      case "partial": return "text-yellow-600";
      case "skipped":
      case "refused":
      case "missed": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getRefillStatusBadge = (status: string) => {
    switch (status) {
      case "ready": return <Badge className="bg-green-500" data-testid="badge-status-ready">Ready for Pickup</Badge>;
      case "approved": return <Badge className="bg-blue-500" data-testid="badge-status-approved">Approved</Badge>;
      case "processing": return <Badge className="bg-purple-500" data-testid="badge-status-processing">Processing</Badge>;
      case "submitted": return <Badge className="bg-yellow-500 text-black" data-testid="badge-status-submitted">Submitted</Badge>;
      case "pending": return <Badge variant="secondary" data-testid="badge-status-pending">Pending</Badge>;
      case "completed": return <Badge variant="outline" data-testid="badge-status-completed">Completed</Badge>;
      case "denied": return <Badge variant="destructive" data-testid="badge-status-denied">Denied</Badge>;
      default: return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  if (loadingSchedules) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="medications-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="medications-tab">
      {activeWarnings.length > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20" data-testid="card-interaction-warnings">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Drug Interaction Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeWarnings.map((warning) => (
                <div key={warning.id} className="p-3 bg-white dark:bg-background rounded-md border" data-testid={`warning-${warning.id}`}>
                  <div className="flex items-start gap-3">
                    <Badge className={getSeverityColor(warning.severity)} data-testid={`badge-severity-${warning.severity}`}>
                      {warning.severity.toUpperCase()}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">{warning.medication1} + {warning.medication2}</p>
                      <p className="text-sm text-muted-foreground mt-1">{warning.description}</p>
                      <p className="text-sm mt-2"><strong>Recommendation:</strong> {warning.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 italic">
              This information is for educational purposes only and is not medical advice. Always consult with a healthcare provider.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-adherence-rate">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary" data-testid="value-adherence-rate">{stats.adherenceRate}%</div>
              <p className="text-sm text-muted-foreground">30-Day Adherence</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-taken-count">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600" data-testid="value-taken-count">{stats.taken}</div>
              <p className="text-sm text-muted-foreground">Doses Taken</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-missed-count">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600" data-testid="value-missed-count">{stats.missed}</div>
              <p className="text-sm text-muted-foreground">Doses Missed</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-meds">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold" data-testid="value-active-meds">{schedules.filter(s => s.isActive).length}</div>
              <p className="text-sm text-muted-foreground">Active Medications</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-today-medications">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today's Medications
            </span>
            <Button variant="outline" size="sm" onClick={() => refetchToday()} data-testid="button-refresh-today">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingToday ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {todayMeds.pending?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-orange-500" />
                    Pending ({todayMeds.pending.length})
                  </h4>
                  <div className="space-y-2">
                    {todayMeds.pending.map((med: any) => (
                      <div key={med.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md" data-testid={`pending-med-${med.id}`}>
                        <div>
                          <p className="font-medium">{med.medicationName}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage} - {med.scheduledTime}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => { setSelectedMed(med); setLogIntakeOpen(true); }}
                            data-testid={`button-log-${med.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Log
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {todayMeds.completed?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Completed ({todayMeds.completed.length})
                  </h4>
                  <div className="space-y-2">
                    {todayMeds.completed.map((med: any) => (
                      <div key={med.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-md" data-testid={`completed-med-${med.id}`}>
                        <div>
                          <p className="font-medium">{med.medicationName}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage} - Taken at {med.actualTime || med.scheduledTime}</p>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          {med.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todayMeds.upcoming?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Upcoming ({todayMeds.upcoming.length})
                  </h4>
                  <div className="space-y-2">
                    {todayMeds.upcoming.map((med: any) => (
                      <div key={med.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md" data-testid={`upcoming-med-${med.id}`}>
                        <div>
                          <p className="font-medium">{med.medicationName}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage} - Scheduled for {med.scheduledTime}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!todayMeds.pending?.length && !todayMeds.completed?.length && !todayMeds.upcoming?.length && (
                <p className="text-center text-muted-foreground py-4">No medications scheduled for today</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-medication-schedules">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Medication Schedules
            </span>
            <Dialog open={addMedOpen} onOpenChange={setAddMedOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-medication">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Medication
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Medication</DialogTitle>
                  <DialogDescription>Set up a medication schedule with reminders</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="medName">Medication Name</Label>
                    <Input
                      id="medName"
                      value={newMed.medicationName}
                      onChange={(e) => setNewMed({ ...newMed, medicationName: e.target.value })}
                      placeholder="e.g., Lisinopril"
                      data-testid="input-medication-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input
                      id="dosage"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                      placeholder="e.g., 10mg"
                      data-testid="input-dosage"
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={newMed.frequency} onValueChange={(val) => setNewMed({ ...newMed, frequency: val })}>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once_daily">Once daily</SelectItem>
                        <SelectItem value="twice_daily">Twice daily</SelectItem>
                        <SelectItem value="three_times_daily">3 times daily</SelectItem>
                        <SelectItem value="four_times_daily">4 times daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="as_needed">As needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="instructions">Special Instructions</Label>
                    <Textarea
                      id="instructions"
                      value={newMed.instructions}
                      onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                      placeholder="e.g., Take with food"
                      data-testid="input-instructions"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pharmacy">Pharmacy</Label>
                    <Input
                      id="pharmacy"
                      value={newMed.pharmacyName}
                      onChange={(e) => setNewMed({ ...newMed, pharmacyName: e.target.value })}
                      placeholder="e.g., CVS Pharmacy"
                      data-testid="input-pharmacy"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddMedOpen(false)} data-testid="button-cancel-add">Cancel</Button>
                  <Button 
                    onClick={() => createScheduleMutation.mutate()} 
                    disabled={!newMed.medicationName || !newMed.dosage || createScheduleMutation.isPending}
                    data-testid="button-save-medication"
                  >
                    {createScheduleMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Medication
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8">
              <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No medications scheduled yet</p>
              <Button variant="outline" className="mt-4" onClick={() => setAddMedOpen(true)} data-testid="button-add-first-med">
                <Plus className="h-4 w-4 mr-2" />
                Add First Medication
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div 
                  key={schedule.id} 
                  className={`p-4 rounded-lg border ${schedule.isActive ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
                  data-testid={`schedule-${schedule.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{schedule.medicationName}</h4>
                        {!schedule.isActive && <Badge variant="secondary">Inactive</Badge>}
                        {schedule.refillsRemaining !== undefined && schedule.refillsRemaining <= 2 && (
                          <Badge variant="outline" className="text-orange-600" data-testid="badge-low-refills">
                            {schedule.refillsRemaining} refills left
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {schedule.dosage} • {frequencyLabels[schedule.frequency] || schedule.frequency}
                      </p>
                      {schedule.instructions && (
                        <p className="text-sm mt-1 italic">{schedule.instructions}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {schedule.scheduledTimes?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.scheduledTimes.join(", ")}
                          </span>
                        )}
                        {schedule.pharmacyName && (
                          <span>{schedule.pharmacyName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {schedule.isActive && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => { setSelectedMed(schedule); setLogIntakeOpen(true); }}
                            data-testid={`button-log-schedule-${schedule.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          {schedule.pharmacyName && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => requestRefillMutation.mutate(schedule)}
                              disabled={requestRefillMutation.isPending}
                              data-testid={`button-refill-${schedule.id}`}
                            >
                              <RefreshCw className={`h-4 w-4 ${requestRefillMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {refills.length > 0 && (
        <Card data-testid="card-refill-requests">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Refill Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {refills.map((refill) => (
                <div key={refill.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`refill-${refill.id}`}>
                  <div>
                    <p className="font-medium">{refill.medicationName}</p>
                    <p className="text-sm text-muted-foreground">{refill.pharmacy}</p>
                    <p className="text-xs text-muted-foreground">Requested: {new Date(refill.requestedAt).toLocaleDateString()}</p>
                  </div>
                  {getRefillStatusBadge(refill.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={logIntakeOpen} onOpenChange={setLogIntakeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Medication Intake</DialogTitle>
            <DialogDescription>
              {selectedMed ? `Record intake for ${selectedMed.medicationName} (${selectedMed.dosage})` : 'Record medication intake'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col"
                onClick={() => logIntakeMutation.mutate({ medicationId: selectedMed?.id || '', status: 'taken' })}
                disabled={logIntakeMutation.isPending}
                data-testid="button-status-taken"
              >
                <CheckCircle2 className="h-6 w-6 text-green-600 mb-1" />
                Taken
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col"
                onClick={() => logIntakeMutation.mutate({ medicationId: selectedMed?.id || '', status: 'late' })}
                disabled={logIntakeMutation.isPending}
                data-testid="button-status-late"
              >
                <Clock className="h-6 w-6 text-yellow-600 mb-1" />
                Taken Late
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col"
                onClick={() => logIntakeMutation.mutate({ medicationId: selectedMed?.id || '', status: 'skipped' })}
                disabled={logIntakeMutation.isPending}
                data-testid="button-status-skipped"
              >
                <AlertTriangle className="h-6 w-6 text-orange-600 mb-1" />
                Skipped
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col"
                onClick={() => logIntakeMutation.mutate({ medicationId: selectedMed?.id || '', status: 'missed' })}
                disabled={logIntakeMutation.isPending}
                data-testid="button-status-missed"
              >
                <AlertTriangle className="h-6 w-6 text-red-600 mb-1" />
                Missed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TasksTab({ patientId, caregiverId }: { patientId: string; caregiverId: string }) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", category: "other", priority: "medium", dueDate: "" });
  const { toast } = useToast();

  const { data: tasksData, isLoading, refetch } = useQuery<{ success: boolean; data: CareTask[] }>({
    queryKey: [`/api/caregiver-collaboration/tasks/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-collaboration/tasks/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-collaboration/tasks", {
        patientId,
        createdBy: caregiverId,
        createdByName: "Caregiver",
        ...newTask,
        status: "pending",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task Created", description: "The task has been added to the care plan." });
      setAddTaskOpen(false);
      setNewTask({ title: "", description: "", category: "other", priority: "medium", dueDate: "" });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task. Please try again.", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/caregiver-collaboration/tasks/${taskId}/status`, {
        userId: caregiverId,
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task Updated", description: "Task status has been updated." });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task. Please try again.", variant: "destructive" });
    },
  });

  const tasks = tasksData?.data || [];
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Care Tasks</h3>
        <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-task">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Care Task</DialogTitle>
              <DialogDescription>Assign a task to coordinate care responsibilities</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-task-title">Task Title</Label>
                <Input id="caregiver-portal-task-title"
                  placeholder="e.g., Administer morning medication"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  data-testid="input-task-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-description">Description</Label>
                <Textarea id="caregiver-portal-description"
                  placeholder="Additional details..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  data-testid="textarea-task-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="caregiver-portal-category">Category</Label>
                  <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                    <SelectTrigger id="caregiver-portal-category" data-testid="select-task-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="hygiene">Hygiene</SelectItem>
                      <SelectItem value="nutrition">Nutrition</SelectItem>
                      <SelectItem value="exercise">Exercise</SelectItem>
                      <SelectItem value="monitoring">Monitoring</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caregiver-portal-priority">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger id="caregiver-portal-priority" data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-due-date">Due Date</Label>
                <Input id="caregiver-portal-due-date"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTaskOpen(false)} data-testid="button-cancel-task">Cancel</Button>
              <Button onClick={() => createTaskMutation.mutate()} disabled={!newTask.title || createTaskMutation.isPending} data-testid="button-save-task">
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No care tasks yet. Create your first task to coordinate care.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Pending Tasks ({pendingTasks.length})</h4>
              {pendingTasks.map((task) => {
                const CategoryIcon = CATEGORY_ICONS[task.category] || FileText;
                return (
                  <Card key={task.id} className="hover-elevate" data-testid={`task-${task.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <CategoryIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-medium">{task.title}</p>
                              <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                            {task.assignedToName && (
                              <p className="text-xs text-muted-foreground mt-1">Assigned to: {task.assignedToName}</p>
                            )}
                            {task.dueDate && (
                              <p className="text-xs text-muted-foreground">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: "completed" })}
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Completed ({completedTasks.length})</h4>
              {completedTasks.slice(0, 3).map((task) => (
                <Card key={task.id} className="opacity-60" data-testid={`task-completed-${task.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="line-through">{task.title}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamNotesTab({ patientId, caregiverId }: { patientId: string; caregiverId: string }) {
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", content: "", category: "general", isPinned: false });
  const { toast } = useToast();

  const { data: notesData, isLoading, refetch } = useQuery<{ success: boolean; data: SharedNote[] }>({
    queryKey: [`/api/caregiver-collaboration/notes/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-collaboration/notes/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-collaboration/notes", {
        patientId,
        authorId: caregiverId,
        authorName: "Caregiver",
        ...newNote,
        visibility: "all_caregivers",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Note Shared", description: "Your note has been shared with the care team." });
      setAddNoteOpen(false);
      setNewNote({ title: "", content: "", category: "general", isPinned: false });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to share note. Please try again.", variant: "destructive" });
    },
  });

  const notes = notesData?.data || [];
  const pinnedNotes = notes.filter(n => n.isPinned);
  const regularNotes = notes.filter(n => !n.isPinned);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Team Notes</h3>
        <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-team-note">
              <Plus className="h-4 w-4 mr-2" />
              Share Note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Note with Team</DialogTitle>
              <DialogDescription>Share important information with other caregivers</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-title">Title</Label>
                <Input id="caregiver-portal-title"
                  placeholder="Note title..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  data-testid="input-team-note-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-content">Content</Label>
                <Textarea id="caregiver-portal-content"
                  placeholder="Share important information..."
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  data-testid="textarea-team-note-content"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-category-2">Category</Label>
                <Select value={newNote.category} onValueChange={(v) => setNewNote({ ...newNote, category: v })}>
                  <SelectTrigger id="caregiver-portal-category-2" data-testid="select-note-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="dietary">Dietary</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="handoff">Shift Handoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddNoteOpen(false)} data-testid="button-cancel-team-note">Cancel</Button>
              <Button onClick={() => createNoteMutation.mutate()} disabled={!newNote.title || !newNote.content || createNoteMutation.isPending} data-testid="button-save-team-note">
                {createNoteMutation.isPending ? "Sharing..." : "Share Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No team notes yet. Share your first note to coordinate with other caregivers.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4 pr-4">
            {pinnedNotes.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" /> Pinned
                </h4>
                {pinnedNotes.map((note) => (
                  <Card key={note.id} className="border-primary/30 bg-primary/5" data-testid={`note-pinned-${note.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{note.title}</CardTitle>
                          <CardDescription>{note.authorName} - {new Date(note.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <Badge variant="outline">{note.category}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{note.content}</p>
                      {note.comments.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">{note.comments.length} comment(s)</p>
                          {note.comments.slice(0, 2).map((comment, i) => (
                            <div key={i} className="text-xs bg-muted p-2 rounded">
                              <span className="font-medium">{comment.authorName}:</span> {comment.content}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {regularNotes.map((note) => (
              <Card key={note.id} data-testid={`note-team-${note.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{note.title}</CardTitle>
                      <CardDescription>{note.authorName} - {new Date(note.createdAt).toLocaleDateString()}</CardDescription>
                    </div>
                    <Badge variant="outline">{note.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{note.content}</p>
                  {note.comments.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">{note.comments.length} comment(s)</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function SharedCalendarTab({ patientId, caregiverId }: { patientId: string; caregiverId: string }) {
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", eventType: "appointment", startTime: "", location: "" });
  const { toast } = useToast();

  const { data: eventsData, isLoading, refetch } = useQuery<{ success: boolean; data: CalendarEvent[] }>({
    queryKey: [`/api/caregiver-collaboration/calendar/${patientId}`, { caregiverId }],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver-collaboration/calendar/${patientId}?caregiverId=${encodeURIComponent(caregiverId)}`);
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      return res.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/caregiver-collaboration/calendar", {
        patientId,
        createdBy: caregiverId,
        createdByName: "Caregiver",
        ...newEvent,
        allDay: false,
        reminders: [{ minutesBefore: 60, notifyVia: ["push"] }],
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event Created", description: "The event has been added to the shared calendar." });
      setAddEventOpen(false);
      setNewEvent({ title: "", description: "", eventType: "appointment", startTime: "", location: "" });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event. Please try again.", variant: "destructive" });
    },
  });

  const events = eventsData?.data || [];
  const upcomingEvents = events.filter(e => new Date(e.startTime) >= new Date()).slice(0, 10);

  const EVENT_TYPE_COLORS: Record<string, string> = {
    appointment: "border-l-red-500",
    medication: "border-l-blue-500",
    task: "border-l-green-500",
    shift: "border-l-purple-500",
    reminder: "border-l-yellow-500",
    other: "border-l-gray-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Shared Calendar</h3>
        <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-calendar-event">
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Calendar Event</DialogTitle>
              <DialogDescription>Schedule an appointment or caregiving duty</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-event-title">Event Title</Label>
                <Input id="caregiver-portal-event-title"
                  placeholder="e.g., Doctor appointment"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  data-testid="input-event-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="caregiver-portal-event-type">Event Type</Label>
                  <Select value={newEvent.eventType} onValueChange={(v) => setNewEvent({ ...newEvent, eventType: v })}>
                    <SelectTrigger id="caregiver-portal-event-type" data-testid="select-event-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="shift">Caregiver Shift</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caregiver-portal-date-time">Date & Time</Label>
                  <Input id="caregiver-portal-date-time"
                    type="datetime-local"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    data-testid="input-event-datetime"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-location-optional">Location (optional)</Label>
                <Input id="caregiver-portal-location-optional"
                  placeholder="e.g., Main Clinic"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  data-testid="input-event-location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caregiver-portal-description-optional">Description (optional)</Label>
                <Textarea id="caregiver-portal-description-optional"
                  placeholder="Additional details..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  data-testid="textarea-event-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddEventOpen(false)} data-testid="button-cancel-event">Cancel</Button>
              <Button onClick={() => createEventMutation.mutate()} disabled={!newEvent.title || !newEvent.startTime || createEventMutation.isPending} data-testid="button-save-event">
                {createEventMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : upcomingEvents.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No upcoming events. Add events to the shared calendar to coordinate care.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <Card key={event.id} className={`border-l-4 ${EVENT_TYPE_COLORS[event.eventType]}`} data-testid={`event-${event.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{event.title}</p>
                      {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                      {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
                      {event.assignedToName && <p className="text-xs text-muted-foreground">Assigned: {event.assignedToName}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(event.startTime).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Badge variant="outline" className="mt-1 capitalize">{event.eventType}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CaregiversManagementTab({ patientId }: { patientId: string }) {
  const { data: caregiversData, isLoading, refetch } = useQuery<{ success: boolean; data: CaregiverAccess[] }>({
    queryKey: [`/api/caregiver-access/patient/${patientId}/caregivers`],
  });

  const caregivers = caregiversData?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Manage Caregivers</h3>
        <InviteCaregiverDialog patientId={patientId} onSuccess={() => refetch()} />
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Control who has access to health records. You can revoke access at any time.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : caregivers.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No caregivers added yet. Invite family members or caregivers to help manage health records.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {caregivers.map((caregiver) => (
            <Card key={caregiver.id} data-testid={`caregiver-${caregiver.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{caregiver.caregiverName}</p>
                      <p className="text-sm text-muted-foreground">{caregiver.caregiverEmail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{ROLE_LABELS[caregiver.role] || caregiver.role}</Badge>
                        <Badge className={ACCESS_LEVEL_LABELS[caregiver.accessLevel]?.color || "bg-gray-500"}>
                          {ACCESS_LEVEL_LABELS[caregiver.accessLevel]?.label || caregiver.accessLevel}
                        </Badge>
                        {caregiver.isPrimary && (
                          <Badge variant="secondary">Primary</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-600" data-testid={`button-revoke-${caregiver.id}`}>
                    Revoke
                  </Button>
                </div>
                {caregiver.lastAccessAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last accessed: {new Date(caregiver.lastAccessAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CaregiverPortal() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [isPatientView, setIsPatientView] = useState(false);

  const mockAlerts: CriticalAlert[] = [
    {
      id: "1",
      type: "medication_alert",
      priority: "high",
      title: "Missed Medication",
      message: "Morning blood pressure medication was not taken today.",
      patientId: SAMPLE_PATIENT_ID,
      patientName: "Jane Smith",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      requiresAction: true,
    },
  ];

  const patientId = SAMPLE_PATIENT_ID;
  const caregiverId = SAMPLE_CAREGIVER_ID;

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="page-title">
            <Users className="h-8 w-8 text-primary" />
            Caregiver Portal
          </h1>
          <p className="text-lg text-muted-foreground mt-1" data-testid="text-page-description">
            Manage patient care, access health records, and coordinate with the care team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isPatientView ? "default" : "outline"} 
            size="sm" 
            onClick={() => setIsPatientView(!isPatientView)}
            data-testid="button-toggle-view"
          >
            <Eye className="h-4 w-4 mr-2" />
            {isPatientView ? "Caregiver View" : "Patient View"}
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/30" data-testid="info-alert">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          {isPatientView 
            ? "You are viewing as a patient. Manage who has access to your health records."
            : "You are viewing as a caregiver. All actions are logged for patient safety and HIPAA compliance."
          }
        </AlertDescription>
      </Alert>

      <CriticalAlertsCard alerts={mockAlerts} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-elevate" data-testid="card-stat-patients">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-patient-count">1</p>
                <p className="text-sm text-muted-foreground">Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-stat-appointments">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-stat-alerts">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Bell className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockAlerts.filter(a => !a.isRead).length}</p>
                <p className="text-sm text-muted-foreground">Unread Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-stat-access">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Full</p>
                <p className="text-sm text-muted-foreground">Access Level</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-9 md:w-auto md:inline-grid">
          <TabsTrigger value="dashboard" className="flex items-center gap-2" data-testid="tab-dashboard">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden md:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-2" data-testid="tab-medications">
            <Pill className="h-4 w-4" />
            <span className="hidden md:inline">Medications</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2" data-testid="tab-tasks">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden md:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
            <Calendar className="h-4 w-4" />
            <span className="hidden md:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="team-notes" className="flex items-center gap-2" data-testid="tab-team-notes">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Team Notes</span>
          </TabsTrigger>
          <TabsTrigger value="log-data" className="flex items-center gap-2" data-testid="tab-log-data">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">Log Data</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2" data-testid="tab-notes">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Care Notes</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2" data-testid="tab-manage">
            <Shield className="h-4 w-4" />
            <span className="hidden md:inline">Access</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PatientHealthSummary patientId={patientId} />
            <AppointmentsCard patientId={patientId} />
          </div>
        </TabsContent>

        <TabsContent value="medications" className="mt-6">
          <MedicationsTab patientId={patientId} caregiverId={caregiverId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TasksTab patientId={patientId} caregiverId={caregiverId} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <SharedCalendarTab patientId={patientId} caregiverId={caregiverId} />
        </TabsContent>

        <TabsContent value="team-notes" className="mt-6">
          <TeamNotesTab patientId={patientId} caregiverId={caregiverId} />
        </TabsContent>

        <TabsContent value="log-data" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Log Health Data
              </CardTitle>
              <CardDescription>
                Record vitals, symptoms, and observations for the patient
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <LogVitalDialog patientId={patientId} onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/patient-health/vitals`] })} />
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="pt-6 text-center">
                    <AddCareNoteDialog 
                      patientId={patientId} 
                      caregiverId={caregiverId} 
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/caregiver-access/care-notes`] })} 
                    />
                  </CardContent>
                </Card>
                <Card className="hover-elevate">
                  <CardContent className="pt-6 text-center">
                    <Button variant="outline" data-testid="button-log-medication">
                      <Pill className="h-4 w-4 mr-2" />
                      Log Medication
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <CareNotesTab patientId={patientId} caregiverId={caregiverId} />
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <CaregiversManagementTab patientId={patientId} />
        </TabsContent>
      </Tabs>

      <Alert className="bg-muted" data-testid="alert-disclaimer">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          This portal is designed for caregivers to assist with health record management. 
          All data access and modifications are logged for HIPAA compliance and patient safety. 
          For medical emergencies, please contact emergency services immediately.
        </AlertDescription>
      </Alert>
    </div>
  );
}
