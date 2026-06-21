import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (apiKey && baseURL) {
      openaiClient = new OpenAI({ apiKey, baseURL });
    }
  }
  return openaiClient;
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This is NOT clinical decision support (CDS). All content is for patient engagement, education, and care coordination purposes only. Treatment decisions must be made by qualified healthcare professionals based on their clinical judgment and individual patient assessment.";

function logHipaaAudit(action: string, userId: string, patientId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][PersonalizedCareJourney] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId} | Details: ${details}`);
}

interface PatientProfile {
  patientId: string;
  name: string;
  age: number;
  gender: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  preferences: {
    communicationChannel: "email" | "sms" | "app" | "phone";
    language: string;
    readingLevel: "basic" | "intermediate" | "advanced";
    reminderFrequency: "minimal" | "moderate" | "frequent";
  };
  carePlan?: {
    goals: string[];
    interventions: string[];
    startDate: string;
  };
}

interface JourneyPhase {
  phaseId: string;
  phaseName: string;
  description: string;
  startDate: string;
  expectedEndDate: string;
  status: "not_started" | "in_progress" | "completed" | "on_hold";
  milestones: Array<{
    milestoneId: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedDate?: string;
  }>;
  tasks: Array<{
    taskId: string;
    title: string;
    type: "medication" | "appointment" | "education" | "lifestyle" | "assessment";
    dueDate: string;
    completed: boolean;
    priority: "high" | "medium" | "low";
  }>;
}

interface TreatmentRecommendation {
  recommendationId: string;
  type: "medication" | "therapy" | "lifestyle" | "monitoring" | "specialist";
  title: string;
  description: string;
  rationale: string;
  evidenceLevel: "strong" | "moderate" | "emerging";
  personalizationFactors: string[];
  priority: "high" | "medium" | "low";
  estimatedBenefit: string;
}

interface EducationContent {
  contentId: string;
  title: string;
  type: "article" | "video" | "infographic" | "quiz" | "checklist";
  topic: string;
  condition: string;
  readingLevel: string;
  estimatedDuration: string;
  relevanceScore: number;
  personalizedReason: string;
  keyTakeaways: string[];
  actionItems: string[];
}

interface Reminder {
  reminderId: string;
  type: "appointment" | "medication" | "refill" | "followup" | "assessment" | "goal_check";
  title: string;
  message: string;
  scheduledDate: string;
  channel: string;
  priority: "urgent" | "normal" | "low";
  recurrence?: "once" | "daily" | "weekly" | "monthly";
  adaptiveFactors?: string[];
}

interface PatientProgress {
  patientId: string;
  overallProgress: number;
  adherenceRate: number;
  engagementScore: number;
  lastActivityDate: string;
  completedMilestones: number;
  totalMilestones: number;
  recentAchievements: string[];
  areasNeedingAttention: string[];
  feedbackSummary: {
    positiveIndicators: string[];
    concerns: string[];
    suggestions: string[];
  };
}

interface CareJourney {
  journeyId: string;
  patientId: string;
  patientName: string;
  journeyType: string;
  primaryCondition: string;
  status: "active" | "completed" | "paused" | "cancelled";
  createdAt: string;
  lastUpdatedAt: string;
  phases: JourneyPhase[];
  treatmentRecommendations: TreatmentRecommendation[];
  educationContent: EducationContent[];
  reminders: Reminder[];
  progress: PatientProgress;
  adaptations: Array<{
    adaptationId: string;
    date: string;
    reason: string;
    changes: string[];
    triggeredBy: "progress" | "feedback" | "clinical_update" | "ai_analysis";
  }>;
  disclaimer: string;
}

const samplePatients: PatientProfile[] = [
  {
    patientId: "pat-001",
    name: "Maria Garcia",
    age: 58,
    gender: "Female",
    conditions: ["Type 2 Diabetes", "Hypertension", "Obesity"],
    medications: ["Metformin 500mg", "Lisinopril 10mg"],
    allergies: ["Penicillin"],
    preferences: {
      communicationChannel: "app",
      language: "English",
      readingLevel: "intermediate",
      reminderFrequency: "moderate",
    },
    carePlan: {
      goals: ["Reduce HbA1c to below 7%", "Blood pressure below 130/80", "Lose 15 lbs in 6 months"],
      interventions: ["Diet modification", "Daily walking", "Weekly blood glucose monitoring"],
      startDate: "2026-01-01",
    },
  },
  {
    patientId: "pat-002",
    name: "James Wilson",
    age: 72,
    gender: "Male",
    conditions: ["Coronary Artery Disease", "Heart Failure", "Atrial Fibrillation"],
    medications: ["Warfarin 5mg", "Metoprolol 25mg", "Furosemide 40mg"],
    allergies: [],
    preferences: {
      communicationChannel: "phone",
      language: "English",
      readingLevel: "basic",
      reminderFrequency: "frequent",
    },
    carePlan: {
      goals: ["Maintain INR 2-3", "Daily weight monitoring", "Reduce hospitalizations"],
      interventions: ["Low sodium diet", "Fluid restriction", "Weekly INR check"],
      startDate: "2025-12-15",
    },
  },
  {
    patientId: "pat-003",
    name: "Sarah Chen",
    age: 45,
    gender: "Female",
    conditions: ["Breast Cancer - Stage II", "Anxiety"],
    medications: ["Tamoxifen 20mg", "Ondansetron PRN"],
    allergies: ["Sulfa drugs"],
    preferences: {
      communicationChannel: "email",
      language: "English",
      readingLevel: "advanced",
      reminderFrequency: "minimal",
    },
    carePlan: {
      goals: ["Complete chemotherapy regimen", "Manage side effects", "Mental health support"],
      interventions: ["Weekly oncology visits", "Counseling sessions", "Symptom tracking"],
      startDate: "2025-11-01",
    },
  },
];

export async function createPersonalizedCareJourney(
  userId: string,
  patientId: string,
  journeyType: string
): Promise<CareJourney> {
  logHipaaAudit("CREATE_JOURNEY", userId, patientId, `Creating personalized care journey: ${journeyType}`);

  const patient = samplePatients.find(p => p.patientId === patientId) || samplePatients[0];
  
  const openai = getOpenAI();
  if (!openai) {
    console.log("[PersonalizedCareJourney] OpenAI not configured, using fallback journey");
    return buildFallbackCareJourney(patient, journeyType);
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a healthcare care journey designer. Create a personalized care journey structure based on patient profile and journey type. This is NOT clinical decision support - only care coordination and engagement content.

Return JSON with structure:
{
  "phases": [{ "phaseName": string, "description": string, "durationDays": number, "milestones": [{ "title": string }], "tasks": [{ "title": string, "type": "medication"|"appointment"|"education"|"lifestyle"|"assessment", "priority": "high"|"medium"|"low" }] }],
  "treatmentRecommendations": [{ "type": string, "title": string, "description": string, "rationale": string, "evidenceLevel": "strong"|"moderate"|"emerging", "personalizationFactors": [string], "priority": "high"|"medium"|"low", "estimatedBenefit": string }],
  "educationTopics": [{ "title": string, "topic": string, "type": "article"|"video"|"infographic", "relevanceReason": string, "keyTakeaways": [string] }]
}`
        },
        {
          role: "user",
          content: `Create a personalized "${journeyType}" care journey for:
Patient: ${patient.name}, ${patient.age}yo ${patient.gender}
Conditions: ${patient.conditions.join(", ")}
Medications: ${patient.medications.join(", ")}
Care Goals: ${patient.carePlan?.goals.join(", ") || "General wellness"}
Reading Level: ${patient.preferences.readingLevel}
Reminder Preference: ${patient.preferences.reminderFrequency}`
        }
      ],
      temperature: 0.7,
    });

    const aiResult = JSON.parse(response.choices[0].message.content || "{}");
    
    const journey = buildCareJourney(patient, journeyType, aiResult);
    
    logHipaaAudit("CREATE_JOURNEY_SUCCESS", userId, patientId, `Journey created with ${journey.phases.length} phases`);
    
    return journey;
  } catch (error) {
    console.log("[PersonalizedCareJourney] OpenAI unavailable, using fallback");
    return buildFallbackCareJourney(patient, journeyType);
  }
}

function buildCareJourney(patient: PatientProfile, journeyType: string, aiResult: any): CareJourney {
  const now = new Date();
  const journeyId = `journey-${Date.now()}`;
  
  const phases: JourneyPhase[] = (aiResult.phases || []).map((phase: any, idx: number) => {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + idx * 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (phase.durationDays || 30));
    
    return {
      phaseId: `phase-${idx + 1}`,
      phaseName: phase.phaseName || `Phase ${idx + 1}`,
      description: phase.description || "",
      startDate: startDate.toISOString().split("T")[0],
      expectedEndDate: endDate.toISOString().split("T")[0],
      status: idx === 0 ? "in_progress" : "not_started",
      milestones: (phase.milestones || []).map((m: any, mi: number) => ({
        milestoneId: `milestone-${idx}-${mi}`,
        title: m.title || m,
        targetDate: new Date(startDate.getTime() + (mi + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        completed: false,
      })),
      tasks: (phase.tasks || []).map((t: any, ti: number) => ({
        taskId: `task-${idx}-${ti}`,
        title: t.title || t,
        type: t.type || "lifestyle",
        dueDate: new Date(startDate.getTime() + (ti + 1) * 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        completed: false,
        priority: t.priority || "medium",
      })),
    };
  });

  const treatmentRecommendations: TreatmentRecommendation[] = (aiResult.treatmentRecommendations || []).map((rec: any, idx: number) => ({
    recommendationId: `rec-${idx + 1}`,
    type: rec.type || "lifestyle",
    title: rec.title,
    description: rec.description,
    rationale: rec.rationale,
    evidenceLevel: rec.evidenceLevel || "moderate",
    personalizationFactors: rec.personalizationFactors || [],
    priority: rec.priority || "medium",
    estimatedBenefit: rec.estimatedBenefit || "Potential health improvement",
  }));

  const educationContent: EducationContent[] = (aiResult.educationTopics || []).map((edu: any, idx: number) => ({
    contentId: `edu-${idx + 1}`,
    title: edu.title,
    type: edu.type || "article",
    topic: edu.topic,
    condition: patient.conditions[0] || "General Health",
    readingLevel: patient.preferences.readingLevel,
    estimatedDuration: edu.type === "video" ? "10 mins" : "5 mins",
    relevanceScore: 0.9 - idx * 0.1,
    personalizedReason: edu.relevanceReason || "Based on your health profile",
    keyTakeaways: edu.keyTakeaways || [],
    actionItems: ["Review content", "Apply learnings to daily routine"],
  }));

  const reminders = generatePersonalizedReminders(patient, phases);

  return {
    journeyId,
    patientId: patient.patientId,
    patientName: patient.name,
    journeyType,
    primaryCondition: patient.conditions[0],
    status: "active",
    createdAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    phases,
    treatmentRecommendations,
    educationContent,
    reminders,
    progress: {
      patientId: patient.patientId,
      overallProgress: 0,
      adherenceRate: 100,
      engagementScore: 85,
      lastActivityDate: now.toISOString(),
      completedMilestones: 0,
      totalMilestones: phases.reduce((sum, p) => sum + p.milestones.length, 0),
      recentAchievements: ["Journey started"],
      areasNeedingAttention: [],
      feedbackSummary: {
        positiveIndicators: ["Patient enrolled in personalized care program"],
        concerns: [],
        suggestions: ["Complete initial assessment"],
      },
    },
    adaptations: [],
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function generatePersonalizedReminders(patient: PatientProfile, phases: JourneyPhase[]): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();
  
  patient.medications.forEach((med, idx) => {
    reminders.push({
      reminderId: `rem-med-${idx}`,
      type: "medication",
      title: `Take ${med}`,
      message: `Time to take your ${med}. Consistency helps achieve your health goals.`,
      scheduledDate: new Date(now.getTime() + (idx + 1) * 8 * 60 * 60 * 1000).toISOString(),
      channel: patient.preferences.communicationChannel,
      priority: "normal",
      recurrence: "daily",
      adaptiveFactors: ["Based on your medication schedule", "Adjusted for your reminder preference"],
    });
  });

  reminders.push({
    reminderId: "rem-apt-1",
    type: "appointment",
    title: "Follow-up Appointment",
    message: "Your next check-in with your care team is coming up. Prepare any questions you have.",
    scheduledDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    channel: patient.preferences.communicationChannel,
    priority: "normal",
    recurrence: "once",
  });

  reminders.push({
    reminderId: "rem-goal-1",
    type: "goal_check",
    title: "Weekly Progress Check",
    message: "How are you doing with your health goals this week? Take a moment to reflect.",
    scheduledDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    channel: patient.preferences.communicationChannel,
    priority: "low",
    recurrence: "weekly",
    adaptiveFactors: ["Frequency based on your preferences"],
  });

  return reminders;
}

function buildFallbackCareJourney(patient: PatientProfile, journeyType: string): CareJourney {
  const now = new Date();
  const journeyId = `journey-${Date.now()}`;
  
  const phases: JourneyPhase[] = [
    {
      phaseId: "phase-1",
      phaseName: "Assessment & Planning",
      description: "Initial evaluation and personalized care plan development",
      startDate: now.toISOString().split("T")[0],
      expectedEndDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "in_progress",
      milestones: [
        { milestoneId: "m-1", title: "Complete health assessment", targetDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false },
        { milestoneId: "m-2", title: "Review personalized care plan", targetDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false },
      ],
      tasks: [
        { taskId: "t-1", title: "Schedule initial consultation", type: "appointment", dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "high" },
        { taskId: "t-2", title: "Complete health history form", type: "assessment", dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "high" },
        { taskId: "t-3", title: "Read: Understanding Your Condition", type: "education", dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "medium" },
      ],
    },
    {
      phaseId: "phase-2",
      phaseName: "Active Treatment",
      description: "Implementing care plan with regular monitoring",
      startDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      expectedEndDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "not_started",
      milestones: [
        { milestoneId: "m-3", title: "2-week progress review", targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false },
        { milestoneId: "m-4", title: "First goal achieved", targetDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false },
      ],
      tasks: [
        { taskId: "t-4", title: "Daily medication adherence", type: "medication", dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "high" },
        { taskId: "t-5", title: "Weekly symptom tracking", type: "assessment", dueDate: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "medium" },
      ],
    },
    {
      phaseId: "phase-3",
      phaseName: "Maintenance & Optimization",
      description: "Sustaining improvements and fine-tuning care plan",
      startDate: new Date(now.getTime() + 61 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      expectedEndDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "not_started",
      milestones: [
        { milestoneId: "m-5", title: "Quarterly health review", targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false },
      ],
      tasks: [
        { taskId: "t-6", title: "Lifestyle modifications review", type: "lifestyle", dueDate: new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], completed: false, priority: "medium" },
      ],
    },
  ];

  const treatmentRecommendations: TreatmentRecommendation[] = [
    {
      recommendationId: "rec-1",
      type: "lifestyle",
      title: "Regular Physical Activity",
      description: "Engage in at least 150 minutes of moderate-intensity activity per week",
      rationale: `Based on ${patient.conditions[0] || "your health profile"}, regular exercise can significantly improve outcomes`,
      evidenceLevel: "strong",
      personalizationFactors: patient.conditions,
      priority: "high",
      estimatedBenefit: "Improved cardiovascular health and symptom management",
    },
    {
      recommendationId: "rec-2",
      type: "monitoring",
      title: "Regular Health Monitoring",
      description: "Track key health metrics at home and report to your care team",
      rationale: "Early detection of changes allows for timely intervention",
      evidenceLevel: "strong",
      personalizationFactors: ["Your care plan goals", "Medication monitoring"],
      priority: "high",
      estimatedBenefit: "Better disease management and reduced complications",
    },
  ];

  const educationContent: EducationContent[] = [
    {
      contentId: "edu-1",
      title: `Understanding ${patient.conditions[0] || "Your Condition"}`,
      type: "article",
      topic: "Disease Overview",
      condition: patient.conditions[0] || "General Health",
      readingLevel: patient.preferences.readingLevel,
      estimatedDuration: "5 mins",
      relevanceScore: 0.95,
      personalizedReason: "Tailored to your primary health concern",
      keyTakeaways: ["Understanding causes and symptoms", "Treatment options", "Lifestyle factors"],
      actionItems: ["Review with family members", "Prepare questions for your care team"],
    },
    {
      contentId: "edu-2",
      title: "Medication Management Tips",
      type: "infographic",
      topic: "Medication Adherence",
      condition: patient.conditions[0] || "General Health",
      readingLevel: patient.preferences.readingLevel,
      estimatedDuration: "3 mins",
      relevanceScore: 0.88,
      personalizedReason: `You are currently taking ${patient.medications.length} medications`,
      keyTakeaways: ["Setting up medication reminders", "Safe storage", "What to do if you miss a dose"],
      actionItems: ["Set up daily reminders", "Organize medications"],
    },
  ];

  const reminders = generatePersonalizedReminders(patient, phases);

  return {
    journeyId,
    patientId: patient.patientId,
    patientName: patient.name,
    journeyType,
    primaryCondition: patient.conditions[0],
    status: "active",
    createdAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    phases,
    treatmentRecommendations,
    educationContent,
    reminders,
    progress: {
      patientId: patient.patientId,
      overallProgress: 0,
      adherenceRate: 100,
      engagementScore: 85,
      lastActivityDate: now.toISOString(),
      completedMilestones: 0,
      totalMilestones: phases.reduce((sum, p) => sum + p.milestones.length, 0),
      recentAchievements: ["Journey started"],
      areasNeedingAttention: [],
      feedbackSummary: {
        positiveIndicators: ["Patient enrolled in personalized care program"],
        concerns: [],
        suggestions: ["Complete initial assessment"],
      },
    },
    adaptations: [],
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function getPatientCareJourneys(userId: string, patientId?: string): Promise<{ journeys: CareJourney[]; disclaimer: string }> {
  logHipaaAudit("LIST_JOURNEYS", userId, patientId || "all", "Fetching patient care journeys");
  
  const journeys = samplePatients
    .filter(p => !patientId || p.patientId === patientId)
    .map(patient => buildFallbackCareJourney(patient, "Chronic Care Management"));
  
  return {
    journeys,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function buildFallbackRecommendations(patient: PatientProfile): { recommendations: TreatmentRecommendation[]; personalizationSummary: string; disclaimer: string } {
  const recommendations: TreatmentRecommendation[] = [
    {
      recommendationId: `rec-${Date.now()}-1`,
      type: "lifestyle",
      title: "Regular Physical Activity",
      description: "Engage in at least 150 minutes of moderate-intensity aerobic activity weekly, such as brisk walking, swimming, or cycling.",
      rationale: `Physical activity is beneficial for managing ${patient.conditions[0] || "chronic conditions"} and improving overall health.`,
      evidenceLevel: "strong",
      personalizationFactors: patient.conditions,
      priority: "high",
      estimatedBenefit: "Improved cardiovascular health, better blood sugar control, and enhanced mood",
    },
    {
      recommendationId: `rec-${Date.now()}-2`,
      type: "nutrition",
      title: "Heart-Healthy Diet",
      description: "Focus on whole grains, lean proteins, fruits, vegetables, and limit sodium and saturated fats.",
      rationale: "Dietary modifications can significantly impact chronic disease management.",
      evidenceLevel: "strong",
      personalizationFactors: ["Based on your health profile", ...patient.conditions],
      priority: "high",
      estimatedBenefit: "Better cholesterol levels and blood pressure control",
    },
    {
      recommendationId: `rec-${Date.now()}-3`,
      type: "monitoring",
      title: "Regular Health Monitoring",
      description: `Track key health metrics including ${patient.conditions.includes("Diabetes") ? "blood glucose, " : ""}blood pressure, and weight.`,
      rationale: "Consistent monitoring helps detect changes early and enables timely intervention.",
      evidenceLevel: "strong",
      personalizationFactors: ["Your care plan goals", "Medication monitoring"],
      priority: "medium",
      estimatedBenefit: "Early detection of complications and better disease management",
    },
  ];

  return {
    recommendations,
    personalizationSummary: `These recommendations are tailored for ${patient.name}'s health profile, considering conditions: ${patient.conditions.join(", ")}.`,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function buildFallbackEducationContent(patient: PatientProfile, topic?: string): { content: EducationContent[]; learningPath: string[]; disclaimer: string } {
  const content: EducationContent[] = [
    {
      contentId: `edu-${Date.now()}-1`,
      title: `Understanding ${patient.conditions[0] || "Your Health Condition"}`,
      type: "article",
      topic: topic || "Disease Overview",
      condition: patient.conditions[0] || "General Health",
      readingLevel: patient.preferences.readingLevel,
      estimatedDuration: "8 mins",
      relevanceScore: 0.95,
      personalizedReason: "Tailored to your primary health concern",
      keyTakeaways: [
        "Understanding the causes and risk factors",
        "Recognizing symptoms and warning signs",
        "Available treatment options",
        "Lifestyle modifications that can help",
      ],
      actionItems: ["Discuss this information with your care team", "Share with family members for support"],
    },
    {
      contentId: `edu-${Date.now()}-2`,
      title: "Managing Your Medications Safely",
      type: "video",
      topic: "Medication Management",
      condition: patient.conditions[0] || "General Health",
      readingLevel: patient.preferences.readingLevel,
      estimatedDuration: "6 mins",
      relevanceScore: 0.88,
      personalizedReason: `You are managing ${patient.medications.length} medications`,
      keyTakeaways: [
        "Importance of taking medications as prescribed",
        "How to organize your medications",
        "What to do if you miss a dose",
        "Recognizing side effects",
      ],
      actionItems: ["Set up medication reminders", "Create a medication schedule"],
    },
    {
      contentId: `edu-${Date.now()}-3`,
      title: "Healthy Eating for Better Health",
      type: "infographic",
      topic: "Nutrition",
      condition: patient.conditions[0] || "General Health",
      readingLevel: patient.preferences.readingLevel,
      estimatedDuration: "4 mins",
      relevanceScore: 0.82,
      personalizedReason: "Dietary changes can significantly improve your health outcomes",
      keyTakeaways: [
        "Foods to include in your diet",
        "Foods to limit or avoid",
        "Meal planning tips",
        "Reading nutrition labels",
      ],
      actionItems: ["Try one new healthy recipe this week", "Plan your meals for the week"],
    },
  ];

  const learningPath = [
    "Start with understanding your condition",
    "Learn about medication management",
    "Explore nutrition and lifestyle changes",
    "Review monitoring techniques",
    "Connect with support resources",
  ];

  return {
    content,
    learningPath,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function getAITreatmentRecommendations(
  userId: string,
  patientId: string,
  context?: { recentLabResults?: string; symptoms?: string[]; concerns?: string[] }
): Promise<{ recommendations: TreatmentRecommendation[]; personalizationSummary: string; disclaimer: string }> {
  logHipaaAudit("AI_TREATMENT_RECOMMENDATIONS", userId, patientId, `Context: ${JSON.stringify(context || {})}`);
  
  const patient = samplePatients.find(p => p.patientId === patientId) || samplePatients[0];
  
  const openai = getOpenAI();
  if (!openai) {
    console.log("[PersonalizedCareJourney] OpenAI not configured, using fallback recommendations");
    return buildFallbackRecommendations(patient);
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a healthcare engagement assistant helping patients understand care options. This is NOT clinical decision support - provide educational information about care approaches that the patient can discuss with their healthcare provider.

Return JSON:
{
  "recommendations": [{
    "type": "lifestyle"|"monitoring"|"therapy"|"specialist",
    "title": string,
    "description": string,
    "rationale": string,
    "evidenceLevel": "strong"|"moderate"|"emerging",
    "personalizationFactors": [string],
    "priority": "high"|"medium"|"low",
    "estimatedBenefit": string
  }],
  "personalizationSummary": string (explain how recommendations are tailored to this patient)
}`
        },
        {
          role: "user",
          content: `Generate personalized care recommendations for:
Patient: ${patient.age}yo ${patient.gender}
Conditions: ${patient.conditions.join(", ")}
Current Medications: ${patient.medications.join(", ")}
Care Goals: ${patient.carePlan?.goals.join(", ") || "General wellness"}
${context?.recentLabResults ? `Recent Lab Results: ${context.recentLabResults}` : ""}
${context?.symptoms ? `Current Symptoms: ${context.symptoms.join(", ")}` : ""}
${context?.concerns ? `Patient Concerns: ${context.concerns.join(", ")}` : ""}`
        }
      ],
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const recommendations = (result.recommendations || []).map((rec: any, idx: number) => ({
      recommendationId: `rec-${Date.now()}-${idx}`,
      ...rec,
    }));

    logHipaaAudit("AI_TREATMENT_RECOMMENDATIONS_SUCCESS", userId, patientId, `Generated ${recommendations.length} recommendations`);
    
    return {
      recommendations,
      personalizationSummary: result.personalizationSummary || "Recommendations tailored based on your health profile and care goals.",
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.log("[PersonalizedCareJourney] OpenAI unavailable for recommendations, using fallback");
    return {
      recommendations: [
        {
          recommendationId: "rec-fb-1",
          type: "lifestyle",
          title: "Daily Physical Activity",
          description: "Aim for 30 minutes of moderate activity most days of the week",
          rationale: `Physical activity is beneficial for ${patient.conditions.join(" and ")}`,
          evidenceLevel: "strong",
          personalizationFactors: patient.conditions,
          priority: "high",
          estimatedBenefit: "Improved overall health and symptom management",
        },
        {
          recommendationId: "rec-fb-2",
          type: "monitoring",
          title: "Regular Self-Monitoring",
          description: "Track your symptoms, vital signs, and medication adherence daily",
          rationale: "Consistent monitoring helps identify trends and enables timely interventions",
          evidenceLevel: "strong",
          personalizationFactors: ["Your care plan goals"],
          priority: "high",
          estimatedBenefit: "Better disease control and communication with care team",
        },
      ],
      personalizationSummary: `Recommendations based on your conditions (${patient.conditions.join(", ")}) and current care plan.`,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export async function getPersonalizedEducationContent(
  userId: string,
  patientId: string,
  topic?: string
): Promise<{ content: EducationContent[]; learningPath: string[]; disclaimer: string }> {
  logHipaaAudit("PERSONALIZED_EDUCATION", userId, patientId, `Topic: ${topic || "all"}`);
  
  const patient = samplePatients.find(p => p.patientId === patientId) || samplePatients[0];
  
  const openai = getOpenAI();
  if (!openai) {
    console.log("[PersonalizedCareJourney] OpenAI not configured, using fallback education content");
    return buildFallbackEducationContent(patient, topic);
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a patient education specialist creating personalized health education content. Tailor content to the patient's conditions, reading level, and preferences. This is NOT clinical advice.

Return JSON:
{
  "content": [{
    "title": string,
    "type": "article"|"video"|"infographic"|"quiz"|"checklist",
    "topic": string,
    "estimatedDuration": string,
    "relevanceReason": string,
    "keyTakeaways": [string],
    "actionItems": [string]
  }],
  "learningPath": [string] (ordered sequence of topics to cover)
}`
        },
        {
          role: "user",
          content: `Create personalized education content for:
Patient: ${patient.age}yo ${patient.gender}
Conditions: ${patient.conditions.join(", ")}
Reading Level: ${patient.preferences.readingLevel}
Language: ${patient.preferences.language}
${topic ? `Focus Topic: ${topic}` : "Cover all relevant topics for their conditions"}`
        }
      ],
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const content = (result.content || []).map((c: any, idx: number) => ({
      contentId: `edu-${Date.now()}-${idx}`,
      ...c,
      condition: patient.conditions[0],
      readingLevel: patient.preferences.readingLevel,
      relevanceScore: 0.95 - idx * 0.05,
      personalizedReason: c.relevanceReason,
    }));

    logHipaaAudit("PERSONALIZED_EDUCATION_SUCCESS", userId, patientId, `Generated ${content.length} education items`);
    
    return {
      content,
      learningPath: result.learningPath || ["Understanding your condition", "Treatment options", "Self-care strategies", "When to seek help"],
      disclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.log("[PersonalizedCareJourney] OpenAI unavailable for education, using fallback");
    return {
      content: [
        {
          contentId: "edu-fb-1",
          title: `Living with ${patient.conditions[0]}`,
          type: "article",
          topic: "Disease Overview",
          condition: patient.conditions[0],
          readingLevel: patient.preferences.readingLevel,
          estimatedDuration: "5 mins",
          relevanceScore: 0.95,
          personalizedReason: "Based on your primary health condition",
          keyTakeaways: ["Understanding your condition", "Management strategies", "Signs to watch for"],
          actionItems: ["Read and take notes", "Share with family members"],
        },
        {
          contentId: "edu-fb-2",
          title: "Your Medications Explained",
          type: "infographic",
          topic: "Medication Education",
          condition: patient.conditions[0],
          readingLevel: patient.preferences.readingLevel,
          estimatedDuration: "3 mins",
          relevanceScore: 0.90,
          personalizedReason: `You are taking ${patient.medications.length} medications`,
          keyTakeaways: ["How each medication works", "Proper timing", "Potential interactions"],
          actionItems: ["Review medication schedule", "Set up reminders"],
        },
      ],
      learningPath: ["Understanding your condition", "Managing medications", "Lifestyle modifications", "When to contact your care team"],
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export async function generateAdaptiveReminders(
  userId: string,
  patientId: string,
  progressData?: { adherenceRate?: number; engagementScore?: number; recentFeedback?: string }
): Promise<{ reminders: Reminder[]; adaptationReason: string; disclaimer: string }> {
  logHipaaAudit("GENERATE_REMINDERS", userId, patientId, `Progress data: ${JSON.stringify(progressData || {})}`);
  
  const patient = samplePatients.find(p => p.patientId === patientId) || samplePatients[0];
  const now = new Date();
  
  const frequencyMultiplier = patient.preferences.reminderFrequency === "frequent" ? 1.5 :
                              patient.preferences.reminderFrequency === "minimal" ? 0.5 : 1;
  
  const adherence = progressData?.adherenceRate || 85;
  const needsMoreSupport = adherence < 70;
  
  const reminders: Reminder[] = [];
  
  patient.medications.forEach((med, idx) => {
    reminders.push({
      reminderId: `rem-${Date.now()}-med-${idx}`,
      type: "medication",
      title: `Medication: ${med}`,
      message: needsMoreSupport 
        ? `It's time for ${med}. Staying on track helps you reach your health goals!`
        : `Time for ${med}.`,
      scheduledDate: new Date(now.getTime() + (idx + 1) * 8 * 60 * 60 * 1000).toISOString(),
      channel: patient.preferences.communicationChannel,
      priority: needsMoreSupport ? "urgent" : "normal",
      recurrence: "daily",
      adaptiveFactors: [
        `Based on ${adherence}% adherence rate`,
        `Adjusted for ${patient.preferences.reminderFrequency} reminder preference`,
      ],
    });
  });

  reminders.push({
    reminderId: `rem-${Date.now()}-apt`,
    type: "appointment",
    title: "Upcoming Appointment",
    message: "Don't forget your scheduled appointment. Prepare any questions you'd like to discuss.",
    scheduledDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    channel: patient.preferences.communicationChannel,
    priority: "normal",
    recurrence: "once",
  });

  if (needsMoreSupport) {
    reminders.push({
      reminderId: `rem-${Date.now()}-check`,
      type: "followup",
      title: "How are you doing?",
      message: "We noticed you might need some extra support. Would you like to connect with your care team?",
      scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      channel: patient.preferences.communicationChannel,
      priority: "urgent",
      recurrence: "once",
      adaptiveFactors: ["Added due to lower adherence rate", "Proactive support check-in"],
    });
  }

  const adaptationReason = needsMoreSupport 
    ? `Increased reminder frequency and support due to ${adherence}% adherence rate. Additional check-ins added.`
    : `Standard reminder schedule based on ${patient.preferences.reminderFrequency} preference and ${adherence}% adherence.`;

  logHipaaAudit("GENERATE_REMINDERS_SUCCESS", userId, patientId, `Generated ${reminders.length} adaptive reminders`);
  
  return {
    reminders,
    adaptationReason,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function updateJourneyFromProgress(
  userId: string,
  patientId: string,
  progressUpdate: {
    completedTasks?: string[];
    completedMilestones?: string[];
    feedback?: string;
    symptoms?: string[];
    adherenceData?: { medicationsTaken: number; medicationsTotal: number };
  }
): Promise<{ 
  updatedProgress: PatientProgress; 
  adaptations: Array<{ reason: string; changes: string[] }>;
  nextSteps: string[];
  disclaimer: string;
}> {
  logHipaaAudit("UPDATE_JOURNEY_PROGRESS", userId, patientId, `Progress update: ${JSON.stringify(progressUpdate)}`);
  
  const patient = samplePatients.find(p => p.patientId === patientId) || samplePatients[0];
  
  const adherenceRate = progressUpdate.adherenceData 
    ? (progressUpdate.adherenceData.medicationsTaken / progressUpdate.adherenceData.medicationsTotal) * 100
    : 85;
  
  const completedCount = (progressUpdate.completedTasks?.length || 0) + (progressUpdate.completedMilestones?.length || 0);
  const engagementScore = Math.min(100, 70 + completedCount * 5);
  
  const adaptations: Array<{ reason: string; changes: string[] }> = [];
  const nextSteps: string[] = [];
  
  if (adherenceRate < 70) {
    adaptations.push({
      reason: "Low medication adherence detected",
      changes: ["Increased reminder frequency", "Added supportive check-ins", "Suggested care team follow-up"],
    });
    nextSteps.push("Review medication schedule with care team");
    nextSteps.push("Consider medication reminder app or pill organizer");
  }
  
  if (progressUpdate.symptoms && progressUpdate.symptoms.length > 0) {
    adaptations.push({
      reason: "New symptoms reported",
      changes: ["Added symptom tracking to daily routine", "Scheduled care team notification"],
    });
    nextSteps.push("Monitor symptoms and report changes");
    nextSteps.push("Contact care team if symptoms worsen");
  }
  
  if (progressUpdate.feedback) {
    const openaiClient = getOpenAI();
    if (openaiClient) {
      try {
        const response = await openaiClient.chat.completions.create({
          model: "gpt-5.1",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Analyze patient feedback and suggest care journey adaptations. Return JSON:
{
  "sentiment": "positive"|"neutral"|"negative",
  "suggestedAdaptations": [{ "reason": string, "changes": [string] }],
  "nextSteps": [string],
  "supportNeeded": boolean
}`
            },
            {
            role: "user",
            content: `Patient feedback: "${progressUpdate.feedback}"
Patient conditions: ${patient.conditions.join(", ")}
Current adherence: ${adherenceRate}%`
          }
        ],
        temperature: 0.5,
      });

      const aiResult = JSON.parse(response.choices[0].message.content || "{}");
      
      if (aiResult.suggestedAdaptations) {
        adaptations.push(...aiResult.suggestedAdaptations);
      }
      if (aiResult.nextSteps) {
        nextSteps.push(...aiResult.nextSteps);
      }
    } catch (error) {
        console.log("[PersonalizedCareJourney] AI feedback analysis unavailable");
        // Rule-based fallback
        if (progressUpdate.feedback.toLowerCase().includes("difficult") || 
            progressUpdate.feedback.toLowerCase().includes("struggling")) {
          adaptations.push({
            reason: "Patient expressing difficulty",
            changes: ["Added extra support resources", "Scheduled care team check-in"],
          });
          nextSteps.push("Connect with care team for additional support");
        }
      }
    } else {
      // Fallback when OpenAI not configured
      console.log("[PersonalizedCareJourney] OpenAI not configured, using rule-based feedback analysis");
      if (progressUpdate.feedback.toLowerCase().includes("difficult") || 
          progressUpdate.feedback.toLowerCase().includes("struggling") ||
          progressUpdate.feedback.toLowerCase().includes("hard")) {
        adaptations.push({
          reason: "Patient expressing difficulty",
          changes: ["Added extra support resources", "Scheduled care team check-in"],
        });
        nextSteps.push("Connect with care team for additional support");
      } else if (progressUpdate.feedback.toLowerCase().includes("good") ||
                 progressUpdate.feedback.toLowerCase().includes("great") ||
                 progressUpdate.feedback.toLowerCase().includes("better")) {
        nextSteps.push("Continue with current care approach");
      }
    }
  }
  
  if (completedCount > 3) {
    nextSteps.push("Great progress! Continue with current plan");
  } else {
    nextSteps.push("Focus on completing priority tasks");
  }
  
  const updatedProgress: PatientProgress = {
    patientId,
    overallProgress: Math.min(100, completedCount * 10),
    adherenceRate,
    engagementScore,
    lastActivityDate: new Date().toISOString(),
    completedMilestones: progressUpdate.completedMilestones?.length || 0,
    totalMilestones: 5,
    recentAchievements: progressUpdate.completedMilestones?.map(m => `Completed: ${m}`) || [],
    areasNeedingAttention: adherenceRate < 80 ? ["Medication adherence"] : [],
    feedbackSummary: {
      positiveIndicators: engagementScore > 80 ? ["High engagement"] : [],
      concerns: adherenceRate < 70 ? ["Low adherence rate needs attention"] : [],
      suggestions: nextSteps,
    },
  };

  logHipaaAudit("UPDATE_JOURNEY_PROGRESS_SUCCESS", userId, patientId, `Progress: ${updatedProgress.overallProgress}%, ${adaptations.length} adaptations`);
  
  return {
    updatedProgress,
    adaptations,
    nextSteps,
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

export async function getAvailablePatients(): Promise<{ patients: Array<{ patientId: string; name: string; conditions: string[] }>; disclaimer: string }> {
  return {
    patients: samplePatients.map(p => ({
      patientId: p.patientId,
      name: p.name,
      conditions: p.conditions,
    })),
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

console.log("[AIPersonalizedCareJourney] Service initialized with NO-CDS compliance");
