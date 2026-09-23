import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import type { Patient, MedicalRecord, VitalSign, Problem } from "@shared/schema";
import { analyzePatientHealth, generateHealthSnapshot } from "./remoteMonitoring";

// Summary cache for automatic generation with TTL
interface CachedSummary {
  summary: AIPatientSummary;
  cachedAt: number;
  expiresAt: number;
}

const summaryCache: Map<string, CachedSummary> = new Map();
const SUMMARY_TTL_MS = 30 * 60 * 1000; // 30 minutes cache TTL
const CRITICAL_SUMMARY_TTL_MS = 10 * 60 * 1000; // 10 minutes for critical patients

export interface PatientSummaryCard {
  patientId: string;
  patientName: string;
  age: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  activeConditions: number;
  activeMedications: number;
  pendingAlerts: number;
  lastVisit: string;
  nextAppointment?: string;
  adherenceRate?: number;
  recentTrend: "improving" | "stable" | "declining";
}

export interface ProviderDashboardStats {
  totalPatients: number;
  criticalAlerts: number;
  pendingReviews: number;
  upcomingAppointments: number;
  averageAdherenceRate: number;
  riskDistribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

export interface AIPatientSummary {
  patientId: string;
  patientName: string;
  generatedAt: string;
  overviewSummary: string;
  clinicalSynopsis: string;
  healthTrends: {
    category: string;
    trend: "improving" | "stable" | "declining";
    description: string;
    clinicalSignificance: "low" | "moderate" | "high";
  }[];
  riskFactors: {
    factor: string;
    severity: "low" | "moderate" | "high" | "critical";
    explanation: string;
  }[];
  rpmAlertSummary: string;
  keyFindings: string[];
  recommendedActions: string[];
  medicationConcerns: string[];
  followUpRecommendations: string[];
  priorityLevel: "routine" | "attention" | "urgent" | "critical";
  confidenceScore: number;
  isCached: boolean;
  cacheExpiresAt?: string;
}

export interface BatchSummaryResult {
  patientId: string;
  patientName: string;
  summary: AIPatientSummary | null;
  status: "success" | "pending" | "error";
  error?: string;
}

export interface AutoSummaryConfig {
  enableAutoGeneration: boolean;
  refreshIntervalMinutes: number;
  prioritizeHighRisk: boolean;
  maxConcurrentGenerations: number;
}

export interface CustomAlertRule {
  id: string;
  providerId: string;
  patientId?: string;
  name: string;
  description: string;
  metricType: "vital_sign" | "lab_result" | "adherence" | "appointment" | "prom_score";
  metricName: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "between" | "outside";
  thresholdValue: number;
  thresholdValue2?: number;
  severity: "low" | "medium" | "high" | "critical";
  notificationChannels: ("in_app" | "email" | "sms")[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  triggeredCount: number;
}

export interface ProviderMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "provider" | "specialist" | "care_coordinator";
  content: string;
  patientId?: string;
  patientName?: string;
  attachments?: {
    type: "document" | "lab_result" | "image" | "education_module";
    name: string;
    url?: string;
    id?: string;
  }[];
  isEncrypted: boolean;
  readBy: string[];
  createdAt: string;
}

export interface ProviderConversation {
  id: string;
  title: string;
  patientId?: string;
  patientName?: string;
  participants: {
    id: string;
    name: string;
    role: string;
    specialty?: string;
  }[];
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  isArchived: boolean;
  createdAt: string;
}

export interface EducationPrescription {
  id: string;
  providerId: string;
  providerName: string;
  patientId: string;
  patientName: string;
  moduleTitle: string;
  moduleTopic: string;
  reason: string;
  priority: "routine" | "important" | "urgent";
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "expired";
  prescribedAt: string;
  completedAt?: string;
  patientNotes?: string;
}

const mockPatients: PatientSummaryCard[] = [
  {
    patientId: "patient_1",
    patientName: "John Smith",
    age: 65,
    riskLevel: "high",
    activeConditions: 3,
    activeMedications: 7,
    pendingAlerts: 2,
    lastVisit: "2025-01-10",
    nextAppointment: "2025-01-20",
    adherenceRate: 78,
    recentTrend: "stable",
  },
  {
    patientId: "patient_2",
    patientName: "Maria Garcia",
    age: 52,
    riskLevel: "moderate",
    activeConditions: 2,
    activeMedications: 4,
    pendingAlerts: 1,
    lastVisit: "2025-01-12",
    nextAppointment: "2025-01-25",
    adherenceRate: 92,
    recentTrend: "improving",
  },
  {
    patientId: "patient_3",
    patientName: "Robert Johnson",
    age: 71,
    riskLevel: "critical",
    activeConditions: 5,
    activeMedications: 10,
    pendingAlerts: 4,
    lastVisit: "2025-01-08",
    nextAppointment: "2025-01-18",
    adherenceRate: 65,
    recentTrend: "declining",
  },
  {
    patientId: "patient_4",
    patientName: "Sarah Williams",
    age: 45,
    riskLevel: "low",
    activeConditions: 1,
    activeMedications: 2,
    pendingAlerts: 0,
    lastVisit: "2025-01-14",
    adherenceRate: 98,
    recentTrend: "improving",
  },
  {
    patientId: "patient_5",
    patientName: "Michael Brown",
    age: 58,
    riskLevel: "moderate",
    activeConditions: 2,
    activeMedications: 5,
    pendingAlerts: 1,
    lastVisit: "2025-01-11",
    nextAppointment: "2025-01-22",
    adherenceRate: 85,
    recentTrend: "stable",
  },
];

const mockAlertRules: CustomAlertRule[] = [
  {
    id: "rule_1",
    providerId: "dr-chen-1",
    name: "High Blood Pressure Alert",
    description: "Alert when systolic BP exceeds 140 mmHg",
    metricType: "vital_sign",
    metricName: "blood_pressure_systolic",
    operator: "gt",
    thresholdValue: 140,
    severity: "high",
    notificationChannels: ["in_app", "email"],
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    triggeredCount: 12,
  },
  {
    id: "rule_2",
    providerId: "dr-chen-1",
    name: "Low Oxygen Saturation",
    description: "Alert when SpO2 drops below 92%",
    metricType: "vital_sign",
    metricName: "oxygen_saturation",
    operator: "lt",
    thresholdValue: 92,
    severity: "critical",
    notificationChannels: ["in_app", "email", "sms"],
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    triggeredCount: 3,
  },
  {
    id: "rule_3",
    providerId: "dr-chen-1",
    patientId: "patient_1",
    name: "Medication Adherence Warning",
    description: "Alert when adherence falls below 80%",
    metricType: "adherence",
    metricName: "medication_adherence",
    operator: "lt",
    thresholdValue: 80,
    severity: "medium",
    notificationChannels: ["in_app"],
    isActive: true,
    createdAt: "2025-01-05T00:00:00Z",
    updatedAt: "2025-01-05T00:00:00Z",
    triggeredCount: 5,
  },
];

const mockConversations: ProviderConversation[] = [
  {
    id: "conv_1",
    title: "Case Discussion: John Smith - Cardiac Management",
    patientId: "patient_1",
    patientName: "John Smith",
    participants: [
      { id: "dr-chen-1", name: "Dr. Sarah Chen", role: "provider", specialty: "Internal Medicine" },
      { id: "dr-patel-1", name: "Dr. Raj Patel", role: "specialist", specialty: "Cardiology" },
    ],
    lastMessage: "I recommend adding a beta-blocker given the recent BP trends...",
    lastMessageAt: "2025-01-15T14:30:00Z",
    unreadCount: 2,
    isArchived: false,
    createdAt: "2025-01-10T09:00:00Z",
  },
  {
    id: "conv_2",
    title: "Robert Johnson - Medication Review",
    patientId: "patient_3",
    patientName: "Robert Johnson",
    participants: [
      { id: "dr-chen-1", name: "Dr. Sarah Chen", role: "provider", specialty: "Internal Medicine" },
      { id: "pharm-1", name: "Dr. Lisa Wong", role: "specialist", specialty: "Clinical Pharmacy" },
      { id: "cc-1", name: "Jennifer Martinez", role: "care_coordinator" },
    ],
    lastMessage: "We should consider deprescribing the sedative given his fall risk...",
    lastMessageAt: "2025-01-14T16:45:00Z",
    unreadCount: 0,
    isArchived: false,
    createdAt: "2025-01-08T11:00:00Z",
  },
];

const mockEducationPrescriptions: EducationPrescription[] = [
  {
    id: "edu_rx_1",
    providerId: "dr-chen-1",
    providerName: "Dr. Sarah Chen",
    patientId: "patient_1",
    patientName: "John Smith",
    moduleTitle: "Understanding Heart Failure",
    moduleTopic: "Heart failure management and lifestyle modifications",
    reason: "Patient recently diagnosed with CHF, needs education on self-monitoring",
    priority: "important",
    dueDate: "2025-01-25",
    status: "in_progress",
    prescribedAt: "2025-01-10T10:00:00Z",
  },
  {
    id: "edu_rx_2",
    providerId: "dr-chen-1",
    providerName: "Dr. Sarah Chen",
    patientId: "patient_3",
    patientName: "Robert Johnson",
    moduleTitle: "Managing Multiple Medications",
    moduleTopic: "Polypharmacy awareness and medication safety",
    reason: "Patient on 10+ medications, needs education on proper timing and interactions",
    priority: "urgent",
    dueDate: "2025-01-20",
    status: "pending",
    prescribedAt: "2025-01-12T14:00:00Z",
  },
];

export async function getProviderDashboardStats(providerId: string): Promise<ProviderDashboardStats> {
  const patients = mockPatients;
  
  return {
    totalPatients: patients.length,
    criticalAlerts: patients.filter(p => p.riskLevel === "critical").reduce((sum, p) => sum + p.pendingAlerts, 0),
    pendingReviews: patients.reduce((sum, p) => sum + p.pendingAlerts, 0),
    upcomingAppointments: patients.filter(p => p.nextAppointment).length,
    averageAdherenceRate: Math.round(patients.reduce((sum, p) => sum + (p.adherenceRate || 0), 0) / patients.length),
    riskDistribution: {
      low: patients.filter(p => p.riskLevel === "low").length,
      moderate: patients.filter(p => p.riskLevel === "moderate").length,
      high: patients.filter(p => p.riskLevel === "high").length,
      critical: patients.filter(p => p.riskLevel === "critical").length,
    },
  };
}

export async function getPatientPanelList(providerId: string, filters?: {
  riskLevel?: string;
  hasAlerts?: boolean;
  sortBy?: "name" | "risk" | "lastVisit" | "adherence";
}): Promise<PatientSummaryCard[]> {
  let patients = [...mockPatients];
  
  if (filters?.riskLevel) {
    patients = patients.filter(p => p.riskLevel === filters.riskLevel);
  }
  
  if (filters?.hasAlerts) {
    patients = patients.filter(p => p.pendingAlerts > 0);
  }
  
  if (filters?.sortBy) {
    switch (filters.sortBy) {
      case "name":
        patients.sort((a, b) => a.patientName.localeCompare(b.patientName));
        break;
      case "risk":
        const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
        patients.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
        break;
      case "lastVisit":
        patients.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
        break;
      case "adherence":
        patients.sort((a, b) => (a.adherenceRate || 0) - (b.adherenceRate || 0));
        break;
    }
  }
  
  return patients;
}

// Check if cached summary is valid
function getCachedSummary(patientId: string): AIPatientSummary | null {
  const cached = summaryCache.get(patientId);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      ...cached.summary,
      isCached: true,
      cacheExpiresAt: new Date(cached.expiresAt).toISOString(),
    };
  }
  return null;
}

// Store summary in cache
function cacheSummary(patientId: string, summary: AIPatientSummary, patient: PatientSummaryCard): void {
  const ttl = patient.riskLevel === "critical" ? CRITICAL_SUMMARY_TTL_MS : SUMMARY_TTL_MS;
  const now = Date.now();
  summaryCache.set(patientId, {
    summary,
    cachedAt: now,
    expiresAt: now + ttl,
  });
}

// Generate AI clinical summary with enhanced prompts and caching
export async function generateAIPatientSummary(patientId: string, forceRefresh = false): Promise<AIPatientSummary> {
  const patient = mockPatients.find(p => p.patientId === patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }

  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cached = getCachedSummary(patientId);
    if (cached) {
      return cached;
    }
  }

  try {
    const monitoringStatus = await analyzePatientHealth(patientId);
    const snapshot = await generateHealthSnapshot(patientId);

    const clinicalPrompt = `You are a senior clinical AI assistant helping healthcare providers understand patient status quickly and accurately.

Generate a comprehensive, concise clinical summary for the healthcare provider about this patient. Focus on clinically significant findings, trends requiring attention, and actionable recommendations.

PATIENT DATA:
- Name: ${patient.patientName}
- Age: ${patient.age} years old
- Current Risk Level: ${patient.riskLevel}
- Active Conditions: ${patient.activeConditions}
- Active Medications: ${patient.activeMedications}
- Medication Adherence Rate: ${patient.adherenceRate}%
- Recent Health Trend: ${patient.recentTrend}
- Pending Alerts: ${patient.pendingAlerts}

HEALTH MONITORING DATA:
${snapshot.summary}

Key Findings from RPM: ${snapshot.keyFindings.join("; ")}
Areas of Concern: ${snapshot.concernAreas.join("; ")}

Active Monitoring Alerts: ${monitoringStatus.activeAlerts.length} alerts
Overall Monitoring Risk Level: ${monitoringStatus.overallRisk}

Generate a JSON response with the following structure. Be specific, clinically accurate, and actionable:
{
  "overviewSummary": "2-3 sentence clinical overview highlighting the most important aspects of the patient's current status",
  "clinicalSynopsis": "A concise 1-paragraph clinical synopsis suitable for chart documentation or handoff",
  "healthTrends": [
    {
      "category": "cardiovascular|metabolic|respiratory|renal|neurological|mental_health|musculoskeletal|general",
      "trend": "improving|stable|declining",
      "description": "Specific description of the trend",
      "clinicalSignificance": "low|moderate|high"
    }
  ],
  "riskFactors": [
    {
      "factor": "Name of risk factor",
      "severity": "low|moderate|high|critical",
      "explanation": "Brief clinical explanation"
    }
  ],
  "rpmAlertSummary": "Summary of remote patient monitoring alerts and trends with clinical context",
  "keyFindings": ["Most important finding 1", "Key finding 2", "Key finding 3"],
  "recommendedActions": ["Specific action 1", "Specific action 2"],
  "medicationConcerns": ["Any medication-related concerns or interactions"],
  "followUpRecommendations": ["Recommended follow-up items with timeframes"],
  "priorityLevel": "routine|attention|urgent|critical",
  "confidenceScore": 0.0-1.0
}`;

    const content = await generatePhiSafeText({
      system: "You are an expert clinical AI assistant trained in evidence-based medicine. Generate precise, actionable clinical summaries. Respond only with valid JSON. Focus on patient safety and clinical decision support.",
      user: clinicalPrompt,
      temperature: 0.2,
    }) || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const summary: AIPatientSummary = {
      patientId,
      patientName: patient.patientName,
      generatedAt: new Date().toISOString(),
      overviewSummary: parsed.overviewSummary || "Unable to generate summary",
      clinicalSynopsis: parsed.clinicalSynopsis || "",
      healthTrends: (parsed.healthTrends || []).map((t: any) => ({
        category: t.category || "general",
        trend: t.trend || "stable",
        description: t.description || "",
        clinicalSignificance: t.clinicalSignificance || "low",
      })),
      riskFactors: parsed.riskFactors || [],
      rpmAlertSummary: parsed.rpmAlertSummary || "No RPM data available",
      keyFindings: parsed.keyFindings || [],
      recommendedActions: parsed.recommendedActions || [],
      medicationConcerns: parsed.medicationConcerns || [],
      followUpRecommendations: parsed.followUpRecommendations || [],
      priorityLevel: parsed.priorityLevel || "routine",
      confidenceScore: parsed.confidenceScore || 0.85,
      isCached: false,
    };

    // Cache the summary
    cacheSummary(patientId, summary, patient);

    return summary;
  } catch (error) {
    console.error("Error generating AI patient summary:", error);
    // Return fallback summary without caching
    return {
      patientId,
      patientName: patient.patientName,
      generatedAt: new Date().toISOString(),
      overviewSummary: `${patient.patientName} is a ${patient.age}-year-old patient with ${patient.activeConditions} active conditions and ${patient.riskLevel} risk level. Current medication adherence is at ${patient.adherenceRate}%.`,
      clinicalSynopsis: `Patient presents with ${patient.activeConditions} active conditions, currently on ${patient.activeMedications} medications. Recent trend is ${patient.recentTrend} with ${patient.adherenceRate}% medication adherence. Risk level assessed as ${patient.riskLevel}.`,
      healthTrends: [
        { category: "general", trend: patient.recentTrend, description: `Overall patient status is ${patient.recentTrend}`, clinicalSignificance: patient.riskLevel === "critical" || patient.riskLevel === "high" ? "high" : "moderate" }
      ],
      riskFactors: patient.riskLevel === "critical" || patient.riskLevel === "high" 
        ? [{ factor: "Elevated risk level", severity: patient.riskLevel, explanation: `Patient classified as ${patient.riskLevel} risk` }]
        : [],
      rpmAlertSummary: `${patient.pendingAlerts} pending alerts requiring clinical review`,
      keyFindings: [`${patient.activeConditions} active conditions`, `${patient.activeMedications} active medications`, `${patient.adherenceRate}% medication adherence`],
      recommendedActions: ["Review pending alerts", "Assess medication regimen", "Schedule follow-up as appropriate"],
      medicationConcerns: patient.adherenceRate && patient.adherenceRate < 80 ? ["Suboptimal medication adherence - consider patient counseling"] : [],
      followUpRecommendations: ["Review within standard care interval"],
      priorityLevel: patient.riskLevel === "critical" ? "critical" : patient.riskLevel === "high" ? "urgent" : "routine",
      confidenceScore: 0.6,
      isCached: false,
    };
  }
}

// Get cached summary if available, otherwise return null
export async function getPatientSummaryIfCached(patientId: string): Promise<AIPatientSummary | null> {
  return getCachedSummary(patientId);
}

// Generate summaries for multiple patients (batch operation)
export async function generateBatchPatientSummaries(
  patientIds: string[],
  options?: { prioritizeHighRisk?: boolean; maxConcurrent?: number }
): Promise<BatchSummaryResult[]> {
  const { prioritizeHighRisk = true, maxConcurrent = 3 } = options || {};
  
  // Sort patients by risk if prioritizing
  let orderedIds = [...patientIds];
  if (prioritizeHighRisk) {
    const riskOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
    orderedIds = orderedIds.sort((a, b) => {
      const patientA = mockPatients.find(p => p.patientId === a);
      const patientB = mockPatients.find(p => p.patientId === b);
      return (riskOrder[patientA?.riskLevel || "low"] || 3) - (riskOrder[patientB?.riskLevel || "low"] || 3);
    });
  }

  const results: BatchSummaryResult[] = [];
  
  // Process in batches
  for (let i = 0; i < orderedIds.length; i += maxConcurrent) {
    const batch = orderedIds.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (patientId) => {
      const patient = mockPatients.find(p => p.patientId === patientId);
      try {
        const summary = await generateAIPatientSummary(patientId);
        return {
          patientId,
          patientName: patient?.patientName || "Unknown",
          summary,
          status: "success" as const,
        };
      } catch (error) {
        return {
          patientId,
          patientName: patient?.patientName || "Unknown",
          summary: null,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// Auto-generate summaries for all high-risk patients
export async function autoGenerateHighRiskSummaries(): Promise<BatchSummaryResult[]> {
  const highRiskPatients = mockPatients
    .filter(p => p.riskLevel === "critical" || p.riskLevel === "high")
    .map(p => p.patientId);
  
  return generateBatchPatientSummaries(highRiskPatients, {
    prioritizeHighRisk: true,
    maxConcurrent: 2,
  });
}

// Get summary status for provider dashboard
export async function getSummaryGenerationStatus(providerId: string): Promise<{
  totalPatients: number;
  cachedSummaries: number;
  staleSummaries: number;
  highRiskWithoutSummary: number;
}> {
  const patients = mockPatients;
  let cachedCount = 0;
  let staleCount = 0;
  let highRiskWithoutSummary = 0;
  
  for (const patient of patients) {
    const cached = summaryCache.get(patient.patientId);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        cachedCount++;
      } else {
        staleCount++;
      }
    } else if (patient.riskLevel === "critical" || patient.riskLevel === "high") {
      highRiskWithoutSummary++;
    }
  }
  
  return {
    totalPatients: patients.length,
    cachedSummaries: cachedCount,
    staleSummaries: staleCount,
    highRiskWithoutSummary,
  };
}

export async function getCustomAlertRules(providerId: string): Promise<CustomAlertRule[]> {
  return mockAlertRules.filter(r => r.providerId === providerId);
}

export async function createCustomAlertRule(providerId: string, rule: Omit<CustomAlertRule, "id" | "providerId" | "createdAt" | "updatedAt" | "triggeredCount">): Promise<CustomAlertRule> {
  const newRule: CustomAlertRule = {
    ...rule,
    id: `rule_${Date.now()}`,
    providerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggeredCount: 0,
  };
  
  mockAlertRules.push(newRule);
  return newRule;
}

export async function updateCustomAlertRule(providerId: string, ruleId: string, updates: Partial<CustomAlertRule>): Promise<CustomAlertRule> {
  const ruleIndex = mockAlertRules.findIndex(r => r.id === ruleId && r.providerId === providerId);
  if (ruleIndex === -1) {
    throw new Error("Alert rule not found");
  }
  
  mockAlertRules[ruleIndex] = {
    ...mockAlertRules[ruleIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  return mockAlertRules[ruleIndex];
}

export async function deleteCustomAlertRule(providerId: string, ruleId: string): Promise<void> {
  const ruleIndex = mockAlertRules.findIndex(r => r.id === ruleId && r.providerId === providerId);
  if (ruleIndex === -1) {
    throw new Error("Alert rule not found");
  }
  
  mockAlertRules.splice(ruleIndex, 1);
}

export async function getProviderConversations(providerId: string): Promise<ProviderConversation[]> {
  return mockConversations.filter(c => c.participants.some(p => p.id === providerId));
}

export async function getConversationMessages(conversationId: string): Promise<ProviderMessage[]> {
  const mockMessages: ProviderMessage[] = [
    {
      id: "msg_1",
      conversationId: "conv_1",
      senderId: "dr-chen-1",
      senderName: "Dr. Sarah Chen",
      senderRole: "provider",
      content: "I wanted to discuss John Smith's recent BP readings. He's been consistently elevated despite current therapy.",
      patientId: "patient_1",
      patientName: "John Smith",
      isEncrypted: true,
      readBy: ["dr-chen-1", "dr-patel-1"],
      createdAt: "2025-01-10T09:00:00Z",
    },
    {
      id: "msg_2",
      conversationId: "conv_1",
      senderId: "dr-patel-1",
      senderName: "Dr. Raj Patel",
      senderRole: "specialist",
      content: "Looking at his chart, his morning readings are particularly elevated. Have we considered adding a beta-blocker?",
      patientId: "patient_1",
      patientName: "John Smith",
      isEncrypted: true,
      readBy: ["dr-patel-1"],
      createdAt: "2025-01-10T10:30:00Z",
    },
    {
      id: "msg_3",
      conversationId: "conv_1",
      senderId: "dr-chen-1",
      senderName: "Dr. Sarah Chen",
      senderRole: "provider",
      content: "Good point. He's already on lisinopril and amlodipine. What would you recommend?",
      patientId: "patient_1",
      patientName: "John Smith",
      isEncrypted: true,
      readBy: ["dr-chen-1"],
      createdAt: "2025-01-15T11:00:00Z",
    },
    {
      id: "msg_4",
      conversationId: "conv_1",
      senderId: "dr-patel-1",
      senderName: "Dr. Raj Patel",
      senderRole: "specialist",
      content: "I recommend adding a beta-blocker given the recent BP trends. Metoprolol 25mg daily would be a good starting point. Also, let's order an echo to check for any structural changes.",
      patientId: "patient_1",
      patientName: "John Smith",
      attachments: [
        { type: "document", name: "Beta-blocker Selection Guide", id: "doc_1" }
      ],
      isEncrypted: true,
      readBy: [],
      createdAt: "2025-01-15T14:30:00Z",
    },
  ];
  
  return mockMessages.filter(m => m.conversationId === conversationId);
}

export async function sendProviderMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderRole: "provider" | "specialist" | "care_coordinator",
  content: string,
  patientId?: string,
  patientName?: string,
  attachments?: ProviderMessage["attachments"]
): Promise<ProviderMessage> {
  const newMessage: ProviderMessage = {
    id: `msg_${Date.now()}`,
    conversationId,
    senderId,
    senderName,
    senderRole,
    content,
    patientId,
    patientName,
    attachments,
    isEncrypted: true,
    readBy: [senderId],
    createdAt: new Date().toISOString(),
  };
  
  return newMessage;
}

export async function createConversation(
  title: string,
  creatorId: string,
  creatorName: string,
  creatorRole: string,
  participants: ProviderConversation["participants"],
  patientId?: string,
  patientName?: string
): Promise<ProviderConversation> {
  const newConversation: ProviderConversation = {
    id: `conv_${Date.now()}`,
    title,
    patientId,
    patientName,
    participants: [
      { id: creatorId, name: creatorName, role: creatorRole },
      ...participants.filter(p => p.id !== creatorId),
    ],
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
  };
  
  mockConversations.push(newConversation);
  return newConversation;
}

export async function getEducationPrescriptions(providerId: string): Promise<EducationPrescription[]> {
  return mockEducationPrescriptions.filter(p => p.providerId === providerId);
}

export async function prescribeEducationModule(
  providerId: string,
  providerName: string,
  patientId: string,
  patientName: string,
  moduleTitle: string,
  moduleTopic: string,
  reason: string,
  priority: "routine" | "important" | "urgent",
  dueDate?: string
): Promise<EducationPrescription> {
  const prescription: EducationPrescription = {
    id: `edu_rx_${Date.now()}`,
    providerId,
    providerName,
    patientId,
    patientName,
    moduleTitle,
    moduleTopic,
    reason,
    priority,
    dueDate,
    status: "pending",
    prescribedAt: new Date().toISOString(),
  };
  
  mockEducationPrescriptions.push(prescription);
  return prescription;
}

export async function updateEducationPrescription(
  prescriptionId: string,
  updates: Partial<EducationPrescription>
): Promise<EducationPrescription> {
  const index = mockEducationPrescriptions.findIndex(p => p.id === prescriptionId);
  if (index === -1) {
    throw new Error("Prescription not found");
  }
  
  mockEducationPrescriptions[index] = {
    ...mockEducationPrescriptions[index],
    ...updates,
  };
  
  return mockEducationPrescriptions[index];
}
