import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import { streamText, generateText, getProviderForFeature } from "./ai-provider";

function logPhiAccess(details: { userId: string; action: string; resourceType: string; resourceId: string; details?: any }) {
  console.log(`[PHI_ACCESS] User: ${details.userId}, Action: ${details.action}, Resource: ${details.resourceType}/${details.resourceId}`, details.details || "");
}

const NO_CDS_DISCLAIMER = `
IMPORTANT DISCLAIMER: This information is for educational and informational purposes only. 
It is NOT medical advice and should NOT be used to diagnose, treat, or make decisions about your health. 
Always consult your healthcare provider for personalized medical advice and before making any changes to your treatment plan.
`;

const APP_FEATURES_GUIDE = `
TABULA MEDICA APP FEATURES:
1. **Health Dashboard** - View your complete health overview at a glance
2. **Medical Records** - Access all your conditions, diagnoses, and medical history
3. **Medications** - Track your current medications, dosages, and refill reminders
4. **Lab Results** - View your lab tests with easy-to-understand explanations
5. **Appointments** - Schedule and manage your healthcare appointments
6. **Vitals Tracking** - Monitor blood pressure, heart rate, weight, and more
7. **Health Insights** - AI-powered summaries of your health trends
8. **FHIR Dashboard** - Interactive charts showing your health data over time
9. **Care Team** - Connect with your healthcare providers
10. **Settings** - Customize your experience, accessibility options, and preferences
`;

export interface PatientAssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PatientAssistantResponse {
  message: string;
  includesDisclaimer: boolean;
  suggestedFollowUps?: string[];
  relatedAppFeatures?: string[];
  medicalTermsExplained?: { term: string; explanation: string }[];
}

export interface FHIRDataSummary {
  conditions: { name: string; status: string; onsetDate?: string }[];
  medications: { name: string; dosage?: string; frequency?: string; status: string }[];
  recentLabs: { name: string; value: string; unit?: string; date: string; status?: string }[];
  upcomingAppointments: { type: string; provider: string; date: string }[];
  vitalsSummary: { type: string; value: string; date: string }[];
}

async function getFHIRDataSummary(patientId: string): Promise<FHIRDataSummary> {
  try {
    const [records, medications, appointments, labResults] = await Promise.all([
      storage.getMedicalRecordsByPatient(patientId),
      storage.getMedicationsByPatient(patientId),
      storage.getAppointments(),
      storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
    ]);

    const conditions = records
      .filter(r => r.type === "diagnosis")
      .map(r => ({
        name: r.title,
        status: r.status,
        onsetDate: r.date,
      }));

    const meds = medications.map(m => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      status: m.status,
    }));

    const now = new Date();
    const upcoming = appointments
      .filter(a => a.patientId === patientId && new Date(a.scheduledAt) > now)
      .slice(0, 5)
      .map(a => ({
        type: a.type,
        provider: a.provider,
        date: a.scheduledAt,
      }));

    const recentLabs = labResults
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(l => ({
        name: l.testName,
        value: l.value,
        unit: l.unit,
        date: l.date,
        status: l.status,
      }));

    return {
      conditions,
      medications: meds,
      recentLabs,
      upcomingAppointments: upcoming,
      vitalsSummary: [],
    };
  } catch (error) {
    console.error("Error fetching FHIR data summary:", error);
    return {
      conditions: [],
      medications: [],
      recentLabs: [],
      upcomingAppointments: [],
      vitalsSummary: [],
    };
  }
}

function detectMedicalTerms(text: string): string[] {
  const medicalTermPatterns = [
    /\b(hypertension|hypotension|tachycardia|bradycardia|arrhythmia)\b/gi,
    /\b(diabetes|hyperglycemia|hypoglycemia|insulin resistance|A1c|HbA1c)\b/gi,
    /\b(cholesterol|LDL|HDL|triglycerides|lipid panel)\b/gi,
    /\b(hemoglobin|platelet|leukocyte|erythrocyte|WBC|RBC|CBC)\b/gi,
    /\b(creatinine|eGFR|BUN|kidney function|renal)\b/gi,
    /\b(ALT|AST|bilirubin|liver function|hepatic)\b/gi,
    /\b(hypothyroid|hyperthyroid|TSH|T3|T4|thyroid)\b/gi,
    /\b(anticoagulant|antibiotic|antihypertensive|statin|SSRI|NSAID)\b/gi,
    /\b(systolic|diastolic|blood pressure|mmHg)\b/gi,
    /\b(oncology|metastasis|chemotherapy|radiation|tumor)\b/gi,
    /\b(chronic|acute|benign|malignant|prognosis)\b/gi,
  ];

  const termsSet: Record<string, boolean> = {};
  for (const pattern of medicalTermPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => { termsSet[m.toLowerCase()] = true; });
    }
  }
  return Object.keys(termsSet);
}

function detectIntent(message: string): "fhir_query" | "medical_term" | "app_help" | "general" {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.match(/\b(how do i|where can i|how to|show me|navigate|find|use the app|feature|button|screen|page|tab)\b/)) {
    return "app_help";
  }
  
  if (lowerMessage.match(/\b(what does|what is|explain|meaning of|define|tell me about|understand)\b/) &&
      detectMedicalTerms(message).length > 0) {
    return "medical_term";
  }
  
  if (lowerMessage.match(/\b(my|mine)\b/) && 
      lowerMessage.match(/\b(medication|condition|lab|result|appointment|prescription|diagnosis|health|record|blood|test|vital)\b/)) {
    return "fhir_query";
  }
  
  return "general";
}

const SYSTEM_PROMPT = `You are a friendly, empathetic AI Patient Assistant for Tabula Medica, a patient health record management app. Your role is to help patients understand their health information in simple, everyday language.

CORE PRINCIPLES:
1. **NO-CDS COMPLIANCE**: You provide INFORMATIONAL content only. You NEVER give medical advice, diagnoses, treatment recommendations, or clinical decision support.
2. **Patient-Friendly Language**: Explain medical terms in simple, everyday language that anyone can understand.
3. **Empathetic Tone**: Be warm, supportive, and understanding. Patients may be anxious about their health.
4. **Provider Referral**: Always encourage patients to discuss health concerns with their healthcare provider.
5. **App Guidance**: Help patients navigate and use app features effectively.

WHAT YOU CAN DO:
- Explain what medical terms mean in simple language
- Summarize health records in patient-friendly terms
- Help patients understand lab results (not interpret them clinically)
- Guide patients on using app features
- Provide general health education (NOT personalized medical advice)
- Encourage healthy habits and medication adherence (in general terms)

WHAT YOU MUST NOT DO:
- Provide diagnoses or suggest conditions
- Recommend treatments, medications, or dosages
- Interpret lab results clinically (e.g., don't say "your levels are concerning")
- Advise on whether to seek emergency care (always refer to provider)
- Make predictions about health outcomes
- Replace or contradict healthcare provider advice

RESPONSE FORMAT:
- Be conversational and warm
- Use bullet points for clarity when listing information
- Always include the disclaimer when discussing health data
- Suggest follow-up questions the patient might ask
- Mention relevant app features when helpful

${APP_FEATURES_GUIDE}

Remember: End health-related responses by encouraging the patient to discuss any concerns with their healthcare provider.`;

export interface RAGContextControl {
  categories?: string[];
  timeRange?: string;
  specificItems?: string[];
  specificResourceIds?: string[];
  contextMode?: "full-record" | "selected-resources" | "specific-items";
}

async function fetchSpecificResources(patientId: string, resourceIds: string[]): Promise<string> {
  const parts: string[] = [];
  parts.push("SELECTED HEALTH DATA (user chose these specific items for context):");

  try {
    const [records, medications, labs] = await Promise.all([
      storage.getMedicalRecordsByPatient(patientId),
      storage.getMedicationsByPatient(patientId),
      storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
    ]);

    const recordMap = new Map(records.map(r => [r.id?.toString(), r]));
    const medMap = new Map(medications.map(m => [m.id?.toString(), m]));
    const labMap = new Map(labs.map(l => [l.id?.toString(), l]));

    for (const resourceId of resourceIds) {
      const record = recordMap.get(resourceId);
      if (record) {
        parts.push(`- [${record.type}] ${record.title}: ${record.description || ""} (Date: ${record.date}, Status: ${record.status})`);
        continue;
      }

      const med = medMap.get(resourceId);
      if (med) {
        parts.push(`- [Medication] ${med.name}: ${med.dosage || ""} ${med.frequency || ""} (Status: ${med.status})`);
        continue;
      }

      const lab = labMap.get(resourceId);
      if (lab) {
        parts.push(`- [Lab] ${lab.testName}: ${lab.value} ${lab.unit || ""} (Date: ${lab.date}, Status: ${lab.status || ""})`);
        continue;
      }

      parts.push(`- [Resource ${resourceId}]: Data not found`);
    }
  } catch {
    parts.push("- [Error]: Could not retrieve selected resources");
  }

  return parts.join("\n");
}

function filterByTimeRange(items: Array<{ date?: string }>, timeRange: string): Array<{ date?: string }> {
  const now = new Date();
  let cutoffDate: Date;

  switch (timeRange) {
    case "1month": cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case "3months": cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
    case "6months": cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
    case "1year": cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
    case "3years": cutoffDate = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000); break;
    case "all": return items;
    default: cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  }

  return items.filter(item => {
    if (!item.date) return true;
    return new Date(item.date) >= cutoffDate;
  });
}

export async function* streamPatientAssistantResponse(
  patientId: string,
  messages: PatientAssistantMessage[],
  userMessage: string,
  contextControl?: RAGContextControl
): AsyncGenerator<string, PatientAssistantResponse, unknown> {
  const intent = detectIntent(userMessage);
  let contextInfo = "";
  const contextMode = contextControl?.contextMode || "full-record";
  const activeCategories = contextControl?.categories || ["conditions", "medications", "labs", "vitals", "notes", "allergies", "appointments"];
  const timeRange = contextControl?.timeRange || "6months";
  
  if (intent === "fhir_query" || intent === "general") {
    if (contextMode === "specific-items" && contextControl?.specificResourceIds?.length) {
      contextInfo = "\n" + await fetchSpecificResources(patientId, contextControl.specificResourceIds) + "\n";

      logPhiAccess({
        userId: patientId,
        action: "ai_assistant_rag_query",
        resourceType: "SpecificResources",
        resourceId: patientId,
        details: { intent, queryType: "rag_specific_resources", resourceCount: contextControl.specificResourceIds.length, resourceIds: contextControl.specificResourceIds },
      });
    } else {
      const fhirSummary = await getFHIRDataSummary(patientId);
      const parts: string[] = [];
      parts.push("PATIENT'S HEALTH DATA SUMMARY (for context only - explain in patient-friendly terms):");
      parts.push(`[Context scope: ${activeCategories.join(", ")} | Time range: ${timeRange}]`);

      if (activeCategories.includes("conditions")) {
        const conditions = fhirSummary.conditions.filter(c => c.status === "active");
        parts.push(`- Active Conditions: ${conditions.map(c => c.name).join(", ") || "None recorded"}`);
      }
      if (activeCategories.includes("medications")) {
        const meds = fhirSummary.medications.filter(m => m.status === "active");
        parts.push(`- Current Medications: ${meds.map(m => `${m.name} (${m.dosage || "dosage not specified"})`).join(", ") || "None recorded"}`);
      }
      if (activeCategories.includes("labs")) {
        const filteredLabs = filterByTimeRange(fhirSummary.recentLabs.map(l => ({ ...l, date: l.date })), timeRange);
        parts.push(`- Recent Lab Tests: ${filteredLabs.slice(0, 5).map(l => `${(l as any).name}: ${(l as any).value}${(l as any).unit || ""}`).join(", ") || "None recent"}`);
      }
      if (activeCategories.includes("appointments")) {
        parts.push(`- Upcoming Appointments: ${fhirSummary.upcomingAppointments.map(a => `${a.type} with ${a.provider}`).join(", ") || "None scheduled"}`);
      }
      contextInfo = "\n" + parts.join("\n") + "\n";
      
      logPhiAccess({
        userId: patientId,
        action: "ai_assistant_query",
        resourceType: "PatientSummary",
        resourceId: patientId,
        details: { intent, queryType: contextMode === "selected-resources" ? "category_filtered" : "full_record", categories: activeCategories, timeRange },
      });
    }
  }

  const medicalTerms = detectMedicalTerms(userMessage);
  if (medicalTerms.length > 0) {
    contextInfo += `\nMEDICAL TERMS TO EXPLAIN: ${medicalTerms.join(", ")}`;
  }

  const systemContent = SYSTEM_PROMPT + contextInfo;
  const conversationHistory = messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const fullUserPrompt = conversationHistory ? `${conversationHistory}\nUser: ${userMessage}` : userMessage;

  const provider = getProviderForFeature("patient-chat");
  console.log(`[PatientAssistant] Using AI provider: ${provider} for chat`);

  try {
    let fullResponse = "";

    const textStream = streamText({
      systemPrompt: systemContent,
      userPrompt: fullUserPrompt,
      temperature: 0.7,
      maxTokens: 1500,
    }, "patient-chat");

    for await (const chunk of textStream) {
      fullResponse += chunk;
      yield chunk;
    }

    const isHealthRelated = intent === "fhir_query" || intent === "medical_term" || 
      fullResponse.toLowerCase().includes("health") || 
      fullResponse.toLowerCase().includes("medication") ||
      fullResponse.toLowerCase().includes("condition") ||
      fullResponse.toLowerCase().includes("lab") ||
      fullResponse.toLowerCase().includes("diagnosis");

    const noCdsDisclaimer = "\n\n---\n**IMPORTANT:** This information is for educational purposes only and is NOT medical advice. Always consult your healthcare provider before making any health-related decisions.";
    
    if (isHealthRelated) {
      yield noCdsDisclaimer;
      fullResponse += noCdsDisclaimer;
    }

    const suggestedFollowUps = generateFollowUpSuggestions(intent, userMessage);
    const relatedFeatures = getRelatedAppFeatures(intent, userMessage);
    const explanations = await extractMedicalTermExplanations(fullResponse, medicalTerms);

    return {
      message: fullResponse,
      includesDisclaimer: isHealthRelated,
      suggestedFollowUps,
      relatedAppFeatures: relatedFeatures,
      medicalTermsExplained: explanations,
    };
  } catch (error) {
    console.error("Patient assistant streaming error:", error);
    throw error;
  }
}

export async function getPatientAssistantResponse(
  patientId: string,
  messages: PatientAssistantMessage[],
  userMessage: string,
  contextControl?: { categories?: string[]; timeRange?: string; specificItems?: string[] }
): Promise<PatientAssistantResponse> {
  const generator = streamPatientAssistantResponse(patientId, messages, userMessage, contextControl);
  let fullMessage = "";
  let result: PatientAssistantResponse | undefined;

  while (true) {
    const { value, done } = await generator.next();
    if (done) {
      result = value;
      break;
    }
    fullMessage += value;
  }

  return result || {
    message: fullMessage,
    includesDisclaimer: true,
    suggestedFollowUps: [],
    relatedAppFeatures: [],
  };
}

function generateFollowUpSuggestions(intent: string, query: string): string[] {
  const suggestions: string[] = [];
  
  switch (intent) {
    case "fhir_query":
      suggestions.push(
        "What do my lab results mean?",
        "When is my next appointment?",
        "Can you explain my medications?",
      );
      break;
    case "medical_term":
      suggestions.push(
        "Are there other terms I should know?",
        "How does this relate to my health?",
        "Where can I learn more?",
      );
      break;
    case "app_help":
      suggestions.push(
        "What other features does the app have?",
        "How do I update my information?",
        "How do I contact my care team?",
      );
      break;
    default:
      suggestions.push(
        "Tell me about my health records",
        "How do I use this app?",
        "Explain a medical term for me",
      );
  }
  
  return suggestions.slice(0, 3);
}

function getRelatedAppFeatures(intent: string, query: string): string[] {
  const features: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes("medication") || lowerQuery.includes("prescription")) {
    features.push("Medications", "Refill Reminders");
  }
  if (lowerQuery.includes("lab") || lowerQuery.includes("test") || lowerQuery.includes("result")) {
    features.push("Lab Results", "FHIR Dashboard");
  }
  if (lowerQuery.includes("appointment") || lowerQuery.includes("schedule")) {
    features.push("Appointments", "Care Team");
  }
  if (lowerQuery.includes("condition") || lowerQuery.includes("diagnosis")) {
    features.push("Medical Records", "Health Insights");
  }
  if (lowerQuery.includes("vital") || lowerQuery.includes("blood pressure") || lowerQuery.includes("weight")) {
    features.push("Vitals Tracking", "Health Dashboard");
  }
  
  const uniqueFeatures: Record<string, boolean> = {};
  features.forEach(f => { uniqueFeatures[f] = true; });
  return Object.keys(uniqueFeatures).slice(0, 3);
}

async function extractMedicalTermExplanations(
  response: string,
  detectedTerms: string[]
): Promise<{ term: string; explanation: string }[]> {
  if (detectedTerms.length === 0) return [];
  
  const explanations: { term: string; explanation: string }[] = [];
  
  for (const term of detectedTerms.slice(0, 5)) {
    const pattern = new RegExp(`${term}[^.]*\\.`, "gi");
    const match = response.match(pattern);
    if (match) {
      explanations.push({
        term,
        explanation: match[0].trim(),
      });
    }
  }
  
  return explanations;
}

export async function explainMedicalTerm(term: string): Promise<string> {
  try {
    const explanation = (await generatePhiSafeText({
      system: `You are a patient education assistant. Explain medical terms in simple, everyday language that anyone can understand. Keep explanations brief (2-3 sentences) and avoid medical jargon.

IMPORTANT: This is for educational purposes only. Always note that patients should discuss specifics with their healthcare provider.`,
      user: `Please explain this medical term in simple language: "${term}"`,
      maxTokens: 300,
    })) || `${term} is a medical term. Please ask your healthcare provider for more information.`;
    const disclaimer = "\n\n*This is educational information only, not medical advice. Discuss with your healthcare provider.*";
    return explanation + disclaimer;
  } catch (error) {
    console.error("Error explaining medical term:", error);
    return `I couldn't explain "${term}" right now. Please ask your healthcare provider about this term.`;
  }
}

export async function getAppFeatureGuidance(featureName: string): Promise<string> {
  const featureGuides: Record<string, string> = {
    dashboard: "The Health Dashboard gives you an overview of your health at a glance. You'll see your recent vitals, upcoming appointments, medication reminders, and health tips all in one place.",
    medications: "The Medications section shows all your current prescriptions. You can see dosage information, refill reminders, and set up notifications for when to take your medications.",
    "lab results": "Lab Results shows your test results with easy-to-read explanations. You can see trends over time and compare results to normal ranges. Remember, your doctor is the best person to interpret these results.",
    appointments: "Appointments lets you see upcoming visits and schedule new ones. You can also view past appointments and any notes from your healthcare providers.",
    "medical records": "Medical Records contains your complete health history, including diagnoses, procedures, and immunizations. You can share this information with new healthcare providers.",
    vitals: "Vitals Tracking helps you monitor key health measurements like blood pressure, heart rate, and weight. You can log readings manually or connect a wearable device.",
    "fhir dashboard": "The FHIR Dashboard shows interactive charts of your health data over time. You can see trends in your medications, conditions, encounters, and lab results.",
    settings: "Settings lets you customize your experience. You can adjust accessibility options, notification preferences, and privacy settings.",
  };

  const lowerFeature = featureName.toLowerCase();
  for (const [key, guide] of Object.entries(featureGuides)) {
    if (lowerFeature.includes(key) || key.includes(lowerFeature)) {
      return guide;
    }
  }

  return `I'd be happy to help you learn about app features. You can ask about the Dashboard, Medications, Lab Results, Appointments, Medical Records, Vitals, FHIR Dashboard, or Settings.`;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  type: string;
  available: boolean;
}

export interface AppointmentIntent {
  action: "schedule" | "reschedule" | "cancel" | "inquiry";
  appointmentType?: string;
  preferredDate?: string;
  preferredTime?: string;
  provider?: string;
  reason?: string;
  existingAppointmentId?: string;
  confirmed: boolean;
}

export interface HealthTip {
  id: string;
  patientId: string;
  title: string;
  content: string;
  category: "medication" | "diet" | "exercise" | "sleep" | "mental_health" | "preventive_care";
  priority: "low" | "medium" | "high";
  basedOn: string[];
  createdAt: string;
  dismissed: boolean;
}

export interface HealthReminder {
  id: string;
  patientId: string;
  title: string;
  description: string;
  type: "medication" | "appointment" | "lab_work" | "vaccination" | "screening";
  scheduledFor: string;
  recurring: boolean;
  recurrencePattern?: string;
  status: "pending" | "completed" | "snoozed" | "dismissed";
  createdAt: string;
}

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "patient" | "provider" | "ai_assistant";
  senderName: string;
  recipientId: string;
  recipientType: "patient" | "provider" | "care_team";
  recipientName: string;
  subject?: string;
  content: string;
  aiSuggested: boolean;
  aiDraft?: string;
  readAt?: string;
  createdAt: string;
}

const healthTipsStore: Map<string, HealthTip> = new Map();
const remindersStore: Map<string, HealthReminder> = new Map();
const secureMessagesStore: Map<string, SecureMessage> = new Map();
const appointmentSlotsStore: Map<string, AppointmentSlot> = new Map();

function initializePatientAssistantData() {
  const sampleTips: HealthTip[] = [
    {
      id: "tip-1",
      patientId: "patient-1",
      title: "Stay Hydrated",
      content: "Drinking 8 glasses of water daily helps maintain energy, supports kidney function, and can help manage blood sugar levels. Consider setting reminders throughout the day.",
      category: "diet",
      priority: "medium",
      basedOn: ["General wellness"],
      createdAt: new Date().toISOString(),
      dismissed: false
    },
    {
      id: "tip-2",
      patientId: "patient-1",
      title: "Take Medications with Food",
      content: "Some medications work better when taken with food. Check your medication instructions or ask your pharmacist about the best time to take your prescriptions.",
      category: "medication",
      priority: "high",
      basedOn: ["Medication adherence"],
      createdAt: new Date().toISOString(),
      dismissed: false
    },
    {
      id: "tip-3",
      patientId: "patient-1",
      title: "30 Minutes of Daily Movement",
      content: "Aim for at least 30 minutes of moderate activity most days. This can include walking, swimming, or light exercises. Start slow and gradually increase intensity.",
      category: "exercise",
      priority: "medium",
      basedOn: ["Cardiovascular health"],
      createdAt: new Date().toISOString(),
      dismissed: false
    }
  ];

  const sampleReminders: HealthReminder[] = [
    {
      id: "reminder-1",
      patientId: "patient-1",
      title: "Annual Physical Exam",
      description: "Schedule your annual physical examination",
      type: "appointment",
      scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      recurring: true,
      recurrencePattern: "yearly",
      status: "pending",
      createdAt: new Date().toISOString()
    },
    {
      id: "reminder-2",
      patientId: "patient-1",
      title: "Blood Pressure Check",
      description: "Take your blood pressure reading this morning",
      type: "screening",
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      recurring: true,
      recurrencePattern: "weekly",
      status: "pending",
      createdAt: new Date().toISOString()
    }
  ];

  const sampleMessages: SecureMessage[] = [
    {
      id: "msg-1",
      conversationId: "thread-patient-1-dr-smith",
      senderId: "dr-smith",
      senderType: "provider",
      senderName: "Dr. Sarah Smith",
      recipientId: "patient-1",
      recipientType: "patient",
      recipientName: "Sample Patient",
      subject: "Follow-up on your recent visit",
      content: "Hello! I wanted to follow up on your recent visit. Your lab results look good overall. Please continue with your current medications and let me know if you have any questions.",
      aiSuggested: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const sampleSlots: AppointmentSlot[] = [
    { id: "slot-1", date: getDateString(1), time: "9:00 AM", provider: "Dr. Sarah Smith", type: "General Checkup", available: true },
    { id: "slot-2", date: getDateString(1), time: "2:00 PM", provider: "Dr. Sarah Smith", type: "General Checkup", available: true },
    { id: "slot-3", date: getDateString(2), time: "10:30 AM", provider: "Dr. Michael Johnson", type: "Follow-up", available: true },
    { id: "slot-4", date: getDateString(3), time: "11:00 AM", provider: "Dr. Sarah Smith", type: "Annual Physical", available: true },
    { id: "slot-5", date: getDateString(5), time: "3:30 PM", provider: "Dr. Emily Chen", type: "Specialist Consultation", available: true },
  ];

  sampleTips.forEach(tip => healthTipsStore.set(tip.id, tip));
  sampleReminders.forEach(r => remindersStore.set(r.id, r));
  sampleMessages.forEach(m => secureMessagesStore.set(m.id, m));
  sampleSlots.forEach(s => appointmentSlotsStore.set(s.id, s));
}

function getDateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

initializePatientAssistantData();

const APPOINTMENT_SYSTEM_PROMPT = `You are an AI appointment scheduling assistant. Help patients:
1. Schedule new appointments with their care team
2. Reschedule existing appointments
3. Cancel appointments when needed
4. Find available time slots

Extract the following from patient requests:
- Action (schedule, reschedule, cancel, or inquiry)
- Appointment type (checkup, follow-up, specialist, urgent care, etc.)
- Preferred date/time
- Provider preference (if mentioned)
- Reason for visit (brief)

Respond helpfully and confirm what you understood.`;

export async function processAppointmentRequest(
  patientId: string,
  request: string
): Promise<{ response: string; intent: AppointmentIntent; availableSlots?: AppointmentSlot[] }> {
  logPhiAccess({
    userId: patientId,
    action: "appointment_request",
    resourceType: "AppointmentScheduling",
    resourceId: patientId,
    details: { request: request.substring(0, 50) },
  });

  try {
    const responseText = await generatePhiSafeText({
      system: APPOINTMENT_SYSTEM_PROMPT,
      user: `Patient request: "${request}"\n\nExtract intent and respond helpfully. Return JSON with: action, appointmentType, preferredDate, preferredTime, provider, reason, message`,
      responseMimeType: "application/json",
      maxTokens: 500
    });

    const parsed = JSON.parse(responseText || "{}");
    
    const intent: AppointmentIntent = {
      action: parsed.action || "inquiry",
      appointmentType: parsed.appointmentType,
      preferredDate: parsed.preferredDate,
      preferredTime: parsed.preferredTime,
      provider: parsed.provider,
      reason: parsed.reason,
      confirmed: false
    };

    const availableSlots = Array.from(appointmentSlotsStore.values()).filter(s => s.available);

    return {
      response: parsed.message || generateAppointmentResponseText(intent, availableSlots),
      intent,
      availableSlots: intent.action === "schedule" ? availableSlots : undefined
    };
  } catch (error) {
    console.error("Appointment processing error:", error);
    const intent = parseAppointmentIntentFallback(request);
    const availableSlots = Array.from(appointmentSlotsStore.values()).filter(s => s.available);
    return {
      response: generateAppointmentResponseText(intent, availableSlots),
      intent,
      availableSlots: intent.action === "schedule" ? availableSlots : undefined
    };
  }
}

function parseAppointmentIntentFallback(request: string): AppointmentIntent {
  const lower = request.toLowerCase();
  let action: AppointmentIntent["action"] = "inquiry";
  
  if (lower.includes("schedule") || lower.includes("book") || lower.includes("make an appointment")) {
    action = "schedule";
  } else if (lower.includes("reschedule") || lower.includes("change") || lower.includes("move")) {
    action = "reschedule";
  } else if (lower.includes("cancel")) {
    action = "cancel";
  }

  return { action, confirmed: false };
}

function generateAppointmentResponseText(intent: AppointmentIntent, slots: AppointmentSlot[]): string {
  switch (intent.action) {
    case "schedule":
      const slotList = slots.slice(0, 5).map(s => `- ${s.date} at ${s.time} with ${s.provider}`).join("\n");
      return `I can help you schedule an appointment! Here are some available times:\n\n${slotList}\n\nWould you like to book one of these, or would you prefer a different time?`;
    case "reschedule":
      return `I can help you reschedule. Please tell me which appointment you'd like to change and your preferred new date/time.`;
    case "cancel":
      return `I can help you cancel an appointment. Which appointment would you like to cancel? Would you also like to reschedule for a later date?`;
    default:
      return `I'm here to help with your appointment needs! I can:\n- Schedule a new appointment\n- Reschedule an existing appointment\n- Cancel an appointment\n\nWhat would you like to do?`;
  }
}

export async function confirmAppointment(
  patientId: string,
  slotId: string,
  reason?: string
): Promise<{ success: boolean; confirmationNumber: string; details: AppointmentSlot }> {
  const slot = appointmentSlotsStore.get(slotId);
  if (!slot || !slot.available) {
    throw new Error("Slot not available");
  }

  slot.available = false;
  appointmentSlotsStore.set(slotId, slot);

  const confirmationNumber = `APT-${Date.now().toString(36).toUpperCase()}`;

  logPhiAccess({
    userId: patientId,
    action: "appointment_confirmed",
    resourceType: "Appointment",
    resourceId: slotId,
    details: { confirmationNumber },
  });

  return { success: true, confirmationNumber, details: slot };
}

export function getAvailableSlots(): AppointmentSlot[] {
  return Array.from(appointmentSlotsStore.values()).filter(s => s.available);
}

const HEALTH_TIPS_SYSTEM_PROMPT = `You are a personalized health coach. Based on patient conditions and medications, provide:
1. Tailored wellness tips
2. Medication adherence guidance
3. Lifestyle recommendations (diet, exercise, sleep)
4. Preventive care reminders

CRITICAL: You provide INFORMATIONAL content only. Always include disclaimer to consult healthcare provider.`;

export async function generatePersonalizedHealthTips(
  patientId: string,
  conditions: string[],
  medications: string[]
): Promise<HealthTip[]> {
  logPhiAccess({
    userId: patientId,
    action: "generate_health_tips",
    resourceType: "HealthTips",
    resourceId: patientId,
  });

  try {
    const responseText = await generatePhiSafeText({
      system: HEALTH_TIPS_SYSTEM_PROMPT,
      user: `Generate 3 personalized health tips for a patient with:
Conditions: ${conditions.join(", ") || "General wellness"}
Medications: ${medications.join(", ") || "None specified"}

Return JSON with array "tips", each having: title, content, category (medication/diet/exercise/sleep/mental_health/preventive_care), priority (low/medium/high)`,
      responseMimeType: "application/json",
      maxTokens: 1000
    });

    const parsed = JSON.parse(responseText || '{"tips":[]}');
    
    const tips: HealthTip[] = (parsed.tips || []).map((tip: any, idx: number) => ({
      id: `tip-gen-${Date.now()}-${idx}`,
      patientId,
      title: tip.title,
      content: `${tip.content}\n\n*Always consult your healthcare provider before making changes to your health routine.*`,
      category: tip.category || "preventive_care",
      priority: tip.priority || "medium",
      basedOn: conditions.length > 0 ? conditions : ["General wellness"],
      createdAt: new Date().toISOString(),
      dismissed: false
    }));

    tips.forEach(tip => healthTipsStore.set(tip.id, tip));
    return tips;
  } catch (error) {
    console.error("Health tips generation error:", error);
    return getHealthTips(patientId);
  }
}

export function getHealthTips(patientId: string): HealthTip[] {
  return Array.from(healthTipsStore.values())
    .filter(t => t.patientId === patientId && !t.dismissed);
}

export function dismissHealthTip(patientId: string, tipId: string): boolean {
  const tip = healthTipsStore.get(tipId);
  if (tip && tip.patientId === patientId) {
    tip.dismissed = true;
    healthTipsStore.set(tipId, tip);
    return true;
  }
  return false;
}

export function getHealthReminders(patientId: string): HealthReminder[] {
  return Array.from(remindersStore.values())
    .filter(r => r.patientId === patientId && r.status !== "dismissed");
}

export function createHealthReminder(
  patientId: string,
  reminder: Omit<HealthReminder, "id" | "createdAt" | "status">
): HealthReminder {
  const newReminder: HealthReminder = {
    ...reminder,
    id: `reminder-${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  remindersStore.set(newReminder.id, newReminder);

  logPhiAccess({
    userId: patientId,
    action: "create_reminder",
    resourceType: "HealthReminder",
    resourceId: newReminder.id,
  });

  return newReminder;
}

export function updateReminderStatus(
  patientId: string,
  reminderId: string,
  status: HealthReminder["status"]
): HealthReminder | null {
  const reminder = remindersStore.get(reminderId);
  if (reminder && reminder.patientId === patientId) {
    reminder.status = status;
    remindersStore.set(reminderId, reminder);
    return reminder;
  }
  return null;
}

export function getSecureMessages(patientId: string): SecureMessage[] {
  return Array.from(secureMessagesStore.values())
    .filter(m => m.senderId === patientId || m.recipientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function sendSecureMessage(
  patientId: string,
  recipientId: string,
  recipientType: "provider" | "care_team",
  recipientName: string,
  content: string,
  subject?: string
): Promise<{ message: SecureMessage; aiDraft?: string }> {
  logPhiAccess({
    userId: patientId,
    action: "send_secure_message",
    resourceType: "SecureMessage",
    resourceId: recipientId,
  });

  let aiDraft: string | undefined;

  try {
    aiDraft = (await generatePhiSafeText({
      system: `Help patients communicate clearly with healthcare providers. Suggest a polished version that:
1. Clearly describes their concern
2. Includes relevant details
3. Asks specific questions
Keep the tone respectful and professional.`,
      user: `Polish this patient message:\n"${content}"`,
      maxTokens: 400
    })) || undefined;
  } catch (error) {
    console.error("AI draft error:", error);
  }

  const message: SecureMessage = {
    id: `msg-${Date.now()}`,
    conversationId: `thread-${patientId}-${recipientId}`,
    senderId: patientId,
    senderType: "patient",
    senderName: "You",
    recipientId,
    recipientType,
    recipientName,
    subject,
    content,
    aiSuggested: false,
    aiDraft,
    createdAt: new Date().toISOString()
  };

  secureMessagesStore.set(message.id, message);
  return { message, aiDraft };
}

export async function generateMessageReply(
  patientId: string,
  incomingMessage: string
): Promise<string> {
  try {
    return (await generatePhiSafeText({
      system: `Generate a helpful, appropriate reply for a patient responding to their healthcare provider. Be respectful and appreciative.`,
      user: `Provider's message: "${incomingMessage}"\n\nSuggest a reply.`,
      maxTokens: 300
    })) || "Thank you for your message. I'll review this and follow up if I have questions.";
  } catch (error) {
    return "Thank you for your message. I'll review this information.";
  }
}

export function getCareTeamProviders(): { id: string; name: string; specialty: string }[] {
  return [
    { id: "dr-smith", name: "Dr. Sarah Smith", specialty: "Primary Care" },
    { id: "dr-johnson", name: "Dr. Michael Johnson", specialty: "Cardiology" },
    { id: "dr-chen", name: "Dr. Emily Chen", specialty: "Endocrinology" },
    { id: "care-team", name: "Care Team", specialty: "General Inquiries" }
  ];
}
