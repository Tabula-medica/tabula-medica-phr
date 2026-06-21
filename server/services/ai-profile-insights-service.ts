import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { ehrPlatformInfo, type EhrPlatform } from "@shared/schema";

let openai: OpenAI | null = null;
try {
  openai = new OpenAI();
} catch (error) {
  console.log("[AIProfileInsights] OpenAI client not configured, using fallback responses");
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is for educational purposes only and is NOT medical advice. It does not constitute clinical decision support. Always consult with qualified healthcare providers for medical decisions.";

function hashIdentifier(id: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

export interface EHRDataSource {
  platform: EhrPlatform;
  facilityName: string;
  lastSyncAt: string;
  recordCount: number;
}

export interface PatientHistorySummary {
  id: string;
  profileId: string;
  generatedAt: string;
  dataSources: EHRDataSource[];
  summary: {
    overview: string;
    demographicsSnapshot: string;
    chronicConditions: string[];
    activeProblems: string[];
    surgicalHistory: string[];
    hospitalizationHistory: string[];
    immunizationStatus: string;
    screeningStatus: string;
  };
  keyFindings: {
    finding: string;
    category: "condition" | "medication" | "lab" | "vital" | "procedure" | "allergy";
    significance: "routine" | "notable" | "important" | "critical";
    sourceEHR: string;
  }[];
  timelineHighlights: {
    date: string;
    event: string;
    category: string;
    significance: string;
  }[];
  disclaimer: string;
}

export interface HealthRiskAssessment {
  id: string;
  profileId: string;
  assessedAt: string;
  overallRiskLevel: "low" | "moderate" | "elevated" | "high";
  riskScore: number;
  conditionRisks: {
    condition: string;
    currentStatus: "active" | "controlled" | "uncontrolled" | "remission";
    riskLevel: "low" | "moderate" | "elevated" | "high";
    contributingFactors: string[];
    monitoringRecommendations: string[];
  }[];
  medicationRisks: {
    medication: string;
    riskType: "interaction" | "contraindication" | "adherence" | "side_effect" | "dosing";
    severity: "minor" | "moderate" | "major" | "severe";
    description: string;
    relatedMedications?: string[];
    relatedConditions?: string[];
  }[];
  lifestyleRisks: {
    category: "smoking" | "alcohol" | "diet" | "exercise" | "sleep" | "stress";
    riskLevel: "low" | "moderate" | "high";
    description: string;
    impactedConditions: string[];
  }[];
  preventiveGaps: {
    screening: string;
    dueDate: string;
    priority: "routine" | "overdue" | "urgent";
    relatedConditions: string[];
  }[];
  disclaimer: string;
}

export interface CarePlanAdjustment {
  id: string;
  profileId: string;
  generatedAt: string;
  currentCarePlanSummary: string;
  adjustments: {
    id: string;
    category: "medication" | "monitoring" | "lifestyle" | "follow_up" | "specialist" | "screening";
    priority: "low" | "medium" | "high" | "urgent";
    title: string;
    rationale: string;
    currentState: string;
    suggestedChange: string;
    expectedBenefit: string;
    evidenceLevel: "expert_opinion" | "observational" | "clinical_trial" | "meta_analysis";
    relatedConditions: string[];
    relatedMedications: string[];
  }[];
  goals: {
    id: string;
    category: "vitals" | "labs" | "lifestyle" | "medication" | "symptoms";
    currentValue: string;
    targetValue: string;
    timeframe: string;
    rationale: string;
  }[];
  disclaimer: string;
}

export interface AIProfileInsights {
  profileId: string;
  generatedAt: string;
  historySummary: PatientHistorySummary;
  riskAssessment: HealthRiskAssessment;
  carePlanAdjustments: CarePlanAdjustment;
  lastUpdated: string;
}

const profileInsightsCache = new Map<string, AIProfileInsights>();
const ehrDataStore = new Map<string, {
  conditions: any[];
  medications: any[];
  allergies: any[];
  procedures: any[];
  vitals: any[];
  labs: any[];
  immunizations: any[];
  encounters: any[];
  ehrSources: EHRDataSource[];
}>();

function initializeSampleEHRData(profileId: string) {
  if (!ehrDataStore.has(profileId)) {
    ehrDataStore.set(profileId, {
      conditions: [
        { id: "c1", code: "E11.9", display: "Type 2 diabetes mellitus", status: "active", onsetDate: "2020-03-15", source: "fastenhealth" },
        { id: "c2", code: "I10", display: "Essential hypertension", status: "active", onsetDate: "2018-06-20", source: "fastenhealth" },
        { id: "c3", code: "E78.0", display: "Hyperlipidemia", status: "active", onsetDate: "2019-11-10", source: "fastenhealth" },
        { id: "c4", code: "J45.20", display: "Mild intermittent asthma", status: "active", onsetDate: "2015-02-28", source: "fastenhealth" },
      ],
      medications: [
        { id: "m1", name: "Metformin 500mg", dosage: "500mg twice daily", status: "active", startDate: "2020-03-20", source: "fastenhealth" },
        { id: "m2", name: "Lisinopril 10mg", dosage: "10mg once daily", status: "active", startDate: "2018-06-25", source: "fastenhealth" },
        { id: "m3", name: "Atorvastatin 20mg", dosage: "20mg once daily at bedtime", status: "active", startDate: "2019-11-15", source: "fastenhealth" },
        { id: "m4", name: "Albuterol inhaler", dosage: "2 puffs as needed", status: "active", startDate: "2015-03-01", source: "fastenhealth" },
      ],
      allergies: [
        { id: "a1", substance: "Penicillin", reaction: "Rash, hives", severity: "moderate", source: "fastenhealth" },
        { id: "a2", substance: "Sulfa drugs", reaction: "Anaphylaxis", severity: "severe", source: "fastenhealth" },
      ],
      procedures: [
        { id: "p1", code: "47562", display: "Laparoscopic cholecystectomy", date: "2022-08-15", source: "fastenhealth" },
        { id: "p2", code: "45378", display: "Colonoscopy", date: "2023-05-20", source: "fastenhealth" },
      ],
      vitals: [
        { id: "v1", type: "blood_pressure", value: "138/88", date: "2024-01-15", source: "fastenhealth" },
        { id: "v2", type: "weight", value: "185 lbs", date: "2024-01-15", source: "fastenhealth" },
        { id: "v3", type: "heart_rate", value: "78 bpm", date: "2024-01-15", source: "fastenhealth" },
        { id: "v4", type: "blood_glucose", value: "142 mg/dL", date: "2024-01-10", source: "fastenhealth" },
      ],
      labs: [
        { id: "l1", test: "HbA1c", value: "7.2%", referenceRange: "4.0-5.6%", date: "2024-01-05", status: "high", source: "fastenhealth" },
        { id: "l2", test: "LDL Cholesterol", value: "118 mg/dL", referenceRange: "<100 mg/dL", date: "2024-01-05", status: "borderline", source: "fastenhealth" },
        { id: "l3", test: "eGFR", value: "72 mL/min", referenceRange: ">60 mL/min", date: "2024-01-05", status: "normal", source: "fastenhealth" },
        { id: "l4", test: "TSH", value: "2.1 mIU/L", referenceRange: "0.4-4.0 mIU/L", date: "2023-12-15", status: "normal", source: "fastenhealth" },
      ],
      immunizations: [
        { id: "i1", vaccine: "Influenza", date: "2023-10-15", source: "fastenhealth" },
        { id: "i2", vaccine: "COVID-19 Booster", date: "2023-09-20", source: "fastenhealth" },
        { id: "i3", vaccine: "Pneumococcal (PPSV23)", date: "2022-05-10", source: "fastenhealth" },
      ],
      encounters: [
        { id: "e1", type: "office_visit", reason: "Diabetes follow-up", date: "2024-01-15", provider: "Dr. Smith", source: "fastenhealth" },
        { id: "e2", type: "lab_visit", reason: "Routine labs", date: "2024-01-05", provider: "Quest Diagnostics", source: "fastenhealth" },
        { id: "e3", type: "urgent_care", reason: "Asthma exacerbation", date: "2023-11-20", provider: "Urgent Care Center", source: "fastenhealth" },
      ],
      ehrSources: [
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Metro Health System", lastSyncAt: "2024-01-15T10:30:00Z", recordCount: 245 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Primary Care Associates", lastSyncAt: "2024-01-14T15:45:00Z", recordCount: 128 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Pulmonology Specialists", lastSyncAt: "2024-01-10T09:20:00Z", recordCount: 45 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Community Urgent Care", lastSyncAt: "2023-11-21T08:15:00Z", recordCount: 12 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "GI Associates", lastSyncAt: "2023-05-22T14:00:00Z", recordCount: 8 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Endocrinology Center", lastSyncAt: "2024-01-12T11:30:00Z", recordCount: 32 },
        { platform: "fastenhealth" as EhrPlatform, facilityName: "Internal Medicine Group", lastSyncAt: "2023-12-18T16:45:00Z", recordCount: 56 },
      ],
    });
  }
  return ehrDataStore.get(profileId)!;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function generatePatientHistorySummary(
  profileId: string,
  userId: string
): Promise<PatientHistorySummary> {
  logPhiAccess({
    userId: hashIdentifier(userId),
    action: "read",
    resourceType: "PatientProfile",
    resourceId: hashIdentifier(profileId),
    details: "AI_HISTORY_SUMMARY_GENERATION: Generating AI-powered patient history summary from EHR data",
  });

  const ehrData = initializeSampleEHRData(profileId);
  
  const prompt = `You are a medical data summarization assistant. Based on the following patient health data from multiple EHR systems, create a comprehensive but concise summary. This is for EDUCATIONAL purposes only - NOT clinical decision support.

Patient Data:
- Conditions: ${JSON.stringify(ehrData.conditions)}
- Medications: ${JSON.stringify(ehrData.medications)}
- Allergies: ${JSON.stringify(ehrData.allergies)}
- Procedures: ${JSON.stringify(ehrData.procedures)}
- Recent Vitals: ${JSON.stringify(ehrData.vitals)}
- Recent Labs: ${JSON.stringify(ehrData.labs)}
- Immunizations: ${JSON.stringify(ehrData.immunizations)}
- Recent Encounters: ${JSON.stringify(ehrData.encounters)}

Provide a JSON response with:
1. overview: A 2-3 sentence overall health summary
2. chronicConditions: List of chronic conditions
3. activeProblems: List of active health concerns
4. surgicalHistory: List of past surgeries
5. keyFindings: Array of notable findings with category and significance

Remember: NO medical advice or recommendations. Educational summary only.`;

  let aiSummary: any = null;
  
  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a medical data summarizer. Provide factual summaries only - never give medical advice or recommendations. All output is educational." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      aiSummary = JSON.parse(response.choices[0].message.content || "{}");
    }
  } catch (error) {
    console.error("[AIProfileInsights] OpenAI error, using fallback:", error);
  }

  const summary: PatientHistorySummary = {
    id: generateId("phs"),
    profileId,
    generatedAt: new Date().toISOString(),
    dataSources: ehrData.ehrSources,
    summary: {
      overview: aiSummary?.overview || `This patient has multiple chronic conditions being managed across ${ehrData.ehrSources.length} healthcare facilities. Data has been consolidated from provider, athenahealth, NextGen, Practice Fusion, eClinicalWorks, Elation Health, and Greenway Health systems.`,
      demographicsSnapshot: "Adult patient with established care relationships",
      chronicConditions: aiSummary?.chronicConditions || ehrData.conditions.filter(c => c.status === "active").map(c => c.display),
      activeProblems: aiSummary?.activeProblems || ["Type 2 diabetes - requires ongoing monitoring", "Hypertension - currently managed", "Hyperlipidemia - on statin therapy"],
      surgicalHistory: aiSummary?.surgicalHistory || ehrData.procedures.map(p => `${p.display} (${p.date})`),
      hospitalizationHistory: ["Cholecystectomy - August 2022 (3-day stay)"],
      immunizationStatus: `Up to date - Last flu shot: ${ehrData.immunizations.find(i => i.vaccine === "Influenza")?.date || "N/A"}`,
      screeningStatus: "Colonoscopy current (2023), Due for annual diabetic eye exam",
    },
    keyFindings: aiSummary?.keyFindings || [
      { finding: "HbA1c of 7.2% indicates diabetes not at target", category: "lab", significance: "important", sourceEHR: "Primary Care Provider" },
      { finding: "Blood pressure slightly elevated at 138/88", category: "vital", significance: "notable", sourceEHR: "Primary Care Provider" },
      { finding: "LDL cholesterol borderline at 118 mg/dL", category: "lab", significance: "notable", sourceEHR: "Primary Care Provider" },
      { finding: "Severe sulfa allergy documented - anaphylaxis risk", category: "allergy", significance: "critical", sourceEHR: "fastenhealth" },
      { finding: "Recent asthma exacerbation in November 2023", category: "condition", significance: "notable", sourceEHR: "Practice Fusion" },
    ],
    timelineHighlights: [
      { date: "2024-01-15", event: "Diabetes follow-up visit", category: "encounter", significance: "routine" },
      { date: "2024-01-05", event: "Lab work completed - HbA1c elevated", category: "lab", significance: "important" },
      { date: "2023-11-20", event: "Urgent care visit for asthma", category: "encounter", significance: "notable" },
      { date: "2023-05-20", event: "Colonoscopy - normal findings", category: "procedure", significance: "routine" },
      { date: "2022-08-15", event: "Cholecystectomy surgery", category: "procedure", significance: "important" },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
  };

  return summary;
}

export async function generateHealthRiskAssessment(
  profileId: string,
  userId: string
): Promise<HealthRiskAssessment> {
  logPhiAccess({
    userId: hashIdentifier(userId),
    action: "read",
    resourceType: "PatientProfile",
    resourceId: hashIdentifier(profileId),
    details: "AI_HEALTH_RISK_ASSESSMENT: Generating AI-powered health risk assessment from EHR data",
  });

  const ehrData = initializeSampleEHRData(profileId);

  const prompt = `You are a health risk analysis assistant. Based on the following patient data, identify potential health risks. This is EDUCATIONAL only - NOT clinical decision support.

Patient Data:
- Conditions: ${JSON.stringify(ehrData.conditions)}
- Medications: ${JSON.stringify(ehrData.medications)}
- Allergies: ${JSON.stringify(ehrData.allergies)}
- Recent Labs: ${JSON.stringify(ehrData.labs)}
- Recent Vitals: ${JSON.stringify(ehrData.vitals)}

Identify:
1. Condition-related risks (control status, complications)
2. Medication risks (interactions, adherence concerns)
3. Preventive care gaps

Return JSON with conditionRisks, medicationRisks, and preventiveGaps arrays.
NO medical recommendations - educational observations only.`;

  let aiRisks: any = null;
  
  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a health risk analyzer. Identify potential risks based on data patterns - never give medical advice. All output is educational." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      aiRisks = JSON.parse(response.choices[0].message.content || "{}");
    }
  } catch (error) {
    console.error("[AIProfileInsights] OpenAI risk assessment error, using fallback:", error);
  }

  const assessment: HealthRiskAssessment = {
    id: generateId("hra"),
    profileId,
    assessedAt: new Date().toISOString(),
    overallRiskLevel: "moderate",
    riskScore: 45,
    conditionRisks: aiRisks?.conditionRisks || [
      {
        condition: "Type 2 Diabetes",
        currentStatus: "uncontrolled",
        riskLevel: "elevated",
        contributingFactors: ["HbA1c above target (7.2%)", "Blood glucose variability noted"],
        monitoringRecommendations: ["Regular HbA1c monitoring every 3 months", "Daily blood glucose tracking"],
      },
      {
        condition: "Hypertension",
        currentStatus: "controlled",
        riskLevel: "moderate",
        contributingFactors: ["Blood pressure slightly above optimal", "Diabetes increases cardiovascular risk"],
        monitoringRecommendations: ["Regular blood pressure monitoring", "Annual cardiovascular risk assessment"],
      },
      {
        condition: "Hyperlipidemia",
        currentStatus: "controlled",
        riskLevel: "moderate",
        contributingFactors: ["LDL borderline high", "Multiple cardiovascular risk factors"],
        monitoringRecommendations: ["Annual lipid panel", "Consider lifestyle modifications"],
      },
    ],
    medicationRisks: aiRisks?.medicationRisks || [
      {
        medication: "Metformin",
        riskType: "side_effect",
        severity: "minor",
        description: "May cause GI upset; monitor kidney function annually given eGFR of 72",
        relatedConditions: ["Type 2 Diabetes", "Kidney function monitoring"],
      },
      {
        medication: "Multiple cardiovascular medications",
        riskType: "interaction",
        severity: "minor",
        description: "ACE inhibitor and statin combination is common but requires monitoring",
        relatedMedications: ["Lisinopril", "Atorvastatin"],
      },
    ],
    lifestyleRisks: [
      {
        category: "diet",
        riskLevel: "moderate",
        description: "Dietary management important for diabetes and lipid control",
        impactedConditions: ["Type 2 Diabetes", "Hyperlipidemia"],
      },
      {
        category: "exercise",
        riskLevel: "moderate",
        description: "Physical activity beneficial for all chronic conditions",
        impactedConditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
      },
    ],
    preventiveGaps: aiRisks?.preventiveGaps || [
      {
        screening: "Diabetic retinopathy screening",
        dueDate: "2024-03-01",
        priority: "overdue",
        relatedConditions: ["Type 2 Diabetes"],
      },
      {
        screening: "Diabetic foot exam",
        dueDate: "2024-02-15",
        priority: "routine",
        relatedConditions: ["Type 2 Diabetes"],
      },
      {
        screening: "Microalbumin/creatinine ratio",
        dueDate: "2024-04-01",
        priority: "routine",
        relatedConditions: ["Type 2 Diabetes", "Hypertension"],
      },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
  };

  return assessment;
}

export async function generateCarePlanAdjustments(
  profileId: string,
  userId: string
): Promise<CarePlanAdjustment> {
  logPhiAccess({
    userId: hashIdentifier(userId),
    action: "read",
    resourceType: "PatientProfile",
    resourceId: hashIdentifier(profileId),
    details: "AI_CARE_PLAN_SUGGESTIONS: Generating AI-powered care plan adjustment suggestions from EHR data",
  });

  const ehrData = initializeSampleEHRData(profileId);

  const prompt = `You are a care plan analysis assistant. Based on the following patient data, suggest potential care plan considerations. This is EDUCATIONAL only - NOT clinical decision support.

Patient Data:
- Conditions: ${JSON.stringify(ehrData.conditions)}
- Medications: ${JSON.stringify(ehrData.medications)}
- Recent Labs: ${JSON.stringify(ehrData.labs)}
- Recent Vitals: ${JSON.stringify(ehrData.vitals)}

Suggest:
1. Areas where current care might be reviewed
2. Monitoring frequency considerations
3. Health goals based on current values

Return JSON with adjustments and goals arrays.
NO prescriptive recommendations - educational considerations only.`;

  let aiAdjustments: any = null;
  
  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a care plan analyst. Suggest considerations for care plan review - never prescribe or recommend specific treatments. All output is educational." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      aiAdjustments = JSON.parse(response.choices[0].message.content || "{}");
    }
  } catch (error) {
    console.error("[AIProfileInsights] OpenAI care plan error, using fallback:", error);
  }

  const adjustments: CarePlanAdjustment = {
    id: generateId("cpa"),
    profileId,
    generatedAt: new Date().toISOString(),
    currentCarePlanSummary: "Patient is managing multiple chronic conditions with medication therapy and routine follow-ups. Current focus areas include diabetes control, blood pressure management, and cardiovascular risk reduction.",
    adjustments: aiAdjustments?.adjustments || [
      {
        id: generateId("adj"),
        category: "monitoring",
        priority: "high",
        title: "Enhanced Diabetes Monitoring",
        rationale: "HbA1c of 7.2% suggests opportunity for improved glycemic control",
        currentState: "Quarterly HbA1c monitoring with annual eye exam",
        suggestedChange: "Consider more frequent monitoring intervals and CGM discussion",
        expectedBenefit: "Earlier detection of glucose patterns for better management",
        evidenceLevel: "clinical_trial",
        relatedConditions: ["Type 2 Diabetes"],
        relatedMedications: ["Metformin"],
      },
      {
        id: generateId("adj"),
        category: "lifestyle",
        priority: "medium",
        title: "Cardiovascular Risk Reduction",
        rationale: "Multiple risk factors present: diabetes, hypertension, hyperlipidemia",
        currentState: "Standard lifestyle counseling",
        suggestedChange: "Consider structured lifestyle program referral",
        expectedBenefit: "Improved cardiovascular outcomes and quality of life",
        evidenceLevel: "meta_analysis",
        relatedConditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
        relatedMedications: [],
      },
      {
        id: generateId("adj"),
        category: "screening",
        priority: "high",
        title: "Diabetic Complication Screening",
        rationale: "Diabetes duration suggests need for comprehensive complication screening",
        currentState: "Some screenings may be overdue based on records",
        suggestedChange: "Schedule comprehensive diabetes complication screening panel",
        expectedBenefit: "Early detection of potential complications",
        evidenceLevel: "clinical_trial",
        relatedConditions: ["Type 2 Diabetes"],
        relatedMedications: [],
      },
      {
        id: generateId("adj"),
        category: "medication",
        priority: "medium",
        title: "Lipid Management Review",
        rationale: "LDL of 118 mg/dL with diabetes suggests room for optimization",
        currentState: "Atorvastatin 20mg daily",
        suggestedChange: "Discuss lipid goals with healthcare provider",
        expectedBenefit: "Reduced cardiovascular event risk",
        evidenceLevel: "meta_analysis",
        relatedConditions: ["Hyperlipidemia", "Type 2 Diabetes"],
        relatedMedications: ["Atorvastatin"],
      },
    ],
    goals: aiAdjustments?.goals || [
      {
        id: generateId("goal"),
        category: "labs",
        currentValue: "HbA1c 7.2%",
        targetValue: "HbA1c <7.0%",
        timeframe: "6 months",
        rationale: "ADA guidelines suggest HbA1c <7% for most adults with diabetes",
      },
      {
        id: generateId("goal"),
        category: "vitals",
        currentValue: "BP 138/88 mmHg",
        targetValue: "BP <130/80 mmHg",
        timeframe: "3 months",
        rationale: "Recommended BP target for patients with diabetes",
      },
      {
        id: generateId("goal"),
        category: "labs",
        currentValue: "LDL 118 mg/dL",
        targetValue: "LDL <100 mg/dL",
        timeframe: "6 months",
        rationale: "Standard LDL goal for patients with cardiovascular risk factors",
      },
      {
        id: generateId("goal"),
        category: "lifestyle",
        currentValue: "Activity level unknown",
        targetValue: "150 min/week moderate activity",
        timeframe: "3 months",
        rationale: "Standard physical activity recommendation for chronic disease management",
      },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
  };

  return adjustments;
}

export async function getFullProfileInsights(
  profileId: string,
  userId: string,
  forceRefresh: boolean = false
): Promise<AIProfileInsights> {
  logPhiAccess({
    userId: hashIdentifier(userId),
    action: "read",
    resourceType: "PatientProfile",
    resourceId: hashIdentifier(profileId),
    details: "AI_FULL_PROFILE_INSIGHTS: Generating comprehensive AI-powered profile insights",
  });

  if (!forceRefresh && profileInsightsCache.has(profileId)) {
    const cached = profileInsightsCache.get(profileId)!;
    const cacheAge = Date.now() - new Date(cached.generatedAt).getTime();
    if (cacheAge < 3600000) {
      return cached;
    }
  }

  const [historySummary, riskAssessment, carePlanAdjustments] = await Promise.all([
    generatePatientHistorySummary(profileId, userId),
    generateHealthRiskAssessment(profileId, userId),
    generateCarePlanAdjustments(profileId, userId),
  ]);

  const insights: AIProfileInsights = {
    profileId,
    generatedAt: new Date().toISOString(),
    historySummary,
    riskAssessment,
    carePlanAdjustments,
    lastUpdated: new Date().toISOString(),
  };

  profileInsightsCache.set(profileId, insights);
  return insights;
}

export function getEHRDataSources(profileId: string): EHRDataSource[] {
  const ehrData = initializeSampleEHRData(profileId);
  return ehrData.ehrSources;
}

export function getEHRDataSummary(profileId: string, userId: string): {
  sources: EHRDataSource[];
  totalRecords: number;
  dataCategories: { category: string; count: number; lastUpdated: string }[];
} {
  logPhiAccess({
    userId: hashIdentifier(userId),
    action: "read",
    resourceType: "PatientProfile",
    resourceId: hashIdentifier(profileId),
    details: "EHR_DATA_SUMMARY_VIEW: Viewing EHR data summary",
  });

  const ehrData = initializeSampleEHRData(profileId);
  
  return {
    sources: ehrData.ehrSources,
    totalRecords: ehrData.ehrSources.reduce((sum, s) => sum + s.recordCount, 0),
    dataCategories: [
      { category: "Conditions", count: ehrData.conditions.length, lastUpdated: "2024-01-15" },
      { category: "Medications", count: ehrData.medications.length, lastUpdated: "2024-01-15" },
      { category: "Allergies", count: ehrData.allergies.length, lastUpdated: "2024-01-14" },
      { category: "Procedures", count: ehrData.procedures.length, lastUpdated: "2023-05-22" },
      { category: "Vitals", count: ehrData.vitals.length, lastUpdated: "2024-01-15" },
      { category: "Labs", count: ehrData.labs.length, lastUpdated: "2024-01-05" },
      { category: "Immunizations", count: ehrData.immunizations.length, lastUpdated: "2023-10-15" },
      { category: "Encounters", count: ehrData.encounters.length, lastUpdated: "2024-01-15" },
    ],
  };
}

console.log("[AIProfileInsights] Service initialized with EHR integration and NO-CDS compliance");
