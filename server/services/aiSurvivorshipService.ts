import OpenAI from "openai";
import type { SurvivorshipProfile, FollowUpSchedule, LateEffectWatchlistItem } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AISurvivorshipCarePlan {
  id: string;
  profileId: string;
  generatedAt: string;
  cancerType: string;
  stage: string;
  treatments: string[];
  yearsSinceTreatment: number;
  overviewSummary: string;
  immediateFollowUpNeeds: {
    category: string;
    title: string;
    frequency: string;
    rationale: string;
    priority: "high" | "medium" | "low";
  }[];
  longTermMonitoring: {
    area: string;
    recommendation: string;
    startingWhen: string;
    frequency: string;
  }[];
  lifestyleRecommendations: {
    category: string;
    recommendation: string;
    benefit: string;
  }[];
  mentalHealthSupport: {
    concern: string;
    recommendation: string;
    resources: string[];
  }[];
  aiConfidence: number;
  disclaimer: string;
}

export interface AIFollowUpSummary {
  id: string;
  profileId: string;
  generatedAt: string;
  overdueSummary: string;
  upcomingSummary: string;
  discussionPoints: {
    topic: string;
    timeframe: "discuss_soon" | "upcoming" | "routine";
    reason: string;
    suggestedDate?: string;
  }[];
  screeningRecommendations: {
    screening: string;
    frequency: string;
    lastCompleted?: string;
    nextDue: string;
    importance: string;
  }[];
  adherenceInsights: {
    completionRate: number;
    trend: "improving" | "stable" | "declining";
    suggestion: string;
  };
  aiConfidence: number;
  disclaimer: string;
}

export interface AILateEffectAnalysis {
  id: string;
  profileId: string;
  generatedAt: string;
  treatmentHistory: string[];
  potentialLateEffects: {
    effectType: string;
    relatedTreatments: string[];
    riskLevel: "low" | "moderate" | "high";
    typicalOnsetTime: string;
    symptoms: string[];
    discussionTopics: string[];
    preventiveMeasures: string[];
  }[];
  currentConcerns: {
    symptom: string;
    possibleCause: string;
    discussWithProvider: string;
    discussionTiming: "discuss_soon" | "at_next_visit" | "monitor";
  }[];
  educationalAlerts: {
    topic: string;
    reason: string;
    discussionPoint: string;
  }[];
  aiConfidence: number;
  disclaimer: string;
}

const NO_CDS_DISCLAIMER = "This AI-generated information is for educational purposes only and does NOT constitute medical advice or clinical decision support. Always consult your healthcare provider for personalized medical guidance.";

export async function generateSurvivorshipCarePlan(
  profile: SurvivorshipProfile,
  yearsSinceTreatment: number
): Promise<AISurvivorshipCarePlan> {
  const systemPrompt = `You are a healthcare education AI assistant specializing in cancer survivorship care. Generate educational information about survivorship care planning.

CRITICAL: You are NOT providing medical advice. All information is educational only.
- Do NOT make specific clinical recommendations
- Do NOT diagnose conditions
- Always recommend consulting healthcare providers
- Focus on general educational information about survivorship care

Output must be valid JSON matching this structure:
{
  "overviewSummary": "Brief educational overview of survivorship care for this cancer type",
  "immediateFollowUpNeeds": [{"category": "oncology|imaging|lab_work|cardiac|other", "title": "string", "frequency": "string", "rationale": "string", "priority": "high|medium|low"}],
  "longTermMonitoring": [{"area": "string", "recommendation": "string", "startingWhen": "string", "frequency": "string"}],
  "lifestyleRecommendations": [{"category": "nutrition|exercise|mental_health|other", "recommendation": "string", "benefit": "string"}],
  "mentalHealthSupport": [{"concern": "string", "recommendation": "string", "resources": ["string"]}],
  "aiConfidence": 0.0-1.0
}`;

  const userPrompt = `Generate an educational survivorship care overview for:
- Cancer Type: ${profile.cancerType}
- Stage: ${profile.stage || "Not specified"}
- Treatments Received: ${profile.treatments.join(", ")}
- Years Since Treatment Ended: ${yearsSinceTreatment}
- Notes: ${profile.notes || "None"}

Remember: This is educational information only, not medical advice.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      id: `care-plan-${Date.now()}`,
      profileId: profile.profileId,
      generatedAt: new Date().toISOString(),
      cancerType: profile.cancerType,
      stage: profile.stage || "Not specified",
      treatments: profile.treatments,
      yearsSinceTreatment,
      overviewSummary: parsed.overviewSummary || "Unable to generate summary",
      immediateFollowUpNeeds: parsed.immediateFollowUpNeeds || [],
      longTermMonitoring: parsed.longTermMonitoring || [],
      lifestyleRecommendations: parsed.lifestyleRecommendations || [],
      mentalHealthSupport: parsed.mentalHealthSupport || [],
      aiConfidence: parsed.aiConfidence || 0.7,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[AISurvivorshipService] Error generating care plan:", error);
    return getFallbackCarePlan(profile, yearsSinceTreatment);
  }
}

export async function generateFollowUpSummary(
  profile: SurvivorshipProfile,
  followUps: FollowUpSchedule[],
  yearsSinceTreatment: number
): Promise<AIFollowUpSummary> {
  const now = new Date();
  const overdue = followUps.filter(fu => fu.isActive && new Date(fu.nextDueDate) < now);
  const upcoming = followUps.filter(fu => {
    const dueDate = new Date(fu.nextDueDate);
    return fu.isActive && dueDate >= now && dueDate <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  });

  const systemPrompt = `You are a healthcare education AI assistant helping cancer survivors understand their follow-up care needs.

CRITICAL: You are NOT providing medical advice. All information is educational only.
- Do NOT make specific clinical recommendations
- Always recommend consulting healthcare providers
- Focus on general educational information

Output must be valid JSON:
{
  "overdueSummary": "Brief summary of overdue items",
  "upcomingSummary": "Brief summary of upcoming care needs",
  "discussionPoints": [{"topic": "string", "timeframe": "discuss_soon|upcoming|routine", "reason": "string", "suggestedDate": "string or null"}],
  "screeningInformation": [{"screening": "string", "typicalFrequency": "string", "lastCompleted": "string or null", "nextSuggested": "string", "educationalNote": "string"}],
  "adherenceInsights": {"completionRate": 0-100, "trend": "improving|stable|declining", "suggestion": "string"},
  "aiConfidence": 0.0-1.0
}`;

  const userPrompt = `Summarize follow-up care needs for a cancer survivor:
- Cancer Type: ${profile.cancerType}
- Treatments: ${profile.treatments.join(", ")}
- Years Since Treatment: ${yearsSinceTreatment}

Overdue Follow-ups (${overdue.length}):
${overdue.map(fu => `- ${fu.title} (${fu.category}) - Due: ${fu.nextDueDate}`).join("\n") || "None"}

Upcoming Follow-ups (next 90 days, ${upcoming.length}):
${upcoming.map(fu => `- ${fu.title} (${fu.category}) - Due: ${fu.nextDueDate}`).join("\n") || "None"}

Total Active Follow-ups: ${followUps.filter(fu => fu.isActive).length}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const completedCount = followUps.filter(fu => fu.lastCompletedDate).length;
    const completionRate = followUps.length > 0 ? Math.round((completedCount / followUps.length) * 100) : 0;

    return {
      id: `followup-summary-${Date.now()}`,
      profileId: profile.profileId,
      generatedAt: new Date().toISOString(),
      overdueSummary: parsed.overdueSummary || `You have ${overdue.length} overdue follow-up items.`,
      upcomingSummary: parsed.upcomingSummary || `${upcoming.length} follow-ups scheduled in the next 90 days.`,
      discussionPoints: parsed.discussionPoints || [],
      screeningRecommendations: parsed.screeningInformation?.map((s: {screening: string; typicalFrequency: string; lastCompleted?: string; nextSuggested: string; educationalNote: string}) => ({
        screening: s.screening,
        frequency: s.typicalFrequency,
        lastCompleted: s.lastCompleted,
        nextDue: s.nextSuggested,
        importance: s.educationalNote,
      })) || [],
      adherenceInsights: parsed.adherenceInsights || {
        completionRate,
        trend: "stable",
        suggestion: "Continue maintaining your follow-up schedule.",
      },
      aiConfidence: parsed.aiConfidence || 0.75,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[AISurvivorshipService] Error generating follow-up summary:", error);
    return getFallbackFollowUpSummary(profile, followUps);
  }
}

export async function analyzeLateEffects(
  profile: SurvivorshipProfile,
  watchlistItems: LateEffectWatchlistItem[],
  reportedSymptoms: string[],
  yearsSinceTreatment: number
): Promise<AILateEffectAnalysis> {
  const systemPrompt = `You are a healthcare education AI assistant helping cancer survivors understand potential late effects of treatment.

CRITICAL: You are NOT providing medical advice or diagnosis.
- Do NOT diagnose conditions
- Do NOT recommend specific treatments
- Always recommend consulting healthcare providers for any concerns
- Focus on educational information about what late effects are and general monitoring guidance

Output must be valid JSON:
{
  "potentialLateEffects": [{"effectType": "string", "relatedTreatments": ["string"], "riskLevel": "low|moderate|high", "typicalOnsetTime": "string", "symptoms": ["string"], "discussionTopics": ["string"], "preventiveMeasures": ["string"]}],
  "currentConcerns": [{"symptom": "string", "possibleCause": "string", "discussWithProvider": "string", "timeframe": "discuss_soon|at_next_visit|monitor"}],
  "educationalAlerts": [{"alert": "string", "reason": "string", "discussionTopic": "string"}],
  "aiConfidence": 0.0-1.0
}`;

  const userPrompt = `Provide educational information about potential late effects for:
- Cancer Type: ${profile.cancerType}
- Treatments Received: ${profile.treatments.join(", ")}
- Years Since Treatment: ${yearsSinceTreatment}

Currently Watching (${watchlistItems.length}):
${watchlistItems.map(item => `- ${item.effectType} (${item.status}, ${item.severity || "unknown severity"})`).join("\n") || "None"}

Reported Symptoms:
${reportedSymptoms.length > 0 ? reportedSymptoms.join(", ") : "None reported"}

Provide educational information about what late effects to be aware of based on treatment history.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      id: `late-effect-analysis-${Date.now()}`,
      profileId: profile.profileId,
      generatedAt: new Date().toISOString(),
      treatmentHistory: profile.treatments,
      potentialLateEffects: parsed.potentialLateEffects?.map((e: {effectType: string; relatedTreatments: string[]; riskLevel: string; typicalOnsetTime: string; symptoms: string[]; discussionTopics: string[]; preventiveMeasures: string[]}) => ({
        effectType: e.effectType,
        relatedTreatments: e.relatedTreatments,
        riskLevel: e.riskLevel as "low" | "moderate" | "high",
        typicalOnsetTime: e.typicalOnsetTime,
        symptoms: e.symptoms,
        discussionTopics: e.discussionTopics || [],
        preventiveMeasures: e.preventiveMeasures,
      })) || [],
      currentConcerns: parsed.currentConcerns?.map((c: {symptom: string; possibleCause: string; discussWithProvider: string; timeframe: string}) => ({
        symptom: c.symptom,
        possibleCause: c.possibleCause,
        discussWithProvider: c.discussWithProvider,
        discussionTiming: c.timeframe as "discuss_soon" | "at_next_visit" | "monitor",
      })) || [],
      educationalAlerts: parsed.educationalAlerts?.map((a: {alert: string; reason: string; discussionTopic: string}) => ({
        topic: a.alert,
        reason: a.reason,
        discussionPoint: a.discussionTopic,
      })) || [],
      aiConfidence: parsed.aiConfidence || 0.7,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[AISurvivorshipService] Error analyzing late effects:", error);
    return getFallbackLateEffectAnalysis(profile, yearsSinceTreatment);
  }
}

function getFallbackCarePlan(profile: SurvivorshipProfile, yearsSinceTreatment: number): AISurvivorshipCarePlan {
  return {
    id: `care-plan-fallback-${Date.now()}`,
    profileId: profile.profileId,
    generatedAt: new Date().toISOString(),
    cancerType: profile.cancerType,
    stage: profile.stage || "Not specified",
    treatments: profile.treatments,
    yearsSinceTreatment,
    overviewSummary: `Survivorship care after ${profile.cancerType} treatment typically includes regular follow-up visits with your oncology team, monitoring for recurrence, and managing any long-term effects of treatment.`,
    immediateFollowUpNeeds: [
      { category: "oncology", title: "Regular oncology follow-up visits", frequency: "Per oncologist recommendation", rationale: "Monitor for recurrence and manage ongoing care", priority: "high" },
    ],
    longTermMonitoring: [
      { area: "General health", recommendation: "Annual physical examination", startingWhen: "Ongoing", frequency: "Annually" },
    ],
    lifestyleRecommendations: [
      { category: "nutrition", recommendation: "Balanced diet with fruits and vegetables", benefit: "Supports overall health and recovery" },
      { category: "exercise", recommendation: "Regular physical activity as tolerated", benefit: "Improves energy and well-being" },
    ],
    mentalHealthSupport: [
      { concern: "Emotional adjustment", recommendation: "Consider support groups or counseling", resources: ["Cancer support organizations", "Mental health providers"] },
    ],
    aiConfidence: 0.5,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function getFallbackFollowUpSummary(profile: SurvivorshipProfile, followUps: FollowUpSchedule[]): AIFollowUpSummary {
  const overdue = followUps.filter(fu => fu.isActive && new Date(fu.nextDueDate) < new Date());
  return {
    id: `followup-summary-fallback-${Date.now()}`,
    profileId: profile.profileId,
    generatedAt: new Date().toISOString(),
    overdueSummary: overdue.length > 0 ? `${overdue.length} follow-up items are overdue. Please consult your healthcare provider.` : "No overdue items.",
    upcomingSummary: "Review your upcoming appointments with your healthcare team.",
    discussionPoints: overdue.map(fu => ({
      topic: `Schedule ${fu.title}`,
      timeframe: "upcoming" as const,
      reason: "Overdue follow-up",
      suggestedDate: fu.nextDueDate,
    })),
    screeningRecommendations: [],
    adherenceInsights: { completionRate: 75, trend: "stable", suggestion: "Continue regular follow-ups." },
    aiConfidence: 0.5,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function getFallbackLateEffectAnalysis(profile: SurvivorshipProfile, yearsSinceTreatment: number): AILateEffectAnalysis {
  return {
    id: `late-effect-analysis-fallback-${Date.now()}`,
    profileId: profile.profileId,
    generatedAt: new Date().toISOString(),
    treatmentHistory: profile.treatments,
    potentialLateEffects: profile.treatments.includes("chemotherapy") ? [
      { effectType: "Fatigue", relatedTreatments: ["chemotherapy"], riskLevel: "moderate", typicalOnsetTime: "During and after treatment", symptoms: ["Persistent tiredness", "Low energy"], discussionTopics: ["Consider discussing persistent fatigue with your healthcare team"], preventiveMeasures: ["Regular physical activity", "Adequate rest"] },
    ] : [],
    currentConcerns: [],
    educationalAlerts: [],
    aiConfidence: 0.5,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

console.log("[AISurvivorshipService] Service initialized with NO-CDS compliance");
