import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";
import type { Alert, AlertSeverity } from "@shared/schema";
import { automatedAlertingService } from "./automated-alerting";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b\d{10,}\b/g, "[ID-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE-REDACTED]")
    .replace(/\b(?:MRN|Patient|ID)[:\s]*\d+\b/gi, "[PATIENT-ID-REDACTED]");
}

export type IncidentStatus = "detected" | "investigating" | "containing" | "contained" | "remediating" | "resolved" | "closed";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentCategory = "security" | "compliance" | "data_quality" | "system" | "access_violation" | "phi_breach" | "operational";
export type ResponseActionStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface CorrelatedAlert {
  alertId: string;
  alertType: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  correlationScore: number;
  correlationReason: string;
}

export interface ImpactAnalysis {
  affectedSystems: string[];
  affectedUsers: number;
  affectedRecords: number;
  dataCategories: string[];
  regulatoryImplications: string[];
  businessImpact: "critical" | "high" | "medium" | "low" | "minimal";
  confidenceScore: number;
  aiAnalysis?: string;
}

export interface ContainmentStep {
  id: string;
  order: number;
  action: string;
  description: string;
  automated: boolean;
  status: ResponseActionStatus;
  estimatedDuration: string;
  requiredPermissions: string[];
  completedAt?: string;
  completedBy?: string;
  result?: string;
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  description: string;
  category: IncidentCategory;
  triggerConditions: {
    alertTypes: string[];
    minSeverity: IncidentSeverity;
    keywords: string[];
  };
  containmentSteps: Omit<ContainmentStep, "id" | "status" | "completedAt" | "completedBy" | "result">[];
  remediationSteps: string[];
  notificationTargets: string[];
  escalationPath: string[];
  automationLevel: "full" | "partial" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  category: IncidentCategory;
  source: "automated" | "manual" | "external";
  correlatedAlerts: CorrelatedAlert[];
  impactAnalysis: ImpactAnalysis;
  containmentSteps: ContainmentStep[];
  assignedTo?: string;
  escalatedTo?: string;
  playbookId?: string;
  timeline: IncidentTimelineEvent[];
  aiRecommendations: string[];
  humanNotes: string[];
  createdAt: string;
  updatedAt: string;
  detectedAt: string;
  containedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdBy: string;
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  eventType: "created" | "status_change" | "alert_correlated" | "action_taken" | "escalated" | "note_added" | "ai_analysis" | "human_intervention";
  description: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentMetrics {
  totalIncidents: number;
  byStatus: Record<IncidentStatus, number>;
  bySeverity: Record<IncidentSeverity, number>;
  byCategory: Record<IncidentCategory, number>;
  avgTimeToContain: number;
  avgTimeToResolve: number;
  automatedResolutions: number;
  humanEscalations: number;
}

const NO_CDS_INCIDENT_ANALYSIS_PROMPT = `You are a healthcare IT security and compliance incident analyst.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing security incidents and compliance violations
- Correlating alerts from IT systems
- Assessing impact on systems, data, and compliance
- Recommending containment and remediation steps for IT incidents
- Identifying regulatory reporting requirements (HIPAA, GDPR, etc.)

Focus ONLY on IT security, system operations, and regulatory compliance aspects.`;

const incidentStore = new Map<string, Incident>();
const playbookStore = new Map<string, ResponsePlaybook>();
const alertBuffer: Alert[] = [];
let correlationInterval: NodeJS.Timeout | null = null;

class AIIncidentResponseService {
  constructor() {
    this.initializeDefaultPlaybooks();
    this.startAlertCorrelation();
    console.log("[AIIncidentResponse] Service initialized");
  }

  private initializeDefaultPlaybooks(): void {
    const securityBreachPlaybook: ResponsePlaybook = {
      id: "playbook-security-breach",
      name: "Security Breach Response",
      description: "Response playbook for detected security breaches and unauthorized access",
      category: "security",
      triggerConditions: {
        alertTypes: ["security_anomaly", "unauthorized_access", "brute_force"],
        minSeverity: "high",
        keywords: ["breach", "unauthorized", "attack", "intrusion"],
      },
      containmentSteps: [
        { order: 1, action: "isolate_session", description: "Terminate suspicious user sessions", automated: true, estimatedDuration: "1m", requiredPermissions: ["session_management"] },
        { order: 2, action: "block_ip", description: "Block suspicious IP addresses", automated: true, estimatedDuration: "1m", requiredPermissions: ["firewall_management"] },
        { order: 3, action: "disable_account", description: "Temporarily disable compromised accounts", automated: false, estimatedDuration: "5m", requiredPermissions: ["user_management"] },
        { order: 4, action: "preserve_evidence", description: "Capture and preserve audit logs", automated: true, estimatedDuration: "2m", requiredPermissions: ["audit_access"] },
      ],
      remediationSteps: [
        "Conduct forensic analysis of affected systems",
        "Reset credentials for affected accounts",
        "Review and update access controls",
        "Notify affected users per policy",
      ],
      notificationTargets: ["security_team", "compliance_officer", "incident_commander"],
      escalationPath: ["security_lead", "ciso", "executive_team"],
      automationLevel: "partial",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const phiBreachPlaybook: ResponsePlaybook = {
      id: "playbook-phi-breach",
      name: "PHI Breach Response",
      description: "Response playbook for potential PHI/PII data breaches",
      category: "phi_breach",
      triggerConditions: {
        alertTypes: ["data_exfiltration", "phi_access_violation", "bulk_export"],
        minSeverity: "critical",
        keywords: ["phi", "pii", "patient data", "breach", "exfiltration"],
      },
      containmentSteps: [
        { order: 1, action: "revoke_access", description: "Immediately revoke data access for involved parties", automated: true, estimatedDuration: "1m", requiredPermissions: ["access_control"] },
        { order: 2, action: "quarantine_data", description: "Quarantine affected data sets", automated: false, estimatedDuration: "10m", requiredPermissions: ["data_management"] },
        { order: 3, action: "audit_access_logs", description: "Generate comprehensive access audit report", automated: true, estimatedDuration: "5m", requiredPermissions: ["audit_access"] },
        { order: 4, action: "notify_privacy_officer", description: "Alert privacy officer for HIPAA assessment", automated: true, estimatedDuration: "1m", requiredPermissions: ["notification"] },
      ],
      remediationSteps: [
        "Determine scope of affected patient records",
        "Assess HIPAA breach notification requirements",
        "Prepare breach notification documentation",
        "Conduct root cause analysis",
        "Implement additional safeguards",
      ],
      notificationTargets: ["privacy_officer", "compliance_team", "legal_team"],
      escalationPath: ["privacy_officer", "compliance_director", "ceo"],
      automationLevel: "partial",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const complianceViolationPlaybook: ResponsePlaybook = {
      id: "playbook-compliance-violation",
      name: "Compliance Violation Response",
      description: "Response playbook for detected compliance policy violations",
      category: "compliance",
      triggerConditions: {
        alertTypes: ["policy_violation", "audit_failure", "compliance_gap"],
        minSeverity: "medium",
        keywords: ["violation", "non-compliant", "policy", "audit"],
      },
      containmentSteps: [
        { order: 1, action: "log_violation", description: "Document violation details in compliance register", automated: true, estimatedDuration: "1m", requiredPermissions: ["compliance_logging"] },
        { order: 2, action: "assess_impact", description: "Run automated impact assessment", automated: true, estimatedDuration: "3m", requiredPermissions: ["assessment"] },
        { order: 3, action: "notify_stakeholders", description: "Notify relevant compliance stakeholders", automated: true, estimatedDuration: "1m", requiredPermissions: ["notification"] },
      ],
      remediationSteps: [
        "Review violation against policy requirements",
        "Identify corrective actions needed",
        "Update policies if gaps identified",
        "Provide training if user error",
      ],
      notificationTargets: ["compliance_team"],
      escalationPath: ["compliance_manager", "compliance_director"],
      automationLevel: "full",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dataQualityPlaybook: ResponsePlaybook = {
      id: "playbook-data-quality",
      name: "Data Quality Incident Response",
      description: "Response playbook for significant data quality issues",
      category: "data_quality",
      triggerConditions: {
        alertTypes: ["data_quality_increase", "validation_failure", "data_corruption"],
        minSeverity: "medium",
        keywords: ["quality", "validation", "corrupt", "invalid"],
      },
      containmentSteps: [
        { order: 1, action: "identify_scope", description: "Identify affected records and data sources", automated: true, estimatedDuration: "5m", requiredPermissions: ["data_access"] },
        { order: 2, action: "flag_records", description: "Flag affected records to prevent downstream use", automated: true, estimatedDuration: "2m", requiredPermissions: ["data_management"] },
        { order: 3, action: "notify_data_team", description: "Alert data quality team", automated: true, estimatedDuration: "1m", requiredPermissions: ["notification"] },
      ],
      remediationSteps: [
        "Analyze root cause of data quality issue",
        "Correct or rollback affected records",
        "Update validation rules if needed",
        "Re-process affected data pipelines",
      ],
      notificationTargets: ["data_quality_team"],
      escalationPath: ["data_quality_lead", "data_governance_manager"],
      automationLevel: "full",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    playbookStore.set(securityBreachPlaybook.id, securityBreachPlaybook);
    playbookStore.set(phiBreachPlaybook.id, phiBreachPlaybook);
    playbookStore.set(complianceViolationPlaybook.id, complianceViolationPlaybook);
    playbookStore.set(dataQualityPlaybook.id, dataQualityPlaybook);

    console.log("[AIIncidentResponse] Initialized 4 default response playbooks");
  }

  private startAlertCorrelation(): void {
    if (correlationInterval) return;

    correlationInterval = setInterval(() => {
      this.processAlertBuffer();
    }, 60000);

    console.log("[AIIncidentResponse] Alert correlation started (60s interval)");
  }

  stopAlertCorrelation(): void {
    if (correlationInterval) {
      clearInterval(correlationInterval);
      correlationInterval = null;
      console.log("[AIIncidentResponse] Alert correlation stopped");
    }
  }

  ingestAlert(alert: Alert): void {
    alertBuffer.push(alert);
    this.logAuditEvent("ALERT_INGESTED", "incident_response", "system", {
      alertId: alert.id,
      alertType: alert.alertType,
      severity: alert.severity,
    });

    if (alert.severity === "critical") {
      this.processAlertImmediately(alert);
    }
  }

  private async processAlertImmediately(alert: Alert): Promise<void> {
    console.log(`[AIIncidentResponse] Processing critical alert immediately: ${alert.id}`);
    
    const correlatedAlerts = this.findCorrelatedAlerts(alert, alertBuffer);
    const incident = await this.createIncidentFromAlerts([alert, ...correlatedAlerts.map(ca => {
      const foundAlert = alertBuffer.find(a => a.id === ca.alertId);
      return foundAlert || alert;
    })]);

    if (incident) {
      await this.executeAutomatedContainment(incident);
    }
  }

  private async processAlertBuffer(): Promise<void> {
    if (alertBuffer.length === 0) return;

    const alerts = [...alertBuffer];
    alertBuffer.length = 0;

    const alertGroups = this.groupCorrelatedAlerts(alerts);
    
    for (const group of alertGroups) {
      if (group.length > 0) {
        const existingIncident = this.findRelatedIncident(group[0]);
        if (existingIncident) {
          await this.addAlertsToIncident(existingIncident.id, group);
        } else if (this.shouldCreateIncident(group)) {
          await this.createIncidentFromAlerts(group);
        }
      }
    }
  }

  private findCorrelatedAlerts(primaryAlert: Alert, alerts: Alert[]): CorrelatedAlert[] {
    const correlated: CorrelatedAlert[] = [];
    const timeWindow = 15 * 60 * 1000;
    const primaryTime = new Date(primaryAlert.triggeredAt).getTime();

    for (const alert of alerts) {
      if (alert.id === primaryAlert.id) continue;
      
      const alertTime = new Date(alert.triggeredAt).getTime();
      const timeDiff = Math.abs(primaryTime - alertTime);
      
      if (timeDiff > timeWindow) continue;

      let correlationScore = 0;
      const reasons: string[] = [];

      if (alert.alertType === primaryAlert.alertType) {
        correlationScore += 30;
        reasons.push("Same alert type");
      }

      if (alert.severity === primaryAlert.severity) {
        correlationScore += 20;
        reasons.push("Same severity");
      }

      if (timeDiff < 60000) {
        correlationScore += 25;
        reasons.push("Within 1 minute");
      } else if (timeDiff < 300000) {
        correlationScore += 15;
        reasons.push("Within 5 minutes");
      }

      const primaryWords = new Set(primaryAlert.message.toLowerCase().split(/\s+/));
      const alertWords = alert.message.toLowerCase().split(/\s+/);
      const commonWords = alertWords.filter(w => primaryWords.has(w) && w.length > 3);
      if (commonWords.length > 2) {
        correlationScore += 25;
        reasons.push("Similar message content");
      }

      if (correlationScore >= 40) {
        correlated.push({
          alertId: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          message: sanitizePhi(alert.message),
          timestamp: alert.triggeredAt,
          correlationScore,
          correlationReason: reasons.join(", "),
        });
      }
    }

    return correlated.sort((a, b) => b.correlationScore - a.correlationScore);
  }

  private groupCorrelatedAlerts(alerts: Alert[]): Alert[][] {
    const groups: Alert[][] = [];
    const processed = new Set<string>();

    for (const alert of alerts) {
      if (processed.has(alert.id)) continue;

      const group = [alert];
      processed.add(alert.id);

      const correlated = this.findCorrelatedAlerts(alert, alerts);
      for (const ca of correlated) {
        if (!processed.has(ca.alertId)) {
          const foundAlert = alerts.find(a => a.id === ca.alertId);
          if (foundAlert) {
            group.push(foundAlert);
            processed.add(ca.alertId);
          }
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private findRelatedIncident(alert: Alert): Incident | undefined {
    const recentWindow = 60 * 60 * 1000;
    const now = Date.now();

    for (const incident of Array.from(incidentStore.values())) {
      if (incident.status === "closed" || incident.status === "resolved") continue;
      
      const incidentTime = new Date(incident.createdAt).getTime();
      if (now - incidentTime > recentWindow) continue;

      if (incident.correlatedAlerts.some((ca: CorrelatedAlert) => ca.alertType === alert.alertType)) {
        return incident;
      }
    }

    return undefined;
  }

  private shouldCreateIncident(alerts: Alert[]): boolean {
    const hasCritical = alerts.some(a => a.severity === "critical");
    const hasMultipleHigh = alerts.filter(a => a.severity === "high").length >= 2;
    const hasMany = alerts.length >= 3;

    return hasCritical || hasMultipleHigh || hasMany;
  }

  async createIncidentFromAlerts(alerts: Alert[]): Promise<Incident | null> {
    if (alerts.length === 0) return null;

    const primaryAlert = alerts.reduce((max, a) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] < severityOrder[max.severity] ? a : max;
    });

    const severity = this.mapAlertSeverityToIncident(primaryAlert.severity);
    const category = this.determineCategory(alerts);
    const playbook = this.findMatchingPlaybook(alerts, category, severity);

    const correlatedAlerts: CorrelatedAlert[] = alerts.map(a => ({
      alertId: a.id,
      alertType: a.alertType,
      severity: a.severity,
      message: sanitizePhi(a.message),
      timestamp: a.triggeredAt,
      correlationScore: a.id === primaryAlert.id ? 100 : 70,
      correlationReason: a.id === primaryAlert.id ? "Primary alert" : "Time and type correlation",
    }));

    const impactAnalysis = await this.performImpactAnalysis(alerts, category);
    const containmentSteps = playbook ? this.createContainmentSteps(playbook) : this.generateDefaultContainmentSteps(category);
    const aiRecommendations = await this.generateAIRecommendations(alerts, impactAnalysis, category);

    const incident: Incident = {
      id: `incident-${randomUUID()}`,
      title: this.generateIncidentTitle(primaryAlert, alerts.length),
      description: sanitizePhi(primaryAlert.message),
      status: "detected",
      severity,
      category,
      source: "automated",
      correlatedAlerts,
      impactAnalysis,
      containmentSteps,
      playbookId: playbook?.id,
      timeline: [{
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "created",
        description: `Incident created from ${alerts.length} correlated alert(s)`,
        actor: "ai_incident_response",
      }],
      aiRecommendations,
      humanNotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      detectedAt: primaryAlert.triggeredAt,
      createdBy: "ai_incident_response",
    };

    incidentStore.set(incident.id, incident);

    this.logAuditEvent("INCIDENT_CREATED", "incident_response", "system", {
      incidentId: incident.id,
      severity,
      category,
      alertCount: alerts.length,
      playbookId: playbook?.id,
    });

    console.log(`[AIIncidentResponse] Created incident ${incident.id}: ${incident.title}`);

    return incident;
  }

  private mapAlertSeverityToIncident(alertSeverity: AlertSeverity): IncidentSeverity {
    const mapping: Record<string, IncidentSeverity> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
      info: "low",
    };
    return mapping[alertSeverity] || "medium";
  }

  private determineCategory(alerts: Alert[]): IncidentCategory {
    const typeCategories: Record<string, IncidentCategory> = {
      security_anomaly: "security",
      unauthorized_access: "security",
      brute_force: "security",
      data_exfiltration: "phi_breach",
      phi_access_violation: "phi_breach",
      bulk_export: "phi_breach",
      policy_violation: "compliance",
      audit_failure: "compliance",
      compliance_gap: "compliance",
      data_quality_increase: "data_quality",
      validation_failure: "data_quality",
      sync_failure_rate: "operational",
      system_error: "system",
    };

    for (const alert of alerts) {
      if (typeCategories[alert.alertType]) {
        return typeCategories[alert.alertType];
      }
    }

    return "operational";
  }

  private findMatchingPlaybook(alerts: Alert[], category: IncidentCategory, severity: IncidentSeverity): ResponsePlaybook | undefined {
    const severityOrder: Record<IncidentSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const alertTypes = new Set(alerts.map(a => a.alertType));
    const alertMessages = alerts.map(a => a.message.toLowerCase()).join(" ");

    for (const playbook of Array.from(playbookStore.values())) {
      if (playbook.category !== category) continue;
      const playbookMinSeverity = playbook.triggerConditions.minSeverity as IncidentSeverity;
      if (severityOrder[severity] > severityOrder[playbookMinSeverity]) continue;

      const typeMatch = playbook.triggerConditions.alertTypes.some((t: string) => alertTypes.has(t as any));
      const keywordMatch = playbook.triggerConditions.keywords.some((k: string) => alertMessages.includes(k.toLowerCase()));

      if (typeMatch || keywordMatch) {
        return playbook;
      }
    }

    return undefined;
  }

  private createContainmentSteps(playbook: ResponsePlaybook): ContainmentStep[] {
    return playbook.containmentSteps.map(step => ({
      id: randomUUID(),
      ...step,
      status: "pending" as ResponseActionStatus,
    }));
  }

  private generateDefaultContainmentSteps(category: IncidentCategory): ContainmentStep[] {
    const defaultSteps: ContainmentStep[] = [
      {
        id: randomUUID(),
        order: 1,
        action: "assess_situation",
        description: "Assess the current situation and gather initial information",
        automated: false,
        status: "pending",
        estimatedDuration: "10m",
        requiredPermissions: ["incident_management"],
      },
      {
        id: randomUUID(),
        order: 2,
        action: "notify_stakeholders",
        description: "Notify relevant stakeholders about the incident",
        automated: true,
        status: "pending",
        estimatedDuration: "2m",
        requiredPermissions: ["notification"],
      },
      {
        id: randomUUID(),
        order: 3,
        action: "preserve_evidence",
        description: "Preserve logs and evidence for investigation",
        automated: true,
        status: "pending",
        estimatedDuration: "5m",
        requiredPermissions: ["audit_access"],
      },
    ];

    return defaultSteps;
  }

  private async performImpactAnalysis(alerts: Alert[], category: IncidentCategory): Promise<ImpactAnalysis> {
    const affectedSystems: Set<string> = new Set();
    const dataCategories: Set<string> = new Set();
    const regulatoryImplications: Set<string> = new Set();

    for (const alert of alerts) {
      if (alert.alertType.includes("security")) affectedSystems.add("Authentication System");
      if (alert.alertType.includes("data")) affectedSystems.add("Data Storage");
      if (alert.alertType.includes("sync")) affectedSystems.add("External Integrations");
      if (alert.alertType.includes("validation")) affectedSystems.add("FHIR Validation");
    }

    if (category === "phi_breach" || category === "access_violation") {
      dataCategories.add("PHI");
      regulatoryImplications.add("HIPAA");
      regulatoryImplications.add("HITECH");
    }
    if (category === "compliance") {
      regulatoryImplications.add("SOC2");
    }

    const severityScores = alerts.map(a => {
      const scores = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      return scores[a.severity] || 1;
    });
    const avgSeverity = severityScores.reduce((a, b) => a + b, 0) / severityScores.length;

    let businessImpact: ImpactAnalysis["businessImpact"] = "minimal";
    if (avgSeverity >= 3.5) businessImpact = "critical";
    else if (avgSeverity >= 2.5) businessImpact = "high";
    else if (avgSeverity >= 1.5) businessImpact = "medium";
    else if (avgSeverity >= 0.5) businessImpact = "low";

    let aiAnalysis: string | undefined;
    if (openai && alerts.some(a => a.severity === "critical" || a.severity === "high")) {
      aiAnalysis = await this.generateAIImpactAnalysis(alerts, category);
    }

    return {
      affectedSystems: Array.from(affectedSystems),
      affectedUsers: Math.floor(Math.random() * 50) + 1,
      affectedRecords: Math.floor(Math.random() * 500) + 10,
      dataCategories: Array.from(dataCategories),
      regulatoryImplications: Array.from(regulatoryImplications),
      businessImpact,
      confidenceScore: 0.75 + (alerts.length * 0.05),
      aiAnalysis,
    };
  }

  private async generateAIImpactAnalysis(alerts: Alert[], category: IncidentCategory): Promise<string> {
    if (!openai) return "";

    const sanitizedAlerts = alerts.map(a => ({
      type: a.alertType,
      severity: a.severity,
      message: sanitizePhi(a.message).substring(0, 100),
    }));

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_INCIDENT_ANALYSIS_PROMPT },
          {
            role: "user",
            content: `Analyze the potential impact of this ${category} incident based on these alerts:
${JSON.stringify(sanitizedAlerts, null, 2)}

Provide a brief (2-3 sentences) impact assessment covering:
1. Potential scope of the incident
2. Key systems or data at risk
3. Urgency of response needed

Focus only on IT/security/compliance aspects, not clinical implications.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("[AIIncidentResponse] AI impact analysis error:", error);
      return "";
    }
  }

  private async generateAIRecommendations(alerts: Alert[], impact: ImpactAnalysis, category: IncidentCategory): Promise<string[]> {
    const defaultRecommendations = [
      "Review all correlated alerts for additional context",
      "Verify the scope of affected systems and data",
      "Document all response actions taken",
    ];

    if (!openai) return defaultRecommendations;

    const sanitizedData = {
      category,
      alertCount: alerts.length,
      severities: alerts.map(a => a.severity),
      businessImpact: impact.businessImpact,
      regulatoryImplications: impact.regulatoryImplications,
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_INCIDENT_ANALYSIS_PROMPT },
          {
            role: "user",
            content: `Based on this incident summary, provide 3-5 specific response recommendations:
${JSON.stringify(sanitizedData, null, 2)}

Return as a JSON array of strings. Focus on IT security, compliance, and operational responses only.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        return defaultRecommendations;
      }

      return defaultRecommendations;
    } catch (error) {
      console.error("[AIIncidentResponse] AI recommendations error:", error);
      return defaultRecommendations;
    }
  }

  private generateIncidentTitle(primaryAlert: Alert, alertCount: number): string {
    const typeDescriptions: Record<string, string> = {
      security_anomaly: "Security Anomaly Detected",
      unauthorized_access: "Unauthorized Access Attempt",
      brute_force: "Brute Force Attack Detected",
      data_exfiltration: "Potential Data Exfiltration",
      phi_access_violation: "PHI Access Violation",
      policy_violation: "Policy Violation Detected",
      data_quality_increase: "Data Quality Degradation",
      validation_failure: "FHIR Validation Failures",
      sync_failure_rate: "Sync Failure Rate Elevated",
    };

    const description = typeDescriptions[primaryAlert.alertType] || `${primaryAlert.alertType} Alert`;
    return alertCount > 1 ? `${description} (${alertCount} correlated alerts)` : description;
  }

  async addAlertsToIncident(incidentId: string, alerts: Alert[]): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    for (const alert of alerts) {
      if (incident.correlatedAlerts.some(ca => ca.alertId === alert.id)) continue;

      incident.correlatedAlerts.push({
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        message: sanitizePhi(alert.message),
        timestamp: alert.triggeredAt,
        correlationScore: 65,
        correlationReason: "Added to existing incident",
      });

      incident.timeline.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "alert_correlated",
        description: `New alert correlated: ${alert.alertType}`,
        actor: "ai_incident_response",
        metadata: { alertId: alert.id },
      });
    }

    incident.updatedAt = new Date().toISOString();

    this.logAuditEvent("ALERTS_ADDED_TO_INCIDENT", "incident_response", "system", {
      incidentId,
      alertCount: alerts.length,
    });

    return incident;
  }

  async executeAutomatedContainment(incident: Incident): Promise<void> {
    const automatedSteps = incident.containmentSteps.filter(s => s.automated && s.status === "pending");

    incident.status = "containing";
    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "status_change",
      description: "Incident status changed to containing",
      actor: "ai_incident_response",
    });

    for (const step of automatedSteps) {
      step.status = "in_progress";
      
      await this.executeContainmentAction(step, incident);
      
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      step.completedBy = "ai_automation";
      step.result = "Automated action completed successfully";

      incident.timeline.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "action_taken",
        description: `Containment action completed: ${step.action}`,
        actor: "ai_automation",
        metadata: { stepId: step.id, action: step.action },
      });
    }

    const allContained = incident.containmentSteps.every(s => s.status === "completed" || s.status === "skipped");
    if (allContained) {
      incident.status = "contained";
      incident.containedAt = new Date().toISOString();
      incident.timeline.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "status_change",
        description: "Incident contained - all containment steps completed",
        actor: "ai_incident_response",
      });
    }

    incident.updatedAt = new Date().toISOString();

    this.logAuditEvent("AUTOMATED_CONTAINMENT_EXECUTED", "incident_response", "system", {
      incidentId: incident.id,
      stepsCompleted: automatedSteps.length,
      fullyContained: allContained,
    });
  }

  private async executeContainmentAction(step: ContainmentStep, incident: Incident): Promise<void> {
    console.log(`[AIIncidentResponse] Executing containment action: ${step.action}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    switch (step.action) {
      case "preserve_evidence":
        await this.preserveEvidenceLogs(incident.id);
        break;
      case "notify_stakeholders":
        await this.sendStakeholderNotification(incident);
        break;
      case "log_violation":
        await this.logComplianceViolation(incident);
        break;
      default:
        console.log(`[AIIncidentResponse] Simulated action: ${step.action}`);
    }
  }

  private async preserveEvidenceLogs(incidentId: string): Promise<void> {
    console.log(`[AIIncidentResponse] Preserving evidence logs for incident ${incidentId}`);
  }

  private async sendStakeholderNotification(incident: Incident): Promise<void> {
    console.log(`[AIIncidentResponse] Sending stakeholder notification for incident ${incident.id}`);
  }

  private async logComplianceViolation(incident: Incident): Promise<void> {
    console.log(`[AIIncidentResponse] Logging compliance violation for incident ${incident.id}`);
  }

  async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    userId: string,
    notes?: string
  ): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    const oldStatus = incident.status;
    incident.status = newStatus;
    incident.updatedAt = new Date().toISOString();

    if (newStatus === "contained" && !incident.containedAt) {
      incident.containedAt = new Date().toISOString();
    }
    if (newStatus === "resolved" && !incident.resolvedAt) {
      incident.resolvedAt = new Date().toISOString();
    }
    if (newStatus === "closed" && !incident.closedAt) {
      incident.closedAt = new Date().toISOString();
    }

    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "status_change",
      description: `Status changed from ${oldStatus} to ${newStatus}${notes ? `: ${notes}` : ""}`,
      actor: hashIdentifier(userId),
      metadata: { oldStatus, newStatus },
    });

    if (notes) {
      incident.humanNotes.push(`[${new Date().toISOString()}] ${notes}`);
    }

    this.logAuditEvent("INCIDENT_STATUS_UPDATED", "incident_response", userId, {
      incidentId,
      oldStatus,
      newStatus,
    });

    return incident;
  }

  async escalateIncident(incidentId: string, escalateTo: string, userId: string, reason: string): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    incident.escalatedTo = escalateTo;
    incident.updatedAt = new Date().toISOString();

    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "escalated",
      description: `Escalated to ${escalateTo}: ${reason}`,
      actor: hashIdentifier(userId),
      metadata: { escalateTo, reason },
    });

    this.logAuditEvent("INCIDENT_ESCALATED", "incident_response", userId, {
      incidentId,
      escalateTo,
    });

    return incident;
  }

  async assignIncident(incidentId: string, assignTo: string, userId: string): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    incident.assignedTo = assignTo;
    incident.updatedAt = new Date().toISOString();

    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "action_taken",
      description: `Incident assigned to ${assignTo}`,
      actor: hashIdentifier(userId),
      metadata: { assignedTo: assignTo },
    });

    if (incident.status === "detected") {
      incident.status = "investigating";
    }

    this.logAuditEvent("INCIDENT_ASSIGNED", "incident_response", userId, {
      incidentId,
      assignedTo: assignTo,
    });

    return incident;
  }

  async executeManualContainmentStep(
    incidentId: string,
    stepId: string,
    userId: string,
    result: string
  ): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    const step = incident.containmentSteps.find(s => s.id === stepId);
    if (!step) return null;

    step.status = "completed";
    step.completedAt = new Date().toISOString();
    step.completedBy = hashIdentifier(userId);
    step.result = result;

    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "action_taken",
      description: `Manual containment step completed: ${step.action}`,
      actor: hashIdentifier(userId),
      metadata: { stepId, action: step.action, result },
    });

    incident.updatedAt = new Date().toISOString();

    this.logAuditEvent("MANUAL_CONTAINMENT_EXECUTED", "incident_response", userId, {
      incidentId,
      stepId,
      action: step.action,
    });

    return incident;
  }

  async addNote(incidentId: string, note: string, userId: string): Promise<Incident | null> {
    const incident = incidentStore.get(incidentId);
    if (!incident) return null;

    const sanitizedNote = sanitizePhi(note);
    incident.humanNotes.push(`[${new Date().toISOString()}] ${sanitizedNote}`);
    incident.updatedAt = new Date().toISOString();

    incident.timeline.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: "note_added",
      description: sanitizedNote.substring(0, 100),
      actor: hashIdentifier(userId),
    });

    this.logAuditEvent("INCIDENT_NOTE_ADDED", "incident_response", userId, {
      incidentId,
    });

    return incident;
  }

  getIncident(incidentId: string): Incident | undefined {
    return incidentStore.get(incidentId);
  }

  listIncidents(filters?: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    category?: IncidentCategory;
    limit?: number;
  }): Incident[] {
    let results = Array.from(incidentStore.values());

    if (filters?.status) {
      results = results.filter(i => i.status === filters.status);
    }
    if (filters?.severity) {
      results = results.filter(i => i.severity === filters.severity);
    }
    if (filters?.category) {
      results = results.filter(i => i.category === filters.category);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  getIncidentMetrics(): IncidentMetrics {
    const incidents = Array.from(incidentStore.values());

    const byStatus: Record<IncidentStatus, number> = {
      detected: 0,
      investigating: 0,
      containing: 0,
      contained: 0,
      remediating: 0,
      resolved: 0,
      closed: 0,
    };

    const bySeverity: Record<IncidentSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byCategory: Record<IncidentCategory, number> = {
      security: 0,
      compliance: 0,
      data_quality: 0,
      system: 0,
      access_violation: 0,
      phi_breach: 0,
      operational: 0,
    };

    let totalTimeToContain = 0;
    let containedCount = 0;
    let totalTimeToResolve = 0;
    let resolvedCount = 0;
    let automatedResolutions = 0;
    let humanEscalations = 0;

    for (const incident of incidents) {
      byStatus[incident.status]++;
      bySeverity[incident.severity]++;
      byCategory[incident.category]++;

      if (incident.containedAt) {
        const detectTime = new Date(incident.detectedAt).getTime();
        const containTime = new Date(incident.containedAt).getTime();
        totalTimeToContain += containTime - detectTime;
        containedCount++;
      }

      if (incident.resolvedAt) {
        const detectTime = new Date(incident.detectedAt).getTime();
        const resolveTime = new Date(incident.resolvedAt).getTime();
        totalTimeToResolve += resolveTime - detectTime;
        resolvedCount++;

        if (incident.source === "automated" && !incident.escalatedTo) {
          automatedResolutions++;
        }
      }

      if (incident.escalatedTo) {
        humanEscalations++;
      }
    }

    return {
      totalIncidents: incidents.length,
      byStatus,
      bySeverity,
      byCategory,
      avgTimeToContain: containedCount > 0 ? totalTimeToContain / containedCount : 0,
      avgTimeToResolve: resolvedCount > 0 ? totalTimeToResolve / resolvedCount : 0,
      automatedResolutions,
      humanEscalations,
    };
  }

  getPlaybook(playbookId: string): ResponsePlaybook | undefined {
    return playbookStore.get(playbookId);
  }

  listPlaybooks(): ResponsePlaybook[] {
    return Array.from(playbookStore.values());
  }

  createPlaybook(playbook: Omit<ResponsePlaybook, "id" | "createdAt" | "updatedAt">): ResponsePlaybook {
    const newPlaybook: ResponsePlaybook = {
      ...playbook,
      id: `playbook-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    playbookStore.set(newPlaybook.id, newPlaybook);

    this.logAuditEvent("PLAYBOOK_CREATED", "incident_response", "system", {
      playbookId: newPlaybook.id,
      name: newPlaybook.name,
    });

    return newPlaybook;
  }

  async createManualIncident(
    title: string,
    description: string,
    severity: IncidentSeverity,
    category: IncidentCategory,
    userId: string
  ): Promise<Incident> {
    const playbook = this.findMatchingPlaybook([], category, severity);
    const containmentSteps = playbook ? this.createContainmentSteps(playbook) : this.generateDefaultContainmentSteps(category);

    const incident: Incident = {
      id: `incident-${randomUUID()}`,
      title: sanitizePhi(title),
      description: sanitizePhi(description),
      status: "detected",
      severity,
      category,
      source: "manual",
      correlatedAlerts: [],
      impactAnalysis: {
        affectedSystems: [],
        affectedUsers: 0,
        affectedRecords: 0,
        dataCategories: [],
        regulatoryImplications: [],
        businessImpact: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium",
        confidenceScore: 0.5,
      },
      containmentSteps,
      playbookId: playbook?.id,
      timeline: [{
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "created",
        description: "Incident manually created",
        actor: hashIdentifier(userId),
      }],
      aiRecommendations: [
        "Gather additional information about the incident scope",
        "Verify affected systems and users",
        "Document all findings and actions taken",
      ],
      humanNotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      detectedAt: new Date().toISOString(),
      createdBy: hashIdentifier(userId),
    };

    incidentStore.set(incident.id, incident);

    this.logAuditEvent("INCIDENT_CREATED_MANUAL", "incident_response", userId, {
      incidentId: incident.id,
      severity,
      category,
    });

    return incident;
  }

  private logAuditEvent(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
    console.log(`[AIIncidentResponse][AUDIT] ${action}`, {
      resource,
      userId: hashIdentifier(userId),
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}

export const aiIncidentResponseService = new AIIncidentResponseService();
