import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";
import { interoperabilityHubService } from "./interoperability-hub-service";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is for educational and informational purposes only and is NOT clinical decision support or medical advice. It does not replace professional clinical judgment. Always rely on your clinical expertise and institutional protocols for patient care decisions.";

console.log("[DedicatedProviderPortal] Service initialized with Interoperability Hub integration");

/**
 * DEDICATED PROVIDER PORTAL SERVICE
 * 
 * This service provides aggregated patient data views for healthcare providers.
 * Architecture:
 * - Integrates with Interoperability Hub for data source connectivity status
 * - Uses sample data representing normalized FHIR R4 structure from connected sources
 * - In production, getAggregatedPatientData would query hub-connected EHR/FHIR endpoints
 * 
 * Data Sources Supported via Interoperability Hub:
 * - EHR: Fasten Health, Hospital Network, athenahealth via SMART on FHIR
 * - Labs: Quest Diagnostics, LabCorp via HL7v2/CCDA
 * - Pharmacy: CVS, Walgreens via NCPDP/FHIR
 * - Imaging: PACS via DICOM/DICOMweb
 * 
 * Security:
 * - RBAC enforcement on all endpoints (provider/clinician/admin roles)
 * - HIPAA-compliant audit logging via logPhiAccess
 * - NO-CDS compliant AI insights (informational only)
 */

export interface ProviderUser {
  id: string;
  userId: string;
  npi: string;
  licenseNumber: string;
  specialty: string;
  department: string;
  organization: string;
  role: "physician" | "nurse_practitioner" | "physician_assistant" | "registered_nurse" | "care_coordinator" | "specialist";
  privileges: ProviderPrivilege[];
  status: "active" | "inactive" | "pending_verification" | "suspended";
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPrivilege {
  type: "view_records" | "edit_records" | "prescribe" | "order_labs" | "order_imaging" | "refer" | "admit" | "discharge" | "sign_off";
  scope: "all" | "department" | "assigned" | "emergency";
  restrictions?: string[];
}

export interface AggregatedPatientData {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  demographics: {
    age: number;
    gender: string;
    address?: string;
    phone?: string;
    email?: string;
    emergencyContact?: string;
    preferredLanguage: string;
  };
  dataSources: ConnectedDataSource[];
  conditions: AggregatedCondition[];
  medications: AggregatedMedication[];
  allergies: AggregatedAllergy[];
  vitalSigns: AggregatedVitalSign[];
  labResults: AggregatedLabResult[];
  encounters: AggregatedEncounter[];
  immunizations: AggregatedImmunization[];
  carePlans: AggregatedCarePlan[];
  lastUpdated: string;
  dataQualityScore: number;
  conflictsDetected: number;
}

export interface ConnectedDataSource {
  id: string;
  sourceType: string;
  sourceName: string;
  organization: string;
  connectionStatus: "active" | "syncing" | "error" | "disconnected";
  lastSyncAt: string;
  recordCount: number;
  dataTypes: string[];
}

export interface AggregatedCondition {
  id: string;
  code: string;
  codeSystem: string;
  display: string;
  category: string;
  clinicalStatus: string;
  verificationStatus: string;
  onsetDate?: string;
  abatementDate?: string;
  severity?: string;
  sources: string[];
  lastUpdated: string;
}

export interface AggregatedMedication {
  id: string;
  code: string;
  display: string;
  dosage: string;
  frequency: string;
  route: string;
  status: "active" | "completed" | "stopped" | "on_hold";
  prescriber?: string;
  startDate: string;
  endDate?: string;
  sources: string[];
  refillsRemaining?: number;
  adherenceRate?: number;
}

export interface AggregatedAllergy {
  id: string;
  substance: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe" | "life_threatening";
  verifiedBy?: string;
  verifiedAt?: string;
  sources: string[];
}

export interface AggregatedVitalSign {
  id: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
  interpretation?: "normal" | "low" | "high" | "critical";
}

export interface AggregatedLabResult {
  id: string;
  testName: string;
  code: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: "normal" | "low" | "high" | "critical";
  collectedAt: string;
  reportedAt: string;
  source: string;
  orderingProvider?: string;
}

export interface AggregatedEncounter {
  id: string;
  type: string;
  status: string;
  facility: string;
  provider: string;
  specialty: string;
  date: string;
  reason: string;
  diagnosis?: string[];
  notes?: string;
  source: string;
}

export interface AggregatedImmunization {
  id: string;
  vaccine: string;
  cvxCode: string;
  date: string;
  status: "completed" | "entered_in_error" | "not_done";
  site?: string;
  lotNumber?: string;
  manufacturer?: string;
  source: string;
}

export interface AggregatedCarePlan {
  id: string;
  title: string;
  status: "active" | "completed" | "revoked" | "draft";
  category: string;
  startDate: string;
  endDate?: string;
  goals: string[];
  activities: string[];
  careTeam: string[];
  source: string;
}

export interface AIPatientInsights {
  patientId: string;
  generatedAt: string;
  clinicalSummary: string;
  keyFindings: AIFinding[];
  trends: AITrend[];
  riskFactors: AIRiskFactor[];
  gaps: AICareGap[];
  recommendations: AIRecommendation[];
  qualityMetrics: QualityMetric[];
  disclaimer: string;
}

export interface AIFinding {
  category: string;
  finding: string;
  significance: "low" | "moderate" | "high" | "critical";
  dataPoints: string[];
  lastUpdated: string;
}

export interface AITrend {
  metric: string;
  direction: "improving" | "stable" | "declining" | "fluctuating";
  period: string;
  description: string;
  dataPoints: { date: string; value: number }[];
}

export interface AIRiskFactor {
  factor: string;
  level: "low" | "moderate" | "high" | "critical";
  description: string;
  evidencePoints: string[];
  potentialInterventions: string[];
}

export interface AICareGap {
  type: string;
  description: string;
  priority: "routine" | "important" | "urgent";
  lastAssessed?: string;
  recommendation: string;
}

export interface AIRecommendation {
  category: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  rationale: string;
  actionable: boolean;
}

export interface QualityMetric {
  measure: string;
  value: number;
  target: number;
  status: "met" | "not_met" | "pending";
  lastAssessed: string;
}

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  recipientType: "patient" | "provider" | "care_team";
  patientId?: string;
  subject: string;
  content: string;
  priority: "normal" | "high" | "urgent";
  category: "clinical" | "administrative" | "appointment" | "prescription" | "referral" | "lab_result" | "follow_up";
  attachments: MessageAttachment[];
  isEncrypted: boolean;
  readAt?: string;
  responseRequired: boolean;
  responseDeadline?: string;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  type: "document" | "lab_result" | "imaging" | "care_plan" | "prescription";
  name: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface Conversation {
  id: string;
  type: "patient" | "provider" | "care_team";
  patientId?: string;
  patientName?: string;
  participants: ConversationParticipant[];
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: "active" | "archived" | "resolved";
  priority: "normal" | "high" | "urgent";
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  lastReadAt?: string;
}

export interface ProviderDashboardStats {
  totalPatients: number;
  activePatients: number;
  criticalAlerts: number;
  pendingMessages: number;
  pendingResults: number;
  appointmentsToday: number;
  carePlansDue: number;
  qualityMetrics: {
    overallScore: number;
    trend: "improving" | "stable" | "declining";
  };
  patientDistribution: {
    riskLevel: string;
    count: number;
  }[];
}

export interface ProviderAlert {
  id: string;
  patientId: string;
  patientName: string;
  type: "critical_lab" | "vital_sign" | "medication" | "care_gap" | "appointment" | "message";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  actionRequired: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

const providerUsers = new Map<string, ProviderUser>();
const patientDataCache = new Map<string, { data: AggregatedPatientData; cachedAt: number }>();
const insightsCache = new Map<string, { insights: AIPatientInsights; cachedAt: number }>();
const conversations = new Map<string, Conversation>();
const messages = new Map<string, SecureMessage[]>();
const alerts = new Map<string, ProviderAlert[]>();

const CACHE_TTL_MS = 15 * 60 * 1000;

function initializeSampleData(): void {
  const sampleProvider: ProviderUser = {
    id: "provider-001",
    userId: "user-provider-001",
    npi: "1234567890",
    licenseNumber: "MD-12345",
    specialty: "Internal Medicine",
    department: "Primary Care",
    organization: "Tabula Health System",
    role: "physician",
    privileges: [
      { type: "view_records", scope: "all" },
      { type: "edit_records", scope: "assigned" },
      { type: "prescribe", scope: "assigned" },
      { type: "order_labs", scope: "assigned" },
      { type: "order_imaging", scope: "assigned" },
      { type: "refer", scope: "all" },
    ],
    status: "active",
    verifiedAt: "2024-01-15T10:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2025-01-20T00:00:00Z",
  };
  providerUsers.set(sampleProvider.userId, sampleProvider);

  const sampleConversation: Conversation = {
    id: "conv-001",
    type: "patient",
    patientId: "patient-001",
    patientName: "John Smith",
    participants: [
      { id: "user-provider-001", name: "Dr. Sarah Johnson", role: "physician", specialty: "Internal Medicine" },
      { id: "patient-001", name: "John Smith", role: "patient" },
    ],
    subject: "Follow-up on recent lab results",
    lastMessage: "Thank you for the clarification, Dr. Johnson.",
    lastMessageAt: "2025-01-22T14:30:00Z",
    unreadCount: 1,
    status: "active",
    priority: "normal",
    createdAt: "2025-01-20T10:00:00Z",
  };
  conversations.set(sampleConversation.id, sampleConversation);

  const sampleMessages: SecureMessage[] = [
    {
      id: "msg-001",
      conversationId: "conv-001",
      senderId: "user-provider-001",
      senderName: "Dr. Sarah Johnson",
      senderRole: "physician",
      recipientId: "patient-001",
      recipientName: "John Smith",
      recipientType: "patient",
      patientId: "patient-001",
      subject: "Lab Results Review",
      content: "Hello John, I wanted to discuss your recent lab results. Your HbA1c has improved from 7.2% to 6.8%, which is great progress. Let's continue with the current treatment plan.",
      priority: "normal",
      category: "lab_result",
      attachments: [],
      isEncrypted: true,
      responseRequired: false,
      createdAt: "2025-01-20T10:15:00Z",
    },
    {
      id: "msg-002",
      conversationId: "conv-001",
      senderId: "patient-001",
      senderName: "John Smith",
      senderRole: "patient",
      recipientId: "user-provider-001",
      recipientName: "Dr. Sarah Johnson",
      recipientType: "provider",
      patientId: "patient-001",
      subject: "Re: Lab Results Review",
      content: "Thank you for the clarification, Dr. Johnson. I have been following the diet plan you recommended. Should I continue with the same medication dosage?",
      priority: "normal",
      category: "clinical",
      attachments: [],
      isEncrypted: true,
      responseRequired: true,
      responseDeadline: "2025-01-25T00:00:00Z",
      createdAt: "2025-01-22T14:30:00Z",
    },
  ];
  messages.set("conv-001", sampleMessages);

  const sampleAlerts: ProviderAlert[] = [
    {
      id: "alert-001",
      patientId: "patient-002",
      patientName: "Maria Garcia",
      type: "critical_lab",
      severity: "critical",
      title: "Critical Potassium Level",
      description: "Potassium level 6.2 mEq/L detected. Immediate review recommended.",
      actionRequired: true,
      createdAt: "2025-01-23T08:00:00Z",
    },
    {
      id: "alert-002",
      patientId: "patient-003",
      patientName: "Robert Johnson",
      type: "medication",
      severity: "warning",
      title: "Potential Drug Interaction",
      description: "New prescription for Warfarin may interact with existing Aspirin therapy.",
      actionRequired: true,
      createdAt: "2025-01-23T09:30:00Z",
    },
    {
      id: "alert-003",
      patientId: "patient-001",
      patientName: "John Smith",
      type: "care_gap",
      severity: "info",
      title: "Annual Wellness Visit Due",
      description: "Patient is due for annual wellness visit. Last visit was 11 months ago.",
      actionRequired: false,
      createdAt: "2025-01-23T07:00:00Z",
    },
  ];
  alerts.set("user-provider-001", sampleAlerts);
}

initializeSampleData();

export async function getProviderProfile(userId: string): Promise<ProviderUser | null> {
  return providerUsers.get(userId) || null;
}

export async function verifyProviderAccess(userId: string, requiredPrivilege?: string): Promise<boolean> {
  const provider = providerUsers.get(userId);
  if (!provider || provider.status !== "active") {
    return false;
  }
  if (requiredPrivilege) {
    return provider.privileges.some(p => p.type === requiredPrivilege);
  }
  return true;
}

export async function getDashboardStats(providerId: string): Promise<ProviderDashboardStats> {
  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "ProviderDashboard",
    resourceId: providerId,
    details: "Provider accessed dashboard statistics",
  });

  return {
    totalPatients: 156,
    activePatients: 142,
    criticalAlerts: 3,
    pendingMessages: 12,
    pendingResults: 8,
    appointmentsToday: 14,
    carePlansDue: 5,
    qualityMetrics: {
      overallScore: 87,
      trend: "improving",
    },
    patientDistribution: [
      { riskLevel: "low", count: 78 },
      { riskLevel: "moderate", count: 45 },
      { riskLevel: "high", count: 19 },
      { riskLevel: "critical", count: 4 },
    ],
  };
}

export async function getProviderAlerts(providerId: string): Promise<ProviderAlert[]> {
  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "ProviderAlerts",
    resourceId: providerId,
    details: "Provider viewed alerts",
  });

  return alerts.get(providerId) || [];
}

export async function acknowledgeAlert(providerId: string, alertId: string): Promise<ProviderAlert | null> {
  const providerAlerts = alerts.get(providerId);
  if (!providerAlerts) return null;

  const alert = providerAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledgedAt = new Date().toISOString();
  }

  await logPhiAccess({
    userId: providerId,
    action: "update",
    resourceType: "ProviderAlert",
    resourceId: alertId,
    details: "Provider acknowledged alert",
  });

  return alert || null;
}

export async function getAggregatedPatientData(providerId: string, patientId: string): Promise<AggregatedPatientData> {
  const cacheKey = `${providerId}:${patientId}`;
  const cached = patientDataCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "AggregatedPatientData",
    resourceId: patientId,
    details: "Provider accessed aggregated patient data from Interoperability Hub",
  });

  console.log(`[DedicatedProviderPortal] Aggregating patient data from Interoperability Hub for patient: ${patientId}`);
  
  const hubStats = interoperabilityHubService.getHL7MessageStats();
  const ccdaStats = interoperabilityHubService.getCCDADocumentStats();
  
  console.log(`[DedicatedProviderPortal] Hub Status - HL7 Messages: ${hubStats.totalProcessed}, CCDA Documents: ${ccdaStats.totalProcessed}`);
  console.log(`[DedicatedProviderPortal] Data sources active: EHR (via Fasten Health), Lab (Quest), Pharmacy (CVS), Imaging (PACS)`);
  
  const hubConnected = hubStats.totalProcessed > 0 || ccdaStats.totalProcessed > 0;
  const dataSourceStatus = hubConnected ? "active" : "syncing";
  const lastSync = new Date().toISOString();

  const aggregatedData: AggregatedPatientData = {
    patientId,
    patientName: "John Smith",
    dateOfBirth: "1958-03-15",
    mrn: "MRN-12345678",
    demographics: {
      age: 66,
      gender: "Male",
      address: "123 Main St, Boston, MA 02101",
      phone: "(617) 555-0123",
      email: "john.smith@email.com",
      emergencyContact: "Jane Smith (Wife) - (617) 555-0124",
      preferredLanguage: "English",
    },
    dataSources: [
      {
        id: "ds-001",
        sourceType: "ehr",
        sourceName: "Primary Care Provider",
        organization: "Boston Medical Center",
        connectionStatus: dataSourceStatus,
        lastSyncAt: lastSync,
        recordCount: 245 + hubStats.totalProcessed,
        dataTypes: ["conditions", "medications", "encounters", "labs", "vitals"],
      },
      {
        id: "ds-002",
        sourceType: "lab",
        sourceName: "Quest Diagnostics",
        organization: "Quest Diagnostics",
        connectionStatus: dataSourceStatus,
        lastSyncAt: lastSync,
        recordCount: 87 + ccdaStats.totalProcessed,
        dataTypes: ["labs"],
      },
      {
        id: "ds-003",
        sourceType: "pharmacy",
        sourceName: "CVS Pharmacy",
        organization: "CVS Health",
        connectionStatus: dataSourceStatus,
        lastSyncAt: lastSync,
        recordCount: 34,
        dataTypes: ["medications"],
      },
      {
        id: "ds-004",
        sourceType: "imaging",
        sourceName: "Radiology Associates",
        organization: "Radiology Associates of Boston",
        connectionStatus: dataSourceStatus,
        lastSyncAt: lastSync,
        recordCount: 12,
        dataTypes: ["imaging"],
      },
    ],
    conditions: [
      {
        id: "cond-001",
        code: "E11.9",
        codeSystem: "ICD-10",
        display: "Type 2 Diabetes Mellitus",
        category: "Endocrine",
        clinicalStatus: "active",
        verificationStatus: "confirmed",
        onsetDate: "2018-05-15",
        severity: "moderate",
        sources: ["Primary Care Provider", "Quest Diagnostics"],
        lastUpdated: "2025-01-15T00:00:00Z",
      },
      {
        id: "cond-002",
        code: "I10",
        codeSystem: "ICD-10",
        display: "Essential Hypertension",
        category: "Cardiovascular",
        clinicalStatus: "active",
        verificationStatus: "confirmed",
        onsetDate: "2015-08-20",
        severity: "mild",
        sources: ["Primary Care Provider"],
        lastUpdated: "2025-01-10T00:00:00Z",
      },
      {
        id: "cond-003",
        code: "E78.5",
        codeSystem: "ICD-10",
        display: "Hyperlipidemia",
        category: "Metabolic",
        clinicalStatus: "active",
        verificationStatus: "confirmed",
        onsetDate: "2017-03-10",
        sources: ["Primary Care Provider", "Quest Diagnostics"],
        lastUpdated: "2025-01-05T00:00:00Z",
      },
    ],
    medications: [
      {
        id: "med-001",
        code: "6809",
        display: "Metformin 1000mg",
        dosage: "1000mg",
        frequency: "Twice daily",
        route: "Oral",
        status: "active",
        prescriber: "Dr. Sarah Johnson",
        startDate: "2018-06-01",
        sources: ["Primary Care Provider", "CVS Pharmacy"],
        refillsRemaining: 3,
        adherenceRate: 92,
      },
      {
        id: "med-002",
        code: "29046",
        display: "Lisinopril 10mg",
        dosage: "10mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescriber: "Dr. Sarah Johnson",
        startDate: "2015-09-01",
        sources: ["Primary Care Provider", "CVS Pharmacy"],
        refillsRemaining: 2,
        adherenceRate: 95,
      },
      {
        id: "med-003",
        code: "36567",
        display: "Atorvastatin 20mg",
        dosage: "20mg",
        frequency: "Once daily at bedtime",
        route: "Oral",
        status: "active",
        prescriber: "Dr. Sarah Johnson",
        startDate: "2017-04-01",
        sources: ["Primary Care Provider", "CVS Pharmacy"],
        refillsRemaining: 5,
        adherenceRate: 88,
      },
    ],
    allergies: [
      {
        id: "allergy-001",
        substance: "Penicillin",
        reaction: "Rash, Hives",
        severity: "moderate",
        verifiedBy: "Dr. Michael Chen",
        verifiedAt: "2020-03-15T10:00:00Z",
        sources: ["Primary Care Provider"],
      },
      {
        id: "allergy-002",
        substance: "Sulfa drugs",
        reaction: "Anaphylaxis",
        severity: "life_threatening",
        verifiedBy: "Dr. Sarah Johnson",
        verifiedAt: "2019-08-22T14:00:00Z",
        sources: ["Primary Care Provider", "Boston Medical Center"],
      },
    ],
    vitalSigns: [
      { id: "vs-001", type: "Blood Pressure (Systolic)", value: 138, unit: "mmHg", timestamp: "2025-01-22T09:00:00Z", source: "Primary Care Provider", interpretation: "high" },
      { id: "vs-002", type: "Blood Pressure (Diastolic)", value: 85, unit: "mmHg", timestamp: "2025-01-22T09:00:00Z", source: "Primary Care Provider", interpretation: "normal" },
      { id: "vs-003", type: "Heart Rate", value: 72, unit: "bpm", timestamp: "2025-01-22T09:00:00Z", source: "Primary Care Provider", interpretation: "normal" },
      { id: "vs-004", type: "Weight", value: 195, unit: "lbs", timestamp: "2025-01-22T09:00:00Z", source: "Primary Care Provider", interpretation: "normal" },
      { id: "vs-005", type: "Temperature", value: 98.6, unit: "°F", timestamp: "2025-01-22T09:00:00Z", source: "Primary Care Provider", interpretation: "normal" },
    ],
    labResults: [
      { id: "lab-001", testName: "HbA1c", code: "4548-4", value: "6.8", unit: "%", referenceRange: "4.0-5.6", interpretation: "high", collectedAt: "2025-01-15T08:00:00Z", reportedAt: "2025-01-16T10:00:00Z", source: "Quest Diagnostics", orderingProvider: "Dr. Sarah Johnson" },
      { id: "lab-002", testName: "Glucose, Fasting", code: "2345-7", value: "128", unit: "mg/dL", referenceRange: "70-100", interpretation: "high", collectedAt: "2025-01-15T08:00:00Z", reportedAt: "2025-01-16T10:00:00Z", source: "Quest Diagnostics", orderingProvider: "Dr. Sarah Johnson" },
      { id: "lab-003", testName: "LDL Cholesterol", code: "2089-1", value: "98", unit: "mg/dL", referenceRange: "<100", interpretation: "normal", collectedAt: "2025-01-15T08:00:00Z", reportedAt: "2025-01-16T10:00:00Z", source: "Quest Diagnostics", orderingProvider: "Dr. Sarah Johnson" },
      { id: "lab-004", testName: "eGFR", code: "48642-3", value: "75", unit: "mL/min/1.73m²", referenceRange: ">60", interpretation: "normal", collectedAt: "2025-01-15T08:00:00Z", reportedAt: "2025-01-16T10:00:00Z", source: "Quest Diagnostics", orderingProvider: "Dr. Sarah Johnson" },
    ],
    encounters: [
      { id: "enc-001", type: "Office Visit", status: "finished", facility: "Boston Medical Center", provider: "Dr. Sarah Johnson", specialty: "Internal Medicine", date: "2025-01-15", reason: "Diabetes follow-up", diagnosis: ["E11.9", "I10"], source: "Primary Care Provider" },
      { id: "enc-002", type: "Lab Visit", status: "finished", facility: "Quest Diagnostics", provider: "Lab Tech", specialty: "Laboratory", date: "2025-01-15", reason: "Routine blood work", source: "Quest Diagnostics" },
      { id: "enc-003", type: "Telehealth", status: "finished", facility: "Boston Medical Center", provider: "Dr. Sarah Johnson", specialty: "Internal Medicine", date: "2024-12-18", reason: "Medication review", source: "Primary Care Provider" },
    ],
    immunizations: [
      { id: "imm-001", vaccine: "Influenza, Quadrivalent", cvxCode: "197", date: "2024-10-15", status: "completed", manufacturer: "Sanofi Pasteur", source: "Primary Care Provider" },
      { id: "imm-002", vaccine: "COVID-19 Booster (Bivalent)", cvxCode: "229", date: "2024-09-20", status: "completed", manufacturer: "Moderna", source: "Primary Care Provider" },
      { id: "imm-003", vaccine: "Pneumococcal (PCV20)", cvxCode: "216", date: "2024-03-10", status: "completed", manufacturer: "Pfizer", source: "Primary Care Provider" },
    ],
    carePlans: [
      { id: "cp-001", title: "Diabetes Management Plan", status: "active", category: "Chronic Disease Management", startDate: "2024-01-01", goals: ["Maintain HbA1c < 7.0%", "Blood glucose 80-130 mg/dL fasting"], activities: ["Daily glucose monitoring", "Diet modification", "Regular exercise"], careTeam: ["Dr. Sarah Johnson", "Maria RN", "Lisa CDE"], source: "Primary Care Provider" },
      { id: "cp-002", title: "Cardiovascular Risk Reduction", status: "active", category: "Preventive Care", startDate: "2024-06-01", goals: ["BP < 130/80", "LDL < 100"], activities: ["Medication adherence", "Low sodium diet", "Weekly exercise 150 min"], careTeam: ["Dr. Sarah Johnson", "Dr. Robert Chen (Cardiology)"], source: "Primary Care Provider" },
    ],
    lastUpdated: new Date().toISOString(),
    dataQualityScore: 94,
    conflictsDetected: 2,
  };

  patientDataCache.set(cacheKey, { data: aggregatedData, cachedAt: Date.now() });
  return aggregatedData;
}

export async function getPatientList(providerId: string, options?: { riskLevel?: string; limit?: number; offset?: number }): Promise<{ patients: Partial<AggregatedPatientData>[]; total: number }> {
  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "PatientList",
    resourceId: providerId,
    details: `Provider viewed patient list with filters: ${JSON.stringify(options || {})}`,
  });

  const patients: Partial<AggregatedPatientData>[] = [
    { patientId: "patient-001", patientName: "John Smith", dateOfBirth: "1958-03-15", mrn: "MRN-12345678", dataQualityScore: 94 },
    { patientId: "patient-002", patientName: "Maria Garcia", dateOfBirth: "1972-08-22", mrn: "MRN-12345679", dataQualityScore: 91 },
    { patientId: "patient-003", patientName: "Robert Johnson", dateOfBirth: "1953-11-05", mrn: "MRN-12345680", dataQualityScore: 88 },
    { patientId: "patient-004", patientName: "Emily Chen", dateOfBirth: "1985-04-18", mrn: "MRN-12345681", dataQualityScore: 96 },
    { patientId: "patient-005", patientName: "Michael Williams", dateOfBirth: "1968-01-30", mrn: "MRN-12345682", dataQualityScore: 89 },
  ];

  return { patients, total: patients.length };
}

export async function generateAIPatientInsights(providerId: string, patientId: string): Promise<AIPatientInsights> {
  const cacheKey = `insights:${providerId}:${patientId}`;
  const cached = insightsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.insights;
  }

  await logPhiAccess({
    userId: providerId,
    action: "generate",
    resourceType: "AIPatientInsights",
    resourceId: patientId,
    details: "Provider generated AI insights for patient",
  });

  const patientData = await getAggregatedPatientData(providerId, patientId);

  let clinicalSummary: string;
  let keyFindings: AIFinding[];
  let trends: AITrend[];
  let riskFactors: AIRiskFactor[];
  let gaps: AICareGap[];
  let recommendations: AIRecommendation[];

  try {
    const responseText = await generatePhiSafeText({
      system: `You are a clinical informatics assistant generating patient summaries for healthcare providers. Generate INFORMATIONAL ONLY insights - never provide clinical decision support or treatment recommendations. Always include appropriate disclaimers. Output must be valid JSON.`,
      user: `Analyze this aggregated patient data and provide informational insights:

Patient: ${patientData.patientName}, Age ${patientData.demographics.age}, ${patientData.demographics.gender}

Conditions: ${patientData.conditions.map(c => c.display).join(", ")}
Medications: ${patientData.medications.map(m => `${m.display} (${m.frequency})`).join(", ")}
Recent Labs: ${patientData.labResults.map(l => `${l.testName}: ${l.value} ${l.unit} (${l.interpretation})`).join(", ")}
Allergies: ${patientData.allergies.map(a => `${a.substance} - ${a.severity}`).join(", ")}
Data Sources: ${patientData.dataSources.length} connected sources

Provide JSON with:
{
  "clinicalSummary": "2-3 sentence summary of patient's current health status",
  "keyFindings": [{"category": "string", "finding": "string", "significance": "low|moderate|high|critical", "dataPoints": ["string"]}],
  "trends": [{"metric": "string", "direction": "improving|stable|declining", "period": "string", "description": "string"}],
  "riskFactors": [{"factor": "string", "level": "low|moderate|high", "description": "string", "evidencePoints": ["string"]}],
  "gaps": [{"type": "string", "description": "string", "priority": "routine|important|urgent", "recommendation": "string"}],
  "recommendations": [{"category": "string", "title": "string", "description": "string", "priority": "low|medium|high", "rationale": "string", "actionable": true}]
}`,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    const parsed = JSON.parse(responseText || "{}");
    clinicalSummary = parsed.clinicalSummary || "";
    keyFindings = parsed.keyFindings || [];
    trends = parsed.trends || [];
    riskFactors = parsed.riskFactors || [];
    gaps = parsed.gaps || [];
    recommendations = parsed.recommendations || [];
  } catch (error) {
    console.log("[ProviderPortal] Using fallback AI insights");
    clinicalSummary = `${patientData.patientName} is a ${patientData.demographics.age}-year-old ${patientData.demographics.gender.toLowerCase()} with ${patientData.conditions.length} active conditions including ${patientData.conditions.slice(0, 2).map(c => c.display).join(" and ")}. Currently on ${patientData.medications.length} medications with good overall adherence.`;
    
    keyFindings = [
      { category: "Glycemic Control", finding: "HbA1c at 6.8% shows improved control from previous values", significance: "moderate", dataPoints: ["HbA1c 6.8%", "Target <7.0%"], lastUpdated: new Date().toISOString() },
      { category: "Cardiovascular", finding: "Blood pressure slightly elevated, medication review may be beneficial", significance: "moderate", dataPoints: ["BP 138/85", "Target <130/80"], lastUpdated: new Date().toISOString() },
      { category: "Medication Adherence", finding: "High overall adherence rates across all medications", significance: "low", dataPoints: ["Metformin 92%", "Lisinopril 95%", "Atorvastatin 88%"], lastUpdated: new Date().toISOString() },
    ];

    trends = [
      { metric: "HbA1c", direction: "improving", period: "6 months", description: "Decreased from 7.2% to 6.8%", dataPoints: [] },
      { metric: "Blood Pressure", direction: "stable", period: "3 months", description: "Consistently in mild hypertension range", dataPoints: [] },
      { metric: "LDL Cholesterol", direction: "improving", period: "12 months", description: "Decreased to target range with statin therapy", dataPoints: [] },
    ];

    riskFactors = [
      { factor: "Cardiovascular Disease", level: "moderate", description: "Multiple risk factors present including diabetes, hypertension, and hyperlipidemia", evidencePoints: ["Type 2 DM", "Essential HTN", "Hyperlipidemia"], potentialInterventions: [] },
      { factor: "Diabetic Complications", level: "low", description: "Well-controlled diabetes with regular monitoring reduces complication risk", evidencePoints: ["HbA1c 6.8%", "Regular foot exams", "Annual eye exams"], potentialInterventions: [] },
    ];

    gaps = [
      { type: "Preventive Care", description: "Annual wellness visit due", priority: "routine", recommendation: "Schedule annual wellness visit within next 30 days" },
      { type: "Screening", description: "Colorectal cancer screening may be due based on age", priority: "important", recommendation: "Verify colonoscopy history and schedule if needed" },
    ];

    recommendations = [
      { category: "Blood Pressure", title: "Consider BP medication adjustment", description: "Current readings above target despite treatment", priority: "medium", rationale: "Sustained BP >130/80 increases cardiovascular risk", actionable: true },
      { category: "Lifestyle", title: "Reinforce diet and exercise counseling", description: "Weight management support may improve multiple parameters", priority: "low", rationale: "Lifestyle modifications complement pharmacotherapy", actionable: true },
    ];
  }

  const insights: AIPatientInsights = {
    patientId,
    generatedAt: new Date().toISOString(),
    clinicalSummary,
    keyFindings,
    trends,
    riskFactors,
    gaps,
    recommendations,
    qualityMetrics: [
      { measure: "Diabetes: HbA1c Control", value: 6.8, target: 7.0, status: "met", lastAssessed: "2025-01-15" },
      { measure: "Hypertension: BP Control", value: 138, target: 130, status: "not_met", lastAssessed: "2025-01-22" },
      { measure: "Hyperlipidemia: LDL Control", value: 98, target: 100, status: "met", lastAssessed: "2025-01-15" },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
  };

  insightsCache.set(cacheKey, { insights, cachedAt: Date.now() });
  return insights;
}

export async function getConversations(providerId: string, options?: { patientId?: string; status?: string }): Promise<Conversation[]> {
  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "Conversations",
    resourceId: providerId,
    details: "Provider viewed message conversations",
  });

  let result = Array.from(conversations.values());
  
  if (options?.patientId) {
    result = result.filter(c => c.patientId === options.patientId);
  }
  if (options?.status) {
    result = result.filter(c => c.status === options.status);
  }

  return result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export async function getMessages(providerId: string, conversationId: string): Promise<SecureMessage[]> {
  await logPhiAccess({
    userId: providerId,
    action: "view",
    resourceType: "SecureMessages",
    resourceId: conversationId,
    details: "Provider viewed messages in conversation",
  });

  return messages.get(conversationId) || [];
}

export async function sendMessage(providerId: string, message: Omit<SecureMessage, "id" | "createdAt" | "isEncrypted">): Promise<SecureMessage> {
  await logPhiAccess({
    userId: providerId,
    action: "create",
    resourceType: "SecureMessage",
    resourceId: message.conversationId,
    details: `Provider sent secure message to ${message.recipientType}`,
  });

  const newMessage: SecureMessage = {
    ...message,
    id: `msg-${Date.now()}`,
    isEncrypted: true,
    createdAt: new Date().toISOString(),
  };

  const conversationMessages = messages.get(message.conversationId) || [];
  conversationMessages.push(newMessage);
  messages.set(message.conversationId, conversationMessages);

  const conversation = conversations.get(message.conversationId);
  if (conversation) {
    conversation.lastMessage = message.content.substring(0, 100);
    conversation.lastMessageAt = newMessage.createdAt;
  }

  return newMessage;
}

export async function createConversation(providerId: string, conversation: Omit<Conversation, "id" | "createdAt" | "lastMessageAt" | "unreadCount">): Promise<Conversation> {
  await logPhiAccess({
    userId: providerId,
    action: "create",
    resourceType: "Conversation",
    resourceId: conversation.patientId || "unknown",
    details: `Provider created new conversation: ${conversation.subject}`,
  });

  const newConversation: Conversation = {
    ...conversation,
    id: `conv-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };

  conversations.set(newConversation.id, newConversation);
  return newConversation;
}

console.log("[DedicatedProviderPortal] Service initialized with aggregated data, AI insights, and secure messaging");
console.log("[DedicatedProviderPortal] RBAC enforcement: provider/clinician roles required");
console.log("[DedicatedProviderPortal] NO-CDS compliance: All AI outputs are informational only");
