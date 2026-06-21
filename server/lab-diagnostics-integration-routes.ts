import { Router, Request, Response } from "express";
import type { Express } from "express";
import {
  getLabProviders,
  submitLabOrder,
  getLabResults,
  getLabOrderStatus,
  searchAvailableTests,
  getLabIntegrationDashboard,
  type LabOrderRequest,
} from "./services/lab-diagnostics-integration-service";

const router = Router();

const NO_CDS_DISCLAIMER_SHORT = "Informational only. Not clinical decision support.";

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "Lab Diagnostics Integration Service",
    version: "1.0.0",
    description: "Integration stubs for Quest Diagnostics (via Fasten Health) and LabCorp (via Particle Health)",
    fhirVersion: "R4 (4.0.1)",
    supportedProviders: ["Quest Diagnostics", "LabCorp"],
    integrationPartners: ["Fasten Health", "Particle Health"],
    features: [
      "Lab order submission",
      "Lab result retrieval",
      "FHIR R4 Observation normalization",
      "LOINC code mapping",
      "HIPAA audit logging",
    ],
    compliance: {
      hipaa: true,
      noCds: true,
      fhirR4: true,
      loincCoding: true,
    },
    disclaimer: NO_CDS_DISCLAIMER_SHORT,
  });
});

router.get("/providers", (_req: Request, res: Response) => {
  try {
    const providers = getLabProviders();
    res.json({
      providers,
      totalCount: providers.length,
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  } catch (error: any) {
    console.error("[LabDiagnostics] Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch lab providers", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

router.post("/orders", (req: Request, res: Response) => {
  try {
    const { patientId, providerId, tests, orderingPhysician, clinicalNotes, icdCodes, specimenCollectionDate } = req.body;

    if (!patientId || !providerId || !tests || !Array.isArray(tests) || tests.length === 0 || !orderingPhysician) {
      return res.status(400).json({
        error: "Missing required fields: patientId, providerId, tests (array), orderingPhysician",
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const orderRequest: LabOrderRequest = {
      patientId,
      providerId,
      tests,
      orderingPhysician,
      clinicalNotes,
      icdCodes,
      specimenCollectionDate,
    };

    const order = submitLabOrder(orderRequest);
    res.status(201).json({ order, disclaimer: NO_CDS_DISCLAIMER_SHORT });
  } catch (error: any) {
    console.error("[LabDiagnostics] Error submitting order:", error);
    const status = error.message?.includes("not found") || error.message?.includes("not available") ? 400 : 500;
    res.status(status).json({ error: error.message || "Failed to submit lab order", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

router.get("/orders/:orderId/status", (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = getLabOrderStatus(orderId);

    if (!order) {
      return res.status(404).json({ error: `Order not found: ${orderId}`, disclaimer: NO_CDS_DISCLAIMER_SHORT });
    }

    res.json({ order, disclaimer: NO_CDS_DISCLAIMER_SHORT });
  } catch (error: any) {
    console.error("[LabDiagnostics] Error fetching order status:", error);
    res.status(500).json({ error: "Failed to fetch order status", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

router.get("/results/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { providerId, startDate, endDate, status, loincCode } = req.query;

    const results = getLabResults(patientId, {
      providerId: providerId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      status: status as string | undefined,
      loincCode: loincCode as string | undefined,
    });

    res.json(results);
  } catch (error: any) {
    console.error("[LabDiagnostics] Error fetching results:", error);
    res.status(500).json({ error: "Failed to fetch lab results", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

router.get("/tests/search", (req: Request, res: Response) => {
  try {
    const { q, provider } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' is required", disclaimer: NO_CDS_DISCLAIMER_SHORT });
    }

    const tests = searchAvailableTests(q, provider as string | undefined);
    res.json({ tests, totalCount: tests.length, disclaimer: NO_CDS_DISCLAIMER_SHORT });
  } catch (error: any) {
    console.error("[LabDiagnostics] Error searching tests:", error);
    res.status(500).json({ error: "Failed to search lab tests", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const dashboard = getLabIntegrationDashboard();
    res.json(dashboard);
  } catch (error: any) {
    console.error("[LabDiagnostics] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch integration dashboard", disclaimer: NO_CDS_DISCLAIMER_SHORT });
  }
});

export function registerLabDiagnosticsRoutes(app: Express): void {
  app.use("/api/lab-diagnostics", router);
  console.log("[Routes] Lab Diagnostics Integration routes registered at /api/lab-diagnostics/*");
}
