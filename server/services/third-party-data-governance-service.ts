// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import { v4 as uuidv4 } from "uuid";

export interface ThirdPartyIntegration {
  id: string;
  name: string;
  vendor: string;
  type: "ai_service" | "api" | "sdk" | "saas" | "cloud_service" | "analytics";
  category: "ai_ml" | "payments" | "communications" | "healthcare" | "compliance" | "infrastructure" | "analytics";
  status: "approved" | "pending_review" | "restricted" | "blocked";
  dataFlows: DataFlow[];
  contractualCoverage: ContractualCoverage;
  riskAssessment: RiskAssessment;
  lastReviewDate: string;
  nextReviewDate: string;
  addedAt: string;
}

export interface DataFlow {
  id: string;
  direction: "outbound" | "inbound" | "bidirectional";
  dataTypes: string[];
  sensitivityLevel: "public" | "internal" | "confidential" | "restricted" | "phi" | "pii" | "pci";
  purpose: string;
  legalBasis: string;
  minimizationApplied: boolean;
  encrypted: boolean;
  retentionPolicy: string;
  crossBorder: boolean;
  destinationCountry?: string;
}

export interface ContractualCoverage {
  dpaInPlace: boolean;
  baaInPlace: boolean;
  ndaInPlace: boolean;
  dpaExpiryDate?: string;
  baaExpiryDate?: string;
  dataProcessingPurposes: string[];
  subProcessors: string[];
  auditRights: boolean;
  breachNotificationHours: number;
  dataDeletionOnTermination: boolean;
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskScore: number;
  factors: {
    factor: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
  }[];
  mitigations: string[];
  lastAssessedAt: string;
}

export interface FrameworkComplianceCheck {
  framework: string;
  articles: string[];
  status: "compliant" | "non_compliant" | "partial" | "not_applicable";
  requirement: string;
  finding: string;
  remediation?: string;
}

export interface DataFlowAuditEvent {
  id: string;
  timestamp: string;
  integrationId: string;
  integrationName: string;
  eventType: "data_shared" | "data_received" | "policy_violation" | "review_completed" | "integration_added" | "integration_blocked" | "flow_restricted";
  dataTypes: string[];
  sensitivityLevel: string;
  outcome: "allowed" | "blocked" | "flagged" | "logged";
  details: string;
  userId?: string;
}

export interface GovernanceDashboard {
  summary: {
    totalIntegrations: number;
    approvedIntegrations: number;
    pendingReview: number;
    restrictedOrBlocked: number;
    totalDataFlows: number;
    highRiskFlows: number;
    dpasCoverage: number;
    baasCoverage: number;
    overallComplianceScore: number;
  };
  frameworkCompliance: {
    framework: string;
    status: "compliant" | "non_compliant" | "partial";
    coveragePercent: number;
    openFindings: number;
  }[];
  recentEvents: DataFlowAuditEvent[];
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const integrations: ThirdPartyIntegration[] = [
  {
    id: uuidv4(),
    name: "OpenAI GPT-5.1",
    vendor: "OpenAI",
    type: "ai_service",
    category: "ai_ml",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "outbound",
        dataTypes: ["medical_terms", "clinical_notes_summary", "patient_queries"],
        sensitivityLevel: "phi",
        purpose: "AI-powered medical term explanation and clinical note summarization",
        legalBasis: "Patient consent for AI-assisted health literacy",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Zero retention - no data stored by processor",
        crossBorder: false,
      },
      {
        id: uuidv4(),
        direction: "inbound",
        dataTypes: ["ai_generated_explanations", "summaries"],
        sensitivityLevel: "internal",
        purpose: "Receive AI-generated medical explanations",
        legalBasis: "Legitimate interest in patient education",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Cached for session duration only",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: true,
      ndaInPlace: true,
      dpaExpiryDate: "2027-03-15",
      baaExpiryDate: "2027-03-15",
      dataProcessingPurposes: ["medical_term_explanation", "clinical_summarization", "patient_education"],
      subProcessors: ["Microsoft Azure (hosting)"],
      auditRights: true,
      breachNotificationHours: 24,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "medium",
      riskScore: 45,
      factors: [
        { factor: "PHI Exposure", severity: "medium", description: "Deidentified clinical terms sent for explanation" },
        { factor: "Data Minimization", severity: "low", description: "Only minimal context sent, no full records" },
        { factor: "Vendor Security", severity: "low", description: "SOC 2 Type II certified, HIPAA BAA in place" },
      ],
      mitigations: ["PHI stripping before API calls", "Zero-retention policy enforced", "BAA with HIPAA compliance", "Encrypted transit (TLS 1.3)"],
      lastAssessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "OpenAI Whisper",
    vendor: "OpenAI",
    type: "ai_service",
    category: "ai_ml",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "outbound",
        dataTypes: ["voice_audio_segments"],
        sensitivityLevel: "phi",
        purpose: "Multilingual voice-to-text for patient voice commands",
        legalBasis: "Patient consent for voice interaction",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Zero retention - audio discarded after transcription",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: true,
      ndaInPlace: true,
      dpaExpiryDate: "2027-03-15",
      baaExpiryDate: "2027-03-15",
      dataProcessingPurposes: ["voice_transcription", "multilingual_access"],
      subProcessors: ["Microsoft Azure (hosting)"],
      auditRights: true,
      breachNotificationHours: 24,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "medium",
      riskScore: 50,
      factors: [
        { factor: "Audio PHI", severity: "medium", description: "Voice may contain identifiable health information" },
        { factor: "Data Minimization", severity: "low", description: "Short audio segments only, no continuous recording" },
      ],
      mitigations: ["Audio segments limited to 30 seconds", "No audio stored by vendor", "BAA enforced", "TLS 1.3 encryption"],
      lastAssessedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 135 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "Stripe Payment Processing",
    vendor: "Stripe, Inc.",
    type: "api",
    category: "payments",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "bidirectional",
        dataTypes: ["payment_card_data", "billing_address", "subscription_details"],
        sensitivityLevel: "pci",
        purpose: "Subscription billing and payment processing",
        legalBasis: "Contract performance for paid services",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Per PCI DSS requirements - tokenized storage",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: false,
      ndaInPlace: true,
      dpaExpiryDate: "2027-06-01",
      dataProcessingPurposes: ["payment_processing", "subscription_management", "fraud_prevention"],
      subProcessors: ["AWS (infrastructure)"],
      auditRights: true,
      breachNotificationHours: 72,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "low",
      riskScore: 25,
      factors: [
        { factor: "PCI Data", severity: "medium", description: "Card data handled via Stripe Elements (never touches our servers)" },
        { factor: "Tokenization", severity: "low", description: "All card data tokenized by Stripe" },
        { factor: "Compliance", severity: "low", description: "PCI DSS Level 1 certified" },
      ],
      mitigations: ["Stripe Elements for client-side tokenization", "No raw card data stored", "PCI DSS Level 1 compliance", "Webhook signature verification"],
      lastAssessedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "Twilio SMS",
    vendor: "Twilio, Inc.",
    type: "api",
    category: "communications",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "outbound",
        dataTypes: ["phone_numbers", "appointment_reminders", "mfa_codes"],
        sensitivityLevel: "pii",
        purpose: "Patient notifications, appointment reminders, and MFA codes",
        legalBasis: "Patient consent for notifications; security requirement for MFA",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Message logs retained 30 days by Twilio",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: true,
      ndaInPlace: true,
      dpaExpiryDate: "2027-01-15",
      baaExpiryDate: "2027-01-15",
      dataProcessingPurposes: ["sms_notifications", "mfa_delivery", "appointment_reminders"],
      subProcessors: ["AWS (infrastructure)", "Carrier networks"],
      auditRights: true,
      breachNotificationHours: 48,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "low",
      riskScore: 30,
      factors: [
        { factor: "PII in Messages", severity: "low", description: "Only phone numbers and short codes sent" },
        { factor: "Message Content", severity: "low", description: "No PHI in SMS body, only reminders and codes" },
      ],
      mitigations: ["No PHI in SMS content", "BAA with Twilio", "Message content minimization", "Encrypted API calls"],
      lastAssessedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 160 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 350 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "Google Cloud Healthcare API",
    vendor: "Google Cloud",
    type: "cloud_service",
    category: "healthcare",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "bidirectional",
        dataTypes: ["fhir_resources", "dicom_images", "hl7_messages", "clinical_data"],
        sensitivityLevel: "phi",
        purpose: "FHIR data storage, DICOM imaging, and healthcare data interoperability",
        legalBasis: "Contract performance and regulatory compliance for healthcare records",
        minimizationApplied: false,
        encrypted: true,
        retentionPolicy: "Per patient data retention policy - minimum 7 years",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: true,
      ndaInPlace: true,
      dpaExpiryDate: "2027-12-31",
      baaExpiryDate: "2027-12-31",
      dataProcessingPurposes: ["healthcare_data_storage", "fhir_interoperability", "dicom_imaging", "analytics"],
      subProcessors: [],
      auditRights: true,
      breachNotificationHours: 24,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "low",
      riskScore: 20,
      factors: [
        { factor: "Full PHI Storage", severity: "medium", description: "Complete health records stored" },
        { factor: "Platform Security", severity: "low", description: "HITRUST CSF, SOC 2, HIPAA certified" },
        { factor: "Data Residency", severity: "low", description: "US-only data residency enforced" },
      ],
      mitigations: ["CMEK encryption", "VPC Service Controls", "IAM least-privilege", "BAA with HIPAA compliance", "HITRUST CSF inherited controls"],
      lastAssessedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 165 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "Fasten Health API",
    vendor: "Fasten Health",
    type: "api",
    category: "healthcare",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "bidirectional",
        dataTypes: ["lab_results", "patient_demographics", "clinical_documents"],
        sensitivityLevel: "phi",
        purpose: "Lab results retrieval and clinical data exchange via FHIR",
        legalBasis: "Patient-directed data access under 21st Century Cures Act",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Transit only - no persistent storage by aggregator",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: true,
      ndaInPlace: true,
      dpaExpiryDate: "2027-04-30",
      baaExpiryDate: "2027-04-30",
      dataProcessingPurposes: ["lab_data_retrieval", "clinical_document_exchange", "patient_matching"],
      subProcessors: ["Quest Diagnostics", "LabCorp"],
      auditRights: true,
      breachNotificationHours: 24,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "medium",
      riskScore: 40,
      factors: [
        { factor: "PHI Exchange", severity: "medium", description: "Full lab results and demographics exchanged" },
        { factor: "Sub-processors", severity: "medium", description: "Data flows through Quest/LabCorp networks" },
        { factor: "FHIR Compliance", severity: "low", description: "Standardized FHIR R4 data format" },
      ],
      mitigations: ["SMART on FHIR OAuth 2.0 + PKCE", "BAA chain with all sub-processors", "FHIR R4 data standardization", "Patient consent verification"],
      lastAssessedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 155 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: "Comp AI Platform",
    vendor: "Comp AI (trycomp.ai)",
    type: "saas",
    category: "compliance",
    status: "approved",
    dataFlows: [
      {
        id: uuidv4(),
        direction: "outbound",
        dataTypes: ["compliance_metrics", "policy_status", "control_evidence"],
        sensitivityLevel: "internal",
        purpose: "Compliance automation and evidence collection for SOC 2, HIPAA, ISO 27001",
        legalBasis: "Legitimate interest in regulatory compliance management",
        minimizationApplied: true,
        encrypted: true,
        retentionPolicy: "Retained per compliance framework audit cycle",
        crossBorder: false,
      },
    ],
    contractualCoverage: {
      dpaInPlace: true,
      baaInPlace: false,
      ndaInPlace: true,
      dpaExpiryDate: "2027-09-30",
      dataProcessingPurposes: ["compliance_tracking", "evidence_collection", "audit_preparation"],
      subProcessors: ["AWS (infrastructure)"],
      auditRights: true,
      breachNotificationHours: 48,
      dataDeletionOnTermination: true,
    },
    riskAssessment: {
      overallRisk: "low",
      riskScore: 15,
      factors: [
        { factor: "Data Sensitivity", severity: "low", description: "Only compliance metadata shared, no PHI/PII" },
        { factor: "Vendor Security", severity: "low", description: "SOC 2 Type II certified" },
      ],
      mitigations: ["No PHI/PII shared", "Compliance-only metadata", "SOC 2 certified vendor", "Encrypted transit"],
      lastAssessedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    lastReviewDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    nextReviewDate: new Date(Date.now() + 170 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const sampleAuditEvents: DataFlowAuditEvent[] = [
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    integrationId: integrations[0].id,
    integrationName: "OpenAI GPT-5.1",
    eventType: "data_shared",
    dataTypes: ["medical_terms"],
    sensitivityLevel: "phi",
    outcome: "allowed",
    details: "Deidentified medical term sent for AI explanation. PHI stripping confirmed.",
  },
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    integrationId: integrations[1].id,
    integrationName: "OpenAI Whisper",
    eventType: "data_shared",
    dataTypes: ["voice_audio_segments"],
    sensitivityLevel: "phi",
    outcome: "allowed",
    details: "15-second voice segment sent for transcription. Zero-retention policy active.",
  },
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    integrationId: "unknown-sdk-001",
    integrationName: "Unregistered Analytics SDK",
    eventType: "policy_violation",
    dataTypes: ["user_behavior", "page_views"],
    sensitivityLevel: "pii",
    outcome: "blocked",
    details: "Shadow integration detected attempting to send user behavior data. Blocked by runtime policy enforcement.",
  },
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    integrationId: integrations[5].id,
    integrationName: "Fasten Health API",
    eventType: "data_shared",
    dataTypes: ["patient_demographics", "lab_results"],
    sensitivityLevel: "phi",
    outcome: "allowed",
    details: "FHIR R4 lab results retrieved via patient-directed access. SMART on FHIR OAuth verified.",
  },
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    integrationId: integrations[4].id,
    integrationName: "Google Cloud Healthcare API",
    eventType: "review_completed",
    dataTypes: [],
    sensitivityLevel: "phi",
    outcome: "logged",
    details: "Quarterly security review completed. All controls verified. HITRUST inherited controls validated.",
  },
  {
    id: uuidv4(),
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    integrationId: integrations[2].id,
    integrationName: "Stripe Payment Processing",
    eventType: "data_shared",
    dataTypes: ["subscription_details"],
    sensitivityLevel: "pci",
    outcome: "allowed",
    details: "Subscription renewal processed. Card data tokenized via Stripe Elements. No raw PCI data transmitted.",
  },
];

export class ThirdPartyDataGovernanceService {
  private integrations: ThirdPartyIntegration[] = [...integrations];
  private auditEvents: DataFlowAuditEvent[] = [...sampleAuditEvents];

  getMetadata() {
    return {
      serviceName: "Third-Party & AI Data Flow Governance",
      version: "1.0.0",
      description: "Monitors and governs sensitive data flows to third-party services and AI integrations beyond DPA scope, ensuring compliance across 12 international regulatory frameworks.",
      features: [
        "Integration registry with approval workflow",
        "Data flow tracking with sensitivity classification",
        "DPA/BAA contractual coverage verification",
        "Multi-framework compliance checks (GDPR, CCPA/CPRA, HIPAA, PCI, GLBA, PIPEDA, APPI, NIST 800-53, ISO/IEC 29100, KSA PDPL, UAE PDPL, Qatar PDPPL)",
        "Shadow integration detection and blocking",
        "Risk assessment with scoring",
        "Runtime data flow policy enforcement",
        "Audit trail for all data sharing events",
        "Cross-border transfer tracking",
        "Data minimization verification",
      ],
      coveredFrameworks: [
        "GDPR (Articles 5, 28)",
        "CCPA/CPRA",
        "HIPAA",
        "PCI DSS",
        "GLBA",
        "PIPEDA",
        "APPI",
        "NIST 800-53",
        "ISO/IEC 29100",
        "KSA PDPL",
        "UAE PDPL",
        "Qatar PDPPL",
      ],
    };
  }

  getDashboard(): GovernanceDashboard {
    const approved = this.integrations.filter((i) => i.status === "approved").length;
    const pending = this.integrations.filter((i) => i.status === "pending_review").length;
    const restrictedOrBlocked = this.integrations.filter((i) => i.status === "restricted" || i.status === "blocked").length;
    const allFlows = this.integrations.flatMap((i) => i.dataFlows);
    const highRiskFlows = allFlows.filter((f) => f.sensitivityLevel === "phi" || f.sensitivityLevel === "pci");
    const dpaCoverage = Math.round((this.integrations.filter((i) => i.contractualCoverage.dpaInPlace).length / this.integrations.length) * 100);
    const baaCoverage = Math.round((this.integrations.filter((i) => i.contractualCoverage.baaInPlace).length / this.integrations.length) * 100);

    const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
    this.integrations.forEach((i) => riskDist[i.riskAssessment.overallRisk]++);

    const frameworkChecks = this.runAllFrameworkChecks();
    const frameworkSummary = this.summarizeFrameworkCompliance(frameworkChecks);

    const complianceScore = Math.round(
      (frameworkSummary.filter((f) => f.status === "compliant").length / frameworkSummary.length) * 100
    );

    return {
      summary: {
        totalIntegrations: this.integrations.length,
        approvedIntegrations: approved,
        pendingReview: pending,
        restrictedOrBlocked,
        totalDataFlows: allFlows.length,
        highRiskFlows: highRiskFlows.length,
        dpasCoverage: dpaCoverage,
        baasCoverage: baaCoverage,
        overallComplianceScore: complianceScore,
      },
      frameworkCompliance: frameworkSummary,
      recentEvents: this.auditEvents.slice(-5).reverse(),
      riskDistribution: riskDist,
    };
  }

  getIntegrations(filters?: { status?: string; category?: string; riskLevel?: string }): ThirdPartyIntegration[] {
    let result = [...this.integrations];
    if (filters?.status) result = result.filter((i) => i.status === filters.status);
    if (filters?.category) result = result.filter((i) => i.category === filters.category);
    if (filters?.riskLevel) result = result.filter((i) => i.riskAssessment.overallRisk === filters.riskLevel);
    return result;
  }

  getIntegrationById(id: string): ThirdPartyIntegration | undefined {
    return this.integrations.find((i) => i.id === id);
  }

  getDataFlows(filters?: { sensitivityLevel?: string; direction?: string; crossBorder?: boolean }) {
    const flows = this.integrations.flatMap((integration) =>
      integration.dataFlows.map((flow) => ({
        ...flow,
        integrationId: integration.id,
        integrationName: integration.name,
        integrationStatus: integration.status,
        vendor: integration.vendor,
      }))
    );

    let result = [...flows];
    if (filters?.sensitivityLevel) result = result.filter((f) => f.sensitivityLevel === filters.sensitivityLevel);
    if (filters?.direction) result = result.filter((f) => f.direction === filters.direction);
    if (filters?.crossBorder !== undefined) result = result.filter((f) => f.crossBorder === filters.crossBorder);
    return { flows: result, total: result.length };
  }

  runAllFrameworkChecks(): FrameworkComplianceCheck[] {
    const checks: FrameworkComplianceCheck[] = [];

    checks.push(...this.checkGDPR());
    checks.push(...this.checkCCPACPRA());
    checks.push(...this.checkHIPAA());
    checks.push(...this.checkPCI());
    checks.push(...this.checkGLBA());
    checks.push(...this.checkPIPEDA());
    checks.push(...this.checkAPPI());
    checks.push(...this.checkNIST80053());
    checks.push(...this.checkISO29100());
    checks.push(...this.checkKSAPDPL());
    checks.push(...this.checkUAEPDPL());
    checks.push(...this.checkQatarPDPPL());

    return checks;
  }

  private checkGDPR(): FrameworkComplianceCheck[] {
    const allHaveDPA = this.integrations.every((i) => i.contractualCoverage.dpaInPlace);
    const allMinimized = this.integrations.every((i) => i.dataFlows.every((f) => f.minimizationApplied || f.sensitivityLevel === "internal" || f.sensitivityLevel === "public"));
    const allHavePurpose = this.integrations.every((i) => i.dataFlows.every((f) => f.purpose && f.legalBasis));
    const crossBorderControlled = this.integrations.every((i) => i.dataFlows.every((f) => !f.crossBorder || f.destinationCountry));

    return [
      {
        framework: "GDPR",
        articles: ["Article 5"],
        status: allMinimized && allHavePurpose ? "compliant" : "partial",
        requirement: "Lawful, fair, purpose-limited processing with data minimization",
        finding: allMinimized ? "All data flows have documented purpose and apply minimization principles" : "Some data flows lack minimization controls",
      },
      {
        framework: "GDPR",
        articles: ["Article 28"],
        status: allHaveDPA ? "compliant" : "non_compliant",
        requirement: "Binding processor agreements for all data processors",
        finding: allHaveDPA ? "All integrations have Data Processing Agreements in place" : "Some integrations lack DPA coverage",
        remediation: allHaveDPA ? undefined : "Establish DPA with uncovered integrations or restrict data sharing",
      },
      {
        framework: "GDPR",
        articles: ["Article 44-49"],
        status: crossBorderControlled ? "compliant" : "partial",
        requirement: "Adequate safeguards for cross-border data transfers",
        finding: crossBorderControlled ? "No uncontrolled cross-border transfers detected" : "Cross-border transfers require additional safeguards",
      },
    ];
  }

  private checkCCPACPRA(): FrameworkComplianceCheck[] {
    const allDisclosed = this.integrations.every((i) => i.status === "approved" && i.contractualCoverage.dataProcessingPurposes.length > 0);
    return [
      {
        framework: "CCPA/CPRA",
        articles: ["Section 1798.100", "Section 1798.140"],
        status: allDisclosed ? "compliant" : "partial",
        requirement: "Disclosure of all personal data sharing; no unauthorized selling",
        finding: allDisclosed ? "All integrations are registered and data sharing purposes disclosed" : "Shadow integrations may constitute unauthorized sharing",
      },
    ];
  }

  private checkHIPAA(): FrameworkComplianceCheck[] {
    const phiIntegrations = this.integrations.filter((i) => i.dataFlows.some((f) => f.sensitivityLevel === "phi"));
    const allHaveBAA = phiIntegrations.every((i) => i.contractualCoverage.baaInPlace);
    const allEncrypted = phiIntegrations.every((i) => i.dataFlows.every((f) => f.encrypted));

    return [
      {
        framework: "HIPAA",
        articles: ["45 CFR 164.502", "45 CFR 164.504"],
        status: allHaveBAA ? "compliant" : "non_compliant",
        requirement: "PHI shared only with approved Business Associates under BAA",
        finding: allHaveBAA ? "All PHI-handling integrations have Business Associate Agreements" : "Some PHI-handling integrations lack BAA coverage",
        remediation: allHaveBAA ? undefined : "Execute BAA with all integrations that process PHI",
      },
      {
        framework: "HIPAA",
        articles: ["45 CFR 164.312"],
        status: allEncrypted ? "compliant" : "non_compliant",
        requirement: "Technical safeguards for PHI in transit and at rest",
        finding: allEncrypted ? "All PHI data flows use encryption (TLS 1.3)" : "Some PHI data flows lack encryption",
      },
    ];
  }

  private checkPCI(): FrameworkComplianceCheck[] {
    const pciIntegrations = this.integrations.filter((i) => i.dataFlows.some((f) => f.sensitivityLevel === "pci"));
    const allControlled = pciIntegrations.every((i) => i.status === "approved" && i.riskAssessment.overallRisk !== "critical");

    return [
      {
        framework: "PCI DSS",
        articles: ["Requirement 3", "Requirement 4", "Requirement 12"],
        status: allControlled ? "compliant" : "non_compliant",
        requirement: "Cardholder data protected within controlled environment; no unapproved processing",
        finding: allControlled ? "All payment integrations are approved and use tokenization to avoid raw card data exposure" : "Payment data flows to unapproved services detected",
      },
    ];
  }

  private checkGLBA(): FrameworkComplianceCheck[] {
    const financialFlows = this.integrations.filter((i) => i.category === "payments" || i.dataFlows.some((f) => f.dataTypes.some((d) => d.includes("financial") || d.includes("payment") || d.includes("billing"))));
    const allSafeguarded = financialFlows.every((i) => i.contractualCoverage.dpaInPlace && i.riskAssessment.overallRisk !== "critical");

    return [
      {
        framework: "GLBA",
        articles: ["Safeguards Rule", "Privacy Rule"],
        status: allSafeguarded ? "compliant" : "partial",
        requirement: "Safeguard customer financial data with appropriate controls",
        finding: allSafeguarded ? "Financial data integrations have appropriate safeguards and contractual controls" : "Some financial data flows lack adequate safeguards",
      },
    ];
  }

  private checkPIPEDA(): FrameworkComplianceCheck[] {
    const allConsented = this.integrations.every((i) => i.dataFlows.every((f) => f.legalBasis));
    return [
      {
        framework: "PIPEDA",
        articles: ["Principle 3 - Consent", "Principle 5 - Limiting Use"],
        status: allConsented ? "compliant" : "partial",
        requirement: "Meaningful consent for collection, use, and disclosure of personal data",
        finding: allConsented ? "All data flows have documented legal basis and consent mechanisms" : "Some data flows lack documented consent basis",
      },
    ];
  }

  private checkAPPI(): FrameworkComplianceCheck[] {
    const allPurposeLimited = this.integrations.every((i) => i.contractualCoverage.dataProcessingPurposes.length > 0);
    return [
      {
        framework: "APPI",
        articles: ["Article 17", "Article 23"],
        status: allPurposeLimited ? "compliant" : "partial",
        requirement: "Clear purpose specification and limits on data sharing",
        finding: allPurposeLimited ? "All integrations have defined data processing purposes with sharing limits" : "Some integrations lack purpose specification",
      },
    ];
  }

  private checkNIST80053(): FrameworkComplianceCheck[] {
    const allMonitored = this.integrations.every((i) => i.riskAssessment.lastAssessedAt);
    const allAuditable = this.auditEvents.length > 0;
    const supplyChainReviewed = this.integrations.every((i) => i.lastReviewDate);

    return [
      {
        framework: "NIST 800-53",
        articles: ["AU-2 Audit Events", "AU-3 Content of Audit Records"],
        status: allAuditable ? "compliant" : "non_compliant",
        requirement: "Monitoring and auditing of data flows to integrations",
        finding: allAuditable ? "Audit trail maintained for all data flow events with detailed records" : "Insufficient audit logging for integration data flows",
      },
      {
        framework: "NIST 800-53",
        articles: ["SA-9 External System Services", "SR-3 Supply Chain Controls"],
        status: supplyChainReviewed ? "compliant" : "partial",
        requirement: "Supply chain oversight and external system service controls",
        finding: supplyChainReviewed ? "All third-party integrations have documented risk assessments and review schedules" : "Supply chain oversight incomplete for some integrations",
      },
    ];
  }

  private checkISO29100(): FrameworkComplianceCheck[] {
    const allTransparent = this.integrations.every((i) => i.contractualCoverage.dataProcessingPurposes.length > 0 && i.riskAssessment.factors.length > 0);
    return [
      {
        framework: "ISO/IEC 29100",
        articles: ["Principle 1 - Transparency", "Principle 8 - Accountability"],
        status: allTransparent ? "compliant" : "partial",
        requirement: "Transparency, accountability, and documented processing purposes for all integrations",
        finding: allTransparent ? "All integrations have documented purposes, risk assessments, and accountability controls" : "Some integrations lack transparency documentation",
      },
    ];
  }

  private checkKSAPDPL(): FrameworkComplianceCheck[] {
    const noCrossBorderViolation = this.integrations.every((i) => i.dataFlows.every((f) => !f.crossBorder || f.destinationCountry));
    return [
      {
        framework: "KSA PDPL",
        articles: ["Article 29 - Cross-border Transfer"],
        status: noCrossBorderViolation ? "compliant" : "partial",
        requirement: "Lawful basis and consent for processing and cross-border transfers",
        finding: noCrossBorderViolation ? "No uncontrolled cross-border data transfers. All integrations have consent and lawful basis documented" : "Cross-border transfer controls require strengthening",
      },
    ];
  }

  private checkUAEPDPL(): FrameworkComplianceCheck[] {
    const allPurposeAligned = this.integrations.every((i) => i.contractualCoverage.dataProcessingPurposes.length > 0 && i.status === "approved");
    return [
      {
        framework: "UAE PDPL",
        articles: ["Article 5 - Purpose Limitation"],
        status: allPurposeAligned ? "compliant" : "partial",
        requirement: "Processing aligned with stated purpose; no shadow data flows",
        finding: allPurposeAligned ? "All integrations are approved with stated processing purposes. No shadow data flows detected" : "Some data flows may exceed stated purposes",
      },
    ];
  }

  private checkQatarPDPPL(): FrameworkComplianceCheck[] {
    const allSafeguarded = this.integrations.every((i) => i.contractualCoverage.dpaInPlace && i.riskAssessment.overallRisk !== "critical");
    return [
      {
        framework: "Qatar PDPPL",
        articles: ["Article 10 - Safeguards", "Article 12 - Transfers"],
        status: allSafeguarded ? "compliant" : "partial",
        requirement: "Safeguards to prevent unauthorized disclosures and lawful transfer conditions",
        finding: allSafeguarded ? "All integrations have contractual safeguards and risk assessments. Transfer conditions met" : "Some integrations lack adequate safeguards",
      },
    ];
  }

  private summarizeFrameworkCompliance(checks: FrameworkComplianceCheck[]) {
    const frameworks = Array.from(new Set(checks.map((c) => c.framework)));
    return frameworks.map((framework) => {
      const fChecks = checks.filter((c) => c.framework === framework);
      const allCompliant = fChecks.every((c) => c.status === "compliant");
      const anyNonCompliant = fChecks.some((c) => c.status === "non_compliant");
      const openFindings = fChecks.filter((c) => c.status !== "compliant").length;

      return {
        framework,
        status: (allCompliant ? "compliant" : anyNonCompliant ? "non_compliant" : "partial") as "compliant" | "non_compliant" | "partial",
        coveragePercent: Math.round((fChecks.filter((c) => c.status === "compliant").length / fChecks.length) * 100),
        openFindings,
      };
    });
  }

  getAuditEvents(filters?: { integrationId?: string; eventType?: string; outcome?: string; limit?: number }): { events: DataFlowAuditEvent[]; total: number } {
    let result = [...this.auditEvents];
    if (filters?.integrationId) result = result.filter((e) => e.integrationId === filters.integrationId);
    if (filters?.eventType) result = result.filter((e) => e.eventType === filters.eventType);
    if (filters?.outcome) result = result.filter((e) => e.outcome === filters.outcome);
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const total = result.length;
    if (filters?.limit) result = result.slice(0, filters.limit);
    return { events: result, total };
  }

  logAuditEvent(event: Omit<DataFlowAuditEvent, "id" | "timestamp">): DataFlowAuditEvent {
    const newEvent: DataFlowAuditEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.auditEvents.push(newEvent);
    return newEvent;
  }

  getContractualCoverageSummary() {
    return {
      integrations: this.integrations.map((i) => ({
        id: i.id,
        name: i.name,
        vendor: i.vendor,
        category: i.category,
        coverage: {
          dpa: i.contractualCoverage.dpaInPlace,
          baa: i.contractualCoverage.baaInPlace,
          nda: i.contractualCoverage.ndaInPlace,
          dpaExpiry: i.contractualCoverage.dpaExpiryDate,
          baaExpiry: i.contractualCoverage.baaExpiryDate,
          auditRights: i.contractualCoverage.auditRights,
          breachNotificationHours: i.contractualCoverage.breachNotificationHours,
          dataDeletionOnTermination: i.contractualCoverage.dataDeletionOnTermination,
        },
        handlesPHI: i.dataFlows.some((f) => f.sensitivityLevel === "phi"),
        handlesPCI: i.dataFlows.some((f) => f.sensitivityLevel === "pci"),
        handlesPII: i.dataFlows.some((f) => f.sensitivityLevel === "pii"),
      })),
      summary: {
        totalWithDPA: this.integrations.filter((i) => i.contractualCoverage.dpaInPlace).length,
        totalWithBAA: this.integrations.filter((i) => i.contractualCoverage.baaInPlace).length,
        totalWithNDA: this.integrations.filter((i) => i.contractualCoverage.ndaInPlace).length,
        phiIntegrationsWithBAA: this.integrations.filter((i) => i.dataFlows.some((f) => f.sensitivityLevel === "phi") && i.contractualCoverage.baaInPlace).length,
        phiIntegrationsTotal: this.integrations.filter((i) => i.dataFlows.some((f) => f.sensitivityLevel === "phi")).length,
        expiringWithin90Days: this.integrations.filter((i) => {
          const expiry = i.contractualCoverage.dpaExpiryDate || i.contractualCoverage.baaExpiryDate;
          if (!expiry) return false;
          const daysUntilExpiry = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
        }).length,
      },
    };
  }

  getRemediationPlan() {
    const checks = this.runAllFrameworkChecks();
    const nonCompliant = checks.filter((c) => c.status !== "compliant");

    const recommendations: {
      priority: "critical" | "high" | "medium" | "low";
      framework: string;
      requirement: string;
      action: string;
      effort: string;
    }[] = [];

    if (nonCompliant.length === 0) {
      return {
        status: "all_compliant",
        message: "All framework compliance checks passed. No remediation actions required.",
        recommendations: [],
        lastChecked: new Date().toISOString(),
      };
    }

    for (const check of nonCompliant) {
      recommendations.push({
        priority: check.status === "non_compliant" ? "critical" : "medium",
        framework: check.framework,
        requirement: check.requirement,
        action: check.remediation || `Review and address ${check.framework} finding: ${check.finding}`,
        effort: check.status === "non_compliant" ? "1-2 weeks" : "3-5 days",
      });
    }

    recommendations.sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

    return {
      status: "remediation_required",
      totalFindings: nonCompliant.length,
      criticalFindings: nonCompliant.filter((c) => c.status === "non_compliant").length,
      recommendations,
      lastChecked: new Date().toISOString(),
    };
  }
}

export const thirdPartyDataGovernanceService = new ThirdPartyDataGovernanceService();
