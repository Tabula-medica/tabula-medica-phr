import { Router, Request, Response } from "express";
import { z } from "zod";
import * as qualityEngine from "./services/ai-fhir-data-quality-engine";
import { requireRole } from "./rbac";
import crypto from "crypto";

function hashIdentifier(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 16);
}

const router = Router();

function getRequestInfo(req: Request): { userId: string; ipAddress: string } {
  const user = (req as any).user;
  return {
    userId: user?.id || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
  };
}

router.post("/analyze",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { resource, generateSuggestions = true } = req.body;
      
      if (!resource || !resource.resourceType) {
        return res.status(400).json({ error: "Valid FHIR resource with resourceType required" });
      }

      const issues = await qualityEngine.analyzeResource(resource, generateSuggestions);

      res.json({
        success: true,
        resourceType: resource.resourceType,
        resourceId: hashIdentifier(resource.id || "unknown"),
        issuesFound: issues.length,
        issues,
        compliance: {
          noCdsPolicy: "ENFORCED",
          identifiersHashed: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const runScanSchema = z.object({
  profileId: z.string().optional().default("default-comprehensive"),
  resources: z.array(z.record(z.unknown())),
});

router.post("/scan",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = runScanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const scan = await qualityEngine.runQualityScan(
        validation.data.profileId,
        validation.data.resources,
        userId,
        ipAddress
      );

      res.json({
        success: true,
        scan,
        compliance: {
          noCdsPolicy: "ENFORCED",
          auditLogging: "ENABLED",
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/scans",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const scans = qualityEngine.getScans(limit);
      res.json({ success: true, scans, total: scans.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/scans/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const scan = qualityEngine.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      res.json({ success: true, scan });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/issues",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        resourceType: req.query.resourceType as string | undefined,
        severity: req.query.severity as qualityEngine.QualityIssueSeverity | undefined,
        status: req.query.status as qualityEngine.QualityIssueStatus | undefined,
        issueType: req.query.issueType as qualityEngine.QualityIssueType | undefined,
        patientId: req.query.patientId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const limit = parseInt(req.query.limit as string) || 100;

      const issues = qualityEngine.getIssues(filters, limit);
      res.json({ success: true, issues, total: issues.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/issues/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const issue = qualityEngine.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      res.json({ success: true, issue });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const updateIssueSchema = z.object({
  status: z.enum(["detected", "pending_review", "correction_suggested", "auto_corrected", "manually_corrected", "dismissed", "escalated"]),
  notes: z.string().optional(),
});

router.patch("/issues/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = updateIssueSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const issue = await qualityEngine.updateIssueStatus(
        req.params.id,
        validation.data.status,
        userId,
        ipAddress,
        validation.data.notes
      );

      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      res.json({ success: true, issue });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/corrections",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const issueId = req.query.issueId as string | undefined;
      const corrections = qualityEngine.getCorrections(issueId);
      res.json({ success: true, corrections, total: corrections.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/corrections/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const correction = qualityEngine.getCorrection(req.params.id);
      if (!correction) {
        return res.status(404).json({ error: "Correction not found" });
      }
      res.json({ success: true, correction });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/corrections/:id/approve",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const result = await qualityEngine.approveCorrection(req.params.id, userId, ipAddress);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, correction: result.correction });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/corrections/:id/apply",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const result = await qualityEngine.applyCorrection(req.params.id, userId, ipAddress);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, issue: result.issue });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/profiles",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const profiles = qualityEngine.getProfiles();
      res.json({ success: true, profiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/profiles/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const profile = qualityEngine.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const createProfileSchema = z.object({
  name: z.string(),
  description: z.string(),
  resourceTypes: z.array(z.string()),
  issueTypesMonitored: z.array(z.enum([
    "missing_required_field",
    "invalid_code_system",
    "inconsistent_data",
    "orphaned_reference",
    "stale_data",
    "duplicate_record",
    "format_violation",
    "business_rule_violation",
    "terminology_mismatch",
    "temporal_inconsistency",
  ])),
  severityThreshold: z.enum(["critical", "high", "medium", "low"]),
  autoCorrectEnabled: z.boolean().default(false),
  autoCorrectThreshold: z.number().min(0).max(1).default(0.95),
  escalationRules: z.array(z.object({
    condition: z.string(),
    escalateTo: z.string(),
    priority: z.enum(["urgent", "high", "normal"]),
    notifyChannels: z.array(z.enum(["email", "in_app", "webhook"])),
  })).default([]),
  isActive: z.boolean().default(true),
});

router.post("/profiles",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = createProfileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const profile = await qualityEngine.createProfile(validation.data, userId, ipAddress);

      res.status(201).json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch("/profiles/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const profile = await qualityEngine.updateProfile(req.params.id, req.body, userId, ipAddress);

      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      res.json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/metrics",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const metrics = qualityEngine.getMetrics();
      res.json({
        success: true,
        metrics,
        compliance: {
          noCdsPolicy: "ENFORCED",
          auditLogging: "ENABLED",
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/issue-types",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      types: [
        { id: "missing_required_field", name: "Missing Required Field", description: "Required FHIR field is not present" },
        { id: "invalid_code_system", name: "Invalid Code System", description: "Code does not use standard terminology (LOINC, SNOMED, etc.)" },
        { id: "inconsistent_data", name: "Inconsistent Data", description: "Data conflicts between multiple sources" },
        { id: "orphaned_reference", name: "Orphaned Reference", description: "Reference to non-existent resource" },
        { id: "stale_data", name: "Stale Data", description: "Data has not been updated within expected timeframe" },
        { id: "duplicate_record", name: "Duplicate Record", description: "Potential duplicate detected across sources" },
        { id: "format_violation", name: "Format Violation", description: "Data format does not match FHIR specification" },
        { id: "business_rule_violation", name: "Business Rule Violation", description: "Data violates organization-specific rules" },
        { id: "terminology_mismatch", name: "Terminology Mismatch", description: "Inconsistent terminology usage across records" },
        { id: "temporal_inconsistency", name: "Temporal Inconsistency", description: "Date/time values are logically inconsistent" },
      ],
    });
  }
);

router.get("/severity-levels",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      levels: [
        { id: "critical", name: "Critical", description: "Data quality issue that may impact patient safety", priority: 4 },
        { id: "high", name: "High", description: "Significant data quality issue requiring prompt attention", priority: 3 },
        { id: "medium", name: "Medium", description: "Moderate data quality issue", priority: 2 },
        { id: "low", name: "Low", description: "Minor data quality issue", priority: 1 },
      ],
    });
  }
);

router.get("/resource-types",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      resourceTypes: [
        "Patient",
        "Observation",
        "Condition",
        "MedicationRequest",
        "AllergyIntolerance",
        "Procedure",
        "DiagnosticReport",
        "Immunization",
        "Encounter",
        "CarePlan",
      ],
    });
  }
);

const recordFeedbackSchema = z.object({
  issueId: z.string(),
  outcome: z.enum(["accepted", "modified", "rejected", "dismissed"]),
  appliedCorrection: z.unknown(),
  userModification: z.string().optional(),
});

router.post("/learning/feedback",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = recordFeedbackSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId } = getRequestInfo(req);
      const feedback = await qualityEngine.recordCorrectionFeedback(
        validation.data.issueId,
        validation.data.outcome,
        validation.data.appliedCorrection,
        userId,
        validation.data.userModification
      );

      res.json({
        success: true,
        feedback,
        message: "Feedback recorded and learning patterns updated",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/learning/insights",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const insights = qualityEngine.getLearningInsights();
      res.json({
        success: true,
        insights,
        compliance: {
          noCdsPolicy: "ENFORCED",
          learningActive: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/learning/patterns",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        resourceType: req.query.resourceType as string | undefined,
        issueType: req.query.issueType as qualityEngine.QualityIssueType | undefined,
        minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences as string) : undefined,
      };

      const patterns = qualityEngine.getPatterns(filters);
      res.json({
        success: true,
        patterns,
        total: patterns.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/learning/feedback",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        issueId: req.query.issueId as string | undefined,
        outcome: req.query.outcome as qualityEngine.CorrectionOutcome | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const limit = parseInt(req.query.limit as string) || 100;

      const feedback = qualityEngine.getFeedback(filters, limit);
      res.json({
        success: true,
        feedback,
        total: feedback.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/learning/anomaly-analysis",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const analysis = await qualityEngine.analyzeAnomalyPatterns();
      res.json({
        success: true,
        ...analysis,
        compliance: {
          noCdsPolicy: "ENFORCED",
          learningActive: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/learning/calibrated-confidence",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { resourceType, issueType, baseConfidence, fieldPath } = req.query;

      if (!resourceType || !issueType || baseConfidence === undefined) {
        return res.status(400).json({ error: "resourceType, issueType, and baseConfidence are required" });
      }

      const calibrated = qualityEngine.getCalibratedConfidence(
        resourceType as string,
        issueType as qualityEngine.QualityIssueType,
        parseFloat(baseConfidence as string),
        fieldPath as string | undefined
      );

      res.json({
        success: true,
        original: parseFloat(baseConfidence as string),
        calibrated,
        adjustment: calibrated - parseFloat(baseConfidence as string),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
