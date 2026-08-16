import {
  LibraryEducationContent,
  LibraryEducationFAQ,
  CarePlan,
} from "@shared/schema";
import * as educationLibraryService from "./educationLibraryService";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface PatientProfile {
  id: string;
  name: string;
  conditions: string[];
  activeMedications: string[];
  allergies: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors?: string[];
}

export interface PatientCarePlan {
  id: string;
  title: string;
  category: string;
  goals: { description: string; status: string }[];
  interventions: { description: string; status: string }[];
}

export interface PatientInteraction {
  id: string;
  type: "message" | "appointment" | "lab_result" | "medication_change" | "document_view" | "education_view";
  summary: string;
  date: string;
  metadata?: Record<string, string>;
}

export interface RecommendationContext {
  patient: PatientProfile;
  carePlans?: PatientCarePlan[];
  recentInteractions?: PatientInteraction[];
  viewedContentIds?: string[];
  preferences?: {
    readingLevel?: "basic" | "intermediate" | "advanced";
    preferredLanguage?: string;
    topicsOfInterest?: string[];
  };
}

export interface EducationRecommendation {
  id: string;
  patientId: string;
  contentId: string;
  contentType: "article" | "faq" | "video";
  title: string;
  summary: string;
  category: string;
  relevanceScore: number;
  matchReason: string;
  matchedFactors: string[];
  priority: "low" | "medium" | "high";
  estimatedReadTime?: number;
  generatedAt: string;
  status: "pending" | "viewed" | "dismissed" | "helpful" | "not_helpful";
}

export interface RecommendationSet {
  patientId: string;
  patientName: string;
  recommendations: EducationRecommendation[];
  generatedAt: string;
  contextSummary: string;
  aiGenerated: boolean;
}

const recommendationStore: Map<string, RecommendationSet> = new Map();

const RECOMMENDATION_PROMPT = `You are a healthcare education recommendation system. Your role is to suggest the most relevant educational materials for patients based on their health profile.

RULES:
- Focus on educational relevance, not medical advice
- Prioritize materials that address current conditions and care plan goals
- Consider the patient's reading level and preferences
- Explain WHY each recommendation is relevant using safe language
- Use only safe verbs: shows, states, refers to, means

Return recommendations that will help patients better understand their health conditions and care plans.`;

export async function generateRecommendations(
  context: RecommendationContext
): Promise<RecommendationSet> {
  const availableContent = educationLibraryService.getAllContent().filter(c => c.status === "approved");
  const availableFAQs = educationLibraryService.getAllFAQs().filter(f => f.status === "approved");

  if (!aiEnabled) {
    return generateRuleBasedRecommendations(context, availableContent, availableFAQs);
  }

  try {
    const contentSummary = availableContent.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      summary: c.summary,
      tags: c.tags,
      readingLevel: c.readingLevel,
    }));

    const faqSummary = availableFAQs.map(f => ({
      id: f.id,
      question: f.question,
      category: f.category,
      tags: f.tags,
    }));

    const response = await generatePhiSafeText({
      system: RECOMMENDATION_PROMPT,
      user: `Generate personalized education recommendations for this patient.

PATIENT PROFILE:
Name: ${context.patient.name}
Conditions: ${context.patient.conditions.join(", ") || "None specified"}
Active Medications: ${context.patient.activeMedications.join(", ") || "None"}
Allergies: ${context.patient.allergies.join(", ") || "None"}
Risk Level: ${context.patient.riskLevel}
Risk Factors: ${context.patient.riskFactors?.join(", ") || "None"}

${context.carePlans && context.carePlans.length > 0 ? `
ACTIVE CARE PLANS:
${context.carePlans.map(cp => `- ${cp.title} (${cp.category}): Goals: ${cp.goals.map(g => g.description).join(", ")}`).join("\n")}
` : ""}

${context.recentInteractions && context.recentInteractions.length > 0 ? `
RECENT INTERACTIONS:
${context.recentInteractions.slice(0, 5).map(i => `- ${i.type}: ${i.summary} (${i.date})`).join("\n")}
` : ""}

${context.preferences ? `
PREFERENCES:
Reading Level: ${context.preferences.readingLevel || "intermediate"}
Topics of Interest: ${context.preferences.topicsOfInterest?.join(", ") || "general"}
` : ""}

AVAILABLE CONTENT:
Articles: ${JSON.stringify(contentSummary.slice(0, 10))}
FAQs: ${JSON.stringify(faqSummary.slice(0, 10))}

Already Viewed: ${context.viewedContentIds?.join(", ") || "None"}

Return a JSON object with:
{
  "recommendations": [
    {
      "contentId": "id from available content",
      "contentType": "article" or "faq",
      "relevanceScore": 0-100,
      "matchReason": "Brief explanation of why this is relevant using safe language",
      "matchedFactors": ["condition", "care plan goal", "recent interaction", etc.],
      "priority": "low" | "medium" | "high"
    }
  ],
  "contextSummary": "Brief summary of the patient's education needs"
}

Recommend 3-5 most relevant items, prioritizing unviewed content.`,
      responseMimeType: "application/json",
      maxTokens: 1500,
    });

    const content = response || "{}";
    const parsed = JSON.parse(content);

    const recommendations: EducationRecommendation[] = (parsed.recommendations || []).map((rec: any, idx: number) => {
      const matchedContent = rec.contentType === "article" 
        ? availableContent.find(c => c.id === rec.contentId)
        : availableFAQs.find(f => f.id === rec.contentId);

      return {
        id: `rec-${Date.now()}-${idx}`,
        patientId: context.patient.id,
        contentId: rec.contentId,
        contentType: rec.contentType,
        title: matchedContent ? (rec.contentType === "article" ? (matchedContent as LibraryEducationContent).title : (matchedContent as LibraryEducationFAQ).question) : "Unknown",
        summary: matchedContent ? (rec.contentType === "article" ? (matchedContent as LibraryEducationContent).summary : (matchedContent as LibraryEducationFAQ).answer.substring(0, 150) + "...") : "",
        category: matchedContent?.category || "general_wellness",
        relevanceScore: rec.relevanceScore || 70,
        matchReason: rec.matchReason || "Related to patient's health profile",
        matchedFactors: rec.matchedFactors || [],
        priority: rec.priority || "medium",
        estimatedReadTime: rec.contentType === "article" ? (matchedContent as LibraryEducationContent)?.estimatedReadTime : 2,
        generatedAt: new Date().toISOString(),
        status: "pending",
      };
    });

    const recommendationSet: RecommendationSet = {
      patientId: context.patient.id,
      patientName: context.patient.name,
      recommendations,
      generatedAt: new Date().toISOString(),
      contextSummary: parsed.contextSummary || `Education recommendations for ${context.patient.name}`,
      aiGenerated: true,
    };

    recommendationStore.set(context.patient.id, recommendationSet);
    return recommendationSet;
  } catch (error) {
    console.error("[EducationRecommendation] AI generation error:", error);
    return generateRuleBasedRecommendations(context, availableContent, availableFAQs);
  }
}

function generateRuleBasedRecommendations(
  context: RecommendationContext,
  availableContent: LibraryEducationContent[],
  availableFAQs: LibraryEducationFAQ[]
): RecommendationSet {
  const recommendations: EducationRecommendation[] = [];
  const viewedSet = new Set(context.viewedContentIds || []);

  const categoryMapping: Record<string, string[]> = {
    diabetes: ["conditions", "medications", "nutrition", "lifestyle"],
    hypertension: ["conditions", "medications", "lifestyle", "exercise"],
    heart_disease: ["conditions", "medications", "exercise", "nutrition"],
    asthma: ["conditions", "medications", "prevention", "lifestyle"],
    obesity: ["nutrition", "exercise", "lifestyle", "prevention"],
    anxiety: ["mental_health", "lifestyle", "treatment"],
    depression: ["mental_health", "treatment", "lifestyle"],
  };

  const relevantCategories = new Set<string>();
  for (const condition of context.patient.conditions) {
    const conditionLower = condition.toLowerCase().replace(/\s+/g, "_");
    const mappedCategories = categoryMapping[conditionLower] || ["general_wellness"];
    mappedCategories.forEach(cat => relevantCategories.add(cat));
  }

  if (context.patient.riskLevel === "high" || context.patient.riskLevel === "critical") {
    relevantCategories.add("prevention");
    relevantCategories.add("emergency");
  }

  for (const content of availableContent) {
    if (viewedSet.has(content.id)) continue;

    const categoryMatch = relevantCategories.has(content.category);
    const tagMatch = content.tags.some(tag => 
      context.patient.conditions.some(c => c.toLowerCase().includes(tag.toLowerCase())) ||
      context.patient.activeMedications.some(m => m.toLowerCase().includes(tag.toLowerCase()))
    );

    if (categoryMatch || tagMatch) {
      const matchedFactors: string[] = [];
      if (categoryMatch) matchedFactors.push("category");
      if (tagMatch) matchedFactors.push("condition/medication match");

      recommendations.push({
        id: `rec-${Date.now()}-${recommendations.length}`,
        patientId: context.patient.id,
        contentId: content.id,
        contentType: "article",
        title: content.title,
        summary: content.summary,
        category: content.category,
        relevanceScore: categoryMatch && tagMatch ? 90 : categoryMatch ? 75 : 60,
        matchReason: `This article relates to your ${matchedFactors.join(" and ")}`,
        matchedFactors,
        priority: context.patient.riskLevel === "high" || context.patient.riskLevel === "critical" ? "high" : "medium",
        estimatedReadTime: content.estimatedReadTime,
        generatedAt: new Date().toISOString(),
        status: "pending",
      });
    }
  }

  for (const faq of availableFAQs) {
    if (viewedSet.has(faq.id)) continue;

    const tagMatch = faq.tags.some(tag =>
      context.patient.conditions.some(c => c.toLowerCase().includes(tag.toLowerCase())) ||
      context.patient.activeMedications.some(m => m.toLowerCase().includes(tag.toLowerCase()))
    );

    if (tagMatch) {
      recommendations.push({
        id: `rec-${Date.now()}-${recommendations.length}`,
        patientId: context.patient.id,
        contentId: faq.id,
        contentType: "faq",
        title: faq.question,
        summary: faq.answer.substring(0, 150) + "...",
        category: faq.category,
        relevanceScore: 70,
        matchReason: "This FAQ addresses topics related to your health profile",
        matchedFactors: ["tag match"],
        priority: "medium",
        estimatedReadTime: 2,
        generatedAt: new Date().toISOString(),
        status: "pending",
      });
    }
  }

  recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const topRecommendations = recommendations.slice(0, 5);

  const recommendationSet: RecommendationSet = {
    patientId: context.patient.id,
    patientName: context.patient.name,
    recommendations: topRecommendations,
    generatedAt: new Date().toISOString(),
    contextSummary: `Rule-based recommendations for ${context.patient.name} based on conditions: ${context.patient.conditions.join(", ")}`,
    aiGenerated: false,
  };

  recommendationStore.set(context.patient.id, recommendationSet);
  return recommendationSet;
}

export function getPatientRecommendations(patientId: string): RecommendationSet | undefined {
  return recommendationStore.get(patientId);
}

export function getAllRecommendations(): RecommendationSet[] {
  return Array.from(recommendationStore.values());
}

export function updateRecommendationStatus(
  patientId: string,
  recommendationId: string,
  status: "viewed" | "dismissed" | "helpful" | "not_helpful"
): EducationRecommendation | undefined {
  const set = recommendationStore.get(patientId);
  if (!set) return undefined;

  const rec = set.recommendations.find(r => r.id === recommendationId);
  if (rec) {
    rec.status = status;
    recommendationStore.set(patientId, set);
  }
  return rec;
}

export function getRecommendationStats(): {
  totalPatients: number;
  totalRecommendations: number;
  viewedCount: number;
  helpfulCount: number;
  dismissedCount: number;
  byCategory: Record<string, number>;
  avgRelevanceScore: number;
} {
  const allSets = Array.from(recommendationStore.values());
  const allRecs = allSets.flatMap(s => s.recommendations);
  const byCategory: Record<string, number> = {};

  for (const rec of allRecs) {
    byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
  }

  return {
    totalPatients: allSets.length,
    totalRecommendations: allRecs.length,
    viewedCount: allRecs.filter(r => r.status === "viewed").length,
    helpfulCount: allRecs.filter(r => r.status === "helpful").length,
    dismissedCount: allRecs.filter(r => r.status === "dismissed").length,
    byCategory,
    avgRelevanceScore: allRecs.length > 0 
      ? Math.round(allRecs.reduce((sum, r) => sum + r.relevanceScore, 0) / allRecs.length) 
      : 0,
  };
}

export function initializeSampleRecommendations(): void {
  const samplePatient: RecommendationContext = {
    patient: {
      id: "patient-1",
      name: "John Smith",
      conditions: ["Type 2 Diabetes", "Hypertension"],
      activeMedications: ["Metformin", "Lisinopril"],
      allergies: ["Penicillin"],
      riskLevel: "medium",
      riskFactors: ["Family history of heart disease"],
    },
    carePlans: [
      {
        id: "cp-1",
        title: "Diabetes Management",
        category: "chronic_disease",
        goals: [
          { description: "Maintain A1C below 7%", status: "in_progress" },
          { description: "Regular glucose monitoring", status: "in_progress" },
        ],
        interventions: [
          { description: "Daily medication adherence", status: "active" },
          { description: "Dietary modifications", status: "active" },
        ],
      },
    ],
    recentInteractions: [
      { id: "int-1", type: "appointment", summary: "Routine checkup with Dr. Patel", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "int-2", type: "lab_result", summary: "A1C test results received", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    preferences: {
      readingLevel: "intermediate",
      topicsOfInterest: ["nutrition", "exercise"],
    },
  };

  generateRuleBasedRecommendations(
    samplePatient,
    educationLibraryService.getAllContent().filter(c => c.status === "approved"),
    educationLibraryService.getAllFAQs().filter(f => f.status === "approved")
  );

  console.log("[EducationRecommendation] Initialized with sample recommendations");
}

initializeSampleRecommendations();
