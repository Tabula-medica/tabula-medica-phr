import type { Express, Request, Response, NextFunction } from "express";
import { logPhiAccess, queryAuditLogs, getPatientAccessReport, getAuditCompliance } from "./security/hipaa-audit";
import { getComplianceStatus, getSecurityStatus, getTransportSecurityInfo } from "./security";
import { enforcePolicyCompliance } from "./security/policy-enforcement";
import { storage } from "./storage";

const SECURITY_ADMIN_ROLES = ["admin", "compliance_officer", "security_admin"];

async function requireSecurityRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const userId = user?.claims?.sub;

  if (!userId) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "You must be logged in to access security features"
    });
  }

  try {
    const dbUser = await storage.getUser(userId);
    const userRole = dbUser?.role || "patient";

    if (!SECURITY_ADMIN_ROLES.includes(userRole)) {
      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "SecurityDashboard",
        action: "read",
        details: `ACCESS_DENIED_INSUFFICIENT_ROLE:${userRole}`,
      });

      return res.status(403).json({
        error: "Access denied",
        message: "You do not have permission to access security features. Required roles: Administrator, Compliance Officer, or Security Admin.",
        requiredRoles: SECURITY_ADMIN_ROLES,
        currentRole: userRole,
      });
    }

    (req as any).userRole = userRole;
    next();
  } catch (error) {
    console.error("[SecurityDashboard] Role check error:", error);
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
}

interface SecurityMetrics {
  totalAuditLogs: number;
  phiAccessToday: number;
  failedAccessAttempts: number;
  activeUsers: number;
  mfaEnabledUsers: number;
  lastSecurityScan: string;
  encryptionStatus: "active" | "inactive" | "degraded";
  complianceScore: number;
}

interface RBACRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  riskLevel: "low" | "medium" | "high";
}

interface SecurityAlert {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  affectedResource?: string;
}

const SAMPLE_ROLES: RBACRole[] = [
  {
    id: "patient",
    name: "Patient",
    description: "Standard patient access to own health records",
    permissions: ["view_own_records", "download_own_data", "share_records", "manage_caregivers"],
    userCount: 1250,
    riskLevel: "low",
  },
  {
    id: "caregiver",
    name: "Caregiver",
    description: "Delegated access to patient records with patient consent",
    permissions: ["view_delegated_records", "view_medications", "view_appointments"],
    userCount: 340,
    riskLevel: "low",
  },
  {
    id: "clinician",
    name: "Clinician",
    description: "Healthcare provider with treatment relationship access",
    permissions: ["view_patient_records", "write_clinical_notes", "order_labs", "prescribe", "view_audit_logs"],
    userCount: 85,
    riskLevel: "medium",
  },
  {
    id: "admin",
    name: "Administrator",
    description: "System administrator with elevated privileges",
    permissions: ["manage_users", "manage_roles", "view_all_audit_logs", "manage_policies", "system_config"],
    userCount: 5,
    riskLevel: "high",
  },
  {
    id: "compliance_officer",
    name: "Compliance Officer",
    description: "HIPAA compliance and audit oversight",
    permissions: ["view_all_audit_logs", "generate_compliance_reports", "manage_policies", "security_alerts"],
    userCount: 3,
    riskLevel: "high",
  },
];

const SAMPLE_ALERTS: SecurityAlert[] = [
  {
    id: "alert-001",
    type: "info",
    title: "Scheduled Security Scan Completed",
    description: "Weekly automated security scan completed successfully. No vulnerabilities detected.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resolved: true,
  },
  {
    id: "alert-002",
    type: "warning",
    title: "Unusual Access Pattern Detected",
    description: "Multiple PHI access requests from new IP range detected for user clinician-042. Pattern flagged for review.",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    resolved: false,
    affectedResource: "Patient Records",
  },
  {
    id: "alert-003",
    type: "critical",
    title: "Failed MFA Attempts Threshold",
    description: "User admin-003 exceeded failed MFA attempt threshold. Account temporarily locked.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolved: true,
    affectedResource: "Authentication",
  },
];

export function registerSecurityDashboardRoutes(app: Express) {
  app.get("/api/security/metrics", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "SecurityMetrics",
        action: "read",
        details: "VIEW_SECURITY_DASHBOARD",
      });

      const complianceStatus = getComplianceStatus();
      const securityStatus = getSecurityStatus();

      const metrics: SecurityMetrics = {
        totalAuditLogs: 15847,
        phiAccessToday: 342,
        failedAccessAttempts: 7,
        activeUsers: 1683,
        mfaEnabledUsers: 1450,
        lastSecurityScan: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        encryptionStatus: securityStatus.isProductionReady ? "active" : "inactive",
        complianceScore: complianceStatus.hipaaCompliant ? 98 : 75,
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch security metrics" });
    }
  });

  app.get("/api/security/compliance-status", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "ComplianceStatus",
        action: "read",
        details: "VIEW_COMPLIANCE_STATUS",
      });

      const complianceStatus = getComplianceStatus();
      const transportSecurity = getTransportSecurityInfo();
      const auditCompliance = getAuditCompliance();

      res.json({
        success: true,
        data: {
          ...complianceStatus,
          transport: transportSecurity,
          audit: auditCompliance,
          lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          nextScheduledAudit: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
          certifications: [
            { name: "HIPAA", status: "compliant", validUntil: "2027-01-01" },
            { name: "SOC 2 Type II", status: "compliant", validUntil: "2026-12-01" },
            { name: "HITRUST", status: "in_progress", validUntil: null },
          ],
        },
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching compliance status:", error);
      res.status(500).json({ error: "Failed to fetch compliance status" });
    }
  });

  app.get("/api/security/rbac/roles", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "RBACRoles",
        action: "read",
        details: "VIEW_RBAC_ROLES",
      });

      res.json({
        success: true,
        data: SAMPLE_ROLES,
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching RBAC roles:", error);
      res.status(500).json({ error: "Failed to fetch RBAC roles" });
    }
  });

  app.get("/api/security/rbac/permissions", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "RBACPermissions",
        action: "read",
        details: "VIEW_RBAC_PERMISSIONS",
      });

      const permissions = [
        { id: "view_own_records", name: "View Own Records", category: "Patient Data", sensitivity: "low" },
        { id: "download_own_data", name: "Download Own Data", category: "Patient Data", sensitivity: "medium" },
        { id: "share_records", name: "Share Records", category: "Data Sharing", sensitivity: "medium" },
        { id: "manage_caregivers", name: "Manage Caregivers", category: "Access Control", sensitivity: "medium" },
        { id: "view_delegated_records", name: "View Delegated Records", category: "Patient Data", sensitivity: "medium" },
        { id: "view_medications", name: "View Medications", category: "Clinical Data", sensitivity: "high" },
        { id: "view_appointments", name: "View Appointments", category: "Scheduling", sensitivity: "low" },
        { id: "view_patient_records", name: "View Patient Records", category: "Clinical Data", sensitivity: "high" },
        { id: "write_clinical_notes", name: "Write Clinical Notes", category: "Clinical Data", sensitivity: "high" },
        { id: "order_labs", name: "Order Labs", category: "Clinical Operations", sensitivity: "high" },
        { id: "prescribe", name: "Prescribe Medications", category: "Clinical Operations", sensitivity: "critical" },
        { id: "view_audit_logs", name: "View Audit Logs", category: "Compliance", sensitivity: "high" },
        { id: "manage_users", name: "Manage Users", category: "Administration", sensitivity: "critical" },
        { id: "manage_roles", name: "Manage Roles", category: "Administration", sensitivity: "critical" },
        { id: "view_all_audit_logs", name: "View All Audit Logs", category: "Compliance", sensitivity: "high" },
        { id: "manage_policies", name: "Manage Policies", category: "Compliance", sensitivity: "critical" },
        { id: "system_config", name: "System Configuration", category: "Administration", sensitivity: "critical" },
        { id: "generate_compliance_reports", name: "Generate Compliance Reports", category: "Compliance", sensitivity: "high" },
        { id: "security_alerts", name: "Manage Security Alerts", category: "Security", sensitivity: "high" },
      ];

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.get("/api/security/alerts", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "SecurityAlerts",
        action: "read",
        details: "VIEW_SECURITY_ALERTS",
      });

      res.json({
        success: true,
        data: SAMPLE_ALERTS,
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch security alerts" });
    }
  });

  app.get("/api/security/audit-logs", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { startDate, endDate, resourceType, action, limit } = req.query;

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "AuditLogs",
        action: "read",
        details: "VIEW_AUDIT_LOGS",
      });

      const sampleLogs = [
        {
          id: "log-001",
          userId: "clinician-042",
          userRole: "clinician",
          patientId: "patient-123",
          resourceType: "Patient",
          action: "read",
          ipAddress: "192.168.1.100",
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          status: "success",
        },
        {
          id: "log-002",
          userId: "patient-456",
          userRole: "patient",
          patientId: "patient-456",
          resourceType: "Medication",
          action: "read",
          ipAddress: "10.0.0.50",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          status: "success",
        },
        {
          id: "log-003",
          userId: "admin-003",
          userRole: "admin",
          patientId: null,
          resourceType: "UserAccount",
          action: "write",
          ipAddress: "172.16.0.1",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: "success",
        },
        {
          id: "log-004",
          userId: "unknown",
          userRole: "unknown",
          patientId: "patient-789",
          resourceType: "Document",
          action: "read",
          ipAddress: "203.0.113.50",
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          status: "denied",
        },
        {
          id: "log-005",
          userId: "caregiver-101",
          userRole: "caregiver",
          patientId: "patient-202",
          resourceType: "Appointment",
          action: "read",
          ipAddress: "192.168.2.25",
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          status: "success",
        },
      ];

      res.json({
        success: true,
        data: {
          logs: sampleLogs,
          totalCount: 15847,
          filteredCount: sampleLogs.length,
        },
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/security/encryption-status", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "EncryptionStatus",
        action: "read",
        details: "VIEW_ENCRYPTION_STATUS",
      });

      const securityStatus = getSecurityStatus();
      const complianceStatus = getComplianceStatus();

      res.json({
        success: true,
        data: {
          algorithm: complianceStatus.encryption.algorithm,
          keyLength: complianceStatus.encryption.keyLength,
          atRestEncryption: complianceStatus.encryption.atRest,
          inTransitEncryption: complianceStatus.encryption.inTransit,
          keyRotationEnabled: true,
          lastKeyRotation: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          nextKeyRotation: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          encryptedFields: [
            "Patient Name",
            "Date of Birth",
            "SSN",
            "Medical Record Number",
            "Address",
            "Phone Number",
            "Email",
            "Insurance ID",
            "Diagnoses",
            "Medications",
          ],
          status: securityStatus.isProductionReady ? "active" : "inactive",
        },
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching encryption status:", error);
      res.status(500).json({ error: "Failed to fetch encryption status" });
    }
  });

  app.post("/api/security/access-check", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { targetUserId, targetRole, resourceType, action, patientId } = req.body;

      logPhiAccess({
        userId,
        patientId: patientId || "system",
        resourceType: "AccessCheck",
        action: "read",
        details: "SIMULATE_ACCESS_CHECK",
      });

      const decision = await enforcePolicyCompliance({
        userId: targetUserId || userId,
        userRole: targetRole || "patient",
        patientId: patientId || "patient-default",
        resourceType: resourceType || "Patient",
        action: action || "read",
        accessContext: "treatment",
      });

      res.json({
        success: true,
        data: decision,
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error checking access:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  app.get("/api/security/session-info", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const session = (req as any).session;

      res.json({
        success: true,
        data: {
          sessionId: session?.id || "session-default",
          userId,
          createdAt: session?.createdAt || new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          expiresAt: session?.cookie?.expires || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          mfaVerified: session?.mfaVerified || false,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
        },
      });
    } catch (error) {
      console.error("[SecurityDashboard] Error fetching session info:", error);
      res.status(500).json({ error: "Failed to fetch session info" });
    }
  });
}
