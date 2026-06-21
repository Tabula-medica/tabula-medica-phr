import OpenAI from "openai";
import {
  LibraryEducationContent,
  LibraryEducationFAQ,
  LibraryContentType,
  EducationCategory,
  ContentApprovalStatus,
  LibraryReadingLevel,
  LibraryContentGenerationRequest,
  GeneratedLibraryArticle,
  GeneratedLibraryFAQSet,
  LibraryCurationStats,
  libraryContentTypes,
  educationCategories,
  contentApprovalStatuses,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function generateId(): string {
  return `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const educationContentStore: Map<string, LibraryEducationContent> = new Map();
const educationFAQStore: Map<string, LibraryEducationFAQ> = new Map();

const HIPAA_SAFE_SYSTEM_PROMPT = `You are a healthcare education content writer. You create clear, accurate, and patient-friendly educational materials.

CRITICAL LANGUAGE REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:
- Use ONLY these four safe verbs: "shows", "states", "refers to", "means"
- NEVER use: recommend, suggest, advise, prescribe, should, must, diagnose, treat, cure, indicates, describes, explains
- NEVER provide medical advice or treatment recommendations
- NEVER tell patients what to do - only provide factual information
- Always include reminders to consult healthcare providers for personalized guidance
- Use plain language appropriate for the specified reading level
- Be accurate, informative, and supportive in tone
- Focus on defining and explaining concepts factually, not giving instructions

Always include a safety disclaimer stating this is educational information only and not a substitute for professional medical advice.`;

function ensureSafeContent(text: string): string {
  const unsafePatterns = [
    { pattern: /\bshould\s+(?:take|use|try|do|avoid|start|stop|eat|exercise|monitor)\b/gi, replacement: "patients may consider discussing with their healthcare provider" },
    { pattern: /\bmust\s+(?:take|use|do|avoid)\b/gi, replacement: "healthcare providers often discuss" },
    { pattern: /\bwe\s+recommend\b/gi, replacement: "research shows" },
    { pattern: /\bI\s+recommend\b/gi, replacement: "studies show" },
    { pattern: /\byou\s+should\b/gi, replacement: "patients often" },
    { pattern: /\byou\s+need\s+to\b/gi, replacement: "patients may benefit from discussing" },
    { pattern: /\bprescribe\b/gi, replacement: "healthcare providers may discuss" },
    { pattern: /\bdiagnose\b/gi, replacement: "identify" },
    { pattern: /\btreat\b/gi, replacement: "manage" },
    { pattern: /\bindicates\b/gi, replacement: "shows" },
    { pattern: /\bdescribes\b/gi, replacement: "states" },
    { pattern: /\bexplains\b/gi, replacement: "means" },
    { pattern: /\badvise\b/gi, replacement: "note" },
    { pattern: /\bsuggest\b/gi, replacement: "note" },
    { pattern: /\bcure\b/gi, replacement: "address" },
  ];
  
  let safeText = text;
  for (const { pattern, replacement } of unsafePatterns) {
    safeText = safeText.replace(pattern, replacement);
  }
  return safeText;
}

export async function generateArticle(request: LibraryContentGenerationRequest): Promise<GeneratedLibraryArticle> {
  const readingLevelGuidance = {
    basic: "Use simple words, short sentences. 5th-6th grade reading level. Avoid medical jargon.",
    intermediate: "Use clear language with some medical terms explained. 8th-10th grade reading level.",
    advanced: "Can include medical terminology with explanations. College reading level.",
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate an educational article about: "${request.topic}"

Category: ${request.category}
Target conditions: ${request.targetConditions?.join(", ") || "general health"}
Reading level: ${request.readingLevel} - ${readingLevelGuidance[request.readingLevel]}
${request.keywords?.length ? `Keywords to include: ${request.keywords.join(", ")}` : ""}
${request.additionalContext ? `Additional context: ${request.additionalContext}` : ""}

Return a JSON object with:
{
  "title": "Engaging, descriptive title",
  "summary": "2-3 sentence summary of the article",
  "content": "Full article content (800-1200 words), use markdown formatting with headers, bullet points, and sections",
  "keyPoints": ["3-5 key factual takeaways from the article using only safe verbs: shows, states, refers to, means"],
  "actionItems": ["3-4 topics patients may wish to discuss with their healthcare provider - NOT instructions"],
  "relatedTopics": ["3-5 related health topics for further reading"],
  "estimatedReadTime": number of minutes to read,
  "safetyDisclaimer": "Clear disclaimer about consulting healthcare providers"
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      title: ensureSafeContent(parsed.title || `Understanding ${request.topic}`),
      summary: ensureSafeContent(parsed.summary || ""),
      content: ensureSafeContent(parsed.content || ""),
      keyPoints: (parsed.keyPoints || []).map(ensureSafeContent),
      actionItems: (parsed.actionItems || []).map(ensureSafeContent),
      relatedTopics: parsed.relatedTopics || [],
      estimatedReadTime: parsed.estimatedReadTime || 5,
      safetyDisclaimer: parsed.safetyDisclaimer || "This information is for educational purposes only and is not a substitute for professional medical advice. Always consult your healthcare provider for personalized guidance.",
    };
  } catch (error) {
    console.error("[EducationLibrary] Article generation error:", error);
    return generateFallbackArticle(request);
  }
}

export async function generateFAQs(request: LibraryContentGenerationRequest, count: number = 5): Promise<GeneratedLibraryFAQSet> {
  const readingLevelGuidance = {
    basic: "Use simple words, short sentences. 5th-6th grade reading level.",
    intermediate: "Use clear language with some medical terms explained.",
    advanced: "Can include medical terminology with explanations.",
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate ${count} frequently asked questions and answers about: "${request.topic}"

Category: ${request.category}
Target conditions: ${request.targetConditions?.join(", ") || "general health"}
Reading level: ${request.readingLevel} - ${readingLevelGuidance[request.readingLevel]}

Return a JSON object with:
{
  "faqs": [
    {
      "question": "Clear, patient-friendly question",
      "answer": "Informative answer (100-200 words), focusing on education not advice",
      "tags": ["relevant", "topic", "tags"]
    }
  ],
  "safetyDisclaimer": "Clear disclaimer about consulting healthcare providers"
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      faqs: (parsed.faqs || []).map((faq: any) => ({
        question: ensureSafeContent(faq.question || ""),
        answer: ensureSafeContent(faq.answer || ""),
        tags: faq.tags || [],
      })),
      safetyDisclaimer: parsed.safetyDisclaimer || "This information is for educational purposes only. Always consult your healthcare provider.",
    };
  } catch (error) {
    console.error("[EducationLibrary] FAQ generation error:", error);
    return generateFallbackFAQs(request);
  }
}

export async function generateVideoScript(request: LibraryContentGenerationRequest): Promise<{
  title: string;
  description: string;
  script: string;
  duration: string;
  keyTopics: string[];
  safetyDisclaimer: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate a video script outline about: "${request.topic}"

Category: ${request.category}
Reading level: ${request.readingLevel}

Return a JSON object with:
{
  "title": "Video title",
  "description": "Brief video description for preview",
  "script": "Detailed script/outline with sections, talking points, and visual suggestions. Use markdown formatting.",
  "duration": "Estimated video duration (e.g., '5-7 minutes')",
  "keyTopics": ["Main topics covered in the video"],
  "safetyDisclaimer": "Disclaimer for video description"
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      title: ensureSafeContent(parsed.title || `Video: ${request.topic}`),
      description: ensureSafeContent(parsed.description || ""),
      script: ensureSafeContent(parsed.script || ""),
      duration: parsed.duration || "5-10 minutes",
      keyTopics: parsed.keyTopics || [],
      safetyDisclaimer: parsed.safetyDisclaimer || "Educational content only. Consult your healthcare provider.",
    };
  } catch (error) {
    console.error("[EducationLibrary] Video script generation error:", error);
    throw new Error("Failed to generate video script");
  }
}

function generateFallbackArticle(request: LibraryContentGenerationRequest): GeneratedLibraryArticle {
  return {
    title: `Understanding ${request.topic}`,
    summary: `This article provides educational information about ${request.topic} to help you better understand this health topic.`,
    content: `## What is ${request.topic}?\n\nThis section explains the basics of ${request.topic} and why it matters for your health.\n\n## Key Information\n\nHere you'll find important details about ${request.topic} that can help you have informed conversations with your healthcare team.\n\n## What This Means for You\n\nUnderstanding ${request.topic} can help you engage more effectively with your healthcare providers and make informed decisions about your care.\n\n## Next Steps\n\nConsider discussing what you've learned here with your healthcare provider at your next appointment.`,
    keyPoints: [
      `${request.topic} is an important health topic to understand`,
      "Knowledge helps you have better conversations with your healthcare team",
      "Always consult healthcare providers for personalized guidance",
    ],
    actionItems: [
      "Review this information before your next healthcare appointment",
      "Write down any questions you have for your healthcare provider",
      "Keep track of relevant symptoms or concerns to discuss",
    ],
    relatedTopics: ["General Health", "Preventive Care", "Health Literacy"],
    estimatedReadTime: 5,
    safetyDisclaimer: "This information is for educational purposes only and is not a substitute for professional medical advice. Always consult your healthcare provider for personalized guidance.",
  };
}

function generateFallbackFAQs(request: LibraryContentGenerationRequest): GeneratedLibraryFAQSet {
  return {
    faqs: [
      {
        question: `What is ${request.topic}?`,
        answer: `${request.topic} refers to a health topic that affects many patients. Understanding this topic can help you have more informed conversations with your healthcare team about your care options.`,
        tags: [request.category, "basics"],
      },
      {
        question: `Why is understanding ${request.topic} important?`,
        answer: `Being informed about ${request.topic} helps you participate more actively in your healthcare decisions. Knowledge about health topics allows you to ask better questions and understand your care plan more fully.`,
        tags: [request.category, "importance"],
      },
    ],
    safetyDisclaimer: "This information is for educational purposes only. Always consult your healthcare provider.",
  };
}

export function createEducationContent(
  generatedArticle: GeneratedLibraryArticle,
  request: LibraryContentGenerationRequest,
  generatedBy: string = "ai-system"
): LibraryEducationContent {
  const id = generateId();
  const now = new Date().toISOString();
  
  const content: LibraryEducationContent = {
    id,
    type: request.type,
    category: request.category,
    title: generatedArticle.title,
    summary: generatedArticle.summary,
    content: generatedArticle.content,
    tags: [...(request.keywords || []), ...generatedArticle.relatedTopics.slice(0, 3)],
    relatedConditions: request.targetConditions || [],
    readingLevel: request.readingLevel,
    estimatedReadTime: generatedArticle.estimatedReadTime,
    status: "pending_review",
    aiGenerated: true,
    generatedBy,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    safetyDisclaimer: generatedArticle.safetyDisclaimer,
  };
  
  educationContentStore.set(id, content);
  console.log(`[EducationLibrary] Created content: ${id} - ${content.title}`);
  return content;
}

export function createFAQFromGenerated(
  faq: { question: string; answer: string; tags: string[] },
  request: LibraryContentGenerationRequest,
  generatedBy: string = "ai-system"
): LibraryEducationFAQ {
  const id = generateId();
  const now = new Date().toISOString();
  
  const educationFAQ: LibraryEducationFAQ = {
    id,
    category: request.category,
    question: faq.question,
    answer: faq.answer,
    relatedConditions: request.targetConditions || [],
    tags: faq.tags,
    readingLevel: request.readingLevel,
    status: "pending_review",
    aiGenerated: true,
    generatedBy,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  };
  
  educationFAQStore.set(id, educationFAQ);
  return educationFAQ;
}

export function getAllContent(filters?: {
  type?: LibraryContentType;
  category?: EducationCategory;
  status?: ContentApprovalStatus;
  readingLevel?: LibraryReadingLevel;
  aiGenerated?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): LibraryEducationContent[] {
  let contents = Array.from(educationContentStore.values());
  
  if (filters?.type) {
    contents = contents.filter(c => c.type === filters.type);
  }
  if (filters?.category) {
    contents = contents.filter(c => c.category === filters.category);
  }
  if (filters?.status) {
    contents = contents.filter(c => c.status === filters.status);
  }
  if (filters?.readingLevel) {
    contents = contents.filter(c => c.readingLevel === filters.readingLevel);
  }
  if (filters?.aiGenerated !== undefined) {
    contents = contents.filter(c => c.aiGenerated === filters.aiGenerated);
  }
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    contents = contents.filter(c =>
      c.title.toLowerCase().includes(searchLower) ||
      c.summary.toLowerCase().includes(searchLower) ||
      c.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }
  
  contents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const offset = filters?.offset || 0;
  const limit = filters?.limit || 50;
  return contents.slice(offset, offset + limit);
}

export function getAllFAQs(filters?: {
  category?: EducationCategory;
  status?: ContentApprovalStatus;
  search?: string;
}): LibraryEducationFAQ[] {
  let faqs = Array.from(educationFAQStore.values());
  
  if (filters?.category) {
    faqs = faqs.filter(f => f.category === filters.category);
  }
  if (filters?.status) {
    faqs = faqs.filter(f => f.status === filters.status);
  }
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    faqs = faqs.filter(f =>
      f.question.toLowerCase().includes(searchLower) ||
      f.answer.toLowerCase().includes(searchLower)
    );
  }
  
  return faqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getContentById(id: string): LibraryEducationContent | undefined {
  return educationContentStore.get(id);
}

export function getFAQById(id: string): LibraryEducationFAQ | undefined {
  return educationFAQStore.get(id);
}

export function approveContent(contentId: string, approvedBy: string, notes?: string): LibraryEducationContent | null {
  const content = educationContentStore.get(contentId);
  if (!content) return null;
  
  content.status = "approved";
  content.approvedBy = approvedBy;
  content.approvedAt = new Date().toISOString();
  content.updatedAt = new Date().toISOString();
  
  educationContentStore.set(contentId, content);
  console.log(`[EducationLibrary] Content approved: ${contentId} by ${approvedBy}`);
  return content;
}

export function rejectContent(contentId: string, rejectedBy: string, reason: string): LibraryEducationContent | null {
  const content = educationContentStore.get(contentId);
  if (!content) return null;
  
  content.status = "rejected";
  content.rejectionReason = reason;
  content.updatedAt = new Date().toISOString();
  
  educationContentStore.set(contentId, content);
  console.log(`[EducationLibrary] Content rejected: ${contentId} - ${reason}`);
  return content;
}

export function approveFAQ(faqId: string, approvedBy: string): LibraryEducationFAQ | null {
  const faq = educationFAQStore.get(faqId);
  if (!faq) return null;
  
  faq.status = "approved";
  faq.approvedBy = approvedBy;
  faq.approvedAt = new Date().toISOString();
  faq.updatedAt = new Date().toISOString();
  
  educationFAQStore.set(faqId, faq);
  return faq;
}

export function rejectFAQ(faqId: string, rejectedBy: string, reason: string): LibraryEducationFAQ | null {
  const faq = educationFAQStore.get(faqId);
  if (!faq) return null;
  
  faq.status = "rejected";
  faq.rejectionReason = reason;
  faq.updatedAt = new Date().toISOString();
  
  educationFAQStore.set(faqId, faq);
  return faq;
}

export function updateContentStatus(contentId: string, status: ContentApprovalStatus): LibraryEducationContent | null {
  const content = educationContentStore.get(contentId);
  if (!content) return null;
  
  content.status = status;
  content.updatedAt = new Date().toISOString();
  educationContentStore.set(contentId, content);
  return content;
}

export function recordContentView(contentId: string): void {
  const content = educationContentStore.get(contentId);
  if (content) {
    content.viewCount++;
    educationContentStore.set(contentId, content);
  }
}

export function recordContentFeedback(contentId: string, helpful: boolean): void {
  const content = educationContentStore.get(contentId);
  if (content) {
    if (helpful) {
      content.helpfulCount++;
    } else {
      content.notHelpfulCount++;
    }
    educationContentStore.set(contentId, content);
  }
}

export function recordFAQView(faqId: string): void {
  const faq = educationFAQStore.get(faqId);
  if (faq) {
    faq.viewCount++;
    educationFAQStore.set(faqId, faq);
  }
}

export function recordFAQFeedback(faqId: string, helpful: boolean): void {
  const faq = educationFAQStore.get(faqId);
  if (faq) {
    if (helpful) {
      faq.helpfulCount++;
    } else {
      faq.notHelpfulCount++;
    }
    educationFAQStore.set(faqId, faq);
  }
}

export function getCurationStats(): LibraryCurationStats {
  const contents = Array.from(educationContentStore.values());
  const faqs = Array.from(educationFAQStore.values());
  
  const byType: Record<LibraryContentType, number> = {
    article: 0,
    faq: 0,
    video: 0,
    infographic: 0,
    checklist: 0,
  };
  
  const byCategory: Record<EducationCategory, number> = {
    conditions: 0,
    medications: 0,
    nutrition: 0,
    exercise: 0,
    mental_health: 0,
    prevention: 0,
    treatment: 0,
    lifestyle: 0,
    emergency: 0,
    general_wellness: 0,
  };
  
  const byStatus: Record<ContentApprovalStatus, number> = {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  };
  
  let aiGenerated = 0;
  let manuallyCreated = 0;
  
  for (const content of contents) {
    byType[content.type]++;
    byCategory[content.category]++;
    byStatus[content.status]++;
    if (content.aiGenerated) aiGenerated++;
    else manuallyCreated++;
  }
  
  byType.faq = faqs.length;
  for (const faq of faqs) {
    byCategory[faq.category]++;
    byStatus[faq.status]++;
    if (faq.aiGenerated) aiGenerated++;
    else manuallyCreated++;
  }
  
  const mostViewed = contents
    .filter(c => c.status === "approved")
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5)
    .map(c => ({ id: c.id, title: c.title, viewCount: c.viewCount }));
  
  const mostHelpful = contents
    .filter(c => c.status === "approved")
    .sort((a, b) => b.helpfulCount - a.helpfulCount)
    .slice(0, 5)
    .map(c => ({ id: c.id, title: c.title, helpfulCount: c.helpfulCount }));
  
  return {
    totalContent: contents.length + faqs.length,
    byType,
    byCategory,
    byStatus,
    pendingReview: byStatus.pending_review,
    aiGenerated,
    manuallyCreated,
    mostViewed,
    mostHelpful,
  };
}

function initializeSampleContent(): void {
  const sampleContents: Partial<LibraryEducationContent>[] = [
    {
      type: "article",
      category: "medications",
      title: "Understanding Your Medication Schedule",
      summary: "Learn effective strategies for organizing and remembering your daily medications.",
      content: `## Why Medication Timing Matters\n\nTaking medications at the right time helps them work effectively. This article explains how medication schedules work and why consistency matters.\n\n## Setting Up a System\n\nMany patients find success with pill organizers, phone reminders, or linking medication times to daily routines like meals or bedtime.\n\n## Working With Your Healthcare Team\n\nIf you have questions about your medication schedule or experience difficulties, your pharmacist and healthcare provider can offer personalized guidance.`,
      tags: ["medications", "adherence", "daily routine"],
      relatedConditions: ["chronic conditions"],
      readingLevel: "basic",
      estimatedReadTime: 4,
      status: "approved",
      aiGenerated: true,
      viewCount: 245,
      helpfulCount: 89,
      notHelpfulCount: 5,
      safetyDisclaimer: "This is educational information only. Always follow your healthcare provider's instructions.",
    },
    {
      type: "article",
      category: "conditions",
      title: "Living Well with Diabetes: A Patient's Guide",
      summary: "Educational information about diabetes management and what to discuss with your healthcare team.",
      content: `## Understanding Diabetes\n\nDiabetes refers to a group of conditions that affect how your body processes blood sugar. Understanding the basics can help you have more informed conversations with your healthcare team.\n\n## Key Topics to Discuss\n\nConsider asking your healthcare provider about blood sugar monitoring, lifestyle factors, and how different foods affect blood sugar levels.\n\n## Staying Informed\n\nLearning about your condition helps you participate actively in your care decisions.`,
      tags: ["diabetes", "blood sugar", "chronic disease"],
      relatedConditions: ["Type 2 Diabetes", "Prediabetes"],
      readingLevel: "intermediate",
      estimatedReadTime: 6,
      status: "approved",
      aiGenerated: true,
      viewCount: 412,
      helpfulCount: 156,
      notHelpfulCount: 8,
      safetyDisclaimer: "This is educational information only. Consult your healthcare provider for personalized diabetes management.",
    },
    {
      type: "article",
      category: "prevention",
      title: "Understanding Preventive Health Screenings",
      summary: "Information about common health screenings and why they matter for early detection.",
      content: `## What Are Preventive Screenings?\n\nPreventive health screenings are tests that look for potential health issues before symptoms appear. Early detection often means more options for care.\n\n## Common Screenings by Age\n\nDifferent screenings are typically discussed at different life stages. Your healthcare provider can explain which screenings might be relevant for you.\n\n## Preparing for Your Appointment\n\nBefore a screening appointment, consider writing down any questions you have for your healthcare team.`,
      tags: ["preventive care", "screenings", "early detection"],
      relatedConditions: [],
      readingLevel: "basic",
      estimatedReadTime: 5,
      status: "pending_review",
      aiGenerated: true,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      safetyDisclaimer: "Discuss your specific screening needs with your healthcare provider.",
    },
  ];
  
  const now = new Date().toISOString();
  for (const sample of sampleContents) {
    const id = generateId();
    const content: LibraryEducationContent = {
      id,
      type: sample.type as LibraryContentType,
      category: sample.category as EducationCategory,
      title: sample.title || "",
      summary: sample.summary || "",
      content: sample.content || "",
      tags: sample.tags || [],
      relatedConditions: sample.relatedConditions || [],
      readingLevel: sample.readingLevel as LibraryReadingLevel || "basic",
      estimatedReadTime: sample.estimatedReadTime || 5,
      status: sample.status as ContentApprovalStatus || "draft",
      aiGenerated: sample.aiGenerated ?? true,
      generatedBy: "ai-system",
      createdAt: now,
      updatedAt: now,
      approvedBy: sample.status === "approved" ? "care-team-admin" : undefined,
      approvedAt: sample.status === "approved" ? now : undefined,
      viewCount: sample.viewCount || 0,
      helpfulCount: sample.helpfulCount || 0,
      notHelpfulCount: sample.notHelpfulCount || 0,
      safetyDisclaimer: sample.safetyDisclaimer || "Educational information only.",
    };
    educationContentStore.set(id, content);
  }
  
  const sampleFAQs: Partial<LibraryEducationFAQ>[] = [
    {
      category: "medications",
      question: "What happens if I miss a dose of my medication?",
      answer: "Missing a dose can happen to anyone. The best approach varies by medication type. Some medications can be taken when you remember, while others have specific timing requirements. Your pharmacist or healthcare provider can explain what to do for your specific medications. Many medication packaging includes guidance about missed doses.",
      tags: ["missed dose", "medication timing"],
      readingLevel: "basic",
      status: "approved",
      viewCount: 189,
      helpfulCount: 78,
    },
    {
      category: "conditions",
      question: "How do I know if my blood pressure is in a healthy range?",
      answer: "Blood pressure readings consist of two numbers: systolic (top) and diastolic (bottom). Healthcare providers typically discuss blood pressure targets during appointments. What constitutes a healthy range can vary based on individual factors, so it's important to discuss your specific targets with your healthcare team.",
      tags: ["blood pressure", "vital signs"],
      readingLevel: "basic",
      status: "approved",
      viewCount: 234,
      helpfulCount: 95,
    },
  ];
  
  for (const sample of sampleFAQs) {
    const id = generateId();
    const faq: LibraryEducationFAQ = {
      id,
      category: sample.category as EducationCategory,
      question: sample.question || "",
      answer: sample.answer || "",
      relatedConditions: sample.relatedConditions || [],
      tags: sample.tags || [],
      readingLevel: sample.readingLevel as LibraryReadingLevel || "basic",
      status: sample.status as ContentApprovalStatus || "draft",
      aiGenerated: true,
      generatedBy: "ai-system",
      createdAt: now,
      updatedAt: now,
      approvedBy: sample.status === "approved" ? "care-team-admin" : undefined,
      approvedAt: sample.status === "approved" ? now : undefined,
      viewCount: sample.viewCount || 0,
      helpfulCount: sample.helpfulCount || 0,
      notHelpfulCount: sample.notHelpfulCount || 0,
    };
    educationFAQStore.set(id, faq);
  }
  
  console.log(`[EducationLibrary] Initialized with ${educationContentStore.size} articles and ${educationFAQStore.size} FAQs`);
}

initializeSampleContent();

export default {
  generateArticle,
  generateFAQs,
  generateVideoScript,
  createEducationContent,
  createFAQFromGenerated,
  getAllContent,
  getAllFAQs,
  getContentById,
  getFAQById,
  approveContent,
  rejectContent,
  approveFAQ,
  rejectFAQ,
  updateContentStatus,
  recordContentView,
  recordContentFeedback,
  recordFAQView,
  recordFAQFeedback,
  getCurationStats,
};
