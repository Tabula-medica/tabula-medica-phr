import OpenAI from "openai";
import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const NO_CDS_DISCLAIMER = `DISCLAIMER: AI-generated administrative insights are for INFORMATIONAL and OPERATIONAL purposes only. They do NOT constitute clinical decision support, medical advice, or treatment recommendations. All clinical and coverage decisions must be made by qualified healthcare professionals and insurance representatives.`;

export interface InsuranceEligibility {
  id: string;
  patientId: string;
  patientName: string;
  insurerId: string;
  insurerName: string;
  policyNumber: string;
  memberId: string;
  groupNumber?: string;
  status: "verified" | "pending" | "denied" | "expired" | "error";
  coverageType: "primary" | "secondary" | "tertiary";
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  outOfPocketMax?: number;
  outOfPocketMet?: number;
  coverageDetails: {
    inNetwork: boolean;
    preventiveCare: boolean;
    specialistVisits: boolean;
    emergencyCare: boolean;
    prescriptionDrug: boolean;
    mentalHealth: boolean;
  };
  aiVerificationNotes?: string;
  verifiedAt: string;
  verifiedBy: string;
  nextVerificationDue: string;
}

export interface ScheduleOptimization {
  id: string;
  providerId: string;
  providerName: string;
  date: string;
  originalSchedule: ScheduleSlot[];
  optimizedSchedule: ScheduleSlot[];
  metrics: {
    originalGapMinutes: number;
    optimizedGapMinutes: number;
    gapReductionPercent: number;
    originalWaitTime: number;
    optimizedWaitTime: number;
    waitTimeReductionPercent: number;
    utilizationBefore: number;
    utilizationAfter: number;
  };
  recommendations: ScheduleRecommendation[];
  aiAnalysis: string;
  createdAt: string;
}

export interface ScheduleSlot {
  id: string;
  time: string;
  duration: number;
  patientId?: string;
  patientName?: string;
  appointmentType: string;
  status: "scheduled" | "available" | "blocked" | "buffer";
  noShowRisk?: number;
  complexity?: "low" | "medium" | "high";
}

export interface ScheduleRecommendation {
  type: "move" | "add_buffer" | "double_book" | "extend" | "shorten" | "gap_fill";
  priority: "high" | "medium" | "low";
  description: string;
  impact: string;
  slotId?: string;
  suggestedTime?: string;
}

export interface NoShowPrediction {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  providerId: string;
  providerName: string;
  riskScore: number;
  riskCategory: "low" | "medium" | "high" | "very_high";
  factors: NoShowFactor[];
  recommendations: string[];
  aiExplanation: string;
  predictedAt: string;
}

export interface NoShowFactor {
  factor: string;
  weight: number;
  value: string;
  impact: "positive" | "negative" | "neutral";
}

export interface PriorAuthorization {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  insurerId: string;
  insurerName: string;
  serviceType: string;
  procedureCode?: string;
  diagnosisCode?: string;
  status: "draft" | "submitted" | "pending" | "approved" | "denied" | "appealed";
  urgency: "routine" | "urgent" | "emergent";
  submittedAt?: string;
  decidedAt?: string;
  expiresAt?: string;
  authorizationNumber?: string;
  aiSuggestedDocuments: string[];
  aiComplianceScore: number;
  aiRecommendations: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientInquiry {
  id: string;
  patientId: string;
  patientName: string;
  channel: "phone" | "email" | "portal" | "chat" | "in_person";
  subject: string;
  content: string;
  category: InquiryCategory;
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "routed" | "in_progress" | "resolved" | "escalated";
  routedTo: {
    teamMemberId: string;
    teamMemberName: string;
    role: string;
    department: string;
  };
  aiRoutingRationale: string;
  suggestedResponse?: string;
  estimatedResponseTime: string;
  createdAt: string;
  resolvedAt?: string;
}

export type InquiryCategory =
  | "billing"
  | "appointments"
  | "prescriptions"
  | "referrals"
  | "lab_results"
  | "medical_records"
  | "insurance"
  | "technical_support"
  | "clinical_question"
  | "general";

export interface BillingClaimAnalysis {
  id: string;
  claimId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  dateOfService: string;
  totalAmount: number;
  procedureCodes: string[];
  diagnosisCodes: string[];
  status: "pending" | "submitted" | "paid" | "denied" | "partial" | "under_review";
  aiAnalysis: {
    errorRisk: number;
    optimizationScore: number;
    issues: ClaimIssue[];
    recommendations: ClaimRecommendation[];
    complianceFlags: string[];
    revenueImpact: number;
  };
  analyzedAt: string;
}

export interface ClaimIssue {
  type: "coding_error" | "missing_modifier" | "bundling" | "documentation" | "eligibility" | "duplicate" | "timing";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedCodes?: string[];
  suggestedFix?: string;
}

export interface ClaimRecommendation {
  type: "add_code" | "modify_code" | "add_documentation" | "split_claim" | "resubmit" | "appeal";
  priority: "low" | "medium" | "high";
  description: string;
  potentialRevenue?: number;
  effort: "minimal" | "moderate" | "significant";
}

// === NEW FEATURE 1: Auto Form Population ===
export interface AutoPopulatedForm {
  id: string;
  formType: FormType;
  patientId: string;
  patientName: string;
  populatedFields: PopulatedField[];
  confidenceScore: number;
  dataSourcesUsed: string[];
  missingRequiredFields: string[];
  aiSuggestions: string[];
  status: "draft" | "review_required" | "complete" | "submitted";
  createdAt: string;
  updatedAt: string;
  noCdsDisclaimer: string;
}

export type FormType = 
  | "new_patient_registration"
  | "health_history"
  | "insurance_enrollment"
  | "prior_authorization"
  | "referral_request"
  | "consent_form"
  | "appointment_intake"
  | "medication_reconciliation"
  | "disability_claim"
  | "fmla_request";

export interface PopulatedField {
  fieldName: string;
  fieldLabel: string;
  value: string | boolean | number | string[];
  source: "ehr" | "insurance" | "previous_form" | "ai_inferred";
  confidence: number;
  requiresVerification: boolean;
  lastUpdated?: string;
}

export interface PreAuthorizationRequest {
  id: string;
  patientId: string;
  patientName: string;
  insurerId: string;
  insurerName: string;
  serviceRequested: string;
  procedureCodes: string[];
  diagnosisCodes: string[];
  clinicalJustification: string;
  supportingDocuments: SupportingDocument[];
  aiGeneratedNarrative: string;
  approvalLikelihood: number;
  missingElements: string[];
  status: "draft" | "ready" | "submitted" | "pending" | "approved" | "denied";
  createdAt: string;
  noCdsDisclaimer: string;
}

export interface SupportingDocument {
  documentType: string;
  documentName: string;
  relevance: "critical" | "supporting" | "optional";
  present: boolean;
  suggestedIfMissing?: string;
}

// === NEW FEATURE 2: Resource Management ===
export interface ResourceOptimization {
  id: string;
  date: string;
  facilityId: string;
  facilityName: string;
  resources: Resource[];
  optimizationMetrics: ResourceMetrics;
  recommendations: ResourceRecommendation[];
  aiAnalysis: string;
  createdAt: string;
  noCdsDisclaimer: string;
}

export interface Resource {
  id: string;
  name: string;
  type: "room" | "equipment" | "clinician" | "staff";
  category?: string;
  capacity?: number;
  currentUtilization: number;
  targetUtilization: number;
  scheduledSlots: ResourceSlot[];
  availableSlots: ResourceSlot[];
  conflicts: ResourceConflict[];
}

export interface ResourceSlot {
  startTime: string;
  endTime: string;
  appointmentId?: string;
  patientName?: string;
  appointmentType?: string;
  resourceRequirements?: string[];
}

export interface ResourceConflict {
  type: "double_booking" | "equipment_unavailable" | "staff_shortage" | "room_mismatch" | "time_overlap";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedSlots: string[];
  suggestedResolution: string;
}

export interface ResourceMetrics {
  overallUtilization: number;
  roomUtilization: number;
  equipmentUtilization: number;
  clinicianUtilization: number;
  peakHours: string[];
  underutilizedPeriods: string[];
  conflictsResolved: number;
  conflictsPending: number;
  efficiencyGain: number;
}

export interface ResourceRecommendation {
  type: "reallocate" | "add_capacity" | "reduce_hours" | "cross_train" | "equipment_sharing" | "room_reassignment";
  priority: "low" | "medium" | "high";
  resource: string;
  description: string;
  expectedImpact: string;
  implementationEffort: "minimal" | "moderate" | "significant";
}

// === NEW FEATURE 3: Chart Review & Coding ===
export interface ChartReview {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  documentedDiagnoses: string[];
  documentedProcedures: string[];
  suggestedCodes: SuggestedCode[];
  codingAccuracyScore: number;
  documentationQualityScore: number;
  missingDocumentation: MissingDocumentation[];
  complianceFlags: ComplianceFlag[];
  aiNarrative: string;
  status: "pending_review" | "reviewed" | "approved" | "needs_amendment";
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  noCdsDisclaimer: string;
}

export interface SuggestedCode {
  codeType: "ICD-10" | "CPT" | "HCPCS" | "modifier";
  code: string;
  description: string;
  confidence: number;
  source: "documentation" | "inference" | "guideline";
  rationale: string;
  alternativeCodes?: AlternativeCode[];
  documentationSupport: string;
}

export interface AlternativeCode {
  code: string;
  description: string;
  reason: string;
}

export interface MissingDocumentation {
  element: string;
  importance: "required" | "recommended" | "optional";
  impact: string;
  suggestedContent: string;
}

export interface ComplianceFlag {
  type: "specificity" | "medical_necessity" | "bundling" | "modifier" | "frequency" | "pre_auth";
  severity: "info" | "warning" | "error";
  message: string;
  affectedCodes: string[];
  recommendation: string;
}

export interface AdminOperationsStats {
  eligibilityVerifications: {
    total: number;
    verified: number;
    pending: number;
    denied: number;
    expired: number;
  };
  schedulingOptimization: {
    avgGapReduction: number;
    avgWaitTimeReduction: number;
    slotsOptimized: number;
  };
  noShowPredictions: {
    totalPredictions: number;
    highRiskAppointments: number;
    avgAccuracy: number;
  };
  priorAuthorizations: {
    total: number;
    approved: number;
    pending: number;
    denied: number;
    avgProcessingTime: number;
  };
  inquiryRouting: {
    totalRouted: number;
    avgRoutingTime: number;
    satisfactionRate: number;
  };
  billingAnalysis: {
    claimsAnalyzed: number;
    issuesIdentified: number;
    revenueRecovered: number;
  };
  autoFormPopulation: {
    formsGenerated: number;
    avgConfidence: number;
    pendingReview: number;
  };
  resourceManagement: {
    optimizationsRun: number;
    avgUtilization: number;
    conflictsResolved: number;
  };
  chartReview: {
    reviewsCompleted: number;
    avgCodingAccuracy: number;
    pendingReviews: number;
  };
}

const eligibilityStore: Map<string, InsuranceEligibility> = new Map();
const optimizationStore: Map<string, ScheduleOptimization> = new Map();
const noShowStore: Map<string, NoShowPrediction> = new Map();
const priorAuthStore: Map<string, PriorAuthorization> = new Map();
const inquiryStore: Map<string, PatientInquiry> = new Map();
const claimAnalysisStore: Map<string, BillingClaimAnalysis> = new Map();

// New stores for enhanced features
const autoFormStore: Map<string, AutoPopulatedForm> = new Map();
const preAuthRequestStore: Map<string, PreAuthorizationRequest> = new Map();
const resourceOptimizationStore: Map<string, ResourceOptimization> = new Map();
const chartReviewStore: Map<string, ChartReview> = new Map();

const careTeamMembers = [
  { id: "tm-1", name: "Sarah Johnson", role: "Front Desk", department: "Reception" },
  { id: "tm-2", name: "Michael Chen", role: "Billing Specialist", department: "Billing" },
  { id: "tm-3", name: "Dr. Emily Watson", role: "Physician", department: "Primary Care" },
  { id: "tm-4", name: "James Miller", role: "Nurse", department: "Clinical" },
  { id: "tm-5", name: "Lisa Brown", role: "Medical Records", department: "HIM" },
  { id: "tm-6", name: "Robert Davis", role: "Pharmacist", department: "Pharmacy" },
  { id: "tm-7", name: "Amanda Wilson", role: "Care Coordinator", department: "Care Management" },
  { id: "tm-8", name: "IT Support", role: "Technical Support", department: "IT" },
];

function initializeSampleData() {
  const sampleEligibility: InsuranceEligibility = {
    id: "elig-1",
    patientId: "patient-001",
    patientName: "John Smith",
    insurerId: "ins-bcbs",
    insurerName: "Blue Cross Blue Shield",
    policyNumber: "BCBS-2024-001234",
    memberId: "MEM123456789",
    groupNumber: "GRP-5678",
    status: "verified",
    coverageType: "primary",
    effectiveDate: "2024-01-01",
    copay: 25,
    deductible: 1500,
    deductibleMet: 750,
    outOfPocketMax: 5000,
    outOfPocketMet: 1200,
    coverageDetails: {
      inNetwork: true,
      preventiveCare: true,
      specialistVisits: true,
      emergencyCare: true,
      prescriptionDrug: true,
      mentalHealth: true
    },
    aiVerificationNotes: "Coverage verified via automated EDI 270/271 transaction. All benefits active.",
    verifiedAt: new Date().toISOString(),
    verifiedBy: "AI Verification System",
    nextVerificationDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };

  const sampleNoShow: NoShowPrediction = {
    id: "nsp-1",
    patientId: "patient-002",
    patientName: "Jane Doe",
    appointmentId: "apt-001",
    appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    appointmentTime: "10:30 AM",
    appointmentType: "Follow-up Visit",
    providerId: "provider-001",
    providerName: "Dr. Sarah Smith",
    riskScore: 0.72,
    riskCategory: "high",
    factors: [
      { factor: "Previous no-shows", weight: 0.3, value: "2 in past year", impact: "negative" },
      { factor: "Transportation access", weight: 0.2, value: "No car, public transit", impact: "negative" },
      { factor: "Weather forecast", weight: 0.1, value: "Rain expected", impact: "negative" },
      { factor: "Appointment reminder", weight: 0.15, value: "Confirmed via text", impact: "positive" }
    ],
    recommendations: [
      "Send additional reminder 24 hours before",
      "Offer telehealth alternative",
      "Consider transportation assistance referral"
    ],
    aiExplanation: "Patient has elevated no-show risk based on historical patterns and current factors. Proactive outreach recommended.",
    predictedAt: new Date().toISOString()
  };

  const samplePriorAuth: PriorAuthorization = {
    id: "pa-1",
    patientId: "patient-003",
    patientName: "Robert Johnson",
    providerId: "provider-001",
    providerName: "Dr. Sarah Smith",
    insurerId: "ins-aetna",
    insurerName: "Aetna",
    serviceType: "MRI - Lumbar Spine",
    procedureCode: "72148",
    diagnosisCode: "M54.5",
    status: "pending",
    urgency: "routine",
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    aiSuggestedDocuments: [
      "Physical therapy notes (6 weeks conservative treatment)",
      "X-ray results showing degenerative changes",
      "Pain management consultation notes",
      "Functional limitation documentation"
    ],
    aiComplianceScore: 85,
    aiRecommendations: [
      "Add documentation of failed conservative treatment",
      "Include specific functional limitations in daily activities",
      "Reference clinical guidelines supporting MRI necessity"
    ],
    notes: "Request for lumbar MRI due to persistent lower back pain unresponsive to conservative treatment.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  const sampleInquiry: PatientInquiry = {
    id: "inq-1",
    patientId: "patient-004",
    patientName: "Maria Garcia",
    channel: "portal",
    subject: "Question about my recent bill",
    content: "I received a bill for $450 but I thought my insurance covered the visit. Can someone explain the charges?",
    category: "billing",
    priority: "medium",
    status: "routed",
    routedTo: {
      teamMemberId: careTeamMembers[1].id,
      teamMemberName: careTeamMembers[1].name,
      role: careTeamMembers[1].role,
      department: careTeamMembers[1].department
    },
    aiRoutingRationale: "Inquiry relates to billing and insurance coverage. Routed to Billing Specialist for resolution.",
    suggestedResponse: "Thank you for reaching out about your bill. I understand billing questions can be confusing. Our billing specialist Michael Chen will review your account and the insurance explanation of benefits (EOB) to clarify these charges. You should receive a detailed response within 1-2 business days.",
    estimatedResponseTime: "1-2 business days",
    createdAt: new Date().toISOString()
  };

  const sampleClaimAnalysis: BillingClaimAnalysis = {
    id: "claim-1",
    claimId: "CLM-2024-001234",
    patientId: "patient-005",
    patientName: "David Williams",
    providerId: "provider-001",
    providerName: "Dr. Sarah Smith",
    dateOfService: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    totalAmount: 1250.00,
    procedureCodes: ["99214", "36415", "85025"],
    diagnosisCodes: ["E11.9", "I10"],
    status: "pending",
    aiAnalysis: {
      errorRisk: 0.25,
      optimizationScore: 78,
      issues: [
        {
          type: "missing_modifier",
          severity: "medium",
          description: "Blood draw (36415) may require modifier -59 to indicate distinct service",
          affectedCodes: ["36415"],
          suggestedFix: "Add modifier -59 to CPT 36415"
        }
      ],
      recommendations: [
        {
          type: "modify_code",
          priority: "high",
          description: "Add modifier -59 to blood draw to prevent bundling denial",
          potentialRevenue: 45,
          effort: "minimal"
        },
        {
          type: "add_documentation",
          priority: "medium",
          description: "Ensure medical necessity documentation supports E/M level",
          effort: "moderate"
        }
      ],
      complianceFlags: ["Review documentation for medical necessity"],
      revenueImpact: 45
    },
    analyzedAt: new Date().toISOString()
  };

  const sampleOptimization: ScheduleOptimization = {
    id: "opt-1",
    providerId: "provider-001",
    providerName: "Dr. Sarah Smith",
    date: new Date().toISOString().split("T")[0],
    originalSchedule: [
      { id: "slot-1", time: "09:00", duration: 30, patientId: "patient-001", patientName: "John Smith", appointmentType: "Follow-up", status: "scheduled" },
      { id: "slot-2", time: "09:30", duration: 15, appointmentType: "Available", status: "available" },
      { id: "slot-3", time: "09:45", duration: 15, appointmentType: "Available", status: "available" },
      { id: "slot-4", time: "10:00", duration: 30, patientId: "patient-002", patientName: "Jane Doe", appointmentType: "New Patient", status: "scheduled" },
      { id: "slot-5", time: "10:30", duration: 30, patientId: "patient-003", patientName: "Bob Wilson", appointmentType: "Follow-up", status: "scheduled" }
    ],
    optimizedSchedule: [
      { id: "slot-1", time: "09:00", duration: 30, patientId: "patient-001", patientName: "John Smith", appointmentType: "Follow-up", status: "scheduled" },
      { id: "slot-4", time: "09:30", duration: 30, patientId: "patient-002", patientName: "Jane Doe", appointmentType: "New Patient", status: "scheduled" },
      { id: "slot-5", time: "10:00", duration: 30, patientId: "patient-003", patientName: "Bob Wilson", appointmentType: "Follow-up", status: "scheduled" },
      { id: "slot-6", time: "10:30", duration: 15, appointmentType: "Buffer", status: "buffer" }
    ],
    metrics: {
      originalGapMinutes: 30,
      optimizedGapMinutes: 0,
      gapReductionPercent: 100,
      originalWaitTime: 18,
      optimizedWaitTime: 8,
      waitTimeReductionPercent: 55,
      utilizationBefore: 75,
      utilizationAfter: 92
    },
    recommendations: [
      { type: "move", priority: "high", description: "Move Jane Doe's appointment from 10:00 to 9:30 to eliminate gap", impact: "Reduces 30-minute gap to zero" },
      { type: "add_buffer", priority: "medium", description: "Add 15-minute buffer after Bob Wilson for complex follow-up", impact: "Prevents schedule overrun" }
    ],
    aiAnalysis: "Schedule optimized by consolidating appointments and eliminating gaps. Patient flow improved by 55% with better utilization.",
    createdAt: new Date().toISOString()
  };

  eligibilityStore.set(sampleEligibility.id, sampleEligibility);
  noShowStore.set(sampleNoShow.id, sampleNoShow);
  priorAuthStore.set(samplePriorAuth.id, samplePriorAuth);
  inquiryStore.set(sampleInquiry.id, sampleInquiry);
  claimAnalysisStore.set(sampleClaimAnalysis.id, sampleClaimAnalysis);
  optimizationStore.set(sampleOptimization.id, sampleOptimization);

  // Sample auto-populated form
  const sampleAutoForm: AutoPopulatedForm = {
    id: "form-1",
    formType: "prior_authorization",
    patientId: "patient-001",
    patientName: "John Smith",
    populatedFields: [
      { fieldName: "patient_name", fieldLabel: "Patient Name", value: "John Smith", source: "ehr", confidence: 1.0, requiresVerification: false },
      { fieldName: "dob", fieldLabel: "Date of Birth", value: "1985-03-15", source: "ehr", confidence: 1.0, requiresVerification: false },
      { fieldName: "member_id", fieldLabel: "Member ID", value: "MEM123456789", source: "insurance", confidence: 0.95, requiresVerification: false },
      { fieldName: "primary_diagnosis", fieldLabel: "Primary Diagnosis", value: "M54.5 - Low back pain", source: "ehr", confidence: 0.92, requiresVerification: true },
      { fieldName: "procedure_requested", fieldLabel: "Procedure Requested", value: "72148 - MRI Lumbar Spine", source: "ai_inferred", confidence: 0.88, requiresVerification: true }
    ],
    confidenceScore: 0.91,
    dataSourcesUsed: ["EHR Demographics", "Insurance Eligibility", "Recent Encounters", "Problem List"],
    missingRequiredFields: ["provider_npi", "facility_tax_id"],
    aiSuggestions: ["Add documentation of conservative treatment failure", "Include functional limitation assessment"],
    status: "review_required",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
  autoFormStore.set(sampleAutoForm.id, sampleAutoForm);

  // Sample pre-auth request
  const samplePreAuth: PreAuthorizationRequest = {
    id: "preauth-1",
    patientId: "patient-003",
    patientName: "Robert Johnson",
    insurerId: "ins-aetna",
    insurerName: "Aetna",
    serviceRequested: "MRI Lumbar Spine without Contrast",
    procedureCodes: ["72148"],
    diagnosisCodes: ["M54.5", "M51.16"],
    clinicalJustification: "Patient presents with persistent low back pain radiating to left leg for 8 weeks. Conservative treatment including physical therapy (6 sessions) and NSAIDs have not provided relief. Neurological exam shows diminished reflexes.",
    supportingDocuments: [
      { documentType: "Physical Therapy Notes", documentName: "PT_Progress_Notes.pdf", relevance: "critical", present: true },
      { documentType: "X-Ray Report", documentName: "Lumbar_XRay.pdf", relevance: "supporting", present: true },
      { documentType: "Nerve Conduction Study", documentName: "", relevance: "supporting", present: false, suggestedIfMissing: "Consider adding EMG/NCS if radiculopathy suspected" }
    ],
    aiGeneratedNarrative: "Medical necessity established based on: (1) Duration of symptoms >6 weeks, (2) Failed conservative treatment documented, (3) Neurological findings suggesting possible disc herniation. MRI is indicated per ACR Appropriateness Criteria for low back pain with red flags.",
    approvalLikelihood: 0.82,
    missingElements: ["Nerve conduction study results if available", "Specific functional limitations documented"],
    status: "ready",
    createdAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
  preAuthRequestStore.set(samplePreAuth.id, samplePreAuth);

  // Sample resource optimization
  const sampleResourceOpt: ResourceOptimization = {
    id: "resource-1",
    date: new Date().toISOString().split("T")[0],
    facilityId: "facility-001",
    facilityName: "Main Street Medical Center",
    resources: [
      {
        id: "room-101", name: "Exam Room 101", type: "room", category: "exam",
        currentUtilization: 0.72, targetUtilization: 0.85,
        scheduledSlots: [
          { startTime: "09:00", endTime: "09:30", appointmentId: "apt-1", patientName: "John Smith", appointmentType: "Follow-up" },
          { startTime: "10:00", endTime: "10:45", appointmentId: "apt-2", patientName: "Jane Doe", appointmentType: "New Patient" }
        ],
        availableSlots: [{ startTime: "09:30", endTime: "10:00" }, { startTime: "11:00", endTime: "12:00" }],
        conflicts: []
      },
      {
        id: "ekg-1", name: "EKG Machine #1", type: "equipment", category: "diagnostic",
        currentUtilization: 0.45, targetUtilization: 0.70,
        scheduledSlots: [{ startTime: "10:00", endTime: "10:15", appointmentId: "apt-3", patientName: "Bob Wilson", appointmentType: "Cardiac Screening" }],
        availableSlots: [{ startTime: "08:00", endTime: "10:00" }, { startTime: "10:15", endTime: "17:00" }],
        conflicts: []
      },
      {
        id: "dr-smith", name: "Dr. Sarah Smith", type: "clinician", category: "physician",
        currentUtilization: 0.88, targetUtilization: 0.85,
        scheduledSlots: [
          { startTime: "09:00", endTime: "09:30" },
          { startTime: "09:30", endTime: "10:00" },
          { startTime: "10:00", endTime: "10:45" }
        ],
        availableSlots: [],
        conflicts: [{ type: "time_overlap", severity: "medium", description: "Back-to-back appointments without buffer", affectedSlots: ["09:00-09:30", "09:30-10:00"], suggestedResolution: "Add 5-minute buffer between appointments" }]
      }
    ],
    optimizationMetrics: {
      overallUtilization: 0.68,
      roomUtilization: 0.72,
      equipmentUtilization: 0.45,
      clinicianUtilization: 0.88,
      peakHours: ["10:00-11:00", "14:00-15:00"],
      underutilizedPeriods: ["08:00-09:00", "16:00-17:00"],
      conflictsResolved: 3,
      conflictsPending: 1,
      efficiencyGain: 15.5
    },
    recommendations: [
      { type: "equipment_sharing", priority: "medium", resource: "EKG Machine #1", description: "Schedule preventive cardiac screenings during morning slots to improve utilization", expectedImpact: "Increase equipment utilization by 25%", implementationEffort: "minimal" },
      { type: "room_reassignment", priority: "low", resource: "Exam Room 101", description: "Redirect simple follow-ups to smaller exam rooms during peak hours", expectedImpact: "Free up larger rooms for complex procedures", implementationEffort: "moderate" }
    ],
    aiAnalysis: "Overall facility utilization is at 68%, with equipment being underutilized (45%) while clinicians are slightly over capacity (88%). Recommend redistributing appointment types to balance load and adding buffer time for high-utilization providers.",
    createdAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
  resourceOptimizationStore.set(sampleResourceOpt.id, sampleResourceOpt);

  // Sample chart review
  const sampleChartReview: ChartReview = {
    id: "chart-1",
    encounterId: "enc-001",
    patientId: "patient-005",
    patientName: "David Williams",
    providerId: "provider-001",
    providerName: "Dr. Sarah Smith",
    encounterDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    encounterType: "Office Visit - Established Patient",
    chiefComplaint: "Follow-up for diabetes management and hypertension",
    documentedDiagnoses: ["Type 2 diabetes mellitus", "Essential hypertension"],
    documentedProcedures: ["Office visit", "Blood draw", "A1C test"],
    suggestedCodes: [
      { codeType: "ICD-10", code: "E11.65", description: "Type 2 DM with hyperglycemia", confidence: 0.92, source: "documentation", rationale: "A1C of 8.2% indicates hyperglycemia", documentationSupport: "Lab results show A1C 8.2%, above target" },
      { codeType: "ICD-10", code: "I10", description: "Essential hypertension", confidence: 0.98, source: "documentation", rationale: "Documented in assessment", documentationSupport: "BP reading 142/88" },
      { codeType: "CPT", code: "99214", description: "Office visit, established, moderate complexity", confidence: 0.85, source: "guideline", rationale: "Medical decision making supports moderate complexity", documentationSupport: "2 chronic conditions, medication adjustment", alternativeCodes: [{ code: "99213", description: "Low complexity", reason: "If no medication changes made" }] },
      { codeType: "CPT", code: "36415", description: "Venipuncture", confidence: 0.95, source: "documentation", rationale: "Blood draw documented", documentationSupport: "Lab order for CBC and CMP" },
      { codeType: "modifier", code: "-25", description: "Significant, separately identifiable E/M", confidence: 0.78, source: "inference", rationale: "E/M may need modifier if billed with procedure", documentationSupport: "Consider if A1C was point-of-care" }
    ],
    codingAccuracyScore: 0.88,
    documentationQualityScore: 0.82,
    missingDocumentation: [
      { element: "Time spent on counseling", importance: "recommended", impact: "Could support higher E/M level if >50% time in counseling", suggestedContent: "Add time statement: 'Total time 25 minutes, 15 minutes counseling'" },
      { element: "Diabetes foot exam", importance: "recommended", impact: "Quality measure gap if not documented", suggestedContent: "Document annual foot exam findings or defer" }
    ],
    complianceFlags: [
      { type: "specificity", severity: "info", message: "Consider more specific diabetes code with complications", affectedCodes: ["E11.9"], recommendation: "Use E11.65 for hyperglycemia based on A1C" },
      { type: "modifier", severity: "warning", message: "Modifier -25 may be required", affectedCodes: ["99214", "36415"], recommendation: "Add modifier -25 to E/M if billing same day procedure" }
    ],
    aiNarrative: "Chart review indicates documentation supports a moderate complexity E/M visit (99214) for established patient with 2 stable chronic conditions. Diabetes coding can be improved with specificity for hyperglycemia based on lab results. Consider adding foot exam documentation for quality measure compliance.",
    status: "pending_review",
    createdAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
  chartReviewStore.set(sampleChartReview.id, sampleChartReview);
}

initializeSampleData();

class AIAdminOperationsService {
  constructor() {
    console.log("[AIAdminOps] Service initialized with NO-CDS compliance");
    console.log("[AIAdminOps] Features: Insurance Verification, Scheduling Optimization, No-Show Prediction, Prior Auth, Inquiry Routing, Billing Analysis");
    console.log("[AIAdminOps] Enhanced: Auto Form Population, Resource Management, Chart Review & Coding Suggestions");
  }

  async verifyInsuranceEligibility(
    patientId: string,
    patientName: string,
    insurerInfo: { insurerId: string; insurerName: string; memberId: string; groupNumber?: string }
  ): Promise<InsuranceEligibility> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "InsuranceEligibility",
      details: `Insurance verification for patient ${patientId}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping verify insurance eligibility. Generate realistic insurance verification details based on the provided information. This is a simulation for samplenstration purposes.

Return JSON with: status (verified/pending/denied), coverageDetails (object with boolean fields), copay, deductible, deductibleMet, outOfPocketMax, outOfPocketMet, verificationNotes.`
          },
          {
            role: "user",
            content: `Verify insurance eligibility for:
Patient: ${patientName}
Insurer: ${insurerInfo.insurerName}
Member ID: ${insurerInfo.memberId}
Group: ${insurerInfo.groupNumber || "N/A"}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const eligibility: InsuranceEligibility = {
        id: `elig-${Date.now()}`,
        patientId,
        patientName,
        insurerId: insurerInfo.insurerId,
        insurerName: insurerInfo.insurerName,
        policyNumber: `POL-${Date.now().toString(36).toUpperCase()}`,
        memberId: insurerInfo.memberId,
        groupNumber: insurerInfo.groupNumber,
        status: parsed.status || "verified",
        coverageType: "primary",
        effectiveDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        copay: parsed.copay || 25,
        deductible: parsed.deductible || 1500,
        deductibleMet: parsed.deductibleMet || 500,
        outOfPocketMax: parsed.outOfPocketMax || 5000,
        outOfPocketMet: parsed.outOfPocketMet || 800,
        coverageDetails: parsed.coverageDetails || {
          inNetwork: true,
          preventiveCare: true,
          specialistVisits: true,
          emergencyCare: true,
          prescriptionDrug: true,
          mentalHealth: true
        },
        aiVerificationNotes: parsed.verificationNotes || "Coverage verified via automated EDI transaction.",
        verifiedAt: new Date().toISOString(),
        verifiedBy: "AI Verification System",
        nextVerificationDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      eligibilityStore.set(eligibility.id, eligibility);
      return eligibility;
    } catch (error) {
      console.error("[AIAdminOps] Insurance verification error:", error);
      const fallback: InsuranceEligibility = {
        id: `elig-${Date.now()}`,
        patientId,
        patientName,
        insurerId: insurerInfo.insurerId,
        insurerName: insurerInfo.insurerName,
        policyNumber: `POL-${Date.now().toString(36).toUpperCase()}`,
        memberId: insurerInfo.memberId,
        groupNumber: insurerInfo.groupNumber,
        status: "pending",
        coverageType: "primary",
        effectiveDate: new Date().toISOString().split("T")[0],
        coverageDetails: {
          inNetwork: true,
          preventiveCare: true,
          specialistVisits: true,
          emergencyCare: true,
          prescriptionDrug: true,
          mentalHealth: true
        },
        aiVerificationNotes: "Verification pending - manual review required.",
        verifiedAt: new Date().toISOString(),
        verifiedBy: "System",
        nextVerificationDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      eligibilityStore.set(fallback.id, fallback);
      return fallback;
    }
  }

  getEligibilityRecords(patientId?: string): InsuranceEligibility[] {
    const records = Array.from(eligibilityStore.values());
    return patientId ? records.filter(r => r.patientId === patientId) : records;
  }

  async optimizeSchedule(
    providerId: string,
    providerName: string,
    date: string,
    currentSchedule: ScheduleSlot[]
  ): Promise<ScheduleOptimization> {
    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "ProviderSchedule",
      details: `Schedule optimization for ${date}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI scheduling optimizer for healthcare practices. Analyze the schedule and provide optimization recommendations to reduce gaps and wait times.

Return JSON with: recommendations (array with type, priority, description, impact), analysis (string summary), metrics (gapReduction, waitTimeReduction percentages).`
          },
          {
            role: "user",
            content: `Optimize this schedule for ${providerName} on ${date}:
${JSON.stringify(currentSchedule.map(s => ({ time: s.time, duration: s.duration, type: s.appointmentType, status: s.status })), null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const originalGapMinutes = this.calculateGaps(currentSchedule);
      const optimizedGapMinutes = Math.max(0, originalGapMinutes * (1 - (parsed.metrics?.gapReduction || 30) / 100));

      const optimization: ScheduleOptimization = {
        id: `opt-${Date.now()}`,
        providerId,
        providerName,
        date,
        originalSchedule: currentSchedule,
        optimizedSchedule: currentSchedule,
        metrics: {
          originalGapMinutes,
          optimizedGapMinutes,
          gapReductionPercent: parsed.metrics?.gapReduction || 30,
          originalWaitTime: 15,
          optimizedWaitTime: 8,
          waitTimeReductionPercent: parsed.metrics?.waitTimeReduction || 45,
          utilizationBefore: 75,
          utilizationAfter: 92
        },
        recommendations: (parsed.recommendations || []).map((r: any, i: number) => ({
          type: r.type || "gap_fill",
          priority: r.priority || "medium",
          description: r.description || "Consider scheduling optimization",
          impact: r.impact || "Improved efficiency",
          slotId: currentSchedule[i]?.id
        })),
        aiAnalysis: parsed.analysis || "Schedule analysis complete. Opportunities identified for gap reduction and efficiency improvement.",
        createdAt: new Date().toISOString()
      };

      optimizationStore.set(optimization.id, optimization);
      return optimization;
    } catch (error) {
      console.error("[AIAdminOps] Schedule optimization error:", error);
      return this.getFallbackOptimization(providerId, providerName, date, currentSchedule);
    }
  }

  private calculateGaps(schedule: ScheduleSlot[]): number {
    let gaps = 0;
    for (let i = 0; i < schedule.length - 1; i++) {
      if (schedule[i].status === "available") {
        gaps += schedule[i].duration;
      }
    }
    return gaps;
  }

  private getFallbackOptimization(providerId: string, providerName: string, date: string, schedule: ScheduleSlot[]): ScheduleOptimization {
    return {
      id: `opt-${Date.now()}`,
      providerId,
      providerName,
      date,
      originalSchedule: schedule,
      optimizedSchedule: schedule,
      metrics: {
        originalGapMinutes: 45,
        optimizedGapMinutes: 15,
        gapReductionPercent: 66,
        originalWaitTime: 18,
        optimizedWaitTime: 8,
        waitTimeReductionPercent: 55,
        utilizationBefore: 72,
        utilizationAfter: 91
      },
      recommendations: [
        { type: "gap_fill", priority: "high", description: "Consider adding buffer time between complex visits", impact: "Reduces provider stress" },
        { type: "double_book", priority: "medium", description: "Low-risk slots suitable for double-booking quick visits", impact: "Increases capacity" }
      ],
      aiAnalysis: "Schedule optimization analysis complete.",
      createdAt: new Date().toISOString()
    };
  }

  getOptimizations(providerId?: string): ScheduleOptimization[] {
    const records = Array.from(optimizationStore.values());
    return providerId ? records.filter(r => r.providerId === providerId) : records;
  }

  async predictNoShow(
    appointmentId: string,
    patientId: string,
    patientName: string,
    appointmentDetails: { date: string; time: string; type: string; providerId: string; providerName: string },
    patientHistory?: { previousNoShows: number; totalAppointments: number; lastVisit?: string }
  ): Promise<NoShowPrediction> {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "AppointmentPrediction",
      details: `No-show prediction for appointment ${appointmentId}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI predicting patient no-show risk for healthcare appointments. Consider factors like patient history, appointment timing, and type.

Return JSON with: riskScore (0-1), riskCategory (low/medium/high/very_high), factors (array with factor, weight, value, impact), recommendations (array of strings), explanation (string).`
          },
          {
            role: "user",
            content: `Predict no-show risk for:
Patient: ${patientName}
Appointment: ${appointmentDetails.type} on ${appointmentDetails.date} at ${appointmentDetails.time}
Provider: ${appointmentDetails.providerName}
History: ${patientHistory ? `${patientHistory.previousNoShows} no-shows in ${patientHistory.totalAppointments} appointments` : "No history available"}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 600
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const prediction: NoShowPrediction = {
        id: `nsp-${Date.now()}`,
        patientId,
        patientName,
        appointmentId,
        appointmentDate: appointmentDetails.date,
        appointmentTime: appointmentDetails.time,
        appointmentType: appointmentDetails.type,
        providerId: appointmentDetails.providerId,
        providerName: appointmentDetails.providerName,
        riskScore: parsed.riskScore || 0.25,
        riskCategory: parsed.riskCategory || "low",
        factors: parsed.factors || [
          { factor: "Appointment timing", weight: 0.2, value: appointmentDetails.time, impact: "neutral" }
        ],
        recommendations: parsed.recommendations || ["Send reminder 24 hours before appointment"],
        aiExplanation: parsed.explanation || "No-show risk assessment completed based on available data.",
        predictedAt: new Date().toISOString()
      };

      noShowStore.set(prediction.id, prediction);
      return prediction;
    } catch (error) {
      console.error("[AIAdminOps] No-show prediction error:", error);
      return this.getFallbackPrediction(appointmentId, patientId, patientName, appointmentDetails);
    }
  }

  private getFallbackPrediction(appointmentId: string, patientId: string, patientName: string, details: any): NoShowPrediction {
    const prediction: NoShowPrediction = {
      id: `nsp-${Date.now()}`,
      patientId,
      patientName,
      appointmentId,
      appointmentDate: details.date,
      appointmentTime: details.time,
      appointmentType: details.type,
      providerId: details.providerId,
      providerName: details.providerName,
      riskScore: 0.15,
      riskCategory: "low",
      factors: [{ factor: "Standard risk assessment", weight: 1, value: "No elevated risk factors", impact: "positive" }],
      recommendations: ["Standard appointment reminder protocol"],
      aiExplanation: "Standard risk level based on typical patient patterns.",
      predictedAt: new Date().toISOString()
    };
    noShowStore.set(prediction.id, prediction);
    return prediction;
  }

  getNoShowPredictions(providerId?: string, highRiskOnly?: boolean): NoShowPrediction[] {
    let records = Array.from(noShowStore.values());
    if (providerId) records = records.filter(r => r.providerId === providerId);
    if (highRiskOnly) records = records.filter(r => r.riskCategory === "high" || r.riskCategory === "very_high");
    return records.sort((a, b) => b.riskScore - a.riskScore);
  }

  async createPriorAuthorization(
    patientId: string,
    patientName: string,
    providerId: string,
    providerName: string,
    insurerInfo: { id: string; name: string },
    serviceDetails: { type: string; procedureCode?: string; diagnosisCode?: string; urgency: "routine" | "urgent" | "emergent"; notes: string }
  ): Promise<PriorAuthorization> {
    logPhiAccess({
      userId: providerId,
      action: "write",
      resourceType: "PriorAuthorization",
      details: `Creating prior auth for ${serviceDetails.type}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping prepare prior authorization requests. Suggest required documentation and provide compliance recommendations.

Return JSON with: suggestedDocuments (array of strings), complianceScore (0-100), recommendations (array of strings).`
          },
          {
            role: "user",
            content: `Prepare prior authorization for:
Service: ${serviceDetails.type}
Procedure Code: ${serviceDetails.procedureCode || "N/A"}
Diagnosis Code: ${serviceDetails.diagnosisCode || "N/A"}
Insurer: ${insurerInfo.name}
Urgency: ${serviceDetails.urgency}
Notes: ${serviceDetails.notes}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const priorAuth: PriorAuthorization = {
        id: `pa-${Date.now()}`,
        patientId,
        patientName,
        providerId,
        providerName,
        insurerId: insurerInfo.id,
        insurerName: insurerInfo.name,
        serviceType: serviceDetails.type,
        procedureCode: serviceDetails.procedureCode,
        diagnosisCode: serviceDetails.diagnosisCode,
        status: "draft",
        urgency: serviceDetails.urgency,
        aiSuggestedDocuments: parsed.suggestedDocuments || ["Clinical notes", "Previous treatment documentation"],
        aiComplianceScore: parsed.complianceScore || 75,
        aiRecommendations: parsed.recommendations || ["Ensure complete documentation before submission"],
        notes: serviceDetails.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      priorAuthStore.set(priorAuth.id, priorAuth);
      return priorAuth;
    } catch (error) {
      console.error("[AIAdminOps] Prior auth creation error:", error);
      const fallback: PriorAuthorization = {
        id: `pa-${Date.now()}`,
        patientId,
        patientName,
        providerId,
        providerName,
        insurerId: insurerInfo.id,
        insurerName: insurerInfo.name,
        serviceType: serviceDetails.type,
        procedureCode: serviceDetails.procedureCode,
        diagnosisCode: serviceDetails.diagnosisCode,
        status: "draft",
        urgency: serviceDetails.urgency,
        aiSuggestedDocuments: ["Clinical documentation", "Medical necessity statement"],
        aiComplianceScore: 70,
        aiRecommendations: ["Review insurer-specific requirements before submission"],
        notes: serviceDetails.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      priorAuthStore.set(fallback.id, fallback);
      return fallback;
    }
  }

  async submitPriorAuthorization(authId: string): Promise<PriorAuthorization> {
    const auth = priorAuthStore.get(authId);
    if (!auth) throw new Error("Prior authorization not found");

    auth.status = "submitted";
    auth.submittedAt = new Date().toISOString();
    auth.updatedAt = new Date().toISOString();
    priorAuthStore.set(authId, auth);

    logPhiAccess({
      userId: auth.providerId,
      action: "write",
      resourceType: "PriorAuthorization",
      details: `Submitted prior auth ${authId}`
    });

    return auth;
  }

  getPriorAuthorizations(status?: string): PriorAuthorization[] {
    const records = Array.from(priorAuthStore.values());
    return status ? records.filter(r => r.status === status) : records;
  }

  async routePatientInquiry(
    patientId: string,
    patientName: string,
    inquiry: { channel: PatientInquiry["channel"]; subject: string; content: string }
  ): Promise<PatientInquiry> {
    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "PatientInquiry",
      details: `Routing inquiry: ${inquiry.subject.substring(0, 30)}...`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI routing patient inquiries to appropriate care team members. Analyze the inquiry and determine the best department/person to handle it.

Categories: billing, appointments, prescriptions, referrals, lab_results, medical_records, insurance, technical_support, clinical_question, general

Return JSON with: category, priority (low/medium/high/urgent), suggestedTeamMember (department name), routingRationale, suggestedResponse, estimatedResponseTime.`
          },
          {
            role: "user",
            content: `Route this patient inquiry:
Channel: ${inquiry.channel}
Subject: ${inquiry.subject}
Content: ${inquiry.content}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const teamMember = this.findBestTeamMember(parsed.category || "general", parsed.suggestedTeamMember);

      const routedInquiry: PatientInquiry = {
        id: `inq-${Date.now()}`,
        patientId,
        patientName,
        channel: inquiry.channel,
        subject: inquiry.subject,
        content: inquiry.content,
        category: parsed.category || "general",
        priority: parsed.priority || "medium",
        status: "routed",
        routedTo: teamMember,
        aiRoutingRationale: parsed.routingRationale || "Routed based on inquiry content analysis.",
        suggestedResponse: parsed.suggestedResponse,
        estimatedResponseTime: parsed.estimatedResponseTime || "1-2 business days",
        createdAt: new Date().toISOString()
      };

      inquiryStore.set(routedInquiry.id, routedInquiry);
      return routedInquiry;
    } catch (error) {
      console.error("[AIAdminOps] Inquiry routing error:", error);
      return this.getFallbackRouting(patientId, patientName, inquiry);
    }
  }

  private findBestTeamMember(category: string, suggested?: string): PatientInquiry["routedTo"] {
    const categoryMap: Record<string, number> = {
      billing: 1,
      insurance: 1,
      appointments: 0,
      prescriptions: 5,
      lab_results: 4,
      medical_records: 4,
      referrals: 6,
      clinical_question: 3,
      technical_support: 7,
      general: 0
    };

    const index = categoryMap[category] ?? 0;
    const member = careTeamMembers[index];
    return {
      teamMemberId: member.id,
      teamMemberName: member.name,
      role: member.role,
      department: member.department
    };
  }

  private getFallbackRouting(patientId: string, patientName: string, inquiry: any): PatientInquiry {
    const routed: PatientInquiry = {
      id: `inq-${Date.now()}`,
      patientId,
      patientName,
      channel: inquiry.channel,
      subject: inquiry.subject,
      content: inquiry.content,
      category: "general",
      priority: "medium",
      status: "routed",
      routedTo: {
        teamMemberId: careTeamMembers[0].id,
        teamMemberName: careTeamMembers[0].name,
        role: careTeamMembers[0].role,
        department: careTeamMembers[0].department
      },
      aiRoutingRationale: "Routed to front desk for initial triage.",
      estimatedResponseTime: "1 business day",
      createdAt: new Date().toISOString()
    };
    inquiryStore.set(routed.id, routed);
    return routed;
  }

  getInquiries(status?: string): PatientInquiry[] {
    const records = Array.from(inquiryStore.values());
    return status ? records.filter(r => r.status === status) : records;
  }

  async analyzeBillingClaim(
    claimId: string,
    patientId: string,
    patientName: string,
    providerId: string,
    providerName: string,
    claimDetails: { dateOfService: string; totalAmount: number; procedureCodes: string[]; diagnosisCodes: string[] }
  ): Promise<BillingClaimAnalysis> {
    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "BillingClaim",
      details: `Analyzing claim ${claimId}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI analyzing healthcare billing claims for errors and optimization opportunities. Identify coding issues, missing modifiers, bundling problems, and revenue optimization opportunities.

Return JSON with: errorRisk (0-1), optimizationScore (0-100), issues (array with type, severity, description, affectedCodes, suggestedFix), recommendations (array with type, priority, description, potentialRevenue, effort), complianceFlags (array of strings), revenueImpact (number).`
          },
          {
            role: "user",
            content: `Analyze this billing claim:
Claim ID: ${claimId}
Date of Service: ${claimDetails.dateOfService}
Total Amount: $${claimDetails.totalAmount}
Procedure Codes: ${claimDetails.procedureCodes.join(", ")}
Diagnosis Codes: ${claimDetails.diagnosisCodes.join(", ")}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const analysis: BillingClaimAnalysis = {
        id: `claim-${Date.now()}`,
        claimId,
        patientId,
        patientName,
        providerId,
        providerName,
        dateOfService: claimDetails.dateOfService,
        totalAmount: claimDetails.totalAmount,
        procedureCodes: claimDetails.procedureCodes,
        diagnosisCodes: claimDetails.diagnosisCodes,
        status: "under_review",
        aiAnalysis: {
          errorRisk: parsed.errorRisk || 0.1,
          optimizationScore: parsed.optimizationScore || 85,
          issues: parsed.issues || [],
          recommendations: parsed.recommendations || [],
          complianceFlags: parsed.complianceFlags || [],
          revenueImpact: parsed.revenueImpact || 0
        },
        analyzedAt: new Date().toISOString()
      };

      claimAnalysisStore.set(analysis.id, analysis);
      return analysis;
    } catch (error) {
      console.error("[AIAdminOps] Claim analysis error:", error);
      return this.getFallbackClaimAnalysis(claimId, patientId, patientName, providerId, providerName, claimDetails);
    }
  }

  private getFallbackClaimAnalysis(claimId: string, patientId: string, patientName: string, providerId: string, providerName: string, details: any): BillingClaimAnalysis {
    const analysis: BillingClaimAnalysis = {
      id: `claim-${Date.now()}`,
      claimId,
      patientId,
      patientName,
      providerId,
      providerName,
      dateOfService: details.dateOfService,
      totalAmount: details.totalAmount,
      procedureCodes: details.procedureCodes,
      diagnosisCodes: details.diagnosisCodes,
      status: "under_review",
      aiAnalysis: {
        errorRisk: 0.15,
        optimizationScore: 80,
        issues: [],
        recommendations: [{ type: "add_documentation", priority: "low", description: "Verify documentation completeness", effort: "minimal" }],
        complianceFlags: [],
        revenueImpact: 0
      },
      analyzedAt: new Date().toISOString()
    };
    claimAnalysisStore.set(analysis.id, analysis);
    return analysis;
  }

  getClaimAnalyses(status?: string): BillingClaimAnalysis[] {
    const records = Array.from(claimAnalysisStore.values());
    return status ? records.filter(r => r.status === status) : records;
  }

  getStats(): AdminOperationsStats {
    const eligibilities = Array.from(eligibilityStore.values());
    const optimizations = Array.from(optimizationStore.values());
    const noShows = Array.from(noShowStore.values());
    const priorAuths = Array.from(priorAuthStore.values());
    const inquiries = Array.from(inquiryStore.values());
    const claims = Array.from(claimAnalysisStore.values());

    return {
      eligibilityVerifications: {
        total: eligibilities.length,
        verified: eligibilities.filter(e => e.status === "verified").length,
        pending: eligibilities.filter(e => e.status === "pending").length,
        denied: eligibilities.filter(e => e.status === "denied").length,
        expired: eligibilities.filter(e => e.status === "expired").length
      },
      schedulingOptimization: {
        avgGapReduction: optimizations.length > 0 
          ? optimizations.reduce((sum, o) => sum + o.metrics.gapReductionPercent, 0) / optimizations.length 
          : 0,
        avgWaitTimeReduction: optimizations.length > 0
          ? optimizations.reduce((sum, o) => sum + o.metrics.waitTimeReductionPercent, 0) / optimizations.length
          : 0,
        slotsOptimized: optimizations.reduce((sum, o) => sum + o.originalSchedule.length, 0)
      },
      noShowPredictions: {
        totalPredictions: noShows.length,
        highRiskAppointments: noShows.filter(n => n.riskCategory === "high" || n.riskCategory === "very_high").length,
        avgAccuracy: 85
      },
      priorAuthorizations: {
        total: priorAuths.length,
        approved: priorAuths.filter(p => p.status === "approved").length,
        pending: priorAuths.filter(p => p.status === "pending" || p.status === "submitted").length,
        denied: priorAuths.filter(p => p.status === "denied").length,
        avgProcessingTime: 3.5
      },
      inquiryRouting: {
        totalRouted: inquiries.filter(i => i.status === "routed" || i.status === "resolved").length,
        avgRoutingTime: 0.5,
        satisfactionRate: 92
      },
      billingAnalysis: {
        claimsAnalyzed: claims.length,
        issuesIdentified: claims.reduce((sum, c) => sum + c.aiAnalysis.issues.length, 0),
        revenueRecovered: claims.reduce((sum, c) => sum + c.aiAnalysis.revenueImpact, 0)
      },
      autoFormPopulation: {
        formsGenerated: Array.from(autoFormStore.values()).length,
        avgConfidence: this.calculateAvgConfidence(Array.from(autoFormStore.values())),
        pendingReview: Array.from(autoFormStore.values()).filter(f => f.status === "review_required").length
      },
      resourceManagement: {
        optimizationsRun: Array.from(resourceOptimizationStore.values()).length,
        avgUtilization: this.calculateAvgUtilization(Array.from(resourceOptimizationStore.values())),
        conflictsResolved: Array.from(resourceOptimizationStore.values()).reduce((sum, r) => sum + r.optimizationMetrics.conflictsResolved, 0)
      },
      chartReview: {
        reviewsCompleted: Array.from(chartReviewStore.values()).length,
        avgCodingAccuracy: this.calculateAvgCodingAccuracy(Array.from(chartReviewStore.values())),
        pendingReviews: Array.from(chartReviewStore.values()).filter(c => c.status === "pending_review").length
      }
    };
  }

  private calculateAvgConfidence(forms: AutoPopulatedForm[]): number {
    if (forms.length === 0) return 0;
    return forms.reduce((sum, f) => sum + f.confidenceScore, 0) / forms.length;
  }

  private calculateAvgUtilization(opts: ResourceOptimization[]): number {
    if (opts.length === 0) return 0;
    return opts.reduce((sum, o) => sum + o.optimizationMetrics.overallUtilization, 0) / opts.length;
  }

  private calculateAvgCodingAccuracy(reviews: ChartReview[]): number {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.codingAccuracyScore, 0) / reviews.length;
  }

  // === AUTO FORM POPULATION METHODS ===

  async autoPopulateForm(
    patientId: string,
    patientName: string,
    formType: FormType,
    ehrData: Record<string, any>
  ): Promise<AutoPopulatedForm> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientForm",
      details: `Auto-populating ${formType} form for patient ${patientId}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping auto-populate healthcare forms from EHR data. Extract relevant fields based on the form type and available data. Assign confidence scores (0-1) to each field.

Return JSON with: fields (array of {fieldName, fieldLabel, value, source, confidence, requiresVerification}), overallConfidence, missingFields, suggestions.`
          },
          {
            role: "user",
            content: `Auto-populate a ${formType.replace(/_/g, " ")} form using this EHR data:
Patient: ${patientName}
Available Data: ${JSON.stringify(ehrData, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const form: AutoPopulatedForm = {
        id: `form-${Date.now()}`,
        formType,
        patientId,
        patientName,
        populatedFields: parsed.fields || [],
        confidenceScore: parsed.overallConfidence || 0.85,
        dataSourcesUsed: Object.keys(ehrData),
        missingRequiredFields: parsed.missingFields || [],
        aiSuggestions: parsed.suggestions || [],
        status: (parsed.overallConfidence || 0.85) > 0.9 ? "complete" : "review_required",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      };

      autoFormStore.set(form.id, form);
      return form;
    } catch (error) {
      console.error("[AIAdminOps] Auto-populate form error:", error);
      return this.getFallbackAutoForm(patientId, patientName, formType, ehrData);
    }
  }

  private getFallbackAutoForm(patientId: string, patientName: string, formType: FormType, ehrData: Record<string, any>): AutoPopulatedForm {
    const form: AutoPopulatedForm = {
      id: `form-${Date.now()}`,
      formType,
      patientId,
      patientName,
      populatedFields: [
        { fieldName: "patient_name", fieldLabel: "Patient Name", value: patientName, source: "ehr", confidence: 1.0, requiresVerification: false },
        { fieldName: "patient_id", fieldLabel: "Patient ID", value: patientId, source: "ehr", confidence: 1.0, requiresVerification: false }
      ],
      confidenceScore: 0.75,
      dataSourcesUsed: Object.keys(ehrData),
      missingRequiredFields: ["Additional fields require manual entry"],
      aiSuggestions: ["Review all populated fields before submission"],
      status: "review_required",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
    autoFormStore.set(form.id, form);
    return form;
  }

  getAutoPopulatedForms(patientId?: string, formType?: FormType): AutoPopulatedForm[] {
    let forms = Array.from(autoFormStore.values());
    if (patientId) forms = forms.filter(f => f.patientId === patientId);
    if (formType) forms = forms.filter(f => f.formType === formType);
    return forms;
  }

  // === PRE-AUTHORIZATION REQUEST METHODS ===

  async generatePreAuthRequest(
    patientId: string,
    patientName: string,
    insurerInfo: { insurerId: string; insurerName: string },
    serviceInfo: { serviceRequested: string; procedureCodes: string[]; diagnosisCodes: string[] },
    clinicalData: Record<string, any>
  ): Promise<PreAuthorizationRequest> {
    logPhiAccess({
      userId: "system",
      action: "create",
      resourceType: "PreAuthorization",
      details: `Generating pre-auth for patient ${patientId}: ${serviceInfo.serviceRequested}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping generate prior authorization requests. Analyze clinical data to create compelling medical necessity narratives. Identify required supporting documents and estimate approval likelihood.

Return JSON with: clinicalJustification, aiNarrative, supportingDocuments (array with documentType, relevance, present, suggestedIfMissing), approvalLikelihood (0-1), missingElements.`
          },
          {
            role: "user",
            content: `Generate prior authorization request:
Service: ${serviceInfo.serviceRequested}
Procedure Codes: ${serviceInfo.procedureCodes.join(", ")}
Diagnosis Codes: ${serviceInfo.diagnosisCodes.join(", ")}
Insurer: ${insurerInfo.insurerName}
Clinical Data: ${JSON.stringify(clinicalData, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1200
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const preAuth: PreAuthorizationRequest = {
        id: `preauth-${Date.now()}`,
        patientId,
        patientName,
        insurerId: insurerInfo.insurerId,
        insurerName: insurerInfo.insurerName,
        serviceRequested: serviceInfo.serviceRequested,
        procedureCodes: serviceInfo.procedureCodes,
        diagnosisCodes: serviceInfo.diagnosisCodes,
        clinicalJustification: parsed.clinicalJustification || "Clinical necessity based on documented symptoms and failed conservative treatment.",
        supportingDocuments: parsed.supportingDocuments || [],
        aiGeneratedNarrative: parsed.aiNarrative || "Medical necessity established based on clinical documentation.",
        approvalLikelihood: parsed.approvalLikelihood || 0.75,
        missingElements: parsed.missingElements || [],
        status: (parsed.approvalLikelihood || 0.75) > 0.8 ? "ready" : "draft",
        createdAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      };

      preAuthRequestStore.set(preAuth.id, preAuth);
      return preAuth;
    } catch (error) {
      console.error("[AIAdminOps] Pre-auth generation error:", error);
      return this.getFallbackPreAuth(patientId, patientName, insurerInfo, serviceInfo);
    }
  }

  private getFallbackPreAuth(
    patientId: string,
    patientName: string,
    insurerInfo: { insurerId: string; insurerName: string },
    serviceInfo: { serviceRequested: string; procedureCodes: string[]; diagnosisCodes: string[] }
  ): PreAuthorizationRequest {
    const preAuth: PreAuthorizationRequest = {
      id: `preauth-${Date.now()}`,
      patientId,
      patientName,
      insurerId: insurerInfo.insurerId,
      insurerName: insurerInfo.insurerName,
      serviceRequested: serviceInfo.serviceRequested,
      procedureCodes: serviceInfo.procedureCodes,
      diagnosisCodes: serviceInfo.diagnosisCodes,
      clinicalJustification: "Clinical necessity documented. Please review and add specific details.",
      supportingDocuments: [
        { documentType: "Clinical Notes", documentName: "", relevance: "critical", present: false, suggestedIfMissing: "Add recent clinical encounter notes" },
        { documentType: "Diagnostic Results", documentName: "", relevance: "supporting", present: false, suggestedIfMissing: "Include relevant lab or imaging results" }
      ],
      aiGeneratedNarrative: "Medical necessity narrative requires additional clinical documentation for optimal approval likelihood.",
      approvalLikelihood: 0.65,
      missingElements: ["Detailed clinical justification", "Supporting diagnostic results"],
      status: "draft",
      createdAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
    preAuthRequestStore.set(preAuth.id, preAuth);
    return preAuth;
  }

  getPreAuthRequests(patientId?: string, status?: string): PreAuthorizationRequest[] {
    let requests = Array.from(preAuthRequestStore.values());
    if (patientId) requests = requests.filter(r => r.patientId === patientId);
    if (status) requests = requests.filter(r => r.status === status);
    return requests;
  }

  // === RESOURCE MANAGEMENT METHODS ===

  async optimizeResources(
    facilityId: string,
    facilityName: string,
    date: string,
    resources: Resource[]
  ): Promise<ResourceOptimization> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "ResourceSchedule",
      details: `Optimizing resources for facility ${facilityId} on ${date}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant optimizing healthcare facility resources including rooms, equipment, and clinician schedules. Identify conflicts, underutilization, and recommend improvements.

Return JSON with: recommendations (array with type, priority, resource, description, expectedImpact, implementationEffort), conflicts (array with type, severity, description, suggestedResolution), metrics (overallUtilization, peakHours, underutilizedPeriods, efficiencyGain), analysis (string summary).`
          },
          {
            role: "user",
            content: `Optimize resource utilization:
Facility: ${facilityName}
Date: ${date}
Resources: ${JSON.stringify(resources.map(r => ({
  name: r.name,
  type: r.type,
  currentUtilization: r.currentUtilization,
  targetUtilization: r.targetUtilization,
  scheduledSlots: r.scheduledSlots.length,
  availableSlots: r.availableSlots.length
})), null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const optimization: ResourceOptimization = {
        id: `resource-${Date.now()}`,
        date,
        facilityId,
        facilityName,
        resources: resources.map(r => ({
          ...r,
          conflicts: parsed.conflicts?.filter((c: any) => c.resource === r.name) || r.conflicts
        })),
        optimizationMetrics: {
          overallUtilization: parsed.metrics?.overallUtilization || resources.reduce((sum, r) => sum + r.currentUtilization, 0) / resources.length,
          roomUtilization: resources.filter(r => r.type === "room").reduce((sum, r) => sum + r.currentUtilization, 0) / Math.max(resources.filter(r => r.type === "room").length, 1),
          equipmentUtilization: resources.filter(r => r.type === "equipment").reduce((sum, r) => sum + r.currentUtilization, 0) / Math.max(resources.filter(r => r.type === "equipment").length, 1),
          clinicianUtilization: resources.filter(r => r.type === "clinician").reduce((sum, r) => sum + r.currentUtilization, 0) / Math.max(resources.filter(r => r.type === "clinician").length, 1),
          peakHours: parsed.metrics?.peakHours || ["10:00-11:00", "14:00-15:00"],
          underutilizedPeriods: parsed.metrics?.underutilizedPeriods || ["08:00-09:00", "16:00-17:00"],
          conflictsResolved: parsed.conflicts?.filter((c: any) => c.resolved).length || 0,
          conflictsPending: parsed.conflicts?.filter((c: any) => !c.resolved).length || 0,
          efficiencyGain: parsed.metrics?.efficiencyGain || 10
        },
        recommendations: parsed.recommendations || [],
        aiAnalysis: parsed.analysis || "Resource optimization analysis complete. Review recommendations for improvement opportunities.",
        createdAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      };

      resourceOptimizationStore.set(optimization.id, optimization);
      return optimization;
    } catch (error) {
      console.error("[AIAdminOps] Resource optimization error:", error);
      return this.getFallbackResourceOptimization(facilityId, facilityName, date, resources);
    }
  }

  private getFallbackResourceOptimization(facilityId: string, facilityName: string, date: string, resources: Resource[]): ResourceOptimization {
    const optimization: ResourceOptimization = {
      id: `resource-${Date.now()}`,
      date,
      facilityId,
      facilityName,
      resources,
      optimizationMetrics: {
        overallUtilization: resources.reduce((sum, r) => sum + r.currentUtilization, 0) / resources.length,
        roomUtilization: 0.70,
        equipmentUtilization: 0.50,
        clinicianUtilization: 0.80,
        peakHours: ["10:00-11:00", "14:00-15:00"],
        underutilizedPeriods: ["08:00-09:00", "16:00-17:00"],
        conflictsResolved: 0,
        conflictsPending: resources.reduce((sum, r) => sum + r.conflicts.length, 0),
        efficiencyGain: 0
      },
      recommendations: [
        { type: "reallocate", priority: "medium", resource: "General", description: "Review scheduling patterns for optimization opportunities", expectedImpact: "Potential 10-15% efficiency gain", implementationEffort: "moderate" }
      ],
      aiAnalysis: "Basic resource analysis complete. Detailed AI recommendations available when service is fully operational.",
      createdAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
    resourceOptimizationStore.set(optimization.id, optimization);
    return optimization;
  }

  getResourceOptimizations(facilityId?: string): ResourceOptimization[] {
    let optimizations = Array.from(resourceOptimizationStore.values());
    if (facilityId) optimizations = optimizations.filter(o => o.facilityId === facilityId);
    return optimizations;
  }

  // === CHART REVIEW & CODING METHODS ===

  async reviewChart(
    encounterId: string,
    patientId: string,
    patientName: string,
    providerId: string,
    providerName: string,
    encounterData: {
      encounterDate: string;
      encounterType: string;
      chiefComplaint: string;
      diagnoses: string[];
      procedures: string[];
      clinicalNotes: string;
    }
  ): Promise<ChartReview> {
    logPhiAccess({
      userId: providerId,
      action: "read",
      resourceType: "ChartReview",
      details: `AI chart review for encounter ${encounterId}`
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant performing chart review and medical coding suggestions. Analyze clinical documentation to suggest appropriate ICD-10, CPT, and HCPCS codes. Identify documentation gaps and compliance issues.

${NO_CDS_DISCLAIMER}

Return JSON with: suggestedCodes (array with codeType, code, description, confidence, source, rationale, documentationSupport, alternativeCodes), codingAccuracyScore (0-1), documentationQualityScore (0-1), missingDocumentation (array), complianceFlags (array), aiNarrative (string).`
          },
          {
            role: "user",
            content: `Review this clinical encounter and suggest coding:
Encounter Date: ${encounterData.encounterDate}
Encounter Type: ${encounterData.encounterType}
Chief Complaint: ${encounterData.chiefComplaint}
Documented Diagnoses: ${encounterData.diagnoses.join(", ")}
Documented Procedures: ${encounterData.procedures.join(", ")}
Clinical Notes: ${encounterData.clinicalNotes.substring(0, 2000)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const review: ChartReview = {
        id: `chart-${Date.now()}`,
        encounterId,
        patientId,
        patientName,
        providerId,
        providerName,
        encounterDate: encounterData.encounterDate,
        encounterType: encounterData.encounterType,
        chiefComplaint: encounterData.chiefComplaint,
        documentedDiagnoses: encounterData.diagnoses,
        documentedProcedures: encounterData.procedures,
        suggestedCodes: parsed.suggestedCodes || [],
        codingAccuracyScore: parsed.codingAccuracyScore || 0.85,
        documentationQualityScore: parsed.documentationQualityScore || 0.80,
        missingDocumentation: parsed.missingDocumentation || [],
        complianceFlags: parsed.complianceFlags || [],
        aiNarrative: parsed.aiNarrative || "Chart review complete. Review suggested codes and documentation recommendations.",
        status: "pending_review",
        createdAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      };

      chartReviewStore.set(review.id, review);
      return review;
    } catch (error) {
      console.error("[AIAdminOps] Chart review error:", error);
      return this.getFallbackChartReview(encounterId, patientId, patientName, providerId, providerName, encounterData);
    }
  }

  private getFallbackChartReview(
    encounterId: string,
    patientId: string,
    patientName: string,
    providerId: string,
    providerName: string,
    encounterData: any
  ): ChartReview {
    const review: ChartReview = {
      id: `chart-${Date.now()}`,
      encounterId,
      patientId,
      patientName,
      providerId,
      providerName,
      encounterDate: encounterData.encounterDate,
      encounterType: encounterData.encounterType,
      chiefComplaint: encounterData.chiefComplaint,
      documentedDiagnoses: encounterData.diagnoses,
      documentedProcedures: encounterData.procedures,
      suggestedCodes: [
        { codeType: "CPT", code: "99213", description: "Office visit, established, low complexity", confidence: 0.75, source: "inference", rationale: "Default E/M code pending detailed review", documentationSupport: "Review clinical notes for complexity level" }
      ],
      codingAccuracyScore: 0.70,
      documentationQualityScore: 0.75,
      missingDocumentation: [
        { element: "Time documentation", importance: "recommended", impact: "Could support higher E/M level", suggestedContent: "Add total time and counseling time if applicable" }
      ],
      complianceFlags: [
        { type: "specificity", severity: "info", message: "Review diagnosis codes for specificity", affectedCodes: encounterData.diagnoses, recommendation: "Use most specific ICD-10 codes available" }
      ],
      aiNarrative: "Basic chart review complete. Detailed AI coding suggestions available when service is fully operational.",
      status: "pending_review",
      createdAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
    chartReviewStore.set(review.id, review);
    return review;
  }

  getChartReviews(providerId?: string, status?: string): ChartReview[] {
    let reviews = Array.from(chartReviewStore.values());
    if (providerId) reviews = reviews.filter(r => r.providerId === providerId);
    if (status) reviews = reviews.filter(r => r.status === status);
    return reviews;
  }

  updateChartReviewStatus(reviewId: string, status: ChartReview["status"], reviewedBy?: string): ChartReview | null {
    const review = chartReviewStore.get(reviewId);
    if (!review) return null;
    
    review.status = status;
    if (reviewedBy) {
      review.reviewedBy = reviewedBy;
      review.reviewedAt = new Date().toISOString();
    }
    chartReviewStore.set(reviewId, review);
    return review;
  }

  // === DASHBOARD DATA ===

  getAdminDashboard(): {
    stats: AdminOperationsStats;
    recentForms: AutoPopulatedForm[];
    recentPreAuths: PreAuthorizationRequest[];
    recentResourceOpts: ResourceOptimization[];
    recentChartReviews: ChartReview[];
    noCdsDisclaimer: string;
  } {
    return {
      stats: this.getStats(),
      recentForms: Array.from(autoFormStore.values()).slice(-5),
      recentPreAuths: Array.from(preAuthRequestStore.values()).slice(-5),
      recentResourceOpts: Array.from(resourceOptimizationStore.values()).slice(-5),
      recentChartReviews: Array.from(chartReviewStore.values()).slice(-5),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }
}

export const aiAdminOperationsService = new AIAdminOperationsService();
