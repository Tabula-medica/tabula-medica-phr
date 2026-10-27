import { chatComplete } from "./ai-client";
import { createHash } from "crypto";
import { storage } from "./storage";
import type { HealthRecord, AiConversation, InsertAiInsight } from "@shared/schema";

interface HistoryContext {
  patientName: string;
  records: HealthRecord[];
  conditions: HealthRecord[];
  medications: HealthRecord[];
  labs: HealthRecord[];
  procedures: HealthRecord[];
  immunizations: HealthRecord[];
  allergies: HealthRecord[];
  vitals: HealthRecord[];
}

async function getHistoryContext(userId: string): Promise<HistoryContext> {
  const user = await storage.getUser(userId);
  const records = await storage.getHealthRecords(userId);

  return {
    patientName: user?.name || "Patient",
    records,
    conditions: records.filter(r => r.type === "condition"),
    medications: records.filter(r => r.type === "medication"),
    labs: records.filter(r => r.type === "labs" || r.type === "lab"),
    procedures: records.filter(r => r.type === "procedure"),
    immunizations: records.filter(r => r.type === "immunization"),
    allergies: records.filter(r => r.type === "allergy"),
    vitals: records.filter(r => r.type === "vital"),
  };
}

function formatHistoryTimeline(ctx: HistoryContext): string {
  const parts: string[] = [`Patient: ${ctx.patientName}`, `Total Records: ${ctx.records.length}`];

  const sorted = [...ctx.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (ctx.conditions.length > 0) {
    parts.push(`\nConditions (${ctx.conditions.length}):`);
    ctx.conditions.forEach(c => parts.push(`- ${c.title}${c.summary ? `: ${c.summary}` : ""} [${new Date(c.date).toLocaleDateString()}]`));
  }
  if (ctx.medications.length > 0) {
    parts.push(`\nMedications (${ctx.medications.length}):`);
    ctx.medications.forEach(m => parts.push(`- ${m.title}${m.summary ? `: ${m.summary}` : ""} [${new Date(m.date).toLocaleDateString()}]`));
  }
  if (ctx.labs.length > 0) {
    parts.push(`\nLab Results (${ctx.labs.length}):`);
    ctx.labs.slice(0, 15).forEach(l => parts.push(`- ${l.title}: ${l.summary || "No summary"} [${new Date(l.date).toLocaleDateString()}]`));
  }
  if (ctx.procedures.length > 0) {
    parts.push(`\nProcedures (${ctx.procedures.length}):`);
    ctx.procedures.forEach(p => parts.push(`- ${p.title}${p.summary ? `: ${p.summary}` : ""} [${new Date(p.date).toLocaleDateString()}]`));
  }
  if (ctx.allergies.length > 0) {
    parts.push(`\nAllergies (${ctx.allergies.length}):`);
    ctx.allergies.forEach(a => parts.push(`- ${a.title}`));
  }
  if (ctx.immunizations.length > 0) {
    parts.push(`\nImmunizations (${ctx.immunizations.length}):`);
    ctx.immunizations.slice(0, 10).forEach(i => parts.push(`- ${i.title} [${new Date(i.date).toLocaleDateString()}]`));
  }
  if (ctx.vitals.length > 0) {
    parts.push(`\nRecent Vitals (${ctx.vitals.length}):`);
    ctx.vitals.slice(0, 10).forEach(v => parts.push(`- ${v.title}: ${v.summary || "recorded"} [${new Date(v.date).toLocaleDateString()}]`));
  }

  const yearGroups = new Map<number, number>();
  sorted.forEach(r => {
    const yr = new Date(r.date).getFullYear();
    yearGroups.set(yr, (yearGroups.get(yr) || 0) + 1);
  });
  if (yearGroups.size > 0) {
    parts.push(`\nTimeline Summary:`);
    [...yearGroups.entries()].sort((a, b) => b[0] - a[0]).forEach(([yr, count]) => {
      parts.push(`- ${yr}: ${count} record${count > 1 ? "s" : ""}`);
    });
  }

  return parts.join("\n");
}

function generateFingerprint(message: string): string {
  const normalized = message.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .sort()
    .join(" ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function extractTopicTags(message: string): string[] {
  const tagPatterns: [RegExp, string][] = [
    [/\b(medication|drug|prescription|pill|dose|dosage)\b/i, "medications"],
    [/\b(condition|diagnosis|disease|disorder|syndrome)\b/i, "conditions"],
    [/\b(lab|test|result|blood|panel|glucose|cholesterol)\b/i, "labs"],
    [/\b(procedure|surgery|operation|biopsy)\b/i, "procedures"],
    [/\b(allergy|allergic|reaction)\b/i, "allergies"],
    [/\b(vaccine|immunization|shot|booster)\b/i, "immunizations"],
    [/\b(vital|blood pressure|heart rate|weight|temperature|bmi)\b/i, "vitals"],
    [/\b(timeline|history|overview|chronolog|year)\b/i, "timeline"],
    [/\b(summary|summarize|overview|brief)\b/i, "summary"],
    [/\b(appointment|visit|doctor|provider|prepare)\b/i, "preparation"],
    [/\b(trend|pattern|change|progress|improv|worsen)\b/i, "trends"],
  ];
  const tags = new Set<string>();
  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(message)) tags.add(tag);
  }
  return [...tags];
}

const HISTORY_SYSTEM_PROMPT = `You are a specialized Health History Assistant for Tabula Medica, a HIPAA-compliant health records platform. Your role is to help patients understand, navigate, and gain insights from their complete medical history.

YOUR CORE CAPABILITIES:
1. TIMELINE EXPLORATION: Help patients understand what happened and when in their health journey. Explain chronological sequences of diagnoses, treatments, and outcomes.
2. PATTERN RECOGNITION: Identify connections between past events - how a diagnosis led to treatments, how medications changed over time, or how lab values trended.
3. RECORD CLARIFICATION: Explain medical terms, procedure names, lab result meanings, and diagnostic codes in plain language.
4. HISTORY SUMMARIZATION: Provide concise summaries of health history by time period, condition, or category when asked.
5. PREPARATION SUPPORT: Help patients prepare summaries of relevant history for upcoming appointments with new providers.

RESPONSE GUIDELINES:
- Reference specific dates, records, and data points from the patient's actual history
- Use plain, conversational language to explain medical terminology
- When discussing trends, mention specific values and dates
- Organize longer responses with clear sections
- Be empathetic about difficult health events in the patient's history
- If the patient has no records for a topic, say so clearly rather than guessing

SAFETY RULES:
- Never diagnose or recommend treatments
- Never interpret lab results as definitive medical conclusions
- Always recommend discussing concerns with their healthcare provider
- End every substantive response with the disclaimer
- Protect privacy - never suggest sharing specific health details externally

DISCLAIMER (include at end of each response):
"This is AI-assisted health history information, not medical advice. Always consult your healthcare provider for medical decisions."`;

export interface HistoryPrompt {
  id: string;
  category: "timeline" | "conditions" | "medications" | "labs" | "summary" | "preparation";
  title: string;
  prompt: string;
  icon: string;
}

export function getPrompts(ctx: HistoryContext): HistoryPrompt[] {
  const prompts: HistoryPrompt[] = [
    { id: "timeline-overview", category: "timeline", title: "My health timeline", prompt: "Give me an overview of my complete health history timeline, organized by year.", icon: "clock" },
    { id: "recent-changes", category: "timeline", title: "Recent changes", prompt: "What has changed in my health records in the most recent entries?", icon: "trending-up" },
  ];

  if (ctx.conditions.length > 0) {
    prompts.push(
      { id: "conditions-summary", category: "conditions", title: "My conditions explained", prompt: "Explain all my current conditions in simple terms and how they relate to each other.", icon: "heart" },
      { id: "condition-timeline", category: "conditions", title: "Condition progression", prompt: `How has my ${ctx.conditions[0]?.title || "primary condition"} progressed over time?`, icon: "git-branch" },
    );
  }

  if (ctx.medications.length > 0) {
    prompts.push(
      { id: "med-history", category: "medications", title: "Medication history", prompt: "Summarize my medication history - what I've taken, what changed, and what I'm currently on.", icon: "package" },
    );
  }

  if (ctx.labs.length > 0) {
    prompts.push(
      { id: "lab-trends", category: "labs", title: "Lab result trends", prompt: "What trends do you see in my lab results over time? Are any values improving or worsening?", icon: "bar-chart-2" },
      { id: "lab-explain", category: "labs", title: "Explain my latest labs", prompt: "Explain my most recent lab results in plain language. What do the values mean?", icon: "file-text" },
    );
  }

  prompts.push(
    { id: "full-summary", category: "summary", title: "Complete health summary", prompt: "Create a comprehensive summary of my entire health history that I could share with a new doctor.", icon: "clipboard" },
    { id: "appointment-prep", category: "preparation", title: "Prepare for a visit", prompt: "Help me prepare a summary of my relevant health history for an upcoming doctor's appointment.", icon: "calendar" },
    { id: "questions-for-doctor", category: "preparation", title: "Questions for my doctor", prompt: "Based on my health history, what questions should I consider asking at my next appointment?", icon: "help-circle" },
  );

  return prompts;
}

export interface ChatRequest {
  userId: string;
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  referencedRecords?: { id: string; title: string; type: string; date: string }[];
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const { userId, message, conversationId } = request;

  const fingerprint = generateFingerprint(message);
  const topicTags = extractTopicTags(message);

  let conversation;
  if (conversationId) {
    conversation = await storage.getAiConversation(conversationId);
  }
  if (!conversation) {
    conversation = await storage.createAiConversation({
      userId,
      title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
      context: "health_history",
      isActive: true,
      fingerprint,
      topicTags,
      messageCount: 0,
    });
  }

  const ctx = await getHistoryContext(userId);
  const timeline = formatHistoryTimeline(ctx);

  const previousMessages = await storage.getAiMessages(conversation.id);

  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: HISTORY_SYSTEM_PROMPT },
    { role: "system", content: `PATIENT HEALTH HISTORY DATA:\n${timeline}` },
  ];

  const recentMessages = previousMessages.slice(-10);
  for (const msg of recentMessages) {
    chatMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  await storage.addAiMessage({ conversationId: conversation.id, role: "user", content: message });
  chatMessages.push({ role: "user", content: message });

  const completion = await chatComplete({
    messages: chatMessages,
    model: "balanced",
    maxOutputTokens: 1500,
    temperature: 0.7,
    dataCategories: ["conditions", "medications", "lab_results", "vitals", "allergies", "clinical_notes"],
    purpose: "patient_education",
    userId,
    callerService: "ai-history-assistant",
    callerMethod: "chatWithHistory",
  });

  const responseContent = completion.content || "I wasn't able to process that request. Please try again.";

  await storage.addAiMessage({ conversationId: conversation.id, role: "assistant", content: responseContent });

  const allMsgs = await storage.getAiMessages(conversation.id);
  const combinedTags = new Set<string>([...(conversation.topicTags as string[] || []), ...topicTags]);
  await storage.updateAiConversation(conversation.id, {
    messageCount: allMsgs.length,
    topicTags: [...combinedTags],
  } as any);

  const referencedRecords = findReferencedRecords(responseContent, ctx.records);

  return {
    message: responseContent,
    conversationId: conversation.id,
    referencedRecords,
  };
}

function findReferencedRecords(response: string, records: HealthRecord[]) {
  const lower = response.toLowerCase();
  return records
    .filter(r => r.title && lower.includes(r.title.toLowerCase()))
    .slice(0, 5)
    .map(r => ({ id: r.id, title: r.title, type: r.type, date: new Date(r.date).toISOString() }));
}

export async function getConversations(userId: string) {
  const all = await storage.getUnmergedAiConversations(userId);
  return all.filter((c: any) => c.context === "health_history");
}

export async function getMessages(conversationId: string) {
  return storage.getAiMessages(conversationId);
}

export async function getTimeline(userId: string) {
  const conversations = await getConversations(userId);

  const timeline = conversations.map((c: any) => ({
    id: c.id,
    title: c.title || "Untitled Conversation",
    context: c.context,
    messageCount: c.messageCount || 0,
    topicTags: (c.topicTags as string[]) || [],
    summary: c.summary,
    fingerprint: c.fingerprint,
    hasDuplicates: false,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  const fpGroups = new Map<string, typeof timeline>();
  for (const entry of timeline) {
    if (!entry.fingerprint) continue;
    const group = fpGroups.get(entry.fingerprint) || [];
    group.push(entry);
    fpGroups.set(entry.fingerprint, group);
  }
  for (const group of fpGroups.values()) {
    if (group.length > 1) {
      group.forEach((e: any) => { e.hasDuplicates = true; });
    }
  }

  return timeline;
}

export async function summarizeConversation(conversationId: string, userId: string): Promise<{ summary: string; insights: InsertAiInsight[] }> {
  const conversation = await storage.getAiConversation(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  const messages = await storage.getAiMessages(conversationId);
  if (messages.length === 0) throw new Error("No messages to summarize");

  const messageText = messages
    .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const completion = await chatComplete({
    model: "balanced",
    messages: [
      {
        role: "system",
        content: `You are an AI that creates structured summaries of health-related conversations.

Output a JSON object with:
{
  "summary": "A 2-3 sentence plain-language summary of the conversation's key topics and conclusions.",
  "insights": [
    {
      "type": "observation|recommendation|trend|alert",
      "title": "Short title",
      "content": "Detailed insight text",
      "category": "medications|conditions|labs|vitals|general",
      "confidence": 0.0-1.0,
      "tags": ["tag1", "tag2"]
    }
  ]
}

Extract 1-3 actionable insights. Be specific. Always include the disclaimer that insights are AI-generated and not medical advice.`,
      },
      {
        role: "user",
        content: `Summarize this health history conversation:\n\n${messageText}`,
      },
    ],
    maxOutputTokens: 1000,
    temperature: 0.3,
    jsonMode: true,
    dataCategories: ["conditions", "medications", "lab_results", "vitals", "clinical_notes"],
    purpose: "documentation",
    userId,
    callerService: "ai-history-assistant",
    callerMethod: "summarizeConversation",
  });

  const raw = completion.content || "{}";
  let parsed: { summary?: string; insights?: any[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: "Unable to generate summary.", insights: [] };
  }

  const summary = parsed.summary || "Conversation summary unavailable.";
  await storage.updateAiConversation(conversationId, { summary } as any);

  const insights: InsertAiInsight[] = (parsed.insights || []).map((ins: any) => ({
    userId,
    conversationId,
    type: ins.type || "observation",
    title: ins.title || "Insight",
    content: ins.content || "",
    category: ins.category || "general",
    tags: ins.tags || [],
    confidence: typeof ins.confidence === "number" ? ins.confidence : 0.5,
    sourceMessageIds: messages.map((m: any) => m.id),
  }));

  for (const insight of insights) {
    await storage.createAiInsight(insight);
  }

  return { summary, insights };
}

export async function findDuplicates(userId: string) {
  const conversations = await getConversations(userId);

  const fpGroups = new Map<string, AiConversation[]>();
  for (const c of conversations) {
    if (!c.fingerprint) continue;
    const group = fpGroups.get(c.fingerprint) || [];
    group.push(c as AiConversation);
    fpGroups.set(c.fingerprint, group);
  }

  const duplicateGroups: { fingerprint: string; conversations: { id: string; title: string | null; messageCount: number | null; createdAt: Date }[] }[] = [];
  for (const [fp, group] of fpGroups.entries()) {
    if (group.length > 1) {
      duplicateGroups.push({
        fingerprint: fp,
        conversations: group.map(c => ({
          id: c.id,
          title: c.title,
          messageCount: c.messageCount,
          createdAt: c.createdAt,
        })),
      });
    }
  }

  return duplicateGroups;
}

export async function mergeDuplicates(userId: string, fingerprint: string) {
  const conversations = await storage.getAiConversationsByFingerprint(userId, fingerprint);
  if (conversations.length < 2) return null;

  const sorted = [...conversations].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const target = sorted[0];
  const sources = sorted.slice(1);

  const merged = await storage.mergeAiConversations(target.id, sources.map(s => s.id));
  return merged;
}

export async function deleteConversation(conversationId: string) {
  return storage.deleteAiConversation(conversationId);
}

export async function getInsights(userId: string, archived?: boolean) {
  return storage.getAiInsights(userId, archived);
}

export async function archiveInsight(insightId: string) {
  return storage.archiveAiInsight(insightId);
}

export async function deleteInsight(insightId: string) {
  return storage.deleteAiInsight(insightId);
}
