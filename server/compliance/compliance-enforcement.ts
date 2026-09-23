/**
 * Compliance Enforcement Middleware
 * Enforces HIPAA/SOC2 controls and disables CDS features
 */

import type { Request, Response, NextFunction } from "express";
import {
  defaultComplianceConfig,
  isCDSFeatureEnabled,
  getCDSDisabledMessage,
  type ComplianceConfig
} from "@shared/compliance-controls";
import { redactPhiFromObject } from "../security/phi-safe-logger";

let complianceConfig: ComplianceConfig = defaultComplianceConfig;

export function setComplianceConfig(config: ComplianceConfig) {
  complianceConfig = config;
}

export function getComplianceConfig(): ComplianceConfig {
  return complianceConfig;
}

/**
 * Middleware to block CDS endpoints
 */
export function blockCDSEndpoint(featureName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isCDSFeatureEnabled(featureName, complianceConfig)) {
      console.log(`[Compliance] CDS feature blocked: ${featureName}`);
      return res.status(403).json({
        error: "Feature Disabled",
        message: getCDSDisabledMessage(),
        feature: featureName,
        complianceReason: "Clinical decision support features are disabled per platform configuration",
      });
    }
    next();
  };
}

/**
 * Middleware to enforce HSTS headers
 */
export function enforceSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  if (complianceConfig.hipaa.enabled) {
    res.setHeader("Strict-Transport-Security", `max-age=31536000; includeSubDomains; preload`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // microphone=(self) — the voice intake UX needs getUserMedia. Kept consistent
    // with the other Permissions-Policy writers (mobile-security, tls-middleware,
    // compliance-headers) so mic is enabled regardless of middleware order.
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  }
  next();
}

/**
 * Middleware to enforce session timeout
 */
export function enforceSessionTimeout(req: Request, res: Response, next: NextFunction) {
  if (!complianceConfig.hipaa.enabled) {
    return next();
  }

  const session = req.session as any;
  if (session && session.lastActivity) {
    const idleTime = (Date.now() - session.lastActivity) / 1000 / 60;
    if (idleTime > complianceConfig.hipaa.sessionTimeoutMinutes) {
      console.log(`[Compliance] Session timeout exceeded for user ${session.userId}`);
      session.destroy((err: any) => {
        if (err) console.error("[Compliance] Session destroy error:", err);
      });
      return res.status(401).json({
        error: "Session Expired",
        message: "Your session has expired due to inactivity. Please log in again.",
        code: "SESSION_TIMEOUT",
      });
    }
    session.lastActivity = Date.now();
  }
  next();
}

/**
 * Audit log helper for compliance events
 */
export async function logComplianceEvent(
  eventType: string,
  details: Record<string, unknown>,
  req?: Request
) {
  const logEntry = {
    eventType,
    timestamp: new Date().toISOString(),
    userId: (req?.session as any)?.userId || null,
    ipAddress: req?.ip || null,
    userAgent: req?.headers["user-agent"] || null,
    // P0-7.4: redact PHI from caller-supplied details before it hits the logs.
    details: redactPhiFromObject(details),
    complianceCategories: ["hipaa", "soc2"] as const,
  };
  
  console.log(`[Compliance Audit] ${eventType}:`, JSON.stringify(logEntry));
  
  return logEntry;
}

/**
 * CDS feature names for route blocking
 */
export const CDSFeatures = {
  SYMPTOM_TRIAGE: "symptom_triage",
  DIFFERENTIAL_DIAGNOSIS: "differential_diagnosis",
  TREATMENT_RECOMMENDATIONS: "treatment_recommendations",
  DRUG_INTERACTION_ALERTS: "drug_interaction_alerts",
  MEDICATION_SAFETY_ALERTS: "medication_safety_alerts",
  PREDICTIVE_HEALTH: "predictive_health",
  RISK_STRATIFICATION_CLINICAL: "risk_stratification_clinical",
  CARE_GAP_ANALYSIS: "care_gap_analysis",
  AI_CARE_PLAN_AUTOMATION: "ai_care_plan_automation",
  MEDICAL_ASSISTANT: "medical_assistant",
  PROACTIVE_HEALTH_ALERTS: "proactive_health_alerts",
} as const;

/**
 * Get compliance status summary
 */
export function getComplianceStatus() {
  return {
    hipaaEnabled: complianceConfig.hipaa.enabled,
    soc2Enabled: complianceConfig.soc2.enabled,
    cdsEnabled: complianceConfig.clinicalDecisionSupport.enabled,
    disabledCDSFeatures: complianceConfig.clinicalDecisionSupport.disabledFeatures,
    encryptionRequired: complianceConfig.hipaa.phiEncryptionRequired,
    mfaRequired: complianceConfig.hipaa.mfaRequired,
    auditRetentionDays: complianceConfig.hipaa.auditRetentionDays,
    sessionTimeoutMinutes: complianceConfig.hipaa.sessionTimeoutMinutes,
  };
}

console.log("[Compliance] Enforcement module loaded with CDS disabled");
