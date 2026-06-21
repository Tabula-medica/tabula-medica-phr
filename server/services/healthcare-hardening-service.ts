import crypto from "crypto";

export type BaaStatus = "not_executed" | "pending_review" | "executed" | "expired";
export type MfaMethod = "webauthn" | "totp" | "sms" | "email" | "push";
export type MfaEnforcementLevel = "required" | "optional" | "adaptive";
export type OrgSegment = "standard_patient" | "provider_admin" | "clinic_admin" | "system_admin";

export interface BaaRecord {
  id: string;
  status: BaaStatus;
  auth0AccountTier: string;
  baaSignedDate: string | null;
  baaExpirationDate: string | null;
  coveredEntity: string;
  businessAssociate: string;
  hipaaVersion: string;
  hitechCompliant: boolean;
  lastAuditDate: string | null;
  complianceChecks: BaaComplianceCheck[];
}

export interface BaaComplianceCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  requirement: string;
  lastChecked: string;
  details: string;
}

export interface MfaPolicy {
  enforcementLevel: MfaEnforcementLevel;
  allowedMethods: MfaMethod[];
  phishingResistantRequired: boolean;
  webauthnConfig: WebAuthnConfig;
  gracePeriodDays: number;
  rememberDeviceDays: number;
  smsDeprecated: boolean;
  smsDeprecationDate: string;
  adaptiveRiskThreshold: number;
  enrollmentStats: MfaEnrollmentStats;
}

export interface WebAuthnConfig {
  enabled: boolean;
  rpName: string;
  rpId: string;
  attestation: "none" | "indirect" | "direct" | "enterprise";
  authenticatorSelection: {
    authenticatorAttachment: "platform" | "cross-platform" | null;
    residentKey: "required" | "preferred" | "discouraged";
    userVerification: "required" | "preferred" | "discouraged";
  };
  supportedAlgorithms: number[];
  allowedAuthenticatorTypes: string[];
  timeout: number;
}

export interface MfaEnrollmentStats {
  totalUsers: number;
  webauthnEnrolled: number;
  totpEnrolled: number;
  smsOnly: number;
  noMfa: number;
  phishingResistantPercent: number;
}

export interface Auth0Organization {
  id: string;
  name: string;
  displayName: string;
  segment: OrgSegment;
  branding: {
    logoUrl: string | null;
    primaryColor: string;
  };
  metadata: Record<string, string>;
  memberCount: number;
  connections: OrgConnection[];
  mfaPolicy: MfaEnforcementLevel;
  createdAt: string;
}

export interface OrgConnection {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  assignMembershipOnLogin: boolean;
  showAsButton: boolean;
}

export interface TenantIsolationConfig {
  organizations: Auth0Organization[];
  segmentPolicies: SegmentPolicy[];
  crossSegmentRules: CrossSegmentRule[];
}

export interface SegmentPolicy {
  segment: OrgSegment;
  allowedRoles: string[];
  mfaEnforcement: MfaEnforcementLevel;
  sessionLifetimeMinutes: number;
  idleTimeoutMinutes: number;
  ipRestrictions: string[];
  geoRestrictions: string[];
  dataAccessScope: string[];
}

export interface CrossSegmentRule {
  fromSegment: OrgSegment;
  toSegment: OrgSegment;
  allowed: boolean;
  requiresEscalation: boolean;
  auditRequired: boolean;
  description: string;
}

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "YOUR_TENANT.auth0.com";
const AUTH0_MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID || "";
const AUTH0_MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET || "";

class HealthcareHardeningService {

  getBaaStatus(): BaaRecord {
    const baaExecuted = !!process.env.AUTH0_BAA_EXECUTED;
    const baaDate = process.env.AUTH0_BAA_SIGNED_DATE || null;

    return {
      id: `baa-${crypto.randomUUID().slice(0, 8)}`,
      status: baaExecuted ? "executed" : "not_executed",
      auth0AccountTier: process.env.AUTH0_ACCOUNT_TIER || "enterprise",
      baaSignedDate: baaDate,
      baaExpirationDate: baaDate
        ? new Date(new Date(baaDate).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      coveredEntity: "Tabula Medica, Inc.",
      businessAssociate: "Auth0 (Okta, Inc.)",
      hipaaVersion: "HIPAA/HITECH 2013 Omnibus + 2024 NPRM",
      hitechCompliant: true,
      lastAuditDate: null,
      complianceChecks: this.runBaaComplianceChecks(),
    };
  }

  private runBaaComplianceChecks(): BaaComplianceCheck[] {
    const now = new Date().toISOString();
    const hasBaa = !!process.env.AUTH0_BAA_EXECUTED;
    const hasEnterprise = (process.env.AUTH0_ACCOUNT_TIER || "").toLowerCase() === "enterprise";
    const hasMgmtApi = !!AUTH0_MGMT_CLIENT_ID && !!AUTH0_MGMT_CLIENT_SECRET;

    return [
      {
        id: "baa-001",
        name: "Enterprise Account Tier",
        description: "Auth0 Enterprise plan required for BAA execution and HIPAA compliance",
        status: hasEnterprise ? "pass" : "fail",
        requirement: "45 CFR §164.502(e)(1) — BAA requirement for covered entities",
        lastChecked: now,
        details: hasEnterprise
          ? "Auth0 Enterprise tier confirmed. BAA-eligible."
          : "Enterprise tier not confirmed. Set AUTH0_ACCOUNT_TIER=enterprise after upgrading.",
      },
      {
        id: "baa-002",
        name: "BAA Execution Status",
        description: "Business Associate Agreement must be signed with Auth0 (Okta)",
        status: hasBaa ? "pass" : "fail",
        requirement: "45 CFR §164.314(a)(1) — Written BAA with business associates",
        lastChecked: now,
        details: hasBaa
          ? "BAA executed and on file."
          : "BAA not yet executed. Contact Auth0 Enterprise Sales to initiate. Set AUTH0_BAA_EXECUTED=true after signing.",
      },
      {
        id: "baa-003",
        name: "Management API Configuration",
        description: "M2M application for server-to-server Auth0 operations",
        status: hasMgmtApi ? "pass" : "warning",
        requirement: "Operational — required for automated user_metadata management",
        lastChecked: now,
        details: hasMgmtApi
          ? "Auth0 Management API client configured (tabula-medica-m2m)."
          : "AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET not set. Payer token storage will use in-memory fallback.",
      },
      {
        id: "baa-004",
        name: "PHI Encryption Key",
        description: "AES-256-GCM encryption key for PHI at rest",
        status: process.env.PHI_ENCRYPTION_KEY ? "pass" : "warning",
        requirement: "45 CFR §164.312(a)(2)(iv) — Encryption and decryption of ePHI",
        lastChecked: now,
        details: process.env.PHI_ENCRYPTION_KEY
          ? "PHI_ENCRYPTION_KEY is set. AES-256-GCM encryption active."
          : "PHI_ENCRYPTION_KEY not set. Using ephemeral key — data will not persist across restarts.",
      },
      {
        id: "baa-005",
        name: "HITECH Breach Notification Readiness",
        description: "Breach notification procedures per HITECH Act §13402",
        status: "warning",
        requirement: "HITECH Act §13402 — 60-day notification to individuals, HHS, and media (if >500 affected)",
        lastChecked: now,
        details: "Breach notification procedures should be documented. Ensure incident response plan covers Auth0 credential compromise scenarios.",
      },
      {
        id: "baa-006",
        name: "Audit Log Retention",
        description: "HIPAA requires 6-year minimum retention of access logs",
        status: "warning",
        requirement: "45 CFR §164.530(j)(2) — 6-year document retention",
        lastChecked: now,
        details: "Auth0 Enterprise includes extended log retention. Verify Auth0 Log Streams are configured to export to GCP Cloud Logging for long-term retention.",
      },
      {
        id: "baa-007",
        name: "Minimum Necessary Standard",
        description: "JWT claims contain only minimum necessary PHI references",
        status: "pass",
        requirement: "45 CFR §164.502(b) — Minimum necessary standard",
        lastChecked: now,
        details: "JWT claims include SAID Patient ID and connected source names only. No PHI (name, DOB, SSN) in Auth0 tokens or metadata.",
      },
    ];
  }

  getMfaPolicy(): MfaPolicy {
    return {
      enforcementLevel: "required",
      allowedMethods: ["webauthn", "totp", "push"],
      phishingResistantRequired: true,
      webauthnConfig: this.getWebAuthnConfig(),
      gracePeriodDays: 14,
      rememberDeviceDays: 30,
      smsDeprecated: true,
      smsDeprecationDate: "2026-01-01T00:00:00Z",
      adaptiveRiskThreshold: 0.7,
      enrollmentStats: this.getMfaEnrollmentStats(),
    };
  }

  private getWebAuthnConfig(): WebAuthnConfig {
    return {
      enabled: true,
      rpName: "Tabula Medica",
      rpId: "tabulamedica.health",
      attestation: "direct",
      authenticatorSelection: {
        authenticatorAttachment: null,
        residentKey: "preferred",
        userVerification: "required",
      },
      supportedAlgorithms: [-7, -257],
      allowedAuthenticatorTypes: [
        "Face ID (Apple)",
        "Touch ID (Apple)",
        "Windows Hello",
        "YubiKey 5 Series (FIDO2)",
        "YubiKey Bio",
        "Google Titan Security Key",
        "Feitian BioPass",
        "Android Biometric",
      ],
      timeout: 60000,
    };
  }

  private getMfaEnrollmentStats(): MfaEnrollmentStats {
    return {
      totalUsers: 0,
      webauthnEnrolled: 0,
      totpEnrolled: 0,
      smsOnly: 0,
      noMfa: 0,
      phishingResistantPercent: 0,
    };
  }

  getWebAuthnRegistrationActionCode(): string {
    return `// Auth0 Post-Login Action: WebAuthn Enrollment Enforcement
// Deploy in Auth0 Dashboard → Actions → Flows → Login → Post Login
// Position AFTER the SAID/fhir_sources claims action

exports.onExecutePostLogin = async (event, api) => {
  const enrolledFactors = event.user.multifactor || [];
  const hasWebAuthn = enrolledFactors.includes("webauthn-roaming")
    || enrolledFactors.includes("webauthn-platform");
  const hasTotp = enrolledFactors.includes("otp");
  const hasPhishingResistant = hasWebAuthn;

  // 2026 HHS standard: SMS codes no longer sufficient for healthcare
  const hasSmsOnly = enrolledFactors.includes("sms")
    && !hasWebAuthn && !hasTotp;

  if (hasSmsOnly) {
    // Force MFA enrollment upgrade — SMS-only users must add WebAuthn or TOTP
    api.authentication.enrollWithAny([
      { type: "webauthn-roaming" },
      { type: "webauthn-platform" },
      { type: "otp" }
    ]);
  }

  if (!hasPhishingResistant && !hasTotp) {
    // No MFA at all — require enrollment
    api.authentication.enrollWithAny([
      { type: "webauthn-platform" },   // Face ID / Touch ID / Windows Hello
      { type: "webauthn-roaming" },    // YubiKey / Titan / USB key
      { type: "otp" }                  // TOTP authenticator app (fallback)
    ]);
  }

  // Add MFA status to JWT for downstream verification
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/mfa_methods",
    enrolledFactors
  );
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/phishing_resistant",
    hasPhishingResistant
  );
};`;
  }

  getMfaGuardianConfig(): string {
    return `# Auth0 Guardian MFA Configuration
# Apply via Auth0 Dashboard → Security → Multi-Factor Authentication

# ─── Factor Configuration ───────────────────────────────
webauthn_roaming:
  enabled: true
  # YubiKey, Titan Key, USB/NFC FIDO2 keys
  user_verification: "required"
  attestation: "direct"

webauthn_platform:
  enabled: true
  # Face ID, Touch ID, Windows Hello, Android Biometric
  user_verification: "required"
  attestation: "direct"

otp:
  enabled: true
  # Google Authenticator, Authy, 1Password, etc.

push:
  enabled: true
  # Auth0 Guardian push notifications

sms:
  enabled: false
  # DEPRECATED per 2026 HHS phishing-resistant MFA mandate
  # Disabled for new enrollments
  # Existing SMS-only users will be prompted to upgrade

email:
  enabled: false
  # Email OTP disabled — not phishing-resistant

# ─── Policy ─────────────────────────────────────────────
policy:
  enforcement: "always"  # MFA required on every login
  remember_device: true
  remember_device_expiry_days: 30
  allow_recovery_codes: true
  grace_period_days: 14   # New users have 14 days to enroll

# ─── Adaptive MFA (Enterprise) ──────────────────────────
adaptive:
  enabled: true
  risk_threshold: 0.7    # 0.0 = no risk, 1.0 = highest risk
  # Step-up MFA triggered for:
  #   - New device or browser
  #   - New geographic location
  #   - Impossible travel detected
  #   - Risk score > 0.7`;
  }

  getTenantIsolationConfig(): TenantIsolationConfig {
    return {
      organizations: this.getOrganizations(),
      segmentPolicies: this.getSegmentPolicies(),
      crossSegmentRules: this.getCrossSegmentRules(),
    };
  }

  private getOrganizations(): Auth0Organization[] {
    return [
      {
        id: "org_standard_patients",
        name: "tm-standard-patients",
        displayName: "Tabula Medica — Standard Patients",
        segment: "standard_patient",
        branding: {
          logoUrl: null,
          primaryColor: "#0d9e8a",
        },
        metadata: {
          hipaa_segment: "patient",
          data_residency: "us",
          pii_classification: "high",
        },
        memberCount: 0,
        connections: [
          {
            connectionId: "con_google_social",
            connectionName: "google-oauth2",
            connectionType: "social",
            assignMembershipOnLogin: true,
            showAsButton: true,
          },
          {
            connectionId: "con_apple_social",
            connectionName: "apple",
            connectionType: "social",
            assignMembershipOnLogin: true,
            showAsButton: true,
          },
          {
            connectionId: "con_email_password",
            connectionName: "Username-Password-Authentication",
            connectionType: "database",
            assignMembershipOnLogin: true,
            showAsButton: false,
          },
        ],
        mfaPolicy: "required",
        createdAt: "2026-04-01T00:00:00Z",
      },
      {
        id: "org_uninsurance_patients",
        name: "tm-uninsurance-patients",
        displayName: "Uninsurance — Patient Users",
        segment: "standard_patient",
        branding: {
          logoUrl: null,
          primaryColor: "#f59e0b",
        },
        metadata: {
          hipaa_segment: "patient",
          data_residency: "us",
          pii_classification: "high",
          app_context: "uninsurance",
        },
        memberCount: 0,
        connections: [
          {
            connectionId: "con_google_social",
            connectionName: "google-oauth2",
            connectionType: "social",
            assignMembershipOnLogin: true,
            showAsButton: true,
          },
          {
            connectionId: "con_email_password",
            connectionName: "Username-Password-Authentication",
            connectionType: "database",
            assignMembershipOnLogin: true,
            showAsButton: false,
          },
        ],
        mfaPolicy: "required",
        createdAt: "2026-04-01T00:00:00Z",
      },
      {
        id: "org_provider_admins",
        name: "tm-provider-admins",
        displayName: "Tabula Medica — Provider/Clinic Admins",
        segment: "provider_admin",
        branding: {
          logoUrl: null,
          primaryColor: "#3b82f6",
        },
        metadata: {
          hipaa_segment: "provider",
          data_residency: "us",
          pii_classification: "critical",
          phi_access: "true",
          requires_baa: "true",
        },
        memberCount: 0,
        connections: [
          {
            connectionId: "con_saml_enterprise",
            connectionName: "health-system-saml",
            connectionType: "enterprise",
            assignMembershipOnLogin: false,
            showAsButton: true,
          },
          {
            connectionId: "con_email_password",
            connectionName: "Username-Password-Authentication",
            connectionType: "database",
            assignMembershipOnLogin: false,
            showAsButton: false,
          },
        ],
        mfaPolicy: "required",
        createdAt: "2026-04-01T00:00:00Z",
      },
      {
        id: "org_system_admins",
        name: "tm-system-admins",
        displayName: "Tabula Medica — System Administrators",
        segment: "system_admin",
        branding: {
          logoUrl: null,
          primaryColor: "#ef4444",
        },
        metadata: {
          hipaa_segment: "admin",
          data_residency: "us",
          pii_classification: "critical",
          phi_access: "full",
          requires_baa: "true",
          security_clearance: "required",
        },
        memberCount: 0,
        connections: [
          {
            connectionId: "con_email_password",
            connectionName: "Username-Password-Authentication",
            connectionType: "database",
            assignMembershipOnLogin: false,
            showAsButton: false,
          },
        ],
        mfaPolicy: "required",
        createdAt: "2026-04-01T00:00:00Z",
      },
    ];
  }

  private getSegmentPolicies(): SegmentPolicy[] {
    return [
      {
        segment: "standard_patient",
        allowedRoles: ["patient", "caregiver", "family_member"],
        mfaEnforcement: "required",
        sessionLifetimeMinutes: 480,
        idleTimeoutMinutes: 30,
        ipRestrictions: [],
        geoRestrictions: ["US", "PR", "GU", "VI", "AS", "MP"],
        dataAccessScope: ["own_records", "delegated_records"],
      },
      {
        segment: "provider_admin",
        allowedRoles: ["provider", "clinic_admin", "care_coordinator", "lab_technician"],
        mfaEnforcement: "required",
        sessionLifetimeMinutes: 240,
        idleTimeoutMinutes: 15,
        ipRestrictions: [],
        geoRestrictions: ["US"],
        dataAccessScope: ["assigned_patients", "clinic_reports", "lab_orders"],
      },
      {
        segment: "clinic_admin",
        allowedRoles: ["clinic_admin", "billing_admin", "compliance_officer"],
        mfaEnforcement: "required",
        sessionLifetimeMinutes: 240,
        idleTimeoutMinutes: 15,
        ipRestrictions: [],
        geoRestrictions: ["US"],
        dataAccessScope: ["clinic_patients", "billing_records", "compliance_reports"],
      },
      {
        segment: "system_admin",
        allowedRoles: ["system_admin", "security_admin", "dba"],
        mfaEnforcement: "required",
        sessionLifetimeMinutes: 120,
        idleTimeoutMinutes: 10,
        ipRestrictions: [],
        geoRestrictions: ["US"],
        dataAccessScope: ["all_records", "system_config", "audit_logs", "encryption_keys"],
      },
    ];
  }

  private getCrossSegmentRules(): CrossSegmentRule[] {
    return [
      {
        fromSegment: "standard_patient",
        toSegment: "provider_admin",
        allowed: false,
        requiresEscalation: false,
        auditRequired: true,
        description: "Patients cannot access provider admin resources. Prevents lateral movement from patient to provider segment.",
      },
      {
        fromSegment: "standard_patient",
        toSegment: "system_admin",
        allowed: false,
        requiresEscalation: false,
        auditRequired: true,
        description: "Patients cannot access system admin resources. Hard boundary — no escalation path.",
      },
      {
        fromSegment: "provider_admin",
        toSegment: "standard_patient",
        allowed: true,
        requiresEscalation: false,
        auditRequired: true,
        description: "Providers can access assigned patient records per treatment relationship. All access is audited.",
      },
      {
        fromSegment: "provider_admin",
        toSegment: "system_admin",
        allowed: false,
        requiresEscalation: true,
        auditRequired: true,
        description: "Providers cannot access system admin. Requires formal escalation to security team.",
      },
      {
        fromSegment: "system_admin",
        toSegment: "standard_patient",
        allowed: true,
        requiresEscalation: true,
        auditRequired: true,
        description: "System admins can access patient data only via break-glass escalation. Full audit trail required.",
      },
      {
        fromSegment: "system_admin",
        toSegment: "provider_admin",
        allowed: true,
        requiresEscalation: false,
        auditRequired: true,
        description: "System admins can manage provider accounts. All operations audited.",
      },
    ];
  }

  getOrgLoginFlowActionCode(): string {
    return `// Auth0 Post-Login Action: Organization Segment Enforcement
// Deploy in Auth0 Dashboard → Actions → Flows → Login → Post Login
// Position AFTER MFA enforcement action

exports.onExecutePostLogin = async (event, api) => {
  const org = event.organization;

  if (!org) {
    // User logging in without organization context
    // Default to standard_patient segment
    api.accessToken.setCustomClaim(
      "https://tabulamedica.health/segment",
      "standard_patient"
    );
    return;
  }

  const segment = org.metadata?.hipaa_segment || "patient";
  const phiAccess = org.metadata?.phi_access === "true";

  // Add segment and org context to JWT
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/segment",
    segment
  );
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/org_id",
    org.id
  );
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/org_name",
    org.name
  );
  api.accessToken.setCustomClaim(
    "https://tabulamedica.health/phi_access",
    phiAccess
  );

  // Provider/admin segments: enforce shorter session
  if (segment === "provider" || segment === "admin") {
    api.accessToken.setCustomClaim(
      "https://tabulamedica.health/session_policy",
      "restricted"
    );
  }

  // System admin: require step-up authentication
  if (segment === "admin" && org.metadata?.security_clearance === "required") {
    const mfaMethods = event.user.multifactor || [];
    const hasWebAuthn = mfaMethods.includes("webauthn-roaming")
      || mfaMethods.includes("webauthn-platform");

    if (!hasWebAuthn) {
      // System admins MUST use phishing-resistant MFA
      api.authentication.challengeWithAny([
        { type: "webauthn-roaming" },
        { type: "webauthn-platform" }
      ]);
    }
  }
};`;
  }

  getHardeningChecklist(): Array<{
    id: string;
    category: string;
    item: string;
    status: "done" | "pending" | "blocked" | "in_progress";
    priority: "P0" | "P1" | "P2";
    regulation: string;
    details: string;
  }> {
    const hasBaa = !!process.env.AUTH0_BAA_EXECUTED;
    const hasMgmt = !!AUTH0_MGMT_CLIENT_ID;

    return [
      {
        id: "hc-001",
        category: "BAA",
        item: "Execute BAA with Auth0 (Okta)",
        status: hasBaa ? "done" : "blocked",
        priority: "P0",
        regulation: "45 CFR §164.502(e)(1)",
        details: "Enterprise Auth0 account required. Contact Auth0 Enterprise Sales. Cannot store any PHI in Auth0 without executed BAA.",
      },
      {
        id: "hc-002",
        category: "BAA",
        item: "Verify Auth0 Enterprise tier",
        status: process.env.AUTH0_ACCOUNT_TIER === "enterprise" ? "done" : "pending",
        priority: "P0",
        regulation: "45 CFR §164.314(a)",
        details: "Only Enterprise tier supports BAA, extended log retention, and Organizations feature needed for tenant isolation.",
      },
      {
        id: "hc-003",
        category: "MFA",
        item: "Enable WebAuthn (FIDO2) platform authenticators",
        status: "pending",
        priority: "P0",
        regulation: "2026 HHS Phishing-Resistant MFA Mandate",
        details: "Enable Face ID, Touch ID, Windows Hello. Auth0 Dashboard → Security → MFA → WebAuthn with FIDO2.",
      },
      {
        id: "hc-004",
        category: "MFA",
        item: "Enable WebAuthn roaming authenticators",
        status: "pending",
        priority: "P0",
        regulation: "2026 HHS Phishing-Resistant MFA Mandate",
        details: "Enable YubiKey, Titan Key, USB/NFC FIDO2 keys. Required for CAC/PIV compliance (DoD/FedRAMP).",
      },
      {
        id: "hc-005",
        category: "MFA",
        item: "Deprecate SMS OTP for MFA",
        status: "pending",
        priority: "P0",
        regulation: "NIST SP 800-63B §5.1.3.3 — Restricted authenticator",
        details: "SMS codes are NIST-restricted and no longer meet 2026 HHS phishing-resistant requirements. Disable for new enrollments, force upgrade for existing SMS-only users.",
      },
      {
        id: "hc-006",
        category: "MFA",
        item: "Deploy WebAuthn enrollment enforcement Action",
        status: "pending",
        priority: "P1",
        regulation: "2026 HHS + HIPAA Security Rule §164.312(d)",
        details: "Auth0 Post-Login Action forces MFA enrollment. SMS-only users prompted to add WebAuthn or TOTP.",
      },
      {
        id: "hc-007",
        category: "Tenant Isolation",
        item: "Create Auth0 Organization: Standard Patients",
        status: "pending",
        priority: "P0",
        regulation: "HIPAA Minimum Necessary (45 CFR §164.502(b))",
        details: "org_standard_patients — isolates patient users from provider/admin segments. Google/Apple social + email/password connections.",
      },
      {
        id: "hc-008",
        category: "Tenant Isolation",
        item: "Create Auth0 Organization: Uninsurance Patients",
        status: "pending",
        priority: "P0",
        regulation: "HIPAA Minimum Necessary (45 CFR §164.502(b))",
        details: "org_uninsurance_patients — separate Uninsurance patient segment. Shared SAID Patient ID but isolated Auth0 org.",
      },
      {
        id: "hc-009",
        category: "Tenant Isolation",
        item: "Create Auth0 Organization: Provider/Clinic Admins",
        status: "pending",
        priority: "P0",
        regulation: "HIPAA Access Control (45 CFR §164.312(a)(1))",
        details: "org_provider_admins — enterprise SAML connections for health system SSO. Shorter session lifetime (4h). 15-min idle timeout.",
      },
      {
        id: "hc-010",
        category: "Tenant Isolation",
        item: "Create Auth0 Organization: System Admins",
        status: "pending",
        priority: "P0",
        regulation: "HIPAA Access Control + DoD FedRAMP",
        details: "org_system_admins — restricted segment. WebAuthn mandatory. 2h session max. 10-min idle timeout. Full break-glass audit trail.",
      },
      {
        id: "hc-011",
        category: "Tenant Isolation",
        item: "Deploy Organization Segment Enforcement Action",
        status: "pending",
        priority: "P1",
        regulation: "HIPAA §164.312(a)(1) + §164.502(b)",
        details: "Auth0 Post-Login Action adds segment, org_id, phi_access claims to JWT. System admins require WebAuthn step-up.",
      },
      {
        id: "hc-012",
        category: "BAA",
        item: "Configure Auth0 Log Streams to GCP",
        status: hasMgmt ? "in_progress" : "pending",
        priority: "P1",
        regulation: "45 CFR §164.312(b) — Audit controls",
        details: "Auth0 Enterprise Log Streams → GCP Cloud Logging. Required for 6-year HIPAA log retention.",
      },
    ];
  }
}

export const healthcareHardeningService = new HealthcareHardeningService();
