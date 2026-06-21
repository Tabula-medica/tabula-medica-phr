import { v4 as uuidv4 } from "uuid";

export interface HITRUSTControl {
  id: string;
  controlId: string;
  domain: string;
  domainId: string;
  controlObjective: string;
  description: string;
  implementationLevel: "1" | "2" | "3";
  status: "implemented" | "partial" | "planned" | "not_applicable";
  implementationDetails: string;
  evidence: string[];
  mappedFrameworks: {
    hipaa?: string[];
    soc2?: string[];
    nist?: string[];
    iso27001?: string[];
  };
  owner: string;
  assessmentFrequency: "monthly" | "quarterly" | "semi-annually" | "annually";
  lastAssessedAt?: string;
  nextAssessmentAt: string;
  riskRating: "low" | "moderate" | "high" | "critical";
  maturityLevel: 1 | 2 | 3 | 4 | 5;
  remediationPlan?: string;
  remediationDeadline?: string;
}

export interface HITRUSTDomain {
  id: string;
  domainId: string;
  name: string;
  description: string;
  controlCount: number;
  implementedCount: number;
  compliancePercentage: number;
}

export interface HITRUSTAssessment {
  id: string;
  assessmentType: "self" | "validated" | "certified";
  assessorName: string;
  startDate: string;
  completionDate?: string;
  status: "in_progress" | "completed" | "expired";
  overallScore: number;
  findings: HITRUSTFinding[];
  certificationExpiry?: string;
}

export interface HITRUSTFinding {
  id: string;
  controlId: string;
  findingType: "gap" | "observation" | "recommendation";
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
  remediationPlan: string;
  dueDate: string;
  status: "open" | "in_progress" | "remediated" | "accepted_risk";
  assignedTo: string;
}

const HITRUST_CONTROLS: HITRUSTControl[] = [
  {
    id: uuidv4(),
    controlId: "01.a",
    domain: "Information Security Management Program",
    domainId: "01",
    controlObjective: "Access Control Policy",
    description: "An access control policy shall be established, documented, and reviewed based on business and security requirements",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "RBAC system with granular permissions implemented via /api/rbac/*. Role-based access control with policy management, patient consent management, and access evaluation engine.",
    evidence: ["rbac-policy-document.pdf", "access-control-audit-2024.pdf", "rbac-configuration-screenshot.png"],
    mappedFrameworks: {
      hipaa: ["164.312(a)(1)", "164.312(d)"],
      soc2: ["CC6.1", "CC6.2", "CC6.3"],
      nist: ["AC-1", "AC-2", "AC-3"],
      iso27001: ["A.9.1.1", "A.9.1.2"],
    },
    owner: "Security Team",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "01.b",
    domain: "Information Security Management Program",
    domainId: "01",
    controlObjective: "User Registration",
    description: "A formal user registration and de-registration process shall be implemented for granting access to systems",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "User registration with OIDC authentication, automated onboarding wizard, and session management. Google Cloud Identity Platform with provider-side MFA available.",
    evidence: ["user-registration-flow.pdf", "mfa-enrollment-report.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(a)(2)(i)", "164.312(d)"],
      soc2: ["CC6.1"],
      nist: ["IA-2", "IA-5"],
      iso27001: ["A.9.2.1", "A.9.2.2"],
    },
    owner: "Identity Management",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "01.j",
    domain: "Information Security Management Program",
    domainId: "01",
    controlObjective: "Multi-Factor Authentication",
    description: "Multi-factor authentication shall be required for all users accessing systems containing ePHI",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "Mandatory TOTP-based MFA with backup codes, rate limiting (5 attempts, 15-min lockout), biometric authentication for mobile. MFA enforced for all user roles accessing PHI.",
    evidence: ["mfa-policy.pdf", "mfa-enrollment-metrics.pdf", "totp-implementation-review.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(d)", "164.312(a)(2)(i)"],
      soc2: ["CC6.1", "CC6.6"],
      nist: ["IA-2(1)", "IA-2(2)"],
      iso27001: ["A.9.4.2"],
    },
    owner: "Security Team",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
  {
    id: uuidv4(),
    controlId: "02.a",
    domain: "Access Control",
    domainId: "02",
    controlObjective: "Audit Logging and Monitoring",
    description: "Audit logs recording user activities, exceptions, and information security events shall be produced and kept",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "Comprehensive audit trail with WORM (Write Once Read Many) semantics. HIPAA-compliant PHI access logging, tamper-evident hash chain verification. 7-year retention policy (exceeds 6-year HIPAA minimum).",
    evidence: ["audit-trail-architecture.pdf", "worm-log-verification.pdf", "retention-policy.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(b)", "164.308(a)(1)(ii)(D)"],
      soc2: ["CC7.2", "CC7.3"],
      nist: ["AU-2", "AU-3", "AU-6", "AU-11"],
      iso27001: ["A.12.4.1", "A.12.4.3"],
    },
    owner: "Security Operations",
    assessmentFrequency: "monthly",
    lastAssessedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
  {
    id: uuidv4(),
    controlId: "03.a",
    domain: "Risk Management",
    domainId: "03",
    controlObjective: "Risk Assessment",
    description: "Risk assessments shall be performed periodically and when significant changes occur",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "AI-powered risk stratification, predictive compliance monitoring, and automated anomaly detection. Security posture engine with continuous threat assessment.",
    evidence: ["risk-assessment-2024.pdf", "threat-model.pdf", "security-posture-report.pdf"],
    mappedFrameworks: {
      hipaa: ["164.308(a)(1)(ii)(A)", "164.308(a)(1)(ii)(B)"],
      soc2: ["CC3.1", "CC3.2", "CC3.3"],
      nist: ["RA-3", "RA-5"],
      iso27001: ["A.12.6.1"],
    },
    owner: "Risk Management",
    assessmentFrequency: "annually",
    lastAssessedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "moderate",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "04.a",
    domain: "Information Protection Program",
    domainId: "04",
    controlObjective: "Encryption of PHI at Rest",
    description: "ePHI shall be encrypted at rest using validated cryptographic methods",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "AES-256-GCM encryption for PHI at rest, zero-knowledge encryption service with patient-held master keys, PBKDF2 key derivation, Cloud KMS integration for key management.",
    evidence: ["encryption-policy.pdf", "kms-configuration.pdf", "zk-encryption-review.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(a)(2)(iv)", "164.312(e)(2)(ii)"],
      soc2: ["CC6.1", "CC6.7"],
      nist: ["SC-28", "SC-12"],
      iso27001: ["A.10.1.1", "A.10.1.2"],
    },
    owner: "Security Architecture",
    assessmentFrequency: "semi-annually",
    lastAssessedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
  {
    id: uuidv4(),
    controlId: "04.b",
    domain: "Information Protection Program",
    domainId: "04",
    controlObjective: "Encryption of PHI in Transit",
    description: "ePHI shall be encrypted during electronic transmission using validated cryptographic methods",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "TLS 1.3 with HSTS enforcement for all API communications. SMART on FHIR OAuth 2.0 + PKCE for secure EHR connectivity. Helmet.js for HTTP security headers.",
    evidence: ["tls-configuration.pdf", "hsts-policy.pdf", "api-security-scan.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(e)(1)", "164.312(e)(2)(i)"],
      soc2: ["CC6.7"],
      nist: ["SC-8", "SC-13"],
      iso27001: ["A.13.1.1", "A.14.1.2"],
    },
    owner: "Security Architecture",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 65 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
  {
    id: uuidv4(),
    controlId: "05.a",
    domain: "Business Associate Agreements",
    domainId: "05",
    controlObjective: "BAA Management",
    description: "Business Associate Agreements must be executed with all entities that create, receive, maintain, or transmit ePHI on behalf of the covered entity",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "BAA signed with Google Cloud for HIPAA-eligible services. Vendor risk assessments conducted for all third-party integrations handling PHI. BAA tracking and renewal system in place.",
    evidence: ["gcp-baa-signed.pdf", "vendor-risk-assessment-report.pdf", "baa-tracker.xlsx"],
    mappedFrameworks: {
      hipaa: ["164.308(b)(1)", "164.314(a)(1)", "164.314(a)(2)"],
      soc2: ["CC9.2"],
      nist: ["SA-9"],
      iso27001: ["A.15.1.2"],
    },
    owner: "Legal / Compliance",
    assessmentFrequency: "annually",
    lastAssessedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 245 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "06.a",
    domain: "Data Integrity and Availability",
    domainId: "06",
    controlObjective: "Data Deduplication and Integrity",
    description: "Mechanisms shall be implemented to ensure the integrity and accuracy of health data through deduplication and validation",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "Record fingerprinting with SHA-256 hashing for deduplication. NMN-standard patient deduplication engine. FHIR data quality validation with AI-powered harmonization and auto-remediation.",
    evidence: ["dedup-architecture.pdf", "data-quality-report.pdf", "fingerprinting-algorithm.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(c)(1)", "164.312(c)(2)"],
      soc2: ["PI1.1", "PI1.2"],
      nist: ["SI-7", "SI-10"],
      iso27001: ["A.14.2.5"],
    },
    owner: "Data Engineering",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "07.a",
    domain: "Incident Management",
    domainId: "07",
    controlObjective: "Incident Response Plan",
    description: "An incident response plan shall be established for responding to security incidents and breaches",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "Break-Glass Protocol for emergency access, CAP Alert system, automated incident detection with AI threat intelligence, breach notification workflow with HIPAA 60-day compliance.",
    evidence: ["incident-response-plan.pdf", "breach-notification-procedure.pdf", "tabletop-exercise-2024.pdf"],
    mappedFrameworks: {
      hipaa: ["164.308(a)(6)(i)", "164.308(a)(6)(ii)"],
      soc2: ["CC7.3", "CC7.4", "CC7.5"],
      nist: ["IR-1", "IR-4", "IR-5", "IR-6"],
      iso27001: ["A.16.1.1", "A.16.1.4", "A.16.1.5"],
    },
    owner: "Security Operations",
    assessmentFrequency: "semi-annually",
    lastAssessedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 105 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "moderate",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "08.a",
    domain: "Data Storage and Transmission",
    domainId: "08",
    controlObjective: "Webhook and CDC Data Flow",
    description: "Data synchronization shall use event-driven patterns (webhooks/CDC) rather than polling to minimize aggregator load and ensure timely data availability",
    implementationLevel: "2",
    status: "implemented",
    implementationDetails: "Webhook-first aggregator integration with Cache-Aside pattern. Stale-data threshold checks (24h). CDC event processing for real-time health data updates. Deduplication via record fingerprinting before database persistence.",
    evidence: ["webhook-architecture.pdf", "cdc-implementation.pdf", "aggregator-integration-specs.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(c)(1)", "164.312(e)(1)"],
      soc2: ["A1.1", "PI1.1"],
      nist: ["SI-4", "SC-8"],
    },
    owner: "Data Engineering",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "09.a",
    domain: "Cloud Infrastructure Security",
    domainId: "09",
    controlObjective: "HIPAA-Eligible Cloud Services",
    description: "Only HIPAA-eligible cloud services shall be used for storing or processing ePHI",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "Google Cloud Platform with BAA. HIPAA-eligible services only: Cloud SQL (PostgreSQL), BigQuery, Cloud Healthcare API, Cloud KMS, VPC Service Controls. Infrastructure-as-Code with security guardrails.",
    evidence: ["gcp-service-inventory.pdf", "hipaa-eligible-services-list.pdf", "terraform-config-review.pdf"],
    mappedFrameworks: {
      hipaa: ["164.308(a)(1)", "164.310(d)(1)"],
      soc2: ["CC6.1", "CC6.7", "CC8.1"],
      nist: ["SA-9", "SC-7"],
      iso27001: ["A.14.1.1", "A.15.1.2"],
    },
    owner: "Cloud Architecture",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
  {
    id: uuidv4(),
    controlId: "09.b",
    domain: "Cloud Infrastructure Security",
    domainId: "09",
    controlObjective: "VPC Service Controls and Network Isolation",
    description: "VPC Service Controls shall be configured to create security perimeters around GCP resources containing ePHI",
    implementationLevel: "3",
    status: "implemented",
    implementationDetails: "VPC Service Controls configured for Cloud SQL, BigQuery, and Cloud Healthcare API. Network isolation with private service connections. IAM least-privilege policies with conditional access bindings.",
    evidence: ["vpc-sc-configuration.pdf", "network-architecture.pdf", "iam-policy-review.pdf"],
    mappedFrameworks: {
      hipaa: ["164.312(a)(1)", "164.312(e)(1)"],
      soc2: ["CC6.1", "CC6.6"],
      nist: ["SC-7", "AC-4"],
      iso27001: ["A.13.1.1", "A.13.1.3"],
    },
    owner: "Cloud Architecture",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 4,
  },
  {
    id: uuidv4(),
    controlId: "10.a",
    domain: "Data Retention and Disposal",
    domainId: "10",
    controlObjective: "Data Retention Policy",
    description: "Data retention policies shall be established ensuring audit logs are retained for at least 6 years per HIPAA requirements",
    implementationLevel: "1",
    status: "implemented",
    implementationDetails: "Configurable retention policies: 7-year audit log retention (exceeds HIPAA 6-year minimum), 10-year patient records, 90-day session data, 7-year consent records. Automated cleanup scheduler runs every 24 hours.",
    evidence: ["retention-policy-document.pdf", "cleanup-scheduler-logs.pdf", "retention-compliance-report.pdf"],
    mappedFrameworks: {
      hipaa: ["164.530(j)", "164.312(b)"],
      soc2: ["CC7.2"],
      nist: ["AU-11", "SI-12"],
      iso27001: ["A.8.3.2", "A.18.1.3"],
    },
    owner: "Data Governance",
    assessmentFrequency: "quarterly",
    lastAssessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    riskRating: "low",
    maturityLevel: 5,
  },
];

const HITRUST_DOMAINS: HITRUSTDomain[] = [
  { id: "01", domainId: "01", name: "Information Security Management Program", description: "Policies, procedures, and governance for information security", controlCount: 3, implementedCount: 3, compliancePercentage: 100 },
  { id: "02", domainId: "02", name: "Access Control", description: "Audit logging, monitoring, and access management", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "03", domainId: "03", name: "Risk Management", description: "Risk assessment and mitigation processes", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "04", domainId: "04", name: "Information Protection Program", description: "Encryption and data protection mechanisms", controlCount: 2, implementedCount: 2, compliancePercentage: 100 },
  { id: "05", domainId: "05", name: "Business Associate Agreements", description: "Third-party BAA management and vendor risk", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "06", domainId: "06", name: "Data Integrity and Availability", description: "Data deduplication, validation, and availability", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "07", domainId: "07", name: "Incident Management", description: "Incident response and breach notification", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "08", domainId: "08", name: "Data Storage and Transmission", description: "Webhook/CDC data flows and secure transmission", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
  { id: "09", domainId: "09", name: "Cloud Infrastructure Security", description: "HIPAA-eligible cloud services and network controls", controlCount: 2, implementedCount: 2, compliancePercentage: 100 },
  { id: "10", domainId: "10", name: "Data Retention and Disposal", description: "Retention policies and data lifecycle management", controlCount: 1, implementedCount: 1, compliancePercentage: 100 },
];

const assessments: HITRUSTAssessment[] = [
  {
    id: uuidv4(),
    assessmentType: "self",
    assessorName: "Internal Security Team",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    completionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    overallScore: 94,
    findings: [
      {
        id: uuidv4(),
        controlId: "03.a",
        findingType: "observation",
        severity: "low",
        description: "Risk assessment documentation could include more granular threat modeling for FHIR API endpoints",
        remediationPlan: "Expand threat model to cover all FHIR resource endpoints with STRIDE analysis",
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        assignedTo: "Security Architecture",
      },
    ],
    certificationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export class HITRUSTCSFMappingService {
  private controls: HITRUSTControl[] = [...HITRUST_CONTROLS];
  private domains: HITRUSTDomain[] = [...HITRUST_DOMAINS];
  private assessments: HITRUSTAssessment[] = [...assessments];

  getDashboard() {
    const totalControls = this.controls.length;
    const implementedControls = this.controls.filter((c) => c.status === "implemented").length;
    const partialControls = this.controls.filter((c) => c.status === "partial").length;
    const plannedControls = this.controls.filter((c) => c.status === "planned").length;
    const avgMaturity = this.controls.reduce((sum, c) => sum + c.maturityLevel, 0) / totalControls;

    const upcomingAssessments = this.controls
      .filter((c) => new Date(c.nextAssessmentAt) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      .map((c) => ({ controlId: c.controlId, domain: c.domain, nextAssessmentAt: c.nextAssessmentAt }));

    const latestAssessment = this.assessments[this.assessments.length - 1];

    return {
      summary: {
        totalControls,
        implementedControls,
        partialControls,
        plannedControls,
        compliancePercentage: Math.round((implementedControls / totalControls) * 100),
        averageMaturityLevel: Math.round(avgMaturity * 10) / 10,
        frameworkVersion: "HITRUST CSF v11.3",
        lastUpdated: new Date().toISOString(),
      },
      domains: this.domains,
      upcomingAssessments,
      latestAssessment: latestAssessment
        ? {
            id: latestAssessment.id,
            type: latestAssessment.assessmentType,
            status: latestAssessment.status,
            overallScore: latestAssessment.overallScore,
            openFindings: latestAssessment.findings.filter((f) => f.status !== "remediated").length,
          }
        : null,
      inheritedControls: {
        provider: "Google Cloud Platform",
        inheritedCount: 5,
        details: "Physical security, infrastructure controls, and network security inherited from GCP's HITRUST certification",
      },
    };
  }

  getControls(filters?: { domainId?: string; status?: string; riskRating?: string }) {
    let filtered = [...this.controls];
    if (filters?.domainId) filtered = filtered.filter((c) => c.domainId === filters.domainId);
    if (filters?.status) filtered = filtered.filter((c) => c.status === filters.status);
    if (filters?.riskRating) filtered = filtered.filter((c) => c.riskRating === filters.riskRating);
    return filtered;
  }

  getControlById(controlId: string) {
    return this.controls.find((c) => c.controlId === controlId);
  }

  getDomains() {
    return this.domains;
  }

  getAssessments() {
    return this.assessments;
  }

  getCrossFrameworkMapping() {
    return this.controls.map((c) => ({
      hitrustControlId: c.controlId,
      hitrustDomain: c.domain,
      hitrustObjective: c.controlObjective,
      status: c.status,
      hipaaReferences: c.mappedFrameworks.hipaa || [],
      soc2References: c.mappedFrameworks.soc2 || [],
      nistReferences: c.mappedFrameworks.nist || [],
      iso27001References: c.mappedFrameworks.iso27001 || [],
    }));
  }

  getGapAnalysis() {
    const gaps = this.controls.filter((c) => c.status !== "implemented");
    const openFindings = this.assessments.flatMap((a) => a.findings.filter((f) => f.status !== "remediated"));

    return {
      controlGaps: gaps.map((c) => ({
        controlId: c.controlId,
        domain: c.domain,
        objective: c.controlObjective,
        status: c.status,
        riskRating: c.riskRating,
        remediationPlan: c.remediationPlan,
        remediationDeadline: c.remediationDeadline,
      })),
      openFindings,
      riskSummary: {
        critical: gaps.filter((g) => g.riskRating === "critical").length,
        high: gaps.filter((g) => g.riskRating === "high").length,
        moderate: gaps.filter((g) => g.riskRating === "moderate").length,
        low: gaps.filter((g) => g.riskRating === "low").length,
      },
    };
  }

  getMetadata() {
    return {
      service: "HITRUST CSF Mapping",
      version: "1.0.0",
      frameworkVersion: "HITRUST CSF v11.3",
      features: [
        "Control mapping to HIPAA, SOC 2, NIST, ISO 27001",
        "Self-assessment tracking",
        "Gap analysis and remediation tracking",
        "Domain-level compliance scoring",
        "Inherited controls from GCP HITRUST certification",
        "Cross-framework compliance mapping",
        "Maturity level assessment (1-5 scale)",
      ],
      complianceNote: "HITRUST CSF provides the most comprehensive and prescriptive framework for healthcare data protection",
    };
  }
}

export const hitrustCSFMappingService = new HITRUSTCSFMappingService();
