import { Router } from "express";
import { z } from "zod";
import { aiFhirApiGateway } from "./services/ai-fhir-api-gateway";

const AnomalyDetectionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  sensitivityLevel: z.enum(["low", "medium", "high"]).optional(),
  baselineWindowHours: z.number().min(1).max(168).optional(),
  detectionThresholds: z.object({
    requestVelocityMultiplier: z.number().min(1.5).max(10).optional(),
    unusualResourceAccessScore: z.number().min(0).max(1).optional(),
    geoAnomalyScore: z.number().min(0).max(1).optional(),
    timeAnomalyScore: z.number().min(0).max(1).optional(),
    patternDeviationScore: z.number().min(0).max(1).optional(),
  }).optional(),
  autoBlockOnCritical: z.boolean().optional(),
  alertOnHigh: z.boolean().optional(),
  learningMode: z.boolean().optional(),
}).strict();

const ThreatIntelligenceSchema = z.object({
  type: z.enum(["ip_blocklist", "pattern_signature", "attack_vector", "vulnerability"]),
  indicator: z.string().min(1).max(1000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1).max(500),
  source: z.string().min(1).max(100),
  expiresAt: z.string().optional(),
  active: z.boolean().optional(),
});

const RiskAssessmentRequestSchema = z.object({
  userId: z.string().optional(),
  clientIp: z.string().min(1),
  operation: z.string().min(1),
  resourceType: z.string().min(1),
  query: z.string().optional(),
  userAgent: z.string().optional(),
});

const AnomalyDetectionRequestSchema = z.object({
  userId: z.string().optional(),
  clientIp: z.string().min(1),
  operation: z.string().min(1),
  resourceType: z.string().min(1),
});

const BehaviorProfileUpdateSchema = z.object({
  requestPatterns: z.object({
    averageRequestsPerMinute: z.number().min(0).optional(),
    averageRequestsPerHour: z.number().min(0).optional(),
    peakHours: z.array(z.number().min(0).max(23)).optional(),
    commonResourceTypes: z.array(z.string()).optional(),
    commonOperations: z.array(z.string()).optional(),
    typicalResponseTimes: z.array(z.number()).optional(),
  }).optional(),
  accessPatterns: z.object({
    commonIpRanges: z.array(z.string()).optional(),
    commonUserAgents: z.array(z.string()).optional(),
    geoLocations: z.array(z.string()).optional(),
    sessionDurations: z.array(z.number()).optional(),
  }).optional(),
  riskFactors: z.object({
    failedAuthAttempts: z.number().min(0).optional(),
    deniedAccessAttempts: z.number().min(0).optional(),
    rateLimitViolations: z.number().min(0).optional(),
    anomalyCount: z.number().min(0).optional(),
  }).optional(),
  trustScore: z.number().min(0).max(1).optional(),
}).strict();

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    category: "GATEWAY_SECURITY",
    details,
    complianceNote: "HIPAA Security Rule - API Gateway Audit (data security only, no CDS)",
  };
  console.log(`[FHIRGateway][HIPAA-Audit] ${JSON.stringify(entry)}`);
}

function hashIdentifier(id: string): string {
  return require("crypto").createHash("sha256").update(id).digest("hex").substring(0, 16);
}

export function registerAIFHIRApiGatewayRoutes(router: Router): void {
  router.get("/api/fhir-gateway/servers", async (req, res) => {
    try {
      const { type, enabled, healthStatus } = req.query;
      
      const servers = aiFhirApiGateway.listServers({
        type: type as string | undefined,
        enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
        healthStatus: healthStatus as string | undefined,
      });

      res.json({
        success: true,
        servers,
      });
    } catch (error) {
      console.error("[FHIRGateway] List servers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list FHIR servers",
      });
    }
  });

  router.get("/api/fhir-gateway/servers/:serverId", async (req, res) => {
    try {
      const { serverId } = req.params;
      const server = aiFhirApiGateway.getServer(serverId);

      if (!server) {
        return res.status(404).json({
          success: false,
          error: "Server not found",
        });
      }

      res.json({
        success: true,
        server,
      });
    } catch (error) {
      console.error("[FHIRGateway] Get server error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get FHIR server",
      });
    }
  });

  router.post("/api/fhir-gateway/servers", async (req, res) => {
    try {
      const { name, baseUrl, type, enabled, capabilities, supportedResources, authType, priority } = req.body;

      if (!name || !baseUrl || !type) {
        return res.status(400).json({
          success: false,
          error: "name, baseUrl, and type are required",
        });
      }

      const server = await aiFhirApiGateway.addServer({
        name,
        baseUrl,
        type,
        enabled: enabled ?? true,
        capabilities: capabilities || ["read", "search"],
        supportedResources: supportedResources || [],
        authType: authType || "bearer",
        priority: priority || 10,
      });

      res.status(201).json({
        success: true,
        server,
      });
    } catch (error) {
      console.error("[FHIRGateway] Add server error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add FHIR server",
      });
    }
  });

  router.patch("/api/fhir-gateway/servers/:serverId", async (req, res) => {
    try {
      const { serverId } = req.params;
      const server = await aiFhirApiGateway.updateServer(serverId, req.body);

      if (!server) {
        return res.status(404).json({
          success: false,
          error: "Server not found",
        });
      }

      res.json({
        success: true,
        server,
      });
    } catch (error) {
      console.error("[FHIRGateway] Update server error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update FHIR server",
      });
    }
  });

  router.delete("/api/fhir-gateway/servers/:serverId", async (req, res) => {
    try {
      const { serverId } = req.params;
      const deleted = await aiFhirApiGateway.deleteServer(serverId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Server not found",
        });
      }

      res.json({
        success: true,
        message: "Server deleted",
      });
    } catch (error) {
      console.error("[FHIRGateway] Delete server error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete FHIR server",
      });
    }
  });

  router.get("/api/fhir-gateway/routing-rules", async (req, res) => {
    try {
      const rules = aiFhirApiGateway.listRoutingRules();

      res.json({
        success: true,
        rules,
      });
    } catch (error) {
      console.error("[FHIRGateway] List routing rules error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list routing rules",
      });
    }
  });

  router.post("/api/fhir-gateway/routing-rules", async (req, res) => {
    try {
      const { name, enabled, priority, conditions, targetServerId, fallbackServerId, loadBalancing } = req.body;

      if (!name || !targetServerId) {
        return res.status(400).json({
          success: false,
          error: "name and targetServerId are required",
        });
      }

      const rule = await aiFhirApiGateway.addRoutingRule({
        name,
        enabled: enabled ?? true,
        priority: priority || 10,
        conditions: conditions || {},
        targetServerId,
        fallbackServerId,
        loadBalancing,
      });

      res.status(201).json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[FHIRGateway] Add routing rule error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add routing rule",
      });
    }
  });

  router.patch("/api/fhir-gateway/routing-rules/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      const rule = await aiFhirApiGateway.updateRoutingRule(ruleId, req.body);

      if (!rule) {
        return res.status(404).json({
          success: false,
          error: "Routing rule not found",
        });
      }

      res.json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[FHIRGateway] Update routing rule error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update routing rule",
      });
    }
  });

  router.delete("/api/fhir-gateway/routing-rules/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      const deleted = await aiFhirApiGateway.deleteRoutingRule(ruleId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Routing rule not found",
        });
      }

      res.json({
        success: true,
        message: "Routing rule deleted",
      });
    } catch (error) {
      console.error("[FHIRGateway] Delete routing rule error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete routing rule",
      });
    }
  });

  router.post("/api/fhir-gateway/route", async (req, res) => {
    try {
      const { resourceType, operation, patientId, sourceIp, headers } = req.body as {
        resourceType: string;
        operation: "read" | "search" | "create" | "update" | "delete";
        patientId?: string;
        sourceIp?: string;
        headers?: Record<string, string>;
      };

      if (!resourceType || !operation) {
        return res.status(400).json({
          success: false,
          error: "resourceType and operation are required",
        });
      }

      const result = await aiFhirApiGateway.routeRequest(resourceType, operation, {
        patientId,
        sourceIp,
        headers,
      });

      res.json({
        success: true,
        routing: {
          server: {
            id: result.server.id,
            name: result.server.name,
            baseUrl: result.server.baseUrl,
            type: result.server.type,
            healthStatus: result.server.healthStatus,
          },
          rule: result.rule ? {
            id: result.rule.id,
            name: result.rule.name,
          } : null,
        },
      });
    } catch (error) {
      console.error("[FHIRGateway] Route request error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to route request",
      });
    }
  });

  router.post("/api/fhir-gateway/validate", async (req, res) => {
    try {
      const { resource } = req.body;

      if (!resource) {
        return res.status(400).json({
          success: false,
          error: "resource is required",
        });
      }

      const result = aiFhirApiGateway.validateFHIRResource(resource);

      res.json({
        success: true,
        validation: result,
      });
    } catch (error) {
      console.error("[FHIRGateway] Validate resource error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate FHIR resource",
      });
    }
  });

  router.post("/api/fhir-gateway/record-metric", async (req, res) => {
    try {
      const { serverId, endpoint, method, resourceType, responseTimeMs, statusCode, success, payloadSizeBytes, queryParameters } = req.body;

      if (!serverId || !endpoint || !method || responseTimeMs === undefined || statusCode === undefined) {
        return res.status(400).json({
          success: false,
          error: "serverId, endpoint, method, responseTimeMs, and statusCode are required",
        });
      }

      aiFhirApiGateway.recordPerformanceMetric({
        serverId,
        endpoint,
        method,
        resourceType,
        responseTimeMs,
        statusCode,
        success: success ?? (statusCode >= 200 && statusCode < 300),
        payloadSizeBytes,
        queryParameters,
      });

      res.json({
        success: true,
        message: "Performance metric recorded",
      });
    } catch (error) {
      console.error("[FHIRGateway] Record metric error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record performance metric",
      });
    }
  });

  router.get("/api/fhir-gateway/performance", async (req, res) => {
    try {
      const { serverId, resourceType, timeRangeMinutes } = req.query;

      const stats = aiFhirApiGateway.getPerformanceStats({
        serverId: serverId as string | undefined,
        resourceType: resourceType as string | undefined,
        timeRangeMinutes: timeRangeMinutes ? parseInt(timeRangeMinutes as string) : undefined,
      });

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("[FHIRGateway] Get performance stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get performance stats",
      });
    }
  });

  router.post("/api/fhir-gateway/optimize-query", async (req, res) => {
    try {
      const { query, resourceType, averageResponseTimeMs, resultCount } = req.body as {
        query: string;
        resourceType: string;
        averageResponseTimeMs?: number;
        resultCount?: number;
      };

      if (!query || !resourceType) {
        return res.status(400).json({
          success: false,
          error: "query and resourceType are required",
        });
      }

      const suggestions = await aiFhirApiGateway.generateQueryOptimizationSuggestions(
        query,
        resourceType,
        averageResponseTimeMs !== undefined ? { averageResponseTimeMs, resultCount } : undefined
      );

      res.json({
        success: true,
        optimization: suggestions,
      });
    } catch (error) {
      console.error("[FHIRGateway] Query optimization error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate query optimization suggestions",
      });
    }
  });

  router.post("/api/fhir-gateway/simulate", async (req, res) => {
    try {
      const { resourceType, operation, resource } = req.body as {
        resourceType: string;
        operation: "read" | "search" | "create" | "update" | "delete";
        resource?: Record<string, unknown>;
      };

      if (!resourceType || !operation) {
        return res.status(400).json({
          success: false,
          error: "resourceType and operation are required",
        });
      }

      const result = await aiFhirApiGateway.simulateRequest(resourceType, operation, resource);

      res.json({
        success: true,
        simulation: {
          routing: {
            server: {
              id: result.routing.server.id,
              name: result.routing.server.name,
              baseUrl: result.routing.server.baseUrl,
              type: result.routing.server.type,
            },
            rule: result.routing.rule ? {
              id: result.routing.rule.id,
              name: result.routing.rule.name,
            } : null,
          },
          validation: result.validation,
          estimatedLatencyMs: result.estimatedLatencyMs,
        },
      });
    } catch (error) {
      console.error("[FHIRGateway] Simulate request error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to simulate request",
      });
    }
  });

  router.post("/api/fhir-gateway/release-connection", async (req, res) => {
    try {
      const { serverId } = req.body as { serverId: string };

      if (!serverId) {
        return res.status(400).json({
          success: false,
          error: "serverId is required",
        });
      }

      aiFhirApiGateway.releaseConnection(serverId);

      res.json({
        success: true,
        message: `Connection released for server ${serverId}`,
      });
    } catch (error) {
      console.error("[FHIRGateway] Release connection error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to release connection",
      });
    }
  });

  router.get("/api/fhir-gateway/access-policies", async (req, res) => {
    try {
      const policies = aiFhirApiGateway.listAccessPolicies();
      res.json({ success: true, policies });
    } catch (error) {
      console.error("[FHIRGateway] List access policies error:", error);
      res.status(500).json({ success: false, error: "Failed to list access policies" });
    }
  });

  router.get("/api/fhir-gateway/access-policies/:policyId", async (req, res) => {
    try {
      const policy = aiFhirApiGateway.getAccessPolicy(req.params.policyId);
      if (!policy) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }
      res.json({ success: true, policy });
    } catch (error) {
      console.error("[FHIRGateway] Get access policy error:", error);
      res.status(500).json({ success: false, error: "Failed to get access policy" });
    }
  });

  router.post("/api/fhir-gateway/access-policies", async (req, res) => {
    try {
      const { name, description, enabled, priority, roles, resourceTypes, operations, elementAccess, sensitivityLevels, conditions } = req.body;
      if (!name || !roles || !resourceTypes || !operations) {
        return res.status(400).json({ success: false, error: "name, roles, resourceTypes, and operations are required" });
      }
      const policy = aiFhirApiGateway.addAccessPolicy({
        name,
        description: description || "",
        enabled: enabled ?? true,
        priority: priority || 10,
        roles,
        resourceTypes,
        operations,
        elementAccess: elementAccess || { allowed: ["*"], denied: [], masked: [] },
        sensitivityLevels: sensitivityLevels || ["low", "medium"],
        conditions,
      });
      res.status(201).json({ success: true, policy });
    } catch (error) {
      console.error("[FHIRGateway] Add access policy error:", error);
      res.status(500).json({ success: false, error: "Failed to add access policy" });
    }
  });

  router.patch("/api/fhir-gateway/access-policies/:policyId", async (req, res) => {
    try {
      const policy = aiFhirApiGateway.updateAccessPolicy(req.params.policyId, req.body);
      if (!policy) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }
      res.json({ success: true, policy });
    } catch (error) {
      console.error("[FHIRGateway] Update access policy error:", error);
      res.status(500).json({ success: false, error: "Failed to update access policy" });
    }
  });

  router.delete("/api/fhir-gateway/access-policies/:policyId", async (req, res) => {
    try {
      const deleted = aiFhirApiGateway.deleteAccessPolicy(req.params.policyId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }
      res.json({ success: true, message: "Policy deleted" });
    } catch (error) {
      console.error("[FHIRGateway] Delete access policy error:", error);
      res.status(500).json({ success: false, error: "Failed to delete access policy" });
    }
  });

  router.post("/api/fhir-gateway/evaluate-access", async (req, res) => {
    try {
      const { userRole, resourceType, operation, userId, clientIp, hasMfa } = req.body;
      if (!userRole || !resourceType || !operation) {
        return res.status(400).json({ success: false, error: "userRole, resourceType, and operation are required" });
      }
      const decision = await aiFhirApiGateway.evaluateAccess(userRole, resourceType, operation, { userId, clientIp, hasMfa });
      res.json({ success: true, decision });
    } catch (error) {
      console.error("[FHIRGateway] Evaluate access error:", error);
      res.status(500).json({ success: false, error: "Failed to evaluate access" });
    }
  });

  router.post("/api/fhir-gateway/evaluate-access-ai", async (req, res) => {
    try {
      const { userRole, resourceType, operation, userId, previousRequests, timeOfDay } = req.body;
      if (!userRole || !resourceType || !operation) {
        return res.status(400).json({ success: false, error: "userRole, resourceType, and operation are required" });
      }
      const result = await aiFhirApiGateway.evaluateAccessWithAI(userRole, resourceType, operation, { userId, previousRequests, timeOfDay });
      res.json({ success: true, analysis: result });
    } catch (error) {
      console.error("[FHIRGateway] AI access evaluation error:", error);
      res.status(500).json({ success: false, error: "Failed to evaluate access with AI" });
    }
  });

  router.get("/api/fhir-gateway/cache/stats", async (req, res) => {
    try {
      const stats = aiFhirApiGateway.getCacheStats();
      res.json({ success: true, stats });
    } catch (error) {
      console.error("[FHIRGateway] Cache stats error:", error);
      res.status(500).json({ success: false, error: "Failed to get cache stats" });
    }
  });

  router.get("/api/fhir-gateway/cache/config", async (req, res) => {
    try {
      const config = aiFhirApiGateway.getCacheConfig();
      res.json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Cache config error:", error);
      res.status(500).json({ success: false, error: "Failed to get cache config" });
    }
  });

  router.patch("/api/fhir-gateway/cache/config", async (req, res) => {
    try {
      const config = aiFhirApiGateway.updateCacheConfig(req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Update cache config error:", error);
      res.status(500).json({ success: false, error: "Failed to update cache config" });
    }
  });

  router.post("/api/fhir-gateway/cache/invalidate", async (req, res) => {
    try {
      const { resourceType, userId } = req.body;
      const invalidated = aiFhirApiGateway.invalidateCache(resourceType, userId);
      res.json({ success: true, invalidated });
    } catch (error) {
      console.error("[FHIRGateway] Cache invalidate error:", error);
      res.status(500).json({ success: false, error: "Failed to invalidate cache" });
    }
  });

  router.get("/api/fhir-gateway/rate-limits", async (req, res) => {
    try {
      const configs = aiFhirApiGateway.getRateLimitConfigs();
      res.json({ success: true, configs });
    } catch (error) {
      console.error("[FHIRGateway] List rate limits error:", error);
      res.status(500).json({ success: false, error: "Failed to list rate limit configs" });
    }
  });

  router.post("/api/fhir-gateway/rate-limits", async (req, res) => {
    try {
      const { name, enabled, scope, identifier, limits, resourceTypeOverrides, operationOverrides, penaltyConfig } = req.body;
      if (!name || !scope || !limits) {
        return res.status(400).json({ success: false, error: "name, scope, and limits are required" });
      }
      const config = aiFhirApiGateway.addRateLimitConfig({
        name,
        enabled: enabled ?? true,
        scope,
        identifier,
        limits,
        resourceTypeOverrides,
        operationOverrides,
        penaltyConfig: penaltyConfig || { blockDurationMs: 60000, warningThreshold: 0.9 },
      });
      res.status(201).json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Add rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to add rate limit config" });
    }
  });

  router.patch("/api/fhir-gateway/rate-limits/:configId", async (req, res) => {
    try {
      const config = aiFhirApiGateway.updateRateLimitConfig(req.params.configId, req.body);
      if (!config) {
        return res.status(404).json({ success: false, error: "Rate limit config not found" });
      }
      res.json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Update rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to update rate limit config" });
    }
  });

  router.delete("/api/fhir-gateway/rate-limits/:configId", async (req, res) => {
    try {
      const deleted = aiFhirApiGateway.deleteRateLimitConfig(req.params.configId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Rate limit config not found" });
      }
      res.json({ success: true, message: "Rate limit config deleted" });
    } catch (error) {
      console.error("[FHIRGateway] Delete rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to delete rate limit config" });
    }
  });

  router.post("/api/fhir-gateway/check-rate-limit", async (req, res) => {
    try {
      const { identifier, scope, resourceType, operation } = req.body;
      if (!identifier || !scope) {
        return res.status(400).json({ success: false, error: "identifier and scope are required" });
      }
      const result = aiFhirApiGateway.checkRateLimit(identifier, scope, resourceType, operation);
      res.json({ success: true, result });
    } catch (error) {
      console.error("[FHIRGateway] Check rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to check rate limit" });
    }
  });

  router.get("/api/fhir-gateway/audit-log", async (req, res) => {
    try {
      const { userId, resourceType, operation, startDate, endDate, accessAllowed, limit } = req.query;
      const entries = aiFhirApiGateway.getAuditLog({
        userId: userId as string | undefined,
        resourceType: resourceType as string | undefined,
        operation: operation as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        accessAllowed: accessAllowed === "true" ? true : accessAllowed === "false" ? false : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({ success: true, entries });
    } catch (error) {
      console.error("[FHIRGateway] Get audit log error:", error);
      res.status(500).json({ success: false, error: "Failed to get audit log" });
    }
  });

  router.get("/api/fhir-gateway/audit-log/stats", async (req, res) => {
    try {
      const stats = aiFhirApiGateway.getAuditStats();
      res.json({ success: true, stats });
    } catch (error) {
      console.error("[FHIRGateway] Get audit stats error:", error);
      res.status(500).json({ success: false, error: "Failed to get audit stats" });
    }
  });

  router.post("/api/fhir-gateway/operation", async (req, res) => {
    try {
      const { operation, resourceType, userId, userRole, query, resourceId, resource, hasMfa } = req.body;
      if (!operation || !resourceType) {
        return res.status(400).json({ success: false, error: "operation and resourceType are required" });
      }
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const result = await aiFhirApiGateway.handleFHIROperation(operation, resourceType, {
        userId,
        userRole,
        clientIp,
        query,
        resourceId,
        resource,
        hasMfa,
      });
      res.status(result.success ? 200 : result.auditEntry.responseStatus).json({ success: result.success, ...result });
    } catch (error) {
      console.error("[FHIRGateway] Handle operation error:", error);
      res.status(500).json({ success: false, error: "Failed to handle FHIR operation" });
    }
  });

  router.get("/api/fhir-gateway/security/anomaly-detection/config", async (req, res) => {
    try {
      const config = aiFhirApiGateway.getAnomalyDetectionConfig();
      res.json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Get anomaly detection config error:", error);
      res.status(500).json({ success: false, error: "Failed to get anomaly detection config" });
    }
  });

  router.patch("/api/fhir-gateway/security/anomaly-detection/config", async (req, res) => {
    try {
      const parseResult = AnomalyDetectionConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        logHipaaAudit("ANOMALY_CONFIG_VALIDATION_FAILED", { errors: parseResult.error.issues.map(e => e.message) });
        return res.status(400).json({ success: false, error: "Invalid configuration", details: parseResult.error.issues });
      }
      const config = aiFhirApiGateway.updateAnomalyDetectionConfig(parseResult.data);
      logHipaaAudit("ANOMALY_DETECTION_CONFIG_UPDATED", { enabled: config.enabled, sensitivityLevel: config.sensitivityLevel });
      res.json({ success: true, config });
    } catch (error) {
      console.error("[FHIRGateway] Update anomaly detection config error:", error);
      res.status(500).json({ success: false, error: "Failed to update anomaly detection config" });
    }
  });

  router.get("/api/fhir-gateway/security/anomalies", async (req, res) => {
    try {
      const { severity, resolved, anomalyType, limit } = req.query;
      const events = aiFhirApiGateway.listAnomalyEvents({
        severity: severity as string | undefined,
        resolved: resolved === "true" ? true : resolved === "false" ? false : undefined,
        anomalyType: anomalyType as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({ success: true, events, total: events.length });
    } catch (error) {
      console.error("[FHIRGateway] List anomaly events error:", error);
      res.status(500).json({ success: false, error: "Failed to list anomaly events" });
    }
  });

  router.patch("/api/fhir-gateway/security/anomalies/:id/resolve", async (req, res) => {
    try {
      const event = aiFhirApiGateway.resolveAnomalyEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ success: false, error: "Anomaly event not found" });
      }
      res.json({ success: true, event });
    } catch (error) {
      console.error("[FHIRGateway] Resolve anomaly error:", error);
      res.status(500).json({ success: false, error: "Failed to resolve anomaly" });
    }
  });

  router.post("/api/fhir-gateway/security/detect-anomalies", async (req, res) => {
    try {
      const parseResult = AnomalyDetectionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        logHipaaAudit("ANOMALY_DETECTION_REQUEST_INVALID", { errors: parseResult.error.issues.map(e => e.message) });
        return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.issues });
      }
      const { userId, clientIp, operation, resourceType } = parseResult.data;
      const result = await aiFhirApiGateway.detectAnomaliesForRequest(userId, clientIp, operation, resourceType);
      if (result.anomalyDetected) {
        logHipaaAudit("ANOMALIES_DETECTED", { clientIp: hashIdentifier(clientIp), threatLevel: result.threatLevel, count: result.anomalies.length });
      }
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[FHIRGateway] Detect anomalies error:", error);
      res.status(500).json({ success: false, error: "Failed to detect anomalies" });
    }
  });

  router.post("/api/fhir-gateway/security/assess-risk", async (req, res) => {
    try {
      const parseResult = RiskAssessmentRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        logHipaaAudit("RISK_ASSESSMENT_REQUEST_INVALID", { errors: parseResult.error.issues.map(e => e.message) });
        return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.issues });
      }
      const { userId, clientIp, operation, resourceType, query, userAgent } = parseResult.data;
      const assessment = await aiFhirApiGateway.assessRequestRisk(userId, clientIp, operation, resourceType, query, userAgent);
      logHipaaAudit("RISK_ASSESSMENT_COMPLETED", { clientIp: hashIdentifier(clientIp), riskLevel: assessment.riskLevel, riskScore: assessment.overallRiskScore, recommendation: assessment.accessRecommendation });
      res.json({ success: true, assessment });
    } catch (error) {
      console.error("[FHIRGateway] Assess risk error:", error);
      res.status(500).json({ success: false, error: "Failed to assess request risk" });
    }
  });

  router.get("/api/fhir-gateway/security/behavior-profiles", async (req, res) => {
    try {
      const profiles = aiFhirApiGateway.listUserBehaviorProfiles();
      res.json({ success: true, profiles, total: profiles.length });
    } catch (error) {
      console.error("[FHIRGateway] List behavior profiles error:", error);
      res.status(500).json({ success: false, error: "Failed to list behavior profiles" });
    }
  });

  router.get("/api/fhir-gateway/security/behavior-profiles/:userId", async (req, res) => {
    try {
      const profile = aiFhirApiGateway.getUserBehaviorProfile(req.params.userId);
      if (!profile) {
        return res.status(404).json({ success: false, error: "Behavior profile not found" });
      }
      res.json({ success: true, profile });
    } catch (error) {
      console.error("[FHIRGateway] Get behavior profile error:", error);
      res.status(500).json({ success: false, error: "Failed to get behavior profile" });
    }
  });

  router.patch("/api/fhir-gateway/security/behavior-profiles/:userId", async (req, res) => {
    try {
      const parseResult = BehaviorProfileUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        logHipaaAudit("BEHAVIOR_PROFILE_UPDATE_INVALID", { userId: hashIdentifier(req.params.userId), errors: parseResult.error.issues.map(e => e.message) });
        return res.status(400).json({ success: false, error: "Invalid profile update", details: parseResult.error.issues });
      }
      const profile = aiFhirApiGateway.updateUserBehaviorProfile(req.params.userId, parseResult.data);
      logHipaaAudit("BEHAVIOR_PROFILE_UPDATED", { userId: hashIdentifier(req.params.userId), trustScore: profile.trustScore });
      res.json({ success: true, profile });
    } catch (error) {
      console.error("[FHIRGateway] Update behavior profile error:", error);
      res.status(500).json({ success: false, error: "Failed to update behavior profile" });
    }
  });

  router.get("/api/fhir-gateway/security/adaptive-rate-limits", async (req, res) => {
    try {
      const states = aiFhirApiGateway.listAdaptiveRateLimitStates();
      res.json({ success: true, states, total: states.length });
    } catch (error) {
      console.error("[FHIRGateway] List adaptive rate limits error:", error);
      res.status(500).json({ success: false, error: "Failed to list adaptive rate limit states" });
    }
  });

  router.get("/api/fhir-gateway/security/adaptive-rate-limits/:identifier", async (req, res) => {
    try {
      const state = aiFhirApiGateway.getAdaptiveRateLimitState(req.params.identifier);
      if (!state) {
        return res.status(404).json({ success: false, error: "Adaptive rate limit state not found" });
      }
      res.json({ success: true, state });
    } catch (error) {
      console.error("[FHIRGateway] Get adaptive rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to get adaptive rate limit state" });
    }
  });

  router.post("/api/fhir-gateway/security/adaptive-rate-limits/:identifier/reset", async (req, res) => {
    try {
      const success = aiFhirApiGateway.resetAdaptiveRateLimit(req.params.identifier);
      if (!success) {
        return res.status(404).json({ success: false, error: "Adaptive rate limit state not found" });
      }
      res.json({ success: true, message: "Adaptive rate limit reset to baseline" });
    } catch (error) {
      console.error("[FHIRGateway] Reset adaptive rate limit error:", error);
      res.status(500).json({ success: false, error: "Failed to reset adaptive rate limit" });
    }
  });

  router.get("/api/fhir-gateway/security/threat-intelligence", async (req, res) => {
    try {
      const threats = aiFhirApiGateway.listThreatIntelligence();
      res.json({ success: true, threats, total: threats.length });
    } catch (error) {
      console.error("[FHIRGateway] List threat intelligence error:", error);
      res.status(500).json({ success: false, error: "Failed to list threat intelligence" });
    }
  });

  router.post("/api/fhir-gateway/security/threat-intelligence", async (req, res) => {
    try {
      const parseResult = ThreatIntelligenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        logHipaaAudit("THREAT_INTEL_ADD_INVALID", { errors: parseResult.error.issues.map(e => e.message) });
        return res.status(400).json({ success: false, error: "Invalid threat intelligence", details: parseResult.error.issues });
      }
      const data = parseResult.data;
      const threat = aiFhirApiGateway.addThreatIntelligence({ type: data.type, indicator: data.indicator, severity: data.severity, description: data.description, source: data.source, expiresAt: data.expiresAt, active: data.active ?? true });
      logHipaaAudit("THREAT_INTELLIGENCE_ADDED", { threatId: threat.id, type: threat.type, severity: threat.severity });
      res.status(201).json({ success: true, threat });
    } catch (error) {
      console.error("[FHIRGateway] Add threat intelligence error:", error);
      res.status(500).json({ success: false, error: "Failed to add threat intelligence" });
    }
  });

  router.patch("/api/fhir-gateway/security/threat-intelligence/:id", async (req, res) => {
    try {
      const threat = aiFhirApiGateway.updateThreatIntelligence(req.params.id, req.body);
      if (!threat) {
        return res.status(404).json({ success: false, error: "Threat intelligence entry not found" });
      }
      res.json({ success: true, threat });
    } catch (error) {
      console.error("[FHIRGateway] Update threat intelligence error:", error);
      res.status(500).json({ success: false, error: "Failed to update threat intelligence" });
    }
  });

  router.delete("/api/fhir-gateway/security/threat-intelligence/:id", async (req, res) => {
    try {
      const deleted = aiFhirApiGateway.deleteThreatIntelligence(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Threat intelligence entry not found" });
      }
      res.json({ success: true, message: "Threat intelligence entry deleted" });
    } catch (error) {
      console.error("[FHIRGateway] Delete threat intelligence error:", error);
      res.status(500).json({ success: false, error: "Failed to delete threat intelligence" });
    }
  });

  router.get("/api/fhir-gateway/security/dashboard", async (req, res) => {
    try {
      const dashboard = aiFhirApiGateway.getSecurityDashboard();
      res.json({ success: true, dashboard });
    } catch (error) {
      console.error("[FHIRGateway] Get security dashboard error:", error);
      res.status(500).json({ success: false, error: "Failed to get security dashboard" });
    }
  });

  console.log("[Routes] AI FHIR API Gateway routes registered at /api/fhir-gateway/*");
  console.log("[Routes] AI Security routes registered at /api/fhir-gateway/security/*");
}
