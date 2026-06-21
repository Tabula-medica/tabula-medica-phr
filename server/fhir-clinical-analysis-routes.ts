import { Router, Request, Response } from "express";
import { fhirDeepAnalysisService } from "./services/fhir-deep-analysis-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/metadata", async (req: Request, res: Response) => {
  try {
    const metadata = fhirDeepAnalysisService.getMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Metadata error:", error);
    res.status(500).json({ error: "Failed to get metadata" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    await logPhiAccess({
      userId: "current-user",
      patientId: undefined,
      resourceType: "FhirClinicalDashboard",
      action: "read",
      details: "Accessed FHIR clinical analysis dashboard summary",
    });

    const summary = fhirDeepAnalysisService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/patients", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.query;

    await logPhiAccess({
      userId: "current-user",
      patientId: patientId as string | undefined,
      resourceType: "PatientDemographics",
      action: "read",
      details: patientId ? `Retrieved demographics for patient: ${patientId}` : "Retrieved all patient demographics",
    });

    const demographics = fhirDeepAnalysisService.getPatientDemographics(patientId as string | undefined);
    res.json(demographics);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get patients error:", error);
    res.status(500).json({ error: "Failed to get patient demographics" });
  }
});

router.get("/patients/:patientId/conditions", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "Condition",
      action: "read",
      details: `Retrieved conditions for patient: ${patientId}`,
    });

    const conditions = fhirDeepAnalysisService.getPatientConditions(patientId);
    res.json(conditions);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get conditions error:", error);
    res.status(500).json({ error: "Failed to get patient conditions" });
  }
});

router.get("/patients/:patientId/medications", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "MedicationRequest",
      action: "read",
      details: `Retrieved medications for patient: ${patientId}`,
    });

    const medications = fhirDeepAnalysisService.getPatientMedications(patientId);
    res.json(medications);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get medications error:", error);
    res.status(500).json({ error: "Failed to get patient medications" });
  }
});

router.get("/patients/:patientId/observations", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { category } = req.query;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "Observation",
      action: "read",
      details: `Retrieved observations for patient: ${patientId}${category ? ` (category: ${category})` : ""}`,
    });

    const observations = fhirDeepAnalysisService.getPatientObservations(patientId, category as string | undefined);
    res.json(observations);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get observations error:", error);
    res.status(500).json({ error: "Failed to get patient observations" });
  }
});

router.get("/patients/:patientId/allergies", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "AllergyIntolerance",
      action: "read",
      details: `Retrieved allergies for patient: ${patientId}`,
    });

    const allergies = fhirDeepAnalysisService.getPatientAllergies(patientId);
    res.json(allergies);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get allergies error:", error);
    res.status(500).json({ error: "Failed to get patient allergies" });
  }
});

router.get("/patients/:patientId/health-summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "PatientHealthSummary",
      action: "read",
      details: `Generated comprehensive health summary for patient: ${patientId}`,
    });

    const summary = await fhirDeepAnalysisService.getPatientHealthSummary(patientId);
    if (!summary) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(summary);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get health summary error:", error);
    res.status(500).json({ error: "Failed to get patient health summary" });
  }
});

router.post("/patients/:patientId/risk-predictions", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "RiskPrediction",
      action: "read",
      details: `Generated AI risk predictions for patient: ${patientId}`,
    });

    const predictions = await fhirDeepAnalysisService.generateRiskPredictions(patientId);
    res.json(predictions);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Risk prediction error:", error);
    res.status(500).json({ error: "Failed to generate risk predictions" });
  }
});

router.post("/patients/:patientId/drug-interactions", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    await logPhiAccess({
      userId: "current-user",
      patientId,
      resourceType: "DrugInteraction",
      action: "read",
      details: `Analyzed drug interactions for patient: ${patientId}`,
    });

    const interactions = await fhirDeepAnalysisService.detectDrugInteractions(patientId);
    res.json(interactions);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Drug interaction error:", error);
    res.status(500).json({ error: "Failed to detect drug interactions" });
  }
});

router.post("/reports", async (req: Request, res: Response) => {
  try {
    const { reportType, dateRange } = req.body;

    if (!reportType || !["demographics", "conditions", "medications", "observations", "comprehensive"].includes(reportType)) {
      return res.status(400).json({ error: "Invalid report type" });
    }

    await logPhiAccess({
      userId: "current-user",
      patientId: undefined,
      resourceType: "FhirAggregateReport",
      action: "write",
      details: `Generated ${reportType} aggregate report`,
    });

    const report = fhirDeepAnalysisService.generateAggregateReport(reportType, dateRange);
    res.json(report);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Report generation error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    await logPhiAccess({
      userId: "current-user",
      patientId: undefined,
      resourceType: "FhirAggregateReport",
      action: "read",
      details: "Retrieved list of generated reports",
    });

    const reports = fhirDeepAnalysisService.getGeneratedReports();
    res.json(reports);
  } catch (error) {
    console.error("[FhirClinicalAnalysis] Get reports error:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
});

export default router;
