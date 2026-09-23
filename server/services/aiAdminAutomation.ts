import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import type { Patient, Appointment, Medication, MedicalRecord } from "@shared/schema";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  npi: string;
  department: string;
  email: string;
  phone: string;
  acceptingNewPatients: boolean;
}

function getPatientFullName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`;
}

export interface ScheduleOptimizationRequest {
  patientId: string;
  appointmentType: "new_patient" | "follow_up" | "procedure" | "urgent" | "telehealth" | "annual_wellness";
  preferredDays?: string[];
  preferredTimeOfDay?: "morning" | "afternoon" | "evening" | "any";
  providerId?: string;
  specialtyRequired?: string;
  urgencyLevel?: "routine" | "soon" | "urgent";
  estimatedDuration?: number;
}

export interface OptimizedScheduleSlot {
  id: string;
  providerId: string;
  providerName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  convenienceScore: number;
  providerAvailabilityScore: number;
  overallScore: number;
  reasoning: string;
  isOptimal: boolean;
  alternativeReasons?: string[];
}

export interface ScheduleOptimizationResult {
  patientId: string;
  requestType: string;
  recommendedSlots: OptimizedScheduleSlot[];
  aiInsights: {
    patientPreferenceMatch: string;
    providerLoadBalancing: string;
    urgencyConsideration: string;
    additionalSuggestions: string[];
  };
  generatedAt: string;
}

export interface PriorAuthRequest {
  id: string;
  patientId: string;
  patientName: string;
  insurerId: string;
  insurerName: string;
  procedureCode: string;
  procedureName: string;
  diagnosisCodes: string[];
  diagnosisDescriptions: string[];
  providerId: string;
  providerName: string;
  requestedDate: string;
  clinicalJustification: string;
  supportingDocuments: string[];
  status: "draft" | "submitted" | "pending_info" | "approved" | "denied" | "appealed";
  priority: "routine" | "urgent" | "emergent";
}

export interface PriorAuthGenerationResult {
  request: PriorAuthRequest;
  aiGeneratedContent: {
    clinicalNarrative: string;
    medicalNecessityStatement: string;
    supportingEvidence: string[];
    anticipatedQuestions: { question: string; suggestedResponse: string }[];
    approvalLikelihood: number;
    approvalLikelihoodReasoning: string;
    recommendedAttachments: string[];
    icd10Suggestions: { code: string; description: string }[];
    cptSuggestions: { code: string; description: string }[];
  };
  submissionReadiness: {
    isComplete: boolean;
    missingElements: string[];
    recommendations: string[];
  };
}

export interface PriorAuthStatusUpdate {
  requestId: string;
  currentStatus: string;
  lastUpdated: string;
  estimatedDecisionDate?: string;
  insurerNotes?: string;
  actionRequired?: {
    type: "additional_info" | "peer_review" | "appeal" | "none";
    description: string;
    deadline?: string;
  };
  aiRecommendation?: string;
  nextSteps: string[];
}

export interface VisitSummary {
  id: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  visitType: string;
  providerId: string;
  providerName: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: { code: string; description: string }[];
  medications: { name: string; dosage: string; instructions: string; isNew: boolean }[];
  followUp: {
    recommended: boolean;
    timeframe?: string;
    reason?: string;
  };
  patientInstructions: string;
  patientFriendlySummary: string;
}

export interface ReferralLetter {
  id: string;
  patientId: string;
  patientName: string;
  patientDOB: string;
  referringProviderId: string;
  referringProviderName: string;
  referringProviderContact: string;
  referredToSpecialty: string;
  referredToProvider?: string;
  urgency: "routine" | "urgent" | "emergent";
  reason: string;
  clinicalHistory: string;
  relevantFindings: string;
  currentMedications: string;
  allergies: string;
  specificQuestions: string[];
  attachedDocuments: string[];
  letterContent: string;
  generatedAt: string;
}

export interface IntakeFormField {
  id: string;
  type: "text" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "number" | "scale" | "conditional";
  label: string;
  description?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditionalLogic?: {
    showIf: { fieldId: string; operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan"; value: string | number };
  };
  section: string;
  order: number;
}

export interface AdaptiveIntakeForm {
  id: string;
  patientId: string;
  visitType: string;
  sections: {
    id: string;
    title: string;
    description: string;
    fields: IntakeFormField[];
    order: number;
  }[];
  aiPersonalization: {
    addedFields: { fieldId: string; reason: string }[];
    removedFields: { fieldId: string; reason: string }[];
    reorderedSections: { sectionId: string; reason: string }[];
    focusAreas: string[];
  };
  estimatedCompletionTime: number;
  generatedAt: string;
}

export interface IntakeFormResponse {
  formId: string;
  patientId: string;
  responses: { fieldId: string; value: string | string[] | number | boolean }[];
  completedAt: string;
  aiAnalysis?: {
    flaggedResponses: { fieldId: string; concern: string; recommendation: string }[];
    suggestedFollowUpQuestions: string[];
    riskIndicators: string[];
    priorityForProvider: "routine" | "attention_needed" | "urgent";
  };
}

export interface AiAdminCallerContext {
  userId: string;
  role: string;
}

async function assertCallerAuthorized(callerCtx: AiAdminCallerContext, patientId: string): Promise<void> {
  if (callerCtx.role === "admin") return;
  const grants = await storage.getAccessGrants({ userId: callerCtx.userId, patientId, isActive: true });
  const now = new Date();
  const validGrant = grants.find(g => !g.expiresAt || new Date(g.expiresAt) > now);
  if (!validGrant) {
    throw new Error(`UNAUTHORIZED: caller ${callerCtx.userId} (role=${callerCtx.role}) has no active access grant for patient ${patientId}`);
  }
}

async function getPatientContext(patientId: string, callerCtx: AiAdminCallerContext) {
  await assertCallerAuthorized(callerCtx, patientId);
  const [patient, records, medications, appointments] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
  ]);
  
  const patientAppointments = appointments.filter(a => a.patientId === patientId);
  const conditions = records.filter(r => r.type === "diagnosis" && r.status === "active");
  
  return { patient, conditions, medications, appointments: patientAppointments, records };
}

async function getProviders(): Promise<Provider[]> {
  return [
    { id: "prov_001", name: "Dr. Sarah Chen", specialty: "Internal Medicine", npi: "1234567890", department: "Primary Care", email: "schen@tabulamedica.com", phone: "555-0101", acceptingNewPatients: true },
    { id: "prov_002", name: "Dr. Michael Roberts", specialty: "Cardiology", npi: "2345678901", department: "Cardiology", email: "mroberts@tabulamedica.com", phone: "555-0102", acceptingNewPatients: true },
    { id: "prov_003", name: "Dr. Emily Watson", specialty: "Endocrinology", npi: "3456789012", department: "Endocrinology", email: "ewatson@tabulamedica.com", phone: "555-0103", acceptingNewPatients: false },
    { id: "prov_004", name: "Dr. James Park", specialty: "Family Medicine", npi: "4567890123", department: "Primary Care", email: "jpark@tabulamedica.com", phone: "555-0104", acceptingNewPatients: true },
    { id: "prov_005", name: "Dr. Lisa Thompson", specialty: "Pulmonology", npi: "5678901234", department: "Pulmonology", email: "lthompson@tabulamedica.com", phone: "555-0105", acceptingNewPatients: true },
  ];
}

export async function optimizeSchedule(request: ScheduleOptimizationRequest, callerCtx: AiAdminCallerContext): Promise<ScheduleOptimizationResult> {
  console.log(`[AI Admin] Optimizing schedule for patient: ${request.patientId}, type: ${request.appointmentType}`);
  
  const [context, providers, allAppointments] = await Promise.all([
    getPatientContext(request.patientId, callerCtx),
    getProviders(),
    storage.getAppointments(),
  ]);

  const relevantProviders = request.specialtyRequired 
    ? providers.filter(p => p.specialty.toLowerCase().includes(request.specialtyRequired!.toLowerCase()))
    : providers;

  const appointmentTypeInfo = {
    new_patient: { duration: 60, urgency: "routine" },
    follow_up: { duration: 30, urgency: "routine" },
    procedure: { duration: 90, urgency: "soon" },
    urgent: { duration: 30, urgency: "urgent" },
    telehealth: { duration: 20, urgency: "routine" },
    annual_wellness: { duration: 45, urgency: "routine" },
  };

  const typeInfo = appointmentTypeInfo[request.appointmentType] || { duration: 30, urgency: "routine" };
  const duration = request.estimatedDuration || typeInfo.duration;

  try {
    const prompt = `You are a healthcare scheduling optimization AI. Generate optimal appointment slots based on the following:

PATIENT INFORMATION:
- Patient ID: ${request.patientId}
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- Age: ${context.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}
- Active Conditions: ${context.conditions.map(c => c.title).join(", ") || "None listed"}
- Current Medications: ${context.medications.length} active medications

APPOINTMENT REQUEST:
- Type: ${request.appointmentType}
- Estimated Duration: ${duration} minutes
- Urgency: ${request.urgencyLevel || typeInfo.urgency}
- Preferred Days: ${request.preferredDays?.join(", ") || "Any weekday"}
- Preferred Time: ${request.preferredTimeOfDay || "Any time"}
- Required Specialty: ${request.specialtyRequired || "Primary Care"}

AVAILABLE PROVIDERS:
${relevantProviders.map(p => `- ${p.name} (${p.specialty}) - ${p.acceptingNewPatients ? "Accepting new patients" : "Existing patients only"}`).join("\n")}

CURRENT SCHEDULE LOAD (next 7 days):
${relevantProviders.map(p => {
  const provAppts = allAppointments.filter(a => a.provider === p.name);
  return `- ${p.name}: ${provAppts.length} appointments scheduled`;
}).join("\n")}

Generate 5 optimal appointment slots for the next 14 days. Consider:
1. Patient convenience (preferred times/days)
2. Provider availability and workload balancing
3. Urgency of the appointment
4. Continuity of care (same provider if follow-up)

Return JSON:
{
  "slots": [
    {
      "providerId": "string",
      "providerName": "string",
      "specialty": "string",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "convenienceScore": 0-100,
      "providerAvailabilityScore": 0-100,
      "overallScore": 0-100,
      "reasoning": "string",
      "isOptimal": boolean
    }
  ],
  "insights": {
    "patientPreferenceMatch": "string",
    "providerLoadBalancing": "string",
    "urgencyConsideration": "string",
    "additionalSuggestions": ["string"]
  }
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const result = JSON.parse(responseText || "{}");

    const slots: OptimizedScheduleSlot[] = (result.slots || []).map((slot: any, index: number) => ({
      id: `slot_${Date.now()}_${index}`,
      providerId: slot.providerId || relevantProviders[0]?.id || "prov_001",
      providerName: slot.providerName || relevantProviders[0]?.name || "Dr. Provider",
      specialty: slot.specialty || request.specialtyRequired || "Primary Care",
      date: slot.date || new Date(Date.now() + (index + 1) * 86400000).toISOString().split("T")[0],
      startTime: slot.startTime || "09:00",
      endTime: slot.endTime || "09:30",
      duration,
      convenienceScore: slot.convenienceScore || 75,
      providerAvailabilityScore: slot.providerAvailabilityScore || 80,
      overallScore: slot.overallScore || 77,
      reasoning: slot.reasoning || "Available slot matching patient preferences",
      isOptimal: index === 0 || slot.isOptimal === true,
    }));

    return {
      patientId: request.patientId,
      requestType: request.appointmentType,
      recommendedSlots: slots,
      aiInsights: {
        patientPreferenceMatch: result.insights?.patientPreferenceMatch || "Slots selected based on stated preferences",
        providerLoadBalancing: result.insights?.providerLoadBalancing || "Provider workloads considered for even distribution",
        urgencyConsideration: result.insights?.urgencyConsideration || `Scheduled with ${request.urgencyLevel || "routine"} urgency`,
        additionalSuggestions: result.insights?.additionalSuggestions || [],
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Admin] Schedule optimization error:", error);
    return getDefaultScheduleOptimization(request, relevantProviders, duration);
  }
}

function getDefaultScheduleOptimization(request: ScheduleOptimizationRequest, providers: Provider[], duration: number): ScheduleOptimizationResult {
  const baseDate = new Date();
  const slots: OptimizedScheduleSlot[] = [];
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i + 1);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);
    
    const provider = providers[i % providers.length] || providers[0];
    const hours = [9, 10, 11, 14, 15];
    const hour = hours[i % hours.length];
    
    slots.push({
      id: `slot_${Date.now()}_${i}`,
      providerId: provider?.id || "prov_001",
      providerName: provider?.name || "Dr. Provider",
      specialty: provider?.specialty || "Primary Care",
      date: date.toISOString().split("T")[0],
      startTime: `${hour.toString().padStart(2, "0")}:00`,
      endTime: `${hour.toString().padStart(2, "0")}:${duration.toString().padStart(2, "0")}`,
      duration,
      convenienceScore: 85 - i * 5,
      providerAvailabilityScore: 80 - i * 3,
      overallScore: 82 - i * 4,
      reasoning: i === 0 ? "Optimal slot based on availability and preferences" : "Alternative slot available",
      isOptimal: i === 0,
    });
  }

  return {
    patientId: request.patientId,
    requestType: request.appointmentType,
    recommendedSlots: slots,
    aiInsights: {
      patientPreferenceMatch: "Slots generated based on general availability",
      providerLoadBalancing: "Standard scheduling applied",
      urgencyConsideration: `Scheduled as ${request.urgencyLevel || "routine"}`,
      additionalSuggestions: ["Consider calling to confirm availability", "Telehealth may offer more flexibility"],
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function generatePriorAuthRequest(
  patientId: string,
  procedureCode: string,
  procedureName: string,
  diagnosisCodes: string[],
  providerId: string,
  callerCtx: AiAdminCallerContext
): Promise<PriorAuthGenerationResult> {
  console.log(`[AI Admin] Generating prior auth for patient: ${patientId}, procedure: ${procedureCode}`);

  const context = await getPatientContext(patientId, callerCtx);
  const providers = await getProviders();
  const provider = providers.find(p => p.id === providerId) || providers[0];

  try {
    const prompt = `You are a healthcare prior authorization specialist AI. Generate a comprehensive prior authorization request with clinical justification.

PATIENT INFORMATION:
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- DOB: ${context.patient?.dateOfBirth || "Unknown"}
- Insurance: Blue Cross Blue Shield (example)
- Member ID: ${context.patient?.id || patientId}

REQUESTED PROCEDURE:
- CPT Code: ${procedureCode}
- Procedure Name: ${procedureName}

DIAGNOSIS CODES:
${diagnosisCodes.map(d => `- ${d}`).join("\n")}

PATIENT MEDICAL HISTORY:
- Active Conditions: ${context.conditions.map(c => c.title).join(", ") || "None documented"}
- Current Medications: ${context.medications.map(m => `${m.name} ${m.dosage}`).join(", ") || "None listed"}
- Recent Lab Results: Available in patient chart

REQUESTING PROVIDER:
- Name: ${provider?.name || "Dr. Provider"}
- Specialty: ${provider?.specialty || "Primary Care"}
- NPI: ${provider?.npi || "1234567890"}

Generate a prior authorization request with strong clinical justification. Return JSON:
{
  "clinicalNarrative": "Detailed narrative explaining medical necessity (2-3 paragraphs)",
  "medicalNecessityStatement": "Concise statement of medical necessity",
  "supportingEvidence": ["Evidence point 1", "Evidence point 2", ...],
  "anticipatedQuestions": [
    {"question": "string", "suggestedResponse": "string"}
  ],
  "approvalLikelihood": 0-100,
  "approvalLikelihoodReasoning": "string",
  "recommendedAttachments": ["List of documents to attach"],
  "icd10Suggestions": [{"code": "string", "description": "string"}],
  "cptSuggestions": [{"code": "string", "description": "string"}]
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.4,
    });

    const aiContent = JSON.parse(responseText || "{}");

    const request: PriorAuthRequest = {
      id: `pa_${Date.now()}`,
      patientId,
      patientName: context.patient ? getPatientFullName(context.patient) : "Patient",
      insurerId: "ins_bcbs_001",
      insurerName: "Blue Cross Blue Shield",
      procedureCode,
      procedureName,
      diagnosisCodes,
      diagnosisDescriptions: diagnosisCodes.map(c => `Diagnosis for ${c}`),
      providerId,
      providerName: provider?.name || "Dr. Provider",
      requestedDate: new Date().toISOString().split("T")[0],
      clinicalJustification: aiContent.clinicalNarrative || "Clinical justification pending",
      supportingDocuments: aiContent.recommendedAttachments || [],
      status: "draft",
      priority: "routine",
    };

    return {
      request,
      aiGeneratedContent: {
        clinicalNarrative: aiContent.clinicalNarrative || "Clinical narrative not generated",
        medicalNecessityStatement: aiContent.medicalNecessityStatement || "Medical necessity statement pending",
        supportingEvidence: aiContent.supportingEvidence || [],
        anticipatedQuestions: aiContent.anticipatedQuestions || [],
        approvalLikelihood: aiContent.approvalLikelihood || 70,
        approvalLikelihoodReasoning: aiContent.approvalLikelihoodReasoning || "Standard approval likelihood",
        recommendedAttachments: aiContent.recommendedAttachments || ["Medical records", "Lab results"],
        icd10Suggestions: aiContent.icd10Suggestions || [],
        cptSuggestions: aiContent.cptSuggestions || [{ code: procedureCode, description: procedureName }],
      },
      submissionReadiness: {
        isComplete: true,
        missingElements: [],
        recommendations: ["Review clinical narrative before submission", "Attach relevant imaging if available"],
      },
    };
  } catch (error) {
    console.error("[AI Admin] Prior auth generation error:", error);
    return getDefaultPriorAuth(patientId, procedureCode, procedureName, diagnosisCodes, providerId, context, provider);
  }
}

function getDefaultPriorAuth(
  patientId: string,
  procedureCode: string,
  procedureName: string,
  diagnosisCodes: string[],
  providerId: string,
  context: any,
  provider: any
): PriorAuthGenerationResult {
  return {
    request: {
      id: `pa_${Date.now()}`,
      patientId,
      patientName: context.patient?.name || "Patient",
      insurerId: "ins_bcbs_001",
      insurerName: "Blue Cross Blue Shield",
      procedureCode,
      procedureName,
      diagnosisCodes,
      diagnosisDescriptions: diagnosisCodes.map(c => `Diagnosis for ${c}`),
      providerId,
      providerName: provider?.name || "Dr. Provider",
      requestedDate: new Date().toISOString().split("T")[0],
      clinicalJustification: `Prior authorization requested for ${procedureName} due to medical necessity based on patient diagnosis and clinical presentation.`,
      supportingDocuments: ["Medical records", "Recent lab results"],
      status: "draft",
      priority: "routine",
    },
    aiGeneratedContent: {
      clinicalNarrative: `This prior authorization request is for ${procedureName} (CPT: ${procedureCode}) for the above-named patient. The patient presents with conditions that necessitate this procedure for appropriate diagnosis and treatment.`,
      medicalNecessityStatement: `${procedureName} is medically necessary for accurate diagnosis and treatment planning.`,
      supportingEvidence: ["Clinical examination findings", "Failed conservative treatment", "Specialist recommendation"],
      anticipatedQuestions: [
        { question: "Has conservative treatment been attempted?", suggestedResponse: "Yes, conservative measures were attempted with insufficient results." },
      ],
      approvalLikelihood: 75,
      approvalLikelihoodReasoning: "Standard procedure with documented medical necessity",
      recommendedAttachments: ["Medical records", "Lab results", "Imaging reports if available"],
      icd10Suggestions: diagnosisCodes.map(c => ({ code: c, description: `Diagnosis ${c}` })),
      cptSuggestions: [{ code: procedureCode, description: procedureName }],
    },
    submissionReadiness: {
      isComplete: false,
      missingElements: ["Provider signature", "Supporting documentation"],
      recommendations: ["Add specific clinical findings", "Include recent test results"],
    },
  };
}

export async function getPriorAuthStatus(requestId: string): Promise<PriorAuthStatusUpdate> {
  console.log(`[AI Admin] Checking prior auth status: ${requestId}`);
  
  const statuses = ["pending_review", "additional_info_requested", "under_clinical_review", "approved", "pending_peer_review"];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const estimatedDays = randomStatus === "approved" ? 0 : Math.floor(Math.random() * 5) + 1;
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

  return {
    requestId,
    currentStatus: randomStatus,
    lastUpdated: new Date().toISOString(),
    estimatedDecisionDate: randomStatus !== "approved" ? estimatedDate.toISOString().split("T")[0] : undefined,
    insurerNotes: randomStatus === "additional_info_requested" ? "Additional clinical documentation required" : undefined,
    actionRequired: randomStatus === "additional_info_requested" ? {
      type: "additional_info",
      description: "Please provide recent imaging results and specialist notes",
      deadline: estimatedDate.toISOString().split("T")[0],
    } : { type: "none", description: "No action required at this time" },
    aiRecommendation: randomStatus === "additional_info_requested" 
      ? "Upload the requested documents promptly to avoid delays"
      : "Request is progressing normally",
    nextSteps: randomStatus === "approved" 
      ? ["Schedule procedure", "Notify patient of approval"]
      : ["Monitor status", "Prepare additional documentation if requested"],
  };
}

export async function generateVisitSummary(
  patientId: string,
  visitDate: string,
  visitType: string,
  providerId: string,
  chiefComplaint: string,
  clinicalNotes: string,
  callerCtx: AiAdminCallerContext
): Promise<VisitSummary> {
  console.log(`[AI Admin] Generating visit summary for patient: ${patientId}, date: ${visitDate}`);

  const context = await getPatientContext(patientId, callerCtx);
  const providers = await getProviders();
  const provider = providers.find(p => p.id === providerId) || providers[0];

  try {
    const prompt = `You are a medical documentation AI assistant. Generate a comprehensive visit summary in SOAP format.

PATIENT INFORMATION:
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- DOB: ${context.patient?.dateOfBirth || "Unknown"}
- Age: ${context.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}

VISIT DETAILS:
- Date: ${visitDate}
- Type: ${visitType}
- Provider: ${provider?.name || "Dr. Provider"} (${provider?.specialty || "Primary Care"})
- Chief Complaint: ${chiefComplaint}

CLINICAL NOTES:
${clinicalNotes}

CURRENT MEDICATIONS:
${context.medications.map(m => `- ${m.name} ${m.dosage}`).join("\n") || "None listed"}

ACTIVE CONDITIONS:
${context.conditions.map(c => c.title).join(", ") || "None documented"}

Generate a complete visit summary. Return JSON:
{
  "subjective": "Patient's reported symptoms and history",
  "objective": "Physical examination and test findings",
  "assessment": "Clinical assessment and diagnoses",
  "plan": "Treatment plan and follow-up",
  "diagnoses": [{"code": "ICD-10 code", "description": "diagnosis description"}],
  "medications": [{"name": "string", "dosage": "string", "instructions": "string", "isNew": boolean}],
  "followUp": {"recommended": boolean, "timeframe": "string", "reason": "string"},
  "patientInstructions": "Clear instructions for the patient",
  "patientFriendlySummary": "Easy-to-understand summary in plain language (2-3 sentences)"
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.4,
    });

    const result = JSON.parse(responseText || "{}");

    return {
      id: `vs_${Date.now()}`,
      patientId,
      patientName: context.patient ? getPatientFullName(context.patient) : "Patient",
      visitDate,
      visitType,
      providerId,
      providerName: provider?.name || "Dr. Provider",
      chiefComplaint,
      subjective: result.subjective || "See clinical notes",
      objective: result.objective || "Physical examination performed",
      assessment: result.assessment || "Assessment documented",
      plan: result.plan || "Treatment plan established",
      diagnoses: result.diagnoses || [],
      medications: result.medications || context.medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        instructions: m.frequency || "As directed",
        isNew: false,
      })),
      followUp: result.followUp || { recommended: true, timeframe: "4-6 weeks", reason: "Routine follow-up" },
      patientInstructions: result.patientInstructions || "Follow prescribed treatment plan. Contact office if symptoms worsen.",
      patientFriendlySummary: result.patientFriendlySummary || `You visited ${provider?.name || "your doctor"} today for ${chiefComplaint}. Your treatment plan has been updated.`,
    };
  } catch (error) {
    console.error("[AI Admin] Visit summary generation error:", error);
    return getDefaultVisitSummary(patientId, visitDate, visitType, providerId, chiefComplaint, context, provider);
  }
}

function getDefaultVisitSummary(
  patientId: string,
  visitDate: string,
  visitType: string,
  providerId: string,
  chiefComplaint: string,
  context: any,
  provider: any
): VisitSummary {
  return {
    id: `vs_${Date.now()}`,
    patientId,
    patientName: context.patient?.name || "Patient",
    visitDate,
    visitType,
    providerId,
    providerName: provider?.name || "Dr. Provider",
    chiefComplaint,
    subjective: `Patient presents with ${chiefComplaint}. History and symptoms documented.`,
    objective: "Vital signs stable. Physical examination performed.",
    assessment: `Evaluation for ${chiefComplaint}. Clinical findings documented.`,
    plan: "Treatment plan established. Follow-up scheduled as needed.",
    diagnoses: [{ code: "Z00.00", description: "General examination" }],
    medications: context.medications.map((m: any) => ({
      name: m.name,
      dosage: m.dosage,
      instructions: m.frequency || "As directed",
      isNew: false,
    })),
    followUp: { recommended: true, timeframe: "As needed", reason: "Routine follow-up" },
    patientInstructions: "Continue current medications. Return if symptoms worsen or new concerns arise.",
    patientFriendlySummary: `You visited your doctor today for ${chiefComplaint}. Your care team will follow up with you as needed.`,
  };
}

export async function generateReferralLetter(
  patientId: string,
  referringProviderId: string,
  referredToSpecialty: string,
  reason: string,
  urgency: "routine" | "urgent" | "emergent",
  callerCtx: AiAdminCallerContext
): Promise<ReferralLetter> {
  console.log(`[AI Admin] Generating referral letter for patient: ${patientId} to ${referredToSpecialty}`);

  const context = await getPatientContext(patientId, callerCtx);
  const providers = await getProviders();
  const referringProvider = providers.find(p => p.id === referringProviderId) || providers[0];

  try {
    const prompt = `You are a medical referral specialist AI. Generate a professional referral letter.

PATIENT INFORMATION:
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- DOB: ${context.patient?.dateOfBirth || "Unknown"}
- Phone: ${context.patient?.phone || "On file"}

REFERRING PROVIDER:
- Name: ${referringProvider?.name || "Dr. Provider"}
- Specialty: ${referringProvider?.specialty || "Primary Care"}
- Contact: ${referringProvider?.phone || "555-0100"}

REFERRAL DETAILS:
- Referred To: ${referredToSpecialty}
- Urgency: ${urgency}
- Reason: ${reason}

PATIENT HISTORY:
- Active Conditions: ${context.conditions.map(c => c.title).join(", ") || "None documented"}
- Current Medications: ${context.medications.map(m => `${m.name} ${m.dosage}`).join(", ") || "None listed"}

Generate a professional referral letter. Return JSON:
{
  "clinicalHistory": "Summary of relevant medical history",
  "relevantFindings": "Recent findings relevant to the referral",
  "currentMedications": "List of current medications",
  "allergies": "Known allergies",
  "specificQuestions": ["Questions for the specialist"],
  "letterContent": "Full professional referral letter text (formal medical letter format)"
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const result = JSON.parse(responseText || "{}");

    return {
      id: `ref_${Date.now()}`,
      patientId,
      patientName: context.patient ? getPatientFullName(context.patient) : "Patient",
      patientDOB: context.patient?.dateOfBirth || "Unknown",
      referringProviderId,
      referringProviderName: referringProvider?.name || "Dr. Provider",
      referringProviderContact: referringProvider?.phone || "555-0100",
      referredToSpecialty,
      urgency,
      reason,
      clinicalHistory: result.clinicalHistory || "See attached medical records",
      relevantFindings: result.relevantFindings || "Clinical findings documented in chart",
      currentMedications: result.currentMedications || context.medications.map((m: any) => `${m.name} ${m.dosage}`).join(", "),
      allergies: result.allergies || "NKDA",
      specificQuestions: result.specificQuestions || ["Please evaluate and advise on treatment options"],
      attachedDocuments: ["Medical records", "Recent lab results"],
      letterContent: result.letterContent || getDefaultReferralLetter(context, referringProvider, referredToSpecialty, reason, urgency),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Admin] Referral letter generation error:", error);
    return getDefaultReferralLetterResult(patientId, referringProviderId, referredToSpecialty, reason, urgency, context, referringProvider);
  }
}

function getDefaultReferralLetter(context: any, provider: any, specialty: string, reason: string, urgency: string): string {
  return `Dear Colleague,

I am referring ${context.patient?.name || "this patient"} to your ${specialty} practice for ${reason}.

Patient Information:
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- Date of Birth: ${context.patient?.dateOfBirth || "On file"}

Reason for Referral:
${reason}

Current Medications:
${context.medications.map((m: any) => `- ${m.name} ${m.dosage}`).join("\n") || "See attached medication list"}

Active Medical Conditions:
${context.conditions.map((c: any) => `- ${c.title}`).join("\n") || "See attached medical records"}

This referral is ${urgency}. Please evaluate the patient and provide recommendations for ongoing management.

Thank you for your consultation.

Sincerely,
${provider?.name || "Referring Provider"}
${provider?.specialty || "Primary Care"}
${provider?.phone || "Contact on file"}`;
}

function getDefaultReferralLetterResult(
  patientId: string,
  referringProviderId: string,
  referredToSpecialty: string,
  reason: string,
  urgency: "routine" | "urgent" | "emergent",
  context: any,
  referringProvider: any
): ReferralLetter {
  return {
    id: `ref_${Date.now()}`,
    patientId,
    patientName: context.patient?.name || "Patient",
    patientDOB: context.patient?.dateOfBirth || "Unknown",
    referringProviderId,
    referringProviderName: referringProvider?.name || "Dr. Provider",
    referringProviderContact: referringProvider?.phone || "555-0100",
    referredToSpecialty,
    urgency,
    reason,
    clinicalHistory: "See attached medical records",
    relevantFindings: "Clinical findings documented in patient chart",
    currentMedications: context.medications.map((m: any) => `${m.name} ${m.dosage}`).join(", ") || "None listed",
    allergies: context.patient?.allergies?.join(", ") || "NKDA",
    specificQuestions: ["Please evaluate and provide treatment recommendations"],
    attachedDocuments: ["Medical records", "Recent lab results"],
    letterContent: getDefaultReferralLetter(context, referringProvider, referredToSpecialty, reason, urgency),
    generatedAt: new Date().toISOString(),
  };
}

export async function generateAdaptiveIntakeForm(
  patientId: string,
  visitType: string,
  callerCtx: AiAdminCallerContext
): Promise<AdaptiveIntakeForm> {
  console.log(`[AI Admin] Generating adaptive intake form for patient: ${patientId}, visit type: ${visitType}`);

  const context = await getPatientContext(patientId, callerCtx);

  const baseFields: IntakeFormField[] = [
    { id: "demographics_verify", type: "checkbox", label: "Please verify your contact information is correct", required: true, section: "demographics", order: 1 },
    { id: "insurance_changes", type: "radio", label: "Have there been any changes to your insurance since your last visit?", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], section: "demographics", order: 2 },
    { id: "chief_complaint", type: "textarea", label: "What is the main reason for your visit today?", required: true, section: "visit_reason", order: 1 },
    { id: "symptom_duration", type: "select", label: "How long have you been experiencing these symptoms?", required: false, options: [{ value: "today", label: "Started today" }, { value: "days", label: "A few days" }, { value: "week", label: "About a week" }, { value: "weeks", label: "Several weeks" }, { value: "month", label: "A month or more" }], section: "visit_reason", order: 2 },
    { id: "pain_scale", type: "scale", label: "If you are experiencing pain, rate it from 0 (no pain) to 10 (worst pain)", required: false, validation: { min: 0, max: 10 }, section: "visit_reason", order: 3 },
    { id: "medication_changes", type: "radio", label: "Have there been any changes to your medications?", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], section: "medications", order: 1 },
    { id: "medication_list", type: "textarea", label: "Please list any new medications or changes", required: false, conditionalLogic: { showIf: { fieldId: "medication_changes", operator: "equals", value: "yes" } }, section: "medications", order: 2 },
    { id: "allergy_changes", type: "radio", label: "Have you developed any new allergies?", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], section: "medications", order: 3 },
    { id: "new_allergies", type: "textarea", label: "Please describe any new allergies", required: false, conditionalLogic: { showIf: { fieldId: "allergy_changes", operator: "equals", value: "yes" } }, section: "medications", order: 4 },
    { id: "recent_hospitalizations", type: "radio", label: "Have you been hospitalized or visited an ER since your last visit?", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], section: "medical_history", order: 1 },
    { id: "hospitalization_details", type: "textarea", label: "Please provide details about the hospitalization", required: false, conditionalLogic: { showIf: { fieldId: "recent_hospitalizations", operator: "equals", value: "yes" } }, section: "medical_history", order: 2 },
  ];

  try {
    const prompt = `You are a healthcare intake form optimization AI. Customize the patient intake form based on the patient's profile and visit type.

PATIENT INFORMATION:
- Name: ${context.patient ? getPatientFullName(context.patient) : "Patient"}
- Age: ${context.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}

PATIENT CONDITIONS:
${context.conditions.map(c => `- ${c.title}`).join("\n") || "None documented"}

CURRENT MEDICATIONS:
${context.medications.map(m => `- ${m.name} (${m.dosage})`).join("\n") || "None listed"}

VISIT TYPE: ${visitType}

BASE FORM SECTIONS:
1. Demographics verification
2. Visit reason (chief complaint, symptoms)
3. Medications review
4. Medical history updates

Generate personalized additions to the intake form. Return JSON:
{
  "additionalFields": [
    {
      "id": "unique_field_id",
      "type": "text|textarea|select|radio|checkbox|number|scale",
      "label": "Question text",
      "description": "Optional helper text",
      "required": true|false,
      "section": "section_name",
      "order": number,
      "options": [{"value": "string", "label": "string"}],
      "reason": "Why this field was added"
    }
  ],
  "focusAreas": ["Areas of focus based on patient profile"],
  "estimatedTime": number (minutes)
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.4,
    });

    const result = JSON.parse(responseText || "{}");
    
    const additionalFields: IntakeFormField[] = (result.additionalFields || []).map((f: any, i: number) => ({
      id: f.id || `custom_${Date.now()}_${i}`,
      type: f.type || "text",
      label: f.label || "Additional question",
      description: f.description,
      required: f.required || false,
      options: f.options,
      section: f.section || "additional",
      order: f.order || 100 + i,
    }));

    const allFields = [...baseFields, ...additionalFields];
    
    const sections = Array.from(new Set(allFields.map(f => f.section))).map((sectionId, idx) => {
      const sectionLabels: Record<string, { title: string; description: string }> = {
        demographics: { title: "Your Information", description: "Verify your contact and insurance details" },
        visit_reason: { title: "Reason for Visit", description: "Tell us why you're here today" },
        medications: { title: "Medications", description: "Review your current medications" },
        medical_history: { title: "Medical History", description: "Recent health updates" },
        additional: { title: "Additional Questions", description: "Questions specific to your visit" },
        condition_specific: { title: "Condition-Specific", description: "Questions about your health conditions" },
      };
      
      return {
        id: sectionId,
        title: sectionLabels[sectionId]?.title || sectionId,
        description: sectionLabels[sectionId]?.description || "",
        fields: allFields.filter(f => f.section === sectionId).sort((a, b) => a.order - b.order),
        order: idx + 1,
      };
    });

    return {
      id: `intake_${Date.now()}`,
      patientId,
      visitType,
      sections,
      aiPersonalization: {
        addedFields: additionalFields.map(f => ({
          fieldId: f.id,
          reason: (result.additionalFields || []).find((af: any) => af.id === f.id)?.reason || "Personalized based on patient profile",
        })),
        removedFields: [],
        reorderedSections: [],
        focusAreas: result.focusAreas || ["General health screening"],
      },
      estimatedCompletionTime: result.estimatedTime || 5 + Math.floor(allFields.length / 3),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Admin] Intake form generation error:", error);
    return getDefaultIntakeForm(patientId, visitType, baseFields);
  }
}

function getDefaultIntakeForm(patientId: string, visitType: string, baseFields: IntakeFormField[]): AdaptiveIntakeForm {
  const sections = [
    {
      id: "demographics",
      title: "Your Information",
      description: "Verify your contact and insurance details",
      fields: baseFields.filter(f => f.section === "demographics"),
      order: 1,
    },
    {
      id: "visit_reason",
      title: "Reason for Visit",
      description: "Tell us why you're here today",
      fields: baseFields.filter(f => f.section === "visit_reason"),
      order: 2,
    },
    {
      id: "medications",
      title: "Medications",
      description: "Review your current medications",
      fields: baseFields.filter(f => f.section === "medications"),
      order: 3,
    },
    {
      id: "medical_history",
      title: "Medical History",
      description: "Recent health updates",
      fields: baseFields.filter(f => f.section === "medical_history"),
      order: 4,
    },
  ];

  return {
    id: `intake_${Date.now()}`,
    patientId,
    visitType,
    sections,
    aiPersonalization: {
      addedFields: [],
      removedFields: [],
      reorderedSections: [],
      focusAreas: ["Standard intake"],
    },
    estimatedCompletionTime: 5,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzeIntakeResponses(
  formId: string,
  patientId: string,
  responses: { fieldId: string; value: string | string[] | number | boolean }[],
  callerCtx: AiAdminCallerContext
): Promise<IntakeFormResponse> {
  console.log(`[AI Admin] Analyzing intake responses for form: ${formId}`);

  const context = await getPatientContext(patientId, callerCtx);

  try {
    const prompt = `You are a healthcare intake analysis AI. Analyze patient intake form responses and flag any concerns.

PATIENT INFORMATION:
- Age: ${context.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(context.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}
- Known Conditions: ${context.conditions.map(c => c.title).join(", ") || "None"}

FORM RESPONSES:
${responses.map(r => `- ${r.fieldId}: ${JSON.stringify(r.value)}`).join("\n")}

Analyze the responses and return JSON:
{
  "flaggedResponses": [
    {
      "fieldId": "string",
      "concern": "Description of concern",
      "recommendation": "Recommended action"
    }
  ],
  "suggestedFollowUpQuestions": ["Additional questions to ask"],
  "riskIndicators": ["Any risk factors identified"],
  "priorityForProvider": "routine|attention_needed|urgent"
}`;

    const responseText = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const analysis = JSON.parse(responseText || "{}");

    return {
      formId,
      patientId,
      responses,
      completedAt: new Date().toISOString(),
      aiAnalysis: {
        flaggedResponses: analysis.flaggedResponses || [],
        suggestedFollowUpQuestions: analysis.suggestedFollowUpQuestions || [],
        riskIndicators: analysis.riskIndicators || [],
        priorityForProvider: analysis.priorityForProvider || "routine",
      },
    };
  } catch (error) {
    console.error("[AI Admin] Intake analysis error:", error);
    return {
      formId,
      patientId,
      responses,
      completedAt: new Date().toISOString(),
      aiAnalysis: {
        flaggedResponses: [],
        suggestedFollowUpQuestions: [],
        riskIndicators: [],
        priorityForProvider: "routine",
      },
    };
  }
}
