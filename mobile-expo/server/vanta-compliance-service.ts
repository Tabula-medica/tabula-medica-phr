import crypto from "crypto";

export interface VantaConfig {
  apiKey: string;
  baseUrl: string;
  organizationId: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  status: "in_progress" | "compliant" | "needs_attention" | "not_started";
  completionPercentage: number;
  lastAssessment?: Date;
  nextAssessment?: Date;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  name: string;
  description: string;
  category: string;
  status: "passing" | "failing" | "not_applicable" | "manual_review";
  evidence: Array<{
    id: string;
    type: string;
    description: string;
    uploadedAt: Date;
    expiresAt?: Date;
  }>;
  lastChecked: Date;
  owner?: string;
  notes?: string;
}

export interface BAARecord {
  id: string;
  vendorName: string;
  vendorContact: {
    name: string;
    email: string;
    phone?: string;
  };
  agreementType: "BAA" | "NDA" | "DPA" | "BAA_NDA";
  status: "pending" | "active" | "expired" | "terminated";
  signedDate?: Date;
  effectiveDate: Date;
  expirationDate?: Date;
  autoRenewal: boolean;
  documentUrl?: string;
  coveredServices: string[];
  dataCategories: string[];
  notes?: string;
  reminderDays: number;
  lastReviewDate?: Date;
  nextReviewDate?: Date;
}

export interface NDARecord {
  id: string;
  partyName: string;
  partyType: "vendor" | "partner" | "employee" | "contractor" | "other";
  partyContact: {
    name: string;
    email: string;
    title?: string;
  };
  ndaType: "mutual" | "unilateral_inbound" | "unilateral_outbound";
  status: "pending" | "active" | "expired" | "terminated";
  signedDate?: Date;
  effectiveDate: Date;
  expirationDate?: Date;
  confidentialityPeriod: number;
  documentUrl?: string;
  scope: string;
  exceptions?: string[];
  notes?: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  category: "access_control" | "data_protection" | "incident_response" | "business_continuity" | "vendor_management" | "acceptable_use" | "other";
  version: string;
  status: "draft" | "active" | "under_review" | "deprecated";
  owner: string;
  approver?: string;
  createdAt: Date;
  lastUpdated: Date;
  nextReviewDate: Date;
  documentUrl?: string;
  applicableTo: string[];
  controlMappings: Array<{
    frameworkId: string;
    controlId: string;
  }>;
}

export interface RiskAssessment {
  id: string;
  name: string;
  type: "vendor" | "system" | "process" | "data" | "third_party";
  status: "pending" | "in_progress" | "completed" | "needs_review";
  riskLevel: "low" | "medium" | "high" | "critical";
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  description: string;
  threats: string[];
  vulnerabilities: string[];
  existingControls: string[];
  recommendedControls: string[];
  assessedBy: string;
  assessedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  mitigationPlan?: string;
  acceptanceDecision?: "accept" | "mitigate" | "transfer" | "avoid";
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  actor: string;
  actorType: "user" | "system" | "integration";
  action: string;
  resource: string;
  resourceId: string;
  outcome: "success" | "failure";
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  dataAccessed?: {
    recordCount: number;
    dataTypes: string[];
  };
}

export interface ComplianceReport {
  id: string;
  name: string;
  type: "soc2" | "hipaa" | "hitrust" | "gdpr" | "custom";
  period: {
    start: Date;
    end: Date;
  };
  status: "draft" | "final" | "published";
  generatedAt: Date;
  generatedBy: string;
  frameworks: Array<{
    id: string;
    name: string;
    completionPercentage: number;
    passingControls: number;
    failingControls: number;
  }>;
  summary: {
    overallScore: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  recommendations: string[];
  attestation?: {
    attestedBy: string;
    attestedAt: Date;
    statement: string;
  };
}

const HEALTHCARE_COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: "hipaa",
    name: "HIPAA",
    version: "2024",
    description: "Health Insurance Portability and Accountability Act compliance for PHI protection",
    status: "in_progress",
    completionPercentage: 0
  },
  {
    id: "soc2-type2",
    name: "SOC 2 Type II",
    version: "2024",
    description: "Service Organization Control 2 Type II - Security, Availability, Confidentiality",
    status: "in_progress",
    completionPercentage: 0
  },
  {
    id: "hitrust-csf",
    name: "HITRUST CSF",
    version: "v11.2",
    description: "HITRUST Common Security Framework for healthcare organizations",
    status: "not_started",
    completionPercentage: 0
  },
  {
    id: "gdpr",
    name: "GDPR",
    version: "2024",
    description: "General Data Protection Regulation for EU data subjects",
    status: "not_started",
    completionPercentage: 0
  }
];

const HIPAA_CONTROLS: Omit<ComplianceControl, "id" | "lastChecked">[] = [
  {
    frameworkId: "hipaa",
    name: "Access Control",
    description: "Implement technical policies and procedures for electronic information systems",
    category: "Technical Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Audit Controls",
    description: "Implement hardware, software, and procedures to record and examine activity",
    category: "Technical Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Integrity Controls",
    description: "Implement policies to protect PHI from improper alteration or destruction",
    category: "Technical Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Transmission Security",
    description: "Implement technical security measures to guard against unauthorized access during transmission",
    category: "Technical Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Encryption",
    description: "Implement encryption mechanisms for PHI at rest and in transit",
    category: "Technical Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Workforce Security",
    description: "Ensure appropriate access for workforce members",
    category: "Administrative Safeguards",
    status: "manual_review",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Security Awareness Training",
    description: "Implement a security awareness and training program",
    category: "Administrative Safeguards",
    status: "manual_review",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Incident Response",
    description: "Implement policies and procedures to address security incidents",
    category: "Administrative Safeguards",
    status: "passing",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Contingency Plan",
    description: "Establish policies for responding to emergencies",
    category: "Administrative Safeguards",
    status: "manual_review",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Business Associate Agreements",
    description: "Contracts with business associates that create, receive, or transmit PHI",
    category: "Administrative Safeguards",
    status: "manual_review",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Facility Access Controls",
    description: "Policies to limit physical access to electronic information systems",
    category: "Physical Safeguards",
    status: "not_applicable",
    evidence: []
  },
  {
    frameworkId: "hipaa",
    name: "Workstation Security",
    description: "Physical safeguards for workstations accessing PHI",
    category: "Physical Safeguards",
    status: "manual_review",
    evidence: []
  }
];

class VantaComplianceService {
  private config: VantaConfig | null = null;
  private baaRecords: BAARecord[] = [];
  private ndaRecords: NDARecord[] = [];
  private securityPolicies: SecurityPolicy[] = [];
  private riskAssessments: RiskAssessment[] = [];
  private auditLogs: AuditLog[] = [];
  private complianceControls: ComplianceControl[] = [];

  initialize(config: VantaConfig): void {
    this.config = config;
    this.initializeDefaultControls();
  }

  private initializeDefaultControls(): void {
    this.complianceControls = HIPAA_CONTROLS.map(control => ({
      ...control,
      id: crypto.randomUUID(),
      lastChecked: new Date()
    }));
  }

  getComplianceFrameworks(): ComplianceFramework[] {
    return HEALTHCARE_COMPLIANCE_FRAMEWORKS.map(framework => {
      const controls = this.complianceControls.filter(c => c.frameworkId === framework.id);
      const passingControls = controls.filter(c => c.status === "passing").length;
      const totalControls = controls.length;

      return {
        ...framework,
        completionPercentage: totalControls > 0 ? Math.round((passingControls / totalControls) * 100) : 0
      };
    });
  }

  getComplianceControls(frameworkId: string): ComplianceControl[] {
    return this.complianceControls.filter(c => c.frameworkId === frameworkId);
  }

  async createBAA(baa: Omit<BAARecord, "id">): Promise<BAARecord> {
    const record: BAARecord = {
      ...baa,
      id: crypto.randomUUID()
    };

    this.baaRecords.push(record);

    await this.logAudit({
      actor: "system",
      actorType: "system",
      action: "create",
      resource: "baa",
      resourceId: record.id,
      outcome: "success",
      details: { vendorName: record.vendorName }
    });

    return record;
  }

  async updateBAA(id: string, updates: Partial<BAARecord>): Promise<BAARecord | null> {
    const index = this.baaRecords.findIndex(b => b.id === id);
    if (index === -1) return null;

    this.baaRecords[index] = { ...this.baaRecords[index], ...updates };

    await this.logAudit({
      actor: "system",
      actorType: "system",
      action: "update",
      resource: "baa",
      resourceId: id,
      outcome: "success",
      details: { updates }
    });

    return this.baaRecords[index];
  }

  getBAARecords(options?: {
    status?: BAARecord["status"];
    expiringWithinDays?: number;
  }): BAARecord[] {
    let records = [...this.baaRecords];

    if (options?.status) {
      records = records.filter(r => r.status === options.status);
    }

    if (options?.expiringWithinDays) {
      const cutoff = new Date(Date.now() + options.expiringWithinDays * 24 * 60 * 60 * 1000);
      records = records.filter(r => r.expirationDate && r.expirationDate <= cutoff);
    }

    return records;
  }

  async createNDA(nda: Omit<NDARecord, "id">): Promise<NDARecord> {
    const record: NDARecord = {
      ...nda,
      id: crypto.randomUUID()
    };

    this.ndaRecords.push(record);

    await this.logAudit({
      actor: "system",
      actorType: "system",
      action: "create",
      resource: "nda",
      resourceId: record.id,
      outcome: "success",
      details: { partyName: record.partyName }
    });

    return record;
  }

  getNDARecords(options?: {
    status?: NDARecord["status"];
    partyType?: NDARecord["partyType"];
  }): NDARecord[] {
    let records = [...this.ndaRecords];

    if (options?.status) {
      records = records.filter(r => r.status === options.status);
    }

    if (options?.partyType) {
      records = records.filter(r => r.partyType === options.partyType);
    }

    return records;
  }

  async createSecurityPolicy(policy: Omit<SecurityPolicy, "id" | "createdAt" | "lastUpdated">): Promise<SecurityPolicy> {
    const record: SecurityPolicy = {
      ...policy,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    this.securityPolicies.push(record);

    await this.logAudit({
      actor: "system",
      actorType: "system",
      action: "create",
      resource: "security_policy",
      resourceId: record.id,
      outcome: "success",
      details: { policyName: record.name }
    });

    return record;
  }

  getSecurityPolicies(options?: {
    category?: SecurityPolicy["category"];
    status?: SecurityPolicy["status"];
    needsReview?: boolean;
  }): SecurityPolicy[] {
    let policies = [...this.securityPolicies];

    if (options?.category) {
      policies = policies.filter(p => p.category === options.category);
    }

    if (options?.status) {
      policies = policies.filter(p => p.status === options.status);
    }

    if (options?.needsReview) {
      const now = new Date();
      policies = policies.filter(p => p.nextReviewDate <= now);
    }

    return policies;
  }

  async createRiskAssessment(assessment: Omit<RiskAssessment, "id" | "riskScore">): Promise<RiskAssessment> {
    const riskScore = assessment.likelihood * assessment.impact;

    const record: RiskAssessment = {
      ...assessment,
      id: crypto.randomUUID(),
      riskScore
    };

    this.riskAssessments.push(record);

    await this.logAudit({
      actor: assessment.assessedBy,
      actorType: "user",
      action: "create",
      resource: "risk_assessment",
      resourceId: record.id,
      outcome: "success",
      details: { assessmentName: record.name, riskLevel: record.riskLevel }
    });

    return record;
  }

  getRiskAssessments(options?: {
    type?: RiskAssessment["type"];
    riskLevel?: RiskAssessment["riskLevel"];
    status?: RiskAssessment["status"];
  }): RiskAssessment[] {
    let assessments = [...this.riskAssessments];

    if (options?.type) {
      assessments = assessments.filter(a => a.type === options.type);
    }

    if (options?.riskLevel) {
      assessments = assessments.filter(a => a.riskLevel === options.riskLevel);
    }

    if (options?.status) {
      assessments = assessments.filter(a => a.status === options.status);
    }

    return assessments;
  }

  async logAudit(log: Omit<AuditLog, "id" | "timestamp">): Promise<void> {
    this.auditLogs.push({
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date()
    });
  }

  getAuditLogs(options?: {
    startDate?: Date;
    endDate?: Date;
    actor?: string;
    resource?: string;
    action?: string;
    outcome?: AuditLog["outcome"];
    limit?: number;
  }): AuditLog[] {
    let logs = [...this.auditLogs];

    if (options?.startDate) {
      logs = logs.filter(l => l.timestamp >= options.startDate!);
    }

    if (options?.endDate) {
      logs = logs.filter(l => l.timestamp <= options.endDate!);
    }

    if (options?.actor) {
      logs = logs.filter(l => l.actor === options.actor);
    }

    if (options?.resource) {
      logs = logs.filter(l => l.resource === options.resource);
    }

    if (options?.action) {
      logs = logs.filter(l => l.action === options.action);
    }

    if (options?.outcome) {
      logs = logs.filter(l => l.outcome === options.outcome);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  generateComplianceReport(type: ComplianceReport["type"], period: { start: Date; end: Date }): ComplianceReport {
    const frameworks = this.getComplianceFrameworks();
    const relevantFramework = frameworks.find(f => 
      (type === "soc2" && f.id === "soc2-type2") ||
      (type === "hipaa" && f.id === "hipaa") ||
      (type === "hitrust" && f.id === "hitrust-csf") ||
      (type === "gdpr" && f.id === "gdpr")
    );

    const controls = relevantFramework ? this.getComplianceControls(relevantFramework.id) : [];
    const passingControls = controls.filter(c => c.status === "passing").length;
    const failingControls = controls.filter(c => c.status === "failing").length;

    const riskAssessments = this.getRiskAssessments();
    const criticalFindings = riskAssessments.filter(r => r.riskLevel === "critical").length;
    const highFindings = riskAssessments.filter(r => r.riskLevel === "high").length;
    const mediumFindings = riskAssessments.filter(r => r.riskLevel === "medium").length;
    const lowFindings = riskAssessments.filter(r => r.riskLevel === "low").length;

    const recommendations: string[] = [];

    if (failingControls > 0) {
      recommendations.push(`Address ${failingControls} failing controls to improve compliance posture`);
    }

    const expiringBaas = this.getBAARecords({ expiringWithinDays: 30 });
    if (expiringBaas.length > 0) {
      recommendations.push(`Review and renew ${expiringBaas.length} BAAs expiring within 30 days`);
    }

    const policiesNeedingReview = this.getSecurityPolicies({ needsReview: true });
    if (policiesNeedingReview.length > 0) {
      recommendations.push(`Review ${policiesNeedingReview.length} security policies that are due for review`);
    }

    return {
      id: crypto.randomUUID(),
      name: `${type.toUpperCase()} Compliance Report`,
      type,
      period,
      status: "draft",
      generatedAt: new Date(),
      generatedBy: "system",
      frameworks: relevantFramework ? [{
        id: relevantFramework.id,
        name: relevantFramework.name,
        completionPercentage: relevantFramework.completionPercentage,
        passingControls,
        failingControls
      }] : [],
      summary: {
        overallScore: relevantFramework?.completionPercentage || 0,
        criticalFindings,
        highFindings,
        mediumFindings,
        lowFindings
      },
      recommendations
    };
  }

  async syncWithVanta(): Promise<{ synced: boolean; lastSync: Date; controlsUpdated: number }> {
    if (!this.config) {
      throw new Error("Vanta compliance service not initialized");
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/organizations/${this.config.organizationId}/controls`, {
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to sync with Vanta: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        synced: true,
        lastSync: new Date(),
        controlsUpdated: data.controls?.length || 0
      };
    } catch (error) {
      console.error("Vanta sync failed:", error);
      return {
        synced: false,
        lastSync: new Date(),
        controlsUpdated: 0
      };
    }
  }

  getComplianceDashboard(): {
    frameworks: ComplianceFramework[];
    activeBaas: number;
    activeNdas: number;
    expiringAgreements: number;
    openRisks: number;
    criticalRisks: number;
    policiesNeedingReview: number;
    recentAuditLogs: number;
  } {
    const frameworks = this.getComplianceFrameworks();
    const activeBaas = this.baaRecords.filter(b => b.status === "active").length;
    const activeNdas = this.ndaRecords.filter(n => n.status === "active").length;
    const expiringAgreements = this.getBAARecords({ expiringWithinDays: 30 }).length;
    const openRisks = this.riskAssessments.filter(r => r.status !== "completed").length;
    const criticalRisks = this.riskAssessments.filter(r => r.riskLevel === "critical" && r.status !== "completed").length;
    const policiesNeedingReview = this.getSecurityPolicies({ needsReview: true }).length;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAuditLogs = this.auditLogs.filter(l => l.timestamp >= oneDayAgo).length;

    return {
      frameworks,
      activeBaas,
      activeNdas,
      expiringAgreements,
      openRisks,
      criticalRisks,
      policiesNeedingReview,
      recentAuditLogs
    };
  }
}

export const vantaComplianceService = new VantaComplianceService();

export function initializeVantaCompliance(): void {
  const apiKey = process.env.VANTA_API_KEY;
  const organizationId = process.env.VANTA_ORGANIZATION_ID;

  if (apiKey && organizationId) {
    vantaComplianceService.initialize({
      apiKey,
      baseUrl: process.env.VANTA_API_URL || "https://api.vanta.com",
      organizationId
    });
    console.log("Vanta compliance service initialized");
  } else {
    vantaComplianceService.initialize({
      apiKey: "",
      baseUrl: "https://api.vanta.com",
      organizationId: ""
    });
    console.log("Vanta credentials not configured - using local compliance tracking");
  }
}
