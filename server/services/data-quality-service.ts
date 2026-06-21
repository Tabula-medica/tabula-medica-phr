import { storage } from "../storage";
import type {
  DataQualityIssue,
  DataQualityAction,
  CareTeamDataQualityMetrics,
  CareTeamDataQualityDashboard,
  DataQualityIssueType,
  DataQualityIssueSeverity,
  DataQualityIssueStatus,
  DataQualityActionType,
  DedupRecordType,
  InsertDataQualityIssue,
  InsertDataQualityAction,
} from "@shared/schema";

const dataQualityIssues: Map<string, DataQualityIssue> = new Map();
const dataQualityActions: Map<string, DataQualityAction> = new Map();

function generateId(): string {
  return `dq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSampleIssues(): void {
  const now = new Date();
  const sampleIssues: DataQualityIssue[] = [
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "duplicate_record",
      severity: "high",
      status: "open",
      recordType: "medication",
      affectedRecordIds: ["med-001", "med-002", "med-003"],
      description: "Metformin appears in 3 sources with different dosage formats",
      details: {
        records: [
          { id: "med-001", name: "Metformin 500mg", source: "Primary Care Provider", dosage: "500mg twice daily" },
          { id: "med-002", name: "Metformin HCl 500mg", source: "CVS Pharmacy", dosage: "500mg BID" },
          { id: "med-003", name: "Metformin", source: "Blue Cross Claims", dosage: "500mg twice a day" },
        ],
        matchScore: 0.92,
      },
      suggestedAction: "Merge records into single canonical entry",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "duplicate_record",
      severity: "medium",
      status: "open",
      recordType: "medication",
      affectedRecordIds: ["med-004", "med-005", "med-006"],
      description: "Atorvastatin/Lipitor appears as both brand and generic names",
      details: {
        records: [
          { id: "med-004", name: "Atorvastatin 20mg", source: "Primary Care Provider", dosage: "20mg daily" },
          { id: "med-005", name: "Atorvastatin Calcium 20mg", source: "CVS Pharmacy", dosage: "20mg at bedtime" },
          { id: "med-006", name: "Lipitor 20mg", source: "Blue Cross Claims", dosage: "20mg daily" },
        ],
        matchScore: 0.88,
      },
      suggestedAction: "Confirm as same medication and merge",
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "missing_required_field",
      severity: "medium",
      status: "open",
      recordType: "medication",
      affectedRecordIds: ["med-007"],
      description: "Vitamin D3 prescription missing NDC code",
      details: {
        record: { id: "med-007", name: "Vitamin D3 2000 IU", source: "Patient Reported" },
        missingFields: ["ndcCode", "prescriber"],
      },
      suggestedAction: "Request patient to provide prescription details",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "duplicate_record",
      severity: "high",
      status: "open",
      recordType: "lab_result",
      affectedRecordIds: ["lab-001", "lab-002", "lab-003"],
      description: "Hemoglobin A1C appears with 3 different naming conventions",
      details: {
        records: [
          { id: "lab-001", name: "Hemoglobin A1C", source: "Quest Diagnostics", value: "6.5%" },
          { id: "lab-002", name: "HbA1c", source: "Primary Care Provider", value: "6.5%" },
          { id: "lab-003", name: "Glycated Hemoglobin", source: "Blue Cross Claims", value: "6.5%" },
        ],
        loincCode: "4548-4",
        matchScore: 0.95,
      },
      suggestedAction: "Merge as same lab test (LOINC 4548-4)",
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "source_conflict",
      severity: "critical",
      status: "open",
      recordType: "allergy",
      affectedRecordIds: ["allergy-001", "allergy-002", "allergy-003"],
      description: "Penicillin allergy reported with different reaction details",
      details: {
        records: [
          { id: "allergy-001", name: "Penicillin", source: "Primary Care Provider", reaction: "Rash" },
          { id: "allergy-002", name: "Penicillin allergy", source: "Walgreens", reaction: "Skin rash" },
          { id: "allergy-003", name: "PCN", source: "City Hospital", reaction: "Rash" },
        ],
        conflictType: "reaction_severity_unknown",
      },
      suggestedAction: "Review and confirm reaction severity level",
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "duplicate_record",
      severity: "low",
      status: "open",
      recordType: "condition",
      affectedRecordIds: ["cond-001", "cond-002", "cond-003"],
      description: "Type 2 Diabetes recorded with varying terminology",
      details: {
        records: [
          { id: "cond-001", name: "Type 2 Diabetes Mellitus", source: "Primary Care Provider", code: "E11.9" },
          { id: "cond-002", name: "Diabetes mellitus type 2", source: "Blue Cross Claims", code: "E11.9" },
          { id: "cond-003", name: "T2DM", source: "Hospital Network", code: "E11.9" },
        ],
        icd10Code: "E11.9",
        matchScore: 0.98,
      },
      suggestedAction: "Auto-merge (same ICD-10 code)",
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-002",
      issueType: "stale_record",
      severity: "low",
      status: "open",
      recordType: "medication",
      affectedRecordIds: ["med-008"],
      description: "Medication not updated in over 6 months",
      details: {
        record: { id: "med-008", name: "Aspirin 81mg", source: "Primary Care Provider", lastUpdated: "2025-06-15" },
        daysSinceUpdate: 217,
      },
      suggestedAction: "Verify medication is still active with patient",
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId(),
      patientId: "patient-001",
      issueType: "normalization_error",
      severity: "medium",
      status: "resolved",
      recordType: "lab_result",
      affectedRecordIds: ["lab-004"],
      description: "Cholesterol value reported in non-standard units",
      details: {
        record: { id: "lab-004", name: "Total Cholesterol", source: "External Lab", value: "4.78 mmol/L" },
        expectedUnit: "mg/dL",
        convertedValue: "185 mg/dL",
      },
      resolvedBy: "care-team-user-1",
      resolvedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      resolutionNote: "Converted mmol/L to mg/dL using standard factor",
      createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  sampleIssues.forEach((issue) => dataQualityIssues.set(issue.id, issue));
}

generateSampleIssues();

export class DataQualityService {
  async getMetrics(): Promise<CareTeamDataQualityMetrics> {
    const issues = Array.from(dataQualityIssues.values());
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const issuesBySeverity: Record<DataQualityIssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const issuesByType: Record<DataQualityIssueType, number> = {
      duplicate_record: 0,
      missing_required_field: 0,
      invalid_code_system: 0,
      inconsistent_data: 0,
      stale_record: 0,
      normalization_error: 0,
      source_conflict: 0,
    };
    const issuesByStatus: Record<DataQualityIssueStatus, number> = {
      open: 0,
      in_review: 0,
      resolved: 0,
      dismissed: 0,
    };
    const issuesByRecordType: Record<DedupRecordType, number> = {
      medication: 0,
      lab_result: 0,
      document: 0,
      condition: 0,
      allergy: 0,
    };

    let resolvedThisWeek = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    issues.forEach((issue) => {
      issuesBySeverity[issue.severity]++;
      issuesByType[issue.issueType]++;
      issuesByStatus[issue.status]++;
      issuesByRecordType[issue.recordType]++;

      if (issue.status === "resolved" && issue.resolvedAt) {
        const resolvedDate = new Date(issue.resolvedAt);
        if (resolvedDate >= oneWeekAgo) {
          resolvedThisWeek++;
        }
        const createdDate = new Date(issue.createdAt);
        totalResolutionTime += resolvedDate.getTime() - createdDate.getTime();
        resolvedCount++;
      }
    });

    const duplicateGroups = issues.filter((i) => i.issueType === "duplicate_record" && i.status === "open").length;
    const pendingMerges = duplicateGroups;
    const totalOpen = issuesByStatus.open + issuesByStatus.in_review;
    const totalResolved = issuesByStatus.resolved + issuesByStatus.dismissed;
    const resolutionRate = totalOpen + totalResolved > 0 ? (totalResolved / (totalOpen + totalResolved)) * 100 : 0;
    const averageResolutionTimeHours = resolvedCount > 0 ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) : 0;

    return {
      totalIssues: issues.length,
      issuesBySeverity,
      issuesByType,
      issuesByStatus,
      issuesByRecordType,
      duplicateGroups,
      pendingMerges,
      resolvedThisWeek,
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      averageResolutionTimeHours: Math.round(averageResolutionTimeHours * 10) / 10,
    };
  }

  async getDashboardData(): Promise<CareTeamDataQualityDashboard> {
    const metrics = await this.getMetrics();
    const issues = Array.from(dataQualityIssues.values());
    const actions = Array.from(dataQualityActions.values());

    const recentIssues = issues
      .filter((i) => i.status === "open" || i.status === "in_review")
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);

    const patientIssueCounts = new Map<string, number>();
    issues
      .filter((i) => i.status !== "resolved" && i.status !== "dismissed")
      .forEach((issue) => {
        const count = patientIssueCounts.get(issue.patientId) || 0;
        patientIssueCounts.set(issue.patientId, count + 1);
      });

    const topPatientsByIssues = Array.from(patientIssueCounts.entries())
      .map(([patientId, issueCount]) => ({
        patientId,
        patientName: patientId === "patient-001" ? "John Smith" : patientId === "patient-002" ? "Jane Doe" : "Unknown",
        issueCount,
      }))
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 5);

    const now = new Date();
    const issuesTrend: Array<{ date: string; open: number; resolved: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const openOnDate = issues.filter((issue) => {
        const created = new Date(issue.createdAt);
        const resolved = issue.resolvedAt ? new Date(issue.resolvedAt) : null;
        return created <= date && (!resolved || resolved > date);
      }).length;
      const resolvedOnDate = issues.filter((issue) => {
        if (!issue.resolvedAt) return false;
        const resolved = new Date(issue.resolvedAt);
        return resolved.toISOString().split("T")[0] === dateStr;
      }).length;
      issuesTrend.push({ date: dateStr, open: openOnDate, resolved: resolvedOnDate });
    }

    const recentActions = actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    return {
      metrics,
      recentIssues,
      topPatientsByIssues,
      issuesTrend,
      recentActions,
    };
  }

  async getIssues(filters?: {
    status?: DataQualityIssueStatus;
    severity?: DataQualityIssueSeverity;
    issueType?: DataQualityIssueType;
    recordType?: DedupRecordType;
    patientId?: string;
  }): Promise<DataQualityIssue[]> {
    let issues = Array.from(dataQualityIssues.values());

    if (filters) {
      if (filters.status) {
        issues = issues.filter((i) => i.status === filters.status);
      }
      if (filters.severity) {
        issues = issues.filter((i) => i.severity === filters.severity);
      }
      if (filters.issueType) {
        issues = issues.filter((i) => i.issueType === filters.issueType);
      }
      if (filters.recordType) {
        issues = issues.filter((i) => i.recordType === filters.recordType);
      }
      if (filters.patientId) {
        issues = issues.filter((i) => i.patientId === filters.patientId);
      }
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = { open: 0, in_review: 1, resolved: 2, dismissed: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  async getIssueById(id: string): Promise<DataQualityIssue | null> {
    return dataQualityIssues.get(id) || null;
  }

  async createIssue(data: InsertDataQualityIssue): Promise<DataQualityIssue> {
    const now = new Date().toISOString();
    const issue: DataQualityIssue = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    dataQualityIssues.set(issue.id, issue);
    return issue;
  }

  async updateIssueStatus(
    issueId: string,
    status: DataQualityIssueStatus,
    userId: string,
    resolutionNote?: string
  ): Promise<DataQualityIssue | null> {
    const issue = dataQualityIssues.get(issueId);
    if (!issue) return null;

    const updatedIssue: DataQualityIssue = {
      ...issue,
      status,
      updatedAt: new Date().toISOString(),
      ...(status === "resolved" || status === "dismissed"
        ? {
            resolvedBy: userId,
            resolvedAt: new Date().toISOString(),
            resolutionNote,
          }
        : {}),
    };

    dataQualityIssues.set(issueId, updatedIssue);
    return updatedIssue;
  }

  async mergeRecords(
    issueId: string,
    userId: string,
    sourceRecordIds: string[],
    targetRecordId: string,
    mergedValues: Record<string, unknown>,
    notes: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ issue: DataQualityIssue; action: DataQualityAction } | null> {
    const issue = dataQualityIssues.get(issueId);
    if (!issue) return null;

    const action: DataQualityAction = {
      id: generateId(),
      issueId,
      userId,
      actionType: "merge_records",
      sourceRecordIds,
      targetRecordId,
      previousValues: issue.details as Record<string, unknown>,
      newValues: mergedValues,
      notes,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    dataQualityActions.set(action.id, action);

    const updatedIssue = await this.updateIssueStatus(issueId, "resolved", userId, notes);
    if (!updatedIssue) return null;

    return { issue: updatedIssue, action };
  }

  async confirmDuplicate(
    issueId: string,
    userId: string,
    notes: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ issue: DataQualityIssue; action: DataQualityAction } | null> {
    const issue = dataQualityIssues.get(issueId);
    if (!issue) return null;

    const action: DataQualityAction = {
      id: generateId(),
      issueId,
      userId,
      actionType: "confirm_duplicate",
      sourceRecordIds: issue.affectedRecordIds,
      notes,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    dataQualityActions.set(action.id, action);

    const updatedIssue = await this.updateIssueStatus(issueId, "resolved", userId, notes);
    if (!updatedIssue) return null;

    return { issue: updatedIssue, action };
  }

  async dismissDuplicate(
    issueId: string,
    userId: string,
    notes: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ issue: DataQualityIssue; action: DataQualityAction } | null> {
    const issue = dataQualityIssues.get(issueId);
    if (!issue) return null;

    const action: DataQualityAction = {
      id: generateId(),
      issueId,
      userId,
      actionType: "dismiss_duplicate",
      sourceRecordIds: issue.affectedRecordIds,
      notes,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    dataQualityActions.set(action.id, action);

    const updatedIssue = await this.updateIssueStatus(issueId, "dismissed", userId, notes);
    if (!updatedIssue) return null;

    return { issue: updatedIssue, action };
  }

  async getActionsForIssue(issueId: string): Promise<DataQualityAction[]> {
    return Array.from(dataQualityActions.values())
      .filter((a) => a.issueId === issueId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRecentActions(limit: number = 20): Promise<DataQualityAction[]> {
    return Array.from(dataQualityActions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

export const dataQualityService = new DataQualityService();
