/**
 * AI Appointment Assistant Service
 * 
 * Suggests optimal appointment times based on health trends, symptoms, and preferences.
 * Auto-populates relevant health context for clinician review.
 * 
 * SAFETY GUIDELINES:
 * - ONLY use safe verbs: "shows", "states", "refers to", "means"
 * - NO clinical recommendations, diagnosis, or urgency assessment
 * - Quote-first approach when referencing patient data
 * - Disclaimer: "Informational only. Not medical advice."
 */

export interface PatientPreferences {
  preferredDays: string[];
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  preferredProvider?: string;
  telehealth: boolean;
}

export interface HealthContext {
  recentSymptoms: Array<{
    name: string;
    severity: number;
    date: string;
  }>;
  activeConditions: string[];
  recentLabFlags: Array<{
    testName: string;
    value: string;
    date: string;
  }>;
  currentMedications: string[];
}

export interface AppointmentSuggestion {
  date: string;
  timeSlot: string;
  provider: string;
  specialty: string;
  visitType: "in-person" | "telehealth";
  reason: string;
  contextSummary: string;
  disclaimer: string;
}

export interface AppointmentRequest {
  concern: string;
  urgencyLevel: "routine" | "soon" | "urgent";
  preferredDates: string[];
  telehealth: boolean;
  additionalNotes?: string;
}

export interface AppointmentAssistantResponse {
  suggestions: AppointmentSuggestion[];
  healthContext: HealthContext;
  contextForClinician: string;
  disclaimer: string;
  generatedAt: string;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "may cause", "could indicate", "might be related", "risk of", "continue",
  "follow up", "monitor", "review", "coordinate", "prepare", "decide",
  "help", "supports", "works by affecting", "immediately", "urgent",
  "dangerous", "severe", "critical", "emergency",
];

function validateSummary(text: string): string {
  let cleaned = text;
  
  for (const word of PROHIBITED_WORDS) {
    const regex = new RegExp(word, "gi");
    cleaned = cleaned.replace(regex, "");
  }
  
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  const hasSafeVerb = SAFE_VERBS.some(verb => cleaned.toLowerCase().includes(verb));
  if (!hasSafeVerb && cleaned.length > 0) {
    cleaned = "Records show: " + cleaned;
  }
  
  return cleaned;
}

const APPOINTMENT_ASSISTANT_PROMPT = `You are an appointment scheduling assistant that helps patients find suitable times.

ONLY USE THESE 4 VERBS: "shows", "states", "refers to", "means"

NEVER:
- Make urgency assessments or clinical recommendations
- Suggest specific medical actions
- Interpret symptoms clinically
- Use words like "should", "must", "need to", "urgent"

YOUR ROLE:
- Suggest appointment times based on stated preferences
- Summarize health data for context (not interpretation)
- Use factual language only

OUTPUT FORMAT (JSON):
{
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "timeSlot": "9:00 AM - 10:00 AM",
      "provider": "Dr. Name",
      "specialty": "Primary Care",
      "visitType": "in-person|telehealth",
      "reason": "Based on stated preference for [day/time]",
      "contextSummary": "Patient records show [factual summary using safe verbs]"
    }
  ],
  "contextForClinician": "Records show [factual data summary]. This refers to [patient's stated concern]."
}`;

export async function getAppointmentSuggestions(
  patientId: string,
  request: AppointmentRequest
): Promise<AppointmentAssistantResponse> {
  const healthContext = getMockHealthContext();
  const preferences = getMockPatientPreferences();
  
  const suggestions = await generateAppointmentSuggestions(
    request,
    preferences,
    healthContext
  );
  
  const contextForClinician = generateClinicianContext(request, healthContext);
  
  return {
    suggestions,
    healthContext,
    contextForClinician,
    disclaimer: "Informational only. Not medical advice. Scheduling assistance only.",
    generatedAt: new Date().toISOString(),
  };
}

async function generateAppointmentSuggestions(
  request: AppointmentRequest,
  preferences: PatientPreferences,
  context: HealthContext
): Promise<AppointmentSuggestion[]> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    return getMockSuggestions(request, preferences);
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: APPOINTMENT_ASSISTANT_PROMPT },
          {
            role: "user",
            content: `Generate appointment suggestions based on:

PATIENT REQUEST:
- Concern: ${request.concern}
- Preferred Dates: ${request.preferredDates.join(", ")}
- Visit Type Preference: ${request.telehealth ? "Telehealth" : "In-person"}
- Additional Notes: ${request.additionalNotes || "None"}

PATIENT PREFERENCES:
- Preferred Days: ${preferences.preferredDays.join(", ")}
- Preferred Time: ${preferences.preferredTimeOfDay}
- Telehealth Preference: ${preferences.telehealth ? "Yes" : "No"}

HEALTH CONTEXT FOR SUMMARY:
- Recent Symptoms: ${context.recentSymptoms.map(s => `${s.name} (${s.severity}/10)`).join(", ")}
- Active Conditions: ${context.activeConditions.join(", ")}
- Current Medications: ${context.currentMedications.join(", ")}
- Recent Lab Flags: ${context.recentLabFlags.map(l => `${l.testName}: ${l.value}`).join(", ")}

Generate 3 appointment time suggestions. Use safe verbs only in all text.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error("[AppointmentAssistant] API error:", response.status);
      return getMockSuggestions(request, preferences);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map((s: any) => ({
          date: s.date || getNextWeekday(),
          timeSlot: s.timeSlot || "9:00 AM - 10:00 AM",
          provider: s.provider || "Dr. Available Provider",
          specialty: s.specialty || "Primary Care",
          visitType: request.telehealth ? "telehealth" : "in-person",
          reason: validateSummary(s.reason || "Based on stated preferences"),
          contextSummary: validateSummary(s.contextSummary || "Patient records show stated concern"),
          disclaimer: "Informational only. Not medical advice.",
        }));
      }
    }

    return getMockSuggestions(request, preferences);
  } catch (error) {
    console.error("[AppointmentAssistant] Error:", error);
    return getMockSuggestions(request, preferences);
  }
}

function generateClinicianContext(
  request: AppointmentRequest,
  context: HealthContext
): string {
  const parts: string[] = [];
  
  parts.push(`Patient states concern: "${request.concern}"`);
  
  if (context.recentSymptoms.length > 0) {
    const symptomList = context.recentSymptoms
      .map(s => `${s.name} (severity ${s.severity}/10, logged ${s.date})`)
      .join("; ");
    parts.push(`Symptom log shows: ${symptomList}`);
  }
  
  if (context.activeConditions.length > 0) {
    parts.push(`Active conditions refer to: ${context.activeConditions.join(", ")}`);
  }
  
  if (context.currentMedications.length > 0) {
    parts.push(`Medication list shows: ${context.currentMedications.join(", ")}`);
  }
  
  if (context.recentLabFlags.length > 0) {
    const labList = context.recentLabFlags
      .map(l => `${l.testName}: ${l.value} (${l.date})`)
      .join("; ");
    parts.push(`Lab records show: ${labList}`);
  }
  
  if (request.additionalNotes) {
    parts.push(`Patient states additional notes: "${request.additionalNotes}"`);
  }
  
  return parts.join("\n\n") + "\n\nInformational only. Not medical advice.";
}

function getNextWeekday(): string {
  const date = new Date();
  date.setDate(date.getDate() + ((1 + 7 - date.getDay()) % 7 || 7));
  return date.toISOString().split("T")[0];
}

function getMockSuggestions(
  request: AppointmentRequest,
  preferences: PatientPreferences
): AppointmentSuggestion[] {
  const today = new Date();
  const day1 = new Date(today);
  day1.setDate(today.getDate() + 3);
  const day2 = new Date(today);
  day2.setDate(today.getDate() + 5);
  const day3 = new Date(today);
  day3.setDate(today.getDate() + 7);

  const timeSlots = {
    morning: "9:00 AM - 10:00 AM",
    afternoon: "2:00 PM - 3:00 PM",
    evening: "5:00 PM - 6:00 PM",
    any: "10:00 AM - 11:00 AM",
  };

  const visitType = request.telehealth ? "telehealth" : "in-person";

  return [
    {
      date: day1.toISOString().split("T")[0],
      timeSlot: timeSlots[preferences.preferredTimeOfDay],
      provider: "Dr. Sarah Mitchell",
      specialty: "Primary Care",
      visitType,
      reason: `Schedule shows this slot. Patient states preference for ${preferences.preferredTimeOfDay} times.`,
      contextSummary: `Records show stated concern: "${request.concern}". This refers to patient-initiated request.`,
      disclaimer: "Informational only. Not medical advice.",
    },
    {
      date: day2.toISOString().split("T")[0],
      timeSlot: "11:00 AM - 12:00 PM",
      provider: "Dr. James Chen",
      specialty: "Internal Medicine",
      visitType,
      reason: "Schedule shows this Internal Medicine slot. Calendar states open times.",
      contextSummary: `Patient states concern: "${request.concern}". Symptom log shows recent entries.`,
      disclaimer: "Informational only. Not medical advice.",
    },
    {
      date: day3.toISOString().split("T")[0],
      timeSlot: timeSlots.afternoon,
      provider: "Dr. Sarah Mitchell",
      specialty: "Primary Care",
      visitType,
      reason: "Afternoon schedule shows this option. This refers to an additional time choice.",
      contextSummary: `Request refers to: "${request.concern}". Records show context for clinician.`,
      disclaimer: "Informational only. Not medical advice.",
    },
  ];
}

function getMockHealthContext(): HealthContext {
  const today = new Date();
  const recent = new Date(today);
  recent.setDate(today.getDate() - 3);
  const older = new Date(today);
  older.setDate(today.getDate() - 7);

  return {
    recentSymptoms: [
      { name: "Fatigue", severity: 5, date: recent.toISOString().split("T")[0] },
      { name: "Headache", severity: 3, date: older.toISOString().split("T")[0] },
    ],
    activeConditions: ["Type 2 Diabetes", "Hypertension"],
    recentLabFlags: [
      { testName: "HbA1c", value: "7.2%", date: older.toISOString().split("T")[0] },
      { testName: "Fasting Glucose", value: "142 mg/dL", date: older.toISOString().split("T")[0] },
    ],
    currentMedications: ["Metformin 500mg", "Lisinopril 10mg"],
  };
}

function getMockPatientPreferences(): PatientPreferences {
  return {
    preferredDays: ["Monday", "Wednesday", "Friday"],
    preferredTimeOfDay: "morning",
    preferredProvider: "Dr. Sarah Mitchell",
    telehealth: false,
  };
}

export async function getHealthContextForAppointment(patientId: string): Promise<HealthContext> {
  return getMockHealthContext();
}
