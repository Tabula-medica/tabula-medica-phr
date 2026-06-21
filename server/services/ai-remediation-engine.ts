import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { automatedAlertingService } from "./automated-alerting";
import type {
  RemediationSourceType,
  RemediationRiskLevel,
  RemediationExecutionMode,
  RemediationWorkflowStatus,
  RemediationStepStatus,
  RemediationTrigger,
  RemediationStep,
  RemediationWorkflow,
  RemediationTemplate,
  RemediationApprovalRequest,
  RemediationMetrics,
  RemediationDashboard,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data remediation assistant. You analyze data quality and compliance issues to suggest remediation steps.

CRITICAL RESTRICTIONS:
- You MUST NOT provide any clinical decision support (CDS)
- You MUST NOT suggest diagnoses, treatments, or clinical interventions
- You MUST NOT interpret clinical significance of data
- You MUST focus ONLY on data quality, compliance, and interoperability remediation
- Your role is limited to data management, quality assurance, and regulatory compliance

Focus on:
- Data correction and normalization
- Compliance violation remediation
- Format standardization
- Missing data resolution
- Duplicate record handling
- Reference integrity fixes`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${createHash("sha256").update(match).digest("hex").substring(0, 8)}]`
    );
}

const workflowStore = new Map<string, RemediationWorkflow>();
const templateStore = new Map<string, RemediationTemplate>();
const approvalStore = new Map<string, RemediationApprovalRequest>();

const executionMetrics = {
  totalWorkflows: 0,
  completedWorkflows: 0,
  failedWorkflows: 0,
  autoRemediations: 0,
  guidedRemediations: 0,
  totalExecutionTimeMs: 0,
  rollbacks: 0,
};

class AIRemediationEngine {
  constructor() {
    this.initializeDefaultTemplates();
    console.log("[AIRemediationEngine] Service initialized");
  }

  private initializeDefaultTemplates(): void {
    const templates: RemediationTemplate[] = [
      {
        id: "template-missing-field",
        name: "Missing Required Field Remediation",
        description: "Auto-populate missing required fields with default or derived values",
        issueTypes: ["missing_required_field", "stale_data"],
        sourceTypes: ["data_quality", "compliance_monitoring"],
        applicableRiskLevels: ["low", "medium"],
        executionMode: "auto",
        autoExecuteThreshold: 0.85,
        stepTemplates: [
          {
            order: 1,
            name: "Validate Current State",
            description: "Verify the field is indeed missing and identify data source",
            actionType: "validate",
            actionConfig: { checkFieldExists: true, identifySource: true },
            preconditions: ["resource_accessible"],
            expectedOutcome: "Field absence confirmed, source identified",
            maxRetries: 1,
          },
          {
            order: 2,
            name: "Derive or Default Value",
            description: "Calculate appropriate value from related data or apply default",
            actionType: "transform",
            actionConfig: { derivationStrategy: "inference", fallbackToDefault: true },
            preconditions: ["validation_passed"],
            expectedOutcome: "Value determined for missing field",
            maxRetries: 1,
          },
          {
            order: 3,
            name: "Apply Correction",
            description: "Update the resource with the corrected value",
            actionType: "update",
            actionConfig: { preserveHistory: true, createSnapshot: true },
            preconditions: ["value_determined", "no_conflicts"],
            expectedOutcome: "Field populated with correct value",
            rollbackAction: { restoreFromSnapshot: true },
            maxRetries: 2,
          },
          {
            order: 4,
            name: "Audit Log Entry",
            description: "Record the correction in audit trail",
            actionType: "audit",
            actionConfig: { logLevel: "info", includeBeforeAfter: true },
            preconditions: ["update_successful"],
            expectedOutcome: "Audit entry created",
            maxRetries: 1,
          },
        ],
        validationRules: ["field_type_match", "value_in_range", "no_duplicate_correction"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "template-code-system-fix",
        name: "Invalid Code System Remediation",
        description: "Map invalid codes to correct code systems (ICD-10, SNOMED, LOINC)",
        issueTypes: ["invalid_code_system", "terminology_mismatch"],
        sourceTypes: ["data_quality", "compliance_monitoring"],
        applicableRiskLevels: ["low", "medium"],
        executionMode: "auto",
        autoExecuteThreshold: 0.9,
        stepTemplates: [
          {
            order: 1,
            name: "Identify Code System",
            description: "Determine the expected code system and current mapping",
            actionType: "validate",
            actionConfig: { identifyExpectedSystem: true, checkMappingExists: true },
            preconditions: ["resource_accessible"],
            expectedOutcome: "Code system requirements identified",
            maxRetries: 1,
          },
          {
            order: 2,
            name: "Lookup Code Mapping",
            description: "Find correct code in target system using crosswalk tables",
            actionType: "transform",
            actionConfig: { useCrosswalk: true, validateMapping: true },
            preconditions: ["mapping_available"],
            expectedOutcome: "Valid code mapping found",
            maxRetries: 1,
          },
          {
            order: 3,
            name: "Apply Code Correction",
            description: "Update resource with correct code and system",
            actionType: "update",
            actionConfig: { preserveOriginal: true, addMappingNote: true },
            preconditions: ["mapping_validated"],
            expectedOutcome: "Code corrected to proper system",
            rollbackAction: { restoreOriginalCode: true },
            maxRetries: 2,
          },
          {
            order: 4,
            name: "Log Terminology Change",
            description: "Record code mapping in audit trail",
            actionType: "audit",
            actionConfig: { logLevel: "info", category: "terminology" },
            preconditions: ["update_successful"],
            expectedOutcome: "Terminology change logged",
            maxRetries: 1,
          },
        ],
        validationRules: ["valid_target_code", "system_recognized", "mapping_confidence"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "template-compliance-violation",
        name: "Compliance Violation Remediation",
        description: "Address HIPAA/GDPR compliance violations with guided workflow",
        issueTypes: ["access_violation", "consent_violation", "retention_violation", "audit_gap"],
        sourceTypes: ["compliance_monitoring"],
        applicableRiskLevels: ["medium", "high", "critical"],
        executionMode: "guided",
        autoExecuteThreshold: 0.0,
        stepTemplates: [
          {
            order: 1,
            name: "Assess Violation Scope",
            description: "Determine the extent and impact of the violation",
            actionType: "validate",
            actionConfig: { assessImpact: true, identifyAffectedRecords: true },
            preconditions: ["violation_confirmed"],
            expectedOutcome: "Violation scope documented",
            maxRetries: 1,
          },
          {
            order: 2,
            name: "Generate Remediation Plan",
            description: "AI-assisted plan for addressing the violation",
            actionType: "transform",
            actionConfig: { generatePlan: true, requireApproval: true },
            preconditions: ["scope_assessed"],
            expectedOutcome: "Remediation plan created for review",
            maxRetries: 1,
          },
          {
            order: 3,
            name: "Execute Remediation",
            description: "Apply approved remediation steps",
            actionType: "update",
            actionConfig: { executeApprovedPlan: true, notifyStakeholders: true },
            preconditions: ["plan_approved"],
            expectedOutcome: "Violation remediated",
            rollbackAction: { documentRollbackReason: true },
            maxRetries: 2,
          },
          {
            order: 4,
            name: "Notify Compliance Officer",
            description: "Send notification to compliance team",
            actionType: "notify",
            actionConfig: { channel: "in_app", priority: "high" },
            preconditions: ["remediation_complete"],
            expectedOutcome: "Compliance team notified",
            maxRetries: 3,
          },
          {
            order: 5,
            name: "Create Compliance Audit Entry",
            description: "Document the violation and remediation in compliance log",
            actionType: "audit",
            actionConfig: { logLevel: "warning", category: "compliance", retentionYears: 7 },
            preconditions: ["notification_sent"],
            expectedOutcome: "Full audit trail created",
            maxRetries: 1,
          },
        ],
        validationRules: ["compliance_officer_approval", "documentation_complete", "no_recurring_violation"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "template-duplicate-resolution",
        name: "Duplicate Record Resolution",
        description: "Merge or flag duplicate patient/resource records",
        issueTypes: ["duplicate_record"],
        sourceTypes: ["data_quality", "predictive_alert"],
        applicableRiskLevels: ["medium", "high"],
        executionMode: "guided",
        autoExecuteThreshold: 0.0,
        stepTemplates: [
          {
            order: 1,
            name: "Confirm Duplicates",
            description: "Verify records are true duplicates with matching analysis",
            actionType: "validate",
            actionConfig: { matchScore: true, compareFields: true },
            preconditions: ["records_accessible"],
            expectedOutcome: "Duplicate status confirmed",
            maxRetries: 1,
          },
          {
            order: 2,
            name: "Identify Master Record",
            description: "Determine which record should be the master/survivor",
            actionType: "transform",
            actionConfig: { selectMaster: "most_complete", preserveHistory: true },
            preconditions: ["duplicates_confirmed"],
            expectedOutcome: "Master record identified",
            maxRetries: 1,
          },
          {
            order: 3,
            name: "Merge Records",
            description: "Combine data from duplicates into master record",
            actionType: "update",
            actionConfig: { mergeStrategy: "latest_wins", createAuditTrail: true },
            preconditions: ["master_approved", "merge_plan_reviewed"],
            expectedOutcome: "Records merged successfully",
            rollbackAction: { unmerge: true, restoreDuplicates: true },
            maxRetries: 2,
          },
          {
            order: 4,
            name: "Update References",
            description: "Redirect all references to deprecated records",
            actionType: "update",
            actionConfig: { updateReferences: true, markDeprecated: true },
            preconditions: ["merge_complete"],
            expectedOutcome: "All references updated",
            rollbackAction: { restoreReferences: true },
            maxRetries: 2,
          },
          {
            order: 5,
            name: "Audit Merge Operation",
            description: "Log the merge operation with full details",
            actionType: "audit",
            actionConfig: { logLevel: "info", category: "data_reconciliation" },
            preconditions: ["references_updated"],
            expectedOutcome: "Merge fully documented",
            maxRetries: 1,
          },
        ],
        validationRules: ["match_score_threshold", "no_data_loss", "references_integrity"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    templates.forEach((t) => templateStore.set(t.id, t));
    console.log(`[AIRemediationEngine] Initialized ${templates.length} default templates`);
  }

  private logAuditEvent(
    action: string,
    resource: string,
    userId: string,
    details: Record<string, unknown>
  ): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      resource,
      userId: hashIdentifier(userId),
      component: "AIRemediationEngine",
      details: sanitizePhi(JSON.stringify(details)),
    };
    console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
  }

  async createWorkflowFromTrigger(
    trigger: RemediationTrigger
  ): Promise<RemediationWorkflow | null> {
    const template = this.findMatchingTemplate(trigger);
    if (!template) {
      console.log(`[AIRemediationEngine] No matching template for trigger: ${trigger.issueType}`);
      return null;
    }

    const executionMode = this.determineExecutionMode(trigger, template);
    const requiresApproval = executionMode !== "auto" || trigger.severity === "critical" || trigger.severity === "high";

    const aiAnalysis = await this.generateAIAnalysis(trigger, template);

    const workflow: RemediationWorkflow = {
      id: randomUUID(),
      name: `${template.name} - ${trigger.title}`,
      description: `Automated remediation for ${trigger.issueType} issue`,
      trigger,
      executionMode,
      riskLevel: trigger.severity,
      steps: this.instantiateSteps(template.stepTemplates),
      status: "pending",
      priority: this.calculatePriority(trigger),
      aiAnalysis: aiAnalysis.analysis,
      aiConfidence: aiAnalysis.confidence,
      requiresApproval,
      createdAt: new Date().toISOString(),
      rollbackAvailable: template.stepTemplates.some((s) => s.rollbackAction),
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          action: "WORKFLOW_CREATED",
          actor: "system",
          details: { templateId: template.id, triggerId: trigger.sourceId },
        },
      ],
      metadata: { templateId: template.id },
    };

    workflowStore.set(workflow.id, workflow);
    executionMetrics.totalWorkflows++;

    this.logAuditEvent("WORKFLOW_CREATED", "remediation_workflow", "system", {
      workflowId: workflow.id,
      templateId: template.id,
      issueType: trigger.issueType,
      riskLevel: trigger.severity,
      executionMode,
    });

    if (requiresApproval) {
      await this.createApprovalRequest(workflow);
    } else if (executionMode === "auto") {
      setTimeout(() => this.executeWorkflow(workflow.id, "system"), 100);
    }

    return workflow;
  }

  private findMatchingTemplate(trigger: RemediationTrigger): RemediationTemplate | null {
    const templates = Array.from(templateStore.values());
    for (const template of templates) {
      if (!template.enabled) continue;
      if (!template.issueTypes.includes(trigger.issueType)) continue;
      if (!template.sourceTypes.includes(trigger.sourceType)) continue;
      if (!template.applicableRiskLevels.includes(trigger.severity)) continue;
      return template;
    }
    return null;
  }

  private determineExecutionMode(
    trigger: RemediationTrigger,
    template: RemediationTemplate
  ): RemediationExecutionMode {
    if (trigger.severity === "critical" || trigger.severity === "high") {
      return "guided";
    }
    return template.executionMode;
  }

  private calculatePriority(trigger: RemediationTrigger): number {
    const severityMap: Record<RemediationRiskLevel, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return severityMap[trigger.severity];
  }

  private instantiateSteps(
    stepTemplates: RemediationTemplate["stepTemplates"]
  ): RemediationStep[] {
    return stepTemplates.map((template) => ({
      id: randomUUID(),
      order: template.order,
      name: template.name,
      description: template.description,
      actionType: template.actionType,
      actionConfig: template.actionConfig,
      preconditions: template.preconditions,
      expectedOutcome: template.expectedOutcome,
      rollbackAction: template.rollbackAction,
      status: "pending" as RemediationStepStatus,
      retryCount: 0,
      maxRetries: template.maxRetries,
    }));
  }

  private async generateAIAnalysis(
    trigger: RemediationTrigger,
    template: RemediationTemplate
  ): Promise<{ analysis: string; confidence: number }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this data quality/compliance issue and provide remediation guidance:

Issue Type: ${trigger.issueType}
Severity: ${trigger.severity}
Title: ${trigger.title}
Description: ${sanitizePhi(trigger.description)}
Affected Resource: ${trigger.affectedResource.resourceType}
Template: ${template.name}

Provide:
1. Brief analysis of the issue (2-3 sentences)
2. Confidence level (0.0-1.0) for automated remediation
3. Any special considerations for this remediation

Format as JSON: {"analysis": "...", "confidence": 0.X, "considerations": ["..."]}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          analysis: parsed.analysis || "Automated analysis unavailable",
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        };
      }
    } catch (error) {
      console.log(`[AIRemediationEngine] AI analysis error: ${error}`);
    }

    return {
      analysis: `Issue detected: ${trigger.title}. Recommended remediation using ${template.name} template.`,
      confidence: 0.7,
    };
  }

  private async createApprovalRequest(workflow: RemediationWorkflow): Promise<void> {
    const approval: RemediationApprovalRequest = {
      id: randomUUID(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      trigger: workflow.trigger,
      proposedSteps: workflow.steps,
      aiAnalysis: workflow.aiAnalysis,
      aiConfidence: workflow.aiConfidence,
      riskAssessment: {
        overallRisk: workflow.riskLevel,
        potentialImpact: this.assessImpact(workflow),
        affectedResources: 1,
        reversible: workflow.rollbackAvailable,
      },
      requestedAt: new Date().toISOString(),
      requestedBy: "system",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    };

    approvalStore.set(approval.id, approval);
    workflow.status = "awaiting_approval";
    workflow.approvalRequest = {
      requestedAt: approval.requestedAt,
      requestedBy: "system",
      reason: `${workflow.riskLevel} risk remediation requires administrator approval`,
    };

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "APPROVAL_REQUESTED",
      actor: "system",
      details: { approvalId: approval.id },
    });

    this.logAuditEvent("APPROVAL_REQUESTED", "remediation_approval", "system", {
      approvalId: approval.id,
      workflowId: workflow.id,
      riskLevel: workflow.riskLevel,
    });

    automatedAlertingService.recordMetric(
      "remediation_approval_pending",
      1,
      { workflowId: workflow.id, riskLevel: workflow.riskLevel }
    );
  }

  private assessImpact(workflow: RemediationWorkflow): string {
    const impacts: string[] = [];
    if (workflow.riskLevel === "critical") {
      impacts.push("Critical data modification");
    }
    if (workflow.steps.some((s) => s.actionType === "update")) {
      impacts.push("Resource modification");
    }
    if (workflow.trigger.affectedResource.patientId) {
      impacts.push("Patient data affected");
    }
    return impacts.join("; ") || "Low impact remediation";
  }

  async approveWorkflow(
    workflowId: string,
    approvedBy: string,
    notes?: string
  ): Promise<RemediationWorkflow | null> {
    const workflow = workflowStore.get(workflowId);
    if (!workflow || workflow.status !== "awaiting_approval") {
      return null;
    }

    workflow.status = "approved";
    if (workflow.approvalRequest) {
      workflow.approvalRequest.approvedAt = new Date().toISOString();
      workflow.approvalRequest.approvedBy = hashIdentifier(approvedBy);
    }

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "WORKFLOW_APPROVED",
      actor: hashIdentifier(approvedBy),
      details: { notes },
    });

    const approval = Array.from(approvalStore.values()).find(
      (a) => a.workflowId === workflowId
    );
    if (approval) {
      approval.status = "approved";
      approval.reviewedAt = new Date().toISOString();
      approval.reviewedBy = hashIdentifier(approvedBy);
      approval.reviewNotes = notes;
    }

    this.logAuditEvent("WORKFLOW_APPROVED", "remediation_workflow", approvedBy, {
      workflowId,
      riskLevel: workflow.riskLevel,
    });

    setTimeout(() => this.executeWorkflow(workflowId, approvedBy), 100);

    return workflow;
  }

  async rejectWorkflow(
    workflowId: string,
    rejectedBy: string,
    reason: string
  ): Promise<RemediationWorkflow | null> {
    const workflow = workflowStore.get(workflowId);
    if (!workflow || workflow.status !== "awaiting_approval") {
      return null;
    }

    workflow.status = "cancelled";
    if (workflow.approvalRequest) {
      workflow.approvalRequest.rejectedAt = new Date().toISOString();
      workflow.approvalRequest.rejectedBy = hashIdentifier(rejectedBy);
      workflow.approvalRequest.rejectionReason = reason;
    }

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "WORKFLOW_REJECTED",
      actor: hashIdentifier(rejectedBy),
      details: { reason },
    });

    const approval = Array.from(approvalStore.values()).find(
      (a) => a.workflowId === workflowId
    );
    if (approval) {
      approval.status = "rejected";
      approval.reviewedAt = new Date().toISOString();
      approval.reviewedBy = hashIdentifier(rejectedBy);
      approval.reviewNotes = reason;
    }

    this.logAuditEvent("WORKFLOW_REJECTED", "remediation_workflow", rejectedBy, {
      workflowId,
      reason,
    });

    return workflow;
  }

  async executeWorkflow(
    workflowId: string,
    executedBy: string
  ): Promise<RemediationWorkflow | null> {
    const workflow = workflowStore.get(workflowId);
    if (!workflow) return null;
    if (workflow.status !== "pending" && workflow.status !== "approved") return null;

    const startTime = Date.now();
    workflow.status = "executing";
    workflow.startedAt = new Date().toISOString();

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "EXECUTION_STARTED",
      actor: hashIdentifier(executedBy),
      details: {},
    });

    this.logAuditEvent("WORKFLOW_EXECUTION_STARTED", "remediation_workflow", executedBy, {
      workflowId,
      stepCount: workflow.steps.length,
    });

    try {
      for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
        const stepResult = await this.executeStep(workflow, step);
        if (!stepResult.success) {
          workflow.status = "failed";
          workflow.auditTrail.push({
            timestamp: new Date().toISOString(),
            action: "EXECUTION_FAILED",
            actor: "system",
            details: { stepId: step.id, error: stepResult.error },
          });
          executionMetrics.failedWorkflows++;
          break;
        }
      }

      if (workflow.status === "executing") {
        workflow.status = "completed";
        workflow.completedAt = new Date().toISOString();
        workflow.completedBy = hashIdentifier(executedBy);
        executionMetrics.completedWorkflows++;

        if (workflow.executionMode === "auto") {
          executionMetrics.autoRemediations++;
        } else {
          executionMetrics.guidedRemediations++;
        }
      }
    } catch (error) {
      workflow.status = "failed";
      workflow.auditTrail.push({
        timestamp: new Date().toISOString(),
        action: "EXECUTION_ERROR",
        actor: "system",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      });
      executionMetrics.failedWorkflows++;
    }

    const executionTime = Date.now() - startTime;
    executionMetrics.totalExecutionTimeMs += executionTime;

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: workflow.status === "completed" ? "EXECUTION_COMPLETED" : "EXECUTION_ENDED",
      actor: "system",
      details: { executionTimeMs: executionTime, finalStatus: workflow.status },
    });

    this.logAuditEvent("WORKFLOW_EXECUTION_ENDED", "remediation_workflow", executedBy, {
      workflowId,
      status: workflow.status,
      executionTimeMs: executionTime,
    });

    automatedAlertingService.recordMetric(
      "remediation_workflow_completed",
      1,
      { workflowId, status: workflow.status, executionTimeMs: executionTime }
    );

    return workflow;
  }

  private async executeStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<{ success: boolean; error?: string }> {
    step.status = "executing";
    step.startedAt = new Date().toISOString();

    try {
      switch (step.actionType) {
        case "validate":
          await this.executeValidationStep(workflow, step);
          break;
        case "transform":
          await this.executeTransformStep(workflow, step);
          break;
        case "update":
          await this.executeUpdateStep(workflow, step);
          break;
        case "notify":
          await this.executeNotifyStep(workflow, step);
          break;
        case "audit":
          await this.executeAuditStep(workflow, step);
          break;
        case "rollback":
          await this.executeRollbackStep(workflow, step);
          break;
      }

      step.status = "completed";
      step.completedAt = new Date().toISOString();
      step.result = {
        success: true,
        message: `Step "${step.name}" completed successfully`,
      };

      return { success: true };
    } catch (error) {
      step.retryCount++;
      if (step.retryCount < step.maxRetries) {
        return this.executeStep(workflow, step);
      }

      step.status = "failed";
      step.completedAt = new Date().toISOString();
      step.result = {
        success: false,
        message: `Step "${step.name}" failed after ${step.retryCount} retries`,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return { success: false, error: step.result.error };
    }
  }

  private async executeValidationStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log(`[AIRemediationEngine] Validation step: ${step.name}`);
  }

  private async executeTransformStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[AIRemediationEngine] Transform step: ${step.name}`);
  }

  private async executeUpdateStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    console.log(`[AIRemediationEngine] Update step: ${step.name}`);
  }

  private async executeNotifyStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log(`[AIRemediationEngine] Notify step: ${step.name}`);

    automatedAlertingService.recordMetric(
      "remediation_notification_sent",
      1,
      { workflowId: workflow.id, channel: step.actionConfig.channel }
    );
  }

  private async executeAuditStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    this.logAuditEvent("REMEDIATION_AUDIT_ENTRY", "remediation_workflow", "system", {
      workflowId: workflow.id,
      stepId: step.id,
      category: step.actionConfig.category || "general",
      logLevel: step.actionConfig.logLevel || "info",
    });
  }

  private async executeRollbackStep(
    workflow: RemediationWorkflow,
    step: RemediationStep
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[AIRemediationEngine] Rollback step: ${step.name}`);
    executionMetrics.rollbacks++;
  }

  async rollbackWorkflow(
    workflowId: string,
    rolledBackBy: string,
    reason: string
  ): Promise<RemediationWorkflow | null> {
    const workflow = workflowStore.get(workflowId);
    if (!workflow || !workflow.rollbackAvailable) return null;
    if (workflow.status !== "completed" && workflow.status !== "failed") return null;

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "ROLLBACK_INITIATED",
      actor: hashIdentifier(rolledBackBy),
      details: { reason },
    });

    for (const step of workflow.steps.sort((a, b) => b.order - a.order)) {
      if (step.rollbackAction && step.status === "completed") {
        step.status = "rolled_back";
        await this.executeRollbackStep(workflow, step);
      }
    }

    workflow.status = "rolled_back";
    workflow.rollbackPerformedAt = new Date().toISOString();
    workflow.rollbackPerformedBy = hashIdentifier(rolledBackBy);

    workflow.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "ROLLBACK_COMPLETED",
      actor: hashIdentifier(rolledBackBy),
      details: { reason },
    });

    this.logAuditEvent("WORKFLOW_ROLLED_BACK", "remediation_workflow", rolledBackBy, {
      workflowId,
      reason,
    });

    return workflow;
  }

  async getWorkflow(workflowId: string): Promise<RemediationWorkflow | null> {
    return workflowStore.get(workflowId) || null;
  }

  async listWorkflows(filters?: {
    status?: RemediationWorkflowStatus;
    riskLevel?: RemediationRiskLevel;
    sourceType?: RemediationSourceType;
    limit?: number;
  }): Promise<RemediationWorkflow[]> {
    let workflows = Array.from(workflowStore.values());

    if (filters?.status) {
      workflows = workflows.filter((w) => w.status === filters.status);
    }
    if (filters?.riskLevel) {
      workflows = workflows.filter((w) => w.riskLevel === filters.riskLevel);
    }
    if (filters?.sourceType) {
      workflows = workflows.filter((w) => w.trigger.sourceType === filters.sourceType);
    }

    workflows.sort((a, b) => b.priority - a.priority || 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      workflows = workflows.slice(0, filters.limit);
    }

    return workflows;
  }

  async getPendingApprovals(): Promise<RemediationApprovalRequest[]> {
    return Array.from(approvalStore.values())
      .filter((a) => a.status === "pending")
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  }

  async getApprovalRequest(approvalId: string): Promise<RemediationApprovalRequest | null> {
    return approvalStore.get(approvalId) || null;
  }

  async getTemplate(templateId: string): Promise<RemediationTemplate | null> {
    return templateStore.get(templateId) || null;
  }

  async listTemplates(): Promise<RemediationTemplate[]> {
    return Array.from(templateStore.values());
  }

  async createTemplate(
    template: Omit<RemediationTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<RemediationTemplate> {
    const now = new Date().toISOString();
    const newTemplate: RemediationTemplate = {
      ...template,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    templateStore.set(newTemplate.id, newTemplate);

    this.logAuditEvent("TEMPLATE_CREATED", "remediation_template", "system", {
      templateId: newTemplate.id,
      name: newTemplate.name,
    });

    return newTemplate;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<RemediationTemplate, "id" | "createdAt">>
  ): Promise<RemediationTemplate | null> {
    const template = templateStore.get(templateId);
    if (!template) return null;

    const updated: RemediationTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: new Date().toISOString(),
    };
    templateStore.set(templateId, updated);

    this.logAuditEvent("TEMPLATE_UPDATED", "remediation_template", "system", {
      templateId,
      updates: Object.keys(updates),
    });

    return updated;
  }

  async getMetrics(): Promise<RemediationMetrics> {
    const workflows = Array.from(workflowStore.values());
    const completedCount = executionMetrics.completedWorkflows || 1;

    const bySourceType: Record<RemediationSourceType, number> = {
      data_quality: 0,
      compliance_monitoring: 0,
      predictive_alert: 0,
      manual: 0,
    };

    const byRiskLevel: Record<RemediationRiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const workflow of workflows) {
      bySourceType[workflow.trigger.sourceType]++;
      byRiskLevel[workflow.riskLevel]++;
    }

    const recentActivity = workflows
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((w) => ({
        workflowId: w.id,
        workflowName: w.name,
        status: w.status,
        timestamp: w.completedAt || w.startedAt || w.createdAt,
      }));

    const pendingApprovals = Array.from(approvalStore.values()).filter(
      (a) => a.status === "pending"
    ).length;

    return {
      totalWorkflows: executionMetrics.totalWorkflows,
      completedWorkflows: executionMetrics.completedWorkflows,
      failedWorkflows: executionMetrics.failedWorkflows,
      pendingApprovals,
      autoRemediations: executionMetrics.autoRemediations,
      guidedRemediations: executionMetrics.guidedRemediations,
      avgExecutionTimeMs: executionMetrics.totalExecutionTimeMs / completedCount,
      successRate: executionMetrics.completedWorkflows / (executionMetrics.totalWorkflows || 1),
      rollbackRate: executionMetrics.rollbacks / (executionMetrics.completedWorkflows || 1),
      bySourceType,
      byRiskLevel,
      recentActivity,
    };
  }

  async getDashboard(): Promise<RemediationDashboard> {
    const metrics = await this.getMetrics();
    const pendingApprovals = await this.getPendingApprovals();
    const activeWorkflows = await this.listWorkflows({
      status: "executing",
      limit: 10,
    });
    const recentCompletions = await this.listWorkflows({
      status: "completed",
      limit: 10,
    });

    const templateUsage = new Map<string, { count: number; successes: number }>();
    const allWorkflows = Array.from(workflowStore.values());
    for (const workflow of allWorkflows) {
      const templateId = workflow.metadata.templateId as string;
      if (templateId) {
        const current = templateUsage.get(templateId) || { count: 0, successes: 0 };
        current.count++;
        if (workflow.status === "completed") current.successes++;
        templateUsage.set(templateId, current);
      }
    }

    const templateSummary = Array.from(templateStore.values()).map((t) => {
      const usage = templateUsage.get(t.id) || { count: 0, successes: 0 };
      return {
        templateId: t.id,
        templateName: t.name,
        usageCount: usage.count,
        successRate: usage.count > 0 ? usage.successes / usage.count : 0,
      };
    });

    return {
      metrics,
      pendingApprovals,
      activeWorkflows,
      recentCompletions,
      templateSummary,
    };
  }

  async triggerFromDataQualityIssue(issue: {
    id: string;
    issueType: string;
    severity: string;
    title: string;
    description: string;
    resourceType: string;
    resourceId: string;
    patientId?: string;
  }): Promise<RemediationWorkflow | null> {
    const trigger: RemediationTrigger = {
      sourceType: "data_quality",
      sourceId: issue.id,
      issueType: issue.issueType,
      severity: issue.severity as RemediationRiskLevel,
      title: issue.title,
      description: issue.description,
      affectedResource: {
        resourceType: issue.resourceType,
        resourceId: issue.resourceId,
        patientId: issue.patientId,
      },
      detectedAt: new Date().toISOString(),
      metadata: { originalIssueId: issue.id },
    };

    return this.createWorkflowFromTrigger(trigger);
  }

  async triggerFromComplianceViolation(violation: {
    id: string;
    ruleId: string;
    severity: string;
    title: string;
    description: string;
    affectedEntityType: string;
    affectedEntityId: string;
  }): Promise<RemediationWorkflow | null> {
    const trigger: RemediationTrigger = {
      sourceType: "compliance_monitoring",
      sourceId: violation.id,
      issueType: violation.ruleId,
      severity: violation.severity as RemediationRiskLevel,
      title: violation.title,
      description: violation.description,
      affectedResource: {
        resourceType: violation.affectedEntityType,
        resourceId: violation.affectedEntityId,
      },
      detectedAt: new Date().toISOString(),
      metadata: { originalViolationId: violation.id },
    };

    return this.createWorkflowFromTrigger(trigger);
  }
}

export const aiRemediationEngine = new AIRemediationEngine();
