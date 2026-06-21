import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  HealthChallenge,
  UserChallengeProgress,
  UserAchievement,
  UserStreak,
  UserPoints,
  insertHealthChallengeSchema,
  insertUserChallengeProgressSchema,
  updateChallengeProgressSchema,
  ChallengeStatus,
  BadgeRarity,
  ChallengeCategory,
} from "@shared/schema";

const router = Router();

// Local interface definitions to avoid schema conflicts
interface LocalAchievement {
  id: string;
  name: string;
  description: string;
  iconName: string;
  colorTheme: string;
  rarity: BadgeRarity;
  pointsValue: number;
  category: ChallengeCategory;
  requirement: string;
  requirementValue: number;
  isHidden: boolean;
  createdAt: string;
}

interface LocalPointTransaction {
  id: string;
  userId: string;
  profileId: string;
  amount: number;
  transactionType: "earned" | "spent" | "bonus" | "expired";
  source: string;
  sourceId: string | null;
  description: string;
  createdAt: string;
}

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

interface LocalLeaderboardData {
  period: "daily" | "weekly" | "monthly" | "all_time";
  entries: LocalLeaderboardEntry[];
  userRank: number | null;
  totalParticipants: number;
  lastUpdatedAt: string;
}

const healthChallenges = new Map<string, HealthChallenge>();
const userChallengeProgress = new Map<string, UserChallengeProgress>();
const achievements = new Map<string, LocalAchievement>();
const userAchievements = new Map<string, UserAchievement>();
const userStreaks = new Map<string, UserStreak>();
const userPoints = new Map<string, UserPoints>();
const pointTransactions = new Map<string, LocalPointTransaction>();

function generateId(): string {
  return randomUUID();
}

const levelThresholds = [
  { level: 1, name: "Health Beginner", minPoints: 0 },
  { level: 2, name: "Health Enthusiast", minPoints: 100 },
  { level: 3, name: "Wellness Warrior", minPoints: 300 },
  { level: 4, name: "Health Champion", minPoints: 600 },
  { level: 5, name: "Vitality Master", minPoints: 1000 },
  { level: 6, name: "Wellness Expert", minPoints: 1500 },
  { level: 7, name: "Health Hero", minPoints: 2500 },
  { level: 8, name: "Wellness Legend", minPoints: 4000 },
  { level: 9, name: "Health Titan", minPoints: 6000 },
  { level: 10, name: "Ultimate Wellness", minPoints: 10000 },
];

function getLevelInfo(points: number) {
  let currentLevel = levelThresholds[0];
  let nextLevel = levelThresholds[1];
  
  for (let i = 0; i < levelThresholds.length; i++) {
    if (points >= levelThresholds[i].minPoints) {
      currentLevel = levelThresholds[i];
      nextLevel = levelThresholds[i + 1] || levelThresholds[i];
    }
  }
  
  return {
    level: currentLevel.level,
    levelName: currentLevel.name,
    pointsToNextLevel: nextLevel.minPoints - points,
  };
}

function initializeSampleData() {
  if (healthChallenges.size > 0) return;

  const now = new Date().toISOString();
  const userId = "current-user";
  const profileId = "profile-self-001";

  const challenges: HealthChallenge[] = [
    {
      id: "challenge-001",
      title: "Medication Master",
      description: "Take all prescribed medications on time for 7 days straight",
      category: "medication_adherence",
      difficulty: "easy",
      pointsReward: 100,
      badgeReward: "medication-hero",
      goalValue: 7,
      goalUnit: "days",
      durationDays: 7,
      iconName: "pill",
      colorTheme: "blue",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
    {
      id: "challenge-002",
      title: "Step It Up",
      description: "Walk 10,000 steps daily for 5 days",
      category: "exercise",
      difficulty: "medium",
      pointsReward: 150,
      badgeReward: "step-champion",
      goalValue: 5,
      goalUnit: "days",
      durationDays: 7,
      iconName: "footprints",
      colorTheme: "green",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
    {
      id: "challenge-003",
      title: "Hydration Hero",
      description: "Drink 8 glasses of water daily for 10 days",
      category: "hydration",
      difficulty: "easy",
      pointsReward: 75,
      badgeReward: "water-warrior",
      goalValue: 10,
      goalUnit: "days",
      durationDays: 14,
      iconName: "droplet",
      colorTheme: "cyan",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
    {
      id: "challenge-004",
      title: "Sleep Champion",
      description: "Get 7+ hours of sleep for 7 consecutive nights",
      category: "sleep",
      difficulty: "medium",
      pointsReward: 120,
      badgeReward: "sleep-master",
      goalValue: 7,
      goalUnit: "nights",
      durationDays: 10,
      iconName: "moon",
      colorTheme: "purple",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
    {
      id: "challenge-005",
      title: "Mindfulness Journey",
      description: "Complete 5 meditation sessions this week",
      category: "mental_wellness",
      difficulty: "easy",
      pointsReward: 80,
      badgeReward: null,
      goalValue: 5,
      goalUnit: "sessions",
      durationDays: 7,
      iconName: "brain",
      colorTheme: "pink",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
    {
      id: "challenge-006",
      title: "Preventive Care Pro",
      description: "Schedule and attend your annual checkup",
      category: "preventive_care",
      difficulty: "easy",
      pointsReward: 200,
      badgeReward: "preventive-champion",
      goalValue: 1,
      goalUnit: "appointments",
      durationDays: 30,
      iconName: "stethoscope",
      colorTheme: "red",
      isSystemChallenge: true,
      isActive: true,
      createdAt: now,
    },
  ];

  challenges.forEach(c => healthChallenges.set(c.id, c));

  const progress1: UserChallengeProgress = {
    id: generateId(),
    userId,
    profileId,
    challengeId: "challenge-001",
    status: "active",
    currentValue: 4,
    goalValue: 7,
    startedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: now,
    streakDays: 4,
    notes: null,
  };

  const progress2: UserChallengeProgress = {
    id: generateId(),
    userId,
    profileId,
    challengeId: "challenge-003",
    status: "active",
    currentValue: 6,
    goalValue: 10,
    startedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: now,
    streakDays: 6,
    notes: null,
  };

  const progress3: UserChallengeProgress = {
    id: generateId(),
    userId,
    profileId,
    challengeId: "challenge-002",
    status: "completed",
    currentValue: 5,
    goalValue: 5,
    startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    streakDays: 5,
    notes: "Great job completing the step challenge!",
  };

  userChallengeProgress.set(progress1.id, progress1);
  userChallengeProgress.set(progress2.id, progress2);
  userChallengeProgress.set(progress3.id, progress3);

  const sampleAchievements: LocalAchievement[] = [
    {
      id: "ach-001",
      name: "First Steps",
      description: "Complete your first health challenge",
      iconName: "trophy",
      colorTheme: "gold",
      rarity: "common",
      pointsValue: 50,
      category: "exercise",
      requirement: "Complete 1 challenge",
      requirementValue: 1,
      isHidden: false,
      createdAt: now,
    },
    {
      id: "ach-002",
      name: "Medication Champion",
      description: "Maintain a 7-day medication streak",
      iconName: "pill",
      colorTheme: "blue",
      rarity: "uncommon",
      pointsValue: 100,
      category: "medication_adherence",
      requirement: "7-day medication streak",
      requirementValue: 7,
      isHidden: false,
      createdAt: now,
    },
    {
      id: "ach-003",
      name: "Wellness Warrior",
      description: "Complete 5 different health challenges",
      iconName: "shield",
      colorTheme: "purple",
      rarity: "rare",
      pointsValue: 200,
      category: "preventive_care",
      requirement: "Complete 5 challenges",
      requirementValue: 5,
      isHidden: false,
      createdAt: now,
    },
    {
      id: "ach-004",
      name: "Health Legend",
      description: "Reach level 10 in health points",
      iconName: "crown",
      colorTheme: "gold",
      rarity: "legendary",
      pointsValue: 500,
      category: "preventive_care",
      requirement: "Reach level 10",
      requirementValue: 10,
      isHidden: true,
      createdAt: now,
    },
  ];

  sampleAchievements.forEach(a => achievements.set(a.id, a));

  const userAch1: UserAchievement = {
    id: generateId(),
    userId,
    profileId,
    achievementId: "ach-001",
    earnedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    celebratedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
  userAchievements.set(userAch1.id, userAch1);

  const streak: UserStreak = {
    id: generateId(),
    userId,
    profileId,
    streakType: "daily_login",
    currentStreak: 12,
    longestStreak: 15,
    lastActivityAt: now,
    streakStartedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    isFrozen: false,
    freezesRemaining: 2,
  };
  userStreaks.set(streak.id, streak);

  const points: UserPoints = {
    id: generateId(),
    userId,
    profileId,
    totalPoints: 450,
    currentPoints: 350,
    lifetimePoints: 650,
    level: 4,
    levelName: "Health Champion",
    pointsToNextLevel: 150,
    lastEarnedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now,
  };
  userPoints.set(points.id, points);

  const transactions: LocalPointTransaction[] = [
    {
      id: generateId(),
      userId,
      profileId,
      amount: 150,
      transactionType: "earned",
      source: "challenge_complete",
      sourceId: "challenge-002",
      description: "Completed Step It Up challenge",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      userId,
      profileId,
      amount: 50,
      transactionType: "earned",
      source: "achievement",
      sourceId: "ach-001",
      description: "Earned First Steps achievement",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      userId,
      profileId,
      amount: 25,
      transactionType: "bonus",
      source: "streak",
      sourceId: null,
      description: "7-day login streak bonus",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  transactions.forEach(t => pointTransactions.set(t.id, t));
}

initializeSampleData();

router.get("/challenges", async (req: Request, res: Response) => {
  try {
    const { category, difficulty, active } = req.query;

    let challenges = Array.from(healthChallenges.values());

    if (category) {
      challenges = challenges.filter(c => c.category === category);
    }
    if (difficulty) {
      challenges = challenges.filter(c => c.difficulty === difficulty);
    }
    if (active !== undefined) {
      challenges = challenges.filter(c => c.isActive === (active === "true"));
    }

    const now = new Date();
    const transformedChallenges = challenges.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      targetValue: c.goalValue,
      targetUnit: c.goalUnit,
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(now.getTime() + c.durationDays * 24 * 60 * 60 * 1000).toISOString(),
      isActive: c.isActive,
      pointsReward: c.pointsReward,
    }));

    res.json({ data: transformedChallenges });
  } catch (error) {
    console.error("[Gamification] Get challenges error:", error);
    res.status(500).json({ error: "Failed to get challenges" });
  }
});

router.get("/challenges/:challengeId", async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const challenge = healthChallenges.get(challengeId);

    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }

    res.json(challenge);
  } catch (error) {
    console.error("[Gamification] Get challenge error:", error);
    res.status(500).json({ error: "Failed to get challenge" });
  }
});

router.get("/progress", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId, status } = req.query;

    let progress = Array.from(userChallengeProgress.values())
      .filter(p => p.userId === userId);

    if (profileId) {
      progress = progress.filter(p => p.profileId === profileId);
    }
    if (status) {
      progress = progress.filter(p => p.status === status);
    }

    const transformedProgress = progress.map(p => ({
      id: p.id,
      challengeId: p.challengeId,
      currentValue: p.currentValue,
      completedAt: p.completedAt,
      lastUpdated: p.lastUpdatedAt,
    }));

    res.json({ data: transformedProgress });
  } catch (error) {
    console.error("[Gamification] Get progress error:", error);
    res.status(500).json({ error: "Failed to get progress" });
  }
});

router.post("/progress", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const validated = insertUserChallengeProgressSchema.parse(req.body);
    const challenge = healthChallenges.get(validated.challengeId);

    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }

    const existing = Array.from(userChallengeProgress.values()).find(
      p => p.userId === userId && 
           p.profileId === validated.profileId && 
           p.challengeId === validated.challengeId &&
           p.status === "active"
    );

    if (existing) {
      res.status(400).json({ error: "Already enrolled in this challenge" });
      return;
    }

    const now = new Date().toISOString();
    const progress: UserChallengeProgress = {
      id: generateId(),
      userId,
      profileId: validated.profileId,
      challengeId: validated.challengeId,
      status: "active",
      currentValue: 0,
      goalValue: challenge.goalValue,
      startedAt: now,
      completedAt: null,
      expiresAt: new Date(Date.now() + challenge.durationDays * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdatedAt: now,
      streakDays: 0,
      notes: null,
    };

    userChallengeProgress.set(progress.id, progress);

    res.status(201).json({ ...progress, challenge });
  } catch (error) {
    console.error("[Gamification] Join challenge error:", error);
    res.status(500).json({ error: "Failed to join challenge" });
  }
});

router.patch("/progress/:progressId", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { progressId } = req.params;

    const progress = userChallengeProgress.get(progressId);
    if (!progress || progress.userId !== userId) {
      res.status(404).json({ error: "Progress not found" });
      return;
    }

    if (progress.status !== "active") {
      res.status(400).json({ error: "Challenge is not active" });
      return;
    }

    const validated = updateChallengeProgressSchema.parse(req.body);
    const now = new Date().toISOString();

    progress.currentValue = Math.min(validated.progressValue, progress.goalValue);
    progress.lastUpdatedAt = now;
    if (validated.notes) {
      progress.notes = validated.notes;
    }

    if (progress.currentValue >= progress.goalValue) {
      progress.status = "completed";
      progress.completedAt = now;

      const challenge = healthChallenges.get(progress.challengeId);
      if (challenge) {
        const pointsEntry = Array.from(userPoints.values())
          .find(p => p.userId === userId && p.profileId === progress.profileId);
        
        if (pointsEntry) {
          pointsEntry.totalPoints += challenge.pointsReward;
          pointsEntry.currentPoints += challenge.pointsReward;
          pointsEntry.lifetimePoints += challenge.pointsReward;
          pointsEntry.lastEarnedAt = now;

          const levelInfo = getLevelInfo(pointsEntry.lifetimePoints);
          pointsEntry.level = levelInfo.level;
          pointsEntry.levelName = levelInfo.levelName;
          pointsEntry.pointsToNextLevel = levelInfo.pointsToNextLevel;
          pointsEntry.updatedAt = now;

          userPoints.set(pointsEntry.id, pointsEntry);

          const transaction: LocalPointTransaction = {
            id: generateId(),
            userId,
            profileId: progress.profileId,
            amount: challenge.pointsReward,
            transactionType: "earned",
            source: "challenge_complete",
            sourceId: progress.challengeId,
            description: `Completed ${challenge.title}`,
            createdAt: now,
          };
          pointTransactions.set(transaction.id, transaction);
        }
      }
    }

    userChallengeProgress.set(progressId, progress);

    const challenge = healthChallenges.get(progress.challengeId);
    res.json({
      ...progress,
      challenge,
      percentComplete: Math.round((progress.currentValue / progress.goalValue) * 100),
    });
  } catch (error) {
    console.error("[Gamification] Update progress error:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

router.get("/achievements", async (req: Request, res: Response) => {
  try {
    const { category, includeHidden } = req.query;

    let allAchievements = Array.from(achievements.values());

    if (category) {
      allAchievements = allAchievements.filter(a => a.category === category);
    }
    if (includeHidden !== "true") {
      allAchievements = allAchievements.filter(a => !a.isHidden);
    }

    const transformedAchievements = allAchievements.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.iconName || "trophy",
      category: a.category,
      requirement: a.requirement,
      pointsValue: a.pointsValue,
    }));

    res.json({ data: transformedAchievements });
  } catch (error) {
    console.error("[Gamification] Get achievements error:", error);
    res.status(500).json({ error: "Failed to get achievements" });
  }
});

router.get("/achievements/user", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId } = req.query;

    let userAchs = Array.from(userAchievements.values())
      .filter(ua => ua.userId === userId);

    if (profileId) {
      userAchs = userAchs.filter(ua => ua.profileId === profileId);
    }

    const transformedUserAchievements = userAchs.map(ua => ({
      id: ua.id,
      achievementId: ua.achievementId,
      earnedAt: ua.earnedAt,
    }));

    res.json({ data: transformedUserAchievements });
  } catch (error) {
    console.error("[Gamification] Get user achievements error:", error);
    res.status(500).json({ error: "Failed to get user achievements" });
  }
});

router.get("/streaks", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId } = req.query;

    let streaks = Array.from(userStreaks.values())
      .filter(s => s.userId === userId);

    if (profileId) {
      streaks = streaks.filter(s => s.profileId === profileId);
    }

    res.json(streaks);
  } catch (error) {
    console.error("[Gamification] Get streaks error:", error);
    res.status(500).json({ error: "Failed to get streaks" });
  }
});

router.get("/points", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId } = req.query;

    let points = Array.from(userPoints.values())
      .filter(p => p.userId === userId);

    if (profileId) {
      points = points.filter(p => p.profileId === profileId);
    }

    const userStreak = Array.from(userStreaks.values())
      .find(s => s.userId === userId);

    const p = points[0];
    const pointsData = {
      totalPoints: p?.totalPoints || 450,
      currentStreak: userStreak?.currentStreak || 5,
      longestStreak: userStreak?.longestStreak || 12,
      level: p?.level || 3,
      pointsToNextLevel: p?.pointsToNextLevel || 150,
    };

    res.json({ data: pointsData });
  } catch (error) {
    console.error("[Gamification] Get points error:", error);
    res.status(500).json({ error: "Failed to get points" });
  }
});

router.get("/points/transactions", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId, limit = "20" } = req.query;

    let transactions = Array.from(pointTransactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (profileId) {
      transactions = transactions.filter(t => t.profileId === profileId);
    }

    const limitNum = parseInt(limit as string, 10);
    transactions = transactions.slice(0, limitNum);

    res.json(transactions);
  } catch (error) {
    console.error("[Gamification] Get transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { period = "weekly" } = req.query;

    const entries: LocalLeaderboardEntry[] = [
      {
        rank: 1,
        anonymousId: "user-001",
        displayName: "HealthHero123",
        avatarEmoji: "🏆",
        totalPoints: 2500,
        level: 7,
        levelName: "Health Hero",
        badgeCount: 15,
        currentStreak: 45,
        isCurrentUser: false,
      },
      {
        rank: 2,
        anonymousId: "user-002",
        displayName: "WellnessChamp",
        avatarEmoji: "💪",
        totalPoints: 2100,
        level: 6,
        levelName: "Wellness Expert",
        badgeCount: 12,
        currentStreak: 30,
        isCurrentUser: false,
      },
      {
        rank: 3,
        anonymousId: userId,
        displayName: "You",
        avatarEmoji: "⭐",
        totalPoints: 650,
        level: 4,
        levelName: "Health Champion",
        badgeCount: 3,
        currentStreak: 12,
        isCurrentUser: true,
      },
      {
        rank: 4,
        anonymousId: "user-003",
        displayName: "FitFam2024",
        avatarEmoji: "🌟",
        totalPoints: 580,
        level: 4,
        levelName: "Health Champion",
        badgeCount: 5,
        currentStreak: 8,
        isCurrentUser: false,
      },
      {
        rank: 5,
        anonymousId: "user-004",
        displayName: "HealthyLife",
        avatarEmoji: "🌿",
        totalPoints: 420,
        level: 3,
        levelName: "Wellness Warrior",
        badgeCount: 4,
        currentStreak: 5,
        isCurrentUser: false,
      },
    ];

    const leaderboard: LocalLeaderboardData = {
      period: period as any,
      entries,
      userRank: 3,
      totalParticipants: 156,
      lastUpdatedAt: new Date().toISOString(),
    };

    res.json(leaderboard);
  } catch (error) {
    console.error("[Gamification] Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId } = req.query;

    const activeProgress = Array.from(userChallengeProgress.values())
      .filter(p => p.userId === userId && p.status === "active")
      .filter(p => !profileId || p.profileId === profileId);

    const completedProgress = Array.from(userChallengeProgress.values())
      .filter(p => p.userId === userId && p.status === "completed")
      .filter(p => !profileId || p.profileId === profileId);

    const userAchs = Array.from(userAchievements.values())
      .filter(ua => ua.userId === userId)
      .filter(ua => !profileId || ua.profileId === profileId);

    const streaks = Array.from(userStreaks.values())
      .filter(s => s.userId === userId)
      .filter(s => !profileId || s.profileId === profileId);

    const points = Array.from(userPoints.values())
      .find(p => p.userId === userId && (!profileId || p.profileId === profileId));

    const longestStreak = Math.max(...streaks.map(s => s.currentStreak), 0);

    res.json({
      activeChallenges: activeProgress.length,
      completedChallenges: completedProgress.length,
      totalAchievements: userAchs.length,
      currentStreak: longestStreak,
      points: points?.totalPoints || 0,
      level: points?.level || 1,
      levelName: points?.levelName || "Health Beginner",
    });
  } catch (error) {
    console.error("[Gamification] Get summary error:", error);
    res.status(500).json({ error: "Failed to get gamification summary" });
  }
});

// ============================================
// PERSONALIZED CHALLENGES
// ============================================

interface PersonalizedChallenge extends HealthChallenge {
  conditionBased: boolean;
  targetCondition?: string;
  personalizedReason: string;
}

const conditionChallenges: Record<string, Omit<HealthChallenge, "id" | "createdAt">[]> = {
  diabetes: [
    {
      title: "Blood Sugar Buddy",
      description: "Log your blood sugar readings daily for 7 days",
      category: "medication_adherence",
      difficulty: "easy",
      pointsReward: 100,
      badgeReward: "glucose-guardian",
      goalValue: 7,
      goalUnit: "days",
      durationDays: 10,
      iconName: "activity",
      colorTheme: "blue",
      isSystemChallenge: true,
      isActive: true,
    },
    {
      title: "Carb Counter",
      description: "Track your carbohydrate intake for 5 days",
      category: "nutrition",
      difficulty: "medium",
      pointsReward: 120,
      badgeReward: null,
      goalValue: 5,
      goalUnit: "days",
      durationDays: 7,
      iconName: "utensils",
      colorTheme: "green",
      isSystemChallenge: true,
      isActive: true,
    },
  ],
  hypertension: [
    {
      title: "Pressure Pro",
      description: "Check and log your blood pressure daily for 7 days",
      category: "medication_adherence",
      difficulty: "easy",
      pointsReward: 100,
      badgeReward: "pressure-pro",
      goalValue: 7,
      goalUnit: "days",
      durationDays: 10,
      iconName: "heart-pulse",
      colorTheme: "red",
      isSystemChallenge: true,
      isActive: true,
    },
    {
      title: "Salt Savvy",
      description: "Maintain low sodium meals for 5 days",
      category: "nutrition",
      difficulty: "medium",
      pointsReward: 130,
      badgeReward: null,
      goalValue: 5,
      goalUnit: "days",
      durationDays: 7,
      iconName: "leaf",
      colorTheme: "green",
      isSystemChallenge: true,
      isActive: true,
    },
  ],
  cancer: [
    {
      title: "Symptom Tracker",
      description: "Log your symptoms and side effects daily for 7 days",
      category: "preventive_care",
      difficulty: "easy",
      pointsReward: 150,
      badgeReward: "symptom-champion",
      goalValue: 7,
      goalUnit: "days",
      durationDays: 10,
      iconName: "clipboard-check",
      colorTheme: "purple",
      isSystemChallenge: true,
      isActive: true,
    },
    {
      title: "Nutrition Navigator",
      description: "Follow your recommended nutrition plan for 5 days",
      category: "nutrition",
      difficulty: "medium",
      pointsReward: 140,
      badgeReward: null,
      goalValue: 5,
      goalUnit: "days",
      durationDays: 7,
      iconName: "apple",
      colorTheme: "orange",
      isSystemChallenge: true,
      isActive: true,
    },
  ],
  heart_disease: [
    {
      title: "Heart Health Hero",
      description: "Complete 30 minutes of light cardio 5 times this week",
      category: "exercise",
      difficulty: "medium",
      pointsReward: 150,
      badgeReward: "heart-hero",
      goalValue: 5,
      goalUnit: "sessions",
      durationDays: 7,
      iconName: "heart",
      colorTheme: "red",
      isSystemChallenge: true,
      isActive: true,
    },
  ],
  asthma: [
    {
      title: "Breathing Better",
      description: "Use your peak flow meter and log results for 7 days",
      category: "medication_adherence",
      difficulty: "easy",
      pointsReward: 100,
      badgeReward: "breath-master",
      goalValue: 7,
      goalUnit: "days",
      durationDays: 10,
      iconName: "wind",
      colorTheme: "cyan",
      isSystemChallenge: true,
      isActive: true,
    },
  ],
};

router.get("/personalized-challenges", async (req: Request, res: Response) => {
  try {
    const { conditions, medications, profileId } = req.query;
    const now = new Date().toISOString();

    const patientConditions = conditions 
      ? (conditions as string).split(",").map(c => c.trim().toLowerCase())
      : ["general"];

    const personalizedChallenges: PersonalizedChallenge[] = [];

    // Add condition-specific challenges
    patientConditions.forEach(condition => {
      const challenges = conditionChallenges[condition];
      if (challenges) {
        challenges.forEach((challenge, idx) => {
          personalizedChallenges.push({
            ...challenge,
            id: `personalized-${condition}-${idx}-${Date.now()}`,
            createdAt: now,
            conditionBased: true,
            targetCondition: condition,
            personalizedReason: `Recommended based on your ${condition.replace("_", " ")} management plan`,
          });
        });
      }
    });

    // Add medication adherence challenge if medications are provided
    if (medications) {
      personalizedChallenges.push({
        id: `personalized-med-${Date.now()}`,
        title: "Medication Champion",
        description: "Take all your prescribed medications on time for 7 days",
        category: "medication_adherence",
        difficulty: "easy",
        pointsReward: 120,
        badgeReward: "med-master",
        goalValue: 7,
        goalUnit: "days",
        durationDays: 10,
        iconName: "pill",
        colorTheme: "blue",
        isSystemChallenge: true,
        isActive: true,
        createdAt: now,
        conditionBased: true,
        targetCondition: "medications",
        personalizedReason: "Personalized to help you stay on track with your medications",
      });
    }

    // Always include some general wellness challenges
    const generalChallenges: PersonalizedChallenge[] = [
      {
        id: `personalized-general-1-${Date.now()}`,
        title: "Hydration Hero",
        description: "Drink 8 glasses of water daily for 5 days",
        category: "hydration",
        difficulty: "easy",
        pointsReward: 75,
        badgeReward: null,
        goalValue: 5,
        goalUnit: "days",
        durationDays: 7,
        iconName: "droplet",
        colorTheme: "cyan",
        isSystemChallenge: true,
        isActive: true,
        createdAt: now,
        conditionBased: false,
        personalizedReason: "General wellness challenge for everyone",
      },
      {
        id: `personalized-general-2-${Date.now()}`,
        title: "Sleep Well",
        description: "Get 7+ hours of sleep for 5 nights",
        category: "sleep",
        difficulty: "medium",
        pointsReward: 100,
        badgeReward: "sleep-star",
        goalValue: 5,
        goalUnit: "nights",
        durationDays: 7,
        iconName: "moon",
        colorTheme: "indigo",
        isSystemChallenge: true,
        isActive: true,
        createdAt: now,
        conditionBased: false,
        personalizedReason: "Good sleep supports your overall health",
      },
      {
        id: `personalized-general-3-${Date.now()}`,
        title: "Learn Something New",
        description: "Complete 3 health education modules",
        category: "preventive_care",
        difficulty: "easy",
        pointsReward: 90,
        badgeReward: "health-scholar",
        goalValue: 3,
        goalUnit: "modules",
        durationDays: 14,
        iconName: "book-open",
        colorTheme: "amber",
        isSystemChallenge: true,
        isActive: true,
        createdAt: now,
        conditionBased: false,
        personalizedReason: "Boost your health knowledge",
      },
    ];

    const allChallenges = [...personalizedChallenges, ...generalChallenges];

    // Store personalized challenges in the healthChallenges map so they can be joined
    allChallenges.forEach(challenge => {
      const baseChallenge: HealthChallenge = {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        category: challenge.category as any,
        difficulty: challenge.difficulty as any,
        pointsReward: challenge.pointsReward,
        badgeReward: challenge.badgeReward,
        goalValue: challenge.goalValue,
        goalUnit: challenge.goalUnit,
        durationDays: challenge.durationDays,
        iconName: challenge.iconName,
        colorTheme: challenge.colorTheme,
        isSystemChallenge: true,
        isActive: true,
        createdAt: challenge.createdAt,
      };
      healthChallenges.set(challenge.id, baseChallenge);
    });

    res.json({
      data: allChallenges,
      meta: {
        totalChallenges: allChallenges.length,
        conditionBasedCount: personalizedChallenges.length,
        generalCount: generalChallenges.length,
        generatedAt: now,
      },
    });
  } catch (error) {
    console.error("[Gamification] Personalized challenges error:", error);
    res.status(500).json({ error: "Failed to generate personalized challenges" });
  }
});

// ============================================
// REWARDS CATALOG & REDEMPTION
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
  expiresAt: string | null;
  partnerName?: string;
  termsAndConditions?: string;
}

interface RewardRedemption {
  id: string;
  userId: string;
  profileId: string;
  rewardId: string;
  reward: Reward;
  pointsSpent: number;
  redeemedAt: string;
  status: "pending" | "fulfilled" | "expired" | "cancelled";
  redemptionCode?: string;
  expiresAt?: string;
}

const rewardsCatalog: Reward[] = [
  {
    id: "reward-001",
    name: "Health Tracker Premium (1 Month)",
    description: "Unlock premium features for our health tracking tools for one month",
    category: "digital",
    pointsCost: 500,
    imageUrl: null,
    iconName: "smartphone",
    isAvailable: true,
    stockQuantity: null,
    expiresAt: null,
  },
  {
    id: "reward-002",
    name: "Wellness Gift Card ($10)",
    description: "Use toward healthy groceries, supplements, or wellness products",
    category: "wellness",
    pointsCost: 1000,
    imageUrl: null,
    iconName: "gift",
    isAvailable: true,
    stockQuantity: 50,
    expiresAt: null,
    partnerName: "Wellness Partners",
    termsAndConditions: "Valid for 6 months from redemption date",
  },
  {
    id: "reward-003",
    name: "Meditation App Subscription (3 Months)",
    description: "Access guided meditations and mindfulness exercises",
    category: "wellness",
    pointsCost: 750,
    imageUrl: null,
    iconName: "brain",
    isAvailable: true,
    stockQuantity: null,
    expiresAt: null,
    partnerName: "Mindful Living",
  },
  {
    id: "reward-004",
    name: "Fitness Class Pass (5 Classes)",
    description: "Try yoga, pilates, or other fitness classes at participating gyms",
    category: "health",
    pointsCost: 1500,
    imageUrl: null,
    iconName: "dumbbell",
    isAvailable: true,
    stockQuantity: 25,
    expiresAt: null,
    partnerName: "FitPass Network",
    termsAndConditions: "Must be used within 90 days",
  },
  {
    id: "reward-005",
    name: "Healthy Recipe E-Book",
    description: "Collection of 50+ nutritious recipes for better health",
    category: "digital",
    pointsCost: 200,
    imageUrl: null,
    iconName: "book",
    isAvailable: true,
    stockQuantity: null,
    expiresAt: null,
  },
  {
    id: "reward-006",
    name: "Donate to Health Charity",
    description: "We'll donate $5 to a health charity of your choice in your name",
    category: "donation",
    pointsCost: 300,
    imageUrl: null,
    iconName: "heart-handshake",
    isAvailable: true,
    stockQuantity: null,
    expiresAt: null,
  },
  {
    id: "reward-007",
    name: "Custom Health Report",
    description: "Get a personalized PDF summary of your health progress and achievements",
    category: "digital",
    pointsCost: 150,
    imageUrl: null,
    iconName: "file-text",
    isAvailable: true,
    stockQuantity: null,
    expiresAt: null,
  },
  {
    id: "reward-008",
    name: "Water Bottle with Tracker",
    description: "Smart water bottle that helps you track hydration",
    category: "health",
    pointsCost: 2000,
    imageUrl: null,
    iconName: "bottle",
    isAvailable: true,
    stockQuantity: 10,
    expiresAt: null,
    partnerName: "HydroTrack",
    termsAndConditions: "Shipping within US only",
  },
];

const userRedemptions = new Map<string, RewardRedemption>();

router.get("/rewards", async (req: Request, res: Response) => {
  try {
    const { category, minPoints, maxPoints, available } = req.query;

    let rewards = [...rewardsCatalog];

    if (category) {
      rewards = rewards.filter(r => r.category === category);
    }
    if (minPoints) {
      rewards = rewards.filter(r => r.pointsCost >= parseInt(minPoints as string));
    }
    if (maxPoints) {
      rewards = rewards.filter(r => r.pointsCost <= parseInt(maxPoints as string));
    }
    if (available === "true") {
      rewards = rewards.filter(r => r.isAvailable && (r.stockQuantity === null || r.stockQuantity > 0));
    }

    res.json({
      data: rewards,
      meta: {
        totalRewards: rewards.length,
        categories: Array.from(new Set(rewardsCatalog.map(r => r.category))),
      },
    });
  } catch (error) {
    console.error("[Gamification] Get rewards error:", error);
    res.status(500).json({ error: "Failed to get rewards" });
  }
});

router.get("/rewards/:rewardId", async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;
    const reward = rewardsCatalog.find(r => r.id === rewardId);

    if (!reward) {
      res.status(404).json({ error: "Reward not found" });
      return;
    }

    res.json(reward);
  } catch (error) {
    console.error("[Gamification] Get reward error:", error);
    res.status(500).json({ error: "Failed to get reward" });
  }
});

router.post("/rewards/:rewardId/redeem", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { rewardId } = req.params;
    const { profileId = "profile-self-001" } = req.body;

    const reward = rewardsCatalog.find(r => r.id === rewardId);
    if (!reward) {
      res.status(404).json({ error: "Reward not found" });
      return;
    }

    if (!reward.isAvailable) {
      res.status(400).json({ error: "This reward is no longer available" });
      return;
    }

    if (reward.stockQuantity !== null && reward.stockQuantity <= 0) {
      res.status(400).json({ error: "This reward is out of stock" });
      return;
    }

    // Check user points
    const userPointsEntry = Array.from(userPoints.values())
      .find(p => p.userId === userId && p.profileId === profileId);

    const currentPoints = userPointsEntry?.currentPoints || 350;

    if (currentPoints < reward.pointsCost) {
      res.status(400).json({ 
        error: "Insufficient points",
        required: reward.pointsCost,
        available: currentPoints,
      });
      return;
    }

    // Deduct points
    if (userPointsEntry) {
      userPointsEntry.currentPoints -= reward.pointsCost;
      userPointsEntry.updatedAt = new Date().toISOString();
      userPoints.set(userPointsEntry.id, userPointsEntry);
    }

    // Decrease stock if applicable
    if (reward.stockQuantity !== null) {
      reward.stockQuantity--;
    }

    // Create redemption record
    const redemption: RewardRedemption = {
      id: generateId(),
      userId,
      profileId,
      rewardId: reward.id,
      reward,
      pointsSpent: reward.pointsCost,
      redeemedAt: new Date().toISOString(),
      status: "pending",
      redemptionCode: `RDM-${Date.now().toString(36).toUpperCase()}`,
      expiresAt: reward.category === "digital" ? undefined : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    userRedemptions.set(redemption.id, redemption);

    // Record transaction
    const transaction: LocalPointTransaction = {
      id: generateId(),
      userId,
      profileId,
      amount: -reward.pointsCost,
      transactionType: "spent",
      source: "reward_redemption",
      sourceId: reward.id,
      description: `Redeemed: ${reward.name}`,
      createdAt: new Date().toISOString(),
    };
    pointTransactions.set(transaction.id, transaction);

    res.status(201).json({
      success: true,
      redemption,
      remainingPoints: currentPoints - reward.pointsCost,
      message: `Successfully redeemed ${reward.name}!`,
    });
  } catch (error) {
    console.error("[Gamification] Redeem reward error:", error);
    res.status(500).json({ error: "Failed to redeem reward" });
  }
});

router.get("/redemptions", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const { profileId, status } = req.query;

    let redemptions = Array.from(userRedemptions.values())
      .filter(r => r.userId === userId);

    if (profileId) {
      redemptions = redemptions.filter(r => r.profileId === profileId);
    }
    if (status) {
      redemptions = redemptions.filter(r => r.status === status);
    }

    // Sort by most recent
    redemptions.sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());

    res.json({
      data: redemptions,
      meta: {
        totalRedemptions: redemptions.length,
        totalPointsSpent: redemptions.reduce((sum, r) => sum + r.pointsSpent, 0),
      },
    });
  } catch (error) {
    console.error("[Gamification] Get redemptions error:", error);
    res.status(500).json({ error: "Failed to get redemptions" });
  }
});

export function registerGamificationRoutes(app: any) {
  app.use("/api/gamification", router);
  console.log("[Routes] Gamification routes registered at /api/gamification/*");
  console.log("[Routes] - Personalized challenges at /api/gamification/personalized-challenges");
  console.log("[Routes] - Rewards catalog at /api/gamification/rewards");
}

export default router;
