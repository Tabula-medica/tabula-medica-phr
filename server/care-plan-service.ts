import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type CarePlanStatus = "draft" | "active" | "completed" | "on_hold" | "cancelled";
export type GoalStatus = "not_started" | "in_progress" | "achieved" | "not_achieved" | "cancelled";
export type InterventionStatus = "planned" | "in_progress" | "completed" | "discontinued";

export interface CarePlanGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string | null;
  status: GoalStatus;
  priority: "high" | "medium" | "low";
  metrics: Array<{
    name: string;
    target: string;
    current: string | null;
    unit: string;
  }>;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanIntervention {
  id: string;
  goalId: string;
  title: string;
  description: string;
  frequency: string;
  assignedTo: "patient" | "provider" | "caregiver";
  status: InterventionStatus;
  startDate: string;
  endDate: string | null;
  progressNotes: Array<{
    date: string;
    note: string;
    author: string;
  }>;
}

export interface CarePlanContributor {
  id: string;
  name: string;
  role: "primary_provider" | "specialist" | "nurse" | "caregiver" | "patient";
  canEdit: boolean;
  lastContribution: string | null;
}

export interface CarePlan {
  id: string;
  patientId: string;
  title: string;
  description: string;
  status: CarePlanStatus;
  condition: string;
  startDate: string;
  reviewDate: string | null;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  contributors: CarePlanContributor[];
  patientAcknowledged: boolean;
  patientAcknowledgedAt: string | null;
  versionHistory: Array<{
    version: number;
    changedBy: string;
    changedAt: string;
    summary: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const mockCarePlans: CarePlan[] = [
  {
    id: "cp-1",
    patientId: "patient-default",
    title: "Diabetes Management Plan",
    description: "Comprehensive care plan for Type 2 Diabetes management focusing on blood sugar control, lifestyle modifications, and medication adherence.",
    status: "active",
    condition: "Type 2 Diabetes Mellitus",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    reviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    goals: [
      {
        id: "goal-1",
        title: "Improve Blood Sugar Control",
        description: "Achieve and maintain target HbA1c levels through medication and lifestyle changes",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        priority: "high",
        metrics: [
          { name: "HbA1c", target: "< 7.0%", current: "7.8%", unit: "%" },
          { name: "Fasting Glucose", target: "80-130 mg/dL", current: "145 mg/dL", unit: "mg/dL" },
        ],
        notes: ["Started Metformin 1000mg", "Patient attending diabetes education class"],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "goal-2",
        title: "Weight Management",
        description: "Achieve 5% weight reduction through diet and exercise",
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        priority: "medium",
        metrics: [
          { name: "Weight", target: "190 lbs", current: "200 lbs", unit: "lbs" },
          { name: "BMI", target: "< 28", current: "29.5", unit: "" },
        ],
        notes: ["Walking 20 minutes daily"],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    interventions: [
      {
        id: "int-1",
        goalId: "goal-1",
        title: "Daily Blood Glucose Monitoring",
        description: "Check fasting blood glucose every morning and log results",
        frequency: "Daily",
        assignedTo: "patient",
        status: "in_progress",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), note: "Averaging 140 mg/dL this week", author: "Patient" },
          { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), note: "Started tracking consistently", author: "Patient" },
        ],
      },
      {
        id: "int-2",
        goalId: "goal-1",
        title: "Medication Review",
        description: "Review and adjust diabetes medications as needed",
        frequency: "Monthly",
        assignedTo: "provider",
        status: "in_progress",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [
          { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), note: "Increased Metformin to 1000mg twice daily", author: "Dr. Chen" },
        ],
      },
      {
        id: "int-3",
        goalId: "goal-2",
        title: "Walking Program",
        description: "30-minute walk, 5 days per week",
        frequency: "5x per week",
        assignedTo: "patient",
        status: "in_progress",
        startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [
          { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), note: "Walked 4 times this week, 25 min avg", author: "Patient" },
        ],
      },
      {
        id: "int-4",
        goalId: "goal-2",
        title: "Nutrition Counseling",
        description: "Meet with dietitian to develop meal plan",
        frequency: "Bi-weekly",
        assignedTo: "patient",
        status: "planned",
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [],
      },
    ],
    contributors: [
      { id: "contrib-1", name: "Dr. Sarah Chen", role: "primary_provider", canEdit: true, lastContribution: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "contrib-2", name: "Jane Doe", role: "patient", canEdit: false, lastContribution: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "contrib-3", name: "Maria Garcia, RN", role: "nurse", canEdit: true, lastContribution: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    patientAcknowledged: true,
    patientAcknowledgedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    versionHistory: [
      { version: 1, changedBy: "Dr. Sarah Chen", changedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), summary: "Initial care plan created" },
      { version: 2, changedBy: "Dr. Sarah Chen", changedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), summary: "Increased Metformin dosage, added walking program" },
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "cp-2",
    patientId: "patient-default",
    title: "Hypertension Control Plan",
    description: "Blood pressure management through medication, diet modifications (DASH diet), and stress reduction.",
    status: "active",
    condition: "Essential Hypertension",
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    goals: [
      {
        id: "goal-3",
        title: "Blood Pressure Control",
        description: "Maintain blood pressure below 130/80 mmHg",
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        priority: "high",
        metrics: [
          { name: "Systolic BP", target: "< 130 mmHg", current: "138 mmHg", unit: "mmHg" },
          { name: "Diastolic BP", target: "< 80 mmHg", current: "85 mmHg", unit: "mmHg" },
        ],
        notes: ["Taking Lisinopril 20mg daily"],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    interventions: [
      {
        id: "int-5",
        goalId: "goal-3",
        title: "Home BP Monitoring",
        description: "Check blood pressure twice daily (morning and evening)",
        frequency: "Twice daily",
        assignedTo: "patient",
        status: "in_progress",
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [
          { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), note: "Weekly average: 136/84", author: "Patient" },
        ],
      },
      {
        id: "int-6",
        goalId: "goal-3",
        title: "Reduce Sodium Intake",
        description: "Limit sodium to less than 2,300mg per day (DASH diet)",
        frequency: "Daily",
        assignedTo: "patient",
        status: "in_progress",
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: null,
        progressNotes: [],
      },
    ],
    contributors: [
      { id: "contrib-4", name: "Dr. Sarah Chen", role: "primary_provider", canEdit: true, lastContribution: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "contrib-5", name: "Jane Doe", role: "patient", canEdit: false, lastContribution: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    patientAcknowledged: true,
    patientAcknowledgedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
    versionHistory: [
      { version: 1, changedBy: "Dr. Sarah Chen", changedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), summary: "Initial care plan created" },
    ],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

let carePlans = [...mockCarePlans];

export async function getCarePlans(patientId: string): Promise<CarePlan[]> {
  return carePlans.filter(cp => cp.patientId === patientId);
}

export async function createCarePlan(
  patientId: string,
  data: {
    title: string;
    description: string;
    condition: string;
    reviewDate?: string;
  }
): Promise<CarePlan> {
  const newPlan: CarePlan = {
    id: `cp-${Date.now()}`,
    patientId,
    title: data.title,
    description: data.description,
    status: "draft",
    condition: data.condition,
    startDate: new Date().toISOString(),
    reviewDate: data.reviewDate || null,
    goals: [],
    interventions: [],
    contributors: [
      { id: `contrib-${Date.now()}`, name: "Patient", role: "patient", canEdit: false, lastContribution: null },
    ],
    patientAcknowledged: false,
    patientAcknowledgedAt: null,
    versionHistory: [
      { version: 1, changedBy: "System", changedAt: new Date().toISOString(), summary: "Care plan created" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  carePlans.push(newPlan);
  return newPlan;
}

export async function deleteCarePlan(planId: string, patientId: string): Promise<boolean> {
  const index = carePlans.findIndex(cp => cp.id === planId && cp.patientId === patientId);
  if (index === -1) return false;

  carePlans.splice(index, 1);
  return true;
}

export async function getCarePlanById(planId: string, patientId: string): Promise<CarePlan | null> {
  return carePlans.find(cp => cp.id === planId && cp.patientId === patientId) || null;
}

export async function updateCarePlan(
  planId: string,
  patientId: string,
  updates: Partial<CarePlan>
): Promise<CarePlan | null> {
  const index = carePlans.findIndex(cp => cp.id === planId && cp.patientId === patientId);
  if (index === -1) return null;

  carePlans[index] = {
    ...carePlans[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return carePlans[index];
}

export async function acknowledgeCarePlan(
  planId: string,
  patientId: string
): Promise<CarePlan | null> {
  const index = carePlans.findIndex(cp => cp.id === planId && cp.patientId === patientId);
  if (index === -1) return null;

  carePlans[index] = {
    ...carePlans[index],
    patientAcknowledged: true,
    patientAcknowledgedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return carePlans[index];
}

export async function addProgressNote(
  planId: string,
  patientId: string,
  interventionId: string,
  note: string,
  author: string
): Promise<CarePlan | null> {
  const index = carePlans.findIndex(cp => cp.id === planId && cp.patientId === patientId);
  if (index === -1) return null;

  const intIndex = carePlans[index].interventions.findIndex(i => i.id === interventionId);
  if (intIndex === -1) return null;

  carePlans[index].interventions[intIndex].progressNotes.push({
    date: new Date().toISOString(),
    note,
    author,
  });

  carePlans[index].updatedAt = new Date().toISOString();

  return carePlans[index];
}

export async function updateGoalStatus(
  planId: string,
  patientId: string,
  goalId: string,
  status: GoalStatus
): Promise<CarePlan | null> {
  const index = carePlans.findIndex(cp => cp.id === planId && cp.patientId === patientId);
  if (index === -1) return null;

  const goalIndex = carePlans[index].goals.findIndex(g => g.id === goalId);
  if (goalIndex === -1) return null;

  carePlans[index].goals[goalIndex].status = status;
  carePlans[index].goals[goalIndex].updatedAt = new Date().toISOString();
  carePlans[index].updatedAt = new Date().toISOString();

  return carePlans[index];
}

export async function suggestCarePlanImprovements(
  planId: string,
  patientId: string
): Promise<string[]> {
  const plan = await getCarePlanById(planId, patientId);
  if (!plan) return [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a healthcare care plan advisor. Analyze care plans and suggest improvements. 
Keep suggestions practical, actionable, and patient-friendly. 
NEVER give medical advice or recommend specific treatments.
Focus on process improvements, communication, and adherence strategies.`,
        },
        {
          role: "user",
          content: `Analyze this care plan and suggest 3-5 improvements:

Title: ${plan.title}
Condition: ${plan.condition}
Goals: ${plan.goals.map(g => `${g.title} (${g.status})`).join(", ")}
Interventions: ${plan.interventions.map(i => `${i.title} (${i.status})`).join(", ")}

Return JSON: {"suggestions": ["suggestion1", "suggestion2", ...]}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    return result.suggestions || [];
  } catch (error) {
    console.error("[CarePlan] AI suggestion error:", error);
    return [
      "Consider scheduling a follow-up to review progress on current goals",
      "Review intervention completion rates with your care team",
    ];
  }
}

export async function getCarePlanStats(patientId: string): Promise<{
  totalPlans: number;
  activePlans: number;
  totalGoals: number;
  goalsAchieved: number;
  pendingAcknowledgment: number;
}> {
  const plans = await getCarePlans(patientId);
  
  const totalGoals = plans.reduce((sum, p) => sum + p.goals.length, 0);
  const goalsAchieved = plans.reduce(
    (sum, p) => sum + p.goals.filter(g => g.status === "achieved").length,
    0
  );

  return {
    totalPlans: plans.length,
    activePlans: plans.filter(p => p.status === "active").length,
    totalGoals,
    goalsAchieved,
    pendingAcknowledgment: plans.filter(p => !p.patientAcknowledged).length,
  };
}
