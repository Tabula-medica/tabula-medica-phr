import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

export interface SMARTApp {
  id: string;
  clientId: string;
  name: string;
  description: string;
  launchUri: string;
  redirectUris: string[];
  scopes: string[];
  status: "active" | "suspended" | "revoked";
  trustLevel: "trusted" | "standard" | "restricted";
  registeredAt: string;
  lastAccessedAt?: string;
  totalRequests: number;
  metadata: {
    vendor?: string;
    version?: string;
    category?: string;
    certification?: string;
  };
}

export interface SMARTAppAccessControl {
  id: string;
  appId: string;
  appName: string;
  enabled: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
    concurrentRequests: number;
  };
  resourcePermissions: {
    resourceType: string;
    operations: ("read" | "search" | "create" | "update" | "delete")[];
    scopeRequired: string;
    maxResultsPerQuery: number;
  }[];
  scopeRestrictions: {
    allowedScopes: string[];
    deniedScopes: string[];
    requirePatientContext: boolean;
    requireUserContext: boolean;
  };
  ipWhitelist: string[];
  ipBlacklist: string[];
  timeRestrictions?: {
    allowedHours: { start: number; end: number };
    allowedDays: number[];
    timezone: string;
  };
  auditLevel: "minimal" | "standard" | "detailed" | "full";
  createdAt: string;
  updatedAt: string;
}

export interface UserAccessControl {
  id: string;
  userId: string;
  username: string;
  role: string;
  enabled: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
  };
  resourcePermissions: {
    resourceType: string;
    operations: ("read" | "search" | "create" | "update" | "delete")[];
    patientScope?: "self" | "all" | "department" | "organization";
    maxExportSize: number;
  }[];
  mfaRequired: boolean;
  sessionTimeout: number;
  lastActive: string;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitBucket {
  identifier: string;
  type: "app" | "user" | "ip" | "combined";
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  minuteResetAt: number;
  hourResetAt: number;
  dayResetAt: number;
  concurrentCount: number;
  blocked: boolean;
  blockedUntil?: number;
  blockedReason?: string;
  violations: number;
  lastRequest: number;
}

export interface RateLimitResult {
  allowed: boolean;
  identifier: string;
  type: string;
  remaining: {
    minute: number;
    hour: number;
    day: number;
    concurrent: number;
  };
  resetAt: {
    minute: number;
    hour: number;
    day: number;
  };
  blocked: boolean;
  blockedUntil?: number;
  reason?: string;
  retryAfter?: number;
}

export interface AccessToken {
  id: string;
  tokenHash: string;
  appId: string;
  appClientId: string;
  userId?: string;
  patientId?: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  usageCount: number;
  revokedAt?: string;
  revokedReason?: string;
  metadata: {
    issuer: string;
    audience: string;
    launchContext?: Record<string, string>;
    fhirContext?: {
      patient?: string;
      encounter?: string;
      fhirUser?: string;
    };
  };
}

export interface GatewayAuditLog {
  id: string;
  timestamp: string;
  requestId: string;
  appId?: string;
  appClientId?: string;
  appName?: string;
  userId?: string;
  username?: string;
  userRole?: string;
  patientContext?: string;
  clientIp: string;
  userAgent?: string;
  method: string;
  endpoint: string;
  resourceType?: string;
  resourceId?: string;
  operation: string;
  queryParameters?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseTimeMs: number;
  responseSize?: number;
  accessDecision: {
    allowed: boolean;
    policyId?: string;
    reason: string;
    riskScore: number;
  };
  rateLimitStatus: {
    allowed: boolean;
    remaining: number;
    limit: number;
  };
  tokenInfo?: {
    tokenId: string;
    scopes: string[];
    expiresAt: string;
    issuedAt: string;
  };
  threatDetection: {
    threatLevel: "none" | "low" | "medium" | "high" | "critical";
    threats: string[];
    blocked: boolean;
    aiAnalysis?: string;
  };
  phiAccessed: boolean;
  sensitivityLevel: "low" | "medium" | "high" | "restricted";
  complianceFlags: string[];
  errorDetails?: string;
}

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  type: "brute_force" | "enumeration" | "injection" | "unauthorized_access" | "data_exfiltration" | "anomalous_behavior" | "credential_abuse" | "scope_escalation";
  severity: "low" | "medium" | "high" | "critical";
  indicators: string[];
  detectionRules: {
    metric: string;
    operator: "gt" | "lt" | "eq" | "contains" | "regex";
    threshold: number | string;
    windowSeconds: number;
  }[];
  mitigation: "log" | "alert" | "rate_limit" | "block" | "challenge";
  enabled: boolean;
  aiEnhanced: boolean;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  patternId: string;
  patternName: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  appId?: string;
  appName?: string;
  userId?: string;
  clientIp: string;
  description: string;
  indicators: string[];
  evidenceData: Record<string, unknown>;
  mitigationApplied: string;
  aiAnalysis?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  falsePositive?: boolean;
}

export interface AIThreatAnalysis {
  id: string;
  timestamp: string;
  analysisType: "real_time" | "batch" | "pattern_learning";
  inputData: {
    requestCount: number;
    timeWindowMinutes: number;
    uniqueApps: number;
    uniqueUsers: number;
    uniqueIps: number;
  };
  findings: {
    threatLevel: "none" | "low" | "medium" | "high" | "critical";
    anomaliesDetected: number;
    suspiciousPatterns: string[];
    recommendations: string[];
  };
  detailedAnalysis: string;
  confidenceScore: number;
  modelVersion: string;
}

export interface SecurityDashboard {
  summary: {
    totalApps: number;
    activeApps: number;
    suspendedApps: number;
    totalUsers: number;
    activeTokens: number;
    totalRequestsToday: number;
    blockedRequestsToday: number;
    threatEventsToday: number;
  };
  rateLimiting: {
    currentlyBlocked: number;
    violationsLast24h: number;
    topViolators: { identifier: string; type: string; violations: number }[];
  };
  threats: {
    activeThreats: number;
    threatsByLevel: Record<string, number>;
    recentEvents: ThreatEvent[];
  };
  accessPatterns: {
    requestsByApp: Record<string, number>;
    requestsByUser: Record<string, number>;
    requestsByResourceType: Record<string, number>;
    peakHourDistribution: number[];
  };
  compliance: {
    auditLogsToday: number;
    phiAccessCount: number;
    sensitiveAccessCount: number;
    complianceViolations: number;
  };
}

const FHIR_SCOPES = [
  "patient/*.read", "patient/*.write", "patient/*.*",
  "user/*.read", "user/*.write", "user/*.*",
  "system/*.read", "system/*.write", "system/*.*",
  "launch", "launch/patient", "launch/encounter",
  "openid", "profile", "fhirUser", "offline_access"
];

const FHIR_RESOURCE_TYPES = [
  "Patient", "Practitioner", "Organization", "Encounter", "Condition",
  "Observation", "Procedure", "MedicationRequest", "MedicationStatement",
  "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan",
  "CareTeam", "Goal", "ServiceRequest", "Appointment", "DocumentReference"
];

class FHIRAPIGatewaySecurityService {
  private smartApps: Map<string, SMARTApp> = new Map();
  private appAccessControls: Map<string, SMARTAppAccessControl> = new Map();
  private userAccessControls: Map<string, UserAccessControl> = new Map();
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();
  private accessTokens: Map<string, AccessToken> = new Map();
  private auditLogs: GatewayAuditLog[] = [];
  private threatPatterns: Map<string, ThreatPattern> = new Map();
  private threatEvents: ThreatEvent[] = [];
  private aiAnalyses: AIThreatAnalysis[] = [];
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
    this.initializeThreatPatterns();
    this.initializeSampleData();
    console.log("[FHIRGatewaySecurity] Service initialized with SMART app controls and AI threat detection");
  }

  private initializeOpenAI() {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (apiKey) {
      this.openai = new OpenAI({ apiKey, baseURL });
      console.log("[FHIRGatewaySecurity] OpenAI client initialized for AI threat detection");
    }
  }

  private initializeSampleData() {
    const apps: SMARTApp[] = [
      {
        id: randomUUID(),
        clientId: "epic-mychart-mobile",
        name: "Fasten Health Mobile",
        description: "Patient-facing mobile app for health record access",
        launchUri: "https://mychart.epic.com/launch",
        redirectUris: ["https://mychart.epic.com/callback"],
        scopes: ["patient/*.read", "launch/patient", "openid", "profile"],
        status: "active",
        trustLevel: "trusted",
        registeredAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        totalRequests: 45230,
        metadata: { vendor: "Fasten Health", version: "11.0", category: "Patient Portal", certification: "ONC Certified" }
      },
      {
        id: randomUUID(),
        clientId: "cerner-powerchart",
        name: "Hospital Network",
        description: "Clinical workflow application for providers",
        launchUri: "https://powerchart.cerner.com/launch",
        redirectUris: ["https://powerchart.cerner.com/callback"],
        scopes: ["user/*.read", "user/*.write", "launch", "openid", "fhirUser"],
        status: "active",
        trustLevel: "trusted",
        registeredAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        totalRequests: 128450,
        metadata: { vendor: "Hospital Network", version: "2024.1", category: "EHR", certification: "ONC Certified" }
      },
      {
        id: randomUUID(),
        clientId: "health-analytics-app",
        name: "Health Analytics Dashboard",
        description: "Third-party analytics and reporting application",
        launchUri: "https://analytics.example.com/launch",
        redirectUris: ["https://analytics.example.com/callback"],
        scopes: ["system/*.read", "openid"],
        status: "active",
        trustLevel: "standard",
        registeredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastAccessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        totalRequests: 8920,
        metadata: { vendor: "HealthTech Inc", version: "2.1.0", category: "Analytics" }
      },
      {
        id: randomUUID(),
        clientId: "suspicious-app-xyz",
        name: "Suspicious Research App",
        description: "Newly registered app with unusual access patterns",
        launchUri: "https://unknown.example.com/launch",
        redirectUris: ["https://unknown.example.com/callback"],
        scopes: ["patient/*.*", "system/*.*"],
        status: "suspended",
        trustLevel: "restricted",
        registeredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        totalRequests: 15420,
        metadata: { vendor: "Unknown", category: "Research" }
      }
    ];

    apps.forEach(app => {
      this.smartApps.set(app.id, app);
      
      const accessControl: SMARTAppAccessControl = {
        id: randomUUID(),
        appId: app.id,
        appName: app.name,
        enabled: app.status === "active",
        rateLimits: {
          requestsPerMinute: app.trustLevel === "trusted" ? 120 : app.trustLevel === "standard" ? 60 : 20,
          requestsPerHour: app.trustLevel === "trusted" ? 5000 : app.trustLevel === "standard" ? 2000 : 500,
          requestsPerDay: app.trustLevel === "trusted" ? 100000 : app.trustLevel === "standard" ? 20000 : 2000,
          burstLimit: app.trustLevel === "trusted" ? 50 : app.trustLevel === "standard" ? 25 : 10,
          concurrentRequests: app.trustLevel === "trusted" ? 20 : app.trustLevel === "standard" ? 10 : 5
        },
        resourcePermissions: FHIR_RESOURCE_TYPES.slice(0, app.trustLevel === "restricted" ? 3 : 10).map(rt => ({
          resourceType: rt,
          operations: app.trustLevel === "trusted" ? ["read", "search", "create", "update"] : ["read", "search"],
          scopeRequired: `patient/${rt}.read`,
          maxResultsPerQuery: app.trustLevel === "trusted" ? 1000 : 100
        })),
        scopeRestrictions: {
          allowedScopes: app.scopes,
          deniedScopes: app.trustLevel === "restricted" ? ["system/*.*", "user/*.write"] : [],
          requirePatientContext: app.scopes.includes("launch/patient"),
          requireUserContext: app.scopes.includes("fhirUser")
        },
        ipWhitelist: [],
        ipBlacklist: app.status === "suspended" ? ["*"] : [],
        auditLevel: app.trustLevel === "restricted" ? "full" : "standard",
        createdAt: app.registeredAt,
        updatedAt: new Date().toISOString()
      };
      this.appAccessControls.set(accessControl.id, accessControl);
    });

    const users: UserAccessControl[] = [
      {
        id: randomUUID(),
        userId: "dr-smith-001",
        username: "dr.smith@hospital.org",
        role: "physician",
        enabled: true,
        rateLimits: { requestsPerMinute: 100, requestsPerHour: 3000, requestsPerDay: 50000, burstLimit: 30 },
        resourcePermissions: FHIR_RESOURCE_TYPES.map(rt => ({
          resourceType: rt,
          operations: ["read", "search", "create", "update", "delete"] as const,
          patientScope: "department" as const,
          maxExportSize: 10000
        })),
        mfaRequired: true,
        sessionTimeout: 3600,
        lastActive: new Date().toISOString(),
        riskScore: 5,
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: randomUUID(),
        userId: "nurse-jones-002",
        username: "nurse.jones@hospital.org",
        role: "nurse",
        enabled: true,
        rateLimits: { requestsPerMinute: 60, requestsPerHour: 2000, requestsPerDay: 30000, burstLimit: 20 },
        resourcePermissions: FHIR_RESOURCE_TYPES.slice(0, 12).map(rt => ({
          resourceType: rt,
          operations: ["read", "search"] as const,
          patientScope: "department" as const,
          maxExportSize: 5000
        })),
        mfaRequired: false,
        sessionTimeout: 1800,
        lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        riskScore: 10,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: randomUUID(),
        userId: "patient-doe-003",
        username: "john.doe@email.com",
        role: "patient",
        enabled: true,
        rateLimits: { requestsPerMinute: 30, requestsPerHour: 500, requestsPerDay: 5000, burstLimit: 10 },
        resourcePermissions: ["Patient", "Observation", "Condition", "MedicationRequest", "Immunization"].map(rt => ({
          resourceType: rt,
          operations: ["read", "search"] as const,
          patientScope: "self" as const,
          maxExportSize: 1000
        })),
        mfaRequired: false,
        sessionTimeout: 900,
        lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        riskScore: 15,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    users.forEach(user => this.userAccessControls.set(user.id, user));

    this.generateSampleAuditLogs();
    this.generateSampleThreatEvents();
  }

  private initializeThreatPatterns() {
    const patterns: ThreatPattern[] = [
      {
        id: randomUUID(),
        name: "Brute Force Authentication",
        description: "Multiple failed authentication attempts from same source",
        type: "brute_force",
        severity: "high",
        indicators: ["failed_auth_count > 5 in 5 minutes", "same_ip", "multiple_users_attempted"],
        detectionRules: [
          { metric: "failed_auth_count", operator: "gt", threshold: 5, windowSeconds: 300 }
        ],
        mitigation: "block",
        enabled: true,
        aiEnhanced: true
      },
      {
        id: randomUUID(),
        name: "Patient Enumeration Attack",
        description: "Sequential access to patient IDs suggesting enumeration",
        type: "enumeration",
        severity: "critical",
        indicators: ["sequential_patient_ids", "high_404_rate", "rapid_requests"],
        detectionRules: [
          { metric: "patient_access_rate", operator: "gt", threshold: 50, windowSeconds: 60 },
          { metric: "not_found_rate", operator: "gt", threshold: 30, windowSeconds: 60 }
        ],
        mitigation: "block",
        enabled: true,
        aiEnhanced: true
      },
      {
        id: randomUUID(),
        name: "Scope Escalation Attempt",
        description: "Attempts to access resources beyond granted scopes",
        type: "scope_escalation",
        severity: "high",
        indicators: ["scope_violation", "unauthorized_resource_access", "permission_denied_spike"],
        detectionRules: [
          { metric: "unauthorized_access_count", operator: "gt", threshold: 3, windowSeconds: 300 }
        ],
        mitigation: "alert",
        enabled: true,
        aiEnhanced: true
      },
      {
        id: randomUUID(),
        name: "Data Exfiltration Pattern",
        description: "Unusually large data exports or bulk access patterns",
        type: "data_exfiltration",
        severity: "critical",
        indicators: ["large_bundle_requests", "export_operations", "unusual_data_volume"],
        detectionRules: [
          { metric: "data_volume_mb", operator: "gt", threshold: 100, windowSeconds: 3600 },
          { metric: "bundle_size", operator: "gt", threshold: 500, windowSeconds: 60 }
        ],
        mitigation: "rate_limit",
        enabled: true,
        aiEnhanced: true
      },
      {
        id: randomUUID(),
        name: "Anomalous Access Time",
        description: "Access patterns outside normal user behavior profile",
        type: "anomalous_behavior",
        severity: "medium",
        indicators: ["off_hours_access", "unusual_geo_location", "device_change"],
        detectionRules: [
          { metric: "hour_of_day", operator: "lt", threshold: 6, windowSeconds: 0 },
          { metric: "hour_of_day", operator: "gt", threshold: 22, windowSeconds: 0 }
        ],
        mitigation: "alert",
        enabled: true,
        aiEnhanced: true
      },
      {
        id: randomUUID(),
        name: "Credential Reuse Detection",
        description: "Same token used from multiple IPs or unusual locations",
        type: "credential_abuse",
        severity: "high",
        indicators: ["token_ip_mismatch", "concurrent_sessions", "geo_velocity_violation"],
        detectionRules: [
          { metric: "unique_ips_per_token", operator: "gt", threshold: 2, windowSeconds: 3600 }
        ],
        mitigation: "challenge",
        enabled: true,
        aiEnhanced: true
      }
    ];

    patterns.forEach(p => this.threatPatterns.set(p.id, p));
  }

  private generateSampleAuditLogs() {
    const apps = Array.from(this.smartApps.values());
    const users = Array.from(this.userAccessControls.values());
    const operations = ["read", "search", "create", "update"];
    const now = Date.now();

    for (let i = 0; i < 100; i++) {
      const app = apps[Math.floor(Math.random() * apps.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const resourceType = FHIR_RESOURCE_TYPES[Math.floor(Math.random() * FHIR_RESOURCE_TYPES.length)];
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const timestamp = new Date(now - Math.random() * 24 * 60 * 60 * 1000).toISOString();
      const isBlocked = Math.random() < 0.05;
      const hasThreat = Math.random() < 0.08;

      const log: GatewayAuditLog = {
        id: randomUUID(),
        timestamp,
        requestId: randomUUID(),
        appId: app.id,
        appClientId: app.clientId,
        appName: app.name,
        userId: user.userId,
        username: user.username,
        userRole: user.role,
        patientContext: `patient-${Math.floor(Math.random() * 1000)}`,
        clientIp: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: "Mozilla/5.0 (SMART App Client)",
        method: operation === "read" || operation === "search" ? "GET" : "POST",
        endpoint: `/fhir/${resourceType}${operation === "read" ? `/${randomUUID()}` : ""}`,
        resourceType,
        resourceId: operation === "read" ? randomUUID() : undefined,
        operation,
        responseStatus: isBlocked ? 403 : (Math.random() < 0.98 ? 200 : 404),
        responseTimeMs: Math.floor(Math.random() * 500) + 50,
        responseSize: Math.floor(Math.random() * 50000) + 500,
        accessDecision: {
          allowed: !isBlocked,
          policyId: isBlocked ? "policy-restrict" : undefined,
          reason: isBlocked ? "Rate limit exceeded" : "Access granted",
          riskScore: Math.floor(Math.random() * 30)
        },
        rateLimitStatus: {
          allowed: !isBlocked,
          remaining: Math.floor(Math.random() * 100),
          limit: 120
        },
        tokenInfo: {
          tokenId: `token-${hashIdentifier(app.clientId + user.userId)}`,
          scopes: app.scopes.slice(0, 3),
          expiresAt: new Date(now + 3600 * 1000).toISOString(),
          issuedAt: new Date(now - 1800 * 1000).toISOString()
        },
        threatDetection: {
          threatLevel: hasThreat ? (Math.random() < 0.3 ? "high" : "medium") : "none",
          threats: hasThreat ? ["unusual_access_pattern"] : [],
          blocked: isBlocked && hasThreat
        },
        phiAccessed: ["Patient", "Observation", "Condition", "MedicationRequest"].includes(resourceType),
        sensitivityLevel: resourceType === "Patient" ? "high" : "medium",
        complianceFlags: []
      };

      this.auditLogs.push(log);
    }

    this.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private generateSampleThreatEvents() {
    const patterns = Array.from(this.threatPatterns.values());
    const apps = Array.from(this.smartApps.values());
    const now = Date.now();

    for (let i = 0; i < 15; i++) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      const app = apps[Math.floor(Math.random() * apps.length)];
      const timestamp = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

      const event: ThreatEvent = {
        id: randomUUID(),
        timestamp,
        patternId: pattern.id,
        patternName: pattern.name,
        type: pattern.type,
        severity: pattern.severity,
        appId: app.id,
        appName: app.name,
        clientIp: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        description: `Detected ${pattern.name} from ${app.name}`,
        indicators: pattern.indicators.slice(0, 2),
        evidenceData: { requestCount: Math.floor(Math.random() * 100) + 10, timeWindow: "5 minutes" },
        mitigationApplied: pattern.mitigation,
        resolved: Math.random() < 0.6,
        resolvedAt: Math.random() < 0.6 ? new Date(now - Math.random() * 24 * 60 * 60 * 1000).toISOString() : undefined,
        falsePositive: Math.random() < 0.15
      };

      this.threatEvents.push(event);
    }

    this.threatEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  checkRateLimit(identifier: string, type: "app" | "user" | "ip" | "combined", limits: { requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number; burstLimit: number; concurrentRequests?: number }): RateLimitResult {
    const bucketKey = `${type}:${identifier}`;
    const now = Date.now();

    let bucket = this.rateLimitBuckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        identifier,
        type,
        minuteCount: 0,
        hourCount: 0,
        dayCount: 0,
        minuteResetAt: now + 60000,
        hourResetAt: now + 3600000,
        dayResetAt: now + 86400000,
        concurrentCount: 0,
        blocked: false,
        violations: 0,
        lastRequest: now
      };
      this.rateLimitBuckets.set(bucketKey, bucket);
    }

    if (now >= bucket.minuteResetAt) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + 60000;
    }
    if (now >= bucket.hourResetAt) {
      bucket.hourCount = 0;
      bucket.hourResetAt = now + 3600000;
    }
    if (now >= bucket.dayResetAt) {
      bucket.dayCount = 0;
      bucket.dayResetAt = now + 86400000;
    }

    if (bucket.blocked && bucket.blockedUntil && now < bucket.blockedUntil) {
      return {
        allowed: false,
        identifier,
        type,
        remaining: { minute: 0, hour: 0, day: 0, concurrent: 0 },
        resetAt: { minute: bucket.minuteResetAt, hour: bucket.hourResetAt, day: bucket.dayResetAt },
        blocked: true,
        blockedUntil: bucket.blockedUntil,
        reason: bucket.blockedReason || "Rate limit exceeded",
        retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000)
      };
    } else if (bucket.blocked) {
      bucket.blocked = false;
      bucket.blockedUntil = undefined;
      bucket.blockedReason = undefined;
    }

    const minuteExceeded = bucket.minuteCount >= limits.requestsPerMinute;
    const hourExceeded = bucket.hourCount >= limits.requestsPerHour;
    const dayExceeded = bucket.dayCount >= limits.requestsPerDay;
    const concurrentExceeded = limits.concurrentRequests !== undefined && bucket.concurrentCount >= limits.concurrentRequests;

    if (minuteExceeded || hourExceeded || dayExceeded || concurrentExceeded) {
      bucket.violations++;
      
      if (bucket.violations >= 5) {
        bucket.blocked = true;
        bucket.blockedUntil = now + 300000;
        bucket.blockedReason = "Repeated rate limit violations";
      }

      let reason = "";
      if (minuteExceeded) reason = "Minute limit exceeded";
      else if (hourExceeded) reason = "Hour limit exceeded";
      else if (dayExceeded) reason = "Day limit exceeded";
      else if (concurrentExceeded) reason = "Concurrent request limit exceeded";

      return {
        allowed: false,
        identifier,
        type,
        remaining: {
          minute: Math.max(0, limits.requestsPerMinute - bucket.minuteCount),
          hour: Math.max(0, limits.requestsPerHour - bucket.hourCount),
          day: Math.max(0, limits.requestsPerDay - bucket.dayCount),
          concurrent: Math.max(0, (limits.concurrentRequests || 10) - bucket.concurrentCount)
        },
        resetAt: { minute: bucket.minuteResetAt, hour: bucket.hourResetAt, day: bucket.dayResetAt },
        blocked: bucket.blocked,
        blockedUntil: bucket.blockedUntil,
        reason,
        retryAfter: Math.ceil((bucket.minuteResetAt - now) / 1000)
      };
    }

    bucket.minuteCount++;
    bucket.hourCount++;
    bucket.dayCount++;
    bucket.lastRequest = now;

    return {
      allowed: true,
      identifier,
      type,
      remaining: {
        minute: limits.requestsPerMinute - bucket.minuteCount,
        hour: limits.requestsPerHour - bucket.hourCount,
        day: limits.requestsPerDay - bucket.dayCount,
        concurrent: (limits.concurrentRequests || 10) - bucket.concurrentCount
      },
      resetAt: { minute: bucket.minuteResetAt, hour: bucket.hourResetAt, day: bucket.dayResetAt },
      blocked: false
    };
  }

  checkAppRateLimit(appClientId: string): RateLimitResult {
    const app = Array.from(this.smartApps.values()).find(a => a.clientId === appClientId);
    if (!app) {
      return {
        allowed: false,
        identifier: appClientId,
        type: "app",
        remaining: { minute: 0, hour: 0, day: 0, concurrent: 0 },
        resetAt: { minute: Date.now(), hour: Date.now(), day: Date.now() },
        blocked: true,
        reason: "Unknown SMART app"
      };
    }

    const accessControl = Array.from(this.appAccessControls.values()).find(ac => ac.appId === app.id);
    if (!accessControl || !accessControl.enabled) {
      return {
        allowed: false,
        identifier: appClientId,
        type: "app",
        remaining: { minute: 0, hour: 0, day: 0, concurrent: 0 },
        resetAt: { minute: Date.now(), hour: Date.now(), day: Date.now() },
        blocked: true,
        reason: "App access disabled"
      };
    }

    return this.checkRateLimit(appClientId, "app", accessControl.rateLimits);
  }

  checkUserRateLimit(userId: string): RateLimitResult {
    const user = Array.from(this.userAccessControls.values()).find(u => u.userId === userId);
    if (!user) {
      return {
        allowed: false,
        identifier: userId,
        type: "user",
        remaining: { minute: 0, hour: 0, day: 0, concurrent: 0 },
        resetAt: { minute: Date.now(), hour: Date.now(), day: Date.now() },
        blocked: true,
        reason: "Unknown user"
      };
    }

    if (!user.enabled) {
      return {
        allowed: false,
        identifier: userId,
        type: "user",
        remaining: { minute: 0, hour: 0, day: 0, concurrent: 0 },
        resetAt: { minute: Date.now(), hour: Date.now(), day: Date.now() },
        blocked: true,
        reason: "User access disabled"
      };
    }

    return this.checkRateLimit(userId, "user", user.rateLimits);
  }

  async detectThreats(recentRequests: GatewayAuditLog[]): Promise<ThreatEvent[]> {
    const detectedThreats: ThreatEvent[] = [];
    const now = new Date().toISOString();

    for (const pattern of Array.from(this.threatPatterns.values())) {
      if (!pattern.enabled) continue;

      const matchingRequests = this.evaluatePattern(pattern, recentRequests);
      if (matchingRequests.length > 0) {
        const event: ThreatEvent = {
          id: randomUUID(),
          timestamp: now,
          patternId: pattern.id,
          patternName: pattern.name,
          type: pattern.type,
          severity: pattern.severity,
          appId: matchingRequests[0].appId,
          appName: matchingRequests[0].appName,
          userId: matchingRequests[0].userId,
          clientIp: matchingRequests[0].clientIp,
          description: `Detected ${pattern.name}: ${pattern.description}`,
          indicators: pattern.indicators,
          evidenceData: {
            matchingRequestCount: matchingRequests.length,
            timeWindow: `${pattern.detectionRules[0]?.windowSeconds || 300} seconds`,
            sampleRequestIds: matchingRequests.slice(0, 5).map(r => r.requestId)
          },
          mitigationApplied: pattern.mitigation,
          resolved: false
        };

        if (pattern.aiEnhanced && this.openai) {
          try {
            event.aiAnalysis = await this.getAIThreatAnalysis(pattern, matchingRequests);
          } catch (error) {
            console.error("[FHIRGatewaySecurity] AI analysis failed:", error);
          }
        }

        this.threatEvents.unshift(event);
        detectedThreats.push(event);
      }
    }

    return detectedThreats;
  }

  private evaluatePattern(pattern: ThreatPattern, requests: GatewayAuditLog[]): GatewayAuditLog[] {
    const matching: GatewayAuditLog[] = [];

    for (const rule of pattern.detectionRules) {
      const windowMs = rule.windowSeconds * 1000;
      const now = Date.now();
      const windowedRequests = requests.filter(r => 
        now - new Date(r.timestamp).getTime() <= windowMs
      );

      switch (rule.metric) {
        case "failed_auth_count": {
          const failedAuth = windowedRequests.filter(r => r.responseStatus === 401 || r.responseStatus === 403);
          if (failedAuth.length > (rule.threshold as number)) {
            matching.push(...failedAuth);
          }
          break;
        }
        case "patient_access_rate": {
          const patientAccess = windowedRequests.filter(r => r.resourceType === "Patient");
          if (patientAccess.length > (rule.threshold as number)) {
            matching.push(...patientAccess);
          }
          break;
        }
        case "not_found_rate": {
          const notFound = windowedRequests.filter(r => r.responseStatus === 404);
          if (notFound.length > (rule.threshold as number)) {
            matching.push(...notFound);
          }
          break;
        }
        case "unauthorized_access_count": {
          const unauthorized = windowedRequests.filter(r => !r.accessDecision.allowed);
          if (unauthorized.length > (rule.threshold as number)) {
            matching.push(...unauthorized);
          }
          break;
        }
        case "data_volume_mb": {
          const totalBytes = windowedRequests.reduce((sum, r) => sum + (r.responseSize || 0), 0);
          if (totalBytes / (1024 * 1024) > (rule.threshold as number)) {
            matching.push(...windowedRequests);
          }
          break;
        }
      }
    }

    return matching;
  }

  private async getAIThreatAnalysis(pattern: ThreatPattern, requests: GatewayAuditLog[]): Promise<string> {
    if (!this.openai) return "";

    const prompt = `Analyze this potential security threat in a healthcare FHIR API:

Threat Pattern: ${pattern.name}
Type: ${pattern.type}
Severity: ${pattern.severity}
Description: ${pattern.description}

Evidence (${requests.length} matching requests):
- Request sources: ${Array.from(new Set(requests.map(r => r.clientIp))).join(", ")}
- Apps involved: ${Array.from(new Set(requests.map(r => r.appName).filter((n): n is string => Boolean(n)))).join(", ")}
- Users involved: ${Array.from(new Set(requests.map(r => r.username).filter((n): n is string => Boolean(n)))).join(", ")}
- Resource types accessed: ${Array.from(new Set(requests.map(r => r.resourceType).filter((n): n is string => Boolean(n)))).join(", ")}
- Time span: ${requests[requests.length - 1]?.timestamp} to ${requests[0]?.timestamp}
- Response codes: ${JSON.stringify(Array.from(new Set(requests.map(r => r.responseStatus))))}

Provide a concise threat analysis including:
1. Is this likely a real threat or false positive?
2. What is the potential impact on patient data?
3. Recommended immediate actions

Keep response under 200 words, focused on actionable insights.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a healthcare security analyst specializing in FHIR API protection and HIPAA compliance. Provide concise, actionable threat analysis." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("[FHIRGatewaySecurity] AI analysis error:", error);
      return "";
    }
  }

  async generateAIThreatReport(): Promise<AIThreatAnalysis> {
    const now = Date.now();
    const last24h = this.auditLogs.filter(log => 
      now - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    const analysis: AIThreatAnalysis = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      analysisType: "batch",
      inputData: {
        requestCount: last24h.length,
        timeWindowMinutes: 1440,
        uniqueApps: new Set(last24h.map(l => l.appId).filter(Boolean)).size,
        uniqueUsers: new Set(last24h.map(l => l.userId).filter(Boolean)).size,
        uniqueIps: new Set(last24h.map(l => l.clientIp)).size
      },
      findings: {
        threatLevel: "low",
        anomaliesDetected: 0,
        suspiciousPatterns: [],
        recommendations: []
      },
      detailedAnalysis: "",
      confidenceScore: 0.85,
      modelVersion: "gpt-4o"
    };

    const blockedRequests = last24h.filter(l => !l.accessDecision.allowed);
    const highThreatLogs = last24h.filter(l => l.threatDetection.threatLevel === "high" || l.threatDetection.threatLevel === "critical");
    const recentThreats = this.threatEvents.filter(e => 
      now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000 && !e.resolved
    );

    analysis.findings.anomaliesDetected = blockedRequests.length + highThreatLogs.length;
    
    if (recentThreats.length > 0) {
      analysis.findings.suspiciousPatterns = Array.from(new Set(recentThreats.map(t => t.patternName)));
    }

    if (blockedRequests.length > last24h.length * 0.1) {
      analysis.findings.threatLevel = "medium";
      analysis.findings.recommendations.push("High block rate detected - review access control policies");
    }

    if (highThreatLogs.length > 5) {
      analysis.findings.threatLevel = "high";
      analysis.findings.recommendations.push("Multiple high-severity threats detected - immediate investigation recommended");
    }

    if (this.openai) {
      try {
        const prompt = `Analyze 24-hour FHIR API security metrics:
- Total requests: ${last24h.length}
- Blocked requests: ${blockedRequests.length} (${((blockedRequests.length / (last24h.length || 1)) * 100).toFixed(1)}%)
- High threat events: ${highThreatLogs.length}
- Active threats: ${recentThreats.length}
- Unique apps: ${analysis.inputData.uniqueApps}
- Unique users: ${analysis.inputData.uniqueUsers}
- Unique IPs: ${analysis.inputData.uniqueIps}

Top resource types accessed: ${JSON.stringify(this.getTopItems(last24h.map(l => l.resourceType).filter((r): r is string => Boolean(r)), 5))}
Threat patterns detected: ${analysis.findings.suspiciousPatterns.join(", ") || "None"}

Provide a security summary with:
1. Overall threat assessment
2. Notable patterns or anomalies
3. Top 3 recommended actions

Keep response under 250 words.`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a healthcare API security analyst. Provide actionable security insights for HIPAA-compliant FHIR APIs." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 400
        });

        analysis.detailedAnalysis = response.choices[0]?.message?.content || "";
      } catch (error) {
        console.error("[FHIRGatewaySecurity] AI report generation error:", error);
        analysis.detailedAnalysis = "AI analysis unavailable. Manual review recommended based on metrics above.";
      }
    }

    this.aiAnalyses.unshift(analysis);
    return analysis;
  }

  private getTopItems(items: string[], limit: number): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.fromEntries(
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit)
    );
  }

  logRequest(request: Partial<GatewayAuditLog>): GatewayAuditLog {
    const log: GatewayAuditLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      requestId: request.requestId || randomUUID(),
      appId: request.appId,
      appClientId: request.appClientId,
      appName: request.appName,
      userId: request.userId,
      username: request.username,
      userRole: request.userRole,
      patientContext: request.patientContext,
      clientIp: request.clientIp || "unknown",
      userAgent: request.userAgent,
      method: request.method || "GET",
      endpoint: request.endpoint || "/fhir",
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      operation: request.operation || "read",
      queryParameters: request.queryParameters,
      requestHeaders: request.requestHeaders,
      responseStatus: request.responseStatus || 200,
      responseTimeMs: request.responseTimeMs || 0,
      responseSize: request.responseSize,
      accessDecision: request.accessDecision || { allowed: true, reason: "Default allow", riskScore: 0 },
      rateLimitStatus: request.rateLimitStatus || { allowed: true, remaining: 100, limit: 120 },
      tokenInfo: request.tokenInfo,
      threatDetection: request.threatDetection || { threatLevel: "none", threats: [], blocked: false },
      phiAccessed: request.phiAccessed ?? false,
      sensitivityLevel: request.sensitivityLevel || "low",
      complianceFlags: request.complianceFlags || [],
      errorDetails: request.errorDetails
    };

    this.auditLogs.unshift(log);
    
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(0, 10000);
    }

    return log;
  }

  getSecurityDashboard(): SecurityDashboard {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const logsToday = this.auditLogs.filter(l => new Date(l.timestamp).getTime() >= todayStart);
    const blockedToday = logsToday.filter(l => !l.accessDecision.allowed);
    const threatEventsToday = this.threatEvents.filter(e => new Date(e.timestamp).getTime() >= todayStart);

    const activeThreats = this.threatEvents.filter(e => !e.resolved);
    const threatsByLevel: Record<string, number> = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
    activeThreats.forEach(t => threatsByLevel[t.severity]++);

    const rateLimitViolationsLast24h = Array.from(this.rateLimitBuckets.values())
      .reduce((sum, b) => sum + b.violations, 0);
    const currentlyBlocked = Array.from(this.rateLimitBuckets.values())
      .filter(b => b.blocked).length;

    const topViolators = Array.from(this.rateLimitBuckets.values())
      .filter(b => b.violations > 0)
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 5)
      .map(b => ({ identifier: b.identifier, type: b.type, violations: b.violations }));

    const requestsByApp: Record<string, number> = {};
    const requestsByUser: Record<string, number> = {};
    const requestsByResourceType: Record<string, number> = {};
    const hourDistribution = new Array(24).fill(0);

    logsToday.forEach(log => {
      if (log.appName) requestsByApp[log.appName] = (requestsByApp[log.appName] || 0) + 1;
      if (log.username) requestsByUser[log.username] = (requestsByUser[log.username] || 0) + 1;
      if (log.resourceType) requestsByResourceType[log.resourceType] = (requestsByResourceType[log.resourceType] || 0) + 1;
      const hour = new Date(log.timestamp).getHours();
      hourDistribution[hour]++;
    });

    const phiAccessCount = logsToday.filter(l => l.phiAccessed).length;
    const sensitiveAccessCount = logsToday.filter(l => l.sensitivityLevel === "high" || l.sensitivityLevel === "restricted").length;
    const complianceViolations = logsToday.filter(l => l.complianceFlags.length > 0).length;

    return {
      summary: {
        totalApps: this.smartApps.size,
        activeApps: Array.from(this.smartApps.values()).filter(a => a.status === "active").length,
        suspendedApps: Array.from(this.smartApps.values()).filter(a => a.status === "suspended").length,
        totalUsers: this.userAccessControls.size,
        activeTokens: this.accessTokens.size,
        totalRequestsToday: logsToday.length,
        blockedRequestsToday: blockedToday.length,
        threatEventsToday: threatEventsToday.length
      },
      rateLimiting: {
        currentlyBlocked,
        violationsLast24h: rateLimitViolationsLast24h,
        topViolators
      },
      threats: {
        activeThreats: activeThreats.length,
        threatsByLevel,
        recentEvents: this.threatEvents.slice(0, 10)
      },
      accessPatterns: {
        requestsByApp,
        requestsByUser,
        requestsByResourceType,
        peakHourDistribution: hourDistribution
      },
      compliance: {
        auditLogsToday: logsToday.length,
        phiAccessCount,
        sensitiveAccessCount,
        complianceViolations
      }
    };
  }

  getSMARTApps(): SMARTApp[] {
    return Array.from(this.smartApps.values());
  }

  getSMARTApp(id: string): SMARTApp | undefined {
    return this.smartApps.get(id);
  }

  updateSMARTAppStatus(id: string, status: "active" | "suspended" | "revoked"): SMARTApp | null {
    const app = this.smartApps.get(id);
    if (!app) return null;
    
    app.status = status;
    this.smartApps.set(id, app);

    const accessControl = Array.from(this.appAccessControls.values()).find(ac => ac.appId === id);
    if (accessControl) {
      accessControl.enabled = status === "active";
      accessControl.updatedAt = new Date().toISOString();
      this.appAccessControls.set(accessControl.id, accessControl);
    }

    return app;
  }

  getAppAccessControls(): SMARTAppAccessControl[] {
    return Array.from(this.appAccessControls.values());
  }

  getAppAccessControl(id: string): SMARTAppAccessControl | undefined {
    return this.appAccessControls.get(id);
  }

  updateAppAccessControl(id: string, updates: Partial<SMARTAppAccessControl>): SMARTAppAccessControl | null {
    const control = this.appAccessControls.get(id);
    if (!control) return null;

    const updated = { ...control, ...updates, updatedAt: new Date().toISOString() };
    this.appAccessControls.set(id, updated);
    return updated;
  }

  getUserAccessControls(): UserAccessControl[] {
    return Array.from(this.userAccessControls.values());
  }

  updateUserAccessControl(id: string, updates: Partial<UserAccessControl>): UserAccessControl | null {
    const control = this.userAccessControls.get(id);
    if (!control) return null;

    const updated = { ...control, ...updates, updatedAt: new Date().toISOString() };
    this.userAccessControls.set(id, updated);
    return updated;
  }

  getThreatPatterns(): ThreatPattern[] {
    return Array.from(this.threatPatterns.values());
  }

  getThreatEvents(filters?: { severity?: string; type?: string; resolved?: boolean; limit?: number }): ThreatEvent[] {
    let events = [...this.threatEvents];

    if (filters?.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }
    if (filters?.type) {
      events = events.filter(e => e.type === filters.type);
    }
    if (filters?.resolved !== undefined) {
      events = events.filter(e => e.resolved === filters.resolved);
    }

    return events.slice(0, filters?.limit || 50);
  }

  resolveThreatEvent(id: string, resolvedBy: string, falsePositive: boolean): ThreatEvent | null {
    const event = this.threatEvents.find(e => e.id === id);
    if (!event) return null;

    event.resolved = true;
    event.resolvedAt = new Date().toISOString();
    event.resolvedBy = resolvedBy;
    event.falsePositive = falsePositive;

    return event;
  }

  getAuditLogs(filters?: { 
    appId?: string; 
    userId?: string; 
    resourceType?: string; 
    startDate?: string; 
    endDate?: string;
    threatLevel?: string;
    blocked?: boolean;
    limit?: number;
  }): GatewayAuditLog[] {
    let logs = [...this.auditLogs];

    if (filters?.appId) {
      logs = logs.filter(l => l.appId === filters.appId);
    }
    if (filters?.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters?.resourceType) {
      logs = logs.filter(l => l.resourceType === filters.resourceType);
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    if (filters?.threatLevel) {
      logs = logs.filter(l => l.threatDetection.threatLevel === filters.threatLevel);
    }
    if (filters?.blocked !== undefined) {
      logs = logs.filter(l => !l.accessDecision.allowed === filters.blocked);
    }

    return logs.slice(0, filters?.limit || 100);
  }

  getAIAnalyses(): AIThreatAnalysis[] {
    return this.aiAnalyses.slice(0, 20);
  }

  getRateLimitStatus(): { buckets: RateLimitBucket[]; summary: { total: number; blocked: number; totalViolations: number } } {
    const buckets = Array.from(this.rateLimitBuckets.values());
    return {
      buckets,
      summary: {
        total: buckets.length,
        blocked: buckets.filter(b => b.blocked).length,
        totalViolations: buckets.reduce((sum, b) => sum + b.violations, 0)
      }
    };
  }
}

export const fhirAPIGatewaySecurityService = new FHIRAPIGatewaySecurityService();
