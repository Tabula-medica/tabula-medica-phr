import { db } from "./db";
import { 
  complianceAlerts, 
  alertRules, 
  accessReviews, 
  phiAccessPatterns,
  alertNotifications,
  auditLogs,
  duplicateCandidates,
  patientMergeHistory,
  users,
  type ComplianceAlert,
  type InsertComplianceAlert,
  type AlertRule,
  type InsertAlertRule,
  type AccessReview,
  type InsertAccessReview,
  COMPLIANCE_ALERT_TYPES,
  COMPLIANCE_SEVERITIES,
  COMPLIANCE_CATEGORIES
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count, or } from "drizzle-orm";

interface AlertStats {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

interface DeduplicationMetrics {
  totalMerges: number;
  totalRejections: number;
  mergeRate: number;
  rejectionRate: number;
  averageMergeRate: number;
  isAnomalous: boolean;
}

interface PhiAccessMetrics {
  totalAccesses: number;
  uniqueUsers: number;
  uniquePatients: number;
  accessesByHour: Record<number, number>;
  afterHoursAccesses: number;
  isAnomalous: boolean;
  anomalyReasons: string[];
}

export class ComplianceMonitoringService {
  
  async getAlertStats(): Promise<AlertStats> {
    const allAlerts = await db.select().from(complianceAlerts);
    
    const stats: AlertStats = {
      total: allAlerts.length,
      open: allAlerts.filter(a => a.status === "open").length,
      acknowledged: allAlerts.filter(a => a.status === "acknowledged").length,
      resolved: allAlerts.filter(a => a.status === "resolved").length,
      bySeverity: {
        critical: allAlerts.filter(a => a.severity === "critical").length,
        high: allAlerts.filter(a => a.severity === "high").length,
        medium: allAlerts.filter(a => a.severity === "medium").length,
        low: allAlerts.filter(a => a.severity === "low").length,
      },
      byCategory: {
        deduplication: allAlerts.filter(a => a.category === "deduplication").length,
        phi_access: allAlerts.filter(a => a.category === "phi_access").length,
        access_review: allAlerts.filter(a => a.category === "access_review").length,
        data_export: allAlerts.filter(a => a.category === "data_export").length,
        authentication: allAlerts.filter(a => a.category === "authentication").length,
      }
    };
    
    return stats;
  }

  async getAlerts(options?: {
    status?: string;
    severity?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<ComplianceAlert[]> {
    let query = db.select().from(complianceAlerts);
    
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(complianceAlerts.status, options.status));
    }
    if (options?.severity) {
      conditions.push(eq(complianceAlerts.severity, options.severity));
    }
    if (options?.category) {
      conditions.push(eq(complianceAlerts.category, options.category));
    }
    
    const result = await db.select()
      .from(complianceAlerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complianceAlerts.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
    
    return result;
  }

  async getAlertById(id: string): Promise<ComplianceAlert | null> {
    const [alert] = await db.select()
      .from(complianceAlerts)
      .where(eq(complianceAlerts.id, id));
    return alert || null;
  }

  async createAlert(data: InsertComplianceAlert): Promise<ComplianceAlert> {
    const [alert] = await db.insert(complianceAlerts)
      .values(data)
      .returning();
    return alert;
  }

  async updateAlertStatus(
    id: string, 
    status: string, 
    userId: string,
    resolution?: string
  ): Promise<ComplianceAlert | null> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };
    
    if (status === "acknowledged") {
      updateData.acknowledgedAt = new Date();
      updateData.acknowledgedBy = userId;
    } else if (status === "resolved") {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = userId;
      if (resolution) {
        updateData.resolution = resolution;
      }
    }
    
    const [updated] = await db.update(complianceAlerts)
      .set(updateData)
      .where(eq(complianceAlerts.id, id))
      .returning();
    
    return updated || null;
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return db.select()
      .from(alertRules)
      .orderBy(alertRules.category, alertRules.name);
  }

  async createAlertRule(data: InsertAlertRule): Promise<AlertRule> {
    const [rule] = await db.insert(alertRules)
      .values(data)
      .returning();
    return rule;
  }

  async updateAlertRule(id: string, data: Partial<InsertAlertRule>): Promise<AlertRule | null> {
    const [updated] = await db.update(alertRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    return updated || null;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    const result = await db.delete(alertRules)
      .where(eq(alertRules.id, id));
    return true;
  }

  async analyzeDeduplicationPatterns(timeWindowHours: number = 24): Promise<DeduplicationMetrics> {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    const merges = await db.select({ count: count() })
      .from(patientMergeHistory)
      .where(gte(patientMergeHistory.createdAt, since));
    
    const rejections = await db.select({ count: count() })
      .from(duplicateCandidates)
      .where(and(
        gte(duplicateCandidates.updatedAt, since),
        eq(duplicateCandidates.status, "confirmed_unique")
      ));
    
    const totalMerges = merges[0]?.count || 0;
    const totalRejections = rejections[0]?.count || 0;
    const total = totalMerges + totalRejections;
    
    const mergeRate = total > 0 ? (totalMerges / total) * 100 : 0;
    const rejectionRate = total > 0 ? (totalRejections / total) * 100 : 0;
    
    const avgMergeRate = 65;
    const isAnomalous = Math.abs(mergeRate - avgMergeRate) > 25;
    
    return {
      totalMerges,
      totalRejections,
      mergeRate,
      rejectionRate,
      averageMergeRate: avgMergeRate,
      isAnomalous
    };
  }

  async analyzePhiAccessPatterns(timeWindowHours: number = 24): Promise<PhiAccessMetrics> {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    const accessLogs = await db.select()
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, since),
        or(
          eq(auditLogs.action, "record_view"),
          eq(auditLogs.action, "record_export"),
          eq(auditLogs.action, "record_share"),
          eq(auditLogs.action, "phi_access")
        )
      ));
    
    const uniqueUsers = new Set(accessLogs.map(l => l.userId).filter(Boolean));
    const uniquePatients = new Set(accessLogs.map(l => l.resourceId).filter(Boolean));
    
    const accessesByHour: Record<number, number> = {};
    let afterHoursAccesses = 0;
    
    for (const log of accessLogs) {
      const hour = log.createdAt.getHours();
      accessesByHour[hour] = (accessesByHour[hour] || 0) + 1;
      
      if (hour < 7 || hour > 19) {
        afterHoursAccesses++;
      }
    }
    
    const anomalyReasons: string[] = [];
    const afterHoursRatio = accessLogs.length > 0 ? afterHoursAccesses / accessLogs.length : 0;
    
    if (afterHoursRatio > 0.3) {
      anomalyReasons.push("High after-hours access rate (>30%)");
    }
    
    if (uniquePatients.size > 50 && accessLogs.length > 100) {
      anomalyReasons.push("Unusually high volume of patient record access");
    }
    
    return {
      totalAccesses: accessLogs.length,
      uniqueUsers: uniqueUsers.size,
      uniquePatients: uniquePatients.size,
      accessesByHour,
      afterHoursAccesses,
      isAnomalous: anomalyReasons.length > 0,
      anomalyReasons
    };
  }

  async getAccessReviews(options?: {
    status?: string;
    userId?: string;
  }): Promise<AccessReview[]> {
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(accessReviews.status, options.status));
    }
    if (options?.userId) {
      conditions.push(eq(accessReviews.userId, options.userId));
    }
    
    return db.select()
      .from(accessReviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(accessReviews.dueDate);
  }

  async getOutstandingAccessReviews(): Promise<AccessReview[]> {
    const now = new Date();
    
    return db.select()
      .from(accessReviews)
      .where(and(
        eq(accessReviews.status, "pending"),
        lte(accessReviews.dueDate, now)
      ))
      .orderBy(accessReviews.dueDate);
  }

  async createAccessReview(data: InsertAccessReview): Promise<AccessReview> {
    const [review] = await db.insert(accessReviews)
      .values(data)
      .returning();
    return review;
  }

  async completeAccessReview(
    id: string, 
    reviewerId: string, 
    decision: string, 
    notes?: string
  ): Promise<AccessReview | null> {
    const [updated] = await db.update(accessReviews)
      .set({
        status: "completed",
        reviewer: reviewerId,
        reviewDecision: decision,
        reviewNotes: notes,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(accessReviews.id, id))
      .returning();
    
    return updated || null;
  }

  async runComplianceChecks(): Promise<{
    deduplication: DeduplicationMetrics;
    phiAccess: PhiAccessMetrics;
    outstandingReviews: AccessReview[];
    newAlerts: ComplianceAlert[];
  }> {
    const deduplication = await this.analyzeDeduplicationPatterns();
    const phiAccess = await this.analyzePhiAccessPatterns();
    const outstandingReviews = await this.getOutstandingAccessReviews();
    
    const newAlerts: ComplianceAlert[] = [];
    
    if (deduplication.isAnomalous) {
      if (deduplication.mergeRate > deduplication.averageMergeRate + 25) {
        const alert = await this.createAlert({
          alertType: "merge_rate_anomaly",
          severity: "high",
          title: "Unusually High Merge Rate Detected",
          description: `The patient record merge rate of ${deduplication.mergeRate.toFixed(1)}% is significantly above the baseline of ${deduplication.averageMergeRate}%. This may indicate data quality issues or system misconfiguration.`,
          category: "deduplication",
          thresholdValue: deduplication.averageMergeRate + 25,
          actualValue: deduplication.mergeRate,
          timeWindow: "24h",
          metadata: { metrics: deduplication }
        });
        newAlerts.push(alert);
      }
      
      if (deduplication.rejectionRate > 50) {
        const alert = await this.createAlert({
          alertType: "rejection_rate_anomaly",
          severity: "medium",
          title: "High Rejection Rate in Duplicate Review",
          description: `${deduplication.rejectionRate.toFixed(1)}% of potential duplicates are being rejected. This may indicate false positive matching or inadequate training.`,
          category: "deduplication",
          thresholdValue: 50,
          actualValue: deduplication.rejectionRate,
          timeWindow: "24h",
          metadata: { metrics: deduplication }
        });
        newAlerts.push(alert);
      }
    }
    
    if (phiAccess.isAnomalous) {
      for (const reason of phiAccess.anomalyReasons) {
        const alert = await this.createAlert({
          alertType: "phi_access_pattern",
          severity: reason.includes("after-hours") ? "medium" : "high",
          title: "Suspicious PHI Access Pattern Detected",
          description: reason,
          category: "phi_access",
          timeWindow: "24h",
          metadata: { metrics: phiAccess }
        });
        newAlerts.push(alert);
      }
    }
    
    if (outstandingReviews.length > 0) {
      const critical = outstandingReviews.filter(r => {
        const daysOverdue = (Date.now() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysOverdue > 7;
      });
      
      if (critical.length > 0) {
        const alert = await this.createAlert({
          alertType: "outstanding_access_review",
          severity: "critical",
          title: `${critical.length} Critically Overdue Access Review(s)`,
          description: `There are ${critical.length} access reviews that are more than 7 days overdue. Immediate action is required for HIPAA compliance.`,
          category: "access_review",
          thresholdValue: 7,
          actualValue: critical.length,
          metadata: { reviewIds: critical.map(r => r.id) }
        });
        newAlerts.push(alert);
      } else if (outstandingReviews.length > 5) {
        const alert = await this.createAlert({
          alertType: "outstanding_access_review",
          severity: "high",
          title: `${outstandingReviews.length} Outstanding Access Reviews`,
          description: `There are ${outstandingReviews.length} pending access reviews that require attention.`,
          category: "access_review",
          thresholdValue: 5,
          actualValue: outstandingReviews.length,
          metadata: { reviewIds: outstandingReviews.map(r => r.id) }
        });
        newAlerts.push(alert);
      }
    }
    
    return {
      deduplication,
      phiAccess,
      outstandingReviews,
      newAlerts
    };
  }

  async initializeDefaultRules(): Promise<AlertRule[]> {
    const existingRules = await db.select().from(alertRules);
    if (existingRules.length > 0) {
      return existingRules;
    }
    
    const defaultRules: InsertAlertRule[] = [
      {
        name: "High Merge Rate",
        description: "Alert when patient record merge rate exceeds normal threshold",
        alertType: "merge_rate_anomaly",
        category: "deduplication",
        severity: "high",
        thresholdValue: 90,
        thresholdOperator: "gt",
        timeWindowMinutes: 1440,
        notifyInApp: true
      },
      {
        name: "High Rejection Rate",
        description: "Alert when duplicate rejection rate is unusually high",
        alertType: "rejection_rate_anomaly",
        category: "deduplication",
        severity: "medium",
        thresholdValue: 50,
        thresholdOperator: "gt",
        timeWindowMinutes: 1440,
        notifyInApp: true
      },
      {
        name: "After Hours Access",
        description: "Alert on significant after-hours PHI access",
        alertType: "after_hours_access",
        category: "phi_access",
        severity: "medium",
        thresholdValue: 30,
        thresholdOperator: "gt",
        timeWindowMinutes: 1440,
        notifyInApp: true
      },
      {
        name: "Overdue Access Reviews",
        description: "Alert when access reviews are past due",
        alertType: "outstanding_access_review",
        category: "access_review",
        severity: "high",
        thresholdValue: 5,
        thresholdOperator: "gt",
        timeWindowMinutes: 10080,
        notifyInApp: true
      },
      {
        name: "Break Glass Abuse",
        description: "Alert on potential break glass access abuse",
        alertType: "break_glass_abuse",
        category: "phi_access",
        severity: "critical",
        thresholdValue: 3,
        thresholdOperator: "gt",
        timeWindowMinutes: 60,
        notifyInApp: true,
        notifyEmail: true
      },
      {
        name: "Failed Authentication Attempts",
        description: "Alert on multiple failed authentication attempts",
        alertType: "failed_auth_attempts",
        category: "authentication",
        severity: "high",
        thresholdValue: 5,
        thresholdOperator: "gt",
        timeWindowMinutes: 15,
        notifyInApp: true
      }
    ];
    
    const createdRules: AlertRule[] = [];
    for (const rule of defaultRules) {
      const [created] = await db.insert(alertRules)
        .values(rule)
        .returning();
      createdRules.push(created);
    }
    
    return createdRules;
  }

  async getDashboardData(): Promise<{
    stats: AlertStats;
    recentAlerts: ComplianceAlert[];
    deduplicationMetrics: DeduplicationMetrics;
    phiAccessMetrics: PhiAccessMetrics;
    outstandingReviews: number;
  }> {
    const [stats, recentAlerts, deduplicationMetrics, phiAccessMetrics, outstandingReviews] = await Promise.all([
      this.getAlertStats(),
      this.getAlerts({ limit: 10 }),
      this.analyzeDeduplicationPatterns(),
      this.analyzePhiAccessPatterns(),
      this.getOutstandingAccessReviews()
    ]);
    
    return {
      stats,
      recentAlerts,
      deduplicationMetrics,
      phiAccessMetrics,
      outstandingReviews: outstandingReviews.length
    };
  }
}

export const complianceMonitoringService = new ComplianceMonitoringService();
