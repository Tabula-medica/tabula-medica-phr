import { openai } from "../replit_integrations/audio/client";
import { logPhiAccess } from "../security/hipaa-audit";
import { ensureSafeContent } from "./multilingualVoiceService";

export type ContentType = "article" | "tip" | "guide" | "infographic" | "video_script";
export type ContentFormat = "text" | "video" | "infographic";
export type ContentCategory = "education" | "lifestyle" | "medication" | "prevention" | "management" | "nutrition" | "exercise" | "mental_health";

export interface PatientContext {
  conditions?: string[];
  medications?: string[];
  healthGoals?: string[];
  recentSymptoms?: string[];
  adherenceData?: {
    medicationAdherence?: number;
    appointmentAttendance?: number;
    exerciseMinutes?: number;
  };
  preferences?: {
    preferredFormat?: ContentFormat;
    readingLevel?: "simple" | "standard" | "advanced";
    language?: string;
  };
}

export interface ContentPiece {
  id: string;
  title: string;
  type: ContentType;
  format: ContentFormat;
  category: ContentCategory;
  content: string;
  summary: string;
  keyPoints: string[];
  readingTimeMinutes: number;
  relevanceScore: number;
  relatedConditions: string[];
  relatedGoals: string[];
  actionItems?: string[];
  imagePrompt?: string;
  videoScript?: string;
  createdAt: string;
}

export interface ContentRecommendation {
  content: ContentPiece;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface GenerateContentRequest {
  userId: string;
  patientContext: PatientContext;
  contentType?: ContentType;
  category?: ContentCategory;
  topic?: string;
}

export interface RecommendContentRequest {
  userId: string;
  patientContext: PatientContext;
  limit?: number;
}

const CONTENT_SYSTEM_PROMPT = `You are a health education content creator for Tabula Medica, a patient health records app.
You create personalized, evidence-based health education content that is easy to understand.

CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER use prescriptive language like "should", "must", "recommend", "suggest", "advise"
3. NEVER provide medical diagnoses or treatment recommendations
4. Present information as educational facts, not personal advice
5. Always encourage patients to consult their healthcare providers
6. Keep content accessible and jargon-free unless explaining medical terms
7. Be empathetic and supportive in tone

CONTENT GUIDELINES:
- Articles: 300-500 words, structured with headings
- Tips: 50-100 words, actionable and specific
- Guides: 500-800 words, step-by-step format
- Infographics: Key points in bullet format for visual representation
- Video scripts: 1-2 minute narration scripts with scene descriptions`;

async function generateContentPiece(
  type: ContentType,
  category: ContentCategory,
  topic: string,
  patientContext: PatientContext
): Promise<ContentPiece> {
  const contextDescription = buildContextDescription(patientContext);
  
  const typeInstructions: Record<ContentType, string> = {
    article: "Create an educational article (300-500 words) with a clear title, introduction, body sections with headings, and conclusion.",
    tip: "Create a brief, actionable health tip (50-100 words) that is immediately useful.",
    guide: "Create a step-by-step guide (500-800 words) with numbered steps and clear explanations.",
    infographic: "Create content for an infographic with a title, 5-7 key points as bullet points, and statistics if relevant.",
    video_script: "Create a 1-2 minute video script with scene descriptions in [brackets] and narration text."
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: CONTENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Create a ${type} about "${topic}" in the ${category} category.

Patient context: ${contextDescription}

${typeInstructions[type]}

Return a JSON object with these fields:
- title: string (engaging, clear title)
- content: string (the main content)
- summary: string (1-2 sentence summary)
- keyPoints: string[] (3-5 key takeaways)
- actionItems: string[] (2-3 things the reader can discuss with their healthcare provider)
- relatedConditions: string[] (conditions this content relates to)
- relatedGoals: string[] (health goals this supports)
- imagePrompt: string (description for generating an accompanying image)
${type === "video_script" ? "- videoScript: string (the video narration script)" : ""}

Remember: Use only safe verbs (shows, states, refers to, means) and never give medical advice.`
        }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    const readingTime = type === "video_script" ? 2 : 
      type === "tip" ? 1 : 
      type === "infographic" ? 2 :
      Math.ceil((parsed.content?.length || 500) / 1000);

    return {
      id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: ensureSafeContent(parsed.title || topic),
      type,
      format: type === "video_script" ? "video" : type === "infographic" ? "infographic" : "text",
      category,
      content: ensureSafeContent(parsed.content || ""),
      summary: ensureSafeContent(parsed.summary || ""),
      keyPoints: (parsed.keyPoints || []).map((p: string) => ensureSafeContent(p)),
      readingTimeMinutes: readingTime,
      relevanceScore: calculateRelevanceScore(parsed, patientContext),
      relatedConditions: parsed.relatedConditions || [],
      relatedGoals: parsed.relatedGoals || [],
      actionItems: (parsed.actionItems || []).map((a: string) => ensureSafeContent(a)),
      imagePrompt: parsed.imagePrompt,
      videoScript: parsed.videoScript ? ensureSafeContent(parsed.videoScript) : undefined,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error("Failed to generate health content");
  }
}

function buildContextDescription(context: PatientContext): string {
  const parts: string[] = [];
  
  if (context.conditions?.length) {
    parts.push(`Conditions: ${context.conditions.join(", ")}`);
  }
  if (context.healthGoals?.length) {
    parts.push(`Health goals: ${context.healthGoals.join(", ")}`);
  }
  if (context.medications?.length) {
    parts.push(`Current medications: ${context.medications.join(", ")}`);
  }
  if (context.recentSymptoms?.length) {
    parts.push(`Recent symptoms: ${context.recentSymptoms.join(", ")}`);
  }
  if (context.adherenceData) {
    const adherence = context.adherenceData;
    if (adherence.medicationAdherence !== undefined) {
      parts.push(`Medication adherence: ${adherence.medicationAdherence}%`);
    }
    if (adherence.exerciseMinutes !== undefined) {
      parts.push(`Weekly exercise: ${adherence.exerciseMinutes} minutes`);
    }
  }
  if (context.preferences?.readingLevel) {
    parts.push(`Reading level preference: ${context.preferences.readingLevel}`);
  }
  
  return parts.length > 0 ? parts.join(". ") : "General health education";
}

function calculateRelevanceScore(content: any, context: PatientContext): number {
  let score = 0.5;
  
  const relatedConditions = content.relatedConditions || [];
  const relatedGoals = content.relatedGoals || [];
  
  if (context.conditions) {
    const matchingConditions = context.conditions.filter(c => 
      relatedConditions.some((rc: string) => rc.toLowerCase().includes(c.toLowerCase()))
    );
    score += matchingConditions.length * 0.1;
  }
  
  if (context.healthGoals) {
    const matchingGoals = context.healthGoals.filter(g =>
      relatedGoals.some((rg: string) => rg.toLowerCase().includes(g.toLowerCase()))
    );
    score += matchingGoals.length * 0.1;
  }
  
  return Math.min(score, 1.0);
}

async function generateTopicRecommendations(
  context: PatientContext
): Promise<Array<{ topic: string; category: ContentCategory; type: ContentType; reason: string; priority: "high" | "medium" | "low" }>> {
  try {
    const contextDescription = buildContextDescription(context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a health content recommendation engine. Based on patient context, suggest relevant health education topics.
Return topics that are educational and informative, not medical advice.

CRITICAL RULES:
1. Use ONLY these safe verbs: "shows", "states", "refers to", "means"
2. NEVER use prescriptive language like "should", "must", "recommend", "suggest", "advise", "need to", "have to"
3. NEVER provide medical diagnoses or treatment recommendations
4. All topics and reasons must be descriptive, not prescriptive`
        },
        {
          role: "user",
          content: `Based on this patient context, suggest 5-8 relevant health education topics:

${contextDescription}

Return a JSON object with a "recommendations" array. Each item should have:
- topic: string (specific, engaging topic title)
- category: one of "education", "lifestyle", "medication", "prevention", "management", "nutrition", "exercise", "mental_health"
- type: one of "article", "tip", "guide", "infographic", "video_script"
- reason: string (why this topic is relevant to the patient)
- priority: "high", "medium", or "low"

Prioritize topics related to:
1. Their current conditions (if any)
2. Their health goals (if any)
3. Areas where adherence data shows room for improvement
4. General wellness relevant to their situation`
        }
      ],
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return (parsed.recommendations || []).map((rec: any) => ({
      topic: ensureSafeContent(rec.topic),
      category: rec.category as ContentCategory,
      type: rec.type as ContentType,
      reason: ensureSafeContent(rec.reason),
      priority: rec.priority as "high" | "medium" | "low",
    }));
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return getDefaultRecommendations(context);
  }
}

function getDefaultRecommendations(context: PatientContext): Array<{ topic: string; category: ContentCategory; type: ContentType; reason: string; priority: "high" | "medium" | "low" }> {
  const recommendations = [];
  
  if (context.conditions?.some(c => c.toLowerCase().includes("diabetes"))) {
    recommendations.push({
      topic: "Understanding Blood Sugar Patterns",
      category: "management" as ContentCategory,
      type: "guide" as ContentType,
      reason: "This content shows information about diabetes management",
      priority: "high" as const,
    });
  }
  
  if (context.conditions?.some(c => c.toLowerCase().includes("hypertension") || c.toLowerCase().includes("blood pressure"))) {
    recommendations.push({
      topic: "What Blood Pressure Numbers Mean",
      category: "education" as ContentCategory,
      type: "infographic" as ContentType,
      reason: "This content shows how blood pressure readings work",
      priority: "high" as const,
    });
  }
  
  if (context.adherenceData?.medicationAdherence && context.adherenceData.medicationAdherence < 80) {
    recommendations.push({
      topic: "Medication Tracking Strategies",
      category: "medication" as ContentCategory,
      type: "tip" as ContentType,
      reason: "This content shows ways to track medication schedules",
      priority: "high" as const,
    });
  }
  
  recommendations.push({
    topic: "Understanding Your Health Records",
    category: "education" as ContentCategory,
    type: "article" as ContentType,
    reason: "This content shows how to navigate health information",
    priority: "medium" as const,
  });
  
  recommendations.push({
    topic: "Preparing for Healthcare Appointments",
    category: "lifestyle" as ContentCategory,
    type: "guide" as ContentType,
    reason: "This content shows how to prepare for provider visits",
    priority: "medium" as const,
  });
  
  return recommendations;
}

export async function generatePersonalizedContent(
  request: GenerateContentRequest
): Promise<ContentPiece> {
  const { userId, patientContext, contentType = "article", category = "education", topic } = request;
  
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "personalized_health_content",
    resourceId: `content_generation_${Date.now()}`,
    details: JSON.stringify({ contentType, category, topic, hasConditions: !!patientContext.conditions?.length }),
    timestamp: new Date().toISOString(),
  });
  
  const contentTopic = topic || await generateTopicFromContext(patientContext, category);
  
  return generateContentPiece(contentType, category, contentTopic, patientContext);
}

async function generateTopicFromContext(context: PatientContext, category: ContentCategory): Promise<string> {
  const categoryTopics: Record<ContentCategory, string[]> = {
    education: ["Understanding Your Lab Results", "How to Read Medical Reports", "Your Health Journey"],
    lifestyle: ["Daily Wellness Habits", "Sleep and Health", "Stress Management Basics"],
    medication: ["Understanding Your Medications", "Medication Safety Tips", "Tracking Your Medications"],
    prevention: ["Preventive Health Screenings", "Vaccination Information", "Early Warning Signs"],
    management: ["Managing Chronic Conditions", "Symptom Tracking", "Working with Your Care Team"],
    nutrition: ["Balanced Eating Basics", "Understanding Food Labels", "Hydration and Health"],
    exercise: ["Getting Started with Movement", "Exercise and Your Health", "Staying Active Safely"],
    mental_health: ["Mental Wellness Basics", "Stress and Your Body", "Mind-Body Connection"],
  };
  
  const topics = categoryTopics[category] || categoryTopics.education;
  return topics[Math.floor(Math.random() * topics.length)];
}

export async function getContentRecommendations(
  request: RecommendContentRequest
): Promise<ContentRecommendation[]> {
  const { userId, patientContext, limit = 6 } = request;
  
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "content_recommendations",
    resourceId: `recommendations_${Date.now()}`,
    details: JSON.stringify({ 
      conditions: patientContext.conditions?.length || 0,
      goals: patientContext.healthGoals?.length || 0,
    }),
    timestamp: new Date().toISOString(),
  });
  
  const topicRecommendations = await generateTopicRecommendations(patientContext);
  
  const contentPromises = topicRecommendations.slice(0, limit).map(async (rec) => {
    try {
      const content = await generateContentPiece(rec.type, rec.category, rec.topic, patientContext);
      return {
        content,
        reason: rec.reason,
        priority: rec.priority,
      };
    } catch {
      return null;
    }
  });
  
  const results = await Promise.all(contentPromises);
  return results.filter((r): r is ContentRecommendation => r !== null);
}

export function getContentCategories(): Array<{ id: ContentCategory; name: string; description: string }> {
  return [
    { id: "education", name: "Health Education", description: "Learn about health topics and medical terms" },
    { id: "lifestyle", name: "Lifestyle", description: "Daily habits and wellness practices" },
    { id: "medication", name: "Medication", description: "Understanding and managing medications" },
    { id: "prevention", name: "Prevention", description: "Preventive care and health screenings" },
    { id: "management", name: "Condition Management", description: "Managing chronic conditions" },
    { id: "nutrition", name: "Nutrition", description: "Diet, hydration, and healthy eating" },
    { id: "exercise", name: "Exercise", description: "Physical activity and movement" },
    { id: "mental_health", name: "Mental Health", description: "Emotional wellness and stress management" },
  ];
}

export function getContentTypes(): Array<{ id: ContentType; name: string; description: string; format: ContentFormat }> {
  return [
    { id: "article", name: "Article", description: "In-depth educational articles", format: "text" },
    { id: "tip", name: "Quick Tip", description: "Brief, actionable health tips", format: "text" },
    { id: "guide", name: "Step-by-Step Guide", description: "Detailed how-to guides", format: "text" },
    { id: "infographic", name: "Infographic", description: "Visual health information", format: "infographic" },
    { id: "video_script", name: "Video", description: "Short educational videos", format: "video" },
  ];
}
