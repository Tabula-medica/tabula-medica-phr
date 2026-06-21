import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  workflowAutomationService,
  FHIREventTrigger,
  RemediationTask,
  SecurityRecommendation,
  EventDrivenRule,
  QualityThresholdConfig,
  AutomatedReportTrigger,
  GeneratedReport
} from "./services/ai-workflow-automation";

const router = Router();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details: {
      ...details,
      patientId: details.patientId ? hashForAudit(String(details.patientId)) : undefined
    },
    noCdsCompliance: "Workflow automation audit log. Operations are for data governance only, not clinical decision-making."
  };
  console.log("[HIPAA-AUDIT][WORKFLOW-AUTOMATION]", JSON.stringify(auditEntry));
}

const FHIREventSchema = z.object({
  eventType: z.enum(["resource_created", "resource_updated", "resource_deleted", "batch_import"]),
  resourceType: z.string().min(1),
  patientId: z.string().min(1),
  resourceId: z.string().min(1),
  sourceSystem: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

const SecurityFindingSchema = z.object({
  findingId: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["access_control", "encryption", "audit_logging", "consent_management", "network_security", "data_masking"]),
  currentConfiguration: z.record(z.unknown())
});

const TaskUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  assignedTo: z.string().optional()
});

router.get("/stats", (req: Request, res: Response) => {
  logHIPAAAudit("GET_WORKFLOW_STATS", {}, req);

  try {
    const stats = workflowAutomationService.getStats();
    res.json({
      stats,
      noCdsCompliance: "Workflow automation statistics for operational monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting workflow stats:", error);
    res.status(500).json({ error: "Failed to get workflow statistics" });
  }
});

router.post("/process-event", async (req: Request, res: Response) => {
  try {
    const validation = FHIREventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid event data", details: validation.error.errors });
    }

    const event: FHIREventTrigger = {
      id: `event-${crypto.randomUUID().slice(0, 8)}`,
      ...validation.data,
      timestamp: new Date()
    };

    logHIPAAAudit("PROCESS_FHIR_EVENT", {
      eventType: event.eventType,
      resourceType: event.resourceType,
      patientId: event.patientId
    }, req);

    const result = await workflowAutomationService.processFHIREvent(event);

    res.json({
      eventId: event.id,
      processed: true,
      assessmentsGenerated: result.assessments.length,
      medicationAlertsGenerated: result.medicationAlerts.length,
      remediationTasksCreated: result.tasks.length,
      assessments: result.assessments,
      medicationAlerts: result.medicationAlerts,
      tasks: result.tasks,
      noCdsCompliance: result.noCdsCompliance
    });
  } catch (error) {
    console.error("Error processing FHIR event:", error);
    res.status(500).json({ error: "Failed to process FHIR event" });
  }
});

router.get("/assessments", (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;

  logHIPAAAudit("GET_ASSESSMENTS", { patientId }, req);

  try {
    const assessments = workflowAutomationService.getDataQualityAssessments(patientId);
    res.json({
      assessments,
      count: assessments.length,
      noCdsCompliance: "Data quality assessments for governance purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting assessments:", error);
    res.status(500).json({ error: "Failed to get assessments" });
  }
});

router.get("/medication-alerts", (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;

  logHIPAAAudit("GET_MEDICATION_ALERTS", { patientId }, req);

  try {
    const alerts = workflowAutomationService.getMedicationDataAlerts(patientId);
    res.json({
      alerts,
      count: alerts.length,
      noCdsCompliance: "Medication DATA QUALITY alerts only. These are NOT clinical drug interaction warnings. Data reconciliation purposes only."
    });
  } catch (error) {
    console.error("Error getting medication alerts:", error);
    res.status(500).json({ error: "Failed to get medication alerts" });
  }
});

router.get("/tasks", (req: Request, res: Response) => {
  const status = req.query.status as RemediationTask["status"] | undefined;

  logHIPAAAudit("GET_REMEDIATION_TASKS", { status }, req);

  try {
    const tasks = workflowAutomationService.getRemediationTasks(status);
    res.json({
      tasks,
      count: tasks.length,
      byPriority: {
        urgent: tasks.filter(t => t.priority === "urgent").length,
        high: tasks.filter(t => t.priority === "high").length,
        medium: tasks.filter(t => t.priority === "medium").length,
        low: tasks.filter(t => t.priority === "low").length
      },
      noCdsCompliance: "Data remediation tasks for governance purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting tasks:", error);
    res.status(500).json({ error: "Failed to get remediation tasks" });
  }
});

router.patch("/tasks/:taskId", (req: Request, res: Response) => {
  const { taskId } = req.params;

  try {
    const validation = TaskUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid update data", details: validation.error.errors });
    }

    logHIPAAAudit("UPDATE_TASK", { taskId, ...validation.data }, req);

    const task = workflowAutomationService.updateTaskStatus(
      taskId,
      validation.data.status,
      validation.data.assignedTo
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      task,
      noCdsCompliance: "Task status update for governance purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.get("/security-recommendations", (req: Request, res: Response) => {
  const severity = req.query.severity as SecurityRecommendation["findingSeverity"] | undefined;

  logHIPAAAudit("GET_SECURITY_RECOMMENDATIONS", { severity }, req);

  try {
    const recommendations = workflowAutomationService.getSecurityRecommendations(severity);
    res.json({
      recommendations,
      count: recommendations.length,
      bySeverity: {
        critical: recommendations.filter(r => r.findingSeverity === "critical").length,
        high: recommendations.filter(r => r.findingSeverity === "high").length,
        medium: recommendations.filter(r => r.findingSeverity === "medium").length,
        low: recommendations.filter(r => r.findingSeverity === "low").length
      },
      noCdsCompliance: "Security configuration recommendations for infrastructure purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting security recommendations:", error);
    res.status(500).json({ error: "Failed to get security recommendations" });
  }
});

router.post("/security-recommendations", async (req: Request, res: Response) => {
  try {
    const validation = SecurityFindingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid finding data", details: validation.error.errors });
    }

    logHIPAAAudit("GENERATE_SECURITY_RECOMMENDATION", {
      findingId: validation.data.findingId,
      severity: validation.data.severity,
      category: validation.data.category
    }, req);

    const recommendation = await workflowAutomationService.generateSecurityRecommendation(
      validation.data.findingId,
      validation.data.severity,
      validation.data.category,
      validation.data.currentConfiguration
    );

    res.json({
      recommendation,
      noCdsCompliance: recommendation.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating security recommendation:", error);
    res.status(500).json({ error: "Failed to generate security recommendation" });
  }
});

router.get("/event-log", (req: Request, res: Response) => {
  logHIPAAAudit("GET_EVENT_LOG", {}, req);

  try {
    const events = workflowAutomationService.getEventLog();
    res.json({
      events,
      count: events.length,
      noCdsCompliance: "FHIR event log for operational monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting event log:", error);
    res.status(500).json({ error: "Failed to get event log" });
  }
});

router.get("/event-rules", (req: Request, res: Response) => {
  logHIPAAAudit("GET_EVENT_RULES", {}, req);

  try {
    const rules = workflowAutomationService.getEventDrivenRules();
    res.json({
      rules,
      count: rules.length,
      noCdsCompliance: "Event-driven automation rules for operational purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting event rules:", error);
    res.status(500).json({ error: "Failed to get event rules" });
  }
});

const EventRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  eventPattern: z.object({
    resourceType: z.string(),
    eventType: z.enum(["resource_created", "resource_updated", "resource_deleted", "batch_import"]),
    conditions: z.record(z.unknown()).optional()
  }),
  action: z.object({
    type: z.enum(["generate_report", "send_notification", "create_task", "trigger_workflow"]),
    reportType: z.enum(["patient_summary", "discharge_summary", "compliance_report", "quality_report", "audit_report"]).optional(),
    priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
    notifyRoles: z.array(z.string()).optional()
  }),
  enabled: z.boolean()
});

router.post("/event-rules", async (req: Request, res: Response) => {
  try {
    const validation = EventRuleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid rule data", details: validation.error.errors });
    }

    const rule = workflowAutomationService.createEventDrivenRule(validation.data);
    logHIPAAAudit("CREATE_EVENT_RULE", { ruleId: rule.id }, req);

    res.status(201).json({
      rule,
      noCdsCompliance: "Event-driven rule created for automation purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error creating event rule:", error);
    res.status(500).json({ error: "Failed to create event rule" });
  }
});

router.patch("/event-rules/:ruleId", async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const rule = workflowAutomationService.updateEventDrivenRule(ruleId, req.body);

    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    logHIPAAAudit("UPDATE_EVENT_RULE", { ruleId }, req);
    res.json({ rule });
  } catch (error) {
    console.error("Error updating event rule:", error);
    res.status(500).json({ error: "Failed to update event rule" });
  }
});

router.delete("/event-rules/:ruleId", (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const deleted = workflowAutomationService.deleteEventDrivenRule(ruleId);

    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }

    logHIPAAAudit("DELETE_EVENT_RULE", { ruleId }, req);
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    console.error("Error deleting event rule:", error);
    res.status(500).json({ error: "Failed to delete event rule" });
  }
});

router.get("/quality-thresholds", (req: Request, res: Response) => {
  logHIPAAAudit("GET_QUALITY_THRESHOLDS", {}, req);

  try {
    const thresholds = workflowAutomationService.getQualityThresholds();
    res.json({
      thresholds,
      count: thresholds.length,
      noCdsCompliance: "Quality threshold configurations for data governance only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting quality thresholds:", error);
    res.status(500).json({ error: "Failed to get quality thresholds" });
  }
});

const QualityThresholdSchema = z.object({
  name: z.string().min(1),
  thresholdType: z.enum(["data_quality", "completeness", "timeliness", "accuracy"]),
  thresholdValue: z.number().min(0).max(100),
  comparisonOperator: z.enum(["lt", "lte", "gt", "gte", "eq"]),
  reportType: z.enum(["patient_summary", "discharge_summary", "compliance_report", "quality_report", "audit_report"]),
  enabled: z.boolean(),
  notifyRoles: z.array(z.string())
});

router.post("/quality-thresholds", async (req: Request, res: Response) => {
  try {
    const validation = QualityThresholdSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid threshold data", details: validation.error.errors });
    }

    const threshold = workflowAutomationService.createQualityThreshold(validation.data);
    logHIPAAAudit("CREATE_QUALITY_THRESHOLD", { thresholdId: threshold.id }, req);

    res.status(201).json({
      threshold,
      noCdsCompliance: "Quality threshold created for data governance only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error creating quality threshold:", error);
    res.status(500).json({ error: "Failed to create quality threshold" });
  }
});

router.patch("/quality-thresholds/:thresholdId", async (req: Request, res: Response) => {
  try {
    const { thresholdId } = req.params;
    const threshold = workflowAutomationService.updateQualityThreshold(thresholdId, req.body);

    if (!threshold) {
      return res.status(404).json({ error: "Threshold not found" });
    }

    logHIPAAAudit("UPDATE_QUALITY_THRESHOLD", { thresholdId }, req);
    res.json({ threshold });
  } catch (error) {
    console.error("Error updating quality threshold:", error);
    res.status(500).json({ error: "Failed to update quality threshold" });
  }
});

router.delete("/quality-thresholds/:thresholdId", (req: Request, res: Response) => {
  try {
    const { thresholdId } = req.params;
    const deleted = workflowAutomationService.deleteQualityThreshold(thresholdId);

    if (!deleted) {
      return res.status(404).json({ error: "Threshold not found" });
    }

    logHIPAAAudit("DELETE_QUALITY_THRESHOLD", { thresholdId }, req);
    res.json({ success: true, message: "Threshold deleted" });
  } catch (error) {
    console.error("Error deleting quality threshold:", error);
    res.status(500).json({ error: "Failed to delete quality threshold" });
  }
});

router.get("/reports", (req: Request, res: Response) => {
  logHIPAAAudit("GET_AUTOMATED_REPORTS", {}, req);

  try {
    const reportType = req.query.type as GeneratedReport["reportType"] | undefined;
    const reports = workflowAutomationService.getGeneratedReports(reportType);
    res.json({
      reports,
      count: reports.length,
      noCdsCompliance: "Automated reports for administrative purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting automated reports:", error);
    res.status(500).json({ error: "Failed to get automated reports" });
  }
});

router.get("/reports/:reportId", (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = workflowAutomationService.getReportById(reportId);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    logHIPAAAudit("GET_REPORT_DETAILS", { reportId }, req);
    res.json({ report });
  } catch (error) {
    console.error("Error getting report:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
});

router.get("/report-triggers", (req: Request, res: Response) => {
  logHIPAAAudit("GET_REPORT_TRIGGERS", {}, req);

  try {
    const status = req.query.status as AutomatedReportTrigger["status"] | undefined;
    const triggers = workflowAutomationService.getAutomatedReportTriggers(status);
    res.json({
      triggers,
      count: triggers.length,
      noCdsCompliance: "Report triggers for operational monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting report triggers:", error);
    res.status(500).json({ error: "Failed to get report triggers" });
  }
});

router.post("/simulate/discharge", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    logHIPAAAudit("SIMULATE_DISCHARGE_EVENT", { patientId }, req);
    const result = await workflowAutomationService.simulateDischargeEvent(patientId);

    res.json({
      success: true,
      event: result.event,
      matchedRules: result.matchedRules.length,
      triggeredReports: result.triggeredReports.length,
      generatedReports: result.generatedReports,
      noCdsCompliance: result.noCdsCompliance
    });
  } catch (error) {
    console.error("Error simulating discharge event:", error);
    res.status(500).json({ error: "Failed to simulate discharge event" });
  }
});

router.post("/simulate/quality-breach", async (req: Request, res: Response) => {
  try {
    const { score, thresholdType } = req.body;
    if (score === undefined || !thresholdType) {
      return res.status(400).json({ error: "score and thresholdType are required" });
    }

    logHIPAAAudit("SIMULATE_QUALITY_BREACH", { score, thresholdType }, req);
    const result = await workflowAutomationService.simulateQualityThresholdBreach(score, thresholdType);

    res.json({
      success: true,
      currentScore: result.currentScore,
      thresholdType: result.thresholdType,
      breached: result.breached,
      breachedThresholds: result.thresholds.length,
      triggeredReports: result.triggeredReports.length,
      generatedReports: result.generatedReports,
      noCdsCompliance: result.noCdsCompliance
    });
  } catch (error) {
    console.error("Error simulating quality breach:", error);
    res.status(500).json({ error: "Failed to simulate quality breach" });
  }
});

router.post("/process-event-with-rules", async (req: Request, res: Response) => {
  try {
    const validation = FHIREventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid event data", details: validation.error.errors });
    }

    const event: FHIREventTrigger = {
      id: `event-${crypto.randomUUID().slice(0, 8)}`,
      ...validation.data,
      timestamp: new Date()
    };

    logHIPAAAudit("PROCESS_EVENT_WITH_RULES", { eventId: event.id, resourceType: event.resourceType }, req);
    const result = await workflowAutomationService.processEventWithRules(event);

    res.json({
      event,
      matchedRules: result.matchedRules,
      triggeredReports: result.triggeredReports,
      noCdsCompliance: result.noCdsCompliance
    });
  } catch (error) {
    console.error("Error processing event with rules:", error);
    res.status(500).json({ error: "Failed to process event" });
  }
});

export default router;
