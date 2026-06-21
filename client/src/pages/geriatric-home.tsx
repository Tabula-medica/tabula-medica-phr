import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAccessibility } from "@/components/accessibility-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Pill, 
  Calendar, 
  Bell, 
  MessageSquare, 
  User, 
  Phone, 
  Mail, 
  Share2, 
  Printer, 
  Upload, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertTriangle,
  Heart,
  FileText,
  Users,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  Eye,
  Zap,
  Plus,
  X,
  Info
} from "lucide-react";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string[];
  purpose: string;
  prescribedBy: string;
  pharmacy: string;
  startDate: string;
  endDate?: string;
  stopReason?: string;
  sideEffects: string[];
  instructions: string;
  refillDate?: string;
  isActive: boolean;
  scheduledTimes?: string[];
  takenToday?: { time: string; taken: boolean }[];
}

interface Appointment {
  id: string;
  providerName: string;
  specialty: string;
  facilityName: string;
  scheduledAt: string;
  purpose: string;
  instructions?: string;
}

interface RecentChange {
  id: string;
  type: "medication" | "appointment" | "lab_result" | "document" | "vitals";
  title: string;
  description: string;
  changedAt: string;
  changedBy: string;
}

interface CaregiverNote {
  id: string;
  caregiverName: string;
  note: string;
  createdAt: string;
  priority: "low" | "normal" | "high";
  category: "medication" | "appointment" | "general" | "concern";
}

interface CaregiverProfile {
  id: string;
  name: string;
  relationship: string;
  email: string;
  phone: string;
  accessLevel: "full" | "limited" | "view_only";
  canReceiveReminders: boolean;
  canUploadDocuments: boolean;
  canPrintPacket: boolean;
  addedAt: string;
}

export default function GeriatricHome() {
  const { toast } = useToast();
  const { settings, updateSetting } = useAccessibility();
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [showSideEffectDialog, setShowSideEffectDialog] = useState(false);
  const [showStopMedDialog, setShowStopMedDialog] = useState(false);
  const [showInviteCaregiverDialog, setShowInviteCaregiverDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [sideEffectText, setSideEffectText] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [newNote, setNewNote] = useState({ note: "", priority: "normal", category: "general" });
  const [inviteData, setInviteData] = useState({ name: "", email: "", relationship: "", accessLevel: "limited" });

  const { data: todayMedsData, isLoading: medsLoading } = useQuery<{ data: Medication[] }>({
    queryKey: ["/api/geriatric/medications/today"],
  });

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<{ data: Appointment[] }>({
    queryKey: ["/api/geriatric/appointments/upcoming"],
  });

  const { data: changesData, isLoading: changesLoading } = useQuery<{ data: RecentChange[] }>({
    queryKey: ["/api/geriatric/recent-changes"],
  });

  const { data: notesData, isLoading: notesLoading } = useQuery<{ data: CaregiverNote[] }>({
    queryKey: ["/api/geriatric/caregiver-notes"],
  });

  const { data: caregiversData, isLoading: caregiversLoading } = useQuery<{ data: CaregiverProfile[] }>({
    queryKey: ["/api/geriatric/caregivers"],
  });

  const { data: allMedsData } = useQuery<{ data: Medication[] }>({
    queryKey: ["/api/geriatric/medications/all"],
  });

  const todayMeds = todayMedsData?.data || [];
  const appointments = appointmentsData?.data || [];
  const recentChanges = changesData?.data || [];
  const caregiverNotes = notesData?.data || [];
  const caregivers = caregiversData?.data || [];
  const allMeds = allMedsData?.data || [];

  const recordSideEffectMutation = useMutation({
    mutationFn: async ({ medId, sideEffect }: { medId: string; sideEffect: string }) => {
      return apiRequest("POST", `/api/geriatric/medications/${medId}/side-effects`, { sideEffect, notes: sideEffectText });
    },
    onSuccess: () => {
      toast({ title: "Side effect recorded", description: "Your doctor will be notified." });
      setShowSideEffectDialog(false);
      setSideEffectText("");
      queryClient.invalidateQueries({ queryKey: ["/api/geriatric/medications/today"] });
    },
  });

  const stopMedicationMutation = useMutation({
    mutationFn: async ({ medId, reason }: { medId: string; reason: string }) => {
      return apiRequest("POST", `/api/geriatric/medications/${medId}/stop`, { reason, stoppedDate: new Date().toISOString() });
    },
    onSuccess: () => {
      toast({ title: "Medication stopped", description: "Record updated successfully." });
      setShowStopMedDialog(false);
      setStopReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/geriatric/medications"] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteData: typeof newNote) => {
      return apiRequest("POST", "/api/geriatric/caregiver-notes", noteData);
    },
    onSuccess: () => {
      toast({ title: "Note added", description: "Your note has been saved." });
      setShowAddNoteDialog(false);
      setNewNote({ note: "", priority: "normal", category: "general" });
      queryClient.invalidateQueries({ queryKey: ["/api/geriatric/caregiver-notes"] });
    },
  });

  const inviteCaregiverMutation = useMutation({
    mutationFn: async (data: typeof inviteData) => {
      return apiRequest("POST", "/api/geriatric/caregivers/invite", data);
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "A share link has been sent to the caregiver." });
      setShowInviteCaregiverDialog(false);
      setInviteData({ name: "", email: "", relationship: "", accessLevel: "limited" });
      queryClient.invalidateQueries({ queryKey: ["/api/geriatric/caregivers"] });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "medication": return <Pill className="h-6 w-6" />;
      case "appointment": return <Calendar className="h-6 w-6" />;
      case "lab_result": return <FileText className="h-6 w-6" />;
      case "vitals": return <Heart className="h-6 w-6" />;
      default: return <Bell className="h-6 w-6" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 dark:text-red-400";
      case "normal": return "text-foreground";
      case "low": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const isLoading = medsLoading || appointmentsLoading || changesLoading || notesLoading;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <Card className="mb-6 border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950/30">
        <CardContent className="flex items-center gap-3 py-4">
          <Info className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
          <p className="text-base font-medium">
            This is for information only. NOT medical advice. Always consult your doctor.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">My Health Home</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <Eye className="h-5 w-5" />
            <span className="font-medium">Simplified View</span>
            <Switch
              checked={settings.geriatricMode}
              onCheckedChange={(checked) => updateSetting("geriatricMode", checked)}
              data-testid="switch-geriatric-mode"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="home" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="home" className="py-4 text-lg" data-testid="tab-home">
            <Pill className="h-5 w-5 mr-2" />
            Home
          </TabsTrigger>
          <TabsTrigger value="medications" className="py-4 text-lg" data-testid="tab-medications">
            <Pill className="h-5 w-5 mr-2" />
            All Medications
          </TabsTrigger>
          <TabsTrigger value="caregivers" className="py-4 text-lg" data-testid="tab-caregivers">
            <Users className="h-5 w-5 mr-2" />
            Caregivers
          </TabsTrigger>
          <TabsTrigger value="settings" className="py-4 text-lg" data-testid="tab-settings">
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Pill className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  Today's Medications
                </CardTitle>
                <CardDescription className="text-base">
                  {todayMeds.filter(m => m.isActive).length} medications to take today
                </CardDescription>
              </CardHeader>
              <CardContent>
                {medsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : todayMeds.length === 0 ? (
                  <p className="text-muted-foreground text-lg">No medications scheduled today</p>
                ) : (
                  <div className="space-y-4">
                    {todayMeds.map((med) => (
                      <div 
                        key={med.id} 
                        className="p-4 rounded-lg border-2 hover-elevate cursor-pointer"
                        onClick={() => setSelectedMed(med)}
                        data-testid={`medication-${med.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold">{med.name}</h3>
                            <p className="text-lg text-muted-foreground">{med.dosage} - {med.frequency}</p>
                            <p className="text-base mt-1">{med.purpose}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {med.takenToday?.map((dose, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-base capitalize">{dose.time}</span>
                                {dose.taken ? (
                                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                                ) : (
                                  <Circle className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        {med.instructions && (
                          <p className="mt-3 text-base italic text-muted-foreground">
                            {med.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  Upcoming Appointments
                </CardTitle>
                <CardDescription className="text-base">
                  {appointments.length} appointments scheduled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="text-muted-foreground text-lg">No upcoming appointments</p>
                ) : (
                  <div className="space-y-4">
                    {appointments.slice(0, 3).map((apt) => (
                      <div 
                        key={apt.id} 
                        className="p-4 rounded-lg border-2 hover-elevate"
                        data-testid={`appointment-${apt.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-muted">
                            <Calendar className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold">{apt.providerName}</h3>
                            <p className="text-lg">{apt.specialty}</p>
                            <p className="text-base text-muted-foreground mt-1">
                              {formatDate(apt.scheduledAt)} at {formatTime(apt.scheduledAt)}
                            </p>
                            <p className="text-base mt-1">{apt.facilityName}</p>
                            {apt.instructions && (
                              <div className="mt-3 p-3 rounded bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                                <p className="text-base font-medium text-yellow-800 dark:text-yellow-200">
                                  {apt.instructions}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <Bell className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  What Changed
                </CardTitle>
                <CardDescription className="text-base">
                  Recent updates to your records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {changesLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : recentChanges.length === 0 ? (
                  <p className="text-muted-foreground text-lg">No recent changes</p>
                ) : (
                  <div className="space-y-4">
                    {recentChanges.map((change) => (
                      <div 
                        key={change.id} 
                        className="p-4 rounded-lg border-2 hover-elevate"
                        data-testid={`change-${change.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            {getChangeIcon(change.type)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold">{change.title}</h3>
                            <p className="text-base text-muted-foreground">{change.description}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {formatDate(change.changedAt)} - {change.changedBy}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    Caregiver Notes
                  </CardTitle>
                  <CardDescription className="text-base">
                    Messages from your care team
                  </CardDescription>
                </div>
                <Button 
                  size="lg" 
                  onClick={() => setShowAddNoteDialog(true)}
                  data-testid="button-add-note"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Note
                </Button>
              </CardHeader>
              <CardContent>
                {notesLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : caregiverNotes.length === 0 ? (
                  <p className="text-muted-foreground text-lg">No caregiver notes yet</p>
                ) : (
                  <div className="space-y-4">
                    {caregiverNotes.slice(0, 4).map((note) => (
                      <div 
                        key={note.id} 
                        className="p-4 rounded-lg border-2"
                        data-testid={`note-${note.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-lg">{note.caregiverName}</span>
                              {note.priority === "high" && (
                                <Badge variant="destructive">Important</Badge>
                              )}
                            </div>
                            <p className={`text-base ${getPriorityColor(note.priority)}`}>
                              {note.note}
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {formatDate(note.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medications" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">All Medications</CardTitle>
              <CardDescription className="text-base">
                Complete medication history with tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allMeds.map((med) => (
                  <div 
                    key={med.id}
                    className={`p-5 rounded-lg border-2 ${!med.isActive ? 'opacity-60 bg-muted/50' : ''}`}
                    data-testid={`all-med-${med.id}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{med.name}</h3>
                          <Badge variant={med.isActive ? "default" : "secondary"}>
                            {med.isActive ? "Active" : "Stopped"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-base">
                          <div>
                            <span className="text-muted-foreground">Dosage:</span>
                            <span className="ml-2 font-medium">{med.dosage}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Frequency:</span>
                            <span className="ml-2 font-medium">{med.frequency}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Purpose:</span>
                            <span className="ml-2 font-medium">{med.purpose}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prescriber:</span>
                            <span className="ml-2 font-medium">{med.prescribedBy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pharmacy:</span>
                            <span className="ml-2 font-medium">{med.pharmacy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <span className="ml-2 font-medium">
                              {new Date(med.startDate).toLocaleDateString()}
                            </span>
                          </div>
                          {med.endDate && (
                            <div>
                              <span className="text-muted-foreground">Stopped:</span>
                              <span className="ml-2 font-medium">
                                {new Date(med.endDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {med.stopReason && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">Reason stopped:</span>
                              <span className="ml-2 font-medium">{med.stopReason}</span>
                            </div>
                          )}
                          {med.sideEffects.length > 0 && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">Side effects:</span>
                              <span className="ml-2 font-medium">{med.sideEffects.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {med.isActive && (
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="lg"
                            onClick={() => {
                              setSelectedMed(med);
                              setShowSideEffectDialog(true);
                            }}
                            data-testid={`button-side-effect-${med.id}`}
                          >
                            <AlertTriangle className="h-5 w-5 mr-2" />
                            Record Side Effect
                          </Button>
                          <Button 
                            variant="outline" 
                            size="lg"
                            onClick={() => {
                              setSelectedMed(med);
                              setShowStopMedDialog(true);
                            }}
                            data-testid={`button-stop-med-${med.id}`}
                          >
                            <X className="h-5 w-5 mr-2" />
                            Stop Medication
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="caregivers" className="space-y-6">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl">My Caregivers</CardTitle>
                <CardDescription className="text-base">
                  People who help manage your health
                </CardDescription>
              </div>
              <Button 
                size="lg" 
                onClick={() => setShowInviteCaregiverDialog(true)}
                data-testid="button-invite-caregiver"
              >
                <Share2 className="h-5 w-5 mr-2" />
                Share Profile
              </Button>
            </CardHeader>
            <CardContent>
              {caregiversLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : caregivers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg text-muted-foreground">No caregivers added yet</p>
                  <p className="text-base text-muted-foreground mt-2">
                    Share your profile with family or caregivers
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {caregivers.map((cg) => (
                    <div 
                      key={cg.id}
                      className="p-5 rounded-lg border-2"
                      data-testid={`caregiver-${cg.id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-full bg-muted">
                            <User className="h-8 w-8" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">{cg.name}</h3>
                            <p className="text-lg text-muted-foreground">{cg.relationship}</p>
                            <div className="flex flex-col gap-1 mt-3 text-base">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{cg.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{cg.phone}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge variant="outline" className="text-base px-3 py-1">
                            {cg.accessLevel === "full" ? "Full Access" : 
                             cg.accessLevel === "limited" ? "Limited Access" : "View Only"}
                          </Badge>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {cg.canReceiveReminders && (
                              <Badge variant="secondary">
                                <Bell className="h-3 w-3 mr-1" />
                                Reminders
                              </Badge>
                            )}
                            {cg.canUploadDocuments && (
                              <Badge variant="secondary">
                                <Upload className="h-3 w-3 mr-1" />
                                Upload
                              </Badge>
                            )}
                            {cg.canPrintPacket && (
                              <Badge variant="secondary">
                                <Printer className="h-3 w-3 mr-1" />
                                Print
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Upload Documents</CardTitle>
              <CardDescription className="text-base">
                Caregivers can upload medical documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Upload Medical Documents</p>
                <p className="text-base text-muted-foreground mt-2">
                  Lab results, prescriptions, imaging reports
                </p>
                <Button size="lg" className="mt-4" data-testid="button-upload-document">
                  <Upload className="h-5 w-5 mr-2" />
                  Choose File to Upload
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Caregiver Reminders</CardTitle>
              <CardDescription className="text-base">
                Set up automatic reminders for caregivers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Pill className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Medication Reminders</p>
                    <p className="text-base text-muted-foreground">
                      Notify caregivers when it's time for medications
                    </p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-med-reminders" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Calendar className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Appointment Reminders</p>
                    <p className="text-base text-muted-foreground">
                      Notify caregivers about upcoming appointments
                    </p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-apt-reminders" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Bell className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Refill Alerts</p>
                    <p className="text-base text-muted-foreground">
                      Notify caregivers when medications need refilling
                    </p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-refill-reminders" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Print Health Packet</CardTitle>
              <CardDescription className="text-base">
                Create a printable summary for doctor visits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full md:w-auto" data-testid="button-print-packet">
                <Printer className="h-5 w-5 mr-2" />
                Print Complete Health Packet
              </Button>
              <p className="text-base text-muted-foreground mt-4">
                Includes: All medications, upcoming appointments, allergies, conditions, and emergency contacts
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Display Settings</CardTitle>
              <CardDescription className="text-base">
                Customize how the app looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Eye className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Simplified View</p>
                    <p className="text-base text-muted-foreground">
                      Big buttons, large text, high contrast
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.geriatricMode}
                  onCheckedChange={(checked) => updateSetting("geriatricMode", checked)}
                  data-testid="switch-simplified-mode"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Zap className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Reduce Motion</p>
                    <p className="text-base text-muted-foreground">
                      Fewer animations and transitions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.reducedMotion}
                  onCheckedChange={(checked) => updateSetting("reducedMotion", checked)}
                  data-testid="switch-reduced-motion"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2">
                <div className="flex items-center gap-4">
                  <Eye className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">High Contrast</p>
                    <p className="text-base text-muted-foreground">
                      Easier to read colors
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.highContrast}
                  onCheckedChange={(checked) => updateSetting("highContrast", checked)}
                  data-testid="switch-high-contrast"
                />
              </div>

              <div className="p-4 rounded-lg border-2">
                <div className="flex items-center gap-4 mb-4">
                  <Settings className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-bold">Text Size</p>
                    <p className="text-base text-muted-foreground">
                      Choose your preferred text size
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  {["normal", "large", "extra-large"].map((size) => (
                    <Button
                      key={size}
                      variant={settings.fontSize === size ? "default" : "outline"}
                      size="lg"
                      onClick={() => updateSetting("fontSize", size as "normal" | "large" | "extra-large")}
                      className="flex-1"
                      data-testid={`button-font-${size}`}
                    >
                      {size === "normal" ? "Normal" : size === "large" ? "Large" : "Extra Large"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSideEffectDialog} onOpenChange={setShowSideEffectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Record Side Effect</DialogTitle>
            <DialogDescription className="text-base">
              For: {selectedMed?.name} {selectedMed?.dosage}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">What side effect did you experience?</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Nausea", "Dizziness", "Headache", "Fatigue", "Rash", "Other"].map((effect) => (
                  <Button
                    key={effect}
                    variant={sideEffectText === effect ? "default" : "outline"}
                    size="lg"
                    onClick={() => setSideEffectText(effect)}
                    className="text-base"
                  >
                    {effect}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Additional notes (optional)</Label>
              <Textarea
                placeholder="Describe what you experienced..."
                className="text-base min-h-[100px]"
                value={sideEffectText === "Other" ? "" : undefined}
                onChange={(e) => sideEffectText === "Other" && setSideEffectText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setShowSideEffectDialog(false)}>
              Cancel
            </Button>
            <Button 
              size="lg" 
              onClick={() => selectedMed && recordSideEffectMutation.mutate({ medId: selectedMed.id, sideEffect: sideEffectText })}
              disabled={!sideEffectText || recordSideEffectMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStopMedDialog} onOpenChange={setShowStopMedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Stop Medication</DialogTitle>
            <DialogDescription className="text-base">
              Mark {selectedMed?.name} as stopped
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">Why did you stop taking this medication?</Label>
              <Select value={stopReason} onValueChange={setStopReason}>
                <SelectTrigger className="text-base h-12">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor_ordered">Doctor told me to stop</SelectItem>
                  <SelectItem value="side_effects">Too many side effects</SelectItem>
                  <SelectItem value="condition_resolved">Condition got better</SelectItem>
                  <SelectItem value="new_medication">Switched to new medication</SelectItem>
                  <SelectItem value="cost">Too expensive</SelectItem>
                  <SelectItem value="other">Other reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setShowStopMedDialog(false)}>
              Cancel
            </Button>
            <Button 
              size="lg" 
              variant="destructive"
              onClick={() => selectedMed && stopMedicationMutation.mutate({ medId: selectedMed.id, reason: stopReason })}
              disabled={!stopReason || stopMedicationMutation.isPending}
            >
              Stop Medication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add Note</DialogTitle>
            <DialogDescription className="text-base">
              Add a note for caregivers and doctors
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">Note</Label>
              <Textarea
                placeholder="What would you like to note?"
                className="text-base min-h-[120px]"
                value={newNote.note}
                onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Category</Label>
              <Select value={newNote.category} onValueChange={(v) => setNewNote({ ...newNote, category: v })}>
                <SelectTrigger className="text-base h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="medication">About Medications</SelectItem>
                  <SelectItem value="appointment">About Appointments</SelectItem>
                  <SelectItem value="concern">Health Concern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Priority</Label>
              <div className="flex gap-2">
                {["low", "normal", "high"].map((p) => (
                  <Button
                    key={p}
                    variant={newNote.priority === p ? "default" : "outline"}
                    size="lg"
                    onClick={() => setNewNote({ ...newNote, priority: p })}
                    className="flex-1 capitalize"
                  >
                    {p === "high" ? "Important" : p}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setShowAddNoteDialog(false)}>
              Cancel
            </Button>
            <Button 
              size="lg" 
              onClick={() => addNoteMutation.mutate(newNote)}
              disabled={!newNote.note || addNoteMutation.isPending}
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteCaregiverDialog} onOpenChange={setShowInviteCaregiverDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Share Profile with Caregiver</DialogTitle>
            <DialogDescription className="text-base">
              Invite someone to help manage your health
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">Their Name</Label>
              <Input
                placeholder="Enter name"
                className="text-base h-12"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Their Email</Label>
              <Input
                type="email"
                placeholder="Enter email"
                className="text-base h-12"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Relationship</Label>
              <Select value={inviteData.relationship} onValueChange={(v) => setInviteData({ ...inviteData, relationship: v })}>
                <SelectTrigger className="text-base h-12">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="child">Son/Daughter</SelectItem>
                  <SelectItem value="sibling">Brother/Sister</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="professional">Professional Caregiver</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Access Level</Label>
              <Select value={inviteData.accessLevel} onValueChange={(v) => setInviteData({ ...inviteData, accessLevel: v })}>
                <SelectTrigger className="text-base h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access - Can view and update everything</SelectItem>
                  <SelectItem value="limited">Limited - Can view and add notes</SelectItem>
                  <SelectItem value="view_only">View Only - Can only view information</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setShowInviteCaregiverDialog(false)}>
              Cancel
            </Button>
            <Button 
              size="lg" 
              onClick={() => inviteCaregiverMutation.mutate(inviteData)}
              disabled={!inviteData.name || !inviteData.email || !inviteData.relationship || inviteCaregiverMutation.isPending}
            >
              <Share2 className="h-5 w-5 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
