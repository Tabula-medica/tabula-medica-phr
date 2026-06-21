import OpenAI from "openai";
import { randomUUID } from "crypto";
import { storage } from "../storage";

export class ConversationOwnershipError extends Error {
  constructor() {
    super("Conversation does not belong to the authenticated patient");
    this.name = "ConversationOwnershipError";
  }
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ChatbotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  category?: string;
  suggestedFollowUps?: string[];
  requiresProviderEscalation?: boolean;
  confidence?: number;
}

export interface ChatbotConversation {
  id: string;
  patientId: string;
  messages: ChatbotMessage[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "resolved" | "escalated";
  topic?: string;
}

export interface MessageSummary {
  id: string;
  messageId: string;
  threadId: string;
  summary: string;
  keyPoints: string[];
  detectedIntent: string;
  suggestedPriority: "normal" | "high" | "urgent";
  suggestedCategory: string;
  patientConcerns: string[];
  actionItems: string[];
  requiresUrgentResponse: boolean;
  sentimentScore: number;
  confidence: number;
  generatedAt: string;
}

export interface FollowUpDraft {
  id: string;
  patientId: string;
  carePlanId?: string;
  triggerType: "care_plan_progress" | "health_data" | "appointment" | "medication_adherence" | "lab_results";
  subject: string;
  content: string;
  personalizedElements: string[];
  actionItems: string[];
  tone: "encouraging" | "informative" | "reminder" | "congratulatory";
  generatedAt: string;
  status: "draft" | "approved" | "sent" | "discarded";
}

const chatbotConversations: Map<string, ChatbotConversation> = new Map();
const messageSummaries: Map<string, MessageSummary> = new Map();
const followUpDrafts: Map<string, FollowUpDraft> = new Map();

const FAQ_KNOWLEDGE_BASE = `
You are a helpful healthcare assistant for Tabula Medica, a patient health records platform.
You can answer questions about:
1. Health conditions - general information about common conditions, symptoms, and when to seek care
2. Medications - general information about how medications work, common side effects, and adherence tips
3. App usage - how to use Tabula Medica features like viewing records, scheduling appointments, messaging providers
4. General wellness - tips for healthy living, diet, exercise, sleep, and stress management
5. Healthcare navigation - understanding lab results, preparing for appointments, understanding medical terms

IMPORTANT GUIDELINES:
- Never provide specific medical advice or diagnoses
- Always recommend consulting a healthcare provider for personalized medical questions
- Be empathetic and supportive
- Use plain language, avoid medical jargon when possible
- If the question requires medical expertise, suggest the patient contact their care team
- For urgent symptoms, always advise seeking immediate medical care
- You can explain general concepts but cannot interpret specific test results or symptoms for diagnosis
`;

async function getPatientContext(patientId: string) {
  try {
    const [patient, medications, carePlans] = await Promise.all([
      storage.getPatient(patientId),
      storage.getMedicationsByPatient(patientId),
      storage.getCarePlans ? storage.getCarePlans(patientId) : Promise.resolve([]),
    ]);
    
    const records = await storage.getMedicalRecordsByPatient(patientId);
    const conditions = records?.filter(r => r.type === "diagnosis" && r.status === "active").map(r => r.title) || [];
    
    return {
      patientName: patient?.firstName || "Patient",
      conditions,
      activeMedications: medications?.filter(m => m.status === "active").map(m => m.name) || [],
      activeCarePlans: carePlans?.filter((cp: any) => cp.status === "active") || [],
    };
  } catch (error) {
    console.error("Error getting patient context:", error);
    return {
      patientName: "Patient",
      conditions: [],
      activeMedications: [],
      activeCarePlans: [],
    };
  }
}

export async function processPatientFAQ(
  patientId: string,
  conversationId: string | null,
  userMessage: string
): Promise<{ conversation: ChatbotConversation; response: ChatbotMessage }> {
  let conversation: ChatbotConversation;
  
  if (conversationId && chatbotConversations.has(conversationId)) {
    const existing = chatbotConversations.get(conversationId)!;
    if (existing.patientId !== patientId) {
      throw new ConversationOwnershipError();
    }
    conversation = existing;
  } else {
    conversation = {
      id: randomUUID(),
      patientId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
    };
    chatbotConversations.set(conversation.id, conversation);
  }

  const userMsg: ChatbotMessage = {
    id: randomUUID(),
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  conversation.messages.push(userMsg);

  const context = await getPatientContext(patientId);
  
  const conversationHistory = conversation.messages.slice(-10).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${FAQ_KNOWLEDGE_BASE}
          
Patient Context (use to personalize responses):
- Patient Name: ${context.patientName}
- Known Conditions: ${context.conditions.join(", ") || "Not specified"}
- Active Medications: ${context.activeMedications.join(", ") || "None documented"}

Respond in a helpful, empathetic manner. If the patient asks about their specific medications or conditions, you can acknowledge them but remind them to consult their provider for specific medical advice.

After your response, provide:
1. A category for this question (health_condition, medication, app_usage, wellness, healthcare_navigation, other)
2. 2-3 suggested follow-up questions the patient might have
3. Whether this should be escalated to a provider (true/false)
4. Confidence score (0-1) in your response

Format your response as JSON:
{
  "response": "Your helpful response here",
  "category": "category_name",
  "suggestedFollowUps": ["question 1", "question 2"],
  "requiresEscalation": false,
  "confidence": 0.9
}`
        },
        ...conversationHistory,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    let parsed: any;
    
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        response: content,
        category: "other",
        suggestedFollowUps: [],
        requiresEscalation: false,
        confidence: 0.7,
      };
    }

    const assistantMsg: ChatbotMessage = {
      id: randomUUID(),
      role: "assistant",
      content: parsed.response,
      timestamp: new Date().toISOString(),
      category: parsed.category,
      suggestedFollowUps: parsed.suggestedFollowUps,
      requiresProviderEscalation: parsed.requiresEscalation,
      confidence: parsed.confidence,
    };

    conversation.messages.push(assistantMsg);
    conversation.updatedAt = new Date().toISOString();
    conversation.topic = parsed.category;
    
    if (parsed.requiresEscalation) {
      conversation.status = "escalated";
    }

    chatbotConversations.set(conversation.id, conversation);

    return { conversation, response: assistantMsg };
  } catch (error) {
    console.error("Error processing FAQ:", error);
    const errorMsg: ChatbotMessage = {
      id: randomUUID(),
      role: "assistant",
      content: "I apologize, but I'm having trouble processing your question right now. Please try again in a moment, or contact your care team directly if you need immediate assistance.",
      timestamp: new Date().toISOString(),
      confidence: 0,
    };
    conversation.messages.push(errorMsg);
    return { conversation, response: errorMsg };
  }
}

export async function summarizePatientMessage(
  messageId: string,
  threadId: string,
  patientId: string,
  messageContent: string,
  threadSubject: string,
  threadHistory: Array<{ role: string; content: string; timestamp: string }>
): Promise<MessageSummary> {
  const context = await getPatientContext(patientId);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a healthcare message analyst helping providers efficiently process patient messages.
          
Analyze the patient message and provide a structured summary that helps the provider quickly understand and prioritize the message.

Patient Context:
- Name: ${context.patientName}
- Known Conditions: ${context.conditions.join(", ") || "Not specified"}
- Current Medications: ${context.activeMedications.join(", ") || "None documented"}

Thread Subject: ${threadSubject}

Previous messages in thread:
${threadHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join("\n")}

Analyze the latest message and provide:
{
  "summary": "Brief 1-2 sentence summary of the message",
  "keyPoints": ["Key point 1", "Key point 2"],
  "detectedIntent": "question|request|concern|update|emergency",
  "suggestedPriority": "normal|high|urgent",
  "suggestedCategory": "symptoms|medication|appointment|test_results|billing|general|follow_up|emergency",
  "patientConcerns": ["Main concern 1", "Main concern 2"],
  "actionItems": ["Action item for provider 1", "Action item 2"],
  "requiresUrgentResponse": true/false,
  "sentimentScore": 0.0-1.0 (0=very negative/worried, 1=positive/satisfied),
  "confidence": 0.0-1.0
}

PRIORITY GUIDELINES:
- urgent: Emergency symptoms, severe pain, mental health crisis, medication errors
- high: New concerning symptoms, medication questions, time-sensitive requests
- normal: General questions, appointment requests, routine follow-ups`
        },
        {
          role: "user",
          content: `Analyze this patient message:\n\n${messageContent}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || "";
    let parsed: any;
    
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        summary: messageContent.substring(0, 100) + "...",
        keyPoints: [],
        detectedIntent: "question",
        suggestedPriority: "normal",
        suggestedCategory: "general",
        patientConcerns: [],
        actionItems: [],
        requiresUrgentResponse: false,
        sentimentScore: 0.5,
        confidence: 0.5,
      };
    }

    const summary: MessageSummary = {
      id: randomUUID(),
      messageId,
      threadId,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints || [],
      detectedIntent: parsed.detectedIntent || "question",
      suggestedPriority: parsed.suggestedPriority || "normal",
      suggestedCategory: parsed.suggestedCategory || "general",
      patientConcerns: parsed.patientConcerns || [],
      actionItems: parsed.actionItems || [],
      requiresUrgentResponse: parsed.requiresUrgentResponse || false,
      sentimentScore: parsed.sentimentScore || 0.5,
      confidence: parsed.confidence || 0.7,
      generatedAt: new Date().toISOString(),
    };

    messageSummaries.set(summary.id, summary);
    return summary;
  } catch (error) {
    console.error("Error summarizing message:", error);
    return {
      id: randomUUID(),
      messageId,
      threadId,
      summary: "Unable to generate summary",
      keyPoints: [],
      detectedIntent: "unknown",
      suggestedPriority: "normal",
      suggestedCategory: "general",
      patientConcerns: [],
      actionItems: [],
      requiresUrgentResponse: false,
      sentimentScore: 0.5,
      confidence: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function generateFollowUpDraft(
  patientId: string,
  triggerType: FollowUpDraft["triggerType"],
  triggerData: {
    carePlanId?: string;
    carePlanTitle?: string;
    goalProgress?: Array<{ description: string; currentValue: number; targetValue: number; status: string }>;
    healthData?: { type: string; value: number; trend: string; date: string };
    appointmentDetails?: { date: string; provider: string; type: string };
    medicationAdherence?: { medication: string; adherenceRate: number; missedDoses: number };
    labResults?: Array<{ test: string; value: string; status: string; date: string }>;
  }
): Promise<FollowUpDraft> {
  const context = await getPatientContext(patientId);
  
  let triggerDescription = "";
  let desiredTone: FollowUpDraft["tone"] = "informative";
  
  switch (triggerType) {
    case "care_plan_progress":
      const progress = triggerData.goalProgress || [];
      const completedGoals = progress.filter(g => g.status === "achieved").length;
      const totalGoals = progress.length;
      triggerDescription = `Care plan "${triggerData.carePlanTitle}" progress update: ${completedGoals}/${totalGoals} goals achieved.`;
      desiredTone = completedGoals > 0 ? "congratulatory" : "encouraging";
      break;
    case "health_data":
      triggerDescription = `Recent ${triggerData.healthData?.type} reading: ${triggerData.healthData?.value}. Trend: ${triggerData.healthData?.trend}`;
      desiredTone = triggerData.healthData?.trend === "improving" ? "congratulatory" : "encouraging";
      break;
    case "appointment":
      triggerDescription = `Upcoming ${triggerData.appointmentDetails?.type} appointment with ${triggerData.appointmentDetails?.provider} on ${triggerData.appointmentDetails?.date}`;
      desiredTone = "reminder";
      break;
    case "medication_adherence":
      triggerDescription = `Medication adherence for ${triggerData.medicationAdherence?.medication}: ${triggerData.medicationAdherence?.adherenceRate}% (${triggerData.medicationAdherence?.missedDoses} missed doses)`;
      desiredTone = (triggerData.medicationAdherence?.adherenceRate || 0) > 80 ? "congratulatory" : "encouraging";
      break;
    case "lab_results":
      const results = triggerData.labResults || [];
      triggerDescription = `New lab results: ${results.map(r => `${r.test}: ${r.value} (${r.status})`).join(", ")}`;
      desiredTone = "informative";
      break;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a healthcare communication assistant drafting personalized follow-up messages for patients.

Patient Context:
- Name: ${context.patientName}
- Known Conditions: ${context.conditions.join(", ") || "Not specified"}
- Active Medications: ${context.activeMedications.join(", ") || "None documented"}

Trigger Type: ${triggerType}
Trigger Details: ${triggerDescription}
Desired Tone: ${desiredTone}

Generate a personalized follow-up message that:
1. Is warm and supportive
2. Acknowledges the specific trigger (progress, data, appointment, etc.)
3. Provides encouragement or relevant information
4. Includes clear action items if applicable
5. Does NOT provide medical advice
6. Is around 100-150 words

Respond with JSON:
{
  "subject": "Email/message subject line",
  "content": "The full message content",
  "personalizedElements": ["Element 1 used for personalization", "Element 2"],
  "actionItems": ["Suggested action 1", "Action 2"],
  "tone": "encouraging|informative|reminder|congratulatory"
}`
        },
        {
          role: "user",
          content: `Generate a follow-up message for this situation: ${triggerDescription}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || "";
    let parsed: any;
    
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        subject: "Follow-up from your care team",
        content: "We wanted to check in with you regarding your recent health activities. Please don't hesitate to reach out if you have any questions.",
        personalizedElements: [],
        actionItems: [],
        tone: desiredTone,
      };
    }

    const draft: FollowUpDraft = {
      id: randomUUID(),
      patientId,
      carePlanId: triggerData.carePlanId,
      triggerType,
      subject: parsed.subject,
      content: parsed.content,
      personalizedElements: parsed.personalizedElements || [],
      actionItems: parsed.actionItems || [],
      tone: parsed.tone || desiredTone,
      generatedAt: new Date().toISOString(),
      status: "draft",
    };

    followUpDrafts.set(draft.id, draft);
    return draft;
  } catch (error) {
    console.error("Error generating follow-up draft:", error);
    return {
      id: randomUUID(),
      patientId,
      carePlanId: triggerData.carePlanId,
      triggerType,
      subject: "Follow-up from your care team",
      content: "We wanted to check in with you. Please reach out if you have any questions about your care.",
      personalizedElements: [],
      actionItems: [],
      tone: desiredTone,
      generatedAt: new Date().toISOString(),
      status: "draft",
    };
  }
}

export function getChatbotConversation(conversationId: string, patientId: string): ChatbotConversation | undefined {
  const conversation = chatbotConversations.get(conversationId);
  if (!conversation || conversation.patientId !== patientId) {
    return undefined;
  }
  return conversation;
}

export function getPatientConversations(patientId: string): ChatbotConversation[] {
  return Array.from(chatbotConversations.values())
    .filter(c => c.patientId === patientId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getMessageSummary(summaryId: string): MessageSummary | undefined {
  return messageSummaries.get(summaryId);
}

export function getThreadSummaries(threadId: string): MessageSummary[] {
  return Array.from(messageSummaries.values())
    .filter(s => s.threadId === threadId)
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export function getFollowUpDraft(draftId: string): FollowUpDraft | undefined {
  return followUpDrafts.get(draftId);
}

export function getPatientFollowUpDrafts(patientId: string): FollowUpDraft[] {
  return Array.from(followUpDrafts.values())
    .filter(d => d.patientId === patientId)
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export function updateFollowUpDraftStatus(draftId: string, status: FollowUpDraft["status"]): FollowUpDraft | undefined {
  const draft = followUpDrafts.get(draftId);
  if (draft) {
    draft.status = status;
    followUpDrafts.set(draftId, draft);
    return draft;
  }
  return undefined;
}

export async function prioritizeProviderInbox(
  providerId: string,
  messages: Array<{ id: string; threadId: string; patientId: string; content: string; subject: string; timestamp: string }>
): Promise<Array<{ messageId: string; priority: "normal" | "high" | "urgent"; summary: string; estimatedResponseTime: string }>> {
  if (messages.length === 0) return [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a healthcare message triage assistant. Analyze and prioritize patient messages for a provider.

For each message, determine:
1. Priority level (urgent/high/normal)
2. Brief summary (under 50 words)
3. Estimated response time needed

PRIORITY CRITERIA:
- urgent: Emergency symptoms, severe pain, mental health crisis, medication emergencies (respond within 1 hour)
- high: New concerning symptoms, medication questions, time-sensitive requests (respond within 4 hours)
- normal: General questions, routine follow-ups, non-urgent requests (respond within 24 hours)

Respond with JSON array:
[
  {
    "messageId": "id",
    "priority": "urgent|high|normal",
    "summary": "Brief summary",
    "estimatedResponseTime": "Within X hours"
  }
]`
        },
        {
          role: "user",
          content: `Analyze and prioritize these messages:\n\n${JSON.stringify(messages.map(m => ({
            id: m.id,
            subject: m.subject,
            content: m.content.substring(0, 500),
            timestamp: m.timestamp,
          })))}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || "";
    try {
      return JSON.parse(content);
    } catch {
      return messages.map(m => ({
        messageId: m.id,
        priority: "normal" as const,
        summary: m.content.substring(0, 100),
        estimatedResponseTime: "Within 24 hours",
      }));
    }
  } catch (error) {
    console.error("Error prioritizing inbox:", error);
    return messages.map(m => ({
      messageId: m.id,
      priority: "normal" as const,
      summary: m.content.substring(0, 100),
      estimatedResponseTime: "Within 24 hours",
    }));
  }
}
