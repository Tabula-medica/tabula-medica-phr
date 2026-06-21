import OpenAI from "openai";
import {
  PatientMessage,
  MessageType,
  MessageChannel,
  MessageStatus,
  CarePlan,
  PatientEngagementSummary,
} from "@shared/schema";

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.log("[AIPatientCommunication] OpenAI API key not configured, using fallback responses");
}

export interface PatientInquiry {
  id: string;
  patientId: string;
  patientName: string;
  subject: string;
  message: string;
  receivedAt: string;
  priority: "low" | "normal" | "high" | "urgent";
  category: "general" | "medication" | "appointment" | "symptoms" | "billing" | "records" | "other";
}

export interface PatientContext {
  patientId: string;
  patientName: string;
  carePlan?: CarePlan;
  recentInteractions: PatientInteraction[];
  upcomingAppointments: UpcomingAppointment[];
  activeMedications: ActiveMedication[];
  recentLabResults?: RecentLabResult[];
}

export interface PatientInteraction {
  id: string;
  type: "message" | "appointment" | "lab_result" | "medication_change" | "call";
  summary: string;
  date: string;
  outcome?: string;
}

export interface UpcomingAppointment {
  id: string;
  type: string;
  provider: string;
  scheduledDate: string;
  location?: string;
  instructions?: string;
}

export interface ActiveMedication {
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
}

export interface RecentLabResult {
  testName: string;
  value: string;
  unit: string;
  status: "normal" | "abnormal" | "critical";
  date: string;
}

export interface TriageResult {
  id: string;
  inquiryId: string;
  patientId: string;
  patientName: string;
  originalMessage: string;
  category: string;
  urgencyLevel: "low" | "normal" | "high" | "urgent" | "critical";
  routingDecision: {
    department: string;
    departmentCode: string;
    assignedTo?: string;
    assignedRole: string;
    escalationRequired: boolean;
    escalationReason?: string;
  };
  keyTopics: string[];
  sentiment: "positive" | "neutral" | "concerned" | "frustrated" | "distressed";
  suggestedResponseTime: string;
  aiConfidence: number;
  triageNotes: string[];
  noCdsDisclaimer: string;
  createdAt: string;
  status: "pending" | "routed" | "in_progress" | "resolved";
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  messageTypes: string[];
  avgResponseTime: string;
  staffCount: number;
}

export interface CommunicationAssistantDashboard {
  stats: {
    pendingInquiries: number;
    draftedResponses: number;
    scheduledMessages: number;
    triageQueue: number;
    avgResponseTime: string;
    aiDraftAccuracy: number;
  };
  recentInquiries: PatientInquiry[];
  recentDrafts: AIResponseDraft[];
  recentTriages: TriageResult[];
  upcomingMessages: ProactiveMessage[];
  departments: Department[];
}

export interface AIResponseDraft {
  id: string;
  inquiryId: string;
  patientId: string;
  subject: string;
  body: string;
  personalizedElements: {
    patientName: string;
    referencedCarePlanGoals?: string[];
    referencedAppointments?: string[];
    referencedMedications?: string[];
    suggestedFollowUp?: string;
  };
  tone: "empathetic" | "informative" | "encouraging" | "professional";
  confidenceScore: number;
  suggestedActions: string[];
  requiresProviderReview: boolean;
  reviewReason?: string;
  safetyDisclaimer: string;
  generatedAt: string;
  status: "draft" | "approved" | "sent" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
}

export interface ProactiveMessage {
  id: string;
  patientId: string;
  patientName: string;
  type: "appointment_reminder" | "follow_up" | "medication_reminder" | "check_in" | "education" | "wellness_tip";
  subject: string;
  body: string;
  personalizedContent: {
    greeting: string;
    mainMessage: string;
    actionItems?: string[];
    encouragement?: string;
  };
  scheduledFor: string;
  channel: MessageChannel;
  priority: "low" | "normal" | "high";
  relatedEntityId?: string;
  status: "scheduled" | "sent" | "delivered" | "failed" | "cancelled";
  createdAt: string;
}

const HIPAA_SAFE_COMMUNICATION_PROMPT = `You are a healthcare communication assistant helping care teams communicate with patients. 

CRITICAL RULES:
- Use ONLY safe verbs: "shows", "states", "refers to", "means"
- NEVER provide medical advice, diagnoses, or treatment recommendations
- NEVER tell patients what medications to take or change
- Always encourage patients to speak with their healthcare provider for medical questions
- Use warm, empathetic, and supportive language
- Keep responses clear and easy to understand
- Include appropriate safety disclaimers

Your role is to help draft personalized, compassionate responses that reference the patient's care plan and recent interactions where appropriate, while always directing medical questions to their healthcare providers.`;

const inquiryStore: Map<string, PatientInquiry> = new Map();
const responseDraftStore: Map<string, AIResponseDraft> = new Map();
const proactiveMessageStore: Map<string, ProactiveMessage> = new Map();
const triageStore: Map<string, TriageResult> = new Map();

const NO_CDS_DISCLAIMER = "This AI-assisted triage and routing suggestion is for informational purposes only. It does not constitute clinical decision support or medical advice. All patient communications should be reviewed by qualified healthcare staff before final routing decisions.";

const departments: Department[] = [
  {
    id: "dept-1",
    name: "Primary Care",
    code: "PCP",
    description: "General health questions, routine care, preventive medicine",
    messageTypes: ["general", "wellness", "preventive"],
    avgResponseTime: "4 hours",
    staffCount: 12,
  },
  {
    id: "dept-2",
    name: "Pharmacy Services",
    code: "PHARM",
    description: "Medication questions, refills, drug interactions",
    messageTypes: ["medication", "refill", "pharmacy"],
    avgResponseTime: "2 hours",
    staffCount: 8,
  },
  {
    id: "dept-3",
    name: "Scheduling",
    code: "SCHED",
    description: "Appointment scheduling, rescheduling, cancellations",
    messageTypes: ["appointment", "scheduling"],
    avgResponseTime: "1 hour",
    staffCount: 15,
  },
  {
    id: "dept-4",
    name: "Nursing Triage",
    code: "RN",
    description: "Symptom assessment, clinical questions, urgent concerns",
    messageTypes: ["symptoms", "urgent", "clinical"],
    avgResponseTime: "30 minutes",
    staffCount: 10,
  },
  {
    id: "dept-5",
    name: "Billing & Insurance",
    code: "BILLING",
    description: "Billing inquiries, insurance questions, payment plans",
    messageTypes: ["billing", "insurance", "financial"],
    avgResponseTime: "24 hours",
    staffCount: 6,
  },
  {
    id: "dept-6",
    name: "Medical Records",
    code: "HIM",
    description: "Record requests, lab results, imaging reports",
    messageTypes: ["records", "labs", "imaging"],
    avgResponseTime: "48 hours",
    staffCount: 5,
  },
  {
    id: "dept-7",
    name: "Specialty Care",
    code: "SPEC",
    description: "Specialist referrals, specialty follow-ups",
    messageTypes: ["referral", "specialist"],
    avgResponseTime: "24 hours",
    staffCount: 8,
  },
];

export function initializeSampleData(): void {
  const sampleInquiries: PatientInquiry[] = [
    {
      id: "inq-1",
      patientId: "patient-1",
      patientName: "John Smith",
      subject: "Question about my medication schedule",
      message: "Hi, I wanted to check if I should take my blood pressure medication in the morning or evening. I've been taking it at night but feel a bit dizzy sometimes.",
      receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      priority: "normal",
      category: "medication",
    },
    {
      id: "inq-2",
      patientId: "patient-2",
      patientName: "Sarah Johnson",
      subject: "Follow-up on recent lab results",
      message: "I received a notification that my lab results are ready. Could someone explain what my A1C results mean and if there are any concerns I should discuss with my doctor?",
      receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      priority: "high",
      category: "records",
    },
    {
      id: "inq-3",
      patientId: "patient-3",
      patientName: "Michael Chen",
      subject: "Appointment rescheduling request",
      message: "I need to reschedule my upcoming appointment on the 25th. I have a work conflict that came up. What times are available next week?",
      receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      priority: "normal",
      category: "appointment",
    },
  ];

  for (const inquiry of sampleInquiries) {
    inquiryStore.set(inquiry.id, inquiry);
  }

  const sampleProactiveMessages: ProactiveMessage[] = [
    {
      id: "proactive-1",
      patientId: "patient-1",
      patientName: "John Smith",
      type: "appointment_reminder",
      subject: "Upcoming Appointment Reminder",
      body: "Hello John, this is a friendly reminder that you have an appointment with Dr. Williams on January 22nd at 10:00 AM. Please arrive 15 minutes early to complete any paperwork.",
      personalizedContent: {
        greeting: "Hello John",
        mainMessage: "This is a friendly reminder that you have an appointment with Dr. Williams on January 22nd at 10:00 AM.",
        actionItems: ["Arrive 15 minutes early", "Bring your medication list", "Prepare any questions you may have"],
        encouragement: "We look forward to seeing you!",
      },
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      channel: "in_app",
      priority: "normal",
      relatedEntityId: "apt-123",
      status: "scheduled",
      createdAt: new Date().toISOString(),
    },
    {
      id: "proactive-2",
      patientId: "patient-2",
      patientName: "Sarah Johnson",
      type: "follow_up",
      subject: "How are you feeling after your visit?",
      body: "Hi Sarah, we wanted to check in with you after your recent visit. Your care team hopes you're feeling well and wanted to remind you about the lifestyle changes we discussed.",
      personalizedContent: {
        greeting: "Hi Sarah",
        mainMessage: "We wanted to check in with you after your recent visit with Dr. Patel.",
        actionItems: ["Continue monitoring your blood sugar as discussed", "Keep your food diary updated"],
        encouragement: "Your care team is here to support you on your health journey!",
      },
      scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      channel: "email",
      priority: "normal",
      status: "scheduled",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const msg of sampleProactiveMessages) {
    proactiveMessageStore.set(msg.id, msg);
  }

  console.log("[AIPatientCommunication] Initialized with sample data");
}

initializeSampleData();

export async function draftResponseToInquiry(
  inquiry: PatientInquiry,
  context: PatientContext
): Promise<AIResponseDraft> {
  if (!openai) {
    return generateFallbackDraft(inquiry, context);
  }
  
  try {
    const contextSummary = buildContextSummary(context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_COMMUNICATION_PROMPT },
        {
          role: "user",
          content: `Draft a personalized response to this patient inquiry.

PATIENT INQUIRY:
Subject: ${inquiry.subject}
Message: ${inquiry.message}
Category: ${inquiry.category}
Priority: ${inquiry.priority}

PATIENT CONTEXT:
${contextSummary}

Return a JSON object with:
{
  "subject": "Response subject line",
  "body": "Full response body (warm, personalized, references care plan where relevant)",
  "tone": "empathetic" | "informative" | "encouraging" | "professional",
  "referencedCarePlanGoals": ["Goals from care plan that are relevant to this inquiry"],
  "referencedAppointments": ["Upcoming appointments to mention if relevant"],
  "referencedMedications": ["Medications referenced if relevant"],
  "suggestedFollowUp": "Suggested next step or follow-up action",
  "suggestedActions": ["Action items for the care team"],
  "requiresProviderReview": boolean (true if medical question needs provider input),
  "reviewReason": "Reason why provider review is needed (if applicable)",
  "confidenceScore": number 0-100 (how confident in this response)
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const draft: AIResponseDraft = {
      id: `draft-${Date.now()}`,
      inquiryId: inquiry.id,
      patientId: inquiry.patientId,
      subject: ensureSafeContent(parsed.subject || `Re: ${inquiry.subject}`),
      body: ensureSafeContent(parsed.body || ""),
      personalizedElements: {
        patientName: context.patientName,
        referencedCarePlanGoals: parsed.referencedCarePlanGoals || [],
        referencedAppointments: parsed.referencedAppointments || [],
        referencedMedications: parsed.referencedMedications || [],
        suggestedFollowUp: parsed.suggestedFollowUp,
      },
      tone: parsed.tone || "professional",
      confidenceScore: parsed.confidenceScore || 70,
      suggestedActions: parsed.suggestedActions || [],
      requiresProviderReview: parsed.requiresProviderReview || inquiry.category === "symptoms" || inquiry.category === "medication",
      reviewReason: parsed.reviewReason,
      safetyDisclaimer: "This message is for informational purposes only. Please consult your healthcare provider for medical advice.",
      generatedAt: new Date().toISOString(),
      status: "draft",
    };

    responseDraftStore.set(draft.id, draft);
    return draft;
  } catch (error) {
    console.error("[AIPatientCommunication] Error drafting response:", error);
    return generateFallbackDraft(inquiry, context);
  }
}

export async function generateAppointmentReminder(
  patientId: string,
  patientName: string,
  appointment: UpcomingAppointment,
  context?: PatientContext
): Promise<ProactiveMessage> {
  if (!openai) {
    return generateFallbackReminder(patientId, patientName, appointment);
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_COMMUNICATION_PROMPT },
        {
          role: "user",
          content: `Generate a personalized appointment reminder message.

APPOINTMENT DETAILS:
Type: ${appointment.type}
Provider: ${appointment.provider}
Date/Time: ${appointment.scheduledDate}
Location: ${appointment.location || "To be confirmed"}
Instructions: ${appointment.instructions || "None specified"}

PATIENT: ${patientName}

Return a JSON object with:
{
  "subject": "Friendly subject line for the reminder",
  "greeting": "Personalized greeting",
  "mainMessage": "Main reminder content",
  "actionItems": ["Things patient may want to prepare or bring"],
  "encouragement": "Supportive closing message"
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const message: ProactiveMessage = {
      id: `reminder-${Date.now()}`,
      patientId,
      patientName,
      type: "appointment_reminder",
      subject: ensureSafeContent(parsed.subject || "Upcoming Appointment Reminder"),
      body: buildMessageBody(parsed),
      personalizedContent: {
        greeting: ensureSafeContent(parsed.greeting || `Hello ${patientName}`),
        mainMessage: ensureSafeContent(parsed.mainMessage || ""),
        actionItems: (parsed.actionItems || []).map(ensureSafeContent),
        encouragement: ensureSafeContent(parsed.encouragement || ""),
      },
      scheduledFor: calculateReminderTime(appointment.scheduledDate),
      channel: "in_app",
      priority: "normal",
      relatedEntityId: appointment.id,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    proactiveMessageStore.set(message.id, message);
    return message;
  } catch (error) {
    console.error("[AIPatientCommunication] Error generating reminder:", error);
    return generateFallbackReminder(patientId, patientName, appointment);
  }
}

export async function generateFollowUpMessage(
  patientId: string,
  patientName: string,
  context: PatientContext,
  followUpType: "post_visit" | "medication_check" | "wellness_check" | "goal_progress"
): Promise<ProactiveMessage> {
  if (!openai) {
    return generateFallbackFollowUp(patientId, patientName, followUpType);
  }
  
  try {
    const contextSummary = buildContextSummary(context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: HIPAA_SAFE_COMMUNICATION_PROMPT },
        {
          role: "user",
          content: `Generate a personalized follow-up message for a patient.

FOLLOW-UP TYPE: ${followUpType}
PATIENT: ${patientName}

PATIENT CONTEXT:
${contextSummary}

Return a JSON object with:
{
  "subject": "Caring subject line",
  "greeting": "Warm personalized greeting",
  "mainMessage": "Main follow-up content (reference recent interactions and care plan goals)",
  "actionItems": ["Gentle reminders or discussion topics for the patient"],
  "encouragement": "Supportive and motivating closing"
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const messageType = followUpType === "post_visit" ? "follow_up" : 
                        followUpType === "medication_check" ? "medication_reminder" : "check_in";

    const message: ProactiveMessage = {
      id: `followup-${Date.now()}`,
      patientId,
      patientName,
      type: messageType,
      subject: ensureSafeContent(parsed.subject || "Checking in with you"),
      body: buildMessageBody(parsed),
      personalizedContent: {
        greeting: ensureSafeContent(parsed.greeting || `Hello ${patientName}`),
        mainMessage: ensureSafeContent(parsed.mainMessage || ""),
        actionItems: (parsed.actionItems || []).map(ensureSafeContent),
        encouragement: ensureSafeContent(parsed.encouragement || ""),
      },
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      channel: "in_app",
      priority: "normal",
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    proactiveMessageStore.set(message.id, message);
    return message;
  } catch (error) {
    console.error("[AIPatientCommunication] Error generating follow-up:", error);
    return generateFallbackFollowUp(patientId, patientName, followUpType);
  }
}

function buildContextSummary(context: PatientContext): string {
  let summary = `Patient: ${context.patientName}\n`;
  
  if (context.carePlan) {
    summary += `\nCare Plan: ${context.carePlan.title || "Active care plan"}\n`;
    if (context.carePlan.goals && context.carePlan.goals.length > 0) {
      summary += `Goals: ${context.carePlan.goals.map(g => g.description).join(", ")}\n`;
    }
  }
  
  if (context.recentInteractions.length > 0) {
    summary += `\nRecent Interactions:\n`;
    for (const interaction of context.recentInteractions.slice(0, 3)) {
      summary += `- ${interaction.type}: ${interaction.summary} (${interaction.date})\n`;
    }
  }
  
  if (context.upcomingAppointments.length > 0) {
    summary += `\nUpcoming Appointments:\n`;
    for (const apt of context.upcomingAppointments.slice(0, 2)) {
      summary += `- ${apt.type} with ${apt.provider} on ${apt.scheduledDate}\n`;
    }
  }
  
  if (context.activeMedications.length > 0) {
    summary += `\nActive Medications: ${context.activeMedications.map(m => m.name).join(", ")}\n`;
  }
  
  return summary;
}

function buildMessageBody(parsed: any): string {
  let body = parsed.greeting || "";
  body += "\n\n" + (parsed.mainMessage || "");
  
  if (parsed.actionItems && parsed.actionItems.length > 0) {
    body += "\n\nHere are some things to keep in mind:\n";
    for (const item of parsed.actionItems) {
      body += `- ${item}\n`;
    }
  }
  
  if (parsed.encouragement) {
    body += "\n" + parsed.encouragement;
  }
  
  return ensureSafeContent(body);
}

function ensureSafeContent(text: string): string {
  if (!text) return text;
  
  const unsafePatterns = [
    { pattern: /\byou\s+should\b/gi, replacement: "you may consider discussing with your provider" },
    { pattern: /\bwe\s+recommend\b/gi, replacement: "your care team notes" },
    { pattern: /\btake\s+your\s+medication\b/gi, replacement: "continue as directed by your provider" },
    { pattern: /\bmust\b/gi, replacement: "may" },
    { pattern: /\badvise\b/gi, replacement: "note" },
    { pattern: /\bprescribe\b/gi, replacement: "discuss" },
    { pattern: /\bdiagnose\b/gi, replacement: "identify" },
    { pattern: /\btreat\b/gi, replacement: "address" },
    { pattern: /\bindicates\b/gi, replacement: "shows" },
    { pattern: /\bdescribes\b/gi, replacement: "states" },
    { pattern: /\bexplains\b/gi, replacement: "means" },
  ];
  
  let safeText = text;
  for (const { pattern, replacement } of unsafePatterns) {
    safeText = safeText.replace(pattern, replacement);
  }
  return safeText;
}

function calculateReminderTime(appointmentDate: string): string {
  const apt = new Date(appointmentDate);
  apt.setDate(apt.getDate() - 1);
  apt.setHours(9, 0, 0, 0);
  return apt.toISOString();
}

function generateFallbackDraft(inquiry: PatientInquiry, context: PatientContext): AIResponseDraft {
  return {
    id: `draft-${Date.now()}`,
    inquiryId: inquiry.id,
    patientId: inquiry.patientId,
    subject: `Re: ${inquiry.subject}`,
    body: `Dear ${context.patientName},\n\nThank you for reaching out to us. We have received your message and a member of our care team will review it and respond shortly.\n\nIf you have an urgent medical concern, please contact your healthcare provider directly or seek emergency care.\n\nWarm regards,\nYour Care Team`,
    personalizedElements: {
      patientName: context.patientName,
    },
    tone: "professional",
    confidenceScore: 50,
    suggestedActions: ["Review and personalize response", "Check patient history"],
    requiresProviderReview: true,
    reviewReason: "Fallback response - AI generation unavailable",
    safetyDisclaimer: "This message is for informational purposes only. Please consult your healthcare provider for medical advice.",
    generatedAt: new Date().toISOString(),
    status: "draft",
  };
}

function generateFallbackReminder(patientId: string, patientName: string, appointment: UpcomingAppointment): ProactiveMessage {
  return {
    id: `reminder-${Date.now()}`,
    patientId,
    patientName,
    type: "appointment_reminder",
    subject: "Upcoming Appointment Reminder",
    body: `Hello ${patientName},\n\nThis is a friendly reminder about your upcoming appointment:\n\nType: ${appointment.type}\nProvider: ${appointment.provider}\nDate: ${appointment.scheduledDate}\n${appointment.location ? `Location: ${appointment.location}` : ""}\n\nPlease arrive 15 minutes early. If you need to reschedule, please contact us as soon as possible.\n\nWarm regards,\nYour Care Team`,
    personalizedContent: {
      greeting: `Hello ${patientName}`,
      mainMessage: `This is a friendly reminder about your upcoming ${appointment.type} appointment.`,
      actionItems: ["Arrive 15 minutes early", "Bring your current medication list"],
      encouragement: "We look forward to seeing you!",
    },
    scheduledFor: calculateReminderTime(appointment.scheduledDate),
    channel: "in_app",
    priority: "normal",
    relatedEntityId: appointment.id,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
}

function generateFallbackFollowUp(patientId: string, patientName: string, type: string): ProactiveMessage {
  return {
    id: `followup-${Date.now()}`,
    patientId,
    patientName,
    type: "follow_up",
    subject: "Checking in with you",
    body: `Hello ${patientName},\n\nWe wanted to check in and see how you're doing. Your health and well-being are important to us.\n\nIf you have any questions or concerns, please don't hesitate to reach out to your care team.\n\nWarm regards,\nYour Care Team`,
    personalizedContent: {
      greeting: `Hello ${patientName}`,
      mainMessage: "We wanted to check in and see how you're doing.",
      encouragement: "Your health and well-being are important to us!",
    },
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    channel: "in_app",
    priority: "normal",
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
}

export function getAllInquiries(): PatientInquiry[] {
  return Array.from(inquiryStore.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}

export function getInquiryById(id: string): PatientInquiry | undefined {
  return inquiryStore.get(id);
}

export function getAllResponseDrafts(): AIResponseDraft[] {
  return Array.from(responseDraftStore.values()).sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

export function getResponseDraftById(id: string): AIResponseDraft | undefined {
  return responseDraftStore.get(id);
}

export function approveResponseDraft(id: string, approvedBy: string): AIResponseDraft | undefined {
  const draft = responseDraftStore.get(id);
  if (draft) {
    draft.status = "approved";
    draft.approvedBy = approvedBy;
    draft.approvedAt = new Date().toISOString();
    responseDraftStore.set(id, draft);
  }
  return draft;
}

export function rejectResponseDraft(id: string, reason: string): AIResponseDraft | undefined {
  const draft = responseDraftStore.get(id);
  if (draft) {
    draft.status = "rejected";
    draft.reviewReason = reason;
    responseDraftStore.set(id, draft);
  }
  return draft;
}

export function getAllProactiveMessages(): ProactiveMessage[] {
  return Array.from(proactiveMessageStore.values()).sort(
    (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
  );
}

export function getProactiveMessageById(id: string): ProactiveMessage | undefined {
  return proactiveMessageStore.get(id);
}

export function cancelProactiveMessage(id: string): ProactiveMessage | undefined {
  const message = proactiveMessageStore.get(id);
  if (message && message.status === "scheduled") {
    message.status = "cancelled";
    proactiveMessageStore.set(id, message);
  }
  return message;
}

export function sendProactiveMessage(id: string): ProactiveMessage | undefined {
  const message = proactiveMessageStore.get(id);
  if (message && (message.status === "scheduled" || message.status === "sent")) {
    message.status = "sent";
    proactiveMessageStore.set(id, message);
  }
  return message;
}

export function getProactiveMessageStats(): {
  total: number;
  scheduled: number;
  sent: number;
  delivered: number;
  cancelled: number;
  byType: Record<string, number>;
} {
  const messages = Array.from(proactiveMessageStore.values());
  const byType: Record<string, number> = {};
  
  for (const msg of messages) {
    byType[msg.type] = (byType[msg.type] || 0) + 1;
  }
  
  return {
    total: messages.length,
    scheduled: messages.filter(m => m.status === "scheduled").length,
    sent: messages.filter(m => m.status === "sent").length,
    delivered: messages.filter(m => m.status === "delivered").length,
    cancelled: messages.filter(m => m.status === "cancelled").length,
    byType,
  };
}

export async function triagePatientMessage(inquiry: PatientInquiry): Promise<TriageResult> {
  const openaiClient = openai;
  
  if (!openaiClient) {
    return generateFallbackTriage(inquiry);
  }
  
  try {
    const departmentInfo = departments.map(d => `${d.code}: ${d.name} - ${d.description}`).join("\n");
    
    const response = await openaiClient.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a healthcare message triage assistant. Your role is to analyze patient messages and route them to the appropriate department and staff member.

CRITICAL RULES:
- This is for routing purposes ONLY, not clinical decision making
- Always err on the side of caution for urgent or symptom-related messages
- Route symptom-related messages to Nursing Triage (RN)
- Never provide medical advice in the triage notes

AVAILABLE DEPARTMENTS:
${departmentInfo}`,
        },
        {
          role: "user",
          content: `Analyze and triage this patient message:

PATIENT: ${inquiry.patientName} (ID: ${inquiry.patientId})
SUBJECT: ${inquiry.subject}
MESSAGE: ${inquiry.message}
CURRENT CATEGORY: ${inquiry.category}
CURRENT PRIORITY: ${inquiry.priority}

Return a JSON object with:
{
  "urgencyLevel": "low" | "normal" | "high" | "urgent" | "critical",
  "departmentCode": "Code of the best department to handle this",
  "assignedRole": "Type of staff member best suited (e.g., 'RN', 'Pharmacist', 'Scheduler', 'Billing Specialist')",
  "escalationRequired": boolean,
  "escalationReason": "Reason if escalation is needed",
  "keyTopics": ["Main topics in the message"],
  "sentiment": "positive" | "neutral" | "concerned" | "frustrated" | "distressed",
  "suggestedResponseTime": "Recommended response timeframe",
  "triageNotes": ["Important notes for the person handling this message"],
  "confidence": number 0-100
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const dept = departments.find(d => d.code === parsed.departmentCode) || departments[0];

    const triageResult: TriageResult = {
      id: `triage-${Date.now()}`,
      inquiryId: inquiry.id,
      patientId: inquiry.patientId,
      patientName: inquiry.patientName,
      originalMessage: inquiry.message,
      category: inquiry.category,
      urgencyLevel: parsed.urgencyLevel || "normal",
      routingDecision: {
        department: dept.name,
        departmentCode: dept.code,
        assignedRole: parsed.assignedRole || "Care Team Member",
        escalationRequired: parsed.escalationRequired || false,
        escalationReason: parsed.escalationReason,
      },
      keyTopics: parsed.keyTopics || [],
      sentiment: parsed.sentiment || "neutral",
      suggestedResponseTime: parsed.suggestedResponseTime || dept.avgResponseTime,
      aiConfidence: parsed.confidence || 75,
      triageNotes: parsed.triageNotes || [],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    triageStore.set(triageResult.id, triageResult);
    return triageResult;
  } catch (error) {
    console.error("[AIPatientCommunication] Error triaging message:", error);
    return generateFallbackTriage(inquiry);
  }
}

function generateFallbackTriage(inquiry: PatientInquiry): TriageResult {
  const categoryToDept: Record<string, string> = {
    medication: "PHARM",
    appointment: "SCHED",
    symptoms: "RN",
    billing: "BILLING",
    records: "HIM",
    general: "PCP",
    other: "PCP",
  };

  const deptCode = categoryToDept[inquiry.category] || "PCP";
  const dept = departments.find(d => d.code === deptCode) || departments[0];

  const triageResult: TriageResult = {
    id: `triage-${Date.now()}`,
    inquiryId: inquiry.id,
    patientId: inquiry.patientId,
    patientName: inquiry.patientName,
    originalMessage: inquiry.message,
    category: inquiry.category,
    urgencyLevel: inquiry.priority === "urgent" ? "urgent" : inquiry.priority === "high" ? "high" : "normal",
    routingDecision: {
      department: dept.name,
      departmentCode: dept.code,
      assignedRole: "Care Team Member",
      escalationRequired: inquiry.priority === "urgent",
      escalationReason: inquiry.priority === "urgent" ? "Urgent priority requires immediate attention" : undefined,
    },
    keyTopics: [inquiry.category],
    sentiment: "neutral",
    suggestedResponseTime: dept.avgResponseTime,
    aiConfidence: 60,
    triageNotes: ["Fallback triage - AI analysis unavailable", "Manual review recommended"],
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  triageStore.set(triageResult.id, triageResult);
  return triageResult;
}

export function getAllTriages(): TriageResult[] {
  return Array.from(triageStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTriageById(id: string): TriageResult | undefined {
  return triageStore.get(id);
}

export function updateTriageStatus(id: string, status: TriageResult["status"]): TriageResult | undefined {
  const triage = triageStore.get(id);
  if (triage) {
    triage.status = status;
    triageStore.set(id, triage);
  }
  return triage;
}

export function getDepartments(): Department[] {
  return departments;
}

export function getCommunicationDashboard(): CommunicationAssistantDashboard {
  const inquiries = getAllInquiries();
  const drafts = getAllResponseDrafts();
  const messages = getAllProactiveMessages();
  const triages = getAllTriages();

  return {
    stats: {
      pendingInquiries: inquiries.length,
      draftedResponses: drafts.filter(d => d.status === "draft").length,
      scheduledMessages: messages.filter(m => m.status === "scheduled").length,
      triageQueue: triages.filter(t => t.status === "pending").length,
      avgResponseTime: "2.5 hours",
      aiDraftAccuracy: 87,
    },
    recentInquiries: inquiries.slice(0, 5),
    recentDrafts: drafts.slice(0, 5),
    recentTriages: triages.slice(0, 5),
    upcomingMessages: messages.filter(m => m.status === "scheduled").slice(0, 5),
    departments,
  };
}

function initializeSampleTriages(): void {
  const sampleTriages: TriageResult[] = [
    {
      id: "triage-1",
      inquiryId: "inq-1",
      patientId: "patient-1",
      patientName: "John Smith",
      originalMessage: "I wanted to check if I should take my blood pressure medication in the morning or evening.",
      category: "medication",
      urgencyLevel: "normal",
      routingDecision: {
        department: "Pharmacy Services",
        departmentCode: "PHARM",
        assignedRole: "Clinical Pharmacist",
        escalationRequired: false,
      },
      keyTopics: ["blood pressure medication", "dosing schedule", "side effects"],
      sentiment: "concerned",
      suggestedResponseTime: "2 hours",
      aiConfidence: 89,
      triageNotes: [
        "Patient reports dizziness - may be timing-related",
        "Recommend pharmacist consultation on optimal dosing time",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: "routed",
    },
    {
      id: "triage-2",
      inquiryId: "inq-2",
      patientId: "patient-2",
      patientName: "Sarah Johnson",
      originalMessage: "I received a notification that my lab results are ready. Could someone explain what my A1C results mean?",
      category: "records",
      urgencyLevel: "normal",
      routingDecision: {
        department: "Primary Care",
        departmentCode: "PCP",
        assignedRole: "Care Coordinator",
        escalationRequired: false,
      },
      keyTopics: ["lab results", "A1C", "diabetes management"],
      sentiment: "neutral",
      suggestedResponseTime: "4 hours",
      aiConfidence: 92,
      triageNotes: [
        "Patient seeking education on lab results",
        "May benefit from diabetes education resources",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    },
    {
      id: "triage-3",
      inquiryId: "inq-3",
      patientId: "patient-3",
      patientName: "Michael Chen",
      originalMessage: "I need to reschedule my upcoming appointment on the 25th.",
      category: "appointment",
      urgencyLevel: "low",
      routingDecision: {
        department: "Scheduling",
        departmentCode: "SCHED",
        assignedRole: "Scheduler",
        escalationRequired: false,
      },
      keyTopics: ["appointment", "rescheduling"],
      sentiment: "neutral",
      suggestedResponseTime: "1 hour",
      aiConfidence: 95,
      triageNotes: [
        "Standard rescheduling request",
        "Check availability for next week",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    },
  ];

  for (const triage of sampleTriages) {
    triageStore.set(triage.id, triage);
  }
}

initializeSampleTriages();

console.log("[AIPatientCommunication] Enhanced with triage and routing capabilities");
