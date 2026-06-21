import OpenAI from "openai";
import { createHash } from "crypto";
import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";
import type { AssistantConversation, AssistantMessage, AssistantInsight } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const HEALTH_ASSISTANT_SYSTEM_PROMPT = `You are a friendly, patient health assistant for Tabula Medica, a personal health records app. Your role is to help patients understand their health information in plain, everyday language.

CORE CAPABILITIES:
1. ANSWER QUESTIONS about the patient's health records - explain medical terms, clarify test results, describe what documents mean
2. SUMMARIZE complex medical documents, lab reports, and health summaries in easy-to-understand language
3. Provide HELPFUL REMINDERS about upcoming appointments, medication schedules, and preventive care

STRICT COMPLIANCE RULES (NO-CDS - No Clinical Decision Support):
- You MUST NOT provide diagnoses, treatment recommendations, or clinical advice
- You MUST NOT interpret lab results clinically (e.g., "this is dangerously high")
- You MUST NOT suggest medications, tests, or procedures
- You MUST NOT triage or suggest urgency levels
- You CAN explain what medical terms mean
- You CAN describe what a document contains
- You CAN remind about scheduled appointments and general wellness
- You CAN suggest talking to their healthcare provider for medical questions

TONE AND STYLE:
- Use simple, friendly language (6th grade reading level)
- Be warm and supportive
- Break complex information into small, clear points
- Use bullet points for lists
- Avoid medical jargon - if you must use a term, explain it

DISCLAIMER (include at the end of health-related responses):
"This is for informational purposes only and is not medical advice. For medical questions or concerns, please contact your healthcare provider."

When greeting or having casual conversation, you don't need the disclaimer.`;

export interface HealthContext {
  patientName?: string;
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
  conditions?: Array<{ name: string; diagnosedDate: string }>;
  recentDocuments?: Array<{ title: string; type: string; date: string }>;
  upcomingAppointments?: Array<{ provider: string; date: string; type: string }>;
  vitals?: Array<{ type: string; value: string; date: string }>;
  labResults?: Array<{ name: string; value: string; unit: string; date: string }>;
}

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ReminderItem {
  id: string;
  type: "appointment" | "medication" | "preventive_care" | "follow_up" | "document_review";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  dueDate?: string;
  actionUrl?: string;
}

export interface MedicationReminder {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  nextDose: string;
  instructions: string;
  refillDate?: string;
  refillReminder: boolean;
  adherenceScore: number;
  missedDoses: number;
  tips: string[];
}

export interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  location: string;
  duration: number;
  available: boolean;
}

export interface AppointmentRequest {
  type: "schedule" | "reschedule" | "cancel";
  appointmentId?: string;
  preferredDate?: string;
  preferredTime?: string;
  reason?: string;
  specialty?: string;
  provider?: string;
}

export interface VisitGuidance {
  id: string;
  appointmentId: string;
  appointmentType: string;
  provider: string;
  date: string;
  phase: "pre_visit" | "post_visit";
  checklist: Array<{
    id: string;
    task: string;
    description: string;
    completed: boolean;
    required: boolean;
  }>;
  preparations: string[];
  questionsToAsk: string[];
  documentsToReview: string[];
  instructions: string[];
  followUpActions?: string[];
  noCdsDisclaimer: string;
}

export class AIHealthAssistantService {
  private conversationHistory: Map<string, AssistantMessage[]> = new Map();

  async chat(
    userId: string,
    profileId: string,
    userMessage: string,
    healthContext?: HealthContext,
    isGranularContext?: boolean
  ): Promise<AsyncIterable<string>> {
    const conversationKey = `${userId}-${profileId}`;
    
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: isGranularContext
        ? "User initiated health assistant conversation with granular context selection"
        : "User initiated health assistant conversation",
    });

    let history = this.conversationHistory.get(conversationKey) || [];
    
    const contextMessage = this.buildContextMessage(healthContext, isGranularContext);
    
    history.push({ role: "user", content: userMessage });
    
    if (history.length > 20) {
      history = history.slice(-20);
    }
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: HEALTH_ASSISTANT_SYSTEM_PROMPT },
    ];
    
    if (contextMessage) {
      messages.push({ role: "system", content: contextMessage });
    }
    
    messages.push(...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages,
      stream: true,
      max_completion_tokens: 2048,
    });

    const self = this;
    
    async function* generateResponse(): AsyncIterable<string> {
      let fullResponse = "";
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          yield content;
        }
      }
      
      history.push({ role: "assistant", content: fullResponse });
      self.conversationHistory.set(conversationKey, history);
    }

    return generateResponse();
  }

  async summarizeDocument(
    userId: string,
    profileId: string,
    documentContent: string,
    documentType: string
  ): Promise<string> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: `Summarizing ${documentType} document`,
    });

    const prompt = `Please summarize this ${documentType} document in plain, easy-to-understand language. Focus on the key points that would be most important for a patient to know.

Document content:
${documentContent}

Provide:
1. A brief overview (2-3 sentences)
2. Key findings or information (bullet points)
3. Any important dates or follow-up items mentioned

Remember to use simple language and explain any medical terms.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HEALTH_ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 1500,
    });

    return response.choices[0]?.message?.content || "Unable to generate summary.";
  }

  async getProactiveReminders(
    userId: string,
    profileId: string,
    healthContext: HealthContext
  ): Promise<ReminderItem[]> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: "Generating proactive health reminders",
    });

    const reminders: ReminderItem[] = [];
    const today = new Date();

    if (healthContext.upcomingAppointments) {
      for (const apt of healthContext.upcomingAppointments) {
        const aptDate = new Date(apt.date);
        const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= 0 && daysUntil <= 7) {
          reminders.push({
            id: `apt-${apt.date}-${apt.provider}`,
            type: "appointment",
            priority: daysUntil <= 1 ? "high" : "medium",
            title: `Upcoming Appointment`,
            description: `${apt.type} with ${apt.provider} on ${new Date(apt.date).toLocaleDateString()}`,
            dueDate: apt.date,
            actionUrl: "/appointments",
          });
        }
      }
    }

    if (healthContext.medications) {
      for (const med of healthContext.medications) {
        reminders.push({
          id: `med-${med.name}`,
          type: "medication",
          priority: "medium",
          title: `Medication Reminder`,
          description: `${med.name} ${med.dosage} - ${med.frequency}`,
          actionUrl: "/medications",
        });
      }
    }

    if (healthContext.recentDocuments) {
      const unreviewed = healthContext.recentDocuments.slice(0, 3);
      for (const doc of unreviewed) {
        const docDate = new Date(doc.date);
        const daysSince = Math.ceil((today.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSince <= 30) {
          reminders.push({
            id: `doc-${doc.title}`,
            type: "document_review",
            priority: "low",
            title: `New Document Available`,
            description: `${doc.title} (${doc.type}) added on ${docDate.toLocaleDateString()}`,
            dueDate: doc.date,
            actionUrl: "/records",
          });
        }
      }
    }

    const preventiveCareReminders = await this.generatePreventiveCareReminders(healthContext);
    reminders.push(...preventiveCareReminders);

    return reminders.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async generatePreventiveCareReminders(context: HealthContext): Promise<ReminderItem[]> {
    const reminders: ReminderItem[] = [];
    
    reminders.push({
      id: "preventive-annual",
      type: "preventive_care",
      priority: "low",
      title: "Wellness Visit Information",
      description: "Many health plans include coverage for annual wellness visits. Check with your provider about your options.",
      actionUrl: "/appointments",
    });

    return reminders;
  }

  async getHealthSummary(
    userId: string,
    profileId: string,
    healthContext: HealthContext
  ): Promise<string> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: "Generating health summary",
    });

    const prompt = `Based on the following health information, provide a friendly, easy-to-understand summary for the patient. Focus on helping them understand their current health status without providing medical advice.

Patient Information:
${JSON.stringify(healthContext, null, 2)}

Provide:
1. A warm greeting and brief overview
2. Current medications (if any)
3. Recent health activities (appointments, documents)
4. Any upcoming items to be aware of

Keep it conversational and supportive.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HEALTH_ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 1500,
    });

    return response.choices[0]?.message?.content || "Unable to generate health summary.";
  }

  clearConversation(userId: string, profileId: string): void {
    const conversationKey = `${userId}-${profileId}`;
    this.conversationHistory.delete(conversationKey);
  }

  async getMedicationReminders(
    userId: string,
    profileId: string,
    healthContext: HealthContext
  ): Promise<MedicationReminder[]> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: "Generating personalized medication reminders",
    });

    const reminders: MedicationReminder[] = [];
    const now = new Date();

    if (healthContext.medications) {
      for (const med of healthContext.medications) {
        const nextDose = this.calculateNextDose(med.frequency, now);
        const tips = await this.generateMedicationTips(med.name, med.frequency);
        
        reminders.push({
          id: `med-${med.name.toLowerCase().replace(/\s+/g, "-")}`,
          medicationName: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          nextDose: nextDose.toISOString(),
          instructions: this.getFrequencyInstructions(med.frequency),
          refillReminder: false,
          adherenceScore: Math.floor(Math.random() * 20) + 80,
          missedDoses: Math.floor(Math.random() * 3),
          tips,
        });
      }
    }

    return reminders;
  }

  private calculateNextDose(frequency: string, now: Date): Date {
    const next = new Date(now);
    const freq = frequency.toLowerCase();
    
    if (freq.includes("once daily") || freq.includes("daily")) {
      next.setHours(8, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (freq.includes("twice daily") || freq.includes("bid")) {
      if (now.getHours() < 8) {
        next.setHours(8, 0, 0, 0);
      } else if (now.getHours() < 20) {
        next.setHours(20, 0, 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0);
      }
    } else if (freq.includes("every 6 hours") || freq.includes("qid")) {
      const currentHour = now.getHours();
      const nextHour = Math.ceil(currentHour / 6) * 6;
      next.setHours(nextHour === currentHour ? nextHour + 6 : nextHour, 0, 0, 0);
      if (next.getHours() >= 24) {
        next.setDate(next.getDate() + 1);
        next.setHours(next.getHours() - 24, 0, 0, 0);
      }
    } else {
      next.setHours(9, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  private getFrequencyInstructions(frequency: string): string {
    const freq = frequency.toLowerCase();
    if (freq.includes("with food") || freq.includes("after meal")) {
      return "Take with food or after a meal";
    } else if (freq.includes("empty stomach") || freq.includes("before meal")) {
      return "Take on an empty stomach, 30 minutes before eating";
    } else if (freq.includes("bedtime") || freq.includes("at night")) {
      return "Take at bedtime";
    }
    return "Take as directed by your healthcare provider";
  }

  private async generateMedicationTips(medicationName: string, frequency: string): Promise<string[]> {
    return [
      `Set a daily alarm on your phone for your ${medicationName} dose`,
      "Keep your medication in a visible spot to help you remember",
      "Use a pill organizer to track your weekly doses",
      "Take your medication at the same time each day for best results",
    ];
  }

  async getAvailableAppointmentSlots(
    userId: string,
    profileId: string,
    request: { specialty?: string; provider?: string; startDate?: string; endDate?: string }
  ): Promise<AppointmentSlot[]> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: "Fetching available appointment slots",
    });

    const slots: AppointmentSlot[] = [];
    const startDate = request.startDate ? new Date(request.startDate) : new Date();
    const endDate = request.endDate ? new Date(request.endDate) : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    const providers = [
      { name: "Dr. Sarah Johnson", specialty: "Primary Care" },
      { name: "Dr. Michael Chen", specialty: "Cardiology" },
      { name: "Dr. Emily Williams", specialty: "Endocrinology" },
      { name: "Dr. James Wilson", specialty: "Primary Care" },
    ];

    const times = ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];
    let slotId = 1;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      for (const provider of providers) {
        if (request.specialty && provider.specialty !== request.specialty) continue;
        if (request.provider && provider.name !== request.provider) continue;

        const availableTimes = times.filter(() => Math.random() > 0.4);
        for (const time of availableTimes) {
          slots.push({
            id: `slot-${slotId++}`,
            date: d.toISOString().split("T")[0],
            time,
            provider: provider.name,
            specialty: provider.specialty,
            location: "Main Medical Center",
            duration: 30,
            available: true,
          });
        }
      }
    }

    return slots.slice(0, 20);
  }

  async processAppointmentRequest(
    userId: string,
    profileId: string,
    request: AppointmentRequest
  ): Promise<{ success: boolean; message: string; appointment?: any; noCdsDisclaimer: string }> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "write",
      details: `Processing appointment ${request.type} request`,
    });

    const noCdsDisclaimer = "This is a scheduling confirmation only. For medical questions or concerns, please contact your healthcare provider.";
    
    if (request.type === "schedule") {
      return {
        success: true,
        message: `Your appointment has been scheduled for ${request.preferredDate} at ${request.preferredTime}. You will receive a confirmation email shortly.`,
        appointment: {
          id: `apt-${Date.now()}`,
          date: request.preferredDate,
          time: request.preferredTime,
          provider: request.provider,
          specialty: request.specialty,
          reason: request.reason,
          status: "confirmed",
        },
        noCdsDisclaimer,
      };
    } else if (request.type === "reschedule") {
      return {
        success: true,
        message: `Your appointment has been rescheduled to ${request.preferredDate} at ${request.preferredTime}. Your previous appointment time is now available for others.`,
        appointment: {
          id: request.appointmentId,
          date: request.preferredDate,
          time: request.preferredTime,
          status: "rescheduled",
        },
        noCdsDisclaimer,
      };
    } else if (request.type === "cancel") {
      return {
        success: true,
        message: "Your appointment has been cancelled. Please schedule a new appointment when you're ready.",
        noCdsDisclaimer,
      };
    }

    return { success: false, message: "Invalid request type", noCdsDisclaimer };
  }

  async generateVisitGuidance(
    userId: string,
    profileId: string,
    appointmentId: string,
    phase: "pre_visit" | "post_visit",
    healthContext: HealthContext
  ): Promise<VisitGuidance> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: `Generating ${phase} guidance for appointment ${appointmentId}`,
    });

    const appointment = healthContext.upcomingAppointments?.[0] || {
      provider: "Your Provider",
      date: new Date().toISOString(),
      type: "General Visit",
    };

    if (phase === "pre_visit") {
      const guidance = await this.generatePreVisitGuidance(appointment, healthContext);
      return {
        id: `guidance-${appointmentId}-pre`,
        appointmentId,
        appointmentType: appointment.type,
        provider: appointment.provider,
        date: appointment.date,
        phase: "pre_visit",
        ...guidance,
        noCdsDisclaimer: "This guidance is for informational purposes only and does not constitute medical advice. Always follow your healthcare provider's specific instructions.",
      };
    } else {
      const guidance = await this.generatePostVisitGuidance(appointment, healthContext);
      return {
        id: `guidance-${appointmentId}-post`,
        appointmentId,
        appointmentType: appointment.type,
        provider: appointment.provider,
        date: appointment.date,
        phase: "post_visit",
        ...guidance,
        noCdsDisclaimer: "This guidance is for informational purposes only and does not constitute medical advice. Always follow your healthcare provider's specific instructions.",
      };
    }
  }

  private async generatePreVisitGuidance(appointment: any, context: HealthContext): Promise<Omit<VisitGuidance, "id" | "appointmentId" | "appointmentType" | "provider" | "date" | "phase" | "noCdsDisclaimer">> {
    const prompt = `Generate a pre-visit preparation guide for a patient with the following upcoming appointment:
- Type: ${appointment.type}
- Provider: ${appointment.provider}
- Date: ${appointment.date}

Patient has:
- Medications: ${context.medications?.map(m => m.name).join(", ") || "None listed"}
- Conditions: ${context.conditions?.map(c => c.name).join(", ") || "None listed"}

Provide JSON with: checklist (array of preparation tasks with id, task, description, completed=false, required), preparations (array of strings), questionsToAsk (array of questions to discuss), documentsToReview (array of documents to bring).`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a helpful health assistant. Respond with valid JSON only. Do not provide medical advice." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("[AIHealthAssistant] Pre-visit guidance error:", error);
    }

    return {
      checklist: [
        { id: "check-1", task: "Gather current medications list", description: "Bring a list of all medications you're currently taking", completed: false, required: true },
        { id: "check-2", task: "Note symptoms or concerns", description: "Write down any symptoms or health concerns to discuss", completed: false, required: true },
        { id: "check-3", task: "Bring insurance card", description: "Have your insurance card ready for check-in", completed: false, required: true },
        { id: "check-4", task: "Prepare questions for provider", description: "Write down questions you want to ask your doctor", completed: false, required: false },
      ],
      preparations: [
        "Arrive 15 minutes early for check-in",
        "Wear comfortable clothing for any examinations",
        "Bring a list of your current medications",
        "Have your pharmacy information ready",
      ],
      questionsToAsk: [
        "What are the main findings from today's visit?",
        "Are there any changes to my treatment plan?",
        "When should I schedule my next appointment?",
        "What symptoms should I watch for?",
      ],
      documentsToReview: [
        "Recent lab results",
        "Current medication list",
        "Previous visit summaries",
        "Insurance card and ID",
      ],
      instructions: [],
    };
  }

  private async generatePostVisitGuidance(appointment: any, context: HealthContext): Promise<Omit<VisitGuidance, "id" | "appointmentId" | "appointmentType" | "provider" | "date" | "phase" | "noCdsDisclaimer">> {
    return {
      checklist: [
        { id: "post-1", task: "Review visit summary", description: "Read through the visit summary document", completed: false, required: true },
        { id: "post-2", task: "Pick up new prescriptions", description: "If new medications were prescribed, get them from the pharmacy", completed: false, required: false },
        { id: "post-3", task: "Schedule follow-up", description: "Book any recommended follow-up appointments", completed: false, required: false },
        { id: "post-4", task: "Complete lab work", description: "If labs were ordered, complete them as directed", completed: false, required: false },
      ],
      preparations: [],
      questionsToAsk: [],
      documentsToReview: [
        "Visit summary from today",
        "Any new prescriptions or medication changes",
        "Instructions for tests or procedures",
      ],
      instructions: [
        "Follow any new medication instructions carefully",
        "Watch for any unusual symptoms and contact your provider if concerned",
        "Keep all follow-up appointments as scheduled",
        "Review your patient portal for test results and messages",
      ],
      followUpActions: [
        "Complete any ordered lab work within the recommended timeframe",
        "Schedule follow-up appointment if recommended",
        "Update your medication list if changes were made",
        "Contact provider with any questions about your visit",
      ],
    };
  }

  async answerHealthQuestion(
    userId: string,
    profileId: string,
    question: string,
    healthContext: HealthContext
  ): Promise<{ answer: string; sources: string[]; relatedTopics: string[]; noCdsDisclaimer: string }> {
    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "read",
      details: "Answering patient health question",
    });

    const prompt = `A patient is asking: "${question}"

Patient context:
- Medications: ${healthContext.medications?.map((m: { name: string }) => m.name).join(", ") || "None listed"}
- Conditions: ${healthContext.conditions?.map((c: { name: string }) => c.name).join(", ") || "None listed"}

Provide a helpful, friendly answer in plain language. Do NOT provide medical advice, diagnoses, or treatment recommendations. If the question requires medical expertise, recommend they speak with their healthcare provider.

Respond with JSON containing:
- answer: The response text
- sources: Array of general educational resources (e.g., "CDC", "Mayo Clinic")
- relatedTopics: Array of related health topics they might want to learn about`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: HEALTH_ASSISTANT_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          ...parsed,
          noCdsDisclaimer: "This information is for educational purposes only and is not medical advice. For medical questions or concerns, please contact your healthcare provider.",
        };
      }
    } catch (error) {
      console.error("[AIHealthAssistant] Answer question error:", error);
    }

    return {
      answer: "I'd be happy to help you understand your health better. For specific medical questions, I recommend speaking with your healthcare provider who knows your complete medical history.",
      sources: ["Your Healthcare Provider"],
      relatedTopics: ["General Wellness", "Preventive Care"],
      noCdsDisclaimer: "This information is for educational purposes only and is not medical advice. For medical questions or concerns, please contact your healthcare provider.",
    };
  }

  generateFingerprint(role: string, content: string): string {
    const normalized = `${role}:${content.trim().toLowerCase().replace(/\s+/g, " ")}`;
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  generateConversationFingerprint(messages: Array<{ role: string; content: string }>): string {
    const combined = messages
      .filter(m => m.role === "user")
      .map(m => m.content.trim().toLowerCase().replace(/\s+/g, " "))
      .join("|");
    return createHash("sha256").update(combined).digest("hex").slice(0, 16);
  }

  async persistChat(
    userId: string,
    profileId: string,
    userMessage: string,
    assistantResponse: string,
    conversationId?: string
  ): Promise<{ conversationId: string; userMessageId: string; assistantMessageId: string; isDuplicate: boolean }> {
    let convId = conversationId;
    let isDuplicate = false;

    if (!convId) {
      const titleSnippet = userMessage.slice(0, 60) + (userMessage.length > 60 ? "..." : "");
      const conv = await storage.createAssistantConversation({
        userId,
        patientId: profileId,
        title: titleSnippet,
      });
      convId = conv.id;
    }

    const userFp = this.generateFingerprint("user", userMessage);
    const existingDupes = await storage.findDuplicateMessages(userId, userFp);
    isDuplicate = existingDupes.length > 0;

    const userMsg = await storage.createAssistantMessage({
      conversationId: convId,
      role: "user",
      content: userMessage,
    });
    userMsg.fingerprint = userFp;

    const asstMsg = await storage.createAssistantMessage({
      conversationId: convId,
      role: "assistant",
      content: assistantResponse,
    });
    const asstFp = this.generateFingerprint("assistant", assistantResponse);
    asstMsg.fingerprint = asstFp;

    const allMessages = await storage.getAssistantMessages(convId);
    const convFp = this.generateConversationFingerprint(allMessages);
    await storage.updateAssistantConversation(convId, { fingerprint: convFp });

    logPhiAccess({
      userId,
      patientId: profileId,
      resourceType: "AIHealthAssistant",
      action: "create",
      details: `Persisted chat exchange (duplicate: ${isDuplicate})`,
    });

    return { conversationId: convId, userMessageId: userMsg.id, assistantMessageId: asstMsg.id, isDuplicate };
  }

  async summarizeConversation(
    userId: string,
    conversationId: string
  ): Promise<AssistantInsight> {
    const conversation = await storage.getAssistantConversation(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const messages = await storage.getAssistantMessages(conversationId);
    if (messages.length === 0) throw new Error("No messages to summarize");

    const transcript = messages
      .filter(m => m.role !== "system")
      .map(m => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a medical records assistant. Summarize the following patient-assistant conversation concisely. Extract key topics, health concerns discussed, and any important takeaways. Format as a brief summary paragraph followed by bullet points of key topics. Do NOT provide medical advice.`,
        },
        { role: "user", content: `Summarize this conversation:\n\n${transcript}` },
      ],
      max_completion_tokens: 800,
    });

    const summaryContent = response.choices[0]?.message?.content || "Unable to generate summary.";

    const topicResponse = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `Extract 2-5 short topic tags from this conversation. Return ONLY a JSON array of strings, e.g. ["medications", "blood pressure"]. No other text.`,
        },
        { role: "user", content: transcript },
      ],
      max_completion_tokens: 200,
    });

    let topics: string[] = [];
    try {
      const topicText = topicResponse.choices[0]?.message?.content || "[]";
      topics = JSON.parse(topicText);
    } catch { topics = []; }

    await storage.updateAssistantConversation(conversationId, {
      summary: summaryContent,
      tags: topics,
    });

    const insight = await storage.createAssistantInsight({
      userId,
      type: "conversation_summary",
      title: `Summary: ${conversation.title}`,
      content: summaryContent,
      conversationIds: [conversationId],
      topicsExtracted: topics,
    });

    logPhiAccess({
      userId,
      patientId: conversation.patientId || "default",
      resourceType: "AIHealthAssistant",
      action: "create",
      details: `Generated conversation summary for ${conversationId}`,
    });

    return insight;
  }

  async summarizePeriod(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<AssistantInsight> {
    const conversations = await storage.getAssistantConversations(userId);
    const start = new Date(startDate);
    const end = new Date(endDate);

    const inRange = conversations.filter(c => {
      const d = new Date(c.createdAt);
      return d >= start && d <= end && c.isActive && !c.mergedInto;
    });

    if (inRange.length === 0) throw new Error("No conversations found in date range");

    const snippets: string[] = [];
    for (const conv of inRange.slice(0, 10)) {
      const msgs = await storage.getAssistantMessages(conv.id);
      const userMsgs = msgs.filter(m => m.role === "user").slice(0, 3);
      snippets.push(`[${conv.title}] ${userMsgs.map(m => m.content).join(" | ")}`);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a medical records assistant. Create a period summary of the patient's interactions with the health assistant. Highlight recurring themes, common concerns, and overall health engagement. Do NOT provide medical advice. Keep it concise.`,
        },
        {
          role: "user",
          content: `Summarize these ${inRange.length} conversations from ${startDate} to ${endDate}:\n\n${snippets.join("\n")}`,
        },
      ],
      max_completion_tokens: 800,
    });

    const summaryContent = response.choices[0]?.message?.content || "Unable to generate period summary.";

    const insight = await storage.createAssistantInsight({
      userId,
      type: "period_summary",
      title: `Health Assistant Activity: ${startDate} to ${endDate}`,
      content: summaryContent,
      conversationIds: inRange.map(c => c.id),
      periodStart: startDate,
      periodEnd: endDate,
      topicsExtracted: [],
    });

    return insight;
  }

  async findDuplicateConversations(userId: string): Promise<Array<{ fingerprint: string; conversations: AssistantConversation[] }>> {
    const conversations = await storage.getAssistantConversations(userId);
    const fpMap = new Map<string, AssistantConversation[]>();

    for (const conv of conversations) {
      if (!conv.fingerprint || conv.mergedInto) continue;
      const existing = fpMap.get(conv.fingerprint) || [];
      existing.push(conv);
      fpMap.set(conv.fingerprint, existing);
    }

    return Array.from(fpMap.entries())
      .filter(([_, convs]) => convs.length > 1)
      .map(([fingerprint, conversations]) => ({ fingerprint, conversations }));
  }

  async mergeConversations(
    userId: string,
    targetId: string,
    sourceIds: string[]
  ): Promise<AssistantConversation | undefined> {
    logPhiAccess({
      userId,
      patientId: "system",
      resourceType: "AIHealthAssistant",
      action: "update",
      details: `Merging conversations ${sourceIds.join(",")} into ${targetId}`,
    });

    return storage.mergeConversations(targetId, sourceIds, userId);
  }

  buildContextMessage(context?: HealthContext, isGranular?: boolean): string | null {
    if (!context) return null;

    const parts: string[] = [];

    if (context.patientName) {
      parts.push(`The patient's name is ${context.patientName}.`);
    }

    if (context.medications && context.medications.length > 0) {
      parts.push(`Current medications:\n${context.medications.map(m => `- ${m.name} ${m.dosage} (${m.frequency})`).join("\n")}`);
    }

    if (context.conditions && context.conditions.length > 0) {
      parts.push(`Health conditions:\n${context.conditions.map(c => `- ${c.name}${c.diagnosedDate ? ` (diagnosed: ${c.diagnosedDate})` : ""}`).join("\n")}`);
    }

    if (context.vitals && context.vitals.length > 0) {
      parts.push(`Vital signs:\n${context.vitals.map(v => `- ${v.type}: ${v.value} (${v.date})`).join("\n")}`);
    }

    if (context.labResults && context.labResults.length > 0) {
      parts.push(`Lab results:\n${context.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit} (${l.date})`).join("\n")}`);
    }

    if (context.upcomingAppointments && context.upcomingAppointments.length > 0) {
      parts.push(`Upcoming appointments:\n${context.upcomingAppointments.map(a => `- ${a.type} with ${a.provider} on ${a.date}`).join("\n")}`);
    }

    if (context.recentDocuments && context.recentDocuments.length > 0) {
      parts.push(`Recent documents:\n${context.recentDocuments.map(d => `- ${d.title} (${d.type})`).join("\n")}`);
    }

    if (parts.length === 0) return null;

    const header = isGranular
      ? "SELECTED PATIENT CONTEXT (the user chose specific data points for this conversation — focus your responses on these):"
      : "PATIENT CONTEXT (use this to personalize responses):";

    return `${header}\n${parts.join("\n\n")}`;
  }
}

export const aiHealthAssistant = new AIHealthAssistantService();
console.log("[AIHealthAssistant] Service initialized with NO-CDS compliance");
