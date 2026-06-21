interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: "weight" | "exercise" | "nutrition" | "medication" | "mental_health" | "sleep" | "vitals" | "custom";
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  status: "active" | "completed" | "paused" | "abandoned";
  priority: "high" | "medium" | "low";
  milestones: GoalMilestone[];
  progressHistory: ProgressEntry[];
  aiRecommendations: string[];
  linkedConditions: string[];
  createdAt: string;
  updatedAt: string;
}

interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  isReached: boolean;
  reachedAt: string | null;
  order: number;
}

interface ProgressEntry {
  id: string;
  goalId: string;
  value: number;
  note: string;
  recordedAt: string;
  source: "manual" | "wearable" | "lab" | "ehr";
}

interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  category: HealthGoal["category"];
  suggestedTarget: number;
  unit: string;
  durationWeeks: number;
  milestoneCount: number;
  popularity: number;
}

class HealthGoalsService {
  private goals: Map<string, HealthGoal> = new Map();
  private templates: GoalTemplate[] = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    this.templates = [
      {
        id: "tmpl-weight-loss",
        title: "Healthy Weight Loss",
        description: "Gradually reduce weight through sustainable lifestyle changes",
        category: "weight",
        suggestedTarget: 10,
        unit: "lbs lost",
        durationWeeks: 12,
        milestoneCount: 4,
        popularity: 95,
      },
      {
        id: "tmpl-steps",
        title: "Daily Steps Challenge",
        description: "Build a consistent walking habit to improve cardiovascular health",
        category: "exercise",
        suggestedTarget: 10000,
        unit: "steps/day",
        durationWeeks: 8,
        milestoneCount: 3,
        popularity: 92,
      },
      {
        id: "tmpl-bp",
        title: "Blood Pressure Management",
        description: "Monitor and reduce blood pressure through lifestyle modifications",
        category: "vitals",
        suggestedTarget: 120,
        unit: "mmHg systolic",
        durationWeeks: 16,
        milestoneCount: 4,
        popularity: 88,
      },
      {
        id: "tmpl-sleep",
        title: "Better Sleep Quality",
        description: "Improve sleep duration and quality for better overall health",
        category: "sleep",
        suggestedTarget: 8,
        unit: "hours/night",
        durationWeeks: 6,
        milestoneCount: 3,
        popularity: 85,
      },
      {
        id: "tmpl-hydration",
        title: "Stay Hydrated",
        description: "Maintain optimal daily water intake for better health",
        category: "nutrition",
        suggestedTarget: 64,
        unit: "oz/day",
        durationWeeks: 4,
        milestoneCount: 2,
        popularity: 80,
      },
      {
        id: "tmpl-meditation",
        title: "Daily Mindfulness",
        description: "Practice meditation to reduce stress and improve mental clarity",
        category: "mental_health",
        suggestedTarget: 15,
        unit: "min/day",
        durationWeeks: 8,
        milestoneCount: 3,
        popularity: 78,
      },
      {
        id: "tmpl-medication",
        title: "Medication Adherence",
        description: "Take all prescribed medications on schedule consistently",
        category: "medication",
        suggestedTarget: 100,
        unit: "% adherence",
        durationWeeks: 12,
        milestoneCount: 3,
        popularity: 90,
      },
      {
        id: "tmpl-a1c",
        title: "A1C Reduction",
        description: "Lower A1C levels through diet, exercise, and medication management",
        category: "vitals",
        suggestedTarget: 7.0,
        unit: "%",
        durationWeeks: 24,
        milestoneCount: 4,
        popularity: 82,
      },
    ];

    const now = new Date().toISOString();
    const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const threeMonthsFromNow = new Date(Date.now() + 90 * 86400000).toISOString();
    const twoMonthsFromNow = new Date(Date.now() + 60 * 86400000).toISOString();

    const goal1: HealthGoal = {
      id: "goal-001",
      patientId: "patient-001",
      title: "Reduce Blood Pressure",
      description: "Lower systolic blood pressure from 145 to under 130 mmHg through lifestyle changes and medication adherence",
      category: "vitals",
      targetValue: 130,
      currentValue: 136,
      unit: "mmHg",
      startDate: threeMonthsAgo,
      targetDate: threeMonthsFromNow,
      status: "active",
      priority: "high",
      milestones: [
        { id: "ms-001-1", goalId: "goal-001", title: "Reach 142 mmHg", targetValue: 142, isReached: true, reachedAt: twoMonthsAgo, order: 1 },
        { id: "ms-001-2", goalId: "goal-001", title: "Reach 138 mmHg", targetValue: 138, isReached: true, reachedAt: oneMonthAgo, order: 2 },
        { id: "ms-001-3", goalId: "goal-001", title: "Reach 134 mmHg", targetValue: 134, isReached: false, reachedAt: null, order: 3 },
        { id: "ms-001-4", goalId: "goal-001", title: "Reach target 130 mmHg", targetValue: 130, isReached: false, reachedAt: null, order: 4 },
      ],
      progressHistory: [
        { id: "ph-1", goalId: "goal-001", value: 145, note: "Starting measurement", recordedAt: threeMonthsAgo, source: "ehr" },
        { id: "ph-2", goalId: "goal-001", value: 143, note: "Reduced sodium intake", recordedAt: new Date(Date.now() - 75 * 86400000).toISOString(), source: "manual" },
        { id: "ph-3", goalId: "goal-001", value: 141, note: "Added daily walks", recordedAt: twoMonthsAgo, source: "ehr" },
        { id: "ph-4", goalId: "goal-001", value: 139, note: "Consistent exercise routine", recordedAt: new Date(Date.now() - 45 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-5", goalId: "goal-001", value: 137, note: "Medication adjustment helping", recordedAt: oneMonthAgo, source: "ehr" },
        { id: "ph-6", goalId: "goal-001", value: 136, note: "Steady progress", recordedAt: new Date(Date.now() - 7 * 86400000).toISOString(), source: "manual" },
      ],
      aiRecommendations: [
        "Continue limiting sodium to under 2,300mg daily - your current trend shows positive response",
        "Consider adding 10 minutes to your daily walking routine based on your wearable data trends",
        "Your medication adherence has been 94% this month - maintaining this consistency is helping your progress",
      ],
      linkedConditions: ["Hypertension"],
      createdAt: threeMonthsAgo,
      updatedAt: now,
    };

    const goal2: HealthGoal = {
      id: "goal-002",
      patientId: "patient-001",
      title: "Daily Steps Goal",
      description: "Increase daily step count to 8,000 steps per day for improved cardiovascular fitness",
      category: "exercise",
      targetValue: 8000,
      currentValue: 6500,
      unit: "steps/day",
      startDate: twoMonthsAgo,
      targetDate: twoMonthsFromNow,
      status: "active",
      priority: "medium",
      milestones: [
        { id: "ms-002-1", goalId: "goal-002", title: "Reach 5,000 steps/day", targetValue: 5000, isReached: true, reachedAt: new Date(Date.now() - 40 * 86400000).toISOString(), order: 1 },
        { id: "ms-002-2", goalId: "goal-002", title: "Reach 6,000 steps/day", targetValue: 6000, isReached: true, reachedAt: new Date(Date.now() - 20 * 86400000).toISOString(), order: 2 },
        { id: "ms-002-3", goalId: "goal-002", title: "Reach 7,000 steps/day", targetValue: 7000, isReached: false, reachedAt: null, order: 3 },
        { id: "ms-002-4", goalId: "goal-002", title: "Reach target 8,000 steps/day", targetValue: 8000, isReached: false, reachedAt: null, order: 4 },
      ],
      progressHistory: [
        { id: "ph-10", goalId: "goal-002", value: 3200, note: "Starting baseline", recordedAt: twoMonthsAgo, source: "wearable" },
        { id: "ph-11", goalId: "goal-002", value: 4100, note: "Parking farther away", recordedAt: new Date(Date.now() - 50 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-12", goalId: "goal-002", value: 5200, note: "Lunchtime walks added", recordedAt: new Date(Date.now() - 40 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-13", goalId: "goal-002", value: 5800, note: "Weekend hikes helping", recordedAt: new Date(Date.now() - 30 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-14", goalId: "goal-002", value: 6200, note: "Consistent daily walks", recordedAt: new Date(Date.now() - 14 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-15", goalId: "goal-002", value: 6500, note: "Great week average", recordedAt: new Date(Date.now() - 3 * 86400000).toISOString(), source: "wearable" },
      ],
      aiRecommendations: [
        "Your step count increased 15% in the last two weeks - consider adding a short evening walk to push past 7,000",
        "Based on your wearable data, you walk most on Saturdays. Try to replicate Saturday patterns on weekdays",
      ],
      linkedConditions: ["Hypertension", "Pre-diabetes"],
      createdAt: twoMonthsAgo,
      updatedAt: now,
    };

    const goal3: HealthGoal = {
      id: "goal-003",
      patientId: "patient-001",
      title: "Improve Sleep Duration",
      description: "Increase average nightly sleep from 5.5 hours to 7+ hours",
      category: "sleep",
      targetValue: 7,
      currentValue: 6.2,
      unit: "hours/night",
      startDate: oneMonthAgo,
      targetDate: twoMonthsFromNow,
      status: "active",
      priority: "medium",
      milestones: [
        { id: "ms-003-1", goalId: "goal-003", title: "Reach 6 hours", targetValue: 6, isReached: true, reachedAt: new Date(Date.now() - 14 * 86400000).toISOString(), order: 1 },
        { id: "ms-003-2", goalId: "goal-003", title: "Reach 6.5 hours", targetValue: 6.5, isReached: false, reachedAt: null, order: 2 },
        { id: "ms-003-3", goalId: "goal-003", title: "Reach target 7 hours", targetValue: 7, isReached: false, reachedAt: null, order: 3 },
      ],
      progressHistory: [
        { id: "ph-20", goalId: "goal-003", value: 5.5, note: "Baseline from sleep tracker", recordedAt: oneMonthAgo, source: "wearable" },
        { id: "ph-21", goalId: "goal-003", value: 5.8, note: "Set consistent bedtime", recordedAt: new Date(Date.now() - 21 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-22", goalId: "goal-003", value: 6.1, note: "Reduced screen time before bed", recordedAt: new Date(Date.now() - 14 * 86400000).toISOString(), source: "wearable" },
        { id: "ph-23", goalId: "goal-003", value: 6.2, note: "Steady improvement", recordedAt: new Date(Date.now() - 5 * 86400000).toISOString(), source: "wearable" },
      ],
      aiRecommendations: [
        "Your sleep improved after reducing evening screen time. Consider adding a relaxation routine 30 minutes before bed",
        "Wearable data shows you sleep best on nights following exercise. Try scheduling workouts earlier in the day",
      ],
      linkedConditions: [],
      createdAt: oneMonthAgo,
      updatedAt: now,
    };

    this.goals.set(goal1.id, goal1);
    this.goals.set(goal2.id, goal2);
    this.goals.set(goal3.id, goal3);

    console.log("[HealthGoals] Service initialized with sample data");
    console.log(`[HealthGoals] Goals: ${this.goals.size}, Templates: ${this.templates.length}`);
  }

  getGoals(patientId: string): HealthGoal[] {
    return Array.from(this.goals.values()).filter(g => g.patientId === patientId);
  }

  getGoal(goalId: string): HealthGoal | undefined {
    return this.goals.get(goalId);
  }

  createGoal(params: {
    patientId: string;
    title: string;
    description: string;
    category: HealthGoal["category"];
    targetValue: number;
    unit: string;
    targetDate: string;
    priority: HealthGoal["priority"];
    linkedConditions?: string[];
  }): HealthGoal {
    const now = new Date().toISOString();
    const id = `goal-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const milestoneCount = 3;
    const milestones: GoalMilestone[] = [];
    for (let i = 1; i <= milestoneCount; i++) {
      milestones.push({
        id: `ms-${id}-${i}`,
        goalId: id,
        title: `Milestone ${i}: ${Math.round((i / (milestoneCount + 1)) * 100)}% of target`,
        targetValue: Math.round((params.targetValue * i) / (milestoneCount + 1)),
        isReached: false,
        reachedAt: null,
        order: i,
      });
    }

    const goal: HealthGoal = {
      id,
      patientId: params.patientId,
      title: params.title,
      description: params.description,
      category: params.category,
      targetValue: params.targetValue,
      currentValue: 0,
      unit: params.unit,
      startDate: now,
      targetDate: params.targetDate,
      status: "active",
      priority: params.priority,
      milestones,
      progressHistory: [],
      aiRecommendations: [
        `Great start! Setting clear goals is the first step toward better health outcomes.`,
        `Try to log your progress at least once per week to stay on track.`,
      ],
      linkedConditions: params.linkedConditions || [],
      createdAt: now,
      updatedAt: now,
    };

    this.goals.set(id, goal);
    return goal;
  }

  updateGoalStatus(goalId: string, status: HealthGoal["status"]): HealthGoal | undefined {
    const goal = this.goals.get(goalId);
    if (!goal) return undefined;
    goal.status = status;
    goal.updatedAt = new Date().toISOString();
    return goal;
  }

  addProgress(goalId: string, value: number, note: string, source: ProgressEntry["source"] = "manual"): ProgressEntry | undefined {
    const goal = this.goals.get(goalId);
    if (!goal) return undefined;

    const entry: ProgressEntry = {
      id: `ph-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      goalId,
      value,
      note,
      recordedAt: new Date().toISOString(),
      source,
    };

    goal.progressHistory.push(entry);
    goal.currentValue = value;
    goal.updatedAt = new Date().toISOString();

    for (const milestone of goal.milestones) {
      if (!milestone.isReached) {
        const reachedForward = goal.targetValue > 0 && value >= milestone.targetValue;
        const reachedReverse = goal.targetValue > 0 && goal.category === "vitals" && value <= milestone.targetValue;
        if (reachedForward || reachedReverse) {
          milestone.isReached = true;
          milestone.reachedAt = new Date().toISOString();
        }
      }
    }

    if (goal.category === "vitals" && value <= goal.targetValue) {
      goal.status = "completed";
    } else if (value >= goal.targetValue) {
      goal.status = "completed";
    }

    return entry;
  }

  getTemplates(): GoalTemplate[] {
    return this.templates;
  }

  getDashboard(patientId: string): {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    overallProgress: number;
    goalsOnTrack: number;
    goalsBehind: number;
    recentMilestones: GoalMilestone[];
    categoryBreakdown: { category: string; count: number }[];
  } {
    const goals = this.getGoals(patientId);
    const active = goals.filter(g => g.status === "active");
    const completed = goals.filter(g => g.status === "completed");

    const totalProgress = active.reduce((sum, g) => {
      const pct = g.targetValue > 0 ? Math.min((g.currentValue / g.targetValue) * 100, 100) : 0;
      return sum + pct;
    }, 0);

    const allMilestones = goals.flatMap(g => g.milestones);
    const recentMilestones = allMilestones
      .filter(m => m.isReached && m.reachedAt)
      .sort((a, b) => new Date(b.reachedAt!).getTime() - new Date(a.reachedAt!).getTime())
      .slice(0, 5);

    const categoryMap = new Map<string, number>();
    goals.forEach(g => categoryMap.set(g.category, (categoryMap.get(g.category) || 0) + 1));
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    const now = Date.now();
    let onTrack = 0;
    let behind = 0;
    active.forEach(g => {
      const elapsed = now - new Date(g.startDate).getTime();
      const total = new Date(g.targetDate).getTime() - new Date(g.startDate).getTime();
      const expectedPct = total > 0 ? (elapsed / total) * 100 : 0;
      const actualPct = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
      if (actualPct >= expectedPct * 0.8) onTrack++;
      else behind++;
    });

    return {
      totalGoals: goals.length,
      activeGoals: active.length,
      completedGoals: completed.length,
      overallProgress: active.length > 0 ? Math.round(totalProgress / active.length) : 0,
      goalsOnTrack: onTrack,
      goalsBehind: behind,
      recentMilestones,
      categoryBreakdown,
    };
  }

  deleteGoal(goalId: string): boolean {
    return this.goals.delete(goalId);
  }
}

export const healthGoalsService = new HealthGoalsService();
