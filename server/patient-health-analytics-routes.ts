import { Router, Request, Response } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";
import crypto from "crypto";

const router = Router();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Patient health analytics for education and monitoring only. NOT for clinical decision-making."
  };
  console.log("[HIPAA-AUDIT][PATIENT-ANALYTICS]", JSON.stringify(auditEntry));
}

interface VitalReading {
  date: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  bloodGlucose?: number;
  weight?: number;
  oxygenSaturation?: number;
  temperature?: number;
  respiratoryRate?: number;
  steps?: number;
  sleepHours?: number;
}

interface HealthTrend {
  metric: string;
  direction: "improving" | "declining" | "stable" | "fluctuating";
  percentChange: number;
  period: string;
  dataPoints: Array<{ date: string; value: number }>;
  normalRange: { min: number; max: number };
  unit: string;
  description: string;
}

interface RiskIndicator {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  factors: string[];
  recommendations: string[];
  lastUpdated: string;
}

interface Anomaly {
  id: string;
  metric: string;
  detectedAt: string;
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  severity: "minor" | "moderate" | "severe";
  context: string;
  aiExplanation?: string;
}

interface ActionableInsight {
  id: string;
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actions: Array<{
    type: string;
    label: string;
    details: string;
  }>;
  relatedMetrics: string[];
  estimatedImpact: string;
}

function generateMockVitals(days: number = 90): VitalReading[] {
  const vitals: VitalReading[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const randomFactor = Math.sin(i / 7) * 5;
    const trendFactor = (days - i) / days * 3;
    const weekendBonus = date.getDay() === 0 || date.getDay() === 6 ? 1000 : 0;
    
    vitals.push({
      date: date.toISOString().split('T')[0],
      systolic: Math.round(120 + randomFactor + trendFactor + Math.random() * 10),
      diastolic: Math.round(80 + randomFactor / 2 + Math.random() * 5),
      heartRate: Math.round(72 + randomFactor + Math.random() * 8),
      bloodGlucose: Math.round(95 + randomFactor * 2 + Math.random() * 15),
      weight: Math.round((175 - trendFactor + Math.random() * 2) * 10) / 10,
      oxygenSaturation: Math.round(97 + Math.random() * 2),
      temperature: Math.round((98.6 + (Math.random() - 0.5)) * 10) / 10,
      respiratoryRate: Math.round(14 + Math.random() * 4),
      steps: Math.round(6000 + Math.random() * 4000 + weekendBonus),
      sleepHours: Math.round((7 + (Math.random() - 0.5) * 2) * 10) / 10,
    });
  }
  
  return vitals;
}

function calculateTrends(vitals: VitalReading[]): HealthTrend[] {
  const metrics = [
    { key: "systolic", label: "Blood Pressure (Systolic)", unit: "mmHg", min: 90, max: 120, desc: "Upper blood pressure reading" },
    { key: "diastolic", label: "Blood Pressure (Diastolic)", unit: "mmHg", min: 60, max: 80, desc: "Lower blood pressure reading" },
    { key: "heartRate", label: "Heart Rate", unit: "bpm", min: 60, max: 100, desc: "Resting heart rate" },
    { key: "bloodGlucose", label: "Blood Glucose", unit: "mg/dL", min: 70, max: 100, desc: "Fasting blood sugar level" },
    { key: "weight", label: "Weight", unit: "lbs", min: 150, max: 200, desc: "Body weight" },
    { key: "oxygenSaturation", label: "Oxygen Saturation", unit: "%", min: 95, max: 100, desc: "Blood oxygen level" },
    { key: "steps", label: "Daily Steps", unit: "steps", min: 5000, max: 15000, desc: "Steps walked per day" },
    { key: "sleepHours", label: "Sleep Duration", unit: "hours", min: 7, max: 9, desc: "Hours of sleep per night" },
  ];

  return metrics.map(metric => {
    const values = vitals
      .filter(v => v[metric.key as keyof VitalReading] !== undefined)
      .map(v => ({
        date: v.date,
        value: v[metric.key as keyof VitalReading] as number,
      }));

    const recentValues = values.slice(-30);
    const olderValues = values.slice(-60, -30);
    
    const recentAvg = recentValues.reduce((sum, v) => sum + v.value, 0) / recentValues.length;
    const olderAvg = olderValues.length > 0 
      ? olderValues.reduce((sum, v) => sum + v.value, 0) / olderValues.length 
      : recentAvg;
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    let direction: HealthTrend["direction"];
    const isLowerBetter = metric.key === "weight" || metric.key === "systolic" || metric.key === "diastolic" || metric.key === "bloodGlucose";
    
    if (Math.abs(percentChange) < 2) direction = "stable";
    else if (percentChange > 5) direction = isLowerBetter ? "declining" : "improving";
    else if (percentChange < -5) direction = isLowerBetter ? "improving" : "declining";
    else direction = "fluctuating";

    return {
      metric: metric.label,
      direction,
      percentChange: Math.round(percentChange * 10) / 10,
      period: "30 days",
      dataPoints: recentValues,
      normalRange: { min: metric.min, max: metric.max },
      unit: metric.unit,
      description: metric.desc,
    };
  });
}

function detectAnomalies(vitals: VitalReading[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const thresholds = {
    systolic: { min: 90, max: 140, label: "Blood Pressure (Systolic)" },
    diastolic: { min: 60, max: 90, label: "Blood Pressure (Diastolic)" },
    heartRate: { min: 50, max: 100, label: "Heart Rate" },
    bloodGlucose: { min: 70, max: 140, label: "Blood Glucose" },
    oxygenSaturation: { min: 94, max: 100, label: "Oxygen Saturation" },
  };

  vitals.slice(-30).forEach((reading, index) => {
    Object.entries(thresholds).forEach(([metric, config]) => {
      const value = reading[metric as keyof VitalReading] as number | undefined;
      if (value !== undefined) {
        if (value < config.min || value > config.max) {
          const deviation = value < config.min 
            ? ((config.min - value) / config.min) * 100
            : ((value - config.max) / config.max) * 100;
          
          let severity: Anomaly["severity"];
          if (deviation < 10) severity = "minor";
          else if (deviation < 20) severity = "moderate";
          else severity = "severe";

          anomalies.push({
            id: `anomaly-${metric}-${index}-${Date.now()}`,
            metric: config.label,
            detectedAt: reading.date,
            value,
            expectedRange: { min: config.min, max: config.max },
            deviation: Math.round(deviation * 10) / 10,
            severity,
            context: `Reading recorded on ${reading.date}`,
          });
        }
      }
    });
  });

  return anomalies.slice(0, 15);
}

function generateRiskIndicators(vitals: VitalReading[], trends: HealthTrend[]): RiskIndicator[] {
  const risks: RiskIndicator[] = [];
  
  const bpTrend = trends.find(t => t.metric === "Blood Pressure (Systolic)");
  if (bpTrend && (bpTrend.direction === "declining" || bpTrend.percentChange > 5)) {
    risks.push({
      id: "risk-bp-" + Date.now(),
      category: "Cardiovascular",
      severity: bpTrend.percentChange > 10 ? "high" : "medium",
      title: "Elevated Blood Pressure Trend",
      description: "Your blood pressure readings have shown an upward trend over the past 30 days.",
      factors: [
        `Average systolic changed by ${Math.abs(bpTrend.percentChange)}%`,
        "Consistent elevation above baseline",
        "Pattern detected across multiple readings",
      ],
      recommendations: [
        "Monitor blood pressure daily at the same time",
        "Consider reducing sodium intake",
        "Discuss trends with your healthcare provider at next visit",
      ],
      lastUpdated: new Date().toISOString(),
    });
  }

  const glucoseTrend = trends.find(t => t.metric === "Blood Glucose");
  if (glucoseTrend && glucoseTrend.direction === "fluctuating") {
    risks.push({
      id: "risk-glucose-" + Date.now(),
      category: "Metabolic",
      severity: "low",
      title: "Blood Glucose Variability",
      description: "Your blood glucose levels show some variability in recent readings.",
      factors: [
        "Occasional readings outside target range",
        "Good overall average glucose levels",
        "Normal fasting glucose pattern",
      ],
      recommendations: [
        "Continue monitoring glucose after meals",
        "Track food intake alongside glucose readings",
        "Maintain consistent meal timing",
      ],
      lastUpdated: new Date().toISOString(),
    });
  }

  const stepsTrend = trends.find(t => t.metric === "Daily Steps");
  if (stepsTrend && stepsTrend.direction === "declining") {
    risks.push({
      id: "risk-activity-" + Date.now(),
      category: "Lifestyle",
      severity: "low",
      title: "Reduced Physical Activity",
      description: "Your daily step count has decreased compared to previous weeks.",
      factors: [
        `Step count down ${Math.abs(stepsTrend.percentChange)}% from previous period`,
        "Fewer high-activity days recorded",
      ],
      recommendations: [
        "Set a daily step goal that works for you",
        "Take short walking breaks throughout the day",
        "Consider tracking exercise minutes alongside steps",
      ],
      lastUpdated: new Date().toISOString(),
    });
  }

  return risks;
}

function generateActionableInsights(trends: HealthTrend[], anomalies: Anomaly[], risks: RiskIndicator[]): ActionableInsight[] {
  const insights: ActionableInsight[] = [];

  const improvingTrends = trends.filter(t => t.direction === "improving");
  if (improvingTrends.length > 0) {
    insights.push({
      id: "insight-positive-" + Date.now(),
      category: "Positive Progress",
      priority: "medium",
      title: "You're Making Progress!",
      description: `${improvingTrends.length} health metric(s) are showing positive trends. Keep up the good work!`,
      actions: improvingTrends.map(t => ({
        type: "celebrate",
        label: `${t.metric} improving`,
        details: `${Math.abs(t.percentChange)}% improvement over ${t.period}`,
      })),
      relatedMetrics: improvingTrends.map(t => t.metric),
      estimatedImpact: "Continuing these habits supports long-term health",
    });
  }

  const decliningTrends = trends.filter(t => t.direction === "declining");
  if (decliningTrends.length > 0) {
    insights.push({
      id: "insight-attention-" + Date.now(),
      category: "Areas of Focus",
      priority: "high",
      title: "Metrics Needing Attention",
      description: `${decliningTrends.length} metric(s) may benefit from focus. Small changes can make a difference.`,
      actions: decliningTrends.map(t => ({
        type: "review",
        label: `Review ${t.metric}`,
        details: `${Math.abs(t.percentChange)}% change over ${t.period}`,
      })),
      relatedMetrics: decliningTrends.map(t => t.metric),
      estimatedImpact: "Early attention can prevent larger issues",
    });
  }

  if (anomalies.length > 0) {
    const severeAnomalies = anomalies.filter(a => a.severity !== "minor");
    if (severeAnomalies.length > 0) {
      insights.push({
        id: "insight-anomalies-" + Date.now(),
        category: "Unusual Readings",
        priority: "high",
        title: "Some Readings Outside Normal Range",
        description: `${severeAnomalies.length} reading(s) were detected outside typical ranges. These may warrant attention.`,
        actions: severeAnomalies.slice(0, 3).map(a => ({
          type: "investigate",
          label: `Check ${a.metric}`,
          details: `${a.value} on ${a.detectedAt} (${a.deviation}% from expected)`,
        })),
        relatedMetrics: Array.from(new Set(severeAnomalies.map(a => a.metric))),
        estimatedImpact: "Understanding unusual readings helps track health patterns",
      });
    }
  }

  insights.push({
    id: "insight-monitoring-" + Date.now(),
    category: "Health Habits",
    priority: "low",
    title: "Keep Up Regular Monitoring",
    description: "Consistent tracking helps you and your care team understand your health patterns.",
    actions: [
      { type: "habit", label: "Check vitals at consistent times", details: "Morning readings provide best comparison" },
      { type: "habit", label: "Log how you're feeling", details: "Context helps explain reading variations" },
      { type: "habit", label: "Share updates with your care team", details: "Regular check-ins improve care coordination" },
    ],
    relatedMetrics: ["All metrics"],
    estimatedImpact: "Regular monitoring improves health outcomes by up to 40%",
  });

  return insights;
}

router.get("/dashboard", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_PATIENT_DASHBOARD", {}, req);
  
  try {
    const period = (req.query.period as string) || "90d";
    const days = period === "30d" ? 30 : period === "60d" ? 60 : 90;
    
    const vitals = generateMockVitals(days);
    const trends = calculateTrends(vitals);
    const anomalies = detectAnomalies(vitals);
    const risks = generateRiskIndicators(vitals, trends);
    const insights = generateActionableInsights(trends, anomalies, risks);
    
    const latestVitals = vitals[vitals.length - 1];
    
    const healthScore = Math.round(
      70 + 
      (trends.filter(t => t.direction === "improving").length * 5) -
      (trends.filter(t => t.direction === "declining").length * 3) -
      (risks.filter(r => r.severity === "high").length * 5) -
      (anomalies.filter(a => a.severity === "severe").length * 2)
    );
    
    res.json({
      overview: {
        healthScore: Math.min(100, Math.max(0, healthScore)),
        trendsImproving: trends.filter(t => t.direction === "improving").length,
        trendsStable: trends.filter(t => t.direction === "stable").length,
        activeRisks: risks.filter(r => r.severity === "high" || r.severity === "medium").length,
        anomaliesDetected: anomalies.filter(a => a.severity !== "minor").length,
        highPriorityItems: insights.filter(i => i.priority === "high").length,
      },
      latestVitals,
      trends: trends.slice(0, 6),
      topInsights: insights.slice(0, 4),
      topRisks: risks.slice(0, 3),
      recentAnomalies: anomalies.slice(0, 5),
      lastUpdated: new Date().toISOString(),
      disclaimer: "This dashboard is for educational and informational purposes only. It is NOT medical advice. Always consult with your healthcare provider about your health.",
    });
  } catch (error) {
    console.error("Error fetching patient dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/trends", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_HEALTH_TRENDS", {}, req);
  
  try {
    const period = (req.query.period as string) || "90d";
    const days = period === "30d" ? 30 : period === "60d" ? 60 : 90;
    
    const vitals = generateMockVitals(days);
    const trends = calculateTrends(vitals);
    
    res.json({
      trends,
      summary: {
        improving: trends.filter(t => t.direction === "improving").length,
        declining: trends.filter(t => t.direction === "declining").length,
        stable: trends.filter(t => t.direction === "stable").length,
        fluctuating: trends.filter(t => t.direction === "fluctuating").length,
      },
      period: `${days} days`,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching health trends:", error);
    res.status(500).json({ error: "Failed to fetch health trends" });
  }
});

router.get("/vitals", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_VITALS_HISTORY", {}, req);
  
  try {
    const period = (req.query.period as string) || "90d";
    const days = period === "30d" ? 30 : period === "60d" ? 60 : 90;
    
    const vitals = generateMockVitals(days);
    
    res.json({
      vitals,
      count: vitals.length,
      period: `${days} days`,
    });
  } catch (error) {
    console.error("Error fetching vitals:", error);
    res.status(500).json({ error: "Failed to fetch vitals" });
  }
});

router.get("/risks", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_RISK_INDICATORS", {}, req);
  
  try {
    const vitals = generateMockVitals(90);
    const trends = calculateTrends(vitals);
    const risks = generateRiskIndicators(vitals, trends);
    
    res.json({
      indicators: risks,
      summary: {
        critical: risks.filter(r => r.severity === "critical").length,
        high: risks.filter(r => r.severity === "high").length,
        medium: risks.filter(r => r.severity === "medium").length,
        low: risks.filter(r => r.severity === "low").length,
      },
      lastUpdated: new Date().toISOString(),
      disclaimer: "Risk indicators are for educational purposes only. They do NOT constitute medical diagnosis or advice.",
    });
  } catch (error) {
    console.error("Error fetching risk indicators:", error);
    res.status(500).json({ error: "Failed to fetch risk indicators" });
  }
});

router.get("/anomalies", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_ANOMALIES", {}, req);
  
  try {
    const vitals = generateMockVitals(90);
    const anomalies = detectAnomalies(vitals);
    
    res.json({
      anomalies,
      count: anomalies.length,
      bySeverity: {
        severe: anomalies.filter(a => a.severity === "severe").length,
        moderate: anomalies.filter(a => a.severity === "moderate").length,
        minor: anomalies.filter(a => a.severity === "minor").length,
      },
      lastUpdated: new Date().toISOString(),
      disclaimer: "Anomaly detection is for informational purposes only. Consult your healthcare provider for medical evaluation.",
    });
  } catch (error) {
    console.error("Error detecting anomalies:", error);
    res.status(500).json({ error: "Failed to detect anomalies" });
  }
});

router.post("/analyze-anomaly", async (req: Request, res: Response) => {
  logHIPAAAudit("AI_ANALYZE_ANOMALY", { anomalyId: req.body.anomaly?.id }, req);
  
  try {
    const { anomaly, patientContext } = req.body;
    
    if (!anomaly) {
      return res.status(400).json({ error: "Anomaly data required" });
    }

    const prompt = `You are a health education assistant explaining health metrics in simple terms. Analyze this health reading and provide a clear, educational explanation. You are NOT providing medical advice or diagnosis.

Reading Details:
- Metric: ${anomaly.metric}
- Recorded Value: ${anomaly.value}
- Typical Range: ${anomaly.expectedRange.min} - ${anomaly.expectedRange.max}
- Deviation: ${anomaly.deviation}%
- Date: ${anomaly.detectedAt}
${patientContext ? `\nAdditional Context: ${JSON.stringify(patientContext)}` : ''}

Please provide:
1. A simple explanation of what this reading represents
2. Common everyday factors that can influence this metric (like stress, diet, sleep, activity, timing of measurement)
3. General tips for getting accurate readings
4. When to consider discussing readings with a healthcare provider

Keep the tone friendly and educational. Use simple language. Avoid medical jargon.

IMPORTANT: Include a clear disclaimer that this is educational information only and NOT medical advice.`;

    const explanation = (await generatePhiSafeText({
      system: "You are a friendly health education assistant. You explain health metrics in everyday language. You NEVER provide medical advice, diagnosis, or treatment recommendations. You always remind users to consult healthcare providers for medical concerns.",
      user: prompt,
      maxTokens: 600,
    })) || "Unable to generate explanation.";

    res.json({
      anomalyId: anomaly.id,
      aiExplanation: explanation,
      disclaimer: "This explanation is for educational purposes only. It is NOT medical advice. Always consult with your healthcare provider about any health concerns.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating AI analysis:", error);
    res.status(500).json({ error: "Failed to generate analysis" });
  }
});

router.get("/insights", async (req: Request, res: Response) => {
  logHIPAAAudit("GET_ACTIONABLE_INSIGHTS", {}, req);
  
  try {
    const vitals = generateMockVitals(90);
    const trends = calculateTrends(vitals);
    const anomalies = detectAnomalies(vitals);
    const risks = generateRiskIndicators(vitals, trends);
    const insights = generateActionableInsights(trends, anomalies, risks);
    
    res.json({
      insights,
      summary: {
        high: insights.filter(i => i.priority === "high").length,
        medium: insights.filter(i => i.priority === "medium").length,
        low: insights.filter(i => i.priority === "low").length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

router.post("/ai-summary", async (req: Request, res: Response) => {
  logHIPAAAudit("AI_HEALTH_SUMMARY", {}, req);
  
  try {
    const vitals = generateMockVitals(90);
    const trends = calculateTrends(vitals);
    const risks = generateRiskIndicators(vitals, trends);

    const prompt = `You are a friendly health assistant creating a personalized health summary. Generate an encouraging, educational summary based on the following health data. Do NOT provide medical advice.

Health Trends (past 30 days):
${trends.map(t => `- ${t.metric}: ${t.direction} (${t.percentChange}% change)`).join('\n')}

Areas to Watch:
${risks.map(r => `- ${r.title}: ${r.severity} priority`).join('\n')}

Create a warm, encouraging summary that:
1. Celebrates positive trends and progress
2. Gently notes areas that might benefit from attention
3. Provides general wellness encouragement (NOT medical recommendations)
4. Uses simple, friendly language
5. Is about 3-4 paragraphs long

End with a reminder to discuss any concerns with their healthcare provider.`;

    const summary = (await generatePhiSafeText({
      system: "You are a warm, encouraging health education assistant. You celebrate health wins and gently encourage healthy habits. You NEVER provide medical advice. You always remind users that healthcare providers are the best source for medical guidance.",
      user: prompt,
      maxTokens: 800,
    })) || "Unable to generate summary.";

    res.json({
      summary,
      disclaimer: "This summary is for informational and motivational purposes only. It is NOT medical advice. Please consult with your healthcare provider about your health.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating AI summary:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export function registerPatientHealthAnalyticsRoutes(app: any) {
  app.use("/api/patient-analytics", router);
}
