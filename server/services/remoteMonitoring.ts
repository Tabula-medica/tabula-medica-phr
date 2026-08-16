import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import type { Patient, VitalSign, LabResult, MedicalRecord, Problem } from "@shared/schema";

export interface VitalTrend {
  type: string;
  currentValue: string;
  unit: string;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  changePercent: number;
  normalRange: { min: number; max: number };
  isNormal: boolean;
  readings: { value: string; date: string }[];
}

export interface DeteriorationAlert {
  id: string;
  patientId: string;
  severity: "critical" | "warning" | "watch";
  category: "vital_signs" | "lab_results" | "symptoms" | "medication" | "general";
  title: string;
  description: string;
  detectedAt: string;
  indicators: string[];
  recommendedActions: string[];
  notifyProvider: boolean;
  relatedVitals?: string[];
  relatedLabs?: string[];
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface MonitoringStatus {
  patientId: string;
  overallRisk: "low" | "moderate" | "high" | "critical";
  lastAssessment: string;
  vitalTrends: VitalTrend[];
  activeAlerts: DeteriorationAlert[];
  recentChanges: string[];
  nextRecommendedReading: {
    type: string;
    recommendedTime: string;
    reason: string;
  }[];
}

export interface HealthSnapshot {
  patientId: string;
  generatedAt: string;
  summary: string;
  keyFindings: string[];
  concernAreas: string[];
  positiveIndicators: string[];
  actionItems: string[];
}

interface PatientMonitoringContext {
  patient: Patient | undefined;
  vitals: VitalSign[];
  labResults: LabResult[];
  conditions: MedicalRecord[];
  problems: Problem[];
}

const NORMAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  blood_pressure_systolic: { min: 90, max: 120, unit: "mmHg" },
  blood_pressure_diastolic: { min: 60, max: 80, unit: "mmHg" },
  heart_rate: { min: 60, max: 100, unit: "bpm" },
  temperature: { min: 97, max: 99, unit: "°F" },
  oxygen_saturation: { min: 95, max: 100, unit: "%" },
  respiratory_rate: { min: 12, max: 20, unit: "breaths/min" },
  weight: { min: 0, max: 999, unit: "lbs" },
};

async function getPatientMonitoringContext(patientId: string): Promise<PatientMonitoringContext> {
  const [patient, records, problems] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getProblemsByPatient ? storage.getProblemsByPatient(patientId) : Promise.resolve([]),
  ]);

  const conditions = records.filter(r => r.type === "diagnosis" && r.status === "active");
  const activeProblems = problems.filter(p => p.status === "active");

  const vitals = generateMockVitals(patientId);
  const labResults = generateMockLabResults(patientId);

  return {
    patient,
    vitals,
    labResults,
    conditions,
    problems: activeProblems,
  };
}

function generateMockVitals(patientId: string): VitalSign[] {
  const vitals: VitalSign[] = [];
  const types: VitalSign["type"][] = ["blood_pressure", "heart_rate", "temperature", "oxygen_saturation", "respiratory_rate", "weight"];
  const now = new Date();

  for (let day = 0; day < 14; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);

    for (const type of types) {
      let value: string;
      let unit: string;

      switch (type) {
        case "blood_pressure":
          const systolic = 115 + Math.floor(Math.random() * 20) - 5 + (day > 7 ? 10 : 0);
          const diastolic = 75 + Math.floor(Math.random() * 10) - 5;
          value = `${systolic}/${diastolic}`;
          unit = "mmHg";
          break;
        case "heart_rate":
          value = String(72 + Math.floor(Math.random() * 20) - 10);
          unit = "bpm";
          break;
        case "temperature":
          value = (98.2 + Math.random() * 0.8).toFixed(1);
          unit = "°F";
          break;
        case "oxygen_saturation":
          value = String(96 + Math.floor(Math.random() * 4));
          unit = "%";
          break;
        case "respiratory_rate":
          value = String(14 + Math.floor(Math.random() * 6));
          unit = "breaths/min";
          break;
        case "weight":
          value = String(165 + Math.floor(Math.random() * 3));
          unit = "lbs";
          break;
        default:
          value = "0";
          unit = "";
      }

      vitals.push({
        id: `vital_${type}_${day}`,
        patientId,
        ehrConnectionId: "mock",
        type,
        value,
        unit,
        recordedAt: date.toISOString(),
        recordedBy: "Patient",
      });
    }
  }

  return vitals;
}

function generateMockLabResults(patientId: string): LabResult[] {
  const labs: LabResult[] = [];
  const now = new Date();

  const labTypes = [
    { name: "Hemoglobin A1c", value: "6.8", unit: "%", normalMin: "4", normalMax: "5.6" },
    { name: "Glucose, Fasting", value: "105", unit: "mg/dL", normalMin: "70", normalMax: "100" },
    { name: "Cholesterol, Total", value: "195", unit: "mg/dL", normalMin: "0", normalMax: "200" },
    { name: "Creatinine", value: "1.1", unit: "mg/dL", normalMin: "0.7", normalMax: "1.3" },
    { name: "eGFR", value: "85", unit: "mL/min/1.73m²", normalMin: "90", normalMax: "120" },
  ];

  for (let i = 0; i < labTypes.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    const lab = labTypes[i];
    
    labs.push({
      id: `lab_${i}`,
      patientId,
      ehrConnectionId: "mock",
      testName: lab.name,
      value: lab.value,
      unit: lab.unit,
      referenceRange: `${lab.normalMin}-${lab.normalMax}`,
      status: parseFloat(lab.value) >= parseFloat(lab.normalMin) && parseFloat(lab.value) <= parseFloat(lab.normalMax) ? "normal" : "abnormal",
      date: date.toISOString(),
      orderedBy: "Dr. Smith",
      facility: "Mock Clinic",
    });
  }

  return labs;
}

function analyzeVitalTrends(vitals: VitalSign[]): VitalTrend[] {
  const trends: VitalTrend[] = [];
  const typeGroups: Record<string, VitalSign[]> = {};

  for (const vital of vitals) {
    if (!typeGroups[vital.type]) {
      typeGroups[vital.type] = [];
    }
    typeGroups[vital.type].push(vital);
  }

  for (const type of Object.keys(typeGroups)) {
    const readings = typeGroups[type];
    const sorted = readings.sort((a: VitalSign, b: VitalSign) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    if (sorted.length === 0) continue;

    const currentValue = sorted[0].value;
    let numericCurrent: number;
    
    if (type === "blood_pressure") {
      numericCurrent = parseInt(currentValue.split("/")[0]);
    } else {
      numericCurrent = parseFloat(currentValue);
    }

    const values = sorted.map(v => {
      if (type === "blood_pressure") {
        return parseInt(v.value.split("/")[0]);
      }
      return parseFloat(v.value);
    });

    let trend: "increasing" | "decreasing" | "stable" | "fluctuating" = "stable";
    let changePercent = 0;

    if (values.length >= 3) {
      const recentAvg = (values[0] + values[1] + values[2]) / 3;
      const olderAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.slice(-3).length);
      changePercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);

      if (changePercent > 5) trend = "increasing";
      else if (changePercent < -5) trend = "decreasing";
      
      const variance = values.reduce((sum, v) => sum + Math.pow(v - numericCurrent, 2), 0) / values.length;
      if (Math.sqrt(variance) > numericCurrent * 0.1) trend = "fluctuating";
    }

    const rangeKey = type === "blood_pressure" ? "blood_pressure_systolic" : type;
    const normalRange = NORMAL_RANGES[rangeKey] || { min: 0, max: 999 };
    const isNormal = numericCurrent >= normalRange.min && numericCurrent <= normalRange.max;

    trends.push({
      type,
      currentValue,
      unit: sorted[0].unit,
      trend,
      changePercent: Math.abs(changePercent),
      normalRange,
      isNormal,
      readings: sorted.slice(0, 7).map(r => ({ value: r.value, date: r.recordedAt })),
    });
  }

  return trends;
}

export async function analyzePatientHealth(patientId: string): Promise<MonitoringStatus> {
  const context = await getPatientMonitoringContext(patientId);
  const vitalTrends = analyzeVitalTrends(context.vitals);
  
  const abnormalVitals = vitalTrends.filter(t => !t.isNormal || t.trend === "increasing" && t.changePercent > 10);
  const abnormalLabs = context.labResults.filter(l => l.status === "abnormal");

  let overallRisk: "low" | "moderate" | "high" | "critical" = "low";
  if (abnormalVitals.length > 0 || abnormalLabs.length > 0) overallRisk = "moderate";
  if (abnormalVitals.length >= 2 || abnormalLabs.length >= 2) overallRisk = "high";

  const responseText = await generatePhiSafeText({
    system: `You are a clinical decision support system analyzing patient monitoring data for early signs of health deterioration.

Return a JSON object with:
- alerts: array of 0-3 alerts if concerning patterns detected, each with:
  - severity: "critical" | "warning" | "watch"
  - category: "vital_signs" | "lab_results" | "symptoms" | "medication" | "general"
  - title: string (brief, clinical)
  - description: string (2-3 sentences explaining the concern)
  - indicators: string[] (specific data points triggering this alert)
  - recommendedActions: string[] (2-4 actionable steps)
  - notifyProvider: boolean (true for critical/warning)
- recentChanges: string[] (3-5 notable changes in patient data)
- nextReadings: array of recommended readings, each with:
  - type: string (vital sign type)
  - hoursFromNow: number
  - reason: string

Consider:
- Trends over time, not just single readings
- Combinations of findings (e.g., elevated BP + increased heart rate)
- Patient's underlying conditions
- Rate of change matters for deterioration detection`,
    user: `Analyze health status for patient with:
Conditions: ${[...context.conditions.map(c => c.title), ...context.problems.map(p => p.name)].join(", ") || "none"}

Vital Sign Trends:
${vitalTrends.map(t =>
  `- ${t.type}: ${t.currentValue} ${t.unit} (${t.trend}, ${t.changePercent}% change, ${t.isNormal ? "normal" : "ABNORMAL"})`
).join("\n")}

Recent Lab Results:
${context.labResults.map(l =>
  `- ${l.testName}: ${l.value} ${l.unit} (range: ${l.referenceRange || 'N/A'}, ${l.status})`
).join("\n")}`,
    responseMimeType: "application/json",
    maxTokens: 2000,
  });

  const result = JSON.parse(responseText || "{}");

  const alerts: DeteriorationAlert[] = (result.alerts || []).map((a: any, idx: number) => ({
    id: `alert_${Date.now()}_${idx}`,
    patientId,
    severity: a.severity || "watch",
    category: a.category || "general",
    title: a.title,
    description: a.description,
    detectedAt: new Date().toISOString(),
    indicators: a.indicators || [],
    recommendedActions: a.recommendedActions || [],
    notifyProvider: a.notifyProvider || false,
  }));

  if (alerts.some(a => a.severity === "critical")) overallRisk = "critical";

  const now = new Date();
  const nextRecommendedReading = (result.nextReadings || []).map((r: any) => ({
    type: r.type,
    recommendedTime: new Date(now.getTime() + (r.hoursFromNow || 24) * 60 * 60 * 1000).toISOString(),
    reason: r.reason,
  }));

  return {
    patientId,
    overallRisk,
    lastAssessment: new Date().toISOString(),
    vitalTrends,
    activeAlerts: alerts,
    recentChanges: result.recentChanges || [],
    nextRecommendedReading,
  };
}

export async function generateHealthSnapshot(patientId: string): Promise<HealthSnapshot> {
  const context = await getPatientMonitoringContext(patientId);
  const vitalTrends = analyzeVitalTrends(context.vitals);

  const responseText = await generatePhiSafeText({
    system: `You are creating a patient-friendly health snapshot summary. Use simple language that patients can understand.

Return a JSON object with:
- summary: string (2-3 sentences overall health summary for the patient)
- keyFindings: string[] (3-5 important findings in plain language)
- concernAreas: string[] (0-3 areas that need attention, if any)
- positiveIndicators: string[] (2-4 positive health signs)
- actionItems: string[] (2-4 specific actions the patient can take)

Be:
- Encouraging but honest
- Clear about what's good and what needs attention
- Specific about action items
- Avoid medical jargon`,
    user: `Create a health snapshot for a patient with:
Conditions: ${[...context.conditions.map(c => c.title), ...context.problems.map(p => p.name)].join(", ") || "none"}

Recent Vitals:
${vitalTrends.map(t => `- ${t.type}: ${t.currentValue} ${t.unit} (${t.isNormal ? "normal" : "needs attention"})`).join("\n")}

Recent Labs:
${context.labResults.slice(0, 5).map(l => `- ${l.testName}: ${l.value} ${l.unit} (${l.status})`).join("\n")}`,
    responseMimeType: "application/json",
    maxTokens: 1500,
  });

  const result = JSON.parse(responseText || "{}");

  return {
    patientId,
    generatedAt: new Date().toISOString(),
    summary: result.summary || "Your health data is being monitored.",
    keyFindings: result.keyFindings || [],
    concernAreas: result.concernAreas || [],
    positiveIndicators: result.positiveIndicators || [],
    actionItems: result.actionItems || [],
  };
}

export async function detectDeteriorationPatterns(
  patientId: string
): Promise<DeteriorationAlert[]> {
  const status = await analyzePatientHealth(patientId);
  return status.activeAlerts.filter(a => a.severity === "critical" || a.severity === "warning");
}

export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<DeteriorationAlert | null> {
  return null;
}
