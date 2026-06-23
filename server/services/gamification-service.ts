// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
} catch (error) {
  console.log("[Gamification] OpenAI client not available");
}

export type BadgeCategory = "health_goals" | "education" | "logging" | "habits" | "engagement" | "milestones" | "special";
export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AchievementStatus = "locked" | "in_progress" | "completed";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  pointsAwarded: number;
  requirement: {
    type: string;
    target: number;
    current?: number;
  };
  unlockedAt?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  status: AchievementStatus;
  progress: number;
  target: number;
  pointsAwarded: number;
  badgeId?: string;
  unlockedAt?: string;
  expiresAt?: string;
}

export interface UserProgress {
  odingId: string;
  totalPoints: number;
  level: number;
  levelProgress: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  badges: Badge[];
  achievements: Achievement[];
  stats: {
    healthGoalsCompleted: number;
    educationModulesCompleted: number;
    daysLogged: number;
    healthyHabitsDays: number;
    totalActivities: number;
  };
}

export interface LeaderboardEntry {
  odingId: string;
  displayName: string;
  avatarInitials: string;
  totalPoints: number;
  level: number;
  badgeCount: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface PointTransaction {
  id: string;
  odingId: string;
  points: number;
  reason: string;
  category: BadgeCategory;
  timestamp: string;
  relatedEntityId?: string;
}

export interface MotivationalFeedback {
  message: string;
  encouragement: string;
  nextMilestone?: string;
  suggestedActions: string[];
  celebrationLevel: "minor" | "moderate" | "major" | "legendary";
}

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3800, 5200, 7000, 9500, 13000, 18000, 25000];

const BADGE_DEFINITIONS: Badge[] = [
  { id: "first-steps", name: "First Steps", description: "Complete your first health goal", icon: "footprints", category: "health_goals", rarity: "common", pointsAwarded: 10, requirement: { type: "health_goals_completed", target: 1 } },
  { id: "goal-getter", name: "Goal Getter", description: "Complete 5 health goals", icon: "target", category: "health_goals", rarity: "uncommon", pointsAwarded: 50, requirement: { type: "health_goals_completed", target: 5 } },
  { id: "health-champion", name: "Health Champion", description: "Complete 25 health goals", icon: "trophy", category: "health_goals", rarity: "rare", pointsAwarded: 200, requirement: { type: "health_goals_completed", target: 25 } },
  { id: "wellness-master", name: "Wellness Master", description: "Complete 100 health goals", icon: "crown", category: "health_goals", rarity: "epic", pointsAwarded: 500, requirement: { type: "health_goals_completed", target: 100 } },
  
  { id: "curious-learner", name: "Curious Learner", description: "Complete your first education module", icon: "book-open", category: "education", rarity: "common", pointsAwarded: 15, requirement: { type: "education_completed", target: 1 } },
  { id: "knowledge-seeker", name: "Knowledge Seeker", description: "Complete 10 education modules", icon: "graduation-cap", category: "education", rarity: "uncommon", pointsAwarded: 75, requirement: { type: "education_completed", target: 10 } },
  { id: "health-scholar", name: "Health Scholar", description: "Complete 50 education modules", icon: "award", category: "education", rarity: "rare", pointsAwarded: 250, requirement: { type: "education_completed", target: 50 } },
  
  { id: "data-tracker", name: "Data Tracker", description: "Log health data for 7 consecutive days", icon: "clipboard-check", category: "logging", rarity: "common", pointsAwarded: 25, requirement: { type: "logging_streak", target: 7 } },
  { id: "consistent-logger", name: "Consistent Logger", description: "Log health data for 30 consecutive days", icon: "calendar-check", category: "logging", rarity: "uncommon", pointsAwarded: 100, requirement: { type: "logging_streak", target: 30 } },
  { id: "dedicated-tracker", name: "Dedicated Tracker", description: "Log health data for 90 consecutive days", icon: "flame", category: "logging", rarity: "rare", pointsAwarded: 300, requirement: { type: "logging_streak", target: 90 } },
  { id: "legendary-logger", name: "Legendary Logger", description: "Log health data for 365 consecutive days", icon: "star", category: "logging", rarity: "legendary", pointsAwarded: 1000, requirement: { type: "logging_streak", target: 365 } },
  
  { id: "habit-starter", name: "Habit Starter", description: "Maintain a healthy habit for 3 days", icon: "leaf", category: "habits", rarity: "common", pointsAwarded: 15, requirement: { type: "habit_streak", target: 3 } },
  { id: "habit-builder", name: "Habit Builder", description: "Maintain a healthy habit for 21 days", icon: "sprout", category: "habits", rarity: "uncommon", pointsAwarded: 75, requirement: { type: "habit_streak", target: 21 } },
  { id: "habit-master", name: "Habit Master", description: "Maintain a healthy habit for 66 days", icon: "tree-deciduous", category: "habits", rarity: "rare", pointsAwarded: 200, requirement: { type: "habit_streak", target: 66 } },
  
  { id: "early-bird", name: "Early Bird", description: "Log activity before 8 AM for 5 days", icon: "sunrise", category: "engagement", rarity: "common", pointsAwarded: 20, requirement: { type: "early_activity", target: 5 } },
  { id: "night-owl", name: "Night Owl", description: "Complete a health review in the evening for 5 days", icon: "moon", category: "engagement", rarity: "common", pointsAwarded: 20, requirement: { type: "evening_activity", target: 5 } },
  { id: "social-butterfly", name: "Social Butterfly", description: "Share a health achievement", icon: "share-2", category: "engagement", rarity: "common", pointsAwarded: 10, requirement: { type: "shares", target: 1 } },
  
  { id: "level-5", name: "Rising Star", description: "Reach Level 5", icon: "trending-up", category: "milestones", rarity: "uncommon", pointsAwarded: 50, requirement: { type: "level", target: 5 } },
  { id: "level-10", name: "Health Hero", description: "Reach Level 10", icon: "shield", category: "milestones", rarity: "rare", pointsAwarded: 150, requirement: { type: "level", target: 10 } },
  { id: "level-15", name: "Wellness Legend", description: "Reach Level 15", icon: "gem", category: "milestones", rarity: "epic", pointsAwarded: 300, requirement: { type: "level", target: 15 } },
  
  { id: "perfect-week", name: "Perfect Week", description: "Complete all daily goals for 7 days straight", icon: "check-circle", category: "special", rarity: "rare", pointsAwarded: 150, requirement: { type: "perfect_days", target: 7 } },
  { id: "comeback-kid", name: "Comeback Kid", description: "Return after 30+ days away and complete a goal", icon: "refresh-cw", category: "special", rarity: "uncommon", pointsAwarded: 50, requirement: { type: "comeback", target: 1 } },
  { id: "overachiever", name: "Overachiever", description: "Exceed a goal target by 50%", icon: "zap", category: "special", rarity: "rare", pointsAwarded: 100, requirement: { type: "overachieve", target: 1 } },
];

class GamificationService {
  private userProgress: Map<string, UserProgress> = new Map();
  private pointTransactions: PointTransaction[] = [];
  private leaderboard: LeaderboardEntry[] = [];

  constructor() {
    this.initializeSampleData();
    console.log("[Gamification] Service initialized");
    console.log("[Gamification] Features: Points, badges, achievements, streaks, leaderboards, motivational feedback");
  }

  private initializeSampleData() {
    const sampleUsers: UserProgress[] = [
      {
        odingId: "patient-1",
        totalPoints: 1250,
        level: 6,
        levelProgress: 67,
        pointsToNextLevel: 200,
        currentStreak: 12,
        longestStreak: 28,
        lastActivityDate: new Date().toISOString(),
        badges: [
          { ...BADGE_DEFINITIONS[0], unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { ...BADGE_DEFINITIONS[1], unlockedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
          { ...BADGE_DEFINITIONS[4], unlockedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
          { ...BADGE_DEFINITIONS[7], unlockedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
          { ...BADGE_DEFINITIONS[11], unlockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        achievements: [
          { id: "ach-1", name: "Weekly Warrior", description: "Complete goals every day this week", category: "health_goals", status: "in_progress", progress: 5, target: 7, pointsAwarded: 50 },
          { id: "ach-2", name: "Learn Something New", description: "Complete 3 education modules this month", category: "education", status: "in_progress", progress: 2, target: 3, pointsAwarded: 30 },
          { id: "ach-3", name: "Consistency Champion", description: "Log health data for 14 days", category: "logging", status: "in_progress", progress: 12, target: 14, pointsAwarded: 75 },
        ],
        stats: {
          healthGoalsCompleted: 18,
          educationModulesCompleted: 7,
          daysLogged: 45,
          healthyHabitsDays: 32,
          totalActivities: 156,
        },
      },
      {
        odingId: "patient-2",
        totalPoints: 2450,
        level: 8,
        levelProgress: 45,
        pointsToNextLevel: 450,
        currentStreak: 34,
        longestStreak: 45,
        lastActivityDate: new Date().toISOString(),
        badges: BADGE_DEFINITIONS.slice(0, 8).map(b => ({ ...b, unlockedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString() })),
        achievements: [],
        stats: {
          healthGoalsCompleted: 42,
          educationModulesCompleted: 15,
          daysLogged: 89,
          healthyHabitsDays: 67,
          totalActivities: 312,
        },
      },
      {
        odingId: "patient-3",
        totalPoints: 850,
        level: 5,
        levelProgress: 0,
        pointsToNextLevel: 450,
        currentStreak: 5,
        longestStreak: 14,
        lastActivityDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        badges: BADGE_DEFINITIONS.slice(0, 3).map(b => ({ ...b, unlockedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() })),
        achievements: [],
        stats: {
          healthGoalsCompleted: 8,
          educationModulesCompleted: 3,
          daysLogged: 21,
          healthyHabitsDays: 14,
          totalActivities: 67,
        },
      },
    ];

    sampleUsers.forEach(u => this.userProgress.set(u.odingId, u));
    this.updateLeaderboard();

    console.log("[Gamification] Sample data initialized");
    console.log(`[Gamification] Users: ${this.userProgress.size}, Badges defined: ${BADGE_DEFINITIONS.length}`);
  }

  private calculateLevel(points: number): { level: number; progress: number; pointsToNext: number } {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (points >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
      } else {
        break;
      }
    }

    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold + 1000;
    const pointsInLevel = points - currentThreshold;
    const pointsNeeded = nextThreshold - currentThreshold;
    const progress = Math.round((pointsInLevel / pointsNeeded) * 100);

    return { level, progress, pointsToNext: nextThreshold - points };
  }

  private updateLeaderboard() {
    const entries: LeaderboardEntry[] = Array.from(this.userProgress.values())
      .map((u, index) => ({
        odingId: u.odingId,
        displayName: `Health Hero ${u.odingId.split("-")[1] || index + 1}`,
        avatarInitials: `H${index + 1}`,
        totalPoints: u.totalPoints,
        level: u.level,
        badgeCount: u.badges.length,
        rank: 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    this.leaderboard = entries;
  }

  async getUserProgress(odingId: string): Promise<UserProgress> {
    let progress = this.userProgress.get(odingId);
    
    if (!progress) {
      progress = {
        odingId,
        totalPoints: 0,
        level: 1,
        levelProgress: 0,
        pointsToNextLevel: 100,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: new Date().toISOString(),
        badges: [],
        achievements: this.generateInitialAchievements(),
        stats: {
          healthGoalsCompleted: 0,
          educationModulesCompleted: 0,
          daysLogged: 0,
          healthyHabitsDays: 0,
          totalActivities: 0,
        },
      };
      this.userProgress.set(odingId, progress);
    }

    return progress;
  }

  private generateInitialAchievements(): Achievement[] {
    return [
      { id: "ach-new-1", name: "Getting Started", description: "Complete your first health goal", category: "health_goals", status: "in_progress", progress: 0, target: 1, pointsAwarded: 25 },
      { id: "ach-new-2", name: "Curious Mind", description: "Read your first education article", category: "education", status: "locked", progress: 0, target: 1, pointsAwarded: 15 },
      { id: "ach-new-3", name: "Data Driven", description: "Log health data for 3 days", category: "logging", status: "in_progress", progress: 0, target: 3, pointsAwarded: 20 },
    ];
  }

  async awardPoints(odingId: string, points: number, reason: string, category: BadgeCategory, relatedEntityId?: string): Promise<{ newTotal: number; levelUp: boolean; newLevel?: number; badgesEarned: Badge[] }> {
    const progress = await this.getUserProgress(odingId);
    const oldLevel = progress.level;
    
    progress.totalPoints += points;
    progress.stats.totalActivities++;
    progress.lastActivityDate = new Date().toISOString();

    const { level, progress: levelProgress, pointsToNext } = this.calculateLevel(progress.totalPoints);
    progress.level = level;
    progress.levelProgress = levelProgress;
    progress.pointsToNextLevel = pointsToNext;

    const transaction: PointTransaction = {
      id: `txn-${Date.now()}`,
      odingId,
      points,
      reason,
      category,
      timestamp: new Date().toISOString(),
      relatedEntityId,
    };
    this.pointTransactions.push(transaction);

    const badgesEarned = await this.checkBadgeUnlocks(progress);

    this.userProgress.set(odingId, progress);
    this.updateLeaderboard();

    console.log(`[Gamification] Awarded ${points} points to ${odingId} for: ${reason}`);

    return {
      newTotal: progress.totalPoints,
      levelUp: level > oldLevel,
      newLevel: level > oldLevel ? level : undefined,
      badgesEarned,
    };
  }

  async recordHealthGoalCompletion(odingId: string, goalId: string, overachieved: boolean = false): Promise<{ pointsEarned: number; badgesEarned: Badge[]; feedback: MotivationalFeedback }> {
    const progress = await this.getUserProgress(odingId);
    progress.stats.healthGoalsCompleted++;

    let points = 20;
    if (overachieved) points += 15;

    const result = await this.awardPoints(odingId, points, "Health goal completed", "health_goals", goalId);
    const feedback = await this.generateMotivationalFeedback(progress, "health_goal", result.levelUp);

    return { pointsEarned: points, badgesEarned: result.badgesEarned, feedback };
  }

  async recordEducationCompletion(odingId: string, moduleId: string): Promise<{ pointsEarned: number; badgesEarned: Badge[]; feedback: MotivationalFeedback }> {
    const progress = await this.getUserProgress(odingId);
    progress.stats.educationModulesCompleted++;

    const points = 15;
    const result = await this.awardPoints(odingId, points, "Education module completed", "education", moduleId);
    const feedback = await this.generateMotivationalFeedback(progress, "education", result.levelUp);

    return { pointsEarned: points, badgesEarned: result.badgesEarned, feedback };
  }

  async recordDailyLog(odingId: string): Promise<{ pointsEarned: number; streakBonus: number; badgesEarned: Badge[]; feedback: MotivationalFeedback }> {
    const progress = await this.getUserProgress(odingId);
    const today = new Date().toDateString();
    const lastActivity = new Date(progress.lastActivityDate).toDateString();
    
    let streakBonus = 0;
    
    if (lastActivity === today) {
      return { pointsEarned: 0, streakBonus: 0, badgesEarned: [], feedback: await this.generateMotivationalFeedback(progress, "logging", false) };
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    if (lastActivity === yesterday) {
      progress.currentStreak++;
      if (progress.currentStreak > progress.longestStreak) {
        progress.longestStreak = progress.currentStreak;
      }
      streakBonus = Math.min(Math.floor(progress.currentStreak / 7) * 5, 25);
    } else {
      progress.currentStreak = 1;
    }

    progress.stats.daysLogged++;
    const basePoints = 5;
    const totalPoints = basePoints + streakBonus;

    const result = await this.awardPoints(odingId, totalPoints, `Daily log (streak: ${progress.currentStreak})`, "logging");
    const feedback = await this.generateMotivationalFeedback(progress, "logging", result.levelUp);

    return { pointsEarned: totalPoints, streakBonus, badgesEarned: result.badgesEarned, feedback };
  }

  async recordHealthyHabit(odingId: string, habitType: string): Promise<{ pointsEarned: number; badgesEarned: Badge[]; feedback: MotivationalFeedback }> {
    const progress = await this.getUserProgress(odingId);
    progress.stats.healthyHabitsDays++;

    const points = 10;
    const result = await this.awardPoints(odingId, points, `Healthy habit: ${habitType}`, "habits");
    const feedback = await this.generateMotivationalFeedback(progress, "habit", result.levelUp);

    return { pointsEarned: points, badgesEarned: result.badgesEarned, feedback };
  }

  private async checkBadgeUnlocks(progress: UserProgress): Promise<Badge[]> {
    const earnedBadgeIds = new Set(progress.badges.map(b => b.id));
    const newBadges: Badge[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let earned = false;
      switch (badge.requirement.type) {
        case "health_goals_completed":
          earned = progress.stats.healthGoalsCompleted >= badge.requirement.target;
          break;
        case "education_completed":
          earned = progress.stats.educationModulesCompleted >= badge.requirement.target;
          break;
        case "logging_streak":
          earned = progress.currentStreak >= badge.requirement.target;
          break;
        case "habit_streak":
          earned = progress.stats.healthyHabitsDays >= badge.requirement.target;
          break;
        case "level":
          earned = progress.level >= badge.requirement.target;
          break;
      }

      if (earned) {
        const unlockedBadge = { ...badge, unlockedAt: new Date().toISOString() };
        progress.badges.push(unlockedBadge);
        newBadges.push(unlockedBadge);
        console.log(`[Gamification] Badge unlocked for ${progress.odingId}: ${badge.name}`);
      }
    }

    return newBadges;
  }

  private async generateMotivationalFeedback(progress: UserProgress, activityType: string, levelUp: boolean): Promise<MotivationalFeedback> {
    const celebrationLevel = levelUp ? "major" : progress.currentStreak >= 7 ? "moderate" : "minor";
    
    const messages: Record<string, string[]> = {
      health_goal: [
        "Fantastic work on completing your health goal!",
        "You're making incredible progress toward better health!",
        "Every goal completed is a step toward a healthier you!",
      ],
      education: [
        "Great job expanding your health knowledge!",
        "Learning is the foundation of wellness!",
        "Knowledge is power - especially for your health!",
      ],
      logging: [
        `${progress.currentStreak} day streak! Keep it going!`,
        "Consistency is key to understanding your health patterns!",
        "Great job tracking your health data today!",
      ],
      habit: [
        "Healthy habits lead to lasting changes!",
        "One day at a time - you're building something great!",
        "Your commitment to health is inspiring!",
      ],
    };

    const encouragements = [
      "You've got this!",
      "Keep pushing forward!",
      "Your dedication is paying off!",
      "Stay motivated - you're doing amazing!",
      "Health is wealth, and you're getting richer every day!",
    ];

    const suggestedActions: string[] = [];
    if (progress.stats.educationModulesCompleted < 5) {
      suggestedActions.push("Explore our health education library");
    }
    if (progress.currentStreak < 7) {
      suggestedActions.push("Log your health data tomorrow to build your streak");
    }
    if (progress.stats.healthGoalsCompleted < 10) {
      suggestedActions.push("Set a new health goal to stay on track");
    }

    const nextMilestone = this.getNextMilestone(progress);

    const categoryMessages = messages[activityType] || messages.health_goal;
    
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Generate a brief, encouraging health motivation message (1-2 sentences). Be warm and supportive. NO medical advice.",
            },
            {
              role: "user",
              content: `User stats: Level ${progress.level}, ${progress.currentStreak} day streak, ${progress.stats.healthGoalsCompleted} goals completed. Activity: ${activityType}.`,
            },
          ],
          max_tokens: 100,
        });

        return {
          message: response.choices[0].message.content || categoryMessages[Math.floor(Math.random() * categoryMessages.length)],
          encouragement: encouragements[Math.floor(Math.random() * encouragements.length)],
          nextMilestone,
          suggestedActions,
          celebrationLevel,
        };
      } catch (error) {
        console.log("[Gamification] AI feedback generation fallback");
      }
    }

    return {
      message: categoryMessages[Math.floor(Math.random() * categoryMessages.length)],
      encouragement: encouragements[Math.floor(Math.random() * encouragements.length)],
      nextMilestone,
      suggestedActions,
      celebrationLevel,
    };
  }

  private getNextMilestone(progress: UserProgress): string {
    const milestones = [
      { check: progress.currentStreak < 7, msg: `${7 - progress.currentStreak} days to 1-week streak badge!` },
      { check: progress.currentStreak < 30, msg: `${30 - progress.currentStreak} days to monthly streak badge!` },
      { check: progress.stats.healthGoalsCompleted < 5, msg: `${5 - progress.stats.healthGoalsCompleted} goals to Goal Getter badge!` },
      { check: progress.stats.healthGoalsCompleted < 25, msg: `${25 - progress.stats.healthGoalsCompleted} goals to Health Champion badge!` },
      { check: progress.stats.educationModulesCompleted < 10, msg: `${10 - progress.stats.educationModulesCompleted} modules to Knowledge Seeker badge!` },
    ];

    for (const milestone of milestones) {
      if (milestone.check) return milestone.msg;
    }

    return `${progress.pointsToNextLevel} points to Level ${progress.level + 1}!`;
  }

  async getLeaderboard(odingId?: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const entries = this.leaderboard.slice(0, limit).map(e => ({
      ...e,
      isCurrentUser: e.odingId === odingId,
    }));

    if (odingId && !entries.some(e => e.isCurrentUser)) {
      const userEntry = this.leaderboard.find(e => e.odingId === odingId);
      if (userEntry) {
        entries.push({ ...userEntry, isCurrentUser: true });
      }
    }

    return entries;
  }

  async getAllBadges(odingId?: string): Promise<{ badges: Badge[]; earned: string[] }> {
    const progress = odingId ? await this.getUserProgress(odingId) : null;
    const earnedIds = progress ? progress.badges.map(b => b.id) : [];

    return {
      badges: BADGE_DEFINITIONS.map(badge => ({
        ...badge,
        requirement: {
          ...badge.requirement,
          current: progress ? this.getBadgeProgress(progress, badge) : 0,
        },
        unlockedAt: progress?.badges.find(b => b.id === badge.id)?.unlockedAt,
      })),
      earned: earnedIds,
    };
  }

  private getBadgeProgress(progress: UserProgress, badge: Badge): number {
    switch (badge.requirement.type) {
      case "health_goals_completed": return progress.stats.healthGoalsCompleted;
      case "education_completed": return progress.stats.educationModulesCompleted;
      case "logging_streak": return progress.currentStreak;
      case "habit_streak": return progress.stats.healthyHabitsDays;
      case "level": return progress.level;
      default: return 0;
    }
  }

  async getPointHistory(odingId: string, limit: number = 20): Promise<PointTransaction[]> {
    return this.pointTransactions
      .filter(t => t.odingId === odingId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getGamificationStats(): Promise<{
    totalUsers: number;
    totalPointsAwarded: number;
    totalBadgesEarned: number;
    averageLevel: number;
    activeStreaks: number;
    topCategory: BadgeCategory;
  }> {
    const users = Array.from(this.userProgress.values());
    const totalPoints = users.reduce((sum, u) => sum + u.totalPoints, 0);
    const totalBadges = users.reduce((sum, u) => sum + u.badges.length, 0);
    const avgLevel = users.length > 0 ? users.reduce((sum, u) => sum + u.level, 0) / users.length : 1;
    const activeStreaks = users.filter(u => u.currentStreak > 0).length;

    const categoryCounts: Record<BadgeCategory, number> = {
      health_goals: 0, education: 0, logging: 0, habits: 0, engagement: 0, milestones: 0, special: 0,
    };
    users.forEach(u => u.badges.forEach(b => categoryCounts[b.category]++));
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0] as BadgeCategory;

    return {
      totalUsers: users.length,
      totalPointsAwarded: totalPoints,
      totalBadgesEarned: totalBadges,
      averageLevel: Math.round(avgLevel * 10) / 10,
      activeStreaks,
      topCategory,
    };
  }
}

export const gamificationService = new GamificationService();
