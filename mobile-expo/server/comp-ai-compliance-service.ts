import crypto from "crypto";

/**
 * Configuration for Comp AI compliance integration.
 * Supports both Trust Portal API and Enterprise API endpoints.
 */
export interface CompAIConfig {
  apiKey: string;
  apiSecret?: string;
  baseUrl: string;
  enterpriseBaseUrl: string;
  organizationId: string;
}

/**
 * Represents a compliance framework tracked by Comp AI.
 * Supports SOC 2, HIPAA, ISO 27001, HITRUST, and GDPR.
 */
export interface CompAIFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  status: "in_progress" | "compliant" | "needs_attention" | "not_started";
  completionPercentage: number;
  totalControls: number;
  passingControls: number;
  failingControls: number;
  lastAssessment?: Date;
  nextAssessment?: Date;
  certificationExpiry?: Date;
}

/**
 * Individual compliance control within a framework.
 * Tracks implementation status, evidence, and ownership.
 */
export interface CompAIControl {
  id: string;
  frameworkId: string;
  controlCode: string;
  name: string;
  description: string;
  category: string;
  status: "passing" | "failing" | "not_applicable" | "manual_review" | "pending";
  severity: "critical" | "high" | "medium" | "low";
  evidenceCount: number;
  lastChecked: Date;
  owner?: string;
  notes?: string;
  automationStatus: "automated" | "semi_automated" | "manual";
  sharedWith?: string[];
}

/**
 * Evidence collection record for compliance controls.
 * Tracks the lifecycle of evidence from collection to expiration.
 */
export interface CompAIEvidence {
  id: string;
  controlId: string;
  frameworkId: string;
  type: "screenshot" | "log" | "document" | "configuration" | "api_response" | "audit_trail";
  title: string;
  description: string;
  source: string;
  collectedAt: Date;
  expiresAt?: Date;
  status: "valid" | "expired" | "pending_review" | "rejected";
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Risk assessment item identified during compliance evaluation.
 * Tracks risk severity, mitigation status, and remediation plans.
 */
export interface CompAIRiskItem {
  id: string;
  title: string;
  description: string;
  category: "technical" | "operational" | "legal" | "financial" | "reputational";
  riskLevel: "critical" | "high" | "medium" | "low";
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  status: "open" | "mitigating" | "accepted" | "resolved";
  affectedFrameworks: string[];
  mitigationPlan?: string;
  owner?: string;
  identifiedAt: Date;
  resolvedAt?: Date;
  dueDate?: Date;
}

/**
 * Trust portal configuration and status.
 * Represents the public-facing compliance trust center.
 */
export interface CompAITrustPortal {
  enabled: boolean;
  url?: string;
  organizationName: string;
  publishedFrameworks: string[];
  lastUpdated: Date;
  customDomain?: string;
  features: {
    ndaRequired: boolean;
    selfServeAccess: boolean;
    documentSharing: boolean;
    complianceBadges: boolean;
  };
}

/**
 * Overall compliance dashboard aggregating all framework data.
 * Provides a high-level view of the organization's compliance posture.
 */
export interface CompAIComplianceDashboard {
  source: "live" | "demo";
  organizationId: string;
  lastSyncedAt: Date;
  overallScore: number;
  frameworks: CompAIFramework[];
  riskSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  evidenceSummary: {
    total: number;
    valid: number;
    expired: number;
    pendingReview: number;
  };
  trustPortal: CompAITrustPortal;
  recentActivity: Array<{
    action: string;
    timestamp: Date;
    details: string;
  }>;
}

/** @internal Default framework definitions for SOC 2, HIPAA, ISO 27001, HITRUST, and GDPR */
const COMP_AI_FRAMEWORKS: CompAIFramework[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    version: "2024",
    description: "Service Organization Control 2 — evaluates security, availability, processing integrity, confidentiality, and privacy trust service criteria for service organizations.",
    status: "in_progress",
    completionPercentage: 0,
    totalControls: 64,
    passingControls: 0,
    failingControls: 0
  },
  {
    id: "hipaa",
    name: "HIPAA",
    version: "2024",
    description: "Health Insurance Portability and Accountability Act — establishes national standards for protecting individuals' medical records and personal health information (PHI).",
    status: "in_progress",
    completionPercentage: 0,
    totalControls: 54,
    passingControls: 0,
    failingControls: 0
  },
  {
    id: "iso27001",
    name: "ISO 27001",
    version: "2022",
    description: "International standard for information security management systems (ISMS). Provides a systematic approach to managing sensitive company information.",
    status: "not_started",
    completionPercentage: 0,
    totalControls: 93,
    passingControls: 0,
    failingControls: 0
  },
  {
    id: "hitrust",
    name: "HITRUST CSF",
    version: "v11.3",
    description: "HITRUST Common Security Framework — prescriptive compliance framework for healthcare that harmonizes requirements from HIPAA, NIST, ISO 27001, and other standards.",
    status: "not_started",
    completionPercentage: 0,
    totalControls: 156,
    passingControls: 0,
    failingControls: 0
  },
  {
    id: "gdpr",
    name: "GDPR",
    version: "2024",
    description: "General Data Protection Regulation — EU regulation governing the collection, processing, and storage of personal data for EU/EEA data subjects.",
    status: "not_started",
    completionPercentage: 0,
    totalControls: 42,
    passingControls: 0,
    failingControls: 0
  }
];

/** @internal Demo controls for each framework when API is not connected */
const DEMO_CONTROLS: Record<string, Omit<CompAIControl, "id" | "lastChecked">[]> = {
  soc2: [
    { frameworkId: "soc2", controlCode: "CC1.1", name: "COSO Principle 1", description: "Demonstrates commitment to integrity and ethical values", category: "Control Environment", status: "passing", severity: "high", evidenceCount: 3, automationStatus: "automated", owner: "Security Team" },
    { frameworkId: "soc2", controlCode: "CC2.1", name: "Information Communication", description: "Obtains and uses relevant quality information", category: "Communication & Information", status: "passing", severity: "medium", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "soc2", controlCode: "CC3.1", name: "Risk Assessment", description: "Specifies objectives with sufficient clarity", category: "Risk Assessment", status: "manual_review", severity: "high", evidenceCount: 1, automationStatus: "manual" },
    { frameworkId: "soc2", controlCode: "CC5.1", name: "Control Activities", description: "Selects and develops control activities", category: "Control Activities", status: "passing", severity: "medium", evidenceCount: 4, automationStatus: "automated" },
    { frameworkId: "soc2", controlCode: "CC6.1", name: "Logical & Physical Access", description: "Implements logical access security over protected information", category: "Logical & Physical Access Controls", status: "passing", severity: "critical", evidenceCount: 5, automationStatus: "automated" },
    { frameworkId: "soc2", controlCode: "CC7.1", name: "System Operations", description: "Detects and monitors system anomalies", category: "System Operations", status: "passing", severity: "high", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "soc2", controlCode: "CC8.1", name: "Change Management", description: "Manages changes to infrastructure and software", category: "Change Management", status: "manual_review", severity: "medium", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "soc2", controlCode: "CC9.1", name: "Risk Mitigation", description: "Identifies and assesses risk from business disruptions", category: "Risk Mitigation", status: "passing", severity: "high", evidenceCount: 2, automationStatus: "manual" }
  ],
  hipaa: [
    { frameworkId: "hipaa", controlCode: "§164.312(a)", name: "Access Control", description: "Implement technical policies for electronic information systems that maintain ePHI", category: "Technical Safeguards", status: "passing", severity: "critical", evidenceCount: 4, automationStatus: "automated" },
    { frameworkId: "hipaa", controlCode: "§164.312(b)", name: "Audit Controls", description: "Implement hardware, software, and procedures to record and examine activity", category: "Technical Safeguards", status: "passing", severity: "high", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "hipaa", controlCode: "§164.312(c)", name: "Integrity Controls", description: "Implement policies to protect ePHI from improper alteration or destruction", category: "Technical Safeguards", status: "passing", severity: "critical", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "hipaa", controlCode: "§164.312(e)", name: "Transmission Security", description: "Implement technical security measures for ePHI during electronic transmission", category: "Technical Safeguards", status: "passing", severity: "critical", evidenceCount: 4, automationStatus: "automated" },
    { frameworkId: "hipaa", controlCode: "§164.308(a)(1)", name: "Security Management Process", description: "Implement policies to prevent, detect, contain, and correct security violations", category: "Administrative Safeguards", status: "manual_review", severity: "high", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "hipaa", controlCode: "§164.308(a)(3)", name: "Workforce Security", description: "Implement policies to ensure workforce members have appropriate access", category: "Administrative Safeguards", status: "manual_review", severity: "high", evidenceCount: 1, automationStatus: "manual" },
    { frameworkId: "hipaa", controlCode: "§164.308(a)(5)", name: "Security Awareness Training", description: "Implement a security awareness and training program for all workforce members", category: "Administrative Safeguards", status: "manual_review", severity: "medium", evidenceCount: 1, automationStatus: "manual" },
    { frameworkId: "hipaa", controlCode: "§164.308(a)(6)", name: "Incident Response", description: "Implement policies and procedures to address security incidents", category: "Administrative Safeguards", status: "passing", severity: "critical", evidenceCount: 3, automationStatus: "semi_automated" },
    { frameworkId: "hipaa", controlCode: "§164.310(a)", name: "Facility Access Controls", description: "Implement policies to limit physical access to electronic information systems", category: "Physical Safeguards", status: "not_applicable", severity: "medium", evidenceCount: 0, automationStatus: "manual" },
    { frameworkId: "hipaa", controlCode: "§164.310(d)", name: "Device & Media Controls", description: "Implement policies governing the receipt and removal of hardware and electronic media containing ePHI", category: "Physical Safeguards", status: "manual_review", severity: "medium", evidenceCount: 1, automationStatus: "manual" }
  ],
  iso27001: [
    { frameworkId: "iso27001", controlCode: "A.5.1", name: "Policies for Information Security", description: "Management direction for information security", category: "Organizational Controls", status: "manual_review", severity: "high", evidenceCount: 1, automationStatus: "manual" },
    { frameworkId: "iso27001", controlCode: "A.6.1", name: "Screening", description: "Background verification checks on candidates", category: "People Controls", status: "manual_review", severity: "medium", evidenceCount: 0, automationStatus: "manual" },
    { frameworkId: "iso27001", controlCode: "A.7.1", name: "Physical Security Perimeters", description: "Security perimeters to protect areas containing information", category: "Physical Controls", status: "not_applicable", severity: "medium", evidenceCount: 0, automationStatus: "manual" },
    { frameworkId: "iso27001", controlCode: "A.8.1", name: "User Endpoint Devices", description: "Information stored on, processed by, or accessible via user endpoint devices", category: "Technological Controls", status: "passing", severity: "high", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "iso27001", controlCode: "A.8.5", name: "Secure Authentication", description: "Secure authentication technologies and procedures", category: "Technological Controls", status: "passing", severity: "critical", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "iso27001", controlCode: "A.8.9", name: "Configuration Management", description: "Configurations including security configurations of hardware, software, services and networks", category: "Technological Controls", status: "manual_review", severity: "high", evidenceCount: 1, automationStatus: "semi_automated" }
  ],
  hitrust: [
    { frameworkId: "hitrust", controlCode: "01.a", name: "Access Control Policy", description: "Access control policy based on business and security requirements", category: "Access Control", status: "passing", severity: "critical", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "hitrust", controlCode: "01.b", name: "User Registration", description: "Formal user registration and de-registration process", category: "Access Control", status: "passing", severity: "high", evidenceCount: 2, automationStatus: "automated" },
    { frameworkId: "hitrust", controlCode: "06.d", name: "Data Protection", description: "Protection of organizational records and personal data", category: "Compliance", status: "passing", severity: "critical", evidenceCount: 4, automationStatus: "automated" },
    { frameworkId: "hitrust", controlCode: "09.ab", name: "Monitoring System Use", description: "Monitoring procedures for system use and audit logging", category: "Communications & Operations", status: "manual_review", severity: "high", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "hitrust", controlCode: "10.a", name: "Security Requirements Analysis", description: "Security requirements analysis and specification for information systems", category: "Information Systems Acquisition", status: "manual_review", severity: "medium", evidenceCount: 1, automationStatus: "manual" }
  ],
  gdpr: [
    { frameworkId: "gdpr", controlCode: "Art.5", name: "Data Processing Principles", description: "Principles relating to processing of personal data (lawfulness, fairness, transparency)", category: "Core Principles", status: "passing", severity: "critical", evidenceCount: 3, automationStatus: "semi_automated" },
    { frameworkId: "gdpr", controlCode: "Art.6", name: "Lawfulness of Processing", description: "Legal basis for processing personal data", category: "Core Principles", status: "passing", severity: "critical", evidenceCount: 2, automationStatus: "manual" },
    { frameworkId: "gdpr", controlCode: "Art.13", name: "Information to Data Subjects", description: "Information to be provided where personal data are collected", category: "Data Subject Rights", status: "passing", severity: "high", evidenceCount: 2, automationStatus: "semi_automated" },
    { frameworkId: "gdpr", controlCode: "Art.17", name: "Right to Erasure", description: "Right to erasure ('right to be forgotten') upon data subject request", category: "Data Subject Rights", status: "manual_review", severity: "high", evidenceCount: 1, automationStatus: "semi_automated" },
    { frameworkId: "gdpr", controlCode: "Art.25", name: "Data Protection by Design", description: "Data protection by design and by default in all processing activities", category: "Security", status: "passing", severity: "high", evidenceCount: 3, automationStatus: "automated" },
    { frameworkId: "gdpr", controlCode: "Art.32", name: "Security of Processing", description: "Appropriate technical and organisational measures to ensure security", category: "Security", status: "passing", severity: "critical", evidenceCount: 4, automationStatus: "automated" },
    { frameworkId: "gdpr", controlCode: "Art.33", name: "Breach Notification", description: "Notification of a personal data breach to the supervisory authority within 72 hours", category: "Breach", status: "manual_review", severity: "critical", evidenceCount: 1, automationStatus: "semi_automated" },
    { frameworkId: "gdpr", controlCode: "Art.35", name: "Data Protection Impact Assessment", description: "Assessment of the impact of processing operations on the protection of personal data", category: "Accountability", status: "manual_review", severity: "high", evidenceCount: 0, automationStatus: "manual" }
  ]
};

/** @internal Control overlaps shared across multiple frameworks */
const CONTROL_OVERLAP_MAP: Array<{ controlName: string; frameworks: string[]; description: string }> = [
  { controlName: "Access Control", frameworks: ["soc2", "hipaa", "iso27001", "hitrust", "gdpr"], description: "Logical and physical access controls to information systems and data" },
  { controlName: "Encryption at Rest & Transit", frameworks: ["soc2", "hipaa", "iso27001", "hitrust", "gdpr"], description: "Encryption of sensitive data both at rest and during transmission" },
  { controlName: "Audit Logging", frameworks: ["soc2", "hipaa", "iso27001", "hitrust"], description: "Recording and examining system activity through audit logs" },
  { controlName: "Incident Response", frameworks: ["soc2", "hipaa", "iso27001", "hitrust", "gdpr"], description: "Procedures for detecting, responding to, and recovering from security incidents" },
  { controlName: "Risk Assessment", frameworks: ["soc2", "hipaa", "iso27001", "hitrust", "gdpr"], description: "Systematic identification and evaluation of information security risks" },
  { controlName: "Vendor Management", frameworks: ["soc2", "hipaa", "hitrust"], description: "Due diligence and ongoing monitoring of third-party vendors and service providers" },
  { controlName: "Data Retention & Disposal", frameworks: ["hipaa", "iso27001", "gdpr"], description: "Policies for data lifecycle management including retention schedules and secure disposal" },
  { controlName: "Security Awareness Training", frameworks: ["soc2", "hipaa", "iso27001", "hitrust"], description: "Regular security training and awareness programs for all workforce members" },
  { controlName: "Change Management", frameworks: ["soc2", "iso27001", "hitrust"], description: "Structured process for managing changes to systems, software, and infrastructure" },
  { controlName: "Business Continuity", frameworks: ["soc2", "iso27001", "hitrust"], description: "Planning and procedures for business continuity and disaster recovery" },
  { controlName: "Data Subject Rights", frameworks: ["gdpr", "hipaa"], description: "Rights of individuals regarding their personal data (access, correction, deletion)" },
  { controlName: "Data Protection Impact Assessment", frameworks: ["gdpr", "iso27001"], description: "Assessment of risks to individuals from data processing activities" }
];

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_BASE_MS = 1000;

/**
 * Comp AI Compliance Service
 *
 * Integrates with Comp AI (trycomp.ai) for automated compliance management across
 * five major frameworks:
 *
 * - **SOC 2 Type II**: Security, availability, processing integrity, confidentiality, and
 *   privacy controls for service organizations. Required by enterprise customers.
 *
 * - **HIPAA**: Health Insurance Portability and Accountability Act — mandatory for any
 *   organization handling Protected Health Information (PHI). Covers administrative,
 *   physical, and technical safeguards.
 *
 * - **ISO 27001**: International standard for Information Security Management Systems
 *   (ISMS). Provides a systematic approach to managing sensitive information through
 *   risk management processes.
 *
 * - **HITRUST CSF**: Common Security Framework that harmonizes requirements from HIPAA,
 *   NIST, ISO 27001, PCI-DSS, and other standards. The gold standard for healthcare
 *   security certification.
 *
 * - **GDPR**: General Data Protection Regulation governing the collection, processing,
 *   and storage of personal data for EU/EEA data subjects. Requires explicit consent,
 *   breach notification, and data subject rights.
 *
 * The service connects to two Comp AI endpoints:
 * 1. Trust Portal API (`api.trycomp.ai`) — manages compliance resources and trust portal
 * 2. Enterprise API (`enterprise-api.trycomp.ai`) — task automation and workflow analysis
 *
 * When API keys are not configured, the service returns structured demo data clearly
 * marked with `source: "demo"` so the application remains functional during setup.
 */
class CompAIComplianceService {
  private config: CompAIConfig;
  private isConfigured: boolean = false;
  private cachedControls: Map<string, CompAIControl[]> = new Map();

  constructor() {
    const apiKey = process.env.COMP_AI_API_KEY || "";
    const apiSecret = process.env.COMP_AI_API_SECRET || "";
    const organizationId = process.env.COMP_AI_ORG_ID || "";

    this.config = {
      apiKey,
      apiSecret: apiSecret || undefined,
      baseUrl: "https://api.trycomp.ai",
      enterpriseBaseUrl: "https://enterprise-api.trycomp.ai",
      organizationId
    };

    this.isConfigured = !!(apiKey && organizationId);

    if (this.isConfigured) {
      console.log("[Comp AI] Service initialized with API credentials");
    } else {
      console.log("[Comp AI] Service initialized in demo mode — set COMP_AI_API_KEY and COMP_AI_ORG_ID for live data");
    }

    this.initializeDemoControls();
  }

  /**
   * Pre-populate control caches with demo data for all frameworks.
   */
  private initializeDemoControls(): void {
    for (const [frameworkId, controls] of Object.entries(DEMO_CONTROLS)) {
      this.cachedControls.set(
        frameworkId,
        controls.map(c => ({
          ...c,
          id: crypto.randomUUID(),
          lastChecked: new Date()
        }))
      );
    }
  }

  /**
   * Make an authenticated HTTP request to the Comp AI API with retry logic.
   *
   * @param endpoint - API path (e.g. `/v1/trust-portal/compliance-resources/signed-url`)
   * @param method - HTTP method
   * @param body - Optional request body
   * @param isEnterprise - If true, uses the Enterprise API base URL and `x-api-secret` header
   * @returns Parsed JSON response
   */
  private async makeRequest<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: Record<string, unknown>,
    isEnterprise: boolean = false
  ): Promise<T> {
    const baseUrl = isEnterprise ? this.config.enterpriseBaseUrl : this.config.baseUrl;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    if (isEnterprise && this.config.apiSecret) {
      headers["x-api-secret"] = this.config.apiSecret;
    } else {
      headers["X-API-Key"] = this.config.apiKey;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Comp AI API error ${response.status}: ${errorText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
          console.warn(`[Comp AI] Request attempt ${attempt} failed for ${endpoint}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`[Comp AI] Request failed after ${MAX_RETRIES} attempts`);
  }

  /**
   * Get the overall compliance dashboard with status across all five frameworks.
   *
   * @returns Dashboard with framework statuses, risk summary, evidence summary, and trust portal info
   */
  async getComplianceDashboard(): Promise<CompAIComplianceDashboard> {
    if (this.isConfigured) {
      try {
        const dashboardData = await this.makeRequest<CompAIComplianceDashboard>("/v1/dashboard");
        dashboardData.source = "live";
        return dashboardData;
      } catch (error) {
        console.warn("[Comp AI] Dashboard API call failed, returning demo data:", (error as Error).message);
      }
    }

    const frameworks = this.getDemoFrameworks();
    const risks = this.getDemoRiskItems();

    return {
      source: "demo",
      organizationId: this.config.organizationId || "demo-org",
      lastSyncedAt: new Date(),
      overallScore: Math.round(frameworks.reduce((sum, f) => sum + f.completionPercentage, 0) / frameworks.length),
      frameworks,
      riskSummary: {
        total: risks.length,
        critical: risks.filter(r => r.riskLevel === "critical").length,
        high: risks.filter(r => r.riskLevel === "high").length,
        medium: risks.filter(r => r.riskLevel === "medium").length,
        low: risks.filter(r => r.riskLevel === "low").length
      },
      evidenceSummary: {
        total: 48,
        valid: 38,
        expired: 3,
        pendingReview: 7
      },
      trustPortal: this.getDemoTrustPortal(),
      recentActivity: [
        { action: "evidence_collected", timestamp: new Date(Date.now() - 3600000), details: "Automated evidence collected for SOC 2 CC6.1" },
        { action: "control_updated", timestamp: new Date(Date.now() - 7200000), details: "HIPAA Access Control status updated to passing" },
        { action: "risk_assessed", timestamp: new Date(Date.now() - 14400000), details: "New risk item identified: Third-party vendor assessment overdue" },
        { action: "framework_synced", timestamp: new Date(Date.now() - 28800000), details: "ISO 27001 framework controls synchronized" },
        { action: "certificate_renewed", timestamp: new Date(Date.now() - 86400000), details: "SOC 2 Type II certificate URL regenerated" }
      ]
    };
  }

  /**
   * Get status of all tracked compliance frameworks.
   *
   * @returns Array of framework statuses with completion metrics
   */
  async getFrameworks(): Promise<CompAIFramework[]> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{ frameworks: CompAIFramework[] }>("/v1/frameworks");
        return data.frameworks;
      } catch (error) {
        console.warn("[Comp AI] Frameworks API call failed, returning demo data:", (error as Error).message);
      }
    }

    return this.getDemoFrameworks();
  }

  /**
   * Get all controls for a specific compliance framework.
   *
   * @param frameworkId - Framework identifier (e.g. "soc2", "hipaa", "iso27001", "hitrust", "gdpr")
   * @returns Array of controls with their status and evidence counts
   */
  async getFrameworkControls(frameworkId: string): Promise<CompAIControl[]> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{ controls: CompAIControl[] }>(`/v1/frameworks/${frameworkId}/controls`);
        return data.controls;
      } catch (error) {
        console.warn(`[Comp AI] Controls API call failed for ${frameworkId}, returning demo data:`, (error as Error).message);
      }
    }

    return this.cachedControls.get(frameworkId) || [];
  }

  /**
   * Get evidence collection records, optionally filtered by framework.
   *
   * @param frameworkId - Optional framework filter
   * @returns Array of evidence records with their validation status
   */
  async getEvidenceCollection(frameworkId?: string): Promise<CompAIEvidence[]> {
    if (this.isConfigured) {
      try {
        const endpoint = frameworkId
          ? `/v1/evidence?frameworkId=${encodeURIComponent(frameworkId)}`
          : "/v1/evidence";
        const data = await this.makeRequest<{ evidence: CompAIEvidence[] }>(endpoint);
        return data.evidence;
      } catch (error) {
        console.warn("[Comp AI] Evidence API call failed, returning demo data:", (error as Error).message);
      }
    }

    return this.getDemoEvidence(frameworkId);
  }

  /**
   * Trigger an evidence collection sync for specified cloud services.
   * Connects to cloud providers (AWS, GCP, Azure, etc.) to automatically
   * collect compliance evidence.
   *
   * @param services - Array of service identifiers to sync (e.g. ["aws", "gcp", "github"])
   * @returns Sync result with status and timestamp
   */
  async triggerEvidenceSync(services: string[]): Promise<{
    source: "live" | "demo";
    syncId: string;
    status: "started" | "completed" | "failed";
    services: string[];
    startedAt: Date;
    estimatedCompletionAt: Date;
  }> {
    if (this.isConfigured) {
      try {
        const result = await this.makeRequest<{
          syncId: string;
          status: "started" | "completed" | "failed";
          services: string[];
          startedAt: string;
          estimatedCompletionAt: string;
        }>("/v1/evidence/sync", "POST", { services });

        return {
          source: "live",
          syncId: result.syncId,
          status: result.status,
          services: result.services,
          startedAt: new Date(result.startedAt),
          estimatedCompletionAt: new Date(result.estimatedCompletionAt)
        };
      } catch (error) {
        console.warn("[Comp AI] Evidence sync trigger failed:", (error as Error).message);
      }
    }

    return {
      source: "demo",
      syncId: crypto.randomUUID(),
      status: "started",
      services,
      startedAt: new Date(),
      estimatedCompletionAt: new Date(Date.now() + 300000)
    };
  }

  /**
   * Get risk assessment items across all frameworks.
   *
   * @returns Array of risk items with severity ratings and mitigation status
   */
  async getRiskAssessments(): Promise<CompAIRiskItem[]> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{ risks: CompAIRiskItem[] }>("/v1/risks");
        return data.risks;
      } catch (error) {
        console.warn("[Comp AI] Risk assessments API call failed, returning demo data:", (error as Error).message);
      }
    }

    return this.getDemoRiskItems();
  }

  /**
   * Get the current trust portal configuration and status.
   *
   * @returns Trust portal settings including published frameworks and features
   */
  async getTrustPortalStatus(): Promise<CompAITrustPortal> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<CompAITrustPortal>("/v1/trust-portal/status");
        return data;
      } catch (error) {
        console.warn("[Comp AI] Trust portal API call failed, returning demo data:", (error as Error).message);
      }
    }

    return this.getDemoTrustPortal();
  }

  /**
   * Get a signed URL for downloading a compliance certificate or report.
   * Uses the Trust Portal signed URL endpoint.
   *
   * @param framework - Framework identifier (e.g. "soc2", "hipaa")
   * @returns Object containing the signed URL and expiration
   */
  async getComplianceCertificateUrl(framework: string): Promise<{
    source: "live" | "demo";
    url: string;
    framework: string;
    expiresAt: Date;
  }> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{ url: string; expiresAt: string }>(
          "/v1/trust-portal/compliance-resources/signed-url",
          "POST",
          {
            organizationId: this.config.organizationId,
            framework
          }
        );

        return {
          source: "live",
          url: data.url,
          framework,
          expiresAt: new Date(data.expiresAt)
        };
      } catch (error) {
        console.warn(`[Comp AI] Certificate URL generation failed for ${framework}:`, (error as Error).message);
      }
    }

    return {
      source: "demo",
      url: `https://trust.trycomp.ai/demo/${framework}/certificate?token=demo-token`,
      framework,
      expiresAt: new Date(Date.now() + 3600000)
    };
  }

  /**
   * Analyze a workflow for compliance implications using the Enterprise API.
   * Sends workflow data to the Comp AI task automation engine for analysis.
   *
   * @param workflowData - Workflow description and metadata to analyze
   * @returns Analysis results with compliance recommendations
   */
  async analyzeWorkflow(workflowData: {
    name: string;
    description: string;
    steps: Array<{ action: string; dataTypes?: string[] }>;
    targetFrameworks?: string[];
  }): Promise<{
    source: "live" | "demo";
    analysisId: string;
    workflowName: string;
    complianceScore: number;
    findings: Array<{
      framework: string;
      control: string;
      status: "compliant" | "non_compliant" | "needs_review";
      recommendation: string;
    }>;
    recommendations: string[];
    analyzedAt: Date;
  }> {
    if (this.isConfigured && this.config.apiSecret) {
      try {
        const result = await this.makeRequest<{
          analysisId: string;
          complianceScore: number;
          findings: Array<{
            framework: string;
            control: string;
            status: "compliant" | "non_compliant" | "needs_review";
            recommendation: string;
          }>;
          recommendations: string[];
        }>("/api/tasks-automation/workflow/analyze", "POST", {
          workflow: workflowData
        }, true);

        return {
          source: "live",
          analysisId: result.analysisId,
          workflowName: workflowData.name,
          complianceScore: result.complianceScore,
          findings: result.findings,
          recommendations: result.recommendations,
          analyzedAt: new Date()
        };
      } catch (error) {
        console.warn("[Comp AI] Workflow analysis failed:", (error as Error).message);
      }
    }

    const targetFrameworks = workflowData.targetFrameworks || ["soc2", "hipaa"];

    return {
      source: "demo",
      analysisId: crypto.randomUUID(),
      workflowName: workflowData.name,
      complianceScore: 78,
      findings: targetFrameworks.flatMap(fw => [
        {
          framework: fw,
          control: "Access Control",
          status: "compliant" as const,
          recommendation: "Access controls are properly implemented for this workflow"
        },
        {
          framework: fw,
          control: "Audit Logging",
          status: "needs_review" as const,
          recommendation: "Ensure all data access in this workflow is logged with sufficient detail"
        }
      ]),
      recommendations: [
        "Add data classification labels to all workflow steps handling sensitive data",
        "Implement automated evidence collection for workflow execution logs",
        "Consider adding approval gates for steps involving PHI or PII"
      ],
      analyzedAt: new Date()
    };
  }

  /**
   * Generate a compliance report covering selected frameworks and date range.
   *
   * @param frameworks - Array of framework IDs to include in the report
   * @param dateRange - Report period start and end dates
   * @returns Comprehensive compliance report with per-framework breakdowns
   */
  async getComplianceReport(
    frameworks: string[],
    dateRange: { start: Date; end: Date }
  ): Promise<{
    source: "live" | "demo";
    id: string;
    title: string;
    generatedAt: Date;
    period: { start: Date; end: Date };
    overallScore: number;
    frameworkResults: Array<{
      frameworkId: string;
      frameworkName: string;
      score: number;
      passingControls: number;
      failingControls: number;
      totalControls: number;
      highlights: string[];
    }>;
    riskSummary: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    recommendations: string[];
    evidenceGaps: Array<{
      framework: string;
      control: string;
      gap: string;
    }>;
  }> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{
          id: string;
          title: string;
          overallScore: number;
          frameworkResults: Array<{
            frameworkId: string;
            frameworkName: string;
            score: number;
            passingControls: number;
            failingControls: number;
            totalControls: number;
            highlights: string[];
          }>;
          riskSummary: { total: number; critical: number; high: number; medium: number; low: number };
          recommendations: string[];
          evidenceGaps: Array<{ framework: string; control: string; gap: string }>;
        }>("/v1/reports", "POST", {
          frameworks,
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        });

        return {
          source: "live",
          ...data,
          generatedAt: new Date(),
          period: dateRange
        };
      } catch (error) {
        console.warn("[Comp AI] Report generation failed, returning demo report:", (error as Error).message);
      }
    }

    const allFrameworks = this.getDemoFrameworks();
    const requestedFrameworks = allFrameworks.filter(f => frameworks.includes(f.id));

    return {
      source: "demo",
      id: crypto.randomUUID(),
      title: `Compliance Report — ${frameworks.map(f => f.toUpperCase()).join(", ")}`,
      generatedAt: new Date(),
      period: dateRange,
      overallScore: requestedFrameworks.length > 0
        ? Math.round(requestedFrameworks.reduce((sum, f) => sum + f.completionPercentage, 0) / requestedFrameworks.length)
        : 0,
      frameworkResults: requestedFrameworks.map(f => {
        const controls = this.cachedControls.get(f.id) || [];
        const passing = controls.filter(c => c.status === "passing").length;
        const failing = controls.filter(c => c.status === "failing").length;
        return {
          frameworkId: f.id,
          frameworkName: f.name,
          score: f.completionPercentage,
          passingControls: passing,
          failingControls: failing,
          totalControls: controls.length,
          highlights: [
            `${passing} of ${controls.length} controls passing`,
            `${controls.filter(c => c.automationStatus === "automated").length} controls fully automated`
          ]
        };
      }),
      riskSummary: {
        total: 8,
        critical: 1,
        high: 2,
        medium: 3,
        low: 2
      },
      recommendations: [
        "Complete manual review controls to improve overall compliance score",
        "Automate evidence collection for remaining semi-automated controls",
        "Schedule HITRUST CSF assessment to begin certification process",
        "Update GDPR Data Protection Impact Assessment documentation",
        "Renew expiring BAA agreements with cloud service providers"
      ],
      evidenceGaps: [
        { framework: "hipaa", control: "Security Awareness Training", gap: "Training completion records not collected for last quarter" },
        { framework: "soc2", control: "Change Management", gap: "Change approval documentation incomplete for 3 recent deployments" },
        { framework: "gdpr", control: "Data Protection Impact Assessment", gap: "DPIA not conducted for new patient data processing workflow" }
      ]
    };
  }

  /**
   * Get shared controls that overlap across multiple frameworks.
   * Useful for identifying controls that satisfy requirements in multiple frameworks simultaneously,
   * reducing duplicate compliance work.
   *
   * @returns Array of shared controls with the frameworks they satisfy
   */
  async getControlOverlap(): Promise<{
    source: "live" | "demo";
    overlaps: Array<{
      controlName: string;
      frameworks: string[];
      description: string;
      implementationStatus: "implemented" | "partial" | "not_implemented";
    }>;
    totalSharedControls: number;
    efficiencyGain: string;
  }> {
    if (this.isConfigured) {
      try {
        const data = await this.makeRequest<{
          overlaps: Array<{
            controlName: string;
            frameworks: string[];
            description: string;
            implementationStatus: "implemented" | "partial" | "not_implemented";
          }>;
        }>("/v1/controls/overlap");

        return {
          source: "live",
          overlaps: data.overlaps,
          totalSharedControls: data.overlaps.length,
          efficiencyGain: `${Math.round((data.overlaps.length / (data.overlaps.reduce((sum, o) => sum + o.frameworks.length, 0))) * 100)}% effort reduction through shared controls`
        };
      } catch (error) {
        console.warn("[Comp AI] Control overlap API call failed, returning demo data:", (error as Error).message);
      }
    }

    const overlaps = CONTROL_OVERLAP_MAP.map(overlap => ({
      ...overlap,
      implementationStatus: (
        overlap.frameworks.length >= 4 ? "implemented" :
        overlap.frameworks.length >= 2 ? "partial" :
        "not_implemented"
      ) as "implemented" | "partial" | "not_implemented"
    }));

    const totalIndividual = overlaps.reduce((sum, o) => sum + o.frameworks.length, 0);
    const efficiencyPct = Math.round(((totalIndividual - overlaps.length) / totalIndividual) * 100);

    return {
      source: "demo",
      overlaps,
      totalSharedControls: overlaps.length,
      efficiencyGain: `${efficiencyPct}% effort reduction through shared controls`
    };
  }

  /**
   * Perform a full sync of compliance posture across all frameworks.
   * Fetches latest control statuses, evidence, and risk assessments.
   *
   * @returns Sync result with counts of updated items
   */
  async syncComplianceStatus(): Promise<{
    source: "live" | "demo";
    synced: boolean;
    syncedAt: Date;
    frameworksUpdated: number;
    controlsUpdated: number;
    evidenceCollected: number;
    risksIdentified: number;
    errors: string[];
  }> {
    if (this.isConfigured) {
      try {
        const [frameworks, risks] = await Promise.all([
          this.makeRequest<{ frameworks: CompAIFramework[] }>("/v1/frameworks"),
          this.makeRequest<{ risks: CompAIRiskItem[] }>("/v1/risks")
        ]);

        let totalControlsUpdated = 0;
        for (const fw of frameworks.frameworks) {
          try {
            const controls = await this.makeRequest<{ controls: CompAIControl[] }>(`/v1/frameworks/${fw.id}/controls`);
            this.cachedControls.set(fw.id, controls.controls);
            totalControlsUpdated += controls.controls.length;
          } catch (err) {
            console.warn(`[Comp AI] Failed to sync controls for ${fw.id}:`, (err as Error).message);
          }
        }

        return {
          source: "live",
          synced: true,
          syncedAt: new Date(),
          frameworksUpdated: frameworks.frameworks.length,
          controlsUpdated: totalControlsUpdated,
          evidenceCollected: 0,
          risksIdentified: risks.risks.length,
          errors: []
        };
      } catch (error) {
        console.warn("[Comp AI] Full sync failed:", (error as Error).message);
        return {
          source: "live",
          synced: false,
          syncedAt: new Date(),
          frameworksUpdated: 0,
          controlsUpdated: 0,
          evidenceCollected: 0,
          risksIdentified: 0,
          errors: [(error as Error).message]
        };
      }
    }

    this.initializeDemoControls();

    return {
      source: "demo",
      synced: true,
      syncedAt: new Date(),
      frameworksUpdated: COMP_AI_FRAMEWORKS.length,
      controlsUpdated: Object.values(DEMO_CONTROLS).reduce((sum, controls) => sum + controls.length, 0),
      evidenceCollected: 48,
      risksIdentified: 8,
      errors: []
    };
  }

  /** @internal Build demo framework data with computed completion percentages */
  private getDemoFrameworks(): CompAIFramework[] {
    return COMP_AI_FRAMEWORKS.map(framework => {
      const controls = this.cachedControls.get(framework.id) || [];
      const passing = controls.filter(c => c.status === "passing").length;
      const failing = controls.filter(c => c.status === "failing").length;
      const total = controls.length;
      const completion = total > 0 ? Math.round((passing / total) * 100) : 0;

      let status: CompAIFramework["status"] = framework.status;
      if (completion === 100) status = "compliant";
      else if (completion > 50) status = "in_progress";
      else if (completion > 0) status = "needs_attention";

      return {
        ...framework,
        completionPercentage: completion,
        totalControls: total,
        passingControls: passing,
        failingControls: failing,
        lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextAssessment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    });
  }

  /** @internal Build demo risk items */
  private getDemoRiskItems(): CompAIRiskItem[] {
    return [
      {
        id: crypto.randomUUID(),
        title: "Third-Party Vendor Assessment Overdue",
        description: "Annual security assessment for cloud infrastructure vendor has not been completed",
        category: "operational",
        riskLevel: "high",
        likelihood: 3,
        impact: 4,
        riskScore: 12,
        status: "open",
        affectedFrameworks: ["soc2", "hipaa", "hitrust"],
        mitigationPlan: "Schedule vendor assessment review and update BAA",
        owner: "Security Team",
        identifiedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Encryption Key Rotation Schedule",
        description: "Encryption keys for data at rest have not been rotated within the required 90-day window",
        category: "technical",
        riskLevel: "critical",
        likelihood: 2,
        impact: 5,
        riskScore: 10,
        status: "mitigating",
        affectedFrameworks: ["soc2", "hipaa", "iso27001", "hitrust"],
        mitigationPlan: "Implement automated key rotation with cloud KMS",
        owner: "DevOps",
        identifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "GDPR Data Processing Agreement Updates",
        description: "Data processing agreements with 2 sub-processors need updating for new data categories",
        category: "legal",
        riskLevel: "medium",
        likelihood: 3,
        impact: 3,
        riskScore: 9,
        status: "open",
        affectedFrameworks: ["gdpr"],
        mitigationPlan: "Review and update DPAs with legal team",
        owner: "Legal",
        identifiedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Security Awareness Training Completion",
        description: "15% of workforce has not completed mandatory annual security training",
        category: "operational",
        riskLevel: "medium",
        likelihood: 4,
        impact: 2,
        riskScore: 8,
        status: "mitigating",
        affectedFrameworks: ["soc2", "hipaa", "hitrust"],
        mitigationPlan: "Send training reminders and escalate to managers",
        owner: "HR",
        identifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Backup Recovery Testing",
        description: "Disaster recovery backup restoration test has not been performed this quarter",
        category: "technical",
        riskLevel: "high",
        likelihood: 2,
        impact: 5,
        riskScore: 10,
        status: "open",
        affectedFrameworks: ["soc2", "iso27001", "hitrust"],
        mitigationPlan: "Schedule quarterly DR test with infrastructure team",
        owner: "Infrastructure",
        identifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Incomplete Access Review Logs",
        description: "Quarterly user access reviews missing documentation for 3 systems",
        category: "operational",
        riskLevel: "medium",
        likelihood: 3,
        impact: 3,
        riskScore: 9,
        status: "open",
        affectedFrameworks: ["soc2", "hipaa", "iso27001"],
        owner: "IT Admin",
        identifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Penetration Test Findings Remediation",
        description: "2 medium-severity findings from last penetration test pending remediation",
        category: "technical",
        riskLevel: "low",
        likelihood: 2,
        impact: 3,
        riskScore: 6,
        status: "mitigating",
        affectedFrameworks: ["soc2", "iso27001"],
        mitigationPlan: "Deploy patches and validate with re-test",
        owner: "Security Team",
        identifiedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: crypto.randomUUID(),
        title: "Mobile Device Management Gap",
        description: "BYOD policy enforcement not fully implemented for remote workforce",
        category: "operational",
        riskLevel: "low",
        likelihood: 2,
        impact: 2,
        riskScore: 4,
        status: "accepted",
        affectedFrameworks: ["iso27001", "hitrust"],
        mitigationPlan: "Compensating control: VPN required for all PHI access",
        owner: "IT Admin",
        identifiedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  /** @internal Build demo trust portal status */
  private getDemoTrustPortal(): CompAITrustPortal {
    return {
      enabled: true,
      url: "https://trust.trycomp.ai/demo-organization",
      organizationName: this.config.organizationId || "Demo Organization",
      publishedFrameworks: ["soc2", "hipaa", "gdpr"],
      lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000),
      features: {
        ndaRequired: true,
        selfServeAccess: false,
        documentSharing: true,
        complianceBadges: true
      }
    };
  }

  /** @internal Build demo evidence records */
  private getDemoEvidence(frameworkId?: string): CompAIEvidence[] {
    const allEvidence: CompAIEvidence[] = [
      { id: crypto.randomUUID(), controlId: "cc6.1", frameworkId: "soc2", type: "configuration", title: "AWS IAM Policy Configuration", description: "IAM policies enforcing least-privilege access", source: "aws", collectedAt: new Date(Date.now() - 86400000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "cc7.1", frameworkId: "soc2", type: "log", title: "CloudWatch Monitoring Logs", description: "System anomaly detection logs from CloudWatch", source: "aws", collectedAt: new Date(Date.now() - 172800000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "cc8.1", frameworkId: "soc2", type: "document", title: "Change Management Process", description: "Change approval documentation and deployment records", source: "jira", collectedAt: new Date(Date.now() - 259200000), status: "pending_review" },
      { id: crypto.randomUUID(), controlId: "164.312a", frameworkId: "hipaa", type: "configuration", title: "Database Access Controls", description: "PostgreSQL row-level security and role-based access configuration", source: "database", collectedAt: new Date(Date.now() - 86400000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "164.312e", frameworkId: "hipaa", type: "configuration", title: "TLS Certificate Configuration", description: "TLS 1.3 configuration for all PHI transmission endpoints", source: "infrastructure", collectedAt: new Date(Date.now() - 172800000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "164.308a6", frameworkId: "hipaa", type: "document", title: "Incident Response Plan", description: "HIPAA breach notification and incident response procedures", source: "documentation", collectedAt: new Date(Date.now() - 604800000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "a8.5", frameworkId: "iso27001", type: "configuration", title: "Multi-Factor Authentication", description: "MFA configuration for all administrative access", source: "identity_provider", collectedAt: new Date(Date.now() - 86400000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "art32", frameworkId: "gdpr", type: "configuration", title: "Data Encryption Configuration", description: "AES-256 encryption configuration for personal data at rest", source: "infrastructure", collectedAt: new Date(Date.now() - 172800000), status: "valid" },
      { id: crypto.randomUUID(), controlId: "art33", frameworkId: "gdpr", type: "document", title: "Breach Notification Template", description: "72-hour breach notification procedure and template", source: "documentation", collectedAt: new Date(Date.now() - 2592000000), status: "expired" },
      { id: crypto.randomUUID(), controlId: "01.a", frameworkId: "hitrust", type: "configuration", title: "Access Control Policy Evidence", description: "Role-based access control implementation evidence", source: "application", collectedAt: new Date(Date.now() - 86400000), status: "valid" }
    ];

    if (frameworkId) {
      return allEvidence.filter(e => e.frameworkId === frameworkId);
    }

    return allEvidence;
  }
}

export const compAIComplianceService = new CompAIComplianceService();

/**
 * Initialize the Comp AI compliance service.
 * Reads configuration from environment variables and logs initialization status.
 * Call this during server startup.
 */
export function initializeCompAICompliance(): void {
  const hasApiKey = !!process.env.COMP_AI_API_KEY;
  const hasOrgId = !!process.env.COMP_AI_ORG_ID;
  const hasSecret = !!process.env.COMP_AI_API_SECRET;

  if (hasApiKey && hasOrgId) {
    console.log("[Comp AI] Compliance service ready with live API connection");
    if (hasSecret) {
      console.log("[Comp AI] Enterprise API (workflow analysis) is enabled");
    } else {
      console.log("[Comp AI] Enterprise API not configured — set COMP_AI_API_SECRET for workflow analysis");
    }
  } else {
    console.log("[Comp AI] Running in demo mode — compliance data is simulated");
    if (!hasApiKey) console.log("[Comp AI] Set COMP_AI_API_KEY environment variable for live data");
    if (!hasOrgId) console.log("[Comp AI] Set COMP_AI_ORG_ID environment variable for live data");
  }
}
