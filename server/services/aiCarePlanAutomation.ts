import OpenAI from "openai";
import type {
  CarePlan,
  CarePlanGoal,
  CarePlanIntervention,
  CareTeamTask,
  CarePlanCategory,
  GoalPriority,
  CareTeamRole,
} from "@shared/schema";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export interface PatientContext {
  patientId: string;
  patientName: string;
  age?: number;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentLabResults?: { name: string; value: string; date: string }[];
  vitalSigns?: { type: string; value: string; date: string }[];
}

export interface GeneratedCarePlan {
  title: string;
  description: string;
  category: CarePlanCategory;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  recommendedTeamRoles: CareTeamRole[];
  rationale: string;
  evidenceBasis: string[];
}

export interface TaskRecommendation {
  title: string;
  description: string;
  priority: "urgent" | "high" | "normal" | "low";
  category: CareTeamTask["category"];
  suggestedAssignee: CareTeamRole;
  dueInDays: number;
  rationale: string;
}

export interface InterventionSuggestion {
  goalId: string;
  description: string;
  frequency: string;
  suggestedAssignee: CareTeamRole;
  evidenceBasis: string;
  expectedOutcome: string;
}

export interface CarePlanOptimization {
  currentIssues: {
    type: "goal" | "intervention" | "coordination" | "timeline";
    description: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
  }[];
  suggestedAdjustments: {
    targetType: "goal" | "intervention";
    targetId: string;
    adjustment: string;
    rationale: string;
  }[];
  predictedOutcome: {
    metric: string;
    currentTrajectory: string;
    optimizedTrajectory: string;
  }[];
}

export interface LifestyleRecommendation {
  id: string;
  category: "exercise" | "sleep" | "stress_management" | "social" | "environment" | "habits";
  title: string;
  description: string;
  frequency: string;
  duration?: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedBenefit: string;
  precautions?: string[];
}

export interface DietaryRecommendation {
  id: string;
  category: "nutrition" | "hydration" | "supplements" | "restrictions" | "meal_planning";
  title: string;
  description: string;
  foods_to_include: string[];
  foods_to_avoid: string[];
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedBenefit: string;
  considerations?: string[];
}

export interface TreatmentRecommendation {
  id: string;
  category: "medication" | "therapy" | "procedure" | "monitoring" | "preventive";
  title: string;
  description: string;
  frequency?: string;
  duration?: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedOutcome: string;
  sideEffects?: string[];
  contraindications?: string[];
  requiresSpecialist: boolean;
}

export interface PersonalizedCarePlan {
  carePlan: GeneratedCarePlan;
  lifestyleRecommendations: LifestyleRecommendation[];
  dietaryRecommendations: DietaryRecommendation[];
  treatmentRecommendations: TreatmentRecommendation[];
  patientEducation: {
    topic: string;
    summary: string;
    resources: string[];
  }[];
  riskFactors: {
    factor: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  }[];
  followUpSchedule: {
    type: string;
    interval: string;
    purpose: string;
  }[];
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function generateCarePlan(
  patientContext: PatientContext,
  primaryCondition: string,
  additionalNotes?: string
): Promise<GeneratedCarePlan> {
  const client = getOpenAI();
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback");
    return generateFallbackCarePlan(primaryCondition);
  }
  
  try {
    const prompt = `You are a clinical decision support AI assistant helping healthcare providers create comprehensive care plans. Based on the patient context and primary condition, generate a detailed care plan.

Patient Context:
- Patient ID: ${patientContext.patientId}
- Age: ${patientContext.age || "Unknown"}
- Conditions: ${patientContext.conditions.join(", ") || "None listed"}
- Current Medications: ${patientContext.medications.join(", ") || "None listed"}
- Allergies: ${patientContext.allergies.join(", ") || "None known"}
${patientContext.recentLabResults?.length ? `- Recent Lab Results: ${patientContext.recentLabResults.map(l => `${l.name}: ${l.value}`).join(", ")}` : ""}
${patientContext.vitalSigns?.length ? `- Vital Signs: ${patientContext.vitalSigns.map(v => `${v.type}: ${v.value}`).join(", ")}` : ""}

Primary Condition for Care Plan: ${primaryCondition}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Generate a comprehensive care plan in JSON format with the following structure:
{
  "title": "Care plan title",
  "description": "Brief description of the care plan purpose",
  "category": "chronic_disease" | "post_surgical" | "preventive" | "mental_health" | "rehabilitation" | "palliative" | "wellness" | "other",
  "goals": [
    {
      "id": "unique-id",
      "description": "Goal description",
      "targetDate": "YYYY-MM-DD (3-6 months from now)",
      "priority": "high" | "medium" | "low",
      "status": "not_started",
      "progress": 0,
      "metrics": [{"name": "metric name", "target": "target value", "current": "baseline", "unit": "unit"}],
      "notes": "Additional notes"
    }
  ],
  "interventions": [
    {
      "id": "unique-id",
      "goalId": "matching goal id",
      "description": "Intervention description",
      "frequency": "e.g., Daily, Weekly, Every 2 weeks",
      "assignedTo": null,
      "startDate": "YYYY-MM-DD",
      "status": "scheduled",
      "notes": "Additional notes"
    }
  ],
  "recommendedTeamRoles": ["primary_physician", "nurse", etc.],
  "rationale": "Clinical rationale for the care plan approach",
  "evidenceBasis": ["Evidence source 1", "Evidence source 2"]
}

Focus on patient-centered, evidence-based care with measurable goals and actionable interventions.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const goals: CarePlanGoal[] = (result.goals || []).map((g: any) => ({
      id: g.id || generateId(),
      description: g.description,
      targetDate: g.targetDate,
      priority: g.priority || "medium",
      status: "not_started",
      progress: 0,
      metrics: g.metrics || [],
      notes: g.notes,
    }));

    const interventions: CarePlanIntervention[] = (result.interventions || []).map((i: any) => ({
      id: i.id || generateId(),
      goalId: i.goalId,
      description: i.description,
      frequency: i.frequency,
      assignedTo: i.assignedTo,
      startDate: i.startDate || new Date().toISOString().split("T")[0],
      status: "scheduled",
      notes: i.notes,
    }));

    return {
      title: result.title || `Care Plan for ${primaryCondition}`,
      description: result.description || `Comprehensive care plan addressing ${primaryCondition}`,
      category: result.category || "chronic_disease",
      goals,
      interventions,
      recommendedTeamRoles: result.recommendedTeamRoles || ["primary_physician", "nurse"],
      rationale: result.rationale || "Evidence-based care plan tailored to patient needs",
      evidenceBasis: result.evidenceBasis || [],
    };
  } catch (error) {
    console.error("[AICarePlanAutomation] Error generating care plan:", error);
    return generateFallbackCarePlan(primaryCondition);
  }
}

function generateFallbackCarePlan(condition: string): GeneratedCarePlan {
  const goalId = generateId();
  return {
    title: `Care Plan for ${condition}`,
    description: `Comprehensive care plan addressing ${condition}`,
    category: "chronic_disease",
    goals: [
      {
        id: goalId,
        description: `Manage ${condition} effectively with regular monitoring`,
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        status: "not_started",
        progress: 0,
        metrics: [{ name: "Symptom Control", target: "Optimal", current: "Baseline", unit: "Status" }],
      },
    ],
    interventions: [
      {
        id: generateId(),
        goalId,
        description: `Regular monitoring and follow-up for ${condition}`,
        frequency: "Weekly",
        startDate: new Date().toISOString().split("T")[0],
        status: "scheduled",
      },
    ],
    recommendedTeamRoles: ["primary_physician", "nurse"],
    rationale: "Standard care approach for condition management",
    evidenceBasis: ["Clinical best practices"],
  };
}

export async function suggestTasks(
  carePlan: CarePlan,
  patientContext: PatientContext
): Promise<TaskRecommendation[]> {
  const client = getOpenAI();
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback tasks");
    return [{
      title: "Review care plan progress",
      description: "Assess patient progress toward care plan goals and adjust as needed",
      priority: "normal",
      category: "assessment",
      suggestedAssignee: "primary_physician",
      dueInDays: 7,
      rationale: "Regular review ensures care plan remains effective",
    }];
  }
  
  try {
    const prompt = `You are a clinical decision support AI helping healthcare providers identify necessary care tasks. Based on the care plan and patient context, suggest prioritized tasks for the care team.

Care Plan:
- Title: ${carePlan.title}
- Status: ${carePlan.status}
- Goals: ${carePlan.goals.map(g => `${g.description} (${g.status}, ${g.progress}% progress)`).join("; ")}
- Interventions: ${carePlan.interventions.map(i => `${i.description} (${i.status})`).join("; ")}

Patient Context:
- Conditions: ${patientContext.conditions.join(", ")}
- Medications: ${patientContext.medications.join(", ")}
${patientContext.recentLabResults?.length ? `- Recent Labs: ${patientContext.recentLabResults.map(l => `${l.name}: ${l.value}`).join(", ")}` : ""}

Generate 3-5 prioritized tasks in JSON format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed task description",
      "priority": "urgent" | "high" | "normal" | "low",
      "category": "assessment" | "medication" | "follow_up" | "documentation" | "coordination" | "patient_education",
      "suggestedAssignee": "primary_physician" | "nurse" | "care_coordinator" | "pharmacist" | "specialist",
      "dueInDays": number (1-30),
      "rationale": "Why this task is important"
    }
  ]
}

Focus on actionable, patient-centered tasks that advance care plan goals.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return (result.tasks || []).map((t: any) => ({
      title: t.title,
      description: t.description,
      priority: t.priority || "normal",
      category: t.category || "follow_up",
      suggestedAssignee: t.suggestedAssignee || "care_coordinator",
      dueInDays: t.dueInDays || 7,
      rationale: t.rationale,
    }));
  } catch (error) {
    console.error("[AICarePlanAutomation] Error suggesting tasks:", error);
    return [
      {
        title: "Review care plan progress",
        description: "Assess patient progress toward care plan goals and adjust as needed",
        priority: "normal",
        category: "assessment",
        suggestedAssignee: "primary_physician",
        dueInDays: 7,
        rationale: "Regular review ensures care plan remains effective",
      },
    ];
  }
}

export async function suggestInterventions(
  carePlan: CarePlan,
  patientContext: PatientContext,
  goalId?: string
): Promise<InterventionSuggestion[]> {
  const client = getOpenAI();
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback interventions");
    return [];
  }
  
  try {
    const targetGoals = goalId 
      ? carePlan.goals.filter(g => g.id === goalId)
      : carePlan.goals.filter(g => g.status !== "achieved" && g.status !== "cancelled");

    const prompt = `You are a clinical decision support AI helping healthcare providers identify effective interventions. Based on the care plan goals and patient context, suggest evidence-based interventions.

Goals to Address:
${targetGoals.map(g => `- ${g.description} (Priority: ${g.priority}, Progress: ${g.progress}%)`).join("\n")}

Patient Context:
- Conditions: ${patientContext.conditions.join(", ")}
- Medications: ${patientContext.medications.join(", ")}
- Allergies: ${patientContext.allergies.join(", ")}

Current Interventions:
${carePlan.interventions.map(i => `- ${i.description} (${i.frequency})`).join("\n") || "None"}

Generate 2-4 evidence-based intervention suggestions in JSON format:
{
  "interventions": [
    {
      "goalId": "matching goal id from above",
      "description": "Intervention description",
      "frequency": "e.g., Daily, 3x weekly, Weekly, Bi-weekly",
      "suggestedAssignee": "primary_physician" | "nurse" | "care_coordinator" | "pharmacist" | "therapist",
      "evidenceBasis": "Research or guideline supporting this intervention",
      "expectedOutcome": "What improvement to expect"
    }
  ]
}

Focus on patient-centered, evidence-based interventions that complement existing care.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return (result.interventions || []).map((i: any) => ({
      goalId: i.goalId || (targetGoals[0]?.id || ""),
      description: i.description,
      frequency: i.frequency,
      suggestedAssignee: i.suggestedAssignee || "nurse",
      evidenceBasis: i.evidenceBasis,
      expectedOutcome: i.expectedOutcome,
    }));
  } catch (error) {
    console.error("[AICarePlanAutomation] Error suggesting interventions:", error);
    return [];
  }
}

export async function optimizeCarePlan(
  carePlan: CarePlan,
  patientContext: PatientContext
): Promise<CarePlanOptimization> {
  const client = getOpenAI();
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback optimization");
    return { currentIssues: [], suggestedAdjustments: [], predictedOutcome: [] };
  }
  
  try {
    const prompt = `You are a clinical decision support AI helping optimize care plans. Analyze the care plan for potential improvements and predict outcomes.

Care Plan Analysis:
- Title: ${carePlan.title}
- Category: ${carePlan.category}
- Status: ${carePlan.status}
- Start Date: ${carePlan.startDate}
- Target End Date: ${carePlan.endDate || "Not specified"}

Goals (${carePlan.goals.length}):
${carePlan.goals.map(g => `- ${g.description} | Priority: ${g.priority} | Status: ${g.status} | Progress: ${g.progress}%`).join("\n")}

Interventions (${carePlan.interventions.length}):
${carePlan.interventions.map(i => `- ${i.description} | Frequency: ${i.frequency} | Status: ${i.status}`).join("\n")}

Patient Context:
- Conditions: ${patientContext.conditions.join(", ")}
- Medications: ${patientContext.medications.join(", ")}

Provide optimization analysis in JSON format:
{
  "currentIssues": [
    {
      "type": "goal" | "intervention" | "coordination" | "timeline",
      "description": "Issue description",
      "severity": "high" | "medium" | "low",
      "recommendation": "How to address this issue"
    }
  ],
  "suggestedAdjustments": [
    {
      "targetType": "goal" | "intervention",
      "targetId": "id of goal or intervention",
      "adjustment": "What to change",
      "rationale": "Why this change helps"
    }
  ],
  "predictedOutcome": [
    {
      "metric": "Outcome metric name",
      "currentTrajectory": "Expected outcome without changes",
      "optimizedTrajectory": "Expected outcome with optimizations"
    }
  ]
}

Focus on practical, evidence-based improvements.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      currentIssues: result.currentIssues || [],
      suggestedAdjustments: result.suggestedAdjustments || [],
      predictedOutcome: result.predictedOutcome || [],
    };
  } catch (error) {
    console.error("[AICarePlanAutomation] Error optimizing care plan:", error);
    return {
      currentIssues: [],
      suggestedAdjustments: [],
      predictedOutcome: [],
    };
  }
}

export async function generateProgressSummary(
  carePlan: CarePlan,
  patientContext: PatientContext
): Promise<{
  summary: string;
  keyAchievements: string[];
  areasOfConcern: string[];
  nextSteps: string[];
  overallProgress: number;
}> {
  const client = getOpenAI();
  const progress = calculateOverallProgress(carePlan);
  
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback summary");
    return {
      summary: `Care plan is ${progress}% complete with ${carePlan.goals.filter(g => g.status === "achieved").length} of ${carePlan.goals.length} goals achieved.`,
      keyAchievements: carePlan.goals.filter(g => g.status === "achieved").map(g => g.description),
      areasOfConcern: carePlan.goals.filter(g => g.progress < 25 && g.status !== "achieved").map(g => g.description),
      nextSteps: ["Continue monitoring progress", "Review interventions effectiveness"],
      overallProgress: progress,
    };
  }
  
  try {
    const prompt = `You are a clinical decision support AI helping summarize care plan progress. Generate a comprehensive progress summary.

Care Plan: ${carePlan.title}
Duration: ${carePlan.startDate} to ${carePlan.endDate || "ongoing"}

Goals Progress:
${carePlan.goals.map(g => `- ${g.description}: ${g.progress}% (${g.status})`).join("\n")}

Interventions Status:
${carePlan.interventions.map(i => `- ${i.description}: ${i.status}`).join("\n")}

Progress Notes:
${carePlan.progressNotes?.slice(-5).map(n => `- ${n.date}: ${n.note}`).join("\n") || "No recent notes"}

Generate a progress summary in JSON format:
{
  "summary": "2-3 sentence summary of overall progress",
  "keyAchievements": ["Achievement 1", "Achievement 2"],
  "areasOfConcern": ["Concern 1", "Concern 2"],
  "nextSteps": ["Next step 1", "Next step 2"],
  "overallProgress": number (0-100)
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      summary: result.summary || "Progress summary unavailable",
      keyAchievements: result.keyAchievements || [],
      areasOfConcern: result.areasOfConcern || [],
      nextSteps: result.nextSteps || [],
      overallProgress: result.overallProgress || calculateOverallProgress(carePlan),
    };
  } catch (error) {
    console.error("[AICarePlanAutomation] Error generating summary:", error);
    const progress = calculateOverallProgress(carePlan);
    return {
      summary: `Care plan is ${progress}% complete with ${carePlan.goals.filter(g => g.status === "achieved").length} of ${carePlan.goals.length} goals achieved.`,
      keyAchievements: carePlan.goals.filter(g => g.status === "achieved").map(g => g.description),
      areasOfConcern: carePlan.goals.filter(g => g.progress < 25 && g.status !== "achieved").map(g => g.description),
      nextSteps: ["Continue monitoring progress", "Review interventions effectiveness"],
      overallProgress: progress,
    };
  }
}

function calculateOverallProgress(carePlan: CarePlan): number {
  if (carePlan.goals.length === 0) return 0;
  const totalProgress = carePlan.goals.reduce((sum, g) => sum + g.progress, 0);
  return Math.round(totalProgress / carePlan.goals.length);
}

export async function generatePersonalizedCarePlan(
  patientContext: PatientContext,
  primaryCondition: string,
  treatmentGoals?: string[],
  additionalNotes?: string
): Promise<PersonalizedCarePlan> {
  const client = getOpenAI();
  
  const basePlan = await generateCarePlan(patientContext, primaryCondition, additionalNotes);
  
  if (!client) {
    console.log("[AICarePlanAutomation] OpenAI not configured, using fallback personalized plan");
    return generateFallbackPersonalizedPlan(patientContext, primaryCondition, basePlan);
  }
  
  try {
    const prompt = `You are an expert clinical decision support AI. Generate comprehensive, personalized care recommendations for a patient based on their medical context and conditions.

Patient Context:
- Patient ID: ${patientContext.patientId}
- Name: ${patientContext.patientName}
- Age: ${patientContext.age || "Unknown"}
- Current Conditions: ${patientContext.conditions.join(", ") || "None listed"}
- Current Medications: ${patientContext.medications.join(", ") || "None listed"}
- Allergies: ${patientContext.allergies.join(", ") || "None known"}
${patientContext.recentLabResults?.length ? `- Recent Lab Results: ${patientContext.recentLabResults.map(l => `${l.name}: ${l.value} (${l.date})`).join(", ")}` : ""}
${patientContext.vitalSigns?.length ? `- Vital Signs: ${patientContext.vitalSigns.map(v => `${v.type}: ${v.value}`).join(", ")}` : ""}

Primary Condition: ${primaryCondition}
${treatmentGoals?.length ? `Treatment Goals: ${treatmentGoals.join(", ")}` : ""}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Generate comprehensive personalized recommendations in JSON format:
{
  "lifestyleRecommendations": [
    {
      "id": "unique-id",
      "category": "exercise" | "sleep" | "stress_management" | "social" | "environment" | "habits",
      "title": "Short recommendation title",
      "description": "Detailed description of the recommendation",
      "frequency": "How often (e.g., Daily, 3x weekly)",
      "duration": "How long each session (e.g., 30 minutes)",
      "priority": "high" | "medium" | "low",
      "rationale": "Why this is important for the patient",
      "evidenceBasis": "Research or guidelines supporting this",
      "expectedBenefit": "What improvement to expect",
      "precautions": ["Any warnings or considerations"]
    }
  ],
  "dietaryRecommendations": [
    {
      "id": "unique-id",
      "category": "nutrition" | "hydration" | "supplements" | "restrictions" | "meal_planning",
      "title": "Short recommendation title",
      "description": "Detailed dietary guidance",
      "foods_to_include": ["food1", "food2", "food3"],
      "foods_to_avoid": ["food1", "food2"],
      "priority": "high" | "medium" | "low",
      "rationale": "Why this dietary change helps",
      "evidenceBasis": "Nutritional science or guidelines",
      "expectedBenefit": "Expected health improvement",
      "considerations": ["Special considerations like drug interactions"]
    }
  ],
  "treatmentRecommendations": [
    {
      "id": "unique-id",
      "category": "medication" | "therapy" | "procedure" | "monitoring" | "preventive",
      "title": "Treatment name",
      "description": "Detailed treatment description",
      "frequency": "How often",
      "duration": "Treatment duration",
      "priority": "high" | "medium" | "low",
      "rationale": "Clinical reasoning",
      "evidenceBasis": "Clinical evidence or guidelines",
      "expectedOutcome": "Expected results",
      "sideEffects": ["Possible side effects"],
      "contraindications": ["Conditions where this should be avoided"],
      "requiresSpecialist": true/false
    }
  ],
  "patientEducation": [
    {
      "topic": "Education topic",
      "summary": "Brief summary of what the patient should know",
      "resources": ["Resource links or references"]
    }
  ],
  "riskFactors": [
    {
      "factor": "Risk factor description",
      "severity": "high" | "medium" | "low",
      "mitigation": "How to reduce this risk"
    }
  ],
  "followUpSchedule": [
    {
      "type": "Type of follow-up (e.g., Lab work, Provider visit)",
      "interval": "How often (e.g., Every 3 months)",
      "purpose": "Why this follow-up is needed"
    }
  ]
}

Generate 3-5 recommendations in each category. Focus on evidence-based, patient-centered recommendations considering the patient's age, conditions, medications, and allergies. Ensure recommendations are actionable and specific to the patient's situation.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      carePlan: basePlan,
      lifestyleRecommendations: (result.lifestyleRecommendations || []).map((r: any) => ({
        ...r,
        id: r.id || generateId(),
      })),
      dietaryRecommendations: (result.dietaryRecommendations || []).map((r: any) => ({
        ...r,
        id: r.id || generateId(),
      })),
      treatmentRecommendations: (result.treatmentRecommendations || []).map((r: any) => ({
        ...r,
        id: r.id || generateId(),
        requiresSpecialist: r.requiresSpecialist || false,
      })),
      patientEducation: result.patientEducation || [],
      riskFactors: result.riskFactors || [],
      followUpSchedule: result.followUpSchedule || [],
    };
  } catch (error) {
    console.error("[AICarePlanAutomation] Error generating personalized plan:", error);
    return generateFallbackPersonalizedPlan(patientContext, primaryCondition, basePlan);
  }
}

function generateFallbackPersonalizedPlan(
  patientContext: PatientContext,
  primaryCondition: string,
  basePlan: GeneratedCarePlan
): PersonalizedCarePlan {
  return {
    carePlan: basePlan,
    lifestyleRecommendations: [
      {
        id: generateId(),
        category: "exercise",
        title: "Regular Physical Activity",
        description: `Engage in moderate physical activity appropriate for your condition (${primaryCondition}). Start slowly and gradually increase intensity as tolerated.`,
        frequency: "Daily",
        duration: "30 minutes",
        priority: "high",
        rationale: "Regular exercise improves overall health outcomes and can help manage symptoms",
        evidenceBasis: "CDC Physical Activity Guidelines for Americans",
        expectedBenefit: "Improved cardiovascular health, better symptom control, enhanced quality of life",
        precautions: ["Consult your provider before starting a new exercise program", "Stop if you experience pain or discomfort"],
      },
      {
        id: generateId(),
        category: "sleep",
        title: "Quality Sleep Hygiene",
        description: "Maintain consistent sleep and wake times. Create a relaxing bedtime routine and optimize your sleep environment.",
        frequency: "Daily",
        duration: "7-9 hours",
        priority: "medium",
        rationale: "Adequate sleep supports immune function and healing",
        evidenceBasis: "National Sleep Foundation Guidelines",
        expectedBenefit: "Better energy levels, improved mood, enhanced recovery",
      },
      {
        id: generateId(),
        category: "stress_management",
        title: "Stress Reduction Techniques",
        description: "Practice relaxation techniques such as deep breathing, meditation, or gentle yoga to manage stress levels.",
        frequency: "Daily",
        duration: "15-20 minutes",
        priority: "medium",
        rationale: "Chronic stress can worsen health conditions and delay healing",
        evidenceBasis: "American Psychological Association stress management guidelines",
        expectedBenefit: "Reduced anxiety, better symptom management, improved overall wellbeing",
      },
    ],
    dietaryRecommendations: [
      {
        id: generateId(),
        category: "nutrition",
        title: "Balanced Whole Foods Diet",
        description: "Focus on nutrient-dense whole foods including fruits, vegetables, lean proteins, and whole grains.",
        foods_to_include: ["Leafy greens", "Berries", "Lean proteins", "Whole grains", "Legumes", "Nuts and seeds"],
        foods_to_avoid: ["Processed foods", "Excessive sodium", "Added sugars", "Trans fats"],
        priority: "high",
        rationale: "Proper nutrition supports healing and helps manage chronic conditions",
        evidenceBasis: "Dietary Guidelines for Americans",
        expectedBenefit: "Improved energy, better disease management, enhanced immune function",
      },
      {
        id: generateId(),
        category: "hydration",
        title: "Adequate Hydration",
        description: "Drink sufficient water throughout the day. Limit caffeine and avoid sugary beverages.",
        foods_to_include: ["Water", "Herbal teas", "Low-sodium broths"],
        foods_to_avoid: ["Sugary drinks", "Excessive caffeine", "Alcohol"],
        priority: "medium",
        rationale: "Proper hydration supports all body functions and medication effectiveness",
        evidenceBasis: "Institute of Medicine hydration recommendations",
        expectedBenefit: "Better medication absorption, improved kidney function, enhanced energy",
      },
    ],
    treatmentRecommendations: [
      {
        id: generateId(),
        category: "monitoring",
        title: "Regular Health Monitoring",
        description: `Track symptoms and vital signs related to ${primaryCondition}. Keep a health journal to share with your care team.`,
        frequency: "Daily",
        priority: "high",
        rationale: "Regular monitoring helps detect changes early and optimize treatment",
        evidenceBasis: "Clinical best practices for chronic disease management",
        expectedOutcome: "Early detection of changes, better treatment adjustments, improved outcomes",
        requiresSpecialist: false,
      },
      {
        id: generateId(),
        category: "preventive",
        title: "Preventive Care Compliance",
        description: "Stay up-to-date with recommended screenings, vaccinations, and preventive care appropriate for your age and conditions.",
        frequency: "Per guidelines",
        priority: "medium",
        rationale: "Preventive care reduces risk of complications and additional health issues",
        evidenceBasis: "USPSTF Preventive Care Guidelines",
        expectedOutcome: "Reduced risk of complications, early detection of new conditions",
        requiresSpecialist: false,
      },
    ],
    patientEducation: [
      {
        topic: `Understanding ${primaryCondition}`,
        summary: `Learn about ${primaryCondition}, its causes, symptoms, and how lifestyle factors affect the condition. Understanding your diagnosis empowers you to participate actively in your care.`,
        resources: ["Patient education materials from your provider", "Reputable health websites (NIH, Mayo Clinic)"],
      },
      {
        topic: "Medication Management",
        summary: "Understand your medications, including why each is prescribed, how to take them correctly, and potential side effects to watch for.",
        resources: ["Medication information sheets", "Pharmacist consultation"],
      },
    ],
    riskFactors: [
      {
        factor: "Non-adherence to treatment plan",
        severity: "high",
        mitigation: "Use medication reminders, keep follow-up appointments, and communicate challenges with your care team",
      },
      {
        factor: "Lifestyle factors affecting condition",
        severity: "medium",
        mitigation: "Follow lifestyle recommendations and track progress toward health goals",
      },
    ],
    followUpSchedule: [
      {
        type: "Provider Visit",
        interval: "Every 3 months",
        purpose: "Assess progress, adjust treatment plan, address concerns",
      },
      {
        type: "Lab Work",
        interval: "Per provider recommendation",
        purpose: "Monitor treatment effectiveness and detect changes",
      },
    ],
  };
}

console.log("[AICarePlanAutomation] Service initialized");
