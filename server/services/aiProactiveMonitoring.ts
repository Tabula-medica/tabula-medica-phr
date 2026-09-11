import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";
import type {
  HealthMonitoringAlert,
  InterventionRecommendation,
  PatientMonitoringSummary,
  HealthAlertSeverity,
  HealthAlertCategory,
  InterventionType,
  InterventionPriority,
  InterventionStatus,
  HealthAlertStatus,
  VitalSign,
  LabResult,
  PromResponse,
} from "@shared/schema";

export interface PatientDataBundle {
  patientId: string;
  patientName: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  vitals: VitalSign[];
  labResults: LabResult[];
  promResponses: PromResponse[];
  journalEntries?: { date: string; content: string; sentiment?: string }[];
  recentAppointments?: { date: string; type: string; provider: string }[];
  adherenceHistory?: { date: string; medication: string; taken: boolean }[];
  carePlanGoals?: { goal: string; progress: number; status: string }[];
}

export interface AnalysisResult {
  alerts: Omit<HealthMonitoringAlert, "id" | "createdAt" | "updatedAt">[];
  interventions: Omit<InterventionRecommendation, "id" | "createdAt" | "updatedAt">[];
  summary: PatientMonitoringSummary;
}

function generateId(): string {
  return `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function analyzeVitalTrends(vitals: VitalSign[]): {
  type: string;
  trend: "improving" | "stable" | "worsening" | "critical";
  latestValue: string;
  unit: string;
  changePercent: number;
}[] {
  const vitalsByType = vitals.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = [];
    acc[v.type].push(v);
    return acc;
  }, {} as Record<string, VitalSign[]>);

  return Object.entries(vitalsByType).map(([type, readings]) => {
    const sorted = readings.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    const latest = sorted[0];
    const latestNum = parseFloat(latest.value.split("/")[0]) || parseFloat(latest.value);
    
    let trend: "improving" | "stable" | "worsening" | "critical" = "stable";
    let changePercent = 0;
    
    if (sorted.length > 1) {
      const previousNum = parseFloat(sorted[1].value.split("/")[0]) || parseFloat(sorted[1].value);
      changePercent = ((latestNum - previousNum) / previousNum) * 100;
      
      const normalRanges: Record<string, { min: number; max: number }> = {
        heart_rate: { min: 60, max: 100 },
        blood_pressure: { min: 90, max: 140 },
        temperature: { min: 97, max: 99 },
        oxygen_saturation: { min: 95, max: 100 },
        respiratory_rate: { min: 12, max: 20 },
      };
      
      const range = normalRanges[type];
      if (range) {
        if (latestNum < range.min * 0.8 || latestNum > range.max * 1.2) {
          trend = "critical";
        } else if (latestNum < range.min || latestNum > range.max) {
          trend = "worsening";
        } else if (Math.abs(changePercent) < 5) {
          trend = "stable";
        } else {
          trend = changePercent < 0 ? "improving" : "worsening";
        }
      }
    }

    return {
      type,
      trend,
      latestValue: latest.value,
      unit: latest.unit,
      changePercent: Math.round(changePercent * 10) / 10,
    };
  });
}

function analyzeLabTrends(labs: LabResult[]): {
  testName: string;
  trend: "improving" | "stable" | "worsening" | "critical";
  latestValue: string;
  unit: string;
  status: "normal" | "abnormal" | "critical";
}[] {
  const labsByTest = labs.reduce((acc, l) => {
    if (!acc[l.testName]) acc[l.testName] = [];
    acc[l.testName].push(l);
    return acc;
  }, {} as Record<string, LabResult[]>);

  return Object.entries(labsByTest).map(([testName, results]) => {
    const sorted = results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    
    let trend: "improving" | "stable" | "worsening" | "critical" = "stable";
    if (latest.status === "critical") {
      trend = "critical";
    } else if (latest.status === "abnormal") {
      trend = sorted.length > 1 && sorted[1].status === "abnormal" ? "worsening" : "worsening";
    } else if (sorted.length > 1 && sorted[1].status !== "normal") {
      trend = "improving";
    }

    return {
      testName,
      trend,
      latestValue: latest.value,
      unit: latest.unit,
      status: latest.status,
    };
  });
}

function calculateOverallRisk(
  vitalTrends: ReturnType<typeof analyzeVitalTrends>,
  labTrends: ReturnType<typeof analyzeLabTrends>,
  promScores: { severity: string }[]
): { level: HealthAlertSeverity; score: number } {
  let score = 0;
  
  vitalTrends.forEach(v => {
    if (v.trend === "critical") score += 30;
    else if (v.trend === "worsening") score += 15;
  });
  
  labTrends.forEach(l => {
    if (l.status === "critical") score += 25;
    else if (l.status === "abnormal") score += 10;
  });
  
  promScores.forEach(p => {
    if (p.severity === "severe") score += 20;
    else if (p.severity === "moderate") score += 10;
  });

  let level: HealthAlertSeverity;
  if (score >= 60) level = "critical";
  else if (score >= 40) level = "high";
  else if (score >= 20) level = "medium";
  else level = "low";

  return { level, score: Math.min(score, 100) };
}

async function generateAIAnalysis(
  data: PatientDataBundle,
  vitalTrends: ReturnType<typeof analyzeVitalTrends>,
  labTrends: ReturnType<typeof analyzeLabTrends>
): Promise<{
  alerts: {
    severity: HealthAlertSeverity;
    category: HealthAlertCategory;
    title: string;
    description: string;
    aiAnalysis: string;
    earlyWarningSignals: string[];
    recommendedActions: string[];
    riskScore: number;
    detectedPattern: string;
  }[];
  interventions: {
    type: InterventionType;
    priority: InterventionPriority;
    title: string;
    description: string;
    rationale: string;
    expectedOutcome: string;
    evidenceBasis: string[];
    actionSteps: { step: number; action: string; responsible: string }[];
    riskReduction: number;
    timeToEffect: string;
  }[];
}> {
  try {
    const prompt = `You are an AI health monitoring assistant analyzing patient data to detect early warning signs and recommend proactive interventions.

PATIENT CONTEXT:
- Name: ${data.patientName}
- Conditions: ${data.conditions.join(", ") || "None recorded"}
- Medications: ${data.medications.join(", ") || "None recorded"}
- Allergies: ${data.allergies.join(", ") || "None recorded"}

VITAL SIGN TRENDS (last 7 days):
${vitalTrends.map(v => `- ${v.type}: ${v.latestValue} ${v.unit} (trend: ${v.trend}, change: ${v.changePercent}%)`).join("\n")}

LAB RESULT TRENDS:
${labTrends.map(l => `- ${l.testName}: ${l.latestValue} ${l.unit} (status: ${l.status}, trend: ${l.trend})`).join("\n")}

${data.promResponses.length > 0 ? `PROM SCORES:\n${data.promResponses.slice(-5).map(p => `- Score: ${p.totalScore}, Severity: ${p.severity}`).join("\n")}` : ""}

${data.journalEntries?.length ? `RECENT JOURNAL ENTRIES:\n${data.journalEntries.slice(-3).map(j => `- ${j.date}: ${j.content.slice(0, 100)}... (sentiment: ${j.sentiment || "unknown"})`).join("\n")}` : ""}

${data.adherenceHistory?.length ? `MEDICATION ADHERENCE: ${Math.round((data.adherenceHistory.filter(a => a.taken).length / data.adherenceHistory.length) * 100)}% over last 30 days` : ""}

Analyze this data and return a JSON object with:
1. "alerts": Array of detected health concerns (max 3 most significant)
   - severity: "critical" | "high" | "medium" | "low"
   - category: "vital_signs" | "lab_results" | "prom_scores" | "medication_adherence" | "symptom_progression" | "composite_risk"
   - title: Brief alert title
   - description: Detailed description
   - aiAnalysis: Your clinical analysis
   - earlyWarningSignals: Array of early warning signs detected
   - recommendedActions: Array of recommended actions
   - riskScore: 0-100
   - detectedPattern: Pattern that triggered alert

2. "interventions": Array of recommended interventions (max 2)
   - type: "medication_adjustment" | "care_plan_modification" | "urgent_consultation" | "lifestyle_recommendation" | "monitoring_frequency_increase" | "patient_outreach" | "specialist_referral"
   - priority: "immediate" | "urgent" | "routine"
   - title: Intervention title
   - description: What should be done
   - rationale: Why this intervention
   - expectedOutcome: Expected results
   - evidenceBasis: Array of evidence supporting this
   - actionSteps: Array of {step, action, responsible}
   - riskReduction: Expected % reduction in risk
   - timeToEffect: Time until effect visible

Focus on early warning signs and preventive interventions. Be specific and actionable.`;

    const content = await generatePhiSafeText({
      system: "You are a clinical decision support AI. Analyze patient data and provide alerts and intervention recommendations. Return valid JSON only.",
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("[AI Proactive Monitoring] AI gateway error:", error);
    return generateFallbackAnalysis(data, vitalTrends, labTrends);
  }
}

function generateFallbackAnalysis(
  data: PatientDataBundle,
  vitalTrends: ReturnType<typeof analyzeVitalTrends>,
  labTrends: ReturnType<typeof analyzeLabTrends>
): {
  alerts: any[];
  interventions: any[];
} {
  const alerts: any[] = [];
  const interventions: any[] = [];

  vitalTrends.forEach(v => {
    if (v.trend === "critical" || v.trend === "worsening") {
      alerts.push({
        severity: v.trend === "critical" ? "critical" : "high",
        category: "vital_signs",
        title: `${v.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Alert`,
        description: `${v.type.replace(/_/g, " ")} showing ${v.trend} trend with value ${v.latestValue} ${v.unit}`,
        aiAnalysis: `Detected ${v.trend} trend in ${v.type.replace(/_/g, " ")}. Current reading of ${v.latestValue} ${v.unit} represents a ${Math.abs(v.changePercent)}% change from previous measurement.`,
        earlyWarningSignals: [`${v.type.replace(/_/g, " ")} ${v.trend} trend`, `${Math.abs(v.changePercent)}% deviation from previous`],
        recommendedActions: ["Review patient vital sign history", "Consider scheduling follow-up assessment", "Verify measurement accuracy"],
        riskScore: v.trend === "critical" ? 80 : 50,
        detectedPattern: `${v.trend} ${v.type.replace(/_/g, " ")} pattern`,
      });

      if (v.trend === "critical") {
        interventions.push({
          type: "urgent_consultation",
          priority: "urgent",
          title: `Urgent Review for ${v.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`,
          description: `Schedule urgent consultation to address critical ${v.type.replace(/_/g, " ")} readings`,
          rationale: `Patient's ${v.type.replace(/_/g, " ")} has reached critical levels requiring immediate clinical attention`,
          expectedOutcome: "Early intervention to prevent deterioration",
          evidenceBasis: ["Critical vital sign deviation detected", "Pattern analysis indicates worsening trend"],
          actionSteps: [
            { step: 1, action: "Review patient history and current medications", responsible: "Care Team" },
            { step: 2, action: "Contact patient for symptom assessment", responsible: "Nurse" },
            { step: 3, action: "Schedule provider consultation within 24-48 hours", responsible: "Care Coordinator" },
          ],
          riskReduction: 30,
          timeToEffect: "24-48 hours",
        });
      }
    }
  });

  labTrends.forEach(l => {
    if (l.status === "critical" || l.status === "abnormal") {
      alerts.push({
        severity: l.status === "critical" ? "critical" : "medium",
        category: "lab_results",
        title: `${l.testName} Result Alert`,
        description: `${l.testName} showing ${l.status} result: ${l.latestValue} ${l.unit}`,
        aiAnalysis: `Lab result for ${l.testName} is ${l.status}. Current value of ${l.latestValue} ${l.unit} with ${l.trend} trend.`,
        earlyWarningSignals: [`${l.testName} ${l.status}`, `Trend: ${l.trend}`],
        recommendedActions: ["Review lab result history", "Consider medication adjustment if applicable", "Schedule follow-up labs"],
        riskScore: l.status === "critical" ? 75 : 40,
        detectedPattern: `${l.status} ${l.testName} result`,
      });
    }
  });

  return { alerts: alerts.slice(0, 3), interventions: interventions.slice(0, 2) };
}

export async function analyzePatientData(
  data: PatientDataBundle,
  userId: string,
  userRole: string
): Promise<AnalysisResult> {
  await logPhiAccess({
    userId,
    userRole,
    action: "read",
    resourceType: "patient_data_bundle",
    resourceId: data.patientId,
    patientId: data.patientId,
    details: `AI health analysis - vitals: ${data.vitals.length}, labs: ${data.labResults.length}, proms: ${data.promResponses.length}`,
  });

  const vitalTrends = analyzeVitalTrends(data.vitals);
  const labTrends = analyzeLabTrends(data.labResults);
  const promScores = data.promResponses.map(p => ({
    questionnaireName: p.questionnaireId,
    latestScore: p.totalScore,
    trend: "stable" as const,
    severity: p.severity,
  }));

  const overallRisk = calculateOverallRisk(vitalTrends, labTrends, promScores);
  const aiAnalysis = await generateAIAnalysis(data, vitalTrends, labTrends);

  const now = new Date().toISOString();
  
  const alerts: Omit<HealthMonitoringAlert, "id" | "createdAt" | "updatedAt">[] = aiAnalysis.alerts.map(a => ({
    patientId: data.patientId,
    patientName: data.patientName,
    severity: a.severity,
    category: a.category,
    status: "new" as const,
    title: a.title,
    description: a.description,
    aiAnalysis: a.aiAnalysis,
    triggerData: {
      dataType: a.category,
      dataPoints: [],
      detectedPattern: a.detectedPattern,
    },
    riskScore: a.riskScore,
    confidenceScore: 85,
    relatedConditions: data.conditions,
    relatedMedications: data.medications,
    earlyWarningSignals: a.earlyWarningSignals,
    recommendedActions: a.recommendedActions,
  }));

  const interventions: Omit<InterventionRecommendation, "id" | "createdAt" | "updatedAt">[] = aiAnalysis.interventions.map(i => ({
    alertId: "",
    patientId: data.patientId,
    type: i.type as InterventionType,
    priority: i.priority as InterventionPriority,
    status: "recommended" as InterventionStatus,
    title: i.title,
    description: i.description,
    rationale: i.rationale,
    expectedOutcome: i.expectedOutcome,
    evidenceBasis: i.evidenceBasis,
    actionSteps: i.actionSteps.map(s => ({ ...s, completed: false })),
    estimatedImpact: {
      riskReduction: i.riskReduction,
      timeToEffect: i.timeToEffect,
      confidence: 80,
    },
    contraindications: [],
    alternativeOptions: [],
  }));

  const adherenceRate = data.adherenceHistory?.length
    ? Math.round((data.adherenceHistory.filter(a => a.taken).length / data.adherenceHistory.length) * 100)
    : 100;

  const summary: PatientMonitoringSummary = {
    patientId: data.patientId,
    patientName: data.patientName,
    overallRiskLevel: overallRisk.level,
    riskScore: overallRisk.score,
    activeAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === "critical").length,
    pendingInterventions: interventions.length,
    lastAssessmentDate: now,
    vitalTrends,
    labTrends,
    promScores,
    adherenceRate,
    lastActivity: data.vitals[0]?.recordedAt || data.labResults[0]?.date || now,
    conditions: data.conditions,
    medications: data.medications,
  };

  return { alerts, interventions, summary };
}

export async function batchAnalyzePatients(
  patients: PatientDataBundle[],
  userId: string,
  userRole: string
): Promise<{
  results: Map<string, AnalysisResult>;
  aggregateSummary: {
    totalPatients: number;
    criticalCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    totalNewAlerts: number;
    totalInterventions: number;
  };
}> {
  const results = new Map<string, AnalysisResult>();
  let criticalCount = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let totalNewAlerts = 0;
  let totalInterventions = 0;

  for (const patient of patients) {
    try {
      const result = await analyzePatientData(patient, userId, userRole);
      results.set(patient.patientId, result);

      switch (result.summary.overallRiskLevel) {
        case "critical": criticalCount++; break;
        case "high": highRiskCount++; break;
        case "medium": mediumRiskCount++; break;
        case "low": lowRiskCount++; break;
      }
      totalNewAlerts += result.alerts.length;
      totalInterventions += result.interventions.length;
    } catch (error) {
      console.error(`[AI Proactive Monitoring] Failed to analyze patient ${patient.patientId}:`, error);
    }
  }

  return {
    results,
    aggregateSummary: {
      totalPatients: patients.length,
      criticalCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      totalNewAlerts,
      totalInterventions,
    },
  };
}
