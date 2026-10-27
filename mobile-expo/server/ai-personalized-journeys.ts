import { storage } from "./storage";
import type { HealthRecord, HealthGoal, CarePlan, CarePlanActivity, UserSentimentLog, PersonalizedContent, CarePlanAdjustment, UserProgressSnapshot } from "@shared/schema";
import { chatComplete } from "./ai-client";

const AI_MODEL = "deep";

interface SentimentAnalysisResult {
  sentiment: "positive" | "neutral" | "negative" | "anxious" | "hopeful" | "frustrated";
  sentimentScore: number;
  emotionalIndicators: {
    stress: number;
    motivation: number;
    confusion: number;
    optimism: number;
    fatigue: number;
  };
  healthContextIndicators: {
    symptomConcern: boolean;
    treatmentAnxiety: boolean;
    progressSatisfaction: boolean;
    supportNeed: boolean;
  };
  aiConfidence: number;
}

export async function analyzeSentiment(
  userId: string,
  content: string,
  source: string,
  sourceId?: string
): Promise<SentimentAnalysisResult> {
  try {
    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare sentiment analysis AI. Analyze the emotional state and health-related concerns in patient communications. 
          
Be sensitive to health anxiety, treatment concerns, and emotional wellbeing indicators. Return your analysis as JSON.

Response format:
{
  "sentiment": "positive" | "neutral" | "negative" | "anxious" | "hopeful" | "frustrated",
  "sentimentScore": -100 to 100 (negative = negative sentiment, positive = positive),
  "emotionalIndicators": {
    "stress": 0.0-1.0,
    "motivation": 0.0-1.0,
    "confusion": 0.0-1.0,
    "optimism": 0.0-1.0,
    "fatigue": 0.0-1.0
  },
  "healthContextIndicators": {
    "symptomConcern": boolean,
    "treatmentAnxiety": boolean,
    "progressSatisfaction": boolean,
    "supportNeed": boolean
  },
  "aiConfidence": 0-100
}`
        },
        {
          role: "user",
          content: `Analyze the sentiment and emotional state in this patient communication:

Source: ${source}
Content: "${content}"`
        }
      ],
      temperature: 0.3,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-journeys",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");
    
    await storage.createUserSentimentLog({
      userId,
      source,
      sourceId: sourceId || null,
      content: content.substring(0, 500),
      sentiment: result.sentiment || "neutral",
      sentimentScore: result.sentimentScore || 0,
      emotionalIndicators: result.emotionalIndicators || {},
      healthContextIndicators: result.healthContextIndicators || {},
      aiConfidence: result.aiConfidence || 50,
    });

    return result;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return {
      sentiment: "neutral",
      sentimentScore: 0,
      emotionalIndicators: { stress: 0.5, motivation: 0.5, confusion: 0.5, optimism: 0.5, fatigue: 0.5 },
      healthContextIndicators: { symptomConcern: false, treatmentAnxiety: false, progressSatisfaction: false, supportNeed: false },
      aiConfidence: 0,
    };
  }
}

interface ContentRecommendation {
  contentType: "article" | "video" | "tip" | "exercise" | "meditation" | "recipe";
  title: string;
  description: string;
  contentBody: string;
  category: string;
  conditionTags: string[];
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  estimatedDuration: number;
  relevanceScore: number;
  personalizedReason: string;
}

interface UserJourneyContext {
  recentSentiments: UserSentimentLog[];
  activeGoals: HealthGoal[];
  activePlans: CarePlan[];
  conditions: HealthRecord[];
  recentProgress: any[];
  gamificationStats: any;
}

async function getUserJourneyContext(userId: string): Promise<UserJourneyContext> {
  const [sentiments, goals, plans, records, gamification] = await Promise.all([
    storage.getRecentSentimentLogs(userId, 10),
    storage.getActiveHealthGoals(userId),
    storage.getActiveCarePlans(userId),
    storage.getHealthRecords(userId),
    storage.getUserGamification(userId),
  ]);

  return {
    recentSentiments: sentiments,
    activeGoals: goals,
    activePlans: plans,
    conditions: records.filter(r => r.type === "condition"),
    recentProgress: [],
    gamificationStats: gamification,
  };
}

export async function generatePersonalizedContent(
  userId: string,
  contentCount: number = 5
): Promise<ContentRecommendation[]> {
  try {
    const context = await getUserJourneyContext(userId);
    
    const avgSentimentScore = context.recentSentiments.length > 0
      ? context.recentSentiments.reduce((sum, s) => sum + s.sentimentScore, 0) / context.recentSentiments.length
      : 0;
    
    const dominantSentiment = context.recentSentiments.length > 0
      ? getMostFrequent(context.recentSentiments.map(s => s.sentiment))
      : "neutral";

    const contextSummary = {
      activeGoalCategories: context.activeGoals.map(g => g.category),
      conditions: context.conditions.map(c => c.title),
      emotionalState: dominantSentiment,
      sentimentTrend: avgSentimentScore,
      currentLevel: context.gamificationStats?.currentLevel || 1,
      streakDays: context.gamificationStats?.currentStreak || 0,
    };

    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare content personalization AI. Generate educational content recommendations tailored to the patient's emotional state, health conditions, and progress.

Consider:
- Emotional state: Suggest calming content for anxious users, motivational for frustrated users
- Health conditions: Tailor content to specific conditions they're managing
- Progress level: Adjust difficulty based on their experience (level, streak)
- Goals: Align content with their active health goals

Generate ${contentCount} diverse content recommendations. Return as JSON array.

Response format:
{
  "recommendations": [
    {
      "contentType": "article" | "video" | "tip" | "exercise" | "meditation" | "recipe",
      "title": "string",
      "description": "string (2-3 sentences)",
      "contentBody": "string (full content or detailed outline)",
      "category": "nutrition" | "exercise" | "mental_health" | "medication" | "condition_specific",
      "conditionTags": ["condition1", "condition2"],
      "difficultyLevel": "beginner" | "intermediate" | "advanced",
      "estimatedDuration": number (minutes),
      "relevanceScore": 0-100,
      "personalizedReason": "string (why this is recommended for this user)"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Generate personalized health content for this user:

User Context:
- Emotional State: ${contextSummary.emotionalState} (trend: ${avgSentimentScore > 0 ? "improving" : avgSentimentScore < 0 ? "declining" : "stable"})
- Active Goal Categories: ${contextSummary.activeGoalCategories.join(", ") || "None set"}
- Health Conditions: ${contextSummary.conditions.join(", ") || "None recorded"}
- Experience Level: ${contextSummary.currentLevel} (${contextSummary.streakDays} day streak)

Generate ${contentCount} personalized content recommendations.`
        }
      ],
      temperature: 0.7,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-journeys",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || '{"recommendations":[]}');
    const recommendations: ContentRecommendation[] = result.recommendations || [];

    for (const rec of recommendations) {
      await storage.createPersonalizedContent({
        userId,
        contentType: rec.contentType,
        title: rec.title,
        description: rec.description,
        contentBody: rec.contentBody,
        category: rec.category,
        conditionTags: rec.conditionTags,
        difficultyLevel: rec.difficultyLevel,
        estimatedDuration: rec.estimatedDuration,
        relevanceScore: rec.relevanceScore,
        personalizedReason: rec.personalizedReason,
        isViewed: false,
        isCompleted: false,
        isSaved: false,
      });
    }

    return recommendations;
  } catch (error) {
    console.error("Error generating personalized content:", error);
    return [];
  }
}

interface CarePlanAdjustmentSuggestion {
  activityId?: string;
  adjustmentType: "difficulty_change" | "frequency_change" | "new_task" | "remove_task" | "priority_change" | "deadline_extension";
  previousValue?: any;
  newValue: any;
  reason: string;
  triggerType: string;
  triggerMetrics: any;
}

export async function analyzeAndAdjustCarePlan(
  userId: string,
  carePlanId: string
): Promise<CarePlanAdjustmentSuggestion[]> {
  try {
    const [carePlan, activities, sentiments, goals] = await Promise.all([
      storage.getCarePlan(carePlanId),
      storage.getCarePlanActivities(carePlanId),
      storage.getRecentSentimentLogs(userId, 7),
      storage.getActiveHealthGoals(userId),
    ]);

    if (!carePlan) {
      return [];
    }

    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((sum: number, s: any) => sum + s.sentimentScore, 0) / sentiments.length
      : 0;

    const completedActivities = activities.filter((a: any) => a.status === "completed");
    const overdueActivities = activities.filter((a: any) => 
      a.status === "in_progress" && a.dueDate && new Date(a.dueDate) < new Date()
    );
    const completionRate = activities.length > 0 
      ? (completedActivities.length / activities.length) * 100 
      : 0;

    const contextData = {
      carePlan: {
        title: carePlan.title,
        status: carePlan.status,
        goals: carePlan.goals,
      },
      activities: activities.map((a: any) => ({
        id: a.id,
        title: a.title,
        type: a.activityType,
        status: a.status,
        dueDate: a.dueDate,
        frequency: a.frequency,
      })),
      metrics: {
        completionRate,
        overdueCount: overdueActivities.length,
        averageSentiment: avgSentiment,
        dominantMood: sentiments.length > 0 ? getMostFrequent(sentiments.map((s: any) => s.sentiment)) : "neutral",
      },
    };

    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare care plan optimization AI. Analyze patient progress and emotional state to suggest dynamic adjustments to their care plan.

Adjustment principles:
- Low completion rate + negative sentiment = reduce difficulty, extend deadlines
- High completion rate + positive sentiment = increase challenge, add advanced tasks
- Consistent overdue tasks = adjust frequency or break into smaller tasks
- High stress indicators = add mental health support activities
- Low motivation = gamify tasks, add milestone rewards

Return suggestions as JSON array. Only suggest meaningful changes.

Response format:
{
  "adjustments": [
    {
      "activityId": "string or null for new tasks",
      "adjustmentType": "difficulty_change" | "frequency_change" | "new_task" | "remove_task" | "priority_change" | "deadline_extension",
      "previousValue": "any (for changes)",
      "newValue": "any",
      "reason": "string (patient-friendly explanation)",
      "triggerType": "progress_slow" | "progress_fast" | "sentiment_low" | "streak_broken" | "goal_achieved",
      "triggerMetrics": { "metric": "value" }
    }
  ]
}`
        },
        {
          role: "user",
          content: `Analyze this care plan and suggest adjustments:

${JSON.stringify(contextData, null, 2)}

Suggest adjustments based on the patient's progress and emotional state.`
        }
      ],
      temperature: 0.5,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-journeys",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || '{"adjustments":[]}');
    const adjustments: CarePlanAdjustmentSuggestion[] = result.adjustments || [];

    for (const adj of adjustments) {
      await storage.createCarePlanAdjustment({
        userId,
        carePlanId,
        activityId: adj.activityId || null,
        adjustmentType: adj.adjustmentType,
        previousValue: adj.previousValue,
        newValue: adj.newValue,
        reason: adj.reason,
        triggerType: adj.triggerType,
        triggerMetrics: adj.triggerMetrics,
        status: "pending",
      });
    }

    return adjustments;
  } catch (error) {
    console.error("Error analyzing care plan for adjustments:", error);
    return [];
  }
}

export async function generateProgressSnapshot(userId: string, period: "daily" | "weekly" | "monthly"): Promise<UserProgressSnapshot | null> {
  try {
    const [goals, plans, sentiments, gamification, records] = await Promise.all([
      storage.getActiveHealthGoals(userId),
      storage.getActiveCarePlans(userId),
      storage.getRecentSentimentLogs(userId, period === "daily" ? 1 : period === "weekly" ? 7 : 30),
      storage.getUserGamification(userId),
      storage.getHealthRecords(userId),
    ]);

    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((sum: number, s: any) => sum + s.sentimentScore, 0) / sentiments.length
      : 0;

    const goalsMetrics = {
      activeGoals: goals.length,
      completedTasks: 0,
      streakDays: gamification?.currentStreak || 0,
      avgCompletionRate: 0,
    };

    const carePlanMetrics = {
      activePlans: plans.length,
      tasksCompleted: 0,
      tasksOverdue: 0,
      adherenceRate: 0,
    };

    const sentimentMetrics = {
      avgScore: avgSentiment,
      trend: avgSentiment > 10 ? "improving" : avgSentiment < -10 ? "declining" : "stable",
      dominantMood: sentiments.length > 0 ? getMostFrequent(sentiments.map((s: any) => s.sentiment)) : "neutral",
    };

    const engagementMetrics = {
      loginDays: gamification?.daysActive || 0,
      featuresUsed: [],
    };

    const healthMetrics = {
      vitalsLogged: records.filter(r => r.type === "vital").length,
      conditionsTracked: records.filter(r => r.type === "condition").length,
      medicationAdherence: 0,
    };

    const response = await chatComplete({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare analytics AI. Generate personalized recommendations based on a patient's progress metrics.

Return recommendations as JSON array with priority and actionable suggestions.

Response format:
{
  "recommendations": [
    {
      "type": "goal" | "care_plan" | "wellness" | "engagement" | "support",
      "priority": "high" | "medium" | "low",
      "suggestion": "string (actionable advice)"
    }
  ],
  "overallWellnessScore": 0-100
}`
        },
        {
          role: "user",
          content: `Generate recommendations for this ${period} progress snapshot:

Goals: ${JSON.stringify(goalsMetrics)}
Care Plans: ${JSON.stringify(carePlanMetrics)}
Sentiment: ${JSON.stringify(sentimentMetrics)}
Engagement: ${JSON.stringify(engagementMetrics)}
Health: ${JSON.stringify(healthMetrics)}`
        }
      ],
      temperature: 0.5,
      jsonMode: true,
      dataCategories: ["demographics","conditions","medications"],
      purpose: "patient_education",
      callerService: "ai-personalized-journeys",
      callerMethod: "personalize"});

    const result = JSON.parse(response.content || "{}");

    const snapshot = await storage.createUserProgressSnapshot({
      userId,
      snapshotDate: new Date(),
      period,
      goalsMetrics,
      carePlanMetrics,
      sentimentMetrics,
      engagementMetrics,
      healthMetrics,
      aiRecommendations: result.recommendations || [],
      overallWellnessScore: result.overallWellnessScore || 50,
    });

    return snapshot;
  } catch (error) {
    console.error("Error generating progress snapshot:", error);
    return null;
  }
}

function getMostFrequent<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let mostFrequent: T | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = item;
    }
  }
  return mostFrequent;
}

export const personalizedJourneysAI = {
  analyzeSentiment,
  generatePersonalizedContent,
  analyzeAndAdjustCarePlan,
  generateProgressSnapshot,
};
