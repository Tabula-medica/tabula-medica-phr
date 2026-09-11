import { Router, Request, Response } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";
import crypto from "crypto";

const router = Router();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Health content for education only. NOT clinical recommendations."
  };
  console.log("[HIPAA-AUDIT][HEALTH-CONTENT]", JSON.stringify(auditEntry));
}

interface ContentItem {
  id: string;
  title: string;
  type: "article" | "video" | "infographic" | "guide" | "tip";
  format: "text" | "video" | "image";
  category: string;
  summary: string;
  content: string;
  keyPoints: string[];
  readingTimeMinutes: number;
  relevanceScore: number;
  relatedConditions: string[];
  relatedMedications: string[];
  tags: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  createdAt: string;
  updatedAt: string;
}

interface ContentRecommendation {
  content: ContentItem;
  reason: string;
  priority: "high" | "medium" | "low";
  matchScore: number;
}

interface PatientProfile {
  conditions?: string[];
  medications?: string[];
  healthGoals?: string[];
  interests?: string[];
  preferredFormat?: "text" | "video" | "any";
  readingLevel?: "simple" | "standard" | "advanced";
  challenges?: string[];
  age?: string;
}

const healthContentLibrary: ContentItem[] = [
  {
    id: "article-bp-basics",
    title: "Understanding Your Blood Pressure Numbers",
    type: "article",
    format: "text",
    category: "Heart Health",
    summary: "Learn what your blood pressure readings mean and why they matter for your health.",
    content: "Blood pressure is measured using two numbers. The top number (systolic) measures the pressure in your arteries when your heart beats. The bottom number (diastolic) measures the pressure when your heart rests between beats...",
    keyPoints: [
      "Normal blood pressure is below 120/80 mmHg",
      "High blood pressure often has no symptoms",
      "Regular monitoring helps track your heart health",
      "Lifestyle changes can help manage blood pressure"
    ],
    readingTimeMinutes: 5,
    relevanceScore: 0,
    relatedConditions: ["hypertension", "heart disease", "stroke prevention"],
    relatedMedications: ["lisinopril", "amlodipine", "losartan", "metoprolol"],
    tags: ["blood pressure", "heart health", "cardiovascular", "basics"],
    difficulty: "beginner",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-15",
  },
  {
    id: "video-diabetes-meal-planning",
    title: "Meal Planning for Blood Sugar Control",
    type: "video",
    format: "video",
    category: "Nutrition",
    summary: "Practical tips for planning meals that help keep blood sugar levels steady.",
    content: "This video guide walks you through simple meal planning strategies that can help you maintain stable blood sugar levels throughout the day...",
    keyPoints: [
      "Balance carbs, protein, and healthy fats at each meal",
      "Choose whole grains over refined grains",
      "Include fiber-rich vegetables",
      "Plan snacks to prevent blood sugar dips"
    ],
    readingTimeMinutes: 12,
    relevanceScore: 0,
    relatedConditions: ["type 2 diabetes", "prediabetes", "metabolic syndrome"],
    relatedMedications: ["metformin", "glipizide", "jardiance", "insulin"],
    tags: ["diabetes", "nutrition", "meal planning", "blood sugar"],
    videoUrl: "/content/videos/meal-planning.mp4",
    difficulty: "beginner",
    createdAt: "2026-01-05",
    updatedAt: "2026-01-18",
  },
  {
    id: "guide-medication-adherence",
    title: "Tips for Remembering Your Medications",
    type: "guide",
    format: "text",
    category: "Medication Management",
    summary: "Practical strategies to help you take your medications as prescribed.",
    content: "Taking medications consistently is one of the most important things you can do for your health. Here are proven strategies to help you remember...",
    keyPoints: [
      "Use a pill organizer to track daily doses",
      "Set phone alarms at medication times",
      "Keep medications in a visible location",
      "Link taking meds to existing daily habits"
    ],
    readingTimeMinutes: 4,
    relevanceScore: 0,
    relatedConditions: ["chronic conditions", "multiple medications"],
    relatedMedications: [],
    tags: ["medication", "adherence", "tips", "self-care"],
    difficulty: "beginner",
    createdAt: "2026-01-03",
    updatedAt: "2026-01-16",
  },
  {
    id: "article-walking-benefits",
    title: "The Health Benefits of Daily Walking",
    type: "article",
    format: "text",
    category: "Exercise",
    summary: "Discover how a simple daily walk can improve your overall health.",
    content: "Walking is one of the easiest and most accessible forms of exercise. Even 30 minutes of walking daily can have significant health benefits...",
    keyPoints: [
      "Improves heart health and circulation",
      "Helps manage weight and blood sugar",
      "Boosts mood and reduces stress",
      "Can be done anywhere with no equipment"
    ],
    readingTimeMinutes: 6,
    relevanceScore: 0,
    relatedConditions: ["obesity", "heart disease", "diabetes", "depression", "anxiety"],
    relatedMedications: [],
    tags: ["exercise", "walking", "fitness", "wellness"],
    difficulty: "beginner",
    createdAt: "2026-01-02",
    updatedAt: "2026-01-14",
  },
  {
    id: "infographic-sleep-hygiene",
    title: "Better Sleep in 7 Steps",
    type: "infographic",
    format: "image",
    category: "Sleep",
    summary: "Visual guide to improving your sleep quality through simple habit changes.",
    content: "Quality sleep is essential for health. This infographic outlines seven key strategies for better sleep...",
    keyPoints: [
      "Keep a consistent sleep schedule",
      "Create a relaxing bedtime routine",
      "Make your bedroom cool, dark, and quiet",
      "Limit screens before bed"
    ],
    readingTimeMinutes: 3,
    relevanceScore: 0,
    relatedConditions: ["insomnia", "sleep apnea", "anxiety", "fatigue"],
    relatedMedications: ["melatonin", "trazodone", "ambien"],
    tags: ["sleep", "rest", "wellness", "habits"],
    thumbnailUrl: "/content/images/sleep-hygiene.png",
    difficulty: "beginner",
    createdAt: "2026-01-04",
    updatedAt: "2026-01-17",
  },
  {
    id: "video-stress-management",
    title: "5-Minute Stress Relief Techniques",
    type: "video",
    format: "video",
    category: "Mental Health",
    summary: "Quick, effective techniques you can use anywhere to reduce stress.",
    content: "Stress is a normal part of life, but chronic stress can affect your health. Learn quick techniques to manage stress in the moment...",
    keyPoints: [
      "Deep breathing exercises",
      "Progressive muscle relaxation",
      "Grounding techniques",
      "Mindful awareness practice"
    ],
    readingTimeMinutes: 8,
    relevanceScore: 0,
    relatedConditions: ["anxiety", "high blood pressure", "insomnia", "chronic pain"],
    relatedMedications: ["lexapro", "zoloft", "buspirone", "xanax"],
    tags: ["stress", "mental health", "relaxation", "coping"],
    videoUrl: "/content/videos/stress-relief.mp4",
    difficulty: "beginner",
    createdAt: "2026-01-06",
    updatedAt: "2026-01-19",
  },
  {
    id: "guide-cholesterol-basics",
    title: "Understanding Cholesterol and Heart Health",
    type: "guide",
    format: "text",
    category: "Heart Health",
    summary: "Learn about different types of cholesterol and what your numbers mean.",
    content: "Cholesterol is a waxy substance found in your blood. Your body needs cholesterol to build healthy cells, but high levels can increase heart disease risk...",
    keyPoints: [
      "LDL is 'bad' cholesterol - lower is better",
      "HDL is 'good' cholesterol - higher is better",
      "Triglycerides should be kept below 150 mg/dL",
      "Diet and exercise can improve cholesterol levels"
    ],
    readingTimeMinutes: 7,
    relevanceScore: 0,
    relatedConditions: ["high cholesterol", "heart disease", "atherosclerosis"],
    relatedMedications: ["atorvastatin", "rosuvastatin", "simvastatin", "lipitor"],
    tags: ["cholesterol", "heart health", "cardiovascular", "lipids"],
    difficulty: "intermediate",
    createdAt: "2026-01-07",
    updatedAt: "2026-01-20",
  },
  {
    id: "tip-hydration",
    title: "Daily Tip: Stay Hydrated",
    type: "tip",
    format: "text",
    category: "Wellness",
    summary: "Simple reminders for drinking enough water throughout your day.",
    content: "Proper hydration supports every system in your body. Most adults need about 8 glasses of water daily...",
    keyPoints: [
      "Drink water throughout the day, not all at once",
      "Keep a water bottle with you",
      "Eat water-rich foods like fruits and vegetables",
      "Check your urine color - pale yellow is good"
    ],
    readingTimeMinutes: 2,
    relevanceScore: 0,
    relatedConditions: ["kidney health", "fatigue", "headaches"],
    relatedMedications: ["diuretics", "lithium"],
    tags: ["hydration", "water", "wellness", "daily tips"],
    difficulty: "beginner",
    createdAt: "2026-01-08",
    updatedAt: "2026-01-21",
  },
];

function calculateRelevanceScore(content: ContentItem, profile: PatientProfile): number {
  let score = 0;
  
  if (profile.conditions) {
    const conditionMatches = content.relatedConditions.filter(c => 
      profile.conditions!.some(pc => c.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(c.toLowerCase()))
    );
    score += conditionMatches.length * 25;
  }
  
  if (profile.medications) {
    const medMatches = content.relatedMedications.filter(m =>
      profile.medications!.some(pm => m.toLowerCase().includes(pm.toLowerCase()) || pm.toLowerCase().includes(m.toLowerCase()))
    );
    score += medMatches.length * 20;
  }
  
  if (profile.healthGoals) {
    const goalKeywords = profile.healthGoals.flatMap(g => g.toLowerCase().split(' '));
    const tagMatches = content.tags.filter(t => goalKeywords.includes(t.toLowerCase()));
    score += tagMatches.length * 15;
  }
  
  if (profile.interests) {
    const interestMatches = content.tags.filter(t =>
      profile.interests!.some(i => t.toLowerCase().includes(i.toLowerCase()))
    );
    score += interestMatches.length * 10;
  }
  
  if (profile.preferredFormat && profile.preferredFormat !== "any") {
    if (content.format === profile.preferredFormat) {
      score += 10;
    }
  }
  
  if (profile.readingLevel) {
    if (
      (profile.readingLevel === "simple" && content.difficulty === "beginner") ||
      (profile.readingLevel === "standard" && content.difficulty !== "advanced") ||
      (profile.readingLevel === "advanced")
    ) {
      score += 5;
    }
  }
  
  return Math.min(100, score);
}

function generateRecommendations(profile: PatientProfile): ContentRecommendation[] {
  const scoredContent = healthContentLibrary.map(content => {
    const matchScore = calculateRelevanceScore(content, profile);
    let reason = "";
    
    const conditionMatches = content.relatedConditions.filter(c => 
      profile.conditions?.some(pc => c.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(c.toLowerCase()))
    );
    
    const medMatches = content.relatedMedications.filter(m =>
      profile.medications?.some(pm => m.toLowerCase().includes(pm.toLowerCase()) || pm.toLowerCase().includes(m.toLowerCase()))
    );
    
    if (conditionMatches.length > 0) {
      reason = `Related to your health conditions: ${conditionMatches.slice(0, 2).join(", ")}`;
    } else if (medMatches.length > 0) {
      reason = `Relevant to your medications`;
    } else if (profile.healthGoals && profile.healthGoals.length > 0) {
      reason = `Supports your health goals`;
    } else {
      reason = `General wellness recommendation`;
    }
    
    const priority: "high" | "medium" | "low" = 
      matchScore >= 50 ? "high" : 
      matchScore >= 25 ? "medium" : 
      "low";
    
    return {
      content: { ...content, relevanceScore: matchScore },
      reason,
      priority,
      matchScore,
    };
  });
  
  return scoredContent
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);
}

router.get("/categories", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_CONTENT_CATEGORIES", {}, req);
  
  const categories = [
    { id: "heart-health", name: "Heart Health", description: "Blood pressure, cholesterol, and cardiovascular wellness" },
    { id: "nutrition", name: "Nutrition", description: "Healthy eating, meal planning, and diet tips" },
    { id: "exercise", name: "Exercise", description: "Physical activity, fitness, and movement" },
    { id: "medication", name: "Medication Management", description: "Taking medications safely and effectively" },
    { id: "mental-health", name: "Mental Health", description: "Stress, anxiety, mood, and emotional wellness" },
    { id: "sleep", name: "Sleep", description: "Rest, sleep quality, and nighttime routines" },
    { id: "diabetes", name: "Diabetes Care", description: "Blood sugar management and diabetes education" },
    { id: "wellness", name: "General Wellness", description: "Everyday health habits and self-care" },
  ];
  
  res.json({ categories });
});

router.get("/library", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_CONTENT_LIBRARY", {}, req);
  
  try {
    const category = req.query.category as string | undefined;
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;
    
    let content = [...healthContentLibrary];
    
    if (category) {
      content = content.filter(c => c.category.toLowerCase().includes(category.toLowerCase()));
    }
    
    if (type) {
      content = content.filter(c => c.type === type);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      content = content.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.summary.toLowerCase().includes(searchLower) ||
        c.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }
    
    res.json({
      content,
      count: content.length,
      disclaimer: "Content is for educational purposes only. It is NOT medical advice.",
    });
  } catch (error) {
    console.error("Error fetching content library:", error);
    res.status(500).json({ error: "Failed to fetch content" });
  }
});

router.get("/content/:id", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_CONTENT_ITEM", { contentId: req.params.id }, req);
  
  try {
    const content = healthContentLibrary.find(c => c.id === req.params.id);
    
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    
    res.json({
      content,
      disclaimer: "This content is for educational purposes only. It is NOT medical advice. Always consult your healthcare provider for medical concerns.",
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: "Failed to fetch content" });
  }
});

router.post("/recommendations", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_PERSONALIZED_RECOMMENDATIONS", {}, req);
  
  try {
    const profile: PatientProfile = req.body.profile || {};
    
    const recommendations = generateRecommendations(profile);
    
    res.json({
      recommendations,
      count: recommendations.length,
      profile: {
        conditionsCount: profile.conditions?.length || 0,
        medicationsCount: profile.medications?.length || 0,
        goalsCount: profile.healthGoals?.length || 0,
      },
      disclaimer: "Recommendations are for educational purposes only. Content does NOT constitute medical advice.",
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

router.post("/ai-recommendations", async (req: Request, res: Response) => {
  logHIPAAAudit("AI_CONTENT_RECOMMENDATIONS", {}, req);
  
  try {
    const { profile, recentActivity, preferences } = req.body;
    
    const prompt = `You are a health education content curator. Based on the patient profile below, recommend educational content topics. Do NOT provide medical advice.

Patient Profile:
- Health Conditions: ${profile?.conditions?.join(", ") || "Not specified"}
- Medications: ${profile?.medications?.join(", ") || "Not specified"}
- Health Goals: ${profile?.healthGoals?.join(", ") || "Not specified"}
- Interests: ${profile?.interests?.join(", ") || "General wellness"}
- Challenges: ${profile?.challenges?.join(", ") || "Not specified"}
- Preferred Format: ${preferences?.format || "Any"}
- Reading Level: ${preferences?.readingLevel || "Standard"}

Recent Activity: ${recentActivity || "None tracked"}

Suggest 5 specific educational content topics that would be helpful for this person. For each topic:
1. Provide a title
2. Explain why it's relevant (1 sentence)
3. Suggest the best format (article, video, infographic, or guide)
4. Rate priority (high/medium/low)

Format your response as a JSON array with objects containing: title, reason, format, priority

Remember: These are EDUCATIONAL recommendations only, NOT medical advice.`;

    const aiContent = await generatePhiSafeText({
      system: "You are a health education curator. You recommend educational content to help people understand their health better. You NEVER provide medical advice. Always focus on general wellness, understanding health topics, and healthy lifestyle habits.",
      user: prompt,
      maxTokens: 800,
      responseMimeType: "application/json",
    });

    let aiRecommendations;
    try {
      const parsed = JSON.parse(aiContent || "{}");
      aiRecommendations = parsed.recommendations || parsed.topics || [];
    } catch {
      aiRecommendations = [];
    }

    res.json({
      aiRecommendations,
      disclaimer: "AI-generated recommendations are for educational purposes only. They do NOT constitute medical advice.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
    res.status(500).json({ error: "Failed to generate AI recommendations" });
  }
});

router.post("/generate-content", async (req: Request, res: Response) => {
  logHIPAAAudit("AI_GENERATE_CONTENT", { topic: req.body.topic }, req);
  
  try {
    const { topic, type, profile, difficulty } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Create educational health content about: "${topic}"

Content Type: ${type || "article"}
Difficulty Level: ${difficulty || "beginner"}
${profile?.conditions ? `Related Conditions: ${profile.conditions.join(", ")}` : ""}

Create content that:
1. Explains the topic in clear, simple language
2. Provides practical, actionable information
3. Includes 4-5 key takeaways
4. Is appropriate for someone learning about this topic
5. Does NOT provide medical advice, diagnosis, or treatment recommendations

Format your response as JSON with:
{
  "title": "Engaging title",
  "summary": "2-3 sentence summary",
  "content": "Main content (3-4 paragraphs)",
  "keyPoints": ["Point 1", "Point 2", ...],
  "actionItems": ["Simple action 1", "Simple action 2", ...]
}

IMPORTANT: Include a disclaimer that this is educational content only.`;

    const genContent = await generatePhiSafeText({
      system: "You are a health education writer. You create clear, helpful content about health topics using everyday language. You NEVER provide medical advice, diagnosis, or treatment recommendations. You always remind readers to consult healthcare providers for personal health questions.",
      user: prompt,
      maxTokens: 1000,
      responseMimeType: "application/json",
    });

    let generatedContent;
    try {
      generatedContent = JSON.parse(genContent || "{}");
    } catch {
      generatedContent = { error: "Failed to parse generated content" };
    }

    res.json({
      content: {
        id: `generated-${Date.now()}`,
        ...generatedContent,
        type: type || "article",
        format: "text",
        category: "Generated Content",
        readingTimeMinutes: Math.ceil((generatedContent.content?.length || 500) / 200),
        difficulty: difficulty || "beginner",
        createdAt: new Date().toISOString(),
      },
      disclaimer: "AI-generated content is for educational purposes only. It is NOT medical advice. Always consult your healthcare provider for personal health concerns.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

router.post("/explain", async (req: Request, res: Response) => {
  logHIPAAAudit("AI_EXPLAIN_TOPIC", { topic: req.body.topic }, req);
  
  try {
    const { topic, context, readingLevel } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const levelInstructions = {
      simple: "Use very simple words. Explain like talking to someone with no medical background. Avoid jargon completely.",
      standard: "Use clear, everyday language. Briefly explain any medical terms.",
      advanced: "You can use some medical terminology but still explain complex concepts clearly.",
    };

    const prompt = `Explain "${topic}" in simple terms.
${context ? `Context: ${context}` : ""}

${levelInstructions[readingLevel as keyof typeof levelInstructions] || levelInstructions.standard}

Provide:
1. A simple explanation (2-3 paragraphs)
2. An analogy or comparison to help understanding
3. 3 key points to remember

Do NOT provide medical advice. This is educational only.`;

    const explanation = (await generatePhiSafeText({
      system: "You are a patient health educator. You explain medical and health topics in simple, friendly terms. You help people understand their health without providing medical advice.",
      user: prompt,
      maxTokens: 600,
    })) || "Unable to generate explanation.";

    res.json({
      topic,
      explanation,
      disclaimer: "This explanation is for educational purposes only. It is NOT medical advice. Please consult your healthcare provider for personal health questions.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating explanation:", error);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
});

export function registerPersonalizedContentRoutes(app: any) {
  app.use("/api/health-content", router);
}
