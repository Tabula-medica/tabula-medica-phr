import { Router, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

interface ProfileData {
  fullName: string;
  dateOfBirth: string;
  sexAtBirth: string;
  genderIdentity: string;
  preferredLanguage: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  pregnancyStatus: string;
  primaryCareDoctor: string;
  preferredPharmacy: string;
  immunizations: string[];
}

interface EmergencyContactData {
  name: string;
  relationship: string;
  phone: string;
}

interface ConditionDetail {
  yearDiagnosed: string;
  status: string;
  treatment: string;
}

interface MedicalHistoryData {
  selectedConditions: string[];
  conditionDetails: Record<string, ConditionDetail>;
  otherDiagnosisText: string;
}

interface AllergyEntry {
  id: string;
  type: string;
  allergen: string;
  reactionType: string;
  severity: string;
  yearOfReaction: string;
  notSure: boolean;
}

interface AllergiesData {
  noKnownAllergies: boolean;
  allergies: AllergyEntry[];
}

interface FamilyHistoryEntry {
  id: string;
  conditionId: string;
  relative: string;
  ageAtDiagnosis: string;
}

interface FamilyHistoryData {
  entries: FamilyHistoryEntry[];
}

interface TobaccoData {
  status: string;
  types: string[];
  yearsUsed: string;
  amountPerDay: string;
  quitYear: string;
}

interface VapingData {
  status: string;
  substance: string;
  frequency: string;
}

interface AlcoholData {
  frequency: string;
  drinksPerWeek: string;
  pastHeavyUse: boolean;
}

interface DrugData {
  status: string;
  types: string[];
  frequencyAndLastUse: string;
}

interface SocialHistoryData {
  tobacco: TobaccoData;
  vaping: VapingData;
  alcohol: AlcoholData;
  drugs: DrugData;
}

interface MedicationEntry {
  id: string;
  category: string;
  name: string;
  dose: string;
  frequency: string;
  notSure: boolean;
}

interface MedicationsData {
  noCurrentMedications: boolean;
  medications: MedicationEntry[];
}

interface SurgeryEntry {
  id: string;
  name: string;
  year: string;
  notes: string;
}

interface SurgeriesData {
  noSurgeries: boolean;
  skipForNow: boolean;
  surgeries: SurgeryEntry[];
}

interface QuestionnaireSubmission {
  profile: ProfileData;
  emergencyContact: EmergencyContactData;
  medicalHistory: MedicalHistoryData;
  allergies: AllergiesData;
  medications: MedicationsData;
  surgeries: SurgeriesData;
  familyHistory: FamilyHistoryData;
  socialHistory: SocialHistoryData;
}

const questionnaireStorage = new Map<string, QuestionnaireSubmission>();

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const { profile, emergencyContact, medicalHistory, allergies, medications, surgeries, familyHistory, socialHistory } = req.body as QuestionnaireSubmission;

    if (!profile.fullName || !profile.dateOfBirth || !profile.preferredLanguage) {
      return res.status(400).json({
        success: false,
        error: "Missing required profile fields",
      });
    }

    if (!profile.heightFeet || !profile.heightInches || !profile.weight) {
      return res.status(400).json({
        success: false,
        error: "Height and weight are required",
      });
    }

    const submission: QuestionnaireSubmission = {
      profile: {
        fullName: profile.fullName,
        dateOfBirth: profile.dateOfBirth,
        sexAtBirth: profile.sexAtBirth || "",
        genderIdentity: profile.genderIdentity || "",
        preferredLanguage: profile.preferredLanguage,
        heightFeet: profile.heightFeet,
        heightInches: profile.heightInches,
        weight: profile.weight,
        pregnancyStatus: profile.pregnancyStatus || "",
        primaryCareDoctor: profile.primaryCareDoctor || "",
        preferredPharmacy: profile.preferredPharmacy || "",
        immunizations: profile.immunizations || [],
      },
      emergencyContact: {
        name: emergencyContact?.name || "",
        relationship: emergencyContact?.relationship || "",
        phone: emergencyContact?.phone || "",
      },
      medicalHistory: {
        selectedConditions: medicalHistory?.selectedConditions || [],
        conditionDetails: medicalHistory?.conditionDetails || {},
        otherDiagnosisText: medicalHistory?.otherDiagnosisText || "",
      },
      allergies: {
        noKnownAllergies: allergies?.noKnownAllergies || false,
        allergies: allergies?.allergies || [],
      },
      medications: {
        noCurrentMedications: medications?.noCurrentMedications || false,
        medications: medications?.medications || [],
      },
      surgeries: {
        noSurgeries: surgeries?.noSurgeries || false,
        skipForNow: surgeries?.skipForNow || false,
        surgeries: surgeries?.surgeries || [],
      },
      familyHistory: {
        entries: familyHistory?.entries || [],
      },
      socialHistory: {
        tobacco: {
          status: socialHistory?.tobacco?.status || "",
          types: socialHistory?.tobacco?.types || [],
          yearsUsed: socialHistory?.tobacco?.yearsUsed || "",
          amountPerDay: socialHistory?.tobacco?.amountPerDay || "",
          quitYear: socialHistory?.tobacco?.quitYear || "",
        },
        vaping: {
          status: socialHistory?.vaping?.status || "",
          substance: socialHistory?.vaping?.substance || "",
          frequency: socialHistory?.vaping?.frequency || "",
        },
        alcohol: {
          frequency: socialHistory?.alcohol?.frequency || "",
          drinksPerWeek: socialHistory?.alcohol?.drinksPerWeek || "",
          pastHeavyUse: socialHistory?.alcohol?.pastHeavyUse || false,
        },
        drugs: {
          status: socialHistory?.drugs?.status || "",
          types: socialHistory?.drugs?.types || [],
          frequencyAndLastUse: socialHistory?.drugs?.frequencyAndLastUse || "",
        },
      },
    };

    questionnaireStorage.set(userId, submission);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "health_questionnaire",
      resourceId: `questionnaire-${userId}`,
      details: "Health questionnaire submitted",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    res.json({
      success: true,
      message: "Health questionnaire saved successfully",
      data: {
        profileName: profile.fullName,
        hasEmergencyContact: !!emergencyContact?.name,
        conditionsCount: submission.medicalHistory.selectedConditions.length,
        allergiesCount: submission.allergies.noKnownAllergies ? 0 : submission.allergies.allergies.length,
        familyHistoryCount: submission.familyHistory.entries.length,
        medicationsCount: submission.medications.noCurrentMedications ? 0 : submission.medications.medications.length,
        hasSocialHistory: !!(socialHistory?.tobacco?.status || socialHistory?.vaping?.status || socialHistory?.alcohol?.frequency || socialHistory?.drugs?.status),
      },
    });
  } catch (error) {
    console.error("[HealthQuestionnaire] Error saving questionnaire:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save questionnaire",
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const submission = questionnaireStorage.get(userId);

    if (!submission) {
      return res.json({
        success: true,
        hasQuestionnaire: false,
        data: null,
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "health_questionnaire",
      resourceId: `questionnaire-${userId}`,
      details: "Health questionnaire retrieved",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    res.json({
      success: true,
      hasQuestionnaire: true,
      data: submission,
    });
  } catch (error) {
    console.error("[HealthQuestionnaire] Error retrieving questionnaire:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve questionnaire",
    });
  }
});

router.patch("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "current-user";
    const existing = questionnaireStorage.get(userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "No questionnaire found to update",
      });
    }

    const { profile, emergencyContact, medicalHistory, allergies, medications, surgeries, familyHistory, socialHistory } = req.body;

    const defaultSocialHistory: SocialHistoryData = {
      tobacco: { status: "", types: [], yearsUsed: "", amountPerDay: "", quitYear: "" },
      vaping: { status: "", substance: "", frequency: "" },
      alcohol: { frequency: "", drinksPerWeek: "", pastHeavyUse: false },
      drugs: { status: "", types: [], frequencyAndLastUse: "" },
    };

    const updated: QuestionnaireSubmission = {
      profile: { ...existing.profile, ...(profile || {}) },
      emergencyContact: { ...existing.emergencyContact, ...(emergencyContact || {}) },
      medicalHistory: medicalHistory ? {
        selectedConditions: medicalHistory.selectedConditions || existing.medicalHistory?.selectedConditions || [],
        conditionDetails: { ...(existing.medicalHistory?.conditionDetails || {}), ...(medicalHistory.conditionDetails || {}) },
        otherDiagnosisText: medicalHistory.otherDiagnosisText ?? existing.medicalHistory?.otherDiagnosisText ?? "",
      } : existing.medicalHistory || { selectedConditions: [], conditionDetails: {}, otherDiagnosisText: "" },
      allergies: allergies ? {
        noKnownAllergies: allergies.noKnownAllergies ?? existing.allergies?.noKnownAllergies ?? false,
        allergies: allergies.allergies || existing.allergies?.allergies || [],
      } : existing.allergies || { noKnownAllergies: false, allergies: [] },
      medications: medications ? {
        noCurrentMedications: medications.noCurrentMedications ?? existing.medications?.noCurrentMedications ?? false,
        medications: medications.medications || existing.medications?.medications || [],
      } : existing.medications || { noCurrentMedications: false, medications: [] },
      surgeries: surgeries ? {
        noSurgeries: surgeries.noSurgeries ?? existing.surgeries?.noSurgeries ?? false,
        skipForNow: surgeries.skipForNow ?? existing.surgeries?.skipForNow ?? false,
        surgeries: surgeries.surgeries || existing.surgeries?.surgeries || [],
      } : existing.surgeries || { noSurgeries: false, skipForNow: false, surgeries: [] },
      familyHistory: familyHistory ? {
        entries: familyHistory.entries || existing.familyHistory?.entries || [],
      } : existing.familyHistory || { entries: [] },
      socialHistory: socialHistory ? {
        tobacco: { ...(existing.socialHistory?.tobacco || defaultSocialHistory.tobacco), ...(socialHistory.tobacco || {}) },
        vaping: { ...(existing.socialHistory?.vaping || defaultSocialHistory.vaping), ...(socialHistory.vaping || {}) },
        alcohol: { ...(existing.socialHistory?.alcohol || defaultSocialHistory.alcohol), ...(socialHistory.alcohol || {}) },
        drugs: { ...(existing.socialHistory?.drugs || defaultSocialHistory.drugs), ...(socialHistory.drugs || {}) },
      } : existing.socialHistory || defaultSocialHistory,
    };

    questionnaireStorage.set(userId, updated);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "health_questionnaire",
      resourceId: `questionnaire-${userId}`,
      details: "Health questionnaire updated",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    res.json({
      success: true,
      message: "Questionnaire updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[HealthQuestionnaire] Error updating questionnaire:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update questionnaire",
    });
  }
});

export default router;

console.log("[HealthQuestionnaire] Routes module loaded");
