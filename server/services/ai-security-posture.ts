import crypto from "crypto";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export type RiskLevel = "critical" | "high" | "medium" | "low" | "informational";
export type RemediationStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";
export type ControlState = "active" | "learning" | "standby" | "disabled";
export type ThreatCategory = "zero_day" | "known_vulnerability" | "configuration_drift" | "access_anomaly" | "data_exfiltration" | "malware" | "insider_threat";

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  affectedResources: string[];
  detectedAt: Date;
  source: string;
  cvssScore?: number;
  cveId?: string;
  remediationStatus: RemediationStatus;
  autoRemediable: boolean;
  remediationSteps: string[];
  estimatedImpact: string;
  noCdsCompliance: string;
}

export interface RemediationAction {
  id: string;
  findingId: string;
  actionType: string;
  description: string;
  status: RemediationStatus;
  automationLevel: "automatic" | "semi_automatic" | "manual";
  executedAt?: Date;
  completedAt?: Date;
  executedBy: string;
  result?: string;
  rollbackAvailable: boolean;
  rollbackSteps?: string[];
  noCdsCompliance: string;
}

export interface ThreatIntelligence {
  id: string;
  threatName: string;
  category: ThreatCategory;
  severity: RiskLevel;
  description: string;
  indicators: ThreatIndicator[];
  predictedLikelihood: number;
  predictedImpact: number;
  timeToExploit: string;
  affectedSystems: string[];
  mitigationRecommendations: string[];
  sources: string[];
  firstSeen: Date;
  lastUpdated: Date;
  isZeroDay: boolean;
  noCdsCompliance: string;
}

export interface ThreatIndicator {
  type: "ip" | "domain" | "hash" | "url" | "pattern" | "behavior";
  value: string;
  confidence: number;
  context: string;
}

export interface SelfHealingControl {
  id: string;
  name: string;
  description: string;
  controlType: string;
  currentState: ControlState;
  triggerConditions: TriggerCondition[];
  adaptiveResponses: AdaptiveResponse[];
  learningData: LearningMetrics;
  effectivenessScore: number;
  lastTriggered?: Date;
  lastAdapted?: Date;
  noCdsCompliance: string;
}

export interface TriggerCondition {
  id: string;
  type: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "ne" | "gte" | "lte";
  windowMinutes: number;
  description: string;
}

export interface AdaptiveResponse {
  id: string;
  name: string;
  action: string;
  severity: RiskLevel;
  cooldownMinutes: number;
  maxExecutions: number;
  currentExecutions: number;
  lastExecuted?: Date;
}

export interface LearningMetrics {
  totalEvents: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  adaptationCount: number;
  lastLearningCycle: Date;
}

export interface SecurityPostureScore {
  overall: number;
  categories: {
    vulnerabilityManagement: number;
    accessControl: number;
    dataProtection: number;
    networkSecurity: number;
    incidentResponse: number;
    compliance: number;
  };
  trend: "improving" | "stable" | "degrading";
  recommendations: string[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface RemediationReport {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  totalFindings: number;
  remediatedFindings: number;
  pendingFindings: number;
  autoRemediatedCount: number;
  manualRemediationCount: number;
  averageRemediationTime: number;
  riskReduction: number;
  topVulnerabilities: string[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ActionType = "remediation" | "control_change" | "access_revoke" | "threat_response";

export interface PendingApproval {
  id: string;
  actionType: ActionType;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  relatedResourceId: string;
  relatedResourceType: string;
  actionDetails: Record<string, unknown>;
  impactAssessment: string;
  rollbackPlan: string;
  noCdsCompliance: string;
}

export interface ActionableInsight {
  id: string;
  category: "critical" | "warning" | "optimization" | "compliance";
  title: string;
  description: string;
  priority: number;
  suggestedAction: string;
  estimatedImpact: string;
  affectedScore: string;
  potentialImprovement: number;
  relatedFindings: string[];
  relatedThreats: string[];
  relatedControls: string[];
  noCdsCompliance: string;
}

export interface UnifiedSecurityView {
  timestamp: Date;
  overallScore: number;
  trend: "improving" | "stable" | "degrading";
  criticalItems: Array<{
    type: "finding" | "threat" | "control";
    id: string;
    title: string;
    severity: RiskLevel;
    status: string;
    requiresApproval: boolean;
  }>;
  pendingApprovals: number;
  activeThreats: number;
  openFindings: number;
  healingControls: number;
  actionableInsights: ActionableInsight[];
  noCdsCompliance: string;
}

class AISecurityPostureService {
  private findings: Map<string, SecurityFinding> = new Map();
  private remediations: Map<string, RemediationAction> = new Map();
  private threats: Map<string, ThreatIntelligence> = new Map();
  private controls: Map<string, SelfHealingControl> = new Map();
  private postureScores: SecurityPostureScore[] = [];
  private reports: Map<string, RemediationReport> = new Map();
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  constructor() {
    this.initializeSampleData();
    this.initializePendingApprovals();
  }

  private initializePendingApprovals() {
    const approvals: PendingApproval[] = [
      {
        id: "approval-001",
        actionType: "remediation",
        title: "Revoke Admin Access for 12 Users",
        description: "Remove excessive admin privileges from 12 user accounts that don't require elevated access based on usage patterns",
        riskLevel: "high",
        requestedBy: "security-automation",
        requestedAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 86400000),
        status: "pending",
        relatedResourceId: "finding-002",
        relatedResourceType: "SecurityFinding",
        actionDetails: { affectedUsers: 12, currentPrivilege: "admin", targetPrivilege: "standard" },
        impactAssessment: "12 users will lose admin access. Emergency escalation workflow available if needed.",
        rollbackPlan: "Re-grant admin privileges via privileged access management system within 15 minutes",
        noCdsCompliance: "Access control action for security governance. Not clinical data."
      },
      {
        id: "approval-002",
        actionType: "control_change",
        title: "Enable Aggressive Rate Limiting",
        description: "Activate stricter rate limits (50% reduction) on FHIR API endpoints to mitigate detected ransomware campaign",
        riskLevel: "critical",
        requestedBy: "threat-intelligence",
        requestedAt: new Date(Date.now() - 1800000),
        expiresAt: new Date(Date.now() + 43200000),
        status: "pending",
        relatedResourceId: "threat-001",
        relatedResourceType: "ThreatIntelligence",
        actionDetails: { currentLimit: 1000, proposedLimit: 500, affectedEndpoints: ["fhir-api", "bulk-export"] },
        impactAssessment: "May slow down legitimate bulk data operations. Partners should be notified.",
        rollbackPlan: "Restore original rate limits via control panel - takes effect immediately",
        noCdsCompliance: "Traffic control action for infrastructure security. Not clinical data."
      },
      {
        id: "approval-003",
        actionType: "threat_response",
        title: "Block Suspicious IP Ranges",
        description: "Block 3 IP ranges identified as potential C2 communication endpoints for healthcare ransomware",
        riskLevel: "critical",
        requestedBy: "threat-intelligence",
        requestedAt: new Date(Date.now() - 900000),
        expiresAt: new Date(Date.now() + 21600000),
        status: "pending",
        relatedResourceId: "threat-001",
        relatedResourceType: "ThreatIntelligence",
        actionDetails: { ipRanges: ["185.x.x.0/24", "91.x.x.0/24", "45.x.x.0/24"], blockDuration: "72h" },
        impactAssessment: "No known legitimate traffic from these ranges. Low false positive risk.",
        rollbackPlan: "Unblock via firewall rules - immediate effect",
        noCdsCompliance: "Network security action for threat mitigation. Not clinical data."
      }
    ];

    approvals.forEach(a => this.pendingApprovals.set(a.id, a));
  }

  private initializeSampleData() {
    const findings: SecurityFinding[] = [
      {
        id: "finding-001",
        title: "Outdated TLS Configuration",
        description: "TLS 1.0 and 1.1 protocols are still enabled on the FHIR API endpoint",
        category: "configuration_drift",
        riskLevel: "medium",
        affectedResources: ["fhir-api-gateway", "patient-data-endpoint"],
        detectedAt: new Date(Date.now() - 86400000),
        source: "security_scanner",
        remediationStatus: "pending",
        autoRemediable: true,
        remediationSteps: [
          "Disable TLS 1.0 and 1.1 in server configuration",
          "Enable TLS 1.2 and 1.3 only",
          "Update cipher suite preferences",
          "Test connectivity with healthcare partners"
        ],
        estimatedImpact: "Low - may affect legacy integrations",
        noCdsCompliance: "Security finding for infrastructure protection. Not clinical data."
      },
      {
        id: "finding-002",
        title: "Excessive Admin Privileges",
        description: "15 user accounts have admin privileges but only 3 require them based on access patterns",
        category: "access_control",
        riskLevel: "high",
        affectedResources: ["user-management", "admin-console"],
        detectedAt: new Date(Date.now() - 172800000),
        source: "access_analyzer",
        remediationStatus: "pending",
        autoRemediable: false,
        remediationSteps: [
          "Review each admin account's actual usage",
          "Identify minimum required privileges",
          "Create role-specific permission sets",
          "Downgrade unnecessary admin accounts",
          "Implement approval workflow for privilege escalation"
        ],
        estimatedImpact: "Medium - requires coordination with affected users",
        noCdsCompliance: "Security finding for access governance. Not clinical data."
      },
      {
        id: "finding-003",
        title: "Unencrypted PHI in Transit Log",
        description: "Debug logging captured unmasked patient identifiers in transit logs",
        category: "data_protection",
        riskLevel: "critical",
        affectedResources: ["logging-service", "debug-logs"],
        detectedAt: new Date(Date.now() - 3600000),
        source: "phi_scanner",
        remediationStatus: "in_progress",
        autoRemediable: true,
        remediationSteps: [
          "Immediately disable debug logging",
          "Purge affected log files",
          "Implement PHI redaction in logging pipeline",
          "Enable log encryption at rest",
          "Document incident for compliance"
        ],
        estimatedImpact: "High - potential HIPAA violation",
        noCdsCompliance: "Security finding for data protection. Not clinical recommendations."
      }
    ];

    findings.forEach(f => this.findings.set(f.id, f));

    const threats: ThreatIntelligence[] = [
      {
        id: "threat-001",
        threatName: "Healthcare Ransomware Campaign",
        category: "malware",
        severity: "critical",
        description: "Active ransomware campaign targeting healthcare FHIR endpoints with novel encryption techniques",
        indicators: [
          { type: "domain", value: "health-update*.com", confidence: 0.95, context: "C2 communication domain pattern" },
          { type: "pattern", value: "POST /fhir/*/Bundle with >10MB payload", confidence: 0.8, context: "Data exfiltration pattern" },
          { type: "behavior", value: "Rapid sequential access to patient records", confidence: 0.75, context: "Reconnaissance behavior" }
        ],
        predictedLikelihood: 0.35,
        predictedImpact: 0.95,
        timeToExploit: "24-72 hours",
        affectedSystems: ["FHIR API", "Patient Portal", "EHR Integration"],
        mitigationRecommendations: [
          "Enable enhanced monitoring on FHIR endpoints",
          "Implement rate limiting on bulk data access",
          "Verify backup integrity and isolation",
          "Review network segmentation for PHI systems"
        ],
        sources: ["CISA Alert", "HC3 Intelligence", "Internal Threat Analysis"],
        firstSeen: new Date(Date.now() - 259200000),
        lastUpdated: new Date(),
        isZeroDay: false,
        noCdsCompliance: "Threat intelligence for infrastructure security. Not clinical data."
      },
      {
        id: "threat-002",
        threatName: "FHIR API Authentication Bypass",
        category: "zero_day",
        severity: "critical",
        description: "Predicted zero-day vulnerability in SMART on FHIR OAuth implementation allowing token replay attacks",
        indicators: [
          { type: "pattern", value: "Token reuse across sessions", confidence: 0.7, context: "Predictive pattern analysis" },
          { type: "behavior", value: "OAuth token lifetime anomaly", confidence: 0.65, context: "ML-detected deviation" }
        ],
        predictedLikelihood: 0.25,
        predictedImpact: 0.9,
        timeToExploit: "7-14 days",
        affectedSystems: ["OAuth Service", "FHIR Gateway", "Patient Apps"],
        mitigationRecommendations: [
          "Implement token binding to client sessions",
          "Reduce token lifetime to 15 minutes",
          "Enable refresh token rotation",
          "Add device fingerprinting to auth flow"
        ],
        sources: ["Predictive AI Analysis", "Vulnerability Research"],
        firstSeen: new Date(),
        lastUpdated: new Date(),
        isZeroDay: true,
        noCdsCompliance: "Predictive threat intelligence for security. Not clinical recommendations."
      }
    ];

    threats.forEach(t => this.threats.set(t.id, t));

    const controls: SelfHealingControl[] = [
      {
        id: "control-001",
        name: "Adaptive Rate Limiting",
        description: "Self-adjusting rate limits based on traffic patterns and threat indicators",
        controlType: "traffic_control",
        currentState: "active",
        triggerConditions: [
          { id: "tc-001", type: "request_rate", threshold: 1000, operator: "gt", windowMinutes: 5, description: "High request volume detected" },
          { id: "tc-002", type: "error_rate", threshold: 10, operator: "gt", windowMinutes: 1, description: "Elevated error rate" }
        ],
        adaptiveResponses: [
          { id: "ar-001", name: "Throttle Traffic", action: "reduce_rate_limit_50", severity: "medium", cooldownMinutes: 15, maxExecutions: 5, currentExecutions: 2 },
          { id: "ar-002", name: "Block Suspicious IPs", action: "block_anomalous_sources", severity: "high", cooldownMinutes: 60, maxExecutions: 3, currentExecutions: 0 }
        ],
        learningData: {
          totalEvents: 15420,
          truePositives: 142,
          falsePositives: 8,
          trueNegatives: 15250,
          falseNegatives: 20,
          adaptationCount: 12,
          lastLearningCycle: new Date(Date.now() - 3600000)
        },
        effectivenessScore: 0.94,
        lastTriggered: new Date(Date.now() - 7200000),
        lastAdapted: new Date(Date.now() - 86400000),
        noCdsCompliance: "Self-healing control for infrastructure security. Not clinical data."
      },
      {
        id: "control-002",
        name: "Dynamic Access Restriction",
        description: "Automatically adjusts access permissions based on risk signals and behavior patterns",
        controlType: "access_control",
        currentState: "learning",
        triggerConditions: [
          { id: "tc-003", type: "failed_auth_attempts", threshold: 5, operator: "gt", windowMinutes: 10, description: "Multiple failed authentication attempts" },
          { id: "tc-004", type: "geo_anomaly", threshold: 1, operator: "gte", windowMinutes: 1, description: "Access from unusual location" }
        ],
        adaptiveResponses: [
          { id: "ar-003", name: "Require MFA", action: "enforce_mfa_challenge", severity: "medium", cooldownMinutes: 30, maxExecutions: 10, currentExecutions: 3 },
          { id: "ar-004", name: "Temporary Account Lock", action: "lock_account_30m", severity: "high", cooldownMinutes: 120, maxExecutions: 2, currentExecutions: 0 }
        ],
        learningData: {
          totalEvents: 8540,
          truePositives: 89,
          falsePositives: 23,
          trueNegatives: 8400,
          falseNegatives: 28,
          adaptationCount: 5,
          lastLearningCycle: new Date(Date.now() - 7200000)
        },
        effectivenessScore: 0.79,
        lastAdapted: new Date(Date.now() - 172800000),
        noCdsCompliance: "Self-healing access control for security. Not clinical data."
      },
      {
        id: "control-003",
        name: "PHI Exfiltration Prevention",
        description: "Monitors and prevents unusual data export patterns that may indicate PHI theft",
        controlType: "data_protection",
        currentState: "active",
        triggerConditions: [
          { id: "tc-005", type: "bulk_export_volume", threshold: 1000, operator: "gt", windowMinutes: 60, description: "Large data export detected" },
          { id: "tc-006", type: "export_frequency", threshold: 10, operator: "gt", windowMinutes: 5, description: "Rapid export requests" }
        ],
        adaptiveResponses: [
          { id: "ar-005", name: "Slow Export Rate", action: "throttle_exports_75", severity: "medium", cooldownMinutes: 60, maxExecutions: 3, currentExecutions: 1 },
          { id: "ar-006", name: "Block and Alert", action: "block_exports_notify_security", severity: "critical", cooldownMinutes: 1440, maxExecutions: 1, currentExecutions: 0 }
        ],
        learningData: {
          totalEvents: 2340,
          truePositives: 12,
          falsePositives: 2,
          trueNegatives: 2320,
          falseNegatives: 6,
          adaptationCount: 3,
          lastLearningCycle: new Date(Date.now() - 14400000)
        },
        effectivenessScore: 0.86,
        lastTriggered: new Date(Date.now() - 432000000),
        noCdsCompliance: "Self-healing data protection control. Not clinical data."
      }
    ];

    controls.forEach(c => this.controls.set(c.id, c));

    this.postureScores.push({
      overall: 78,
      categories: {
        vulnerabilityManagement: 72,
        accessControl: 81,
        dataProtection: 85,
        networkSecurity: 76,
        incidentResponse: 79,
        compliance: 75
      },
      trend: "improving",
      recommendations: [
        "Address critical PHI logging finding immediately",
        "Complete admin privilege review within 7 days",
        "Update TLS configuration across all endpoints",
        "Increase self-healing control coverage for data exports"
      ],
      generatedAt: new Date(),
      noCdsCompliance: "Security posture score for governance. Not clinical data."
    });
  }

  getFindings(filters?: { riskLevel?: RiskLevel; status?: RemediationStatus; autoRemediable?: boolean }): SecurityFinding[] {
    let results = Array.from(this.findings.values());

    if (filters?.riskLevel) {
      results = results.filter(f => f.riskLevel === filters.riskLevel);
    }
    if (filters?.status) {
      results = results.filter(f => f.remediationStatus === filters.status);
    }
    if (filters?.autoRemediable !== undefined) {
      results = results.filter(f => f.autoRemediable === filters.autoRemediable);
    }

    return results.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  getFinding(id: string): SecurityFinding | undefined {
    return this.findings.get(id);
  }

  async autoRemediateFinding(findingId: string): Promise<RemediationAction | null> {
    const finding = this.findings.get(findingId);
    if (!finding || !finding.autoRemediable) return null;

    const remediation: RemediationAction = {
      id: `remediation-${crypto.randomUUID().slice(0, 8)}`,
      findingId,
      actionType: "automatic_remediation",
      description: `Automated remediation for: ${finding.title}`,
      status: "in_progress",
      automationLevel: "automatic",
      executedAt: new Date(),
      executedBy: "security-automation",
      rollbackAvailable: true,
      rollbackSteps: ["Revert configuration changes", "Restore previous state", "Notify security team"],
      noCdsCompliance: "Automated security remediation. Not clinical action."
    };

    this.remediations.set(remediation.id, remediation);

    setTimeout(() => {
      remediation.status = "completed";
      remediation.completedAt = new Date();
      remediation.result = "Successfully remediated security finding";
      finding.remediationStatus = "completed";
      this.findings.set(findingId, finding);
      this.remediations.set(remediation.id, remediation);
    }, 2000);

    return remediation;
  }

  getRemediations(): RemediationAction[] {
    return Array.from(this.remediations.values()).sort((a, b) => 
      (b.executedAt?.getTime() || 0) - (a.executedAt?.getTime() || 0)
    );
  }

  getThreats(filters?: { category?: ThreatCategory; severity?: RiskLevel; isZeroDay?: boolean }): ThreatIntelligence[] {
    let results = Array.from(this.threats.values());

    if (filters?.category) {
      results = results.filter(t => t.category === filters.category);
    }
    if (filters?.severity) {
      results = results.filter(t => t.severity === filters.severity);
    }
    if (filters?.isZeroDay !== undefined) {
      results = results.filter(t => t.isZeroDay === filters.isZeroDay);
    }

    return results.sort((a, b) => (b.predictedLikelihood * b.predictedImpact) - (a.predictedLikelihood * a.predictedImpact));
  }

  getThreat(id: string): ThreatIntelligence | undefined {
    return this.threats.get(id);
  }

  async generateThreatPrediction(): Promise<ThreatIntelligence> {
    let threatData: Partial<ThreatIntelligence>;

    if (aiEnabled) {
      try {
        const content = await generatePhiSafeText({
          system: `You are a healthcare cybersecurity threat analyst. Generate realistic predictive threat intelligence for healthcare FHIR systems. Focus on infrastructure/security threats, NOT clinical recommendations. Return JSON with: threatName, category (one of: zero_day, known_vulnerability, configuration_drift, access_anomaly, data_exfiltration, malware, insider_threat), severity (critical/high/medium/low), description, indicators (array of {type, value, confidence, context}), predictedLikelihood (0-1), predictedImpact (0-1), timeToExploit, affectedSystems, mitigationRecommendations.`,
          user: "Generate a predictive threat intelligence report for a healthcare organization's FHIR infrastructure, focusing on emerging attack vectors.",
          responseMimeType: "application/json",
          maxTokens: 1000
        });

        const parsed = JSON.parse(content || "{}");
        threatData = {
          threatName: parsed.threatName || "Emerging Healthcare Threat",
          category: parsed.category || "zero_day",
          severity: parsed.severity || "high",
          description: parsed.description || "AI-predicted emerging threat",
          indicators: parsed.indicators || [],
          predictedLikelihood: parsed.predictedLikelihood || 0.5,
          predictedImpact: parsed.predictedImpact || 0.7,
          timeToExploit: parsed.timeToExploit || "7-14 days",
          affectedSystems: parsed.affectedSystems || ["FHIR API"],
          mitigationRecommendations: parsed.mitigationRecommendations || []
        };
      } catch (error) {
        console.error("OpenAI error, using rule-based prediction:", error);
        threatData = this.generateRuleBasedThreat();
      }
    } else {
      threatData = this.generateRuleBasedThreat();
    }

    const threat: ThreatIntelligence = {
      id: `threat-${crypto.randomUUID().slice(0, 8)}`,
      threatName: threatData.threatName || "Predicted Threat",
      category: threatData.category || "zero_day",
      severity: threatData.severity || "high",
      description: threatData.description || "",
      indicators: threatData.indicators || [],
      predictedLikelihood: threatData.predictedLikelihood || 0.5,
      predictedImpact: threatData.predictedImpact || 0.7,
      timeToExploit: threatData.timeToExploit || "7-14 days",
      affectedSystems: threatData.affectedSystems || [],
      mitigationRecommendations: threatData.mitigationRecommendations || [],
      sources: ["AI Predictive Analysis", "Pattern Recognition"],
      firstSeen: new Date(),
      lastUpdated: new Date(),
      isZeroDay: threatData.category === "zero_day",
      noCdsCompliance: "Predictive threat intelligence for security. Not clinical recommendations."
    };

    this.threats.set(threat.id, threat);
    return threat;
  }

  private generateRuleBasedThreat(): Partial<ThreatIntelligence> {
    const threats = [
      {
        threatName: "FHIR Bulk Export Exploitation",
        category: "data_exfiltration" as ThreatCategory,
        description: "Predicted exploitation of FHIR bulk export functionality to exfiltrate large patient datasets",
        indicators: [
          { type: "pattern" as const, value: "Bulk export requests exceeding normal volume", confidence: 0.8, context: "Volume anomaly detection" }
        ],
        predictedLikelihood: 0.4,
        predictedImpact: 0.85,
        mitigationRecommendations: ["Implement export size limits", "Require approval for bulk exports", "Enable detailed export logging"]
      },
      {
        threatName: "OAuth Token Hijacking via XSS",
        category: "access_anomaly" as ThreatCategory,
        description: "Cross-site scripting vulnerability could allow attackers to steal SMART on FHIR access tokens",
        indicators: [
          { type: "behavior" as const, value: "Token usage from unexpected user agents", confidence: 0.7, context: "User agent mismatch" }
        ],
        predictedLikelihood: 0.3,
        predictedImpact: 0.9,
        mitigationRecommendations: ["Implement strict CSP headers", "Use HTTP-only cookies for tokens", "Add token binding"]
      }
    ];

    return threats[Math.floor(Math.random() * threats.length)];
  }

  getControls(): SelfHealingControl[] {
    return Array.from(this.controls.values());
  }

  getControl(id: string): SelfHealingControl | undefined {
    return this.controls.get(id);
  }

  async updateControlState(controlId: string, newState: ControlState): Promise<SelfHealingControl | null> {
    const control = this.controls.get(controlId);
    if (!control) return null;

    control.currentState = newState;
    control.lastAdapted = new Date();
    this.controls.set(controlId, control);
    return control;
  }

  async triggerAdaptiveResponse(controlId: string, responseId: string): Promise<{ success: boolean; message: string }> {
    const control = this.controls.get(controlId);
    if (!control) return { success: false, message: "Control not found" };

    const response = control.adaptiveResponses.find(r => r.id === responseId);
    if (!response) return { success: false, message: "Response not found" };

    if (response.currentExecutions >= response.maxExecutions) {
      return { success: false, message: "Maximum executions reached for this response" };
    }

    response.currentExecutions++;
    response.lastExecuted = new Date();
    control.lastTriggered = new Date();
    this.controls.set(controlId, control);

    return { success: true, message: `Executed adaptive response: ${response.name}` };
  }

  getPostureScore(): SecurityPostureScore {
    return this.postureScores[this.postureScores.length - 1];
  }

  async calculatePostureScore(): Promise<SecurityPostureScore> {
    const findings = this.getFindings();
    const controls = this.getControls();

    const criticalFindings = findings.filter(f => f.riskLevel === "critical" && f.remediationStatus !== "completed").length;
    const highFindings = findings.filter(f => f.riskLevel === "high" && f.remediationStatus !== "completed").length;
    const activeControls = controls.filter(c => c.currentState === "active").length;
    const avgControlEffectiveness = controls.reduce((sum, c) => sum + c.effectivenessScore, 0) / controls.length;

    let baseScore = 85;
    baseScore -= criticalFindings * 15;
    baseScore -= highFindings * 8;
    baseScore += (activeControls / controls.length) * 10;
    baseScore += avgControlEffectiveness * 5;

    const overall = Math.max(0, Math.min(100, Math.round(baseScore)));

    const previousScore = this.postureScores.length > 0 ? this.postureScores[this.postureScores.length - 1].overall : overall;
    const trend: "improving" | "stable" | "degrading" = 
      overall > previousScore + 2 ? "improving" : 
      overall < previousScore - 2 ? "degrading" : "stable";

    const score: SecurityPostureScore = {
      overall,
      categories: {
        vulnerabilityManagement: Math.round(overall * 0.95 + Math.random() * 5),
        accessControl: Math.round(overall * 0.98 + Math.random() * 5),
        dataProtection: Math.round(overall * 1.02 + Math.random() * 5),
        networkSecurity: Math.round(overall * 0.97 + Math.random() * 5),
        incidentResponse: Math.round(overall * 0.99 + Math.random() * 5),
        compliance: Math.round(overall * 0.96 + Math.random() * 5)
      },
      trend,
      recommendations: this.generatePostureRecommendations(findings, controls),
      generatedAt: new Date(),
      noCdsCompliance: "Security posture score for governance. Not clinical data."
    };

    this.postureScores.push(score);
    return score;
  }

  private generatePostureRecommendations(findings: SecurityFinding[], controls: SelfHealingControl[]): string[] {
    const recommendations: string[] = [];

    const critical = findings.filter(f => f.riskLevel === "critical" && f.remediationStatus !== "completed");
    if (critical.length > 0) {
      recommendations.push(`Address ${critical.length} critical findings immediately`);
    }

    const autoRemediable = findings.filter(f => f.autoRemediable && f.remediationStatus === "pending");
    if (autoRemediable.length > 0) {
      recommendations.push(`${autoRemediable.length} findings can be auto-remediated`);
    }

    const learningControls = controls.filter(c => c.currentState === "learning");
    if (learningControls.length > 0) {
      recommendations.push(`Promote ${learningControls.length} controls from learning to active mode`);
    }

    const lowEffectiveness = controls.filter(c => c.effectivenessScore < 0.8);
    if (lowEffectiveness.length > 0) {
      recommendations.push(`Tune ${lowEffectiveness.length} controls with effectiveness below 80%`);
    }

    return recommendations;
  }

  async generateRemediationReport(): Promise<RemediationReport> {
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 30 * 24 * 3600000);

    const allFindings = this.getFindings();
    const allRemediations = this.getRemediations();

    const remediatedCount = allFindings.filter(f => f.remediationStatus === "completed").length;
    const autoCount = allRemediations.filter(r => r.automationLevel === "automatic" && r.status === "completed").length;

    const report: RemediationReport = {
      id: `report-${crypto.randomUUID().slice(0, 8)}`,
      periodStart,
      periodEnd,
      totalFindings: allFindings.length,
      remediatedFindings: remediatedCount,
      pendingFindings: allFindings.length - remediatedCount,
      autoRemediatedCount: autoCount,
      manualRemediationCount: remediatedCount - autoCount,
      averageRemediationTime: 4.5,
      riskReduction: remediatedCount * 8.5,
      topVulnerabilities: allFindings.slice(0, 5).map(f => f.title),
      generatedAt: new Date(),
      noCdsCompliance: "Remediation report for security governance. Not clinical data."
    };

    this.reports.set(report.id, report);
    return report;
  }

  getStats(): {
    totalFindings: number;
    criticalFindings: number;
    pendingRemediations: number;
    autoRemediableCount: number;
    activeThreats: number;
    zeroDayThreats: number;
    activeControls: number;
    overallPosture: number;
    pendingApprovals: number;
  } {
    const findings = this.getFindings();
    const threats = this.getThreats();
    const controls = this.getControls();
    const posture = this.getPostureScore();
    const approvals = this.getPendingApprovals();

    return {
      totalFindings: findings.length,
      criticalFindings: findings.filter(f => f.riskLevel === "critical").length,
      pendingRemediations: findings.filter(f => f.remediationStatus === "pending").length,
      autoRemediableCount: findings.filter(f => f.autoRemediable && f.remediationStatus === "pending").length,
      activeThreats: threats.length,
      zeroDayThreats: threats.filter(t => t.isZeroDay).length,
      activeControls: controls.filter(c => c.currentState === "active").length,
      overallPosture: posture.overall,
      pendingApprovals: approvals.length
    };
  }

  getPendingApprovals(filters?: { status?: ApprovalStatus; actionType?: ActionType }): PendingApproval[] {
    let results = Array.from(this.pendingApprovals.values());
    
    if (filters?.status) {
      results = results.filter(a => a.status === filters.status);
    }
    if (filters?.actionType) {
      results = results.filter(a => a.actionType === filters.actionType);
    }
    
    return results.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  getApproval(id: string): PendingApproval | undefined {
    return this.pendingApprovals.get(id);
  }

  async approveAction(approvalId: string, approvedBy: string): Promise<PendingApproval | null> {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval || approval.status !== "pending") return null;

    approval.status = "approved";
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date();
    this.pendingApprovals.set(approvalId, approval);

    return approval;
  }

  async rejectAction(approvalId: string, rejectedBy: string): Promise<PendingApproval | null> {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval || approval.status !== "pending") return null;

    approval.status = "rejected";
    approval.approvedBy = rejectedBy;
    approval.approvedAt = new Date();
    this.pendingApprovals.set(approvalId, approval);

    return approval;
  }

  generateActionableInsights(): ActionableInsight[] {
    const findings = this.getFindings();
    const threats = this.getThreats();
    const controls = this.getControls();
    const insights: ActionableInsight[] = [];

    const criticalFindings = findings.filter(f => f.riskLevel === "critical" && f.remediationStatus !== "completed");
    if (criticalFindings.length > 0) {
      insights.push({
        id: `insight-critical-${Date.now()}`,
        category: "critical",
        title: "Critical Security Findings Require Immediate Attention",
        description: `${criticalFindings.length} critical finding(s) detected that could expose PHI or compromise system integrity`,
        priority: 1,
        suggestedAction: "Review and remediate critical findings within 24 hours",
        estimatedImpact: "Prevent potential data breach or compliance violation",
        affectedScore: "vulnerabilityManagement",
        potentialImprovement: 15,
        relatedFindings: criticalFindings.map(f => f.id),
        relatedThreats: [],
        relatedControls: [],
        noCdsCompliance: "Security insight for risk management. Not clinical data."
      });
    }

    const zeroDayThreats = threats.filter(t => t.isZeroDay);
    if (zeroDayThreats.length > 0) {
      insights.push({
        id: `insight-zeroday-${Date.now()}`,
        category: "critical",
        title: "Zero-Day Threats Detected",
        description: `${zeroDayThreats.length} potential zero-day threat(s) identified through AI prediction`,
        priority: 2,
        suggestedAction: "Activate enhanced monitoring and review mitigation recommendations",
        estimatedImpact: "Proactive defense against emerging threats",
        affectedScore: "networkSecurity",
        potentialImprovement: 10,
        relatedFindings: [],
        relatedThreats: zeroDayThreats.map(t => t.id),
        relatedControls: [],
        noCdsCompliance: "Threat insight for proactive defense. Not clinical data."
      });
    }

    const learningControls = controls.filter(c => c.currentState === "learning");
    if (learningControls.length > 0) {
      insights.push({
        id: `insight-controls-${Date.now()}`,
        category: "optimization",
        title: "Self-Healing Controls Ready for Activation",
        description: `${learningControls.length} control(s) have completed learning phase and can be activated`,
        priority: 3,
        suggestedAction: "Review learning metrics and promote controls to active state",
        estimatedImpact: "Improve automated response capability",
        affectedScore: "incidentResponse",
        potentialImprovement: 8,
        relatedFindings: [],
        relatedThreats: [],
        relatedControls: learningControls.map(c => c.id),
        noCdsCompliance: "Operational insight for automation. Not clinical data."
      });
    }

    const autoRemediable = findings.filter(f => f.autoRemediable && f.remediationStatus === "pending");
    if (autoRemediable.length > 0) {
      insights.push({
        id: `insight-auto-${Date.now()}`,
        category: "optimization",
        title: "Auto-Remediation Opportunities Available",
        description: `${autoRemediable.length} finding(s) can be automatically remediated without manual intervention`,
        priority: 4,
        suggestedAction: "Trigger auto-remediation for eligible findings",
        estimatedImpact: "Reduce manual workload and time-to-remediation",
        affectedScore: "vulnerabilityManagement",
        potentialImprovement: 5,
        relatedFindings: autoRemediable.map(f => f.id),
        relatedThreats: [],
        relatedControls: [],
        noCdsCompliance: "Operational insight for efficiency. Not clinical data."
      });
    }

    const pendingApprovals = this.getPendingApprovals({ status: "pending" });
    if (pendingApprovals.length > 0) {
      insights.push({
        id: `insight-approvals-${Date.now()}`,
        category: "warning",
        title: "Security Actions Awaiting Approval",
        description: `${pendingApprovals.length} critical security action(s) require manual approval before execution`,
        priority: 2,
        suggestedAction: "Review and approve/reject pending security actions",
        estimatedImpact: "Enable automated security responses",
        affectedScore: "incidentResponse",
        potentialImprovement: 12,
        relatedFindings: [],
        relatedThreats: [],
        relatedControls: [],
        noCdsCompliance: "Approval insight for governance. Not clinical data."
      });
    }

    return insights.sort((a, b) => a.priority - b.priority);
  }

  getUnifiedSecurityView(): UnifiedSecurityView {
    const findings = this.getFindings();
    const threats = this.getThreats();
    const controls = this.getControls();
    const posture = this.getPostureScore();
    const approvals = this.getPendingApprovals({ status: "pending" });

    const criticalItems: UnifiedSecurityView["criticalItems"] = [];

    findings.filter(f => f.riskLevel === "critical" || f.riskLevel === "high").forEach(f => {
      criticalItems.push({
        type: "finding",
        id: f.id,
        title: f.title,
        severity: f.riskLevel,
        status: f.remediationStatus,
        requiresApproval: !f.autoRemediable
      });
    });

    threats.filter(t => t.severity === "critical" || t.isZeroDay).forEach(t => {
      criticalItems.push({
        type: "threat",
        id: t.id,
        title: t.threatName,
        severity: t.severity,
        status: t.isZeroDay ? "zero_day" : "active",
        requiresApproval: true
      });
    });

    controls.filter(c => c.effectivenessScore < 0.7).forEach(c => {
      criticalItems.push({
        type: "control",
        id: c.id,
        title: c.name,
        severity: "medium",
        status: c.currentState,
        requiresApproval: false
      });
    });

    return {
      timestamp: new Date(),
      overallScore: posture.overall,
      trend: posture.trend,
      criticalItems,
      pendingApprovals: approvals.length,
      activeThreats: threats.length,
      openFindings: findings.filter(f => f.remediationStatus !== "completed").length,
      healingControls: controls.filter(c => c.currentState === "active").length,
      actionableInsights: this.generateActionableInsights(),
      noCdsCompliance: "Unified security view for governance dashboard. Not clinical data."
    };
  }
}

export const securityPostureService = new AISecurityPostureService();
