import type { 
  Medication, 
  Allergy, 
  Problem, 
  LabResult, 
  TimelineEvent, 
  HealthGoal 
} from "@shared/schema";
// CDS-GATED — this module performs Clinical Decision Support (multi-category health-risk
// scoring/stratification with clinical recommendations and monitoring schedules, an AI-generated
// patient health-status assessment with recommendations, and lab-trend interpretation).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS determination
// (21st Century Cures Act §3060) + counsel review. NOT a NO-CDS claim. The static default-
// summary placeholder is not CDS and remains ungated.
// See services/_cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { assertCdsEnabled } from "./services/_cds-gate";
import { logAuditEntry, ExplainableInsight, EXPLAINABILITY_VERSION } from "./explainability";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type RiskLevel = "low" | "moderate" | "elevated" | "high";
export type RiskCategory = 
  | "cardiovascular" 
  | "diabetes" 
  | "kidney" 
  | "liver" 
  | "respiratory" 
  | "mental_health"
  | "medication_adherence"
  | "lifestyle";

export interface HealthRiskAssessment {
  id: string;
  category: RiskCategory;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  factors: RiskFactor[];
  recommendations: string[];
  preventiveActions: string[];
  monitoringSchedule?: string;
  confidenceScore: number;
  lastUpdated: string;
  explainability?: ExplainableInsight;
}

export interface RiskFactor {
  name: string;
  value?: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  source: string;
}

export interface PatientHealthSummary {
  id: string;
  generatedAt: string;
  overallStatus: "excellent" | "good" | "fair" | "needs_attention";
  headline: string;
  keySummaryPoints: string[];
  activeConditions: { name: string; status: string; management: string }[];
  medicationOverview: { count: number; concerns: string[]; adherenceNote?: string };
  recentLabHighlights: { name: string; status: string; trend?: string }[];
  preventiveCareReminders: string[];
  lifestyleRecommendations: string[];
  upcomingActions: string[];
  aiGeneratedInsight: string;
  disclaimer: string;
}

export interface PredictiveHealthData {
  medications: Medication[];
  allergies: Allergy[];
  conditions: Problem[];
  labResults: LabResult[];
  timelineEvents: TimelineEvent[];
  goals: HealthGoal[];
}

function generateRiskId(): string {
  return `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSummaryId(): string {
  return `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function categorizeRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "elevated";
  if (score >= 25) return "moderate";
  return "low";
}

function getCategoryDisplayName(category: RiskCategory): string {
  const names: Record<RiskCategory, string> = {
    cardiovascular: "Heart & Cardiovascular",
    diabetes: "Diabetes & Blood Sugar",
    kidney: "Kidney Health",
    liver: "Liver Health",
    respiratory: "Respiratory Health",
    mental_health: "Mental & Emotional Health",
    medication_adherence: "Medication Management",
    lifestyle: "Lifestyle & Wellness",
  };
  return names[category];
}

const conditionRiskMappings: Record<string, { category: RiskCategory; baseRisk: number }[]> = {
  hypertension: [{ category: "cardiovascular", baseRisk: 30 }],
  "high blood pressure": [{ category: "cardiovascular", baseRisk: 30 }],
  diabetes: [
    { category: "diabetes", baseRisk: 40 },
    { category: "cardiovascular", baseRisk: 20 },
    { category: "kidney", baseRisk: 15 },
  ],
  "type 2 diabetes": [
    { category: "diabetes", baseRisk: 40 },
    { category: "cardiovascular", baseRisk: 20 },
    { category: "kidney", baseRisk: 15 },
  ],
  obesity: [
    { category: "cardiovascular", baseRisk: 25 },
    { category: "diabetes", baseRisk: 25 },
  ],
  asthma: [{ category: "respiratory", baseRisk: 30 }],
  copd: [{ category: "respiratory", baseRisk: 50 }],
  depression: [{ category: "mental_health", baseRisk: 40 }],
  anxiety: [{ category: "mental_health", baseRisk: 30 }],
  "chronic kidney disease": [{ category: "kidney", baseRisk: 50 }],
  "fatty liver": [{ category: "liver", baseRisk: 35 }],
  "high cholesterol": [{ category: "cardiovascular", baseRisk: 25 }],
  hyperlipidemia: [{ category: "cardiovascular", baseRisk: 25 }],
};

const labRiskIndicators: Record<string, { category: RiskCategory; thresholds: { low?: number; high?: number; criticalHigh?: number } }> = {
  a1c: { category: "diabetes", thresholds: { high: 6.5, criticalHigh: 9 } },
  "hemoglobin a1c": { category: "diabetes", thresholds: { high: 6.5, criticalHigh: 9 } },
  glucose: { category: "diabetes", thresholds: { high: 126, criticalHigh: 200 } },
  "fasting glucose": { category: "diabetes", thresholds: { high: 126, criticalHigh: 200 } },
  ldl: { category: "cardiovascular", thresholds: { high: 130, criticalHigh: 190 } },
  "ldl cholesterol": { category: "cardiovascular", thresholds: { high: 130, criticalHigh: 190 } },
  triglycerides: { category: "cardiovascular", thresholds: { high: 150, criticalHigh: 500 } },
  creatinine: { category: "kidney", thresholds: { high: 1.2, criticalHigh: 2.0 } },
  egfr: { category: "kidney", thresholds: { low: 60 } },
  alt: { category: "liver", thresholds: { high: 56, criticalHigh: 200 } },
  ast: { category: "liver", thresholds: { high: 40, criticalHigh: 200 } },
  "blood pressure systolic": { category: "cardiovascular", thresholds: { high: 130, criticalHigh: 180 } },
};

export function analyzeHealthRisks(data: PredictiveHealthData): HealthRiskAssessment[] {
  assertCdsEnabled("predictive-health:analyze-risks");
  const categoryScores: Record<RiskCategory, { score: number; factors: RiskFactor[] }> = {
    cardiovascular: { score: 0, factors: [] },
    diabetes: { score: 0, factors: [] },
    kidney: { score: 0, factors: [] },
    liver: { score: 0, factors: [] },
    respiratory: { score: 0, factors: [] },
    mental_health: { score: 0, factors: [] },
    medication_adherence: { score: 0, factors: [] },
    lifestyle: { score: 0, factors: [] },
  };

  for (const condition of data.conditions.filter(c => c.status === "active")) {
    const normalizedName = condition.name.toLowerCase();
    
    for (const [pattern, mappings] of Object.entries(conditionRiskMappings)) {
      if (normalizedName.includes(pattern)) {
        for (const mapping of mappings) {
          categoryScores[mapping.category].score += mapping.baseRisk;
          categoryScores[mapping.category].factors.push({
            name: condition.name,
            impact: "negative",
            weight: mapping.baseRisk / 100,
            source: "Active Condition",
          });
        }
      }
    }
  }

  for (const lab of data.labResults) {
    const normalizedName = lab.testName.toLowerCase();
    const value = typeof lab.value === 'string' ? parseFloat(lab.value) : lab.value;
    
    if (isNaN(value)) continue;
    
    for (const [pattern, indicator] of Object.entries(labRiskIndicators)) {
      if (normalizedName.includes(pattern)) {
        let riskContribution = 0;
        let impact: "positive" | "negative" | "neutral" = "neutral";
        
        if (indicator.thresholds.criticalHigh && value >= indicator.thresholds.criticalHigh) {
          riskContribution = 35;
          impact = "negative";
        } else if (indicator.thresholds.high && value >= indicator.thresholds.high) {
          riskContribution = 20;
          impact = "negative";
        } else if (indicator.thresholds.low && value < indicator.thresholds.low) {
          riskContribution = 25;
          impact = "negative";
        } else {
          riskContribution = -5;
          impact = "positive";
        }
        
        categoryScores[indicator.category].score += riskContribution;
        categoryScores[indicator.category].factors.push({
          name: lab.testName,
          value: `${value} ${lab.unit || ""}`.trim(),
          impact,
          weight: Math.abs(riskContribution) / 100,
          source: `Lab Result (${lab.date})`,
        });
      }
    }
  }

  const activeMedCount = data.medications.filter(m => m.status === "active").length;
  if (activeMedCount >= 5) {
    categoryScores.medication_adherence.score += 20;
    categoryScores.medication_adherence.factors.push({
      name: "Polypharmacy",
      value: `${activeMedCount} active medications`,
      impact: "negative",
      weight: 0.2,
      source: "Medication List",
    });
  }

  const completedGoals = data.goals.filter(g => g.status === "completed").length;
  const totalGoals = data.goals.length;
  if (totalGoals > 0) {
    const goalProgress = (completedGoals / totalGoals) * 100;
    if (goalProgress >= 75) {
      categoryScores.lifestyle.score -= 10;
      categoryScores.lifestyle.factors.push({
        name: "Health Goal Progress",
        value: `${goalProgress.toFixed(0)}% goals completed`,
        impact: "positive",
        weight: 0.1,
        source: "Health Goals",
      });
    } else if (goalProgress < 25) {
      categoryScores.lifestyle.score += 15;
      categoryScores.lifestyle.factors.push({
        name: "Health Goal Progress",
        value: `${goalProgress.toFixed(0)}% goals completed`,
        impact: "negative",
        weight: 0.15,
        source: "Health Goals",
      });
    }
  }

  const assessments: HealthRiskAssessment[] = [];
  
  for (const [category, data] of Object.entries(categoryScores)) {
    const cat = category as RiskCategory;
    const score = Math.max(0, Math.min(100, data.score));
    
    if (data.factors.length === 0) continue;
    
    const riskLevel = categorizeRiskLevel(score);
    const { recommendations, preventiveActions, monitoring } = generateRecommendations(cat, riskLevel, data.factors);
    
    assessments.push({
      id: generateRiskId(),
      category: cat,
      riskLevel,
      title: `${getCategoryDisplayName(cat)} Risk Assessment`,
      description: generateRiskDescription(cat, riskLevel, data.factors),
      factors: data.factors,
      recommendations,
      preventiveActions,
      monitoringSchedule: monitoring,
      confidenceScore: calculateConfidence(data.factors.length, score),
      lastUpdated: new Date().toISOString(),
    });
  }

  assessments.sort((a, b) => {
    const levelOrder = { high: 0, elevated: 1, moderate: 2, low: 3 };
    return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
  });

  return assessments;
}

function generateRiskDescription(category: RiskCategory, level: RiskLevel, factors: RiskFactor[]): string {
  const negativeFactors = factors.filter(f => f.impact === "negative");
  const positiveFactors = factors.filter(f => f.impact === "positive");
  
  const categoryName = getCategoryDisplayName(category).toLowerCase();
  
  if (level === "low") {
    return `Your ${categoryName} shows a low risk profile. ${positiveFactors.length > 0 ? `Contributing positively: ${positiveFactors.map(f => f.name).join(", ")}.` : "Continue maintaining your current health habits."}`;
  } else if (level === "moderate") {
    return `Your ${categoryName} shows moderate risk indicators. ${negativeFactors.length > 0 ? `Factors to monitor: ${negativeFactors.slice(0, 2).map(f => f.name).join(", ")}.` : ""} Regular monitoring is recommended.`;
  } else if (level === "elevated") {
    return `Your ${categoryName} shows elevated risk. ${negativeFactors.length > 0 ? `Key concerns include: ${negativeFactors.slice(0, 3).map(f => f.name).join(", ")}.` : ""} Please discuss these findings with your healthcare provider.`;
  } else {
    return `Your ${categoryName} shows significant risk factors that need attention. ${negativeFactors.length > 0 ? `Primary concerns: ${negativeFactors.slice(0, 3).map(f => f.name).join(", ")}.` : ""} We strongly recommend scheduling an appointment with your doctor to discuss a management plan.`;
  }
}

function generateRecommendations(
  category: RiskCategory, 
  level: RiskLevel, 
  factors: RiskFactor[]
): { recommendations: string[]; preventiveActions: string[]; monitoring?: string } {
  const recommendations: string[] = [];
  const preventiveActions: string[] = [];
  let monitoring: string | undefined;

  switch (category) {
    case "cardiovascular":
      recommendations.push(
        "Maintain a heart-healthy diet low in saturated fats and sodium",
        "Aim for at least 150 minutes of moderate exercise weekly"
      );
      if (level === "high" || level === "elevated") {
        recommendations.push("Discuss medication options with your doctor");
        monitoring = "Blood pressure check weekly; lipid panel every 3-6 months";
      }
      preventiveActions.push(
        "Check blood pressure regularly at home",
        "Limit alcohol consumption",
        "Manage stress through relaxation techniques"
      );
      break;

    case "diabetes":
      recommendations.push(
        "Monitor blood sugar levels as recommended by your doctor",
        "Follow a balanced diet with controlled carbohydrate intake"
      );
      if (level === "high" || level === "elevated") {
        recommendations.push("Review your diabetes management plan with your healthcare team");
        monitoring = "A1C test every 3 months; daily glucose monitoring if applicable";
      }
      preventiveActions.push(
        "Stay physically active to improve insulin sensitivity",
        "Maintain a healthy weight",
        "Get regular eye and foot exams"
      );
      break;

    case "kidney":
      recommendations.push(
        "Stay well hydrated with water",
        "Limit sodium intake to protect kidney function"
      );
      if (level === "high" || level === "elevated") {
        recommendations.push("Discuss kidney-protective medications with your doctor");
        monitoring = "Kidney function tests (creatinine, eGFR) every 3-6 months";
      }
      preventiveActions.push(
        "Avoid overuse of NSAIDs (ibuprofen, naproxen)",
        "Control blood pressure and blood sugar if applicable"
      );
      break;

    case "liver":
      recommendations.push(
        "Limit alcohol consumption",
        "Maintain a healthy weight through diet and exercise"
      );
      preventiveActions.push(
        "Avoid unnecessary medications that stress the liver",
        "Get vaccinated for hepatitis if recommended"
      );
      if (level === "elevated" || level === "high") {
        monitoring = "Liver function tests every 3-6 months";
      }
      break;

    case "respiratory":
      recommendations.push(
        "Avoid tobacco smoke and air pollutants",
        "Keep up with respiratory medications as prescribed"
      );
      preventiveActions.push(
        "Get annual flu vaccine and COVID-19 boosters",
        "Practice breathing exercises",
        "Keep rescue inhaler accessible if prescribed"
      );
      break;

    case "mental_health":
      recommendations.push(
        "Maintain social connections and support networks",
        "Practice regular self-care and stress management"
      );
      if (level === "elevated" || level === "high") {
        recommendations.push("Consider speaking with a mental health professional");
      }
      preventiveActions.push(
        "Establish a regular sleep schedule",
        "Engage in physical activity for mood benefits",
        "Practice mindfulness or meditation"
      );
      break;

    case "medication_adherence":
      recommendations.push(
        "Use a pill organizer or medication reminder app",
        "Keep an updated medication list to share with all providers"
      );
      preventiveActions.push(
        "Ask your pharmacist about potential drug interactions",
        "Review all medications annually with your doctor for necessity"
      );
      break;

    case "lifestyle":
      recommendations.push(
        "Set achievable health goals and track progress",
        "Build healthy habits gradually"
      );
      preventiveActions.push(
        "Get recommended preventive screenings",
        "Prioritize sleep quality",
        "Stay socially connected"
      );
      break;
  }

  return { recommendations, preventiveActions, monitoring };
}

function calculateConfidence(factorCount: number, score: number): number {
  const baseConfidence = Math.min(0.9, 0.5 + (factorCount * 0.1));
  if (score < 10 || score > 90) {
    return Math.round(baseConfidence * 100) / 100;
  }
  return Math.round((baseConfidence * 0.9) * 100) / 100;
}

export async function generatePatientHealthSummary(
  data: PredictiveHealthData,
  patientName?: string
): Promise<PatientHealthSummary> {
  assertCdsEnabled("predictive-health:patient-summary");
  const activeConditions = data.conditions.filter(c => c.status === "active");
  const activeMedications = data.medications.filter(m => m.status === "active");
  const recentLabs = data.labResults
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  const activeGoals = data.goals.filter(g => g.status === "active" || g.status === "in_progress");

  const prompt = `You are a helpful health assistant creating a patient-friendly health summary. Use simple, everyday language that anyone can understand. Be encouraging but honest.

Patient Health Data:
- Active Conditions: ${activeConditions.map(c => c.name).join(", ") || "None recorded"}
- Active Medications: ${activeMedications.length} medications
- Recent Lab Tests: ${recentLabs.map(l => `${l.testName}: ${l.value} ${l.unit || ""}`).join("; ") || "None recent"}
- Health Goals: ${activeGoals.map(g => g.title).join(", ") || "None set"}
- Allergies: ${data.allergies.map(a => a.name).join(", ") || "None recorded"}

Generate a personalized health summary in JSON format:
{
  "overallStatus": "excellent" | "good" | "fair" | "needs_attention",
  "headline": "A brief, friendly 1-sentence summary of their health status",
  "keySummaryPoints": ["3-5 key points about their health in simple terms"],
  "lifestyleRecommendations": ["2-3 practical lifestyle tips based on their conditions"],
  "upcomingActions": ["2-3 suggested next steps or appointments to consider"],
  "aiGeneratedInsight": "A thoughtful 2-3 sentence insight about their health journey, written in a warm, supportive tone"
}

Important: 
- Use simple language a 10-year-old could understand
- Be encouraging but don't minimize real concerns
- Focus on actionable, practical advice
- Never provide specific medical diagnoses or treatment recommendations`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No AI response");

    const parsed = JSON.parse(content);

    const conditionSummaries = activeConditions.slice(0, 5).map(c => ({
      name: c.name,
      status: c.status,
      management: `Diagnosed ${c.onsetDate ? new Date(c.onsetDate).toLocaleDateString() : "previously"}`,
    }));

    const medicationConcerns: string[] = [];
    if (activeMedications.length >= 5) {
      medicationConcerns.push("You're taking multiple medications - keep your medication list updated");
    }

    const labHighlights = recentLabs.slice(0, 5).map(l => {
      const value = typeof l.value === 'string' ? parseFloat(l.value) : l.value;
      let status = "Normal";
      if (l.referenceRange) {
        const match = l.referenceRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (match && !isNaN(value)) {
          const low = parseFloat(match[1]);
          const high = parseFloat(match[2]);
          if (value < low) status = "Below normal";
          else if (value > high) status = "Above normal";
        }
      }
      return {
        name: l.testName,
        status,
        trend: undefined,
      };
    });

    const preventiveCareReminders = [
      "Schedule your annual wellness visit",
      "Stay up to date on recommended vaccinations",
      "Get recommended cancer screenings for your age group",
    ];

    logAuditEntry({
      action: "insight_generated",
      insightType: "health_summary",
      insightId: generateSummaryId(),
      patientId: "current_user",
      details: {
        conditionCount: activeConditions.length,
        medicationCount: activeMedications.length,
        labCount: recentLabs.length,
      },
    });

    return {
      id: generateSummaryId(),
      generatedAt: new Date().toISOString(),
      overallStatus: parsed.overallStatus || "good",
      headline: parsed.headline || "Your health overview is ready",
      keySummaryPoints: parsed.keySummaryPoints || ["Your records have been analyzed"],
      activeConditions: conditionSummaries,
      medicationOverview: {
        count: activeMedications.length,
        concerns: medicationConcerns,
      },
      recentLabHighlights: labHighlights,
      preventiveCareReminders,
      lifestyleRecommendations: parsed.lifestyleRecommendations || [],
      upcomingActions: parsed.upcomingActions || [],
      aiGeneratedInsight: parsed.aiGeneratedInsight || "We've analyzed your health records to help you stay informed about your wellness journey.",
      disclaimer: "This summary is for informational purposes only and is not medical advice. Always consult with your healthcare provider for medical decisions.",
    };
  } catch (error) {
    console.error("Error generating health summary:", error);

    return {
      id: generateSummaryId(),
      generatedAt: new Date().toISOString(),
      overallStatus: "good",
      headline: "Your health overview",
      keySummaryPoints: [
        `You have ${activeConditions.length} active health conditions being managed`,
        `You are currently taking ${activeMedications.length} medications`,
        `${recentLabs.length} lab tests are on record`,
      ],
      activeConditions: activeConditions.slice(0, 5).map(c => ({
        name: c.name,
        status: c.status,
        management: "Under management",
      })),
      medicationOverview: {
        count: activeMedications.length,
        concerns: [],
      },
      recentLabHighlights: [],
      preventiveCareReminders: ["Schedule your annual wellness visit"],
      lifestyleRecommendations: ["Stay active", "Eat a balanced diet", "Get adequate sleep"],
      upcomingActions: ["Review your medications with your doctor"],
      aiGeneratedInsight: "We're here to help you understand and manage your health records.",
      disclaimer: "This summary is for informational purposes only and is not medical advice. Always consult with your healthcare provider for medical decisions.",
    };
  }
}

export function generateDefaultSummary(): PatientHealthSummary {
  return {
    id: generateSummaryId(),
    generatedAt: new Date().toISOString(),
    overallStatus: "good",
    headline: "Welcome to Your Health Summary",
    keySummaryPoints: [
      "Connect your health records to get personalized insights",
      "Your health data will be analyzed to provide helpful summaries",
      "All your information is kept secure and private",
    ],
    activeConditions: [],
    medicationOverview: {
      count: 0,
      concerns: [],
    },
    recentLabHighlights: [],
    preventiveCareReminders: [
      "Schedule your annual wellness visit",
      "Stay up to date on recommended vaccinations",
    ],
    lifestyleRecommendations: [
      "Stay active with regular exercise",
      "Eat a balanced diet rich in fruits and vegetables",
      "Get 7-9 hours of quality sleep each night",
    ],
    upcomingActions: [
      "Connect your health records from the Data Sources page",
      "Review your profile settings",
    ],
    aiGeneratedInsight: "Welcome! Once you connect your health records, we'll provide personalized insights to help you understand and manage your wellness journey.",
    disclaimer: "This summary is for informational purposes only and is not medical advice. Always consult with your healthcare provider for medical decisions.",
  };
}

export async function generateHealthTrendAnalysis(
  labResults: LabResult[],
  timeframeDays: number = 365
): Promise<{
  trends: { labName: string; direction: string; significance: string; explanation: string }[];
  overallAssessment: string;
}> {
  assertCdsEnabled("predictive-health:trend-analysis");
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  
  const recentLabs = labResults.filter(l => new Date(l.date) >= cutoffDate);
  
  const labGroups: Record<string, LabResult[]> = {};
  for (const lab of recentLabs) {
    const key = lab.testName.toLowerCase().trim();
    if (!labGroups[key]) labGroups[key] = [];
    labGroups[key].push(lab);
  }

  const trends: { labName: string; direction: string; significance: string; explanation: string }[] = [];
  
  for (const [, results] of Object.entries(labGroups)) {
    if (results.length < 2) continue;
    
    const sorted = results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const values = sorted.map(r => typeof r.value === 'string' ? parseFloat(r.value) : r.value).filter(v => !isNaN(v));
    
    if (values.length < 2) continue;
    
    const first = values[0];
    const last = values[values.length - 1];
    const percentChange = first !== 0 ? ((last - first) / first) * 100 : 0;
    
    let direction = "Stable";
    let significance = "Normal variation";
    
    if (percentChange > 15) {
      direction = "Increasing";
      significance = percentChange > 30 ? "Significant increase" : "Moderate increase";
    } else if (percentChange < -15) {
      direction = "Decreasing";
      significance = percentChange < -30 ? "Significant decrease" : "Moderate decrease";
    }
    
    trends.push({
      labName: results[0].testName,
      direction,
      significance,
      explanation: `Changed from ${first.toFixed(1)} to ${last.toFixed(1)} ${results[0].unit || ""} (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%)`,
    });
  }

  const significantChanges = trends.filter(t => t.significance.includes("Significant")).length;
  let overallAssessment = "Your lab values have been relatively stable over this period.";
  
  if (significantChanges > 2) {
    overallAssessment = "Several of your lab values have shown significant changes. We recommend discussing these trends with your healthcare provider.";
  } else if (significantChanges === 1 || significantChanges === 2) {
    overallAssessment = "Some of your lab values have changed notably. Keep an eye on these and mention them at your next appointment.";
  }

  return { trends, overallAssessment };
}

export { PredictiveHealthData as HealthAnalysisInput };
