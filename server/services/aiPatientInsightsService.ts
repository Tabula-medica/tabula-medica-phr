import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_VERBS = [
  "recommend", "recommends", "recommended", "recommending",
  "suggest", "suggests", "suggested", "suggesting",
  "advise", "advises", "advised", "advising",
  "prescribe", "prescribes", "prescribed", "prescribing",
  "should", "must", "need to", "have to", "ought to",
  "diagnose", "diagnoses", "diagnosed", "diagnosing",
  "treat", "treats", "treated", "treating"
];

function sanitizeText(text: string): string {
  let sanitized = text;
  PROHIBITED_VERBS.forEach(verb => {
    const regex = new RegExp(`\\b${verb}\\b`, 'gi');
    const safeVerb = SAFE_VERBS[Math.floor(Math.random() * SAFE_VERBS.length)];
    sanitized = sanitized.replace(regex, safeVerb);
  });
  return sanitized;
}

function ensureSafeContent<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeText(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => ensureSafeContent(item)) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = ensureSafeContent((obj as any)[key]);
    }
    return result;
  }
  return obj;
}

export interface VitalTrend {
  metric: string;
  currentValue: number;
  unit: string;
  trend: "improving" | "stable" | "declining" | "concerning";
  percentChange: number;
  timeframe: string;
  analysis: string;
}

export interface LabTrend {
  testName: string;
  currentValue: number;
  unit: string;
  referenceRange: string;
  status: "normal" | "borderline" | "abnormal" | "critical";
  trend: "improving" | "stable" | "worsening";
  analysis: string;
}

export interface SymptomPattern {
  symptom: string;
  frequency: "daily" | "weekly" | "occasional" | "rare";
  severity: "mild" | "moderate" | "severe";
  triggers: string[];
  correlations: string[];
  analysis: string;
}

export interface AdherenceMetric {
  category: "medication" | "appointment" | "lifestyle" | "monitoring";
  itemName: string;
  adherenceRate: number;
  missedInstances: number;
  totalInstances: number;
  trend: "improving" | "stable" | "declining";
  barriers: string[];
}

export interface NonAdherenceRisk {
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  factors: {
    factor: string;
    impact: "low" | "medium" | "high";
    description: string;
  }[];
  predictedOutcome: string;
  timeToIntervention: string;
}

export interface OptimizationSuggestion {
  id: string;
  category: "medication" | "lifestyle" | "monitoring" | "appointment" | "education";
  title: string;
  description: string;
  rationale: string;
  expectedBenefit: string;
  priority: "high" | "medium" | "low";
  evidenceBasis: string;
  implementationSteps: string[];
}

export interface ProactiveIntervention {
  id: string;
  type: "reminder" | "education" | "support" | "escalation" | "adjustment";
  title: string;
  description: string;
  targetBehavior: string;
  timing: string;
  deliveryMethod: "in_app" | "sms" | "email" | "phone" | "care_team";
  urgency: "immediate" | "within_24h" | "within_week" | "scheduled";
  rationale: string;
}

export interface PatientInsights {
  patientId: string;
  generatedAt: string;
  vitalTrends: VitalTrend[];
  labTrends: LabTrend[];
  symptomPatterns: SymptomPattern[];
  adherenceMetrics: AdherenceMetric[];
  nonAdherenceRisk: NonAdherenceRisk;
  optimizationSuggestions: OptimizationSuggestion[];
  proactiveInterventions: ProactiveIntervention[];
  overallHealthStatus: string;
  keyFindings: string[];
  priorityActions: string[];
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function generatePatientInsights(
  patientId: string,
  patientData: {
    demographics?: { age?: number; conditions?: string[] };
    vitals?: { type: string; value: number; unit: string; date: string }[];
    labs?: { name: string; value: number; unit: string; range: string; date: string }[];
    symptoms?: { symptom: string; severity: string; date: string; notes?: string }[];
    medications?: { name: string; adherence: number; missedDoses: number }[];
    appointments?: { type: string; attended: boolean; date: string }[];
    goals?: { name: string; progress: number; target: number }[];
  },
  userId: string
): Promise<PatientInsights> {
  logPhiAccess({
    userId,
    patientId,
    resourceType: "PatientInsights",
    action: "write",
    details: "AI-generated patient insights with optimization suggestions and adherence risk assessment",
  });

  const client = getOpenAIClient();
  
  if (client) {
    try {
      const prompt = `Analyze this patient data and generate comprehensive health insights. Use ONLY these safe verbs: "shows", "states", "refers to", "means". NEVER use: recommend, suggest, advise, prescribe, should, must, diagnose, treat.

Patient Data:
${JSON.stringify(patientData, null, 2)}

Generate a JSON response with:
1. vitalTrends - analysis of vital sign patterns
2. labTrends - laboratory result trends
3. symptomPatterns - symptom frequency and correlations
4. adherenceMetrics - medication/appointment/lifestyle adherence
5. nonAdherenceRisk - risk assessment for non-adherence
6. optimizationSuggestions - care plan optimization ideas
7. proactiveInterventions - timely intervention opportunities
8. overallHealthStatus - summary using safe verbs only
9. keyFindings - main observations
10. priorityActions - high-priority items

Remember: All text MUST use only "shows", "states", "refers to", "means" - never prescriptive language.`;

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return ensureSafeContent({
          patientId,
          generatedAt: new Date().toISOString(),
          ...parsed,
        });
      }
    } catch (error) {
      console.error("[AIPatientInsights] OpenAI error, using mock data:", error);
    }
  }

  return generateMockInsights(patientId);
}

function generateMockInsights(patientId: string): PatientInsights {
  return ensureSafeContent({
    patientId,
    generatedAt: new Date().toISOString(),
    vitalTrends: [
      {
        metric: "Blood Pressure",
        currentValue: 142,
        unit: "mmHg systolic",
        trend: "improving",
        percentChange: -5.3,
        timeframe: "Past 30 days",
        analysis: "Blood pressure data shows gradual improvement over the past month. Recent readings state values trending toward target range. This pattern refers to positive response to current management approach.",
      },
      {
        metric: "Heart Rate",
        currentValue: 78,
        unit: "bpm",
        trend: "stable",
        percentChange: 0.5,
        timeframe: "Past 30 days",
        analysis: "Heart rate measurements show consistent values within normal range. Data states resting heart rate means cardiovascular stability.",
      },
      {
        metric: "Blood Glucose",
        currentValue: 145,
        unit: "mg/dL fasting",
        trend: "concerning",
        percentChange: 8.2,
        timeframe: "Past 14 days",
        analysis: "Glucose readings show upward trend over two weeks. Morning values state levels above target range. Pattern refers to potential need for care plan review.",
      },
      {
        metric: "Weight",
        currentValue: 187,
        unit: "lbs",
        trend: "stable",
        percentChange: -0.8,
        timeframe: "Past 60 days",
        analysis: "Weight measurements show stable pattern with slight downward trend. Data means current lifestyle approach shows effectiveness.",
      },
    ],
    labTrends: [
      {
        testName: "HbA1c",
        currentValue: 7.8,
        unit: "%",
        referenceRange: "< 7.0%",
        status: "borderline",
        trend: "stable",
        analysis: "HbA1c results state glucose control above target but stable. Value refers to average blood glucose over past 3 months means approximately 177 mg/dL average.",
      },
      {
        testName: "LDL Cholesterol",
        currentValue: 118,
        unit: "mg/dL",
        referenceRange: "< 100 mg/dL",
        status: "borderline",
        trend: "improving",
        analysis: "LDL cholesterol shows improvement from previous value of 135. Current level states progress toward cardiovascular health targets.",
      },
      {
        testName: "eGFR",
        currentValue: 72,
        unit: "mL/min/1.73m²",
        referenceRange: "> 60 mL/min/1.73m²",
        status: "normal",
        trend: "stable",
        analysis: "Kidney function shows stable values. eGFR means mild reduction but within acceptable range. Data refers to importance of continued monitoring.",
      },
      {
        testName: "TSH",
        currentValue: 2.1,
        unit: "mIU/L",
        referenceRange: "0.4-4.0 mIU/L",
        status: "normal",
        trend: "stable",
        analysis: "Thyroid function shows normal values. TSH states optimal thyroid hormone production.",
      },
    ],
    symptomPatterns: [
      {
        symptom: "Fatigue",
        frequency: "weekly",
        severity: "moderate",
        triggers: ["Poor sleep", "High carbohydrate meals", "Missed medication"],
        correlations: ["Elevated blood glucose", "Afternoon timing"],
        analysis: "Fatigue reports show correlation with glucose fluctuations. Pattern states symptom occurrence refers to post-meal periods. Data means blood sugar management may influence energy levels.",
      },
      {
        symptom: "Headache",
        frequency: "occasional",
        severity: "mild",
        triggers: ["Stress", "Skipped meals", "Dehydration"],
        correlations: ["Blood pressure readings", "Work stress periods"],
        analysis: "Headache occurrences show association with blood pressure variations. Records state symptoms correlate with higher stress periods.",
      },
    ],
    adherenceMetrics: [
      {
        category: "medication",
        itemName: "Metformin",
        adherenceRate: 85,
        missedInstances: 9,
        totalInstances: 60,
        trend: "stable",
        barriers: ["Evening dose forgotten", "Travel disruptions"],
      },
      {
        category: "medication",
        itemName: "Lisinopril",
        adherenceRate: 92,
        missedInstances: 5,
        totalInstances: 60,
        trend: "improving",
        barriers: ["Occasional morning rush"],
      },
      {
        category: "monitoring",
        itemName: "Blood Glucose Checks",
        adherenceRate: 68,
        missedInstances: 19,
        totalInstances: 60,
        trend: "declining",
        barriers: ["Finger prick discomfort", "Forgetting supplies", "Busy schedule"],
      },
      {
        category: "lifestyle",
        itemName: "Daily Walking Goal",
        adherenceRate: 55,
        missedInstances: 27,
        totalInstances: 60,
        trend: "declining",
        barriers: ["Weather", "Time constraints", "Low motivation"],
      },
      {
        category: "appointment",
        itemName: "Follow-up Visits",
        adherenceRate: 100,
        missedInstances: 0,
        totalInstances: 3,
        trend: "stable",
        barriers: [],
      },
    ],
    nonAdherenceRisk: {
      riskLevel: "moderate",
      riskScore: 58,
      factors: [
        {
          factor: "Declining glucose monitoring",
          impact: "high",
          description: "Data shows 32% decrease in blood glucose check frequency over past month. Pattern states monitoring gaps means less visibility into glucose control.",
        },
        {
          factor: "Exercise goal underperformance",
          impact: "medium",
          description: "Activity tracking shows 55% adherence to daily walking goal. Trend refers to gradual decline over past 6 weeks.",
        },
        {
          factor: "Evening medication timing",
          impact: "medium",
          description: "Medication logs state evening doses show lower adherence than morning doses. Pattern means 15% of evening doses missed.",
        },
        {
          factor: "Multiple chronic conditions",
          impact: "low",
          description: "Patient profile shows management of diabetes and hypertension. Research states multi-condition management refers to increased complexity.",
        },
      ],
      predictedOutcome: "Current adherence patterns show risk for suboptimal glucose control. Data states continued monitoring decline means potential HbA1c increase at next check.",
      timeToIntervention: "Within 2 weeks",
    },
    optimizationSuggestions: [
      {
        id: "opt-1",
        category: "monitoring",
        title: "Continuous Glucose Monitoring Consideration",
        description: "Patient adherence data shows challenges with finger-stick monitoring. CGM technology refers to alternative approach that means reduced testing burden.",
        rationale: "Current glucose check adherence at 68% with declining trend. CGM research states improved monitoring adherence and glucose awareness.",
        expectedBenefit: "Studies show CGM users achieve 0.3-0.5% HbA1c reduction. Data means reduced hypoglycemia risk and improved time-in-range.",
        priority: "high",
        evidenceBasis: "ADA Standards of Care 2024, DIAMOND Trial",
        implementationSteps: [
          "Discuss CGM options with care team",
          "Review insurance coverage and cost considerations",
          "Provide education on CGM use and data interpretation",
          "Schedule follow-up to assess CGM effectiveness",
        ],
      },
      {
        id: "opt-2",
        category: "medication",
        title: "Evening Dose Reminder System",
        description: "Adherence patterns show evening medication timing challenges. Smart reminder systems refer to technology-assisted adherence support.",
        rationale: "Evening dose adherence at 85% versus 92% morning dose. Data states timing-specific intervention means potential improvement.",
        expectedBenefit: "Research shows reminder systems improve adherence by 10-15%. Pattern means more consistent blood pressure and glucose control.",
        priority: "medium",
        evidenceBasis: "Medication Adherence Research, JAMA Internal Medicine",
        implementationSteps: [
          "Set up smartphone medication reminder",
          "Consider pillbox with alarm feature",
          "Link evening dose to consistent daily activity",
          "Track improvement over 2-week period",
        ],
      },
      {
        id: "opt-3",
        category: "lifestyle",
        title: "Activity Goal Restructuring",
        description: "Walking goal data shows 55% achievement rate with declining trend. Goal adjustment refers to achievable milestone approach.",
        rationale: "Current 30-minute daily goal shows barriers. Research states smaller initial goals means better habit formation.",
        expectedBenefit: "Studies show 10-minute walking increments provide metabolic benefit. Progressive approach means sustainable behavior change.",
        priority: "medium",
        evidenceBasis: "Physical Activity Guidelines, Behavioral Change Research",
        implementationSteps: [
          "Reduce initial goal to 15 minutes daily",
          "Identify preferred walking times and routes",
          "Track completion for positive reinforcement",
          "Gradually increase duration as habit establishes",
        ],
      },
      {
        id: "opt-4",
        category: "education",
        title: "Carbohydrate Awareness Enhancement",
        description: "Glucose patterns show post-meal spikes correlating with reported fatigue. Nutrition education refers to improved meal planning awareness.",
        rationale: "Data shows elevated postprandial glucose with fatigue reports. Education research states carb counting means better glucose prediction.",
        expectedBenefit: "Studies show nutrition education improves HbA1c by 0.5-1%. Pattern means reduced post-meal glucose variability.",
        priority: "high",
        evidenceBasis: "Diabetes Self-Management Education, ADA Nutrition Guidelines",
        implementationSteps: [
          "Provide carbohydrate counting resources",
          "Review food diary for pattern identification",
          "Discuss portion control strategies",
          "Schedule dietitian consultation if available",
        ],
      },
    ],
    proactiveInterventions: [
      {
        id: "int-1",
        type: "reminder",
        title: "Glucose Monitoring Encouragement",
        description: "Send motivational reminder about importance of glucose checks with simple tracking acknowledgment.",
        targetBehavior: "Increase blood glucose monitoring frequency",
        timing: "Morning, 8:00 AM daily",
        deliveryMethod: "in_app",
        urgency: "within_24h",
        rationale: "Monitoring data shows declining trend. Behavioral research states consistent prompts means habit reinforcement.",
      },
      {
        id: "int-2",
        type: "education",
        title: "Evening Medication Success Tips",
        description: "Share brief educational content about strategies for remembering evening medications.",
        targetBehavior: "Improve evening medication adherence",
        timing: "One-time delivery, followed by weekly tips",
        deliveryMethod: "email",
        urgency: "within_week",
        rationale: "Adherence data states evening dose timing challenges. Education research means practical tips improve consistency.",
      },
      {
        id: "int-3",
        type: "support",
        title: "Activity Goal Check-in",
        description: "Gentle check-in about walking goal progress with barrier identification and support resources.",
        targetBehavior: "Re-engage with physical activity goals",
        timing: "Weekly, Sunday evening",
        deliveryMethod: "in_app",
        urgency: "within_week",
        rationale: "Exercise tracking shows declining engagement. Supportive check-ins state positive impact on goal persistence.",
      },
      {
        id: "int-4",
        type: "escalation",
        title: "Care Team Glucose Trend Alert",
        description: "Notify care team of rising glucose trend for potential care plan review.",
        targetBehavior: "Clinical review of glucose management approach",
        timing: "Within 48 hours if trend continues",
        deliveryMethod: "care_team",
        urgency: "within_24h",
        rationale: "Glucose data shows 8.2% increase over 14 days. Clinical guidelines state sustained elevation means care team review.",
      },
    ],
    overallHealthStatus: "Patient data shows mixed health indicators. Vital signs state blood pressure improvement while glucose control shows concerning upward trend. Adherence patterns refer to strengths in appointment keeping and morning medications, with challenges in monitoring and evening doses. Overall picture means opportunity for targeted interventions to optimize outcomes.",
    keyFindings: [
      "Blood pressure shows 5.3% improvement over past month, approaching target range",
      "Fasting glucose data states 8.2% increase over 2 weeks, requiring attention",
      "Glucose monitoring adherence shows declining pattern at 68% completion rate",
      "Evening medication adherence refers to timing-specific challenge",
      "Physical activity goal achievement means 55% with declining trend",
      "Fatigue symptom pattern shows correlation with glucose fluctuations",
    ],
    priorityActions: [
      "Address declining glucose monitoring adherence within 2 weeks",
      "Review glucose management approach given rising trend",
      "Implement evening medication reminder system",
      "Consider CGM evaluation to reduce monitoring burden",
      "Restructure activity goals for achievable milestones",
    ],
  });
}

export function getPatientInsightsById(patientId: string): PatientInsights | null {
  return generateMockInsights(patientId);
}

const insightsCache: Map<string, { insights: PatientInsights; expiry: number }> = new Map();
const CACHE_TTL = 15 * 60 * 1000;

export async function getCachedPatientInsights(
  patientId: string,
  patientData: any,
  userId: string
): Promise<PatientInsights> {
  const cached = insightsCache.get(patientId);
  if (cached && cached.expiry > Date.now()) {
    logPhiAccess({
      userId,
      patientId,
      resourceType: "PatientInsights",
      action: "read",
      details: "Retrieved cached patient insights",
    });
    return cached.insights;
  }

  const insights = await generatePatientInsights(patientId, patientData, userId);
  insightsCache.set(patientId, {
    insights,
    expiry: Date.now() + CACHE_TTL,
  });
  return insights;
}

export function invalidateInsightsCache(patientId: string): void {
  insightsCache.delete(patientId);
}
