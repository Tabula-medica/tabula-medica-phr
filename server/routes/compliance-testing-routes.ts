/**
 * Compliance & Safety Testing Routes
 * 
 * Endpoints for:
 * - Synthea™ synthetic patient data generation
 * - PHI de-identification
 * - Chaos engineering for HIPAA availability testing
 */

import { Router, Request, Response } from "express";
import { syntheaPatientGeneratorService } from "../services/synthea-patient-generator-service";
import { phiDeidentificationService } from "../services/phi-deidentification-service";
import { chaosEngineeringService } from "../services/chaos-engineering-service";
import { z } from "zod";

const router = Router();

// ==================== Synthea Patient Generator ====================

router.get("/synthea/presets", async (req: Request, res: Response) => {
  try {
    const presets = syntheaPatientGeneratorService.getDatasetPresets();
    res.json({
      success: true,
      description: "Available synthetic patient data presets",
      presets,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const generatePatientSchema = z.object({
  count: z.number().min(1).max(1000).optional().default(1),
  ageRange: z.object({
    min: z.number().min(0).max(120),
    max: z.number().min(0).max(120),
  }).optional(),
  genderDistribution: z.object({
    male: z.number().min(0).max(1),
    female: z.number().min(0).max(1),
    other: z.number().min(0).max(1),
  }).optional(),
  includeConditions: z.boolean().optional().default(true),
  includeMedications: z.boolean().optional().default(true),
  includeObservations: z.boolean().optional().default(true),
  includeSocialDeterminants: z.boolean().optional().default(false),
  state: z.string().length(2).optional(),
  seed: z.number().optional(),
});

router.post("/synthea/generate", async (req: Request, res: Response) => {
  try {
    const config = generatePatientSchema.parse(req.body);
    const bundle = syntheaPatientGeneratorService.generatePatientBundle(config);
    
    res.json({
      success: true,
      message: `Generated ${config.count} synthetic patient(s) with complete records`,
      patientCount: config.count,
      totalResources: bundle.total,
      bundle,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/synthea/generate-single", async (req: Request, res: Response) => {
  try {
    const patient = syntheaPatientGeneratorService.generatePatient({
      includeSocialDeterminants: req.query.includeSdoh === "true",
    });
    
    res.json({
      success: true,
      message: "Generated single synthetic patient",
      patient,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/synthea/generate-preset/:presetName", async (req: Request, res: Response) => {
  try {
    const { presetName } = req.params;
    const presets = syntheaPatientGeneratorService.getDatasetPresets();
    const preset = presets.find(p => p.name === presetName);
    
    if (!preset) {
      return res.status(404).json({
        success: false,
        error: `Preset '${presetName}' not found`,
        availablePresets: presets.map(p => p.name),
      });
    }
    
    const bundle = syntheaPatientGeneratorService.generatePatientBundle(preset.config);
    
    res.json({
      success: true,
      preset: preset.name,
      description: preset.description,
      patientCount: preset.config.count,
      totalResources: bundle.total,
      bundle,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PHI De-identification ====================

router.get("/deidentify/config", async (req: Request, res: Response) => {
  try {
    const defaultConfig = phiDeidentificationService.getDefaultConfig();
    const hipaaIdentifiers = phiDeidentificationService.getHIPAAIdentifiers();
    
    res.json({
      success: true,
      defaultConfig,
      hipaaIdentifiers,
      modes: ["redact", "pseudonymize", "hash"],
      methods: ["safe_harbor", "expert_determination"],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const deidentifyConfigSchema = z.object({
  method: z.enum(["safe_harbor", "expert_determination"]).optional().default("safe_harbor"),
  mode: z.enum(["redact", "pseudonymize", "hash"]).optional().default("redact"),
  preserveStructure: z.boolean().optional().default(true),
  preserveDates: z.boolean().optional().default(false),
  dateShiftDays: z.number().optional(),
  hashSalt: z.string().optional(),
  auditLog: z.boolean().optional().default(true),
});

router.post("/deidentify/resource", async (req: Request, res: Response) => {
  try {
    const { resource, config: configInput } = req.body;
    
    if (!resource || !resource.resourceType) {
      return res.status(400).json({
        success: false,
        error: "Request must include a valid FHIR resource with resourceType",
      });
    }
    
    const config = configInput 
      ? { ...phiDeidentificationService.getDefaultConfig(), ...deidentifyConfigSchema.parse(configInput) }
      : phiDeidentificationService.getDefaultConfig();
    
    const result = phiDeidentificationService.deidentifyResource(resource, config);
    
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.post("/deidentify/bundle", async (req: Request, res: Response) => {
  try {
    const { bundle, config: configInput } = req.body;
    
    if (!bundle || bundle.resourceType !== "Bundle") {
      return res.status(400).json({
        success: false,
        error: "Request must include a valid FHIR Bundle",
      });
    }
    
    const config = configInput 
      ? { ...phiDeidentificationService.getDefaultConfig(), ...deidentifyConfigSchema.parse(configInput) }
      : phiDeidentificationService.getDefaultConfig();
    
    const result = phiDeidentificationService.deidentifyBundle(bundle, config);
    
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/deidentify/audit-log", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const auditLog = phiDeidentificationService.getAuditLog(limit);
    const stats = phiDeidentificationService.getStats();
    
    res.json({
      success: true,
      stats,
      auditLog,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/deidentify/reset", async (req: Request, res: Response) => {
  try {
    phiDeidentificationService.clearAuditLog();
    phiDeidentificationService.resetPseudonymMap();
    
    res.json({
      success: true,
      message: "Audit log cleared and pseudonym map reset",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Chaos Engineering ====================

router.get("/chaos/experiment-types", async (req: Request, res: Response) => {
  try {
    const types = chaosEngineeringService.getExperimentTypes();
    
    res.json({
      success: true,
      description: "Available chaos experiment types for HIPAA availability testing",
      types,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/chaos/health", async (req: Request, res: Response) => {
  try {
    const health = chaosEngineeringService.getCurrentHealth();
    const isRunning = chaosEngineeringService.isRunning();
    
    res.json({
      success: true,
      experimentRunning: isRunning,
      health,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const experimentConfigSchema = z.object({
  durationSeconds: z.number().min(5).max(300).default(30),
  intensity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  targetComponents: z.array(z.string()).optional(),
  failureRate: z.number().min(0).max(1).optional(),
  latencyMs: z.number().min(0).optional(),
  recoveryStrategy: z.enum(["automatic", "manual", "gradual"]).optional().default("automatic"),
});

const createExperimentSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "database_failure",
    "database_latency",
    "database_connection_pool_exhaustion",
    "network_latency",
    "network_partition",
    "service_degradation",
    "memory_pressure",
    "cpu_pressure",
    "disk_io_pressure",
    "cascading_failure",
  ]),
  config: experimentConfigSchema,
});

router.post("/chaos/experiments", async (req: Request, res: Response) => {
  try {
    const { name, type, config } = createExperimentSchema.parse(req.body);
    const experiment = await chaosEngineeringService.createExperiment(name, type, config);
    
    res.json({
      success: true,
      message: "Chaos experiment created",
      experiment,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/chaos/experiments", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const experiments = chaosEngineeringService.listExperiments(status as any);
    
    res.json({
      success: true,
      count: experiments.length,
      experiments,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/chaos/experiments/:experimentId", async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;
    const experiment = chaosEngineeringService.getExperiment(experimentId);
    
    if (!experiment) {
      return res.status(404).json({ success: false, error: "Experiment not found" });
    }
    
    res.json({
      success: true,
      experiment,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/chaos/experiments/:experimentId/run", async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;
    
    if (chaosEngineeringService.isRunning()) {
      return res.status(409).json({
        success: false,
        error: "Another experiment is already running",
      });
    }
    
    const experiment = await chaosEngineeringService.runExperiment(experimentId);
    
    res.json({
      success: true,
      message: "Experiment completed",
      experiment,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/chaos/experiments/:experimentId/cancel", async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;
    const experiment = chaosEngineeringService.cancelExperiment(experimentId);
    
    if (!experiment) {
      return res.status(404).json({ success: false, error: "Experiment not found" });
    }
    
    res.json({
      success: true,
      message: "Experiment cancelled",
      experiment,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/chaos/compliance-report", async (req: Request, res: Response) => {
  try {
    const report = chaosEngineeringService.getComplianceReport();
    
    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/chaos/health-snapshots", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const snapshots = chaosEngineeringService.getHealthSnapshots(limit);
    
    res.json({
      success: true,
      count: snapshots.length,
      snapshots,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Dashboard ====================

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const syntheaPresets = syntheaPatientGeneratorService.getDatasetPresets();
    const deidentifyStats = phiDeidentificationService.getStats();
    const chaosTypes = chaosEngineeringService.getExperimentTypes();
    const complianceReport = chaosEngineeringService.getComplianceReport();
    
    res.json({
      success: true,
      complianceTesting: {
        synthea: {
          description: "Synthea™ Synthetic Patient Data Generator",
          availablePresets: syntheaPresets.length,
          features: [
            "FHIR R4 compatible output",
            "Medical history generation",
            "Medications and prescriptions",
            "Lab results and vital signs",
            "Social determinants of health",
            "Clearly tagged as synthetic data",
          ],
        },
        deidentification: {
          description: "PHI De-identification Service",
          stats: deidentifyStats,
          methods: ["HIPAA Safe Harbor", "Expert Determination"],
          modes: ["Redact", "Pseudonymize", "Hash"],
          features: [
            "18 HIPAA identifier types",
            "FHIR resource support",
            "Audit logging",
            "Consistent pseudonymization",
          ],
        },
        chaosEngineering: {
          description: "Chaos Engineering for HIPAA Availability",
          experimentTypes: chaosTypes.length,
          complianceReport,
          features: [
            "Database failure simulation",
            "Network latency injection",
            "Service degradation testing",
            "HIPAA availability verification",
            "Compliance reporting",
          ],
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
