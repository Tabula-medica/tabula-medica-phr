import { generatePhiSafeText } from "./ai-gateway";
import crypto from "crypto";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][UnifiedOnboarding] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

export type SupportedLanguage = 
  | "en" | "es" | "zh" | "hi" | "ar" | "pt" | "bn" | "ru" 
  | "ja" | "pa" | "de" | "ko" | "fr" | "vi" | "tl" | "it";

export type PatientPopulationType = 
  | "general" | "geriatric" | "pediatric" | "cancer" | "special_needs" | "caregiver";

export type AccessibilityPreference = 
  | "standard" | "voice_only" | "high_contrast" | "large_text" | "screen_reader" | "simplified";

export interface OnboardingLanguagePreference {
  primaryLanguage: SupportedLanguage;
  secondaryLanguage?: SupportedLanguage;
  voiceLanguage?: SupportedLanguage;
  summaryLanguages: SupportedLanguage[];
}

export interface AccessibilitySettings {
  preferredMode: AccessibilityPreference;
  voiceNavigationEnabled: boolean;
  screenReaderOptimized: boolean;
  highContrastMode: boolean;
  largeTextMode: boolean;
  simplifiedViewMode: boolean;
  reducedMotion: boolean;
  textToSpeechEnabled: boolean;
  speechToTextEnabled: boolean;
}

export interface PatientProfile {
  id: string;
  userId: string;
  populationType: PatientPopulationType;
  languagePreference: OnboardingLanguagePreference;
  accessibilitySettings: AccessibilitySettings;
  caregiverIds: string[];
  specialConditions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStep {
  id: string;
  stepType: string;
  title: string;
  description: string;
  order: number;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt?: string;
  skippedAt?: string;
  tutorialId?: string;
}

export interface OnboardingWorkflow {
  id: string;
  patientId: string;
  profileId: string;
  steps: OnboardingStep[];
  currentStepIndex: number;
  status: "not_started" | "in_progress" | "paused" | "completed";
  welcomeMessage?: PersonalizedWelcome;
  reminders: OnboardingReminder[];
  completionPercentage: number;
  startedAt?: string;
  completedAt?: string;
  lastActivityAt: string;
  populationType: PatientPopulationType;
}

export interface PersonalizedWelcome {
  id: string;
  patientId: string;
  messageEn: string;
  messageTranslated?: string;
  translatedLanguage?: SupportedLanguage;
  audioUrlEn?: string;
  audioUrlTranslated?: string;
  generatedAt: string;
  personalizedElements: string[];
  noCdsDisclaimer: string;
  noCdsDisclaimerTranslated?: string;
}

const NO_CDS_DISCLAIMERS: Record<SupportedLanguage, string> = {
  en: "IMPORTANT: This app provides health information only. It does NOT provide medical advice, diagnoses, or treatment recommendations. Always consult your healthcare provider.",
  es: "IMPORTANTE: Esta aplicacion proporciona solo informacion de salud. NO proporciona consejos medicos, diagnosticos ni recomendaciones de tratamiento.",
  zh: "Important: This app provides health information only. Not medical advice. Consult your doctor.",
  hi: "Mahatvapurn: Yeh app sirf swasthya jaankari deta hai. Yeh medical salah nahi hai.",
  ar: "Important: This app provides health information only. Not medical advice.",
  pt: "IMPORTANTE: Este aplicativo fornece apenas informacoes de saude. NAO fornece aconselhamento medico.",
  bn: "Gurutbapurno: Ei app shudhu swasthya tothyo dey. Eta medical poramersh noy.",
  ru: "VAZHNO: Eto prilozhenie predostavlyaet tolko informaciyu o zdorovye. Eto NE medicinskiy sovet.",
  ja: "Important: This app provides health information only. Not medical advice.",
  pa: "Mahatvapurn: Eh app sirf sehat di jaankari dindi hai. Eh medical salah nahi hai.",
  de: "WICHTIG: Diese App bietet nur Gesundheitsinformationen. Sie bietet KEINE medizinische Beratung.",
  ko: "Important: This app provides health information only. Not medical advice.",
  fr: "IMPORTANT: Cette application fournit uniquement des informations sur la sante. Elle NE fournit PAS de conseils medicaux.",
  vi: "QUAN TRONG: Ung dung nay chi cung cap thong tin suc khoe. Khong phai loi khuyen y te.",
  tl: "MAHALAGA: Ang app na ito ay nagbibigay lamang ng impormasyon sa kalusugan. HINDI ito medical advice.",
  it: "IMPORTANTE: Questa app fornisce solo informazioni sulla salute. NON fornisce consulenza medica.",
};

export interface OnboardingReminder {
  id: string;
  workflowId: string;
  patientId: string;
  stepId: string;
  reminderType: "incomplete_step" | "stalled_progress" | "final_reminder";
  message: string;
  scheduledAt: string;
  sentAt?: string;
  deliveryChannel: "email" | "sms" | "in_app" | "push";
  language: SupportedLanguage;
}

export interface InteractiveTutorial {
  id: string;
  featureType: "secure_messaging" | "appointment_scheduling" | "document_sharing" | "health_records" | "voice_navigation" | "caregiver_access";
  title: string;
  titleTranslations: Record<SupportedLanguage, string>;
  description: string;
  descriptionTranslations: Record<SupportedLanguage, string>;
  steps: TutorialStep[];
  estimatedDurationMinutes: number;
  populationTypes: PatientPopulationType[];
  accessibilityModes: AccessibilityPreference[];
  hasVoiceGuidance: boolean;
}

export interface TutorialStep {
  id: string;
  order: number;
  title: string;
  titleTranslations: Record<SupportedLanguage, string>;
  instruction: string;
  instructionTranslations: Record<SupportedLanguage, string>;
  actionType: "click" | "input" | "navigate" | "observe" | "voice_command";
  targetElement?: string;
  voiceCommand?: string;
  completionCriteria: string;
  helpText: string;
  helpTextTranslations: Record<SupportedLanguage, string>;
}

export interface OnboardingAnalytics {
  totalOnboardings: number;
  completionRate: number;
  averageCompletionTime: number;
  stepDropoffRates: Record<string, number>;
  popularLanguages: Record<SupportedLanguage, number>;
  populationDistribution: Record<PatientPopulationType, number>;
  accessibilityUsage: Record<AccessibilityPreference, number>;
}

const supportedLanguages: Record<SupportedLanguage, { name: string; nativeName: string; voiceSupported: boolean }> = {
  en: { name: "English", nativeName: "English", voiceSupported: true },
  es: { name: "Spanish", nativeName: "Español", voiceSupported: true },
  zh: { name: "Chinese", nativeName: "中文", voiceSupported: true },
  hi: { name: "Hindi", nativeName: "हिन्दी", voiceSupported: true },
  ar: { name: "Arabic", nativeName: "العربية", voiceSupported: true },
  pt: { name: "Portuguese", nativeName: "Português", voiceSupported: true },
  bn: { name: "Bengali", nativeName: "বাংলা", voiceSupported: true },
  ru: { name: "Russian", nativeName: "Русский", voiceSupported: true },
  ja: { name: "Japanese", nativeName: "日本語", voiceSupported: true },
  pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", voiceSupported: false },
  de: { name: "German", nativeName: "Deutsch", voiceSupported: true },
  ko: { name: "Korean", nativeName: "한국어", voiceSupported: true },
  fr: { name: "French", nativeName: "Français", voiceSupported: true },
  vi: { name: "Vietnamese", nativeName: "Tiếng Việt", voiceSupported: true },
  tl: { name: "Tagalog", nativeName: "Tagalog", voiceSupported: false },
  it: { name: "Italian", nativeName: "Italiano", voiceSupported: true },
};

const patientProfiles: Map<string, PatientProfile> = new Map();
const onboardingWorkflows: Map<string, OnboardingWorkflow> = new Map();
const personalizedWelcomes: Map<string, PersonalizedWelcome> = new Map();
const onboardingReminders: Map<string, OnboardingReminder> = new Map();
const tutorials: Map<string, InteractiveTutorial> = new Map();

function generateId(): string {
  return `uao-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getDefaultAccessibilitySettings(): AccessibilitySettings {
  return {
    preferredMode: "standard",
    voiceNavigationEnabled: false,
    screenReaderOptimized: false,
    highContrastMode: false,
    largeTextMode: false,
    simplifiedViewMode: false,
    reducedMotion: false,
    textToSpeechEnabled: false,
    speechToTextEnabled: false,
  };
}

function getOnboardingStepsForPopulation(populationType: PatientPopulationType): OnboardingStep[] {
  const baseSteps: Omit<OnboardingStep, "id">[] = [
    { stepType: "language_selection", title: "Choose Your Language", description: "Select your preferred language for the app and health summaries", order: 1, isRequired: true, isCompleted: false },
    { stepType: "accessibility_setup", title: "Accessibility Preferences", description: "Set up voice navigation, text size, and other accessibility options", order: 2, isRequired: false, isCompleted: false },
    { stepType: "profile_creation", title: "Create Your Profile", description: "Enter your basic information to personalize your experience", order: 3, isRequired: true, isCompleted: false },
    { stepType: "identity_verification", title: "Verify Your Identity", description: "Secure verification to protect your health records", order: 4, isRequired: true, isCompleted: false },
    { stepType: "ehr_connection", title: "Connect Health Records", description: "Link your existing health records from hospitals and clinics", order: 5, isRequired: false, isCompleted: false },
    { stepType: "consent_privacy", title: "Privacy & Consent", description: "Review and accept privacy policies and data usage consent", order: 6, isRequired: true, isCompleted: false },
  ];

  const tutorialSteps: Omit<OnboardingStep, "id">[] = [
    { stepType: "tutorial_messaging", title: "Secure Messaging Tutorial", description: "Learn how to securely message your healthcare providers", order: 7, isRequired: false, isCompleted: false, tutorialId: "tut-secure-messaging" },
    { stepType: "tutorial_appointments", title: "Appointment Scheduling Tutorial", description: "Learn how to request and manage appointments", order: 8, isRequired: false, isCompleted: false, tutorialId: "tut-appointments" },
    { stepType: "tutorial_documents", title: "Document Sharing Tutorial", description: "Learn how to view and share your health documents", order: 9, isRequired: false, isCompleted: false, tutorialId: "tut-documents" },
  ];

  const populationSpecificSteps: Record<PatientPopulationType, Omit<OnboardingStep, "id">[]> = {
    general: [],
    geriatric: [
      { stepType: "caregiver_setup", title: "Caregiver Access", description: "Set up access for family members or caregivers who help manage your health", order: 10, isRequired: false, isCompleted: false },
      { stepType: "medication_setup", title: "Medication Tracking", description: "Set up your medication list and reminders", order: 11, isRequired: false, isCompleted: false },
    ],
    pediatric: [
      { stepType: "guardian_verification", title: "Parent/Guardian Verification", description: "Verify parent or guardian identity for the child's records", order: 10, isRequired: true, isCompleted: false },
      { stepType: "growth_tracking", title: "Growth & Development", description: "Set up growth and development tracking", order: 11, isRequired: false, isCompleted: false },
    ],
    cancer: [
      { stepType: "cancer_type_setup", title: "Cancer Information", description: "Enter your cancer diagnosis information for personalized survivorship care", order: 10, isRequired: false, isCompleted: false },
      { stepType: "treatment_history", title: "Treatment History", description: "Document your cancer treatment history", order: 11, isRequired: false, isCompleted: false },
      { stepType: "survivorship_plan", title: "Survivorship Care Plan", description: "Set up your survivorship care plan", order: 12, isRequired: false, isCompleted: false },
    ],
    special_needs: [
      { stepType: "disability_accommodations", title: "Accommodation Preferences", description: "Set up specific accommodations for your needs", order: 10, isRequired: false, isCompleted: false },
      { stepType: "caregiver_network", title: "Care Network", description: "Set up your network of caregivers and support persons", order: 11, isRequired: false, isCompleted: false },
      { stepType: "voice_tutorial", title: "Voice Navigation Tutorial", description: "Learn to navigate the app using voice commands", order: 12, isRequired: false, isCompleted: false, tutorialId: "tut-voice-navigation" },
    ],
    caregiver: [
      { stepType: "caregiver_role", title: "Caregiver Role Setup", description: "Define your caregiver role and responsibilities", order: 10, isRequired: true, isCompleted: false },
      { stepType: "patient_linking", title: "Link to Patient", description: "Connect to the patient(s) you are caring for", order: 11, isRequired: true, isCompleted: false },
      { stepType: "permissions_review", title: "Permissions Review", description: "Review what health information you can access", order: 12, isRequired: true, isCompleted: false },
    ],
  };

  const completionStep: Omit<OnboardingStep, "id"> = {
    stepType: "completion", title: "Welcome Complete!", description: "Your setup is complete. Explore your health records!", order: 99, isRequired: true, isCompleted: false
  };

  const allSteps = [
    ...baseSteps,
    ...tutorialSteps,
    ...populationSpecificSteps[populationType],
    completionStep,
  ];

  return allSteps.map((step, index) => ({
    ...step,
    id: generateId(),
    order: index + 1,
  }));
}

async function generatePersonalizedWelcome(
  patientId: string,
  patientName: string,
  populationType: PatientPopulationType,
  primaryLanguage: SupportedLanguage,
  accessibilityNeeds: string[]
): Promise<PersonalizedWelcome> {
  const welcomeId = generateId();
  logHipaaAudit("GENERATE_WELCOME", patientId, `Generating personalized welcome for ${populationType} patient`);

  let messageEn = "";
  let messageTranslated: string | undefined;
  const personalizedElements: string[] = [];

  try {
    const populationContext: Record<PatientPopulationType, string> = {
      general: "a new patient",
      geriatric: "a senior patient who may benefit from larger text and simplified navigation",
      pediatric: "a parent/guardian setting up their child's health records",
      cancer: "a cancer patient or survivor who needs comprehensive survivorship care support",
      special_needs: "a patient with special needs who may require accessibility accommodations",
      caregiver: "a caregiver helping manage a loved one's health records",
    };

    const accessibilityContext = accessibilityNeeds.length > 0 
      ? `The patient has indicated the following accessibility needs: ${accessibilityNeeds.join(", ")}.`
      : "";

    const prompt = `Generate a warm, personalized welcome message for ${populationContext[populationType]}.
${accessibilityContext}

Requirements:
1. Be warm, supportive, and encouraging
2. Reference their specific situation (${populationType})
3. Highlight relevant features they might find helpful
4. Keep the message concise (2-3 sentences)
5. Use simple, clear language
6. Do NOT provide any medical advice

The patient's name is ${patientName || "there"}.`;

    messageEn = (await generatePhiSafeText({
      system: "You are a friendly healthcare app assistant helping new patients feel welcome. Never provide medical advice. Be warm and supportive.",
      user: prompt,
      maxTokens: 200,
    })) || getDefaultWelcomeMessage(populationType, patientName);
    personalizedElements.push("ai_generated", populationType);

    if (primaryLanguage !== "en") {
      messageTranslated = (await generatePhiSafeText({
        system: `Translate the following message to ${supportedLanguages[primaryLanguage].name}. Keep the same warm, supportive tone.`,
        user: messageEn,
        maxTokens: 300,
      })) || undefined;
      personalizedElements.push("translated");
    }
  } catch (error) {
    console.error("[UnifiedOnboarding] AI welcome generation failed, using fallback:", error);
    messageEn = getDefaultWelcomeMessage(populationType, patientName);
    personalizedElements.push("fallback");
  }

  const welcome: PersonalizedWelcome = {
    id: welcomeId,
    patientId,
    messageEn,
    messageTranslated,
    translatedLanguage: primaryLanguage !== "en" ? primaryLanguage : undefined,
    generatedAt: new Date().toISOString(),
    personalizedElements,
    noCdsDisclaimer: NO_CDS_DISCLAIMERS.en,
    noCdsDisclaimerTranslated: primaryLanguage !== "en" ? NO_CDS_DISCLAIMERS[primaryLanguage] : undefined,
  };

  personalizedWelcomes.set(welcomeId, welcome);
  return welcome;
}

function getDefaultWelcomeMessage(populationType: PatientPopulationType, patientName: string): string {
  const name = patientName || "there";
  const messages: Record<PatientPopulationType, string> = {
    general: `Welcome to Tabula Medica, ${name}! We're excited to help you organize and access all your health records in one secure place. Let's get you set up quickly so you can take control of your health journey.`,
    geriatric: `Welcome, ${name}! We've designed Tabula Medica with you in mind - easy navigation, larger text options, and simple access to your medications and health records. Your family can also help manage your care through our caregiver features.`,
    pediatric: `Welcome, ${name}! Tabula Medica makes it easy to keep track of your child's health records, immunizations, and growth milestones all in one place. Let's get started with a quick setup.`,
    cancer: `Welcome, ${name}. We understand your health journey has been challenging. Tabula Medica is here to help you organize your treatment records, manage your survivorship care plan, and connect with your care team. You've got this.`,
    special_needs: `Welcome, ${name}! Tabula Medica is designed to be accessible for everyone. We offer voice navigation, screen reader support, and simplified views. Let's customize your experience to work best for you.`,
    caregiver: `Welcome, ${name}! Thank you for caring for your loved one. Tabula Medica helps you stay organized, coordinate with healthcare providers, and manage appointments and medications easily. We're here to support you in your caregiving journey.`,
  };
  return messages[populationType];
}

export async function createPatientProfile(
  userId: string,
  populationType: PatientPopulationType,
  languagePreference: OnboardingLanguagePreference,
  accessibilitySettings?: Partial<AccessibilitySettings>,
  caregiverIds?: string[],
  specialConditions?: string[]
): Promise<PatientProfile> {
  const profileId = generateId();
  logHipaaAudit("CREATE_PROFILE", userId, `Creating profile with type: ${populationType}`);

  const profile: PatientProfile = {
    id: profileId,
    userId,
    populationType,
    languagePreference,
    accessibilitySettings: {
      ...getDefaultAccessibilitySettings(),
      ...accessibilitySettings,
    },
    caregiverIds: caregiverIds || [],
    specialConditions: specialConditions || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  patientProfiles.set(profileId, profile);
  return profile;
}

export async function startOnboarding(
  patientId: string,
  patientName: string,
  populationType: PatientPopulationType,
  languagePreference: OnboardingLanguagePreference
): Promise<{ workflow: OnboardingWorkflow; welcome: PersonalizedWelcome }> {
  const workflowId = generateId();
  const now = new Date().toISOString();
  
  logHipaaAudit("START_ONBOARDING", patientId, `Starting onboarding for ${populationType} patient`);

  const profile = await createPatientProfile(patientId, populationType, languagePreference);
  const steps = getOnboardingStepsForPopulation(populationType);
  
  const welcome = await generatePersonalizedWelcome(
    patientId,
    patientName,
    populationType,
    languagePreference.primaryLanguage,
    []
  );

  const workflow: OnboardingWorkflow = {
    id: workflowId,
    patientId,
    profileId: profile.id,
    steps,
    currentStepIndex: 0,
    status: "in_progress",
    welcomeMessage: welcome,
    reminders: [],
    completionPercentage: 0,
    startedAt: now,
    lastActivityAt: now,
    populationType,
  };

  onboardingWorkflows.set(workflowId, workflow);
  
  scheduleOnboardingReminders(workflow, languagePreference.primaryLanguage);

  return { workflow, welcome };
}

export function getOnboardingWorkflow(workflowId: string): OnboardingWorkflow | undefined {
  return onboardingWorkflows.get(workflowId);
}

export function getWorkflowByPatientId(patientId: string): OnboardingWorkflow | undefined {
  const workflows = Array.from(onboardingWorkflows.values());
  for (const workflow of workflows) {
    if (workflow.patientId === patientId && workflow.status !== "completed") {
      return workflow;
    }
  }
  return undefined;
}

export async function completeOnboardingStep(
  workflowId: string,
  stepId: string,
  stepData?: Record<string, unknown>
): Promise<OnboardingWorkflow> {
  const workflow = onboardingWorkflows.get(workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) {
    throw new Error("Step not found");
  }

  logHipaaAudit("COMPLETE_STEP", workflow.patientId, `Completed step: ${workflow.steps[stepIndex].stepType}`);

  workflow.steps[stepIndex].isCompleted = true;
  workflow.steps[stepIndex].completedAt = new Date().toISOString();
  workflow.lastActivityAt = new Date().toISOString();

  const completedSteps = workflow.steps.filter(s => s.isCompleted).length;
  workflow.completionPercentage = Math.round((completedSteps / workflow.steps.length) * 100);

  if (stepIndex < workflow.steps.length - 1) {
    workflow.currentStepIndex = stepIndex + 1;
  }

  if (completedSteps === workflow.steps.length) {
    workflow.status = "completed";
    workflow.completedAt = new Date().toISOString();
    logHipaaAudit("COMPLETE_ONBOARDING", workflow.patientId, "Onboarding completed successfully");
  }

  onboardingWorkflows.set(workflowId, workflow);
  return workflow;
}

export function skipOnboardingStep(workflowId: string, stepId: string): OnboardingWorkflow {
  const workflow = onboardingWorkflows.get(workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) {
    throw new Error("Step not found");
  }

  const step = workflow.steps[stepIndex];
  if (step.isRequired) {
    throw new Error("Cannot skip required step");
  }

  logHipaaAudit("SKIP_STEP", workflow.patientId, `Skipped step: ${step.stepType}`);

  workflow.steps[stepIndex].skippedAt = new Date().toISOString();
  workflow.lastActivityAt = new Date().toISOString();

  if (stepIndex < workflow.steps.length - 1) {
    workflow.currentStepIndex = stepIndex + 1;
  }

  onboardingWorkflows.set(workflowId, workflow);
  return workflow;
}

function scheduleOnboardingReminders(workflow: OnboardingWorkflow, language: SupportedLanguage): void {
  const reminderSchedule = [
    { delay: 24 * 60 * 60 * 1000, type: "incomplete_step" as const },
    { delay: 72 * 60 * 60 * 1000, type: "stalled_progress" as const },
    { delay: 168 * 60 * 60 * 1000, type: "final_reminder" as const },
  ];

  const messages: Record<string, string> = {
    incomplete_step: "You're making great progress! Just a few more steps to complete your health profile setup.",
    stalled_progress: "We noticed you haven't finished setting up your profile. Need any help?",
    final_reminder: "Your health records are waiting for you! Complete your setup to access all features.",
  };

  for (const schedule of reminderSchedule) {
    const reminder: OnboardingReminder = {
      id: generateId(),
      workflowId: workflow.id,
      patientId: workflow.patientId,
      stepId: workflow.steps[workflow.currentStepIndex].id,
      reminderType: schedule.type,
      message: messages[schedule.type],
      scheduledAt: new Date(Date.now() + schedule.delay).toISOString(),
      deliveryChannel: "in_app",
      language,
    };
    onboardingReminders.set(reminder.id, reminder);
    workflow.reminders.push(reminder);
  }
}

export function getPendingReminders(workflowId: string): OnboardingReminder[] {
  return Array.from(onboardingReminders.values())
    .filter(r => r.workflowId === workflowId && !r.sentAt);
}

export function markReminderSent(reminderId: string): void {
  const reminder = onboardingReminders.get(reminderId);
  if (reminder) {
    reminder.sentAt = new Date().toISOString();
    onboardingReminders.set(reminderId, reminder);
  }
}

export function getSupportedLanguagesList(): typeof supportedLanguages {
  return supportedLanguages;
}

export function getPatientProfile(profileId: string): PatientProfile | undefined {
  return patientProfiles.get(profileId);
}

export function updatePatientProfile(
  profileId: string,
  updates: Partial<Omit<PatientProfile, "id" | "userId" | "createdAt">>
): PatientProfile {
  const profile = patientProfiles.get(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  const updatedProfile = {
    ...profile,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  patientProfiles.set(profileId, updatedProfile);
  logHipaaAudit("UPDATE_PROFILE", profile.userId, `Profile updated`);
  return updatedProfile;
}

function initializeTutorials(): void {
  const messagingTutorial: InteractiveTutorial = {
    id: "tut-secure-messaging",
    featureType: "secure_messaging",
    title: "Secure Messaging",
    titleTranslations: {
      en: "Secure Messaging", es: "Mensajería Segura", zh: "安全消息", hi: "सुरक्षित संदेश",
      ar: "الرسائل الآمنة", pt: "Mensagens Seguras", bn: "নিরাপদ বার্তা", ru: "Безопасные сообщения",
      ja: "セキュアメッセージ", pa: "ਸੁਰੱਖਿਅਤ ਸੁਨੇਹਾ", de: "Sichere Nachrichten", ko: "보안 메시지",
      fr: "Messagerie Sécurisée", vi: "Tin nhắn Bảo mật", tl: "Secure na Pagmemensahe", it: "Messaggistica Sicura",
    },
    description: "Learn how to securely communicate with your healthcare team",
    descriptionTranslations: {
      en: "Learn how to securely communicate with your healthcare team",
      es: "Aprenda a comunicarse de forma segura con su equipo de atención médica",
      zh: "了解如何与您的医疗团队安全沟通",
      hi: "अपनी स्वास्थ्य सेवा टीम के साथ सुरक्षित रूप से संवाद करना सीखें",
      ar: "تعلم كيفية التواصل بأمان مع فريق الرعاية الصحية الخاص بك",
      pt: "Aprenda a se comunicar com segurança com sua equipe de saúde",
      bn: "আপনার স্বাস্থ্যসেবা দলের সাথে নিরাপদে যোগাযোগ করতে শিখুন",
      ru: "Узнайте, как безопасно общаться с вашей медицинской командой",
      ja: "医療チームと安全にコミュニケーションする方法を学ぶ",
      pa: "ਆਪਣੀ ਸਿਹਤ ਸੰਭਾਲ ਟੀਮ ਨਾਲ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਸੰਪਰਕ ਕਰਨਾ ਸਿੱਖੋ",
      de: "Erfahren Sie, wie Sie sicher mit Ihrem Gesundheitsteam kommunizieren",
      ko: "의료팀과 안전하게 소통하는 방법을 배우세요",
      fr: "Apprenez à communiquer en toute sécurité avec votre équipe soignante",
      vi: "Tìm hiểu cách liên lạc an toàn với nhóm chăm sóc sức khỏe của bạn",
      tl: "Matuto kung paano ligtas na makipag-usap sa iyong healthcare team",
      it: "Impara a comunicare in modo sicuro con il tuo team sanitario",
    },
    steps: [
      {
        id: "msg-step-1",
        order: 1,
        title: "Find the Messages Tab",
        titleTranslations: { en: "Find the Messages Tab", es: "Encuentra la pestaña de Mensajes", zh: "找到消息选项卡", hi: "संदेश टैब खोजें", ar: "ابحث عن علامة تبويب الرسائل", pt: "Encontre a aba de Mensagens", bn: "বার্তা ট্যাব খুঁজুন", ru: "Найдите вкладку Сообщения", ja: "メッセージタブを見つける", pa: "ਸੁਨੇਹੇ ਟੈਬ ਲੱਭੋ", de: "Finden Sie die Nachrichten-Registerkarte", ko: "메시지 탭 찾기", fr: "Trouvez l'onglet Messages", vi: "Tìm tab Tin nhắn", tl: "Hanapin ang Messages Tab", it: "Trova la scheda Messaggi" },
        instruction: "Click on the 'Messages' icon in the navigation menu",
        instructionTranslations: { en: "Click on the 'Messages' icon in the navigation menu", es: "Haz clic en el icono 'Mensajes' en el menu de navegacion", zh: "Click on the Messages icon in the navigation menu", hi: "Navigation menu mein Messages icon par click karein", ar: "Click on Messages icon", pt: "Clique no icone Mensagens no menu de navegacao", bn: "Navigation menu te Messages icon e click korun", ru: "Nazhmite na znachok Soobscheniya v menyu navigatsii", ja: "Navigation menu no Messages icon wo click", pa: "Navigation menu vich Messages icon te click karo", de: "Klicken Sie auf das Nachrichten-Symbol im Navigationsmenu", ko: "Navigation menu eseo Messages icon eul click haseyo", fr: "Cliquez sur icone Messages dans le menu de navigation", vi: "Nhan vao bieu tuong Tin nhan trong menu dieu huong", tl: "I-click ang Messages icon sa navigation menu", it: "Clicca su icona Messaggi nel menu di navigazione" },
        actionType: "click",
        targetElement: "[data-testid='nav-messages']",
        voiceCommand: "Open messages",
        completionCriteria: "User navigated to messages page",
        helpText: "The Messages icon looks like a chat bubble",
        helpTextTranslations: { en: "The Messages icon looks like a chat bubble", es: "El icono de Mensajes parece una burbuja de chat", zh: "消息图标看起来像一个聊天气泡", hi: "संदेश आइकन एक चैट बबल जैसा दिखता है", ar: "أيقونة الرسائل تبدو مثل فقاعة محادثة", pt: "O ícone de Mensagens parece uma bolha de chat", bn: "বার্তা আইকনটি চ্যাট বাবলের মতো দেখায়", ru: "Значок сообщений выглядит как облачко чата", ja: "メッセージアイコンはチャットバブルのように見えます", pa: "ਸੁਨੇਹੇ ਆਈਕਨ ਚੈਟ ਬੱਬਲ ਵਰਗਾ ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ", de: "Das Nachrichten-Symbol sieht wie eine Chat-Blase aus", ko: "메시지 아이콘은 채팅 버블처럼 보입니다", fr: "L'icône Messages ressemble à une bulle de discussion", vi: "Biểu tượng Tin nhắn trông giống như bong bóng chat", tl: "Ang Messages icon ay mukhang chat bubble", it: "L'icona Messaggi sembra una bolla di chat" },
      },
      {
        id: "msg-step-2",
        order: 2,
        title: "Start a New Conversation",
        titleTranslations: { en: "Start a New Conversation", es: "Iniciar una Nueva Conversación", zh: "开始新对话", hi: "नई बातचीत शुरू करें", ar: "ابدأ محادثة جديدة", pt: "Iniciar uma Nova Conversa", bn: "নতুন কথোপকথন শুরু করুন", ru: "Начать новый разговор", ja: "新しい会話を開始", pa: "ਨਵੀਂ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ", de: "Neue Konversation starten", ko: "새 대화 시작", fr: "Démarrer une nouvelle conversation", vi: "Bắt đầu cuộc trò chuyện mới", tl: "Magsimula ng Bagong Usapan", it: "Avvia una nuova conversazione" },
        instruction: "Click the 'New Message' button to start messaging your care team",
        instructionTranslations: { en: "Click the 'New Message' button to start messaging your care team", es: "Haz clic en el botón 'Nuevo Mensaje' para comenzar a enviar mensajes a tu equipo de atención", zh: "点击'新消息'按钮开始向您的护理团队发送消息", hi: "अपनी देखभाल टीम को संदेश भेजने के लिए 'नया संदेश' बटन पर क्लिक करें", ar: "انقر على زر 'رسالة جديدة' لبدء مراسلة فريق الرعاية الخاص بك", pt: "Clique no botão 'Nova Mensagem' para começar a enviar mensagens à sua equipe de cuidados", bn: "আপনার কেয়ার টিমকে মেসেজ করতে 'নতুন বার্তা' বোতামে ক্লিক করুন", ru: "Нажмите кнопку 'Новое сообщение', чтобы начать переписку с командой по уходу", ja: "「新規メッセージ」ボタンをクリックしてケアチームへのメッセージを開始", pa: "ਆਪਣੀ ਕੇਅਰ ਟੀਮ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜਣ ਲਈ 'ਨਵਾਂ ਸੁਨੇਹਾ' ਬਟਨ 'ਤੇ ਕਲਿੱਕ ਕਰੋ", de: "Klicken Sie auf 'Neue Nachricht', um Ihr Pflegeteam zu kontaktieren", ko: "'새 메시지' 버튼을 클릭하여 케어팀에 메시지 보내기", fr: "Cliquez sur 'Nouveau message' pour commencer à communiquer avec votre équipe soignante", vi: "Nhấp vào nút 'Tin nhắn mới' để bắt đầu nhắn tin với nhóm chăm sóc", tl: "I-click ang 'New Message' button para magsimulang mag-message sa iyong care team", it: "Clicca su 'Nuovo messaggio' per iniziare a comunicare con il tuo team di cura" },
        actionType: "click",
        targetElement: "[data-testid='button-new-message']",
        voiceCommand: "New message",
        completionCriteria: "New message dialog opened",
        helpText: "You can message your doctors, nurses, and other care team members here",
        helpTextTranslations: { en: "You can message your doctors, nurses, and other care team members here", es: "Aquí puede enviar mensajes a sus médicos, enfermeras y otros miembros del equipo de atención", zh: "您可以在这里向您的医生、护士和其他护理团队成员发送消息", hi: "आप यहां अपने डॉक्टरों, नर्सों और देखभाल टीम के अन्य सदस्यों को संदेश भेज सकते हैं", ar: "يمكنك مراسلة أطبائك وممرضاتك وأعضاء فريق الرعاية الآخرين هنا", pt: "Você pode enviar mensagens para seus médicos, enfermeiros e outros membros da equipe de cuidados aqui", bn: "আপনি এখানে আপনার ডাক্তার, নার্স এবং অন্যান্য কেয়ার টিম সদস্যদের মেসেজ করতে পারেন", ru: "Здесь вы можете отправлять сообщения своим врачам, медсестрам и другим членам команды", ja: "ここで医師、看護師、その他のケアチームメンバーにメッセージを送れます", pa: "ਤੁਸੀਂ ਇੱਥੇ ਆਪਣੇ ਡਾਕਟਰਾਂ, ਨਰਸਾਂ ਅਤੇ ਹੋਰ ਕੇਅਰ ਟੀਮ ਮੈਂਬਰਾਂ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜ ਸਕਦੇ ਹੋ", de: "Sie können hier Nachrichten an Ihre Ärzte, Krankenschwestern und andere Teammitglieder senden", ko: "여기서 의사, 간호사 및 기타 케어팀 구성원에게 메시지를 보낼 수 있습니다", fr: "Vous pouvez envoyer des messages à vos médecins, infirmiers et autres membres de l'équipe soignante ici", vi: "Bạn có thể nhắn tin cho bác sĩ, y tá và các thành viên nhóm chăm sóc khác tại đây", tl: "Pwede kang mag-message sa iyong mga doktor, nurse, at ibang care team members dito", it: "Qui puoi inviare messaggi ai tuoi medici, infermieri e altri membri del team di cura" },
      },
    ],
    estimatedDurationMinutes: 5,
    populationTypes: ["general", "geriatric", "pediatric", "cancer", "special_needs", "caregiver"],
    accessibilityModes: ["standard", "voice_only", "high_contrast", "large_text", "screen_reader", "simplified"],
    hasVoiceGuidance: true,
  };

  tutorials.set(messagingTutorial.id, messagingTutorial);
}

initializeTutorials();

export function getTutorial(tutorialId: string, language: SupportedLanguage = "en"): InteractiveTutorial | undefined {
  return tutorials.get(tutorialId);
}

export function getAllTutorials(): InteractiveTutorial[] {
  return Array.from(tutorials.values());
}

export function getOnboardingAnalytics(): OnboardingAnalytics {
  const workflows = Array.from(onboardingWorkflows.values());
  const completed = workflows.filter(w => w.status === "completed");
  
  const languageCounts: Partial<Record<SupportedLanguage, number>> = {};
  const populationCounts: Partial<Record<PatientPopulationType, number>> = {};
  const accessibilityCounts: Partial<Record<AccessibilityPreference, number>> = {};
  
  const profiles = Array.from(patientProfiles.values());
  for (const profile of profiles) {
    const lang = profile.languagePreference.primaryLanguage;
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    populationCounts[profile.populationType] = (populationCounts[profile.populationType] || 0) + 1;
    accessibilityCounts[profile.accessibilitySettings.preferredMode] = 
      (accessibilityCounts[profile.accessibilitySettings.preferredMode] || 0) + 1;
  }

  return {
    totalOnboardings: workflows.length,
    completionRate: workflows.length > 0 ? completed.length / workflows.length : 0,
    averageCompletionTime: 0,
    stepDropoffRates: {},
    popularLanguages: languageCounts as Record<SupportedLanguage, number>,
    populationDistribution: populationCounts as Record<PatientPopulationType, number>,
    accessibilityUsage: accessibilityCounts as Record<AccessibilityPreference, number>,
  };
}

console.log("[UnifiedAIOnboarding] Service initialized with multi-language support, accessibility features, and AI-powered personalization");
