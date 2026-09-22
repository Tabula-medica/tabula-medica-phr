import type {
  HealthContent,
  ContentRecommendation,
  HealthTrendAnalysis,
  EarlyWarningIndicator,
  ContentCategory,
  Problem,
  Medication,
  HealthGoal,
  LabResult,
  VitalSign,
} from "@shared/schema";
import { generatePhiSafeText } from "./services/ai-gateway";
import { randomUUID } from "crypto";

const healthContentLibrary: HealthContent[] = [
  {
    id: "content-1",
    title: "Understanding Your Blood Pressure Numbers",
    summary: "Learn what systolic and diastolic readings mean and how to maintain healthy blood pressure levels through lifestyle changes.",
    contentType: "article",
    category: "heart_health",
    tags: ["blood pressure", "hypertension", "cardiovascular", "heart health"],
    readTimeMinutes: 8,
    sourceName: "American Heart Association",
    publishedAt: "2025-12-15",
    isVerified: true,
    viewCount: 12500,
    likeCount: 890,
  },
  {
    id: "content-2",
    title: "Managing Type 2 Diabetes: A Comprehensive Guide",
    summary: "Practical strategies for blood sugar control, including diet tips, exercise recommendations, and medication management.",
    contentType: "guide",
    category: "diabetes_management",
    tags: ["diabetes", "blood sugar", "insulin", "A1C", "diet"],
    readTimeMinutes: 15,
    sourceName: "American Diabetes Association",
    publishedAt: "2025-11-20",
    isVerified: true,
    viewCount: 18700,
    likeCount: 1245,
  },
  {
    id: "content-3",
    title: "The Importance of Medication Adherence",
    summary: "Why taking medications as prescribed matters, and practical tips to never miss a dose.",
    contentType: "article",
    category: "medication_management",
    tags: ["medication", "adherence", "prescriptions", "reminders"],
    readTimeMinutes: 6,
    sourceName: "Mayo Clinic",
    publishedAt: "2025-10-28",
    isVerified: true,
    viewCount: 8900,
    likeCount: 567,
  },
  {
    id: "content-4",
    title: "Sleep and Heart Health: The Connection",
    summary: "Discover how quality sleep impacts cardiovascular health and learn tips for better rest.",
    contentType: "article",
    category: "sleep",
    tags: ["sleep", "heart health", "insomnia", "rest", "wellness"],
    readTimeMinutes: 7,
    sourceName: "Sleep Foundation",
    publishedAt: "2025-12-01",
    isVerified: true,
    viewCount: 6700,
    likeCount: 423,
  },
  {
    id: "content-5",
    title: "Exercise for Beginners: Starting Your Fitness Journey",
    summary: "A step-by-step guide to beginning an exercise routine, regardless of your current fitness level.",
    contentType: "guide",
    category: "exercise",
    tags: ["exercise", "fitness", "walking", "beginner", "activity"],
    readTimeMinutes: 12,
    sourceName: "CDC Physical Activity Guidelines",
    publishedAt: "2025-11-10",
    isVerified: true,
    viewCount: 22400,
    likeCount: 1567,
  },
  {
    id: "content-6",
    title: "Managing Anxiety and Stress Naturally",
    summary: "Evidence-based techniques for reducing anxiety and managing daily stress without medication.",
    contentType: "article",
    category: "mental_health",
    tags: ["anxiety", "stress", "mindfulness", "mental health", "relaxation"],
    readTimeMinutes: 10,
    sourceName: "National Institute of Mental Health",
    publishedAt: "2025-12-08",
    isVerified: true,
    viewCount: 15600,
    likeCount: 987,
  },
  {
    id: "content-7",
    title: "Heart-Healthy Eating: Mediterranean Diet Basics",
    summary: "Learn about the Mediterranean diet and how it can improve heart health and overall wellbeing.",
    contentType: "guide",
    category: "nutrition",
    tags: ["nutrition", "mediterranean diet", "heart health", "healthy eating"],
    readTimeMinutes: 11,
    sourceName: "Harvard Health",
    publishedAt: "2025-11-25",
    isVerified: true,
    viewCount: 19800,
    likeCount: 1345,
  },
  {
    id: "content-8",
    title: "Understanding Cholesterol: LDL vs HDL",
    summary: "A simple guide to understanding cholesterol numbers and what they mean for your health.",
    contentType: "infographic",
    category: "heart_health",
    tags: ["cholesterol", "LDL", "HDL", "lipids", "heart health"],
    readTimeMinutes: 5,
    sourceName: "Cleveland Clinic",
    publishedAt: "2025-10-15",
    isVerified: true,
    viewCount: 11200,
    likeCount: 678,
  },
  {
    id: "content-9",
    title: "Weight Loss: Science-Based Strategies",
    summary: "Evidence-based approaches to sustainable weight loss including calorie management and physical activity.",
    contentType: "guide",
    category: "weight_management",
    tags: ["weight loss", "obesity", "diet", "calories", "metabolism"],
    readTimeMinutes: 14,
    sourceName: "NIH Weight Management",
    publishedAt: "2025-12-05",
    isVerified: true,
    viewCount: 28500,
    likeCount: 2100,
  },
  {
    id: "content-10",
    title: "Kidney Health: Prevention and Early Detection",
    summary: "Learn about kidney function, risk factors for kidney disease, and how to protect your kidney health.",
    contentType: "article",
    category: "chronic_conditions",
    tags: ["kidney", "CKD", "dialysis", "kidney disease", "prevention"],
    readTimeMinutes: 9,
    sourceName: "National Kidney Foundation",
    publishedAt: "2025-11-18",
    isVerified: true,
    viewCount: 7800,
    likeCount: 456,
  },
  {
    id: "content-11",
    title: "Preventive Screenings: What You Need and When",
    summary: "A comprehensive guide to recommended health screenings based on age and risk factors.",
    contentType: "guide",
    category: "preventive_care",
    tags: ["screening", "prevention", "checkup", "cancer screening", "health maintenance"],
    readTimeMinutes: 10,
    sourceName: "US Preventive Services Task Force",
    publishedAt: "2025-10-30",
    isVerified: true,
    viewCount: 9400,
    likeCount: 612,
  },
  {
    id: "content-12",
    title: "Mindfulness Meditation for Better Health",
    summary: "How practicing mindfulness can reduce stress, improve focus, and support overall health.",
    contentType: "article",
    category: "stress_management",
    tags: ["mindfulness", "meditation", "stress", "relaxation", "mental clarity"],
    readTimeMinutes: 8,
    sourceName: "Mindful.org",
    publishedAt: "2025-12-10",
    isVerified: true,
    viewCount: 14200,
    likeCount: 923,
  },
];

const conditionToCategories: Record<string, ContentCategory[]> = {
  hypertension: ["heart_health", "nutrition", "stress_management"],
  diabetes: ["diabetes_management", "nutrition", "exercise", "weight_management"],
  "type 2 diabetes": ["diabetes_management", "nutrition", "exercise", "weight_management"],
  obesity: ["weight_management", "nutrition", "exercise"],
  depression: ["mental_health", "stress_management", "exercise"],
  anxiety: ["mental_health", "stress_management", "sleep"],
  asthma: ["chronic_conditions", "exercise"],
  "heart disease": ["heart_health", "nutrition", "exercise"],
  "high cholesterol": ["heart_health", "nutrition", "exercise"],
  "kidney disease": ["chronic_conditions", "nutrition"],
  insomnia: ["sleep", "stress_management", "mental_health"],
};

const goalToCategories: Record<string, ContentCategory[]> = {
  weight: ["weight_management", "nutrition", "exercise"],
  exercise: ["exercise", "wellness", "heart_health"],
  nutrition: ["nutrition", "weight_management", "heart_health"],
  medication: ["medication_management", "chronic_conditions"],
  mental_health: ["mental_health", "stress_management", "sleep"],
  sleep: ["sleep", "stress_management", "wellness"],
};

interface PatientProfile {
  conditions: Problem[];
  medications: Medication[];
  goals: HealthGoal[];
  labResults: LabResult[];
}

export async function generateContentRecommendations(
  patientId: string,
  profile: PatientProfile
): Promise<ContentRecommendation[]> {
  const recommendations: ContentRecommendation[] = [];
  const relevantCategories = new Set<ContentCategory>();
  const matchedConditions: string[] = [];
  const matchedGoals: string[] = [];
  const matchedMedications: string[] = [];

  for (const condition of profile.conditions.filter(c => c.status === "active")) {
    const normalizedName = condition.name.toLowerCase();
    for (const [pattern, categories] of Object.entries(conditionToCategories)) {
      if (normalizedName.includes(pattern)) {
        categories.forEach(cat => relevantCategories.add(cat));
        matchedConditions.push(condition.name);
      }
    }
  }

  for (const goal of profile.goals.filter(g => g.status === "active")) {
    const categories = goalToCategories[goal.category];
    if (categories) {
      categories.forEach(cat => relevantCategories.add(cat));
      matchedGoals.push(goal.title);
    }
  }

  for (const medication of profile.medications.filter(m => m.status === "active")) {
    matchedMedications.push(medication.name);
    relevantCategories.add("medication_management");
  }

  if (relevantCategories.size === 0) {
    relevantCategories.add("wellness");
    relevantCategories.add("preventive_care");
  }

  const matchedContent = healthContentLibrary.filter(content =>
    relevantCategories.has(content.category) ||
    content.tags.some(tag => 
      matchedConditions.some(c => c.toLowerCase().includes(tag.toLowerCase())) ||
      matchedGoals.some(g => g.toLowerCase().includes(tag.toLowerCase()))
    )
  );

  const scoredContent = matchedContent.map(content => {
    let score = 50;
    
    if (relevantCategories.has(content.category)) {
      score += 20;
    }
    
    const conditionMatches = matchedConditions.filter(c => 
      content.tags.some(t => c.toLowerCase().includes(t.toLowerCase()))
    );
    score += conditionMatches.length * 10;
    
    const goalMatches = matchedGoals.filter(g =>
      content.tags.some(t => g.toLowerCase().includes(t.toLowerCase()))
    );
    score += goalMatches.length * 8;
    
    if (content.isVerified) score += 5;
    score += Math.min(content.viewCount / 1000, 10);
    
    return { content, score: Math.min(score, 100), conditionMatches, goalMatches };
  });

  scoredContent.sort((a, b) => b.score - a.score);
  const topContent = scoredContent.slice(0, 6);

  for (const item of topContent) {
    const reasonParts: string[] = [];
    if (item.conditionMatches.length > 0) {
      reasonParts.push(`related to your ${item.conditionMatches[0]}`);
    }
    if (item.goalMatches.length > 0) {
      reasonParts.push(`supports your goal: ${item.goalMatches[0]}`);
    }
    if (reasonParts.length === 0) {
      reasonParts.push(`matches your health focus on ${item.content.category.replace(/_/g, ' ')}`);
    }

    recommendations.push({
      id: randomUUID(),
      patientId,
      contentId: item.content.id,
      content: item.content,
      relevanceScore: item.score,
      matchedConditions: item.conditionMatches,
      matchedGoals: item.goalMatches,
      matchedMedications: matchedMedications.slice(0, 3),
      recommendationReason: reasonParts.join(" and "),
      aiExplanation: `This ${item.content.contentType} from ${item.content.sourceName} is recommended because it ${reasonParts.join(" and ")}. It covers ${item.content.tags.slice(0, 3).join(", ")} which are relevant to your health profile.`,
      isSaved: false,
      isViewed: false,
      recommendedAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

export async function generateAIContentRecommendations(
  patientId: string,
  profile: PatientProfile
): Promise<ContentRecommendation[]> {
  const baseRecommendations = await generateContentRecommendations(patientId, profile);
  
  if (baseRecommendations.length === 0) {
    return baseRecommendations;
  }

  try {
    const conditionsList = profile.conditions
      .filter(c => c.status === "active")
      .map(c => c.name)
      .join(", ");
    const goalsList = profile.goals
      .filter(g => g.status === "active")
      .map(g => g.title)
      .join(", ");
    const medicationsList = profile.medications
      .filter(m => m.status === "active")
      .map(m => m.name)
      .slice(0, 5)
      .join(", ");

    const responseText = await generatePhiSafeText({
      system: `You are a health education specialist. Generate personalized explanations for why health content is relevant to a patient. Be encouraging, educational, and specific. Keep explanations under 100 words each.`,
      user: `Patient profile:
- Active conditions: ${conditionsList || "None specified"}
- Health goals: ${goalsList || "General wellness"}
- Current medications: ${medicationsList || "None"}

For each of these recommended articles, provide a personalized 1-2 sentence explanation of why it's relevant:
${baseRecommendations.map((r, i) => `${i + 1}. "${r.content.title}" (${r.content.category})`).join("\n")}

Return JSON array with format: [{"index": 0, "explanation": "..."}]`,
      maxTokens: 800,
      responseMimeType: "application/json",
    });

    const aiExplanations = JSON.parse(responseText || "{}");
    if (aiExplanations.explanations) {
      for (const exp of aiExplanations.explanations) {
        if (baseRecommendations[exp.index]) {
          baseRecommendations[exp.index].aiExplanation = exp.explanation;
        }
      }
    }
  } catch (error) {
    console.error("Error generating AI explanations for content:", error);
  }

  return baseRecommendations;
}

export function analyzeHealthTrends(
  patientId: string,
  labResults: LabResult[],
  vitals: VitalSign[]
): HealthTrendAnalysis[] {
  const trends: HealthTrendAnalysis[] = [];
  
  const labsByName: Record<string, LabResult[]> = {};
  for (const lab of labResults) {
    const key = lab.testName;
    if (!labsByName[key]) {
      labsByName[key] = [];
    }
    labsByName[key].push(lab);
  }

  for (const labName of Object.keys(labsByName)) {
    const results = labsByName[labName];
    if (results.length < 2) continue;
    
    const sorted = [...results].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    const recentResults = sorted.slice(0, 5);
    const current = parseFloat(recentResults[0].value) || 0;
    const previous = parseFloat(recentResults[recentResults.length - 1].value) || 0;
    
    if (current === 0 || previous === 0) continue;
    
    const percentChange = ((current - previous) / previous) * 100;
    const direction = percentChange > 5 ? "improving" : 
                      percentChange < -5 ? "declining" : 
                      Math.abs(percentChange) > 2 ? "fluctuating" : "stable";
    
    const isAbnormal = recentResults[0].status === "abnormal" || recentResults[0].status === "critical";
    const significance = isAbnormal && Math.abs(percentChange) > 10 ? "concerning" :
                        isAbnormal ? "notable" :
                        Math.abs(percentChange) > 15 ? "notable" : "normal";

    const dataPoints = recentResults.map(r => ({
      date: r.date,
      value: parseFloat(r.value) || 0,
    })).reverse();

    const relatedConditions: string[] = [];
    if (labName.toLowerCase().includes("glucose") || labName.toLowerCase().includes("a1c")) {
      relatedConditions.push("diabetes");
    }
    if (labName.toLowerCase().includes("cholesterol") || labName.toLowerCase().includes("ldl")) {
      relatedConditions.push("cardiovascular");
    }
    if (labName.toLowerCase().includes("creatinine") || labName.toLowerCase().includes("gfr")) {
      relatedConditions.push("kidney");
    }

    const recommendedActions: string[] = [];
    if (significance === "concerning") {
      recommendedActions.push("Discuss this trend with your healthcare provider");
      recommendedActions.push("Review any lifestyle factors that may be contributing");
    } else if (significance === "notable") {
      recommendedActions.push("Continue monitoring and track any symptoms");
    }

    trends.push({
      id: randomUUID(),
      patientId,
      metricType: "lab_result",
      metricName: labName,
      direction,
      significance,
      currentValue: recentResults[0].value,
      previousValue: recentResults[recentResults.length - 1].value,
      percentageChange: Math.round(percentChange * 10) / 10,
      dataPoints,
      timeRangeDays: Math.ceil((new Date(recentResults[0].date).getTime() - 
                               new Date(recentResults[recentResults.length - 1].date).getTime()) / 86400000),
      prediction: direction === "declining" ? 
        `If this trend continues, ${labName} may require closer monitoring` :
        direction === "improving" ?
        `Positive trend - continue current management approach` :
        `Values are stable within expected range`,
      confidenceLevel: Math.min(50 + recentResults.length * 10, 85),
      aiAnalysis: `Your ${labName} has ${direction === "stable" ? "remained stable" : `shown a ${direction} trend`} over the past ${Math.ceil((new Date(recentResults[0].date).getTime() - new Date(recentResults[recentResults.length - 1].date).getTime()) / 86400000)} days with a ${Math.abs(Math.round(percentChange))}% ${percentChange >= 0 ? "increase" : "decrease"}.`,
      recommendedActions,
      relatedConditions,
      createdAt: new Date().toISOString(),
    });
  }

  return trends.sort((a, b) => {
    const sigOrder = { critical: 0, concerning: 1, notable: 2, normal: 3 };
    return sigOrder[a.significance] - sigOrder[b.significance];
  });
}

export function detectEarlyWarnings(
  patientId: string,
  profile: PatientProfile,
  trends: HealthTrendAnalysis[]
): EarlyWarningIndicator[] {
  const warnings: EarlyWarningIndicator[] = [];

  const concerningTrends = trends.filter(t => 
    t.significance === "concerning" || t.significance === "critical"
  );

  for (const trend of concerningTrends) {
    if (trend.direction === "declining" && trend.significance === "concerning") {
      warnings.push({
        id: randomUUID(),
        patientId,
        warningType: "declining_metric",
        title: `${trend.metricName} Trend Alert`,
        description: `Your ${trend.metricName} has been declining over the past ${trend.timeRangeDays} days. This trend may warrant attention.`,
        warningLevel: "caution",
        triggerConditions: [`${Math.abs(trend.percentageChange)}% decline over ${trend.timeRangeDays} days`],
        affectedMetrics: [trend.metricName],
        potentialOutcome: `If unaddressed, this could indicate worsening of related health conditions`,
        timeToAction: "Within 2 weeks",
        recommendedSteps: [
          "Review recent lifestyle changes",
          "Check if medications are being taken as prescribed",
          "Consider scheduling a follow-up with your provider",
        ],
        confidenceScore: trend.confidenceLevel,
        aiReasoning: `The ${trend.metricName} has shown a consistent declining pattern based on ${trend.dataPoints.length} data points. ${trend.relatedConditions.length > 0 ? `This metric is associated with ${trend.relatedConditions.join(", ")}.` : ""}`,
        isAcknowledged: false,
        isResolved: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const activeConditions = profile.conditions.filter(c => c.status === "active");
  const diabetesRelated = activeConditions.some(c => 
    c.name.toLowerCase().includes("diabetes")
  );
  const heartRelated = activeConditions.some(c => 
    c.name.toLowerCase().includes("hypertension") || 
    c.name.toLowerCase().includes("heart")
  );

  if (diabetesRelated) {
    const glucoseTrend = trends.find(t => 
      t.metricName.toLowerCase().includes("glucose") || 
      t.metricName.toLowerCase().includes("a1c")
    );
    if (glucoseTrend && glucoseTrend.direction === "declining" && glucoseTrend.percentageChange < -10) {
      warnings.push({
        id: randomUUID(),
        patientId,
        warningType: "condition_monitoring",
        title: "Blood Sugar Management Alert",
        description: "Your blood sugar control metrics show significant changes that should be monitored closely.",
        warningLevel: "warning",
        triggerConditions: ["Blood glucose showing significant change", "Diabetes diagnosis present"],
        affectedMetrics: [glucoseTrend.metricName],
        potentialOutcome: "Uncontrolled blood sugar can lead to complications",
        timeToAction: "Within 1 week",
        recommendedSteps: [
          "Review your diet and carbohydrate intake",
          "Ensure consistent medication timing",
          "Monitor blood sugar more frequently",
          "Contact your endocrinologist if values remain abnormal",
        ],
        confidenceScore: 75,
        aiReasoning: "Based on your diabetes diagnosis and recent lab trends, proactive monitoring is recommended.",
        isAcknowledged: false,
        isResolved: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const medicationCount = profile.medications.filter(m => m.status === "active").length;
  if (medicationCount >= 5) {
    warnings.push({
      id: randomUUID(),
      patientId,
      warningType: "medication_review",
      title: "Medication Review Recommended",
      description: `You are currently taking ${medicationCount} medications. A comprehensive medication review can help ensure optimal therapy and minimize interactions.`,
      warningLevel: "watch",
      triggerConditions: ["5+ active medications"],
      affectedMetrics: [],
      potentialOutcome: "Polypharmacy increases risk of drug interactions and side effects",
      timeToAction: "At next provider visit",
      recommendedSteps: [
        "Bring all medication bottles to your next appointment",
        "Ask your pharmacist about potential interactions",
        "Review the need for each medication with your provider",
      ],
      confidenceScore: 70,
      aiReasoning: "Multiple medications increase complexity of care and risk of interactions. Regular review helps ensure all medications remain appropriate.",
      isAcknowledged: false,
      isResolved: false,
      createdAt: new Date().toISOString(),
    });
  }

  return warnings.sort((a, b) => {
    const levelOrder = { alert: 0, warning: 1, caution: 2, watch: 3 };
    return levelOrder[a.warningLevel] - levelOrder[b.warningLevel];
  });
}

export function getAllHealthContent(): HealthContent[] {
  return healthContentLibrary;
}

export function getHealthContentByCategory(category: ContentCategory): HealthContent[] {
  return healthContentLibrary.filter(c => c.category === category);
}

export function searchHealthContent(query: string): HealthContent[] {
  const lowerQuery = query.toLowerCase();
  return healthContentLibrary.filter(content =>
    content.title.toLowerCase().includes(lowerQuery) ||
    content.summary.toLowerCase().includes(lowerQuery) ||
    content.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
