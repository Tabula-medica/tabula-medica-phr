import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

export interface HealthRiskIndicator {
  id: string;
  category: "vital_trend" | "lab_abnormality" | "medication_interaction" | "adherence" | "lifestyle" | "chronic_progression";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  dataPoints: string[];
  suggestedQuestions: string[];
  lastUpdated: string;
}

export interface ProactiveRiskSummary {
  patientId: string;
  overallRiskScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  lastAnalyzedAt: string;
  indicators: HealthRiskIndicator[];
  trendingFactors: {
    improving: string[];
    stable: string[];
    worsening: string[];
  };
  nextReviewDate: string;
}

interface PatientHealthData {
  patientId: string;
  conditions: string[];
  medications: { name: string; dose: string; frequency: string }[];
  allergies: string[];
  vitals: { type: string; value: string; unit: string; date: string }[];
  labResults: { testName: string; value: string; unit: string; status: string; date: string }[];
  adherenceRate?: number;
  lastVisit?: string;
}

function generateId(): string {
  return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const SAFE_VERBS = ["shows", "states", "indicates", "displays", "records", "demonstrates", "reflects", "notes", "documents", "presents"];

function sanitizeAIOutput(text: string): string {
  const prohibitedPatterns = [
    /\b(you should|you must|you need to|we recommend|I recommend|I suggest|please consider|it's important to|make sure to)\b/gi,
    /\b(take|start|stop|increase|decrease|change)\s+(your|the)\s+(medication|dose|treatment)/gi,
    /\b(seek|get|schedule|book)\s+(medical|emergency|immediate|urgent)\s+(attention|care|help|treatment)/gi,
  ];

  let sanitized = text;
  for (const pattern of prohibitedPatterns) {
    sanitized = sanitized.replace(pattern, "Your healthcare provider can discuss");
  }
  return sanitized;
}

function calculateRiskFromVitals(vitals: PatientHealthData["vitals"]): HealthRiskIndicator[] {
  const indicators: HealthRiskIndicator[] = [];
  const vitalsByType: Record<string, typeof vitals> = {};

  for (const vital of vitals) {
    if (!vitalsByType[vital.type]) vitalsByType[vital.type] = [];
    vitalsByType[vital.type].push(vital);
  }

  const normalRanges: Record<string, { min: number; max: number; criticalMin?: number; criticalMax?: number }> = {
    blood_pressure_systolic: { min: 90, max: 140, criticalMin: 70, criticalMax: 180 },
    heart_rate: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 },
    oxygen_saturation: { min: 95, max: 100, criticalMin: 88 },
    temperature: { min: 97, max: 99.5, criticalMin: 95, criticalMax: 103 },
    respiratory_rate: { min: 12, max: 20, criticalMin: 8, criticalMax: 30 },
    blood_glucose: { min: 70, max: 140, criticalMin: 50, criticalMax: 300 },
  };

  for (const [type, readings] of Object.entries(vitalsByType)) {
    const sorted = readings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sorted.length === 0) continue;

    const latest = sorted[0];
    const latestValue = parseFloat(latest.value.split("/")[0]);
    const range = normalRanges[type];

    if (range) {
      let severity: HealthRiskIndicator["severity"] = "low";
      let title = "";
      let description = "";

      if (range.criticalMin && latestValue < range.criticalMin) {
        severity = "critical";
        title = `Critical ${type.replace(/_/g, " ")} reading`;
        description = `Latest ${type.replace(/_/g, " ")} shows ${latest.value} ${latest.unit}, which is below typical ranges.`;
      } else if (range.criticalMax && latestValue > range.criticalMax) {
        severity = "critical";
        title = `Critical ${type.replace(/_/g, " ")} reading`;
        description = `Latest ${type.replace(/_/g, " ")} shows ${latest.value} ${latest.unit}, which is above typical ranges.`;
      } else if (latestValue < range.min) {
        severity = "medium";
        title = `${type.replace(/_/g, " ")} below typical range`;
        description = `Latest ${type.replace(/_/g, " ")} shows ${latest.value} ${latest.unit}. Typical range is ${range.min}-${range.max}.`;
      } else if (latestValue > range.max) {
        severity = "medium";
        title = `${type.replace(/_/g, " ")} above typical range`;
        description = `Latest ${type.replace(/_/g, " ")} shows ${latest.value} ${latest.unit}. Typical range is ${range.min}-${range.max}.`;
      }

      if (title) {
        indicators.push({
          id: generateId(),
          category: "vital_trend",
          severity,
          title,
          description,
          dataPoints: sorted.slice(0, 3).map(v => `${v.date}: ${v.value} ${v.unit}`),
          suggestedQuestions: [
            "What might be affecting my " + type.replace(/_/g, " ") + " readings?",
            "What does this " + type.replace(/_/g, " ") + " reading mean for my health?",
          ],
          lastUpdated: latest.date,
        });
      }

      if (sorted.length >= 3) {
        const values = sorted.slice(0, 5).map(v => parseFloat(v.value.split("/")[0]));
        const trend = values[0] - values[values.length - 1];
        const avgChange = trend / values.length;

        if (Math.abs(avgChange) > (range.max - range.min) * 0.1) {
          const trendDirection = avgChange > 0 ? "upward" : "downward";
          indicators.push({
            id: generateId(),
            category: "vital_trend",
            severity: "low",
            title: `${type.replace(/_/g, " ")} shows ${trendDirection} trend`,
            description: `Your ${type.replace(/_/g, " ")} readings show a consistent ${trendDirection} pattern over recent measurements.`,
            dataPoints: sorted.slice(0, 5).map(v => `${v.date}: ${v.value} ${v.unit}`),
            suggestedQuestions: [
              "Is this trend in my " + type.replace(/_/g, " ") + " something to discuss?",
            ],
            lastUpdated: sorted[0].date,
          });
        }
      }
    }
  }

  return indicators;
}

function calculateRiskFromLabs(labs: PatientHealthData["labResults"]): HealthRiskIndicator[] {
  const indicators: HealthRiskIndicator[] = [];
  const labsByTest: Record<string, typeof labs> = {};

  for (const lab of labs) {
    if (!labsByTest[lab.testName]) labsByTest[lab.testName] = [];
    labsByTest[lab.testName].push(lab);
  }

  for (const [testName, results] of Object.entries(labsByTest)) {
    const sorted = results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];

    if (latest.status === "critical" || latest.status === "abnormal") {
      const severity = latest.status === "critical" ? "high" : "medium";
      indicators.push({
        id: generateId(),
        category: "lab_abnormality",
        severity,
        title: `${testName} shows ${latest.status} result`,
        description: `Your most recent ${testName} result is ${latest.value} ${latest.unit}, which is ${latest.status}.`,
        dataPoints: sorted.slice(0, 3).map(l => `${l.date}: ${l.value} ${l.unit} (${l.status})`),
        suggestedQuestions: [
          `What does my ${testName} result mean?`,
          `What factors can affect ${testName} levels?`,
        ],
        lastUpdated: latest.date,
      });
    }
  }

  return indicators;
}

function checkMedicationInteractions(medications: PatientHealthData["medications"]): HealthRiskIndicator[] {
  const indicators: HealthRiskIndicator[] = [];
  const knownInteractions: Record<string, string[]> = {
    warfarin: ["aspirin", "ibuprofen", "naproxen", "vitamin k"],
    metformin: ["contrast dye", "alcohol"],
    lisinopril: ["potassium supplements", "spironolactone"],
    simvastatin: ["grapefruit", "erythromycin", "clarithromycin"],
  };

  const medNames = medications.map(m => m.name.toLowerCase());

  for (const [med, interactions] of Object.entries(knownInteractions)) {
    if (medNames.includes(med)) {
      const conflicts = interactions.filter(i => medNames.includes(i));
      if (conflicts.length > 0) {
        indicators.push({
          id: generateId(),
          category: "medication_interaction",
          severity: "high",
          title: `Potential medication interaction noted`,
          description: `Your medication list includes ${med} along with ${conflicts.join(", ")}. Your healthcare provider can review these combinations.`,
          dataPoints: medications.map(m => `${m.name} ${m.dose} ${m.frequency}`),
          suggestedQuestions: [
            "Can you explain how these medications interact?",
            "Are there alternatives I should ask my provider about?",
          ],
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  }

  return indicators;
}

function calculateOverallRiskScore(indicators: HealthRiskIndicator[]): { score: number; level: ProactiveRiskSummary["riskLevel"] } {
  let score = 0;

  for (const indicator of indicators) {
    switch (indicator.severity) {
      case "critical": score += 30; break;
      case "high": score += 20; break;
      case "medium": score += 10; break;
      case "low": score += 5; break;
    }
  }

  score = Math.min(score, 100);

  let level: ProactiveRiskSummary["riskLevel"];
  if (score >= 70) level = "high";
  else if (score >= 50) level = "elevated";
  else if (score >= 25) level = "moderate";
  else level = "low";

  return { score, level };
}

async function generateAIRiskAnalysis(
  patientData: PatientHealthData,
  existingIndicators: HealthRiskIndicator[]
): Promise<{ additionalInsights: string[]; trendingFactors: ProactiveRiskSummary["trendingFactors"] }> {
  try {
    const prompt = `You are a health data analysis assistant. Analyze the following patient health data and identify patterns. Do NOT provide medical advice, recommendations, or diagnoses. Use only safe verbs like "shows", "indicates", "documents", "records".

Patient Conditions: ${patientData.conditions.join(", ") || "None documented"}
Medications: ${patientData.medications.map(m => `${m.name} ${m.dose}`).join(", ") || "None documented"}
Recent Vitals Summary: ${patientData.vitals.slice(0, 5).map(v => `${v.type}: ${v.value}`).join(", ") || "None"}
Recent Labs Summary: ${patientData.labResults.slice(0, 5).map(l => `${l.testName}: ${l.value} (${l.status})`).join(", ") || "None"}

Already identified indicators: ${existingIndicators.map(i => i.title).join("; ")}

Provide a brief JSON response with:
1. "improving": array of factors that show positive trends (max 3)
2. "stable": array of factors that show stable patterns (max 3)  
3. "worsening": array of factors that show concerning patterns (max 3)

Only include factors supported by the data. Use neutral, factual language.`;

    const content = await generatePhiSafeText({
      user: prompt,
      temperature: 0.3,
      maxTokens: 500,
      responseMimeType: "application/json",
    });

    if (content) {
      const parsed = JSON.parse(content);
      return {
        additionalInsights: [],
        trendingFactors: {
          improving: (parsed.improving || []).map(sanitizeAIOutput),
          stable: (parsed.stable || []).map(sanitizeAIOutput),
          worsening: (parsed.worsening || []).map(sanitizeAIOutput),
        },
      };
    }
  } catch (error) {
    console.log("[AIProactiveRisk] AI analysis unavailable, using rule-based only");
  }

  return {
    additionalInsights: [],
    trendingFactors: {
      improving: [],
      stable: existingIndicators.filter(i => i.severity === "low").slice(0, 2).map(i => i.title),
      worsening: existingIndicators.filter(i => i.severity === "high" || i.severity === "critical").slice(0, 2).map(i => i.title),
    },
  };
}

export async function analyzePatientHealthRisks(
  patientData: PatientHealthData,
  userId: string,
  sessionId?: string
): Promise<ProactiveRiskSummary> {
  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "patient_health_data",
    resourceId: patientData.patientId,
    details: `AI proactive health risk analysis performed${sessionId ? ` (session: ${sessionId})` : ""}`,
  });

  const vitalIndicators = calculateRiskFromVitals(patientData.vitals);
  const labIndicators = calculateRiskFromLabs(patientData.labResults);
  const medicationIndicators = checkMedicationInteractions(patientData.medications);

  const allIndicators = [...vitalIndicators, ...labIndicators, ...medicationIndicators];
  const { score, level } = calculateOverallRiskScore(allIndicators);

  const aiAnalysis = await generateAIRiskAnalysis(patientData, allIndicators);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + (level === "high" ? 1 : level === "elevated" ? 7 : 30));

  return {
    patientId: patientData.patientId,
    overallRiskScore: score,
    riskLevel: level,
    lastAnalyzedAt: new Date().toISOString(),
    indicators: allIndicators.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    trendingFactors: aiAnalysis.trendingFactors,
    nextReviewDate: nextReview.toISOString(),
  };
}

export function getMockPatientData(patientId: string): PatientHealthData {
  return {
    patientId,
    conditions: ["Type 2 Diabetes", "Hypertension", "High Cholesterol"],
    medications: [
      { name: "Metformin", dose: "500mg", frequency: "twice daily" },
      { name: "Lisinopril", dose: "10mg", frequency: "once daily" },
      { name: "Simvastatin", dose: "20mg", frequency: "once daily at bedtime" },
    ],
    allergies: ["Penicillin", "Sulfa"],
    vitals: [
      { type: "blood_pressure_systolic", value: "145", unit: "mmHg", date: new Date(Date.now() - 86400000).toISOString() },
      { type: "blood_pressure_systolic", value: "142", unit: "mmHg", date: new Date(Date.now() - 172800000).toISOString() },
      { type: "blood_pressure_systolic", value: "148", unit: "mmHg", date: new Date(Date.now() - 259200000).toISOString() },
      { type: "heart_rate", value: "78", unit: "bpm", date: new Date(Date.now() - 86400000).toISOString() },
      { type: "blood_glucose", value: "165", unit: "mg/dL", date: new Date(Date.now() - 86400000).toISOString() },
      { type: "blood_glucose", value: "152", unit: "mg/dL", date: new Date(Date.now() - 172800000).toISOString() },
      { type: "oxygen_saturation", value: "97", unit: "%", date: new Date(Date.now() - 86400000).toISOString() },
    ],
    labResults: [
      { testName: "HbA1c", value: "7.8", unit: "%", status: "abnormal", date: new Date(Date.now() - 604800000).toISOString() },
      { testName: "LDL Cholesterol", value: "142", unit: "mg/dL", status: "abnormal", date: new Date(Date.now() - 604800000).toISOString() },
      { testName: "Creatinine", value: "1.1", unit: "mg/dL", status: "normal", date: new Date(Date.now() - 604800000).toISOString() },
      { testName: "eGFR", value: "78", unit: "mL/min", status: "normal", date: new Date(Date.now() - 604800000).toISOString() },
    ],
    adherenceRate: 85,
    lastVisit: new Date(Date.now() - 2592000000).toISOString(),
  };
}

console.log("[AIProactiveRiskAnalysis] Service initialized");
