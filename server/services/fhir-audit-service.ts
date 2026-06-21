import { storage } from "../storage";

export type FhirAuditAction = "read" | "search" | "create" | "update" | "delete" | "export" | "import" | "validate" | "transform" | "sync";
export type FhirAuditOutcome = "success" | "failure" | "partial";

export interface FhirAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  userName?: string;
  action: FhirAuditAction;
  outcome: FhirAuditOutcome;
  resourceType: string;
  resourceId?: string;
  resourceVersion?: string;
  patientId?: string;
  fhirVersion: "R4" | "R5";
  operationType: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  queryParameters?: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseTimeMs: number;
  errorMessage?: string;
  errorCode?: string;
  phiAccessed: boolean;
  accessReason?: string;
  sourceSystem?: string;
  targetSystem?: string;
  bundleSize?: number;
  affectedResources?: string[];
  metadata?: Record<string, any>;
}

export interface FhirAuditFilter {
  userId?: string;
  userRole?: string;
  action?: FhirAuditAction;
  outcome?: FhirAuditOutcome;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  fhirVersion?: "R4" | "R5";
  operationType?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  phiAccessed?: boolean;
  sourceSystem?: string;
  limit?: number;
  offset?: number;
}

export interface FhirAuditStatistics {
  totalEntries: number;
  byAction: Record<FhirAuditAction, number>;
  byOutcome: Record<FhirAuditOutcome, number>;
  byResourceType: Record<string, number>;
  byUserRole: Record<string, number>;
  byFhirVersion: Record<string, number>;
  averageResponseTime: number;
  phiAccessCount: number;
  errorCount: number;
  timeRange: { start: string; end: string };
}

export interface FhirAuditSummary {
  date: string;
  totalOperations: number;
  successRate: number;
  uniqueUsers: number;
  topResources: { resourceType: string; count: number }[];
  topActions: { action: string; count: number }[];
  averageResponseTime: number;
}

class FhirAuditService {
  private auditEntries: Map<string, FhirAuditEntry> = new Map();
  private readonly maxEntries = 100000;

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleEntries: Omit<FhirAuditEntry, "id">[] = [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: "user-001",
        userRole: "physician",
        userName: "Dr. Sarah Johnson",
        action: "read",
        outcome: "success",
        resourceType: "Patient",
        resourceId: "patient-12345",
        patientId: "patient-12345",
        fhirVersion: "R4",
        operationType: "GetPatient",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/Patient/patient-12345",
        requestMethod: "GET",
        responseStatus: 200,
        responseTimeMs: 45,
        phiAccessed: true,
        accessReason: "Routine care visit",
      },
      {
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        userId: "user-002",
        userRole: "nurse",
        userName: "Michael Chen",
        action: "search",
        outcome: "success",
        resourceType: "Observation",
        patientId: "patient-12345",
        fhirVersion: "R4",
        operationType: "SearchObservations",
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/Observation",
        requestMethod: "GET",
        queryParameters: { patient: "patient-12345", category: "vital-signs" },
        responseStatus: 200,
        responseTimeMs: 120,
        phiAccessed: true,
        bundleSize: 15,
      },
      {
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        userId: "user-003",
        userRole: "admin",
        userName: "Emily Davis",
        action: "export",
        outcome: "success",
        resourceType: "Bundle",
        fhirVersion: "R4",
        operationType: "BulkExport",
        ipAddress: "192.168.1.102",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/$export",
        requestMethod: "POST",
        responseStatus: 202,
        responseTimeMs: 350,
        phiAccessed: true,
        accessReason: "Quality reporting",
        bundleSize: 500,
        affectedResources: ["Patient", "Observation", "Condition"],
      },
      {
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        userId: "user-004",
        userRole: "physician",
        userName: "Dr. Robert Williams",
        action: "create",
        outcome: "success",
        resourceType: "Condition",
        resourceId: "condition-789",
        patientId: "patient-67890",
        fhirVersion: "R4",
        operationType: "CreateCondition",
        ipAddress: "192.168.1.103",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/Condition",
        requestMethod: "POST",
        responseStatus: 201,
        responseTimeMs: 85,
        phiAccessed: true,
        accessReason: "New diagnosis documentation",
      },
      {
        timestamp: new Date(Date.now() - 18000000).toISOString(),
        userId: "user-001",
        userRole: "physician",
        userName: "Dr. Sarah Johnson",
        action: "update",
        outcome: "success",
        resourceType: "MedicationRequest",
        resourceId: "medrq-456",
        resourceVersion: "2",
        patientId: "patient-12345",
        fhirVersion: "R4",
        operationType: "UpdateMedicationRequest",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/MedicationRequest/medrq-456",
        requestMethod: "PUT",
        responseStatus: 200,
        responseTimeMs: 95,
        phiAccessed: true,
        accessReason: "Medication adjustment",
      },
      {
        timestamp: new Date(Date.now() - 21600000).toISOString(),
        userId: "user-005",
        userRole: "lab_tech",
        userName: "James Wilson",
        action: "create",
        outcome: "failure",
        resourceType: "DiagnosticReport",
        patientId: "patient-99999",
        fhirVersion: "R4",
        operationType: "CreateDiagnosticReport",
        ipAddress: "192.168.1.104",
        userAgent: "LabSystem/2.0",
        requestPath: "/api/fhir/DiagnosticReport",
        requestMethod: "POST",
        responseStatus: 400,
        responseTimeMs: 25,
        phiAccessed: false,
        errorMessage: "Invalid patient reference",
        errorCode: "INVALID_REFERENCE",
      },
      {
        timestamp: new Date(Date.now() - 25200000).toISOString(),
        userId: "system",
        userRole: "system",
        action: "import",
        outcome: "success",
        resourceType: "Bundle",
        fhirVersion: "R4",
        operationType: "HL7v2Import",
        ipAddress: "10.0.0.50",
        userAgent: "IntegrationEngine/3.1",
        requestPath: "/api/fhir/$process-message",
        requestMethod: "POST",
        responseStatus: 200,
        responseTimeMs: 450,
        phiAccessed: true,
        sourceSystem: "Fasten Health",
        bundleSize: 25,
        affectedResources: ["Patient", "Encounter", "Observation"],
      },
      {
        timestamp: new Date(Date.now() - 28800000).toISOString(),
        userId: "user-006",
        userRole: "patient",
        userName: "Alice Brown",
        action: "read",
        outcome: "success",
        resourceType: "Patient",
        resourceId: "patient-alice",
        patientId: "patient-alice",
        fhirVersion: "R4",
        operationType: "PatientPortalAccess",
        ipAddress: "203.45.67.89",
        userAgent: "TabulaMedica-PWA/1.0",
        requestPath: "/api/fhir/Patient/patient-alice",
        requestMethod: "GET",
        responseStatus: 200,
        responseTimeMs: 35,
        phiAccessed: true,
        accessReason: "Self-service health record access",
      },
      {
        timestamp: new Date(Date.now() - 32400000).toISOString(),
        userId: "user-002",
        userRole: "nurse",
        userName: "Michael Chen",
        action: "validate",
        outcome: "partial",
        resourceType: "Bundle",
        fhirVersion: "R5",
        operationType: "ValidateBundle",
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0",
        requestPath: "/api/fhir/$validate",
        requestMethod: "POST",
        responseStatus: 200,
        responseTimeMs: 180,
        phiAccessed: false,
        metadata: { validationErrors: 3, validationWarnings: 7 },
      },
      {
        timestamp: new Date(Date.now() - 36000000).toISOString(),
        userId: "user-007",
        userRole: "integration",
        action: "transform",
        outcome: "success",
        resourceType: "Patient",
        fhirVersion: "R5",
        operationType: "R4toR5Transform",
        ipAddress: "10.0.0.100",
        userAgent: "FHIRTransformer/1.0",
        requestPath: "/api/fhir-mapping/execute",
        requestMethod: "POST",
        responseStatus: 200,
        responseTimeMs: 65,
        phiAccessed: true,
        sourceSystem: "Legacy",
        targetSystem: "FHIR R5",
      },
    ];

    sampleEntries.forEach((entry, index) => {
      const id = `audit-${Date.now()}-${index}`;
      this.auditEntries.set(id, { ...entry, id });
    });
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async log(entry: Omit<FhirAuditEntry, "id" | "timestamp">): Promise<FhirAuditEntry> {
    const id = this.generateId();
    const timestamp = new Date().toISOString();
    
    const auditEntry: FhirAuditEntry = {
      ...entry,
      id,
      timestamp,
    };

    if (this.auditEntries.size >= this.maxEntries) {
      const oldestKey = this.auditEntries.keys().next().value;
      if (oldestKey) {
        this.auditEntries.delete(oldestKey);
      }
    }

    this.auditEntries.set(id, auditEntry);

    try {
      await storage.createSecurityAuditLog({
        userId: entry.userId,
        eventType: "data_access" as const,
        description: this.buildDescription(entry),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        platform: "web",
        appVersion: "1.0.0",
        metadata: {
          fhirAuditId: id,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId || "",
          patientId: entry.patientId || "",
          action: entry.action,
          outcome: entry.outcome,
          fhirVersion: entry.fhirVersion,
          operationType: entry.operationType,
          responseStatus: String(entry.responseStatus),
          responseTimeMs: String(entry.responseTimeMs),
          phiAccessed: String(entry.phiAccessed),
        },
      });
    } catch (error) {
      console.error("[FhirAudit] Error persisting to storage:", error);
    }

    return auditEntry;
  }

  private mapActionToEventType(action: FhirAuditAction): string {
    switch (action) {
      case "read":
      case "search":
        return "data_access";
      case "create":
      case "update":
      case "delete":
        return "data_modification";
      case "export":
        return "data_export";
      case "import":
        return "data_import";
      case "validate":
      case "transform":
        return "data_processing";
      default:
        return "data_access";
    }
  }

  private buildDescription(entry: Omit<FhirAuditEntry, "id" | "timestamp">): string {
    const parts = [
      `FHIR ${entry.action.toUpperCase()}`,
      entry.resourceType,
    ];
    
    if (entry.resourceId) {
      parts.push(`(${entry.resourceId})`);
    }
    
    parts.push(`- ${entry.outcome}`);
    
    if (entry.patientId) {
      parts.push(`for patient ${entry.patientId}`);
    }
    
    return parts.join(" ");
  }

  async getEntry(id: string): Promise<FhirAuditEntry | null> {
    return this.auditEntries.get(id) || null;
  }

  async query(filter: FhirAuditFilter): Promise<{
    entries: FhirAuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    let entries = Array.from(this.auditEntries.values());

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter.userId) {
      entries = entries.filter(e => e.userId === filter.userId);
    }
    if (filter.userRole) {
      entries = entries.filter(e => e.userRole === filter.userRole);
    }
    if (filter.action) {
      entries = entries.filter(e => e.action === filter.action);
    }
    if (filter.outcome) {
      entries = entries.filter(e => e.outcome === filter.outcome);
    }
    if (filter.resourceType) {
      entries = entries.filter(e => e.resourceType === filter.resourceType);
    }
    if (filter.resourceId) {
      entries = entries.filter(e => e.resourceId === filter.resourceId);
    }
    if (filter.patientId) {
      entries = entries.filter(e => e.patientId === filter.patientId);
    }
    if (filter.fhirVersion) {
      entries = entries.filter(e => e.fhirVersion === filter.fhirVersion);
    }
    if (filter.operationType) {
      entries = entries.filter(e => e.operationType.toLowerCase().includes(filter.operationType!.toLowerCase()));
    }
    if (filter.startDate) {
      entries = entries.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      entries = entries.filter(e => e.timestamp <= filter.endDate!);
    }
    if (filter.ipAddress) {
      entries = entries.filter(e => e.ipAddress.includes(filter.ipAddress!));
    }
    if (filter.phiAccessed !== undefined) {
      entries = entries.filter(e => e.phiAccessed === filter.phiAccessed);
    }
    if (filter.sourceSystem) {
      entries = entries.filter(e => e.sourceSystem === filter.sourceSystem);
    }

    const total = entries.length;
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    const paginatedEntries = entries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getStatistics(filter?: Partial<FhirAuditFilter>): Promise<FhirAuditStatistics> {
    const { entries } = await this.query({ ...filter, limit: 100000 });

    const byAction: Record<FhirAuditAction, number> = {
      read: 0, search: 0, create: 0, update: 0, delete: 0,
      export: 0, import: 0, validate: 0, transform: 0,
    };
    const byOutcome: Record<FhirAuditOutcome, number> = {
      success: 0, failure: 0, partial: 0,
    };
    const byResourceType: Record<string, number> = {};
    const byUserRole: Record<string, number> = {};
    const byFhirVersion: Record<string, number> = {};

    let totalResponseTime = 0;
    let phiAccessCount = 0;
    let errorCount = 0;
    let timestamps: string[] = [];

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
      byResourceType[entry.resourceType] = (byResourceType[entry.resourceType] || 0) + 1;
      byUserRole[entry.userRole] = (byUserRole[entry.userRole] || 0) + 1;
      byFhirVersion[entry.fhirVersion] = (byFhirVersion[entry.fhirVersion] || 0) + 1;
      
      totalResponseTime += entry.responseTimeMs;
      if (entry.phiAccessed) phiAccessCount++;
      if (entry.outcome === "failure") errorCount++;
      timestamps.push(entry.timestamp);
    }

    timestamps.sort();
    const timeRange = {
      start: timestamps[0] || new Date().toISOString(),
      end: timestamps[timestamps.length - 1] || new Date().toISOString(),
    };

    return {
      totalEntries: entries.length,
      byAction,
      byOutcome,
      byResourceType,
      byUserRole,
      byFhirVersion,
      averageResponseTime: entries.length > 0 ? Math.round(totalResponseTime / entries.length) : 0,
      phiAccessCount,
      errorCount,
      timeRange,
    };
  }

  async getDailySummary(days: number = 7): Promise<FhirAuditSummary[]> {
    const summaries: FhirAuditSummary[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      
      const startDate = `${dateStr}T00:00:00.000Z`;
      const endDate = `${dateStr}T23:59:59.999Z`;

      const { entries } = await this.query({ startDate, endDate, limit: 100000 });
      
      if (entries.length === 0) {
        summaries.push({
          date: dateStr,
          totalOperations: 0,
          successRate: 100,
          uniqueUsers: 0,
          topResources: [],
          topActions: [],
          averageResponseTime: 0,
        });
        continue;
      }

      const uniqueUsers = new Set(entries.map(e => e.userId)).size;
      const successCount = entries.filter(e => e.outcome === "success").length;
      const successRate = Math.round((successCount / entries.length) * 100);
      const avgResponseTime = Math.round(
        entries.reduce((sum, e) => sum + e.responseTimeMs, 0) / entries.length
      );

      const resourceCounts: Record<string, number> = {};
      const actionCounts: Record<string, number> = {};
      
      for (const entry of entries) {
        resourceCounts[entry.resourceType] = (resourceCounts[entry.resourceType] || 0) + 1;
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      }

      const topResources = Object.entries(resourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([resourceType, count]) => ({ resourceType, count }));

      const topActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));

      summaries.push({
        date: dateStr,
        totalOperations: entries.length,
        successRate,
        uniqueUsers,
        topResources,
        topActions,
        averageResponseTime: avgResponseTime,
      });
    }

    return summaries;
  }

  async getPatientAccessHistory(patientId: string, limit: number = 100): Promise<FhirAuditEntry[]> {
    const { entries } = await this.query({ patientId, limit });
    return entries;
  }

  async getUserActivityLog(userId: string, limit: number = 100): Promise<FhirAuditEntry[]> {
    const { entries } = await this.query({ userId, limit });
    return entries;
  }

  async getResourceHistory(resourceType: string, resourceId: string): Promise<FhirAuditEntry[]> {
    const { entries } = await this.query({ resourceType, resourceId, limit: 1000 });
    return entries;
  }

  async getComplianceReport(startDate: string, endDate: string): Promise<{
    totalPhiAccesses: number;
    uniqueUsersAccessingPhi: number;
    phiAccessesByRole: Record<string, number>;
    phiAccessesByResource: Record<string, number>;
    unauthorizedAttempts: number;
    exportOperations: number;
    highRiskOperations: FhirAuditEntry[];
  }> {
    const { entries } = await this.query({ 
      startDate, 
      endDate, 
      limit: 100000 
    });

    const phiEntries = entries.filter(e => e.phiAccessed);
    const uniqueUsers = new Set(phiEntries.map(e => e.userId));
    
    const phiAccessesByRole: Record<string, number> = {};
    const phiAccessesByResource: Record<string, number> = {};
    
    for (const entry of phiEntries) {
      phiAccessesByRole[entry.userRole] = (phiAccessesByRole[entry.userRole] || 0) + 1;
      phiAccessesByResource[entry.resourceType] = (phiAccessesByResource[entry.resourceType] || 0) + 1;
    }

    const unauthorizedAttempts = entries.filter(e => 
      e.outcome === "failure" && 
      (e.responseStatus === 401 || e.responseStatus === 403)
    ).length;

    const exportOperations = entries.filter(e => e.action === "export").length;

    const highRiskOperations = entries.filter(e => 
      e.action === "export" || 
      e.action === "delete" || 
      (e.bundleSize && e.bundleSize > 100)
    ).slice(0, 50);

    return {
      totalPhiAccesses: phiEntries.length,
      uniqueUsersAccessingPhi: uniqueUsers.size,
      phiAccessesByRole,
      phiAccessesByResource,
      unauthorizedAttempts,
      exportOperations,
      highRiskOperations,
    };
  }

  getResourceTypes(): string[] {
    const types = new Set<string>();
    const entries = Array.from(this.auditEntries.values());
    for (const entry of entries) {
      types.add(entry.resourceType);
    }
    return Array.from(types).sort();
  }

  getUserRoles(): string[] {
    const roles = new Set<string>();
    const entries = Array.from(this.auditEntries.values());
    for (const entry of entries) {
      roles.add(entry.userRole);
    }
    return Array.from(roles).sort();
  }

  getActions(): FhirAuditAction[] {
    return ["read", "search", "create", "update", "delete", "export", "import", "validate", "transform"];
  }

  getOutcomes(): FhirAuditOutcome[] {
    return ["success", "failure", "partial"];
  }
}

export const fhirAuditService = new FhirAuditService();
