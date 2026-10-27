import { governedAICall } from "./third-party-data-governance";
import { storage } from "./storage";

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  quickActions?: QuickAction[];
  intakeFields?: IntakeField[];
}

interface QuickAction {
  label: string;
  action: string;
  icon: string;
}

interface IntakeField {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "multiselect";
  options?: string[];
  value?: string;
  required?: boolean;
  category: string;
}

interface AssistantContext {
  userId: string;
  onboardingStep: string;
  completedSteps: string[];
  patientProfile?: any;
  existingRecords?: number;
}

const conversationStore = new Map<string, ConversationMessage[]>();

const PLATFORM_FEATURES = {
  healthTimeline: {
    name: "Health Timeline",
    description: "See all your health events in chronological order - visits, labs, medications, and more. Everything is organized so you can spot trends at a glance.",
    icon: "clock",
  },
  aiAssistant: {
    name: "AI Health Assistant",
    description: "Chat with an AI that understands your health records. Ask questions about your conditions, medications, or test results in plain language.",
    icon: "message-circle",
  },
  healthSummary: {
    name: "My Health Summary",
    description: "Get a simplified, easy-to-read overview of your complete health picture - conditions, medications, upcoming appointments, and personalized tips.",
    icon: "file-text",
  },
  medicationTracking: {
    name: "Medication Tracking",
    description: "Keep track of all your medications with reminders. The system checks for potential drug interactions to keep you safe.",
    icon: "package",
  },
  recordSharing: {
    name: "Secure Record Sharing",
    description: "Share your health records with any provider through time-limited, encrypted links. You control who sees your data and for how long.",
    icon: "share-2",
  },
  dataSecurity: {
    name: "Data Security",
    description: "Your health data is encrypted with military-grade security (AES-256) and fully HIPAA compliant. Only you decide who can access your information.",
    icon: "shield",
  },
};

const ONBOARDING_STEPS = [
  "welcome",
  "profile_basics",
  "health_conditions",
  "medications",
  "goals",
  "feature_tour",
  "complete",
];

function getStepIntakeFields(step: string): IntakeField[] {
  switch (step) {
    case "profile_basics":
      return [
        { id: "preferred_name", label: "What should we call you?", type: "text", required: false, category: "demographics" },
        { id: "age_range", label: "Age range", type: "select", options: ["18-29", "30-39", "40-49", "50-64", "65+"], required: true, category: "demographics" },
        { id: "biological_sex", label: "Biological sex", type: "select", options: ["Male", "Female", "Prefer not to say"], required: false, category: "demographics" },
      ];
    case "health_conditions":
      return [
        { id: "conditions", label: "Any health conditions you manage?", type: "multiselect", options: [
          "Diabetes", "High Blood Pressure", "Heart Disease", "Asthma", "COPD",
          "Arthritis", "Thyroid Disorder", "Anxiety", "Depression", "None",
        ], required: false, category: "conditions" },
        { id: "allergies", label: "Known allergies", type: "text", required: false, category: "conditions" },
      ];
    case "medications":
      return [
        { id: "med_count", label: "How many medications do you take?", type: "select", options: ["None", "1-2", "3-5", "6-10", "More than 10"], required: false, category: "medications" },
        { id: "pharmacy", label: "Primary pharmacy (optional)", type: "text", required: false, category: "medications" },
      ];
    case "goals":
      return [
        { id: "health_goals", label: "What are your health goals?", type: "multiselect", options: [
          "Better manage my conditions", "Stay on top of preventive care",
          "Track my medications", "Understand my test results",
          "Share records with providers", "Improve overall wellness",
        ], required: false, category: "goals" },
      ];
    default:
      return [];
  }
}

function getStepPromptContext(step: string, context: AssistantContext): string {
  const completedList = context.completedSteps.length > 0
    ? `Steps already completed: ${context.completedSteps.join(", ")}.`
    : "This is the beginning of onboarding.";

  switch (step) {
    case "welcome":
      return `The patient just opened the onboarding assistant. ${completedList} Warmly welcome them to Tabula Medica. Briefly explain that you'll help them set up their health hub in just a few minutes. Ask if they'd like a quick walkthrough or want to jump right in. Keep it short and friendly.`;
    case "profile_basics":
      return `${completedList} Now help the patient fill in their basic profile information. The intake fields for this step are being shown to them. Explain why having basic profile info helps personalize their experience. Be encouraging and note that all fields except age range are optional.`;
    case "health_conditions":
      return `${completedList} Now help the patient share their health conditions. The intake fields are shown. Explain that sharing conditions helps the app provide relevant insights, drug interaction checking, and personalized care reminders. Reassure them that this information is encrypted and only they can access it.`;
    case "medications":
      return `${completedList} Now help the patient with their medication information. Explain how medication tracking works - reminders, drug interaction checks, and easy sharing with providers. Mention they can add detailed medications later.`;
    case "goals":
      return `${completedList} Ask the patient about their health goals. The goal selection is shown. Explain how the app adapts to their goals - for example, if they want to manage conditions, the dashboard prioritizes condition tracking; if preventive care, it highlights screening reminders.`;
    case "feature_tour":
      return `${completedList} Give a brief, enthusiastic overview of 3-4 key features most relevant to what the patient has shared so far. ${context.existingRecords ? `They already have ${context.existingRecords} health records imported.` : ""} Keep each feature explanation to 1-2 sentences. End by asking if they have any questions.`;
    case "complete":
      return `${completedList} The patient has completed the setup! Congratulate them warmly. Summarize what was set up. Suggest 2-3 immediate next steps they can take (like exploring their health timeline, chatting with the AI assistant, or connecting health data sources). End with an encouraging note.`;
    default:
      return completedList;
  }
}

export async function handleAssistantMessage(
  userId: string,
  userMessage: string,
  currentStep: string,
  completedSteps: string[],
  intakeData?: Record<string, any>,
): Promise<{
  response: ConversationMessage;
  nextStep?: string;
  intakeFields?: IntakeField[];
  shouldAdvance: boolean;
  savedData?: boolean;
}> {
  const history = conversationStore.get(userId) || [];

  const [profile, records] = await Promise.all([
    storage.getPatientProfile(userId).catch(() => null),
    storage.getHealthRecords(userId).catch(() => []),
  ]);

  const context: AssistantContext = {
    userId,
    onboardingStep: currentStep,
    completedSteps,
    patientProfile: profile,
    existingRecords: records.length,
  };

  const stepContext = getStepPromptContext(currentStep, context);
  const featureDescriptions = Object.entries(PLATFORM_FEATURES)
    .map(([key, f]) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const conversationHistory = history.slice(-6).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  if (intakeData && Object.keys(intakeData).length > 0) {
    try {
      await saveIntakeData(userId, currentStep, intakeData);
    } catch (err) {
      console.error("[OnboardingAssistant] Save intake data error:", err);
    }
  }

  const systemPrompt = `You are a friendly, knowledgeable onboarding assistant for Tabula Medica, a patient health records app. Your role is to guide new patients through their initial setup.

Your personality:
- Warm, supportive, and professional
- Use simple, clear language (avoid medical jargon unless explaining a term)
- Encouraging without being overly enthusiastic
- Respect patient privacy - never ask for sensitive identifiers (SSN, exact DOB, etc.)

Current onboarding step: ${currentStep}
${stepContext}

Platform features you can explain:
${featureDescriptions}

Rules:
- Keep responses concise (2-4 sentences typically)
- NEVER provide medical advice or diagnoses
- Always include "not medical advice" when discussing health conditions
- If the patient asks a health question, acknowledge it warmly but redirect them to the AI Health Assistant or their provider
- If the patient seems ready to move on, indicate that in your response
- If intake form data was just submitted, acknowledge what they shared and validate their input

Respond in valid JSON:
{
  "message": "Your conversational response",
  "shouldAdvance": false,
  "quickActions": [{"label": "button text", "action": "action_id", "icon": "feather-icon-name"}],
  "featureHighlight": null
}

Set shouldAdvance to true when the patient has completed the current step or explicitly wants to move forward.
quickActions should offer 2-3 contextual options the patient can tap (like "Tell me more", "Next step", "What features do you have?").
featureHighlight should be a feature key if you want to highlight a specific feature.`;

  const userContent = intakeData && Object.keys(intakeData).length > 0
    ? `Patient submitted intake data for step "${currentStep}": ${JSON.stringify(intakeData)}. ${userMessage ? `They also said: "${userMessage}"` : "Please acknowledge their submission."}`
    : userMessage;

  try {
    const result = await governedAICall({
      systemPrompt,
      userPrompt: userContent || "Let's get started!",
      purpose: "health_analytics",
      dataCategories: ["conditions", "medications"],
      callerService: "OnboardingAssistant",
      callerMethod: "handleMessage",
      userId,
      model: "gpt-5.2",
      maxTokens: 800,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(result.content);

    const currentStepIndex = ONBOARDING_STEPS.indexOf(currentStep);
    const shouldAdvance = parsed.shouldAdvance === true;
    const nextStep = shouldAdvance && currentStepIndex < ONBOARDING_STEPS.length - 1
      ? ONBOARDING_STEPS[currentStepIndex + 1]
      : undefined;

    const assistantMessage: ConversationMessage = {
      role: "assistant",
      content: parsed.message || "I'm here to help you get set up! What would you like to know?",
      timestamp: new Date().toISOString(),
      quickActions: parsed.quickActions || getDefaultQuickActions(currentStep),
      intakeFields: nextStep ? getStepIntakeFields(nextStep) : undefined,
    };

    if (userMessage) {
      history.push({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });
    }
    history.push(assistantMessage);
    conversationStore.set(userId, history.slice(-20));

    return {
      response: assistantMessage,
      nextStep,
      intakeFields: nextStep ? getStepIntakeFields(nextStep) : getStepIntakeFields(currentStep),
      shouldAdvance,
      savedData: intakeData ? true : undefined,
    };
  } catch (error: any) {
    console.error("[OnboardingAssistant] AI call failed:", error.message);

    const fallbackMessage = getFallbackMessage(currentStep);
    const assistantMessage: ConversationMessage = {
      role: "assistant",
      content: fallbackMessage,
      timestamp: new Date().toISOString(),
      quickActions: getDefaultQuickActions(currentStep),
    };

    history.push(assistantMessage);
    conversationStore.set(userId, history.slice(-20));

    return {
      response: assistantMessage,
      intakeFields: getStepIntakeFields(currentStep),
      shouldAdvance: false,
    };
  }
}

function getDefaultQuickActions(step: string): QuickAction[] {
  switch (step) {
    case "welcome":
      return [
        { label: "Quick walkthrough", action: "walkthrough", icon: "play" },
        { label: "Jump right in", action: "advance", icon: "arrow-right" },
        { label: "What is this app?", action: "explain_app", icon: "info" },
      ];
    case "profile_basics":
    case "health_conditions":
    case "medications":
    case "goals":
      return [
        { label: "Why do you need this?", action: "explain_why", icon: "help-circle" },
        { label: "Skip this step", action: "skip", icon: "skip-forward" },
        { label: "Next step", action: "advance", icon: "arrow-right" },
      ];
    case "feature_tour":
      return [
        { label: "Tell me more", action: "more_features", icon: "info" },
        { label: "Finish setup", action: "advance", icon: "check" },
      ];
    case "complete":
      return [
        { label: "Explore Timeline", action: "navigate_timeline", icon: "clock" },
        { label: "Chat with AI", action: "navigate_ai", icon: "message-circle" },
        { label: "View Summary", action: "navigate_summary", icon: "file-text" },
      ];
    default:
      return [
        { label: "Continue", action: "advance", icon: "arrow-right" },
      ];
  }
}

function getFallbackMessage(step: string): string {
  switch (step) {
    case "welcome":
      return "Welcome to Tabula Medica! I'm your setup assistant. I'll help you get everything configured in just a few minutes. Would you like a quick walkthrough, or do you want to jump right in?";
    case "profile_basics":
      return "Let's start with some basic information about you. This helps us personalize your experience. Fill in what you're comfortable sharing - only the age range is needed to get going.";
    case "health_conditions":
      return "If you'd like, share any health conditions you manage. This helps the app provide relevant insights and safety checks. Everything you share is encrypted and private.";
    case "medications":
      return "Tell us about your medications so we can set up tracking and interaction checking. You can always add more details later.";
    case "goals":
      return "What would you like to get out of Tabula Medica? Select the goals that matter most to you, and we'll customize your dashboard accordingly.";
    case "feature_tour":
      return "Here are some features you'll love: Your Health Timeline shows everything in one place, the AI Assistant answers health questions in plain language, and Secure Sharing lets you send records to any provider with one tap.";
    case "complete":
      return "You're all set! Your health hub is ready. Try exploring your Health Timeline, chatting with the AI Assistant, or viewing your personalized Health Summary.";
    default:
      return "I'm here to help you get set up. What would you like to know?";
  }
}

async function saveIntakeData(userId: string, step: string, data: Record<string, any>) {
  const profileUpdates: Record<string, any> = {};

  if (data.preferred_name) {
    profileUpdates.preferredName = data.preferred_name;
  }
  if (data.biological_sex) {
    profileUpdates.gender = data.biological_sex.toLowerCase();
  }
  if (data.conditions && Array.isArray(data.conditions)) {
    profileUpdates.healthConditions = data.conditions.filter((c: string) => c !== "None");
  }
  if (data.health_goals && Array.isArray(data.health_goals)) {
    profileUpdates.healthGoals = data.health_goals;
  }

  if (Object.keys(profileUpdates).length > 0) {
    try {
      await storage.upsertPatientProfile(userId, profileUpdates as any);
    } catch (e) {
      console.error("[OnboardingAssistant] Profile update error:", e);
    }
  }

  try {
    await storage.createHealthRecord({
      userId,
      type: "intake",
      title: `Onboarding: ${step}`,
      summary: `Intake data collected during ${step} step`,
      date: new Date(),
      provider: "AI Onboarding Assistant",
      facility: "Tabula Medica",
      fhirResourceType: "QuestionnaireResponse",
      fhirResourceId: `onboarding-${step}-${Date.now()}`,
      isManual: true,
      details: { step, data, collectedAt: new Date().toISOString() },
      sourceId: null,
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    });
  } catch (e) {
    console.error("[OnboardingAssistant] Health record creation error:", e);
  }
}

export function getConversationHistory(userId: string): ConversationMessage[] {
  return conversationStore.get(userId) || [];
}

export function resetConversation(userId: string) {
  conversationStore.delete(userId);
}

export function getOnboardingSteps() {
  return ONBOARDING_STEPS.map((step, index) => ({
    id: step,
    order: index,
    label: step.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    intakeFields: getStepIntakeFields(step),
  }));
}

export function getPlatformFeatures() {
  return PLATFORM_FEATURES;
}
