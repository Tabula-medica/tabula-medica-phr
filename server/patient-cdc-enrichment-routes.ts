import { Router, Request, Response } from "express";
import {
  enrichPatientWithCDCData,
  getPatientCDCEnrichmentById,
  getAllPatientsWithCDCRisks
} from "./services/patient-cdc-enrichment-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "Patient CDC Enrichment",
    version: "1.0.0",
    description: "Enrich patient profiles with CDC public health data",
    features: [
      "Health advisories based on location and conditions",
      "Vaccination recommendations based on age and health status",
      "Disease prevalence data for patient's area",
      "Environmental alerts relevant to patient conditions",
      "AI-powered personalized insights"
    ],
    dataCategories: [
      "Health Advisories",
      "Vaccination Recommendations",
      "Disease Prevalence",
      "Environmental Alerts"
    ]
  });
});

router.get("/patients", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const result = await getAllPatientsWithCDCRisks(userId);
    res.json(result);
  } catch (error) {
    console.error("[PatientCDCEnrichment] List patients error:", error);
    res.status(500).json({ error: "Failed to get patient CDC risk data" });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    const enrichment = await getPatientCDCEnrichmentById(userId, patientId);
    res.json(enrichment);
  } catch (error) {
    console.error("[PatientCDCEnrichment] Patient enrichment error:", error);
    res.status(500).json({ error: "Failed to enrich patient with CDC data" });
  }
});

router.post("/enrich", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const patientData = req.body;
    
    if (!patientData.patientId || !patientData.name || !patientData.age || !patientData.state) {
      return res.status(400).json({ 
        error: "Missing required fields: patientId, name, age, state" 
      });
    }
    
    const enrichment = await enrichPatientWithCDCData(userId, patientData);
    res.json(enrichment);
  } catch (error) {
    console.error("[PatientCDCEnrichment] Custom enrichment error:", error);
    res.status(500).json({ error: "Failed to enrich patient data" });
  }
});

export default router;
