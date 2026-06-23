// CDS-GATED — this service performs Clinical Decision Support (AI clinical
// interpretation of health-data charts/dashboards: warnings, out-of-range flags,
// and recommendations). DISABLED by default via the ENABLE_CDS kill-switch
// pending FDA Non-Device CDS determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { assertCdsEnabled } from "./_cds-gate";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface DataPoint {
  date: string;
  value: number;
  label?: string;
  unit?: string;
}

export interface ChartInsightRequest {
  chartType: "vital_trends" | "lab_results" | "medication_adherence" | "health_score" | "wellness_metrics" | "appointments" | "goals_progress";
  dataPoints: DataPoint[];
  metricName: string;
  unit?: string;
  normalRange?: { min: number; max: number };
  patientContext?: {
    age?: number;
    conditions?: string[];
    medications?: string[];
  };
}

export interface ChartInsight {
  id: string;
  type: "trend" | "anomaly" | "achievement" | "warning" | "recommendation" | "correlation";
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  description: string;
  dataContext?: {
    highlightPoints?: number[];
    trendDirection?: "up" | "down" | "stable";
    changePercent?: number;
  };
  actionItems?: string[];
  relatedMetrics?: string[];
}

export interface VisualizationInsightsResponse {
  chartId: string;
  insights: ChartInsight[];
  summary: string;
  generatedAt: string;
  confidenceScore: number;
}

export async function generateChartInsights(
  patientId: string,
  userId: string,
  request: ChartInsightRequest
): Promise<VisualizationInsightsResponse> {
  assertCdsEnabled("aiVisualizationInsights.generateChartInsights");
  console.log(`[AI Viz Insights] Generating insights for ${request.chartType}: ${request.metricName}`);

  logPhiAccess({
    userId,
    patientId,
    resourceType: "AIVisualizationInsights",
    action: "read",
    details: `AI analysis of ${request.chartType} visualization for ${request.metricName}`,
  });

  if (!request.dataPoints || request.dataPoints.length === 0) {
    return {
      chartId: `${request.chartType}_${Date.now()}`,
      insights: [{
        id: "no-data",
        type: "recommendation" as const,
        severity: "info" as const,
        title: "No Data Available",
        description: "Start tracking this metric to see AI-powered insights about your health trends.",
        actionItems: ["Begin recording measurements regularly"]
      }],
      summary: "No data available for analysis.",
      generatedAt: new Date().toISOString(),
      confidenceScore: 0
    };
  }

  try {
    const prompt = buildInsightPrompt(request);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a healthcare data analyst AI that provides insights about patient health data visualizations. 
Your role is to:
1. Identify meaningful trends in the data
2. Detect anomalies or concerning patterns
3. Celebrate achievements and positive changes
4. Provide actionable recommendations
5. Explain data in simple, patient-friendly language

Always be supportive and encouraging while being honest about concerning patterns.
Format your response as valid JSON matching the InsightsOutput schema.
Never provide medical diagnoses - only observations and suggestions to discuss with healthcare providers.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content) as {
      insights: ChartInsight[];
      summary: string;
      confidenceScore: number;
    };

    return {
      chartId: `${request.chartType}_${Date.now()}`,
      insights: parsed.insights.map((insight, idx) => ({
        ...insight,
        id: insight.id || `insight_${idx}`
      })),
      summary: parsed.summary,
      generatedAt: new Date().toISOString(),
      confidenceScore: parsed.confidenceScore || 0.8
    };

  } catch (error) {
    console.error("[AI Viz Insights] Error generating insights:", error);
    return generateFallbackInsights(request);
  }
}

function buildInsightPrompt(request: ChartInsightRequest): string {
  const { chartType, dataPoints, metricName, unit, normalRange, patientContext } = request;
  
  const recentPoints = dataPoints.slice(-30);
  const dataDescription = recentPoints.map(p => 
    `${p.date}: ${p.value}${unit ? ` ${unit}` : ''}`
  ).join(", ");

  let contextInfo = "";
  if (patientContext) {
    const parts = [];
    if (patientContext.age) parts.push(`Age: ${patientContext.age}`);
    if (patientContext.conditions?.length) parts.push(`Conditions: ${patientContext.conditions.join(", ")}`);
    if (patientContext.medications?.length) parts.push(`Current medications: ${patientContext.medications.join(", ")}`);
    if (parts.length) contextInfo = `\n\nPatient Context:\n${parts.join("\n")}`;
  }

  let rangeInfo = "";
  if (normalRange) {
    rangeInfo = `\n\nNormal range for ${metricName}: ${normalRange.min} - ${normalRange.max}${unit ? ` ${unit}` : ''}`;
  }

  return `Analyze the following ${chartType} data for ${metricName}:

Data Points (${recentPoints.length} measurements):
${dataDescription}${rangeInfo}${contextInfo}

Provide insights in this exact JSON format:
{
  "insights": [
    {
      "id": "unique_id",
      "type": "trend|anomaly|achievement|warning|recommendation|correlation",
      "severity": "info|success|warning|critical",
      "title": "Short, clear title",
      "description": "Patient-friendly explanation in 1-2 sentences",
      "dataContext": {
        "trendDirection": "up|down|stable",
        "changePercent": number or null
      },
      "actionItems": ["Specific action 1", "Specific action 2"],
      "relatedMetrics": ["Related metric names if applicable"]
    }
  ],
  "summary": "One sentence overall summary",
  "confidenceScore": 0.0 to 1.0
}

Generate 2-4 insights focusing on the most important observations. Prioritize:
1. Any concerning trends or values outside normal range (warning/critical)
2. Positive trends or improvements (achievement/success)
3. Actionable recommendations
4. Interesting correlations if patient context is available`;
}

function generateFallbackInsights(request: ChartInsightRequest): VisualizationInsightsResponse {
  const { dataPoints, metricName, normalRange } = request;
  const insights: ChartInsight[] = [];

  if (dataPoints.length >= 2) {
    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    const changePercent = ((last - first) / first) * 100;
    const direction = changePercent > 2 ? "up" : changePercent < -2 ? "down" : "stable";
    
    insights.push({
      id: "trend_1",
      type: "trend",
      severity: "info",
      title: `${metricName} Trend`,
      description: direction === "stable" 
        ? `Your ${metricName.toLowerCase()} has remained stable over this period.`
        : `Your ${metricName.toLowerCase()} has ${direction === "up" ? "increased" : "decreased"} by ${Math.abs(changePercent).toFixed(1)}%.`,
      dataContext: {
        trendDirection: direction,
        changePercent
      }
    });
  }

  if (normalRange && dataPoints.length > 0) {
    const outOfRange = dataPoints.filter(p => p.value < normalRange.min || p.value > normalRange.max);
    if (outOfRange.length > 0) {
      const percentage = (outOfRange.length / dataPoints.length) * 100;
      insights.push({
        id: "range_check",
        type: percentage > 50 ? "warning" : "anomaly",
        severity: percentage > 50 ? "warning" : "info",
        title: "Values Outside Normal Range",
        description: `${outOfRange.length} of ${dataPoints.length} readings (${percentage.toFixed(0)}%) were outside the normal range.`,
        actionItems: percentage > 30 
          ? ["Consider discussing these patterns with your healthcare provider"]
          : ["Continue monitoring and tracking your measurements"]
      });
    } else {
      insights.push({
        id: "in_range",
        type: "achievement",
        severity: "success",
        title: "Great Progress!",
        description: `All your ${metricName.toLowerCase()} readings are within the healthy range.`,
        actionItems: ["Keep up the good work with your current routine"]
      });
    }
  }

  insights.push({
    id: "recommendation_1",
    type: "recommendation",
    severity: "info",
    title: "Tracking Tip",
    description: "Consistent tracking helps identify patterns. Try to measure at the same time each day for best results.",
    actionItems: ["Set a daily reminder for measurements", "Note any factors that might affect readings"]
  });

  return {
    chartId: `${request.chartType}_${Date.now()}`,
    insights,
    summary: `Analysis of ${dataPoints.length} ${metricName.toLowerCase()} measurements.`,
    generatedAt: new Date().toISOString(),
    confidenceScore: 0.6
  };
}

export async function generateDashboardInsights(
  patientId: string,
  userId: string,
  dashboardData: {
    healthScore: number;
    vitals: Record<string, DataPoint[]>;
    medications: { name: string; adherenceRate: number }[];
    goals: { name: string; progress: number; target: number }[];
    labResults: Record<string, DataPoint[]>;
  }
): Promise<{
  overallInsight: string;
  categoryInsights: { category: string; insight: string; severity: "info" | "success" | "warning" }[];
  recommendations: string[];
  highlights: { type: "positive" | "attention" | "info"; text: string }[];
}> {
  assertCdsEnabled("aiVisualizationInsights.generateDashboardInsights");
  console.log(`[AI Viz Insights] Generating dashboard-wide insights for patient: ${patientId}`);

  logPhiAccess({
    userId,
    patientId,
    resourceType: "AIDashboardInsights",
    action: "read",
    details: "AI analysis of complete health dashboard",
  });

  try {
    const summaryData = {
      healthScore: dashboardData.healthScore,
      vitalsSummary: Object.entries(dashboardData.vitals).map(([name, points]) => ({
        name,
        latest: points[points.length - 1]?.value,
        trend: points.length >= 2 
          ? (points[points.length - 1].value > points[0].value ? "increasing" : "decreasing")
          : "stable"
      })),
      medicationAdherence: dashboardData.medications.map(m => ({
        name: m.name,
        adherence: `${(m.adherenceRate * 100).toFixed(0)}%`
      })),
      goalsProgress: dashboardData.goals.map(g => ({
        name: g.name,
        completion: `${((g.progress / g.target) * 100).toFixed(0)}%`
      })),
      labsSummary: Object.entries(dashboardData.labResults).map(([name, points]) => ({
        name,
        latest: points[points.length - 1]?.value
      }))
    };

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a supportive health analytics AI. Analyze the patient's health dashboard data and provide encouraging, actionable insights.
Keep language simple and patient-friendly. Never diagnose - only observe patterns and suggest discussing with healthcare providers when appropriate.
Respond in valid JSON format.`
        },
        {
          role: "user",
          content: `Analyze this health dashboard data and provide insights:

${JSON.stringify(summaryData, null, 2)}

Respond in this exact JSON format:
{
  "overallInsight": "One encouraging sentence about overall health status",
  "categoryInsights": [
    {"category": "vitals|medications|goals|labs", "insight": "Short insight", "severity": "info|success|warning"}
  ],
  "recommendations": ["Specific actionable recommendation 1", "Recommendation 2"],
  "highlights": [
    {"type": "positive|attention|info", "text": "Key highlight"}
  ]
}

Provide 2-3 category insights and 2-3 recommendations.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    return JSON.parse(content);

  } catch (error) {
    console.error("[AI Viz Insights] Error generating dashboard insights:", error);
    
    return {
      overallInsight: `Your health score of ${dashboardData.healthScore} shows you're making progress on your health journey.`,
      categoryInsights: [
        {
          category: "medications",
          insight: dashboardData.medications.length > 0 
            ? `You're tracking ${dashboardData.medications.length} medications. Consistent tracking helps maintain adherence.`
            : "No medications currently being tracked.",
          severity: "info"
        },
        {
          category: "goals",
          insight: dashboardData.goals.length > 0
            ? `You have ${dashboardData.goals.length} active health goals. Keep up the momentum!`
            : "Consider setting some health goals to track your progress.",
          severity: dashboardData.goals.length > 0 ? "success" : "info"
        }
      ],
      recommendations: [
        "Continue tracking your vitals regularly for better insights",
        "Review your progress with your healthcare provider at your next visit"
      ],
      highlights: [
        { type: "info", text: "Regular tracking provides better health insights over time" }
      ]
    };
  }
}
