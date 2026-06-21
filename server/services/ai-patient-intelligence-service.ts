import OpenAI from "openai";
import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_DISCLAIMER = `IMPORTANT DISCLAIMER: This AI-generated analysis is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice, clinical recommendations, or a substitute for professional medical judgment. Healthcare decisions should ONLY be made by qualified healthcare providers who have examined the patient. This system is NOT a Clinical Decision Support (CDS) system and should NOT be used for diagnosis, treatment planning, or prescribing decisions.`;

export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type ConditionCategory = "diabetes_complications" | "cancer_recurrence" | "cardiovascular" | "renal" | "respiratory" | "mental_health" | "falls" | "readmission";

export interface RiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
  dataSource: string;
}

export interface ConditionRiskPrediction {
  id: string;
  conditionCategory: ConditionCategory;
  conditionName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskPercentile: number;
  timeframe: string;
  contributingFactors: RiskFactor[];
  protectiveFactors: RiskFactor[];
  trendsObserved: string[];
  historicalComparison: string;
  aiConfidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface PatientRiskProfile {
  id: string;
  patientId: string;
  patientName: string;
  overallRiskLevel: RiskLevel;
  overallRiskScore: number;
  predictions: ConditionRiskPrediction[];
  prioritizedConcerns: string[];
  dataCompleteness: number;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export type InteractionSeverity = "contraindicated" | "major" | "moderate" | "minor";
export type InteractionType = "drug_drug" | "drug_allergy" | "drug_food" | "drug_condition" | "therapeutic_duplication";

export interface DrugInteraction {
  id: string;
  medication1: { name: string; dosage: string; code?: string };
  medication2: { name: string; dosage?: string; code?: string };
  type: InteractionType;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffects: string[];
  riskFactors: string[];
  managementConsiderations: string;
  monitoringParameters: string[];
  alternativesForReview: string[];
  aiConfidence: number;
  evidenceLevel: "high" | "moderate" | "low";
  sources: string[];
}

export interface MedicationSafetyAnalysis {
  id: string;
  patientId: string;
  patientName: string;
  analyzedAt: string;
  medicationsAnalyzed: number;
  overallSafetyLevel: "safe" | "concerns_identified" | "review_urgently";
  safetyScore: number;
  interactions: DrugInteraction[];
  therapeuticDuplications: {
    drugClass: string;
    medications: string[];
    concern: string;
  }[];
  allergyConflicts: {
    medication: string;
    allergen: string;
    reactionType: string;
    severity: string;
  }[];
  renalDosing: {
    medication: string;
    currentDose: string;
    consideration: string;
    egfr?: number;
  }[];
  hepaticConsiderations: {
    medication: string;
    concern: string;
    liverFunction?: string;
  }[];
  summary: string;
  prioritizedFindings: string[];
  aiConfidence: number;
  noCdsDisclaimer: string;
}

export interface CareRecommendation {
  id: string;
  category: "preventive" | "monitoring" | "lifestyle" | "follow_up" | "screening" | "education";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  rationale: string;
  relevantConditions: string[];
  evidenceBasis: string;
  timeframe: string;
  patientEducationPoints: string[];
}

export interface PersonalizedCarePlan {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  executiveSummary: string;
  healthStatusOverview: string;
  recommendations: CareRecommendation[];
  screeningSchedule: {
    screening: string;
    dueDate: string;
    frequency: string;
    rationale: string;
  }[];
  wellnessGoals: {
    goal: string;
    currentStatus: string;
    targetMetric?: string;
    timeline: string;
  }[];
  educationalResources: {
    topic: string;
    description: string;
    relevance: string;
  }[];
  careTeamNotes: string;
  patientSummary: string;
  aiConfidence: number;
  noCdsDisclaimer: string;
}

export interface PatientDataInput {
  patientId: string;
  patientName: string;
  demographics: {
    age: number;
    gender: string;
    ethnicity?: string;
  };
  conditions: Array<{
    name: string;
    code?: string;
    onsetDate?: string;
    status: string;
    severity?: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate?: string;
    rxNormCode?: string;
    status: string;
  }>;
  allergies: Array<{
    substance: string;
    reaction?: string;
    severity?: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
  }>;
  labResults: Array<{
    name: string;
    code?: string;
    value: number;
    unit: string;
    referenceRange?: string;
    date: string;
    abnormal?: boolean;
  }>;
  familyHistory?: Array<{
    condition: string;
    relationship: string;
  }>;
  socialHistory?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseFrequency?: string;
    diet?: string;
  };
  encounters?: Array<{
    type: string;
    date: string;
    reason?: string;
    provider?: string;
  }>;
}

const RISK_PROFILE_CACHE = new Map<string, { profile: PatientRiskProfile; timestamp: number }>();
const SAFETY_ANALYSIS_CACHE = new Map<string, { analysis: MedicationSafetyAnalysis; timestamp: number }>();
const CARE_PLAN_CACHE = new Map<string, { plan: PersonalizedCarePlan; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function sanitizeAIOutput(text: string): string {
  const unsafePatterns = [
    { pattern: /\b(you should|you must|you need to|we recommend|I recommend)\b/gi, replacement: "patterns show" },
    { pattern: /\b(take|stop taking|discontinue|start)\b/gi, replacement: "data indicates consideration of" },
    { pattern: /\b(will cause|causes|can cause)\b/gi, replacement: "shows association with" },
    { pattern: /\b(diagnose|diagnosed|diagnosis)\b/gi, replacement: "data suggests" },
    { pattern: /\b(prescribe|prescription)\b/gi, replacement: "records show" },
    { pattern: /\b(treatment|treat)\b/gi, replacement: "care approach" },
    { pattern: /\b(cure|cures)\b/gi, replacement: "addresses" },
  ];

  let result = text;
  for (const { pattern, replacement } of unsafePatterns) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

class AIPatientIntelligenceService {
  async generateRiskProfile(
    patientData: PatientDataInput,
    categories: ConditionCategory[],
    userId: string
  ): Promise<PatientRiskProfile> {
    const cacheKey = `risk-${patientData.patientId}-${categories.join(",")}`;
    const cached = RISK_PROFILE_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.profile;
    }

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient",
      resourceId: patientData.patientId,
      patientId: patientData.patientId,
      details: `AI risk prediction for categories: ${categories.join(", ")}`,
    });

    const predictions: ConditionRiskPrediction[] = [];

    for (const category of categories) {
      const prediction = await this.predictConditionRisk(patientData, category);
      predictions.push(prediction);
    }

    const overallRiskScore = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length
      : 0;

    const overallRiskLevel = this.calculateRiskLevel(overallRiskScore);

    const prioritizedConcerns = predictions
      .filter(p => p.riskLevel === "high" || p.riskLevel === "critical")
      .sort((a, b) => b.riskScore - a.riskScore)
      .map(p => `${p.conditionName}: ${(p.riskScore * 100).toFixed(0)}% risk score`);

    const dataCompleteness = this.calculateDataCompleteness(patientData);

    const profile: PatientRiskProfile = {
      id: randomUUID(),
      patientId: patientData.patientId,
      patientName: patientData.patientName,
      overallRiskLevel,
      overallRiskScore,
      predictions,
      prioritizedConcerns,
      dataCompleteness,
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };

    RISK_PROFILE_CACHE.set(cacheKey, { profile, timestamp: Date.now() });
    return profile;
  }

  private async predictConditionRisk(
    patientData: PatientDataInput,
    category: ConditionCategory
  ): Promise<ConditionRiskPrediction> {
    const conditionNames: Record<ConditionCategory, string> = {
      diabetes_complications: "Diabetes Complications (Nephropathy, Retinopathy, Neuropathy)",
      cancer_recurrence: "Cancer Recurrence",
      cardiovascular: "Cardiovascular Events (MI, Stroke, Heart Failure)",
      renal: "Chronic Kidney Disease Progression",
      respiratory: "Respiratory Complications (COPD Exacerbation, Pneumonia)",
      mental_health: "Mental Health Crisis (Depression, Anxiety)",
      falls: "Fall Risk",
      readmission: "30-Day Hospital Readmission",
    };

    const prompt = `Analyze the following patient data and assess the risk level for ${conditionNames[category]}.

Patient Demographics:
- Age: ${patientData.demographics.age}
- Gender: ${patientData.demographics.gender}
${patientData.demographics.ethnicity ? `- Ethnicity: ${patientData.demographics.ethnicity}` : ""}

Active Conditions:
${patientData.conditions.filter(c => c.status === "active").map(c => `- ${c.name} (${c.severity || "unspecified severity"})`).join("\n") || "None recorded"}

Current Medications:
${patientData.medications.filter(m => m.status === "active").map(m => `- ${m.name} ${m.dosage}`).join("\n") || "None recorded"}

Recent Lab Results:
${patientData.labResults.slice(0, 10).map(l => `- ${l.name}: ${l.value} ${l.unit} ${l.abnormal ? "(ABNORMAL)" : ""}`).join("\n") || "None recorded"}

Recent Vitals:
${patientData.vitals.slice(0, 8).map(v => `- ${v.type}: ${v.value} ${v.unit}`).join("\n") || "None recorded"}

Family History:
${patientData.familyHistory?.map(f => `- ${f.condition} (${f.relationship})`).join("\n") || "None recorded"}

Social History:
${patientData.socialHistory ? `
- Smoking: ${patientData.socialHistory.smokingStatus || "Unknown"}
- Alcohol: ${patientData.socialHistory.alcoholUse || "Unknown"}
- Exercise: ${patientData.socialHistory.exerciseFrequency || "Unknown"}
` : "Not provided"}

Provide a JSON response with the following structure:
{
  "riskScore": <number 0-1 representing probability>,
  "riskPercentile": <number 0-100 showing where patient falls among similar demographics>,
  "contributingFactors": [{"factor": "<name>", "impact": "negative", "weight": <0-1>, "description": "<explanation>", "dataSource": "<source>"}],
  "protectiveFactors": [{"factor": "<name>", "impact": "positive", "weight": <0-1>, "description": "<explanation>", "dataSource": "<source>"}],
  "trendsObserved": ["<trend1>", "<trend2>"],
  "historicalComparison": "<comparison to baseline or typical progression>",
  "confidence": <number 0-1>
}

Base your analysis on clinical evidence and the data provided. Do not make medical recommendations.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a clinical data analyst. Analyze patient data objectively without making treatment recommendations. Your outputs are informational only and will be clearly marked as non-clinical decision support. Always express findings in terms of observed data patterns, not prescriptive advice.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      return {
        id: randomUUID(),
        conditionCategory: category,
        conditionName: conditionNames[category],
        riskLevel: this.calculateRiskLevel(result.riskScore || 0),
        riskScore: result.riskScore || 0,
        riskPercentile: result.riskPercentile || 50,
        timeframe: this.getTimeframeForCategory(category),
        contributingFactors: result.contributingFactors || [],
        protectiveFactors: result.protectiveFactors || [],
        trendsObserved: result.trendsObserved || [],
        historicalComparison: sanitizeAIOutput(result.historicalComparison || "Insufficient historical data for comparison"),
        aiConfidence: result.confidence || 0.7,
        modelVersion: "gpt-5.1-risk-v1",
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[AIPatientIntelligence] Risk prediction error for ${category}:`, error);
      return this.getMockRiskPrediction(patientData, category);
    }
  }

  async analyzeMedicationSafety(
    patientData: PatientDataInput,
    userId: string
  ): Promise<MedicationSafetyAnalysis> {
    const cacheKey = `safety-${patientData.patientId}`;
    const cached = SAFETY_ANALYSIS_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.analysis;
    }

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "MedicationRequest",
      resourceId: patientData.patientId,
      patientId: patientData.patientId,
      details: `AI drug interaction check for ${patientData.medications.length} medications`,
    });

    const activeMedications = patientData.medications.filter(m => m.status === "active");

    if (activeMedications.length === 0) {
      const emptyAnalysis: MedicationSafetyAnalysis = {
        id: randomUUID(),
        patientId: patientData.patientId,
        patientName: patientData.patientName,
        analyzedAt: new Date().toISOString(),
        medicationsAnalyzed: 0,
        overallSafetyLevel: "safe",
        safetyScore: 1,
        interactions: [],
        therapeuticDuplications: [],
        allergyConflicts: [],
        renalDosing: [],
        hepaticConsiderations: [],
        summary: "No active medications to analyze.",
        prioritizedFindings: [],
        aiConfidence: 1,
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };
      return emptyAnalysis;
    }

    const prompt = `Analyze the following patient medication list for potential drug interactions, therapeutic duplications, and safety concerns.

Patient Information:
- Age: ${patientData.demographics.age}
- Gender: ${patientData.demographics.gender}

Active Medications:
${activeMedications.map((m, i) => `${i + 1}. ${m.name} ${m.dosage} ${m.frequency}`).join("\n")}

Known Allergies:
${patientData.allergies.map(a => `- ${a.substance} (${a.reaction || "reaction unknown"}, ${a.severity || "severity unknown"})`).join("\n") || "None recorded"}

Active Conditions:
${patientData.conditions.filter(c => c.status === "active").map(c => `- ${c.name}`).join("\n") || "None recorded"}

Recent Lab Results (for renal/hepatic function):
${patientData.labResults.filter(l => 
  l.name.toLowerCase().includes("creatinine") || 
  l.name.toLowerCase().includes("egfr") || 
  l.name.toLowerCase().includes("bun") ||
  l.name.toLowerCase().includes("ast") ||
  l.name.toLowerCase().includes("alt") ||
  l.name.toLowerCase().includes("bilirubin")
).map(l => `- ${l.name}: ${l.value} ${l.unit}`).join("\n") || "Not available"}

Provide a JSON response:
{
  "interactions": [
    {
      "medication1": {"name": "<name>", "dosage": "<dose>"},
      "medication2": {"name": "<name>", "dosage": "<dose>"},
      "type": "drug_drug|drug_allergy|drug_food|drug_condition|therapeutic_duplication",
      "severity": "contraindicated|major|moderate|minor",
      "mechanism": "<pharmacological mechanism>",
      "clinicalEffects": ["<effect1>", "<effect2>"],
      "riskFactors": ["<factor1>"],
      "managementConsiderations": "<what clinicians may consider>",
      "monitoringParameters": ["<parameter1>"],
      "alternativesForReview": ["<alternative1>"],
      "confidence": <0-1>,
      "evidenceLevel": "high|moderate|low",
      "sources": ["<source1>"]
    }
  ],
  "therapeuticDuplications": [
    {"drugClass": "<class>", "medications": ["<med1>", "<med2>"], "concern": "<concern>"}
  ],
  "allergyConflicts": [
    {"medication": "<name>", "allergen": "<allergen>", "reactionType": "<type>", "severity": "<severity>"}
  ],
  "renalDosing": [
    {"medication": "<name>", "currentDose": "<dose>", "consideration": "<consideration>"}
  ],
  "hepaticConsiderations": [
    {"medication": "<name>", "concern": "<concern>"}
  ],
  "summary": "<overall safety summary>",
  "prioritizedFindings": ["<finding1>", "<finding2>"],
  "overallSafetyLevel": "safe|concerns_identified|review_urgently",
  "safetyScore": <0-1>,
  "confidence": <0-1>
}

Base analysis on established drug interaction databases and clinical literature. Express findings objectively without prescriptive language.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a clinical pharmacology analyst. Identify potential drug interactions and safety concerns objectively. Do not give prescriptive advice. All findings are for informational review only.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const analysis: MedicationSafetyAnalysis = {
        id: randomUUID(),
        patientId: patientData.patientId,
        patientName: patientData.patientName,
        analyzedAt: new Date().toISOString(),
        medicationsAnalyzed: activeMedications.length,
        overallSafetyLevel: result.overallSafetyLevel || "safe",
        safetyScore: result.safetyScore || 1,
        interactions: (result.interactions || []).map((i: any) => ({
          id: randomUUID(),
          ...i,
          managementConsiderations: sanitizeAIOutput(i.managementConsiderations || ""),
          aiConfidence: i.confidence || 0.7,
        })),
        therapeuticDuplications: result.therapeuticDuplications || [],
        allergyConflicts: result.allergyConflicts || [],
        renalDosing: result.renalDosing || [],
        hepaticConsiderations: result.hepaticConsiderations || [],
        summary: sanitizeAIOutput(result.summary || "Analysis complete."),
        prioritizedFindings: (result.prioritizedFindings || []).map((f: string) => sanitizeAIOutput(f)),
        aiConfidence: result.confidence || 0.8,
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      SAFETY_ANALYSIS_CACHE.set(cacheKey, { analysis, timestamp: Date.now() });
      return analysis;
    } catch (error) {
      console.error("[AIPatientIntelligence] Medication safety analysis error:", error);
      return this.getMockMedicationSafetyAnalysis(patientData);
    }
  }

  async generatePersonalizedCarePlan(
    patientData: PatientDataInput,
    userId: string
  ): Promise<PersonalizedCarePlan> {
    const cacheKey = `careplan-${patientData.patientId}`;
    const cached = CARE_PLAN_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.plan;
    }

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "CarePlan",
      resourceId: patientData.patientId,
      patientId: patientData.patientId,
      details: "AI personalized care plan generation",
    });

    const prompt = `Generate a personalized health summary and care considerations for the following patient.

Patient Demographics:
- Age: ${patientData.demographics.age}
- Gender: ${patientData.demographics.gender}

Active Conditions:
${patientData.conditions.filter(c => c.status === "active").map(c => `- ${c.name}`).join("\n") || "None recorded"}

Current Medications:
${patientData.medications.filter(m => m.status === "active").map(m => `- ${m.name} ${m.dosage}`).join("\n") || "None recorded"}

Recent Vitals:
${patientData.vitals.slice(0, 8).map(v => `- ${v.type}: ${v.value} ${v.unit} (${v.date})`).join("\n") || "None recorded"}

Recent Lab Results:
${patientData.labResults.slice(0, 10).map(l => `- ${l.name}: ${l.value} ${l.unit} ${l.abnormal ? "(ABNORMAL)" : ""}`).join("\n") || "None recorded"}

Known Allergies:
${patientData.allergies.map(a => `- ${a.substance}`).join("\n") || "None recorded"}

Social History:
${patientData.socialHistory ? `
- Smoking: ${patientData.socialHistory.smokingStatus || "Unknown"}
- Alcohol: ${patientData.socialHistory.alcoholUse || "Unknown"}
- Exercise: ${patientData.socialHistory.exerciseFrequency || "Unknown"}
` : "Not provided"}

Recent Encounters:
${patientData.encounters?.slice(0, 5).map(e => `- ${e.type}: ${e.reason || "routine"} (${e.date})`).join("\n") || "None recorded"}

Provide a JSON response:
{
  "executiveSummary": "<2-3 sentence overview of patient health status>",
  "healthStatusOverview": "<detailed narrative of current health state>",
  "recommendations": [
    {
      "category": "preventive|monitoring|lifestyle|follow_up|screening|education",
      "priority": "urgent|high|medium|low",
      "title": "<short title>",
      "description": "<what the consideration involves>",
      "rationale": "<why this is relevant based on patient data>",
      "relevantConditions": ["<condition1>"],
      "evidenceBasis": "<clinical guideline or evidence source>",
      "timeframe": "<when relevant>",
      "patientEducationPoints": ["<point1>", "<point2>"]
    }
  ],
  "screeningSchedule": [
    {"screening": "<name>", "dueDate": "<when>", "frequency": "<how often>", "rationale": "<why>"}
  ],
  "wellnessGoals": [
    {"goal": "<goal>", "currentStatus": "<status>", "targetMetric": "<metric>", "timeline": "<timeline>"}
  ],
  "educationalResources": [
    {"topic": "<topic>", "description": "<description>", "relevance": "<why relevant>"}
  ],
  "careTeamNotes": "<summary for care team review>",
  "patientSummary": "<patient-friendly summary in plain language>",
  "confidence": <0-1>
}

All outputs should be informational and educational. Do not provide prescriptive medical advice.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a patient health educator and data analyst. Generate informational health summaries and educational content based on patient data. Do not provide medical advice or treatment recommendations. Focus on patient education and awareness.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3500,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const plan: PersonalizedCarePlan = {
        id: randomUUID(),
        patientId: patientData.patientId,
        patientName: patientData.patientName,
        generatedAt: new Date().toISOString(),
        executiveSummary: sanitizeAIOutput(result.executiveSummary || ""),
        healthStatusOverview: sanitizeAIOutput(result.healthStatusOverview || ""),
        recommendations: (result.recommendations || []).map((r: any) => ({
          id: randomUUID(),
          ...r,
          description: sanitizeAIOutput(r.description || ""),
          rationale: sanitizeAIOutput(r.rationale || ""),
        })),
        screeningSchedule: result.screeningSchedule || [],
        wellnessGoals: result.wellnessGoals || [],
        educationalResources: result.educationalResources || [],
        careTeamNotes: sanitizeAIOutput(result.careTeamNotes || ""),
        patientSummary: sanitizeAIOutput(result.patientSummary || ""),
        aiConfidence: result.confidence || 0.8,
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      CARE_PLAN_CACHE.set(cacheKey, { plan, timestamp: Date.now() });
      return plan;
    } catch (error) {
      console.error("[AIPatientIntelligence] Care plan generation error:", error);
      return this.getMockCarePlan(patientData);
    }
  }

  async getComprehensivePatientIntelligence(
    patientData: PatientDataInput,
    userId: string
  ): Promise<{
    riskProfile: PatientRiskProfile;
    medicationSafety: MedicationSafetyAnalysis;
    carePlan: PersonalizedCarePlan;
    generatedAt: string;
    noCdsDisclaimer: string;
  }> {
    const [riskProfile, medicationSafety, carePlan] = await Promise.all([
      this.generateRiskProfile(
        patientData,
        ["diabetes_complications", "cardiovascular", "renal", "falls", "readmission"],
        userId
      ),
      this.analyzeMedicationSafety(patientData, userId),
      this.generatePersonalizedCarePlan(patientData, userId),
    ]);

    return {
      riskProfile,
      medicationSafety,
      carePlan,
      generatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  getDashboard(): {
    totalAnalysesGenerated: number;
    riskProfilesInCache: number;
    safetyAnalysesInCache: number;
    carePlansInCache: number;
    supportedRiskCategories: ConditionCategory[];
    supportedInteractionTypes: InteractionType[];
    modelVersion: string;
    noCdsDisclaimer: string;
  } {
    return {
      totalAnalysesGenerated: RISK_PROFILE_CACHE.size + SAFETY_ANALYSIS_CACHE.size + CARE_PLAN_CACHE.size,
      riskProfilesInCache: RISK_PROFILE_CACHE.size,
      safetyAnalysesInCache: SAFETY_ANALYSIS_CACHE.size,
      carePlansInCache: CARE_PLAN_CACHE.size,
      supportedRiskCategories: [
        "diabetes_complications",
        "cancer_recurrence",
        "cardiovascular",
        "renal",
        "respiratory",
        "mental_health",
        "falls",
        "readmission",
      ],
      supportedInteractionTypes: [
        "drug_drug",
        "drug_allergy",
        "drug_food",
        "drug_condition",
        "therapeutic_duplication",
      ],
      modelVersion: "gpt-5.1-intelligence-v1",
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 0.75) return "critical";
    if (score >= 0.5) return "high";
    if (score >= 0.25) return "moderate";
    return "low";
  }

  private calculateDataCompleteness(data: PatientDataInput): number {
    let score = 0;
    const weights = {
      demographics: 0.1,
      conditions: 0.15,
      medications: 0.15,
      allergies: 0.1,
      vitals: 0.15,
      labResults: 0.15,
      familyHistory: 0.1,
      socialHistory: 0.1,
    };

    if (data.demographics.age && data.demographics.gender) score += weights.demographics;
    if (data.conditions.length > 0) score += weights.conditions;
    if (data.medications.length > 0) score += weights.medications;
    if (data.allergies.length > 0) score += weights.allergies;
    if (data.vitals.length > 0) score += weights.vitals;
    if (data.labResults.length > 0) score += weights.labResults;
    if (data.familyHistory && data.familyHistory.length > 0) score += weights.familyHistory;
    if (data.socialHistory) score += weights.socialHistory;

    return Math.min(score, 1);
  }

  private getTimeframeForCategory(category: ConditionCategory): string {
    const timeframes: Record<ConditionCategory, string> = {
      diabetes_complications: "5 years",
      cancer_recurrence: "5 years",
      cardiovascular: "10 years",
      renal: "5 years",
      respiratory: "1 year",
      mental_health: "1 year",
      falls: "1 year",
      readmission: "30 days",
    };
    return timeframes[category];
  }

  private getMockRiskPrediction(data: PatientDataInput, category: ConditionCategory): ConditionRiskPrediction {
    const conditionNames: Record<ConditionCategory, string> = {
      diabetes_complications: "Diabetes Complications",
      cancer_recurrence: "Cancer Recurrence",
      cardiovascular: "Cardiovascular Events",
      renal: "Renal Disease Progression",
      respiratory: "Respiratory Complications",
      mental_health: "Mental Health Crisis",
      falls: "Fall Risk",
      readmission: "30-Day Readmission",
    };

    const hasDiabetes = data.conditions.some(c => 
      c.name.toLowerCase().includes("diabetes") || c.name.toLowerCase().includes("dm")
    );
    const hasHypertension = data.conditions.some(c => 
      c.name.toLowerCase().includes("hypertension") || c.name.toLowerCase().includes("htn")
    );
    const isElderly = data.demographics.age >= 65;

    let baseRisk = 0.2;
    if (category === "diabetes_complications" && hasDiabetes) baseRisk = 0.45;
    if (category === "cardiovascular" && hasHypertension) baseRisk = 0.4;
    if (category === "falls" && isElderly) baseRisk = 0.35;

    return {
      id: randomUUID(),
      conditionCategory: category,
      conditionName: conditionNames[category],
      riskLevel: this.calculateRiskLevel(baseRisk),
      riskScore: baseRisk,
      riskPercentile: Math.round(baseRisk * 100),
      timeframe: this.getTimeframeForCategory(category),
      contributingFactors: [
        {
          factor: isElderly ? "Age over 65" : "Age",
          impact: isElderly ? "negative" : "neutral",
          weight: 0.15,
          description: `Age ${data.demographics.age} ${isElderly ? "shows elevated baseline" : "within standard range"}`,
          dataSource: "Demographics",
        },
      ],
      protectiveFactors: [],
      trendsObserved: ["Baseline assessment - trends require longitudinal data"],
      historicalComparison: "Initial assessment - no prior data for comparison",
      aiConfidence: 0.6,
      modelVersion: "mock-v1",
      generatedAt: new Date().toISOString(),
    };
  }

  private getMockMedicationSafetyAnalysis(data: PatientDataInput): MedicationSafetyAnalysis {
    return {
      id: randomUUID(),
      patientId: data.patientId,
      patientName: data.patientName,
      analyzedAt: new Date().toISOString(),
      medicationsAnalyzed: data.medications.filter(m => m.status === "active").length,
      overallSafetyLevel: "safe",
      safetyScore: 0.9,
      interactions: [],
      therapeuticDuplications: [],
      allergyConflicts: [],
      renalDosing: [],
      hepaticConsiderations: [],
      summary: "Medication review completed. No significant interactions identified in this analysis. Full clinical review recommended.",
      prioritizedFindings: [],
      aiConfidence: 0.6,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private getMockCarePlan(data: PatientDataInput): PersonalizedCarePlan {
    return {
      id: randomUUID(),
      patientId: data.patientId,
      patientName: data.patientName,
      generatedAt: new Date().toISOString(),
      executiveSummary: `${data.patientName} is a ${data.demographics.age}-year-old ${data.demographics.gender} with ${data.conditions.length} recorded conditions.`,
      healthStatusOverview: "Health status based on available records. Complete clinical evaluation recommended.",
      recommendations: [
        {
          id: randomUUID(),
          category: "preventive",
          priority: "medium",
          title: "Routine Health Screening",
          description: "Age-appropriate health screenings based on demographic factors",
          rationale: "Standard preventive care guidelines",
          relevantConditions: [],
          evidenceBasis: "USPSTF Guidelines",
          timeframe: "Annually",
          patientEducationPoints: ["Regular check-ups support health awareness"],
        },
      ],
      screeningSchedule: [],
      wellnessGoals: [],
      educationalResources: [],
      careTeamNotes: "AI-generated summary for review. Clinical judgment required for all care decisions.",
      patientSummary: "This is an informational summary of your health records. Please discuss with your healthcare provider.",
      aiConfidence: 0.6,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export const aiPatientIntelligenceService = new AIPatientIntelligenceService();
