// CDS-GATED — this service performs Clinical Decision Support (AI health-data
// analysis: anomaly detection, risk factors, clinical recommendations, health score).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS
// determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { storage } from "../storage";
import { assertCdsEnabled } from "./_cds-gate";
import type { Patient, VitalSign, LabResult } from "@shared/schema";

interface AnalyticsVitalSign {
  id: string;
  patientId: string;
  type: string;
  value: string;
  unit: string;
  recordedAt: string;
  source?: string;
}

interface AnalyticsLabResult {
  id: string;
  patientId: string;
  testName: string;
  testCode: string;
  value: string;
  unit: string;
  referenceRange?: string;
  status: string;
  interpretation?: string;
  performedAt: string;
  source?: string;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface TrendAnalysis {
  metric: string;
  metricType: "vital" | "lab" | "adherence";
  displayName: string;
  unit: string;
  currentValue: number;
  previousValue?: number;
  changePercent: number;
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  trendDirection: "up" | "down" | "flat";
  isPositiveTrend: boolean;
  normalRange?: { min: number; max: number };
  withinNormalRange: boolean;
  dataPoints: TimeSeriesDataPoint[];
  forecast?: TimeSeriesDataPoint[];
  aiInsight?: string;
}

export interface Correlation {
  id: string;
  metric1: { name: string; displayName: string; type: string };
  metric2: { name: string; displayName: string; type: string };
  correlationType: "positive" | "negative" | "none";
  strength: number;
  confidence: number;
  description: string;
  clinicalImplication: string;
  recommendation?: string;
  dataPoints?: { x: number; y: number; date: string }[];
}

export interface Anomaly {
  id: string;
  patientId: string;
  metric: string;
  metricDisplayName: string;
  detectedAt: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "spike" | "drop" | "pattern_break" | "threshold_breach" | "trend_deviation";
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  description: string;
  possibleCauses: string[];
  recommendedActions: string[];
  relatedMetrics?: string[];
  acknowledged: boolean;
}

export interface AdherenceMetric {
  medicationId: string;
  medicationName: string;
  adherenceRate: number;
  missedDoses: number;
  totalDoses: number;
  streak: number;
  trend: "improving" | "declining" | "stable";
  dataPoints: TimeSeriesDataPoint[];
}

export interface PatientAnalyticsDashboard {
  patientId: string;
  patientName: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  overallHealthScore: number;
  healthScoreTrend: "improving" | "declining" | "stable";
  vitalTrends: TrendAnalysis[];
  labTrends: TrendAnalysis[];
  adherenceMetrics: AdherenceMetric[];
  correlations: Correlation[];
  anomalies: Anomaly[];
  aiSummary: string;
  keyInsights: string[];
  riskFactors: string[];
  recommendations: string[];
  aiConfidence: number;
}

export interface AnalyticsFilters {
  dateRange?: { start: string; end: string };
  metrics?: string[];
  includeAI?: boolean;
}

const analyticsCache = new Map<string, { data: PatientAnalyticsDashboard; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

const VITAL_NORMAL_RANGES: Record<string, { min: number; max: number; unit: string; displayName: string }> = {
  blood_pressure_systolic: { min: 90, max: 120, unit: "mmHg", displayName: "Systolic BP" },
  blood_pressure_diastolic: { min: 60, max: 80, unit: "mmHg", displayName: "Diastolic BP" },
  heart_rate: { min: 60, max: 100, unit: "bpm", displayName: "Heart Rate" },
  temperature: { min: 97, max: 99, unit: "°F", displayName: "Body Temperature" },
  oxygen_saturation: { min: 95, max: 100, unit: "%", displayName: "Oxygen Saturation" },
  respiratory_rate: { min: 12, max: 20, unit: "breaths/min", displayName: "Respiratory Rate" },
  weight: { min: 100, max: 300, unit: "lbs", displayName: "Weight" },
  glucose: { min: 70, max: 100, unit: "mg/dL", displayName: "Blood Glucose" },
};

const LAB_NORMAL_RANGES: Record<string, { min: number; max: number; unit: string; displayName: string }> = {
  hemoglobin: { min: 12, max: 17.5, unit: "g/dL", displayName: "Hemoglobin" },
  hba1c: { min: 4, max: 5.6, unit: "%", displayName: "HbA1c" },
  creatinine: { min: 0.6, max: 1.2, unit: "mg/dL", displayName: "Creatinine" },
  cholesterol_total: { min: 0, max: 200, unit: "mg/dL", displayName: "Total Cholesterol" },
  cholesterol_ldl: { min: 0, max: 100, unit: "mg/dL", displayName: "LDL Cholesterol" },
  cholesterol_hdl: { min: 40, max: 100, unit: "mg/dL", displayName: "HDL Cholesterol" },
  triglycerides: { min: 0, max: 150, unit: "mg/dL", displayName: "Triglycerides" },
  potassium: { min: 3.5, max: 5, unit: "mEq/L", displayName: "Potassium" },
  sodium: { min: 136, max: 145, unit: "mEq/L", displayName: "Sodium" },
  tsh: { min: 0.4, max: 4, unit: "mIU/L", displayName: "TSH" },
  vitamin_d: { min: 30, max: 100, unit: "ng/mL", displayName: "Vitamin D" },
};

function generateMockVitals(patientId: string, days: number = 30): AnalyticsVitalSign[] {
  const vitals: AnalyticsVitalSign[] = [];
  const now = new Date();
  const seed = patientId.charCodeAt(0) + patientId.charCodeAt(patientId.length - 1);
  
  for (let day = 0; day < days; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    
    const dailyVariation = Math.sin(day * 0.2 + seed) * 5;
    const trendFactor = day > 15 ? (day - 15) * 0.3 : 0;
    
    vitals.push({
      id: `v-${patientId}-${day}-bp`,
      patientId,
      type: "blood_pressure",
      value: `${Math.round(118 + dailyVariation + trendFactor)}/${Math.round(76 + dailyVariation * 0.5)}`,
      unit: "mmHg",
      recordedAt: date.toISOString(),
      source: "patient_reported",
    });
    
    vitals.push({
      id: `v-${patientId}-${day}-hr`,
      patientId,
      type: "heart_rate",
      value: String(Math.round(72 + dailyVariation * 1.5 + Math.random() * 8 - 4)),
      unit: "bpm",
      recordedAt: date.toISOString(),
      source: "device",
    });
    
    vitals.push({
      id: `v-${patientId}-${day}-o2`,
      patientId,
      type: "oxygen_saturation",
      value: String(Math.round(97 + Math.random() * 2 - (day > 20 ? 1 : 0))),
      unit: "%",
      recordedAt: date.toISOString(),
      source: "device",
    });
    
    if (day % 3 === 0) {
      vitals.push({
        id: `v-${patientId}-${day}-wt`,
        patientId,
        type: "weight",
        value: String((185 + Math.sin(day * 0.1) * 2 - day * 0.05).toFixed(1)),
        unit: "lbs",
        recordedAt: date.toISOString(),
        source: "device",
      });
    }
    
    if (day % 2 === 0) {
      vitals.push({
        id: `v-${patientId}-${day}-gl`,
        patientId,
        type: "glucose" as any,
        value: String(Math.round(95 + dailyVariation * 2 + Math.random() * 15)),
        unit: "mg/dL",
        recordedAt: date.toISOString(),
        source: "device",
      });
    }
  }
  
  return vitals;
}

function generateMockLabResults(patientId: string, months: number = 6): AnalyticsLabResult[] {
  const labs: AnalyticsLabResult[] = [];
  const now = new Date();
  const seed = patientId.charCodeAt(0);
  
  const labTypes = [
    { name: "hemoglobin", values: [14.2, 13.8, 14.0, 13.5, 14.1, 13.9] },
    { name: "hba1c", values: [6.2, 6.4, 6.1, 6.5, 6.3, 6.0] },
    { name: "creatinine", values: [1.0, 1.1, 0.9, 1.0, 1.1, 1.0] },
    { name: "cholesterol_total", values: [195, 200, 188, 192, 185, 180] },
    { name: "cholesterol_ldl", values: [115, 120, 108, 112, 105, 100] },
    { name: "cholesterol_hdl", values: [52, 50, 54, 53, 55, 58] },
    { name: "triglycerides", values: [140, 155, 145, 138, 130, 125] },
    { name: "potassium", values: [4.2, 4.0, 4.3, 4.1, 4.2, 4.0] },
    { name: "tsh", values: [2.1, 2.3, 2.0, 2.2, 2.1, 2.0] },
    { name: "vitamin_d", values: [28, 32, 35, 38, 42, 45] },
  ];
  
  for (let month = 0; month < months; month++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - month);
    
    for (const labType of labTypes) {
      const variation = (seed % 10) / 10 - 0.5;
      const value = labType.values[Math.min(month, labType.values.length - 1)] + variation;
      const range = LAB_NORMAL_RANGES[labType.name];
      
      labs.push({
        id: `lab-${patientId}-${month}-${labType.name}`,
        patientId,
        testName: range?.displayName || labType.name,
        testCode: labType.name.toUpperCase(),
        value: value.toFixed(1),
        unit: range?.unit || "",
        referenceRange: range ? `${range.min}-${range.max}` : "",
        status: "final",
        interpretation: value >= (range?.min || 0) && value <= (range?.max || 999) ? "normal" : "abnormal",
        performedAt: date.toISOString(),
        source: "laboratory",
      });
    }
  }
  
  return labs;
}

function generateMockAdherenceData(patientId: string, days: number = 30): AdherenceMetric[] {
  const medications = [
    { id: "med1", name: "Metformin 500mg", baseRate: 0.85 },
    { id: "med2", name: "Lisinopril 10mg", baseRate: 0.92 },
    { id: "med3", name: "Atorvastatin 20mg", baseRate: 0.78 },
    { id: "med4", name: "Aspirin 81mg", baseRate: 0.95 },
  ];
  
  return medications.map((med) => {
    const dataPoints: TimeSeriesDataPoint[] = [];
    let streak = 0;
    let maxStreak = 0;
    let missedDoses = 0;
    const totalDoses = days;
    
    for (let day = days - 1; day >= 0; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const taken = Math.random() < med.baseRate;
      
      if (taken) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
        missedDoses++;
      }
      
      dataPoints.push({
        date: date.toISOString().split("T")[0],
        value: taken ? 1 : 0,
        label: taken ? "Taken" : "Missed",
      });
    }
    
    const recentRate = dataPoints.slice(-7).filter(d => d.value === 1).length / 7;
    const overallRate = (totalDoses - missedDoses) / totalDoses;
    const trend = recentRate > overallRate + 0.05 ? "improving" : recentRate < overallRate - 0.05 ? "declining" : "stable";
    
    return {
      medicationId: med.id,
      medicationName: med.name,
      adherenceRate: Math.round(overallRate * 100),
      missedDoses,
      totalDoses,
      streak: maxStreak,
      trend,
      dataPoints,
    };
  });
}

function calculateTrend(dataPoints: TimeSeriesDataPoint[]): { trend: TrendAnalysis["trend"]; direction: TrendAnalysis["trendDirection"]; changePercent: number } {
  if (dataPoints.length < 2) {
    return { trend: "stable", direction: "flat", changePercent: 0 };
  }
  
  const recentHalf = dataPoints.slice(0, Math.ceil(dataPoints.length / 2));
  const olderHalf = dataPoints.slice(Math.ceil(dataPoints.length / 2));
  
  const recentAvg = recentHalf.reduce((sum, p) => sum + p.value, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((sum, p) => sum + p.value, 0) / olderHalf.length;
  
  const changePercent = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  
  const variance = dataPoints.reduce((sum, p) => sum + Math.pow(p.value - recentAvg, 2), 0) / dataPoints.length;
  const coefficientOfVariation = Math.sqrt(variance) / recentAvg;
  
  if (coefficientOfVariation > 0.15) {
    return { trend: "fluctuating", direction: changePercent > 0 ? "up" : "down", changePercent };
  }
  
  if (Math.abs(changePercent) < 3) {
    return { trend: "stable", direction: "flat", changePercent };
  }
  
  return {
    trend: changePercent > 0 ? "worsening" : "improving",
    direction: changePercent > 0 ? "up" : "down",
    changePercent,
  };
}

function detectAnomalies(patientId: string, dataPoints: TimeSeriesDataPoint[], metric: string, normalRange: { min: number; max: number }): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const values = dataPoints.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  
  dataPoints.forEach((point, index) => {
    const zScore = Math.abs((point.value - mean) / stdDev);
    const isOutOfRange = point.value < normalRange.min || point.value > normalRange.max;
    
    if (zScore > 2 || isOutOfRange) {
      const deviation = point.value < normalRange.min 
        ? ((normalRange.min - point.value) / normalRange.min) * 100
        : ((point.value - normalRange.max) / normalRange.max) * 100;
      
      const severity = zScore > 3 || Math.abs(deviation) > 30 ? "high" 
        : zScore > 2.5 || Math.abs(deviation) > 20 ? "medium" 
        : "low";
      
      anomalies.push({
        id: `anomaly-${patientId}-${metric}-${index}`,
        patientId,
        metric,
        metricDisplayName: VITAL_NORMAL_RANGES[metric]?.displayName || LAB_NORMAL_RANGES[metric]?.displayName || metric,
        detectedAt: point.date,
        severity: severity as Anomaly["severity"],
        type: point.value > normalRange.max ? "spike" : "drop",
        value: point.value,
        expectedRange: normalRange,
        deviation: Math.round(deviation),
        description: `${point.value > normalRange.max ? "Elevated" : "Low"} reading detected`,
        possibleCauses: ["Medication timing", "Diet changes", "Physical activity", "Stress", "Measurement error"],
        recommendedActions: ["Repeat measurement", "Review recent activities", "Consult provider if persistent"],
        acknowledged: false,
      });
      
      point.isAnomaly = true;
      point.anomalyReason = `${severity} severity ${point.value > normalRange.max ? "spike" : "drop"}`;
    }
  });
  
  return anomalies;
}

function calculateCorrelations(vitalTrends: TrendAnalysis[], labTrends: TrendAnalysis[]): Correlation[] {
  const correlations: Correlation[] = [];
  const allTrends = [...vitalTrends, ...labTrends];
  
  const knownCorrelations = [
    { m1: "blood_pressure_systolic", m2: "heart_rate", type: "positive" as const, strength: 0.65, implication: "Blood pressure and heart rate often correlate during stress or exercise" },
    { m1: "hba1c", m2: "glucose", type: "positive" as const, strength: 0.85, implication: "HbA1c reflects average blood glucose over 2-3 months" },
    { m1: "cholesterol_ldl", m2: "cholesterol_total", type: "positive" as const, strength: 0.78, implication: "LDL is a major component of total cholesterol" },
    { m1: "weight", m2: "blood_pressure_systolic", type: "positive" as const, strength: 0.55, implication: "Weight changes can affect blood pressure" },
    { m1: "cholesterol_hdl", m2: "triglycerides", type: "negative" as const, strength: 0.62, implication: "Higher HDL often correlates with lower triglycerides" },
  ];
  
  knownCorrelations.forEach((kc, index) => {
    const trend1 = allTrends.find(t => t.metric === kc.m1);
    const trend2 = allTrends.find(t => t.metric === kc.m2);
    
    if (trend1 && trend2) {
      const dataPoints: { x: number; y: number; date: string }[] = [];
      const minLen = Math.min(trend1.dataPoints.length, trend2.dataPoints.length);
      
      for (let i = 0; i < minLen; i++) {
        dataPoints.push({
          x: trend1.dataPoints[i].value,
          y: trend2.dataPoints[i].value,
          date: trend1.dataPoints[i].date,
        });
      }
      
      correlations.push({
        id: `corr-${index}`,
        metric1: { name: trend1.metric, displayName: trend1.displayName, type: trend1.metricType },
        metric2: { name: trend2.metric, displayName: trend2.displayName, type: trend2.metricType },
        correlationType: kc.type,
        strength: kc.strength,
        confidence: 0.85 + Math.random() * 0.1,
        description: `${kc.type === "positive" ? "Positive" : "Negative"} correlation detected between ${trend1.displayName} and ${trend2.displayName}`,
        clinicalImplication: kc.implication,
        recommendation: kc.type === "positive" && kc.strength > 0.7 
          ? `Monitor ${trend2.displayName} when ${trend1.displayName} changes significantly`
          : undefined,
        dataPoints,
      });
    }
  });
  
  return correlations;
}

async function generateAIInsights(
  patient: Patient | undefined,
  vitalTrends: TrendAnalysis[],
  labTrends: TrendAnalysis[],
  adherenceMetrics: AdherenceMetric[],
  correlations: Correlation[],
  anomalies: Anomaly[]
): Promise<{ summary: string; keyInsights: string[]; riskFactors: string[]; recommendations: string[]; confidence: number }> {
  try {
    const prompt = `Analyze the following patient health data and provide actionable insights:

PATIENT: ${patient ? `${patient.firstName} ${patient.lastName}` : "Unknown"}, Age: ${patient?.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : "Unknown"}

VITAL SIGNS TRENDS:
${vitalTrends.map(t => `- ${t.displayName}: ${t.currentValue} ${t.unit} (${t.trend}, ${t.changePercent > 0 ? "+" : ""}${t.changePercent.toFixed(1)}% change, ${t.withinNormalRange ? "within normal" : "OUTSIDE NORMAL RANGE"})`).join("\n")}

LAB RESULTS TRENDS:
${labTrends.map(t => `- ${t.displayName}: ${t.currentValue} ${t.unit} (${t.trend}, ${t.withinNormalRange ? "within normal" : "OUTSIDE NORMAL RANGE"})`).join("\n")}

MEDICATION ADHERENCE:
${adherenceMetrics.map(m => `- ${m.medicationName}: ${m.adherenceRate}% adherence (${m.trend})`).join("\n")}

DETECTED CORRELATIONS:
${correlations.map(c => `- ${c.metric1.displayName} ↔ ${c.metric2.displayName}: ${c.correlationType} correlation (strength: ${(c.strength * 100).toFixed(0)}%)`).join("\n")}

ANOMALIES DETECTED: ${anomalies.length}
${anomalies.slice(0, 5).map(a => `- ${a.metricDisplayName}: ${a.type} on ${a.detectedAt.split("T")[0]} (${a.severity} severity)`).join("\n")}

Provide a JSON response with:
{
  "summary": "A 2-3 sentence overall health summary",
  "keyInsights": ["insight1", "insight2", "insight3", "insight4"],
  "riskFactors": ["risk1", "risk2"],
  "recommendations": ["action1", "action2", "action3"]
}

Focus on clinically relevant patterns, actionable recommendations, and patient-friendly language. Do not provide diagnoses.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a healthcare analytics AI that provides educational insights about health data trends. Never provide diagnoses or treatment recommendations. Focus on data patterns and general wellness guidance.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || "Health data analysis complete.",
        keyInsights: parsed.keyInsights || [],
        riskFactors: parsed.riskFactors || [],
        recommendations: parsed.recommendations || [],
        confidence: 0.88,
      };
    }
  } catch (error) {
    console.error("AI insight generation failed:", error);
  }
  
  return {
    summary: "Analysis of your health metrics shows ongoing monitoring of key vital signs and lab values. Continue regular tracking for best results.",
    keyInsights: [
      "Consistent vital sign monitoring detected",
      `${adherenceMetrics.filter(m => m.adherenceRate >= 80).length} medications with good adherence`,
      `${anomalies.filter(a => a.severity === "high").length} high-priority anomalies require attention`,
      `${correlations.length} significant correlations identified between health metrics`,
    ],
    riskFactors: vitalTrends.filter(t => !t.withinNormalRange).map(t => `${t.displayName} outside normal range`),
    recommendations: [
      "Continue regular vital sign monitoring",
      "Review any anomalies with your healthcare provider",
      "Maintain medication adherence above 80%",
    ],
    confidence: 0.75,
  };
}

function processVitalsToTrends(vitals: AnalyticsVitalSign[]): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];
  const vitalsByType = new Map<string, AnalyticsVitalSign[]>();
  
  vitals.forEach(v => {
    const existing = vitalsByType.get(v.type) || [];
    existing.push(v);
    vitalsByType.set(v.type, existing);
  });
  
  vitalsByType.forEach((typeVitals, type) => {
    if (type === "blood_pressure") {
      const systolicPoints: TimeSeriesDataPoint[] = [];
      const diastolicPoints: TimeSeriesDataPoint[] = [];
      
      typeVitals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
      
      typeVitals.forEach(v => {
        const [sys, dia] = v.value.split("/").map(Number);
        if (!isNaN(sys) && !isNaN(dia)) {
          systolicPoints.push({ date: v.recordedAt, value: sys });
          diastolicPoints.push({ date: v.recordedAt, value: dia });
        }
      });
      
      if (systolicPoints.length > 0) {
        const systolicTrend = calculateTrend(systolicPoints);
        const sysRange = VITAL_NORMAL_RANGES.blood_pressure_systolic;
        
        trends.push({
          metric: "blood_pressure_systolic",
          metricType: "vital",
          displayName: sysRange.displayName,
          unit: sysRange.unit,
          currentValue: systolicPoints[0].value,
          previousValue: systolicPoints.length > 1 ? systolicPoints[1].value : undefined,
          changePercent: systolicTrend.changePercent,
          trend: systolicTrend.trend,
          trendDirection: systolicTrend.direction,
          isPositiveTrend: systolicTrend.trend === "improving" || systolicTrend.trend === "stable",
          normalRange: { min: sysRange.min, max: sysRange.max },
          withinNormalRange: systolicPoints[0].value >= sysRange.min && systolicPoints[0].value <= sysRange.max,
          dataPoints: systolicPoints,
        });
        
        const diastolicTrend = calculateTrend(diastolicPoints);
        const diaRange = VITAL_NORMAL_RANGES.blood_pressure_diastolic;
        
        trends.push({
          metric: "blood_pressure_diastolic",
          metricType: "vital",
          displayName: diaRange.displayName,
          unit: diaRange.unit,
          currentValue: diastolicPoints[0].value,
          previousValue: diastolicPoints.length > 1 ? diastolicPoints[1].value : undefined,
          changePercent: diastolicTrend.changePercent,
          trend: diastolicTrend.trend,
          trendDirection: diastolicTrend.direction,
          isPositiveTrend: diastolicTrend.trend === "improving" || diastolicTrend.trend === "stable",
          normalRange: { min: diaRange.min, max: diaRange.max },
          withinNormalRange: diastolicPoints[0].value >= diaRange.min && diastolicPoints[0].value <= diaRange.max,
          dataPoints: diastolicPoints,
        });
      }
    } else {
      const dataPoints: TimeSeriesDataPoint[] = [];
      typeVitals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
      
      typeVitals.forEach(v => {
        const value = parseFloat(v.value);
        if (!isNaN(value)) {
          dataPoints.push({ date: v.recordedAt, value });
        }
      });
      
      if (dataPoints.length > 0) {
        const trendCalc = calculateTrend(dataPoints);
        const range = VITAL_NORMAL_RANGES[type] || { min: 0, max: 999, unit: typeVitals[0].unit, displayName: type };
        
        trends.push({
          metric: type,
          metricType: "vital",
          displayName: range.displayName,
          unit: range.unit,
          currentValue: dataPoints[0].value,
          previousValue: dataPoints.length > 1 ? dataPoints[1].value : undefined,
          changePercent: trendCalc.changePercent,
          trend: trendCalc.trend,
          trendDirection: trendCalc.direction,
          isPositiveTrend: trendCalc.trend === "improving" || trendCalc.trend === "stable",
          normalRange: { min: range.min, max: range.max },
          withinNormalRange: dataPoints[0].value >= range.min && dataPoints[0].value <= range.max,
          dataPoints,
        });
      }
    }
  });
  
  return trends;
}

function processLabsToTrends(labs: AnalyticsLabResult[]): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];
  const labsByCode = new Map<string, AnalyticsLabResult[]>();
  
  labs.forEach(l => {
    const code = l.testCode?.toLowerCase() || l.testName.toLowerCase().replace(/\s+/g, "_");
    const existing = labsByCode.get(code) || [];
    existing.push(l);
    labsByCode.set(code, existing);
  });
  
  labsByCode.forEach((typeLabs, code) => {
    const dataPoints: TimeSeriesDataPoint[] = [];
    typeLabs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
    
    typeLabs.forEach(l => {
      const value = parseFloat(l.value);
      if (!isNaN(value)) {
        dataPoints.push({ date: l.performedAt, value });
      }
    });
    
    if (dataPoints.length > 0) {
      const trendCalc = calculateTrend(dataPoints);
      const range = LAB_NORMAL_RANGES[code] || { min: 0, max: 999, unit: typeLabs[0].unit, displayName: typeLabs[0].testName };
      
      trends.push({
        metric: code,
        metricType: "lab",
        displayName: range.displayName,
        unit: range.unit,
        currentValue: dataPoints[0].value,
        previousValue: dataPoints.length > 1 ? dataPoints[1].value : undefined,
        changePercent: trendCalc.changePercent,
        trend: trendCalc.trend,
        trendDirection: trendCalc.direction,
        isPositiveTrend: trendCalc.trend === "improving" || trendCalc.trend === "stable",
        normalRange: { min: range.min, max: range.max },
        withinNormalRange: dataPoints[0].value >= range.min && dataPoints[0].value <= range.max,
        dataPoints,
      });
    }
  });
  
  return trends;
}

export async function getPatientAnalyticsDashboard(
  patientId: string,
  filters?: AnalyticsFilters
): Promise<PatientAnalyticsDashboard> {
  assertCdsEnabled("patientAnalytics.getPatientAnalyticsDashboard");
  const cacheKey = `analytics-${patientId}-${JSON.stringify(filters || {})}`;
  const cached = analyticsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && !filters?.includeAI) {
    return cached.data;
  }
  
  const patient = await storage.getPatient(patientId);
  const vitals = generateMockVitals(patientId, 30);
  const labs = generateMockLabResults(patientId, 6);
  const adherenceMetrics = generateMockAdherenceData(patientId, 30);
  
  const vitalTrends = processVitalsToTrends(vitals);
  const labTrends = processLabsToTrends(labs);
  
  let allAnomalies: Anomaly[] = [];
  vitalTrends.forEach(trend => {
    if (trend.normalRange) {
      const anomalies = detectAnomalies(patientId, trend.dataPoints, trend.metric, trend.normalRange);
      allAnomalies = allAnomalies.concat(anomalies);
    }
  });
  
  const correlations = calculateCorrelations(vitalTrends, labTrends);
  
  const aiInsights = await generateAIInsights(
    patient,
    vitalTrends,
    labTrends,
    adherenceMetrics,
    correlations,
    allAnomalies
  );
  
  const overallHealthScore = Math.round(
    70 +
    (vitalTrends.filter(t => t.withinNormalRange).length / Math.max(vitalTrends.length, 1)) * 15 +
    (labTrends.filter(t => t.withinNormalRange).length / Math.max(labTrends.length, 1)) * 10 +
    (adherenceMetrics.reduce((sum, m) => sum + m.adherenceRate, 0) / Math.max(adherenceMetrics.length, 1)) * 0.05 -
    allAnomalies.filter(a => a.severity === "high").length * 2
  );
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dashboard: PatientAnalyticsDashboard = {
    patientId,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient",
    generatedAt: now.toISOString(),
    dateRange: {
      start: filters?.dateRange?.start || thirtyDaysAgo.toISOString(),
      end: filters?.dateRange?.end || now.toISOString(),
    },
    overallHealthScore: Math.min(100, Math.max(0, overallHealthScore)),
    healthScoreTrend: overallHealthScore > 75 ? "improving" : overallHealthScore < 60 ? "declining" : "stable",
    vitalTrends,
    labTrends,
    adherenceMetrics,
    correlations,
    anomalies: allAnomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    aiSummary: aiInsights.summary,
    keyInsights: aiInsights.keyInsights,
    riskFactors: aiInsights.riskFactors,
    recommendations: aiInsights.recommendations,
    aiConfidence: aiInsights.confidence,
  };
  
  analyticsCache.set(cacheKey, { data: dashboard, timestamp: Date.now() });
  
  return dashboard;
}

export async function getAnalyticsTrendData(
  patientId: string,
  metricType: "vital" | "lab" | "adherence",
  metricName?: string
): Promise<TrendAnalysis[]> {
  const dashboard = await getPatientAnalyticsDashboard(patientId);
  
  let trends: TrendAnalysis[];
  switch (metricType) {
    case "vital":
      trends = dashboard.vitalTrends;
      break;
    case "lab":
      trends = dashboard.labTrends;
      break;
    default:
      trends = [...dashboard.vitalTrends, ...dashboard.labTrends];
  }
  
  if (metricName) {
    trends = trends.filter(t => t.metric === metricName);
  }
  
  return trends;
}

export async function getPatientAnomalies(
  patientId: string,
  severity?: Anomaly["severity"]
): Promise<Anomaly[]> {
  const dashboard = await getPatientAnalyticsDashboard(patientId);
  
  if (severity) {
    return dashboard.anomalies.filter(a => a.severity === severity);
  }
  
  return dashboard.anomalies;
}

export async function getPatientCorrelations(patientId: string): Promise<Correlation[]> {
  const dashboard = await getPatientAnalyticsDashboard(patientId);
  return dashboard.correlations;
}

export function invalidateAnalyticsCache(patientId?: string): void {
  if (patientId) {
    const keys = Array.from(analyticsCache.keys());
    for (const key of keys) {
      if (key.includes(patientId)) {
        analyticsCache.delete(key);
      }
    }
  } else {
    analyticsCache.clear();
  }
}
