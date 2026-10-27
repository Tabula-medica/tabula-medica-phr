import { db } from "./db";
import { dataRetentionPolicies, dataRetentionExecutions, healthRecords, auditLogs, phiAuditLogs } from "@shared/schema";
import type { InsertDataRetentionPolicy, DataRetentionPolicy, InsertDataRetentionExecution, DataRetentionExecution } from "@shared/schema";
import { eq, and, desc, lt, sql, lte, isNull } from "drizzle-orm";
import crypto from "crypto";

class DataRetentionService {
  async createPolicy(params: InsertDataRetentionPolicy): Promise<DataRetentionPolicy> {
    const now = new Date();
    const nextScheduled = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [policy] = await db
      .insert(dataRetentionPolicies)
      .values({
        ...params,
        nextScheduledAt: params.nextScheduledAt ?? nextScheduled,
      })
      .returning();

    console.log(`[Retention] Created policy: ${policy.policyName} (${policy.resourceType}, ${policy.retentionDays} days)`);
    return policy;
  }

  async updatePolicy(policyId: string, updates: Partial<InsertDataRetentionPolicy>): Promise<DataRetentionPolicy | null> {
    const [policy] = await db
      .update(dataRetentionPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataRetentionPolicies.id, policyId))
      .returning();

    if (policy) {
      console.log(`[Retention] Updated policy: ${policy.policyName}`);
    }
    return policy ?? null;
  }

  async deletePolicy(policyId: string): Promise<DataRetentionPolicy | null> {
    const [policy] = await db
      .update(dataRetentionPolicies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(dataRetentionPolicies.id, policyId))
      .returning();

    if (policy) {
      console.log(`[Retention] Soft-deleted policy: ${policy.policyName}`);
    }
    return policy ?? null;
  }

  async getPolicy(policyId: string): Promise<DataRetentionPolicy | null> {
    const [policy] = await db
      .select()
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.id, policyId))
      .limit(1);

    return policy ?? null;
  }

  async listPolicies(filters?: {
    resourceType?: string;
    isActive?: boolean;
    complianceFramework?: string;
  }): Promise<DataRetentionPolicy[]> {
    const conditions = [];

    if (filters?.resourceType) {
      conditions.push(eq(dataRetentionPolicies.resourceType, filters.resourceType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(dataRetentionPolicies.isActive, filters.isActive));
    }
    if (filters?.complianceFramework) {
      conditions.push(eq(dataRetentionPolicies.complianceFramework, filters.complianceFramework));
    }

    const query = db.select().from(dataRetentionPolicies);

    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(dataRetentionPolicies.createdAt));
    }

    return query.orderBy(desc(dataRetentionPolicies.createdAt));
  }

  async setLegalHold(policyId: string, reason: string): Promise<DataRetentionPolicy | null> {
    const [policy] = await db
      .update(dataRetentionPolicies)
      .set({
        legalHold: true,
        legalHoldReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(dataRetentionPolicies.id, policyId))
      .returning();

    if (policy) {
      console.log(`[Retention] Legal hold placed on policy: ${policy.policyName} - Reason: ${reason}`);
    }
    return policy ?? null;
  }

  async removeLegalHold(policyId: string): Promise<DataRetentionPolicy | null> {
    const [policy] = await db
      .update(dataRetentionPolicies)
      .set({
        legalHold: false,
        legalHoldReason: null,
        updatedAt: new Date(),
      })
      .where(eq(dataRetentionPolicies.id, policyId))
      .returning();

    if (policy) {
      console.log(`[Retention] Legal hold removed from policy: ${policy.policyName}`);
    }
    return policy ?? null;
  }

  async executePolicy(policyId: string, executedBy?: string): Promise<DataRetentionExecution> {
    const policy = await this.getPolicy(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    if (!policy.isActive) {
      throw new Error(`Policy is inactive: ${policy.policyName}`);
    }

    console.log(`[Retention] Executing policy: ${policy.policyName} (${policy.resourceType})`);

    const startedAt = new Date();
    const [execution] = await db
      .insert(dataRetentionExecutions)
      .values({
        policyId,
        status: "running",
        startedAt,
        executedBy: executedBy ?? "system",
        recordsScanned: 0,
        recordsArchived: 0,
        recordsDeleted: 0,
        recordsRetained: 0,
      })
      .returning();

    let recordsScanned = 0;
    let recordsArchived = 0;
    let recordsDeleted = 0;
    let recordsRetained = 0;
    const errors: Array<{ message: string; timestamp: string }> = [];
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    try {
      const scanResult = await this.scanResourceType(policy.resourceType, cutoffDate);
      recordsScanned = scanResult.total;
      const expiredCount = scanResult.expired;

      if (policy.legalHold) {
        recordsRetained = recordsScanned;
        console.log(`[Retention] Policy ${policy.policyName} is under legal hold - all ${recordsRetained} records retained`);
      } else {
        recordsRetained = recordsScanned - expiredCount;

        if (policy.archiveBeforeDelete && expiredCount > 0) {
          recordsArchived = expiredCount;
          console.log(`[Retention] Archived ${recordsArchived} expired records for policy: ${policy.policyName} (dry-run)`);
        }

        recordsDeleted = expiredCount;
        if (expiredCount > 0) {
          console.log(`[Retention] Identified ${recordsDeleted} records for deletion in policy: ${policy.policyName} (dry-run, no actual deletion)`);
        }
      }

      const completedAt = new Date();
      const nextScheduledAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);

      const [updatedExecution] = await db
        .update(dataRetentionExecutions)
        .set({
          status: "completed",
          recordsScanned,
          recordsArchived,
          recordsDeleted,
          recordsRetained,
          errors: errors.length > 0 ? errors : null,
          completedAt,
        })
        .where(eq(dataRetentionExecutions.id, execution.id))
        .returning();

      await db
        .update(dataRetentionPolicies)
        .set({
          lastExecutedAt: completedAt,
          nextScheduledAt,
          updatedAt: completedAt,
        })
        .where(eq(dataRetentionPolicies.id, policyId));

      console.log(`[Retention] Policy ${policy.policyName} execution complete: scanned=${recordsScanned}, archived=${recordsArchived}, deleted=${recordsDeleted}, retained=${recordsRetained}`);

      return updatedExecution;
    } catch (error: any) {
      errors.push({ message: error.message, timestamp: new Date().toISOString() });

      const [failedExecution] = await db
        .update(dataRetentionExecutions)
        .set({
          status: "failed",
          recordsScanned,
          recordsArchived,
          recordsDeleted,
          recordsRetained,
          errors,
          completedAt: new Date(),
        })
        .where(eq(dataRetentionExecutions.id, execution.id))
        .returning();

      console.error(`[Retention] Policy ${policy.policyName} execution failed: ${error.message}`);
      return failedExecution;
    }
  }

  private async scanResourceType(resourceType: string, cutoffDate: Date): Promise<{ total: number; expired: number }> {
    switch (resourceType) {
      case "health_record": {
        const allRecords = await db.select({ id: healthRecords.id }).from(healthRecords);
        const expiredRecords = await db
          .select({ id: healthRecords.id })
          .from(healthRecords)
          .where(lt(healthRecords.createdAt, cutoffDate));
        return { total: allRecords.length, expired: expiredRecords.length };
      }
      case "audit_log": {
        const allRecords = await db.select({ id: auditLogs.id }).from(auditLogs);
        const expiredRecords = await db
          .select({ id: auditLogs.id })
          .from(auditLogs)
          .where(lt(auditLogs.createdAt, cutoffDate));
        return { total: allRecords.length, expired: expiredRecords.length };
      }
      case "phi_audit_log": {
        const allRecords = await db.select({ id: phiAuditLogs.id }).from(phiAuditLogs);
        const expiredRecords = await db
          .select({ id: phiAuditLogs.id })
          .from(phiAuditLogs)
          .where(lt(phiAuditLogs.createdAt, cutoffDate));
        return { total: allRecords.length, expired: expiredRecords.length };
      }
      default: {
        console.log(`[Retention] Resource type '${resourceType}' does not have a mapped table - returning zero counts`);
        return { total: 0, expired: 0 };
      }
    }
  }

  async executeAllDuePolicies(): Promise<DataRetentionExecution[]> {
    const now = new Date();
    const duePolicies = await db
      .select()
      .from(dataRetentionPolicies)
      .where(
        and(
          eq(dataRetentionPolicies.isActive, true),
          lte(dataRetentionPolicies.nextScheduledAt, now)
        )
      );

    if (duePolicies.length === 0) {
      console.log(`[Retention] No due policies to execute`);
      return [];
    }

    console.log(`[Retention] Found ${duePolicies.length} due policies to execute`);

    const results: DataRetentionExecution[] = [];
    for (const policy of duePolicies) {
      try {
        const execution = await this.executePolicy(policy.id);
        results.push(execution);
      } catch (error: any) {
        console.error(`[Retention] Failed to execute policy ${policy.policyName}: ${error.message}`);
      }
    }

    return results;
  }

  async getExecutionHistory(policyId?: string, limit: number = 50): Promise<DataRetentionExecution[]> {
    if (policyId) {
      return db
        .select()
        .from(dataRetentionExecutions)
        .where(eq(dataRetentionExecutions.policyId, policyId))
        .orderBy(desc(dataRetentionExecutions.createdAt))
        .limit(limit);
    }

    return db
      .select()
      .from(dataRetentionExecutions)
      .orderBy(desc(dataRetentionExecutions.createdAt))
      .limit(limit);
  }

  async getExecutionDetails(executionId: string): Promise<DataRetentionExecution | null> {
    const [execution] = await db
      .select()
      .from(dataRetentionExecutions)
      .where(eq(dataRetentionExecutions.id, executionId))
      .limit(1);

    return execution ?? null;
  }

  async seedDefaultPolicies(): Promise<void> {
    const existing = await db.select().from(dataRetentionPolicies).limit(1);
    if (existing.length > 0) {
      console.log(`[Retention] Default policies already exist, skipping seed`);
      return;
    }

    const defaults: InsertDataRetentionPolicy[] = [
      {
        policyName: "health_records_retention",
        resourceType: "health_record",
        retentionDays: 2555,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "audit_logs_retention",
        resourceType: "audit_log",
        retentionDays: 2555,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "phi_audit_retention",
        resourceType: "phi_audit_log",
        retentionDays: 2555,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "session_data_retention",
        resourceType: "session",
        retentionDays: 90,
        archiveBeforeDelete: false,
        legalHold: false,
        complianceFramework: "SOC2",
        isActive: true,
      },
      {
        policyName: "consent_records_retention",
        resourceType: "consent",
        retentionDays: 3650,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "share_links_retention",
        resourceType: "share_link",
        retentionDays: 365,
        archiveBeforeDelete: false,
        legalHold: false,
        complianceFramework: "SOC2",
        isActive: true,
      },
      {
        policyName: "mfa_credentials_retention",
        resourceType: "mfa_credential",
        retentionDays: 730,
        archiveBeforeDelete: false,
        legalHold: false,
        complianceFramework: "SOC2",
        isActive: true,
      },
      {
        policyName: "clinical_notes_retention",
        resourceType: "clinical_note",
        retentionDays: 3650,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "imaging_data_retention",
        resourceType: "imaging",
        retentionDays: 2555,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
      {
        policyName: "messaging_retention",
        resourceType: "message",
        retentionDays: 2555,
        archiveBeforeDelete: true,
        legalHold: false,
        complianceFramework: "HIPAA",
        isActive: true,
      },
    ];

    const now = new Date();
    const nextScheduled = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const policy of defaults) {
      await db.insert(dataRetentionPolicies).values({
        ...policy,
        nextScheduledAt: nextScheduled,
      });
    }

    console.log(`[Retention] Seeded ${defaults.length} default retention policies`);
  }

  async getRetentionReport(): Promise<{
    policiesByFramework: Record<string, number>;
    totalPolicies: number;
    activePolicies: number;
    policiesWithLegalHold: number;
    recentExecutions: DataRetentionExecution[];
    nextExecutions: Array<{ policyName: string; nextScheduledAt: Date | null }>;
  }> {
    const allPolicies = await db.select().from(dataRetentionPolicies);

    const policiesByFramework: Record<string, number> = {};
    let activePolicies = 0;
    let policiesWithLegalHold = 0;

    for (const p of allPolicies) {
      const framework = p.complianceFramework ?? "unspecified";
      policiesByFramework[framework] = (policiesByFramework[framework] || 0) + 1;
      if (p.isActive) activePolicies++;
      if (p.legalHold) policiesWithLegalHold++;
    }

    const recentExecutions = await db
      .select()
      .from(dataRetentionExecutions)
      .orderBy(desc(dataRetentionExecutions.createdAt))
      .limit(10);

    const nextExecutions = allPolicies
      .filter((p) => p.isActive && p.nextScheduledAt)
      .sort((a, b) => (a.nextScheduledAt!.getTime() - b.nextScheduledAt!.getTime()))
      .slice(0, 10)
      .map((p) => ({ policyName: p.policyName, nextScheduledAt: p.nextScheduledAt }));

    return {
      policiesByFramework,
      totalPolicies: allPolicies.length,
      activePolicies,
      policiesWithLegalHold,
      recentExecutions,
      nextExecutions,
    };
  }

  async getStats(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    inactivePolicies: number;
    policiesWithLegalHold: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalRecordsScanned: number;
    totalRecordsArchived: number;
    totalRecordsDeleted: number;
    totalRecordsRetained: number;
  }> {
    const allPolicies = await db.select().from(dataRetentionPolicies);
    const allExecutions = await db.select().from(dataRetentionExecutions);

    let activePolicies = 0;
    let inactivePolicies = 0;
    let policiesWithLegalHold = 0;

    for (const p of allPolicies) {
      if (p.isActive) activePolicies++;
      else inactivePolicies++;
      if (p.legalHold) policiesWithLegalHold++;
    }

    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalRecordsScanned = 0;
    let totalRecordsArchived = 0;
    let totalRecordsDeleted = 0;
    let totalRecordsRetained = 0;

    for (const e of allExecutions) {
      if (e.status === "completed") successfulExecutions++;
      if (e.status === "failed") failedExecutions++;
      totalRecordsScanned += e.recordsScanned ?? 0;
      totalRecordsArchived += e.recordsArchived ?? 0;
      totalRecordsDeleted += e.recordsDeleted ?? 0;
      totalRecordsRetained += e.recordsRetained ?? 0;
    }

    return {
      totalPolicies: allPolicies.length,
      activePolicies,
      inactivePolicies,
      policiesWithLegalHold,
      totalExecutions: allExecutions.length,
      successfulExecutions,
      failedExecutions,
      totalRecordsScanned,
      totalRecordsArchived,
      totalRecordsDeleted,
      totalRecordsRetained,
    };
  }
}

export const dataRetentionService = new DataRetentionService();

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function initializeDataRetention() {
  dataRetentionService.seedDefaultPolicies().then(() => {
    console.log(`[Retention] Data retention service initialized`);
  }).catch((err) => {
    console.error(`[Retention] Failed to seed default policies: ${err.message}`);
  });

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  schedulerInterval = setInterval(async () => {
    try {
      console.log(`[Retention] Running scheduled policy execution check`);
      await dataRetentionService.executeAllDuePolicies();
    } catch (error: any) {
      console.error(`[Retention] Scheduled execution failed: ${error.message}`);
    }
  }, 24 * 60 * 60 * 1000);

  schedulerInterval.unref();

  console.log(`[Retention] Scheduler started - policies will be checked every 24 hours`);
}
