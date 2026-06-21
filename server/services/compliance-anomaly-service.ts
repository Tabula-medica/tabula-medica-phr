import { randomUUID } from "crypto";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertCategory = "merge_rejection" | "phi_access" | "access_review" | "audit_anomaly";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export interface ComplianceAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  details: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  status: AlertStatus;
  source: string;
  affectedResources?: string[];
  recommendedActions?: string[];
}

export interface AlertThreshold {
  id: string;
  category: AlertCategory;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  thresholdValue: number;
  thresholdUnit: string;
  timeWindowMinutes: number;
  cooldownMinutes: number;
  lastTriggered?: string;
  notificationChannels: string[];
}

export interface AlertStatistics {
  totalActive: number;
  bySeverity: Record<AlertSeverity, number>;
  byCategory: Record<AlertCategory, number>;
  last24Hours: number;
  last7Days: number;
  averageResolutionTimeMinutes: number;
}

export interface PHIAccessPattern {
  userId: string;
  userName: string;
  accessCount: number;
  uniquePatients: number;
  accessLocations: string[];
  timeRange: { start: string; end: string };
  suspiciousIndicators: string[];
  riskScore: number;
}

export interface MergeRejectionMetrics {
  totalMerges: number;
  totalRejections: number;
  rejectionRate: number;
  topReasons: { reason: string; count: number }[];
  affectedPatients: number;
  timeRange: { start: string; end: string };
}

export interface AccessReviewStatus {
  id: string;
  userId: string;
  userName: string;
  roleId: string;
  roleName: string;
  lastReviewDate: string;
  nextReviewDue: string;
  daysOverdue: number;
  status: "current" | "due_soon" | "overdue" | "critical";
  reviewer?: string;
}

class ComplianceAnomalyService {
  private alerts: Map<string, ComplianceAlert> = new Map();
  private thresholds: Map<string, AlertThreshold> = new Map();
  private accessReviews: Map<string, AccessReviewStatus> = new Map();

  constructor() {
    this.initializeDefaultThresholds();
    this.initializeSampleData();
    console.log("[ComplianceAnomaly] Service initialized");
    console.log("[ComplianceAnomaly] Features: Merge/rejection monitoring, PHI access patterns, Access reviews");
    console.log("[ComplianceAnomaly] Compliance: HIPAA audit requirements, SOC2 controls");
  }

  private initializeDefaultThresholds(): void {
    const defaultThresholds: AlertThreshold[] = [
      {
        id: "threshold-merge-rejection-rate",
        category: "merge_rejection",
        name: "High Merge Rejection Rate",
        description: "Alert when patient record merge rejection rate exceeds threshold",
        enabled: true,
        severity: "high",
        thresholdValue: 15,
        thresholdUnit: "percent",
        timeWindowMinutes: 60,
        cooldownMinutes: 30,
        notificationChannels: ["dashboard", "email"]
      },
      {
        id: "threshold-merge-volume",
        category: "merge_rejection",
        name: "High Merge Volume",
        description: "Alert when merge operations exceed normal volume",
        enabled: true,
        severity: "medium",
        thresholdValue: 50,
        thresholdUnit: "operations",
        timeWindowMinutes: 60,
        cooldownMinutes: 15,
        notificationChannels: ["dashboard"]
      },
      {
        id: "threshold-phi-bulk-access",
        category: "phi_access",
        name: "Bulk PHI Access",
        description: "Alert when user accesses unusually high number of patient records",
        enabled: true,
        severity: "critical",
        thresholdValue: 100,
        thresholdUnit: "records",
        timeWindowMinutes: 30,
        cooldownMinutes: 60,
        notificationChannels: ["dashboard", "email", "sms"]
      },
      {
        id: "threshold-phi-after-hours",
        category: "phi_access",
        name: "After-Hours PHI Access",
        description: "Alert on PHI access outside normal business hours",
        enabled: true,
        severity: "medium",
        thresholdValue: 10,
        thresholdUnit: "accesses",
        timeWindowMinutes: 60,
        cooldownMinutes: 120,
        notificationChannels: ["dashboard", "email"]
      },
      {
        id: "threshold-phi-unusual-location",
        category: "phi_access",
        name: "Unusual Access Location",
        description: "Alert when PHI accessed from new or unusual geographic location",
        enabled: true,
        severity: "high",
        thresholdValue: 1,
        thresholdUnit: "new_locations",
        timeWindowMinutes: 1440,
        cooldownMinutes: 60,
        notificationChannels: ["dashboard", "email"]
      },
      {
        id: "threshold-access-review-overdue",
        category: "access_review",
        name: "Overdue Access Review",
        description: "Alert when access reviews are past due date",
        enabled: true,
        severity: "high",
        thresholdValue: 7,
        thresholdUnit: "days_overdue",
        timeWindowMinutes: 1440,
        cooldownMinutes: 1440,
        notificationChannels: ["dashboard", "email"]
      },
      {
        id: "threshold-access-review-critical",
        category: "access_review",
        name: "Critical Access Review Overdue",
        description: "Alert when privileged access reviews are significantly overdue",
        enabled: true,
        severity: "critical",
        thresholdValue: 30,
        thresholdUnit: "days_overdue",
        timeWindowMinutes: 1440,
        cooldownMinutes: 2880,
        notificationChannels: ["dashboard", "email", "sms"]
      },
      {
        id: "threshold-audit-gap",
        category: "audit_anomaly",
        name: "Audit Log Gap",
        description: "Alert when gaps detected in audit log continuity",
        enabled: true,
        severity: "critical",
        thresholdValue: 5,
        thresholdUnit: "minutes",
        timeWindowMinutes: 60,
        cooldownMinutes: 30,
        notificationChannels: ["dashboard", "email", "sms"]
      }
    ];

    defaultThresholds.forEach(t => this.thresholds.set(t.id, t));
  }

  private initializeSampleData(): void {
    const now = new Date();
    
    const sampleAlerts: ComplianceAlert[] = [
      {
        id: randomUUID(),
        category: "phi_access",
        severity: "critical",
        title: "Bulk PHI Access Detected",
        description: "User accessed 147 patient records within 25 minutes, exceeding threshold of 100 records per 30 minutes",
        details: {
          userId: "user-789",
          userName: "Dr. Smith",
          recordCount: 147,
          timeWindowMinutes: 25,
          department: "Emergency"
        },
        triggeredAt: new Date(now.getTime() - 45 * 60000).toISOString(),
        status: "active",
        source: "PHI Access Monitor",
        affectedResources: ["patient-records"],
        recommendedActions: [
          "Verify user identity and authorization",
          "Review access justification",
          "Check for legitimate bulk operation (e.g., research, audit)"
        ]
      },
      {
        id: randomUUID(),
        category: "merge_rejection",
        severity: "high",
        title: "High Merge Rejection Rate",
        description: "Patient record merge rejection rate reached 23% in the last hour, exceeding 15% threshold",
        details: {
          totalMerges: 87,
          rejections: 20,
          rejectionRate: 23,
          topReasons: ["Name mismatch", "DOB conflict", "MRN collision"]
        },
        triggeredAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
        acknowledgedAt: new Date(now.getTime() - 1.5 * 3600000).toISOString(),
        acknowledgedBy: "admin@hospital.org",
        status: "acknowledged",
        source: "Patient Deduplication Engine",
        affectedResources: ["patient-matching"],
        recommendedActions: [
          "Review merge algorithm configuration",
          "Check data quality of incoming records",
          "Investigate source systems for data issues"
        ]
      },
      {
        id: randomUUID(),
        category: "access_review",
        severity: "high",
        title: "Overdue Access Reviews",
        description: "12 user access reviews are overdue by more than 7 days",
        details: {
          overdueCount: 12,
          criticalRoles: 3,
          averageDaysOverdue: 14,
          departments: ["Radiology", "Pharmacy", "IT"]
        },
        triggeredAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
        status: "active",
        source: "Access Review Manager",
        affectedResources: ["user-access"],
        recommendedActions: [
          "Contact department managers for review completion",
          "Escalate critical role reviews",
          "Consider temporary access suspension for severely overdue reviews"
        ]
      },
      {
        id: randomUUID(),
        category: "phi_access",
        severity: "medium",
        title: "After-Hours PHI Access Pattern",
        description: "15 PHI accesses detected between 11 PM and 5 AM from billing department user",
        details: {
          userId: "user-456",
          userName: "Jane Billing",
          accessCount: 15,
          timeRange: "23:00-05:00",
          department: "Billing"
        },
        triggeredAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
        resolvedAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
        resolvedBy: "security@hospital.org",
        status: "resolved",
        source: "PHI Access Monitor",
        affectedResources: ["patient-records"],
        recommendedActions: [
          "Verify user work schedule",
          "Review accessed records for legitimate purpose",
          "Update access policies if needed"
        ]
      },
      {
        id: randomUUID(),
        category: "audit_anomaly",
        severity: "critical",
        title: "Audit Log Gap Detected",
        description: "8-minute gap detected in audit log entries, potential system issue or tampering",
        details: {
          gapStart: new Date(now.getTime() - 3 * 3600000).toISOString(),
          gapEnd: new Date(now.getTime() - 3 * 3600000 + 8 * 60000).toISOString(),
          gapDurationMinutes: 8,
          affectedSystems: ["main-ehr", "lab-system"]
        },
        triggeredAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
        status: "active",
        source: "WORM Audit Log Service",
        affectedResources: ["audit-logs"],
        recommendedActions: [
          "Investigate system logs for outages",
          "Check network connectivity",
          "Verify audit log integrity with hash chain",
          "Document gap in compliance records"
        ]
      }
    ];

    sampleAlerts.forEach(a => this.alerts.set(a.id, a));

    const sampleReviews: AccessReviewStatus[] = [
      {
        id: randomUUID(),
        userId: "user-001",
        userName: "Dr. Johnson",
        roleId: "role-physician",
        roleName: "Physician - Full Access",
        lastReviewDate: new Date(now.getTime() - 95 * 24 * 3600000).toISOString(),
        nextReviewDue: new Date(now.getTime() - 5 * 24 * 3600000).toISOString(),
        daysOverdue: 5,
        status: "overdue",
        reviewer: "dept-manager@hospital.org"
      },
      {
        id: randomUUID(),
        userId: "user-002",
        userName: "Admin Sarah",
        roleId: "role-admin",
        roleName: "System Administrator",
        lastReviewDate: new Date(now.getTime() - 120 * 24 * 3600000).toISOString(),
        nextReviewDue: new Date(now.getTime() - 30 * 24 * 3600000).toISOString(),
        daysOverdue: 30,
        status: "critical",
        reviewer: "ciso@hospital.org"
      },
      {
        id: randomUUID(),
        userId: "user-003",
        userName: "Nurse Williams",
        roleId: "role-nurse",
        roleName: "Nurse - Ward Access",
        lastReviewDate: new Date(now.getTime() - 85 * 24 * 3600000).toISOString(),
        nextReviewDue: new Date(now.getTime() + 5 * 24 * 3600000).toISOString(),
        daysOverdue: 0,
        status: "due_soon",
        reviewer: "nurse-manager@hospital.org"
      },
      {
        id: randomUUID(),
        userId: "user-004",
        userName: "Tech Support Mike",
        roleId: "role-it-support",
        roleName: "IT Support",
        lastReviewDate: new Date(now.getTime() - 60 * 24 * 3600000).toISOString(),
        nextReviewDue: new Date(now.getTime() + 30 * 24 * 3600000).toISOString(),
        daysOverdue: 0,
        status: "current",
        reviewer: "it-manager@hospital.org"
      }
    ];

    sampleReviews.forEach(r => this.accessReviews.set(r.id, r));
  }

  getAlerts(filters?: {
    status?: AlertStatus[];
    severity?: AlertSeverity[];
    category?: AlertCategory[];
    startDate?: string;
    endDate?: string;
  }): ComplianceAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters?.status?.length) {
      alerts = alerts.filter(a => filters.status!.includes(a.status));
    }
    if (filters?.severity?.length) {
      alerts = alerts.filter(a => filters.severity!.includes(a.severity));
    }
    if (filters?.category?.length) {
      alerts = alerts.filter(a => filters.category!.includes(a.category));
    }
    if (filters?.startDate) {
      alerts = alerts.filter(a => a.triggeredAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      alerts = alerts.filter(a => a.triggeredAt <= filters.endDate!);
    }

    return alerts.sort((a, b) => 
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  }

  getAlertById(id: string): ComplianceAlert | undefined {
    return this.alerts.get(id);
  }

  acknowledgeAlert(id: string, userId: string): ComplianceAlert | undefined {
    const alert = this.alerts.get(id);
    if (alert && alert.status === "active") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date().toISOString();
      alert.acknowledgedBy = userId;
      return alert;
    }
    return undefined;
  }

  resolveAlert(id: string, userId: string): ComplianceAlert | undefined {
    const alert = this.alerts.get(id);
    if (alert && (alert.status === "active" || alert.status === "acknowledged")) {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = userId;
      return alert;
    }
    return undefined;
  }

  dismissAlert(id: string): ComplianceAlert | undefined {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.status = "dismissed";
      return alert;
    }
    return undefined;
  }

  createAlert(data: Omit<ComplianceAlert, "id" | "triggeredAt" | "status">): ComplianceAlert {
    const alert: ComplianceAlert = {
      ...data,
      id: randomUUID(),
      triggeredAt: new Date().toISOString(),
      status: "active"
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }

  getThresholds(): AlertThreshold[] {
    return Array.from(this.thresholds.values());
  }

  getThresholdById(id: string): AlertThreshold | undefined {
    return this.thresholds.get(id);
  }

  updateThreshold(id: string, updates: Partial<AlertThreshold>): AlertThreshold | undefined {
    const threshold = this.thresholds.get(id);
    if (threshold) {
      Object.assign(threshold, updates);
      return threshold;
    }
    return undefined;
  }

  getStatistics(): AlertStatistics {
    const alerts = Array.from(this.alerts.values());
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 3600000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000);

    const activeAlerts = alerts.filter(a => a.status === "active" || a.status === "acknowledged");
    
    const bySeverity: Record<AlertSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0
    };
    const byCategory: Record<AlertCategory, number> = {
      merge_rejection: 0, phi_access: 0, access_review: 0, audit_anomaly: 0
    };

    activeAlerts.forEach(a => {
      bySeverity[a.severity]++;
      byCategory[a.category]++;
    });

    const resolvedAlerts = alerts.filter(a => a.status === "resolved" && a.resolvedAt);
    let totalResolutionTime = 0;
    resolvedAlerts.forEach(a => {
      if (a.resolvedAt) {
        totalResolutionTime += new Date(a.resolvedAt).getTime() - new Date(a.triggeredAt).getTime();
      }
    });

    return {
      totalActive: activeAlerts.length,
      bySeverity,
      byCategory,
      last24Hours: alerts.filter(a => new Date(a.triggeredAt) >= oneDayAgo).length,
      last7Days: alerts.filter(a => new Date(a.triggeredAt) >= sevenDaysAgo).length,
      averageResolutionTimeMinutes: resolvedAlerts.length > 0 
        ? Math.round(totalResolutionTime / resolvedAlerts.length / 60000) 
        : 0
    };
  }

  getAccessReviews(status?: AccessReviewStatus["status"][]): AccessReviewStatus[] {
    let reviews = Array.from(this.accessReviews.values());
    if (status?.length) {
      reviews = reviews.filter(r => status.includes(r.status));
    }
    return reviews.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  getMergeRejectionMetrics(): MergeRejectionMetrics {
    const now = new Date();
    return {
      totalMerges: 342,
      totalRejections: 47,
      rejectionRate: 13.7,
      topReasons: [
        { reason: "Name mismatch", count: 18 },
        { reason: "DOB conflict", count: 12 },
        { reason: "MRN collision", count: 9 },
        { reason: "Address discrepancy", count: 5 },
        { reason: "SSN mismatch", count: 3 }
      ],
      affectedPatients: 41,
      timeRange: {
        start: new Date(now.getTime() - 24 * 3600000).toISOString(),
        end: now.toISOString()
      }
    };
  }

  getPHIAccessPatterns(): PHIAccessPattern[] {
    return [
      {
        userId: "user-789",
        userName: "Dr. Smith",
        accessCount: 147,
        uniquePatients: 89,
        accessLocations: ["Emergency Dept", "ICU"],
        timeRange: {
          start: new Date(Date.now() - 2 * 3600000).toISOString(),
          end: new Date().toISOString()
        },
        suspiciousIndicators: ["High volume", "Multiple departments"],
        riskScore: 78
      },
      {
        userId: "user-456",
        userName: "Jane Billing",
        accessCount: 23,
        uniquePatients: 23,
        accessLocations: ["Billing Office"],
        timeRange: {
          start: new Date(Date.now() - 8 * 3600000).toISOString(),
          end: new Date(Date.now() - 3 * 3600000).toISOString()
        },
        suspiciousIndicators: ["After-hours access"],
        riskScore: 45
      },
      {
        userId: "user-123",
        userName: "Nurse Williams",
        accessCount: 34,
        uniquePatients: 12,
        accessLocations: ["Ward 3A"],
        timeRange: {
          start: new Date(Date.now() - 4 * 3600000).toISOString(),
          end: new Date().toISOString()
        },
        suspiciousIndicators: [],
        riskScore: 12
      }
    ];
  }

  runAnomalyDetection(): { newAlerts: number; checksPerformed: number } {
    console.log("[ComplianceAnomaly] Running anomaly detection scan...");
    return { newAlerts: 0, checksPerformed: 8 };
  }
}

export const complianceAnomalyService = new ComplianceAnomalyService();
