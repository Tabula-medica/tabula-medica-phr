import OpenAI from "openai";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { getAuditLogger } from "./integrations/factory";
import type {
  AICarePlan,
  SmartGoal,
  AICarePlanIntervention,
  PatientEducationMaterial,
  FollowUpScheduleItem,
  CarePlanRiskAssessment,
  InterventionLibraryItem,
  GoalCategory,
  GenerateAICarePlanInput,
  CarePlanApprovalInput,
  AIInterventionPriority,
  AIInterventionStatus,
  CarePlanStatus,
} from "@shared/schema";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const NO_CDS_CARE_PLAN_GUARDRAIL = `
CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
You are generating a care plan TEMPLATE that organizes documented patient information.
You MUST NOT provide any of the following:
- NEW diagnoses or differential diagnoses
- Treatment recommendations or clinical suggestions
- Drug dosage changes or medication recommendations
- Drug interaction warnings or clinical alerts
- Clinical predictions, prognosis, or risk assessments
- Triage decisions or urgency ratings
- Any form of medical advice or clinical interpretation
- Statements about what treatments "should" or "could" be done

You may ONLY:
- List and organize DOCUMENTED conditions, medications, and observations
- Create educational goal templates based on documented health status
- Suggest patient education topics related to documented conditions
- Structure care coordination activities (appointments, follow-ups)
- Present information to support provider-patient discussions

ALL care plan elements must be labeled as "For provider review and approval" or "Draft - requires clinical review".
The care plan is a TEMPLATE to organize documented information, NOT clinical guidance.
`;

async function logCarePlanActivity(
  action: string,
  details: Record<string, unknown>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: "[REDACTED]",
      userRole: "care_team",
      action: action.includes("generate") ? "create" : "update",
      resourceType: "CarePlan",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/care-plan",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        carePlanAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[AICarePlan] Audit logging failed:", e);
  }
}

function generateId(): string {
  return `cp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const interventionLibrary: InterventionLibraryItem[] = [
  {
    id: "int-001",
    category: "care_coordination",
    title: "DRAFT: Care Coordination Topic - Medication Review",
    description: "DRAFT TEMPLATE - Topic placeholder for medication-related care coordination. Requires provider review and approval.",
    applicableConditions: ["diabetes", "hypertension", "heart_failure", "polypharmacy"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-002",
    category: "care_coordination",
    title: "DRAFT: Care Coordination Topic - Vital Signs Discussion",
    description: "DRAFT TEMPLATE - Topic placeholder for vital sign-related discussions with care team. Requires provider review and approval.",
    applicableConditions: ["hypertension", "heart_failure", "kidney_disease"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-003",
    category: "education",
    title: "DRAFT: Patient Education Topic - Chronic Condition Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder related to documented chronic conditions. Requires provider review and approval.",
    applicableConditions: ["diabetes", "prediabetes"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-004",
    category: "education",
    title: "DRAFT: Patient Education Topic - Nutrition Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder related to nutrition. Requires provider review and approval.",
    applicableConditions: ["diabetes", "obesity", "heart_disease", "kidney_disease"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-005",
    category: "care_coordination",
    title: "DRAFT: Care Coordination Topic - Specialist Discussion",
    description: "DRAFT TEMPLATE - Topic placeholder for discussing specialist involvement with care team. Requires provider review and approval.",
    applicableConditions: ["heart_failure", "arrhythmia", "chest_pain", "coronary_disease"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-006",
    category: "care_coordination",
    title: "DRAFT: Care Coordination Topic - Wellness Support",
    description: "DRAFT TEMPLATE - Topic placeholder for wellness-related support discussions. Requires provider review and approval.",
    applicableConditions: ["depression", "anxiety", "chronic_pain", "diabetes"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-007",
    category: "social_services",
    title: "DRAFT: Social Services Topic - Transportation Resources",
    description: "DRAFT TEMPLATE - Topic placeholder for transportation-related social services. Requires provider review and approval.",
    applicableConditions: ["mobility_issues", "transportation_barrier"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "int-008",
    category: "care_coordination",
    title: "DRAFT: Care Coordination Topic - Weight Discussion",
    description: "DRAFT TEMPLATE - Topic placeholder for weight-related discussions with care team. Requires provider review and approval.",
    applicableConditions: ["heart_failure", "kidney_disease", "obesity"],
    evidenceLevel: "not_applicable",
    defaultPriority: "medium" as AIInterventionPriority,
    defaultDuration: "To be determined by provider",
    requiredResources: [],
    isActive: true,
    usageCount: 0,
    successRate: 0,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
];

const educationMaterialsLibrary: PatientEducationMaterial[] = [
  {
    id: "edu-001",
    title: "DRAFT: Educational Topic - Blood Pressure Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder about blood pressure. Requires provider review and approval.",
    type: "document",
    category: "vital_monitoring",
    url: "/education/placeholder",
    readingLevel: "basic",
    languages: ["en"],
    estimatedDuration: 0,
    isRecommended: false,
    relevanceScore: 0,
    rationale: "Topic placeholder - for provider review",
    tags: ["draft", "placeholder"],
  },
  {
    id: "edu-002",
    title: "DRAFT: Educational Topic - Nutrition Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder about nutrition. Requires provider review and approval.",
    type: "document",
    category: "lifestyle_modification",
    url: "/education/placeholder",
    readingLevel: "basic",
    languages: ["en"],
    estimatedDuration: 0,
    isRecommended: false,
    relevanceScore: 0,
    rationale: "Topic placeholder - for provider review",
    tags: ["draft", "placeholder"],
  },
  {
    id: "edu-003",
    title: "DRAFT: Educational Topic - Medication Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder about medications. Requires provider review and approval.",
    type: "document",
    category: "medication_management",
    url: "/education/placeholder",
    readingLevel: "basic",
    languages: ["en"],
    estimatedDuration: 0,
    isRecommended: false,
    relevanceScore: 0,
    rationale: "Topic placeholder - for provider review",
    tags: ["draft", "placeholder"],
  },
  {
    id: "edu-004",
    title: "DRAFT: Educational Topic - Physical Activity Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder about physical activity. Requires provider review and approval.",
    type: "document",
    category: "lifestyle_modification",
    url: "/education/placeholder",
    readingLevel: "basic",
    languages: ["en"],
    estimatedDuration: 0,
    isRecommended: false,
    relevanceScore: 0,
    rationale: "Topic placeholder - for provider review",
    tags: ["draft", "placeholder"],
  },
  {
    id: "edu-005",
    title: "DRAFT: Educational Topic - Wellness Information",
    description: "DRAFT TEMPLATE - Educational topic placeholder about wellness. Requires provider review and approval.",
    type: "document",
    category: "mental_health",
    url: "/education/placeholder",
    readingLevel: "basic",
    languages: ["en"],
    estimatedDuration: 0,
    isRecommended: false,
    relevanceScore: 0,
    rationale: "Topic placeholder - for provider review",
    tags: ["draft", "placeholder"],
  },
];

const carePlans: Map<string, AICarePlan> = new Map();

export const aiCarePlanService = {
  async generateCarePlan(
    input: GenerateAICarePlanInput,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<AICarePlan> {
    const today = new Date();
    const carePlanId = generateId();

    const patientData = await this.getPatientData(input.patientId);
    const riskAssessment = await this.generateRiskAssessment(patientData, input);

    let smartGoals: SmartGoal[] = [];
    let interventions: AICarePlanIntervention[] = [];
    let educationMaterials: PatientEducationMaterial[] = [];
    let summary = "";
    let primaryGoals: string[] = [];

    try {
      const aiResponse = await this.callOpenAI(patientData, riskAssessment, input);
      smartGoals = aiResponse.smartGoals;
      interventions = aiResponse.interventions;
      educationMaterials = aiResponse.educationMaterials;
      summary = aiResponse.summary;
      primaryGoals = aiResponse.primaryGoals;
    } catch (error) {
      console.error("OpenAI call failed, using sample data:", error);
      const sampleData = this.generateSampleCarePlanData(patientData, riskAssessment, input);
      smartGoals = sampleData.smartGoals;
      interventions = sampleData.interventions;
      educationMaterials = sampleData.educationMaterials;
      summary = sampleData.summary;
      primaryGoals = sampleData.primaryGoals;
    }

    const followUpSchedule = this.generateFollowUpSchedule(smartGoals, interventions, input);

    const carePlan: AICarePlan = {
      id: carePlanId,
      patientId: input.patientId,
      patientName: patientData.name,
      status: "pending_review" as CarePlanStatus,
      version: 1,
      riskAssessment,
      generatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      generatedBy: "ai",
      aiModelVersion: "gpt-5.1",
      confidenceScore: 85,
      summary,
      primaryGoals,
      smartGoals,
      interventions,
      educationMaterials,
      followUpSchedule,
      careTeam: [
        {
          role: "Primary Care Provider",
          name: patientData.provider || "To be assigned",
          responsibilities: ["Care coordination", "Care plan review and approval"],
          contactInfo: "To be provided",
        },
        {
          role: "Care Coordinator",
          name: "To be assigned",
          responsibilities: ["Care plan coordination", "Patient communication", "Scheduling"],
          contactInfo: "To be provided",
        },
      ],
      reviewHistory: [],
      createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    };

    carePlans.set(carePlanId, carePlan);
    
    await logCarePlanActivity("generate_care_plan", {
      carePlanId,
      focusAreas: input.focusAreas?.join(",") || "all",
      timeframe: input.timeframe || "medium_term",
      goalsCount: smartGoals.length,
      interventionsCount: interventions.length,
      educationMaterialsCount: educationMaterials.length,
    }, userId, "unknown", "unknown");
    
    return carePlan;
  },

  async callOpenAI(
    patientData: any,
    riskAssessment: CarePlanRiskAssessment,
    input: GenerateAICarePlanInput
  ): Promise<{
    summary: string;
    primaryGoals: string[];
    smartGoals: SmartGoal[];
    interventions: AICarePlanIntervention[];
    educationMaterials: PatientEducationMaterial[];
  }> {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error("OpenAI client not available");
    }

    const systemPrompt = `You are generating a care plan TEMPLATE that organizes documented patient health information.
Your role is to structure documented information into a care plan format for provider review.

${NO_CDS_CARE_PLAN_GUARDRAIL}

OUTPUT FORMAT:
Return a JSON object with:
1. summary: Brief description of documented health information organized for review (2-3 sentences). Include disclaimer that this is a draft template.
2. primaryGoals: Array of 2-4 general health topic areas based on documented conditions (e.g., "Blood pressure monitoring", "Medication adherence support")
3. smartGoals: Array of goal TEMPLATES with structure:
   {id, category, specific, measurable, achievable, relevant, timeBound, targetValue, currentValue, status: "not_started", progress: 0, milestones: [], notes: "Draft - requires provider review"}
4. interventions: Array of care coordination activities (NOT clinical interventions) with structure:
   {id, category, priority, title, description, rationale, isFromLibrary, responsibleParty, frequency, duration, status: "pending"}
5. educationMaterials: Array of educational topics related to documented conditions with structure:
   {id, title, description, type, category, readingLevel, languages, estimatedDuration, isRecommended, relevanceScore, rationale, tags}

CRITICAL: All goals and activities must be labeled as drafts requiring provider approval. Do not suggest treatments.`;

    const userPrompt = `Organize the following documented patient information into a care plan template:

DOCUMENTED PATIENT INFORMATION:
${JSON.stringify(patientData, null, 2)}

DOCUMENTED CONDITIONS:
${JSON.stringify(riskAssessment.conditions.map(c => c.name), null, 2)}

DOCUMENTED SOCIAL FACTORS:
${JSON.stringify(riskAssessment.socialDeterminants.map(s => s.factor + ": " + s.details), null, 2)}

ORGANIZATION PREFERENCES:
- Focus areas: ${input.focusAreas?.join(", ") || "all documented areas"}
- Timeframe: ${input.timeframe || "medium_term"}
- Detail level: ${input.complexityLevel || "moderate"}
- Patient preferences: ${input.patientPreferences || "none specified"}
- Caregiver involvement: ${input.caregiverInvolvement ? "yes" : "no"}

Create 3-5 goal TEMPLATES and 4-6 care coordination activities based on the documented information. All items must be marked as drafts for provider review.`;

    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const today = new Date();

    const smartGoals: SmartGoal[] = (parsed.smartGoals || []).map((g: any, idx: number) => ({
      id: `goal-${Date.now()}-${idx}`,
      category: g.category || "disease_management",
      specific: g.specific || "",
      measurable: g.measurable || "",
      achievable: g.achievable || "",
      relevant: g.relevant || "",
      timeBound: g.timeBound || "",
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      status: "not_started" as const,
      progress: 0,
      milestones: g.milestones || [],
      notes: g.notes,
      createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    }));

    const interventions: AICarePlanIntervention[] = (parsed.interventions || []).map((i: any, idx: number) => ({
      id: `int-gen-${Date.now()}-${idx}`,
      category: i.category || "care_coordination",
      priority: i.priority || "medium",
      title: i.title || "",
      description: i.description || "",
      rationale: i.rationale || "",
      isFromLibrary: false,
      responsibleParty: i.responsibleParty || "Care Team",
      frequency: i.frequency,
      duration: i.duration,
      status: "pending" as AIInterventionStatus,
      createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    }));

    const educationMaterials: PatientEducationMaterial[] = (parsed.educationMaterials || []).map((e: any, idx: number) => ({
      id: `edu-gen-${Date.now()}-${idx}`,
      title: e.title || "DRAFT: Educational Topic Placeholder",
      description: e.description || "DRAFT TEMPLATE - Requires provider review and approval",
      type: e.type || "document",
      category: e.category || "disease_management",
      readingLevel: e.readingLevel || "basic",
      languages: e.languages || ["en"],
      estimatedDuration: e.estimatedDuration || 0,
      isRecommended: false,
      relevanceScore: 0,
      rationale: e.rationale || "Draft template - for provider review",
      tags: e.tags || ["draft", "placeholder"],
    }));

    return {
      summary: parsed.summary || "",
      primaryGoals: parsed.primaryGoals || [],
      smartGoals,
      interventions,
      educationMaterials,
    };
  },

  generateSampleCarePlanData(
    patientData: any,
    riskAssessment: CarePlanRiskAssessment,
    input: GenerateAICarePlanInput
  ): {
    summary: string;
    primaryGoals: string[];
    smartGoals: SmartGoal[];
    interventions: AICarePlanIntervention[];
    educationMaterials: PatientEducationMaterial[];
  } {
    const today = new Date();
    const threeMonthsLater = format(addMonths(today, 3), "MMMM d, yyyy");
    const sixMonthsLater = format(addMonths(today, 6), "MMMM d, yyyy");

    const smartGoals: SmartGoal[] = [
      {
        id: `goal-${Date.now()}-1`,
        category: "vital_monitoring",
        specific: "DRAFT TEMPLATE: Blood pressure monitoring goal placeholder - requires provider review and approval",
        measurable: "To be defined by provider based on documented health information",
        achievable: "To be confirmed by provider",
        relevant: "Related to documented hypertension condition",
        timeBound: `Target date to be set by provider`,
        targetValue: "To be set by provider",
        currentValue: "See documented vital signs",
        status: "not_started",
        progress: 0,
        milestones: [
          { id: "m1", description: "Schedule discussion with provider", targetDate: format(addWeeks(today, 1), "yyyy-MM-dd"), completed: false },
        ],
        notes: "DRAFT - Requires provider review and approval before implementation",
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
      {
        id: `goal-${Date.now()}-2`,
        category: "medication_management",
        specific: "DRAFT TEMPLATE: Medication management goal placeholder - requires provider review and approval",
        measurable: "To be defined by provider based on documented medications",
        achievable: "To be confirmed by provider",
        relevant: "Related to documented medication list",
        timeBound: `Target date to be set by provider`,
        status: "not_started",
        progress: 0,
        milestones: [
          { id: "m1", description: "Schedule discussion with provider", targetDate: format(addDays(today, 7), "yyyy-MM-dd"), completed: false },
        ],
        notes: "DRAFT - Requires provider review and approval before implementation",
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
      {
        id: `goal-${Date.now()}-3`,
        category: "lifestyle_modification",
        specific: "DRAFT TEMPLATE: Lifestyle goal placeholder - requires provider review and approval",
        measurable: "To be defined by provider",
        achievable: "To be confirmed by provider based on patient preferences",
        relevant: "Related to documented health conditions",
        timeBound: `Target date to be set by provider`,
        status: "not_started",
        progress: 0,
        milestones: [
          { id: "m1", description: "Schedule discussion with provider", targetDate: format(addDays(today, 7), "yyyy-MM-dd"), completed: false },
        ],
        notes: "DRAFT - Requires provider review and approval before implementation",
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
    ];

    const interventions: AICarePlanIntervention[] = [
      {
        id: `int-gen-${Date.now()}-1`,
        category: "care_coordination",
        priority: "medium" as AIInterventionPriority,
        title: "DRAFT: Care Coordination Activity Placeholder",
        description: "DRAFT TEMPLATE - Care coordination activity to be defined by provider based on documented patient needs.",
        rationale: "Based on documented health information - requires provider review.",
        isFromLibrary: false,
        responsibleParty: "Care Team - to be assigned",
        frequency: "To be determined by provider",
        duration: "To be determined by provider",
        status: "pending" as AIInterventionStatus,
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
      {
        id: `int-gen-${Date.now()}-2`,
        category: "education",
        priority: "medium" as AIInterventionPriority,
        title: "DRAFT: Patient Education Placeholder",
        description: "DRAFT TEMPLATE - Educational topics to be selected by provider based on documented conditions.",
        rationale: "Related to documented health conditions - requires provider review.",
        isFromLibrary: false,
        responsibleParty: "Care Coordinator",
        frequency: "To be determined by provider",
        duration: "To be determined by provider",
        status: "pending" as AIInterventionStatus,
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
      {
        id: `int-gen-${Date.now()}-3`,
        category: "care_coordination",
        priority: "medium" as AIInterventionPriority,
        title: "DRAFT: Follow-up Scheduling Placeholder",
        description: "DRAFT TEMPLATE - Follow-up appointments to be scheduled by care team based on provider guidance.",
        rationale: "Care coordination activity - requires provider review.",
        isFromLibrary: false,
        responsibleParty: "Care Coordinator",
        frequency: "To be determined by provider",
        duration: "To be determined by provider",
        status: "pending" as AIInterventionStatus,
        createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      },
    ];

    const educationMaterials = educationMaterialsLibrary.slice(0, 4);

    return {
      summary: `DRAFT CARE PLAN TEMPLATE - This template organizes documented health information for ${patientData.name}. All goals and activities are placeholders requiring provider review and approval before implementation. This is not a clinical recommendation.`,
      primaryGoals: [
        "DRAFT: Health topic area based on documented conditions - requires provider review",
        "DRAFT: Care coordination topic - requires provider review",
        "DRAFT: Patient education topic - requires provider review",
      ],
      smartGoals,
      interventions,
      educationMaterials,
    };
  },

  async getPatientData(patientId: string): Promise<any> {
    return {
      id: patientId,
      name: "Margaret Thompson",
      age: 67,
      conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
      medications: ["Metformin 1000mg", "Lisinopril 20mg", "Atorvastatin 40mg"],
      recentLabs: {
        a1c: { value: "8.2%", date: "2025-12-15", trend: "stable" },
        bloodPressure: { value: "145/92 mmHg", date: "2026-01-10", trend: "elevated" },
        ldl: { value: "125 mg/dL", date: "2025-12-15", trend: "improving" },
      },
      socialDeterminants: {
        transportation: "limited",
        foodAccess: "adequate",
        housing: "stable",
        socialSupport: "moderate",
      },
      provider: "Dr. Sarah Johnson",
      lastVisit: "2026-01-10",
    };
  },

  async generateRiskAssessment(patientData: any, input: GenerateAICarePlanInput): Promise<CarePlanRiskAssessment> {
    return {
      overallRiskScore: 0,
      riskLevel: "low",
      conditions: [],
      aiIdentifiedRisks: [],
      socialDeterminants: [
        {
          factor: "Transportation Access",
          impact: "neutral",
          details: "Transportation access documented in patient record - for provider review",
          interventionNeeded: false,
        },
        {
          factor: "Social Support",
          impact: "neutral",
          details: "Social support level documented in patient record - for provider review",
          interventionNeeded: false,
        },
      ],
      barriers: [
        {
          barrier: "Transportation documented as limited in patient record",
          severity: "low",
          suggestedApproach: "Documented information - for provider review",
        },
        {
          barrier: "Multiple medications documented in patient record",
          severity: "low",
          suggestedApproach: "Documented information - for provider review",
        },
      ],
    };
  },

  generateFollowUpSchedule(
    smartGoals: SmartGoal[],
    interventions: AICarePlanIntervention[],
    input: GenerateAICarePlanInput
  ): FollowUpScheduleItem[] {
    const today = new Date();

    return [
      {
        id: `fu-${Date.now()}-1`,
        type: "check_in",
        title: "DRAFT: Care Coordination Check-in Placeholder",
        description: "DRAFT TEMPLATE - Check-in schedule to be determined by care team. Requires provider review.",
        frequency: "To be determined by provider",
        scheduledDate: format(addWeeks(today, 2), "yyyy-MM-dd"),
        scheduledTime: "TBD",
        provider: "Care Team - to be assigned",
        reminderDays: [1, 3],
        status: "scheduled",
        relatedGoalIds: [],
      },
      {
        id: `fu-${Date.now()}-2`,
        type: "appointment",
        title: "DRAFT: Provider Visit Placeholder",
        description: "DRAFT TEMPLATE - Provider visit to be scheduled by care team. Requires provider review.",
        frequency: "To be determined by provider",
        scheduledDate: format(addMonths(today, 1), "yyyy-MM-dd"),
        scheduledTime: "TBD",
        provider: "To be assigned",
        location: "To be determined",
        reminderDays: [1, 3, 7],
        status: "scheduled",
        relatedGoalIds: [],
      },
      {
        id: `fu-${Date.now()}-3`,
        type: "review",
        title: "DRAFT: Care Plan Review Placeholder",
        description: "DRAFT TEMPLATE - Care plan review to be scheduled by care team. Requires provider review.",
        frequency: "To be determined by provider",
        scheduledDate: format(addMonths(today, 3), "yyyy-MM-dd"),
        provider: "To be assigned",
        reminderDays: [7, 14],
        status: "scheduled",
        relatedGoalIds: [],
      },
    ];
  },

  async getCarePlan(carePlanId: string): Promise<AICarePlan | null> {
    return carePlans.get(carePlanId) || null;
  },

  async getPatientCarePlans(patientId: string): Promise<AICarePlan[]> {
    const plans: AICarePlan[] = [];
    for (const plan of Array.from(carePlans.values())) {
      if (plan.patientId === patientId) {
        plans.push(plan);
      }
    }
    return plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getAllCarePlans(status?: string): Promise<AICarePlan[]> {
    let plans = Array.from(carePlans.values());
    if (status) {
      plans = plans.filter(p => p.status === status);
    }
    return plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async approveCarePlan(
    carePlanId: string,
    input: CarePlanApprovalInput,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<AICarePlan | null> {
    const plan = carePlans.get(carePlanId);
    if (!plan) return null;

    const today = new Date();
    const timestamp = format(today, "yyyy-MM-dd'T'HH:mm:ss");

    plan.reviewHistory.push({
      reviewerId: userId,
      reviewerName: userName,
      reviewerRole: userRole,
      action: input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "requested_changes",
      comments: input.comments,
      changesRequested: input.changesRequested,
      timestamp,
    });

    if (input.action === "approve") {
      plan.status = "approved" as CarePlanStatus;
      plan.approvedBy = userName;
      plan.approvedAt = timestamp;
    } else if (input.action === "reject") {
      plan.status = "cancelled" as CarePlanStatus;
    } else {
      plan.status = "pending_review" as CarePlanStatus;
    }

    plan.updatedAt = timestamp;
    carePlans.set(carePlanId, plan);
    return plan;
  },

  async activateCarePlan(carePlanId: string): Promise<AICarePlan | null> {
    const plan = carePlans.get(carePlanId);
    if (!plan || (plan.status as string) !== "approved") return null;

    const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
    plan.status = "active" as CarePlanStatus;
    plan.activatedAt = timestamp;
    plan.updatedAt = timestamp;

    for (const intervention of plan.interventions) {
      intervention.status = "active" as AIInterventionStatus;
      intervention.startDate = timestamp.split("T")[0];
    }

    carePlans.set(carePlanId, plan);
    return plan;
  },

  async updateGoalProgress(
    carePlanId: string,
    goalId: string,
    updates: { status?: string; progress?: number; notes?: string }
  ): Promise<SmartGoal | null> {
    const plan = carePlans.get(carePlanId);
    if (!plan) return null;

    const goal = plan.smartGoals.find(g => g.id === goalId);
    if (!goal) return null;

    if (updates.status) goal.status = updates.status as any;
    if (updates.progress !== undefined) goal.progress = updates.progress;
    if (updates.notes) goal.notes = updates.notes;
    goal.updatedAt = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

    plan.updatedAt = goal.updatedAt;
    carePlans.set(carePlanId, plan);
    return goal;
  },

  async updateIntervention(
    carePlanId: string,
    interventionId: string,
    updates: { status?: string; startDate?: string; endDate?: string; outcomes?: string }
  ): Promise<AICarePlanIntervention | null> {
    const plan = carePlans.get(carePlanId);
    if (!plan) return null;

    const intervention = plan.interventions.find(i => i.id === interventionId);
    if (!intervention) return null;

    if (updates.status) intervention.status = updates.status as any;
    if (updates.startDate) intervention.startDate = updates.startDate;
    if (updates.endDate) intervention.endDate = updates.endDate;
    if (updates.outcomes) intervention.outcomes = updates.outcomes;
    intervention.updatedAt = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

    plan.updatedAt = intervention.updatedAt;
    carePlans.set(carePlanId, plan);
    return intervention;
  },

  async getInterventionLibrary(): Promise<InterventionLibraryItem[]> {
    return interventionLibrary;
  },

  async getEducationMaterialsLibrary(): Promise<PatientEducationMaterial[]> {
    return educationMaterialsLibrary;
  },

  async addInterventionFromLibrary(
    carePlanId: string,
    libraryItemId: string
  ): Promise<AICarePlanIntervention | null> {
    const plan = carePlans.get(carePlanId);
    if (!plan) return null;

    const libraryItem = interventionLibrary.find(i => i.id === libraryItemId);
    if (!libraryItem) return null;

    const today = new Date();
    const newIntervention: AICarePlanIntervention = {
      id: `int-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      category: libraryItem.category,
      priority: libraryItem.defaultPriority,
      title: libraryItem.title,
      description: libraryItem.description,
      rationale: "Draft template - requires provider review and approval",
      isFromLibrary: true,
      libraryId: libraryItem.id,
      responsibleParty: "Care Team - to be assigned",
      duration: libraryItem.defaultDuration,
      resources: libraryItem.requiredResources,
      contraindications: libraryItem.contraindications,
      status: "pending" as AIInterventionStatus,
      createdAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    };

    plan.interventions.push(newIntervention);
    plan.updatedAt = newIntervention.createdAt;
    carePlans.set(carePlanId, plan);
    return newIntervention;
  },

  async getCarePlanSummary(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    pendingReview: number;
    activeGoals: number;
    completedThisMonth: number;
  }> {
    const plans = Array.from(carePlans.values());
    const byStatus: Record<string, number> = {};
    let activeGoals = 0;
    let completedThisMonth = 0;

    const thisMonth = format(new Date(), "yyyy-MM");

    for (const plan of plans) {
      byStatus[plan.status] = (byStatus[plan.status] || 0) + 1;

      if (plan.status === "active") {
        activeGoals += plan.smartGoals.filter(g => g.status === "in_progress").length;
      }

      if (plan.status === "completed" && plan.completedAt?.startsWith(thisMonth)) {
        completedThisMonth++;
      }
    }

    return {
      total: plans.length,
      byStatus,
      pendingReview: byStatus["pending_review"] || 0,
      activeGoals,
      completedThisMonth,
    };
  },
};
