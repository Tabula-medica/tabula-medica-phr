import { generatePhiSafeText } from "./ai-gateway";

export interface OnboardingProfile {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  conditions: string[];
  medications: { name: string; dosage?: string }[];
  allergies: string[];
  familyHistory: { condition: string; relation: string }[];
  lifestyle?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseFrequency?: string;
    sleepHours?: number;
    dietType?: string;
    stressLevel?: string;
  };
}

export interface PersonalizedWelcome {
  greeting: string;
  introduction: string;
  keyBenefits: string[];
  recommendedActions: string[];
  healthFocusAreas: string[];
  estimatedTime: string;
  motivationalMessage: string;
  generatedAt: string;
}

export interface FeatureIntroduction {
  featureId: string;
  name: string;
  description: string;
  benefits: string[];
  icon: string;
  relevanceScore: number;
  personalizedTip?: string;
  quickStartAction: string;
  learnMoreUrl: string;
}

export interface InitialHealthAssessment {
  id: string;
  userId: string;
  overallRiskLevel: "low" | "moderate" | "elevated" | "high";
  riskScore: number;
  primaryConcerns: HealthConcern[];
  recommendations: HealthRecommendation[];
  screeningsNeeded: ScreeningRecommendation[];
  lifestyleFactors: LifestyleFactor[];
  disclaimers: string[];
  generatedAt: string;
}

export interface HealthConcern {
  area: string;
  level: "low" | "moderate" | "elevated" | "high";
  factors: string[];
  explanation: string;
}

export interface HealthRecommendation {
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionableSteps: string[];
  relatedFeature?: string;
}

export interface ScreeningRecommendation {
  name: string;
  reason: string;
  frequency: string;
  dueStatus: "due_now" | "upcoming" | "not_due";
}

export interface LifestyleFactor {
  category: string;
  currentStatus: string;
  impact: "positive" | "neutral" | "needs_improvement";
  suggestion?: string;
}

export interface OnboardingWorkflowState {
  sessionId: string;
  userId: string;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  stepData: Record<string, any>;
  startedAt: string;
  updatedAt: string;
  isComplete: boolean;
}

export type OnboardingStepId = 
  | "welcome"
  | "demographics"
  | "health_history"
  | "medications"
  | "allergies"
  | "lifestyle"
  | "family_history"
  | "health_assessment"
  | "feature_tour"
  | "goals_setup"
  | "device_setup"
  | "consent"
  | "complete";

const workflowSessions = new Map<string, OnboardingWorkflowState>();
const healthAssessments = new Map<string, InitialHealthAssessment>();

const CORE_FEATURES: FeatureIntroduction[] = [
  {
    featureId: "health-journeys",
    name: "Health Journeys",
    description: "Track your health progress over time with personalized milestones and achievements.",
    benefits: ["Visualize your health progress", "Set and track personal goals", "Celebrate milestones"],
    icon: "map",
    relevanceScore: 0,
    quickStartAction: "Create your first health journey",
    learnMoreUrl: "/health-journeys",
  },
  {
    featureId: "risk-assessments",
    name: "Risk Assessments",
    description: "AI-powered health risk analysis based on your medical history and lifestyle factors.",
    benefits: ["Identify potential health risks early", "Get personalized prevention strategies", "Track risk factors over time"],
    icon: "shield",
    relevanceScore: 0,
    quickStartAction: "View your risk assessment",
    learnMoreUrl: "/risk-stratification",
  },
  {
    featureId: "care-plans",
    name: "Care Plans",
    description: "Personalized care plans created by AI and reviewed by healthcare professionals.",
    benefits: ["Step-by-step health guidance", "Track treatment progress", "Coordinate with care team"],
    icon: "clipboard",
    relevanceScore: 0,
    quickStartAction: "Explore care plan options",
    learnMoreUrl: "/ai-personalized-care-plans",
  },
  {
    featureId: "medication-management",
    name: "Medication Management",
    description: "Keep track of your medications, dosages, and refill schedules.",
    benefits: ["Never miss a dose", "Drug interaction alerts", "Easy refill reminders"],
    icon: "pill",
    relevanceScore: 0,
    quickStartAction: "Set up medication reminders",
    learnMoreUrl: "/ai-medication",
  },
  {
    featureId: "health-records",
    name: "Unified Health Records",
    description: "All your health records from different providers in one secure location.",
    benefits: ["Access records anytime", "Share with new providers easily", "Complete health history"],
    icon: "folder",
    relevanceScore: 0,
    quickStartAction: "Connect your health records",
    learnMoreUrl: "/connections",
  },
  {
    featureId: "wellness-tracking",
    name: "Wellness Tracking",
    description: "Monitor sleep, nutrition, exercise, and mental wellness.",
    benefits: ["Holistic health view", "Identify patterns", "Improve daily habits"],
    icon: "heart",
    relevanceScore: 0,
    quickStartAction: "Start tracking your wellness",
    learnMoreUrl: "/personal-health",
  },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function generatePersonalizedWelcome(profile: OnboardingProfile): Promise<PersonalizedWelcome> {
  const firstName = profile.firstName || "there";
  
  try {
    const content = await generatePhiSafeText({
      system: `You are a warm, supportive healthcare assistant helping patients begin their health management journey. Generate a personalized welcome message that:
- Uses warm, encouraging language
- Acknowledges any health conditions they may have without making assumptions
- Highlights relevant benefits of the platform
- Provides clear next steps
- Includes a motivational message

Return JSON with these fields:
- greeting: A warm personalized greeting using their first name
- introduction: 2-3 sentences about how the platform will help them
- keyBenefits: Array of 4 key benefits relevant to their profile
- recommendedActions: Array of 3 immediate next steps
- healthFocusAreas: Array of 2-3 health areas to focus on based on their profile
- estimatedTime: How long the setup will take
- motivationalMessage: An encouraging message about their health journey

Use only safe language without medical advice. Focus on empowerment and support.`,
      user: JSON.stringify({
        firstName,
        conditions: profile.conditions,
        medicationCount: profile.medications.length,
        hasAllergies: profile.allergies.length > 0,
      }),
      responseMimeType: "application/json",
      maxTokens: 600,
    });

    const parsed = JSON.parse(content || "{}");

    return {
      greeting: parsed.greeting || `Welcome, ${firstName}!`,
      introduction: parsed.introduction || "We're excited to have you join Tabula Medica, your personalized health companion.",
      keyBenefits: parsed.keyBenefits || [
        "Access all your health records in one secure place",
        "Get personalized health insights and recommendations",
        "Track your wellness journey with easy-to-understand dashboards",
        "Stay connected with your care team",
      ],
      recommendedActions: parsed.recommendedActions || [
        "Complete your health profile",
        "Connect your existing health records",
        "Set up your first health goal",
      ],
      healthFocusAreas: parsed.healthFocusAreas || ["Overall wellness", "Preventive care"],
      estimatedTime: parsed.estimatedTime || "10-15 minutes",
      motivationalMessage: parsed.motivationalMessage || "Taking control of your health starts with a single step. We're here to support you every step of the way.",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AutomatedOnboarding] Error generating welcome:", error);
    return {
      greeting: `Welcome, ${firstName}!`,
      introduction: "We're excited to have you join Tabula Medica. Let's set up your personalized health portal.",
      keyBenefits: [
        "View all your health records in one secure place",
        "Get AI-powered health insights",
        "Track medications and appointments",
        "Connect with your care team",
      ],
      recommendedActions: [
        "Complete your health profile",
        "Add your current medications",
        "Set up your first health goal",
      ],
      healthFocusAreas: ["Overall wellness", "Preventive care"],
      estimatedTime: "10-15 minutes",
      motivationalMessage: "Your health journey starts today. We're here to help you every step of the way.",
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function generateInitialHealthAssessment(profile: OnboardingProfile): Promise<InitialHealthAssessment> {
  const assessmentId = generateId();
  
  try {
    const content = await generatePhiSafeText({
      system: `You are a health risk analysis assistant. Based on the patient profile provided, generate an initial health assessment.

IMPORTANT RULES:
- Use only "shows", "states", "refers to", "means" as verbs
- Never give medical advice or diagnoses
- Use general categories, not specific medical predictions
- Focus on lifestyle factors and general wellness areas
- Always include a disclaimer about consulting healthcare providers

Return JSON with:
- overallRiskLevel: "low" | "moderate" | "elevated" | "high"
- riskScore: 0-100 number
- primaryConcerns: Array of {area, level, factors, explanation}
- recommendations: Array of {category, priority, title, description, actionableSteps, relatedFeature}
- screeningsNeeded: Array of {name, reason, frequency, dueStatus}
- lifestyleFactors: Array of {category, currentStatus, impact, suggestion}
- disclaimers: Array of important disclaimers`,
      user: JSON.stringify({
        age: profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : null,
        gender: profile.gender,
        conditions: profile.conditions,
        medicationCount: profile.medications.length,
        allergyCount: profile.allergies.length,
        familyHistory: profile.familyHistory,
        lifestyle: profile.lifestyle,
      }),
      responseMimeType: "application/json",
      maxTokens: 1200,
    });

    const parsed = JSON.parse(content || "{}");

    const assessment: InitialHealthAssessment = {
      id: assessmentId,
      userId: profile.userId,
      overallRiskLevel: parsed.overallRiskLevel || "low",
      riskScore: parsed.riskScore || 25,
      primaryConcerns: parsed.primaryConcerns || [],
      recommendations: parsed.recommendations || [
        {
          category: "Preventive Care",
          priority: "medium",
          title: "Schedule Regular Check-ups",
          description: "Regular health check-ups help identify potential issues early.",
          actionableSteps: ["Schedule an annual physical", "Keep track of vital signs"],
          relatedFeature: "appointments",
        },
      ],
      screeningsNeeded: parsed.screeningsNeeded || [],
      lifestyleFactors: parsed.lifestyleFactors || [],
      disclaimers: [
        "This assessment is for informational purposes only and does not constitute medical advice.",
        "Always consult with qualified healthcare providers for medical decisions.",
        "This assessment is based on the information you provided and may not reflect your complete health status.",
      ],
      generatedAt: new Date().toISOString(),
    };

    healthAssessments.set(assessmentId, assessment);
    return assessment;
  } catch (error) {
    console.error("[AutomatedOnboarding] Error generating health assessment:", error);
    
    const fallbackAssessment: InitialHealthAssessment = {
      id: assessmentId,
      userId: profile.userId,
      overallRiskLevel: "low",
      riskScore: 30,
      primaryConcerns: [],
      recommendations: [
        {
          category: "General Wellness",
          priority: "medium",
          title: "Complete Your Health Profile",
          description: "A complete health profile helps us provide better personalized insights.",
          actionableSteps: ["Add any medical conditions", "List current medications", "Update family health history"],
          relatedFeature: "health-records",
        },
        {
          category: "Preventive Care",
          priority: "medium",
          title: "Schedule Preventive Screenings",
          description: "Regular screenings help catch health issues early.",
          actionableSteps: ["Review age-appropriate screenings", "Schedule with your primary care provider"],
          relatedFeature: "appointments",
        },
      ],
      screeningsNeeded: [],
      lifestyleFactors: [],
      disclaimers: [
        "This assessment is for informational purposes only and does not constitute medical advice.",
        "Always consult with qualified healthcare providers for medical decisions.",
      ],
      generatedAt: new Date().toISOString(),
    };

    healthAssessments.set(assessmentId, fallbackAssessment);
    return fallbackAssessment;
  }
}

export function getPersonalizedFeatureIntroductions(profile: OnboardingProfile): FeatureIntroduction[] {
  const features = JSON.parse(JSON.stringify(CORE_FEATURES)) as FeatureIntroduction[];
  
  features.forEach(feature => {
    let score = 50;
    
    switch (feature.featureId) {
      case "health-journeys":
        if (profile.conditions.length > 0) score += 20;
        if (profile.lifestyle?.exerciseFrequency) score += 10;
        break;
      case "risk-assessments":
        if (profile.familyHistory.length > 0) score += 25;
        if (profile.conditions.length > 0) score += 15;
        if (profile.lifestyle?.smokingStatus === "current") score += 20;
        break;
      case "care-plans":
        if (profile.conditions.length >= 2) score += 30;
        if (profile.medications.length >= 3) score += 20;
        break;
      case "medication-management":
        score += profile.medications.length * 15;
        if (profile.allergies.length > 0) score += 15;
        break;
      case "health-records":
        score = 80;
        break;
      case "wellness-tracking":
        if (profile.lifestyle) score += 25;
        if (!profile.lifestyle?.exerciseFrequency) score += 15;
        break;
    }
    
    feature.relevanceScore = Math.min(100, score);
    
    if (feature.relevanceScore > 70) {
      switch (feature.featureId) {
        case "medication-management":
          feature.personalizedTip = `With ${profile.medications.length} medication(s), this feature will help you stay on track.`;
          break;
        case "risk-assessments":
          feature.personalizedTip = "Based on your profile, this feature can provide valuable insights.";
          break;
        case "care-plans":
          feature.personalizedTip = "Personalized care plans can help manage multiple health conditions.";
          break;
      }
    }
  });
  
  return features.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function createOnboardingSession(userId: string): OnboardingWorkflowState {
  const sessionId = generateId();
  const session: OnboardingWorkflowState = {
    sessionId,
    userId,
    currentStep: "welcome",
    completedSteps: [],
    stepData: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isComplete: false,
  };
  
  workflowSessions.set(sessionId, session);
  return session;
}

export function getOnboardingSession(sessionId: string): OnboardingWorkflowState | null {
  return workflowSessions.get(sessionId) || null;
}

export function getOnboardingSessionByUser(userId: string): OnboardingWorkflowState | null {
  const sessions = Array.from(workflowSessions.values());
  for (const session of sessions) {
    if (session.userId === userId && !session.isComplete) {
      return session;
    }
  }
  return null;
}

export function updateOnboardingStep(
  sessionId: string, 
  step: OnboardingStepId, 
  data: Record<string, any>
): OnboardingWorkflowState | null {
  const session = workflowSessions.get(sessionId);
  if (!session) return null;
  
  if (!session.completedSteps.includes(step)) {
    session.completedSteps.push(step);
  }
  
  session.stepData[step] = data;
  session.updatedAt = new Date().toISOString();
  
  const stepOrder: OnboardingStepId[] = [
    "welcome", "demographics", "health_history", "medications", "allergies",
    "lifestyle", "family_history", "health_assessment", "feature_tour",
    "goals_setup", "device_setup", "consent", "complete"
  ];
  
  const currentIndex = stepOrder.indexOf(step);
  if (currentIndex < stepOrder.length - 1) {
    session.currentStep = stepOrder[currentIndex + 1];
  } else {
    session.isComplete = true;
    session.currentStep = "complete";
  }
  
  workflowSessions.set(sessionId, session);
  return session;
}

export function completeOnboarding(sessionId: string): OnboardingWorkflowState | null {
  const session = workflowSessions.get(sessionId);
  if (!session) return null;
  
  session.isComplete = true;
  session.currentStep = "complete";
  session.updatedAt = new Date().toISOString();
  
  workflowSessions.set(sessionId, session);
  return session;
}

export function getHealthAssessment(assessmentId: string): InitialHealthAssessment | null {
  return healthAssessments.get(assessmentId) || null;
}

export function getHealthAssessmentByUser(userId: string): InitialHealthAssessment | null {
  const assessments = Array.from(healthAssessments.values());
  for (const assessment of assessments) {
    if (assessment.userId === userId) {
      return assessment;
    }
  }
  return null;
}
