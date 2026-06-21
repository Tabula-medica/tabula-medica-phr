export {
  encryptPhi,
  decryptPhi,
  encryptPhiObject,
  decryptPhiObject,
  hashPhiForSearch,
  generateSecureToken,
  isEncrypted,
  PHI_FIELDS,
  getSecurityStatus,
} from "./phi-encryption";

export {
  redactPhi,
  redactPhiFromObject,
  logger,
  createLogger,
  safeStringify,
  minimizeLogData,
} from "./phi-safe-logger";

export {
  securityHeaders,
  phiCacheHeaders,
  requireHttps,
  checkTlsVersion,
  phiRouteProtection,
  sanitizeRequestLogger,
  getTransportSecurityInfo,
  applySecurityMiddleware,
  PHI_PROTECTED_ROUTES,
  isPhiProtectedRoute,
} from "./tls-middleware";

export {
  sessionTimeoutMiddleware,
  getSessionTimeoutConfig,
  extendSession,
  cleanupExpiredSessions,
  startSessionCleanupScheduler,
  stopSessionCleanupScheduler,
} from "./session-timeout";

export {
  phiAccessAuditMiddleware,
  queryAuditLogs,
  getPatientAccessReport,
  getAuditCompliance,
} from "./hipaa-audit";

export {
  authRateLimiter,
  mfaRateLimiter,
  passwordResetRateLimiter,
  apiRateLimiter,
  helmetMiddleware,
  corsMiddleware,
  productionErrorHandler,
  applyAuthRateLimiting,
} from "./api-protection";

export function getComplianceStatus(): {
  encryption: {
    algorithm: string;
    keyLength: number;
    atRest: boolean;
    inTransit: boolean;
  };
  logging: {
    phiRedaction: boolean;
    auditLogging: boolean;
  };
  transport: {
    tlsMinVersion: string;
    hsts: boolean;
  };
  hipaaCompliant: boolean;
} {
  const isProduction = process.env.NODE_ENV === "production";
  const hasEncryptionKey = !!process.env.PHI_ENCRYPTION_KEY;
  
  return {
    encryption: {
      algorithm: "AES-256-GCM",
      keyLength: 256,
      atRest: true,
      inTransit: true,
    },
    logging: {
      phiRedaction: isProduction || process.env.ENABLE_PHI_REDACTION === "true",
      auditLogging: true,
    },
    transport: {
      tlsMinVersion: "1.2",
      hsts: true,
    },
    hipaaCompliant: isProduction && hasEncryptionKey,
  };
}

export {
  detectPotentialInjection,
  wrapUntrustedContent,
  createSafeSystemPrompt,
} from "./prompt-sanitizer";

export {
  csrfProtection,
  regenerateSession,
} from "./csrf-protection";

export {
  atsSecurityHeaders,
  enforceHttps,
  configurableSessionTimeout,
  securePushNotifications,
  biometricAuth,
  type SessionTimeoutPreferences,
  type SecureNotification,
  type BiometricCredential,
} from "./mobile-security";

export {
  createDeviceSession,
  getUserDeviceSessions,
  revokeSession,
  revokeAllUserSessions,
  revokeAllExceptCurrent,
  refreshTokens_rotate,
  validateAccessToken,
  getSessionStats,
  cleanupExpiredSessions as cleanupDeviceSessions,
  type DeviceSession,
  type TokenPair,
} from "./device-session-service";

export {
  logAuditEvent,
  queryAuditLogs as queryEnhancedAuditLogs,
  getAuditReport,
  verifyAuditIntegrity,
  exportAuditLogs,
  logLoginEvent,
  logShareLinkEvent,
  logCaregiverEvent,
  logExportEvent,
  type AuditLogEntry,
  type AuditEventType,
} from "./enhanced-audit-service";

export {
  tenantIsolationMiddleware,
  requireTenantFeature,
  requireTier,
  enforceTenantMfa,
  enforceTenantIpWhitelist,
  getTenantContext,
  scopeQueryToTenant,
  addTenantScope,
  createTenant,
  getTenant,
  updateTenant,
  listTenants,
  getTenantStats,
  type TenantConfig,
  type TenantContext,
} from "./tenant-isolation-service";

export {
  gcpAuditMiddleware,
  logSecurityEvent,
  logPhiAccess,
  getGcpAuditStatus,
} from "./gcp-audit-logger";

export {
  complianceSecurityHeaders,
} from "./compliance-headers";

export {
  getSOC2Controls,
  getControlsDueForReview,
  getAccessReviews,
  getChangeRecords,
  getIncidents,
  getVendorAssessments,
  getComplianceDashboard,
  generateComplianceReport,
  recordAccessReview,
  recordChange,
  recordIncident,
  addVendorAssessment,
  type SOC2Control,
  type AccessReview,
  type ChangeManagementRecord,
  type IncidentRecord,
  type VendorRiskAssessment,
} from "./soc2-compliance-service";
