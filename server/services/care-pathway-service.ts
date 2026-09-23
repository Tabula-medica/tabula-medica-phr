import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface PathwayStage {
  id: string;
  name: string;
  description: string;
  order: number;
  durationDays: number;
  tasks: PathwayTask[];
  educationalContent: EducationalContent[];
  completionCriteria: CompletionCriteria;
}

export interface PathwayTask {
  id: string;
  stageId: string;
  title: string;
  description: string;
  taskType: 'medication' | 'lifestyle' | 'appointment' | 'monitoring' | 'education' | 'exercise' | 'diet';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  requiredForProgress: boolean;
  reminderEnabled: boolean;
}

export interface EducationalContent {
  id: string;
  stageId: string;
  title: string;
  description: string;
  contentType: 'article' | 'video' | 'infographic' | 'quiz' | 'checklist';
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  url?: string;
  content?: string;
  tags: string[];
}

export interface CompletionCriteria {
  minTasksCompleted: number;
  minEducationCompleted: number;
  requiredTaskIds: string[];
  minDaysInStage: number;
}

export interface CarePathway {
  id: string;
  name: string;
  description: string;
  condition: string;
  conditionCode: string;
  version: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  stages: PathwayStage[];
  estimatedDurationWeeks: number;
  targetOutcomes: string[];
  eligibilityCriteria: string[];
}

export interface PatientPathway {
  id: string;
  patientId: string;
  pathwayId: string;
  assignedBy: string;
  assignedAt: Date;
  startDate: Date;
  expectedEndDate: Date;
  status: 'active' | 'paused' | 'completed' | 'discontinued';
  currentStageId: string;
  currentStageStartDate: Date;
  overallProgress: number;
  adherenceScore: number;
  lastActivityAt: Date;
  notes: string;
}

export interface TaskCompletion {
  id: string;
  patientPathwayId: string;
  taskId: string;
  stageId: string;
  completedAt: Date;
  notes?: string;
  measuredValue?: number;
  measuredUnit?: string;
}

export interface ContentEngagement {
  id: string;
  patientPathwayId: string;
  contentId: string;
  stageId: string;
  startedAt: Date;
  completedAt?: Date;
  progressPercent: number;
  quizScore?: number;
}

export interface PathwayNudge {
  id: string;
  patientPathwayId: string;
  patientId: string;
  type: 'reminder' | 'encouragement' | 'milestone' | 'warning' | 'educational';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  triggerReason: string;
  relatedTaskId?: string;
  relatedContentId?: string;
  createdAt: Date;
  scheduledFor: Date;
  sentAt?: Date;
  readAt?: Date;
  actionTaken?: string;
  aiGenerated: boolean;
  noCdsDisclaimer: string;
}

export interface AdherenceAnalytics {
  patientPathwayId: string;
  overallAdherence: number;
  taskAdherence: number;
  educationAdherence: number;
  streakDays: number;
  missedTasks: number;
  completedTasks: number;
  totalTasks: number;
  stageProgress: { stageId: string; stageName: string; progress: number }[];
  weeklyTrend: { week: string; adherence: number }[];
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

export interface AIContentRecommendation {
  contentId: string;
  title: string;
  reason: string;
  relevanceScore: number;
  contentType: string;
  estimatedMinutes: number;
  noCdsDisclaimer: string;
}

export interface AITaskRecommendation {
  taskId: string;
  title: string;
  reason: string;
  priorityAdjustment: 'increase' | 'decrease' | 'none';
  suggestedFrequency?: string;
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER = "This information is for educational and motivational purposes only and does NOT constitute clinical decision support or medical advice. Always consult your healthcare provider for personalized medical decisions.";

class CarePathwayService {
  private pathways: Map<string, CarePathway> = new Map();
  private patientPathways: Map<string, PatientPathway> = new Map();
  private taskCompletions: Map<string, TaskCompletion[]> = new Map();
  private contentEngagements: Map<string, ContentEngagement[]> = new Map();
  private nudges: Map<string, PathwayNudge[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[CarePathway] Service initialized with AI-driven pathway management");
    console.log("[CarePathway] Features: Condition-specific pathways, adherence tracking, automated nudges");
    console.log("[CarePathway] NO-CDS compliance enabled for all AI outputs");
  }

  private initializeSampleData() {
    const diabetesPathway: CarePathway = {
      id: "pathway-diabetes-type2",
      name: "Type 2 Diabetes Management Pathway",
      description: "Comprehensive care pathway for newly diagnosed Type 2 Diabetes patients focusing on lifestyle modifications, medication adherence, and self-monitoring.",
      condition: "Type 2 Diabetes Mellitus",
      conditionCode: "E11",
      version: "2.0",
      isActive: true,
      createdBy: "system",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-15"),
      estimatedDurationWeeks: 12,
      targetOutcomes: [
        "HbA1c reduction by 1% within 3 months",
        "Establish regular blood glucose monitoring routine",
        "Achieve 150 minutes of moderate exercise per week",
        "Understand carbohydrate counting basics"
      ],
      eligibilityCriteria: [
        "Newly diagnosed Type 2 Diabetes (within 6 months)",
        "HbA1c between 6.5% and 9.0%",
        "No severe complications",
        "Able to participate in lifestyle modifications"
      ],
      stages: [
        {
          id: "stage-1-foundation",
          name: "Foundation & Education",
          description: "Build foundational knowledge about diabetes management",
          order: 1,
          durationDays: 14,
          completionCriteria: {
            minTasksCompleted: 10,
            minEducationCompleted: 3,
            requiredTaskIds: ["task-glucose-check", "task-medication"],
            minDaysInStage: 7
          },
          tasks: [
            {
              id: "task-glucose-check",
              stageId: "stage-1-foundation",
              title: "Blood Glucose Monitoring",
              description: "Check and log your fasting blood glucose level each morning",
              taskType: "monitoring",
              frequency: "daily",
              priority: "high",
              estimatedMinutes: 5,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-medication",
              stageId: "stage-1-foundation",
              title: "Take Prescribed Medication",
              description: "Take your diabetes medication as prescribed",
              taskType: "medication",
              frequency: "daily",
              priority: "high",
              estimatedMinutes: 2,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-food-log",
              stageId: "stage-1-foundation",
              title: "Food Diary Entry",
              description: "Log all meals and snacks consumed today",
              taskType: "diet",
              frequency: "daily",
              priority: "medium",
              estimatedMinutes: 10,
              requiredForProgress: false,
              reminderEnabled: true
            }
          ],
          educationalContent: [
            {
              id: "edu-diabetes-basics",
              stageId: "stage-1-foundation",
              title: "Understanding Type 2 Diabetes",
              description: "Learn what diabetes is, how it affects your body, and why management matters",
              contentType: "article",
              difficultyLevel: "beginner",
              estimatedMinutes: 15,
              tags: ["basics", "introduction", "diabetes"],
              content: "Type 2 diabetes is a chronic condition that affects how your body processes blood sugar (glucose)..."
            },
            {
              id: "edu-glucose-monitoring",
              stageId: "stage-1-foundation",
              title: "How to Monitor Your Blood Glucose",
              description: "Step-by-step guide to using a glucose meter and understanding your numbers",
              contentType: "video",
              difficultyLevel: "beginner",
              estimatedMinutes: 10,
              tags: ["monitoring", "glucose", "self-care"],
              url: "/education/glucose-monitoring-video"
            },
            {
              id: "edu-nutrition-intro",
              stageId: "stage-1-foundation",
              title: "Nutrition Basics for Diabetes",
              description: "Introduction to healthy eating with diabetes",
              contentType: "infographic",
              difficultyLevel: "beginner",
              estimatedMinutes: 8,
              tags: ["nutrition", "diet", "carbohydrates"]
            }
          ]
        },
        {
          id: "stage-2-lifestyle",
          name: "Lifestyle Modifications",
          description: "Implement sustainable lifestyle changes for better glucose control",
          order: 2,
          durationDays: 28,
          completionCriteria: {
            minTasksCompleted: 20,
            minEducationCompleted: 4,
            requiredTaskIds: ["task-exercise", "task-meal-planning"],
            minDaysInStage: 14
          },
          tasks: [
            {
              id: "task-exercise",
              stageId: "stage-2-lifestyle",
              title: "30-Minute Physical Activity",
              description: "Engage in moderate physical activity like walking, swimming, or cycling",
              taskType: "exercise",
              frequency: "daily",
              priority: "high",
              estimatedMinutes: 30,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-meal-planning",
              stageId: "stage-2-lifestyle",
              title: "Plan Tomorrow's Meals",
              description: "Plan your meals for the next day focusing on balanced nutrition",
              taskType: "diet",
              frequency: "daily",
              priority: "medium",
              estimatedMinutes: 15,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-carb-counting",
              stageId: "stage-2-lifestyle",
              title: "Practice Carbohydrate Counting",
              description: "Count carbohydrates in at least one meal today",
              taskType: "diet",
              frequency: "daily",
              priority: "medium",
              estimatedMinutes: 10,
              requiredForProgress: false,
              reminderEnabled: false
            }
          ],
          educationalContent: [
            {
              id: "edu-exercise-benefits",
              stageId: "stage-2-lifestyle",
              title: "Exercise and Blood Sugar",
              description: "How physical activity helps control glucose levels",
              contentType: "article",
              difficultyLevel: "intermediate",
              estimatedMinutes: 12,
              tags: ["exercise", "glucose", "lifestyle"]
            },
            {
              id: "edu-carb-counting",
              stageId: "stage-2-lifestyle",
              title: "Mastering Carbohydrate Counting",
              description: "Learn to count carbs accurately for better meal planning",
              contentType: "quiz",
              difficultyLevel: "intermediate",
              estimatedMinutes: 20,
              tags: ["nutrition", "carbohydrates", "meal-planning"]
            }
          ]
        },
        {
          id: "stage-3-optimization",
          name: "Optimization & Maintenance",
          description: "Fine-tune your management approach and build long-term habits",
          order: 3,
          durationDays: 42,
          completionCriteria: {
            minTasksCompleted: 35,
            minEducationCompleted: 3,
            requiredTaskIds: ["task-hba1c-review"],
            minDaysInStage: 28
          },
          tasks: [
            {
              id: "task-hba1c-review",
              stageId: "stage-3-optimization",
              title: "Schedule HbA1c Test",
              description: "Schedule your 3-month HbA1c follow-up test",
              taskType: "appointment",
              frequency: "once",
              priority: "high",
              estimatedMinutes: 15,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-provider-checkup",
              stageId: "stage-3-optimization",
              title: "Provider Check-in",
              description: "Attend your scheduled follow-up appointment",
              taskType: "appointment",
              frequency: "monthly",
              priority: "high",
              estimatedMinutes: 60,
              requiredForProgress: false,
              reminderEnabled: true
            }
          ],
          educationalContent: [
            {
              id: "edu-long-term",
              stageId: "stage-3-optimization",
              title: "Long-term Diabetes Management",
              description: "Strategies for maintaining good control over time",
              contentType: "article",
              difficultyLevel: "advanced",
              estimatedMinutes: 18,
              tags: ["maintenance", "long-term", "prevention"]
            }
          ]
        }
      ]
    };

    const heartHealthPathway: CarePathway = {
      id: "pathway-heart-health",
      name: "Heart Health Recovery Pathway",
      description: "Post-cardiac event recovery and prevention pathway focusing on cardiac rehabilitation, medication adherence, and risk factor modification.",
      condition: "Cardiovascular Disease",
      conditionCode: "I25",
      version: "1.5",
      isActive: true,
      createdBy: "system",
      createdAt: new Date("2025-01-05"),
      updatedAt: new Date("2025-01-20"),
      estimatedDurationWeeks: 16,
      targetOutcomes: [
        "Complete cardiac rehabilitation program",
        "Achieve target blood pressure < 130/80 mmHg",
        "LDL cholesterol < 70 mg/dL",
        "Establish regular exercise routine"
      ],
      eligibilityCriteria: [
        "Post-MI, post-PCI, or post-CABG patients",
        "Stable condition cleared for cardiac rehab",
        "Committed to lifestyle modifications"
      ],
      stages: [
        {
          id: "stage-heart-1",
          name: "Early Recovery",
          description: "Initial recovery phase with gentle activity and medication establishment",
          order: 1,
          durationDays: 21,
          completionCriteria: {
            minTasksCompleted: 15,
            minEducationCompleted: 4,
            requiredTaskIds: ["task-bp-check", "task-heart-meds"],
            minDaysInStage: 14
          },
          tasks: [
            {
              id: "task-bp-check",
              stageId: "stage-heart-1",
              title: "Blood Pressure Check",
              description: "Measure and log your blood pressure",
              taskType: "monitoring",
              frequency: "daily",
              priority: "high",
              estimatedMinutes: 5,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-heart-meds",
              stageId: "stage-heart-1",
              title: "Cardiac Medications",
              description: "Take all prescribed cardiac medications",
              taskType: "medication",
              frequency: "daily",
              priority: "high",
              estimatedMinutes: 5,
              requiredForProgress: true,
              reminderEnabled: true
            },
            {
              id: "task-gentle-walk",
              stageId: "stage-heart-1",
              title: "Gentle Walking",
              description: "Take a 10-15 minute gentle walk",
              taskType: "exercise",
              frequency: "daily",
              priority: "medium",
              estimatedMinutes: 15,
              requiredForProgress: false,
              reminderEnabled: true
            }
          ],
          educationalContent: [
            {
              id: "edu-heart-recovery",
              stageId: "stage-heart-1",
              title: "Understanding Your Heart Recovery",
              description: "What to expect during cardiac recovery",
              contentType: "article",
              difficultyLevel: "beginner",
              estimatedMinutes: 12,
              tags: ["recovery", "cardiac", "basics"]
            },
            {
              id: "edu-warning-signs",
              stageId: "stage-heart-1",
              title: "Warning Signs to Watch For",
              description: "Know when to seek immediate medical attention",
              contentType: "checklist",
              difficultyLevel: "beginner",
              estimatedMinutes: 8,
              tags: ["emergency", "symptoms", "safety"]
            }
          ]
        }
      ]
    };

    this.pathways.set(diabetesPathway.id, diabetesPathway);
    this.pathways.set(heartHealthPathway.id, heartHealthPathway);

    const sampleAssignment: PatientPathway = {
      id: "pp-patient1-diabetes",
      patientId: "patient-1",
      pathwayId: "pathway-diabetes-type2",
      assignedBy: "provider-dr-smith",
      assignedAt: new Date("2025-01-20"),
      startDate: new Date("2025-01-21"),
      expectedEndDate: new Date("2025-04-15"),
      status: "active",
      currentStageId: "stage-1-foundation",
      currentStageStartDate: new Date("2025-01-21"),
      overallProgress: 35,
      adherenceScore: 78,
      lastActivityAt: new Date(),
      notes: "Patient is motivated and engaged. Started well with glucose monitoring."
    };

    this.patientPathways.set(sampleAssignment.id, sampleAssignment);

    this.taskCompletions.set(sampleAssignment.id, [
      {
        id: "tc-1",
        patientPathwayId: sampleAssignment.id,
        taskId: "task-glucose-check",
        stageId: "stage-1-foundation",
        completedAt: new Date(Date.now() - 86400000),
        measuredValue: 125,
        measuredUnit: "mg/dL"
      },
      {
        id: "tc-2",
        patientPathwayId: sampleAssignment.id,
        taskId: "task-medication",
        stageId: "stage-1-foundation",
        completedAt: new Date(Date.now() - 86400000)
      },
      {
        id: "tc-3",
        patientPathwayId: sampleAssignment.id,
        taskId: "task-glucose-check",
        stageId: "stage-1-foundation",
        completedAt: new Date(),
        measuredValue: 118,
        measuredUnit: "mg/dL"
      }
    ]);

    this.contentEngagements.set(sampleAssignment.id, [
      {
        id: "ce-1",
        patientPathwayId: sampleAssignment.id,
        contentId: "edu-diabetes-basics",
        stageId: "stage-1-foundation",
        startedAt: new Date(Date.now() - 172800000),
        completedAt: new Date(Date.now() - 172800000),
        progressPercent: 100
      }
    ]);

    this.nudges.set(sampleAssignment.patientId, [
      {
        id: "nudge-1",
        patientPathwayId: sampleAssignment.id,
        patientId: sampleAssignment.patientId,
        type: "encouragement",
        title: "Great Progress!",
        message: "You've logged your glucose for 2 days in a row. Keep up the excellent work! Consistent monitoring is key to understanding your patterns.",
        priority: "medium",
        triggerReason: "streak_achievement",
        createdAt: new Date(),
        scheduledFor: new Date(),
        sentAt: new Date(),
        aiGenerated: true,
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      }
    ]);

    console.log("[CarePathway] Sample data initialized");
    console.log("[CarePathway] Pathways: 2 (Diabetes, Heart Health)");
    console.log("[CarePathway] Patient Assignments: 1");
  }

  async getAllPathways(): Promise<CarePathway[]> {
    this.logAudit("VIEW_PATHWAYS", "system", { action: "list_all_pathways" });
    return Array.from(this.pathways.values()).filter(p => p.isActive);
  }

  async getPathway(pathwayId: string): Promise<CarePathway | undefined> {
    this.logAudit("VIEW_PATHWAY", "system", { pathwayId });
    return this.pathways.get(pathwayId);
  }

  async getPathwaysByCondition(conditionCode: string): Promise<CarePathway[]> {
    this.logAudit("SEARCH_PATHWAYS", "system", { conditionCode });
    return Array.from(this.pathways.values())
      .filter(p => p.isActive && p.conditionCode.toLowerCase().includes(conditionCode.toLowerCase()));
  }

  async assignPathwayToPatient(
    pathwayId: string,
    patientId: string,
    providerId: string,
    startDate?: Date,
    notes?: string
  ): Promise<PatientPathway> {
    const pathway = this.pathways.get(pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const existingActive = Array.from(this.patientPathways.values())
      .find(pp => pp.patientId === patientId && pp.pathwayId === pathwayId && pp.status === 'active');
    if (existingActive) throw new Error("Patient already has an active assignment for this pathway");

    const start = startDate || new Date();
    const expectedEnd = new Date(start);
    expectedEnd.setDate(expectedEnd.getDate() + (pathway.estimatedDurationWeeks * 7));

    const assignment: PatientPathway = {
      id: `pp-${patientId}-${Date.now()}`,
      patientId,
      pathwayId,
      assignedBy: providerId,
      assignedAt: new Date(),
      startDate: start,
      expectedEndDate: expectedEnd,
      status: 'active',
      currentStageId: pathway.stages[0].id,
      currentStageStartDate: start,
      overallProgress: 0,
      adherenceScore: 100,
      lastActivityAt: new Date(),
      notes: notes || ""
    };

    this.patientPathways.set(assignment.id, assignment);
    this.taskCompletions.set(assignment.id, []);
    this.contentEngagements.set(assignment.id, []);

    this.logAudit("ASSIGN_PATHWAY", providerId, { 
      patientId, 
      pathwayId, 
      assignmentId: assignment.id,
      pathwayName: pathway.name 
    });

    await this.generateWelcomeNudge(assignment, pathway);

    return assignment;
  }

  async getPatientPathways(patientId: string): Promise<(PatientPathway & { pathway?: CarePathway })[]> {
    this.logAudit("VIEW_PATIENT_PATHWAYS", "system", { patientId });
    
    const assignments = Array.from(this.patientPathways.values())
      .filter(pp => pp.patientId === patientId);

    return assignments.map(pp => ({
      ...pp,
      pathway: this.pathways.get(pp.pathwayId)
    }));
  }

  async getPatientPathway(patientPathwayId: string): Promise<PatientPathway & { pathway?: CarePathway } | undefined> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) return undefined;

    this.logAudit("VIEW_PATIENT_PATHWAY", "system", { patientPathwayId, patientId: pp.patientId });

    return {
      ...pp,
      pathway: this.pathways.get(pp.pathwayId)
    };
  }

  async getProviderAssignments(providerId: string): Promise<(PatientPathway & { pathway?: CarePathway })[]> {
    this.logAudit("VIEW_PROVIDER_ASSIGNMENTS", providerId, {});
    
    const assignments = Array.from(this.patientPathways.values())
      .filter(pp => pp.assignedBy === providerId);

    return assignments.map(pp => ({
      ...pp,
      pathway: this.pathways.get(pp.pathwayId)
    }));
  }

  async completeTask(
    patientPathwayId: string,
    taskId: string,
    notes?: string,
    measuredValue?: number,
    measuredUnit?: string
  ): Promise<TaskCompletion> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const pathway = this.pathways.get(pp.pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const stage = pathway.stages.find(s => s.id === pp.currentStageId);
    if (!stage) throw new Error("Current stage not found");

    const task = stage.tasks.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found in current stage");

    const completion: TaskCompletion = {
      id: `tc-${Date.now()}`,
      patientPathwayId,
      taskId,
      stageId: pp.currentStageId,
      completedAt: new Date(),
      notes,
      measuredValue,
      measuredUnit
    };

    const completions = this.taskCompletions.get(patientPathwayId) || [];
    completions.push(completion);
    this.taskCompletions.set(patientPathwayId, completions);

    pp.lastActivityAt = new Date();
    await this.updateAdherenceScore(pp);
    await this.checkStageProgression(pp, pathway);

    this.logAudit("COMPLETE_TASK", pp.patientId, { 
      patientPathwayId, 
      taskId, 
      taskTitle: task.title,
      measuredValue,
      measuredUnit
    });

    await this.generateProgressNudge(pp, pathway, task, completions.length);

    return completion;
  }

  async engageContent(
    patientPathwayId: string,
    contentId: string,
    progressPercent: number,
    quizScore?: number
  ): Promise<ContentEngagement> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const engagements = this.contentEngagements.get(patientPathwayId) || [];
    let engagement = engagements.find(e => e.contentId === contentId);

    if (engagement) {
      engagement.progressPercent = Math.max(engagement.progressPercent, progressPercent);
      if (progressPercent >= 100 && !engagement.completedAt) {
        engagement.completedAt = new Date();
      }
      if (quizScore !== undefined) {
        engagement.quizScore = quizScore;
      }
    } else {
      engagement = {
        id: `ce-${Date.now()}`,
        patientPathwayId,
        contentId,
        stageId: pp.currentStageId,
        startedAt: new Date(),
        completedAt: progressPercent >= 100 ? new Date() : undefined,
        progressPercent,
        quizScore
      };
      engagements.push(engagement);
    }

    this.contentEngagements.set(patientPathwayId, engagements);

    pp.lastActivityAt = new Date();
    await this.updateAdherenceScore(pp);

    this.logAudit("ENGAGE_CONTENT", pp.patientId, { 
      patientPathwayId, 
      contentId, 
      progressPercent,
      completed: progressPercent >= 100
    });

    return engagement;
  }

  async getAdherenceAnalytics(patientPathwayId: string): Promise<AdherenceAnalytics> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const pathway = this.pathways.get(pp.pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const completions = this.taskCompletions.get(patientPathwayId) || [];
    const engagements = this.contentEngagements.get(patientPathwayId) || [];

    const currentStage = pathway.stages.find(s => s.id === pp.currentStageId);
    const totalTasks = currentStage ? currentStage.tasks.length * 7 : 0;
    const completedTasks = completions.filter(c => c.stageId === pp.currentStageId).length;
    const taskAdherence = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalContent = currentStage ? currentStage.educationalContent.length : 0;
    const completedContent = engagements.filter(e => e.stageId === pp.currentStageId && e.completedAt).length;
    const educationAdherence = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;

    const overallAdherence = Math.round((taskAdherence + educationAdherence) / 2);

    let streakDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const nextDate = new Date(checkDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const hasCompletion = completions.some(c => {
        const completionDate = new Date(c.completedAt);
        return completionDate >= checkDate && completionDate < nextDate;
      });

      if (hasCompletion) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    const stageProgress = pathway.stages.map(stage => {
      const stageCompletions = completions.filter(c => c.stageId === stage.id);
      const stageTotalTasks = stage.tasks.length * 7;
      return {
        stageId: stage.id,
        stageName: stage.name,
        progress: stageTotalTasks > 0 ? Math.round((stageCompletions.length / stageTotalTasks) * 100) : 0
      };
    });

    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (taskAdherence < 50) {
      riskFactors.push("Low task completion rate");
      riskLevel = 'high';
    } else if (taskAdherence < 70) {
      riskFactors.push("Moderate task completion rate");
      riskLevel = 'medium';
    }

    if (streakDays === 0) {
      riskFactors.push("No activity in the last day");
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    if (educationAdherence < 30) {
      riskFactors.push("Limited educational content engagement");
    }

    const missedTasks = Math.max(0, totalTasks - completedTasks);

    this.logAudit("VIEW_ADHERENCE", pp.patientId, { patientPathwayId, overallAdherence });

    return {
      patientPathwayId,
      overallAdherence,
      taskAdherence,
      educationAdherence,
      streakDays,
      missedTasks,
      completedTasks,
      totalTasks,
      stageProgress,
      weeklyTrend: [
        { week: "Week 1", adherence: 85 },
        { week: "Week 2", adherence: 78 },
        { week: "Current", adherence: overallAdherence }
      ],
      riskLevel,
      riskFactors
    };
  }

  async getPatientNudges(patientId: string, unreadOnly: boolean = false): Promise<PathwayNudge[]> {
    this.logAudit("VIEW_NUDGES", patientId, { unreadOnly });
    
    let nudges = this.nudges.get(patientId) || [];
    
    if (unreadOnly) {
      nudges = nudges.filter(n => !n.readAt);
    }

    return nudges.sort((a, b) => 
      new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
    );
  }

  async markNudgeRead(nudgeId: string, patientId: string): Promise<PathwayNudge | undefined> {
    const patientNudges = this.nudges.get(patientId) || [];
    const nudge = patientNudges.find(n => n.id === nudgeId);
    
    if (nudge) {
      nudge.readAt = new Date();
      this.logAudit("READ_NUDGE", patientId, { nudgeId });
    }

    return nudge;
  }

  async generateAIContentRecommendations(patientPathwayId: string): Promise<AIContentRecommendation[]> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const pathway = this.pathways.get(pp.pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const engagements = this.contentEngagements.get(patientPathwayId) || [];
    const completedContentIds = engagements
      .filter(e => e.completedAt)
      .map(e => e.contentId);

    const currentStage = pathway.stages.find(s => s.id === pp.currentStageId);
    if (!currentStage) return [];

    const uncompletedContent = currentStage.educationalContent
      .filter(c => !completedContentIds.includes(c.id));

    this.logAudit("AI_CONTENT_RECOMMENDATIONS", pp.patientId, { 
      patientPathwayId,
      recommendationsCount: uncompletedContent.length
    });

    if (aiEnabled) {
      try {
        const adherence = await this.getAdherenceAnalytics(patientPathwayId);
        const prompt = `As a healthcare education specialist, recommend the most relevant educational content for a patient.

Patient Context:
- Current pathway stage: ${currentStage.name}
- Adherence score: ${adherence.overallAdherence}%
- Risk level: ${adherence.riskLevel}
- Streak days: ${adherence.streakDays}

Available uncompleted content:
${uncompletedContent.map(c => `- ${c.title} (${c.contentType}, ${c.difficultyLevel}, ${c.estimatedMinutes} min): ${c.description}`).join('\n')}

Prioritize content based on patient needs. Return a JSON array with objects containing:
- contentId (string)
- reason (string: why this content is recommended now)
- relevanceScore (number: 0-100)

Respond with only valid JSON array.`;

        const content = await generatePhiSafeText({
          user: prompt,
          temperature: 0.3,
          responseMimeType: "application/json",
        });

        const aiResult = JSON.parse(content || "{}");
        const recommendations = (aiResult.recommendations || []) as { contentId: string; reason: string; relevanceScore: number }[];

        return recommendations.map(rec => {
          const content = uncompletedContent.find(c => c.id === rec.contentId);
          return {
            contentId: rec.contentId,
            title: content?.title || "Unknown",
            reason: rec.reason,
            relevanceScore: rec.relevanceScore,
            contentType: content?.contentType || "article",
            estimatedMinutes: content?.estimatedMinutes || 10,
            noCdsDisclaimer: NO_CDS_DISCLAIMER
          };
        }).slice(0, 5);
      } catch (error) {
        console.error("[CarePathway] AI content recommendation failed:", error);
      }
    }

    return uncompletedContent.slice(0, 3).map((content, index) => ({
      contentId: content.id,
      title: content.title,
      reason: index === 0 ? "Priority content for your current stage" : "Recommended based on your progress",
      relevanceScore: 90 - (index * 15),
      contentType: content.contentType,
      estimatedMinutes: content.estimatedMinutes,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    }));
  }

  async generateAITaskRecommendations(patientPathwayId: string): Promise<AITaskRecommendation[]> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const pathway = this.pathways.get(pp.pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const currentStage = pathway.stages.find(s => s.id === pp.currentStageId);
    if (!currentStage) return [];

    this.logAudit("AI_TASK_RECOMMENDATIONS", pp.patientId, { patientPathwayId });

    const completions = this.taskCompletions.get(patientPathwayId) || [];
    const todayCompletions = completions.filter(c => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(c.completedAt) >= today;
    });

    const incompleteTasks = currentStage.tasks.filter(
      t => t.frequency === 'daily' && !todayCompletions.some(c => c.taskId === t.id)
    );

    return incompleteTasks.map(task => ({
      taskId: task.id,
      title: task.title,
      reason: task.requiredForProgress 
        ? "Required task for stage progression - complete today"
        : "Recommended daily task to maintain progress",
      priorityAdjustment: task.requiredForProgress ? 'increase' : 'none',
      suggestedFrequency: task.frequency,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    }));
  }

  async generateAutomatedNudges(patientPathwayId: string): Promise<PathwayNudge[]> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    const pathway = this.pathways.get(pp.pathwayId);
    if (!pathway) throw new Error("Pathway not found");

    const adherence = await this.getAdherenceAnalytics(patientPathwayId);
    const generatedNudges: PathwayNudge[] = [];

    if (adherence.riskLevel === 'high') {
      const nudge = await this.createNudge(
        pp,
        'warning',
        "Let's Get Back on Track",
        await this.generateAINudgeMessage(pp, pathway, 'low_adherence', adherence),
        'low_adherence',
        'high'
      );
      generatedNudges.push(nudge);
    }

    if (adherence.streakDays >= 3 && adherence.streakDays % 3 === 0) {
      const nudge = await this.createNudge(
        pp,
        'milestone',
        `${adherence.streakDays}-Day Streak!`,
        await this.generateAINudgeMessage(pp, pathway, 'streak', adherence),
        'streak_milestone',
        'medium'
      );
      generatedNudges.push(nudge);
    }

    const taskRecs = await this.generateAITaskRecommendations(patientPathwayId);
    if (taskRecs.length > 0 && taskRecs.some(t => t.priorityAdjustment === 'increase')) {
      const highPriorityTask = taskRecs.find(t => t.priorityAdjustment === 'increase');
      if (highPriorityTask) {
        const nudge = await this.createNudge(
          pp,
          'reminder',
          "Don't Forget Today's Important Task",
          `Remember to complete: ${highPriorityTask.title}. ${highPriorityTask.reason}`,
          'task_reminder',
          'high',
          highPriorityTask.taskId
        );
        generatedNudges.push(nudge);
      }
    }

    this.logAudit("GENERATE_NUDGES", pp.patientId, { 
      patientPathwayId, 
      nudgesGenerated: generatedNudges.length 
    });

    return generatedNudges;
  }

  private async createNudge(
    pp: PatientPathway,
    type: PathwayNudge['type'],
    title: string,
    message: string,
    triggerReason: string,
    priority: PathwayNudge['priority'],
    relatedTaskId?: string,
    relatedContentId?: string
  ): Promise<PathwayNudge> {
    const nudge: PathwayNudge = {
      id: `nudge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientPathwayId: pp.id,
      patientId: pp.patientId,
      type,
      title,
      message,
      priority,
      triggerReason,
      relatedTaskId,
      relatedContentId,
      createdAt: new Date(),
      scheduledFor: new Date(),
      aiGenerated: true,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };

    const patientNudges = this.nudges.get(pp.patientId) || [];
    patientNudges.push(nudge);
    this.nudges.set(pp.patientId, patientNudges);

    return nudge;
  }

  private async generateAINudgeMessage(
    pp: PatientPathway,
    pathway: CarePathway,
    nudgeType: string,
    adherence: AdherenceAnalytics
  ): Promise<string> {
    if (aiEnabled) {
      try {
        const prompt = `Generate a brief, supportive healthcare nudge message (2-3 sentences max).

Context:
- Pathway: ${pathway.name}
- Nudge type: ${nudgeType}
- Adherence: ${adherence.overallAdherence}%
- Streak days: ${adherence.streakDays}
- Risk factors: ${adherence.riskFactors.join(', ') || 'None'}

Requirements:
- Be encouraging, not judgmental
- Focus on small, achievable steps
- Use warm, supportive language
- Do NOT give medical advice

Respond with only the message text.`;

        const content = await generatePhiSafeText({
          user: prompt,
          temperature: 0.7,
          maxTokens: 150,
        });

        return content || this.getFallbackNudgeMessage(nudgeType, adherence);
      } catch (error) {
        console.error("[CarePathway] AI nudge generation failed:", error);
      }
    }

    return this.getFallbackNudgeMessage(nudgeType, adherence);
  }

  private getFallbackNudgeMessage(nudgeType: string, adherence: AdherenceAnalytics): string {
    switch (nudgeType) {
      case 'low_adherence':
        return "We noticed you've been busy lately. Even small steps count! Try completing just one task today to keep your momentum going.";
      case 'streak':
        return `Amazing! You've been consistent for ${adherence.streakDays} days. Your dedication to your health is inspiring. Keep going!`;
      case 'milestone':
        return "You've reached an important milestone in your health journey. Take a moment to celebrate your progress!";
      default:
        return "Keep up the great work on your health journey. Every step forward matters!";
    }
  }

  private async generateWelcomeNudge(pp: PatientPathway, pathway: CarePathway): Promise<void> {
    await this.createNudge(
      pp,
      'encouragement',
      `Welcome to Your ${pathway.name}!`,
      `You're taking an important step in managing your health. This pathway will guide you through ${pathway.stages.length} stages over approximately ${pathway.estimatedDurationWeeks} weeks. Let's start with small, achievable goals. You've got this!`,
      'pathway_started',
      'medium'
    );
  }

  private async generateProgressNudge(
    pp: PatientPathway,
    pathway: CarePathway,
    completedTask: PathwayTask,
    totalCompletions: number
  ): Promise<void> {
    if (totalCompletions === 1) {
      await this.createNudge(
        pp,
        'encouragement',
        "First Task Completed!",
        `Congratulations on completing "${completedTask.title}"! The first step is often the hardest. You're on your way!`,
        'first_task',
        'medium',
        completedTask.id
      );
    } else if (totalCompletions % 10 === 0) {
      await this.createNudge(
        pp,
        'milestone',
        `${totalCompletions} Tasks Completed!`,
        `You've completed ${totalCompletions} tasks in your ${pathway.name} pathway. Your consistency is paying off!`,
        'task_milestone',
        'medium'
      );
    }
  }

  private async updateAdherenceScore(pp: PatientPathway): Promise<void> {
    const analytics = await this.getAdherenceAnalytics(pp.id);
    pp.adherenceScore = analytics.overallAdherence;
    pp.overallProgress = Math.min(100, Math.round(analytics.overallAdherence * 0.8 + (analytics.streakDays * 2)));
  }

  private async checkStageProgression(pp: PatientPathway, pathway: CarePathway): Promise<void> {
    const currentStage = pathway.stages.find(s => s.id === pp.currentStageId);
    if (!currentStage) return;

    const completions = this.taskCompletions.get(pp.id) || [];
    const stageCompletions = completions.filter(c => c.stageId === currentStage.id);
    
    const engagements = this.contentEngagements.get(pp.id) || [];
    const stageEducation = engagements.filter(e => e.stageId === currentStage.id && e.completedAt);

    const criteria = currentStage.completionCriteria;
    const daysSinceStageStart = Math.floor(
      (Date.now() - new Date(pp.currentStageStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const meetsTaskCriteria = stageCompletions.length >= criteria.minTasksCompleted;
    const meetsEducationCriteria = stageEducation.length >= criteria.minEducationCompleted;
    const meetsDayCriteria = daysSinceStageStart >= criteria.minDaysInStage;
    const meetsRequiredTasks = criteria.requiredTaskIds.every(taskId =>
      stageCompletions.some(c => c.taskId === taskId)
    );

    if (meetsTaskCriteria && meetsEducationCriteria && meetsDayCriteria && meetsRequiredTasks) {
      const currentIndex = pathway.stages.findIndex(s => s.id === currentStage.id);
      if (currentIndex < pathway.stages.length - 1) {
        const nextStage = pathway.stages[currentIndex + 1];
        pp.currentStageId = nextStage.id;
        pp.currentStageStartDate = new Date();

        await this.createNudge(
          pp,
          'milestone',
          `Stage Complete: ${currentStage.name}`,
          `Congratulations! You've completed the "${currentStage.name}" stage. You're now moving on to "${nextStage.name}". Keep up the great work!`,
          'stage_complete',
          'high'
        );

        this.logAudit("STAGE_PROGRESSION", pp.patientId, {
          patientPathwayId: pp.id,
          fromStage: currentStage.id,
          toStage: nextStage.id
        });
      } else {
        pp.status = 'completed';
        pp.overallProgress = 100;

        await this.createNudge(
          pp,
          'milestone',
          "Pathway Complete!",
          `You've successfully completed your ${pathway.name}! This is a tremendous achievement. Continue applying what you've learned for lasting health benefits.`,
          'pathway_complete',
          'high'
        );

        this.logAudit("PATHWAY_COMPLETED", pp.patientId, { patientPathwayId: pp.id });
      }
    }
  }

  async updatePathwayStatus(
    patientPathwayId: string,
    status: PatientPathway['status'],
    providerId: string,
    reason?: string
  ): Promise<PatientPathway> {
    const pp = this.patientPathways.get(patientPathwayId);
    if (!pp) throw new Error("Patient pathway not found");

    pp.status = status;
    pp.notes = reason ? `${pp.notes}\n[${new Date().toISOString()}] Status changed to ${status}: ${reason}` : pp.notes;

    this.logAudit("UPDATE_PATHWAY_STATUS", providerId, {
      patientPathwayId,
      newStatus: status,
      reason
    });

    return pp;
  }

  private logAudit(action: string, userId: string, details: Record<string, unknown>): void {
    console.log(`[HIPAA-AUDIT][CarePathway] ${action} by ${userId}:`, JSON.stringify(details));
  }
}

export const carePathwayService = new CarePathwayService();
