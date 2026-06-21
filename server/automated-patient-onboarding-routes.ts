import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  startOnboarding,
  getOnboardingStatus,
  getOnboardingProgress,
  getFHIRPrefillData,
  getAvailableFHIRSources,
  saveDemographics,
  saveMedicalHistory,
  getAvailableProviders,
  getAvailableTimeSlots,
  scheduleFirstAppointment,
  completeOnboarding,
  generateAIWelcomeSummary,
  getOnboardingStats,
  NO_CDS_DISCLAIMER,
  PatientDemographics,
  MedicalHistory
} from "./services/automated-patient-onboarding-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function createErrorResponse(error: string, details?: any) {
  return {
    error,
    details,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    res.json({
      name: "Automated Patient Onboarding",
      version: "1.0.0",
      description: "Secure patient registration with FHIR pre-fill and appointment scheduling",
      features: [
        "Secure patient registration",
        "FHIR data pre-population",
        "Demographics collection",
        "Medical history forms",
        "First appointment scheduling",
        "Telehealth integration",
        "AI welcome message",
        "HIPAA-compliant data handling"
      ],
      steps: [
        { id: 0, name: "Welcome", description: "Start your secure registration" },
        { id: 1, name: "Connect Data", description: "Import from existing EHR systems" },
        { id: 2, name: "Demographics", description: "Personal information and contact details" },
        { id: 3, name: "Medical History", description: "Health conditions, medications, allergies" },
        { id: 4, name: "Schedule", description: "Book your first appointment" },
        { id: 5, name: "Complete", description: "Review and confirm registration" }
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to get metadata"));
  }
});

router.get("/stats", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "OnboardingStats",
      details: "View onboarding statistics"
    });
    
    const stats = getOnboardingStats();
    
    res.json({
      stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Stats error:", error);
    res.status(500).json(createErrorResponse("Failed to get onboarding stats"));
  }
});

router.post("/start", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    const registration = startOnboarding(userId);
    
    res.json({
      registration,
      message: "Onboarding started successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Start error:", error);
    res.status(500).json(createErrorResponse("Failed to start onboarding"));
  }
});

const RegistrationIdParamSchema = z.string().min(1, "Registration ID is required");
const FhirPatientIdParamSchema = z.string().min(1, "FHIR Patient ID is required");
const ProviderIdParamSchema = z.string().min(1, "Provider ID is required");

router.get("/status/:registrationId", (req: Request, res: Response) => {
  try {
    const regIdValidation = RegistrationIdParamSchema.safeParse(req.params.registrationId);
    if (!regIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid registration ID", regIdValidation.error.errors));
    }
    
    const registrationId = regIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const registration = getOnboardingStatus(registrationId, userId);
    
    if (!registration) {
      return res.status(404).json(createErrorResponse("Registration not found"));
    }
    
    const progress = getOnboardingProgress(registrationId);
    
    res.json({
      registration,
      progress,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Status error:", error);
    res.status(500).json(createErrorResponse("Failed to get onboarding status"));
  }
});

router.get("/fhir-sources", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRSources",
      details: "List available FHIR sources for pre-fill"
    });
    
    const sources = getAvailableFHIRSources();
    
    res.json({
      sources,
      total: sources.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] FHIR sources error:", error);
    res.status(500).json(createErrorResponse("Failed to get FHIR sources"));
  }
});

router.get("/fhir-prefill/:fhirPatientId", (req: Request, res: Response) => {
  try {
    const fhirIdValidation = FhirPatientIdParamSchema.safeParse(req.params.fhirPatientId);
    if (!fhirIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid FHIR patient ID", fhirIdValidation.error.errors));
    }
    
    const fhirPatientId = fhirIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const prefillData = getFHIRPrefillData(fhirPatientId, userId);
    
    if (!prefillData) {
      return res.status(404).json(createErrorResponse("FHIR patient data not found"));
    }
    
    res.json({
      prefillData,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] FHIR prefill error:", error);
    res.status(500).json(createErrorResponse("Failed to get FHIR prefill data"));
  }
});

const DemographicsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1)
  }),
  emergencyContact: z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1)
  }),
  preferredLanguage: z.string().min(1),
  insuranceProvider: z.string().optional(),
  insuranceMemberId: z.string().optional()
});

const SaveDemographicsBodySchema = z.object({
  demographics: DemographicsSchema,
  fhirSourceId: z.string().optional()
});

router.post("/:registrationId/demographics", (req: Request, res: Response) => {
  try {
    const regIdValidation = RegistrationIdParamSchema.safeParse(req.params.registrationId);
    if (!regIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid registration ID", regIdValidation.error.errors));
    }
    
    const registrationId = regIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const validation = SaveDemographicsBodySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(createErrorResponse("Invalid demographics data", validation.error.errors));
    }
    
    const { demographics, fhirSourceId } = validation.data;
    
    const registration = saveDemographics(
      registrationId,
      demographics as PatientDemographics,
      userId,
      fhirSourceId
    );
    
    if (!registration) {
      return res.status(404).json(createErrorResponse("Registration not found"));
    }
    
    res.json({
      registration,
      message: "Demographics saved successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Save demographics error:", error);
    res.status(500).json(createErrorResponse("Failed to save demographics"));
  }
});

const ConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  diagnosisDate: z.string().optional(),
  status: z.enum(["active", "resolved", "managed"]),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  source: z.enum(["patient_reported", "fhir_imported"])
});

const AllergySchema = z.object({
  id: z.string(),
  allergen: z.string(),
  reaction: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe"]),
  source: z.enum(["patient_reported", "fhir_imported"])
});

const MedicationSchema = z.object({
  id: z.string(),
  name: z.string(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  prescribedBy: z.string().optional(),
  startDate: z.string().optional(),
  source: z.enum(["patient_reported", "fhir_imported"])
});

const SurgerySchema = z.object({
  id: z.string(),
  procedure: z.string(),
  date: z.string().optional(),
  hospital: z.string().optional(),
  source: z.enum(["patient_reported", "fhir_imported"])
});

const FamilyHistorySchema = z.object({
  id: z.string(),
  condition: z.string(),
  relationship: z.string(),
  source: z.enum(["patient_reported", "fhir_imported"])
});

const MedicalHistorySchema = z.object({
  conditions: z.array(ConditionSchema),
  allergies: z.array(AllergySchema),
  medications: z.array(MedicationSchema),
  surgeries: z.array(SurgerySchema),
  familyHistory: z.array(FamilyHistorySchema),
  socialHistory: z.object({
    smokingStatus: z.string(),
    alcoholUse: z.string(),
    exerciseFrequency: z.string()
  }).optional()
});

router.post("/:registrationId/medical-history", (req: Request, res: Response) => {
  try {
    const regIdValidation = RegistrationIdParamSchema.safeParse(req.params.registrationId);
    if (!regIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid registration ID", regIdValidation.error.errors));
    }
    
    const registrationId = regIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const validation = MedicalHistorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(createErrorResponse("Invalid medical history data", validation.error.errors));
    }
    
    const registration = saveMedicalHistory(
      registrationId,
      validation.data as MedicalHistory,
      userId
    );
    
    if (!registration) {
      return res.status(404).json(createErrorResponse("Registration not found"));
    }
    
    res.json({
      registration,
      message: "Medical history saved successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Save medical history error:", error);
    res.status(500).json(createErrorResponse("Failed to save medical history"));
  }
});

router.get("/providers", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    const providers = getAvailableProviders(userId);
    
    res.json({
      providers,
      total: providers.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Get providers error:", error);
    res.status(500).json(createErrorResponse("Failed to get providers"));
  }
});

const GetTimeSlotsQuerySchema = z.object({
  telehealthOnly: z.enum(["true", "false"]).optional()
});

router.get("/providers/:providerId/slots", (req: Request, res: Response) => {
  try {
    const provIdValidation = ProviderIdParamSchema.safeParse(req.params.providerId);
    if (!provIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid provider ID", provIdValidation.error.errors));
    }
    
    const providerId = provIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const queryValidation = GetTimeSlotsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid query parameters", queryValidation.error.errors));
    }
    
    const telehealthOnly = queryValidation.data.telehealthOnly === "true";
    
    const slots = getAvailableTimeSlots(providerId, userId, telehealthOnly);
    
    res.json({
      providerId,
      slots,
      total: slots.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Get slots error:", error);
    res.status(500).json(createErrorResponse("Failed to get time slots"));
  }
});

const ScheduleAppointmentSchema = z.object({
  slotId: z.string(),
  appointmentType: z.enum(["initial_consultation", "wellness_check", "telehealth_intro"])
});

router.post("/:registrationId/schedule-appointment", (req: Request, res: Response) => {
  try {
    const regIdValidation = RegistrationIdParamSchema.safeParse(req.params.registrationId);
    if (!regIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid registration ID", regIdValidation.error.errors));
    }
    
    const registrationId = regIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const validation = ScheduleAppointmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(createErrorResponse("Invalid appointment data", validation.error.errors));
    }
    
    const { slotId, appointmentType } = validation.data;
    
    const registration = scheduleFirstAppointment(registrationId, slotId, appointmentType, userId);
    
    if (!registration) {
      return res.status(404).json(createErrorResponse("Registration not found or scheduling failed"));
    }
    
    res.json({
      registration,
      message: "Appointment scheduled successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Schedule appointment error:", error);
    res.status(500).json(createErrorResponse("Failed to schedule appointment"));
  }
});

router.post("/:registrationId/complete", async (req: Request, res: Response) => {
  try {
    const regIdValidation = RegistrationIdParamSchema.safeParse(req.params.registrationId);
    if (!regIdValidation.success) {
      return res.status(400).json(createErrorResponse("Invalid registration ID", regIdValidation.error.errors));
    }
    
    const registrationId = regIdValidation.data;
    const userId = (req as any).userId || "anonymous";
    
    const registration = completeOnboarding(registrationId, userId);
    
    if (!registration) {
      return res.status(400).json(createErrorResponse("Cannot complete onboarding - missing required steps"));
    }
    
    const welcomeMessage = await generateAIWelcomeSummary(registrationId, userId);
    
    res.json({
      registration,
      welcomeMessage,
      message: "Onboarding completed successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AutomatedOnboarding] Complete error:", error);
    res.status(500).json(createErrorResponse("Failed to complete onboarding"));
  }
});

export default router;
