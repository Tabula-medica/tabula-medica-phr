import { 
  Badge, 
  PlayerBadge, 
  PlayerStats, 
  StreakRecord, 
  PlayerAchievement,
  MotivationalNudge,
  GamificationSummary,
  HealthGoal,
  levelDefinitions,
  PointCategory,
  NudgeType,
  AchievementType,
  BadgeRarity,
} from "@shared/schema";
import { randomUUID } from "crypto";

// Local interface definitions to avoid schema conflicts
interface LocalLeaderboardEntry {
  rank: number;
  anonymousId: string;
  displayName: string;
  avatarEmoji: string;
  totalPoints: number;
  level: number;
  levelName: string;
  badgeCount: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

interface LocalLeaderboard {
  id: string;
  type: "weekly" | "monthly" | "all_time";
  entries: LocalLeaderboardEntry[];
  totalParticipants: number;
  userRank?: number;
  lastUpdated: string;
}

interface LocalPointTransaction {
  id: string;
  patientId: string;
  amount: number;
  category: PointCategory;
  description: string;
  relatedGoalId?: string;
  createdAt: string;
}

const POINT_VALUES: Record<PointCategory, number> = {
  goal_progress: 5,
  goal_completion: 50,
  streak_bonus: 10,
  daily_checkin: 5,
  milestone_reached: 25,
  badge_earned: 15,
  health_improvement: 20,
  engagement: 3,
};

const STREAK_MULTIPLIERS: Record<number, number> = {
  7: 1.5,
  14: 2.0,
  30: 2.5,
  60: 3.0,
  90: 3.5,
  180: 4.0,
  365: 5.0,
};

const AVAILABLE_BADGES: Badge[] = [
  {
    id: "badge-first-goal",
    name: "First Steps",
    description: "Created your first health goal",
    icon: "footprints",
    category: "milestone",
    rarity: "common",
    criteria: "Create your first health goal",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-goal-crusher",
    name: "Goal Crusher",
    description: "Completed 5 health goals",
    icon: "target",
    category: "achievement",
    rarity: "uncommon",
    pointsRequired: 250,
    criteria: "Complete 5 health goals",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-streak-7",
    name: "Week Warrior",
    description: "Maintained a 7-day streak",
    icon: "flame",
    category: "streak",
    rarity: "common",
    criteria: "Achieve a 7-day streak",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-streak-30",
    name: "Monthly Master",
    description: "Maintained a 30-day streak",
    icon: "fire",
    category: "streak",
    rarity: "rare",
    pointsRequired: 300,
    criteria: "Achieve a 30-day streak",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-streak-100",
    name: "Century Champion",
    description: "Maintained a 100-day streak",
    icon: "trophy",
    category: "streak",
    rarity: "epic",
    pointsRequired: 1000,
    criteria: "Achieve a 100-day streak",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-early-riser",
    name: "Early Bird",
    description: "Logged activity before 7 AM five times",
    icon: "sun",
    category: "achievement",
    rarity: "uncommon",
    criteria: "Check in before 7 AM five times",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-weight-warrior",
    name: "Weight Warrior",
    description: "Achieved a weight-related goal",
    icon: "scale",
    category: "milestone",
    rarity: "uncommon",
    criteria: "Complete a weight goal",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-exercise-champion",
    name: "Exercise Champion",
    description: "Completed 10 exercise goals",
    icon: "dumbbell",
    category: "achievement",
    rarity: "rare",
    pointsRequired: 500,
    criteria: "Complete 10 exercise goals",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-medication-master",
    name: "Medication Master",
    description: "Perfect medication adherence for 30 days",
    icon: "pill",
    category: "achievement",
    rarity: "rare",
    criteria: "100% medication adherence for 30 days",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-health-scholar",
    name: "Health Scholar",
    description: "Read 10 health education articles",
    icon: "book-open",
    category: "achievement",
    rarity: "uncommon",
    criteria: "Read 10 health articles",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-data-driven",
    name: "Data Driven",
    description: "Connected 3+ health data sources",
    icon: "database",
    category: "special",
    rarity: "uncommon",
    criteria: "Connect 3 or more EHR systems",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-perfectionist",
    name: "Perfectionist",
    description: "Achieved 100% on a goal",
    icon: "check-circle",
    category: "achievement",
    rarity: "common",
    criteria: "Reach 100% progress on any goal",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-comeback-king",
    name: "Comeback Champion",
    description: "Returned after 7+ days away and completed a goal",
    icon: "refresh-ccw",
    category: "special",
    rarity: "rare",
    criteria: "Return after absence and complete a goal",
    isSecret: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "badge-level-5",
    name: "Wellness Master",
    description: "Reached Level 5",
    icon: "crown",
    category: "milestone",
    rarity: "epic",
    pointsRequired: 1000,
    criteria: "Reach Level 5",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
];

export function getBadgeById(badgeId: string): Badge | undefined {
  return AVAILABLE_BADGES.find(b => b.id === badgeId);
}

export function getAllBadges(): Badge[] {
  return AVAILABLE_BADGES.filter(b => !b.isSecret);
}

export function calculateLevel(totalPoints: number): { level: number; levelName: string; pointsToNext: number } {
  let currentLevel = levelDefinitions[0];
  let nextLevel = levelDefinitions[1];
  
  for (let i = 0; i < levelDefinitions.length; i++) {
    if (totalPoints >= levelDefinitions[i].pointsRequired) {
      currentLevel = levelDefinitions[i];
      nextLevel = levelDefinitions[i + 1] || levelDefinitions[i];
    } else {
      break;
    }
  }
  
  const pointsToNext = nextLevel.pointsRequired - totalPoints;
  
  return {
    level: currentLevel.level,
    levelName: currentLevel.name,
    pointsToNext: Math.max(0, pointsToNext),
  };
}

export function getStreakMultiplier(streakDays: number): number {
  let multiplier = 1.0;
  for (const [days, mult] of Object.entries(STREAK_MULTIPLIERS)) {
    if (streakDays >= parseInt(days)) {
      multiplier = mult;
    }
  }
  return multiplier;
}

export function calculatePoints(category: PointCategory, streakDays: number = 0): number {
  const basePoints = POINT_VALUES[category];
  const multiplier = category === "streak_bonus" ? getStreakMultiplier(streakDays) : 1;
  return Math.round(basePoints * multiplier);
}

export function checkBadgeEligibility(
  stats: PlayerStats,
  goals: HealthGoal[],
  earnedBadgeIds: string[]
): Badge[] {
  const eligibleBadges: Badge[] = [];
  
  const completedGoals = goals.filter(g => g.status === "completed");
  const exerciseGoals = completedGoals.filter(g => g.category === "exercise");
  const weightGoals = completedGoals.filter(g => g.category === "weight");
  
  for (const badge of AVAILABLE_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue;
    
    switch (badge.id) {
      case "badge-first-goal":
        if (goals.length >= 1) eligibleBadges.push(badge);
        break;
      case "badge-goal-crusher":
        if (completedGoals.length >= 5) eligibleBadges.push(badge);
        break;
      case "badge-streak-7":
        if (stats.longestStreak >= 7) eligibleBadges.push(badge);
        break;
      case "badge-streak-30":
        if (stats.longestStreak >= 30) eligibleBadges.push(badge);
        break;
      case "badge-streak-100":
        if (stats.longestStreak >= 100) eligibleBadges.push(badge);
        break;
      case "badge-weight-warrior":
        if (weightGoals.length >= 1) eligibleBadges.push(badge);
        break;
      case "badge-exercise-champion":
        if (exerciseGoals.length >= 10) eligibleBadges.push(badge);
        break;
      case "badge-perfectionist":
        if (goals.some(g => g.progress >= 100)) eligibleBadges.push(badge);
        break;
      case "badge-level-5":
        if (stats.currentLevel >= 5) eligibleBadges.push(badge);
        break;
    }
  }
  
  return eligibleBadges;
}

export function generateMotivationalNudge(
  patientId: string,
  stats: PlayerStats,
  streaks: StreakRecord[],
  goals: HealthGoal[]
): MotivationalNudge | null {
  const now = new Date();
  const lastActivity = new Date(stats.lastActivityDate);
  const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  
  const activeStreak = streaks.find(s => s.isActive && s.streakType === "daily_checkin");
  const activeGoals = goals.filter(g => g.status === "active" || g.status === "in_progress");
  const nearCompletionGoals = activeGoals.filter(g => g.progress >= 80 && g.progress < 100);
  
  let nudge: MotivationalNudge | null = null;
  
  if (daysSinceActivity >= 3) {
    nudge = {
      id: randomUUID(),
      patientId,
      type: "comeback_welcome",
      title: "We missed you!",
      message: `It's been ${daysSinceActivity} days since your last check-in. Your health journey awaits - let's get back on track together!`,
      icon: "heart",
      priority: "high",
      actionLabel: "Resume Journey",
      actionUrl: "/goals",
      isRead: false,
      isDismissed: false,
      createdAt: now.toISOString(),
    };
  } else if (activeStreak && activeStreak.currentCount === 6) {
    nudge = {
      id: randomUUID(),
      patientId,
      type: "streak_reminder",
      title: "One day to 7-day streak!",
      message: "You're just one day away from achieving your first Week Warrior badge! Keep going!",
      icon: "flame",
      priority: "high",
      actionLabel: "Check In",
      actionUrl: "/goals",
      isRead: false,
      isDismissed: false,
      createdAt: now.toISOString(),
    };
  } else if (nearCompletionGoals.length > 0) {
    const goal = nearCompletionGoals[0];
    nudge = {
      id: randomUUID(),
      patientId,
      type: "goal_encouragement",
      title: "Almost there!",
      message: `You're ${goal.progress}% done with "${goal.title}". A little more effort and you'll earn completion points!`,
      icon: "target",
      priority: "medium",
      actionLabel: "View Goal",
      actionUrl: "/goals",
      relatedGoalId: goal.id,
      isRead: false,
      isDismissed: false,
      createdAt: now.toISOString(),
    };
  } else if (stats.currentLevel === 1 && stats.totalPoints >= 80) {
    nudge = {
      id: randomUUID(),
      patientId,
      type: "milestone_celebration",
      title: "Level Up Soon!",
      message: `You only need ${100 - stats.totalPoints} more points to reach Level 2: Wellness Warrior!`,
      icon: "star",
      priority: "medium",
      isRead: false,
      isDismissed: false,
      createdAt: now.toISOString(),
    };
  } else {
    const motivationalMessages = [
      { title: "Keep it up!", message: "Every small step counts towards your health goals. You've got this!" },
      { title: "You're making progress!", message: "Consistency is key to lasting health improvements. Keep showing up!" },
      { title: "Stay focused!", message: "Your dedication to your health is inspiring. Let's make today count!" },
      { title: "Health champion!", message: "Taking care of your health is the best investment you can make." },
    ];
    const random = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    nudge = {
      id: randomUUID(),
      patientId,
      type: "daily_motivation",
      title: random.title,
      message: random.message,
      icon: "sparkles",
      priority: "low",
      isRead: false,
      isDismissed: false,
      createdAt: now.toISOString(),
    };
  }
  
  return nudge;
}

export function updateStreak(
  existingStreak: StreakRecord | undefined,
  patientId: string,
  streakType: StreakRecord["streakType"]
): StreakRecord {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  if (!existingStreak) {
    return {
      id: randomUUID(),
      patientId,
      streakType,
      currentCount: 1,
      longestCount: 1,
      lastCheckinDate: today,
      startDate: today,
      isActive: true,
    };
  }
  
  const lastCheckin = new Date(existingStreak.lastCheckinDate);
  const daysSinceCheckin = Math.floor((now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCheckin === 0) {
    return existingStreak;
  }
  
  if (daysSinceCheckin === 1) {
    const newCount = existingStreak.currentCount + 1;
    return {
      ...existingStreak,
      currentCount: newCount,
      longestCount: Math.max(existingStreak.longestCount, newCount),
      lastCheckinDate: today,
      isActive: true,
    };
  }
  
  return {
    ...existingStreak,
    currentCount: 1,
    lastCheckinDate: today,
    startDate: today,
    isActive: true,
  };
}

export function generateAnonymousLeaderboard(
  allStats: PlayerStats[],
  currentPatientId: string,
  type: "weekly" | "monthly" | "all_time" = "weekly"
): LocalLeaderboard {
  const anonymousAvatars = ["fox", "bear", "owl", "rabbit", "turtle", "dolphin", "eagle", "wolf", "lion", "panda"];
  
  const sortedStats = [...allStats].sort((a, b) => {
    switch (type) {
      case "weekly": return b.weeklyPoints - a.weeklyPoints;
      case "monthly": return b.monthlyPoints - a.monthlyPoints;
      default: return b.totalPoints - a.totalPoints;
    }
  });
  
  const entries: LocalLeaderboardEntry[] = sortedStats.slice(0, 10).map((stats, index) => {
    const levelInfo = calculateLevel(stats.totalPoints);
    const avatarIndex = stats.patientId.charCodeAt(0) % anonymousAvatars.length;
    
    return {
      rank: index + 1,
      anonymousId: `user-${stats.patientId.slice(-4)}`,
      displayName: stats.patientId === currentPatientId ? "You" : `Health Hero ${index + 1}`,
      avatarEmoji: anonymousAvatars[avatarIndex],
      totalPoints: type === "weekly" ? stats.weeklyPoints : type === "monthly" ? stats.monthlyPoints : stats.totalPoints,
      level: levelInfo.level,
      levelName: levelInfo.levelName,
      badgeCount: stats.badgesEarned,
      currentStreak: stats.currentStreak,
      isCurrentUser: stats.patientId === currentPatientId,
    };
  });
  
  const userRank = sortedStats.findIndex(s => s.patientId === currentPatientId) + 1;
  
  return {
    id: randomUUID(),
    type,
    entries,
    totalParticipants: allStats.length,
    userRank: userRank > 0 ? userRank : undefined,
    lastUpdated: new Date().toISOString(),
  };
}

export function createInitialPlayerStats(patientId: string): PlayerStats {
  return {
    id: randomUUID(),
    patientId,
    totalPoints: 0,
    currentLevel: 1,
    pointsToNextLevel: 100,
    currentStreak: 0,
    longestStreak: 0,
    goalsCompleted: 0,
    badgesEarned: 0,
    lastActivityDate: new Date().toISOString(),
    weeklyPoints: 0,
    monthlyPoints: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function createPointTransaction(
  patientId: string,
  category: PointCategory,
  description: string,
  streakDays: number = 0,
  relatedGoalId?: string
): LocalPointTransaction {
  return {
    id: randomUUID(),
    patientId,
    amount: calculatePoints(category, streakDays),
    category,
    description,
    relatedGoalId,
    createdAt: new Date().toISOString(),
  };
}

export function awardBadge(
  patientId: string,
  badge: Badge
): PlayerBadge {
  return {
    id: randomUUID(),
    patientId,
    badgeId: badge.id,
    badge,
    earnedAt: new Date().toISOString(),
    progress: 100,
    isNew: true,
  };
}
