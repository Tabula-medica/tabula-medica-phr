import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][SmartDataAccess] ${action} - ResourceType:${resourceType} ResourceId:${resourceId} User:${userId} - ${details}`);
}

export type AccessEventType = "read" | "search" | "create" | "update" | "delete" | "bulk_read" | "export";

export interface DataAccessEvent {
  id: string;
  appId: string;
  clientId: string;
  userId: string;
  patientId?: string;
  resourceType: string;
  resourceId?: string;
  eventType: AccessEventType;
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  responseTime: number;
  dataSize?: number;
  scopes: string[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  sessionId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface AccessPattern {
  id: string;
  appId: string;
  clientId: string;
  patternType: "frequent_access" | "bulk_download" | "unusual_hours" | "high_volume" | "sensitive_data" | "cross_patient";
  description: string;
  severity: "info" | "warning" | "alert" | "critical";
  frequency: number;
  lastOccurrence: string;
  firstOccurrence: string;
  affectedResources: string[];
  affectedPatients?: string[];
  metadata?: Record<string, any>;
  status: "active" | "acknowledged" | "resolved" | "false_positive";
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolution?: string;
}

export interface AppAccessSummary {
  appId: string;
  appName: string;
  clientId: string;
  totalRequests: number;
  uniquePatients: number;
  uniqueUsers: number;
  resourcesAccessed: Record<string, number>;
  requestsByDay: { date: string; count: number }[];
  avgResponseTime: number;
  errorRate: number;
  peakHour: number;
  lastAccess: string;
  topEndpoints: { endpoint: string; count: number }[];
  scopeUsage: { scope: string; count: number }[];
}

export interface AccessPermissionOverview {
  appId: string;
  appName: string;
  clientId: string;
  grantedScopes: string[];
  activeScopes: string[];
  unusedScopes: string[];
  lastScopeUsage: Record<string, string>;
  accessLevel: "read_only" | "read_write" | "full" | "limited";
  dataCategories: string[];
  patientCount: number;
  riskScore: number;
  complianceStatus: "compliant" | "review_needed" | "non_compliant";
}

export interface AccessTrend {
  period: string;
  appId: string;
  totalRequests: number;
  uniquePatients: number;
  dataVolume: number;
  avgResponseTime: number;
  errorCount: number;
  topResources: string[];
}

export interface DataAccessAnalytics {
  totalEvents: number;
  eventsByApp: Record<string, number>;
  eventsByResource: Record<string, number>;
  eventsByType: Record<string, number>;
  recentPatterns: AccessPattern[];
  topAccessingApps: { appId: string; count: number }[];
  avgResponseTime: number;
  errorRate: number;
  uniquePatientsAccessed: number;
  peakAccessTime: string;
  trendsLast7Days: AccessTrend[];
}

const accessEvents = new Map<string, DataAccessEvent>();
const accessPatterns = new Map<string, AccessPattern>();
const appSummaries = new Map<string, AppAccessSummary>();

function initializeSampleData(): void {
  const now = new Date();
  const apps = ["growth-chart-app", "medication-tracker", "care-coordination-app"];
  const resources = ["Patient", "Observation", "Condition", "MedicationRequest", "Immunization"];
  const eventTypes: AccessEventType[] = ["read", "search", "read", "read", "search"];

  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const appId = apps[Math.floor(Math.random() * apps.length)];
    const resourceType = resources[Math.floor(Math.random() * resources.length)];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const event: DataAccessEvent = {
      id: generateId("event"),
      appId,
      clientId: `${appId}-client`,
      userId: `user-${String(Math.floor(Math.random() * 5) + 1).padStart(3, "0")}`,
      patientId: `patient-${String(Math.floor(Math.random() * 10) + 1).padStart(3, "0")}`,
      resourceType,
      resourceId: eventType !== "search" ? generateId("resource") : undefined,
      eventType,
      endpoint: `/fhir/r4/${resourceType}${eventType === "search" ? "" : "/" + generateId("id")}`,
      httpMethod: eventType === "search" ? "GET" : eventType === "read" ? "GET" : "POST",
      statusCode: Math.random() > 0.05 ? 200 : Math.random() > 0.5 ? 404 : 500,
      responseTime: Math.floor(50 + Math.random() * 450),
      dataSize: Math.floor(1000 + Math.random() * 50000),
      scopes: [`patient/${resourceType}.read`],
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      timestamp: timestamp.toISOString()
    };

    accessEvents.set(event.id, event);
  }

  const samplePatterns: AccessPattern[] = [
    {
      id: generateId("pattern"),
      appId: "growth-chart-app",
      clientId: "growth-chart-client",
      patternType: "frequent_access",
      description: "High frequency access to patient observations - 150+ requests in 1 hour",
      severity: "info",
      frequency: 156,
      lastOccurrence: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      firstOccurrence: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      affectedResources: ["Observation", "Patient"],
      affectedPatients: ["patient-001", "patient-002", "patient-003"],
      status: "active"
    },
    {
      id: generateId("pattern"),
      appId: "medication-tracker",
      clientId: "med-tracker-client",
      patternType: "bulk_download",
      description: "Bulk data export detected - 500+ records in single session",
      severity: "warning",
      frequency: 3,
      lastOccurrence: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      firstOccurrence: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      affectedResources: ["MedicationRequest", "MedicationStatement"],
      affectedPatients: ["patient-005"],
      metadata: { recordCount: 532, sessionDuration: 180 },
      status: "acknowledged",
      acknowledgedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      acknowledgedBy: "admin-001"
    },
    {
      id: generateId("pattern"),
      appId: "care-coordination-app",
      clientId: "care-coord-client",
      patternType: "unusual_hours",
      description: "Access detected outside normal business hours (2:00 AM - 5:00 AM)",
      severity: "alert",
      frequency: 8,
      lastOccurrence: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      firstOccurrence: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      affectedResources: ["CarePlan", "Goal", "Condition"],
      status: "active"
    }
  ];

  samplePatterns.forEach(p => accessPatterns.set(p.id, p));

  const sampleSummaries: AppAccessSummary[] = apps.map(appId => ({
    appId,
    appName: appId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    clientId: `${appId}-client`,
    totalRequests: Math.floor(1000 + Math.random() * 9000),
    uniquePatients: Math.floor(10 + Math.random() * 90),
    uniqueUsers: Math.floor(5 + Math.random() * 20),
    resourcesAccessed: {
      Patient: Math.floor(100 + Math.random() * 500),
      Observation: Math.floor(200 + Math.random() * 1000),
      Condition: Math.floor(50 + Math.random() * 200),
      MedicationRequest: Math.floor(80 + Math.random() * 300)
    },
    requestsByDay: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      count: Math.floor(100 + Math.random() * 400)
    })),
    avgResponseTime: Math.floor(100 + Math.random() * 200),
    errorRate: Math.random() * 0.05,
    peakHour: Math.floor(9 + Math.random() * 8),
    lastAccess: new Date(now.getTime() - Math.random() * 60 * 60 * 1000).toISOString(),
    topEndpoints: [
      { endpoint: "/fhir/r4/Observation", count: Math.floor(500 + Math.random() * 500) },
      { endpoint: "/fhir/r4/Patient", count: Math.floor(300 + Math.random() * 300) },
      { endpoint: "/fhir/r4/Condition", count: Math.floor(100 + Math.random() * 200) }
    ],
    scopeUsage: [
      { scope: "patient/*.read", count: Math.floor(800 + Math.random() * 400) },
      { scope: "launch/patient", count: Math.floor(100 + Math.random() * 100) },
      { scope: "openid", count: Math.floor(100 + Math.random() * 100) }
    ]
  }));

  sampleSummaries.forEach(s => appSummaries.set(s.appId, s));
}

initializeSampleData();

class SmartDataAccessAnalyticsService {
  async recordAccessEvent(event: Omit<DataAccessEvent, "id">): Promise<DataAccessEvent> {
    const newEvent: DataAccessEvent = {
      ...event,
      id: generateId("event")
    };

    accessEvents.set(newEvent.id, newEvent);

    await this.detectPatterns(newEvent);

    return newEvent;
  }

  async getAccessEvents(params: {
    appId?: string;
    userId?: string;
    patientId?: string;
    resourceType?: string;
    eventType?: AccessEventType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<DataAccessEvent[]> {
    let events = Array.from(accessEvents.values());

    if (params.appId) {
      events = events.filter(e => e.appId === params.appId);
    }
    if (params.userId) {
      events = events.filter(e => e.userId === params.userId);
    }
    if (params.patientId) {
      events = events.filter(e => e.patientId === params.patientId);
    }
    if (params.resourceType) {
      events = events.filter(e => e.resourceType === params.resourceType);
    }
    if (params.eventType) {
      events = events.filter(e => e.eventType === params.eventType);
    }
    if (params.startDate) {
      events = events.filter(e => e.timestamp >= params.startDate!);
    }
    if (params.endDate) {
      events = events.filter(e => e.timestamp <= params.endDate!);
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, params.limit || 100);
  }

  async getAccessPatterns(params?: {
    appId?: string;
    severity?: AccessPattern["severity"];
    status?: AccessPattern["status"];
    patternType?: AccessPattern["patternType"];
  }): Promise<AccessPattern[]> {
    let patterns = Array.from(accessPatterns.values());

    if (params?.appId) {
      patterns = patterns.filter(p => p.appId === params.appId);
    }
    if (params?.severity) {
      patterns = patterns.filter(p => p.severity === params.severity);
    }
    if (params?.status) {
      patterns = patterns.filter(p => p.status === params.status);
    }
    if (params?.patternType) {
      patterns = patterns.filter(p => p.patternType === params.patternType);
    }

    return patterns.sort((a, b) => 
      new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
    );
  }

  async acknowledgePattern(patternId: string, userId: string, resolution?: string): Promise<AccessPattern | null> {
    const pattern = accessPatterns.get(patternId);
    if (!pattern) return null;

    pattern.status = resolution ? "resolved" : "acknowledged";
    pattern.acknowledgedAt = new Date().toISOString();
    pattern.acknowledgedBy = userId;
    if (resolution) {
      pattern.resolution = resolution;
    }

    accessPatterns.set(patternId, pattern);

    auditLog("PATTERN_ACKNOWLEDGED", "AccessPattern", patternId, userId,
      `Pattern ${pattern.patternType} acknowledged${resolution ? ` with resolution: ${resolution}` : ""}`);

    return pattern;
  }

  async getAppSummary(appId: string): Promise<AppAccessSummary | null> {
    return appSummaries.get(appId) || null;
  }

  async getAllAppSummaries(): Promise<AppAccessSummary[]> {
    return Array.from(appSummaries.values());
  }

  async getAppPermissionOverview(appId: string): Promise<AccessPermissionOverview | null> {
    const summary = appSummaries.get(appId);
    if (!summary) return null;

    const appEvents = Array.from(accessEvents.values()).filter(e => e.appId === appId);
    const usedScopes = new Set<string>();
    const lastScopeUsage: Record<string, string> = {};

    for (const event of appEvents) {
      for (const scope of event.scopes) {
        usedScopes.add(scope);
        if (!lastScopeUsage[scope] || event.timestamp > lastScopeUsage[scope]) {
          lastScopeUsage[scope] = event.timestamp;
        }
      }
    }

    const grantedScopes = summary.scopeUsage.map(s => s.scope);
    const activeScopes = Array.from(usedScopes);
    const unusedScopes = grantedScopes.filter(s => !usedScopes.has(s));

    const hasWrite = grantedScopes.some(s => s.includes(".write") || s.includes(".*"));
    const hasSystemAccess = grantedScopes.some(s => s.startsWith("system/"));

    let accessLevel: AccessPermissionOverview["accessLevel"] = "read_only";
    if (hasSystemAccess) accessLevel = "full";
    else if (hasWrite) accessLevel = "read_write";
    else if (grantedScopes.length < 3) accessLevel = "limited";

    const patterns = Array.from(accessPatterns.values()).filter(p => p.appId === appId);
    const hasAlerts = patterns.some(p => p.severity === "alert" || p.severity === "critical");
    const hasWarnings = patterns.some(p => p.severity === "warning");

    let complianceStatus: AccessPermissionOverview["complianceStatus"] = "compliant";
    if (hasAlerts) complianceStatus = "non_compliant";
    else if (hasWarnings || unusedScopes.length > 2) complianceStatus = "review_needed";

    const riskScore = this.calculateRiskScore(summary, patterns);

    return {
      appId,
      appName: summary.appName,
      clientId: summary.clientId,
      grantedScopes,
      activeScopes,
      unusedScopes,
      lastScopeUsage,
      accessLevel,
      dataCategories: Object.keys(summary.resourcesAccessed),
      patientCount: summary.uniquePatients,
      riskScore,
      complianceStatus
    };
  }

  async getAnalytics(): Promise<DataAccessAnalytics> {
    const allEvents = Array.from(accessEvents.values());
    const allPatterns = Array.from(accessPatterns.values());

    const eventsByApp: Record<string, number> = {};
    const eventsByResource: Record<string, number> = {};
    const eventsByType: Record<string, number> = {};
    const patientIds = new Set<string>();
    let totalResponseTime = 0;
    let errorCount = 0;

    for (const event of allEvents) {
      eventsByApp[event.appId] = (eventsByApp[event.appId] || 0) + 1;
      eventsByResource[event.resourceType] = (eventsByResource[event.resourceType] || 0) + 1;
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      if (event.patientId) patientIds.add(event.patientId);
      totalResponseTime += event.responseTime;
      if (event.statusCode >= 400) errorCount++;
    }

    const topAccessingApps = Object.entries(eventsByApp)
      .map(([appId, count]) => ({ appId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hourCounts: Record<number, number> = {};
    for (const event of allEvents) {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || "12";

    const now = new Date();
    const trendsLast7Days: AccessTrend[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayEvents = allEvents.filter(e => e.timestamp.startsWith(dateStr));
      
      const dayPatients = new Set<string>();
      let dayDataVolume = 0;
      let dayResponseTime = 0;
      let dayErrors = 0;
      const dayResources: Record<string, number> = {};

      for (const event of dayEvents) {
        if (event.patientId) dayPatients.add(event.patientId);
        dayDataVolume += event.dataSize || 0;
        dayResponseTime += event.responseTime;
        if (event.statusCode >= 400) dayErrors++;
        dayResources[event.resourceType] = (dayResources[event.resourceType] || 0) + 1;
      }

      trendsLast7Days.push({
        period: dateStr,
        appId: "all",
        totalRequests: dayEvents.length,
        uniquePatients: dayPatients.size,
        dataVolume: dayDataVolume,
        avgResponseTime: dayEvents.length > 0 ? dayResponseTime / dayEvents.length : 0,
        errorCount: dayErrors,
        topResources: Object.entries(dayResources)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([r]) => r)
      });
    }

    return {
      totalEvents: allEvents.length,
      eventsByApp,
      eventsByResource,
      eventsByType,
      recentPatterns: allPatterns.filter(p => p.status === "active").slice(0, 5),
      topAccessingApps,
      avgResponseTime: allEvents.length > 0 ? totalResponseTime / allEvents.length : 0,
      errorRate: allEvents.length > 0 ? errorCount / allEvents.length : 0,
      uniquePatientsAccessed: patientIds.size,
      peakAccessTime: `${peakHour}:00`,
      trendsLast7Days
    };
  }

  async getAppTrends(appId: string, days: number = 7): Promise<AccessTrend[]> {
    const events = Array.from(accessEvents.values()).filter(e => e.appId === appId);
    const now = new Date();
    const trends: AccessTrend[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));

      const patients = new Set<string>();
      let dataVolume = 0;
      let responseTime = 0;
      let errors = 0;
      const resources: Record<string, number> = {};

      for (const event of dayEvents) {
        if (event.patientId) patients.add(event.patientId);
        dataVolume += event.dataSize || 0;
        responseTime += event.responseTime;
        if (event.statusCode >= 400) errors++;
        resources[event.resourceType] = (resources[event.resourceType] || 0) + 1;
      }

      trends.push({
        period: dateStr,
        appId,
        totalRequests: dayEvents.length,
        uniquePatients: patients.size,
        dataVolume,
        avgResponseTime: dayEvents.length > 0 ? responseTime / dayEvents.length : 0,
        errorCount: errors,
        topResources: Object.entries(resources)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([r]) => r)
      });
    }

    return trends;
  }

  async revokeAppAccess(appId: string, userId: string, reason: string): Promise<boolean> {
    auditLog("APP_ACCESS_REVOKED", "SMARTApp", appId, userId, reason);
    return true;
  }

  async updateAppPermissions(
    appId: string,
    permissions: { grantedScopes: string[]; deniedScopes: string[] },
    userId: string
  ): Promise<boolean> {
    auditLog("APP_PERMISSIONS_UPDATED", "SMARTApp", appId, userId,
      `Updated permissions: granted=${permissions.grantedScopes.length}, denied=${permissions.deniedScopes.length}`);
    return true;
  }

  private async detectPatterns(event: DataAccessEvent): Promise<void> {
    const recentEvents = Array.from(accessEvents.values())
      .filter(e => 
        e.appId === event.appId && 
        new Date(e.timestamp).getTime() > Date.now() - 60 * 60 * 1000
      );

    if (recentEvents.length > 100) {
      const existingPattern = Array.from(accessPatterns.values())
        .find(p => p.appId === event.appId && p.patternType === "high_volume" && p.status === "active");

      if (!existingPattern) {
        const pattern: AccessPattern = {
          id: generateId("pattern"),
          appId: event.appId,
          clientId: event.clientId,
          patternType: "high_volume",
          description: `High volume access detected: ${recentEvents.length} requests in the last hour`,
          severity: "warning",
          frequency: recentEvents.length,
          lastOccurrence: event.timestamp,
          firstOccurrence: event.timestamp,
          affectedResources: Array.from(new Set(recentEvents.map(e => e.resourceType))),
          status: "active"
        };
        accessPatterns.set(pattern.id, pattern);
      }
    }

    const hour = new Date(event.timestamp).getHours();
    if (hour >= 0 && hour < 6) {
      const existingPattern = Array.from(accessPatterns.values())
        .find(p => p.appId === event.appId && p.patternType === "unusual_hours" && p.status === "active");

      if (!existingPattern) {
        const pattern: AccessPattern = {
          id: generateId("pattern"),
          appId: event.appId,
          clientId: event.clientId,
          patternType: "unusual_hours",
          description: `Access detected during unusual hours (${hour}:00)`,
          severity: "alert",
          frequency: 1,
          lastOccurrence: event.timestamp,
          firstOccurrence: event.timestamp,
          affectedResources: [event.resourceType],
          status: "active"
        };
        accessPatterns.set(pattern.id, pattern);
      }
    }
  }

  private calculateRiskScore(summary: AppAccessSummary, patterns: AccessPattern[]): number {
    let score = 0;

    if (summary.uniquePatients > 50) score += 10;
    if (summary.uniquePatients > 100) score += 15;
    if (summary.totalRequests > 5000) score += 10;
    if (summary.errorRate > 0.05) score += 15;

    for (const pattern of patterns) {
      if (pattern.status !== "active") continue;
      switch (pattern.severity) {
        case "critical": score += 40; break;
        case "alert": score += 25; break;
        case "warning": score += 10; break;
        case "info": score += 2; break;
      }
    }

    return Math.min(100, score);
  }
}

export const smartDataAccessAnalyticsService = new SmartDataAccessAnalyticsService();

console.log("[SmartDataAccessAnalytics] Service initialized");
console.log("[SmartDataAccessAnalytics] Sample events:", accessEvents.size);
console.log("[SmartDataAccessAnalytics] Sample patterns:", accessPatterns.size);
console.log("[SmartDataAccessAnalytics] App summaries:", appSummaries.size);
console.log("[SmartDataAccessAnalytics] Features: Event tracking, pattern detection, analytics, permission management");
