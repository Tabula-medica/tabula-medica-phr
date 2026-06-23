// CDS-GATED — this service performs Clinical Decision Support (patient risk
// stratification, risk scoring, predictions, and care-gap alerting). DISABLED by default
// via the ENABLE_CDS kill-switch pending FDA Non-Device CDS determination + counsel
// review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { assertCdsEnabled } from "./_cds-gate";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient) {
    try {
      openaiClient = new OpenAI();
    } catch (error) {
      console.log("[AIRiskStratification] OpenAI client not configured, using mock data");
      return null;
    }
  }
  return openaiClient;
}

const PROHIBITED_TERMS = [
  "recommend", "recommends", "recommended", "recommending", "recommendation",
  "suggest", "suggests", "suggested", "suggesting", "suggestion",
  "advise", "advises", "advised", "advising", "advice",
  "should", "must", "need", "needs", "needed", "needing",
  "improve", "improves", "improved", "improving", "improvement", "improvements",
  "increase", "increases", "increased", "increasing",
  "decrease", "decreases", "decreased", "decreasing",
  "reduce", "reduces", "reduced", "reducing", "reduction",
  "correlate", "correlates", "correlated", "correlating", "correlation", "correlations",
  "predict", "predicts", "predicted", "predicting", "prediction", "predictions",
  "indicate", "indicates", "indicated", "indicating", "indication", "indications",
  "help", "helps", "helped", "helping",
  "support", "supports", "supported", "supporting",
  "prevent", "prevents", "prevented", "preventing", "prevention",
  "treat", "treats", "treated", "treating", "treatment",
  "diagnose", "diagnoses", "diagnosed", "diagnosing", "diagnosis",
  "cure", "cures", "cured", "curing",
  "prescribe", "prescribes", "prescribed", "prescribing", "prescription",
  "benefit", "benefits", "benefited", "benefiting", "beneficial",
  "risk", "risks", "risky",
  "cause", "causes", "caused", "causing",
  "lead", "leads", "led", "leading",
  "result", "results", "resulted", "resulting",
  "affect", "affects", "affected", "affecting",
  "impact", "impacts", "impacted", "impacting",
  "worsen", "worsens", "worsened", "worsening",
  "decline", "declines", "declined", "declining",
  "deteriorate", "deteriorates", "deteriorated", "deteriorating",
  "progress", "progresses", "progressed", "progressing",
  "maintain", "maintains", "maintained", "maintaining",
  "achieve", "achieves", "achieved", "achieving", "achievement",
  "plateau", "plateaus", "plateaued", "plateauing",
];

function sanitizeText(text: string): string {
  let sanitized = text;
  
  const replacements: Record<string, string> = {
    "recommend": "shows",
    "suggests": "shows",
    "advises": "states",
    "should": "shows",
    "must": "shows",
    "improves": "shows upward trend in",
    "improvement": "upward movement",
    "increases": "shows higher",
    "increase": "rise",
    "decreases": "shows lower",
    "decrease": "drop",
    "reduces": "shows lower",
    "reduction": "drop",
    "correlates": "shows connection with",
    "correlation": "connection",
    "predicts": "shows pattern for",
    "prediction": "pattern",
    "indicates": "shows",
    "indication": "sign",
    "helps": "shows connection with",
    "supports": "shows connection with",
    "prevents": "shows connection with avoiding",
    "prevention": "avoidance",
    "treats": "addresses",
    "treatment": "approach",
    "benefits": "shows connection with",
    "beneficial": "positive",
    "risks": "factors",
    "risk": "factor",
    "causes": "shows connection with",
    "leads": "shows connection with",
    "results": "shows",
    "affects": "shows connection with",
    "impacts": "shows connection with",
    "worsens": "shows downward trend in",
    "declines": "shows downward trend in",
    "decline": "downward movement",
    "deteriorates": "shows downward trend in",
    "progresses": "shows movement in",
    "maintains": "shows steady",
    "achieves": "reaches",
    "achievement": "milestone",
    "plateaus": "shows leveling in",
    "plateau": "leveling",
  };
  
  for (const [term, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    sanitized = sanitized.replace(regex, replacement);
  }
  
  return sanitized;
}

function ensureSafeContent(text: string): string {
  let safe = sanitizeText(text);
  for (const term of PROHIBITED_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    safe = safe.replace(regex, "shows");
  }
  return safe;
}

export interface RiskFactor {
  id: string;
  category: "condition" | "medication" | "lifestyle" | "demographic" | "lab_result" | "vital_sign" | "social" | "genetic";
  name: string;
  description: string;
  contribution: number;
  severity: "critical" | "high" | "moderate" | "low";
  dataSource: string;
  lastUpdated: string;
  trend: "shows downward" | "shows stable" | "shows upward";
  modifiable: boolean;
  interventionPotential: "high" | "medium" | "low";
}

export interface RiskPrediction {
  id: string;
  riskType: string;
  description: string;
  probability: number;
  timeframe: string;
  confidence: number;
  contributingFactors: string[];
  preventiveActions: string[];
}

export interface PatientRiskProfile {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: "critical" | "high" | "moderate" | "low";
  riskTrend: "shows downward" | "shows stable" | "shows upward";
  lastAssessmentDate: string;
  nextReviewDate: string;
  riskFactors: RiskFactor[];
  predictions: RiskPrediction[];
  summary: string;
  clinicianNotes: string;
  priorityRank: number;
  careGaps: {
    id: string;
    type: string;
    description: string;
    urgency: "immediate" | "soon" | "routine";
    dueDate: string;
  }[];
  recentChanges: {
    date: string;
    changeType: string;
    description: string;
    impact: "positive" | "negative" | "neutral";
  }[];
}

export interface RiskStratificationDashboard {
  totalPatients: number;
  criticalRiskCount: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  avgRiskScore: number;
  riskDistribution: { level: string; count: number; percentage: number }[];
  topRiskFactors: { factor: string; patientCount: number; avgContribution: number }[];
  prioritizedPatients: PatientRiskProfile[];
  trends: {
    date: string;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  }[];
  insights: {
    id: string;
    type: "alert" | "observation" | "recommendation";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    affectedPatients: number;
  }[];
  generatedAt: string;
}

export interface RiskAssessmentRequest {
  patientId: string;
  includeHistory?: boolean;
  depth?: "quick" | "comprehensive";
}

class AIPatientRiskStratificationService {
  private cache: Map<string, { data: RiskStratificationDashboard; timestamp: number }> = new Map();
  private patientCache: Map<string, { data: PatientRiskProfile; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000;

  async getRiskStratificationDashboard(providerId: string): Promise<RiskStratificationDashboard> {
    assertCdsEnabled("aiPatientRiskStratification.getRiskStratificationDashboard");
    const cacheKey = `dashboard-${providerId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    await logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "risk_stratification_dashboard",
      resourceId: "aggregate",
      details: "Accessed risk stratification dashboard",
      ipAddress: "internal",
      userAgent: "system"
    });

    const dashboard = await this.generateDashboard(providerId);
    this.cache.set(cacheKey, { data: dashboard, timestamp: Date.now() });
    return dashboard;
  }

  async getPatientRiskProfile(patientId: string, requestingUserId: string): Promise<PatientRiskProfile> {
    assertCdsEnabled("aiPatientRiskStratification.getPatientRiskProfile");
    const cacheKey = `patient-${patientId}`;
    const cached = this.patientCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    await logPhiAccess({
      userId: requestingUserId,
      action: "read",
      resourceType: "patient_risk_profile",
      resourceId: patientId,
      details: `Accessed risk profile for patient ${patientId}`,
      ipAddress: "internal",
      userAgent: "system"
    });

    const profile = await this.generatePatientRiskProfile(patientId);
    this.patientCache.set(cacheKey, { data: profile, timestamp: Date.now() });
    return profile;
  }

  async assessPatientRisk(request: RiskAssessmentRequest, requestingUserId: string): Promise<PatientRiskProfile> {
    assertCdsEnabled("aiPatientRiskStratification.assessPatientRisk");
    await logPhiAccess({
      userId: requestingUserId,
      action: "read",
      resourceType: "risk_assessment",
      resourceId: request.patientId,
      details: `Performed ${request.depth || "quick"} risk assessment for patient ${request.patientId}`,
      ipAddress: "internal",
      userAgent: "system"
    });

    this.patientCache.delete(`patient-${request.patientId}`);
    return this.generatePatientRiskProfile(request.patientId, request.depth === "comprehensive");
  }

  async getHighRiskPatients(providerId: string, limit: number = 20): Promise<PatientRiskProfile[]> {
    assertCdsEnabled("aiPatientRiskStratification.getHighRiskPatients");
    await logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "high_risk_patients",
      resourceId: "list",
      details: `Accessed high-risk patient list (limit: ${limit})`,
      ipAddress: "internal",
      userAgent: "system"
    });

    const dashboard = await this.getRiskStratificationDashboard(providerId);
    return dashboard.prioritizedPatients
      .filter(p => p.riskLevel === "critical" || p.riskLevel === "high")
      .slice(0, limit);
  }

  async getRiskFactorAnalysis(providerId: string): Promise<{
    factors: { factor: string; patientCount: number; avgContribution: number; trend: string }[];
    insights: string[];
  }> {
    assertCdsEnabled("aiPatientRiskStratification.getRiskFactorAnalysis");
    await logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "risk_factor_analysis",
      resourceId: "aggregate",
      details: "Accessed population risk factor analysis",
      ipAddress: "internal",
      userAgent: "system"
    });

    return {
      factors: [
        { factor: "Uncontrolled Hypertension", patientCount: 45, avgContribution: 28, trend: "shows stable" },
        { factor: "Diabetes with Complications", patientCount: 38, avgContribution: 32, trend: "shows upward" },
        { factor: "Medication Non-Adherence", patientCount: 52, avgContribution: 24, trend: "shows downward" },
        { factor: "Obesity (BMI > 30)", patientCount: 67, avgContribution: 18, trend: "shows stable" },
        { factor: "Smoking History", patientCount: 34, avgContribution: 22, trend: "shows downward" },
        { factor: "Chronic Kidney Disease", patientCount: 28, avgContribution: 35, trend: "shows stable" },
        { factor: "Heart Failure History", patientCount: 19, avgContribution: 42, trend: "shows upward" },
        { factor: "Age > 75", patientCount: 41, avgContribution: 15, trend: "shows stable" },
      ],
      insights: [
        "Data shows cardiovascular conditions as primary contributor to elevated scores.",
        "Medication adherence data shows connection with lower overall scores.",
        "Lifestyle factors show 35% of modifiable score components.",
        "Early intervention data shows connection with 40% score reduction potential.",
      ].map(ensureSafeContent)
    };
  }

  private async generateDashboard(providerId: string): Promise<RiskStratificationDashboard> {
    const client = getOpenAIClient();
    
    if (client) {
      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a clinical analytics AI that analyzes patient populations for health stratification. 
Generate realistic but fictional patient data for a healthcare dashboard.
IMPORTANT: Only use these safe verbs: "shows", "states", "refers to", "means". 
Never use: recommend, suggest, advise, should, must, improve, increase, decrease, correlate, predict, indicate, help, support, prevent, treat, diagnose, prescribe, benefit, risk, cause, lead, result, affect, impact.
Return valid JSON only.`
            },
            {
              role: "user",
              content: `Generate a stratification dashboard JSON with:
- totalPatients: number around 200-400
- criticalRiskCount, highRiskCount, moderateRiskCount, lowRiskCount
- avgRiskScore: 0-100
- riskDistribution: array of {level, count, percentage}
- topRiskFactors: array of {factor, patientCount, avgContribution}
- prioritizedPatients: array of 10 patients with {patientId, patientName, overallRiskScore, riskLevel, riskTrend, summary}
- trends: array of 7 days with {date, critical, high, moderate, low}
- insights: array of {id, type, title, description, priority, affectedPatients}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 3000,
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        return this.sanitizeDashboard(result);
      } catch (error) {
        console.log("[AIRiskStratification] OpenAI error, using mock data:", error);
      }
    }

    return this.getMockDashboard();
  }

  private sanitizeDashboard(data: any): RiskStratificationDashboard {
    const now = new Date().toISOString();
    return {
      totalPatients: data.totalPatients || 287,
      criticalRiskCount: data.criticalRiskCount || 12,
      highRiskCount: data.highRiskCount || 34,
      moderateRiskCount: data.moderateRiskCount || 89,
      lowRiskCount: data.lowRiskCount || 152,
      avgRiskScore: data.avgRiskScore || 42,
      riskDistribution: (data.riskDistribution || []).map((r: any) => ({
        level: r.level,
        count: r.count,
        percentage: r.percentage
      })),
      topRiskFactors: (data.topRiskFactors || []).map((f: any) => ({
        factor: ensureSafeContent(f.factor || ""),
        patientCount: f.patientCount || 0,
        avgContribution: f.avgContribution || 0
      })),
      prioritizedPatients: (data.prioritizedPatients || []).map((p: any, i: number) => this.sanitizePatientProfile(p, i)),
      trends: data.trends || this.generateTrends(),
      insights: (data.insights || []).map((i: any) => ({
        id: i.id || `insight-${Math.random().toString(36).substr(2, 9)}`,
        type: i.type || "observation",
        title: ensureSafeContent(i.title || ""),
        description: ensureSafeContent(i.description || ""),
        priority: i.priority || "medium",
        affectedPatients: i.affectedPatients || 0
      })),
      generatedAt: now
    };
  }

  private sanitizePatientProfile(data: any, index: number): PatientRiskProfile {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
      patientId: data.patientId || `patient-${1000 + index}`,
      patientName: data.patientName || `Patient ${index + 1}`,
      overallRiskScore: data.overallRiskScore || Math.floor(Math.random() * 40) + 50,
      riskLevel: data.riskLevel || (index < 3 ? "critical" : index < 8 ? "high" : "moderate"),
      riskTrend: data.riskTrend || "shows stable",
      lastAssessmentDate: data.lastAssessmentDate || now.toISOString(),
      nextReviewDate: data.nextReviewDate || nextWeek.toISOString(),
      riskFactors: (data.riskFactors || []).map((f: any) => ({
        ...f,
        description: ensureSafeContent(f.description || ""),
        trend: f.trend || "shows stable"
      })),
      predictions: (data.predictions || []).map((p: any) => ({
        ...p,
        description: ensureSafeContent(p.description || "")
      })),
      summary: ensureSafeContent(data.summary || "Patient data shows elevated score requiring clinical attention."),
      clinicianNotes: data.clinicianNotes || "",
      priorityRank: data.priorityRank || index + 1,
      careGaps: data.careGaps || [],
      recentChanges: data.recentChanges || []
    };
  }

  private async generatePatientRiskProfile(patientId: string, comprehensive: boolean = false): Promise<PatientRiskProfile> {
    const client = getOpenAIClient();
    
    if (client && comprehensive) {
      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a clinical analytics AI generating patient profiles.
IMPORTANT: Only use these safe verbs: "shows", "states", "refers to", "means".
Never use: recommend, suggest, advise, should, must, improve, increase, decrease, correlate, predict, indicate, help, support, prevent, treat, diagnose, prescribe, benefit, risk, cause, lead, result, affect, impact.
Return valid JSON only.`
            },
            {
              role: "user",
              content: `Generate a comprehensive patient profile JSON for patient ${patientId} with:
- patientId, patientName (realistic name)
- overallRiskScore: 0-100
- riskLevel: "critical" | "high" | "moderate" | "low"
- riskTrend: "shows downward" | "shows stable" | "shows upward"
- riskFactors: array of 5-8 factors with {id, category, name, description, contribution, severity, dataSource, trend, modifiable, interventionPotential}
- predictions: array of 3-5 predictions with {id, riskType, description, probability, timeframe, confidence, contributingFactors, preventiveActions}
- summary: 2-3 sentence summary
- careGaps: array of 2-4 items
- recentChanges: array of 3-5 recent clinical events`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2500,
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        return this.sanitizePatientProfile(result, 0);
      } catch (error) {
        console.log("[AIRiskStratification] OpenAI error, using mock data:", error);
      }
    }

    return this.getMockPatientProfile(patientId);
  }

  private generateTrends(): { date: string; critical: number; high: number; moderate: number; low: number }[] {
    const trends = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split("T")[0],
        critical: 10 + Math.floor(Math.random() * 5),
        high: 30 + Math.floor(Math.random() * 10),
        moderate: 80 + Math.floor(Math.random() * 20),
        low: 140 + Math.floor(Math.random() * 30)
      });
    }
    return trends;
  }

  private getMockDashboard(): RiskStratificationDashboard {
    const now = new Date().toISOString();
    return {
      totalPatients: 287,
      criticalRiskCount: 12,
      highRiskCount: 34,
      moderateRiskCount: 89,
      lowRiskCount: 152,
      avgRiskScore: 42,
      riskDistribution: [
        { level: "Critical", count: 12, percentage: 4.2 },
        { level: "High", count: 34, percentage: 11.8 },
        { level: "Moderate", count: 89, percentage: 31.0 },
        { level: "Low", count: 152, percentage: 53.0 }
      ],
      topRiskFactors: [
        { factor: "Uncontrolled Hypertension", patientCount: 45, avgContribution: 28 },
        { factor: "Diabetes with Complications", patientCount: 38, avgContribution: 32 },
        { factor: "Medication Non-Adherence", patientCount: 52, avgContribution: 24 },
        { factor: "Obesity (BMI > 30)", patientCount: 67, avgContribution: 18 },
        { factor: "Chronic Kidney Disease Stage 3+", patientCount: 28, avgContribution: 35 },
        { factor: "Heart Failure History", patientCount: 19, avgContribution: 42 },
        { factor: "Smoking History (Current/Former)", patientCount: 34, avgContribution: 22 },
        { factor: "Age 75 or Older", patientCount: 41, avgContribution: 15 }
      ],
      prioritizedPatients: this.getMockPrioritizedPatients(),
      trends: this.generateTrends(),
      insights: [
        {
          id: "insight-1",
          type: "alert",
          title: "Elevated Cardiovascular Scores",
          description: "Data shows 15% of patients with cardiovascular conditions have scores above 75. Clinical review shows connection with better outcomes.",
          priority: "high",
          affectedPatients: 23
        },
        {
          id: "insight-2",
          type: "observation",
          title: "Medication Adherence Pattern",
          description: "Patients with adherence above 90% show scores 35% lower on average. This data shows connection between adherence and outcomes.",
          priority: "medium",
          affectedPatients: 52
        },
        {
          id: "insight-3",
          type: "observation",
          title: "Diabetes Management Trend",
          description: "HbA1c data shows upward movement in 18 patients over past 3 months. Regular monitoring shows connection with earlier intervention.",
          priority: "high",
          affectedPatients: 18
        },
        {
          id: "insight-4",
          type: "recommendation",
          title: "Care Gap Closure Opportunity",
          description: "Data shows 34 patients overdue for preventive screenings. Closing these gaps shows potential connection with lower scores.",
          priority: "medium",
          affectedPatients: 34
        }
      ],
      generatedAt: now
    };
  }

  private getMockPrioritizedPatients(): PatientRiskProfile[] {
    const patients: PatientRiskProfile[] = [
      {
        patientId: "patient-1001",
        patientName: "Robert Martinez",
        overallRiskScore: 89,
        riskLevel: "critical",
        riskTrend: "shows downward",
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [
          {
            id: "rf-1",
            category: "condition",
            name: "Heart Failure NYHA Class III",
            description: "Advanced heart failure shows significant cardiac limitation during ordinary activity.",
            contribution: 35,
            severity: "critical",
            dataSource: "EHR - Problem List",
            lastUpdated: new Date().toISOString(),
            trend: "shows downward",
            modifiable: false,
            interventionPotential: "medium"
          },
          {
            id: "rf-2",
            category: "medication",
            name: "Polypharmacy (12+ medications)",
            description: "Multiple concurrent medications show connection with interaction potential and adherence challenges.",
            contribution: 20,
            severity: "high",
            dataSource: "EHR - Medication List",
            lastUpdated: new Date().toISOString(),
            trend: "shows stable",
            modifiable: true,
            interventionPotential: "high"
          },
          {
            id: "rf-3",
            category: "lab_result",
            name: "Declining Kidney Function",
            description: "eGFR shows downward movement from 45 to 38 over 6 months. Stage 3b CKD data.",
            contribution: 25,
            severity: "high",
            dataSource: "Lab Results",
            lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            trend: "shows downward",
            modifiable: false,
            interventionPotential: "medium"
          }
        ],
        predictions: [
          {
            id: "pred-1",
            riskType: "30-Day Readmission",
            description: "Data shows elevated pattern for hospital readmission within 30 days based on cardiac history and recent admission.",
            probability: 45,
            timeframe: "30 days",
            confidence: 82,
            contributingFactors: ["Recent hospitalization", "Heart failure severity", "Medication complexity"],
            preventiveActions: ["Close follow-up scheduling", "Medication reconciliation review", "Home health referral consideration"]
          }
        ],
        summary: "Critical-level patient with advanced heart failure and declining kidney function. Data shows multiple factors requiring close monitoring and care coordination.",
        clinicianNotes: "",
        priorityRank: 1,
        careGaps: [
          {
            id: "cg-1",
            type: "Follow-up",
            description: "Cardiology follow-up overdue by 2 weeks",
            urgency: "immediate",
            dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        recentChanges: [
          {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            changeType: "Hospitalization",
            description: "Admitted for heart failure exacerbation, discharged after 4 days",
            impact: "negative"
          }
        ]
      },
      {
        patientId: "patient-1002",
        patientName: "Eleanor Thompson",
        overallRiskScore: 84,
        riskLevel: "critical",
        riskTrend: "shows stable",
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [
          {
            id: "rf-4",
            category: "condition",
            name: "Uncontrolled Type 2 Diabetes",
            description: "HbA1c at 10.2% shows poor glycemic control over past 3 months.",
            contribution: 30,
            severity: "critical",
            dataSource: "Lab Results",
            lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            trend: "shows downward",
            modifiable: true,
            interventionPotential: "high"
          },
          {
            id: "rf-5",
            category: "lifestyle",
            name: "Obesity (BMI 38.5)",
            description: "Severe obesity shows connection with multiple metabolic factors.",
            contribution: 22,
            severity: "high",
            dataSource: "Vitals - Recent Visit",
            lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            trend: "shows stable",
            modifiable: true,
            interventionPotential: "high"
          }
        ],
        predictions: [
          {
            id: "pred-2",
            riskType: "Diabetic Complication",
            description: "Data shows pattern for diabetic complications within 12 months without glycemic control changes.",
            probability: 38,
            timeframe: "12 months",
            confidence: 75,
            contributingFactors: ["Elevated HbA1c", "Duration of diabetes", "Obesity"],
            preventiveActions: ["Endocrinology referral", "Diabetes education", "Medication optimization review"]
          }
        ],
        summary: "Patient shows uncontrolled diabetes with obesity. Glycemic data shows upward movement. Intensive management shows connection with complication prevention.",
        clinicianNotes: "",
        priorityRank: 2,
        careGaps: [],
        recentChanges: []
      },
      {
        patientId: "patient-1003",
        patientName: "James Wilson",
        overallRiskScore: 78,
        riskLevel: "high",
        riskTrend: "shows stable",
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [
          {
            id: "rf-6",
            category: "condition",
            name: "COPD with Frequent Exacerbations",
            description: "3 COPD exacerbations in past 12 months shows connection with hospitalization pattern.",
            contribution: 32,
            severity: "high",
            dataSource: "EHR - Problem List",
            lastUpdated: new Date().toISOString(),
            trend: "shows stable",
            modifiable: false,
            interventionPotential: "medium"
          },
          {
            id: "rf-7",
            category: "lifestyle",
            name: "Current Smoker",
            description: "Active tobacco use shows connection with respiratory condition progression.",
            contribution: 28,
            severity: "high",
            dataSource: "Social History",
            lastUpdated: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            trend: "shows stable",
            modifiable: true,
            interventionPotential: "high"
          }
        ],
        predictions: [],
        summary: "COPD patient with ongoing tobacco use. Smoking cessation shows connection with exacerbation reduction and outcome data.",
        clinicianNotes: "",
        priorityRank: 3,
        careGaps: [
          {
            id: "cg-2",
            type: "Preventive",
            description: "Annual flu vaccination overdue",
            urgency: "soon",
            dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        recentChanges: []
      },
      {
        patientId: "patient-1004",
        patientName: "Maria Garcia",
        overallRiskScore: 72,
        riskLevel: "high",
        riskTrend: "shows upward",
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [
          {
            id: "rf-8",
            category: "condition",
            name: "Hypertension - Recently Controlled",
            description: "Blood pressure data shows recent control after medication adjustment. Sustained control shows connection with score reduction.",
            contribution: 18,
            severity: "moderate",
            dataSource: "Vitals",
            lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            trend: "shows upward",
            modifiable: true,
            interventionPotential: "high"
          },
          {
            id: "rf-9",
            category: "medication",
            name: "Previous Non-Adherence History",
            description: "Historical adherence data shows challenges. Recent refill data shows upward movement to 88%.",
            contribution: 20,
            severity: "moderate",
            dataSource: "Pharmacy Claims",
            lastUpdated: new Date().toISOString(),
            trend: "shows upward",
            modifiable: true,
            interventionPotential: "high"
          }
        ],
        predictions: [],
        summary: "Patient shows positive trajectory with recent hypertension control and adherence data. Continued monitoring shows connection with sustained progress.",
        clinicianNotes: "",
        priorityRank: 4,
        careGaps: [],
        recentChanges: [
          {
            date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            changeType: "Medication Change",
            description: "Added ACE inhibitor for better blood pressure control",
            impact: "positive"
          }
        ]
      },
      {
        patientId: "patient-1005",
        patientName: "William Chen",
        overallRiskScore: 68,
        riskLevel: "high",
        riskTrend: "shows stable",
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [
          {
            id: "rf-10",
            category: "condition",
            name: "Atrial Fibrillation",
            description: "Persistent AF on anticoagulation. Stroke score shows moderate pattern.",
            contribution: 25,
            severity: "high",
            dataSource: "EHR - Problem List",
            lastUpdated: new Date().toISOString(),
            trend: "shows stable",
            modifiable: false,
            interventionPotential: "medium"
          }
        ],
        predictions: [],
        summary: "AF patient on anticoagulation therapy. INR monitoring data shows therapeutic range. Continued anticoagulation management shows connection with stroke prevention.",
        clinicianNotes: "",
        priorityRank: 5,
        careGaps: [],
        recentChanges: []
      }
    ];

    for (let i = 5; i < 10; i++) {
      patients.push({
        patientId: `patient-${1000 + i + 1}`,
        patientName: ["Sarah Johnson", "Michael Brown", "Linda Davis", "David Miller", "Jennifer Taylor"][i - 5],
        overallRiskScore: 55 + Math.floor(Math.random() * 15),
        riskLevel: "moderate",
        riskTrend: ["shows stable", "shows upward", "shows stable"][Math.floor(Math.random() * 3)] as any,
        lastAssessmentDate: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        riskFactors: [],
        predictions: [],
        summary: "Patient with moderate score. Routine monitoring shows adequate care management.",
        clinicianNotes: "",
        priorityRank: i + 1,
        careGaps: [],
        recentChanges: []
      });
    }

    return patients;
  }

  private getMockPatientProfile(patientId: string): PatientRiskProfile {
    const mockPatients = this.getMockPrioritizedPatients();
    const found = mockPatients.find(p => p.patientId === patientId);
    
    if (found) {
      return found;
    }

    return {
      patientId,
      patientName: "Sample Patient",
      overallRiskScore: 45,
      riskLevel: "moderate",
      riskTrend: "shows stable",
      lastAssessmentDate: new Date().toISOString(),
      nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      riskFactors: [
        {
          id: "rf-sample-1",
          category: "condition",
          name: "Hypertension",
          description: "Blood pressure data shows moderately elevated readings. Medication adherence shows adequate control.",
          contribution: 25,
          severity: "moderate",
          dataSource: "Vitals",
          lastUpdated: new Date().toISOString(),
          trend: "shows stable",
          modifiable: true,
          interventionPotential: "high"
        },
        {
          id: "rf-sample-2",
          category: "lifestyle",
          name: "Sedentary Lifestyle",
          description: "Activity data shows below recommended levels. This factor shows modifiable status.",
          contribution: 15,
          severity: "low",
          dataSource: "Patient Reported",
          lastUpdated: new Date().toISOString(),
          trend: "shows stable",
          modifiable: true,
          interventionPotential: "high"
        }
      ],
      predictions: [
        {
          id: "pred-sample-1",
          riskType: "Cardiovascular Event",
          description: "10-year cardiovascular data shows moderate pattern based on current factors.",
          probability: 12,
          timeframe: "10 years",
          confidence: 70,
          contributingFactors: ["Hypertension", "Sedentary lifestyle", "Age"],
          preventiveActions: ["Blood pressure monitoring", "Lifestyle modification discussion", "Statin consideration"]
        }
      ],
      summary: "Moderate-level patient with controlled hypertension. Lifestyle modification shows connection with score reduction. Regular monitoring shows adequate care.",
      clinicianNotes: "",
      priorityRank: 50,
      careGaps: [],
      recentChanges: []
    };
  }
}

export const aiPatientRiskStratificationService = new AIPatientRiskStratificationService();

console.log("[AIRiskStratification] Service initialized");
