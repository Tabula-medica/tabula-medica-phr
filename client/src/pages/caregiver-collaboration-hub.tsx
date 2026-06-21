import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getInitials } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  MessageSquare,
  Calendar,
  ClipboardList,
  Send,
  Plus,
  Check,
  Clock,
  AlertTriangle,
  Heart,
  Pill,
  FileText,
  Phone,
  Video,
  Bell,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  UserPlus,
  Shield,
  Activity,
  BookOpen,
  Share2,
  Loader2,
  Info,
  ChevronRight,
  Star,
  Pin,
} from "lucide-react";

const SAMPLE_CAREGIVER_ID = "caregiver-001";
const SAMPLE_PATIENT_ID = "patient-001";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  relationship: string;
  phone?: string;
  email?: string;
  isOnline: boolean;
  lastActive?: string;
  avatar?: string;
  permissions: string[];
}

interface CollaborationTask {
  id: string;
  title: string;
  description?: string;
  category: "medication" | "appointment" | "daily_care" | "medical" | "household" | "emotional" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName: string;
  dueDate?: string;
  dueTime?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

interface HandoffNote {
  id: string;
  fromCaregiver: string;
  fromCaregiverName: string;
  toCaregiver?: string;
  toCaregiverName?: string;
  shiftDate: string;
  shiftTime: "morning" | "afternoon" | "evening" | "overnight";
  summary: string;
  medications: string[];
  moodObservations: string;
  appetiteNotes: string;
  concernsFlags: string[];
  priorityItems: string[];
  createdAt: string;
}

interface CareJournalEntry {
  id: string;
  caregiverId: string;
  caregiverName: string;
  date: string;
  time: string;
  category: "observation" | "medication" | "meal" | "activity" | "mood" | "symptom" | "note";
  content: string;
  isPinned: boolean;
  isImportant: boolean;
  attachments?: string[];
  createdAt: string;
}

interface LinkedDocument {
  id: string;
  title: string;
  category: "medical_record" | "lab_result" | "imaging" | "prescription" | "care_plan" | "insurance" | "legal" | "other";
  description?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  fileType: string;
  fileSize: string;
  sharedWith: string[];
  isPinned: boolean;
  tags: string[];
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

const categoryColors: Record<string, string> = {
  medication: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  appointment: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  daily_care: "bg-green-500/10 text-green-600 dark:text-green-400",
  medical: "bg-red-500/10 text-red-600 dark:text-red-400",
  household: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emotional: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-600",
  high: "bg-orange-500/10 text-orange-600",
  urgent: "bg-red-500/10 text-red-600",
};

const journalCategoryIcons: Record<string, typeof Activity> = {
  observation: Activity,
  medication: Pill,
  meal: Heart,
  activity: Users,
  mood: Star,
  symptom: AlertTriangle,
  note: FileText,
};

const sampleTeamMembers: TeamMember[] = [
  {
    id: "caregiver-001",
    name: "Sarah Johnson",
    role: "Primary Caregiver",
    relationship: "Daughter",
    phone: "(555) 123-4567",
    email: "sarah.j@email.com",
    isOnline: true,
    permissions: ["full_access", "medication", "appointments", "records"],
  },
  {
    id: "caregiver-002",
    name: "Michael Johnson",
    role: "Secondary Caregiver",
    relationship: "Son",
    phone: "(555) 234-5678",
    email: "michael.j@email.com",
    isOnline: false,
    lastActive: "2 hours ago",
    permissions: ["view", "medication", "appointments"],
  },
  {
    id: "caregiver-003",
    name: "Emily Chen",
    role: "Home Health Aide",
    relationship: "Professional",
    phone: "(555) 345-6789",
    isOnline: true,
    permissions: ["daily_care", "medication"],
  },
  {
    id: "caregiver-004",
    name: "Dr. Robert Williams",
    role: "Primary Care Physician",
    relationship: "Healthcare Provider",
    phone: "(555) 456-7890",
    isOnline: false,
    lastActive: "1 day ago",
    permissions: ["records", "medical"],
  },
];

const sampleTasks: CollaborationTask[] = [
  {
    id: "task-1",
    title: "Administer morning medications",
    category: "medication",
    priority: "high",
    status: "completed",
    assignedTo: "caregiver-003",
    assignedToName: "Emily Chen",
    createdBy: "caregiver-001",
    createdByName: "Sarah Johnson",
    dueDate: "2025-01-22",
    dueTime: "08:00",
    completedAt: "2025-01-22T08:15:00Z",
    createdAt: "2025-01-21T20:00:00Z",
  },
  {
    id: "task-2",
    title: "Physical therapy exercises",
    description: "Assist with prescribed arm exercises - 3 sets of 10 reps each",
    category: "medical",
    priority: "normal",
    status: "in_progress",
    assignedTo: "caregiver-003",
    assignedToName: "Emily Chen",
    createdBy: "caregiver-001",
    createdByName: "Sarah Johnson",
    dueDate: "2025-01-22",
    dueTime: "10:00",
    createdAt: "2025-01-21T20:00:00Z",
  },
  {
    id: "task-3",
    title: "Schedule oncology follow-up",
    category: "appointment",
    priority: "high",
    status: "pending",
    assignedTo: "caregiver-001",
    assignedToName: "Sarah Johnson",
    createdBy: "caregiver-002",
    createdByName: "Michael Johnson",
    dueDate: "2025-01-23",
    createdAt: "2025-01-22T09:00:00Z",
  },
  {
    id: "task-4",
    title: "Pick up prescription refills",
    category: "medication",
    priority: "urgent",
    status: "pending",
    assignedTo: "caregiver-002",
    assignedToName: "Michael Johnson",
    createdBy: "caregiver-001",
    createdByName: "Sarah Johnson",
    dueDate: "2025-01-22",
    dueTime: "14:00",
    createdAt: "2025-01-22T07:00:00Z",
  },
];

const sampleHandoffNotes: HandoffNote[] = [
  {
    id: "handoff-1",
    fromCaregiver: "caregiver-003",
    fromCaregiverName: "Emily Chen",
    toCaregiver: "caregiver-001",
    toCaregiverName: "Sarah Johnson",
    shiftDate: "2025-01-22",
    shiftTime: "morning",
    summary: "Good morning overall. Mom was in good spirits and ate well at breakfast. Completed all morning medications on time.",
    medications: ["Tamoxifen 20mg taken at 8:00 AM", "Vitamin D3 taken with breakfast", "Blood pressure medication given"],
    moodObservations: "Cheerful and talkative. Mentioned looking forward to grandchildren visiting this weekend.",
    appetiteNotes: "Good appetite. Ate full breakfast - oatmeal, fruit, and toast. Drank 2 glasses of water.",
    concernsFlags: ["Slight swelling in left ankle noted - may want to elevate"],
    priorityItems: ["PT exercises due at 10 AM", "Oncology called - please call back about lab results"],
    createdAt: "2025-01-22T12:00:00Z",
  },
];

const sampleJournalEntries: CareJournalEntry[] = [
  {
    id: "journal-1",
    caregiverId: "caregiver-003",
    caregiverName: "Emily Chen",
    date: "2025-01-22",
    time: "08:30",
    category: "medication",
    content: "Morning medications administered. All medications taken without issues.",
    isPinned: false,
    isImportant: false,
    createdAt: "2025-01-22T08:30:00Z",
  },
  {
    id: "journal-2",
    caregiverId: "caregiver-003",
    caregiverName: "Emily Chen",
    date: "2025-01-22",
    time: "09:00",
    category: "meal",
    content: "Breakfast: Oatmeal with blueberries, whole wheat toast, orange juice. Ate about 80% of meal.",
    isPinned: false,
    isImportant: false,
    createdAt: "2025-01-22T09:00:00Z",
  },
  {
    id: "journal-3",
    caregiverId: "caregiver-001",
    caregiverName: "Sarah Johnson",
    date: "2025-01-21",
    time: "19:00",
    category: "observation",
    content: "Mom mentioned feeling more tired than usual today. No other concerning symptoms. Will monitor.",
    isPinned: true,
    isImportant: true,
    createdAt: "2025-01-21T19:00:00Z",
  },
  {
    id: "journal-4",
    caregiverId: "caregiver-002",
    caregiverName: "Michael Johnson",
    date: "2025-01-21",
    time: "14:00",
    category: "activity",
    content: "Went for a short walk around the block together. Mom enjoyed the fresh air and seemed energized after.",
    isPinned: false,
    isImportant: false,
    createdAt: "2025-01-21T14:00:00Z",
  },
];

const sampleChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    senderId: "caregiver-002",
    senderName: "Michael Johnson",
    content: "Just picked up the groceries. Will be there around 3pm.",
    timestamp: "2025-01-22T13:30:00Z",
    isRead: true,
  },
  {
    id: "msg-2",
    senderId: "caregiver-001",
    senderName: "Sarah Johnson",
    content: "Thanks Michael! Mom's been asking about you. She'd love to see you.",
    timestamp: "2025-01-22T13:35:00Z",
    isRead: true,
  },
  {
    id: "msg-3",
    senderId: "caregiver-003",
    senderName: "Emily Chen",
    content: "FYI - I noted some ankle swelling in my handoff notes. Might be worth mentioning to Dr. Williams at the next visit.",
    timestamp: "2025-01-22T12:15:00Z",
    isRead: true,
  },
];

const sampleLinkedDocuments: LinkedDocument[] = [
  {
    id: "doc-1",
    title: "Oncology Follow-up Notes - January 2025",
    category: "medical_record",
    description: "Notes from Dr. Sarah Johnson's oncology visit including treatment progress and next steps.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2025-01-15T10:30:00Z",
    fileType: "PDF",
    fileSize: "1.2 MB",
    sharedWith: ["caregiver-002", "caregiver-003"],
    isPinned: true,
    tags: ["oncology", "follow-up", "treatment"],
  },
  {
    id: "doc-2",
    title: "Lab Results - CBC & Metabolic Panel",
    category: "lab_result",
    description: "Complete blood count and comprehensive metabolic panel from January 10, 2025.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2025-01-10T14:00:00Z",
    fileType: "PDF",
    fileSize: "856 KB",
    sharedWith: ["caregiver-002", "caregiver-003", "caregiver-004"],
    isPinned: true,
    tags: ["labs", "CBC", "metabolic"],
  },
  {
    id: "doc-3",
    title: "Medication List - Current Prescriptions",
    category: "prescription",
    description: "Complete list of current medications with dosages and schedules.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2025-01-05T09:00:00Z",
    fileType: "PDF",
    fileSize: "245 KB",
    sharedWith: ["caregiver-002", "caregiver-003"],
    isPinned: true,
    tags: ["medications", "prescriptions", "current"],
  },
  {
    id: "doc-4",
    title: "PET Scan Report - December 2024",
    category: "imaging",
    description: "Full body PET scan showing treatment response.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2024-12-20T11:00:00Z",
    fileType: "PDF",
    fileSize: "3.4 MB",
    sharedWith: ["caregiver-002"],
    isPinned: false,
    tags: ["imaging", "PET", "scan"],
  },
  {
    id: "doc-5",
    title: "Survivorship Care Plan",
    category: "care_plan",
    description: "Long-term care plan and follow-up schedule from the oncology team.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2024-11-15T16:00:00Z",
    fileType: "PDF",
    fileSize: "1.8 MB",
    sharedWith: ["caregiver-002", "caregiver-003", "caregiver-004"],
    isPinned: true,
    tags: ["care-plan", "survivorship", "follow-up"],
  },
  {
    id: "doc-6",
    title: "Insurance Authorization - Physical Therapy",
    category: "insurance",
    description: "Pre-authorization approval for 12 physical therapy sessions.",
    uploadedBy: "caregiver-002",
    uploadedByName: "Michael Johnson",
    uploadedAt: "2025-01-08T13:00:00Z",
    fileType: "PDF",
    fileSize: "320 KB",
    sharedWith: ["caregiver-001"],
    isPinned: false,
    tags: ["insurance", "authorization", "PT"],
  },
  {
    id: "doc-7",
    title: "Healthcare Power of Attorney",
    category: "legal",
    description: "Legal document designating healthcare decision-making authority.",
    uploadedBy: "caregiver-001",
    uploadedByName: "Sarah Johnson",
    uploadedAt: "2024-06-01T10:00:00Z",
    fileType: "PDF",
    fileSize: "512 KB",
    sharedWith: ["caregiver-002"],
    isPinned: true,
    tags: ["legal", "POA", "advance-directive"],
  },
];

const documentCategoryColors: Record<string, string> = {
  medical_record: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  lab_result: "bg-green-500/10 text-green-600 dark:text-green-400",
  imaging: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  prescription: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  care_plan: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  insurance: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  legal: "bg-red-500/10 text-red-600 dark:text-red-400",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const documentCategoryLabels: Record<string, string> = {
  medical_record: "Medical Record",
  lab_result: "Lab Result",
  imaging: "Imaging",
  prescription: "Prescription",
  care_plan: "Care Plan",
  insurance: "Insurance",
  legal: "Legal",
  other: "Other",
};

export default function CaregiverCollaborationHub() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showNewJournalDialog, setShowNewJournalDialog] = useState(false);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "daily_care" as const,
    priority: "normal" as const,
    assignedTo: "",
    dueDate: "",
    dueTime: "",
  });
  const [newJournalEntry, setNewJournalEntry] = useState({
    category: "observation" as const,
    content: "",
    isImportant: false,
  });
  const { toast } = useToast();

  const { data: collaborationData, isLoading } = useQuery({
    queryKey: ["/api/caregiver-collaboration-hub", SAMPLE_PATIENT_ID],
    queryFn: async () => {
      return {
        teamMembers: sampleTeamMembers,
        tasks: sampleTasks,
        handoffNotes: sampleHandoffNotes,
        journalEntries: sampleJournalEntries,
        chatMessages: sampleChatMessages,
      };
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (task: typeof newTask) => {
      return { success: true, data: { ...task, id: `task-${Date.now()}` } };
    },
    onSuccess: () => {
      toast({ title: "Task Created", description: "New task has been added to the list." });
      setShowNewTaskDialog(false);
      setNewTask({ title: "", description: "", category: "daily_care", priority: "normal", assignedTo: "", dueDate: "", dueTime: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver-collaboration-hub"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return { success: true };
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver-collaboration-hub"] });
    },
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };


  const pendingTasks = sampleTasks.filter(t => t.status === "pending");
  const inProgressTasks = sampleTasks.filter(t => t.status === "in_progress");
  const completedTasks = sampleTasks.filter(t => t.status === "completed");
  const onlineMembers = sampleTeamMembers.filter(m => m.isOnline);

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Caregiver Collaboration Hub
          </h1>
          <p className="text-muted-foreground">Coordinate care together as a team</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {onlineMembers.length} Online
          </Badge>
          <Button onClick={() => setShowNewTaskDialog(true)} data-testid="button-new-task">
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          All collaboration activity is logged for HIPAA compliance. Share only care-related information.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressTasks.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sampleTeamMembers.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="handoff" data-testid="tab-handoff">Handoff</TabsTrigger>
          <TabsTrigger value="journal" data-testid="tab-journal">Journal</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Team Chat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-2">
                  <div className="space-y-4">
                    {sampleChatMessages.map(msg => (
                      <div key={msg.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{getInitials(msg.senderName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{msg.senderName}</span>
                            <span className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Separator className="my-3" />
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && chatMessage && sendMessageMutation.mutate(chatMessage)}
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="icon"
                    onClick={() => chatMessage && sendMessageMutation.mutate(chatMessage)}
                    disabled={!chatMessage}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Today's Priority Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sampleTasks.filter(t => t.status !== "completed").slice(0, 4).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border hover-elevate">
                      <div className={`p-1.5 rounded ${task.status === "in_progress" ? "bg-blue-500/10" : "bg-muted"}`}>
                        {task.status === "in_progress" ? (
                          <Clock className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.assignedToName}</p>
                      </div>
                      <Badge variant="outline" className={priorityColors[task.priority]}>
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {sampleHandoffNotes[0] && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" />
                    Latest Shift Handoff
                  </CardTitle>
                  <CardDescription>
                    From {sampleHandoffNotes[0].fromCaregiverName} - {sampleHandoffNotes[0].shiftTime} shift
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1">Summary</h4>
                      <p className="text-sm text-muted-foreground">{sampleHandoffNotes[0].summary}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                          <Pill className="h-4 w-4" />
                          Medications Given
                        </h4>
                        <ul className="space-y-1">
                          {sampleHandoffNotes[0].medications.map((med, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                              <Check className="h-3 w-3 text-green-500" />
                              {med}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Priority Items
                        </h4>
                        <ul className="space-y-1">
                          {sampleHandoffNotes[0].priorityItems.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="h-3 w-3 mt-1 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {sampleHandoffNotes[0].concernsFlags.length > 0 && (
                      <Alert variant="default">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {sampleHandoffNotes[0].concernsFlags.join(" | ")}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Task Management</h2>
            <Button onClick={() => setShowNewTaskDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Circle className="h-4 w-4 text-orange-500" />
                  Pending ({pendingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border hover-elevate">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge variant="outline" className={priorityColors[task.priority]}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.assignedToName}</span>
                        {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  In Progress ({inProgressTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inProgressTasks.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge variant="outline" className={categoryColors[task.category]}>
                          {task.category.replace("_", " ")}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.assignedToName}</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Completed ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedTasks.map(task => (
                    <div key={task.id} className="p-3 rounded-lg border opacity-70">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm line-through">{task.title}</h4>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.assignedToName}</span>
                        {task.completedAt && <span>Completed {formatTime(task.completedAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="handoff" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shift Handoff Notes</h2>
            <Button onClick={() => setShowHandoffDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Handoff
            </Button>
          </div>

          <div className="space-y-4">
            {sampleHandoffNotes.map(note => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(note.fromCaregiverName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{note.fromCaregiverName}</CardTitle>
                        <CardDescription>
                          {formatDate(note.shiftDate)} - {note.shiftTime.charAt(0).toUpperCase() + note.shiftTime.slice(1)} Shift
                        </CardDescription>
                      </div>
                    </div>
                    {note.toCaregiverName && (
                      <Badge variant="outline">To: {note.toCaregiverName}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Summary</h4>
                    <p className="text-sm text-muted-foreground">{note.summary}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Mood & Observations</h4>
                      <p className="text-sm text-muted-foreground">{note.moodObservations}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">Appetite Notes</h4>
                      <p className="text-sm text-muted-foreground">{note.appetiteNotes}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <Pill className="h-4 w-4" />
                        Medications
                      </h4>
                      <ul className="space-y-1">
                        {note.medications.map((med, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <Check className="h-3 w-3 text-green-500" />
                            {med}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Priority for Next Shift
                      </h4>
                      <ul className="space-y-1">
                        {note.priorityItems.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <ChevronRight className="h-3 w-3 mt-1" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {note.concernsFlags.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Concerns:</strong> {note.concernsFlags.join(" | ")}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="journal" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shared Care Journal</h2>
            <Button onClick={() => setShowNewJournalDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </div>

          <div className="space-y-4">
            {sampleJournalEntries.map(entry => {
              const Icon = journalCategoryIcons[entry.category] || FileText;
              return (
                <Card key={entry.id} className={entry.isPinned ? "border-primary" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${categoryColors[entry.category] || "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{entry.caregiverName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.date)} at {entry.time}
                          </span>
                          <Badge variant="outline" className={categoryColors[entry.category]}>
                            {entry.category}
                          </Badge>
                          {entry.isPinned && <Pin className="h-3 w-3 text-primary" />}
                          {entry.isImportant && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shared Documents</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Share2 className="h-4 w-4 mr-1" />
                Link Document
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sampleLinkedDocuments.length}</p>
                    <p className="text-sm text-muted-foreground">Total Documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Pin className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sampleLinkedDocuments.filter(d => d.isPinned).length}</p>
                    <p className="text-sm text-muted-foreground">Pinned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sampleLinkedDocuments.filter(d => d.sharedWith.length > 1).length}</p>
                    <p className="text-sm text-muted-foreground">Shared with Team</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {sampleLinkedDocuments.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)).map(doc => (
              <Card key={doc.id} className={doc.isPinned ? "border-amber-300 dark:border-amber-700" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${documentCategoryColors[doc.category]}`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{doc.title}</h3>
                        {doc.isPinned && <Pin className="h-4 w-4 text-amber-500 shrink-0" />}
                      </div>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className={documentCategoryColors[doc.category]}>
                          {documentCategoryLabels[doc.category]}
                        </Badge>
                        <span>{doc.fileType} - {doc.fileSize}</span>
                        <span>Uploaded by {doc.uploadedByName}</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {doc.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">
                          Shared with {doc.sharedWith.length} team member{doc.sharedWith.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" className="h-8">
                        <FileText className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8">
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Care Team</h2>
            <Button variant="outline">
              <UserPlus className="h-4 w-4 mr-1" />
              Invite Member
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sampleTeamMembers.map(member => (
              <Card key={member.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${member.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{member.name}</h3>
                        {member.isOnline ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">Online</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{member.lastActive}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      <p className="text-xs text-muted-foreground">{member.relationship}</p>
                      <div className="flex items-center gap-2 mt-3">
                        {member.phone && (
                          <Button size="sm" variant="outline" className="h-7">
                            <Phone className="h-3 w-3 mr-1" />
                            Call
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Message
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Task Title</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title"
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Add details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={newTask.category} onValueChange={(v: any) => setNewTask({ ...newTask, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="daily_care">Daily Care</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="household">Household</SelectItem>
                    <SelectItem value="emotional">Emotional Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(v: any) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assign To</Label>
              <Select value={newTask.assignedTo} onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {sampleTeamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
              </div>
              <div>
                <Label>Due Time</Label>
                <Input type="time" value={newTask.dueTime} onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>Cancel</Button>
            <Button onClick={() => createTaskMutation.mutate(newTask)} disabled={!newTask.title}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewJournalDialog} onOpenChange={setShowNewJournalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Category</Label>
              <Select value={newJournalEntry.category} onValueChange={(v: any) => setNewJournalEntry({ ...newJournalEntry, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="meal">Meal</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="mood">Mood</SelectItem>
                  <SelectItem value="symptom">Symptom</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entry</Label>
              <Textarea
                value={newJournalEntry.content}
                onChange={(e) => setNewJournalEntry({ ...newJournalEntry, content: e.target.value })}
                placeholder="What would you like to record?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewJournalDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              toast({ title: "Entry Added", description: "Journal entry has been saved." });
              setShowNewJournalDialog(false);
              setNewJournalEntry({ category: "observation", content: "", isImportant: false });
            }} disabled={!newJournalEntry.content}>
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-caregiver-collaboration-hub-disclaimer" />
    </div>
  );
}