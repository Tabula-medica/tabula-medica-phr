// @ts-nocheck
import { storage } from "./storage";
import type { HealthRecord, MedicationReminder, Appointment, EducationalModule, AiMessage } from "@shared/schema";
import { governedAICall, evaluateDataFlowPolicy, deIdentifyText, type DataCategory } from "./third-party-data-governance";


interface HealthContext {
  user: {
    name: string;
    email: string;
  };
  conditions: HealthRecord[];
  medications: HealthRecord[];
  vitals: HealthRecord[];
  labs: HealthRecord[];
  allergies: HealthRecord[];
  immunizations: HealthRecord[];
  upcomingAppointments: Appointment[];
  medicationReminders: MedicationReminder[];
  recentRecords: HealthRecord[];
}

async function getHealthContext(userId: string): Promise<HealthContext> {
  const user = await storage.getUser(userId);
  const records = await storage.getHealthRecords(userId);
  const upcomingAppointments = await storage.getUpcomingAppointments(userId);
  const medicationReminders = await storage.getActiveMedicationReminders(userId);
  
  const conditions = records.filter(r => r.type === "condition");
  const medications = records.filter(r => r.type === "medication");
  const vitals = records.filter(r => r.type === "vital").slice(0, 10);
  const labs = records.filter(r => r.type === "labs" || r.type === "lab").slice(0, 10);
  const allergies = records.filter(r => r.type === "allergy");
  const immunizations = records.filter(r => r.type === "immunization");
  const recentRecords = records.slice(0, 20);
  
  return {
    user: {
      name: user?.name || "Patient",
      email: user?.email || "",
    },
    conditions,
    medications,
    vitals,
    labs,
    allergies,
    immunizations,
    upcomingAppointments,
    medicationReminders,
    recentRecords,
  };
}

function formatHealthContext(context: HealthContext): string {
  const parts: string[] = [];
  
  parts.push(`Patient Name: ${context.user.name}`);
  
  if (context.conditions.length > 0) {
    parts.push(`\nActive Conditions (${context.conditions.length}):`);
    context.conditions.forEach(c => {
      parts.push(`- ${c.title}${c.summary ? `: ${c.summary}` : ""}`);
    });
  }
  
  if (context.medications.length > 0) {
    parts.push(`\nCurrent Medications (${context.medications.length}):`);
    context.medications.forEach(m => {
      parts.push(`- ${m.title}${m.summary ? `: ${m.summary}` : ""}`);
    });
  }
  
  if (context.allergies.length > 0) {
    parts.push(`\nAllergies (${context.allergies.length}):`);
    context.allergies.forEach(a => {
      parts.push(`- ${a.title}`);
    });
  }
  
  if (context.vitals.length > 0) {
    parts.push(`\nRecent Vitals:`);
    context.vitals.slice(0, 5).forEach(v => {
      parts.push(`- ${v.title}: ${v.summary} (${new Date(v.date).toLocaleDateString()})`);
    });
  }
  
  if (context.labs.length > 0) {
    parts.push(`\nRecent Lab Results:`);
    context.labs.slice(0, 5).forEach(l => {
      parts.push(`- ${l.title}: ${l.summary} (${new Date(l.date).toLocaleDateString()})`);
    });
  }
  
  if (context.immunizations.length > 0) {
    parts.push(`\nImmunization History:`);
    context.immunizations.slice(0, 5).forEach(i => {
      parts.push(`- ${i.title} (${new Date(i.date).toLocaleDateString()})`);
    });
  }
  
  if (context.upcomingAppointments.length > 0) {
    parts.push(`\nUpcoming Appointments:`);
    context.upcomingAppointments.forEach(a => {
      parts.push(`- ${a.title} with ${a.providerName || "Provider"} on ${new Date(a.scheduledAt).toLocaleString()}`);
    });
  }
  
  if (context.medicationReminders.length > 0) {
    parts.push(`\nActive Medication Reminders:`);
    context.medicationReminders.forEach(r => {
      parts.push(`- ${r.medicationName} (${r.dosage || "as prescribed"})`);
    });
  }
  
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are a caring and knowledgeable AI Health Assistant for Tabula Medica, a HIPAA-compliant health records application. You provide 24/7 support to help patients manage their health.

1. MEDICATION MANAGEMENT:
- Provide personalized medication reminders and adherence tips
- Explain medication purposes, dosages, and potential interactions
- Help patients understand their medication schedules
- Never recommend changing medications without consulting a doctor

2. APPOINTMENT ASSISTANCE:
- Help schedule and prepare for appointments
- Remind patients about upcoming appointments
- Suggest questions to ask their healthcare providers
- Provide preparation tips for specific appointment types

3. HEALTH EDUCATION:
- Explain conditions and treatments in plain language
- Recommend relevant educational content based on the patient's conditions
- Answer questions about symptoms, prevention, and wellness
- Promote healthy lifestyle choices

4. PERSONALIZED INSIGHTS:
- Reference the patient's medical history when providing advice
- Identify patterns and trends in their health data
- Celebrate health milestones and progress
- Provide context-aware reminders and tips

5. APP FEATURE ASSISTANCE:
- Help users navigate and use the Tabula Medica app
- Explain how to view health records, medications, and lab results
- Guide users on connecting wearable devices
- Explain how to share health records with providers
- Help with setting up medication reminders and appointments
- Explain the Medical Journey timeline and Episodes of Care features

6. ESCALATION TO CARE TEAM:
- If the user has complex medical questions requiring provider attention, offer to escalate
- Complex queries include: specific treatment questions, concerning symptoms, medication changes, test result interpretation
- When escalating, summarize the patient's question clearly for the care team
- Let the patient know their message will be sent to their care team via secure messaging

IMPORTANT GUIDELINES:
- Always be empathetic, supportive, and encouraging
- Never provide medical diagnoses or treatment recommendations
- Always recommend consulting healthcare providers for medical decisions
- End every response with: "This is AI-assisted health information, not medical advice. Always consult your healthcare provider for medical decisions."
- Protect patient privacy and handle health information sensitively
- Be concise but thorough in your responses
- Use simple, non-medical language when possible
- If you're uncertain, say so and recommend professional consultation
- If the query needs care team attention, include "[ESCALATE]" at the start of your response

When formatting responses:
- Use bullet points for lists
- Keep paragraphs short and readable
- Use encouraging and positive language
- Personalize responses using the patient's name when appropriate

FREQUENTLY ASKED QUESTIONS - Answer these directly:
Q: How do I view my health records?
A: Tap the "Records" tab at the bottom of the app to see all your health records organized by type.

Q: How do I add a medication reminder?
A: Go to the "Medications" section and tap the "+" button to add a new reminder.

Q: How can I share my records with my doctor?
A: Use the "Share" feature to create a secure link with a time limit. You can also export your records as a FHIR document.

Q: What is the Medical Journey timeline?
A: The Medical Journey shows your health history over time, including visits, lab results, medications, and major health events.

Q: How do I connect my wearable device?
A: Go to Settings > Connected Devices to link your fitness tracker, Apple Watch, or other compatible devices.

Q: How do I message my care team?
A: Tap the "Messages" or "Care Team" tab to send secure messages to your healthcare providers.`;

export interface ContextFilter {
  recordIds?: string[];
  types?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatRequest {
  userId: string;
  message: string;
  conversationId?: string;
  contextFilter?: ContextFilter;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  suggestedActions?: SuggestedAction[];
  escalated?: boolean;
  escalationMessageId?: string;
}

interface SuggestedAction {
  type: "set_reminder" | "schedule_appointment" | "view_education" | "log_medication" | "view_records";
  title: string;
  data?: any;
}

export async function getAvailableContext(userId: string) {
  const records = await storage.getHealthRecords(userId);
  const upcomingAppointments = await storage.getUpcomingAppointments(userId);

  const grouped: Record<string, { id: string; title: string; date: string; summary?: string | null }[]> = {};
  for (const r of records) {
    const t = r.type || "other";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push({ id: r.id, title: r.title, date: new Date(r.date).toISOString(), summary: r.summary });
  }

  const typeLabels: Record<string, string> = {
    condition: "Conditions",
    medication: "Medications",
    vital: "Vitals",
    lab: "Lab Results",
    labs: "Lab Results",
    allergy: "Allergies",
    immunization: "Immunizations",
    procedure: "Procedures",
    encounter: "Visits",
    imaging: "Imaging",
    note: "Clinical Notes",
  };

  const categories = Object.entries(grouped).map(([type, items]) => ({
    type,
    label: typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
    count: items.length,
    items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50),
  }));

  categories.sort((a, b) => b.count - a.count);

  return {
    categories,
    appointments: upcomingAppointments.map(a => ({
      id: a.id,
      title: a.title,
      date: new Date(a.scheduledAt).toISOString(),
      provider: a.providerName,
    })),
    totalRecords: records.length,
  };
}

function applyContextFilter(context: HealthContext, filter: ContextFilter): { filteredContext: HealthContext; focusDescription: string } {
  let filtered = { ...context };
  const focusParts: string[] = [];

  if (filter.recordIds && filter.recordIds.length > 0) {
    const idSet = new Set(filter.recordIds);
    const filterByIds = (arr: HealthRecord[]) => arr.filter(r => idSet.has(r.id));
    filtered = {
      ...filtered,
      conditions: filterByIds(filtered.conditions),
      medications: filterByIds(filtered.medications),
      vitals: filterByIds(filtered.vitals),
      labs: filterByIds(filtered.labs),
      allergies: filterByIds(filtered.allergies),
      immunizations: filterByIds(filtered.immunizations),
      recentRecords: filterByIds(filtered.recentRecords),
    };
    const total = filtered.conditions.length + filtered.medications.length + filtered.vitals.length +
      filtered.labs.length + filtered.allergies.length + filtered.immunizations.length;
    focusParts.push(`${total} specific record(s) selected`);
  }

  if (filter.types && filter.types.length > 0) {
    const typeSet = new Set(filter.types);
    const filterByType = (arr: HealthRecord[], type: string) => typeSet.has(type) ? arr : [];
    filtered = {
      ...filtered,
      conditions: filterByType(filtered.conditions, "condition"),
      medications: filterByType(filtered.medications, "medication"),
      vitals: filterByType(filtered.vitals, "vital"),
      labs: typeSet.has("lab") || typeSet.has("labs") ? filtered.labs : [],
      allergies: filterByType(filtered.allergies, "allergy"),
      immunizations: filterByType(filtered.immunizations, "immunization"),
      recentRecords: filtered.recentRecords.filter(r => typeSet.has(r.type)),
    };
    focusParts.push(`Focused on: ${filter.types.join(", ")}`);
  }

  if (filter.dateFrom || filter.dateTo) {
    const from = filter.dateFrom ? new Date(filter.dateFrom) : new Date(0);
    const to = filter.dateTo ? new Date(filter.dateTo) : new Date();
    const inRange = (arr: HealthRecord[]) => arr.filter(r => {
      const d = new Date(r.date);
      return d >= from && d <= to;
    });
    filtered = {
      ...filtered,
      conditions: inRange(filtered.conditions),
      medications: inRange(filtered.medications),
      vitals: inRange(filtered.vitals),
      labs: inRange(filtered.labs),
      allergies: inRange(filtered.allergies),
      immunizations: inRange(filtered.immunizations),
      recentRecords: inRange(filtered.recentRecords),
    };
    const fromStr = filter.dateFrom ? new Date(filter.dateFrom).toLocaleDateString() : "earliest";
    const toStr = filter.dateTo ? new Date(filter.dateTo).toLocaleDateString() : "now";
    focusParts.push(`Date range: ${fromStr} to ${toStr}`);
  }

  return { filteredContext: filtered, focusDescription: focusParts.join(". ") };
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const { userId, message, conversationId, contextFilter } = request;
  
  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await storage.getAiConversation(conversationId);
  }
  
  if (!conversation) {
    conversation = await storage.createAiConversation({
      userId,
      title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
      context: "general",
      isActive: true,
    });
  }
  
  // Get health context
  let healthContext = await getHealthContext(userId);
  let focusNote = "";

  if (contextFilter && (contextFilter.recordIds?.length || contextFilter.types?.length || contextFilter.dateFrom || contextFilter.dateTo)) {
    const { filteredContext, focusDescription } = applyContextFilter(healthContext, contextFilter);
    healthContext = filteredContext;
    focusNote = focusDescription;
  }

  const formattedContext = formatHealthContext(healthContext);
  
  // Get conversation history
  const previousMessages = await storage.getAiMessages(conversation.id);
  
  // Build conversation history for the prompt
  const recentMessages = previousMessages.slice(-10);
  const historyText = recentMessages
    .map((msg) => `${msg.role === "user" ? "Patient" : "Assistant"}: ${msg.content}`)
    .join("\n");
  
  // Save user message
  await storage.addAiMessage({
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  // Determine data categories present in context
  const dataCategories: DataCategory[] = ["conditions", "medications", "allergies"];
  if (healthContext.vitals.length > 0) dataCategories.push("vitals");
  if (healthContext.labs.length > 0) dataCategories.push("lab_results");
  if (healthContext.immunizations.length > 0) dataCategories.push("immunizations");
  if (healthContext.upcomingAppointments.length > 0) dataCategories.push("appointments");
  
  // Use governed AI call with data flow policy enforcement, PHI de-identification, and audit logging
  const focusSection = focusNote ? `\nCONTEXT FOCUS: The patient has narrowed the context to specific data. ${focusNote}. Only discuss information within this focused context unless the patient asks otherwise.\n` : "";
  const userPrompt = `PATIENT HEALTH CONTEXT:\n${formattedContext}\n${focusSection}\n${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ""}Patient: ${message}`;

  const governedResponse = await governedAICall({
    callerService: "ai-health-assistant",
    callerMethod: "chat",
    purpose: "clinical_decision_support",
    userId,
    patientId: userId,
    model: "gpt-4o",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    dataCategories,
    maxTokens: 1000,
  });
  
  let assistantMessage = governedResponse.content || "I apologize, but I couldn't generate a response. Please try again.";
  
  // Check if response indicates escalation is needed
  let escalated = false;
  let escalationMessageId: string | undefined;
  
  if (assistantMessage.includes("[ESCALATE]")) {
    escalated = true;
    assistantMessage = assistantMessage.replace("[ESCALATE]", "").trim();
    
    // Create escalation message to care team
    try {
      escalationMessageId = await createCareTeamEscalation(userId, message, assistantMessage);
    } catch (error) {
      console.error("Error creating escalation:", error);
    }
  }
  
  // Save assistant message
  await storage.addAiMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantMessage,
    metadata: escalated ? { escalated: true, escalationMessageId } : undefined,
  });
  
  // Generate suggested actions based on context
  const suggestedActions = generateSuggestedActions(message, healthContext);
  
  // Add escalate action if the message seems to need provider attention
  if (shouldOfferEscalation(message) && !escalated) {
    suggestedActions.unshift({
      type: "escalate_to_care_team" as any,
      title: "Send to my care team",
    });
  }
  
  return {
    message: assistantMessage,
    conversationId: conversation.id,
    suggestedActions,
    escalated,
    escalationMessageId,
  };
}

/**
 * Check if user message might need care team escalation
 */
function shouldOfferEscalation(message: string): boolean {
  const escalationTriggers = [
    "pain", "hurt", "ache", "symptom", "side effect", "worried", "concerned",
    "emergency", "urgent", "severe", "bleeding", "chest", "breathing",
    "medication change", "dose", "prescription", "refill", "lab result",
    "test result", "abnormal", "high", "low", "fever", "infection"
  ];
  const lowerMessage = message.toLowerCase();
  return escalationTriggers.some(trigger => lowerMessage.includes(trigger));
}

/**
 * Create a secure message to care team for escalation
 */
async function createCareTeamEscalation(
  userId: string,
  userQuestion: string,
  aiSummary: string
): Promise<string | undefined> {
  try {
    const { db } = await import("./db");
    const { messagingThreads, secureMessages, sharedPatientAccess } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const { randomUUID } = await import("crypto");
    
    // Check if patient has any care team access set up
    const accessRecords = await db
      .select()
      .from(sharedPatientAccess)
      .where(
        and(
          eq(sharedPatientAccess.patientId, userId),
          eq(sharedPatientAccess.isActive, true)
        )
      )
      .limit(5);
    
    // Create a secure message thread for the escalation
    const threadId = randomUUID();
    await db.insert(messagingThreads).values({
      id: threadId,
      patientId: userId,
      subject: "AI Assistant Escalation: Patient Question",
      status: "open",
      priority: "normal",
      threadType: "inquiry",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Create the escalation message
    const messageId = randomUUID();
    const escalationContent = `**Patient Question (via AI Health Assistant):**\n\n${userQuestion}\n\n---\n\n**AI Assistant Summary:**\n\n${aiSummary}\n\n---\n\n*This message was automatically escalated from the AI Health Assistant because it requires care team attention.*`;
    
    await db.insert(secureMessages).values({
      id: messageId,
      threadId: threadId,
      senderId: userId,
      senderType: "patient",
      messageType: "text",
      content: escalationContent,
      isRead: false,
      createdAt: new Date(),
    });
    
    console.log(`Escalation created - Thread: ${threadId}, Message: ${messageId}, Care team members available: ${accessRecords.length}`);
    
    return messageId;
  } catch (error) {
    console.error("Error in createCareTeamEscalation:", error);
    return undefined;
  }
}

function generateSuggestedActions(userMessage: string, context: HealthContext): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const lowerMessage = userMessage.toLowerCase();
  
  // Medication-related suggestions
  if (lowerMessage.includes("medication") || lowerMessage.includes("medicine") || lowerMessage.includes("pill")) {
    if (context.medications.length > 0) {
      actions.push({
        type: "set_reminder",
        title: "Set medication reminder",
        data: { medications: context.medications.map(m => m.title) },
      });
    }
    actions.push({
      type: "log_medication",
      title: "Log medication taken",
    });
  }
  
  // Appointment-related suggestions
  if (lowerMessage.includes("appointment") || lowerMessage.includes("doctor") || lowerMessage.includes("schedule")) {
    actions.push({
      type: "schedule_appointment",
      title: "Schedule an appointment",
    });
  }
  
  // Education-related suggestions
  if (lowerMessage.includes("learn") || lowerMessage.includes("understand") || lowerMessage.includes("what is") || lowerMessage.includes("tell me about")) {
    actions.push({
      type: "view_education",
      title: "View educational content",
    });
  }
  
  // Record-related suggestions
  if (lowerMessage.includes("history") || lowerMessage.includes("record") || lowerMessage.includes("past") || lowerMessage.includes("results")) {
    actions.push({
      type: "view_records",
      title: "View health records",
    });
  }
  
  return actions.slice(0, 3); // Limit to 3 suggestions
}

export async function getProactiveInsights(userId: string): Promise<{
  greeting: string;
  insights: Array<{ type: string; message: string; priority: "high" | "medium" | "low" }>;
  recommendations: string[];
}> {
  const context = await getHealthContext(userId);
  const now = new Date();
  const hour = now.getHours();
  
  // Generate time-appropriate greeting
  let timeGreeting = "Good morning";
  if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
  else if (hour >= 17) timeGreeting = "Good evening";
  
  const greeting = `${timeGreeting}, ${context.user.name}!`;
  
  const insights: Array<{ type: string; message: string; priority: "high" | "medium" | "low" }> = [];
  const recommendations: string[] = [];
  
  // Check for upcoming appointments
  const upcomingToday = context.upcomingAppointments.filter(a => {
    const apptDate = new Date(a.scheduledAt);
    return apptDate.toDateString() === now.toDateString();
  });
  
  if (upcomingToday.length > 0) {
    insights.push({
      type: "appointment",
      message: `You have ${upcomingToday.length} appointment${upcomingToday.length > 1 ? "s" : ""} today`,
      priority: "high",
    });
  }
  
  // Check medication adherence
  const activeReminders = context.medicationReminders.filter(r => r.isActive);
  if (activeReminders.length > 0) {
    const pendingMeds = activeReminders.filter(r => {
      if (!r.lastTakenAt) return true;
      const lastTaken = new Date(r.lastTakenAt);
      const hoursSinceLastTaken = (now.getTime() - lastTaken.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastTaken > 24;
    });
    
    if (pendingMeds.length > 0) {
      insights.push({
        type: "medication",
        message: `${pendingMeds.length} medication${pendingMeds.length > 1 ? "s" : ""} may need attention`,
        priority: "medium",
      });
    }
  }
  
  // Check for recent lab results
  const recentLabs = context.labs.filter(l => {
    const labDate = new Date(l.date);
    const daysSince = (now.getTime() - labDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  });
  
  if (recentLabs.length > 0) {
    insights.push({
      type: "labs",
      message: `${recentLabs.length} new lab result${recentLabs.length > 1 ? "s" : ""} available`,
      priority: "medium",
    });
  }
  
  // Generate personalized recommendations
  if (context.conditions.length > 0) {
    recommendations.push("Review educational content about your conditions");
  }
  
  if (context.medications.length > 0 && activeReminders.length === 0) {
    recommendations.push("Set up medication reminders to stay on track");
  }
  
  if (context.upcomingAppointments.length === 0) {
    recommendations.push("Consider scheduling a routine check-up");
  }
  
  return { greeting, insights, recommendations };
}

export async function generateEducationalSuggestions(userId: string): Promise<EducationalModule[]> {
  return storage.getRecommendedModules(userId);
}

export async function getQuickReplies(userId: string): Promise<string[]> {
  const context = await getHealthContext(userId);
  const replies: string[] = [];
  
  if (context.medications.length > 0) {
    replies.push("Tell me about my medications");
  }
  
  if (context.conditions.length > 0) {
    replies.push(`What should I know about ${context.conditions[0]?.title || "my condition"}?`);
  }
  
  if (context.upcomingAppointments.length > 0) {
    replies.push("Help me prepare for my next appointment");
  }
  
  replies.push("Set a medication reminder");
  replies.push("What health goals should I set?");
  
  return replies.slice(0, 4);
}

// Seed educational modules if not exist
export async function seedEducationalModules(): Promise<void> {
  const existing = await storage.getEducationalModules();
  if (existing.length > 0) return;
  
  const modules = [
    {
      title: "Understanding Your Blood Pressure",
      description: "Learn what blood pressure readings mean and how to manage hypertension",
      category: "condition",
      content: `# Understanding Your Blood Pressure

Blood pressure is the force of blood pushing against the walls of your arteries. It's measured in two numbers:

## What the Numbers Mean

- **Systolic (top number)**: Pressure when your heart beats
- **Diastolic (bottom number)**: Pressure when your heart rests

## Blood Pressure Categories

| Category | Systolic | Diastolic |
|----------|----------|-----------|
| Normal | Less than 120 | Less than 80 |
| Elevated | 120-129 | Less than 80 |
| High (Stage 1) | 130-139 | 80-89 |
| High (Stage 2) | 140+ | 90+ |

## Tips for Managing Blood Pressure

1. **Reduce sodium intake** - Aim for less than 2,300 mg per day
2. **Exercise regularly** - 150 minutes of moderate activity per week
3. **Maintain a healthy weight** - Even small weight loss can help
4. **Limit alcohol** - No more than one drink per day for women, two for men
5. **Don't smoke** - Smoking raises blood pressure temporarily

## When to See a Doctor

Contact your healthcare provider if your blood pressure is consistently above 130/80 or if you experience symptoms like headaches, shortness of breath, or nosebleeds.`,
      duration: 5,
      difficulty: "beginner",
      relatedConditions: ["hypertension", "high blood pressure", "cardiovascular"],
      relatedMedications: ["lisinopril", "amlodipine", "losartan", "metoprolol"],
    },
    {
      title: "Diabetes Management Basics",
      description: "Essential information for managing type 2 diabetes effectively",
      category: "condition",
      content: `# Diabetes Management Basics

Type 2 diabetes is a condition where your body doesn't use insulin properly. With proper management, you can live a healthy, active life.

## Key Concepts

### Blood Sugar Targets
- **Before meals**: 80-130 mg/dL
- **1-2 hours after meals**: Less than 180 mg/dL
- **A1C goal**: Less than 7% for most adults

### The ABCs of Diabetes

- **A** - A1C: Get tested at least twice a year
- **B** - Blood pressure: Keep it below 130/80
- **C** - Cholesterol: Know your numbers

## Daily Management Tips

1. **Monitor your blood sugar** as recommended
2. **Take medications** as prescribed
3. **Eat balanced meals** with consistent carbohydrates
4. **Stay active** - aim for 30 minutes daily
5. **Check your feet** for cuts or sores

## Warning Signs to Watch

Seek immediate medical attention if you experience:
- Extreme thirst or frequent urination
- Nausea or vomiting
- Confusion or drowsiness
- Fruity-smelling breath`,
      duration: 7,
      difficulty: "beginner",
      relatedConditions: ["diabetes", "type 2 diabetes", "prediabetes", "insulin resistance"],
      relatedMedications: ["metformin", "glipizide", "insulin", "ozempic", "jardiance"],
    },
    {
      title: "Medication Safety Tips",
      description: "Learn how to take your medications safely and effectively",
      category: "medication",
      content: `# Medication Safety Tips

Taking medications correctly is crucial for your health. Here's what you need to know.

## Golden Rules

1. **Take as directed** - Follow your prescription exactly
2. **Don't skip doses** - Set reminders if needed
3. **Don't double up** - If you miss a dose, don't take two
4. **Store properly** - Keep away from heat and moisture

## Organizing Your Medications

### Use a Pill Organizer
- Weekly pill boxes help you stay on track
- Fill them at the same time each week

### Keep a Medication List
Include:
- Medication name
- Dosage
- When to take it
- What it's for

## Drug Interactions

Be careful with:
- **Other medications** - Check for interactions
- **Supplements** - Some can interfere with drugs
- **Food and drinks** - Grapefruit, alcohol can affect some medications

## Questions to Ask Your Doctor

1. What is this medication for?
2. How and when should I take it?
3. What side effects should I watch for?
4. Are there any foods or activities to avoid?`,
      duration: 5,
      difficulty: "beginner",
      relatedConditions: [],
      relatedMedications: [],
    },
    {
      title: "Healthy Sleep Habits",
      description: "Improve your sleep quality for better overall health",
      category: "lifestyle",
      content: `# Healthy Sleep Habits

Good sleep is essential for your physical and mental health. Here's how to get better rest.

## Why Sleep Matters

- Helps your body repair and heal
- Supports immune function
- Improves memory and concentration
- Regulates mood and emotions

## How Much Sleep Do You Need?

| Age Group | Recommended Hours |
|-----------|-------------------|
| Adults 18-64 | 7-9 hours |
| Adults 65+ | 7-8 hours |

## Sleep Hygiene Tips

### Create a Sleep-Friendly Environment
- Keep your bedroom cool, dark, and quiet
- Use comfortable bedding
- Reserve your bed for sleep only

### Establish a Routine
- Go to bed and wake up at the same time daily
- Create a relaxing pre-sleep routine
- Avoid screens 1 hour before bed

### Watch What You Consume
- Limit caffeine after noon
- Avoid heavy meals before bed
- Limit alcohol - it disrupts sleep quality

## When to Seek Help

Talk to your doctor if you:
- Can't fall asleep within 30 minutes regularly
- Wake up frequently during the night
- Feel tired despite adequate sleep
- Snore loudly or stop breathing during sleep`,
      duration: 5,
      difficulty: "beginner",
      relatedConditions: ["insomnia", "sleep apnea", "anxiety"],
      relatedMedications: ["melatonin", "trazodone", "ambien"],
    },
    {
      title: "Heart-Healthy Nutrition",
      description: "Eating patterns that support cardiovascular health",
      category: "nutrition",
      content: `# Heart-Healthy Nutrition

What you eat directly affects your heart health. Learn how to make heart-smart food choices.

## The Heart-Healthy Plate

Fill your plate with:
- **Half with vegetables and fruits**
- **Quarter with lean proteins**
- **Quarter with whole grains**

## Foods to Emphasize

### Heart Heroes
- Fatty fish (salmon, mackerel) - 2x per week
- Nuts and seeds - a handful daily
- Olive oil - for cooking and dressings
- Leafy greens - spinach, kale, arugula
- Berries - rich in antioxidants
- Whole grains - oats, quinoa, brown rice

## Foods to Limit

### Cut Back On
- Sodium - less than 2,300 mg/day
- Saturated fat - less than 10% of calories
- Added sugars - less than 25g/day for women, 36g for men
- Processed meats - bacon, sausage, deli meats

## Easy Swaps

| Instead of... | Try... |
|---------------|--------|
| White bread | Whole wheat |
| Butter | Olive oil |
| Chips | Nuts |
| Soda | Sparkling water |
| Red meat | Fish or poultry |

## Mediterranean Diet Benefits

Research shows the Mediterranean diet can:
- Lower heart disease risk by 30%
- Reduce inflammation
- Improve cholesterol levels`,
      duration: 6,
      difficulty: "beginner",
      relatedConditions: ["heart disease", "high cholesterol", "hypertension"],
      relatedMedications: ["statins", "atorvastatin", "simvastatin"],
    },
  ];
  
  for (const module of modules) {
    await storage.createEducationalModule(module as any);
  }
}
