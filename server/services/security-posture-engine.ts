import { randomUUID } from "crypto";

export type CloudProvider = "aws" | "azure" | "gcp" | "on_premise";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "informational";
export type FindingStatus = "open" | "investigating" | "resolved" | "suppressed" | "false_positive";
export type ComplianceFramework = "HIPAA" | "SOC2" | "PCI_DSS" | "GDPR" | "NIST" | "CIS";
export type DataClassification = "PHI" | "PII" | "PCI" | "confidential" | "internal" | "public";

export interface SecurityFinding {
  id: string;
  provider: CloudProvider;
  sourceService: string;
  findingType: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  resourceType: string;
  resourceId: string;
  resourceRegion: string;
  affectedDataTypes: DataClassification[];
  complianceFrameworks: ComplianceFramework[];
  firstObserved: string;
  lastUpdated: string;
  remediation?: RemediationSuggestion;
  riskScore: number;
  exploitability: "active" | "proof_of_concept" | "theoretical" | "unknown";
  rawFinding?: Record<string, unknown>;
}

export interface RemediationSuggestion {
  id: string;
  title: string;
  description: string;
  automatable: boolean;
  estimatedEffort: "minutes" | "hours" | "days";
  steps: string[];
  configChanges?: ConfigChange[];
  riskReduction: number;
}

export interface ConfigChange {
  resourceType: string;
  resourceId: string;
  property: string;
  currentValue: string;
  recommendedValue: string;
  provider: CloudProvider;
}

export interface CloudEnvironment {
  id: string;
  name: string;
  provider: CloudProvider;
  accountId: string;
  region: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  complianceScore: number;
}

export interface SecurityPosture {
  overallScore: number;
  trend: "improving" | "stable" | "declining";
  lastAssessment: string;
  environments: CloudEnvironment[];
  topRisks: SecurityFinding[];
  complianceStatus: Record<ComplianceFramework, { score: number; findings: number }>;
  dataAtRisk: {
    classification: DataClassification;
    resourceCount: number;
    findingsCount: number;
  }[];
}

export interface PostureAlert {
  id: string;
  type: "new_critical" | "compliance_drift" | "posture_decline" | "anomaly";
  severity: FindingSeverity;
  title: string;
  description: string;
  triggeredAt: string;
  acknowledged: boolean;
  relatedFindings: string[];
}

const SAMPLE_FINDINGS: Omit<SecurityFinding, "id" | "firstObserved" | "lastUpdated">[] = [
  {
    provider: "aws",
    sourceService: "Security Hub",
    findingType: "Software and Configuration Checks",
    title: "S3 bucket with PHI data has public access enabled",
    description: "An S3 bucket containing patient health information has public access configured, potentially exposing sensitive PHI data.",
    severity: "critical",
    status: "open",
    resourceType: "AWS::S3::Bucket",
    resourceId: "arn:aws:s3:::patient-records-prod",
    resourceRegion: "us-east-1",
    affectedDataTypes: ["PHI", "PII"],
    complianceFrameworks: ["HIPAA", "SOC2"],
    riskScore: 95,
    exploitability: "active",
  },
  {
    provider: "aws",
    sourceService: "Security Hub",
    findingType: "Network Security",
    title: "RDS instance allows unrestricted inbound access",
    description: "Database instance containing patient records has security group allowing access from 0.0.0.0/0",
    severity: "critical",
    status: "open",
    resourceType: "AWS::RDS::DBInstance",
    resourceId: "arn:aws:rds:us-east-1:123456789:db:fhir-production",
    resourceRegion: "us-east-1",
    affectedDataTypes: ["PHI", "PII"],
    complianceFrameworks: ["HIPAA", "PCI_DSS"],
    riskScore: 92,
    exploitability: "active",
  },
  {
    provider: "azure",
    sourceService: "Security Center",
    findingType: "Identity and Access",
    title: "Storage account with patient data lacks encryption at rest",
    description: "Azure Storage Account containing FHIR resources does not have encryption enabled for data at rest.",
    severity: "high",
    status: "investigating",
    resourceType: "Microsoft.Storage/storageAccounts",
    resourceId: "/subscriptions/xxx/resourceGroups/healthcare/providers/Microsoft.Storage/storageAccounts/fhirdata",
    resourceRegion: "eastus",
    affectedDataTypes: ["PHI"],
    complianceFrameworks: ["HIPAA", "GDPR"],
    riskScore: 78,
    exploitability: "theoretical",
  },
  {
    provider: "gcp",
    sourceService: "Security Command Center",
    findingType: "IAM",
    title: "Service account has overly permissive BigQuery access",
    description: "Service account used by analytics pipeline has dataset-wide access instead of table-level permissions.",
    severity: "high",
    status: "open",
    resourceType: "bigquery.googleapis.com/Dataset",
    resourceId: "projects/healthcare-prod/datasets/patient_analytics",
    resourceRegion: "us-central1",
    affectedDataTypes: ["PHI", "PII"],
    complianceFrameworks: ["HIPAA", "SOC2"],
    riskScore: 72,
    exploitability: "theoretical",
  },
  {
    provider: "aws",
    sourceService: "GuardDuty",
    findingType: "Threat Detection",
    title: "Unusual API activity from healthcare admin role",
    description: "Anomalous number of DescribeInstances and ListBuckets calls detected from admin role during off-hours.",
    severity: "medium",
    status: "investigating",
    resourceType: "AWS::IAM::Role",
    resourceId: "arn:aws:iam::123456789:role/HealthcareAdmin",
    resourceRegion: "global",
    affectedDataTypes: ["confidential"],
    complianceFrameworks: ["SOC2", "NIST"],
    riskScore: 58,
    exploitability: "unknown",
  },
  {
    provider: "azure",
    sourceService: "Security Center",
    findingType: "Network Security",
    title: "Network security group allows SSH from any source",
    description: "NSG attached to healthcare VMs allows inbound SSH (port 22) from any IP address.",
    severity: "medium",
    status: "open",
    resourceType: "Microsoft.Network/networkSecurityGroups",
    resourceId: "/subscriptions/xxx/resourceGroups/healthcare/providers/Microsoft.Network/networkSecurityGroups/vm-nsg",
    resourceRegion: "eastus",
    affectedDataTypes: ["internal"],
    complianceFrameworks: ["CIS", "NIST"],
    riskScore: 55,
    exploitability: "proof_of_concept",
  },
  {
    provider: "aws",
    sourceService: "Config",
    findingType: "Compliance",
    title: "CloudTrail logging not enabled for data events",
    description: "CloudTrail is not configured to log S3 data events for buckets containing PHI.",
    severity: "medium",
    status: "open",
    resourceType: "AWS::CloudTrail::Trail",
    resourceId: "arn:aws:cloudtrail:us-east-1:123456789:trail/main-trail",
    resourceRegion: "us-east-1",
    affectedDataTypes: ["PHI"],
    complianceFrameworks: ["HIPAA", "SOC2"],
    riskScore: 52,
    exploitability: "theoretical",
  },
  {
    provider: "gcp",
    sourceService: "Security Command Center",
    findingType: "Vulnerability",
    title: "GKE cluster running outdated Kubernetes version",
    description: "Healthcare application cluster is running Kubernetes 1.24 which has known CVEs.",
    severity: "low",
    status: "open",
    resourceType: "container.googleapis.com/Cluster",
    resourceId: "projects/healthcare-prod/locations/us-central1/clusters/fhir-cluster",
    resourceRegion: "us-central1",
    affectedDataTypes: ["internal"],
    complianceFrameworks: ["CIS"],
    riskScore: 35,
    exploitability: "proof_of_concept",
  },
];

class SecurityPostureEngine {
  private findings: Map<string, SecurityFinding> = new Map();
  private environments: Map<string, CloudEnvironment> = new Map();
  private alerts: Map<string, PostureAlert> = new Map();
  private remediationHistory: Map<string, { appliedAt: string; by: string; findingId: string }> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[SecurityPostureEngine] Initialized with", this.findings.size, "findings across", this.environments.size, "environments");
  }

  private initializeSampleData(): void {
    const environments: CloudEnvironment[] = [
      {
        id: randomUUID(),
        name: "AWS Production",
        provider: "aws",
        accountId: "123456789012",
        region: "us-east-1",
        status: "connected",
        lastSync: new Date().toISOString(),
        findingsCount: { critical: 2, high: 1, medium: 2, low: 0 },
        complianceScore: 72,
      },
      {
        id: randomUUID(),
        name: "Azure Healthcare",
        provider: "azure",
        accountId: "subscription-xxx",
        region: "eastus",
        status: "connected",
        lastSync: new Date().toISOString(),
        findingsCount: { critical: 0, high: 1, medium: 1, low: 0 },
        complianceScore: 85,
      },
      {
        id: randomUUID(),
        name: "GCP Analytics",
        provider: "gcp",
        accountId: "healthcare-prod",
        region: "us-central1",
        status: "connected",
        lastSync: new Date().toISOString(),
        findingsCount: { critical: 0, high: 1, medium: 0, low: 1 },
        complianceScore: 88,
      },
    ];

    environments.forEach(env => this.environments.set(env.id, env));

    SAMPLE_FINDINGS.forEach(finding => {
      const id = randomUUID();
      const now = new Date();
      const daysAgo = Math.floor(Math.random() * 30);
      
      this.findings.set(id, {
        ...finding,
        id,
        firstObserved: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdated: new Date().toISOString(),
        remediation: this.generateRemediation(finding),
      });
    });

    this.alerts.set(randomUUID(), {
      id: randomUUID(),
      type: "new_critical",
      severity: "critical",
      title: "New Critical Finding Detected",
      description: "S3 bucket with PHI data has public access enabled - requires immediate attention",
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      relatedFindings: [Array.from(this.findings.keys())[0]],
    });
  }

  private generateRemediation(finding: Omit<SecurityFinding, "id" | "firstObserved" | "lastUpdated">): RemediationSuggestion {
    const remediations: Record<string, RemediationSuggestion> = {
      "S3 bucket with PHI data has public access enabled": {
        id: randomUUID(),
        title: "Disable S3 Public Access",
        description: "Remove public access configuration and enable S3 Block Public Access settings",
        automatable: true,
        estimatedEffort: "minutes",
        steps: [
          "Navigate to S3 bucket settings in AWS Console",
          "Select 'Permissions' tab",
          "Enable 'Block all public access'",
          "Remove any bucket policies allowing public access",
          "Verify access is restricted using AWS Access Analyzer",
        ],
        configChanges: [{
          resourceType: "AWS::S3::Bucket",
          resourceId: finding.resourceId,
          property: "PublicAccessBlockConfiguration.BlockPublicAcls",
          currentValue: "false",
          recommendedValue: "true",
          provider: "aws",
        }],
        riskReduction: 40,
      },
      "RDS instance allows unrestricted inbound access": {
        id: randomUUID(),
        title: "Restrict RDS Security Group",
        description: "Limit database access to specific IP ranges or VPC endpoints",
        automatable: true,
        estimatedEffort: "minutes",
        steps: [
          "Identify legitimate source IPs/CIDR ranges",
          "Modify security group inbound rules",
          "Remove 0.0.0.0/0 rule",
          "Add specific CIDR ranges for application servers",
          "Test database connectivity from allowed sources",
        ],
        configChanges: [{
          resourceType: "AWS::EC2::SecurityGroup",
          resourceId: "sg-healthcare-rds",
          property: "IpPermissions.CidrIp",
          currentValue: "0.0.0.0/0",
          recommendedValue: "10.0.0.0/16",
          provider: "aws",
        }],
        riskReduction: 45,
      },
    };

    return remediations[finding.title] || {
      id: randomUUID(),
      title: `Remediate: ${finding.title}`,
      description: "Follow security best practices to address this finding",
      automatable: false,
      estimatedEffort: "hours",
      steps: [
        "Review the finding details",
        "Assess impact on healthcare operations",
        "Plan remediation during maintenance window",
        "Implement fix following change management",
        "Verify remediation effectiveness",
      ],
      riskReduction: 20,
    };
  }

  async getSecurityPosture(): Promise<SecurityPosture> {
    const findings = Array.from(this.findings.values());
    const environments = Array.from(this.environments.values());

    const openFindings = findings.filter(f => f.status === "open" || f.status === "investigating");
    const criticalOpen = openFindings.filter(f => f.severity === "critical").length;
    const highOpen = openFindings.filter(f => f.severity === "high").length;

    let overallScore = 100;
    overallScore -= criticalOpen * 15;
    overallScore -= highOpen * 8;
    overallScore -= openFindings.filter(f => f.severity === "medium").length * 3;
    overallScore -= openFindings.filter(f => f.severity === "low").length * 1;
    overallScore = Math.max(0, Math.min(100, overallScore));

    const complianceStatus: SecurityPosture["complianceStatus"] = {
      HIPAA: { score: 0, findings: 0 },
      SOC2: { score: 0, findings: 0 },
      PCI_DSS: { score: 0, findings: 0 },
      GDPR: { score: 0, findings: 0 },
      NIST: { score: 0, findings: 0 },
      CIS: { score: 0, findings: 0 },
    };

    for (const finding of openFindings) {
      for (const framework of finding.complianceFrameworks) {
        complianceStatus[framework].findings++;
      }
    }

    for (const framework of Object.keys(complianceStatus) as ComplianceFramework[]) {
      const frameworkFindings = complianceStatus[framework].findings;
      complianceStatus[framework].score = Math.max(0, 100 - frameworkFindings * 12);
    }

    const dataAtRisk: SecurityPosture["dataAtRisk"] = [];
    const dataClassifications: DataClassification[] = ["PHI", "PII", "PCI", "confidential", "internal", "public"];
    
    for (const classification of dataClassifications) {
      const affectedFindings = openFindings.filter(f => f.affectedDataTypes.includes(classification));
      if (affectedFindings.length > 0) {
        dataAtRisk.push({
          classification,
          resourceCount: affectedFindings.length,
          findingsCount: affectedFindings.length,
        });
      }
    }

    return {
      overallScore,
      trend: overallScore >= 75 ? "stable" : overallScore >= 50 ? "declining" : "declining",
      lastAssessment: new Date().toISOString(),
      environments,
      topRisks: openFindings.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
      complianceStatus,
      dataAtRisk: dataAtRisk.sort((a, b) => b.findingsCount - a.findingsCount),
    };
  }

  async getFindings(options?: {
    provider?: CloudProvider;
    severity?: FindingSeverity;
    status?: FindingStatus;
    framework?: ComplianceFramework;
    dataType?: DataClassification;
  }): Promise<SecurityFinding[]> {
    let findings = Array.from(this.findings.values());

    if (options?.provider) {
      findings = findings.filter(f => f.provider === options.provider);
    }
    if (options?.severity) {
      findings = findings.filter(f => f.severity === options.severity);
    }
    if (options?.status) {
      findings = findings.filter(f => f.status === options.status);
    }
    if (options?.framework) {
      findings = findings.filter(f => f.complianceFrameworks.includes(options.framework!));
    }
    if (options?.dataType) {
      findings = findings.filter(f => f.affectedDataTypes.includes(options.dataType!));
    }

    return findings.sort((a, b) => b.riskScore - a.riskScore);
  }

  async updateFindingStatus(findingId: string, status: FindingStatus, notes?: string): Promise<SecurityFinding> {
    const finding = this.findings.get(findingId);
    if (!finding) {
      throw new Error("Finding not found");
    }

    finding.status = status;
    finding.lastUpdated = new Date().toISOString();

    console.log(`[SecurityPostureEngine] Finding ${findingId} updated to ${status}`);
    return finding;
  }

  async applyRemediation(findingId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const finding = this.findings.get(findingId);
    if (!finding) {
      throw new Error("Finding not found");
    }

    if (!finding.remediation?.automatable) {
      return {
        success: false,
        message: "This remediation requires manual intervention",
      };
    }

    this.remediationHistory.set(randomUUID(), {
      appliedAt: new Date().toISOString(),
      by: userId,
      findingId,
    });

    finding.status = "resolved";
    finding.lastUpdated = new Date().toISOString();

    console.log(`[SecurityPostureEngine] Remediation applied for finding ${findingId} by ${userId}`);
    return {
      success: true,
      message: `Remediation applied: ${finding.remediation.title}`,
    };
  }

  async analyzeRisks(): Promise<{
    prioritizedFindings: SecurityFinding[];
    recommendations: string[];
    estimatedRiskReduction: number;
  }> {
    const openFindings = Array.from(this.findings.values())
      .filter(f => f.status === "open" || f.status === "investigating");

    const prioritized = openFindings.sort((a, b) => {
      let scoreA = a.riskScore;
      let scoreB = b.riskScore;

      if (a.affectedDataTypes.includes("PHI")) scoreA += 20;
      if (b.affectedDataTypes.includes("PHI")) scoreB += 20;
      if (a.affectedDataTypes.includes("PII")) scoreA += 15;
      if (b.affectedDataTypes.includes("PII")) scoreB += 15;

      if (a.exploitability === "active") scoreA += 25;
      if (b.exploitability === "active") scoreB += 25;
      if (a.exploitability === "proof_of_concept") scoreA += 10;
      if (b.exploitability === "proof_of_concept") scoreB += 10;

      return scoreB - scoreA;
    });

    const recommendations: string[] = [];
    const phiFindings = openFindings.filter(f => f.affectedDataTypes.includes("PHI"));
    if (phiFindings.length > 0) {
      recommendations.push(`Prioritize ${phiFindings.length} findings affecting Protected Health Information (PHI) for HIPAA compliance`);
    }

    const criticalFindings = openFindings.filter(f => f.severity === "critical");
    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical severity findings within 24 hours per incident response policy`);
    }

    const automatableFindings = openFindings.filter(f => f.remediation?.automatable);
    if (automatableFindings.length > 0) {
      recommendations.push(`${automatableFindings.length} findings can be automatically remediated - consider batch remediation for quick wins`);
    }

    const awsFindings = openFindings.filter(f => f.provider === "aws").length;
    const azureFindings = openFindings.filter(f => f.provider === "azure").length;
    const gcpFindings = openFindings.filter(f => f.provider === "gcp").length;

    if (awsFindings > azureFindings && awsFindings > gcpFindings) {
      recommendations.push("AWS environment has the highest concentration of findings - consider security review");
    }

    const estimatedRiskReduction = automatableFindings.reduce(
      (sum, f) => sum + (f.remediation?.riskReduction || 0), 0
    );

    return {
      prioritizedFindings: prioritized,
      recommendations,
      estimatedRiskReduction,
    };
  }

  async getAlerts(): Promise<PostureAlert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }

  async acknowledgeAlert(alertId: string): Promise<PostureAlert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    alert.acknowledged = true;
    return alert;
  }

  async getEnvironments(): Promise<CloudEnvironment[]> {
    return Array.from(this.environments.values());
  }

  async syncEnvironment(environmentId: string): Promise<{ success: boolean; newFindings: number }> {
    const env = this.environments.get(environmentId);
    if (!env) {
      throw new Error("Environment not found");
    }

    env.lastSync = new Date().toISOString();
    env.status = "connected";

    console.log(`[SecurityPostureEngine] Synced environment: ${env.name}`);
    return { success: true, newFindings: 0 };
  }

  getStats(): {
    totalFindings: number;
    openFindings: number;
    criticalFindings: number;
    phiAtRisk: number;
    environments: number;
    overallScore: number;
  } {
    const findings = Array.from(this.findings.values());
    const openFindings = findings.filter(f => f.status === "open" || f.status === "investigating");

    return {
      totalFindings: findings.length,
      openFindings: openFindings.length,
      criticalFindings: openFindings.filter(f => f.severity === "critical").length,
      phiAtRisk: openFindings.filter(f => f.affectedDataTypes.includes("PHI")).length,
      environments: this.environments.size,
      overallScore: Math.max(0, 100 - openFindings.filter(f => f.severity === "critical").length * 15),
    };
  }
}

export const securityPostureEngine = new SecurityPostureEngine();
