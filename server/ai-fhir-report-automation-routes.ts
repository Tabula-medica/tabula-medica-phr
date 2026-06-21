import { Router, Request, Response } from "express";
import { aiFHIRReportAutomationService } from "./services/ai-fhir-report-automation-service";

const router = Router();

router.get("/configurations", async (req: Request, res: Response) => {
  try {
    const configurations = await aiFHIRReportAutomationService.getReportConfigurations();
    res.json({ configurations });
  } catch (error: any) {
    console.error("[ReportAutomation] Error getting configurations:", error);
    res.status(500).json({ error: error.message || "Failed to get report configurations" });
  }
});

router.get("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const configuration = await aiFHIRReportAutomationService.getReportConfiguration(req.params.id);
    if (!configuration) {
      return res.status(404).json({ error: "Report configuration not found" });
    }
    res.json({ configuration });
  } catch (error: any) {
    console.error("[ReportAutomation] Error getting configuration:", error);
    res.status(500).json({ error: error.message || "Failed to get report configuration" });
  }
});

router.post("/configurations", async (req: Request, res: Response) => {
  try {
    const configuration = await aiFHIRReportAutomationService.createReportConfiguration(req.body);
    res.status(201).json({ configuration });
  } catch (error: any) {
    console.error("[ReportAutomation] Error creating configuration:", error);
    res.status(500).json({ error: error.message || "Failed to create report configuration" });
  }
});

router.patch("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const configuration = await aiFHIRReportAutomationService.updateReportConfiguration(req.params.id, req.body);
    if (!configuration) {
      return res.status(404).json({ error: "Report configuration not found" });
    }
    res.json({ configuration });
  } catch (error: any) {
    console.error("[ReportAutomation] Error updating configuration:", error);
    res.status(500).json({ error: error.message || "Failed to update report configuration" });
  }
});

router.delete("/configurations/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await aiFHIRReportAutomationService.deleteReportConfiguration(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Report configuration not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ReportAutomation] Error deleting configuration:", error);
    res.status(500).json({ error: error.message || "Failed to delete report configuration" });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { configurationId, fhirResources } = req.body;
    
    if (!configurationId) {
      return res.status(400).json({ error: "Configuration ID is required" });
    }
    
    if (!fhirResources || !Array.isArray(fhirResources)) {
      return res.status(400).json({ error: "FHIR resources array is required" });
    }

    const userId = (req as any).user?.id || "anonymous";
    const report = await aiFHIRReportAutomationService.generateReport(configurationId, fhirResources, userId);
    res.json({ report });
  } catch (error: any) {
    console.error("[ReportAutomation] Error generating report:", error);
    res.status(500).json({ error: error.message || "Failed to generate report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    const reports = await aiFHIRReportAutomationService.getGeneratedReports();
    res.json({ reports });
  } catch (error: any) {
    console.error("[ReportAutomation] Error getting reports:", error);
    res.status(500).json({ error: error.message || "Failed to get reports" });
  }
});

router.get("/reports/:id", async (req: Request, res: Response) => {
  try {
    const report = await aiFHIRReportAutomationService.getGeneratedReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json({ report });
  } catch (error: any) {
    console.error("[ReportAutomation] Error getting report:", error);
    res.status(500).json({ error: error.message || "Failed to get report" });
  }
});

router.post("/generate-sample", async (req: Request, res: Response) => {
  try {
    const { reportType } = req.body;
    
    const sampleResources = generateSampleFHIRResources(reportType || "patient_summary");
    
    res.json({ 
      resources: sampleResources,
      message: `Generated ${sampleResources.length} sample FHIR resources` 
    });
  } catch (error: any) {
    console.error("[ReportAutomation] Error generating sample data:", error);
    res.status(500).json({ error: error.message || "Failed to generate sample data" });
  }
});

function generateSampleFHIRResources(reportType: string): any[] {
  const resources: any[] = [];

  const patientCount = reportType === "population_health" ? 50 : 1;
  
  for (let i = 0; i < patientCount; i++) {
    const patientId = `patient-${i + 1}`;
    const birthYear = 1950 + Math.floor(Math.random() * 50);
    const genders = ["male", "female"];
    
    resources.push({
      resourceType: "Patient",
      id: patientId,
      name: [{ family: `Smith${i}`, given: ["John", "James"] }],
      birthDate: `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-15`,
      gender: genders[Math.floor(Math.random() * 2)],
      address: [{ city: "Boston", state: "MA", postalCode: "02101" }],
      telecom: [{ system: "phone", value: "555-0100" }],
      identifier: [{ system: "http://hospital.org/mrn", value: `MRN${100000 + i}` }],
    });

    const conditions = [
      { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
      { code: "I10", display: "Essential hypertension" },
      { code: "J45.909", display: "Unspecified asthma, uncomplicated" },
      { code: "E78.5", display: "Hyperlipidemia, unspecified" },
      { code: "M54.5", display: "Low back pain" },
    ];

    const numConditions = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numConditions; j++) {
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      resources.push({
        resourceType: "Condition",
        id: `condition-${patientId}-${j}`,
        code: {
          coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", ...condition }],
          text: condition.display,
        },
        subject: { reference: `Patient/${patientId}` },
        clinicalStatus: { coding: [{ code: "active" }] },
        onsetDateTime: `${birthYear + 40 + Math.floor(Math.random() * 10)}-01-01`,
      });
    }

    const medications = [
      { name: "Metformin 500mg", dosage: "Take one tablet twice daily" },
      { name: "Lisinopril 10mg", dosage: "Take one tablet daily" },
      { name: "Atorvastatin 20mg", dosage: "Take one tablet at bedtime" },
      { name: "Amlodipine 5mg", dosage: "Take one tablet daily" },
    ];

    const numMeds = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numMeds; j++) {
      const med = medications[Math.floor(Math.random() * medications.length)];
      resources.push({
        resourceType: "MedicationRequest",
        id: `medication-${patientId}-${j}`,
        medicationCodeableConcept: {
          coding: [{ display: med.name }],
          text: med.name,
        },
        subject: { reference: `Patient/${patientId}` },
        status: "active",
        dosageInstruction: [{ text: med.dosage }],
        authoredOn: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    resources.push({
      resourceType: "AllergyIntolerance",
      id: `allergy-${patientId}`,
      code: { coding: [{ display: "Penicillin" }], text: "Penicillin" },
      patient: { reference: `Patient/${patientId}` },
      reaction: [{ manifestation: [{ coding: [{ display: "Rash" }] }], severity: "moderate" }],
    });

    resources.push({
      resourceType: "Immunization",
      id: `immunization-${patientId}`,
      vaccineCode: { coding: [{ display: "Influenza, seasonal, injectable" }], text: "Flu Shot" },
      patient: { reference: `Patient/${patientId}` },
      occurrenceDateTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: "completed",
    });

    resources.push({
      resourceType: "Observation",
      id: `bp-${patientId}`,
      code: { coding: [{ code: "85354-9", display: "Blood pressure panel" }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      component: [
        { code: { coding: [{ code: "8480-6", display: "Systolic BP" }] }, valueQuantity: { value: 120 + Math.floor(Math.random() * 30), unit: "mmHg" } },
        { code: { coding: [{ code: "8462-4", display: "Diastolic BP" }] }, valueQuantity: { value: 70 + Math.floor(Math.random() * 20), unit: "mmHg" } },
      ],
    });

    resources.push({
      resourceType: "Observation",
      id: `glucose-${patientId}`,
      code: { coding: [{ code: "2339-0", display: "Glucose" }] },
      category: [{ coding: [{ code: "laboratory" }] }],
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: { value: 95 + Math.floor(Math.random() * 50), unit: "mg/dL" },
      status: "final",
    });

    resources.push({
      resourceType: "Encounter",
      id: `encounter-${patientId}`,
      class: { code: "AMB", display: "Ambulatory" },
      subject: { reference: `Patient/${patientId}` },
      period: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      type: [{ coding: [{ display: "Office Visit" }] }],
    });

    resources.push({
      resourceType: "CarePlan",
      id: `careplan-${patientId}`,
      title: "Diabetes Management Plan",
      status: "active",
      subject: { reference: `Patient/${patientId}` },
      goal: [{ display: "Maintain HbA1c below 7%" }],
      activity: [{ detail: { description: "Regular blood glucose monitoring" } }],
    });
  }

  return resources;
}

export function registerAIFHIRReportAutomationRoutes(app: any): void {
  app.use("/api/fhir-report-automation", router);
  console.log("[Routes] AI FHIR Report Automation routes registered at /api/fhir-report-automation/*");
}
