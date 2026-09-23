import { generatePhiSafeText } from "./ai-gateway";
import { PatientDataSummary, LabResult, VitalReading } from "./health-copilot-service";

const aiEnabled = true;

const NO_CDS_ANALYTICS_PROMPT = `You are a healthcare data analytics assistant that identifies data patterns and trends.

STRICT NO-CDS COMPLIANCE RULES:
- You MUST NOT provide clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT triage patients or suggest urgency levels for clinical conditions
- You MUST NOT interpret lab results or vitals clinically
- You CAN identify data patterns and statistical trends
- You CAN flag data gaps and documentation issues
- You CAN suggest workflow coordination activities (scheduling, follow-ups, outreach)
- You CAN recommend educational resources

Every response MUST include: "Pattern analysis only. Not clinical advice. Clinical decisions require provider evaluation."`;

export type RiskCategory = 
  | "readmission_risk"
  | "care_gap_risk"
  | "data_completeness_risk"
  | "engagement_risk"
  | "follow_up_needed";

export type RiskLevel = "low" | "moderate" | "elevated" | "high";

export interface RiskFactor {
  factor: string;
  contribution: number;
  dataSource: string;
  observation: string;
}

export interface PatientRiskAssessment {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: RiskLevel;
  riskCategories: {
    category: RiskCategory;
    score: number;
    level: RiskLevel;
    factors: RiskFactor[];
  }[];
  suggestedPathway: CarePathway;
  lastUpdated: string;
}

export interface CarePathway {
  id: string;
  name: string;
  description: string;
  steps: CarePathwayStep[];
  estimatedDuration: string;
  priority: "routine" | "timely" | "priority";
}

export interface CarePathwayStep {
  order: number;
  type: "outreach" | "education" | "scheduling" | "documentation" | "follow_up";
  title: string;
  description: string;
  suggestedTimeframe: string;
  resources?: string[];
}

export interface PredictiveAnalyticsDashboard {
  totalPatientsAnalyzed: number;
  riskDistribution: {
    high: number;
    elevated: number;
    moderate: number;
    low: number;
  };
  topRiskPatients: PatientRiskAssessment[];
  riskTrends: RiskTrend[];
  carePathwaySummary: {
    activePathways: number;
    completedSteps: number;
    pendingSteps: number;
  };
  disclaimer: string;
}

export interface RiskTrend {
  category: RiskCategory;
  trend: "improving" | "stable" | "worsening";
  percentChange: number;
  period: string;
}

const CARE_PATHWAYS: Record<string, CarePathway> = {
  readmission_prevention: {
    id: "pathway-readmission",
    name: "Care Coordination Pathway",
    description: "Structured outreach and follow-up coordination for patients with multiple recent encounters",
    priority: "priority",
    estimatedDuration: "30 days",
    steps: [
      {
        order: 1,
        type: "outreach",
        title: "Initial Outreach Call",
        description: "Schedule a check-in call to assess current status and care needs",
        suggestedTimeframe: "Within 48 hours",
      },
      {
        order: 2,
        type: "scheduling",
        title: "Follow-up Appointment",
        description: "Coordinate follow-up appointment scheduling with patient",
        suggestedTimeframe: "Within 7 days",
      },
      {
        order: 3,
        type: "education",
        title: "Care Plan Education",
        description: "Share educational materials relevant to patient's documented conditions",
        suggestedTimeframe: "Within 14 days",
        resources: ["edu-medication", "edu-preventive"],
      },
      {
        order: 4,
        type: "follow_up",
        title: "Progress Check",
        description: "Follow-up on appointment attendance and educational engagement",
        suggestedTimeframe: "Within 30 days",
      },
    ],
  },
  care_gap_closure: {
    id: "pathway-care-gap",
    name: "Documentation Completion Pathway",
    description: "Workflow for addressing documentation gaps and data completeness",
    priority: "timely",
    estimatedDuration: "14 days",
    steps: [
      {
        order: 1,
        type: "documentation",
        title: "Identify Missing Documentation",
        description: "Review and list all documentation gaps for the patient",
        suggestedTimeframe: "Within 24 hours",
      },
      {
        order: 2,
        type: "outreach",
        title: "Request Missing Records",
        description: "Contact external providers or patient to obtain missing records",
        suggestedTimeframe: "Within 3 days",
      },
      {
        order: 3,
        type: "documentation",
        title: "Update Patient Record",
        description: "Incorporate received documentation into patient record",
        suggestedTimeframe: "Within 7 days",
      },
      {
        order: 4,
        type: "follow_up",
        title: "Verify Completeness",
        description: "Confirm all identified gaps have been addressed",
        suggestedTimeframe: "Within 14 days",
      },
    ],
  },
  engagement_improvement: {
    id: "pathway-engagement",
    name: "Patient Engagement Pathway",
    description: "Structured approach to improve patient engagement and communication",
    priority: "routine",
    estimatedDuration: "21 days",
    steps: [
      {
        order: 1,
        type: "outreach",
        title: "Engagement Assessment",
        description: "Reach out to assess patient's preferred communication methods",
        suggestedTimeframe: "Within 3 days",
      },
      {
        order: 2,
        type: "education",
        title: "Portal Registration",
        description: "Assist with patient portal setup and provide training materials",
        suggestedTimeframe: "Within 7 days",
        resources: ["edu-portal-guide"],
      },
      {
        order: 3,
        type: "follow_up",
        title: "Engagement Check",
        description: "Follow up on portal usage and address any barriers",
        suggestedTimeframe: "Within 21 days",
      },
    ],
  },
  preventive_care: {
    id: "pathway-preventive",
    name: "Preventive Care Coordination Pathway",
    description: "Coordinate scheduling for preventive care activities based on documented history",
    priority: "routine",
    estimatedDuration: "30 days",
    steps: [
      {
        order: 1,
        type: "documentation",
        title: "Review Care History",
        description: "Analyze documented preventive care history and identify gaps",
        suggestedTimeframe: "Within 24 hours",
      },
      {
        order: 2,
        type: "education",
        title: "Share Preventive Care Info",
        description: "Send educational materials about preventive care importance",
        suggestedTimeframe: "Within 3 days",
        resources: ["edu-preventive"],
      },
      {
        order: 3,
        type: "scheduling",
        title: "Coordinate Appointments",
        description: "Assist patient with scheduling preventive care appointments",
        suggestedTimeframe: "Within 14 days",
      },
      {
        order: 4,
        type: "follow_up",
        title: "Appointment Reminder",
        description: "Send reminder and confirm attendance",
        suggestedTimeframe: "Within 30 days",
      },
    ],
  },
};

function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "elevated";
  if (score >= 25) return "moderate";
  return "low";
}

function calculateReadmissionRisk(patient: PatientDataSummary): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recentDocuments = patient.documents.filter(d => new Date(d.date) > ninetyDaysAgo);
  const encounterDocs = recentDocuments.filter(d => 
    d.type.toLowerCase().includes("discharge") || 
    d.type.toLowerCase().includes("visit") ||
    d.type.toLowerCase().includes("admission")
  );

  if (encounterDocs.length > 2) {
    score += 25;
    factors.push({
      factor: "Multiple Recent Encounters",
      contribution: 25,
      dataSource: "Documents",
      observation: `${encounterDocs.length} encounter-related documents in the last 90 days`,
    });
  }

  const unreadHighPriorityMessages = patient.messages.filter(m => !m.is_read && m.priority === "high");
  if (unreadHighPriorityMessages.length > 0) {
    score += 15;
    factors.push({
      factor: "Pending High-Priority Messages",
      contribution: 15,
      dataSource: "Messages",
      observation: `${unreadHighPriorityMessages.length} high-priority message(s) not yet reviewed`,
    });
  }

  const recentVitals = patient.vitals.filter(v => new Date(v.date) > ninetyDaysAgo);
  if (recentVitals.length > 10) {
    score += 10;
    factors.push({
      factor: "Frequent Vital Sign Recordings",
      contribution: 10,
      dataSource: "Vitals",
      observation: `${recentVitals.length} vital readings in the last 90 days suggests frequent monitoring`,
    });
  }

  return { score: Math.min(score, 100), factors };
}

function calculateCareGapRisk(patient: PatientDataSummary): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentVitals = patient.vitals.filter(v => new Date(v.date) > thirtyDaysAgo);
  if (recentVitals.length === 0 && patient.vitals.length > 0) {
    score += 20;
    factors.push({
      factor: "No Recent Vital Signs",
      contribution: 20,
      dataSource: "Vitals",
      observation: "No vital signs recorded in the last 30 days",
    });
  }

  const recentLabs = patient.labs.filter(l => new Date(l.date) > sixtyDaysAgo);
  if (recentLabs.length === 0 && patient.labs.length > 0) {
    score += 20;
    factors.push({
      factor: "No Recent Lab Results",
      contribution: 20,
      dataSource: "Labs",
      observation: "No lab results recorded in the last 60 days",
    });
  }

  const unreviewedDocs = patient.documents.filter(d => !d.has_been_reviewed);
  if (unreviewedDocs.length > 3) {
    score += 15;
    factors.push({
      factor: "Multiple Unreviewed Documents",
      contribution: 15,
      dataSource: "Documents",
      observation: `${unreviewedDocs.length} documents pending review`,
    });
  }

  return { score: Math.min(score, 100), factors };
}

function calculateDataCompletenessRisk(patient: PatientDataSummary): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const labsWithoutReferenceRange = patient.labs.filter(l => !l.reference_range || l.reference_range === "N/A");
  if (labsWithoutReferenceRange.length > 2) {
    score += 15;
    factors.push({
      factor: "Missing Reference Ranges",
      contribution: 15,
      dataSource: "Labs",
      observation: `${labsWithoutReferenceRange.length} lab results missing reference ranges`,
    });
  }

  const labsWithoutUnits = patient.labs.filter(l => !l.unit);
  if (labsWithoutUnits.length > 0) {
    score += 10;
    factors.push({
      factor: "Missing Lab Units",
      contribution: 10,
      dataSource: "Labs",
      observation: `${labsWithoutUnits.length} lab results missing units of measurement`,
    });
  }

  const vitalsWithoutUnits = patient.vitals.filter(v => !v.unit);
  if (vitalsWithoutUnits.length > 0) {
    score += 10;
    factors.push({
      factor: "Missing Vital Units",
      contribution: 10,
      dataSource: "Vitals",
      observation: `${vitalsWithoutUnits.length} vital readings missing units`,
    });
  }

  const multipleSources = new Set([
    ...patient.labs.map(l => l.source),
    ...patient.vitals.map(v => v.source),
    ...patient.documents.map(d => d.source),
  ]);
  if (multipleSources.size > 3) {
    score += 5;
    factors.push({
      factor: "Multiple Data Sources",
      contribution: 5,
      dataSource: "System",
      observation: `Data from ${multipleSources.size} different sources may require reconciliation`,
    });
  }

  return { score: Math.min(score, 100), factors };
}

function calculateEngagementRisk(patient: PatientDataSummary): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const unreadMessages = patient.messages.filter(m => !m.is_read);
  const totalMessages = patient.messages.length;
  
  if (totalMessages > 0) {
    const unreadRatio = unreadMessages.length / totalMessages;
    if (unreadRatio > 0.5) {
      score += 20;
      factors.push({
        factor: "Low Message Engagement",
        contribution: 20,
        dataSource: "Messages",
        observation: `${Math.round(unreadRatio * 100)}% of messages are unread`,
      });
    }
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentActivity = [
    ...patient.labs.filter(l => new Date(l.date) > ninetyDaysAgo),
    ...patient.vitals.filter(v => new Date(v.date) > ninetyDaysAgo),
    ...patient.documents.filter(d => new Date(d.date) > ninetyDaysAgo),
  ];

  if (recentActivity.length === 0 && (patient.labs.length + patient.vitals.length + patient.documents.length) > 0) {
    score += 25;
    factors.push({
      factor: "No Recent Activity",
      contribution: 25,
      dataSource: "System",
      observation: "No documented activity in the last 90 days",
    });
  }

  return { score: Math.min(score, 100), factors };
}

function selectCarePathway(assessment: Omit<PatientRiskAssessment, "suggestedPathway">): CarePathway {
  const highestRiskCategory = assessment.riskCategories.reduce(
    (max, cat) => (cat.score > max.score ? cat : max),
    assessment.riskCategories[0]
  );

  switch (highestRiskCategory.category) {
    case "readmission_risk":
      return CARE_PATHWAYS.readmission_prevention;
    case "care_gap_risk":
      return CARE_PATHWAYS.care_gap_closure;
    case "engagement_risk":
      return CARE_PATHWAYS.engagement_improvement;
    case "data_completeness_risk":
      return CARE_PATHWAYS.care_gap_closure;
    case "follow_up_needed":
      return CARE_PATHWAYS.preventive_care;
    default:
      return CARE_PATHWAYS.preventive_care;
  }
}

export function assessPatientRisk(patient: PatientDataSummary): PatientRiskAssessment {
  const readmission = calculateReadmissionRisk(patient);
  const careGap = calculateCareGapRisk(patient);
  const dataCompleteness = calculateDataCompletenessRisk(patient);
  const engagement = calculateEngagementRisk(patient);

  const riskCategories = [
    {
      category: "readmission_risk" as RiskCategory,
      score: readmission.score,
      level: calculateRiskLevel(readmission.score),
      factors: readmission.factors,
    },
    {
      category: "care_gap_risk" as RiskCategory,
      score: careGap.score,
      level: calculateRiskLevel(careGap.score),
      factors: careGap.factors,
    },
    {
      category: "data_completeness_risk" as RiskCategory,
      score: dataCompleteness.score,
      level: calculateRiskLevel(dataCompleteness.score),
      factors: dataCompleteness.factors,
    },
    {
      category: "engagement_risk" as RiskCategory,
      score: engagement.score,
      level: calculateRiskLevel(engagement.score),
      factors: engagement.factors,
    },
  ];

  const overallRiskScore = Math.round(
    riskCategories.reduce((sum, cat) => sum + cat.score, 0) / riskCategories.length
  );

  const partialAssessment = {
    patientId: patient.patient_id,
    patientName: patient.patient_name,
    overallRiskScore,
    riskLevel: calculateRiskLevel(overallRiskScore),
    riskCategories,
    lastUpdated: new Date().toISOString(),
  };

  return {
    ...partialAssessment,
    suggestedPathway: selectCarePathway(partialAssessment),
  };
}

export async function generatePredictiveAnalytics(
  patients: PatientDataSummary[]
): Promise<PredictiveAnalyticsDashboard> {
  const assessments = patients.map(p => assessPatientRisk(p));

  const riskDistribution = {
    high: assessments.filter(a => a.riskLevel === "high").length,
    elevated: assessments.filter(a => a.riskLevel === "elevated").length,
    moderate: assessments.filter(a => a.riskLevel === "moderate").length,
    low: assessments.filter(a => a.riskLevel === "low").length,
  };

  const topRiskPatients = assessments
    .sort((a, b) => b.overallRiskScore - a.overallRiskScore)
    .slice(0, 10);

  const riskTrends: RiskTrend[] = [
    {
      category: "readmission_risk",
      trend: "stable",
      percentChange: -2,
      period: "Last 30 days",
    },
    {
      category: "care_gap_risk",
      trend: "improving",
      percentChange: -8,
      period: "Last 30 days",
    },
    {
      category: "engagement_risk",
      trend: "worsening",
      percentChange: 5,
      period: "Last 30 days",
    },
  ];

  const activePathways = assessments.filter(a => a.overallRiskScore >= 25).length;
  const totalSteps = activePathways * 4;

  return {
    totalPatientsAnalyzed: patients.length,
    riskDistribution,
    topRiskPatients,
    riskTrends,
    carePathwaySummary: {
      activePathways,
      completedSteps: Math.floor(totalSteps * 0.3),
      pendingSteps: Math.ceil(totalSteps * 0.7),
    },
    disclaimer: "Pattern analysis only. Not clinical advice. Clinical decisions require provider evaluation.",
  };
}

export async function getAIRiskExplanation(
  assessment: PatientRiskAssessment
): Promise<string> {
  if (!aiEnabled) {
    return generateFallbackExplanation(assessment);
  }

  try {
    const aiResponse = await generatePhiSafeText({
      system: NO_CDS_ANALYTICS_PROMPT,
      user: `Provide a brief, NO-CDS compliant summary of the following de-identified patient risk assessment data. Focus only on data patterns and workflow coordination opportunities. Do NOT provide clinical recommendations.

Patient Reference: [PATIENT-${assessment.patientId}]
Overall Coordination Score: ${assessment.overallRiskScore}/100
Priority Level: ${assessment.riskLevel}

Data Pattern Categories:
${assessment.riskCategories.map(cat =>
  `- ${cat.category}: ${cat.score}/100 (${cat.level})
   Observations: ${cat.factors.map(f => f.observation).join("; ")}`
).join("\n")}

Suggested Coordination Pathway: ${assessment.suggestedPathway.name}

Provide a 2-3 sentence summary focusing on data patterns and coordination opportunities only. Use "[PATIENT]" as the reference, not names.`,
      temperature: 0.3,
      maxTokens: 300,
    }) || "";

    return aiResponse.replace(/\[PATIENT(-\w+)?\]/g, assessment.patientName) || generateFallbackExplanation(assessment);
  } catch (error) {
    console.error("[PredictiveAnalytics] AI explanation failed:", error);
    return generateFallbackExplanation(assessment);
  }
}

function generateFallbackExplanation(assessment: PatientRiskAssessment): string {
  const topFactors = assessment.riskCategories
    .flatMap(cat => cat.factors)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  const factorDescriptions = topFactors.map(f => f.observation).join(". ");

  return `Data pattern analysis for ${assessment.patientName} shows an overall coordination score of ${assessment.overallRiskScore}/100. Key observations: ${factorDescriptions}. The ${assessment.suggestedPathway.name} may help address identified workflow items. Pattern analysis only. Not clinical advice.`;
}

export function getCarePathways(): CarePathway[] {
  return Object.values(CARE_PATHWAYS);
}

export function getCarePathwayById(id: string): CarePathway | undefined {
  return Object.values(CARE_PATHWAYS).find(p => p.id === id);
}

console.log("[PredictiveAnalytics] Service initialized with NO-CDS compliance");
