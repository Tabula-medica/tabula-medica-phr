/**
 * HIPAA/SOC2 Compliance Controls
 * Centralized configuration for regulatory compliance enforcement
 */

import { z } from "zod";

// ============================================
// SOC2 TRUST SERVICE CRITERIA
// ============================================

export const SOC2TrustCategories = {
  SECURITY: "security",
  AVAILABILITY: "availability",
  PROCESSING_INTEGRITY: "processing_integrity",
  CONFIDENTIALITY: "confidentiality",
  PRIVACY: "privacy",
} as const;

export type SOC2TrustCategory = typeof SOC2TrustCategories[keyof typeof SOC2TrustCategories];

// ============================================
// HIPAA SAFEGUARDS
// ============================================

export const HIPAASafeguardTypes = {
  ADMINISTRATIVE: "administrative",
  PHYSICAL: "physical",
  TECHNICAL: "technical",
} as const;

export type HIPAASafeguardType = typeof HIPAASafeguardTypes[keyof typeof HIPAASafeguardTypes];

// ============================================
// COMPLIANCE CONFIGURATION
// ============================================

export interface ComplianceConfig {
  hipaa: {
    enabled: boolean;
    auditRetentionDays: number;
    phiEncryptionRequired: boolean;
    minimumTLSVersion: "1.2" | "1.3";
    sessionTimeoutMinutes: number;
    mfaRequired: boolean;
    breakTheGlassEnabled: boolean;
    deIdentificationMethod: "safe_harbor" | "expert_determination";
  };
  soc2: {
    enabled: boolean;
    changeManagementLogging: boolean;
    accessReviewFrequencyDays: number;
    incidentResponsePlan: boolean;
    vendorRiskAssessment: boolean;
    dataClassificationRequired: boolean;
  };
  clinicalDecisionSupport: {
    enabled: boolean;
    disabledFeatures: string[];
  };
  audit: {
    logAllPhiAccess: boolean;
    logAuthenticationEvents: boolean;
    logAuthorizationEvents: boolean;
    logDataModifications: boolean;
    logExportEvents: boolean;
    realTimeAlerts: boolean;
  };
}

export const defaultComplianceConfig: ComplianceConfig = {
  hipaa: {
    enabled: true,
    auditRetentionDays: 2555, // 7 years per HIPAA
    phiEncryptionRequired: true,
    minimumTLSVersion: "1.2",
    sessionTimeoutMinutes: 15,
    mfaRequired: true,
    breakTheGlassEnabled: true,
    deIdentificationMethod: "safe_harbor",
  },
  soc2: {
    enabled: true,
    changeManagementLogging: true,
    accessReviewFrequencyDays: 90,
    incidentResponsePlan: true,
    vendorRiskAssessment: true,
    dataClassificationRequired: true,
  },
  clinicalDecisionSupport: {
    enabled: false, // CDS disabled per modernization requirements
    disabledFeatures: [
      "symptom_triage",
      "differential_diagnosis",
      "treatment_recommendations",
      "drug_interaction_alerts",
      "medication_safety_alerts",
      "predictive_health",
      "risk_stratification_clinical",
      "care_gap_analysis",
      "ai_care_plan_automation",
      "medical_assistant",
      "proactive_health_alerts",
    ],
  },
  audit: {
    logAllPhiAccess: true,
    logAuthenticationEvents: true,
    logAuthorizationEvents: true,
    logDataModifications: true,
    logExportEvents: true,
    realTimeAlerts: true,
  },
};

// ============================================
// COMPLIANCE CHECK RESULT
// ============================================

export interface ComplianceCheckResult {
  compliant: boolean;
  category: "hipaa" | "soc2" | "both";
  control: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  remediation?: string;
  timestamp: string;
}

export const complianceCheckResultSchema = z.object({
  compliant: z.boolean(),
  category: z.enum(["hipaa", "soc2", "both"]),
  control: z.string(),
  description: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  remediation: z.string().optional(),
  timestamp: z.string(),
});

// ============================================
// SECURITY HEADERS CONFIGURATION
// ============================================

export interface SecurityHeadersConfig {
  strictTransportSecurity: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  contentSecurityPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  xFrameOptions: "DENY" | "SAMEORIGIN";
  xContentTypeOptions: "nosniff";
  referrerPolicy: string;
  permissionsPolicy: string;
}

export const defaultSecurityHeaders: SecurityHeadersConfig = {
  strictTransportSecurity: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    enabled: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
  },
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()",
};

// ============================================
// ENCRYPTION CONFIGURATION
// ============================================

export interface EncryptionConfig {
  algorithm: "AES-256-GCM" | "AES-256-CBC";
  keyLength: 256;
  ivLength: 12 | 16;
  tagLength: 128;
  keyRotationDays: number;
  atRestEncryption: boolean;
  inTransitEncryption: boolean;
}

export const defaultEncryptionConfig: EncryptionConfig = {
  algorithm: "AES-256-GCM",
  keyLength: 256,
  ivLength: 12,
  tagLength: 128,
  keyRotationDays: 365,
  atRestEncryption: true,
  inTransitEncryption: true,
};

// ============================================
// ACCESS CONTROL CONFIGURATION
// ============================================

export interface AccessControlConfig {
  rbacEnabled: boolean;
  minimumNecessaryEnabled: boolean;
  accessJustificationRequired: boolean;
  sensitiveDataMfaRequired: boolean;
  sessionConcurrencyLimit: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    historyCount: number;
    maxAgeDays: number;
  };
  lockoutPolicy: {
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    resetCounterMinutes: number;
  };
}

export const defaultAccessControlConfig: AccessControlConfig = {
  rbacEnabled: true,
  minimumNecessaryEnabled: true,
  accessJustificationRequired: true,
  sensitiveDataMfaRequired: true,
  sessionConcurrencyLimit: 3,
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    historyCount: 12,
    maxAgeDays: 90,
  },
  lockoutPolicy: {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 30,
    resetCounterMinutes: 15,
  },
};

// ============================================
// AUDIT EVENT TYPES (SOC2/HIPAA)
// ============================================

export const complianceAuditEventTypes = [
  // Authentication events
  "auth_login_success",
  "auth_login_failure",
  "auth_logout",
  "auth_mfa_enabled",
  "auth_mfa_disabled",
  "auth_mfa_verified",
  "auth_password_changed",
  "auth_account_locked",
  "auth_account_unlocked",
  "auth_session_expired",
  "auth_session_revoked",
  
  // Authorization events
  "authz_permission_granted",
  "authz_permission_denied",
  "authz_role_changed",
  "authz_break_the_glass",
  
  // PHI access events
  "phi_viewed",
  "phi_created",
  "phi_updated",
  "phi_deleted",
  "phi_exported",
  "phi_shared",
  "phi_printed",
  
  // Data management events
  "data_backup_created",
  "data_backup_restored",
  "data_archived",
  "data_purged",
  "data_deidentified",
  
  // System events
  "system_config_changed",
  "system_user_created",
  "system_user_modified",
  "system_user_deleted",
  "system_integration_connected",
  "system_integration_disconnected",
  
  // Compliance events
  "compliance_audit_started",
  "compliance_audit_completed",
  "compliance_violation_detected",
  "compliance_policy_updated",
  
  // Change management events (SOC2)
  "change_requested",
  "change_approved",
  "change_rejected",
  "change_implemented",
  "change_rolled_back",
] as const;

export type ComplianceAuditEventType = typeof complianceAuditEventTypes[number];

// ============================================
// COMPLIANCE AUDIT LOG ENTRY
// ============================================

export interface ComplianceAuditLogEntry {
  id: string;
  eventType: ComplianceAuditEventType;
  timestamp: string;
  userId: string | null;
  userRole: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resourceType: string | null;
  resourceId: string | null;
  action: string;
  outcome: "success" | "failure" | "error";
  details: Record<string, unknown>;
  phiAccessed: boolean;
  complianceCategories: ("hipaa" | "soc2")[];
  riskLevel: "low" | "medium" | "high" | "critical";
  retentionEndDate: string;
}

export const complianceAuditLogEntrySchema = z.object({
  id: z.string(),
  eventType: z.enum(complianceAuditEventTypes),
  timestamp: z.string(),
  userId: z.string().nullable(),
  userRole: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  action: z.string(),
  outcome: z.enum(["success", "failure", "error"]),
  details: z.record(z.unknown()),
  phiAccessed: z.boolean(),
  complianceCategories: z.array(z.enum(["hipaa", "soc2"])),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  retentionEndDate: z.string(),
});

// ============================================
// CDS FEATURE CHECK
// ============================================

export function isCDSFeatureEnabled(featureName: string, config: ComplianceConfig = defaultComplianceConfig): boolean {
  if (!config.clinicalDecisionSupport.enabled) {
    return false;
  }
  return !config.clinicalDecisionSupport.disabledFeatures.includes(featureName);
}

export function getCDSDisabledMessage(): string {
  return "Clinical decision support features are disabled in compliance with regulatory requirements. This platform provides health record management and data aggregation without clinical recommendations. Please consult your healthcare provider for medical advice.";
}

// ============================================
// COMPLIANCE STATUS REPORT
// ============================================

export interface ComplianceStatusReport {
  overallStatus: "compliant" | "non_compliant" | "partial";
  hipaaStatus: {
    compliant: boolean;
    controls: ComplianceCheckResult[];
  };
  soc2Status: {
    compliant: boolean;
    trustCategories: Record<SOC2TrustCategory, boolean>;
    controls: ComplianceCheckResult[];
  };
  cdsStatus: {
    enabled: boolean;
    disabledFeatures: string[];
  };
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  generatedAt: string;
}

export function generateComplianceStatusReport(config: ComplianceConfig = defaultComplianceConfig): ComplianceStatusReport {
  const now = new Date().toISOString();
  
  return {
    overallStatus: "compliant",
    hipaaStatus: {
      compliant: config.hipaa.enabled,
      controls: [
        {
          compliant: config.hipaa.phiEncryptionRequired,
          category: "hipaa",
          control: "164.312(a)(2)(iv)",
          description: "Encryption of PHI at rest and in transit",
          severity: "critical",
          timestamp: now,
        },
        {
          compliant: config.hipaa.mfaRequired,
          category: "hipaa",
          control: "164.312(d)",
          description: "Person or entity authentication",
          severity: "high",
          timestamp: now,
        },
        {
          compliant: config.audit.logAllPhiAccess,
          category: "hipaa",
          control: "164.312(b)",
          description: "Audit controls for PHI access",
          severity: "critical",
          timestamp: now,
        },
      ],
    },
    soc2Status: {
      compliant: config.soc2.enabled,
      trustCategories: {
        security: true,
        availability: true,
        processing_integrity: true,
        confidentiality: true,
        privacy: true,
      },
      controls: [
        {
          compliant: config.soc2.changeManagementLogging,
          category: "soc2",
          control: "CC8.1",
          description: "Change management procedures",
          severity: "high",
          timestamp: now,
        },
        {
          compliant: config.soc2.incidentResponsePlan,
          category: "soc2",
          control: "CC7.4",
          description: "Incident response procedures",
          severity: "high",
          timestamp: now,
        },
      ],
    },
    cdsStatus: {
      enabled: config.clinicalDecisionSupport.enabled,
      disabledFeatures: config.clinicalDecisionSupport.disabledFeatures,
    },
    lastAuditDate: null,
    nextAuditDate: null,
    generatedAt: now,
  };
}
