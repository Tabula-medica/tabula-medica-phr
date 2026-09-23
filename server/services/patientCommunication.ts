import { generatePhiSafeText } from "./ai-gateway";
import { randomUUID } from "crypto";
import type {
  PatientCommunication,
  CommunicationTemplate,
  CommunicationRule,
  PatientQueryResponse,
  CommunicationType,
  CommunicationChannel,
  CommunicationPriority,
  InsertPatientCommunication,
  InsertPatientQueryResponse,
} from "@shared/schema";
import { storage } from "../storage";

const communications: Map<string, PatientCommunication> = new Map();
const templates: Map<string, CommunicationTemplate> = new Map();
const rules: Map<string, CommunicationRule> = new Map();
const queryResponses: Map<string, PatientQueryResponse> = new Map();

initializeDefaultTemplates();

function initializeDefaultTemplates() {
  const defaultTemplates: Omit<CommunicationTemplate, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "Post-Encounter Follow-Up",
      description: "Personalized message sent after a healthcare visit",
      communicationType: "post_encounter_summary",
      channel: "in_app",
      subject: "Thank you for your visit - Here's your summary",
      bodyTemplate: "Dear {{patientName}}, thank you for visiting {{providerName}} on {{encounterDate}}. {{aiSummary}} If you have any questions, please don't hesitate to reach out.",
      variables: ["patientName", "providerName", "encounterDate", "aiSummary"],
      isActive: true,
      createdBy: "system",
    },
    {
      name: "Appointment Reminder",
      description: "Reminder sent before scheduled appointments",
      communicationType: "appointment_reminder",
      channel: "in_app",
      subject: "Reminder: Upcoming appointment on {{appointmentDate}}",
      bodyTemplate: "Hi {{patientName}}, this is a reminder about your upcoming appointment with {{providerName}} on {{appointmentDate}} at {{appointmentTime}}. {{aiPersonalization}}",
      variables: ["patientName", "providerName", "appointmentDate", "appointmentTime", "aiPersonalization"],
      isActive: true,
      createdBy: "system",
    },
    {
      name: "Overdue Screening Alert",
      description: "Alert for patients with overdue preventive screenings",
      communicationType: "screening_reminder",
      channel: "in_app",
      subject: "Important: {{screeningName}} is due",
      bodyTemplate: "Dear {{patientName}}, our records show that you may be due for {{screeningName}}. {{aiRationale}} Please schedule an appointment at your earliest convenience.",
      variables: ["patientName", "screeningName", "aiRationale"],
      isActive: true,
      createdBy: "system",
    },
    {
      name: "RPM Data Review Alert",
      description: "Message sent after reviewing remote patient monitoring data",
      communicationType: "rpm_alert",
      channel: "in_app",
      subject: "Your health data has been reviewed",
      bodyTemplate: "Hi {{patientName}}, your healthcare team has reviewed your recent health readings. {{aiAnalysis}} {{recommendations}}",
      variables: ["patientName", "aiAnalysis", "recommendations"],
      isActive: true,
      createdBy: "system",
    },
    {
      name: "Medication Reminder",
      description: "Reminder for medication adherence",
      communicationType: "medication_reminder",
      channel: "in_app",
      subject: "Medication Reminder",
      bodyTemplate: "Hi {{patientName}}, this is a friendly reminder about your medication {{medicationName}}. {{aiTips}}",
      variables: ["patientName", "medicationName", "aiTips"],
      isActive: true,
      createdBy: "system",
    },
  ];

  defaultTemplates.forEach((t) => {
    const id = randomUUID();
    templates.set(id, {
      ...t,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

async function getPatientContext(patientId: string) {
  const [patient, records, medications, appointments, labResults] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
    storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
  ]);

  const conditions = records.filter((r) => r.type === "diagnosis" && r.status === "active");
  const patientAppointments = appointments.filter((a) => a.patientId === patientId);
  const upcomingAppointments = patientAppointments
    .filter((a) => a.status === "scheduled" && new Date(a.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return {
    patient,
    conditions,
    medications: medications.filter((m) => m.status === "active"),
    upcomingAppointments,
    recentAppointments: patientAppointments
      .filter((a) => a.status === "completed")
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 5),
    labResults: labResults.slice(0, 10),
  };
}

export async function generateFollowUpMessage(
  patientId: string,
  encounterId: string,
  encounterDetails: {
    date: string;
    providerName: string;
    reason?: string;
    diagnoses?: string[];
    instructions?: string[];
  }
): Promise<{ content: string; confidence: number }> {
  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";

  const prompt = `Generate a warm, personalized follow-up message for a patient after their healthcare visit.

Patient Context:
- Name: ${patientName}
- Active Conditions: ${context.conditions.map((c) => c.title).join(", ") || "None documented"}
- Current Medications: ${context.medications.map((m) => m.name).join(", ") || "None documented"}

Encounter Details:
- Date: ${encounterDetails.date}
- Provider: ${encounterDetails.providerName}
- Reason: ${encounterDetails.reason || "General visit"}
- Diagnoses: ${encounterDetails.diagnoses?.join(", ") || "None specified"}
- Instructions: ${encounterDetails.instructions?.join("; ") || "None specified"}

Generate a caring, professional follow-up message that:
1. Thanks the patient for their visit
2. Summarizes key takeaways in plain language
3. Reminds them of any important instructions
4. Encourages them to reach out with questions
5. Is warm but professional, around 100-150 words

Important: Do NOT provide medical advice. Only summarize what was discussed and encourage follow-up with their provider for questions.`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a healthcare communication assistant that generates personalized, empathetic patient messages. Always maintain HIPAA compliance and never provide medical advice.",
      user: prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    return {
      content: responseText || "Thank you for your recent visit. If you have any questions, please contact your healthcare provider.",
      confidence: 0.85,
    };
  } catch (error) {
    console.error("[PatientCommunication] Error generating follow-up message:", error);
    return {
      content: `Dear ${patientName}, thank you for your visit with ${encounterDetails.providerName} on ${encounterDetails.date}. If you have any questions about your visit, please don't hesitate to contact our office.`,
      confidence: 0.5,
    };
  }
}

export async function generateAppointmentReminder(
  patientId: string,
  appointment: {
    date: string;
    time: string;
    providerName: string;
    reason?: string;
    location?: string;
  }
): Promise<{ content: string; confidence: number }> {
  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";

  const prompt = `Generate a friendly appointment reminder for a patient.

Patient: ${patientName}
Appointment Details:
- Date: ${appointment.date}
- Time: ${appointment.time}
- Provider: ${appointment.providerName}
- Reason: ${appointment.reason || "Scheduled visit"}
- Location: ${appointment.location || "Main office"}

Patient's Current Medications: ${context.medications.map((m) => m.name).slice(0, 5).join(", ") || "None documented"}

Generate a brief, friendly reminder (50-80 words) that:
1. Confirms the appointment details
2. If applicable, reminds them to bring their medications list
3. Suggests arriving 10-15 minutes early
4. Has a warm, helpful tone`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a healthcare scheduling assistant. Generate friendly, concise appointment reminders.",
      user: prompt,
      temperature: 0.6,
      maxTokens: 200,
    });

    return {
      content: responseText || `Reminder: You have an appointment with ${appointment.providerName} on ${appointment.date} at ${appointment.time}.`,
      confidence: 0.9,
    };
  } catch (error) {
    console.error("[PatientCommunication] Error generating appointment reminder:", error);
    return {
      content: `Hi ${patientName}, this is a reminder about your upcoming appointment with ${appointment.providerName} on ${appointment.date} at ${appointment.time}. Please arrive 15 minutes early.`,
      confidence: 0.5,
    };
  }
}

export async function generateScreeningReminder(
  patientId: string,
  screening: {
    name: string;
    lastDate?: string;
    dueDate?: string;
    importance: string;
  }
): Promise<{ content: string; confidence: number }> {
  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";
  const patientAge = context.patient?.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const prompt = `Generate a caring message about an overdue preventive screening.

Patient: ${patientName}${patientAge ? `, Age: ${patientAge}` : ""}
Screening: ${screening.name}
Last Performed: ${screening.lastDate || "Not on record"}
Due/Overdue Since: ${screening.dueDate || "Based on guidelines"}
Why It's Important: ${screening.importance}

Patient's Active Conditions: ${context.conditions.map((c) => c.title).join(", ") || "None documented"}

Generate a gentle, non-alarming message (80-120 words) that:
1. Explains the screening in simple terms
2. Mentions why it's recommended for them
3. Emphasizes it's preventive/routine, not emergency
4. Encourages scheduling at their convenience
5. Is supportive, not preachy

Do NOT diagnose or suggest the patient has any condition.`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a preventive care communication assistant. Generate supportive messages about routine screenings without causing anxiety.",
      user: prompt,
      temperature: 0.7,
      maxTokens: 300,
    });

    return {
      content: responseText || `Dear ${patientName}, our records indicate you may be due for ${screening.name}. This routine screening helps maintain your health. Please contact us to schedule.`,
      confidence: 0.85,
    };
  } catch (error) {
    console.error("[PatientCommunication] Error generating screening reminder:", error);
    return {
      content: `Dear ${patientName}, as part of your preventive care, you may be due for ${screening.name}. Please contact our office to schedule this routine screening at your convenience.`,
      confidence: 0.5,
    };
  }
}

export async function generateRpmReviewMessage(
  patientId: string,
  rpmData: {
    deviceType: string;
    readings: { type: string; value: string; date: string; status: "normal" | "elevated" | "low" | "critical" }[];
    trend?: string;
  }
): Promise<{ content: string; recommendations: string[]; confidence: number }> {
  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";

  const prompt = `Generate a patient-friendly message summarizing their remote monitoring data review.

Patient: ${patientName}
Device Type: ${rpmData.deviceType}
Recent Readings:
${rpmData.readings.map((r) => `- ${r.type}: ${r.value} (${r.date}) - ${r.status}`).join("\n")}
${rpmData.trend ? `Overall Trend: ${rpmData.trend}` : ""}

Patient's Relevant Conditions: ${context.conditions.map((c) => c.title).join(", ") || "None documented"}
Current Medications: ${context.medications.map((m) => m.name).slice(0, 5).join(", ") || "None documented"}

Generate:
1. A warm, reassuring message (80-120 words) summarizing the data review
2. 2-3 simple, actionable recommendations

Format as JSON:
{
  "message": "...",
  "recommendations": ["...", "..."]
}

Important:
- Do NOT diagnose or provide medical advice
- If readings are concerning, encourage contacting their provider
- Keep the tone supportive and educational`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a remote patient monitoring communication assistant. Generate supportive summaries of health data. Always respond in valid JSON format.",
      user: prompt,
      temperature: 0.6,
      maxTokens: 400,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(responseText || "{}");
    return {
      content: result.message || `Hi ${patientName}, your recent health readings have been reviewed by your care team.`,
      recommendations: result.recommendations || [],
      confidence: 0.85,
    };
  } catch (error) {
    console.error("[PatientCommunication] Error generating RPM review message:", error);
    return {
      content: `Hi ${patientName}, your care team has reviewed your recent ${rpmData.deviceType} readings. If you have any questions about your readings, please contact your healthcare provider.`,
      recommendations: ["Continue monitoring as directed", "Contact your provider if you notice significant changes"],
      confidence: 0.5,
    };
  }
}

export async function generateQueryResponse(
  patientId: string,
  query: string
): Promise<PatientQueryResponse> {
  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";

  const prompt = `Answer a patient's health-related question based on their medical record context.

Patient: ${patientName}
Active Conditions: ${context.conditions.map((c) => c.title).join(", ") || "None documented"}
Current Medications: ${context.medications.map((m) => `${m.name} (${m.dosage})`).join(", ") || "None documented"}
Recent Lab Results: ${context.labResults?.slice(0, 5).map((l) => `${l.testName}: ${l.value}`).join(", ") || "None recent"}
Upcoming Appointments: ${context.upcomingAppointments.slice(0, 3).map((a) => `${a.type} on ${new Date(a.scheduledAt).toLocaleDateString()}`).join(", ") || "None scheduled"}

Patient's Question: "${query}"

Provide a helpful response as JSON:
{
  "response": "Your answer here (educational, supportive, 100-200 words)",
  "queryCategory": "medication|condition|appointment|lab_result|general|lifestyle|symptom",
  "confidence": 0.0-1.0,
  "reasoningSteps": ["Step 1", "Step 2"],
  "requiresFollowUp": true/false,
  "followUpReason": "If follow-up needed, why"
}

Important Guidelines:
- Provide educational information only, NOT medical advice
- Reference their specific records when relevant
- If the question requires medical judgment, advise them to consult their provider
- Be warm, supportive, and clear
- If you cannot answer safely, acknowledge limitations`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a patient health assistant that answers questions based on their medical records. Never provide medical diagnoses or treatment recommendations. Always encourage consulting their healthcare provider for medical decisions. Respond in valid JSON.",
      user: prompt,
      temperature: 0.7,
      maxTokens: 600,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(responseText || "{}");
    
    const queryResponse: PatientQueryResponse = {
      id: randomUUID(),
      patientId,
      query,
      queryCategory: result.queryCategory || "general",
      aiResponse: result.response || "I apologize, but I couldn't generate a response. Please contact your healthcare provider for assistance.",
      aiConfidence: result.confidence || 0.5,
      aiReasoningSteps: result.reasoningSteps,
      requiresFollowUp: result.requiresFollowUp || false,
      respondedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    queryResponses.set(queryResponse.id, queryResponse);
    return queryResponse;
  } catch (error) {
    console.error("[PatientCommunication] Error generating query response:", error);
    const fallbackResponse: PatientQueryResponse = {
      id: randomUUID(),
      patientId,
      query,
      queryCategory: "general",
      aiResponse: "I apologize, but I'm having trouble answering your question right now. For the best assistance, please contact your healthcare provider directly or call our office.",
      aiConfidence: 0.3,
      requiresFollowUp: true,
      respondedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    queryResponses.set(fallbackResponse.id, fallbackResponse);
    return fallbackResponse;
  }
}

export async function createCommunication(data: InsertPatientCommunication): Promise<PatientCommunication> {
  const communication: PatientCommunication = {
    ...data,
    id: randomUUID(),
    status: data.status || "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  communications.set(communication.id, communication);
  return communication;
}

export function getCommunication(id: string): PatientCommunication | undefined {
  return communications.get(id);
}

export function getCommunicationsByPatient(patientId: string): PatientCommunication[] {
  return Array.from(communications.values())
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllCommunications(filters?: {
  status?: string;
  type?: string;
  channel?: string;
}): PatientCommunication[] {
  let result = Array.from(communications.values());
  
  if (filters?.status) {
    result = result.filter((c) => c.status === filters.status);
  }
  if (filters?.type) {
    result = result.filter((c) => c.communicationType === filters.type);
  }
  if (filters?.channel) {
    result = result.filter((c) => c.channel === filters.channel);
  }
  
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateCommunicationStatus(
  id: string,
  status: PatientCommunication["status"],
  details?: { sentAt?: string; deliveredAt?: string; failedAt?: string; failureReason?: string }
): PatientCommunication | undefined {
  const communication = communications.get(id);
  if (!communication) return undefined;

  const updated = {
    ...communication,
    status,
    ...details,
    updatedAt: new Date().toISOString(),
  };
  communications.set(id, updated);
  return updated;
}

export function getTemplates(): CommunicationTemplate[] {
  return Array.from(templates.values());
}

export function getTemplate(id: string): CommunicationTemplate | undefined {
  return templates.get(id);
}

export function createTemplate(data: Omit<CommunicationTemplate, "id" | "createdAt" | "updatedAt">): CommunicationTemplate {
  const template: CommunicationTemplate = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  templates.set(template.id, template);
  return template;
}

export function getQueryResponses(patientId: string): PatientQueryResponse[] {
  return Array.from(queryResponses.values())
    .filter((r) => r.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateQueryFeedback(
  id: string,
  wasHelpful: boolean,
  feedback?: string
): PatientQueryResponse | undefined {
  const response = queryResponses.get(id);
  if (!response) return undefined;

  const updated = {
    ...response,
    wasHelpful,
    patientFeedback: feedback,
  };
  queryResponses.set(id, updated);
  return updated;
}

export async function triggerAutomatedCommunications(
  eventType: string,
  eventData: Record<string, unknown>
): Promise<PatientCommunication[]> {
  const triggered: PatientCommunication[] = [];
  const patientId = eventData.patientId as string;

  if (!patientId) return triggered;

  switch (eventType) {
    case "encounter_completed": {
      const message = await generateFollowUpMessage(patientId, eventData.encounterId as string, {
        date: eventData.date as string,
        providerName: eventData.providerName as string,
        reason: eventData.reason as string,
        diagnoses: eventData.diagnoses as string[],
        instructions: eventData.instructions as string[],
      });

      const comm = await createCommunication({
        patientId,
        communicationType: "post_encounter_summary",
        channel: "in_app",
        priority: "normal",
        subject: "Thank you for your visit",
        content: message.content,
        aiGeneratedContent: message.content,
        aiConfidence: message.confidence,
        triggerType: "event_based",
        triggerEventType: eventType,
        triggerEventId: eventData.encounterId as string,
        status: "pending",
      });
      triggered.push(comm);
      break;
    }

    case "rpm_data_reviewed": {
      const message = await generateRpmReviewMessage(patientId, {
        deviceType: eventData.deviceType as string,
        readings: eventData.readings as any[],
        trend: eventData.trend as string,
      });

      const comm = await createCommunication({
        patientId,
        communicationType: "rpm_alert",
        channel: "in_app",
        priority: eventData.priority as CommunicationPriority || "normal",
        subject: "Your health data has been reviewed",
        content: `${message.content}\n\nRecommendations:\n${message.recommendations.map((r) => `- ${r}`).join("\n")}`,
        aiGeneratedContent: message.content,
        aiConfidence: message.confidence,
        triggerType: "event_based",
        triggerEventType: eventType,
        status: "pending",
      });
      triggered.push(comm);
      break;
    }

    case "appointment_upcoming": {
      const message = await generateAppointmentReminder(patientId, {
        date: eventData.date as string,
        time: eventData.time as string,
        providerName: eventData.providerName as string,
        reason: eventData.reason as string,
        location: eventData.location as string,
      });

      const comm = await createCommunication({
        patientId,
        communicationType: "appointment_reminder",
        channel: "in_app",
        priority: "normal",
        subject: `Reminder: Appointment on ${eventData.date}`,
        content: message.content,
        aiGeneratedContent: message.content,
        aiConfidence: message.confidence,
        triggerType: "event_based",
        triggerEventType: eventType,
        triggerEventId: eventData.appointmentId as string,
        status: "pending",
      });
      triggered.push(comm);
      break;
    }

    case "screening_overdue": {
      const message = await generateScreeningReminder(patientId, {
        name: eventData.screeningName as string,
        lastDate: eventData.lastDate as string,
        dueDate: eventData.dueDate as string,
        importance: eventData.importance as string,
      });

      const comm = await createCommunication({
        patientId,
        communicationType: "screening_reminder",
        channel: "in_app",
        priority: "normal",
        subject: `${eventData.screeningName} screening reminder`,
        content: message.content,
        aiGeneratedContent: message.content,
        aiConfidence: message.confidence,
        triggerType: "event_based",
        triggerEventType: eventType,
        status: "pending",
      });
      triggered.push(comm);
      break;
    }
  }

  return triggered;
}
