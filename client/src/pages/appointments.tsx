import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Plus,
  MapPin,
  User,
  FileText,
  Upload,
  Check,
  Trash2,
  Edit,
  MessageSquare,
  ClipboardList,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Stethoscope,
  ListTodo,
  File,
  Image,
  X,
} from "lucide-react";

interface Appointment {
  id: string;
  title: string;
  provider: string;
  specialty: string;
  location: string;
  date: string;
  time: string;
  type: "in_person" | "telehealth" | "phone";
  status: "upcoming" | "completed" | "cancelled";
  notes: string[];
  nextSteps: NextStep[];
}

interface NextStep {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  appointmentId: string;
}

interface DiscussionNote {
  id: string;
  text: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  appointmentId?: string;
}

interface UploadedDocument {
  id: string;
  name: string;
  type: "insurance" | "referral" | "letter" | "other";
  uploadedAt: string;
  appointmentId?: string;
}

const mockAppointments: Appointment[] = [
  {
    id: "apt-1",
    title: "Annual Physical",
    provider: "Dr. Sarah Johnson",
    specialty: "Primary Care",
    location: "City Medical Center, Suite 200",
    date: "2026-01-25",
    time: "10:00 AM",
    type: "in_person",
    status: "upcoming",
    notes: ["Bring current medication list", "Bring insurance card"],
    nextSteps: [],
  },
  {
    id: "apt-2",
    title: "Cardiology Follow-up",
    provider: "Dr. Michael Chen",
    specialty: "Cardiology",
    location: "Heart Health Clinic",
    date: "2026-02-03",
    time: "2:30 PM",
    type: "in_person",
    status: "upcoming",
    notes: [],
    nextSteps: [],
  },
  {
    id: "apt-3",
    title: "Telehealth Check-in",
    provider: "Dr. Emily Rodriguez",
    specialty: "Internal Medicine",
    location: "Video Call",
    date: "2026-01-20",
    time: "11:00 AM",
    type: "telehealth",
    status: "upcoming",
    notes: ["Prepare list of questions"],
    nextSteps: [],
  },
];

const mockDiscussionNotes: DiscussionNote[] = [
  {
    id: "note-1",
    text: "Ask about recent lab results",
    priority: "high",
    createdAt: "2026-01-15",
    appointmentId: "apt-1",
  },
  {
    id: "note-2",
    text: "Request referral letter for specialist",
    priority: "medium",
    createdAt: "2026-01-16",
  },
  {
    id: "note-3",
    text: "Review current prescription refill needs",
    priority: "low",
    createdAt: "2026-01-17",
  },
];

const mockDocuments: UploadedDocument[] = [
  {
    id: "doc-1",
    name: "Insurance Pre-Authorization Letter.pdf",
    type: "insurance",
    uploadedAt: "2026-01-10",
    appointmentId: "apt-2",
  },
  {
    id: "doc-2",
    name: "Cardiology Referral.pdf",
    type: "referral",
    uploadedAt: "2026-01-12",
    appointmentId: "apt-2",
  },
];

const mockNextSteps: NextStep[] = [
  { id: "step-1", text: "Schedule appointment at imaging center", completed: false, dueDate: "2026-01-30", appointmentId: "apt-2" },
  { id: "step-2", text: "Pick up documents from pharmacy", completed: true, appointmentId: "apt-1" },
  { id: "step-3", text: "Complete lab paperwork before next visit", completed: false, dueDate: "2026-01-24", appointmentId: "apt-1" },
  { id: "step-4", text: "Submit insurance claim form", completed: false, dueDate: "2026-01-28", appointmentId: "apt-2" },
];

function getAppointmentTypeIcon(type: string) {
  switch (type) {
    case "in_person": return <Building2 className="h-4 w-4" />;
    case "telehealth": return <ExternalLink className="h-4 w-4" />;
    case "phone": return <Phone className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
}

function getAppointmentTypeBadge(type: string) {
  switch (type) {
    case "in_person": return <Badge variant="outline">In Person</Badge>;
    case "telehealth": return <Badge className="bg-blue-500">Telehealth</Badge>;
    case "phone": return <Badge variant="secondary">Phone</Badge>;
    default: return <Badge variant="outline">{type}</Badge>;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high": return <Badge variant="destructive">High</Badge>;
    case "medium": return <Badge>Medium</Badge>;
    case "low": return <Badge variant="secondary">Low</Badge>;
    default: return <Badge variant="outline">{priority}</Badge>;
  }
}

function getDocumentIcon(type: string) {
  switch (type) {
    case "insurance": return <FileText className="h-4 w-4 text-blue-500" />;
    case "referral": return <Stethoscope className="h-4 w-4 text-green-500" />;
    case "letter": return <Mail className="h-4 w-4 text-purple-500" />;
    default: return <File className="h-4 w-4 text-gray-500" />;
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function getDaysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

export default function Appointments() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showUploadDocument, setShowUploadDocument] = useState(false);
  const [showAddNextStep, setShowAddNextStep] = useState(false);

  const [appointments] = useState<Appointment[]>(mockAppointments);
  const [discussionNotes, setDiscussionNotes] = useState<DiscussionNote[]>(mockDiscussionNotes);
  const [documents] = useState<UploadedDocument[]>(mockDocuments);
  const [nextSteps, setNextSteps] = useState<NextStep[]>(mockNextSteps);

  const [newNote, setNewNote] = useState({ text: "", priority: "medium", appointmentId: "" });
  const [newStep, setNewStep] = useState({ text: "", dueDate: "", appointmentId: "" });

  const upcomingAppointments = appointments.filter(a => a.status === "upcoming");
  const incompleteSteps = nextSteps.filter(s => !s.completed);

  const handleAddNote = () => {
    if (!newNote.text.trim()) return;
    const note: DiscussionNote = {
      id: `note-${Date.now()}`,
      text: newNote.text,
      priority: newNote.priority as "high" | "medium" | "low",
      createdAt: new Date().toISOString().split("T")[0],
      appointmentId: newNote.appointmentId || undefined,
    };
    setDiscussionNotes([note, ...discussionNotes]);
    setNewNote({ text: "", priority: "medium", appointmentId: "" });
    setShowAddNote(false);
    toast({ title: "Note Added", description: "Your discussion note has been saved." });
  };

  const handleAddNextStep = () => {
    if (!newStep.text.trim()) return;
    const step: NextStep = {
      id: `step-${Date.now()}`,
      text: newStep.text,
      completed: false,
      dueDate: newStep.dueDate || undefined,
      appointmentId: newStep.appointmentId || "general",
    };
    setNextSteps([step, ...nextSteps]);
    setNewStep({ text: "", dueDate: "", appointmentId: "" });
    setShowAddNextStep(false);
    toast({ title: "Step Added", description: "Your next step has been added to the tracker." });
  };

  const handleToggleStep = (stepId: string) => {
    setNextSteps(nextSteps.map(step => 
      step.id === stepId ? { ...step, completed: !step.completed } : step
    ));
  };

  const handleDeleteNote = (noteId: string) => {
    setDiscussionNotes(discussionNotes.filter(n => n.id !== noteId));
    toast({ title: "Note Deleted", description: "The discussion note has been removed." });
  };

  const handleDeleteStep = (stepId: string) => {
    setNextSteps(nextSteps.filter(s => s.id !== stepId));
    toast({ title: "Step Deleted", description: "The next step has been removed." });
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-appointments">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Appointments & Next Steps
          </h1>
          <p className="text-muted-foreground">
            Organize your visits, track next steps, and manage related documents
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showAddAppointment} onOpenChange={setShowAddAppointment}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-appointment">
                <Plus className="h-4 w-4 mr-2" />
                Add Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Appointment</DialogTitle>
                <DialogDescription>Schedule a new appointment or add an existing one</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="apt-title">Appointment Title</Label>
                  <Input id="apt-title" placeholder="e.g., Annual Physical" data-testid="input-apt-title" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apt-provider">Provider Name</Label>
                    <Input id="apt-provider" placeholder="Dr. Smith" data-testid="input-apt-provider" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-specialty">Specialty</Label>
                    <Input id="apt-specialty" placeholder="Primary Care" data-testid="input-apt-specialty" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apt-location">Location</Label>
                  <Input id="apt-location" placeholder="Clinic address or 'Video Call'" data-testid="input-apt-location" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apt-date">Date</Label>
                    <Input id="apt-date" type="date" data-testid="input-apt-date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-time">Time</Label>
                    <Input id="apt-time" type="time" data-testid="input-apt-time" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Appointment Type</Label>
                  <Select defaultValue="in_person">
                    <SelectTrigger data-testid="select-apt-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="telehealth">Telehealth</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddAppointment(false)}>Cancel</Button>
                <Button onClick={() => {
                  setShowAddAppointment(false);
                  toast({ title: "Appointment Added", description: "Your appointment has been scheduled." });
                }} data-testid="button-save-appointment">Save Appointment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
              <div className="text-sm text-muted-foreground">Upcoming Visits</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <MessageSquare className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{discussionNotes.length}</div>
              <div className="text-sm text-muted-foreground">Discussion Notes</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <ListTodo className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{incompleteSteps.length}</div>
              <div className="text-sm text-muted-foreground">Pending Steps</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{documents.length}</div>
              <div className="text-sm text-muted-foreground">Documents</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming Visits
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4 mr-2" />
            To Discuss
          </TabsTrigger>
          <TabsTrigger value="steps" data-testid="tab-steps">
            <ListTodo className="h-4 w-4 mr-2" />
            Next Steps
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingAppointments.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Appointments</h3>
              <p className="text-muted-foreground mb-4">Schedule your next visit to keep track of your healthcare</p>
              <Button onClick={() => setShowAddAppointment(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Appointment
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingAppointments.map((apt) => (
                <Card key={apt.id} className="hover-elevate" data-testid={`card-appointment-${apt.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex gap-4">
                        <div className="text-center min-w-[60px] p-3 bg-primary/10 rounded-lg">
                          <div className="text-2xl font-bold text-primary">
                            {new Date(apt.date).getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase">
                            {new Date(apt.date).toLocaleDateString("en-US", { month: "short" })}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{apt.title}</h3>
                            {getAppointmentTypeBadge(apt.type)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <User className="h-4 w-4" />
                            <span>{apt.provider}</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span>{apt.specialty}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            <span>{apt.time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{apt.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-2">{getDaysUntil(apt.date)}</Badge>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                    {apt.notes.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Notes:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {apt.notes.map((note, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Topics to discuss at your next visit</p>
            <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Discussion Note</DialogTitle>
                  <DialogDescription>Add a topic to discuss at your next appointment</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="note-text">What do you want to discuss?</Label>
                    <Textarea
                      id="note-text"
                      placeholder="e.g., Ask about switching medications..."
                      value={newNote.text}
                      onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                      data-testid="input-note-text"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={newNote.priority} onValueChange={(v) => setNewNote({ ...newNote, priority: v })}>
                        <SelectTrigger data-testid="select-note-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>For Appointment (Optional)</Label>
                      <Select value={newNote.appointmentId} onValueChange={(v) => setNewNote({ ...newNote, appointmentId: v })}>
                        <SelectTrigger data-testid="select-note-appointment">
                          <SelectValue placeholder="Any visit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any visit</SelectItem>
                          {upcomingAppointments.map(apt => (
                            <SelectItem key={apt.id} value={apt.id}>{apt.title} - {formatDate(apt.date)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddNote(false)}>Cancel</Button>
                  <Button onClick={handleAddNote} data-testid="button-save-note">Save Note</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {discussionNotes.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Discussion Notes</h3>
              <p className="text-muted-foreground mb-4">Add topics you want to discuss at your next visit</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {discussionNotes.map((note) => (
                <Card key={note.id} className="hover-elevate" data-testid={`card-note-${note.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${
                          note.priority === "high" ? "text-red-500" :
                          note.priority === "medium" ? "text-yellow-500" : "text-gray-400"
                        }`} />
                        <div>
                          <p className="font-medium">{note.text}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {getPriorityBadge(note.priority)}
                            {note.appointmentId && (
                              <Badge variant="outline" className="text-xs">
                                {upcomingAppointments.find(a => a.id === note.appointmentId)?.title || "General"}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">Added {formatDate(note.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note.id)} aria-label="Delete note">
                        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="steps" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Track follow-up tasks and action items</p>
            <Dialog open={showAddNextStep} onOpenChange={setShowAddNextStep}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-step">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Next Step
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Next Step</DialogTitle>
                  <DialogDescription>Add a follow-up task or action item</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="step-text">What needs to be done?</Label>
                    <Input
                      id="step-text"
                      placeholder="e.g., Schedule follow-up MRI..."
                      value={newStep.text}
                      onChange={(e) => setNewStep({ ...newStep, text: e.target.value })}
                      data-testid="input-step-text"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="step-due">Due Date (Optional)</Label>
                      <Input
                        id="step-due"
                        type="date"
                        value={newStep.dueDate}
                        onChange={(e) => setNewStep({ ...newStep, dueDate: e.target.value })}
                        data-testid="input-step-due"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Related Appointment</Label>
                      <Select value={newStep.appointmentId} onValueChange={(v) => setNewStep({ ...newStep, appointmentId: v })}>
                        <SelectTrigger data-testid="select-step-appointment">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">General</SelectItem>
                          {upcomingAppointments.map(apt => (
                            <SelectItem key={apt.id} value={apt.id}>{apt.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddNextStep(false)}>Cancel</Button>
                  <Button onClick={handleAddNextStep} data-testid="button-save-step">Add Step</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {nextSteps.length === 0 ? (
            <Card className="p-8 text-center">
              <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Next Steps</h3>
              <p className="text-muted-foreground mb-4">Add follow-up tasks after your appointments</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {nextSteps.map((step) => (
                <Card key={step.id} className={`hover-elevate ${step.completed ? "opacity-60" : ""}`} data-testid={`card-step-${step.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={step.completed}
                          onCheckedChange={() => handleToggleStep(step.id)}
                          data-testid={`checkbox-step-${step.id}`}
                        />
                        <div>
                          <p className={`font-medium ${step.completed ? "line-through text-muted-foreground" : ""}`}>
                            {step.text}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {step.dueDate && (
                              <Badge variant={new Date(step.dueDate) < new Date() && !step.completed ? "destructive" : "outline"} className="text-xs">
                                Due {formatDate(step.dueDate)}
                              </Badge>
                            )}
                            {step.appointmentId && step.appointmentId !== "general" && (
                              <Badge variant="secondary" className="text-xs">
                                {upcomingAppointments.find(a => a.id === step.appointmentId)?.title || "Visit"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(step.id)} aria-label="Delete step">
                        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Insurance letters, referrals, and related documents</p>
            <Dialog open={showUploadDocument} onOpenChange={setShowUploadDocument}>
              <DialogTrigger asChild>
                <Button data-testid="button-upload-document">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>Upload insurance letters, referrals, or other documents</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
                    <Button variant="outline" size="sm">Browse Files</Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select defaultValue="other">
                      <SelectTrigger data-testid="select-doc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insurance">Insurance Letter</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="letter">General Letter</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Related Appointment (Optional)</Label>
                    <Select>
                      <SelectTrigger data-testid="select-doc-appointment">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {upcomingAppointments.map(apt => (
                          <SelectItem key={apt.id} value={apt.id}>{apt.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUploadDocument(false)}>Cancel</Button>
                  <Button onClick={() => {
                    setShowUploadDocument(false);
                    toast({ title: "Document Uploaded", description: "Your document has been saved." });
                  }} data-testid="button-save-document">Upload</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {documents.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Documents</h3>
              <p className="text-muted-foreground mb-4">Upload insurance letters, referrals, and other documents</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getDocumentIcon(doc.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">{doc.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Uploaded {formatDate(doc.uploadedAt)}</p>
                        {doc.appointmentId && (
                          <p className="text-xs text-muted-foreground">
                            For: {upcomingAppointments.find(a => a.id === doc.appointmentId)?.title}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1">
                        <FileText className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-appointments-disclaimer" />
    </div>
  );
}
