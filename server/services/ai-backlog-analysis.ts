import { createHash, randomUUID } from "crypto";
import { aiPolicyEnforcementService, PolicyViolationAssessment, ViolationCategory } from "./ai-policy-enforcement";
import { aiComplianceMonitoringService } from "./ai-compliance-monitoring";
import type { ComplianceRisk, ComplianceRiskLevel, ComplianceRegulation } from "@shared/schema";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare compliance backlog analysis specialist.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing policy violations and compliance risks for prioritization
- Calculating impact scores based on affected systems and users
- Assessing regulatory criticality for HIPAA, GDPR, SOC2, HITECH compliance
- Recommending optimized remediation order based on risk factors
- Identifying dependencies and groupings for efficient remediation

All analysis must focus on COMPLIANCE PRIORITIZATION and REMEDIATION PLANNING, never clinical interpretation.`;

export type IssueType = "policy_violation" | "compliance_risk";
export type RemediationPriority = "immediate" | "urgent" | "high" | "medium" | "low";
export type RegulatoryFramework = "HIPAA" | "GDPR" | "SOC2" | "HITECH" | "CCPA";

export interface ImpactAssessment {
  affectedUsersCount: number;
  affectedSystemsCount: number;
  affectedPatientsCount: number;
  dataExposureRisk: "critical" | "high" | "medium" | "low" | "none";
  operationalImpact: "severe" | "significant" | "moderate" | "minimal";
  reputationalRisk: "high" | "medium" | "low";
}

export interface RegulatoryAssessment {
  frameworks: RegulatoryFramework[];
  breachRisk: "confirmed_breach" | "potential_breach" | "violation" | "warning";
  reportingRequired: boolean;
  reportingDeadlineHours?: number;
  fineExposure: "high" | "medium" | "low" | "none";
  notificationRequired: boolean;
}

export interface BacklogItem {
  id: string;
  sourceId: string;
  type: IssueType;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  detectedAt: string;
  category: string;
  impact: ImpactAssessment;
  regulatory: RegulatoryAssessment;
  priorityScore: number;
  remediationPriority: RemediationPriority;
  estimatedRemediationHours: number;
  dependencies: string[];
  groupId?: string;
  sourceData: PolicyViolationAssessment | ComplianceRisk;
}

export interface RemediationGroup {
  id: string;
  name: string;
  description: string;
  items: BacklogItem[];
  totalPriorityScore: number;
  estimatedTotalHours: number;
  recommendedOrder: number;
  commonCategory: string;
  commonRegulations: RegulatoryFramework[];
}

export interface RemediationPlan {
  id: string;
  generatedAt: string;
  generatedBy: string;
  totalItems: number;
  criticalItems: number;
  urgentItems: number;
  orderedItems: BacklogItem[];
  groups: RemediationGroup[];
  aiRecommendations: string[];
  estimatedTotalHours: number;
  regulatoryDeadlines: {
    framework: RegulatoryFramework;
    deadline: string;
    itemsAffected: number;
  }[];
  executiveSummary: string;
}

export interface BacklogMetrics {
  totalItems: number;
  bySeverity: Record<string, number>;
  byType: Record<IssueType, number>;
  byPriority: Record<RemediationPriority, number>;
  byRegulation: Record<string, number>;
  averagePriorityScore: number;
  oldestItemAge: number;
  estimatedTotalRemediationHours: number;
  criticalDeadlinesCount: number;
}

const backlogStore = new Map<string, BacklogItem>();
const remediationPlanStore = new Map<string, RemediationPlan>();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, "[UUID]");
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logHipaaAudit(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "BacklogAnalysisEngine",
    details: sanitizeDetails(details),
  })}`);
}

const SEVERITY_SCORES: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10,
};

const REGULATORY_SCORES: Record<RegulatoryFramework, number> = {
  HIPAA: 100,
  GDPR: 90,
  HITECH: 85,
  SOC2: 70,
  CCPA: 60,
};

const BREACH_RISK_SCORES: Record<string, number> = {
  confirmed_breach: 100,
  potential_breach: 75,
  violation: 50,
  warning: 25,
};

const IMPACT_SCORES = {
  dataExposure: { critical: 100, high: 75, medium: 50, low: 25, none: 0 },
  operational: { severe: 100, significant: 75, moderate: 50, minimal: 25 },
  reputational: { high: 100, medium: 50, low: 25 },
};

class AIBacklogAnalysisService {
  async syncBacklog(userId: string): Promise<{ added: number; updated: number; removed: number }> {
    logHipaaAudit("SYNC_BACKLOG", "backlog", userId, { action: "sync_start" });

    const existingIds = new Set(backlogStore.keys());
    let added = 0, updated = 0, removed = 0;

    const violations = aiPolicyEnforcementService.listAssessments({ status: "pending_review" });
    const confirmedViolations = aiPolicyEnforcementService.listAssessments({ status: "confirmed" });
    const allViolations = [...violations, ...confirmedViolations];

    for (const violation of allViolations) {
      const item = this.convertPolicyViolation(violation);
      const existingItem = backlogStore.get(item.id);
      
      if (existingItem) {
        backlogStore.set(item.id, item);
        updated++;
      } else {
        backlogStore.set(item.id, item);
        added++;
      }
      existingIds.delete(item.id);
    }

    const openRisks = aiComplianceMonitoringService.getRisks({ status: "open" });
    const investigatingRisks = aiComplianceMonitoringService.getRisks({ status: "investigating" });
    const acknowledgedRisks = aiComplianceMonitoringService.getRisks({ status: "acknowledged" });
    const allRisks = [...openRisks, ...investigatingRisks, ...acknowledgedRisks];

    for (const risk of allRisks) {
      const item = this.convertComplianceRisk(risk);
      const existingItem = backlogStore.get(item.id);
      
      if (existingItem) {
        backlogStore.set(item.id, item);
        updated++;
      } else {
        backlogStore.set(item.id, item);
        added++;
      }
      existingIds.delete(item.id);
    }

    existingIds.forEach(id => {
      backlogStore.delete(id);
      removed++;
    });

    logHipaaAudit("SYNC_BACKLOG", "backlog", userId, { 
      action: "sync_complete", 
      added, 
      updated, 
      removed,
      totalItems: backlogStore.size 
    });

    return { added, updated, removed };
  }

  private convertPolicyViolation(violation: PolicyViolationAssessment): BacklogItem {
    const impact = this.assessImpact(violation);
    const regulatory = this.assessRegulatory(violation);
    const priorityScore = this.calculatePriorityScore(violation.severity, impact, regulatory);

    return {
      id: `pv_${violation.id}`,
      sourceId: violation.id,
      type: "policy_violation",
      title: `${violation.violationCategory.replace(/_/g, " ")} - ${violation.policyName}`,
      description: violation.description,
      severity: violation.severity,
      status: violation.status,
      detectedAt: violation.assessedAt,
      category: violation.violationCategory,
      impact,
      regulatory,
      priorityScore,
      remediationPriority: this.determinePriority(priorityScore),
      estimatedRemediationHours: this.estimateRemediationTime(violation.violationCategory, violation.severity),
      dependencies: [],
      sourceData: violation,
    };
  }

  private convertComplianceRisk(risk: ComplianceRisk): BacklogItem {
    const impact = this.assessComplianceRiskImpact(risk);
    const regulatory = this.assessComplianceRiskRegulatory(risk);
    const priorityScore = this.calculatePriorityScore(risk.level as "critical" | "high" | "medium" | "low", impact, regulatory);

    return {
      id: `cr_${risk.id}`,
      sourceId: risk.id,
      type: "compliance_risk",
      title: risk.title,
      description: risk.description,
      severity: risk.level === "info" ? "low" : risk.level as "critical" | "high" | "medium" | "low",
      status: risk.status,
      detectedAt: risk.detectedAt,
      category: risk.category,
      impact,
      regulatory,
      priorityScore,
      remediationPriority: this.determinePriority(priorityScore),
      estimatedRemediationHours: this.estimateComplianceRemediationTime(risk.category, risk.level),
      dependencies: [],
      sourceData: risk,
    };
  }

  private assessImpact(violation: PolicyViolationAssessment): ImpactAssessment {
    const categoryImpacts: Record<ViolationCategory, Partial<ImpactAssessment>> = {
      access_violation: { affectedUsersCount: 1, dataExposureRisk: "medium", operationalImpact: "minimal" },
      data_export: { affectedUsersCount: 1, affectedPatientsCount: 10, dataExposureRisk: "high", operationalImpact: "moderate" },
      consent_breach: { affectedPatientsCount: 1, dataExposureRisk: "critical", operationalImpact: "significant" },
      after_hours: { affectedUsersCount: 1, dataExposureRisk: "low", operationalImpact: "minimal" },
      role_mismatch: { affectedUsersCount: 1, affectedSystemsCount: 1, dataExposureRisk: "medium", operationalImpact: "moderate" },
      rate_limit: { affectedSystemsCount: 1, dataExposureRisk: "medium", operationalImpact: "moderate" },
      unauthorized_resource: { affectedUsersCount: 1, dataExposureRisk: "high", operationalImpact: "significant" },
      data_modification: { affectedPatientsCount: 1, dataExposureRisk: "critical", operationalImpact: "severe" },
    };

    const baseImpact = categoryImpacts[violation.violationCategory] || {};
    
    return {
      affectedUsersCount: baseImpact.affectedUsersCount || 1,
      affectedSystemsCount: baseImpact.affectedSystemsCount || 1,
      affectedPatientsCount: baseImpact.affectedPatientsCount || 0,
      dataExposureRisk: baseImpact.dataExposureRisk || "medium",
      operationalImpact: baseImpact.operationalImpact || "moderate",
      reputationalRisk: violation.severity === "critical" ? "high" : violation.severity === "high" ? "medium" : "low",
    };
  }

  private assessComplianceRiskImpact(risk: ComplianceRisk): ImpactAssessment {
    const categoryImpacts: Record<string, Partial<ImpactAssessment>> = {
      access_anomaly: { affectedUsersCount: 5, dataExposureRisk: "medium", operationalImpact: "moderate" },
      policy_violation: { affectedUsersCount: 1, dataExposureRisk: "high", operationalImpact: "significant" },
      consent_violation: { affectedPatientsCount: 10, dataExposureRisk: "critical", operationalImpact: "severe" },
      data_retention: { affectedPatientsCount: 100, dataExposureRisk: "medium", operationalImpact: "moderate" },
      unauthorized_access: { affectedUsersCount: 1, dataExposureRisk: "high", operationalImpact: "significant" },
      data_export: { affectedPatientsCount: 50, dataExposureRisk: "critical", operationalImpact: "severe" },
      audit_gap: { affectedSystemsCount: 3, dataExposureRisk: "medium", operationalImpact: "moderate" },
      encryption_weakness: { affectedSystemsCount: 5, dataExposureRisk: "critical", operationalImpact: "severe" },
    };

    const baseImpact = categoryImpacts[risk.category] || {};
    const evidenceArray = Array.isArray(risk.evidence) ? risk.evidence : [];
    const totalCount = evidenceArray.reduce((sum, e) => sum + (typeof e?.count === "number" ? e.count : 0), 0) || 1;

    return {
      affectedUsersCount: (baseImpact.affectedUsersCount || 1) * Math.min(totalCount, 10),
      affectedSystemsCount: baseImpact.affectedSystemsCount || 1,
      affectedPatientsCount: (baseImpact.affectedPatientsCount || 0) * Math.min(totalCount, 5),
      dataExposureRisk: baseImpact.dataExposureRisk || "medium",
      operationalImpact: baseImpact.operationalImpact || "moderate",
      reputationalRisk: risk.level === "critical" ? "high" : risk.level === "high" ? "medium" : "low",
    };
  }

  private assessRegulatory(violation: PolicyViolationAssessment): RegulatoryAssessment {
    const frameworks: RegulatoryFramework[] = ["HIPAA"];
    let breachRisk: RegulatoryAssessment["breachRisk"] = "warning";
    let reportingRequired = false;
    let notificationRequired = false;

    if (violation.violationCategory === "consent_breach") {
      frameworks.push("GDPR");
      breachRisk = violation.severity === "critical" && violation.status === "confirmed" ? "confirmed_breach" : "potential_breach";
      reportingRequired = true;
      notificationRequired = true;
    } else if (violation.violationCategory === "data_export" || violation.violationCategory === "unauthorized_resource") {
      if (violation.severity === "critical" && violation.status === "confirmed") {
        breachRisk = "confirmed_breach";
      } else if (violation.severity === "critical") {
        breachRisk = "potential_breach";
      } else {
        breachRisk = "violation";
      }
      reportingRequired = violation.severity === "critical";
    } else if (violation.violationCategory === "data_modification") {
      breachRisk = violation.status === "confirmed" ? "confirmed_breach" : "potential_breach";
      reportingRequired = true;
    }

    if (violation.severity === "critical") {
      frameworks.push("SOC2");
    }

    const fineExposure = breachRisk === "confirmed_breach" ? "high" as const : breachRisk === "potential_breach" ? "medium" as const : "low" as const;

    return {
      frameworks,
      breachRisk,
      reportingRequired,
      reportingDeadlineHours: reportingRequired ? 72 : undefined,
      fineExposure,
      notificationRequired,
    };
  }

  private assessComplianceRiskRegulatory(risk: ComplianceRisk): RegulatoryAssessment {
    const frameworks = (risk.regulations || ["HIPAA"]) as RegulatoryFramework[];
    let breachRisk: RegulatoryAssessment["breachRisk"] = "warning";
    let reportingRequired = false;
    let notificationRequired = false;

    if (risk.category === "consent_violation" || risk.category === "data_export") {
      if (risk.level === "critical" && risk.status === "acknowledged") {
        breachRisk = "confirmed_breach";
      } else if (risk.level === "critical") {
        breachRisk = "potential_breach";
      } else {
        breachRisk = "violation";
      }
      reportingRequired = risk.level === "critical" || risk.level === "high";
      notificationRequired = risk.level === "critical";
    } else if (risk.category === "encryption_weakness" || risk.category === "unauthorized_access") {
      breachRisk = risk.level === "critical" ? "confirmed_breach" : "potential_breach";
      reportingRequired = true;
      notificationRequired = risk.level === "critical";
    }

    const fineExposure = breachRisk === "confirmed_breach" ? "high" as const : breachRisk === "potential_breach" ? "medium" as const : "low" as const;

    return {
      frameworks,
      breachRisk,
      reportingRequired,
      reportingDeadlineHours: reportingRequired ? 72 : undefined,
      fineExposure,
      notificationRequired,
    };
  }

  private calculatePriorityScore(
    severity: "critical" | "high" | "medium" | "low",
    impact: ImpactAssessment,
    regulatory: RegulatoryAssessment
  ): number {
    const severityScore = SEVERITY_SCORES[severity] || 50;
    
    const maxRegScore = Math.max(...regulatory.frameworks.map(f => REGULATORY_SCORES[f] || 50));
    const breachScore = BREACH_RISK_SCORES[regulatory.breachRisk] || 25;
    
    const exposureScore = IMPACT_SCORES.dataExposure[impact.dataExposureRisk] || 50;
    const operationalScore = IMPACT_SCORES.operational[impact.operationalImpact] || 50;
    const reputationalScore = IMPACT_SCORES.reputational[impact.reputationalRisk] || 25;
    
    const affectedScale = Math.min(
      10 + (impact.affectedUsersCount * 2) + (impact.affectedPatientsCount * 5) + (impact.affectedSystemsCount * 3),
      100
    );

    const reportingUrgency = regulatory.reportingRequired ? 20 : 0;
    const notificationUrgency = regulatory.notificationRequired ? 15 : 0;

    const rawScore = (
      severityScore * 0.25 +
      maxRegScore * 0.20 +
      breachScore * 0.15 +
      exposureScore * 0.10 +
      operationalScore * 0.08 +
      reputationalScore * 0.07 +
      affectedScale * 0.05 +
      reportingUrgency +
      notificationUrgency
    );

    return Math.round(Math.min(rawScore, 100));
  }

  private determinePriority(score: number): RemediationPriority {
    if (score >= 85) return "immediate";
    if (score >= 70) return "urgent";
    if (score >= 55) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  private estimateRemediationTime(category: ViolationCategory, severity: string): number {
    const baseHours: Record<ViolationCategory, number> = {
      access_violation: 2,
      data_export: 4,
      consent_breach: 8,
      after_hours: 1,
      role_mismatch: 3,
      rate_limit: 2,
      unauthorized_resource: 4,
      data_modification: 6,
    };

    const severityMultiplier: Record<string, number> = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.75,
    };

    return Math.round((baseHours[category] || 3) * (severityMultiplier[severity] || 1));
  }

  private estimateComplianceRemediationTime(category: string, level: string): number {
    const baseHours: Record<string, number> = {
      access_anomaly: 4,
      policy_violation: 6,
      consent_violation: 12,
      data_retention: 8,
      unauthorized_access: 6,
      data_export: 10,
      audit_gap: 16,
      encryption_weakness: 24,
    };

    const levelMultiplier: Record<string, number> = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.75,
      info: 0.5,
    };

    return Math.round((baseHours[category] || 6) * (levelMultiplier[level] || 1));
  }

  getBacklogItems(filters?: {
    type?: IssueType;
    severity?: string;
    priority?: RemediationPriority;
    regulation?: RegulatoryFramework;
  }): BacklogItem[] {
    let items = Array.from(backlogStore.values());

    if (filters?.type) {
      items = items.filter(i => i.type === filters.type);
    }
    if (filters?.severity) {
      items = items.filter(i => i.severity === filters.severity);
    }
    if (filters?.priority) {
      items = items.filter(i => i.remediationPriority === filters.priority);
    }
    if (filters?.regulation) {
      items = items.filter(i => i.regulatory.frameworks.includes(filters.regulation!));
    }

    return items.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  getBacklogItem(id: string): BacklogItem | undefined {
    return backlogStore.get(id);
  }

  getMetrics(): BacklogMetrics {
    const items = Array.from(backlogStore.values());

    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<IssueType, number> = { policy_violation: 0, compliance_risk: 0 };
    const byPriority: Record<RemediationPriority, number> = { immediate: 0, urgent: 0, high: 0, medium: 0, low: 0 };
    const byRegulation: Record<string, number> = {};

    let totalPriority = 0;
    let oldestAge = 0;
    let totalHours = 0;
    let deadlinesCount = 0;

    const now = Date.now();

    for (const item of items) {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      byType[item.type]++;
      byPriority[item.remediationPriority]++;
      totalPriority += item.priorityScore;
      totalHours += item.estimatedRemediationHours;

      for (const framework of item.regulatory.frameworks) {
        byRegulation[framework] = (byRegulation[framework] || 0) + 1;
      }

      const age = now - new Date(item.detectedAt).getTime();
      if (age > oldestAge) oldestAge = age;

      if (item.regulatory.reportingRequired) deadlinesCount++;
    }

    return {
      totalItems: items.length,
      bySeverity,
      byType,
      byPriority,
      byRegulation,
      averagePriorityScore: items.length > 0 ? Math.round(totalPriority / items.length) : 0,
      oldestItemAge: Math.round(oldestAge / (1000 * 60 * 60 * 24)),
      estimatedTotalRemediationHours: totalHours,
      criticalDeadlinesCount: deadlinesCount,
    };
  }

  async generateRemediationPlan(userId: string): Promise<RemediationPlan> {
    logHipaaAudit("GENERATE_PLAN", "remediation_plan", userId, { action: "plan_generation_start" });

    await this.syncBacklog(userId);

    const items = this.getBacklogItems();
    const orderedItems = [...items].sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (a.regulatory.reportingRequired !== b.regulatory.reportingRequired) {
        return a.regulatory.reportingRequired ? -1 : 1;
      }
      return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
    });

    const groups = this.groupRelatedItems(orderedItems);

    const regulatoryDeadlines = this.calculateDeadlines(orderedItems);

    const aiRecommendations = await this.generateAIRecommendations(orderedItems, groups);

    const criticalItems = orderedItems.filter(i => i.remediationPriority === "immediate").length;
    const urgentItems = orderedItems.filter(i => i.remediationPriority === "urgent").length;

    const plan: RemediationPlan = {
      id: randomUUID(),
      generatedAt: new Date().toISOString(),
      generatedBy: hashIdentifier(userId),
      totalItems: orderedItems.length,
      criticalItems,
      urgentItems,
      orderedItems,
      groups,
      aiRecommendations,
      estimatedTotalHours: orderedItems.reduce((sum, i) => sum + i.estimatedRemediationHours, 0),
      regulatoryDeadlines,
      executiveSummary: this.generateExecutiveSummary(orderedItems, groups, regulatoryDeadlines),
    };

    remediationPlanStore.set(plan.id, plan);

    logHipaaAudit("GENERATE_PLAN", "remediation_plan", userId, { 
      action: "plan_generated", 
      planId: plan.id,
      totalItems: plan.totalItems,
      criticalItems: plan.criticalItems 
    });

    return plan;
  }

  private groupRelatedItems(items: BacklogItem[]): RemediationGroup[] {
    const categoryGroups = new Map<string, BacklogItem[]>();

    for (const item of items) {
      const key = item.category;
      const group = categoryGroups.get(key) || [];
      group.push(item);
      categoryGroups.set(key, group);
    }

    const groups: RemediationGroup[] = [];
    let order = 1;

    const sortedCategories = Array.from(categoryGroups.entries())
      .sort((a, b) => {
        const maxA = Math.max(...a[1].map(i => i.priorityScore));
        const maxB = Math.max(...b[1].map(i => i.priorityScore));
        return maxB - maxA;
      });

    for (const [category, groupItems] of sortedCategories) {
      if (groupItems.length > 1) {
        const allRegulations: RegulatoryFramework[] = [];
        for (const item of groupItems) {
          for (const reg of item.regulatory.frameworks) {
            if (!allRegulations.includes(reg)) {
              allRegulations.push(reg);
            }
          }
        }

        groups.push({
          id: randomUUID(),
          name: `${category.replace(/_/g, " ")} Issues`,
          description: `${groupItems.length} related ${category.replace(/_/g, " ")} issues that can be addressed together`,
          items: groupItems,
          totalPriorityScore: groupItems.reduce((sum, i) => sum + i.priorityScore, 0),
          estimatedTotalHours: groupItems.reduce((sum, i) => sum + i.estimatedRemediationHours, 0),
          recommendedOrder: order++,
          commonCategory: category,
          commonRegulations: allRegulations,
        });
      }
    }

    return groups;
  }

  private calculateDeadlines(items: BacklogItem[]): RemediationPlan["regulatoryDeadlines"] {
    const deadlineMap = new Map<RegulatoryFramework, { earliest: Date; count: number }>();

    for (const item of items) {
      if (item.regulatory.reportingRequired && item.regulatory.reportingDeadlineHours) {
        const deadline = new Date(new Date(item.detectedAt).getTime() + item.regulatory.reportingDeadlineHours * 60 * 60 * 1000);
        
        for (const framework of item.regulatory.frameworks) {
          const existing = deadlineMap.get(framework);
          if (!existing || deadline < existing.earliest) {
            deadlineMap.set(framework, { 
              earliest: deadline, 
              count: (existing?.count || 0) + 1 
            });
          } else if (existing) {
            existing.count++;
          }
        }
      }
    }

    return Array.from(deadlineMap.entries()).map(([framework, data]) => ({
      framework,
      deadline: data.earliest.toISOString(),
      itemsAffected: data.count,
    })).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }

  private async generateAIRecommendations(items: BacklogItem[], groups: RemediationGroup[]): Promise<string[]> {
    if (!aiEnabled || items.length === 0) {
      return this.getDefaultRecommendations(items, groups);
    }

    try {
      const summary = {
        totalItems: items.length,
        criticalCount: items.filter(i => i.severity === "critical").length,
        highCount: items.filter(i => i.severity === "high").length,
        categories: Array.from(new Set(items.map(i => i.category))),
        regulations: Array.from(new Set(items.flatMap(i => i.regulatory.frameworks))),
        reportingRequired: items.filter(i => i.regulatory.reportingRequired).length,
        groupCount: groups.length,
        topPriorityItems: items.slice(0, 5).map(i => ({
          title: i.title,
          severity: i.severity,
          priority: i.remediationPriority,
          score: i.priorityScore,
        })),
      };

      const response = await generatePhiSafeText({
        system: NO_CDS_SYSTEM_PROMPT,
        user: `Analyze this compliance backlog and provide prioritized remediation recommendations:

${JSON.stringify(summary, null, 2)}

Provide 5-7 actionable recommendations for addressing this backlog efficiently. Focus on:
1. Which items should be addressed first and why
2. Opportunities for batch remediation
3. Resource allocation suggestions
4. Regulatory deadline management
5. Risk mitigation strategies

Return as a JSON array of recommendation strings.`,
        temperature: 0.3,
        maxTokens: 1000,
      });

      const content = response?.trim() || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => typeof r === "string").slice(0, 7);
        }
      }
    } catch (error) {
      console.error("[BacklogAnalysis] AI recommendation generation failed:", error);
    }

    return this.getDefaultRecommendations(items, groups);
  }

  private getDefaultRecommendations(items: BacklogItem[], groups: RemediationGroup[]): string[] {
    const recommendations: string[] = [];
    
    const critical = items.filter(i => i.severity === "critical");
    if (critical.length > 0) {
      recommendations.push(`Address ${critical.length} critical severity items immediately - these represent the highest risk to the organization`);
    }

    const withDeadlines = items.filter(i => i.regulatory.reportingRequired);
    if (withDeadlines.length > 0) {
      recommendations.push(`Prioritize ${withDeadlines.length} items with regulatory reporting deadlines to avoid compliance penalties`);
    }

    if (groups.length > 0) {
      const largestGroup = groups.reduce((a, b) => a.items.length > b.items.length ? a : b);
      recommendations.push(`Consider batch remediation for ${largestGroup.name} (${largestGroup.items.length} related items) to improve efficiency`);
    }

    const consentIssues = items.filter(i => i.category.includes("consent"));
    if (consentIssues.length > 0) {
      recommendations.push(`Address consent-related issues promptly as they carry high regulatory risk under both HIPAA and GDPR`);
    }

    recommendations.push("Assign dedicated resources to high-priority items to ensure timely resolution");
    recommendations.push("Document all remediation actions for audit trail compliance");

    return recommendations;
  }

  private generateExecutiveSummary(
    items: BacklogItem[],
    groups: RemediationGroup[],
    deadlines: RemediationPlan["regulatoryDeadlines"]
  ): string {
    const critical = items.filter(i => i.remediationPriority === "immediate").length;
    const urgent = items.filter(i => i.remediationPriority === "urgent").length;
    const totalHours = items.reduce((sum, i) => sum + i.estimatedRemediationHours, 0);
    const earliestDeadline = deadlines[0];

    let summary = `The compliance backlog contains ${items.length} issues requiring attention. `;
    
    if (critical > 0 || urgent > 0) {
      summary += `Of these, ${critical} require immediate action and ${urgent} are urgent. `;
    }

    summary += `Estimated total remediation effort is ${totalHours} hours. `;

    if (earliestDeadline) {
      const deadline = new Date(earliestDeadline.deadline);
      const hoursRemaining = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
      summary += `The earliest regulatory deadline is in ${hoursRemaining} hours affecting ${earliestDeadline.itemsAffected} items under ${earliestDeadline.framework}. `;
    }

    if (groups.length > 0) {
      summary += `${groups.length} groups of related issues have been identified for efficient batch remediation.`;
    }

    return summary;
  }

  getRemediationPlan(id: string): RemediationPlan | undefined {
    return remediationPlanStore.get(id);
  }

  getRemediationPlans(): RemediationPlan[] {
    return Array.from(remediationPlanStore.values())
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }
}

export const aiBacklogAnalysisService = new AIBacklogAnalysisService();
console.log("[AIBacklogAnalysis] Service initialized");
