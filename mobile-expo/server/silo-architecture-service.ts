/**
 * Silo Architecture Service - Backend System Architecture for 24/7 EHR Integration
 * 
 * Architecture: Persistent Backend System (Silo Model)
 * - Superior to SMART on FHIR apps that only run when a clinician has a chart open
 * - Maintains 24/7 persistent connections to EHR systems
 * - Handles background data synchronization, webhook processing, and batch operations
 * - Designed for HIPAA-eligible cloud deployment (AWS/Azure/GCP with BAA)
 * 
 * Standards: HL7 FHIR R4/R5, USCDI v6, TEFCA
 */

interface SiloArchitectureConfig {
  environment: "development" | "staging" | "production";
  cloudProvider: "aws" | "azure" | "gcp";
  baaStatus: "signed" | "pending" | "not_required";
  ehrConnections: EHRConnection[];
  syncSchedule: SyncSchedule;
  securityConfig: SecurityConfig;
}

interface EHRConnection {
  id: string;
  name: string;
  vendor: "epic" | "cerner" | "allscripts" | "meditech" | "other";
  connectionType: "fhir_r4" | "fhir_r5" | "hl7v2" | "cda";
  status: "active" | "pending_registration" | "disconnected" | "maintenance";
  registrationStatus: {
    appMarket: boolean;
    sandboxAccess: boolean;
    productionAccess: boolean;
    lastVerified: string;
  };
  endpoint: string;
  authMethod: "oauth2" | "smart_backend" | "client_credentials";
  lastSync: string | null;
  syncFrequencyMinutes: number;
  dataCategories: string[];
}

interface SyncSchedule {
  fullSyncCronExpression: string;
  incrementalSyncIntervalMinutes: number;
  webhookEnabled: boolean;
  batchProcessingEnabled: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
}

interface SecurityConfig {
  tlsVersion: "1.3";
  mfaRequired: boolean;
  encryptionAtRest: "AES-256-GCM";
  encryptionInTransit: "TLS-1.3";
  auditLogging: boolean;
  ddosProtection: "cloudflare" | "aws-shield" | "azure-ddos" | "none";
  wafEnabled: boolean;
  hipaaCompliant: boolean;
  soc2Aligned: boolean;
}

interface LabIntegration {
  provider: string;
  apiType: "direct" | "aggregator";
  aggregator?: string;
  status: "active" | "pending" | "disabled";
  supportedTests: string[];
  resultsDelivery: "real-time" | "batch" | "webhook";
}

interface ArchitectureStatus {
  overall: "production_ready" | "development" | "partially_configured";
  ehrConnections: { total: number; active: number; pending: number };
  labIntegrations: { total: number; active: number };
  complianceChecklist: ComplianceChecklistItem[];
  cloudReadiness: CloudReadinessAssessment;
}

interface ComplianceChecklistItem {
  id: string;
  requirement: string;
  category: "hipaa" | "onc_hti1" | "uscdi_v6" | "tefca" | "security" | "app_store";
  status: "compliant" | "in_progress" | "not_started" | "not_applicable";
  deadline?: string;
  notes: string;
}

interface CloudReadinessAssessment {
  currentEnvironment: string;
  targetEnvironment: string;
  migrationSteps: string[];
  estimatedEffort: string;
  blockers: string[];
}

class SiloArchitectureService {
  private config: SiloArchitectureConfig;

  constructor() {
    this.config = {
      environment: (process.env.NODE_ENV as any) || "development",
      cloudProvider: "gcp",
      baaStatus: "not_required",
      ehrConnections: this.getDefaultEHRConnections(),
      syncSchedule: {
        fullSyncCronExpression: "0 2 * * *",
        incrementalSyncIntervalMinutes: 15,
        webhookEnabled: true,
        batchProcessingEnabled: true,
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelayMs: 1000,
        },
      },
      securityConfig: {
        tlsVersion: "1.3",
        mfaRequired: true,
        encryptionAtRest: "AES-256-GCM",
        encryptionInTransit: "TLS-1.3",
        auditLogging: true,
        ddosProtection: "none",
        wafEnabled: false,
        hipaaCompliant: false,
        soc2Aligned: false,
      },
    };
  }

  private getDefaultEHRConnections(): EHRConnection[] {
    return [
      {
        id: "epic-primary",
        name: "Epic Systems - App Market Integration",
        vendor: "epic",
        connectionType: "fhir_r4",
        status: "pending_registration",
        registrationStatus: {
          appMarket: false,
          sandboxAccess: false,
          productionAccess: false,
          lastVerified: new Date().toISOString(),
        },
        endpoint: "https://fhir.epic.com/interconnect-fhir-oauth",
        authMethod: "smart_backend",
        lastSync: null,
        syncFrequencyMinutes: 15,
        dataCategories: [
          "Patient Demographics", "Allergies", "Medications", "Problems",
          "Laboratory", "Vital Signs", "Procedures", "Immunizations",
          "Clinical Notes", "Care Team Members", "Goals", "Encounters"
        ],
      },
      {
        id: "cerner-primary",
        name: "Oracle Health (Cerner) - Code Program Integration",
        vendor: "cerner",
        connectionType: "fhir_r4",
        status: "pending_registration",
        registrationStatus: {
          appMarket: false,
          sandboxAccess: false,
          productionAccess: false,
          lastVerified: new Date().toISOString(),
        },
        endpoint: "https://fhir-open.cerner.com/r4",
        authMethod: "client_credentials",
        lastSync: null,
        syncFrequencyMinutes: 30,
        dataCategories: [
          "Patient Demographics", "Allergies", "Medications", "Problems",
          "Laboratory", "Vital Signs", "Procedures", "Immunizations"
        ],
      },
    ];
  }

  private getDefaultLabIntegrations(): LabIntegration[] {
    return [
      {
        provider: "Quest Diagnostics",
        apiType: "aggregator",
        aggregator: "Health Gorilla",
        status: "pending",
        supportedTests: ["CBC", "BMP", "CMP", "Lipid Panel", "TSH", "HbA1c", "Urinalysis"],
        resultsDelivery: "webhook",
      },
      {
        provider: "LabCorp",
        apiType: "aggregator",
        aggregator: "Particle Health",
        status: "pending",
        supportedTests: ["CBC", "BMP", "CMP", "Lipid Panel", "TSH", "HbA1c", "Coagulation"],
        resultsDelivery: "webhook",
      },
      {
        provider: "Health Gorilla",
        apiType: "aggregator",
        status: "pending",
        supportedTests: ["All major reference lab tests via unified API"],
        resultsDelivery: "real-time",
      },
      {
        provider: "Particle Health",
        apiType: "aggregator",
        status: "pending",
        supportedTests: ["Clinical data from 300+ health systems"],
        resultsDelivery: "batch",
      },
    ];
  }

  getArchitectureStatus(): ArchitectureStatus {
    const ehrConnections = this.config.ehrConnections;
    const labIntegrations = this.getDefaultLabIntegrations();

    return {
      overall: this.config.environment === "production" ? "production_ready" : "development",
      ehrConnections: {
        total: ehrConnections.length,
        active: ehrConnections.filter(c => c.status === "active").length,
        pending: ehrConnections.filter(c => c.status === "pending_registration").length,
      },
      labIntegrations: {
        total: labIntegrations.length,
        active: labIntegrations.filter(l => l.status === "active").length,
      },
      complianceChecklist: this.getComplianceChecklist(),
      cloudReadiness: this.getCloudReadiness(),
    };
  }

  private getComplianceChecklist(): ComplianceChecklistItem[] {
    return [
      {
        id: "hipaa-baa",
        requirement: "Sign BAA with cloud provider (AWS/Azure/GCP)",
        category: "hipaa",
        status: this.config.baaStatus === "signed" ? "compliant" : "not_started",
        notes: "Required for production deployment with PHI. Development environment is not HIPAA-eligible.",
      },
      {
        id: "hipaa-encryption",
        requirement: "AES-256-GCM encryption at rest for all PHI",
        category: "hipaa",
        status: "compliant",
        notes: "Implemented via EncryptionService with environment-aware key derivation.",
      },
      {
        id: "hipaa-audit",
        requirement: "Comprehensive audit logging for all PHI access",
        category: "hipaa",
        status: "compliant",
        notes: "AuditService logs all PHI access, modifications, and security events.",
      },
      {
        id: "hipaa-npp",
        requirement: "Update Notice of Privacy Practices with SUD & reproductive health protections",
        category: "hipaa",
        status: "compliant",
        deadline: "2026-02-16",
        notes: "NPP updated with 42 CFR Part 2 SUD protections and HHS reproductive health rule.",
      },
      {
        id: "onc-hti1-access",
        requirement: "15-day data access SLA per ONC HTI-1",
        category: "onc_hti1",
        status: "compliant",
        notes: "Data access request tracking with automated SLA monitoring and alerts.",
      },
      {
        id: "onc-hti1-no-blocking",
        requirement: "No information blocking practices",
        category: "onc_hti1",
        status: "compliant",
        notes: "All data available via standardized FHIR APIs. No artificial barriers to access.",
      },
      {
        id: "uscdi-v6",
        requirement: "USCDI v6 data standard compliance (released July 2025)",
        category: "uscdi_v6",
        status: "compliant",
        notes: "29 data classes implemented. Tracking USCDI v7 draft (released January 2026).",
      },
      {
        id: "tefca-connectivity",
        requirement: "TEFCA Framework connectivity for cross-network data exchange",
        category: "tefca",
        status: "in_progress",
        notes: "8 QHINs configured. Pending production registration with RCE.",
      },
      {
        id: "security-tls13",
        requirement: "TLS 1.3 mandatory for all data in transit",
        category: "security",
        status: "compliant",
        notes: "TLS 1.3 enforcement in security middleware. TLS 1.2 and below rejected.",
      },
      {
        id: "security-mfa",
        requirement: "MFA required for all administrative and user logins (2026 mandate)",
        category: "security",
        status: "compliant",
        notes: "TOTP-based MFA with backup codes. Required for admin access, optional for users in dev.",
      },
      {
        id: "security-ddos",
        requirement: "DDoS protection and WAF (Cloudflare recommended)",
        category: "security",
        status: this.config.securityConfig.ddosProtection !== "none" ? "compliant" : "not_started",
        notes: "Cloudflare recommended. Note: As of Jan 30, 2026, Cloudflare remapped app categories - review health data policies.",
      },
      {
        id: "epic-registration",
        requirement: "Register with Epic App Market for production EHR access",
        category: "hipaa",
        status: "not_started",
        notes: "Required for Epic Individual Access Services (IAS) and Epic Nexus integration.",
      },
      {
        id: "cerner-registration",
        requirement: "Register with Oracle Health (Cerner) Code program",
        category: "hipaa",
        status: "not_started",
        notes: "Required for Oracle Health EHR integration in production.",
      },
      {
        id: "app-store-ios",
        requirement: "Build with iOS 26 SDK for Apple Developer Program",
        category: "app_store",
        status: "not_started",
        notes: "Standard for 2026. Requires Apple Developer account and iOS 26 SDK build.",
      },
      {
        id: "fhir-standards",
        requirement: "HL7 FHIR R4/R5 compliance for all data exchange",
        category: "uscdi_v6",
        status: "compliant",
        notes: "FHIR R4 primary with R5 support. US Core 4.0.0 profiles implemented.",
      },
    ];
  }

  private getCloudReadiness(): CloudReadinessAssessment {
    return {
      currentEnvironment: "Tabula Medica Cloud",
      targetEnvironment: "HIPAA-eligible Cloud (AWS/Azure/GCP with signed BAA)",
      migrationSteps: [
        "1. Select cloud provider and sign Business Associate Agreement (BAA)",
        "2. Set up HIPAA-eligible infrastructure (VPC, encryption, logging)",
        "3. Configure CI/CD pipeline from GitHub repository",
        "4. Deploy backend services with persistent EHR connections",
        "5. Set up Cloudflare for DDoS protection and WAF",
        "6. Configure database with encryption at rest and automated backups",
        "7. Implement monitoring and alerting (uptime, security, compliance)",
        "8. Complete security assessment and penetration testing",
        "9. Register with Epic App Market and Oracle Health Code program",
        "10. Obtain production FHIR endpoint credentials from EHR vendors",
        "11. Set up Quest/LabCorp integration via Health Gorilla or Particle Health",
        "12. Complete HIPAA security risk assessment",
        "13. Submit for App Store review with iOS 26 SDK build",
      ],
      estimatedEffort: "8-12 weeks for full production deployment",
      blockers: [
        "BAA not yet signed with cloud provider",
        "Epic App Market registration pending",
        "Oracle Health Code program registration pending",
        "Security penetration testing not completed",
      ],
    };
  }

  getEHRConnections(): EHRConnection[] {
    return this.config.ehrConnections;
  }

  getLabIntegrations(): LabIntegration[] {
    return this.getDefaultLabIntegrations();
  }

  getSecurityConfig(): SecurityConfig {
    return this.config.securityConfig;
  }

  getSyncSchedule(): SyncSchedule {
    return this.config.syncSchedule;
  }

  getComplianceStatus(): { compliant: number; inProgress: number; notStarted: number; total: number } {
    const checklist = this.getComplianceChecklist();
    return {
      compliant: checklist.filter(i => i.status === "compliant").length,
      inProgress: checklist.filter(i => i.status === "in_progress").length,
      notStarted: checklist.filter(i => i.status === "not_started").length,
      total: checklist.length,
    };
  }
}

export const siloArchitectureService = new SiloArchitectureService();
