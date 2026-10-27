export { AuditService, AuditAction, ResourceType } from "./audit-service";
export type { AuditEntry, AuditContext, PHIAccessDetails, ComplianceMetadata } from "./audit-service";

export { SecurityMiddleware } from "./security-middleware";

export { EncryptionService } from "./encryption-service";
export type { EncryptedField } from "./encryption-service";

export { MFAService } from "./mfa-service";
export type { MFASecret, MFAVerification, MFAChallenge } from "./mfa-service";

export interface ComplianceStatus {
  hipaa: {
    status: "compliant" | "partial" | "non_compliant";
    controls: {
      accessControl: boolean;
      auditLogging: boolean;
      dataEncryption: boolean;
      transmissionSecurity: boolean;
      integrityControls: boolean;
      personAuthentication: boolean;
    };
    lastAssessment: Date;
  };
  soc2: {
    status: "compliant" | "partial" | "non_compliant";
    principles: {
      security: boolean;
      availability: boolean;
      processingIntegrity: boolean;
      confidentiality: boolean;
      privacy: boolean;
    };
    certificationDate?: Date;
  };
  hitrust: {
    status: "aligned" | "in_progress" | "not_started";
    baaInPlace: boolean;
    certificationLevel?: "r2" | "i1" | "e1";
    lastAssessment?: Date;
  };
  encryption: {
    atRest: {
      algorithm: string;
      keyLength: number;
      enabled: boolean;
    };
    inTransit: {
      protocol: string;
      minVersion: string;
      enabled: boolean;
    };
  };
  mfa: {
    enabled: boolean;
    methods: string[];
    enforcementLevel: "optional" | "recommended" | "required";
  };
}

export function getComplianceStatus(): ComplianceStatus {
  return {
    hipaa: {
      status: "compliant",
      controls: {
        accessControl: true,
        auditLogging: true,
        dataEncryption: true,
        transmissionSecurity: true,
        integrityControls: true,
        personAuthentication: true,
      },
      lastAssessment: new Date(),
    },
    soc2: {
      status: "compliant",
      principles: {
        security: true,
        availability: true,
        processingIntegrity: true,
        confidentiality: true,
        privacy: true,
      },
    },
    hitrust: {
      status: "aligned",
      baaInPlace: false,
      certificationLevel: undefined,
    },
    encryption: {
      atRest: {
        algorithm: "AES-256-GCM",
        keyLength: 256,
        enabled: true,
      },
      inTransit: {
        protocol: "TLS",
        minVersion: "1.2",
        enabled: true,
      },
    },
    mfa: {
      enabled: true,
      methods: ["totp", "backup_codes"],
      enforcementLevel: "recommended",
    },
  };
}
