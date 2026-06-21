import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    console.log("[HealthGoalTracking] OpenAI client initialized");
  }
} catch (error) {
  console.log("[HealthGoalTracking] OpenAI client not available, using fallback");
}

export type GoalCategory = 
  | "exercise" 
  | "medication_adherence" 
  | "weight_management" 
  | "nutrition" 
  | "sleep" 
  | "mental_health" 
  | "hydration" 
  | "vital_monitoring" 
  | "preventive_care"
  | "chronic_management";

export type GoalStatus = "active" | "completed" | "paused" | "abandoned";
export type GoalPriority = "high" | "medium" | "low";
export type ProgressTrend = "improving" | "stable" | "declining";

export interface HealthGoal {
  id: string;
  patientId: string;
  category: GoalCategory;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  currentValue: number;
  startDate: string;
  targetDate: string;
  frequency: "daily" | "weekly" | "monthly";
  status: GoalStatus;
  priority: GoalPriority;
  progress: number;
  streak: number;
  bestStreak: number;
  totalLogs: number;
  createdAt: string;
  updatedAt: string;
  aiSuggested: boolean;
  linkedConditions?: string[];
  linkedMedications?: string[];
  milestones: GoalMilestone[];
  reminders: GoalReminder[];
}

export interface GoalMilestone {
  id: string;
  title: string;
  targetValue: number;
  achieved: boolean;
  achievedDate?: string;
  reward?: string;
}

export interface GoalReminder {
  id: string;
  time: string;
  days: string[];
  enabled: boolean;
  message: string;
}

export interface ProgressLog {
  id: string;
  goalId: string;
  patientId: string;
  value: number;
  unit: string;
  note?: string;
  mood?: "great" | "good" | "okay" | "struggling";
  loggedAt: string;
  source: "manual" | "device" | "ehr";
}

export interface GoalSuggestion {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  frequency: "daily" | "weekly" | "monthly";
  rationale: string;
  linkedConditions: string[];
  difficulty: "easy" | "moderate" | "challenging";
  expectedBenefit: string;
  priority: GoalPriority;
}

export interface MotivationalFeedback {
  message: string;
  type: "encouragement" | "celebration" | "tip" | "reminder" | "milestone";
  icon: string;
  actionSuggestion?: string;
}

export interface GoalAnalytics {
  goalId: string;
  averageProgress: number;
  trend: ProgressTrend;
  consistencyScore: number;
  daysActive: number;
  completionPrediction: number;
  weeklyData: Array<{ week: string; value: number; target: number }>;
  dailyData: Array<{ date: string; value: number; target: number }>;
  insights: string[];
}

export interface PatientHealthContext {
  conditions: Array<{ name: string; status: string; severity?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: Array<{ substance: string; severity: string }>;
  recentVitals: {
    bloodPressure?: { systolic: number; diastolic: number };
    weight?: { value: number; unit: string };
    bmi?: { value: number };
    heartRate?: { value: number };
  };
  demographics: {
    age: number;
    gender: string;
  };
}

class HealthGoalTrackingService {
  private goals: Map<string, HealthGoal> = new Map();
  private progressLogs: Map<string, ProgressLog[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[HealthGoalTracking] Service initialized with NO-CDS compliance");
    console.log("[HealthGoalTracking] Features: Goal tracking, AI suggestions, progress visualization, motivational feedback");
  }

  private initializeSampleData() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const daysAgo = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return formatDate(d);
    };
    const daysFromNow = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return formatDate(d);
    };

    const sampleGoals: HealthGoal[] = [
      {
        id: "goal-1",
        patientId: "patient-1",
        category: "exercise",
        title: "Daily Walking",
        description: "Walk at least 30 minutes every day to improve cardiovascular health",
        targetValue: 30,
        targetUnit: "minutes",
        currentValue: 25,
        startDate: daysAgo(14),
        targetDate: daysFromNow(76),
        frequency: "daily",
        status: "active",
        priority: "high",
        progress: 83,
        streak: 5,
        bestStreak: 8,
        totalLogs: 12,
        createdAt: daysAgo(14),
        updatedAt: formatDate(today),
        aiSuggested: true,
        linkedConditions: ["Essential Hypertension", "Type 2 Diabetes"],
        milestones: [
          { id: "m1", title: "First Week Complete", targetValue: 7, achieved: true, achievedDate: daysAgo(7), reward: "Bronze Badge" },
          { id: "m2", title: "Two Weeks Strong", targetValue: 14, achieved: false, reward: "Silver Badge" },
          { id: "m3", title: "One Month Champion", targetValue: 30, achieved: false, reward: "Gold Badge" },
        ],
        reminders: [
          { id: "r1", time: "07:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], enabled: true, message: "Time for your morning walk!" },
        ],
      },
      {
        id: "goal-2",
        patientId: "patient-1",
        category: "medication_adherence",
        title: "Take Blood Pressure Medication",
        description: "Take Lisinopril 10mg daily as prescribed",
        targetValue: 1,
        targetUnit: "dose",
        currentValue: 1,
        startDate: daysAgo(30),
        targetDate: daysFromNow(60),
        frequency: "daily",
        status: "active",
        priority: "high",
        progress: 95,
        streak: 12,
        bestStreak: 20,
        totalLogs: 28,
        createdAt: daysAgo(30),
        updatedAt: formatDate(today),
        aiSuggested: true,
        linkedConditions: ["Essential Hypertension"],
        linkedMedications: ["Lisinopril"],
        milestones: [
          { id: "m1", title: "Perfect Week", targetValue: 7, achieved: true, achievedDate: daysAgo(23), reward: "Consistency Star" },
          { id: "m2", title: "Perfect Month", targetValue: 30, achieved: false, reward: "Adherence Champion" },
        ],
        reminders: [
          { id: "r1", time: "08:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], enabled: true, message: "Don't forget your blood pressure medication!" },
        ],
      },
      {
        id: "goal-3",
        patientId: "patient-1",
        category: "weight_management",
        title: "Healthy Weight Goal",
        description: "Reach and maintain a healthy weight of 175 lbs",
        targetValue: 175,
        targetUnit: "lbs",
        currentValue: 182,
        startDate: daysAgo(45),
        targetDate: daysFromNow(45),
        frequency: "weekly",
        status: "active",
        priority: "medium",
        progress: 67,
        streak: 6,
        bestStreak: 6,
        totalLogs: 7,
        createdAt: daysAgo(45),
        updatedAt: daysAgo(2),
        aiSuggested: false,
        linkedConditions: ["Type 2 Diabetes", "Hyperlipidemia"],
        milestones: [
          { id: "m1", title: "First 5 lbs Lost", targetValue: 187, achieved: true, achievedDate: daysAgo(20), reward: "Great Start!" },
          { id: "m2", title: "Halfway There", targetValue: 181, achieved: false, reward: "Halfway Hero" },
          { id: "m3", title: "Goal Reached", targetValue: 175, achieved: false, reward: "Weight Champion" },
        ],
        reminders: [
          { id: "r1", time: "07:00", days: ["Mon"], enabled: true, message: "Time for your weekly weigh-in!" },
        ],
      },
      {
        id: "goal-4",
        patientId: "patient-1",
        category: "hydration",
        title: "Stay Hydrated",
        description: "Drink at least 8 glasses of water daily",
        targetValue: 8,
        targetUnit: "glasses",
        currentValue: 6,
        startDate: daysAgo(7),
        targetDate: daysFromNow(83),
        frequency: "daily",
        status: "active",
        priority: "medium",
        progress: 75,
        streak: 3,
        bestStreak: 5,
        totalLogs: 7,
        createdAt: daysAgo(7),
        updatedAt: formatDate(today),
        aiSuggested: true,
        linkedConditions: ["Type 2 Diabetes"],
        milestones: [
          { id: "m1", title: "Hydration Habit Started", targetValue: 7, achieved: true, achievedDate: formatDate(today), reward: "Water Drop Badge" },
          { id: "m2", title: "Two Week Streak", targetValue: 14, achieved: false, reward: "Hydration Pro" },
        ],
        reminders: [
          { id: "r1", time: "09:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], enabled: true, message: "Remember to drink water!" },
          { id: "r2", time: "14:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], enabled: true, message: "Halfway through the day - stay hydrated!" },
        ],
      },
      {
        id: "goal-5",
        patientId: "patient-1",
        category: "sleep",
        title: "Better Sleep Quality",
        description: "Get at least 7 hours of quality sleep each night",
        targetValue: 7,
        targetUnit: "hours",
        currentValue: 6.5,
        startDate: daysAgo(21),
        targetDate: daysFromNow(69),
        frequency: "daily",
        status: "active",
        priority: "medium",
        progress: 93,
        streak: 4,
        bestStreak: 7,
        totalLogs: 18,
        createdAt: daysAgo(21),
        updatedAt: daysAgo(1),
        aiSuggested: false,
        milestones: [
          { id: "m1", title: "Week of Good Sleep", targetValue: 7, achieved: true, achievedDate: daysAgo(14), reward: "Rest Well Badge" },
          { id: "m2", title: "Month of Rest", targetValue: 30, achieved: false, reward: "Sleep Champion" },
        ],
        reminders: [
          { id: "r1", time: "21:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], enabled: true, message: "Time to wind down for bed!" },
        ],
      },
    ];

    sampleGoals.forEach(goal => {
      this.goals.set(goal.id, goal);
    });

    const sampleLogs: ProgressLog[] = [];
    for (let i = 0; i < 14; i++) {
      const logDate = new Date(today);
      logDate.setDate(logDate.getDate() - i);
      
      sampleLogs.push({
        id: `log-walk-${i}`,
        goalId: "goal-1",
        patientId: "patient-1",
        value: Math.floor(Math.random() * 15) + 20,
        unit: "minutes",
        note: i === 0 ? "Great walk in the park today!" : undefined,
        mood: ["great", "good", "okay"][Math.floor(Math.random() * 3)] as "great" | "good" | "okay",
        loggedAt: logDate.toISOString(),
        source: "manual",
      });

      sampleLogs.push({
        id: `log-med-${i}`,
        goalId: "goal-2",
        patientId: "patient-1",
        value: Math.random() > 0.1 ? 1 : 0,
        unit: "dose",
        loggedAt: logDate.toISOString(),
        source: "manual",
      });

      sampleLogs.push({
        id: `log-water-${i}`,
        goalId: "goal-4",
        patientId: "patient-1",
        value: Math.floor(Math.random() * 4) + 5,
        unit: "glasses",
        loggedAt: logDate.toISOString(),
        source: "manual",
      });

      sampleLogs.push({
        id: `log-sleep-${i}`,
        goalId: "goal-5",
        patientId: "patient-1",
        value: 5.5 + Math.random() * 2.5,
        unit: "hours",
        loggedAt: logDate.toISOString(),
        source: "device",
      });
    }

    for (let i = 0; i < 7; i++) {
      const logDate = new Date(today);
      logDate.setDate(logDate.getDate() - i * 7);
      
      sampleLogs.push({
        id: `log-weight-${i}`,
        goalId: "goal-3",
        patientId: "patient-1",
        value: 192 - i * 1.5,
        unit: "lbs",
        loggedAt: logDate.toISOString(),
        source: "manual",
      });
    }

    sampleLogs.forEach(log => {
      const existing = this.progressLogs.get(log.goalId) || [];
      existing.push(log);
      this.progressLogs.set(log.goalId, existing);
    });

    console.log("[HealthGoalTracking] Sample data initialized");
    console.log(`[HealthGoalTracking] Goals: ${this.goals.size}, Progress Logs: ${sampleLogs.length}`);
  }

  async getGoals(patientId: string, status?: GoalStatus): Promise<HealthGoal[]> {
    const goals = Array.from(this.goals.values())
      .filter(g => g.patientId === patientId)
      .filter(g => !status || g.status === status);
    
    return goals.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getGoal(goalId: string): Promise<HealthGoal | null> {
    return this.goals.get(goalId) || null;
  }

  async createGoal(goal: Omit<HealthGoal, "id" | "createdAt" | "updatedAt" | "progress" | "streak" | "bestStreak" | "totalLogs">): Promise<HealthGoal> {
    const id = `goal-${Date.now()}`;
    const now = new Date().toISOString().split("T")[0];
    
    const newGoal: HealthGoal = {
      ...goal,
      id,
      progress: 0,
      streak: 0,
      bestStreak: 0,
      totalLogs: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    this.goals.set(id, newGoal);
    return newGoal;
  }

  async updateGoal(goalId: string, updates: Partial<HealthGoal>): Promise<HealthGoal | null> {
    const goal = this.goals.get(goalId);
    if (!goal) return null;
    
    const updatedGoal = {
      ...goal,
      ...updates,
      id: goalId,
      updatedAt: new Date().toISOString().split("T")[0],
    };
    
    this.goals.set(goalId, updatedGoal);
    return updatedGoal;
  }

  async deleteGoal(goalId: string): Promise<boolean> {
    return this.goals.delete(goalId);
  }

  async logProgress(log: Omit<ProgressLog, "id" | "loggedAt">): Promise<ProgressLog> {
    const id = `log-${Date.now()}`;
    const newLog: ProgressLog = {
      ...log,
      id,
      loggedAt: new Date().toISOString(),
    };
    
    const existing = this.progressLogs.get(log.goalId) || [];
    existing.push(newLog);
    this.progressLogs.set(log.goalId, existing);

    await this.updateGoalProgress(log.goalId);
    
    return newLog;
  }

  private async updateGoalProgress(goalId: string): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const logs = this.progressLogs.get(goalId) || [];
    const totalLogs = logs.length;

    let streak = 0;
    let currentDate = new Date();
    const sortedLogs = [...logs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    
    for (const log of sortedLogs) {
      const logDate = new Date(log.loggedAt).toDateString();
      const checkDate = currentDate.toDateString();
      
      if (logDate === checkDate && log.value >= goal.targetValue * 0.8) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    const successfulLogs = logs.filter(l => l.value >= goal.targetValue).length;
    const progress = totalLogs > 0 ? Math.round((successfulLogs / totalLogs) * 100) : 0;

    const latestLog = sortedLogs[0];
    const currentValue = latestLog ? latestLog.value : goal.currentValue;

    this.goals.set(goalId, {
      ...goal,
      totalLogs,
      streak,
      bestStreak: Math.max(goal.bestStreak, streak),
      progress,
      currentValue,
      updatedAt: new Date().toISOString().split("T")[0],
    });
  }

  async getProgressLogs(goalId: string, limit?: number): Promise<ProgressLog[]> {
    const logs = this.progressLogs.get(goalId) || [];
    const sorted = logs.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getGoalAnalytics(goalId: string): Promise<GoalAnalytics | null> {
    const goal = this.goals.get(goalId);
    if (!goal) return null;

    const logs = this.progressLogs.get(goalId) || [];
    
    const avgValue = logs.length > 0 
      ? logs.reduce((sum, l) => sum + l.value, 0) / logs.length 
      : 0;
    
    const averageProgress = goal.targetValue > 0 
      ? Math.min(100, Math.round((avgValue / goal.targetValue) * 100))
      : 0;

    const recentLogs = logs.slice(-7);
    const olderLogs = logs.slice(-14, -7);
    
    const recentAvg = recentLogs.length > 0 
      ? recentLogs.reduce((sum, l) => sum + l.value, 0) / recentLogs.length
      : 0;
    const olderAvg = olderLogs.length > 0
      ? olderLogs.reduce((sum, l) => sum + l.value, 0) / olderLogs.length
      : recentAvg;
    
    let trend: ProgressTrend = "stable";
    if (recentAvg > olderAvg * 1.1) trend = "improving";
    else if (recentAvg < olderAvg * 0.9) trend = "declining";

    const startDate = new Date(goal.startDate);
    const today = new Date();
    const daysActive = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const consistencyScore = logs.length > 0
      ? Math.min(100, Math.round((goal.streak / Math.max(1, daysActive)) * 100))
      : 0;

    const dailyData: Array<{ date: string; value: number; target: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      const dayLogs = logs.filter(l => l.loggedAt.startsWith(dateStr));
      const dayValue = dayLogs.length > 0
        ? dayLogs.reduce((sum, l) => sum + l.value, 0) / dayLogs.length
        : 0;
      
      dailyData.push({
        date: dateStr,
        value: Math.round(dayValue * 10) / 10,
        target: goal.targetValue,
      });
    }

    const weeklyData: Array<{ week: string; value: number; target: number }> = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w * 7) - 6);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (w * 7));
      
      const weekLogs = logs.filter(l => {
        const logDate = new Date(l.loggedAt);
        return logDate >= weekStart && logDate <= weekEnd;
      });
      
      const weekAvg = weekLogs.length > 0
        ? weekLogs.reduce((sum, l) => sum + l.value, 0) / weekLogs.length
        : 0;
      
      weeklyData.push({
        week: `Week ${4 - w}`,
        value: Math.round(weekAvg * 10) / 10,
        target: goal.targetValue,
      });
    }

    const completionPrediction = Math.min(100, Math.round(averageProgress + (trend === "improving" ? 15 : trend === "declining" ? -10 : 0)));

    const insights: string[] = [];
    if (trend === "improving") {
      insights.push("Your progress has been improving over the last week. Keep up the great work!");
    }
    if (goal.streak >= 7) {
      insights.push(`Amazing! You've maintained a ${goal.streak}-day streak. Consistency is key!`);
    }
    if (averageProgress >= 90) {
      insights.push("You're exceeding your targets! Consider setting a more challenging goal.");
    }
    if (averageProgress < 50) {
      insights.push("You're making progress, but there's room for improvement. Try breaking this goal into smaller steps.");
    }

    return {
      goalId,
      averageProgress,
      trend,
      consistencyScore,
      daysActive,
      completionPrediction,
      weeklyData,
      dailyData,
      insights,
    };
  }

  async generateGoalSuggestions(patientId: string, healthContext: PatientHealthContext): Promise<GoalSuggestion[]> {
    const disclaimer = "DISCLAIMER: These goal suggestions are for informational purposes only and do not constitute medical advice. Always consult with your healthcare provider before starting any new health program or making changes to your treatment plan.";

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a health goal suggestion assistant. Based on the patient's health context, suggest personalized, achievable health goals. 
              
IMPORTANT: You are NOT providing medical advice. All suggestions must be general wellness goals that are safe and appropriate for the patient's conditions.

Return a JSON array of goal suggestions with this structure:
{
  "suggestions": [
    {
      "category": "exercise|medication_adherence|weight_management|nutrition|sleep|mental_health|hydration|vital_monitoring|preventive_care|chronic_management",
      "title": "Short goal title",
      "description": "Detailed goal description",
      "targetValue": number,
      "targetUnit": "unit of measurement",
      "frequency": "daily|weekly|monthly",
      "rationale": "Why this goal is relevant to the patient",
      "linkedConditions": ["condition names"],
      "difficulty": "easy|moderate|challenging",
      "expectedBenefit": "Expected health benefit",
      "priority": "high|medium|low"
    }
  ]
}

Focus on:
1. Goals that address the patient's specific conditions
2. Gradual, achievable targets
3. Evidence-based wellness practices
4. Lifestyle modifications that complement medical treatment`
            },
            {
              role: "user",
              content: `Patient Health Context:
- Age: ${healthContext.demographics.age}, Gender: ${healthContext.demographics.gender}
- Active Conditions: ${healthContext.conditions.filter(c => c.status === 'active').map(c => c.name).join(", ") || "None"}
- Current Medications: ${healthContext.medications.map(m => `${m.name} ${m.dosage}`).join(", ") || "None"}
- Recent Vitals: 
  ${healthContext.recentVitals.bloodPressure ? `BP: ${healthContext.recentVitals.bloodPressure.systolic}/${healthContext.recentVitals.bloodPressure.diastolic}` : ""}
  ${healthContext.recentVitals.weight ? `Weight: ${healthContext.recentVitals.weight.value} ${healthContext.recentVitals.weight.unit}` : ""}
  ${healthContext.recentVitals.bmi ? `BMI: ${healthContext.recentVitals.bmi.value}` : ""}

Suggest 4-6 personalized, achievable health goals for this patient.`
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1500,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return parsed.suggestions.map((s: any, i: number) => ({
            id: `suggestion-${Date.now()}-${i}`,
            ...s,
          }));
        }
      } catch (error) {
        console.error("[HealthGoalTracking] AI suggestion error:", error);
      }
    }

    return this.generateFallbackSuggestions(healthContext);
  }

  private generateFallbackSuggestions(context: PatientHealthContext): GoalSuggestion[] {
    const suggestions: GoalSuggestion[] = [];
    const conditions = context.conditions.map(c => c.name.toLowerCase());

    suggestions.push({
      id: `suggestion-${Date.now()}-1`,
      category: "exercise",
      title: "Daily Walking",
      description: "Walk for at least 30 minutes each day to improve overall cardiovascular health",
      targetValue: 30,
      targetUnit: "minutes",
      frequency: "daily",
      rationale: "Regular walking is one of the safest and most effective forms of exercise for all ages",
      linkedConditions: [],
      difficulty: "easy",
      expectedBenefit: "Improved cardiovascular health, better mood, and weight management",
      priority: "medium",
    });

    suggestions.push({
      id: `suggestion-${Date.now()}-2`,
      category: "hydration",
      title: "Stay Hydrated",
      description: "Drink at least 8 glasses of water daily",
      targetValue: 8,
      targetUnit: "glasses",
      frequency: "daily",
      rationale: "Proper hydration supports all body functions and helps with energy levels",
      linkedConditions: [],
      difficulty: "easy",
      expectedBenefit: "Better energy, clearer skin, improved digestion",
      priority: "medium",
    });

    suggestions.push({
      id: `suggestion-${Date.now()}-3`,
      category: "sleep",
      title: "Quality Sleep",
      description: "Get at least 7 hours of quality sleep each night",
      targetValue: 7,
      targetUnit: "hours",
      frequency: "daily",
      rationale: "Adequate sleep is essential for physical and mental health recovery",
      linkedConditions: [],
      difficulty: "moderate",
      expectedBenefit: "Better focus, improved mood, stronger immune system",
      priority: "high",
    });

    if (conditions.some(c => c.includes("diabetes") || c.includes("hypertension") || c.includes("heart"))) {
      suggestions.push({
        id: `suggestion-${Date.now()}-4`,
        category: "vital_monitoring",
        title: "Monitor Blood Pressure",
        description: "Check and record blood pressure twice daily",
        targetValue: 2,
        targetUnit: "readings",
        frequency: "daily",
        rationale: "Regular monitoring helps track cardiovascular health",
        linkedConditions: context.conditions.filter(c => 
          c.name.toLowerCase().includes("hypertension") || 
          c.name.toLowerCase().includes("diabetes")
        ).map(c => c.name),
        difficulty: "easy",
        expectedBenefit: "Better awareness and management of blood pressure",
        priority: "high",
      });
    }

    if (context.medications.length > 0) {
      suggestions.push({
        id: `suggestion-${Date.now()}-5`,
        category: "medication_adherence",
        title: "Medication Adherence",
        description: "Take all prescribed medications on schedule",
        targetValue: 100,
        targetUnit: "percent",
        frequency: "daily",
        rationale: "Consistent medication use is crucial for managing chronic conditions",
        linkedConditions: context.conditions.map(c => c.name),
        difficulty: "moderate",
        expectedBenefit: "Better disease management and health outcomes",
        priority: "high",
      });
    }

    suggestions.push({
      id: `suggestion-${Date.now()}-6`,
      category: "nutrition",
      title: "Eat More Vegetables",
      description: "Include at least 5 servings of vegetables in your daily diet",
      targetValue: 5,
      targetUnit: "servings",
      frequency: "daily",
      rationale: "A diet rich in vegetables provides essential nutrients and fiber",
      linkedConditions: [],
      difficulty: "moderate",
      expectedBenefit: "Better nutrition, weight management, disease prevention",
      priority: "medium",
    });

    return suggestions;
  }

  async generateMotivationalFeedback(patientId: string, goalId?: string): Promise<MotivationalFeedback[]> {
    const feedback: MotivationalFeedback[] = [];
    const goals = await this.getGoals(patientId, "active");

    if (goalId) {
      const goal = this.goals.get(goalId);
      if (goal) {
        feedback.push(...this.generateGoalSpecificFeedback(goal));
      }
    } else {
      for (const goal of goals) {
        feedback.push(...this.generateGoalSpecificFeedback(goal));
      }
    }

    if (feedback.length === 0) {
      feedback.push({
        message: "Every step forward is progress! Keep working on your goals.",
        type: "encouragement",
        icon: "sparkles",
      });
    }

    return feedback.slice(0, 5);
  }

  private generateGoalSpecificFeedback(goal: HealthGoal): MotivationalFeedback[] {
    const feedback: MotivationalFeedback[] = [];

    if (goal.streak >= 7) {
      feedback.push({
        message: `Amazing! You've maintained a ${goal.streak}-day streak on "${goal.title}"!`,
        type: "celebration",
        icon: "flame",
      });
    } else if (goal.streak >= 3) {
      feedback.push({
        message: `Great job! ${goal.streak} days in a row on "${goal.title}". Keep it up!`,
        type: "encouragement",
        icon: "trending-up",
      });
    }

    if (goal.progress >= 90) {
      feedback.push({
        message: `You're crushing your "${goal.title}" goal with ${goal.progress}% completion!`,
        type: "celebration",
        icon: "trophy",
      });
    } else if (goal.progress >= 75) {
      feedback.push({
        message: `You're doing great on "${goal.title}" - ${goal.progress}% of the way there!`,
        type: "encouragement",
        icon: "star",
      });
    } else if (goal.progress < 50) {
      feedback.push({
        message: `Remember to log your progress on "${goal.title}" today!`,
        type: "reminder",
        icon: "bell",
        actionSuggestion: "Log your progress now",
      });
    }

    const achievedMilestones = goal.milestones.filter(m => m.achieved);
    const nextMilestone = goal.milestones.find(m => !m.achieved);
    
    if (achievedMilestones.length > 0) {
      const latest = achievedMilestones[achievedMilestones.length - 1];
      feedback.push({
        message: `Congratulations on reaching "${latest.title}"! ${latest.reward ? `You earned: ${latest.reward}` : ""}`,
        type: "milestone",
        icon: "award",
      });
    }

    if (nextMilestone) {
      feedback.push({
        message: `Your next milestone: "${nextMilestone.title}" - you can do it!`,
        type: "tip",
        icon: "target",
      });
    }

    return feedback;
  }

  async getDashboardSummary(patientId: string): Promise<{
    activeGoals: number;
    completedGoals: number;
    averageProgress: number;
    totalStreak: number;
    topPerformingGoal: HealthGoal | null;
    needsAttention: HealthGoal[];
    recentAchievements: Array<{ goalTitle: string; milestone: string; date: string }>;
  }> {
    const allGoals = Array.from(this.goals.values()).filter(g => g.patientId === patientId);
    const activeGoals = allGoals.filter(g => g.status === "active");
    const completedGoals = allGoals.filter(g => g.status === "completed");

    const averageProgress = activeGoals.length > 0
      ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
      : 0;

    const totalStreak = activeGoals.reduce((sum, g) => sum + g.streak, 0);

    const topPerformingGoal = activeGoals.length > 0
      ? activeGoals.reduce((best, g) => g.progress > best.progress ? g : best)
      : null;

    const needsAttention = activeGoals.filter(g => g.progress < 50 || g.streak === 0);

    const recentAchievements: Array<{ goalTitle: string; milestone: string; date: string }> = [];
    for (const goal of allGoals) {
      for (const milestone of goal.milestones) {
        if (milestone.achieved && milestone.achievedDate) {
          recentAchievements.push({
            goalTitle: goal.title,
            milestone: milestone.title,
            date: milestone.achievedDate,
          });
        }
      }
    }
    recentAchievements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      activeGoals: activeGoals.length,
      completedGoals: completedGoals.length,
      averageProgress,
      totalStreak,
      topPerformingGoal,
      needsAttention: needsAttention.slice(0, 3),
      recentAchievements: recentAchievements.slice(0, 5),
    };
  }
}

export const healthGoalTrackingService = new HealthGoalTrackingService();
