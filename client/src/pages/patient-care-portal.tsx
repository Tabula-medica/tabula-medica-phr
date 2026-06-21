import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Target,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  MessageSquare,
  BookOpen,
  Bell,
  Send,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Heart,
  Pill,
  Activity,
  Award,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Star,
  FileText,
  Video,
  ExternalLink,
  User,
  X,
  CheckCheck,
  ArrowRight,
  Lightbulb,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PersonalizedLearnSection } from "@/components/personalized-learn-section";
import { SmartNudgeCard, SmartNudgeGenerator, SmartNudge } from "@/components/smart-nudge-card";

interface CarePathway {
  id: string;
  name: string;
  description: string;
  startDate: string;
  expectedEndDate: string;
  currentPhase: number;
  totalPhases: number;
  phases: PathwayPhase[];
  overallProgress: number;
  status: "active" | "completed" | "on_hold";
  assignedProvider: string;
  lastUpdated: string;
}

interface PathwayPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: "completed" | "current" | "upcoming";
  startDate?: string;
  completedDate?: string;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedDate?: string;
}

interface DailyTask {
  id: string;
  pathwayId: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "monitoring" | "education" | "appointment" | "lifestyle";
  scheduledTime?: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  recurring: boolean;
  recurrencePattern?: string;
  estimatedMinutes: number;
  points: number;
  instructions?: string;
}

interface EducationalContent {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "infographic" | "quiz";
  category: string;
  duration: string;
  pathwayRelevant: boolean;
  completed: boolean;
  completedAt?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface SecureMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider" | "nurse" | "care_coordinator";
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
  thread?: SecureMessage[];
}

interface Nudge {
  id: string;
  type: "reminder" | "encouragement" | "tip" | "milestone" | "feedback_request";
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  dismissed: boolean;
  relatedTaskId?: string;
}

interface FeedbackEntry {
  id: string;
  taskId?: string;
  type: "task_completion" | "daily_checkin" | "milestone" | "general";
  rating?: number;
  comment?: string;
  createdAt: string;
}

const mockPathways: CarePathway[] = [
  {
    id: "pathway-1",
    name: "Type 2 Diabetes Management Program",
    description: "A comprehensive 12-week program to help you manage your diabetes through lifestyle changes, medication adherence, and regular monitoring.",
    startDate: new Date(Date.now() - 2592000000).toISOString(),
    expectedEndDate: new Date(Date.now() + 5184000000).toISOString(),
    currentPhase: 2,
    totalPhases: 4,
    phases: [
      {
        id: "phase-1",
        name: "Assessment & Education",
        description: "Initial health assessment and diabetes education",
        order: 1,
        status: "completed",
        startDate: new Date(Date.now() - 2592000000).toISOString(),
        completedDate: new Date(Date.now() - 1728000000).toISOString(),
        milestones: [
          { id: "m1", title: "Complete initial assessment", completed: true, completedDate: new Date(Date.now() - 2500000000).toISOString() },
          { id: "m2", title: "Watch diabetes basics video", completed: true, completedDate: new Date(Date.now() - 2400000000).toISOString() },
          { id: "m3", title: "Meet with care coordinator", completed: true, completedDate: new Date(Date.now() - 1800000000).toISOString() },
        ],
      },
      {
        id: "phase-2",
        name: "Lifestyle Modification",
        description: "Focus on diet, exercise, and daily monitoring",
        order: 2,
        status: "current",
        startDate: new Date(Date.now() - 1728000000).toISOString(),
        milestones: [
          { id: "m4", title: "Log meals for 7 consecutive days", completed: true, completedDate: new Date(Date.now() - 864000000).toISOString() },
          { id: "m5", title: "Complete 30 minutes of exercise 5x/week", completed: false },
          { id: "m6", title: "Check blood glucose daily for 2 weeks", completed: false },
        ],
      },
      {
        id: "phase-3",
        name: "Medication Optimization",
        description: "Fine-tune medication regimen based on progress",
        order: 3,
        status: "upcoming",
        milestones: [
          { id: "m7", title: "A1C test", completed: false },
          { id: "m8", title: "Medication review with provider", completed: false },
        ],
      },
      {
        id: "phase-4",
        name: "Maintenance & Independence",
        description: "Transition to self-management with periodic check-ins",
        order: 4,
        status: "upcoming",
        milestones: [
          { id: "m9", title: "Complete self-management quiz", completed: false },
          { id: "m10", title: "Create personalized maintenance plan", completed: false },
        ],
      },
    ],
    overallProgress: 42,
    status: "active",
    assignedProvider: "Dr. Sarah Mitchell",
    lastUpdated: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockTasks: DailyTask[] = [
  {
    id: "task-1",
    pathwayId: "pathway-1",
    title: "Take morning medication",
    description: "Take Metformin 500mg with breakfast",
    category: "medication",
    scheduledTime: "08:00",
    dueDate: new Date().toISOString(),
    completed: false,
    recurring: true,
    recurrencePattern: "daily",
    estimatedMinutes: 2,
    points: 10,
    instructions: "Take with food to reduce stomach upset. Drink a full glass of water.",
  },
  {
    id: "task-2",
    pathwayId: "pathway-1",
    title: "Check blood glucose",
    description: "Morning fasting blood glucose check",
    category: "monitoring",
    scheduledTime: "07:30",
    dueDate: new Date().toISOString(),
    completed: true,
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    recurring: true,
    recurrencePattern: "daily",
    estimatedMinutes: 5,
    points: 15,
  },
  {
    id: "task-3",
    pathwayId: "pathway-1",
    title: "30-minute walk",
    description: "Moderate-paced walking exercise",
    category: "exercise",
    dueDate: new Date().toISOString(),
    completed: false,
    recurring: true,
    recurrencePattern: "daily",
    estimatedMinutes: 30,
    points: 25,
    instructions: "Walk at a pace where you can talk but not sing. Stay hydrated.",
  },
  {
    id: "task-4",
    pathwayId: "pathway-1",
    title: "Log your meals",
    description: "Record what you ate for breakfast, lunch, and dinner",
    category: "lifestyle",
    dueDate: new Date().toISOString(),
    completed: false,
    recurring: true,
    recurrencePattern: "daily",
    estimatedMinutes: 10,
    points: 15,
  },
  {
    id: "task-5",
    pathwayId: "pathway-1",
    title: "Watch: Understanding Carbohydrates",
    description: "Educational video about carbs and blood sugar",
    category: "education",
    dueDate: addDays(new Date(), 1).toISOString(),
    completed: false,
    recurring: false,
    estimatedMinutes: 15,
    points: 20,
  },
  {
    id: "task-6",
    pathwayId: "pathway-1",
    title: "Evening medication",
    description: "Take Metformin 500mg with dinner",
    category: "medication",
    scheduledTime: "18:00",
    dueDate: new Date().toISOString(),
    completed: false,
    recurring: true,
    recurrencePattern: "daily",
    estimatedMinutes: 2,
    points: 10,
  },
];

const mockEducation: EducationalContent[] = [
  {
    id: "edu-1",
    title: "Understanding Your A1C Results",
    description: "Learn what A1C means and how to interpret your results",
    type: "article",
    category: "Diabetes Basics",
    duration: "5 min read",
    pathwayRelevant: true,
    completed: true,
    completedAt: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "edu-2",
    title: "Carbohydrate Counting Made Simple",
    description: "A beginner's guide to counting carbs for better blood sugar control",
    type: "video",
    category: "Nutrition",
    duration: "12 min",
    pathwayRelevant: true,
    completed: false,
  },
  {
    id: "edu-3",
    title: "Exercise and Blood Sugar",
    description: "How physical activity affects your glucose levels",
    type: "article",
    category: "Exercise",
    duration: "7 min read",
    pathwayRelevant: true,
    completed: false,
  },
  {
    id: "edu-4",
    title: "Diabetes Nutrition Quiz",
    description: "Test your knowledge about healthy eating with diabetes",
    type: "quiz",
    category: "Nutrition",
    duration: "10 min",
    pathwayRelevant: true,
    completed: false,
  },
  {
    id: "edu-5",
    title: "Managing Stress with Diabetes",
    description: "Techniques for stress management and its impact on blood sugar",
    type: "infographic",
    category: "Mental Health",
    duration: "3 min",
    pathwayRelevant: false,
    completed: false,
  },
];

const mockMessages: SecureMessage[] = [
  {
    id: "msg-1",
    senderId: "provider-1",
    senderName: "Dr. Sarah Mitchell",
    senderRole: "provider",
    recipientId: "patient-1",
    recipientName: "You",
    subject: "Great progress on your meal logging!",
    content: "I noticed you've been consistently logging your meals for the past week. That's excellent progress! Keep up the great work. Your food choices are looking much more balanced.\n\nLet me know if you have any questions about portion sizes or carb counting.",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
  {
    id: "msg-2",
    senderId: "nurse-1",
    senderName: "Nurse Johnson",
    senderRole: "nurse",
    recipientId: "patient-1",
    recipientName: "You",
    subject: "Reminder: A1C Test Next Week",
    content: "Hi! Just a friendly reminder that your A1C test is scheduled for next Tuesday at 9 AM. Please remember to fast for 8 hours before the test.\n\nIf you need to reschedule, please let us know at least 24 hours in advance.",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    read: false,
  },
  {
    id: "msg-3",
    senderId: "coordinator-1",
    senderName: "Care Coordinator Lisa",
    senderRole: "care_coordinator",
    recipientId: "patient-1",
    recipientName: "You",
    subject: "Welcome to Phase 2!",
    content: "Congratulations on completing Phase 1 of your diabetes management program! You've made great progress with the initial education and assessment.\n\nPhase 2 focuses on lifestyle modifications. You'll be working on:\n- Daily blood glucose monitoring\n- Meal logging\n- Regular exercise\n\nI'm here to support you every step of the way. Don't hesitate to reach out if you have any questions!",
    timestamp: new Date(Date.now() - 1209600000).toISOString(),
    read: true,
  },
];

const mockNudges: Nudge[] = [
  {
    id: "nudge-1",
    type: "reminder",
    title: "Time for your walk!",
    message: "You're halfway through the day. A 30-minute walk now can help stabilize your afternoon blood sugar.",
    priority: "medium",
    actionLabel: "Start Walk",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    dismissed: false,
    relatedTaskId: "task-3",
  },
  {
    id: "nudge-2",
    type: "encouragement",
    title: "Amazing streak!",
    message: "You've completed your morning medication 7 days in a row! Keep up the excellent work.",
    priority: "low",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    dismissed: false,
  },
  {
    id: "nudge-3",
    type: "tip",
    title: "Quick Tip",
    message: "Drinking water before meals can help you feel fuller and eat smaller portions.",
    priority: "low",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    dismissed: false,
  },
  {
    id: "nudge-4",
    type: "milestone",
    title: "Milestone Approaching!",
    message: "You're just 2 days away from completing 14 consecutive days of blood glucose monitoring!",
    priority: "high",
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    dismissed: false,
  },
];

function getCategoryIcon(category: DailyTask["category"]) {
  const icons = {
    medication: Pill,
    exercise: Activity,
    monitoring: Heart,
    education: BookOpen,
    appointment: Calendar,
    lifestyle: Target,
  };
  return icons[category] || Circle;
}

function getCategoryColor(category: DailyTask["category"]) {
  const colors = {
    medication: "text-purple-500",
    exercise: "text-green-500",
    monitoring: "text-red-500",
    education: "text-blue-500",
    appointment: "text-orange-500",
    lifestyle: "text-teal-500",
  };
  return colors[category] || "text-gray-500";
}

function NudgeCard({ nudge, onDismiss, onAction }: { nudge: Nudge; onDismiss: (id: string) => void; onAction?: (id: string) => void }) {
  const iconMap = {
    reminder: Clock,
    encouragement: Award,
    tip: Lightbulb,
    milestone: Star,
    feedback_request: MessageSquare,
  };
  const Icon = iconMap[nudge.type] || Bell;

  const bgColors = {
    low: "bg-muted/50",
    medium: "bg-blue-50 dark:bg-blue-900/20",
    high: "bg-amber-50 dark:bg-amber-900/20",
  };

  return (
    <div 
      className={`p-3 rounded-lg ${bgColors[nudge.priority]} relative group`}
      data-testid={`nudge-${nudge.id}`}
    >
      <button
        onClick={() => onDismiss(nudge.id)}
        className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
        aria-label="Dismiss notification"
        data-testid={`nudge-dismiss-${nudge.id}`}
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${nudge.priority === "high" ? "bg-amber-100 dark:bg-amber-800" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${nudge.priority === "high" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{nudge.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{nudge.message}</p>
          {nudge.actionLabel && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-auto mt-2 text-xs text-primary"
              onClick={() => onAction?.(nudge.id)}
            >
              {nudge.actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ 
  task, 
  onComplete, 
  onFeedback 
}: { 
  task: DailyTask; 
  onComplete: (id: string) => void;
  onFeedback: (id: string, rating: number, comment?: string) => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const Icon = getCategoryIcon(task.category);
  const colorClass = getCategoryColor(task.category);

  const handleComplete = () => {
    onComplete(task.id);
    setShowFeedback(true);
  };

  const handleSubmitFeedback = () => {
    if (rating !== null) {
      onFeedback(task.id, rating, comment || undefined);
    }
    setShowFeedback(false);
    setRating(null);
    setComment("");
  };

  return (
    <div 
      className={`p-4 rounded-lg border ${task.completed ? "bg-muted/30 border-muted" : "bg-card border-border hover-elevate"}`}
      data-testid={`task-${task.id}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={handleComplete}
          disabled={task.completed}
          className={`mt-0.5 flex-shrink-0 ${task.completed ? "cursor-default" : "cursor-pointer"}`}
          aria-label={task.completed ? "Task completed" : "Mark task as complete"}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden="true" />
            <h4 className={`font-medium text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </h4>
            <Badge variant="secondary" className="text-xs">
              +{task.points} pts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {task.scheduledTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {task.scheduledTime}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {task.estimatedMinutes} min
            </span>
            {task.recurring && (
              <Badge variant="outline" className="text-xs">Daily</Badge>
            )}
          </div>
          {task.instructions && !task.completed && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <span className="font-medium">Instructions:</span> {task.instructions}
            </div>
          )}
          {task.completed && task.completedAt && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Task Completed!
            </DialogTitle>
            <DialogDescription>
              Great job completing "{task.title}"! How did it go?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">Rate your experience:</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-2 rounded-full hover:bg-muted ${rating !== null && star <= rating ? "text-yellow-500" : "text-muted-foreground"}`}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star className={`w-6 h-6 ${rating !== null && star <= rating ? "fill-current" : ""}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Any comments? (optional)</p>
              <Textarea
                placeholder="Share how you felt, any challenges, or suggestions..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedback(false)}>Skip</Button>
            <Button onClick={handleSubmitFeedback}>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageCard({ message, onReply }: { message: SecureMessage; onReply: (id: string) => void }) {
  const roleColors = {
    provider: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    nurse: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    care_coordinator: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    patient: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <button
      type="button"
      className={`w-full text-left p-4 rounded-lg border hover-elevate cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        message.read ? "bg-card" : "bg-primary/5 border-primary/20"
      }`}
      onClick={() => onReply(message.id)}
      data-testid={`message-${message.id}`}
      aria-label={`Message from ${message.senderName}: ${message.subject}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm">{message.senderName}</span>
            <Badge className={roleColors[message.senderRole]}>
              {message.senderRole.replace("_", " ")}
            </Badge>
            {!message.read && (
              <Badge variant="default" className="text-xs">New</Badge>
            )}
          </div>
          <h4 className="font-medium text-sm truncate">{message.subject}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{message.content}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>
    </button>
  );
}

function EducationCard({ content, onStart }: { content: EducationalContent; onStart: (id: string) => void }) {
  const typeIcons = {
    article: FileText,
    video: Video,
    infographic: BookOpen,
    quiz: Sparkles,
  };
  const Icon = typeIcons[content.type] || FileText;

  return (
    <div 
      className={`p-4 rounded-lg border hover-elevate ${content.completed ? "bg-muted/30" : "bg-card"}`}
      data-testid={`education-${content.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${content.completed ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"}`}>
          {content.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Icon className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm">{content.title}</h4>
            {content.pathwayRelevant && (
              <Badge variant="outline" className="text-xs border-primary text-primary">
                For Your Pathway
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{content.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="secondary" className="text-xs capitalize">{content.type}</Badge>
            <span className="text-xs text-muted-foreground">{content.duration}</span>
            <span className="text-xs text-muted-foreground">{content.category}</span>
          </div>
          {content.completed && content.completedAt && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Completed {formatDistanceToNow(new Date(content.completedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        {!content.completed && (
          <Button size="sm" onClick={() => onStart(content.id)}>
            Start
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PatientCarePortal() {
  const [activeTab, setActiveTab] = useState("pathway");
  const [tasks, setTasks] = useState(mockTasks);
  const [nudges, setNudges] = useState(mockNudges);
  const [smartNudges, setSmartNudges] = useState<SmartNudge[]>([]);
  const [messages, setMessages] = useState(mockMessages);
  const [education, setEducation] = useState(mockEducation);
  const [selectedMessage, setSelectedMessage] = useState<SecureMessage | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [totalPoints, setTotalPoints] = useState(185);
  const { toast } = useToast();

  const pathway = mockPathways[0];
  const todayTasks = tasks.filter(t => isToday(new Date(t.dueDate)));
  const upcomingTasks = tasks.filter(t => !isToday(new Date(t.dueDate)) && !isPast(new Date(t.dueDate)));
  const completedToday = todayTasks.filter(t => t.completed).length;
  const unreadMessages = messages.filter(m => !m.read).length;
  const activeNudges = nudges.filter(n => !n.dismissed);
  const activeSmartNudges = smartNudges.filter(n => !n.dismissed);

  const patientProfile = {
    patientId: "patient-1",
    name: "John",
    healthLiteracyLevel: "intermediate" as const,
    preferredLanguage: "en",
    communicationPreference: "friendly" as const,
    activeConditions: ["Type 2 Diabetes"],
    learningStyle: "mixed" as const,
  };

  const pathwayContext = {
    pathwayId: pathway.id,
    pathwayName: pathway.name,
    currentPhase: pathway.phases.find(p => p.status === "current")?.name || "Getting Started",
    phaseProgress: 65,
    overallProgress: pathway.overallProgress,
    completedMilestones: pathway.phases
      .flatMap(p => p.milestones)
      .filter(m => m.completed)
      .map(m => m.title),
    upcomingMilestones: pathway.phases
      .flatMap(p => p.milestones)
      .filter(m => !m.completed)
      .map(m => m.title)
      .slice(0, 3),
    recentActivities: tasks
      .filter(t => t.completed)
      .slice(0, 5)
      .map(t => ({
        activity: t.title,
        timestamp: t.completedAt || new Date().toISOString(),
        success: true,
      })),
  };

  const behaviorPattern = {
    taskCompletionRate: Math.round((completedToday / Math.max(todayTasks.length, 1)) * 100),
    streakDays: 7,
    preferredTimeOfDay: "morning" as const,
    successPatterns: ["morning medication", "blood glucose monitoring"],
    missedTaskPatterns: tasks.filter(t => !t.completed && isPast(new Date(t.dueDate))).map(t => t.category),
  };

  const handleSmartNudgeDismiss = (id: string) => {
    setSmartNudges(smartNudges.map(n => n.id === id ? { ...n, dismissed: true } : n));
  };

  const handleSmartNudgeAction = (id: string, url?: string) => {
    if (url?.includes("tasks")) setActiveTab("tasks");
    else if (url?.includes("learn")) setActiveTab("education");
    handleSmartNudgeDismiss(id);
  };

  const handleContentComplete = (contentId: string) => {
    setEducation(education.map(e => 
      e.id === contentId ? { ...e, completed: true, completedAt: new Date().toISOString() } : e
    ));
    setTotalPoints(prev => prev + 20);
    toast({
      title: "Content Completed!",
      description: "You earned 20 points for completing this content!",
    });
  };

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.completed) {
      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
      ));
      setTotalPoints(prev => prev + task.points);
      toast({
        title: "Task Completed!",
        description: `You earned ${task.points} points!`,
      });
    }
  };

  const handleTaskFeedback = (taskId: string, rating: number, comment?: string) => {
    toast({
      title: "Thank you for your feedback!",
      description: "Your input helps us improve your care experience.",
    });
  };

  const handleDismissNudge = (nudgeId: string) => {
    setNudges(nudges.map(n => n.id === nudgeId ? { ...n, dismissed: true } : n));
  };

  const handleNudgeAction = (nudgeId: string) => {
    const nudge = nudges.find(n => n.id === nudgeId);
    if (nudge?.relatedTaskId) {
      setActiveTab("tasks");
    }
    handleDismissNudge(nudgeId);
  };

  const handleMessageReply = () => {
    if (replyContent.trim() && selectedMessage) {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to your care team.",
      });
      setReplyContent("");
      setSelectedMessage(null);
    }
  };

  const handleStartEducation = (contentId: string) => {
    toast({
      title: "Opening Content",
      description: "Educational content will open in a new tab.",
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="patient-care-portal">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Heart className="w-7 h-7 text-primary" aria-hidden="true" />
                My Care Portal
              </h1>
              <p className="text-muted-foreground">
                Track your progress and complete your daily health tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                <Award className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="font-bold text-primary">{totalPoints}</span>
                <span className="text-sm text-muted-foreground">points</span>
              </div>
              <Button variant="outline" size="sm" className="relative" data-testid="button-messages">
                <MessageSquare className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {activeNudges.length > 0 && (
            <div className="space-y-2">
              {activeNudges.slice(0, 2).map(nudge => (
                <NudgeCard 
                  key={nudge.id} 
                  nudge={nudge} 
                  onDismiss={handleDismissNudge}
                  onAction={handleNudgeAction}
                />
              ))}
              {activeNudges.length > 2 && (
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View {activeNudges.length - 2} more notifications
                </Button>
              )}
            </div>
          )}

          {activeSmartNudges.length > 0 && (
            <div className="space-y-2" data-testid="smart-nudges-section">
              {activeSmartNudges.slice(0, 2).map(nudge => (
                <SmartNudgeCard 
                  key={nudge.id} 
                  nudge={nudge} 
                  onDismiss={handleSmartNudgeDismiss}
                  onAction={handleSmartNudgeAction}
                  showPersonalization
                />
              ))}
            </div>
          )}

          {activeNudges.length === 0 && activeSmartNudges.length === 0 && (
            <SmartNudgeGenerator
              patientProfile={patientProfile}
              pathwayContext={pathwayContext}
              behaviorPattern={behaviorPattern}
              pendingTasks={todayTasks.filter(t => !t.completed).map(t => ({
                id: t.id,
                title: t.title,
                category: t.category,
                dueDate: t.dueDate,
              }))}
              onNudgesGenerated={setSmartNudges}
            />
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="text-2xl font-bold text-primary">{completedToday}/{todayTasks.length}</div>
              <p className="text-xs text-muted-foreground">Tasks Today</p>
            </Card>
            <Card className="p-3">
              <div className="text-2xl font-bold text-green-600">{pathway.overallProgress}%</div>
              <p className="text-xs text-muted-foreground">Pathway Progress</p>
            </Card>
            <Card className="p-3">
              <div className="text-2xl font-bold text-blue-600">7</div>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </Card>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pathway" data-testid="tab-pathway">
              <Target className="w-4 h-4 mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Pathway</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education">
              <BookOpen className="w-4 h-4 mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Learn</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative" data-testid="tab-messages">
              <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Messages</span>
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pathway" className="mt-4 space-y-4">
            <Card data-testid="pathway-overview">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{pathway.name}</CardTitle>
                    <CardDescription>{pathway.description}</CardDescription>
                  </div>
                  <Badge variant={pathway.status === "active" ? "default" : "secondary"}>
                    {pathway.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span className="font-medium">{pathway.overallProgress}%</span>
                  </div>
                  <Progress value={pathway.overallProgress} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">{format(new Date(pathway.startDate), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expected Completion</p>
                    <p className="font-medium">{format(new Date(pathway.expectedEndDate), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Your Provider</p>
                    <p className="font-medium">{pathway.assignedProvider}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Phase</p>
                    <p className="font-medium">Phase {pathway.currentPhase} of {pathway.totalPhases}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="pathway-phases">
              <CardHeader>
                <CardTitle className="text-lg">Your Journey</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pathway.phases.map((phase, index) => (
                    <div key={phase.id} className="relative">
                      {index < pathway.phases.length - 1 && (
                        <div className={`absolute left-4 top-10 w-0.5 h-full ${
                          phase.status === "completed" ? "bg-green-500" : "bg-muted"
                        }`} />
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          phase.status === "completed" ? "bg-green-500 text-white" :
                          phase.status === "current" ? "bg-primary text-primary-foreground" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {phase.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span className="text-sm font-medium">{phase.order}</span>
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{phase.name}</h4>
                            {phase.status === "current" && (
                              <Badge className="bg-primary/20 text-primary">Current</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                          {(phase.status === "completed" || phase.status === "current") && (
                            <div className="space-y-2">
                              {phase.milestones.map(milestone => (
                                <div key={milestone.id} className="flex items-center gap-2 text-sm">
                                  {milestone.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className={milestone.completed ? "text-muted-foreground line-through" : ""}>
                                    {milestone.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Today's Tasks</CardTitle>
                  <Badge variant="outline">
                    {completedToday}/{todayTasks.length} completed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No tasks scheduled for today. Great job staying on track!
                  </p>
                ) : (
                  todayTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onComplete={handleCompleteTask}
                      onFeedback={handleTaskFeedback}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {upcomingTasks.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onComplete={handleCompleteTask}
                      onFeedback={handleTaskFeedback}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="education" className="mt-4">
            <PersonalizedLearnSection
              education={education}
              patientProfile={patientProfile}
              pathwayContext={pathwayContext}
              onContentComplete={handleContentComplete}
            />
          </TabsContent>

          <TabsContent value="messages" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Secure Messages</CardTitle>
                  <Button size="sm" onClick={() => setShowNewMessage(true)} data-testid="button-new-message">
                    <Send className="w-4 h-4 mr-2" />
                    New Message
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Your care team will reach out when needed.
                  </p>
                ) : (
                  messages.map(message => (
                    <MessageCard 
                      key={message.id} 
                      message={message} 
                      onReply={(id) => {
                        setSelectedMessage(messages.find(m => m.id === id) || null);
                        setMessages(messages.map(m => m.id === id ? { ...m, read: true } : m));
                      }}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Sheet open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
              <SheetContent className="w-full sm:max-w-lg">
                {selectedMessage && (
                  <>
                    <SheetHeader>
                      <SheetTitle>{selectedMessage.subject}</SheetTitle>
                      <SheetDescription>
                        From {selectedMessage.senderName} - {formatDistanceToNow(new Date(selectedMessage.timestamp), { addSuffix: true })}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{selectedMessage.content}</p>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Reply:</p>
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={4}
                        />
                        <Button onClick={handleMessageReply} disabled={!replyContent.trim()} className="w-full">
                          <Send className="w-4 h-4 mr-2" />
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>

            <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Message</DialogTitle>
                  <DialogDescription>
                    Send a secure message to your care team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <p className="text-sm font-medium mb-2">To:</p>
                    <Input value="Care Team" disabled />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Subject:</p>
                    <Input placeholder="Enter subject..." />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Message:</p>
                    <Textarea placeholder="Type your message..." rows={4} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewMessage(false)}>Cancel</Button>
                  <Button onClick={() => {
                    toast({
                      title: "Message Sent",
                      description: "Your care team will respond within 24-48 hours.",
                    });
                    setShowNewMessage(false);
                  }}>
                    Send Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-muted-foreground py-4 border-t">
          <p>
            This portal is for informational purposes. For urgent medical concerns, please contact your healthcare provider or call 911.
          </p>
        </footer>
      </div>
    </div>
  );
}
