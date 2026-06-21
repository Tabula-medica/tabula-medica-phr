import { Router, Request, Response } from "express";
import { comprehensivePatientProfileService } from "./services/comprehensive-patient-profile-service";

const router = Router();

router.get("/profile/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const profile = await comprehensivePatientProfileService.getProfile(patientId);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json(profile);
  } catch (error) {
    console.error("[PatientProfile] Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/profile/:patientId/demographics", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const demographics = req.body;
    
    const profile = await comprehensivePatientProfileService.updateDemographics(patientId, demographics);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, demographics: profile.demographics, completionPercentage: profile.completionPercentage });
  } catch (error) {
    console.error("[PatientProfile] Error updating demographics:", error);
    res.status(500).json({ error: "Failed to update demographics" });
  }
});

router.patch("/profile/:patientId/contact", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const contactDetails = req.body;
    
    const profile = await comprehensivePatientProfileService.updateContactDetails(patientId, contactDetails);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, contactDetails: profile.contactDetails, completionPercentage: profile.completionPercentage });
  } catch (error) {
    console.error("[PatientProfile] Error updating contact details:", error);
    res.status(500).json({ error: "Failed to update contact details" });
  }
});

router.post("/profile/:patientId/emergency-contacts", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const contact = req.body;
    
    const newContact = await comprehensivePatientProfileService.addEmergencyContact(patientId, contact);
    
    if (!newContact) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, contact: newContact });
  } catch (error) {
    console.error("[PatientProfile] Error adding emergency contact:", error);
    res.status(500).json({ error: "Failed to add emergency contact" });
  }
});

router.patch("/profile/:patientId/emergency-contacts/:contactId", async (req: Request, res: Response) => {
  try {
    const { patientId, contactId } = req.params;
    const updates = req.body;
    
    const contact = await comprehensivePatientProfileService.updateEmergencyContact(patientId, contactId, updates);
    
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    res.json({ success: true, contact });
  } catch (error) {
    console.error("[PatientProfile] Error updating emergency contact:", error);
    res.status(500).json({ error: "Failed to update emergency contact" });
  }
});

router.delete("/profile/:patientId/emergency-contacts/:contactId", async (req: Request, res: Response) => {
  try {
    const { patientId, contactId } = req.params;
    
    const deleted = await comprehensivePatientProfileService.deleteEmergencyContact(patientId, contactId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[PatientProfile] Error deleting emergency contact:", error);
    res.status(500).json({ error: "Failed to delete emergency contact" });
  }
});

router.post("/profile/:patientId/insurance", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const insurance = req.body;
    
    const newInsurance = await comprehensivePatientProfileService.addInsurance(patientId, insurance);
    
    if (!newInsurance) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, insurance: newInsurance });
  } catch (error) {
    console.error("[PatientProfile] Error adding insurance:", error);
    res.status(500).json({ error: "Failed to add insurance" });
  }
});

router.patch("/profile/:patientId/insurance/:insuranceId", async (req: Request, res: Response) => {
  try {
    const { patientId, insuranceId } = req.params;
    const updates = req.body;
    
    const insurance = await comprehensivePatientProfileService.updateInsurance(patientId, insuranceId, updates);
    
    if (!insurance) {
      return res.status(404).json({ error: "Insurance not found" });
    }
    
    res.json({ success: true, insurance });
  } catch (error) {
    console.error("[PatientProfile] Error updating insurance:", error);
    res.status(500).json({ error: "Failed to update insurance" });
  }
});

router.delete("/profile/:patientId/insurance/:insuranceId", async (req: Request, res: Response) => {
  try {
    const { patientId, insuranceId } = req.params;
    
    const deleted = await comprehensivePatientProfileService.deleteInsurance(patientId, insuranceId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Insurance not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[PatientProfile] Error deleting insurance:", error);
    res.status(500).json({ error: "Failed to delete insurance" });
  }
});

router.patch("/profile/:patientId/preferences", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const preferences = req.body;
    
    const profile = await comprehensivePatientProfileService.updatePreferences(patientId, preferences);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, preferences: profile.preferences });
  } catch (error) {
    console.error("[PatientProfile] Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/profile/:patientId/medical-history", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const medicalHistory = await comprehensivePatientProfileService.getMedicalHistorySummary(patientId);
    
    if (!medicalHistory) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json(medicalHistory);
  } catch (error) {
    console.error("[PatientProfile] Error fetching medical history:", error);
    res.status(500).json({ error: "Failed to fetch medical history" });
  }
});

export function registerComprehensivePatientProfileRoutes(app: any): void {
  app.use("/api/patient-profile", router);
  console.log("[Routes] Comprehensive Patient Profile routes registered at /api/patient-profile/*");
}
