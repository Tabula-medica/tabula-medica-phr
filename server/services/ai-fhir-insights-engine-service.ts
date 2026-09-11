import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

interface PatientInsight {
  id: string;
  patientId: string;
  type: 'health_summary' | 'risk_alert' | 'care_gap' | 'trend_analysis' | 'medication_review' | 'preventive_care';
  title: string;
  summary: string;
  details: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  recommendations: string[];
  relatedResources: string[];
  generatedAt: Date;
  validUntil: Date;
}

interface DataSummary {
  id: string;
  scope: 'patient' | 'population' | 'condition' | 'medication';
  title: string;
  narrative: string;
  keyFindings: KeyFinding[];
  statistics: Record<string, any>;
  visualizationData: any;
  generatedAt: Date;
  disclaimer: string;
}

interface KeyFinding {
  category: string;
  finding: string;
  significance: 'routine' | 'notable' | 'concerning' | 'urgent';
  evidence: string[];
}

interface TrendAnalysis {
  id: string;
  patientId: string;
  metric: string;
  dataPoints: { date: string; value: number }[];
  trend: 'improving' | 'stable' | 'declining' | 'fluctuating';
  prediction: { nextValue: number; confidence: number };
  insights: string[];
  generatedAt: Date;
}

interface InsightSession {
  id: string;
  name: string;
  type: 'patient_review' | 'population_analysis' | 'care_optimization';
  status: 'active' | 'completed';
  insights: PatientInsight[];
  summaries: DataSummary[];
  createdAt: Date;
}

const patientInsights: Map<string, PatientInsight> = new Map();
const dataSummaries: Map<string, DataSummary> = new Map();
const trendAnalyses: Map<string, TrendAnalysis> = new Map();
const insightSessions: Map<string, InsightSession> = new Map();

function initializeSampleData() {
  const insights: PatientInsight[] = [
    {
      id: "insight-1",
      patientId: "patient-001",
      type: 'health_summary',
      title: "Comprehensive Health Overview",
      summary: "Patient demonstrates good overall health with well-controlled chronic conditions. Blood pressure and glucose levels are within target ranges.",
      details: "Based on analysis of 47 clinical observations over the past 12 months, the patient shows stable management of Type 2 Diabetes (HbA1c: 6.8%) and Hypertension (avg BP: 128/82). Medication adherence appears high based on prescription refill patterns.",
      severity: 'info',
      confidence: 0.92,
      recommendations: [
        "Continue current medication regimen",
        "Schedule annual diabetic eye exam",
        "Consider discussing physical activity goals at next visit"
      ],
      relatedResources: ["Observation/obs-001", "Condition/cond-001", "MedicationRequest/med-001"],
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: "insight-2",
      patientId: "patient-002",
      type: 'risk_alert',
      title: "Elevated Cardiovascular Risk",
      summary: "Patient shows multiple risk factors for cardiovascular disease requiring attention.",
      details: "Analysis identified: elevated LDL cholesterol (142 mg/dL), smoking history, family history of heart disease, and BMI of 31.2. Combined risk score suggests 15% 10-year ASCVD risk.",
      severity: 'high',
      confidence: 0.88,
      recommendations: [
        "Consider statin therapy discussion",
        "Referral to smoking cessation program",
        "Nutritional counseling for weight management"
      ],
      relatedResources: ["Observation/obs-lipid", "Condition/cond-obesity"],
      generatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: "insight-3",
      patientId: "patient-003",
      type: 'care_gap',
      title: "Missing Preventive Screenings",
      summary: "Patient is overdue for recommended preventive care screenings based on age and risk factors.",
      details: "Identified gaps: Colonoscopy (last: never, due for initial screening), Mammogram (last: 26 months ago), Flu vaccine (last: 14 months ago).",
      severity: 'medium',
      confidence: 0.95,
      recommendations: [
        "Schedule colonoscopy screening",
        "Schedule mammogram",
        "Administer flu vaccine at next visit"
      ],
      relatedResources: ["Procedure/proc-mammogram-2022"],
      generatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  ];

  insights.forEach(insight => patientInsights.set(insight.id, insight));

  const summaries: DataSummary[] = [
    {
      id: "summary-1",
      scope: 'population',
      title: "Diabetes Management Population Summary",
      narrative: "Analysis of 2,847 patients with Type 2 Diabetes across the care network reveals overall positive management trends. 72% of patients have HbA1c levels below 7.0%, exceeding the network target of 65%. However, 18% of patients have not had an HbA1c test in the past 6 months, indicating a need for outreach.",
      keyFindings: [
        { category: "Glycemic Control", finding: "72% at target HbA1c", significance: 'notable', evidence: ["Lab results analysis"] },
        { category: "Testing Gaps", finding: "18% missing recent HbA1c", significance: 'concerning', evidence: ["Care gap report"] },
        { category: "Complications", finding: "12% with nephropathy progression", significance: 'concerning', evidence: ["Condition tracking"] }
      ],
      statistics: {
        totalPatients: 2847,
        avgHbA1c: 6.9,
        targetAchievement: 0.72,
        complicationRate: 0.12
      },
      visualizationData: { type: 'distribution', bins: [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0] },
      generatedAt: new Date(),
      disclaimer: "This summary is for informational purposes only. Not for clinical decision-making."
    }
  ];

  summaries.forEach(s => dataSummaries.set(s.id, s));

  const trends: TrendAnalysis[] = [
    {
      id: "trend-1",
      patientId: "patient-001",
      metric: "Blood Pressure Systolic",
      dataPoints: [
        { date: "2025-07-01", value: 138 },
        { date: "2025-08-01", value: 135 },
        { date: "2025-09-01", value: 132 },
        { date: "2025-10-01", value: 130 },
        { date: "2025-11-01", value: 128 },
        { date: "2025-12-01", value: 126 }
      ],
      trend: 'improving',
      prediction: { nextValue: 124, confidence: 0.78 },
      insights: [
        "Blood pressure shows consistent downward trend over 6 months",
        "Current medication appears effective",
        "If trend continues, patient may reach optimal range within 2 months"
      ],
      generatedAt: new Date()
    }
  ];

  trends.forEach(t => trendAnalyses.set(t.id, t));
}

initializeSampleData();

export class AIFHIRInsightsEngineService {
  async generatePatientInsights(patientId: string, fhirData: any): Promise<PatientInsight[]> {
    console.log("[HIPAA-AUDIT] Generating AI insights for patient:", patientId);

    const insights: PatientInsight[] = [];

    if (aiEnabled) {
      try {
        const content = await generatePhiSafeText({
          system: `You are a clinical decision support assistant analyzing FHIR patient data. Generate health insights, identify risks, and suggest care opportunities. Be evidence-based and cite specific data points. Return JSON format.

IMPORTANT: All insights are for informational purposes only and should not replace clinical judgment.`,
          user: `Analyze this patient's FHIR data and generate insights:\n${JSON.stringify(fhirData, null, 2)}\n\nReturn JSON: { "insights": [{ "type": "...", "title": "...", "summary": "...", "details": "...", "severity": "...", "confidence": 0.0-1.0, "recommendations": [...] }] }`,
          responseMimeType: "application/json",
          maxTokens: 4096
        });

        const parsed = JSON.parse(content || "{}");
        if (parsed.insights) {
          parsed.insights.forEach((insight: any, idx: number) => {
            const newInsight: PatientInsight = {
              id: `insight-ai-${Date.now()}-${idx}`,
              patientId,
              type: insight.type || 'health_summary',
              title: insight.title || "AI-Generated Insight",
              summary: insight.summary || "",
              details: insight.details || "",
              severity: insight.severity || 'info',
              confidence: insight.confidence || 0.7,
              recommendations: insight.recommendations || [],
              relatedResources: [],
              generatedAt: new Date(),
              validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };
            insights.push(newInsight);
            patientInsights.set(newInsight.id, newInsight);
          });
        }
      } catch (error) {
        console.error("OpenAI insights error:", error);
        insights.push(this.createFallbackInsight(patientId));
      }
    } else {
      insights.push(this.createFallbackInsight(patientId));
    }

    return insights;
  }

  async generateDataSummary(scope: 'patient' | 'population' | 'condition', data: any): Promise<DataSummary> {
    console.log("[HIPAA-AUDIT] Generating data summary for scope:", scope);

    let summary: DataSummary;

    if (aiEnabled) {
      try {
        const content = await generatePhiSafeText({
          system: "You are a healthcare data analyst. Create clear, actionable summaries of FHIR health data. Include key findings, statistics, and trends. Return JSON format.",
          user: `Create a ${scope} summary for this data:\n${JSON.stringify(data, null, 2)}\n\nReturn JSON: { "title": "...", "narrative": "...", "keyFindings": [...], "statistics": {...} }`,
          responseMimeType: "application/json",
          maxTokens: 4096
        });

        const parsed = JSON.parse(content || "{}");
        summary = {
          id: `summary-ai-${Date.now()}`,
          scope,
          title: parsed.title || `${scope} Summary`,
          narrative: parsed.narrative || "AI-generated summary of provided data.",
          keyFindings: parsed.keyFindings || [],
          statistics: parsed.statistics || {},
          visualizationData: null,
          generatedAt: new Date(),
          disclaimer: "This summary is for informational purposes only. Not for clinical decision-making."
        };
      } catch (error) {
        console.error("OpenAI summary error:", error);
        summary = this.createFallbackSummary(scope);
      }
    } else {
      summary = this.createFallbackSummary(scope);
    }

    dataSummaries.set(summary.id, summary);
    return summary;
  }

  async analyzeTrends(patientId: string, metric: string, observations: any[]): Promise<TrendAnalysis> {
    console.log("[HIPAA-AUDIT] Analyzing trends for patient:", patientId, "metric:", metric);

    const dataPoints = observations.map(obs => ({
      date: obs.effectiveDateTime || obs.issued,
      value: obs.valueQuantity?.value || 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let trend: 'improving' | 'stable' | 'declining' | 'fluctuating' = 'stable';
    let prediction = { nextValue: 0, confidence: 0.5 };
    let insights: string[] = [];

    if (aiEnabled && dataPoints.length >= 3) {
      try {
        const content = await generatePhiSafeText({
          system: "You are a clinical data analyst. Analyze health metric trends and provide predictions. Be specific about trend direction and clinical significance.",
          user: `Analyze this trend for ${metric}:\n${JSON.stringify(dataPoints)}\n\nReturn JSON: { "trend": "improving|stable|declining|fluctuating", "prediction": { "nextValue": number, "confidence": 0-1 }, "insights": ["..."] }`,
          responseMimeType: "application/json",
          maxTokens: 1024
        });

        const parsed = JSON.parse(content || "{}");
        trend = parsed.trend || 'stable';
        prediction = parsed.prediction || { nextValue: dataPoints[dataPoints.length - 1]?.value || 0, confidence: 0.5 };
        insights = parsed.insights || [];
      } catch (error) {
        console.error("OpenAI trend analysis error:", error);
        trend = this.calculateSimpleTrend(dataPoints);
        insights = ["AI analysis unavailable - using basic trend calculation"];
      }
    } else {
      trend = this.calculateSimpleTrend(dataPoints);
      insights = ["Basic trend analysis - AI unavailable for detailed insights"];
    }

    const analysis: TrendAnalysis = {
      id: `trend-${Date.now()}`,
      patientId,
      metric,
      dataPoints,
      trend,
      prediction,
      insights,
      generatedAt: new Date()
    };

    trendAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  async getRecentInsights(limit: number = 10): Promise<PatientInsight[]> {
    return Array.from(patientInsights.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  async getPatientInsights(patientId: string): Promise<PatientInsight[]> {
    return Array.from(patientInsights.values())
      .filter(i => i.patientId === patientId);
  }

  async getSummaries(): Promise<DataSummary[]> {
    return Array.from(dataSummaries.values());
  }

  async getTrendAnalyses(patientId?: string): Promise<TrendAnalysis[]> {
    const all = Array.from(trendAnalyses.values());
    return patientId ? all.filter(t => t.patientId === patientId) : all;
  }

  async getStats(): Promise<{
    totalInsights: number;
    insightsByType: Record<string, number>;
    avgConfidence: number;
    recentAlerts: PatientInsight[];
    summaryCount: number;
  }> {
    const insights = Array.from(patientInsights.values());
    const byType: Record<string, number> = {};
    insights.forEach(i => {
      byType[i.type] = (byType[i.type] || 0) + 1;
    });

    return {
      totalInsights: insights.length,
      insightsByType: byType,
      avgConfidence: insights.length > 0 
        ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length 
        : 0,
      recentAlerts: insights.filter(i => i.severity === 'high' || i.severity === 'critical').slice(-5),
      summaryCount: dataSummaries.size
    };
  }

  private createFallbackInsight(patientId: string): PatientInsight {
    return {
      id: `insight-fallback-${Date.now()}`,
      patientId,
      type: 'health_summary',
      title: "Health Summary",
      summary: "Basic health summary generated from available FHIR data.",
      details: "AI-powered detailed analysis is currently unavailable. This is a basic summary of the patient's health records.",
      severity: 'info',
      confidence: 0.6,
      recommendations: ["Review complete medical record", "Schedule follow-up as appropriate"],
      relatedResources: [],
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  private createFallbackSummary(scope: string): DataSummary {
    return {
      id: `summary-fallback-${Date.now()}`,
      scope: scope as any,
      title: `${scope} Summary`,
      narrative: "Summary generated from available data. AI-powered narrative generation is currently unavailable.",
      keyFindings: [],
      statistics: {},
      visualizationData: null,
      generatedAt: new Date(),
      disclaimer: "This summary is for informational purposes only. Not for clinical decision-making."
    };
  }

  private calculateSimpleTrend(dataPoints: { date: string; value: number }[]): 'improving' | 'stable' | 'declining' | 'fluctuating' {
    if (dataPoints.length < 2) return 'stable';
    
    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    if (change < -10) return 'declining';
    if (change > 10) return 'improving';
    return 'stable';
  }
}

export const aiFHIRInsightsEngineService = new AIFHIRInsightsEngineService();
