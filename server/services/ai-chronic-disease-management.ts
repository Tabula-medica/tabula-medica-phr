import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";
import { generatePhiSafeText } from "./ai-gateway";
import type {
  ChronicConditionProfile,
  ChronicDiseaseManagementPlan,
  ManagementGoal,
  ManagementIntervention,
  MonitoringItem,
  EducationTopic,
  SymptomLog,
  AdherenceLog,
  LifestyleLog,
  ProgressSnapshot,
  PersonalizedEducationContent,
  ChronicConditionType,
} from "@shared/schema";

type CDMAlertType = "missed_medication" | "abnormal_vital" | "symptom_escalation" | "goal_deviation" | "appointment_reminder" | "refill_needed" | "lab_due" | "complication_risk" | "lifestyle_alert" | "education_reminder";
type CDMAlertPriority = "low" | "medium" | "high" | "urgent";

interface CDMPredictiveAlert {
  id: string;
  patientId: string;
  conditionId?: string;
  alertType: CDMAlertType;
  priority: CDMAlertPriority;
  title: string;
  message: string;
  recommendation?: string;
  aiConfidence?: number;
  triggerData?: Record<string, unknown>;
  isRead: boolean;
  isDismissed: boolean;
  actionTaken?: string;
  createdAt: string;
  expiresAt?: string;
}

function isAiEnabled(): boolean {
  return true;
}

const NO_CDS_GUARDRAIL = `
CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
You are providing EDUCATIONAL CONTENT ONLY for chronic disease self-management.
You MUST NOT provide:
- NEW diagnoses or treatment recommendations
- Drug dosage changes or medication recommendations
- Clinical predictions or prognosis
- Triage decisions or urgency ratings
- Any form of medical advice

You MAY ONLY:
- Explain documented conditions in plain language
- Provide general wellness and lifestyle education
- Summarize documented health data trends
- Suggest topics to discuss with healthcare providers
- Encourage medication adherence based on existing prescriptions

ALL content must include disclaimer: "Educational content only. Always consult your healthcare provider for medical advice."
`;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const conditionProfiles: ChronicConditionProfile[] = [];
const managementPlans: ChronicDiseaseManagementPlan[] = [];
const symptomLogs: SymptomLog[] = [];
const adherenceLogs: AdherenceLog[] = [];
const lifestyleLogs: LifestyleLog[] = [];
const predictiveAlerts: CDMPredictiveAlert[] = [];
const progressSnapshots: ProgressSnapshot[] = [];
const educationContent: PersonalizedEducationContent[] = [];

export async function getPatientConditions(patientId: string): Promise<ChronicConditionProfile[]> {
  return conditionProfiles.filter(c => c.patientId === patientId);
}

export async function addConditionProfile(
  patientId: string,
  conditionType: ChronicConditionType,
  conditionName: string,
  diagnosisDate?: string,
  severity?: string,
  notes?: string
): Promise<ChronicConditionProfile> {
  const profile: ChronicConditionProfile = {
    id: generateId("cond"),
    patientId,
    conditionType,
    conditionName,
    diagnosisDate,
    severity,
    status: "active",
    createdAt: new Date().toISOString(),
    notes,
  };
  conditionProfiles.push(profile);
  
  await logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "ChronicConditionProfile",
    action: "write",
    details: `Added chronic condition profile: ${conditionName}`,
  });
  
  return profile;
}

export async function generateManagementPlan(
  patientId: string,
  conditionId: string
): Promise<ChronicDiseaseManagementPlan> {
  const condition = conditionProfiles.find(c => c.id === conditionId && c.patientId === patientId);
  if (!condition) {
    throw new Error("Condition not found");
  }

  const [medications, vitals, labResults] = await Promise.all([
    storage.getMedicationsByPatient(patientId),
    Promise.resolve([]),
    storage.getLabResultsByPatient(patientId),
  ]);

  let aiInsights = "";
  let aiGoals: ManagementGoal[] = [];
  let aiEducation: EducationTopic[] = [];

  if (isAiEnabled()) {
    try {
      const response = await generatePhiSafeText({
        system: `${NO_CDS_GUARDRAIL}
You are a health education assistant helping create a personalized chronic disease management template.
Generate educational goals and topics for self-management education ONLY.
Return JSON with structure:
{
  "insights": "Plain language summary of documented condition for patient understanding",
  "goals": [{"id": "g1", "title": "...", "description": "...", "status": "not_started"}],
  "educationTopics": [{"id": "e1", "title": "...", "category": "...", "content": "Brief educational summary", "isCompleted": false, "aiPersonalized": true}]
}`,
        user: `Create educational management template for:
Condition: ${condition.conditionName} (${condition.conditionType})
Diagnosis Date: ${condition.diagnosisDate || "Unknown"}
Current Medications: ${medications.filter(m => m.status === "active").map(m => m.name).join(", ") || "None documented"}
Recent Lab Results: ${labResults.slice(0, 5).map(l => `${l.testName}: ${l.value} ${l.unit || ""}`).join(", ") || "None"}

Generate educational content for patient self-management. NOT clinical recommendations.`,
        responseMimeType: "application/json",
        maxTokens: 1500,
      });

      const result = JSON.parse(response || "{}");
      aiInsights = result.insights || "";
      aiGoals = (result.goals || []).map((g: any) => ({
        ...g,
        status: "not_started",
        progressPercentage: 0,
      }));
      aiEducation = (result.educationTopics || []).map((e: any) => ({
        ...e,
        isCompleted: false,
        aiPersonalized: true,
      }));
    } catch (error) {
      console.error("[ChronicDisease] AI generation failed:", error);
    }
  }

  if (aiGoals.length === 0) {
    aiGoals = getDefaultGoals(condition.conditionType);
  }
  if (aiEducation.length === 0) {
    aiEducation = getDefaultEducation(condition.conditionType);
  }

  const plan: ChronicDiseaseManagementPlan = {
    id: generateId("plan"),
    patientId,
    conditionId,
    title: `${condition.conditionName} Self-Management Plan`,
    description: `Educational self-management plan for ${condition.conditionName}. For educational purposes only - always consult your healthcare provider.`,
    status: "draft",
    goals: aiGoals,
    interventions: getDefaultInterventions(condition.conditionType),
    monitoringSchedule: getDefaultMonitoring(condition.conditionType),
    educationTopics: aiEducation,
    startDate: new Date().toISOString(),
    aiGeneratedInsights: aiInsights,
    progressScore: 0,
    createdAt: new Date().toISOString(),
  };

  managementPlans.push(plan);

  await logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "ChronicDiseaseManagementPlan",
    action: "write",
    details: `Generated management plan for condition: ${condition.conditionName}`,
  });

  return plan;
}

export async function getManagementPlan(patientId: string, planId: string): Promise<ChronicDiseaseManagementPlan | null> {
  return managementPlans.find(p => p.id === planId && p.patientId === patientId) || null;
}

export async function getPatientPlans(patientId: string): Promise<ChronicDiseaseManagementPlan[]> {
  return managementPlans.filter(p => p.patientId === patientId);
}

export async function updatePlanStatus(
  patientId: string,
  planId: string,
  status: ChronicDiseaseManagementPlan["status"]
): Promise<ChronicDiseaseManagementPlan | null> {
  const plan = managementPlans.find(p => p.id === planId && p.patientId === patientId);
  if (plan) {
    plan.status = status;
    plan.updatedAt = new Date().toISOString();
  }
  return plan || null;
}

export async function logSymptom(data: {
  patientId: string;
  conditionId?: string;
  symptomName: string;
  severity: SymptomLog["severity"];
  description?: string;
  triggers?: string[];
  duration?: string;
  affectsDaily: boolean;
  notes?: string;
}): Promise<SymptomLog> {
  const log: SymptomLog = {
    id: generateId("sym"),
    ...data,
    loggedAt: new Date().toISOString(),
  };
  symptomLogs.push(log);

  await checkForSymptomAlerts(data.patientId, log);

  await logPhiAccess({
    userId: data.patientId,
    patientId: data.patientId,
    resourceType: "SymptomLog",
    action: "write",
    details: `Logged symptom: ${data.symptomName} (${data.severity})`,
  });

  return log;
}

export async function getSymptomLogs(patientId: string, limit = 50): Promise<SymptomLog[]> {
  return symptomLogs
    .filter(s => s.patientId === patientId)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, limit);
}

export async function logAdherence(data: {
  patientId: string;
  medicationId?: string;
  medicationName: string;
  scheduledTime: string;
  actualTime?: string;
  status: AdherenceLog["status"];
  dosage?: string;
  notes?: string;
}): Promise<AdherenceLog> {
  const log: AdherenceLog = {
    id: generateId("adh"),
    ...data,
    loggedAt: new Date().toISOString(),
  };
  adherenceLogs.push(log);

  if (data.status === "missed") {
    await createAlert(data.patientId, {
      alertType: "missed_medication",
      priority: "medium",
      title: "Missed Medication",
      message: `You missed taking ${data.medicationName}. Try to take it as soon as possible unless it's close to your next dose.`,
      recommendation: "Review your medication schedule and set reminders if needed.",
    });
  }

  await logPhiAccess({
    userId: data.patientId,
    patientId: data.patientId,
    resourceType: "AdherenceLog",
    action: "write",
    details: `Logged adherence: ${data.medicationName} (${data.status})`,
  });

  return log;
}

export async function getAdherenceLogs(patientId: string, limit = 50): Promise<AdherenceLog[]> {
  return adherenceLogs
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, limit);
}

export async function logLifestyle(data: {
  patientId: string;
  category: LifestyleLog["category"];
  description: string;
  value?: string;
  unit?: string;
  duration?: number;
  notes?: string;
}): Promise<LifestyleLog> {
  const log: LifestyleLog = {
    id: generateId("life"),
    ...data,
    loggedAt: new Date().toISOString(),
  };
  lifestyleLogs.push(log);

  await logPhiAccess({
    userId: data.patientId,
    patientId: data.patientId,
    resourceType: "LifestyleLog",
    action: "write",
    details: `Logged lifestyle: ${data.category}`,
  });

  return log;
}

export async function getLifestyleLogs(patientId: string, limit = 50): Promise<LifestyleLog[]> {
  return lifestyleLogs
    .filter(l => l.patientId === patientId)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, limit);
}

async function checkForSymptomAlerts(patientId: string, symptom: SymptomLog): Promise<void> {
  const severeSymptoms = ["severe", "very_severe", "critical"];
  if (severeSymptoms.includes(symptom.severity)) {
    const isVerySerious = symptom.severity === "very_severe";
    await createAlert(patientId, {
      alertType: "symptom_escalation",
      priority: isVerySerious ? "urgent" : "high",
      title: `Symptom Escalation: ${symptom.symptomName}`,
      message: `You logged a ${symptom.severity} symptom. Consider contacting your healthcare provider.`,
      recommendation: "Track any changes and discuss with your healthcare provider at your next visit.",
      conditionId: symptom.conditionId,
    });
  }

  const recentSymptoms = symptomLogs.filter(
    s => s.patientId === patientId && 
    s.symptomName === symptom.symptomName &&
    new Date(s.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  if (recentSymptoms.length >= 3) {
    await createAlert(patientId, {
      alertType: "symptom_escalation",
      priority: "medium",
      title: `Recurring Symptom: ${symptom.symptomName}`,
      message: `You've logged "${symptom.symptomName}" ${recentSymptoms.length} times in the past week.`,
      recommendation: "Consider mentioning this pattern to your healthcare provider.",
      conditionId: symptom.conditionId,
    });
  }
}

async function createAlert(
  patientId: string,
  data: {
    alertType: CDMAlertType;
    priority: CDMAlertPriority;
    title: string;
    message: string;
    recommendation?: string;
    conditionId?: string;
    triggerData?: Record<string, unknown>;
  }
): Promise<CDMPredictiveAlert> {
  const existingAlert = predictiveAlerts.find(
    a => a.patientId === patientId && 
    a.alertType === data.alertType && 
    a.title === data.title &&
    !a.isDismissed &&
    new Date(a.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  if (existingAlert) {
    return existingAlert;
  }

  const alert: CDMPredictiveAlert = {
    id: generateId("alert"),
    patientId,
    conditionId: data.conditionId,
    alertType: data.alertType,
    priority: data.priority,
    title: data.title,
    message: data.message,
    recommendation: data.recommendation,
    triggerData: data.triggerData,
    isRead: false,
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };

  predictiveAlerts.push(alert);
  return alert;
}

export async function getAlerts(patientId: string, includeRead = false): Promise<CDMPredictiveAlert[]> {
  return predictiveAlerts
    .filter(a => a.patientId === patientId && !a.isDismissed && (includeRead || !a.isRead))
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export async function dismissAlert(patientId: string, alertId: string): Promise<boolean> {
  const alert = predictiveAlerts.find(a => a.id === alertId && a.patientId === patientId);
  if (alert) {
    alert.isDismissed = true;
    return true;
  }
  return false;
}

export async function markAlertRead(patientId: string, alertId: string): Promise<boolean> {
  const alert = predictiveAlerts.find(a => a.id === alertId && a.patientId === patientId);
  if (alert) {
    alert.isRead = true;
    return true;
  }
  return false;
}

export async function generateProgressSnapshot(
  patientId: string,
  planId: string
): Promise<ProgressSnapshot> {
  const plan = await getManagementPlan(patientId, planId);
  if (!plan) {
    throw new Error("Plan not found");
  }

  const recentAdherence = adherenceLogs.filter(
    a => a.patientId === patientId &&
    new Date(a.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const adherenceRate = recentAdherence.length > 0
    ? (recentAdherence.filter(a => a.status === "taken").length / recentAdherence.length) * 100
    : 0;

  const recentSymptoms = symptomLogs.filter(
    s => s.patientId === patientId &&
    new Date(s.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const previousSymptoms = symptomLogs.filter(
    s => s.patientId === patientId &&
    new Date(s.loggedAt).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000 &&
    new Date(s.loggedAt).getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const avgSeverity = (symptoms: SymptomLog[]) => {
    if (symptoms.length === 0) return 0;
    const severityMap: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3, critical: 4, very_severe: 4 };
    return symptoms.reduce((sum, s) => sum + (severityMap[s.severity] || 0), 0) / symptoms.length;
  };

  const currentAvg = avgSeverity(recentSymptoms);
  const previousAvg = avgSeverity(previousSymptoms);
  const symptomTrend: ProgressSnapshot["symptomTrend"] = 
    currentAvg < previousAvg - 0.5 ? "improving" :
    currentAvg > previousAvg + 0.5 ? "worsening" : "stable";

  const goalProgress: Record<string, number> = {};
  plan.goals.forEach(g => {
    goalProgress[g.id] = g.progressPercentage || 0;
  });

  const overallScore = Math.round(
    (adherenceRate * 0.4) + 
    (Object.values(goalProgress).reduce((a, b) => a + b, 0) / Math.max(Object.keys(goalProgress).length, 1) * 0.4) +
    (symptomTrend === "improving" ? 20 : symptomTrend === "stable" ? 10 : 0)
  );

  let aiSummary = `Your weekly progress score is ${overallScore}%. Medication adherence: ${Math.round(adherenceRate)}%. Symptoms are ${symptomTrend}.`;
  let recommendations: string[] = [];

  if (isAiEnabled()) {
    try {
      const response = await generatePhiSafeText({
        system: `${NO_CDS_GUARDRAIL}
You are a supportive health education assistant. Generate an encouraging progress summary.
Return JSON: {"summary": "2-3 sentence encouraging summary", "recommendations": ["Educational tip 1", "Educational tip 2"]}`,
        user: `Weekly progress for chronic condition management:
- Adherence rate: ${Math.round(adherenceRate)}%
- Symptom trend: ${symptomTrend}
- Goals completed: ${plan.goals.filter(g => g.status === "achieved").length}/${plan.goals.length}
- Lifestyle logs this week: ${lifestyleLogs.filter(l => l.patientId === patientId && new Date(l.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length}

Generate supportive educational feedback.`,
        responseMimeType: "application/json",
        maxTokens: 500,
      });

      const result = JSON.parse(response || "{}");
      aiSummary = result.summary || aiSummary;
      recommendations = result.recommendations || [];
    } catch (error) {
      console.error("[ChronicDisease] AI summary failed:", error);
      recommendations = [
        "Keep tracking your symptoms to identify patterns",
        "Set daily reminders for your medications",
        "Stay hydrated and maintain regular activity",
      ];
    }
  }

  const previousSnapshots = progressSnapshots.filter(s => s.patientId === patientId && s.planId === planId);
  const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];

  const snapshot: ProgressSnapshot = {
    id: generateId("snap"),
    patientId,
    planId,
    snapshotDate: new Date().toISOString(),
    overallScore,
    goalProgress,
    adherenceRate,
    symptomTrend,
    aiSummary,
    recommendations,
    comparedToPrevious: lastSnapshot ? {
      scoreChange: overallScore - lastSnapshot.overallScore,
      adherenceChange: adherenceRate - lastSnapshot.adherenceRate,
      trendChange: symptomTrend !== lastSnapshot.symptomTrend ? `${lastSnapshot.symptomTrend} → ${symptomTrend}` : "unchanged",
    } : undefined,
  };

  progressSnapshots.push(snapshot);
  return snapshot;
}

export async function getProgressSnapshots(patientId: string, planId?: string): Promise<ProgressSnapshot[]> {
  return progressSnapshots
    .filter(s => s.patientId === patientId && (!planId || s.planId === planId))
    .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
}

export async function generateEducationContent(
  patientId: string,
  conditionType: ChronicConditionType,
  topic?: string
): Promise<PersonalizedEducationContent> {
  let content: PersonalizedEducationContent;

  if (isAiEnabled()) {
    try {
      const response = await generatePhiSafeText({
        system: `${NO_CDS_GUARDRAIL}
You are a patient education specialist. Create easy-to-understand educational content.
Use simple language (8th grade reading level). Be supportive and encouraging.
Return JSON: {
  "title": "Educational title",
  "content": "2-3 paragraphs of educational content",
  "contentType": "article",
  "relevanceScore": 0.9
}`,
        user: `Create educational content about ${topic || "general self-management"} for someone managing ${conditionType.replace(/_/g, " ")}.
Focus on practical self-care tips and when to seek provider guidance.`,
        responseMimeType: "application/json",
        maxTokens: 800,
      });

      const result = JSON.parse(response || "{}");
      content = {
        id: generateId("edu"),
        patientId,
        conditionType,
        title: result.title || `Understanding Your ${conditionType.replace(/_/g, " ")}`,
        content: result.content || getDefaultEducationText(conditionType),
        contentType: result.contentType || "article",
        readingLevel: "simple",
        isAIGenerated: true,
        relevanceScore: result.relevanceScore || 0.8,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[ChronicDisease] Education generation failed:", error);
      content = {
        id: generateId("edu"),
        patientId,
        conditionType,
        title: `Understanding ${conditionType.replace(/_/g, " ")}`,
        content: getDefaultEducationText(conditionType),
        contentType: "article",
        readingLevel: "simple",
        isAIGenerated: false,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
    }
  } else {
    content = {
      id: generateId("edu"),
      patientId,
      conditionType,
      title: `Understanding ${conditionType.replace(/_/g, " ")}`,
      content: getDefaultEducationText(conditionType),
      contentType: "article",
      readingLevel: "simple",
      isAIGenerated: false,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
  }

  educationContent.push(content);
  return content;
}

export async function getEducationContent(patientId: string): Promise<PersonalizedEducationContent[]> {
  return educationContent
    .filter(e => e.patientId === patientId)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

export async function markEducationCompleted(
  patientId: string,
  contentId: string,
  feedback?: { helpful: boolean; comments?: string }
): Promise<boolean> {
  const content = educationContent.find(e => e.id === contentId && e.patientId === patientId);
  if (content) {
    content.isCompleted = true;
    content.completedAt = new Date().toISOString();
    if (feedback) {
      content.feedback = feedback;
    }
    return true;
  }
  return false;
}

function getDefaultGoals(conditionType: ChronicConditionType): ManagementGoal[] {
  const commonGoals: ManagementGoal[] = [
    {
      id: generateId("goal"),
      title: "Track daily symptoms",
      description: "Log your symptoms at least once daily to identify patterns",
      status: "not_started",
      progressPercentage: 0,
    },
    {
      id: generateId("goal"),
      title: "Medication adherence",
      description: "Take medications as prescribed and log each dose",
      status: "not_started",
      progressPercentage: 0,
    },
  ];

  const conditionSpecific: Record<string, ManagementGoal[]> = {
    diabetes_type2: [
      { id: generateId("goal"), title: "Monitor blood glucose", description: "Check and log blood sugar levels as recommended by your provider", status: "not_started", progressPercentage: 0 },
      { id: generateId("goal"), title: "Healthy eating", description: "Follow a balanced diet and track meals", status: "not_started", progressPercentage: 0 },
    ],
    hypertension: [
      { id: generateId("goal"), title: "Monitor blood pressure", description: "Check and log blood pressure regularly", status: "not_started", progressPercentage: 0 },
      { id: generateId("goal"), title: "Reduce sodium intake", description: "Track salt consumption and aim for recommended limits", status: "not_started", progressPercentage: 0 },
    ],
  };

  return [...commonGoals, ...(conditionSpecific[conditionType] || [])];
}

function getDefaultInterventions(conditionType: ChronicConditionType): ManagementIntervention[] {
  return [
    { id: generateId("int"), category: "monitoring", title: "Daily symptom tracking", description: "Log symptoms to identify triggers and patterns", isActive: true },
    { id: generateId("int"), category: "medication", title: "Medication reminders", description: "Set up daily reminders for all medications", isActive: true },
    { id: generateId("int"), category: "lifestyle", title: "Physical activity", description: "Maintain regular activity as approved by your provider", isActive: true },
    { id: generateId("int"), category: "education", title: "Learn about your condition", description: "Complete educational modules about managing your condition", isActive: true },
    { id: generateId("int"), category: "follow_up", title: "Provider check-ins", description: "Attend scheduled appointments and prepare questions", isActive: true },
  ];
}

function getDefaultMonitoring(conditionType: ChronicConditionType): MonitoringItem[] {
  const common: MonitoringItem[] = [
    { id: generateId("mon"), type: "symptom", name: "Symptom log", frequency: "Daily" },
    { id: generateId("mon"), type: "behavior", name: "Medication adherence", frequency: "Each dose" },
  ];

  const specific: Record<string, MonitoringItem[]> = {
    diabetes_type2: [
      { id: generateId("mon"), type: "vital", name: "Blood glucose", frequency: "As prescribed", unit: "mg/dL" },
      { id: generateId("mon"), type: "vital", name: "Weight", frequency: "Weekly", unit: "lbs" },
    ],
    hypertension: [
      { id: generateId("mon"), type: "vital", name: "Blood pressure", frequency: "Daily", unit: "mmHg" },
      { id: generateId("mon"), type: "vital", name: "Heart rate", frequency: "Daily", unit: "bpm" },
    ],
  };

  return [...common, ...(specific[conditionType] || [])];
}

function getDefaultEducation(conditionType: ChronicConditionType): EducationTopic[] {
  return [
    { id: generateId("edu"), title: "Understanding Your Condition", category: "basics", content: "Learn the fundamentals of your condition and how it affects your body.", isCompleted: false, aiPersonalized: false },
    { id: generateId("edu"), title: "Medication Management", category: "treatment", content: "Tips for taking your medications correctly and on time.", isCompleted: false, aiPersonalized: false },
    { id: generateId("edu"), title: "Lifestyle Modifications", category: "lifestyle", content: "Diet, exercise, and sleep habits that support your health.", isCompleted: false, aiPersonalized: false },
    { id: generateId("edu"), title: "When to Seek Help", category: "safety", content: "Warning signs that mean you should contact your healthcare provider.", isCompleted: false, aiPersonalized: false },
  ];
}

function getDefaultEducationText(conditionType: ChronicConditionType): string {
  const texts: Record<string, string> = {
    diabetes_type2: `Managing Type 2 Diabetes\n\nType 2 diabetes is a condition where your body doesn't use insulin effectively. With proper self-management, many people live healthy, active lives.\n\nKey self-care tips:\n- Monitor your blood sugar as recommended\n- Take medications as prescribed\n- Eat balanced meals with controlled portions\n- Stay physically active\n- Check your feet daily\n\nAlways discuss any concerns with your healthcare provider.\n\nEducational content only. Not medical advice.`,
    hypertension: `Managing High Blood Pressure\n\nHigh blood pressure, or hypertension, means the force of blood against your artery walls is too high. It often has no symptoms but can lead to serious problems if untreated.\n\nSelf-care tips:\n- Take blood pressure medications as prescribed\n- Monitor your blood pressure regularly\n- Reduce salt in your diet\n- Maintain a healthy weight\n- Limit alcohol and avoid smoking\n- Manage stress\n\nEducational content only. Not medical advice.`,
  };

  return texts[conditionType] || `Managing Your Chronic Condition\n\nLiving with a chronic condition requires daily attention and self-care. Working with your healthcare team and staying informed are key to managing your health.\n\nGeneral tips:\n- Take medications as prescribed\n- Keep track of your symptoms\n- Attend regular check-ups\n- Maintain healthy habits\n- Ask questions and stay informed\n\nEducational content only. Not medical advice.`;
}

export async function getDashboardSummary(patientId: string): Promise<{
  conditions: ChronicConditionProfile[];
  activePlans: ChronicDiseaseManagementPlan[];
  recentAlerts: CDMPredictiveAlert[];
  weeklyAdherenceRate: number;
  symptomTrend: string;
  nextGoals: ManagementGoal[];
  educationProgress: { completed: number; total: number };
}> {
  const conditions = await getPatientConditions(patientId);
  const plans = await getPatientPlans(patientId);
  const alerts = await getAlerts(patientId);
  const education = await getEducationContent(patientId);

  const recentAdherence = adherenceLogs.filter(
    a => a.patientId === patientId &&
    new Date(a.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  );
  const weeklyAdherenceRate = recentAdherence.length > 0
    ? Math.round((recentAdherence.filter(a => a.status === "taken").length / recentAdherence.length) * 100)
    : 0;

  const recentSymptoms = symptomLogs.filter(
    s => s.patientId === patientId &&
    new Date(s.loggedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  );
  const severityMap: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3, critical: 4, very_severe: 4 };
  const avgSeverity = recentSymptoms.length > 0
    ? recentSymptoms.reduce((sum, s) => sum + (severityMap[s.severity] || 0), 0) / recentSymptoms.length
    : 0;
  const symptomTrend = avgSeverity < 1 ? "good" : avgSeverity < 2 ? "stable" : "needs_attention";

  const allGoals = plans.flatMap(p => p.goals);
  const nextGoals = allGoals.filter(g => g.status !== "achieved").slice(0, 3);

  return {
    conditions,
    activePlans: plans.filter(p => p.status === "active"),
    recentAlerts: alerts.slice(0, 5),
    weeklyAdherenceRate,
    symptomTrend,
    nextGoals,
    educationProgress: {
      completed: education.filter(e => e.isCompleted).length,
      total: education.length,
    },
  };
}
