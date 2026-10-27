import { chatComplete } from "./ai-client";

export interface HealthCondition {
  id: string;
  name: string;
  category: "chronic" | "acute" | "preventive" | "mental_health" | "lifestyle";
  severity?: "mild" | "moderate" | "severe";
  diagnosedYear?: number;
}

export interface OnboardingHealthProfile {
  conditions: HealthCondition[];
  medications: string[];
  allergies: string[];
  primaryGoals: string[];
  ageRange: string;
  activityLevel: string;
}

export interface DataSourceRecommendation {
  id: string;
  name: string;
  type: "healthkit" | "google_fit" | "wearable" | "ehr" | "pharmacy" | "lab";
  icon: string;
  description: string;
  priority: "high" | "medium" | "low";
  reason: string;
  platform?: "ios" | "android" | "all";
  setupDifficulty: "easy" | "moderate" | "advanced";
}

export interface FeatureRecommendation {
  id: string;
  name: string;
  icon: string;
  description: string;
  priority: "essential" | "recommended" | "optional";
  reason: string;
  tutorialSteps?: TutorialStep[];
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  actionType?: "navigate" | "demo" | "info";
  actionTarget?: string;
}

export interface AIOnboardingRecommendations {
  personalizedGreeting: string;
  dataSources: DataSourceRecommendation[];
  features: FeatureRecommendation[];
  healthInsights: string[];
  suggestedReminders: string[];
  nextSteps: string[];
}

const COMMON_CONDITIONS: HealthCondition[] = [
  { id: "diabetes_t1", name: "Type 1 Diabetes", category: "chronic" },
  { id: "diabetes_t2", name: "Type 2 Diabetes", category: "chronic" },
  { id: "hypertension", name: "High Blood Pressure", category: "chronic" },
  { id: "heart_disease", name: "Heart Disease", category: "chronic" },
  { id: "asthma", name: "Asthma", category: "chronic" },
  { id: "copd", name: "COPD", category: "chronic" },
  { id: "arthritis", name: "Arthritis", category: "chronic" },
  { id: "thyroid", name: "Thyroid Disorder", category: "chronic" },
  { id: "anxiety", name: "Anxiety", category: "mental_health" },
  { id: "depression", name: "Depression", category: "mental_health" },
  { id: "migraine", name: "Migraines", category: "chronic" },
  { id: "allergies", name: "Seasonal Allergies", category: "chronic" },
  { id: "obesity", name: "Weight Management", category: "lifestyle" },
  { id: "sleep_disorder", name: "Sleep Disorder", category: "lifestyle" },
  { id: "pregnancy", name: "Pregnancy", category: "preventive" },
  { id: "none", name: "No chronic conditions", category: "preventive" },
];

const HEALTH_GOALS = [
  { id: "track_vitals", label: "Track my vital signs", icon: "activity" },
  { id: "manage_meds", label: "Manage medications", icon: "package" },
  { id: "share_records", label: "Share records with doctors", icon: "share-2" },
  { id: "understand_labs", label: "Understand my lab results", icon: "file-text" },
  { id: "preventive_care", label: "Stay on top of preventive care", icon: "shield" },
  { id: "mental_wellness", label: "Monitor mental wellness", icon: "heart" },
  { id: "fitness_tracking", label: "Track fitness and activity", icon: "trending-up" },
  { id: "family_health", label: "Manage family health", icon: "users" },
];

const APP_FEATURES_TUTORIALS: FeatureRecommendation[] = [
  {
    id: "health_records",
    name: "Health Records",
    icon: "folder",
    description: "View all your medical records in one place",
    priority: "essential",
    reason: "Central to managing your health information",
    tutorialSteps: [
      { id: "1", title: "Your Health Timeline", description: "See all your health events organized chronologically", icon: "clock" },
      { id: "2", title: "Categories", description: "Records are organized by type: labs, medications, visits, and more", icon: "grid" },
      { id: "3", title: "Search & Filter", description: "Quickly find any record using search or filters", icon: "search" },
    ],
  },
  {
    id: "ai_assistant",
    name: "AI Health Assistant",
    icon: "message-circle",
    description: "24/7 AI-powered health guidance and support",
    priority: "essential",
    reason: "Get instant answers to health questions",
    tutorialSteps: [
      { id: "1", title: "Ask Anything", description: "Get answers about medications, conditions, and app features", icon: "help-circle" },
      { id: "2", title: "Care Team Escalation", description: "Complex questions are automatically sent to your care team", icon: "users" },
      { id: "3", title: "Personalized Tips", description: "Receive health tips based on your profile", icon: "star" },
    ],
  },
  {
    id: "medication_tracking",
    name: "Medication Tracking",
    icon: "package",
    description: "Track medications and get reminders",
    priority: "recommended",
    reason: "Never miss a dose with smart reminders",
    tutorialSteps: [
      { id: "1", title: "Add Medications", description: "Enter your medications with dosage and schedule", icon: "plus-circle" },
      { id: "2", title: "Set Reminders", description: "Get notifications when it's time to take your meds", icon: "bell" },
      { id: "3", title: "Track Adherence", description: "See your medication adherence score over time", icon: "check-circle" },
    ],
  },
  {
    id: "vital_trends",
    name: "Vital Trends",
    icon: "activity",
    description: "Track and visualize your vital signs over time",
    priority: "recommended",
    reason: "Monitor blood pressure, weight, glucose, and more",
    tutorialSteps: [
      { id: "1", title: "Log Vitals", description: "Manually enter or sync vitals from connected devices", icon: "edit-3" },
      { id: "2", title: "View Trends", description: "See how your vitals change over weeks and months", icon: "trending-up" },
      { id: "3", title: "Get Alerts", description: "Receive alerts when vitals are outside normal range", icon: "alert-circle" },
    ],
  },
  {
    id: "care_team",
    name: "Care Team",
    icon: "users",
    description: "Connect with your healthcare providers",
    priority: "recommended",
    reason: "Securely message and share records with your doctors",
    tutorialSteps: [
      { id: "1", title: "Add Providers", description: "Invite your doctors to join your care team", icon: "user-plus" },
      { id: "2", title: "Secure Messaging", description: "Send HIPAA-compliant messages to your care team", icon: "message-square" },
      { id: "3", title: "Share Records", description: "Easily share health records with any provider", icon: "share" },
    ],
  },
  {
    id: "health_journey",
    name: "Health Journey",
    icon: "map",
    description: "AI-powered summary of your complete health story",
    priority: "optional",
    reason: "Understand your health patterns and get insights",
    tutorialSteps: [
      { id: "1", title: "Timeline View", description: "See your complete health history on an interactive timeline", icon: "clock" },
      { id: "2", title: "AI Summaries", description: "Get plain-language summaries of complex medical data", icon: "file-text" },
      { id: "3", title: "Episodes of Care", description: "Related health events are grouped into care episodes", icon: "layers" },
    ],
  },
];

export function getCommonConditions(): HealthCondition[] {
  return COMMON_CONDITIONS;
}

export function getHealthGoals() {
  return HEALTH_GOALS;
}

export function getAppFeaturesTutorials(): FeatureRecommendation[] {
  return APP_FEATURES_TUTORIALS;
}

function getDataSourceRecommendations(profile: OnboardingHealthProfile, platform: string): DataSourceRecommendation[] {
  const recommendations: DataSourceRecommendation[] = [];
  const hasChronicCondition = profile.conditions.some(c => c.category === "chronic");
  const hasDiabetes = profile.conditions.some(c => c.id.includes("diabetes"));
  const hasHeartCondition = profile.conditions.some(c => ["hypertension", "heart_disease"].includes(c.id));
  const hasMentalHealth = profile.conditions.some(c => c.category === "mental_health");
  const wantsVitals = profile.primaryGoals.includes("track_vitals");
  const wantsFitness = profile.primaryGoals.includes("fitness_tracking");

  if (platform === "ios") {
    recommendations.push({
      id: "apple_health",
      name: "Apple Health",
      type: "healthkit",
      icon: "heart",
      description: "Import steps, heart rate, sleep, and more from your iPhone",
      priority: "high",
      reason: "Automatically sync health data from your Apple devices",
      platform: "ios",
      setupDifficulty: "easy",
    });
  }

  if (platform === "android") {
    recommendations.push({
      id: "google_fit",
      name: "Google Fit",
      type: "google_fit",
      icon: "activity",
      description: "Import activity, sleep, and vitals from Google Fit",
      priority: "high",
      reason: "Sync health data from your Android devices and apps",
      platform: "android",
      setupDifficulty: "easy",
    });
  }

  if (wantsFitness || wantsVitals) {
    recommendations.push({
      id: "fitbit",
      name: "Fitbit",
      type: "wearable",
      icon: "watch",
      description: "Sync activity, sleep, and heart rate from your Fitbit",
      priority: hasChronicCondition ? "high" : "medium",
      reason: wantsVitals ? "Track vitals and activity automatically" : "Keep track of your daily activity",
      platform: "all",
      setupDifficulty: "easy",
    });

    recommendations.push({
      id: "garmin",
      name: "Garmin",
      type: "wearable",
      icon: "watch",
      description: "Import detailed fitness and health metrics from Garmin",
      priority: "medium",
      reason: "Comprehensive fitness and health tracking",
      platform: "all",
      setupDifficulty: "easy",
    });

    recommendations.push({
      id: "oura",
      name: "Oura Ring",
      type: "wearable",
      icon: "circle",
      description: "Track sleep, readiness, and activity with Oura",
      priority: hasMentalHealth ? "high" : "medium",
      reason: hasMentalHealth ? "Sleep tracking is important for mental wellness" : "Advanced sleep and recovery insights",
      platform: "all",
      setupDifficulty: "easy",
    });
  }

  if (hasDiabetes) {
    recommendations.push({
      id: "dexcom",
      name: "Dexcom CGM",
      type: "wearable",
      icon: "droplet",
      description: "Continuous glucose monitoring data",
      priority: "high",
      reason: "Real-time glucose tracking is essential for diabetes management",
      platform: "all",
      setupDifficulty: "moderate",
    });

    recommendations.push({
      id: "freestyle_libre",
      name: "Freestyle Libre",
      type: "wearable",
      icon: "droplet",
      description: "Flash glucose monitoring system",
      priority: "high",
      reason: "Track glucose levels without finger pricks",
      platform: "all",
      setupDifficulty: "moderate",
    });
  }

  if (hasHeartCondition) {
    recommendations.push({
      id: "kardia",
      name: "Kardia Mobile",
      type: "wearable",
      icon: "heart",
      description: "FDA-cleared personal ECG monitoring",
      priority: "high",
      reason: "Monitor heart rhythm and detect AFib at home",
      platform: "all",
      setupDifficulty: "moderate",
    });

    recommendations.push({
      id: "withings",
      name: "Withings BPM",
      type: "wearable",
      icon: "thermometer",
      description: "Smart blood pressure monitor with arrhythmia detection",
      priority: "high",
      reason: "Accurate blood pressure tracking for heart health",
      platform: "all",
      setupDifficulty: "easy",
    });
  }

  recommendations.push({
    id: "pharmacy",
    name: "Pharmacy Records",
    type: "pharmacy",
    icon: "package",
    description: "Import prescription history from major pharmacies",
    priority: profile.medications.length > 0 ? "high" : "medium",
    reason: "Keep your medication list up to date automatically",
    platform: "all",
    setupDifficulty: "moderate",
  });

  recommendations.push({
    id: "lab_results",
    name: "Lab Results",
    type: "lab",
    icon: "file-text",
    description: "Connect to Quest, LabCorp, and other lab providers",
    priority: hasChronicCondition ? "high" : "medium",
    reason: "Automatically import lab results and track trends",
    platform: "all",
    setupDifficulty: "moderate",
  });

  recommendations.push({
    id: "ehr_portal",
    name: "Hospital Patient Portals",
    type: "ehr",
    icon: "database",
    description: "Connect to Epic MyChart, Cerner, and other patient portals",
    priority: "high",
    reason: "Import your complete medical records from healthcare providers",
    platform: "all",
    setupDifficulty: "moderate",
  });

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function getFeatureRecommendations(profile: OnboardingHealthProfile): FeatureRecommendation[] {
  const features = [...APP_FEATURES_TUTORIALS];
  const hasChronicCondition = profile.conditions.some(c => c.category === "chronic");
  const hasMedications = profile.medications.length > 0 || profile.primaryGoals.includes("manage_meds");
  const wantsVitals = profile.primaryGoals.includes("track_vitals");
  const wantsCareTeam = profile.primaryGoals.includes("share_records");
  const wantsLabHelp = profile.primaryGoals.includes("understand_labs");

  return features.map(feature => {
    let updatedPriority = feature.priority;
    let updatedReason = feature.reason;

    if (feature.id === "medication_tracking" && hasMedications) {
      updatedPriority = "essential";
      updatedReason = "Track your medications and never miss a dose";
    }

    if (feature.id === "vital_trends" && (wantsVitals || hasChronicCondition)) {
      updatedPriority = "essential";
      updatedReason = hasChronicCondition 
        ? "Monitor vital signs to manage your health conditions"
        : "Stay on top of your vital signs";
    }

    if (feature.id === "care_team" && wantsCareTeam) {
      updatedPriority = "essential";
      updatedReason = "Easily share your health records with your doctors";
    }

    if (feature.id === "health_journey" && (wantsLabHelp || hasChronicCondition)) {
      updatedPriority = "recommended";
      updatedReason = wantsLabHelp 
        ? "Get AI-powered explanations of your lab results"
        : "Understand your complete health story with AI insights";
    }

    return { ...feature, priority: updatedPriority, reason: updatedReason };
  }).sort((a, b) => {
    const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export async function generateAIOnboardingRecommendations(
  profile: OnboardingHealthProfile,
  platform: string = "all"
): Promise<AIOnboardingRecommendations> {
  const dataSources = getDataSourceRecommendations(profile, platform);
  const features = getFeatureRecommendations(profile);

  let personalizedGreeting = "Welcome to Tabula Medica!";
  let healthInsights: string[] = [];
  let suggestedReminders: string[] = [];
  let nextSteps: string[] = [];

  try {
    const conditionNames = profile.conditions.map(c => c.name).join(", ") || "general wellness";
    const goalNames = profile.primaryGoals.join(", ") || "health tracking";

    const completion = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: `You are a helpful health app onboarding assistant. Generate personalized, encouraging content for a new user. Be warm, supportive, and focus on empowering the user to take control of their health. Keep responses concise and actionable. Do not provide medical advice.`
        },
        {
          role: "user",
          content: `Generate personalized onboarding content for a user with the following profile:
          
Health conditions: ${conditionNames}
Health goals: ${goalNames}
Medications: ${profile.medications.length > 0 ? profile.medications.join(", ") : "None listed"}
Activity level: ${profile.activityLevel || "Not specified"}
Age range: ${profile.ageRange || "Not specified"}

Please provide:
1. A warm, personalized greeting (1-2 sentences)
2. 2-3 health insights or tips relevant to their conditions/goals
3. 2-3 suggested reminders they might want to set up
4. 3-4 recommended next steps to get the most from the app

Format your response as JSON:
{
  "greeting": "...",
  "insights": ["...", "..."],
  "reminders": ["...", "..."],
  "nextSteps": ["...", "...", "..."]
}`
        }
      ],
      temperature: 0.7,
      maxOutputTokens: 500,
      dataCategories: ["demographics", "conditions", "medications"],
      purpose: "patient_education",
      callerService: "ai-onboarding-service",
      callerMethod: "generatePersonalizedOnboarding",
    });

    const responseText = completion.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      personalizedGreeting = parsed.greeting || personalizedGreeting;
      healthInsights = parsed.insights || [];
      suggestedReminders = parsed.reminders || [];
      nextSteps = parsed.nextSteps || [];
    }
  } catch (error) {
    console.error("AI onboarding generation error:", error);
    personalizedGreeting = profile.conditions.length > 0
      ? `Welcome! We're here to help you manage your ${profile.conditions[0].name} and achieve your health goals.`
      : "Welcome to Tabula Medica! Let's set up your personalized health hub.";
    
    healthInsights = [
      "Regular tracking helps you spot patterns and make informed health decisions",
      "Sharing records with your care team improves coordination of your care",
    ];
    
    suggestedReminders = [
      "Daily medication reminders",
      "Weekly health check-in",
    ];
    
    nextSteps = [
      "Connect your health data sources",
      "Add your current medications",
      "Invite your primary care provider to your care team",
    ];
  }

  return {
    personalizedGreeting,
    dataSources,
    features,
    healthInsights,
    suggestedReminders,
    nextSteps,
  };
}

export async function generateHealthProfileSetup(
  conditions: string[],
  goals: string[]
): Promise<{
  recommendedCategories: string[];
  priorityFeatures: string[];
  setupTips: string[];
}> {
  const recommendedCategories: string[] = [];
  const priorityFeatures: string[] = [];
  
  if (conditions.some(c => c.includes("diabetes"))) {
    recommendedCategories.push("glucose_monitoring", "medication_tracking", "nutrition");
    priorityFeatures.push("vital_trends", "medication_tracking", "ai_assistant");
  }
  
  if (conditions.some(c => ["hypertension", "heart_disease"].some(h => c.includes(h)))) {
    recommendedCategories.push("blood_pressure", "cardiac_monitoring", "exercise");
    priorityFeatures.push("vital_trends", "care_team", "health_journey");
  }
  
  if (conditions.some(c => ["anxiety", "depression"].some(m => c.includes(m)))) {
    recommendedCategories.push("mental_health", "sleep_tracking", "mood_tracking");
    priorityFeatures.push("ai_assistant", "health_journey");
  }
  
  if (goals.includes("fitness_tracking")) {
    recommendedCategories.push("activity", "exercise", "nutrition");
    priorityFeatures.push("vital_trends");
  }

  return {
    recommendedCategories: [...new Set(recommendedCategories)],
    priorityFeatures: [...new Set(priorityFeatures)],
    setupTips: [
      "Connect your health data sources for automatic tracking",
      "Set up medication reminders to stay on schedule",
      "Add your care team for better coordination",
    ],
  };
}
