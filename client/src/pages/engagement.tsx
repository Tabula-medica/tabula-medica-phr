import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bell,
  FileText,
  Share2,
  Calendar,
  Clock,
  CheckCircle,
  Mail,
  Smartphone,
  Download,
  Send,
  Eye,
  TrendingUp,
  Pill,
  FlaskConical,
  Heart,
  Settings,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  Trophy,
  Star,
  Zap,
  Target,
  MessageCircle,
  ThumbsUp,
  Users,
  Flame,
  Award,
  Crown,
  Footprints,
  Apple,
  Moon,
  Brain,
  Plus,
  Reply,
  AlertCircle,
} from "lucide-react";

interface Notification {
  id: string;
  type: "new_record" | "snapshot" | "reminder" | "share";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, string>;
}

interface HealthSnapshot {
  id: string;
  month: string;
  year: number;
  generatedAt: string;
  metrics: {
    newRecords: number;
    medications: number;
    labResults: number;
    appointments: number;
  };
  shared: boolean;
  sharedWith?: string[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "health" | "engagement" | "milestone" | "streak";
  earnedAt: string | null;
  progress: number;
  maxProgress: number;
  points: number;
}

interface ForumPost {
  id: string;
  authorName: string;
  authorInitials: string;
  category: string;
  title: string;
  content: string;
  timestamp: string;
  likes: number;
  replies: number;
  isLiked: boolean;
}

interface HealthChallenge {
  id: string;
  title: string;
  description: string;
  category: "exercise" | "nutrition" | "sleep" | "mindfulness" | "medication";
  difficulty: "easy" | "medium" | "hard";
  duration: string;
  points: number;
  progress: number;
  target: number;
  unit: string;
  isActive: boolean;
  isCompleted: boolean;
  participants: number;
}

const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "new_record",
    title: "New record received",
    description: "Lab Results - Complete Blood Count from City Medical Center",
    timestamp: "2026-01-18T09:30:00Z",
    read: false,
    actionUrl: "/documents",
    metadata: { source: "City Medical Center", recordType: "Lab Results" },
  },
  {
    id: "notif-2",
    type: "new_record",
    title: "New record received",
    description: "Prescription record synced from CVS Pharmacy",
    timestamp: "2026-01-17T14:20:00Z",
    read: false,
    actionUrl: "/medications",
    metadata: { source: "CVS Pharmacy", recordType: "Prescription" },
  },
  {
    id: "notif-3",
    type: "snapshot",
    title: "Your January snapshot is ready",
    description: "Review your monthly health summary and share with your care team",
    timestamp: "2026-01-15T08:00:00Z",
    read: true,
    actionUrl: "/engagement",
  },
  {
    id: "notif-4",
    type: "reminder",
    title: "Upcoming appointment",
    description: "Annual Physical with Dr. Johnson in 7 days",
    timestamp: "2026-01-14T10:00:00Z",
    read: true,
    actionUrl: "/appointments",
  },
];

const mockSnapshots: HealthSnapshot[] = [
  {
    id: "snap-1",
    month: "January",
    year: 2026,
    generatedAt: "2026-01-15T08:00:00Z",
    metrics: { newRecords: 8, medications: 3, labResults: 2, appointments: 1 },
    shared: false,
  },
  {
    id: "snap-2",
    month: "December",
    year: 2025,
    generatedAt: "2025-12-15T08:00:00Z",
    metrics: { newRecords: 12, medications: 4, labResults: 3, appointments: 2 },
    shared: true,
    sharedWith: ["Dr. Sarah Johnson"],
  },
];

const mockAchievements: Achievement[] = [
  {
    id: "ach-1",
    name: "Health Pioneer",
    description: "Connect your first EHR source",
    icon: "trophy",
    category: "milestone",
    earnedAt: "2026-01-01T10:00:00Z",
    progress: 1,
    maxProgress: 1,
    points: 100,
  },
  {
    id: "ach-2",
    name: "Medication Master",
    description: "Log medication intake for 7 consecutive days",
    icon: "pill",
    category: "streak",
    earnedAt: "2026-01-10T08:00:00Z",
    progress: 7,
    maxProgress: 7,
    points: 150,
  },
  {
    id: "ach-3",
    name: "Data Champion",
    description: "Sync records from 5 different healthcare sources",
    icon: "star",
    category: "health",
    earnedAt: null,
    progress: 3,
    maxProgress: 5,
    points: 200,
  },
  {
    id: "ach-4",
    name: "Community Helper",
    description: "Help 10 community members with supportive replies",
    icon: "heart",
    category: "engagement",
    earnedAt: null,
    progress: 4,
    maxProgress: 10,
    points: 250,
  },
  {
    id: "ach-5",
    name: "30-Day Streak",
    description: "Check in to your health dashboard for 30 consecutive days",
    icon: "flame",
    category: "streak",
    earnedAt: null,
    progress: 18,
    maxProgress: 30,
    points: 300,
  },
  {
    id: "ach-6",
    name: "Goal Getter",
    description: "Complete 5 health challenges",
    icon: "target",
    category: "health",
    earnedAt: null,
    progress: 2,
    maxProgress: 5,
    points: 200,
  },
];

const mockForumPosts: ForumPost[] = [
  {
    id: "post-1",
    authorName: "Sarah M.",
    authorInitials: "SM",
    category: "Wellness Tips",
    title: "How I improved my sleep quality",
    content: "I have been struggling with sleep for years, but making a few simple changes to my evening routine has made a huge difference. I started by limiting screen time an hour before bed and keeping my room cooler. Within a week, I noticed I was falling asleep faster and waking up more refreshed.",
    timestamp: "2026-01-18T08:30:00Z",
    likes: 24,
    replies: 8,
    isLiked: false,
  },
  {
    id: "post-2",
    authorName: "Michael R.",
    authorInitials: "MR",
    category: "Managing Conditions",
    title: "Tips for tracking blood pressure at home",
    content: "After my doctor recommended I monitor my blood pressure at home, I found some helpful techniques. Taking readings at the same time each day and resting for 5 minutes before measuring really helped get consistent results. I keep a simple log that I share with my care team during visits.",
    timestamp: "2026-01-17T14:20:00Z",
    likes: 18,
    replies: 12,
    isLiked: true,
  },
  {
    id: "post-3",
    authorName: "Jennifer L.",
    authorInitials: "JL",
    category: "Nutrition",
    title: "Simple meal prep ideas for busy weeks",
    content: "I used to struggle with eating healthy during busy work weeks. Now I spend an hour on Sundays preparing ingredients - washing and cutting vegetables, cooking grains, and portioning proteins. It makes putting together balanced meals so much easier throughout the week.",
    timestamp: "2026-01-16T11:00:00Z",
    likes: 31,
    replies: 15,
    isLiked: false,
  },
  {
    id: "post-4",
    authorName: "David K.",
    authorInitials: "DK",
    category: "Exercise",
    title: "Starting a walking routine after surgery",
    content: "After my knee surgery, I was nervous about getting back to exercise. My physical therapist suggested starting with just 5-minute walks and gradually increasing. I am now up to 30 minutes a day and feeling stronger every week. Small steps really do add up.",
    timestamp: "2026-01-15T16:45:00Z",
    likes: 42,
    replies: 20,
    isLiked: true,
  },
];

const mockChallenges: HealthChallenge[] = [
  {
    id: "ch-1",
    title: "Hydration Hero",
    description: "Drink 8 glasses of water daily for a week",
    category: "nutrition",
    difficulty: "easy",
    duration: "7 days",
    points: 100,
    progress: 5,
    target: 7,
    unit: "days",
    isActive: true,
    isCompleted: false,
    participants: 1247,
  },
  {
    id: "ch-2",
    title: "Step It Up",
    description: "Walk 10,000 steps daily for 5 days",
    category: "exercise",
    difficulty: "medium",
    duration: "5 days",
    points: 150,
    progress: 2,
    target: 5,
    unit: "days",
    isActive: true,
    isCompleted: false,
    participants: 892,
  },
  {
    id: "ch-3",
    title: "Mindful Mornings",
    description: "Practice 5 minutes of meditation each morning",
    category: "mindfulness",
    difficulty: "easy",
    duration: "7 days",
    points: 100,
    progress: 0,
    target: 7,
    unit: "days",
    isActive: false,
    isCompleted: false,
    participants: 654,
  },
  {
    id: "ch-4",
    title: "Sleep Champion",
    description: "Get 7-8 hours of sleep for 5 consecutive nights",
    category: "sleep",
    difficulty: "medium",
    duration: "5 days",
    points: 150,
    progress: 5,
    target: 5,
    unit: "nights",
    isActive: false,
    isCompleted: true,
    participants: 1089,
  },
  {
    id: "ch-5",
    title: "Medication Consistency",
    description: "Take all medications on time for 14 days",
    category: "medication",
    difficulty: "hard",
    duration: "14 days",
    points: 250,
    progress: 0,
    target: 14,
    unit: "days",
    isActive: false,
    isCompleted: false,
    participants: 432,
  },
  {
    id: "ch-6",
    title: "Veggie Victory",
    description: "Include vegetables in every meal for 5 days",
    category: "nutrition",
    difficulty: "medium",
    duration: "5 days",
    points: 150,
    progress: 0,
    target: 5,
    unit: "days",
    isActive: false,
    isCompleted: false,
    participants: 768,
  },
];

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_record": return <FileText className="h-5 w-5" />;
    case "snapshot": return <TrendingUp className="h-5 w-5" />;
    case "reminder": return <Calendar className="h-5 w-5" />;
    case "share": return <Share2 className="h-5 w-5" />;
    default: return <Bell className="h-5 w-5" />;
  }
}

function getAchievementIcon(icon: string) {
  switch (icon) {
    case "trophy": return <Trophy className="h-6 w-6" />;
    case "star": return <Star className="h-6 w-6" />;
    case "pill": return <Pill className="h-6 w-6" />;
    case "heart": return <Heart className="h-6 w-6" />;
    case "flame": return <Flame className="h-6 w-6" />;
    case "target": return <Target className="h-6 w-6" />;
    default: return <Award className="h-6 w-6" />;
  }
}

function getChallengeIcon(category: string) {
  switch (category) {
    case "exercise": return <Footprints className="h-5 w-5" />;
    case "nutrition": return <Apple className="h-5 w-5" />;
    case "sleep": return <Moon className="h-5 w-5" />;
    case "mindfulness": return <Brain className="h-5 w-5" />;
    case "medication": return <Pill className="h-5 w-5" />;
    default: return <Target className="h-5 w-5" />;
  }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "easy": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "hard": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export default function Engagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("progress");
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [snapshots] = useState<HealthSnapshot[]>(mockSnapshots);
  const [achievements] = useState<Achievement[]>(mockAchievements);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(mockForumPosts);
  const [challenges, setChallenges] = useState<HealthChallenge[]>(mockChallenges);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<HealthSnapshot | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("Wellness Tips");
  
  const [preferences, setPreferences] = useState({
    pushNewRecords: true,
    pushSnapshots: true,
    pushReminders: true,
    emailDigest: true,
    emailSnapshots: true,
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalPoints = achievements
    .filter(a => a.earnedAt)
    .reduce((sum, a) => sum + a.points, 0);
  const earnedAchievements = achievements.filter(a => a.earnedAt).length;
  const currentStreak = 18;
  const activeChallenges = challenges.filter(c => c.isActive).length;
  const completedChallenges = challenges.filter(c => c.isCompleted).length;

  const handleMarkRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    toast({ title: "All notifications marked as read" });
  };

  const handleShareSnapshot = (snapshot: HealthSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShareEmail("");
    setShareMessage(`Here's my health snapshot for ${snapshot.month} ${snapshot.year}. This includes a summary of my recent health records.`);
    setShowShareDialog(true);
  };

  const handleSendShare = () => {
    if (!shareEmail.trim()) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Snapshot shared", 
      description: `Your snapshot has been sent to ${shareEmail}` 
    });
    setShowShareDialog(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://tabulamedica.health/snapshot/${selectedSnapshot?.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleLikePost = (postId: string) => {
    setForumPosts(forumPosts.map(post => 
      post.id === postId 
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handleJoinChallenge = (challengeId: string) => {
    setChallenges(challenges.map(ch => 
      ch.id === challengeId ? { ...ch, isActive: true } : ch
    ));
    toast({ title: "Challenge joined", description: "Good luck with your health challenge" });
  };

  const handleLogProgress = (challengeId: string) => {
    setChallenges(challenges.map(ch => {
      if (ch.id === challengeId && ch.progress < ch.target) {
        const newProgress = ch.progress + 1;
        const isCompleted = newProgress >= ch.target;
        if (isCompleted) {
          toast({ title: "Challenge completed", description: `You earned ${ch.points} points` });
        }
        return { ...ch, progress: newProgress, isCompleted };
      }
      return ch;
    }));
  };

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      authorName: "You",
      authorInitials: "YO",
      category: newPostCategory,
      title: newPostTitle,
      content: newPostContent,
      timestamp: new Date().toISOString(),
      likes: 0,
      replies: 0,
      isLiked: false,
    };
    setForumPosts([newPost, ...forumPosts]);
    setNewPostTitle("");
    setNewPostContent("");
    setShowNewPostDialog(false);
    toast({ title: "Post created", description: "Your post is now visible to the community" });
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-engagement">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Engagement Hub
          </h1>
          <p className="text-muted-foreground">
            Track your progress, connect with peers, and complete health challenges
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-total-points">{totalPoints}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-streak">{currentStreak}</div>
              <div className="text-sm text-muted-foreground">Day Streak</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-achievements">{earnedAchievements}/{achievements.length}</div>
              <div className="text-sm text-muted-foreground">Achievements</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="stat-challenges">{completedChallenges}</div>
              <div className="text-sm text-muted-foreground">Challenges Done</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="progress" data-testid="tab-progress">
            <Trophy className="h-4 w-4 mr-2" />
            Progress Tracker
          </TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">
            <Target className="h-4 w-4 mr-2" />
            Health Challenges
          </TabsTrigger>
          <TabsTrigger value="community" data-testid="tab-community">
            <Users className="h-4 w-4 mr-2" />
            Community Forum
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="snapshots" data-testid="tab-snapshots">
            <TrendingUp className="h-4 w-4 mr-2" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Current Streak
                </CardTitle>
                <CardDescription>
                  Keep your streak going by checking in daily
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-6">
                  <div className="text-6xl font-bold text-orange-500" data-testid="display-streak">{currentStreak}</div>
                  <div className="text-lg text-muted-foreground mt-2">consecutive days</div>
                </div>
                <div className="flex justify-center gap-2">
                  {[...Array(7)].map((_, i) => (
                    <div 
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        i < 5 
                          ? "bg-orange-500 text-white" 
                          : i === 5 
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-500 ring-2 ring-orange-500" 
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i < 5 ? <Check className="h-4 w-4" /> : ["M", "T", "W", "T", "F", "S", "S"][i]}
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  You are on track for a personal record
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Your Level
                </CardTitle>
                <CardDescription>
                  Earn points to level up and unlock new achievements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <div 
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                    data-testid="display-level-badge"
                  >
                    <span className="text-3xl font-bold" data-testid="display-level-number">5</span>
                  </div>
                  <div className="text-lg font-medium mt-3" data-testid="display-level-title">Health Champion</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span data-testid="display-current-points">{totalPoints} points</span>
                    <span>500 points to Level 6</span>
                  </div>
                  <Progress value={(totalPoints % 500) / 5} className="h-3" data-testid="progress-level-xp" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <div className="text-lg font-bold">{earnedAchievements}</div>
                    <div className="text-xs text-muted-foreground">Badges</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <div className="text-lg font-bold">{completedChallenges}</div>
                    <div className="text-xs text-muted-foreground">Challenges</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <div className="text-lg font-bold">{currentStreak}</div>
                    <div className="text-xs text-muted-foreground">Best Streak</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements
              </CardTitle>
              <CardDescription>
                Unlock badges by completing health activities and milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                  <div 
                    key={achievement.id}
                    className={`p-4 rounded-lg border ${
                      achievement.earnedAt 
                        ? "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800" 
                        : "bg-muted/50 border-border"
                    }`}
                    data-testid={`achievement-${achievement.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        achievement.earnedAt 
                          ? "bg-amber-500 text-white" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {getAchievementIcon(achievement.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{achievement.name}</h4>
                          {achievement.earnedAt && (
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{achievement.description}</p>
                        {!achievement.earnedAt && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{achievement.progress}/{achievement.maxProgress}</span>
                              <span>{achievement.points} pts</span>
                            </div>
                            <Progress 
                              value={(achievement.progress / achievement.maxProgress) * 100} 
                              className="h-1.5"
                              data-testid={`progress-achievement-${achievement.id}`}
                            />
                          </div>
                        )}
                        {achievement.earnedAt && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              +{achievement.points} pts
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Earned {formatDate(achievement.earnedAt)}
                            </span>
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

        <TabsContent value="challenges" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold">Health Challenges</h2>
              <p className="text-muted-foreground">Complete challenges to earn points and improve your health</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1">
                <Target className="h-3 w-3 mr-1" />
                {activeChallenges} Active
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                {completedChallenges} Completed
              </Badge>
            </div>
          </div>

          {activeChallenges > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Active Challenges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {challenges.filter(c => c.isActive && !c.isCompleted).map((challenge) => (
                  <div 
                    key={challenge.id}
                    className="p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent"
                    data-testid={`challenge-active-${challenge.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        {getChallengeIcon(challenge.category)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-medium">{challenge.title}</h4>
                          <Badge className={getDifficultyColor(challenge.difficulty)}>
                            {challenge.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{challenge.progress} / {challenge.target} {challenge.unit}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">+{challenge.points} pts</span>
                          </div>
                          <Progress value={(challenge.progress / challenge.target) * 100} className="h-2" data-testid={`progress-challenge-${challenge.id}`} />
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleLogProgress(challenge.id)}
                        data-testid={`button-log-progress-${challenge.id}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Log Progress
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Available Challenges
              </CardTitle>
              <CardDescription>
                Join a challenge that matches your health goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {challenges.filter(c => !c.isActive && !c.isCompleted).map((challenge) => (
                  <Card 
                    key={challenge.id} 
                    className="hover-elevate"
                    data-testid={`challenge-available-${challenge.id}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {getChallengeIcon(challenge.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{challenge.title}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">
                              {challenge.duration}
                            </Badge>
                            <Badge className={`text-xs ${getDifficultyColor(challenge.difficulty)}`}>
                              {challenge.difficulty}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{challenge.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {challenge.participants.toLocaleString()} joined
                        </div>
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          +{challenge.points} pts
                        </span>
                      </div>
                      <Button 
                        className="w-full" 
                        size="sm"
                        onClick={() => handleJoinChallenge(challenge.id)}
                        data-testid={`button-join-challenge-${challenge.id}`}
                      >
                        Join Challenge
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {completedChallenges > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Completed Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {challenges.filter(c => c.isCompleted).map((challenge) => (
                    <div 
                      key={challenge.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      data-testid={`challenge-completed-${challenge.id}`}
                    >
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        {getChallengeIcon(challenge.category)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{challenge.title}</h4>
                        <p className="text-sm text-muted-foreground">{challenge.duration}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Check className="h-3 w-3 mr-1" />
                        +{challenge.points} pts earned
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="community" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold">Community Forum</h2>
              <p className="text-muted-foreground">Connect with peers, share experiences, and support each other</p>
            </div>
            <Button onClick={() => setShowNewPostDialog(true)} data-testid="button-new-post">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </div>

          <div className="grid lg:grid-cols-4 gap-4 mb-6">
            {["Wellness Tips", "Managing Conditions", "Nutrition", "Exercise"].map((category, idx) => (
              <Card 
                key={category} 
                className="p-3 hover-elevate cursor-pointer"
                data-testid={`category-card-${idx}`}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{category}</span>
                </div>
              </Card>
            ))}
          </div>

          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" data-testid="community-guidelines">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Important: Peer Support Only</p>
                  <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mt-1">
                    This forum is for sharing personal experiences and peer support. Content shared here does not constitute medical advice. 
                    Always consult your healthcare provider for medical decisions. Posts represent individual experiences and may not apply to your situation.
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-blue-700 dark:text-blue-300">
                    <span>Be respectful</span>
                    <span>Share what worked for you</span>
                    <span>Support fellow members</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {forumPosts.map((post) => (
              <Card key={post.id} className="hover-elevate" data-testid={`forum-post-${post.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {post.authorInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{post.authorName}</span>
                        <Badge variant="outline" className="text-xs">{post.category}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(post.timestamp)}</span>
                      </div>
                      <h4 className="font-medium text-lg mb-2">{post.title}</h4>
                      <p className="text-muted-foreground">{post.content}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={post.isLiked ? "text-red-500" : ""}
                          onClick={() => handleLikePost(post.id)}
                          data-testid={`button-like-${post.id}`}
                        >
                          <ThumbsUp className={`h-4 w-4 mr-1 ${post.isLiked ? "fill-current" : ""}`} />
                          {post.likes}
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-reply-${post.id}`}>
                          <Reply className="h-4 w-4 mr-1" />
                          {post.replies} Replies
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-share-${post.id}`}>
                          <Share2 className="h-4 w-4 mr-1" />
                          Share
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead} data-testid="button-mark-all-read">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Notifications</h3>
              <p className="text-muted-foreground">You are all caught up</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <Card 
                  key={notif.id} 
                  className={`hover-elevate cursor-pointer ${!notif.read ? "ring-2 ring-primary/20" : ""}`}
                  onClick={() => handleMarkRead(notif.id)}
                  data-testid={`card-notification-${notif.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${!notif.read ? "bg-primary/10" : "bg-muted"}`}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${!notif.read ? "" : "text-muted-foreground"}`}>
                            {notif.title}
                          </h3>
                          {!notif.read && <Badge variant="default" className="text-xs">New</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{notif.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(notif.timestamp)}
                          </span>
                          {notif.metadata?.source && (
                            <span>From: {notif.metadata.source}</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snapshots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Your Latest Snapshot
              </CardTitle>
              <CardDescription>
                Monthly summary of your health records - ready to share with your care team
              </CardDescription>
            </CardHeader>
            {snapshots[0] && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{snapshots[0].month} {snapshots[0].year}</h3>
                    <p className="text-sm text-muted-foreground">
                      Generated {formatDate(snapshots[0].generatedAt)}
                    </p>
                  </div>
                  <Button onClick={() => handleShareSnapshot(snapshots[0])} data-testid="button-share-latest">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share with Clinician
                  </Button>
                </div>
                
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <FileText className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{snapshots[0].metrics.newRecords}</div>
                    <div className="text-xs text-muted-foreground">New Records</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <Pill className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{snapshots[0].metrics.medications}</div>
                    <div className="text-xs text-muted-foreground">Medications</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <FlaskConical className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{snapshots[0].metrics.labResults}</div>
                    <div className="text-xs text-muted-foreground">Lab Results</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{snapshots[0].metrics.appointments}</div>
                    <div className="text-xs text-muted-foreground">Appointments</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" data-testid="button-view-snapshot">
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Snapshot
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-download-snapshot">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previous Snapshots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshots.slice(1).map((snapshot) => (
                <div 
                  key={snapshot.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                  data-testid={`card-snapshot-${snapshot.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{snapshot.month} {snapshot.year}</h4>
                      <p className="text-sm text-muted-foreground">
                        {snapshot.metrics.newRecords} records
                        {snapshot.shared && (
                          <span className="ml-2">
                            <Badge variant="outline" className="text-xs">
                              Shared with {snapshot.sharedWith?.join(", ")}
                            </Badge>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleShareSnapshot(snapshot)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Get notified on your device when important updates arrive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Record Received</Label>
                  <p className="text-sm text-muted-foreground">When new health records are synced</p>
                </div>
                <Switch
                  checked={preferences.pushNewRecords}
                  onCheckedChange={(c) => setPreferences({ ...preferences, pushNewRecords: c })}
                  data-testid="switch-push-records"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Monthly Snapshot Ready</Label>
                  <p className="text-sm text-muted-foreground">When your monthly health summary is generated</p>
                </div>
                <Switch
                  checked={preferences.pushSnapshots}
                  onCheckedChange={(c) => setPreferences({ ...preferences, pushSnapshots: c })}
                  data-testid="switch-push-snapshots"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Appointment Reminders</Label>
                  <p className="text-sm text-muted-foreground">Upcoming appointments and follow-ups</p>
                </div>
                <Switch
                  checked={preferences.pushReminders}
                  onCheckedChange={(c) => setPreferences({ ...preferences, pushReminders: c })}
                  data-testid="switch-push-reminders"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preferences
              </CardTitle>
              <CardDescription>
                Choose what emails you would like to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">Summary of your health activity</p>
                </div>
                <Switch
                  checked={preferences.emailDigest}
                  onCheckedChange={(c) => setPreferences({ ...preferences, emailDigest: c })}
                  data-testid="switch-email-digest"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Monthly Snapshot Email</Label>
                  <p className="text-sm text-muted-foreground">Receive your snapshot by email</p>
                </div>
                <Switch
                  checked={preferences.emailSnapshots}
                  onCheckedChange={(c) => setPreferences({ ...preferences, emailSnapshots: c })}
                  data-testid="switch-email-snapshots"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share with Clinician
            </DialogTitle>
            <DialogDescription>
              Send your {selectedSnapshot?.month} {selectedSnapshot?.year} health snapshot to your care team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="share-email">Clinician Email</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="doctor@clinic.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                data-testid="input-share-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-message">Message (optional)</Label>
              <Textarea
                id="share-message"
                placeholder="Add a note for your clinician..."
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                rows={3}
                data-testid="input-share-message"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Or copy a shareable link:</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`https://tabulamedica.health/snapshot/${selectedSnapshot?.id}`}
                  className="text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={handleSendShare} data-testid="button-send-share">
              <Send className="h-4 w-4 mr-2" />
              Send Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPostDialog} onOpenChange={setShowNewPostDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Create New Post
            </DialogTitle>
            <DialogDescription>
              Share your experience or ask for support from the community
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="post-category">Category</Label>
              <select
                id="post-category"
                className="w-full p-2 rounded-md border bg-background"
                value={newPostCategory}
                onChange={(e) => setNewPostCategory(e.target.value)}
                data-testid="select-post-category"
              >
                <option value="Wellness Tips">Wellness Tips</option>
                <option value="Managing Conditions">Managing Conditions</option>
                <option value="Nutrition">Nutrition</option>
                <option value="Exercise">Exercise</option>
                <option value="Mental Health">Mental Health</option>
                <option value="Caregiving">Caregiving</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                placeholder="What would you like to share?"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                data-testid="input-post-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-content">Your Message</Label>
              <Textarea
                id="post-content"
                placeholder="Share your experience, ask a question, or offer support..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={5}
                data-testid="input-post-content"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium mb-1">Community Guidelines Reminder:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Be respectful and supportive of others</li>
                <li>Do not share personal medical information</li>
                <li>This forum is for peer support, not medical advice</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPostDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePost} data-testid="button-submit-post">
              <Send className="h-4 w-4 mr-2" />
              Post to Community
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
