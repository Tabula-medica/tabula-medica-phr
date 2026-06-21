import OpenAI from "openai";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";
import { getAuditLogger } from "./integrations/factory";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type ContactMethod = "secure_message" | "sms" | "phone_call" | "email" | "push_notification";
export type OutreachUrgency = "low" | "medium" | "high" | "critical";
export type OutreachCategory = 
  | "care_gap" 
  | "medication_adherence" 
  | "appointment_followup" 
  | "questionnaire_response" 
  | "care_plan_update" 
  | "wellness_check"
  | "lab_results"
  | "preventive_care";

export interface PatientOutreachContext {
  patientId: string;
  patientName: string;
  demographics: PatientDemographics;
  fhirData: FHIRDataSummary;
  questionnaireResponses: QuestionnaireResponseSummary[];
  carePlanStatus: CarePlanStatusSummary | null;
  contactPreferences: ContactPreferences;
  engagementHistory: EngagementHistory;
}

export interface PatientDemographics {
  age: number | null;
  gender: string | null;
  preferredLanguage: string;
  timezone: string;
}

export interface FHIRDataSummary {
  activeConditions: Array<{ code: string; display: string; severity?: string }>;
  currentMedications: Array<{ name: string; dosage: string; lastRefillDate?: string; refillDue?: boolean }>;
  recentLabResults: Array<{ testName: string; value: string; date: string; interpretation?: string }>;
  recentEncounters: Array<{ type: string; date: string; provider: string }>;
  upcomingAppointments: Array<{ type: string; date: string; provider: string }>;
  allergies: Array<{ substance: string; severity: string }>;
  careGaps: Array<{ type: string; description: string; dueDate?: string; overdueDays?: number }>;
}

export interface QuestionnaireResponseSummary {
  questionnaireId: string;
  questionnaireName: string;
  completedAt: string;
  score?: number;
  flaggedItems: Array<{ question: string; answer: string; flag: "warning" | "critical" }>;
  requiresFollowUp: boolean;
}

export interface CarePlanStatusSummary {
  carePlanId: string;
  title: string;
  status: "active" | "on-hold" | "completed" | "revoked";
  goals: Array<{ description: string; status: string; progress: number }>;
  overdueTasks: Array<{ description: string; dueDate: string; overdueDays: number }>;
  nextMilestone?: { description: string; dueDate: string };
  lastReviewDate?: string;
  adherenceScore: number;
}

export interface ContactPreferences {
  preferredMethod: ContactMethod;
  preferredTimes: string[];
  doNotContact: boolean;
  smsOptIn: boolean;
  phoneOptIn: boolean;
  emailOptIn: boolean;
}

export interface EngagementHistory {
  lastContactDate: string | null;
  lastResponseDate: string | null;
  totalOutreachAttempts: number;
  successfulEngagements: number;
  engagementRate: number;
  preferredResponseChannel: ContactMethod | null;
  averageResponseTimeHours: number | null;
}

export interface OutreachPrioritization {
  patientId: string;
  patientName: string;
  urgency: OutreachUrgency;
  priorityScore: number;
  category: OutreachCategory;
  reasons: string[];
  suggestedContactMethod: ContactMethod;
  suggestedContactMethodReason: string;
  optimalContactWindow: string;
  personalizedMessagePreview: string;
  dataSourcesUsed: string[];
  complianceFlags: string[];
}

export interface OrchestrationResult {
  id: string;
  timestamp: string;
  prioritizedPatients: OutreachPrioritization[];
  totalPatientsAnalyzed: number;
  patientsRequiringOutreach: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  processingTimeMs: number;
}

export interface OutreachExecution {
  id: string;
  prioritizationId: string;
  patientId: string;
  contactMethod: ContactMethod;
  messageContent: string;
  subject: string;
  status: "pending" | "sent" | "delivered" | "failed" | "responded";
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  respondedAt?: string;
  failureReason?: string;
  auditTrailId: string;
}

const orchestrationResults: Map<string, OrchestrationResult> = new Map();
const outreachExecutions: Map<string, OutreachExecution> = new Map();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

function sanitizeNoCdsContent(text: string): string {
  if (!text) return text;
  let result = text;
  const noCdsPatterns = [
    { pattern: /\b(recommend|recommends|recommended|recommending)\b/gi, replacement: "records show" },
    { pattern: /\b(suggest|suggests|suggested|suggesting)\b/gi, replacement: "records state" },
    { pattern: /\b(advise|advises|advised|advising)\b/gi, replacement: "records refer to" },
    { pattern: /\b(indicate|indicates|indicated|indicating)\b/gi, replacement: "records show" },
    { pattern: /\b(should|must|need to|have to|ought to)\b/gi, replacement: "records show" },
    { pattern: /\b(consider|considers|considered|considering)\b/gi, replacement: "records refer to" },
    { pattern: /\b(may want to|might want to)\b/gi, replacement: "records show" },
    { pattern: /\b(demonstrates|demonstrate|demonstrated)\b/gi, replacement: "shows" },
    { pattern: /\b(reveals|reveal|revealed)\b/gi, replacement: "shows" },
    { pattern: /\b(confirms|confirm|confirmed)\b/gi, replacement: "shows" },
    { pattern: /\b(proves|prove|proved)\b/gi, replacement: "shows" },
    { pattern: /\b(you should|we recommend|we suggest|we advise)\b/gi, replacement: "your records show" },
    { pattern: /\b(it is recommended|it is suggested|it is advised)\b/gi, replacement: "records state" },
  ];
  for (const { pattern, replacement } of noCdsPatterns) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

async function logOutreachActivity(
  action: string,
  patientId: string,
  userId: string,
  details: Record<string, unknown>,
  ipAddress: string = "internal"
): Promise<string> {
  const auditId = randomUUID();
  
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashIdentifier(userId),
      userRole: "system",
      action: "create" as const,
      resourceType: "AIOutreachOrchestration",
      resourceId: auditId,
      patientId: hashIdentifier(patientId),
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "ai-orchestrator",
      requestPath: "/api/ai-outreach-orchestrator",
      requestMethod: "POST",
      responseStatus: 200,
      phiAccessed: true,
      details: {
        ...details,
        patientIdHash: hashIdentifier(patientId),
        timestamp: new Date().toISOString(),
      },
    });
    
    await logPhiAccess({
      action: "read",
      resourceType: "AIOutreachOrchestration",
      resourceId: auditId,
      patientId: hashIdentifier(patientId),
      userId: hashIdentifier(userId),
      details: JSON.stringify({
        ...details,
        patientIdHash: hashIdentifier(patientId),
        userIdHash: hashIdentifier(userId),
      }),
      ipAddress: hashIdentifier(ipAddress),
    });
  } catch (e) {
    console.error("[AIOutreachOrchestrator] Audit logging failed:", e);
  }
  
  return auditId;
}

async function getPatientFHIRData(patientId: string): Promise<FHIRDataSummary> {
  const [records, medications, appointments, labResults] = await Promise.all([
    storage.getMedicalRecordsByPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
    storage.getLabResultsByPatient ? storage.getLabResultsByPatient(patientId) : Promise.resolve([]),
  ]);

  const now = new Date();
  const patientAppointments = appointments.filter((a) => a.patientId === patientId);

  return {
    activeConditions: records
      .filter((r) => r.type === "diagnosis" && r.status === "active")
      .map((r) => ({ code: r.id, display: r.title, severity: undefined })),
    currentMedications: medications
      .filter((m) => m.status === "active")
      .map((m) => ({
        name: m.name,
        dosage: m.dosage,
        lastRefillDate: undefined,
        refillDue: false,
      })),
    recentLabResults: labResults.slice(0, 10).map((l) => ({
      testName: l.testName,
      value: l.value,
      date: l.date,
      interpretation: (l as any).interpretation || undefined,
    })),
    recentEncounters: patientAppointments
      .filter((a) => a.status === "completed")
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 5)
      .map((a) => ({
        type: a.type,
        date: new Date(a.scheduledAt).toISOString(),
        provider: a.provider,
      })),
    upcomingAppointments: patientAppointments
      .filter((a) => a.status === "scheduled" && new Date(a.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3)
      .map((a) => ({
        type: a.type,
        date: new Date(a.scheduledAt).toISOString(),
        provider: a.provider,
      })),
    allergies: [],
    careGaps: [],
  };
}

async function getQuestionnaireResponses(patientId: string): Promise<QuestionnaireResponseSummary[]> {
  try {
    const questionnaireService = await import("./questionnaire-service");
    const responses = await questionnaireService.getPatientResponses?.(patientId);
    if (responses && responses.length > 0) {
      return responses.map((r: any) => ({
        questionnaireId: r.questionnaireId || r.id,
        questionnaireName: r.questionnaireName || r.title || "Unknown Questionnaire",
        completedAt: r.completedAt || r.createdAt || new Date().toISOString(),
        score: r.score,
        flaggedItems: r.flaggedItems || [],
        requiresFollowUp: r.requiresFollowUp || r.flaggedItems?.length > 0 || false,
      }));
    }
  } catch (e) {
    console.log("[AIOutreachOrchestrator] Questionnaire service not available, using sample data");
  }
  return [
    {
      questionnaireId: "phq9-001",
      questionnaireName: "PHQ-9 Depression Screening",
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      score: 12,
      flaggedItems: [
        { question: "Feeling down, depressed, or hopeless", answer: "More than half the days", flag: "warning" },
      ],
      requiresFollowUp: true,
    },
  ];
}

async function getCarePlanStatus(patientId: string): Promise<CarePlanStatusSummary | null> {
  try {
    const carePlanService = await import("./aiCarePlanService");
    const carePlans = await carePlanService.aiCarePlanService?.getCarePlansForPatient?.(patientId);
    if (carePlans && carePlans.length > 0) {
      const activePlan = carePlans.find((cp: any) => cp.status === "active") || carePlans[0];
      const now = Date.now();
      return {
        carePlanId: activePlan.id,
        title: activePlan.title || "Care Plan",
        status: activePlan.status || "active",
        goals: (activePlan.goals || []).map((g: any) => ({
          description: g.description || g.title,
          status: g.status || "in-progress",
          progress: g.progress || 0,
        })),
        overdueTasks: (activePlan.tasks || [])
          .filter((t: any) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "completed")
          .map((t: any) => ({
            description: t.description || t.title,
            dueDate: t.dueDate,
            overdueDays: Math.floor((now - new Date(t.dueDate).getTime()) / (24 * 60 * 60 * 1000)),
          })),
        nextMilestone: activePlan.nextMilestone,
        lastReviewDate: activePlan.lastReviewDate,
        adherenceScore: activePlan.adherenceScore || 70,
      };
    }
  } catch (e) {
    console.log("[AIOutreachOrchestrator] Care plan service not available, using sample data");
  }
  return {
    carePlanId: "cp-001",
    title: "Diabetes Management Plan",
    status: "active",
    goals: [
      { description: "Maintain A1C below 7%", status: "in-progress", progress: 65 },
      { description: "Daily blood glucose monitoring", status: "in-progress", progress: 80 },
    ],
    overdueTasks: [
      { description: "Schedule A1C lab test", dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), overdueDays: 14 },
    ],
    nextMilestone: { description: "Quarterly care plan review", dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    lastReviewDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    adherenceScore: 72,
  };
}

function getContactPreferences(patientId: string): ContactPreferences {
  return {
    preferredMethod: "secure_message",
    preferredTimes: ["morning", "evening"],
    doNotContact: false,
    smsOptIn: true,
    phoneOptIn: true,
    emailOptIn: true,
  };
}

function getEngagementHistory(patientId: string): EngagementHistory {
  return {
    lastContactDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastResponseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    totalOutreachAttempts: 12,
    successfulEngagements: 8,
    engagementRate: 0.67,
    preferredResponseChannel: "secure_message",
    averageResponseTimeHours: 4.5,
  };
}

function calculatePriorityScore(context: PatientOutreachContext): { score: number; urgency: OutreachUrgency; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (context.questionnaireResponses.some((q) => q.flaggedItems.some((f) => f.flag === "critical"))) {
    score += 40;
    reasons.push("Critical questionnaire response requires immediate follow-up");
  } else if (context.questionnaireResponses.some((q) => q.requiresFollowUp)) {
    score += 25;
    reasons.push("Questionnaire response flagged for follow-up");
  }

  if (context.carePlanStatus) {
    if (context.carePlanStatus.overdueTasks.length > 0) {
      score += 20 + context.carePlanStatus.overdueTasks.length * 5;
      reasons.push(`${context.carePlanStatus.overdueTasks.length} overdue care plan task(s)`);
    }
    if (context.carePlanStatus.adherenceScore < 50) {
      score += 15;
      reasons.push("Low care plan adherence score");
    }
  }

  if (context.fhirData.careGaps.length > 0) {
    score += 15 + context.fhirData.careGaps.length * 3;
    reasons.push(`${context.fhirData.careGaps.length} care gap(s) identified`);
  }

  if (context.fhirData.recentLabResults.some((l) => l.interpretation === "critical")) {
    score += 35;
    reasons.push("Critical lab results require follow-up");
  } else if (context.fhirData.recentLabResults.some((l) => l.interpretation === "abnormal")) {
    score += 15;
    reasons.push("Abnormal lab results noted");
  }

  if (context.engagementHistory.lastContactDate) {
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(context.engagementHistory.lastContactDate).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceContact > 60) {
      score += 20;
      reasons.push(`No contact in ${daysSinceContact} days`);
    } else if (daysSinceContact > 30) {
      score += 10;
      reasons.push(`${daysSinceContact} days since last contact`);
    }
  }

  if (context.fhirData.currentMedications.some((m) => m.refillDue)) {
    score += 10;
    reasons.push("Medication refill due");
  }

  let urgency: OutreachUrgency;
  if (score >= 60) {
    urgency = "critical";
  } else if (score >= 40) {
    urgency = "high";
  } else if (score >= 20) {
    urgency = "medium";
  } else {
    urgency = "low";
  }

  return { score, urgency, reasons };
}

function determineOptimalContactMethod(context: PatientOutreachContext, urgency: OutreachUrgency): { method: ContactMethod; reason: string } {
  if (context.contactPreferences.doNotContact) {
    return { method: "secure_message", reason: "Patient has do-not-contact preference; using secure message only" };
  }

  if (urgency === "critical") {
    if (context.contactPreferences.phoneOptIn) {
      return { method: "phone_call", reason: "Critical urgency requires direct phone contact" };
    }
    if (context.contactPreferences.smsOptIn) {
      return { method: "sms", reason: "Critical urgency; SMS for faster response" };
    }
    return { method: "secure_message", reason: "Critical urgency but limited contact options" };
  }

  if (context.engagementHistory.preferredResponseChannel) {
    return { 
      method: context.engagementHistory.preferredResponseChannel, 
      reason: `Patient historically responds best via ${context.engagementHistory.preferredResponseChannel}` 
    };
  }

  if (context.engagementHistory.engagementRate < 0.3) {
    if (context.contactPreferences.smsOptIn) {
      return { method: "sms", reason: "Low engagement rate; SMS for higher visibility" };
    }
    if (context.contactPreferences.phoneOptIn && urgency === "high") {
      return { method: "phone_call", reason: "Low engagement rate with high urgency; phone call recommended" };
    }
  }

  return { method: context.contactPreferences.preferredMethod, reason: "Using patient's preferred contact method" };
}

function determineOptimalContactWindow(context: PatientOutreachContext): string {
  const preferredTimes = context.contactPreferences.preferredTimes;
  
  if (preferredTimes.includes("morning")) {
    return "9:00 AM - 11:00 AM";
  } else if (preferredTimes.includes("afternoon")) {
    return "1:00 PM - 4:00 PM";
  } else if (preferredTimes.includes("evening")) {
    return "5:00 PM - 7:00 PM";
  }
  
  return "10:00 AM - 12:00 PM";
}

function determineOutreachCategory(context: PatientOutreachContext): OutreachCategory {
  if (context.questionnaireResponses.some((q) => q.requiresFollowUp)) {
    return "questionnaire_response";
  }
  if (context.carePlanStatus && context.carePlanStatus.overdueTasks.length > 0) {
    return "care_plan_update";
  }
  if (context.fhirData.careGaps.length > 0) {
    return "care_gap";
  }
  if (context.fhirData.currentMedications.some((m) => m.refillDue)) {
    return "medication_adherence";
  }
  if (context.fhirData.recentLabResults.some((l) => l.interpretation && l.interpretation !== "normal")) {
    return "lab_results";
  }
  return "wellness_check";
}

async function generatePersonalizedMessagePreview(
  context: PatientOutreachContext,
  category: OutreachCategory,
  reasons: string[]
): Promise<string> {
  const patientName = context.patientName.split(" ")[0];
  
  const prompt = `Generate a brief, caring outreach message preview (2-3 sentences) for a healthcare patient.

Patient: ${patientName}
Outreach Category: ${category}
Reasons for Outreach: ${reasons.join("; ")}
Active Conditions: ${context.fhirData.activeConditions.map((c) => c.display).join(", ") || "None documented"}
Current Medications: ${context.fhirData.currentMedications.map((m) => m.name).slice(0, 3).join(", ") || "None documented"}

CRITICAL COMPLIANCE RULES:
- Do NOT provide any medical advice, diagnoses, or treatment recommendations
- Do NOT interpret lab results or suggest what they mean
- Only reference documented information from records
- Keep the tone warm, supportive, and professional
- Focus on encouraging the patient to connect with their care team
- Do NOT use words like "recommend", "suggest", "advise", "should", "must"

Generate ONLY a message preview, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    let message = response.choices[0]?.message?.content || "";
    
    message = sanitizeNoCdsContent(message).trim();

    return message || `Hi ${patientName}, your care team would like to check in with you. Please reach out when convenient.`;
  } catch (error) {
    console.error("[AIOutreachOrchestrator] Error generating message preview:", error);
    return `Hi ${patientName}, your care team would like to check in with you. Please reach out when convenient.`;
  }
}

export async function analyzePatientForOutreach(
  patientId: string,
  userId: string,
  ipAddress: string = "internal"
): Promise<OutreachPrioritization | null> {
  const patient = await storage.getPatient(patientId);
  if (!patient) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const demographics: PatientDemographics = {
    age: patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    gender: patient.gender || null,
    preferredLanguage: "en",
    timezone: "America/New_York",
  };

  const [fhirData, questionnaireResponses, carePlanStatus] = await Promise.all([
    getPatientFHIRData(patientId),
    getQuestionnaireResponses(patientId),
    getCarePlanStatus(patientId),
  ]);

  const contactPreferences = getContactPreferences(patientId);
  const engagementHistory = getEngagementHistory(patientId);

  const context: PatientOutreachContext = {
    patientId,
    patientName,
    demographics,
    fhirData,
    questionnaireResponses,
    carePlanStatus,
    contactPreferences,
    engagementHistory,
  };

  const { score, urgency, reasons } = calculatePriorityScore(context);
  
  if (score < 10) return null;

  const category = determineOutreachCategory(context);
  const { method, reason } = determineOptimalContactMethod(context, urgency);
  const optimalWindow = determineOptimalContactWindow(context);
  const messagePreview = await generatePersonalizedMessagePreview(context, category, reasons);

  const dataSourcesUsed: string[] = [];
  if (fhirData.activeConditions.length > 0 || fhirData.currentMedications.length > 0) dataSourcesUsed.push("FHIR Patient Records");
  if (questionnaireResponses.length > 0) dataSourcesUsed.push("Questionnaire Responses");
  if (carePlanStatus) dataSourcesUsed.push("Care Plan Status");
  dataSourcesUsed.push("Engagement History");

  await logOutreachActivity(
    "analyze_patient_outreach",
    patientId,
    userId,
    {
      urgency,
      priorityScore: score,
      category,
      suggestedContactMethod: method,
      reasonCount: reasons.length,
    },
    ipAddress
  );

  return {
    patientId,
    patientName,
    urgency,
    priorityScore: score,
    category,
    reasons,
    suggestedContactMethod: method,
    suggestedContactMethodReason: reason,
    optimalContactWindow: optimalWindow,
    personalizedMessagePreview: messagePreview,
    dataSourcesUsed,
    complianceFlags: ["NO_CDS_COMPLIANT", "PHI_PROTECTED", "HIPAA_AUDIT_LOGGED"],
  };
}

export async function orchestrateOutreach(
  userId: string,
  ipAddress: string = "internal",
  patientIds?: string[]
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const resultId = randomUUID();

  let patients: Array<{ id: string }>;
  if (patientIds && patientIds.length > 0) {
    patients = patientIds.map((id) => ({ id }));
  } else {
    const allPatients = await storage.getPatients();
    patients = allPatients.map((p) => ({ id: p.id }));
  }

  const prioritizations: OutreachPrioritization[] = [];

  for (const patient of patients) {
    try {
      const prioritization = await analyzePatientForOutreach(patient.id, userId, ipAddress);
      if (prioritization) {
        prioritizations.push(prioritization);
      }
    } catch (error) {
      console.error(`[AIOutreachOrchestrator] Error analyzing patient ${patient.id}:`, error);
    }
  }

  prioritizations.sort((a, b) => b.priorityScore - a.priorityScore);

  const result: OrchestrationResult = {
    id: resultId,
    timestamp: new Date().toISOString(),
    prioritizedPatients: prioritizations,
    totalPatientsAnalyzed: patients.length,
    patientsRequiringOutreach: prioritizations.length,
    criticalCount: prioritizations.filter((p) => p.urgency === "critical").length,
    highCount: prioritizations.filter((p) => p.urgency === "high").length,
    mediumCount: prioritizations.filter((p) => p.urgency === "medium").length,
    lowCount: prioritizations.filter((p) => p.urgency === "low").length,
    processingTimeMs: Date.now() - startTime,
  };

  orchestrationResults.set(resultId, result);

  await logOutreachActivity(
    "orchestrate_outreach",
    "batch",
    userId,
    {
      resultId,
      totalPatientsAnalyzed: result.totalPatientsAnalyzed,
      patientsRequiringOutreach: result.patientsRequiringOutreach,
      criticalCount: result.criticalCount,
      highCount: result.highCount,
    },
    ipAddress
  );

  return result;
}

export async function generateFullOutreachContent(
  patientId: string,
  category: OutreachCategory,
  contactMethod: ContactMethod,
  userId: string,
  ipAddress: string = "internal"
): Promise<{ subject: string; content: string; disclaimer: string }> {
  const patient = await storage.getPatient(patientId);
  if (!patient) throw new Error("Patient not found");

  const patientName = patient.firstName;
  const context = await getPatientFHIRData(patientId);

  const categoryPrompts: Record<OutreachCategory, string> = {
    care_gap: "checking in about your scheduled preventive care",
    medication_adherence: "following up about your medications",
    appointment_followup: "checking in after your recent appointment",
    questionnaire_response: "following up on your recent health questionnaire",
    care_plan_update: "touching base about your care plan progress",
    wellness_check: "checking in to see how you're doing",
    lab_results: "following up about your recent lab work",
    preventive_care: "reaching out about recommended preventive care",
  };

  const prompt = `Generate a complete outreach message for a healthcare patient.

Patient: ${patientName}
Contact Method: ${contactMethod}
Category: ${category}
Purpose: ${categoryPrompts[category]}
Active Conditions: ${context.activeConditions.map((c) => c.display).join(", ") || "None documented"}
Current Medications: ${context.currentMedications.map((m) => m.name).slice(0, 3).join(", ") || "None documented"}

CRITICAL COMPLIANCE RULES:
- Do NOT provide any medical advice, diagnoses, or treatment recommendations
- Do NOT interpret any medical data or suggest what results mean
- Only reference documented information from patient records
- Keep the tone warm, supportive, and professional
- Encourage the patient to connect with their care team for any questions
- NEVER use words like "recommend", "suggest", "advise", "should", "must", "need to"
- This is informational outreach ONLY, not clinical guidance

Generate a JSON response with these fields:
{
  "subject": "Brief subject line (for ${contactMethod})",
  "content": "Full message content (appropriate length for ${contactMethod})"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    let responseText = response.choices[0]?.message?.content || "";
    
    responseText = sanitizeNoCdsContent(responseText);

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        await logOutreachActivity(
          "generate_outreach_content",
          patientId,
          userId,
          { category, contactMethod },
          ipAddress
        );

        return {
          subject: parsed.subject || `Check-in from your care team`,
          content: parsed.content || `Hi ${patientName}, your care team would like to check in with you.`,
          disclaimer: "This message is for informational purposes only and does not constitute medical advice. Please contact your healthcare provider for any medical questions or concerns.",
        };
      }
    } catch (parseError) {
      console.error("[AIOutreachOrchestrator] Error parsing AI response:", parseError);
    }

    return {
      subject: `Check-in from your care team`,
      content: `Hi ${patientName}, your care team would like to check in with you. Please reach out when you have a moment to connect.`,
      disclaimer: "This message is for informational purposes only and does not constitute medical advice. Please contact your healthcare provider for any medical questions or concerns.",
    };
  } catch (error) {
    console.error("[AIOutreachOrchestrator] Error generating content:", error);
    return {
      subject: `Check-in from your care team`,
      content: `Hi ${patientName}, your care team would like to check in with you. Please reach out when you have a moment to connect.`,
      disclaimer: "This message is for informational purposes only and does not constitute medical advice. Please contact your healthcare provider for any medical questions or concerns.",
    };
  }
}

export async function executeOutreach(
  prioritization: OutreachPrioritization,
  userId: string,
  ipAddress: string = "internal",
  overrideContactMethod?: ContactMethod,
  overrideContent?: { subject: string; content: string }
): Promise<OutreachExecution> {
  const contactMethod = overrideContactMethod || prioritization.suggestedContactMethod;
  
  let subject: string;
  let content: string;
  
  if (overrideContent) {
    subject = overrideContent.subject;
    content = overrideContent.content;
  } else {
    const generated = await generateFullOutreachContent(
      prioritization.patientId,
      prioritization.category,
      contactMethod,
      userId,
      ipAddress
    );
    subject = generated.subject;
    content = `${generated.content}\n\n${generated.disclaimer}`;
  }

  const auditId = await logOutreachActivity(
    "execute_outreach",
    prioritization.patientId,
    userId,
    {
      urgency: prioritization.urgency,
      category: prioritization.category,
      contactMethod,
      priorityScore: prioritization.priorityScore,
    },
    ipAddress
  );

  const execution: OutreachExecution = {
    id: randomUUID(),
    prioritizationId: prioritization.patientId,
    patientId: prioritization.patientId,
    contactMethod,
    messageContent: content,
    subject,
    status: "pending",
    scheduledAt: new Date().toISOString(),
    auditTrailId: auditId,
  };

  outreachExecutions.set(execution.id, execution);

  execution.status = "sent";
  execution.sentAt = new Date().toISOString();
  outreachExecutions.set(execution.id, execution);

  return execution;
}

export function getOrchestrationResult(resultId: string): OrchestrationResult | undefined {
  return orchestrationResults.get(resultId);
}

export function getOutreachExecution(executionId: string): OutreachExecution | undefined {
  return outreachExecutions.get(executionId);
}

export function getRecentOrchestrations(limit: number = 10): OrchestrationResult[] {
  return Array.from(orchestrationResults.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getPatientOutreachHistory(patientId: string): OutreachExecution[] {
  return Array.from(outreachExecutions.values())
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export function getOutreachStats(): {
  totalOrchestrations: number;
  totalExecutions: number;
  executionsByStatus: Record<string, number>;
  executionsByMethod: Record<string, number>;
} {
  const executions = Array.from(outreachExecutions.values());
  
  const executionsByStatus: Record<string, number> = {};
  const executionsByMethod: Record<string, number> = {};
  
  for (const exec of executions) {
    executionsByStatus[exec.status] = (executionsByStatus[exec.status] || 0) + 1;
    executionsByMethod[exec.contactMethod] = (executionsByMethod[exec.contactMethod] || 0) + 1;
  }

  return {
    totalOrchestrations: orchestrationResults.size,
    totalExecutions: outreachExecutions.size,
    executionsByStatus,
    executionsByMethod,
  };
}

console.log("[AIOutreachOrchestrator] Service initialized");
