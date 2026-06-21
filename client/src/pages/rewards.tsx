import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Star,
  Flame,
  Target,
  Medal,
  Crown,
  Zap,
  TrendingUp,
  Calendar,
  Gift,
  Sparkles,
  Award,
  Users,
  ChevronRight,
  Check,
  X,
  Loader2,
  Heart,
  Leaf,
  TreeDeciduous,
  Gem,
  Sun,
  Scale,
  Dumbbell,
  Pill,
  BookOpen,
  Database,
  CheckCircle,
  RefreshCcw,
  ShoppingBag,
  Activity,
  Droplet,
  Moon,
  Brain,
  Stethoscope,
  Smartphone,
  FileText,
  HeartHandshake,
  CircleDollarSign,
  Clock,
} from "lucide-react";
import type { 
  Badge as BadgeType, 
  PlayerBadge, 
  PlayerStats, 
  StreakRecord, 
  MotivationalNudge,
  LeaderboardEntry,
  Leaderboard,
  PointTransaction,
} from "@shared/schema";
import { levelDefinitions } from "@shared/schema";

interface GamificationSummary {
  patientId: string;
  stats: PlayerStats & { levelName: string };
  recentBadges: PlayerBadge[];
  allBadges: BadgeType[];
  activeStreaks: StreakRecord[];
  nudges: MotivationalNudge[];
  weeklyProgress: {
    pointsEarned: number;
    goalsProgressed: number;
    badgesEarned: number;
    streakDays: number;
  };
  nextMilestone: {
    type: string;
    name: string;
    progress: number;
    target: number;
  };
}

const iconMap: Record<string, any> = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  fire: Flame,
  target: Target,
  medal: Medal,
  crown: Crown,
  gem: Gem,
  seedling: Leaf,
  leaf: Leaf,
  tree: TreeDeciduous,
  sun: Sun,
  scale: Scale,
  dumbbell: Dumbbell,
  pill: Pill,
  "book-open": BookOpen,
  database: Database,
  "check-circle": CheckCircle,
  "refresh-ccw": RefreshCcw,
  footprints: Target,
  heart: Heart,
  sparkles: Sparkles,
};

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-green-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const rarityBorders: Record<string, string> = {
  common: "border-slate-400",
  uncommon: "border-green-400",
  rare: "border-blue-400",
  epic: "border-purple-400",
  legendary: "border-amber-400",
};

function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = iconMap[icon] || Award;
  return <IconComponent className={className} />;
}

function LevelProgress({ stats }: { stats: PlayerStats & { levelName: string } }) {
  // Calculate progress using level thresholds
  const currentLevelDef = levelDefinitions.find(l => l.level === stats.currentLevel);
  const nextLevelDef = levelDefinitions.find(l => l.level === stats.currentLevel + 1);
  
  let progressPercent = 100;
  if (currentLevelDef && nextLevelDef) {
    const pointsInCurrentLevel = stats.totalPoints - currentLevelDef.pointsRequired;
    const pointsNeededForLevel = nextLevelDef.pointsRequired - currentLevelDef.pointsRequired;
    progressPercent = Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForLevel) * 100));
  }
  
  const levelIcons = [Leaf, Leaf, TreeDeciduous, Star, Crown, Trophy, Gem];
  const LevelIcon = levelIcons[Math.min(stats.currentLevel - 1, levelIcons.length - 1)] || Star;
  
  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary">
              <LevelIcon className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
              {stats.currentLevel}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{stats.levelName}</h3>
            <p className="text-sm text-muted-foreground">Level {stats.currentLevel}</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{stats.totalPoints} XP</span>
                <span>{stats.pointsToNextLevel} to next level</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsOverview({ stats, weeklyProgress }: { stats: PlayerStats & { levelName: string }; weeklyProgress: GamificationSummary["weeklyProgress"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
            <Star className="w-6 h-6 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{stats.totalPoints}</div>
          <div className="text-xs text-muted-foreground">Total Points</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div className="text-2xl font-bold">{stats.currentStreak}</div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
            <Medal className="w-6 h-6 text-purple-500" />
          </div>
          <div className="text-2xl font-bold">{stats.badgesEarned}</div>
          <div className="text-xs text-muted-foreground">Badges Earned</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-2">
            <Target className="w-6 h-6 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{stats.goalsCompleted}</div>
          <div className="text-xs text-muted-foreground">Goals Completed</div>
        </CardContent>
      </Card>
    </div>
  );
}

function WeeklyProgress({ weeklyProgress }: { weeklyProgress: GamificationSummary["weeklyProgress"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <div className="font-semibold">{weeklyProgress.pointsEarned}</div>
              <div className="text-xs text-muted-foreground">Points Earned</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Target className="w-5 h-5 text-green-500" />
            <div>
              <div className="font-semibold">{weeklyProgress.goalsProgressed}</div>
              <div className="text-xs text-muted-foreground">Goals Progressed</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Medal className="w-5 h-5 text-purple-500" />
            <div>
              <div className="font-semibold">{weeklyProgress.badgesEarned}</div>
              <div className="text-xs text-muted-foreground">Badges Earned</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-semibold">{weeklyProgress.streakDays}</div>
              <div className="text-xs text-muted-foreground">Streak Days</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeCard({ badge, isEarned, earnedAt }: { badge: BadgeType; isEarned: boolean; earnedAt?: string }) {
  return (
    <div 
      className={`p-4 rounded-lg border-2 transition-all ${
        isEarned 
          ? `${rarityBorders[badge.rarity]} bg-card` 
          : "border-muted bg-muted/30 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          isEarned ? rarityColors[badge.rarity] : "bg-muted"
        }`}>
          <BadgeIcon icon={badge.icon} className={`w-6 h-6 ${isEarned ? "text-white" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{badge.name}</span>
            {isEarned && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-xs capitalize ${isEarned ? "" : "opacity-50"}`}>
              {badge.rarity}
            </Badge>
            {earnedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(earnedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgesSection({ allBadges, earnedBadges }: { allBadges: BadgeType[]; earnedBadges: PlayerBadge[] }) {
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Badges ({earnedBadges.length}/{allBadges.length})
        </h3>
        <Badge variant="outline">
          {Math.round((earnedBadges.length / allBadges.length) * 100)}% Complete
        </Badge>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {allBadges.map(badge => {
          const earned = earnedBadges.find(b => b.badgeId === badge.id);
          return (
            <BadgeCard 
              key={badge.id} 
              badge={badge} 
              isEarned={earnedBadgeIds.has(badge.id)} 
              earnedAt={earned?.earnedAt}
            />
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardSection() {
  const [leaderboardType, setLeaderboardType] = useState<"weekly" | "monthly" | "all_time">("weekly");
  
  const { data: leaderboard, isLoading } = useQuery<Leaderboard>({
    queryKey: ["/api/gamification/leaderboard", leaderboardType],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/leaderboard?type=${leaderboardType}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Leaderboard
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant={leaderboardType === "weekly" ? "default" : "ghost"}
              onClick={() => setLeaderboardType("weekly")}
              className="min-h-[44px]"
              data-testid="button-leaderboard-weekly"
            >
              Week
            </Button>
            <Button 
              size="sm" 
              variant={leaderboardType === "monthly" ? "default" : "ghost"}
              onClick={() => setLeaderboardType("monthly")}
              className="min-h-[44px]"
              data-testid="button-leaderboard-monthly"
            >
              Month
            </Button>
            <Button 
              size="sm" 
              variant={leaderboardType === "all_time" ? "default" : "ghost"}
              onClick={() => setLeaderboardType("all_time")}
              className="min-h-[44px]"
              data-testid="button-leaderboard-alltime"
            >
              All Time
            </Button>
          </div>
        </div>
        <CardDescription>
          {leaderboard?.totalParticipants || 0} participants
          {leaderboard?.userRank && ` • You're ranked #${leaderboard.userRank}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {leaderboard?.entries.map((entry, index) => (
              <div 
                key={entry.anonymousId}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  entry.isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? "bg-amber-500 text-white" :
                  index === 1 ? "bg-gray-400 text-white" :
                  index === 2 ? "bg-amber-700 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {entry.isCurrentUser ? "You" : entry.displayName}
                    </span>
                    {entry.isCurrentUser && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Lv.{entry.level}</span>
                    <span>•</span>
                    <Flame className="w-3 h-3 text-orange-500" />
                    <span>{entry.currentStreak}</span>
                    <span>•</span>
                    <Medal className="w-3 h-3 text-purple-500" />
                    <span>{entry.badgeCount}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{entry.totalPoints}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function NudgeCard({ nudge, onDismiss }: { nudge: MotivationalNudge; onDismiss: () => void }) {
  const priorityColors = {
    low: "border-muted",
    medium: "border-blue-500/50",
    high: "border-amber-500/50",
    urgent: "border-red-500/50",
  };
  
  return (
    <Card className={`border-l-4 ${priorityColors[nudge.priority]}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold">{nudge.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{nudge.message}</p>
            {nudge.actionLabel && (
              <Button size="sm" className="mt-3 min-h-[44px]" data-testid={`button-nudge-action-${nudge.id}`}>
                {nudge.actionLabel}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onDismiss}
            data-testid={`button-nudge-dismiss-${nudge.id}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckInButton({ onCheckin, isLoading }: { onCheckin: () => void; isLoading: boolean }) {
  return (
    <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-lg">Daily Check-in</h3>
            <p className="text-sm text-muted-foreground">Check in to maintain your streak and earn points!</p>
          </div>
          <Button 
            size="lg" 
            onClick={onCheckin} 
            disabled={isLoading}
            className="gap-2"
            data-testid="button-daily-checkin"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Check In
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PERSONALIZED CHALLENGES SECTION
// ============================================

interface PersonalizedChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  pointsReward: number;
  badgeReward: string | null;
  goalValue: number;
  goalUnit: string;
  durationDays: number;
  iconName: string;
  colorTheme: string;
  conditionBased: boolean;
  targetCondition?: string;
  personalizedReason: string;
}

const challengeIconMap: Record<string, any> = {
  activity: Activity,
  pill: Pill,
  heart: Heart,
  "heart-pulse": Heart,
  droplet: Droplet,
  moon: Moon,
  brain: Brain,
  stethoscope: Stethoscope,
  "book-open": BookOpen,
  utensils: Target,
  leaf: Leaf,
  "clipboard-check": CheckCircle,
  apple: Leaf,
  wind: Activity,
  footprints: Target,
  dumbbell: Dumbbell,
};

const categoryColors: Record<string, string> = {
  medication_adherence: "bg-blue-500",
  nutrition: "bg-green-500",
  exercise: "bg-orange-500",
  sleep: "bg-indigo-500",
  hydration: "bg-cyan-500",
  mental_wellness: "bg-pink-500",
  preventive_care: "bg-purple-500",
};

const difficultyBadges: Record<string, { color: string; label: string }> = {
  easy: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", label: "Easy" },
  medium: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", label: "Medium" },
  hard: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Hard" },
};

function PersonalizedChallengesSection({ userPoints }: { userPoints: number }) {
  const { data, isLoading } = useQuery<{ data: PersonalizedChallenge[]; meta: { totalChallenges: number } }>({
    queryKey: ["/api/gamification/personalized-challenges"],
  });

  const joinChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const res = await apiRequest("POST", `/api/gamification/challenges/${challengeId}/join`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const challenges = data?.data || [];
  const conditionBased = challenges.filter(c => c.conditionBased);
  const general = challenges.filter(c => !c.conditionBased);

  return (
    <div className="space-y-6">
      {conditionBased.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Personalized For You
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {conditionBased.map(challenge => {
              const Icon = challengeIconMap[challenge.iconName] || Target;
              const diff = difficultyBadges[challenge.difficulty] || difficultyBadges.easy;
              const catColor = categoryColors[challenge.category] || "bg-gray-500";

              return (
                <Card key={challenge.id} className="overflow-hidden">
                  <div className={`h-2 ${catColor}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${catColor}/20`}>
                        <Icon className="w-6 h-6" style={{ color: catColor.replace("bg-", "").includes("-") ? undefined : undefined }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{challenge.title}</h4>
                          <Badge variant="secondary" className={diff.color}>{diff.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
                        <p className="text-xs text-primary mt-1">{challenge.personalizedReason}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4 text-amber-500" />
                            <span className="font-medium">{challenge.pointsReward} pts</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{challenge.durationDays} days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4 min-h-[44px]" 
                      onClick={() => joinChallengeMutation.mutate(challenge.id)}
                      disabled={joinChallengeMutation.isPending}
                      data-testid={`button-join-challenge-${challenge.id}`}
                    >
                      {joinChallengeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Target className="w-4 h-4 mr-2" />
                      )}
                      Start Challenge
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          General Wellness Challenges
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {general.map(challenge => {
            const Icon = challengeIconMap[challenge.iconName] || Target;
            const diff = difficultyBadges[challenge.difficulty] || difficultyBadges.easy;
            const catColor = categoryColors[challenge.category] || "bg-gray-500";

            return (
              <Card key={challenge.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-muted`}>
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{challenge.title}</h4>
                        <Badge variant="secondary" className={diff.color}>{diff.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span>{challenge.pointsReward} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full mt-3 min-h-[44px]" 
                    onClick={() => joinChallengeMutation.mutate(challenge.id)}
                    disabled={joinChallengeMutation.isPending}
                    data-testid={`button-join-general-challenge-${challenge.id}`}
                  >
                    Start Challenge
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// REWARDS SHOP SECTION
// ============================================

interface Reward {
  id: string;
  name: string;
  description: string;
  category: "digital" | "health" | "wellness" | "partner" | "donation";
  pointsCost: number;
  imageUrl: string | null;
  iconName: string;
  isAvailable: boolean;
  stockQuantity: number | null;
  partnerName?: string;
  termsAndConditions?: string;
}

const rewardIconMap: Record<string, any> = {
  smartphone: Smartphone,
  gift: Gift,
  brain: Brain,
  dumbbell: Dumbbell,
  book: BookOpen,
  "heart-handshake": HeartHandshake,
  "file-text": FileText,
  bottle: Droplet,
};

const categoryLabels: Record<string, string> = {
  digital: "Digital",
  health: "Health",
  wellness: "Wellness",
  partner: "Partner",
  donation: "Donation",
};

function RewardsShopSection({ userPoints }: { userPoints: number }) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Reward[]; meta: { totalRewards: number; categories: string[] } }>({
    queryKey: ["/api/gamification/rewards"],
  });

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const res = await apiRequest("POST", `/api/gamification/rewards/${rewardId}/redeem`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to redeem reward");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reward Redeemed!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/points"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const rewards = data?.data || [];
  const categories = data?.meta?.categories || [];
  const filteredRewards = selectedCategory 
    ? rewards.filter(r => r.category === selectedCategory)
    : rewards;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <CircleDollarSign className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Points Balance</p>
                <p className="text-2xl font-bold">{userPoints.toLocaleString()} pts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button 
          size="sm" 
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => setSelectedCategory(null)}
          className="min-h-[44px]"
          data-testid="button-filter-all"
        >
          All
        </Button>
        {categories.map(cat => (
          <Button 
            key={cat}
            size="sm" 
            variant={selectedCategory === cat ? "default" : "outline"}
            onClick={() => setSelectedCategory(cat)}
            className="min-h-[44px] capitalize"
            data-testid={`button-filter-${cat}`}
          >
            {categoryLabels[cat] || cat}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredRewards.map(reward => {
          const Icon = rewardIconMap[reward.iconName] || Gift;
          const canAfford = userPoints >= reward.pointsCost;
          const inStock = reward.stockQuantity === null || reward.stockQuantity > 0;

          return (
            <Card key={reward.id} className={!canAfford || !inStock ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{reward.name}</h4>
                      <Badge variant="secondary" className="capitalize">
                        {categoryLabels[reward.category] || reward.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{reward.description}</p>
                    {reward.partnerName && (
                      <p className="text-xs text-primary mt-1">Partner: {reward.partnerName}</p>
                    )}
                    {reward.stockQuantity !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {reward.stockQuantity} left in stock
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    <span className="font-bold text-lg">{reward.pointsCost.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>
                  <Button 
                    onClick={() => redeemMutation.mutate(reward.id)}
                    disabled={!canAfford || !inStock || redeemMutation.isPending}
                    className="min-h-[44px]"
                    data-testid={`button-redeem-${reward.id}`}
                  >
                    {redeemMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 mr-2" />
                    )}
                    {!inStock ? "Out of Stock" : !canAfford ? "Not Enough Points" : "Redeem"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRewards.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rewards available in this category</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: summary, isLoading, refetch } = useQuery<GamificationSummary>({
    queryKey: ["/api/gamification/summary"],
  });
  
  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gamification/checkin");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/leaderboard"] });
    },
  });
  
  const dismissNudgeMutation = useMutation({
    mutationFn: async (nudgeId: string) => {
      await apiRequest("POST", `/api/gamification/nudges/${nudgeId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading rewards...</p>
        </div>
      </div>
    );
  }
  
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Get Started with Rewards</h3>
            <p className="text-muted-foreground mb-4">
              Set up your health goals to start earning points, badges, and track your progress!
            </p>
            <Button data-testid="button-start-goals">Set Up Goals</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Rewards & Achievements
          </h1>
          <p className="text-muted-foreground">Track your progress and earn rewards</p>
        </div>
      </div>
      
      {(summary.nudges?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {summary.nudges?.map(nudge => (
            <NudgeCard 
              key={nudge.id} 
              nudge={nudge} 
              onDismiss={() => dismissNudgeMutation.mutate(nudge.id)}
            />
          ))}
        </div>
      )}
      
      <CheckInButton 
        onCheckin={() => checkinMutation.mutate()} 
        isLoading={checkinMutation.isPending}
      />
      
      {summary.stats && <LevelProgress stats={summary.stats} />}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview" className="min-h-[44px]">Overview</TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges" className="min-h-[44px]">Challenges</TabsTrigger>
          <TabsTrigger value="shop" data-testid="tab-shop" className="min-h-[44px]">Shop</TabsTrigger>
          <TabsTrigger value="badges" data-testid="tab-badges" className="min-h-[44px]">Badges</TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="tab-leaderboard" className="min-h-[44px]">Leaderboard</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 mt-6">
          {summary.stats && summary.weeklyProgress && (
            <>
              <StatsOverview stats={summary.stats} weeklyProgress={summary.weeklyProgress} />
              <WeeklyProgress weeklyProgress={summary.weeklyProgress} />
            </>
          )}
          
          {(summary.recentBadges?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="w-5 h-5 text-purple-500" />
                  Recent Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {summary.recentBadges?.slice(0, 4).map(playerBadge => (
                    <BadgeCard 
                      key={playerBadge.id}
                      badge={playerBadge.badge}
                      isEarned={true}
                      earnedAt={playerBadge.earnedAt}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {(summary.activeStreaks?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Active Streaks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.activeStreaks?.map(streak => (
                    <div key={streak.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <Flame className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <div className="font-medium capitalize">
                            {streak.streakType.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Best: {streak.longestCount} days
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-500">{streak.currentCount}</div>
                        <div className="text-xs text-muted-foreground">days</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="challenges" className="mt-6">
          <PersonalizedChallengesSection userPoints={summary.stats?.totalPoints ?? 0} />
        </TabsContent>

        <TabsContent value="shop" className="mt-6">
          <RewardsShopSection userPoints={summary.stats?.totalPoints ?? 0} />
        </TabsContent>

        <TabsContent value="badges" className="mt-6">
          <BadgesSection 
            allBadges={summary.allBadges ?? []}
            earnedBadges={summary.recentBadges ?? []}
          />
        </TabsContent>
        
        <TabsContent value="leaderboard" className="mt-6">
          <LeaderboardSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
