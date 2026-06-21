import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

interface FHIRServer {
  id: string;
  name: string;
  baseUrl: string;
  type: "primary" | "secondary" | "fallback";
  enabled: boolean;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "unknown";
  lastHealthCheck: string;
  capabilities: string[];
  supportedResources: string[];
  authType: "none" | "basic" | "bearer" | "oauth2";
  priority: number;
  metadata: {
    version?: string;
    vendor?: string;
    lastResponseTimeMs?: number;
    successRate?: number;
    totalRequests?: number;
  };
}

interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    resourceTypes?: string[];
    operations?: ("read" | "search" | "create" | "update" | "delete")[];
    patientIds?: string[];
    sourceIps?: string[];
    headers?: Record<string, string>;
  };
  targetServerId: string;
  fallbackServerId?: string;
  loadBalancing?: "round-robin" | "least-connections" | "weighted" | "latency-based";
}

interface ValidationResult {
  valid: boolean;
  resourceType: string;
  errors: Array<{
    path: string;
    message: string;
    severity: "error" | "warning" | "info";
    code?: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
  profile?: string;
}

interface PerformanceMetrics {
  serverId: string;
  endpoint: string;
  method: string;
  resourceType?: string;
  timestamp: number;
  responseTimeMs: number;
  statusCode: number;
  success: boolean;
  payloadSizeBytes?: number;
  queryParameters?: Record<string, string>;
}

interface QueryOptimizationSuggestion {
  id: string;
  query: string;
  resourceType: string;
  suggestions: Array<{
    type: "index" | "pagination" | "include" | "filter" | "caching" | "batch";
    description: string;
    impact: "high" | "medium" | "low";
    optimizedQuery?: string;
    estimatedImprovement?: string;
  }>;
  aiAnalysis: string;
  generatedAt: string;
}

interface GatewayStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsByServer: Record<string, number>;
  requestsByResourceType: Record<string, number>;
  errorsByType: Record<string, number>;
  validationStats: {
    totalValidations: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface AccessControlPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  roles: string[];
  resourceTypes: string[];
  operations: ("read" | "search" | "create" | "update" | "delete")[];
  elementAccess: {
    allowed: string[];
    denied: string[];
    masked: string[];
  };
  sensitivityLevels: ("low" | "medium" | "high" | "restricted")[];
  conditions?: {
    requireMfa?: boolean;
    allowedIpRanges?: string[];
    timeRestrictions?: { startHour: number; endHour: number; timezone: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface AccessDecision {
  allowed: boolean;
  policyId?: string;
  policyName?: string;
  reason: string;
  maskedElements: string[];
  deniedElements: string[];
  aiRecommendation?: string;
  riskScore: number;
  auditId: string;
}

export interface CacheEntry {
  key: string;
  resourceType: string;
  query?: string;
  response: unknown;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  sizeBytes: number;
  sensitivityLevel: "low" | "medium" | "high" | "restricted";
  userId?: string;
}

export interface CacheConfig {
  enabled: boolean;
  defaultTtlMs: number;
  maxSizeBytes: number;
  maxEntries: number;
  ttlByResourceType: Record<string, number>;
  excludedResourceTypes: string[];
  excludedOperations: ("create" | "update" | "delete")[];
  intelligentTtl: boolean;
}

export interface RateLimitConfig {
  id: string;
  name: string;
  enabled: boolean;
  scope: "user" | "role" | "ip" | "global";
  identifier?: string;
  limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
  };
  resourceTypeOverrides?: Record<string, { requestsPerMinute: number }>;
  operationOverrides?: Record<string, { requestsPerMinute: number }>;
  penaltyConfig: {
    blockDurationMs: number;
    warningThreshold: number;
  };
}

export interface RateLimitState {
  identifier: string;
  scope: string;
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  minuteResetAt: number;
  hourResetAt: number;
  dayResetAt: number;
  blocked: boolean;
  blockedUntil?: number;
  warnings: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
  resetAt: {
    minute: number;
    hour: number;
    day: number;
  };
  blocked: boolean;
  blockedUntil?: number;
  reason?: string;
}

export interface GatewayAuditEntry {
  id: string;
  timestamp: string;
  requestId: string;
  userId?: string;
  userRole?: string;
  clientIp: string;
  operation: "read" | "search" | "create" | "update" | "delete" | "$search" | "$validate" | "$everything";
  resourceType: string;
  resourceId?: string;
  queryParameters?: Record<string, string>;
  targetServer: string;
  accessDecision: {
    allowed: boolean;
    policyId?: string;
    reason: string;
    riskScore: number;
  };
  rateLimitStatus: {
    allowed: boolean;
    remaining?: number;
  };
  cacheStatus: "hit" | "miss" | "bypass";
  responseStatus: number;
  responseTimeMs: number;
  phiAccessed: boolean;
  sensitivityLevel: "low" | "medium" | "high" | "restricted";
  maskedElements: string[];
  errorMessage?: string;
  anomalyDetected?: boolean;
  threatLevel?: "none" | "low" | "medium" | "high" | "critical";
  riskFactors?: string[];
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  sensitivityLevel: "low" | "medium" | "high";
  baselineWindowHours: number;
  detectionThresholds: {
    requestVelocityMultiplier: number;
    unusualResourceAccessScore: number;
    geoAnomalyScore: number;
    timeAnomalyScore: number;
    patternDeviationScore: number;
  };
  autoBlockOnCritical: boolean;
  alertOnHigh: boolean;
  learningMode: boolean;
}

export interface AnomalyEvent {
  id: string;
  timestamp: string;
  userId?: string;
  clientIp: string;
  anomalyType: "velocity" | "resource_access" | "geo_location" | "time_pattern" | "behavior_deviation" | "enumeration_attack" | "credential_stuffing";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  indicators: string[];
  baselineValue?: number;
  observedValue?: number;
  aiAnalysis?: string;
  actionTaken: "logged" | "alerted" | "rate_limited" | "blocked";
  resolved: boolean;
}

export interface UserBehaviorProfile {
  userId: string;
  lastUpdated: string;
  requestPatterns: {
    averageRequestsPerMinute: number;
    averageRequestsPerHour: number;
    peakHours: number[];
    commonResourceTypes: string[];
    commonOperations: string[];
    typicalResponseTimes: number[];
  };
  accessPatterns: {
    commonIpRanges: string[];
    commonUserAgents: string[];
    geoLocations: string[];
    sessionDurations: number[];
  };
  riskFactors: {
    failedAuthAttempts: number;
    deniedAccessAttempts: number;
    rateLimitViolations: number;
    anomalyCount: number;
  };
  trustScore: number;
}

export interface ThreatIntelligence {
  id: string;
  type: "ip_blocklist" | "pattern_signature" | "attack_vector" | "vulnerability";
  indicator: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  source: string;
  expiresAt?: string;
  active: boolean;
}

export interface AdaptiveRateLimitState {
  identifier: string;
  baseLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  currentLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  adjustmentFactor: number;
  threatLevel: "none" | "low" | "medium" | "high" | "critical";
  adjustmentHistory: Array<{
    timestamp: string;
    previousFactor: number;
    newFactor: number;
    reason: string;
  }>;
  lastAdjustment: string;
}

export interface RiskAssessment {
  requestId: string;
  timestamp: string;
  overallRiskScore: number;
  riskLevel: "minimal" | "low" | "medium" | "high" | "critical";
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    description: string;
  }>;
  recommendations: string[];
  accessRecommendation: "allow" | "allow_with_monitoring" | "challenge" | "deny";
  aiAnalysis?: string;
  mitigations: string[];
}

const FHIR_R4_RESOURCE_TYPES = [
  "Patient", "Practitioner", "Organization", "Encounter", "Condition",
  "Observation", "Procedure", "MedicationRequest", "MedicationStatement",
  "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan",
  "CareTeam", "Goal", "ServiceRequest", "Appointment", "DocumentReference",
  "Consent", "Coverage", "Claim", "ExplanationOfBenefit", "Bundle",
  "OperationOutcome", "CapabilityStatement", "StructureDefinition"
];

const FHIR_R4_COMMON_ELEMENTS: Record<string, string[]> = {
  Patient: ["id", "meta", "identifier", "active", "name", "telecom", "gender", "birthDate", "address", "maritalStatus", "contact", "communication"],
  Observation: ["id", "meta", "identifier", "status", "category", "code", "subject", "encounter", "effectiveDateTime", "issued", "performer", "valueQuantity", "valueCodeableConcept", "interpretation", "note", "referenceRange", "component"],
  Condition: ["id", "meta", "identifier", "clinicalStatus", "verificationStatus", "category", "severity", "code", "bodySite", "subject", "encounter", "onsetDateTime", "abatementDateTime", "recordedDate", "recorder", "asserter", "stage", "evidence", "note"],
  Encounter: ["id", "meta", "identifier", "status", "class", "type", "serviceType", "priority", "subject", "participant", "period", "reasonCode", "diagnosis", "hospitalization", "location", "serviceProvider"],
  MedicationRequest: ["id", "meta", "identifier", "status", "intent", "category", "priority", "medicationCodeableConcept", "medicationReference", "subject", "encounter", "authoredOn", "requester", "performer", "reasonCode", "dosageInstruction", "dispenseRequest", "substitution"],
};

class AIFHIRApiGateway {
  private servers: Map<string, FHIRServer> = new Map();
  private routingRules: Map<string, RoutingRule> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private optimizationSuggestions: Map<string, QueryOptimizationSuggestion> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  private serverConnections: Map<string, number> = new Map();
  private validationStats = { totalValidations: 0, passed: 0, failed: 0, warnings: 0 };
  private openai: OpenAI | null = null;

  private accessPolicies: Map<string, AccessControlPolicy> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  
  private anomalyDetectionConfig: AnomalyDetectionConfig = {
    enabled: true,
    sensitivityLevel: "medium",
    baselineWindowHours: 24,
    detectionThresholds: {
      requestVelocityMultiplier: 3.0,
      unusualResourceAccessScore: 0.7,
      geoAnomalyScore: 0.8,
      timeAnomalyScore: 0.6,
      patternDeviationScore: 0.75,
    },
    autoBlockOnCritical: true,
    alertOnHigh: true,
    learningMode: false,
  };
  private anomalyEvents: AnomalyEvent[] = [];
  private userBehaviorProfiles: Map<string, UserBehaviorProfile> = new Map();
  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();
  private adaptiveRateLimits: Map<string, AdaptiveRateLimitState> = new Map();
  private recentRequests: Map<string, Array<{ timestamp: number; resourceType: string; operation: string }>> = new Map();
  private readonly MAX_ANOMALY_EVENTS = 1000;
  private readonly MAX_RECENT_REQUESTS = 100;

  private cacheConfig: CacheConfig = {
    enabled: true,
    defaultTtlMs: 60000,
    maxSizeBytes: 50 * 1024 * 1024,
    maxEntries: 1000,
    ttlByResourceType: {
      Patient: 300000,
      Practitioner: 600000,
      Organization: 900000,
      Observation: 60000,
      Condition: 120000,
    },
    excludedResourceTypes: ["AuditEvent", "Bundle"],
    excludedOperations: ["create", "update", "delete"],
    intelligentTtl: true,
  };
  private rateLimitConfigs: Map<string, RateLimitConfig> = new Map();
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private auditLog: GatewayAuditEntry[] = [];
  private readonly MAX_AUDIT_ENTRIES = 10000;

  private readonly SENSITIVE_ELEMENTS: Record<string, { level: "low" | "medium" | "high" | "restricted"; elements: string[] }> = {
    Patient: { level: "high", elements: ["identifier", "name", "telecom", "address", "birthDate", "deceasedDateTime", "photo"] },
    Condition: { level: "medium", elements: ["subject", "code", "clinicalStatus"] },
    Observation: { level: "medium", elements: ["subject", "value", "code"] },
    MedicationRequest: { level: "medium", elements: ["subject", "medication", "dosageInstruction"] },
    DiagnosticReport: { level: "high", elements: ["subject", "result", "conclusion"] },
    Immunization: { level: "medium", elements: ["patient", "vaccineCode", "occurrenceDateTime"] },
    AllergyIntolerance: { level: "high", elements: ["patient", "code", "reaction"] },
  };

  constructor() {
    this.initializeOpenAI();
    this.initializeDefaultServers();
    this.initializeDefaultRules();
    this.initializeDefaultAccessPolicies();
    this.initializeDefaultRateLimits();
    this.initializeDefaultThreatIntelligence();
    this.initializeSampleBehaviorProfiles();
    this.startHealthCheckLoop();
    this.startCacheCleanupLoop();
    this.startAnomalyDetectionLoop();
    console.log("[AIFHIRApiGateway] Service initialized");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
      console.log("[AIFHIRApiGateway] OpenAI client configured");
    } else {
      console.log("[AIFHIRApiGateway] OpenAI not configured, using rule-based suggestions");
    }
  }

  private initializeDefaultServers(): void {
    const primaryServer: FHIRServer = {
      id: "server-primary",
      name: "Primary FHIR Server",
      baseUrl: "https://fhir.primary.example.com/r4",
      type: "primary",
      enabled: true,
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
      capabilities: ["read", "search", "create", "update", "delete", "batch", "transaction"],
      supportedResources: FHIR_R4_RESOURCE_TYPES,
      authType: "bearer",
      priority: 1,
      metadata: {
        version: "4.0.1",
        vendor: "Tabula FHIR Server",
        lastResponseTimeMs: 45,
        successRate: 0.998,
        totalRequests: 15420,
      },
    };

    const secondaryServer: FHIRServer = {
      id: "server-secondary",
      name: "Secondary FHIR Server (Read Replica)",
      baseUrl: "https://fhir.secondary.example.com/r4",
      type: "secondary",
      enabled: true,
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
      capabilities: ["read", "search"],
      supportedResources: FHIR_R4_RESOURCE_TYPES,
      authType: "bearer",
      priority: 2,
      metadata: {
        version: "4.0.1",
        vendor: "Tabula FHIR Server",
        lastResponseTimeMs: 32,
        successRate: 0.999,
        totalRequests: 8750,
      },
    };

    const fallbackServer: FHIRServer = {
      id: "server-fallback",
      name: "Fallback FHIR Server",
      baseUrl: "https://fhir.fallback.example.com/r4",
      type: "fallback",
      enabled: true,
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
      capabilities: ["read", "search", "create", "update"],
      supportedResources: ["Patient", "Practitioner", "Organization", "Observation", "Condition"],
      authType: "oauth2",
      priority: 3,
      metadata: {
        version: "4.0.1",
        vendor: "External FHIR Provider",
        lastResponseTimeMs: 120,
        successRate: 0.985,
        totalRequests: 2340,
      },
    };

    this.servers.set(primaryServer.id, primaryServer);
    this.servers.set(secondaryServer.id, secondaryServer);
    this.servers.set(fallbackServer.id, fallbackServer);
  }

  private initializeDefaultRules(): void {
    const readOptimizationRule: RoutingRule = {
      id: "rule-read-optimization",
      name: "Route reads to secondary for performance",
      enabled: true,
      priority: 1,
      conditions: {
        operations: ["read", "search"],
      },
      targetServerId: "server-secondary",
      fallbackServerId: "server-primary",
      loadBalancing: "latency-based",
    };

    const writeRule: RoutingRule = {
      id: "rule-writes-primary",
      name: "Route writes to primary server",
      enabled: true,
      priority: 2,
      conditions: {
        operations: ["create", "update", "delete"],
      },
      targetServerId: "server-primary",
      fallbackServerId: "server-fallback",
    };

    this.routingRules.set(readOptimizationRule.id, readOptimizationRule);
    this.routingRules.set(writeRule.id, writeRule);
  }

  private initializeDefaultAccessPolicies(): void {
    const adminPolicy: AccessControlPolicy = {
      id: "policy-admin-full-access",
      name: "Administrator Full Access",
      description: "Full access to all FHIR resources for administrators",
      enabled: true,
      priority: 1,
      roles: ["admin", "system_admin"],
      resourceTypes: FHIR_R4_RESOURCE_TYPES,
      operations: ["read", "search", "create", "update", "delete"],
      elementAccess: { allowed: ["*"], denied: [], masked: [] },
      sensitivityLevels: ["low", "medium", "high", "restricted"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const clinicianPolicy: AccessControlPolicy = {
      id: "policy-clinician-care",
      name: "Clinician Care Access",
      description: "Access to patient care resources for clinical staff",
      enabled: true,
      priority: 2,
      roles: ["physician", "nurse", "clinician"],
      resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Encounter", "DiagnosticReport", "CarePlan", "CareTeam"],
      operations: ["read", "search", "create", "update"],
      elementAccess: { allowed: ["*"], denied: ["meta.security"], masked: [] },
      sensitivityLevels: ["low", "medium", "high"],
      conditions: { requireMfa: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const patientPolicy: AccessControlPolicy = {
      id: "policy-patient-self",
      name: "Patient Self-Access",
      description: "Patients can view their own records with sensitive fields masked",
      enabled: true,
      priority: 3,
      roles: ["patient"],
      resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Immunization", "AllergyIntolerance", "DocumentReference"],
      operations: ["read", "search"],
      elementAccess: { allowed: ["*"], denied: [], masked: ["identifier.value", "telecom.value"] },
      sensitivityLevels: ["low", "medium"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const researcherPolicy: AccessControlPolicy = {
      id: "policy-researcher-deidentified",
      name: "Researcher De-identified Access",
      description: "Researchers can access de-identified data for approved studies",
      enabled: true,
      priority: 4,
      roles: ["researcher", "data_analyst"],
      resourceTypes: ["Observation", "Condition", "Procedure", "MedicationRequest"],
      operations: ["read", "search"],
      elementAccess: {
        allowed: ["code", "effectiveDateTime", "valueQuantity", "status"],
        denied: ["subject", "encounter", "performer"],
        masked: [],
      },
      sensitivityLevels: ["low"],
      conditions: { requireMfa: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.accessPolicies.set(adminPolicy.id, adminPolicy);
    this.accessPolicies.set(clinicianPolicy.id, clinicianPolicy);
    this.accessPolicies.set(patientPolicy.id, patientPolicy);
    this.accessPolicies.set(researcherPolicy.id, researcherPolicy);
  }

  private initializeDefaultRateLimits(): void {
    const defaultGlobalLimit: RateLimitConfig = {
      id: "ratelimit-global",
      name: "Global Rate Limit",
      enabled: true,
      scope: "global",
      limits: { requestsPerMinute: 1000, requestsPerHour: 30000, requestsPerDay: 500000, burstLimit: 100 },
      penaltyConfig: { blockDurationMs: 60000, warningThreshold: 0.8 },
    };

    const userRoleLimit: RateLimitConfig = {
      id: "ratelimit-user-default",
      name: "Default User Rate Limit",
      enabled: true,
      scope: "user",
      limits: { requestsPerMinute: 60, requestsPerHour: 1800, requestsPerDay: 20000, burstLimit: 20 },
      resourceTypeOverrides: { Patient: { requestsPerMinute: 30 }, Observation: { requestsPerMinute: 100 } },
      penaltyConfig: { blockDurationMs: 300000, warningThreshold: 0.9 },
    };

    const adminRoleLimit: RateLimitConfig = {
      id: "ratelimit-admin",
      name: "Admin Rate Limit",
      enabled: true,
      scope: "role",
      identifier: "admin",
      limits: { requestsPerMinute: 300, requestsPerHour: 10000, requestsPerDay: 100000, burstLimit: 50 },
      penaltyConfig: { blockDurationMs: 60000, warningThreshold: 0.95 },
    };

    this.rateLimitConfigs.set(defaultGlobalLimit.id, defaultGlobalLimit);
    this.rateLimitConfigs.set(userRoleLimit.id, userRoleLimit);
    this.rateLimitConfigs.set(adminRoleLimit.id, adminRoleLimit);
  }

  private startCacheCleanupLoop(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 30000);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private startHealthCheckLoop(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, 60000);
  }

  private async performHealthChecks(): Promise<void> {
    const servers = Array.from(this.servers.values());
    for (const server of servers) {
      const previousStatus = server.healthStatus;
      server.healthStatus = Math.random() > 0.05 ? "healthy" : "degraded";
      server.lastHealthCheck = new Date().toISOString();
      
      if (previousStatus !== server.healthStatus) {
        console.log(`[AIFHIRApiGateway] Server ${server.name} status changed: ${previousStatus} -> ${server.healthStatus}`);
      }
    }
  }

  async routeRequest(
    resourceType: string,
    operation: "read" | "search" | "create" | "update" | "delete",
    context?: {
      patientId?: string;
      sourceIp?: string;
      headers?: Record<string, string>;
    }
  ): Promise<{ server: FHIRServer; rule?: RoutingRule }> {
    const sortedRules = Array.from(this.routingRules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.ruleMatches(rule, resourceType, operation, context)) {
        let targetServer = this.servers.get(rule.targetServerId);
        
        if (!targetServer || !targetServer.enabled || targetServer.healthStatus === "unhealthy") {
          if (rule.fallbackServerId) {
            targetServer = this.servers.get(rule.fallbackServerId);
          }
        }

        if (targetServer && targetServer.enabled && targetServer.healthStatus !== "unhealthy") {
          const selectedServer = this.applyLoadBalancing(targetServer, rule);
          return { server: selectedServer, rule };
        }
      }
    }

    const healthyServers = Array.from(this.servers.values())
      .filter((s) => s.enabled && s.healthStatus !== "unhealthy")
      .sort((a, b) => a.priority - b.priority);

    if (healthyServers.length === 0) {
      throw new Error("No healthy FHIR servers available");
    }

    return { server: healthyServers[0] };
  }

  private applyLoadBalancing(server: FHIRServer, rule: RoutingRule): FHIRServer {
    if (!rule.loadBalancing) {
      return server;
    }

    const eligibleServerIds = new Set<string>([rule.targetServerId]);
    if (rule.fallbackServerId) {
      eligibleServerIds.add(rule.fallbackServerId);
    }

    const healthyServers = Array.from(this.servers.values())
      .filter((s) => s.enabled && s.healthStatus !== "unhealthy" && eligibleServerIds.has(s.id));

    if (healthyServers.length <= 1) {
      return server;
    }

    switch (rule.loadBalancing) {
      case "round-robin": {
        const key = rule.id;
        const currentIndex = this.roundRobinIndex.get(key) || 0;
        const nextIndex = (currentIndex + 1) % healthyServers.length;
        this.roundRobinIndex.set(key, nextIndex);
        return healthyServers[nextIndex];
      }
      case "least-connections": {
        let minConnections = Infinity;
        let selectedServer = server;
        for (const s of healthyServers) {
          const connections = this.serverConnections.get(s.id) || 0;
          if (connections < minConnections) {
            minConnections = connections;
            selectedServer = s;
          }
        }
        this.serverConnections.set(selectedServer.id, (this.serverConnections.get(selectedServer.id) || 0) + 1);
        return selectedServer;
      }
      case "latency-based": {
        let minLatency = Infinity;
        let selectedServer = server;
        for (const s of healthyServers) {
          const latency = s.metadata.lastResponseTimeMs || Infinity;
          if (latency < minLatency) {
            minLatency = latency;
            selectedServer = s;
          }
        }
        return selectedServer;
      }
      case "weighted": {
        const totalWeight = healthyServers.reduce((sum, s) => sum + (11 - s.priority), 0);
        let random = Math.random() * totalWeight;
        for (const s of healthyServers) {
          random -= (11 - s.priority);
          if (random <= 0) {
            return s;
          }
        }
        return server;
      }
      default:
        return server;
    }
  }

  releaseConnection(serverId: string): void {
    const current = this.serverConnections.get(serverId) || 0;
    if (current > 0) {
      this.serverConnections.set(serverId, current - 1);
    }
  }

  private ruleMatches(
    rule: RoutingRule,
    resourceType: string,
    operation: "read" | "search" | "create" | "update" | "delete",
    context?: {
      patientId?: string;
      sourceIp?: string;
      headers?: Record<string, string>;
    }
  ): boolean {
    const { conditions } = rule;

    if (conditions.resourceTypes && conditions.resourceTypes.length > 0) {
      if (!conditions.resourceTypes.includes(resourceType)) {
        return false;
      }
    }

    if (conditions.operations && conditions.operations.length > 0) {
      if (!conditions.operations.includes(operation)) {
        return false;
      }
    }

    if (conditions.patientIds && conditions.patientIds.length > 0) {
      if (!context?.patientId || !conditions.patientIds.includes(context.patientId)) {
        return false;
      }
    }

    if (conditions.sourceIps && conditions.sourceIps.length > 0) {
      if (!context?.sourceIp) {
        return false;
      }
      const ipMatches = conditions.sourceIps.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
          return regex.test(context.sourceIp!);
        }
        if (pattern.includes("/")) {
          return this.ipInCIDR(context.sourceIp!, pattern);
        }
        return pattern === context.sourceIp;
      });
      if (!ipMatches) {
        return false;
      }
    }

    if (conditions.headers && Object.keys(conditions.headers).length > 0) {
      if (!context?.headers) {
        return false;
      }
      const normalizedContextHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(context.headers)) {
        normalizedContextHeaders[key.toLowerCase()] = value;
      }
      for (const [headerKey, expectedValue] of Object.entries(conditions.headers)) {
        const actualValue = normalizedContextHeaders[headerKey.toLowerCase()];
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private ipInCIDR(ip: string, cidr: string): boolean {
    const [cidrIp, cidrMask] = cidr.split("/");
    const mask = parseInt(cidrMask, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;
    
    const ipParts = ip.split(".").map(Number);
    const cidrParts = cidrIp.split(".").map(Number);
    
    if (ipParts.length !== 4 || cidrParts.length !== 4) return false;
    
    const ipNum = ipParts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
    const cidrNum = cidrParts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
    const maskBits = (~(0xffffffff >>> mask)) >>> 0;
    
    return (ipNum & maskBits) === (cidrNum & maskBits);
  }

  validateFHIRResource(resource: Record<string, unknown>): ValidationResult {
    const errors: ValidationResult["errors"] = [];
    const warnings: ValidationResult["warnings"] = [];

    const resourceType = resource.resourceType as string;
    if (!resourceType) {
      errors.push({
        path: "resourceType",
        message: "resourceType is required",
        severity: "error",
        code: "MISSING_RESOURCE_TYPE",
      });
      return { valid: false, resourceType: "Unknown", errors, warnings };
    }

    if (!FHIR_R4_RESOURCE_TYPES.includes(resourceType)) {
      errors.push({
        path: "resourceType",
        message: `Unknown resource type: ${resourceType}. Expected one of: ${FHIR_R4_RESOURCE_TYPES.slice(0, 10).join(", ")}...`,
        severity: "error",
        code: "INVALID_RESOURCE_TYPE",
      });
    }

    if (!resource.id && resource.id !== undefined) {
      warnings.push({
        path: "id",
        message: "Resource id is recommended for tracking",
      });
    }

    if (resource.id && typeof resource.id === "string") {
      if (!/^[A-Za-z0-9\-\.]+$/.test(resource.id)) {
        errors.push({
          path: "id",
          message: "Resource id must match pattern [A-Za-z0-9\\-\\.]+",
          severity: "error",
          code: "INVALID_ID_FORMAT",
        });
      }
    }

    const meta = resource.meta as Record<string, unknown> | undefined;
    if (meta) {
      if (meta.versionId && typeof meta.versionId !== "string") {
        errors.push({
          path: "meta.versionId",
          message: "meta.versionId must be a string",
          severity: "error",
          code: "INVALID_VERSION_ID",
        });
      }
      if (meta.lastUpdated && typeof meta.lastUpdated === "string") {
        if (isNaN(Date.parse(meta.lastUpdated))) {
          errors.push({
            path: "meta.lastUpdated",
            message: "meta.lastUpdated must be a valid ISO 8601 datetime",
            severity: "error",
            code: "INVALID_DATETIME",
          });
        }
      }
    }

    this.validateResourceSpecificRules(resource, resourceType, errors, warnings);

    this.validationStats.totalValidations++;
    if (errors.length === 0) {
      this.validationStats.passed++;
    } else {
      this.validationStats.failed++;
    }
    if (warnings.length > 0) {
      this.validationStats.warnings += warnings.length;
    }

    return {
      valid: errors.length === 0,
      resourceType,
      errors,
      warnings,
      profile: `http://hl7.org/fhir/StructureDefinition/${resourceType}`,
    };
  }

  private validateResourceSpecificRules(
    resource: Record<string, unknown>,
    resourceType: string,
    errors: ValidationResult["errors"],
    warnings: ValidationResult["warnings"]
  ): void {
    switch (resourceType) {
      case "Patient":
        if (!resource.name && !resource.identifier) {
          warnings.push({
            path: "Patient",
            message: "Patient should have either name or identifier",
          });
        }
        if (resource.gender && !["male", "female", "other", "unknown"].includes(resource.gender as string)) {
          errors.push({
            path: "gender",
            message: "gender must be one of: male, female, other, unknown",
            severity: "error",
            code: "INVALID_CODE",
          });
        }
        if (resource.birthDate && typeof resource.birthDate === "string") {
          if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(resource.birthDate)) {
            errors.push({
              path: "birthDate",
              message: "birthDate must be in format YYYY, YYYY-MM, or YYYY-MM-DD",
              severity: "error",
              code: "INVALID_DATE_FORMAT",
            });
          }
        }
        break;

      case "Observation":
        if (!resource.status) {
          errors.push({
            path: "status",
            message: "Observation.status is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        } else if (!["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"].includes(resource.status as string)) {
          errors.push({
            path: "status",
            message: "Invalid Observation.status value",
            severity: "error",
            code: "INVALID_CODE",
          });
        }
        if (!resource.code) {
          errors.push({
            path: "code",
            message: "Observation.code is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        break;

      case "Condition":
        if (!resource.subject) {
          errors.push({
            path: "subject",
            message: "Condition.subject is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        if (!resource.code) {
          warnings.push({
            path: "code",
            message: "Condition.code is recommended for clinical conditions",
          });
        }
        break;

      case "Encounter":
        if (!resource.status) {
          errors.push({
            path: "status",
            message: "Encounter.status is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        if (!resource.class) {
          errors.push({
            path: "class",
            message: "Encounter.class is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        break;

      case "MedicationRequest":
        if (!resource.status) {
          errors.push({
            path: "status",
            message: "MedicationRequest.status is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        if (!resource.intent) {
          errors.push({
            path: "intent",
            message: "MedicationRequest.intent is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        if (!resource.medicationCodeableConcept && !resource.medicationReference) {
          errors.push({
            path: "medication[x]",
            message: "MedicationRequest must have either medicationCodeableConcept or medicationReference",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        if (!resource.subject) {
          errors.push({
            path: "subject",
            message: "MedicationRequest.subject is required",
            severity: "error",
            code: "REQUIRED_FIELD_MISSING",
          });
        }
        break;
    }
  }

  recordPerformanceMetric(metric: Omit<PerformanceMetrics, "timestamp">): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: Date.now(),
    };
    this.performanceMetrics.push(fullMetric);

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.performanceMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp > oneHourAgo
    );

    this.releaseConnection(metric.serverId);

    const server = this.servers.get(metric.serverId);
    if (server) {
      server.metadata.totalRequests = (server.metadata.totalRequests || 0) + 1;
      server.metadata.lastResponseTimeMs = metric.responseTimeMs;
      
      const serverMetrics = this.performanceMetrics.filter(
        (m) => m.serverId === metric.serverId
      );
      const successCount = serverMetrics.filter((m) => m.success).length;
      server.metadata.successRate = serverMetrics.length > 0
        ? successCount / serverMetrics.length
        : 1;
    }
  }

  getPerformanceStats(filters?: {
    serverId?: string;
    resourceType?: string;
    timeRangeMinutes?: number;
  }): GatewayStats {
    let metrics = [...this.performanceMetrics];

    if (filters?.timeRangeMinutes) {
      const cutoff = Date.now() - filters.timeRangeMinutes * 60 * 1000;
      metrics = metrics.filter((m) => m.timestamp > cutoff);
    }

    if (filters?.serverId) {
      metrics = metrics.filter((m) => m.serverId === filters.serverId);
    }

    if (filters?.resourceType) {
      metrics = metrics.filter((m) => m.resourceType === filters.resourceType);
    }

    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = metrics.map((m) => m.responseTimeMs).sort((a, b) => a - b);
    const averageResponseTimeMs = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const p95ResponseTimeMs = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.95)] || 0
      : 0;
    const p99ResponseTimeMs = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.99)] || 0
      : 0;

    const requestsByServer: Record<string, number> = {};
    const requestsByResourceType: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};

    for (const metric of metrics) {
      requestsByServer[metric.serverId] = (requestsByServer[metric.serverId] || 0) + 1;
      if (metric.resourceType) {
        requestsByResourceType[metric.resourceType] = 
          (requestsByResourceType[metric.resourceType] || 0) + 1;
      }
      if (!metric.success) {
        const errorKey = `HTTP_${metric.statusCode}`;
        errorsByType[errorKey] = (errorsByType[errorKey] || 0) + 1;
      }
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTimeMs,
      p95ResponseTimeMs,
      p99ResponseTimeMs,
      requestsByServer,
      requestsByResourceType,
      errorsByType,
      validationStats: { ...this.validationStats },
    };
  }

  private redactPHIFromQuery(query: string): string {
    let redacted = query;
    redacted = redacted.replace(/patient=[A-Za-z0-9\-]+/gi, "patient=[REDACTED]");
    redacted = redacted.replace(/subject=[A-Za-z0-9\-]+/gi, "subject=[REDACTED]");
    redacted = redacted.replace(/identifier=[^&]+/gi, "identifier=[REDACTED]");
    redacted = redacted.replace(/[0-9]{3}-[0-9]{2}-[0-9]{4}/g, "[SSN-REDACTED]");
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]");
    redacted = redacted.replace(/\b\d{10,11}\b/g, "[PHONE-REDACTED]");
    return redacted;
  }

  async generateQueryOptimizationSuggestions(
    query: string,
    resourceType: string,
    performanceData?: {
      averageResponseTimeMs: number;
      resultCount?: number;
    }
  ): Promise<QueryOptimizationSuggestion> {
    const redactedQuery = this.redactPHIFromQuery(query);
    const existingKey = `${resourceType}:${hashIdentifier(query)}`;
    const cached = this.optimizationSuggestions.get(existingKey);
    if (cached && Date.now() - new Date(cached.generatedAt).getTime() < 3600000) {
      return cached;
    }

    let suggestions: QueryOptimizationSuggestion["suggestions"] = [];
    let aiAnalysis = "";

    if (this.openai) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a FHIR API performance optimization expert. Analyze FHIR queries and provide specific, actionable optimization suggestions.

Focus on:
1. Query parameter optimization (efficient filters, proper use of _include/_revinclude)
2. Pagination strategies (_count, _offset, cursors)
3. Caching opportunities
4. Index utilization hints
5. Batch operation opportunities

DO NOT provide any clinical advice or medical recommendations. Focus only on technical query performance.
DO NOT attempt to identify patients or interpret clinical data. Focus solely on query structure optimization.

Return your analysis as JSON with this structure:
{
  "suggestions": [
    {
      "type": "index|pagination|include|filter|caching|batch",
      "description": "Clear description of the optimization",
      "impact": "high|medium|low",
      "optimizedQuery": "The optimized query string if applicable",
      "estimatedImprovement": "Expected performance improvement"
    }
  ],
  "analysis": "Overall analysis of the query performance"
}`,
            },
            {
              role: "user",
              content: `Analyze this FHIR query for optimization opportunities:

Resource Type: ${resourceType}
Query: ${redactedQuery}
${performanceData ? `Current Average Response Time: ${performanceData.averageResponseTimeMs}ms` : ""}
${performanceData?.resultCount !== undefined ? `Result Count: ${performanceData.resultCount}` : ""}

Provide optimization suggestions.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              suggestions = parsed.suggestions || [];
              aiAnalysis = parsed.analysis || "";
            }
          } catch {
            aiAnalysis = content;
          }
        }
      } catch (error) {
        console.error("[AIFHIRApiGateway] OpenAI query optimization error:", error);
      }
    }

    if (suggestions.length === 0) {
      suggestions = this.generateRuleBasedSuggestions(query, resourceType, performanceData);
      aiAnalysis = "Rule-based analysis (AI unavailable)";
    }

    const suggestion: QueryOptimizationSuggestion = {
      id: `opt-${randomUUID()}`,
      query,
      resourceType,
      suggestions,
      aiAnalysis,
      generatedAt: new Date().toISOString(),
    };

    this.optimizationSuggestions.set(existingKey, suggestion);
    return suggestion;
  }

  private generateRuleBasedSuggestions(
    query: string,
    resourceType: string,
    performanceData?: { averageResponseTimeMs: number; resultCount?: number }
  ): QueryOptimizationSuggestion["suggestions"] {
    const suggestions: QueryOptimizationSuggestion["suggestions"] = [];

    if (!query.includes("_count=")) {
      suggestions.push({
        type: "pagination",
        description: "Add _count parameter to limit result set size",
        impact: "high",
        optimizedQuery: query + (query.includes("?") ? "&" : "?") + "_count=50",
        estimatedImprovement: "30-50% faster response times",
      });
    }

    if (query.includes("_include=*") || query.includes("_revinclude=*")) {
      suggestions.push({
        type: "include",
        description: "Avoid wildcard _include/_revinclude; specify exact references",
        impact: "high",
        estimatedImprovement: "40-60% reduction in response size",
      });
    }

    if (resourceType === "Observation" && !query.includes("patient=") && !query.includes("subject=")) {
      suggestions.push({
        type: "filter",
        description: "Add patient/subject filter to narrow Observation queries",
        impact: "high",
        estimatedImprovement: "Significant reduction in scan scope",
      });
    }

    if (performanceData && performanceData.averageResponseTimeMs > 500) {
      suggestions.push({
        type: "caching",
        description: "Consider implementing response caching for this query pattern",
        impact: "medium",
        estimatedImprovement: "90%+ improvement for cached hits",
      });
    }

    if (query.includes("_sort=") && !query.includes("_count=")) {
      suggestions.push({
        type: "index",
        description: "Ensure sorted fields are indexed; combine with _count for efficiency",
        impact: "medium",
        estimatedImprovement: "20-40% faster sorting",
      });
    }

    if (performanceData?.resultCount && performanceData.resultCount > 1000) {
      suggestions.push({
        type: "batch",
        description: "Large result sets should use pagination with cursor-based navigation",
        impact: "high",
        estimatedImprovement: "Better memory usage and faster initial response",
      });
    }

    return suggestions;
  }

  async addServer(server: Omit<FHIRServer, "id" | "healthStatus" | "lastHealthCheck" | "metadata">): Promise<FHIRServer> {
    const newServer: FHIRServer = {
      ...server,
      id: `server-${randomUUID()}`,
      healthStatus: "unknown",
      lastHealthCheck: new Date().toISOString(),
      metadata: {
        totalRequests: 0,
        successRate: 1,
      },
    };
    this.servers.set(newServer.id, newServer);
    return newServer;
  }

  async updateServer(serverId: string, updates: Partial<FHIRServer>): Promise<FHIRServer | null> {
    const server = this.servers.get(serverId);
    if (!server) return null;

    const updated = { ...server, ...updates, id: server.id };
    this.servers.set(serverId, updated);
    return updated;
  }

  async deleteServer(serverId: string): Promise<boolean> {
    return this.servers.delete(serverId);
  }

  getServer(serverId: string): FHIRServer | null {
    return this.servers.get(serverId) || null;
  }

  listServers(filters?: { type?: string; enabled?: boolean; healthStatus?: string }): FHIRServer[] {
    let servers = Array.from(this.servers.values());

    if (filters?.type) {
      servers = servers.filter((s) => s.type === filters.type);
    }
    if (filters?.enabled !== undefined) {
      servers = servers.filter((s) => s.enabled === filters.enabled);
    }
    if (filters?.healthStatus) {
      servers = servers.filter((s) => s.healthStatus === filters.healthStatus);
    }

    return servers.sort((a, b) => a.priority - b.priority);
  }

  async addRoutingRule(rule: Omit<RoutingRule, "id">): Promise<RoutingRule> {
    const newRule: RoutingRule = {
      ...rule,
      id: `rule-${randomUUID()}`,
    };
    this.routingRules.set(newRule.id, newRule);
    return newRule;
  }

  async updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): Promise<RoutingRule | null> {
    const rule = this.routingRules.get(ruleId);
    if (!rule) return null;

    const updated = { ...rule, ...updates, id: rule.id };
    this.routingRules.set(ruleId, updated);
    return updated;
  }

  async deleteRoutingRule(ruleId: string): Promise<boolean> {
    return this.routingRules.delete(ruleId);
  }

  listRoutingRules(): RoutingRule[] {
    return Array.from(this.routingRules.values()).sort((a, b) => a.priority - b.priority);
  }

  async simulateRequest(
    resourceType: string,
    operation: "read" | "search" | "create" | "update" | "delete",
    resource?: Record<string, unknown>
  ): Promise<{
    routing: { server: FHIRServer; rule?: RoutingRule };
    validation?: ValidationResult;
    estimatedLatencyMs: number;
  }> {
    const routing = await this.routeRequest(resourceType, operation);
    
    let validation: ValidationResult | undefined;
    if (resource && (operation === "create" || operation === "update")) {
      validation = this.validateFHIRResource(resource);
    }

    const baseLatency = routing.server.metadata.lastResponseTimeMs || 50;
    const jitter = Math.random() * 20 - 10;
    const estimatedLatencyMs = Math.max(10, baseLatency + jitter);

    return {
      routing,
      validation,
      estimatedLatencyMs,
    };
  }

  async evaluateAccess(
    userRole: string,
    resourceType: string,
    operation: "read" | "search" | "create" | "update" | "delete",
    context?: { userId?: string; clientIp?: string; hasMfa?: boolean }
  ): Promise<AccessDecision> {
    const auditId = `audit-${randomUUID().substring(0, 8)}`;
    const sortedPolicies = Array.from(this.accessPolicies.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const policy of sortedPolicies) {
      if (!policy.roles.includes(userRole) && !policy.roles.includes("*")) continue;
      if (!policy.resourceTypes.includes(resourceType) && !policy.resourceTypes.includes("*")) continue;
      if (!policy.operations.includes(operation)) continue;

      if (policy.conditions?.requireMfa && !context?.hasMfa) {
        continue;
      }

      if (policy.conditions?.allowedIpRanges && context?.clientIp) {
        const ipAllowed = policy.conditions.allowedIpRanges.some(range =>
          this.ipInCIDR(context.clientIp!, range) || range === context.clientIp
        );
        if (!ipAllowed) continue;
      }

      const sensitivityInfo = this.SENSITIVE_ELEMENTS[resourceType];
      const resourceSensitivity = sensitivityInfo?.level || "low";

      if (!policy.sensitivityLevels.includes(resourceSensitivity)) {
        continue;
      }

      const riskScore = this.calculateRiskScore(userRole, resourceType, operation, resourceSensitivity);

      return {
        allowed: true,
        policyId: policy.id,
        policyName: policy.name,
        reason: `Access granted by policy: ${policy.name}`,
        maskedElements: policy.elementAccess.masked,
        deniedElements: policy.elementAccess.denied,
        riskScore,
        auditId,
      };
    }

    const riskScore = this.calculateRiskScore(userRole, resourceType, operation, "medium");

    return {
      allowed: false,
      reason: `No matching access policy for role '${userRole}' on ${resourceType}/${operation}`,
      maskedElements: [],
      deniedElements: [],
      riskScore,
      auditId,
    };
  }

  private calculateRiskScore(
    role: string,
    resourceType: string,
    operation: string,
    sensitivity: string
  ): number {
    let score = 0;

    const sensitivityScores: Record<string, number> = { low: 0.1, medium: 0.3, high: 0.6, restricted: 0.9 };
    score += sensitivityScores[sensitivity] || 0.5;

    const operationScores: Record<string, number> = { read: 0.1, search: 0.15, create: 0.3, update: 0.4, delete: 0.5 };
    score += operationScores[operation] || 0.3;

    const roleRiskModifiers: Record<string, number> = { admin: -0.2, physician: -0.1, patient: 0.1, researcher: 0.2, external: 0.4 };
    score += roleRiskModifiers[role] || 0;

    return Math.max(0, Math.min(1, score));
  }

  async evaluateAccessWithAI(
    userRole: string,
    resourceType: string,
    operation: string,
    context: { userId?: string; previousRequests?: number; timeOfDay?: number }
  ): Promise<{ recommendation: string; riskFactors: string[]; suggestedAction: string }> {
    if (this.openai) {
      try {
        const prompt = `Analyze this FHIR API access request for security risk:
Role: ${userRole}
Resource: ${resourceType}
Operation: ${operation}
User ID: ${hashIdentifier(context.userId || "anonymous")}
Previous requests in session: ${context.previousRequests || 0}
Hour of day: ${context.timeOfDay || new Date().getHours()}

Provide a brief risk analysis and recommendation. Focus on access patterns, not clinical data. NO clinical decision support.`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a healthcare IT security analyst. Analyze access patterns for anomalies. NO clinical advice." },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content || "";
        const lines = content.split("\n").filter(l => l.trim());

        return {
          recommendation: lines[0] || "Standard access pattern observed",
          riskFactors: lines.slice(1, 4).map(l => l.replace(/^[-*]\s*/, "")),
          suggestedAction: lines.length > 4 ? lines[4] : "Allow with standard logging",
        };
      } catch (error) {
        console.error("[AIFHIRApiGateway] AI access evaluation error:", error);
      }
    }

    return {
      recommendation: "Rule-based evaluation: Access pattern within normal parameters",
      riskFactors: [],
      suggestedAction: "Allow with audit logging",
    };
  }

  getCacheKey(resourceType: string, operation: string, query?: string, userId?: string): string {
    const parts = [resourceType, operation, query || "", userId || "anonymous"];
    return createHash("sha256").update(parts.join(":")).digest("hex");
  }

  getFromCache(key: string): CacheEntry | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    return entry;
  }

  setCache(
    key: string,
    resourceType: string,
    response: unknown,
    options?: { query?: string; userId?: string; sensitivityLevel?: "low" | "medium" | "high" | "restricted" }
  ): void {
    if (!this.cacheConfig.enabled) return;
    if (this.cacheConfig.excludedResourceTypes.includes(resourceType)) return;

    const ttl = this.cacheConfig.ttlByResourceType[resourceType] || this.cacheConfig.defaultTtlMs;
    const now = Date.now();
    const sizeBytes = JSON.stringify(response).length;

    if (this.cache.size >= this.cacheConfig.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      key,
      resourceType,
      query: options?.query,
      response,
      createdAt: now,
      expiresAt: now + ttl,
      hitCount: 0,
      sizeBytes,
      sensitivityLevel: options?.sensitivityLevel || "low",
      userId: options?.userId,
    };

    this.cache.set(key, entry);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let lowestHits = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.hitCount < lowestHits || (entry.hitCount === lowestHits && entry.createdAt < oldestTime)) {
        oldestKey = key;
        oldestTime = entry.createdAt;
        lowestHits = entry.hitCount;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  invalidateCache(resourceType?: string, userId?: string): number {
    let invalidated = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (resourceType && entry.resourceType !== resourceType) continue;
      if (userId && entry.userId !== userId) continue;
      this.cache.delete(key);
      invalidated++;
    }
    return invalidated;
  }

  getCacheStats(): { entries: number; totalSizeBytes: number; hitRate: number; byResourceType: Record<string, number> } {
    let totalSize = 0;
    let totalHits = 0;
    const byResourceType: Record<string, number> = {};

    const cacheValues = Array.from(this.cache.values());
    for (const entry of cacheValues) {
      totalSize += entry.sizeBytes;
      totalHits += entry.hitCount;
      byResourceType[entry.resourceType] = (byResourceType[entry.resourceType] || 0) + 1;
    }

    return {
      entries: this.cache.size,
      totalSizeBytes: totalSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      byResourceType,
    };
  }

  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  updateCacheConfig(updates: Partial<CacheConfig>): CacheConfig {
    this.cacheConfig = { ...this.cacheConfig, ...updates };
    return this.cacheConfig;
  }

  checkRateLimit(
    identifier: string,
    scope: "user" | "role" | "ip" | "global",
    resourceType?: string,
    operation?: string
  ): RateLimitResult {
    const now = Date.now();
    const stateKey = `${scope}:${identifier}`;

    let state = this.rateLimitStates.get(stateKey);
    const existingState = state;
    if (!state || state.minuteResetAt <= now) {
      const prevHourResetAt = existingState?.hourResetAt || 0;
      const prevDayResetAt = existingState?.dayResetAt || 0;
      state = {
        identifier,
        scope,
        minuteCount: 0,
        hourCount: prevHourResetAt > now ? (existingState?.hourCount || 0) : 0,
        dayCount: prevDayResetAt > now ? (existingState?.dayCount || 0) : 0,
        minuteResetAt: now + 60000,
        hourResetAt: prevHourResetAt > now ? prevHourResetAt : now + 3600000,
        dayResetAt: prevDayResetAt > now ? prevDayResetAt : now + 86400000,
        blocked: false,
        warnings: existingState?.warnings || 0,
      };
    }

    if (state.blocked && state.blockedUntil && state.blockedUntil > now) {
      return {
        allowed: false,
        remaining: { minute: 0, hour: 0, day: 0 },
        resetAt: { minute: state.minuteResetAt, hour: state.hourResetAt, day: state.dayResetAt },
        blocked: true,
        blockedUntil: state.blockedUntil,
        reason: "Rate limit exceeded - temporarily blocked",
      };
    }

    state.blocked = false;
    state.blockedUntil = undefined;

    const config = this.findApplicableRateLimitConfig(scope, identifier);
    if (!config || !config.enabled) {
      this.rateLimitStates.set(stateKey, state);
      return {
        allowed: true,
        remaining: { minute: 999, hour: 9999, day: 99999 },
        resetAt: { minute: state.minuteResetAt, hour: state.hourResetAt, day: state.dayResetAt },
        blocked: false,
      };
    }

    let minuteLimit = config.limits.requestsPerMinute;
    if (resourceType && config.resourceTypeOverrides?.[resourceType]) {
      minuteLimit = config.resourceTypeOverrides[resourceType].requestsPerMinute;
    }
    if (operation && config.operationOverrides?.[operation]) {
      minuteLimit = config.operationOverrides[operation].requestsPerMinute;
    }

    const minuteRemaining = minuteLimit - state.minuteCount;
    const hourRemaining = config.limits.requestsPerHour - state.hourCount;
    const dayRemaining = config.limits.requestsPerDay - state.dayCount;

    if (minuteRemaining <= 0 || hourRemaining <= 0 || dayRemaining <= 0) {
      state.blocked = true;
      state.blockedUntil = now + config.penaltyConfig.blockDurationMs;
      state.warnings++;
      this.rateLimitStates.set(stateKey, state);

      return {
        allowed: false,
        remaining: { minute: Math.max(0, minuteRemaining), hour: Math.max(0, hourRemaining), day: Math.max(0, dayRemaining) },
        resetAt: { minute: state.minuteResetAt, hour: state.hourResetAt, day: state.dayResetAt },
        blocked: true,
        blockedUntil: state.blockedUntil,
        reason: "Rate limit exceeded",
      };
    }

    state.minuteCount++;
    state.hourCount++;
    state.dayCount++;
    this.rateLimitStates.set(stateKey, state);

    return {
      allowed: true,
      remaining: { minute: minuteRemaining - 1, hour: hourRemaining - 1, day: dayRemaining - 1 },
      resetAt: { minute: state.minuteResetAt, hour: state.hourResetAt, day: state.dayResetAt },
      blocked: false,
    };
  }

  private findApplicableRateLimitConfig(scope: string, identifier: string): RateLimitConfig | undefined {
    const configs = Array.from(this.rateLimitConfigs.values());
    for (const config of configs) {
      if (config.scope === scope) {
        if (!config.identifier || config.identifier === identifier) {
          return config;
        }
      }
    }
    return this.rateLimitConfigs.get("ratelimit-global");
  }

  getRateLimitConfigs(): RateLimitConfig[] {
    return Array.from(this.rateLimitConfigs.values());
  }

  addRateLimitConfig(config: Omit<RateLimitConfig, "id">): RateLimitConfig {
    const newConfig: RateLimitConfig = { ...config, id: `ratelimit-${randomUUID().substring(0, 8)}` };
    this.rateLimitConfigs.set(newConfig.id, newConfig);
    return newConfig;
  }

  updateRateLimitConfig(id: string, updates: Partial<RateLimitConfig>): RateLimitConfig | null {
    const config = this.rateLimitConfigs.get(id);
    if (!config) return null;
    const updated = { ...config, ...updates, id: config.id };
    this.rateLimitConfigs.set(id, updated);
    return updated;
  }

  deleteRateLimitConfig(id: string): boolean {
    return this.rateLimitConfigs.delete(id);
  }

  logAuditEntry(entry: Omit<GatewayAuditEntry, "id" | "timestamp">): GatewayAuditEntry {
    const auditEntry: GatewayAuditEntry = {
      ...entry,
      id: `audit-${randomUUID().substring(0, 8)}`,
      timestamp: new Date().toISOString(),
      userId: entry.userId ? hashIdentifier(entry.userId) : undefined,
    };

    this.auditLog.unshift(auditEntry);

    if (this.auditLog.length > this.MAX_AUDIT_ENTRIES) {
      this.auditLog = this.auditLog.slice(0, this.MAX_AUDIT_ENTRIES);
    }

    return auditEntry;
  }

  getAuditLog(filters?: {
    userId?: string;
    resourceType?: string;
    operation?: string;
    startDate?: string;
    endDate?: string;
    accessAllowed?: boolean;
    limit?: number;
  }): GatewayAuditEntry[] {
    let entries = [...this.auditLog];

    if (filters?.userId) {
      const hashedUserId = hashIdentifier(filters.userId);
      entries = entries.filter(e => e.userId === hashedUserId);
    }
    if (filters?.resourceType) {
      entries = entries.filter(e => e.resourceType === filters.resourceType);
    }
    if (filters?.operation) {
      entries = entries.filter(e => e.operation === filters.operation);
    }
    if (filters?.startDate) {
      entries = entries.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      entries = entries.filter(e => e.timestamp <= filters.endDate!);
    }
    if (filters?.accessAllowed !== undefined) {
      entries = entries.filter(e => e.accessDecision.allowed === filters.accessAllowed);
    }

    return entries.slice(0, filters?.limit || 100);
  }

  getAuditStats(): {
    totalRequests: number;
    deniedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    byResourceType: Record<string, number>;
    byOperation: Record<string, number>;
    averageResponseTimeMs: number;
    phiAccessCount: number;
  } {
    const stats = {
      totalRequests: this.auditLog.length,
      deniedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      byResourceType: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      averageResponseTimeMs: 0,
      phiAccessCount: 0,
    };

    let totalResponseTime = 0;

    for (const entry of this.auditLog) {
      if (!entry.accessDecision.allowed) stats.deniedRequests++;
      if (entry.cacheStatus === "hit") stats.cacheHits++;
      if (entry.cacheStatus === "miss") stats.cacheMisses++;
      if (entry.phiAccessed) stats.phiAccessCount++;

      stats.byResourceType[entry.resourceType] = (stats.byResourceType[entry.resourceType] || 0) + 1;
      stats.byOperation[entry.operation] = (stats.byOperation[entry.operation] || 0) + 1;
      totalResponseTime += entry.responseTimeMs;
    }

    stats.averageResponseTimeMs = this.auditLog.length > 0 ? totalResponseTime / this.auditLog.length : 0;

    return stats;
  }

  listAccessPolicies(): AccessControlPolicy[] {
    return Array.from(this.accessPolicies.values()).sort((a, b) => a.priority - b.priority);
  }

  getAccessPolicy(id: string): AccessControlPolicy | null {
    return this.accessPolicies.get(id) || null;
  }

  addAccessPolicy(policy: Omit<AccessControlPolicy, "id" | "createdAt" | "updatedAt">): AccessControlPolicy {
    const now = new Date().toISOString();
    const newPolicy: AccessControlPolicy = {
      ...policy,
      id: `policy-${randomUUID().substring(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.accessPolicies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  updateAccessPolicy(id: string, updates: Partial<AccessControlPolicy>): AccessControlPolicy | null {
    const policy = this.accessPolicies.get(id);
    if (!policy) return null;
    const updated: AccessControlPolicy = { ...policy, ...updates, id: policy.id, updatedAt: new Date().toISOString() };
    this.accessPolicies.set(id, updated);
    return updated;
  }

  deleteAccessPolicy(id: string): boolean {
    return this.accessPolicies.delete(id);
  }

  private initializeDefaultThreatIntelligence(): void {
    const threats: ThreatIntelligence[] = [
      {
        id: "threat-sql-injection",
        type: "pattern_signature",
        indicator: "(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR\\s+1=1)",
        severity: "critical",
        description: "SQL injection attempt pattern",
        source: "internal",
        active: true,
      },
      {
        id: "threat-path-traversal",
        type: "pattern_signature",
        indicator: "(\\.\\./|\\.\\.\\\\/|%2e%2e%2f)",
        severity: "high",
        description: "Path traversal attack pattern",
        source: "internal",
        active: true,
      },
      {
        id: "threat-xss",
        type: "pattern_signature",
        indicator: "(<script|javascript:|on\\w+=)",
        severity: "high",
        description: "Cross-site scripting attempt",
        source: "internal",
        active: true,
      },
      {
        id: "threat-enumeration",
        type: "attack_vector",
        indicator: "sequential_id_access",
        severity: "medium",
        description: "Resource ID enumeration attack",
        source: "internal",
        active: true,
      },
    ];
    threats.forEach(t => this.threatIntelligence.set(t.id, t));
    console.log(`[AIFHIRApiGateway] Initialized ${threats.length} threat intelligence entries`);
  }

  private initializeSampleBehaviorProfiles(): void {
    const sampleProfiles: UserBehaviorProfile[] = [
      {
        userId: "user-admin-001",
        lastUpdated: new Date().toISOString(),
        requestPatterns: {
          averageRequestsPerMinute: 5,
          averageRequestsPerHour: 150,
          peakHours: [9, 10, 11, 14, 15, 16],
          commonResourceTypes: ["Patient", "Practitioner", "Organization"],
          commonOperations: ["read", "search"],
          typicalResponseTimes: [50, 100, 150],
        },
        accessPatterns: {
          commonIpRanges: ["10.0.0.0/8", "192.168.0.0/16"],
          commonUserAgents: ["Mozilla/5.0", "FHIR-Client/1.0"],
          geoLocations: ["US", "CA"],
          sessionDurations: [1800, 3600, 7200],
        },
        riskFactors: {
          failedAuthAttempts: 0,
          deniedAccessAttempts: 2,
          rateLimitViolations: 0,
          anomalyCount: 0,
        },
        trustScore: 0.95,
      },
      {
        userId: "user-clinician-001",
        lastUpdated: new Date().toISOString(),
        requestPatterns: {
          averageRequestsPerMinute: 10,
          averageRequestsPerHour: 300,
          peakHours: [8, 9, 10, 11, 13, 14, 15, 16, 17],
          commonResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest"],
          commonOperations: ["read", "search", "create", "update"],
          typicalResponseTimes: [30, 75, 120],
        },
        accessPatterns: {
          commonIpRanges: ["10.0.0.0/8"],
          commonUserAgents: ["EMR-Client/2.0"],
          geoLocations: ["US"],
          sessionDurations: [3600, 7200, 14400],
        },
        riskFactors: {
          failedAuthAttempts: 1,
          deniedAccessAttempts: 5,
          rateLimitViolations: 1,
          anomalyCount: 0,
        },
        trustScore: 0.88,
      },
    ];
    sampleProfiles.forEach(p => this.userBehaviorProfiles.set(p.userId, p));
    console.log(`[AIFHIRApiGateway] Initialized ${sampleProfiles.length} behavior profiles`);
  }

  private startAnomalyDetectionLoop(): void {
    setInterval(() => {
      if (!this.anomalyDetectionConfig.enabled) return;
      this.performAnomalyAnalysis();
    }, 30000);
    console.log("[AIFHIRApiGateway] Anomaly detection loop started (30s interval)");
  }

  private performAnomalyAnalysis(): void {
    const now = Date.now();
    const windowMs = this.anomalyDetectionConfig.baselineWindowHours * 60 * 60 * 1000;
    const recentEntries = this.auditLog.filter(e => now - new Date(e.timestamp).getTime() < windowMs);

    const ipRequestCounts = new Map<string, number>();
    for (const entry of recentEntries) {
      ipRequestCounts.set(entry.clientIp, (ipRequestCounts.get(entry.clientIp) || 0) + 1);
    }

    for (const [ip, count] of ipRequestCounts) {
      const avgCount = recentEntries.length / Math.max(1, ipRequestCounts.size);
      if (count > avgCount * this.anomalyDetectionConfig.detectionThresholds.requestVelocityMultiplier) {
        const existing = this.anomalyEvents.find(e => e.clientIp === ip && e.anomalyType === "velocity" && !e.resolved);
        if (!existing) {
          this.recordAnomalyEvent({
            clientIp: ip,
            anomalyType: "velocity",
            severity: count > avgCount * 5 ? "critical" : count > avgCount * 4 ? "high" : "medium",
            confidence: Math.min(0.95, 0.6 + (count / avgCount) * 0.1),
            description: `Unusual request velocity detected from IP ${hashIdentifier(ip)}`,
            indicators: [`Request count: ${count}`, `Average: ${avgCount.toFixed(1)}`, `Multiplier: ${(count / avgCount).toFixed(2)}x`],
            baselineValue: avgCount,
            observedValue: count,
          });
        }
      }
    }
  }

  private recordAnomalyEvent(params: {
    userId?: string;
    clientIp: string;
    anomalyType: AnomalyEvent["anomalyType"];
    severity: AnomalyEvent["severity"];
    confidence: number;
    description: string;
    indicators: string[];
    baselineValue?: number;
    observedValue?: number;
    aiAnalysis?: string;
  }): AnomalyEvent {
    let actionTaken: AnomalyEvent["actionTaken"] = "logged";

    if (params.severity === "critical" && this.anomalyDetectionConfig.autoBlockOnCritical) {
      actionTaken = "blocked";
      this.blockIdentifier(params.clientIp, 3600000);
    } else if (params.severity === "high") {
      actionTaken = this.anomalyDetectionConfig.alertOnHigh ? "alerted" : "rate_limited";
      this.adjustAdaptiveRateLimit(params.userId || params.clientIp, "high", `Anomaly detected: ${params.anomalyType}`);
    } else if (params.severity === "medium") {
      actionTaken = "rate_limited";
      this.adjustAdaptiveRateLimit(params.userId || params.clientIp, "medium", `Anomaly detected: ${params.anomalyType}`);
    }

    const event: AnomalyEvent = {
      id: `anomaly-${randomUUID().substring(0, 8)}`,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      clientIp: params.clientIp,
      anomalyType: params.anomalyType,
      severity: params.severity,
      confidence: params.confidence,
      description: params.description,
      indicators: params.indicators,
      baselineValue: params.baselineValue,
      observedValue: params.observedValue,
      aiAnalysis: params.aiAnalysis,
      actionTaken,
      resolved: false,
    };

    this.anomalyEvents.push(event);
    if (this.anomalyEvents.length > this.MAX_ANOMALY_EVENTS) {
      this.anomalyEvents = this.anomalyEvents.slice(-this.MAX_ANOMALY_EVENTS);
    }

    this.logSecurityAudit("ANOMALY_DETECTED", {
      anomalyId: event.id,
      type: event.anomalyType,
      severity: event.severity,
      clientIp: hashIdentifier(params.clientIp),
      userId: params.userId ? hashIdentifier(params.userId) : undefined,
      actionTaken,
    });

    return event;
  }

  private blockIdentifier(identifier: string, durationMs: number): void {
    const state = this.rateLimitStates.get(identifier) || {
      identifier,
      scope: "ip",
      minuteCount: 0,
      hourCount: 0,
      dayCount: 0,
      minuteResetAt: Date.now() + 60000,
      hourResetAt: Date.now() + 3600000,
      dayResetAt: Date.now() + 86400000,
      blocked: false,
      warnings: 0,
    };
    state.blocked = true;
    state.blockedUntil = Date.now() + durationMs;
    this.rateLimitStates.set(identifier, state);

    this.logSecurityAudit("IDENTIFIER_BLOCKED", {
      identifier: hashIdentifier(identifier),
      durationMs,
      blockedUntil: new Date(state.blockedUntil).toISOString(),
    });
  }

  private adjustAdaptiveRateLimit(identifier: string, threatLevel: "low" | "medium" | "high" | "critical", reason: string): void {
    let state = this.adaptiveRateLimits.get(identifier);
    if (!state) {
      const defaultConfig = Array.from(this.rateLimitConfigs.values()).find(c => c.scope === "user") || 
        Array.from(this.rateLimitConfigs.values())[0];
      state = {
        identifier,
        baseLimits: {
          requestsPerMinute: defaultConfig?.limits.requestsPerMinute || 60,
          requestsPerHour: defaultConfig?.limits.requestsPerHour || 1000,
          burstLimit: defaultConfig?.limits.burstLimit || 20,
        },
        currentLimits: {
          requestsPerMinute: defaultConfig?.limits.requestsPerMinute || 60,
          requestsPerHour: defaultConfig?.limits.requestsPerHour || 1000,
          burstLimit: defaultConfig?.limits.burstLimit || 20,
        },
        adjustmentFactor: 1.0,
        threatLevel: "none",
        adjustmentHistory: [],
        lastAdjustment: new Date().toISOString(),
      };
    }

    const previousFactor = state.adjustmentFactor;
    const factors: Record<string, number> = { none: 1.0, low: 0.8, medium: 0.5, high: 0.25, critical: 0.1 };
    state.adjustmentFactor = factors[threatLevel];
    state.threatLevel = threatLevel;
    state.currentLimits = {
      requestsPerMinute: Math.ceil(state.baseLimits.requestsPerMinute * state.adjustmentFactor),
      requestsPerHour: Math.ceil(state.baseLimits.requestsPerHour * state.adjustmentFactor),
      burstLimit: Math.ceil(state.baseLimits.burstLimit * state.adjustmentFactor),
    };

    state.adjustmentHistory.push({
      timestamp: new Date().toISOString(),
      previousFactor,
      newFactor: state.adjustmentFactor,
      reason,
    });
    if (state.adjustmentHistory.length > 50) {
      state.adjustmentHistory = state.adjustmentHistory.slice(-50);
    }
    state.lastAdjustment = new Date().toISOString();

    this.adaptiveRateLimits.set(identifier, state);

    this.logSecurityAudit("ADAPTIVE_RATE_LIMIT_ADJUSTED", {
      identifier: hashIdentifier(identifier),
      threatLevel,
      previousFactor,
      newFactor: state.adjustmentFactor,
      newLimits: state.currentLimits,
      reason,
    });
  }

  async assessRequestRisk(
    userId: string | undefined,
    clientIp: string,
    operation: string,
    resourceType: string,
    query?: string,
    userAgent?: string
  ): Promise<RiskAssessment> {
    const requestId = randomUUID();
    const factors: RiskAssessment["factors"] = [];
    let totalScore = 0;
    let totalWeight = 0;

    const profile = userId ? this.userBehaviorProfiles.get(userId) : undefined;
    if (profile) {
      const trustFactor = 1 - profile.trustScore;
      factors.push({
        name: "user_trust_score",
        score: trustFactor,
        weight: 0.25,
        description: `User trust score: ${(profile.trustScore * 100).toFixed(0)}%`,
      });
      totalScore += trustFactor * 0.25;
      totalWeight += 0.25;

      if (!profile.requestPatterns.commonResourceTypes.includes(resourceType)) {
        factors.push({
          name: "unusual_resource_access",
          score: 0.6,
          weight: 0.15,
          description: `Unusual resource type access: ${resourceType}`,
        });
        totalScore += 0.6 * 0.15;
        totalWeight += 0.15;
      }

      const currentHour = new Date().getHours();
      if (!profile.requestPatterns.peakHours.includes(currentHour)) {
        factors.push({
          name: "off_hours_access",
          score: 0.4,
          weight: 0.1,
          description: `Access outside typical hours (current: ${currentHour}:00)`,
        });
        totalScore += 0.4 * 0.1;
        totalWeight += 0.1;
      }

      if (profile.riskFactors.anomalyCount > 0) {
        const anomalyScore = Math.min(1, profile.riskFactors.anomalyCount * 0.2);
        factors.push({
          name: "prior_anomalies",
          score: anomalyScore,
          weight: 0.2,
          description: `User has ${profile.riskFactors.anomalyCount} prior anomalies`,
        });
        totalScore += anomalyScore * 0.2;
        totalWeight += 0.2;
      }
    } else {
      factors.push({
        name: "unknown_user",
        score: 0.5,
        weight: 0.2,
        description: userId ? "User has no established behavior profile" : "Anonymous request",
      });
      totalScore += 0.5 * 0.2;
      totalWeight += 0.2;
    }

    const sensitiveOps = ["create", "update", "delete"];
    if (sensitiveOps.includes(operation)) {
      factors.push({
        name: "sensitive_operation",
        score: 0.4,
        weight: 0.15,
        description: `Write operation: ${operation}`,
      });
      totalScore += 0.4 * 0.15;
      totalWeight += 0.15;
    }

    const sensitiveResources = ["Patient", "DiagnosticReport", "AllergyIntolerance"];
    if (sensitiveResources.includes(resourceType)) {
      factors.push({
        name: "sensitive_resource",
        score: 0.5,
        weight: 0.15,
        description: `Access to sensitive resource: ${resourceType}`,
      });
      totalScore += 0.5 * 0.15;
      totalWeight += 0.15;
    }

    for (const threat of this.threatIntelligence.values()) {
      if (!threat.active) continue;
      if (threat.type === "pattern_signature" && query) {
        const pattern = new RegExp(threat.indicator, "i");
        if (pattern.test(query)) {
          const threatScore = { low: 0.4, medium: 0.6, high: 0.8, critical: 1.0 }[threat.severity];
          factors.push({
            name: `threat_${threat.id}`,
            score: threatScore,
            weight: 0.3,
            description: threat.description,
          });
          totalScore += threatScore * 0.3;
          totalWeight += 0.3;
        }
      }
    }

    const adaptiveState = this.adaptiveRateLimits.get(userId || clientIp);
    if (adaptiveState && adaptiveState.threatLevel !== "none") {
      const threatScores = { low: 0.2, medium: 0.4, high: 0.6, critical: 0.8 };
      const score = threatScores[adaptiveState.threatLevel] || 0;
      factors.push({
        name: "elevated_threat_level",
        score,
        weight: 0.2,
        description: `Current threat level: ${adaptiveState.threatLevel}`,
      });
      totalScore += score * 0.2;
      totalWeight += 0.2;
    }

    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const overallRiskScore = Math.min(1, Math.max(0, normalizedScore));

    let riskLevel: RiskAssessment["riskLevel"];
    if (overallRiskScore < 0.2) riskLevel = "minimal";
    else if (overallRiskScore < 0.4) riskLevel = "low";
    else if (overallRiskScore < 0.6) riskLevel = "medium";
    else if (overallRiskScore < 0.8) riskLevel = "high";
    else riskLevel = "critical";

    let accessRecommendation: RiskAssessment["accessRecommendation"];
    if (riskLevel === "minimal" || riskLevel === "low") accessRecommendation = "allow";
    else if (riskLevel === "medium") accessRecommendation = "allow_with_monitoring";
    else if (riskLevel === "high") accessRecommendation = "challenge";
    else accessRecommendation = "deny";

    const recommendations: string[] = [];
    const mitigations: string[] = [];

    if (riskLevel === "medium" || riskLevel === "high") {
      recommendations.push("Enable enhanced logging for this session");
      mitigations.push("Increased audit logging enabled");
    }
    if (riskLevel === "high" || riskLevel === "critical") {
      recommendations.push("Require MFA verification");
      mitigations.push("Rate limits reduced by 50%");
    }
    if (!profile) {
      recommendations.push("Establish behavior baseline for this user");
    }

    let aiAnalysis: string | undefined;
    if (this.openai && (riskLevel === "high" || riskLevel === "critical")) {
      try {
        const prompt = `Analyze this API request risk assessment (data pipeline security analysis, NO clinical decision support):
Risk Score: ${(overallRiskScore * 100).toFixed(1)}%
Risk Level: ${riskLevel}
Operation: ${operation} on ${resourceType}
Factors: ${factors.map(f => `${f.name}: ${(f.score * 100).toFixed(0)}%`).join(", ")}

Provide brief security recommendations (2-3 sentences, data security focus only).`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a healthcare API security analyst. Provide brief, actionable security recommendations. Focus on data protection and access control. NO clinical decision support." },
            { role: "user", content: prompt },
          ],
          max_tokens: 150,
          temperature: 0,
        });
        aiAnalysis = response.choices[0]?.message?.content || undefined;
      } catch (error) {
        console.error("[AIFHIRApiGateway] AI risk analysis error:", error);
      }
    }

    const assessment: RiskAssessment = {
      requestId,
      timestamp: new Date().toISOString(),
      overallRiskScore,
      riskLevel,
      factors,
      recommendations,
      accessRecommendation,
      aiAnalysis,
      mitigations,
    };

    this.logSecurityAudit("RISK_ASSESSMENT_COMPLETED", {
      requestId,
      userId: userId ? hashIdentifier(userId) : undefined,
      clientIp: hashIdentifier(clientIp),
      riskLevel,
      riskScore: overallRiskScore,
      recommendation: accessRecommendation,
      factorCount: factors.length,
    });

    return assessment;
  }

  private logSecurityAudit(action: string, details: Record<string, unknown>): void {
    console.log(`[AIFHIRApiGateway][SecurityAudit] ${action}:`, JSON.stringify(details));
  }

  async detectAnomaliesForRequest(
    userId: string | undefined,
    clientIp: string,
    operation: string,
    resourceType: string
  ): Promise<{ anomalyDetected: boolean; anomalies: AnomalyEvent[]; threatLevel: "none" | "low" | "medium" | "high" | "critical" }> {
    if (!this.anomalyDetectionConfig.enabled) {
      return { anomalyDetected: false, anomalies: [], threatLevel: "none" };
    }

    const identifier = userId || clientIp;
    const now = Date.now();

    let requests = this.recentRequests.get(identifier) || [];
    requests.push({ timestamp: now, resourceType, operation });
    requests = requests.filter(r => now - r.timestamp < 60000);
    if (requests.length > this.MAX_RECENT_REQUESTS) {
      requests = requests.slice(-this.MAX_RECENT_REQUESTS);
    }
    if (requests.length === 0) {
      this.recentRequests.delete(identifier);
    } else {
      this.recentRequests.set(identifier, requests);
    }

    if (this.recentRequests.size > 10000 && Math.random() < 0.01) {
      const cutoff = now - 60000;
      for (const [key, reqs] of this.recentRequests.entries()) {
        const fresh = reqs.filter(r => r.timestamp > cutoff);
        if (fresh.length === 0) {
          this.recentRequests.delete(key);
        } else if (fresh.length !== reqs.length) {
          this.recentRequests.set(key, fresh);
        }
      }
    }

    const detectedAnomalies: AnomalyEvent[] = [];
    let maxThreatLevel: "none" | "low" | "medium" | "high" | "critical" = "none";

    const profile = userId ? this.userBehaviorProfiles.get(userId) : undefined;
    const expectedRpm = profile?.requestPatterns.averageRequestsPerMinute || 10;
    const currentRpm = requests.length;

    if (currentRpm > expectedRpm * this.anomalyDetectionConfig.detectionThresholds.requestVelocityMultiplier) {
      const severity = currentRpm > expectedRpm * 5 ? "critical" : currentRpm > expectedRpm * 4 ? "high" : "medium";
      const anomaly = this.recordAnomalyEvent({
        userId,
        clientIp,
        anomalyType: "velocity",
        severity,
        confidence: Math.min(0.95, 0.7 + (currentRpm / expectedRpm) * 0.05),
        description: `Request velocity ${currentRpm}/min exceeds expected ${expectedRpm}/min`,
        indicators: [`Current: ${currentRpm} req/min`, `Expected: ${expectedRpm} req/min`, `Ratio: ${(currentRpm / expectedRpm).toFixed(2)}x`],
        baselineValue: expectedRpm,
        observedValue: currentRpm,
      });
      detectedAnomalies.push(anomaly);
      if (this.compareThreatLevels(severity, maxThreatLevel) > 0) maxThreatLevel = severity;
    }

    if (profile && !profile.requestPatterns.commonResourceTypes.includes(resourceType)) {
      const resourceTypeCount = requests.filter(r => r.resourceType === resourceType).length;
      if (resourceTypeCount >= 3) {
        const anomaly = this.recordAnomalyEvent({
          userId,
          clientIp,
          anomalyType: "resource_access",
          severity: "medium",
          confidence: 0.75,
          description: `Unusual resource type access pattern: ${resourceType}`,
          indicators: [`Resource: ${resourceType}`, `Access count: ${resourceTypeCount}`, "Not in user's typical access pattern"],
        });
        detectedAnomalies.push(anomaly);
        if (this.compareThreatLevels("medium", maxThreatLevel) > 0) maxThreatLevel = "medium";
      }
    }

    const uniqueResources = new Set(requests.map(r => r.resourceType)).size;
    if (requests.length >= 10 && uniqueResources >= 5) {
      const anomaly = this.recordAnomalyEvent({
        userId,
        clientIp,
        anomalyType: "enumeration_attack",
        severity: "high",
        confidence: 0.8,
        description: "Potential resource enumeration attack detected",
        indicators: [`${requests.length} requests in 1 minute`, `${uniqueResources} different resource types`, "Rapid multi-resource access pattern"],
      });
      detectedAnomalies.push(anomaly);
      if (this.compareThreatLevels("high", maxThreatLevel) > 0) maxThreatLevel = "high";
    }

    return {
      anomalyDetected: detectedAnomalies.length > 0,
      anomalies: detectedAnomalies,
      threatLevel: maxThreatLevel,
    };
  }

  private compareThreatLevels(a: string, b: string): number {
    const levels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return (levels[a as keyof typeof levels] || 0) - (levels[b as keyof typeof levels] || 0);
  }

  getAnomalyDetectionConfig(): AnomalyDetectionConfig {
    return { ...this.anomalyDetectionConfig };
  }

  updateAnomalyDetectionConfig(updates: Partial<AnomalyDetectionConfig>): AnomalyDetectionConfig {
    this.anomalyDetectionConfig = { ...this.anomalyDetectionConfig, ...updates };
    this.logSecurityAudit("ANOMALY_DETECTION_CONFIG_UPDATED", { 
      enabled: this.anomalyDetectionConfig.enabled,
      sensitivityLevel: this.anomalyDetectionConfig.sensitivityLevel,
    });
    return { ...this.anomalyDetectionConfig };
  }

  listAnomalyEvents(filters?: { severity?: string; resolved?: boolean; anomalyType?: string; limit?: number }): AnomalyEvent[] {
    let events = [...this.anomalyEvents];
    if (filters?.severity) events = events.filter(e => e.severity === filters.severity);
    if (filters?.resolved !== undefined) events = events.filter(e => e.resolved === filters.resolved);
    if (filters?.anomalyType) events = events.filter(e => e.anomalyType === filters.anomalyType);
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (filters?.limit) events = events.slice(0, filters.limit);
    return events;
  }

  resolveAnomalyEvent(id: string): AnomalyEvent | null {
    const event = this.anomalyEvents.find(e => e.id === id);
    if (!event) return null;
    event.resolved = true;
    this.logSecurityAudit("ANOMALY_RESOLVED", { anomalyId: id, type: event.anomalyType });
    return event;
  }

  getUserBehaviorProfile(userId: string): UserBehaviorProfile | null {
    return this.userBehaviorProfiles.get(userId) || null;
  }

  listUserBehaviorProfiles(): UserBehaviorProfile[] {
    return Array.from(this.userBehaviorProfiles.values());
  }

  updateUserBehaviorProfile(userId: string, updates: Partial<UserBehaviorProfile>): UserBehaviorProfile {
    const existing = this.userBehaviorProfiles.get(userId) || {
      userId,
      lastUpdated: new Date().toISOString(),
      requestPatterns: { averageRequestsPerMinute: 0, averageRequestsPerHour: 0, peakHours: [], commonResourceTypes: [], commonOperations: [], typicalResponseTimes: [] },
      accessPatterns: { commonIpRanges: [], commonUserAgents: [], geoLocations: [], sessionDurations: [] },
      riskFactors: { failedAuthAttempts: 0, deniedAccessAttempts: 0, rateLimitViolations: 0, anomalyCount: 0 },
      trustScore: 0.5,
    };
    const updated: UserBehaviorProfile = { ...existing, ...updates, userId, lastUpdated: new Date().toISOString() };
    this.userBehaviorProfiles.set(userId, updated);
    return updated;
  }

  getAdaptiveRateLimitState(identifier: string): AdaptiveRateLimitState | null {
    return this.adaptiveRateLimits.get(identifier) || null;
  }

  listAdaptiveRateLimitStates(): AdaptiveRateLimitState[] {
    return Array.from(this.adaptiveRateLimits.values());
  }

  resetAdaptiveRateLimit(identifier: string): boolean {
    const state = this.adaptiveRateLimits.get(identifier);
    if (!state) return false;
    state.adjustmentFactor = 1.0;
    state.threatLevel = "none";
    state.currentLimits = { ...state.baseLimits };
    state.adjustmentHistory.push({
      timestamp: new Date().toISOString(),
      previousFactor: state.adjustmentFactor,
      newFactor: 1.0,
      reason: "Manual reset",
    });
    state.lastAdjustment = new Date().toISOString();
    this.adaptiveRateLimits.set(identifier, state);
    this.logSecurityAudit("ADAPTIVE_RATE_LIMIT_RESET", { identifier: hashIdentifier(identifier) });
    return true;
  }

  listThreatIntelligence(): ThreatIntelligence[] {
    return Array.from(this.threatIntelligence.values());
  }

  addThreatIntelligence(threat: Omit<ThreatIntelligence, "id">): ThreatIntelligence {
    const newThreat: ThreatIntelligence = {
      ...threat,
      id: `threat-${randomUUID().substring(0, 8)}`,
    };
    this.threatIntelligence.set(newThreat.id, newThreat);
    this.logSecurityAudit("THREAT_INTELLIGENCE_ADDED", { threatId: newThreat.id, type: newThreat.type, severity: newThreat.severity });
    return newThreat;
  }

  updateThreatIntelligence(id: string, updates: Partial<ThreatIntelligence>): ThreatIntelligence | null {
    const threat = this.threatIntelligence.get(id);
    if (!threat) return null;
    const updated: ThreatIntelligence = { ...threat, ...updates, id };
    this.threatIntelligence.set(id, updated);
    return updated;
  }

  deleteThreatIntelligence(id: string): boolean {
    return this.threatIntelligence.delete(id);
  }

  getSecurityDashboard(): {
    anomalyStats: { total: number; byType: Record<string, number>; bySeverity: Record<string, number>; unresolved: number };
    adaptiveRateLimiting: { activeAdjustments: number; byThreatLevel: Record<string, number> };
    threatIntelligence: { total: number; active: number; bySeverity: Record<string, number> };
    recentHighRiskRequests: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let unresolved = 0;

    for (const event of this.anomalyEvents) {
      byType[event.anomalyType] = (byType[event.anomalyType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      if (!event.resolved) unresolved++;
    }

    const byThreatLevel: Record<string, number> = {};
    let activeAdjustments = 0;
    for (const state of this.adaptiveRateLimits.values()) {
      byThreatLevel[state.threatLevel] = (byThreatLevel[state.threatLevel] || 0) + 1;
      if (state.threatLevel !== "none") activeAdjustments++;
    }

    const threatBySeverity: Record<string, number> = {};
    let activeThreats = 0;
    for (const threat of this.threatIntelligence.values()) {
      threatBySeverity[threat.severity] = (threatBySeverity[threat.severity] || 0) + 1;
      if (threat.active) activeThreats++;
    }

    const recentHighRisk = this.auditLog.filter(e => 
      e.accessDecision.riskScore > 0.6 && 
      Date.now() - new Date(e.timestamp).getTime() < 3600000
    ).length;

    return {
      anomalyStats: { total: this.anomalyEvents.length, byType, bySeverity, unresolved },
      adaptiveRateLimiting: { activeAdjustments, byThreatLevel },
      threatIntelligence: { total: this.threatIntelligence.size, active: activeThreats, bySeverity: threatBySeverity },
      recentHighRiskRequests: recentHighRisk,
    };
  }

  async handleFHIROperation(
    operation: "read" | "search" | "create" | "update" | "delete" | "$search" | "$validate" | "$everything",
    resourceType: string,
    options: {
      userId?: string;
      userRole?: string;
      clientIp: string;
      query?: string;
      resourceId?: string;
      resource?: Record<string, unknown>;
      hasMfa?: boolean;
      userAgent?: string;
    }
  ): Promise<{
    success: boolean;
    server?: FHIRServer;
    accessDecision: AccessDecision;
    rateLimitResult: RateLimitResult;
    cacheStatus: "hit" | "miss" | "bypass";
    response?: unknown;
    error?: string;
    auditEntry: GatewayAuditEntry;
    riskAssessment?: RiskAssessment;
    anomalyDetection?: { anomalyDetected: boolean; threatLevel: string };
  }> {
    const startTime = Date.now();
    const requestId = randomUUID();
    const baseOp = operation.startsWith("$") ? "search" : operation;

    const anomalyResult = await this.detectAnomaliesForRequest(
      options.userId,
      options.clientIp,
      baseOp,
      resourceType
    );

    const riskAssessment = await this.assessRequestRisk(
      options.userId,
      options.clientIp,
      baseOp,
      resourceType,
      options.query,
      options.userAgent
    );

    if (riskAssessment.accessRecommendation === "deny") {
      this.logHipaaSecurityAudit("ACCESS_DENIED_HIGH_RISK", {
        requestId,
        userId: options.userId ? hashIdentifier(options.userId) : undefined,
        clientIp: hashIdentifier(options.clientIp),
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.overallRiskScore,
      });
    }

    const accessDecision = await this.evaluateAccess(
      options.userRole || "anonymous",
      resourceType,
      baseOp as "read" | "search" | "create" | "update" | "delete",
      { userId: options.userId, clientIp: options.clientIp, hasMfa: options.hasMfa }
    );

    if (riskAssessment.accessRecommendation === "deny" && accessDecision.allowed) {
      accessDecision.allowed = false;
      accessDecision.reason = `Access denied due to high risk score (${(riskAssessment.overallRiskScore * 100).toFixed(0)}%)`;
      accessDecision.riskScore = riskAssessment.overallRiskScore;
    } else if (riskAssessment.overallRiskScore > accessDecision.riskScore) {
      accessDecision.riskScore = riskAssessment.overallRiskScore;
    }

    const adaptiveState = this.adaptiveRateLimits.get(options.userId || options.clientIp);
    let effectiveRateLimitResult: RateLimitResult;
    
    if (adaptiveState && adaptiveState.threatLevel !== "none") {
      const state = this.rateLimitStates.get(options.userId || options.clientIp);
      const remaining = adaptiveState.currentLimits.requestsPerMinute - (state?.minuteCount || 0);
      effectiveRateLimitResult = {
        allowed: remaining > 0 && !(state?.blocked),
        remaining: { minute: Math.max(0, remaining), hour: adaptiveState.currentLimits.requestsPerHour, day: 0 },
        resetAt: { minute: state?.minuteResetAt || 0, hour: state?.hourResetAt || 0, day: state?.dayResetAt || 0 },
        blocked: state?.blocked || false,
        blockedUntil: state?.blockedUntil,
        reason: remaining <= 0 ? `Adaptive rate limit exceeded (threat level: ${adaptiveState.threatLevel})` : undefined,
      };
    } else {
      effectiveRateLimitResult = this.checkRateLimit(
        options.userId || options.clientIp,
        options.userId ? "user" : "ip",
        resourceType,
        baseOp
      );
    }

    let cacheStatus: "hit" | "miss" | "bypass" = "bypass";
    let cachedResponse: unknown = undefined;

    if (accessDecision.allowed && effectiveRateLimitResult.allowed) {
      if (baseOp === "read" || baseOp === "search") {
        const cacheKey = this.getCacheKey(resourceType, baseOp, options.query, options.userId);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          cacheStatus = "hit";
          cachedResponse = cached.response;
        } else {
          cacheStatus = "miss";
        }
      }
    }

    let server: FHIRServer | undefined;
    let error: string | undefined;

    if (accessDecision.allowed && effectiveRateLimitResult.allowed) {
      try {
        const routing = await this.routeRequest(resourceType, baseOp as "read" | "search" | "create" | "update" | "delete", {
          patientId: options.resourceId,
          sourceIp: options.clientIp,
        });
        server = routing.server;
      } catch (e) {
        error = e instanceof Error ? e.message : "Routing failed";
      }
    } else if (!accessDecision.allowed) {
      error = accessDecision.reason;
    } else {
      error = effectiveRateLimitResult.reason || "Rate limit exceeded";
    }

    const responseTimeMs = Date.now() - startTime;
    const sensitivityInfo = this.SENSITIVE_ELEMENTS[resourceType];

    const auditEntry = this.logAuditEntry({
      requestId,
      userId: options.userId,
      userRole: options.userRole,
      clientIp: options.clientIp,
      operation,
      resourceType,
      resourceId: options.resourceId,
      queryParameters: options.query ? { query: options.query } : undefined,
      targetServer: server?.id || "none",
      accessDecision: {
        allowed: accessDecision.allowed,
        policyId: accessDecision.policyId,
        reason: accessDecision.reason,
        riskScore: riskAssessment.overallRiskScore,
      },
      rateLimitStatus: { allowed: effectiveRateLimitResult.allowed, remaining: effectiveRateLimitResult.remaining.minute },
      cacheStatus,
      responseStatus: accessDecision.allowed && effectiveRateLimitResult.allowed ? 200 : accessDecision.allowed ? 429 : 403,
      responseTimeMs,
      phiAccessed: sensitivityInfo?.level === "high" || sensitivityInfo?.level === "restricted",
      sensitivityLevel: sensitivityInfo?.level || "low",
      maskedElements: accessDecision.maskedElements,
      errorMessage: error,
      anomalyDetected: anomalyResult.anomalyDetected,
      threatLevel: anomalyResult.threatLevel,
      riskFactors: riskAssessment.factors.map(f => f.name),
    });

    return {
      success: accessDecision.allowed && effectiveRateLimitResult.allowed && !error,
      server,
      accessDecision,
      rateLimitResult: effectiveRateLimitResult,
      cacheStatus,
      response: cachedResponse,
      error,
      auditEntry,
      riskAssessment,
      anomalyDetection: { anomalyDetected: anomalyResult.anomalyDetected, threatLevel: anomalyResult.threatLevel },
    };
  }

  private logHipaaSecurityAudit(action: string, details: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      category: "SECURITY",
      details,
      complianceNote: "HIPAA Security Rule - Access Control Audit (data security only, no CDS)",
    };
    console.log(`[AIFHIRApiGateway][HIPAA-Audit] ${JSON.stringify(entry)}`);
  }
}

export const aiFhirApiGateway = new AIFHIRApiGateway();
