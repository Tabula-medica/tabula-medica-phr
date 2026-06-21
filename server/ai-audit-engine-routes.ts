import { Router, Request, Response } from "express";
import { z } from "zod";
import * as auditEngine from "./services/ai-audit-engine";
import { requireRole } from "./rbac";

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
      const { startDate, endDate } = req.body;
      
      const now = new Date();
      const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || now.toISOString();

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await auditEngine.runAuditAnalysis(start, end, userId, ipAddress);

      res.json({
        success: true,
        ...result,
        compliance: {
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
          identifiersHashed: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/anomalies",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        type: req.query.type as auditEngine.AnomalyType | undefined,
        severity: req.query.severity as auditEngine.SeverityLevel | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const limit = parseInt(req.query.limit as string) || 100;

      const anomalies = auditEngine.getAnomalies(filters, limit);
      res.json({ success: true, anomalies, total: anomalies.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/anomalies/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const anomaly = auditEngine.getAnomaly(req.params.id);
      if (!anomaly) {
        return res.status(404).json({ error: "Anomaly not found" });
      }
      res.json({ success: true, anomaly });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const updateAnomalySchema = z.object({
  status: z.enum(["new", "acknowledged", "investigating", "resolved", "false_positive"]),
  notes: z.string().optional(),
});

router.patch("/anomalies/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = updateAnomalySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const anomaly = await auditEngine.updateAnomalyStatus(
        req.params.id,
        validation.data.status,
        userId,
        ipAddress,
        validation.data.notes
      );

      if (!anomaly) {
        return res.status(404).json({ error: "Anomaly not found" });
      }

      res.json({ success: true, anomaly });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const generateReportSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "on_demand"]),
  customPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

router.post("/reports",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = generateReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const report = await auditEngine.generateAuditReport(
        validation.data.type,
        userId,
        ipAddress,
        validation.data.customPeriod
      );

      res.json({
        success: true,
        report,
        compliance: {
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reports",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const reports = auditEngine.getReports(type, limit);
      res.json({ success: true, reports, total: reports.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reports/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const report = auditEngine.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json({ success: true, report });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/alert-configs",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const configs = auditEngine.getAlertConfigs();
      res.json({ success: true, configs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/alert-configs/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const config = auditEngine.getAlertConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Alert configuration not found" });
      }
      res.json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const createAlertConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  anomalyTypes: z.array(z.enum([
    "unusual_access_time",
    "high_failure_rate",
    "large_data_transfer",
    "unauthorized_access_attempt",
    "repeated_auth_failures",
    "rate_limit_exceeded",
    "unusual_access_pattern",
    "compliance_deviation",
    "data_exfiltration_risk",
    "hipaa_minimum_necessary_violation",
    "gdpr_data_minimization_violation",
    "phi_excessive_access",
    "pii_excessive_access",
    "sensitive_data_correlation_alert",
  ])),
  severityThreshold: z.enum(["critical", "high", "medium", "low", "info"]),
  notificationChannels: z.array(z.enum(["email", "webhook", "in_app"])),
  recipients: z.array(z.string()),
  webhookUrl: z.string().url().optional(),
  cooldownMinutes: z.number().min(1).default(30),
});

router.post("/alert-configs",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = createAlertConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const config = await auditEngine.createAlertConfig(validation.data, userId, ipAddress);

      res.status(201).json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch("/alert-configs/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const config = await auditEngine.updateAlertConfig(req.params.id, req.body, userId, ipAddress);

      if (!config) {
        return res.status(404).json({ error: "Alert configuration not found" });
      }

      res.json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete("/alert-configs/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const deleted = await auditEngine.deleteAlertConfig(req.params.id, userId, ipAddress);

      if (!deleted) {
        return res.status(404).json({ error: "Alert configuration not found" });
      }

      res.json({ success: true, message: "Alert configuration deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/alert-history",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const configId = req.query.configId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      const history = auditEngine.getAlertHistory(configId, limit);
      res.json({ success: true, history, total: history.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = auditEngine.getAuditEngineStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/anomaly-types",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      types: [
        { id: "unusual_access_time", name: "Unusual Access Time", description: "Access outside normal business hours" },
        { id: "high_failure_rate", name: "High Failure Rate", description: "External sync failures exceed threshold" },
        { id: "large_data_transfer", name: "Large Data Transfer", description: "Unusually large data transfer detected" },
        { id: "unauthorized_access_attempt", name: "Unauthorized Access", description: "Attempt to access restricted resources" },
        { id: "repeated_auth_failures", name: "Auth Failures", description: "Multiple authentication failures from same source" },
        { id: "rate_limit_exceeded", name: "Rate Limit Exceeded", description: "API rate limits exceeded" },
        { id: "unusual_access_pattern", name: "Unusual Pattern", description: "Access patterns deviate from normal behavior" },
        { id: "compliance_deviation", name: "Compliance Deviation", description: "Actions that may violate compliance policies" },
        { id: "data_exfiltration_risk", name: "Exfiltration Risk", description: "Potential data exfiltration detected" },
        { id: "hipaa_minimum_necessary_violation", name: "HIPAA Minimum Necessary", description: "Violation of HIPAA minimum necessary access principle" },
        { id: "gdpr_data_minimization_violation", name: "GDPR Data Minimization", description: "Violation of GDPR data minimization principle" },
        { id: "phi_excessive_access", name: "PHI Excessive Access", description: "Excessive protected health information access" },
        { id: "pii_excessive_access", name: "PII Excessive Access", description: "Excessive personally identifiable information access" },
        { id: "sensitive_data_correlation_alert", name: "Sensitive Data Correlation", description: "Cross-category sensitive data access pattern" },
      ],
    });
  }
);

const forensicAnalysisSchema = z.object({
  analysisType: z.enum(["exfiltration", "minimum_necessary", "data_minimization", "sensitive_access"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.post("/forensic-analysis",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = forensicAnalysisSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const now = new Date();
      const startDate = validation.data.startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = validation.data.endDate || now.toISOString();

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await auditEngine.runForensicAnalysis(
        validation.data.analysisType,
        startDate,
        endDate,
        userId,
        ipAddress
      );

      res.json({
        success: true,
        analysis: result,
        compliance: {
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
          noClinicalDecisionSupport: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/forensic-analyses",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const analysisType = req.query.analysisType as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const analyses = auditEngine.getForensicAnalyses(analysisType, limit);
      res.json({ success: true, analyses, total: analyses.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/forensic-analyses/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const analysis = auditEngine.getForensicAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Forensic analysis not found" });
      }
      res.json({ success: true, analysis });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/forensic-analysis-types",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      types: [
        { 
          id: "exfiltration", 
          name: "Data Exfiltration Analysis", 
          description: "Identify patterns of data exfiltration attempts by analyzing large transfers, access times, and resource types" 
        },
        { 
          id: "minimum_necessary", 
          name: "HIPAA Minimum Necessary Analysis", 
          description: "Detect violations of HIPAA minimum necessary access principle by correlating role-based access with actual data access" 
        },
        { 
          id: "data_minimization", 
          name: "GDPR Data Minimization Analysis", 
          description: "Flag violations of GDPR data minimization by analyzing purpose-limited access patterns" 
        },
        { 
          id: "sensitive_access", 
          name: "Sensitive Data Correlation Analysis", 
          description: "Correlate audit logs with PHI/PII access patterns to identify excessive or unusual sensitive data access" 
        },
      ],
    });
  }
);

router.get("/sensitive-data-categories",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      categories: [
        { id: "PHI", name: "Protected Health Information", description: "HIPAA-protected health information", regulatoryFramework: "HIPAA" },
        { id: "PII", name: "Personally Identifiable Information", description: "Personal identifiers", regulatoryFramework: "GDPR/CCPA" },
        { id: "clinical", name: "Clinical Data", description: "Medical diagnoses, treatments, and observations", regulatoryFramework: "HIPAA" },
        { id: "demographic", name: "Demographic Data", description: "Age, gender, ethnicity, location", regulatoryFramework: "GDPR" },
        { id: "financial", name: "Financial Data", description: "Insurance, billing, payment information", regulatoryFramework: "PCI-DSS" },
        { id: "genetic", name: "Genetic Data", description: "Genetic and hereditary health information", regulatoryFramework: "GINA/GDPR Article 9" },
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
        { id: "critical", name: "Critical", description: "Requires immediate attention", priority: 5 },
        { id: "high", name: "High", description: "Should be addressed promptly", priority: 4 },
        { id: "medium", name: "Medium", description: "Should be investigated", priority: 3 },
        { id: "low", name: "Low", description: "May need review", priority: 2 },
        { id: "info", name: "Informational", description: "For awareness only", priority: 1 },
      ],
    });
  }
);

export default router;
