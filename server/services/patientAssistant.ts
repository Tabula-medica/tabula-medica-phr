import OpenAI from "openai";
import { storage } from "../storage";
import { NO_CDS_DISCLAIMER_SHORT, sanitizeNoCDS, sanitizeNoCDSObject } from "../security/no-cds-guardrails";
import type { MedicalRecord, Medication, Appointment, HealthTip, Patient, LabResult } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface SentimentAnalysis {
  sentiment: "positive" | "neutral" | "concerned" | "anxious" | "frustrated";
  confidence: number;
  emotionalCues: string[];
  suggestedTone: string;
}

export interface ProactiveInsight {
  id: string;
  type: "health_tip" | "reminder" | "encouragement" | "milestone" | "alert";
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  relatedCondition?: string;
  relatedMedication?: string;
  expiresAt?: string;
}

export interface PatientContext {
  patient: Patient | undefined;
  conditions: MedicalRecord[];
  medications: Medication[];
  upcomingAppointments: Appointment[];
  healthTips: HealthTip[];
  recentLabResults?: LabResult[];
  recentVitals?: any[];
}

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssistantResponse {
  message: string;
  suggestions?: string[];
  reminders?: {
    type: "appointment" | "medication" | "checkup";
    text: string;
    date?: string;
  }[];
}

async function getPatientContext(patientId: string): Promise<PatientContext> {
  const [patient, allRecords, medications, appointments, healthTips, labResults] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
    storage.getHealthTips ? storage.getHealthTips() : Promise.resolve([]),
    storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
  ]);

  const conditions = allRecords.filter(r => r.type === "diagnosis" && r.status === "active");
  
  const now = new Date();
  const upcomingAppointments = appointments
    .filter(a => a.patientId === patientId && a.status === "scheduled" && new Date(a.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);

  const activeMedications = medications.filter(m => m.status === "active");
  
  const patientTips = healthTips.filter(t => 
    t.isActive && 
    (!t.targetConditions?.length || t.targetConditions.some(tc => 
      conditions.some(c => c.title.toLowerCase().includes(tc.toLowerCase()))
    ))
  ).slice(0, 5);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentLabResults = labResults
    .filter(l => new Date(l.date) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return {
    patient,
    conditions,
    medications: activeMedications,
    upcomingAppointments,
    healthTips: patientTips,
    recentLabResults,
  };
}

export async function analyzeSentiment(message: string): Promise<SentimentAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a sentiment analysis expert for healthcare conversations. Analyze the patient's message to detect their emotional state.
          
Return a JSON object with:
- sentiment: one of "positive", "neutral", "concerned", "anxious", "frustrated"
- confidence: 0-1 score
- emotionalCues: array of specific words/phrases that indicate the emotion
- suggestedTone: a brief description of how the AI should respond (e.g., "reassuring and calm", "celebratory and supportive")

Consider healthcare-specific cues:
- Questions about symptoms or side effects often indicate concern
- Expressions about waiting, delays, or not understanding indicate frustration
- Mentions of pain, worry, or fear indicate anxiety
- Positive updates about progress or feeling better indicate positive sentiment`
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });

    const result = sanitizeNoCDSObject(JSON.parse(response.choices[0]?.message?.content || "{}"));
    return {
      sentiment: result.sentiment || "neutral",
      confidence: result.confidence || 0.5,
      emotionalCues: result.emotionalCues || [],
      suggestedTone: result.suggestedTone || "friendly and supportive",
    };
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return {
      sentiment: "neutral",
      confidence: 0.5,
      emotionalCues: [],
      suggestedTone: "friendly and supportive",
    };
  }
}

export async function generateProactiveInsights(patientId: string): Promise<ProactiveInsight[]> {
  const context = await getPatientContext(patientId);
  const insights: ProactiveInsight[] = [];
  const now = new Date();

  for (const apt of context.upcomingAppointments) {
    const aptDate = new Date(apt.scheduledAt);
    const daysUntil = Math.ceil((aptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 7) {
      insights.push({
        id: `apt-${apt.id}`,
        type: "reminder",
        priority: daysUntil <= 1 ? "high" : "medium",
        title: `Upcoming ${apt.type} Appointment`,
        message: `Your appointment with ${apt.provider} is ${daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}. Would you like tips to prepare?`,
        actionable: true,
        suggestedAction: "View appointment details",
        expiresAt: apt.scheduledAt,
      });
    }
  }

  for (const med of context.medications) {
    if (med.refillsRemaining !== undefined && med.refillsRemaining <= 2) {
      insights.push({
        id: `refill-${med.id}`,
        type: "reminder",
        priority: med.refillsRemaining === 0 ? "high" : "medium",
        title: `Medication Refill Needed`,
        message: `Your ${med.name} prescription has ${med.refillsRemaining} refill${med.refillsRemaining === 1 ? "" : "s"} remaining. Consider requesting a refill soon.`,
        actionable: true,
        suggestedAction: "Contact pharmacy",
        relatedMedication: med.name,
      });
    }
  }

  for (const condition of context.conditions) {
    const relatedTips = context.healthTips.filter(t => 
      t.targetConditions?.some(tc => 
        condition.title.toLowerCase().includes(tc.toLowerCase())
      )
    );
    
    if (relatedTips.length > 0) {
      const tip = relatedTips[Math.floor(Math.random() * relatedTips.length)];
      insights.push({
        id: `tip-${condition.id}`,
        type: "health_tip",
        priority: "low",
        title: tip.title,
        message: tip.summary || tip.content.substring(0, 150) + "...",
        actionable: false,
        relatedCondition: condition.title,
      });
    }
  }

  if (context.recentLabResults && context.recentLabResults.length > 0) {
    const abnormalResults = context.recentLabResults.filter(l => 
      l.status === "abnormal" || l.flag === "high" || l.flag === "low"
    );
    
    if (abnormalResults.length > 0) {
      insights.push({
        id: `lab-alert-${Date.now()}`,
        type: "alert",
        priority: "medium",
        title: "Recent Lab Results Need Attention",
        message: `You have ${abnormalResults.length} lab result${abnormalResults.length > 1 ? "s" : ""} outside the normal range. Your healthcare provider may want to discuss these with you.`,
        actionable: true,
        suggestedAction: "Review lab results",
      });
    } else {
      insights.push({
        id: `lab-good-${Date.now()}`,
        type: "encouragement",
        priority: "low",
        title: "Great Lab Results!",
        message: "Your recent lab results are within normal ranges. Keep up the good work with your health routine!",
        actionable: false,
      });
    }
  }

  if (context.medications.length > 0 && context.conditions.length > 0) {
    insights.push({
      id: `milestone-${Date.now()}`,
      type: "encouragement",
      priority: "low",
      title: "Health Journey Progress",
      message: `You're actively managing ${context.conditions.length} condition${context.conditions.length > 1 ? "s" : ""} with ${context.medications.length} medication${context.medications.length > 1 ? "s" : ""}. Staying consistent with your treatment plan is key to better health outcomes.`,
      actionable: false,
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function buildSystemPrompt(context: PatientContext, sentiment?: SentimentAnalysis): string {
  const { patient, conditions, medications, upcomingAppointments, healthTips, recentLabResults } = context;

  let systemPrompt = `You are a friendly, empathetic AI health information assistant for Tabula Medica. Your role is to help patients understand their health information and provide general health information. You may:

1. Answer health-related questions in clear, simple language
2. Explain medical conditions and medications in patient-friendly terms
3. Remind patients about upcoming appointments and medication schedules
4. Share general health information based on their profile
5. Always note that patients may wish to consult their healthcare provider for medical decisions
6. PROACTIVELY offer relevant health information and reminders when appropriate

IMPORTANT GUIDELINES:
- Never provide medical diagnoses or treatment recommendations
- Always clarify that you're providing general health information, not medical advice
- Be warm, supportive, and non-judgmental
- Use the patient's health data to provide personalized, relevant responses
- If asked about symptoms that could indicate an emergency, note that seeking immediate medical care is an option
- When the patient shares positive health updates, celebrate their progress
- ${NO_CDS_DISCLAIMER_SHORT}

`;

  if (sentiment) {
    systemPrompt += `\nEMOTIONAL CONTEXT:
The patient's current emotional state appears to be: ${sentiment.sentiment} (confidence: ${(sentiment.confidence * 100).toFixed(0)}%)
Detected emotional cues: ${sentiment.emotionalCues.join(", ") || "none detected"}
Recommended response tone: ${sentiment.suggestedTone}

EMPATHETIC RESPONSE GUIDELINES:
`;
    
    switch (sentiment.sentiment) {
      case "anxious":
        systemPrompt += `- The patient seems anxious. Use a calm, reassuring tone.
- Acknowledge their concerns directly before providing information.
- Offer concrete, actionable steps they can take.
- Remind them that their healthcare team is there to help.\n`;
        break;
      case "frustrated":
        systemPrompt += `- The patient seems frustrated. Validate their feelings.
- Be patient and understanding in your response.
- Focus on solutions and next steps.
- Avoid dismissing their concerns.\n`;
        break;
      case "concerned":
        systemPrompt += `- The patient has concerns. Take them seriously.
- Provide clear, factual information to address their worries.
- Suggest appropriate follow-up actions if needed.
- Be supportive without being dismissive.\n`;
        break;
      case "positive":
        systemPrompt += `- The patient is in a positive mood. Match their energy.
- Celebrate their progress or good news with them.
- Encourage them to continue their healthy behaviors.
- Use an upbeat, supportive tone.\n`;
        break;
      default:
        systemPrompt += `- Maintain a friendly, helpful tone.
- Be informative and supportive.\n`;
    }
  }

  if (patient) {
    systemPrompt += `\nPATIENT PROFILE:
- Name: ${patient.firstName} ${patient.lastName}
- Date of Birth: ${patient.dateOfBirth}
`;
  }

  if (conditions.length > 0) {
    systemPrompt += `\nCURRENT CONDITIONS:
${conditions.map(c => `- ${c.title}: ${c.description} (${c.status})`).join("\n")}
`;
  }

  if (medications.length > 0) {
    systemPrompt += `\nACTIVE MEDICATIONS:
${medications.map(m => `- ${m.name}: ${m.dosage}, ${m.frequency}${m.refillsRemaining !== undefined ? `, ${m.refillsRemaining} refills remaining` : ""}`).join("\n")}
`;
  }

  if (upcomingAppointments.length > 0) {
    systemPrompt += `\nUPCOMING APPOINTMENTS:
${upcomingAppointments.map(a => {
  const date = new Date(a.scheduledAt);
  return `- ${a.title} with ${a.provider} at ${a.facility} on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}).join("\n")}
`;
  }

  if (healthTips.length > 0) {
    systemPrompt += `\nRELEVANT HEALTH TIPS:
${healthTips.map(t => `- ${t.title}: ${t.content.substring(0, 100)}...`).join("\n")}
`;
  }

  if (recentLabResults && recentLabResults.length > 0) {
    systemPrompt += `\nRECENT LAB RESULTS (last 30 days):
${recentLabResults.map(l => {
  const status = l.status === "abnormal" || l.flag ? ` [${l.flag || "ABNORMAL"}]` : " [Normal]";
  return `- ${l.testName}: ${l.value} ${l.unit}${status}`;
}).join("\n")}
`;
  }

  return systemPrompt;
}

function extractReminders(context: PatientContext): AssistantResponse["reminders"] {
  const reminders: AssistantResponse["reminders"] = [];
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const apt of context.upcomingAppointments) {
    const aptDate = new Date(apt.scheduledAt);
    if (aptDate <= tomorrow) {
      reminders.push({
        type: "appointment",
        text: `You have an upcoming ${apt.type} appointment with ${apt.provider} ${aptDate <= now ? "today" : "tomorrow"} at ${aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        date: apt.scheduledAt,
      });
    }
  }

  for (const med of context.medications) {
    if (med.refillsRemaining !== undefined && med.refillsRemaining <= 1) {
      reminders.push({
        type: "medication",
        text: `Your ${med.name} prescription has ${med.refillsRemaining} refill${med.refillsRemaining === 1 ? "" : "s"} remaining. Consider contacting your pharmacy.`,
      });
    }
  }

  return reminders;
}

function generateSuggestions(context: PatientContext): string[] {
  const suggestions: string[] = [];

  if (context.conditions.length > 0) {
    suggestions.push(`Tell me more about ${context.conditions[0].title}`);
  }
  
  if (context.medications.length > 0) {
    suggestions.push(`What are the side effects of ${context.medications[0].name}?`);
  }
  
  if (context.upcomingAppointments.length > 0) {
    suggestions.push("What should I prepare for my next appointment?");
  }

  suggestions.push("What general health information is available?");
  suggestions.push("What preventive screenings are commonly discussed?");

  return suggestions.slice(0, 4);
}

export interface EnhancedAssistantResponse extends AssistantResponse {
  sentiment?: SentimentAnalysis;
  proactiveInsights?: ProactiveInsight[];
}

export async function chatWithAssistant(
  patientId: string,
  messages: AssistantMessage[],
  stream: boolean = false,
  enableSentimentAnalysis: boolean = true
): Promise<EnhancedAssistantResponse | AsyncIterable<string>> {
  const context = await getPatientContext(patientId);
  
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  let sentiment: SentimentAnalysis | undefined;
  
  if (enableSentimentAnalysis && lastUserMessage) {
    sentiment = await analyzeSentiment(lastUserMessage.content);
  }
  
  const systemPrompt = buildSystemPrompt(context, sentiment);

  const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (stream) {
    const streamResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: apiMessages,
      stream: true,
      max_completion_tokens: 1024,
    });

    return (async function* () {
      for await (const chunk of streamResponse) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    })();
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: apiMessages,
    max_completion_tokens: 1024,
  });

  const message = sanitizeNoCDS(response.choices[0]?.message?.content || "I apologize, but I couldn't process your request. Please try again.");
  const reminders = extractReminders(context);
  const suggestions = generateSuggestions(context);

  return {
    message,
    suggestions,
    reminders: reminders && reminders.length > 0 ? reminders : undefined,
    sentiment,
  };
}

export async function getPatientReminders(patientId: string): Promise<AssistantResponse["reminders"]> {
  const context = await getPatientContext(patientId);
  return extractReminders(context);
}

export async function getPersonalizedTips(patientId: string): Promise<HealthTip[]> {
  const context = await getPatientContext(patientId);
  return context.healthTips;
}

export async function explainCondition(patientId: string, conditionName: string): Promise<string> {
  const context = await getPatientContext(patientId);
  const systemPrompt = buildSystemPrompt(context);

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please explain what "${conditionName}" means in simple, patient-friendly terms. Include common symptoms, what causes it, and general lifestyle tips that might help manage it.` },
    ],
    max_completion_tokens: 800,
  });

  return sanitizeNoCDS(response.choices[0]?.message?.content || "I couldn't find information about this condition.");
}

export async function explainMedication(patientId: string, medicationName: string): Promise<string> {
  const context = await getPatientContext(patientId);
  const systemPrompt = buildSystemPrompt(context);

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please explain what "${medicationName}" is used for in simple terms. Include common side effects to watch for and any important tips for taking this medication safely.` },
    ],
    max_completion_tokens: 800,
  });

  return sanitizeNoCDS(response.choices[0]?.message?.content || "I couldn't find information about this medication.");
}

export async function generateWelcomeMessage(patientId: string): Promise<AssistantResponse> {
  const context = await getPatientContext(patientId);
  const reminders = extractReminders(context);
  const suggestions = generateSuggestions(context);

  let welcomeMessage = "Hello! I'm your Tabula Medica health assistant. I'm here to help you understand your health information, answer questions about your conditions and medications, and keep you informed about your appointments.";

  if (reminders && reminders.length > 0) {
    welcomeMessage += "\n\nI have some reminders for you:";
  }

  return {
    message: welcomeMessage,
    suggestions,
    reminders: reminders && reminders.length > 0 ? reminders : undefined,
  };
}
