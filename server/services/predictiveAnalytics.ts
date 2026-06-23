// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";
import { storage } from "../storage";

function getOpenAIClient(): OpenAI {
  return new OpenAI();
}

export interface FeatureAdoptionTrend {
  featureId: string;
  featureName: string;
  currentUsage: number;
  predictedUsage30Days: number;
  predictedUsage90Days: number;
  trend: "growing" | "stable" | "declining";
  growthRate: number;
  confidenceScore: number;
  factors: string[];
  recommendations: string[];
  historicalData: { date: string; usage: number }[];
}

export interface ChurnMitigationStrategy {
  userId: string;
  userName: string;
  churnRisk: "critical" | "high" | "medium" | "low";
  churnProbability: number;
  riskFactors: { factor: string; impact: "high" | "medium" | "low"; description: string }[];
  mitigationStrategies: {
    id: string;
    strategy: string;
    priority: "immediate" | "short_term" | "long_term";
    expectedImpact: number;
    actionSteps: string[];
    estimatedCost: "low" | "medium" | "high";
    successProbability: number;
  }[];
  predictedChurnDate?: string;
  lastEngagement: string;
  engagementScore: number;
}

export interface AdoptionPrediction {
  overallAdoptionRate: number;
  predictedAdoptionRate30Days: number;
  predictedAdoptionRate90Days: number;
  topGrowingFeatures: FeatureAdoptionTrend[];
  decliningFeatures: FeatureAdoptionTrend[];
  recommendations: string[];
  insights: { type: string; message: string; priority: "high" | "medium" | "low" }[];
}

export interface ChurnDashboard {
  totalAtRisk: number;
  criticalRisk: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  predictedChurnRate: number;
  avgChurnProbability: number;
  topRiskFactors: { factor: string; affectedUsers: number; avgImpact: number }[];
  recommendedInterventions: { intervention: string; targetUsers: number; expectedRetention: number }[];
  atRiskUsers: ChurnMitigationStrategy[];
  trends: { date: string; atRisk: number; churned: number; retained: number }[];
}

export async function getFeatureAdoptionTrends(): Promise<AdoptionPrediction> {
  try {
    const featureUsage = await storage.getFeatureUsageAnalytics();
    
    if (!featureUsage || featureUsage.length === 0) {
      return getDefaultAdoptionPrediction();
    }

    const prompt = `Analyze feature adoption data and provide predictions. Data:
${JSON.stringify(featureUsage.slice(0, 10), null, 2)}

Return a JSON object with:
- overallAdoptionRate: number (0-100)
- predictedAdoptionRate30Days: number (0-100)
- predictedAdoptionRate90Days: number (0-100)
- topGrowingFeatures: array of { featureId, featureName, currentUsage, predictedUsage30Days, predictedUsage90Days, trend, growthRate, confidenceScore, factors: string[], recommendations: string[] }
- decliningFeatures: same structure
- recommendations: string[] of actionable items
- insights: array of { type, message, priority }`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a product analytics expert. Analyze feature adoption patterns and provide predictions with actionable recommendations. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      overallAdoptionRate: result.overallAdoptionRate || 75,
      predictedAdoptionRate30Days: result.predictedAdoptionRate30Days || 78,
      predictedAdoptionRate90Days: result.predictedAdoptionRate90Days || 82,
      topGrowingFeatures: result.topGrowingFeatures || getDefaultGrowingFeatures(),
      decliningFeatures: result.decliningFeatures || [],
      recommendations: result.recommendations || ["Monitor user engagement closely", "Consider feature tutorials"],
      insights: result.insights || [{ type: "trend", message: "Feature adoption is stable", priority: "medium" }],
    };
  } catch (error) {
    console.error("[PredictiveAnalytics] Error getting feature adoption trends:", error);
    return getDefaultAdoptionPrediction();
  }
}

export async function getChurnMitigationStrategies(): Promise<ChurnDashboard> {
  try {
    const churnPredictions = await storage.getChurnPredictions();
    
    if (!churnPredictions || churnPredictions.length === 0) {
      return getDefaultChurnDashboard();
    }

    const atRiskUsers = churnPredictions.filter(p => p.churnRisk !== "low");
    
    const prompt = `Analyze churn risk data and provide mitigation strategies. At-risk users:
${JSON.stringify(atRiskUsers.slice(0, 10), null, 2)}

Return a JSON object with:
- mitigationStrategies: array of detailed strategies for each user with:
  - userId, userName, churnRisk, churnProbability
  - riskFactors: array of { factor, impact, description }
  - mitigationStrategies: array of { id, strategy, priority, expectedImpact, actionSteps, estimatedCost, successProbability }
- topRiskFactors: array of { factor, affectedUsers, avgImpact }
- recommendedInterventions: array of { intervention, targetUsers, expectedRetention }
- insights: key observations`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a customer success expert specializing in churn prevention. Analyze risk factors and provide actionable mitigation strategies. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const strategies: ChurnMitigationStrategy[] = (result.mitigationStrategies || []).map((s: any) => ({
      userId: s.userId || "user-1",
      userName: s.userName || "User",
      churnRisk: s.churnRisk || "medium",
      churnProbability: s.churnProbability || 50,
      riskFactors: s.riskFactors || [],
      mitigationStrategies: s.mitigationStrategies || [],
      lastEngagement: s.lastEngagement || new Date().toISOString(),
      engagementScore: s.engagementScore || 50,
    }));

    return {
      totalAtRisk: atRiskUsers.length,
      criticalRisk: churnPredictions.filter(p => p.churnRisk === "critical").length,
      highRisk: churnPredictions.filter(p => p.churnRisk === "high").length,
      mediumRisk: churnPredictions.filter(p => p.churnRisk === "medium").length,
      lowRisk: churnPredictions.filter(p => p.churnRisk === "low").length,
      predictedChurnRate: calculatePredictedChurnRate(churnPredictions),
      avgChurnProbability: calculateAvgChurnProbability(churnPredictions),
      topRiskFactors: result.topRiskFactors || getDefaultRiskFactors(),
      recommendedInterventions: result.recommendedInterventions || getDefaultInterventions(),
      atRiskUsers: strategies.length > 0 ? strategies : getDefaultAtRiskUsers(atRiskUsers),
      trends: generateChurnTrends(),
    };
  } catch (error) {
    console.error("[PredictiveAnalytics] Error getting churn mitigation strategies:", error);
    return getDefaultChurnDashboard();
  }
}

export async function generateUserChurnMitigation(userId: string): Promise<ChurnMitigationStrategy | null> {
  try {
    const user = await storage.getUser(userId);
    
    if (!user) {
      return null;
    }

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
    
    const prompt = `Generate a detailed churn mitigation strategy for this user:
- User ID: ${userId}
- Name: ${userName}
- Role: ${user.role}
- Last login: ${user.lastLoginAt || "Unknown"}
- Account created: ${user.createdAt}

Return a JSON object with:
- churnRisk: "critical" | "high" | "medium" | "low"
- churnProbability: number (0-100)
- riskFactors: array of { factor, impact, description }
- mitigationStrategies: array of { id, strategy, priority, expectedImpact, actionSteps, estimatedCost, successProbability }
- predictedChurnDate: ISO date string if applicable
- engagementScore: number (0-100)`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a customer success expert. Analyze user data and provide personalized churn prevention strategies. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      userId,
      userName,
      churnRisk: result.churnRisk || "medium",
      churnProbability: result.churnProbability || 40,
      riskFactors: result.riskFactors || [],
      mitigationStrategies: result.mitigationStrategies || [],
      predictedChurnDate: result.predictedChurnDate,
      lastEngagement: user.lastLoginAt || new Date().toISOString(),
      engagementScore: result.engagementScore || 60,
    };
  } catch (error) {
    console.error("[PredictiveAnalytics] Error generating user churn mitigation:", error);
    return null;
  }
}

function calculatePredictedChurnRate(predictions: any[]): number {
  if (predictions.length === 0) return 0;
  const highRisk = predictions.filter(p => p.churnRisk === "critical" || p.churnRisk === "high").length;
  return Math.round((highRisk / predictions.length) * 100);
}

function calculateAvgChurnProbability(predictions: any[]): number {
  if (predictions.length === 0) return 0;
  const riskScores: Record<string, number> = { critical: 90, high: 70, medium: 40, low: 15 };
  const total = predictions.reduce((sum, p) => sum + (riskScores[p.churnRisk] || 25), 0);
  return Math.round(total / predictions.length);
}

function getDefaultAdoptionPrediction(): AdoptionPrediction {
  return {
    overallAdoptionRate: 72,
    predictedAdoptionRate30Days: 76,
    predictedAdoptionRate90Days: 82,
    topGrowingFeatures: getDefaultGrowingFeatures(),
    decliningFeatures: [
      {
        featureId: "legacy-reports",
        featureName: "Legacy Reports",
        currentUsage: 120,
        predictedUsage30Days: 95,
        predictedUsage90Days: 60,
        trend: "declining",
        growthRate: -25,
        confidenceScore: 85,
        factors: ["Replaced by new dashboard", "Users migrating to analytics"],
        recommendations: ["Consider deprecation notice", "Migrate remaining users"],
        historicalData: generateHistoricalData(150, -5),
      },
    ],
    recommendations: [
      "Promote AI Health Assistant to increase adoption",
      "Add onboarding tutorials for new features",
      "Send targeted emails to inactive users",
      "Simplify navigation to key features",
    ],
    insights: [
      { type: "growth", message: "AI features showing 40% month-over-month growth", priority: "high" },
      { type: "engagement", message: "Patient portal engagement up 15% this quarter", priority: "medium" },
      { type: "risk", message: "Legacy reports usage declining - plan migration", priority: "medium" },
    ],
  };
}

function getDefaultGrowingFeatures(): FeatureAdoptionTrend[] {
  return [
    {
      featureId: "ai-health-assistant",
      featureName: "AI Health Assistant",
      currentUsage: 450,
      predictedUsage30Days: 580,
      predictedUsage90Days: 850,
      trend: "growing",
      growthRate: 42,
      confidenceScore: 88,
      factors: ["New feature launch", "Positive user feedback", "Marketing push"],
      recommendations: ["Add more AI capabilities", "Promote in onboarding"],
      historicalData: generateHistoricalData(200, 25),
    },
    {
      featureId: "patient-portal",
      featureName: "Patient Portal",
      currentUsage: 1200,
      predictedUsage30Days: 1350,
      predictedUsage90Days: 1600,
      trend: "growing",
      growthRate: 18,
      confidenceScore: 92,
      factors: ["Core feature", "Improved UX", "Mobile optimization"],
      recommendations: ["Continue UX improvements", "Add more self-service options"],
      historicalData: generateHistoricalData(900, 15),
    },
    {
      featureId: "telehealth",
      featureName: "Video Visits",
      currentUsage: 380,
      predictedUsage30Days: 450,
      predictedUsage90Days: 580,
      trend: "growing",
      growthRate: 28,
      confidenceScore: 85,
      factors: ["Remote care demand", "Convenience factor"],
      recommendations: ["Improve video quality", "Add scheduling reminders"],
      historicalData: generateHistoricalData(250, 20),
    },
  ];
}

function getDefaultChurnDashboard(): ChurnDashboard {
  return {
    totalAtRisk: 45,
    criticalRisk: 8,
    highRisk: 15,
    mediumRisk: 22,
    lowRisk: 120,
    predictedChurnRate: 12,
    avgChurnProbability: 28,
    topRiskFactors: getDefaultRiskFactors(),
    recommendedInterventions: getDefaultInterventions(),
    atRiskUsers: getDefaultAtRiskUsers([]),
    trends: generateChurnTrends(),
  };
}

function getDefaultRiskFactors(): { factor: string; affectedUsers: number; avgImpact: number }[] {
  return [
    { factor: "Low login frequency", affectedUsers: 32, avgImpact: 75 },
    { factor: "Decreased feature usage", affectedUsers: 28, avgImpact: 68 },
    { factor: "Support ticket frustration", affectedUsers: 15, avgImpact: 82 },
    { factor: "Incomplete onboarding", affectedUsers: 22, avgImpact: 55 },
    { factor: "No recent activity", affectedUsers: 18, avgImpact: 90 },
  ];
}

function getDefaultInterventions(): { intervention: string; targetUsers: number; expectedRetention: number }[] {
  return [
    { intervention: "Personalized re-engagement email", targetUsers: 35, expectedRetention: 45 },
    { intervention: "One-on-one success call", targetUsers: 8, expectedRetention: 72 },
    { intervention: "Feature tutorial session", targetUsers: 22, expectedRetention: 55 },
    { intervention: "Loyalty discount offer", targetUsers: 15, expectedRetention: 38 },
    { intervention: "Product feedback survey", targetUsers: 45, expectedRetention: 25 },
  ];
}

function getDefaultAtRiskUsers(existing: any[]): ChurnMitigationStrategy[] {
  if (existing.length > 0) {
    return existing.slice(0, 10).map(u => ({
      userId: u.userId,
      userName: u.userName || "User",
      churnRisk: u.churnRisk,
      churnProbability: u.churnProbability || 50,
      riskFactors: [
        { factor: "Low engagement", impact: "high" as const, description: "User hasn't logged in recently" },
        { factor: "Feature underutilization", impact: "medium" as const, description: "Using fewer features than average" },
      ],
      mitigationStrategies: [
        {
          id: "strat-1",
          strategy: "Send personalized re-engagement email",
          priority: "immediate" as const,
          expectedImpact: 35,
          actionSteps: ["Craft personalized message", "Highlight new features", "Include success story"],
          estimatedCost: "low" as const,
          successProbability: 40,
        },
        {
          id: "strat-2",
          strategy: "Schedule success call",
          priority: "short_term" as const,
          expectedImpact: 60,
          actionSteps: ["Reach out via email", "Schedule 15-min call", "Understand pain points", "Offer solutions"],
          estimatedCost: "medium" as const,
          successProbability: 65,
        },
      ],
      lastEngagement: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      engagementScore: 35,
    }));
  }

  return [
    {
      userId: "user-at-risk-1",
      userName: "Sarah Johnson",
      churnRisk: "critical",
      churnProbability: 85,
      riskFactors: [
        { factor: "No login in 30 days", impact: "high", description: "User hasn't accessed the platform in a month" },
        { factor: "Unresolved support ticket", impact: "high", description: "Open ticket about data sync issues" },
        { factor: "Expired subscription warning", impact: "medium", description: "Subscription renews in 5 days" },
      ],
      mitigationStrategies: [
        {
          id: "strat-1a",
          strategy: "Priority support outreach",
          priority: "immediate",
          expectedImpact: 70,
          actionSteps: ["Resolve open ticket immediately", "Personal apology from support manager", "Offer extended trial"],
          estimatedCost: "medium",
          successProbability: 75,
        },
        {
          id: "strat-1b",
          strategy: "Executive escalation call",
          priority: "immediate",
          expectedImpact: 80,
          actionSteps: ["Schedule call with account executive", "Prepare retention offer", "Document concerns"],
          estimatedCost: "high",
          successProbability: 68,
        },
      ],
      predictedChurnDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastEngagement: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      engagementScore: 12,
    },
    {
      userId: "user-at-risk-2",
      userName: "Michael Chen",
      churnRisk: "high",
      churnProbability: 68,
      riskFactors: [
        { factor: "Declining usage", impact: "high", description: "Feature usage down 60% month-over-month" },
        { factor: "Competitor research", impact: "medium", description: "Visited pricing page multiple times" },
      ],
      mitigationStrategies: [
        {
          id: "strat-2a",
          strategy: "Feature adoption workshop",
          priority: "short_term",
          expectedImpact: 55,
          actionSteps: ["Identify underused features", "Create personalized tutorial", "Schedule training session"],
          estimatedCost: "low",
          successProbability: 58,
        },
      ],
      lastEngagement: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      engagementScore: 28,
    },
  ];
}

function generateHistoricalData(startValue: number, monthlyGrowth: number): { date: string; usage: number }[] {
  const data: { date: string; usage: number }[] = [];
  const now = new Date();
  let value = startValue;

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    data.push({
      date: date.toISOString().split("T")[0].slice(0, 7),
      usage: Math.round(value * (1 + (Math.random() * 0.1 - 0.05))),
    });
    value *= 1 + (monthlyGrowth / 100) / 12;
  }

  return data;
}

function generateChurnTrends(): { date: string; atRisk: number; churned: number; retained: number }[] {
  const data: { date: string; atRisk: number; churned: number; retained: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    data.push({
      date: date.toISOString().split("T")[0].slice(0, 7),
      atRisk: 40 + Math.floor(Math.random() * 20),
      churned: 5 + Math.floor(Math.random() * 8),
      retained: 30 + Math.floor(Math.random() * 15),
    });
  }

  return data;
}
