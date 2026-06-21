import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  openai = new OpenAI();
} catch (error) {
  console.log("[PersonalizedHealthJourney] OpenAI client not available, using fallback responses");
}

export interface HealthJourney {
  id: string;
  patientId: string;
  conditionType: 'diabetes' | 'hypertension' | 'heart_disease' | 'asthma' | 'copd' | 'arthritis' | 'obesity' | 'mental_health';
  title: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  targetEndDate: string;
  currentPhase: number;
  totalPhases: number;
  overallProgress: number;
  lastActivityAt: string;
  aiPersonalizationLevel: 'low' | 'medium' | 'high';
  adaptationHistory: JourneyAdaptation[];
  createdAt: string;
  updatedAt: string;
}

export interface JourneyAdaptation {
  id: string;
  timestamp: string;
  reason: string;
  changes: string[];
  triggerType: 'progress' | 'health_data' | 'engagement' | 'ai_recommendation';
}

export interface EducationalModule {
  id: string;
  journeyId: string;
  title: string;
  description: string;
  type: 'video' | 'article' | 'quiz' | 'interactive' | 'checklist';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  phase: number;
  order: number;
  content: ModuleContent;
  prerequisites: string[];
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  progress: number;
  completedAt?: string;
  score?: number;
  attempts: number;
  adaptiveNotes?: string;
}

export interface ModuleContent {
  sections: ContentSection[];
  quiz?: QuizQuestion[];
  checklist?: ChecklistItem[];
  resources?: Resource[];
}

export interface ContentSection {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  points: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'pdf' | 'video';
}

export interface CarePlanTask {
  id: string;
  journeyId: string;
  title: string;
  description: string;
  category: 'medication' | 'exercise' | 'diet' | 'monitoring' | 'appointment' | 'lifestyle';
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  scheduledTime?: string;
  reminderEnabled: boolean;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
  dueDate: string;
  completedAt?: string;
  streakCount: number;
  pointsValue: number;
  adaptivePriority: number;
  aiSuggestion?: string;
}

export interface GamificationProfile {
  id: string;
  patientId: string;
  totalPoints: number;
  level: number;
  levelTitle: string;
  nextLevelPoints: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  achievements: Achievement[];
  weeklyGoalProgress: number;
  weeklyGoalTarget: number;
  leaderboardRank?: number;
  engagementScore: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'learning' | 'health' | 'community';
  earnedAt: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  pointsReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  category: string;
}

export interface JourneyInsight {
  id: string;
  journeyId: string;
  type: 'progress' | 'recommendation' | 'alert' | 'celebration';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
  createdAt: string;
  dismissed: boolean;
  aiGenerated: boolean;
  disclaimer: string;
}

class PersonalizedHealthJourneyService {
  private journeys: Map<string, HealthJourney> = new Map();
  private modules: Map<string, EducationalModule> = new Map();
  private carePlanTasks: Map<string, CarePlanTask> = new Map();
  private gamificationProfiles: Map<string, GamificationProfile> = new Map();
  private insights: Map<string, JourneyInsight> = new Map();
  private openaiAvailable: boolean = false;

  private readonly NO_CDS_DISCLAIMER = "This information is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider for personalized medical decisions.";

  constructor() {
    this.initializeSampleData();
    this.checkOpenAIAvailability();
    console.log("[PersonalizedHealthJourney] Service initialized with adaptive learning");
    console.log("[PersonalizedHealthJourney] Features: Educational modules, care plans, gamification");
    console.log("[PersonalizedHealthJourney] NO-CDS compliance enabled for all AI outputs");
  }

  private async checkOpenAIAvailability() {
    if (!openai) {
      this.openaiAvailable = false;
      return;
    }
    try {
      await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });
      this.openaiAvailable = true;
      console.log("[PersonalizedHealthJourney] OpenAI integration active");
    } catch {
      this.openaiAvailable = false;
      console.log("[PersonalizedHealthJourney] OpenAI not available, using fallback");
    }
  }

  private initializeSampleData() {
    const sampleJourney: HealthJourney = {
      id: "journey-1",
      patientId: "patient-1",
      conditionType: "diabetes",
      title: "Type 2 Diabetes Management Journey",
      description: "A personalized 12-week program to help you understand and manage your diabetes effectively",
      status: "active",
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      targetEndDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
      currentPhase: 2,
      totalPhases: 4,
      overallProgress: 35,
      lastActivityAt: new Date().toISOString(),
      aiPersonalizationLevel: "high",
      adaptationHistory: [
        {
          id: "adapt-1",
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          reason: "High engagement with nutrition content",
          changes: ["Added advanced meal planning module", "Increased nutrition quiz difficulty"],
          triggerType: "engagement"
        }
      ],
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.journeys.set(sampleJourney.id, sampleJourney);

    const sampleModules: EducationalModule[] = [
      {
        id: "module-1",
        journeyId: "journey-1",
        title: "Understanding Diabetes Basics",
        description: "Learn the fundamentals of diabetes, including how your body processes glucose",
        type: "interactive",
        difficulty: "beginner",
        estimatedMinutes: 15,
        phase: 1,
        order: 1,
        content: {
          sections: [
            {
              id: "sec-1",
              title: "What is Diabetes?",
              content: "Diabetes is a chronic condition that affects how your body turns food into energy. When you eat, your body breaks down most food into sugar (glucose) and releases it into your bloodstream."
            },
            {
              id: "sec-2",
              title: "Types of Diabetes",
              content: "There are three main types: Type 1, Type 2, and Gestational diabetes. Type 2 is the most common, affecting about 90-95% of people with diabetes."
            }
          ],
          quiz: [
            {
              id: "q-1",
              question: "What percentage of diabetics have Type 2 diabetes?",
              options: ["50-60%", "70-80%", "90-95%", "100%"],
              correctAnswer: 2,
              explanation: "Type 2 diabetes accounts for approximately 90-95% of all diabetes cases.",
              points: 10
            }
          ]
        },
        prerequisites: [],
        status: "completed",
        progress: 100,
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        score: 90,
        attempts: 1
      },
      {
        id: "module-2",
        journeyId: "journey-1",
        title: "Blood Sugar Monitoring",
        description: "Master the art of monitoring your blood glucose levels effectively",
        type: "interactive",
        difficulty: "beginner",
        estimatedMinutes: 20,
        phase: 1,
        order: 2,
        content: {
          sections: [
            {
              id: "sec-1",
              title: "Why Monitor Blood Sugar?",
              content: "Regular monitoring helps you understand how food, activity, and medications affect your blood sugar levels."
            }
          ],
          checklist: [
            { id: "check-1", text: "I know my target blood sugar range", completed: true, completedAt: new Date().toISOString() },
            { id: "check-2", text: "I have a glucose meter", completed: true, completedAt: new Date().toISOString() },
            { id: "check-3", text: "I know when to test", completed: false }
          ]
        },
        prerequisites: ["module-1"],
        status: "in_progress",
        progress: 65,
        attempts: 0
      },
      {
        id: "module-3",
        journeyId: "journey-1",
        title: "Nutrition Fundamentals",
        description: "Discover how to make smart food choices for better blood sugar control",
        type: "article",
        difficulty: "intermediate",
        estimatedMinutes: 25,
        phase: 2,
        order: 1,
        content: {
          sections: [
            {
              id: "sec-1",
              title: "Carbohydrate Counting",
              content: "Carbohydrates have the biggest impact on blood sugar. Learning to count carbs can help you manage your levels more effectively."
            }
          ],
          resources: [
            { id: "res-1", title: "Carb Counting Guide PDF", url: "/resources/carb-counting.pdf", type: "pdf" },
            { id: "res-2", title: "Healthy Recipes Video", url: "/resources/recipes", type: "video" }
          ]
        },
        prerequisites: ["module-2"],
        status: "available",
        progress: 0,
        attempts: 0
      },
      {
        id: "module-4",
        journeyId: "journey-1",
        title: "Exercise and Diabetes",
        description: "Learn how physical activity affects blood sugar and create your exercise plan",
        type: "video",
        difficulty: "intermediate",
        estimatedMinutes: 30,
        phase: 2,
        order: 2,
        content: {
          sections: [
            {
              id: "sec-1",
              title: "Benefits of Exercise",
              content: "Regular physical activity helps your body use insulin more efficiently and can lower blood sugar levels."
            }
          ]
        },
        prerequisites: ["module-2"],
        status: "locked",
        progress: 0,
        attempts: 0
      }
    ];

    sampleModules.forEach(m => this.modules.set(m.id, m));

    const sampleTasks: CarePlanTask[] = [
      {
        id: "task-1",
        journeyId: "journey-1",
        title: "Morning Blood Sugar Check",
        description: "Check your fasting blood sugar before breakfast",
        category: "monitoring",
        frequency: "daily",
        scheduledTime: "07:00",
        reminderEnabled: true,
        status: "completed",
        dueDate: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        streakCount: 12,
        pointsValue: 15,
        adaptivePriority: 1
      },
      {
        id: "task-2",
        journeyId: "journey-1",
        title: "30-Minute Walk",
        description: "Take a brisk 30-minute walk to help manage blood sugar",
        category: "exercise",
        frequency: "daily",
        scheduledTime: "18:00",
        reminderEnabled: true,
        status: "pending",
        dueDate: new Date().toISOString(),
        streakCount: 5,
        pointsValue: 25,
        adaptivePriority: 2,
        aiSuggestion: "Based on your recent progress, try adding 5 extra minutes today!"
      },
      {
        id: "task-3",
        journeyId: "journey-1",
        title: "Take Medication",
        description: "Take your prescribed diabetes medication",
        category: "medication",
        frequency: "daily",
        scheduledTime: "08:00",
        reminderEnabled: true,
        status: "completed",
        dueDate: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        streakCount: 14,
        pointsValue: 20,
        adaptivePriority: 1
      },
      {
        id: "task-4",
        journeyId: "journey-1",
        title: "Log Your Meals",
        description: "Record what you eat in your food diary",
        category: "diet",
        frequency: "daily",
        scheduledTime: "20:00",
        reminderEnabled: true,
        status: "pending",
        dueDate: new Date().toISOString(),
        streakCount: 8,
        pointsValue: 10,
        adaptivePriority: 3
      }
    ];

    sampleTasks.forEach(t => this.carePlanTasks.set(t.id, t));

    const sampleProfile: GamificationProfile = {
      id: "gam-1",
      patientId: "patient-1",
      totalPoints: 2450,
      level: 5,
      levelTitle: "Health Champion",
      nextLevelPoints: 3000,
      currentStreak: 12,
      longestStreak: 18,
      badges: [
        {
          id: "badge-1",
          name: "First Steps",
          description: "Completed your first educational module",
          icon: "footprints",
          category: "milestone",
          earnedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          rarity: "common"
        },
        {
          id: "badge-2",
          name: "Week Warrior",
          description: "Completed all daily tasks for 7 consecutive days",
          icon: "flame",
          category: "streak",
          earnedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          rarity: "rare"
        },
        {
          id: "badge-3",
          name: "Knowledge Seeker",
          description: "Scored 90% or higher on 3 quizzes",
          icon: "brain",
          category: "learning",
          earnedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          rarity: "rare"
        }
      ],
      achievements: [
        {
          id: "ach-1",
          name: "Consistent Checker",
          description: "Log blood sugar 30 times",
          icon: "target",
          progress: 24,
          target: 30,
          pointsReward: 100,
          unlocked: false,
          category: "monitoring"
        },
        {
          id: "ach-2",
          name: "Active Lifestyle",
          description: "Complete 20 exercise tasks",
          icon: "activity",
          progress: 15,
          target: 20,
          pointsReward: 150,
          unlocked: false,
          category: "exercise"
        },
        {
          id: "ach-3",
          name: "Module Master",
          description: "Complete all Phase 1 modules",
          icon: "graduation-cap",
          progress: 1,
          target: 2,
          pointsReward: 200,
          unlocked: false,
          category: "learning"
        }
      ],
      weeklyGoalProgress: 65,
      weeklyGoalTarget: 100,
      leaderboardRank: 42,
      engagementScore: 85
    };
    this.gamificationProfiles.set(sampleProfile.patientId, sampleProfile);

    const sampleInsights: JourneyInsight[] = [
      {
        id: "insight-1",
        journeyId: "journey-1",
        type: "celebration",
        title: "Amazing Streak!",
        message: "You've maintained a 12-day streak of morning blood sugar checks. Keep up the great work!",
        priority: "medium",
        actionable: false,
        createdAt: new Date().toISOString(),
        dismissed: false,
        aiGenerated: true,
        disclaimer: this.NO_CDS_DISCLAIMER
      },
      {
        id: "insight-2",
        journeyId: "journey-1",
        type: "recommendation",
        title: "Ready for More?",
        message: "Based on your excellent progress with nutrition content, we recommend starting the Advanced Meal Planning module.",
        priority: "medium",
        actionable: true,
        suggestedAction: "Start Advanced Meal Planning Module",
        createdAt: new Date().toISOString(),
        dismissed: false,
        aiGenerated: true,
        disclaimer: this.NO_CDS_DISCLAIMER
      }
    ];
    sampleInsights.forEach(i => this.insights.set(i.id, i));
  }

  async getJourneyDashboard(patientId: string) {
    const journey = Array.from(this.journeys.values()).find(j => j.patientId === patientId);
    const modules = Array.from(this.modules.values()).filter(m => m.journeyId === journey?.id);
    const tasks = Array.from(this.carePlanTasks.values()).filter(t => t.journeyId === journey?.id);
    const profile = this.gamificationProfiles.get(patientId);
    const journeyInsights = Array.from(this.insights.values()).filter(i => i.journeyId === journey?.id && !i.dismissed);

    const todayTasks = tasks.filter(t => {
      const dueDate = new Date(t.dueDate).toDateString();
      const today = new Date().toDateString();
      return dueDate === today;
    });

    const completedToday = todayTasks.filter(t => t.status === 'completed').length;
    const pendingToday = todayTasks.filter(t => t.status === 'pending').length;

    return {
      journey,
      modules: {
        total: modules.length,
        completed: modules.filter(m => m.status === 'completed').length,
        inProgress: modules.filter(m => m.status === 'in_progress').length,
        available: modules.filter(m => m.status === 'available').length,
        list: modules.sort((a, b) => a.phase - b.phase || a.order - b.order)
      },
      tasks: {
        today: todayTasks,
        completedToday,
        pendingToday,
        streakDays: profile?.currentStreak || 0
      },
      gamification: profile,
      insights: journeyInsights,
      disclaimer: this.NO_CDS_DISCLAIMER
    };
  }

  async getJourneyById(journeyId: string) {
    return this.journeys.get(journeyId);
  }

  async getPatientJourneys(patientId: string) {
    return Array.from(this.journeys.values()).filter(j => j.patientId === patientId);
  }

  async createJourney(data: {
    patientId: string;
    conditionType: HealthJourney['conditionType'];
    title: string;
    description: string;
    durationWeeks: number;
  }): Promise<HealthJourney> {
    const id = `journey-${Date.now()}`;
    const now = new Date();
    const targetEnd = new Date(now.getTime() + data.durationWeeks * 7 * 24 * 60 * 60 * 1000);

    const journey: HealthJourney = {
      id,
      patientId: data.patientId,
      conditionType: data.conditionType,
      title: data.title,
      description: data.description,
      status: 'active',
      startDate: now.toISOString(),
      targetEndDate: targetEnd.toISOString(),
      currentPhase: 1,
      totalPhases: Math.ceil(data.durationWeeks / 3),
      overallProgress: 0,
      lastActivityAt: now.toISOString(),
      aiPersonalizationLevel: 'medium',
      adaptationHistory: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    this.journeys.set(id, journey);

    await this.generateInitialModules(journey);
    await this.generateInitialTasks(journey);
    this.initializeGamificationProfile(data.patientId);

    return journey;
  }

  private async generateInitialModules(journey: HealthJourney) {
    const moduleTemplates = this.getModuleTemplatesForCondition(journey.conditionType);
    
    for (let i = 0; i < moduleTemplates.length; i++) {
      const template = moduleTemplates[i];
      const module: EducationalModule = {
        id: `module-${journey.id}-${i + 1}`,
        journeyId: journey.id,
        title: template.title || "Educational Module",
        description: template.description || "Learn about your health condition",
        type: template.type || "interactive",
        difficulty: template.difficulty || "beginner",
        estimatedMinutes: template.estimatedMinutes || 15,
        phase: template.phase || 1,
        order: template.order || i + 1,
        content: template.content || { sections: [] },
        prerequisites: i > 0 ? [`module-${journey.id}-${i}`] : [],
        status: i === 0 ? 'available' : 'locked',
        progress: 0,
        attempts: 0
      };
      this.modules.set(module.id, module);
    }
  }

  private getModuleTemplatesForCondition(condition: string) {
    const templates: Record<string, Partial<EducationalModule>[]> = {
      diabetes: [
        { title: "Understanding Your Diagnosis", description: "Learn the basics of diabetes management", type: "interactive", difficulty: "beginner", estimatedMinutes: 15, phase: 1, order: 1, content: { sections: [{ id: "s1", title: "Introduction", content: "Welcome to your diabetes management journey." }] } },
        { title: "Blood Sugar Basics", description: "Master blood glucose monitoring", type: "interactive", difficulty: "beginner", estimatedMinutes: 20, phase: 1, order: 2, content: { sections: [{ id: "s1", title: "Monitoring", content: "Regular monitoring is key to management." }] } },
        { title: "Nutrition Essentials", description: "Smart eating for blood sugar control", type: "article", difficulty: "intermediate", estimatedMinutes: 25, phase: 2, order: 1, content: { sections: [{ id: "s1", title: "Carbs", content: "Understanding carbohydrates and their impact." }] } },
      ],
      hypertension: [
        { title: "Blood Pressure Fundamentals", description: "Understanding your numbers", type: "interactive", difficulty: "beginner", estimatedMinutes: 15, phase: 1, order: 1, content: { sections: [{ id: "s1", title: "Introduction", content: "Learn what your blood pressure readings mean." }] } },
        { title: "Heart-Healthy Diet", description: "The DASH diet approach", type: "article", difficulty: "beginner", estimatedMinutes: 20, phase: 1, order: 2, content: { sections: [{ id: "s1", title: "DASH", content: "Dietary approaches to stop hypertension." }] } },
      ],
      heart_disease: [
        { title: "Heart Health Basics", description: "Understanding cardiovascular health", type: "interactive", difficulty: "beginner", estimatedMinutes: 20, phase: 1, order: 1, content: { sections: [{ id: "s1", title: "Introduction", content: "Your heart is a remarkable organ." }] } },
      ]
    };

    return templates[condition] || templates.diabetes;
  }

  private async generateInitialTasks(journey: HealthJourney) {
    const taskTemplates = [
      { title: "Daily Health Check-in", category: "monitoring", frequency: "daily", pointsValue: 10 },
      { title: "Complete Today's Module", category: "lifestyle", frequency: "daily", pointsValue: 25 },
      { title: "Log Your Symptoms", category: "monitoring", frequency: "daily", pointsValue: 15 }
    ];

    for (let i = 0; i < taskTemplates.length; i++) {
      const template = taskTemplates[i];
      const task: CarePlanTask = {
        id: `task-${journey.id}-${i + 1}`,
        journeyId: journey.id,
        title: template.title,
        description: `Complete your ${template.title.toLowerCase()}`,
        category: template.category as CarePlanTask['category'],
        frequency: template.frequency as CarePlanTask['frequency'],
        reminderEnabled: true,
        status: 'pending',
        dueDate: new Date().toISOString(),
        streakCount: 0,
        pointsValue: template.pointsValue,
        adaptivePriority: i + 1
      };
      this.carePlanTasks.set(task.id, task);
    }
  }

  private initializeGamificationProfile(patientId: string) {
    if (this.gamificationProfiles.has(patientId)) return;

    const profile: GamificationProfile = {
      id: `gam-${patientId}`,
      patientId,
      totalPoints: 0,
      level: 1,
      levelTitle: "Health Beginner",
      nextLevelPoints: 500,
      currentStreak: 0,
      longestStreak: 0,
      badges: [],
      achievements: [
        { id: "ach-first-module", name: "First Steps", description: "Complete your first module", icon: "footprints", progress: 0, target: 1, pointsReward: 50, unlocked: false, category: "learning" },
        { id: "ach-week-streak", name: "Week Warrior", description: "Maintain a 7-day streak", icon: "flame", progress: 0, target: 7, pointsReward: 100, unlocked: false, category: "streak" },
        { id: "ach-task-master", name: "Task Master", description: "Complete 50 tasks", icon: "check-circle", progress: 0, target: 50, pointsReward: 200, unlocked: false, category: "tasks" }
      ],
      weeklyGoalProgress: 0,
      weeklyGoalTarget: 100,
      engagementScore: 0
    };

    this.gamificationProfiles.set(patientId, profile);
  }

  async getEducationalModules(journeyId: string) {
    return Array.from(this.modules.values())
      .filter(m => m.journeyId === journeyId)
      .sort((a, b) => a.phase - b.phase || a.order - b.order);
  }

  async getModuleById(moduleId: string) {
    return this.modules.get(moduleId);
  }

  async updateModuleProgress(moduleId: string, progress: number, quizScore?: number): Promise<EducationalModule | null> {
    const module = this.modules.get(moduleId);
    if (!module) return null;

    module.progress = progress;
    if (quizScore !== undefined) {
      module.score = quizScore;
      module.attempts++;
    }

    if (progress >= 100) {
      module.status = 'completed';
      module.completedAt = new Date().toISOString();

      const journey = this.journeys.get(module.journeyId);
      if (journey) {
        const patientProfile = this.gamificationProfiles.get(journey.patientId);
        if (patientProfile) {
          await this.awardPoints(journey.patientId, 50, "Module completion");
          await this.checkAndAwardBadges(journey.patientId, 'module_complete');
        }
      }

      await this.unlockNextModules(module.journeyId, moduleId);
    } else if (progress > 0) {
      module.status = 'in_progress';
    }

    this.modules.set(moduleId, module);
    return module;
  }

  private async unlockNextModules(journeyId: string, completedModuleId: string) {
    const modules = Array.from(this.modules.values()).filter(m => m.journeyId === journeyId);
    
    for (const module of modules) {
      if (module.status === 'locked' && module.prerequisites.includes(completedModuleId)) {
        const allPrereqsComplete = module.prerequisites.every(prereqId => {
          const prereq = this.modules.get(prereqId);
          return prereq?.status === 'completed';
        });
        
        if (allPrereqsComplete) {
          module.status = 'available';
          this.modules.set(module.id, module);
        }
      }
    }
  }

  async getCarePlanTasks(journeyId: string, filter?: { status?: string; category?: string }) {
    let tasks = Array.from(this.carePlanTasks.values()).filter(t => t.journeyId === journeyId);
    
    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter?.category) {
      tasks = tasks.filter(t => t.category === filter.category);
    }

    return tasks.sort((a, b) => a.adaptivePriority - b.adaptivePriority);
  }

  async completeTask(taskId: string): Promise<{ task: CarePlanTask; pointsEarned: number; newBadges: Badge[] }> {
    const task = this.carePlanTasks.get(taskId);
    if (!task) throw new Error("Task not found");

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.streakCount++;

    this.carePlanTasks.set(taskId, task);

    const journey = this.journeys.get(task.journeyId);
    if (!journey) throw new Error("Journey not found");

    const pointsEarned = task.pointsValue * (1 + Math.floor(task.streakCount / 7) * 0.1);
    await this.awardPoints(journey.patientId, Math.round(pointsEarned), "Task completion");

    const newBadges = await this.checkAndAwardBadges(journey.patientId, 'task_complete', { streakCount: task.streakCount });

    await this.updateAchievementProgress(journey.patientId, task.category);

    return { task, pointsEarned: Math.round(pointsEarned), newBadges };
  }

  async skipTask(taskId: string, reason?: string): Promise<CarePlanTask> {
    const task = this.carePlanTasks.get(taskId);
    if (!task) throw new Error("Task not found");

    task.status = 'skipped';
    task.streakCount = 0;

    this.carePlanTasks.set(taskId, task);
    return task;
  }

  async getGamificationProfile(patientId: string): Promise<GamificationProfile | undefined> {
    return this.gamificationProfiles.get(patientId);
  }

  private async awardPoints(patientId: string, points: number, reason: string) {
    const profile = this.gamificationProfiles.get(patientId);
    if (!profile) return;

    profile.totalPoints += points;

    const levelThresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000];
    const levelTitles = ["Health Beginner", "Health Explorer", "Health Achiever", "Health Champion", "Health Master", "Health Expert", "Health Guru", "Health Legend"];

    for (let i = levelThresholds.length - 1; i >= 0; i--) {
      if (profile.totalPoints >= levelThresholds[i]) {
        profile.level = i + 1;
        profile.levelTitle = levelTitles[i];
        profile.nextLevelPoints = levelThresholds[i + 1] || levelThresholds[i] * 2;
        break;
      }
    }

    this.gamificationProfiles.set(patientId, profile);
  }

  private async checkAndAwardBadges(patientId: string, eventType: string, data?: Record<string, unknown>): Promise<Badge[]> {
    const profile = this.gamificationProfiles.get(patientId);
    if (!profile) return [];

    const newBadges: Badge[] = [];

    if (eventType === 'task_complete' && data?.streakCount === 7) {
      const hasWeekBadge = profile.badges.some(b => b.id === 'badge-week-warrior');
      if (!hasWeekBadge) {
        const badge: Badge = {
          id: 'badge-week-warrior',
          name: 'Week Warrior',
          description: 'Completed all daily tasks for 7 consecutive days',
          icon: 'flame',
          category: 'streak',
          earnedAt: new Date().toISOString(),
          rarity: 'rare'
        };
        profile.badges.push(badge);
        newBadges.push(badge);
      }
    }

    if (eventType === 'module_complete') {
      const hasFirstModuleBadge = profile.badges.some(b => b.id === 'badge-first-module');
      if (!hasFirstModuleBadge) {
        const badge: Badge = {
          id: 'badge-first-module',
          name: 'First Steps',
          description: 'Completed your first educational module',
          icon: 'footprints',
          category: 'milestone',
          earnedAt: new Date().toISOString(),
          rarity: 'common'
        };
        profile.badges.push(badge);
        newBadges.push(badge);
      }
    }

    if (profile.currentStreak >= profile.longestStreak) {
      profile.longestStreak = profile.currentStreak;
    }

    this.gamificationProfiles.set(patientId, profile);
    return newBadges;
  }

  private async updateAchievementProgress(patientId: string, category: string) {
    const profile = this.gamificationProfiles.get(patientId);
    if (!profile) return;

    for (const achievement of profile.achievements) {
      if (achievement.category === category || achievement.category === 'tasks') {
        if (!achievement.unlocked) {
          achievement.progress++;
          if (achievement.progress >= achievement.target) {
            achievement.unlocked = true;
            achievement.unlockedAt = new Date().toISOString();
            await this.awardPoints(patientId, achievement.pointsReward, `Achievement unlocked: ${achievement.name}`);
          }
        }
      }
    }

    this.gamificationProfiles.set(patientId, profile);
  }

  async getLeaderboard(limit: number = 10) {
    const profiles = Array.from(this.gamificationProfiles.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map((p, index) => ({
        rank: index + 1,
        patientId: p.patientId,
        level: p.level,
        levelTitle: p.levelTitle,
        totalPoints: p.totalPoints,
        currentStreak: p.currentStreak
      }));

    return profiles;
  }

  async getJourneyInsights(journeyId: string) {
    return Array.from(this.insights.values())
      .filter(i => i.journeyId === journeyId && !i.dismissed)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async dismissInsight(insightId: string) {
    const insight = this.insights.get(insightId);
    if (insight) {
      insight.dismissed = true;
      this.insights.set(insightId, insight);
    }
    return insight;
  }

  async generateAIRecommendations(journeyId: string): Promise<JourneyInsight[]> {
    const journey = this.journeys.get(journeyId);
    if (!journey) return [];

    if (!this.openaiAvailable || !openai) {
      return this.getFallbackRecommendations(journey);
    }

    try {
      const modules = await this.getEducationalModules(journeyId);
      const tasks = await this.getCarePlanTasks(journeyId);
      const profile = this.gamificationProfiles.get(journey.patientId);

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a health journey advisor helping patients manage chronic conditions. Generate personalized, encouraging recommendations based on their progress.
            
IMPORTANT: 
- Keep recommendations brief and actionable
- Focus on positive reinforcement
- Never provide specific medical advice
- Return a JSON array of 2-3 recommendations

Each recommendation should have:
- type: "progress" | "recommendation" | "alert" | "celebration"
- title: Short title (5 words max)
- message: Encouraging message (2-3 sentences)
- priority: "low" | "medium" | "high"
- actionable: boolean
- suggestedAction: string if actionable`
          },
          {
            role: "user",
            content: `Patient journey data:
- Condition: ${journey.conditionType}
- Overall progress: ${journey.overallProgress}%
- Current phase: ${journey.currentPhase}/${journey.totalPhases}
- Modules completed: ${modules.filter(m => m.status === 'completed').length}/${modules.length}
- Current streak: ${profile?.currentStreak || 0} days
- Level: ${profile?.level || 1} (${profile?.levelTitle || 'Beginner'})
- Points: ${profile?.totalPoints || 0}
- Tasks completed today: ${tasks.filter(t => t.status === 'completed').length}/${tasks.length}

Generate personalized recommendations.`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return this.getFallbackRecommendations(journey);

      const recommendations = JSON.parse(content);
      const insights: JourneyInsight[] = recommendations.map((rec: Record<string, unknown>, index: number) => ({
        id: `insight-ai-${Date.now()}-${index}`,
        journeyId,
        type: rec.type,
        title: rec.title,
        message: rec.message,
        priority: rec.priority,
        actionable: rec.actionable,
        suggestedAction: rec.suggestedAction,
        createdAt: new Date().toISOString(),
        dismissed: false,
        aiGenerated: true,
        disclaimer: this.NO_CDS_DISCLAIMER
      }));

      insights.forEach(i => this.insights.set(i.id, i));
      return insights;

    } catch (error) {
      console.error("[PersonalizedHealthJourney] AI recommendation error:", error);
      return this.getFallbackRecommendations(journey);
    }
  }

  private getFallbackRecommendations(journey: HealthJourney): JourneyInsight[] {
    const insights: JourneyInsight[] = [
      {
        id: `insight-fallback-${Date.now()}-1`,
        journeyId: journey.id,
        type: 'recommendation',
        title: 'Keep Up the Momentum',
        message: 'You\'re making great progress on your health journey. Consider completing your next educational module to continue learning.',
        priority: 'medium',
        actionable: true,
        suggestedAction: 'View Available Modules',
        createdAt: new Date().toISOString(),
        dismissed: false,
        aiGenerated: false,
        disclaimer: this.NO_CDS_DISCLAIMER
      }
    ];

    if (journey.overallProgress >= 50) {
      insights.push({
        id: `insight-fallback-${Date.now()}-2`,
        journeyId: journey.id,
        type: 'celebration',
        title: 'Halfway There!',
        message: 'Congratulations on reaching the halfway point of your journey. Your dedication to your health is inspiring!',
        priority: 'high',
        actionable: false,
        createdAt: new Date().toISOString(),
        dismissed: false,
        aiGenerated: false,
        disclaimer: this.NO_CDS_DISCLAIMER
      });
    }

    insights.forEach(i => this.insights.set(i.id, i));
    return insights;
  }

  async adaptJourneyBasedOnProgress(journeyId: string): Promise<JourneyAdaptation | null> {
    const journey = this.journeys.get(journeyId);
    if (!journey) return null;

    const modules = await this.getEducationalModules(journeyId);
    const profile = this.gamificationProfiles.get(journey.patientId);

    const completedModules = modules.filter(m => m.status === 'completed');
    const avgScore = completedModules.length > 0
      ? completedModules.reduce((sum, m) => sum + (m.score || 0), 0) / completedModules.length
      : 0;

    const changes: string[] = [];
    let reason = '';

    if (avgScore >= 90 && profile?.engagementScore && profile.engagementScore >= 80) {
      reason = "Excellent performance detected";
      changes.push("Unlocked advanced content");
      changes.push("Increased quiz difficulty");
      journey.aiPersonalizationLevel = 'high';
    } else if (avgScore < 60 || (profile?.currentStreak || 0) < 3) {
      reason = "Additional support may be beneficial";
      changes.push("Added supplementary learning materials");
      changes.push("Simplified upcoming content");
      journey.aiPersonalizationLevel = 'high';
    }

    if (changes.length === 0) return null;

    const adaptation: JourneyAdaptation = {
      id: `adapt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason,
      changes,
      triggerType: 'ai_recommendation'
    };

    journey.adaptationHistory.push(adaptation);
    journey.updatedAt = new Date().toISOString();
    this.journeys.set(journeyId, journey);

    return adaptation;
  }

  async updateStreakForPatient(patientId: string) {
    const profile = this.gamificationProfiles.get(patientId);
    if (!profile) return;

    profile.currentStreak++;
    if (profile.currentStreak > profile.longestStreak) {
      profile.longestStreak = profile.currentStreak;
    }

    const streakAchievement = profile.achievements.find(a => a.category === 'streak');
    if (streakAchievement) {
      streakAchievement.progress = profile.currentStreak;
    }

    this.gamificationProfiles.set(patientId, profile);
  }

  async getConditionTypes() {
    return [
      { id: 'diabetes', name: 'Diabetes', description: 'Type 1 and Type 2 diabetes management' },
      { id: 'hypertension', name: 'Hypertension', description: 'High blood pressure management' },
      { id: 'heart_disease', name: 'Heart Disease', description: 'Cardiovascular health management' },
      { id: 'asthma', name: 'Asthma', description: 'Respiratory condition management' },
      { id: 'copd', name: 'COPD', description: 'Chronic obstructive pulmonary disease' },
      { id: 'arthritis', name: 'Arthritis', description: 'Joint health and mobility' },
      { id: 'obesity', name: 'Weight Management', description: 'Healthy weight goals' },
      { id: 'mental_health', name: 'Mental Wellness', description: 'Stress and anxiety management' }
    ];
  }
}

export const personalizedHealthJourneyService = new PersonalizedHealthJourneyService();
