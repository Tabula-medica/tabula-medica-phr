import { createHash } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    component: "DataStewardship",
    details,
  })}`);
}

export type StewardRole = "data_steward" | "domain_steward" | "technical_steward" | "privacy_steward" | "compliance_steward";
export type TaskType = "asset_review" | "policy_violation" | "access_anomaly" | "quality_issue" | "risk_assessment" | "documentation" | "certification";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "deferred" | "escalated";

export interface DataSteward {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: StewardRole;
  domains: string[];
  sensitivityLevels: string[];
  maxWorkload: number;
  currentWorkload: number;
  expertise: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StewardshipTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string;
  assignedToName: string;
  assetId?: string;
  assetName?: string;
  policyId?: string;
  policyName?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  findings?: string;
  resolution?: string;
  metadata: Record<string, unknown>;
}

export interface StewardAssignment {
  assetId: string;
  assetName: string;
  stewardId: string;
  stewardName: string;
  role: StewardRole;
  assignedAt: string;
  reason: string;
  confidence: number;
}

export interface AssistantQuery {
  query: string;
  context?: {
    assetId?: string;
    taskId?: string;
    policyId?: string;
  };
}

export interface AssistantResponse {
  answer: string;
  sources: Array<{
    type: "asset" | "policy" | "task" | "risk" | "documentation";
    id: string;
    name: string;
    relevance: number;
  }>;
  suggestions: string[];
}

class AIDataStewardshipService {
  private stewards: Map<string, DataSteward> = new Map();
  private tasks: Map<string, StewardshipTask> = new Map();
  private assignments: Map<string, StewardAssignment[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[AIDataStewardship] Service initialized");
  }

  private initializeSampleData(): void {
    const sampleStewards: DataSteward[] = [
      {
        id: "steward-001",
        userId: "user-001",
        name: "Dr. Sarah Chen",
        email: "sarah.chen@tabula.health",
        role: "data_steward",
        domains: ["patient_demographics", "clinical_records"],
        sensitivityLevels: ["PHI", "PII"],
        maxWorkload: 20,
        currentWorkload: 8,
        expertise: ["HIPAA compliance", "clinical data", "patient privacy"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "steward-002",
        userId: "user-002",
        name: "Michael Torres",
        email: "michael.torres@tabula.health",
        role: "privacy_steward",
        domains: ["patient_demographics", "research"],
        sensitivityLevels: ["PHI", "PII", "GENETIC"],
        maxWorkload: 15,
        currentWorkload: 5,
        expertise: ["privacy regulations", "de-identification", "consent management"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "steward-003",
        userId: "user-003",
        name: "Emily Johnson",
        email: "emily.johnson@tabula.health",
        role: "compliance_steward",
        domains: ["financial_billing", "regulatory"],
        sensitivityLevels: ["FINANCIAL", "PII"],
        maxWorkload: 25,
        currentWorkload: 12,
        expertise: ["SOC2", "HIPAA auditing", "regulatory compliance"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "steward-004",
        userId: "user-004",
        name: "David Kim",
        email: "david.kim@tabula.health",
        role: "technical_steward",
        domains: ["operational", "external_integrations"],
        sensitivityLevels: ["PHI", "PII"],
        maxWorkload: 18,
        currentWorkload: 10,
        expertise: ["data architecture", "FHIR", "system integration"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    sampleStewards.forEach(s => this.stewards.set(s.id, s));

    const sampleTasks: StewardshipTask[] = [
      {
        id: "task-001",
        type: "asset_review",
        title: "Review Patient Demographics Data Quality",
        description: "Monthly review of patient demographics data asset for completeness and accuracy. Check for duplicate records and missing required fields.",
        priority: "high",
        status: "pending",
        assignedTo: "steward-001",
        assignedToName: "Dr. Sarah Chen",
        assetId: "asset-patient-default",
        assetName: "Patient Demographics",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { reviewType: "quarterly", dataQualityScore: 78 },
      },
      {
        id: "task-002",
        type: "policy_violation",
        title: "Investigate Unauthorized PHI Access Pattern",
        description: "Anomalous access pattern detected for clinical records. Multiple records accessed outside normal business hours by user ID ending in ...x4f2.",
        priority: "critical",
        status: "in_progress",
        assignedTo: "steward-002",
        assignedToName: "Michael Torres",
        policyId: "policy-access-001",
        policyName: "PHI Access Control Policy",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { accessCount: 47, affectedRecords: 23, riskScore: 85 },
      },
      {
        id: "task-003",
        type: "risk_assessment",
        title: "Annual Risk Assessment for Billing Data",
        description: "Perform comprehensive risk assessment for financial billing data assets including threat modeling and control effectiveness review.",
        priority: "medium",
        status: "pending",
        assignedTo: "steward-003",
        assignedToName: "Emily Johnson",
        assetId: "asset-billing",
        assetName: "Billing Claims Data",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { lastAssessment: "2025-01-15", currentRiskLevel: "medium" },
      },
      {
        id: "task-004",
        type: "documentation",
        title: "Update Data Lineage for Integration Pipeline",
        description: "Document data flow from external EHR systems through transformation pipelines to patient records warehouse.",
        priority: "low",
        status: "pending",
        assignedTo: "steward-004",
        assignedToName: "David Kim",
        assetId: "asset-ehr-pipeline",
        assetName: "EHR Integration Pipeline",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { pipelineCount: 4, lastDocUpdate: "2025-06-01" },
      },
    ];

    sampleTasks.forEach(t => this.tasks.set(t.id, t));
    console.log(`[AIDataStewardship] Initialized ${sampleStewards.length} stewards and ${sampleTasks.length} tasks`);
  }

  getStewards(filters?: { role?: StewardRole; domain?: string; isActive?: boolean }): DataSteward[] {
    let result = Array.from(this.stewards.values());
    
    if (filters?.role) {
      result = result.filter(s => s.role === filters.role);
    }
    if (filters?.domain) {
      const domain = filters.domain;
      result = result.filter(s => s.domains.includes(domain));
    }
    if (filters?.isActive !== undefined) {
      result = result.filter(s => s.isActive === filters.isActive);
    }
    
    return result;
  }

  getSteward(id: string): DataSteward | undefined {
    return this.stewards.get(id);
  }

  createSteward(data: Omit<DataSteward, "id" | "createdAt" | "updatedAt" | "currentWorkload">): DataSteward {
    const id = `steward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const steward: DataSteward = {
      id,
      ...data,
      currentWorkload: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    this.stewards.set(id, steward);
    logHipaaAudit("CREATE_DATA_STEWARD", { stewardId: hashIdentifier(id), role: steward.role });
    
    return steward;
  }

  updateSteward(id: string, updates: Partial<DataSteward>): DataSteward | null {
    const existing = this.stewards.get(id);
    if (!existing) return null;
    
    const updated: DataSteward = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    
    this.stewards.set(id, updated);
    logHipaaAudit("UPDATE_DATA_STEWARD", { stewardId: hashIdentifier(id) });
    
    return updated;
  }

  autoAssignSteward(asset: {
    id: string;
    name: string;
    domain: string;
    sensitiveTypes: string[];
    riskLevel: string;
    currentOwner?: string;
  }): StewardAssignment | null {
    logHipaaAudit("AUTO_ASSIGN_STEWARD", { assetId: hashIdentifier(asset.id) });

    const candidates = Array.from(this.stewards.values())
      .filter(s => s.isActive)
      .filter(s => s.currentWorkload < s.maxWorkload)
      .map(steward => {
        let score = 0;
        let reasons: string[] = [];

        if (steward.domains.includes(asset.domain)) {
          score += 30;
          reasons.push(`Domain expertise in ${asset.domain}`);
        }

        const matchingSensitivity = asset.sensitiveTypes.filter(st => 
          steward.sensitivityLevels.includes(st)
        );
        if (matchingSensitivity.length > 0) {
          score += 20 * matchingSensitivity.length;
          reasons.push(`Handles ${matchingSensitivity.join(", ")} data`);
        }

        const workloadRatio = steward.currentWorkload / steward.maxWorkload;
        score += Math.round((1 - workloadRatio) * 20);

        if (asset.riskLevel === "critical" || asset.riskLevel === "high") {
          if (steward.role === "privacy_steward" || steward.role === "compliance_steward") {
            score += 15;
            reasons.push("Specialized in high-risk assets");
          }
        }

        return { steward, score, reasons };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return null;
    }

    const best = candidates[0];
    const assignment: StewardAssignment = {
      assetId: asset.id,
      assetName: asset.name,
      stewardId: best.steward.id,
      stewardName: best.steward.name,
      role: best.steward.role,
      assignedAt: new Date().toISOString(),
      reason: best.reasons.join("; "),
      confidence: Math.min(100, best.score),
    };

    const existingAssignments = this.assignments.get(asset.id) || [];
    existingAssignments.push(assignment);
    this.assignments.set(asset.id, existingAssignments);

    const steward = this.stewards.get(best.steward.id);
    if (steward) {
      steward.currentWorkload += 1;
      this.stewards.set(steward.id, steward);
    }

    logHipaaAudit("STEWARD_ASSIGNED", { 
      assetId: hashIdentifier(asset.id), 
      stewardId: hashIdentifier(best.steward.id),
      confidence: assignment.confidence,
    });

    return assignment;
  }

  getAssetAssignments(assetId: string): StewardAssignment[] {
    return this.assignments.get(assetId) || [];
  }

  getTasks(filters?: {
    assignedTo?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    type?: TaskType;
  }): StewardshipTask[] {
    let result = Array.from(this.tasks.values());
    
    if (filters?.assignedTo) {
      result = result.filter(t => t.assignedTo === filters.assignedTo);
    }
    if (filters?.status) {
      result = result.filter(t => t.status === filters.status);
    }
    if (filters?.priority) {
      result = result.filter(t => t.priority === filters.priority);
    }
    if (filters?.type) {
      result = result.filter(t => t.type === filters.type);
    }
    
    return result.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getTask(id: string): StewardshipTask | undefined {
    return this.tasks.get(id);
  }

  createTask(data: Omit<StewardshipTask, "id" | "createdAt" | "updatedAt">): StewardshipTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const task: StewardshipTask = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    this.tasks.set(id, task);
    logHipaaAudit("CREATE_STEWARDSHIP_TASK", { 
      taskId: hashIdentifier(id), 
      type: task.type, 
      priority: task.priority,
    });
    
    return task;
  }

  updateTask(id: string, updates: Partial<StewardshipTask>): StewardshipTask | null {
    const existing = this.tasks.get(id);
    if (!existing) return null;
    
    const now = new Date().toISOString();
    const updated: StewardshipTask = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      completedAt: updates.status === "completed" ? now : existing.completedAt,
    };
    
    this.tasks.set(id, updated);
    logHipaaAudit("UPDATE_STEWARDSHIP_TASK", { taskId: hashIdentifier(id), status: updated.status });
    
    return updated;
  }

  generateTasksFromRiskAssessment(assets: Array<{
    id: string;
    name: string;
    riskLevel: string;
    riskFactors: string[];
  }>): StewardshipTask[] {
    const generatedTasks: StewardshipTask[] = [];
    
    for (const asset of assets) {
      if (asset.riskLevel === "critical" || asset.riskLevel === "high") {
        const assignments = this.assignments.get(asset.id) || [];
        const steward = assignments[0];
        
        if (!steward) continue;
        
        const task = this.createTask({
          type: "risk_assessment",
          title: `Urgent Risk Review: ${asset.name}`,
          description: `High-risk asset requires immediate review. Risk factors: ${asset.riskFactors.join(", ")}`,
          priority: asset.riskLevel === "critical" ? "critical" : "high",
          status: "pending",
          assignedTo: steward.stewardId,
          assignedToName: steward.stewardName,
          assetId: asset.id,
          assetName: asset.name,
          dueDate: new Date(Date.now() + (asset.riskLevel === "critical" ? 1 : 3) * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { riskLevel: asset.riskLevel, riskFactors: asset.riskFactors },
        });
        
        generatedTasks.push(task);
      }
    }
    
    logHipaaAudit("GENERATE_RISK_TASKS", { taskCount: generatedTasks.length });
    return generatedTasks;
  }

  generateTasksFromPolicyViolations(violations: Array<{
    id: string;
    policyId: string;
    policyName: string;
    severity: string;
    description: string;
    affectedAssetId?: string;
    affectedAssetName?: string;
  }>): StewardshipTask[] {
    const generatedTasks: StewardshipTask[] = [];
    
    for (const violation of violations) {
      const complianceStewards = Array.from(this.stewards.values())
        .filter(s => s.role === "compliance_steward" || s.role === "privacy_steward")
        .filter(s => s.isActive && s.currentWorkload < s.maxWorkload)
        .sort((a, b) => a.currentWorkload - b.currentWorkload);
      
      if (complianceStewards.length === 0) continue;
      
      const assignee = complianceStewards[0];
      
      const task = this.createTask({
        type: "policy_violation",
        title: `Policy Violation: ${violation.policyName}`,
        description: violation.description,
        priority: violation.severity === "critical" ? "critical" : violation.severity === "high" ? "high" : "medium",
        status: "pending",
        assignedTo: assignee.id,
        assignedToName: assignee.name,
        policyId: violation.policyId,
        policyName: violation.policyName,
        assetId: violation.affectedAssetId,
        assetName: violation.affectedAssetName,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { violationId: violation.id, severity: violation.severity },
      });
      
      assignee.currentWorkload += 1;
      this.stewards.set(assignee.id, assignee);
      
      generatedTasks.push(task);
    }
    
    logHipaaAudit("GENERATE_VIOLATION_TASKS", { taskCount: generatedTasks.length });
    return generatedTasks;
  }

  generateTasksFromAccessAnomalies(anomalies: Array<{
    id: string;
    userId: string;
    description: string;
    riskScore: number;
    affectedAssets: string[];
  }>): StewardshipTask[] {
    const generatedTasks: StewardshipTask[] = [];
    
    for (const anomaly of anomalies) {
      const privacyStewards = Array.from(this.stewards.values())
        .filter(s => s.role === "privacy_steward")
        .filter(s => s.isActive && s.currentWorkload < s.maxWorkload)
        .sort((a, b) => a.currentWorkload - b.currentWorkload);
      
      if (privacyStewards.length === 0) continue;
      
      const assignee = privacyStewards[0];
      
      const priority: TaskPriority = anomaly.riskScore >= 80 ? "critical" : 
                                      anomaly.riskScore >= 60 ? "high" : 
                                      anomaly.riskScore >= 40 ? "medium" : "low";
      
      const task = this.createTask({
        type: "access_anomaly",
        title: `Access Anomaly Investigation`,
        description: `${anomaly.description}. Affected assets: ${anomaly.affectedAssets.length}. Risk score: ${anomaly.riskScore}`,
        priority,
        status: "pending",
        assignedTo: assignee.id,
        assignedToName: assignee.name,
        dueDate: new Date(Date.now() + (priority === "critical" ? 1 : 2) * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { 
          anomalyId: anomaly.id, 
          userId: hashIdentifier(anomaly.userId), 
          riskScore: anomaly.riskScore,
          affectedAssetCount: anomaly.affectedAssets.length,
        },
      });
      
      assignee.currentWorkload += 1;
      this.stewards.set(assignee.id, assignee);
      
      generatedTasks.push(task);
    }
    
    logHipaaAudit("GENERATE_ANOMALY_TASKS", { taskCount: generatedTasks.length });
    return generatedTasks;
  }

  async askAssistant(query: AssistantQuery): Promise<AssistantResponse> {
    logHipaaAudit("STEWARD_ASSISTANT_QUERY", { 
      queryLength: query.query.length,
      hasContext: !!query.context,
    });

    const systemPrompt = `You are an AI assistant for data stewards in a healthcare organization. You help stewards with:
- Understanding data assets, their sensitivity, and governance requirements
- Reviewing policies and compliance requirements  
- Assessing risks and recommending mitigations
- Finding relevant documentation and procedures

IMPORTANT: You are strictly NO-CDS (No Clinical Decision Support) compliant. You MUST NOT:
- Provide any clinical recommendations or medical advice
- Interpret clinical data for diagnostic purposes
- Suggest treatments or clinical interventions

You CAN help with:
- Data governance, quality, and compliance questions
- Policy interpretation and enforcement
- Risk assessment methodologies
- Stewardship best practices
- Finding relevant assets, policies, or documentation

Be concise, accurate, and always cite your sources when possible.`;

    const contextInfo = query.context ? 
      `\nContext: Asset ID: ${query.context.assetId || "N/A"}, Task ID: ${query.context.taskId || "N/A"}, Policy ID: ${query.context.policyId || "N/A"}` : "";

    try {
      if (!aiEnabled) {
        return this.getFallbackResponse(query);
      }

      const answer = (await generatePhiSafeText({
        system: systemPrompt,
        user: query.query + contextInfo,
        maxTokens: 1000,
        temperature: 0.7,
      })) || "I couldn't generate a response. Please try again.";

      return {
        answer,
        sources: this.findRelevantSources(query.query),
        suggestions: this.generateSuggestions(query.query),
      };
    } catch (error) {
      console.error("[AIDataStewardship] Assistant error:", error);
      return this.getFallbackResponse(query);
    }
  }

  private getFallbackResponse(query: AssistantQuery): AssistantResponse {
    const lowerQuery = query.query.toLowerCase();
    let answer = "";
    
    if (lowerQuery.includes("risk") || lowerQuery.includes("assessment")) {
      answer = "For risk assessments, review the asset's sensitivity classification, access patterns, and existing controls. High-risk assets containing PHI or PII require quarterly reviews. Use the Risk Assessment tab to view current risk scores and factors.";
    } else if (lowerQuery.includes("policy") || lowerQuery.includes("violation")) {
      answer = "Policy violations should be investigated within 48 hours for high-severity issues. Document your findings, identify root causes, and recommend remediation actions. Escalate to the compliance team if the violation affects multiple systems.";
    } else if (lowerQuery.includes("access") || lowerQuery.includes("permission")) {
      answer = "Access anomalies may indicate unauthorized data access. Review the user's role, typical access patterns, and the sensitivity of accessed data. Consider whether access was appropriate for their job function.";
    } else if (lowerQuery.includes("steward") || lowerQuery.includes("assign")) {
      answer = "Data stewards are automatically assigned based on domain expertise, sensitivity handling capabilities, and current workload. You can manually reassign if needed.";
    } else {
      answer = "I can help you with data governance questions, policy compliance, risk assessment, and stewardship best practices. Please provide more details about what you need assistance with.";
    }

    return {
      answer,
      sources: this.findRelevantSources(query.query),
      suggestions: this.generateSuggestions(query.query),
    };
  }

  private findRelevantSources(query: string): AssistantResponse["sources"] {
    const sources: AssistantResponse["sources"] = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes("patient") || lowerQuery.includes("demographic")) {
      sources.push({ type: "asset", id: "asset-patient-default", name: "Patient Demographics", relevance: 0.9 });
    }
    if (lowerQuery.includes("billing") || lowerQuery.includes("financial")) {
      sources.push({ type: "asset", id: "asset-billing", name: "Billing Claims Data", relevance: 0.85 });
    }
    if (lowerQuery.includes("policy") || lowerQuery.includes("access")) {
      sources.push({ type: "policy", id: "policy-access-001", name: "PHI Access Control Policy", relevance: 0.8 });
    }
    if (lowerQuery.includes("risk")) {
      sources.push({ type: "documentation", id: "doc-risk-001", name: "Risk Assessment Guidelines", relevance: 0.75 });
    }

    return sources;
  }

  private generateSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes("risk")) {
      suggestions.push("View high-risk assets in the Data Catalog");
      suggestions.push("Schedule a risk review meeting");
    }
    if (lowerQuery.includes("policy")) {
      suggestions.push("Review recent policy violations");
      suggestions.push("Check policy compliance status");
    }
    if (lowerQuery.includes("access")) {
      suggestions.push("Audit user access permissions");
      suggestions.push("Review access anomaly reports");
    }
    
    if (suggestions.length === 0) {
      suggestions.push("Review your pending tasks");
      suggestions.push("Check data quality metrics");
      suggestions.push("View recent audit logs");
    }

    return suggestions;
  }

  getDashboard(stewardId?: string): {
    totalTasks: number;
    pendingTasks: number;
    criticalTasks: number;
    completedThisWeek: number;
    overdueTasks: number;
    tasksByType: Record<TaskType, number>;
    tasksByPriority: Record<TaskPriority, number>;
    recentTasks: StewardshipTask[];
    stewardStats?: {
      workloadPercentage: number;
      tasksCompleted: number;
      avgCompletionTime: number;
    };
  } {
    let tasks = Array.from(this.tasks.values());
    
    if (stewardId) {
      tasks = tasks.filter(t => t.assignedTo === stewardId);
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const tasksByType: Record<TaskType, number> = {
      asset_review: 0, policy_violation: 0, access_anomaly: 0,
      quality_issue: 0, risk_assessment: 0, documentation: 0, certification: 0,
    };
    const tasksByPriority: Record<TaskPriority, number> = {
      critical: 0, high: 0, medium: 0, low: 0,
    };

    tasks.forEach(t => {
      tasksByType[t.type] = (tasksByType[t.type] || 0) + 1;
      tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
    });

    const dashboard: {
      totalTasks: number;
      pendingTasks: number;
      criticalTasks: number;
      completedThisWeek: number;
      overdueTasks: number;
      tasksByType: Record<TaskType, number>;
      tasksByPriority: Record<TaskPriority, number>;
      recentTasks: StewardshipTask[];
      stewardStats?: {
        workloadPercentage: number;
        tasksCompleted: number;
        avgCompletionTime: number;
      };
    } = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === "pending").length,
      criticalTasks: tasks.filter(t => t.priority === "critical" && t.status !== "completed").length,
      completedThisWeek: tasks.filter(t => t.completedAt && new Date(t.completedAt) >= weekAgo).length,
      overdueTasks: tasks.filter(t => t.status !== "completed" && new Date(t.dueDate) < now).length,
      tasksByType,
      tasksByPriority,
      recentTasks: tasks
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    };

    if (stewardId) {
      const steward = this.stewards.get(stewardId);
      if (steward) {
        dashboard.stewardStats = {
          workloadPercentage: Math.round((steward.currentWorkload / steward.maxWorkload) * 100),
          tasksCompleted: tasks.filter(t => t.status === "completed").length,
          avgCompletionTime: 2.5,
        };
      }
    }

    return dashboard;
  }
}

export const aiDataStewardshipService = new AIDataStewardshipService();
