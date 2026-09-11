import { randomUUID } from "crypto";
import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";
import type {
  OutreachCampaign,
  InsertOutreachCampaign,
  ScheduledCheckIn,
  InsertScheduledCheckIn,
  CheckInResponse,
  InsertCheckInResponse,
  OutreachTemplate,
  InsertOutreachTemplate,
  CheckInQuestion,
  Patient,
} from "@shared/schema";
import { generatePhiSafeText } from "./ai-gateway";

const SAFE_VERBS = ["shows", "states", "refers to", "means"];

function enforceSafeVerbs(text: string): string {
  if (!text) return text;
  let result = text;
  const unsafePatterns = [
    { pattern: /\b(recommend|recommends|recommended|recommending)\b/gi, replacement: "records show" },
    { pattern: /\b(suggest|suggests|suggested|suggesting)\b/gi, replacement: "records state" },
    { pattern: /\b(advise|advises|advised|advising)\b/gi, replacement: "records refer to" },
    { pattern: /\b(indicate|indicates|indicated|indicating)\b/gi, replacement: "records show" },
    { pattern: /\b(should|must|need to|have to|ought to)\b/gi, replacement: "records show" },
    { pattern: /\b(consider|considers|considered|considering)\b/gi, replacement: "records refer to" },
    { pattern: /\b(demonstrates|demonstrate|demonstrated)\b/gi, replacement: "shows" },
    { pattern: /\b(reveals|reveal|revealed)\b/gi, replacement: "shows" },
    { pattern: /\b(confirms|confirm|confirmed)\b/gi, replacement: "shows" },
    { pattern: /\b(proves|prove|proved)\b/gi, replacement: "shows" },
  ];
  for (const { pattern, replacement } of unsafePatterns) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const campaigns: Map<string, OutreachCampaign> = new Map();
const checkIns: Map<string, ScheduledCheckIn> = new Map();
const checkInResponses: Map<string, CheckInResponse> = new Map();
const outreachTemplates: Map<string, OutreachTemplate> = new Map();

initializeDefaultTemplates();

function initializeDefaultTemplates() {
  const systemTemplates: Omit<OutreachTemplate, "id" | "createdAt" | "updatedAt" | "usageCount" | "successRate">[] = [
    {
      name: "Post-Visit Follow-Up",
      category: "post_visit",
      description: "Personalized follow-up message sent after a healthcare visit",
      subjectTemplate: "How are you feeling after your recent visit, {{patientName}}?",
      bodyTemplate: "Hi {{patientName}},\n\nWe hope you're doing well after your visit on {{visitDate}} with {{providerName}}. {{aiPersonalizedContent}}\n\nIf you have any questions or concerns, please don't hesitate to reach out.\n\nTake care,\nYour Care Team",
      variables: ["patientName", "visitDate", "providerName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate a warm, personalized follow-up based on the patient's recent visit, conditions, and any instructions given.",
      recommendedChannel: "in_app",
      recommendedTiming: "24-48 hours after visit",
      targetAudience: "Patients with recent healthcare visits",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Medication Adherence Check",
      category: "adherence",
      description: "Check-in message for patients on new or chronic medications",
      subjectTemplate: "Quick check-in about your {{medicationName}}",
      bodyTemplate: "Hi {{patientName}},\n\nWe wanted to check in about your {{medicationName}}. {{aiPersonalizedContent}}\n\nRemember, consistency is key for your health goals. If you're experiencing any issues, we're here to help.\n\nYour Care Team",
      variables: ["patientName", "medicationName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate supportive medication adherence message based on the patient's medication history and any known challenges.",
      recommendedChannel: "in_app",
      recommendedTiming: "Weekly for first month, then monthly",
      targetAudience: "Patients on chronic medications",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Symptom Monitoring Check-In",
      category: "symptom_check",
      description: "Regular symptom monitoring for patients with chronic conditions",
      subjectTemplate: "Daily symptom check-in",
      bodyTemplate: "Hi {{patientName}},\n\nTime for your daily check-in. {{aiPersonalizedContent}}\n\nPlease take a moment to log how you're feeling today. Your responses help us provide better care.\n\nYour Care Team",
      variables: ["patientName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate an encouraging symptom check-in message personalized to the patient's specific conditions.",
      recommendedChannel: "push_notification",
      recommendedTiming: "Daily at patient's preferred time",
      targetAudience: "Patients with chronic conditions requiring monitoring",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Preventive Care Reminder",
      category: "preventive_care",
      description: "Reminder for overdue screenings or vaccinations",
      subjectTemplate: "Time for your {{screeningName}}",
      bodyTemplate: "Hi {{patientName}},\n\nOur records show you may be due for {{screeningName}}. {{aiPersonalizedContent}}\n\nPreventive care is an important part of staying healthy. Please schedule your appointment at your convenience.\n\nYour Care Team",
      variables: ["patientName", "screeningName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate a gentle reminder about preventive care tailored to the patient's age, risk factors, and health history.",
      recommendedChannel: "in_app",
      recommendedTiming: "When screening is due or overdue",
      targetAudience: "Patients with overdue preventive screenings",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Care Gap Alert",
      category: "care_gap",
      description: "Alert for identified gaps in patient care",
      subjectTemplate: "Important: Update on your care plan",
      bodyTemplate: "Hi {{patientName}},\n\n{{aiPersonalizedContent}}\n\nWe want to ensure you're receiving the best possible care. Please contact us to discuss next steps.\n\nYour Care Team",
      variables: ["patientName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate a caring message about an identified care gap, explaining its importance without causing alarm.",
      recommendedChannel: "in_app",
      recommendedTiming: "Within 1 week of gap identification",
      targetAudience: "Patients with identified care gaps",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Wellness Check-In",
      category: "wellness",
      description: "General wellness check for patient engagement",
      subjectTemplate: "How are you doing, {{patientName}}?",
      bodyTemplate: "Hi {{patientName}},\n\nWe're checking in to see how you're doing. {{aiPersonalizedContent}}\n\nYour wellbeing matters to us. Feel free to reach out anytime.\n\nWarm regards,\nYour Care Team",
      variables: ["patientName", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate a warm, general wellness check message tailored to the patient's overall health journey.",
      recommendedChannel: "in_app",
      recommendedTiming: "Monthly or quarterly",
      targetAudience: "All patients for engagement",
      isSystemTemplate: true,
      createdBy: "system",
    },
    {
      name: "Lab Results Follow-Up",
      category: "follow_up",
      description: "Follow-up after lab results are available",
      subjectTemplate: "Your recent lab results are ready",
      bodyTemplate: "Hi {{patientName}},\n\nYour recent lab results from {{labDate}} are now available. {{aiPersonalizedContent}}\n\nIf you have any questions about your results, please contact your care team.\n\nYour Care Team",
      variables: ["patientName", "labDate", "aiPersonalizedContent"],
      aiPersonalizationPrompt: "Generate an informative follow-up about lab results, encouraging the patient to discuss any questions with their provider.",
      recommendedChannel: "in_app",
      recommendedTiming: "Within 24 hours of results availability",
      targetAudience: "Patients with recent lab work",
      isSystemTemplate: true,
      createdBy: "system",
    },
  ];

  systemTemplates.forEach((t) => {
    const id = randomUUID();
    outreachTemplates.set(id, {
      ...t,
      id,
      usageCount: 0,
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
  const recentVisits = patientAppointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 5);

  return {
    patient,
    conditions,
    medications: medications.filter((m) => m.status === "active"),
    recentVisits,
    upcomingAppointments: patientAppointments.filter(
      (a) => a.status === "scheduled" && new Date(a.scheduledAt) > new Date()
    ),
    labResults: labResults.slice(0, 10),
  };
}

export async function generatePersonalizedMessage(
  patientId: string,
  templateId: string,
  customContext?: Record<string, string>
): Promise<{ subject: string; body: string; confidence: number }> {
  const template = outreachTemplates.get(templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  logPhiAccess({
    action: "read",
    resourceType: "outreach",
    resourceId: templateId,
    patientId,
    userId: "provider",
    details: "AI message personalization - generate_personalized_message",
    ipAddress: "internal",
  });

  const context = await getPatientContext(patientId);
  const patientName = context.patient?.firstName || "Patient";

  const prompt = `Generate a personalized healthcare message for a patient.

Patient Context:
- Name: ${patientName}
- Active Conditions: ${context.conditions.map((c) => c.title).join(", ") || "None documented"}
- Current Medications: ${context.medications.map((m) => m.name).join(", ") || "None documented"}
- Recent Visits: ${context.recentVisits.map((v) => `${v.type} on ${new Date(v.scheduledAt).toLocaleDateString()}`).join(", ") || "None recent"}

Template Context:
- Category: ${template.category}
- Purpose: ${template.description}
${template.aiPersonalizationPrompt ? `- Personalization Guidance: ${template.aiPersonalizationPrompt}` : ""}
${customContext ? `- Additional Context: ${JSON.stringify(customContext)}` : ""}

Generate a personalized message that:
1. Is warm, supportive, and professional
2. References relevant patient-specific information
3. Uses simple, accessible language
4. Is 50-100 words for the personalized content portion

IMPORTANT: Do NOT provide medical advice or recommendations. Use only descriptive language.

Respond in JSON format:
{
  "personalizedContent": "The personalized message content",
  "confidence": 0.0-1.0
}`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a healthcare communication assistant. Generate personalized, empathetic patient messages. Never provide medical advice. Respond in valid JSON format.",
      user: prompt,
      temperature: 0.7,
      maxTokens: 400,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(responseText || "{}");
    const personalizedContent = enforceSafeVerbs(result.personalizedContent || "We hope you're doing well.");

    let subject = template.subjectTemplate;
    let body = template.bodyTemplate;

    const variables: Record<string, string> = {
      patientName,
      aiPersonalizedContent: personalizedContent,
      ...customContext,
    };

    for (const [key, value] of Object.entries(variables)) {
      subject = subject.replace(new RegExp(`{{${key}}}`, "g"), value);
      body = body.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return {
      subject: enforceSafeVerbs(subject),
      body: enforceSafeVerbs(body),
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("[AIOutreach] Error generating personalized message:", error);
    
    let subject = template.subjectTemplate.replace(/{{patientName}}/g, patientName);
    let body = template.bodyTemplate
      .replace(/{{patientName}}/g, patientName)
      .replace(/{{aiPersonalizedContent}}/g, "We hope you're doing well and wanted to check in.");

    return {
      subject,
      body,
      confidence: 0.5,
    };
  }
}

export async function generateCheckInQuestions(
  checkInType: string,
  patientId: string,
  relatedConditions?: string[]
): Promise<CheckInQuestion[]> {
  logPhiAccess({
    action: "read",
    resourceType: "check_in",
    resourceId: checkInType,
    patientId,
    userId: "provider",
    details: "AI check-in question generation",
    ipAddress: "internal",
  });

  const context = await getPatientContext(patientId);

  const prompt = `Generate appropriate check-in questions for a patient based on the check-in type.

Check-In Type: ${checkInType}
Patient Conditions: ${context.conditions.map((c) => c.title).join(", ") || relatedConditions?.join(", ") || "General wellness"}
Current Medications: ${context.medications.map((m) => m.name).join(", ") || "None documented"}

Generate 3-5 questions appropriate for this check-in type. Questions should be:
1. Simple and easy to understand
2. Actionable for the care team
3. Non-alarming but clinically useful

Return as JSON:
{
  "questions": [
    {
      "questionText": "The question",
      "questionType": "yes_no|scale_1_10|multiple_choice|free_text|symptom_severity",
      "options": ["Option1", "Option2"] // only for multiple_choice
      "isRequired": true/false,
      "followUpTrigger": {
        "condition": "When to trigger (e.g., 'answer >= 7')",
        "action": "alert_provider|schedule_appointment|send_education|escalate"
      } // optional
    }
  ]
}`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a healthcare check-in designer. Create clinically relevant, patient-friendly questions. Respond in valid JSON.",
      user: prompt,
      temperature: 0.6,
      maxTokens: 600,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(responseText || "{}");
    return (result.questions || []).map((q: any, idx: number) => ({
      id: randomUUID(),
      questionText: enforceSafeVerbs(q.questionText),
      questionType: q.questionType || "yes_no",
      options: q.options,
      isRequired: q.isRequired ?? true,
      followUpTrigger: q.followUpTrigger,
    }));
  } catch (error) {
    console.error("[AIOutreach] Error generating check-in questions:", error);
    return getDefaultCheckInQuestions(checkInType);
  }
}

function getDefaultCheckInQuestions(checkInType: string): CheckInQuestion[] {
  const defaultQuestions: Record<string, CheckInQuestion[]> = {
    adherence: [
      { id: randomUUID(), questionText: "Have you taken all your medications as prescribed today?", questionType: "yes_no", isRequired: true },
      { id: randomUUID(), questionText: "On a scale of 1-10, how easy is it to follow your medication schedule?", questionType: "scale_1_10", isRequired: true },
      { id: randomUUID(), questionText: "Are you experiencing any side effects?", questionType: "yes_no", isRequired: true, followUpTrigger: { condition: "answer === true", action: "alert_provider" } },
    ],
    symptom_monitoring: [
      { id: randomUUID(), questionText: "How would you rate your overall symptoms today?", questionType: "symptom_severity", isRequired: true },
      { id: randomUUID(), questionText: "Are you experiencing any new symptoms?", questionType: "yes_no", isRequired: true },
      { id: randomUUID(), questionText: "Please describe any concerns you have today.", questionType: "free_text", isRequired: false },
    ],
    post_visit: [
      { id: randomUUID(), questionText: "Do you understand the instructions from your recent visit?", questionType: "yes_no", isRequired: true },
      { id: randomUUID(), questionText: "Have you been able to follow your care plan?", questionType: "yes_no", isRequired: true },
      { id: randomUUID(), questionText: "Do you have any questions for your care team?", questionType: "free_text", isRequired: false },
    ],
    wellness: [
      { id: randomUUID(), questionText: "How are you feeling today?", questionType: "scale_1_10", isRequired: true },
      { id: randomUUID(), questionText: "Have you been able to maintain your health goals this week?", questionType: "yes_no", isRequired: true },
      { id: randomUUID(), questionText: "Is there anything your care team can help you with?", questionType: "free_text", isRequired: false },
    ],
  };

  return defaultQuestions[checkInType] || defaultQuestions.wellness;
}

export async function analyzeCheckInResponse(
  checkInId: string,
  responses: CheckInResponse["responses"]
): Promise<{ status: "green" | "yellow" | "red"; analysis: string; recommendations: string[]; providerReviewRequired: boolean }> {
  const checkIn = checkIns.get(checkInId);
  if (!checkIn) {
    return { status: "green", analysis: "Check-in completed.", recommendations: [], providerReviewRequired: false };
  }

  logPhiAccess({
    action: "read",
    resourceType: "check_in_response",
    resourceId: checkInId,
    patientId: checkIn.patientId,
    userId: "provider",
    details: "AI response analysis - analyze_check_in_response",
    ipAddress: "internal",
  });

  const formattedResponses = responses.map((r) => {
    const question = checkIn.questions.find((q) => q.id === r.questionId);
    return `Q: ${question?.questionText || "Unknown"}\nA: ${r.answer}`;
  }).join("\n\n");

  const prompt = `Analyze patient check-in responses and determine status.

Check-In Type: ${checkIn.checkInType}
Check-In Title: ${checkIn.title}

Patient Responses:
${formattedResponses}

Analyze the responses and provide:
1. Overall status: green (all good), yellow (needs attention), red (urgent concern)
2. Brief analysis summary (2-3 sentences)
3. 1-3 actionable recommendations for the care team
4. Whether provider review is required

Return as JSON:
{
  "status": "green|yellow|red",
  "analysis": "Brief analysis",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "providerReviewRequired": true/false
}

IMPORTANT: Use only descriptive language. Do not provide medical diagnoses or treatment recommendations.`;

  try {
    const responseText = await generatePhiSafeText({
      system: "You are a healthcare check-in analyzer. Assess patient responses and flag concerns. Never diagnose. Respond in valid JSON.",
      user: prompt,
      temperature: 0.5,
      maxTokens: 400,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(responseText || "{}");
    return {
      status: result.status || "green",
      analysis: enforceSafeVerbs(result.analysis || "Check-in completed successfully."),
      recommendations: (result.recommendations || []).map(enforceSafeVerbs),
      providerReviewRequired: result.providerReviewRequired || result.status === "red",
    };
  } catch (error) {
    console.error("[AIOutreach] Error analyzing check-in response:", error);
    return {
      status: "yellow",
      analysis: "Unable to analyze responses automatically. Manual review may be needed.",
      recommendations: ["Review patient responses manually"],
      providerReviewRequired: true,
    };
  }
}

export async function identifyOutreachCandidates(
  criteria: string,
  conditions?: string[]
): Promise<{ patientId: string; patientName: string; reason: string; priority: "high" | "medium" | "low" }[]> {
  logPhiAccess({
    action: "read",
    resourceType: "patient_list",
    resourceId: criteria,
    userId: "provider",
    details: "AI outreach candidate identification",
    ipAddress: "internal",
  });

  const patients = await storage.getPatients();
  const candidates: { patientId: string; patientName: string; reason: string; priority: "high" | "medium" | "low" }[] = [];

  for (const patient of patients.slice(0, 50)) {
    const context = await getPatientContext(patient.id);
    let matches = false;
    let reason = "";
    let priority: "high" | "medium" | "low" = "medium";

    switch (criteria) {
      case "high_risk":
        if (context.conditions.length >= 2 || context.medications.length >= 5) {
          matches = true;
          reason = `Records show ${context.conditions.length} active conditions and ${context.medications.length} medications`;
          priority = context.conditions.length >= 3 ? "high" : "medium";
        }
        break;
      case "chronic_condition":
        const chronicConditions = context.conditions.filter((c) =>
          conditions?.some((cond) => c.title.toLowerCase().includes(cond.toLowerCase()))
        );
        if (chronicConditions.length > 0) {
          matches = true;
          reason = `Records show ${chronicConditions.map((c) => c.title).join(", ")}`;
          priority = "medium";
        }
        break;
      case "medication_adherence":
        if (context.medications.length > 0) {
          matches = true;
          reason = `Currently on ${context.medications.length} medications requiring adherence monitoring`;
          priority = context.medications.length >= 4 ? "high" : "medium";
        }
        break;
      case "recent_visit":
        if (context.recentVisits.length > 0) {
          const mostRecent = context.recentVisits[0];
          const daysSinceVisit = Math.floor(
            (Date.now() - new Date(mostRecent.scheduledAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceVisit <= 7) {
            matches = true;
            reason = `Recent visit ${daysSinceVisit} days ago - follow-up recommended`;
            priority = daysSinceVisit <= 2 ? "high" : "medium";
          }
        }
        break;
      case "all_patients":
        matches = true;
        reason = "General outreach campaign";
        priority = "low";
        break;
    }

    if (matches) {
      candidates.push({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        reason: enforceSafeVerbs(reason),
        priority,
      });
    }
  }

  return candidates.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function createCampaign(data: InsertOutreachCampaign): OutreachCampaign {
  const campaign: OutreachCampaign = {
    ...data,
    id: randomUUID(),
    totalTargetPatients: 0,
    messagesSent: 0,
    messagesDelivered: 0,
    messagesOpened: 0,
    responsesReceived: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  campaigns.set(campaign.id, campaign);
  return campaign;
}

export function getCampaign(id: string): OutreachCampaign | undefined {
  return campaigns.get(id);
}

export function getAllCampaigns(status?: string): OutreachCampaign[] {
  let result = Array.from(campaigns.values());
  if (status) {
    result = result.filter((c) => c.status === status);
  }
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateCampaign(id: string, updates: Partial<OutreachCampaign>): OutreachCampaign | undefined {
  const campaign = campaigns.get(id);
  if (!campaign) return undefined;

  const updated = { ...campaign, ...updates, updatedAt: new Date().toISOString() };
  campaigns.set(id, updated);
  return updated;
}

export function deleteCampaign(id: string): boolean {
  return campaigns.delete(id);
}

export function createCheckIn(data: InsertScheduledCheckIn): ScheduledCheckIn {
  const checkIn: ScheduledCheckIn = {
    ...data,
    id: randomUUID(),
    completionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  checkIns.set(checkIn.id, checkIn);
  return checkIn;
}

export function getCheckIn(id: string): ScheduledCheckIn | undefined {
  return checkIns.get(id);
}

export function getCheckInsByPatient(patientId: string): ScheduledCheckIn[] {
  return Array.from(checkIns.values())
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllCheckIns(filters?: { isActive?: boolean; checkInType?: string }): ScheduledCheckIn[] {
  let result = Array.from(checkIns.values());
  if (filters?.isActive !== undefined) {
    result = result.filter((c) => c.isActive === filters.isActive);
  }
  if (filters?.checkInType) {
    result = result.filter((c) => c.checkInType === filters.checkInType);
  }
  return result.sort((a, b) => new Date(a.nextScheduledAt).getTime() - new Date(b.nextScheduledAt).getTime());
}

export function updateCheckIn(id: string, updates: Partial<ScheduledCheckIn>): ScheduledCheckIn | undefined {
  const checkIn = checkIns.get(id);
  if (!checkIn) return undefined;

  const updated = { ...checkIn, ...updates, updatedAt: new Date().toISOString() };
  checkIns.set(id, updated);
  return updated;
}

export function deleteCheckIn(id: string): boolean {
  return checkIns.delete(id);
}

export function createCheckInResponse(data: InsertCheckInResponse): CheckInResponse {
  const response: CheckInResponse = {
    ...data,
    id: randomUUID(),
    providerReviewRequired: data.overallStatus !== "green",
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  checkInResponses.set(response.id, response);

  const checkIn = checkIns.get(data.checkInId);
  if (checkIn) {
    updateCheckIn(checkIn.id, {
      completionCount: checkIn.completionCount + 1,
      lastCompletedAt: new Date().toISOString(),
    });
  }

  return response;
}

export function getCheckInResponses(checkInId: string): CheckInResponse[] {
  return Array.from(checkInResponses.values())
    .filter((r) => r.checkInId === checkInId)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function getOutreachTemplates(category?: string): OutreachTemplate[] {
  let result = Array.from(outreachTemplates.values());
  if (category) {
    result = result.filter((t) => t.category === category);
  }
  return result.sort((a, b) => b.usageCount - a.usageCount);
}

export function getOutreachTemplate(id: string): OutreachTemplate | undefined {
  return outreachTemplates.get(id);
}

export function createOutreachTemplate(data: InsertOutreachTemplate): OutreachTemplate {
  const template: OutreachTemplate = {
    ...data,
    id: randomUUID(),
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  outreachTemplates.set(template.id, template);
  return template;
}

export function updateOutreachTemplate(id: string, updates: Partial<OutreachTemplate>): OutreachTemplate | undefined {
  const template = outreachTemplates.get(id);
  if (!template) return undefined;

  const updated = { ...template, ...updates, updatedAt: new Date().toISOString() };
  outreachTemplates.set(id, updated);
  return updated;
}

export function incrementTemplateUsage(id: string): void {
  const template = outreachTemplates.get(id);
  if (template) {
    template.usageCount += 1;
    template.updatedAt = new Date().toISOString();
    outreachTemplates.set(id, template);
  }
}

export function getDueCheckIns(): ScheduledCheckIn[] {
  const now = new Date();
  return Array.from(checkIns.values())
    .filter((c) => c.isActive && new Date(c.nextScheduledAt) <= now)
    .sort((a, b) => new Date(a.nextScheduledAt).getTime() - new Date(b.nextScheduledAt).getTime());
}

export function getOutreachStats(): {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCheckIns: number;
  activeCheckIns: number;
  totalMessagesThisMonth: number;
  responseRate: number;
} {
  const campaigns = getAllCampaigns();
  const checkInsList = getAllCheckIns();
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const monthlyMessages = campaigns
    .filter((c) => new Date(c.createdAt) >= thisMonth)
    .reduce((sum, c) => sum + c.messagesSent, 0);

  const totalSent = campaigns.reduce((sum, c) => sum + c.messagesSent, 0);
  const totalResponses = campaigns.reduce((sum, c) => sum + c.responsesReceived, 0);

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    totalCheckIns: checkInsList.length,
    activeCheckIns: checkInsList.filter((c) => c.isActive).length,
    totalMessagesThisMonth: monthlyMessages,
    responseRate: totalSent > 0 ? Math.round((totalResponses / totalSent) * 100) : 0,
  };
}
