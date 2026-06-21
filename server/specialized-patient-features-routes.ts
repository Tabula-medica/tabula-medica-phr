import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

interface HealthGoal {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "nutrition" | "sleep" | "mental_health" | "vitals" | "custom";
  targetValue: number;
  currentValue: number;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  startDate: string;
  targetDate: string;
  status: "active" | "completed" | "paused" | "abandoned";
  milestones: GoalMilestone[];
  reminders: boolean;
  reminderTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface GoalMilestone {
  id: string;
  percentage: number;
  reached: boolean;
  reachedAt?: string;
  reward?: string;
}

interface SymptomEntry {
  id: string;
  userId: string;
  profileId: string;
  date: string;
  symptoms: SymptomRecord[];
  mood: number;
  energyLevel: number;
  sleepQuality: number;
  notes: string;
  triggers: string[];
  medications: string[];
  createdAt: string;
}

interface SymptomRecord {
  name: string;
  severity: number;
  duration: string;
  location?: string;
  frequency: string;
}

interface SymptomPattern {
  symptom: string;
  avgSeverity: number;
  frequency: number;
  commonTriggers: string[];
  correlatedSymptoms: string[];
  trend: "improving" | "stable" | "worsening";
}

interface MedicationReminder {
  id: string;
  userId: string;
  profileId: string;
  medicationName: string;
  dosage: string;
  frequency: "once_daily" | "twice_daily" | "three_times" | "four_times" | "as_needed" | "weekly";
  times: string[];
  startDate: string;
  endDate?: string;
  refillDate?: string;
  refillReminder: boolean;
  pillCount?: number;
  pillsPerDose: number;
  pharmacy?: string;
  prescriber?: string;
  instructions: string;
  isActive: boolean;
  adherenceRate: number;
  takenLog: MedicationTakenLog[];
  createdAt: string;
}

interface MedicationTakenLog {
  id: string;
  date: string;
  scheduledTime: string;
  takenTime?: string;
  status: "taken" | "missed" | "skipped" | "late";
  notes?: string;
}

interface HealthTimelineEvent {
  id: string;
  userId: string;
  profileId: string;
  date: string;
  eventType: "diagnosis" | "procedure" | "medication" | "lab_result" | "vaccination" | "hospitalization" | "appointment" | "milestone" | "symptom_onset" | "recovery";
  title: string;
  description: string;
  provider?: string;
  location?: string;
  severity?: "low" | "medium" | "high";
  relatedConditions: string[];
  documents: string[];
  isMilestone: boolean;
  createdAt: string;
}

interface FamilyMember {
  id: string;
  userId: string;
  relationship: "mother" | "father" | "sibling" | "grandparent" | "aunt_uncle" | "cousin" | "child" | "other";
  name?: string;
  birthYear?: number;
  deathYear?: number;
  isAlive: boolean;
  conditions: FamilyCondition[];
  notes: string;
  createdAt: string;
}

interface FamilyCondition {
  id: string;
  conditionName: string;
  ageAtDiagnosis?: number;
  severity?: "mild" | "moderate" | "severe";
  isHereditary: boolean;
  notes?: string;
}

interface RiskFactor {
  condition: string;
  riskLevel: "low" | "moderate" | "high";
  affectedRelatives: number;
  recommendations: string[];
}

interface EmergencyCard {
  id: string;
  userId: string;
  profileId: string;
  fullName: string;
  dateOfBirth: string;
  bloodType?: string;
  allergies: string[];
  currentMedications: EmergencyMedication[];
  conditions: string[];
  emergencyContacts: EmergencyContact[];
  primaryPhysician?: {
    name: string;
    phone: string;
  };
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
  };
  specialInstructions: string;
  dnrStatus?: boolean;
  organDonor?: boolean;
  lastUpdated: string;
}

interface EmergencyMedication {
  name: string;
  dosage: string;
  frequency: string;
  critical: boolean;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

interface HealthChallenge {
  id: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "nutrition" | "sleep" | "mental_health" | "hydration" | "steps";
  difficulty: "easy" | "medium" | "hard";
  duration: number;
  targetValue: number;
  unit: string;
  pointsReward: number;
  badgeReward?: string;
  isCustom: boolean;
  createdBy?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  participants: number;
  createdAt: string;
}

interface UserChallengeProgress {
  id: string;
  challengeId: string;
  userId: string;
  profileId: string;
  currentValue: number;
  status: "active" | "completed" | "failed" | "abandoned";
  startedAt: string;
  completedAt?: string;
  dailyProgress: DailyProgress[];
}

interface DailyProgress {
  date: string;
  value: number;
  notes?: string;
}

interface LeaderboardEntry {
  rank: number;
  anonymousId: string;
  displayName: string;
  points: number;
  challengesCompleted: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  requirement: string;
  pointsValue: number;
}

interface UserBadge {
  id: string;
  badgeId: string;
  userId: string;
  earnedAt: string;
  challengeId?: string;
}

const healthGoals = new Map<string, HealthGoal>();
const symptomEntries = new Map<string, SymptomEntry>();
const medicationReminders = new Map<string, MedicationReminder>();
const healthTimelineEvents = new Map<string, HealthTimelineEvent>();
const familyMembers = new Map<string, FamilyMember>();
const emergencyCards = new Map<string, EmergencyCard>();
const healthChallenges = new Map<string, HealthChallenge>();
const userChallengeProgress = new Map<string, UserChallengeProgress>();
const userBadges = new Map<string, UserBadge>();

function generateId(): string {
  return randomUUID();
}

function initializeSampleData() {
  const sampleChallenges: HealthChallenge[] = [
    {
      id: "challenge-1",
      title: "7-Day Medication Streak",
      description: "Take all your medications on time for 7 consecutive days",
      category: "medication",
      difficulty: "easy",
      duration: 7,
      targetValue: 7,
      unit: "days",
      pointsReward: 100,
      badgeReward: "badge-med-streak",
      isCustom: false,
      isActive: true,
      participants: 156,
      createdAt: new Date().toISOString(),
    },
    {
      id: "challenge-2",
      title: "10K Steps Daily",
      description: "Walk 10,000 steps every day for 2 weeks",
      category: "steps",
      difficulty: "medium",
      duration: 14,
      targetValue: 140000,
      unit: "steps",
      pointsReward: 250,
      badgeReward: "badge-step-master",
      isCustom: false,
      isActive: true,
      participants: 89,
      createdAt: new Date().toISOString(),
    },
    {
      id: "challenge-3",
      title: "Hydration Hero",
      description: "Drink 8 glasses of water daily for 30 days",
      category: "hydration",
      difficulty: "medium",
      duration: 30,
      targetValue: 240,
      unit: "glasses",
      pointsReward: 300,
      badgeReward: "badge-hydration-hero",
      isCustom: false,
      isActive: true,
      participants: 234,
      createdAt: new Date().toISOString(),
    },
    {
      id: "challenge-4",
      title: "Mindfulness Month",
      description: "Complete 10 minutes of meditation daily for 30 days",
      category: "mental_health",
      difficulty: "hard",
      duration: 30,
      targetValue: 300,
      unit: "minutes",
      pointsReward: 500,
      badgeReward: "badge-zen-master",
      isCustom: false,
      isActive: true,
      participants: 67,
      createdAt: new Date().toISOString(),
    },
    {
      id: "challenge-5",
      title: "Sleep Champion",
      description: "Get 7-9 hours of sleep for 14 consecutive nights",
      category: "sleep",
      difficulty: "medium",
      duration: 14,
      targetValue: 14,
      unit: "nights",
      pointsReward: 200,
      isCustom: false,
      isActive: true,
      participants: 145,
      createdAt: new Date().toISOString(),
    },
  ];

  sampleChallenges.forEach(c => healthChallenges.set(c.id, c));

  const sampleBadges: Badge[] = [
    { id: "badge-first-goal", name: "Goal Setter", description: "Created your first health goal", icon: "target", rarity: "common", requirement: "Create 1 goal", pointsValue: 10 },
    { id: "badge-med-streak", name: "Medication Master", description: "7-day medication streak", icon: "pill", rarity: "uncommon", requirement: "7-day streak", pointsValue: 50 },
    { id: "badge-step-master", name: "Step Champion", description: "Completed 10K steps challenge", icon: "footprints", rarity: "rare", requirement: "Complete steps challenge", pointsValue: 100 },
    { id: "badge-hydration-hero", name: "Hydration Hero", description: "30-day hydration challenge", icon: "droplet", rarity: "rare", requirement: "Complete hydration challenge", pointsValue: 100 },
    { id: "badge-zen-master", name: "Zen Master", description: "30-day mindfulness challenge", icon: "brain", rarity: "epic", requirement: "Complete mindfulness challenge", pointsValue: 150 },
    { id: "badge-symptom-tracker", name: "Symptom Tracker", description: "Logged symptoms for 30 days", icon: "clipboard", rarity: "uncommon", requirement: "30 symptom logs", pointsValue: 75 },
    { id: "badge-family-historian", name: "Family Historian", description: "Documented complete family health history", icon: "users", rarity: "rare", requirement: "Add 5 family members", pointsValue: 100 },
    { id: "badge-emergency-ready", name: "Emergency Ready", description: "Completed emergency health card", icon: "heart", rarity: "common", requirement: "Complete emergency card", pointsValue: 25 },
  ];
}

initializeSampleData();

router.get("/goals", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "health_goals",
      resourceId: "all",
      details: "Viewed health goals list",
    });

    const goals = Array.from(healthGoals.values())
      .filter(g => g.userId === userId && g.profileId === profileId);

    res.json({
      success: true,
      data: goals,
      summary: {
        total: goals.length,
        active: goals.filter(g => g.status === "active").length,
        completed: goals.filter(g => g.status === "completed").length,
        avgProgress: goals.length > 0 
          ? Math.round(goals.reduce((acc, g) => acc + (g.currentValue / g.targetValue * 100), 0) / goals.length)
          : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch goals" });
  }
});

router.post("/goals", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { title, description, category, targetValue, unit, frequency, targetDate, reminders, reminderTime, profileId } = req.body;

    const goal: HealthGoal = {
      id: generateId(),
      userId,
      profileId: profileId || "default",
      title,
      description,
      category,
      targetValue,
      currentValue: 0,
      unit,
      frequency,
      startDate: new Date().toISOString(),
      targetDate,
      status: "active",
      milestones: [
        { id: generateId(), percentage: 25, reached: false, reward: "25 points" },
        { id: generateId(), percentage: 50, reached: false, reward: "50 points" },
        { id: generateId(), percentage: 75, reached: false, reward: "75 points" },
        { id: generateId(), percentage: 100, reached: false, reward: "100 points + badge" },
      ],
      reminders,
      reminderTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    healthGoals.set(goal.id, goal);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "health_goal",
      resourceId: goal.id,
      details: `Created health goal: ${title}`,
    });

    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create goal" });
  }
});

router.patch("/goals/:goalId/progress", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { goalId } = req.params;
    const { value, notes } = req.body;

    const goal = healthGoals.get(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, error: "Goal not found" });
    }

    goal.currentValue = Math.min(value, goal.targetValue);
    goal.updatedAt = new Date().toISOString();

    const progress = (goal.currentValue / goal.targetValue) * 100;
    goal.milestones.forEach(m => {
      if (progress >= m.percentage && !m.reached) {
        m.reached = true;
        m.reachedAt = new Date().toISOString();
      }
    });

    if (goal.currentValue >= goal.targetValue) {
      goal.status = "completed";
    }

    healthGoals.set(goalId, goal);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "health_goal",
      resourceId: goalId,
      details: `Updated goal progress: ${goal.currentValue}/${goal.targetValue}`,
    });

    res.json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update progress" });
  }
});

router.get("/symptoms", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "symptom_journal",
      resourceId: "all",
      details: "Viewed symptom journal entries",
    });

    let entries = Array.from(symptomEntries.values())
      .filter(e => e.userId === userId && e.profileId === profileId);

    if (startDate) {
      entries = entries.filter(e => new Date(e.date) >= new Date(startDate));
    }
    if (endDate) {
      entries = entries.filter(e => new Date(e.date) <= new Date(endDate));
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch symptoms" });
  }
});

router.post("/symptoms", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { symptoms, mood, energyLevel, sleepQuality, notes, triggers, medications, profileId, date } = req.body;

    const entry: SymptomEntry = {
      id: generateId(),
      userId,
      profileId: profileId || "default",
      date: date || new Date().toISOString().split("T")[0],
      symptoms,
      mood,
      energyLevel,
      sleepQuality,
      notes,
      triggers: triggers || [],
      medications: medications || [],
      createdAt: new Date().toISOString(),
    };

    symptomEntries.set(entry.id, entry);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "symptom_entry",
      resourceId: entry.id,
      details: `Logged ${symptoms.length} symptoms`,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to log symptoms" });
  }
});

router.get("/symptoms/patterns", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "symptom_patterns",
      resourceId: "analysis",
      details: "Viewed AI symptom pattern analysis",
    });

    const entries = Array.from(symptomEntries.values())
      .filter(e => e.userId === userId && e.profileId === profileId);

    const symptomMap = new Map<string, { severities: number[], triggers: string[], dates: string[] }>();
    
    entries.forEach(entry => {
      entry.symptoms.forEach(s => {
        const existing = symptomMap.get(s.name) || { severities: [], triggers: [], dates: [] };
        existing.severities.push(s.severity);
        existing.triggers.push(...entry.triggers);
        existing.dates.push(entry.date);
        symptomMap.set(s.name, existing);
      });
    });

    const patterns: SymptomPattern[] = Array.from(symptomMap.entries()).map(([symptom, data]) => {
      const avgSeverity = data.severities.reduce((a, b) => a + b, 0) / data.severities.length;
      const triggerCounts = new Map<string, number>();
      data.triggers.forEach(t => triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1));
      const commonTriggers = Array.from(triggerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);

      const recentAvg = data.severities.slice(-7).reduce((a, b) => a + b, 0) / Math.min(data.severities.length, 7);
      const olderAvg = data.severities.slice(0, -7).reduce((a, b) => a + b, 0) / Math.max(data.severities.length - 7, 1);
      
      let trend: "improving" | "stable" | "worsening" = "stable";
      if (recentAvg < olderAvg - 0.5) trend = "improving";
      else if (recentAvg > olderAvg + 0.5) trend = "worsening";

      return {
        symptom,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        frequency: data.dates.length,
        commonTriggers,
        correlatedSymptoms: [],
        trend,
      };
    });

    res.json({
      success: true,
      data: patterns,
      insights: [
        "Track your symptoms consistently to identify patterns",
        "Note any triggers that seem to worsen symptoms",
        "Share this data with your healthcare provider",
      ],
      disclaimer: "This analysis is for informational purposes only and does not constitute medical advice.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to analyze patterns" });
  }
});

router.get("/medications/reminders", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "medication_reminders",
      resourceId: "all",
      details: "Viewed medication reminders",
    });

    const reminders = Array.from(medicationReminders.values())
      .filter(m => m.userId === userId && m.profileId === profileId && m.isActive);

    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch reminders" });
  }
});

router.post("/medications/reminders", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { medicationName, dosage, frequency, times, refillDate, refillReminder, pillCount, pillsPerDose, pharmacy, prescriber, instructions, profileId } = req.body;

    const reminder: MedicationReminder = {
      id: generateId(),
      userId,
      profileId: profileId || "default",
      medicationName,
      dosage,
      frequency,
      times,
      startDate: new Date().toISOString(),
      refillDate,
      refillReminder: refillReminder || false,
      pillCount,
      pillsPerDose: pillsPerDose || 1,
      pharmacy,
      prescriber,
      instructions: instructions || "",
      isActive: true,
      adherenceRate: 100,
      takenLog: [],
      createdAt: new Date().toISOString(),
    };

    medicationReminders.set(reminder.id, reminder);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "medication_reminder",
      resourceId: reminder.id,
      details: `Created reminder for ${medicationName}`,
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create reminder" });
  }
});

router.post("/medications/reminders/:reminderId/log", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { reminderId } = req.params;
    const { status, scheduledTime, notes } = req.body;

    const reminder = medicationReminders.get(reminderId);
    if (!reminder) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }

    const log: MedicationTakenLog = {
      id: generateId(),
      date: new Date().toISOString().split("T")[0],
      scheduledTime,
      takenTime: status === "taken" || status === "late" ? new Date().toISOString() : undefined,
      status,
      notes,
    };

    reminder.takenLog.push(log);
    
    const takenCount = reminder.takenLog.filter(l => l.status === "taken" || l.status === "late").length;
    reminder.adherenceRate = Math.round((takenCount / reminder.takenLog.length) * 100);

    if (reminder.pillCount && (status === "taken" || status === "late")) {
      reminder.pillCount -= reminder.pillsPerDose;
    }

    medicationReminders.set(reminderId, reminder);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "medication_log",
      resourceId: reminderId,
      details: `Logged medication: ${status}`,
    });

    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to log medication" });
  }
});

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";
    const eventType = req.query.eventType as string;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "health_timeline",
      resourceId: "all",
      details: "Viewed health timeline",
    });

    let events = Array.from(healthTimelineEvents.values())
      .filter(e => e.userId === userId && e.profileId === profileId);

    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch timeline" });
  }
});

router.post("/timeline", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { date, eventType, title, description, provider, location, severity, relatedConditions, isMilestone, profileId } = req.body;

    const event: HealthTimelineEvent = {
      id: generateId(),
      userId,
      profileId: profileId || "default",
      date,
      eventType,
      title,
      description,
      provider,
      location,
      severity,
      relatedConditions: relatedConditions || [],
      documents: [],
      isMilestone: isMilestone || false,
      createdAt: new Date().toISOString(),
    };

    healthTimelineEvents.set(event.id, event);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "timeline_event",
      resourceId: event.id,
      details: `Added timeline event: ${title}`,
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to add timeline event" });
  }
});

router.get("/family-history", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "family_history",
      resourceId: "all",
      details: "Viewed family health history",
    });

    const members = Array.from(familyMembers.values())
      .filter(m => m.userId === userId);

    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch family history" });
  }
});

router.post("/family-history", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { relationship, name, birthYear, deathYear, isAlive, conditions, notes } = req.body;

    const member: FamilyMember = {
      id: generateId(),
      userId,
      relationship,
      name,
      birthYear,
      deathYear,
      isAlive: isAlive !== false,
      conditions: conditions || [],
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    familyMembers.set(member.id, member);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "family_member",
      resourceId: member.id,
      details: `Added family member: ${relationship}`,
    });

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to add family member" });
  }
});

router.get("/family-history/risks", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "family_risk_analysis",
      resourceId: "analysis",
      details: "Viewed hereditary risk analysis",
    });

    const members = Array.from(familyMembers.values())
      .filter(m => m.userId === userId);

    const conditionCounts = new Map<string, { count: number, isHereditary: boolean[] }>();
    
    members.forEach(member => {
      member.conditions.forEach(c => {
        const existing = conditionCounts.get(c.conditionName) || { count: 0, isHereditary: [] };
        existing.count++;
        existing.isHereditary.push(c.isHereditary);
        conditionCounts.set(c.conditionName, existing);
      });
    });

    const risks: RiskFactor[] = Array.from(conditionCounts.entries())
      .filter(([_, data]) => data.count >= 1)
      .map(([condition, data]) => {
        let riskLevel: "low" | "moderate" | "high" = "low";
        if (data.count >= 3 || data.isHereditary.some(h => h)) riskLevel = "high";
        else if (data.count >= 2) riskLevel = "moderate";

        return {
          condition,
          riskLevel,
          affectedRelatives: data.count,
          recommendations: [
            "Discuss with your healthcare provider",
            "Consider genetic counseling if appropriate",
            "Maintain regular screenings",
          ],
        };
      })
      .sort((a, b) => {
        const order = { high: 0, moderate: 1, low: 2 };
        return order[a.riskLevel] - order[b.riskLevel];
      });

    res.json({
      success: true,
      data: risks,
      disclaimer: "This analysis is for informational purposes only. Please consult a healthcare provider or genetic counselor for personalized risk assessment.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to analyze risks" });
  }
});

router.get("/emergency-card", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "emergency_card",
      resourceId: profileId,
      details: "Viewed emergency health card",
    });

    const card = Array.from(emergencyCards.values())
      .find(c => c.userId === userId && c.profileId === profileId);

    res.json({ success: true, data: card || null });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch emergency card" });
  }
});

router.post("/emergency-card", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { fullName, dateOfBirth, bloodType, allergies, currentMedications, conditions, emergencyContacts, primaryPhysician, insuranceInfo, specialInstructions, dnrStatus, organDonor, profileId } = req.body;

    const existingCard = Array.from(emergencyCards.values())
      .find(c => c.userId === userId && c.profileId === (profileId || "default"));

    const card: EmergencyCard = {
      id: existingCard?.id || generateId(),
      userId,
      profileId: profileId || "default",
      fullName,
      dateOfBirth,
      bloodType,
      allergies: allergies || [],
      currentMedications: currentMedications || [],
      conditions: conditions || [],
      emergencyContacts: emergencyContacts || [],
      primaryPhysician,
      insuranceInfo,
      specialInstructions: specialInstructions || "",
      dnrStatus,
      organDonor,
      lastUpdated: new Date().toISOString(),
    };

    emergencyCards.set(card.id, card);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "emergency_card",
      resourceId: card.id,
      details: existingCard ? "Updated emergency card" : "Created emergency card",
    });

    res.status(existingCard ? 200 : 201).json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to save emergency card" });
  }
});

router.get("/challenges", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const category = req.query.category as string;
    const difficulty = req.query.difficulty as string;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "health_challenges",
      resourceId: "all",
      details: "Viewed available health challenges",
    });

    let challenges = Array.from(healthChallenges.values()).filter(c => c.isActive);

    if (category) {
      challenges = challenges.filter(c => c.category === category);
    }
    if (difficulty) {
      challenges = challenges.filter(c => c.difficulty === difficulty);
    }

    res.json({ success: true, data: challenges });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch challenges" });
  }
});

router.post("/challenges", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { title, description, category, difficulty, duration, targetValue, unit, pointsReward } = req.body;

    const challenge: HealthChallenge = {
      id: generateId(),
      title,
      description,
      category,
      difficulty,
      duration,
      targetValue,
      unit,
      pointsReward,
      isCustom: true,
      createdBy: userId,
      isActive: true,
      participants: 1,
      createdAt: new Date().toISOString(),
    };

    healthChallenges.set(challenge.id, challenge);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "custom_challenge",
      resourceId: challenge.id,
      details: `Created custom challenge: ${title}`,
    });

    res.status(201).json({ success: true, data: challenge });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create challenge" });
  }
});

router.post("/challenges/:challengeId/join", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { challengeId } = req.params;
    const profileId = req.body.profileId || "default";

    const challenge = healthChallenges.get(challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, error: "Challenge not found" });
    }

    const existingProgress = Array.from(userChallengeProgress.values())
      .find(p => p.challengeId === challengeId && p.userId === userId && p.status === "active");

    if (existingProgress) {
      return res.status(400).json({ success: false, error: "Already joined this challenge" });
    }

    const progress: UserChallengeProgress = {
      id: generateId(),
      challengeId,
      userId,
      profileId,
      currentValue: 0,
      status: "active",
      startedAt: new Date().toISOString(),
      dailyProgress: [],
    };

    userChallengeProgress.set(progress.id, progress);
    challenge.participants++;
    healthChallenges.set(challengeId, challenge);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "challenge_progress",
      resourceId: progress.id,
      details: `Joined challenge: ${challenge.title}`,
    });

    res.status(201).json({ success: true, data: progress, challenge });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to join challenge" });
  }
});

router.patch("/challenges/:challengeId/progress", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { challengeId } = req.params;
    const { value, notes } = req.body;

    const progress = Array.from(userChallengeProgress.values())
      .find(p => p.challengeId === challengeId && p.userId === userId && p.status === "active");

    if (!progress) {
      return res.status(404).json({ success: false, error: "Not enrolled in this challenge" });
    }

    const challenge = healthChallenges.get(challengeId);

    progress.currentValue += value;
    progress.dailyProgress.push({
      date: new Date().toISOString().split("T")[0],
      value,
      notes,
    });

    if (challenge && progress.currentValue >= challenge.targetValue) {
      progress.status = "completed";
      progress.completedAt = new Date().toISOString();

      if (challenge.badgeReward) {
        const badge: UserBadge = {
          id: generateId(),
          badgeId: challenge.badgeReward,
          userId,
          earnedAt: new Date().toISOString(),
          challengeId,
        };
        userBadges.set(badge.id, badge);
      }
    }

    userChallengeProgress.set(progress.id, progress);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "challenge_progress",
      resourceId: progress.id,
      details: `Updated challenge progress: +${value}`,
    });

    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update progress" });
  }
});

router.get("/challenges/my-progress", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "my_challenge_progress",
      resourceId: "all",
      details: "Viewed personal challenge progress",
    });

    const myProgress = Array.from(userChallengeProgress.values())
      .filter(p => p.userId === userId);

    const progressWithChallenges = myProgress.map(p => ({
      ...p,
      challenge: healthChallenges.get(p.challengeId),
    }));

    res.json({ success: true, data: progressWithChallenges });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch progress" });
  }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const period = req.query.period as string || "weekly";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "leaderboard",
      resourceId: period,
      details: `Viewed ${period} leaderboard`,
    });

    const mockLeaderboard: LeaderboardEntry[] = [
      { rank: 1, anonymousId: "user-1", displayName: "HealthHero42", points: 2450, challengesCompleted: 12, currentStreak: 21, isCurrentUser: false },
      { rank: 2, anonymousId: "user-2", displayName: "WellnessWin", points: 2180, challengesCompleted: 10, currentStreak: 14, isCurrentUser: false },
      { rank: 3, anonymousId: "user-3", displayName: "FitFighter", points: 1920, challengesCompleted: 9, currentStreak: 18, isCurrentUser: false },
      { rank: 4, anonymousId: "user-4", displayName: "StepStar", points: 1750, challengesCompleted: 8, currentStreak: 7, isCurrentUser: false },
      { rank: 5, anonymousId: "current", displayName: "You", points: 1580, challengesCompleted: 7, currentStreak: 5, isCurrentUser: true },
      { rank: 6, anonymousId: "user-5", displayName: "HealthyHabits", points: 1420, challengesCompleted: 6, currentStreak: 12, isCurrentUser: false },
      { rank: 7, anonymousId: "user-6", displayName: "GoalGetter", points: 1280, challengesCompleted: 5, currentStreak: 3, isCurrentUser: false },
      { rank: 8, anonymousId: "user-7", displayName: "VitalVictor", points: 1150, challengesCompleted: 5, currentStreak: 9, isCurrentUser: false },
      { rank: 9, anonymousId: "user-8", displayName: "ActiveAce", points: 980, challengesCompleted: 4, currentStreak: 6, isCurrentUser: false },
      { rank: 10, anonymousId: "user-9", displayName: "FitFriend", points: 850, challengesCompleted: 4, currentStreak: 2, isCurrentUser: false },
    ];

    res.json({
      success: true,
      data: mockLeaderboard,
      period,
      userRank: 5,
      totalParticipants: 156,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
});

router.get("/badges", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "badges",
      resourceId: "all",
      details: "Viewed badges collection",
    });

    const earnedBadges = Array.from(userBadges.values())
      .filter(b => b.userId === userId);

    res.json({
      success: true,
      data: {
        earned: earnedBadges,
        totalEarned: earnedBadges.length,
        totalAvailable: 8,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch badges" });
  }
});

router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const profileId = req.query.profileId as string || "default";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "patient_dashboard",
      resourceId: "summary",
      details: "Viewed patient features dashboard summary",
    });

    const goals = Array.from(healthGoals.values()).filter(g => g.userId === userId && g.profileId === profileId);
    const symptoms = Array.from(symptomEntries.values()).filter(s => s.userId === userId && s.profileId === profileId);
    const reminders = Array.from(medicationReminders.values()).filter(m => m.userId === userId && m.profileId === profileId && m.isActive);
    const timeline = Array.from(healthTimelineEvents.values()).filter(t => t.userId === userId && t.profileId === profileId);
    const family = Array.from(familyMembers.values()).filter(f => f.userId === userId);
    const emergencyCard = Array.from(emergencyCards.values()).find(c => c.userId === userId && c.profileId === profileId);
    const activeChallenges = Array.from(userChallengeProgress.values()).filter(p => p.userId === userId && p.status === "active");
    const earnedBadges = Array.from(userBadges.values()).filter(b => b.userId === userId);

    res.json({
      success: true,
      data: {
        goals: {
          total: goals.length,
          active: goals.filter(g => g.status === "active").length,
          completed: goals.filter(g => g.status === "completed").length,
        },
        symptoms: {
          totalEntries: symptoms.length,
          lastEntry: symptoms.length > 0 ? symptoms[symptoms.length - 1].date : null,
        },
        medications: {
          activeReminders: reminders.length,
          avgAdherence: reminders.length > 0 
            ? Math.round(reminders.reduce((acc, r) => acc + r.adherenceRate, 0) / reminders.length) 
            : 0,
        },
        timeline: {
          totalEvents: timeline.length,
          milestones: timeline.filter(t => t.isMilestone).length,
        },
        familyHistory: {
          membersDocumented: family.length,
          conditionsTracked: family.reduce((acc, m) => acc + m.conditions.length, 0),
        },
        emergencyCard: {
          isComplete: !!emergencyCard,
          lastUpdated: emergencyCard?.lastUpdated || null,
        },
        challenges: {
          active: activeChallenges.length,
          completed: Array.from(userChallengeProgress.values()).filter(p => p.userId === userId && p.status === "completed").length,
        },
        badges: {
          earned: earnedBadges.length,
          available: 8,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch dashboard summary" });
  }
});

export function registerSpecializedPatientFeaturesRoutes(app: any) {
  app.use("/api/patient-features", router);
  console.log("[PatientFeatures] Routes registered at /api/patient-features/*");
}

export default router;
