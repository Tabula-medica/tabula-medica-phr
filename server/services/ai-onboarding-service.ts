// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface OnboardingSession {
  id: string;
  patientId: string;
  language: string;
  languageName: string;
  currentStep: OnboardingStep;
  currentOrganSystem: number;
  demographics: Partial<Demographics>;
  conditions: ConditionEntry[];
  medications: MedicationEntry[];
  allergies: AllergyEntry[];
  surgeries: SurgeryEntry[];
  familyHistory: FamilyHistoryEntry[];
  socialHistory: Partial<SocialHistory>;
  reviewOfSystems: Record<string, ROSEntry>;
  messages: ChatMessage[];
  prepopulatedData: PrepopulatedData | null;
  prepopulationConfirmed: boolean;
  completedSteps: OnboardingStep[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "abandoned";
}

export type OnboardingStep =
  | "language_selection"
  | "demographics"
  | "prepopulation_review"
  | "conditions"
  | "medications"
  | "allergies"
  | "surgeries"
  | "family_history"
  | "social_history"
  | "ros_general"
  | "ros_heent"
  | "ros_cardiovascular"
  | "ros_respiratory"
  | "ros_gastrointestinal"
  | "ros_genitourinary"
  | "ros_musculoskeletal"
  | "ros_neurological"
  | "ros_psychiatric"
  | "ros_dermatological"
  | "ros_endocrine"
  | "ros_hematologic"
  | "review_summary"
  | "completed";

export interface Demographics {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}

export interface ConditionEntry {
  name: string;
  diagnosisDate: string;
  status: string;
  notes: string;
}

export interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  reason: string;
}

export interface AllergyEntry {
  allergen: string;
  reaction: string;
  severity: string;
}

export interface SurgeryEntry {
  procedure: string;
  date: string;
  hospital: string;
}

export interface FamilyHistoryEntry {
  condition: string;
  relationship: string;
  ageOfOnset: string;
}

export interface SocialHistory {
  smokingStatus: string;
  alcoholUse: string;
  exerciseFrequency: string;
  occupation: string;
  livingSituation: string;
}

export interface ROSEntry {
  system: string;
  symptoms: string[];
  deniedSymptoms: string[];
  notes: string;
  reviewed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
  step: OnboardingStep;
  metadata?: Record<string, unknown>;
}

export interface PrepopulatedData {
  conditions: ConditionEntry[];
  medications: MedicationEntry[];
  allergies: AllergyEntry[];
  surgeries: SurgeryEntry[];
  demographics: Partial<Demographics>;
  source: string;
}

const ORGAN_SYSTEMS: { step: OnboardingStep; name: string; key: string }[] = [
  { step: "ros_general", name: "General / Constitutional", key: "general" },
  { step: "ros_heent", name: "Head, Eyes, Ears, Nose, Throat (HEENT)", key: "heent" },
  { step: "ros_cardiovascular", name: "Cardiovascular", key: "cardiovascular" },
  { step: "ros_respiratory", name: "Respiratory", key: "respiratory" },
  { step: "ros_gastrointestinal", name: "Gastrointestinal", key: "gastrointestinal" },
  { step: "ros_genitourinary", name: "Genitourinary", key: "genitourinary" },
  { step: "ros_musculoskeletal", name: "Musculoskeletal", key: "musculoskeletal" },
  { step: "ros_neurological", name: "Neurological", key: "neurological" },
  { step: "ros_psychiatric", name: "Psychiatric / Mental Health", key: "psychiatric" },
  { step: "ros_dermatological", name: "Dermatological / Skin", key: "dermatological" },
  { step: "ros_endocrine", name: "Endocrine", key: "endocrine" },
  { step: "ros_hematologic", name: "Hematologic / Lymphatic", key: "hematologic" },
];

const STEP_ORDER: OnboardingStep[] = [
  "language_selection",
  "demographics",
  "prepopulation_review",
  "conditions",
  "medications",
  "allergies",
  "surgeries",
  "family_history",
  "social_history",
  ...ORGAN_SYSTEMS.map(s => s.step),
  "review_summary",
  "completed",
];

const sessions = new Map<string, OnboardingSession>();

function generateId(): string {
  return `onb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const SAMPLE_PREPOPULATED: PrepopulatedData = {
  conditions: [
    { name: "Type 2 Diabetes Mellitus", diagnosisDate: "2019-03-15", status: "active", notes: "Managed with metformin" },
    { name: "Essential Hypertension", diagnosisDate: "2018-07-22", status: "active", notes: "Controlled with lisinopril" },
  ],
  medications: [
    { name: "Metformin", dosage: "500mg", frequency: "Twice daily", prescriber: "Dr. Smith", reason: "Type 2 Diabetes" },
    { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", prescriber: "Dr. Smith", reason: "Hypertension" },
    { name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", prescriber: "Dr. Smith", reason: "Cholesterol management" },
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Rash, hives", severity: "moderate" },
    { allergen: "Sulfa drugs", reaction: "Difficulty breathing", severity: "severe" },
  ],
  surgeries: [
    { procedure: "Appendectomy", date: "2010-06-12", hospital: "General Hospital" },
  ],
  demographics: {
    firstName: "Maria",
    lastName: "Garcia",
    dateOfBirth: "1975-08-14",
    gender: "Female",
  },
  source: "Connected EHR (Fasten Health)",
};

function buildSystemPrompt(session: OnboardingSession): string {
  const lang = session.languageName || "English";

  return `You are a patient onboarding assistant for Tabula Medica, a health records platform. Your role is to collect patient health information through a friendly, structured interview.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER provide medical advice, diagnoses, interpretations, or treatment suggestions.
2. NEVER comment on whether a patient's symptoms, conditions, or medications are concerning or normal.
3. NEVER suggest a patient should see a doctor about something specific.
4. ONLY ask questions to collect information. Acknowledge answers neutrally (e.g., "Thank you, I've noted that.").
5. Ask ONE question at a time. Wait for the patient's response before asking the next.
6. If a patient asks for medical advice, respond: "I'm here to collect your health information only. Please discuss medical questions with your healthcare provider."
7. Be warm, patient, and encouraging. Use simple, clear language.
8. Communicate ENTIRELY in ${lang}. All questions, acknowledgments, and transitions must be in ${lang}.

CURRENT STEP: ${session.currentStep}
${getStepInstructions(session)}

CONVERSATION CONTEXT:
- Patient's preferred language: ${lang}
- Steps completed: ${session.completedSteps.join(", ") || "none yet"}
- Current progress: Step ${STEP_ORDER.indexOf(session.currentStep) + 1} of ${STEP_ORDER.length}

Remember: You are a data collector, not a medical advisor. Be friendly but stay strictly within the role of gathering information.`;
}

function getStepInstructions(session: OnboardingSession): string {
  switch (session.currentStep) {
    case "demographics":
      return `You are collecting basic demographic information. Ask about:
- Full name (first and last)
- Date of birth
- Gender
- Phone number
- Email address
- Home address
- Emergency contact (name, relationship, phone)
Ask these one at a time. If some data is already known, confirm it with the patient.
${session.demographics.firstName ? `Known data: Name: ${session.demographics.firstName} ${session.demographics.lastName || ""}, DOB: ${session.demographics.dateOfBirth || "unknown"}, Gender: ${session.demographics.gender || "unknown"}` : ""}`;

    case "prepopulation_review":
      return `We have existing health records from ${session.prepopulatedData?.source || "connected health systems"}. Present this data to the patient and ask them to confirm or correct each item:
${JSON.stringify(session.prepopulatedData, null, 2)}
Go through each category (conditions, medications, allergies, surgeries) and ask: "Is this information still accurate? Would you like to add, remove, or change anything?"`;

    case "conditions":
      return `Ask about current and past medical conditions/diagnoses. For each condition, collect:
- Name of the condition
- When it was diagnosed (approximate date)
- Current status (active, resolved, managed)
- Any notes
Ask if they have any other conditions. When they say no more, move to the next step.
${session.conditions.length > 0 ? `Already recorded: ${session.conditions.map(c => c.name).join(", ")}` : ""}`;

    case "medications":
      return `Ask about current medications. For each medication, collect:
- Medication name
- Dosage
- How often they take it (frequency)
- Who prescribed it
- What it's for
Ask if they take any other medications, including over-the-counter and supplements. When done, move on.
${session.medications.length > 0 ? `Already recorded: ${session.medications.map(m => `${m.name} ${m.dosage}`).join(", ")}` : ""}`;

    case "allergies":
      return `Ask about allergies (medications, foods, environmental). For each allergy, collect:
- What they're allergic to
- What reaction they have
- Severity (mild, moderate, severe)
Ask if they have any other allergies. When done, move on.
${session.allergies.length > 0 ? `Already recorded: ${session.allergies.map(a => a.allergen).join(", ")}` : ""}`;

    case "surgeries":
      return `Ask about past surgeries and procedures. For each, collect:
- What procedure was done
- Approximate date
- Where it was done (hospital/clinic)
Ask if they've had any other surgeries. When done, move on.
${session.surgeries.length > 0 ? `Already recorded: ${session.surgeries.map(s => s.procedure).join(", ")}` : ""}`;

    case "family_history":
      return `Ask about family medical history. For each condition in the family, collect:
- What condition
- Which family member (relationship: mother, father, sibling, grandparent, etc.)
- Age of onset if known
Ask about common family conditions: heart disease, diabetes, cancer, high blood pressure, stroke, mental health conditions. When done, move on.
${session.familyHistory.length > 0 ? `Already recorded: ${session.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join(", ")}` : ""}`;

    case "social_history":
      return `Ask about social and lifestyle history. Collect:
- Smoking status (never, former, current - and how much)
- Alcohol use (none, occasional, moderate, heavy)
- Exercise habits (type and frequency)
- Occupation
- Living situation (alone, with family, assisted living, etc.)
Ask these one at a time in a non-judgmental way.
${Object.keys(session.socialHistory).length > 0 ? `Already recorded: ${JSON.stringify(session.socialHistory)}` : ""}`;

    case "review_summary":
      return `Present a summary of ALL collected information to the patient for final review. Organize it by category:
1. Demographics
2. Medical Conditions
3. Current Medications
4. Allergies
5. Surgical History
6. Family History
7. Social History
8. Review of Systems findings
Ask if everything looks correct and if they'd like to change anything. When confirmed, let them know the onboarding is complete.`;

    default: {
      const rosSystem = ORGAN_SYSTEMS.find(s => s.step === session.currentStep);
      if (rosSystem) {
        const existingROS = session.reviewOfSystems[rosSystem.key];
        return `You are conducting a Review of Systems (ROS) for the ${rosSystem.name} system.
Ask about common symptoms for this system one at a time. For ${rosSystem.name}, ask about relevant symptoms.
For each symptom area, ask "Have you experienced [symptom] recently?" and record whether they confirm or deny.
Keep it conversational and natural. After covering the key symptoms for this system, ask if there's anything else related to ${rosSystem.name} they want to mention.
${existingROS?.symptoms.length ? `Already noted symptoms: ${existingROS.symptoms.join(", ")}` : ""}
${existingROS?.deniedSymptoms.length ? `Already denied: ${existingROS.deniedSymptoms.join(", ")}` : ""}`;
      }
      return "";
    }
  }
}

export function createSession(patientId: string, language: string, languageName: string): OnboardingSession {
  const id = generateId();
  const now = new Date().toISOString();

  const session: OnboardingSession = {
    id,
    patientId,
    language,
    languageName,
    currentStep: "demographics",
    currentOrganSystem: 0,
    demographics: {},
    conditions: [],
    medications: [],
    allergies: [],
    surgeries: [],
    familyHistory: [],
    socialHistory: {},
    reviewOfSystems: {},
    messages: [],
    prepopulatedData: SAMPLE_PREPOPULATED,
    prepopulationConfirmed: false,
    completedSteps: ["language_selection"],
    createdAt: now,
    updatedAt: now,
    status: "active",
  };

  if (session.prepopulatedData) {
    session.demographics = { ...session.prepopulatedData.demographics };
    session.conditions = [...session.prepopulatedData.conditions];
    session.medications = [...session.prepopulatedData.medications];
    session.allergies = [...session.prepopulatedData.allergies];
    session.surgeries = [...session.prepopulatedData.surgeries];
  }

  const welcomeMsg: ChatMessage = {
    id: generateMessageId(),
    role: "assistant",
    content: getWelcomeMessage(languageName, !!session.prepopulatedData),
    timestamp: now,
    step: "demographics",
  };
  session.messages.push(welcomeMsg);

  sessions.set(id, session);
  return session;
}

function getWelcomeMessage(language: string, hasPrepopulated: boolean): string {
  const msgs: Record<string, string> = {
    English: hasPrepopulated
      ? "Welcome to Tabula Medica! I'll be helping you set up your health profile today. I can see we already have some health records on file for you. I'll walk you through confirming that information and collecting anything we're missing.\n\nLet's start with your basic information. Can you please confirm your full name?"
      : "Welcome to Tabula Medica! I'll be helping you set up your health profile today. I'll ask you some questions about your health history, one at a time. This information helps your care team provide better care.\n\nLet's start with your basic information. What is your full name?",
    Spanish: hasPrepopulated
      ? "¡Bienvenido/a a Tabula Medica! Hoy le ayudaré a configurar su perfil de salud. Veo que ya tenemos algunos registros de salud archivados para usted. Le guiaré para confirmar esa información y recopilar lo que falte.\n\nComencemos con su información básica. ¿Puede confirmar su nombre completo?"
      : "¡Bienvenido/a a Tabula Medica! Hoy le ayudaré a configurar su perfil de salud. Le haré algunas preguntas sobre su historial de salud, una a la vez. Esta información ayuda a su equipo de atención a brindarle un mejor cuidado.\n\nComencemos con su información básica. ¿Cuál es su nombre completo?",
    Chinese: hasPrepopulated
      ? "欢迎来到 Tabula Medica！今天我将帮助您建立健康档案。我看到我们已经有您的一些健康记录。我将引导您确认这些信息，并收集缺少的内容。\n\n让我们从您的基本信息开始。请确认您的全名？"
      : "欢迎来到 Tabula Medica！今天我将帮助您建立健康档案。我会逐一询问您的健康历史。这些信息有助于您的医疗团队提供更好的护理。\n\n让我们从您的基本信息开始。您的全名是什么？",
    Arabic: hasPrepopulated
      ? "مرحبًا بك في Tabula Medica! سأساعدك اليوم في إعداد ملفك الصحي. أرى أن لدينا بعض السجلات الصحية المحفوظة لك بالفعل. سأرشدك لتأكيد تلك المعلومات وجمع ما ينقصنا.\n\nلنبدأ بمعلوماتك الأساسية. هل يمكنك تأكيد اسمك الكامل؟"
      : "مرحبًا بك في Tabula Medica! سأساعدك اليوم في إعداد ملفك الصحي. سأطرح عليك بعض الأسئلة حول تاريخك الصحي، واحدًا تلو الآخر. تساعد هذه المعلومات فريق الرعاية الخاص بك على تقديم رعاية أفضل.\n\nلنبدأ بمعلوماتك الأساسية. ما هو اسمك الكامل؟",
    Hindi: hasPrepopulated
      ? "Tabula Medica में आपका स्वागत है! आज मैं आपकी स्वास्थ्य प्रोफ़ाइल सेट करने में आपकी मदद करूँगा। मैं देख सकता हूँ कि हमारे पास आपके कुछ स्वास्थ्य रिकॉर्ड पहले से हैं। मैं उस जानकारी की पुष्टि करने और जो कुछ भी छूट गया है उसे एकत्र करने में आपकी मदद करूँगा।\n\nचलिए आपकी बुनियादी जानकारी से शुरू करते हैं। क्या आप अपना पूरा नाम बता सकते हैं?"
      : "Tabula Medica में आपका स्वागत है! आज मैं आपकी स्वास्थ्य प्रोफ़ाइल सेट करने में आपकी मदद करूँगा। मैं आपसे आपके स्वास्थ्य इतिहास के बारे में एक-एक करके कुछ सवाल पूछूँगा। यह जानकारी आपकी देखभाल टीम को बेहतर देखभाल प्रदान करने में मदद करती है।\n\nचलिए आपकी बुनियादी जानकारी से शुरू करते हैं। आपका पूरा नाम क्या है?",
  };
  return msgs[language] || msgs["English"];
}

export function getSession(sessionId: string): OnboardingSession | undefined {
  return sessions.get(sessionId);
}

export function getSessionProgress(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const currentIndex = STEP_ORDER.indexOf(session.currentStep);
  const totalSteps = STEP_ORDER.length;
  const rosStartIndex = STEP_ORDER.indexOf("ros_general");
  const rosEndIndex = STEP_ORDER.indexOf("ros_hematologic");

  let currentRosSystem: string | null = null;
  let rosProgress = 0;
  if (currentIndex >= rosStartIndex && currentIndex <= rosEndIndex) {
    const rosIdx = currentIndex - rosStartIndex;
    currentRosSystem = ORGAN_SYSTEMS[rosIdx]?.name || null;
    rosProgress = Math.round(((rosIdx + 1) / ORGAN_SYSTEMS.length) * 100);
  }

  return {
    sessionId: session.id,
    currentStep: session.currentStep,
    completedSteps: session.completedSteps,
    totalSteps,
    currentStepIndex: currentIndex,
    percentComplete: Math.round((currentIndex / (totalSteps - 1)) * 100),
    currentRosSystem,
    rosProgress,
    organSystemsTotal: ORGAN_SYSTEMS.length,
    organSystemsCurrent: currentIndex >= rosStartIndex && currentIndex <= rosEndIndex
      ? currentIndex - rosStartIndex + 1
      : 0,
    status: session.status,
    language: session.language,
    languageName: session.languageName,
    hasPrepopulatedData: !!session.prepopulatedData,
    prepopulationConfirmed: session.prepopulationConfirmed,
    collectedData: {
      demographics: Object.keys(session.demographics).length > 0,
      conditions: session.conditions.length,
      medications: session.medications.length,
      allergies: session.allergies.length,
      surgeries: session.surgeries.length,
      familyHistory: session.familyHistory.length,
      socialHistory: Object.keys(session.socialHistory).length > 0,
      reviewOfSystems: Object.keys(session.reviewOfSystems).filter(k => session.reviewOfSystems[k]?.reviewed).length,
    },
  };
}

function advanceStep(session: OnboardingSession): void {
  const currentIndex = STEP_ORDER.indexOf(session.currentStep);
  if (currentIndex < STEP_ORDER.length - 1) {
    if (!session.completedSteps.includes(session.currentStep)) {
      session.completedSteps.push(session.currentStep);
    }
    let nextStep = STEP_ORDER[currentIndex + 1];
    if (nextStep === "prepopulation_review" && !session.prepopulatedData) {
      session.completedSteps.push("prepopulation_review");
      nextStep = STEP_ORDER[currentIndex + 2];
    }
    session.currentStep = nextStep;
    session.updatedAt = new Date().toISOString();
  }
}

function extractDataFromResponse(session: OnboardingSession, userMessage: string): void {
  const lower = userMessage.toLowerCase();

  if (lower.includes("next") || lower.includes("done") || lower.includes("move on") ||
      lower.includes("no more") || lower.includes("that's all") || lower.includes("nothing else") ||
      lower.includes("siguiente") || lower.includes("terminado") ||
      lower.includes("下一步") || lower.includes("完成") ||
      lower.includes("अगला") || lower.includes("التالي")) {
    return;
  }
}

export async function processMessage(
  sessionId: string,
  userMessage: string,
  advanceToNext: boolean = false
): Promise<{ message: ChatMessage; session: OnboardingSession }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "active") throw new Error("Session is not active");

  const userMsg: ChatMessage = {
    id: generateMessageId(),
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
    step: session.currentStep,
  };
  session.messages.push(userMsg);

  extractDataFromResponse(session, userMessage);

  if (advanceToNext) {
    advanceStep(session);
  }

  const systemPrompt = buildSystemPrompt(session);

  const conversationMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  const recentMessages = session.messages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "system") continue;
    conversationMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: conversationMessages,
      max_completion_tokens: 1024,
    });

    const assistantContent = response.choices[0]?.message?.content || "I apologize, I had trouble processing that. Could you please repeat?";

    const assistantMsg: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      step: session.currentStep,
    };
    session.messages.push(assistantMsg);

    session.updatedAt = new Date().toISOString();
    sessions.set(sessionId, session);

    return { message: assistantMsg, session };
  } catch (error: any) {
    const errorMsg: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: session.language === "es"
        ? "Disculpe, hubo un problema técnico. ¿Podría repetir su respuesta?"
        : session.language === "zh"
        ? "抱歉，出现了技术问题。您能重复一下吗？"
        : "I apologize, there was a technical issue. Could you please repeat your response?",
      timestamp: new Date().toISOString(),
      step: session.currentStep,
    };
    session.messages.push(errorMsg);
    sessions.set(sessionId, session);
    return { message: errorMsg, session };
  }
}

export function advanceSessionStep(sessionId: string): OnboardingSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  advanceStep(session);
  sessions.set(sessionId, session);
  return session;
}

export function completeSession(sessionId: string): OnboardingSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status = "completed";
  session.currentStep = "completed";
  if (!session.completedSteps.includes("review_summary")) {
    session.completedSteps.push("review_summary");
  }
  session.completedSteps.push("completed");
  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  return session;
}

export function getSessionSummary(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    demographics: session.demographics,
    conditions: session.conditions,
    medications: session.medications,
    allergies: session.allergies,
    surgeries: session.surgeries,
    familyHistory: session.familyHistory,
    socialHistory: session.socialHistory,
    reviewOfSystems: session.reviewOfSystems,
    prepopulatedData: session.prepopulatedData,
    prepopulationConfirmed: session.prepopulationConfirmed,
    completedAt: session.updatedAt,
    language: session.languageName,
  };
}

export function getAllSessions(): OnboardingSession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export const ONBOARDING_STEPS_INFO = STEP_ORDER.map((step, index) => {
  const rosSystem = ORGAN_SYSTEMS.find(s => s.step === step);
  return {
    step,
    index,
    label: rosSystem
      ? `ROS: ${rosSystem.name}`
      : step.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    isROS: !!rosSystem,
    organSystem: rosSystem?.name || null,
  };
});

export interface QuickReply {
  id: string;
  label: string;
  value: string;
  type: "answer" | "action" | "skip";
}

export interface ContextualTip {
  id: string;
  title: string;
  content: string;
  category: "info" | "privacy" | "help" | "feature";
  icon: string;
}

export interface StepEstimate {
  step: string;
  label: string;
  estimatedMinutes: number;
  isROS: boolean;
}

const STEP_TIME_ESTIMATES: Record<string, number> = {
  demographics: 3,
  prepopulation_review: 2,
  conditions: 3,
  medications: 3,
  allergies: 2,
  surgeries: 2,
  family_history: 3,
  social_history: 2,
  ros_general: 1,
  ros_heent: 1,
  ros_cardiovascular: 1,
  ros_respiratory: 1,
  ros_gastrointestinal: 1,
  ros_genitourinary: 1,
  ros_musculoskeletal: 1,
  ros_neurological: 1,
  ros_psychiatric: 1,
  ros_dermatological: 1,
  ros_endocrine: 1,
  ros_hematologic: 1,
  review_summary: 2,
};

const QUICK_REPLIES: Record<string, QuickReply[]> = {
  demographics: [
    { id: "qr-sample-confirm", label: "Information is correct", value: "Yes, that information is correct.", type: "answer" },
    { id: "qr-sample-skip", label: "Skip this section", value: "I'd like to skip this section for now.", type: "skip" },
  ],
  prepopulation_review: [
    { id: "qr-prepop-yes", label: "All looks correct", value: "Yes, all the information looks correct.", type: "answer" },
    { id: "qr-prepop-changes", label: "I have some changes", value: "I need to make some corrections.", type: "answer" },
    { id: "qr-prepop-skip", label: "Review later", value: "I'll review this later.", type: "skip" },
  ],
  conditions: [
    { id: "qr-cond-none", label: "No conditions to report", value: "I don't have any medical conditions.", type: "answer" },
    { id: "qr-cond-done", label: "That's all my conditions", value: "That's all the conditions I have.", type: "answer" },
    { id: "qr-cond-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  medications: [
    { id: "qr-med-none", label: "Not taking any medications", value: "I'm not currently taking any medications.", type: "answer" },
    { id: "qr-med-otc", label: "Only over-the-counter", value: "I only take over-the-counter medications like vitamins.", type: "answer" },
    { id: "qr-med-done", label: "That's all my medications", value: "That's all the medications I take.", type: "answer" },
    { id: "qr-med-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  allergies: [
    { id: "qr-alg-none", label: "No known allergies", value: "I don't have any known allergies.", type: "answer" },
    { id: "qr-alg-done", label: "That's all my allergies", value: "Those are all my allergies.", type: "answer" },
    { id: "qr-alg-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  surgeries: [
    { id: "qr-surg-none", label: "No past surgeries", value: "I haven't had any surgeries.", type: "answer" },
    { id: "qr-surg-done", label: "That's all my surgeries", value: "Those are all my past surgeries.", type: "answer" },
    { id: "qr-surg-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  family_history: [
    { id: "qr-fam-none", label: "No family history to report", value: "I'm not aware of any significant family health history.", type: "answer" },
    { id: "qr-fam-done", label: "That's all I know", value: "That's all the family history I'm aware of.", type: "answer" },
    { id: "qr-fam-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  social_history: [
    { id: "qr-social-nonsmoker", label: "Non-smoker", value: "I don't smoke and have never smoked.", type: "answer" },
    { id: "qr-social-noalcohol", label: "No alcohol", value: "I don't drink alcohol.", type: "answer" },
    { id: "qr-social-done", label: "That covers everything", value: "That covers all my social and lifestyle information.", type: "answer" },
    { id: "qr-social-skip", label: "Skip this section", value: "I'd like to skip this section.", type: "skip" },
  ],
  review_summary: [
    { id: "qr-review-confirm", label: "Everything looks correct", value: "Everything looks correct, I'm done!", type: "answer" },
    { id: "qr-review-changes", label: "I need to make changes", value: "I'd like to correct some information.", type: "answer" },
  ],
};

const ROS_QUICK_REPLIES: QuickReply[] = [
  { id: "qr-ros-nosymptoms", label: "No symptoms", value: "No, I haven't had any of those symptoms.", type: "answer" },
  { id: "qr-ros-yes", label: "Yes, I have this", value: "Yes, I've been experiencing that.", type: "answer" },
  { id: "qr-ros-done", label: "Nothing else for this system", value: "No, nothing else for this area.", type: "answer" },
  { id: "qr-ros-skip", label: "Skip this system", value: "I'd like to skip this body system.", type: "skip" },
];

const CONTEXTUAL_TIPS: Record<string, ContextualTip[]> = {
  demographics: [
    { id: "tip-sample-1", title: "Why we ask", content: "Your basic information helps us match your records across different healthcare systems and ensure we're showing the right data.", category: "info", icon: "info" },
    { id: "tip-sample-2", title: "Your privacy", content: "All personal information is encrypted and protected under HIPAA. Only you and your authorized care team can access it.", category: "privacy", icon: "shield" },
  ],
  prepopulation_review: [
    { id: "tip-prepop-1", title: "Where does this data come from?", content: "We found existing health records from your connected EHR systems (like Fasten Health). Please verify everything is current and accurate.", category: "info", icon: "database" },
    { id: "tip-prepop-2", title: "Make corrections easily", content: "If anything has changed, just tell the assistant what needs updating. You can also add new information that wasn't in your records.", category: "help", icon: "edit" },
  ],
  conditions: [
    { id: "tip-cond-1", title: "What counts as a condition?", content: "Include any diagnosis from a doctor, whether active or resolved. Examples: high blood pressure, diabetes, asthma, depression, past infections that needed treatment.", category: "help", icon: "heart" },
    { id: "tip-cond-2", title: "AI Medical Explanations", content: "After setup, you can ask our AI assistant to explain any medical term or condition in simple language.", category: "feature", icon: "sparkles" },
  ],
  medications: [
    { id: "tip-med-1", title: "Include everything", content: "List prescription medications, over-the-counter medicines, vitamins, and supplements. Include dosage and how often you take each one.", category: "help", icon: "pill" },
    { id: "tip-med-2", title: "Medication Tracking", content: "Tabula Medica can help you track your medications, set reminders, and check for potential interactions between drugs.", category: "feature", icon: "bell" },
  ],
  allergies: [
    { id: "tip-alg-1", title: "Types of allergies", content: "Include drug allergies (e.g., penicillin), food allergies, and environmental allergies (e.g., pollen, latex). Mention the reaction you experience.", category: "help", icon: "alert-triangle" },
    { id: "tip-alg-2", title: "Safety alerts", content: "Your allergy information is flagged across all your records so providers are always aware, helping prevent adverse reactions.", category: "feature", icon: "shield-alert" },
  ],
  surgeries: [
    { id: "tip-surg-1", title: "What to include", content: "List any surgical procedures, including minor ones like biopsies or dental extractions. Approximate dates are fine if you don't remember exactly.", category: "help", icon: "stethoscope" },
  ],
  family_history: [
    { id: "tip-fam-1", title: "Why family history matters", content: "Conditions that run in families can affect your risk for certain diseases. This helps your care team recommend appropriate screening and prevention.", category: "info", icon: "users" },
    { id: "tip-fam-2", title: "Common conditions to mention", content: "Heart disease, diabetes, cancer (type), high blood pressure, stroke, mental health conditions, autoimmune disorders.", category: "help", icon: "list" },
  ],
  social_history: [
    { id: "tip-social-1", title: "No judgment", content: "This information is collected in a completely non-judgmental way. Honest answers help your care team provide better, more personalized care.", category: "privacy", icon: "heart-handshake" },
    { id: "tip-social-2", title: "Health Goals", content: "After setup, you can set health goals and track your progress. Tabula Medica helps you stay motivated with personalized insights.", category: "feature", icon: "target" },
  ],
  review_summary: [
    { id: "tip-review-1", title: "You can always update", content: "Your health profile isn't set in stone. You can update any section at any time as your health information changes.", category: "info", icon: "refresh" },
    { id: "tip-review-2", title: "What happens next?", content: "After completing your profile, you'll have full access to all Tabula Medica features including health insights, AI explanations, and record sharing.", category: "feature", icon: "sparkles" },
  ],
};

const ROS_CONTEXTUAL_TIPS: ContextualTip[] = [
  { id: "tip-ros-1", title: "Review of Systems", content: "This is a systematic check of symptoms across different body areas. It helps create a complete picture of your current health status.", category: "info", icon: "clipboard" },
  { id: "tip-ros-2", title: "Answer honestly", content: "There are no wrong answers. If you're unsure about a symptom, mention it — your care team can help determine what's significant.", category: "help", icon: "message-circle" },
];

export function getQuickReplies(step: OnboardingStep): QuickReply[] {
  if (step.startsWith("ros_")) {
    return ROS_QUICK_REPLIES;
  }
  return QUICK_REPLIES[step] || [];
}

export function getContextualTips(step: OnboardingStep): ContextualTip[] {
  if (step.startsWith("ros_")) {
    return ROS_CONTEXTUAL_TIPS;
  }
  return CONTEXTUAL_TIPS[step] || [];
}

export function getTimeEstimates(): { steps: StepEstimate[]; totalMinutes: number } {
  const steps: StepEstimate[] = STEP_ORDER
    .filter(s => s !== "completed" && s !== "language_selection")
    .map(step => {
      const rosSystem = ORGAN_SYSTEMS.find(os => os.step === step);
      return {
        step,
        label: rosSystem
          ? `ROS: ${rosSystem.name}`
          : step.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        estimatedMinutes: STEP_TIME_ESTIMATES[step] || 1,
        isROS: !!rosSystem,
      };
    });

  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  return { steps, totalMinutes };
}

export function getRemainingTime(sessionId: string): number {
  const session = sessions.get(sessionId);
  if (!session) return 0;
  const currentIndex = STEP_ORDER.indexOf(session.currentStep);
  let remaining = 0;
  for (let i = currentIndex; i < STEP_ORDER.length; i++) {
    remaining += STEP_TIME_ESTIMATES[STEP_ORDER[i]] || 0;
  }
  return remaining;
}

export interface SamplePatientForOnboarding {
  id: string;
  firstName: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  dateOfBirth: string;
  socialHistory?: string;
  familyHistory?: string;
}

const ONBOARDING_SAMPLE_PATIENTS: SamplePatientForOnboarding[] = [
  {
    id: "PT-2001", firstName: "Jane",
    conditions: ["Hypertension", "Type 2 Diabetes", "Hyperlipidemia"],
    medications: ["Metformin 1000mg BID", "Lisinopril 20mg daily", "Atorvastatin 40mg daily", "Aspirin 81mg daily"],
    allergies: ["Penicillin (rash)", "Sulfa drugs (anaphylaxis)"],
    dateOfBirth: "1958-03-14",
    socialHistory: "Non-smoker, occasional alcohol, retired teacher, lives with spouse",
    familyHistory: "Father: MI at age 52; Mother: Type 2 DM, stroke at age 68",
  },
  {
    id: "PT-2002", firstName: "Robert",
    conditions: ["Type 2 Diabetes", "Obesity (BMI 34)", "Peripheral Neuropathy"],
    medications: ["Metformin 500mg BID", "Gabapentin 300mg TID", "Vitamin B12 1000mcg daily"],
    allergies: ["No known drug allergies"],
    dateOfBirth: "1965-07-22",
  },
  {
    id: "PT-2003", firstName: "Mary",
    conditions: ["Pneumonia (community-acquired)", "Asthma", "GERD"],
    medications: ["Azithromycin 500mg daily", "Albuterol inhaler PRN", "Omeprazole 20mg daily", "Prednisone 40mg taper"],
    allergies: ["Codeine (nausea)"],
    dateOfBirth: "1972-11-05",
  },
  {
    id: "PT-2005", firstName: "Sarah",
    conditions: ["Type 2 Diabetes (newly diagnosed)", "Obesity (BMI 32)"],
    medications: [],
    allergies: ["Latex (contact dermatitis)"],
    dateOfBirth: "1990-04-30",
  },
  {
    id: "PT-2006", firstName: "John",
    conditions: ["Chronic Migraines", "Tension Headaches", "Insomnia"],
    medications: ["Sumatriptan 100mg PRN", "Topiramate 50mg BID", "Melatonin 3mg HS"],
    allergies: ["NSAIDs (GI bleeding)"],
    dateOfBirth: "1975-01-12",
  },
];

export function getSamplePatients(): SamplePatientForOnboarding[] {
  return ONBOARDING_SAMPLE_PATIENTS;
}

export function createSessionWithPatientData(
  samplePatientId: string,
  language: string,
  languageName: string
): OnboardingSession {
  const samplePatient = ONBOARDING_SAMPLE_PATIENTS.find(p => p.id === samplePatientId);

  const prepopulated: PrepopulatedData = {
    conditions: (samplePatient?.conditions || []).map(c => ({
      name: c, diagnosisDate: "", status: "active", notes: "",
    })),
    medications: (samplePatient?.medications || []).map(m => {
      const parts = m.match(/^(.+?)\s+(\d+\w+)\s+(.+)$/);
      return {
        name: parts?.[1] || m,
        dosage: parts?.[2] || "",
        frequency: parts?.[3] || "",
        prescriber: "",
        reason: "",
      };
    }),
    allergies: (samplePatient?.allergies || [])
      .filter(a => a !== "No known drug allergies")
      .map(a => {
        const match = a.match(/^(.+?)\s*\((.+)\)$/);
        return {
          allergen: match?.[1] || a,
          reaction: match?.[2] || "",
          severity: "moderate",
        };
      }),
    surgeries: [],
    demographics: {
      firstName: samplePatient?.firstName || "",
      dateOfBirth: samplePatient?.dateOfBirth || "",
    },
    source: "Tabula Medica Patient Records",
  };

  const id = generateId();
  const now = new Date().toISOString();

  const session: OnboardingSession = {
    id,
    patientId: samplePatientId,
    language,
    languageName,
    currentStep: "demographics",
    currentOrganSystem: 0,
    demographics: { ...prepopulated.demographics },
    conditions: [...prepopulated.conditions],
    medications: [...prepopulated.medications],
    allergies: [...prepopulated.allergies],
    surgeries: [...prepopulated.surgeries],
    familyHistory: [],
    socialHistory: {},
    reviewOfSystems: {},
    messages: [],
    prepopulatedData: prepopulated,
    prepopulationConfirmed: false,
    completedSteps: ["language_selection"],
    createdAt: now,
    updatedAt: now,
    status: "active",
  };

  const welcomeMsg: ChatMessage = {
    id: generateMessageId(),
    role: "assistant",
    content: getWelcomeMessage(languageName, true),
    timestamp: now,
    step: "demographics",
  };
  session.messages.push(welcomeMsg);

  sessions.set(id, session);
  return session;
}

export function updateSessionSection(
  sessionId: string,
  section: string,
  data: Record<string, unknown>
): { success: boolean; message: string } {
  const session = sessions.get(sessionId);
  if (!session) return { success: false, message: "Session not found" };

  switch (section) {
    case "demographics":
      session.demographics = { ...session.demographics, ...data } as Partial<Demographics>;
      break;
    case "conditions":
      if (Array.isArray(data.conditions)) {
        session.conditions = data.conditions as ConditionEntry[];
      }
      break;
    case "medications":
      if (Array.isArray(data.medications)) {
        session.medications = data.medications as MedicationEntry[];
      }
      break;
    case "allergies":
      if (Array.isArray(data.allergies)) {
        session.allergies = data.allergies as AllergyEntry[];
      }
      break;
    case "surgeries":
      if (Array.isArray(data.surgeries)) {
        session.surgeries = data.surgeries as SurgeryEntry[];
      }
      break;
    case "family_history":
      if (Array.isArray(data.familyHistory)) {
        session.familyHistory = data.familyHistory as FamilyHistoryEntry[];
      }
      break;
    case "social_history":
      session.socialHistory = { ...session.socialHistory, ...data } as Partial<SocialHistory>;
      break;
    default:
      return { success: false, message: `Unknown section: ${section}` };
  }

  session.updatedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  return { success: true, message: `${section} updated successfully` };
}
