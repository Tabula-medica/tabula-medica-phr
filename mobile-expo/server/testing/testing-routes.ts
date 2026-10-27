import { Request, Response, Router } from "express";
import { syntheaGenerator, generateSyntheaBundle } from "./synthea-generator";
import { deidentificationService } from "./deidentification-service";
import { chaosEngineeringService, type ChaosTestConfig } from "./chaos-engineering";
import { AuditService, AuditAction, ResourceType } from "../compliance/audit-service";

const router = Router();

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function getUserId(req: Request): string {
  return getHeader(req, "x-user-id") || "";
}

function requireAuth(req: Request, res: Response, next: () => void) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const role = getHeader(req, "x-user-role");
  if (role !== "admin" && role !== "developer") {
    return res.status(403).json({ error: "Admin or developer access required" });
  }
  next();
}

router.post("/synthea/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { patientCount = 1 } = req.body;

    if (patientCount < 1 || patientCount > 100) {
      return res.status(400).json({ 
        error: "Patient count must be between 1 and 100" 
      });
    }

    const bundle = generateSyntheaBundle(patientCount);

    const patientResources = bundle.entry.filter(
      (e) => e.resource.resourceType === "Patient"
    );
    const conditionCount = bundle.entry.filter(
      (e) => e.resource.resourceType === "Condition"
    ).length;
    const medicationCount = bundle.entry.filter(
      (e) => e.resource.resourceType === "MedicationRequest"
    ).length;
    const observationCount = bundle.entry.filter(
      (e) => e.resource.resourceType === "Observation"
    ).length;

    res.json({
      bundle,
      summary: {
        patientCount: patientResources.length,
        conditionCount,
        medicationCount,
        observationCount,
        totalResources: bundle.entry.length,
      },
    });
  } catch (error) {
    console.error("Synthea generation error:", error);
    res.status(500).json({ error: "Failed to generate synthetic data" });
  }
});

router.post("/synthea/import", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { patientCount = 1 } = req.body;

    if (patientCount < 1 || patientCount > 10) {
      return res.status(400).json({ 
        error: "Patient count for import must be between 1 and 10" 
      });
    }

    const result = await syntheaGenerator.importToDatabase(userId, patientCount);

    AuditService.phiAccess(req, AuditAction.CREATE_PHI, ResourceType.HEALTH_RECORD, undefined, {
      phiDetails: {
        accessReason: "Synthea synthetic data import for testing",
        recordCount: result.imported,
      },
    });

    res.json({
      success: true,
      imported: result.imported,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Synthea import error:", error);
    res.status(500).json({ error: "Failed to import synthetic data" });
  }
});

router.post("/deidentify", requireAuth, async (req: Request, res: Response) => {
  try {
    const { record, config } = req.body;

    if (!record) {
      return res.status(400).json({ error: "Record is required" });
    }

    const result = deidentificationService.deidentifyRecord(record);

    res.json({
      success: result.success,
      deidentifiedRecord: result.deidentifiedRecord,
      redactedFieldCount: result.redactedFields.length,
      redactedFields: result.redactedFields.map((f) => ({
        fieldPath: f.fieldPath,
        fieldType: f.fieldType,
      })),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("Deidentification error:", error);
    res.status(500).json({ error: "Failed to deidentify record" });
  }
});

router.post("/deidentify/batch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Records array is required" });
    }

    if (records.length > 100) {
      return res.status(400).json({ error: "Maximum 100 records per batch" });
    }

    const result = deidentificationService.deidentifyBatch(records);

    res.json({
      summary: result.summary,
      results: result.results.map((r) => ({
        success: r.success,
        deidentifiedRecord: r.deidentifiedRecord,
        redactedFieldCount: r.redactedFields.length,
        warnings: r.warnings,
      })),
    });
  } catch (error) {
    console.error("Batch deidentification error:", error);
    res.status(500).json({ error: "Failed to deidentify records" });
  }
});

router.post("/deidentify/validate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { record } = req.body;

    if (!record) {
      return res.status(400).json({ error: "Record is required" });
    }

    const result = deidentificationService.validateDeidentification(record);

    res.json({
      isClean: result.isClean,
      potentialPHICount: result.potentialPHI.length,
      potentialPHI: result.potentialPHI,
    });
  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({ error: "Failed to validate deidentification" });
  }
});

router.post("/chaos/run", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const config: ChaosTestConfig = req.body;

    if (!config.type) {
      return res.status(400).json({ error: "Test type is required" });
    }

    const validTypes = [
      "database_connection",
      "database_latency",
      "database_timeout",
      "api_error",
      "memory_pressure",
    ];

    if (!validTypes.includes(config.type)) {
      return res.status(400).json({ 
        error: "Invalid test type",
        validTypes,
      });
    }

    AuditService.phiAccess(req, AuditAction.VIEW_PHI, ResourceType.AUDIT_LOG, undefined, {
      phiDetails: {
        accessReason: `Chaos engineering test: ${config.type}`,
      },
    });

    const result = await chaosEngineeringService.runChaosTest(config);

    res.json({
      testId: result.testId,
      type: result.type,
      success: result.success,
      duration: result.endTime.getTime() - result.startTime.getTime(),
      recoveryTimeMs: result.recoveryTimeMs,
      metrics: result.metrics,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Chaos test error:", error);
    res.status(500).json({ error: "Failed to run chaos test" });
  }
});

router.get("/chaos/health", async (_req: Request, res: Response) => {
  try {
    const results = await chaosEngineeringService.performHealthCheck();

    const overallStatus = results.every((r) => r.status === "healthy")
      ? "healthy"
      : results.some((r) => r.status === "unhealthy")
        ? "unhealthy"
        : "degraded";

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: results,
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ 
      status: "unhealthy",
      error: "Failed to perform health check",
    });
  }
});

router.get("/chaos/active", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const activeTests = chaosEngineeringService.getActiveTests();

    res.json({
      activeTestCount: activeTests.length,
      tests: activeTests,
    });
  } catch (error) {
    console.error("Get active tests error:", error);
    res.status(500).json({ error: "Failed to get active tests" });
  }
});

router.post("/chaos/reset", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    chaosEngineeringService.reset();

    res.json({
      success: true,
      message: "Chaos state reset successfully",
    });
  } catch (error) {
    console.error("Chaos reset error:", error);
    res.status(500).json({ error: "Failed to reset chaos state" });
  }
});

router.post("/chaos/availability", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { durationMs = 30000 } = req.body;

    if (durationMs < 5000 || durationMs > 300000) {
      return res.status(400).json({ 
        error: "Duration must be between 5000ms and 300000ms (5 minutes)" 
      });
    }

    const result = await chaosEngineeringService.runAvailabilityTest(durationMs);

    res.json({
      availability: result.availability.toFixed(2) + "%",
      totalChecks: result.totalChecks,
      successfulChecks: result.successfulChecks,
      failedChecks: result.failedChecks,
      averageLatencyMs: Math.round(result.averageLatencyMs),
      p99LatencyMs: result.p99LatencyMs,
      meetsHIPAAAvailability: result.availability >= 99.0,
    });
  } catch (error) {
    console.error("Availability test error:", error);
    res.status(500).json({ error: "Failed to run availability test" });
  }
});

router.get("/capabilities", async (_req: Request, res: Response) => {
  try {
    res.json({
      syntheticData: {
        description: "Generate Synthea-style synthetic patient data for testing",
        endpoints: [
          "POST /api/testing/synthea/generate - Generate synthetic FHIR bundle",
          "POST /api/testing/synthea/import - Import synthetic data to user account",
        ],
        features: [
          "Realistic patient demographics",
          "Medical conditions with SNOMED codes",
          "Medications with RxNorm codes",
          "Vital signs and lab results with LOINC codes",
          "NMN (No Middle Name) standard support",
        ],
      },
      deidentification: {
        description: "PHI de-identification following HIPAA Safe Harbor guidelines",
        endpoints: [
          "POST /api/testing/deidentify - De-identify a single record",
          "POST /api/testing/deidentify/batch - De-identify multiple records",
          "POST /api/testing/deidentify/validate - Check for remaining PHI",
        ],
        features: [
          "18 HIPAA Safe Harbor identifier types",
          "Pattern-based PHI detection",
          "Configurable redaction strategies",
          "Hash-based pseudonymization option",
          "Date year preservation option",
        ],
      },
      chaosEngineering: {
        description: "Test system availability and resilience",
        endpoints: [
          "POST /api/testing/chaos/run - Run a chaos test",
          "GET /api/testing/chaos/health - System health check",
          "GET /api/testing/chaos/active - List active chaos tests",
          "POST /api/testing/chaos/reset - Reset chaos state",
          "POST /api/testing/chaos/availability - Run availability test",
        ],
        testTypes: [
          "database_connection - Test DB connectivity",
          "database_latency - Simulate slow queries",
          "database_timeout - Test timeout handling",
          "api_error - Simulate API failures",
          "memory_pressure - Test memory limits",
        ],
        intensityLevels: ["low", "medium", "high"],
      },
    });
  } catch (error) {
    console.error("Get capabilities error:", error);
    res.status(500).json({ error: "Failed to get capabilities" });
  }
});

export default router;
