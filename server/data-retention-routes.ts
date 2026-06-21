import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";

export interface DataRetentionPolicy {
  id: string;
  dataType: string;
  displayName: string;
  description: string;
  retentionDays: number;
  legalBasis: string;
  complianceFramework: string;
  isActive: boolean;
  hardDelete: boolean;
  lastCleanupAt: string | null;
  recordsCleanedLast: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_POLICIES: DataRetentionPolicy[] = [
  {
    id: "policy-audit-logs",
    dataType: "audit_logs",
    displayName: "Audit Logs",
    description: "HIPAA requires retention of audit logs for a minimum of 6 years. Extended to 7 years for SOC 2 compliance.",
    retentionDays: 2555,
    legalBasis: "HIPAA §164.312(b) - Audit Controls",
    complianceFramework: "HIPAA, SOC 2",
    isActive: true,
    hardDelete: false,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-patient-records",
    dataType: "patient_records",
    displayName: "Patient Health Records",
    description: "Medical records retained per state regulations (most states require 7-10 years after last encounter, 21 years for minors).",
    retentionDays: 3650,
    legalBasis: "State Medical Record Retention Laws",
    complianceFramework: "HIPAA, State Law",
    isActive: true,
    hardDelete: false,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-session-data",
    dataType: "session_data",
    displayName: "User Sessions",
    description: "Expired session records retained for security analysis before permanent deletion.",
    retentionDays: 90,
    legalBasis: "Security Best Practices",
    complianceFramework: "SOC 2, HITRUST",
    isActive: true,
    hardDelete: true,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-consent-records",
    dataType: "consent_records",
    displayName: "Consent Records",
    description: "Patient consent records retained indefinitely per HIPAA requirements or 7 years after revocation.",
    retentionDays: 2555,
    legalBasis: "HIPAA §164.530(j) - Retention Period",
    complianceFramework: "HIPAA, GDPR",
    isActive: true,
    hardDelete: false,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-communication-logs",
    dataType: "communication_logs",
    displayName: "Communication Logs",
    description: "Secure messaging and communication history retained for clinical record compliance.",
    retentionDays: 2555,
    legalBasis: "HIPAA §164.530(j)",
    complianceFramework: "HIPAA",
    isActive: true,
    hardDelete: false,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-temp-files",
    dataType: "temporary_files",
    displayName: "Temporary Upload Files",
    description: "Temporary files from document processing and uploads cleaned after processing.",
    retentionDays: 7,
    legalBasis: "Data Minimization",
    complianceFramework: "GDPR, HIPAA",
    isActive: true,
    hardDelete: true,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "policy-auth-events",
    dataType: "authentication_events",
    displayName: "Authentication Events",
    description: "Login attempts, MFA events, and access control logs for security monitoring.",
    retentionDays: 365,
    legalBasis: "SOC 2 CC6.1 - Logical Access",
    complianceFramework: "SOC 2, HITRUST",
    isActive: true,
    hardDelete: false,
    lastCleanupAt: null,
    recordsCleanedLast: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const policies = new Map<string, DataRetentionPolicy>(
  DEFAULT_POLICIES.map(p => [p.id, p])
);

const updatePolicySchema = z.object({
  retentionDays: z.number().min(1).max(36500).optional(),
  isActive: z.boolean().optional(),
  hardDelete: z.boolean().optional(),
  description: z.string().optional(),
});

export function registerDataRetentionRoutes(app: Express): void {
  app.get("/api/data-retention/policies", async (_req: Request, res: Response) => {
    try {
      const allPolicies = Array.from(policies.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );
      res.json({ success: true, data: allPolicies });
    } catch (error) {
      console.error("[DataRetention] Error fetching policies:", error);
      res.status(500).json({ success: false, error: "Failed to fetch retention policies" });
    }
  });

  app.get("/api/data-retention/policies/:id", async (req: Request, res: Response) => {
    try {
      const policy = policies.get(req.params.id);
      if (!policy) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }
      res.json({ success: true, data: policy });
    } catch (error) {
      console.error("[DataRetention] Error fetching policy:", error);
      res.status(500).json({ success: false, error: "Failed to fetch retention policy" });
    }
  });

  app.patch("/api/data-retention/policies/:id", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "system";

      const policy = policies.get(req.params.id);
      if (!policy) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }

      const parsed = updatePolicySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid update data", details: parsed.error.flatten() });
      }

      const updates = parsed.data;
      const updatedPolicy = {
        ...policy,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      policies.set(policy.id, updatedPolicy);

      await storage.createSecurityAuditLog({
        userId,
        eventType: "settings_changed",
        description: `Updated data retention policy: ${policy.displayName}`,
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
        metadata: {
          action: "update_retention_policy",
          policyId: policy.id,
          changes: JSON.stringify(updates),
        },
      });

      res.json({ success: true, data: updatedPolicy });
    } catch (error) {
      console.error("[DataRetention] Error updating policy:", error);
      res.status(500).json({ success: false, error: "Failed to update retention policy" });
    }
  });

  app.get("/api/data-retention/summary", async (_req: Request, res: Response) => {
    try {
      const allPolicies = Array.from(policies.values());
      const activePolicies = allPolicies.filter(p => p.isActive);

      const frameworks = new Set<string>();
      allPolicies.forEach(p => {
        p.complianceFramework.split(", ").forEach(f => frameworks.add(f));
      });

      const shortestRetention = Math.min(...activePolicies.map(p => p.retentionDays));
      const longestRetention = Math.max(...activePolicies.map(p => p.retentionDays));

      res.json({
        success: true,
        data: {
          totalPolicies: allPolicies.length,
          activePolicies: activePolicies.length,
          complianceFrameworks: Array.from(frameworks),
          shortestRetentionDays: shortestRetention,
          longestRetentionDays: longestRetention,
          totalRecordsCleaned: allPolicies.reduce((sum, p) => sum + p.recordsCleanedLast, 0),
          lastGlobalCleanup: allPolicies
            .map(p => p.lastCleanupAt)
            .filter(Boolean)
            .sort()
            .pop() || null,
        },
      });
    } catch (error) {
      console.error("[DataRetention] Error fetching summary:", error);
      res.status(500).json({ success: false, error: "Failed to fetch summary" });
    }
  });

  app.post("/api/data-retention/cleanup/dry-run", async (req: Request, res: Response) => {
    try {
      const allPolicies = Array.from(policies.values()).filter(p => p.isActive);
      const results = allPolicies.map(policy => {
        const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
        return {
          policyId: policy.id,
          dataType: policy.dataType,
          displayName: policy.displayName,
          retentionDays: policy.retentionDays,
          cutoffDate: cutoffDate.toISOString(),
          estimatedRecords: 0,
          wouldHardDelete: policy.hardDelete,
        };
      });

      res.json({
        success: true,
        data: {
          isDryRun: true,
          timestamp: new Date().toISOString(),
          policies: results,
        },
      });
    } catch (error) {
      console.error("[DataRetention] Dry run error:", error);
      res.status(500).json({ success: false, error: "Dry run failed" });
    }
  });

  app.post("/api/session/heartbeat", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub;
      if (userId) {
        const sessions = await storage.getUserSessions(userId);
        if (sessions.length > 0) {
          await storage.updateUserSession(sessions[0].id, {
            lastActiveAt: new Date().toISOString(),
          });
        }
      }
      res.json({ success: true, timestamp: Date.now() });
    } catch (error) {
      res.json({ success: true, timestamp: Date.now() });
    }
  });
}

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function startRetentionCleanupScheduler(intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (cleanupIntervalId) return;

  runRetentionCleanup().catch(err =>
    console.error("[DataRetention] Initial cleanup failed:", err)
  );

  cleanupIntervalId = setInterval(() => {
    runRetentionCleanup().catch(err =>
      console.error("[DataRetention] Scheduled cleanup failed:", err)
    );
  }, intervalMs);
  console.log(`[DataRetention] Cleanup scheduler started (every ${Math.floor(intervalMs / 3600000)}h)`);
}

async function runRetentionCleanup(): Promise<void> {
  const activePolicies = Array.from(policies.values()).filter(p => p.isActive);
  let totalCleaned = 0;

  for (const policy of activePolicies) {
    try {
      let cleaned = 0;

      if (policy.dataType === "session_data") {
        const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
        const allSessions = await storage.getAllSessions?.() ?? [];
        for (const session of allSessions) {
          if (new Date(session.lastActiveAt) < cutoff) {
            await storage.deleteUserSession(session.id, session.userId);
            cleaned++;
          }
        }
      }

      const updatedPolicy = {
        ...policy,
        lastCleanupAt: new Date().toISOString(),
        recordsCleanedLast: cleaned,
        updatedAt: new Date().toISOString(),
      };
      policies.set(policy.id, updatedPolicy);
      totalCleaned += cleaned;
    } catch (error) {
      console.error(`[DataRetention] Cleanup error for ${policy.dataType}:`, error);
    }
  }

  if (totalCleaned > 0) {
    console.log(`[DataRetention] Cleanup complete: ${totalCleaned} records processed`);
  }
}
