import { chatComplete } from "./ai-client";
import { storage } from "./storage";

const AI_MODEL = "deep";

export interface AdaptiveQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multi_choice" | "scale" | "yes_no" | "text";
  category: "demographics" | "conditions" | "lifestyle" | "symptoms" | "medications" | "family_history" | "preferences";
  options?: { id: string; label: string; followUpQuestionIds?: string[] }[];
  scaleRange?: { min: number; max: number; minLabel: string; maxLabel: string };
  required: boolean;
  helpText?: string;
  triggerCondition?: { questionId: string; answerIncludes: string[] };
}

export interface QuestionnaireState {
  answeredQuestions: { questionId: string; answer: string | string[] | number }[];
  currentPhase: number;
  totalPhases: number;
  completionPercent: number;
}

export interface HealthSummary {
  overallAssessment: string;
  identifiedConditions: string[];
  riskFactors: { factor: string; level: "low" | "moderate" | "high"; explanation: string }[];
  recommendedScreenings: string[];
  lifestyleNotes: string[];
  disclaimer: string;
}

export interface WelcomeEducation {
  welcomeMessage: string;
  educationalCards: {
    id: string;
    title: string;
    content: string;
    icon: string;
    category: "condition" | "prevention" | "lifestyle" | "app_feature";
    priority: number;
  }[];
  quickTips: string[];
  suggestedActions: { action: string; screen: string; icon: string }[];
  disclaimer: string;
}

const BASE_QUESTIONS: AdaptiveQuestion[] = [
  {
    id: "age_range",
    text: "Which age range do you fall into?",
    type: "single_choice",
    category: "demographics",
    options: [
      { id: "18-29", label: "18-29" },
      { id: "30-39", label: "30-39" },
      { id: "40-49", label: "40-49" },
      { id: "50-64", label: "50-64" },
      { id: "65+", label: "65+" },
    ],
    required: true,
  },
  {
    id: "biological_sex",
    text: "What is your biological sex?",
    type: "single_choice",
    category: "demographics",
    options: [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
      { id: "prefer_not", label: "Prefer not to say" },
    ],
    required: true,
    helpText: "Used for age-appropriate screening recommendations",
  },
  {
    id: "primary_concerns",
    text: "What are your main health concerns right now?",
    type: "multi_choice",
    category: "conditions",
    options: [
      { id: "chronic_condition", label: "Managing a chronic condition", followUpQuestionIds: ["chronic_type"] },
      { id: "preventive", label: "Staying healthy / preventive care" },
      { id: "new_symptoms", label: "New symptoms I want to track", followUpQuestionIds: ["symptom_details"] },
      { id: "medications", label: "Managing multiple medications", followUpQuestionIds: ["med_count"] },
      { id: "mental_health", label: "Mental health & wellbeing", followUpQuestionIds: ["mental_health_type"] },
      { id: "weight", label: "Weight management" },
      { id: "fitness", label: "Fitness and activity tracking" },
      { id: "family_history", label: "Family health history concerns", followUpQuestionIds: ["family_conditions"] },
      { id: "none", label: "Just exploring the app" },
    ],
    required: true,
  },
  {
    id: "chronic_type",
    text: "Which chronic conditions are you managing?",
    type: "multi_choice",
    category: "conditions",
    options: [
      { id: "diabetes_t1", label: "Type 1 Diabetes", followUpQuestionIds: ["diabetes_management"] },
      { id: "diabetes_t2", label: "Type 2 Diabetes", followUpQuestionIds: ["diabetes_management"] },
      { id: "hypertension", label: "High Blood Pressure", followUpQuestionIds: ["bp_monitoring"] },
      { id: "heart_disease", label: "Heart Disease", followUpQuestionIds: ["cardiac_details"] },
      { id: "asthma", label: "Asthma" },
      { id: "copd", label: "COPD" },
      { id: "arthritis", label: "Arthritis" },
      { id: "thyroid", label: "Thyroid Disorder" },
      { id: "kidney_disease", label: "Kidney Disease" },
      { id: "autoimmune", label: "Autoimmune Disorder" },
      { id: "cancer_history", label: "Cancer (current or history)" },
      { id: "other", label: "Other" },
    ],
    required: true,
    triggerCondition: { questionId: "primary_concerns", answerIncludes: ["chronic_condition"] },
  },
  {
    id: "diabetes_management",
    text: "How do you currently manage your diabetes?",
    type: "multi_choice",
    category: "medications",
    options: [
      { id: "insulin_pump", label: "Insulin pump" },
      { id: "insulin_injections", label: "Insulin injections" },
      { id: "oral_meds", label: "Oral medications" },
      { id: "cgm", label: "Continuous glucose monitor (CGM)" },
      { id: "diet_exercise", label: "Diet and exercise only" },
    ],
    required: true,
    triggerCondition: { questionId: "chronic_type", answerIncludes: ["diabetes_t1", "diabetes_t2"] },
  },
  {
    id: "bp_monitoring",
    text: "Do you monitor your blood pressure at home?",
    type: "yes_no",
    category: "conditions",
    required: true,
    triggerCondition: { questionId: "chronic_type", answerIncludes: ["hypertension"] },
  },
  {
    id: "cardiac_details",
    text: "Which heart-related condition do you have?",
    type: "multi_choice",
    category: "conditions",
    options: [
      { id: "afib", label: "Atrial Fibrillation (AFib)" },
      { id: "cad", label: "Coronary Artery Disease" },
      { id: "heart_failure", label: "Heart Failure" },
      { id: "valve_disease", label: "Valve Disease" },
      { id: "arrhythmia", label: "Other Arrhythmia" },
      { id: "other_cardiac", label: "Other" },
    ],
    required: true,
    triggerCondition: { questionId: "chronic_type", answerIncludes: ["heart_disease"] },
  },
  {
    id: "symptom_details",
    text: "What symptoms are you experiencing?",
    type: "text",
    category: "symptoms",
    required: true,
    helpText: "Describe briefly - this helps personalize your experience",
    triggerCondition: { questionId: "primary_concerns", answerIncludes: ["new_symptoms"] },
  },
  {
    id: "med_count",
    text: "How many medications do you take daily?",
    type: "single_choice",
    category: "medications",
    options: [
      { id: "1-2", label: "1-2" },
      { id: "3-5", label: "3-5" },
      { id: "6-10", label: "6-10" },
      { id: "10+", label: "More than 10" },
    ],
    required: true,
    triggerCondition: { questionId: "primary_concerns", answerIncludes: ["medications"] },
  },
  {
    id: "mental_health_type",
    text: "Which areas of mental health are you focused on?",
    type: "multi_choice",
    category: "conditions",
    options: [
      { id: "anxiety", label: "Anxiety" },
      { id: "depression", label: "Depression" },
      { id: "stress", label: "Stress management" },
      { id: "sleep", label: "Sleep issues" },
      { id: "ptsd", label: "PTSD" },
      { id: "other_mental", label: "Other" },
    ],
    required: true,
    triggerCondition: { questionId: "primary_concerns", answerIncludes: ["mental_health"] },
  },
  {
    id: "family_conditions",
    text: "Which conditions run in your family?",
    type: "multi_choice",
    category: "family_history",
    options: [
      { id: "fam_diabetes", label: "Diabetes" },
      { id: "fam_heart", label: "Heart Disease" },
      { id: "fam_cancer", label: "Cancer" },
      { id: "fam_stroke", label: "Stroke" },
      { id: "fam_hypertension", label: "High Blood Pressure" },
      { id: "fam_alzheimers", label: "Alzheimer's / Dementia" },
      { id: "fam_autoimmune", label: "Autoimmune Disorders" },
      { id: "fam_other", label: "Other" },
    ],
    required: true,
    triggerCondition: { questionId: "primary_concerns", answerIncludes: ["family_history"] },
  },
  {
    id: "exercise_frequency",
    text: "How often do you exercise?",
    type: "single_choice",
    category: "lifestyle",
    options: [
      { id: "rarely", label: "Rarely or never" },
      { id: "1-2_week", label: "1-2 times per week" },
      { id: "3-4_week", label: "3-4 times per week" },
      { id: "5+_week", label: "5 or more times per week" },
    ],
    required: true,
  },
  {
    id: "sleep_quality",
    text: "How would you rate your typical sleep quality?",
    type: "scale",
    category: "lifestyle",
    scaleRange: { min: 1, max: 5, minLabel: "Very poor", maxLabel: "Excellent" },
    required: true,
  },
  {
    id: "stress_level",
    text: "What is your typical daily stress level?",
    type: "scale",
    category: "lifestyle",
    scaleRange: { min: 1, max: 5, minLabel: "Very low", maxLabel: "Very high" },
    required: true,
  },
  {
    id: "smoking_status",
    text: "What is your smoking status?",
    type: "single_choice",
    category: "lifestyle",
    options: [
      { id: "never", label: "Never smoked" },
      { id: "former", label: "Former smoker" },
      { id: "current", label: "Current smoker" },
      { id: "vaping", label: "Currently vaping" },
    ],
    required: true,
  },
  {
    id: "health_tracking_experience",
    text: "Have you used a health tracking app before?",
    type: "single_choice",
    category: "preferences",
    options: [
      { id: "first_time", label: "This is my first time" },
      { id: "some_experience", label: "I've tried a few" },
      { id: "experienced", label: "I use health apps regularly" },
    ],
    required: true,
  },
  {
    id: "notification_preferences",
    text: "How would you like to receive health reminders?",
    type: "multi_choice",
    category: "preferences",
    options: [
      { id: "medication_reminders", label: "Medication reminders" },
      { id: "appointment_reminders", label: "Appointment reminders" },
      { id: "daily_check_in", label: "Daily health check-in" },
      { id: "weekly_summary", label: "Weekly health summary" },
      { id: "safety_alerts", label: "Safety alerts only" },
      { id: "minimal", label: "Minimal notifications" },
    ],
    required: true,
  },
];

export function getAdaptiveQuestions(state: QuestionnaireState): {
  questions: AdaptiveQuestion[];
  phase: number;
  totalPhases: number;
  progress: number;
} {
  const answeredIds = new Set(state.answeredQuestions.map(a => a.questionId));
  const answersMap = new Map(state.answeredQuestions.map(a => [a.questionId, a.answer]));

  const applicableQuestions = BASE_QUESTIONS.filter(q => {
    if (answeredIds.has(q.id)) return false;

    if (q.triggerCondition) {
      const parentAnswer = answersMap.get(q.triggerCondition.questionId);
      if (!parentAnswer) return false;

      const answerArray = Array.isArray(parentAnswer) ? parentAnswer : [parentAnswer];
      const shouldShow = q.triggerCondition.answerIncludes.some(trigger =>
        answerArray.includes(trigger)
      );
      if (!shouldShow) return false;
    }

    return true;
  });

  const totalApplicable = BASE_QUESTIONS.filter(q => {
    if (q.triggerCondition) {
      const parentAnswer = answersMap.get(q.triggerCondition.questionId);
      if (!parentAnswer) return false;
      const answerArray = Array.isArray(parentAnswer) ? parentAnswer : [parentAnswer];
      return q.triggerCondition.answerIncludes.some(trigger => answerArray.includes(trigger));
    }
    return true;
  }).length;

  const answeredCount = state.answeredQuestions.length;
  const progress = totalApplicable > 0 ? Math.min(100, Math.round((answeredCount / totalApplicable) * 100)) : 0;

  const phaseSize = 3;
  const phase = Math.floor(answeredCount / phaseSize) + 1;
  const totalPhases = Math.ceil(totalApplicable / phaseSize);

  const nextBatch = applicableQuestions.slice(0, phaseSize);

  return {
    questions: nextBatch,
    phase,
    totalPhases: Math.max(totalPhases, phase),
    progress,
  };
}

export async function generateInitialHealthSummary(
  answers: { questionId: string; answer: string | string[] | number }[]
): Promise<HealthSummary> {
  const answersMap = new Map(answers.map(a => [a.questionId, a.answer]));

  const ageRange = answersMap.get("age_range") as string || "unknown";
  const sex = answersMap.get("biological_sex") as string || "unknown";
  const concerns = (answersMap.get("primary_concerns") as string[]) || [];
  const chronicTypes = (answersMap.get("chronic_type") as string[]) || [];
  const familyConditions = (answersMap.get("family_conditions") as string[]) || [];
  const exercise = answersMap.get("exercise_frequency") as string || "unknown";
  const sleepQuality = answersMap.get("sleep_quality") as number || 0;
  const stressLevel = answersMap.get("stress_level") as number || 0;
  const smoking = answersMap.get("smoking_status") as string || "unknown";
  const symptoms = answersMap.get("symptom_details") as string || "";
  const mentalHealth = (answersMap.get("mental_health_type") as string[]) || [];

  {
    try {
      const completion = await chatComplete({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a health onboarding assistant generating an initial health overview for a new patient app user. 
Provide a supportive, empowering summary based on their questionnaire answers.
IMPORTANT: You are NOT providing medical advice or diagnoses. This is informational guidance for app personalization.
Always include a disclaimer that this is AI-generated and not medical advice.
Respond in valid JSON format only.`,
          },
          {
            role: "user",
            content: `Generate an initial health summary for this patient profile:

Age range: ${ageRange}
Biological sex: ${sex}
Primary concerns: ${concerns.join(", ")}
Chronic conditions: ${chronicTypes.join(", ") || "None reported"}
Family history: ${familyConditions.join(", ") || "None reported"}
Exercise frequency: ${exercise}
Sleep quality: ${sleepQuality}/5
Stress level: ${stressLevel}/5
Smoking status: ${smoking}
Current symptoms: ${symptoms || "None reported"}
Mental health focus: ${mentalHealth.join(", ") || "None specified"}

Provide JSON:
{
  "overallAssessment": "A brief, encouraging 2-3 sentence overall health assessment",
  "identifiedConditions": ["list of conditions/concerns mentioned"],
  "riskFactors": [{"factor": "name", "level": "low|moderate|high", "explanation": "brief explanation"}],
  "recommendedScreenings": ["age and risk-appropriate screening recommendations"],
  "lifestyleNotes": ["positive lifestyle observations and gentle suggestions"]
}`,
          },
        ],
        temperature: 0.5,
        maxOutputTokens: 800,
        dataCategories: ["demographics", "conditions", "behavioral"],
        purpose: "patient_education",
        callerService: "ai-dynamic-onboarding-service",
        callerMethod: "generateHealthSummary",
      });

      const text = completion.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          overallAssessment: parsed.overallAssessment || "",
          identifiedConditions: parsed.identifiedConditions || [],
          riskFactors: (parsed.riskFactors || []).map((rf: any) => ({
            factor: rf.factor || "",
            level: rf.level || "low",
            explanation: rf.explanation || "",
          })),
          recommendedScreenings: parsed.recommendedScreenings || [],
          lifestyleNotes: parsed.lifestyleNotes || [],
          disclaimer: "This summary is AI-generated for informational purposes only. It is not a medical diagnosis or professional medical advice. Please consult your healthcare provider for personalized medical guidance.",
        };
      }
    } catch (error) {
      console.error("[DynamicOnboarding] AI summary generation error:", error);
    }
  }

  return buildFallbackHealthSummary(answersMap);
}

function buildFallbackHealthSummary(
  answersMap: Map<string, string | string[] | number>
): HealthSummary {
  const concerns = (answersMap.get("primary_concerns") as string[]) || [];
  const chronicTypes = (answersMap.get("chronic_type") as string[]) || [];
  const familyConditions = (answersMap.get("family_conditions") as string[]) || [];
  const exercise = answersMap.get("exercise_frequency") as string || "";
  const smoking = answersMap.get("smoking_status") as string || "";
  const ageRange = answersMap.get("age_range") as string || "";

  const identifiedConditions: string[] = [];
  const riskFactors: HealthSummary["riskFactors"] = [];
  const recommendedScreenings: string[] = [];
  const lifestyleNotes: string[] = [];

  const conditionLabels: Record<string, string> = {
    diabetes_t1: "Type 1 Diabetes", diabetes_t2: "Type 2 Diabetes",
    hypertension: "High Blood Pressure", heart_disease: "Heart Disease",
    asthma: "Asthma", copd: "COPD", arthritis: "Arthritis",
    thyroid: "Thyroid Disorder", kidney_disease: "Kidney Disease",
    autoimmune: "Autoimmune Disorder", cancer_history: "Cancer history",
  };

  for (const ct of chronicTypes) {
    if (conditionLabels[ct]) identifiedConditions.push(conditionLabels[ct]);
  }

  if (concerns.includes("mental_health")) {
    identifiedConditions.push("Mental health focus");
  }

  if (smoking === "current" || smoking === "vaping") {
    riskFactors.push({ factor: "Tobacco/nicotine use", level: "high", explanation: "Smoking and vaping increase risk for heart and lung disease" });
  } else if (smoking === "former") {
    riskFactors.push({ factor: "Former smoker", level: "moderate", explanation: "Your risk decreases over time since quitting" });
  }

  if (exercise === "rarely") {
    riskFactors.push({ factor: "Low physical activity", level: "moderate", explanation: "Regular exercise supports heart health and well-being" });
  }

  if (familyConditions.includes("fam_heart") || familyConditions.includes("fam_diabetes")) {
    riskFactors.push({ factor: "Family health history", level: "moderate", explanation: "Family history can inform screening recommendations" });
  }

  if (ageRange === "40-49" || ageRange === "50-64" || ageRange === "65+") {
    recommendedScreenings.push("Annual wellness visit");
    recommendedScreenings.push("Blood pressure screening");
    recommendedScreenings.push("Cholesterol screening");
  }
  if (ageRange === "50-64" || ageRange === "65+") {
    recommendedScreenings.push("Colorectal cancer screening");
  }
  if (ageRange === "65+") {
    recommendedScreenings.push("Bone density screening");
  }

  if (exercise === "3-4_week" || exercise === "5+_week") {
    lifestyleNotes.push("Great job maintaining an active exercise routine");
  } else {
    lifestyleNotes.push("Consider gradually increasing physical activity for better health outcomes");
  }

  const overallAssessment = identifiedConditions.length > 0
    ? `Based on your responses, you're managing ${identifiedConditions.length} health concern${identifiedConditions.length > 1 ? "s" : ""}. Tabula Medica will help you track and manage your health effectively.`
    : "Based on your responses, you're taking proactive steps toward maintaining your health. Tabula Medica will help you stay on top of preventive care and wellness.";

  return {
    overallAssessment,
    identifiedConditions,
    riskFactors,
    recommendedScreenings,
    lifestyleNotes,
    disclaimer: "This summary is AI-generated for informational purposes only. It is not a medical diagnosis or professional medical advice. Please consult your healthcare provider for personalized medical guidance.",
  };
}

export async function generateWelcomeEducation(
  answers: { questionId: string; answer: string | string[] | number }[],
  healthSummary: HealthSummary
): Promise<WelcomeEducation> {
  const answersMap = new Map(answers.map(a => [a.questionId, a.answer]));
  const concerns = (answersMap.get("primary_concerns") as string[]) || [];
  const chronicTypes = (answersMap.get("chronic_type") as string[]) || [];
  const mentalHealth = (answersMap.get("mental_health_type") as string[]) || [];
  const experience = answersMap.get("health_tracking_experience") as string || "first_time";

  {
    try {
      const completion = await chatComplete({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a warm, supportive health education assistant creating personalized welcome content for a new health app user.
Create educational content that is:
- Relevant to their specific health conditions and concerns
- Written in clear, accessible language (8th grade reading level)
- Empowering and non-judgmental
- Focused on practical, actionable information
IMPORTANT: Do NOT provide medical advice. Include educational information only.
Respond in valid JSON format only.`,
          },
          {
            role: "user",
            content: `Create personalized welcome educational content for a new user with:

Health conditions: ${healthSummary.identifiedConditions.join(", ") || "None reported"}
Primary concerns: ${concerns.join(", ")}
Risk factors: ${healthSummary.riskFactors.map(r => r.factor).join(", ") || "None identified"}
App experience level: ${experience}
Mental health focus: ${mentalHealth.join(", ") || "None"}

Provide JSON:
{
  "welcomeMessage": "A warm, personalized 2-3 sentence welcome message",
  "educationalCards": [
    {
      "id": "unique_id",
      "title": "Short card title",
      "content": "2-3 sentence educational content relevant to their profile",
      "icon": "feather-icon-name",
      "category": "condition|prevention|lifestyle|app_feature",
      "priority": 1
    }
  ],
  "quickTips": ["3-4 quick practical tips for their situation"],
  "suggestedActions": [
    {"action": "brief action description", "screen": "screen_name", "icon": "feather-icon-name"}
  ]
}

Generate 4-6 educational cards and 3-4 suggested actions. Use valid Feather icon names (heart, activity, shield, book-open, clipboard, trending-up, alert-circle, sun, moon, smile, etc).`,
          },
        ],
        temperature: 0.7,
        maxOutputTokens: 1000,
        dataCategories: ["conditions", "behavioral"],
        purpose: "patient_education",
        callerService: "ai-dynamic-onboarding-service",
        callerMethod: "generateEducationalContent",
      });

      const text = completion.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          welcomeMessage: parsed.welcomeMessage || "Welcome to Tabula Medica!",
          educationalCards: (parsed.educationalCards || []).map((card: any, i: number) => ({
            id: card.id || `card_${i}`,
            title: card.title || "",
            content: card.content || "",
            icon: card.icon || "book-open",
            category: card.category || "app_feature",
            priority: card.priority || i + 1,
          })),
          quickTips: parsed.quickTips || [],
          suggestedActions: (parsed.suggestedActions || []).map((a: any) => ({
            action: a.action || "",
            screen: a.screen || "Timeline",
            icon: a.icon || "arrow-right",
          })),
          disclaimer: "Educational content is AI-generated for informational purposes only and does not constitute medical advice. Always consult your healthcare provider.",
        };
      }
    } catch (error) {
      console.error("[DynamicOnboarding] AI education generation error:", error);
    }
  }

  return buildFallbackWelcomeEducation(concerns, chronicTypes, mentalHealth, experience);
}

function buildFallbackWelcomeEducation(
  concerns: string[],
  chronicTypes: string[],
  mentalHealth: string[],
  experience: string
): WelcomeEducation {
  const educationalCards: WelcomeEducation["educationalCards"] = [];
  let priority = 1;

  if (chronicTypes.some(c => c.includes("diabetes"))) {
    educationalCards.push({
      id: "diabetes_edu",
      title: "Living Well with Diabetes",
      content: "Tracking blood sugar trends over time helps you and your care team make better decisions. Use Tabula Medica to log readings and spot patterns.",
      icon: "droplet",
      category: "condition",
      priority: priority++,
    });
  }

  if (chronicTypes.includes("hypertension") || chronicTypes.includes("heart_disease")) {
    educationalCards.push({
      id: "heart_edu",
      title: "Heart Health Monitoring",
      content: "Regular blood pressure and heart rate monitoring can help detect changes early. Connect your devices to automatically track these vital signs.",
      icon: "heart",
      category: "condition",
      priority: priority++,
    });
  }

  if (mentalHealth.length > 0 || concerns.includes("mental_health")) {
    educationalCards.push({
      id: "mental_edu",
      title: "Mental Wellness Tracking",
      content: "Your mental health is just as important as your physical health. Track mood, sleep quality, and stress to identify patterns and triggers.",
      icon: "smile",
      category: "condition",
      priority: priority++,
    });
  }

  educationalCards.push({
    id: "preventive_edu",
    title: "Preventive Care Calendar",
    content: "Stay on track with age-appropriate screenings and vaccinations. We'll help you remember when it's time for checkups.",
    icon: "calendar",
    category: "prevention",
    priority: priority++,
  });

  educationalCards.push({
    id: "data_security_edu",
    title: "Your Data Is Secure",
    content: "All your health information is encrypted and HIPAA-compliant. You control who sees your data and can revoke access at any time.",
    icon: "shield",
    category: "app_feature",
    priority: priority++,
  });

  if (concerns.includes("medications")) {
    educationalCards.push({
      id: "medication_edu",
      title: "Smart Medication Management",
      content: "Track all your medications in one place. Get reminders, check for drug interactions, and share your medication list with any provider instantly.",
      icon: "package",
      category: "app_feature",
      priority: priority++,
    });
  }

  educationalCards.push({
    id: "records_edu",
    title: "All Records, One Place",
    content: "Connect your hospital portals, pharmacies, and labs to automatically import your health records. No more paper folders or forgotten results.",
    icon: "folder",
    category: "app_feature",
    priority: priority++,
  });

  const welcomeMessage = experience === "first_time"
    ? "Welcome to Tabula Medica! We've prepared a personalized health hub just for you. Let's walk through what we've set up based on your responses."
    : "Welcome to Tabula Medica! Based on your experience with health apps, we've customized your setup for maximum benefit right away.";

  return {
    welcomeMessage,
    educationalCards: educationalCards.slice(0, 6),
    quickTips: [
      "Connect at least one health data source to get the most out of the app",
      "Set up medication reminders in the first week",
      "Share your health summary with your primary care provider",
      "Check the AI Health Assistant for personalized daily insights",
    ],
    suggestedActions: [
      { action: "Connect health data sources", screen: "Sources", icon: "link" },
      { action: "Set up medication tracking", screen: "Medications", icon: "package" },
      { action: "Chat with AI Health Assistant", screen: "AIAssistant", icon: "message-circle" },
      { action: "Explore your health timeline", screen: "Timeline", icon: "clock" },
    ],
    disclaimer: "Educational content is AI-generated for informational purposes only and does not constitute medical advice. Always consult your healthcare provider.",
  };
}

export async function saveOnboardingResults(
  userId: string,
  answers: { questionId: string; answer: string | string[] | number }[],
  healthSummary: HealthSummary
): Promise<{ success: boolean; profileId?: string }> {
  const answersMap = new Map(answers.map(a => [a.questionId, a.answer]));

  const chronicTypes = (answersMap.get("chronic_type") as string[]) || [];
  const mentalHealth = (answersMap.get("mental_health_type") as string[]) || [];
  const notifications = (answersMap.get("notification_preferences") as string[]) || [];

  const conditionLabels: Record<string, string> = {
    diabetes_t1: "Type 1 Diabetes", diabetes_t2: "Type 2 Diabetes",
    hypertension: "High Blood Pressure", heart_disease: "Heart Disease",
    asthma: "Asthma", copd: "COPD", arthritis: "Arthritis",
    thyroid: "Thyroid Disorder", kidney_disease: "Kidney Disease",
    autoimmune: "Autoimmune Disorder", cancer_history: "Cancer history",
    anxiety: "Anxiety", depression: "Depression", stress: "Stress management",
    sleep: "Sleep issues", ptsd: "PTSD",
  };

  const allConditions = [...chronicTypes, ...mentalHealth];
  const healthConditions = allConditions
    .map(c => conditionLabels[c] || c)
    .filter(Boolean);

  try {
    const profileData: Record<string, any> = {
      preferredActivityLevel: answersMap.get("exercise_frequency") as string || "moderate",
    };
    if (healthConditions.length > 0) {
      profileData.healthConditions = healthConditions;
    }

    const profile = await storage.upsertPatientProfile(userId, profileData as any);

    const intakeRecord = {
      userId,
      type: "intake" as const,
      title: "AI-Guided Health Questionnaire",
      summary: `Dynamic onboarding completed: ${healthConditions.length} conditions identified, ${healthSummary.riskFactors.length} risk factors noted`,
      date: new Date(),
      provider: "AI Onboarding Assistant",
      facility: "Tabula Medica",
      fhirResourceType: "QuestionnaireResponse",
      fhirResourceId: `ai-onboarding-${Date.now()}`,
      isManual: true,
      details: {
        questionnaireAnswers: answers,
        healthSummary,
        notificationPreferences: notifications,
        completedAt: new Date().toISOString(),
      },
      sourceId: null,
      rawFhirJson: null,
      lastSyncedAt: new Date(),
    };

    await storage.createHealthRecord(intakeRecord);

    return { success: true, profileId: profile.id };
  } catch (error) {
    console.error("[DynamicOnboarding] Save results error:", error);
    return { success: false };
  }
}
