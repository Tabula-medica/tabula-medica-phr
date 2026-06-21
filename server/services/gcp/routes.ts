import { Router, Request, Response } from "express";
import {
  integrationManager,
  getIntegrationHealthStatus,
  getFhirStore,
  getAnalyticsStore,
  getRiskModel,
  getAuditLogger,
} from "../integrations/factory";
import type { RiskModelInput, RiskType, CohortDefinition } from "../integrations/interfaces";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const status = await getIntegrationHealthStatus();
    const statusCode = status.overall === "healthy" ? 200 : status.overall === "degraded" ? 206 : 503;
    res.status(statusCode).json(status);
  } catch (error: any) {
    res.status(500).json({
      overall: "unhealthy",
      error: error.message,
      lastChecked: new Date().toISOString(),
    });
  }
});

router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = integrationManager.getConfig();
    res.json({
      fhirProvider: config.fhirProvider,
      analyticsProvider: config.analyticsProvider,
      riskModelProvider: config.riskModelProvider,
      auditProvider: config.auditProvider,
      hipaaCompliance: config.hipaaCompliance,
      gcpConfigured: !!config.gcp,
      aidboxConfigured: !!config.aidbox,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const auditLogger = getAuditLogger();

    const patient = await fhirStore.getPatient(req.params.patientId);

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    if (integrationManager.getConfig().hipaaCompliance.enablePhiTracking) {
      await auditLogger.logPhiAccess(
        (req as any).user?.id || "anonymous",
        (req as any).user?.role || "unknown",
        req.params.patientId,
        "Patient",
        "API request"
      );
    }

    res.json(patient);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId/observations", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const category = req.query.category as string | undefined;
    const observations = await fhirStore.getPatientObservations(req.params.patientId, category);
    res.json(observations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId/conditions", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const conditions = await fhirStore.getPatientConditions(req.params.patientId);
    res.json(conditions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId/medications", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const medications = await fhirStore.getPatientMedicationRequests(req.params.patientId);
    res.json(medications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId/immunizations", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const immunizations = await fhirStore.getPatientImmunizations(req.params.patientId);
    res.json(immunizations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fhir/patient/:patientId/allergies", async (req: Request, res: Response) => {
  try {
    const fhirStore = getFhirStore();
    const allergies = await fhirStore.getPatientAllergies(req.params.patientId);
    res.json(allergies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/population-health", async (req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const cohortId = req.query.cohortId as string | undefined;
    const metrics = await analyticsStore.getPopulationHealthMetrics(cohortId);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/analytics/cohort", async (req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const definition = req.body as CohortDefinition;
    const patientIds = await analyticsStore.getCohort(definition);
    res.json({ patientIds, count: patientIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/patient/:patientId/lab-trends", async (req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const labCodes = (req.query.codes as string)?.split(",") || [];
    const months = parseInt(req.query.months as string) || 6;
    const trends = await analyticsStore.getLabTrends(req.params.patientId, labCodes, months);
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/patient/:patientId/vital-trends", async (req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const vitalTypes = (req.query.types as string)?.split(",") || [];
    const months = parseInt(req.query.months as string) || 6;
    const trends = await analyticsStore.getVitalTrends(req.params.patientId, vitalTypes, months);
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/patient/:patientId/adherence-trends", async (req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const months = parseInt(req.query.months as string) || 6;
    const trends = await analyticsStore.getAdherenceTrends(req.params.patientId, months);
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/medication-safety", async (_req: Request, res: Response) => {
  try {
    const analyticsStore = getAnalyticsStore();
    const metrics = await analyticsStore.getMedicationSafetyMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk/predict", async (req: Request, res: Response) => {
  try {
    const riskModel = getRiskModel();
    const { input, riskType } = req.body as { input: RiskModelInput; riskType: RiskType };
    const prediction = await riskModel.predictRisk(input, riskType);
    res.json(prediction);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk/predict-all", async (req: Request, res: Response) => {
  try {
    const riskModel = getRiskModel();
    const input = req.body as RiskModelInput;
    const predictions = await riskModel.predictAllRisks(input);
    res.json(predictions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk/batch-predict", async (req: Request, res: Response) => {
  try {
    const riskModel = getRiskModel();
    const { inputs, riskType } = req.body as { inputs: RiskModelInput[]; riskType: RiskType };
    const predictions = await riskModel.batchPredict(inputs, riskType);
    res.json(predictions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/risk/model-info/:riskType", async (req: Request, res: Response) => {
  try {
    const riskModel = getRiskModel();
    const info = await riskModel.getModelInfo(req.params.riskType as RiskType);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk/explain", async (req: Request, res: Response) => {
  try {
    const riskModel = getRiskModel();
    const explanation = await riskModel.explainPrediction(req.body);
    res.json(explanation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit/logs", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    const logs = await auditLogger.query({
      userId: req.query.userId as string,
      patientId: req.query.patientId as string,
      resourceType: req.query.resourceType as string,
      action: req.query.action as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      phiAccessedOnly: req.query.phiOnly === "true",
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit/patient/:patientId/access-report", async (req: Request, res: Response) => {
  try {
    const auditLogger = getAuditLogger();
    const startDate = (req.query.startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = (req.query.endDate as string) || new Date().toISOString();

    const report = await auditLogger.getAccessReport(req.params.patientId, {
      start: startDate,
      end: endDate,
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
