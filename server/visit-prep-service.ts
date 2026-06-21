import OpenAI from "openai";

async function logPhiAccess(data: {
  userId: string;
  patientId: string;
  resourceType: string;
  action: "read" | "write" | "delete" | "export";
  details: string;
}) {
  const { logPhiAccess: log } = await import("./security/hipaa-audit");
  log(data);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VisitPrepPack {
  appointmentId: string;
  appointmentType: string;
  provider: string;
  specialty: string;
  scheduledDate: string;
  questionsToAsk: PrepItem[];
  itemsToConfirm: PrepItem[];
  documentsTooBring: PrepItem[];
  generatedAt: string;
  disclaimer: string;
}

export interface PrepItem {
  id: string;
  text: string;
  category: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

interface PatientContext {
  conditions: string[];
  medications: string[];
  recentLabResults: { name: string; value: string; date: string }[];
  allergies: string[];
  upcomingProcedures?: string[];
}

export async function generateVisitPrepPack(
  appointmentId: string,
  appointmentType: string,
  provider: string,
  specialty: string,
  scheduledDate: string,
  patientContext: PatientContext,
  patientId: string
): Promise<VisitPrepPack> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "VisitPrepPack",
    action: "write",
    details: `Generated visit prep pack for appointment ${appointmentId} (${specialty})`,
  });

  const prompt = `You are a patient education assistant helping someone prepare for a medical appointment. Generate a personalized "Visit Prep Pack" with helpful questions and preparation items.

CRITICAL SAFETY RULES:
- ONLY suggest QUESTIONS to ask the healthcare provider
- NEVER give medical advice or recommendations
- NEVER suggest specific tests, procedures, or treatments
- Use phrases like "Ask your clinician about..." or "You may want to ask..."
- Focus on empowering the patient to have informed conversations

APPOINTMENT DETAILS:
- Type: ${appointmentType}
- Provider: ${provider}
- Specialty: ${specialty}
- Scheduled: ${scheduledDate}

PATIENT CONTEXT:
- Current Conditions: ${patientContext.conditions.join(", ") || "None recorded"}
- Current Medications: ${patientContext.medications.join(", ") || "None recorded"}
- Recent Lab Results: ${patientContext.recentLabResults.map(l => `${l.name}: ${l.value}`).join(", ") || "None recorded"}
- Allergies: ${patientContext.allergies.join(", ") || "None recorded"}

Generate a JSON response with exactly this structure:
{
  "questionsToAsk": [
    {
      "id": "q1",
      "text": "Question text here - phrased as 'Ask your clinician...' or 'You may want to ask...'",
      "category": "medications|conditions|follow-up|lifestyle|general",
      "priority": "high|medium|low",
      "reason": "Brief explanation of why this question may be helpful"
    }
  ],
  "itemsToConfirm": [
    {
      "id": "c1",
      "text": "Item to confirm with provider",
      "category": "medications|allergies|contact-info|insurance|records",
      "priority": "high|medium|low",
      "reason": "Why this is important to confirm"
    }
  ],
  "documentsTooBring": [
    {
      "id": "d1",
      "text": "Document or item to bring",
      "category": "identification|insurance|medical-records|medications|device",
      "priority": "high|medium|low",
      "reason": "Why bringing this is helpful"
    }
  ]
}

Guidelines:
- Generate 4-6 questions to ask (personalized to their conditions/medications if applicable)
- Generate 3-5 items to confirm
- Generate 3-5 documents/items to bring
- Prioritize based on relevance to the appointment type and patient context
- For medication-related appointments, include questions about current medications
- For follow-up appointments, include questions about changes since last visit
- Always include standard items like ID, insurance card, and medication list`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a patient education assistant. You help patients prepare for medical appointments by suggesting helpful questions to ask their healthcare providers. You NEVER give medical advice - only suggest questions and preparation items. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);

    return {
      appointmentId,
      appointmentType,
      provider,
      specialty,
      scheduledDate,
      questionsToAsk: parsed.questionsToAsk || [],
      itemsToConfirm: parsed.itemsToConfirm || [],
      documentsTooBring: parsed.documentsTooBring || [],
      generatedAt: new Date().toISOString(),
      disclaimer: "This preparation guide is for informational purposes only. It does not constitute medical advice. Always consult with your healthcare provider for medical guidance.",
    };
  } catch (error) {
    console.error("[VisitPrep] Error generating prep pack:", error);
    
    return getDefaultPrepPack(appointmentId, appointmentType, provider, specialty, scheduledDate);
  }
}

function getDefaultPrepPack(
  appointmentId: string,
  appointmentType: string,
  provider: string,
  specialty: string,
  scheduledDate: string
): VisitPrepPack {
  return {
    appointmentId,
    appointmentType,
    provider,
    specialty,
    scheduledDate,
    questionsToAsk: [
      {
        id: "q1",
        text: "Ask your clinician to review and confirm your current medication list",
        category: "medications",
        priority: "high",
        reason: "Ensures your records are accurate and up-to-date",
      },
      {
        id: "q2",
        text: "Ask what follow-up plan they recommend after this visit",
        category: "follow-up",
        priority: "high",
        reason: "Helps you understand next steps in your care",
      },
      {
        id: "q3",
        text: "Ask if there are any lifestyle changes that might help your condition",
        category: "lifestyle",
        priority: "medium",
        reason: "Empowers you to take an active role in your health",
      },
      {
        id: "q4",
        text: "Ask about any symptoms you should watch for before your next appointment",
        category: "follow-up",
        priority: "medium",
        reason: "Helps you know when to seek care between visits",
      },
    ],
    itemsToConfirm: [
      {
        id: "c1",
        text: "Confirm your pharmacy information is correct in their system",
        category: "medications",
        priority: "high",
        reason: "Ensures prescriptions go to the right place",
      },
      {
        id: "c2",
        text: "Confirm your emergency contact information is current",
        category: "contact-info",
        priority: "medium",
        reason: "Important for emergencies",
      },
      {
        id: "c3",
        text: "Confirm any allergy information in your records",
        category: "allergies",
        priority: "high",
        reason: "Critical for medication safety",
      },
    ],
    documentsTooBring: [
      {
        id: "d1",
        text: "Photo ID (driver's license or state ID)",
        category: "identification",
        priority: "high",
        reason: "Required for check-in at most facilities",
      },
      {
        id: "d2",
        text: "Insurance card(s)",
        category: "insurance",
        priority: "high",
        reason: "Needed for billing and coverage verification",
      },
      {
        id: "d3",
        text: "List of all current medications with dosages",
        category: "medications",
        priority: "high",
        reason: "Helps provider review your complete medication regimen",
      },
      {
        id: "d4",
        text: "List of questions or concerns you want to discuss",
        category: "medical-records",
        priority: "medium",
        reason: "Ensures you don't forget important topics during the visit",
      },
    ],
    generatedAt: new Date().toISOString(),
    disclaimer: "This preparation guide is for informational purposes only. It does not constitute medical advice. Always consult with your healthcare provider for medical guidance.",
  };
}

export async function getVisitPrepForAppointment(
  appointmentId: string,
  patientId: string
): Promise<VisitPrepPack | null> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "VisitPrepPack",
    action: "read",
    details: `Retrieved visit prep pack for appointment ${appointmentId}`,
  });

  return null;
}
