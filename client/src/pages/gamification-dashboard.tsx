import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy,
  Medal,
  Star,
  Flame,
  Target,
  BookOpen,
  Calendar,
  Heart,
  TrendingUp,
  Award,
  Crown,
  Zap,
  Gift,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
  PartyPopper,
  Lock,
  CheckCircle2,
  Loader2,
  Shield,
  Gem,
  Sunrise,
  Moon,
  TreeDeciduous,
  GraduationCap,
  ClipboardCheck,
  RefreshCw,
  Pill,
  FileText,
  ArrowRight,
} from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  pointsAwarded: number;
  requirement: {
    type: string;
    target: number;
    current?: number;
  };
  unlockedAt?: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "locked" | "in_progress" | "completed";
  progress: number;
  target: number;
  pointsAwarded: number;
}

interface UserProgress {
  totalPoints: number;
  level: number;
  levelProgress: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  badges: BadgeData[];
  achievements: Achievement[];
  stats: {
    healthGoalsCompleted: number;
    educationModulesCompleted: number;
    daysLogged: number;
    healthyHabitsDays: number;
    totalActivities: number;
  };
}

interface LeaderboardEntry {
  odingId: string;
  displayName: string;
  avatarInitials: string;
  totalPoints: number;
  level: number;
  badgeCount: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface PointTransaction {
  id: string;
  points: number;
  reason: string;
  category: string;
  timestamp: string;
}

const ICON_MAP: Record<string, any> = {
  "footprints": Target,
  "target": Target,
  "trophy": Trophy,
  "crown": Crown,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "award": Award,
  "clipboard-check": ClipboardCheck,
  "calendar-check": Calendar,
  "flame": Flame,
  "star": Star,
  "leaf": Heart,
  "sprout": Heart,
  "tree-deciduous": TreeDeciduous,
  "sunrise": Sunrise,
  "moon": Moon,
  "share-2": Users,
  "trending-up": TrendingUp,
  "shield": Shield,
  "gem": Gem,
  "check-circle": CheckCircle2,
  "refresh-cw": RefreshCw,
  "zap": Zap,
  "pill": Pill,
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  uncommon: "bg-green-500/10 text-green-600 dark:text-green-400",
  rare: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  epic: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  legendary: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-gray-300 dark:border-gray-600",
  uncommon: "border-green-400",
  rare: "border-blue-400",
  epic: "border-purple-400",
  legendary: "border-amber-400 shadow-lg shadow-amber-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  health_goals: "bg-rose-500/10 text-rose-600",
  education: "bg-blue-500/10 text-blue-600",
  logging: "bg-green-500/10 text-green-600",
  habits: "bg-purple-500/10 text-purple-600",
  engagement: "bg-orange-500/10 text-orange-600",
  milestones: "bg-amber-500/10 text-amber-600",
  special: "bg-pink-500/10 text-pink-600",
};

export default function GamificationDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/gamification/summary"],
  });

  const { data: achievementsResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/gamification/achievements"],
  });
  const achievements = achievementsResponse?.data;

  const { data: userAchievementsResponse } = useQuery<any>({
    queryKey: ["/api/gamification/achievements/user"],
  });
  const userAchievements = Array.isArray(userAchievementsResponse?.data) ? userAchievementsResponse.data : Array.isArray(userAchievementsResponse) ? userAchievementsResponse : [];

  const { data: streaks } = useQuery<any[]>({
    queryKey: ["/api/gamification/streaks"],
  });

  const { data: points } = useQuery<any>({
    queryKey: ["/api/gamification/points"],
  });

  const { data: leaderboard } = useQuery<any>({
    queryKey: ["/api/gamification/leaderboard"],
    enabled: showLeaderboard,
  });

  const { data: pointHistory } = useQuery<any[]>({
    queryKey: ["/api/gamification/points/transactions"],
  });

  const { data: adherenceStats } = useQuery<any>({
    queryKey: ["/api/gamification/adherence-stats"],
  });

  const recordAdherenceMutation = useMutation({
    mutationFn: async (params: { medicationName: string; action: string }) => {
      const response = await apiRequest("POST", "/api/gamification/record-adherence", params);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/adherence-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/points/transactions"] });
      toast({ title: data.message, description: `Streak: ${data.currentStreak} days | Level ${data.level} ${data.levelName}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record medication adherence.", variant: "destructive" });
    },
  });

  const progress: UserProgress | null = summary ? {
    totalPoints: summary.points || 0,
    level: summary.level || 1,
    levelProgress: Math.min(((summary.points || 0) % 500) / 5, 100),
    pointsToNextLevel: 500 - ((summary.points || 0) % 500),
    currentStreak: summary.currentStreak || 0,
    longestStreak: summary.currentStreak || 0,
    badges: userAchievements?.map((ua: any) => ({
      id: ua.achievementId,
      name: ua.achievement?.name || "Badge",
      description: ua.achievement?.description || "",
      icon: ua.achievement?.iconName || "star",
      category: ua.achievement?.category || "engagement",
      rarity: ua.achievement?.rarity || "common",
      pointsAwarded: ua.achievement?.pointsValue || 10,
      requirement: { type: "count", target: 1 },
      unlockedAt: ua.unlockedAt,
    })) || [],
    achievements: achievements?.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      status: userAchievements?.find((ua: any) => ua.achievementId === a.id) ? "completed" : "in_progress",
      progress: userAchievements?.find((ua: any) => ua.achievementId === a.id) ? a.requirementValue : Math.floor(Math.random() * a.requirementValue),
      target: a.requirementValue,
      pointsAwarded: a.pointsValue,
    })) || [],
    stats: {
      healthGoalsCompleted: summary.completedChallenges || 0,
      educationModulesCompleted: 0,
      daysLogged: summary.currentStreak || 0,
      healthyHabitsDays: 0,
      totalActivities: summary.activeChallenges + summary.completedChallenges || 0,
    },
  } : null;

  const badgeData = {
    badges: achievements?.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.iconName || "star",
      category: a.category,
      rarity: a.rarity || "common",
      pointsAwarded: a.pointsValue || 10,
      requirement: { type: "count", target: a.requirementValue || 1, current: 0 },
    })) || [],
    earned: userAchievements?.map((ua: any) => ua.achievementId) || [],
  };

  const recordActivityMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest("POST", `/api/gamification/record/${type}`, { goalId: `goal-${Date.now()}`, moduleId: `mod-${Date.now()}`, habitType: "exercise" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/history"] });
      toast({
        title: `+${data.pointsEarned} Points!`,
        description: data.feedback?.message || "Great job!",
      });
      if (data.badgesEarned?.length > 0) {
        toast({
          title: "Badge Unlocked!",
          description: data.badgesEarned[0].name,
        });
      }
    },
  });

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || Star;
    return Icon;
  };

  const getLevelName = (level: number): string => {
    const names = ["Beginner", "Enthusiast", "Achiever", "Champion", "Master", "Expert", "Hero", "Legend", "Titan", "Ultimate"];
    return names[Math.min(level - 1, names.length - 1)] || "Champion";
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <Trophy className="h-8 w-8 text-amber-500" />
          Achievements & Rewards
        </h1>
        <p className="text-muted-foreground mt-1">Track your progress, earn badges, and celebrate your health journey</p>
      </div>

      {progress && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="relative overflow-hidden" data-testid="card-level">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
                  <span className="text-2xl font-bold">{progress.level}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="text-lg font-bold">{getLevelName(progress.level)}</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{progress.totalPoints} XP</span>
                      <span>{progress.pointsToNextLevel} to next</span>
                    </div>
                    <Progress value={progress.levelProgress} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-points">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-3xl font-bold">{progress.totalPoints.toLocaleString()}</p>
                  <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    +{pointHistory?.[0]?.amount || pointHistory?.[0]?.points || 0} latest
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-streak">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Streak</p>
                  <p className="text-3xl font-bold">{progress.currentStreak} days</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Best: {progress.longestStreak} days
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Flame className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-badges">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Badges Earned</p>
                  <p className="text-3xl font-bold">{progress.badges.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    of {badgeData?.badges.length || 0} available
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Medal className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {progress?.currentStreak && progress.currentStreak >= 7 && (
        <Alert className="mb-6 border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
          <Flame className="h-5 w-5 text-orange-500" />
          <AlertTitle className="flex items-center gap-2">
            <span className="text-orange-600">{progress.currentStreak} Day Streak!</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </AlertTitle>
          <AlertDescription>
            You're on fire! Keep logging daily to maintain your streak and earn bonus points.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" data-testid="button-tab-overview">
            <Trophy className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="badges" data-testid="button-tab-badges">
            <Medal className="h-4 w-4 mr-2" />
            Badges
          </TabsTrigger>
          <TabsTrigger value="achievements" data-testid="button-tab-achievements">
            <Target className="h-4 w-4 mr-2" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="medication" data-testid="button-tab-medication">
            <Pill className="h-4 w-4 mr-2" />
            Medication
          </TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="button-tab-leaderboard">
            <Users className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card data-testid="card-quick-actions">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Earn points by completing health activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-4 hover-elevate"
                      onClick={() => recordActivityMutation.mutate("health-goal")}
                      disabled={recordActivityMutation.isPending}
                      data-testid="button-log-goal"
                    >
                      <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-rose-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Complete Health Goal</p>
                        <p className="text-xs text-muted-foreground">+20 points</p>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-4 hover-elevate"
                      onClick={() => recordActivityMutation.mutate("education")}
                      disabled={recordActivityMutation.isPending}
                      data-testid="button-log-education"
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Complete Education Module</p>
                        <p className="text-xs text-muted-foreground">+15 points</p>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-4 hover-elevate"
                      onClick={() => recordActivityMutation.mutate("daily-log")}
                      disabled={recordActivityMutation.isPending}
                      data-testid="button-log-daily"
                    >
                      <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Log Daily Health Data</p>
                        <p className="text-xs text-muted-foreground">+5 points + streak bonus</p>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-4 hover-elevate"
                      onClick={() => recordActivityMutation.mutate("healthy-habit")}
                      disabled={recordActivityMutation.isPending}
                      data-testid="button-log-habit"
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Heart className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Maintain Healthy Habit</p>
                        <p className="text-xs text-muted-foreground">+10 points</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-recent-badges">
                <CardHeader>
                  <CardTitle>Recent Badges</CardTitle>
                  <CardDescription>Your latest achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  {progress?.badges && progress.badges.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {progress.badges.slice(0, 6).map((badge) => {
                        const Icon = getIcon(badge.icon);
                        return (
                          <div 
                            key={badge.id} 
                            className={`p-4 rounded-lg border-2 ${RARITY_BORDER[badge.rarity]} ${RARITY_COLORS[badge.rarity]}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-current/10 flex items-center justify-center">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{badge.name}</p>
                                <p className="text-xs opacity-75">{badge.pointsAwarded} pts</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Medal className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No badges earned yet</p>
                      <p className="text-sm">Complete activities to earn your first badge!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-stats">
                <CardHeader>
                  <CardTitle>Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-4 rounded-lg bg-rose-500/5">
                      <Target className="h-6 w-6 mx-auto text-rose-500 mb-2" />
                      <p className="text-2xl font-bold">{progress?.stats.healthGoalsCompleted || 0}</p>
                      <p className="text-sm text-muted-foreground">Goals Completed</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-500/5">
                      <BookOpen className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">{progress?.stats.educationModulesCompleted || 0}</p>
                      <p className="text-sm text-muted-foreground">Modules Completed</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-500/5">
                      <Calendar className="h-6 w-6 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold">{progress?.stats.daysLogged || 0}</p>
                      <p className="text-sm text-muted-foreground">Days Logged</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-500/5">
                      <Heart className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                      <p className="text-2xl font-bold">{progress?.stats.healthyHabitsDays || 0}</p>
                      <p className="text-sm text-muted-foreground">Healthy Habit Days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card data-testid="card-current-achievements">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Active Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress?.achievements && progress.achievements.filter(a => a.status === "in_progress").length > 0 ? (
                    <div className="space-y-4">
                      {progress.achievements.filter(a => a.status === "in_progress").map((ach) => (
                        <div key={ach.id} className="space-y-2">
                          <div className="flex justify-between">
                            <p className="text-sm font-medium">{ach.name}</p>
                            <Badge variant="secondary" className="text-xs">{ach.pointsAwarded} pts</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{ach.description}</p>
                          <div className="flex items-center gap-2">
                            <Progress value={(ach.progress / ach.target) * 100} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{ach.progress}/{ach.target}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">All caught up!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-point-history">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pointHistory && pointHistory.length > 0 ? (
                    <div className="space-y-3">
                      {pointHistory.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{tx.description || tx.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt || tx.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-green-600">+{tx.amount || tx.points}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="badges">
          <Card data-testid="card-all-badges">
            <CardHeader>
              <CardTitle>All Badges</CardTitle>
              <CardDescription>Collect them all by completing various health activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {badgeData?.badges.map((badge) => {
                  const Icon = getIcon(badge.icon);
                  const isEarned = badgeData.earned.includes(badge.id);
                  const progressPercent = badge.requirement.current !== undefined 
                    ? Math.min((badge.requirement.current / badge.requirement.target) * 100, 100)
                    : 0;

                  return (
                    <div 
                      key={badge.id}
                      className={`relative p-4 rounded-lg border-2 transition-all ${
                        isEarned 
                          ? `${RARITY_BORDER[badge.rarity]} ${RARITY_COLORS[badge.rarity]}`
                          : "border-dashed border-muted-foreground/30 opacity-60"
                      }`}
                    >
                      {!isEarned && (
                        <Lock className="absolute top-2 right-2 h-4 w-4 text-muted-foreground" />
                      )}
                      {isEarned && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-green-500" />
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                          isEarned ? "bg-current/10" : "bg-muted"
                        }`}>
                          <Icon className={`h-6 w-6 ${isEarned ? "" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{badge.name}</p>
                          <p className="text-xs opacity-75 line-clamp-2">{badge.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs capitalize">{badge.rarity}</Badge>
                            <span className="text-xs text-muted-foreground">{badge.pointsAwarded} pts</span>
                          </div>
                          {!isEarned && badge.requirement.current !== undefined && (
                            <div className="mt-2">
                              <Progress value={progressPercent} className="h-1.5" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {badge.requirement.current} / {badge.requirement.target}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <Card data-testid="card-achievements">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Complete challenges to earn bonus points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {progress?.achievements.map((ach) => (
                  <div 
                    key={ach.id}
                    className={`p-4 rounded-lg border ${
                      ach.status === "completed" 
                        ? "bg-green-500/5 border-green-500/30"
                        : ach.status === "in_progress"
                        ? "bg-blue-500/5 border-blue-500/30"
                        : "bg-muted/30 border-dashed"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {ach.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : ach.status === "in_progress" ? (
                          <Target className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{ach.name}</p>
                          <p className="text-sm text-muted-foreground">{ach.description}</p>
                        </div>
                      </div>
                      <Badge className={CATEGORY_COLORS[ach.category] || ""}>{ach.pointsAwarded} pts</Badge>
                    </div>
                    {ach.status !== "locked" && (
                      <div className="flex items-center gap-3 mt-3">
                        <Progress value={(ach.progress / ach.target) * 100} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                          {ach.progress} / {ach.target}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medication">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card data-testid="card-med-adherence">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-green-500" />
                    Medication Adherence
                  </CardTitle>
                  <CardDescription>Track your medication consistency and earn rewards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 mb-6">
                    <div className="p-4 rounded-lg bg-green-500/5 text-center">
                      <Flame className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                      <p className="text-3xl font-bold">{adherenceStats?.medicationStreak?.current || 0}</p>
                      <p className="text-sm text-muted-foreground">Current Streak (days)</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500/5 text-center">
                      <Trophy className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                      <p className="text-3xl font-bold">{adherenceStats?.medicationStreak?.longest || 0}</p>
                      <p className="text-sm text-muted-foreground">Longest Streak (days)</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Log Medication Today</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {["Lisinopril", "Metformin", "Albuterol"].map((med) => (
                        <Button
                          key={med}
                          variant="outline"
                          className="h-auto py-3 flex-col gap-1"
                          onClick={() => recordAdherenceMutation.mutate({ medicationName: med, action: "taken" })}
                          disabled={recordAdherenceMutation.isPending}
                          data-testid={`button-med-${med.toLowerCase()}`}
                        >
                          <Pill className="h-4 w-4 text-green-500" />
                          <span className="text-xs">{med}</span>
                          <span className="text-xs text-muted-foreground">+10 pts</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-med-badges">
                <CardHeader>
                  <CardTitle>Adherence Badges</CardTitle>
                  <CardDescription>Earn badges by maintaining consistent medication routines</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {adherenceStats?.adherenceBadges?.map((badge: any) => {
                      const Icon = getIcon(badge.icon);
                      return (
                        <div
                          key={badge.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            badge.earned
                              ? `${RARITY_BORDER[badge.rarity]} ${RARITY_COLORS[badge.rarity]}`
                              : "border-dashed border-muted-foreground/30 opacity-60"
                          }`}
                        >
                          {badge.earned ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 float-right" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground float-right" />
                          )}
                          <div className="flex items-start gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${badge.earned ? "bg-current/10" : "bg-muted"}`}>
                              <Icon className={`h-5 w-5 ${badge.earned ? "" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{badge.name}</p>
                              <p className="text-xs opacity-75">{badge.description}</p>
                              <Badge variant="outline" className="text-xs capitalize mt-1">{badge.rarity}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card data-testid="card-goal-badges">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-rose-500" />
                    Goal Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adherenceStats?.goalBadges?.map((badge: any) => {
                      const Icon = getIcon(badge.icon);
                      return (
                        <div key={badge.id} className={`flex items-center gap-3 p-3 rounded-lg ${badge.earned ? RARITY_COLORS[badge.rarity] : "bg-muted/30 opacity-60"}`}>
                          <Icon className={`h-5 w-5 ${badge.earned ? "" : "text-muted-foreground"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{badge.name}</p>
                            <p className="text-xs opacity-75">{badge.description}</p>
                          </div>
                          {badge.earned ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm font-medium">{adherenceStats?.completedGoals || 0} / {adherenceStats?.totalGoals || 0}</p>
                    <p className="text-xs text-muted-foreground">Health Goals Completed</p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-cross-links">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Keep Earning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/health-journal">
                    <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-journal-from-gamification">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-violet-500" />
                        <div>
                          <p className="text-sm font-medium">Health Journal</p>
                          <p className="text-xs text-muted-foreground">Log entries to earn points</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  <Link href="/education-library">
                    <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-education-from-gamification">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                        <div>
                          <p className="text-sm font-medium">Education Library</p>
                          <p className="text-xs text-muted-foreground">Learn and earn education points</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card data-testid="card-leaderboard">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Community Leaderboard</CardTitle>
                  <CardDescription>See how you compare (anonymized for privacy)</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-leaderboard" className="text-sm">Show Rankings</Label>
                  <Switch 
                    id="show-leaderboard"
                    checked={showLeaderboard}
                    onCheckedChange={setShowLeaderboard}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showLeaderboard && leaderboard?.entries ? (
                <div className="space-y-3">
                  {leaderboard.entries.map((entry: any, idx: number) => (
                    <div 
                      key={entry.anonymousId || idx}
                      className={`flex items-center gap-4 p-4 rounded-lg ${
                        entry.isCurrentUser 
                          ? "bg-primary/5 border-2 border-primary/20"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? "bg-amber-500 text-white" :
                        entry.rank === 2 ? "bg-gray-400 text-white" :
                        entry.rank === 3 ? "bg-amber-700 text-white" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {entry.rank <= 3 ? (
                          entry.rank === 1 ? <Crown className="h-5 w-5" /> :
                          entry.rank === 2 ? <Medal className="h-5 w-5" /> :
                          <Award className="h-5 w-5" />
                        ) : entry.rank}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{entry.avatarEmoji || entry.displayName?.substring(0, 2) || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {entry.displayName}
                          {entry.isCurrentUser && <span className="text-primary ml-2">(You)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Level {entry.level} - {entry.badgeCount || 0} badges
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{(entry.totalPoints || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Leaderboard Hidden</p>
                  <p className="text-sm">Enable the toggle above to see community rankings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
