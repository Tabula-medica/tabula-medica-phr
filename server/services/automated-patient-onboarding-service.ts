import { randomUUID } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `DISCLAIMER: This onboarding system is for INFORMATIONAL AND ADMINISTRATIVE PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.`;

export interface PatientRegistration {
  id: string;
  status: "started" | "demographics_complete" | "medical_history_complete" | "appointment_scheduled" | "completed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  demographics?: PatientDemographics;
  medicalHistory?: MedicalHistory;
  scheduledAppointment?: ScheduledAppointment;
  fhirPrefillApplied: boolean;
  fhirSourceId?: string;
  onboardingScore?: number;
}

export interface PatientDemographics {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  preferredLanguage: string;
  insuranceProvider?: string;
  insuranceMemberId?: string;
}

export interface MedicalHistory {
  conditions: ConditionEntry[];
  allergies: AllergyEntry[];
  medications: MedicationEntry[];
  surgeries: SurgeryEntry[];
  familyHistory: FamilyHistoryEntry[];
  socialHistory?: {
    smokingStatus: string;
    alcoholUse: string;
    exerciseFrequency: string;
  };
}

export interface ConditionEntry {
  id: string;
  name: string;
  diagnosisDate?: string;
  status: "active" | "resolved" | "managed";
  severity?: "mild" | "moderate" | "severe";
  source: "patient_reported" | "fhir_imported";
}

export interface AllergyEntry {
  id: string;
  allergen: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  source: "patient_reported" | "fhir_imported";
}

export interface MedicationEntry {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  prescribedBy?: string;
  startDate?: string;
  source: "patient_reported" | "fhir_imported";
}

export interface SurgeryEntry {
  id: string;
  procedure: string;
  date?: string;
  hospital?: string;
  source: "patient_reported" | "fhir_imported";
}

export interface FamilyHistoryEntry {
  id: string;
  condition: string;
  relationship: string;
  source: "patient_reported" | "fhir_imported";
}

export interface ScheduledAppointment {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  scheduledAt: string;
  duration: number;
  type: "initial_consultation" | "wellness_check" | "telehealth_intro";
  isTelehealth: boolean;
  telehealthUrl?: string;
  facilityName?: string;
  facilityAddress?: string;
  preVisitInstructions?: string;
  confirmationSent: boolean;
}

export interface AvailableTimeSlot {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  startTime: string;
  endTime: string;
  duration: number;
  isTelehealth: boolean;
  facilityName?: string;
}

export interface AvailableProvider {
  id: string;
  name: string;
  specialty: string;
  bio?: string;
  acceptingNewPatients: boolean;
  telehealthAvailable: boolean;
  inPersonAvailable: boolean;
  rating?: number;
  nextAvailable: string;
}

export interface FHIRPrefillData {
  patientId: string;
  sourceSystem: string;
  demographics?: Partial<PatientDemographics>;
  conditions?: ConditionEntry[];
  allergies?: AllergyEntry[];
  medications?: MedicationEntry[];
  lastUpdated: string;
}

export interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  stepsCompleted: string[];
  nextStep: string;
  estimatedTimeRemaining: number;
}

const registrations = new Map<string, PatientRegistration>();
const availableProviders: AvailableProvider[] = [
  {
    id: "prov-001",
    name: "Dr. Sarah Johnson",
    specialty: "Internal Medicine",
    bio: "Board-certified internist with 15 years of experience in preventive care and chronic disease management.",
    acceptingNewPatients: true,
    telehealthAvailable: true,
    inPersonAvailable: true,
    rating: 4.8,
    nextAvailable: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "prov-002",
    name: "Dr. Michael Chen",
    specialty: "Family Medicine",
    bio: "Family medicine physician focused on comprehensive care for patients of all ages.",
    acceptingNewPatients: true,
    telehealthAvailable: true,
    inPersonAvailable: true,
    rating: 4.9,
    nextAvailable: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "prov-003",
    name: "Dr. Emily Rodriguez",
    specialty: "Primary Care",
    bio: "Primary care specialist with expertise in women's health and preventive medicine.",
    acceptingNewPatients: true,
    telehealthAvailable: true,
    inPersonAvailable: false,
    rating: 4.7,
    nextAvailable: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const fhirPatientData: Map<string, FHIRPrefillData> = new Map([
  ["fhir-patient-001", {
    patientId: "fhir-patient-001",
    sourceSystem: "Primary Care Provider",
    demographics: {
      firstName: "John",
      lastName: "Smith",
      dateOfBirth: "1975-06-15",
      gender: "Male",
      phone: "(555) 123-4567",
      email: "j.smith@email.com",
      address: {
        street: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701"
      },
      preferredLanguage: "English"
    },
    conditions: [
      { id: "cond-001", name: "Essential Hypertension", status: "active", severity: "moderate", source: "fhir_imported" },
      { id: "cond-002", name: "Type 2 Diabetes Mellitus", status: "active", severity: "moderate", source: "fhir_imported" }
    ],
    allergies: [
      { id: "allergy-001", allergen: "Penicillin", reaction: "Hives", severity: "high" as any, source: "fhir_imported" }
    ],
    medications: [
      { id: "med-001", name: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", source: "fhir_imported" },
      { id: "med-002", name: "Lisinopril 10mg", dosage: "10mg", frequency: "Once daily", source: "fhir_imported" }
    ],
    lastUpdated: new Date().toISOString()
  }],
  ["fhir-patient-002", {
    patientId: "fhir-patient-002",
    sourceSystem: "Hospital Network",
    demographics: {
      firstName: "Sarah",
      lastName: "Johnson",
      dateOfBirth: "1988-09-22",
      gender: "Female",
      phone: "(555) 987-6543",
      email: "sarah.j@email.com",
      preferredLanguage: "English"
    },
    conditions: [
      { id: "cond-003", name: "Asthma", status: "managed", severity: "mild", source: "fhir_imported" }
    ],
    allergies: [
      { id: "allergy-002", allergen: "Shellfish", reaction: "Swelling", severity: "moderate", source: "fhir_imported" }
    ],
    medications: [
      { id: "med-003", name: "Albuterol Inhaler", dosage: "90mcg", frequency: "As needed", source: "fhir_imported" }
    ],
    lastUpdated: new Date().toISOString()
  }]
]);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateTimeSlots(providerId: string, provider: AvailableProvider, days: number = 7): AvailableTimeSlot[] {
  const slots: AvailableTimeSlot[] = [];
  const now = new Date();
  
  for (let day = 1; day <= days; day++) {
    const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const hours = [9, 10, 11, 14, 15, 16];
    for (const hour of hours) {
      if (Math.random() > 0.6) continue;
      
      const startTime = new Date(date);
      startTime.setHours(hour, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(30);
      
      slots.push({
        id: generateId("slot"),
        providerId,
        providerName: provider.name,
        providerSpecialty: provider.specialty,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: 30,
        isTelehealth: provider.telehealthAvailable && Math.random() > 0.5,
        facilityName: provider.inPersonAvailable ? "City Health Center" : undefined
      });
    }
  }
  
  return slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function startOnboarding(userId: string): PatientRegistration {
  const registration: PatientRegistration = {
    id: generateId("onboard"),
    status: "started",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fhirPrefillApplied: false
  };
  
  registrations.set(registration.id, registration);
  
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "PatientOnboarding",
    resourceId: registration.id,
    details: "Started new patient onboarding flow"
  });
  
  return registration;
}

export function getOnboardingStatus(registrationId: string, userId: string): PatientRegistration | null {
  const registration = registrations.get(registrationId);
  
  if (registration) {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientOnboarding",
      resourceId: registrationId,
      details: "Retrieved onboarding status"
    });
  }
  
  return registration || null;
}

export function getOnboardingProgress(registrationId: string): OnboardingProgress | null {
  const registration = registrations.get(registrationId);
  if (!registration) return null;
  
  const steps = ["welcome", "connect_data", "demographics", "medical_history", "schedule", "complete"];
  let currentStep = 1; // Start at connect_data (step 1) after registration
  const stepsCompleted: string[] = ["welcome"]; // Welcome is complete since they started
  
  if (registration.fhirPrefillApplied || registration.demographics) {
    stepsCompleted.push("connect_data");
    currentStep = 2;
  }
  if (registration.demographics) {
    stepsCompleted.push("demographics");
    currentStep = 3;
  }
  if (registration.medicalHistory) {
    stepsCompleted.push("medical_history");
    currentStep = 4;
  }
  if (registration.scheduledAppointment) {
    stepsCompleted.push("schedule");
    currentStep = 5;
  }
  if (registration.status === "completed") {
    stepsCompleted.push("complete");
  }
  
  return {
    currentStep,
    totalSteps: 6,
    stepsCompleted,
    nextStep: steps[currentStep] || "complete",
    estimatedTimeRemaining: Math.max(0, (6 - stepsCompleted.length) * 2)
  };
}

export function getFHIRPrefillData(fhirPatientId: string, userId: string): FHIRPrefillData | null {
  const data = fhirPatientData.get(fhirPatientId);
  
  if (data) {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRPrefillData",
      resourceId: fhirPatientId,
      patientId: fhirPatientId,
      details: "Retrieved FHIR data for onboarding pre-fill"
    });
  }
  
  return data || null;
}

export function getAvailableFHIRSources(): Array<{ id: string; name: string; system: string }> {
  return Array.from(fhirPatientData.entries()).map(([id, data]) => ({
    id,
    name: `${data.demographics?.firstName || "Unknown"} ${data.demographics?.lastName || "Patient"}`,
    system: data.sourceSystem
  }));
}

export function saveDemographics(
  registrationId: string,
  demographics: PatientDemographics,
  userId: string,
  fhirSourceId?: string
): PatientRegistration | null {
  const registration = registrations.get(registrationId);
  if (!registration) return null;
  
  registration.demographics = demographics;
  registration.status = "demographics_complete";
  registration.updatedAt = new Date().toISOString();
  
  if (fhirSourceId) {
    registration.fhirPrefillApplied = true;
    registration.fhirSourceId = fhirSourceId;
  }
  
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "PatientDemographics",
    resourceId: registrationId,
    details: `Saved demographics - FHIR prefill: ${!!fhirSourceId}`
  });
  
  return registration;
}

export function saveMedicalHistory(
  registrationId: string,
  medicalHistory: MedicalHistory,
  userId: string
): PatientRegistration | null {
  const registration = registrations.get(registrationId);
  if (!registration) return null;
  
  registration.medicalHistory = medicalHistory;
  registration.status = "medical_history_complete";
  registration.updatedAt = new Date().toISOString();
  
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "PatientMedicalHistory",
    resourceId: registrationId,
    details: `Saved medical history - ${medicalHistory.conditions.length} conditions, ${medicalHistory.medications.length} medications`
  });
  
  return registration;
}

export function getAvailableProviders(userId: string): AvailableProvider[] {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "ProviderList",
    details: "Retrieved available providers for appointment scheduling"
  });
  
  return availableProviders.filter(p => p.acceptingNewPatients);
}

export function getAvailableTimeSlots(
  providerId: string,
  userId: string,
  telehealthOnly: boolean = false
): AvailableTimeSlot[] {
  const provider = availableProviders.find(p => p.id === providerId);
  if (!provider) return [];
  
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "AppointmentSlots",
    resourceId: providerId,
    details: `Retrieved time slots for ${provider.name} - telehealthOnly: ${telehealthOnly}`
  });
  
  let slots = generateTimeSlots(providerId, provider);
  
  if (telehealthOnly) {
    slots = slots.filter(s => s.isTelehealth);
  }
  
  return slots;
}

export function scheduleFirstAppointment(
  registrationId: string,
  slotId: string,
  appointmentType: "initial_consultation" | "wellness_check" | "telehealth_intro",
  userId: string
): PatientRegistration | null {
  const registration = registrations.get(registrationId);
  if (!registration) return null;
  
  const provider = availableProviders.find(p => 
    generateTimeSlots(p.id, p).some(s => s.id === slotId)
  );
  
  if (!provider) {
    const defaultProvider = availableProviders[0];
    const slots = generateTimeSlots(defaultProvider.id, defaultProvider);
    const slot = slots[0];
    
    if (!slot) return null;
    
    const appointment: ScheduledAppointment = {
      id: generateId("apt"),
      providerId: defaultProvider.id,
      providerName: defaultProvider.name,
      providerSpecialty: defaultProvider.specialty,
      scheduledAt: slot.startTime,
      duration: slot.duration,
      type: appointmentType,
      isTelehealth: slot.isTelehealth,
      telehealthUrl: slot.isTelehealth ? `https://telehealth.tabulamedica.com/room/${generateId("room")}` : undefined,
      facilityName: slot.facilityName,
      facilityAddress: slot.facilityName ? "123 Medical Drive, Suite 200" : undefined,
      preVisitInstructions: getPreVisitInstructions(appointmentType, slot.isTelehealth),
      confirmationSent: true
    };
    
    registration.scheduledAppointment = appointment;
    registration.status = "appointment_scheduled";
    registration.updatedAt = new Date().toISOString();
    
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ScheduledAppointment",
      resourceId: appointment.id,
      details: `Scheduled ${appointmentType} with ${defaultProvider.name} - telehealth: ${slot.isTelehealth}`
    });
    
    return registration;
  }
  
  return registration;
}

function getPreVisitInstructions(type: string, isTelehealth: boolean): string {
  const baseInstructions = {
    initial_consultation: "Please bring a list of all current medications, recent lab results, and any health concerns you'd like to discuss.",
    wellness_check: "This is a general health assessment. Please be prepared to discuss your lifestyle, diet, and any changes in your health.",
    telehealth_intro: "This introductory visit will help us understand your health needs and establish your care plan."
  };
  
  let instructions = baseInstructions[type as keyof typeof baseInstructions] || baseInstructions.initial_consultation;
  
  if (isTelehealth) {
    instructions += " For your telehealth visit, please ensure you have a stable internet connection, a quiet private space, and that your camera and microphone are working.";
  } else {
    instructions += " Please arrive 15 minutes early to complete any remaining paperwork.";
  }
  
  return instructions;
}

export function completeOnboarding(registrationId: string, userId: string): PatientRegistration | null {
  const registration = registrations.get(registrationId);
  if (!registration) return null;
  
  if (!registration.demographics || !registration.medicalHistory || !registration.scheduledAppointment) {
    return null;
  }
  
  registration.status = "completed";
  registration.completedAt = new Date().toISOString();
  registration.updatedAt = new Date().toISOString();
  registration.onboardingScore = calculateOnboardingScore(registration);
  
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "PatientOnboarding",
    resourceId: registrationId,
    details: `Completed onboarding - score: ${registration.onboardingScore}`
  });
  
  return registration;
}

function calculateOnboardingScore(registration: PatientRegistration): number {
  let score = 0;
  
  if (registration.demographics) {
    score += 25;
    if (registration.demographics.insuranceProvider) score += 5;
    if (registration.demographics.emergencyContact.phone) score += 5;
  }
  
  if (registration.medicalHistory) {
    score += 25;
    if (registration.medicalHistory.conditions.length > 0) score += 5;
    if (registration.medicalHistory.medications.length > 0) score += 5;
    if (registration.medicalHistory.allergies.length > 0) score += 5;
    if (registration.medicalHistory.socialHistory) score += 5;
  }
  
  if (registration.scheduledAppointment) {
    score += 20;
    if (registration.scheduledAppointment.confirmationSent) score += 5;
  }
  
  if (registration.fhirPrefillApplied) {
    score += 10;
  }
  
  return Math.min(100, score);
}

export async function generateAIWelcomeSummary(
  registrationId: string,
  userId: string
): Promise<string | null> {
  const registration = registrations.get(registrationId);
  if (!registration || !registration.demographics) return null;
  
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "PatientOnboarding",
    resourceId: registrationId,
    details: "Generate AI welcome summary"
  });
  
  const prompt = `Generate a brief, warm welcome message for a new patient named ${registration.demographics.firstName}. 
They have just completed onboarding and have an appointment scheduled${registration.scheduledAppointment ? ` with ${registration.scheduledAppointment.providerName}` : ""}.
${registration.medicalHistory?.conditions.length ? `They have ${registration.medicalHistory.conditions.length} health conditions being tracked.` : ""}
Keep the message under 100 words, friendly, and reassuring. Do not provide any medical advice.`;

  try {
    const content = await generatePhiSafeText({
      system: "You are a friendly healthcare administrative assistant. Generate warm, non-clinical welcome messages.",
      user: prompt,
      maxTokens: 200,
      temperature: 0.7,
    });

    return content || null;
  } catch (error) {
    console.error("[AutomatedOnboarding] AI summary error:", error);
    return `Welcome to Tabula Medica, ${registration.demographics.firstName}! We're excited to have you as part of our healthcare community. Your care team is ready to support your health journey.`;
  }
}

export function getOnboardingStats(): {
  totalRegistrations: number;
  completedOnboardings: number;
  avgCompletionScore: number;
  fhirPrefillRate: number;
  appointmentsScheduled: number;
} {
  const regs = Array.from(registrations.values());
  const completed = regs.filter(r => r.status === "completed");
  const withFhir = regs.filter(r => r.fhirPrefillApplied);
  const withAppts = regs.filter(r => r.scheduledAppointment);
  
  const avgScore = completed.length > 0
    ? completed.reduce((sum, r) => sum + (r.onboardingScore || 0), 0) / completed.length
    : 0;
  
  return {
    totalRegistrations: regs.length,
    completedOnboardings: completed.length,
    avgCompletionScore: Math.round(avgScore),
    fhirPrefillRate: regs.length > 0 ? Math.round((withFhir.length / regs.length) * 100) : 0,
    appointmentsScheduled: withAppts.length
  };
}

export { NO_CDS_DISCLAIMER };
