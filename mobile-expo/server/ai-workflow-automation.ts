import { storage } from "./storage";
import { chatComplete } from "./ai-client";
import type { 
  HealthRecord, 
  MedicationReminder, 
  Appointment,
  AppointmentSuggestion,
  RefillRequest,
  ConsultationSummary,
  InsertAppointmentSuggestion,
  InsertRefillRequest,
  InsertConsultationSummary,
} from "@shared/schema";

interface WorkflowContext {
  user: { name: string; email: string };
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

async function getWorkflowContext(userId: string): Promise<WorkflowContext> {
  const user = await storage.getUser(userId);
  const records = await storage.getHealthRecords(userId);
  const upcomingAppointments = await storage.getUpcomingAppointments(userId);
  const medicationReminders = await storage.getActiveMedicationReminders(userId);
  
  return {
    user: { name: user?.name || "Patient", email: user?.email || "" },
    conditions: records.filter(r => r.type === "condition"),
    medications: records.filter(r => r.type === "medication"),
    vitals: records.filter(r => r.type === "vital").slice(0, 15),
    labs: records.filter(r => r.type === "labs" || r.type === "lab").slice(0, 15),
    allergies: records.filter(r => r.type === "allergy"),
    immunizations: records.filter(r => r.type === "immunization"),
    upcomingAppointments,
    medicationReminders,
    recentRecords: records.slice(0, 30),
  };
}

function formatContextForAI(context: WorkflowContext): string {
  const parts: string[] = [];
  
  parts.push(`Patient: ${context.user.name}`);
  
  if (context.conditions.length > 0) {
    parts.push(`\nActive Conditions (${context.conditions.length}):`);
    context.conditions.forEach(c => parts.push(`- ${c.title}${c.summary ? `: ${c.summary}` : ""}`));
  }
  
  if (context.medications.length > 0) {
    parts.push(`\nCurrent Medications (${context.medications.length}):`);
    context.medications.forEach(m => parts.push(`- ${m.title}${m.summary ? `: ${m.summary}` : ""}`));
  }
  
  if (context.vitals.length > 0) {
    parts.push(`\nRecent Vitals:`);
    context.vitals.forEach(v => {
      const date = new Date(v.date).toLocaleDateString();
      parts.push(`- ${v.title} (${date})${v.summary ? `: ${v.summary}` : ""}`);
    });
  }
  
  if (context.labs.length > 0) {
    parts.push(`\nRecent Lab Results:`);
    context.labs.forEach(l => {
      const date = new Date(l.date).toLocaleDateString();
      parts.push(`- ${l.title} (${date})${l.summary ? `: ${l.summary}` : ""}`);
    });
  }
  
  if (context.allergies.length > 0) {
    parts.push(`\nAllergies:`);
    context.allergies.forEach(a => parts.push(`- ${a.title}`));
  }
  
  if (context.immunizations.length > 0) {
    parts.push(`\nImmunizations:`);
    context.immunizations.forEach(i => {
      const date = new Date(i.date).toLocaleDateString();
      parts.push(`- ${i.title} (${date})`);
    });
  }
  
  if (context.upcomingAppointments.length > 0) {
    parts.push(`\nUpcoming Appointments:`);
    context.upcomingAppointments.forEach(a => {
      const date = new Date(a.scheduledAt).toLocaleDateString();
      parts.push(`- ${a.title} - ${a.appointmentType} (${date})`);
    });
  }
  
  if (context.medicationReminders.length > 0) {
    parts.push(`\nMedication Reminders:`);
    context.medicationReminders.forEach(m => {
      parts.push(`- ${m.medicationName} - ${m.dosage} (${m.frequency})`);
    });
  }
  
  return parts.join("\n");
}

export async function generateAppointmentSuggestions(userId: string): Promise<AppointmentSuggestion[]> {
  const startTime = Date.now();
  const context = await getWorkflowContext(userId);
  const contextStr = formatContextForAI(context);
  
  const systemPrompt = `You are an AI healthcare workflow assistant helping patients proactively manage their health. Based on the patient's health data, conditions, medications, and care history, suggest appropriate appointments they should schedule.

Consider:
1. Preventive care based on age-appropriate screenings and immunizations
2. Follow-up appointments for chronic conditions
3. Risk-based recommendations from lab trends or vital patterns
4. Routine checkups and specialist visits
5. Upcoming medication reviews or refill consultations

For each suggestion, provide:
- A clear title and description
- The type of appointment (checkup, specialist, lab, imaging, therapy, vaccination, follow_up)
- Priority level (high, medium, low)
- Suggested timeframe (e.g., "within 2 weeks", "within 1 month")
- Clear rationale explaining why this appointment is recommended
- Related conditions or risks driving the recommendation
- Confidence score (0-100)

Return a JSON array of appointment suggestions. Be specific and clinically relevant.`;

  const userPrompt = `Based on this patient's health profile, what appointments should they consider scheduling?

${contextStr}

Return up to 5 appointment suggestions as a JSON array with this structure:
[{
  "title": "string",
  "description": "string",
  "appointmentType": "checkup" | "specialist" | "lab" | "imaging" | "therapy" | "vaccination" | "follow_up",
  "suggestionType": "preventive" | "follow_up" | "risk_based" | "routine",
  "priority": "high" | "medium" | "low",
  "suggestedTimeframe": "string",
  "suggestedSpecialty": "string or null",
  "rationale": "string",
  "relatedConditions": ["string array"],
  "relatedRisks": ["string array"],
  "confidence": number
}]

Only return valid JSON array, no other text.`;

  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      maxOutputTokens: 2000,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-workflow-automation",
      callerMethod: "workflowAutomation"});

    const content = response.content || "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      title: string;
      description: string;
      appointmentType: string;
      suggestionType: string;
      priority: string;
      suggestedTimeframe: string;
      suggestedSpecialty?: string;
      rationale: string;
      relatedConditions?: string[];
      relatedRisks?: string[];
      confidence: number;
    }>;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const createdSuggestions: AppointmentSuggestion[] = [];
    for (const suggestion of suggestions) {
      const insertData: InsertAppointmentSuggestion = {
        userId,
        title: suggestion.title,
        description: suggestion.description,
        appointmentType: suggestion.appointmentType,
        suggestionType: suggestion.suggestionType,
        priority: suggestion.priority,
        suggestedTimeframe: suggestion.suggestedTimeframe,
        suggestedSpecialty: suggestion.suggestedSpecialty || null,
        rationale: suggestion.rationale,
        relatedConditions: suggestion.relatedConditions || [],
        relatedRisks: suggestion.relatedRisks || [],
        confidence: suggestion.confidence,
        aiModel: "gpt-4o",
        status: "pending",
        expiresAt,
      };
      
      const created = await storage.createAppointmentSuggestion(insertData);
      createdSuggestions.push(created);
    }

    return createdSuggestions;
  } catch (error) {
    console.error("Error generating appointment suggestions:", error);
    return [];
  }
}

export async function generateRefillRequests(userId: string): Promise<RefillRequest[]> {
  const context = await getWorkflowContext(userId);
  const contextStr = formatContextForAI(context);
  
  if (context.medicationReminders.length === 0 && context.medications.length === 0) {
    return [];
  }

  const systemPrompt = `You are an AI healthcare workflow assistant helping patients manage medication refills proactively. Based on the patient's medication reminders and prescription history, predict which medications may need refills soon.

Consider:
1. Typical prescription lengths (30, 60, 90 day supplies)
2. Medication adherence patterns from reminders
3. Chronic medications that require continuous refills
4. Medications that may need prior authorization

For each refill recommendation, provide:
- The medication name and details
- Predicted run-out timeframe
- Priority level (urgent, high, normal, low)
- Whether prior authorization might be needed
- Clear rationale for the prediction

Return a JSON array of refill recommendations.`;

  const userPrompt = `Based on this patient's medication profile, which medications might need refills soon?

${contextStr}

Return up to 5 refill recommendations as a JSON array with this structure:
[{
  "medicationName": "string",
  "dosage": "string",
  "frequency": "string",
  "daysSupplyRemaining": number (estimate),
  "predictedRunOutDate": "YYYY-MM-DD",
  "priority": "urgent" | "high" | "normal" | "low",
  "priorAuthRequired": boolean,
  "rationale": "string"
}]

Only return valid JSON array, no other text.`;

  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      maxOutputTokens: 1500,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-workflow-automation",
      callerMethod: "workflowAutomation"});

    const content = response.content || "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const recommendations = JSON.parse(jsonMatch[0]) as Array<{
      medicationName: string;
      dosage?: string;
      frequency?: string;
      daysSupplyRemaining?: number;
      predictedRunOutDate?: string;
      priority: string;
      priorAuthRequired?: boolean;
      rationale: string;
    }>;

    const createdRequests: RefillRequest[] = [];
    for (const rec of recommendations) {
      const matchingReminder = context.medicationReminders.find(
        r => r.medicationName.toLowerCase().includes(rec.medicationName.toLowerCase())
      );

      const insertData: InsertRefillRequest = {
        userId,
        medicationName: rec.medicationName,
        medicationReminderId: matchingReminder?.id || null,
        medicationDetails: {
          dosage: rec.dosage || matchingReminder?.dosage || undefined,
          frequency: rec.frequency || matchingReminder?.frequency || undefined,
        },
        requestType: "predicted",
        daysSupplyRemaining: rec.daysSupplyRemaining || null,
        predictedRunOutDate: rec.predictedRunOutDate ? new Date(rec.predictedRunOutDate) : null,
        priority: rec.priority,
        insuranceEligible: null,
        insuranceDetails: rec.priorAuthRequired ? { priorAuthRequired: true } : null,
        aiRationale: rec.rationale,
        aiModel: "gpt-4o",
        status: "pending",
      };
      
      const created = await storage.createRefillRequest(insertData);
      createdRequests.push(created);
    }

    return createdRequests;
  } catch (error) {
    console.error("Error generating refill requests:", error);
    return [];
  }
}

export async function generateConsultationSummary(
  userId: string, 
  options: {
    summaryType?: string;
    recordIds?: string[];
    dateRange?: { start: Date; end: Date };
    appointmentId?: string;
  } = {}
): Promise<ConsultationSummary | null> {
  const startTime = Date.now();
  const context = await getWorkflowContext(userId);
  
  let relevantRecords = context.recentRecords;
  if (options.recordIds && options.recordIds.length > 0) {
    relevantRecords = relevantRecords.filter(r => options.recordIds!.includes(r.id));
  }
  if (options.dateRange) {
    relevantRecords = relevantRecords.filter(r => {
      const date = new Date(r.date);
      return date >= options.dateRange!.start && date <= options.dateRange!.end;
    });
  }

  if (relevantRecords.length === 0) {
    return null;
  }

  const summaryType = options.summaryType || "comprehensive";
  
  const recordsStr = relevantRecords.map(r => {
    const date = new Date(r.date).toLocaleDateString();
    const details = r.details ? JSON.stringify(r.details) : "";
    return `[${r.type.toUpperCase()}] ${r.title} (${date})${r.summary ? `: ${r.summary}` : ""}${details ? ` | Details: ${details}` : ""}`;
  }).join("\n");

  const systemPrompt = `You are an AI healthcare assistant creating patient-friendly summaries of health records and consultations. Your goal is to help patients understand their health information clearly.

Create a summary that includes:
1. An executive summary (2-3 sentences)
2. Key findings organized by category
3. Recommendations with priority levels
4. Medication changes (if any)
5. Follow-up actions with timeframes
6. Questions the patient might want to ask their provider

Be clear, accurate, and patient-friendly. Avoid excessive medical jargon.`;

  const userPrompt = `Create a ${summaryType} summary of these health records:

${recordsStr}

Patient Context:
- Active Conditions: ${context.conditions.map(c => c.title).join(", ") || "None recorded"}
- Current Medications: ${context.medications.map(m => m.title).join(", ") || "None recorded"}
- Allergies: ${context.allergies.map(a => a.title).join(", ") || "None recorded"}

Return a JSON object with this structure:
{
  "title": "string - descriptive title for this summary",
  "executiveSummary": "string - 2-3 sentence overview",
  "keyFindings": [{"category": "string", "finding": "string", "significance": "string", "actionRequired": boolean}],
  "recommendations": [{"priority": "high|medium|low", "recommendation": "string", "rationale": "string", "dueDate": "optional string"}],
  "medications": [{"name": "string", "action": "started|continued|stopped|changed", "details": "optional string"}],
  "followUpActions": [{"action": "string", "timeframe": "string", "provider": "optional string"}],
  "questionsToAsk": ["string array of suggested questions"]
}

Only return valid JSON, no other text.`;

  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      maxOutputTokens: 2500,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "ai-workflow-automation",
      callerMethod: "workflowAutomation"});

    const content = response.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const summary = JSON.parse(jsonMatch[0]) as {
      title: string;
      executiveSummary: string;
      keyFindings: Array<{ category: string; finding: string; significance: string; actionRequired?: boolean }>;
      recommendations: Array<{ priority: string; recommendation: string; rationale: string; dueDate?: string }>;
      medications: Array<{ name: string; action: string; details?: string }>;
      followUpActions: Array<{ action: string; timeframe: string; provider?: string }>;
      questionsToAsk: string[];
    };

    const generationTimeMs = Date.now() - startTime;
    const promptTokens = response.usage?.promptTokens || 0;
    const completionTokens = response.usage?.completionTokens || 0;

    const insertData: InsertConsultationSummary = {
      userId,
      summaryType,
      title: summary.title,
      executiveSummary: summary.executiveSummary,
      keyFindings: summary.keyFindings,
      recommendations: summary.recommendations,
      medications: summary.medications,
      followUpActions: summary.followUpActions,
      questionsToAsk: summary.questionsToAsk,
      relatedRecordIds: relevantRecords.map(r => r.id),
      sourceAppointmentId: options.appointmentId || null,
      dateRange: options.dateRange ? {
        start: options.dateRange.start.toISOString(),
        end: options.dateRange.end.toISOString(),
      } : null,
      aiModel: "gpt-4o",
      promptTokens,
      completionTokens,
      generationTimeMs,
      status: "generated",
    };

    return await storage.createConsultationSummary(insertData);
  } catch (error) {
    console.error("Error generating consultation summary:", error);
    return null;
  }
}

export async function getWorkflowDashboard(userId: string) {
  const [
    pendingSuggestions,
    pendingRefills,
    recentSummaries,
    stats
  ] = await Promise.all([
    storage.getPendingAppointmentSuggestions(userId),
    storage.getPendingRefillRequests(userId),
    storage.getConsultationSummaries(userId, 5),
    storage.getWorkflowStats(userId),
  ]);

  return {
    stats,
    pendingSuggestions,
    pendingRefills,
    recentSummaries,
  };
}

export async function refreshAllWorkflows(userId: string) {
  const [suggestions, refills] = await Promise.all([
    generateAppointmentSuggestions(userId),
    generateRefillRequests(userId),
  ]);

  return {
    newSuggestions: suggestions.length,
    newRefills: refills.length,
  };
}
