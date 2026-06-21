import { Router, Request, Response } from "express";
import type { Express } from "express";
import {
  getFHIRR5ReadinessReport,
  getFHIRR5Features,
  getFHIRR5MigrationPlan,
  getFHIRR5BreakingChanges,
  checkResourceCompatibility,
  getVersionNegotiationConfig,
} from "./services/fhir-r5-readiness-service";

const router = Router();

const NO_CDS_DISCLAIMER = "Informational only. Not clinical decision support.";

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "FHIR R5 Readiness Assessment Service",
    version: "1.0.0",
    description: "Tracks platform preparedness for upgrading from FHIR R4 to R5. This is a readiness/compatibility assessment layer, not a full R5 implementation.",
    currentFhirVersion: "R4 (4.0.1)",
    targetFhirVersion: "R5 (5.0.0)",
    features: [
      "R5 readiness scoring",
      "Feature-level migration tracking",
      "Breaking change documentation",
      "Resource compatibility checks",
      "Phased migration planning",
      "Version negotiation configuration",
    ],
    compliance: {
      hipaa: true,
      noCds: true,
      fhirR4: true,
      fhirR5Readiness: true,
    },
    disclaimer: NO_CDS_DISCLAIMER,
  });
});

router.get("/report", (_req: Request, res: Response) => {
  try {
    const report = getFHIRR5ReadinessReport();
    res.json({ ...report, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error generating report:", error);
    res.status(500).json({ error: "Failed to generate readiness report", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/features", (_req: Request, res: Response) => {
  try {
    const features = getFHIRR5Features();
    res.json({ features, totalCount: features.length, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error fetching features:", error);
    res.status(500).json({ error: "Failed to fetch R5 features", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/migration-plan", (_req: Request, res: Response) => {
  try {
    const plan = getFHIRR5MigrationPlan();
    res.json({ ...plan, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error fetching migration plan:", error);
    res.status(500).json({ error: "Failed to fetch migration plan", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/breaking-changes", (_req: Request, res: Response) => {
  try {
    const changes = getFHIRR5BreakingChanges();
    const totalChanges = changes.reduce((sum, cat) => sum + cat.changes.length, 0);
    res.json({ categories: changes, totalChanges, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error fetching breaking changes:", error);
    res.status(500).json({ error: "Failed to fetch breaking changes", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/compatibility/:resourceType", (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    const compatibility = checkResourceCompatibility(resourceType);

    if (!compatibility) {
      return res.status(404).json({
        error: `No compatibility data found for resource type: ${resourceType}`,
        availableTypes: [
          "Patient", "Observation", "Condition", "Encounter",
          "MedicationRequest", "Subscription", "Bundle",
          "SubscriptionTopic", "Evidence", "EvidenceReport",
        ],
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    res.json({ ...compatibility, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error checking compatibility:", error);
    res.status(500).json({ error: "Failed to check resource compatibility", disclaimer: NO_CDS_DISCLAIMER });
  }
});

router.get("/version-negotiation", (_req: Request, res: Response) => {
  try {
    const config = getVersionNegotiationConfig();
    res.json({ ...config, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error: any) {
    console.error("[FHIR-R5-Readiness] Error fetching version negotiation config:", error);
    res.status(500).json({ error: "Failed to fetch version negotiation config", disclaimer: NO_CDS_DISCLAIMER });
  }
});

export function registerFHIRR5ReadinessRoutes(app: Express): void {
  app.use("/api/fhir-r5", router);
  console.log("[Routes] FHIR R5 Readiness routes registered at /api/fhir-r5/*");
}
