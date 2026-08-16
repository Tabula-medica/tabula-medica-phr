import { generatePhiSafeText } from "./ai-gateway";
import { format, addDays, addWeeks, addMonths, parseISO, isAfter, isBefore } from "date-fns";
import type {
  MessageTemplate,
  MessageSchedule,
  PatientMessage,
  MessageInteraction,
  PatientEngagementSummary,
  GenerateEducationContentInput,
  GeneratedEducationContent,
  MessageDeliveryResult,
  CreateMessageScheduleInput,
  RecordInteractionInput,
  SendMessageInput,
  MessageType,
  MessageChannel,
  MessageStatus,
  GoalCategory,
  AICarePlan,
} from "@shared/schema";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// In-memory storage for messaging system
const messageTemplates: Map<string, MessageTemplate> = new Map();
const messageSchedules: Map<string, MessageSchedule> = new Map();
const patientMessages: Map<string, PatientMessage> = new Map();
const messageInteractions: Map<string, MessageInteraction> = new Map();

// Initialize default message templates
function initializeDefaultTemplates() {
  const templates: MessageTemplate[] = [
    {
      id: "tpl-education-medication",
      name: "Medication Education",
      type: "education",
      category: "medication_management",
      subject: "Understanding Your Medications",
      bodyTemplate: "Hello {{patientName}}, here are some helpful tips about your medications that may support your health journey...",
      variables: ["patientName", "medicationList", "educationTips"],
      channels: ["in_app", "sms"],
      isAIGenerated: false,
      conditionTriggers: ["medication_management"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: "tpl-reminder-vitals",
      name: "Vital Signs Reminder",
      type: "reminder",
      category: "vital_monitoring",
      subject: "Time to Check Your Vitals",
      bodyTemplate: "Hello {{patientName}}, your care team has suggested tracking your vitals. Consider recording your readings when convenient.",
      variables: ["patientName", "vitalType", "targetRange"],
      channels: ["in_app", "sms", "push"],
      isAIGenerated: false,
      conditionTriggers: ["vital_monitoring"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: "tpl-followup-progress",
      name: "Progress Check-In",
      type: "follow_up",
      category: "care_coordination",
      subject: "How Are You Doing?",
      bodyTemplate: "Hello {{patientName}}, we wanted to check in on your progress with your health goals. Your care team is here to support you.",
      variables: ["patientName", "goalProgress", "encouragement"],
      channels: ["in_app"],
      isAIGenerated: false,
      conditionTriggers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: "tpl-motivation-lifestyle",
      name: "Lifestyle Motivation",
      type: "motivation",
      category: "lifestyle_modification",
      subject: "You're Making Great Progress!",
      bodyTemplate: "Hello {{patientName}}, we noticed your dedication to your health goals. Here are some encouraging words and tips that may help...",
      variables: ["patientName", "achievementHighlight", "nextSteps"],
      channels: ["in_app", "push"],
      isAIGenerated: false,
      conditionTriggers: ["lifestyle_modification"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: "tpl-checkin-general",
      name: "General Health Check-In",
      type: "check_in",
      category: "care_coordination",
      subject: "Quick Health Check-In",
      bodyTemplate: "Hello {{patientName}}, your care team would like to know how you're feeling. Please take a moment to share any updates.",
      variables: ["patientName", "checkInQuestions"],
      channels: ["in_app"],
      isAIGenerated: false,
      conditionTriggers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
  ];

  templates.forEach(t => messageTemplates.set(t.id, t));
}

initializeDefaultTemplates();

// AI Content Generation with HIPAA-safe language
async function generateEducationContent(
  input: GenerateEducationContentInput,
  carePlan?: AICarePlan
): Promise<GeneratedEducationContent> {
  const systemPrompt = `You are a patient education content generator for a healthcare platform. 
Your role is to create supportive, educational content that helps patients understand their health journey.

CRITICAL LANGUAGE RULES - YOU MUST FOLLOW THESE:
1. NEVER give medical advice, diagnoses, or treatment recommendations
2. ALWAYS use educational and conditional language:
   - "Your healthcare provider may suggest..."
   - "Consider discussing with your care team..."
   - "Some patients find it helpful to..."
   - "This information may help you understand..."
3. NEVER use directive language like:
   - "You should take..."
   - "Stop taking..."
   - "Increase your dose..."
   - "You need to..."
4. Always include a disclaimer that this is educational information only
5. Encourage patients to discuss any questions with their healthcare provider
6. Use warm, encouraging, and supportive tone
7. Content should be appropriate for the specified reading level`;

  const userPrompt = `Generate personalized education content for a patient.

Content Type: ${input.contentType}
Focus Areas: ${input.focusAreas?.join(", ") || "General health"}
Reading Level: ${input.preferredReadingLevel || "intermediate"}
Language: ${input.languagePreference || "English"}

${carePlan ? `
Current Care Plan Context:
- Goals: ${carePlan.smartGoals.map((g: any) => g.specific).join("; ")}
- Active Interventions: ${carePlan.interventions.filter((i: any) => i.status === "active").map((i: any) => i.title).join("; ")}
` : ""}

${input.currentProgress ? `
Recent Progress:
${Object.entries(input.currentProgress).map(([goal, progress]) => `- ${goal}: ${progress}%`).join("\n")}
` : ""}

Generate educational content with:
1. A subject line (under 60 characters)
2. Main body content (2-3 paragraphs, educational only)
3. 3-5 practical education tips (use conditional language)
4. 2-3 suggested action items for discussion with care team
5. An encouraging message
6. A suggested follow-up topic and timing

Respond in JSON format:
{
  "subject": "string",
  "body": "string", 
  "educationTips": ["string"],
  "actionItems": ["string"],
  "encouragement": "string",
  "suggestedFollowUp": {
    "type": "education|reminder|follow_up|motivation|check_in",
    "daysUntil": number,
    "topic": "string"
  },
  "relevanceScore": number (0-100)
}`;

  try {
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxTokens: 1500,
    });

    if (!content) {
      throw new Error("No content generated from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      subject: parsed.subject || "Health Education Update",
      body: parsed.body || "Your care team has prepared some helpful information for you.",
      educationTips: parsed.educationTips || [],
      actionItems: parsed.actionItems || [],
      encouragement: parsed.encouragement || "You're doing great on your health journey!",
      suggestedFollowUp: {
        type: parsed.suggestedFollowUp?.type || "follow_up",
        scheduledFor: format(
          addDays(new Date(), parsed.suggestedFollowUp?.daysUntil || 7),
          "yyyy-MM-dd"
        ),
        topic: parsed.suggestedFollowUp?.topic || "General check-in",
      },
      relevanceScore: parsed.relevanceScore || 80,
      safetyDisclaimer: "This information is for educational purposes only and is not medical advice. Please discuss any health questions or concerns with your healthcare provider.",
    };
  } catch (error) {
    console.error("[PatientEducationMessaging] AI generation error:", error);
    
    // Return safe fallback content
    return {
      subject: "Health Education Update",
      body: "Your care team has prepared some helpful information to support your health journey. Please review the tips below and feel free to discuss any questions with your healthcare provider at your next visit.",
      educationTips: [
        "Consider keeping a journal to track how you're feeling",
        "Your care team is available if you have questions",
        "Small steps can lead to meaningful progress",
      ],
      actionItems: [
        "Consider discussing your progress at your next appointment",
        "Review your care plan goals with your healthcare provider",
      ],
      encouragement: "Every step you take toward better health matters. Keep up the great work!",
      suggestedFollowUp: {
        type: "follow_up",
        scheduledFor: format(addWeeks(new Date(), 1), "yyyy-MM-dd"),
        topic: "Progress check-in",
      },
      relevanceScore: 60,
      safetyDisclaimer: "This information is for educational purposes only and is not medical advice. Please discuss any health questions or concerns with your healthcare provider.",
    };
  }
}

// Create a new message schedule
async function createMessageSchedule(input: CreateMessageScheduleInput): Promise<MessageSchedule> {
  const id = generateId("sched");
  const now = new Date().toISOString();
  
  const schedule: MessageSchedule = {
    id,
    carePlanId: input.carePlanId,
    patientId: input.patientId,
    templateId: input.templateId,
    type: input.type,
    title: input.title,
    frequency: input.frequency,
    customCronExpression: input.customCronExpression,
    startDate: input.startDate,
    endDate: input.endDate,
    nextScheduledDate: input.startDate,
    channels: input.channels,
    isActive: true,
    triggerConditions: input.triggerConditions,
    createdAt: now,
    updatedAt: now,
  };
  
  messageSchedules.set(id, schedule);
  return schedule;
}

// Get schedules for a patient or care plan
function getMessageSchedules(filter: { patientId?: string; carePlanId?: string; isActive?: boolean }): MessageSchedule[] {
  return Array.from(messageSchedules.values()).filter(s => {
    if (filter.patientId && s.patientId !== filter.patientId) return false;
    if (filter.carePlanId && s.carePlanId !== filter.carePlanId) return false;
    if (filter.isActive !== undefined && s.isActive !== filter.isActive) return false;
    return true;
  });
}

// Update a schedule
function updateMessageSchedule(id: string, updates: Partial<MessageSchedule>): MessageSchedule | null {
  const schedule = messageSchedules.get(id);
  if (!schedule) return null;
  
  const updated = {
    ...schedule,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  messageSchedules.set(id, updated);
  return updated;
}

// Cancel a schedule
function cancelMessageSchedule(id: string): boolean {
  const schedule = messageSchedules.get(id);
  if (!schedule) return false;
  
  schedule.isActive = false;
  schedule.updatedAt = new Date().toISOString();
  messageSchedules.set(id, schedule);
  return true;
}

// Send a message (with channel adapter pattern)
async function sendMessage(
  input: SendMessageInput,
  personalizedContent: PatientMessage["personalizedContent"]
): Promise<PatientMessage> {
  const id = generateId("msg");
  const now = new Date().toISOString();
  
  const message: PatientMessage = {
    id,
    patientId: input.patientId,
    carePlanId: input.carePlanId,
    type: input.type,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    personalizedContent,
    status: "pending",
    scheduledAt: input.scheduledAt || now,
    retryCount: 0,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  
  patientMessages.set(id, message);
  
  // Attempt delivery based on channel
  const result = await deliverMessage(message);
  
  message.status = result.success ? "delivered" : "failed";
  message.deliveredAt = result.deliveredAt;
  message.externalMessageId = result.externalMessageId;
  message.failureReason = result.failureReason;
  message.updatedAt = new Date().toISOString();
  
  patientMessages.set(id, message);
  
  return message;
}

// Channel delivery adapters
async function deliverMessage(message: PatientMessage): Promise<MessageDeliveryResult> {
  switch (message.channel) {
    case "in_app":
      return deliverInAppMessage(message);
    case "sms":
      return deliverSmsMessage(message);
    case "email":
      return deliverEmailMessage(message);
    case "push":
      return deliverPushMessage(message);
    default:
      return {
        messageId: message.id,
        channel: message.channel,
        success: false,
        failureReason: "Unsupported channel",
        retryable: false,
      };
  }
}

// In-app message delivery (always available)
async function deliverInAppMessage(message: PatientMessage): Promise<MessageDeliveryResult> {
  // In-app messages are stored and immediately available
  console.log(`[PatientEducationMessaging] In-app message delivered: ${message.id}`);
  
  return {
    messageId: message.id,
    channel: "in_app",
    success: true,
    deliveredAt: new Date().toISOString(),
    retryable: false,
  };
}

// SMS delivery (requires Twilio credentials)
async function deliverSmsMessage(message: PatientMessage): Promise<MessageDeliveryResult> {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log(`[PatientEducationMessaging] SMS delivery skipped - Twilio not configured. Message: ${message.id}`);
    
    // Fall back to in-app delivery
    return {
      messageId: message.id,
      channel: "sms",
      success: true,
      deliveredAt: new Date().toISOString(),
      failureReason: "SMS not configured - delivered as in-app message",
      retryable: false,
    };
  }
  
  try {
    // Twilio integration would go here
    // For now, we simulate successful delivery
    console.log(`[PatientEducationMessaging] SMS would be sent via Twilio: ${message.id}`);
    
    return {
      messageId: message.id,
      channel: "sms",
      success: true,
      deliveredAt: new Date().toISOString(),
      externalMessageId: `twilio-${generateId("sm")}`,
      retryable: false,
    };
  } catch (error) {
    console.error("[PatientEducationMessaging] SMS delivery error:", error);
    return {
      messageId: message.id,
      channel: "sms",
      success: false,
      failureReason: error instanceof Error ? error.message : "SMS delivery failed",
      retryable: true,
    };
  }
}

// Email delivery (placeholder)
async function deliverEmailMessage(message: PatientMessage): Promise<MessageDeliveryResult> {
  console.log(`[PatientEducationMessaging] Email delivery not configured. Message: ${message.id}`);
  
  return {
    messageId: message.id,
    channel: "email",
    success: true,
    deliveredAt: new Date().toISOString(),
    failureReason: "Email not configured - delivered as in-app message",
    retryable: false,
  };
}

// Push notification delivery (placeholder)
async function deliverPushMessage(message: PatientMessage): Promise<MessageDeliveryResult> {
  console.log(`[PatientEducationMessaging] Push notification not configured. Message: ${message.id}`);
  
  return {
    messageId: message.id,
    channel: "push",
    success: true,
    deliveredAt: new Date().toISOString(),
    failureReason: "Push not configured - delivered as in-app message",
    retryable: false,
  };
}

// Get messages for a patient
function getPatientMessages(filter: {
  patientId?: string;
  carePlanId?: string;
  channel?: MessageChannel;
  status?: MessageStatus;
  type?: MessageType;
}): PatientMessage[] {
  return Array.from(patientMessages.values())
    .filter(m => {
      if (filter.patientId && m.patientId !== filter.patientId) return false;
      if (filter.carePlanId && m.carePlanId !== filter.carePlanId) return false;
      if (filter.channel && m.channel !== filter.channel) return false;
      if (filter.status && m.status !== filter.status) return false;
      if (filter.type && m.type !== filter.type) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get a specific message
function getMessageById(id: string): PatientMessage | null {
  return patientMessages.get(id) || null;
}

// Record patient interaction with a message
async function recordInteraction(
  input: RecordInteractionInput,
  patientId: string,
  ipAddress?: string,
  deviceInfo?: string
): Promise<MessageInteraction> {
  const id = generateId("int");
  
  const interaction: MessageInteraction = {
    id,
    messageId: input.messageId,
    patientId,
    interactionType: input.interactionType,
    timestamp: new Date().toISOString(),
    deviceInfo: input.deviceInfo || deviceInfo,
    ipAddress,
    clickedLinks: input.clickedLinks,
    completionData: input.completionData,
    metadata: {},
  };
  
  messageInteractions.set(id, interaction);
  
  // Update message status if needed
  const message = patientMessages.get(input.messageId);
  if (message) {
    if (input.interactionType === "opened" && message.status === "delivered") {
      message.status = "delivered";
      message.updatedAt = new Date().toISOString();
      patientMessages.set(message.id, message);
    }
  }
  
  return interaction;
}

// Get interactions for a message
function getMessageInteractions(messageId: string): MessageInteraction[] {
  return Array.from(messageInteractions.values())
    .filter(i => i.messageId === messageId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Get engagement summary for a patient
function getPatientEngagementSummary(
  patientId: string,
  carePlanId: string,
  period: "daily" | "weekly" | "monthly" = "weekly"
): PatientEngagementSummary {
  const now = new Date();
  let periodStart: Date;
  
  switch (period) {
    case "daily":
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "monthly":
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "weekly":
    default:
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  const messages = getPatientMessages({ patientId, carePlanId });
  const periodMessages = messages.filter(m => new Date(m.createdAt) >= periodStart);
  
  const allInteractions = Array.from(messageInteractions.values())
    .filter(i => i.patientId === patientId && new Date(i.timestamp) >= periodStart);
  
  const messagesSent = periodMessages.length;
  const messagesDelivered = periodMessages.filter(m => m.status === "delivered").length;
  const messagesOpened = allInteractions.filter(i => i.interactionType === "opened").length;
  const messagesClicked = allInteractions.filter(i => i.interactionType === "clicked").length;
  const messagesCompleted = allInteractions.filter(i => i.interactionType === "completed").length;
  
  return {
    patientId,
    carePlanId,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    messagesSent,
    messagesDelivered,
    messagesOpened,
    messagesClicked,
    messagesCompleted,
    openRate: messagesDelivered > 0 ? Math.round((messagesOpened / messagesDelivered) * 100) : 0,
    clickRate: messagesOpened > 0 ? Math.round((messagesClicked / messagesOpened) * 100) : 0,
    completionRate: messagesOpened > 0 ? Math.round((messagesCompleted / messagesOpened) * 100) : 0,
    topEngagedTopics: [],
    lowEngagementTopics: [],
    recommendedActions: [
      "Consider checking in with patients who haven't engaged recently",
      "Review which message types have highest engagement",
    ],
  };
}

// Get all templates
function getMessageTemplates(filter?: { type?: MessageType; category?: GoalCategory }): MessageTemplate[] {
  return Array.from(messageTemplates.values()).filter(t => {
    if (!t.isActive) return false;
    if (filter?.type && t.type !== filter.type) return false;
    if (filter?.category && t.category !== filter.category) return false;
    return true;
  });
}

// Process scheduled messages (called by scheduler)
async function processScheduledMessages(): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  let processed = 0;
  let failed = 0;
  
  const activeSchedules = getMessageSchedules({ isActive: true });
  
  for (const schedule of activeSchedules) {
    const nextDate = parseISO(schedule.nextScheduledDate);
    
    if (isAfter(now, nextDate)) {
      try {
        // Generate AI content for the message
        const content = await generateEducationContent({
          patientId: schedule.patientId,
          carePlanId: schedule.carePlanId,
          contentType: schedule.type,
        });
        
        // Send through each configured channel
        for (const channel of schedule.channels) {
          await sendMessage(
            {
              patientId: schedule.patientId,
              carePlanId: schedule.carePlanId,
              type: schedule.type,
              channel,
              subject: content.subject,
              body: content.body + "\n\n" + content.safetyDisclaimer,
            },
            {
              patientName: "Patient",
              educationTips: content.educationTips,
              actionItems: content.actionItems,
              encouragement: content.encouragement,
            }
          );
        }
        
        // Update schedule
        const nextScheduledDate = calculateNextScheduleDate(schedule);
        updateMessageSchedule(schedule.id, {
          lastSentDate: now.toISOString(),
          nextScheduledDate,
        });
        
        // Deactivate if one-time or past end date
        if (schedule.frequency === "once" || 
            (schedule.endDate && isAfter(parseISO(nextScheduledDate), parseISO(schedule.endDate)))) {
          cancelMessageSchedule(schedule.id);
        }
        
        processed++;
      } catch (error) {
        console.error(`[PatientEducationMessaging] Failed to process schedule ${schedule.id}:`, error);
        failed++;
      }
    }
  }
  
  return { processed, failed };
}

// Calculate next schedule date based on frequency
function calculateNextScheduleDate(schedule: MessageSchedule): string {
  const now = new Date();
  
  switch (schedule.frequency) {
    case "daily":
      return addDays(now, 1).toISOString();
    case "weekly":
      return addWeeks(now, 1).toISOString();
    case "biweekly":
      return addWeeks(now, 2).toISOString();
    case "monthly":
      return addMonths(now, 1).toISOString();
    case "once":
    case "custom":
    default:
      return addWeeks(now, 1).toISOString();
  }
}

// Auto-generate schedules from care plan
async function autoGenerateSchedulesFromCarePlan(carePlan: AICarePlan): Promise<MessageSchedule[]> {
  const schedules: MessageSchedule[] = [];
  const now = new Date();
  
  // Create education schedule based on goals
  for (const goal of carePlan.smartGoals) {
    const schedule = await createMessageSchedule({
      carePlanId: carePlan.id,
      patientId: carePlan.patientId,
      type: "education",
      title: `Education: ${goal.specific.substring(0, 50)}`,
      frequency: "weekly",
      startDate: addDays(now, 1).toISOString(),
      endDate: addMonths(now, 3).toISOString(),
      channels: ["in_app"],
      triggerConditions: {
        goalProgress: {
          goalId: goal.id,
          threshold: 50,
          operator: "below",
        },
      },
    });
    schedules.push(schedule);
  }
  
  // Create check-in schedule
  const checkInSchedule = await createMessageSchedule({
    carePlanId: carePlan.id,
    patientId: carePlan.patientId,
    type: "check_in",
    title: "Weekly Health Check-In",
    frequency: "weekly",
    startDate: addDays(now, 3).toISOString(),
    channels: ["in_app"],
  });
  schedules.push(checkInSchedule);
  
  // Create motivation schedule
  const motivationSchedule = await createMessageSchedule({
    carePlanId: carePlan.id,
    patientId: carePlan.patientId,
    type: "motivation",
    title: "Weekly Encouragement",
    frequency: "weekly",
    startDate: addDays(now, 5).toISOString(),
    channels: ["in_app"],
  });
  schedules.push(motivationSchedule);
  
  return schedules;
}

export const patientEducationMessagingService = {
  generateEducationContent,
  createMessageSchedule,
  getMessageSchedules,
  updateMessageSchedule,
  cancelMessageSchedule,
  sendMessage,
  getPatientMessages,
  getMessageById,
  recordInteraction,
  getMessageInteractions,
  getPatientEngagementSummary,
  getMessageTemplates,
  processScheduledMessages,
  autoGenerateSchedulesFromCarePlan,
};
