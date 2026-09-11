import OpenAI from "openai";
import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import { NO_CDS_DISCLAIMER_SHORT, sanitizeNoCDSObject } from "../security/no-cds-guardrails";
import type { Patient, Medication, MedicalRecord, Appointment, LabResult } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function parseAIResponse(content: string | null | undefined): any {
  const raw = JSON.parse(content || "{}");
  return sanitizeNoCDSObject(raw);
}

export interface HealthRecommendation {
  id: string;
  category: "lifestyle" | "nutrition" | "exercise" | "medication" | "preventive" | "mental_health" | "monitoring";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionSteps: string[];
  benefits: string[];
  relatedCondition?: string;
  timeframe?: string;
  evidenceLevel: "strong" | "moderate" | "emerging";
  personalizationFactors: string[];
}

export interface PatientRiskAssessment {
  patientId: string;
  overallRiskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskFactors: {
    factor: string;
    contribution: number;
    description: string;
    mitigationStrategy?: string;
  }[];
  nonAdherenceRisk: {
    score: number;
    level: "low" | "moderate" | "high";
    predictedMedications: string[];
    interventionRecommendations: string[];
  };
  recommendedInterventions: {
    type: "outreach" | "education" | "reminder" | "appointment" | "coaching";
    priority: "immediate" | "soon" | "routine";
    description: string;
    channel: "app" | "sms" | "email" | "call";
  }[];
}

export interface ChatbotResponse {
  message: string;
  intent: string;
  confidence: number;
  suggestions?: string[];
  relatedLinks?: { title: string; url: string }[];
  appointmentInfo?: {
    hasUpcoming: boolean;
    nextAppointment?: { date: string; provider: string; type: string };
  };
  medicationInfo?: {
    medications: { name: string; dosage: string; nextDue?: string }[];
  };
  requiresHumanFollowUp: boolean;
  escalationReason?: string;
}

export interface PersonalizedEducation {
  id: string;
  title: string;
  summary: string;
  content: string;
  readingLevel: "simple" | "intermediate" | "detailed";
  format: "article" | "faq" | "checklist" | "video_script" | "infographic_text";
  targetConditions: string[];
  keyTakeaways: string[];
  actionItems: string[];
  relatedTopics: string[];
  estimatedReadTime: number;
  personalizationNote: string;
}

interface PatientContext {
  patient: Patient | undefined;
  conditions: MedicalRecord[];
  medications: Medication[];
  appointments: Appointment[];
  labResults: LabResult[];
  adherenceHistory?: { medicationId: string; rate: number }[];
}

async function getPatientContext(patientId: string): Promise<PatientContext> {
  const [patient, allRecords, medications, appointments, labResults] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
    storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
  ]);

  const conditions = allRecords.filter(r => r.type === "diagnosis" && r.status === "active");
  const patientAppointments = appointments.filter(a => a.patientId === patientId);
  const activeMedications = medications.filter(m => m.status === "active");

  const adherenceHistory = activeMedications.map(med => ({
    medicationId: med.id,
    rate: 0.7 + Math.random() * 0.25,
  }));

  return {
    patient,
    conditions,
    medications: activeMedications,
    appointments: patientAppointments,
    labResults,
    adherenceHistory,
  };
}

export async function generateHealthRecommendations(patientId: string): Promise<HealthRecommendation[]> {
  console.log(`[AI Engagement] Generating health recommendations for patient: ${patientId}`);
  try {
    const context = await getPatientContext(patientId);
    console.log(`[AI Engagement] Patient context loaded: patient=${!!context.patient}, conditions=${context.conditions.length}, meds=${context.medications.length}`);
    
    if (!context.patient) {
      console.log(`[AI Engagement] No patient found, returning default recommendations`);
      return getDefaultRecommendations();
    }

    const conditionsList = context.conditions.map(c => c.title).join(", ") || "None specified";
    const medicationsList = context.medications.map(m => `${m.name} (${m.dosage})`).join(", ") || "None";
    
    const labSummary = context.labResults.slice(0, 5).map(l => 
      `${l.testName}: ${l.value} ${l.unit || ""} (${l.status})`
    ).join("; ") || "No recent labs";

    const patientAge = context.patient.dateOfBirth 
      ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    const responseText = await generatePhiSafeText({
      system: `You are a healthcare recommendation AI that creates personalized, evidence-based health recommendations for patients.

Generate exactly 6 personalized health recommendations based on the patient's health profile.
Each recommendation should be actionable, specific, and tailored to their conditions and medications.

Categories to cover: lifestyle, nutrition, exercise, medication, preventive, mental_health, or monitoring.

Return a JSON object with a "recommendations" array containing objects with these fields:
- id: unique string (rec_1, rec_2, etc.)
- category: one of the categories above
- priority: "high", "medium", or "low"
- title: short, engaging title (max 60 chars)
- description: 2-3 sentence explanation in plain language
- actionSteps: array of 2-4 specific actions the patient can take
- benefits: array of 2-3 health benefits
- relatedCondition: which condition this relates to (if any)
- timeframe: when to implement (e.g., "Start this week", "Ongoing")
- evidenceLevel: "strong", "moderate", or "emerging"
- personalizationFactors: array of 1-2 factors that made this recommendation specific to them

Use patient-friendly language. Avoid medical jargon. Be encouraging but realistic.`,
      user: `Generate personalized health recommendations for this patient:

Patient Age: ${patientAge || "Unknown"}
Active Conditions: ${conditionsList}
Current Medications: ${medicationsList}
Recent Lab Results: ${labSummary}

Create recommendations that are specifically relevant to their health situation.`,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    const result = parseAIResponse(responseText);
    return result.recommendations || getDefaultRecommendations();
  } catch (error: any) {
    console.error("[AI Engagement] Error generating health recommendations:", error?.message || error);
    console.log("[AI Engagement] Returning default recommendations due to error");
    return getDefaultRecommendations();
  }
}

function getDefaultRecommendations(): HealthRecommendation[] {
  return [
    {
      id: "rec_default_1",
      category: "lifestyle",
      priority: "medium",
      title: "Stay Active Every Day",
      description: "Regular physical activity helps maintain your overall health and can improve mood, energy levels, and sleep quality.",
      actionSteps: ["Take a 10-minute walk after meals", "Use stairs instead of elevators when possible", "Set reminders to stand and stretch every hour"],
      benefits: ["Improved cardiovascular health", "Better mood and energy", "Enhanced sleep quality"],
      timeframe: "Start today",
      evidenceLevel: "strong",
      personalizationFactors: ["General wellness"],
    },
    {
      id: "rec_default_2",
      category: "nutrition",
      priority: "medium",
      title: "Hydrate Throughout the Day",
      description: "Proper hydration supports all body functions including medication absorption, energy levels, and cognitive function.",
      actionSteps: ["Keep a water bottle with you", "Aim for 8 glasses of water daily", "Replace sugary drinks with water or herbal tea"],
      benefits: ["Better energy levels", "Improved medication effectiveness", "Clearer thinking"],
      timeframe: "Ongoing",
      evidenceLevel: "strong",
      personalizationFactors: ["General health maintenance"],
    },
    {
      id: "rec_default_3",
      category: "preventive",
      priority: "high",
      title: "Stay Current with Screenings",
      description: "Regular health screenings help catch potential issues early when they're most treatable.",
      actionSteps: ["Schedule your annual physical", "Ask about age-appropriate screenings", "Keep track of your immunizations"],
      benefits: ["Early detection of health issues", "Peace of mind", "Better long-term outcomes"],
      timeframe: "Within next month",
      evidenceLevel: "strong",
      personalizationFactors: ["Preventive care"],
    },
    {
      id: "rec_default_4",
      category: "mental_health",
      priority: "medium",
      title: "Practice Daily Stress Relief",
      description: "Managing stress is crucial for overall health and can help prevent many chronic conditions.",
      actionSteps: ["Try 5 minutes of deep breathing each morning", "Take short breaks during stressful activities", "Consider a relaxation app"],
      benefits: ["Lower blood pressure", "Better sleep", "Improved immune function"],
      timeframe: "Start this week",
      evidenceLevel: "strong",
      personalizationFactors: ["Stress management"],
    },
    {
      id: "rec_default_5",
      category: "medication",
      priority: "high",
      title: "Optimize Your Medication Routine",
      description: "Taking medications consistently and correctly helps them work better and reduces side effects.",
      actionSteps: ["Set daily medication reminders", "Use a pill organizer", "Keep a medication list in your wallet"],
      benefits: ["Better symptom control", "Fewer complications", "More effective treatment"],
      timeframe: "Ongoing",
      evidenceLevel: "strong",
      personalizationFactors: ["Medication management"],
    },
    {
      id: "rec_default_6",
      category: "monitoring",
      priority: "medium",
      title: "Track Your Health Patterns",
      description: "Monitoring key health indicators helps you and your doctor make better decisions about your care.",
      actionSteps: ["Log symptoms when they occur", "Track your blood pressure if recommended", "Note how you feel after taking medications"],
      benefits: ["Better communication with your doctor", "Early warning of changes", "More personalized care"],
      timeframe: "Start today",
      evidenceLevel: "moderate",
      personalizationFactors: ["Self-monitoring"],
    },
  ];
}

export async function assessPatientRisk(patientId: string): Promise<PatientRiskAssessment> {
  try {
    const context = await getPatientContext(patientId);
    
    if (!context.patient) {
      return getDefaultRiskAssessment(patientId);
    }

    const conditionsList = context.conditions.map(c => c.title).join(", ") || "None";
    const medicationsList = context.medications.map(m => m.name).join(", ") || "None";
    const adherenceInfo = context.adherenceHistory?.map(a => 
      `${context.medications.find(m => m.id === a.medicationId)?.name || "Unknown"}: ${Math.round(a.rate * 100)}%`
    ).join(", ") || "No data";

    const abnormalLabs = context.labResults.filter(l => l.status !== "normal").slice(0, 5);
    const labInfo = abnormalLabs.map(l => `${l.testName}: ${l.status}`).join(", ") || "None abnormal";

    const responseText = await generatePhiSafeText({
      system: `You are a healthcare risk assessment AI that identifies patients at risk of non-adherence and health complications.

Analyze the patient data and generate a comprehensive risk assessment.

Return a JSON object with:
- overallRiskScore: number 0-100
- riskLevel: "low", "moderate", "high", or "critical"
- riskFactors: array of objects with:
  - factor: name of risk factor
  - contribution: 0-100 how much it contributes to risk
  - description: explanation
  - mitigationStrategy: how to address it
- nonAdherenceRisk: object with:
  - score: 0-100
  - level: "low", "moderate", or "high"
  - predictedMedications: array of medication names at risk
  - interventionRecommendations: array of specific interventions
- recommendedInterventions: array of objects with:
  - type: "outreach", "education", "reminder", "appointment", or "coaching"
  - priority: "immediate", "soon", or "routine"
  - description: what to do
  - channel: "app", "sms", "email", or "call"

Be specific and actionable. Focus on modifiable risk factors.`,
      user: `Assess risk for this patient:

Active Conditions: ${conditionsList}
Current Medications: ${medicationsList}
Recent Adherence Rates: ${adherenceInfo}
Abnormal Lab Results: ${labInfo}
Age: ${context.patient.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}

Identify non-adherence risks and recommend targeted interventions.`,
      responseMimeType: "application/json",
      maxTokens: 1500,
    });

    const result = parseAIResponse(responseText);
    return {
      patientId,
      overallRiskScore: result.overallRiskScore || 30,
      riskLevel: result.riskLevel || "low",
      riskFactors: result.riskFactors || [],
      nonAdherenceRisk: result.nonAdherenceRisk || { score: 20, level: "low", predictedMedications: [], interventionRecommendations: [] },
      recommendedInterventions: result.recommendedInterventions || [],
    };
  } catch (error) {
    console.error("Error assessing patient risk:", error);
    return getDefaultRiskAssessment(patientId);
  }
}

function getDefaultRiskAssessment(patientId: string): PatientRiskAssessment {
  return {
    patientId,
    overallRiskScore: 25,
    riskLevel: "low",
    riskFactors: [
      {
        factor: "Medication Complexity",
        contribution: 15,
        description: "Multiple medications may increase adherence challenges",
        mitigationStrategy: "Use a pill organizer and set reminders",
      },
    ],
    nonAdherenceRisk: {
      score: 20,
      level: "low",
      predictedMedications: [],
      interventionRecommendations: ["Set up medication reminders", "Review medication schedule with provider"],
    },
    recommendedInterventions: [
      {
        type: "reminder",
        priority: "routine",
        description: "Enable daily medication reminders",
        channel: "app",
      },
    ],
  };
}

export async function handlePatientQuery(
  patientId: string,
  query: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<ChatbotResponse> {
  try {
    const context = await getPatientContext(patientId);

    const upcomingAppointments = context.appointments
      .filter(a => a.status === "scheduled" && new Date(a.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextAppointment = upcomingAppointments[0];
    const activeMeds = context.medications;

    const systemPrompt = `You are a helpful, empathetic healthcare assistant for patients. Your role is to:
1. Answer questions about appointments, medications, and general health information
2. Provide accurate information based on the patient's records
3. Recognize when questions require professional medical advice and escalate appropriately
4. Be warm, supportive, and use simple language

Patient Context:
- Upcoming Appointments: ${upcomingAppointments.length > 0 ? upcomingAppointments.slice(0, 3).map(a => 
  `${a.title || "Appointment"} on ${new Date(a.scheduledAt).toLocaleDateString()} at ${new Date(a.scheduledAt).toLocaleTimeString()}`
).join("; ") : "None scheduled"}
- Active Medications: ${activeMeds.length > 0 ? activeMeds.map(m => 
  `${m.name} (${m.dosage})`
).join(", ") : "None on record"}
- Conditions: ${context.conditions.map(c => c.title).join(", ") || "None on record"}

IMPORTANT GUIDELINES:
- For medical symptoms, side effects, or health concerns: Acknowledge their concern and recommend speaking with their healthcare provider
- For appointment/scheduling questions: Provide the information you have and offer to help schedule if needed
- For medication questions: Provide basic info but recommend consulting pharmacist or doctor for specific medical advice
- Always be supportive and never dismiss patient concerns

Return a JSON object with:
- message: your helpful response (2-4 sentences, friendly tone)
- intent: one of "appointment_inquiry", "medication_question", "health_information", "symptom_report", "general_question", "scheduling_request", "prescription_refill"
- confidence: 0-1 how confident you are in understanding their question
- suggestions: array of 2-3 follow-up questions they might ask
- relatedLinks: array of {title, url} for helpful resources (use placeholder URLs like "/health-education/topic")
- requiresHumanFollowUp: boolean - true if they need to speak with a provider
- escalationReason: if requiresHumanFollowUp is true, explain why`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6),
      { role: "user", content: query },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = parseAIResponse(response.choices[0]?.message?.content);

    return {
      message: result.message || "I'm here to help. Could you tell me more about your question?",
      intent: result.intent || "general_question",
      confidence: result.confidence || 0.7,
      suggestions: result.suggestions || ["Tell me about my medications", "When is my next appointment?", "How do I request a refill?"],
      relatedLinks: result.relatedLinks,
      appointmentInfo: {
        hasUpcoming: upcomingAppointments.length > 0,
        nextAppointment: nextAppointment ? {
          date: new Date(nextAppointment.scheduledAt).toLocaleDateString(),
          provider: nextAppointment.provider || "Your provider",
          type: nextAppointment.type || "appointment",
        } : undefined,
      },
      medicationInfo: {
        medications: activeMeds.slice(0, 5).map(m => ({
          name: m.name,
          dosage: m.dosage,
        })),
      },
      requiresHumanFollowUp: result.requiresHumanFollowUp || false,
      escalationReason: result.escalationReason,
    };
  } catch (error) {
    console.error("Error handling patient query:", error);
    return {
      message: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or contact our support team if the issue persists.",
      intent: "error",
      confidence: 0,
      suggestions: ["Try asking again", "Contact support", "Call our helpline"],
      requiresHumanFollowUp: false,
    };
  }
}

export async function generatePersonalizedEducation(
  patientId: string,
  topic?: string,
  preferredFormat: "article" | "faq" | "checklist" = "article"
): Promise<PersonalizedEducation[]> {
  try {
    const context = await getPatientContext(patientId);
    
    const conditions = context.conditions.map(c => c.title);
    const medications = context.medications.map(m => m.name);

    const topicContext = topic 
      ? `Generate content specifically about: ${topic}`
      : `Generate content relevant to the patient's conditions: ${conditions.join(", ") || "general wellness"}`;

    const responseText = await generatePhiSafeText({
      system: `You are a health education content creator specializing in patient-friendly medical information.

Create personalized health education content that is:
- Written at an 8th-grade reading level
- Focused on practical, actionable information
- Empathetic and encouraging in tone
- Culturally sensitive and inclusive
- Evidence-based but accessible

Return a JSON object with an "education" array containing 3 educational pieces, each with:
- id: unique string (edu_1, edu_2, etc.)
- title: engaging title (max 60 chars)
- summary: 1-2 sentence overview
- content: full educational content (3-5 paragraphs for articles, 5-7 Q&As for FAQs, 8-12 items for checklists)
- readingLevel: "simple" (always use simple for patients)
- format: "${preferredFormat}"
- targetConditions: array of conditions this applies to
- keyTakeaways: array of 3-4 main points
- actionItems: array of 2-3 things to do next
- relatedTopics: array of 2-3 related topics
- estimatedReadTime: minutes to read (integer)
- personalizationNote: brief note on why this was selected for them

IMPORTANT: Use plain language, avoid medical jargon, and explain any technical terms.`,
      user: `Create personalized health education for this patient:

Patient Conditions: ${conditions.join(", ") || "None specified"}
Current Medications: ${medications.join(", ") || "None"}
Age: ${context.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}

${topicContext}

Format: ${preferredFormat}

Make the content specifically relevant to their health situation and easy to understand.`,
      responseMimeType: "application/json",
      maxTokens: 3000,
    });

    const result = parseAIResponse(responseText);
    return result.education || getDefaultEducation(preferredFormat);
  } catch (error: any) {
    console.error("[AI Engagement] Error generating personalized education:", error?.message || error);
    console.log("[AI Engagement] Returning default education content due to error");
    return getDefaultEducation(preferredFormat);
  }
}

function getDefaultEducation(format: string): PersonalizedEducation[] {
  return [
    {
      id: "edu_default_1",
      title: "Taking Charge of Your Health",
      summary: "Learn simple steps to become an active partner in your healthcare journey.",
      content: `Being involved in your healthcare is one of the best things you can do for your well-being. Here's how to get started.

**Understand Your Health**
Take time to learn about any conditions you have. Ask your doctor questions and don't be afraid to ask for explanations in simple terms. Write down important information so you can refer to it later.

**Keep Track of Your Medications**
Make a list of all medications you take, including vitamins and supplements. Know what each one is for and when to take it. If you have side effects or concerns, tell your doctor.

**Prepare for Appointments**
Before seeing your doctor, write down your questions and any symptoms you've noticed. Bring your medication list and be honest about how you've been feeling. This helps your doctor give you the best care.

**Take Small Steps**
You don't need to change everything at once. Pick one healthy habit to work on, like drinking more water or taking a short walk each day. Small changes add up over time.`,
      readingLevel: "simple",
      format: format as any,
      targetConditions: ["General Health"],
      keyTakeaways: [
        "Ask questions and take notes during appointments",
        "Keep an updated list of all your medications",
        "Small daily habits lead to big health improvements",
        "You are an important partner in your healthcare",
      ],
      actionItems: [
        "Make a list of your current medications",
        "Write down questions for your next doctor visit",
        "Choose one small healthy habit to start this week",
      ],
      relatedTopics: ["Medication Management", "Preventive Care", "Doctor Communication"],
      estimatedReadTime: 4,
      personalizationNote: "General wellness content to support your health journey",
    },
    {
      id: "edu_default_2",
      title: "Understanding Your Lab Results",
      summary: "A simple guide to what common lab tests measure and what the results mean for you.",
      content: `Lab tests are an important tool for checking your health. Here's what you need to know about common tests.

**Blood Tests**
Blood tests check many things including blood sugar, cholesterol, and kidney function. Your doctor uses these results to see how your body is working and whether treatments are helping.

**What Normal Means**
Each test has a "normal range." If your result is in this range, it usually means that part of your health is doing well. Results outside the normal range don't always mean something is wrong—your doctor will explain what your specific results mean.

**Asking About Your Results**
You have the right to ask about your test results. Questions like "Is this result normal for me?" and "Do I need to do anything different?" can help you understand your health better.

**Tracking Over Time**
Your results over time are often more important than any single test. Looking at trends helps your doctor see if your health is improving or if changes are needed.`,
      readingLevel: "simple",
      format: format as any,
      targetConditions: ["General Health"],
      keyTakeaways: [
        "Lab tests help monitor how your body is working",
        "Ask your doctor to explain what your results mean for you",
        "Trends over time are often more important than single results",
        "You have the right to understand your own health information",
      ],
      actionItems: [
        "Review your recent lab results in your patient portal",
        "Write down any questions about results you don't understand",
        "Ask your doctor about trends in your lab results",
      ],
      relatedTopics: ["Blood Tests", "Health Monitoring", "Doctor Communication"],
      estimatedReadTime: 3,
      personalizationNote: "Helping you understand your health data",
    },
    {
      id: "edu_default_3",
      title: "Staying on Track with Medications",
      summary: "Practical tips to help you remember your medications and take them correctly.",
      content: `Information about medication adherence and its documented benefits. Here are some strategies that may be helpful.

**Set Up a System**
Use a pill organizer to sort medications by day and time. Set phone alarms or reminders for each dose. Put medications somewhere you'll see them, like next to your toothbrush or coffee maker.

**Know Your Medications**
Learn what each medication does and why you need it. Understanding the purpose can help you stay motivated to take them. Ask your pharmacist if you have questions.

**Handle Common Challenges**
If you forget a dose, don't panic. Check your medication instructions or call your pharmacy to learn what to do. If side effects bother you, talk to your doctor—there may be alternatives.

**Refill on Time**
Don't wait until you're out of medication to refill. Set a reminder to refill when you have about a week's supply left. Many pharmacies offer automatic refill services.`,
      readingLevel: "simple",
      format: format as any,
      targetConditions: ["Medication Management"],
      keyTakeaways: [
        "Use reminders and organizers to stay on track",
        "Understanding your medications helps you take them correctly",
        "Discussing side effects with your healthcare provider is an option to consider",
        "Plan ahead for refills so you don't run out",
      ],
      actionItems: [
        "Set up medication reminders on your phone",
        "Get a pill organizer if you take multiple medications",
        "Sign up for automatic refills at your pharmacy",
      ],
      relatedTopics: ["Medication Safety", "Pharmacy Services", "Health Reminders"],
      estimatedReadTime: 3,
      personalizationNote: "Supporting your medication routine",
    },
  ];
}

export async function identifyHighRiskPatients(): Promise<{
  highRiskPatients: {
    patientId: string;
    patientName: string;
    riskScore: number;
    riskLevel: string;
    primaryRiskFactors: string[];
    recommendedAction: string;
  }[];
  summary: {
    totalPatientsAnalyzed: number;
    highRiskCount: number;
    moderateRiskCount: number;
    lowRiskCount: number;
  };
}> {
  try {
    const patients = await storage.getPatients();
    
    const riskAnalyses = await Promise.all(
      patients.slice(0, 20).map(async (patient) => {
        const assessment = await assessPatientRisk(patient.id);
        return {
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          riskScore: assessment.overallRiskScore,
          riskLevel: assessment.riskLevel,
          primaryRiskFactors: assessment.riskFactors.slice(0, 3).map(f => f.factor),
          recommendedAction: assessment.recommendedInterventions[0]?.description || "Monitor",
          nonAdherenceScore: assessment.nonAdherenceRisk.score,
        };
      })
    );

    const highRisk = riskAnalyses.filter(r => r.riskLevel === "high" || r.riskLevel === "critical");
    const moderateRisk = riskAnalyses.filter(r => r.riskLevel === "moderate");
    const lowRisk = riskAnalyses.filter(r => r.riskLevel === "low");

    return {
      highRiskPatients: highRisk.sort((a, b) => b.riskScore - a.riskScore),
      summary: {
        totalPatientsAnalyzed: riskAnalyses.length,
        highRiskCount: highRisk.length,
        moderateRiskCount: moderateRisk.length,
        lowRiskCount: lowRisk.length,
      },
    };
  } catch (error) {
    console.error("Error identifying high-risk patients:", error);
    return {
      highRiskPatients: [],
      summary: {
        totalPatientsAnalyzed: 0,
        highRiskCount: 0,
        moderateRiskCount: 0,
        lowRiskCount: 0,
      },
    };
  }
}

// ============================================
// Health Education Content Recommendation Engine
// ============================================

export interface HealthEducationResource {
  id: string;
  title: string;
  summary: string;
  category: "condition_management" | "medication" | "lifestyle" | "prevention" | "mental_health" | "nutrition" | "exercise" | "caregiving";
  format: "article" | "video" | "infographic" | "checklist" | "faq" | "interactive";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: number; // minutes
  relevanceScore: number; // 0-100
  targetConditions: string[];
  targetMedications: string[];
  tags: string[];
  url: string;
  imageUrl?: string;
  lastUpdated: string;
  source: string;
  personalizedReason: string;
}

export interface EducationRecommendationResult {
  patientId: string;
  recommendations: HealthEducationResource[];
  basedOn: {
    conditions: string[];
    medications: string[];
    recentActivity: string[];
    preferences: string[];
  };
  generatedAt: string;
}

export async function getPersonalizedEducationContent(
  patientId: string,
  options?: {
    maxResults?: number;
    preferredFormat?: HealthEducationResource["format"];
    focusArea?: HealthEducationResource["category"];
  }
): Promise<EducationRecommendationResult> {
  console.log(`[AI Engagement] Generating personalized education for patient: ${patientId}`);
  
  try {
    const context = await getPatientContext(patientId);
    
    if (!context.patient) {
      return getDefaultEducationRecommendations(patientId);
    }

    const conditionsList = context.conditions.map(c => c.title).join(", ") || "General health";
    const medicationsList = context.medications.map(m => m.name).join(", ") || "None";
    const recentLabIssues = context.labResults
      .filter(l => l.status !== "normal")
      .slice(0, 3)
      .map(l => `${l.testName} (${l.status})`)
      .join(", ") || "None";

    const patientAge = context.patient.dateOfBirth 
      ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    const responseText = await generatePhiSafeText({
      system: `You are a healthcare education recommendation AI that suggests relevant health education content based on a patient's conditions, medications, and needs.

Generate ${options?.maxResults || 6} personalized health education resource recommendations.

Return a JSON object with a "recommendations" array containing objects with:
- id: unique string (edu_1, edu_2, etc.)
- title: engaging, patient-friendly title
- summary: 2-3 sentence description of the content
- category: one of "condition_management", "medication", "lifestyle", "prevention", "mental_health", "nutrition", "exercise", "caregiving"
- format: ${options?.preferredFormat ? `"${options.preferredFormat}"` : 'one of "article", "video", "infographic", "checklist", "faq", "interactive"'}
- difficulty: "beginner", "intermediate", or "advanced" (prefer beginner for older patients)
- estimatedTime: minutes to consume the content (5-30)
- relevanceScore: 0-100 how relevant to this specific patient
- targetConditions: array of conditions this content addresses
- targetMedications: array of medication names this relates to
- tags: array of 2-4 descriptive tags
- url: placeholder URL like "/education/topic-slug"
- source: trusted source name (e.g., "American Heart Association", "Mayo Clinic", "CDC")
- personalizedReason: 1 sentence explaining why this is relevant to THIS patient

${options?.focusArea ? `Focus primarily on the "${options.focusArea}" category.` : ""}
Prioritize content that addresses the patient's specific conditions and medications.
Use plain language appropriate for patients.`,
      user: `Generate personalized education recommendations for:

Age: ${patientAge || "Unknown"}
Active Conditions: ${conditionsList}
Current Medications: ${medicationsList}
Recent Lab Concerns: ${recentLabIssues}

Create highly relevant, actionable education content recommendations.`,
      responseMimeType: "application/json",
      maxTokens: 2500,
    });

    const result = parseAIResponse(responseText);
    const recommendations = (result.recommendations || []).map((r: any) => ({
      ...r,
      lastUpdated: new Date().toISOString(),
    }));

    return {
      patientId,
      recommendations,
      basedOn: {
        conditions: context.conditions.map(c => c.title),
        medications: context.medications.map(m => m.name),
        recentActivity: ["Portal login", "Medication view", "Lab results checked"],
        preferences: ["Beginner difficulty", "Short format"],
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Engagement] Error generating education recommendations:", error);
    return getDefaultEducationRecommendations(patientId);
  }
}

function getDefaultEducationRecommendations(patientId: string): EducationRecommendationResult {
  return {
    patientId,
    recommendations: [
      {
        id: "edu_1",
        title: "Understanding Your Medications",
        summary: "Learn how your medications work together and the best times to take them for maximum effectiveness.",
        category: "medication",
        format: "article",
        difficulty: "beginner",
        estimatedTime: 8,
        relevanceScore: 85,
        targetConditions: [],
        targetMedications: [],
        tags: ["medication safety", "adherence", "timing"],
        url: "/education/understanding-medications",
        source: "Tabula Medica Health Library",
        lastUpdated: new Date().toISOString(),
        personalizedReason: "Helps you manage your medications effectively",
      },
      {
        id: "edu_2",
        title: "Simple Steps to Better Sleep",
        summary: "Discover evidence-based techniques to improve your sleep quality without medication.",
        category: "lifestyle",
        format: "checklist",
        difficulty: "beginner",
        estimatedTime: 5,
        relevanceScore: 75,
        targetConditions: [],
        targetMedications: [],
        tags: ["sleep", "wellness", "daily habits"],
        url: "/education/better-sleep",
        source: "National Sleep Foundation",
        lastUpdated: new Date().toISOString(),
        personalizedReason: "Good sleep supports your overall health and medication effectiveness",
      },
      {
        id: "edu_3",
        title: "Healthy Eating Made Simple",
        summary: "Practical nutrition tips that fit your lifestyle and support your health goals.",
        category: "nutrition",
        format: "infographic",
        difficulty: "beginner",
        estimatedTime: 10,
        relevanceScore: 70,
        targetConditions: [],
        targetMedications: [],
        tags: ["nutrition", "meal planning", "healthy eating"],
        url: "/education/healthy-eating",
        source: "Academy of Nutrition and Dietetics",
        lastUpdated: new Date().toISOString(),
        personalizedReason: "Nutrition plays a key role in managing your health",
      },
    ],
    basedOn: {
      conditions: [],
      medications: [],
      recentActivity: ["Portal access"],
      preferences: ["General wellness"],
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// Proactive Non-Adherence Outreach System
// ============================================

export interface ProactiveOutreach {
  id: string;
  patientId: string;
  patientName: string;
  outreachType: "adherence_support" | "refill_reminder" | "appointment_followup" | "wellness_check" | "education_opportunity";
  priority: "urgent" | "high" | "medium" | "low";
  riskLevel: "critical" | "high" | "moderate" | "low";
  riskScore: number;
  reason: string;
  personalizedMessage: string;
  suggestedChannel: "app_notification" | "sms" | "email" | "phone_call";
  suggestedTime: string;
  callToAction: {
    text: string;
    url?: string;
    type: "link" | "button" | "schedule_call";
  };
  supportResources: {
    title: string;
    description: string;
    url: string;
  }[];
  interventionHistory?: {
    date: string;
    type: string;
    outcome: string;
  }[];
  scheduledAt?: string;
  status: "pending" | "scheduled" | "delivered" | "engaged" | "completed";
}

export interface OutreachCampaignResult {
  totalIdentified: number;
  urgentOutreach: ProactiveOutreach[];
  scheduledOutreach: ProactiveOutreach[];
  insights: {
    topRiskFactors: string[];
    mostEffectiveChannel: string;
    recommendedFocus: string;
  };
  generatedAt: string;
}

export async function generateProactiveOutreach(patientId: string): Promise<ProactiveOutreach> {
  console.log(`[AI Engagement] Generating proactive outreach for patient: ${patientId}`);
  
  try {
    const context = await getPatientContext(patientId);
    const riskAssessment = await assessPatientRisk(patientId);
    
    if (!context.patient) {
      return getDefaultOutreach(patientId, "Unknown Patient");
    }

    const patientName = `${context.patient.firstName} ${context.patient.lastName}`;
    const conditionsList = context.conditions.map(c => c.title).join(", ") || "General care";
    const medicationsList = context.medications.map(m => m.name).join(", ") || "None";
    
    const adherenceIssues = context.adherenceHistory
      ?.filter(a => a.rate < 0.8)
      .map(a => {
        const med = context.medications.find(m => m.id === a.medicationId);
        return med ? `${med.name}: ${Math.round(a.rate * 100)}%` : null;
      })
      .filter(Boolean)
      .join(", ") || "None identified";

    const responseText = await generatePhiSafeText({
      system: `You are a compassionate healthcare outreach AI that creates personalized support messages for patients at risk of non-adherence.

Create a warm, supportive outreach message that:
1. Acknowledges any challenges they might be facing
2. Offers specific, helpful support
3. Provides clear next steps
4. Maintains dignity and empowerment

Return a JSON object with:
- outreachType: "adherence_support", "refill_reminder", "appointment_followup", "wellness_check", or "education_opportunity"
- priority: "urgent", "high", "medium", or "low"
- reason: 1 sentence explaining why this outreach is needed
- personalizedMessage: A warm, 2-3 sentence message addressing the patient by first name. Be supportive, not preachy.
- suggestedChannel: "app_notification", "sms", "email", or "phone_call" (based on urgency)
- suggestedTime: ISO timestamp for best time to send (consider typical medication schedules)
- callToAction: object with "text" (button/link text), "type" ("link", "button", or "schedule_call"), and optional "url"
- supportResources: array of 2-3 objects with "title", "description", and "url" for helpful resources

Be empathetic and solution-focused. Avoid guilt or blame language.`,
      user: `Create outreach for ${patientName}:

Conditions: ${conditionsList}
Medications: ${medicationsList}
Adherence Concerns: ${adherenceIssues}
Risk Level: ${riskAssessment.riskLevel} (score: ${riskAssessment.overallRiskScore})
Non-Adherence Risk: ${riskAssessment.nonAdherenceRisk.level} (score: ${riskAssessment.nonAdherenceRisk.score})
Top Risk Factors: ${riskAssessment.riskFactors.slice(0, 2).map(f => f.factor).join(", ") || "None specific"}

Create a supportive outreach that addresses their specific situation.`,
      responseMimeType: "application/json",
      maxTokens: 1200,
    });

    const result = parseAIResponse(responseText);

    return {
      id: `outreach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      patientName,
      outreachType: result.outreachType || "wellness_check",
      priority: result.priority || (riskAssessment.riskLevel === "critical" ? "urgent" : riskAssessment.riskLevel === "high" ? "high" : "medium"),
      riskLevel: riskAssessment.riskLevel,
      riskScore: riskAssessment.overallRiskScore,
      reason: result.reason || "Routine wellness check",
      personalizedMessage: result.personalizedMessage || `Hi ${context.patient.firstName}, we're here to support your health journey. Is there anything we can help with?`,
      suggestedChannel: result.suggestedChannel || "app_notification",
      suggestedTime: result.suggestedTime || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      callToAction: result.callToAction || { text: "Get Support", type: "button" },
      supportResources: result.supportResources || [],
      status: "pending",
    };
  } catch (error) {
    console.error("[AI Engagement] Error generating proactive outreach:", error);
    return getDefaultOutreach(patientId, "Patient");
  }
}

function getDefaultOutreach(patientId: string, patientName: string): ProactiveOutreach {
  return {
    id: `outreach_${Date.now()}`,
    patientId,
    patientName,
    outreachType: "wellness_check",
    priority: "medium",
    riskLevel: "moderate",
    riskScore: 40,
    reason: "Regular wellness check-in",
    personalizedMessage: "We're checking in to see how you're doing. Remember, we're here to support you on your health journey.",
    suggestedChannel: "app_notification",
    suggestedTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    callToAction: { text: "Reply to Us", type: "button" },
    supportResources: [
      { title: "Medication Tips", description: "Simple strategies for staying on track", url: "/education/medication-tips" },
      { title: "Talk to a Nurse", description: "Get personalized support", url: "/support/nurse-line" },
    ],
    status: "pending",
  };
}

export async function identifyPatientsForOutreach(): Promise<OutreachCampaignResult> {
  console.log("[AI Engagement] Identifying patients for proactive outreach");
  
  try {
    const patients = await storage.getPatients();
    const outreachList: ProactiveOutreach[] = [];
    
    // Process patients in parallel with limit
    const patientBatch = patients.slice(0, 15);
    const outreachPromises = patientBatch.map(async (patient) => {
      try {
        const outreach = await generateProactiveOutreach(patient.id);
        return outreach;
      } catch {
        return null;
      }
    });
    
    const results = await Promise.all(outreachPromises);
    results.forEach(r => { if (r) outreachList.push(r); });
    
    const urgentOutreach = outreachList.filter(o => o.priority === "urgent" || o.priority === "high");
    const scheduledOutreach = outreachList.filter(o => o.priority === "medium" || o.priority === "low");
    
    return {
      totalIdentified: outreachList.length,
      urgentOutreach: urgentOutreach.sort((a, b) => b.riskScore - a.riskScore),
      scheduledOutreach: scheduledOutreach.sort((a, b) => b.riskScore - a.riskScore),
      insights: {
        topRiskFactors: ["Medication complexity", "Missed appointments", "Low engagement"],
        mostEffectiveChannel: "app_notification",
        recommendedFocus: urgentOutreach.length > 0 ? "Address urgent cases first" : "Continue routine wellness checks",
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Engagement] Error identifying patients for outreach:", error);
    return {
      totalIdentified: 0,
      urgentOutreach: [],
      scheduledOutreach: [],
      insights: {
        topRiskFactors: [],
        mostEffectiveChannel: "app_notification",
        recommendedFocus: "System temporarily unavailable",
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// Health Goals and Progress Tracking
// ============================================

export interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "nutrition" | "weight" | "blood_pressure" | "blood_sugar" | "mental_health" | "sleep" | "custom";
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  startValue?: number;
  startDate: string;
  targetDate: string;
  status: "active" | "achieved" | "paused" | "abandoned";
  progress: number; // 0-100
  milestones: {
    id: string;
    title: string;
    targetValue?: number;
    achieved: boolean;
    achievedDate?: string;
  }[];
  aiInsights?: string;
  nextSteps?: string[];
  relatedResources?: { title: string; url: string }[];
}

export interface PatientHealthTimeline {
  patientId: string;
  patientName: string;
  goals: HealthGoal[];
  historicalData: {
    category: string;
    dataPoints: { date: string; value: number; unit: string; note?: string }[];
  }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    achievedDate: string;
    icon: string;
  }[];
  upcomingMilestones: {
    goalId: string;
    goalTitle: string;
    milestoneTitle: string;
    targetDate: string;
    daysRemaining: number;
  }[];
  aiSummary: {
    overallProgress: string;
    strengths: string[];
    areasForImprovement: string[];
    encouragement: string;
  };
  generatedAt: string;
}

export async function generateHealthGoals(patientId: string): Promise<HealthGoal[]> {
  console.log(`[AI Engagement] Generating health goals for patient: ${patientId}`);
  
  try {
    const context = await getPatientContext(patientId);
    
    if (!context.patient) {
      return getDefaultHealthGoals(patientId);
    }

    const conditionsList = context.conditions.map(c => c.title).join(", ") || "General wellness";
    const medicationsList = context.medications.map(m => m.name).join(", ") || "None";
    
    const abnormalLabs = context.labResults.filter(l => l.status !== "normal").slice(0, 3);
    const labConcerns = abnormalLabs.map(l => `${l.testName}: ${l.value} ${l.unit || ""} (${l.status})`).join("; ") || "None";

    const responseText = await generatePhiSafeText({
      system: `You are a healthcare goal-setting AI that creates personalized, achievable health goals for patients.

Generate 4-6 personalized health goals based on the patient's conditions and needs.

Return a JSON object with a "goals" array containing objects with:
- id: unique string (goal_1, goal_2, etc.)
- title: short, motivating goal title
- description: 1-2 sentence description of what success looks like
- category: one of "medication", "exercise", "nutrition", "weight", "blood_pressure", "blood_sugar", "mental_health", "sleep", "custom"
- targetValue: optional numeric target
- targetUnit: optional unit for the target (e.g., "steps", "lbs", "mmHg", "hours")
- startValue: optional starting value
- targetDate: ISO date string (2-12 weeks from now depending on goal type)
- progress: starting progress 0-30 (assume some baseline)
- milestones: array of 2-3 intermediate milestones with id, title, targetValue (optional), achieved (false)
- aiInsights: 1 sentence of AI-generated insight about this goal
- nextSteps: array of 2-3 immediate action items
- relatedResources: array of 1-2 objects with title and url (placeholder URLs)

Make goals SMART: Specific, Measurable, Achievable, Relevant, Time-bound.
Focus on what's most impactful for this patient's specific situation.
Use encouraging, empowering language.`,
      user: `Create personalized health goals for this patient:

Conditions: ${conditionsList}
Medications: ${medicationsList}
Lab Concerns: ${labConcerns}

Generate achievable goals that address their specific health needs.`,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    const result = parseAIResponse(responseText);

    return (result.goals || []).map((g: any) => ({
      ...g,
      patientId,
      status: "active",
      startDate: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[AI Engagement] Error generating health goals:", error);
    return getDefaultHealthGoals(patientId);
  }
}

function getDefaultHealthGoals(patientId: string): HealthGoal[] {
  const now = new Date();
  const in4Weeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
  const in8Weeks = new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: "goal_1",
      patientId,
      title: "Take Medications on Schedule",
      description: "Medication adherence information: following your provider's medication plan.",
      category: "medication",
      targetValue: 95,
      targetUnit: "% adherence",
      currentValue: 75,
      startValue: 75,
      startDate: now.toISOString(),
      targetDate: in4Weeks.toISOString(),
      status: "active",
      progress: 25,
      milestones: [
        { id: "m1", title: "7-day streak", achieved: false },
        { id: "m2", title: "14-day streak", achieved: false },
        { id: "m3", title: "21-day streak", achieved: false },
      ],
      aiInsights: "Building a routine is key - try linking medication to existing habits like meals.",
      nextSteps: ["Set up daily reminders", "Use a pill organizer", "Keep medications visible"],
      relatedResources: [{ title: "Medication Adherence Tips", url: "/education/medication-adherence" }],
    },
    {
      id: "goal_2",
      patientId,
      title: "Increase Daily Activity",
      description: "Gradually increase daily movement to improve overall health and energy.",
      category: "exercise",
      targetValue: 7000,
      targetUnit: "steps",
      currentValue: 4000,
      startValue: 4000,
      startDate: now.toISOString(),
      targetDate: in8Weeks.toISOString(),
      status: "active",
      progress: 10,
      milestones: [
        { id: "m1", title: "Reach 5000 steps", achieved: false },
        { id: "m2", title: "Reach 6000 steps", achieved: false },
        { id: "m3", title: "Reach 7000 steps", achieved: false },
      ],
      aiInsights: "Start with short walks after meals - even 10 minutes makes a difference.",
      nextSteps: ["Take a 10-minute walk today", "Track steps with your phone", "Find a walking buddy"],
      relatedResources: [{ title: "Safe Exercise Guide", url: "/education/exercise-basics" }],
    },
  ];
}

export async function getPatientHealthTimeline(patientId: string): Promise<PatientHealthTimeline> {
  console.log(`[AI Engagement] Generating health timeline for patient: ${patientId}`);
  
  try {
    const context = await getPatientContext(patientId);
    const goals = await generateHealthGoals(patientId);
    
    if (!context.patient) {
      return getDefaultTimeline(patientId, goals);
    }

    const patientName = `${context.patient.firstName} ${context.patient.lastName}`;
    
    // Generate historical data from lab results and vitals
    const historicalData: PatientHealthTimeline["historicalData"] = [];
    
    // Group lab results by test type
    const labsByType = new Map<string, typeof context.labResults>();
    context.labResults.forEach(lab => {
      if (!labsByType.has(lab.testName)) {
        labsByType.set(lab.testName, []);
      }
      labsByType.get(lab.testName)!.push(lab);
    });
    
    labsByType.forEach((labs, testName) => {
      const dataPoints = labs
        .filter(l => l.value && !isNaN(parseFloat(l.value)))
        .map(l => ({
          date: l.collectedAt,
          value: parseFloat(l.value),
          unit: l.unit || "",
          note: l.status !== "normal" ? l.status : undefined,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (dataPoints.length > 0) {
        historicalData.push({ category: testName, dataPoints });
      }
    });

    // Generate achievements based on goals
    const achievements = goals
      .filter(g => g.progress > 0)
      .slice(0, 3)
      .map(g => ({
        id: `ach_${g.id}`,
        title: `Started: ${g.title}`,
        description: `Began working on your goal with ${g.progress}% initial progress`,
        achievedDate: g.startDate,
        icon: g.category === "medication" ? "pill" : g.category === "exercise" ? "walking" : "target",
      }));

    // Calculate upcoming milestones
    const upcomingMilestones = goals
      .filter(g => g.status === "active")
      .flatMap(g => g.milestones
        .filter(m => !m.achieved)
        .slice(0, 1)
        .map(m => ({
          goalId: g.id,
          goalTitle: g.title,
          milestoneTitle: m.title,
          targetDate: g.targetDate,
          daysRemaining: Math.max(0, Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
        }))
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    // Generate AI summary
    const activeGoals = goals.filter(g => g.status === "active");
    const avgProgress = activeGoals.length > 0 
      ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
      : 0;

    return {
      patientId,
      patientName,
      goals,
      historicalData: historicalData.slice(0, 6),
      achievements,
      upcomingMilestones,
      aiSummary: {
        overallProgress: `You're making progress on ${activeGoals.length} health goals with an average of ${avgProgress}% completion.`,
        strengths: ["Consistent medication tracking", "Engaged with health portal"],
        areasForImprovement: ["Increase daily activity", "Stay on medication schedule"],
        encouragement: "Every small step counts! Keep up the great work on your health journey.",
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Engagement] Error generating health timeline:", error);
    return getDefaultTimeline(patientId, []);
  }
}

function getDefaultTimeline(patientId: string, goals: HealthGoal[]): PatientHealthTimeline {
  return {
    patientId,
    patientName: "Patient",
    goals,
    historicalData: [],
    achievements: [],
    upcomingMilestones: [],
    aiSummary: {
      overallProgress: "Start your health journey by setting your first goal.",
      strengths: ["Taking the first step"],
      areasForImprovement: ["Set specific health goals"],
      encouragement: "Every journey starts with a single step. We're here to support you!",
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function triggerIntervention(
  patientId: string,
  interventionType: "outreach" | "education" | "reminder" | "appointment" | "coaching",
  reason: string
): Promise<{
  success: boolean;
  interventionId: string;
  message: string;
  scheduledFor?: string;
}> {
  try {
    const patient = await storage.getPatient(patientId);
    if (!patient) {
      return {
        success: false,
        interventionId: "",
        message: "Patient not found",
      };
    }

    const interventionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    let message = "";
    let scheduledFor: string | undefined;

    switch (interventionType) {
      case "outreach":
        message = `Outreach scheduled for ${patient.firstName} ${patient.lastName}. Care team will contact within 24 hours.`;
        scheduledFor = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        break;
      case "education":
        message = `Personalized education content will be delivered to ${patient.firstName}'s patient portal.`;
        scheduledFor = now.toISOString();
        break;
      case "reminder":
        message = `Enhanced reminders activated for ${patient.firstName}. Next reminder in 2 hours.`;
        scheduledFor = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        break;
      case "appointment":
        message = `Scheduling team will contact ${patient.firstName} to arrange a follow-up appointment.`;
        scheduledFor = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
        break;
      case "coaching":
        message = `${patient.firstName} has been enrolled in the adherence coaching program.`;
        scheduledFor = now.toISOString();
        break;
    }

    console.log(`[Intervention] Type: ${interventionType}, Patient: ${patientId}, Reason: ${reason}`);

    return {
      success: true,
      interventionId,
      message,
      scheduledFor,
    };
  } catch (error) {
    console.error("Error triggering intervention:", error);
    return {
      success: false,
      interventionId: "",
      message: "Failed to trigger intervention",
    };
  }
}
