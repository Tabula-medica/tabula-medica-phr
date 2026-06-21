import { Router, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { phiDb, decryptPhiRows } from "./storage/phi-storage";
import { healthGoalsTable, vitalSignsTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path, method: req.method });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  const queryProfileId = req.query.profileId as string | undefined;
  const bodyProfileId = req.body?.profileId;
  const paramsProfileId = req.params?.profileId;
  
  if ((queryProfileId && queryProfileId !== sessionUserId) ||
      (bodyProfileId && bodyProfileId !== sessionUserId) ||
      (paramsProfileId && paramsProfileId !== sessionUserId)) {
    logHipaaAudit("ACCESS_DENIED", { 
      userId: hashIdentifier(sessionUserId), 
      attemptedAccess: hashIdentifier(queryProfileId || bodyProfileId || paramsProfileId || "unknown"),
      path: req.path 
    });
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  (req as any).userId = sessionUserId;
  next();
}

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function generateId(): string {
  return `pedu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${new Date().toISOString()} | ${action} | ${JSON.stringify(details)}`);
}

const NO_CDS_DISCLAIMER = "This educational content is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider for personalized guidance.";

interface EducationalArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  readingLevel: "basic" | "intermediate" | "advanced";
  estimatedReadTime: number;
  keyPoints: string[];
  relatedConditions: string[];
  contentType: "article" | "video" | "interactive";
  videoUrl?: string;
  interactiveModules?: InteractiveModule[];
  relevanceScore: number;
  matchReasons: string[];
  createdAt: string;
}

interface InteractiveModule {
  id: string;
  title: string;
  type: "quiz" | "checklist" | "assessment";
  description: string;
  questions?: QuizQuestion[];
  checklistItems?: ChecklistItem[];
  completed: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface PatientEducationContext {
  conditions: string[];
  goals: { title: string; goalType: string; progress: number }[];
  vitals: { type: string; value: number; status: string }[];
  consultationTopics: string[];
  preferences: {
    readingLevel: "basic" | "intermediate" | "advanced";
    preferredFormats: string[];
  };
}

const educationContentStore: Map<string, EducationalArticle[]> = new Map();
const moduleProgressStore: Map<string, { moduleId: string; completed: boolean; score?: number }[]> = new Map();

function deriveVitalStatus(vitalType: string, value: number): "normal" | "elevated" | "low" | "critical" {
  const thresholds: Record<string, { low?: number; normal: number; elevated: number; critical: number }> = {
    blood_pressure_systolic: { normal: 120, elevated: 130, critical: 180 },
    blood_pressure_diastolic: { normal: 80, elevated: 90, critical: 120 },
    heart_rate: { low: 50, normal: 60, elevated: 100, critical: 150 },
    blood_glucose: { low: 70, normal: 100, elevated: 140, critical: 250 },
    weight: { normal: 999, elevated: 999, critical: 999 },
    temperature: { low: 95, normal: 98.6, elevated: 100.4, critical: 103 },
    oxygen_saturation: { low: 90, normal: 95, elevated: 100, critical: 100 },
    respiratory_rate: { low: 10, normal: 12, elevated: 20, critical: 30 }
  };

  const threshold = thresholds[vitalType];
  if (!threshold) return "normal";

  if (threshold.low !== undefined && value < threshold.low) return "low";
  if (value >= threshold.critical) return "critical";
  if (value >= threshold.elevated) return "elevated";
  return "normal";
}

async function getPatientContext(profileId: string): Promise<PatientEducationContext> {
  let goals: { title: string; goalType: string; progress: number }[] = [];
  let vitals: { type: string; value: number; status: string }[] = [];
  
  logHipaaAudit("PATIENT_CONTEXT_ACCESS", { profileId: hashIdentifier(profileId) });
  
  try {
    const rawUserGoals = await phiDb.select().from(healthGoalsTable)
      .where(eq(healthGoalsTable.profileId, profileId))
      .limit(10);
    const userGoals = decryptPhiRows("healthGoalsTable", rawUserGoals);

    goals = userGoals.map(g => ({
      title: g.title,
      goalType: g.goalType,
      progress: calculateProgress(g.baselineValue, g.currentValue, g.targetValue)
    }));

    const rawUserVitals = await phiDb.select().from(vitalSignsTable)
      .where(eq(vitalSignsTable.profileId, profileId))
      .orderBy(desc(vitalSignsTable.recordedAt))
      .limit(10);
    const userVitals = decryptPhiRows("vitalSignsTable", rawUserVitals);

    vitals = userVitals.map(v => {
      const value = parseFloat(v.value);
      return {
        type: v.vitalType,
        value,
        status: deriveVitalStatus(v.vitalType, value)
      };
    });
  } catch (error) {
    console.log("[PersonalizedEducation] Error fetching patient data:", error);
  }

  const conditions = extractConditionsFromContext(goals, vitals);
  const consultationTopics = extractConsultationTopics(goals, vitals);

  return {
    conditions,
    goals,
    vitals,
    consultationTopics,
    preferences: {
      readingLevel: "intermediate",
      preferredFormats: ["article", "video", "interactive"]
    }
  };
}

function calculateProgress(baseline: string | null, current: string | null, target: string): number {
  const baseNum = parseFloat(baseline || "0");
  const currNum = parseFloat(current || baseline || "0");
  const targNum = parseFloat(target);
  
  if (targNum === baseNum) return 100;
  return Math.min(100, Math.max(0, ((currNum - baseNum) / (targNum - baseNum)) * 100));
}

function extractConditionsFromContext(
  goals: { goalType: string }[],
  vitals: { type: string; status: string }[]
): string[] {
  const conditions: Set<string> = new Set();
  
  const goalConditionMap: Record<string, string> = {
    blood_pressure: "Hypertension Management",
    blood_glucose: "Diabetes Management",
    weight_loss: "Weight Management",
    weight_gain: "Nutrition & Weight",
    exercise: "Physical Activity",
    heart_rate: "Cardiovascular Health",
    medication_adherence: "Medication Management",
    sleep: "Sleep Health",
    steps: "Physical Activity",
    water_intake: "Hydration & Nutrition"
  };

  goals.forEach(g => {
    if (goalConditionMap[g.goalType]) {
      conditions.add(goalConditionMap[g.goalType]);
    }
  });

  vitals.forEach(v => {
    if (v.status === "elevated" || v.status === "critical") {
      if (v.type.includes("blood_pressure")) conditions.add("Hypertension Management");
      if (v.type.includes("glucose")) conditions.add("Diabetes Management");
      if (v.type.includes("heart_rate")) conditions.add("Cardiovascular Health");
    }
  });

  if (conditions.size === 0) {
    conditions.add("General Wellness");
  }

  return Array.from(conditions);
}

function extractConsultationTopics(
  goals: { title: string; goalType: string; progress: number }[],
  vitals: { type: string; status: string }[]
): string[] {
  const topics: string[] = [];

  goals.forEach(g => {
    if (g.progress < 25) {
      topics.push(`Getting started with ${g.title}`);
    } else if (g.progress >= 75) {
      topics.push(`Maintaining progress on ${g.title}`);
    }
  });

  vitals.forEach(v => {
    if (v.status === "elevated" || v.status === "critical") {
      topics.push(`Understanding your ${v.type.replace(/_/g, " ")} readings`);
    }
  });

  return topics.slice(0, 5);
}

async function generatePersonalizedContent(
  context: PatientEducationContext
): Promise<EducationalArticle[]> {
  const articles: EducationalArticle[] = [];
  
  for (const condition of context.conditions.slice(0, 3)) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare education content creator. Create personalized educational content for patients.
            
CRITICAL RULES:
- Use ONLY safe verbs: "shows", "states", "refers to", "means"
- NEVER provide medical advice or treatment recommendations
- Focus on educational, factual information
- Always remind patients to consult their healthcare provider
- Include practical information patients can discuss with their doctors`
          },
          {
            role: "user",
            content: `Create an educational article about "${condition}" for a patient with these characteristics:
- Current health goals: ${context.goals.map(g => g.title).join(", ") || "General wellness"}
- Recent vital trends: ${context.vitals.map(v => `${v.type}: ${v.status}`).join(", ") || "Normal ranges"}
- Topics to discuss: ${context.consultationTopics.join(", ") || "General health"}
- Reading level: ${context.preferences.readingLevel}

Return a JSON object with:
{
  "title": "Engaging title",
  "summary": "2-3 sentence summary",
  "content": "Full article (500-800 words) with markdown formatting",
  "keyPoints": ["3-5 key educational points using safe verbs"],
  "relatedTopics": ["2-3 related topics for further reading"],
  "estimatedReadTime": number
}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      
      if (content.title) {
        articles.push({
          id: generateId(),
          title: content.title,
          summary: content.summary || "",
          content: content.content || "",
          category: condition,
          readingLevel: context.preferences.readingLevel,
          estimatedReadTime: content.estimatedReadTime || 5,
          keyPoints: content.keyPoints || [],
          relatedConditions: [condition],
          contentType: "article",
          relevanceScore: 0.9,
          matchReasons: [`Based on your ${condition.toLowerCase()} goals and health data`],
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`[PersonalizedEducation] Error generating content for ${condition}:`, error);
      articles.push(createFallbackArticle(condition, context));
    }
  }

  articles.push(...createVideoContent(context));
  articles.push(...createInteractiveModules(context));

  return articles;
}

function createFallbackArticle(condition: string, context: PatientEducationContext): EducationalArticle {
  const fallbackContent: Record<string, { title: string; summary: string; content: string; keyPoints: string[] }> = {
    "Hypertension Management": {
      title: "Understanding Blood Pressure: What Your Numbers Mean",
      summary: "Learn about blood pressure measurements and what they show about your cardiovascular health.",
      content: `## What Blood Pressure Numbers Mean\n\nBlood pressure measurements consist of two numbers. The top number (systolic) shows the pressure when your heart beats. The bottom number (diastolic) refers to the pressure between beats.\n\n## Normal Ranges\n\nHealthcare providers generally consider these ranges:\n- Normal: Below 120/80 mmHg\n- Elevated: 120-129/less than 80 mmHg\n- High: 130/80 mmHg or higher\n\n## Tracking Your Numbers\n\nRegular monitoring helps you and your healthcare team understand your patterns. Keep a log of your readings to discuss at your next appointment.\n\n## Lifestyle Factors\n\nResearch shows that various lifestyle factors may influence blood pressure. These include physical activity, dietary choices, stress levels, and sleep quality. Your healthcare provider can help you understand which factors may be most relevant for you.\n\n*Always consult your healthcare provider for personalized guidance about your blood pressure readings.*`,
      keyPoints: [
        "Blood pressure shows how hard your heart works to pump blood",
        "Two numbers in a reading refer to different phases of your heartbeat",
        "Regular tracking means you can discuss patterns with your doctor",
        "Lifestyle factors states research may influence readings"
      ]
    },
    "Diabetes Management": {
      title: "Blood Glucose Basics: Understanding Your Readings",
      summary: "Educational information about blood glucose levels and what different readings may indicate.",
      content: `## What Blood Glucose Shows\n\nBlood glucose (blood sugar) readings show how much sugar is in your bloodstream at a given time. Your body uses glucose for energy.\n\n## Understanding Your Numbers\n\nDifferent times of day may show different readings:\n- Fasting (before eating): Readings vary by individual\n- After meals: Numbers typically rise temporarily\n- Before bed: Important for overnight patterns\n\n## Tracking Tips\n\nKeeping a log of your readings along with meals, activities, and how you feel can help your healthcare team provide better guidance.\n\n## Factors That May Influence Readings\n\nResearch shows various factors may affect glucose levels, including:\n- Food and drinks consumed\n- Physical activity\n- Stress and sleep\n- Medications\n\n*Discuss your readings and any concerns with your healthcare provider for personalized guidance.*`,
      keyPoints: [
        "Blood glucose shows how much sugar is in your bloodstream",
        "Readings vary throughout the day, which means timing matters",
        "Tracking logs help your healthcare team provide guidance",
        "Multiple factors states research may influence your numbers"
      ]
    },
    "General Wellness": {
      title: "Building Healthy Habits: A Patient's Guide",
      summary: "Educational overview of key wellness areas and how to discuss them with your healthcare provider.",
      content: `## Understanding Wellness\n\nWellness refers to the active pursuit of activities and lifestyle choices that lead to a state of holistic health. This educational guide covers key areas.\n\n## Key Wellness Areas\n\n### Physical Activity\nRegular movement shows benefits for both physical and mental health. Discuss with your provider what activities may be appropriate for you.\n\n### Nutrition\nBalanced eating means providing your body with needed nutrients. Your healthcare team can help you understand what dietary approaches may work for your situation.\n\n### Sleep\nQuality rest refers to giving your body time to recover and restore. Most adults need 7-9 hours per night.\n\n### Stress Management\nManaging stress shows positive effects on overall health. Various techniques exist, and your provider can suggest options.\n\n## Taking Action\n\nSmall, consistent steps often lead to lasting changes. Work with your healthcare provider to identify priorities.\n\n*This information is educational only. Consult your healthcare provider for personalized recommendations.*`,
      keyPoints: [
        "Wellness refers to actively pursuing holistic health",
        "Physical activity shows benefits for body and mind",
        "Quality sleep means allowing your body to recover",
        "Small consistent steps states research often work best"
      ]
    }
  };

  const fallback = fallbackContent[condition] || fallbackContent["General Wellness"];
  
  return {
    id: generateId(),
    title: fallback.title,
    summary: fallback.summary,
    content: fallback.content,
    category: condition,
    readingLevel: context.preferences.readingLevel,
    estimatedReadTime: 5,
    keyPoints: fallback.keyPoints,
    relatedConditions: [condition],
    contentType: "article",
    relevanceScore: 0.7,
    matchReasons: [`Based on your ${condition.toLowerCase()} health focus`],
    createdAt: new Date().toISOString()
  };
}

function createVideoContent(context: PatientEducationContext): EducationalArticle[] {
  const videos: EducationalArticle[] = [];
  
  const videoLibrary: Record<string, { title: string; summary: string; duration: number }[]> = {
    "Hypertension Management": [
      { title: "How to Take Your Blood Pressure at Home", summary: "Step-by-step guide to accurate home blood pressure monitoring.", duration: 4 },
      { title: "Understanding Blood Pressure Monitors", summary: "Learn about different types of monitors and how to choose one.", duration: 3 }
    ],
    "Diabetes Management": [
      { title: "Blood Glucose Monitoring Basics", summary: "Visual guide to checking your blood sugar levels accurately.", duration: 5 },
      { title: "Understanding Continuous Glucose Monitors", summary: "Overview of CGM technology and how it works.", duration: 4 }
    ],
    "Physical Activity": [
      { title: "Starting an Exercise Routine Safely", summary: "Tips for beginning physical activity at any fitness level.", duration: 6 },
      { title: "Low-Impact Exercises for Beginners", summary: "Gentle movements suitable for most people.", duration: 8 }
    ],
    "Weight Management": [
      { title: "Tracking Your Progress: Beyond the Scale", summary: "Different ways to measure health improvements.", duration: 4 },
      { title: "Understanding Portion Sizes", summary: "Visual guide to appropriate serving sizes.", duration: 5 }
    ]
  };

  context.conditions.forEach(condition => {
    const conditionVideos = videoLibrary[condition] || videoLibrary["Physical Activity"];
    conditionVideos.forEach(v => {
      videos.push({
        id: generateId(),
        title: v.title,
        summary: v.summary,
        content: `This video provides educational information about ${v.title.toLowerCase()}. Duration: ${v.duration} minutes.`,
        category: condition,
        readingLevel: "basic",
        estimatedReadTime: v.duration,
        keyPoints: [],
        relatedConditions: [condition],
        contentType: "video",
        videoUrl: `/education/videos/${generateId()}`,
        relevanceScore: 0.85,
        matchReasons: [`Video content for ${condition.toLowerCase()}`],
        createdAt: new Date().toISOString()
      });
    });
  });

  return videos.slice(0, 4);
}

function createInteractiveModules(context: PatientEducationContext): EducationalArticle[] {
  const modules: EducationalArticle[] = [];

  context.conditions.forEach(condition => {
    const quizModule: InteractiveModule = {
      id: generateId(),
      title: `${condition} Knowledge Check`,
      type: "quiz",
      description: `Test your understanding of ${condition.toLowerCase()} concepts.`,
      questions: createQuizQuestions(condition),
      completed: false
    };

    const checklistModule: InteractiveModule = {
      id: generateId(),
      title: `${condition} Discussion Checklist`,
      type: "checklist",
      description: `Topics you may want to discuss with your healthcare provider about ${condition.toLowerCase()}.`,
      checklistItems: createChecklist(condition),
      completed: false
    };

    modules.push({
      id: generateId(),
      title: `Interactive ${condition} Learning`,
      summary: `Quizzes and checklists to help you learn about ${condition.toLowerCase()}.`,
      content: "",
      category: condition,
      readingLevel: "intermediate",
      estimatedReadTime: 10,
      keyPoints: [],
      relatedConditions: [condition],
      contentType: "interactive",
      interactiveModules: [quizModule, checklistModule],
      relevanceScore: 0.8,
      matchReasons: [`Interactive learning for ${condition.toLowerCase()}`],
      createdAt: new Date().toISOString()
    });
  });

  return modules.slice(0, 2);
}

function createQuizQuestions(condition: string): QuizQuestion[] {
  const questionSets: Record<string, QuizQuestion[]> = {
    "Hypertension Management": [
      {
        id: "q1",
        question: "What does the top number in a blood pressure reading show?",
        options: ["Pressure when heart rests", "Pressure when heart beats", "Heart rate", "Blood oxygen level"],
        correctAnswer: 1,
        explanation: "The top number (systolic) shows the pressure in your arteries when your heart beats."
      },
      {
        id: "q2",
        question: "Which blood pressure reading is generally considered normal?",
        options: ["140/90 mmHg", "130/85 mmHg", "Below 120/80 mmHg", "150/95 mmHg"],
        correctAnswer: 2,
        explanation: "Healthcare providers generally consider readings below 120/80 mmHg as normal."
      },
      {
        id: "q3",
        question: "How often should you discuss your blood pressure readings with your healthcare provider?",
        options: ["Only when feeling unwell", "At every scheduled visit", "Once a year", "Never"],
        correctAnswer: 1,
        explanation: "Regular discussions at scheduled visits help your healthcare team provide better guidance."
      }
    ],
    "Diabetes Management": [
      {
        id: "q1",
        question: "What does blood glucose (blood sugar) show?",
        options: ["How much oxygen is in blood", "How much sugar is in blood", "Heart function", "Kidney function"],
        correctAnswer: 1,
        explanation: "Blood glucose shows how much sugar is in your bloodstream, which your body uses for energy."
      },
      {
        id: "q2",
        question: "When are fasting blood glucose readings typically taken?",
        options: ["After a meal", "Before eating anything", "During exercise", "While sleeping"],
        correctAnswer: 1,
        explanation: "Fasting readings are typically taken before eating anything, often in the morning."
      }
    ]
  };

  return questionSets[condition] || questionSets["Hypertension Management"];
}

function createChecklist(condition: string): ChecklistItem[] {
  const checklists: Record<string, string[]> = {
    "Hypertension Management": [
      "Ask about my target blood pressure range",
      "Discuss home monitoring frequency",
      "Review my current medications",
      "Ask about lifestyle factors that may help",
      "Understand when to contact the office about readings"
    ],
    "Diabetes Management": [
      "Review my target glucose ranges",
      "Discuss monitoring schedule",
      "Ask about signs of high or low blood sugar",
      "Understand how food and activity affect readings",
      "Review when to seek immediate care"
    ],
    "Weight Management": [
      "Discuss realistic weight goals",
      "Ask about appropriate exercise options",
      "Review dietary approaches that may help",
      "Understand how to track progress",
      "Ask about support resources"
    ]
  };

  const items = checklists[condition] || checklists["Weight Management"];
  return items.map((text, i) => ({
    id: `check_${i}`,
    text,
    completed: false
  }));
}

router.get("/personalized", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    logHipaaAudit("PERSONALIZED_EDUCATION_ACCESS", { userId: userId.substring(0, 8) + "..." });

    let cached = educationContentStore.get(userId);
    const cacheAge = cached ? Date.now() - new Date(cached[0]?.createdAt || 0).getTime() : Infinity;
    
    if (!cached || cacheAge > 3600000) {
      const context = await getPatientContext(userId);
      cached = await generatePersonalizedContent(context);
      educationContentStore.set(userId, cached);
    }

    res.json({
      success: true,
      content: cached,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      lastUpdated: cached[0]?.createdAt || new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[PersonalizedEducation] Error:", error);
    res.status(500).json({ success: false, error: "Failed to load personalized education content" });
  }
});

router.get("/article/:articleId", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { articleId } = req.params;

    const cached = educationContentStore.get(userId);
    const article = cached?.find(a => a.id === articleId);

    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    logHipaaAudit("EDUCATION_ARTICLE_VIEW", { userId: userId.substring(0, 8) + "...", articleId });

    res.json({
      success: true,
      article,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error: any) {
    console.error("[PersonalizedEducation] Error:", error);
    res.status(500).json({ success: false, error: "Failed to load article" });
  }
});

router.post("/module/:moduleId/progress", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { moduleId } = req.params;
    const { completed, score } = req.body;

    let progress = moduleProgressStore.get(userId) || [];
    const existingIndex = progress.findIndex(p => p.moduleId === moduleId);
    
    if (existingIndex >= 0) {
      progress[existingIndex] = { moduleId, completed, score };
    } else {
      progress.push({ moduleId, completed, score });
    }
    
    moduleProgressStore.set(userId, progress);

    logHipaaAudit("EDUCATION_MODULE_PROGRESS", { userId: userId.substring(0, 8) + "...", moduleId, completed });

    res.json({
      success: true,
      progress: { moduleId, completed, score },
      message: completed ? "Module completed!" : "Progress saved"
    });
  } catch (error: any) {
    console.error("[PersonalizedEducation] Error:", error);
    res.status(500).json({ success: false, error: "Failed to save progress" });
  }
});

router.get("/progress", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const progress = moduleProgressStore.get(userId) || [];
    const content = educationContentStore.get(userId) || [];

    const totalModules = content.reduce((sum, c) => sum + (c.interactiveModules?.length || 0), 0);
    const completedModules = progress.filter(p => p.completed).length;
    const articlesRead = content.filter(c => c.contentType === "article").length;
    const videosWatched = content.filter(c => c.contentType === "video").length;

    res.json({
      success: true,
      stats: {
        totalModules,
        completedModules,
        articlesRead,
        videosWatched,
        completionPercentage: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0
      },
      moduleProgress: progress
    });
  } catch (error: any) {
    console.error("[PersonalizedEducation] Error:", error);
    res.status(500).json({ success: false, error: "Failed to load progress" });
  }
});

router.post("/refresh", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    logHipaaAudit("PERSONALIZED_EDUCATION_REFRESH", { userId: userId.substring(0, 8) + "..." });

    const context = await getPatientContext(userId);
    const content = await generatePersonalizedContent(context);
    educationContentStore.set(userId, content);

    res.json({
      success: true,
      content,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[PersonalizedEducation] Error:", error);
    res.status(500).json({ success: false, error: "Failed to refresh content" });
  }
});

console.log("[Routes] Personalized Education routes registered at /api/personalized-education/*");

export default router;
